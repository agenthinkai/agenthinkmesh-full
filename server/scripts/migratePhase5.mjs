/**
 * migratePhase5.mjs — Apply Phase 5 schema migration
 */
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config();

const sql = readFileSync('drizzle/0115_stiff_mach_iv.sql', 'utf8');
const stmts = sql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('---') && !s.startsWith('//'));

const db = await mysql.createConnection(process.env.DATABASE_URL);
let ok = 0, skip = 0, errors = 0;

for (const stmt of stmts) {
  if (!stmt) continue;
  try {
    await db.execute(stmt);
    ok++;
  } catch (e) {
    if (['ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME', 'ER_DUP_INDEX'].includes(e.code)) {
      skip++;
    } else {
      console.error(`ERR [${e.code}]: ${e.message.slice(0, 120)}`);
      errors++;
    }
  }
}

await db.end();
console.log(`Applied: ${ok}, Skipped: ${skip}, Errors: ${errors}`);

// Verify new tables exist
const db2 = await mysql.createConnection(process.env.DATABASE_URL);
const tables = [
  'aros_decision_twins_v2',
  'aros_hidden_variables',
  'aros_monitoring_events',
  'aros_outcome_ledger_v2',
  'aros_accuracy_snapshots',
];
for (const t of tables) {
  const [[{ c }]] = await db2.execute(`SELECT COUNT(*) as c FROM ${t}`);
  console.log(`${t}: ${c} rows`);
}
await db2.end();
