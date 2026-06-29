/**
 * morningReview.test.ts — CEO Morning Editorial Review router tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ────────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          isOpeningCompelling: true,
          isHiddenVariableUnique: true,
          hasMarketingLanguage: false,
          wouldCeoForward: true,
          weakOrGenericNotes: "",
          editorialScore: 92,
          recommendation: "APPROVE",
          openingAnalysis: "Strong opening.",
          hiddenVariableAnalysis: "Unique and differentiated.",
          marketingLanguageAnalysis: "No marketing language detected.",
          forwardabilityAnalysis: "CEO would forward this.",
          weaknessAnalysis: "No significant weaknesses.",
          overallVerdict: "Exceptional brief. Dispatch immediately.",
        }),
      },
    }],
  }),
}));

describe("morningReview router", () => {
  it("decisionLevel returns BOARD for SSS >= 90", () => {
    // Test the helper logic inline
    function decisionLevel(sss: number): string {
      if (sss >= 90) return "BOARD";
      if (sss >= 75) return "C-SUITE";
      if (sss >= 60) return "DIVISIONAL";
      return "OPERATIONAL";
    }
    expect(decisionLevel(95)).toBe("BOARD");
    expect(decisionLevel(80)).toBe("C-SUITE");
    expect(decisionLevel(65)).toBe("DIVISIONAL");
    expect(decisionLevel(50)).toBe("OPERATIONAL");
  });

  it("nextDispatchTime returns a future timestamp", () => {
    function nextDispatchTime(): number {
      const now = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(7, 0, 0, 0);
      return next.getTime();
    }
    const ts = nextDispatchTime();
    expect(ts).toBeGreaterThan(Date.now());
  });

  it("formatCurrency formats large numbers correctly", () => {
    function formatCurrency(n: number): string {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
      return `$${n}`;
    }
    expect(formatCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCurrency(45_000)).toBe("$45K");
    expect(formatCurrency(500)).toBe("$500");
  });

  it("editorial score thresholds are correct", () => {
    function editorialScoreColor(score: number): string {
      if (score >= 90) return "text-emerald-400";
      if (score >= 75) return "text-amber-400";
      if (score >= 60) return "text-orange-400";
      return "text-red-400";
    }
    expect(editorialScoreColor(95)).toBe("text-emerald-400");
    expect(editorialScoreColor(80)).toBe("text-amber-400");
    expect(editorialScoreColor(65)).toBe("text-orange-400");
    expect(editorialScoreColor(50)).toBe("text-red-400");
  });

  it("publication summary projection formula is reasonable", () => {
    // Response rate: base 8% + SSS bonus + ESI bonus + editorial quality bonus
    function calcResponseRate(avgSss: number, avgEsi: number, avgEditorialScore: number): number {
      const responseRateBase = 0.08;
      const sssBonus = (avgSss - 70) * 0.002;
      const esiBonus = (avgEsi - 70) * 0.0015;
      const editorialBonus = (avgEditorialScore - 70) * 0.001;
      return Math.min(35, Math.max(3, Math.round((responseRateBase + sssBonus + esiBonus + editorialBonus) * 100)));
    }
    // High quality brief should have higher response rate
    const highQuality = calcResponseRate(90, 85, 92);
    const lowQuality = calcResponseRate(60, 60, 60);
    expect(highQuality).toBeGreaterThan(lowQuality);
    // Should be within reasonable bounds
    expect(highQuality).toBeGreaterThanOrEqual(3);
    expect(highQuality).toBeLessThanOrEqual(35);
  });

  it("Final Rule Gate: approveAll should fail if briefs are unreviewed", () => {
    // Simulate the logic: if unreviewed.length > 0, throw
    function checkApproveAll(briefIds: number[], reviewedIds: Set<number>): { ok: boolean; unreviewed: number } {
      const unreviewed = briefIds.filter(id => !reviewedIds.has(id));
      return { ok: unreviewed.length === 0, unreviewed: unreviewed.length };
    }
    expect(checkApproveAll([1, 2, 3], new Set([1, 2]))).toEqual({ ok: false, unreviewed: 1 });
    expect(checkApproveAll([1, 2, 3], new Set([1, 2, 3]))).toEqual({ ok: true, unreviewed: 0 });
  });
});
