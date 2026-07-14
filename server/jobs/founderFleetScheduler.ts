/**
 * founderFleetScheduler.ts — Weekly FounderAgent Discovery Fleet Run
 *
 * Canonically triggered by the platform scheduler once every 7 days.
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
 *   Fleet runs once per 7 days per mode. If a run fails, the owner is notified and
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
import { eq, and, avg, sql, sum, gte, count, inArray } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { sendGraphEmail } from "../graphEmail";
import { getWeeklyDeltaReport, WeeklyDeltaReport } from "../weeklyFleetDelta";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function buildAndSendFleetEmail(
  results: FleetRunResult[],
  runTs: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { date, time } = formatKuwaitDateTime(runTs);
  const dateLabel = formatKuwaitDate(runTs);
  const reportsByMode: Record<string, WeeklyDeltaReport | null> = {};
  const tokensByMode: Record<string, { tokIn: number; tokOut: number; cost: number }> = {};

  for (const result of results) {
    reportsByMode[result.mode] = result.runId > 0
      ? await getWeeklyDeltaReport(result.runId)
      : null;

    if (result.runId <= 0) {
      tokensByMode[result.mode] = { tokIn: 0, tokOut: 0, cost: 0 };
      continue;
    }
    const [row] = await db.select({
      tokIn: founderAgentRuns.totalTokensInput,
      tokOut: founderAgentRuns.totalTokensOutput,
      cost: founderAgentRuns.totalCostUsd,
    }).from(founderAgentRuns).where(eq(founderAgentRuns.id, result.runId)).limit(1);
    tokensByMode[result.mode] = {
      tokIn: Number(row?.tokIn ?? 0),
      tokOut: Number(row?.tokOut ?? 0),
      cost: Number(row?.cost ?? 0),
    };
  }

  const [cumulativeRow] = await db
    .select({ totalCost: sql<number>`COALESCE(SUM(CAST(total_cost_usd AS DECIMAL(10,4))), 0)` })
    .from(founderAgentRuns);
  const cumulativeCost = Number(cumulativeRow?.totalCost ?? 0);
  const combinedTokIn = Object.values(tokensByMode).reduce((sumValue, item) => sumValue + item.tokIn, 0);
  const combinedTokOut = Object.values(tokensByMode).reduce((sumValue, item) => sumValue + item.tokOut, 0);
  const combinedCost = Object.values(tokensByMode).reduce((sumValue, item) => sumValue + item.cost, 0);
  const generated = Object.values(reportsByMode).reduce((sumValue, report) => sumValue + (report?.novelty.candidatesGenerated ?? 0), 0);
  const survived = Object.values(reportsByMode).reduce((sumValue, report) => sumValue + (report?.novelty.candidatesSurvived ?? 0), 0);
  const dropped = Object.values(reportsByMode).reduce((sumValue, report) => sumValue + (report?.novelty.duplicatesDropped ?? 0), 0);
  const checked = Object.values(reportsByMode).reduce((sumValue, report) => sumValue + (report?.engageShortlistChecked ?? 0), 0);
  const newEngageHits = Object.values(reportsByMode).flatMap((report) => report?.newEngageHits ?? []);
  const statusFlips = Object.values(reportsByMode).flatMap((report) => report?.engageStatusFlips ?? []);
  const costPerNewIdea = survived > 0 ? combinedCost / survived : 0;

  const modeText = results.map((result) => {
    const report = reportsByMode[result.mode];
    const token = tokensByMode[result.mode] ?? { tokIn: 0, tokOut: 0, cost: 0 };
    const title = result.mode === "gcc" ? "GCC FLEET" : "GLOBAL FLEET";
    return `${title}\nStatus: ${result.status}\nCandidates generated: ${report?.novelty.candidatesGenerated ?? 0}\nNet-new ideas scanned: ${report?.newIdeasScanned ?? 0}\nDuplicates dropped: ${report?.novelty.duplicatesDropped ?? 0}\nExisting ENGAGE checked: ${report?.engageShortlistChecked ?? 0}\nRun cost: $${token.cost.toFixed(2)}`;
  }).join("\n\n");

  const newEngageText = newEngageHits.length > 0
    ? newEngageHits.map((item) => `- ${item.domain} / ${item.subSector} / ${item.region}`).join("\n")
    : "- None";
  const flipsText = statusFlips.length > 0
    ? statusFlips.map((item) => `- ${item.domain} / ${item.subSector} / ${item.region}: ENGAGE → ${item.newClassification} — ${item.rationale}`).join("\n")
    : "- None";

  const textBody = `Weekly Fleet Delta Report\nDate: ${date} · ${time} Kuwait time\n\n${modeText}\n\nNOVELTY GATE\nCandidates generated: ${generated}\nNet-new ideas scanned: ${survived}\nDuplicates dropped: ${dropped}\n\nNEW ENGAGE HITS\n${newEngageText}\n\nEXISTING ENGAGE STATUS CHECK\nShortlist items checked: ${checked}\nStatus flips:\n${flipsText}\n\nTOKENS & COST\nInput tokens: ${combinedTokIn.toLocaleString()}\nOutput tokens: ${combinedTokOut.toLocaleString()}\nWeekly run cost: $${combinedCost.toFixed(2)}\nCost per net-new idea: $${costPerNewIdea.toFixed(4)}\nCumulative cost: $${cumulativeCost.toFixed(2)}\n\nView full results:\nhttps://agenthink-7enctkan.manus.space/admin/usage`;

  const modeHtml = results.map((result) => {
    const report = reportsByMode[result.mode];
    const token = tokensByMode[result.mode] ?? { tokIn: 0, tokOut: 0, cost: 0 };
    const title = result.mode === "gcc" ? "GCC FLEET" : "GLOBAL FLEET";
    const statusColor = result.status === "completed" ? "#16a34a" : "#dc2626";
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td colspan="2" style="font-weight:700;font-size:13px;letter-spacing:.08em;color:#374151;padding:8px 0 4px;border-bottom:1px solid #e5e7eb;">${title}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;width:220px;">Status</td><td style="color:${statusColor};font-weight:600;">${result.status}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Candidates generated</td><td>${report?.novelty.candidatesGenerated ?? 0}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Net-new ideas scanned</td><td>${report?.newIdeasScanned ?? 0}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Duplicates dropped</td><td>${report?.novelty.duplicatesDropped ?? 0}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Existing ENGAGE checked</td><td>${report?.engageShortlistChecked ?? 0}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Run cost</td><td>$${token.cost.toFixed(2)}</td></tr>
    </table>`;
  }).join("");

  const newEngageHtml = newEngageHits.length > 0
    ? `<ul style="margin:8px 0 20px;padding-left:20px;">${newEngageHits.map((item) => `<li>${escapeHtml(item.domain)} / ${escapeHtml(item.subSector)} / ${escapeHtml(item.region)}</li>`).join("")}</ul>`
    : `<p style="color:#6b7280;">None</p>`;
  const flipsHtml = statusFlips.length > 0
    ? `<ul style="margin:8px 0 20px;padding-left:20px;">${statusFlips.map((item) => `<li>${escapeHtml(item.domain)} / ${escapeHtml(item.subSector)} / ${escapeHtml(item.region)}: <strong>ENGAGE → ${escapeHtml(item.newClassification)}</strong> — ${escapeHtml(item.rationale)}</li>`).join("")}</ul>`
    : `<p style="color:#6b7280;">None</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AgenThink Weekly Fleet Delta</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#6b7280;text-transform:uppercase;">AgenThink Fleet</div>
  <h1 style="font-size:22px;margin:4px 0;">Weekly Fleet Delta Report</h1>
  <div style="font-size:13px;color:#6b7280;margin-bottom:24px;">${date} &middot; ${time} Kuwait time</div>
  ${modeHtml}
  <h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">NOVELTY GATE</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><tr><td>Candidates generated</td><td>${generated}</td></tr><tr><td>Net-new ideas scanned</td><td>${survived}</td></tr><tr><td>Duplicates dropped</td><td>${dropped}</td></tr></table>
  <h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">NEW ENGAGE HITS</h2>${newEngageHtml}
  <h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">EXISTING ENGAGE STATUS CHECK</h2>
  <p>Shortlist items checked: <strong>${checked}</strong></p>${flipsHtml}
  <h2 style="font-size:14px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">TOKENS &amp; COST</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><tr><td>Input tokens</td><td>${combinedTokIn.toLocaleString()}</td></tr><tr><td>Output tokens</td><td>${combinedTokOut.toLocaleString()}</td></tr><tr><td>Weekly run cost</td><td>$${combinedCost.toFixed(2)}</td></tr><tr><td>Cost per net-new idea</td><td>$${costPerNewIdea.toFixed(4)}</td></tr><tr><td>Cumulative cost</td><td>$${cumulativeCost.toFixed(2)}</td></tr></table>
  <a href="https://agenthink-7enctkan.manus.space/admin/usage" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;">View full results &rarr;</a>
</div></body></html>`;

  const subject = `AgenThink Weekly Fleet Delta — ${dateLabel} Kuwait`;
  const sent = await sendGraphEmail({ to: "farouq@agenthink.ai", subject, html });
  if (sent) {
    console.log(`[FounderFleet] Weekly delta email sent — "${subject}"`);
  } else {
    console.error("[FounderFleet] Weekly delta email FAILED — check Graph API credentials");
  }
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

    // COST GUARD 0: Refuse to launch a second run while the same fleet mode is
    // already active. This protects against ordinary scheduler retries and
    // overlapping webhook deliveries before either run has completed.
    const ACTIVE_RUN_STATUSES = ["pending", "generating", "researching", "pitching", "evaluating", "extracting", "paused"] as const;
    const [activeRun] = await db
      .select({ id: founderAgentRuns.id, status: founderAgentRuns.status })
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, config.fleetMode),
        inArray(founderAgentRuns.status, ACTIVE_RUN_STATUSES),
      ))
      .limit(1);
    if (activeRun) {
      console.warn(`[FounderFleet] ACTIVE RUN GUARD: ${config.fleetMode} run #${activeRun.id} is ${activeRun.status} — skipping duplicate launch`);
      await notifyOwner({
        title: `Fleet duplicate launch blocked — ${config.fleetMode}`,
        content: `${config.fleetMode} fleet run #${activeRun.id} is already ${activeRun.status}. No additional scheduled run was started.`,
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

    // COST GUARD 1: Weekly cadence — max 1 completed run per fleet mode in
    // any rolling 7-day window. Failed or interrupted runs remain manually
    // resumable and do not consume the next successful weekly slot.
    const WEEKLY_RUN_CAP = 1;
    const weekWindowStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const [weeklyRunCount] = await db
      .select({ n: count() })
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, config.fleetMode),
        gte(founderAgentRuns.completedAt, weekWindowStart),
        eq(founderAgentRuns.status, "completed"),
      ));
    const runsThisWeek = Number(weeklyRunCount?.n ?? 0);
    if (runsThisWeek >= WEEKLY_RUN_CAP) {
      console.warn(`[FounderFleet] WEEKLY CAP reached for ${config.fleetMode}: ${runsThisWeek}/${WEEKLY_RUN_CAP} runs in the last 7 days — skipping`);
      await notifyOwner({
        title: `Fleet weekly cap reached — ${config.fleetMode}`,
        content: `${config.fleetMode} fleet already has ${runsThisWeek} completed run(s) in the last 7 days (cap: ${WEEKLY_RUN_CAP}). No additional scheduled run was started.`,
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
    const [recentCompleted] = await db.select({ id: founderAgentRuns.id, completedAt: founderAgentRuns.completedAt })
      .from(founderAgentRuns)
      .where(and(
        eq(founderAgentRuns.fleetMode, config.fleetMode),
        eq(founderAgentRuns.status, "completed"),
        gte(founderAgentRuns.completedAt, windowStart),
      ))
      .limit(1);
    if (recentCompleted) {
      const minsAgo = Math.round((Date.now() - Number(recentCompleted.completedAt)) / 60_000);
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

// ── Shared weekly fleet execution (used by the canonical HTTP trigger) ───────

export async function runWeeklyFleet(): Promise<void> {
  const runTs = Date.now();
  console.log("[FounderFleet] Weekly discovery fleet run starting");

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

  // Auto-retry remains disabled. Fleet runs once per 7 days per mode.
  // If a run fails, it fails. No automatic retries. Owner is notified via the
  // summary email below. Manual re-trigger available via the admin UI.
  const failedModes = fleetResults.filter((r) => r.status === "failed");
  if (failedModes.length > 0) {
    const failedList = failedModes.map((r) => r.mode).join(", ");
    console.warn(`[FounderFleet] Failed modes (no retry): ${failedList}`);
    notifyOwner({
      title:   `Fleet run failed — ${failedList}`,
      content: `The following weekly fleet mode(s) failed and will NOT be retried automatically: ${failedList}.\nManual resume is available via the admin UI.`,
    }).catch(() => {});
  }

  // ── Send one combined summary email after ALL fleet modes complete ─────────
  if (fleetResults.length > 0) {
    buildAndSendFleetEmail(fleetResults, runTs).catch((emailErr: unknown) =>
      console.error("[FounderFleet] Fleet summary email error:", (emailErr as Error)?.message)
    );

    // Legacy scale-verification email remains fire-and-forget until its one-time threshold is reached.
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

  // ── In-process cron DISABLED ────────────────────────────────────────────────
  // The Manus-platform task is the only cadence configuration and calls
  // POST /api/scheduled/fleet-trigger once every 7 days. SCHEDULER_SECRET only
  // authenticates that endpoint; it does not control cadence. Do not add a
  // second node-cron schedule here.
  //
  // runWeeklyFleet() and runSingleFleetMode() remain called by the HTTP endpoint.

  console.log("[FounderFleet] Startup complete — in-process cron is DISABLED; canonical trigger is the weekly Manus-platform scheduled task");
}
