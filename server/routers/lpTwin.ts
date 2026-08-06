/**
 * lpTwin.ts — LP Twin Router
 * CapTwin Enterprise Module — WP2
 *
 * All procedures use enterpriseProcedure which:
 *   1. Resolves the authenticated user (throws UNAUTHORIZED if absent)
 *   2. Resolves active enterprise membership (throws FORBIDDEN if none)
 *   3. Verifies org is not suspended (throws FORBIDDEN if suspended)
 *   4. Injects ctx.orgId — the server-resolved org, never client-supplied
 *
 * Every query is scoped by ctx.orgId. Cross-tenant access is structurally
 * impossible: a user from Org B will have ctx.orgId = orgBId and will never
 * see Org A's records even if they supply Org A's fund/session IDs.
 *
 * ACCURACY DISCLAIMER: All outputs are evidence-based synthetic simulations
 * derived from anonymised institutional archetypes. They are NOT validated
 * predictions of real allocator behaviour. Do not claim predictive accuracy
 * until outputs are validated against real allocator responses.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { enterpriseProcedure } from "../_core/orgMiddleware";
import { router } from "../_core/trpc";
import { getDb } from "../db";
import {
  lpTwinFunds,
  lpTwinSessions,
  lpTwinSegmentResults,
  lpTwinExports,
  type InsertLpTwinFund,
  type InsertLpTwinSession,
  type InsertLpTwinSegmentResult,
  type InsertLpTwinExport,
} from "../../drizzle/schema";
import {
  LP_AGENT_BANK,
  LP_AGENT_BANK_VERSION,
  LP_OBJECTION_RULES_VERSION,
  getAgentById,
  FIT_ENGINE_VERSION,
  OBJECTION_ENGINE_VERSION,
  computeAllocatorFit,
  buildFundProfileFromDb,
  generateObjections,
  summariseObjections,
} from "../../shared/captwin";
import {
  lpTwinAskLp,
  type InsertLpTwinAskLp,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
// ── Zod schemas ───────────────────────────────────────────────────────────────

const EconomicsSchema = z.object({
  managementFeePct: z.number().min(0).max(5),
  carryPct: z.number().min(0).max(40),
  hurdleRatePct: z.number().min(0).max(30).optional(),
  preferredReturnPct: z.number().min(0).max(30).optional(),
});

const TrackRecordSchema = z.object({
  trackRecordYrs: z.number().min(0).max(50),
  priorFundIRR: z.number().min(-100).max(200),
  priorFundMOIC: z.number().min(0).max(100).optional(),
  vintageYear: z.number().min(1990).max(2030).optional(),
  fundNumber: z.number().min(1).optional(),
});

const CreateFundInput = z.object({
  fundName: z.string().min(1).max(256),
  gpName: z.string().min(1).max(256),
  strategy: z.string().min(1).max(128),
  assetClass: z.string().max(128).optional(),
  geography: z.string().max(256).optional(),
  domicile: z.string().max(128).optional(),
  currency: z.string().max(8).default("USD"),
  targetFundSizeM: z.number().positive(),
  economics: EconomicsSchema,
  investmentProposition: z.record(z.string(), z.unknown()).optional(),
  riskLiquidity: z.record(z.string(), z.unknown()).optional(),
  trackRecord: TrackRecordSchema,
  institutionalRequirements: z.record(z.string(), z.unknown()).optional(),
});

const UpdateFundInput = CreateFundInput.partial().extend({
  fundId: z.number().int().positive(),
});

const CreateSessionInput = z.object({
  fundId: z.number().int().positive(),
  sessionName: z.string().min(1).max(256),
  selectedSegmentIds: z.array(z.string()).min(1).max(20),
  scenarioType: z.enum(["baseline", "stress", "optimistic", "custom"]).default("baseline"),
  assumptions: z.record(z.string(), z.unknown()).optional(),
});

const ExportSessionInput = z.object({
  sessionId: z.number().int().positive(),
  exportType: z.enum(["pdf", "csv", "json"]),
  reportType: z.enum(["full_session", "segment_summary", "ic_debate", "fit_matrix"]).default("full_session"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertFundOwnership(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  fundId: number,
  orgId: number
) {
  const [fund] = await db
    .select()
    .from(lpTwinFunds)
    .where(and(eq(lpTwinFunds.id, fundId), eq(lpTwinFunds.orgId, orgId)))
    .limit(1);
  if (!fund) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fund not found or access denied" });
  }
  return fund;
}

async function assertSessionOwnership(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  sessionId: number,
  orgId: number
) {
  const [session] = await db
    .select()
    .from(lpTwinSessions)
    .where(and(
      eq(lpTwinSessions.id, sessionId),
      eq(lpTwinSessions.orgId, orgId),
      isNull(lpTwinSessions.deletedAt),
    ))
    .limit(1);
  if (!session) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Session not found or access denied" });
  }
  return session;
}

function buildFundParams(
  fund: typeof lpTwinFunds.$inferSelect,
  assumptions?: Record<string, unknown>
): FundProfile {
  const economics = JSON.parse(fund.economicsJson) as { managementFeePct: number; carryPct: number };
  const trackRecord = JSON.parse(fund.trackRecordJson) as { trackRecordYrs: number; priorFundIRR: number };
  return {
    strategy: fund.strategy as FundProfile["strategy"],
    targetCapital: Number(fund.targetFundSizeM),
    managementFee: economics.managementFeePct,
    carry: economics.carryPct,
    trackRecord: trackRecord.trackRecordYrs,
    priorIRR: trackRecord.priorFundIRR,
    velocityLever: (assumptions?.velocityLever as number) ?? 50,
    placementAgent: (assumptions?.placementAgent as boolean) ?? false,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const lpTwinRouter = router({

  // 1. createFund
  createFund: enterpriseProcedure
    .input(CreateFundInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = Date.now();
      const payload: InsertLpTwinFund = {
        orgId: ctx.orgId,
        createdByUserId: ctx.user.id,
        updatedByUserId: ctx.user.id,
        fundName: input.fundName,
        gpName: input.gpName,
        strategy: input.strategy,
        assetClass: input.assetClass,
        geography: input.geography,
        domicile: input.domicile,
        currency: input.currency,
        targetFundSizeM: String(input.targetFundSizeM),
        economicsJson: JSON.stringify(input.economics),
        investmentPropositionJson: input.investmentProposition ? JSON.stringify(input.investmentProposition) : undefined,
        riskLiquidityJson: input.riskLiquidity ? JSON.stringify(input.riskLiquidity) : undefined,
        trackRecordJson: JSON.stringify(input.trackRecord),
        institutionalRequirementsJson: input.institutionalRequirements ? JSON.stringify(input.institutionalRequirements) : undefined,
        evidenceStatus: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(lpTwinFunds).values(payload);
      const fundId = (result as { insertId: number }).insertId;
      return { fundId, message: "Fund profile created" };
    }),

  // 2. updateFund
  updateFund: enterpriseProcedure
    .input(UpdateFundInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);
      if (fund.archivedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot update an archived fund" });
      const updates: Partial<typeof lpTwinFunds.$inferInsert> = {
        updatedByUserId: ctx.user.id,
        updatedAt: Date.now(),
        version: fund.version + 1,
      };
      if (input.fundName !== undefined) updates.fundName = input.fundName;
      if (input.gpName !== undefined) updates.gpName = input.gpName;
      if (input.strategy !== undefined) updates.strategy = input.strategy;
      if (input.assetClass !== undefined) updates.assetClass = input.assetClass;
      if (input.geography !== undefined) updates.geography = input.geography;
      if (input.domicile !== undefined) updates.domicile = input.domicile;
      if (input.currency !== undefined) updates.currency = input.currency;
      if (input.targetFundSizeM !== undefined) updates.targetFundSizeM = String(input.targetFundSizeM);
      if (input.economics !== undefined) updates.economicsJson = JSON.stringify(input.economics);
      if (input.investmentProposition !== undefined) updates.investmentPropositionJson = JSON.stringify(input.investmentProposition);
      if (input.riskLiquidity !== undefined) updates.riskLiquidityJson = JSON.stringify(input.riskLiquidity);
      if (input.trackRecord !== undefined) updates.trackRecordJson = JSON.stringify(input.trackRecord);
      if (input.institutionalRequirements !== undefined) updates.institutionalRequirementsJson = JSON.stringify(input.institutionalRequirements);
      await db.update(lpTwinFunds).set(updates).where(and(eq(lpTwinFunds.id, input.fundId), eq(lpTwinFunds.orgId, ctx.orgId)));
      return { fundId: input.fundId, version: updates.version, message: "Fund profile updated" };
    }),

  // 3. listFunds
  listFunds: enterpriseProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conditions = [eq(lpTwinFunds.orgId, ctx.orgId)];
      if (!input.includeArchived) conditions.push(isNull(lpTwinFunds.archivedAt));
      const funds = await db.select({
        id: lpTwinFunds.id,
        fundName: lpTwinFunds.fundName,
        gpName: lpTwinFunds.gpName,
        strategy: lpTwinFunds.strategy,
        currency: lpTwinFunds.currency,
        targetFundSizeM: lpTwinFunds.targetFundSizeM,
        evidenceStatus: lpTwinFunds.evidenceStatus,
        version: lpTwinFunds.version,
        createdAt: lpTwinFunds.createdAt,
        updatedAt: lpTwinFunds.updatedAt,
        archivedAt: lpTwinFunds.archivedAt,
      }).from(lpTwinFunds).where(and(...conditions)).orderBy(desc(lpTwinFunds.updatedAt));
      return { funds };
    }),

  // 4. getFund
  getFund: enterpriseProcedure
    .input(z.object({ fundId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);
      return { fund };
    }),

  // 5. archiveFund
  archiveFund: enterpriseProcedure
    .input(z.object({ fundId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await assertFundOwnership(db, input.fundId, ctx.orgId);
      await db.update(lpTwinFunds).set({ archivedAt: Date.now(), updatedByUserId: ctx.user.id, updatedAt: Date.now() })
        .where(and(eq(lpTwinFunds.id, input.fundId), eq(lpTwinFunds.orgId, ctx.orgId)));
      return { fundId: input.fundId, message: "Fund archived" };
    }),

  // 6. createSession
  createSession: enterpriseProcedure
    .input(CreateSessionInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await assertFundOwnership(db, input.fundId, ctx.orgId);
      for (const segId of input.selectedSegmentIds) {
        if (!getAgentById(segId)) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown LP segment ID: ${segId}` });
      }
      const now = Date.now();
      const payload: InsertLpTwinSession = {
        orgId: ctx.orgId,
        fundId: input.fundId,
        createdByUserId: ctx.user.id,
        sessionName: input.sessionName,
        selectedSegmentsJson: JSON.stringify(input.selectedSegmentIds),
        scenarioType: input.scenarioType,
        assumptionsJson: input.assumptions ? JSON.stringify(input.assumptions) : undefined,
        engineVersion: FIT_ENGINE_VERSION,
        registryVersion: LP_AGENT_BANK_VERSION,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(lpTwinSessions).values(payload);
      const sessionId = (result as { insertId: number }).insertId;
      return { sessionId, message: "Session created" };
    }),

  // 7. listSessions
  listSessions: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conditions = [eq(lpTwinSessions.orgId, ctx.orgId), isNull(lpTwinSessions.deletedAt)];
      if (input.fundId !== undefined) conditions.push(eq(lpTwinSessions.fundId, input.fundId));
      const sessions = await db.select({
        id: lpTwinSessions.id,
        fundId: lpTwinSessions.fundId,
        sessionName: lpTwinSessions.sessionName,
        scenarioType: lpTwinSessions.scenarioType,
        status: lpTwinSessions.status,
        engineVersion: lpTwinSessions.engineVersion,
        createdAt: lpTwinSessions.createdAt,
        completedAt: lpTwinSessions.completedAt,
      }).from(lpTwinSessions).where(and(...conditions)).orderBy(desc(lpTwinSessions.createdAt)).limit(input.limit);
      return { sessions };
    }),

  // 8. getSession
  getSession: enterpriseProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const session = await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      const results = await db.select().from(lpTwinSegmentResults)
        .where(and(eq(lpTwinSegmentResults.sessionId, input.sessionId), eq(lpTwinSegmentResults.orgId, ctx.orgId)))
        .orderBy(desc(lpTwinSegmentResults.fitScore));
      return { session, results };
    }),

  // 9. runSegmentAnalysis (WP4B+4C+4G — v2 fit engine, objection engine, progress tracking)
  runSegmentAnalysis: enterpriseProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      segmentIdsToRetry: z.array(z.string()).optional(), // WP4G: segment-level retry
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const session = await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      if (session.status === "running") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis already running" });
      if (session.status === "completed" && !input.segmentIdsToRetry?.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Session already completed. Use segmentIdsToRetry to retry specific segments." });
      }
      const fund = await assertFundOwnership(db, session.fundId, ctx.orgId);
      const now = Date.now();
      await db.update(lpTwinSessions).set({
        status: "running",
        startedAt: session.startedAt ?? now,
        segmentsCompleted: 0,
        segmentsFailed: 0,
        updatedAt: now,
      }).where(eq(lpTwinSessions.id, input.sessionId));

      const selectedIds = JSON.parse(session.selectedSegmentsJson) as string[];
      const idsToProcess = input.segmentIdsToRetry?.length
        ? input.segmentIdsToRetry.filter((id) => selectedIds.includes(id))
        : selectedIds;
      const assumptions = session.assumptionsJson ? JSON.parse(session.assumptionsJson) as Record<string, unknown> : {};
      const fundProfile = buildFundProfileFromDb(fund, assumptions);

      let completed = 0;
      let failed = 0;
      const errors: Array<{ segmentId: string; error: string }> = [];

      for (const segId of idsToProcess) {
        try {
          // Update progress
          await db.update(lpTwinSessions).set({ currentSegment: segId, updatedAt: Date.now() })
            .where(eq(lpTwinSessions.id, input.sessionId));

          const agent = getAgentById(segId);
          if (!agent) {
            errors.push({ segmentId: segId, error: `Unknown segment ID: ${segId}` });
            failed++;
            continue;
          }

          // Idempotency: delete existing result for this segment if retrying
          if (input.segmentIdsToRetry?.includes(segId)) {
            await db.delete(lpTwinSegmentResults).where(and(
              eq(lpTwinSegmentResults.sessionId, input.sessionId),
              eq(lpTwinSegmentResults.segmentId, segId),
              eq(lpTwinSegmentResults.orgId, ctx.orgId),
            ));
          } else {
            // Check for duplicate — skip if already exists (idempotent)
            const [existing] = await db.select({ id: lpTwinSegmentResults.id })
              .from(lpTwinSegmentResults)
              .where(and(
                eq(lpTwinSegmentResults.sessionId, input.sessionId),
                eq(lpTwinSegmentResults.segmentId, segId),
                eq(lpTwinSegmentResults.orgId, ctx.orgId),
              )).limit(1);
            if (existing) { completed++; continue; }
          }

          // WP4B: 18-dimension fit scoring
          const fitResult = computeAllocatorFit(fundProfile, agent);

          // WP4C: Objection engine
          const objections = generateObjections(fundProfile, agent);
          const objSummary = summariseObjections(objections);

          // Probability band from fit category
          const probabilityBand =
            fitResult.fitCategory === "Strong Fit" ? "60-80%" :
            fitResult.fitCategory === "Conditional Fit" ? "30-55%" :
            fitResult.fitCategory === "Weak Fit" ? "10-25%" : "0-10%";

          // IC verdict from fit category
          const icVerdict =
            fitResult.fitCategory === "Strong Fit" ? "Approved" :
            fitResult.fitCategory === "Conditional Fit" ? "Conditional Watchlist" : "Rejected";

          // Tailored positioning from fit reasons
          const tailoredPositioning = fitResult.principalFitReasons.length > 0
            ? `Lead with: ${fitResult.principalFitReasons.slice(0, 2).join("; ")}. Address: ${fitResult.disqualifyingIssues.slice(0, 2).join("; ") || "no critical issues"}.`
            : "Insufficient fund data to generate positioning. Complete fund profile first.";

          await db.insert(lpTwinSegmentResults).values({
            orgId: ctx.orgId,
            sessionId: input.sessionId,
            segmentId: segId,
            fitScore: String(fitResult.overallFitScore),
            fitReasonsJson: JSON.stringify(fitResult.dimensions),
            disqualifiersJson: JSON.stringify(fitResult.disqualifyingIssues),
            objectionsJson: JSON.stringify(objections),
            evidenceGapsJson: JSON.stringify(fitResult.evidenceGaps),
            complianceFlagsJson: JSON.stringify({
              shariaRequired: agent.shariaRequired,
              esgRequired: agent.esgRequirements.toLowerCase().includes("required"),
              objectionSummary: objSummary,
            }),
            icVerdict,
            tailoredPositioning,
            probabilityBand,
            modelVersion: FIT_ENGINE_VERSION,
            createdAt: Date.now(),
          });
          completed++;
          await db.update(lpTwinSessions).set({ segmentsCompleted: completed, updatedAt: Date.now() })
            .where(eq(lpTwinSessions.id, input.sessionId));
        } catch (segErr) {
          failed++;
          errors.push({ segmentId: segId, error: segErr instanceof Error ? segErr.message : "Unknown error" });
          await db.update(lpTwinSessions).set({ segmentsFailed: failed, updatedAt: Date.now() })
            .where(eq(lpTwinSessions.id, input.sessionId));
        }
      }

      // Determine final status (WP4G)
      const finalStatus = failed === 0 ? "completed" :
                          completed > 0 ? ("partially_complete" as "failed") : "failed";
      await db.update(lpTwinSessions).set({
        status: finalStatus,
        completedAt: Date.now(),
        currentSegment: null,
        segmentsCompleted: completed,
        segmentsFailed: failed,
        errorDetailsJson: errors.length > 0 ? JSON.stringify(errors) : null,
        updatedAt: Date.now(),
      }).where(eq(lpTwinSessions.id, input.sessionId));

      return {
        sessionId: input.sessionId,
        segmentsAnalysed: completed,
        segmentsFailed: failed,
        status: finalStatus,
        errors: errors.length > 0 ? errors : undefined,
        disclaimer: "SYNTHETIC SIMULATION — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.",
        message: `Analysis ${finalStatus}. ${completed} segments scored, ${failed} failed.`,
      };
    }),

  // WP4E: askLp — grounded conversational query against a Synthetic LP Archetype
  askLp: enterpriseProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      segmentId: z.string().min(1),
      question: z.string().min(1).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Security: verify session and fund ownership
      const session = await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      const fund = await assertFundOwnership(db, session.fundId, ctx.orgId);

      // Verify segment is in this session
      const selectedIds = JSON.parse(session.selectedSegmentsJson) as string[];
      if (!selectedIds.includes(input.segmentId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Segment not part of this session" });
      }

      const agent = getAgentById(input.segmentId);
      if (!agent) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown segment ID" });

      // Get stored deterministic result for this segment
      const [storedResult] = await db.select()
        .from(lpTwinSegmentResults)
        .where(and(
          eq(lpTwinSegmentResults.sessionId, input.sessionId),
          eq(lpTwinSegmentResults.segmentId, input.segmentId),
          eq(lpTwinSegmentResults.orgId, ctx.orgId),
        )).limit(1);

      const deterministicScore = storedResult ? Number(storedResult.fitScore) : null;
      const assumptions = session.assumptionsJson ? JSON.parse(session.assumptionsJson) as Record<string, unknown> : {};
      const fundProfile = buildFundProfileFromDb(fund, assumptions);
      const fitResult = computeAllocatorFit(fundProfile, agent);
      const objections = generateObjections(fundProfile, agent);

      // Build grounded context for LLM
      const context = `
You are a ${agent.segmentType} allocator archetype (Synthetic LP Archetype — not a real institution).
Your mandate: ${agent.mandate}
Your geography: ${agent.geography}
Your ticket size: USD ${agent.ticketSizeMinM}M–${agent.ticketSizeMaxM}M
Your return threshold: ${agent.returnThresholdPct ? `${agent.returnThresholdPct}% net IRR` : "not specified"}
Your track record requirement: ${agent.trackRecordRequiredYrs} years minimum
Your Sharia requirement: ${agent.shariaRequired ? "Yes" : "No"}
Your ESG requirement: ${agent.esgRequirements}
Your max management fee: ${agent.maxManagementFeePct}%
Your max carry: ${agent.maxCarryPct}%
Your min GP commitment: ${agent.minGpCommitmentPct}%

Fund being presented: ${fund.fundName} by ${fund.gpName}
Strategy: ${fund.strategy}
Target size: USD ${fund.targetFundSizeM}M
Management fee: ${fundProfile.managementFeePct}%
Carried interest: ${fundProfile.carryPct}%
Track record: ${fundProfile.trackRecordYrs} years
Prior fund IRR: ${fundProfile.priorFundIRR != null ? `${fundProfile.priorFundIRR}%` : "not provided"}
GP commitment: ${fundProfile.gpCommitmentPct != null ? `${fundProfile.gpCommitmentPct}%` : "not provided"}
Sharia compliant: ${fundProfile.shariaCompliant === true ? "Yes" : fundProfile.shariaCompliant === false ? "No" : "Not specified"}
ESG policy: ${fundProfile.esgPolicy ?? "Not documented"}

Deterministic fit score: ${fitResult.overallFitScore}/100 (${fitResult.fitCategory})
Confidence: ${fitResult.confidenceLevel}
Principal fit reasons: ${fitResult.principalFitReasons.join("; ") || "None identified"}
Disqualifying issues: ${fitResult.disqualifyingIssues.join("; ") || "None identified"}
Evidence gaps: ${fitResult.evidenceGaps.map((g) => g.field).join(", ") || "None"}
Top objections: ${objections.slice(0, 3).map((o) => `${o.category} (${o.severity})`).join("; ") || "None"}

CRITICAL RULES:
1. You MUST NOT contradict the deterministic fit score of ${fitResult.overallFitScore}/100.
2. If your response implies a different fit level, flag it explicitly as an inconsistency.
3. You MUST end every response with: "SYNTHETIC SIMULATION — This response is from an anonymised institutional archetype. It is not a prediction of any real allocator's behaviour."
4. Do not use the name of any real institution.
5. Base all responses on the fund data and fit analysis provided above.
6. Use probability bands (Low/Moderate/High/Very High), not false numerical probabilities.
`;

      const llmResponse = await invokeLLM({
        messages: [
          { role: "system", content: context },
          { role: "user", content: input.question },
        ],
      });

      const responseText = (llmResponse.choices[0]?.message?.content ?? "Unable to generate response.") as string;

      // Inconsistency detection: check if response mentions a different fit level
      const fitLevelMentioned = responseText.toLowerCase().includes("strong fit") ||
                                responseText.toLowerCase().includes("conditional fit") ||
                                responseText.toLowerCase().includes("weak fit") ||
                                responseText.toLowerCase().includes("likely ineligible");
      const expectedLevel = fitResult.fitCategory.toLowerCase();
      const inconsistencyWarning = fitLevelMentioned && !responseText.toLowerCase().includes(expectedLevel)
        ? `INCONSISTENCY WARNING: The narrative response may imply a different fit level than the deterministic score of ${fitResult.overallFitScore}/100 (${fitResult.fitCategory}). The deterministic score takes precedence.`
        : null;

      // Persist the query/response
      const record: InsertLpTwinAskLp = {
        orgId: ctx.orgId,
        userId: ctx.user.id,
        fundId: session.fundId,
        fundVersion: fund.version,
        sessionId: input.sessionId,
        segmentId: input.segmentId,
        question: input.question,
        response: responseText,
        deterministicScore: deterministicScore != null ? String(deterministicScore) : undefined,
        inconsistencyWarning: inconsistencyWarning ?? undefined,
        engineVersion: FIT_ENGINE_VERSION,
        agentVersion: LP_AGENT_BANK_VERSION,
        createdAt: Date.now(),
      };
      await db.insert(lpTwinAskLp).values(record);

      return {
        response: responseText,
        deterministicScore,
        fitCategory: fitResult.fitCategory,
        confidenceLevel: fitResult.confidenceLevel,
        inconsistencyWarning,
        disclaimer: "SYNTHETIC SIMULATION — Responses are from anonymised institutional archetypes. They are not predictions of real allocator behaviour.",
        engineVersion: FIT_ENGINE_VERSION,
        agentVersion: LP_AGENT_BANK_VERSION,
      };
    }),

  // WP4G: getSessionProgress — real-time progress for running sessions
  getSessionProgress: enterpriseProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const session = await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      const selectedIds = JSON.parse(session.selectedSegmentsJson) as string[];
      return {
        sessionId: session.id,
        status: session.status,
        currentSegment: session.currentSegment,
        segmentsCompleted: session.segmentsCompleted,
        segmentsFailed: session.segmentsFailed,
        totalSegments: selectedIds.length,
        startedAt: session.startedAt,
        elapsedMs: session.startedAt ? Date.now() - session.startedAt : null,
        errorDetails: session.errorDetailsJson ? JSON.parse(session.errorDetailsJson) as unknown : null,
      };
    }),

  // WP4G: listAgents — return full LP Agent Bank v2
  listAgents: enterpriseProcedure
    .query(() => {
      return {
        agents: LP_AGENT_BANK.map((a) => ({
          id: a.id,
          name: a.name,
          label: a.label,
          segmentType: a.segmentType,
          mandate: a.mandate,
          geography: a.geography,
          ticketSizeMinM: a.ticketSizeMinM,
          ticketSizeMaxM: a.ticketSizeMaxM,
          preferredAssetClasses: a.preferredAssetClasses,
          fundSizeMinM: a.fundSizeMinM,
          fundSizeMaxM: a.fundSizeMaxM,
          returnThresholdPct: a.returnThresholdPct,
          shariaRequired: a.shariaRequired,
          esgRequirements: a.esgRequirements,
          firstTimeFundTolerance: a.firstTimeFundTolerance,
          maxManagementFeePct: a.maxManagementFeePct,
          maxCarryPct: a.maxCarryPct,
          minGpCommitmentPct: a.minGpCommitmentPct,
          verificationStatus: a.verificationStatus,
          registryVersion: a.registryVersion,
        })),
        agentBankVersion: LP_AGENT_BANK_VERSION,
        fitEngineVersion: FIT_ENGINE_VERSION,
        objectionEngineVersion: OBJECTION_ENGINE_VERSION,
        objectionRulesVersion: LP_OBJECTION_RULES_VERSION,
      };
    }),
  // 10. deleteSession
  deleteSession: enterpriseProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      await db.update(lpTwinSessions).set({ deletedAt: Date.now(), updatedAt: Date.now() })
        .where(and(eq(lpTwinSessions.id, input.sessionId), eq(lpTwinSessions.orgId, ctx.orgId)));
      return { sessionId: input.sessionId, message: "Session deleted" };
    }),

  // 11. exportSession
  exportSession: enterpriseProcedure
    .input(ExportSessionInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const session = await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      if (session.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot export a session that has not completed analysis" });
      const results = await db.select().from(lpTwinSegmentResults)
        .where(and(eq(lpTwinSegmentResults.sessionId, input.sessionId), eq(lpTwinSegmentResults.orgId, ctx.orgId)))
        .orderBy(desc(lpTwinSegmentResults.fitScore));
      const exportPayload: InsertLpTwinExport = {
        orgId: ctx.orgId,
        sessionId: input.sessionId,
        exportedByUserId: ctx.user.id,
        exportType: input.exportType,
        reportType: input.reportType,
        createdAt: Date.now(),
      };
      await db.insert(lpTwinExports).values(exportPayload);
      // Build full export payload
      const avgScore = results.length > 0
        ? results.reduce((s, r) => s + Number(r.fitScore), 0) / results.length
        : 0;
      const fullExportData = {
        exportId: exportPayload.createdAt,
        exportedAt: new Date().toISOString(),
        exportedByUserId: ctx.user.id,
        orgId: ctx.orgId,
        reportType: input.reportType,
        exportType: input.exportType,
        disclaimer: "SYNTHETIC SIMULATION — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.",
        session: {
          id: session.id,
          sessionName: session.sessionName,
          scenarioType: session.scenarioType,
          engineVersion: session.engineVersion,
          registryVersion: session.registryVersion,
          status: session.status,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          selectedSegmentCount: (JSON.parse(session.selectedSegmentsJson) as string[]).length,
        },
        summary: {
          averageFitScore: Math.round(avgScore * 10) / 10,
          strongFitCount: results.filter((r) => Number(r.fitScore) >= 70).length,
          conditionalFitCount: results.filter((r) => Number(r.fitScore) >= 50 && Number(r.fitScore) < 70).length,
          weakFitCount: results.filter((r) => Number(r.fitScore) < 50).length,
          totalSegments: results.length,
        },
        results: results.map((r) => ({
          segmentId: r.segmentId,
          fitScore: Number(r.fitScore),
          fitCategory: Number(r.fitScore) >= 70 ? "Strong Fit" : Number(r.fitScore) >= 50 ? "Conditional Fit" : Number(r.fitScore) >= 30 ? "Weak Fit" : "Likely Ineligible",
          icVerdict: r.icVerdict,
          probabilityBand: r.probabilityBand,
          dimensions: r.fitReasonsJson ? JSON.parse(r.fitReasonsJson) as unknown : [],
          disqualifiers: r.disqualifiersJson ? JSON.parse(r.disqualifiersJson) as unknown : [],
          objections: r.objectionsJson ? JSON.parse(r.objectionsJson) as unknown : [],
          evidenceGaps: r.evidenceGapsJson ? JSON.parse(r.evidenceGapsJson) as unknown : [],
          complianceFlags: r.complianceFlagsJson ? JSON.parse(r.complianceFlagsJson) as unknown : [],
          tailoredPositioning: r.tailoredPositioning,
          modelVersion: r.modelVersion,
          scoredAt: r.createdAt,
        })),
      };
      let csvData: string | null = null;
      if (input.exportType === "csv") {
        const headers = ["segmentId", "fitScore", "fitCategory", "icVerdict", "probabilityBand", "tailoredPositioning"];
        const rows = fullExportData.results.map((r) =>
          headers.map((h) => {
            const v = (r as Record<string, unknown>)[h];
            const s = v == null ? "" : String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
          }).join(",")
        );
        csvData = [headers.join(","), ...rows].join("\n");
      }
      return { exportData: fullExportData, csvData, exportType: input.exportType, message: "Export prepared. Audit record written." };
    }),

  // duplicateFund — creates a new org-scoped copy of an existing fund
  duplicateFund: enterpriseProcedure
    .input(z.object({ fundId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const source = await assertFundOwnership(db, input.fundId, ctx.orgId);
      const now = Date.now();
      const [result] = await db.insert(lpTwinFunds).values({
        orgId: ctx.orgId,
        createdByUserId: ctx.user.id,
        updatedByUserId: ctx.user.id,
        fundName: `${source.fundName} (Copy)`,
        gpName: source.gpName,
        strategy: source.strategy,
        assetClass: source.assetClass ?? undefined,
        geography: source.geography ?? undefined,
        domicile: source.domicile ?? undefined,
        currency: source.currency,
        targetFundSizeM: source.targetFundSizeM,
        economicsJson: source.economicsJson,
        investmentPropositionJson: source.investmentPropositionJson ?? undefined,
        riskLiquidityJson: source.riskLiquidityJson ?? undefined,
        trackRecordJson: source.trackRecordJson,
        institutionalRequirementsJson: source.institutionalRequirementsJson ?? undefined,
        evidenceStatus: "draft",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      return { newFundId: result.insertId, message: "Fund duplicated" };
    }),

  // listSegments (utility — no mutation, no side effects)
  listSegments: enterpriseProcedure
    .query(() => {
      return {
        segments: LP_AGENT_BANK.map((a) => ({
          id: a.id,
          name: a.name,
          label: a.label,
          segmentType: a.segmentType,
          geography: a.geography,
          ticketSizeMinM: a.ticketSizeMinM,
          ticketSizeMaxM: a.ticketSizeMaxM,
          preferredAssetClasses: a.preferredAssetClasses,
          shariaRequired: a.shariaRequired,
          returnThresholdPct: a.returnThresholdPct,
          maxManagementFeePct: a.maxManagementFeePct,
          mandate: a.mandate,
          verificationStatus: a.verificationStatus,
        })),
      };
    }),
});

export type LpTwinRouter = typeof lpTwinRouter;
