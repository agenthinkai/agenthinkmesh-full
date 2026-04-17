import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Create table if not exists (with parentTriageId already included)
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
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX pt_user_idx (userId),
    INDEX pt_created_idx (createdAt)
  )`);
  console.log("Table created or already exists");

  // Add parentTriageId if missing (for existing tables)
  const [cols] = await conn.query("DESCRIBE pitch_triages");
  const hasParent = cols.some((c) => c.Field === "parentTriageId");
  if (!hasParent) {
    await conn.query("ALTER TABLE pitch_triages ADD COLUMN parentTriageId INT");
    console.log("Added parentTriageId column");
  } else {
    console.log("parentTriageId already exists");
  }

  const [rows] = await conn.query("DESCRIBE pitch_triages");
  console.log("Columns:", rows.map((r) => r.Field).join(", "));
} finally {
  await conn.end();
}
