/**
 * Distribution shape verification tests.
 *
 * These tests verify that the baseApprovalScore fix produces
 * correct, differentiated simulation distributions.
 *
 * Architecture note (seed=42 reality):
 *   generateScenarioVariants(100, 42) produces ~99 hard-no variants because the
 *   perturbation library has many hard-no levels and correlated stresses amplify
 *   them. Hard-no variants are ALWAYS rejected regardless of baseApprovalScore.
 *   This is correct institutional behavior.
 *
 * Test strategy:
 *   - Use synthetic ScenarioVariant objects (no hard-no, controlled deltas) to
 *     test the cheap-path and LLM-path logic in isolation.
 *   - Use the real generator only for invariant tests (hard-no always rejects,
 *     counts sum to 100).
 */

import { describe, it, expect } from "vitest";
import type { ScenarioVariant } from "./scenarioMutationEngine";
import {
  generateScenarioVariants,
  buildScenarioBrief,
  evaluateScenario,
} from "./scenarioMutationEngine";
import { aggregateSimulationResults } from "./scenarioAggregator";

const HELIOS_NORTH_BRIEF = `
DEAL NAME: Helios-North Solar Infrastructure Fund
SECTOR: Renewable Energy Infrastructure
STRUCTURE: Project Finance / Senior Secured Debt
TICKET SIZE: $120M
DSCR: 1.18x (base case), 0.94x (stressed)
OFFTAKE: 60% contracted (PPA with sovereign utility), 40% merchant
SPONSOR: First-time infrastructure sponsor, no prior project finance exits
KEY RISKS: Merchant price exposure, sponsor track record gap, construction completion risk
VERDICT: REJECTED — DSCR below 1.20x threshold under stress
`;

// ── Mock LLM ─────────────────────────────────────────────────────────────────

/** Mock LLM that returns realistic variance based on stress context and scenario index */
let _mockCallCount = 0;
const mockLLM = async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
  const brief = messages[1]?.content ?? "";
  const stressLevel = (brief.match(/SEVERE|severe|critical/gi) ?? []).length;
  const mildLevel = (brief.match(/MILD|mild|minor/gi) ?? []).length;

  // Use call count for variance so each scenario gets a different seed
  const callIndex = _mockCallCount++;
  // Deterministic pseudo-random: interleave brief length with call index
  const seed = ((brief.length * 7 + callIndex * 13) % 100) / 100;

  let decision: "APPROVE" | "CONDITIONAL" | "REJECT";

  if (stressLevel >= 2) {
    decision = seed < 0.70 ? "REJECT" : "CONDITIONAL";
  } else if (stressLevel === 1) {
    decision = seed < 0.40 ? "REJECT" : seed < 0.70 ? "CONDITIONAL" : "APPROVE";
  } else if (mildLevel >= 1) {
    decision = seed < 0.15 ? "REJECT" : seed < 0.50 ? "CONDITIONAL" : "APPROVE";
  } else {
    decision = seed < 0.25 ? "REJECT" : seed < 0.55 ? "CONDITIONAL" : "APPROVE";
  }

  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            decision,
            confidence: 0.65 + seed * 0.25,
            rationale: "Scenario evaluation complete.",
          }),
        },
      },
    ],
  };
};

// ── Synthetic variant builder ─────────────────────────────────────────────────

/**
 * Build a synthetic ScenarioVariant with no hard-no and a controlled delta.
 * Used to test the cheap-path and LLM-path logic in isolation, without the
 * hard-no noise from generateScenarioVariants.
 */
function makeSyntheticVariant(index: number, totalApprovalDelta: number): ScenarioVariant {
  const severity = totalApprovalDelta < -0.20 ? "moderate" : "mild";
  return {
    index,
    perturbations: { capex_inflation: `capex_${severity}` },
    totalApprovalDelta,
    hasHardNo: false,
    stressedCategories: ["financial"],
    dominantRiskCategory: "financial",
    stressFragments: [
      severity === "moderate"
        ? "Capital expenditure has risen 30% above plan."
        : "Capital expenditure has increased by 15% due to input cost inflation.",
    ],
    provenance: {
      seed: 42 + index,
      correlationGroupsActivated: [],
      hardNoTriggers: [],
    },
  };
}

/**
 * Run a simulation using synthetic variants with controlled delta distribution.
 * Produces 40 mild (-0.05), 40 moderate (-0.15), 20 severe (-0.25) variants.
 * None have hard-no triggers.
 */
async function runSyntheticSimulation(baseApprovalScore: number) {
  _mockCallCount = 0; // reset call counter for determinism
  const variants: ScenarioVariant[] = [
    ...Array.from({ length: 40 }, (_, i) => makeSyntheticVariant(i, -0.05)),
    ...Array.from({ length: 40 }, (_, i) => makeSyntheticVariant(40 + i, -0.15)),
    ...Array.from({ length: 20 }, (_, i) => makeSyntheticVariant(80 + i, -0.25)),
  ];

  const results = await Promise.all(
    variants.map((v) =>
      evaluateScenario(
        v,
        buildScenarioBrief(HELIOS_NORTH_BRIEF, v),
        mockLLM,
        "infrastructure",
        baseApprovalScore
      )
    )
  );
  return aggregateSimulationResults(results, "test-run", "helios-north", "quick");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Distribution Shape — baseApprovalScore fix", () => {

  // ── 1. Cheap-path invariants (synthetic variants, no hard-no) ────────────

  it("APPROVED deal (base=+0.55): cheap path produces majority approve for mild/moderate stress", async () => {
    // With base=0.55 and delta in [-0.05, -0.15, -0.25]:
    //   effectiveDelta = [0.50, 0.40, 0.30] — all >= CONFIDENT_THRESHOLD(0.30)
    //   → all 100 should be cheap APPROVE
    const agg = await runSyntheticSimulation(0.55);
    const dist = agg.decisionDistribution;

    expect(dist.approveCount).toBeGreaterThan(50);
    expect(dist.approveCount + dist.conditionalCount + dist.rejectCount).toBe(100);
  }, 30000);

  it("REJECTED deal (base=-0.15): cheap path produces majority reject for mild/moderate stress", async () => {
    // With base=-0.15 and delta in [-0.05, -0.15, -0.25]:
    //   effectiveDelta = [-0.20, -0.30, -0.40]
    //   delta=-0.05 → effectiveDelta=-0.20 → middle band (LLM)
    //   delta=-0.15 → effectiveDelta=-0.30 → cheap REJECT (boundary)
    //   delta=-0.25 → effectiveDelta=-0.40 → cheap REJECT
    // So 60 cheap REJECTs + 40 LLM middle-band calls
    const agg = await runSyntheticSimulation(-0.15);
    const dist = agg.decisionDistribution;

    // Reject should dominate
    expect(dist.rejectCount).toBeGreaterThan(50);
    expect(dist.approveCount + dist.conditionalCount + dist.rejectCount).toBe(100);
  }, 30000);

  it("APPROVED deal has higher approve rate than REJECTED deal (synthetic variants)", async () => {
    const [rejectedAgg, approvedAgg] = await Promise.all([
      runSyntheticSimulation(-0.15),
      runSyntheticSimulation(0.55),
    ]);

    const rejectedApproveRate = rejectedAgg.decisionDistribution.approvePct;
    const approvedApproveRate = approvedAgg.decisionDistribution.approvePct;

    // The approved deal must have a meaningfully higher approve rate
    expect(approvedApproveRate).toBeGreaterThan(rejectedApproveRate);
  }, 60000);

  it("CONDITIONAL deal (base=+0.20): LLM middle-band produces mixed distribution", async () => {
    // With base=0.20 and delta in [-0.05, -0.15, -0.25]:
    //   effectiveDelta = [0.15, 0.05, -0.05] — all in middle band (-0.30, +0.30)
    //   → all 100 go to LLM mock
    // The mock LLM uses call index for variance → produces mixed APPROVE/CONDITIONAL/REJECT
    const agg = await runSyntheticSimulation(0.20);
    const dist = agg.decisionDistribution;

    // All 100 go to LLM → distribution must be non-flat
    expect(dist.rejectCount).toBeLessThan(100);
    expect(dist.approveCount + dist.conditionalCount + dist.rejectCount).toBe(100);
    // Some non-reject outcomes must exist (LLM mock produces variance)
    expect(dist.approveCount + dist.conditionalCount).toBeGreaterThan(0);
  }, 30000);

  // ── 2. Hard-no invariant (real generator) ────────────────────────────────

  it("hard-no variants are ALWAYS rejected regardless of baseApprovalScore", async () => {
    // generateScenarioVariants(100, 42) produces ~99 hard-no variants.
    // Even with base=+0.99, hard-no scenarios must still be REJECT.
    const variants = generateScenarioVariants(100, 42);
    const hardNoVariants = variants.filter(v => v.hasHardNo);

    // Confirm the generator produces hard-no variants with this seed
    expect(hardNoVariants.length).toBeGreaterThan(0);

    // Evaluate all hard-no variants with a very high base score
    const results = await Promise.all(
      hardNoVariants.slice(0, 10).map(v =>
        evaluateScenario(
          v,
          buildScenarioBrief(HELIOS_NORTH_BRIEF, v),
          mockLLM,
          "infrastructure",
          0.99 // extremely high base — hard-no must still reject
        )
      )
    );

    // Every hard-no variant must be REJECT
    results.forEach(r => {
      expect(r.decision).toBe("REJECT");
      expect(r.hasHardNo).toBe(true);
    });
  }, 30000);

  // ── 3. Counts invariant ──────────────────────────────────────────────────

  it("counts always sum to 100 regardless of baseApprovalScore", async () => {
    const scores = [-0.15, 0.0, 0.20, 0.55];
    for (const score of scores) {
      const agg = await runSyntheticSimulation(score);
      const dist = agg.decisionDistribution;
      expect(dist.approveCount + dist.conditionalCount + dist.rejectCount).toBe(100);
    }
  }, 120000);

  // ── 4. Sensitivity surface ───────────────────────────────────────────────

  it("sensitivity surface is computed (entries exist) for REJECTED deal", async () => {
    const agg = await runSyntheticSimulation(-0.15);
    // sensitivitySurface is SensitivityEntry[] (array of objects, not a Record)
    const surface = agg.sensitivitySurface ?? [];

    // Sensitivity surface must be computed (entries exist for each stress category)
    expect(Array.isArray(surface)).toBe(true);
    expect(surface.length).toBeGreaterThan(0);
    // Each entry must have the required fields
    const firstEntry = surface[0];
    expect(firstEntry).toHaveProperty("dimensionKey");
    expect(firstEntry).toHaveProperty("impactScore");
    expect(firstEntry).toHaveProperty("avgDeltaWhenStressed");
    // impactScore is non-negative by definition (0-100 normalized)
    surface.forEach(e => expect(e.impactScore).toBeGreaterThanOrEqual(0));
  }, 30000);
});
