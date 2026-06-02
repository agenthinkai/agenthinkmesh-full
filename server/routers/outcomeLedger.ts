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
