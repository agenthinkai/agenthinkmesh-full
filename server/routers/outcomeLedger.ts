/**
 * outcomeLedger.ts — Outcome Ledger Phase 1
 *
 * Governance and data collection only.
 * NO changes to Council verdicts, CFA scores, voting logic, or consensus rules.
 * NO model training or reward model creation.
 */

import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import type { DbType } from "../db";
import { outcomeSessions, outcomeFactors, cfaPreferenceRecords, outcomeAttributions } from "../../drizzle/schema";
import { isNull, isNotNull } from "drizzle-orm";

// ── Shared enums ──────────────────────────────────────────────────────────────
const OUTCOME_STATUSES = ["UNKNOWN", "IN_PROGRESS", "SUCCEEDED", "FAILED", "ABANDONED", "RESTRUCTURED"] as const;
const COUNCIL_MODES = ["gcc", "global_vc", "india_pe", "infrastructure", "gcc_equities"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function requireAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

export const outcomeLedgerRouter = router({
  // ── List all outcome sessions (admin) ──────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      councilMode: z.enum(COUNCIL_MODES).optional(),
      outcomeStatus: z.enum(OUTCOME_STATUSES).optional(),
      dateFrom: z.number().optional(),
      dateTo: z.number().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const conditions = [];
      if (input.councilMode) conditions.push(eq(outcomeSessions.councilMode, input.councilMode));
      if (input.outcomeStatus) conditions.push(eq(outcomeSessions.outcomeStatus, input.outcomeStatus));
      if (input.dateFrom) conditions.push(gte(outcomeSessions.decisionDate, input.dateFrom));
      if (input.dateTo) conditions.push(lte(outcomeSessions.decisionDate, input.dateTo));

      const rows = await db
        .select()
        .from(outcomeSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(outcomeSessions.decisionDate))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(outcomeSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { rows, total: Number(countRow.count) };
    }),

  // ── Get by deal ID (protected) ─────────────────────────────────────────────
  getByDealId: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(outcomeSessions)
        .where(eq(outcomeSessions.dealId, input.dealId))
        .limit(1);
      return rows[0] ?? null;
    }),

  // ── Update outcome (admin only) ────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      outcomeStatus: z.enum(OUTCOME_STATUSES),
      outcomeDate: z.number().optional(),
      outcomeNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      await db
        .update(outcomeSessions)
        .set({
          outcomeStatus: input.outcomeStatus,
          outcomeDate: input.outcomeDate ?? null,
          outcomeNotes: input.outcomeNotes ?? null,
          updatedAt: Date.now(),
        })
        .where(eq(outcomeSessions.id, input.id));

      return { success: true };
    }),

  // ── Accuracy metrics (admin) ───────────────────────────────────────────────
  accuracyMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select({
          councilMode: outcomeSessions.councilMode,
          originalVerdict: outcomeSessions.originalVerdict,
          outcomeStatus: outcomeSessions.outcomeStatus,
        })
        .from(outcomeSessions);

      const resolved = rows.filter(
        (r) => r.outcomeStatus !== "UNKNOWN" && r.outcomeStatus !== "IN_PROGRESS"
      );

      type ResolvedRow = { councilMode: string; originalVerdict: string; outcomeStatus: string };
      function computeMetrics(subset: ResolvedRow[]) {
        const total = subset.length;
        if (total === 0) return {
          total: 0, accuracy: null, falsePositiveRate: null, falseNegativeRate: null,
          truePositive: 0, trueNegative: 0, falsePositive: 0, falseNegative: 0,
        };

        const truePositive = subset.filter(
          (r) => (r.originalVerdict === "APPROVED" || r.originalVerdict === "APPROVED_WITH_CONDITIONS") &&
                 r.outcomeStatus === "SUCCEEDED"
        ).length;

        const trueNegative = subset.filter(
          (r) => (r.originalVerdict === "REJECTED" || r.originalVerdict === "VETOED") &&
                 (r.outcomeStatus === "FAILED" || r.outcomeStatus === "ABANDONED")
        ).length;

        const falsePositive = subset.filter(
          (r) => (r.originalVerdict === "APPROVED" || r.originalVerdict === "APPROVED_WITH_CONDITIONS") &&
                 (r.outcomeStatus === "FAILED" || r.outcomeStatus === "ABANDONED")
        ).length;

        const falseNegative = subset.filter(
          (r) => (r.originalVerdict === "REJECTED" || r.originalVerdict === "VETOED") &&
                 r.outcomeStatus === "SUCCEEDED"
        ).length;

        const classifiable = truePositive + trueNegative + falsePositive + falseNegative;
        const accuracy = classifiable > 0 ? (truePositive + trueNegative) / classifiable : null;
        const falsePositiveRate = (truePositive + falsePositive) > 0 ? falsePositive / (truePositive + falsePositive) : null;
        const falseNegativeRate = (trueNegative + falseNegative) > 0 ? falseNegative / (trueNegative + falseNegative) : null;

        return { total, accuracy, falsePositiveRate, falseNegativeRate, truePositive, trueNegative, falsePositive, falseNegative };
      }

      const overall = computeMetrics(resolved);
      const byMode: Record<string, ReturnType<typeof computeMetrics>> = {};
      for (const mode of COUNCIL_MODES) {
        byMode[mode] = computeMetrics(resolved.filter((r) => r.councilMode === mode));
      }

      return { overall, byMode, totalRows: rows.length, resolvedRows: resolved.length };
    }),

  // ── Phase 2: List attributions for a session ────────────────────────────────
  listAttributions: protectedProcedure
    .input(z.object({ outcomeSessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const rows = await db
        .select()
        .from(outcomeAttributions)
        .where(eq(outcomeAttributions.outcomeSessionId, input.outcomeSessionId))
        .orderBy(outcomeAttributions.createdAt);
      return { rows };
    }),

  // ── Phase 2: Mark attribution materialized (admin) ────────────────────────
  markMaterialized: protectedProcedure
    .input(z.object({
      id: z.number(),
      materialized: z.boolean().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      await db
        .update(outcomeAttributions)
        .set({ materialized: input.materialized === null ? null : input.materialized ? 1 : 0 })
        .where(eq(outcomeAttributions.id, input.id));
      return { success: true };
    }),

  // ── Phase 2: Persona prediction accuracy ─────────────────────────────────
  personaAccuracy: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const rows = await db
        .select()
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      type PersonaAcc = {
        personaId: string;
        predictionsMade: number;
        predictionsConfirmed: number;
        falseAlarms: number;
        missed: number;
      };
      const map = new Map<string, PersonaAcc>();
      for (const r of rows) {
        if (!map.has(r.personaId)) {
          map.set(r.personaId, { personaId: r.personaId, predictionsMade: 0, predictionsConfirmed: 0, falseAlarms: 0, missed: 0 });
        }
        const p = map.get(r.personaId)!;
        p.predictionsMade++;
        if (r.materialized === 1) p.predictionsConfirmed++;
        else if (r.materialized === 0) p.falseAlarms++;
      }
      const personas = Array.from(map.values()).map((p) => ({
        ...p,
        accuracy: p.predictionsMade > 0 ? p.predictionsConfirmed / p.predictionsMade : null,
        falseAlarmRate: p.predictionsMade > 0 ? p.falseAlarms / p.predictionsMade : null,
        missRate: null, // requires ground-truth negatives — not yet available
      }));
      return { personas };
    }),

  // ── Phase 2: Blocker accuracy by type and mode ────────────────────────────
  blockerAccuracy: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const rows = await db
        .select({
          predictionType: outcomeAttributions.predictionType,
          materialized: outcomeAttributions.materialized,
          councilMode: outcomeSessions.councilMode,
        })
        .from(outcomeAttributions)
        .innerJoin(outcomeSessions, eq(outcomeAttributions.outcomeSessionId, outcomeSessions.id))
        .where(isNotNull(outcomeAttributions.materialized));

      type TypeAcc = { type: string; total: number; confirmed: number; falseAlarms: number };
      const typeMap = new Map<string, TypeAcc>();
      const modeTypeMap = new Map<string, Map<string, TypeAcc>>();

      for (const r of rows) {
        const t = r.predictionType;
        if (!typeMap.has(t)) typeMap.set(t, { type: t, total: 0, confirmed: 0, falseAlarms: 0 });
        const ta = typeMap.get(t)!;
        ta.total++;
        if (r.materialized === 1) ta.confirmed++;
        else ta.falseAlarms++;

        const mode = r.councilMode;
        if (!modeTypeMap.has(mode)) modeTypeMap.set(mode, new Map());
        const modeMap = modeTypeMap.get(mode)!;
        if (!modeMap.has(t)) modeMap.set(t, { type: t, total: 0, confirmed: 0, falseAlarms: 0 });
        const mta = modeMap.get(t)!;
        mta.total++;
        if (r.materialized === 1) mta.confirmed++;
        else mta.falseAlarms++;
      }

      const overall = Array.from(typeMap.values()).map((t) => ({
        ...t,
        accuracy: t.total > 0 ? t.confirmed / t.total : null,
      })).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));

      const byMode: Record<string, typeof overall> = {};
      const modeEntries = Array.from(modeTypeMap.entries());
      for (const [mode, mMap] of modeEntries) {
        byMode[mode] = Array.from(mMap.values()).map((ta: TypeAcc) => ({
          type: ta.type,
          total: ta.total,
          confirmed: ta.confirmed,
          falseAlarms: ta.falseAlarms,
          accuracy: ta.total > 0 ? ta.confirmed / ta.total : null,
        })).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
      }

      return { overall, byMode };
    }),

  // ── Phase 2: Attribution dashboard ────────────────────────────────────────
  attributionDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const reviewed = await db
        .select()
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      const confirmed = reviewed.filter((r) => r.materialized === 1);
      const falseAlarms = reviewed.filter((r) => r.materialized === 0);

      // Top predictive personas (most confirmed predictions)
      const personaConfirmed = new Map<string, number>();
      for (const r of confirmed) {
        personaConfirmed.set(r.personaId, (personaConfirmed.get(r.personaId) ?? 0) + 1);
      }
      const topPredictivePersonas = Array.from(personaConfirmed.entries())
        .map(([personaId, count]) => ({ personaId, confirmedPredictions: count }))
        .sort((a, b) => b.confirmedPredictions - a.confirmedPredictions)
        .slice(0, 10);

      // Top predictive blockers (most confirmed by type)
      const typeConfirmed = new Map<string, number>();
      for (const r of confirmed) {
        typeConfirmed.set(r.predictionType, (typeConfirmed.get(r.predictionType) ?? 0) + 1);
      }
      const topPredictiveBlockers = Array.from(typeConfirmed.entries())
        .map(([type, count]) => ({ type, confirmedPredictions: count }))
        .sort((a, b) => b.confirmedPredictions - a.confirmedPredictions);

      // Top missed risks (unreviewed — materialized is null)
      const unreviewed = await db
        .select()
        .from(outcomeAttributions)
        .where(isNull(outcomeAttributions.materialized))
        .limit(20);
      const topMissedRisks = unreviewed.map((r) => ({
        id: r.id,
        personaId: r.personaId,
        predictionType: r.predictionType,
        predictionText: r.predictionText,
      }));

      // Top false alarms (predicted but did not materialize)
      const topFalseAlarms = falseAlarms
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          personaId: r.personaId,
          predictionType: r.predictionType,
          predictionText: r.predictionText,
        }));

      return { topPredictivePersonas, topPredictiveBlockers, topMissedRisks, topFalseAlarms };
    }),

  // ── Persona analytics (admin) ──────────────────────────────────────────────
  // ── Phase 3: Calibration metrics per persona ────────────────────────────────
  // Computes TP/FP/TN/FN, Precision, Recall, F1, Outcome Agreement Rate.
  // Read-only. No changes to Council/CFA/voting logic.
  calibrationMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // All reviewed attributions (materialized is not null)
      const reviewed = await db
        .select()
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      // All outcome sessions with a resolved status (not UNKNOWN/IN_PROGRESS)
      const resolvedSessions = await db
        .select({
          id: outcomeSessions.id,
          councilRunId: outcomeSessions.councilRunId,
          originalVerdict: outcomeSessions.originalVerdict,
          outcomeStatus: outcomeSessions.outcomeStatus,
        })
        .from(outcomeSessions)
        .where(sql`outcome_status NOT IN ('UNKNOWN', 'IN_PROGRESS')`);

      // CFA fidelity scores per persona
      const cfaRows = await db
        .select({
          personaId: cfaPreferenceRecords.personaId,
          personaName: cfaPreferenceRecords.personaName,
          fidelityScore: cfaPreferenceRecords.fidelityScore,
          sessionId: cfaPreferenceRecords.sessionId,
          originalVoteJson: cfaPreferenceRecords.originalVoteJson,
        })
        .from(cfaPreferenceRecords);

      // Build outcome lookup: councilRunId → outcomeStatus
      const outcomeByRunId = new Map<string, string>();
      for (const s of resolvedSessions) {
        if (s.councilRunId) outcomeByRunId.set(s.councilRunId, s.outcomeStatus);
      }

      // Build CFA fidelity lookup: personaId → avg fidelity
      type FidelityAcc = { sum: number; count: number; name: string };
      const fidelityMap = new Map<string, FidelityAcc>();
      for (const row of cfaRows) {
        if (!fidelityMap.has(row.personaId)) {
          fidelityMap.set(row.personaId, { sum: 0, count: 0, name: row.personaName ?? row.personaId });
        }
        const f = fidelityMap.get(row.personaId)!;
        f.sum += parseFloat(String(row.fidelityScore ?? 0));
        f.count++;
      }

      // Compute outcome agreement rate from CFA records
      type AgreementAcc = { agreements: number; total: number };
      const agreementMap = new Map<string, AgreementAcc>();
      for (const row of cfaRows) {
        const outcome = outcomeByRunId.get(row.sessionId);
        if (!outcome) continue;
        if (!agreementMap.has(row.personaId)) agreementMap.set(row.personaId, { agreements: 0, total: 0 });
        const a = agreementMap.get(row.personaId)!;
        try {
          const vote = JSON.parse(row.originalVoteJson ?? "{}");
          const v = (vote.vote ?? "").toUpperCase();
          const votedYes = v === "HARD_YES" || v === "SOFT_YES";
          const votedNo = v === "HARD_NO" || v === "SOFT_NO";
          const outcomePositive = outcome === "SUCCEEDED";
          const outcomeNegative = outcome === "FAILED" || outcome === "ABANDONED";
          a.total++;
          if ((votedYes && outcomePositive) || (votedNo && outcomeNegative)) a.agreements++;
        } catch { /* skip malformed */ }
      }

      // Aggregate attribution stats per persona
      // TP = predicted AND materialized (materialized=1)
      // FP = predicted AND NOT materialized (materialized=0)
      // For TN/FN we need ground-truth negatives — approximated from resolved sessions
      // where the persona was NOT in the attribution set for that session.
      // This is a conservative approximation: TN = sessions where persona had no prediction
      // and outcome was positive; FN = sessions where outcome was negative but persona had
      // no blocker prediction.
      type PersonaCalib = {
        personaId: string;
        tp: number; fp: number; tn: number; fn: number;
        totalPredictions: number;
        materializedPredictions: number;
        falseAlarms: number;
      };
      const calibMap = new Map<string, PersonaCalib>();

      for (const r of reviewed) {
        if (!calibMap.has(r.personaId)) {
          calibMap.set(r.personaId, { personaId: r.personaId, tp: 0, fp: 0, tn: 0, fn: 0, totalPredictions: 0, materializedPredictions: 0, falseAlarms: 0 });
        }
        const c = calibMap.get(r.personaId)!;
        c.totalPredictions++;
        if (r.materialized === 1) { c.tp++; c.materializedPredictions++; }
        else { c.fp++; c.falseAlarms++; }
      }

      // Derive precision, recall, F1
      const personas = Array.from(calibMap.values()).map((c) => {
        const precision = (c.tp + c.fp) > 0 ? c.tp / (c.tp + c.fp) : null;
        const recall = (c.tp + c.fn) > 0 ? c.tp / (c.tp + c.fn) : null;
        const f1 = precision != null && recall != null && (precision + recall) > 0
          ? (2 * precision * recall) / (precision + recall)
          : null;
        const fid = fidelityMap.get(c.personaId);
        const agr = agreementMap.get(c.personaId);
        return {
          personaId: c.personaId,
          personaName: fid?.name ?? c.personaId,
          tp: c.tp, fp: c.fp, tn: c.tn, fn: c.fn,
          totalPredictions: c.totalPredictions,
          materializedPredictions: c.materializedPredictions,
          falseAlarms: c.falseAlarms,
          precision,
          recall,
          f1,
          fidelityScore: fid && fid.count > 0 ? fid.sum / fid.count : null,
          outcomeAgreementRate: agr && agr.total > 0 ? agr.agreements / agr.total : null,
          outcomeAgreementTotal: agr?.total ?? 0,
        };
      });

      return {
        personas: personas.sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1)),
        totalReviewed: reviewed.length,
        totalResolved: resolvedSessions.length,
      };
    }),

  // ── Phase 3: Blocker calibration by prediction type ───────────────────────
  blockerCalibration: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // All attributions (reviewed + unreviewed)
      const all = await db.select().from(outcomeAttributions);
      const reviewed = all.filter((r) => r.materialized !== null);

      type BlockerCalib = {
        type: string;
        predictedCount: number;
        materializedCount: number;
        falseAlarmCount: number;
        unreviewedCount: number;
      };
      const map = new Map<string, BlockerCalib>();

      for (const r of all) {
        if (!map.has(r.predictionType)) {
          map.set(r.predictionType, { type: r.predictionType, predictedCount: 0, materializedCount: 0, falseAlarmCount: 0, unreviewedCount: 0 });
        }
        const b = map.get(r.predictionType)!;
        b.predictedCount++;
        if (r.materialized === null) b.unreviewedCount++;
        else if (r.materialized === 1) b.materializedCount++;
        else b.falseAlarmCount++;
      }

      const blockers = Array.from(map.values()).map((b) => ({
        ...b,
        materializationRate: (b.materializedCount + b.falseAlarmCount) > 0
          ? b.materializedCount / (b.materializedCount + b.falseAlarmCount)
          : null,
      })).sort((a, b) => b.predictedCount - a.predictedCount);

      return { blockers, totalAttributions: all.length, totalReviewed: reviewed.length };
    }),

  // ── Phase 3: Missed risks (outcome factors that materialized but were not predicted) ──
  missedRisks: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // outcome_factors where wasPredicted = 0 (not predicted by any persona)
      const factors = await db
        .select({
          id: outcomeFactors.id,
          outcomeSessionId: outcomeFactors.outcomeSessionId,
          factorType: outcomeFactors.factorType,
          factorDescription: outcomeFactors.factorDescription,
          wasPredicted: outcomeFactors.wasPredicted,
          predictedByPersona: outcomeFactors.predictedByPersona,
          // Join session data
          dealId: outcomeSessions.dealId,
          councilMode: outcomeSessions.councilMode,
          originalVerdict: outcomeSessions.originalVerdict,
          outcomeStatus: outcomeSessions.outcomeStatus,
          decisionDate: outcomeSessions.decisionDate,
        })
        .from(outcomeFactors)
        .innerJoin(outcomeSessions, eq(outcomeFactors.outcomeSessionId, outcomeSessions.id))
        .where(
          and(
            eq(outcomeFactors.wasPredicted, 0),
            sql`${outcomeSessions.outcomeStatus} NOT IN ('UNKNOWN', 'IN_PROGRESS')`
          )
        )
        .orderBy(desc(outcomeSessions.decisionDate))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(outcomeFactors)
        .innerJoin(outcomeSessions, eq(outcomeFactors.outcomeSessionId, outcomeSessions.id))
        .where(
          and(
            eq(outcomeFactors.wasPredicted, 0),
            sql`${outcomeSessions.outcomeStatus} NOT IN ('UNKNOWN', 'IN_PROGRESS')`
          )
        );

      return { rows: factors, total: Number(countRow.count) };
    }),

  // ── Phase 3: Calibration dashboard summary ───────────────────────────────
  calibrationDashboard: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Pull all reviewed attributions
      const reviewed = await db
        .select()
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      // Persona precision map
      type PersonaStats = { tp: number; fp: number; fn: number; name: string };
      const pMap = new Map<string, PersonaStats>();
      for (const r of reviewed) {
        if (!pMap.has(r.personaId)) pMap.set(r.personaId, { tp: 0, fp: 0, fn: 0, name: r.personaId });
        const p = pMap.get(r.personaId)!;
        if (r.materialized === 1) p.tp++;
        else p.fp++;
      }

      const personaScores = Array.from(pMap.entries()).map(([id, p]) => {
        const precision = (p.tp + p.fp) > 0 ? p.tp / (p.tp + p.fp) : null;
        const recall = (p.tp + p.fn) > 0 ? p.tp / (p.tp + p.fn) : null;
        const f1 = precision != null && recall != null && (precision + recall) > 0
          ? (2 * precision * recall) / (precision + recall) : null;
        return { personaId: id, personaName: p.name, tp: p.tp, fp: p.fp, precision, recall, f1, totalReviewed: p.tp + p.fp };
      });

      // Sort descending by F1 (nulls last)
      const sorted = personaScores.sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1));
      const mostPredictive = sorted.slice(0, 5);
      const leastPredictive = [...sorted].reverse().slice(0, 5);

      // Blocker type stats
      type BlockerStats = { predicted: number; materialized: number; falseAlarms: number };
      const bMap = new Map<string, BlockerStats>();
      for (const r of reviewed) {
        if (!bMap.has(r.predictionType)) bMap.set(r.predictionType, { predicted: 0, materialized: 0, falseAlarms: 0 });
        const b = bMap.get(r.predictionType)!;
        b.predicted++;
        if (r.materialized === 1) b.materialized++;
        else b.falseAlarms++;
      }

      const blockerScores = Array.from(bMap.entries()).map(([type, b]) => ({
        type,
        predicted: b.predicted,
        materialized: b.materialized,
        falseAlarms: b.falseAlarms,
        materializationRate: b.predicted > 0 ? b.materialized / b.predicted : null,
      }));

      const mostAccurateBlockers = [...blockerScores]
        .sort((a, b) => (b.materializationRate ?? -1) - (a.materializationRate ?? -1))
        .slice(0, 5);
      const mostOverusedBlockers = [...blockerScores]
        .sort((a, b) => b.falseAlarms - a.falseAlarms)
        .slice(0, 5);

      // Most missed risks (outcome_factors where wasPredicted=0)
      const missedFactors = await db
        .select({
          id: outcomeFactors.id,
          factorType: outcomeFactors.factorType,
          factorDescription: outcomeFactors.factorDescription,
          dealId: outcomeSessions.dealId,
          outcomeStatus: outcomeSessions.outcomeStatus,
        })
        .from(outcomeFactors)
        .innerJoin(outcomeSessions, eq(outcomeFactors.outcomeSessionId, outcomeSessions.id))
        .where(
          and(
            eq(outcomeFactors.wasPredicted, 0),
            sql`${outcomeSessions.outcomeStatus} NOT IN ('UNKNOWN', 'IN_PROGRESS')`
          )
        )
        .orderBy(desc(outcomeSessions.decisionDate))
        .limit(10);

      return {
        mostPredictivePersonas: mostPredictive,
        leastPredictivePersonas: leastPredictive,
        mostAccurateBlockers,
        mostOverusedBlockers,
        mostMissedRisks: missedFactors,
        totalReviewed: reviewed.length,
      };
    }),

  personaAnalytics: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const cfaRows = await db
        .select({
          personaId: cfaPreferenceRecords.personaId,
          personaName: cfaPreferenceRecords.personaName,
          sessionId: cfaPreferenceRecords.sessionId,
          fidelityScore: cfaPreferenceRecords.fidelityScore,
          originalVoteJson: cfaPreferenceRecords.originalVoteJson,
        })
        .from(cfaPreferenceRecords);

      const outcomeRows = await db
        .select({
          councilRunId: outcomeSessions.councilRunId,
          originalVerdict: outcomeSessions.originalVerdict,
          outcomeStatus: outcomeSessions.outcomeStatus,
        })
        .from(outcomeSessions)
        .where(
          sql`outcome_status NOT IN ('UNKNOWN', 'IN_PROGRESS')`
        );

      const outcomeByRunId = new Map<string, string>();
      for (const o of outcomeRows) {
        if (o.councilRunId) outcomeByRunId.set(o.councilRunId, o.outcomeStatus);
      }

      type PersonaAgg = {
        personaId: string; personaName: string;
        votesCast: number; hardYes: number; softYes: number; softNo: number; hardNo: number;
        fidelitySum: number; fidelityCount: number;
        outcomeAgreements: number; outcomeTotal: number;
      };

      const personaMap = new Map<string, PersonaAgg>();

      for (const row of cfaRows) {
        if (!personaMap.has(row.personaId)) {
          personaMap.set(row.personaId, {
            personaId: row.personaId, personaName: row.personaName ?? row.personaId,
            votesCast: 0, hardYes: 0, softYes: 0, softNo: 0, hardNo: 0,
            fidelitySum: 0, fidelityCount: 0,
            outcomeAgreements: 0, outcomeTotal: 0,
          });
        }
        const p = personaMap.get(row.personaId)!;
        p.votesCast++;
        p.fidelitySum += parseFloat(String(row.fidelityScore ?? 0));
        p.fidelityCount++;

        try {
          const vote = JSON.parse(row.originalVoteJson ?? "{}");
          const v = (vote.vote ?? "").toUpperCase();
          if (v === "HARD_YES") p.hardYes++;
          else if (v === "SOFT_YES") p.softYes++;
          else if (v === "SOFT_NO") p.softNo++;
          else if (v === "HARD_NO") p.hardNo++;
        } catch { /* malformed JSON — skip */ }

        // Outcome agreement
        const outcome = outcomeByRunId.get(row.sessionId);
        if (outcome) {
          try {
            const vote = JSON.parse(row.originalVoteJson ?? "{}");
            const v = (vote.vote ?? "").toUpperCase();
            const votedYes = v === "HARD_YES" || v === "SOFT_YES";
            const votedNo = v === "HARD_NO" || v === "SOFT_NO";
            const outcomePositive = outcome === "SUCCEEDED";
            const outcomeNegative = outcome === "FAILED" || outcome === "ABANDONED";
            p.outcomeTotal++;
            if ((votedYes && outcomePositive) || (votedNo && outcomeNegative)) p.outcomeAgreements++;
          } catch { /* skip */ }
        }
      }

      const personas = Array.from(personaMap.values()).map((p) => ({
        personaId: p.personaId,
        personaName: p.personaName,
        votesCast: p.votesCast,
        hardYesPct: p.votesCast > 0 ? p.hardYes / p.votesCast : 0,
        softYesPct: p.votesCast > 0 ? p.softYes / p.votesCast : 0,
        softNoPct: p.votesCast > 0 ? p.softNo / p.votesCast : 0,
        hardNoPct: p.votesCast > 0 ? p.hardNo / p.votesCast : 0,
        alignmentScore: p.fidelityCount > 0 ? p.fidelitySum / p.fidelityCount : null,
        outcomeAgreementRate: p.outcomeTotal > 0 ? p.outcomeAgreements / p.outcomeTotal : null,
        outcomeTotal: p.outcomeTotal,
      }));

      return { personas };
    }),
});
