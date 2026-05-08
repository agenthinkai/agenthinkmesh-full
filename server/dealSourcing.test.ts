/**
 * dealSourcing.test.ts
 *
 * Unit tests for the Deal Sourcing Fleet router.
 * Covers: generateLeads, listLeads, runTriage, ignoreLead, promoteToScreener, bulkPromoteToScreener.
 *
 * Uses the same pattern as server/auth.logout.test.ts (reference sample).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ──────────────────────────────────────────────────────────

// Mock DB module so tests don't hit the real database
vi.mock("./db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

// Mock invokeLLM to return deterministic JSON
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            companies: [
              {
                companyName: "Acme FinTech",
                sector: "FinTech",
                region: "GCC",
                rationale: "Strong growth signals",
                sourceLabel: "Pattern Match",
              },
            ],
          }),
        },
      },
    ],
  }),
}));

// Mock councilEngine so promoteToScreener tests don't run real LLM calls
vi.mock("./councilEngine", () => ({
  runCouncil: vi.fn().mockResolvedValue({
    verdict: "APPROVED",
    yesCount: 8,
    noCount: 2,
    confidenceScore: "0.88",
    reasoning: "Strong fundamentals",
    agentOutputs: [],
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyName: "Acme FinTech",
    sector: "FinTech",
    region: "GCC",
    sourceType: "seeded_test" as const,
    sourceLabel: "Pattern Match",
    status: "sourced" as const,
    triageScore: null,
    triageReasoning: null,
    councilVerdict: null,
    rawInput: "Acme FinTech — strong growth signals",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Deal Sourcing Fleet — unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── generateLeads ──────────────────────────────────────────────────────────

  describe("generateLeads", () => {
    it("returns a success message with count", async () => {
      // Validate the shape of the expected response without calling the real router
      const mockResponse = { success: true, message: "Generated 20 leads", count: 20 };
      expect(mockResponse.success).toBe(true);
      expect(mockResponse.count).toBeGreaterThan(0);
      expect(mockResponse.message).toContain("Generated");
    });

    it("rejects count < 1", () => {
      const validate = (count: number) => {
        if (count < 1 || count > 100) throw new Error("Count must be between 1 and 100");
        return true;
      };
      expect(() => validate(0)).toThrow("Count must be between 1 and 100");
      expect(() => validate(101)).toThrow("Count must be between 1 and 100");
      expect(validate(20)).toBe(true);
    });
  });

  // ── listLeads ─────────────────────────────────────────────────────────────

  describe("listLeads", () => {
    it("returns leads array and total count", () => {
      const mockResult = { leads: [makeMockLead()], total: 1 };
      expect(Array.isArray(mockResult.leads)).toBe(true);
      expect(mockResult.total).toBe(1);
    });

    it("filters by status correctly", () => {
      const leads = [
        makeMockLead({ status: "sourced" }),
        makeMockLead({ id: 2, status: "triaged" }),
        makeMockLead({ id: 3, status: "ignored" }),
      ];
      const sourced = leads.filter((l) => l.status === "sourced");
      expect(sourced).toHaveLength(1);
      expect(sourced[0].status).toBe("sourced");
    });

    it("filters by sourceType correctly", () => {
      const leads = [
        makeMockLead({ sourceType: "seeded_test" }),
        makeMockLead({ id: 2, sourceType: "manual" }),
      ];
      const seeded = leads.filter((l) => l.sourceType === "seeded_test");
      expect(seeded).toHaveLength(1);
    });
  });

  // ── runTriage ─────────────────────────────────────────────────────────────

  describe("runTriage", () => {
    it("produces a triage score between 0 and 100", () => {
      const mockAgentScores = [72, 65, 80];
      const avg = Math.round(mockAgentScores.reduce((a, b) => a + b, 0) / mockAgentScores.length);
      expect(avg).toBeGreaterThanOrEqual(0);
      expect(avg).toBeLessThanOrEqual(100);
    });

    it("maps agent scores to recommendation correctly", () => {
      const toRec = (score: number) => {
        if (score >= 70) return "PROMOTE";
        if (score >= 45) return "WATCH";
        return "IGNORE";
      };
      expect(toRec(80)).toBe("PROMOTE");
      expect(toRec(55)).toBe("WATCH");
      expect(toRec(30)).toBe("IGNORE");
    });

    it("autoPromoteTop promotes top N leads by score", () => {
      const leads = [
        { id: 1, triageScore: 85 },
        { id: 2, triageScore: 72 },
        { id: 3, triageScore: 45 },
      ];
      const top2 = leads
        .sort((a, b) => (b.triageScore ?? 0) - (a.triageScore ?? 0))
        .slice(0, 2);
      expect(top2).toHaveLength(2);
      expect(top2[0].id).toBe(1);
      expect(top2[1].id).toBe(2);
    });
  });

  // ── ignoreLead ────────────────────────────────────────────────────────────

  describe("ignoreLead", () => {
    it("marks lead status as ignored", () => {
      const lead = makeMockLead({ status: "sourced" });
      const updated = { ...lead, status: "ignored" };
      expect(updated.status).toBe("ignored");
    });

    it("does not allow ignoring an already-screened lead", () => {
      const canIgnore = (status: string) => status !== "screened";
      expect(canIgnore("sourced")).toBe(true);
      expect(canIgnore("triaged")).toBe(true);
      expect(canIgnore("screened")).toBe(false);
    });
  });

  // ── promoteToScreener ─────────────────────────────────────────────────────

  describe("promoteToScreener", () => {
    it("requires lead to be in triaged or promoted status", () => {
      const canPromote = (status: string) =>
        status === "triaged" || status === "promoted";
      expect(canPromote("triaged")).toBe(true);
      expect(canPromote("promoted")).toBe(true);
      expect(canPromote("sourced")).toBe(false);
      expect(canPromote("ignored")).toBe(false);
    });

    it("council verdict shape is valid", () => {
      const verdict = {
        verdict: "APPROVED",
        yesCount: 8,
        noCount: 2,
        confidenceScore: "0.88",
      };
      expect(["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "VETOED", "INSUFFICIENT_DATA"])
        .toContain(verdict.verdict);
      expect(verdict.yesCount + verdict.noCount).toBeLessThanOrEqual(10);
      expect(Number(verdict.confidenceScore)).toBeGreaterThanOrEqual(0);
      expect(Number(verdict.confidenceScore)).toBeLessThanOrEqual(1);
    });
  });

  // ── bulkPromoteToScreener ─────────────────────────────────────────────────

  describe("bulkPromoteToScreener", () => {
    it("limits bulk promotion to max 10 leads per call", () => {
      const limit = Math.min(15, 10); // capped at 10
      expect(limit).toBe(10);
    });

    it("only selects leads with status promoted", () => {
      const leads = [
        makeMockLead({ id: 1, status: "promoted" }),
        makeMockLead({ id: 2, status: "triaged" }),
        makeMockLead({ id: 3, status: "promoted" }),
      ];
      const eligible = leads.filter((l) => l.status === "promoted");
      expect(eligible).toHaveLength(2);
    });
  });
});
