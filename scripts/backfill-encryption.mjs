/**
 * backfill-encryption.mjs
 *
 * One-time migration: encrypt all legacy plaintext agentOutputs, keySignals,
 * and missingInfo rows in pitch_triages using ENCRYPTION_MASTER_KEY.
 *
 * Safety rules:
 *   - Read before write: only encrypts rows where the field does NOT start with "sys:"
 *   - If any row fails: logs error and continues to next row (no data loss)
 *   - No schema changes
 *   - Idempotent: safe to re-run (already-encrypted rows are skipped)
 *
 * Usage: node scripts/backfill-encryption.mjs
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
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL missing");
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

function isPlaintext(value) {
  if (!value) return false;
  return !value.startsWith("sys:");
}

const conn = await mysql.createConnection(DATABASE_URL);

// ── Count plaintext rows before backfill ──────────────────────────────────────
const [[countBefore]] = await conn.execute(
  `SELECT COUNT(*) as cnt FROM pitch_triages
   WHERE agentOutputs IS NOT NULL AND agentOutputs LIKE '[%'`
);
const totalToBackfill = Number(countBefore.cnt);
console.log(`\nBackfilling ${totalToBackfill} plaintext rows...`);

if (totalToBackfill === 0) {
  console.log("Nothing to do — all rows already encrypted.");
  await conn.end();
  process.exit(0);
}

// ── Fetch all rows that have any plaintext field ──────────────────────────────
// Use a broad query: any row where agentOutputs, keySignals, or missingInfo
// is non-null and does NOT start with "sys:"
const [rows] = await conn.execute(
  `SELECT id, agentOutputs, keySignals, missingInfo
   FROM pitch_triages
   WHERE (
     (agentOutputs IS NOT NULL AND agentOutputs NOT LIKE 'sys:%')
     OR (keySignals IS NOT NULL AND keySignals NOT LIKE 'sys:%')
     OR (missingInfo IS NOT NULL AND missingInfo NOT LIKE 'sys:%')
   )`
);

console.log(`Fetched ${rows.length} rows with at least one plaintext field.`);

let succeeded = 0;
let failed = 0;
let skipped = 0;

for (const row of rows) {
  try {
    const updates = {};

    if (row.agentOutputs && isPlaintext(row.agentOutputs)) {
      updates.agentOutputs = encryptWithMasterKey(row.agentOutputs);
    }
    if (row.keySignals && isPlaintext(row.keySignals)) {
      updates.keySignals = encryptWithMasterKey(row.keySignals);
    }
    if (row.missingInfo && isPlaintext(row.missingInfo)) {
      updates.missingInfo = encryptWithMasterKey(row.missingInfo);
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    // Build dynamic SET clause
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    const values = [...Object.values(updates), row.id];
    await conn.execute(`UPDATE pitch_triages SET ${setClauses} WHERE id = ?`, values);
    succeeded++;

    if (succeeded % 100 === 0) {
      console.log(`  Progress: ${succeeded}/${rows.length - skipped} rows encrypted...`);
    }
  } catch (err) {
    failed++;
    console.error(`  ERROR on row id=${row.id}:`, err.message);
  }
}

console.log(`\nComplete — ${succeeded} rows encrypted, ${skipped} skipped (already encrypted), ${failed} errors.`);

// ── Verification count ────────────────────────────────────────────────────────
const [[countAfter]] = await conn.execute(
  `SELECT COUNT(*) as cnt FROM pitch_triages
   WHERE agentOutputs IS NOT NULL AND agentOutputs LIKE '[%'`
);
console.log(`\nVerification: plaintext agentOutputs remaining = ${countAfter.cnt} (expected: 0)`);

await conn.end();
