/**
 * trigger_gcc_run.mjs — One-time script to start the first GCC fleet run
 * Run: node trigger_gcc_run.mjs
 */
import { createConnection } from '/home/ubuntu/agenthinkmesh-full/node_modules/.pnpm/mysql2@3.15.1/node_modules/mysql2/promise.js';

const conn = await createConnection(process.env.DATABASE_URL);
const today = new Date().toISOString().slice(0, 10);

const [result] = await conn.execute(
  `INSERT INTO founder_agent_runs (run_date, fleet_mode, status, total_ideas, completed, queued, running, total_searches, total_llm_calls, estimated_tokens, estimated_cost_usd, started_at, created_at)
   VALUES (?, 'gcc', 'pending', 100, 0, 0, 0, 0, 0, 0, '0.0000', ?, ?)`,
  [today, Date.now(), Date.now()]
);
const runId = result.insertId;
console.log(`GCC run DB record created with ID: ${runId}`);
await conn.end();

// Now launch the orchestration engine in-process
const { runFleet } = await import('./server/founderFleet.js');
console.log(`Launching GCC fleet run #${runId} with gccMode=true ...`);
runFleet(runId, { gccMode: true }).then(() => {
  console.log(`GCC fleet run #${runId} completed.`);
  process.exit(0);
}).catch((err) => {
  console.error(`GCC fleet run #${runId} failed:`, err.message);
  process.exit(1);
});
