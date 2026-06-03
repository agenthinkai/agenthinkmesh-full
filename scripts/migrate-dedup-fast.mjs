/**
 * migrate-dedup-fast.mjs
 *
 * Fast version: uses CASE WHEN for batch remapping instead of per-ID updates.
 * Remaps all FK references from duplicate user IDs to canonical user IDs in one
 * UPDATE per table.
 */

import mysql from 'mysql2/promise';

// Only integer userId columns
const TABLES_WITH_USERID = [
  { table: 'annotation_exports',        col: 'userId' },
  { table: 'annotations',               col: 'userId' },
  { table: 'auto_trigger_log',          col: 'userId' },
  { table: 'batch_jobs',                col: 'userId' },
  { table: 'cfa_sessions',              col: 'user_id' },
  { table: 'client_encryption_keys',    col: 'userId' },
  { table: 'cmk_audit_log',             col: 'userId' },
  { table: 'contact_interactions',      col: 'userId' },
  { table: 'contacts',                  col: 'userId' },
  { table: 'deal_comparisons',          col: 'userId' },
  { table: 'deal_screener_payments',    col: 'userId' },
  { table: 'deal_screening_rate_limit', col: 'userId' },
  { table: 'deal_screenings',           col: 'userId' },
  { table: 'decision_upgrade_runs',     col: 'userId' },
  { table: 'email_events',              col: 'userId' },
  { table: 'forecasts',                 col: 'userId' },
  { table: 'high_demand_log',           col: 'userId' },
  { table: 'infra_sim_cases',           col: 'user_id' },
  { table: 'infra_sim_council_sessions',col: 'user_id' },
  { table: 'infra_sim_monitoring_objects', col: 'user_id' },
  { table: 'infra_sim_portfolio_links', col: 'user_id' },
  { table: 'infra_sim_runs',            col: 'user_id' },
  { table: 'intel_analyses',            col: 'userId' },
  { table: 'intel_briefs',              col: 'userId' },
  { table: 'intel_tracked',             col: 'userId' },
  { table: 'ips_configs',               col: 'userId' },
  { table: 'llm_usage',                 col: 'userId' },
  { table: 'mesh_tasks',                col: 'userId' },
  { table: 'mvno_agent_runs',           col: 'userId' },
  { table: 'mvno_subscribers',          col: 'userId' },
  { table: 'outreach_style_examples',   col: 'userId' },
  { table: 'payments',                  col: 'userId' },
  { table: 'portfolio_reviews',         col: 'userId' },
  { table: 'portfolio_runs',            col: 'userId' },
  { table: 'scenario_sim_runs',         col: 'user_id' },
  { table: 'shared_reports',            col: 'userId' },
  { table: 'signal_deals',              col: 'userId' },
  { table: 'subscriptions',             col: 'userId' },
  { table: 'task_history',              col: 'userId' },
  { table: 'token_usage',               col: 'userId' },
  { table: 'transactions',              col: 'userId' },
  { table: 'turnaround_sessions',       col: 'userId' },
  { table: 'user_profiles',             col: 'userId' },
  { table: 'user_signal_prefs',         col: 'userId' },
  { table: 'vault_documents',           col: 'userId' },
  { table: 'vendor_evaluations',        col: 'userId' },
  { table: 'workflow_runs',             col: 'userId' },
  { table: 'users',                     col: 'createdByAdminId' },
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log('[migrate-fast] Connected to database');

// Step 1: Build canonical mapping
console.log('\n[Step 1] Building canonical user mapping...');
const [canonicalRows] = await conn.execute(`
  SELECT openId, MIN(id) AS canonical_id, COUNT(*) AS total_rows
  FROM users
  WHERE openId IS NOT NULL AND openId != ''
  GROUP BY openId
  HAVING total_rows > 1
`);
console.log(`  Found ${canonicalRows.length} openIds with duplicates`);

// Build idMap: duplicate_id (int) → canonical_id (int)
const idMap = new Map();
for (const row of canonicalRows) {
  const [dupes] = await conn.execute(
    `SELECT id FROM users WHERE openId = ? AND id != ?`,
    [row.openId, row.canonical_id]
  );
  for (const dupe of dupes) {
    idMap.set(dupe.id, row.canonical_id);
  }
}
console.log(`  Total duplicate user IDs to remap: ${idMap.size}`);

if (idMap.size === 0) {
  console.log('  No duplicates found. Nothing to do.');
  await conn.end();
  process.exit(0);
}

// Build CASE WHEN expression for batch update
// UPDATE t SET col = CASE col WHEN dupe1 THEN canon1 WHEN dupe2 THEN canon2 ... END WHERE col IN (dupe1, dupe2, ...)
const dupeIds = Array.from(idMap.keys());
const caseWhen = dupeIds.map(id => `WHEN ${id} THEN ${idMap.get(id)}`).join(' ');
const inList = dupeIds.join(',');

// Step 2: Batch remap FK references
console.log('\n[Step 2] Batch remapping foreign key references...');
for (const { table, col } of TABLES_WITH_USERID) {
  const sql = `UPDATE ${table} SET ${col} = CASE ${col} ${caseWhen} ELSE ${col} END WHERE ${col} IN (${inList})`;
  const [result] = await conn.execute(sql);
  if (result.affectedRows > 0) {
    console.log(`  ${table}.${col}: remapped ${result.affectedRows} rows`);
  }
}

// Step 3: Verify no remaining references
console.log('\n[Step 3] Verifying no remaining references to duplicate IDs...');
let remainingRefs = 0;
for (const { table, col } of TABLES_WITH_USERID) {
  if (table === 'users') continue;
  const [refs] = await conn.execute(`SELECT COUNT(*) AS cnt FROM ${table} WHERE ${col} IN (${inList})`);
  if (refs[0].cnt > 0) {
    console.error(`  ERROR: ${table}.${col} still has ${refs[0].cnt} references to duplicate IDs`);
    remainingRefs += refs[0].cnt;
  }
}
if (remainingRefs > 0) {
  console.error(`Aborting: ${remainingRefs} remaining FK references`);
  await conn.end();
  process.exit(1);
}
console.log('  All FK references successfully remapped.');

// Step 4: Delete duplicate user rows
console.log('\n[Step 4] Deleting duplicate user rows...');
const [deleteResult] = await conn.execute(`DELETE FROM users WHERE id IN (${inList})`);
console.log(`  Deleted ${deleteResult.affectedRows} duplicate user rows`);

// Step 5: Verify final count
const [finalCount] = await conn.execute('SELECT COUNT(*) AS cnt FROM users');
const [distinctOids] = await conn.execute('SELECT COUNT(DISTINCT openId) AS cnt FROM users');
console.log(`\n[Step 5] Final: ${finalCount[0].cnt} rows, ${distinctOids[0].cnt} distinct openIds`);

// Step 6: Recompute totalCompletedRuns
console.log('\n[Step 6] Recomputing totalCompletedRuns...');
// Reset all to 0 first
await conn.execute('UPDATE users SET totalCompletedRuns = 0');
// Set actual counts
const [evalCounts] = await conn.execute(`
  SELECT userId, COUNT(*) AS eval_count FROM deal_screenings GROUP BY userId
`);
let updated = 0;
for (const row of evalCounts) {
  const [res] = await conn.execute(
    'UPDATE users SET totalCompletedRuns = ? WHERE id = ?',
    [row.eval_count, row.userId]
  );
  if (res.affectedRows > 0) updated++;
}
console.log(`  Updated totalCompletedRuns for ${updated} users`);

// Step 7: Final verification
console.log('\n[Step 7] Final verification — top users:');
const [topUsers] = await conn.execute(`
  SELECT id, openId, name, email, role, totalCompletedRuns
  FROM users ORDER BY totalCompletedRuns DESC LIMIT 10
`);
for (const u of topUsers) {
  console.log(`  id=${u.id} name=${u.name || '(null)'} email=${u.email || '(null)'} role=${u.role} evals=${u.totalCompletedRuns}`);
}

console.log('\n[migrate-fast] Migration complete successfully!');
await conn.end();
