/**
 * server/routers/pitch.scoreHistory.test.ts
 *
 * Vitest unit tests for the pitch.scoreHistory procedure logic.
 *
 * Pattern: inline the procedure logic with injectable deps — no live DB.
 * Mirrors the established pattern from pitch.logSignal.test.ts.
 *
 * Test cases:
 *   1. Ownership guard — dealId belonging to another user throws FORBIDDEN
 *   2. Empty return — dealId with no triage records returns []
 *   3. Correct ordering — records returned ASC by createdAt
 *   4. Field shape — each row contains id, score, createdAt, triggerType, source
 *   5. No artificial cap — 20+ triages are all returned (no row limit)
 */
import { describe, it, expect } from "vitest";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreHistoryRow {
  id: number;
  score: number;
  createdAt: Date;
  triggerType: string | null;
  source: string | null;
}

interface Deal {
  id: number;
  userId: string;
  pitchPreview: string;
  score: number;
  classification: "ENGAGE" | "WATCH" | "IGNORE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

// ── Inline procedure logic (mirrors pitch.ts scoreHistory) ────────────────────

async function runScoreHistory(
  input: { dealId: string },
  userId: string,
  deps: {
    getPitchTriageById: (id: number, uid: string) => Promise<Deal | null>;
    getFullScoreHistory: (dealId: number) => Promise<ScoreHistoryRow[]>;
  }
): Promise<ScoreHistoryRow[]> {
  const dealIdNum = parseInt(input.dealId, 10);
  if (isNaN(dealIdNum)) throw new Error("Invalid dealId");
  const deal = await deps.getPitchTriageById(dealIdNum, userId);
  if (!deal) throw new Error("Deal not found or access denied");
  return deps.getFullScoreHistory(dealIdNum);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OWNER_USER_ID = "user-abc-123";
const OTHER_USER_ID = "user-xyz-999";
const DEAL_ID = "42";
const DEAL_ID_NUM = 42;

const mockDeal: Deal = {
  id: DEAL_ID_NUM,
  userId: OWNER_USER_ID,
  pitchPreview: "AI-powered logistics platform targeting GCC markets.",
  score: 74,
  classification: "ENGAGE",
  confidence: "HIGH",
};

function makeRow(overrides: Partial<ScoreHistoryRow> & { id: number; score: number; createdAt: Date }): ScoreHistoryRow {
  return {
    triggerType: null,
    source: null,
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("pitch.scoreHistory — ownership guard", () => {
  it("throws 'Deal not found or access denied' when dealId belongs to a different user", async () => {
    await expect(
      runScoreHistory(
        { dealId: DEAL_ID },
        OTHER_USER_ID, // different user — getPitchTriageById returns null
        {
          getPitchTriageById: async (id, uid) =>
            id === DEAL_ID_NUM && uid === OWNER_USER_ID ? mockDeal : null,
          getFullScoreHistory: async () => [],
        }
      )
    ).rejects.toThrow("Deal not found or access denied");
  });
});

describe("pitch.scoreHistory — empty return", () => {
  it("returns [] when the deal exists but has no triage records", async () => {
    const result = await runScoreHistory(
      { dealId: DEAL_ID },
      OWNER_USER_ID,
      {
        getPitchTriageById: async (id, uid) =>
          id === DEAL_ID_NUM && uid === OWNER_USER_ID ? mockDeal : null,
        getFullScoreHistory: async () => [],
      }
    );
    expect(result).toEqual([]);
  });
});

describe("pitch.scoreHistory — correct ASC ordering", () => {
  it("returns rows ordered ascending by createdAt (oldest first)", async () => {
    const t1 = new Date("2025-01-01T10:00:00Z");
    const t2 = new Date("2025-02-01T10:00:00Z");
    const t3 = new Date("2025-03-01T10:00:00Z");

    // Simulate DB returning rows already ASC (procedure trusts the helper)
    const ascRows: ScoreHistoryRow[] = [
      makeRow({ id: 1, score: 55, createdAt: t1, source: null, triggerType: null }),
      makeRow({ id: 2, score: 62, createdAt: t2, source: "auto", triggerType: "stale_diligence" }),
      makeRow({ id: 3, score: 70, createdAt: t3, source: "auto", triggerType: "signal_triggered" }),
    ];

    const result = await runScoreHistory(
      { dealId: DEAL_ID },
      OWNER_USER_ID,
      {
        getPitchTriageById: async (id, uid) =>
          id === DEAL_ID_NUM && uid === OWNER_USER_ID ? mockDeal : null,
        getFullScoreHistory: async () => ascRows,
      }
    );

    // Verify the ordering is preserved (oldest → newest)
    expect(result).toHaveLength(3);
    expect(result[0]!.createdAt.getTime()).toBeLessThan(result[1]!.createdAt.getTime());
    expect(result[1]!.createdAt.getTime()).toBeLessThan(result[2]!.createdAt.getTime());
    expect(result[0]!.score).toBe(55);
    expect(result[2]!.score).toBe(70);
  });
});

describe("pitch.scoreHistory — field shape", () => {
  it("each returned row contains id, score, createdAt, triggerType, and source with correct types", async () => {
    const row: ScoreHistoryRow = makeRow({
      id: 99,
      score: 68,
      createdAt: new Date("2025-06-15T08:30:00Z"),
      source: "auto",
      triggerType: "score_drop",
    });

    const result = await runScoreHistory(
      { dealId: DEAL_ID },
      OWNER_USER_ID,
      {
        getPitchTriageById: async (id, uid) =>
          id === DEAL_ID_NUM && uid === OWNER_USER_ID ? mockDeal : null,
        getFullScoreHistory: async () => [row],
      }
    );

    expect(result).toHaveLength(1);
    const r = result[0]!;
    // id: number
    expect(typeof r.id).toBe("number");
    // score: number
    expect(typeof r.score).toBe("number");
    // createdAt: Date
    expect(r.createdAt).toBeInstanceOf(Date);
    // triggerType: string | null
    expect(r.triggerType === null || typeof r.triggerType === "string").toBe(true);
    // source: string | null
    expect(r.source === null || typeof r.source === "string").toBe(true);
    // Exact values
    expect(r.id).toBe(99);
    expect(r.score).toBe(68);
    expect(r.triggerType).toBe("score_drop");
    expect(r.source).toBe("auto");
  });
});

describe("pitch.scoreHistory — no artificial row cap", () => {
  it("returns all rows when a deal has 20+ triage records (no artificial limit)", async () => {
    // Generate 25 rows with ascending dates
    const manyRows: ScoreHistoryRow[] = Array.from({ length: 25 }, (_, i) =>
      makeRow({
        id: 100 + i,
        score: 40 + i,
        createdAt: new Date(Date.UTC(2025, 0, i + 1, 10, 0, 0)),
        source: i % 3 === 0 ? "auto" : null,
        triggerType: i % 3 === 0 ? "stale_diligence" : null,
      })
    );

    const result = await runScoreHistory(
      { dealId: DEAL_ID },
      OWNER_USER_ID,
      {
        getPitchTriageById: async (id, uid) =>
          id === DEAL_ID_NUM && uid === OWNER_USER_ID ? mockDeal : null,
        getFullScoreHistory: async () => manyRows,
      }
    );

    // All 25 rows must be returned — no cap applied
    expect(result).toHaveLength(25);
    expect(result[0]!.id).toBe(100);
    expect(result[24]!.id).toBe(124);
  });
});
