/**
 * trigger_gcc_full.ts — Trigger a full 100-idea GCC fleet run
 * Run: npx tsx trigger_gcc_full.ts
 *
 * Updates fleet_config counters ONLY on successful completion.
 */
import { getDb } from "./server/db";
import { founderAgentRuns, fleetConfig, founderAgentEvaluations } from "./drizzle/schema";
import { runFleet } from "./server/founderFleet";
import { eq, avg, and } from "drizzle-orm";

const db = await getDb();
if (!db) { console.error("DB unavailable"); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const [newRun] = await db.insert(founderAgentRuns).values({
  runDate: today,
  fleetMode: "gcc",
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
console.log(`[GCC Full Trigger] Created GCC run #${runId} for ${today}`);
console.log(`[GCC Full Trigger] Launching orchestration with gccMode=true, 100 ideas ...`);

let success = false;
try {
  await runFleet(runId, { gccMode: true });
  success = true;
  console.log(`[GCC Full Trigger] Run #${runId} completed successfully.`);
} catch (err) {
  console.error(`[GCC Full Trigger] Run #${runId} failed:`, (err as Error).message);
}

if (success) {
  // Update fleet_config counters for gcc — only on success
  const gccConfigs = await db.select().from(fleetConfig).where(eq(fleetConfig.fleetMode, "gcc"));
  if (gccConfigs.length > 0) {
    const config = gccConfigs[0];
    const newRemaining = Math.max(0, config.runsRemaining - 1);
    const newCompleted = config.runsCompleted + 1;

    // Get avg score for this run
    const [scoreRow] = await db
      .select({ avgScore: avg(founderAgentEvaluations.finalScore) })
      .from(founderAgentEvaluations)
      .where(and(
        eq(founderAgentEvaluations.runId, runId),
        eq(founderAgentEvaluations.fleetMode, "gcc")
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

    console.log(`[GCC Full Trigger] fleet_config updated: runs_completed=${newCompleted}, runs_remaining=${newRemaining}, last_run_score=${avgScore?.toFixed(1) ?? "N/A"}`);
  }
}

process.exit(success ? 0 : 1);
