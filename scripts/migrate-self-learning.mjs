/**
 * migrate-self-learning.mjs
 * Creates the 4 Self-Learning Loop tables if they don't already exist.
 * Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS).
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

const statements = [
  // 1. Agent weights — authority scores per persona
  `CREATE TABLE IF NOT EXISTS agent_weights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    personaId VARCHAR(64) NOT NULL UNIQUE,
    weight DECIMAL(5,3) NOT NULL DEFAULT 1.000,
    totalEvaluations INT NOT NULL DEFAULT 0,
    correctPredictions INT NOT NULL DEFAULT 0,
    lastEvaluatedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // 2. Decision memory — every Council run persisted
  `CREATE TABLE IF NOT EXISTS decision_memory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    taskId VARCHAR(128) NULL,
    taskDescription TEXT NOT NULL,
    taskDomain VARCHAR(64) NULL,
    finalVerdict VARCHAR(64) NULL,
    confidenceScore DECIMAL(5,4) NULL,
    yesCount INT NULL,
    noCount INT NULL,
    weightedYesScore DECIMAL(8,3) NULL,
    weightedNoScore DECIMAL(8,3) NULL,
    memoryContextUsed BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX dm_domain_idx (taskDomain),
    INDEX dm_verdict_idx (finalVerdict),
    INDEX dm_created_idx (createdAt)
  )`,

  // 3. Agent votes log — individual votes per decision
  `CREATE TABLE IF NOT EXISTS agent_votes_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    decisionMemoryId INT NOT NULL,
    personaId VARCHAR(64) NOT NULL,
    personaName VARCHAR(128) NULL,
    vote VARCHAR(16) NOT NULL,
    confidence DECIMAL(4,3) NULL,
    rationale TEXT NULL,
    weight DECIMAL(5,3) NOT NULL DEFAULT 1.000,
    wasCorrect BOOLEAN NULL,
    scoredAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX avl_mem_idx (decisionMemoryId),
    FOREIGN KEY (decisionMemoryId) REFERENCES decision_memory(id) ON DELETE CASCADE
  )`,

  // 4. Decision outcomes — real-world outcome scoring
  `CREATE TABLE IF NOT EXISTS decision_outcomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    decisionMemoryId INT NOT NULL,
    outcomeSource VARCHAR(64) NULL,
    outcomeData TEXT NULL,
    outcomeVerdict VARCHAR(16) NULL,
    outcomeRecordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX do_mem_idx (decisionMemoryId),
    FOREIGN KEY (decisionMemoryId) REFERENCES decision_memory(id) ON DELETE CASCADE
  )`,
];

for (const sql of statements) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  try {
    await conn.execute(sql);
    console.log(`✓ ${tableName} — created or already exists`);
  } catch (err) {
    console.error(`✗ ${tableName} — error:`, err.message);
  }
}

// Seed default weights for all 10 personas
const PERSONAS = [
  "GCC_REG", "GCC_CONSUMER", "GCC_SHARIAH", "CONTRARIAN",
  "CFO", "EXIT", "GROWTH", "SECURITY", "OPERATOR", "DEVILS_ADVOCATE"
];

for (const personaId of PERSONAS) {
  try {
    await conn.execute(
      `INSERT IGNORE INTO agent_weights (personaId, weight) VALUES (?, 1.000)`,
      [personaId]
    );
  } catch (err) {
    console.warn(`Seed weight for ${personaId}:`, err.message);
  }
}
console.log(`✓ Seeded default weights for ${PERSONAS.length} personas`);

await conn.end();
console.log("Migration complete.");
