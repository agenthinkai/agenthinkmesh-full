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
 * After ALL fleet modes have run, sends one combined summary email to
 * farouq@agenthink.ai via Microsoft Graph API (sendGraphEmail).
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
import { notifyOwner } from "../_core/notification";
import { sendGraphEmail } from "../graphEmail";

// ── Kuwait timezone helpers ───────────────────────────────────────────────────

/** Format a UTC timestamp as "DD Mon YYYY · HH:MM" in Asia/Kuwait */
function formatKuwaitDateTime(ts: number): { date: string; time: string } {
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kuwait" };
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-GB", {
    ...opts,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }); // "26 Apr 2026"
  const time = d.toLocaleTimeString("en-GB", {
    ...opts,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }); // "06:00"
  return { date, time };
}

/** Format a UTC timestamp as "DD Mon YYYY" for the email subject */
function formatKuwaitDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kuwait",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Fleet run result record ───────────────────────────────────────────────────

interface FleetRunResult {
  mode: string;
  runId: number;
  status: "completed" | "failed";
  evaluations: number;
  totalIdeas: number;
  avgScore: number | null;
  runsRemaining: number;
}

// ── Combined email builder ────────────────────────────────────────────────────

async function buildAndSendFleetEmail(
  results: FleetRunResult[],
  runTs: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { date, time } = formatKuwaitDateTime(runTs);
  const dateLabel = formatKuwaitDate(runTs);

  // ── Pattern Moat: aggregate totals across all evaluations ──────────────────
  const globalAgg = await db
    .select({ total: sql<number>`COUNT(*)`, avgScore: avg(founderAgentEvaluations.finalScore) })
    .from(founderAgentEvaluations)
    .where(eq(founderAgentEvaluations.fleetMode, "global"));

  const gccAgg = await db
    .select({ total: sql<number>`COUNT(*)`, avgScore: avg(founderAgentEvaluations.finalScore) })
    .from(founderAgentEvaluations)
    .where(eq(founderAgentEvaluations.fleetMode, "gcc"));

  const globalTotal = Number(globalAgg[0]?.total ?? 0);
  const gccTotal = Number(gccAgg[0]?.total ?? 0);
  const globalAvg = globalAgg[0]?.avgScore ? parseFloat(String(globalAgg[0].avgScore)) : null;
  const gccAvg = gccAgg[0]?.avgScore ? parseFloat(String(gccAgg[0].avgScore)) : null;
  const gap =
    globalAvg !== null && gccAvg !== null
      ? (gccAvg - globalAvg).toFixed(2)
      : "N/A";
  const gapLabel =
    typeof gap === "string" && gap !== "N/A"
      ? `${parseFloat(gap) >= 0 ? "+" : ""}${gap} points`
      : "N/A";

  // ── Build per-mode blocks ──────────────────────────────────────────────────
  const modeBlocks = results.map((r) => {
    const modeTitle = r.mode === "gcc" ? "GCC FLEET" : "GLOBAL FLEET";
    const statusLabel = r.status === "completed" ? "completed" : "FAILED";
    const evalLabel = r.status === "completed" ? `${r.evaluations} / ${r.totalIdeas}` : `${r.evaluations} / ${r.totalIdeas} (incomplete)`;
    const scoreLabel = r.avgScore !== null ? r.avgScore.toFixed(2) : "N/A";
    return `${modeTitle}
Status:          ${statusLabel}
Evaluations:     ${evalLabel}
Avg score:       ${scoreLabel}
Runs remaining:  ${r.runsRemaining} / 30`;
  });

  // ── Plain-text body ────────────────────────────────────────────────────────
  const textBody = `Daily Fleet Run Summary
Date: ${date} · ${time} Kuwait time

${modeBlocks.join("\n\n")}

PATTERN MOAT
Total evaluations to date: ${globalTotal + gccTotal}
Global avg score:  ${globalAvg !== null ? globalAvg.toFixed(2) : "N/A"}
GCC avg score:     ${gccAvg !== null ? gccAvg.toFixed(2) : "N/A"}
GCC vs Global gap: ${gapLabel}

View full results:
https://agenthink-7enctkan.manus.space/admin/usage`;

  // ── HTML body ─────────────────────────────────────────────────────────────
  const modeBlocksHtml = results
    .map((r) => {
      const modeTitle = r.mode === "gcc" ? "GCC FLEET" : "GLOBAL FLEET";
      const statusColor = r.status === "completed" ? "#16a34a" : "#dc2626";
      const statusLabel = r.status === "completed" ? "completed" : "FAILED";
      const evalLabel =
        r.status === "completed"
          ? `${r.evaluations} / ${r.totalIdeas}`
          : `${r.evaluations} / ${r.totalIdeas} (incomplete)`;
      const scoreLabel = r.avgScore !== null ? r.avgScore.toFixed(2) : "N/A";
      return `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:0.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">${modeTitle}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;width:160px;">Status</td><td style="padding:4px 0;font-weight:600;color:${statusColor};">${statusLabel}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Evaluations</td><td style="padding:4px 0;">${evalLabel}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Avg score</td><td style="padding:4px 0;">${scoreLabel}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Runs remaining</td><td style="padding:4px 0;">${r.runsRemaining} / 30</td></tr>
      </table>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>AgenThink Fleet Report</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;padding:32px;">
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">AgenThink Fleet Report</div>
      <div style="font-size:20px;font-weight:700;color:#111827;">Daily Fleet Run Summary</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">Date: ${date} &middot; ${time} Kuwait time</div>
    </div>

    ${modeBlocksHtml}

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:0.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">PATTERN MOAT</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Total evaluations to date</td><td style="padding:4px 0;">${globalTotal + gccTotal}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Global avg score</td><td style="padding:4px 0;">${globalAvg !== null ? globalAvg.toFixed(2) : "N/A"}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">GCC avg score</td><td style="padding:4px 0;">${gccAvg !== null ? gccAvg.toFixed(2) : "N/A"}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">GCC vs Global gap</td><td style="padding:4px 0;font-weight:600;">${gapLabel}</td></tr>
    </table>

    <a href="https://agenthink-7enctkan.manus.space/admin/usage"
       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;">
      View full results &rarr;
    </a>
  </div>
</body>
</html>`;

  const subject = `AgenThink Fleet Report — ${dateLabel} Kuwait`;

  const sent = await sendGraphEmail({
    to: "farouq@agenthink.ai",
    subject,
    html,
  });

  if (sent) {
    console.log(`[FounderFleet] Fleet summary email sent to farouq@agenthink.ai — "${subject}"`);
  } else {
    console.error("[FounderFleet] Fleet summary email FAILED — check Graph API credentials");
  }

  // Log plain-text body to console for debugging
  console.log("[FounderFleet] Email body preview:\n" + textBody);
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

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
    const runTs = Date.now();
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

    const fleetResults: FleetRunResult[] = [];

    for (const config of activeConfigs) {
      const isGcc = config.fleetMode === "gcc";
      console.log(`[FounderFleet] Starting ${config.fleetMode} fleet run (${config.runsRemaining} remaining)`);

      // Per-mode idea targets: GCC=200 (5 domains ×40), Global=300 (5 domains ×60)
      const ideasPerDomain = isGcc ? 40 : 60;
      const targetIdeas = isGcc ? 200 : 300;

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
          totalIdeas: targetIdeas,
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
        await runFleet(runId, { gccMode: isGcc, bypassCostGuard: true, ideasPerDomain });

        // ── Post-run: check actual DB status ──────────────────────────────────
        const dbPost = await getDb();
        if (!dbPost) {
          console.warn(`[FounderFleet] DB unavailable after ${config.fleetMode} run #${runId} — skipping counter update`);
          fleetResults.push({
            mode: config.fleetMode,
            runId,
            status: "failed",
            evaluations: 0,
            totalIdeas: targetIdeas,
            avgScore: null,
            runsRemaining: config.runsRemaining,
          });
          continue;
        }

        const [runRow] = await dbPost
          .select({
            status: founderAgentRuns.status,
            completed: founderAgentRuns.completed,
            totalIdeas: founderAgentRuns.totalIdeas,
          })
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

          // In-app notification — success
          notifyOwner({
            title: `Fleet run complete — ${config.fleetMode}`,
            content: `${config.fleetMode} run #${runId} completed:\n${runRow?.completed ?? targetIdeas}/${targetIdeas} evaluations\nAvg score: ${avgScore?.toFixed(2) ?? "N/A"}\nRuns remaining: ${newRemaining}`,
          }).catch((notifyErr: unknown) =>
            console.error(`[FounderFleet] notifyOwner failed for ${config.fleetMode} run #${runId}:`, (notifyErr as Error)?.message)
          );

          fleetResults.push({
            mode: config.fleetMode,
            runId,
            status: "completed",
            evaluations: runRow?.completed ?? targetIdeas,
            totalIdeas: runRow?.totalIdeas ?? targetIdeas,
            avgScore,
            runsRemaining: newRemaining,
          });
        } else {
          console.error(`[FounderFleet] ${config.fleetMode} run #${runId} did not complete — fleet_config counters NOT updated`);

          // In-app notification — failure
          notifyOwner({
            title: `Fleet run failed — ${config.fleetMode}`,
            content: `${config.fleetMode} run #${runId} failed at ${runRow?.completed ?? 0}/${runRow?.totalIdeas ?? targetIdeas} evaluations.\nCheck logs for details.\nRuns remaining: ${config.runsRemaining}`,
          }).catch((notifyErr: unknown) =>
            console.error(`[FounderFleet] notifyOwner failed for ${config.fleetMode} run #${runId}:`, (notifyErr as Error)?.message)
          );

          fleetResults.push({
            mode: config.fleetMode,
            runId,
            status: "failed",
            evaluations: runRow?.completed ?? 0,
            totalIdeas: runRow?.totalIdeas ?? targetIdeas,
            avgScore: null,
            runsRemaining: config.runsRemaining,
          });
        }

      } catch (err) {
        console.error(`[FounderFleet] Failed to create ${config.fleetMode} run:`, (err as Error)?.message);
        fleetResults.push({
          mode: config.fleetMode,
          runId: -1,
          status: "failed",
          evaluations: 0,
          totalIdeas: targetIdeas,
          avgScore: null,
          runsRemaining: config.runsRemaining,
        });
      }
    }

    // ── Send one combined summary email after ALL fleet modes complete ─────────
    if (fleetResults.length > 0) {
      buildAndSendFleetEmail(fleetResults, runTs).catch((emailErr: unknown) =>
        console.error("[FounderFleet] Fleet summary email error:", (emailErr as Error)?.message)
      );
    }

  }, { timezone: "UTC" });

  console.log("[FounderFleet] Daily scheduler registered — fires at 06:00 KWT (03:00 UTC)");
}
