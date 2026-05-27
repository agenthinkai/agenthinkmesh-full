/**
 * resilienceImpact.test.ts
 *
 * Guardrail tests for the Resilience Impact section in the Original vs Upgraded
 * comparison card (BoardroomICReport / comparisonAvailable block).
 *
 * These tests verify the display-logic helpers used by the Resilience Impact
 * section — pure functions that mirror exactly what the JSX renders.
 * The component is inline JSX (not a separate importable module), so we test
 * the formatting rules directly, plus the underlying fingerprint engine that
 * supplies the data.
 *
 * RI-1: Positive resilienceDelta formats as "+Xpp" (green path)
 * RI-2: Negative resilienceDelta formats as "-Xpp" (red path)
 * RI-3: Null/undefined metrics render "Not available." — no fallback to prose
 * RI-4: Verdict logic unchanged — fingerprint fields are display-only
 *
 * NOTE: resilienceDelta is stored as percentage points (e.g., 30 for a 30pp
 * improvement), NOT as a 0–1 fraction. The JSX renders it directly as
 * `value.toFixed(1) + "pp"` without multiplying by 100.
 */

import { describe, it, expect } from "vitest";
import { computeSimulationFingerprint, type FingerprintInput } from "./simulationFingerprintEngine";
import type { SimulationAggregation, DecisionDistribution } from "./scenarioAggregator";
import type { ScenarioEvalResult } from "./scenarioMutationEngine";

// ── Formatting helpers (mirrors the JSX logic exactly) ────────────────────────

/**
 * Formats a resilienceDelta value the same way the Resilience Impact section does.
 * resilienceDelta is stored as percentage points (e.g., 30 = +30pp).
 *   null/undefined → "Not available."
 *   >= 0           → "+X.Xpp"
 *   < 0            → "-X.Xpp"
 */
function formatResilienceDelta(value: number | null | undefined): string {
  if (value == null) return "Not available.";
  return (value >= 0 ? "+" : "") + (value).toFixed(1) + "pp";
}

/**
 * Formats a score (rescueabilityScore or structuralFragilityScore):
 *   null/undefined → "Not available."
 *   number         → "X/100"
 */
function formatScore(value: number | null | undefined): string {
  if (value == null) return "Not available.";
  return `${value}/100`;
}

/**
 * Formats upgradeEffectiveness:
 *   null/undefined → "Not available."
 *   number         → String(value)
 */
function formatEffectiveness(value: number | null | undefined): string {
  if (value == null) return "Not available.";
  return String(value);
}

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

function makeAggregation(overrides: Partial<SimulationAggregation> = {}): SimulationAggregation {
  return {
    runId: "run-ri-test",
    dealId: "deal-ri-test",
    mode: "institutional",
    totalScenarios: 100,
    completedAt: new Date().toISOString(),
    executiveSummary: "Test summary",
    decisionDistribution: makeDecisionDistribution(),
    failureVectors: [],
    approvalPathways: [],
    governanceHeatmap: [],
    sensitivitySurface: [],
    ...overrides,
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

function makeFingerprintInput(overrides: Partial<FingerprintInput> = {}): FingerprintInput {
  return {
    aggregation: makeAggregation(),
    results: makeResults(100),
    councilMode: "global_vc",
    dealName: "Test Deal",
    isUpgradedScenario: false,
    originalRunId: null,
    originalVerdict: null,
    upgradedVerdict: null,
    originalApprovePct: null,
    ...overrides,
  };
}

// ── RI-1: Positive resilienceDelta formats as "+Xpp" ─────────────────────────
describe("Resilience Impact — display formatting", () => {
  it("RI-1: positive resilienceDelta formats as '+X.Xpp' with green signal", () => {
    // +18 pp → "+18.0pp"
    expect(formatResilienceDelta(18)).toBe("+18.0pp");
    // +5 pp → "+5.0pp"
    expect(formatResilienceDelta(5)).toBe("+5.0pp");
    // +12.3 pp → "+12.3pp"
    expect(formatResilienceDelta(12.3)).toBe("+12.3pp");
    // zero is treated as non-negative → "+0.0pp"
    expect(formatResilienceDelta(0)).toBe("+0.0pp");
  });

  // ── RI-2: Negative resilienceDelta formats as "-Xpp" ─────────────────────────
  it("RI-2: negative resilienceDelta formats as '-X.Xpp' with red signal", () => {
    // -12 pp → "-12.0pp"
    expect(formatResilienceDelta(-12)).toBe("-12.0pp");
    // -5.5 pp → "-5.5pp"
    expect(formatResilienceDelta(-5.5)).toBe("-5.5pp");
  });

  // ── RI-3: Null/undefined metrics render "Not available." ─────────────────────
  it("RI-3: null or undefined metrics render 'Not available.' — no prose fallback", () => {
    // resilienceDelta
    expect(formatResilienceDelta(null)).toBe("Not available.");
    expect(formatResilienceDelta(undefined)).toBe("Not available.");
    // rescueabilityScore / structuralFragilityScore
    expect(formatScore(null)).toBe("Not available.");
    expect(formatScore(undefined)).toBe("Not available.");
    // upgradeEffectiveness
    expect(formatEffectiveness(null)).toBe("Not available.");
    expect(formatEffectiveness(undefined)).toBe("Not available.");
    // score display for valid values
    expect(formatScore(72)).toBe("72/100");
    expect(formatScore(0)).toBe("0/100");
  });

  // ── RI-4: Verdict logic unchanged — fingerprint fields do not affect verdicts ──
  it("RI-4: fingerprint fields are display-only — computeSimulationFingerprint does not change verdict", () => {
    // Compute a fingerprint for an upgraded scenario
    const fp = computeSimulationFingerprint(makeFingerprintInput({
      isUpgradedScenario: true,
      originalRunId: "run-original",
      originalVerdict: "REJECTED",
      upgradedVerdict: "APPROVED_WITH_CONDITIONS",
      originalApprovePct: 30,
    }));

    // Fingerprint fields are present
    expect(fp.isUpgradedScenario).toBe(true);
    expect(fp.resilienceDelta).not.toBeNull();
    expect(fp.upgradeEffectiveness).not.toBeNull();
    expect(fp.rescueabilityScore).not.toBeNull();
    expect(fp.structuralFragilityScore).not.toBeNull();

    // Fingerprint does NOT carry a verdict — it is purely observational
    // (the SimulationFingerprint type has no "verdict" field)
    expect((fp as any).verdict).toBeUndefined();

    // resilienceDelta is stored as percentage points:
    // upgradedApprovePct (60) - originalApprovePct (30) = 30
    expect(fp.resilienceDelta).toBe(30);

    // upgradeEffectiveness = resilienceDelta / (100 - originalApprovePct) = 30 / 70 ≈ 0.429
    expect(fp.upgradeEffectiveness).toBeCloseTo(0.429, 2);

    // Formatting produces readable output — no verdict strings
    const deltaDisplay = formatResilienceDelta(fp.resilienceDelta);
    expect(deltaDisplay).toBe("+30.0pp");
    expect(deltaDisplay).not.toContain("APPROVED");
    expect(deltaDisplay).not.toContain("REJECTED");
  });
});
