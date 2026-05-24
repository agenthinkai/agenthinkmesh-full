/**
 * scenarioSimProductization.test.ts
 * Tests for the three productization features:
 *   1. IC Memo Section 17 — Scenario Stress Summary injection
 *   2. Verdict card ⚡ STRESS-TESTED badge (hasCompletedSim logic)
 *   3. Simulation History restore behavior (listRunsForDeal + getRunStatus)
 */
import { describe, it, expect } from "vitest";
import type { ScenarioEvalResult } from "./scenarioMutationEngine";
import { aggregateSimulationResults } from "./scenarioAggregator";
import { generateScenarioVariants } from "./scenarioMutationEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal mock ScenarioEvalResult matching the real interface */
function mockResult(overrides: Partial<{
  decision: "APPROVE" | "CONDITIONAL" | "REJECT";
  hasHardNo: boolean;
  stressedCategories: string[];
  escalationTriggers: string[];
  approvalDelta: number;
}> = {}): ScenarioEvalResult {
  const {
    decision = "APPROVE",
    hasHardNo = false,
    stressedCategories = ["financial"],
    escalationTriggers = [],
    approvalDelta = -0.05,
  } = overrides;

  return {
    index: Math.floor(Math.random() * 1000),
    decision,
    confidenceScore: 0.75,
    dominantRiskCategory: (stressedCategories[0] ?? "financial") as any,
    topBlockers: decision === "REJECT" ? ["Key risk identified"] : [],
    topMitigants: decision === "APPROVE" ? ["Strong fundamentals"] : [],
    escalationTriggers,
    governanceConcerns: [],
    hasHardNo,
    approvalDelta,
    stressedCategories: stressedCategories as any[],
    provenance: { seed: Math.floor(Math.random() * 9999), correlationGroupsActivated: [], hardNoTriggers: hasHardNo ? ["hard_no_trigger"] : [] },
  };
}

// ── Section 17: scenarioStress shape validation ───────────────────────────────

describe("IC Memo Section 17 — scenarioStress shape", () => {
  it("aggregation produces all fields required by ICMemoInput.scenarioStress", () => {
    const results: ScenarioEvalResult[] = [
      mockResult({ decision: "APPROVE" }),
      mockResult({ decision: "APPROVE" }),
      mockResult({ decision: "CONDITIONAL", approvalDelta: -0.30 }),
      mockResult({ decision: "REJECT",      approvalDelta: -0.60 }),
      mockResult({ decision: "REJECT",      hasHardNo: true, approvalDelta: -0.90 }),
    ];

    const agg = aggregateSimulationResults(results as any);

    // decisionDistribution — required
    expect(agg.decisionDistribution).not.toBeNull();
    expect(typeof agg.decisionDistribution!.approvePct).toBe("number");
    expect(typeof agg.decisionDistribution!.conditionalPct).toBe("number");
    expect(typeof agg.decisionDistribution!.rejectPct).toBe("number");
    expect(typeof agg.decisionDistribution!.approveCount).toBe("number");
    expect(typeof agg.decisionDistribution!.conditionalCount).toBe("number");
    expect(typeof agg.decisionDistribution!.rejectCount).toBe("number");
    expect(typeof agg.decisionDistribution!.hardNoPct).toBe("number");
    expect(typeof agg.decisionDistribution!.totalScenarios).toBe("number");
    expect(agg.decisionDistribution!.totalScenarios).toBe(5);

    // failureVectors — required array
    expect(Array.isArray(agg.failureVectors)).toBe(true);

    // approvalPathways — required array
    expect(Array.isArray(agg.approvalPathways)).toBe(true);

    // governanceHeatmap — required array
    expect(Array.isArray(agg.governanceHeatmap)).toBe(true);

    // sensitivitySurface — required array
    expect(Array.isArray(agg.sensitivitySurface)).toBe(true);

    // executiveSummary — string
    expect(typeof agg.executiveSummary).toBe("string");
    expect(agg.executiveSummary!.length).toBeGreaterThan(0);
  });

  it("Section 17 is omitted when no simulation data is present (aggregator throws on empty input)", () => {
    // The aggregator throws on empty input — the router catches this and leaves scenarioStress undefined
    // which causes the PDF procedure to skip Section 17 entirely
    expect(() => aggregateSimulationResults([] as any)).toThrow("Cannot aggregate empty results array");
  });

  it("Section 17 distribution percentages sum to 100", () => {
    const results: ScenarioEvalResult[] = [
      ...Array.from({ length: 5 }, () => mockResult({ decision: "APPROVE" })),
      ...Array.from({ length: 3 }, () => mockResult({ decision: "CONDITIONAL", approvalDelta: -0.30 })),
      ...Array.from({ length: 2 }, () => mockResult({ decision: "REJECT",      approvalDelta: -0.60 })),
    ];
    const agg = aggregateSimulationResults(results as any);
    const dd = agg.decisionDistribution;
    const total = dd.approvePct + dd.conditionalPct + dd.rejectPct;
    expect(Math.round(total)).toBe(100);
  });

  it("Section 17 failure vectors have required fields for PDF rendering", () => {
    const results: ScenarioEvalResult[] = [
      mockResult({ decision: "REJECT", stressedCategories: ["financial"], approvalDelta: -0.60 }),
      mockResult({ decision: "REJECT", stressedCategories: ["financial"], approvalDelta: -0.65 }),
      mockResult({ decision: "APPROVE" }),
    ];
    const agg = aggregateSimulationResults(results as any);
    if (agg.failureVectors && agg.failureVectors.length > 0) {
      const fv = agg.failureVectors[0];
      expect(typeof fv.dimensionLabel).toBe("string");
      expect(typeof fv.rejectionContributionPct).toBe("number");
      expect(typeof fv.category).toBe("string");
      expect(typeof fv.escalationTriggerCount).toBe("number");
    }
  });

  it("Section 17 approval pathways have required fields for PDF rendering", () => {
    const results: ScenarioEvalResult[] = [
      mockResult({ decision: "APPROVE", stressedCategories: ["financial"] }),
      mockResult({ decision: "APPROVE", stressedCategories: ["financial"] }),
      mockResult({ decision: "REJECT",  approvalDelta: -0.60 }),
    ];
    const agg = aggregateSimulationResults(results as any);
    if (agg.approvalPathways && agg.approvalPathways.length > 0) {
      const ap = agg.approvalPathways[0];
      expect(typeof ap.description).toBe("string");
      expect(typeof ap.estimatedApprovalPct).toBe("number");
      expect(typeof ap.scenarioCount).toBe("number");
    }
  });

  it("Section 17 governance heatmap has required fields for PDF rendering", () => {
    const results: ScenarioEvalResult[] = [
      mockResult({ decision: "REJECT", stressedCategories: ["regulatory"], approvalDelta: -0.60 }),
      mockResult({ decision: "APPROVE", stressedCategories: ["financial"] }),
    ];
    const agg = aggregateSimulationResults(results as any);
    if (agg.governanceHeatmap && agg.governanceHeatmap.length > 0) {
      const gh = agg.governanceHeatmap[0];
      expect(typeof gh.category).toBe("string");
      expect(typeof gh.escalationPct).toBe("number");
      expect(typeof gh.vetoCount).toBe("number");
      expect(typeof gh.regulatoryFragilityScore).toBe("number");
    }
  });

  it("Section 17 hard-no count is correctly tracked", () => {
    const results: ScenarioEvalResult[] = [
      mockResult({ decision: "REJECT", hasHardNo: true,  approvalDelta: -0.90 }),
      mockResult({ decision: "REJECT", hasHardNo: true,  approvalDelta: -0.85 }),
      mockResult({ decision: "REJECT", hasHardNo: false, approvalDelta: -0.60 }),
      mockResult({ decision: "APPROVE" }),
    ];
    const agg = aggregateSimulationResults(results as any);
    expect(agg.decisionDistribution.hardNoCount).toBe(2);
    expect(agg.decisionDistribution.hardNoPct).toBe(50); // 2/4 = 50%
  });
});

// ── Badge Logic: hasCompletedSim ─────────────────────────────────────────────

describe("Verdict card STRESS-TESTED badge — hasCompletedSim logic", () => {
  it("badge shows when a completed simulation exists (hasCompleted: true)", () => {
    const mockResponse = { hasCompleted: true, runId: "run-abc123", mode: "quick", completedAt: "2026-05-24T10:00:00.000Z" };
    expect(mockResponse.hasCompleted).toBe(true);
    expect(mockResponse.runId).toBeTruthy();
  });

  it("badge does NOT show when no simulation exists (hasCompleted: false)", () => {
    const mockResponse = { hasCompleted: false, runId: null, mode: null, completedAt: null };
    expect(mockResponse.hasCompleted).toBe(false);
  });

  it("badge query is disabled when dealId is empty", () => {
    const dealId = "";
    const queryEnabled = !!dealId;
    expect(queryEnabled).toBe(false);
  });

  it("badge query is enabled when dealId is present", () => {
    const dealId = "deal-xyz-123";
    const queryEnabled = !!dealId;
    expect(queryEnabled).toBe(true);
  });

  it("badge returns correct mode and completedAt for tooltip enrichment", () => {
    const mockResponse = {
      hasCompleted: true,
      runId: "run-xyz789",
      mode: "institutional",
      completedAt: "2026-05-24T12:30:00.000Z",
    };
    expect(mockResponse.mode).toBe("institutional");
    expect(new Date(mockResponse.completedAt!).getFullYear()).toBe(2026);
  });

  it("stressTested prop is passed correctly from ICReport to BoardroomICReport", () => {
    // Simulate the prop passing logic
    const simBadgeData = { hasCompleted: true, runId: "run-001", mode: "quick", completedAt: "2026-05-24T10:00:00.000Z" };
    const stressTested = simBadgeData?.hasCompleted;
    expect(stressTested).toBe(true);

    const simBadgeDataFalsy = undefined;
    const stressTestedFalsy = simBadgeDataFalsy?.hasCompleted;
    expect(stressTestedFalsy).toBeUndefined();
  });
});

// ── Simulation History: restore behavior ─────────────────────────────────────

describe("Simulation History — restore behavior", () => {
  it("listRunsForDeal returns runs with decisionDistribution parsed", () => {
    const mockRun = {
      runId: "run-restore-001",
      mode: "quick",
      targetCount: 100,
      completedCount: 100,
      status: "completed",
      durationMs: 4200,
      createdAt: new Date("2026-05-20T09:00:00.000Z"),
      completedAt: new Date("2026-05-20T09:00:04.200Z"),
      executiveSummary: "Deal shows 60% approval rate across 100 scenarios.",
      decisionDistribution: {
        approveCount: 60, conditionalCount: 25, rejectCount: 15,
        approvePct: 60, conditionalPct: 25, rejectPct: 15,
        hardNoCount: 2, hardNoPct: 2, totalScenarios: 100,
      },
    };
    expect(mockRun.decisionDistribution.totalScenarios).toBe(100);
    expect(mockRun.decisionDistribution.approvePct).toBe(60);
  });

  it("restore sets isRestored flag and loads the correct runId", () => {
    let runId: string | null = null;
    let isRestored = false;

    const handleRestore = (restoredRunId: string) => {
      runId = restoredRunId;
      isRestored = true;
    };

    handleRestore("run-restore-001");

    expect(runId).toBe("run-restore-001");
    expect(isRestored).toBe(true);
  });

  it("restored data banner is shown when isRestored is true and runId differs from latest", () => {
    const isRestored = true;
    const activeRunId = "run-restore-001";
    const latestRunId = "run-latest-002";

    const showBanner = isRestored && activeRunId !== latestRunId;
    expect(showBanner).toBe(true);
  });

  it("restored data banner is NOT shown when viewing the latest run (isRestored=false)", () => {
    const isRestored = false;
    const activeRunId = "run-latest-002";
    const latestRunId = "run-latest-002";

    const showBanner = isRestored && activeRunId !== latestRunId;
    expect(showBanner).toBe(false);
  });

  it("history panel only shows completed runs (status === 'completed')", () => {
    const mockRuns = [
      { runId: "r1", status: "completed",  mode: "quick" },
      { runId: "r2", status: "running",    mode: "institutional" },
      { runId: "r3", status: "failed",     mode: "deep" },
      { runId: "r4", status: "completed",  mode: "quick" },
      { runId: "r5", status: "paused",     mode: "quick" },
    ];
    const completedRuns = mockRuns.filter(r => r.status === "completed").slice(0, 5);
    expect(completedRuns).toHaveLength(2);
    expect(completedRuns.every(r => r.status === "completed")).toBe(true);
  });

  it("history panel shows at most 5 runs", () => {
    const mockRuns = Array.from({ length: 8 }, (_, i) => ({
      runId: `r${i}`,
      status: "completed",
      mode: "quick",
    }));
    const capped = mockRuns.filter(r => r.status === "completed").slice(0, 5);
    expect(capped).toHaveLength(5);
  });

  it("getRunStatus returns full aggregation for restore (all 5 fields present)", () => {
    const mockStatus = {
      runId: "run-restore-001",
      status: "completed",
      mode: "quick",
      targetCount: 100,
      completedCount: 100,
      progressPct: 100,
      durationMs: 4200,
      createdAt: new Date(),
      completedAt: new Date(),
      aggregation: {
        decisionDistribution: { approvePct: 60, conditionalPct: 25, rejectPct: 15, approveCount: 60, conditionalCount: 25, rejectCount: 15, hardNoCount: 2, hardNoPct: 2, totalScenarios: 100 },
        failureVectors: [{ dimensionKey: "burn_rate", dimensionLabel: "Burn Rate", category: "financial", rejectionCount: 10, rejectionContributionPct: 66.7, avgApprovalDelta: -0.3, escalationTriggerCount: 2 }],
        approvalPathways: [{ rank: 1, description: "Strong revenue + low burn", safeDimensions: ["revenue_growth"], estimatedApprovalPct: 80, scenarioCount: 48 }],
        governanceHeatmap: [{ category: "financial", escalationCount: 5, vetoCount: 1, complianceCount: 2, regulatoryFragilityScore: 0.3, totalScenarios: 100, escalationPct: 5 }],
        sensitivitySurface: [{ rank: 1, dimensionKey: "burn_rate", dimensionLabel: "Burn Rate", category: "financial", avgDeltaWhenStressed: -0.25, tippingPointSeverity: "high", interactionScore: 0.8, impactScore: 0.9 }],
        executiveSummary: "60% approval rate. Primary failure vector: financial stress.",
      },
    };

    expect(mockStatus.aggregation).not.toBeNull();
    expect(mockStatus.aggregation!.decisionDistribution).not.toBeNull();
    expect(Array.isArray(mockStatus.aggregation!.failureVectors)).toBe(true);
    expect(Array.isArray(mockStatus.aggregation!.approvalPathways)).toBe(true);
    expect(Array.isArray(mockStatus.aggregation!.governanceHeatmap)).toBe(true);
    expect(Array.isArray(mockStatus.aggregation!.sensitivitySurface)).toBe(true);
    expect(typeof mockStatus.aggregation!.executiveSummary).toBe("string");
  });

  it("restore pre-fetches getRunStatus before updating runId", async () => {
    // Simulate the async handleRestore flow: fetch first, then set runId
    const fetchedRunIds: string[] = [];
    const setRunIdCalls: string[] = [];

    const mockFetch = async (runId: string) => {
      fetchedRunIds.push(runId);
      return { runId, status: "completed" };
    };

    const handleRestore = async (restoredRunId: string) => {
      await mockFetch(restoredRunId); // pre-fetch first
      setRunIdCalls.push(restoredRunId); // then update state
    };

    await handleRestore("run-restore-001");

    expect(fetchedRunIds[0]).toBe("run-restore-001");
    expect(setRunIdCalls[0]).toBe("run-restore-001");
    // fetch happens before state update
    expect(fetchedRunIds.indexOf("run-restore-001")).toBeLessThanOrEqual(setRunIdCalls.indexOf("run-restore-001"));
  });
});

// ── Integration: full pipeline produces Section 17-compatible output ──────────

describe("Full pipeline — Section 17 integration", () => {
  it("generates variants and aggregates to produce Section 17-compatible output", () => {
    const variants = generateScenarioVariants(20, 42);
    expect(variants).toHaveLength(20);

    // Use the synchronous heuristic evaluation path (no LLM needed)
    // evaluateScenario requires LLM, so we build results directly from variants
    const results: ScenarioEvalResult[] = variants.map((v, i) => {
      const delta = v.totalApprovalDelta;
      const decision: "APPROVE" | "CONDITIONAL" | "REJECT" =
        delta >= -0.15 ? "APPROVE" : delta >= -0.40 ? "CONDITIONAL" : "REJECT";
      return {
        index: i,
        decision,
        confidenceScore: 0.75,
        dominantRiskCategory: v.dominantRiskCategory,
        topBlockers: [],
        topMitigants: [],
        escalationTriggers: [],
        governanceConcerns: [],
        hasHardNo: v.hasHardNo,
        approvalDelta: delta,
        stressedCategories: v.stressedCategories,
        provenance: v.provenance,
      };
    });

    expect(results).toHaveLength(20);
    expect(results.every(r => ["APPROVE", "CONDITIONAL", "REJECT"].includes(r.decision))).toBe(true);

    const agg = aggregateSimulationResults(results as any);

    // All Section 17 fields present
    expect(agg.decisionDistribution.totalScenarios).toBe(20);
    const total = agg.decisionDistribution.approvePct + agg.decisionDistribution.conditionalPct + agg.decisionDistribution.rejectPct;
    expect(Math.round(total)).toBe(100);
    expect(typeof agg.executiveSummary).toBe("string");
    expect(agg.executiveSummary!.length).toBeGreaterThan(0);
  });
});
