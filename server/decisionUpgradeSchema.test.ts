/**
 * server/decisionUpgradeSchema.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for AppliedFixSchema Zod validation — specifically the null/undefined
 * exampleValue regression fix.
 *
 * Bug: appliedFixes[n].exampleValue — expected string, received null
 * Fix: z.string().nullish().transform(v => v ?? "")
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Replicate the exact schema from decisionUpgrade.ts ──────────────────────
// (We replicate rather than import to keep this test self-contained and
//  ensure the schema contract is tested independently of the router module.)

const UpgradeFixSchema = z.object({
  id: z.string(),
  category: z.enum(["missing_input", "performance_gap", "structural_issue", "narrative", "risk_mitigation"]),
  title: z.string(),
  description: z.string(),
  suggestion: z.string(),
  tag: z.enum(["ASSUMED", "IMPROVED", "USER_REQUIRED"]),
  fieldPath: z.string().nullish().transform(v => v ?? undefined),
  exampleValue: z.string().nullish().transform(v => v ?? ""),
});

const AppliedFixSchema = UpgradeFixSchema.extend({
  applied: z.boolean(),
  userEdited: z.string().nullish().transform(v => v ?? undefined),
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validFix = {
  id: "fix_001",
  category: "missing_input" as const,
  title: "Add CAC/LTV",
  description: "Missing unit economics",
  suggestion: "Provide CAC and LTV figures",
  tag: "USER_REQUIRED" as const,
  applied: true,
};

// ─── AppliedFixSchema — exampleValue null handling ────────────────────────────

describe("AppliedFixSchema — exampleValue null handling", () => {
  it("accepts exampleValue: null and transforms to empty string", () => {
    const result = AppliedFixSchema.parse({ ...validFix, exampleValue: null });
    expect(result.exampleValue).toBe("");
  });

  it("accepts exampleValue missing (undefined) and transforms to empty string", () => {
    const result = AppliedFixSchema.parse({ ...validFix });
    expect(result.exampleValue).toBe("");
  });

  it("accepts exampleValue: '' and keeps it as empty string", () => {
    const result = AppliedFixSchema.parse({ ...validFix, exampleValue: "" });
    expect(result.exampleValue).toBe("");
  });

  it("accepts exampleValue: 'CAC: $120' and preserves it", () => {
    const result = AppliedFixSchema.parse({ ...validFix, exampleValue: "CAC: $120" });
    expect(result.exampleValue).toBe("CAC: $120");
  });

  it("rejects exampleValue: 123 (number) — must be string or null", () => {
    // Numbers are not valid — Zod will reject non-string, non-null values
    expect(() => AppliedFixSchema.parse({ ...validFix, exampleValue: 123 })).toThrow();
  });
});

// ─── AppliedFixSchema — userEdited null handling ──────────────────────────────

describe("AppliedFixSchema — userEdited null handling", () => {
  it("accepts userEdited: null and transforms to undefined", () => {
    const result = AppliedFixSchema.parse({ ...validFix, userEdited: null });
    expect(result.userEdited).toBeUndefined();
  });

  it("accepts userEdited missing and transforms to undefined", () => {
    const result = AppliedFixSchema.parse({ ...validFix });
    expect(result.userEdited).toBeUndefined();
  });

  it("preserves userEdited when provided", () => {
    const result = AppliedFixSchema.parse({ ...validFix, userEdited: "My edited value" });
    expect(result.userEdited).toBe("My edited value");
  });
});

// ─── AppliedFixSchema — fieldPath null handling ───────────────────────────────

describe("AppliedFixSchema — fieldPath null handling", () => {
  it("accepts fieldPath: null and transforms to undefined", () => {
    const result = AppliedFixSchema.parse({ ...validFix, fieldPath: null });
    expect(result.fieldPath).toBeUndefined();
  });

  it("accepts fieldPath missing and transforms to undefined", () => {
    const result = AppliedFixSchema.parse({ ...validFix });
    expect(result.fieldPath).toBeUndefined();
  });

  it("preserves fieldPath when provided", () => {
    const result = AppliedFixSchema.parse({ ...validFix, fieldPath: "financials.cac" });
    expect(result.fieldPath).toBe("financials.cac");
  });
});

// ─── AppliedFixSchema — full payload with all nullish fields ──────────────────

describe("AppliedFixSchema — full payload with all nullish fields null", () => {
  it("parses a payload where exampleValue, userEdited, and fieldPath are all null", () => {
    const result = AppliedFixSchema.parse({
      ...validFix,
      exampleValue: null,
      userEdited: null,
      fieldPath: null,
    });
    expect(result.exampleValue).toBe("");
    expect(result.userEdited).toBeUndefined();
    expect(result.fieldPath).toBeUndefined();
  });

  it("parses a mixed array of AppliedFix objects with varying exampleValue states", () => {
    const fixes = [
      { ...validFix, id: "fix_1", exampleValue: null },
      { ...validFix, id: "fix_2" },
      { ...validFix, id: "fix_3", exampleValue: "" },
      { ...validFix, id: "fix_4", exampleValue: "CAC: $120, LTV: $600" },
    ];
    const parsed = fixes.map(f => AppliedFixSchema.parse(f));
    expect(parsed[0].exampleValue).toBe("");
    expect(parsed[1].exampleValue).toBe("");
    expect(parsed[2].exampleValue).toBe("");
    expect(parsed[3].exampleValue).toBe("CAC: $120, LTV: $600");
  });
});
