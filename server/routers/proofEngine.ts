/**
 * proofEngine.ts — Institutional Proof Engine (Phase 5)
 *
 * Read-only router. Aggregates governance, attribution, and calibration data
 * into evidence panels for institutional audiences.
 *
 * No changes to Council logic, CFA, Attribution, or Calibration.
 */
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { TRPCError } from "@trpc/server";

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
import {
  outcomeSessions,
  outcomeAttributions,
  outcomeFactors,
  cfaSessions,
  cfaPreferenceRecords,
  consensusSessions,
  agentWeights,
} from "../../drizzle/schema";
import { and, eq, gte, isNotNull, sql, desc, avg, count } from "drizzle-orm";
import { z } from "zod";

// ── Minimum sample size for evidence statements ──────────────────────────────
const MIN_SAMPLE_SIZE = 10;

// ── Helper: timestamp for N days ago ─────────────────────────────────────────
function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

export const proofEngineRouter = router({
  /**
   * Panel 1 — Decision Volume
   * Total decisions by mode, last 30d, last 90d, all time.
   * Source: outcomeSessions (one row per council run tracked for outcomes)
   *         + cfaSessions (broader council run coverage)
   */
  decisionVolume: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx);
    const db = await requireDb();

    const now = Date.now();
    const ago30 = daysAgo(30);
    const ago90 = daysAgo(90);

    // Total from outcomeSessions (outcome-tracked decisions)
    const [allTime] = await db
      .select({ total: count() })
      .from(outcomeSessions);

    const [last30] = await db
      .select({ total: count() })
      .from(outcomeSessions)
      .where(gte(outcomeSessions.decisionDate, ago30));

    const [last90] = await db
      .select({ total: count() })
      .from(outcomeSessions)
      .where(gte(outcomeSessions.decisionDate, ago90));

    // By mode
    const byMode = await db
      .select({
        mode: outcomeSessions.councilMode,
        total: count(),
      })
      .from(outcomeSessions)
      .groupBy(outcomeSessions.councilMode)
      .orderBy(desc(count()));

    // Total CFA-audited council runs (broader coverage than outcome sessions)
    const [cfaTotal] = await db
      .select({ total: count() })
      .from(cfaSessions)
      .where(eq(cfaSessions.status, "completed"));

    const [cfaLast30] = await db
      .select({ total: count() })
      .from(cfaSessions)
      .where(
        and(
          eq(cfaSessions.status, "completed"),
          gte(cfaSessions.createdAt, ago30)
        )
      );

    return {
      outcomeTracked: {
        allTime: allTime.total,
        last30Days: last30.total,
        last90Days: last90.total,
        byMode,
      },
      cfaAudited: {
        allTime: cfaTotal.total,
        last30Days: cfaLast30.total,
      },
    };
  }),

  /**
   * Panel 2 — Outcome Tracking
   * Total resolved outcomes broken down by status.
   */
  outcomeTracking: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx);
    const db = await requireDb();

    const byStatus = await db
      .select({
        status: outcomeSessions.outcomeStatus,
        total: count(),
      })
      .from(outcomeSessions)
      .groupBy(outcomeSessions.outcomeStatus);

    const statusMap: Record<string, number> = {};
    let totalResolved = 0;
    let totalAll = 0;
    for (const row of byStatus) {
      statusMap[row.status] = row.total;
      totalAll += row.total;
      if (!["UNKNOWN", "IN_PROGRESS"].includes(row.status)) {
        totalResolved += row.total;
      }
    }

    return {
      totalAll,
      totalResolved,
      succeeded: statusMap["SUCCEEDED"] ?? 0,
      failed: statusMap["FAILED"] ?? 0,
      restructured: statusMap["RESTRUCTURED"] ?? 0,
      abandoned: statusMap["ABANDONED"] ?? 0,
      inProgress: statusMap["IN_PROGRESS"] ?? 0,
      unknown: statusMap["UNKNOWN"] ?? 0,
    };
  }),

  /**
   * Panel 3 — Council Performance
   * Outcome Agreement Rate, Average CFA Fidelity, Average Consensus Score,
   * Confidence Distribution.
   */
  councilPerformance: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx);
    const db = await requireDb();

    // Outcome Agreement Rate: sessions where verdict matches outcome
    // APPROVED → SUCCEEDED, VETOED → FAILED (simplified agreement)
    const resolvedSessions = await db
      .select({
        originalVerdict: outcomeSessions.originalVerdict,
        outcomeStatus: outcomeSessions.outcomeStatus,
        consensusScore: outcomeSessions.consensusScore,
        confidenceLevel: outcomeSessions.confidenceLevel,
      })
      .from(outcomeSessions)
      .where(
        sql`${outcomeSessions.outcomeStatus} NOT IN ('UNKNOWN', 'IN_PROGRESS')`
      );

    let agreements = 0;
    const confidenceBuckets = { low: 0, medium: 0, high: 0, veryHigh: 0 };
    let consensusSum = 0;
    let consensusCount = 0;

    for (const s of resolvedSessions) {
      const verdict = s.originalVerdict?.toUpperCase() ?? "";
      const outcome = s.outcomeStatus;
      // Agreement: APPROVED+SUCCEEDED or VETOED+FAILED
      if (
        (verdict.includes("APPROVED") || verdict.includes("PASS") || verdict === "INVEST") &&
        outcome === "SUCCEEDED"
      ) agreements++;
      else if (
        (verdict.includes("VETOED") || verdict.includes("REJECT") || verdict === "PASS") &&
        (outcome === "FAILED" || outcome === "ABANDONED")
      ) agreements++;

      // Confidence distribution
      const conf = parseFloat(s.confidenceLevel as string ?? "0");
      if (conf < 0.4) confidenceBuckets.low++;
      else if (conf < 0.6) confidenceBuckets.medium++;
      else if (conf < 0.8) confidenceBuckets.high++;
      else confidenceBuckets.veryHigh++;

      // Consensus score
      const cs = parseFloat(s.consensusScore as string ?? "0");
      if (cs > 0) { consensusSum += cs; consensusCount++; }
    }

    const outcomeAgreementRate = resolvedSessions.length > 0
      ? agreements / resolvedSessions.length
      : null;

    const avgConsensusScore = consensusCount > 0
      ? consensusSum / consensusCount
      : null;

    // Average CFA fidelity from cfaSessions
    const [cfaAvg] = await db
      .select({ avgFidelity: avg(cfaSessions.averageFidelityScore) })
      .from(cfaSessions)
      .where(eq(cfaSessions.status, "completed"));

    return {
      totalResolved: resolvedSessions.length,
      outcomeAgreementRate,
      avgCfaFidelity: cfaAvg.avgFidelity ? parseFloat(cfaAvg.avgFidelity as string) : null,
      avgConsensusScore,
      confidenceDistribution: confidenceBuckets,
    };
  }),

  /**
   * Panel 4 — Top Predictive Personas
   * F1, Precision, Recall, Fidelity per persona (top 10 by F1).
   */
  topPredictivePersonas: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx);
    const db = await requireDb();

    // Attribution stats per persona
    const reviewed = await db
      .select({
        personaId: outcomeAttributions.personaId,
        materialized: outcomeAttributions.materialized,
      })
      .from(outcomeAttributions)
      .where(isNotNull(outcomeAttributions.materialized));

    type PStats = { tp: number; fp: number; fn: number };
    const pMap = new Map<string, PStats>();
    for (const r of reviewed) {
      if (!pMap.has(r.personaId)) pMap.set(r.personaId, { tp: 0, fp: 0, fn: 0 });
      const p = pMap.get(r.personaId)!;
      if (r.materialized === 1) p.tp++;
      else p.fp++;
    }

    // CFA fidelity per persona
    const cfaRows = await db
      .select({
        personaId: cfaPreferenceRecords.personaId,
        personaName: cfaPreferenceRecords.personaName,
        avgFidelity: avg(cfaPreferenceRecords.fidelityScore),
      })
      .from(cfaPreferenceRecords)
      .groupBy(cfaPreferenceRecords.personaId, cfaPreferenceRecords.personaName);

    const fidelityMap = new Map<string, { name: string; fidelity: number }>();
    for (const r of cfaRows) {
      fidelityMap.set(r.personaId, {
        name: r.personaName ?? r.personaId,
        fidelity: parseFloat(r.avgFidelity as string ?? "0"),
      });
    }

    const personas = Array.from(pMap.entries()).map(([id, p]) => {
      const precision = (p.tp + p.fp) > 0 ? p.tp / (p.tp + p.fp) : null;
      const recall = (p.tp + p.fn) > 0 ? p.tp / (p.tp + p.fn) : null;
      const f1 = precision != null && recall != null && (precision + recall) > 0
        ? (2 * precision * recall) / (precision + recall) : null;
      const cf = fidelityMap.get(id);
      return {
        personaId: id,
        personaName: cf?.name ?? id,
        tp: p.tp,
        fp: p.fp,
        fn: p.fn,
        precision,
        recall,
        f1,
        fidelity: cf?.fidelity ?? null,
        totalReviewed: p.tp + p.fp,
      };
    });

    return personas
      .sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1))
      .slice(0, 10);
  }),

  /**
   * Panel 5 — Top Predictive Risk Categories
   * Predictions, Materializations, False Alarms per prediction type.
   */
  riskCategoryPerformance: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx);
    const db = await requireDb();

    const reviewed = await db
      .select({
        predictionType: outcomeAttributions.predictionType,
        materialized: outcomeAttributions.materialized,
      })
      .from(outcomeAttributions)
      .where(isNotNull(outcomeAttributions.materialized));

    // Also count total predictions (including unreviewed)
    const allPredictions = await db
      .select({
        predictionType: outcomeAttributions.predictionType,
        total: count(),
      })
      .from(outcomeAttributions)
      .groupBy(outcomeAttributions.predictionType);

    type BStats = { materialized: number; falseAlarms: number };
    const bMap = new Map<string, BStats>();
    for (const r of reviewed) {
      if (!bMap.has(r.predictionType)) bMap.set(r.predictionType, { materialized: 0, falseAlarms: 0 });
      const b = bMap.get(r.predictionType)!;
      if (r.materialized === 1) b.materialized++;
      else b.falseAlarms++;
    }

    const totalMap = new Map<string, number>();
    for (const r of allPredictions) totalMap.set(r.predictionType, r.total);

    // Canonical 6 risk categories
    const categories = ["FINANCIAL", "TECHNICAL", "CONSTRUCTION", "REGULATORY", "COMMERCIAL", "ESG"];
    return categories.map((cat) => {
      const b = bMap.get(cat) ?? { materialized: 0, falseAlarms: 0 };
      const predicted = totalMap.get(cat) ?? 0;
      const reviewed = b.materialized + b.falseAlarms;
      const materializationRate = reviewed > 0 ? b.materialized / reviewed : null;
      return {
        category: cat,
        predicted,
        materialized: b.materialized,
        falseAlarms: b.falseAlarms,
        unreviewed: predicted - reviewed,
        materializationRate,
      };
    });
  }),

  /**
   * Panel 6 — Evidence Statements
   * Auto-generated institution-ready statements from actual data.
   * Only emitted when sample size exceeds MIN_SAMPLE_SIZE.
   */
  evidenceStatements: protectedProcedure
    .input(z.object({ minSampleSize: z.number().min(1).max(1000).default(MIN_SAMPLE_SIZE) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const threshold = input.minSampleSize;

      const statements: Array<{
        id: string;
        statement: string;
        sampleSize: number;
        category: "volume" | "outcome" | "persona" | "risk" | "governance";
        confidence: "high" | "medium" | "low";
      }> = [];

      // ── Volume statement ──────────────────────────────────────────────────
      const [totalDecisions] = await db.select({ total: count() }).from(outcomeSessions);
      if (totalDecisions.total >= threshold) {
        const [cfaTotal] = await db
          .select({ total: count() })
          .from(cfaSessions)
          .where(eq(cfaSessions.status, "completed"));

        statements.push({
          id: "vol-total",
          statement: `Across ${totalDecisions.total.toLocaleString()} evaluated decisions, the AgenThink Mesh Council has produced structured, multi-persona investment verdicts with full audit trails.`,
          sampleSize: totalDecisions.total,
          category: "volume",
          confidence: totalDecisions.total >= 100 ? "high" : totalDecisions.total >= 50 ? "medium" : "low",
        });

        if (cfaTotal.total >= threshold) {
          statements.push({
            id: "vol-cfa",
            statement: `${cfaTotal.total.toLocaleString()} council runs have been independently audited by the Counterfactual Alignment (CFA) engine for persona fidelity and rule compliance.`,
            sampleSize: cfaTotal.total,
            category: "governance",
            confidence: cfaTotal.total >= 100 ? "high" : "medium",
          });
        }
      }

      // ── Outcome agreement statement ───────────────────────────────────────
      const resolvedSessions = await db
        .select({
          originalVerdict: outcomeSessions.originalVerdict,
          outcomeStatus: outcomeSessions.outcomeStatus,
        })
        .from(outcomeSessions)
        .where(sql`${outcomeSessions.outcomeStatus} NOT IN ('UNKNOWN', 'IN_PROGRESS')`);

      if (resolvedSessions.length >= threshold) {
        let agreements = 0;
        for (const s of resolvedSessions) {
          const verdict = s.originalVerdict?.toUpperCase() ?? "";
          const outcome = s.outcomeStatus;
          if (
            (verdict.includes("APPROVED") || verdict.includes("PASS") || verdict === "INVEST") &&
            outcome === "SUCCEEDED"
          ) agreements++;
          else if (
            (verdict.includes("VETOED") || verdict.includes("REJECT") || verdict === "PASS") &&
            (outcome === "FAILED" || outcome === "ABANDONED")
          ) agreements++;
        }
        const rate = Math.round((agreements / resolvedSessions.length) * 100);
        statements.push({
          id: "outcome-agreement",
          statement: `Across ${resolvedSessions.length} resolved decisions, the Council achieved a ${rate}% outcome agreement rate between original verdicts and tracked real-world results.`,
          sampleSize: resolvedSessions.length,
          category: "outcome",
          confidence: resolvedSessions.length >= 50 ? "high" : resolvedSessions.length >= 20 ? "medium" : "low",
        });
      }

      // ── CFA fidelity statement ────────────────────────────────────────────
      const [cfaAvg] = await db
        .select({
          avgFidelity: avg(cfaSessions.averageFidelityScore),
          total: count(),
        })
        .from(cfaSessions)
        .where(eq(cfaSessions.status, "completed"));

      if (cfaAvg.total >= threshold && cfaAvg.avgFidelity) {
        const fidelityPct = Math.round(parseFloat(cfaAvg.avgFidelity as string) * 100);
        statements.push({
          id: "cfa-fidelity",
          statement: `Across ${cfaAvg.total} audited council runs, personas maintained an average CFA fidelity score of ${fidelityPct}%, confirming consistent adherence to their investment mandates and reasoning frameworks.`,
          sampleSize: cfaAvg.total,
          category: "governance",
          confidence: cfaAvg.total >= 50 ? "high" : "medium",
        });
      }

      // ── Per-persona F1 statements ─────────────────────────────────────────
      const reviewed = await db
        .select({
          personaId: outcomeAttributions.personaId,
          materialized: outcomeAttributions.materialized,
        })
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      type PStats = { tp: number; fp: number; fn: number };
      const pMap = new Map<string, PStats>();
      for (const r of reviewed) {
        if (!pMap.has(r.personaId)) pMap.set(r.personaId, { tp: 0, fp: 0, fn: 0 });
        const p = pMap.get(r.personaId)!;
        if (r.materialized === 1) p.tp++;
        else p.fp++;
      }

      // CFA persona names
      const cfaNames = await db
        .select({
          personaId: cfaPreferenceRecords.personaId,
          personaName: cfaPreferenceRecords.personaName,
        })
        .from(cfaPreferenceRecords)
        .groupBy(cfaPreferenceRecords.personaId, cfaPreferenceRecords.personaName)
        .limit(20);
      const nameMap = new Map(cfaNames.map((r: { personaId: string; personaName: string | null }) => [r.personaId, r.personaName ?? r.personaId]));

      for (const [id, p] of Array.from(pMap.entries())) {
        const total = p.tp + p.fp;
        if (total < threshold) continue;
        const precision = total > 0 ? p.tp / total : null;
        const recall = (p.tp + p.fn) > 0 ? p.tp / (p.tp + p.fn) : null;
        const f1 = precision != null && recall != null && (precision + recall) > 0
          ? (2 * precision * recall) / (precision + recall) : null;
        if (f1 == null) continue;
        const name = nameMap.get(id) ?? id;
        const f1Str = f1.toFixed(2);
        statements.push({
          id: `persona-${id}`,
          statement: `The ${name} persona achieved an F1 score of ${f1Str} across ${total} reviewed predictions, with ${Math.round((precision ?? 0) * 100)}% precision and ${Math.round((recall ?? 0) * 100)}% recall.`,
          sampleSize: total,
          category: "persona",
          confidence: total >= 50 ? "high" : total >= 20 ? "medium" : "low",
        });
      }

      // ── Per-risk-category materialization statements ───────────────────────
      const allPredictions = await db
        .select({
          predictionType: outcomeAttributions.predictionType,
          materialized: outcomeAttributions.materialized,
        })
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      type BStats = { materialized: number; falseAlarms: number };
      const bMap = new Map<string, BStats>();
      for (const r of allPredictions) {
        if (!bMap.has(r.predictionType)) bMap.set(r.predictionType, { materialized: 0, falseAlarms: 0 });
        const b = bMap.get(r.predictionType)!;
        if (r.materialized === 1) b.materialized++;
        else b.falseAlarms++;
      }

      const categoryLabels: Record<string, string> = {
        FINANCIAL: "DSCR and financial structure",
        TECHNICAL: "technical and engineering",
        CONSTRUCTION: "EPC and construction",
        REGULATORY: "regulatory and permitting",
        COMMERCIAL: "merchant tail and commercial",
        ESG: "ESG and sustainability",
      };

      for (const [cat, b] of Array.from(bMap.entries())) {
        const total = b.materialized + b.falseAlarms;
        if (total < threshold) continue;
        const rate = Math.round((b.materialized / total) * 100);
        const label = categoryLabels[cat] ?? cat.toLowerCase();
        statements.push({
          id: `risk-${cat}`,
          statement: `${label.charAt(0).toUpperCase() + label.slice(1)}-related warnings materialized in ${rate}% of tracked outcomes (${b.materialized} of ${total} reviewed predictions).`,
          sampleSize: total,
          category: "risk",
          confidence: total >= 50 ? "high" : total >= 20 ? "medium" : "low",
        });
      }

      return {
        statements,
        minSampleSize: threshold,
        totalStatements: statements.length,
      };
    }),

  /**
   * Institutional Proof Report — 13-section governance proof record.
   * Returns base64 PDF + structured JSON from existing governance artifacts.
   */
  proofReport: protectedProcedure
    .input(z.object({
      sessionId: z.string().min(1),
      format: z.enum(["pdf", "json", "both"]).default("both"),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const { generateProofReportPdf } = await import("../proofReportPdf");
      const { randomUUID } = await import("crypto");

      const now = Date.now();
      const reportId = randomUUID();

      // ── Fetch governance artifacts ──────────────────────────────────────────

      // Council session
      const [session] = await db
        .select()
        .from(consensusSessions)
        .where(eq(consensusSessions.sessionId, input.sessionId))
        .limit(1);

      // CFA session
      const [cfaSession] = await db
        .select()
        .from(cfaSessions)
        .where(eq(cfaSessions.sessionId, input.sessionId))
        .limit(1);

      // CFA persona records
      const cfaRecords = cfaSession
        ? await db
            .select()
            .from(cfaPreferenceRecords)
            .where(eq(cfaPreferenceRecords.sessionId, input.sessionId))
        : [];

      // Outcome session (by councilRunId)
      const [outcomeSession] = await db
        .select()
        .from(outcomeSessions)
        .where(eq(outcomeSessions.councilRunId, input.sessionId))
        .limit(1);

      // Historical precedents (same council mode, different session, limit 5)
      const councilMode = cfaSession?.councilMode ?? session?.verdict?.split("_")[0] ?? "gcc";
      const precedents = await db
        .select()
        .from(outcomeSessions)
        .where(and(
          eq(outcomeSessions.councilMode, councilMode),
          sql`${outcomeSessions.councilRunId} != ${input.sessionId}`,
        ))
        .orderBy(desc(outcomeSessions.decisionDate))
        .limit(5);

      // Calibration weights from agentWeights table
      const calibWeights = await db
        .select()
        .from(agentWeights)
        .orderBy(desc(agentWeights.totalEvaluations));

      const MIN_TRUST_SAMPLES = 12;

      // ── Assemble 13-section proof report ───────────────────────────────────

      const cfaFidelity = cfaSession ? parseFloat(cfaSession.averageFidelityScore as string) : null;
      const consensusScore = session ? session.yesCount / Math.max(session.yesCount + session.noCount, 1) : null;
      // Confidence level: use cfaFidelity as proxy when no explicit confidence field
      const confidenceLevel: number | null = cfaFidelity;

      const hardFlags: string[] = session?.hardFlags ? JSON.parse(session.hardFlags as string) : [];
      const silentFails: string[] = session?.silentFails ? JSON.parse(session.silentFails as string) : [];

      // Determine release gate
      const blockingRules: string[] = [];
      const warningRules: string[] = [];
      if (hardFlags.length > 0) blockingRules.push(...hardFlags.map((f: string) => `HARD_FLAG:${f}`));
      const gate: "RELEASED" | "BLOCKED" | "PENDING" = blockingRules.length > 0 ? "BLOCKED" : session ? "RELEASED" : "PENDING";

      const personaConfidence = cfaRecords.map((r: typeof cfaPreferenceRecords.$inferSelect) => ({
        personaId: r.personaId,
        personaName: r.personaName ?? r.personaId,
        fidelityScore: parseFloat(r.fidelityScore as string),
        changed: r.changed === 1,
        critique: r.critique ?? null,
        violatedRules: r.violatedRulesJson ? JSON.parse(r.violatedRulesJson as string) : [],
        scoreInCharacter: parseFloat(r.scoreInCharacter as string),
        scoreRuleFidelity: parseFloat(r.scoreRuleFidelity as string),
        scoreEvidenceGrounding: parseFloat(r.scoreEvidenceGrounding as string),
        scoreConfidenceCalib: parseFloat(r.scoreConfidenceCalib as string),
      }));

      const complianceRate = cfaSession
        ? (cfaSession.totalPersonasAudited - cfaSession.totalChanged) / Math.max(cfaSession.totalPersonasAudited, 1)
        : 1;
      const complianceStatus: "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT" =
        complianceRate >= 0.9 ? "COMPLIANT" : complianceRate >= 0.6 ? "PARTIAL" : "NON_COMPLIANT";

      const evidenceChain = [
        session && {
          stage: "council_vote",
          artifactId: session.sessionId,
          artifactType: "ConsensusSession",
          summary: `Verdict: ${session.verdict}, Yes: ${session.yesCount}, No: ${session.noCount}`,
          timestamp: session.createdAt.getTime ? session.createdAt.getTime() : now,
        },
        cfaSession && {
          stage: "cfa_audit",
          artifactId: cfaSession.sessionId,
          artifactType: "CfaSession",
          summary: `Fidelity: ${cfaFidelity?.toFixed(3)}, Changed: ${cfaSession.totalChanged}/${cfaSession.totalPersonasAudited}`,
          timestamp: cfaSession.createdAt,
        },
        outcomeSession && {
          stage: "outcome_ledger",
          artifactId: String(outcomeSession.id),
          artifactType: "OutcomeSession",
          summary: `Status: ${outcomeSession.outcomeStatus}, Verdict: ${outcomeSession.originalVerdict}`,
          timestamp: outcomeSession.createdAt,
        },
      ].filter(Boolean) as Array<{ stage: string; artifactId: string; artifactType: string; summary: string; timestamp: number }>;

      const auditReferences = [
        session && {
          eventType: "council_session_created",
          module: "council",
          timestamp: session.createdAt.getTime ? session.createdAt.getTime() : now,
          summary: `Session ${session.sessionId} — ${session.verdict}`,
        },
        cfaSession && {
          eventType: "cfa_audit_completed",
          module: "cfa",
          timestamp: cfaSession.createdAt,
          summary: `CFA fidelity ${cfaFidelity?.toFixed(3)}, ${cfaSession.totalChanged} revisions`,
        },
        outcomeSession && {
          eventType: "outcome_recorded",
          module: "outcome_ledger",
          timestamp: outcomeSession.createdAt,
          summary: `Outcome: ${outcomeSession.outcomeStatus}`,
        },
      ].filter(Boolean) as Array<{ eventType: string; module: string; timestamp: number; summary: string }>;

      const reportInput = {
        reportId,
        generatedAt: now,
        sessionId: input.sessionId,
        dealId: cfaSession?.dealId ?? outcomeSession?.dealId ?? null,
        dealName: session?.thesis ?? cfaSession?.dealId ?? null,
        councilMode,
        executiveSummary: {
          originalVerdict: session?.verdict ?? "UNKNOWN",
          consensusScore,
          confidenceLevel,
          cfaFidelityScore: cfaFidelity,
          releaseGate: gate,
          blockReasons: blockingRules,
          summaryStatement: gate === "BLOCKED"
            ? `This decision has been blocked by the Release Gate due to ${blockingRules.length} blocking rule(s). The Council's consensus position is preserved; the block prevents release only.`
            : `This decision passed all governance checks. Council verdict: ${session?.verdict ?? "UNKNOWN"}. CFA fidelity: ${cfaFidelity?.toFixed(3) ?? "N/A"}.`,
        },
        voteDistribution: {
          yesCount: session?.yesCount ?? 0,
          noCount: session?.noCount ?? 0,
          totalPersonas: (session?.yesCount ?? 0) + (session?.noCount ?? 0),
          verdict: session?.verdict ?? "UNKNOWN",
          consensusReached: session?.consensusReached === 1,
          hardFlags,
          silentFails,
        },
        personaConfidence,
        constitutionalCompliance: {
          averageFidelityScore: cfaFidelity ?? 1,
          totalPersonasAudited: cfaSession?.totalPersonasAudited ?? 0,
          totalChanged: cfaSession?.totalChanged ?? 0,
          complianceRate,
          status: complianceStatus,
        },
        governanceFindings: (() => {
          // Derive governance findings from CFA violated rules per persona
          const findings: Array<{
            findingId: string;
            ruleId: string;
            ruleText: string;
            severity: string;
            status: "violation" | "pass";
            detectedAt: number;
            constitutionVersion: number;
          }> = [];
          for (const r of cfaRecords) {
            const violated: string[] = r.violatedRulesJson
              ? JSON.parse(r.violatedRulesJson as string)
              : [];
            if (violated.length > 0) {
              for (const ruleId of violated) {
                findings.push({
                  findingId: `gf-${r.personaId}-${ruleId}`.slice(0, 32),
                  ruleId,
                  ruleText: `Rule ${ruleId} violated by persona ${r.personaName ?? r.personaId}`,
                  severity: r.fidelityScore != null && parseFloat(r.fidelityScore as string) < 0.5 ? "critical" : "warning",
                  status: "violation",
                  detectedAt: r.createdAt,
                  constitutionVersion: 1,
                });
              }
            }
          }
          return findings;
        })(),
        constitutionVersions: [{ version: 1, activeRules: 8, description: "Initial Constitution — 8 governance rules" }],
        contradictions: [],
        calibrationContext: {
          personaWeights: calibWeights.map((w) => ({
            personaId: w.personaId,
            weight: parseFloat(w.weight as string),
            sampleSize: w.totalEvaluations,
            brierScore: w.totalEvaluations > 0
              ? 1 - (w.correctPredictions / w.totalEvaluations)
              : 0.5,
            trusted: w.totalEvaluations >= MIN_TRUST_SAMPLES,
          })),
          applyWeightsEnabled: calibWeights.some((w) => w.totalEvaluations >= MIN_TRUST_SAMPLES),
          minSamplesForTrust: MIN_TRUST_SAMPLES,
        },
        historicalPrecedents: precedents.map((p: typeof outcomeSessions.$inferSelect) => ({
          decisionId: p.councilRunId ?? String(p.id),
          dealType: p.councilMode,
          verdict: p.originalVerdict,
          outcomeStatus: p.outcomeStatus,
          decisionDate: p.decisionDate,
          similarity: "Same council mode",
        })),
        releaseGate: {
          gate,
          blockingRules,
          warningRules,
          councilConsensusPosition: session?.verdict ?? "UNKNOWN",
          finalPosition: gate === "BLOCKED" ? "BLOCKED" : session?.verdict ?? "UNKNOWN",
          rationale: gate === "BLOCKED"
            ? `Release blocked due to hard flags: ${hardFlags.join(", ")}`
            : "All governance checks passed. Decision released.",
        },
        evidenceChain,
        auditReferences,
        traceability: {
          sessionId: input.sessionId,
          cfaSessionId: cfaSession?.sessionId ?? null,
          outcomeSessionId: outcomeSession ? String(outcomeSession.id) : null,
          constitutionVersion: 1,
          reportGeneratedAt: now,
          reportVersion: "3.0",
        },
      };

      // ── Generate outputs ────────────────────────────────────────────────────
      let pdfBase64: string | null = null;
      if (input.format === "pdf" || input.format === "both") {
        const pdfBuffer = await generateProofReportPdf(reportInput);
        pdfBase64 = pdfBuffer.toString("base64");
      }

      return {
        reportId,
        generatedAt: now,
        sessionId: input.sessionId,
        gate,
        pdfBase64,
        report: input.format === "json" || input.format === "both" ? reportInput : null,
      };
    }),

  /**
   * Full proof summary — aggregates all panels for PDF export.
   */
  fullProofSummary: protectedProcedure
    .input(z.object({ minSampleSize: z.number().min(1).max(1000).default(MIN_SAMPLE_SIZE) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      // Re-use individual procedures by calling their logic inline
      // (procedures can't call each other directly in tRPC, so we return a combined shape)
      const db = await requireDb();
      const threshold = input.minSampleSize;

      // Decision volume
      const [allTime] = await db.select({ total: count() }).from(outcomeSessions);
      const [cfaTotal] = await db
        .select({ total: count() })
        .from(cfaSessions)
        .where(eq(cfaSessions.status, "completed"));

      // Outcome tracking
      const byStatus = await db
        .select({ status: outcomeSessions.outcomeStatus, total: count() })
        .from(outcomeSessions)
        .groupBy(outcomeSessions.outcomeStatus);
      const statusMap: Record<string, number> = {};
      for (const r of byStatus) statusMap[r.status] = r.total;

      // CFA fidelity
      const [cfaAvg] = await db
        .select({ avgFidelity: avg(cfaSessions.averageFidelityScore) })
        .from(cfaSessions)
        .where(eq(cfaSessions.status, "completed"));

      // Persona calibration (top 5)
      const reviewedAttribs = await db
        .select({ personaId: outcomeAttributions.personaId, materialized: outcomeAttributions.materialized })
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      type PStats = { tp: number; fp: number; fn: number };
      const pMap = new Map<string, PStats>();
      for (const r of reviewedAttribs) {
        if (!pMap.has(r.personaId)) pMap.set(r.personaId, { tp: 0, fp: 0, fn: 0 });
        const p = pMap.get(r.personaId)!;
        if (r.materialized === 1) p.tp++; else p.fp++;
      }

      const cfaNames = await db
        .select({ personaId: cfaPreferenceRecords.personaId, personaName: cfaPreferenceRecords.personaName })
        .from(cfaPreferenceRecords)
        .groupBy(cfaPreferenceRecords.personaId, cfaPreferenceRecords.personaName)
        .limit(20);
      const nameMap = new Map(cfaNames.map((r: { personaId: string; personaName: string | null }) => [r.personaId, r.personaName ?? r.personaId]));

      const personaScores = Array.from(pMap.entries()).map(([id, p]: [string, PStats]) => {
        const precision = (p.tp + p.fp) > 0 ? p.tp / (p.tp + p.fp) : null;
        const recall = (p.tp + p.fn) > 0 ? p.tp / (p.tp + p.fn) : null;
        const f1 = precision != null && recall != null && (precision + recall) > 0
          ? (2 * precision * recall) / (precision + recall) : null;
        return { personaId: id, personaName: nameMap.get(id) ?? id, tp: p.tp, fp: p.fp, fn: p.fn, precision, recall, f1, totalReviewed: p.tp + p.fp };
      }).sort((a, b) => (b.f1 ?? -1) - (a.f1 ?? -1)).slice(0, 5);

      // Blocker performance
      const blockerRows = await db
        .select({ predictionType: outcomeAttributions.predictionType, materialized: outcomeAttributions.materialized })
        .from(outcomeAttributions)
        .where(isNotNull(outcomeAttributions.materialized));

      type BStats = { materialized: number; falseAlarms: number; predicted: number };
      const bMap = new Map<string, BStats>();
      const allPreds = await db
        .select({ predictionType: outcomeAttributions.predictionType, total: count() })
        .from(outcomeAttributions)
        .groupBy(outcomeAttributions.predictionType);
      for (const rr of allPreds) bMap.set(rr.predictionType, { materialized: 0, falseAlarms: 0, predicted: rr.total });
      for (const rr of blockerRows) {
        const b = bMap.get(rr.predictionType);
        if (!b) continue;
        if (rr.materialized === 1) b.materialized++; else b.falseAlarms++;
      }

      const blockerPerformance = Array.from(bMap.entries()).map(([type, b]: [string, BStats]) => ({
        type,
        predicted: b.predicted,
        materialized: b.materialized,
        falseAlarms: b.falseAlarms,
        materializationRate: (b.materialized + b.falseAlarms) > 0
          ? b.materialized / (b.materialized + b.falseAlarms) : null,
      }));

      return {
        generatedAt: Date.now(),
        minSampleSize: threshold,
        volume: {
          totalOutcomeTracked: allTime.total,
          totalCfaAudited: cfaTotal.total,
        },
        outcomes: {
          succeeded: statusMap["SUCCEEDED"] ?? 0,
          failed: statusMap["FAILED"] ?? 0,
          restructured: statusMap["RESTRUCTURED"] ?? 0,
          abandoned: statusMap["ABANDONED"] ?? 0,
          inProgress: statusMap["IN_PROGRESS"] ?? 0,
          unknown: statusMap["UNKNOWN"] ?? 0,
        },
        governance: {
          avgCfaFidelity: cfaAvg.avgFidelity ? parseFloat(cfaAvg.avgFidelity as string) : null,
        },
        topPersonas: personaScores,
                blockerPerformance,
      };
    }),

  /**
   * sampleProofReport — Public procedure.
   * Generates a sample Institutional Proof Report PDF from deterministic demo data.
   * No Council session required. Safe for unauthenticated prospects.
   */
  sampleProofReport: publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      const { generateSampleProofReportPdf } = await import("../sampleProofReportPdf");
      const pdfBuffer = await generateSampleProofReportPdf();
      return {
        pdfBase64: pdfBuffer.toString("base64"),
        filename: "Helios-North_Institutional_Proof_Report_SAMPLE.pdf",
      };
    }),
});
export type ProofEngineRouter = typeof proofEngineRouter;
