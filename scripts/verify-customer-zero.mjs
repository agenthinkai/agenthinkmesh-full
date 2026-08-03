/**
 * Customer Zero Status Verification Script
 * Uses exact column names from drizzle/schema.ts
 */
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('ERROR: DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(DB_URL);

async function q(label, sql) {
  try {
    const [rows] = await conn.execute(sql);
    console.log(`\n=== ${label} ===`);
    if (rows.length === 0) { console.log('  (no rows)'); }
    else { rows.forEach((r, i) => console.log(`  [${i+1}]`, JSON.stringify(r))); }
    return rows;
  } catch (err) {
    console.log(`\n=== ${label} ===`);
    console.log(`  ERROR: ${err.message}`);
    return [];
  }
}

// 1. AgenThink organization record
await q('1. AgenThink Organization Record',
  `SELECT id, name, slug, status, plan, createdAt FROM organizations
   WHERE name LIKE '%AgenThink%' OR slug LIKE '%agenthink%' LIMIT 5`);

// 1b. All organizations
await q('1b. All Organizations',
  `SELECT id, name, slug, status, plan, createdAt FROM organizations ORDER BY createdAt DESC LIMIT 10`);

// 2. Twin blueprints
await q('2. Twin Blueprints (all)',
  `SELECT id, blueprint_id, display_name, status, version, created_at FROM twin_blueprints ORDER BY created_at DESC LIMIT 10`);

// 3. Twin instances
await q('3. Twin Instances (all)',
  `SELECT id, orgId, blueprintId, instanceSlug, displayName, status, createdAt FROM twin_instances ORDER BY createdAt DESC LIMIT 10`);

// 4. Users with org access
await q('4. Users',
  `SELECT id, name, email, role, orgId, createdAt FROM users ORDER BY createdAt DESC LIMIT 10`);

// 5. Council personas
await q('5. Council Personas',
  `SELECT id, persona_id, display_name, role_title, expertise_domain, created_at FROM council_personas ORDER BY created_at DESC LIMIT 10`);

// 6. Decision types
await q('6. Decision Types',
  `SELECT id, type_id, display_name, category, status, created_at FROM decision_types ORDER BY created_at DESC LIMIT 10`);

// 7. KPI definitions
await q('7. KPI Definitions',
  `SELECT id, kpi_id, kpi_set_id, name, category, status, created_at FROM kpi_definitions ORDER BY created_at DESC LIMIT 10`);

// 8. Data connectors
await q('8. Data Connectors',
  `SELECT id, connector_id, name, connector_type, status, created_at FROM data_connectors ORDER BY created_at DESC LIMIT 10`);

// 9. Twin sessions (decision queue)
await q('9. Twin Sessions',
  `SELECT id, twinInstanceId, orgId, userId, sessionType, status, startedAt FROM twin_sessions ORDER BY startedAt DESC LIMIT 10`);

// 10. Enterprise audit log
await q('10. Enterprise Audit Log',
  `SELECT id, orgId, userId, action, createdAt FROM enterprise_audit_log ORDER BY createdAt DESC LIMIT 10`);

// 11. Twin compositions (scenario workspace)
await q('11. Twin Compositions',
  `SELECT id, orgId, status, createdAt FROM twin_compositions ORDER BY createdAt DESC LIMIT 10`);

// 12. Outcome ledger (AROS v2)
await q('12. Outcome Ledger (aros_outcome_ledger_v2)',
  `SELECT id, company_id, outcome_status, review_date, created_at FROM aros_outcome_ledger_v2 ORDER BY created_at DESC LIMIT 10`);

// 13. Decision memory (ontology)
await q('13. Decision Memory (Domain Ontology)',
  `SELECT id, orgId, createdAt FROM decision_memory ORDER BY createdAt DESC LIMIT 5`);

// 14. Scenario sim runs
await q('14. Scenario Sim Runs',
  `SELECT id, orgId, status, createdAt FROM scenario_sim_runs ORDER BY createdAt DESC LIMIT 5`);

// 15. Report registry
await q('15. Report Registry',
  `SELECT id, report_type_id, name, status, created_at FROM report_registry ORDER BY created_at DESC LIMIT 10`);

// 16. Simulation plugins
await q('16. Simulation Plugins',
  `SELECT id, plugin_id, name, status, created_at FROM simulation_plugins ORDER BY created_at DESC LIMIT 10`);

// 17. AROS decision twins v2
await q('17. AROS Decision Twins V2',
  `SELECT id, company_id, status, created_at FROM aros_decision_twins_v2 ORDER BY created_at DESC LIMIT 5`);

// 18. COMPLETE SUMMARY
await q('18. COMPLETE SUMMARY COUNTS',
  `SELECT
    (SELECT COUNT(*) FROM organizations) as orgs,
    (SELECT COUNT(*) FROM twin_blueprints) as blueprints,
    (SELECT COUNT(*) FROM twin_instances) as twin_instances,
    (SELECT COUNT(*) FROM users WHERE orgId IS NOT NULL) as users_with_org,
    (SELECT COUNT(*) FROM council_personas) as council_personas,
    (SELECT COUNT(*) FROM decision_types) as decision_types,
    (SELECT COUNT(*) FROM kpi_definitions) as kpi_definitions,
    (SELECT COUNT(*) FROM data_connectors) as data_connectors,
    (SELECT COUNT(*) FROM twin_sessions) as twin_sessions,
    (SELECT COUNT(*) FROM enterprise_audit_log) as audit_entries,
    (SELECT COUNT(*) FROM twin_compositions) as twin_compositions,
    (SELECT COUNT(*) FROM aros_outcome_ledger_v2) as outcome_ledger_entries,
    (SELECT COUNT(*) FROM decision_memory) as decision_memory_entries,
    (SELECT COUNT(*) FROM scenario_sim_runs) as scenario_runs,
    (SELECT COUNT(*) FROM report_registry) as report_types,
    (SELECT COUNT(*) FROM simulation_plugins) as sim_plugins`);

await conn.end();
console.log('\n=== VERIFICATION COMPLETE ===');
