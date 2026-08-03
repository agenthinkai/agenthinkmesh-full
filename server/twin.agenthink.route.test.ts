/**
 * Production regression tests for /twin/agenthink routing
 *
 * Requirements:
 * 1. /twin/agenthink must render AgenThinkTwin, not DecisionTwin
 * 2. getTemplate("agenthink") must never return KEO data silently
 * 3. The AgenThink blueprint (bp-agenthink) must be registered in the DB
 * 4. The AgenThinkMesh org (orgId=1) must exist and be active
 * 5. Farouq Sultan (admin) must be assigned to orgId=1
 */
import { describe, it, expect, vi } from "vitest";

// ── 1. Route guard: getTemplate("agenthink") must NOT return KEO data ─────────
describe("getTemplate agenthink guard", () => {
  it("does not return KEO defaults for agenthink slug", async () => {
    // Dynamically import to get the live module
    const { getTemplate } = await import("../client/src/lib/companyTemplate");
    const template = getTemplate("agenthink");
    // Must not silently return KEO's $210M revenue / $30M EBITDA
    expect(template.defaults.rev).not.toBe(210);
    expect(template.defaults.eb).not.toBe(30);
    expect(template.name).not.toBe("KEO");
    expect(template.id).toBe("agenthink");
  });

  it("returns a routing-error sentinel, not real KEO data", async () => {
    const { getTemplate } = await import("../client/src/lib/companyTemplate");
    const template = getTemplate("agenthink");
    // The guard returns a broken template with rev=0 to surface the error visibly
    expect(template.defaults.rev).toBe(0);
    expect(template.defaults.eb).toBe(0);
  });

  it("still returns KEO template for keo slug", async () => {
    const { getTemplate } = await import("../client/src/lib/companyTemplate");
    const template = getTemplate("keo");
    expect(template.id).toBe("keo");
    expect(template.name).toBe("KEO");
    expect(template.defaults.rev).toBe(210);
  });

  it("returns KEO fallback for unknown slugs", async () => {
    const { getTemplate } = await import("../client/src/lib/companyTemplate");
    const template = getTemplate("unknown-company-xyz");
    expect(template.id).toBe("keo");
  });

  it("logs a console.error when agenthink slug is passed", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getTemplate } = await import("../client/src/lib/companyTemplate");
    getTemplate("agenthink");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("routing error")
    );
    consoleSpy.mockRestore();
  });
});

// ── 2. App.tsx: AgenThinkTwin must be an eager import ─────────────────────────
describe("App.tsx AgenThinkTwin import", () => {
  it("AgenThinkTwin is not wrapped in lazy()", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const appPath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");

    // Must NOT have lazy(() => import("./pages/AgenThinkTwin"))
    expect(content).not.toMatch(/lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*["']\.\/pages\/AgenThinkTwin["']\s*\)/);

    // Must have a direct import statement
    expect(content).toMatch(/^import AgenThinkTwin from ["']\.\/pages\/AgenThinkTwin["']/m);
  });

  it("/twin/agenthink route is declared before /twin/:templateId", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const appPath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(appPath, "utf-8");

    const agenthinkPos = content.indexOf('path="/twin/agenthink"');
    const genericPos = content.indexOf('path="/twin/:templateId"');

    expect(agenthinkPos).toBeGreaterThan(-1);
    expect(genericPos).toBeGreaterThan(-1);
    expect(agenthinkPos).toBeLessThan(genericPos);
  });
});

// ── 3. AgenThinkTwin.tsx: component structure ─────────────────────────────────
describe("AgenThinkTwin component structure", () => {
  it("does not contain KEO or $210M or $30M hardcoded values", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/AgenThinkTwin.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must not contain KEO branding or KEO financial defaults
    expect(content).not.toMatch(/\bKEO\b/);
    expect(content).not.toMatch(/\$210M/);
    expect(content).not.toMatch(/\$30M/);
    expect(content).not.toMatch(/rev:\s*210/);
    expect(content).not.toMatch(/eb:\s*30/);
  });

  it("references the correct blueprint ID bp-agenthink", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/AgenThinkTwin.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toMatch(/bp-agenthink/);
  });

  it("does not import getTemplate from companyTemplate", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/AgenThinkTwin.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    // AgenThinkTwin must not use the DecisionTwin template system
    expect(content).not.toMatch(/getTemplate/);
    expect(content).not.toMatch(/companyTemplate/);
  });

  it("uses tRPC for data fetching, not hardcoded company data", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/AgenThinkTwin.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    // Must use tRPC
    expect(content).toMatch(/trpc\./);
  });
});

// ── 4. Database: AgenThink org and blueprint must exist ───────────────────────
describe("AgenThink database records", () => {
  it("AgenThinkMesh org exists in DB with id=1 and status=active", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, name, slug, status FROM organizations WHERE id = 1 LIMIT 1"
      ) as [Array<{ id: number; name: string; slug: string; status: string }>, unknown];
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("AgenThinkMesh");
      expect(rows[0].slug).toBe("agenthinkmesh");
      expect(rows[0].status).toBe("active");
    } finally {
      if (conn) await conn.end();
    }
  });

  it("bp-agenthink blueprint exists in DB with status=ACTIVE", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, blueprint_id, name, status FROM twin_blueprints WHERE blueprint_id = 'bp-agenthink' LIMIT 1"
      ) as [Array<{ id: number; blueprint_id: string; name: string; status: string }>, unknown];
      expect(rows).toHaveLength(1);
      expect(rows[0].blueprint_id).toBe("bp-agenthink");
      expect(rows[0].status).toBe("ACTIVE");
    } finally {
      if (conn) await conn.end();
    }
  });

  it("executive-twin instance exists in DB for orgId=1 with status=active", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, orgId, instanceSlug, displayName, status FROM twin_instances WHERE orgId = 1 AND instanceSlug = 'executive-twin' LIMIT 1"
      ) as [Array<{ id: number; orgId: number; instanceSlug: string; displayName: string; status: string }>, unknown];
      expect(rows).toHaveLength(1);
      expect(rows[0].orgId).toBe(1);
      expect(rows[0].instanceSlug).toBe("executive-twin");
      expect(rows[0].status).toBe("active");
    } finally {
      if (conn) await conn.end();
    }
  });

  it("Farouq Sultan is assigned to orgId=1 as admin", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, name, email, role, orgId FROM users WHERE id = 1 LIMIT 1"
      ) as [Array<{ id: number; name: string; email: string; role: string; orgId: string }>, unknown];
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Farouq Sultan");
      expect(rows[0].role).toBe("admin");
      expect(String(rows[0].orgId)).toBe("1");
    } finally {
      if (conn) await conn.end();
    }
  });
});

// ── 5. No KEO data leaks into the /twin/agenthink server route ────────────────
describe("Server-side route guard", () => {
  it("twinFactory.blueprints.get returns bp-agenthink data, not KEO", async () => {
    // Verify the blueprint service returns the correct blueprint for bp-agenthink
    const { getBlueprintById } = await import("../server/lib/twinBlueprintService");
    const blueprint = await getBlueprintById("bp-agenthink");
    expect(blueprint).not.toBeNull();
    expect(blueprint?.blueprintId).toBe("bp-agenthink");
    expect(blueprint?.name).not.toMatch(/KEO/i);
  });
});
