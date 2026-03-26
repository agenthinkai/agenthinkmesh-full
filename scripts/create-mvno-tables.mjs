/**
 * create-mvno-tables.mjs
 * Creates mvno_subscribers and mvno_agent_runs tables directly via raw SQL.
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);
console.log("✓ Connected to TiDB Cloud");

const statements = [
  // ── mvno_subscribers ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS mvno_subscribers (
    id           VARCHAR(36)  NOT NULL,
    userId       INT          NOT NULL,
    name         VARCHAR(255) NOT NULL,
    nationality  VARCHAR(100) NOT NULL,
    msisdn       VARCHAR(20)  NOT NULL,
    plan         ENUM('basic','worker','remittance_plus') NOT NULL DEFAULT 'basic',
    simStatus    ENUM('active','suspended','ported_out')  NOT NULL DEFAULT 'active',
    kycStatus    ENUM('pending','verified','rejected')    NOT NULL DEFAULT 'pending',
    monthlyArpu  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notes        TEXT,
    createdAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT mvno_subscribers_id PRIMARY KEY (id)
  )`,

  // ── mvno_agent_runs ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS mvno_agent_runs (
    id                      VARCHAR(36)  NOT NULL,
    userId                  INT          NOT NULL,
    subscriberContext       LONGTEXT     NOT NULL,
    agentResults            LONGTEXT     NOT NULL,
    overallRecommendation   VARCHAR(64)  NOT NULL,
    createdAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT mvno_agent_runs_id PRIMARY KEY (id)
  )`,
];

for (const sql of statements) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
  try {
    await conn.execute(sql);
    console.log(`✓ Table created (or already exists): ${tableName}`);
  } catch (err) {
    console.error(`✗ Failed to create ${tableName}:`, err.message);
    await conn.end();
    process.exit(1);
  }
}

// Verify both tables exist
const [rows] = await conn.execute(
  `SELECT TABLE_NAME FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('mvno_subscribers','mvno_agent_runs')
   ORDER BY TABLE_NAME`
);
console.log("\n── Verification ──────────────────────────────────");
rows.forEach(r => console.log(`  ✓ ${r.TABLE_NAME} exists in DB`));

if (rows.length === 2) {
  console.log("\n✅ Both MVNO tables confirmed in live database.");
} else {
  console.error("\n✗ One or more tables missing after creation.");
  process.exit(1);
}

await conn.end();
