/**
 * severeBudget.test.ts — Prompt 17.6b
 *
 * Four tests verifying the SEVERE_BUDGET=2 constraint in generateScenarioVariants.
 *
 * Tests:
 *   1. Budget invariant (seed=42):    no variant exceeds 2 severe-tier draws
 *   2. Sampled-seed invariant:        budget holds across a range of seeds
 *   3. Veto semantics unchanged:      a variant with a terminal flag still hard-nos
 *   4. Conditional bucket (seed=42):  non-trivial CONDITIONAL bucket exists
 */

import { describe, it, expect } from "vitest";
import {
  generateScenarioVariants,
  PERTURBATION_DIMENSIONS,
  SEVERE_BUDGET,
  type ScenarioVariant,
} from "./scenarioMutationEngine";

// ── Helper ─────────────────────────────────────────────────────────────────────

/** Count the number of severe-tier (severity === "severe") dimensions in a variant. */
function countSevere(v: ScenarioVariant): number {
  let n = 0;
  for (const dim of PERTURBATION_DIMENSIONS) {
    const levelId = v.perturbations[dim.key];
    const level = dim.levels.find(l => l.id === levelId);
    if (level && level.severity === "severe") n++;
  }
  return n;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Severe Budget — Prompt 17.6b", () => {

  // ── Test 1: Budget invariant (seed=42) ──────────────────────────────────────
  it("budget invariant (seed=42): no variant exceeds SEVERE_BUDGET severe-tier draws", () => {
    const variants = generateScenarioVariants(100, 42);

    for (const v of variants) {
      const severeCount = countSevere(v);
      expect(severeCount).toBeLessThanOrEqual(SEVERE_BUDGET);
    }

    // Confirm the budget constant is 2 (so this test is self-documenting)
    expect(SEVERE_BUDGET).toBe(2);
  });

  // ── Test 2: Sampled-seed invariant ──────────────────────────────────────────
  it("sampled-seed invariant: budget holds across seeds 1, 17, 42, 100, 999, 12345", () => {
    const seeds = [1, 17, 42, 100, 999, 12345];

    for (const seed of seeds) {
      const variants = generateScenarioVariants(50, seed);
      for (const v of variants) {
        const severeCount = countSevere(v);
        expect(severeCount).toBeLessThanOrEqual(SEVERE_BUDGET);
      }
    }
  });

  // ── Test 3: Veto semantics unchanged ────────────────────────────────────────
  // A variant that still carries a hard-no level after the budget is applied
  // must still have hasHardNo === true. The budget only limits the COUNT of
  // severe draws; it does not remove or reclassify hard-no flags.
  it("veto semantics unchanged: hard-no variants still have hasHardNo=true post-budget", () => {
    const variants = generateScenarioVariants(100, 42);
    const hardNoVariants = variants.filter(v => v.hasHardNo);

    // There must be hard-no variants in this seed (budget does not eliminate all)
    expect(hardNoVariants.length).toBeGreaterThan(0);

    // For each hard-no variant, verify the hard-no trigger dimension actually
    // carries an isHardNo level — the flag was not stripped by the budget
    for (const v of hardNoVariants) {
      for (const triggerKey of v.provenance.hardNoTriggers) {
        const dim = PERTURBATION_DIMENSIONS.find(d => d.key === triggerKey)!;
        const levelId = v.perturbations[triggerKey];
        const level = dim.levels.find(l => l.id === levelId)!;
        expect(level.isHardNo).toBe(true);
      }
    }
  });

  // ── Test 4: Conditional bucket (seed=42) ────────────────────────────────────
  // After the budget fix, the number of non-hard-no variants at seed=42 must
  // be non-trivial (> 0). These are the variants that are CONDITIONAL-eligible
  // — they would produce CONDITIONAL outcomes when combined with a high base
  // score deal, rather than being hard-no rejected regardless of base score.
  //
  // Before the budget: 99/100 hard-no → only 1 non-hard-no (CONDITIONAL pool
  //   starved; the Delta Engine middle band has almost no input variants).
  // After the budget:  92/100 hard-no → 8 non-hard-no (CONDITIONAL pool
  //   exists; the Delta Engine middle band has meaningful input variants).
  //
  // We assert > 0 non-hard-no variants — not a fixed percentage target.
  // We also assert that the non-hard-no count increased relative to the
  // pre-budget baseline (1/100), confirming the budget opened the middle band.
  it("conditional bucket (seed=42): non-trivial non-hard-no pool exists after budget", () => {
    const variants = generateScenarioVariants(100, 42);

    const hardNoCount = variants.filter(v => v.hasHardNo).length;
    const nonHardNoCount = variants.filter(v => !v.hasHardNo).length;

    // The non-hard-no (CONDITIONAL-eligible) pool must be non-trivial (> 0)
    expect(nonHardNoCount).toBeGreaterThan(0);

    // The budget must have opened the middle band relative to pre-budget
    // baseline of 1/100 non-hard-no. After budget: at least 2 non-hard-no.
    expect(nonHardNoCount).toBeGreaterThan(1);

    // Sanity: counts sum to 100
    expect(hardNoCount + nonHardNoCount).toBe(100);

    // Log the distribution for the report
    console.log(`\n  Seed=42 CONDITIONAL-eligible pool (post-budget):`);
    console.log(`    Hard-no (always REJECT):       ${hardNoCount}/100`);
    console.log(`    Non-hard-no (CONDITIONAL pool): ${nonHardNoCount}/100`);
    console.log(`    (Before budget: 99/100 hard-no, 1/100 non-hard-no)`);
  });
});
