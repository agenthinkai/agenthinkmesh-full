import mysql from 'mysql2/promise';

const baseUrl = (process.env.DATABASE_URL || '').split('?')[0];
const pool = mysql.createPool({ uri: baseUrl, ssl: { rejectUnauthorized: false } });

const [runs] = await pool.query(
  'SELECT id, fleet_mode, status, total_ideas, completed FROM founder_agent_runs ORDER BY created_at DESC LIMIT 5'
);
console.log('\n=== Q1: founder_agent_runs (last 5) ===');
console.table(runs);

const [evals] = await pool.query(
  'SELECT fleet_mode, COUNT(*) as total, ROUND(AVG(final_score),2) as avg_score FROM founder_agent_evaluations GROUP BY fleet_mode'
);
console.log('\n=== Q2: founder_agent_evaluations GROUP BY fleet_mode ===');
console.table(evals);

const [cfg] = await pool.query('SELECT id, fleet_mode, scoring_mode, runs_total, runs_completed, runs_remaining, last_run_at, last_run_score, active FROM fleet_config');
console.log('\n=== Q3: fleet_config ===');
console.table(cfg);

await pool.end();
