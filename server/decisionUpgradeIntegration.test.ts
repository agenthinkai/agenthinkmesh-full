/**
 * server/decisionUpgradeIntegration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Part 3: Integration test — full applyFixesRerun pipeline simulation.
 *
 * Simulates the real failure scenario:
 *   - LLM emits fixes with exampleValue: null, object fields, missing fields,
 *     invalid tags
 *   - These are sanitized by sanitizeFix() at the engine layer
 *   - Then Zod-parsed by AppliedFixSchema at the router layer
 *   - Then passed to buildImprovedInput → computeDeltaOutput
 *
 * Verifies:
 *   ✓ No validation error thrown at any layer
 *   ✓ Improved input is generated (non-empty string)
 *   ✓ Delta output is produced with correct shape
 *   ✓ verdictBefore / verdictAfter are stored correctly
 *   ✓ confidenceDelta is computed correctly
 *   ✓ Pipeline handles deal and procurement domains
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// ─── Mock LLM at module level (hoisted) ──────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          keyMetricChanges: [
            { metric: "Runway", before: "4 months", after: "18 months", direction: "improved" },
            { metric: "CAC/LTV", before: "Unknown", after: "3.2x", direction: "improved" },
            { metric: "Burn Rate", before: "$200K/mo", after: "$100K/mo", direction: "improved" },
          ],
          topImprovementFactors: [
            "Extended runway via bridge financing",
            "Unit economics now clearly stated",
            "Burn rate reduction plan presented",
          ],
          remainingGaps: ["Team track record still unverified"],
          summary: "The submission addressed the three primary blocking issues. Verdict shifted from REJECTED to APPROVED_WITH_CONDITIONS.",
        }),
      },
    }],
  }),
}));

// ─── Import engine after mock ─────────────────────────────────────────────────
import {
  sanitizeFix,
  buildImprovedInput,
  computeDeltaOutput,
  type AppliedFix,
  type UpgradeFix,
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ORIGINAL_DEAL_INPUT = `
Company: TechStartup Ltd
Sector: B2B SaaS
Revenue: $500K ARR
Burn Rate: $200K/month
Runway: 4 months
Team: 2 founders, no prior exits
Market: SME HR software, TAM $2B
`.trim();

const ORIGINAL_PROCUREMENT_INPUT = `
Vendor: Alibaba Cloud MENA
Category: Cloud Infrastructure
Contract Value: $2.4M/year
SLA: 99.5% uptime
Data Residency: Not confirmed
Security Certifications: ISO 27001 (pending)
`.trim();

const NARRATIVE_FIX = {
  original: "Company has 4 months runway with no clear path to profitability.",
  improved: "Company has secured bridge financing extending runway to 18 months and has a clear path to cash-flow breakeven at $1.2M ARR.",
  rationale: "Addressing runway concern directly removes the primary blocking issue.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate what the LLM emits — raw, potentially malformed fix objects */
function makeMalformedLLMFix(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: "fix_001",
    category: "missing_input",
    title: "Add CAC/LTV Metrics",
    description: null,           // LLM forgot to fill this
    suggestion: "Provide CAC: $120, LTV: $600",
    tag: "ASSUMED",
    fieldPath: null,
    exampleValue: null,          // The original bug
    applied: true,
    userEdited: null,
    ...overrides,
  };
}

/**
 * Full pipeline: raw LLM output → sanitizeFix → Zod parse → buildImprovedInput → computeDeltaOutput
 */
async function runFullPipeline(
  rawFixes: Record<string, any>[],
  originalInput: string,
  domain: "deal" | "procurement",
  verdictBefore: string,
  verdictAfter: string,
  confidenceBefore: number,
  confidenceAfter: number,
) {
  // Layer 1: sanitizeFix (engine-level normalization)
  const sanitized: UpgradeFix[] = rawFixes.map(f => sanitizeFix(f));

  // Layer 2: Zod parse (router-level schema validation)
  // We add applied: true to each sanitized fix for AppliedFixSchema
  const withApplied = sanitized.map(f => ({ ...f, applied: true, userEdited: null }));
  const parsed = withApplied.map(f => AppliedFixSchema.parse(f)) as AppliedFix[];

  // Layer 3: buildImprovedInput
  const improvedInput = buildImprovedInput(originalInput, parsed, NARRATIVE_FIX);

  // Layer 4: computeDeltaOutput (LLM mocked)
  const delta = await computeDeltaOutput({
    domain,
    verdictBefore,
    verdictAfter,
    confidenceBefore,
    confidenceAfter,
    appliedFixes: parsed,
    originalInput,
    improvedInput,
    blockingIssuesBefore: ["Missing unit economics", "Short runway"],
    blockingIssuesAfter: [],
  });

  return { sanitized, parsed, improvedInput, delta };
}

// ─── Part 3a: Core failure scenario ──────────────────────────────────────────

describe("Integration — core failure scenario (null exampleValue + missing fields)", () => {
  it("full pipeline succeeds with exampleValue: null on all fixes", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ id: "fix_001", exampleValue: null }),
      makeMalformedLLMFix({ id: "fix_002", exampleValue: null }),
      makeMalformedLLMFix({ id: "fix_003", exampleValue: null }),
    ];

    const { improvedInput, delta } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    expect(typeof improvedInput).toBe("string");
    expect(improvedInput.length).toBeGreaterThan(0);
    expect(delta.verdictBefore).toBe("REJECTED");
    expect(delta.verdictAfter).toBe("APPROVED_WITH_CONDITIONS");
    expect(delta.verdictChanged).toBe(true);
    expect(delta.confidenceDelta).toBeCloseTo(0.37, 2);
  });

  it("full pipeline succeeds with exampleValue as object (malformed LLM output)", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ exampleValue: { cac: 120, ltv: 600 } }),
    ];

    const { parsed, delta } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    // safeString: object is non-primitive — collapses to ""
    expect(parsed[0].exampleValue).toBe("");
    expect(delta).toBeDefined();
  });

  it("full pipeline succeeds with description: null on all fixes", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ description: null }),
      makeMalformedLLMFix({ description: null }),
    ];

    const { sanitized } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    sanitized.forEach(f => {
      expect(f.description).toBe("");
    });
  });

  it("full pipeline succeeds with invalid tag (defaults to USER_REQUIRED)", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ tag: "INVALID_TAG" }),
    ];

    const { sanitized } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    expect(sanitized[0].tag).toBe("USER_REQUIRED");
  });

  it("full pipeline succeeds with missing id (auto-generates fix_ prefix)", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ id: undefined }),
    ];

    const { sanitized } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    expect(sanitized[0].id).toMatch(/^fix_/);
  });
});

// ─── Part 3b: Mixed malformed payload ────────────────────────────────────────

describe("Integration — mixed malformed payload (all bad LLM patterns combined)", () => {
  it("handles payload with all known bad patterns simultaneously", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ id: "fix_001", exampleValue: null, description: null, tag: "ASSUMED" }),
      makeMalformedLLMFix({ id: "fix_002", exampleValue: { nested: true }, fieldPath: null }),
      makeMalformedLLMFix({ id: undefined, tag: "INVALID_TAG", suggestion: null }),
      makeMalformedLLMFix({ id: "fix_004", exampleValue: [], description: 42 }),
      makeMalformedLLMFix({ id: "fix_005", exampleValue: null, userEdited: null, fieldPath: null }),
    ];

    // Should not throw at any layer
    const { sanitized, parsed, improvedInput, delta } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    // All sanitized
    expect(sanitized).toHaveLength(5);
    sanitized.forEach(f => {
      expect(typeof f.exampleValue).toBe("string");
      expect(typeof f.description).toBe("string");
      expect(["ASSUMED", "IMPROVED", "USER_REQUIRED"]).toContain(f.tag);
    });

    // All Zod-parsed
    expect(parsed).toHaveLength(5);
    parsed.forEach(p => {
      expect(typeof p.exampleValue).toBe("string");
    });

    // Pipeline completed
    expect(typeof improvedInput).toBe("string");
    expect(delta.verdictChanged).toBe(true);
  });
});

// ─── Part 3c: Procurement domain ─────────────────────────────────────────────

describe("Integration — procurement domain with malformed fixes", () => {
  it("full pipeline succeeds for procurement with null exampleValue fixes", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ id: "fix_001", category: "missing_input", exampleValue: null }),
      makeMalformedLLMFix({ id: "fix_002", category: "structural_issue", exampleValue: null }),
      makeMalformedLLMFix({ id: "fix_003", category: "risk_mitigation", exampleValue: null }),
    ];

    const { delta } = await runFullPipeline(
      rawFixes, ORIGINAL_PROCUREMENT_INPUT, "procurement",
      "REJECT", "CONDITIONAL APPROVAL", 0.42, 0.68,
    );

    expect(delta.verdictBefore).toBe("REJECT");
    expect(delta.verdictAfter).toBe("CONDITIONAL APPROVAL");
    expect(delta.verdictChanged).toBe(true);
    expect(delta.confidenceDelta).toBeCloseTo(0.26, 2);
    expect(delta.summary).toBeTruthy();
  });
});

// ─── Part 3d: Delta output shape verification ─────────────────────────────────

describe("Integration — delta output shape verification", () => {
  it("delta output contains all required fields after malformed fix pipeline", async () => {
    const rawFixes = [makeMalformedLLMFix({ exampleValue: null })];

    const { delta } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.35, 0.72,
    );

    // Verify full DeltaOutput shape
    expect(delta).toHaveProperty("verdictBefore");
    expect(delta).toHaveProperty("verdictAfter");
    expect(delta).toHaveProperty("verdictChanged");
    expect(delta).toHaveProperty("confidenceBefore");
    expect(delta).toHaveProperty("confidenceAfter");
    expect(delta).toHaveProperty("confidenceDelta");
    expect(delta).toHaveProperty("keyMetricChanges");
    expect(delta).toHaveProperty("topImprovementFactors");
    expect(delta).toHaveProperty("remainingGaps");
    expect(delta).toHaveProperty("summary");

    expect(typeof delta.verdictChanged).toBe("boolean");
    expect(Array.isArray(delta.keyMetricChanges)).toBe(true);
    expect(Array.isArray(delta.topImprovementFactors)).toBe(true);
    expect(Array.isArray(delta.remainingGaps)).toBe(true);
    expect(typeof delta.summary).toBe("string");
  });

  it("confidence delta is computed correctly regardless of fix quality", async () => {
    const rawFixes = [
      makeMalformedLLMFix({ exampleValue: null }),
      makeMalformedLLMFix({ exampleValue: null, description: null }),
    ];

    const { delta } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "APPROVED_WITH_CONDITIONS", 0.40, 0.75,
    );

    expect(delta.confidenceBefore).toBe(0.40);
    expect(delta.confidenceAfter).toBe(0.75);
    expect(delta.confidenceDelta).toBeCloseTo(0.35, 2);
  });

  it("verdictChanged is false when verdicts are identical", async () => {
    const rawFixes = [makeMalformedLLMFix({ exampleValue: null })];

    const { delta } = await runFullPipeline(
      rawFixes, ORIGINAL_DEAL_INPUT, "deal",
      "REJECTED", "REJECTED", 0.35, 0.40,
    );

    expect(delta.verdictChanged).toBe(false);
  });
});
