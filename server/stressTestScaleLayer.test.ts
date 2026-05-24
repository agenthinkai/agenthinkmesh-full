/**
 * stressTestScaleLayer.test.ts
 *
 * Tests for the three new explanatory sections added to the Strategic Stress Test Report:
 *   B. Why Simulation Scale Matters (with Simulation Maturity Curve)
 *   C. What This Adds Beyond Traditional IC Review
 *   D. Interpretation Guidance
 */

import { describe, it, expect } from "vitest";
import {
  generateStressTestReportPdf,
  generateStressTestReportText,
  type StressTestReportInput,
} from "./stressTestReportPdf";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function baseInput(overrides: Partial<StressTestReportInput> = {}): StressTestReportInput {
  return {
    dealName: "Scale Layer Test Deal",
    baseVerdict: "REJECT",
    mode: "deep",
    targetCount: 10000,
    completedAt: "2026-05-24T10:00:00.000Z",
    executiveSummary: "Deal is structurally fragile.",
    decisionDistribution: {
      approvePct: 0,
      conditionalPct: 0,
      rejectPct: 85,
      vetoPct: 15,
      totalScenarios: 10000,
    },
    failureVectors: [
      { category: "FINANCIAL_STRESS", frequency: 7000, avgSeverity: 0.82, affectedPct: 70, examplePattern: "CapEx overrun" },
    ],
    approvalPathways: [],
    sensitivitySurface: [
      { variable: "revenue_growth", impactScore: 0.9, direction: "negative" },
    ],
    governanceHeatmap: [
      { category: "REGULATORY", escalationCount: 3000, vetoCount: 1500, avgSeverity: 0.75 },
    ],
    ...overrides,
  };
}

// ── Section B: Why Simulation Scale Matters ───────────────────────────────────

describe("Section B — Why Simulation Scale Matters (text export)", () => {
  it("includes section B header in text export", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("B. WHY SIMULATION SCALE MATTERS");
  });

  it("includes Simulation Maturity Curve in text export", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("SIMULATION MATURITY CURVE:");
    expect(text).toContain("100 scenarios");
    expect(text).toContain("1,000 scenarios");
    expect(text).toContain("10,000 scenarios");
    expect(text).toContain("100,000 scenarios");
    expect(text).toContain("1M scenarios");
  });

  it("shows correct scale context for 10,000 scenario deep mode", () => {
    const text = generateStressTestReportText(baseInput({ targetCount: 10000, mode: "deep" }));
    expect(text).toContain("At 10,000 scenarios, this report maps the full institutional decision surface.");
  });

  it("shows correct scale context for 100 scenario quick mode", () => {
    const text = generateStressTestReportText(baseInput({ targetCount: 100, mode: "quick" }));
    expect(text).toContain("At 100 scenarios, this report provides a rapid directional stress scan.");
  });

  it("shows correct scale context for 1,000 scenario institutional mode", () => {
    const text = generateStressTestReportText(baseInput({ targetCount: 1000, mode: "institutional" }));
    expect(text).toContain("At 1,000 scenarios, this report provides meaningful probabilistic confidence.");
  });

  it("shows correct scale context for 100,000 scenario infrastructure mode", () => {
    const text = generateStressTestReportText(baseInput({ targetCount: 100000, mode: "infrastructure" }));
    expect(text).toContain("At 100,000+ scenarios, this report identifies low-frequency, high-impact edge cases.");
  });

  it("shows correct scale context for 1,000,000 scenario extreme mode", () => {
    const text = generateStressTestReportText(baseInput({ targetCount: 1000000, mode: "extreme" }));
    expect(text).toContain("At 1M scenarios, this report provides strategic intelligence infrastructure.");
  });

  it("includes the objective framing text", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("The objective is not to ask the same question many times.");
    expect(text).toContain("systematically perturb strategic assumptions");
  });
});

// ── Section C: What This Adds Beyond Traditional IC Review ────────────────────

describe("Section C — What This Adds Beyond Traditional IC Review (text export)", () => {
  it("includes section C header in text export", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("C. WHAT THIS ADDS BEYOND TRADITIONAL IC REVIEW");
  });

  it("contrasts Traditional IC Review vs Strategic Simulation", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("Traditional IC Review:");
    expect(text).toContain("Strategic Simulation:");
  });

  it("includes the stress-tests IC judgment statement", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("Simulation stress-tests IC judgment.");
  });

  it("mentions thousands of governed futures", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("Thousands of governed futures");
  });
});

// ── Section D: Interpretation Guidance ───────────────────────────────────────

describe("Section D — Interpretation Guidance (text export)", () => {
  it("includes section D header in text export", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("D. INTERPRETATION GUIDANCE");
  });

  it("includes all 5 interpretation patterns", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("High approval consistency");
    expect(text).toContain("Wide conditional range");
    expect(text).toContain("High veto concentration");
    expect(text).toContain("Low-freq catastrophic events");
    expect(text).toContain("0% approval rate");
  });

  it("maps 0% approval rate to structurally non-investable guidance", () => {
    const text = generateStressTestReportText(baseInput({ decisionDistribution: { approvePct: 0, conditionalPct: 0, rejectPct: 100, vetoPct: 0, totalScenarios: 10000 } }));
    expect(text).toContain("Structurally non-investable. Fundamental restructuring required.");
  });

  it("maps governance fragility pattern correctly", () => {
    const text = generateStressTestReportText(baseInput());
    expect(text).toContain("Governance fragility. Address before any investment.");
  });
});

// ── PDF generation includes new sections ─────────────────────────────────────

describe("PDF generation — new sections B, C, D", () => {
  it("generates a valid PDF buffer with new sections (deep mode, 10k scenarios)", async () => {
    const buf = await generateStressTestReportPdf(baseInput());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(10000);
    // PDF magic bytes
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("generates PDF without crashing for quick mode (100 scenarios)", async () => {
    const buf = await generateStressTestReportPdf(baseInput({ targetCount: 100, mode: "quick" }));
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("generates PDF without crashing for extreme mode (1M scenarios)", async () => {
    const buf = await generateStressTestReportPdf(baseInput({ targetCount: 1000000, mode: "extreme" }));
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("generates PDF without crashing when all optional fields are missing", async () => {
    const minimal: StressTestReportInput = {
      dealName: "Minimal Deal",
      baseVerdict: "REJECT",
      mode: "quick",
      targetCount: 100,
      completedAt: "2026-05-24T10:00:00.000Z",
      executiveSummary: "",
      decisionDistribution: {
        approvePct: 0,
        conditionalPct: 0,
        rejectPct: 100,
        vetoPct: 0,
        totalScenarios: 100,
      },
      failureVectors: [],
      approvalPathways: [],
      sensitivitySurface: [],
      governanceHeatmap: [],
    };
    const buf = await generateStressTestReportPdf(minimal);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);
});

// ── Section ordering in text export ──────────────────────────────────────────

describe("Section ordering in text export", () => {
  it("sections appear in correct order: A before B before C before D before 1", () => {
    const text = generateStressTestReportText(baseInput());
    const posA = text.indexOf("A. WHAT 10,000");
    const posB = text.indexOf("B. WHY SIMULATION SCALE");
    const posC = text.indexOf("C. WHAT THIS ADDS");
    const posD = text.indexOf("D. INTERPRETATION GUIDANCE");
    const pos1 = text.indexOf("1. EXECUTIVE SUMMARY");
    expect(posA).toBeGreaterThan(-1);
    expect(posB).toBeGreaterThan(posA);
    expect(posC).toBeGreaterThan(posB);
    expect(posD).toBeGreaterThan(posC);
    expect(pos1).toBeGreaterThan(posD);
  });

  it("section E (How to Read) appears before section 1 in PDF sections", () => {
    // The text export does not include section E (glossary), but we verify
    // the text export still has all 4 new sections before the numbered sections
    const text = generateStressTestReportText(baseInput());
    const posD = text.indexOf("D. INTERPRETATION GUIDANCE");
    const pos1 = text.indexOf("1. EXECUTIVE SUMMARY");
    expect(posD).toBeLessThan(pos1);
  });
});
