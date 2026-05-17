/**
 * evalObservability.ts — Eval inference log writer
 *
 * Fire-and-forget: writes one row to eval_inference_log per LLM call.
 * Never throws — all errors are swallowed with a console.warn.
 *
 * Stores: provider, model, token counts, estimated cost, latency,
 *         escalation reason, retry count, fallback flag, fromCache flag.
 * NEVER stores: question text, agent rationale, deal content.
 *
 * P4 addition: fromCache=true rows have estimatedCostUsd=0 and latencyMs=0
 * since no LLM call was made. This is intentional — it keeps cost aggregations
 * accurate (cache hits don't incur API cost).
 */

import { getDb } from "../../db";
import { evalInferenceLog } from "../../../drizzle/schema";

// ── Cost estimates (USD per 1M tokens) ───────────────────────────────────────
// Approximate rates as of May 2026. Update when pricing changes.
const COST_PER_M_INPUT: Record<string, number> = {
  "deepseek-chat":     0.07,   // DeepSeek V3 / Flash
  "deepseek-reasoner": 0.55,   // DeepSeek R1 / Pro
  "claude-sonnet-4-5": 3.00,   // Claude Sonnet 4.5 (Forge proxy)
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const inputRate = COST_PER_M_INPUT[model] ?? 1.00;
  // Output tokens typically billed at ~3× input rate for most providers
  const outputRate = inputRate * 3;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface EvalCallLogEntry {
  sessionId: string;
  personaId: string;
  provider: "deepseek" | "claude";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  retryCount?: number;
  escalationReason?: string | null;
  fallbackUsed?: boolean;
  fromCache?: boolean;  // P4: true when served from in-process LRU cache
}

/**
 * logEvalCall — append one row to eval_inference_log.
 *
 * Safe to call without await. Never throws.
 *
 * Cache hit rows: estimatedCostUsd="0.000000", latencyMs=0, inputTokens=null,
 * outputTokens=null. This keeps cost aggregations accurate.
 */
export function logEvalCall(entry: EvalCallLogEntry): void {
  const {
    sessionId,
    personaId,
    provider,
    model,
    inputTokens = 0,
    outputTokens = 0,
    latencyMs,
    retryCount = 0,
    escalationReason = null,
    fallbackUsed = false,
    fromCache = false,
  } = entry;

  // Cache hits have zero cost — no tokens consumed
  const estimatedCostUsd = fromCache
    ? "0.000000"
    : estimateCost(model, inputTokens, outputTokens).toFixed(6);

  // Fire-and-forget — intentionally not awaited
  (async () => {
    try {
      const db = await getDb();
      if (!db) return;
      await db.insert(evalInferenceLog).values({
        sessionId,
        personaId,
        provider,
        model,
        inputTokens:      fromCache ? null : (inputTokens || null),
        outputTokens:     fromCache ? null : (outputTokens || null),
        estimatedCostUsd,
        latencyMs:        fromCache ? 0 : (latencyMs ?? null),
        retryCount,
        escalationReason: escalationReason ?? null,
        fallbackUsed:     fallbackUsed ? 1 : 0,
        fromCache:        fromCache ? 1 : 0,
      });
    } catch (err) {
      console.warn("[EvalObservability] Log write failed (non-fatal):", err);
    }
  })();
}
