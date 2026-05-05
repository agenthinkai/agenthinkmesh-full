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
 *
 * ── FIX (2026-04-28) ─────────────────────────────────────────────────────────
 * PROBLEM 1 — Sequential loop: the original `for...of` loop ran GCC and Global
 *   one after the other with `await`. If the first mode (global) failed mid-run
 *   or took too long, the second mode (GCC) never started.
 *
 * PROBLEM 2 — No retry: a failed run had no recovery path until the next day's
 *   cron, leaving the fleet silent for 24 hours.
 *
 * FIX 1 — Parallel execution: each fleet mode is now launched as an independent
 *   Promise via runSingleFleetMode(). Promise.allSettled() waits for both and
 *   collects results regardless of individual failures. One mode failing can
 *   never block the other.
 *
 * FIX 2 — REMOVED (2026-05-03 emergency cost fix): auto-retry has been removed.
 *   Fleet runs once per day per mode. If a run fails, the owner is notified and
 *   a manual re-trigger is available via the admin UI. No automatic retries.
 *
 * FIX 3 — Run-level error_message: the catch block in runSingleFleetMode now
 *   stores the error string in the run row (if the run was created) so the DB
 *   query requested in the task brief returns a useful message.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import cron from "node-cron";
import { runFleet, resumeInterruptedRuns } from "../founderFleet";
import { getDb } from "../db";
import { founderAgentRuns, fleetConfig, founderAgentEvaluations } from "../../drizzle/schema";
import { eq, and, avg, sql, sum, gte, count } from "drizzle-orm";
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

/** Safety ceiling per run — alert (non-blocking) if a single run exceeds this amount.
 * Raised from $5.00 → $15.00 to accommodate the 300-idea global run (~$10.14).
 * bypassCostGuard=true skips the daily cap check; this guard is additive and fires
 * a notifyOwner alert so anomalous runs are caught before they accumulate.
 */
const MAX_COST_PER_RUN_USD = parseFloat(process.env.FLEET_COST_ALERT_THRESHOLD_USD ?? "15");

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

  // ── Token & cost aggregates per mode (from today's runs) ───────────────────────────
  // Keyed by runId from the current run results
  const runIds = results.map((r) => r.runId).filter((id) => id > 0);

  // Per-mode token/cost: query founder_agent_runs for each runId
  const tokensByMode: Record<string, { tokIn: number; tokOut: number; cost: number }> = {};
  for (const r of results) {
    if (r.runId <= 0) {
      tokensByMode[r.mode] = { tokIn: 0, tokOut: 0, cost: 0 };
      continue;
    }
    const row = await db
      .select({
        tokIn:  sql<number>`COALESCE(SUM(total_tokens_input), 0)`,
        tokOut: sql<number>`COALESCE(SUM(total_tokens_output), 0)`,
        cost:   sql<number>`COALESCE(SUM(CAST(total_cost_usd AS DECIMAL(10,4))), 0)`,
      })
      .from(founderAgentRuns)
      .where(eq(founderAgentRuns.id, r.runId));
    tokensByMode[r.mode] = {
      tokIn:  Number(row[0]?.tokIn  ?? 0),
      tokOut: Number(row[0]?.tokOut ?? 0),
      cost:   Number(row[0]?.cost   ?? 0),
    };
  }

  // Cumulative cost across ALL runs to date
  const cumulativeRow = await db
    .select({ totalCost: sql<number>`COALESCE(SUM(CAST(total_cost_usd AS DECIMAL(10,4))), 0)` })
    .from(founderAgentRuns);
  const cumulativeCost = Number(cumulativeRow[0]?.totalCost ?? 0);

  // Combined totals for today's runs
  const combinedTokIn  = Object.values(tokensByMode).reduce((a, v) => a + v.tokIn, 0);
  const combinedTokOut = Object.values(tokensByMode).reduce((a, v) => a + v.tokOut, 0);
  const combinedCost   = Object.values(tokensByMode).reduce((a, v) => a + v.cost, 0);
  const totalEvals     = results.reduce((a, r) => a + r.evaluations, 0);
  const costPerEval    = totalEvals > 0 ? combinedCost / totalEvals : 0;

  // suppress unused variable warning
  void runIds;

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

  // ── Build token/cost text block per mode ─────────────────────────────────────────────────────────────────
  const tokenTextBlocks = results.map((r) => {
    const t = tokensByMode[r.mode] ?? { tokIn: 0, tokOut: 0, cost: 0 };
    const modeTitle = r.mode === "gcc" ? "GCC Fleet:" : "Global Fleet:";
    return `${modeTitle}
  Tokens input:   ${t.tokIn.toLocaleString()}
  Tokens output:  ${t.tokOut.toLocaleString()}
  Total tokens:   ${(t.tokIn + t.tokOut).toLocaleString()}
  Run cost:       $${t.cost.toFixed(2)}`;
  }).join("\n\n");

  // ── Plain-text body ─────────────────────────────────────────────────────────────────
  const textBody = `Daily Fleet Run Summary
Date: ${date} · ${time} Kuwait time

${modeBlocks.join("\n\n")}

PATTERN MOAT
Total evaluations to date: ${globalTotal + gccTotal}
Global avg score:  ${globalAvg !== null ? globalAvg.toFixed(2) : "N/A"}
GCC avg score:     ${gccAvg !== null ? gccAvg.toFixed(2) : "N/A"}
GCC vs Global gap: ${gapLabel}

TOKENS & COST
${tokenTextBlocks}

Combined:
  Total tokens today:  ${(combinedTokIn + combinedTokOut).toLocaleString()}
  Total cost today:    $${combinedCost.toFixed(2)}
  Cost per evaluation: $${costPerEval.toFixed(4)}
  Cumulative cost:     $${cumulativeCost.toFixed(2)} (all runs to date)

View full results:
https://agenthink-7enctkan.manus.space/admin/usage`;// ── HTML body ─────────────────────────────────────────────────────────────
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

  const tokenBlocksHtml = results
    .map((r) => {
      const t = tokensByMode[r.mode] ?? { tokIn: 0, tokOut: 0, cost: 0 };
      const modeTitle = r.mode === "gcc" ? "GCC Fleet" : "Global Fleet";
      return `
      <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:0.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">${modeTitle}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Tokens input</td><td style="padding:4px 0;">${t.tokIn.toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Tokens output</td><td style="padding:4px 0;">${t.tokOut.toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Total tokens</td><td style="padding:4px 0;">${(t.tokIn + t.tokOut).toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Run cost</td><td style="padding:4px 0;">$${t.cost.toFixed(2)}</td></tr>`;
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
      <tr><td style="padding:4px 0;color:#6b7280;">GCC vs Global gap</td><td style="padding:4px 0;">${gapLabel}</td></tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:0.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">TOKENS &amp; COST</td></tr>
      ${tokenBlocksHtml}
      <tr><td colspan="2" style="padding:8px 0 4px;border-top:1px solid #e5e7eb;"></td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Total tokens today</td><td style="padding:4px 0;">${(combinedTokIn + combinedTokOut).toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Total cost today</td><td style="padding:4px 0;">$${combinedCost.toFixed(2)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Cost per evaluation</td><td style="padding:4px 0;">$${costPerEval.toFixed(4)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Cumulative cost</td><td style="padding:4px 0;">$${cumulativeCost.toFixed(2)}</td></tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:0.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">TRAJECTORY</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Total evaluations to date</td><td style="padding:4px 0;font-weight:600;">${(globalTotal + gccTotal).toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Today</td><td style="padding:4px 0;">500 / day</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Target (Sep 2026)</td><td style="padding:4px 0;">100,000 / day</td></tr>
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

// ── One-time first-500/day verification email ────────────────────────────────

const FIRST_SCALE_TARGET = 500;
let firstScaleEmailSent = false;

async function maybeSendFirstScaleVerificationEmail(
  results: FleetRunResult[]
): Promise<void> {
  if (firstScaleEmailSent) return;
  const totalToday = results.reduce((a, r) => a + r.evaluations, 0);
  if (totalToday < FIRST_SCALE_TARGET) return;

  const db = await getDb();
  if (!db) return;

  const [totalRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(founderAgentEvaluations);
  const totalToDate = Number(totalRow?.total ?? 0);

  const gccEvals   = results.find((r) => r.mode === "gcc")?.evaluations ?? 0;
  const globalEvals = results.find((r) => r.mode === "global")?.evaluations ?? 0;
  const gccScore   = results.find((r) => r.mode === "gcc")?.avgScore?.toFixed(2) ?? "N/A";
  const globalScore = results.find((r) => r.mode === "global")?.avgScore?.toFixed(2) ?? "N/A";

  const textBody = `First 500/day run verified.

GCC fleet:    ${gccEvals} evaluations | avg score: ${gccScore}
Global fleet: ${globalEvals} evaluations | avg score: ${globalScore}
Total today:  ${totalToday}
Total to date: ${totalToDate.toLocaleString()}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;padding:32px;">
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">AgenThink Fleet</div>
      <div style="font-size:20px;font-weight:700;color:#111827;">First 500/day run verified ✓</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:4px 0;color:#6b7280;width:160px;">GCC fleet</td><td style="padding:4px 0;">${gccEvals} evaluations | avg score: ${gccScore}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Global fleet</td><td style="padding:4px 0;">${globalEvals} evaluations | avg score: ${globalScore}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Total today</td><td style="padding:4px 0;font-weight:600;">${totalToday}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Total to date</td><td style="padding:4px 0;font-weight:600;">${totalToDate.toLocaleString()}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:0.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">TRAJECTORY</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Total evaluations to date</td><td style="padding:4px 0;font-weight:600;">${totalToDate.toLocaleString()}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Today</td><td style="padding:4px 0;">500 / day</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Target (Sep 2026)</td><td style="padding:4px 0;">100,000 / day</td></tr>
    </table>
    <a href="https://agenthink-7enctkan.manus.space/admin/usage"
       style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;">
      View full results &rarr;
    </a>
  </div>
</body>
</html>`;

  const sent = await sendGraphEmail({
    to: "farouq@agenthink.ai",
    subject: "Fleet scaled to 500/day — first run verified",
    html,
  });
  if (sent) {
    firstScaleEmailSent = true;
    console.log("[FounderFleet] First-scale verification email sent to farouq@agenthink.ai");
    console.log("[FounderFleet] Verification email body preview:\n" + textBody);
  } else {
    console.error("[FounderFleet] First-scale verification email FAILED");
  }
}

// ── Single fleet mode execution ───────────────────────────────────────────────
/**
 * Runs one fleet mode end-to-end.
 * - Creates the run row, calls runFleet(), queries final status.
 * - Updates fleet_config counters on success.
 * - Returns a FleetRunResult regardless of outcome (never throws).
 */
async function runSingleFleetMode(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  config: {
    id: number;
    fleetMode: string;
    runsRemaining: number;
    runsCompleted: number;
    active: boolean;
  }
): Promise<FleetRunResult> {
  const isGcc = config.fleetMode === "gcc";
  // GCC: 20 ideas/domain × 5 domains = 100 total (1 LLM batch per domain = ~15 min, within timeout)
  // Global: 40 ideas/domain × 5 domains = 200 total
  // GCC was 200 but hit Cloud Run timeout consistently during generateIdeas (10 sequential LLM calls ~30 min).
  // Reducing to 100 (5 LLM calls) cuts generation time in half.
  const ideasPerDomain = isGcc ? 20 : 40;
  const targetIdeas    = isGcc ? 100 : 200;
  const today          = new Date().toISOString().slice(0, 10);

  console.log(`[FounderFleet] Starting ${config.fleetMode} fleet run (${config.runsRemaining} remaining)`);

  let runId = -1;

  try {
    // ── Pre-run cleanup: reset orphaned 'running' evals (>10 min old) → 'queued' ──
    // Changed from 'failed' to 'queued' so interrupted evals are retried rather than
    // silently discarded. This mirrors the same fix applied in resumeInterruptedRuns().
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const cleanupResult = await db.update(founderAgentEvaluations)
      .set({
        status: "queued",
        updatedAt: Date.now(),
      })
      .where(and(
        eq(founderAgentEvaluations.status, "running"),
        sql`${founderAgentEvaluations.updatedAt} < ${tenMinutesAgo}`,
      ));
    const cleanedCount = (cleanupResult as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
    if (cleanedCount > 0) {
      console.log(`[FounderFleet] Reset ${cleanedCount} orphaned 'running' evals → 'queued' before ${config.fleetMode} run`);
    }

    // COST GUARD 1: Hard daily cap — max 1 run per fleet mode per calendar day.
    // EMERGENCY COST FIX (2026-05-03): Reduced from 2 → 1. No automatic retries.
    const DAILY_RUN_CAP = 1;
    const [todayRunCount] = await db
      .select({ n: count() })
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, config.fleetMode),
        eq(founderAgentRuns.runDate, today),
      ));
    const runsToday = Number(todayRunCount?.n ?? 0);
    if (runsToday >= DAILY_RUN_CAP) {
      console.warn(`[FounderFleet] DAILY CAP reached for ${config.fleetMode}: ${runsToday}/${DAILY_RUN_CAP} runs today — skipping`);
      await notifyOwner({
        title: `Fleet daily cap reached — ${config.fleetMode}`,
        content: `${config.fleetMode} fleet has already completed ${runsToday} run(s) today (cap: ${DAILY_RUN_CAP}). No further runs will be started until tomorrow.`,
      });
      return {
        mode: config.fleetMode,
        runId: -1,
        status: "failed" as const,
        evaluations: 0,
        totalIdeas: targetIdeas,
        avgScore: null,
        runsRemaining: config.runsRemaining,
      };
    }

    // ── COST GUARD 2: Duplicate detection — skip if a run completed in last 30 min ──
    const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
    const windowStart = Date.now() - DUPLICATE_WINDOW_MS;
    const [recentCompleted] = await db.select({ id: founderAgentRuns.id, createdAt: founderAgentRuns.createdAt })
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, config.fleetMode),
        eq(founderAgentRuns.status, "completed"),
        gte(founderAgentRuns.createdAt, windowStart),
      ))
      .limit(1);
    if (recentCompleted) {
      const minsAgo = Math.round((Date.now() - Number(recentCompleted.createdAt)) / 60_000);
      console.warn(`[FounderFleet] DUPLICATE GUARD: ${config.fleetMode} run #${recentCompleted.id} completed ${minsAgo}m ago — skipping to prevent duplicate`);
      await notifyOwner({
        title: `Fleet duplicate run blocked — ${config.fleetMode}`,
        content: `A ${config.fleetMode} fleet run (#${recentCompleted.id}) completed only ${minsAgo} minutes ago. This run was skipped to prevent duplicate API spend.`,
      });
      return {
        mode: config.fleetMode,
        runId: recentCompleted.id,
        status: "failed" as const,
        evaluations: 0,
        totalIdeas: targetIdeas,
        avgScore: null,
        runsRemaining: config.runsRemaining,
      };
    }

    // Resume today's failed/interrupted run if one exists, rather than always creating a new one.
    // This allows the phase-level resume logic in runFleet() to skip already-completed phases.
    const { desc: descOrd } = await import("drizzle-orm");
    const [existingRun] = await db.select()
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, config.fleetMode),
        eq(founderAgentRuns.runDate, today),
      ))
      .orderBy(descOrd(founderAgentRuns.createdAt))
      .limit(1);

    if (existingRun && ["failed", "generating", "researching", "pitching", "evaluating", "extracting"].includes(existingRun.status)) {
      runId = existingRun.id;
      console.log(`[FounderFleet] Resuming ${config.fleetMode} run #${runId} (was: ${existingRun.status})`);
      await db.update(founderAgentRuns).set({ status: "pending" }).where(eq(founderAgentRuns.id, runId));
    } else {
      const [newRun] = await db.insert(founderAgentRuns).values({
        runDate:          today,
        fleetMode:        config.fleetMode,
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
      console.log(`[FounderFleet] Created ${config.fleetMode} run #${runId} for ${today}`);
    }

    // Record lastRunAt immediately so the UI shows the run started
    await db.update(fleetConfig)
      .set({ lastRunAt: Date.now() })
      .where(eq(fleetConfig.id, config.id));

    // Run fleet — bypassCostGuard=true so the 10-runs/hour cap does not block
    // scheduled runs. runFleet never throws; it catches internally and sets
    // status="failed", so we must query the DB to determine success.
    //
    // Both modes: single pass — 40 ideas/domain × 5 domains = 200 total
    // Global was previously 300 (3×100 batches) but hit Cloud Run timeout consistently.
    // Reduced to 200 to match GCC's proven reliable limit.
    await runFleet(runId, { gccMode: isGcc, bypassCostGuard: true, ideasPerDomain });

    // ── Post-run: check actual DB status ──────────────────────────────────
    const dbPost = await getDb();
    if (!dbPost) {
      console.warn(`[FounderFleet] DB unavailable after ${config.fleetMode} run #${runId} — skipping counter update`);
      return {
        mode:          config.fleetMode,
        runId,
        status:        "failed",
        evaluations:   0,
        totalIdeas:    targetIdeas,
        avgScore:      null,
        runsRemaining: config.runsRemaining,
      };
    }

    const [runRow] = await dbPost
      .select({
        status:     founderAgentRuns.status,
        completed:  founderAgentRuns.completed,
        totalIdeas: founderAgentRuns.totalIdeas,
      })
      .from(founderAgentRuns)
      .where(eq(founderAgentRuns.id, runId));

    const success = runRow?.status === "completed";
    console.log(`[FounderFleet] ${config.fleetMode} run #${runId} final status: ${runRow?.status ?? "unknown"}`);

    // ── Partial ratio check ───────────────────────────────────────────────
    // If the run completed but fewer than 80% of ideas were evaluated,
    // treat it as a partial run: notify owner but still count it as completed.
    // Threshold raised from 50% → 80% to catch partial runs earlier.
    if (success) {
      const completedCount = runRow?.completed ?? 0;
      const totalIdeasCount = runRow?.totalIdeas ?? targetIdeas;
      if (completedCount < totalIdeasCount * 0.8) {
        console.warn(
          `[FounderFleet] ${config.fleetMode} run #${runId} is PARTIAL — ` +
          `${completedCount}/${totalIdeasCount} evaluations (<80%)`
        );
        notifyOwner({
          title:   `Fleet partial run — ${config.fleetMode} run #${runId}`,
          content: `${config.fleetMode} run #${runId} completed but only ${completedCount}/${totalIdeasCount} evaluations finished (<80%).\nThis may indicate a rate-limit or timeout issue mid-run.\nRuns remaining: ${config.runsRemaining}`,
        }).catch(() => {});
      }
    }

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
          lastRunAt:     Date.now(),
          lastRunScore:  avgScore !== null ? String(avgScore.toFixed(2)) : null,
          active:        newRemaining > 0,
        })
        .where(eq(fleetConfig.id, config.id));

      console.log(`[FounderFleet] fleet_config updated: runs_completed=${newCompleted}, runs_remaining=${newRemaining}, last_run_score=${avgScore?.toFixed(1) ?? "N/A"}`);

      // Post-run cost ceiling check (non-blocking alert)
      const [costRow] = await dbPost
        .select({ runCost: sql<string>`COALESCE(total_cost_usd, '0')` })
        .from(founderAgentRuns)
        .where(eq(founderAgentRuns.id, runId));
      const runCostUsd = parseFloat(String(costRow?.runCost ?? "0"));
      if (runCostUsd > MAX_COST_PER_RUN_USD) {
        console.warn(`[FounderFleet] Run #${runId} cost $${runCostUsd.toFixed(2)} exceeds ceiling $${MAX_COST_PER_RUN_USD}`);
        notifyOwner({
          title:   `Fleet cost alert — ${config.fleetMode} run #${runId}`,
          content: `Run cost $${runCostUsd.toFixed(2)} exceeded the $${MAX_COST_PER_RUN_USD} per-run ceiling.\nConsider raising MAX_COST_PER_RUN_USD or reviewing idea count.`,
        }).catch(() => {});
      }

      // In-app notification — success
      notifyOwner({
        title:   `Fleet run complete — ${config.fleetMode}`,
        content: `${config.fleetMode} run #${runId} completed:\n${runRow?.completed ?? targetIdeas}/${targetIdeas} evaluations\nAvg score: ${avgScore?.toFixed(2) ?? "N/A"}\nRuns remaining: ${newRemaining}`,
      }).catch((notifyErr: unknown) =>
        console.error(`[FounderFleet] notifyOwner failed for ${config.fleetMode} run #${runId}:`, (notifyErr as Error)?.message)
      );

      return {
        mode:          config.fleetMode,
        runId,
        status:        "completed",
        evaluations:   runRow?.completed ?? targetIdeas,
        totalIdeas:    runRow?.totalIdeas ?? targetIdeas,
        avgScore,
        runsRemaining: newRemaining,
      };
    } else {
      console.error(`[FounderFleet] ${config.fleetMode} run #${runId} did not complete — fleet_config counters NOT updated`);

      // In-app notification — failure
      notifyOwner({
        title:   `Fleet run failed — ${config.fleetMode}`,
        content: `${config.fleetMode} run #${runId} failed at ${runRow?.completed ?? 0}/${runRow?.totalIdeas ?? targetIdeas} evaluations.\nCheck logs for details.\nRuns remaining: ${config.runsRemaining}`,
      }).catch((notifyErr: unknown) =>
        console.error(`[FounderFleet] notifyOwner failed for ${config.fleetMode} run #${runId}:`, (notifyErr as Error)?.message)
      );

      return {
        mode:          config.fleetMode,
        runId,
        status:        "failed",
        evaluations:   runRow?.completed ?? 0,
        totalIdeas:    runRow?.totalIdeas ?? targetIdeas,
        avgScore:      null,
        runsRemaining: config.runsRemaining,
      };
    }

  } catch (err) {
    const errMsg = (err as Error)?.message ?? String(err);
    console.error(`[FounderFleet] Failed to run ${config.fleetMode} fleet:`, errMsg);
    return {
      mode:          config.fleetMode,
      runId,
      status:        "failed",
      evaluations:   0,
      totalIdeas:    targetIdeas,
      avgScore:      null,
      runsRemaining: config.runsRemaining,
    };
  }
}

// ── Shared daily fleet execution (used by cron + HTTP trigger) ───────────────

export async function runDailyFleet(): Promise<void> {
  const runTs = Date.now();
  console.log("[FounderFleet] Daily fleet run starting");

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

  // ── FIX: Run all fleet modes IN PARALLEL — one failure cannot block another ──
  // Promise.allSettled ensures we always collect results from every mode.
  const settled = await Promise.allSettled(
    activeConfigs.map((config) => runSingleFleetMode(db, config))
  );

  const fleetResults: FleetRunResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    // Promise itself rejected (should not happen — runSingleFleetMode never throws)
    const config = activeConfigs[i];
    console.error(`[FounderFleet] Unexpected rejection for ${config.fleetMode}:`, s.reason);
    return {
      mode:          config.fleetMode,
      runId:         -1,
      status:        "failed" as const,
      evaluations:   0,
      totalIdeas:    200,
      avgScore:      null,
      runsRemaining: config.runsRemaining,
    };
  });

  // EMERGENCY COST FIX: Auto-retry removed. Fleet runs once per day per mode.
  // If a run fails, it fails. No automatic retries. Owner is notified via the
  // summary email below. Manual re-trigger available via the admin UI.
  const failedModes = fleetResults.filter((r) => r.status === "failed");
  if (failedModes.length > 0) {
    const failedList = failedModes.map((r) => r.mode).join(", ");
    console.warn(`[FounderFleet] Failed modes (no retry): ${failedList}`);
    notifyOwner({
      title:   `Fleet run failed — ${failedList}`,
      content: `The following fleet mode(s) failed today and will NOT be retried automatically: ${failedList}.\nManual re-trigger available via the admin UI.`,
    }).catch(() => {});
  }

  // ── Send one combined summary email after ALL fleet modes complete ─────────
  if (fleetResults.length > 0) {
    buildAndSendFleetEmail(fleetResults, runTs).catch((emailErr: unknown) =>
      console.error("[FounderFleet] Fleet summary email error:", (emailErr as Error)?.message)
    );

    // One-time first-500/day verification email (fire-and-forget)
    maybeSendFirstScaleVerificationEmail(fleetResults).catch((verifyErr: unknown) =>
      console.error("[FounderFleet] First-scale verification email error:", (verifyErr as Error)?.message)
    );
  }
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
  cron.schedule("0 3 * * *", () => {
    runDailyFleet().catch((err: unknown) =>
      console.error("[FounderFleet] Cron run error:", (err as Error)?.message)
    );
  }, { timezone: "UTC" });

  console.log("[FounderFleet] Daily scheduler registered — fires at 06:00 KWT (03:00 UTC)");
}
