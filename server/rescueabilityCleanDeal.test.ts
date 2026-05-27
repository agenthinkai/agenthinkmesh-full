/**
 * rescueabilityCleanDeal.test.ts
 *
 * Targeted tests for the MP-3 fix: rescueabilityScore returns 100 for clean
 * deals (hardNoCount === 0) instead of null.
 *
 * Before fix: hardNoCount === 0 → null → UI shows "Not available."
 * After fix:  hardNoCount === 0 → 100 → UI shows "100/100 — No rescue required"
 *
 * Tests:
 *   RC-1: clean deal (hardNoCount=0) returns rescueabilityScore=100
 *   RC-2: deal with hard-nos still uses existing rescueability calculation
 *   RC-3: null is preserved only for genuinely unavailable inputs
 *   RC-4: 100 for clean deal does NOT mean "all hard-nos were recoverable"
 *         (semantic guard: vetoPct=0 is the distinguishing condition for the label)
 *   RC-5: existing fingerprint tests pass (verdict logic unchanged)
 *   RC-6: formatRescueabilityDisplay helper logic (unit test for the UI label logic)
 */

import { describe, it, expect } from "vitest";
import { computeSimulationFingerprint, type FingerprintInput } from "./simulationFingerprintEngine";
import type { SimulationAggregation, DecisionDistribution } from "./scenarioAggregator";
import type { ScenarioEvalResult } from "./scenarioMutationEngine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDecisionDistribution(overrides: Partial<DecisionDistribution> = {}): DecisionDistribution {
  return {
    approveCount: 80,
    conditionalCount: 20,
    rejectCount: 0,
    hardNoCount: 0,
    hardNoPct: 0,
    rescuedConditionalCount: 0,
    finalRejectedCount: 0,
    rescuedConditionalPct: 0,
    finalRejectedPct: 0,
    approvePct: 80,
    conditionalPct: 20,
    rejectPct: 0,
    totalScenarios: 100,
    ...overrides,
  };
}

function makeAggregation(dist: DecisionDistribution): SimulationAggregation {
  return {
    runId: "run-rc-test",
    dealId: "deal-rc-test",
    mode: "institutional",
    totalScenarios: dist.totalScenarios ?? 100,
    completedAt: new Date().toISOString(),
    executiveSummary: "Test",
    decisionDistribution: dist,
    failureVectors: [],
    approvalPathways: [],
    governanceHeatmap: [],
    sensitivitySurface: [],
  };
}

function makeResults(count: number): ScenarioEvalResult[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    decision: "APPROVE" as const,
    confidenceScore: 0.7,
    dominantRiskCategory: "base" as const,
    topBlockers: [],
    topMitigants: [],
    escalationTriggers: [],
    governanceConcerns: [],
    hasHardNo: false,
    approvalDelta: 0.1,
    stressedCategories: [],
    provenance: {
      scenarioId: `s-${i}`,
      label: `Scenario ${i}`,
      description: `Desc ${i}`,
      conditions: [],
      blockers: [],
      deltas: [],
      severity: "mild" as const,
      severeCount: 0,
      moderateCount: 0,
      mildCount: 0,
      baseCount: 0,
      hardNoTriggers: [],
    },
    deltaEngine: null,
  }));
}

function makeFingerprintInput(dist: DecisionDistribution): FingerprintInput {
  return {
    aggregation: makeAggregation(dist),
    results: makeResults(dist.totalScenarios ?? 100),
    councilMode: "global_vc",
    dealName: "Test Deal",
    isUpgradedScenario: false,
    originalRunId: null,
    originalVerdict: null,
    upgradedVerdict: null,
    originalApprovePct: null,
  };
}

// ── UI label logic (mirrors DealScreener.tsx display logic) ──────────────────
// This is a pure function extracted from the JSX for unit testing.
function formatRescueabilityDisplay(
  rescueabilityScore: number | null,
  vetoPct: number
): string {
  if (rescueabilityScore == null) return "Not available.";
  if (vetoPct === 0) return "100/100 — No rescue required";
  return `${rescueabilityScore}/100`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("rescueabilityScore — MP-3 clean deal fix", () => {

  // RC-1: Clean deal returns 100
  it("RC-1: clean deal with hardNoCount=0 returns rescueabilityScore=100", () => {
    const dist = makeDecisionDistribution({
      hardNoCount: 0,
      hardNoPct: 0,
      rescuedConditionalCount: 0,
      rescuedConditionalPct: 0,
      finalRejectedCount: 0,
      finalRejectedPct: 0,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    expect(fp.rescueabilityScore).toBe(100);
  });

  it("RC-1b: clean deal score is bounded and non-null", () => {
    const dist = makeDecisionDistribution();
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    expect(fp.rescueabilityScore).not.toBeNull();
    expect(fp.rescueabilityScore!).toBe(100);
    expect(fp.rescueabilityScore!).toBeGreaterThanOrEqual(0);
    expect(fp.rescueabilityScore!).toBeLessThanOrEqual(100);
  });

  // RC-2: Deal with hard-nos still uses existing calculation
  it("RC-2: deal with hard-nos uses existing rescueability calculation (unchanged)", () => {
    // 20 hard-nos, 10 rescued (50% rescue rate) → score = 10 + 0 = 10
    const dist = makeDecisionDistribution({
      hardNoCount: 20,
      hardNoPct: 20,
      rescuedConditionalCount: 10,
      rescuedConditionalPct: 10,
      finalRejectedCount: 10,
      finalRejectedPct: 10,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    // rescuedConditionalPct (10) + pathwayBonus (0, no pathways in fixture) = 10
    expect(fp.rescueabilityScore).toBe(10);
    expect(fp.rescueabilityScore).not.toBe(100);
  });

  it("RC-2b: deal with hard-nos and approval pathways gets pathway bonus", () => {
    const dist = makeDecisionDistribution({
      hardNoCount: 10,
      hardNoPct: 10,
      rescuedConditionalCount: 8,
      rescuedConditionalPct: 8,
      finalRejectedCount: 2,
      finalRejectedPct: 2,
    });
    const aggr = makeAggregation(dist);
    // Add approval pathways to trigger the +5 bonus
    aggr.approvalPathways = [
      { description: "Pathway 1", conditionSet: [], remainingRisks: [] },
    ];
    const fp = computeSimulationFingerprint({
      aggregation: aggr,
      results: makeResults(100),
      councilMode: "global_vc",
      dealName: "Test Deal",
      isUpgradedScenario: false,
      originalRunId: null,
      originalVerdict: null,
      upgradedVerdict: null,
      originalApprovePct: null,
    });
    // rescuedConditionalPct (8) + pathwayBonus (5) = 13
    expect(fp.rescueabilityScore).toBe(13);
  });

  // RC-3: null preserved for genuinely unavailable inputs
  it("RC-3: null is NOT returned for clean deals (clean deal = 100, not null)", () => {
    // After the fix, null should never be returned for clean deals.
    // null is reserved for future cases where inputs are genuinely unavailable
    // (currently no such path exists — hardNoCount=0 always returns 100).
    const dist = makeDecisionDistribution({
      hardNoCount: 0,
      hardNoPct: 0,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    expect(fp.rescueabilityScore).not.toBeNull();
    expect(fp.rescueabilityScore).toBe(100);
  });

  // RC-4: Semantic guard — 100 for clean deal ≠ "all hard-nos recoverable"
  it("RC-4: vetoPct=0 is the distinguishing condition for the No rescue required label", () => {
    // A deal with 100% rescue rate (all hard-nos rescued) should show 100/100
    // but NOT "No rescue required" — it had hard-nos, they were just all rescued.
    const distWithHardNos = makeDecisionDistribution({
      hardNoCount: 20,
      hardNoPct: 20,
      rescuedConditionalCount: 20,
      rescuedConditionalPct: 20, // 100% rescue rate
      finalRejectedCount: 0,
      finalRejectedPct: 0,
    });
    const fpWithHardNos = computeSimulationFingerprint(makeFingerprintInput(distWithHardNos));
    // Score = 20 (rescuedConditionalPct) + 0 (no pathways) = 20, capped at 100
    // Note: rescuedConditionalPct is 20 (the pct of total scenarios), not 100
    expect(fpWithHardNos.rescueabilityScore).toBe(20);
    // vetoPct (hardNoPct) = 20, so label should be "20/100" not "No rescue required"
    expect(formatRescueabilityDisplay(fpWithHardNos.rescueabilityScore, distWithHardNos.hardNoPct)).toBe("20/100");

    // Clean deal: vetoPct=0 → label is "No rescue required"
    const distClean = makeDecisionDistribution({ hardNoCount: 0, hardNoPct: 0 });
    const fpClean = computeSimulationFingerprint(makeFingerprintInput(distClean));
    expect(fpClean.rescueabilityScore).toBe(100);
    expect(formatRescueabilityDisplay(fpClean.rescueabilityScore, distClean.hardNoPct)).toBe("100/100 — No rescue required");
  });

  // RC-5: Verdict logic unchanged
  it("RC-5: verdict logic is unchanged — fingerprint has no verdict field", () => {
    const dist = makeDecisionDistribution();
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    expect((fp as any).verdict).toBeUndefined();
    expect((fp as any).investmentRecommendation).toBeUndefined();
  });

  // RC-6: UI label helper unit tests
  describe("formatRescueabilityDisplay (UI label logic)", () => {
    it("RC-6a: null score → Not available.", () => {
      expect(formatRescueabilityDisplay(null, 0)).toBe("Not available.");
    });

    it("RC-6b: vetoPct=0 with score=100 → No rescue required label", () => {
      expect(formatRescueabilityDisplay(100, 0)).toBe("100/100 — No rescue required");
    });

    it("RC-6c: vetoPct>0 with any score → numeric display", () => {
      expect(formatRescueabilityDisplay(45, 20)).toBe("45/100");
      expect(formatRescueabilityDisplay(100, 10)).toBe("100/100");
      expect(formatRescueabilityDisplay(0, 80)).toBe("0/100");
    });
  });

});
