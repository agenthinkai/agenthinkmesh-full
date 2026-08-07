/**
 * lpTwinMeeting.ts — WP6 Capital Formation Execution Layer Router
 *
 * Procedures:
 *  1.  generateMeetingBrief      — structured pre-meeting preparation
 *  2.  evaluateObjectionResponse — rehearsal scoring (factual quality only)
 *  3.  runLPPanel               — multi-agent panel simulation
 *  4.  getReadinessScore        — Global Investor Readiness Score (14 dims)
 *  5.  listAgentBank            — customer-facing LP Agent Bank view
 *  6.  getAgentBankEntry        — single agent detail with evidence status
 *  7.  createMeeting            — record an actual investor meeting
 *  8.  updateMeeting            — update meeting stage/outcome
 *  9.  getMeeting               — get meeting with responses
 * 10.  listMeetings             — list org-scoped meetings
 * 11.  addMeetingResponse       — add actual question/objection response
 * 12.  deleteMeeting            — soft-delete meeting
 * 13.  compareWithSimulation    — synthetic vs actual comparison
 * 14.  getValidationComparison  — get stored comparison
 * 15.  createPipelineEntry      — add investor to pipeline
 * 16.  updatePipelineEntry      — update stage/fit/next action
 * 17.  listPipeline             — list org-scoped pipeline with filters
 * 18.  deletePipelineEntry      — soft-delete pipeline entry
 * 19.  generateReport           — generate and persist a capital formation report
 * 20.  getReport                — retrieve a persisted report
 * 21.  listReports              — list org-scoped reports
 */

import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { enterpriseProcedure } from "../_core/orgMiddleware";
import { getDb } from "../db";
import {
  lpTwinFunds,
  lpTwinSessions,
  lpTwinSegmentResults,
  lpTwinActualMeetings,
  lpTwinActualResponses,
  lpTwinValidationComparisons,
  lpTwinPipeline,
  lpTwinReports,
  lpTwinExports,
} from "../../drizzle/schema";
import {
  buildFundProfileFromDb,
  type FundProfile,
  FIT_ENGINE_VERSION,
  computeAllocatorFit,
} from "../../shared/captwin/fitEngine";
import {
  LP_AGENT_BANK_VERSION,
  LP_AGENT_BANK,
  getAgentById,
} from "../../shared/captwin/agentBank";
import {
  OBJECTION_ENGINE_VERSION,
  generateObjections,
} from "../../shared/captwin/objectionEngine";
import {
  READINESS_ENGINE_VERSION,
  computeReadinessScore,
} from "../../shared/captwin/readinessEngine";
import {
  MEETING_ENGINE_VERSION,
  generateMeetingBrief as genMeetingBrief,
  evaluateObjectionResponse as evalObjectionResponse,
  runLPPanel as runPanel,
  type MeetingType,
  type MeetingObjective,
} from "../../shared/captwin/meetingEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertFundOwnership(db: Awaited<ReturnType<typeof getDb>>, fundId: number, orgId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [fund] = await db.select().from(lpTwinFunds).where(
    and(eq(lpTwinFunds.id, fundId), eq(lpTwinFunds.orgId, orgId), isNull(lpTwinFunds.archivedAt))
  ).limit(1);
  if (!fund) throw new TRPCError({ code: "NOT_FOUND", message: "Fund not found or access denied" });
  return fund;
}

async function assertMeetingOwnership(db: Awaited<ReturnType<typeof getDb>>, meetingId: number, orgId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [meeting] = await db.select().from(lpTwinActualMeetings).where(
    and(eq(lpTwinActualMeetings.id, meetingId), eq(lpTwinActualMeetings.orgId, orgId), isNull(lpTwinActualMeetings.archivedAt))
  ).limit(1);
  if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found or access denied" });
  return meeting;
}

async function assertPipelineOwnership(db: Awaited<ReturnType<typeof getDb>>, entryId: number, orgId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const [entry] = await db.select().from(lpTwinPipeline).where(
    and(eq(lpTwinPipeline.id, entryId), eq(lpTwinPipeline.orgId, orgId), isNull(lpTwinPipeline.archivedAt))
  ).limit(1);
  if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline entry not found or access denied" });
  return entry;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const lpTwinMeetingRouter = router({

  // 1. Generate Meeting Brief
  generateMeetingBrief: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      segmentId: z.string().min(1),
      meetingType: z.enum(["introductory", "first_diligence", "follow_up", "ic_preparation", "terms_discussion", "final_diligence", "reup_discussion", "consultant_gatekeeper"]),
      meetingObjective: z.enum(["secure_second_meeting", "enter_formal_diligence", "obtain_data_room_request", "resolve_objections", "discuss_terms", "secure_soft_circle", "progress_toward_commitment", "understand_rejection"]),
      sessionId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const fund = await assertFundOwnership(db!, input.fundId, ctx.orgId);
      const fundProfile = buildFundProfileFromDb(fund);

      // Optionally load pre-computed fit result from session
      let fitResult;
      if (input.sessionId && db) {
        const [segResult] = await db.select().from(lpTwinSegmentResults).where(
          and(
            eq(lpTwinSegmentResults.sessionId, input.sessionId),
            eq(lpTwinSegmentResults.segmentId, input.segmentId)
          )
        ).limit(1);
        if (segResult) {
          fitResult = segResult.fitReasonsJson ? JSON.parse(segResult.fitReasonsJson) : undefined;
        }
      }

      const brief = genMeetingBrief(fundProfile, input.segmentId, input.meetingType as MeetingType, input.meetingObjective as MeetingObjective, fitResult);

      return { brief };
    }),

  // 2. Evaluate Objection Response
  evaluateObjectionResponse: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      segmentId: z.string().min(1),
      objection: z.string().min(1),
      gpResponse: z.string().min(1),
      sessionId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const fund = await assertFundOwnership(db!, input.fundId, ctx.orgId);
      const fundProfile = buildFundProfileFromDb(fund);
      const agent = getAgentById(input.segmentId);
      if (!agent) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown segment: ${input.segmentId}` });

      const fitResult = computeAllocatorFit(fundProfile, agent);
      const evaluation = evalObjectionResponse(input.objection, input.gpResponse, fundProfile, fitResult);

      return { evaluation };
    }),

  // 3. Run LP Panel
  runLPPanel: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      segmentIds: z.array(z.string()).min(1).max(9),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const fund = await assertFundOwnership(db!, input.fundId, ctx.orgId);
      const fundProfile = buildFundProfileFromDb(fund);

      const panelResult = runPanel(fundProfile, input.segmentIds);
      return { panelResult };
    }),

  // 4. Get Readiness Score
  getReadinessScore: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const fund = await assertFundOwnership(db!, input.fundId, ctx.orgId);
      const fundProfile = buildFundProfileFromDb(fund);
      const readiness = computeReadinessScore(fundProfile);
      return { readiness, fundName: fund.fundName, fundVersion: fund.version };
    }),

  // 5. List Agent Bank
  listAgentBank: enterpriseProcedure
    .input(z.object({
      compareWithFundId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      let fundProfile: FundProfile | undefined;
      if (input.compareWithFundId && db) {
        const fund = await assertFundOwnership(db, input.compareWithFundId, ctx.orgId);
        fundProfile = buildFundProfileFromDb(fund);
      }

      const agents = LP_AGENT_BANK.map((agent) => {
        const fitResult = fundProfile ? computeAllocatorFit(fundProfile, agent) : null;
        return {
          id: agent.id,
          name: agent.name,
          type: agent.segmentType,
          mandate: agent.mandate,
          geography: agent.geography,
          minTicketM: agent.ticketSizeMinM,
          maxTicketM: agent.ticketSizeMaxM,
          diligenceCycleMonths: agent.diligenceDurationMonths,
          complianceFlags: agent.commonObjections,
          evidenceBasis: agent.evidenceBasis ?? "Anonymised institutional archetype based on publicly available allocation data",
          verificationStatus: agent.verificationStatus ?? "Synthetic archetype — not based on a specific institution",
          lastUpdated: agent.lastUpdated ?? "2025-Q4",
          registryVersion: LP_AGENT_BANK_VERSION,
          knownLimitations: agent.knownLimitations,
          // Synthetic LP Archetype label — must be displayed prominently
          archetypeLabel: "Synthetic LP Archetype",
          fitScore: fitResult?.overallFitScore ?? null,
          fitCategory: fitResult?.fitCategory ?? null,
        };
      });

      return {
        agents,
        registryVersion: LP_AGENT_BANK_VERSION,
        disclaimer: "SYNTHETIC LP ARCHETYPES — These profiles are evidence-based synthetic representations of institutional allocator types. They do not represent any specific institution. All fit scores are synthetic simulations.",
      };
    }),

  // 6. Get Agent Bank Entry
  getAgentBankEntry: enterpriseProcedure
    .input(z.object({
      segmentId: z.string().min(1),
      compareWithFundId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const agent = getAgentById(input.segmentId);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: `Unknown segment: ${input.segmentId}` });

      const db = await getDb();
      let fitResult, objections;
      if (input.compareWithFundId && db) {
        const fund = await assertFundOwnership(db, input.compareWithFundId, ctx.orgId);
        const fundProfile = buildFundProfileFromDb(fund);
        fitResult = computeAllocatorFit(fundProfile, agent);
        objections = generateObjections(fundProfile, agent);
      }

      return {
        agent: {
          ...agent,
          archetypeLabel: "Synthetic LP Archetype",
          evidenceBasis: agent.evidenceBasis ?? "Anonymised institutional archetype based on publicly available allocation data",
          verificationStatus: agent.verificationStatus ?? "Synthetic archetype — not based on a specific institution",
          lastUpdated: agent.lastUpdated ?? "2025-Q4",
          registryVersion: LP_AGENT_BANK_VERSION,
          knownLimitations: agent.knownLimitations,
        },
        fitResult: fitResult ?? null,
        objections: objections ?? null,
        disclaimer: "SYNTHETIC LP ARCHETYPE — This profile is an evidence-based synthetic representation. It does not represent any specific institution.",
      };
    }),

  // 7. Create Meeting
  createMeeting: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      fundVersion: z.number().int().positive(),
      segmentId: z.string().min(1),
      meetingDate: z.number().int().positive(),
      meetingType: z.enum(["introductory", "first_diligence", "follow_up", "ic_preparation", "terms_discussion", "final_diligence", "reup_discussion", "consultant_gatekeeper"]),
      meetingObjective: z.string().optional(),
      institutionName: z.string().max(256).optional(),
      sessionId: z.number().int().positive().optional(),
      scenarioId: z.number().int().positive().optional(),
      stage: z.enum(["target", "contacted", "first_meeting", "follow_up", "diligence", "ic_review", "soft_circle", "committed", "declined", "deferred"]).optional(),
      interestLevel: z.enum(["strong", "moderate", "low", "none", "unknown"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertFundOwnership(db!, input.fundId, ctx.orgId);
      if (!getAgentById(input.segmentId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown segment: ${input.segmentId}` });
      }

      const now = Date.now();
      const [result] = await db!.insert(lpTwinActualMeetings).values({
        orgId: ctx.orgId,
        createdByUserId: ctx.user!.id,
        updatedByUserId: ctx.user!.id,
        fundId: input.fundId,
        fundVersion: input.fundVersion,
        sessionId: input.sessionId ?? null,
        scenarioId: input.scenarioId ?? null,
        segmentId: input.segmentId,
        institutionName: input.institutionName ?? null,
        meetingDate: input.meetingDate,
        meetingType: input.meetingType,
        meetingObjective: input.meetingObjective ?? null,
        stage: input.stage ?? "first_meeting",
        interestLevel: input.interestLevel ?? "unknown",
        notes: input.notes ?? null,
        engineVersion: FIT_ENGINE_VERSION,
        registryVersion: LP_AGENT_BANK_VERSION,
        createdAt: now,
        updatedAt: now,
      });

      const meetingId = (result as { insertId: number }).insertId;
      return { meetingId };
    }),

  // 8. Update Meeting
  updateMeeting: enterpriseProcedure
    .input(z.object({
      meetingId: z.number().int().positive(),
      stage: z.enum(["target", "contacted", "first_meeting", "follow_up", "diligence", "ic_review", "soft_circle", "committed", "declined", "deferred"]).optional(),
      interestLevel: z.enum(["strong", "moderate", "low", "none", "unknown"]).optional(),
      actualQuestionsJson: z.string().optional(),
      actualObjectionsJson: z.string().optional(),
      evidenceRequestedJson: z.string().optional(),
      termsChallengedJson: z.string().optional(),
      nextAction: z.string().optional(),
      followUpDate: z.number().int().positive().optional(),
      softCircleStatus: z.enum(["none", "verbal", "written", "confirmed"]).optional(),
      commitmentStatus: z.enum(["none", "soft", "hard", "closed"]).optional(),
      commitmentAmountM: z.string().optional(),
      notes: z.string().optional(),
      verificationStatus: z.enum(["unverified", "self_reported", "third_party_verified"]).optional(),
      consentStatus: z.enum(["not_obtained", "obtained", "withdrawn"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertMeetingOwnership(db!, input.meetingId, ctx.orgId);

      const { meetingId, ...updates } = input;
      await db!.update(lpTwinActualMeetings).set({
        ...updates,
        updatedByUserId: ctx.user!.id,
        updatedAt: Date.now(),
      }).where(eq(lpTwinActualMeetings.id, meetingId));

      return { success: true };
    }),

  // 9. Get Meeting
  getMeeting: enterpriseProcedure
    .input(z.object({ meetingId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const meeting = await assertMeetingOwnership(db!, input.meetingId, ctx.orgId);
      const responses = await db!.select().from(lpTwinActualResponses).where(
        eq(lpTwinActualResponses.meetingId, input.meetingId)
      );
      return { meeting, responses };
    }),

  // 10. List Meetings
  listMeetings: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive().optional(),
      segmentId: z.string().optional(),
      stage: z.string().optional(),
      includeArchived: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let query = db.select().from(lpTwinActualMeetings).where(eq(lpTwinActualMeetings.orgId, ctx.orgId));
      const meetings = await query.orderBy(desc(lpTwinActualMeetings.meetingDate)).limit(100);

      return {
        meetings: meetings.filter((m) => {
          if (!input.includeArchived && m.archivedAt) return false;
          if (input.fundId && m.fundId !== input.fundId) return false;
          if (input.segmentId && m.segmentId !== input.segmentId) return false;
          if (input.stage && m.stage !== input.stage) return false;
          return true;
        }),
      };
    }),

  // 11. Add Meeting Response
  addMeetingResponse: enterpriseProcedure
    .input(z.object({
      meetingId: z.number().int().positive(),
      responseType: z.enum(["question", "objection", "evidence_request", "term_challenge", "positive_signal"]),
      content: z.string().min(1),
      category: z.string().optional(),
      severity: z.enum(["critical", "high", "moderate", "low", "unknown"]).optional(),
      gpResponse: z.string().optional(),
      outcome: z.enum(["resolved", "partially_resolved", "unresolved", "deferred", "unknown"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertMeetingOwnership(db!, input.meetingId, ctx.orgId);

      const [result] = await db!.insert(lpTwinActualResponses).values({
        orgId: ctx.orgId,
        meetingId: input.meetingId,
        responseType: input.responseType,
        content: input.content,
        category: input.category ?? null,
        severity: input.severity ?? "unknown",
        gpResponse: input.gpResponse ?? null,
        outcome: input.outcome ?? "unknown",
        createdAt: Date.now(),
      });

      return { responseId: (result as { insertId: number }).insertId };
    }),

  // 12. Delete Meeting
  deleteMeeting: enterpriseProcedure
    .input(z.object({ meetingId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertMeetingOwnership(db!, input.meetingId, ctx.orgId);
      await db!.update(lpTwinActualMeetings).set({ archivedAt: Date.now() }).where(eq(lpTwinActualMeetings.id, input.meetingId));
      return { success: true };
    }),

  // 13. Compare With Simulation
  compareWithSimulation: enterpriseProcedure
    .input(z.object({
      meetingId: z.number().int().positive(),
      sessionId: z.number().int().positive().optional(),
      scenarioId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const meeting = await assertMeetingOwnership(db!, input.meetingId, ctx.orgId);

      // Load actual responses
      const responses = await db!.select().from(lpTwinActualResponses).where(
        eq(lpTwinActualResponses.meetingId, input.meetingId)
      );

      // Load synthetic predictions from session if available
      let syntheticObjections: string[] = [];
      let syntheticQuestions: string[] = [];
      if (input.sessionId && db) {
        const [segResult] = await db.select().from(lpTwinSegmentResults).where(
          and(
            eq(lpTwinSegmentResults.sessionId, input.sessionId),
            eq(lpTwinSegmentResults.segmentId, meeting.segmentId)
          )
        ).limit(1);
        if (segResult?.objectionsJson) {
          const objections = JSON.parse(segResult.objectionsJson) as Array<{ category: string; statement: string }>;
          syntheticObjections = objections.map((o) => o.category);
        }
      }

      // Compute agreement labels
      const actualObjections = responses.filter((r) => r.responseType === "objection").map((r) => r.category ?? r.content);
      const actualQuestions = responses.filter((r) => r.responseType === "question").map((r) => r.content);
      const actualEvidence = responses.filter((r) => r.responseType === "evidence_request").map((r) => r.content);

      function computeAgreementLabel(predicted: string[], actual: string[]): "agreement" | "partial_agreement" | "disagreement" | "insufficient_evidence" {
        if (predicted.length === 0 || actual.length === 0) return "insufficient_evidence";
        const overlap = predicted.filter((p) => actual.some((a) => a.toLowerCase().includes(p.toLowerCase()))).length;
        const ratio = overlap / Math.max(predicted.length, actual.length);
        if (ratio >= 0.6) return "agreement";
        if (ratio >= 0.3) return "partial_agreement";
        return "disagreement";
      }

      const objectionsAgreement = computeAgreementLabel(syntheticObjections, actualObjections);
      const questionsAgreement = computeAgreementLabel(syntheticQuestions, actualQuestions);

      // Progression agreement
      const progressionAgreement: "agreement" | "partial_agreement" | "disagreement" | "insufficient_evidence" =
        meeting.stage === "diligence" || meeting.stage === "soft_circle" || meeting.stage === "committed"
          ? "agreement"
          : meeting.stage === "declined" ? "disagreement"
          : "insufficient_evidence";

      const comparisonData = {
        actualObjections,
        actualQuestions,
        actualEvidence,
        syntheticObjections,
        syntheticQuestions,
        meetingStage: meeting.stage,
        interestLevel: meeting.interestLevel,
      };

      const now = Date.now();
      const [result] = await db!.insert(lpTwinValidationComparisons).values({
        orgId: ctx.orgId,
        meetingId: input.meetingId,
        sessionId: input.sessionId ?? null,
        scenarioId: input.scenarioId ?? null,
        segmentId: meeting.segmentId,
        fundId: meeting.fundId,
        fundVersion: meeting.fundVersion,
        engineVersion: meeting.engineVersion,
        registryVersion: meeting.registryVersion,
        objectionsAgreementLabel: objectionsAgreement,
        questionsAgreementLabel: questionsAgreement,
        evidenceAgreementLabel: "insufficient_evidence",
        progressionAgreementLabel: progressionAgreement,
        fitAgreementLabel: "insufficient_evidence",
        comparisonDataJson: JSON.stringify(comparisonData),
        summaryNarrative: `Comparison generated on ${new Date(now).toISOString()}. Agreement labels are preliminary and based on text matching. Not labelled as accuracy until validation methodology is established.`,
        createdAt: now,
        updatedAt: now,
      });

      const comparisonId = (result as { insertId: number }).insertId;
      return {
        comparisonId,
        objectionsAgreement,
        questionsAgreement,
        progressionAgreement,
        comparisonData,
        disclaimer: "COMPARISON NOTE — Agreement labels (Agreement / Partial Agreement / Disagreement / Insufficient Evidence) are preliminary text-matching comparisons. They are not labelled as accuracy metrics until a formal validation methodology is established.",
      };
    }),

  // 14. Get Validation Comparison
  getValidationComparison: enterpriseProcedure
    .input(z.object({ comparisonId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [comparison] = await db.select().from(lpTwinValidationComparisons).where(
        and(eq(lpTwinValidationComparisons.id, input.comparisonId), eq(lpTwinValidationComparisons.orgId, ctx.orgId))
      ).limit(1);
      if (!comparison) throw new TRPCError({ code: "NOT_FOUND", message: "Comparison not found or access denied" });
      return { comparison };
    }),

  // 15. Create Pipeline Entry
  createPipelineEntry: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      segmentId: z.string().min(1),
      investorLabel: z.string().min(1).max(256),
      geography: z.string().optional(),
      shariaRequirement: z.enum(["required", "preferred", "not_required", "unknown"]).optional(),
      stage: z.enum(["target", "contacted", "first_meeting", "follow_up", "diligence", "ic_review", "soft_circle", "committed", "declined", "deferred"]).optional(),
      fitScore: z.string().optional(),
      nextAction: z.string().optional(),
      nextActionDate: z.number().int().positive().optional(),
      expectedTicketMinM: z.string().optional(),
      expectedTicketMaxM: z.string().optional(),
      probabilityBand: z.enum(["high", "medium", "low", "unknown"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertFundOwnership(db!, input.fundId, ctx.orgId);
      if (!getAgentById(input.segmentId)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown segment: ${input.segmentId}` });
      }

      const now = Date.now();
      const [result] = await db!.insert(lpTwinPipeline).values({
        orgId: ctx.orgId,
        createdByUserId: ctx.user!.id,
        updatedByUserId: ctx.user!.id,
        fundId: input.fundId,
        segmentId: input.segmentId,
        investorLabel: input.investorLabel,
        geography: input.geography ?? null,
        shariaRequirement: input.shariaRequirement ?? "unknown",
        stage: input.stage ?? "target",
        fitScore: input.fitScore ?? null,
        nextAction: input.nextAction ?? null,
        nextActionDate: input.nextActionDate ?? null,
        expectedTicketMinM: input.expectedTicketMinM ?? null,
        expectedTicketMaxM: input.expectedTicketMaxM ?? null,
        probabilityBand: input.probabilityBand ?? "unknown",
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });

      return { entryId: (result as { insertId: number }).insertId };
    }),

  // 16. Update Pipeline Entry
  updatePipelineEntry: enterpriseProcedure
    .input(z.object({
      entryId: z.number().int().positive(),
      stage: z.enum(["target", "contacted", "first_meeting", "follow_up", "diligence", "ic_review", "soft_circle", "committed", "declined", "deferred"]).optional(),
      fitScore: z.string().optional(),
      fitCategory: z.string().optional(),
      readinessLabel: z.enum(["ready", "ready_with_conditions", "not_ready", "unknown"]).optional(),
      lastInteractionAt: z.number().int().positive().optional(),
      nextAction: z.string().optional(),
      nextActionDate: z.number().int().positive().optional(),
      meetingDate: z.number().int().positive().optional(),
      probabilityBand: z.enum(["high", "medium", "low", "unknown"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertPipelineOwnership(db!, input.entryId, ctx.orgId);
      const { entryId, ...updates } = input;
      await db!.update(lpTwinPipeline).set({
        ...updates,
        updatedByUserId: ctx.user!.id,
        updatedAt: Date.now(),
      }).where(eq(lpTwinPipeline.id, entryId));
      return { success: true };
    }),

  // 17. List Pipeline
  listPipeline: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive().optional(),
      stage: z.string().optional(),
      segmentId: z.string().optional(),
      geography: z.string().optional(),
      shariaRequirement: z.string().optional(),
      includeArchived: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const entries = await db.select().from(lpTwinPipeline)
        .where(eq(lpTwinPipeline.orgId, ctx.orgId))
        .orderBy(desc(lpTwinPipeline.updatedAt))
        .limit(200);

      return {
        entries: entries.filter((e) => {
          if (!input.includeArchived && e.archivedAt) return false;
          if (input.fundId && e.fundId !== input.fundId) return false;
          if (input.stage && e.stage !== input.stage) return false;
          if (input.segmentId && e.segmentId !== input.segmentId) return false;
          if (input.geography && e.geography !== input.geography) return false;
          if (input.shariaRequirement && e.shariaRequirement !== input.shariaRequirement) return false;
          return true;
        }),
      };
    }),

  // 18. Delete Pipeline Entry
  deletePipelineEntry: enterpriseProcedure
    .input(z.object({ entryId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      await assertPipelineOwnership(db!, input.entryId, ctx.orgId);
      await db!.update(lpTwinPipeline).set({ archivedAt: Date.now() }).where(eq(lpTwinPipeline.id, input.entryId));
      return { success: true };
    }),

  // 19. Generate Report
  generateReport: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      reportType: z.enum([
        "global_investor_readiness",
        "lp_targeting",
        "fund_objection_map",
        "fund_term_sensitivity",
        "fundraising_sequence",
        "lp_meeting_brief",
        "capital_formation_strategy",
        "scenario_comparison",
        "synthetic_lp_panel",
        "simulation_vs_actual",
      ]),
      sessionId: z.number().int().positive().optional(),
      scenarioId: z.number().int().positive().optional(),
      segmentId: z.string().optional(),
      meetingType: z.string().optional(),
      meetingObjective: z.string().optional(),
      panelSegmentIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const fund = await assertFundOwnership(db!, input.fundId, ctx.orgId);
      const fundProfile = buildFundProfileFromDb(fund);

      let reportData: Record<string, unknown> = {};
      let reportTitle = "";
      let markdownContent = "";

      const DISCLAIMER = "SYNTHETIC SIMULATION — This report is generated from fund profile data and institutional archetype benchmarks. It does not constitute placement advice, regulatory guidance, or a guarantee of investor interest.";

      switch (input.reportType) {
        case "global_investor_readiness": {
          const readiness = computeReadinessScore(fundProfile);
          reportTitle = `Global Investor Readiness Report — ${fund.fundName} v${fund.version}`;
          reportData = { readiness, fundName: fund.fundName, fundVersion: fund.version };
          markdownContent = generateReadinessMarkdown(readiness, fund.fundName, fund.version);
          break;
        }
        case "lp_targeting": {
          const results = LP_AGENT_BANK.map((agent) => {
            const fit = computeAllocatorFit(fundProfile, agent);
            return { segmentId: agent.id, segmentName: agent.name, fitScore: fit.overallFitScore, fitCategory: fit.fitCategory, principalFitReasons: fit.principalFitReasons.slice(0, 2) };
          }).sort((a, b) => b.fitScore - a.fitScore);
          reportTitle = `LP Targeting Report — ${fund.fundName} v${fund.version}`;
          reportData = { results, fundName: fund.fundName };
          markdownContent = generateTargetingMarkdown(results, fund.fundName);
          break;
        }
        case "lp_meeting_brief": {
          if (!input.segmentId) throw new TRPCError({ code: "BAD_REQUEST", message: "segmentId required for meeting brief report" });
          const brief = genMeetingBrief(fundProfile, input.segmentId, (input.meetingType ?? "introductory") as MeetingType, (input.meetingObjective ?? "secure_second_meeting") as MeetingObjective);
          reportTitle = `LP Meeting Brief — ${fund.fundName} × ${brief.segmentName}`;
          reportData = { brief };
          markdownContent = generateMeetingBriefMarkdown(brief);
          break;
        }
        case "synthetic_lp_panel": {
          const segmentIds = input.panelSegmentIds ?? LP_AGENT_BANK.map((a) => a.id);
          const panelResult = runPanel(fundProfile, segmentIds);
          reportTitle = `Synthetic LP Panel Report — ${fund.fundName} v${fund.version}`;
          reportData = { panelResult };
          markdownContent = generatePanelMarkdown(panelResult);
          break;
        }
        case "fund_objection_map": {
          const objectionMap = LP_AGENT_BANK.map((agent) => {
            const objections = generateObjections(fundProfile, agent);
            return { segmentId: agent.id, segmentName: agent.name, objections: objections.slice(0, 5) };
          });
          reportTitle = `Fund Objection Map — ${fund.fundName} v${fund.version}`;
          reportData = { objectionMap };
          markdownContent = generateObjectionMapMarkdown(objectionMap, fund.fundName);
          break;
        }
        default: {
          reportTitle = `${input.reportType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — ${fund.fundName} v${fund.version}`;
          reportData = { fundName: fund.fundName, fundVersion: fund.version, reportType: input.reportType, note: "Full report generation for this type is available in the next release." };
          markdownContent = `# ${reportTitle}\n\n${DISCLAIMER}\n\nFull report generation for this type is available in the next release.`;
        }
      }

      const now = Date.now();
      const [result] = await db!.insert(lpTwinReports).values({
        orgId: ctx.orgId,
        generatedByUserId: ctx.user!.id,
        fundId: input.fundId,
        fundVersion: fund.version,
        sessionId: input.sessionId ?? null,
        scenarioId: input.scenarioId ?? null,
        reportType: input.reportType,
        reportTitle,
        engineVersion: FIT_ENGINE_VERSION,
        registryVersion: LP_AGENT_BANK_VERSION,
        objectionEngineVersion: OBJECTION_ENGINE_VERSION,
        evidenceStatus: fund.evidenceStatus ?? "unknown",
        assumptionsJson: JSON.stringify({ disclaimer: DISCLAIMER }),
        reportDataJson: JSON.stringify(reportData),
        markdownContent,
        generatedAt: now,
        createdAt: now,
      });

      // Export audit record omitted (lpTwinExports requires a session ID)

      const reportId = (result as { insertId: number }).insertId;
      return { reportId, reportTitle, markdownContent, reportData };
    }),

  // 20. Get Report
  getReport: enterpriseProcedure
    .input(z.object({ reportId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [report] = await db.select().from(lpTwinReports).where(
        and(eq(lpTwinReports.id, input.reportId), eq(lpTwinReports.orgId, ctx.orgId))
      ).limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found or access denied" });
      return { report };
    }),

  // 21. List Reports
  listReports: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive().optional(),
      reportType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const reports = await db.select({
        id: lpTwinReports.id,
        reportType: lpTwinReports.reportType,
        reportTitle: lpTwinReports.reportTitle,
        fundId: lpTwinReports.fundId,
        fundVersion: lpTwinReports.fundVersion,
        engineVersion: lpTwinReports.engineVersion,
        registryVersion: lpTwinReports.registryVersion,
        evidenceStatus: lpTwinReports.evidenceStatus,
        generatedAt: lpTwinReports.generatedAt,
      }).from(lpTwinReports)
        .where(eq(lpTwinReports.orgId, ctx.orgId))
        .orderBy(desc(lpTwinReports.generatedAt))
        .limit(100);

      return {
        reports: reports.filter((r) => {
          if (input.fundId && r.fundId !== input.fundId) return false;
          if (input.reportType && r.reportType !== input.reportType) return false;
          return true;
        }),
      };
    }),
});

// ── Markdown Generators ───────────────────────────────────────────────────────

function generateReadinessMarkdown(readiness: ReturnType<typeof computeReadinessScore>, fundName: string, fundVersion: number): string {
  const lines: string[] = [
    `# Global Investor Readiness Report`,
    `**Fund:** ${fundName} v${fundVersion}`,
    `**Engine Version:** ${READINESS_ENGINE_VERSION}`,
    `**Generated:** ${new Date().toISOString()}`,
    ``,
    `## Overall Readiness`,
    `**Score:** ${readiness.overallScore}/100 — **${readiness.readinessLabel}**`,
    ``,
    `## Top Blockers`,
    ...readiness.topBlockers.map((b) => `- ${b}`),
    ``,
    `## Highest-Impact Corrections`,
    ...readiness.highestImpactCorrections.map((c) => `- ${c}`),
    ``,
    `## Accessible LP Segments`,
    ...readiness.accessibleSegments.map((s) => `- ${s}`),
    ``,
    `## Blocked LP Segments`,
    ...readiness.blockedSegments.map((s) => `- ${s}`),
    ``,
    `## Dimension Scores`,
    `| Dimension | Score | Label | Weight |`,
    `|---|---|---|---|`,
    ...readiness.dimensions.map((d) => `| ${d.label} | ${d.score}/100 | ${d.label_score} | ${(d.weight * 100).toFixed(0)}% |`),
    ``,
    `---`,
    `*${readiness.disclaimer}*`,
  ];
  return lines.join("\n");
}

function generateTargetingMarkdown(results: Array<{ segmentName: string; fitScore: number; fitCategory: string; principalFitReasons: string[] }>, fundName: string): string {
  const lines: string[] = [
    `# LP Targeting Report — ${fundName}`,
    ``,
    `| Segment | Fit Score | Category | Key Reasons |`,
    `|---|---|---|---|`,
    ...results.map((r) => `| ${r.segmentName} | ${r.fitScore}/100 | ${r.fitCategory} | ${r.principalFitReasons.join("; ")} |`),
    ``,
    `---`,
    `*SYNTHETIC SIMULATION — Fit scores are evidence-based synthetic simulations.*`,
  ];
  return lines.join("\n");
}

function generateMeetingBriefMarkdown(brief: ReturnType<typeof genMeetingBrief>): string {
  const lines: string[] = [
    `# LP Meeting Brief`,
    `**Fund:** ${brief.fundName} v${brief.fundVersion}`,
    `**Segment:** ${brief.segmentName}`,
    `**Meeting Type:** ${brief.meetingType.replace(/_/g, " ")}`,
    `**Objective:** ${brief.objectiveStatement}`,
    ``,
    `## Investor Archetype`,
    `- **Type:** ${brief.investorArchetype.allocatorType}`,
    `- **Mandate:** ${brief.investorArchetype.typicalMandate}`,
    `- **Ticket Size:** ${brief.investorArchetype.ticketSizeRange}`,
    `- **Decision Process:** ${brief.investorArchetype.decisionProcess}`,
    `- **Diligence Cycle:** ${brief.investorArchetype.typicalDiligenceCycle}`,
    ``,
    `## Fund Fit`,
    `**Overall Score:** ${brief.fundFit.overallScore}/100 — ${brief.fundFit.fitCategory}`,
    ``,
    `### Strongest Dimensions`,
    ...brief.fundFit.strongestDimensions.map((d) => `- **${d.dimension}** (${d.score}/100): ${d.reasoning}`),
    ``,
    `### Weakest Dimensions`,
    ...brief.fundFit.weakestDimensions.map((d) => `- **${d.dimension}** (${d.score}/100): ${d.reasoning}`),
    ``,
    `## Likely Questions`,
    ...brief.likelyQuestions.slice(0, 8).map((q) => `- [${q.priority.toUpperCase()}] **${q.question}**`),
    ``,
    `## Likely Objections`,
    ...brief.likelyObjections.slice(0, 5).map((o) => `- [${o.severity.toUpperCase()}] **${o.category}:** ${o.statement}`),
    ``,
    `## Recommended Positioning`,
    `### Emphasize`,
    ...brief.positioning.emphasize.map((e) => `- ${e}`),
    `### Do Not Overstate`,
    ...brief.positioning.doNotOverstate.map((e) => `- ${e}`),
    ``,
    `## Suggested Next Action`,
    brief.suggestedNextAction,
    ``,
    `---`,
    `*${brief.disclaimer}*`,
  ];
  return lines.join("\n");
}

function generatePanelMarkdown(panel: ReturnType<typeof runPanel>): string {
  const lines: string[] = [
    `# Synthetic LP Panel Report — ${panel.fundName} v${panel.fundVersion}`,
    ``,
    `## Panel Summary`,
    `- Would Continue: ${panel.summary.wouldContinueCount}`,
    `- Requires More Evidence: ${panel.summary.requiresEvidenceCount}`,
    `- Requires Term Changes: ${panel.summary.requiresTermChangesCount}`,
    `- Would Decline: ${panel.summary.wouldDeclineCount}`,
    ``,
    `**Recommendation:** ${panel.summary.fundraisingRecommendation}`,
    ``,
    `## Agent Results`,
    ...panel.agentResults.map((r) => `### ${r.segmentName}\n- **Decision:** ${r.decision}\n- **Fit Score:** ${r.fitScore}/100 (${r.fitCategory})\n- **Top Objections:** ${r.topObjections.map((o) => o.category).join(", ")}`),
    ``,
    `---`,
    `*${panel.disclaimer}*`,
  ];
  return lines.join("\n");
}

function generateObjectionMapMarkdown(objectionMap: Array<{ segmentName: string; objections: Array<{ category: string; statement: string; severity: string }> }>, fundName: string): string {
  const lines: string[] = [
    `# Fund Objection Map — ${fundName}`,
    ``,
    ...objectionMap.map((seg) => [
      `## ${seg.segmentName}`,
      ...seg.objections.map((o) => `- [${o.severity.toUpperCase()}] **${o.category}:** ${o.statement}`),
    ].join("\n")),
    ``,
    `---`,
    `*SYNTHETIC SIMULATION — Objections are generated from institutional archetype data.*`,
  ];
  return lines.join("\n");
}
