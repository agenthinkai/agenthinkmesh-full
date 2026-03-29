/**
 * Migration v2b: Update subscriptions table + create token_usage table
 * Simplified — no user iteration to avoid connection hangs
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  connectTimeout: 10000,
});

try {
  console.log('Running subscriptions v2b migration...\n');

  const stmts = [
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan ENUM('starter','professional','enterprise') NOT NULL DEFAULT 'starter'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripePriceId VARCHAR(64)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokensRemaining INT NOT NULL DEFAULT 50`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokensTotal INT NOT NULL DEFAULT 50`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewsAt TIMESTAMP NULL`,
    `CREATE TABLE IF NOT EXISTS token_usage (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      sessionId VARCHAR(64),
      tokensUsed INT NOT NULL DEFAULT 1,
      action VARCHAR(64) NOT NULL DEFAULT 'council_run',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX tu_user_idx (userId),
      INDEX tu_session_idx (sessionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const sql of stmts) {
    try {
      await conn.execute(sql);
      console.log('✅', sql.trim().substring(0, 70));
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭  Already exists:', sql.trim().substring(0, 50));
      } else {
        console.error('❌ Error:', e.message);
      }
    }
  }

  console.log('\n✅ Migration complete.');
  await conn.end();
  process.exit(0);
} catch (e) {
  console.error('Fatal:', e.message);
  await conn.end();
  process.exit(1);
}
