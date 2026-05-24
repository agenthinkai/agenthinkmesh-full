/**
 * scenarioSim.test.ts
 * Unit tests for the Strategic Scenario Simulation Mode:
 *   - Mutation Engine: variant generation, dimension coverage, hard-no triggers
 *   - Aggregation Layer: decision distribution, failure vectors, pathways
 */
import { describe, it, expect } from "vitest";
import {
  SIMULATION_MODES,
  generateScenarioVariants,
  buildScenarioBrief,
  evaluateScenario,
  PERTURBATION_DIMENSIONS,
} from "./scenarioMutationEngine";
import { aggregateSimulationResults } from "./scenarioAggregator";

// ── Mutation Engine Tests ─────────────────────────────────────────────────────

describe("SIMULATION_MODES", () => {
  it("defines all 4 modes with correct scenario counts", () => {
    expect(SIMULATION_MODES.quick.count).toBe(100);
    expect(SIMULATION_MODES.institutional.count).toBe(1000);
    expect(SIMULATION_MODES.deep.count).toBe(10000);
    expect(SIMULATION_MODES.infrastructure.count).toBe(100000);
  });

  it("each mode has a label and description", () => {
    for (const mode of Object.values(SIMULATION_MODES)) {
      expect(mode.label).toBeTruthy();
      expect(mode.description).toBeTruthy();
    }
  });
});

describe("PERTURBATION_DIMENSIONS", () => {
  it("covers all 6 stress categories", () => {
    const categories = new Set(PERTURBATION_DIMENSIONS.map(d => d.category));
    // Categories use short form: "financial", "regulatory", etc.
    expect(categories.has("financial")).toBe(true);
    expect(categories.has("regulatory")).toBe(true);
    expect(categories.has("execution")).toBe(true);
    expect(categories.has("market")).toBe(true);
    expect(categories.has("technology")).toBe(true);
    expect(categories.has("governance")).toBe(true);
  });

  it("has at least 5 dimensions per category", () => {
    const counts: Record<string, number> = {};
    for (const d of PERTURBATION_DIMENSIONS) {
      counts[d.category] = (counts[d.category] ?? 0) + 1;
    }
    for (const [cat, count] of Object.entries(counts)) {
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });

  it("each dimension has a key, label, category, and levels array", () => {
    for (const dim of PERTURBATION_DIMENSIONS) {
      expect(dim.key).toBeTruthy();
      expect(dim.label).toBeTruthy();
      expect(dim.category).toBeTruthy();
      // The field is 'levels', not 'severityLevels'
      expect(Array.isArray(dim.levels)).toBe(true);
      expect(dim.levels.length).toBeGreaterThan(0);
    }
  });
});

describe("generateScenarioVariants", () => {
  it("generates the requested number of variants", () => {
    const variants = generateScenarioVariants(10);
    expect(variants.length).toBe(10);
  });

  it("generates exactly 20 variants when requested", () => {
    const variants = generateScenarioVariants(20);
    expect(variants.length).toBe(20);
  });

  it("each variant has a unique index", () => {
    const variants = generateScenarioVariants(50);
    const indices = new Set(variants.map(v => v.index));
    expect(indices.size).toBe(50);
  });

  it("each variant has perturbations as a Record", () => {
    const variants = generateScenarioVariants(5);
    for (const v of variants) {
      expect(typeof v.perturbations).toBe("object");
      expect(v.perturbations).not.toBeNull();
      // Should have at least one dimension key
      expect(Object.keys(v.perturbations).length).toBeGreaterThan(0);
    }
  });

  it("variants include stressedCategories and dominantRiskCategory", () => {
    const variants = generateScenarioVariants(5);
    for (const v of variants) {
      expect(Array.isArray(v.stressedCategories)).toBe(true);
      expect(typeof v.dominantRiskCategory).toBe("string");
      expect(typeof v.totalApprovalDelta).toBe("number");
      expect(typeof v.hasHardNo).toBe("boolean");
    }
  });

  it("variants include stressFragments array", () => {
    const variants = generateScenarioVariants(5);
    for (const v of variants) {
      expect(Array.isArray(v.stressFragments)).toBe(true);
    }
  });

  it("variants include a provenance manifest with seed and hardNoTriggers", () => {
    const variants = generateScenarioVariants(5, 42);
    for (const v of variants) {
      expect(typeof v.provenance.seed).toBe("number");
      expect(Array.isArray(v.provenance.hardNoTriggers)).toBe(true);
      expect(Array.isArray(v.provenance.correlationGroupsActivated)).toBe(true);
    }
  });

  it("is deterministic with the same seed", () => {
    const a = generateScenarioVariants(5, 12345);
    const b = generateScenarioVariants(5, 12345);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("buildScenarioBrief", () => {
  const baseDeal = "A fintech startup offering B2B payments in the GCC region. Revenue: $2M ARR. Team: 15 people. Seeking $5M Series A.";

  it("returns a non-empty string", () => {
    const variants = generateScenarioVariants(1);
    const brief = buildScenarioBrief(baseDeal, variants[0]);
    expect(typeof brief).toBe("string");
    expect(brief.length).toBeGreaterThan(50);
  });

  it("includes the base deal context", () => {
    const variants = generateScenarioVariants(1);
    const brief = buildScenarioBrief(baseDeal, variants[0]);
    // Should contain some of the deal text
    expect(brief.toLowerCase()).toContain("fintech");
  });

  it("includes stress scenario context or returns base text if no stress", () => {
    // With enough variants, at least one should have stress fragments
    const variants = generateScenarioVariants(20);
    const stressed = variants.find(v => v.stressFragments.length > 0);
    if (stressed) {
      const brief = buildScenarioBrief(baseDeal, stressed);
      expect(brief.toLowerCase()).toMatch(/scenario|stress|perturbation|simulation|condition/);
    } else {
      // All base-case — brief should equal the original deal text
      const brief = buildScenarioBrief(baseDeal, variants[0]);
      expect(brief).toBe(baseDeal);
    }
  });
});

describe("evaluateScenario", () => {
  it("evaluates a non-hard-no variant and returns a valid decision", async () => {
    // Generate 10 variants and pick the first non-hard-no one
    const variants = generateScenarioVariants(10);
    const variant = variants.find(v => !v.hasHardNo) ?? variants[0];
    const brief = buildScenarioBrief("A fintech startup in GCC. $2M ARR.", variant);
    const mockLLM = async () => ({ choices: [{ message: { content: "{}" } }] });
    const result = await evaluateScenario(variant, brief, mockLLM as any);
    expect(["APPROVE", "CONDITIONAL", "REJECT"]).toContain(result.decision);
    expect(typeof result.confidenceScore).toBe("number");
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  });

  it("returns REJECT for a hard-no variant without calling LLM", async () => {
    // Generate enough variants to likely find a hard-no
    const variants = generateScenarioVariants(500);
    const hardNoVariant = variants.find(v => v.hasHardNo);
    if (!hardNoVariant) {
      console.warn("No hard-no variant found in 500 samples — skipping");
      return;
    }
    const brief = buildScenarioBrief("A deal with sanctions exposure.", hardNoVariant);
    let llmCalled = false;
    const mockLLM = async () => { llmCalled = true; return { choices: [{ message: { content: "{}" } }] }; };
    const result = await evaluateScenario(hardNoVariant, brief, mockLLM as any);
    expect(result.decision).toBe("REJECT");
    expect(result.hasHardNo).toBe(true);
    expect(llmCalled).toBe(false); // Hard-no should NOT call LLM
  });

  it("returns APPROVE for a low-stress variant (delta >= -0.15)", async () => {
    const variants = generateScenarioVariants(100);
    const lowStress = variants.find(v => !v.hasHardNo && v.totalApprovalDelta >= -0.15);
    if (!lowStress) return; // Skip if none found in this random batch
    const brief = buildScenarioBrief("Strong deal.", lowStress);
    const mockLLM = async () => ({ choices: [{ message: { content: "{}" } }] });
    const result = await evaluateScenario(lowStress, brief, mockLLM as any);
    expect(result.decision).toBe("APPROVE");
  });
});

// ── Aggregation Layer Tests ───────────────────────────────────────────────────

// Mock results matching ScenarioEvalResult interface
// Note: categories use short form ("financial") not "category_financial"
const MOCK_SCENARIO_RESULTS: import("./scenarioMutationEngine").ScenarioEvalResult[] = [
  {
    index: 0, decision: "APPROVE",      confidenceScore: 0.80, dominantRiskCategory: "financial" as any,
    topBlockers: [],                    topMitigants: ["Strong ARR"],
    escalationTriggers: [],             governanceConcerns: [],
    hasHardNo: false,                   approvalDelta: -0.05,
    stressedCategories: ["financial" as any],
    provenance: { seed: 1, correlationGroupsActivated: [], hardNoTriggers: [] },
  },
  {
    index: 1, decision: "APPROVE",      confidenceScore: 0.75, dominantRiskCategory: "market" as any,
    topBlockers: [],                    topMitigants: ["Market fit"],
    escalationTriggers: [],             governanceConcerns: [],
    hasHardNo: false,                   approvalDelta: -0.10,
    stressedCategories: ["market" as any],
    provenance: { seed: 2, correlationGroupsActivated: [], hardNoTriggers: [] },
  },
  {
    index: 2, decision: "CONDITIONAL",  confidenceScore: 0.60, dominantRiskCategory: "regulatory" as any,
    topBlockers: ["License pending"],   topMitigants: [],
    escalationTriggers: [],             governanceConcerns: [],
    hasHardNo: false,                   approvalDelta: -0.30,
    stressedCategories: ["regulatory" as any],
    provenance: { seed: 3, correlationGroupsActivated: [], hardNoTriggers: [] },
  },
  {
    index: 3, decision: "REJECT",       confidenceScore: 0.35, dominantRiskCategory: "execution" as any,
    topBlockers: ["Team gap"],          topMitigants: [],
    escalationTriggers: ["Escalate"],   governanceConcerns: [],
    hasHardNo: false,                   approvalDelta: -0.60,
    stressedCategories: ["execution" as any],
    provenance: { seed: 4, correlationGroupsActivated: [], hardNoTriggers: [] },
  },
  {
    index: 4, decision: "REJECT",       confidenceScore: 0.25, dominantRiskCategory: "governance" as any,
    topBlockers: ["Compliance issue"],  topMitigants: [],
    escalationTriggers: [],             governanceConcerns: ["Audit"],
    hasHardNo: true,                    approvalDelta: -0.90,
    stressedCategories: ["governance" as any],
    provenance: { seed: 5, correlationGroupsActivated: [], hardNoTriggers: ["compliance_violation"] },
  },
];

describe("aggregateSimulationResults", () => {
  it("computes correct decision distribution percentages", () => {
    const agg = aggregateSimulationResults(MOCK_SCENARIO_RESULTS as any);
    expect(agg.decisionDistribution).not.toBeNull();
    expect(agg.decisionDistribution!.totalScenarios).toBe(5);
    expect(agg.decisionDistribution!.approveCount).toBe(2);
    expect(agg.decisionDistribution!.conditionalCount).toBe(1);
    expect(agg.decisionDistribution!.rejectCount).toBe(2);
    expect(agg.decisionDistribution!.approvePct).toBe(40);
    expect(agg.decisionDistribution!.conditionalPct).toBe(20);
    expect(agg.decisionDistribution!.rejectPct).toBe(40);
    // Hard-no count
    expect(agg.decisionDistribution!.hardNoCount).toBe(1);
  });

  it("returns failure vectors sorted by rejection contribution", () => {
    const agg = aggregateSimulationResults(MOCK_SCENARIO_RESULTS as any);
    expect(Array.isArray(agg.failureVectors)).toBe(true);
    expect(agg.failureVectors!.length).toBeGreaterThan(0);
    // First vector should have highest rejection contribution
    if (agg.failureVectors!.length >= 2) {
      expect(agg.failureVectors![0].rejectionContributionPct).toBeGreaterThanOrEqual(
        agg.failureVectors![1].rejectionContributionPct
      );
    }
  });

  it("returns approval pathways", () => {
    const agg = aggregateSimulationResults(MOCK_SCENARIO_RESULTS as any);
    expect(Array.isArray(agg.approvalPathways)).toBe(true);
    expect(agg.approvalPathways!.length).toBeGreaterThan(0);
    // Pathways should be ranked
    for (const p of agg.approvalPathways!) {
      expect(p.rank).toBeGreaterThan(0);
      expect(p.estimatedApprovalPct).toBeGreaterThanOrEqual(0);
      expect(p.estimatedApprovalPct).toBeLessThanOrEqual(100);
    }
  });

  it("returns governance heatmap with all 6 categories", () => {
    const agg = aggregateSimulationResults(MOCK_SCENARIO_RESULTS as any);
    expect(Array.isArray(agg.governanceHeatmap)).toBe(true);
    // The aggregator uses short category names: "financial", "governance", etc.
    const categories = new Set(agg.governanceHeatmap!.map(c => c.category));
    expect(categories.has("financial")).toBe(true);
    expect(categories.has("governance")).toBe(true);
    expect(categories.has("regulatory")).toBe(true);
    expect(categories.has("execution")).toBe(true);
    expect(categories.has("market")).toBe(true);
    expect(categories.has("technology")).toBe(true);
  });

  it("returns sensitivity surface sorted by impact score descending", () => {
    const agg = aggregateSimulationResults(MOCK_SCENARIO_RESULTS as any);
    expect(Array.isArray(agg.sensitivitySurface)).toBe(true);
    if (agg.sensitivitySurface!.length >= 2) {
      expect(agg.sensitivitySurface![0].impactScore).toBeGreaterThanOrEqual(
        agg.sensitivitySurface![1].impactScore
      );
    }
  });

  it("generates an executive summary string", () => {
    const agg = aggregateSimulationResults(MOCK_SCENARIO_RESULTS as any);
    expect(typeof agg.executiveSummary).toBe("string");
    expect(agg.executiveSummary!.length).toBeGreaterThan(20);
  });

  it("throws on empty results (by design)", () => {
    expect(() => aggregateSimulationResults([])).toThrow();
  });
});
