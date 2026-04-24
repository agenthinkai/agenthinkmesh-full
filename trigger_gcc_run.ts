/**
 * trigger_gcc_run.ts — One-time script to start the first GCC fleet run
 * Run: npx tsx trigger_gcc_run.ts
 */
import { getDb } from "./server/db";
import { founderAgentRuns } from "./drizzle/schema";
import { runFleet } from "./server/founderFleet";

const db = await getDb();
if (!db) { console.error("DB unavailable"); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const [newRun] = await db.insert(founderAgentRuns).values({
  runDate: today,
  fleetMode: "gcc",
  status: "pending",
  totalIdeas: 10,
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
console.log(`[GCC Trigger] Created GCC run #${runId} for ${today}`);
console.log(`[GCC Trigger] Launching orchestration with gccMode=true ...`);

try {
  await runFleet(runId, { gccMode: true, quickTest: true });
  console.log(`[GCC Trigger] Run #${runId} completed successfully.`);
} catch (err) {
  console.error(`[GCC Trigger] Run #${runId} failed:`, (err as Error).message);
  process.exit(1);
}
process.exit(0);
