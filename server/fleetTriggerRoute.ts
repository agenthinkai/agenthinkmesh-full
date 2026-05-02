/**
 * fleetTriggerRoute.ts — External HTTP trigger for the daily FounderAgent fleet
 *
 * POST /api/scheduled/fleet-trigger
 *
 * Authentication (either of):
 *   (a) Header: X-Scheduler-Secret: <SCHEDULER_SECRET env var>
 *   (b) Manus cron cookie (app_session_id) — the Manus reverse-proxy validates
 *       the cron cookie before forwarding to /api/scheduled/* routes, so its
 *       presence here is sufficient proof of a legitimate Manus scheduler call.
 *   Returns 401 if neither auth method is satisfied.
 *
 * Behaviour:
 *   - Returns 200 immediately (fire-and-forget background execution)
 *   - Runs orphan cleanup, then GCC (200 ideas) + Global (300 ideas) fleet runs
 *   - Sends daily summary email when both complete
 *   - Uses bypassCostGuard: true (same as the cron)
 *
 * Special actions (via body.action):
 *   "test-email" — Sends a test email to farouq@agenthink.ai via Graph API
 *                  and returns the result synchronously. Used to verify that
 *                  MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID are correctly
 *                  configured in the production environment.
 *
 * This endpoint exists to wake Cloud Run from hibernation and trigger the fleet
 * regardless of whether the in-process node-cron survived.
 */
import { Router, Request, Response } from "express";
import { runDailyFleet } from "./jobs/founderFleetScheduler";
import { runFleet } from "./founderFleet";
import { sendGraphEmail } from "./graphEmail";
import { getDb } from "./db";
import { fleetConfig as fleetConfigTable, founderAgentRuns } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.post("/fleet-trigger", async (req: Request, res: Response) => {
  const secret = process.env.SCHEDULER_SECRET;
  const provided = req.headers["x-scheduler-secret"];

  // Accept either:
  //   (a) valid X-Scheduler-Secret header matching SCHEDULER_SECRET env var, OR
  //   (b) the Manus cron cookie (app_session_id) — the Manus reverse-proxy already
  //       validates the cron cookie before forwarding to /api/scheduled/* routes,
  //       so its presence here means the request is legitimately from the Manus scheduler.
  const hasCronCookie = typeof req.headers.cookie === 'string' &&
    req.headers.cookie.includes('app_session_id=');
  const secretValid = !!(secret && provided && provided === secret);

  if (!secretValid && !hasCronCookie) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[FleetTrigger] External trigger received at ${timestamp}`);

  const { mode, action } = req.body as { mode?: string; action?: string };

  // ── Special action: test-email ─────────────────────────────────────────────
  // Sends a test email synchronously and returns the result.
  // Use this to verify Graph API credentials are working in production.
  if (action === "test-email") {
    const credCheck = {
      MS_CLIENT_ID:     !!process.env.MS_CLIENT_ID,
      MS_CLIENT_SECRET: !!process.env.MS_CLIENT_SECRET,
      MS_TENANT_ID:     !!process.env.MS_TENANT_ID,
    };
    const allSet = Object.values(credCheck).every(Boolean);
    if (!allSet) {
      console.error("[FleetTrigger] test-email: Graph API credentials missing", credCheck);
      res.status(500).json({
        action: "test-email",
        success: false,
        error: "Graph API credentials not configured — set MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID in production secrets",
        credentials: credCheck,
      });
      return;
    }
    try {
      const sent = await sendGraphEmail({
        to: "farouq@agenthink.ai",
        subject: `AgenThink Fleet — Graph API test (${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kuwait" })})`,
        html: `<p>This is a test email sent from the AgenThink fleet trigger endpoint to verify that the Microsoft Graph API credentials are correctly configured in the production environment.</p><p>Timestamp: ${timestamp}</p>`,
      });
      console.log(`[FleetTrigger] test-email result: ${sent ? "SENT" : "FAILED"}`);
      res.json({
        action: "test-email",
        success: sent,
        timestamp,
        credentials: credCheck,
        message: sent
          ? "Test email sent to farouq@agenthink.ai — check inbox"
          : "sendGraphEmail returned false — check server logs for Graph API error details",
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      console.error("[FleetTrigger] test-email threw:", msg);
      res.status(500).json({
        action: "test-email",
        success: false,
        error: msg,
        credentials: credCheck,
      });
    }
    return;
  }

  // ── Normal fleet trigger ───────────────────────────────────────────────────
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
        // GCC: 20 ideas/domain × 5 domains = 100 total (1 LLM batch per domain, ~15 min)
        // Global: 40 ideas/domain × 5 domains = 200 total
        const ideasPerDomain = isGcc ? 20 : 40;
        const targetIdeas = isGcc ? 100 : 200;
        const today = new Date().toISOString().slice(0, 10);

        // Resume today's failed/interrupted run if one exists, rather than creating a new one.
        // This prevents duplicate runs and allows the pipeline to continue from where it left off.
        const { desc } = await import("drizzle-orm");
        const [existingRun] = await db.select()
          .from(founderAgentRuns)
          .where(and(
            eq(founderAgentRuns.fleetMode, mode),
            eq(founderAgentRuns.runDate, today),
          ))
          .orderBy(desc(founderAgentRuns.createdAt))
          .limit(1);

        let runId: number;
        if (existingRun && ["failed", "generating", "researching", "pitching", "evaluating", "extracting"].includes(existingRun.status)) {
          // Resume the existing run from its last known phase
          runId = existingRun.id;
          console.log(`[FleetTrigger] Resuming ${mode} run #${runId} (was: ${existingRun.status})`);
          // Reset status to pending so runFleet re-enters from the beginning of the failed phase
          await db.update(founderAgentRuns).set({ status: "pending" }).where(eq(founderAgentRuns.id, runId));
        } else {
          const [newRun] = await db.insert(founderAgentRuns).values({
            runDate: today, fleetMode: mode, status: "pending",
            totalIdeas: targetIdeas, completed: 0, queued: 0, running: 0,
            totalSearches: 0, totalLlmCalls: 0, estimatedTokens: 0,
            estimatedCostUsd: "0", startedAt: Date.now(), createdAt: Date.now(),
          }).$returningId();
          runId = newRun.id;
          console.log(`[FleetTrigger] New ${mode} run #${runId}`);
        }
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
