/**
 * structuralFragility.test.ts
 *
 * Targeted tests for the MP-2 fix: structuralFragilityScore no longer
 * double-counts finalRejectedPct and hardNoPct.
 *
 * Old formula (BROKEN):
 *   finalRejectedPct + hardNoPct + attributionUnavailablePct
 *   → double-counts because finalRejectedPct ⊆ hardNoPct
 *
 * New formula (CORRECT — v2):
 *   finalRejectedPct
 *   + 0.5 * rescuedConditionalPct
 *   + 0.5 * attributionUnavailablePct
 *
 * Invariant: finalRejectedPct + rescuedConditionalPct = hardNoPct
 * (they are mutually exclusive, non-overlapping subsets of hardNoPct)
 *
 * Tests:
 *   SF-1: no double-counting — old formula would produce higher score
 *   SF-2: score bounded 0–100 in all cases
 *   SF-3: all-reject/all-veto case produces high fragility but not inflated
 *   SF-4: mixed approve/conditional/reject produces lower fragility
 *   SF-5: existing fingerprint tests still pass (RI-4, RI-8 equivalents)
 */

import { describe, it, expect } from "vitest";
import { computeSimulationFingerprint, type FingerprintInput } from "./simulationFingerprintEngine";
import type { SimulationAggregation, DecisionDistribution } from "./scenarioAggregator";
import type { ScenarioEvalResult } from "./scenarioMutationEngine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDecisionDistribution(overrides: Partial<DecisionDistribution> = {}): DecisionDistribution {
  return {
    approveCount: 60,
    conditionalCount: 20,
    rejectCount: 20,
    hardNoCount: 10,
    hardNoPct: 10,
    rescuedConditionalCount: 5,
    finalRejectedCount: 5,
    rescuedConditionalPct: 5,
    finalRejectedPct: 5,
    approvePct: 60,
    conditionalPct: 20,
    rejectPct: 20,
    totalScenarios: 100,
    ...overrides,
  };
}

function makeAggregation(dist: DecisionDistribution): SimulationAggregation {
  return {
    runId: "run-sf-test",
    dealId: "deal-sf-test",
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

function makeResults(count: number, hasHardNo = false): ScenarioEvalResult[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    decision: "APPROVE" as const,
    confidenceScore: 0.7,
    dominantRiskCategory: "base" as const,
    topBlockers: [],
    topMitigants: [],
    escalationTriggers: [],
    governanceConcerns: [],
    hasHardNo,
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

// ── SF-1: No double-counting ──────────────────────────────────────────────────

describe("structuralFragilityScore — MP-2 fix", () => {

  it("SF-1: new formula does not double-count finalRejectedPct and hardNoPct", () => {
    // Scenario: 10 hard-nos, 5 rescued, 5 final-rejected
    // hardNoPct = 10, rescuedConditionalPct = 5, finalRejectedPct = 5
    // attributionUnavailablePct ≈ 0 (no ATTRIBUTION_UNAVAILABLE in results)
    //
    // OLD formula (broken): 5 + 10 + 0 = 15 (double-counts 5pp)
    // NEW formula (correct): 5 + 0.5*5 + 0.5*0 = 7.5
    const dist = makeDecisionDistribution({
      hardNoCount: 10,
      hardNoPct: 10,
      rescuedConditionalCount: 5,
      rescuedConditionalPct: 5,
      finalRejectedCount: 5,
      finalRejectedPct: 5,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));

    expect(fp.structuralFragilityScore).not.toBeNull();
    // New formula: 5 + 0.5*5 = 7.5
    expect(fp.structuralFragilityScore).toBeCloseTo(7.5, 1);
    // Old formula would have been 15 — verify we are lower
    expect(fp.structuralFragilityScore!).toBeLessThan(15);
  });

  it("SF-1b: invariant — finalRejectedPct + rescuedConditionalPct = hardNoPct (no overlap)", () => {
    // This invariant is the mathematical basis for the fix.
    // If it holds, the two components are mutually exclusive and non-overlapping.
    const dist = makeDecisionDistribution({
      hardNoCount: 30,
      hardNoPct: 30,
      rescuedConditionalCount: 12,
      rescuedConditionalPct: 12,
      finalRejectedCount: 18,
      finalRejectedPct: 18,
    });
    // Verify the invariant in the fixture
    expect(dist.finalRejectedPct + dist.rescuedConditionalPct).toBe(dist.hardNoPct);

    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    // New formula: 18 + 0.5*12 = 24
    expect(fp.structuralFragilityScore).toBeCloseTo(24, 1);
    // Old formula would have been: 18 + 30 = 48 — verify we are lower
    expect(fp.structuralFragilityScore!).toBeLessThan(48);
  });

  // ── SF-2: Bounded 0–100 ───────────────────────────────────────────────────────

  it("SF-2: score is bounded 0–100 even in extreme cases", () => {
    // All scenarios are final-rejected (100%) with all hard-nos unrescued
    const dist = makeDecisionDistribution({
      approveCount: 0,
      conditionalCount: 0,
      rejectCount: 100,
      hardNoCount: 100,
      hardNoPct: 100,
      rescuedConditionalCount: 0,
      rescuedConditionalPct: 0,
      finalRejectedCount: 100,
      finalRejectedPct: 100,
      approvePct: 0,
      conditionalPct: 0,
      rejectPct: 100,
      totalScenarios: 100,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    expect(fp.structuralFragilityScore).not.toBeNull();
    expect(fp.structuralFragilityScore!).toBeLessThanOrEqual(100);
    expect(fp.structuralFragilityScore!).toBeGreaterThanOrEqual(0);
    // New formula: 100 + 0.5*0 = 100 (capped at 100)
    expect(fp.structuralFragilityScore).toBe(100);
  });

  it("SF-2b: score is 0 when there are no hard-nos and no attribution unavailable", () => {
    // All scenarios approve — no fragility
    const dist = makeDecisionDistribution({
      approveCount: 100,
      conditionalCount: 0,
      rejectCount: 0,
      hardNoCount: 0,
      hardNoPct: 0,
      rescuedConditionalCount: 0,
      rescuedConditionalPct: 0,
      finalRejectedCount: 0,
      finalRejectedPct: 0,
      approvePct: 100,
      conditionalPct: 0,
      rejectPct: 0,
      totalScenarios: 100,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    // New formula: 0 + 0.5*0 + 0.5*0 = 0
    expect(fp.structuralFragilityScore).toBe(0);
  });

  // ── SF-3: All-reject/all-veto case ────────────────────────────────────────────

  it("SF-3: all-reject/all-veto case produces high fragility but not inflated by duplicate counting", () => {
    // 80% hard-no, all unrescued (finalRejectedPct = 80, rescuedConditionalPct = 0)
    const dist = makeDecisionDistribution({
      approveCount: 20,
      conditionalCount: 0,
      rejectCount: 80,
      hardNoCount: 80,
      hardNoPct: 80,
      rescuedConditionalCount: 0,
      rescuedConditionalPct: 0,
      finalRejectedCount: 80,
      finalRejectedPct: 80,
      approvePct: 20,
      conditionalPct: 0,
      rejectPct: 80,
      totalScenarios: 100,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    // New formula: 80 + 0.5*0 = 80
    expect(fp.structuralFragilityScore).toBeCloseTo(80, 1);
    // Old formula would have been: 80 + 80 = 160, capped at 100
    // New formula is 80 — correctly reflects the true fragility without inflation
    expect(fp.structuralFragilityScore!).toBeLessThanOrEqual(100);
    // Should still be high (>= 70) — this is a very fragile deal
    expect(fp.structuralFragilityScore!).toBeGreaterThanOrEqual(70);
  });

  // ── SF-4: Mixed approve/conditional/reject produces lower fragility ────────────

  it("SF-4: mixed approve/conditional/reject case produces lower fragility than all-reject", () => {
    // Healthy deal: 60% approve, 20% conditional, 10% final-rejected, 10% rescued
    const dist = makeDecisionDistribution({
      approveCount: 60,
      conditionalCount: 20,
      rejectCount: 20,
      hardNoCount: 20,
      hardNoPct: 20,
      rescuedConditionalCount: 10,
      rescuedConditionalPct: 10,
      finalRejectedCount: 10,
      finalRejectedPct: 10,
      approvePct: 60,
      conditionalPct: 20,
      rejectPct: 20,
      totalScenarios: 100,
    });
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    // New formula: 10 + 0.5*10 = 15
    expect(fp.structuralFragilityScore).toBeCloseTo(15, 1);

    // Compare to the all-reject case (SF-3): 15 < 80 ✓
    const allRejectDist = makeDecisionDistribution({
      approveCount: 20,
      conditionalCount: 0,
      rejectCount: 80,
      hardNoCount: 80,
      hardNoPct: 80,
      rescuedConditionalCount: 0,
      rescuedConditionalPct: 0,
      finalRejectedCount: 80,
      finalRejectedPct: 80,
      approvePct: 20,
      conditionalPct: 0,
      rejectPct: 80,
      totalScenarios: 100,
    });
    const fpAllReject = computeSimulationFingerprint(makeFingerprintInput(allRejectDist));
    expect(fp.structuralFragilityScore!).toBeLessThan(fpAllReject.structuralFragilityScore!);
  });

  // ── SF-5: Existing fingerprint tests still pass ────────────────────────────────

  it("SF-5: verdict logic is unchanged — fingerprint has no verdict field", () => {
    const dist = makeDecisionDistribution();
    const fp = computeSimulationFingerprint(makeFingerprintInput(dist));
    // Fingerprint is observational only — no verdict field
    expect((fp as any).verdict).toBeUndefined();
    // structuralFragilityScore is present and bounded
    expect(fp.structuralFragilityScore).not.toBeNull();
    expect(fp.structuralFragilityScore!).toBeGreaterThanOrEqual(0);
    expect(fp.structuralFragilityScore!).toBeLessThanOrEqual(100);
  });

  it("SF-5b: rescueabilityScore and resilienceDelta are unaffected by the formula change", () => {
    // The fix only touches structuralFragilityScore — other metrics must be unchanged
    const dist = makeDecisionDistribution({
      hardNoCount: 20,
      hardNoPct: 20,
      rescuedConditionalCount: 10,
      rescuedConditionalPct: 10,
      finalRejectedCount: 10,
      finalRejectedPct: 10,
    });
    const fp = computeSimulationFingerprint({
      aggregation: makeAggregation(dist),
      results: makeResults(100),
      councilMode: "global_vc",
      dealName: "Test Deal",
      isUpgradedScenario: true,
      originalRunId: "run-orig",
      originalVerdict: "REJECTED",
      upgradedVerdict: "APPROVED_WITH_CONDITIONS",
      originalApprovePct: 40,
    });
    // rescueabilityScore: rescuedConditionalPct (10) + pathwayBonus (0) = 10
    expect(fp.rescueabilityScore).toBe(10);
    // resilienceDelta: approvePct (60) - originalApprovePct (40) = 20
    expect(fp.resilienceDelta).toBe(20);
    // upgradeEffectiveness: 20 / (100 - 40) = 20/60 ≈ 0.333
    expect(fp.upgradeEffectiveness).toBeCloseTo(0.333, 2);
  });

});
