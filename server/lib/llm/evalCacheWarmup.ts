/**
 * evalCacheWarmup.ts — P8 Cache Warm-Up on Fleet Start
 *
 * Strategy:
 *   1. Query eval_inference_log for the top-N most frequent (personaId, sessionId) pairs
 *      from the last 24 h that had successful (non-error, non-fallback, non-cached) calls.
 *   2. For each combo, fetch the corresponding pitch text from founderAgentPitches via
 *      the sessionId → runId → pitchId chain.
 *   3. Re-invoke routeEvalCall with the reconstructed messages so the result lands in
 *      the in-process LRU cache via the existing evalCacheSet path.
 *   4. Run entirely in the background — never blocks fleet startup.
 *   5. Emit lightweight metrics on completion.
 *
 * Design constraints:
 *   • Top-N capped at WARMUP_TOP_N (default 20) to stay well within 30-min TTL window.
 *   • Skips malformed / error / fallback / already-cached rows.
 *   • Preserves existing cache semantics and TTL behaviour (evalCacheSet handles all of that).
 *   • No schema changes required.
 *
 * Usage:
 *   import { scheduleWarmup } from "./evalCacheWarmup";
 *   scheduleWarmup({ councilMode: "gcc" });   // fire-and-forget
 */

import { getDb } from "../../db";
import { evalInferenceLog, founderAgentPitches } from "../../../drizzle/schema";
import { desc, eq, and, gt, sql } from "drizzle-orm";
import { routeEvalCall } from "./evalRouter";
import { evalCacheGet, buildEvalCacheKey } from "./evalCache";
import { getPersonasForMode, CouncilMode, PersonaDef } from "../../councilEngine";
import { compressDealText } from "../promptCompressor";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum number of (personaId, pitchText) combos to pre-warm per fleet start. */
export const WARMUP_TOP_N = 20;

/** Look-back window for frequency analysis (ms). */
export const WARMUP_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Maximum concurrent warm-up calls (keep low — warm-up is background, not critical path). */
const WARMUP_CONCURRENCY = 3;

/** Delay between warm-up batches (ms) — avoids competing with live fleet workers. */
const WARMUP_STAGGER_MS = 200;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WarmupMetrics {
  /** Number of (personaId, pitchText) combos attempted. */
  attempted: number;
  /** Number successfully loaded into cache (new entries only). */
  loaded: number;
  /** Number skipped because they were already in cache. */
  alreadyCached: number;
  /** Number skipped due to missing pitch text or DB errors. */
  skipped: number;
  /** Total elapsed time in ms. */
  durationMs: number;
}

export interface WarmupOptions {
  /** Council mode to use for persona resolution. Defaults to "gcc". */
  councilMode?: CouncilMode;
  /** Override top-N limit. Defaults to WARMUP_TOP_N. */
  topN?: number;
  /** Override look-back window in ms. Defaults to WARMUP_LOOKBACK_MS. */
  lookbackMs?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Query the top-N (personaId, sessionId) pairs from eval_inference_log
 * that had successful, non-cached, non-fallback calls in the last `lookbackMs`.
 */
async function fetchTopCombos(
  topN: number,
  lookbackMs: number,
): Promise<Array<{ personaId: string; sessionId: string; hitCount: number }>> {
  const db = await getDb();
  if (!db) return [];

  const since = Date.now() - lookbackMs;

  try {
    const rows = await db
      .select({
        personaId: evalInferenceLog.personaId,
        sessionId: evalInferenceLog.sessionId,
        hitCount: sql<number>`COUNT(*)`.as("hit_count"),
      })
      .from(evalInferenceLog)
      .where(
        and(
          gt(evalInferenceLog.createdAt, since),
          // Exclude cached rows — they don't have real LLM output to reconstruct
          eq(evalInferenceLog.fromCache, 0),
          // Exclude fallback rows — their outputs may differ from primary path
          eq(evalInferenceLog.fallbackUsed, 0),
          // Exclude rows with escalation (malformed/error) — not safe to re-cache
          eq(evalInferenceLog.escalationReason, "none"),
        ),
      )
      .groupBy(evalInferenceLog.personaId, evalInferenceLog.sessionId)
      .orderBy(desc(sql`hit_count`))
      .limit(topN);

    return rows.map((r) => ({
      personaId: r.personaId,
      sessionId: r.sessionId,
      hitCount: Number(r.hitCount),
    }));
  } catch (err) {
    console.warn("[WarmupCache] DB query failed:", err);
    return [];
  }
}

/**
 * Resolve a sessionId to a reconstructed dealText by looking up the most recent
 * pitch for the run associated with that sessionId.
 *
 * sessionId in eval_inference_log is set by councilEngine as the runId string
 * (e.g., "run-123" or just "123"). We join via founderAgentPitches.runId.
 *
 * founderAgentPitches stores structured fields (problem, solution, etc.) rather
 * than a single pitchText column, so we reconstruct a memo from those fields.
 */
async function fetchPitchTextForSession(
  sessionId: string,
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // sessionId may be "run-<runId>" or just "<runId>" — extract numeric part
    const runIdMatch = sessionId.match(/(\d+)/);
    if (!runIdMatch) return null;
    const runId = parseInt(runIdMatch[1], 10);
    if (isNaN(runId)) return null;

    // Get the most recent pitch for this runId
    const rows = await db
      .select({
        problem:              founderAgentPitches.problem,
        solution:             founderAgentPitches.solution,
        targetMarket:         founderAgentPitches.targetMarket,
        businessModel:        founderAgentPitches.businessModel,
        competitiveAdvantage: founderAgentPitches.competitiveAdvantage,
        keyRisk:              founderAgentPitches.keyRisk,
        fundingAsk:           founderAgentPitches.fundingAsk,
        summary3s:            founderAgentPitches.summary3s,
      })
      .from(founderAgentPitches)
      .where(eq(founderAgentPitches.runId, runId))
      .orderBy(desc(founderAgentPitches.id))
      .limit(1);

    const pitch = rows[0];
    if (!pitch) return null;

    // Reconstruct a deal memo from structured fields
    const memo = [
      `Problem: ${pitch.problem}`,
      `Solution: ${pitch.solution}`,
      `Target Market: ${pitch.targetMarket}`,
      `Business Model: ${pitch.businessModel}`,
      `Competitive Advantage: ${pitch.competitiveAdvantage}`,
      `Key Risk: ${pitch.keyRisk}`,
      `Funding Ask: ${pitch.fundingAsk}`,
      pitch.summary3s ? `Summary: ${pitch.summary3s}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (memo.trim().length < 20) return null;
    return memo;
  } catch {
    return null;
  }
}

/**
 * Build the messages array for a given persona + dealText,
 * matching the exact format used by callPersona in councilEngine.ts.
 */
function buildWarmupMessages(
  persona: PersonaDef,
  dealText: string,
): Array<{ role: "system" | "user"; content: string }> {
  const compressedDeal = compressDealText(dealText);
  // No memoryContext for warm-up — keeps it simple and avoids stale context
  const contextualDeal = `Here is the deal memo to evaluate:\n\n${compressedDeal}`;
  const userMessage = `${contextualDeal}\n\nProvide your vote and analysis as strict JSON only.`;
  return [
    { role: "system" as const, content: persona.systemPrompt },
    { role: "user" as const,   content: userMessage },
  ];
}

// ── Main warm-up function ─────────────────────────────────────────────────────

/**
 * Run the cache warm-up pass.
 * Returns metrics when complete.
 * All errors are caught internally — this function never throws.
 */
export async function runWarmup(opts: WarmupOptions = {}): Promise<WarmupMetrics> {
  const startMs = Date.now();
  const topN = opts.topN ?? WARMUP_TOP_N;
  const lookbackMs = opts.lookbackMs ?? WARMUP_LOOKBACK_MS;
  const councilMode = opts.councilMode ?? "gcc";

  const metrics: WarmupMetrics = {
    attempted: 0,
    loaded: 0,
    alreadyCached: 0,
    skipped: 0,
    durationMs: 0,
  };

  console.log(`[WarmupCache] Starting warm-up: mode=${councilMode}, topN=${topN}, lookback=${lookbackMs / 3600000}h`);

  // 1. Fetch top combos from DB
  const combos = await fetchTopCombos(topN, lookbackMs);
  if (combos.length === 0) {
    console.log("[WarmupCache] No eligible combos found in DB — skipping warm-up.");
    metrics.durationMs = Date.now() - startMs;
    return metrics;
  }
  console.log(`[WarmupCache] Found ${combos.length} combos to pre-warm.`);

  // 2. Resolve personas for the given council mode
  const personas = getPersonasForMode(councilMode);
  const personaMap = new Map<string, PersonaDef>(personas.map((p) => [p.id, p]));

  // 3. Process in batches of WARMUP_CONCURRENCY
  for (let i = 0; i < combos.length; i += WARMUP_CONCURRENCY) {
    const batch = combos.slice(i, i + WARMUP_CONCURRENCY);

    await Promise.allSettled(
      batch.map(async ({ personaId, sessionId }) => {
        metrics.attempted++;

        // Resolve persona
        const persona = personaMap.get(personaId);
        if (!persona) {
          console.log(`[WarmupCache] SKIP unknown personaId=${personaId}`);
          metrics.skipped++;
          return;
        }

        // Resolve pitch text
        const pitchText = await fetchPitchTextForSession(sessionId);
        if (!pitchText) {
          console.log(`[WarmupCache] SKIP no pitchText for session=${sessionId}`);
          metrics.skipped++;
          return;
        }

        // Build messages and check if already cached
        const messages = buildWarmupMessages(persona, pitchText);
        const cacheKey = buildEvalCacheKey(messages, personaId);
        if (evalCacheGet(cacheKey) !== null) {
          metrics.alreadyCached++;
          return;
        }

        // Fire the eval call — evalCacheSet is called inside routeEvalCall on success
        try {
          await routeEvalCall(
            { messages, max_tokens: 2048 },
            { sessionId: `warmup-${sessionId}`, personaId },
          );
          metrics.loaded++;
          console.log(`[WarmupCache] LOADED personaId=${personaId} session=${sessionId}`);
        } catch (err) {
          console.warn(`[WarmupCache] SKIP routeEvalCall error for personaId=${personaId}:`, err);
          metrics.skipped++;
        }
      }),
    );

    // Stagger between batches to avoid competing with live workers
    if (i + WARMUP_CONCURRENCY < combos.length) {
      await new Promise((r) => setTimeout(r, WARMUP_STAGGER_MS));
    }
  }

  metrics.durationMs = Date.now() - startMs;
  console.log(
    `[WarmupCache] Complete — attempted=${metrics.attempted} loaded=${metrics.loaded} ` +
    `alreadyCached=${metrics.alreadyCached} skipped=${metrics.skipped} ` +
    `duration=${metrics.durationMs}ms`,
  );
  return metrics;
}

/**
 * Fire-and-forget warm-up scheduler.
 * Runs the warm-up in the background without blocking the caller.
 * Safe to call at fleet start — errors are caught and logged.
 */
export function scheduleWarmup(opts: WarmupOptions = {}): void {
  // Use setImmediate to yield to the event loop first, ensuring fleet startup
  // is not delayed even by the initial DB query.
  setImmediate(() => {
    runWarmup(opts).catch((err) => {
      console.warn("[WarmupCache] Unexpected error in background warm-up:", err);
    });
  });
}
