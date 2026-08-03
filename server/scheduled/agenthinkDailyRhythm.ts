/**
 * server/scheduled/agenthinkDailyRhythm.ts
 *
 * AgenThink Mesh — Daily Operating Rhythm (Step 11)
 *
 * Runs daily at 07:00 UTC (10:00 Kuwait time, GST+3).
 * Generates a morning brief summarising:
 *   - Pending decisions in the queue
 *   - Outcome ledger accuracy metrics (last 30 days)
 *   - Open council sessions
 *   - KPI pulse (ARR, burn, GPU utilisation — from latest twin session notes)
 *
 * Route: POST /api/scheduled/agenthink-daily-rhythm
 * Auth:  Bearer SCHEDULER_SECRET
 *
 * Heartbeat registration (run once from admin):
 *   trpc.system.heartbeat.create({
 *     name: "agenthink-daily-rhythm",
 *     cron: "0 0 7 * * *",
 *     path: "/api/scheduled/agenthink-daily-rhythm",
 *     description: "AgenThink Mesh — Daily Operating Rhythm morning brief"
 *   })
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { outcomeSessions, twinSessions } from "../../drizzle/schema";
import { gte, desc, eq, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export async function handleAgenThinkDailyRhythm(req: Request, res: Response) {
  const secret = process.env.SCHEDULER_SECRET;
  const auth = req.headers.authorization ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Database unavailable" });

  const runId = `agenthink-daily-${Date.now()}`;
  const steps: string[] = [];
  const now = Date.now();
  const since30d = now - 30 * 24 * 60 * 60 * 1000;
  const since7d = now - 7 * 24 * 60 * 60 * 1000;

  try {
    // Step 1: Count pending outcome sessions (UNKNOWN status = awaiting resolution)
    const pendingDecisions = await db
      .select()
      .from(outcomeSessions)
      .where(eq(outcomeSessions.outcomeStatus, "UNKNOWN"))
      .limit(50);
    steps.push(`Step 1: ${pendingDecisions.length} decisions pending outcome resolution`);

    // Step 2: Outcome accuracy over last 30 days
    const recentOutcomes = await db
      .select()
      .from(outcomeSessions)
      .where(gte(outcomeSessions.decisionDate, since30d))
      .orderBy(desc(outcomeSessions.decisionDate))
      .limit(200);

    const succeeded = recentOutcomes.filter(o => o.outcomeStatus === "SUCCEEDED").length;
    const failed = recentOutcomes.filter(o => o.outcomeStatus === "FAILED").length;
    const resolved = succeeded + failed;
    const accuracy = resolved > 0 ? Math.round((succeeded / resolved) * 100) : null;
    steps.push(`Step 2: ${resolved} resolved decisions in 30d — accuracy ${accuracy !== null ? `${accuracy}%` : "N/A"}`);

    // Step 3: Recent twin sessions (last 7 days) for AgenThink org
    const recentSessions = await db
      .select()
      .from(twinSessions)
      .where(sql`${twinSessions.createdAt} >= ${new Date(since7d)}`)
      .orderBy(desc(twinSessions.createdAt))
      .limit(20);
    steps.push(`Step 3: ${recentSessions.length} twin sessions in last 7 days`);

    // Step 4: Build morning brief
    const pendingSummary = pendingDecisions.length === 0
      ? "No decisions pending resolution."
      : pendingDecisions.slice(0, 5).map(d =>
          `• ${d.dealId} — ${d.originalVerdict} (${d.councilMode})`
        ).join("\n") + (pendingDecisions.length > 5 ? `\n  …and ${pendingDecisions.length - 5} more` : "");

    const accuracySummary = accuracy !== null
      ? `Council accuracy (30d): **${accuracy}%** (${succeeded} correct / ${resolved} resolved)`
      : "No resolved decisions in the past 30 days.";

    const sessionSummary = recentSessions.length === 0
      ? "No twin sessions in the past 7 days."
      : `${recentSessions.length} sessions — most recent: ${(recentSessions[0].createdAt as Date).toISOString().slice(0, 10)}`;

    const brief = [
      `# AgenThink Mesh — Daily Operating Rhythm`,
      `**Date:** ${new Date(now).toISOString().slice(0, 10)} (07:00 UTC)`,
      ``,
      `## Decision Queue`,
      pendingSummary,
      ``,
      `## Outcome Accuracy (30-day)`,
      accuracySummary,
      ``,
      `## Twin Activity (7-day)`,
      sessionSummary,
      ``,
      `## Action Required`,
      pendingDecisions.length > 0
        ? `Review ${pendingDecisions.length} pending decisions at /twin/agenthink`
        : `No immediate action required. All decisions resolved.`,
    ].join("\n");

    // Step 5: Notify owner
    await notifyOwner({
      title: `AgenThink Daily Brief — ${new Date(now).toISOString().slice(0, 10)}`,
      content: brief,
    });
    steps.push("Step 5: Morning brief sent to owner");

    return res.json({
      runId,
      steps,
      status: "ok",
      metrics: {
        pendingDecisions: pendingDecisions.length,
        accuracy,
        recentSessions: recentSessions.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push(`ERROR: ${message}`);
    return res.status(500).json({ runId, steps, status: "error", error: message });
  }
}
