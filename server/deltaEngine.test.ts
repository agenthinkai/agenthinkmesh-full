/**
 * deltaEngine.test.ts — Guardrail tests for the Delta Engine / Rescue Sensitivity Layer
 *
 * 8 original tests covering the 8 resolution rules:
 *   DE-1  default_risk-only → RESCUED_CONDITIONAL
 *   DE-2  fraud (terminal) → FINAL_REJECTED
 *   DE-3  mixed default_risk + fraud → FINAL_REJECTED (terminal overrides rescuable)
 *   DE-4  empty terminalFlags → FINAL_REJECTED (non-empty guard)
 *   DE-5  unknown flag → FINAL_REJECTED (fail-closed)
 *   DE-6  RESCUED_CONDITIONAL has 5 sensitivity scores, all dataUnavailable
 *   DE-7  FINAL_REJECTED has empty sensitivityScores
 *   DE-8  rescue can never produce APPROVED (stage-1 invariant)
 *
 * 6 new tests for ATTRIBUTION_UNAVAILABLE (null terminalFlags) and executive summary:
 *   DE-9   null terminalFlags → attributionUnavailable: true
 *   DE-10  null terminalFlags → rejectionReason contains ATTRIBUTION_UNAVAILABLE
 *   DE-11  null terminalFlags → NOT equivalent to empty [] (divergence guard)
 *   DE-12  null terminalFlags → sensitivityScores is empty
 *   DE-13  aggregateSimulationResults rescue sentence present when rescuedConditionalCount > 0
 *   DE-14  aggregateSimulationResults attribution-unavailable sentence when all hard-nos have null flags
 */

import { describe, it, expect } from "vitest";
import { runDeltaEngine } from "./deltaEngine";
import { aggregateSimulationResults } from "./scenarioAggregator";

describe("Delta Engine — resolution rules", () => {
  // ── DE-1: default_risk-only → RESCUED_CONDITIONAL ───────────────────────────
  it("DE-1: default_risk-only flags produce RESCUED_CONDITIONAL", () => {
    const result = runDeltaEngine(0, ["debt_severe"], ["default_risk"]);
    expect(result.rescueStatus).toBe("RESCUED_CONDITIONAL");
    expect(result.rejectionReason).toBeNull();
    expect(result.mitigation).toBeTruthy();
    expect(result.triggeringFlags).toEqual(["default_risk"]);
  });

  // ── DE-2: fraud (terminal) → FINAL_REJECTED ─────────────────────────────────
  it("DE-2: fraud flag (TERMINAL) produces FINAL_REJECTED", () => {
    const result = runDeltaEngine(1, ["governance_severe"], ["fraud"]);
    expect(result.rescueStatus).toBe("FINAL_REJECTED");
    expect(result.rejectionReason).toMatch(/FRAUD/i);
    expect(result.mitigation).toBeNull();
    expect(result.sensitivityScores).toHaveLength(0);
  });

  // ── DE-3: mixed default_risk + fraud → FINAL_REJECTED ───────────────────────
  // Terminal flag overrides co-occurring rescuable flag.
  it("DE-3: mixed default_risk + fraud → FINAL_REJECTED, rescuable listed in rescuableOverriddenBy", () => {
    const result = runDeltaEngine(2, ["debt_severe", "governance_severe"], ["default_risk", "fraud"]);
    expect(result.rescueStatus).toBe("FINAL_REJECTED");
    expect(result.rejectionReason).toMatch(/FRAUD/i);
    // default_risk was rescuable but overridden by fraud
    expect(result.rescuableOverriddenBy).toContain("default_risk");
    expect(result.sensitivityScores).toHaveLength(0);
  });

  // ── DE-4: empty terminalFlags → FINAL_REJECTED (non-empty guard) ────────────
  it("DE-4: empty terminalFlags → FINAL_REJECTED (non-empty guard prevents vacuous rescue)", () => {
    const result = runDeltaEngine(3, ["debt_severe"], []);
    expect(result.rescueStatus).toBe("FINAL_REJECTED");
    expect(result.rejectionReason).toMatch(/empty terminalFlags/i);
    expect(result.triggeringFlags).toHaveLength(0);
    expect(result.sensitivityScores).toHaveLength(0);
  });

  // ── DE-5: unknown flag → FINAL_REJECTED (fail-closed) ───────────────────────
  it("DE-5: unknown / unrecognised flag → FINAL_REJECTED (fail-closed)", () => {
    const result = runDeltaEngine(4, ["debt_severe"], ["unknown_blocker_xyz"]);
    expect(result.rescueStatus).toBe("FINAL_REJECTED");
    expect(result.rejectionReason).toMatch(/unknown/i);
    expect(result.sensitivityScores).toHaveLength(0);
  });

  // ── DE-6: RESCUED_CONDITIONAL has 5 sensitivity scores, all dataUnavailable ──
  it("DE-6: RESCUED_CONDITIONAL carries 5 sensitivity scores, all dataUnavailable: true", () => {
    const result = runDeltaEngine(5, ["debt_severe"], ["default_risk"]);
    expect(result.rescueStatus).toBe("RESCUED_CONDITIONAL");
    expect(result.sensitivityScores).toHaveLength(5);
    for (const score of result.sensitivityScores) {
      expect(score.dataUnavailable).toBe(true);
      expect(score.currentValue).toBeNull();
      expect(score.thresholdValue).toBeNull();
      expect(score.headroom).toBeNull();
    }
  });

  // ── DE-7: FINAL_REJECTED has empty sensitivityScores ────────────────────────
  it("DE-7: FINAL_REJECTED (terminal flag) has empty sensitivityScores", () => {
    const result = runDeltaEngine(6, ["governance_severe"], ["capital_controls"]);
    expect(result.rescueStatus).toBe("FINAL_REJECTED");
    expect(result.sensitivityScores).toHaveLength(0);
  });

  // ── DE-8: rescue can never produce APPROVED (stage-1 invariant) ─────────────
  // Even with the most rescuable input, the engine can only produce RESCUED_CONDITIONAL.
  it("DE-8: rescue can never produce APPROVED — max upgrade is RESCUED_CONDITIONAL", () => {
    // Best possible input: single default_risk flag (the only RESCUABLE flag)
    const result = runDeltaEngine(7, ["debt_severe"], ["default_risk"]);
    // RESCUED_CONDITIONAL is the maximum — never APPROVED
    expect(result.rescueStatus).not.toBe("APPROVED" as never);
    expect(["RESCUED_CONDITIONAL", "FINAL_REJECTED"]).toContain(result.rescueStatus);
    // Confirm it is RESCUED_CONDITIONAL (not silently downgraded)
    expect(result.rescueStatus).toBe("RESCUED_CONDITIONAL");
  });
});

describe("Delta Engine — ATTRIBUTION_UNAVAILABLE (null terminalFlags)", () => {
  // ── DE-9: null terminalFlags → attributionUnavailable: true ─────────────────
  // null means field was absent/unloaded/pre-field DB row.
  // Must NOT be treated as empty [] (which would produce a confident FINAL_REJECTED).
  it("DE-9: null terminalFlags sets attributionUnavailable: true", () => {
    const result = runDeltaEngine(9, ["debt_severe"], null);
    expect(result.attributionUnavailable).toBe(true);
  });

  // ── DE-10: null terminalFlags → rejectionReason contains ATTRIBUTION_UNAVAILABLE
  it("DE-10: null terminalFlags → rejectionReason contains ATTRIBUTION_UNAVAILABLE", () => {
    const result = runDeltaEngine(10, ["governance_severe"], null);
    expect(result.rejectionReason).toMatch(/ATTRIBUTION_UNAVAILABLE/i);
    // Must NOT look like a confident terminal-blocker rejection
    expect(result.rejectionReason).not.toMatch(/FRAUD|SANCTIONS|CAPITAL_CONTROLS/i);
  });

  // ── DE-11: null vs [] divergence guard ───────────────────────────────────────
  // null (ATTRIBUTION_UNAVAILABLE) and [] (genuinely empty) both produce rescueStatus
  // FINAL_REJECTED, but they MUST have different rejectionReasons — null is an
  // attribution gap, [] is a confident non-empty guard failure.
  it("DE-11: null and [] produce different rejectionReasons (divergence guard)", () => {
    const nullResult = runDeltaEngine(11, ["debt_severe"], null);
    const emptyResult = runDeltaEngine(11, ["debt_severe"], []);
    // Both are FINAL_REJECTED
    expect(nullResult.rescueStatus).toBe("FINAL_REJECTED");
    expect(emptyResult.rescueStatus).toBe("FINAL_REJECTED");
    // But their rejectionReasons MUST differ
    expect(nullResult.rejectionReason).not.toBe(emptyResult.rejectionReason);
    // null → attribution gap message
    expect(nullResult.rejectionReason).toMatch(/ATTRIBUTION_UNAVAILABLE/i);
    // [] → empty terminalFlags guard message
    expect(emptyResult.rejectionReason).toMatch(/empty terminalFlags/i);
    // null result MUST be flagged as attribution-unavailable
    expect(nullResult.attributionUnavailable).toBe(true);
    // [] result MUST NOT be flagged as attribution-unavailable
    expect(emptyResult.attributionUnavailable).toBeFalsy();
  });

  // ── DE-12: null terminalFlags → sensitivityScores is empty ──────────────────
  // No sensitivity scores should be fabricated when attribution is unavailable.
  it("DE-12: null terminalFlags produces empty sensitivityScores", () => {
    const result = runDeltaEngine(12, ["debt_severe"], null);
    expect(result.sensitivityScores).toHaveLength(0);
  });
});

describe("Delta Engine — executive summary rescue sentence", () => {
  // Helper: build a minimal ScenarioEvalResult for aggregation
  function makeHardNoResult(index: number, rescueStatus: "RESCUED_CONDITIONAL" | "FINAL_REJECTED", attributionUnavailable?: boolean) {
    return {
      index,
      decision: "REJECT" as const,
      confidenceScore: 0.92,
      dominantRiskCategory: "governance" as const,
      topBlockers: ["Hard-no trigger: debt_severe"],
      topMitigants: [],
      escalationTriggers: ["debt_severe"],
      governanceConcerns: ["debt_severe"],
      hasHardNo: true,
      approvalDelta: -0.6,
      stressedCategories: ["governance"] as string[],
      provenance: {
        hardNoTriggers: ["debt_severe"],
        correlationBoosts: [] as string[],
        severeDrawsUsed: 1,
      },
      deltaEngine: {
        variantIndex: index,
        rescueStatus,
        triggeringFlags: rescueStatus === "RESCUED_CONDITIONAL" ? ["default_risk"] : [],
        mitigation: rescueStatus === "RESCUED_CONDITIONAL" ? "Mitigant text" : null,
        residualRisk: "Some residual risk",
        sensitivityScores: [],
        rejectionReason: rescueStatus === "FINAL_REJECTED" ? "FRAUD is a terminal blocker" : null,
        rescuableOverriddenBy: [],
        attributionUnavailable: attributionUnavailable ?? false,
      },
    };
  }

  // ── DE-13: rescue sentence present when rescuedConditionalCount > 0 ──────────
  it("DE-13: executive summary includes RESCUED_CONDITIONAL sentence when rescue count > 0", () => {
    const results = [
      makeHardNoResult(0, "RESCUED_CONDITIONAL"),
      makeHardNoResult(1, "FINAL_REJECTED"),
      makeHardNoResult(2, "FINAL_REJECTED"),
    ];
    const agg = aggregateSimulationResults(results as any, "run-test", "deal-test", "quick");
    expect(agg.executiveSummary).toMatch(/RESCUED_CONDITIONAL/i);
    expect(agg.executiveSummary).toMatch(/FINAL_REJECTED/i);
    // Rescue count and final-rejected count should appear
    expect(agg.decisionDistribution.rescuedConditionalCount).toBe(1);
    expect(agg.decisionDistribution.finalRejectedCount).toBe(2);
  });

  // ── DE-14: attribution-unavailable sentence when all hard-nos have null flags ─
  it("DE-14: executive summary includes attribution-unavailable sentence when all hard-nos have attributionUnavailable: true", () => {
    const results = [
      makeHardNoResult(0, "FINAL_REJECTED", true),
      makeHardNoResult(1, "FINAL_REJECTED", true),
    ];
    const agg = aggregateSimulationResults(results as any, "run-test2", "deal-test2", "quick");
    // rescuedConditionalCount and finalRejectedCount should both be 0
    // (attributionUnavailable results are not counted as confident FINAL_REJECTED)
    // The executive summary should mention attribution unavailability
    expect(agg.executiveSummary).toMatch(/attribution unavailable/i);
  });
});
