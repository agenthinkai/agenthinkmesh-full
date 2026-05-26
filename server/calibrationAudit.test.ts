/**
 * calibrationAudit.test.ts
 *
 * Prompt 17.5 — Part A: Calibration audit
 *
 * Instruments generateScenarioVariants(100, 42) and emits:
 *   1. Per-level breakdown table (count, hardNoAttributed)
 *   2. Marginal contribution ranking (subset removal, sole-cause vs shared)
 *   3. Verdict flag per hard-no level (LEGITIMATE vs SUSPECT)
 *
 * No engine behavior changes. No assertions that could fail — this is a
 * diagnostic/reporting test. The output is captured in console.log so it
 * can be read from the test runner output.
 */

import { describe, it } from "vitest";
import { generateScenarioVariants, PERTURBATION_DIMENSIONS } from "./scenarioMutationEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rebuild a variant's hard-no triggers with one level removed (set to base). */
function hardNoTriggersWithout(
  perturbations: Record<string, string>,
  excludeKey: string
): string[] {
  const triggers: string[] = [];
  for (const dim of PERTURBATION_DIMENSIONS) {
    const levelId = dim.key === excludeKey
      ? dim.levels[0].id // force base
      : perturbations[dim.key];
    const level = dim.levels.find(l => l.id === levelId);
    if (level?.isHardNo) triggers.push(dim.key);
  }
  return triggers;
}

/** Pad a string to a fixed width. */
function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

// ── Audit ─────────────────────────────────────────────────────────────────────

describe("Calibration Audit — seed=42 hard-no rate", () => {
  it("Part A: per-level breakdown, marginal contribution, verdict flags", () => {
    const variants = generateScenarioVariants(100, 42);

    // ── 1. Per-level breakdown ──────────────────────────────────────────────

    // Count how many variants use each level
    const levelCount: Record<string, number> = {};
    // Count how many variants are hard-no AND have this level active
    const levelHardNoAttributed: Record<string, number> = {};

    for (const dim of PERTURBATION_DIMENSIONS) {
      for (const level of dim.levels) {
        levelCount[level.id] = 0;
        levelHardNoAttributed[level.id] = 0;
      }
    }

    for (const v of variants) {
      for (const dim of PERTURBATION_DIMENSIONS) {
        const levelId = v.perturbations[dim.key];
        if (levelId) {
          levelCount[levelId] = (levelCount[levelId] ?? 0) + 1;
          if (v.hasHardNo) {
            levelHardNoAttributed[levelId] = (levelHardNoAttributed[levelId] ?? 0) + 1;
          }
        }
      }
    }

    // Collect all hard-no levels for the table
    const hardNoLevels: Array<{
      levelId: string;
      dimKey: string;
      dimLabel: string;
      severity: string;
      approvalDelta: number;
      count: number;
      hardNoAttributed: number;
    }> = [];

    for (const dim of PERTURBATION_DIMENSIONS) {
      for (const level of dim.levels) {
        if (level.isHardNo) {
          hardNoLevels.push({
            levelId: level.id,
            dimKey: dim.key,
            dimLabel: dim.label,
            severity: level.severity,
            approvalDelta: level.approvalDelta,
            count: levelCount[level.id] ?? 0,
            hardNoAttributed: levelHardNoAttributed[level.id] ?? 0,
          });
        }
      }
    }

    // Sort by count desc
    hardNoLevels.sort((a, b) => b.count - a.count);

    console.log("\n═══════════════════════════════════════════════════════════════════════════════");
    console.log("CALIBRATION AUDIT — generateScenarioVariants(100, seed=42)");
    console.log("═══════════════════════════════════════════════════════════════════════════════\n");

    const totalVariants = variants.length;
    const hardNoVariants = variants.filter(v => v.hasHardNo).length;
    const nonHardNoVariants = totalVariants - hardNoVariants;

    console.log(`Total variants:     ${totalVariants}`);
    console.log(`Hard-no variants:   ${hardNoVariants} (${(hardNoVariants / totalVariants * 100).toFixed(1)}%)`);
    console.log(`Non-hard-no:        ${nonHardNoVariants} (${(nonHardNoVariants / totalVariants * 100).toFixed(1)}%)`);
    console.log(`Unique hard-no levels triggered: ${hardNoLevels.filter(l => l.count > 0).length}`);
    console.log();

    // ── 2. Per-level breakdown table ────────────────────────────────────────

    console.log("── PART A: Per-Level Breakdown (hard-no levels only) ──────────────────────────");
    console.log(
      pad("Level ID", 22) +
      pad("Dimension", 32) +
      pad("Sev", 10) +
      pad("Delta", 8) +
      pad("Count", 7) +
      pad("HardNoAttr", 11)
    );
    console.log("─".repeat(90));

    for (const l of hardNoLevels) {
      if (l.count === 0) continue;
      console.log(
        pad(l.levelId, 22) +
        pad(l.dimLabel, 32) +
        pad(l.severity, 10) +
        pad(l.approvalDelta.toFixed(2), 8) +
        pad(String(l.count), 7) +
        pad(String(l.hardNoAttributed), 11)
      );
    }
    console.log();

    // ── 3. Marginal contribution (subset removal) ───────────────────────────

    console.log("── PART B: Marginal Contribution Ranking (subset removal) ─────────────────────");
    console.log("For each hard-no level: remove it (force base), recount hard-nos.");
    console.log("  sole_cause = variants that become non-hard-no when this level is removed");
    console.log("  shared     = still hard-no due to another level even after removal");
    console.log();

    const marginalContributions: Array<{
      levelId: string;
      dimLabel: string;
      severity: string;
      count: number;
      soleCause: number;
      shared: number;
      marginalImpact: number; // = soleCause (variants that would escape hard-no)
    }> = [];

    for (const l of hardNoLevels) {
      if (l.count === 0) continue;

      let soleCause = 0;
      let shared = 0;

      for (const v of variants) {
        if (!v.hasHardNo) continue;
        // Only process variants where this level is actually active
        if (v.perturbations[l.dimKey] !== l.levelId) continue;

        const triggersWithout = hardNoTriggersWithout(v.perturbations, l.dimKey);
        if (triggersWithout.length === 0) {
          soleCause++;
        } else {
          shared++;
        }
      }

      marginalContributions.push({
        levelId: l.levelId,
        dimLabel: l.dimLabel,
        severity: l.severity,
        count: l.count,
        soleCause,
        shared,
        marginalImpact: soleCause,
      });
    }

    // Sort by marginalImpact desc
    marginalContributions.sort((a, b) => b.marginalImpact - a.marginalImpact);

    console.log(
      pad("Level ID", 22) +
      pad("Dimension", 32) +
      pad("Sev", 10) +
      pad("Count", 7) +
      pad("SoleCause", 10) +
      pad("Shared", 8) +
      "MarginalImpact"
    );
    console.log("─".repeat(95));

    for (const m of marginalContributions) {
      console.log(
        pad(m.levelId, 22) +
        pad(m.dimLabel, 32) +
        pad(m.severity, 10) +
        pad(String(m.count), 7) +
        pad(String(m.soleCause), 10) +
        pad(String(m.shared), 8) +
        String(m.marginalImpact)
      );
    }

    // Top 3 by marginal impact
    const top3 = marginalContributions.slice(0, 3);
    console.log();
    console.log("Top 3 levels by marginal impact (sole-cause hard-nos that would escape):");
    top3.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.levelId} (${m.dimLabel}, ${m.severity}) → ${m.marginalImpact} sole-cause hard-nos`);
    });
    console.log();

    // ── 4. Verdict flags ────────────────────────────────────────────────────

    console.log("── PART C: Verdict Flags per Hard-No Level ────────────────────────────────────");
    console.log();

    // Verdict logic:
    // LEGITIMATE: severity=extreme, OR severity=severe with approvalDelta <= -0.35
    //   (these represent genuine catastrophic outcomes: financial crisis, project abandonment,
    //    refinancing failure, etc.)
    // SUSPECT: severity=severe with approvalDelta in (-0.30, -0.35) range, OR
    //   any level that is the sole cause of hard-no but has approvalDelta > -0.30
    //   (these are severe but arguably should be handled by the cheap-path REJECT
    //    rather than a deterministic hard-no)

    type VerdictFlag = "LEGITIMATE" | "SUSPECT";

    const verdictRules: Array<{
      levelId: string;
      dimLabel: string;
      severity: string;
      approvalDelta: number;
      count: number;
      soleCause: number;
      verdict: VerdictFlag;
      rationale: string;
    }> = [];

    for (const l of hardNoLevels) {
      if (l.count === 0) continue;

      const mc = marginalContributions.find(m => m.levelId === l.levelId);
      const soleCause = mc?.soleCause ?? 0;

      let verdict: VerdictFlag;
      let rationale: string;

      if (l.severity === "extreme") {
        verdict = "LEGITIMATE";
        rationale = "Extreme severity — catastrophic outcome, deterministic reject is correct";
      } else if (l.severity === "severe" && l.approvalDelta <= -0.38) {
        verdict = "LEGITIMATE";
        rationale = `Severe + delta=${l.approvalDelta.toFixed(2)} — deep impairment, deterministic reject defensible`;
      } else if (l.severity === "severe" && l.approvalDelta <= -0.30) {
        // Borderline: severe but delta is in the -0.30 to -0.38 range
        // If the cheap-path threshold is 0.30, a base=0.0 deal would already be
        // cheap-rejected by these. Hard-no is redundant but not wrong.
        verdict = "SUSPECT";
        rationale = `Severe + delta=${l.approvalDelta.toFixed(2)} — cheap-path would already reject at base≤0; hard-no is redundant and inflates the hard-no rate`;
      } else {
        // severe with delta > -0.30 — should not be a hard-no
        verdict = "SUSPECT";
        rationale = `Severe + delta=${l.approvalDelta.toFixed(2)} — delta above -0.30; LLM middle-band should handle this, not a deterministic hard-no`;
      }

      verdictRules.push({
        levelId: l.levelId,
        dimLabel: l.dimLabel,
        severity: l.severity,
        approvalDelta: l.approvalDelta,
        count: l.count,
        soleCause,
        verdict,
        rationale,
      });
    }

    // Sort: SUSPECT first, then LEGITIMATE; within each group by count desc
    verdictRules.sort((a, b) => {
      if (a.verdict !== b.verdict) return a.verdict === "SUSPECT" ? -1 : 1;
      return b.count - a.count;
    });

    const suspects = verdictRules.filter(v => v.verdict === "SUSPECT");
    const legitimate = verdictRules.filter(v => v.verdict === "LEGITIMATE");

    console.log(`SUSPECT levels (${suspects.length}):`);
    for (const v of suspects) {
      console.log(`  ⚠  ${pad(v.levelId, 22)} | ${pad(v.dimLabel, 30)} | sev=${v.severity} | delta=${v.approvalDelta.toFixed(2)} | count=${v.count} | sole=${v.soleCause}`);
      console.log(`     Rationale: ${v.rationale}`);
    }
    console.log();
    console.log(`LEGITIMATE levels (${legitimate.length}):`);
    for (const v of legitimate) {
      console.log(`  ✓  ${pad(v.levelId, 22)} | ${pad(v.dimLabel, 30)} | sev=${v.severity} | delta=${v.approvalDelta.toFixed(2)} | count=${v.count} | sole=${v.soleCause}`);
      console.log(`     Rationale: ${v.rationale}`);
    }

    // ── 5. Summary ──────────────────────────────────────────────────────────

    console.log();
    console.log("── SUMMARY ────────────────────────────────────────────────────────────────────");
    console.log(`Hard-no rate at seed=42: ${hardNoVariants}/100 (${hardNoVariants}%)`);
    console.log(`SUSPECT hard-no levels: ${suspects.length} — these inflate the hard-no rate`);
    console.log(`LEGITIMATE hard-no levels: ${legitimate.length}`);
    console.log();

    // Estimate what the hard-no rate would be if SUSPECT levels were removed
    // (i.e., how many variants are hard-no ONLY due to SUSPECT levels)
    const suspectKeys = new Set(suspects.map(s => s.levelId));
    let hardNoOnlyFromSuspects = 0;
    for (const v of variants) {
      if (!v.hasHardNo) continue;
      const activeTriggers = v.provenance.hardNoTriggers;
      // Check if ALL active hard-no triggers for this variant are SUSPECT
      const allSuspect = activeTriggers.every(triggerKey => {
        // Find the level id for this trigger in this variant
        const dim = PERTURBATION_DIMENSIONS.find(d => d.key === triggerKey);
        if (!dim) return false;
        const levelId = v.perturbations[triggerKey];
        return suspectKeys.has(levelId);
      });
      if (allSuspect && activeTriggers.length > 0) hardNoOnlyFromSuspects++;
    }

    console.log(`Variants hard-no ONLY due to SUSPECT levels: ${hardNoOnlyFromSuspects}`);
    console.log(`Estimated hard-no rate if SUSPECT levels reclassified: ${hardNoVariants - hardNoOnlyFromSuspects}/100`);
    console.log();
    console.log("═══════════════════════════════════════════════════════════════════════════════");
  });
});
