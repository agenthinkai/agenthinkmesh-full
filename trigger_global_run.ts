/**
 * trigger_global_run.ts — Trigger a full 100-idea Global fleet run
 * Run: npx tsx trigger_global_run.ts
 *
 * Updates fleet_config counters ONLY on successful completion.
 * Checks actual DB status after runFleet returns (runFleet never throws — it
 * catches internally and sets status="failed", so we must query the DB to know).
 */
import { getDb } from "./server/db";
import { founderAgentRuns, fleetConfig, founderAgentEvaluations } from "./drizzle/schema";
import { runFleet } from "./server/founderFleet";
import { eq, avg, and, sql } from "drizzle-orm";

const db = await getDb();
if (!db) { console.error("DB unavailable"); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const [newRun] = await db.insert(founderAgentRuns).values({
  runDate: today,
  fleetMode: "global",
  status: "pending",
  totalIdeas: 100,
  completed: 0,
  queued: 0,
  running: 0,
  totalSearches: 0,
  totalLlmCalls: 0,
  estimatedTokens: 0,
  estimatedCostUsd: "0.0000",
  startedAt: Date.now(),
  createdAt: Date.now(),
}).$returningId();
const runId = newRun.id;
console.log(`[Global Full Trigger] Created global run #${runId} for ${today}`);

// ── Pre-run cleanup: mark orphaned 'running' evals (>10 min old) as failed ──
const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
const cleanupResult = await db.update(founderAgentEvaluations)
  .set({
    status: "failed",
    errorMessage: `Orphaned — cleaned up before new global run at ${new Date().toISOString()}`,
    updatedAt: Date.now(),
  })
  .where(and(
    eq(founderAgentEvaluations.status, "running"),
    sql`${founderAgentEvaluations.updatedAt} < ${tenMinutesAgo}`,
  ));
const cleanedCount = (cleanupResult as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
console.log(`[Global Full Trigger] Cleaned up ${cleanedCount} orphaned evaluations before run`);

console.log(`[Global Full Trigger] Launching orchestration with gccMode=false, 100 ideas ...`);
// runFleet never throws — it catches internally and sets status="failed"
await runFleet(runId, { gccMode: false, bypassCostGuard: true });

// Check actual DB status to determine success
const [runRow] = await db.select({ status: founderAgentRuns.status })
  .from(founderAgentRuns)
  .where(eq(founderAgentRuns.id, runId));

const success = runRow?.status === "completed";
console.log(`[Global Full Trigger] Run #${runId} final status: ${runRow?.status ?? "unknown"}`);

if (success) {
  // Update fleet_config counters for global — only on success
  const globalConfigs = await db.select().from(fleetConfig).where(eq(fleetConfig.fleetMode, "global"));
  if (globalConfigs.length > 0) {
    const config = globalConfigs[0];
    const newRemaining = Math.max(0, config.runsRemaining - 1);
    const newCompleted = config.runsCompleted + 1;

    // Get avg score for this run
    const [scoreRow] = await db
      .select({ avgScore: avg(founderAgentEvaluations.finalScore) })
      .from(founderAgentEvaluations)
      .where(and(
        eq(founderAgentEvaluations.runId, runId),
        eq(founderAgentEvaluations.fleetMode, "global")
      ));
    const avgScore = scoreRow?.avgScore ? parseFloat(String(scoreRow.avgScore)) : null;

    await db.update(fleetConfig)
      .set({
        runsCompleted: newCompleted,
        runsRemaining: newRemaining,
        lastRunAt: Date.now(),
        lastRunScore: avgScore !== null ? String(avgScore.toFixed(2)) : null,
        active: newRemaining > 0,
      })
      .where(eq(fleetConfig.id, config.id));

    console.log(`[Global Full Trigger] fleet_config updated: runs_completed=${newCompleted}, runs_remaining=${newRemaining}, last_run_score=${avgScore?.toFixed(1) ?? "N/A"}`);
  }
} else {
  console.error(`[Global Full Trigger] Run #${runId} did not complete — fleet_config NOT updated`);
}

process.exit(success ? 0 : 1);
