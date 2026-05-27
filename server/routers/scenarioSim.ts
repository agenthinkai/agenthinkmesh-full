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
import { scenarioSimRuns, scenarioSimTelemetry, simulationFingerprints } from "../../drizzle/schema";
import { computeSimulationFingerprint } from "../simulationFingerprintEngine";
import { randomUUID } from "crypto";
import {
  SIMULATION_MODES,
  generateScenarioVariants,
  buildScenarioBrief,
  evaluateScenario,
  type SimulationMode,
  type ScenarioEvalResult,
} from "../scenarioMutationEngine";
import { aggregateSimulationResults, type SimulationAggregation } from "../scenarioAggregator";
import { invokeLLM } from "../_core/llm";

// ── Fingerprint persistence helper ───────────────────────────────────────────

async function persistFingerprint(
  db: Awaited<ReturnType<typeof getDb>>,
  aggregation: SimulationAggregation,
  results: ScenarioEvalResult[],
  meta: {
    councilMode: string | null;
    dealName: string;
    isUpgradedScenario: boolean;
    originalRunId: string | null;
    originalVerdict: string | null;
    upgradedVerdict: string | null;
    originalApprovePct: number | null;
  }
): Promise<void> {
  if (!db) return;
  const fp = computeSimulationFingerprint({ aggregation, results, ...meta });
  await db.insert(simulationFingerprints).values({
    runId:                    fp.runId,
    dealId:                   fp.dealId,
    dealName:                 fp.sourceDealName,
    councilMode:              fp.councilMode ?? null,
    scenarioCount:            fp.scenarioCount,
    simulationMode:           fp.simulationMode,
    approvePct:               fp.approvePct,
    conditionalPct:           fp.conditionalPct,
    rejectPct:                fp.rejectPct,
    vetoPct:                  fp.vetoPct,
    rescuedConditionalPct:    fp.rescuedConditionalPct,
    finalRejectedPct:         fp.finalRejectedPct,
    attributionUnavailablePct: fp.attributionUnavailablePct,
    rescueabilityScore:           fp.rescueabilityScore ?? null,
    vetoConcentrationScore:       fp.vetoConcentrationScore ?? null,
    structuralFragilityScore:     fp.structuralFragilityScore ?? null,
    scenarioEntropy:              fp.scenarioEntropy ?? null,
    councilDisagreementScore:     fp.councilDisagreementScore ?? null,
    councilDisagreementDataUnavailable: fp.councilDisagreementDataUnavailable ? 1 : 0,
    dominantFailureVectors:       JSON.stringify(fp.dominantFailureVectors),
    dominantApprovalPathways:     JSON.stringify(fp.dominantApprovalPathways),
    sensitivityRanking:           JSON.stringify(fp.sensitivityRanking),
    terminalFlagFrequency:        JSON.stringify(fp.terminalFlagFrequency),
    governanceEscalationFrequency: JSON.stringify(fp.governanceEscalationFrequency),
    isUpgradedScenario:           fp.isUpgradedScenario ? 1 : 0,
    originalRunId:                fp.originalRunId ?? null,
    originalVerdict:              fp.originalVerdict ?? null,
    upgradedVerdict:              fp.upgradedVerdict ?? null,
    resilienceDelta:              fp.resilienceDelta ?? null,
    upgradeEffectiveness:         fp.upgradeEffectiveness ?? null,
    mitigationDependencyScore:    fp.mitigationDependencyScore ?? null,
    sourceSector:                 fp.sourceSector ?? null,
    sourceGeography:              fp.sourceGeography ?? null,
    version:                      fp.version,
  });
}

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
      /** Council mode (gcc | global_vc | india_pe | gcc_equities | infrastructure) — used for mode-aware mitigant text */
      councilMode: z.enum(["gcc", "global_vc", "india_pe", "gcc_equities", "infrastructure"]).optional(),
      // Safety controls for gated modes (100k / 1M)
      maxCostCapUsd:    z.number().optional(),
      maxWallClockHours: z.number().optional(),
      batchSize:        z.number().min(100).max(10000).optional(),
      confirmedGated:   z.boolean().optional(), // must be true for gated modes
      // Upgraded scenario metadata (set when running on a post-fix deal)
      upgradedScenario: z.boolean().optional(),
      originalDealId:   z.string().max(64).optional(),
      originalVerdict:  z.string().max(64).optional(),
      upgradedVerdict:  z.string().max(64).optional(),
      /**
       * Base approval score derived from the council verdict for this deal.
       * Anchors the simulation distribution around the deal's actual quality.
       *   APPROVE      → +0.55
       *   CONDITIONAL  → +0.20
       *   REJECT       → -0.15
       * Defaults to 0.0 (backward compatible).
       */
      baseApprovalScore: z.number().min(-1).max(1).optional(),
      /**
       * Structured terminalFlags from the council result for this deal.
       * Passed to the Delta Engine to classify hard-no variants as
       * RESCUED_CONDITIONAL or FINAL_REJECTED.
       *
       * Three states (nullable wrapper distinguishes missing from empty):
       *   null      → ATTRIBUTION_UNAVAILABLE: field absent/unloaded/pre-field DB row.
       *               Delta Engine will NOT silently produce FINAL_REJECTED.
       *   []        → Genuinely empty: explicitly known to have zero terminal flags.
       *               Hard-no variants final-reject per DE-4 (non-empty guard).
       *   ["..."]   → Real structured flags: Delta Engine evaluates rescue eligibility.
       *
       * Omitting the field (undefined) is treated as ATTRIBUTION_UNAVAILABLE (same as null).
       * NEVER pass [] as a fallback for unknown/unloaded flags.
       */
      terminalFlags: z.array(z.string()).nullable().optional(),
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
        upgradedScenario: input.upgradedScenario ? 1 : 0,
        originalDealId:   input.originalDealId ?? null,
        originalVerdict:  input.originalVerdict ?? null,
        upgradedVerdict:  input.upgradedVerdict ?? null,
      });

      // For quick and institutional modes: run synchronously
      if (targetCount <= SYNC_LIMIT) {
        const startMs = Date.now();

        // Generate scenario variants
        const variants = generateScenarioVariants(targetCount, baseSeed);

        // Evaluate all variants
        const baseScore = input.baseApprovalScore ?? 0.0;
        // null = ATTRIBUTION_UNAVAILABLE; undefined = also unavailable; [] = genuinely empty; [...] = real flags
        const flags: string[] | null = input.terminalFlags === undefined ? null : input.terminalFlags;
        const results = await Promise.all(
          variants.map(v => evaluateScenario(v, buildScenarioBrief(input.dealText, v), invokeLLM as any, input.councilMode, baseScore, flags))
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
        // Persist fingerprint (fire-and-forget — never blocks the response)
        persistFingerprint(db, aggregation, results, {
          councilMode: input.councilMode ?? null,
          dealName: input.dealName,
          isUpgradedScenario: !!input.upgradedScenario,
          originalRunId: null, // not available in sync path; originalDealId is not runId
          originalVerdict: input.originalVerdict ?? null,
          upgradedVerdict: input.upgradedVerdict ?? null,
          originalApprovePct: null, // not available without fetching prior run
        }).catch(err => console.error(`[Fingerprint] persist failed for ${runId}:`, err));
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
        db,
        input.councilMode,
        input.baseApprovalScore ?? 0.0,
        // null = ATTRIBUTION_UNAVAILABLE; undefined = also unavailable; [] = genuinely empty; [...] = real flags
        input.terminalFlags === undefined ? null : input.terminalFlags,
        input.dealName
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
          // Upgraded scenario metadata
          upgradedScenario: scenarioSimRuns.upgradedScenario,
          originalDealId:   scenarioSimRuns.originalDealId,
          originalVerdict:  scenarioSimRuns.originalVerdict,
          upgradedVerdict:  scenarioSimRuns.upgradedVerdict,
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

  /** List simulation fingerprints for a deal, newest first */
  listFingerprintsForDeal: protectedProcedure
    .input(z.object({
      dealId: z.string(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db
        .select()
        .from(simulationFingerprints)
        .where(eq(simulationFingerprints.dealId, input.dealId))
        .orderBy(desc(simulationFingerprints.createdAt))
        .limit(input.limit);
      return rows.map(r => ({
        id:                    r.id,
        runId:                 r.runId,
        dealId:                r.dealId,
        dealName:              r.dealName,
        councilMode:           r.councilMode,
        scenarioCount:         r.scenarioCount,
        simulationMode:        r.simulationMode,
        approvePct:            r.approvePct,
        conditionalPct:        r.conditionalPct,
        rejectPct:             r.rejectPct,
        vetoPct:               r.vetoPct,
        rescuedConditionalPct: r.rescuedConditionalPct,
        finalRejectedPct:      r.finalRejectedPct,
        attributionUnavailablePct: r.attributionUnavailablePct,
        rescueabilityScore:    r.rescueabilityScore,
        vetoConcentrationScore: r.vetoConcentrationScore,
        structuralFragilityScore: r.structuralFragilityScore,
        scenarioEntropy:       r.scenarioEntropy,
        councilDisagreementScore: r.councilDisagreementScore,
        councilDisagreementDataUnavailable: r.councilDisagreementDataUnavailable === 1,
        dominantFailureVectors:   JSON.parse(r.dominantFailureVectors ?? "[]"),
        dominantApprovalPathways: JSON.parse(r.dominantApprovalPathways ?? "[]"),
        sensitivityRanking:       JSON.parse(r.sensitivityRanking ?? "[]"),
        terminalFlagFrequency:    JSON.parse(r.terminalFlagFrequency ?? "{}"),
        governanceEscalationFrequency: JSON.parse(r.governanceEscalationFrequency ?? "{}"),
        isUpgradedScenario:    r.isUpgradedScenario === 1,
        originalRunId:         r.originalRunId,
        originalVerdict:       r.originalVerdict,
        upgradedVerdict:       r.upgradedVerdict,
        resilienceDelta:       r.resilienceDelta,
        upgradeEffectiveness:  r.upgradeEffectiveness,
        mitigationDependencyScore: r.mitigationDependencyScore,
        sourceSector:          r.sourceSector,
        sourceGeography:       r.sourceGeography,
        version:               r.version,
        createdAt:             r.createdAt,
      }));
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
  db: Awaited<ReturnType<typeof getDb>>,
  councilMode?: string,
  baseApprovalScore: number = 0.0,
  terminalFlags: string[] | null = null,
  dealName: string = ""
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
      variants.map(v => evaluateScenario(v, buildScenarioBrief(dealText, v), invokeLLM as any, councilMode, baseApprovalScore, terminalFlags))
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
    // Persist fingerprint (fire-and-forget)
    persistFingerprint(db, aggregation, allResults, {
      councilMode: councilMode ?? null,
      dealName,
      isUpgradedScenario: false,
      originalRunId: null,
      originalVerdict: null,
      upgradedVerdict: null,
      originalApprovePct: null,
    }).catch(err => console.error(`[Fingerprint] persist failed for ${runId}:`, err));
  }
}
