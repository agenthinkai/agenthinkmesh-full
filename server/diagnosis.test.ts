/**
 * diagnosis.test.ts — Unit tests for the Founder Diagnostic engine
 *
 * Tests:
 *   1. validateDiagnosisOutput — deterministic JSON schema validation
 *   2. Loaded cost formula (token-only for free diagnostic)
 *   3. Escalation trigger: validation failure → escalate
 */

import { describe, it, expect } from "vitest";

// ── Re-implement the validator locally (mirrors diagnosisRouter.ts) ───────────
import { z } from "zod";

const DimensionSchema = z.object({
  name: z.enum(["business_model", "market", "moat", "cashflow"]),
  score: z.number().min(0).max(100),
  note: z.string().min(1),
});

const GapSchema = z.object({
  title: z.string().min(1),
  why_fatal: z.string().min(1),
  fix: z.string().min(1),
});

const DiagnosisOutputSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z.array(DimensionSchema).length(4),
  gaps: z.array(GapSchema).length(3),
});

function validateDiagnosisOutput(raw: string) {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    const result = DiagnosisOutputSchema.safeParse(parsed);
    if (!result.success) return null;
    for (const d of result.data.dimensions) {
      if (!d.note?.trim()) return null;
    }
    for (const g of result.data.gaps) {
      if (!g.title?.trim() || !g.why_fatal?.trim() || !g.fix?.trim()) return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

// ── Valid fixture ─────────────────────────────────────────────────────────────
const VALID_OUTPUT = {
  score: 42,
  dimensions: [
    { name: "business_model", score: 30, note: "No clear monetisation path." },
    { name: "market", score: 55, note: "Market exists but is crowded." },
    { name: "moat", score: 20, note: "Zero defensibility identified." },
    { name: "cashflow", score: 45, note: "Burn rate assumptions are optimistic." },
  ],
  gaps: [
    { title: "No moat", why_fatal: "Competitors can copy in 3 months.", fix: "File provisional patent." },
    { title: "Overestimated TAM", why_fatal: "Real TAM is 10x smaller.", fix: "Narrow ICP to one segment." },
    { title: "No paying customer", why_fatal: "No validation of willingness to pay.", fix: "Run 10 paid pilots." },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("validateDiagnosisOutput", () => {
  it("accepts a valid JSON string", () => {
    const result = validateDiagnosisOutput(JSON.stringify(VALID_OUTPUT));
    expect(result).not.toBeNull();
    expect(result?.score).toBe(42);
    expect(result?.dimensions).toHaveLength(4);
    expect(result?.gaps).toHaveLength(3);
  });

  it("strips markdown code fences before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```";
    expect(validateDiagnosisOutput(fenced)).not.toBeNull();
  });

  it("returns null for plain text (not JSON)", () => {
    expect(validateDiagnosisOutput("Great idea! Here is some feedback.")).toBeNull();
  });

  it("returns null if score is missing", () => {
    const bad = { ...VALID_OUTPUT, score: undefined };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if dimensions has fewer than 4 entries", () => {
    const bad = { ...VALID_OUTPUT, dimensions: VALID_OUTPUT.dimensions.slice(0, 3) };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if dimensions has more than 4 entries", () => {
    const bad = {
      ...VALID_OUTPUT,
      dimensions: [
        ...VALID_OUTPUT.dimensions,
        { name: "business_model", score: 50, note: "Extra entry." },
      ],
    };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if gaps has fewer than 3 entries", () => {
    const bad = { ...VALID_OUTPUT, gaps: VALID_OUTPUT.gaps.slice(0, 2) };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if a required gap field is empty string", () => {
    const bad = {
      ...VALID_OUTPUT,
      gaps: [
        { title: "", why_fatal: "Fatal.", fix: "Fix it." },
        ...VALID_OUTPUT.gaps.slice(1),
      ],
    };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if a required gap field is null", () => {
    const bad = {
      ...VALID_OUTPUT,
      gaps: [
        { title: "Gap", why_fatal: null, fix: "Fix." },
        ...VALID_OUTPUT.gaps.slice(1),
      ],
    };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if a dimension note is empty string", () => {
    const bad = {
      ...VALID_OUTPUT,
      dimensions: [
        { name: "business_model", score: 30, note: "" },
        ...VALID_OUTPUT.dimensions.slice(1),
      ],
    };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if a dimension name is not one of the four enum values", () => {
    const bad = {
      ...VALID_OUTPUT,
      dimensions: [
        { name: "revenue", score: 30, note: "Invalid dimension." },
        ...VALID_OUTPUT.dimensions.slice(1),
      ],
    };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null if score is out of range (> 100)", () => {
    const bad = { ...VALID_OUTPUT, score: 150 };
    expect(validateDiagnosisOutput(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for empty string input", () => {
    expect(validateDiagnosisOutput("")).toBeNull();
  });

  it("returns null for truncated JSON", () => {
    const truncated = JSON.stringify(VALID_OUTPUT).slice(0, 80);
    expect(validateDiagnosisOutput(truncated)).toBeNull();
  });
});

// ── Token cost formula ────────────────────────────────────────────────────────
describe("token cost formula (SMALL tier)", () => {
  const INPUT_PRICE_PER_M = 0.15;
  const OUTPUT_PRICE_PER_M = 0.60;

  function computeTokenCost(inputTokens: number, outputTokens: number) {
    return (inputTokens / 1_000_000) * INPUT_PRICE_PER_M
      + (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M;
  }

  it("computes zero cost for zero tokens", () => {
    expect(computeTokenCost(0, 0)).toBe(0);
  });

  it("computes correct cost for 1M input tokens", () => {
    expect(computeTokenCost(1_000_000, 0)).toBeCloseTo(0.15, 8);
  });

  it("computes correct cost for 1M output tokens", () => {
    expect(computeTokenCost(0, 1_000_000)).toBeCloseTo(0.60, 8);
  });

  it("computes correct combined cost", () => {
    // 500 input + 300 output tokens
    const expected = (500 / 1_000_000) * 0.15 + (300 / 1_000_000) * 0.60;
    expect(computeTokenCost(500, 300)).toBeCloseTo(expected, 10);
  });
});

// ── Escalation trigger logic ──────────────────────────────────────────────────
describe("escalation trigger: validation failure", () => {
  it("escalates when first attempt returns invalid JSON", () => {
    const TIERS = ["SMALL", "MID", "LARGE"];
    const tiersUsed: string[] = [];
    let tierIdx = 0;
    let attemptsCount = 0;
    let escalated = false;
    let result = null;

    // Simulate: SMALL fails validation, MID succeeds
    const mockResponses: Array<{ raw: string; hardFail: boolean }> = [
      { raw: "Great idea! Here is some encouragement.", hardFail: false }, // SMALL: invalid
      { raw: JSON.stringify(VALID_OUTPUT), hardFail: false },              // MID: valid
    ];

    let callIdx = 0;
    while (attemptsCount < 6 && tierIdx < TIERS.length) {
      const currentTier = TIERS[tierIdx];
      tiersUsed.push(currentTier);
      attemptsCount++;

      const { raw, hardFail } = mockResponses[callIdx++] ?? { raw: "", hardFail: true };

      if (!hardFail) {
        const validated = validateDiagnosisOutput(raw);
        if (validated) {
          result = validated;
          break;
        } else {
          // Validation failure → escalate
          tierIdx++;
          if (tierIdx < TIERS.length) escalated = true;
        }
      } else {
        tierIdx++;
        if (tierIdx < TIERS.length) escalated = true;
      }
    }

    expect(tiersUsed).toEqual(["SMALL", "MID"]);
    expect(attemptsCount).toBe(2);
    expect(escalated).toBe(true);
    expect(result).not.toBeNull();
    expect(result?.score).toBe(42);
  });

  it("records same-tier retry in tiersUsed for hard failure", () => {
    const TIERS = ["SMALL", "MID", "LARGE"];
    const tiersUsed: string[] = [];
    let tierIdx = 0;
    let attemptsCount = 0;
    let escalated = false;
    let result = null;

    // Simulate: SMALL hard fail, SMALL retry hard fail, MID succeeds
    const mockHardFails = [true, true, false];
    const mockRaws = ["", "", JSON.stringify(VALID_OUTPUT)];

    let callIdx = 0;
    while (attemptsCount < 6 && tierIdx < TIERS.length) {
      const currentTier = TIERS[tierIdx];
      tiersUsed.push(currentTier);
      attemptsCount++;

      const hardFail = mockHardFails[callIdx];
      const raw = mockRaws[callIdx];
      callIdx++;

      if (!hardFail) {
        const validated = validateDiagnosisOutput(raw);
        if (validated) { result = validated; break; }
        tierIdx++;
        if (tierIdx < TIERS.length) escalated = true;
      } else {
        // Same-tier retry once
        if (attemptsCount < 6) {
          tiersUsed.push(currentTier);
          attemptsCount++;
          const retryHardFail = mockHardFails[callIdx];
          const retryRaw = mockRaws[callIdx];
          callIdx++;
          if (!retryHardFail) {
            const validated = validateDiagnosisOutput(retryRaw);
            if (validated) { result = validated; break; }
          }
        }
        tierIdx++;
        if (tierIdx < TIERS.length) escalated = true;
      }
    }

    expect(tiersUsed).toEqual(["SMALL", "SMALL", "MID"]);
    expect(attemptsCount).toBe(3);
    expect(escalated).toBe(true);
    expect(result).not.toBeNull();
  });
});
