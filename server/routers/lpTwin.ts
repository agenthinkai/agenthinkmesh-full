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
import { eq, and, isNull, desc } from "drizzle-orm";
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
  CAPTWIN_ENGINE_VERSION,
  CAPTWIN_REGISTRY_VERSION,
  LP_REGISTRY,
  computeFitScore,
  runSimulation,
  simulateIC,
  getLPById,
  type FundParams,
} from "../../shared/captwin";

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
): FundParams {
  const economics = JSON.parse(fund.economicsJson) as { managementFeePct: number; carryPct: number };
  const trackRecord = JSON.parse(fund.trackRecordJson) as { trackRecordYrs: number; priorFundIRR: number };
  return {
    strategy: fund.strategy as FundParams["strategy"],
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
        if (!getLPById(segId)) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown LP segment ID: ${segId}` });
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
        engineVersion: CAPTWIN_ENGINE_VERSION,
        registryVersion: CAPTWIN_REGISTRY_VERSION,
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

  // 9. runSegmentAnalysis
  runSegmentAnalysis: enterpriseProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const session = await assertSessionOwnership(db, input.sessionId, ctx.orgId);
      if (session.status === "running") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis already running" });
      if (session.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis already completed. Create a new session to re-run." });
      const fund = await assertFundOwnership(db, session.fundId, ctx.orgId);
      await db.update(lpTwinSessions).set({ status: "running", startedAt: Date.now(), updatedAt: Date.now() }).where(eq(lpTwinSessions.id, input.sessionId));
      try {
        const selectedIds = JSON.parse(session.selectedSegmentsJson) as string[];
        const assumptions = session.assumptionsJson ? JSON.parse(session.assumptionsJson) as Record<string, unknown> : {};
        const fundParams = buildFundParams(fund, assumptions);
        const simulation = runSimulation(fundParams);
        const now = Date.now();
        const resultRows: InsertLpTwinSegmentResult[] = [];
        for (const segId of selectedIds) {
          const lp = getLPById(segId);
          if (!lp) continue;
          const fit = computeFitScore(fundParams, lp);
          const icResult = simulateIC(fundParams, lp, fit);
          const evidenceGaps = fit.penaltyReasons.map((reason) => ({
            gap: reason,
            priority: fit.penalties > 20 ? "high" : "medium",
          }));
          const complianceFlags = lp.complianceFlags.map((flag) => ({
            flag,
            status: fit.penaltyReasons.some((r) => r.toLowerCase().includes(flag.toLowerCase().split(" ")[0])) ? "fail" : "pass",
          }));
          const probabilityBand = icResult.icVerdict === "Approved" ? "60-80%" : icResult.icVerdict === "Conditional Watchlist" ? "25-45%" : "5-15%";
          resultRows.push({
            orgId: ctx.orgId,
            sessionId: input.sessionId,
            segmentId: segId,
            fitScore: String(fit.score),
            fitReasonsJson: JSON.stringify([
              { dimension: "Strategy Fit", score: fit.strategyFit },
              { dimension: "Pedigree Fit", score: fit.pedigreeFit },
              { dimension: "Fee Alignment", score: fit.feeAlignment },
            ]),
            disqualifiersJson: JSON.stringify(fit.penaltyReasons.filter((r) => r.includes("mismatch") || r.includes("hard gate"))),
            objectionsJson: JSON.stringify(icResult.icObjections),
            evidenceGapsJson: JSON.stringify(evidenceGaps),
            complianceFlagsJson: JSON.stringify(complianceFlags),
            icVerdict: icResult.icVerdict,
            tailoredPositioning: icResult.tailoredPitch,
            probabilityBand,
            modelVersion: CAPTWIN_ENGINE_VERSION,
            createdAt: now,
          });
        }
        if (resultRows.length > 0) await db.insert(lpTwinSegmentResults).values(resultRows);
        await db.update(lpTwinSessions).set({ status: "completed", completedAt: Date.now(), updatedAt: Date.now() }).where(eq(lpTwinSessions.id, input.sessionId));
        return {
          sessionId: input.sessionId,
          segmentsAnalysed: resultRows.length,
          simulation: {
            grossRaised: simulation.grossRaised,
            netAUM: simulation.netAUM,
            estimatedCloseMonth: simulation.estimatedCloseMonth,
            totalFees: simulation.totalFees,
          },
          disclaimer: "SYNTHETIC SIMULATION — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.",
          message: "Segment analysis complete",
        };
      } catch (err) {
        await db.update(lpTwinSessions).set({ status: "failed", updatedAt: Date.now() }).where(eq(lpTwinSessions.id, input.sessionId));
        throw err;
      }
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
      const exportData = {
        sessionId: input.sessionId,
        sessionName: session.sessionName,
        scenarioType: session.scenarioType,
        engineVersion: session.engineVersion,
        registryVersion: session.registryVersion,
        exportedAt: new Date().toISOString(),
        reportType: input.reportType,
        disclaimer: "SYNTHETIC SIMULATION — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.",
        results: results.map((r) => ({
          segmentId: r.segmentId,
          fitScore: r.fitScore,
          icVerdict: r.icVerdict,
          probabilityBand: r.probabilityBand,
          objections: r.objectionsJson ? JSON.parse(r.objectionsJson) : [],
          complianceFlags: r.complianceFlagsJson ? JSON.parse(r.complianceFlagsJson) : [],
          tailoredPositioning: r.tailoredPositioning,
          modelVersion: r.modelVersion,
        })),
      };
      return { exportData, exportType: input.exportType, message: "Export prepared. Audit record written." };
    }),

  // listSegments (utility — no mutation, no side effects)
  listSegments: enterpriseProcedure
    .query(() => {
      return {
        segments: LP_REGISTRY.map((lp) => ({
          id: lp.id,
          name: lp.name,
          region: lp.region,
          segment: lp.segment,
          ticketMin: lp.ticketMin,
          ticketMax: lp.ticketMax,
          strategies: lp.strategies,
          shariaRequired: lp.shariaRequired,
          esgPriority: lp.esgPriority,
          irrHurdle: lp.irrHurdle,
          maxManagementFee: lp.maxManagementFee,
          description: lp.description,
        })),
      };
    }),
});

export type LpTwinRouter = typeof lpTwinRouter;
