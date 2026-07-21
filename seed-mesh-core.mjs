/**
 * Mesh Core v0.1 — Seed Script
 * Seeds model_pricing and workflow_pricebook with Amendment B defaults.
 * Run: node seed-mesh-core.mjs
 */
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Parse mysql://user:pass@host:port/db
const url = new URL(DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: url.password,
  database: url.pathname.replace(/^\//, ""),
  ssl: { rejectUnauthorized: false },
});

const now = Date.now();

// Seed model_pricing
await conn.execute(
  `INSERT IGNORE INTO model_pricing (tier, input_price_per_million, output_price_per_million, updated_at) VALUES
   ('SMALL', 0.150000, 0.600000, ?),
   ('MID',   0.600000, 2.400000, ?),
   ('LARGE', 2.500000, 10.000000, ?)`,
  [now, now, now]
);
console.log("✓ model_pricing seeded (SMALL / MID / LARGE)");

// Seed workflow_pricebook
const workflows = [
  ["deal-screener",          29.000000, 0.030000, 0.500000, 2.0000, 7.900000, 0.050000, 1],
  ["pitch-triage",            4.990000, 0.030000, 0.500000, 0.5000, 0.004000, 0.050000, 0],
  ["decision-twin",          99.000000, 0.030000, 0.500000, 5.0000, 7.900000, 0.050000, 1],
  ["portfolio-review",       49.000000, 0.030000, 0.500000, 3.0000, 7.900000, 0.050000, 1],
  ["job-to-agent-translate",  9.990000, 0.030000, 0.500000, 1.0000, 0.004000, 0.050000, 0],
  ["knowledge-vault-query",   2.490000, 0.030000, 0.500000, 0.2500, 0.004000, 0.050000, 0],
  ["aros-intelligence",      14.990000, 0.030000, 0.500000, 1.5000, 7.900000, 0.050000, 1],
  ["scenario-sim",           19.990000, 0.030000, 0.500000, 2.5000, 7.900000, 0.050000, 1],
];

for (const [wt, price, reservePct, gateCost, gateMin, cac, disputeRate, isEnt] of workflows) {
  await conn.execute(
    `INSERT IGNORE INTO workflow_pricebook
       (workflow_type, price_usd, liability_reserve_pct, human_gate_cost_per_minute, human_gate_minutes, residency_cac_per_ou_usd, dispute_rate, is_enterprise, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [wt, price, reservePct, gateCost, gateMin, cac, disputeRate, isEnt, now]
  );
}
console.log(`✓ workflow_pricebook seeded (${workflows.length} workflows)`);

await conn.end();
console.log("Seed complete.");
