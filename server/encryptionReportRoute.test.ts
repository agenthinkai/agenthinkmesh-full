/**
 * encryptionReportRoute.test.ts
 *
 * Integration tests for GET /api/admin/encryption-report.
 * Mocks sdk.authenticateRequest and getDb — no real DB calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock variables so they are available inside vi.mock factories ────────
const { mockAuth, mockSelect } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockAuth = vi.fn();
  return { mockAuth, mockSelect };
});

// ── Mock SDK auth ─────────────────────────────────────────────────────────────
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: mockAuth,
  },
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: mockSelect,
  }),
}));

import { sdk } from "./_core/sdk";
import express from "express";
import request from "supertest";
import { registerEncryptionReportRoute } from "./encryptionReportRoute";

// Coverage rows returned for each table query (total=100, encrypted=100 → 100%)
const MOCK_COVERAGE_ROW = [{ total: 100, encrypted: 100 }];

function buildApp() {
  const app = express();
  app.use(express.json());
  registerEncryptionReportRoute(app);
  return app;
}

const ADMIN_USER = {
  id: 1,
  openId: "admin-open-id",
  email: "admin@example.com",
  name: "Admin User",
  role: "admin" as const,
  createdAt: new Date(),
};

const REGULAR_USER = {
  id: 99,
  openId: "user-open-id",
  email: "user@example.com",
  name: "Regular User",
  role: "user" as const,
  createdAt: new Date(),
};

describe("GET /api/admin/encryption-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Each db.select() chain resolves to a full-coverage row
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(MOCK_COVERAGE_ROW),
      }),
    });
  });

  it("returns 403 for non-admin authenticated user", async () => {
    mockAuth.mockResolvedValueOnce(REGULAR_USER);

    const app = buildApp();
    const res = await request(app).get("/api/admin/encryption-report");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  it("returns 200 with correct response shape for admin user", async () => {
    mockAuth.mockResolvedValueOnce(ADMIN_USER);

    const app = buildApp();
    const res = await request(app).get("/api/admin/encryption-report");

    expect(res.status).toBe(200);

    // overall shape
    expect(res.body.overall).toBeDefined();
    expect(typeof res.body.overall.coverage).toBe("number");
    expect(typeof res.body.overall.total).toBe("number");
    expect(typeof res.body.overall.encrypted).toBe("number");

    // tables array has exactly 3 entries
    expect(Array.isArray(res.body.tables)).toBe(true);
    expect(res.body.tables.length).toBe(3);

    // all three tables present
    const tableNames = res.body.tables.map((t: { table: string }) => t.table);
    expect(tableNames).toContain("pitch_triages");
    expect(tableNames).toContain("founder_agent_evaluations");
    expect(tableNames).toContain("founder_agent_insights");

    // lastUpdated present
    expect(typeof res.body.lastUpdated).toBe("number");
  });

  it("each table entry has required fields: table, total, encrypted, coverage, fields", async () => {
    mockAuth.mockResolvedValueOnce(ADMIN_USER);

    const app = buildApp();
    const res = await request(app).get("/api/admin/encryption-report");

    expect(res.status).toBe(200);
    for (const entry of res.body.tables) {
      expect(typeof entry.table).toBe("string");
      expect(typeof entry.total).toBe("number");
      expect(typeof entry.encrypted).toBe("number");
      expect(typeof entry.coverage).toBe("number");
      expect(Array.isArray(entry.fields)).toBe(true);
      expect(entry.fields.length).toBeGreaterThan(0);
    }
  });

  it("overall.coverage is a number between 0 and 100", async () => {
    mockAuth.mockResolvedValueOnce(ADMIN_USER);

    const app = buildApp();
    const res = await request(app).get("/api/admin/encryption-report");

    expect(res.status).toBe(200);
    expect(res.body.overall.coverage).toBeGreaterThanOrEqual(0);
    expect(res.body.overall.coverage).toBeLessThanOrEqual(100);
  });
});
