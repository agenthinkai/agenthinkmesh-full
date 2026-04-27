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

  // Return immediately — fleet runs in background
  res.json({ status: "triggered", timestamp });

  // Fire-and-forget background execution
  runDailyFleet().catch((err: unknown) => {
    console.error("[FleetTrigger] Background fleet run error:", (err as Error)?.message);
  });
});

export default router;
