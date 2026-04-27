#!/usr/bin/env node
/**
 * rollback-recommended-action.mjs
 *
 * Decrypts all sys:-prefixed recommended_action values in founder_agent_evaluations
 * back to plaintext. This undoes the partial encryption from the first backfill run
 * that was killed mid-way.
 *
 * recommended_action is varchar(100) — it cannot hold encrypted values.
 * It should always be stored as plaintext.
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

function getMasterKey() {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_MASTER_KEY must be a 64-char hex string");
  }
  return Buffer.from(hex, "hex");
}

function decryptSys(encoded) {
  if (!encoded || !encoded.startsWith("sys:")) return encoded;
  const inner = encoded.slice(4);
  const parts = inner.split(":");
  if (parts.length !== 3) throw new Error(`Malformed sys: value: ${encoded.slice(0, 40)}`);
  const [ivHex, ciphertextHex, authTagHex] = parts;
  const key     = getMasterKey();
  const iv      = Buffer.from(ivHex, "hex");
  const cipherBuf = Buffer.from(ciphertextHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cipherBuf), decipher.final()]).toString("utf8");
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.execute(
    `SELECT id, recommended_action FROM founder_agent_evaluations WHERE recommended_action LIKE 'sys:%'`
  );
  console.log(`Rolling back ${rows.length} encrypted recommended_action values...`);

  let fixed = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const plaintext = decryptSys(row.recommended_action);
      await conn.execute(
        `UPDATE founder_agent_evaluations SET recommended_action=? WHERE id=?`,
        [plaintext, row.id]
      );
      fixed++;
      if (fixed % 100 === 0) console.log(`  Progress: ${fixed}/${rows.length}...`);
    } catch (err) {
      errors++;
      console.error(`  Error on row id=${row.id}: ${err.message}`);
    }
  }

  console.log(`Complete — ${fixed} rows restored to plaintext, ${errors} errors.`);

  // Verify
  const [[{ remaining }]] = await conn.execute(
    `SELECT COUNT(*) as remaining FROM founder_agent_evaluations WHERE recommended_action LIKE 'sys:%'`
  );
  console.log(`Verification: sys:-prefixed recommended_action remaining = ${remaining} (expected: 0)`);

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
