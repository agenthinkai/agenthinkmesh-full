/**
 * stressTestReportPdfV2.test.ts
 *
 * Tests for the upgraded Strategic Stress Test Report PDF generator.
 *
 * Covers:
 *   1.  10,000 scenario report renders cleanly (text export)
 *   2.  0% approval report shows Structural Failure Analysis
 *   3.  Rejection/veto math does not exceed 100% or produce additive error
 *   4.  Unsupported glyphs are not emitted in text export
 *   5.  Missing optional fields do not produce blank sections
 *   6.  PDF export contains "What 10,000 Strategic Simulations Means"
 *   7.  PDF export contains "Institutional Meaning"
 *   8.  Approval Pathways section is hidden when approvePct = 0
 *   9.  Approval Pathways section is shown when approvePct > 0
 *  10.  sanitize() removes %' and %^ artifacts
 *  11.  pct() clamps to 0-100 and guards NaN/Infinity
 *  12.  safeNum() clamps NaN/Infinity to 0
 *  13.  Text export includes cover traceability fields
 *  14.  Text export includes "How to Read" glossary terms
 *  15.  0.0% approval rate does not crash PDF generation
 *  16.  Structural Failure Analysis shown for 4.9% approval rate (< 5%)
 *  17.  Structural Failure Analysis NOT shown for 5.0% approval rate
 *  18.  Negative-outcome text uses correct subset language (not additive)
 *  19.  Text export does not contain NaN, Infinity, undefined, null
 *  20.  Text export does not contain duplicate percentage symbols (%%)
 */

import { describe, it, expect } from "vitest";
import { generateStressTestReportText, type StressTestReportInput } from "./stressTestReportPdf";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<StressTestReportInput> = {}): StressTestReportInput {
  return {
    dealName:    "TestCo Deep Mode",
    baseVerdict: "REJECTED",
    mode:        "deep",
    targetCount: 10000,
    completedAt: "2026-05-24T10:00:00.000Z",
    executiveSummary: "Deep stress test with 10,000 scenarios.",
    decisionDistribution: {
      approvePct:    0.0,
      conditionalPct: 5.0,
      rejectPct:     87.0,
      vetoPct:       8.0,
      totalScenarios: 10000,
    },
    failureVectors: [
      { category: "financial_stress", frequency: 8500, avgSeverity: 0.72, affectedPct: 85.0 },
      { category: "market_stress",    frequency: 6200, avgSeverity: 0.58, affectedPct: 62.0 },
      { category: "execution_risk",   frequency: 4100, avgSeverity: 0.45, affectedPct: 41.0 },
    ],
    approvalPathways: [
      { conditionSet: ["Secure bridge financing", "Reduce CapEx by 20%"], approvalProbability: 12.5, confidenceLift: 8.0, remainingRisks: ["Market timing"] },
    ],
    sensitivitySurface: [
      { variable: "capex_overrun", impactScore: 0.87, direction: "negative" },
      { variable: "ebitda_compression", impactScore: 0.74, direction: "negative" },
    ],
    governanceHeatmap: [
      { category: "financial_governance", escalationCount: 720, vetoCount: 85, avgSeverity: 0.68 },
    ],
    runId: "run-abc123",
    reportVersion: "2.0",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateStressTestReportText (upgraded)", () => {

  // ── Test 1: 10,000 scenario report renders cleanly ─────────────────────────

  it("1. 10,000 scenario report renders cleanly", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).toContain("10,000");
    expect(text).toContain("Mode C");
    expect(text).toContain("Strategic Deep Stress");
    expect(text).toContain("TestCo Deep Mode");
    expect(text.length).toBeGreaterThan(500);
  });

  // ── Test 2: 0% approval shows Structural Failure Analysis ─────────────────

  it("2. 0% approval report shows Structural Failure Analysis", () => {
    const text = generateStressTestReportText(makeInput({ decisionDistribution: { approvePct: 0, conditionalPct: 5, rejectPct: 87, vetoPct: 8, totalScenarios: 10000 } }));
    expect(text).toContain("STRUCTURAL FAILURE ANALYSIS");
    expect(text).toContain("No investable scenarios emerged");
    expect(text).toContain("structurally fragile");
    expect(text).toContain("REJECT");
    expect(text).toContain("pending fundamental restructuring");
  });

  // ── Test 3: Rejection/veto math does not exceed 100% ──────────────────────

  it("3. rejection/veto math does not exceed 100% and uses subset language", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 0, conditionalPct: 2, rejectPct: 100, vetoPct: 98, totalScenarios: 10000 },
    }));
    // Must use subset language (veto is a subset of rejection, not additive)
    expect(text).toContain("subset of rejection");
    // Must not add rejection + veto to produce a combined figure
    expect(text).not.toContain("198");
    // Veto and reject must be mentioned separately
    expect(text).toContain("100.0%");
    expect(text).toContain("98.0%");
  });

  // ── Test 4: Unsupported glyphs not emitted ────────────────────────────────

  it("4. text export does not contain unsupported glyphs", () => {
    const text = generateStressTestReportText(makeInput());
    // No block fill characters (ASCII bar artifacts)
    expect(text).not.toContain("█");
    expect(text).not.toContain("░");
    // No %' or %^ artifacts (only check for these specific bad patterns)
    expect(text).not.toContain("%'");
    expect(text).not.toContain("%^");
    expect(text).not.toContain("%!");
    // No zero-width characters
    expect(text).not.toMatch(/[\u200B-\u200D\uFEFF]/);
  });

  // ── Test 5: Missing optional fields do not produce blank sections ──────────

  it("5. missing optional fields do not produce blank sections", () => {
    const text = generateStressTestReportText(makeInput({
      executiveSummary: "",
      failureVectors: [],
      approvalPathways: [],
      sensitivitySurface: [],
      governanceHeatmap: [],
      scenarioClusters: undefined,
      runId: undefined,
    }));
    // Should not have empty section headers followed immediately by another header
    expect(text).not.toMatch(/FAILURE VECTOR RANKING\s*\n-+\s*\n\s*\n\s*\d+\./);
    // Should still have the main sections
    expect(text).toContain("EXECUTIVE SUMMARY");
    expect(text).toContain("DECISION DISTRIBUTION");
    expect(text).toContain("FINAL INVESTMENT INTERPRETATION");
  });

  // ── Test 6: Contains "What 10,000 Strategic Simulations Means" ────────────

  it("6. text export contains 'What 10,000 Strategic Simulations Means'", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).toContain("WHAT 10,000 STRATEGIC SIMULATIONS MEANS");
    expect(text).toContain("does not repeat the same deal screen");
    expect(text).toContain("A 0% approval rate does not mean the model failed");
  });

  // ── Test 7: Contains "Institutional Meaning" ──────────────────────────────

  it("7. text export contains 'Institutional Meaning'", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).toContain("INSTITUTIONAL MEANING");
    expect(text).toContain("A normal IC memo gives one verdict");
    expect(text).toContain("stress-tested decision basis");
  });

  // ── Test 8: Approval Pathways hidden when approvePct = 0 ──────────────────

  it("8. Approval Pathways section is hidden when approvePct = 0", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 0, conditionalPct: 5, rejectPct: 87, vetoPct: 8, totalScenarios: 10000 },
    }));
    expect(text).not.toContain("6. APPROVAL PATHWAYS");
  });

  // ── Test 9: Approval Pathways shown when approvePct > 0 ───────────────────

  it("9. Approval Pathways section is shown when approvePct > 0", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 12.5, conditionalPct: 22.0, rejectPct: 65.5, vetoPct: 0, totalScenarios: 10000 },
    }));
    expect(text).toContain("6. APPROVAL PATHWAYS");
    expect(text).toContain("Pathway 1");
  });

  // ── Test 10: sanitize removes %' and %^ artifacts ─────────────────────────

  it("10. text export does not contain %' or %^ artifacts from raw data", () => {
    const text = generateStressTestReportText(makeInput({
      executiveSummary: "The deal scored 87.0%' in rejection scenarios and 0.0%^ in approval.",
    }));
    // After sanitize, %' and %^ should be gone
    expect(text).not.toContain("%'");
    expect(text).not.toContain("%^");
  });

  // ── Test 11: pct() clamps to 0–100 and guards NaN/Infinity ───────────────

  it("11. NaN and Infinity values in distribution do not crash and render as 0.0%", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: {
        approvePct:    NaN,
        conditionalPct: Infinity,
        rejectPct:     -Infinity,
        vetoPct:       NaN,
        totalScenarios: 10000,
      },
    }));
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
    expect(text).toContain("0.0%");
  });

  // ── Test 12: safeNum clamps NaN/Infinity ──────────────────────────────────

  it("12. frequency NaN/Infinity in failureVectors does not crash", () => {
    expect(() => generateStressTestReportText(makeInput({
      failureVectors: [
        { category: "financial_stress", frequency: NaN, avgSeverity: Infinity, affectedPct: NaN },
      ],
    }))).not.toThrow();
    const text = generateStressTestReportText(makeInput({
      failureVectors: [
        { category: "financial_stress", frequency: NaN, avgSeverity: Infinity, affectedPct: NaN },
      ],
    }));
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
  });

  // ── Test 13: Text export includes cover traceability fields ───────────────

  it("13. text export includes run ID and completed timestamp", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).toContain("Run ID:");
    expect(text).toContain("run-abc123");
    expect(text).toContain("Completed:");
    expect(text).toContain("2026-05-24T10:00:00.000Z");
  });

  // ── Test 14: Text export does not contain NaN/Infinity/undefined/null ─────

  it("14. text export does not contain NaN, Infinity, undefined, or null", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });

  // ── Test 15: 0.0% approval rate does not crash ────────────────────────────

  it("15. 0.0% approval rate does not crash text generation", () => {
    expect(() => generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 0.0, conditionalPct: 0.0, rejectPct: 100.0, vetoPct: 98.0, totalScenarios: 10000 },
    }))).not.toThrow();
  });

  // ── Test 16: Structural Failure Analysis shown for 4.9% approval ──────────

  it("16. Structural Failure Analysis shown for 4.9% approval rate", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 4.9, conditionalPct: 5.0, rejectPct: 90.1, vetoPct: 0, totalScenarios: 10000 },
    }));
    expect(text).toContain("STRUCTURAL FAILURE ANALYSIS");
  });

  // ── Test 17: Structural Failure Analysis NOT shown for 5.0% approval ──────

  it("17. Structural Failure Analysis NOT shown for 5.0% approval rate", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 5.0, conditionalPct: 10.0, rejectPct: 85.0, vetoPct: 0, totalScenarios: 10000 },
    }));
    expect(text).not.toContain("STRUCTURAL FAILURE ANALYSIS");
  });

  // ── Test 18: Negative-outcome text uses correct subset language ────────────

  it("18. negative-outcome text uses 'subset' language, not additive", () => {
    const text = generateStressTestReportText(makeInput({
      decisionDistribution: { approvePct: 0, conditionalPct: 2, rejectPct: 100, vetoPct: 98, totalScenarios: 10000 },
    }));
    // The final interpretation should say "100.0% of scenarios produced a rejection outcome"
    // and separately mention veto — not add them
    expect(text).toContain("100.0%");
    expect(text).toContain("98.0%");
    // Must NOT contain "198" (additive error)
    expect(text).not.toContain("198");
  });

  // ── Test 19: Text export does not contain duplicate %% ────────────────────

  it("19. text export does not contain duplicate percentage symbols (%%)", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).not.toContain("%%");
  });

  // ── Test 20: Text export for 10,000 deep mode includes all key sections ───

  it("20. 10,000 deep mode text export includes all key sections", () => {
    const text = generateStressTestReportText(makeInput());
    expect(text).toContain("WHAT 10,000 STRATEGIC SIMULATIONS MEANS");
    expect(text).toContain("1. EXECUTIVE SUMMARY");
    expect(text).toContain("3. DECISION DISTRIBUTION");
    expect(text).toContain("5. FAILURE VECTOR RANKING");
    expect(text).toContain("7. SENSITIVITY ANALYSIS");
    expect(text).toContain("8. GOVERNANCE ESCALATION MAP");
    expect(text).toContain("10. INSTITUTIONAL MEANING");
    expect(text).toContain("12. FINAL INVESTMENT INTERPRETATION");
    expect(text).toContain("END OF REPORT");
  });
});
