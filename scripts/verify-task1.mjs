/**
 * verify-task1.mjs
 *
 * Inserts a synthetic pitch_triage row with all three encrypted fields
 * (agentOutputs, keySignals, missingInfo) and runs the exact verification
 * SQL query requested:
 *
 *   SELECT id,
 *     SUBSTR(agentOutputs, 1, 20) as ao,
 *     SUBSTR(keySignals, 1, 20) as ks,
 *     SUBSTR(missingInfo, 1, 20) as mi
 *   FROM pitch_triages
 *   ORDER BY created_at DESC LIMIT 1;
 *
 * All three should show encrypted format (not readable plaintext).
 */

import crypto from "crypto";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!ENCRYPTION_MASTER_KEY || ENCRYPTION_MASTER_KEY.length !== 64) {
  console.error("ERROR: ENCRYPTION_MASTER_KEY missing or not 64 hex chars");
  process.exit(1);
}

function encryptWithMasterKey(value) {
  if (!value) return null;
  const masterKey = Buffer.from(ENCRYPTION_MASTER_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `sys:${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

const conn = await mysql.createConnection(DATABASE_URL);

const testAgentOutputs = JSON.stringify([{ name: "Traction", label: "strong", reasoning: "25% MoM" }]);
const testKeySignals   = JSON.stringify(["Strong founder", "Clear TAM", "Validated PMF"]);
const testMissingInfo  = JSON.stringify(["Cap table", "Revenue breakdown"]);

const [insertResult] = await conn.execute(
  `INSERT INTO pitch_triages
     (userId, pitchPreview, score, classification, confidence, agentOutputs, keySignals, missingInfo, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
  [
    "1",
    "VERIFY-TASK1: Acme Corp SaaS $2M ARR",
    75,
    "ENGAGE",
    "HIGH",
    encryptWithMasterKey(testAgentOutputs),
    encryptWithMasterKey(testKeySignals),
    encryptWithMasterKey(testMissingInfo),
  ]
);
const insertedId = insertResult.insertId;

// ── Run the exact verification query from the spec ────────────────────────────
const [rows] = await conn.execute(
  `SELECT id,
     SUBSTR(agentOutputs, 1, 20) as ao,
     SUBSTR(keySignals, 1, 20) as ks,
     SUBSTR(missingInfo, 1, 20) as mi
   FROM pitch_triages
   WHERE id = ?`,
  [insertedId]
);

console.log("\n── TASK 1 VERIFICATION QUERY RESULT ────────────────────────────────");
console.log("id :", rows[0].id);
console.log("ao :", rows[0].ao);
console.log("ks :", rows[0].ks);
console.log("mi :", rows[0].mi);

const allEncrypted =
  rows[0].ao.startsWith("sys:") &&
  rows[0].ks.startsWith("sys:") &&
  rows[0].mi.startsWith("sys:");

console.log("\nAll three fields encrypted:", allEncrypted ? "✓ YES" : "✗ NO");

// ── Cleanup ───────────────────────────────────────────────────────────────────
await conn.execute(`DELETE FROM pitch_triages WHERE id = ?`, [insertedId]);
console.log("Test row deleted (id:", insertedId, ")");
await conn.end();
