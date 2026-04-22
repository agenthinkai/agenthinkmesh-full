/**
 * dedup-email-events.mjs
 * Removes duplicate rows from email_events, keeping only the earliest
 * row per (userId, emailType) pair, then applies the unique constraint.
 *
 * Run once: node scripts/dedup-email-events.mjs
 */
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

console.log("[dedup] Counting duplicate rows...");
const [rows] = await conn.execute(`
  SELECT userId, emailType, COUNT(*) as cnt
  FROM email_events
  GROUP BY userId, emailType
  HAVING cnt > 1
`);
console.log(`[dedup] Found ${rows.length} duplicate (userId, emailType) pairs`);

let totalDeleted = 0;
if (rows.length > 0) {
  for (const row of rows) {
    // Find the minimum id (earliest row) for this pair
    const [[minRow]] = await conn.execute(
      `SELECT MIN(id) as minId FROM email_events WHERE userId = ? AND emailType = ?`,
      [row.userId, row.emailType]
    );
    // Delete all other rows for this pair
    const [result] = await conn.execute(
      `DELETE FROM email_events WHERE userId = ? AND emailType = ? AND id != ?`,
      [row.userId, row.emailType, minRow.minId]
    );
    totalDeleted += result.affectedRows;
    console.log(`[dedup]   userId=${row.userId} emailType=${row.emailType}: kept id=${minRow.minId}, deleted ${result.affectedRows} duplicates`);
  }
  console.log(`[dedup] Total deleted: ${totalDeleted} rows`);
} else {
  console.log("[dedup] No duplicates found — table is already clean");
}

await conn.end();
console.log("[dedup] Done. You can now run pnpm db:push to apply the unique constraint.");
