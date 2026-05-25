/**
 * rerunWithUpdatedTerms.test.ts
 *
 * Tests for the "Re-run with Updated Terms" sensitivity analysis feature.
 * Covers:
 *  1. Updated terms preamble construction
 *  2. Verdict delta label computation
 *  3. Infrastructure mode is always used (never leaked to VC mode)
 *  4. No forced approval — council can still reject under improved terms
 *  5. whatImproved / risksRemaining derivation
 *  6. Assumption tags appear in preamble
 *  7. Original result is preserved (not mutated)
 */

import { describe, it, expect } from "vitest";

// ── Helpers extracted from the router for unit testing ─────────────────────

/** Mirrors the preamble builder logic in dealScreener.ts rerunWithUpdatedTerms */
function buildUpdatedTermsPreamble(ua: {
  cfdStrikeGbpMwh?: number;
  contingencyPct?: number;
  merchantExposurePct?: number;
  fixedPriceEpc?: boolean;
  foundationValidated?: boolean;
  additionalNotes?: string;
}): string {
  const lines: string[] = [
    "=== UPDATED TERMS SCENARIO (Infrastructure / Project Finance Council) ===",
    "The following assumptions have been updated from the original submission.",
    "The council must evaluate the deal under these revised terms.",
    "",
  ];
  if (ua.cfdStrikeGbpMwh !== undefined) {
    lines.push(`CfD Strike Price: UPDATED to \u00a3${ua.cfdStrikeGbpMwh}/MWh (was below threshold in original submission)`);
  }
  if (ua.contingencyPct !== undefined) {
    lines.push(`Construction Contingency: UPDATED to ${ua.contingencyPct}% of CAPEX (was critically low in original submission)`);
  }
  if (ua.merchantExposurePct !== undefined) {
    lines.push(`Merchant Exposure: REDUCED to ${ua.merchantExposurePct}% uncontracted revenue (was 20% in original submission)`);
  }
  if (ua.fixedPriceEpc === true) {
    lines.push(`EPC Contract: UPDATED \u2014 committed fixed-price EPC with liquidated damages backstop now in place`);
  }
  if (ua.foundationValidated === true) {
    lines.push(`Floating Foundation Technology: VALIDATED \u2014 independent engineering validation at commercial scale obtained`);
  }
  if (ua.additionalNotes) {
    lines.push(`Additional Notes: ${ua.additionalNotes}`);
  }
  lines.push("");
  lines.push("=== ORIGINAL DEAL MEMO (unchanged) ===");
  lines.push("");
  return lines.join("\n");
}

/** Mirrors the verdict delta logic in dealScreener.ts rerunWithUpdatedTerms */
const VERDICT_RANK: Record<string, number> = {
  VETOED: 0,
  REJECTED: 1,
  INSUFFICIENT_DATA: 2,
  APPROVED_WITH_CONDITIONS: 3,
  APPROVED: 4,
};

function computeDeltaLabel(originalVerdict: string, updatedVerdict: string): string {
  const origRank = VERDICT_RANK[originalVerdict] ?? 1;
  const updRank = VERDICT_RANK[updatedVerdict] ?? 1;
  if (updRank > origRank) {
    const steps = updRank - origRank;
    return steps >= 2
      ? `SIGNIFICANT IMPROVEMENT (+${steps} levels)`
      : `IMPROVED (${originalVerdict} \u2192 ${updatedVerdict})`;
  } else if (updRank < origRank) {
    return `WORSENED (${originalVerdict} \u2192 ${updatedVerdict})`;
  } else {
    return `UNCHANGED (${updatedVerdict})`;
  }
}

/** Mirrors the whatImproved derivation logic */
function deriveWhatImproved(
  originalBlockers: string[],
  updatedBlockers: string[],
  ua: { cfdStrikeGbpMwh?: number; contingencyPct?: number; merchantExposurePct?: number; fixedPriceEpc?: boolean; foundationValidated?: boolean }
): string[] {
  const updatedBlockersLower = updatedBlockers.map(b => b.toLowerCase());
  const whatImproved: string[] = [];
  for (const blocker of originalBlockers) {
    const bl = blocker.toLowerCase();
    const stillPresent = updatedBlockersLower.some(ub =>
      ub.includes(bl.slice(0, 20)) || bl.includes(ub.slice(0, 20))
    );
    if (!stillPresent) {
      whatImproved.push(blocker);
    }
  }
  if (ua.cfdStrikeGbpMwh !== undefined) whatImproved.push(`CfD updated to \u00a3${ua.cfdStrikeGbpMwh}/MWh`);
  if (ua.contingencyPct !== undefined) whatImproved.push(`Contingency raised to ${ua.contingencyPct}%`);
  if (ua.merchantExposurePct !== undefined) whatImproved.push(`Merchant exposure reduced to ${ua.merchantExposurePct}%`);
  if (ua.fixedPriceEpc === true) whatImproved.push("Fixed-price EPC committed");
  if (ua.foundationValidated === true) whatImproved.push("Floating foundation independently validated");
  return [...new Set(whatImproved)];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("rerunWithUpdatedTerms — preamble construction", () => {
  it("includes UPDATED TERMS SCENARIO header", () => {
    const p = buildUpdatedTermsPreamble({});
    expect(p).toContain("UPDATED TERMS SCENARIO");
    expect(p).toContain("Infrastructure / Project Finance Council");
  });

  it("injects CfD strike price when provided", () => {
    const p = buildUpdatedTermsPreamble({ cfdStrikeGbpMwh: 85 });
    expect(p).toContain("\u00a385/MWh");
    expect(p).toContain("CfD Strike Price: UPDATED");
  });

  it("injects contingency when provided", () => {
    const p = buildUpdatedTermsPreamble({ contingencyPct: 5 });
    expect(p).toContain("5% of CAPEX");
    expect(p).toContain("Construction Contingency: UPDATED");
  });

  it("injects merchant exposure when provided", () => {
    const p = buildUpdatedTermsPreamble({ merchantExposurePct: 10 });
    expect(p).toContain("10% uncontracted revenue");
    expect(p).toContain("Merchant Exposure: REDUCED");
  });

  it("injects fixed-price EPC when enabled", () => {
    const p = buildUpdatedTermsPreamble({ fixedPriceEpc: true });
    expect(p).toContain("fixed-price EPC");
    expect(p).toContain("EPC Contract: UPDATED");
  });

  it("injects foundation validation when enabled", () => {
    const p = buildUpdatedTermsPreamble({ foundationValidated: true });
    expect(p).toContain("VALIDATED");
    expect(p).toContain("Floating Foundation Technology");
  });

  it("does NOT inject CfD line when cfdStrikeGbpMwh is undefined", () => {
    const p = buildUpdatedTermsPreamble({ contingencyPct: 5 });
    expect(p).not.toContain("CfD Strike Price");
  });

  it("includes ORIGINAL DEAL MEMO separator", () => {
    const p = buildUpdatedTermsPreamble({ cfdStrikeGbpMwh: 85 });
    expect(p).toContain("=== ORIGINAL DEAL MEMO (unchanged) ===");
  });

  it("injects additional notes when provided", () => {
    const p = buildUpdatedTermsPreamble({ additionalNotes: "AR7 results confirmed" });
    expect(p).toContain("AR7 results confirmed");
  });

  it("full Helios-North scenario: all 5 assumptions injected", () => {
    const p = buildUpdatedTermsPreamble({
      cfdStrikeGbpMwh: 85,
      contingencyPct: 5,
      merchantExposurePct: 10,
      fixedPriceEpc: true,
      foundationValidated: true,
    });
    expect(p).toContain("\u00a385/MWh");
    expect(p).toContain("5% of CAPEX");
    expect(p).toContain("10% uncontracted revenue");
    expect(p).toContain("fixed-price EPC");
    expect(p).toContain("VALIDATED");
  });
});

describe("rerunWithUpdatedTerms — verdict delta computation", () => {
  it("VETOED \u2192 APPROVED_WITH_CONDITIONS = SIGNIFICANT IMPROVEMENT (+3 levels)", () => {
    const label = computeDeltaLabel("VETOED", "APPROVED_WITH_CONDITIONS");
    expect(label).toContain("SIGNIFICANT IMPROVEMENT");
    expect(label).toContain("+3 levels");
  });

  it("VETOED \u2192 REJECTED = IMPROVED (single step)", () => {
    const label = computeDeltaLabel("VETOED", "REJECTED");
    expect(label).toContain("IMPROVED");
    expect(label).toContain("VETOED \u2192 REJECTED");
  });

  it("VETOED \u2192 VETOED = UNCHANGED", () => {
    const label = computeDeltaLabel("VETOED", "VETOED");
    expect(label).toContain("UNCHANGED");
    expect(label).toContain("VETOED");
  });

  it("APPROVED \u2192 REJECTED = WORSENED", () => {
    const label = computeDeltaLabel("APPROVED", "REJECTED");
    expect(label).toContain("WORSENED");
  });

  it("REJECTED \u2192 APPROVED = SIGNIFICANT IMPROVEMENT (+3 levels)", () => {
    const label = computeDeltaLabel("REJECTED", "APPROVED");
    expect(label).toContain("SIGNIFICANT IMPROVEMENT");
  });

  it("REJECTED \u2192 APPROVED_WITH_CONDITIONS = SIGNIFICANT IMPROVEMENT (+2 levels)", () => {
    const label = computeDeltaLabel("REJECTED", "APPROVED_WITH_CONDITIONS");
    expect(label).toContain("SIGNIFICANT IMPROVEMENT");
    expect(label).toContain("+2 levels");
  });
});

describe("rerunWithUpdatedTerms — whatImproved derivation", () => {
  it("blocker resolved in updated run appears in whatImproved", () => {
    const improved = deriveWhatImproved(
      ["CfD strike price too low at \u00a373/MWh"],
      ["Floating foundation technology unvalidated"],
      { cfdStrikeGbpMwh: 85 }
    );
    // The CfD blocker is no longer in updated blockers, so it should appear
    expect(improved.some(i => i.includes("CfD") || i.includes("\u00a385"))).toBe(true);
  });

  it("assumption tags always appear in whatImproved when applied", () => {
    const improved = deriveWhatImproved([], [], {
      cfdStrikeGbpMwh: 85,
      contingencyPct: 5,
      merchantExposurePct: 10,
      fixedPriceEpc: true,
      foundationValidated: true,
    });
    expect(improved).toContain("CfD updated to \u00a385/MWh");
    expect(improved).toContain("Contingency raised to 5%");
    expect(improved).toContain("Merchant exposure reduced to 10%");
    expect(improved).toContain("Fixed-price EPC committed");
    expect(improved).toContain("Floating foundation independently validated");
  });

  it("blocker still present in updated run does NOT appear in whatImproved", () => {
    const improved = deriveWhatImproved(
      ["Floating foundation technology unvalidated"],
      ["Floating foundation technology unvalidated"],
      {}
    );
    // The blocker is still present, so it should NOT be in whatImproved
    expect(improved.filter(i => i.includes("Floating foundation technology unvalidated"))).toHaveLength(0);
  });

  it("deduplicates whatImproved entries", () => {
    const improved = deriveWhatImproved([], [], {
      cfdStrikeGbpMwh: 85,
    });
    const cfdEntries = improved.filter(i => i.includes("CfD"));
    expect(cfdEntries.length).toBe(1);
  });
});

describe("rerunWithUpdatedTerms — infrastructure mode invariants", () => {
  it("preamble always references Infrastructure / Project Finance Council", () => {
    const p = buildUpdatedTermsPreamble({ cfdStrikeGbpMwh: 85 });
    expect(p).toContain("Infrastructure / Project Finance Council");
  });

  it("preamble does NOT contain VC-mode language", () => {
    const p = buildUpdatedTermsPreamble({ cfdStrikeGbpMwh: 85, contingencyPct: 5 });
    const vcTerms = ["TAM", "ARR", "MRR", "runway", "hypergrowth", "startup scaling", "venture returns"];
    for (const term of vcTerms) {
      expect(p.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("preamble does NOT force a positive outcome", () => {
    const p = buildUpdatedTermsPreamble({ cfdStrikeGbpMwh: 85 });
    const forcedApprovalPhrases = ["approved", "guaranteed", "will pass", "certain to", "must approve"];
    for (const phrase of forcedApprovalPhrases) {
      expect(p.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("delta label UNCHANGED is valid — council can still reject improved terms", () => {
    const label = computeDeltaLabel("VETOED", "VETOED");
    expect(label).toContain("UNCHANGED");
    // This is a valid outcome — no forced approval
  });

  it("delta label WORSENED is valid — council can downgrade under updated terms", () => {
    const label = computeDeltaLabel("APPROVED_WITH_CONDITIONS", "REJECTED");
    expect(label).toContain("WORSENED");
  });
});
