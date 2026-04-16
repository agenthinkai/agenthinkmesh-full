/**
 * dealScreener.test.ts
 * Tests for councilEngine.ts consensus logic.
 *
 * councilEngine.ts calls invokeLLM() from ./_core/llm (a fetch-based helper).
 * We mock that module so tests never hit the real API.
 * vi.mock() is hoisted to the top of the file by vitest, so any variable
 * referenced inside vi.mock() must also be hoisted via vi.hoisted().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mockInvokeLLM so it is available inside the hoisted vi.mock() call ─
const { mockInvokeLLM } = vi.hoisted(() => {
  return { mockInvokeLLM: vi.fn() };
});

// ── Mock the LLM helper at module level ───────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: mockInvokeLLM,
}));

// Import AFTER the mock is registered
import { runCouncil } from "./councilEngine";

// ── Persona IDs in the order they appear in councilEngine.ts ─────────────────
const PERSONA_IDS = [
  "GCC_REG",
  "GCC_SHARIAH",
  "ANALYST",
  "SKEPTIC",
  "CFO",
  "MACRO",
  "GEOPOLITICAL",
  "GCC_CONSUMER",
  "EXIT",
  "DEVILS_ADVOCATE",
];

// ── Helper: build a mock invokeLLM response for a given vote ─────────────────
function makeLLMResponse(
  vote: "HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO",
  confidence = 0.8
) {
  const payload = JSON.stringify({
    vote,
    confidence,
    rationale: `Mock rationale for ${vote}`,
    key_flags: ["flag1"],
    conditions: vote === "SOFT_YES" ? ["Condition A"] : [],
    blockers: vote === "SOFT_NO" || vote === "HARD_NO" ? ["Blocker A"] : [],
  });
  return {
    id: "mock-id",
    created: Date.now(),
    model: "mock-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant" as const, content: payload },
        finish_reason: "stop",
      },
    ],
  };
}

// ── Helper: build a vote array with a base vote and per-persona overrides ─────
function setVotesWithOverrides(
  base: "HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO",
  overrides: Record<string, "HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO">
): ("HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO")[] {
  return PERSONA_IDS.map((id) => overrides[id] ?? base);
}

// ── Setup: reset mock before each test ───────────────────────────────────────
beforeEach(() => {
  mockInvokeLLM.mockReset();
});

// ── Helper: wire mockInvokeLLM to return votes in sequence ───────────────────
function wireMockVotes(
  votes: ("HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO")[]
) {
  let callIndex = 0;
  mockInvokeLLM.mockImplementation(() => {
    const vote = votes[callIndex++] ?? "HARD_YES";
    return Promise.resolve(makeLLMResponse(vote));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("councilEngine — consensus logic", () => {
  it("TEST 1: 8 HARD_YES + 2 SOFT_YES → APPROVED", async () => {
    wireMockVotes([
      "HARD_YES", // GCC_REG
      "HARD_YES", // GCC_SHARIAH
      "HARD_YES", // ANALYST
      "HARD_YES", // SKEPTIC
      "HARD_YES", // CFO
      "HARD_YES", // MACRO
      "HARD_YES", // GEOPOLITICAL
      "HARD_YES", // GCC_CONSUMER
      "SOFT_YES", // EXIT
      "SOFT_YES", // DEVILS_ADVOCATE
    ]);

    const result = await runCouncil("Test deal memo for approval", { skipMemory: true });

    expect(result.verdict).toBe("APPROVED");
    expect(result.yesCount).toBe(10);
    expect(result.noCount).toBe(0);
    expect(result.hardYesCount).toBe(8);
    expect(result.softYesCount).toBe(2);
    expect(result.gccVetoTriggered).toBe(false);
    expect(result.tiebreakerTriggered).toBe(false);
  });

  it("TEST 2: 8 YES total, only 4 HARD_YES → APPROVED_WITH_CONDITIONS", async () => {
    wireMockVotes([
      "HARD_YES", // GCC_REG
      "HARD_YES", // GCC_SHARIAH
      "HARD_YES", // ANALYST
      "HARD_YES", // SKEPTIC
      "SOFT_YES", // CFO
      "SOFT_YES", // MACRO
      "SOFT_YES", // GEOPOLITICAL
      "SOFT_YES", // GCC_CONSUMER
      "SOFT_NO",  // EXIT
      "SOFT_NO",  // DEVILS_ADVOCATE
    ]);

    const result = await runCouncil("Test deal memo for conditional approval", { skipMemory: true });

    expect(result.verdict).toBe("APPROVED_WITH_CONDITIONS");
    expect(result.yesCount).toBe(8);
    expect(result.hardYesCount).toBe(4);
    expect(result.softYesCount).toBe(4);
    expect(result.gccVetoTriggered).toBe(false);
  });

  it("TEST 3: GCC_REG = HARD_NO, rest = HARD_YES → VETOED", async () => {
    wireMockVotes(setVotesWithOverrides("HARD_YES", { GCC_REG: "HARD_NO" }));

    const result = await runCouncil("Test deal memo — GCC_REG veto", { skipMemory: true });

    expect(result.verdict).toBe("VETOED");
    expect(result.gccVetoTriggered).toBe(true);
  });

  it("TEST 4: GCC_SHARIAH = HARD_NO, rest = HARD_YES → VETOED", async () => {
    wireMockVotes(setVotesWithOverrides("HARD_YES", { GCC_SHARIAH: "HARD_NO" }));

    const result = await runCouncil("Test deal memo — GCC_SHARIAH veto", { skipMemory: true });

    expect(result.verdict).toBe("VETOED");
    expect(result.gccVetoTriggered).toBe(true);
  });

  it("TEST 5: 3 non-GCC agents = HARD_NO, rest = HARD_YES → VETOED (3+ HARD_NO rule for GCC mode)", async () => {
    wireMockVotes(setVotesWithOverrides("HARD_YES", {
      CFO: "HARD_NO",
      EXIT: "HARD_NO",
      ANALYST: "HARD_NO",
    }));

    const result = await runCouncil("Test deal memo — 3 HARD_NO veto", { skipMemory: true });

    expect(result.verdict).toBe("VETOED");
    expect(result.hardNoCount).toBe(3);
  });

  it("TEST 6: 7 YES + 3 SOFT_NO, no veto → tiebreaker flips first SOFT_NO in priority queue → APPROVED_WITH_CONDITIONS", async () => {
    // Priority queue order: [GCC_REG, CFO, SECURITY, CONTRARIAN, OPERATOR]
    // GCC_REG = SOFT_NO (first in queue, gets flipped to SOFT_YES)
    // After flip: 8 YES (5 HARD_YES + 3 SOFT_YES), 2 NO
    // hardYesCount = 5 < 6 → verdict = APPROVED_WITH_CONDITIONS (not APPROVED)
    wireMockVotes([
      "SOFT_NO",  // GCC_REG         — first SOFT_NO in priority queue → flipped
      "SOFT_YES", // GCC_SHARIAH     — YES (SOFT to keep hardYesCount < 6)
      "HARD_YES", // ANALYST         — YES
      "HARD_YES", // SKEPTIC         — YES
      "SOFT_YES", // CFO             — YES
      "HARD_YES", // MACRO           — YES
      "HARD_YES", // GEOPOLITICAL    — YES
      "SOFT_NO",  // GCC_CONSUMER    — SOFT_NO (not flipped)
      "SOFT_NO",  // EXIT            — SOFT_NO (not flipped)
      "HARD_YES", // DEVILS_ADVOCATE — YES
    ]);
    // Pre-flip: 5 HARD_YES + 2 SOFT_YES = 7 YES, 3 SOFT_NO → tiebreaker
    // Post-flip (GCC_REG SOFT_NO → SOFT_YES): 5 HARD_YES + 3 SOFT_YES = 8 YES, 2 NO
    // hardYesCount = 5 < 6 → APPROVED_WITH_CONDITIONS

    const result = await runCouncil("Test deal memo — tiebreaker scenario", { skipMemory: true });

    expect(result.tiebreakerTriggered).toBe(true);
    expect(result.tiebreakerSwingAgent).toBe("GCC_REG");
    expect(result.verdict).toBe("APPROVED_WITH_CONDITIONS");
    expect(result.gccVetoTriggered).toBe(false);
    expect(result.yesCount).toBe(8);
    expect(result.noCount).toBe(2);
  });
});
