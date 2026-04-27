import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('=== founder_agent_runs (last 6) ===');
const [runs] = await conn.execute(`
  SELECT id, fleet_mode, status, total_ideas, completed,
         DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(created_at/1000), '+00:00', '+03:00'), '%Y-%m-%d %H:%i KWT') as created_kwt
  FROM founder_agent_runs
  ORDER BY created_at DESC LIMIT 6
`);
console.table(runs);

console.log('\n=== founder_agent_evaluations (by fleet_mode) ===');
const [evals] = await conn.execute(`
  SELECT fleet_mode, COUNT(*) as total, ROUND(AVG(final_score),2) as avg_score
  FROM founder_agent_evaluations
  GROUP BY fleet_mode
`);
console.table(evals);

console.log('\n=== fleet_config ===');
const [cfg] = await conn.execute(`
  SELECT id, fleet_mode, runs_completed, runs_remaining,
         DATE_FORMAT(CONVERT_TZ(FROM_UNIXTIME(last_run_at/1000), '+00:00', '+03:00'), '%Y-%m-%d %H:%i KWT') as last_run_kwt,
         last_run_cost_usd, total_cost_usd
  FROM fleet_config
`);
console.table(cfg);

await conn.end();
