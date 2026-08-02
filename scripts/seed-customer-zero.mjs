/**
 * seed-customer-zero.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer Zero: AgenThinkMesh Internal Organisation
 *
 * Provisions:
 *   - 1 Organisation: AgenThinkMesh
 *   - 8 Departments: Executive, Engineering, Product, Sales, Finance,
 *                    Operations, Customer Success, Board
 *   - 8 Roles: CEO, CTO, CPO, VP Sales, CFO, COO, Head of CS, Board Member
 *   - 10 Decision Twin Instances (status: active)
 *
 * Run: node scripts/seed-customer-zero.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

// Parse mysql2 connection string
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.replace("/", ""),
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const conn = await createConnection(parseDbUrl(DB_URL));
  console.log("Connected to database.");

  try {
    // ── 1. Check if org already exists ──────────────────────────────────────
    const [existing] = await conn.execute(
      "SELECT id FROM organizations WHERE slug = ?",
      ["agenthinkmesh"]
    );
    let orgId;

    if (existing.length > 0) {
      orgId = existing[0].id;
      console.log(`Organisation already exists (id=${orgId}). Skipping org creation.`);
    } else {
      // ── 2. Create Organisation ─────────────────────────────────────────────
      const [orgResult] = await conn.execute(
        `INSERT INTO organizations (name, slug, plan, approvedDomains, dailyTokenLimit, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          "AgenThinkMesh",
          "agenthinkmesh",
          "enterprise",
          JSON.stringify(["@agenthinkai.com", "@agenthinkmesh.com"]),
          1000000,
          "active",
        ]
      );
      orgId = orgResult.insertId;
      console.log(`Created organisation: AgenThinkMesh (id=${orgId})`);
    }

    // ── 3. Create Departments ────────────────────────────────────────────────
    const departments = [
      { name: "Executive", slug: "executive", description: "C-Suite and executive leadership", sortOrder: 1 },
      { name: "Engineering", slug: "engineering", description: "Platform engineering and infrastructure", sortOrder: 2 },
      { name: "Product", slug: "product", description: "Product management and design", sortOrder: 3 },
      { name: "Sales", slug: "sales", description: "Revenue and business development", sortOrder: 4 },
      { name: "Finance", slug: "finance", description: "Financial planning and analysis", sortOrder: 5 },
      { name: "Operations", slug: "operations", description: "Business operations and delivery", sortOrder: 6 },
      { name: "Customer Success", slug: "customer-success", description: "Customer onboarding and retention", sortOrder: 7 },
      { name: "Board", slug: "board", description: "Board of Directors", sortOrder: 8 },
    ];

    const deptIds = {};
    for (const dept of departments) {
      const [existing] = await conn.execute(
        "SELECT id FROM departments WHERE orgId = ? AND slug = ?",
        [orgId, dept.slug]
      );
      if (existing.length > 0) {
        deptIds[dept.slug] = existing[0].id;
        console.log(`  Department '${dept.name}' already exists (id=${existing[0].id})`);
      } else {
        const [r] = await conn.execute(
          `INSERT INTO departments (orgId, name, slug, description, sortOrder, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [orgId, dept.name, dept.slug, dept.description, dept.sortOrder]
        );
        deptIds[dept.slug] = r.insertId;
        console.log(`  Created department: ${dept.name} (id=${r.insertId})`);
      }
    }

    // ── 4. Create Roles ──────────────────────────────────────────────────────
    const roles = [
      {
        name: "Chief Executive Officer", slug: "ceo",
        permissions: ["twin:run", "twin:simulate", "twin:create", "org:admin", "audit:read", "report:generate"],
        twinAccess: ["*"],
        isSystemRole: 1, sortOrder: 1,
      },
      {
        name: "Chief Technology Officer", slug: "cto",
        permissions: ["twin:run", "twin:simulate", "twin:create", "audit:read", "report:generate"],
        twinAccess: ["engineering-twin", "executive-twin", "board-twin"],
        isSystemRole: 1, sortOrder: 2,
      },
      {
        name: "Chief Product Officer", slug: "cpo",
        permissions: ["twin:run", "twin:simulate", "report:generate"],
        twinAccess: ["product-twin", "executive-twin"],
        isSystemRole: 1, sortOrder: 3,
      },
      {
        name: "VP Sales", slug: "vp-sales",
        permissions: ["twin:run", "twin:simulate", "report:generate"],
        twinAccess: ["sales-twin", "aros-twin"],
        isSystemRole: 0, sortOrder: 4,
      },
      {
        name: "Chief Financial Officer", slug: "cfo",
        permissions: ["twin:run", "twin:simulate", "report:generate", "audit:read"],
        twinAccess: ["finance-twin", "captwin", "executive-twin"],
        isSystemRole: 1, sortOrder: 5,
      },
      {
        name: "Chief Operating Officer", slug: "coo",
        permissions: ["twin:run", "twin:simulate", "report:generate"],
        twinAccess: ["operations-twin", "executive-twin"],
        isSystemRole: 1, sortOrder: 6,
      },
      {
        name: "Head of Customer Success", slug: "head-cs",
        permissions: ["twin:run", "report:generate"],
        twinAccess: ["cs-twin"],
        isSystemRole: 0, sortOrder: 7,
      },
      {
        name: "Board Member", slug: "board-member",
        permissions: ["twin:run", "report:generate", "audit:read"],
        twinAccess: ["board-twin", "executive-twin"],
        isSystemRole: 0, sortOrder: 8,
      },
    ];

    const roleIds = {};
    for (const role of roles) {
      const [existing] = await conn.execute(
        "SELECT id FROM enterprise_roles WHERE orgId = ? AND slug = ?",
        [orgId, role.slug]
      );
      if (existing.length > 0) {
        roleIds[role.slug] = existing[0].id;
        console.log(`  Role '${role.name}' already exists (id=${existing[0].id})`);
      } else {
        const [r] = await conn.execute(
          `INSERT INTO enterprise_roles (orgId, name, slug, permissions, twinAccess, isSystemRole, sortOrder, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            orgId, role.name, role.slug,
            JSON.stringify(role.permissions),
            JSON.stringify(role.twinAccess),
            role.isSystemRole, role.sortOrder,
          ]
        );
        roleIds[role.slug] = r.insertId;
        console.log(`  Created role: ${role.name} (id=${r.insertId})`);
      }
    }

    // ── 5. Create Twin Instances ─────────────────────────────────────────────
    const twins = [
      {
        slug: "executive-twin", name: "Executive Decision Twin",
        blueprint: "executive-council", dept: "executive",
        description: "Strategic decision support for C-Suite. Runs GCC council mode.",
        industry: "Technology", geography: "GCC",
        councilPersonaSetId: "gcc-executive", governanceProfile: "CONFIDENTIAL",
      },
      {
        slug: "captwin", name: "CapTwin — Capital Allocation",
        blueprint: "capital-allocation", dept: "finance",
        description: "Capital allocation and investment decision support.",
        industry: "Finance", geography: "GCC",
        councilPersonaSetId: "gcc-finance", governanceProfile: "CONFIDENTIAL",
      },
      {
        slug: "aros-twin", name: "AROS — Revenue Operating System",
        blueprint: "revenue-operations", dept: "sales",
        description: "AI Revenue Operating System for sales intelligence and pipeline management.",
        industry: "Technology", geography: "Global",
        councilPersonaSetId: "global-sales", governanceProfile: "STANDARD",
      },
      {
        slug: "sales-twin", name: "Sales Intelligence Twin",
        blueprint: "sales-intelligence", dept: "sales",
        description: "Deal screening, prospect intelligence, and pipeline analysis.",
        industry: "Technology", geography: "GCC",
        councilPersonaSetId: "gcc-sales", governanceProfile: "STANDARD",
      },
      {
        slug: "finance-twin", name: "Finance & FP&A Twin",
        blueprint: "financial-planning", dept: "finance",
        description: "Financial planning, analysis, and scenario modelling.",
        industry: "Technology", geography: "GCC",
        councilPersonaSetId: "gcc-finance", governanceProfile: "CONFIDENTIAL",
      },
      {
        slug: "engineering-twin", name: "Engineering Decision Twin",
        blueprint: "engineering-council", dept: "engineering",
        description: "Technical architecture, build vs buy, and engineering trade-off decisions.",
        industry: "Technology", geography: "Global",
        councilPersonaSetId: "global-engineering", governanceProfile: "STANDARD",
      },
      {
        slug: "product-twin", name: "Product Strategy Twin",
        blueprint: "product-strategy", dept: "product",
        description: "Product roadmap prioritisation, feature trade-offs, and market positioning.",
        industry: "Technology", geography: "Global",
        councilPersonaSetId: "global-product", governanceProfile: "STANDARD",
      },
      {
        slug: "operations-twin", name: "Operations Twin",
        blueprint: "operations-council", dept: "operations",
        description: "Operational efficiency, vendor management, and process optimisation.",
        industry: "Technology", geography: "GCC",
        councilPersonaSetId: "gcc-operations", governanceProfile: "STANDARD",
      },
      {
        slug: "cs-twin", name: "Customer Success Twin",
        blueprint: "customer-success", dept: "customer-success",
        description: "Customer health scoring, churn risk, and expansion opportunity identification.",
        industry: "Technology", geography: "Global",
        councilPersonaSetId: "global-cs", governanceProfile: "STANDARD",
      },
      {
        slug: "board-twin", name: "Board Intelligence Twin",
        blueprint: "board-council", dept: "board",
        description: "Board-level strategic intelligence, governance decisions, and investor relations.",
        industry: "Technology", geography: "GCC",
        councilPersonaSetId: "gcc-board", governanceProfile: "SOVEREIGN",
      },
    ];

    const twinIds = {};
    for (const twin of twins) {
      const [existing] = await conn.execute(
        "SELECT id FROM twin_instances WHERE orgId = ? AND instanceSlug = ?",
        [orgId, twin.slug]
      );
      if (existing.length > 0) {
        twinIds[twin.slug] = existing[0].id;
        console.log(`  Twin '${twin.name}' already exists (id=${existing[0].id})`);
      } else {
        const deptId = deptIds[twin.dept];
        const [r] = await conn.execute(
          `INSERT INTO twin_instances
             (orgId, deptId, blueprintId, instanceSlug, displayName, description,
              industry, geography, councilPersonaSetId, governanceProfile,
              configJson, status, provisionedAt, activatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 'active', NOW(), NOW())`,
          [
            orgId, deptId, twin.blueprint, twin.slug, twin.name, twin.description,
            twin.industry, twin.geography, twin.councilPersonaSetId, twin.governanceProfile,
          ]
        );
        twinIds[twin.slug] = r.insertId;
        console.log(`  Created twin: ${twin.name} (id=${r.insertId})`);
      }
    }

    // ── 6. Summary ───────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  Customer Zero Provisioning Complete");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  Organisation ID : ${orgId}`);
    console.log(`  Departments     : ${Object.keys(deptIds).length}`);
    console.log(`  Roles           : ${Object.keys(roleIds).length}`);
    console.log(`  Decision Twins  : ${Object.keys(twinIds).length}`);
    console.log("\n  Next step: Add users via /admin/create-org or the Enterprise Dashboard.");
    console.log("  Users must be added as org members with the appropriate role.");
    console.log("\n  Twin IDs:");
    for (const [slug, id] of Object.entries(twinIds)) {
      console.log(`    ${slug.padEnd(20)} → id=${id}`);
    }

  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
