/**
 * fleetTriggerRoute.ts — External HTTP trigger for the daily FounderAgent fleet
 *
 * POST /api/scheduled/fleet-trigger
 *
 * Authentication:
 *   Header: X-Scheduler-Secret: <SCHEDULER_SECRET env var>
 *   Returns 401 if header is missing or wrong.
 *
 * Behaviour:
 *   - Returns 200 immediately (fire-and-forget background execution)
 *   - Runs orphan cleanup, then GCC (200 ideas) + Global (300 ideas) fleet runs
 *   - Sends daily summary email when both complete
 *   - Uses bypassCostGuard: true (same as the cron)
 *
 * This endpoint exists to wake Cloud Run from hibernation and trigger the fleet
 * regardless of whether the in-process node-cron survived.
 */
import { Router, Request, Response } from "express";
import { runDailyFleet } from "./jobs/founderFleetScheduler";
import { runFleet } from "./founderFleet";
import { getDb } from "./db";
import { fleetConfig as fleetConfigTable, founderAgentRuns } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/fleet-trigger", (req: Request, res: Response) => {
  const secret = process.env.SCHEDULER_SECRET;
  const provided = req.headers["x-scheduler-secret"];

  if (!secret || !provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[FleetTrigger] External trigger received at ${timestamp}`);

  const { mode } = req.body as { mode?: string };

  // Return immediately — fleet runs in background
  res.json({ status: "triggered", timestamp, mode: mode ?? "all" });

  if (mode === "gcc" || mode === "global") {
    // Single-mode trigger: run only the specified fleet config
    (async () => {
      try {
        const db = await getDb();
        if (!db) { console.error("[FleetTrigger] DB unavailable"); return; }
        const [config] = await db.select().from(fleetConfigTable)
          .where(and(eq(fleetConfigTable.fleetMode, mode), eq(fleetConfigTable.active, true)));
        if (!config) { console.error(`[FleetTrigger] No active fleet_config for mode=${mode}`); return; }
        const isGcc = mode === "gcc";
        const ideasPerDomain = isGcc ? 40 : 60;
        const targetIdeas = isGcc ? 200 : 300;
        const today = new Date().toISOString().slice(0, 10);
        const [newRun] = await db.insert(founderAgentRuns).values({
          runDate: today, fleetMode: mode, status: "pending",
          totalIdeas: targetIdeas, completed: 0, queued: 0, running: 0,
          totalSearches: 0, totalLlmCalls: 0, estimatedTokens: 0,
          estimatedCostUsd: "0", startedAt: Date.now(), createdAt: Date.now(),
        }).$returningId();
        const runId = newRun.id;
        console.log(`[FleetTrigger] Single-mode trigger: ${mode} run #${runId}`);
        await runFleet(runId, { gccMode: isGcc, bypassCostGuard: true, ideasPerDomain });
        console.log(`[FleetTrigger] ${mode} run #${runId} completed`);
      } catch (err) {
        console.error(`[FleetTrigger] Single-mode ${mode} run error:`, (err as Error)?.message);
      }
    })();
  } else {
    // Full daily fleet (both modes)
    runDailyFleet().catch((err: unknown) => {
      console.error("[FleetTrigger] Background fleet run error:", (err as Error)?.message);
    });
  }
});

export default router;
