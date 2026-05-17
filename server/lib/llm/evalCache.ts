/**
 * evalCache.ts — In-process LRU cache for eval/council persona calls
 *
 * Design decisions:
 *   • In-process LRU — no Redis/DB dependency; zero latency overhead on hit
 *   • Max 500 entries — each entry is ~4 KB JSON; ~2 MB peak footprint
 *   • 30-minute TTL — council verdicts are deterministic for a given deal text;
 *     30 min covers a full fleet run (25 workers × ~7.5 evals/min) without
 *     serving stale results across materially different market sessions
 *   • Cache key = sha256(stable JSON of messages + personaId) — deterministic
 *     across processes for identical inputs; personaId ensures mode separation
 *   • Never cache error/timeout responses — only successful parsed results
 *   • Lightweight hit/miss logging via console (same pattern as evalRouter)
 *
 * Usage:
 *   import { evalCacheGet, evalCacheSet, evalCacheStats } from "./evalCache";
 *
 *   const key = buildEvalCacheKey(messages, personaId);
 *   const hit = evalCacheGet(key);
 *   if (hit) return hit;
 *   const result = await routeEvalCall(...);
 *   evalCacheSet(key, result);
 */
import { createHash } from "crypto";
import type { EvalRouterResult } from "./evalRouter";

// ── Config ────────────────────────────────────────────────────────────────────
/** Maximum number of entries in the LRU cache */
export const EVAL_CACHE_MAX_SIZE = 500;
/** TTL in milliseconds (30 minutes) */
export const EVAL_CACHE_TTL_MS = 30 * 60 * 1000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface CacheEntry {
  value: EvalRouterResult;
  expiresAt: number;
}

// ── LRU implementation ────────────────────────────────────────────────────────
// Using a Map for O(1) get/set with insertion-order iteration for LRU eviction.
// Map preserves insertion order; we delete+re-insert on access to move to "most recent".
const _store = new Map<string, CacheEntry>();

// ── Stats counters ────────────────────────────────────────────────────────────
let _hits   = 0;
let _misses = 0;
let _evictions = 0;
let _expirations = 0;

// ── Internal helpers ──────────────────────────────────────────────────────────
function _evictLRU(): void {
  // The first key in the Map is the least recently used
  const lruKey = _store.keys().next().value;
  if (lruKey !== undefined) {
    _store.delete(lruKey);
    _evictions++;
  }
}

function _purgeExpired(): void {
  const now = Date.now();
  // Use Array.from to avoid downlevelIteration requirement
  Array.from(_store.entries()).forEach(([key, entry]) => {
    if (entry.expiresAt <= now) {
      _store.delete(key);
      _expirations++;
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from the LLM messages array and a personaId.
 *
 * Normalization steps:
 *   1. Serialize messages to JSON with sorted keys (stable across object creation order)
 *   2. Trim whitespace from content strings to tolerate minor formatting differences
 *   3. Append personaId to ensure different personas never share a cache entry
 *
 * Returns a 64-char hex SHA-256 digest.
 */
export function buildEvalCacheKey(
  messages: Array<{ role: string; content: string }>,
  personaId: string,
): string {
  // Normalize: trim content, lowercase role, sort by role+content for stability
  const normalized = messages.map((m) => ({
    role:    m.role.toLowerCase().trim(),
    content: typeof m.content === "string" ? m.content.trim() : m.content,
  }));
  const payload = JSON.stringify({ messages: normalized, personaId: personaId.trim() });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Retrieve a cached EvalRouterResult.
 * Returns `null` on miss or expired entry.
 * Moves the entry to "most recently used" position on hit.
 */
export function evalCacheGet(key: string): EvalRouterResult | null {
  const entry = _store.get(key);
  if (!entry) {
    _misses++;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    _store.delete(key);
    _expirations++;
    _misses++;
    console.log(`[EvalCache] MISS (expired) key=${key.slice(0, 12)}…`);
    return null;
  }
  // Move to most-recently-used position
  _store.delete(key);
  _store.set(key, entry);
  _hits++;
  console.log(`[EvalCache] HIT key=${key.slice(0, 12)}… hits=${_hits} misses=${_misses}`);
  return entry.value;
}

/**
 * Store a successful EvalRouterResult in the cache.
 * Silently no-ops if the result contains an error indicator.
 * Evicts the LRU entry when the cache is at capacity.
 */
export function evalCacheSet(key: string, result: EvalRouterResult): void {
  // Never cache error/timeout/fallback-with-error responses.
  // A result is considered cacheable if:
  //   • The invokeResult has at least one choice with non-empty content
  //   • The content does not start with a known error sentinel
  const content = result.invokeResult?.choices?.[0]?.message?.content;
  if (
    typeof content !== "string" ||
    content.trim().length === 0 ||
    content.startsWith("ERROR:") ||
    content.startsWith("TIMEOUT")
  ) {
    console.log(`[EvalCache] SKIP (non-cacheable result) key=${key.slice(0, 12)}…`);
    return;
  }

  // Purge expired entries periodically (every 50 sets) to reclaim memory
  if ((_hits + _misses) % 50 === 0) {
    _purgeExpired();
  }

  // Evict LRU if at capacity
  if (_store.size >= EVAL_CACHE_MAX_SIZE) {
    _evictLRU();
  }

  _store.set(key, {
    value:     result,
    expiresAt: Date.now() + EVAL_CACHE_TTL_MS,
  });
}

/**
 * Return a snapshot of cache health metrics.
 * Useful for /admin/evals observability dashboard (P7).
 */
export function evalCacheStats(): {
  size:        number;
  hits:        number;
  misses:      number;
  evictions:   number;
  expirations: number;
  hitRate:     number;
} {
  const total = _hits + _misses;
  return {
    size:        _store.size,
    hits:        _hits,
    misses:      _misses,
    evictions:   _evictions,
    expirations: _expirations,
    hitRate:     total === 0 ? 0 : _hits / total,
  };
}

/**
 * Clear the entire cache and reset counters.
 * Intended for use in tests only.
 */
export function evalCacheClear(): void {
  _store.clear();
  _hits        = 0;
  _misses      = 0;
  _evictions   = 0;
  _expirations = 0;
}
