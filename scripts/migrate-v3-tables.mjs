/**
 * migrate-v3-tables.mjs
 * Creates pitch_sessions, consensus_sessions, cost_counters tables
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const tables = [
  {
    name: "pitch_sessions",
    sql: `CREATE TABLE IF NOT EXISTS pitch_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pitchToken VARCHAR(64) NOT NULL UNIQUE,
      phone VARCHAR(20),
      pitchText TEXT,
      decisionMemoryId INT,
      verdict VARCHAR(30),
      confidenceScore DECIMAL(5,3),
      paymentStatus VARCHAR(20) DEFAULT 'FREE',
      reportUnlocked TINYINT(1) DEFAULT 0,
      voteSummaryJson LONGTEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX ps_token_idx (pitchToken)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  },
  {
    name: "consensus_sessions",
    sql: `CREATE TABLE IF NOT EXISTS consensus_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId VARCHAR(64) NOT NULL UNIQUE,
      thesis VARCHAR(200),
      yesCount INT NOT NULL DEFAULT 0,
      noCount INT NOT NULL DEFAULT 0,
      verdict VARCHAR(30) NOT NULL,
      consensusReached TINYINT(1) NOT NULL DEFAULT 0,
      hardFlags TEXT,
      silentFails TEXT,
      votesJson LONGTEXT,
      resultJson LONGTEXT,
      durationMs INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX cs_session_idx (sessionId),
      INDEX cs_verdict_idx (verdict)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  },
  {
    name: "cost_counters",
    sql: `CREATE TABLE IF NOT EXISTS cost_counters (
      counter_key VARCHAR(64) PRIMARY KEY,
      value VARCHAR(32) NOT NULL DEFAULT '0',
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  },
];

for (const t of tables) {
  await conn.execute(t.sql);
  console.log(`✓ ${t.name} — created or already exists`);
}

await conn.end();
console.log("Migration v3.0 complete.");
