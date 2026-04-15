/**
 * server/decisionUpgradeRerun.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-end simulation of the applyFixesRerun flow.
 *
 * This test verifies that:
 *   1. A payload containing appliedFixes with exampleValue: null passes
 *      AppliedFixSchema validation without throwing.
 *   2. buildImprovedInput correctly incorporates applied fixes into the
 *      improved input text.
 *   3. computeDeltaOutput (mocked LLM) returns a valid DeltaOutput.
 *   4. The full re-run simulation completes successfully end-to-end.
 *
 * Strategy: We do NOT import the tRPC router directly (it requires a live DB
 * and auth context). Instead we test the pure engine functions that the router
 * delegates to, using the same input payloads the router would receive after
 * Zod parsing. This gives us full coverage of the null exampleValue regression
 * path without needing a test database.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// ─── Mock the LLM module BEFORE any engine imports (hoisted by vitest) ────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          keyMetricChanges: [
            { metric: "Runway", before: "4 months", after: "18 months", direction: "improved" },
            { metric: "CAC/LTV", before: "Unknown", after: "3.2x", direction: "improved" },
          ],
          topImprovementFactors: ["Extended runway", "Provided unit economics"],
          remainingGaps: ["Team track record still weak"],
          summary: "The deal has improved significantly after addressing the blocking issues.",
        }),
      },
    }],
  }),
}));

// ─── Import engine AFTER mock is registered ───────────────────────────────────
import {
  buildImprovedInput,
  computeDeltaOutput,
  type AppliedFix,
} from "./decisionUpgradeEngine";

// ─── Replicate AppliedFixSchema (same as router) ──────────────────────────────

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

type AppliedFixInput = z.input<typeof AppliedFixSchema>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ORIGINAL_INPUT = `
Company: TechStartup Ltd
Sector: B2B SaaS
Revenue: $500K ARR
Burn Rate: $120K/month
Runway: 4 months
Team: 2 founders, no prior exits
Market: SME HR software, TAM $2B
`.trim();

const PROTOCOL_NARRATIVE_FIX = {
  original: "Company has 4 months runway with no clear path to profitability.",
  improved: "Company has secured bridge financing extending runway to 18 months and has a clear path to cash-flow breakeven at $1.2M ARR.",
  rationale: "Addressing runway concern directly removes the primary blocking issue.",
};

/** Simulate the raw payload coming from the frontend (exampleValue may be null) */
function makeAppliedFixPayload(overrides: Partial<AppliedFixInput> = {}): AppliedFixInput {
  return {
    id: "fix_001",
    category: "missing_input",
    title: "Add CAC/LTV Metrics",
    description: "Unit economics are missing",
    suggestion: "Provide CAC and LTV figures with supporting data",
    tag: "USER_REQUIRED",
    applied: true,
    exampleValue: null,       // ← the bug: LLM emits null
    fieldPath: null,          // ← also null from LLM
    userEdited: null,         // ← also null
    ...overrides,
  };
}

// ─── Phase 1: Zod schema validation with null exampleValue ────────────────────

describe("applyFixesRerun — Zod schema validation (null exampleValue)", () => {
  it("parses a single fix with exampleValue: null without throwing", () => {
    const raw = makeAppliedFixPayload({ exampleValue: null });
    const parsed = AppliedFixSchema.parse(raw);
    expect(parsed.exampleValue).toBe("");
    expect(parsed.fieldPath).toBeUndefined();
    expect(parsed.userEdited).toBeUndefined();
  });

  it("parses an array of 5 fixes where all have exampleValue: null", () => {
    const fixes = Array.from({ length: 5 }, (_, i) =>
      makeAppliedFixPayload({ id: `fix_00${i + 1}`, exampleValue: null }),
    );
    const parsed = fixes.map(f => AppliedFixSchema.parse(f));
    expect(parsed).toHaveLength(5);
    parsed.forEach(p => {
      expect(p.exampleValue).toBe("");
    });
  });

  it("parses a mixed array where some fixes have null, some have values", () => {
    const fixes: AppliedFixInput[] = [
      makeAppliedFixPayload({ id: "fix_001", exampleValue: null }),
      makeAppliedFixPayload({ id: "fix_002", exampleValue: "CAC: $120" }),
      makeAppliedFixPayload({ id: "fix_003" }),                          // omitted
      makeAppliedFixPayload({ id: "fix_004", exampleValue: "" }),
      makeAppliedFixPayload({ id: "fix_005", exampleValue: "LTV: $600" }),
    ];
    const parsed = fixes.map(f => AppliedFixSchema.parse(f));
    expect(parsed[0].exampleValue).toBe("");
    expect(parsed[1].exampleValue).toBe("CAC: $120");
    expect(parsed[2].exampleValue).toBe("");
    expect(parsed[3].exampleValue).toBe("");
    expect(parsed[4].exampleValue).toBe("LTV: $600");
  });

  it("does not throw when the entire appliedFixes array has all nullish fields", () => {
    const allNullFix = makeAppliedFixPayload({
      exampleValue: null,
      fieldPath: null,
      userEdited: null,
    });
    expect(() => AppliedFixSchema.parse(allNullFix)).not.toThrow();
  });
});

// ─── Phase 2: buildImprovedInput with parsed fixes ────────────────────────────

describe("applyFixesRerun — buildImprovedInput with null-sanitized fixes", () => {
  it("builds improved input from fixes with null exampleValue (after Zod parsing)", () => {
    const rawFixes = [
      makeAppliedFixPayload({ id: "fix_001", exampleValue: null, applied: true }),
      makeAppliedFixPayload({ id: "fix_002", exampleValue: "CAC: $120", applied: true }),
      makeAppliedFixPayload({ id: "fix_003", exampleValue: null, applied: false }), // not applied
    ];
    const parsedFixes = rawFixes.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];

    // Should not throw
    const result = buildImprovedInput(BASE_ORIGINAL_INPUT, parsedFixes, PROTOCOL_NARRATIVE_FIX);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(BASE_ORIGINAL_INPUT.length);
    // Applied fixes should be reflected
    expect(result).toContain("Add CAC/LTV Metrics");
  });

  it("builds improved input when ALL fixes have exampleValue: null", () => {
    const rawFixes = Array.from({ length: 3 }, (_, i) =>
      makeAppliedFixPayload({ id: `fix_00${i + 1}`, exampleValue: null, applied: true }),
    );
    const parsedFixes = rawFixes.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];

    expect(() =>
      buildImprovedInput(BASE_ORIGINAL_INPUT, parsedFixes, PROTOCOL_NARRATIVE_FIX),
    ).not.toThrow();
  });

  it("builds improved input when no fixes are applied (all applied: false)", () => {
    const rawFixes = [
      makeAppliedFixPayload({ id: "fix_001", applied: false, exampleValue: null }),
    ];
    const parsedFixes = rawFixes.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];

    const result = buildImprovedInput(BASE_ORIGINAL_INPUT, parsedFixes, PROTOCOL_NARRATIVE_FIX);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Phase 3: Full re-run simulation with mocked LLM ─────────────────────────

describe("applyFixesRerun — full simulation with mocked LLM (null exampleValue)", () => {
  it("computeDeltaOutput succeeds when appliedFixes contain null exampleValue (after Zod parsing)", async () => {
    const rawFixes = [
      makeAppliedFixPayload({ id: "fix_001", exampleValue: null, applied: true }),
      makeAppliedFixPayload({ id: "fix_002", exampleValue: "CAC: $120", applied: true }),
    ];
    const parsedFixes = rawFixes.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];

    const delta = await computeDeltaOutput({
      domain: "deal",
      verdictBefore: "REJECTED",
      verdictAfter: "APPROVED_WITH_CONDITIONS",
      confidenceBefore: 0.35,
      confidenceAfter: 0.72,
      appliedFixes: parsedFixes,
      originalInput: BASE_ORIGINAL_INPUT,
      improvedInput: BASE_ORIGINAL_INPUT + "\n\n[IMPROVEMENTS APPLIED]",
      blockingIssuesBefore: ["Missing unit economics", "Short runway"],
      blockingIssuesAfter: ["Team track record"],
    });

    expect(delta).toBeDefined();
    expect(delta.verdictBefore).toBe("REJECTED");
    expect(delta.verdictAfter).toBe("APPROVED_WITH_CONDITIONS");
    expect(delta.verdictChanged).toBe(true);
    expect(delta.confidenceBefore).toBe(0.35);
    expect(delta.confidenceAfter).toBe(0.72);
    expect(delta.confidenceDelta).toBeCloseTo(0.37, 2);
    expect(Array.isArray(delta.keyMetricChanges)).toBe(true);
    expect(Array.isArray(delta.topImprovementFactors)).toBe(true);
    expect(Array.isArray(delta.remainingGaps)).toBe(true);
    expect(typeof delta.summary).toBe("string");
  });

  it("computeDeltaOutput handles procurement domain with null exampleValue fixes", async () => {
    const rawFixes = [
      makeAppliedFixPayload({ id: "fix_001", category: "missing_input", exampleValue: null, applied: true }),
      makeAppliedFixPayload({ id: "fix_002", category: "structural_issue", exampleValue: null, applied: true }),
    ];
    const parsedFixes = rawFixes.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];

    const delta = await computeDeltaOutput({
      domain: "procurement",
      verdictBefore: "REJECT",
      verdictAfter: "CONDITIONAL APPROVAL",
      confidenceBefore: 0.42,
      confidenceAfter: 0.68,
      appliedFixes: parsedFixes,
      originalInput: "Vendor: Alibaba Cloud MENA. Proposal for cloud infrastructure.",
      improvedInput: "Vendor: Alibaba Cloud MENA. Proposal for cloud infrastructure. [IMPROVEMENTS APPLIED]",
      blockingIssuesBefore: ["Data residency not confirmed", "SLA below threshold"],
      blockingIssuesAfter: [],
    });

    expect(delta).toBeDefined();
    expect(delta.verdictChanged).toBe(true);
    expect(delta.confidenceDelta).toBeGreaterThan(0);
  });

  it("full simulation: Zod parse → buildImprovedInput → computeDeltaOutput (no throws)", async () => {
    // Step 1: Raw payload from frontend (as if LLM emitted null exampleValue)
    const rawFixes: AppliedFixInput[] = [
      makeAppliedFixPayload({ id: "fix_001", exampleValue: null, applied: true }),
      makeAppliedFixPayload({ id: "fix_002", exampleValue: "CAC: $120, LTV: $600", applied: true }),
      makeAppliedFixPayload({ id: "fix_003", exampleValue: null, applied: false }),
    ];

    // Step 2: Zod parsing (as router does)
    const parsedFixes = rawFixes.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];
    expect(parsedFixes[0].exampleValue).toBe("");
    expect(parsedFixes[1].exampleValue).toBe("CAC: $120, LTV: $600");
    expect(parsedFixes[2].exampleValue).toBe("");

    // Step 3: Build improved input
    const improvedInput = buildImprovedInput(BASE_ORIGINAL_INPUT, parsedFixes, PROTOCOL_NARRATIVE_FIX);
    expect(typeof improvedInput).toBe("string");
    expect(improvedInput.length).toBeGreaterThan(0);

    // Step 4: Compute delta (LLM mocked)
    const delta = await computeDeltaOutput({
      domain: "deal",
      verdictBefore: "REJECTED",
      verdictAfter: "APPROVED_WITH_CONDITIONS",
      confidenceBefore: 0.35,
      confidenceAfter: 0.72,
      appliedFixes: parsedFixes,
      originalInput: BASE_ORIGINAL_INPUT,
      improvedInput,
      blockingIssuesBefore: ["Missing unit economics"],
      blockingIssuesAfter: [],
    });

    // Step 5: Verify delta output shape
    expect(delta.verdictBefore).toBe("REJECTED");
    expect(delta.verdictAfter).toBe("APPROVED_WITH_CONDITIONS");
    expect(delta.verdictChanged).toBe(true);
    expect(delta.confidenceDelta).toBeCloseTo(0.37, 2);
    expect(delta.summary).toBeTruthy();
  });
});
