/**
 * server/decisionUpgradeSchema.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for AppliedFixSchema Zod validation.
 *
 * Coverage:
 *   - exampleValue null/undefined/empty/valid transforms
 *   - userEdited null/undefined/valid transforms
 *   - fieldPath null/undefined/valid transforms
 *   - Full payload with all nullish fields
 *   - Invalid types for required fields (rejection)
 *   - Array/object coercion behavior for optional fields
 *   - Mixed array parsing
 *   - Missing required fields
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Replicate the exact schema from decisionUpgrade.ts ──────────────────────

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

// ─── Part 2a: exampleValue null handling ──────────────────────────────────────

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
    expect(() => AppliedFixSchema.parse({ ...validFix, exampleValue: 123 })).toThrow();
  });

  it("rejects exampleValue: true (boolean) — must be string or null", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, exampleValue: true })).toThrow();
  });

  it("rejects exampleValue: {} (plain object) — must be string or null", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, exampleValue: {} })).toThrow();
  });

  it("rejects exampleValue: [] (array) — must be string or null", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, exampleValue: [] })).toThrow();
  });
});

// ─── Part 2b: userEdited null handling ───────────────────────────────────────

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

  it("rejects userEdited: 42 (number) — must be string or null", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, userEdited: 42 })).toThrow();
  });

  it("rejects userEdited: [] (array) — must be string or null", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, userEdited: [] })).toThrow();
  });
});

// ─── Part 2c: fieldPath null handling ────────────────────────────────────────

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

// ─── Part 2d: required field rejection ───────────────────────────────────────

describe("AppliedFixSchema — required field rejection", () => {
  it("rejects when id is missing", () => {
    const { id: _id, ...noId } = validFix;
    expect(() => AppliedFixSchema.parse(noId)).toThrow();
  });

  it("rejects when title is missing", () => {
    const { title: _t, ...noTitle } = validFix;
    expect(() => AppliedFixSchema.parse(noTitle)).toThrow();
  });

  it("rejects when description is missing", () => {
    const { description: _d, ...noDesc } = validFix;
    expect(() => AppliedFixSchema.parse(noDesc)).toThrow();
  });

  it("rejects when suggestion is missing", () => {
    const { suggestion: _s, ...noSug } = validFix;
    expect(() => AppliedFixSchema.parse(noSug)).toThrow();
  });

  it("rejects when applied is missing", () => {
    const { applied: _a, ...noApplied } = validFix;
    expect(() => AppliedFixSchema.parse(noApplied)).toThrow();
  });

  it("rejects when category is an invalid enum value", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, category: "invalid_category" })).toThrow();
  });

  it("rejects when tag is an invalid enum value", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, tag: "WRONG_TAG" })).toThrow();
  });

  it("rejects when applied is a string instead of boolean", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, applied: "yes" })).toThrow();
  });

  it("rejects when id is a number instead of string", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, id: 123 })).toThrow();
  });

  it("rejects when title is an array instead of string", () => {
    expect(() => AppliedFixSchema.parse({ ...validFix, title: ["Add", "CAC"] })).toThrow();
  });
});

// ─── Part 2e: full payload with all nullish fields ────────────────────────────

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

  it("parses all valid tag variants correctly", () => {
    const tags = ["ASSUMED", "IMPROVED", "USER_REQUIRED"] as const;
    tags.forEach(tag => {
      const result = AppliedFixSchema.parse({ ...validFix, tag });
      expect(result.tag).toBe(tag);
    });
  });

  it("parses all valid category variants correctly", () => {
    const categories = [
      "missing_input",
      "performance_gap",
      "structural_issue",
      "narrative",
      "risk_mitigation",
    ] as const;
    categories.forEach(category => {
      const result = AppliedFixSchema.parse({ ...validFix, category });
      expect(result.category).toBe(category);
    });
  });
});

// ─── Part 2f: real-world LLM payload simulation ───────────────────────────────

describe("AppliedFixSchema — real-world LLM payload simulation", () => {
  it("parses a realistic LLM-emitted payload with null optional fields", () => {
    // Exactly what the LLM emits before the fix was applied
    const llmPayload = {
      id: "fix_007",
      category: "missing_input",
      title: "Add CAC/LTV Unit Economics",
      description: "Unit economics are missing from the submission",
      suggestion: "Provide CAC: $120, LTV: $600, ratio 1:5",
      tag: "ASSUMED",
      fieldPath: null,
      exampleValue: null,
      applied: true,
      userEdited: null,
    };
    const result = AppliedFixSchema.parse(llmPayload);
    expect(result.id).toBe("fix_007");
    expect(result.exampleValue).toBe("");
    expect(result.fieldPath).toBeUndefined();
    expect(result.userEdited).toBeUndefined();
    expect(result.applied).toBe(true);
  });

  it("parses a batch of 10 LLM-emitted fixes where all optional fields are null", () => {
    const batch = Array.from({ length: 10 }, (_, i) => ({
      id: `fix_${String(i + 1).padStart(3, "0")}`,
      category: "missing_input" as const,
      title: `Fix ${i + 1}`,
      description: `Description ${i + 1}`,
      suggestion: `Suggestion ${i + 1}`,
      tag: "USER_REQUIRED" as const,
      fieldPath: null,
      exampleValue: null,
      applied: true,
      userEdited: null,
    }));
    const parsed = batch.map(f => AppliedFixSchema.parse(f));
    expect(parsed).toHaveLength(10);
    parsed.forEach(p => {
      expect(p.exampleValue).toBe("");
      expect(p.fieldPath).toBeUndefined();
      expect(p.userEdited).toBeUndefined();
    });
  });
});
