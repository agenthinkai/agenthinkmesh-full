/**
 * fleetPhaseRoute.ts — Phase-based fleet execution endpoints
 *
 * Splits the fleet pipeline into four separate HTTP requests, each completing
 * well within Cloud Run's execution timeout (~30 min). Each phase reads from
 * and writes to the DB, so phases are fully independent HTTP invocations.
 *
 * Endpoints:
 *   POST /api/scheduled/fleet-phase?phase=generate&mode=gcc|global
 *   POST /api/scheduled/fleet-phase?phase=research&mode=gcc|global
 *   POST /api/scheduled/fleet-phase?phase=pitch&mode=gcc|global
 *   POST /api/scheduled/fleet-phase?phase=evaluate&mode=gcc|global
 *
 * Authentication: same as fleet-trigger — either:
 *   (a) X-Scheduler-Secret header matching SCHEDULER_SECRET env var, OR
 *   (b) Manus cron cookie (app_session_id) forwarded by the Manus reverse-proxy
 *
 * Each phase:
 *   - Returns HTTP 200 synchronously after its work completes (not fire-and-forget)
 *   - Reads prior phase output from DB
 *   - Saves its output to DB before returning
 *   - Is idempotent: re-running a completed phase is a no-op
 *
 * Recommended Manus scheduler times (UTC):
 *   03:00 — generate gcc    03:00 — generate global
 *   03:05 — research gcc    03:05 — research global
 *   03:15 — pitch gcc       03:15 — pitch global
 *   03:30 — evaluate gcc    03:30 — evaluate global
 */

import { Router, Request, Response } from "express";
import { getDb } from "./db";
import {
  founderAgentRuns,
  founderAgentIdeas,
  founderAgentResearch,
  founderAgentPitches,
  fleetConfig as fleetConfigTable,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  FLEET_DOMAINS,
  GCC_FLEET_DOMAINS,
} from "./founderFleet";

// Re-export internal helpers via dynamic import to avoid circular deps
// (founderFleet.ts exports runFleet; we need the internal phase functions)
// We call them via the exported runFleet with batchMode tricks, OR we
// expose them directly. Since they are not exported, we inline thin wrappers
// that call runFleet with phase-specific options via a new exported helper.

import {
  runFleetPhase,
  type FleetPhase,
} from "./founderFleet";

const router = Router();

// ── Auth helper ────────────────────────────────────────────────────────────────
function isAuthorized(req: Request): boolean {
  const secret = process.env.SCHEDULER_SECRET;
  const provided = req.headers["x-scheduler-secret"];
  const hasCronCookie =
    typeof req.headers.cookie === "string" &&
    req.headers.cookie.includes("app_session_id=");
  const secretValid = !!(secret && provided && provided === secret);
  return secretValid || hasCronCookie;
}

// ── GET or POST /fleet-phase ───────────────────────────────────────────────────
router.all("/fleet-phase", async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Accept params from query string OR request body
  const params = { ...req.query, ...req.body } as Record<string, string>;
  const phase = params.phase as FleetPhase | undefined;
  const mode  = params.mode as "gcc" | "global" | undefined;

  if (!phase || !["generate", "research", "pitch", "evaluate"].includes(phase)) {
    res.status(400).json({
      error: "Missing or invalid phase. Must be one of: generate, research, pitch, evaluate",
    });
    return;
  }

  if (!mode || !["gcc", "global"].includes(mode)) {
    res.status(400).json({
      error: "Missing or invalid mode. Must be one of: gcc, global",
    });
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[FleetPhase] ${phase}/${mode} triggered at ${timestamp}`);

  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  // ── Find or create today's run row ─────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const isGcc = mode === "gcc";

  // Load fleet config for this mode
  const [config] = await db.select().from(fleetConfigTable)
    .where(and(eq(fleetConfigTable.fleetMode, mode), eq(fleetConfigTable.active, true)));
  if (!config) {
    res.status(404).json({ error: `No active fleet_config for mode=${mode}` });
    return;
  }

  const ideasPerDomain = isGcc ? 20 : 40;
  const targetIdeas    = isGcc ? 100 : 200;

  // Find today's run (any non-completed status), or create one for generate phase
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
      const ideaCount = await db.select({ id: founderAgentIdeas.id })
        .from(founderAgentIdeas).where(eq(founderAgentIdeas.runId, existingRun.id));
      res.json({
        phase, mode, runId: existingRun.id, status: "already_completed",
        ideasGenerated: ideaCount.length, timestamp,
      });
      return;
    }

    if (existingRun && existingRun.status !== "failed") {
      // Resume existing run (interrupted in generate or later phase)
      runId = existingRun.id;
      console.log(`[FleetPhase] generate/${mode}: resuming run #${runId} (was: ${existingRun.status})`);
    } else {
      // Create fresh run
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
      console.log(`[FleetPhase] generate/${mode}: created run #${runId}`);
    }
  } else {
    // For research/pitch/evaluate: require an existing run from today
    if (!existingRun) {
      res.status(409).json({
        error: `No run found for mode=${mode} on ${today}. Run the generate phase first.`,
        phase, mode, today,
      });
      return;
    }
    if (existingRun.status === "completed") {
      res.json({
        phase, mode, runId: existingRun.id, status: "already_completed", timestamp,
      });
      return;
    }
    runId = existingRun.id;
    console.log(`[FleetPhase] ${phase}/${mode}: using run #${runId} (status: ${existingRun.status})`);
  }

  // ── Execute the phase synchronously ────────────────────────────────────────
  const startMs = Date.now();
  try {
    const result = await runFleetPhase(runId, phase, {
      gccMode:         isGcc,
      bypassCostGuard: true,
      ideasPerDomain,
    });

    const durationMs = Date.now() - startMs;
    console.log(`[FleetPhase] ${phase}/${mode} run #${runId} completed in ${(durationMs / 1000).toFixed(1)}s`);

    res.json({
      phase,
      mode,
      runId,
      status:     "completed",
      durationMs,
      timestamp,
      ...result,
    });
  } catch (err) {
    const errMsg = (err as Error)?.message ?? String(err);
    const durationMs = Date.now() - startMs;
    console.error(`[FleetPhase] ${phase}/${mode} run #${runId} failed after ${(durationMs / 1000).toFixed(1)}s:`, errMsg);
    res.status(500).json({
      phase, mode, runId,
      status: "failed",
      error:  errMsg,
      durationMs,
      timestamp,
    });
  }
});

export default router;
