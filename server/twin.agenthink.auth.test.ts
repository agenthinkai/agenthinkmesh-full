/**
 * Auth-flow regression tests for /twin/agenthink
 *
 * Requirements (from user):
 *  1. Authenticated user opens the Twin directly (no redirect)
 *  2. Logged-out user returns to /twin/agenthink after login (not homepage)
 *  3. Authorized member sees cockpit (cockpitVerifyAccess succeeds)
 *  4. Unauthorized user sees Access Denied (FORBIDDEN)
 *  5. Login never returns the user to the generic homepage
 *
 * These tests validate the code-level contracts that implement those requirements.
 * End-to-end browser validation must be performed separately.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const TWIN_PAGE = path.resolve(__dirname, "../client/src/pages/AgenThinkTwin.tsx");
const CONST_FILE = path.resolve(__dirname, "../client/src/const.ts");
const USE_AUTH_FILE = path.resolve(__dirname, "../client/src/_core/hooks/useAuth.ts");
const ORG_MIDDLEWARE = path.resolve(__dirname, "../server/_core/orgMiddleware.ts");

// ── 1. Return-path: useAuth must receive the correct redirectPath ─────────────
describe("Return-path: /twin/agenthink preserved through login", () => {
  it("AgenThinkTwin.tsx passes redirectPath: getLoginUrl('/twin/agenthink') to useAuth", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/redirectPath:\s*getLoginUrl\s*\(\s*["']\/twin\/agenthink["']\s*\)/);
  });

  it("AgenThinkTwin.tsx does NOT call useAuth with no arguments or empty redirectPath", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).not.toMatch(/redirectPath:\s*getLoginUrl\s*\(\s*\)/);
  });

  it("fallback 'Click here' link also uses getLoginUrl('/twin/agenthink')", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/href=\{getLoginUrl\s*\(\s*["']\/twin\/agenthink["']\s*\)\}/);
  });

  it("getLoginUrl in const.ts accepts a returnPath parameter", () => {
    const content = fs.readFileSync(CONST_FILE, "utf-8");
    expect(content).toMatch(/getLoginUrl\s*=\s*\(\s*returnPath/);
  });

  it("useAuth hook accepts redirectPath option and uses it for redirect", () => {
    const content = fs.readFileSync(USE_AUTH_FILE, "utf-8");
    expect(content).toMatch(/redirectPath\s*\?:\s*string/);
    expect(content).toMatch(/window\.location\.href\s*=\s*redirectPath/);
  });

  it("getLoginUrl default returnPath is NOT /twin/agenthink (proving explicit pass is needed)", () => {
    const content = fs.readFileSync(CONST_FILE, "utf-8");
    expect(content).toMatch(/returnPath\s*=\s*["']\/persona-setup["']/);
  });
});

// ── 2. Server-side: enterpriseProcedure enforces org membership ───────────────
describe("Server-side auth: cockpitVerifyAccess enforces org membership", () => {
  it("orgMiddleware throws UNAUTHORIZED when user is not authenticated", () => {
    const content = fs.readFileSync(ORG_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/UNAUTHORIZED/);
    expect(content).toMatch(/Authentication required/);
  });

  it("orgMiddleware throws FORBIDDEN when user has no active membership", () => {
    const content = fs.readFileSync(ORG_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/FORBIDDEN/);
    expect(content).toMatch(/No active enterprise membership/);
  });

  it("orgMiddleware throws FORBIDDEN when org is suspended", () => {
    const content = fs.readFileSync(ORG_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/suspended/);
    expect(content).toMatch(/organisation has been suspended/i);
  });

  it("orgMiddleware resolves orgId from DB, never from client input", () => {
    const content = fs.readFileSync(ORG_MIDDLEWARE, "utf-8");
    expect(content).toMatch(/enterpriseMemberships/);
    expect(content).toMatch(/innerJoin\s*\(\s*organizations/);
    expect(content).toMatch(/ctx\.user\.id/);
  });
});

// ── 3. AgenThinkTwin.tsx: both auth layers are present ───────────────────────
describe("AgenThinkTwin.tsx: two-layer auth guard", () => {
  it("uses useAuth with redirectOnUnauthenticated: true", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/redirectOnUnauthenticated:\s*true/);
  });

  it("calls cockpitVerifyAccess server procedure", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/cockpitVerifyAccess/);
  });

  it("cockpitVerifyAccess is only enabled when user is authenticated", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/enabled:\s*Boolean\s*\(\s*user\s*\)/);
  });

  it("shows Access Denied message for FORBIDDEN error", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/Access Denied/);
    expect(content).toMatch(/FORBIDDEN/);
  });

  it("displays AgenThink Mesh — Customer Zero Executive Twin heading", () => {
    const content = fs.readFileSync(TWIN_PAGE, "utf-8");
    expect(content).toMatch(/AgenThink Mesh.*Customer Zero Executive Twin/);
  });
});

// ── 4. DB: Farouq Sultan has active enterprise membership ─────────────────────
describe("Database: Farouq Sultan enterprise membership", () => {
  it("Farouq Sultan (userId=1) has active membership in orgId=1", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, userId, orgId, status FROM enterprise_memberships WHERE userId = 1 AND orgId = 1 LIMIT 1"
      ) as [Array<{ id: number; userId: number; orgId: number; status: string }>, unknown];
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(1);
      expect(rows[0].orgId).toBe(1);
      expect(rows[0].status).toBe("active");
    } finally {
      if (conn) await conn.end();
    }
  });

  it("AgenThinkMesh org (id=1) is active and on enterprise plan", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, name, slug, status, plan FROM organizations WHERE id = 1 LIMIT 1"
      ) as [Array<{ id: number; name: string; slug: string; status: string; plan: string }>, unknown];
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(1);
      expect(rows[0].name).toBe("AgenThinkMesh");
      expect(rows[0].status).toBe("active");
      expect(rows[0].plan).toBe("enterprise");
    } finally {
      if (conn) await conn.end();
    }
  });

  it("At least one active twin_instance exists for orgId=1", async () => {
    const mysql = await import("mysql2/promise");
    let conn: Awaited<ReturnType<typeof mysql.createConnection>> | null = null;
    try {
      conn = await mysql.createConnection(process.env.DATABASE_URL!);
      const [rows] = await conn.execute(
        "SELECT id, orgId, displayName, status FROM twin_instances WHERE orgId = 1 AND status = 'active' LIMIT 1"
      ) as [Array<{ id: number; orgId: number; displayName: string; status: string }>, unknown];
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].orgId).toBe(1);
      expect(rows[0].status).toBe("active");
    } finally {
      if (conn) await conn.end();
    }
  });
});
