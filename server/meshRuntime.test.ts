/**
 * meshRuntime.test.ts
 *
 * Acceptance tests for the Mesh Core v0.1 escalation engine.
 * All tests are deterministic — invokeLLM is mocked, no network calls.
 *
 * Canonical acceptance test:
 *   malformed input → SMALL fails validation → MID succeeds
 *   → tiers_used=["SMALL","MID"], attempts_count=2, escalated=true
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateStructuredOutput,
  computeLoadedCost,
  computeTokenCost,
  computeVerdict,
  runEscalating,
  type WorkflowContext,
} from "./meshRuntime";
import { computeLoadedCost as routerLoadedCost, computeVerdict as routerVerdict } from "./meshCoreRouter";

// ─── Mock invokeLLM ───────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockLLM = vi.mocked(invokeLLM);

function llmOk(content: string, inputTokens = 100, outputTokens = 50) {
  return { choices: [{ message: { content } }], usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens } };
}

const SCHEMA: WorkflowContext["requiredFields"] = { decision: "string", confidence: "number" };
const VALID   = JSON.stringify({ decision: "approve", confidence: 0.9 });
const BROKEN  = "{ decision: approve, confidence: }";   // malformed JSON
const MISSING = JSON.stringify({ decision: "approve" }); // missing confidence
const EMPTY   = JSON.stringify({ decision: "", confidence: 0.9 }); // empty required string

const BASE_CTX: WorkflowContext = {
  workflowType: "TEST",
  requiredFields: SCHEMA,
  systemPrompt: "You are a test assistant.",
  userMessage: "Make a decision.",
};

// ─── validateStructuredOutput ─────────────────────────────────────────────────

describe("validateStructuredOutput", () => {
  it("passes valid JSON with all required fields", () => {
    const r = validateStructuredOutput(VALID, SCHEMA);
    expect(r.valid).toBe(true);
    if (r.valid) { expect(r.parsed.decision).toBe("approve"); expect(r.parsed.confidence).toBe(0.9); }
  });

  it("fails on malformed JSON", () => {
    const r = validateStructuredOutput(BROKEN, SCHEMA);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/JSON parse failure/i);
  });

  it("fails when a required field is missing", () => {
    const r = validateStructuredOutput(MISSING, SCHEMA);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/confidence/);
  });

  it("fails when a required string field is empty", () => {
    const r = validateStructuredOutput(EMPTY, SCHEMA);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/empty string/i);
  });

  it("fails when a required field is null", () => {
    const r = validateStructuredOutput(JSON.stringify({ decision: null, confidence: 0.9 }), SCHEMA);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/null or missing/i);
  });

  it("fails on type mismatch — string where number expected", () => {
    const r = validateStructuredOutput(JSON.stringify({ decision: "approve", confidence: "high" }), SCHEMA);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/expected number/i);
  });

  it("strips markdown code fences before parsing", () => {
    const fenced = "```json\n" + VALID + "\n```";
    expect(validateStructuredOutput(fenced, SCHEMA).valid).toBe(true);
  });

  it("validates array type correctly", () => {
    const s = { tags: "array" as const };
    expect(validateStructuredOutput(JSON.stringify({ tags: ["a", "b"] }), s).valid).toBe(true);
    expect(validateStructuredOutput(JSON.stringify({ tags: "not-array" }), s).valid).toBe(false);
  });
});

// ─── computeTokenCost ─────────────────────────────────────────────────────────

describe("computeTokenCost", () => {
  it("SMALL: 1M in + 1M out = $0.75", () => expect(computeTokenCost("SMALL", 1_000_000, 1_000_000)).toBeCloseTo(0.75));
  it("MID:   1M in + 1M out = $3.00", () => expect(computeTokenCost("MID",   1_000_000, 1_000_000)).toBeCloseTo(3.00));
  it("LARGE: 1M in + 1M out = $12.50",() => expect(computeTokenCost("LARGE", 1_000_000, 1_000_000)).toBeCloseTo(12.50));
});

// ─── computeLoadedCost (Amendment A) ─────────────────────────────────────────

describe("computeLoadedCost (Amendment A)", () => {
  it("computes all five components correctly", () => {
    const r = computeLoadedCost({
      tokenCostUsd: 0.75, humanGateMinutes: 2, humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 7.90, disputeRate: 0.05, liabilityReservePct: 0.03,
    });
    expect(r.humanGateCostUsd).toBeCloseTo(1.00);
    // dispute = 0.05 × (0.75 + 1.00) = 0.0875
    expect(r.disputeCostUsd).toBeCloseTo(0.0875);
    expect(r.residencyCacUsd).toBeCloseTo(7.90);
    // subtotal = 0.75 + 1.00 + 0.0875 + 7.90 = 9.7375; reserve = 9.7375 × 0.03 = 0.292125
    expect(r.liabilityReserveUsd).toBeCloseTo(0.292125, 5);
    expect(r.loadedCostUsd).toBeCloseTo(10.029625, 5);
  });

  it("dispute = rate × (token + gate), NOT rate × token only", () => {
    const r = computeLoadedCost({
      tokenCostUsd: 1.00, humanGateMinutes: 2, humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 0, disputeRate: 0.10, liabilityReservePct: 0,
    });
    expect(r.disputeCostUsd).toBeCloseTo(0.20);
    expect(r.disputeCostUsd).not.toBeCloseTo(0.10);
  });

  it("zero gate minutes yields zero gate cost", () => {
    const r = computeLoadedCost({ tokenCostUsd: 0.10, humanGateMinutes: 0, humanGateCostPerMinute: 0.50, residencyCacPerOuUsd: 0.004, disputeRate: 0.05, liabilityReservePct: 0.03 });
    expect(r.humanGateCostUsd).toBe(0);
  });

  it("self-serve CAC ($0.004) is much lower than enterprise ($7.90)", () => {
    const ent = computeLoadedCost({ tokenCostUsd: 0.01, humanGateMinutes: 0, humanGateCostPerMinute: 0.50, residencyCacPerOuUsd: 7.90, disputeRate: 0.05, liabilityReservePct: 0.03 });
    const ss  = computeLoadedCost({ tokenCostUsd: 0.01, humanGateMinutes: 0, humanGateCostPerMinute: 0.50, residencyCacPerOuUsd: 0.004, disputeRate: 0.05, liabilityReservePct: 0.03 });
    expect(ent.loadedCostUsd).toBeGreaterThan(ss.loadedCostUsd);
  });

  it("router re-export matches engine export", () => {
    const input = { tokenCostUsd: 1.00, humanGateMinutes: 2, humanGateCostPerMinute: 0.50, residencyCacPerOuUsd: 7.90, disputeRate: 0.05, liabilityReservePct: 0.03 };
    expect(computeLoadedCost(input).loadedCostUsd).toBeCloseTo(routerLoadedCost(input).loadedCostUsd);
  });
});

// ─── computeVerdict (Amendment D) ────────────────────────────────────────────

describe("computeVerdict (Amendment D)", () => {
  it("STRONG: p90 >= 50%",                       () => { expect(computeVerdict(80, 60)).toBe("STRONG"); expect(computeVerdict(50, 50)).toBe("STRONG"); });
  it("VIABLE: p90 >= 20% and < 50%",             () => { expect(computeVerdict(80, 30)).toBe("VIABLE"); expect(computeVerdict(60, 20)).toBe("VIABLE"); });
  it("REPRICE: p50 >= 50% AND p90 < 20%",        () => { expect(computeVerdict(60, 10)).toBe("REPRICE"); expect(computeVerdict(50, 0)).toBe("REPRICE"); });
  it("FAIL: p50 < 50%",                          () => { expect(computeVerdict(49, 60)).toBe("FAIL"); expect(computeVerdict(0, 0)).toBe("FAIL"); });
  it("FAIL takes priority over REPRICE (p50<50)",() => expect(computeVerdict(30, 5)).toBe("FAIL"));
  it("boundary: p90 exactly 50 is STRONG",       () => expect(computeVerdict(80, 50)).toBe("STRONG"));
  it("boundary: p90 exactly 20 is VIABLE",       () => expect(computeVerdict(80, 20)).toBe("VIABLE"));
  it("boundary: p90=19.99 with p50>=50 is REPRICE", () => expect(computeVerdict(55, 19.99)).toBe("REPRICE"));
  it("router re-export matches engine export",   () => expect(routerVerdict(80, 60)).toBe("STRONG"));
});

// ─── Amendment C — p90 cost definition ───────────────────────────────────────

describe("Amendment C — p90 margin uses 90th-percentile COST, not 90th-percentile of margins", () => {
  it("p90 cost at index 8 of 10 sorted OUs gives correct margin", () => {
    const price = 10;
    const costs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const p90Cost = costs[Math.ceil(0.9 * costs.length) - 1]; // = 9
    const p50Cost = costs[Math.ceil(0.5 * costs.length) - 1]; // = 5
    expect(p90Cost).toBe(9);
    const p90Margin = ((price - p90Cost) / price) * 100; // 10%
    const p50Margin = ((price - p50Cost) / price) * 100; // 50%
    expect(computeVerdict(p50Margin, p90Margin)).toBe("REPRICE");
  });
});

// ─── runEscalating — escalation engine acceptance tests ──────────────────────

describe("runEscalating — escalation engine", () => {
  beforeEach(() => mockLLM.mockReset());

  it("CANONICAL: SMALL fails validation → MID succeeds → tiers_used=[SMALL,MID], attempts_count=2, escalated=true", async () => {
    mockLLM
      .mockResolvedValueOnce(llmOk(BROKEN, 80, 40))   // SMALL → validation fail
      .mockResolvedValueOnce(llmOk(VALID, 120, 60));   // MID → pass

    const r = await runEscalating(BASE_CTX);

    expect(r.success).toBe(true);
    expect(r.tiersUsed).toEqual(["SMALL", "MID"]);
    expect(r.attemptsCount).toBe(2);
    expect(r.escalated).toBe(true);
    expect(r.finalTier).toBe("MID");
    expect(r.capBreach).toBe(false);
    expect(r.output).toEqual({ decision: "approve", confidence: 0.9 });
  });

  it("clean single-tier run: SMALL passes → tiers_used=[SMALL], attempts_count=1, escalated=false", async () => {
    mockLLM.mockResolvedValueOnce(llmOk(VALID));

    const r = await runEscalating(BASE_CTX);

    expect(r.success).toBe(true);
    expect(r.tiersUsed).toEqual(["SMALL"]);
    expect(r.attemptsCount).toBe(1);
    expect(r.escalated).toBe(false);
  });

  it("same-tier retry on hard failure: SMALL errors → SMALL retry succeeds → tiers_used=[SMALL,SMALL], escalated=false", async () => {
    mockLLM
      .mockRejectedValueOnce(new Error("API timeout"))
      .mockResolvedValueOnce(llmOk(VALID));

    const r = await runEscalating(BASE_CTX);

    expect(r.success).toBe(true);
    expect(r.tiersUsed).toEqual(["SMALL", "SMALL"]);
    expect(r.attemptsCount).toBe(2);
    expect(r.escalated).toBe(false);
  });

  it("hard fail + retry + escalation: SMALL errors twice → MID succeeds → tiers_used=[SMALL,SMALL,MID], escalated=true", async () => {
    mockLLM
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout again"))
      .mockResolvedValueOnce(llmOk(VALID));

    const r = await runEscalating(BASE_CTX);

    expect(r.success).toBe(true);
    expect(r.tiersUsed).toEqual(["SMALL", "SMALL", "MID"]);
    expect(r.attemptsCount).toBe(3);
    expect(r.escalated).toBe(true);
    expect(r.finalTier).toBe("MID");
  });

  it("missing required field triggers escalation", async () => {
    mockLLM
      .mockResolvedValueOnce(llmOk(MISSING))   // SMALL: missing confidence
      .mockResolvedValueOnce(llmOk(VALID));     // MID: passes

    const r = await runEscalating(BASE_CTX);

    expect(r.success).toBe(true);
    expect(r.tiersUsed).toEqual(["SMALL", "MID"]);
    expect(r.escalated).toBe(true);
    expect(r.escalationReason).toMatch(/confidence/);
  });

  it("token cap abort: capBreach=true, success=false, no escalation", async () => {
    const ctx = { ...BASE_CTX, tokenBudgetCap: 50 };
    mockLLM.mockResolvedValueOnce(llmOk(VALID, 30, 30)); // 60 tokens > cap 50

    const r = await runEscalating(ctx);

    expect(r.capBreach).toBe(true);
    expect(r.success).toBe(false);
    expect(r.escalated).toBe(false);
  });

  it("all tiers exhausted: SMALL→MID→LARGE all fail → success=false, escalated=true", async () => {
    mockLLM
      .mockResolvedValueOnce(llmOk(BROKEN))
      .mockResolvedValueOnce(llmOk(BROKEN))
      .mockResolvedValueOnce(llmOk(BROKEN));

    const r = await runEscalating(BASE_CTX);

    expect(r.success).toBe(false);
    expect(r.tiersUsed).toEqual(["SMALL", "MID", "LARGE"]);
    expect(r.attemptsCount).toBe(3);
    expect(r.escalated).toBe(true);
    expect(r.escalationReason).toMatch(/exhausted/i);
  });

  it("max 6 attempts enforced regardless of failures", async () => {
    mockLLM.mockResolvedValue(llmOk(BROKEN));

    const r = await runEscalating(BASE_CTX);

    expect(r.attemptsCount).toBeLessThanOrEqual(6);
    expect(r.success).toBe(false);
  });

  it("token counts accumulate across all attempts", async () => {
    mockLLM
      .mockResolvedValueOnce(llmOk(BROKEN, 100, 50))   // SMALL: 150 tokens
      .mockResolvedValueOnce(llmOk(VALID, 200, 80));    // MID: 280 tokens

    const r = await runEscalating(BASE_CTX);

    expect(r.totalInputTokens).toBe(300);
    expect(r.totalOutputTokens).toBe(130);
  });

  it("startTier=MID skips SMALL entirely", async () => {
    mockLLM.mockResolvedValueOnce(llmOk(VALID));

    const r = await runEscalating({ ...BASE_CTX, startTier: "MID" });

    expect(r.success).toBe(true);
    expect(r.tiersUsed).toEqual(["MID"]);
    expect(r.finalTier).toBe("MID");
  });
});
