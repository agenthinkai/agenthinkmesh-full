/**
 * aros/hiddenVariable.ts — Hidden Variable Engine (Phase 5)
 *
 * For every company, identifies the single variable most likely to determine
 * success or failure. Stores predictions and tracks accuracy against reality.
 *
 * Also handles Decision Twin V2 generation (10-field structured record).
 */

import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosDecisionTwinsV2,
  arosHiddenVariables,
  arosOutcomeLedgerV2,
  arosAccuracySnapshots,
  arosTokenLedger,
  arosAuditLog,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function requireAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

const HV_TYPES = [
  "REGULATORY_DELAY",
  "AI_GOVERNANCE_FAILURE",
  "CAPITAL_ALLOCATION_ERROR",
  "DATA_SOVEREIGNTY_CONSTRAINT",
  "COMPETITIVE_RESPONSE",
  "INFRASTRUCTURE_BOTTLENECK",
  "TALENT_SHORTAGE",
  "EXECUTION_RISK",
  "MARKET_TIMING",
  "OTHER",
] as const;

// ── Generate Decision Twin V2 + Hidden Variable for a single company ──────────
async function generateDTv2ForCompany(company: {
  id: number;
  companyName: string;
  sector: string | null;
  country: string | null;
  ceoName: string | null;
  keyDecisionDomain: string | null;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  opportunityScore: number | null;
}) {
  const prompt = `You are the ATLAS Decision Intelligence Engine. Analyze this company and produce a structured Decision Twin V2 record.

Company: ${company.companyName}
Sector: ${company.sector ?? "Unknown"}
Country: ${company.country ?? "Unknown"}
CEO: ${company.ceoName ?? "Unknown"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Unknown"}
Active Strategic Initiative: ${company.activeStrategicInitiative ?? "Unknown"}
AI Transformation Signal: ${company.aiTransformationSignal ?? "Unknown"}
Opportunity Score: ${company.opportunityScore ?? 0}/100

Produce a JSON object with exactly these fields:
{
  "primaryObjective": "string (max 200 chars) — the company's primary strategic objective right now",
  "secondaryObjective": "string (max 200 chars) — secondary objective",
  "strategicDecision": "string (max 300 chars) — the specific decision they are facing that ATLAS can help with",
  "hiddenVariable": "string (max 200 chars) — the single variable most likely to determine success or failure",
  "hiddenVariableType": "one of: REGULATORY_DELAY | AI_GOVERNANCE_FAILURE | CAPITAL_ALLOCATION_ERROR | DATA_SOVEREIGNTY_CONSTRAINT | COMPETITIVE_RESPONSE | INFRASTRUCTURE_BOTTLENECK | TALENT_SHORTAGE | EXECUTION_RISK | MARKET_TIMING | OTHER",
  "hiddenVariableConfidence": number between 0.0 and 1.0,
  "monitoringSignals": ["signal1", "signal2", "signal3"],
  "estimatedDecisionTimeline": "string like '6-12 months' or 'Q3 2025'",
  "estimatedAcvUsd": number (integer USD),
  "urgencyScore": number 0-100,
  "recommendedEngagementPath": "string (max 300 chars) — how ATLAS should engage this executive",
  "assumptions": ["assumption1", "assumption2"],
  "calibrationBaseline": {
    "response_rate": 0.10,
    "meeting_rate": 0.05,
    "proposal_rate": 0.025,
    "customer_rate": 0.01
  }
}

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a structured JSON generator. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "decision_twin_v2",
        strict: true,
        schema: {
          type: "object",
          properties: {
            primaryObjective: { type: "string" },
            secondaryObjective: { type: "string" },
            strategicDecision: { type: "string" },
            hiddenVariable: { type: "string" },
            hiddenVariableType: { type: "string" },
            hiddenVariableConfidence: { type: "number" },
            monitoringSignals: { type: "array", items: { type: "string" } },
            estimatedDecisionTimeline: { type: "string" },
            estimatedAcvUsd: { type: "number" },
            urgencyScore: { type: "number" },
            recommendedEngagementPath: { type: "string" },
            assumptions: { type: "array", items: { type: "string" } },
            calibrationBaseline: {
              type: "object",
              properties: {
                response_rate: { type: "number" },
                meeting_rate: { type: "number" },
                proposal_rate: { type: "number" },
                customer_rate: { type: "number" },
              },
              required: ["response_rate", "meeting_rate", "proposal_rate", "customer_rate"],
              additionalProperties: false,
            },
          },
          required: [
            "primaryObjective", "secondaryObjective", "strategicDecision",
            "hiddenVariable", "hiddenVariableType", "hiddenVariableConfidence",
            "monitoringSignals", "estimatedDecisionTimeline", "estimatedAcvUsd",
            "urgencyScore", "recommendedEngagementPath", "assumptions", "calibrationBaseline",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned empty response");
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export const arosHiddenVariableRouter = router({

  // ── Generate DT V2 + Hidden Variable for a single company ─────────────────
  generateForCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      const dtData = await generateDTv2ForCompany(company);
      const now = Date.now();

      // Insert Decision Twin V2
      const [dtResult] = await db.insert(arosDecisionTwinsV2).values({
        companyId: company.id,
        primaryObjective: dtData.primaryObjective.slice(0, 300),
        secondaryObjective: dtData.secondaryObjective?.slice(0, 300),
        strategicDecision: dtData.strategicDecision.slice(0, 400),
        hiddenVariable: dtData.hiddenVariable.slice(0, 300),
        hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
        monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
        estimatedDecisionTimeline: dtData.estimatedDecisionTimeline?.slice(0, 100),
        estimatedAcvUsd: Math.round(dtData.estimatedAcvUsd ?? 0),
        urgencyScore: Math.max(0, Math.min(100, Math.round(dtData.urgencyScore ?? 0))),
        recommendedEngagementPath: dtData.recommendedEngagementPath?.slice(0, 500),
        version: 2,
        generatedBy: "atlas_phase5",
        createdAt: now,
        updatedAt: now,
      }).$returningId();

      // Insert Hidden Variable record
      const hvType = HV_TYPES.includes(dtData.hiddenVariableType) ? dtData.hiddenVariableType : "OTHER";
      const [hvResult] = await db.insert(arosHiddenVariables).values({
        companyId: company.id,
        decisionTwinV2Id: dtResult.id,
        hiddenVariable: dtData.hiddenVariable.slice(0, 300),
        hiddenVariableType: hvType,
        confidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
        monitoringSignal: (dtData.monitoringSignals ?? []).join("; ").slice(0, 400),
        reviewDate: now + 90 * 24 * 60 * 60 * 1000, // 90 days from now
        createdAt: now,
        updatedAt: now,
      }).$returningId();

      // Insert Outcome Ledger V2 entry
      await db.insert(arosOutcomeLedgerV2).values({
        companyId: company.id,
        decisionTwinV2Id: dtResult.id,
        hiddenVariableId: hvResult.id,
        hiddenVariable: dtData.hiddenVariable.slice(0, 300),
        hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
        assumptions: JSON.stringify(dtData.assumptions ?? []),
        monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
        calibrationBaseline: JSON.stringify(dtData.calibrationBaseline ?? {}),
        reviewDate: now + 90 * 24 * 60 * 60 * 1000,
        opportunityScoreAtT0: company.opportunityScore ?? 0,
        acvAtT0: dtData.estimatedAcvUsd ?? 0,
        urgencyAtT0: dtData.urgencyScore ?? 0,
        outcomeStatus: "PENDING",
        revenueForecasted: dtData.estimatedAcvUsd ?? 0,
        revenueActual: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Log tokens (~500 tokens per DT generation)
      await db.insert(arosTokenLedger).values({
        workflow: "company_research",
        model: "gpt-4o-mini",
        inputTokens: 350,
        outputTokens: 250,
        totalTokens: 600,
        costUsd: (350 * 0.00000015 + 250 * 0.0000006).toFixed(8),
        companyId: company.id,
        triggeredBy: ctx.user.id,
      });

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "decision_twin_v2.generated",
        entityType: "aros_decision_twins_v2",
        entityId: String(dtResult.id),
        payload: JSON.stringify({ companyId: company.id, companyName: company.companyName }),
      });

      return {
        decisionTwinId: dtResult.id,
        hiddenVariableId: hvResult.id,
        companyName: company.companyName,
        hiddenVariable: dtData.hiddenVariable,
        urgencyScore: dtData.urgencyScore,
        estimatedAcvUsd: dtData.estimatedAcvUsd,
      };
    }),

  // ── Batch generate DT V2 for companies missing them ───────────────────────
  batchGenerateMissing: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Find companies without a V2 Decision Twin
      const existing = await db
        .select({ companyId: arosDecisionTwinsV2.companyId })
        .from(arosDecisionTwinsV2);
      const existingIds = new Set(existing.map(e => e.companyId));

      const allCompanies = await db
        .select()
        .from(arosCompanies)
        .orderBy(desc(arosCompanies.opportunityScore))
        .limit(input.limit * 5); // fetch more to filter

      const missing = allCompanies.filter(c => !existingIds.has(c.id)).slice(0, input.limit);

      if (missing.length === 0) {
        return { processed: 0, message: "All companies already have V2 Decision Twins" };
      }

      let processed = 0;
      const results = [];
      for (const company of missing) {
        try {
          const dtData = await generateDTv2ForCompany(company);
          const now = Date.now();
          const hvType = HV_TYPES.includes(dtData.hiddenVariableType) ? dtData.hiddenVariableType : "OTHER";

          const [dtResult] = await db.insert(arosDecisionTwinsV2).values({
            companyId: company.id,
            primaryObjective: dtData.primaryObjective.slice(0, 300),
            secondaryObjective: dtData.secondaryObjective?.slice(0, 300),
            strategicDecision: dtData.strategicDecision.slice(0, 400),
            hiddenVariable: dtData.hiddenVariable.slice(0, 300),
            hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
            monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
            estimatedDecisionTimeline: dtData.estimatedDecisionTimeline?.slice(0, 100),
            estimatedAcvUsd: Math.round(dtData.estimatedAcvUsd ?? 0),
            urgencyScore: Math.max(0, Math.min(100, Math.round(dtData.urgencyScore ?? 0))),
            recommendedEngagementPath: dtData.recommendedEngagementPath?.slice(0, 500),
            version: 2,
            generatedBy: "atlas_phase5_batch",
            createdAt: now,
            updatedAt: now,
          }).$returningId();

          const [hvResult] = await db.insert(arosHiddenVariables).values({
            companyId: company.id,
            decisionTwinV2Id: dtResult.id,
            hiddenVariable: dtData.hiddenVariable.slice(0, 300),
            hiddenVariableType: hvType,
            confidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
            monitoringSignal: (dtData.monitoringSignals ?? []).join("; ").slice(0, 400),
            reviewDate: now + 90 * 24 * 60 * 60 * 1000,
            createdAt: now,
            updatedAt: now,
          }).$returningId();

          await db.insert(arosOutcomeLedgerV2).values({
            companyId: company.id,
            decisionTwinV2Id: dtResult.id,
            hiddenVariableId: hvResult.id,
            hiddenVariable: dtData.hiddenVariable.slice(0, 300),
            hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
            assumptions: JSON.stringify(dtData.assumptions ?? []),
            monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
            calibrationBaseline: JSON.stringify(dtData.calibrationBaseline ?? {}),
            reviewDate: now + 90 * 24 * 60 * 60 * 1000,
            opportunityScoreAtT0: company.opportunityScore ?? 0,
            acvAtT0: dtData.estimatedAcvUsd ?? 0,
            urgencyAtT0: dtData.urgencyScore ?? 0,
            outcomeStatus: "PENDING",
            revenueForecasted: dtData.estimatedAcvUsd ?? 0,
            revenueActual: 0,
            createdAt: now,
            updatedAt: now,
          });

          await db.insert(arosTokenLedger).values({
            workflow: "company_research",
            model: "gpt-4o-mini",
            inputTokens: 350,
            outputTokens: 250,
            totalTokens: 600,
            costUsd: (350 * 0.00000015 + 250 * 0.0000006).toFixed(8),
            companyId: company.id,
            triggeredBy: ctx.user.id,
          });

          results.push({ companyId: company.id, companyName: company.companyName, dtId: dtResult.id });
          processed++;
        } catch (err) {
          console.error(`Failed DT V2 for ${company.companyName}:`, err);
        }
      }

      return { processed, results };
    }),

  // ── Get Decision Twin V2 for a company ────────────────────────────────────
  getForCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [dt] = await db
        .select()
        .from(arosDecisionTwinsV2)
        .where(eq(arosDecisionTwinsV2.companyId, input.companyId))
        .orderBy(desc(arosDecisionTwinsV2.createdAt))
        .limit(1);

      const [hv] = await db
        .select()
        .from(arosHiddenVariables)
        .where(eq(arosHiddenVariables.companyId, input.companyId))
        .orderBy(desc(arosHiddenVariables.createdAt))
        .limit(1);

      return { decisionTwin: dt ?? null, hiddenVariable: hv ?? null };
    }),

  // ── Get coverage stats (how many companies have V2 DTs) ───────────────────
  getCoverageStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [[{ totalCompanies }]] = await db.execute(
        "SELECT COUNT(*) as totalCompanies FROM aros_companies"
      ) as any;
      const [[{ withDtV2 }]] = await db.execute(
        "SELECT COUNT(DISTINCT company_id) as withDtV2 FROM aros_decision_twins_v2"
      ) as any;
      const [[{ withHv }]] = await db.execute(
        "SELECT COUNT(DISTINCT company_id) as withHv FROM aros_hidden_variables"
      ) as any;
      const [[{ withOlV2 }]] = await db.execute(
        "SELECT COUNT(*) as withOlV2 FROM aros_outcome_ledger_v2"
      ) as any;

      return {
        totalCompanies: Number(totalCompanies),
        withDecisionTwinV2: Number(withDtV2),
        withHiddenVariable: Number(withHv),
        withOutcomeLedgerV2: Number(withOlV2),
        coveragePct: totalCompanies > 0 ? Math.round((withDtV2 / totalCompanies) * 100) : 0,
        missingDtV2: Number(totalCompanies) - Number(withDtV2),
      };
    }),

  // ── Validate a hidden variable prediction against reality ─────────────────
  validatePrediction: protectedProcedure
    .input(z.object({
      hiddenVariableId: z.number(),
      actualOutcome: z.string().min(10),
      predictionCorrect: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [hv] = await db
        .select()
        .from(arosHiddenVariables)
        .where(eq(arosHiddenVariables.id, input.hiddenVariableId))
        .limit(1);
      if (!hv) throw new TRPCError({ code: "NOT_FOUND" });

      const now = Date.now();
      const accuracy = input.predictionCorrect ? 1.0 : 0.0;

      await db.update(arosHiddenVariables)
        .set({
          actualOutcome: input.actualOutcome,
          predictionCorrect: input.predictionCorrect,
          validatedAt: now,
          accuracyDelta: String(accuracy - Number(hv.confidence)),
          updatedAt: now,
        })
        .where(eq(arosHiddenVariables.id, input.hiddenVariableId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "hidden_variable.validated",
        entityType: "aros_hidden_variables",
        entityId: String(input.hiddenVariableId),
        payload: JSON.stringify({ correct: input.predictionCorrect, accuracy }),
      });

      return { success: true, accuracy };
    }),

  // ── Get hidden variable accuracy stats ────────────────────────────────────
  getAccuracyStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [[stats]] = await db.execute(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN prediction_correct = 1 THEN 1 ELSE 0 END) as correct,
          SUM(CASE WHEN prediction_correct = 0 THEN 1 ELSE 0 END) as incorrect,
          SUM(CASE WHEN prediction_correct IS NULL THEN 1 ELSE 0 END) as pending,
          AVG(CASE WHEN prediction_correct IS NOT NULL THEN CAST(prediction_correct AS DECIMAL) END) as accuracy
        FROM aros_hidden_variables
      `) as any;

      const byType = await db.execute(`
        SELECT hidden_variable_type, COUNT(*) as count,
          AVG(CASE WHEN prediction_correct IS NOT NULL THEN CAST(prediction_correct AS DECIMAL) END) as accuracy
        FROM aros_hidden_variables
        GROUP BY hidden_variable_type
        ORDER BY count DESC
      `) as any;

      return {
        total: Number(stats.total),
        correct: Number(stats.correct),
        incorrect: Number(stats.incorrect),
        pending: Number(stats.pending),
        overallAccuracy: stats.accuracy !== null ? Number(stats.accuracy) : null,
        byType: (byType[0] as any[]).map((r: any) => ({
          type: r.hidden_variable_type,
          count: Number(r.count),
          accuracy: r.accuracy !== null ? Number(r.accuracy) : null,
        })),
      };
    }),

  // ── Take daily accuracy snapshot ──────────────────────────────────────────
  takeAccuracySnapshot: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const today = new Date().toISOString().slice(0, 10);

      const [[pipeline]] = await db.execute(`
        SELECT
          SUM(CASE WHEN stage != 'RESEARCHED' THEN 1 ELSE 0 END) as outreach,
          SUM(CASE WHEN stage = 'RESPONSE_RECEIVED' THEN 1 ELSE 0 END) as responses,
          SUM(CASE WHEN stage IN ('MEETING_BOOKED','MEETING_HELD') THEN 1 ELSE 0 END) as meetings,
          SUM(CASE WHEN stage = 'PROPOSAL_SENT' THEN 1 ELSE 0 END) as proposals,
          SUM(CASE WHEN stage = 'CUSTOMER' THEN 1 ELSE 0 END) as customers,
          COUNT(*) as total
        FROM aros_pipeline
      `) as any;

      const outreach = Number(pipeline.outreach ?? 0);
      const responses = Number(pipeline.responses ?? 0);
      const meetings = Number(pipeline.meetings ?? 0);
      const proposals = Number(pipeline.proposals ?? 0);
      const customers = Number(pipeline.customers ?? 0);

      const [[hvStats]] = await db.execute(`
        SELECT
          AVG(CASE WHEN prediction_correct IS NOT NULL THEN CAST(prediction_correct AS DECIMAL) END) as hv_acc,
          COUNT(CASE WHEN prediction_correct IS NOT NULL THEN 1 END) as hv_sample
        FROM aros_hidden_variables
      `) as any;

      const [[dtStats]] = await db.execute(`
        SELECT AVG(prediction_accuracy) as dt_acc, COUNT(CASE WHEN prediction_accuracy IS NOT NULL THEN 1 END) as dt_sample
        FROM aros_decision_twins_v2
      `) as any;

      const [[revStats]] = await db.execute(`
        SELECT SUM(revenue_forecasted) as forecasted, SUM(revenue_actual) as actual
        FROM aros_outcome_ledger_v2
      `) as any;

      const [[counts]] = await db.execute(`
        SELECT
          (SELECT COUNT(*) FROM aros_companies) as companies,
          (SELECT COUNT(*) FROM aros_outcome_ledger_v2) as ol_entries,
          (SELECT COUNT(*) FROM aros_calibration) as cal_records
      `) as any;

      const forecasted = Number(revStats.forecasted ?? 0);
      const actual = Number(revStats.actual ?? 0);
      const revAccuracy = forecasted > 0 ? actual / forecasted : null;

      await db.insert(arosAccuracySnapshots).values({
        snapshotDate: today,
        responseRatePredicted: "0.1",
        responseRateActual: outreach > 0 ? String(responses / outreach) : null,
        meetingRatePredicted: "0.05",
        meetingRateActual: outreach > 0 ? String(meetings / outreach) : null,
        proposalRatePredicted: "0.025",
        proposalRateActual: outreach > 0 ? String(proposals / outreach) : null,
        customerRatePredicted: "0.01",
        customerRateActual: outreach > 0 ? String(customers / outreach) : null,
        dtAccuracyAvg: dtStats.dt_acc !== null ? String(Number(dtStats.dt_acc)) : null,
        dtSampleSize: Number(dtStats.dt_sample ?? 0),
        hvAccuracyAvg: hvStats.hv_acc !== null ? String(Number(hvStats.hv_acc)) : null,
        hvSampleSize: Number(hvStats.hv_sample ?? 0),
        revenueForecastedTotal: forecasted,
        revenueActualTotal: actual,
        revenueForecastAccuracy: revAccuracy !== null ? String(revAccuracy) : null,
        totalCompanies: Number(counts.companies),
        totalOutcomeLedgerEntries: Number(counts.ol_entries),
        totalCalibrationRecords: Number(counts.cal_records),
        createdAt: Date.now(),
      });

      return { snapshotDate: today, outreach, responses, meetings, proposals, customers };
    }),

  // ── Get accuracy snapshot history ─────────────────────────────────────────
  getSnapshotHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select()
        .from(arosAccuracySnapshots)
        .orderBy(desc(arosAccuracySnapshots.snapshotDate))
        .limit(input.limit);

      return rows;
    }),
});
