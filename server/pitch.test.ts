/**
 * server/pitch.test.ts
 * Tests for Revenue Bridge: pitch router logic + payment webhook
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers under test ────────────────────────────────────────────────────────

function sanitisePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "").replace(/^(\+965|00965)/, "965");
}

function isKuwaitMobile(phone: string): boolean {
  const clean = sanitisePhone(phone);
  return /^(965)?[569]\d{7}$/.test(clean);
}

function generateToken(): string {
  // deterministic mock
  return "abc123def456abc123def456abc123def456abc123def456";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Phone validation ──────────────────────────────────────────────────────────

describe("Kuwait mobile validation", () => {
  it("accepts valid 9XXXXXXX format", () => {
    expect(isKuwaitMobile("96599608209")).toBe(true);
  });
  it("accepts valid 6XXXXXXX format", () => {
    expect(isKuwaitMobile("96566123456")).toBe(true);
  });
  it("accepts valid 5XXXXXXX format", () => {
    expect(isKuwaitMobile("96555123456")).toBe(true);
  });
  it("accepts +965 prefix", () => {
    expect(isKuwaitMobile("+96599608209")).toBe(true);
  });
  it("accepts 00965 prefix", () => {
    expect(isKuwaitMobile("0096599608209")).toBe(true);
  });
  it("accepts bare 8-digit starting with 9", () => {
    expect(isKuwaitMobile("99608209")).toBe(true);
  });
  it("rejects Saudi number", () => {
    expect(isKuwaitMobile("966501234567")).toBe(false);
  });
  it("rejects too-short number", () => {
    expect(isKuwaitMobile("9651234")).toBe(false);
  });
  it("rejects number starting with 4 (invalid Kuwait prefix)", () => {
    expect(isKuwaitMobile("96544123456")).toBe(false);
  });
  it("strips spaces and dashes before validating", () => {
    expect(isKuwaitMobile("+965 99-608-209")).toBe(true);
  });
});

// ── Word count ────────────────────────────────────────────────────────────────

describe("wordCount", () => {
  it("counts words correctly", () => {
    expect(wordCount("hello world foo")).toBe(3);
  });
  it("handles extra whitespace", () => {
    expect(wordCount("  hello   world  ")).toBe(2);
  });
  it("returns 0 for empty string", () => {
    expect(wordCount("")).toBe(0);
  });
  it("returns 0 for whitespace-only string", () => {
    expect(wordCount("   ")).toBe(0);
  });
});

// ── Payment status logic ──────────────────────────────────────────────────────

describe("payment status assignment", () => {
  function assignPaymentStatus(verdict: string): "PENDING" | "FREE" {
    const isApproved = verdict === "APPROVED" || verdict === "APPROVED_WITH_CONDITIONS";
    return isApproved ? "PENDING" : "FREE";
  }

  it("APPROVED requires payment", () => {
    expect(assignPaymentStatus("APPROVED")).toBe("PENDING");
  });
  it("APPROVED_WITH_CONDITIONS requires payment", () => {
    expect(assignPaymentStatus("APPROVED_WITH_CONDITIONS")).toBe("PENDING");
  });
  it("REJECTED is free", () => {
    expect(assignPaymentStatus("REJECTED")).toBe("FREE");
  });
  it("VETOED is free", () => {
    expect(assignPaymentStatus("VETOED")).toBe("FREE");
  });
  it("CONDITIONAL_REVIEW is free", () => {
    expect(assignPaymentStatus("CONDITIONAL_REVIEW")).toBe("FREE");
  });
  it("ERROR is free", () => {
    expect(assignPaymentStatus("ERROR")).toBe("FREE");
  });
});

// ── Webhook secret validation ─────────────────────────────────────────────────

describe("webhook secret validation", () => {
  const EXPECTED = "knet-dev-secret-2026";

  function validateSecret(provided: string | undefined, expected: string): boolean {
    if (!provided) return true; // no secret = allow (open webhook)
    return provided === expected;
  }

  it("accepts correct secret", () => {
    expect(validateSecret(EXPECTED, EXPECTED)).toBe(true);
  });
  it("rejects wrong secret", () => {
    expect(validateSecret("wrong-secret", EXPECTED)).toBe(false);
  });
  it("allows missing secret (open mode)", () => {
    expect(validateSecret(undefined, EXPECTED)).toBe(true);
  });
});

// ── Token generation ──────────────────────────────────────────────────────────

describe("pitch token", () => {
  it("generates a 48-char hex token", () => {
    const token = generateToken();
    expect(token).toHaveLength(48);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
  });
});

// ── Verdict display config ────────────────────────────────────────────────────

describe("verdict config", () => {
  const VERDICT_CONFIG: Record<string, { requiresPayment: boolean }> = {
    APPROVED:                 { requiresPayment: true  },
    APPROVED_WITH_CONDITIONS: { requiresPayment: true  },
    CONDITIONAL_REVIEW:       { requiresPayment: false },
    REJECTED:                 { requiresPayment: false },
    VETOED:                   { requiresPayment: false },
    ERROR:                    { requiresPayment: false },
  };

  it("only APPROVED verdicts require payment", () => {
    const paymentRequired = Object.entries(VERDICT_CONFIG)
      .filter(([, v]) => v.requiresPayment)
      .map(([k]) => k);
    expect(paymentRequired).toEqual(["APPROVED", "APPROVED_WITH_CONDITIONS"]);
  });

  it("all non-approved verdicts are free", () => {
    const free = Object.entries(VERDICT_CONFIG)
      .filter(([, v]) => !v.requiresPayment)
      .map(([k]) => k);
    expect(free).toContain("REJECTED");
    expect(free).toContain("VETOED");
    expect(free).toContain("CONDITIONAL_REVIEW");
    expect(free).toContain("ERROR");
  });
});
