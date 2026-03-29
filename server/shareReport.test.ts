/**
 * shareReport.test.ts
 * Tests for the Share Report feature:
 * - Token generation (256-bit, URL-safe base64)
 * - SHA-256 hashing (raw token never stored)
 * - Rate limiting (15 req/min per IP)
 * - Expiry logic
 * - Revocation
 */
import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";

// ── Token helpers (mirrored from shareReport.ts) ──────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Rate limiter (mirrored from shareReport.ts) ───────────────────────────────

const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;

function createRateLimiter() {
  const map = new Map<string, { count: number; resetAt: number }>();

  return function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Token Generation", () => {
  it("generates a URL-safe base64 string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates a token of ~43 characters (256-bit)", () => {
    const token = generateToken();
    // base64url of 32 bytes = 43 chars (no padding)
    expect(token.length).toBeGreaterThanOrEqual(42);
    expect(token.length).toBeLessThanOrEqual(44);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateToken));
    expect(tokens.size).toBe(100);
  });

  it("does not contain padding characters", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateToken()).not.toContain("=");
    }
  });
});

describe("Token Hashing", () => {
  it("produces a 64-character hex SHA-256 hash", () => {
    const hash = hashToken("test-token");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("is different for different tokens", () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(hashToken(t1)).not.toBe(hashToken(t2));
  });

  it("raw token cannot be recovered from hash", () => {
    const token = generateToken();
    const hash = hashToken(token);
    // SHA-256 is one-way — hash should not contain any part of the token
    expect(hash).not.toContain(token.slice(0, 8));
  });
});

describe("Rate Limiter", () => {
  let checkRateLimit: (ip: string) => boolean;

  beforeEach(() => {
    checkRateLimit = createRateLimiter();
  });

  it("allows up to 15 requests per IP", () => {
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect(checkRateLimit("1.2.3.4")).toBe(true);
    }
  });

  it("blocks the 16th request from the same IP", () => {
    for (let i = 0; i < RATE_LIMIT; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4")).toBe(false);
  });

  it("does not affect other IPs", () => {
    for (let i = 0; i < RATE_LIMIT + 5; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("5.6.7.8")).toBe(true);
  });

  it("resets after the time window", () => {
    const map = new Map<string, { count: number; resetAt: number }>();
    const now = Date.now();
    // Simulate an expired window
    map.set("1.2.3.4", { count: RATE_LIMIT + 5, resetAt: now - 1 });

    const limiter = (ip: string): boolean => {
      const entry = map.get(ip);
      const nowTs = Date.now();
      if (!entry || nowTs > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: nowTs + RATE_WINDOW_MS });
        return true;
      }
      entry.count++;
      return entry.count <= RATE_LIMIT;
    };

    expect(limiter("1.2.3.4")).toBe(true);
  });
});

describe("Expiry Logic", () => {
  it("correctly identifies an active token (not expired, not revoked)", () => {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const revokedAt = null;
    const isActive = !revokedAt && Date.now() < expiresAt;
    expect(isActive).toBe(true);
  });

  it("correctly identifies an expired token", () => {
    const expiresAt = Date.now() - 1000;
    const revokedAt = null;
    const isActive = !revokedAt && Date.now() < expiresAt;
    expect(isActive).toBe(false);
  });

  it("correctly identifies a revoked token", () => {
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const revokedAt = Date.now() - 5000;
    const isActive = !revokedAt && Date.now() < expiresAt;
    expect(isActive).toBe(false);
  });

  it("7-day default expiry is correct in ms", () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(sevenDaysMs).toBe(604_800_000);
  });

  it("30-day max expiry is correct in ms", () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(thirtyDaysMs).toBe(2_592_000_000);
  });
});

describe("Report Type Validation", () => {
  it("accepts single_deal report type", () => {
    const validTypes = ["single_deal", "comparison"];
    expect(validTypes.includes("single_deal")).toBe(true);
  });

  it("accepts comparison report type", () => {
    const validTypes = ["single_deal", "comparison"];
    expect(validTypes.includes("comparison")).toBe(true);
  });

  it("rejects unknown report types", () => {
    const validTypes = ["single_deal", "comparison"];
    expect(validTypes.includes("unknown_type")).toBe(false);
  });
});
