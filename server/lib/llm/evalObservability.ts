/**
 * evalObservability.ts — Eval inference log writer
 *
 * Fire-and-forget: writes one row to eval_inference_log per LLM call.
 * Never throws — all errors are swallowed with a console.warn.
 *
 * Stores: provider, model, token counts, estimated cost, latency,
 *         escalation reason, retry count, fallback flag.
 * NEVER stores: question text, agent rationale, deal content.
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
}

/**
 * logEvalCall — append one row to eval_inference_log.
 *
 * Safe to call without await. Never throws.
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
  } = entry;

  const estimatedCostUsd = estimateCost(model, inputTokens, outputTokens)
    .toFixed(6);

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
        inputTokens: inputTokens || null,
        outputTokens: outputTokens || null,
        estimatedCostUsd,
        latencyMs: latencyMs ?? null,
        retryCount,
        escalationReason: escalationReason ?? null,
        fallbackUsed: fallbackUsed ? 1 : 0,
      });
    } catch (err) {
      console.warn("[EvalObservability] Log write failed (non-fatal):", err);
    }
  })();
}
