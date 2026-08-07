/**
 * CapTwin LP Twin — Validation Router (WP7)
 *
 * All procedures use enterpriseProcedure which:
 *   1. Requires authentication
 *   2. Resolves orgId from the authenticated user's enterprise membership
 *   3. Injects ctx.orgId — server-resolved, never client-supplied
 *
 * IMPORTANT: No calibration candidate may alter production behavior automatically.
 * All calibration changes require explicit human approval.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { enterpriseProcedure } from "../_core/orgMiddleware";
import { getDb } from "../db";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import {
  lpTwinValidationParticipants,
  lpTwinValidationScenarios,
  lpTwinHumanResponses,
  lpTwinSyntheticSnapshots,
  lpTwinCalibrationCandidates,
  type InsertLpTwinValidationParticipant,
  type InsertLpTwinValidationScenario,
  type InsertLpTwinHumanResponse,
  type InsertLpTwinSyntheticSnapshot,
  type InsertLpTwinCalibrationCandidate,
} from "../../drizzle/schema";
import {
  compareResponses,
  aggregateBySegment,
  computeValidationQualityScore,
  STANDARD_VALIDATION_SCENARIOS,
  VALIDATION_ENGINE_VERSION,
  VALIDATION_ENGINE_REGISTRY_VERSION,
  VALIDATION_THRESHOLDS,
  type ValidationQualityInput,
} from "../../shared/captwin";
import {
  LP_AGENT_BANK,
  LP_AGENT_BANK_VERSION,
  getAgentById,
} from "../../shared/captwin";
import {
  computeAllocatorFit,
  buildFundProfileFromDb,
  FIT_ENGINE_VERSION,
} from "../../shared/captwin";
import {
  generateObjections,
  LP_OBJECTION_RULES_VERSION,
} from "../../shared/captwin";
import { lpTwinFunds } from "../../drizzle/schema";

// ── Input schemas ─────────────────────────────────────────────────────────────

const CreateParticipantInput = z.object({
  participantType: z.enum([
    "institutional_allocator", "family_office_professional", "placement_agent",
    "fund_manager", "investment_consultant", "capital_formation_executive",
    "sharia_adviser", "other",
  ]),
  allocatorSegment: z.string().max(64).optional(),
  organizationName: z.string().max(256).optional(),
  roleTitle: z.string().max(128).optional(),
  geography: z.string().max(128).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  consentStatus: z.enum(["pending", "granted", "revoked", "expired"]).default("pending"),
  recordingConsent: z.boolean().default(false),
  anonymizationPreference: z.enum(["full_anonymous", "role_only", "org_and_role", "identified"]).default("full_anonymous"),
  permittedUse: z.array(z.enum([
    "research_only", "product_validation", "internal_calibration",
    "anonymous_aggregate", "customer_specific", "no_model_improvement",
  ])),
  calibrationEligibility: z.boolean().default(false),
  verificationStatus: z.enum(["unverified", "self_declared", "verified", "rejected"]).default("unverified"),
  source: z.enum(["direct_outreach", "referral", "placement_agent", "conference", "other"]).default("direct_outreach"),
  notes: z.string().optional(),
});

const CreateScenarioInput = z.object({
  scenarioName: z.string().max(256),
  scenarioCode: z.string().max(64),
  fundProfileJson: z.string(),
  strategy: z.string().max(128),
  geography: z.string().max(256).optional(),
  targetSizeM: z.number().positive(),
  managementFeePct: z.number().min(0).max(10),
  carryPct: z.number().min(0).max(50),
  trackRecordYrs: z.number().int().min(0).max(50),
  priorFundIRR: z.number().optional(),
  shariaCompliant: z.boolean().default(false),
  esgPolicy: z.string().max(64).optional(),
  evidencePackageJson: z.string().optional(),
  expectedQuestionsJson: z.string().optional(),
});

const SubmitHumanResponseInput = z.object({
  participantId: z.number().int().positive(),
  scenarioId: z.number().int().positive(),
  allocatorSegment: z.string().max(64),
  initialAttractiveness: z.number().int().min(1).max(10).optional(),
  verdict: z.enum(["pass", "conditional", "reject"]),
  topObjections: z.array(z.string()).default([]),
  rejectionTriggers: z.array(z.string()).default([]),
  requiredEvidence: z.array(z.string()).default([]),
  termsToChange: z.array(z.string()).default([]),
  expectedDiligenceMonths: z.number().int().min(0).max(36).optional(),
  likelyNextStep: z.enum(["reject", "more_information", "meeting", "diligence", "ic_progression"]).optional(),
  ticketSizeMinM: z.number().positive().optional(),
  ticketSizeMaxM: z.number().positive().optional(),
  confidence: z.number().int().min(1).max(10).optional(),
  rationale: z.string().optional(),
  followUpQuestions: z.array(z.string()).default([]),
  sourceType: z.enum([
    "structured_validation_interview", "historical_fundraise",
    "live_fundraising_outcome", "placement_agent_expert_review", "other_verified_source",
  ]),
});

const CreateCalibrationCandidateInput = z.object({
  segmentId: z.string().max(64),
  ruleOrAttribute: z.string().max(256),
  currentValue: z.string(),
  proposedValue: z.string(),
  evidenceCount: z.number().int().min(1),
  supportingComparisonIds: z.array(z.number().int()).optional(),
  confidence: z.enum(["high", "medium", "low"]).default("low"),
  impactEstimate: z.string().optional(),
});

const ImportResponsesInput = z.object({
  responses: z.array(z.object({
    participantId: z.number().int().positive(),
    scenarioId: z.number().int().positive(),
    allocatorSegment: z.string().max(64),
    verdict: z.enum(["pass", "conditional", "reject"]),
    topObjections: z.array(z.string()).default([]),
    requiredEvidence: z.array(z.string()).default([]),
    sourceType: z.enum([
      "structured_validation_interview", "historical_fundraise",
      "live_fundraising_outcome", "placement_agent_expert_review", "other_verified_source",
    ]),
    consentVerified: z.boolean(),
    calibrationEligible: z.boolean(),
  })),
  dryRun: z.boolean().default(true),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const lpTwinValidationRouter = router({

  // 1. createParticipant — WP7A
  createParticipant: enterpriseProcedure
    .input(CreateParticipantInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = Date.now();
      const payload: InsertLpTwinValidationParticipant = {
        orgId: ctx.orgId,
        participantType: input.participantType,
        allocatorSegment: input.allocatorSegment,
        organizationName: input.organizationName,
        roleTitle: input.roleTitle,
        geography: input.geography,
        yearsExperience: input.yearsExperience,
        consentStatus: input.consentStatus,
        recordingConsent: input.recordingConsent,
        anonymizationPreference: input.anonymizationPreference,
        permittedUse: JSON.stringify(input.permittedUse),
        calibrationEligibility: input.calibrationEligibility,
        verificationStatus: input.verificationStatus,
        source: input.source,
        notes: input.notes,
        createdByUserId: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(lpTwinValidationParticipants).values(payload);
      return { participantId: (result as { insertId: number }).insertId };
    }),

  // 2. listParticipants — WP7A
  listParticipants: enterpriseProcedure
    .input(z.object({
      includeArchived: z.boolean().default(false),
      participantType: z.string().optional(),
      verificationStatus: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(lpTwinValidationParticipants)
        .where(
          and(
            eq(lpTwinValidationParticipants.orgId, ctx.orgId),
            input.includeArchived ? undefined : isNull(lpTwinValidationParticipants.archivedAt)
          )
        )
        .orderBy(desc(lpTwinValidationParticipants.createdAt))
        .limit(200);
      return { participants: rows };
    }),

  // 3. createValidationScenario — WP7B
  createValidationScenario: enterpriseProcedure
    .input(CreateScenarioInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const now = Date.now();
      const payload: InsertLpTwinValidationScenario = {
        orgId: ctx.orgId,
        scenarioName: input.scenarioName,
        scenarioCode: input.scenarioCode,
        version: 1,
        fundProfileJson: input.fundProfileJson,
        strategy: input.strategy,
        geography: input.geography,
        targetSizeM: String(input.targetSizeM),
        managementFeePct: String(input.managementFeePct),
        carryPct: String(input.carryPct),
        trackRecordYrs: input.trackRecordYrs,
        priorFundIRR: input.priorFundIRR ? String(input.priorFundIRR) : null,
        shariaCompliant: input.shariaCompliant,
        esgPolicy: input.esgPolicy,
        evidencePackageJson: input.evidencePackageJson,
        expectedQuestionsJson: input.expectedQuestionsJson,
        isActive: true,
        createdByUserId: ctx.user.id,
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(lpTwinValidationScenarios).values(payload);
      return { scenarioId: (result as { insertId: number }).insertId };
    }),

  // 4. listValidationScenarios — WP7B
  listValidationScenarios: enterpriseProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(lpTwinValidationScenarios)
        .where(and(
          eq(lpTwinValidationScenarios.orgId, ctx.orgId),
          eq(lpTwinValidationScenarios.isActive, true)
        ))
        .orderBy(desc(lpTwinValidationScenarios.createdAt))
        .limit(100);
      return {
        scenarios: rows,
        standardScenarios: STANDARD_VALIDATION_SCENARIOS,
      };
    }),

  // 5. createSyntheticSnapshot — WP7D (must run BEFORE human response is revealed)
  createSyntheticSnapshot: enterpriseProcedure
    .input(z.object({
      scenarioId: z.number().int().positive(),
      agentId: z.string(),
      fundId: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify scenario belongs to org
      const [scenario] = await db
        .select()
        .from(lpTwinValidationScenarios)
        .where(and(
          eq(lpTwinValidationScenarios.id, input.scenarioId),
          eq(lpTwinValidationScenarios.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });

      const agent = getAgentById(input.agentId);
      if (!agent) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown agent: ${input.agentId}` });

      // Verify fund belongs to org
      const [fund] = await db
        .select()
        .from(lpTwinFunds)
        .where(and(eq(lpTwinFunds.id, input.fundId), eq(lpTwinFunds.orgId, ctx.orgId)))
        .limit(1);
      if (!fund) throw new TRPCError({ code: "NOT_FOUND", message: "Fund not found" });

      const fundProfile = buildFundProfileFromDb(fund);
      const fitResult = computeAllocatorFit(fundProfile, agent);
      const objections = generateObjections(fundProfile, agent);

      // Determine synthetic verdict from fit score
      let syntheticVerdict: "pass" | "conditional" | "reject";
      if (fitResult.overallFitScore >= 70) syntheticVerdict = "pass";
      else if (fitResult.overallFitScore >= 45) syntheticVerdict = "conditional";
      else syntheticVerdict = "reject";

      const now = Date.now();
      const payload: InsertLpTwinSyntheticSnapshot = {
        orgId: ctx.orgId,
        scenarioId: input.scenarioId,
        scenarioVersion: scenario.version,
        agentId: input.agentId,
        agentBankVersion: LP_AGENT_BANK_VERSION,
        fitEngineVersion: FIT_ENGINE_VERSION,
        objectionEngineVersion: LP_OBJECTION_RULES_VERSION,
        syntheticVerdict,
        fitScore: String(fitResult.overallFitScore),
        fitCategory: fitResult.fitCategory,
        objectionsJson: JSON.stringify(objections.map((o) => o.statement)),
        evidenceRequestedJson: JSON.stringify(fitResult.evidenceGaps.map((g) => g.field)),
        termsChallengedJson: JSON.stringify(
          objections.filter((o) => o.category === "fees-too-high" || o.category === "carry-too-high" || o.category === "gp-commitment-too-low").map((o) => o.statement)
        ),
        isFrozen: true,
        frozenAt: now,
        createdByUserId: ctx.user.id,
        createdAt: now,
      };
      const [result] = await db.insert(lpTwinSyntheticSnapshots).values(payload);
      return {
        snapshotId: (result as { insertId: number }).insertId,
        syntheticVerdict,
        fitScore: fitResult.overallFitScore,
        fitCategory: fitResult.fitCategory,
        disclaimer: "SYNTHETIC SIMULATION — This snapshot is frozen and must not be modified after human responses are collected.",
      };
    }),

  // 6. submitHumanResponse — WP7C
  submitHumanResponse: enterpriseProcedure
    .input(SubmitHumanResponseInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify participant belongs to org
      const [participant] = await db
        .select()
        .from(lpTwinValidationParticipants)
        .where(and(
          eq(lpTwinValidationParticipants.id, input.participantId),
          eq(lpTwinValidationParticipants.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!participant) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });

      // Enforce consent check
      if (participant.consentStatus !== "granted") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Participant has not granted consent. Cannot record response.",
        });
      }

      // Verify scenario belongs to org
      const [scenario] = await db
        .select()
        .from(lpTwinValidationScenarios)
        .where(and(
          eq(lpTwinValidationScenarios.id, input.scenarioId),
          eq(lpTwinValidationScenarios.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });

      // Determine calibration eligibility
      const permittedUse = JSON.parse(participant.permittedUse) as string[];
      const calibrationEligible =
        participant.calibrationEligibility &&
        !permittedUse.includes("no_model_improvement") &&
        participant.consentStatus === "granted";

      const now = Date.now();
      const payload: InsertLpTwinHumanResponse = {
        orgId: ctx.orgId,
        participantId: input.participantId,
        scenarioId: input.scenarioId,
        scenarioVersion: scenario.version,
        allocatorSegment: input.allocatorSegment,
        initialAttractiveness: input.initialAttractiveness,
        verdict: input.verdict,
        topObjectionsJson: JSON.stringify(input.topObjections),
        rejectionTriggersJson: JSON.stringify(input.rejectionTriggers),
        requiredEvidenceJson: JSON.stringify(input.requiredEvidence),
        termsToChangeJson: JSON.stringify(input.termsToChange),
        expectedDiligenceMonths: input.expectedDiligenceMonths,
        likelyNextStep: input.likelyNextStep,
        ticketSizeMinM: input.ticketSizeMinM ? String(input.ticketSizeMinM) : null,
        ticketSizeMaxM: input.ticketSizeMaxM ? String(input.ticketSizeMaxM) : null,
        confidence: input.confidence,
        rationale: input.rationale,
        followUpQuestionsJson: JSON.stringify(input.followUpQuestions),
        sourceType: input.sourceType,
        consentVerified: participant.consentStatus === "granted",
        calibrationEligible,
        verificationStatus: "unverified",
        anonymized: participant.anonymizationPreference === "full_anonymous",
        dataQualityRating: "unrated",
        submittedAt: now,
        createdByUserId: ctx.user.id,
        createdAt: now,
      };
      const [result] = await db.insert(lpTwinHumanResponses).values(payload);
      return { responseId: (result as { insertId: number }).insertId, calibrationEligible };
    }),

  // 7. compareWithSnapshot — WP7E
  compareWithSnapshot: enterpriseProcedure
    .input(z.object({
      snapshotId: z.number().int().positive(),
      humanResponseId: z.number().int().positive(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [snapshot] = await db
        .select()
        .from(lpTwinSyntheticSnapshots)
        .where(and(
          eq(lpTwinSyntheticSnapshots.id, input.snapshotId),
          eq(lpTwinSyntheticSnapshots.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });

      const [human] = await db
        .select()
        .from(lpTwinHumanResponses)
        .where(and(
          eq(lpTwinHumanResponses.id, input.humanResponseId),
          eq(lpTwinHumanResponses.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!human) throw new TRPCError({ code: "NOT_FOUND", message: "Human response not found" });

      const result = compareResponses(
        {
          syntheticVerdict: snapshot.syntheticVerdict,
          objectionsJson: snapshot.objectionsJson,
          evidenceRequestedJson: snapshot.evidenceRequestedJson,
          termsChallengedJson: snapshot.termsChallengedJson,
          expectedNextStep: snapshot.expectedNextStep,
        },
        {
          verdict: human.verdict,
          topObjectionsJson: human.topObjectionsJson,
          requiredEvidenceJson: human.requiredEvidenceJson,
          termsToChangeJson: human.termsToChangeJson,
          likelyNextStep: human.likelyNextStep,
          calibrationEligible: human.calibrationEligible,
          consentVerified: human.consentVerified,
        }
      );
      return { comparison: result };
    }),

  // 8. getValidationDashboard — WP7F
  getValidationDashboard: enterpriseProcedure
    .input(z.object({
      segmentId: z.string().optional(),
      scenarioId: z.number().int().optional(),
      verificationStatus: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [participants, scenarios, humanResponses, snapshots] = await Promise.all([
        db.select().from(lpTwinValidationParticipants)
          .where(and(eq(lpTwinValidationParticipants.orgId, ctx.orgId), isNull(lpTwinValidationParticipants.archivedAt)))
          .limit(500),
        db.select().from(lpTwinValidationScenarios)
          .where(and(eq(lpTwinValidationScenarios.orgId, ctx.orgId), eq(lpTwinValidationScenarios.isActive, true)))
          .limit(100),
        db.select().from(lpTwinHumanResponses)
          .where(eq(lpTwinHumanResponses.orgId, ctx.orgId))
          .limit(1000),
        db.select().from(lpTwinSyntheticSnapshots)
          .where(eq(lpTwinSyntheticSnapshots.orgId, ctx.orgId))
          .limit(1000),
      ]);

      const verifiedResponses = humanResponses.filter((r) => r.verificationStatus === "verified");
      const calibrationEligible = humanResponses.filter((r) => r.calibrationEligible);
      const segmentCoverage = Array.from(new Set(humanResponses.map((r) => r.allocatorSegment)));
      const scenarioCoverage = Array.from(new Set(humanResponses.map((r) => r.scenarioId)));

      // Compute comparisons for all matching snapshot/response pairs
      const comparisons: Array<{ segmentId: string; result: ReturnType<typeof compareResponses> }> = [];
      for (const human of humanResponses) {
        const matchingSnapshot = snapshots.find(
          (s) => s.scenarioId === human.scenarioId && s.scenarioVersion === human.scenarioVersion
        );
        if (matchingSnapshot) {
          comparisons.push({
            segmentId: human.allocatorSegment,
            result: compareResponses(
              {
                syntheticVerdict: matchingSnapshot.syntheticVerdict,
                objectionsJson: matchingSnapshot.objectionsJson,
                evidenceRequestedJson: matchingSnapshot.evidenceRequestedJson,
                termsChallengedJson: matchingSnapshot.termsChallengedJson,
                expectedNextStep: matchingSnapshot.expectedNextStep,
              },
              {
                verdict: human.verdict,
                topObjectionsJson: human.topObjectionsJson,
                requiredEvidenceJson: human.requiredEvidenceJson,
                termsToChangeJson: human.termsToChangeJson,
                likelyNextStep: human.likelyNextStep,
                calibrationEligible: human.calibrationEligible,
                consentVerified: human.consentVerified,
              }
            ),
          });
        }
      }

      const segmentAggregations = aggregateBySegment(comparisons);

      // Compute quality scores per segment
      const qualityScores = segmentAggregations.map((agg) => {
        const segResponses = humanResponses.filter((r) => r.allocatorSegment === agg.segmentId);
        const uniqueParticipants = new Set(segResponses.map((r) => r.participantId)).size;
        const uniqueScenarios = new Set(segResponses.map((r) => r.scenarioId)).size;
        const uniqueGeos = new Set(
          segResponses.map((r) => {
            const p = participants.find((p) => p.id === r.participantId);
            return p?.geography ?? "unknown";
          })
        ).size;
        const newestResponse = segResponses.reduce((max, r) => Math.max(max, r.createdAt), 0);
        const ratings = segResponses.map((r) => r.dataQualityRating);

        const qualityInput: ValidationQualityInput = {
          segmentId: agg.segmentId,
          verifiedResponseCount: segResponses.filter((r) => r.verificationStatus === "verified").length,
          independentParticipantCount: uniqueParticipants,
          scenarioDiversity: uniqueScenarios,
          geographicDiversity: uniqueGeos,
          avgVerdictAgreement: agg.verdictExactAgreement / Math.max(agg.totalComparisons, 1),
          avgObjRecall: agg.avgObjRecall,
          avgObjPrecision: agg.avgObjPrecision,
          avgEvidenceAgreement: agg.avgEvidenceAgreement,
          newestResponseAgeMs: newestResponse > 0 ? Date.now() - newestResponse : Infinity,
          dataQualityRatings: ratings,
        };
        return computeValidationQualityScore(qualityInput);
      });

      return {
        summary: {
          totalParticipants: participants.length,
          segmentCoverage: segmentCoverage.length,
          scenarioCoverage: scenarioCoverage.length,
          verifiedResponses: verifiedResponses.length,
          calibrationEligibleResponses: calibrationEligible.length,
          totalComparisons: comparisons.length,
        },
        segmentAggregations,
        qualityScores,
        validationEngineVersion: VALIDATION_ENGINE_VERSION,
        disclaimer: "AGREEMENT METRICS — Not validated predictive accuracy.",
      };
    }),

  // 9. createCalibrationCandidate — WP7G
  createCalibrationCandidate: enterpriseProcedure
    .input(CreateCalibrationCandidateInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Must have supporting evidence
      if (input.evidenceCount < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Calibration candidate must cite at least one supporting evidence record.",
        });
      }

      const now = Date.now();
      const payload: InsertLpTwinCalibrationCandidate = {
        orgId: ctx.orgId,
        segmentId: input.segmentId,
        ruleOrAttribute: input.ruleOrAttribute,
        currentValue: input.currentValue,
        proposedValue: input.proposedValue,
        evidenceCount: input.evidenceCount,
        supportingComparisonIds: input.supportingComparisonIds
          ? JSON.stringify(input.supportingComparisonIds)
          : null,
        confidence: input.confidence,
        impactEstimate: input.impactEstimate,
        proposedBy: ctx.user.id,
        reviewStatus: "proposed",
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(lpTwinCalibrationCandidates).values(payload);
      return { candidateId: (result as { insertId: number }).insertId };
    }),

  // 10. listCalibrationCandidates — WP7G
  listCalibrationCandidates: enterpriseProcedure
    .input(z.object({
      reviewStatus: z.enum(["proposed", "under_review", "approved", "rejected", "deferred"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(lpTwinCalibrationCandidates)
        .where(eq(lpTwinCalibrationCandidates.orgId, ctx.orgId))
        .orderBy(desc(lpTwinCalibrationCandidates.createdAt))
        .limit(200);
      return { candidates: rows };
    }),

  // 11. reviewCalibrationCandidate — WP7H (human approval gate)
  reviewCalibrationCandidate: enterpriseProcedure
    .input(z.object({
      candidateId: z.number().int().positive(),
      reviewStatus: z.enum(["under_review", "approved", "rejected", "deferred"]),
      newAgentBankVersion: z.string().optional(), // Required when approving
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [candidate] = await db
        .select()
        .from(lpTwinCalibrationCandidates)
        .where(and(
          eq(lpTwinCalibrationCandidates.id, input.candidateId),
          eq(lpTwinCalibrationCandidates.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!candidate) throw new TRPCError({ code: "NOT_FOUND", message: "Candidate not found" });

      // Cannot approve without a new version
      if (input.reviewStatus === "approved" && !input.newAgentBankVersion) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approving a calibration candidate requires specifying a new Agent Bank version.",
        });
      }

      const now = Date.now();
      await db
        .update(lpTwinCalibrationCandidates)
        .set({
          reviewStatus: input.reviewStatus,
          approvedBy: input.reviewStatus === "approved" ? ctx.user.id : undefined,
          approvedAt: input.reviewStatus === "approved" ? now : undefined,
          effectiveAgentBankVersion: input.reviewStatus === "approved" ? input.newAgentBankVersion : undefined,
          updatedAt: now,
        })
        .where(eq(lpTwinCalibrationCandidates.id, input.candidateId));

      return {
        candidateId: input.candidateId,
        reviewStatus: input.reviewStatus,
        note: input.reviewStatus === "approved"
          ? `Approved. New Agent Bank version ${input.newAgentBankVersion} must be deployed separately. Historical sessions remain reproducible.`
          : `Status updated to ${input.reviewStatus}. No production changes made.`,
      };
    }),

  // 12. deleteParticipant — WP7K (consent revocation / deletion)
  deleteParticipant: enterpriseProcedure
    .input(z.object({
      participantId: z.number().int().positive(),
      anonymize: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [participant] = await db
        .select()
        .from(lpTwinValidationParticipants)
        .where(and(
          eq(lpTwinValidationParticipants.id, input.participantId),
          eq(lpTwinValidationParticipants.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!participant) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });

      const now = Date.now();
      if (input.anonymize) {
        // Anonymize: remove PII but keep statistical record
        await db
          .update(lpTwinValidationParticipants)
          .set({
            organizationName: null,
            roleTitle: null,
            notes: null,
            consentStatus: "revoked",
            archivedAt: now,
            updatedAt: now,
          })
          .where(eq(lpTwinValidationParticipants.id, input.participantId));
        // Anonymize linked responses
        await db
          .update(lpTwinHumanResponses)
          .set({ anonymized: true, rationale: null })
          .where(and(
            eq(lpTwinHumanResponses.participantId, input.participantId),
            eq(lpTwinHumanResponses.orgId, ctx.orgId)
          ));
        return { deleted: false, anonymized: true };
      } else {
        // Hard archive
        await db
          .update(lpTwinValidationParticipants)
          .set({ consentStatus: "revoked", archivedAt: now, updatedAt: now })
          .where(eq(lpTwinValidationParticipants.id, input.participantId));
        return { deleted: false, anonymized: false, archived: true };
      }
    }),

  // 13. importResponses — WP7N (validation import with dry-run)
  importResponses: enterpriseProcedure
    .input(ImportResponsesInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const errors: string[] = [];
      const warnings: string[] = [];
      const validRows: typeof input.responses = [];

      for (let i = 0; i < input.responses.length; i++) {
        const row = input.responses[i];

        // Consent validation
        if (!row.consentVerified) {
          errors.push(`Row ${i + 1}: consentVerified must be true. Cannot import without consent.`);
          continue;
        }

        // Verify participant exists and belongs to org
        const [participant] = await db
          .select()
          .from(lpTwinValidationParticipants)
          .where(and(
            eq(lpTwinValidationParticipants.id, row.participantId),
            eq(lpTwinValidationParticipants.orgId, ctx.orgId)
          ))
          .limit(1);
        if (!participant) {
          errors.push(`Row ${i + 1}: Participant ${row.participantId} not found in this org.`);
          continue;
        }

        // Verify scenario exists and belongs to org
        const [scenario] = await db
          .select()
          .from(lpTwinValidationScenarios)
          .where(and(
            eq(lpTwinValidationScenarios.id, row.scenarioId),
            eq(lpTwinValidationScenarios.orgId, ctx.orgId)
          ))
          .limit(1);
        if (!scenario) {
          errors.push(`Row ${i + 1}: Scenario ${row.scenarioId} not found in this org.`);
          continue;
        }

        // Duplicate detection
        const [existing] = await db
          .select()
          .from(lpTwinHumanResponses)
          .where(and(
            eq(lpTwinHumanResponses.participantId, row.participantId),
            eq(lpTwinHumanResponses.scenarioId, row.scenarioId),
            eq(lpTwinHumanResponses.orgId, ctx.orgId)
          ))
          .limit(1);
        if (existing) {
          warnings.push(`Row ${i + 1}: Duplicate — participant ${row.participantId} already has a response for scenario ${row.scenarioId}.`);
          continue;
        }

        validRows.push(row);
      }

      if (input.dryRun) {
        return {
          dryRun: true,
          totalRows: input.responses.length,
          validRows: validRows.length,
          errors,
          warnings,
          preview: validRows.slice(0, 5),
        };
      }

      if (errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Import aborted: ${errors.length} validation error(s). Fix errors and retry.`,
        });
      }

      // Perform import
      const now = Date.now();
      let imported = 0;
      for (const row of validRows) {
        const [scenario] = await db
          .select()
          .from(lpTwinValidationScenarios)
          .where(eq(lpTwinValidationScenarios.id, row.scenarioId))
          .limit(1);
        if (!scenario) continue;

        await db.insert(lpTwinHumanResponses).values({
          orgId: ctx.orgId,
          participantId: row.participantId,
          scenarioId: row.scenarioId,
          scenarioVersion: scenario.version,
          allocatorSegment: row.allocatorSegment,
          verdict: row.verdict,
          topObjectionsJson: JSON.stringify(row.topObjections),
          requiredEvidenceJson: JSON.stringify(row.requiredEvidence),
          sourceType: row.sourceType,
          consentVerified: row.consentVerified,
          calibrationEligible: row.calibrationEligible,
          verificationStatus: "unverified",
          anonymized: false,
          dataQualityRating: "unrated",
          submittedAt: now,
          createdByUserId: ctx.user.id,
          createdAt: now,
        });
        imported++;
      }

      return {
        dryRun: false,
        totalRows: input.responses.length,
        imported,
        errors,
        warnings,
      };
    }),

  // 14. listAgentBankVersions — WP7I
  listAgentBankVersions: enterpriseProcedure
    .query(() => {
      return {
        currentVersion: LP_AGENT_BANK_VERSION,
        agents: LP_AGENT_BANK.map((a) => ({ id: a.id, name: a.name, segmentType: a.segmentType })),
        note: "Historical sessions pin their engine version at creation time and remain reproducible.",
      };
    }),

  // 15. getValidationQualityScore — WP7J
  getValidationQualityScore: enterpriseProcedure
    .input(z.object({ segmentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const responses = await db
        .select()
        .from(lpTwinHumanResponses)
        .where(and(
          eq(lpTwinHumanResponses.orgId, ctx.orgId),
          eq(lpTwinHumanResponses.allocatorSegment, input.segmentId)
        ))
        .limit(500);

      const participants = await db
        .select()
        .from(lpTwinValidationParticipants)
        .where(eq(lpTwinValidationParticipants.orgId, ctx.orgId))
        .limit(500);

      const snapshots = await db
        .select()
        .from(lpTwinSyntheticSnapshots)
        .where(eq(lpTwinSyntheticSnapshots.orgId, ctx.orgId))
        .limit(500);

      const comparisons = responses.map((human) => {
        const snap = snapshots.find(
          (s) => s.scenarioId === human.scenarioId && s.agentId === input.segmentId
        );
        if (!snap) return null;
        return compareResponses(
          { syntheticVerdict: snap.syntheticVerdict, objectionsJson: snap.objectionsJson, evidenceRequestedJson: snap.evidenceRequestedJson, termsChallengedJson: snap.termsChallengedJson, expectedNextStep: snap.expectedNextStep },
          { verdict: human.verdict, topObjectionsJson: human.topObjectionsJson, requiredEvidenceJson: human.requiredEvidenceJson, termsToChangeJson: human.termsToChangeJson, likelyNextStep: human.likelyNextStep, calibrationEligible: human.calibrationEligible, consentVerified: human.consentVerified }
        );
      }).filter(Boolean) as ReturnType<typeof compareResponses>[];

      const verifiedCount = responses.filter((r) => r.verificationStatus === "verified").length;
      const uniqueParticipants = new Set(responses.map((r) => r.participantId)).size;
      const uniqueScenarios = new Set(responses.map((r) => r.scenarioId)).size;
      const uniqueGeos = new Set(responses.map((r) => {
        const p = participants.find((p) => p.id === r.participantId);
        return p?.geography ?? "unknown";
      })).size;
      const newestAge = responses.length > 0
        ? Date.now() - Math.max(...responses.map((r) => r.createdAt))
        : Infinity;

      const qualityInput: ValidationQualityInput = {
        segmentId: input.segmentId,
        verifiedResponseCount: verifiedCount,
        independentParticipantCount: uniqueParticipants,
        scenarioDiversity: uniqueScenarios,
        geographicDiversity: uniqueGeos,
        avgVerdictAgreement: comparisons.length > 0
          ? comparisons.filter((c) => c.verdictAgreement === "exact_agreement").length / comparisons.length
          : 0,
        avgObjRecall: comparisons.length > 0
          ? comparisons.reduce((s, c) => s + c.objectionRecall, 0) / comparisons.length
          : 0,
        avgObjPrecision: comparisons.length > 0
          ? comparisons.reduce((s, c) => s + c.objectionPrecision, 0) / comparisons.length
          : 0,
        avgEvidenceAgreement: comparisons.length > 0
          ? comparisons.reduce((s, c) => s + c.evidenceRequestAgreement, 0) / comparisons.length
          : 0,
        newestResponseAgeMs: newestAge,
        dataQualityRatings: responses.map((r) => r.dataQualityRating),
      };

      return computeValidationQualityScore(qualityInput);
    }),

  // 16. listHumanResponses — WP7C
  listHumanResponses: enterpriseProcedure
    .input(z.object({
      scenarioId: z.number().int().optional(),
      allocatorSegment: z.string().optional(),
      calibrationEligibleOnly: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(lpTwinHumanResponses)
        .where(eq(lpTwinHumanResponses.orgId, ctx.orgId))
        .orderBy(desc(lpTwinHumanResponses.createdAt))
        .limit(500);
      return { responses: rows };
    }),

  // 17. listSyntheticSnapshots — WP7D
  listSyntheticSnapshots: enterpriseProcedure
    .input(z.object({ scenarioId: z.number().int().optional() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(lpTwinSyntheticSnapshots)
        .where(eq(lpTwinSyntheticSnapshots.orgId, ctx.orgId))
        .orderBy(desc(lpTwinSyntheticSnapshots.createdAt))
        .limit(500);
      return { snapshots: rows };
    }),

  // 18. getValidationReport — WP7M
  getValidationReport: enterpriseProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [participants, scenarios, responses, snapshots, candidates] = await Promise.all([
        db.select().from(lpTwinValidationParticipants).where(eq(lpTwinValidationParticipants.orgId, ctx.orgId)).limit(500),
        db.select().from(lpTwinValidationScenarios).where(eq(lpTwinValidationScenarios.orgId, ctx.orgId)).limit(100),
        db.select().from(lpTwinHumanResponses).where(eq(lpTwinHumanResponses.orgId, ctx.orgId)).limit(1000),
        db.select().from(lpTwinSyntheticSnapshots).where(eq(lpTwinSyntheticSnapshots.orgId, ctx.orgId)).limit(1000),
        db.select().from(lpTwinCalibrationCandidates).where(eq(lpTwinCalibrationCandidates.orgId, ctx.orgId)).limit(200),
      ]);

      const comparisons = responses.map((human) => {
        const snap = snapshots.find(
          (s) => s.scenarioId === human.scenarioId && s.scenarioVersion === human.scenarioVersion
        );
        if (!snap) return null;
        return {
          segmentId: human.allocatorSegment,
          result: compareResponses(
            { syntheticVerdict: snap.syntheticVerdict, objectionsJson: snap.objectionsJson, evidenceRequestedJson: snap.evidenceRequestedJson, termsChallengedJson: snap.termsChallengedJson, expectedNextStep: snap.expectedNextStep },
            { verdict: human.verdict, topObjectionsJson: human.topObjectionsJson, requiredEvidenceJson: human.requiredEvidenceJson, termsToChangeJson: human.termsToChangeJson, likelyNextStep: human.likelyNextStep, calibrationEligible: human.calibrationEligible, consentVerified: human.consentVerified }
          ),
        };
      }).filter(Boolean) as Array<{ segmentId: string; result: ReturnType<typeof compareResponses> }>;

      const segmentAggregations = aggregateBySegment(comparisons);

      return {
        reportTitle: "CapTwin LP Twin Validation Report",
        generatedAt: Date.now(),
        methodology: "Structured comparison of deterministic synthetic LP archetype outputs against human validator responses using standardized fund scenarios.",
        participants: {
          total: participants.length,
          byType: participants.reduce((acc, p) => { acc[p.participantType] = (acc[p.participantType] ?? 0) + 1; return acc; }, {} as Record<string, number>),
          verified: participants.filter((p) => p.verificationStatus === "verified").length,
        },
        scenarios: {
          total: scenarios.length,
          active: scenarios.filter((s) => s.isActive).length,
        },
        responses: {
          total: responses.length,
          verified: responses.filter((r) => r.verificationStatus === "verified").length,
          calibrationEligible: responses.filter((r) => r.calibrationEligible).length,
          bySourceType: responses.reduce((acc, r) => { acc[r.sourceType] = (acc[r.sourceType] ?? 0) + 1; return acc; }, {} as Record<string, number>),
        },
        agreementMetrics: segmentAggregations,
        calibrationCandidates: {
          total: candidates.length,
          proposed: candidates.filter((c) => c.reviewStatus === "proposed").length,
          approved: candidates.filter((c) => c.reviewStatus === "approved").length,
          rejected: candidates.filter((c) => c.reviewStatus === "rejected").length,
        },
        syntheticVersions: {
          agentBankVersion: LP_AGENT_BANK_VERSION,
          fitEngineVersion: FIT_ENGINE_VERSION,
          objectionEngineVersion: LP_OBJECTION_RULES_VERSION,
          validationEngineVersion: VALIDATION_ENGINE_VERSION,
        },
        knownLimitations: [
          "All human responses are from a limited, self-selected participant pool.",
          "Synthetic archetypes are based on anonymised patterns, not individual institution data.",
          "Agreement metrics do not constitute validated predictive accuracy.",
          "Calibration has not been applied — all outputs remain synthetic archetypes.",
          "Do not use these metrics to claim predictive performance.",
        ],
        disclaimer: "SYNTHETIC SIMULATION — Agreement metrics only. Not validated predictive accuracy.",
      };
    }),

  // 19. updateParticipantConsent — WP7K
  updateParticipantConsent: enterpriseProcedure
    .input(z.object({
      participantId: z.number().int().positive(),
      consentStatus: z.enum(["pending", "granted", "revoked", "expired"]),
      calibrationEligibility: z.boolean().optional(),
      permittedUse: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [participant] = await db
        .select()
        .from(lpTwinValidationParticipants)
        .where(and(
          eq(lpTwinValidationParticipants.id, input.participantId),
          eq(lpTwinValidationParticipants.orgId, ctx.orgId)
        ))
        .limit(1);
      if (!participant) throw new TRPCError({ code: "NOT_FOUND", message: "Participant not found" });

      const now = Date.now();
      await db
        .update(lpTwinValidationParticipants)
        .set({
          consentStatus: input.consentStatus,
          calibrationEligibility: input.calibrationEligibility ?? participant.calibrationEligibility,
          permittedUse: input.permittedUse ? JSON.stringify(input.permittedUse) : participant.permittedUse,
          updatedAt: now,
        })
        .where(eq(lpTwinValidationParticipants.id, input.participantId));

      return { participantId: input.participantId, consentStatus: input.consentStatus };
    }),

  // 20. getValidationThresholds — WP7J (transparent threshold documentation)
  getValidationThresholds: enterpriseProcedure
    .query(() => {
      return {
        thresholds: VALIDATION_THRESHOLDS,
        labels: {
          "Synthetic Only": "No verified human responses. All outputs are synthetic archetypes.",
          "Early Validation": `At least ${VALIDATION_THRESHOLDS.EARLY_VALIDATION_MIN_RESPONSES} verified responses. Limited evidence.`,
          "Moderately Validated": `At least ${VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_RESPONSES} verified responses from ${VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_PARTICIPANTS}+ independent participants with ${Math.round(VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_VERDICT_AGREEMENT * 100)}%+ verdict agreement.`,
          "Strongly Validated": `At least ${VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_RESPONSES} verified responses from ${VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_PARTICIPANTS}+ independent participants with ${Math.round(VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_VERDICT_AGREEMENT * 100)}%+ verdict agreement.`,
        },
        calibrationRequirements: `Calibration requires ${VALIDATION_THRESHOLDS.CALIBRATION_MIN_RESPONSES}+ verified responses from ${VALIDATION_THRESHOLDS.CALIBRATION_MIN_PARTICIPANTS}+ independent participants with ${Math.round(VALIDATION_THRESHOLDS.CALIBRATION_MIN_VERDICT_AGREEMENT * 100)}%+ verdict agreement, plus explicit human approval.`,
        disclaimer: "Do not claim 'calibrated' status until these thresholds are met and independently reviewed.",
      };
    }),
});

export type LpTwinValidationRouter = typeof lpTwinValidationRouter;
