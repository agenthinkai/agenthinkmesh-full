/**
 * normalizeStressTestReportInput.test.ts
 *
 * Tests for the normalizeStressTestReportInput function.
 *
 * Covers:
 *   1.  export works with 0.0% approve rate (all rejected)
 *   2.  export works when approvePct is the string "0.0%"
 *   3.  export works when optional numeric fields are missing
 *   4.  export works for 10,000 deep mode
 *   5.  export logs full path on validation failure (logValidationError)
 *   6.  export never crashes on partial aggregation
 *   7.  aggregator FailureVector shape is mapped to PDF builder shape
 *   8.  aggregator ApprovalPathway shape is mapped to PDF builder shape
 *   9.  aggregator SensitivityEntry shape is mapped to PDF builder shape
 *  10.  aggregator GovernanceHeatmapCell shape is mapped to PDF builder shape
 *  11.  decisionDistribution with hardNoPct maps to vetoPct
 *  12.  completedAt Date object is coerced to ISO string
 *  13.  NaN and Infinity values are clamped to 0
 *  14.  impactScore 0–100 is normalised to 0–1 for PDF builder
 *  15.  impactScore already 0–1 is preserved
 *  16.  sensitivityEntry direction is derived from avgDeltaWhenStressed
 */

import { describe, it, expect, vi } from "vitest";
import { normalizeStressTestReportInput, logValidationError } from "./normalizeStressTestReportInput";

// ── Aggregator-shape helpers ──────────────────────────────────────────────────

function makeAggregatorDecisionDistribution(overrides: Record<string, unknown> = {}) {
  return {
    approveCount:     0,
    conditionalCount: 500,
    rejectCount:      9500,
    approvePct:       0.0,
    conditionalPct:   5.0,
    rejectPct:        95.0,
    totalScenarios:   10000,
    hardNoCount:      800,
    hardNoPct:        8.0,
    ...overrides,
  };
}

function makeAggregatorFailureVector(overrides: Record<string, unknown> = {}) {
  return {
    dimensionKey:              "category_financial",
    dimensionLabel:            "Financial Stress",
    category:                  "financial",
    rejectionCount:            8500,
    rejectionContributionPct:  89.5,
    avgApprovalDelta:          -0.72,
    escalationTriggerCount:    320,
    ...overrides,
  };
}

function makeAggregatorApprovalPathway(overrides: Record<string, unknown> = {}) {
  return {
    rank:                1,
    description:         "Financial assumptions hold + Execution delivers on plan",
    safeDimensions:      ["capex_inflation", "ebitda_compression"],
    estimatedApprovalPct: 12.5,
    scenarioCount:       1250,
    ...overrides,
  };
}

function makeAggregatorSensitivityEntry(overrides: Record<string, unknown> = {}) {
  return {
    rank:                 1,
    dimensionKey:         "category_financial",
    dimensionLabel:       "Financial Stress",
    category:             "financial",
    avgDeltaWhenStressed: -0.45,
    tippingPointSeverity: "moderate",
    interactionScore:     0.62,
    impactScore:          87,   // 0–100 scale
    ...overrides,
  };
}

function makeAggregatorGovernanceCell(overrides: Record<string, unknown> = {}) {
  return {
    category:                  "financial",
    escalationCount:           720,
    vetoCount:                 85,
    complianceCount:           0,
    regulatoryFragilityScore:  68,  // 0–100 scale
    totalScenarios:            9500,
    escalationPct:             7.6,
    ...overrides,
  };
}

function makeRawInput(overrides: Record<string, unknown> = {}) {
  return {
    dealName:    "TestCo Deep Mode",
    baseVerdict: "REJECTED",
    mode:        "deep",
    targetCount: 10000,
    completedAt: "2026-05-24T10:00:00.000Z",
    executiveSummary: "Deep stress test with 10,000 scenarios.",
    decisionDistribution: makeAggregatorDecisionDistribution(),
    failureVectors:    [makeAggregatorFailureVector()],
    approvalPathways:  [makeAggregatorApprovalPathway()],
    sensitivitySurface: [makeAggregatorSensitivityEntry()],
    governanceHeatmap: [makeAggregatorGovernanceCell()],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("normalizeStressTestReportInput", () => {

  // ── Test 1: 0.0% approve rate ──────────────────────────────────────────────

  it("1. normalizes 0.0% approve rate correctly", () => {
    const result = normalizeStressTestReportInput(makeRawInput());
    expect(result.decisionDistribution.approvePct).toBe(0.0);
    expect(result.decisionDistribution.rejectPct).toBe(95.0);
    expect(result.decisionDistribution.totalScenarios).toBe(10000);
  });

  // ── Test 2: approvePct as string "0.0%" ────────────────────────────────────

  it("2. normalizes approvePct when it is the string '0.0%'", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      decisionDistribution: {
        ...makeAggregatorDecisionDistribution(),
        approvePct: "0.0%",
        conditionalPct: "5.0%",
        rejectPct: "95.0%",
        hardNoPct: "8.0%",
      },
    }));
    expect(result.decisionDistribution.approvePct).toBe(0.0);
    expect(result.decisionDistribution.conditionalPct).toBe(5.0);
    expect(result.decisionDistribution.rejectPct).toBe(95.0);
  });

  // ── Test 3: missing optional numeric fields ────────────────────────────────

  it("3. handles missing optional numeric fields gracefully", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      decisionDistribution: {
        approvePct: 0,
        conditionalPct: 5,
        rejectPct: 95,
        // vetoPct, totalScenarios, hardNoPct all missing
      },
      failureVectors: [],
      approvalPathways: [],
      sensitivitySurface: [],
      governanceHeatmap: [],
    }));
    expect(result.decisionDistribution.approvePct).toBe(0);
    expect(result.decisionDistribution.vetoPct).toBe(0);
    expect(result.decisionDistribution.totalScenarios).toBeGreaterThanOrEqual(1);
    expect(result.failureVectors).toEqual([]);
    expect(result.approvalPathways).toEqual([]);
    expect(result.sensitivitySurface).toEqual([]);
    expect(result.governanceHeatmap).toEqual([]);
  });

  // ── Test 4: 10,000 deep mode ───────────────────────────────────────────────

  it("4. normalizes 10,000 deep mode correctly", () => {
    const result = normalizeStressTestReportInput(makeRawInput());
    expect(result.mode).toBe("deep");
    expect(result.targetCount).toBe(10000);
    expect(result.decisionDistribution.totalScenarios).toBe(10000);
  });

  // ── Test 5: logValidationError logs full path ──────────────────────────────

  it("5. logValidationError logs the full path for each issue", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logValidationError("test context", [
      { path: ["decisionDistribution", "approvePct"], expected: "number", received: "string", code: "invalid_type", message: "Expected number, received string" },
      { path: ["failureVectors", 0, "frequency"], expected: "number", received: "undefined", code: "invalid_type", message: "Required" },
    ]);
    expect(consoleSpy).toHaveBeenCalledTimes(3); // 1 header + 2 issues
    const calls = consoleSpy.mock.calls.map(c => c[0] as string);
    expect(calls[1]).toContain("decisionDistribution → approvePct");
    expect(calls[2]).toContain("failureVectors → 0 → frequency");
    consoleSpy.mockRestore();
  });

  // ── Test 6: never crashes on partial aggregation ───────────────────────────

  it("6. never crashes on partial aggregation (empty/null fields)", () => {
    expect(() => normalizeStressTestReportInput({
      dealName: "Partial Deal",
      baseVerdict: "UNKNOWN",
      mode: "quick",
      targetCount: 100,
      completedAt: "2026-05-24T10:00:00.000Z",
      executiveSummary: null,
      decisionDistribution: { approvePct: 0, conditionalPct: 0, rejectPct: 100 },
      failureVectors: null,
      approvalPathways: null,
      sensitivitySurface: null,
      governanceHeatmap: null,
    })).not.toThrow();
  });

  // ── Test 7: aggregator FailureVector → PDF builder shape ──────────────────

  it("7. maps aggregator FailureVector fields to PDF builder shape", () => {
    const result = normalizeStressTestReportInput(makeRawInput());
    const fv = result.failureVectors[0];
    expect(fv.category).toBe("financial");          // from fv.category (same)
    expect(fv.frequency).toBe(8500);                // from rejectionCount
    expect(fv.affectedPct).toBe(89.5);              // from rejectionContributionPct
    expect(fv.avgSeverity).toBeCloseTo(0.72, 2);    // from abs(avgApprovalDelta)
    expect(fv.examplePattern).toBeUndefined();
  });

  it("7b. uses dimensionLabel as category when category field is missing", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      failureVectors: [{ dimensionLabel: "Market Stress", rejectionCount: 100, rejectionContributionPct: 10, avgApprovalDelta: -0.3 }],
    }));
    expect(result.failureVectors[0].category).toBe("Market Stress");
  });

  // ── Test 8: aggregator ApprovalPathway → PDF builder shape ────────────────

  it("8. maps aggregator ApprovalPathway fields to PDF builder shape", () => {
    const result = normalizeStressTestReportInput(makeRawInput());
    const ap = result.approvalPathways[0];
    expect(ap.approvalProbability).toBe(12.5);      // from estimatedApprovalPct
    expect(ap.confidenceLift).toBe(0);              // default (not in aggregator)
    expect(Array.isArray(ap.conditionSet)).toBe(true);
    expect(ap.conditionSet.length).toBeGreaterThan(0);
    // description should be in conditionSet
    expect(ap.conditionSet[0]).toContain("Financial assumptions hold");
    expect(Array.isArray(ap.remainingRisks)).toBe(true);
  });

  // ── Test 9: aggregator SensitivityEntry → PDF builder shape ───────────────

  it("9. maps aggregator SensitivityEntry fields to PDF builder shape", () => {
    const result = normalizeStressTestReportInput(makeRawInput());
    const sv = result.sensitivitySurface[0];
    expect(sv.variable).toBe("Financial Stress");   // from dimensionLabel
    expect(sv.impactScore).toBeCloseTo(0.87, 2);    // 87 / 100
    expect(sv.direction).toBe("negative");           // from avgDeltaWhenStressed < 0
  });

  it("9b. impactScore already 0–1 is preserved", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      sensitivitySurface: [{ ...makeAggregatorSensitivityEntry(), impactScore: 0.87 }],
    }));
    expect(result.sensitivitySurface[0].impactScore).toBeCloseTo(0.87, 2);
  });

  it("9c. direction 'positive' when avgDeltaWhenStressed >= 0", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      sensitivitySurface: [{ ...makeAggregatorSensitivityEntry(), avgDeltaWhenStressed: 0.1, impactScore: 30 }],
    }));
    expect(result.sensitivitySurface[0].direction).toBe("positive");
  });

  // ── Test 10: aggregator GovernanceHeatmapCell → PDF builder shape ──────────

  it("10. maps aggregator GovernanceHeatmapCell fields to PDF builder shape", () => {
    const result = normalizeStressTestReportInput(makeRawInput());
    const gh = result.governanceHeatmap[0];
    expect(gh.category).toBe("financial");
    expect(gh.escalationCount).toBe(720);
    expect(gh.vetoCount).toBe(85);
    expect(gh.avgSeverity).toBeCloseTo(0.68, 2);    // 68 / 100
  });

  // ── Test 11: hardNoPct maps to vetoPct ────────────────────────────────────

  it("11. hardNoPct from aggregator is used as vetoPct when vetoPct is missing", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      decisionDistribution: {
        approvePct: 0,
        conditionalPct: 5,
        rejectPct: 87,
        hardNoPct: 8,
        totalScenarios: 10000,
        // vetoPct intentionally missing
      },
    }));
    expect(result.decisionDistribution.vetoPct).toBe(8);
  });

  // ── Test 12: completedAt Date object ──────────────────────────────────────

  it("12. completedAt Date object is coerced to ISO string", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      completedAt: new Date("2026-05-24T10:00:00.000Z"),
    }));
    expect(result.completedAt).toBe("2026-05-24T10:00:00.000Z");
  });

  // ── Test 13: NaN and Infinity values ──────────────────────────────────────

  it("13. NaN and Infinity values in numeric fields are clamped to 0", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      decisionDistribution: {
        approvePct: NaN,
        conditionalPct: Infinity,
        rejectPct: -Infinity,
        totalScenarios: NaN,
      },
    }));
    expect(result.decisionDistribution.approvePct).toBe(0);
    expect(result.decisionDistribution.conditionalPct).toBe(0);
    expect(result.decisionDistribution.rejectPct).toBe(0);
    expect(result.decisionDistribution.totalScenarios).toBeGreaterThanOrEqual(1);
  });

  // ── Test 14: impactScore 0–100 normalised to 0–1 ─────────────────────────

  it("14. impactScore 0–100 is normalised to 0–1 for PDF builder", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      sensitivitySurface: [{ dimensionLabel: "Financial Stress", impactScore: 100, avgDeltaWhenStressed: -0.5 }],
    }));
    expect(result.sensitivitySurface[0].impactScore).toBeCloseTo(1.0, 2);
  });

  // ── Test 15: impactScore already 0–1 is preserved ────────────────────────

  it("15. impactScore already 0–1 is preserved without double-normalisation", () => {
    const result = normalizeStressTestReportInput(makeRawInput({
      sensitivitySurface: [{ dimensionLabel: "Financial Stress", impactScore: 0.5, avgDeltaWhenStressed: -0.3 }],
    }));
    expect(result.sensitivitySurface[0].impactScore).toBeCloseTo(0.5, 2);
  });

  // ── Test 16: direction derived from avgDeltaWhenStressed ─────────────────

  it("16. direction is derived from avgDeltaWhenStressed when not present", () => {
    const negResult = normalizeStressTestReportInput(makeRawInput({
      sensitivitySurface: [{ dimensionLabel: "X", impactScore: 50, avgDeltaWhenStressed: -0.3 }],
    }));
    expect(negResult.sensitivitySurface[0].direction).toBe("negative");

    const posResult = normalizeStressTestReportInput(makeRawInput({
      sensitivitySurface: [{ dimensionLabel: "X", impactScore: 50, avgDeltaWhenStressed: 0.1 }],
    }));
    expect(posResult.sensitivitySurface[0].direction).toBe("positive");
  });

  // ── Bonus: already-normalized PDF-builder shape passes through unchanged ──

  it("bonus: already-normalized PDF-builder shape passes through correctly", () => {
    const pdfShape = {
      dealName:    "AlreadyNormalized",
      baseVerdict: "APPROVED",
      mode:        "institutional",
      targetCount: 1000,
      completedAt: "2026-05-24T10:00:00.000Z",
      executiveSummary: "Already normalized.",
      decisionDistribution: {
        approvePct: 62.5, conditionalPct: 22.3, rejectPct: 12.1, vetoPct: 3.1, totalScenarios: 1000,
      },
      failureVectors: [{ category: "capital_stress", frequency: 120, avgSeverity: 0.72, affectedPct: 12.0 }],
      approvalPathways: [{ conditionSet: ["Secure bridge financing"], approvalProbability: 78.0, confidenceLift: 15.5, remainingRisks: [] }],
      sensitivitySurface: [{ variable: "capex_overrun", impactScore: 0.42, direction: "negative" }],
      governanceHeatmap: [{ category: "financial_governance", escalationCount: 95, vetoCount: 12, avgSeverity: 0.68 }],
    };
    const result = normalizeStressTestReportInput(pdfShape);
    expect(result.decisionDistribution.approvePct).toBe(62.5);
    expect(result.failureVectors[0].frequency).toBe(120);
    expect(result.failureVectors[0].avgSeverity).toBeCloseTo(0.72, 2);
    expect(result.approvalPathways[0].approvalProbability).toBe(78.0);
    expect(result.approvalPathways[0].conditionSet[0]).toBe("Secure bridge financing");
    expect(result.sensitivitySurface[0].impactScore).toBeCloseTo(0.42, 2);
    expect(result.governanceHeatmap[0].avgSeverity).toBeCloseTo(0.68, 2);
  });
});
