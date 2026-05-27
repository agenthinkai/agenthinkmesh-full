/**
 * simulationFingerprint.test.ts
 *
 * Guardrail tests for the Simulation Fingerprint Layer v1.
 *
 * SF-1: Identity fields are propagated correctly
 * SF-2: Decision distribution fields match aggregation
 * SF-3: rescueabilityScore is null when hardNoCount === 0
 * SF-4: councilDisagreementScore is null (dataUnavailable) when all confidenceScores are uniform
 * SF-5: resilienceDelta and upgradeEffectiveness are computed correctly for upgraded scenarios
 * SF-6: attributionUnavailablePct counts only hard-no variants with attributionUnavailable === true
 * SF-7: version is always "1.0"
 */

import { describe, it, expect } from "vitest";
import {
  computeSimulationFingerprint,
  type FingerprintInput,
} from "./simulationFingerprintEngine";
import type { SimulationAggregation, DecisionDistribution } from "./scenarioAggregator";
import type { ScenarioEvalResult } from "./scenarioMutationEngine";
import type { DeltaEngineResult } from "./deltaEngine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDecisionDistribution(overrides: Partial<DecisionDistribution> = {}): DecisionDistribution {
  return {
    approveCount: 5,
    conditionalCount: 3,
    rejectCount: 2,
    hardNoCount: 10,
    hardNoPct: 10,
    rescuedConditionalCount: 2,
    finalRejectedCount: 8,
    rescuedConditionalPct: 2,
    finalRejectedPct: 8,
    approvePct: 5,
    conditionalPct: 3,
    rejectPct: 2,
    totalScenarios: 100,
    ...overrides,
  };
}

function makeAggregation(overrides: Partial<SimulationAggregation> = {}): SimulationAggregation {
  return {
    runId: "run-abc",
    dealId: "deal-123",
    mode: "institutional",
    totalScenarios: 100,
    completedAt: new Date().toISOString(),
    decisionDistribution: makeDecisionDistribution(),
    failureVectors: [
      { dimensionKey: "liq", dimensionLabel: "Liquidity Stress", category: "financial", rejectionCount: 30, rejectionContributionPct: 30, avgApprovalDelta: -0.4, escalationTriggerCount: 5 },
      { dimensionKey: "reg", dimensionLabel: "Regulatory Burden", category: "regulatory", rejectionCount: 20, rejectionContributionPct: 20, avgApprovalDelta: -0.3, escalationTriggerCount: 3 },
    ],
    approvalPathways: [
      { rank: 1, description: "Low liquidity stress + stable regulatory", safeDimensions: ["liq", "reg"], estimatedApprovalPct: 45, scenarioCount: 12 },
    ],
    governanceHeatmap: [],
    sensitivitySurface: [
      { rank: 1, dimensionKey: "liq", dimensionLabel: "Liquidity Stress", category: "financial", avgDeltaWhenStressed: -0.5, tippingPointSeverity: "severe", interactionScore: 0.8, impactScore: 90 },
    ],
    executiveSummary: "Test summary",
    ...overrides,
  } as SimulationAggregation;
}

function makeResult(index: number, overrides: Partial<ScenarioEvalResult> = {}): ScenarioEvalResult {
  return {
    index,
    decision: "REJECT" as const,
    hasHardNo: false,
    approvalDelta: -0.3,
    confidenceScore: 0.92,
    dominantRiskCategory: "financial" as const,
    topBlockers: [],
    topMitigants: [],
    escalationTriggers: [],
    governanceConcerns: [],
    stressedCategories: [],
    provenance: { hardNoTriggers: [], correlationBoosts: [], severeBudgetDrops: [] },
    deltaEngine: null,
    ...overrides,
  };
}

function makeResults(count: number, overrides: Partial<ScenarioEvalResult> = {}): ScenarioEvalResult[] {
  return Array.from({ length: count }, (_, i) => makeResult(i, overrides));
}

function makeDeltaResult(overrides: Partial<DeltaEngineResult> = {}): DeltaEngineResult {
  return {
    rescueStatus: "FINAL_REJECTED" as const,
    rejectionReason: "TERMINAL",
    attributionUnavailable: false,
    triggeringFlags: [],
    rescuableFlags: [],
    terminalFlags: [],
    sensitivityScores: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<FingerprintInput> = {}): FingerprintInput {
  return {
    aggregation: makeAggregation(),
    results: makeResults(100),
    councilMode: "standard",
    dealName: "Test Deal",
    isUpgradedScenario: false,
    originalRunId: null,
    originalVerdict: null,
    upgradedVerdict: null,
    originalApprovePct: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Simulation Fingerprint Engine", () => {

  it("SF-1: identity fields are propagated correctly", () => {
    const fp = computeSimulationFingerprint(makeInput());
    expect(fp.runId).toBe("run-abc");
    expect(fp.dealId).toBe("deal-123");
    expect(fp.simulationMode).toBe("institutional");
    expect(fp.scenarioCount).toBe(100);
    expect(fp.councilMode).toBe("standard");
    expect(fp.sourceDealName).toBe("Test Deal");
  });

  it("SF-2: decision distribution fields match aggregation", () => {
    const dist = makeDecisionDistribution({ approvePct: 12.5, conditionalPct: 7.3, rejectPct: 5.2, hardNoPct: 75 });
    const fp = computeSimulationFingerprint(makeInput({ aggregation: makeAggregation({ decisionDistribution: dist }) }));
    expect(fp.approvePct).toBe(12.5);
    expect(fp.conditionalPct).toBe(7.3);
    expect(fp.rejectPct).toBe(5.2);
    expect(fp.vetoPct).toBe(75); // vetoPct is hardNoPct alias
    expect(fp.rescuedConditionalPct).toBe(dist.rescuedConditionalPct);
    expect(fp.finalRejectedPct).toBe(dist.finalRejectedPct);
  });

  it("SF-3: rescueabilityScore is null when hardNoCount === 0 (no hard-nos to rescue)", () => {
    const dist = makeDecisionDistribution({
      hardNoCount: 0, hardNoPct: 0,
      rescuedConditionalCount: 0, finalRejectedCount: 0,
      rescuedConditionalPct: 0, finalRejectedPct: 0,
    });
    const fp = computeSimulationFingerprint(makeInput({ aggregation: makeAggregation({ decisionDistribution: dist }) }));
    expect(fp.rescueabilityScore).toBeNull();
  });

  it("SF-4: councilDisagreementScore is null (dataUnavailable) when all confidenceScores are uniform", () => {
    // All results have identical confidenceScore (0.92) — std dev = 0 → dataUnavailable
    const results = makeResults(100, { confidenceScore: 0.92 });
    const fp = computeSimulationFingerprint(makeInput({ results }));
    expect(fp.councilDisagreementDataUnavailable).toBe(true);
    expect(fp.councilDisagreementScore).toBeNull();
  });

  it("SF-5: resilienceDelta and upgradeEffectiveness are computed correctly for upgraded scenarios", () => {
    // originalApprovePct = 20, upgraded approvePct = 35 → delta = 15
    // upgradeEffectiveness = 15 / (100 - 20) = 15/80 = 0.1875
    const dist = makeDecisionDistribution({ approvePct: 35 });
    const fp = computeSimulationFingerprint(makeInput({
      aggregation: makeAggregation({ decisionDistribution: dist }),
      isUpgradedScenario: true,
      originalApprovePct: 20,
      originalVerdict: "CONDITIONAL",
      upgradedVerdict: "APPROVED",
      originalRunId: "run-orig",
    }));
    expect(fp.resilienceDelta).toBe(15);
    // upgradeEffectiveness = 15/80 = 0.1875, rounded to 3dp → 0.188
    expect(fp.upgradeEffectiveness).toBeCloseTo(0.188, 2);
    expect(fp.isUpgradedScenario).toBe(true);
    expect(fp.originalRunId).toBe("run-orig");
  });

  it("SF-6: attributionUnavailablePct counts only hard-no variants with attributionUnavailable === true", () => {
    // 100 results: 10 hard-no with attributionUnavailable, 5 hard-no without, 85 non-hard-no
    const results: ScenarioEvalResult[] = [
      ...makeResults(10, {
        hasHardNo: true,
        deltaEngine: makeDeltaResult({ rescueStatus: "FINAL_REJECTED", attributionUnavailable: true }),
      }),
      ...makeResults(5, {
        hasHardNo: true,
        deltaEngine: makeDeltaResult({ rescueStatus: "FINAL_REJECTED", attributionUnavailable: false }),
      }),
      ...makeResults(85, { hasHardNo: false, deltaEngine: null }),
    ];
    const fp = computeSimulationFingerprint(makeInput({ results }));
    // 10/100 = 10%
    expect(fp.attributionUnavailablePct).toBe(10);
  });

  it("SF-7: version is always '1.0'", () => {
    const fp = computeSimulationFingerprint(makeInput());
    expect(fp.version).toBe("1.0");
  });

});
