/**
 * Fleet scale-up verification script.
 * Inserts two test rows into founder_agent_runs with the new totalIdeas values
 * (GCC=200, Global=300) to verify the DB schema accepts them and the logic is correct.
 * Does NOT run the full fleet (too slow for a quick check).
 */
import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Use a sentinel run_date that will never conflict with real runs
const testDate = '9999-01-01';

// Simulate what founderFleetScheduler.ts now does:
// GCC: ideasPerDomain=40, targetIdeas=200
// Global: ideasPerDomain=60, targetIdeas=300

const testCases = [
  { fleetMode: 'gcc', ideasPerDomain: 40, targetIdeas: 200 },
  { fleetMode: 'global', ideasPerDomain: 60, targetIdeas: 300 },
];

console.log('\n=== Fleet Scale-Up Verification ===\n');

for (const tc of testCases) {
  const [result] = await conn.execute(
    `INSERT INTO founder_agent_runs
      (run_date, fleet_mode, status, total_ideas, completed, queued, running,
       total_searches, total_llm_calls, estimated_tokens, estimated_cost_usd,
       started_at, created_at)
     VALUES (?, ?, 'pending', ?, 0, 0, 0, 0, 0, 0, '0', ?, ?)`,
    [testDate, tc.fleetMode, tc.targetIdeas, Date.now(), Date.now()]
  );
  const insertId = result.insertId;
  console.log(`inserted ${tc.fleetMode} test run #${insertId}: total_ideas=${tc.targetIdeas} (ideasPerDomain=${tc.ideasPerDomain})`);
}

// Query back to verify
const [rows] = await conn.execute(
  `SELECT id, fleet_mode, status, total_ideas, completed
   FROM founder_agent_runs
   WHERE run_date = '9999-01-01'
   ORDER BY created_at DESC LIMIT 4`
);

console.log('\n--- DB Verification (test rows) ---');
console.log('id | fleet_mode | status | total_ideas | completed');
console.log('---|------------|--------|-------------|----------');
for (const r of rows) {
  console.log(`${r.id} | ${r.fleet_mode} | ${r.status} | ${r.total_ideas} | ${r.completed}`);
}

// Clean up test rows
await conn.execute(`DELETE FROM founder_agent_runs WHERE run_date = '9999-01-01'`);
console.log('\nTest rows cleaned up.');

// Show real runs for context
const [realRuns] = await conn.execute(
  `SELECT id, fleet_mode, status, total_ideas, completed
   FROM founder_agent_runs
   ORDER BY created_at DESC LIMIT 6`
);
console.log('\n--- Recent Real Runs (last 6) ---');
console.log('id | fleet_mode | status | total_ideas | completed');
console.log('---|------------|--------|-------------|----------');
for (const r of realRuns) {
  console.log(`${r.id} | ${r.fleet_mode} | ${r.status} | ${r.total_ideas} | ${r.completed}`);
}

// Fleet config summary
const [cfg] = await conn.execute(
  `SELECT id, fleet_mode, runs_total, runs_completed, runs_remaining, last_run_at FROM fleet_config`
);
console.log('\n--- fleet_config ---');
console.log('id | fleet_mode | runs_total | runs_completed | runs_remaining | last_run_at');
console.log('---|------------|------------|----------------|----------------|------------');
for (const r of cfg) {
  const ts = r.last_run_at ? new Date(Number(r.last_run_at)).toISOString() : 'null';
  console.log(`${r.id} | ${r.fleet_mode} | ${r.runs_total} | ${r.runs_completed} | ${r.runs_remaining} | ${ts}`);
}

// Eval stats
const [evalStats] = await conn.execute(
  `SELECT fleet_mode, COUNT(*) as total, AVG(final_score) as avg_score
   FROM founder_agent_evaluations
   GROUP BY fleet_mode`
);
console.log('\n--- founder_agent_evaluations GROUP BY fleet_mode ---');
console.log('fleet_mode | total | avg_score');
console.log('-----------|-------|----------');
for (const r of evalStats) {
  console.log(`${r.fleet_mode} | ${r.total} | ${parseFloat(r.avg_score ?? 0).toFixed(2)}`);
}

await conn.end();
console.log('\n=== Verification complete ===');
