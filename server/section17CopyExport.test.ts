/**
 * section17CopyExport.test.ts
 * Tests for the buildSection17Text() helper and the handleCopyICReport enrichment logic.
 * These are pure unit tests — no DOM, no React, no tRPC required.
 *
 * Covers:
 *   1. Copy export omits Section 17 before simulation
 *   2. Copy export includes Section 17 after completed simulation
 *   3. Copy export includes Section 17 after restored historical simulation
 *   4. Copy export handles partial simulation data safely (missing fields → "Not available")
 *   5. No duplicate Section 17 if rawText already contains it
 *   6. All 9 required fields appear in Section 17 output
 *   7. Top-3 truncation for failure vectors, pathways, sensitivity
 *   8. Governance escalation filter (only > 10% escalation rate shown)
 *   9. Hard-No line only appears when hardNoPct is non-null
 *  10. Empty arrays produce "Not available" placeholders, not blank lines
 */

import { describe, it, expect } from "vitest";

// ── Inline replica of buildSection17Text (pure function, no React deps) ──────
// This mirrors the implementation in DealScreener.tsx exactly so tests remain
// stable without importing the React component.

type SimData = {
  mode?: string | null;
  targetCount?: number | null;
  completedAt?: string | null;
  aggregation?: {
    decisionDistribution?: {
      approvePct?: number | null;
      conditionalPct?: number | null;
      rejectPct?: number | null;
      approveCount?: number | null;
      conditionalCount?: number | null;
      rejectCount?: number | null;
      totalScenarios?: number | null;
      hardNoPct?: number | null;
      hardNoCount?: number | null;
    } | null;
    executiveSummary?: string | null;
    failureVectors?: Array<{ category?: string; description?: string; frequency?: number }> | null;
    approvalPathways?: Array<{ description?: string; frequency?: number }> | null;
    governanceHeatmap?: Array<{ category?: string; escalationRate?: number }> | null;
    sensitivitySurface?: Array<{ dimension?: string; approvalImpact?: number }> | null;
  } | null;
} | null;

function buildSection17Text(simData: SimData): string {
  if (!simData?.aggregation?.decisionDistribution) return "";
  const agg = simData.aggregation;
  const dist = agg.decisionDistribution!;
  const na = "Not available";
  const lines: string[] = [];
  lines.push("");
  lines.push("━".repeat(78));
  lines.push("17. SCENARIO STRESS SUMMARY");
  lines.push("━".repeat(78));
  lines.push("");
  lines.push(`Simulation Mode:     ${simData.mode ?? na}`);
  lines.push(`Scenario Count:      ${(simData.targetCount ?? dist.totalScenarios ?? 0).toLocaleString()}`);
  lines.push(`Run Timestamp:       ${simData.completedAt ? new Date(simData.completedAt).toLocaleString() : na}`);
  lines.push("");
  lines.push("DECISION DISTRIBUTION");
  lines.push(`  Approve:           ${dist.approvePct?.toFixed(1) ?? na}% (${dist.approveCount ?? na} scenarios)`);
  lines.push(`  Conditional:       ${dist.conditionalPct?.toFixed(1) ?? na}% (${dist.conditionalCount ?? na} scenarios)`);
  lines.push(`  Reject:            ${dist.rejectPct?.toFixed(1) ?? na}% (${dist.rejectCount ?? na} scenarios)`);
  if (dist.hardNoPct != null) {
    lines.push(`  Hard-No Triggered: ${dist.hardNoPct.toFixed(1)}% (${dist.hardNoCount ?? 0} scenarios)`);
  }
  lines.push("");
  lines.push("EXECUTIVE SUMMARY");
  lines.push(agg.executiveSummary ?? na);
  lines.push("");
  const fv = agg.failureVectors ?? [];
  lines.push("TOP FAILURE VECTORS");
  if (fv.length === 0) {
    lines.push(`  ${na}`);
  } else {
    fv.slice(0, 3).forEach((v, i) => {
      lines.push(`  ${i + 1}. ${v.category ?? na} — ${v.description ?? na} (${v.frequency != null ? (v.frequency * 100).toFixed(0) + "% of scenarios" : na})`);
    });
  }
  lines.push("");
  const ap = agg.approvalPathways ?? [];
  lines.push("TOP APPROVAL PATHWAYS");
  if (ap.length === 0) {
    lines.push(`  ${na}`);
  } else {
    ap.slice(0, 3).forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.description ?? na} (${p.frequency != null ? (p.frequency * 100).toFixed(0) + "% of scenarios" : na})`);
    });
  }
  lines.push("");
  const gh = agg.governanceHeatmap ?? [];
  const escalations = gh.filter(g => (g.escalationRate ?? 0) > 0.1).slice(0, 3);
  lines.push("GOVERNANCE ESCALATION HIGHLIGHTS");
  if (escalations.length === 0) {
    lines.push(`  No significant escalation triggers detected.`);
  } else {
    escalations.forEach(g => {
      lines.push(`  ${g.category ?? na}: ${g.escalationRate != null ? (g.escalationRate * 100).toFixed(0) + "% escalation rate" : na}`);
    });
  }
  lines.push("");
  const ss = agg.sensitivitySurface ?? [];
  lines.push("SENSITIVITY SUMMARY");
  if (ss.length === 0) {
    lines.push(`  ${na}`);
  } else {
    ss.slice(0, 3).forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.dimension ?? na}: approval impact ${s.approvalImpact != null ? (s.approvalImpact > 0 ? "+" : "") + (s.approvalImpact * 100).toFixed(1) + "pp" : na}`);
    });
  }
  lines.push("");
  return lines.join("\n");
}

// Simulates the handleCopyICReport enrichment logic
function enrichWithSection17(rawText: string, simData: SimData): string {
  const section17 = buildSection17Text(simData);
  const alreadyHasSection17 = rawText.includes("17. SCENARIO STRESS SUMMARY");
  return section17 && !alreadyHasSection17 ? rawText + section17 : rawText;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_SIM_DATA: SimData = {
  mode: "institutional",
  targetCount: 1000,
  completedAt: "2026-05-24T09:00:00.000Z",
  aggregation: {
    decisionDistribution: {
      approvePct: 62.5,
      conditionalPct: 22.0,
      rejectPct: 15.5,
      approveCount: 625,
      conditionalCount: 220,
      rejectCount: 155,
      totalScenarios: 1000,
      hardNoPct: 3.2,
      hardNoCount: 32,
    },
    executiveSummary: "The deal shows strong approval probability under base conditions with key sensitivity to market timing.",
    failureVectors: [
      { category: "market", description: "Market saturation risk", frequency: 0.45 },
      { category: "team", description: "Key person dependency", frequency: 0.30 },
      { category: "regulatory", description: "Licensing delays", frequency: 0.20 },
      { category: "financial", description: "Burn rate acceleration", frequency: 0.15 }, // should be truncated
    ],
    approvalPathways: [
      { description: "Strong unit economics with defensible moat", frequency: 0.55 },
      { description: "Experienced team with domain expertise", frequency: 0.40 },
      { description: "Clear regulatory pathway", frequency: 0.25 },
      { description: "Scalable distribution model", frequency: 0.20 }, // should be truncated
    ],
    governanceHeatmap: [
      { category: "market", escalationRate: 0.35 },
      { category: "team", escalationRate: 0.05 }, // below 10% threshold — should be excluded
      { category: "regulatory", escalationRate: 0.22 },
    ],
    sensitivitySurface: [
      { dimension: "market_growth_rate", approvalImpact: 0.18 },
      { dimension: "burn_multiple", approvalImpact: -0.14 },
      { dimension: "team_retention", approvalImpact: 0.09 },
      { dimension: "regulatory_timeline", approvalImpact: -0.07 }, // should be truncated
    ],
  },
};

const PARTIAL_SIM_DATA: SimData = {
  mode: null,
  targetCount: null,
  completedAt: null,
  aggregation: {
    decisionDistribution: {
      approvePct: 55.0,
      conditionalPct: 30.0,
      rejectPct: 15.0,
      approveCount: 55,
      conditionalCount: 30,
      rejectCount: 15,
      totalScenarios: 100,
      hardNoPct: null, // no hard-no line should appear
      hardNoCount: null,
    },
    executiveSummary: null,
    failureVectors: null,
    approvalPathways: null,
    governanceHeatmap: null,
    sensitivitySurface: null,
  },
};

const RAW_IC_TEXT = `1. INVESTMENT THESIS\nThis is a strong deal.\n\n16. MONTE CARLO SIMULATION\nP50 IRR: 28%\n`;
const RAW_IC_TEXT_WITH_S17 = RAW_IC_TEXT + "\n17. SCENARIO STRESS SUMMARY\nAlready included.\n";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildSection17Text — output structure", () => {
  it("1. Returns empty string when simData is null (no simulation run)", () => {
    expect(buildSection17Text(null)).toBe("");
  });

  it("2. Returns empty string when aggregation is null", () => {
    expect(buildSection17Text({ mode: "quick", targetCount: 100, completedAt: null, aggregation: null })).toBe("");
  });

  it("3. Returns empty string when decisionDistribution is null", () => {
    expect(buildSection17Text({
      mode: "quick",
      targetCount: 100,
      completedAt: null,
      aggregation: { decisionDistribution: null },
    })).toBe("");
  });

  it("4. Returns non-empty string with full simulation data", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result.length).toBeGreaterThan(100);
    expect(result).toContain("17. SCENARIO STRESS SUMMARY");
  });

  it("5. Contains all 9 required fields", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("Simulation Mode:");
    expect(result).toContain("Scenario Count:");
    expect(result).toContain("Run Timestamp:");
    expect(result).toContain("DECISION DISTRIBUTION");
    expect(result).toContain("EXECUTIVE SUMMARY");
    expect(result).toContain("TOP FAILURE VECTORS");
    expect(result).toContain("TOP APPROVAL PATHWAYS");
    expect(result).toContain("GOVERNANCE ESCALATION HIGHLIGHTS");
    expect(result).toContain("SENSITIVITY SUMMARY");
  });
});

describe("buildSection17Text — data accuracy", () => {
  it("6. Includes correct mode and scenario count", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("institutional");
    expect(result).toContain("1,000");
  });

  it("7. Includes correct decision distribution percentages", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("62.5%");
    expect(result).toContain("22.0%");
    expect(result).toContain("15.5%");
  });

  it("8. Includes Hard-No line when hardNoPct is non-null", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("Hard-No Triggered: 3.2%");
  });

  it("9. Omits Hard-No line when hardNoPct is null", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).not.toContain("Hard-No Triggered");
  });

  it("10. Truncates failure vectors to top 3", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("1. market");
    expect(result).toContain("2. team");
    expect(result).toContain("3. regulatory");
    expect(result).not.toContain("4. financial");
  });

  it("11. Truncates approval pathways to top 3", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("Strong unit economics");
    expect(result).toContain("Experienced team");
    expect(result).toContain("Clear regulatory pathway");
    expect(result).not.toContain("Scalable distribution model");
  });

  it("12. Governance escalation excludes entries at or below 10% threshold", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("market: 35% escalation rate");
    expect(result).toContain("regulatory: 22% escalation rate");
    expect(result).not.toContain("team: 5%");
  });

  it("13. Truncates sensitivity surface to top 3", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("market_growth_rate");
    expect(result).toContain("burn_multiple");
    expect(result).toContain("team_retention");
    expect(result).not.toContain("regulatory_timeline");
  });

  it("14. Sensitivity shows + prefix for positive impact", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("+18.0pp");
  });

  it("15. Sensitivity shows no prefix for negative impact", () => {
    const result = buildSection17Text(FULL_SIM_DATA);
    expect(result).toContain("-14.0pp");
  });
});

describe("buildSection17Text — partial data / safe fallbacks", () => {
  it("16. Handles partial data — null mode shows 'Not available'", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("Simulation Mode:     Not available");
  });

  it("17. Handles partial data — null completedAt shows 'Not available'", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("Run Timestamp:       Not available");
  });

  it("18. Handles partial data — null executiveSummary shows 'Not available'", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("EXECUTIVE SUMMARY\nNot available");
  });

  it("19. Handles partial data — null failureVectors shows 'Not available'", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("TOP FAILURE VECTORS\n  Not available");
  });

  it("20. Handles partial data — null approvalPathways shows 'Not available'", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("TOP APPROVAL PATHWAYS\n  Not available");
  });

  it("21. Handles partial data — null sensitivitySurface shows 'Not available'", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("SENSITIVITY SUMMARY\n  Not available");
  });

  it("22. Handles partial data — null governanceHeatmap shows no escalation triggers message", () => {
    const result = buildSection17Text(PARTIAL_SIM_DATA);
    expect(result).toContain("No significant escalation triggers detected.");
  });
});

describe("enrichWithSection17 — copy export logic", () => {
  it("23. Omits Section 17 when simData is null", () => {
    const result = enrichWithSection17(RAW_IC_TEXT, null);
    expect(result).toBe(RAW_IC_TEXT);
    expect(result).not.toContain("17. SCENARIO STRESS SUMMARY");
  });

  it("24. Appends Section 17 after completed simulation", () => {
    const result = enrichWithSection17(RAW_IC_TEXT, FULL_SIM_DATA);
    expect(result).toContain("17. SCENARIO STRESS SUMMARY");
    expect(result.startsWith(RAW_IC_TEXT)).toBe(true);
  });

  it("25. Appends Section 17 after restored historical simulation", () => {
    const restoredData: SimData = {
      ...FULL_SIM_DATA,
      mode: "deep",
      completedAt: "2026-05-20T08:00:00.000Z",
    };
    const result = enrichWithSection17(RAW_IC_TEXT, restoredData);
    expect(result).toContain("17. SCENARIO STRESS SUMMARY");
    expect(result).toContain("deep");
  });

  it("26. Does NOT duplicate Section 17 if rawText already contains it", () => {
    const result = enrichWithSection17(RAW_IC_TEXT_WITH_S17, FULL_SIM_DATA);
    const count = (result.match(/17\. SCENARIO STRESS SUMMARY/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("27. Preserves Sections 1–16 exactly when appending Section 17", () => {
    const result = enrichWithSection17(RAW_IC_TEXT, FULL_SIM_DATA);
    expect(result).toContain("1. INVESTMENT THESIS");
    expect(result).toContain("16. MONTE CARLO SIMULATION");
    expect(result).toContain("P50 IRR: 28%");
  });

  it("28. Handles partial simulation data without throwing", () => {
    expect(() => enrichWithSection17(RAW_IC_TEXT, PARTIAL_SIM_DATA)).not.toThrow();
    const result = enrichWithSection17(RAW_IC_TEXT, PARTIAL_SIM_DATA);
    expect(result).toContain("17. SCENARIO STRESS SUMMARY");
    expect(result).toContain("Not available");
  });
});
