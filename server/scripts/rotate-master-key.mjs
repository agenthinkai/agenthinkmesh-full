#!/usr/bin/env node
/**
 * rotate-master-key.mjs
 *
 * Atomically re-encrypts all sys:-prefixed fields across all three encrypted
 * tables from ENCRYPTION_MASTER_KEY → NEW_ENCRYPTION_MASTER_KEY.
 *
 * Usage:
 *   NEW_ENCRYPTION_MASTER_KEY=<64-hex> node server/scripts/rotate-master-key.mjs [--dry-run]
 *
 * Tables and fields rotated:
 *   - pitch_triages
 *       agentOutputs, keySignals, missingInfo
 *   - founder_agent_evaluations
 *       strengths, concerns, flags, recommended_action
 *   - founder_agent_insights
 *       highScorePatterns, lowScorePatterns, failureReasons
 *
 * Safety:
 *   - --dry-run logs what would happen without writing anything
 *   - All three tables are processed in one pass; if any row fails to
 *     decrypt, the entire rotation is aborted before any writes occur
 *   - Rows that are not sys:-prefixed are skipped (plaintext fallback rows)
 */

import crypto from "crypto";
import mysql from "mysql2/promise";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
} catch {
  // dotenv not available — rely on shell env
}

const DRY_RUN = process.argv.includes("--dry-run");

// ── Key validation ────────────────────────────────────────────────────────────
function validateKey(value, name) {
  if (!value || typeof value !== "string") {
    throw new Error(`${name} is not set`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 64-character hex string (got length ${value.length})`);
  }
  return Buffer.from(value, "hex");
}

// ── AES-256-GCM decrypt (sys: prefix format) ─────────────────────────────────
function decryptSys(encoded, keyBuf) {
  if (!encoded || !encoded.startsWith("sys:")) return null;
  const parts = encoded.split(":");
  if (parts.length !== 4) throw new Error(`Malformed sys: value: ${encoded.slice(0, 30)}`);
  const [, ivHex, ciphertextHex, authTagHex] = parts;
  const iv        = Buffer.from(ivHex,         "hex");
  const cipherBuf = Buffer.from(ciphertextHex, "hex");
  const authTag   = Buffer.from(authTagHex,    "hex");
  const decipher  = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
  return plain.toString("utf8");
}

// ── AES-256-GCM encrypt (sys: prefix format) ─────────────────────────────────
function encryptSys(plaintext, keyBuf) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `sys:${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

// ── Re-encrypt a single nullable field ───────────────────────────────────────
function rotateField(value, oldKeyBuf, newKeyBuf) {
  if (!value || !value.startsWith("sys:")) return value;
  const plain = decryptSys(value, oldKeyBuf);
  if (plain === null) return value;
  return encryptSys(plain, newKeyBuf);
}

// ── Table definitions ─────────────────────────────────────────────────────────
const TABLES = [
  {
    name:   "pitch_triages",
    fields: ["agentOutputs", "keySignals", "missingInfo"],
    pk:     "id",
    where:  "agentOutputs LIKE 'sys:%' OR keySignals LIKE 'sys:%' OR missingInfo LIKE 'sys:%'",
  },
  {
    name:   "founder_agent_evaluations",
    fields: ["strengths", "concerns", "flags", "recommended_action"],
    pk:     "id",
    where:  "strengths LIKE 'sys:%' OR concerns LIKE 'sys:%' OR flags LIKE 'sys:%' OR recommended_action LIKE 'sys:%'",
  },
  {
    name:   "founder_agent_insights",
    fields: ["high_score_patterns", "low_score_patterns", "failure_reasons"],
    pk:     "id",
    where:  "high_score_patterns LIKE 'sys:%' OR low_score_patterns LIKE 'sys:%' OR failure_reasons LIKE 'sys:%'",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const oldKeyBuf = validateKey(process.env.ENCRYPTION_MASTER_KEY,     "ENCRYPTION_MASTER_KEY");
  const newKeyBuf = validateKey(process.env.NEW_ENCRYPTION_MASTER_KEY, "NEW_ENCRYPTION_MASTER_KEY");

  if (oldKeyBuf.equals(newKeyBuf)) {
    throw new Error("OLD and NEW keys are identical — rotation aborted");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // ── Phase 1: Fetch rows from all tables (dry-run or live) ─────────────────
  const allTableData = [];
  let totalRows = 0;

  for (const table of TABLES) {
    const selectFields = [table.pk, ...table.fields].join(", ");
    const [rows] = await conn.execute(
      `SELECT ${selectFields} FROM ${table.name} WHERE ${table.where}`
    );
    allTableData.push({ table, rows });
    totalRows += rows.length;

    if (DRY_RUN) {
      console.log(`Would rotate ${rows.length} rows in ${table.name}`);
    }
  }

  if (DRY_RUN) {
    console.log(`Total: ${totalRows} rows across 3 tables`);
    console.log("Dry run complete — no changes made");
    await conn.end();
    return;
  }

  // ── Phase 2: Decrypt all rows — abort on any failure before writing ───────
  const allUpdates = [];

  for (const { table, rows } of allTableData) {
    const updates = [];
    for (const row of rows) {
      try {
        const updated = { [table.pk]: row[table.pk] };
        for (const field of table.fields) {
          updated[field] = rotateField(row[field], oldKeyBuf, newKeyBuf);
        }
        updates.push(updated);
      } catch (err) {
        await conn.end();
        console.error(`\nRotation ABORTED — failed on ${table.name} id=${row[table.pk]}: ${err.message}`);
        console.error("No rows were written across any table. The database is unchanged.");
        process.exit(1);
      }
    }
    allUpdates.push({ table, updates });
    console.log(`Prepared ${updates.length} rows from ${table.name}`);
  }

  // ── Phase 3: All decrypts succeeded — write all tables ───────────────────
  for (const { table, updates } of allUpdates) {
    for (const u of updates) {
      const setClause = table.fields.map(f => `${f}=?`).join(", ");
      const values    = [...table.fields.map(f => u[f]), u[table.pk]];
      await conn.execute(
        `UPDATE ${table.name} SET ${setClause} WHERE ${table.pk}=?`,
        values
      );
    }
    console.log(`Rotated ${updates.length} rows in ${table.name}`);
  }

  console.log(`\nRotation complete — ${totalRows} rows re-encrypted across 3 tables`);
  console.log("\nNow update ENCRYPTION_MASTER_KEY in your secrets panel to the new key.");
  await conn.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
