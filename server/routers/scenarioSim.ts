/**
 * scenarioSim.ts — tRPC Router for Strategic Scenario Simulation Mode v1.0
 *
 * Exposes procedures for:
 *   - startRun: kick off a simulation run (returns runId immediately)
 *   - getRunStatus: poll for progress and results
 *   - listRuns: list all simulation runs for a deal
 *   - cancelRun: pause/cancel a running simulation
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { scenarioSimRuns, scenarioSimTelemetry } from "../../drizzle/schema";
import { randomUUID } from "crypto";
import {
  SIMULATION_MODES,
  generateScenarioVariants,
  buildScenarioBrief,
  evaluateScenario,
  type SimulationMode,
} from "../scenarioMutationEngine";
import { aggregateSimulationResults } from "../scenarioAggregator";
import { invokeLLM } from "../_core/llm";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum scenarios to run synchronously in a single request (avoids timeout) */
const SYNC_LIMIT = 1000;

/** Chunk size for telemetry writes */
const TELEMETRY_CHUNK_SIZE = 100;

// ── Router ────────────────────────────────────────────────────────────────────

export const scenarioSimRouter = router({

  /**
   * Start a simulation run.
   * For modes <= 1000 scenarios: runs synchronously and returns full results.
   * For modes > 1000 scenarios: starts async, returns runId for polling.
   */
  startRun: protectedProcedure
    .input(z.object({
      dealId:   z.string().min(1).max(64),
      dealName: z.string().min(1).max(255),
      dealText: z.string().min(10).max(15000),
      mode:     z.enum(["quick", "institutional", "deep", "infrastructure", "extreme"]),
      // Safety controls for gated modes (100k / 1M)
      maxCostCapUsd:    z.number().optional(),
      maxWallClockHours: z.number().optional(),
      batchSize:        z.number().min(100).max(10000).optional(),
      confirmedGated:   z.boolean().optional(), // must be true for gated modes
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const modeConfig = SIMULATION_MODES[input.mode as SimulationMode];
      const runId = randomUUID();
      const baseSeed = Date.now();
      const targetCount = modeConfig.count;

      // Enforce gated mode confirmation BEFORE creating the run record
      if (modeConfig.gated && !input.confirmedGated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Mode '${input.mode}' requires explicit confirmation. Set confirmedGated: true after showing the user the warning modal.`,
        });
      }

      // Create run record
      await db.insert(scenarioSimRuns).values({
        runId,
        userId:      ctx.user.id,
        dealId:      input.dealId,
        dealName:    input.dealName,
        mode:        input.mode as "quick" | "institutional" | "deep" | "infrastructure" | "extreme",
        targetCount,
        completedCount: 0,
        status:      "running",
        baseSeed,
      });

      // For quick and institutional modes: run synchronously
      if (targetCount <= SYNC_LIMIT) {
        const startMs = Date.now();

        // Generate scenario variants
        const variants = generateScenarioVariants(targetCount, baseSeed);

        // Evaluate all variants
        const results = await Promise.all(
          variants.map(v => evaluateScenario(v, buildScenarioBrief(input.dealText, v), invokeLLM as any))
        );

        // Aggregate
        const aggregation = aggregateSimulationResults(results, runId, input.dealId, input.mode);
        const durationMs = Date.now() - startMs;

        // Persist results
        await db.update(scenarioSimRuns)
          .set({
            status:               "completed",
            completedCount:       targetCount,
            decisionDistribution: JSON.stringify(aggregation.decisionDistribution),
            failureVectors:       JSON.stringify(aggregation.failureVectors),
            approvalPathways:     JSON.stringify(aggregation.approvalPathways),
            governanceHeatmap:    JSON.stringify(aggregation.governanceHeatmap),
            sensitivitySurface:   JSON.stringify(aggregation.sensitivitySurface),
            executiveSummary:     aggregation.executiveSummary,
            durationMs,
            completedAt:          new Date(),
          })
          .where(eq(scenarioSimRuns.runId, runId));

        // Write telemetry
        await db.insert(scenarioSimTelemetry).values({
          runId,
          chunkIndex:       0,
          chunkSize:        targetCount,
          approveCount:     aggregation.decisionDistribution.approveCount,
          conditionalCount: aggregation.decisionDistribution.conditionalCount,
          rejectCount:      aggregation.decisionDistribution.rejectCount,
          hardNoCount:      aggregation.decisionDistribution.hardNoCount,
          durationMs,
        });

        return {
          runId,
          status: "completed" as const,
          mode: input.mode,
          targetCount,
          durationMs,
          aggregation,
        };
      }

      // For deep / infrastructure modes: return runId immediately
      // The client should poll getRunStatus. In production, a background job
      // would process this. For now, we run in chunks with a 180s budget.
      // Kick off background processing (fire-and-forget)
      runDeepSimulationBackground(
        runId,
        input.dealId,
        input.dealText,
        input.mode as SimulationMode,
        targetCount,
        baseSeed,
        db
      ).catch(err => {
        console.error(`[ScenarioSim] Background run failed for ${runId}:`, err);
      });

      return {
        runId,
        status: "running" as const,
        mode: input.mode,
        targetCount,
        durationMs: 0,
        aggregation: null,
      };
    }),

  /** Poll for run status and results */
  getRunStatus: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [run] = await db
        .select()
        .from(scenarioSimRuns)
        .where(
          and(
            eq(scenarioSimRuns.runId, input.runId),
            eq(scenarioSimRuns.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Simulation run not found" });

      const aggregation = run.status === "completed" ? {
        decisionDistribution: run.decisionDistribution ? JSON.parse(run.decisionDistribution) : null,
        failureVectors:       run.failureVectors       ? JSON.parse(run.failureVectors)       : null,
        approvalPathways:     run.approvalPathways     ? JSON.parse(run.approvalPathways)     : null,
        governanceHeatmap:    run.governanceHeatmap    ? JSON.parse(run.governanceHeatmap)    : null,
        sensitivitySurface:   run.sensitivitySurface   ? JSON.parse(run.sensitivitySurface)   : null,
        executiveSummary:     run.executiveSummary,
      } : null;

      return {
        runId:          run.runId,
        status:         run.status,
        mode:           run.mode,
        targetCount:    run.targetCount,
        completedCount: run.completedCount,
        progressPct:    Math.round((run.completedCount / run.targetCount) * 100),
        durationMs:     run.durationMs,
        createdAt:      run.createdAt,
        completedAt:    run.completedAt,
        aggregation,
      };
    }),

  /** List all simulation runs for a specific deal */
  listRunsForDeal: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const runs = await db
        .select({
          runId:          scenarioSimRuns.runId,
          mode:           scenarioSimRuns.mode,
          targetCount:    scenarioSimRuns.targetCount,
          completedCount: scenarioSimRuns.completedCount,
          status:         scenarioSimRuns.status,
          durationMs:     scenarioSimRuns.durationMs,
          createdAt:      scenarioSimRuns.createdAt,
          completedAt:    scenarioSimRuns.completedAt,
          executiveSummary: scenarioSimRuns.executiveSummary,
          // Return aggregation summary fields only (not full JSON blobs)
          decisionDistribution: scenarioSimRuns.decisionDistribution,
        })
        .from(scenarioSimRuns)
        .where(
          and(
            eq(scenarioSimRuns.dealId, input.dealId),
            eq(scenarioSimRuns.userId, ctx.user.id)
          )
        )
        .orderBy(desc(scenarioSimRuns.createdAt))
        .limit(10);

      return runs.map(r => ({
        ...r,
        decisionDistribution: r.decisionDistribution ? JSON.parse(r.decisionDistribution) : null,
      }));
    }),

  /** List all simulation runs for the current user (across all deals) */
  listAllRuns: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select({
          runId:          scenarioSimRuns.runId,
          dealId:         scenarioSimRuns.dealId,
          dealName:       scenarioSimRuns.dealName,
          mode:           scenarioSimRuns.mode,
          targetCount:    scenarioSimRuns.targetCount,
          completedCount: scenarioSimRuns.completedCount,
          status:         scenarioSimRuns.status,
          durationMs:     scenarioSimRuns.durationMs,
          createdAt:      scenarioSimRuns.createdAt,
          completedAt:    scenarioSimRuns.completedAt,
          executiveSummary: scenarioSimRuns.executiveSummary,
        })
        .from(scenarioSimRuns)
        .where(eq(scenarioSimRuns.userId, ctx.user.id))
        .orderBy(desc(scenarioSimRuns.createdAt))
        .limit(20);
    }),

  /** Check if a completed simulation exists for a deal (lightweight badge query) */
  hasCompletedSim: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { hasCompleted: false, runId: null as string | null, mode: null as string | null, completedAt: null as string | null };

      const [run] = await db
        .select({
          runId:       scenarioSimRuns.runId,
          mode:        scenarioSimRuns.mode,
          completedAt: scenarioSimRuns.completedAt,
        })
        .from(scenarioSimRuns)
        .where(
          and(
            eq(scenarioSimRuns.dealId, input.dealId),
            eq(scenarioSimRuns.userId, ctx.user.id),
            eq(scenarioSimRuns.status, "completed")
          )
        )
        .orderBy(desc(scenarioSimRuns.completedAt))
        .limit(1);

      return {
        hasCompleted: !!run,
        runId:        run?.runId ?? null,
        mode:         run?.mode ?? null,
        completedAt:  run?.completedAt ?? null,
      };
    }),

  /** Cancel / pause a running simulation */
  cancelRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.update(scenarioSimRuns)
        .set({ status: "paused" })
        .where(
          and(
            eq(scenarioSimRuns.runId, input.runId),
            eq(scenarioSimRuns.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});

// ── Background Simulation Runner ──────────────────────────────────────────────

/**
 * Runs a deep simulation in the background using chunked processing.
 * Writes telemetry after each chunk and updates the run record on completion.
 *
 * For 10k scenarios: ~10 chunks of 1000 each.
 * For 100k scenarios: ~100 chunks of 1000 each (long-running).
 */
async function runDeepSimulationBackground(
  runId: string,
  dealId: string,
  dealText: string,
  mode: SimulationMode,
  targetCount: number,
  baseSeed: number,
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  if (!db) return;

  const CHUNK = 1000;
  const chunks = Math.ceil(targetCount / CHUNK);
  const allResults: Awaited<ReturnType<typeof evaluateScenario>>[] = [];
  const startMs = Date.now();

  for (let c = 0; c < chunks; c++) {
    // Check if run was cancelled
    const [run] = await db
      .select({ status: scenarioSimRuns.status })
      .from(scenarioSimRuns)
      .where(eq(scenarioSimRuns.runId, runId))
      .limit(1);

    if (!run || run.status === "paused" || run.status === "failed") break;

    const chunkStart = c * CHUNK;
    const chunkSize = Math.min(CHUNK, targetCount - chunkStart);
    const chunkSeed = baseSeed + chunkStart;

    const variants = generateScenarioVariants(chunkSize, chunkSeed);
    const chunkMs = Date.now();

    const results = await Promise.all(
      variants.map(v => evaluateScenario(v, buildScenarioBrief(dealText, v), invokeLLM as any))
    );

    allResults.push(...results);

    // Write telemetry
    const approveCount     = results.filter(r => r.decision === "APPROVE").length;
    const conditionalCount = results.filter(r => r.decision === "CONDITIONAL").length;
    const rejectCount      = results.filter(r => r.decision === "REJECT").length;
    const hardNoCount      = results.filter(r => r.hasHardNo).length;

    await db.insert(scenarioSimTelemetry).values({
      runId,
      chunkIndex:       c,
      chunkSize,
      approveCount,
      conditionalCount,
      rejectCount,
      hardNoCount,
      durationMs: Date.now() - chunkMs,
    });

    // Update progress
    await db.update(scenarioSimRuns)
      .set({ completedCount: allResults.length })
      .where(eq(scenarioSimRuns.runId, runId));
  }

  // Aggregate and persist final results
  if (allResults.length > 0) {
    const aggregation = aggregateSimulationResults(allResults, runId, dealId, mode);
    const durationMs = Date.now() - startMs;

    await db.update(scenarioSimRuns)
      .set({
        status:               "completed",
        completedCount:       allResults.length,
        decisionDistribution: JSON.stringify(aggregation.decisionDistribution),
        failureVectors:       JSON.stringify(aggregation.failureVectors),
        approvalPathways:     JSON.stringify(aggregation.approvalPathways),
        governanceHeatmap:    JSON.stringify(aggregation.governanceHeatmap),
        sensitivitySurface:   JSON.stringify(aggregation.sensitivitySurface),
        executiveSummary:     aggregation.executiveSummary,
        durationMs,
        completedAt:          new Date(),
      })
      .where(eq(scenarioSimRuns.runId, runId));
  }
}
