#!/usr/bin/env node
/**
 * backfill-fleet-encryption.mjs
 *
 * Encrypts all plaintext strengths, concerns, and flags fields
 * in founder_agent_evaluations using ENCRYPTION_MASTER_KEY (AES-256-GCM).
 *
 * NOTE: recommended_action is varchar(100) and cannot hold encrypted values.
 * It is intentionally excluded from encryption (same decision as pitchPreview).
 *
 * Safe to re-run: already-encrypted rows (sys: prefix) are skipped.
 * Does NOT touch rows where the field is NULL.
 */

import crypto from "crypto";
import mysql from "mysql2/promise";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch { /* rely on shell env */ }

// ── AES-256-GCM helpers ───────────────────────────────────────────────────────
function getMasterKey() {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_MASTER_KEY must be a 64-char hex string");
  }
  return Buffer.from(hex, "hex");
}

function encryptSys(plaintext) {
  const key    = getMasterKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `sys:${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

function needsEncryption(val) {
  if (val == null) return false;
  if (val.startsWith("sys:")) return false; // already encrypted
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Count plaintext rows (strengths/concerns/flags only)
  const [[{ cnt }]] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM founder_agent_evaluations
     WHERE (strengths IS NOT NULL AND strengths NOT LIKE 'sys:%')
        OR (concerns  IS NOT NULL AND concerns  NOT LIKE 'sys:%')
        OR (flags     IS NOT NULL AND flags     NOT LIKE 'sys:%')`
  );
  console.log(`Backfilling ${cnt} fleet evaluation rows...`);

  if (cnt === 0) {
    console.log("Nothing to do — all rows already encrypted.");
    await conn.end();
    return;
  }

  // Fetch all rows with at least one plaintext field
  const [rows] = await conn.execute(
    `SELECT id, strengths, concerns, flags
     FROM founder_agent_evaluations
     WHERE (strengths IS NOT NULL AND strengths NOT LIKE 'sys:%')
        OR (concerns  IS NOT NULL AND concerns  NOT LIKE 'sys:%')
        OR (flags     IS NOT NULL AND flags     NOT LIKE 'sys:%')`
  );

  let encrypted = 0;
  let errors = 0;
  const BATCH = 100;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const newStrengths = needsEncryption(row.strengths) ? encryptSys(row.strengths) : row.strengths;
      const newConcerns  = needsEncryption(row.concerns)  ? encryptSys(row.concerns)  : row.concerns;
      const newFlags     = needsEncryption(row.flags)     ? encryptSys(row.flags)     : row.flags;

      await conn.execute(
        `UPDATE founder_agent_evaluations
         SET strengths=?, concerns=?, flags=?
         WHERE id=?`,
        [newStrengths, newConcerns, newFlags, row.id]
      );
      encrypted++;
      if (encrypted % BATCH === 0) {
        console.log(`  Progress: ${encrypted}/${rows.length} rows encrypted...`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error on row id=${row.id}: ${err.message}`);
    }
  }

  console.log(`Complete — ${encrypted} rows encrypted, ${errors} errors.`);

  // Verification
  const [[{ remaining }]] = await conn.execute(
    `SELECT COUNT(*) as remaining FROM founder_agent_evaluations
     WHERE (strengths IS NOT NULL AND strengths NOT LIKE 'sys:%')
        OR (concerns  IS NOT NULL AND concerns  NOT LIKE 'sys:%')
        OR (flags     IS NOT NULL AND flags     NOT LIKE 'sys:%')`
  );
  console.log(`Verification: plaintext strengths/concerns/flags remaining = ${remaining} (expected: 0)`);

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
