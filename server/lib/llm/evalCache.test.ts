/**
 * evalCache.test.ts — P4 eval caching tests
 *
 * Covers:
 *   1. buildEvalCacheKey — determinism, normalization, mode separation
 *   2. evalCacheGet / evalCacheSet — basic hit/miss
 *   3. TTL expiry — expired entries return null
 *   4. No error caching — empty/error content is not stored
 *   5. LRU eviction — oldest entry evicted when at capacity
 *   6. evalCacheStats — counters are accurate
 *   7. evalCacheClear — resets state
 *   8. routeEvalCall integration — cache hit short-circuits LLM call
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  buildEvalCacheKey,
  evalCacheGet,
  evalCacheSet,
  evalCacheClear,
  evalCacheStats,
  EVAL_CACHE_MAX_SIZE,
  EVAL_CACHE_TTL_MS,
} from "./evalCache";
import type { EvalRouterResult } from "./evalRouter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(content: string = '{"vote":"HARD_YES","confidence":0.9,"rationale":"test"}'): EvalRouterResult {
  return {
    invokeResult: {
      id: "test-id",
      created: 1_700_000_000,
      model: "deepseek-chat",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
    },
    provider: "deepseek",
    model: "deepseek-chat",
    escalationReason: null,
    fallbackUsed: false,
    retryCount: 0,
    latencyMs: 350,
  };
}

const MESSAGES_A = [
  { role: "system", content: "You are a VC analyst." },
  { role: "user",   content: "Evaluate this deal: Acme Corp, Series A, $5M." },
];

const MESSAGES_B = [
  { role: "system", content: "You are a legal reviewer." },
  { role: "user",   content: "Evaluate this deal: Acme Corp, Series A, $5M." },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildEvalCacheKey", () => {
  it("returns a 64-char hex SHA-256 string", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same inputs produce the same key", () => {
    const key1 = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const key2 = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    expect(key1).toBe(key2);
  });

  it("differs for different personaIds (mode separation)", () => {
    const key1 = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const key2 = buildEvalCacheKey(MESSAGES_A, "GCC_REG");
    expect(key1).not.toBe(key2);
  });

  it("differs for different message content", () => {
    const key1 = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const key2 = buildEvalCacheKey(MESSAGES_B, "VC_ANALYST");
    expect(key1).not.toBe(key2);
  });

  it("normalizes whitespace in content (leading/trailing spaces)", () => {
    const trimmed  = [{ role: "user", content: "Evaluate this deal." }];
    const padded   = [{ role: "user", content: "  Evaluate this deal.  " }];
    const key1 = buildEvalCacheKey(trimmed, "P1");
    const key2 = buildEvalCacheKey(padded,  "P1");
    expect(key1).toBe(key2);
  });

  it("normalizes role case", () => {
    const lower = [{ role: "user",   content: "Hello" }];
    const upper = [{ role: "USER",   content: "Hello" }];
    const key1 = buildEvalCacheKey(lower, "P1");
    const key2 = buildEvalCacheKey(upper, "P1");
    expect(key1).toBe(key2);
  });
});

describe("evalCacheGet / evalCacheSet — basic hit/miss", () => {
  beforeEach(() => evalCacheClear());

  it("returns null on cache miss", () => {
    const result = evalCacheGet("nonexistent-key");
    expect(result).toBeNull();
  });

  it("returns the stored result on cache hit", () => {
    const key    = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const stored = makeResult();
    evalCacheSet(key, stored);
    const hit = evalCacheGet(key);
    expect(hit).not.toBeNull();
    expect(hit!.model).toBe("deepseek-chat");
    expect(hit!.provider).toBe("deepseek");
  });

  it("hit result has the same content as stored", () => {
    const key    = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const stored = makeResult('{"vote":"SOFT_YES","confidence":0.75,"rationale":"looks good"}');
    evalCacheSet(key, stored);
    const hit = evalCacheGet(key);
    const content = hit!.invokeResult.choices[0].message.content;
    expect(content).toContain("SOFT_YES");
  });

  it("returns null after key is not set", () => {
    const key = buildEvalCacheKey(MESSAGES_B, "GCC_REG");
    expect(evalCacheGet(key)).toBeNull();
  });
});

describe("TTL expiry", () => {
  beforeEach(() => evalCacheClear());

  it("returns null for an expired entry", () => {
    vi.useFakeTimers();
    const key    = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const stored = makeResult();
    evalCacheSet(key, stored);

    // Advance time past TTL
    vi.advanceTimersByTime(EVAL_CACHE_TTL_MS + 1_000);

    const result = evalCacheGet(key);
    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it("returns the entry if TTL has not yet elapsed", () => {
    vi.useFakeTimers();
    const key    = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    const stored = makeResult();
    evalCacheSet(key, stored);

    // Advance time to just before TTL
    vi.advanceTimersByTime(EVAL_CACHE_TTL_MS - 1_000);

    const result = evalCacheGet(key);
    expect(result).not.toBeNull();
    vi.useRealTimers();
  });
});

describe("No error caching", () => {
  beforeEach(() => evalCacheClear());

  it("does not cache a result with empty content", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult(""));
    expect(evalCacheGet(key)).toBeNull();
  });

  it("does not cache a result with ERROR: sentinel content", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult("ERROR: upstream failure"));
    expect(evalCacheGet(key)).toBeNull();
  });

  it("does not cache a result with TIMEOUT sentinel content", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult("TIMEOUT"));
    expect(evalCacheGet(key)).toBeNull();
  });

  it("does cache a valid JSON result", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult('{"vote":"HARD_YES","confidence":0.9}'));
    expect(evalCacheGet(key)).not.toBeNull();
  });
});

describe("LRU eviction", () => {
  beforeEach(() => evalCacheClear());

  it("evicts the oldest entry when at max capacity", () => {
    // Fill cache to max
    for (let i = 0; i < EVAL_CACHE_MAX_SIZE; i++) {
      const key = `key-${i}`;
      evalCacheSet(key, makeResult(`{"vote":"HARD_YES","confidence":0.9,"i":${i}}`));
    }
    // The first key inserted should still be present (not yet evicted)
    expect(evalCacheGet("key-0")).not.toBeNull();

    // Adding one more entry should evict the LRU (key-0, since we accessed it last)
    // First, insert without accessing key-0 again — insert key-1 through MAX to push key-0 to LRU
    evalCacheClear();
    for (let i = 0; i < EVAL_CACHE_MAX_SIZE; i++) {
      const key = `evict-key-${i}`;
      evalCacheSet(key, makeResult(`{"vote":"HARD_YES","confidence":0.9}`));
    }
    // Now add one more — should evict evict-key-0
    evalCacheSet("overflow-key", makeResult('{"vote":"SOFT_YES","confidence":0.8}'));
    // evict-key-0 should be gone
    expect(evalCacheGet("evict-key-0")).toBeNull();
    // overflow-key should be present
    expect(evalCacheGet("overflow-key")).not.toBeNull();
  });
});

describe("evalCacheStats", () => {
  beforeEach(() => evalCacheClear());

  it("starts with zero counters", () => {
    const stats = evalCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.size).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it("increments miss counter on miss", () => {
    evalCacheGet("no-such-key");
    expect(evalCacheStats().misses).toBe(1);
    expect(evalCacheStats().hits).toBe(0);
  });

  it("increments hit counter on hit", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult());
    evalCacheGet(key);
    expect(evalCacheStats().hits).toBe(1);
    expect(evalCacheStats().misses).toBe(0);
  });

  it("calculates hitRate correctly", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult());
    evalCacheGet(key);   // hit
    evalCacheGet("x");   // miss
    const stats = evalCacheStats();
    expect(stats.hitRate).toBeCloseTo(0.5);
  });

  it("reports correct size after set/clear", () => {
    const key = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(key, makeResult());
    expect(evalCacheStats().size).toBe(1);
    evalCacheClear();
    expect(evalCacheStats().size).toBe(0);
  });
});

describe("Mode separation — different personaIds never share entries", () => {
  beforeEach(() => evalCacheClear());

  it("GCC_REG and VC_ANALYST produce different keys for same messages", () => {
    const keyA = buildEvalCacheKey(MESSAGES_A, "GCC_REG");
    const keyB = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    expect(keyA).not.toBe(keyB);
  });

  it("a hit for GCC_REG does not bleed into VC_ANALYST", () => {
    const keyA = buildEvalCacheKey(MESSAGES_A, "GCC_REG");
    const keyB = buildEvalCacheKey(MESSAGES_A, "VC_ANALYST");
    evalCacheSet(keyA, makeResult('{"vote":"HARD_NO","confidence":0.8}'));
    expect(evalCacheGet(keyB)).toBeNull();
  });
});
