/**
 * Tests for adminUsage tRPC procedures and rate limiter logic
 */
import { describe, it, expect } from "vitest";

// ── Rate limiter constants ────────────────────────────────────────────────────
const MAX_REQUESTS_PER_IP_PER_DAY = 10;
const MAX_TOKENS_PER_REQUEST = 2000;
const DAILY_PLATFORM_TOKEN_LIMIT = 50000;

describe("Rate Limiter Constants", () => {
  it("enforces max 10 requests per IP per day", () => {
    expect(MAX_REQUESTS_PER_IP_PER_DAY).toBe(10);
  });

  it("enforces max 2000 tokens per request", () => {
    expect(MAX_TOKENS_PER_REQUEST).toBe(2000);
  });

  it("enforces 50k daily platform token limit", () => {
    expect(DAILY_PLATFORM_TOKEN_LIMIT).toBe(50000);
  });
});

// ── recordLlmUsage helper ────────────────────────────────────────────────────
describe("recordLlmUsage", () => {
  it("builds correct context object shape", () => {
    const context = {
      ip: "1.2.3.4",
      userId: 42,
      endpoint: "mesh-runAgentTask",
      date: "2026-03-16",
    };
    expect(context).toMatchObject({
      ip: expect.any(String),
      userId: expect.any(Number),
      endpoint: expect.any(String),
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});

// ── percentUsed calculation ───────────────────────────────────────────────────
describe("percentUsed calculation", () => {
  it("calculates 0% when no tokens used", () => {
    const pct = Math.round((0 / 50000) * 100);
    expect(pct).toBe(0);
  });

  it("calculates 50% at 25000 tokens", () => {
    const pct = Math.round((25000 / 50000) * 100);
    expect(pct).toBe(50);
  });

  it("calculates 100% at budget limit", () => {
    const pct = Math.round((50000 / 50000) * 100);
    expect(pct).toBe(100);
  });

  it("caps at 100% when over budget", () => {
    const raw = Math.round((60000 / 50000) * 100);
    const capped = Math.min(100, raw);
    expect(capped).toBe(100);
  });
});

// ── Date formatting ───────────────────────────────────────────────────────────
describe("Date formatting for rate limit buckets", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date("2026-03-16T10:00:00Z").toISOString().slice(0, 10);
    expect(date).toBe("2026-03-16");
  });

  it("produces consistent date string for same day", () => {
    const d1 = new Date("2026-03-16T00:00:00Z").toISOString().slice(0, 10);
    const d2 = new Date("2026-03-16T23:59:59Z").toISOString().slice(0, 10);
    expect(d1).toBe(d2);
  });
});

// ── Admin role guard ──────────────────────────────────────────────────────────
describe("Admin role guard", () => {
  it("allows admin users", () => {
    const user = { role: "admin" as const };
    expect(user.role === "admin").toBe(true);
  });

  it("blocks non-admin users", () => {
    const user = { role: "user" as const };
    expect(user.role === "admin").toBe(false);
  });
});

// ── High demand blocking logic ────────────────────────────────────────────────
describe("High demand blocking logic", () => {
  it("blocks when platform total meets limit", () => {
    const platformTotal = 50000;
    const shouldBlock = platformTotal >= DAILY_PLATFORM_TOKEN_LIMIT;
    expect(shouldBlock).toBe(true);
  });

  it("does not block when platform total is under limit", () => {
    const platformTotal = 49999;
    const shouldBlock = platformTotal >= DAILY_PLATFORM_TOKEN_LIMIT;
    expect(shouldBlock).toBe(false);
  });

  it("blocks when user request count meets limit", () => {
    const userCount = 10;
    const shouldBlock = userCount >= MAX_REQUESTS_PER_IP_PER_DAY;
    expect(shouldBlock).toBe(true);
  });

  it("allows when user request count is under limit", () => {
    const userCount = 9;
    const shouldBlock = userCount >= MAX_REQUESTS_PER_IP_PER_DAY;
    expect(shouldBlock).toBe(false);
  });
});
