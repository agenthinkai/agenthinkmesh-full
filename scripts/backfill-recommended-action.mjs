/**
 * backfill-recommended-action.mjs
 *
 * Encrypts all plaintext recommended_action values in founder_agent_evaluations
 * using ENCRYPTION_MASTER_KEY (AES-256-GCM, sys: prefix format).
 *
 * Safe to re-run: skips rows already encrypted (sys: prefix).
 * Processes in batches of 100 to avoid memory pressure.
 */

import mysql from '/home/ubuntu/agenthinkmesh-full/node_modules/mysql2/promise.js';
import crypto from 'crypto';
import dotenv from '/home/ubuntu/agenthinkmesh-full/node_modules/dotenv/lib/main.js';

dotenv.config({ path: '/home/ubuntu/agenthinkmesh-full/.env' });

const MASTER_KEY_HEX = process.env.ENCRYPTION_MASTER_KEY;
if (!MASTER_KEY_HEX) throw new Error('ENCRYPTION_MASTER_KEY not set');
const MASTER_KEY = Buffer.from(MASTER_KEY_HEX, 'hex');

function encryptWithMasterKey(value) {
  if (value == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `sys:${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;
}

const BATCH = 100;

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Count plaintext rows
  const [[{ cnt }]] = await conn.query(
    "SELECT COUNT(*) as cnt FROM founder_agent_evaluations WHERE recommended_action IS NOT NULL AND recommended_action NOT LIKE 'sys:%'"
  );
  console.log(`[Backfill] ${cnt} plaintext recommended_action rows to encrypt`);

  let offset = 0;
  let totalEncrypted = 0;
  let errors = 0;

  while (true) {
    const [rows] = await conn.query(
      "SELECT id, recommended_action FROM founder_agent_evaluations WHERE recommended_action IS NOT NULL AND recommended_action NOT LIKE 'sys:%' LIMIT ?",
      [BATCH]
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const encrypted = encryptWithMasterKey(row.recommended_action);
        await conn.query(
          'UPDATE founder_agent_evaluations SET recommended_action = ? WHERE id = ?',
          [encrypted, row.id]
        );
        totalEncrypted++;
      } catch (err) {
        console.error(`[Backfill] Error on id=${row.id}: ${err.message}`);
        errors++;
      }
    }

    offset += rows.length;
    process.stdout.write(`\r[Backfill] Encrypted ${totalEncrypted} / ${cnt} rows...`);
  }

  console.log(`\n[Backfill] Done. Encrypted: ${totalEncrypted}, Errors: ${errors}`);

  // Final verification
  const [[{ remaining }]] = await conn.query(
    "SELECT COUNT(*) as remaining FROM founder_agent_evaluations WHERE recommended_action IS NOT NULL AND recommended_action NOT LIKE 'sys:%'"
  );
  console.log(`[Backfill] Remaining plaintext rows: ${remaining}`);

  await conn.end();
})().catch(e => { console.error(e.message); process.exit(1); });
