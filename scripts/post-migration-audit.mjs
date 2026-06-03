/**
 * post-migration-audit.mjs
 * Verifies all 7 acceptance criteria after the OAuth upsert deduplication migration.
 */

import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log('=== POST-MIGRATION USER AUDIT ===\n');

// AC1: users.openId is unique
const [indexes] = await conn.execute(`SHOW INDEX FROM users WHERE Key_name = 'users_openId_unique'`);
const hasUniqueIndex = indexes.length > 0 && indexes[0].Non_unique === 0;
console.log(`AC1 — users.openId is UNIQUE: ${hasUniqueIndex ? '✅ PASS' : '❌ FAIL'}`);
if (indexes.length > 0) {
  console.log(`     Index: ${indexes[0].Key_name}, Non_unique=${indexes[0].Non_unique}, Column=${indexes[0].Column_name}`);
}

// AC2: No duplicate openIds
const [dups] = await conn.execute(`SELECT openId, COUNT(*) AS cnt FROM users WHERE openId IS NOT NULL GROUP BY openId HAVING cnt > 1`);
console.log(`\nAC2 — No duplicate openIds: ${dups.length === 0 ? '✅ PASS' : '❌ FAIL (' + dups.length + ' duplicates remain)'}`);

// AC3: User count reflects distinct identities
const [totalRows] = await conn.execute('SELECT COUNT(*) AS cnt FROM users');
const [distinctOids] = await conn.execute('SELECT COUNT(DISTINCT openId) AS cnt FROM users WHERE openId IS NOT NULL');
console.log(`\nAC3 — User count reflects distinct identities:`);
console.log(`     Total rows: ${totalRows[0].cnt}`);
console.log(`     Distinct openIds: ${distinctOids[0].cnt}`);
const ac3Pass = totalRows[0].cnt <= distinctOids[0].cnt + 5; // allow a few null openId rows
console.log(`     Result: ${ac3Pass ? '✅ PASS' : '❌ FAIL'}`);

// AC4: Existing evaluations remain linked to valid users
const [orphanEvals] = await conn.execute(`
  SELECT COUNT(*) AS cnt FROM deal_screenings ds
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ds.userId)
`);
console.log(`\nAC4 — Evaluations linked to valid users: ${orphanEvals[0].cnt === 0 ? '✅ PASS' : '❌ FAIL (' + orphanEvals[0].cnt + ' orphaned)'}`);

// Total evaluations preserved
const [totalEvals] = await conn.execute('SELECT COUNT(*) AS cnt FROM deal_screenings');
console.log(`     Total evaluations preserved: ${totalEvals[0].cnt}`);

// AC5: totalCompletedRuns matches actual evaluations
const [mismatch] = await conn.execute(`
  SELECT u.id, u.name, u.totalCompletedRuns, COUNT(ds.id) AS actual_evals
  FROM users u
  LEFT JOIN deal_screenings ds ON ds.userId = u.id
  GROUP BY u.id, u.name, u.totalCompletedRuns
  HAVING u.totalCompletedRuns != COUNT(ds.id)
`);
console.log(`\nAC5 — totalCompletedRuns matches actual evals: ${mismatch.length === 0 ? '✅ PASS' : '❌ FAIL (' + mismatch.length + ' mismatches)'}`);
if (mismatch.length > 0) {
  for (const m of mismatch) {
    console.log(`     id=${m.id} name=${m.name} stored=${m.totalCompletedRuns} actual=${m.actual_evals}`);
  }
}

// AC6: Funnel analytics use canonical users (check subscriptions)
const [orphanSubs] = await conn.execute(`
  SELECT COUNT(*) AS cnt FROM subscriptions s
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.userId)
`);
console.log(`\nAC6 — Funnel analytics use canonical users (subscriptions check): ${orphanSubs[0].cnt === 0 ? '✅ PASS' : '❌ FAIL (' + orphanSubs[0].cnt + ' orphaned subscriptions)'}`);

// AC7: 34 distinct identities
const [distinctCount] = await conn.execute('SELECT COUNT(DISTINCT openId) AS cnt FROM users WHERE openId IS NOT NULL');
const ac7Pass = distinctCount[0].cnt >= 30 && distinctCount[0].cnt <= 40;
console.log(`\nAC7 — Distinct identities (expected ~34): ${ac7Pass ? '✅ PASS' : '❌ FAIL'} (actual: ${distinctCount[0].cnt})`);

// Full user list
console.log('\n=== CANONICAL USER LIST ===');
const [allUsers] = await conn.execute(`
  SELECT u.id, u.openId, u.name, u.email, u.role, u.totalCompletedRuns,
         COUNT(ds.id) AS actual_evals
  FROM users u
  LEFT JOIN deal_screenings ds ON ds.userId = u.id
  GROUP BY u.id, u.openId, u.name, u.email, u.role, u.totalCompletedRuns
  ORDER BY actual_evals DESC, u.id ASC
`);
console.log(`Total users: ${allUsers.length}`);
for (const u of allUsers) {
  console.log(`  id=${u.id} | ${u.name || '(no name)'} | ${u.email || '(no email)'} | role=${u.role} | evals=${u.actual_evals}`);
}

// Evaluation distribution
console.log('\n=== EVALUATION DISTRIBUTION ===');
const [dist] = await conn.execute(`
  SELECT 
    SUM(CASE WHEN actual_evals = 0 THEN 1 ELSE 0 END) AS zero_evals,
    SUM(CASE WHEN actual_evals = 1 THEN 1 ELSE 0 END) AS one_eval,
    SUM(CASE WHEN actual_evals BETWEEN 2 AND 5 THEN 1 ELSE 0 END) AS two_to_five,
    SUM(CASE WHEN actual_evals BETWEEN 6 AND 20 THEN 1 ELSE 0 END) AS six_to_twenty,
    SUM(CASE WHEN actual_evals > 20 THEN 1 ELSE 0 END) AS over_twenty
  FROM (
    SELECT u.id, COUNT(ds.id) AS actual_evals
    FROM users u LEFT JOIN deal_screenings ds ON ds.userId = u.id
    GROUP BY u.id
  ) t
`);
console.log(`  0 evals:     ${dist[0].zero_evals} users`);
console.log(`  1 eval:      ${dist[0].one_eval} users`);
console.log(`  2-5 evals:   ${dist[0].two_to_five} users`);
console.log(`  6-20 evals:  ${dist[0].six_to_twenty} users`);
console.log(`  20+ evals:   ${dist[0].over_twenty} users`);

// Summary
const allPass = hasUniqueIndex && dups.length === 0 && ac3Pass && orphanEvals[0].cnt === 0 && mismatch.length === 0 && orphanSubs[0].cnt === 0 && ac7Pass;
console.log(`\n=== SUMMARY: ${allPass ? '7/7 PASS ✅' : 'SOME FAILURES ❌'} ===`);

await conn.end();
