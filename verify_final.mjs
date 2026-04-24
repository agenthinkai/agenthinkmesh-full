import { createConnection } from "/home/ubuntu/agenthinkmesh-full/node_modules/.pnpm/mysql2@3.15.1/node_modules/mysql2/promise.js";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

// Parse DATABASE_URL: mysql://user:pass@host:port/db?ssl=...
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) { console.error("Cannot parse DATABASE_URL"); process.exit(1); }
const [, user, password, host, port, database] = match;

const conn = await createConnection({
  host, port: parseInt(port), user, password, database,
  ssl: { rejectUnauthorized: false },
});

console.log("\n=== Q1: founder_agent_evaluations GROUP BY fleet_mode ===");
const [q1] = await conn.execute(
  "SELECT fleet_mode, COUNT(*) as total, ROUND(AVG(final_score),2) as avg_score FROM founder_agent_evaluations GROUP BY fleet_mode ORDER BY fleet_mode"
);
console.table(q1);

console.log("\n=== Q2: fleet_config ===");
const [q2] = await conn.execute(
  "SELECT id, fleet_mode, scoring_mode, runs_total, runs_completed, runs_remaining, last_run_score, active FROM fleet_config ORDER BY id"
);
console.table(q2);

console.log("\n=== Q3: founder_agent_runs (last 5) ===");
const [q3] = await conn.execute(
  "SELECT id, fleet_mode, status, total_ideas, completed FROM founder_agent_runs ORDER BY created_at DESC LIMIT 5"
);
console.table(q3);

await conn.end();
