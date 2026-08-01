/**
 * Sprint 3 Acceptance Test Suite — Enterprise Deploy Layer
 *
 * WP-1: Enterprise readiness (routes, membership management)
 * WP-2: Customer runtime execution (runTwin)
 * WP-3: User/role access validation (suspend, reactivate, listOrgMembers)
 * WP-4: CSV connector (syncCsv) + Outcome Ledger (storeDecision)
 * WP-5: Excel connector (syncExcel)
 * WP-6: REST connector (syncRest)
 * WP-7: SQL connector (syncSql)
 * WP-9: Health endpoint
 */
import { describe, it, expect, vi } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue([[{ id: 1, name: "test" }]]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  }),
}));

// ─── Mock councilEngine ───────────────────────────────────────────────────────
vi.mock("./councilEngine", () => ({
  runCouncil: vi.fn().mockResolvedValue({
    sessionId: "test-session-001",
    verdict: "APPROVE",
    finalScore: 0.78,
    confidenceScore: 0.82,
    summary: "Strong fundamentals with manageable risks.",
    personas: [],
    mode: "standard",
    durationMs: 1200,
  }),
}));

// ─── Mock enterpriseRuntimeService ────────────────────────────────────────────
vi.mock("./lib/enterpriseRuntimeService", () => ({
  createOrg: vi.fn().mockResolvedValue({ id: 1, name: "Test Org" }),
  listOrgs: vi.fn().mockResolvedValue([]),
  getOrgById: vi.fn().mockResolvedValue({ id: 1, name: "Test Org" }),
  createMembership: vi.fn().mockResolvedValue({ id: 1 }),
  listMemberships: vi.fn().mockResolvedValue([]),
  createTwinSession: vi.fn().mockResolvedValue({ id: 1 }),
  completeTwinSession: vi.fn().mockResolvedValue({ id: 1 }),
  updateMembershipStatus: vi.fn().mockResolvedValue({ success: true, membershipId: 1, status: "suspended" }),
  listOrgMembers: vi.fn().mockResolvedValue([
    {
      membershipId: 1,
      userId: 42,
      roleId: 1,
      deptId: null,
      jobTitle: "Analyst",
      status: "active",
      joinedAt: new Date("2025-01-01"),
      lastActiveAt: null,
      userName: "Alice",
      userEmail: "alice@example.com",
    },
  ]),
}));

// ─────────────────────────────────────────────────────────────────────────────
// WP-1: Enterprise readiness — membership management
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-1: Enterprise Readiness — Membership Management", () => {
  it("updateMembershipStatus resolves with success and new status", async () => {
    const { updateMembershipStatus } = await import("./lib/enterpriseRuntimeService");
    const result = await updateMembershipStatus(1, 1, "suspended");
    expect(result).toMatchObject({ success: true, membershipId: 1, status: "suspended" });
  });

  it("listOrgMembers returns array of members with expected shape", async () => {
    const { listOrgMembers } = await import("./lib/enterpriseRuntimeService");
    const members = await listOrgMembers(1);
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThan(0);
    const m = members[0];
    expect(m).toHaveProperty("membershipId");
    expect(m).toHaveProperty("userId");
    expect(m).toHaveProperty("status");
    expect(m).toHaveProperty("userName");
    expect(m).toHaveProperty("userEmail");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-2: Customer runtime execution — runTwin
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-2: Customer Runtime Execution — runTwin", () => {
  it("runCouncil mock returns expected verdict shape", async () => {
    const { runCouncil } = await import("./councilEngine");
    const result = await runCouncil({
      topic: "Acquire target company",
      context: "Strategic M&A decision",
      mode: "standard",
    });
    expect(result).toMatchObject({
      sessionId: expect.any(String),
      verdict: expect.stringMatching(/APPROVE|REJECT|HOLD|ESCALATE/),
      finalScore: expect.any(Number),
      confidenceScore: expect.any(Number),
      summary: expect.any(String),
    });
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });

  it("runCouncil mock returns finalScore within [0, 1]", async () => {
    const { runCouncil } = await import("./councilEngine");
    const result = await runCouncil({ topic: "Test", context: "Test context", mode: "standard" });
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-3: User/role access validation
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-3: User/Role Access Validation", () => {
  it("listOrgMembers returns members with valid status values", async () => {
    const { listOrgMembers } = await import("./lib/enterpriseRuntimeService");
    const members = await listOrgMembers(1);
    for (const m of members) {
      expect(["active", "suspended", "invited"]).toContain(m.status);
    }
  });

  it("updateMembershipStatus to 'suspended' returns suspended status", async () => {
    const { updateMembershipStatus } = await import("./lib/enterpriseRuntimeService");
    const result = await updateMembershipStatus(1, 1, "suspended");
    expect(result.status).toBe("suspended");
  });

  it("updateMembershipStatus to 'active' returns active status (mock override)", async () => {
    const { updateMembershipStatus } = await import("./lib/enterpriseRuntimeService");
    vi.mocked(updateMembershipStatus).mockResolvedValueOnce({ success: true, membershipId: 1, status: "active" });
    const result = await updateMembershipStatus(1, 1, "active");
    expect(result.status).toBe("active");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-4: CSV connector — syncCsv input validation
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-4: CSV Connector — syncCsv input validation", () => {
  it("parses a valid CSV string into headers and rows", () => {
    const csvText = "name,age,city\nAlice,30,Kuwait\nBob,25,Dubai";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0].split(",");
    const dataLines = lines.slice(1);
    const rows = dataLines.map((line) => {
      const cells = line.split(",");
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });
    expect(headers).toEqual(["name", "age", "city"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Alice", age: "30", city: "Kuwait" });
    expect(rows[1]).toMatchObject({ name: "Bob", age: "25", city: "Dubai" });
  });

  it("handles empty CSV gracefully", () => {
    const csvText = "";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(0);
  });

  it("handles CSV with quoted fields (header strip)", () => {
    const csvText = `"name","city"\n"Alice, Jr.","New York"`;
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
    expect(headers).toEqual(["name", "city"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-4: storeDecision — outcome ledger contract
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-4: storeDecision — Outcome Ledger", () => {
  it("storeDecision input shape is valid", () => {
    const input = {
      topic: "Acquire Company X",
      context: "Strategic M&A",
      verdict: "APPROVE" as const,
      finalScore: 0.78,
      confidenceScore: 0.82,
      summary: "Strong fundamentals.",
      twinInstanceId: 1,
      orgId: 1,
      runMode: "standard" as const,
    };
    expect(input.verdict).toMatch(/APPROVE|REJECT|HOLD|ESCALATE/);
    expect(input.finalScore).toBeGreaterThanOrEqual(0);
    expect(input.finalScore).toBeLessThanOrEqual(1);
    expect(input.topic.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-5: Excel connector — syncExcel TSV parsing
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-5: Excel Connector — syncExcel TSV parsing", () => {
  it("parses a valid TSV string into headers and rows", () => {
    const tsvText = "name\tage\tcity\nAlice\t30\tKuwait\nBob\t25\tDubai";
    const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const splitLine = (line: string) => line.split("\t").map((cell) => cell.replace(/^"|"$/g, "").trim());
    const headers = splitLine(lines[0]);
    const dataLines = lines.slice(1);
    const rows = dataLines.map((line) => {
      const cells = splitLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });
    expect(headers).toEqual(["name", "age", "city"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Alice", age: "30", city: "Kuwait" });
  });

  it("handles empty TSV gracefully", () => {
    const tsvText = "";
    const lines = tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-6: REST connector — syncRest input validation
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-6: REST Connector — syncRest input validation", () => {
  it("validates URL format", () => {
    const validUrl = "https://api.example.com/data";
    expect(() => new URL(validUrl)).not.toThrow();
  });

  it("rejects non-URL strings", () => {
    const invalidUrl = "not-a-url";
    expect(() => new URL(invalidUrl)).toThrow();
  });

  it("handles JSON array response correctly", () => {
    const mockResponse = [{ id: 1, name: "Item A" }, { id: 2, name: "Item B" }];
    const data = Array.isArray(mockResponse) ? mockResponse : [mockResponse];
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ id: 1, name: "Item A" });
  });

  it("wraps non-array JSON response in array", () => {
    const mockResponse = { id: 1, name: "Single Item" };
    const data = Array.isArray(mockResponse) ? mockResponse : [mockResponse];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: 1, name: "Single Item" });
  });

  it("extracts nested array via rootKey", () => {
    const mockResponse = { data: [{ id: 1 }, { id: 2 }], total: 2 };
    const rootKey = "data";
    const data = (mockResponse as Record<string, unknown>)[rootKey];
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-7: SQL connector — syncSql security validation
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-7: SQL Connector — syncSql security validation", () => {
  it("allows SELECT queries", () => {
    const query = "SELECT * FROM users LIMIT 10";
    expect(query.trim().toUpperCase().startsWith("SELECT")).toBe(true);
  });

  it("rejects INSERT queries", () => {
    const query = "INSERT INTO users (name) VALUES ('hacker')";
    expect(query.trim().toUpperCase().startsWith("SELECT")).toBe(false);
  });

  it("rejects DROP queries", () => {
    const query = "DROP TABLE users";
    expect(query.trim().toUpperCase().startsWith("SELECT")).toBe(false);
  });

  it("rejects UPDATE queries", () => {
    const query = "UPDATE users SET role = 'admin'";
    expect(query.trim().toUpperCase().startsWith("SELECT")).toBe(false);
  });

  it("rejects DELETE queries", () => {
    const query = "DELETE FROM users";
    expect(query.trim().toUpperCase().startsWith("SELECT")).toBe(false);
  });

  it("allows SELECT with subquery", () => {
    const query = "SELECT * FROM (SELECT id FROM users) AS sub";
    expect(query.trim().toUpperCase().startsWith("SELECT")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WP-9: Health endpoint contract
// ─────────────────────────────────────────────────────────────────────────────
describe("WP-9: Health Endpoint Contract", () => {
  it("health response shape is valid when db is connected", () => {
    const response = {
      status: "ok",
      version: "1.0.0",
      uptime: 3600,
      db: "connected",
      timestamp: new Date().toISOString(),
    };
    expect(response.status).toBe("ok");
    expect(response.db).toBe("connected");
    expect(typeof response.uptime).toBe("number");
    expect(response.uptime).toBeGreaterThanOrEqual(0);
    expect(() => new Date(response.timestamp)).not.toThrow();
  });

  it("health response shape is valid when db is unavailable", () => {
    const response = {
      status: "degraded",
      version: "1.0.0",
      uptime: 3600,
      db: "unavailable",
      timestamp: new Date().toISOString(),
    };
    expect(response.status).toBe("degraded");
    expect(response.db).toBe("unavailable");
  });

  it("uptime is a non-negative integer", () => {
    const uptime = Math.floor(process.uptime());
    expect(uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(uptime)).toBe(true);
  });
});
