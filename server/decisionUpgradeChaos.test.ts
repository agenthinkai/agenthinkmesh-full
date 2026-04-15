/**
 * server/decisionUpgradeChaos.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 4: Chaos stress test — sanitizeFix resilience under adversarial input.
 *
 * Generates 50 random malformed fix objects covering:
 *   - null fields
 *   - undefined fields
 *   - wrong types (numbers, booleans, arrays, objects, Date)
 *   - deeply nested objects
 *   - empty objects
 *   - invalid enum values
 *   - extremely long strings
 *   - special characters / injection attempts
 *
 * Invariants verified for EVERY output:
 *   ✓ No crash (sanitizeFix never throws)
 *   ✓ exampleValue is always a string
 *   ✓ fieldPath is always string or undefined (never null)
 *   ✓ tag is always one of ASSUMED | IMPROVED | USER_REQUIRED
 *   ✓ category is always a valid UpgradeFix category
 *   ✓ id is always a non-null string
 *   ✓ title, description, suggestion are always strings
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest";
import { sanitizeFix } from "./decisionUpgradeEngine";

// ─── Valid enum sets ──────────────────────────────────────────────────────────

const VALID_TAGS = ["ASSUMED", "IMPROVED", "USER_REQUIRED"] as const;
const VALID_CATEGORIES = [
  "missing_input",
  "performance_gap",
  "structural_issue",
  "narrative",
  "risk_mitigation",
] as const;

// ─── Random malformed value generators ───────────────────────────────────────

const CHAOS_VALUES: Array<() => any> = [
  () => null,
  () => undefined,
  () => 0,
  () => 1,
  () => -1,
  () => 42.5,
  () => NaN,
  () => Infinity,
  () => true,
  () => false,
  () => "",
  () => "   ",
  () => "a".repeat(5000),           // extremely long string
  () => "<script>alert(1)</script>", // XSS attempt
  () => "'; DROP TABLE fixes; --",  // SQL injection attempt
  () => "null",                      // string "null"
  () => "undefined",                 // string "undefined"
  () => [],
  () => [null, null],
  () => ["a", "b", "c"],
  () => {},
  () => { return { nested: { deep: { value: 42 } } }; },
  () => new Date(),
  () => Symbol("test"),
  () => () => "function",
  () => /regex/,
  () => new Error("error object"),
];

function randomChaosValue(): any {
  return CHAOS_VALUES[Math.floor(Math.random() * CHAOS_VALUES.length)]();
}

/** Generate a deterministic set of 50 malformed fix objects covering all chaos patterns */
function generateChaosFixtures(count: number): Record<string, any>[] {
  const fixtures: Record<string, any>[] = [];

  // Pattern 1: completely empty object
  fixtures.push({});

  // Pattern 2: all fields null
  fixtures.push({
    id: null, category: null, title: null, description: null,
    suggestion: null, tag: null, fieldPath: null, exampleValue: null,
  });

  // Pattern 3: all fields undefined
  fixtures.push({
    id: undefined, category: undefined, title: undefined, description: undefined,
    suggestion: undefined, tag: undefined, fieldPath: undefined, exampleValue: undefined,
  });

  // Pattern 4: all fields wrong type (numbers)
  fixtures.push({
    id: 1, category: 2, title: 3, description: 4,
    suggestion: 5, tag: 6, fieldPath: 7, exampleValue: 8,
  });

  // Pattern 5: all fields booleans
  fixtures.push({
    id: true, category: false, title: true, description: false,
    suggestion: true, tag: false, fieldPath: true, exampleValue: false,
  });

  // Pattern 6: all fields arrays
  fixtures.push({
    id: [], category: [], title: [], description: [],
    suggestion: [], tag: [], fieldPath: [], exampleValue: [],
  });

  // Pattern 7: all fields objects
  fixtures.push({
    id: {}, category: {}, title: {}, description: {},
    suggestion: {}, tag: {}, fieldPath: {}, exampleValue: {},
  });

  // Pattern 8: invalid tag only
  fixtures.push({ id: "fix_008", tag: "INVALID_TAG" });

  // Pattern 9: invalid category only
  fixtures.push({ id: "fix_009", category: "unknown_category" });

  // Pattern 10: exampleValue as deeply nested object
  fixtures.push({ id: "fix_010", exampleValue: { a: { b: { c: { d: 42 } } } } });

  // Pattern 11: exampleValue as Date
  fixtures.push({ id: "fix_011", exampleValue: new Date("2024-01-01") });

  // Pattern 12: exampleValue as array of objects
  fixtures.push({ id: "fix_012", exampleValue: [{ cac: 120 }, { ltv: 600 }] });

  // Pattern 13: extremely long exampleValue
  fixtures.push({ id: "fix_013", exampleValue: "x".repeat(10000) });

  // Pattern 14: XSS in title
  fixtures.push({ id: "fix_014", title: "<script>alert('xss')</script>" });

  // Pattern 15: SQL injection in suggestion
  fixtures.push({ id: "fix_015", suggestion: "'; DROP TABLE decision_upgrade_runs; --" });

  // Pattern 16: Unicode in all fields
  fixtures.push({
    id: "fix_016",
    title: "مرحبا بالعالم",
    description: "الوصف هنا",
    suggestion: "الاقتراح هنا",
    exampleValue: "قيمة المثال",
  });

  // Pattern 17: NaN values
  fixtures.push({ id: "fix_017", exampleValue: NaN, title: NaN });

  // Pattern 18: Infinity
  fixtures.push({ id: "fix_018", exampleValue: Infinity });

  // Pattern 19: negative number
  fixtures.push({ id: "fix_019", exampleValue: -42 });

  // Pattern 20: zero
  fixtures.push({ id: "fix_020", exampleValue: 0 });

  // Patterns 21-50: randomly generated chaos
  for (let i = 21; i <= count; i++) {
    const fix: Record<string, any> = { id: `fix_${String(i).padStart(3, "0")}` };
    const fields = ["category", "title", "description", "suggestion", "tag", "fieldPath", "exampleValue"];
    // Randomly assign chaos values to a random subset of fields
    const numFieldsToCorrupt = Math.floor(Math.random() * fields.length) + 1;
    const shuffled = [...fields].sort(() => Math.random() - 0.5);
    for (let j = 0; j < numFieldsToCorrupt; j++) {
      fix[shuffled[j]] = randomChaosValue();
    }
    fixtures.push(fix);
  }

  return fixtures;
}

// ─── Chaos test suite ─────────────────────────────────────────────────────────

describe("sanitizeFix — chaos stress test (50 random malformed inputs)", () => {
  const fixtures = generateChaosFixtures(50);

  it(`processes all ${fixtures.length} malformed inputs without throwing`, () => {
    expect(() => {
      fixtures.forEach(f => sanitizeFix(f));
    }).not.toThrow();
  });

  it("exampleValue is always a string on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(typeof result.exampleValue, `fixture[${i}] exampleValue should be string`).toBe("string");
    });
  });

  it("fieldPath is always string or undefined (never null) on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      const isValid = result.fieldPath === undefined || typeof result.fieldPath === "string";
      expect(isValid, `fixture[${i}] fieldPath should be string or undefined, got: ${JSON.stringify(result.fieldPath)}`).toBe(true);
    });
  });

  it("tag is always a valid enum value on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(
        VALID_TAGS.includes(result.tag as any),
        `fixture[${i}] tag should be ASSUMED|IMPROVED|USER_REQUIRED, got: ${result.tag}`,
      ).toBe(true);
    });
  });

  it("category is always a valid enum value on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(
        VALID_CATEGORIES.includes(result.category as any),
        `fixture[${i}] category should be valid, got: ${result.category}`,
      ).toBe(true);
    });
  });

  it("id is always a non-null, non-undefined string on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(typeof result.id, `fixture[${i}] id should be string`).toBe("string");
      expect(result.id, `fixture[${i}] id should not be null`).not.toBeNull();
    });
  });

  it("title is always a string on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(typeof result.title, `fixture[${i}] title should be string`).toBe("string");
    });
  });

  it("description is always a string on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(typeof result.description, `fixture[${i}] description should be string`).toBe("string");
    });
  });

  it("suggestion is always a string on all outputs", () => {
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      expect(typeof result.suggestion, `fixture[${i}] suggestion should be string`).toBe("string");
    });
  });

  it("output conforms to full UpgradeFix shape on all outputs", () => {
    const requiredKeys = ["id", "category", "title", "description", "suggestion", "tag", "exampleValue"];
    fixtures.forEach((f, i) => {
      const result = sanitizeFix(f);
      requiredKeys.forEach(key => {
        expect(
          key in result,
          `fixture[${i}] output missing key: ${key}`,
        ).toBe(true);
      });
    });
  });
});

// ─── Deterministic edge cases ─────────────────────────────────────────────────

describe("sanitizeFix — deterministic edge cases", () => {
  it("handles Symbol as exampleValue without crashing", () => {
    // Symbol cannot be converted with String() in all environments, but
    // the implementation uses != null check first — Symbol is not null/undefined
    // so String(Symbol('x')) throws TypeError in strict mode
    // The implementation should handle this gracefully
    expect(() => sanitizeFix({ exampleValue: Symbol("test") })).not.toThrow();
  });

  it("handles function as exampleValue without crashing", () => {
    expect(() => sanitizeFix({ exampleValue: () => "fn" })).not.toThrow();
  });

  it("handles RegExp as exampleValue without crashing", () => {
    expect(() => sanitizeFix({ exampleValue: /regex/ })).not.toThrow();
  });

  it("handles Error object as exampleValue without crashing", () => {
    expect(() => sanitizeFix({ exampleValue: new Error("test") })).not.toThrow();
  });

  it("handles Date as exampleValue without crashing", () => {
    expect(() => sanitizeFix({ exampleValue: new Date() })).not.toThrow();
  });

  it("handles circular reference object gracefully", () => {
    const circular: any = { a: 1 };
    circular.self = circular;
    // sanitizeFix uses String() which calls .toString() — circular refs don't cause String() to throw
    expect(() => sanitizeFix({ exampleValue: circular })).not.toThrow();
  });

  it("handles extremely long string in title without crashing", () => {
    const result = sanitizeFix({ title: "a".repeat(100000) });
    expect(typeof result.title).toBe("string");
  });

  it("handles null prototype object without crashing", () => {
    const noProto = Object.create(null) as any;
    noProto.id = "fix_np";
    noProto.exampleValue = null;
    expect(() => sanitizeFix(noProto)).not.toThrow();
  });
});

// ─── Batch invariant verification ────────────────────────────────────────────

describe("sanitizeFix — batch invariant verification", () => {
  it("all 50 chaos outputs pass the full invariant check simultaneously", () => {
    const fixtures = generateChaosFixtures(50);
    const results = fixtures.map(f => sanitizeFix(f));

    const violations: string[] = [];

    results.forEach((r, i) => {
      if (typeof r.exampleValue !== "string") violations.push(`[${i}] exampleValue not string: ${typeof r.exampleValue}`);
      if (r.fieldPath !== undefined && typeof r.fieldPath !== "string") violations.push(`[${i}] fieldPath invalid: ${typeof r.fieldPath}`);
      if (!VALID_TAGS.includes(r.tag as any)) violations.push(`[${i}] tag invalid: ${r.tag}`);
      if (!VALID_CATEGORIES.includes(r.category as any)) violations.push(`[${i}] category invalid: ${r.category}`);
      if (typeof r.id !== "string") violations.push(`[${i}] id not string: ${typeof r.id}`);
      if (typeof r.title !== "string") violations.push(`[${i}] title not string: ${typeof r.title}`);
      if (typeof r.description !== "string") violations.push(`[${i}] description not string: ${typeof r.description}`);
      if (typeof r.suggestion !== "string") violations.push(`[${i}] suggestion not string: ${typeof r.suggestion}`);
    });

    if (violations.length > 0) {
      throw new Error(`Invariant violations found:\n${violations.join("\n")}`);
    }

    expect(violations).toHaveLength(0);
  });
});
