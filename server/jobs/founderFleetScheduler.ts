/**
 * founderFleetScheduler.ts — Daily FounderAgent Fleet Run
 *
 * Fires at 06:00 Asia/Kuwait (03:00 UTC) every day.
 * Reads fleet_config WHERE active = true and runs each fleet mode.
 * Decrements runs_remaining, updates last_run_at / last_run_score,
 * and sets active=false when runs_remaining reaches 0.
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
import { eq, and, avg } from "drizzle-orm";

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

        // Decrement runs_remaining immediately (optimistic — prevents double-fire)
        const newRemaining = Math.max(0, config.runsRemaining - 1);
        const newCompleted = config.runsCompleted + 1;
        await db.update(fleetConfig)
          .set({
            runsRemaining: newRemaining,
            runsCompleted: newCompleted,
            lastRunAt: Date.now(),
            active: newRemaining > 0,
          })
          .where(eq(fleetConfig.id, config.id));

        // Fire and forget — orchestration engine manages its own error handling
        runFleet(runId, { gccMode: isGcc }).then(async () => {
          // After run completes, update last_run_score with avg final_score
          try {
            const dbInner = await getDb();
            if (!dbInner) return;
            const [scoreRow] = await dbInner
              .select({ avgScore: avg(founderAgentEvaluations.finalScore) })
              .from(founderAgentEvaluations)
              .where(and(
                eq(founderAgentEvaluations.runId, runId),
                eq(founderAgentEvaluations.fleetMode, config.fleetMode)
              ));
            const avgScore = scoreRow?.avgScore ? parseFloat(String(scoreRow.avgScore)) : null;
            if (avgScore !== null) {
              await dbInner.update(fleetConfig)
                .set({ lastRunScore: String(avgScore) })
                .where(eq(fleetConfig.id, config.id));
            }
            console.log(`[FounderFleet] ${config.fleetMode} run #${runId} complete — avg score: ${avgScore?.toFixed(1) ?? "N/A"}`);
          } catch (scoreErr) {
            console.warn(`[FounderFleet] Could not update last_run_score for ${config.fleetMode}:`, (scoreErr as Error)?.message);
          }
        }).catch((err: unknown) => {
          console.error(`[FounderFleet] ${config.fleetMode} run #${runId} failed:`, (err as Error)?.message);
        });

      } catch (err) {
        console.error(`[FounderFleet] Failed to create ${config.fleetMode} run:`, (err as Error)?.message);
      }
    }
  }, { timezone: "UTC" });

  console.log("[FounderFleet] Daily scheduler registered — fires at 06:00 KWT (03:00 UTC)");
}
