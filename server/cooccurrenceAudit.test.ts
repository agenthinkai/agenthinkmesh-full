/**
 * cooccurrenceAudit.test.ts — Prompt 17.6
 *
 * Read-only investigation of per-variant severe-level co-occurrence at seed=42.
 * Produces:
 *   Part A1 — Histogram of severe-levels-per-variant (0, 1, 2, 3, 4+)
 *   Part A2 — Sole-cause variant profiles (full perturbation listing)
 *   Part A3 — Moderate and low tier histograms
 *   Part B  — Sampler mechanism characterisation (code-level, no execution needed)
 *
 * No assertions that can fail — this is a diagnostic/audit test.
 * All output is printed to stdout for capture.
 */

import { describe, it } from "vitest";
import {
  generateScenarioVariants,
  PERTURBATION_DIMENSIONS,
  type ScenarioVariant,
} from "./scenarioMutationEngine";

const SEED = 42;
const COUNT = 100;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSeverityForVariant(v: ScenarioVariant, targetSeverity: string): string[] {
  const hits: string[] = [];
  for (const dim of PERTURBATION_DIMENSIONS) {
    const levelId = v.perturbations[dim.key];
    const level = dim.levels.find(l => l.id === levelId);
    if (level && level.severity === targetSeverity) {
      hits.push(`${dim.key}:${levelId}`);
    }
  }
  return hits;
}

function buildHistogram(counts: number[]): Map<number, number> {
  const hist = new Map<number, number>();
  for (const c of counts) {
    hist.set(c, (hist.get(c) ?? 0) + 1);
  }
  return hist;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Test ───────────────────────────────────────────────────────────────────────

describe("Co-occurrence Audit — Prompt 17.6 (read-only)", () => {
  it("produces full co-occurrence report for seed=42", () => {
    const variants = generateScenarioVariants(COUNT, SEED);

    // ── Part A1: Per-variant severe count histogram ──────────────────────────
    const severeCounts = variants.map(v => getSeverityForVariant(v, "severe").length);
    const extremeCounts = variants.map(v => getSeverityForVariant(v, "extreme").length);
    // Combined: severe OR extreme (both are hard-no eligible)
    const hardEligibleCounts = variants.map((v, i) => severeCounts[i] + extremeCounts[i]);

    const severeHist = buildHistogram(severeCounts);
    const extremeHist = buildHistogram(extremeCounts);
    const hardEligibleHist = buildHistogram(hardEligibleCounts);

    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("  PART A1 — Per-variant severe-level count histogram (seed=42)");
    console.log("════════════════════════════════════════════════════════════════");
    console.log("\n  SEVERE tier only:");
    console.log("  ┌──────────────────────┬───────────────┐");
    console.log("  │ Severe levels/variant │ Variant count │");
    console.log("  ├──────────────────────┼───────────────┤");
    for (let k = 0; k <= 10; k++) {
      const cnt = severeHist.get(k) ?? 0;
      if (cnt > 0 || k <= 5) {
        const label = k === 0 ? "0 (base/mild/mod only)" : k >= 4 ? `${k}+` : `${k}`;
        console.log(`  │ ${label.padEnd(21)} │ ${String(cnt).padStart(13)} │`);
      }
    }
    console.log("  └──────────────────────┴───────────────┘");
    console.log(`\n  Severe mean:   ${mean(severeCounts).toFixed(2)}`);
    console.log(`  Severe median: ${median(severeCounts).toFixed(1)}`);

    console.log("\n  EXTREME tier only:");
    console.log("  ┌──────────────────────┬───────────────┐");
    console.log("  │ Extreme levels/variant│ Variant count │");
    console.log("  ├──────────────────────┼───────────────┤");
    for (let k = 0; k <= 5; k++) {
      const cnt = extremeHist.get(k) ?? 0;
      if (cnt > 0 || k <= 3) {
        console.log(`  │ ${String(k).padEnd(21)} │ ${String(cnt).padStart(13)} │`);
      }
    }
    console.log("  └──────────────────────┴───────────────┘");

    console.log("\n  SEVERE + EXTREME combined (hard-no eligible tiers):");
    console.log("  ┌──────────────────────┬───────────────┐");
    console.log("  │ Hard-eligible/variant │ Variant count │");
    console.log("  ├──────────────────────┼───────────────┤");
    for (let k = 0; k <= 10; k++) {
      const cnt = hardEligibleHist.get(k) ?? 0;
      if (cnt > 0 || k <= 5) {
        console.log(`  │ ${String(k).padEnd(21)} │ ${String(cnt).padStart(13)} │`);
      }
    }
    console.log("  └──────────────────────┴───────────────┘");
    console.log(`\n  Hard-eligible mean:   ${mean(hardEligibleCounts).toFixed(2)}`);
    console.log(`  Hard-eligible median: ${median(hardEligibleCounts).toFixed(1)}`);

    // ── Part A2: Sole-cause variant profiles ─────────────────────────────────
    // From 17.5 audit: 5 sole-cause variants (one per level that had sole=1).
    // Find them: for each hard-no variant, check if removing any one hard-no
    // level would make it non-hard-no.

    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("  PART A2 — Sole-cause variant profiles");
    console.log("════════════════════════════════════════════════════════════════");

    const hardNoVariants = variants.filter(v => v.hasHardNo);
    const soleCauseVariants: Array<{
      variantIndex: number;
      soleCauseLevel: string;
      fullProfile: Array<{ dimKey: string; levelId: string; severity: string; delta: number; isHardNo: boolean }>;
    }> = [];

    for (const v of hardNoVariants) {
      const hardNoLevels = v.provenance.hardNoTriggers; // dimension keys that triggered hard-no
      if (hardNoLevels.length === 1) {
        // This variant has exactly one hard-no trigger → sole-cause
        const dimKey = hardNoLevels[0];
        const dim = PERTURBATION_DIMENSIONS.find(d => d.key === dimKey)!;
        const levelId = v.perturbations[dimKey];
        const level = dim.levels.find(l => l.id === levelId)!;

        const fullProfile = PERTURBATION_DIMENSIONS.map(d => {
          const lId = v.perturbations[d.key];
          const l = d.levels.find(ll => ll.id === lId)!;
          return {
            dimKey: d.key,
            levelId: lId,
            severity: l.severity,
            delta: l.approvalDelta,
            isHardNo: l.isHardNo ?? false,
          };
        });

        soleCauseVariants.push({
          variantIndex: v.index,
          soleCauseLevel: `${dimKey}:${levelId} (${level.severity}, delta=${level.approvalDelta})`,
          fullProfile,
        });
      }
    }

    // Check for distinct variant indices
    const soleCauseIndices = new Set(soleCauseVariants.map(s => s.variantIndex));
    console.log(`\n  Sole-cause variants found: ${soleCauseVariants.length}`);
    console.log(`  Distinct variant indices:  ${soleCauseIndices.size}`);
    console.log(`  (If < ${soleCauseVariants.length}, same variant counted under multiple levels)\n`);

    for (const sc of soleCauseVariants) {
      console.log(`  ── Variant #${sc.variantIndex} ─────────────────────────────────────────`);
      console.log(`     Sole hard-no cause: ${sc.soleCauseLevel}`);
      console.log(`     Full perturbation profile:`);

      // Count non-base levels
      const nonBase = sc.fullProfile.filter(p => p.severity !== "base");
      const severeOrExtreme = sc.fullProfile.filter(p => p.severity === "severe" || p.severity === "extreme");
      const moderate = sc.fullProfile.filter(p => p.severity === "moderate");
      const mild = sc.fullProfile.filter(p => p.severity === "mild");

      console.log(`       Total non-base levels: ${nonBase.length}`);
      console.log(`       Severe/Extreme: ${severeOrExtreme.length} | Moderate: ${moderate.length} | Mild: ${mild.length}`);
      console.log(`       Total approvalDelta: ${sc.fullProfile.reduce((s, p) => s + p.delta, 0).toFixed(3)}`);
      console.log(`       Non-base dimensions:`);
      for (const p of nonBase) {
        const flag = p.isHardNo ? " ← HARD-NO" : "";
        console.log(`         ${p.dimKey.padEnd(28)} ${p.levelId.padEnd(22)} sev=${p.severity.padEnd(8)} Δ=${p.delta.toFixed(2)}${flag}`);
      }
      console.log();
    }

    // ── Part A3: Moderate and low tier histograms ────────────────────────────
    const moderateCounts = variants.map(v => getSeverityForVariant(v, "moderate").length);
    const mildCounts = variants.map(v => getSeverityForVariant(v, "mild").length);
    const baseCounts = variants.map(v => getSeverityForVariant(v, "base").length);

    console.log("════════════════════════════════════════════════════════════════");
    console.log("  PART A3 — Full tier histograms (moderate, mild, base)");
    console.log("════════════════════════════════════════════════════════════════");

    const tiers = [
      { label: "MODERATE", counts: moderateCounts },
      { label: "MILD",     counts: mildCounts },
      { label: "BASE",     counts: baseCounts },
    ];

    for (const tier of tiers) {
      const hist = buildHistogram(tier.counts);
      console.log(`\n  ${tier.label} tier:`);
      console.log(`  mean=${mean(tier.counts).toFixed(2)}, median=${median(tier.counts).toFixed(1)}`);
      console.log("  ┌──────────────────────┬───────────────┐");
      console.log("  │ Levels/variant        │ Variant count │");
      console.log("  ├──────────────────────┼───────────────┤");
      const keys = Array.from(hist.keys()).sort((a, b) => a - b);
      for (const k of keys) {
        console.log(`  │ ${String(k).padEnd(21)} │ ${String(hist.get(k)!).padStart(13)} │`);
      }
      console.log("  └──────────────────────┴───────────────┘");
    }

    // ── Part A3 bonus: full stress profile summary ───────────────────────────
    console.log("\n  Full stress profile per variant (all tiers combined):");
    console.log("  Format: variant# | base | mild | mod | sev | ext | hardNo | totalDelta");
    console.log("  ─────────────────────────────────────────────────────────────────────");
    for (const v of variants) {
      const b = getSeverityForVariant(v, "base").length;
      const mi = getSeverityForVariant(v, "mild").length;
      const mo = getSeverityForVariant(v, "moderate").length;
      const se = getSeverityForVariant(v, "severe").length;
      const ex = getSeverityForVariant(v, "extreme").length;
      const hn = v.hasHardNo ? "YES" : " no";
      const delta = v.totalApprovalDelta.toFixed(3);
      console.log(`  v${String(v.index).padStart(3)} | ${String(b).padStart(4)} | ${String(mi).padStart(4)} | ${String(mo).padStart(3)} | ${String(se).padStart(3)} | ${String(ex).padStart(3)} | ${hn}    | ${delta}`);
    }

    // ── Part B: Sampler mechanism summary ────────────────────────────────────
    console.log("\n════════════════════════════════════════════════════════════════");
    console.log("  PART B — Sampler mechanism (code-level characterisation)");
    console.log("════════════════════════════════════════════════════════════════");
    console.log(`
  Mechanism: INDEPENDENT PER-DIMENSION DRAWS with correlation boosts.
  There is NO severe-count cap, NO severity budget, NO stacking limit.

  Pass 1 (lines 536–549): For EACH of the ${PERTURBATION_DIMENSIONS.length} dimensions independently:
    r = rng()  ← one fresh LCG draw per dimension
    if      r < 0.40 → base     (40%)
    else if r < 0.68 → mild     (28%)
    else if r < 0.86 → moderate (18%)
    else if r < 0.96 → severe   (10%)
    else             → extreme   (4%)

  Pass 2 (lines 552–570): Correlation boosts.
    If dimension D is at level >= 2 (moderate+), each correlated dimension
    is bumped UP by 1 severity level (if it is currently more than 1 level
    below D). This can ONLY INCREASE severity, never decrease it.
    Correlations defined: capex↔debt↔liquidity, ebitda↔margin↔pricing,
    delayed_approvals↔construction_delays.

  Expected severe count per variant (Pass 1 only, no correlation):
    E[severe per dim] = 0.10 → E[severe per variant] = ${PERTURBATION_DIMENSIONS.length} × 0.10 = ${(PERTURBATION_DIMENSIONS.length * 0.10).toFixed(1)}
    E[extreme per dim] = 0.04 → E[extreme per variant] = ${PERTURBATION_DIMENSIONS.length} × 0.04 = ${(PERTURBATION_DIMENSIONS.length * 0.04).toFixed(1)}
    E[hard-eligible per variant] = ${PERTURBATION_DIMENSIONS.length} × 0.14 = ${(PERTURBATION_DIMENSIONS.length * 0.14).toFixed(1)}

  P(at least 1 hard-eligible level per variant):
    = 1 - P(0 hard-eligible) = 1 - (0.86)^${PERTURBATION_DIMENSIONS.length} = ${(1 - Math.pow(0.86, PERTURBATION_DIMENSIONS.length)).toFixed(4)}

  This is the structural root cause of the ~99% hard-no rate:
    With 28 independent dimensions each having a 14% chance of hitting
    severe/extreme, the probability of drawing ZERO hard-eligible levels
    is (0.86)^28 ≈ ${(Math.pow(0.86, PERTURBATION_DIMENSIONS.length) * 100).toFixed(1)}%.
    The correlation boosts (Pass 2) push this even lower.
`);

    // Verify the theoretical prediction against actual data
    const actualHardNoCount = variants.filter(v => v.hasHardNo).length;
    const theoreticalZeroSevere = Math.pow(0.86, PERTURBATION_DIMENSIONS.length);
    console.log(`  Theoretical P(no hard-eligible) = ${(theoreticalZeroSevere * 100).toFixed(1)}%`);
    console.log(`  Actual non-hard-no variants     = ${COUNT - actualHardNoCount} / ${COUNT} = ${((COUNT - actualHardNoCount) / COUNT * 100).toFixed(1)}%`);
    console.log(`  (Difference due to correlation boosts and LCG seed-specific draws)\n`);

    // No assertions — this is a diagnostic test
    // The only assertion is that the test completes without throwing
    console.log("════════════════════════════════════════════════════════════════");
    console.log("  Audit complete. See Part C in the agent report for proposals.");
    console.log("════════════════════════════════════════════════════════════════\n");
  });
});
