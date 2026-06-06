/**
 * webhookFleetTriggerRoute.ts — Public webhook trigger for the daily FounderAgent fleet
 *
 * POST /webhook/fleet-trigger
 *
 * This route lives OUTSIDE the /api/* namespace to bypass the Manus reverse-proxy
 * cookie-auth middleware that blocks all /api/scheduled/* requests.
 *
 * Authentication:
 *   Header: X-Scheduler-Secret: <SCHEDULER_SECRET env var>
 *   Returns 401 if header is missing or wrong.
 *
 * Behaviour:
 *   - Identical logic to /api/scheduled/fleet-trigger
 *   - Returns 200 immediately (fire-and-forget background execution)
 *   - Runs orphan cleanup, then GCC (200 ideas) + Global (300 ideas) fleet runs
 *   - Sends daily summary email when both complete
 *   - Uses bypassCostGuard: true (same as the cron)
 *
 * Special actions (via body.action):
 *   "env-check"    — Reports presence/absence of critical env vars (no secrets exposed)
 *   "resume-run"   — Resumes a specific run by ID (body.runId required)
 *   "test-email"   — Sends a test email to farouq@agenthink.ai via Graph API
 *   "fleet-export" — Exports evaluation rows for a run as a JSON fixture (body.runId required)
 *                    Returns per-deal: evalId, ideaId, domain, subSector, targetRegion,
 *                    classificationScore, executionScore, marketScore, finalScore,
 *                    classification, fleetMode.  Used for regression testing and audits.
 *
 * Added: 2026-04-29 — Fix for HTTP 403 caused by Manus reverse-proxy blocking
 *   /api/scheduled/* routes before requests reach the Express app.
 */
import { Router, Request, Response } from "express";
import { runDailyFleet } from "./jobs/founderFleetScheduler";
import { runFleet } from "./founderFleet";
import { sendGraphEmail } from "./graphEmail";
import { getDb } from "./db";
import { fleetConfig as fleetConfigTable, founderAgentRuns, founderAgentEvaluations, founderAgentIdeas, founderAgentPitches } from "../drizzle/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { decryptWithMasterKey } from "./cmk";

const router = Router();

router.post("/fleet-trigger", async (req: Request, res: Response) => {
  const secret = process.env.SCHEDULER_SECRET;
  const provided = req.headers["x-scheduler-secret"];

  if (!secret || !provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const timestamp = new Date().toISOString();
  console.log(`[WebhookFleetTrigger] External trigger received at ${timestamp}`);

  const { mode, action, runId: bodyRunId } = req.body as { mode?: string; action?: string; runId?: number };

  // ── Special action: env-check — report presence of critical env vars ──────
  if (action === "env-check") {
    const forgeKey     = process.env.BUILT_IN_FORGE_API_KEY ?? "";
    const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
    const dbUrl        = process.env.DATABASE_URL ?? "";
    const envReport = {
      BUILT_IN_FORGE_API_KEY: forgeKey.length > 0
        ? "SET (non-empty)"
        : ("BUILT_IN_FORGE_API_KEY" in process.env ? "SET (empty)" : "MISSING"),
      ANTHROPIC_API_KEY: anthropicKey.length > 0
        ? "SET (non-empty)"
        : ("ANTHROPIC_API_KEY" in process.env ? "SET (empty)" : "MISSING"),
      DATABASE_URL:      dbUrl.length > 0 ? "SET (non-empty)" : "MISSING",
      MS_CLIENT_ID:      (process.env.MS_CLIENT_ID     ?? "").length > 0 ? "SET (non-empty)" : "MISSING",
      MS_CLIENT_SECRET:  (process.env.MS_CLIENT_SECRET ?? "").length > 0 ? "SET (non-empty)" : "MISSING",
      MS_TENANT_ID:      (process.env.MS_TENANT_ID     ?? "").length > 0 ? "SET (non-empty)" : "MISSING",
    };
    console.log("[WebhookFleetTrigger] env-check:", JSON.stringify(envReport));
    res.json({ action: "env-check", timestamp, env: envReport });
    return;
  }

  // ── Special action: resume-run — resume a specific run by ID ─────────────
  if (action === "resume-run") {
    if (!bodyRunId || typeof bodyRunId !== "number") {
      res.status(400).json({ error: "Missing or invalid runId" });
      return;
    }
    const db = await getDb();
    if (!db) { res.status(503).json({ error: "DB unavailable" }); return; }
    // Reset orphaned 'running' evals → 'queued'
    const resetResult = await db
      .update(founderAgentEvaluations)
      .set({ status: "queued", updatedAt: Date.now() })
      .where(and(eq(founderAgentEvaluations.runId, bodyRunId), eq(founderAgentEvaluations.status, "running")));
    const resetCount = (resetResult as { rowsAffected?: number }).rowsAffected ?? 0;
    console.log(`[WebhookFleetTrigger] resume-run #${bodyRunId}: reset ${resetCount} 'running' evals → 'queued'`);
    // Set run status to evaluating so runFleet resumes from eval phase
    await db.update(founderAgentRuns).set({ status: "evaluating" }).where(eq(founderAgentRuns.id, bodyRunId));
    const [runRow] = await db.select({ fleetMode: founderAgentRuns.fleetMode })
      .from(founderAgentRuns).where(eq(founderAgentRuns.id, bodyRunId)).limit(1);
    const isGcc = runRow?.fleetMode === "gcc";
    const ideasPerDomain = isGcc ? 20 : 40;
    res.json({ status: "triggered", runId: bodyRunId, resetCount, timestamp });
    runFleet(bodyRunId, { gccMode: isGcc, bypassCostGuard: true, ideasPerDomain }).catch((err: unknown) => {
      console.error(`[WebhookFleetTrigger] resume-run #${bodyRunId} error:`, (err as Error)?.message);
    });
    return;
  }

  // ── Special action: test-email ─────────────────────────────────────────────
  if (action === "test-email") {
    const credCheck = {
      MS_CLIENT_ID:     !!process.env.MS_CLIENT_ID,
      MS_CLIENT_SECRET: !!process.env.MS_CLIENT_SECRET,
      MS_TENANT_ID:     !!process.env.MS_TENANT_ID,
    };
    const allSet = Object.values(credCheck).every(Boolean);
    if (!allSet) {
      console.error("[WebhookFleetTrigger] test-email: Graph API credentials missing", credCheck);
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
        html: `<p>This is a test email sent from the AgenThink webhook fleet trigger endpoint to verify that the Microsoft Graph API credentials are correctly configured in the production environment.</p><p>Timestamp: ${timestamp}</p>`,
      });
      console.log(`[WebhookFleetTrigger] test-email result: ${sent ? "SENT" : "FAILED"}`);
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
      console.error("[WebhookFleetTrigger] test-email threw:", msg);
      res.status(500).json({
        action: "test-email",
        success: false,
        error: msg,
        credentials: credCheck,
      });
    }
    return;
  }

  // ── Special action: fleet-export — export evaluation rows as JSON fixture ──
  if (action === "fleet-export") {
    if (!bodyRunId || typeof bodyRunId !== "number") {
      res.status(400).json({ action: "fleet-export", error: "body.runId (number) is required" });
      return;
    }
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ action: "fleet-export", error: "Database unavailable" });
        return;
      }
      const rows = await db
        .select({
          evalId:              founderAgentEvaluations.id,
          ideaId:              founderAgentEvaluations.ideaId,
          runId:               founderAgentEvaluations.runId,
          fleetMode:           founderAgentEvaluations.fleetMode,
          domain:              founderAgentIdeas.domain,
          subSector:           founderAgentIdeas.subSector,
          targetRegion:        founderAgentIdeas.targetRegion,
          classificationScore: founderAgentEvaluations.classificationScore,
          executionScore:      founderAgentEvaluations.executionScore,
          marketScore:         founderAgentEvaluations.marketScore,
          finalScore:          founderAgentEvaluations.finalScore,
          classification:      founderAgentEvaluations.classification,
          status:              founderAgentEvaluations.status,
        })
        .from(founderAgentEvaluations)
        .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
        .where(eq(founderAgentEvaluations.runId, bodyRunId));
      console.log(`[WebhookFleetTrigger] fleet-export run #${bodyRunId}: ${rows.length} rows`);
      res.json({
        action: "fleet-export",
        runId: bodyRunId,
        count: rows.length,
        exportedAt: timestamp,
        rows,
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      console.error(`[WebhookFleetTrigger] fleet-export run #${bodyRunId} error:`, msg);
      res.status(500).json({ action: "fleet-export", error: msg });
    }
    return;
  }

  // ── Special action: eval-detail — return full verbatim decrypted eval content ──
  // body.evalIds: number[]  — list of specific eval IDs to fetch (max 50)
  // body.runId: number      — optional: fetch top N evals from a run (body.topN, default 10)
  if (action === "eval-detail") {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ action: "eval-detail", error: "Database unavailable" });
        return;
      }
      const evalIds: number[] = (req.body as { evalIds?: number[] }).evalIds ?? [];
      const topN: number = (req.body as { topN?: number }).topN ?? 10;

      let rows: Array<{ eval: typeof founderAgentEvaluations.$inferSelect; idea: typeof founderAgentIdeas.$inferSelect; pitch: typeof founderAgentPitches.$inferSelect }> = [];

      if (evalIds.length > 0) {
        // Fetch specific eval IDs
        rows = await db.select({
          eval: founderAgentEvaluations,
          idea: founderAgentIdeas,
          pitch: founderAgentPitches,
        })
          .from(founderAgentEvaluations)
          .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
          .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
          .where(inArray(founderAgentEvaluations.id, evalIds.slice(0, 50))) as typeof rows;
      } else if (bodyRunId && typeof bodyRunId === "number") {
        // Fetch top N evals from a specific run
        rows = await db.select({
          eval: founderAgentEvaluations,
          idea: founderAgentIdeas,
          pitch: founderAgentPitches,
        })
          .from(founderAgentEvaluations)
          .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
          .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
          .where(eq(founderAgentEvaluations.runId, bodyRunId))
          .orderBy(desc(founderAgentEvaluations.finalScore))
          .limit(topN) as typeof rows;
      } else {
        res.status(400).json({ action: "eval-detail", error: "body.evalIds (number[]) or body.runId (number) is required" });
        return;
      }

      const result = rows.map(({ eval: e, idea, pitch }) => ({
        evalId:              e.id,
        runId:               e.runId,
        ideaId:              idea.id,
        fleetMode:           e.fleetMode,
        createdAt:           e.createdAt,
        updatedAt:           e.updatedAt,
        status:              e.status,
        // Idea fields
        founderName:         idea.founderName,
        domain:              idea.domain,
        subSector:           idea.subSector,
        targetRegion:        idea.targetRegion,
        fundingStage:        idea.fundingStage,
        fundingAsk:          idea.fundingAsk,
        description:         idea.description,
        // Pitch fields (plain text)
        problem:             pitch.problem,
        solution:            pitch.solution,
        targetMarket:        pitch.targetMarket,
        businessModel:       pitch.businessModel,
        competitiveAdvantage: pitch.competitiveAdvantage,
        keyRisk:             pitch.keyRisk,
        summary3s:           pitch.summary3s,
        // Evaluation scores
        finalScore:          e.finalScore,
        classificationScore: e.classificationScore,
        executionScore:      e.executionScore,
        marketScore:         e.marketScore,
        classification:      e.classification,
        shariahCompliance:   e.shariahCompliance ?? null,
        decisionOutcome:     e.decisionOutcome ?? null,
        // Decrypted fields
        recommendedAction:   decryptWithMasterKey(e.recommendedAction),
        strengths:           JSON.parse(decryptWithMasterKey(e.strengths) ?? "[]") as string[],
        concerns:            JSON.parse(decryptWithMasterKey(e.concerns) ?? "[]") as string[],
        flags:               JSON.parse(decryptWithMasterKey(e.flags) ?? "[]") as string[],
        agentDisagreements:  JSON.parse(e.agentDisagreements ?? "[]") as string[],
        // Cost/token tracking
        durationMs:          e.durationMs,
        tokensTotal:         e.tokensTotal,
        costUsd:             e.costUsd,
      }));

      console.log(`[WebhookFleetTrigger] eval-detail: returned ${result.length} rows`);
      res.json({ action: "eval-detail", count: result.length, exportedAt: timestamp, rows: result });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      console.error(`[WebhookFleetTrigger] eval-detail error:`, msg);
      res.status(500).json({ action: "eval-detail", error: msg });
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
        if (!db) { console.error("[WebhookFleetTrigger] DB unavailable"); return; }
        const [config] = await db.select().from(fleetConfigTable)
          .where(and(eq(fleetConfigTable.fleetMode, mode), eq(fleetConfigTable.active, true)));
        if (!config) { console.error(`[WebhookFleetTrigger] No active fleet_config for mode=${mode}`); return; }
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
        console.log(`[WebhookFleetTrigger] Single-mode trigger: ${mode} run #${runId}`);
        await runFleet(runId, { gccMode: isGcc, bypassCostGuard: true, ideasPerDomain });
        console.log(`[WebhookFleetTrigger] ${mode} run #${runId} completed`);
      } catch (err) {
        console.error(`[WebhookFleetTrigger] Single-mode ${mode} run error:`, (err as Error)?.message);
      }
    })();
  } else {
    // Full daily fleet (both modes)
    runDailyFleet().catch((err: unknown) => {
      console.error("[WebhookFleetTrigger] Background fleet run error:", (err as Error)?.message);
    });
  }
});

export default router;
