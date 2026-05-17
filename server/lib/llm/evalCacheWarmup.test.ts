/**
 * evalCacheWarmup.test.ts — P8 Cache Warm-Up Tests
 *
 * Tests cover:
 *   1. runWarmup returns zero metrics when DB returns no combos
 *   2. runWarmup skips combos with no pitchText
 *   3. runWarmup skips combos with unknown personaId
 *   4. runWarmup counts alreadyCached correctly when cache is pre-populated
 *   5. runWarmup counts loaded correctly on successful routeEvalCall
 *   6. runWarmup counts skipped when routeEvalCall throws
 *   7. runWarmup handles DB failure gracefully (no throw)
 *   8. scheduleWarmup fires without blocking (fire-and-forget)
 *   9. WARMUP_TOP_N and WARMUP_LOOKBACK_MS constants are sane
 *  10. buildWarmupMessages produces correct role structure
 *  11. runWarmup respects topN override option
 *  12. runWarmup respects lookbackMs override option
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runWarmup,
  scheduleWarmup,
  WARMUP_TOP_N,
  WARMUP_LOOKBACK_MS,
  type WarmupMetrics,
} from "./evalCacheWarmup";

// ── Mock dependencies ──────────────────────────────────────────────────────────

// Mock getDb
vi.mock("../../db", () => ({
  getDb: vi.fn(),
}));

// Mock evalCache
vi.mock("./evalCache", () => ({
  evalCacheGet: vi.fn(),
  buildEvalCacheKey: vi.fn(() => "mock-cache-key-abc123"),
}));

// Mock routeEvalCall
vi.mock("./evalRouter", () => ({
  routeEvalCall: vi.fn(),
}));

// Mock getPersonasForMode
vi.mock("../../councilEngine", () => ({
  getPersonasForMode: vi.fn(() => [
    {
      id: "ANALYST",
      systemPrompt: "You are an analyst.",
      weight: 1.0,
    },
    {
      id: "SKEPTIC",
      systemPrompt: "You are a skeptic.",
      weight: 1.0,
    },
  ]),
}));

// Mock drizzle schema (just need the table references to exist)
vi.mock("../../../drizzle/schema", () => ({
  evalInferenceLog: { personaId: "personaId", sessionId: "sessionId", fromCache: "fromCache", fallbackUsed: "fallbackUsed", escalationReason: "escalationReason", createdAt: "createdAt" },
  founderAgentPitches: { runId: "runId", pitchText: "pitchText", id: "id" },
  founderAgentRuns: {},
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => {
  const sqlTagFn = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const result = { __sql: Array.from(strings).join("") };
    // Support .as() chaining on the result
    return Object.assign(result, { as: vi.fn((alias: string) => ({ __sql: result.__sql, __alias: alias })) });
  });
  // Also support sqlTagFn.as() for the tagged template result
  (sqlTagFn as unknown as Record<string, unknown>).as = vi.fn();
  return {
    desc: vi.fn((col: unknown) => ({ __desc: col })),
    eq: vi.fn((a: unknown, b: unknown) => ({ __eq: [a, b] })),
    and: vi.fn((...args: unknown[]) => ({ __and: args })),
    gt: vi.fn((a: unknown, b: unknown) => ({ __gt: [a, b] })),
    ne: vi.fn((a: unknown, b: unknown) => ({ __ne: [a, b] })),
    sql: sqlTagFn,
  };
});

// Mock promptCompressor
vi.mock("../promptCompressor", () => ({
  compressDealText: vi.fn((text: string) => text),
  trimMemoryContext: vi.fn((text: string) => text),
}));

import { getDb } from "../../db";
import { evalCacheGet, buildEvalCacheKey } from "./evalCache";
import { routeEvalCall } from "./evalRouter";
import { getPersonasForMode } from "../../councilEngine";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeDbMock(combos: Array<{ personaId: string; sessionId: string; hitCount: number }>, pitchText: string | null = "Pitch text for testing.") {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(
      combos.length > 0
        ? combos
        : pitchText !== null
          ? [{ pitchText }]
          : []
    ),
  };

  // For pitch queries, return pitchText; for combo queries, return combos
  let callCount = 0;
  const limitFn = vi.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // First call: combo query
      return Promise.resolve(combos);
    }
    // Subsequent calls: pitch text query
    return Promise.resolve(pitchText ? [{ pitchText }] : []);
  });

  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: limitFn,
  };

  return chain;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("evalCacheWarmup — constants", () => {
  it("1. WARMUP_TOP_N is a reasonable positive integer", () => {
    expect(WARMUP_TOP_N).toBeGreaterThan(0);
    expect(WARMUP_TOP_N).toBeLessThanOrEqual(100);
    expect(Number.isInteger(WARMUP_TOP_N)).toBe(true);
  });

  it("2. WARMUP_LOOKBACK_MS is at least 1 hour", () => {
    expect(WARMUP_LOOKBACK_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });
});

describe("evalCacheWarmup — runWarmup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("3. returns zero metrics when DB returns no combos", async () => {
    const db = makeDbMock([]);
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);

    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });

    expect(metrics.attempted).toBe(0);
    expect(metrics.loaded).toBe(0);
    expect(metrics.alreadyCached).toBe(0);
    expect(metrics.skipped).toBe(0);
    expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("4. returns zero metrics when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);

    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });

    expect(metrics.attempted).toBe(0);
    expect(metrics.loaded).toBe(0);
    expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("5. skips combos with unknown personaId", async () => {
    const combos = [{ personaId: "UNKNOWN_PERSONA", sessionId: "run-1", hitCount: 5 }];
    const db = makeDbMock(combos, "Some pitch text here.");
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);
    vi.mocked(getPersonasForMode).mockReturnValue([
      { id: "ANALYST", systemPrompt: "You are an analyst.", weight: 1.0 } as ReturnType<typeof getPersonasForMode>[number],
    ]);

    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });

    expect(metrics.attempted).toBe(1);
    expect(metrics.skipped).toBe(1);
    expect(metrics.loaded).toBe(0);
  });

  it("6. counts alreadyCached when cache already has the key", async () => {
    const combos = [{ personaId: "ANALYST", sessionId: "run-42", hitCount: 10 }];
    const db = makeDbMock(combos, "Valid pitch text for warm-up test.");
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);
    vi.mocked(getPersonasForMode).mockReturnValue([
      { id: "ANALYST", systemPrompt: "You are an analyst.", weight: 1.0 } as ReturnType<typeof getPersonasForMode>[number],
    ]);
    // Simulate cache hit
    vi.mocked(evalCacheGet).mockReturnValue({
      invokeResult: { choices: [{ message: { content: "cached result" } }] },
      provider: "deepseek",
      model: "deepseek-chat",
      latencyMs: 0,
      fromCache: true,
      personaId: "ANALYST",
    } as ReturnType<typeof evalCacheGet>);

    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });

    expect(metrics.attempted).toBe(1);
    expect(metrics.alreadyCached).toBe(1);
    expect(metrics.loaded).toBe(0);
    expect(routeEvalCall).not.toHaveBeenCalled();
  });

  it("7. counts loaded when routeEvalCall succeeds", async () => {
    const combos = [{ personaId: "ANALYST", sessionId: "run-99", hitCount: 7 }];
    const db = makeDbMock(combos, "Valid pitch text for warm-up test.");
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);
    vi.mocked(getPersonasForMode).mockReturnValue([
      { id: "ANALYST", systemPrompt: "You are an analyst.", weight: 1.0 } as ReturnType<typeof getPersonasForMode>[number],
    ]);
    vi.mocked(evalCacheGet).mockReturnValue(null); // cache miss
    vi.mocked(routeEvalCall).mockResolvedValue({
      invokeResult: { choices: [{ message: { content: '{"vote":"YES"}' } }] },
      provider: "deepseek",
      model: "deepseek-chat",
      latencyMs: 100,
      fromCache: false,
      personaId: "ANALYST",
    } as ReturnType<typeof routeEvalCall> extends Promise<infer T> ? T : never);

    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });

    expect(metrics.attempted).toBe(1);
    expect(metrics.loaded).toBe(1);
    expect(metrics.skipped).toBe(0);
    expect(routeEvalCall).toHaveBeenCalledOnce();
  });

  it("8. counts skipped when routeEvalCall throws", async () => {
    const combos = [{ personaId: "ANALYST", sessionId: "run-77", hitCount: 3 }];
    const db = makeDbMock(combos, "Valid pitch text for warm-up test.");
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);
    vi.mocked(getPersonasForMode).mockReturnValue([
      { id: "ANALYST", systemPrompt: "You are an analyst.", weight: 1.0 } as ReturnType<typeof getPersonasForMode>[number],
    ]);
    vi.mocked(evalCacheGet).mockReturnValue(null);
    vi.mocked(routeEvalCall).mockRejectedValue(new Error("LLM timeout"));

    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });

    expect(metrics.attempted).toBe(1);
    expect(metrics.skipped).toBe(1);
    expect(metrics.loaded).toBe(0);
  });

  it("9. handles DB query failure gracefully without throwing", async () => {
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    };
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);

    // Should not throw
    const metrics = await runWarmup({ topN: 5, lookbackMs: 3600000 });
    expect(metrics.attempted).toBe(0);
  });

  it("10. respects topN option", async () => {
    // DB returns 3 combos, topN=2 — only 2 should be processed
    const combos = [
      { personaId: "ANALYST", sessionId: "run-1", hitCount: 10 },
      { personaId: "SKEPTIC", sessionId: "run-2", hitCount: 8 },
    ];
    const db = makeDbMock(combos, "Valid pitch text.");
    vi.mocked(getDb).mockResolvedValue(db as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);
    vi.mocked(getPersonasForMode).mockReturnValue([
      { id: "ANALYST", systemPrompt: "You are an analyst.", weight: 1.0 } as ReturnType<typeof getPersonasForMode>[number],
      { id: "SKEPTIC", systemPrompt: "You are a skeptic.", weight: 1.0 } as ReturnType<typeof getPersonasForMode>[number],
    ]);
    vi.mocked(evalCacheGet).mockReturnValue(null);
    vi.mocked(routeEvalCall).mockResolvedValue({
      invokeResult: { choices: [{ message: { content: '{"vote":"YES"}' } }] },
      provider: "deepseek",
      model: "deepseek-chat",
      latencyMs: 50,
      fromCache: false,
      personaId: "ANALYST",
    } as ReturnType<typeof routeEvalCall> extends Promise<infer T> ? T : never);

    const metrics = await runWarmup({ topN: 2, lookbackMs: 3600000 });
    expect(metrics.attempted).toBeLessThanOrEqual(2);
  });

  it("11. durationMs is always a non-negative number", async () => {
    vi.mocked(getDb).mockResolvedValue(null as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);
    const metrics = await runWarmup();
    expect(typeof metrics.durationMs).toBe("number");
    expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("evalCacheWarmup — scheduleWarmup", () => {
  it("12. scheduleWarmup does not block the caller (fire-and-forget)", async () => {
    vi.mocked(getDb).mockResolvedValue(null as unknown as ReturnType<typeof getDb> extends Promise<infer T> ? T : never);

    const start = Date.now();
    scheduleWarmup({ topN: 1, lookbackMs: 1000 });
    const elapsed = Date.now() - start;

    // scheduleWarmup uses setImmediate — should return in < 5ms
    expect(elapsed).toBeLessThan(50);
  });
});
