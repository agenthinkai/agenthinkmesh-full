/**
 * founderFleetScheduler.ts — Daily FounderAgent Fleet Run
 *
 * Fires at 02:00 UTC every day.
 * Creates a new fleet run and starts the full orchestration pipeline.
 * Also calls resumeInterruptedRuns() on startup to recover any runs
 * that were in progress when the server last restarted.
 *
 * Gate: does NOT run when NODE_ENV === "test".
 */

import cron from "node-cron";
import { runFleet, resumeInterruptedRuns } from "../founderFleet";
import { getDb } from "../db";
import { founderAgentRuns } from "../../drizzle/schema";

let schedulerStarted = false;

export function startFounderFleetScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Resume any interrupted runs from a previous server session
  resumeInterruptedRuns().catch((err: unknown) =>
    console.warn("[FounderFleet] Resume on startup failed:", (err as Error)?.message)
  );

  // Daily at 02:00 UTC
  cron.schedule("0 2 * * *", async () => {
    console.log("[FounderFleet] Daily scheduled run starting at 02:00 UTC");
    try {
      const db = await getDb();
      if (!db) {
        console.warn("[FounderFleet] DB unavailable — skipping scheduled run");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const [newRun] = await db.insert(founderAgentRuns).values({
        runDate: today,
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
      console.log(`[FounderFleet] Created scheduled run #${runId} for ${today}`);
      // Fire and forget — the orchestration engine manages its own error handling
      runFleet(runId).catch((err: unknown) =>
        console.error(`[FounderFleet] Scheduled run #${runId} failed:`, (err as Error)?.message)
      );
    } catch (err) {
      console.error("[FounderFleet] Failed to create scheduled run:", (err as Error)?.message);
    }
  }, { timezone: "UTC" });

  console.log("[FounderFleet] Daily scheduler registered — fires at 02:00 UTC");
}
