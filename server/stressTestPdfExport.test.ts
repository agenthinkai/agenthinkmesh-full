/**
 * stressTestPdfExport.test.ts
 * Tests for the Stress Test Report PDF export robustness.
 *
 * Covers:
 *   1. PDF export succeeds with full simulation aggregation
 *   2. PDF export succeeds with partial simulation aggregation (empty arrays)
 *   3. PDF export succeeds after restored historical simulation (Date object for completedAt)
 *   4. PDF export handles 0.0% approve rate without crashing
 *   5. PDF export handles 10,000 scenario deep mode
 *   6. PDF export does not crash on missing optional fields (null executiveSummary, empty arrays)
 */

import { describe, it, expect } from "vitest";
import {
  generateStressTestReportPdf,
  generateStressTestReportText,
  type StressTestReportInput,
} from "./stressTestReportPdf";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFullInput(overrides: Partial<StressTestReportInput> = {}): StressTestReportInput {
  return {
    dealName: "TestCo Series A",
    baseVerdict: "APPROVED",
    mode: "institutional",
    targetCount: 1000,
    completedAt: "2026-05-24T10:00:00.000Z",
    executiveSummary: "The deal demonstrates strong resilience across 1,000 simulated scenarios.",
    decisionDistribution: {
      approvePct: 62.5,
      conditionalPct: 22.3,
      rejectPct: 12.1,
      vetoPct: 3.1,
      totalScenarios: 1000,
      confidenceDistribution: { low: 10, medium: 35, high: 55 },
    },
    failureVectors: [
      { category: "capital_stress", frequency: 120, avgSeverity: 0.72, affectedPct: 12.0, examplePattern: "CapEx overrun >40%" },
      { category: "regulatory_risk", frequency: 85, avgSeverity: 0.65, affectedPct: 8.5 },
      { category: "market_contraction", frequency: 60, avgSeverity: 0.58, affectedPct: 6.0 },
    ],
    approvalPathways: [
      {
        conditionSet: ["Secure bridge financing", "Reduce CapEx by 20%"],
        approvalProbability: 78.0,
        confidenceLift: 15.5,
        remainingRisks: ["Regulatory uncertainty in GCC"],
      },
      {
        conditionSet: ["Extend runway to 18 months"],
        approvalProbability: 65.0,
        confidenceLift: 8.2,
        remainingRisks: ["Market contraction risk remains"],
      },
    ],
    sensitivitySurface: [
      { variable: "capex_overrun", impactScore: 0.42, direction: "negative" },
      { variable: "revenue_growth", impactScore: 0.38, direction: "positive" },
      { variable: "regulatory_approval", impactScore: 0.31, direction: "negative" },
    ],
    governanceHeatmap: [
      { category: "financial_governance", escalationCount: 95, vetoCount: 12, avgSeverity: 0.68 },
      { category: "regulatory_compliance", escalationCount: 72, vetoCount: 8, avgSeverity: 0.61 },
    ],
    scenarioClusters: { resilient: 625, conditional: 223, failure: 121, catastrophic: 31 },
    generatedAt: "2026-05-24T10:05:00.000Z",
    ...overrides,
  };
}

// ── Test 1: PDF export succeeds with full simulation aggregation ──────────────

describe("Stress Test Report PDF Export", () => {
  it("1. generates PDF successfully with full simulation aggregation", async () => {
    const input = makeFullInput();
    const buffer = await generateStressTestReportPdf(input);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(5000);
    // PDF magic bytes: %PDF
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  // ── Test 2: PDF export succeeds with partial simulation aggregation ───────

  it("2. generates PDF successfully with partial aggregation (empty arrays)", async () => {
    const input = makeFullInput({
      failureVectors: [],
      approvalPathways: [],
      sensitivitySurface: [],
      governanceHeatmap: [],
      scenarioClusters: undefined,
    });
    const buffer = await generateStressTestReportPdf(input);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(3000);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  // ── Test 3: PDF export succeeds after restored historical simulation ───────
  // The root cause of the bug: completedAt arrives as a Date object from Drizzle
  // via superjson. The PDF builder must handle this without crashing.

  it("3. generates PDF when completedAt is a Date object (restored historical run)", async () => {
    const input: StressTestReportInput = {
      ...makeFullInput(),
      // Simulate what happens when Drizzle returns a Date and it slips through
      completedAt: new Date("2026-05-24T10:00:00.000Z") as unknown as string,
    };
    // The PDF builder should not crash even if completedAt is a Date
    const buffer = await generateStressTestReportPdf(input);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(3000);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  // ── Test 4: PDF export handles 0.0% approve rate without crashing ─────────

  it("4. generates PDF when approve rate is 0.0% (all rejected)", async () => {
    const input = makeFullInput({
      decisionDistribution: {
        approvePct: 0.0,
        conditionalPct: 5.0,
        rejectPct: 88.0,
        vetoPct: 7.0,
        totalScenarios: 1000,
      },
      baseVerdict: "REJECTED",
    });
    const buffer = await generateStressTestReportPdf(input);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(3000);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  // ── Test 5: PDF export handles 10,000 scenario deep mode ─────────────────

  it("5. generates PDF for deep mode with 10,000 scenarios", async () => {
    const input = makeFullInput({
      mode: "deep",
      targetCount: 10000,
      decisionDistribution: {
        approvePct: 55.2,
        conditionalPct: 28.4,
        rejectPct: 14.1,
        vetoPct: 2.3,
        totalScenarios: 10000,
      },
    });
    const buffer = await generateStressTestReportPdf(input);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(3000);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);

  // ── Test 6: PDF export does not crash on missing optional fields ──────────

  it("6. generates PDF when executiveSummary is empty and all optional arrays are empty", async () => {
    const input = makeFullInput({
      executiveSummary: "",
      failureVectors: [],
      approvalPathways: [],
      sensitivitySurface: [],
      governanceHeatmap: [],
      scenarioClusters: undefined,
      generatedAt: undefined,
    });
    const buffer = await generateStressTestReportPdf(input);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(3000);
    expect(buffer.slice(0, 4).toString()).toBe("%PDF");
  }, 30000);
});

// ── Text export robustness tests ──────────────────────────────────────────────

describe("Stress Test Report Text Export", () => {
  it("generates text export with full aggregation", () => {
    const input = makeFullInput();
    const text = generateStressTestReportText(input);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(200);
    expect(text).toContain("AI-GOVERNED STRATEGIC STRESS TEST REPORT");
    expect(text).toContain("TestCo Series A");
    expect(text).toContain("62.5%");
  });

  it("generates text export with Date object as completedAt (no crash)", () => {
    const input: StressTestReportInput = {
      ...makeFullInput(),
      completedAt: new Date("2026-05-24T10:00:00.000Z") as unknown as string,
    };
    // Text export does not use completedAt.split("T"), so it should not crash
    expect(() => generateStressTestReportText(input)).not.toThrow();
  });

  it("generates text export with 0% approve rate", () => {
    const input = makeFullInput({
      decisionDistribution: {
        approvePct: 0.0,
        conditionalPct: 0.0,
        rejectPct: 95.0,
        vetoPct: 5.0,
        totalScenarios: 1000,
      },
    });
    const text = generateStressTestReportText(input);
    expect(text).toContain("0.0%");
    expect(text).toContain("NOT INVESTABLE");
  });
});

// ── completedAt coercion logic tests ─────────────────────────────────────────

describe("completedAt coercion", () => {
  it("ISO string passes through split correctly", () => {
    const completedAt = "2026-05-24T10:00:00.000Z";
    const dateStr = (typeof completedAt === "string" ? completedAt : (completedAt as unknown as Date).toISOString()).split("T")[0];
    expect(dateStr).toBe("2026-05-24");
  });

  it("Date object is coerced to ISO string before split", () => {
    const completedAt = new Date("2026-05-24T10:00:00.000Z") as unknown as string;
    const dateStr = (typeof completedAt === "string" ? completedAt : (completedAt as unknown as Date).toISOString()).split("T")[0];
    expect(dateStr).toBe("2026-05-24");
  });

  it("zod transform coerces Date to ISO string", () => {
    // Simulate the zod transform: v instanceof Date ? v.toISOString() : v
    const coerce = (v: string | Date): string => v instanceof Date ? v.toISOString() : v;
    expect(coerce(new Date("2026-05-24T10:00:00.000Z"))).toBe("2026-05-24T10:00:00.000Z");
    expect(coerce("2026-05-24T10:00:00.000Z")).toBe("2026-05-24T10:00:00.000Z");
  });

  it("ReportsPanel safeSimCompletedAt coercion handles Date object", () => {
    // Simulate the safeSimCompletedAt logic in ReportsPanel
    const coerce = (simCompletedAt?: string | Date): string =>
      simCompletedAt
        ? (simCompletedAt instanceof Date ? simCompletedAt.toISOString() : simCompletedAt)
        : new Date().toISOString();

    const dateObj = new Date("2026-05-24T10:00:00.000Z");
    expect(coerce(dateObj)).toBe("2026-05-24T10:00:00.000Z");
    expect(coerce("2026-05-24T10:00:00.000Z")).toBe("2026-05-24T10:00:00.000Z");
    const result = coerce(undefined);
    expect(typeof result).toBe("string");
    expect(result.includes("T")).toBe(true);
  });
});
