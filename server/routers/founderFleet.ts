/**
 * founderFleet.ts — tRPC router for FounderAgent Fleet
 *
 * Procedures (all admin-only):
 *   fleet.start        — create a new run and launch orchestration in background
 *   fleet.pause        — signal the running fleet to pause
 *   fleet.resume       — resume a paused fleet
 *   fleet.abort        — abort the current run
 *   fleet.status       — poll the current run status + live counters
 *   fleet.runs         — list all runs (for history dropdown)
 *   fleet.runDetail    — full detail for a specific run (ideas + evals)
 *   fleet.insights     — pattern extraction insights for a run
 *   fleet.exportCsv    — export all evaluations for a run as CSV rows
 *   fleet.trendStats   — cross-run trend analytics (avg score by domain over time)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  founderAgentRuns,
  founderAgentIdeas,
  founderAgentPitches,
  founderAgentEvaluations,
  founderAgentInsights,
  founderAgentRunCosts,
  FounderAgentRun,
  FounderAgentIdea,
  FounderAgentPitch,
  FounderAgentEvaluation,
} from "../../drizzle/schema";

import {
  runFleet,
  pauseFleet,
  resumeFleet,
  abortFleet,
  getFleetState,
  type FleetOptions,
} from "../founderFleet";

export const fleetRouter = router({
  // ── Start a new fleet run ─────────────────────────────────────────────────
  start: adminProcedure
    .input(z.object({ label: z.string().optional(), quickTest: z.boolean().optional() }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const runDate = new Date().toISOString().slice(0, 10);
      const result = await db.insert(founderAgentRuns).values({
        runDate,
        status: "pending",
        totalIdeas: 0,
        completed: 0,
        queued: 0,
        running: 0,
        totalSearches: 0,
        totalLlmCalls: 0,
        estimatedTokens: 0,
        estimatedCostUsd: "0.0000",
      });

      const runId = (result as unknown as [{ insertId: number }])[0]?.insertId;
      if (!runId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create run" });

      // Launch in background — do not await
      const fleetOpts: FleetOptions = { quickTest: input?.quickTest ?? false };
      runFleet(runId, fleetOpts).catch((err) =>
        console.error(`[FleetRouter] Run ${runId} failed:`, err)
      );

      return { runId };
    }),

  // ── Pause a running fleet ─────────────────────────────────────────────────
  pause: adminProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      pauseFleet(input.runId);
      return { success: true };
    }),

  // ── Resume a paused fleet ─────────────────────────────────────────────────
  resume: adminProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.select().from(founderAgentRuns)
        .where(eq(founderAgentRuns.id, input.runId)).limit(1);
      const run = rows[0] as FounderAgentRun | undefined;

      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

      const state = getFleetState(input.runId);
      if (state) {
        // In-memory state exists — just unpause
        resumeFleet(input.runId);
      } else {
        // Server restarted — re-launch from current DB state
        runFleet(input.runId).catch((err) =>
          console.error(`[FleetRouter] Resume of run ${input.runId} failed:`, err)
        );
      }

      return { success: true };
    }),

  // ── Abort a fleet run ─────────────────────────────────────────────────────
  abort: adminProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      abortFleet(input.runId);
      return { success: true };
    }),

  // ── Poll current run status ───────────────────────────────────────────────
  status: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.select().from(founderAgentRuns)
        .where(eq(founderAgentRuns.id, input.runId)).limit(1);
      const run = rows[0] as FounderAgentRun | undefined;
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

      // Recent evaluations for live card feed (last 10 completed)
      const recentEvals: Array<{
        eval: FounderAgentEvaluation;
        idea: FounderAgentIdea;
        pitch: FounderAgentPitch;
      }> = await db.select({
        eval: founderAgentEvaluations,
        idea: founderAgentIdeas,
        pitch: founderAgentPitches,
      })
        .from(founderAgentEvaluations)
        .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
        .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
        .where(and(
          eq(founderAgentEvaluations.runId, input.runId),
          eq(founderAgentEvaluations.status, "completed"),
        ))
        .orderBy(desc(founderAgentEvaluations.updatedAt))
        .limit(10) as Array<{
          eval: FounderAgentEvaluation;
          idea: FounderAgentIdea;
          pitch: FounderAgentPitch;
        }>;

      // Domain breakdown
      const domainBreakdown: Record<string, { count: number; avgScore: number; engage: number; watch: number; pass: number }> = {};
      const allEvals: Array<{
        eval: FounderAgentEvaluation;
        idea: FounderAgentIdea;
      }> = await db.select({
        eval: founderAgentEvaluations,
        idea: founderAgentIdeas,
      })
        .from(founderAgentEvaluations)
        .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
        .where(and(
          eq(founderAgentEvaluations.runId, input.runId),
          eq(founderAgentEvaluations.status, "completed"),
        )) as Array<{ eval: FounderAgentEvaluation; idea: FounderAgentIdea }>;

      for (const { eval: e, idea } of allEvals) {
        const domain = idea.domain;
        if (!domainBreakdown[domain]) {
          domainBreakdown[domain] = { count: 0, avgScore: 0, engage: 0, watch: 0, pass: 0 };
        }
        const d = domainBreakdown[domain];
        d.count++;
        d.avgScore = Math.round(((d.avgScore * (d.count - 1)) + (e.finalScore ?? 0)) / d.count);
        if (e.classification === "ENGAGE") d.engage++;
        else if (e.classification === "WATCH") d.watch++;
        else d.pass++;
      }

      return {
        run,
        recentEvals: recentEvals.map(({ eval: e, idea, pitch }) => ({
          id: e.id,
          ideaId: idea.id,
          domain: idea.domain,
          subSector: idea.subSector,
          founderName: idea.founderName,
          targetRegion: idea.targetRegion,
          fundingStage: idea.fundingStage,
          classification: e.classification,
          finalScore: e.finalScore,
          executionScore: e.executionScore,
          marketScore: e.marketScore,
          recommendedAction: e.recommendedAction,
          strengths: JSON.parse(e.strengths ?? "[]") as string[],
          concerns: JSON.parse(e.concerns ?? "[]") as string[],
          flags: JSON.parse(e.flags ?? "[]") as string[],
          summary3s: pitch.summary3s,
          updatedAt: e.updatedAt,
        })),
        domainBreakdown,
        inMemoryState: getFleetState(input.runId) ?? null,
      };
    }),

  // ── List all runs (history dropdown) ─────────────────────────────────────
  runs: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const runs = await db.select().from(founderAgentRuns)
      .orderBy(desc(founderAgentRuns.createdAt))
      .limit(50);
    return runs as FounderAgentRun[];
  }),

  // ── Full detail for a specific run (filterable table) ─────────────────────
  runDetail: adminProcedure
    .input(z.object({
      runId: z.number(),
      domain: z.string().optional(),
      classification: z.enum(["ENGAGE", "WATCH", "PASS"]).optional(),
      minScore: z.number().optional(),
      maxScore: z.number().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      type EvalDetailRow = {
        eval: FounderAgentEvaluation;
        idea: FounderAgentIdea;
        pitch: FounderAgentPitch;
      };

      const rows: EvalDetailRow[] = await db.select({
        eval: founderAgentEvaluations,
        idea: founderAgentIdeas,
        pitch: founderAgentPitches,
      })
        .from(founderAgentEvaluations)
        .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
        .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
        .where(eq(founderAgentEvaluations.runId, input.runId))
        .orderBy(desc(founderAgentEvaluations.finalScore))
        .limit(input.limit)
        .offset(input.offset) as EvalDetailRow[];

      // Client-side filter (small dataset, max 100 rows per page)
      const filtered = rows.filter(({ eval: e, idea }) => {
        if (input.domain && idea.domain !== input.domain) return false;
        if (input.classification && e.classification !== input.classification) return false;
        if (input.minScore !== undefined && (e.finalScore ?? 0) < input.minScore) return false;
        if (input.maxScore !== undefined && (e.finalScore ?? 0) > input.maxScore) return false;
        return true;
      });

      return filtered.map(({ eval: e, idea, pitch }) => ({
        evalId: e.id,
        ideaId: idea.id,
        domain: idea.domain,
        subSector: idea.subSector,
        founderName: idea.founderName,
        targetRegion: idea.targetRegion,
        fundingStage: idea.fundingStage,
        fundingAsk: idea.fundingAsk,
        description: idea.description,
        status: e.status,
        classification: e.classification,
        classificationScore: e.classificationScore,
        executionScore: e.executionScore,
        marketScore: e.marketScore,
        finalScore: e.finalScore,
        recommendedAction: e.recommendedAction,
        strengths: JSON.parse(e.strengths ?? "[]") as string[],
        concerns: JSON.parse(e.concerns ?? "[]") as string[],
        flags: JSON.parse(e.flags ?? "[]") as string[],
        agentDisagreements: JSON.parse(e.agentDisagreements ?? "[]") as string[],
        problem: pitch.problem,
        solution: pitch.solution,
        targetMarket: pitch.targetMarket,
        businessModel: pitch.businessModel,
        competitiveAdvantage: pitch.competitiveAdvantage,
        keyRisk: pitch.keyRisk,
        summary3s: pitch.summary3s,
        durationMs: e.durationMs,
        updatedAt: e.updatedAt,
      }));
    }),

  // ── Pattern extraction insights ───────────────────────────────────────────
  insights: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.select().from(founderAgentInsights)
        .where(eq(founderAgentInsights.runId, input.runId)).limit(1);
      const row = rows[0];
      if (!row) return null;

      return {
        highScorePatterns:      JSON.parse(row.highScorePatterns ?? "[]") as string[],
        lowScorePatterns:       JSON.parse(row.lowScorePatterns ?? "[]") as string[],
        failureReasons:         JSON.parse(row.failureReasons ?? "[]") as string[],
        domainComparison:       JSON.parse(row.domainComparison ?? "{}") as Record<string, { avgScore: number; count: number; topConcern: string }>,
        improvementSuggestions: JSON.parse(row.improvementSuggestions ?? "[]") as string[],
        idealPitchStructure:    row.idealPitchStructure ?? "",
        createdAt:              row.createdAt,
      };
    }),

  // ── Export all evaluations as CSV rows ────────────────────────────────────
  exportCsv: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      type ExportRow = {
        eval: FounderAgentEvaluation;
        idea: FounderAgentIdea;
        pitch: FounderAgentPitch;
      };

      const rows: ExportRow[] = await db.select({
        eval: founderAgentEvaluations,
        idea: founderAgentIdeas,
        pitch: founderAgentPitches,
      })
        .from(founderAgentEvaluations)
        .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
        .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
        .where(eq(founderAgentEvaluations.runId, input.runId))
        .orderBy(desc(founderAgentEvaluations.finalScore)) as ExportRow[];

      const escape = (v: unknown): string => {
        const s = String(v ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const header = [
        "Domain", "Sub-Sector", "Founder Name", "Target Region", "Funding Stage", "Funding Ask",
        "Classification", "Final Score", "Execution Score", "Market Score",
        "Recommended Action", "Problem", "Solution", "Target Market",
        "Business Model", "Competitive Advantage", "Key Risk",
        "Top Strength", "Top Concern", "Top Flag", "Summary (3 sentences)",
        "Eval Status", "Duration (ms)",
      ].map(escape).join(",");

      const csvRows = rows.map(({ eval: e, idea, pitch }) => {
        const strengths = JSON.parse(e.strengths ?? "[]") as string[];
        const concerns  = JSON.parse(e.concerns  ?? "[]") as string[];
        const flags     = JSON.parse(e.flags     ?? "[]") as string[];
        return [
          idea.domain, idea.subSector, idea.founderName, idea.targetRegion,
          idea.fundingStage, idea.fundingAsk,
          e.classification ?? "", e.finalScore ?? "", e.executionScore ?? "", e.marketScore ?? "",
          e.recommendedAction ?? "",
          pitch.problem, pitch.solution, pitch.targetMarket,
          pitch.businessModel, pitch.competitiveAdvantage, pitch.keyRisk,
          strengths[0] ?? "", concerns[0] ?? "", flags[0] ?? "",
          pitch.summary3s,
          e.status, e.durationMs ?? "",
        ].map(escape).join(",");
      });

      return { csv: [header, ...csvRows].join("\n"), count: rows.length };
    }),

  // ── Cross-run trend analytics ─────────────────────────────────────────────
  trendStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { runs: [], domainTrends: {} };

    const runs = await db.select({
      id: founderAgentRuns.id,
      runDate: founderAgentRuns.runDate,
      status: founderAgentRuns.status,
      completed: founderAgentRuns.completed,
      totalIdeas: founderAgentRuns.totalIdeas,
      estimatedCostUsd: founderAgentRuns.estimatedCostUsd,
      createdAt: founderAgentRuns.createdAt,
      completedAt: founderAgentRuns.completedAt,
    })
      .from(founderAgentRuns)
      .where(eq(founderAgentRuns.status, "completed"))
      .orderBy(desc(founderAgentRuns.createdAt))
      .limit(30);

    if (runs.length === 0) return { runs, domainTrends: {} };

    // Aggregate avg score per domain per run
    const runIds = runs.map((r: { id: number }) => r.id);
    const domainScores: Array<{ runId: number; domain: string; avgScore: number; count: number }> = [];

    for (const runId of runIds) {
      type DomainRow = { domain: string; avgScore: number; cnt: number };
      const rows: DomainRow[] = await db.select({
        domain: founderAgentIdeas.domain,
        avgScore: sql<number>`AVG(${founderAgentEvaluations.finalScore})`,
        cnt: sql<number>`COUNT(*)`,
      })
        .from(founderAgentEvaluations)
        .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
        .where(and(
          eq(founderAgentEvaluations.runId, runId),
          eq(founderAgentEvaluations.status, "completed"),
        ))
        .groupBy(founderAgentIdeas.domain) as DomainRow[];

      for (const r of rows) {
        domainScores.push({ runId, domain: r.domain, avgScore: Math.round(r.avgScore), count: r.cnt });
      }
    }

    // Group by domain → array of { runId, avgScore } for trend lines
    const domainTrends: Record<string, Array<{ runId: number; avgScore: number; count: number }>> = {};
    for (const ds of domainScores) {
      if (!domainTrends[ds.domain]) domainTrends[ds.domain] = [];
      domainTrends[ds.domain].push({ runId: ds.runId, avgScore: ds.avgScore, count: ds.count });
    }

    return { runs, domainTrends };
  }),

  // ── Get run cost breakdown ────────────────────────────────────────────────
  runCosts: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(founderAgentRunCosts)
        .where(eq(founderAgentRunCosts.runId, input.runId)).limit(1);
      return rows[0] ?? null;
    }),
});
