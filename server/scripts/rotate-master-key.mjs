#!/usr/bin/env node
/**
 * rotate-master-key.mjs
 *
 * Re-encrypts all sys:-prefixed fields in pitch_triages using a new master key.
 *
 * Usage:
 *   NEW_ENCRYPTION_MASTER_KEY=<64-char-hex> node rotate-master-key.mjs [--dry-run]
 *
 * The OLD key is read from ENCRYPTION_MASTER_KEY env.
 * The NEW key is read from NEW_ENCRYPTION_MASTER_KEY env.
 *
 * Fields rotated per row:
 *   - agentOutputs
 *   - keySignals
 *   - missingInfo
 *
 * Safety:
 *   - --dry-run logs what would happen without writing anything
 *   - If any row fails: the entire rotation is aborted (all-or-nothing)
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
  const iv       = Buffer.from(ivHex,       "hex");
  const cipherBuf = Buffer.from(ciphertextHex, "hex");
  const authTag  = Buffer.from(authTagHex,  "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv);
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const oldKeyBuf = validateKey(process.env.ENCRYPTION_MASTER_KEY,     "ENCRYPTION_MASTER_KEY");
  const newKeyBuf = validateKey(process.env.NEW_ENCRYPTION_MASTER_KEY, "NEW_ENCRYPTION_MASTER_KEY");

  if (oldKeyBuf.equals(newKeyBuf)) {
    throw new Error("OLD and NEW keys are identical — rotation aborted");
  }

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Fetch all rows that have at least one sys:-prefixed field
  const [rows] = await conn.execute(
    `SELECT id, agentOutputs, keySignals, missingInfo
     FROM pitch_triages
     WHERE agentOutputs LIKE 'sys:%'
        OR keySignals   LIKE 'sys:%'
        OR missingInfo  LIKE 'sys:%'`
  );

  console.log(`Rotating ${rows.length} rows...`);

  if (DRY_RUN) {
    console.log(`Would rotate ${rows.length} rows`);
    console.log("Dry run complete — no changes made");
    await conn.end();
    return;
  }

  // ── Atomic: build all updates first, abort on any failure ────────────────
  const updates = [];
  for (const row of rows) {
    try {
      const newAo = row.agentOutputs?.startsWith("sys:")
        ? encryptSys(decryptSys(row.agentOutputs, oldKeyBuf), newKeyBuf)
        : row.agentOutputs;
      const newKs = row.keySignals?.startsWith("sys:")
        ? encryptSys(decryptSys(row.keySignals, oldKeyBuf), newKeyBuf)
        : row.keySignals;
      const newMi = row.missingInfo?.startsWith("sys:")
        ? encryptSys(decryptSys(row.missingInfo, oldKeyBuf), newKeyBuf)
        : row.missingInfo;
      updates.push({ id: row.id, agentOutputs: newAo, keySignals: newKs, missingInfo: newMi });
    } catch (err) {
      await conn.end();
      console.error(`\nRotation ABORTED — failed on row id=${row.id}: ${err.message}`);
      console.error("No rows were written. The database is unchanged.");
      process.exit(1);
    }
  }

  // ── All decrypts succeeded — now write ───────────────────────────────────
  for (const u of updates) {
    await conn.execute(
      `UPDATE pitch_triages SET agentOutputs=?, keySignals=?, missingInfo=? WHERE id=?`,
      [u.agentOutputs, u.keySignals, u.missingInfo, u.id]
    );
    console.log(`Rotated row id=${u.id}`);
  }

  console.log(`\nRotation complete — ${updates.length} rows re-encrypted`);
  console.log("\nNow update ENCRYPTION_MASTER_KEY in your secrets panel to the new key.");
  await conn.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
