/**
 * founderFleetScheduler.ts — Daily FounderAgent Fleet Run
 *
 * Fires at 06:00 Asia/Kuwait (03:00 UTC) every day.
 * Reads fleet_config WHERE active = true and runs each fleet mode.
 * Decrements runs_remaining and increments runs_completed ONLY after a
 * run completes successfully (status = "completed") — not optimistically.
 * Updates last_run_at / last_run_score on success.
 * Sets active=false when runs_remaining reaches 0.
 *
 * Also calls resumeInterruptedRuns() on startup to recover any runs
 * that were in progress when the server last restarted.
 *
 * Gate: does NOT run when NODE_ENV === "test".
 */
import cron from "node-cron";
import { runFleet, resumeInterruptedRuns } from "../founderFleet";
import { getDb } from "../db";
import { founderAgentRuns, fleetConfig, founderAgentEvaluations } from "../../drizzle/schema";
import { eq, and, avg, sql } from "drizzle-orm";

let schedulerStarted = false;

export function startFounderFleetScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Resume any interrupted runs from a previous server session
  resumeInterruptedRuns().catch((err: unknown) =>
    console.warn("[FounderFleet] Resume on startup failed:", (err as Error)?.message)
  );

  // Daily at 06:00 Asia/Kuwait (= 03:00 UTC)
  cron.schedule("0 3 * * *", async () => {
    console.log("[FounderFleet] Daily scheduled run starting at 06:00 KWT (03:00 UTC)");
    const db = await getDb();
    if (!db) {
      console.warn("[FounderFleet] DB unavailable — skipping scheduled run");
      return;
    }

    // Read all active fleet configs
    const activeConfigs = await db
      .select()
      .from(fleetConfig)
      .where(eq(fleetConfig.active, true));

    if (activeConfigs.length === 0) {
      console.log("[FounderFleet] No active fleet configs — nothing to run");
      return;
    }

    for (const config of activeConfigs) {
      const isGcc = config.fleetMode === "gcc";
      console.log(`[FounderFleet] Starting ${config.fleetMode} fleet run (${config.runsRemaining} remaining)`);

      try {
        const today = new Date().toISOString().slice(0, 10);

        // ── Pre-run cleanup: mark orphaned 'running' evals (>10 min old) as failed ──
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        const cleanupResult = await db.update(founderAgentEvaluations)
          .set({
            status: "failed",
            errorMessage: `Orphaned — cleaned up before new ${config.fleetMode} run at ${new Date().toISOString()}`,
            updatedAt: Date.now(),
          })
          .where(and(
            eq(founderAgentEvaluations.status, "running"),
            sql`${founderAgentEvaluations.updatedAt} < ${tenMinutesAgo}`,
          ));
        const cleanedCount = (cleanupResult as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
        if (cleanedCount > 0) {
          console.log(`[FounderFleet] Cleaned up ${cleanedCount} orphaned evaluations before ${config.fleetMode} run`);
        }

        const [newRun] = await db.insert(founderAgentRuns).values({
          runDate: today,
          fleetMode: config.fleetMode,
          status: "pending",
          totalIdeas: 100,
          completed: 0,
          queued: 0,
          running: 0,
          totalSearches: 0,
          totalLlmCalls: 0,
          estimatedTokens: 0,
          estimatedCostUsd: "0",
          startedAt: Date.now(),
          createdAt: Date.now(),
        }).$returningId();
        const runId = newRun.id;
        console.log(`[FounderFleet] Created ${config.fleetMode} run #${runId} for ${today}`);

        // Record lastRunAt immediately so the UI shows the run started
        await db.update(fleetConfig)
          .set({ lastRunAt: Date.now() })
          .where(eq(fleetConfig.id, config.id));

        // Run fleet — bypassCostGuard=true so the 10-runs/hour cap does not block
        // scheduled runs. runFleet never throws; it catches internally and sets
        // status="failed", so we must query the DB to determine success.
        await runFleet(runId, { gccMode: isGcc, bypassCostGuard: true });

        // ── Post-run: check actual DB status ──────────────────────────────────
        const dbPost = await getDb();
        if (!dbPost) {
          console.warn(`[FounderFleet] DB unavailable after ${config.fleetMode} run #${runId} — skipping counter update`);
          continue;
        }

        const [runRow] = await dbPost
          .select({ status: founderAgentRuns.status })
          .from(founderAgentRuns)
          .where(eq(founderAgentRuns.id, runId));

        const success = runRow?.status === "completed";
        console.log(`[FounderFleet] ${config.fleetMode} run #${runId} final status: ${runRow?.status ?? "unknown"}`);

        if (success) {
          // Only decrement runs_remaining and increment runs_completed on success
          const newRemaining = Math.max(0, config.runsRemaining - 1);
          const newCompleted = config.runsCompleted + 1;

          // Get avg score for this run
          const [scoreRow] = await dbPost
            .select({ avgScore: avg(founderAgentEvaluations.finalScore) })
            .from(founderAgentEvaluations)
            .where(and(
              eq(founderAgentEvaluations.runId, runId),
              eq(founderAgentEvaluations.fleetMode, config.fleetMode)
            ));
          const avgScore = scoreRow?.avgScore ? parseFloat(String(scoreRow.avgScore)) : null;

          await dbPost.update(fleetConfig)
            .set({
              runsRemaining: newRemaining,
              runsCompleted: newCompleted,
              lastRunAt: Date.now(),
              lastRunScore: avgScore !== null ? String(avgScore.toFixed(2)) : null,
              active: newRemaining > 0,
            })
            .where(eq(fleetConfig.id, config.id));

          console.log(`[FounderFleet] fleet_config updated: runs_completed=${newCompleted}, runs_remaining=${newRemaining}, last_run_score=${avgScore?.toFixed(1) ?? "N/A"}`);
        } else {
          console.error(`[FounderFleet] ${config.fleetMode} run #${runId} did not complete — fleet_config counters NOT updated`);
        }

      } catch (err) {
        console.error(`[FounderFleet] Failed to create ${config.fleetMode} run:`, (err as Error)?.message);
      }
    }
  }, { timezone: "UTC" });

  console.log("[FounderFleet] Daily scheduler registered — fires at 06:00 KWT (03:00 UTC)");
}
