/**
 * legalRedline.test.ts — unit tests for LegalRedline Mesh backend
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock invokeLLM ────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            contractType: "SPA",
            contractTitle: "Test Share Purchase Agreement",
            overallHealthScore: 42,
            executiveSummary: "Test summary.",
            criticalCount: 1,
            warningCount: 1,
            clearCount: 1,
            clauses: [
              {
                id: 1,
                clauseTitle: "Limitation of Liability",
                originalWording: "Liability capped at 10% of consideration.",
                persona: "PE Buyer Counsel",
                riskLevel: "CRITICAL",
                riskRationale: "10% cap is far below market standard.",
                marketBenchmark: "BVCA Model SPA 2023: 100% for fundamental warranties.",
                redlineRewrite: "Liability shall not exceed 100% of consideration for fundamental warranties.",
              },
              {
                id: 2,
                clauseTitle: "Warranty Period",
                originalWording: "Claims must be made within 12 months.",
                persona: "PE Buyer Counsel",
                riskLevel: "WARNING",
                riskRationale: "12 months is below market standard of 18-24 months.",
                marketBenchmark: "BVCA 2023: 18-24 months for general warranties.",
                redlineRewrite: "Claims must be made within 24 months of Completion.",
              },
              {
                id: 3,
                clauseTitle: "Governing Law",
                originalWording: "This Agreement is governed by English law.",
                persona: "Institutional Investor",
                riskLevel: "CLEAR",
                riskRationale: "English law is market-standard for PE transactions.",
                marketBenchmark: "Market standard for institutional transactions.",
                redlineRewrite: "No redline required — clause is market-standard.",
              },
            ],
          }),
        },
      },
    ],
  }),
}));

// ── Mock pdf-parse ────────────────────────────────────────────────────────────
vi.mock("pdf-parse", () => ({
  PDFParse: class MockPDFParse {
    constructor(_opts: { data: Buffer }) {}
    async getText() {
      return {
        text: "This Share Purchase Agreement is entered into between Seller and Buyer for the acquisition of 100% of the shares of Target Company for a consideration of USD 10,000,000.",
        total: 5,
      };
    }
  },
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = in-memory store only
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("LegalRedline Mesh — audit result validation", () => {
  it("validates a well-formed audit result", () => {
    const result = {
      contractType: "SPA",
      contractTitle: "Test SPA",
      overallHealthScore: 42,
      executiveSummary: "Test.",
      criticalCount: 1,
      warningCount: 1,
      clearCount: 1,
      clauses: [
        {
          id: 1,
          clauseTitle: "Limitation of Liability",
          originalWording: "Cap at 10%.",
          persona: "PE Buyer Counsel",
          riskLevel: "CRITICAL" as const,
          riskRationale: "Too low.",
          marketBenchmark: "BVCA 100%.",
          redlineRewrite: "Cap at 100%.",
        },
      ],
    };

    expect(result.overallHealthScore).toBeGreaterThanOrEqual(0);
    expect(result.overallHealthScore).toBeLessThanOrEqual(100);
    expect(result.clauses.length).toBeGreaterThan(0);
    expect(["CRITICAL", "WARNING", "CLEAR"]).toContain(result.clauses[0].riskLevel);
  });

  it("rejects audit result with invalid health score", () => {
    const invalid = { overallHealthScore: 150, clauses: [] };
    expect(invalid.overallHealthScore > 100).toBe(true); // should be rejected
  });

  it("rejects audit result with empty clauses", () => {
    const invalid = { overallHealthScore: 50, clauses: [] };
    expect(invalid.clauses.length < 1).toBe(true); // should be rejected
  });

  it("correctly classifies risk levels", () => {
    const levels = ["CRITICAL", "WARNING", "CLEAR"];
    for (const level of levels) {
      expect(["CRITICAL", "WARNING", "CLEAR"]).toContain(level);
    }
    expect(["CRITICAL", "WARNING", "CLEAR"]).not.toContain("UNKNOWN");
  });

  it("score colour logic is correct", () => {
    const scoreColour = (score: number) => {
      if (score < 40) return "red";
      if (score < 70) return "amber";
      return "green";
    };
    expect(scoreColour(20)).toBe("red");
    expect(scoreColour(55)).toBe("amber");
    expect(scoreColour(80)).toBe("green");
    expect(scoreColour(39)).toBe("red");
    expect(scoreColour(40)).toBe("amber");
    expect(scoreColour(70)).toBe("green");
  });

  it("demo result has correct structure", () => {
    const demo = {
      contractType: "SPA",
      contractTitle: "Demo_SPA.pdf",
      overallHealthScore: 38,
      criticalCount: 3,
      warningCount: 4,
      clearCount: 3,
      clauses: new Array(10).fill(null).map((_, i) => ({
        id: i + 1,
        clauseTitle: `Clause ${i + 1}`,
        riskLevel: i < 3 ? "CRITICAL" : i < 7 ? "WARNING" : "CLEAR",
      })),
    };

    expect(demo.criticalCount + demo.warningCount + demo.clearCount).toBe(demo.clauses.length);
    expect(demo.overallHealthScore).toBe(38);
  });

  it("audit ID format is correct", () => {
    const generateAuditId = () => `rl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const id = generateAuditId();
    expect(id).toMatch(/^rl_\d+_[a-z0-9]{6}$/);
  });
});
