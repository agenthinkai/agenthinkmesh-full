/**
 * Registry Seed Fix — Blueprints + User Org Assignment
 * Fixes the two issues from the main seed run:
 *   1. twin_blueprints had 0 rows (regex missed the object format)
 *   2. User org assignment used wrong column name (open_id vs openId)
 */
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('ERROR: DATABASE_URL not set'); process.exit(1); }
const conn = await mysql.createConnection(DB_URL);
const now = Date.now();

// ── 1. Seed twin_blueprints directly ─────────────────────────────────────────
console.log('\n=== 1. Seeding twin_blueprints (direct) ===');

const blueprints = [
  { blueprint_id: "bp-damac", name: "DAMAC Properties Decision Twin", slug: "damac", industry: "Real Estate", organization_type: "Developer", description: "Strategic decision twin for luxury real estate development and investment decisions", default_simulation_mode: "institutional", security_profile: "standard", primary_color: "#b8860b", accent_color: "#1a1a2e", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-humain", name: "Humain Sovereign AI Decision Twin", slug: "humain", industry: "Technology", organization_type: "Sovereign AI Company", description: "Decision twin for sovereign AI infrastructure investment and Vision 2030 alignment", default_simulation_mode: "institutional", security_profile: "sovereign", primary_color: "#006c35", accent_color: "#c8a951", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-core42", name: "Core42 Enterprise AI Decision Twin", slug: "core42", industry: "Technology", organization_type: "AI Infrastructure", description: "Decision twin for enterprise AI deployment and sovereign cloud infrastructure", default_simulation_mode: "institutional", security_profile: "sovereign", primary_color: "#0066cc", accent_color: "#c0c0c0", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-bakalaria", name: "Bakalaria Food Group Decision Twin", slug: "bakalaria", industry: "Food & Beverage", organization_type: "Restaurant Group", description: "Decision twin for restaurant expansion, franchise, and supply chain decisions", default_simulation_mode: "institutional", security_profile: "standard", primary_color: "#008080", accent_color: "#c8a951", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-sami", name: "SAMI Defense AI Decision Twin", slug: "sami", industry: "Defense", organization_type: "Defense Manufacturer", description: "Decision twin for defense procurement, technology acquisition, and national security decisions", default_simulation_mode: "institutional", security_profile: "classified", primary_color: "#1a3a5c", accent_color: "#c8a951", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-alghanim", name: "Alghanim Industries Decision Twin", slug: "alghanim", industry: "Conglomerate", organization_type: "Family Conglomerate", description: "Decision twin for a diversified GCC conglomerate covering M&A, capital allocation, and vendor risk", default_simulation_mode: "institutional", security_profile: "confidential", primary_color: "#1a1a2e", accent_color: "#c8a951", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-nbk", name: "NBK Capital Allocation Twin", slug: "nbk", industry: "Banking", organization_type: "Commercial Bank", description: "Decision twin for credit allocation, investment portfolio, and regulatory capital decisions", default_simulation_mode: "institutional", security_profile: "confidential", primary_color: "#003087", accent_color: "#c8a951", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-zain", name: "Zain Group Telecom Decision Twin", slug: "zain", industry: "Telecommunications", organization_type: "Telecom Operator", description: "Decision twin for spectrum acquisition, network investment, and market expansion decisions", default_simulation_mode: "institutional", security_profile: "standard", primary_color: "#e4002b", accent_color: "#ffffff", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
  { blueprint_id: "bp-agenthink", name: "AgenThink Mesh Executive Decision Twin", slug: "agenthink", industry: "Technology", organization_type: "AI Startup", description: "Customer Zero executive twin for AgenThink Mesh — sovereign AI infrastructure company. Covers model training decisions, enterprise sales, talent, and capital allocation.", default_simulation_mode: "institutional", security_profile: "standard", primary_color: "#6366f1", accent_color: "#f59e0b", ui_theme: "dark", status: "ACTIVE", version: "1.0.0" },
];

for (const bp of blueprints) {
  try {
    await conn.execute(
      `INSERT INTO twin_blueprints (blueprint_id, name, slug, industry, organization_type, description, default_simulation_mode, default_decision_type_ids, default_report_template_ids, security_profile, primary_color, accent_color, ui_theme, executive_dashboard_layout, prompt_templates, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, ?, '{}', '{}', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), updated_at=VALUES(updated_at)`,
      [bp.blueprint_id, bp.name, bp.slug, bp.industry, bp.organization_type, bp.description, bp.default_simulation_mode, bp.security_profile, bp.primary_color, bp.accent_color, bp.ui_theme, bp.status, bp.version, now, now]
    );
    console.log(`  ✅ ${bp.blueprint_id}`);
  } catch (err) {
    console.warn(`  ❌ ${bp.blueprint_id}: ${err.message}`);
  }
}

// ── 2. Assign owner user to AgenThinkMesh org ─────────────────────────────────
console.log('\n=== 2. Assigning owner user to AgenThinkMesh org ===');
const ownerOpenId = process.env.OWNER_OPEN_ID;

if (ownerOpenId) {
  try {
    const [ownerRows] = await conn.execute(
      `SELECT id, name, email, orgId, role FROM users WHERE openId = ? LIMIT 1`,
      [ownerOpenId]
    );
    if (ownerRows.length > 0) {
      const owner = ownerRows[0];
      console.log(`  Found owner: ${owner.name} (${owner.email}), id=${owner.id}, current orgId=${owner.orgId}`);
      await conn.execute(
        `UPDATE users SET orgId = '1', role = 'admin' WHERE id = ?`,
        [owner.id]
      );
      console.log(`  ✅ Owner assigned to org id=1 with role=admin`);
    } else {
      console.log(`  ⚠️  Owner not found by openId. Trying by most recent admin...`);
      const [adminRows] = await conn.execute(
        `SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY createdAt ASC LIMIT 1`
      );
      if (adminRows.length > 0) {
        await conn.execute(`UPDATE users SET orgId = '1' WHERE id = ?`, [adminRows[0].id]);
        console.log(`  ✅ Admin ${adminRows[0].name} assigned to org id=1`);
      } else {
        // Assign the most recently created user (likely the owner)
        const [recentRows] = await conn.execute(
          `SELECT id, name, email FROM users ORDER BY createdAt DESC LIMIT 3`
        );
        console.log(`  Recent users:`, recentRows.map(r => `${r.name} (${r.email})`).join(', '));
        console.log(`  ℹ️  Manual org assignment needed — use /enterprise/setup or the Database panel.`);
      }
    }
  } catch (err) {
    console.warn(`  ❌ User assignment error: ${err.message}`);
  }
} else {
  console.log(`  ⚠️  OWNER_OPEN_ID not set. Checking for admin users...`);
  try {
    const [adminRows] = await conn.execute(
      `SELECT id, name, email, orgId FROM users WHERE role = 'admin' ORDER BY createdAt ASC LIMIT 1`
    );
    if (adminRows.length > 0) {
      const admin = adminRows[0];
      if (!admin.orgId) {
        await conn.execute(`UPDATE users SET orgId = '1' WHERE id = ?`, [admin.id]);
        console.log(`  ✅ Admin ${admin.name} assigned to org id=1`);
      } else {
        console.log(`  ✅ Admin ${admin.name} already has orgId=${admin.orgId}`);
      }
    } else {
      console.log(`  ℹ️  No admin users found yet. Org assignment will happen on first login.`);
    }
  } catch (err) {
    console.warn(`  ❌ ${err.message}`);
  }
}

// ── Final Verification ────────────────────────────────────────────────────────
const [counts] = await conn.execute(`
  SELECT
    (SELECT COUNT(*) FROM twin_blueprints) as blueprints,
    (SELECT COUNT(*) FROM council_personas) as council_personas,
    (SELECT COUNT(*) FROM decision_types) as decision_types,
    (SELECT COUNT(*) FROM kpi_definitions) as kpi_definitions,
    (SELECT COUNT(*) FROM data_connectors) as data_connectors,
    (SELECT COUNT(*) FROM report_registry) as report_types,
    (SELECT COUNT(*) FROM simulation_plugins) as sim_plugins,
    (SELECT COUNT(*) FROM users WHERE orgId IS NOT NULL AND orgId != '') as users_in_org
`);
console.log('\n=== FINAL POST-SEED COUNTS ===');
console.log(JSON.stringify(counts[0], null, 2));

await conn.end();
console.log('\n=== DONE ===');
