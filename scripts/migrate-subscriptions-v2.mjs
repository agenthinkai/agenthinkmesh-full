/**
 * Migration: Update subscriptions table + create token_usage table
 * Run: node scripts/migrate-subscriptions-v2.mjs
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('Running subscriptions v2 migration...\n');

  // 1. Add missing columns to subscriptions (if not already present)
  const alterCols = [
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan ENUM('starter','professional','enterprise') NOT NULL DEFAULT 'starter'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripePriceId VARCHAR(64)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokensRemaining INT NOT NULL DEFAULT 50`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tokensTotal INT NOT NULL DEFAULT 50`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewsAt TIMESTAMP NULL`,
  ];

  for (const sql of alterCols) {
    try {
      await conn.execute(sql);
      console.log('✅', sql.substring(0, 80));
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭  Column already exists, skipping');
      } else {
        throw e;
      }
    }
  }

  // 2. Create token_usage table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      sessionId VARCHAR(64),
      tokensUsed INT NOT NULL DEFAULT 1,
      action VARCHAR(64) NOT NULL DEFAULT 'council_run',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX tu_user_idx (userId),
      INDEX tu_session_idx (sessionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('\n✅ token_usage table ready');

  // 3. Ensure all existing users have a subscription row (starter plan)
  const [users] = await conn.execute('SELECT id FROM users');
  let created = 0;
  for (const user of users) {
    const [rows] = await conn.execute('SELECT id FROM subscriptions WHERE userId = ?', [user.id]);
    if (rows.length === 0) {
      await conn.execute(
        `INSERT INTO subscriptions (userId, planTier, plan, status, tokensRemaining, tokensTotal, startedAt, createdAt, updatedAt)
         VALUES (?, 'trial', 'starter', 'active', 50, 50, NOW(), NOW(), NOW())`,
        [user.id]
      );
      created++;
    }
  }
  console.log(`✅ Ensured subscription rows for all users (${created} created)`);

  console.log('\n✅ Migration complete.');
} finally {
  await conn.end();
}
