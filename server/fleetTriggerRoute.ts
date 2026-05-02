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
 *
 *   Phase-based execution (body.phase present):
 *     { "mode": "gcc"|"global", "phase": "generate"|"research"|"pitch"|"evaluate" }
 *     - Executes a single pipeline phase synchronously
 *     - Returns 200 with result JSON when the phase completes
 *     - Each phase completes within Cloud Run's timeout window (~5–15 min)
 *     - Phases are idempotent: re-running a completed phase is a no-op
 *
 *   Legacy full-pipeline execution (body.phase absent):
 *     { "mode": "gcc"|"global"|undefined }
 *     - Returns 200 immediately (fire-and-forget background execution)
 *     - Runs the full pipeline in a single long-running background job
 *
 *   Special actions (via body.action):
 *     "test-email" — Sends a test email to farouq@agenthink.ai via Graph API
 *
 * Recommended Manus scheduler tasks for phase-based execution (UTC):
 *   03:00 — { mode: "gcc",    phase: "generate"  }
 *   03:00 — { mode: "global", phase: "generate"  }
 *   03:10 — { mode: "gcc",    phase: "research"  }
 *   03:10 — { mode: "global", phase: "research"  }
 *   03:20 — { mode: "gcc",    phase: "pitch"     }
 *   03:20 — { mode: "global", phase: "pitch"     }
 *   03:35 — { mode: "gcc",    phase: "evaluate"  }
 *   03:35 — { mode: "global", phase: "evaluate"  }
 */
import { Router, Request, Response } from "express";
import { runDailyFleet } from "./jobs/founderFleetScheduler";
import { runFleet, runFleetPhase, type FleetPhase } from "./founderFleet";
import { sendGraphEmail } from "./graphEmail";
import { getDb } from "./db";
import { fleetConfig as fleetConfigTable, founderAgentRuns } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

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

  const { mode, action, phase } = req.body as { mode?: string; action?: string; phase?: string };

  // ── Special action: test-email ─────────────────────────────────────────────
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

  // ── Phase-based execution ──────────────────────────────────────────────────
  // When body.phase is present, execute a single pipeline phase synchronously.
  // Each phase completes within Cloud Run's timeout window (~5–15 min).
  // Returns 200 with result JSON when the phase completes.
  if (phase && ["generate", "research", "pitch", "evaluate"].includes(phase)) {
    if (!mode || !["gcc", "global"].includes(mode)) {
      res.status(400).json({
        error: "body.mode must be 'gcc' or 'global' when body.phase is set",
        phase, mode,
      });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const isGcc = mode === "gcc";
    const ideasPerDomain = isGcc ? 20 : 40;
    const targetIdeas    = isGcc ? 100 : 200;
    const today = new Date().toISOString().slice(0, 10);

    // Load fleet config
    const [config] = await db.select().from(fleetConfigTable)
      .where(and(eq(fleetConfigTable.fleetMode, mode), eq(fleetConfigTable.active, true)));
    if (!config) {
      res.status(404).json({ error: `No active fleet_config for mode=${mode}` });
      return;
    }

    // Find or create today's run
    const [existingRun] = await db.select()
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, mode),
        eq(founderAgentRuns.runDate, today),
      ))
      .orderBy(desc(founderAgentRuns.createdAt))
      .limit(1);

    let runId: number;

    if (phase === "generate") {
      if (existingRun && existingRun.status === "completed") {
        // Already completed today — idempotent no-op
        res.json({
          phase, mode, runId: existingRun.id,
          status: "already_completed", timestamp,
        });
        return;
      }
      if (existingRun && existingRun.status !== "failed") {
        runId = existingRun.id;
        console.log(`[FleetTrigger] Phase generate/${mode}: resuming run #${runId} (was: ${existingRun.status})`);
      } else {
        const [newRun] = await db.insert(founderAgentRuns).values({
          runDate:          today,
          fleetMode:        mode,
          status:           "pending",
          totalIdeas:       targetIdeas,
          completed:        0,
          queued:           0,
          running:          0,
          totalSearches:    0,
          totalLlmCalls:    0,
          estimatedTokens:  0,
          estimatedCostUsd: "0",
          startedAt:        Date.now(),
          createdAt:        Date.now(),
        }).$returningId();
        runId = newRun.id;
        console.log(`[FleetTrigger] Phase generate/${mode}: created run #${runId}`);
      }
    } else {
      // For research/pitch/evaluate: require an existing run from today
      if (!existingRun) {
        res.status(409).json({
          error: `No run found for mode=${mode} on ${today}. Run phase=generate first.`,
          phase, mode, today,
        });
        return;
      }
      if (existingRun.status === "completed") {
        res.json({
          phase, mode, runId: existingRun.id,
          status: "already_completed", timestamp,
        });
        return;
      }
      runId = existingRun.id;
      console.log(`[FleetTrigger] Phase ${phase}/${mode}: using run #${runId} (status: ${existingRun.status})`);
    }

    // Execute the phase synchronously
    const startMs = Date.now();
    try {
      const result = await runFleetPhase(runId, phase as FleetPhase, {
        gccMode:         isGcc,
        bypassCostGuard: true,
        ideasPerDomain,
      });
      const durationMs = Date.now() - startMs;
      console.log(`[FleetTrigger] Phase ${phase}/${mode} run #${runId} completed in ${(durationMs / 1000).toFixed(1)}s`);
      res.json({
        phase, mode, runId,
        status: "completed",
        durationMs, timestamp,
        ...result,
      });
    } catch (err) {
      const errMsg = (err as Error)?.message ?? String(err);
      const durationMs = Date.now() - startMs;
      console.error(`[FleetTrigger] Phase ${phase}/${mode} run #${runId} failed after ${(durationMs / 1000).toFixed(1)}s:`, errMsg);
      res.status(500).json({
        phase, mode, runId,
        status: "failed",
        error: errMsg,
        durationMs, timestamp,
      });
    }
    return;
  }

  // ── Legacy full-pipeline trigger ───────────────────────────────────────────
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
        const ideasPerDomain = isGcc ? 20 : 40;
        const targetIdeas = isGcc ? 100 : 200;
        const today = new Date().toISOString().slice(0, 10);

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
          runId = existingRun.id;
          console.log(`[FleetTrigger] Resuming ${mode} run #${runId} (was: ${existingRun.status})`);
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
