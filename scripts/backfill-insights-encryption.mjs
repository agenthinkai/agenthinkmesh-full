/**
 * backfill-insights-encryption.mjs
 *
 * Encrypts all plaintext high_score_patterns, low_score_patterns, failure_reasons
 * rows in founder_agent_insights using ENCRYPTION_MASTER_KEY (AES-256-GCM).
 *
 * Only processes rows where high_score_patterns IS NOT NULL AND NOT LIKE 'sys:%'
 * (i.e. plaintext rows only — already-encrypted rows are skipped).
 *
 * Usage:
 *   node scripts/backfill-insights-encryption.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mysql = require("../node_modules/mysql2/promise");
const dotenv = require("../node_modules/dotenv");
const crypto = require("crypto");

dotenv.config({ path: "../.env" });

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY;
if (!MASTER_KEY) {
  console.error("ENCRYPTION_MASTER_KEY is not set");
  process.exit(1);
}

const KEY_BYTES = Buffer.from(MASTER_KEY, "hex");
if (KEY_BYTES.length !== 32) {
  console.error(`ENCRYPTION_MASTER_KEY must be 64 hex chars (32 bytes). Got ${KEY_BYTES.length} bytes.`);
  process.exit(1);
}

function encryptWithMasterKey(value) {
  if (!value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY_BYTES, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `sys:${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
}

const BATCH_SIZE = 50;

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Count plaintext rows
  const [[{ cnt }]] = await conn.query(
    "SELECT COUNT(*) as cnt FROM founder_agent_insights WHERE high_score_patterns IS NOT NULL AND high_score_patterns NOT LIKE 'sys:%'"
  );
  const total = Number(cnt);
  console.log(`Plaintext rows to encrypt: ${total}`);
  if (total === 0) {
    console.log("Nothing to do.");
    await conn.end();
    return;
  }

  let processed = 0;
  let errors = 0;

  while (true) {
    const [rows] = await conn.query(
      "SELECT id, high_score_patterns, low_score_patterns, failure_reasons FROM founder_agent_insights WHERE high_score_patterns IS NOT NULL AND high_score_patterns NOT LIKE 'sys:%' LIMIT ?",
      [BATCH_SIZE]
    );
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      try {
        const encHsp = encryptWithMasterKey(row.high_score_patterns);
        const encLsp = encryptWithMasterKey(row.low_score_patterns);
        const encFr  = encryptWithMasterKey(row.failure_reasons);
        await conn.query(
          "UPDATE founder_agent_insights SET high_score_patterns=?, low_score_patterns=?, failure_reasons=? WHERE id=?",
          [encHsp, encLsp, encFr, row.id]
        );
        processed++;
      } catch (err) {
        console.error(`Error encrypting row ${row.id}:`, err.message);
        errors++;
      }
    }
    process.stdout.write(`\rEncrypted: ${processed}/${total} (errors: ${errors})`);
  }

  console.log(`\nBackfill complete — ${processed} rows encrypted, ${errors} errors.`);
  await conn.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
