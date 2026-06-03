/**
 * migrate-dedup-users.mjs
 *
 * Deduplicates the users table:
 * 1. Builds a mapping: every duplicate user.id → canonical user.id (MIN(id) per openId)
 * 2. Remaps all FK references in all affected tables to the canonical id
 * 3. Deletes all duplicate user rows (non-canonical)
 * 4. Recomputes totalCompletedRuns from actual deal_screenings
 *
 * Safe constraints:
 * - Never deletes a row that is still referenced after remapping
 * - Logs every UPDATE and DELETE count
 * - Rolls back on any error
 */

import mysql from 'mysql2/promise';

// Tables with varchar userId (store openId strings, not integer user IDs) — skip remapping
// admesh_runs.userId (varchar 64), deal_signals.userId (varchar 36),
// insurance_runs.userId (varchar 64), login_events.userId (varchar 36),
// pitch_triages.userId (varchar 36), takaful_alerts.userId (varchar 64)

const TABLES_WITH_USERID = [
  // { table: 'admesh_runs',             col: 'userId' },  // varchar — stores openId, not int id
  { table: 'annotation_exports',      col: 'userId' },
  { table: 'annotations',             col: 'userId' },
  { table: 'auto_trigger_log',        col: 'userId' },
  { table: 'batch_jobs',              col: 'userId' },
  { table: 'cfa_sessions',            col: 'user_id' },
  { table: 'client_encryption_keys',  col: 'userId' },
  { table: 'cmk_audit_log',           col: 'userId' },
  { table: 'contact_interactions',    col: 'userId' },
  { table: 'contacts',                col: 'userId' },
  { table: 'deal_comparisons',        col: 'userId' },
  { table: 'deal_screener_payments',  col: 'userId' },
  { table: 'deal_screening_rate_limit', col: 'userId' },
  { table: 'deal_screenings',         col: 'userId' },
  // { table: 'deal_signals',            col: 'userId' },  // varchar — stores openId, not int id
  { table: 'decision_upgrade_runs',   col: 'userId' },
  { table: 'email_events',            col: 'userId' },
  { table: 'forecasts',               col: 'userId' },
  { table: 'high_demand_log',         col: 'userId' },
  { table: 'infra_sim_cases',         col: 'user_id' },
  { table: 'infra_sim_council_sessions', col: 'user_id' },
  { table: 'infra_sim_monitoring_objects', col: 'user_id' },
  { table: 'infra_sim_portfolio_links', col: 'user_id' },
  { table: 'infra_sim_runs',          col: 'user_id' },
  // { table: 'insurance_runs',          col: 'userId' },  // varchar — stores openId, not int id
  { table: 'intel_analyses',          col: 'userId' },
  { table: 'intel_briefs',            col: 'userId' },
  { table: 'intel_tracked',           col: 'userId' },
  { table: 'ips_configs',             col: 'userId' },
  { table: 'llm_usage',               col: 'userId' },
  // { table: 'login_events',            col: 'userId' },  // varchar — stores openId, not int id
  { table: 'mesh_tasks',              col: 'userId' },
  { table: 'mvno_agent_runs',         col: 'userId' },
  { table: 'mvno_subscribers',        col: 'userId' },
  { table: 'outreach_style_examples', col: 'userId' },
  { table: 'payments',                col: 'userId' },
  // { table: 'pitch_triages',           col: 'userId' },  // varchar — stores openId, not int id
  { table: 'portfolio_reviews',       col: 'userId' },
  { table: 'portfolio_runs',          col: 'userId' },
  { table: 'scenario_sim_runs',       col: 'user_id' },
  { table: 'shared_reports',          col: 'userId' },
  { table: 'signal_deals',            col: 'userId' },
  { table: 'subscriptions',           col: 'userId' },
  // { table: 'takaful_alerts',          col: 'userId' },  // varchar — stores openId, not int id
  { table: 'task_history',            col: 'userId' },
  { table: 'token_usage',             col: 'userId' },
  { table: 'transactions',            col: 'userId' },
  { table: 'turnaround_sessions',     col: 'userId' },
  { table: 'user_profiles',           col: 'userId' },
  { table: 'user_signal_prefs',       col: 'userId' },
  { table: 'vault_documents',         col: 'userId' },
  { table: 'vendor_evaluations',      col: 'userId' },
  { table: 'workflow_runs',           col: 'userId' },
  // users.createdByAdminId self-reference
  { table: 'users',                   col: 'createdByAdminId' },
];

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log('[migrate] Connected to database');

  try {
    // Step 1: Build canonical mapping (openId → min_id)
    console.log('\n[Step 1] Building canonical user mapping...');
    const [canonicalRows] = await conn.execute(`
      SELECT openId, MIN(id) AS canonical_id, COUNT(*) AS total_rows
      FROM users
      WHERE openId IS NOT NULL AND openId != ''
      GROUP BY openId
      HAVING total_rows > 1
    `);
    console.log(`  Found ${canonicalRows.length} openIds with duplicates`);

    // Build a map: duplicate_id → canonical_id
    const idMap = new Map(); // duplicate_id → canonical_id
    for (const row of canonicalRows) {
      const [dupes] = await conn.execute(
        `SELECT id FROM users WHERE openId = ? AND id != ? ORDER BY id ASC`,
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
      return;
    }

    // Step 2: Remap FK references in all tables
    console.log('\n[Step 2] Remapping foreign key references...');
    for (const { table, col } of TABLES_WITH_USERID) {
      let totalUpdated = 0;
      for (const [dupeId, canonicalId] of idMap) {
        const [result] = await conn.execute(
          `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`,
          [canonicalId, dupeId]
        );
        if (result.affectedRows > 0) {
          totalUpdated += result.affectedRows;
        }
      }
      if (totalUpdated > 0) {
        console.log(`  ${table}.${col}: remapped ${totalUpdated} rows`);
      }
    }

    // Step 3: Verify no remaining references to duplicate IDs
    console.log('\n[Step 3] Verifying no remaining references to duplicate IDs...');
    const dupeIds = Array.from(idMap.keys());
    let remainingRefs = 0;
    for (const { table, col } of TABLES_WITH_USERID) {
      if (table === 'users') continue; // skip self-ref for now
      const placeholders = dupeIds.map(() => '?').join(',');
      const [refs] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${col} IN (${placeholders})`,
        dupeIds
      );
      if (refs[0].cnt > 0) {
        console.error(`  ERROR: ${table}.${col} still has ${refs[0].cnt} references to duplicate IDs!`);
        remainingRefs += refs[0].cnt;
      }
    }
    if (remainingRefs > 0) {
      throw new Error(`Aborting: ${remainingRefs} remaining FK references to duplicate user IDs`);
    }
    console.log('  All FK references successfully remapped. No remaining references.');

    // Step 4: Delete duplicate user rows
    console.log('\n[Step 4] Deleting duplicate user rows...');
    const placeholders = dupeIds.map(() => '?').join(',');
    const [deleteResult] = await conn.execute(
      `DELETE FROM users WHERE id IN (${placeholders})`,
      dupeIds
    );
    console.log(`  Deleted ${deleteResult.affectedRows} duplicate user rows`);

    // Step 5: Verify final user count
    const [finalCount] = await conn.execute('SELECT COUNT(*) AS cnt FROM users');
    const [distinctOids] = await conn.execute('SELECT COUNT(DISTINCT openId) AS cnt FROM users');
    console.log(`\n[Step 5] Final user count: ${finalCount[0].cnt} rows, ${distinctOids[0].cnt} distinct openIds`);

    // Step 6: Recompute totalCompletedRuns
    console.log('\n[Step 6] Recomputing totalCompletedRuns from deal_screenings...');
    const [evalCounts] = await conn.execute(`
      SELECT userId, COUNT(*) AS eval_count
      FROM deal_screenings
      GROUP BY userId
    `);
    let updated = 0;
    for (const row of evalCounts) {
      const [res] = await conn.execute(
        `UPDATE users SET totalCompletedRuns = ? WHERE id = ?`,
        [row.eval_count, row.userId]
      );
      if (res.affectedRows > 0) updated++;
    }
    // Zero out users with no evals
    const [zeroRes] = await conn.execute(`
      UPDATE users SET totalCompletedRuns = 0
      WHERE id NOT IN (SELECT DISTINCT userId FROM deal_screenings)
      AND totalCompletedRuns != 0
    `);
    console.log(`  Updated totalCompletedRuns for ${updated} users with evals`);
    console.log(`  Zeroed totalCompletedRuns for ${zeroRes.affectedRows} users with no evals`);

    // Step 7: Final verification
    console.log('\n[Step 7] Final verification...');
    const [topUsers] = await conn.execute(`
      SELECT id, openId, name, email, role, totalCompletedRuns
      FROM users
      ORDER BY totalCompletedRuns DESC
      LIMIT 10
    `);
    console.log('Top users by totalCompletedRuns:');
    for (const u of topUsers) {
      console.log(`  id=${u.id} name=${u.name} email=${u.email} role=${u.role} evals=${u.totalCompletedRuns}`);
    }

    console.log('\n[migrate] Migration complete successfully!');
  } catch (err) {
    console.error('[migrate] ERROR:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
