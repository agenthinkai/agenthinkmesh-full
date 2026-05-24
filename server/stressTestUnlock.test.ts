/**
 * stressTestUnlock.test.ts
 * Tests for the Stress Test Report unlock fix:
 *   1. Report remains locked before simulation
 *   2. Report unlocks after completed simulation (live data)
 *   3. Report unlocks after restored historical simulation
 *   4. Report export uses latest completed run data
 *   5. Report does not show blank body when aggregation exists but some fields missing
 */
import { describe, it, expect } from "vitest";
import { aggregateSimulationResults } from "./scenarioAggregator";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDecisionDistribution(overrides: Partial<{
  approveCount: number; conditionalCount: number; rejectCount: number;
  approvePct: number; conditionalPct: number; rejectPct: number;
  totalScenarios: number; hardNoCount: number; hardNoPct: number;
}> = {}) {
  return {
    approveCount:     overrides.approveCount     ?? 60,
    conditionalCount: overrides.conditionalCount ?? 25,
    rejectCount:      overrides.rejectCount      ?? 15,
    approvePct:       overrides.approvePct       ?? 60,
    conditionalPct:   overrides.conditionalPct   ?? 25,
    rejectPct:        overrides.rejectPct        ?? 15,
    totalScenarios:   overrides.totalScenarios   ?? 100,
    hardNoCount:      overrides.hardNoCount      ?? 5,
    hardNoPct:        overrides.hardNoPct        ?? 5,
  };
}

function makeSimAggregation(overrides: {
  decisionDistribution?: ReturnType<typeof makeDecisionDistribution> | null;
  failureVectors?: any[] | null;
  approvalPathways?: any[] | null;
  governanceHeatmap?: any[] | null;
  sensitivitySurface?: any[] | null;
  executiveSummary?: string | null;
} = {}) {
  return {
    decisionDistribution: overrides.decisionDistribution !== undefined
      ? overrides.decisionDistribution
      : makeDecisionDistribution(),
    failureVectors:    overrides.failureVectors    ?? [],
    approvalPathways:  overrides.approvalPathways  ?? [],
    governanceHeatmap: overrides.governanceHeatmap ?? [],
    sensitivitySurface: overrides.sensitivitySurface ?? [],
    executiveSummary:  overrides.executiveSummary  ?? "Stress test executive summary.",
  };
}

// ── Simulates the hasStress unlock condition in ReportsPanel ─────────────────
function computeHasStress(simAggregation: any | null): boolean {
  return !!(simAggregation?.decisionDistribution);
}

// ── Simulates the effectiveSimData merge in ICReport ─────────────────────────
function computeEffectiveSimData(
  liveSimData: any | null,
  latestSimStatus: any | null
): any | null {
  if (liveSimData) return liveSimData;
  if (latestSimStatus?.status === "completed" && latestSimStatus.aggregation) {
    return {
      runId:       latestSimStatus.runId,
      mode:        latestSimStatus.mode,
      targetCount: latestSimStatus.targetCount,
      completedAt: latestSimStatus.completedAt ? String(latestSimStatus.completedAt) : "",
      aggregation: latestSimStatus.aggregation,
    };
  }
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Stress Test Report unlock condition", () => {
  it("1. Report remains locked when no simulation has been run", () => {
    const simAggregation = null;
    expect(computeHasStress(simAggregation)).toBe(false);
  });

  it("2. Report unlocks when live simulation data is available", () => {
    const simAggregation = makeSimAggregation();
    expect(computeHasStress(simAggregation)).toBe(true);
  });

  it("3. Report unlocks when only decisionDistribution is present (partial aggregation)", () => {
    const simAggregation = makeSimAggregation({
      failureVectors:    null,
      approvalPathways:  null,
      governanceHeatmap: null,
      sensitivitySurface: null,
      executiveSummary:  null,
    });
    expect(computeHasStress(simAggregation)).toBe(true);
  });

  it("4. Report remains locked when aggregation exists but decisionDistribution is null", () => {
    const simAggregation = makeSimAggregation({ decisionDistribution: null });
    expect(computeHasStress(simAggregation)).toBe(false);
  });
});

describe("effectiveSimData merge logic (ICReport)", () => {
  it("5. Prefers live sim data over DB-fetched data", () => {
    const liveSimData = {
      runId: "live-run-001",
      mode: "quick",
      targetCount: 100,
      completedAt: "2026-05-24T10:00:00Z",
      aggregation: makeSimAggregation(),
    };
    const latestSimStatus = {
      runId: "db-run-999",
      status: "completed",
      mode: "institutional",
      targetCount: 1000,
      completedAt: "2026-05-23T08:00:00Z",
      aggregation: makeSimAggregation({ executiveSummary: "Older run" }),
    };
    const effective = computeEffectiveSimData(liveSimData, latestSimStatus);
    expect(effective?.runId).toBe("live-run-001");
    expect(effective?.mode).toBe("quick");
  });

  it("6. Falls back to DB-fetched data when no live data", () => {
    const latestSimStatus = {
      runId: "db-run-999",
      status: "completed",
      mode: "institutional",
      targetCount: 1000,
      completedAt: "2026-05-23T08:00:00Z",
      aggregation: makeSimAggregation({ executiveSummary: "DB run" }),
    };
    const effective = computeEffectiveSimData(null, latestSimStatus);
    expect(effective?.runId).toBe("db-run-999");
    expect(effective?.aggregation.executiveSummary).toBe("DB run");
  });

  it("7. Returns null when no live data and DB run is not completed", () => {
    const latestSimStatus = {
      runId: "db-run-running",
      status: "running",
      mode: "deep",
      targetCount: 10000,
      completedAt: null,
      aggregation: null,
    };
    const effective = computeEffectiveSimData(null, latestSimStatus);
    expect(effective).toBeNull();
  });

  it("8. Returns null when both live data and DB data are null", () => {
    const effective = computeEffectiveSimData(null, null);
    expect(effective).toBeNull();
  });
});

describe("Report unlocks after restored historical simulation", () => {
  it("9. Restored run data flows through effectiveSimData and unlocks the report", () => {
    // Simulate: user clicks Restore Results → onSimCompleted fires → liveSimData is set
    const restoredAggregation = makeSimAggregation({
      executiveSummary: "Restored historical run",
    });
    const liveSimData = {
      runId: "restored-run-007",
      mode: "deep",
      targetCount: 10000,
      completedAt: "2026-05-20T12:00:00Z",
      aggregation: restoredAggregation,
    };
    const effective = computeEffectiveSimData(liveSimData, null);
    expect(effective).not.toBeNull();
    expect(computeHasStress(effective!.aggregation)).toBe(true);
    expect(effective!.aggregation.executiveSummary).toBe("Restored historical run");
  });
});

describe("Report export uses correct run data", () => {
  it("10. Export uses targetCount from aggregation when simTargetCount is missing", () => {
    const simAggregation = makeSimAggregation({
      decisionDistribution: makeDecisionDistribution({ totalScenarios: 1000 }),
    });
    // Simulate the safeSimTargetCount fallback in ReportsPanel
    const simTargetCount: number | undefined = undefined;
    const safeSimTargetCount = simTargetCount ?? (simAggregation?.decisionDistribution?.totalScenarios ?? 0);
    expect(safeSimTargetCount).toBe(1000);
  });

  it("11. Export uses 'unknown' mode when simMode is missing", () => {
    const simMode: string | undefined = undefined;
    const safeSimMode = simMode ?? "unknown";
    expect(safeSimMode).toBe("unknown");
  });

  it("12. Export uses current timestamp when simCompletedAt is missing", () => {
    const simCompletedAt: string | undefined = undefined;
    const before = Date.now();
    const safeSimCompletedAt = simCompletedAt ?? new Date().toISOString();
    const after = Date.now();
    const ts = new Date(safeSimCompletedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe("Report does not show blank body when aggregation exists", () => {
  it("13. Partial aggregation (only decisionDistribution) still unlocks report", () => {
    const partialAggregation = {
      decisionDistribution: makeDecisionDistribution(),
      failureVectors:    null,
      approvalPathways:  null,
      governanceHeatmap: null,
      sensitivitySurface: null,
      executiveSummary:  null,
    };
    expect(computeHasStress(partialAggregation)).toBe(true);
  });

  it("14. Aggregator produces valid decisionDistribution from real scenario results", () => {
    // Build 10 mock ScenarioEvalResult objects
    const mockResults = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      decision: (i < 6 ? "APPROVE" : i < 8 ? "CONDITIONAL" : "REJECT") as "APPROVE" | "CONDITIONAL" | "REJECT",
      confidenceScore: 0.7,
      dominantRiskCategory: "market" as const,
      topBlockers: i >= 8 ? ["market saturation"] : [],
      topMitigants: i < 6 ? ["strong team"] : [],
      escalationTriggers: [],
      governanceConcerns: [],
      hasHardNo: false,
      approvalDelta: i < 6 ? 0.2 : i < 8 ? -0.1 : -0.5,
      stressedCategories: ["market" as const],
      provenance: {
        seed: i,
        correlationGroupsActivated: [],
        hardNoTriggers: [],
      },
    }));

    const aggregation = aggregateSimulationResults(mockResults);
    expect(aggregation.decisionDistribution).not.toBeNull();
    expect(aggregation.decisionDistribution.totalScenarios).toBe(10);
    expect(aggregation.decisionDistribution.approveCount).toBe(6);
    expect(aggregation.decisionDistribution.conditionalCount).toBe(2);
    expect(aggregation.decisionDistribution.rejectCount).toBe(2);
    // hasStress should be true with this aggregation
    expect(computeHasStress(aggregation)).toBe(true);
  });
});
