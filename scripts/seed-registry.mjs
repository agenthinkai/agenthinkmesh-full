/**
 * Registry Seed Script — Customer Zero Gap Closure
 * ─────────────────────────────────────────────────────────────────────────────
 * Pushes all in-memory FALLBACK_* data into the live database tables.
 * Safe to run multiple times (INSERT IGNORE / ON DUPLICATE KEY UPDATE).
 *
 * Tables seeded:
 *   1. twin_blueprints        (from FALLBACK_BLUEPRINTS)
 *   2. council_personas       (from FALLBACK_PERSONA_SETS)
 *   3. decision_types         (from FALLBACK_DECISION_TYPES)
 *   4. kpi_definitions        (from FALLBACK_KPI_SETS)
 *   5. data_connectors        (from BUILTIN_CONNECTORS)
 *   6. report_registry        (from FALLBACK_REPORT_TYPES)
 *   7. simulation_plugins     (from FALLBACK_SIMULATION_PLUGINS)
 *
 * Also:
 *   8. Assigns the platform owner user to org id=1 with role=admin
 */
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('ERROR: DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(DB_URL);
const now = Date.now();

let seeded = 0;
let skipped = 0;

async function upsert(table, idCol, rows, mapFn) {
  if (!rows || rows.length === 0) { console.log(`  [${table}] No rows to seed.`); return; }
  for (const row of rows) {
    const mapped = mapFn(row);
    const cols = Object.keys(mapped);
    const vals = Object.values(mapped);
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols.filter(c => c !== idCol).map(c => `${c} = VALUES(${c})`).join(', ');
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})
                 ON DUPLICATE KEY UPDATE ${updates}`;
    try {
      await conn.execute(sql, vals);
      seeded++;
    } catch (err) {
      console.warn(`  [${table}] Error on ${idCol}=${mapped[idCol]}: ${err.message}`);
      skipped++;
    }
  }
  console.log(`  [${table}] Seeded ${rows.length} rows.`);
}

// ── 1. Twin Blueprints ────────────────────────────────────────────────────────
console.log('\n=== 1. Seeding twin_blueprints ===');
// Load the FALLBACK_BLUEPRINTS from the compiled service
// We use a dynamic import trick via tsx — read the raw array from the file
const bpFile = path.join(__dirname, '../server/lib/twinBlueprintService.ts');
const bpContent = await import('fs').then(fs => fs.promises.readFile(bpFile, 'utf8'));

// Extract blueprint IDs from the file to check what's there
const bpMatches = [...bpContent.matchAll(/blueprintId:\s*["']([^"']+)["']/g)].map(m => m[1]);
console.log(`  Found ${bpMatches.length} blueprints in FALLBACK_BLUEPRINTS`);

// Seed blueprints using raw SQL from parsed data
// Parse the blueprint objects from the TypeScript source
const bpObjects = [];
const bpBlocks = bpContent.split(/\{\s*\n\s*blueprintId:/);
for (let i = 1; i < bpBlocks.length; i++) {
  const block = bpBlocks[i];
  const getId = block.match(/^["']([^"']+)["']/);
  const getName = block.match(/name:\s*["']([^"']+)["']/);
  const getSlug = block.match(/slug:\s*["']([^"']+)["']/);
  const getIndustry = block.match(/industry:\s*["']([^"']+)["']/);
  const getStatus = block.match(/status:\s*["']([^"']+)["']/);
  const getVersion = block.match(/version:\s*["']([^"']+)["']/);
  const getPrimaryColor = block.match(/primaryColor:\s*["']([^"']+)["']/);
  const getAccentColor = block.match(/accentColor:\s*["']([^"']+)["']/);
  const getUiTheme = block.match(/uiTheme:\s*["']([^"']+)["']/);
  const getSecurityProfile = block.match(/securityProfile:\s*["']([^"']+)["']/);
  const getSimMode = block.match(/defaultSimulationMode:\s*["']([^"']+)["']/);
  const getOrgType = block.match(/organizationType:\s*["']([^"']+)["']/);
  const getDesc = block.match(/description:\s*["']([^"']+)["']/);

  if (getId && getName) {
    bpObjects.push({
      blueprint_id: getId[1],
      name: getName[1],
      slug: getSlug ? getSlug[1] : getId[1],
      industry: getIndustry ? getIndustry[1] : 'General',
      organization_type: getOrgType ? getOrgType[1] : 'Enterprise',
      description: getDesc ? getDesc[1] : '',
      default_simulation_mode: getSimMode ? getSimMode[1] : 'institutional',
      default_decision_type_ids: '[]',
      default_report_template_ids: '[]',
      security_profile: getSecurityProfile ? getSecurityProfile[1] : 'standard',
      primary_color: getPrimaryColor ? getPrimaryColor[1] : '#3b82f6',
      accent_color: getAccentColor ? getAccentColor[1] : '#f59e0b',
      ui_theme: getUiTheme ? getUiTheme[1] : 'dark',
      executive_dashboard_layout: '{}',
      prompt_templates: '{}',
      status: getStatus ? getStatus[1] : 'ACTIVE',
      version: getVersion ? getVersion[1] : '1.0.0',
      created_at: now,
      updated_at: now,
    });
  }
}

for (const bp of bpObjects) {
  const cols = Object.keys(bp);
  const vals = Object.values(bp);
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols.filter(c => c !== 'blueprint_id').map(c => `${c} = VALUES(${c})`).join(', ');
  try {
    await conn.execute(
      `INSERT INTO twin_blueprints (${cols.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
      vals
    );
    seeded++;
  } catch (err) {
    console.warn(`  [twin_blueprints] Error on ${bp.blueprint_id}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${bpObjects.length} blueprints.`);

// ── 2. Council Personas ───────────────────────────────────────────────────────
console.log('\n=== 2. Seeding council_personas ===');
const cpFile = path.join(__dirname, '../server/lib/councilPersonaService.ts');
const cpContent = await import('fs').then(fs => fs.promises.readFile(cpFile, 'utf8'));
// Extract persona objects using regex
const personaMatches = [...cpContent.matchAll(/\{\s*personaId:\s*["']([^"']+)["'],\s*personaSetId:\s*["']([^"']+)["'],\s*industryTag:\s*["']([^"']+)["'],\s*role:\s*["']([^"']+)["'],\s*title:\s*["']([^"']+)["'],\s*sortOrder:\s*(\d+),\s*voteWeight:\s*([\d.]+),/g)];
console.log(`  Found ${personaMatches.length} personas`);

for (const m of personaMatches) {
  const [, personaId, personaSetId, industryTag, role, title, sortOrder, voteWeight] = m;
  // Extract systemPrompt for this persona
  const afterMatch = cpContent.slice(m.index);
  const promptMatch = afterMatch.match(/systemPrompt:\s*["']([^"']{10,}?)["']/);
  const systemPrompt = promptMatch ? promptMatch[1] : `You are the ${role} on the decision council.`;

  try {
    await conn.execute(
      `INSERT INTO council_personas (persona_id, persona_set_id, industry_tag, role, title, system_prompt, vote_weight, bias_profile, sort_order, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE role=VALUES(role), title=VALUES(title), system_prompt=VALUES(system_prompt), updated_at=VALUES(updated_at)`,
      [personaId, personaSetId, industryTag, role, title, systemPrompt, parseInt(voteWeight), parseInt(sortOrder), now, now]
    );
    seeded++;
  } catch (err) {
    console.warn(`  [council_personas] Error on ${personaId}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${personaMatches.length} council personas.`);

// ── 3. Decision Types ─────────────────────────────────────────────────────────
console.log('\n=== 3. Seeding decision_types ===');
const dtFile = path.join(__dirname, '../server/lib/decisionTypeService.ts');
const dtContent = await import('fs').then(fs => fs.promises.readFile(dtFile, 'utf8'));
const dtMatches = [...dtContent.matchAll(/decisionTypeId:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["'],\s*category:\s*["']([^"']+)["']/g)];
console.log(`  Found ${dtMatches.length} decision types`);

for (const m of dtMatches) {
  const [, decisionTypeId, name, category] = m;
  const afterMatch = dtContent.slice(m.index);
  const descMatch = afterMatch.match(/description:\s*["']([^"']+)["']/);
  const description = descMatch ? descMatch[1] : '';
  const simModeMatch = afterMatch.match(/defaultSimulationMode:\s*["']([^"']+)["']/);
  const simMode = simModeMatch ? simModeMatch[1] : 'institutional';

  try {
    await conn.execute(
      `INSERT INTO decision_types (decision_type_id, name, category, description, default_simulation_mode, evaluation_framework, required_input_fields, output_schema, industry_tags, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '{}', '[]', '{}', '["all"]', 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), description=VALUES(description), updated_at=VALUES(updated_at)`,
      [decisionTypeId, name, category, description, simMode, now, now]
    );
    seeded++;
  } catch (err) {
    console.warn(`  [decision_types] Error on ${decisionTypeId}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${dtMatches.length} decision types.`);

// ── 4. KPI Definitions ────────────────────────────────────────────────────────
console.log('\n=== 4. Seeding kpi_definitions ===');
const kpiFile = path.join(__dirname, '../server/lib/kpiService.ts');
const kpiContent = await import('fs').then(fs => fs.promises.readFile(kpiFile, 'utf8'));
const kpiMatches = [...kpiContent.matchAll(/kpiId:\s*["']([^"']+)["'],\s*kpiSetId:\s*["']([^"']+)["'],\s*industryTag:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["'],\s*label:\s*["']([^"']+)["'],\s*unit:\s*["']([^"']+)["']/g)];
console.log(`  Found ${kpiMatches.length} KPIs`);

for (const m of kpiMatches) {
  const [, kpiId, kpiSetId, industryTag, name, label, unit] = m;
  const afterMatch = kpiContent.slice(m.index);
  const dirMatch = afterMatch.match(/direction:\s*["']([^"']+)["']/);
  const direction = dirMatch ? dirMatch[1] : 'higher';
  const catMatch = afterMatch.match(/category:\s*["']([^"']+)["']/);
  const category = catMatch ? catMatch[1] : 'general';

  try {
    await conn.execute(
      `INSERT INTO kpi_definitions (kpi_id, kpi_set_id, industry_tag, name, label, unit, direction, threshold, category, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), label=VALUES(label), unit=VALUES(unit), updated_at=VALUES(updated_at)`,
      [kpiId, kpiSetId, industryTag, name, label, unit, direction, category, now, now]
    );
    seeded++;
  } catch (err) {
    console.warn(`  [kpi_definitions] Error on ${kpiId}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${kpiMatches.length} KPI definitions.`);

// ── 5. Data Connectors ────────────────────────────────────────────────────────
console.log('\n=== 5. Seeding data_connectors ===');
const dcFile = path.join(__dirname, '../server/lib/connectorAdapterInterface.ts');
const dcContent = await import('fs').then(fs => fs.promises.readFile(dcFile, 'utf8'));
const dcMatches = [...dcContent.matchAll(/connectorId:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["'],\s*connectorType:\s*["']([^"']+)["']/g)];
console.log(`  Found ${dcMatches.length} connectors`);

for (const m of dcMatches) {
  const [, connectorId, name, connectorType] = m;
  const afterMatch = dcContent.slice(m.index);
  const descMatch = afterMatch.match(/description:\s*["']([^"']+)["']/);
  const description = descMatch ? descMatch[1] : '';
  const authMatch = afterMatch.match(/authType:\s*["']([^"']+)["']/);
  const authType = authMatch ? authMatch[1] : 'none';

  try {
    await conn.execute(
      `INSERT INTO data_connectors (connector_id, name, connector_type, description, config_schema, auth_type, supports_test_connection, supports_schema_inference, supports_streaming, max_rows_per_sync, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '{}', ?, 1, 0, 0, 10000, 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updated_at=VALUES(updated_at)`,
      [connectorId, name, connectorType, description, authType, now, now]
    );
    seeded++;
  } catch (err) {
    console.warn(`  [data_connectors] Error on ${connectorId}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${dcMatches.length} data connectors.`);

// ── 6. Report Registry ────────────────────────────────────────────────────────
console.log('\n=== 6. Seeding report_registry ===');
const rrFile = path.join(__dirname, '../server/lib/reportRegistryService.ts');
const rrContent = await import('fs').then(fs => fs.promises.readFile(rrFile, 'utf8'));
const rrMatches = [...rrContent.matchAll(/reportTypeId:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["']/g)];
console.log(`  Found ${rrMatches.length} report types`);

for (const m of rrMatches) {
  const [, reportTypeId, name] = m;
  const afterMatch = rrContent.slice(m.index);
  const descMatch = afterMatch.match(/description:\s*["']([^"']+)["']/);
  const description = descMatch ? descMatch[1] : '';
  const catMatch = afterMatch.match(/category:\s*["']([^"']+)["']/);
  const category = catMatch ? catMatch[1] : 'general';
  const fmtMatch = afterMatch.match(/outputFormat:\s*["']([^"']+)["']/);
  const outputFormat = fmtMatch ? fmtMatch[1] : 'pdf';

  try {
    await conn.execute(
      `INSERT INTO report_registry (report_type_id, name, description, category, output_format, template_schema, required_sections, optional_sections, branding_defaults, industry_tags, generator_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '{}', '[]', '[]', '{}', '["all"]', 'template', 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updated_at=VALUES(updated_at)`,
      [reportTypeId, name, description, category, outputFormat, now, now]
    );
    seeded++;
  } catch (err) {
    console.warn(`  [report_registry] Error on ${reportTypeId}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${rrMatches.length} report types.`);

// ── 7. Simulation Plugins ─────────────────────────────────────────────────────
console.log('\n=== 7. Seeding simulation_plugins ===');
const spFile = path.join(__dirname, '../server/lib/simulationRegistryService.ts');
const spContent = await import('fs').then(fs => fs.promises.readFile(spFile, 'utf8'));
const spMatches = [...spContent.matchAll(/pluginId:\s*["']([^"']+)["'],\s*name:\s*["']([^"']+)["']/g)];
console.log(`  Found ${spMatches.length} simulation plugins`);

for (const m of spMatches) {
  const [, pluginId, name] = m;
  const afterMatch = spContent.slice(m.index);
  const descMatch = afterMatch.match(/description:\s*["']([^"']+)["']/);
  const description = descMatch ? descMatch[1] : '';
  const catMatch = afterMatch.match(/category:\s*["']([^"']+)["']/);
  const category = catMatch ? catMatch[1] : 'stress_test';
  const engineMatch = afterMatch.match(/engineType:\s*["']([^"']+)["']/);
  const engineType = engineMatch ? engineMatch[1] : 'perturbation';
  const costMatch = afterMatch.match(/costTier:\s*["']([^"']+)["']/);
  const costTier = costMatch ? costMatch[1] : 'medium';
  const maxMatch = afterMatch.match(/maxScenarioCount:\s*(\d+)/);
  const maxScenarios = maxMatch ? parseInt(maxMatch[1]) : 1000;

  try {
    await conn.execute(
      `INSERT INTO simulation_plugins (plugin_id, name, description, category, engine_type, config_schema, default_config, max_scenario_count, cost_tier, requires_confirmation, industry_tags, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '{}', '{}', ?, ?, 0, '["all"]', 'ACTIVE', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updated_at=VALUES(updated_at)`,
      [pluginId, name, description, category, engineType, maxScenarios, costTier, now, now]
    );
    seeded++;
  } catch (err) {
    console.warn(`  [simulation_plugins] Error on ${pluginId}: ${err.message}`);
    skipped++;
  }
}
console.log(`  Seeded ${spMatches.length} simulation plugins.`);

// ── 8. Assign owner user to AgenThinkMesh org ─────────────────────────────────
console.log('\n=== 8. Assigning owner user to AgenThinkMesh org ===');
const ownerOpenId = process.env.OWNER_OPEN_ID;
if (ownerOpenId) {
  try {
    const [ownerRows] = await conn.execute(
      `SELECT id, name, email, orgId, role FROM users WHERE open_id = ? LIMIT 1`,
      [ownerOpenId]
    );
    if (ownerRows.length > 0) {
      const owner = ownerRows[0];
      console.log(`  Found owner: ${owner.name} (${owner.email}), id=${owner.id}, current orgId=${owner.orgId}`);
      if (!owner.orgId || owner.orgId !== 1) {
        await conn.execute(
          `UPDATE users SET orgId = 1, role = 'admin' WHERE id = ?`,
          [owner.id]
        );
        console.log(`  ✅ Owner assigned to org id=1 with role=admin`);
        seeded++;
      } else {
        console.log(`  ✅ Owner already assigned to org id=1`);
      }
    } else {
      console.log(`  ⚠️  Owner user not found (open_id=${ownerOpenId}). Will try by role=admin.`);
      // Try to find any admin user
      const [adminRows] = await conn.execute(
        `SELECT id, name, email, orgId FROM users WHERE role = 'admin' LIMIT 1`
      );
      if (adminRows.length > 0) {
        const admin = adminRows[0];
        await conn.execute(`UPDATE users SET orgId = 1 WHERE id = ?`, [admin.id]);
        console.log(`  ✅ Admin user ${admin.name} assigned to org id=1`);
        seeded++;
      } else {
        console.log(`  ℹ️  No admin user found. Org assignment skipped — will be done via /enterprise/setup.`);
      }
    }
  } catch (err) {
    console.warn(`  [users] Error assigning org: ${err.message}`);
    skipped++;
  }
} else {
  console.log(`  ⚠️  OWNER_OPEN_ID not set. Org assignment skipped.`);
}

// ── Final Summary ─────────────────────────────────────────────────────────────
console.log('\n=== SEED COMPLETE ===');
console.log(`  Total seeded: ${seeded}`);
console.log(`  Total skipped/errors: ${skipped}`);

// Verify counts
const [counts] = await conn.execute(`
  SELECT
    (SELECT COUNT(*) FROM twin_blueprints) as blueprints,
    (SELECT COUNT(*) FROM council_personas) as council_personas,
    (SELECT COUNT(*) FROM decision_types) as decision_types,
    (SELECT COUNT(*) FROM kpi_definitions) as kpi_definitions,
    (SELECT COUNT(*) FROM data_connectors) as data_connectors,
    (SELECT COUNT(*) FROM report_registry) as report_types,
    (SELECT COUNT(*) FROM simulation_plugins) as sim_plugins,
    (SELECT COUNT(*) FROM users WHERE orgId = 1) as users_in_org
`);
console.log('\n=== POST-SEED COUNTS ===');
console.log(JSON.stringify(counts[0], null, 2));

await conn.end();
