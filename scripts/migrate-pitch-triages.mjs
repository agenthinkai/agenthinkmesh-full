import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // ── pitch_triages table ───────────────────────────────────────────────────
  await conn.query(`CREATE TABLE IF NOT EXISTS pitch_triages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    pitchPreview VARCHAR(220) NOT NULL,
    score INT NOT NULL,
    classification ENUM('ENGAGE','WATCH','IGNORE') NOT NULL,
    confidence ENUM('HIGH','MEDIUM','LOW') NOT NULL,
    agentOutputs TEXT,
    keySignals TEXT,
    missingInfo TEXT,
    topMissingFields TEXT,
    nextStep VARCHAR(100),
    parentTriageId INT,
    escalatedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX pt_user_idx (userId),
    INDEX pt_created_idx (createdAt)
  )`);
  console.log("pitch_triages: table created or already exists");

  const [cols] = await conn.query("DESCRIBE pitch_triages");
  const colNames = cols.map((c) => c.Field);

  if (!colNames.includes("parentTriageId")) {
    await conn.query("ALTER TABLE pitch_triages ADD COLUMN parentTriageId INT");
    console.log("pitch_triages: added parentTriageId");
  }
  if (!colNames.includes("escalatedAt")) {
    await conn.query("ALTER TABLE pitch_triages ADD COLUMN escalatedAt TIMESTAMP NULL");
    console.log("pitch_triages: added escalatedAt");
  }

  // ── users table — pitchMirrorRuns ─────────────────────────────────────────
  const [userCols] = await conn.query("DESCRIBE users");
  const userColNames = userCols.map((c) => c.Field);

  if (!userColNames.includes("pitchMirrorRuns")) {
    await conn.query("ALTER TABLE users ADD COLUMN pitchMirrorRuns INT NOT NULL DEFAULT 0");
    console.log("users: added pitchMirrorRuns");
  } else {
    console.log("users: pitchMirrorRuns already exists");
  }

  const [ptRows] = await conn.query("DESCRIBE pitch_triages");
  console.log("pitch_triages columns:", ptRows.map((r) => r.Field).join(", "));
} finally {
  await conn.end();
}
