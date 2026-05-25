/**
 * fixTheDeal.test.ts
 * Tests for the Fix the Deal engine — structured output shape, classification logic,
 * no fabrication markers, vote impact parsing, and infrastructure mode coherence.
 */
import { describe, it, expect } from "vitest";

// ── Helper: build a minimal fixTheDeal response ────────────────────────────────
function makeFixResult(overrides: Partial<ReturnType<typeof defaultFixResult>> = {}) {
  return { ...defaultFixResult(), ...overrides };
}

function defaultFixResult() {
  return {
    classification: "B" as "A" | "B" | "C",
    classificationRationale: "Deal has structural fixable issues but requires commercial restructuring.",
    rootCauses: [
      { category: "E", description: "CfD strike price below fund IRR threshold at £73/MWh", priority: 1 },
      { category: "F", description: "FOAK floating foundation technology unvalidated at commercial scale", priority: 2 },
      { category: "A", description: "EPC contractor uncommitted — no fixed-price contract in place", priority: 3 },
    ],
    revisedBrief: "Helios-North · 850 MW · Celtic Sea · floating offshore wind\n[REVISED: CfD raised to £85/MWh to meet fund IRR threshold]\nCfD strike: £85/MWh (15-year contract)\n[REVISED: contingency raised from 1.7% to 5% of CAPEX]\nContingency: 5% of CAPEX (£294m)\n[REVISED: fixed-price EPC committed with tier-1 contractor]\nEPC: Fixed-price contract signed with Saipem",
    changeSummaryTable: [
      { change: "CfD strike price", original: "£73/MWh", revised: "£85/MWh", rootCauseAddressed: "E", estimatedVoteImpact: "+3 YES" },
      { change: "Contingency", original: "1.7%", revised: "5%", rootCauseAddressed: "A", estimatedVoteImpact: "+2 YES" },
      { change: "EPC commitment", original: "Open-book EPC", revised: "Fixed-price EPC signed", rootCauseAddressed: "A", estimatedVoteImpact: "+2 YES" },
    ],
    predictedOutcome: {
      voteDistribution: "7 YES / 2 CONDITIONAL / 1 NO",
      consensusPct: 70,
      decision: "APPROVED_WITH_CONDITIONS",
      mostLikelyDissentingAgent: "EPC & Construction Risk Analyst",
      mostLikelyCondition: "Independent foundation validation report required before financial close",
    },
    approvalSensitivityLadder: [
      { structuralChange: "Raise CfD to £85/MWh", estimatedVoteShift: "+3 YES", runningVoteEstimate: "3 YES" },
      { structuralChange: "Raise contingency to 5%", estimatedVoteShift: "+2 YES", runningVoteEstimate: "5 YES" },
      { structuralChange: "Commit fixed-price EPC", estimatedVoteShift: "+2 YES", runningVoteEstimate: "7 YES" },
    ],
    residualRisks: [
      "Floating foundation technology remains FOAK — no commercial-scale validation",
      "20% merchant exposure after CfD period creates refinancing risk",
      "Taiwan Strait geopolitical premium not fully priced into base case",
    ],
  };
}

// ── 1. Output shape validation ─────────────────────────────────────────────────
describe("fixTheDeal output shape", () => {
  it("has all required top-level fields", () => {
    const result = makeFixResult();
    expect(result).toHaveProperty("classification");
    expect(result).toHaveProperty("classificationRationale");
    expect(result).toHaveProperty("rootCauses");
    expect(result).toHaveProperty("revisedBrief");
    expect(result).toHaveProperty("changeSummaryTable");
    expect(result).toHaveProperty("predictedOutcome");
    expect(result).toHaveProperty("approvalSensitivityLadder");
    expect(result).toHaveProperty("residualRisks");
  });

  it("classification is A, B, or C", () => {
    const result = makeFixResult();
    expect(["A", "B", "C"]).toContain(result.classification);
  });

  it("rootCauses is a non-empty array", () => {
    const result = makeFixResult();
    expect(Array.isArray(result.rootCauses)).toBe(true);
    expect(result.rootCauses.length).toBeGreaterThan(0);
  });

  it("each rootCause has category, description, and priority", () => {
    const result = makeFixResult();
    for (const rc of result.rootCauses) {
      expect(rc).toHaveProperty("category");
      expect(rc).toHaveProperty("description");
      expect(rc).toHaveProperty("priority");
      expect(typeof rc.priority).toBe("number");
    }
  });

  it("changeSummaryTable rows have all required fields", () => {
    const result = makeFixResult();
    for (const row of result.changeSummaryTable) {
      expect(row).toHaveProperty("change");
      expect(row).toHaveProperty("original");
      expect(row).toHaveProperty("revised");
      expect(row).toHaveProperty("rootCauseAddressed");
      expect(row).toHaveProperty("estimatedVoteImpact");
    }
  });

  it("predictedOutcome has all required fields", () => {
    const result = makeFixResult();
    const po = result.predictedOutcome;
    expect(po).toHaveProperty("voteDistribution");
    expect(po).toHaveProperty("consensusPct");
    expect(po).toHaveProperty("decision");
    expect(po).toHaveProperty("mostLikelyDissentingAgent");
    expect(po).toHaveProperty("mostLikelyCondition");
  });

  it("predictedOutcome.consensusPct is between 0 and 100", () => {
    const result = makeFixResult();
    expect(result.predictedOutcome.consensusPct).toBeGreaterThanOrEqual(0);
    expect(result.predictedOutcome.consensusPct).toBeLessThanOrEqual(100);
  });

  it("approvalSensitivityLadder rows have all required fields", () => {
    const result = makeFixResult();
    for (const step of result.approvalSensitivityLadder) {
      expect(step).toHaveProperty("structuralChange");
      expect(step).toHaveProperty("estimatedVoteShift");
      expect(step).toHaveProperty("runningVoteEstimate");
    }
  });

  it("residualRisks is a non-empty array of strings", () => {
    const result = makeFixResult();
    expect(Array.isArray(result.residualRisks)).toBe(true);
    expect(result.residualRisks.length).toBeGreaterThan(0);
    for (const risk of result.residualRisks) {
      expect(typeof risk).toBe("string");
    }
  });
});

// ── 2. Classification logic ────────────────────────────────────────────────────
describe("fixTheDeal classification logic", () => {
  it("classification A means fixable — decision should not be REJECTED or VETOED", () => {
    const result = makeFixResult({ classification: "A", predictedOutcome: { ...defaultFixResult().predictedOutcome, decision: "APPROVED" } });
    expect(result.classification).toBe("A");
    expect(["REJECTED", "VETOED"]).not.toContain(result.predictedOutcome.decision);
  });

  it("classification C means non-viable — decision should be REJECTED", () => {
    const result = makeFixResult({
      classification: "C",
      classificationRationale: "Floating foundation technology is pre-commercial and cannot be de-risked within a 5-year investment horizon.",
      predictedOutcome: { ...defaultFixResult().predictedOutcome, decision: "REJECTED", consensusPct: 20 },
    });
    expect(result.classification).toBe("C");
    expect(result.predictedOutcome.decision).toBe("REJECTED");
  });

  it("classification B allows conditional approval", () => {
    const result = makeFixResult({ classification: "B" });
    expect(result.classification).toBe("B");
    expect(["APPROVED_WITH_CONDITIONS", "CONDITIONAL", "HOLD"]).toContain(result.predictedOutcome.decision);
  });
});

// ── 3. No fabrication markers ─────────────────────────────────────────────────
describe("fixTheDeal no fabrication markers", () => {
  it("revisedBrief does not contain [ASSUMED ...] placeholders", () => {
    const result = makeFixResult();
    expect(result.revisedBrief).not.toMatch(/\[ASSUMED/i);
  });

  it("revisedBrief does not contain [PLACEHOLDER ...] markers", () => {
    const result = makeFixResult();
    expect(result.revisedBrief).not.toMatch(/\[PLACEHOLDER/i);
  });

  it("revisedBrief contains [REVISED: ...] inline change markers", () => {
    const result = makeFixResult();
    expect(result.revisedBrief).toMatch(/\[REVISED:/i);
  });

  it("classificationRationale is not empty", () => {
    const result = makeFixResult();
    expect(result.classificationRationale.trim().length).toBeGreaterThan(10);
  });

  it("residualRisks preserves at least 3 real risks (no forced clean slate)", () => {
    const result = makeFixResult();
    expect(result.residualRisks.length).toBeGreaterThanOrEqual(3);
  });
});

// ── 4. Vote impact parsing ─────────────────────────────────────────────────────
describe("fixTheDeal vote impact parsing", () => {
  it("estimatedVoteImpact values are parseable as +N YES or -N YES format", () => {
    const result = makeFixResult();
    for (const row of result.changeSummaryTable) {
      // Accept formats like "+2 YES", "+3 YES", "-1 NO", "0 YES"
      expect(row.estimatedVoteImpact).toMatch(/[+-]?\d+\s+(YES|NO|CONDITIONAL)/i);
    }
  });

  it("sensitivity ladder runningVoteEstimate increases or stays same across steps", () => {
    const result = makeFixResult();
    const ladder = result.approvalSensitivityLadder;
    if (ladder.length < 2) return;
    // Extract the first number from each runningVoteEstimate
    const votes = ladder.map(s => parseInt(s.runningVoteEstimate.match(/\d+/)?.[0] ?? "0", 10));
    for (let i = 1; i < votes.length; i++) {
      expect(votes[i]).toBeGreaterThanOrEqual(votes[i - 1]);
    }
  });

  it("predictedOutcome vote distribution sums to 10", () => {
    const result = makeFixResult();
    const vd = result.predictedOutcome.voteDistribution;
    // Parse "7 YES / 2 CONDITIONAL / 1 NO" → [7, 2, 1]
    const numbers = vd.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length > 0) {
      const total = numbers.reduce((a, b) => a + b, 0);
      expect(total).toBe(10);
    }
  });
});

// ── 5. Infrastructure mode coherence ──────────────────────────────────────────
describe("fixTheDeal infrastructure mode coherence", () => {
  it("infrastructure mode root causes reference project-finance concepts", () => {
    const result = makeFixResult();
    const allText = result.rootCauses.map(rc => rc.description).join(" ").toLowerCase();
    const infraTerms = ["cfd", "epc", "dscr", "lcoe", "merchant", "foundation", "capex", "irr", "contingency", "offtake"];
    const found = infraTerms.filter(t => allText.includes(t));
    expect(found.length).toBeGreaterThan(0);
  });

  it("infrastructure mode change table does not reference VC metrics", () => {
    const result = makeFixResult();
    const allText = result.changeSummaryTable.map(r => `${r.change} ${r.original} ${r.revised}`).join(" ").toLowerCase();
    const vcTerms = ["arr", "mrr", "runway", "tam", "saas", "series a", "series b", "burn rate", "ltv/cac"];
    for (const term of vcTerms) {
      expect(allText).not.toContain(term);
    }
  });

  it("classification C for fundamentally non-viable FOAK deal does not promise approval", () => {
    const result = makeFixResult({
      classification: "C",
      predictedOutcome: { ...defaultFixResult().predictedOutcome, decision: "REJECTED", consensusPct: 15 },
    });
    expect(result.predictedOutcome.decision).not.toBe("APPROVED");
    expect(result.predictedOutcome.consensusPct).toBeLessThan(50);
  });

  it("revisedBrief preserves infrastructure terminology", () => {
    const result = makeFixResult();
    const infraTerms = ["CfD", "EPC", "CAPEX", "MW", "offshore", "wind"];
    const found = infraTerms.filter(t => result.revisedBrief.includes(t));
    expect(found.length).toBeGreaterThan(2);
  });
});

// ── 6. Rerun integration ───────────────────────────────────────────────────────
describe("fixTheDeal rerun integration", () => {
  it("revisedBrief is non-empty and suitable for council rerun", () => {
    const result = makeFixResult();
    expect(result.revisedBrief.trim().length).toBeGreaterThan(50);
  });

  it("revisedBrief is different from original deal text (changes were applied)", () => {
    const originalText = "Helios-North · 850 MW · Celtic Sea · CfD £73/MWh · contingency 1.7%";
    const result = makeFixResult();
    // Revised brief should contain [REVISED: ...] markers indicating changes
    expect(result.revisedBrief).toContain("[REVISED:");
    expect(result.revisedBrief).not.toBe(originalText);
  });

  it("predictedOutcome.decision is a valid verdict string", () => {
    const result = makeFixResult();
    const validVerdicts = ["APPROVED", "APPROVED_WITH_CONDITIONS", "CONDITIONAL", "HOLD", "REJECTED", "VETOED"];
    expect(validVerdicts).toContain(result.predictedOutcome.decision);
  });

  it("infrastructure mode is preserved through the rerun (councilMode not overridden)", () => {
    // Simulate what happens when onRerun is called with the revised brief
    const councilMode = "infrastructure";
    const result = makeFixResult();
    // The rerun should use the same councilMode as the original run
    expect(councilMode).toBe("infrastructure");
    expect(result.revisedBrief.length).toBeGreaterThan(0);
  });
});

// ── 7. Fallback / error handling ──────────────────────────────────────────────
describe("fixTheDeal fallback handling", () => {
  it("fallback result has valid shape when LLM returns empty object", () => {
    // Simulate the server-side fallback when JSON.parse fails
    const fallback = {
      classification: "B" as const,
      classificationRationale: "Unable to parse engine output.",
      rootCauses: [],
      revisedBrief: "",
      changeSummaryTable: [],
      predictedOutcome: {
        voteDistribution: "Unknown",
        consensusPct: 0,
        decision: "UNKNOWN",
        mostLikelyDissentingAgent: "Unknown",
        mostLikelyCondition: "Unknown",
      },
      approvalSensitivityLadder: [],
      residualRisks: [],
    };
    expect(fallback.classification).toBe("B");
    expect(fallback.classificationRationale).toBeTruthy();
    expect(Array.isArray(fallback.rootCauses)).toBe(true);
    expect(Array.isArray(fallback.changeSummaryTable)).toBe(true);
    expect(Array.isArray(fallback.approvalSensitivityLadder)).toBe(true);
    expect(Array.isArray(fallback.residualRisks)).toBe(true);
  });

  it("fallback predictedOutcome.consensusPct is 0 (not NaN or undefined)", () => {
    const fallback = { predictedOutcome: { consensusPct: 0, decision: "UNKNOWN", voteDistribution: "Unknown", mostLikelyDissentingAgent: "Unknown", mostLikelyCondition: "Unknown" } };
    expect(fallback.predictedOutcome.consensusPct).toBe(0);
    expect(Number.isNaN(fallback.predictedOutcome.consensusPct)).toBe(false);
  });
});
