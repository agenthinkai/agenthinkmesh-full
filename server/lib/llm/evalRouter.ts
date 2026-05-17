/**
 * evalRouter.ts — DeepSeek-first eval inference router
 *
 * Routing strategy (when ENABLE_DEEPSEEK_ROUTING=true):
 *
 *   1. EvalCache (LRU, 30-min TTL) — check before any LLM call
 *   2. DeepSeek Flash (deepseek-chat) — primary production path
 *   3. DeepSeek Pro (deepseek-reasoner) — escalation on:
 *        • malformed JSON response
 *        • parsed confidence < CONFIDENCE_ESCALATION_THRESHOLD
 *   4. Claude via invokeLLM() — emergency fallback on:
 *        • DeepSeek API unavailable (network error, 5xx)
 *        • Both Flash and Pro attempts exhausted
 *
 * When ENABLE_DEEPSEEK_ROUTING=false (default):
 *   → passes through directly to invokeLLM() — zero behaviour change.
 *   → Cache is still checked/populated on this path.
 *
 * This file is the ONLY entry point for LLM calls in councilEngine.ts.
 * deepseekProvider.ts and evalObservability.ts are internal to this module.
 */

import { ENV } from "../../_core/env";
import { invokeLLM, type InvokeParams, type InvokeResult } from "../../_core/llm";
import {
  callDeepSeek,
  DeepSeekError,
  DeepSeekKeyMissingError,
} from "./deepseekProvider";
import { logEvalCall } from "./evalObservability";
import {
  buildEvalCacheKey,
  evalCacheGet,
  evalCacheSet,
} from "./evalCache";
import type { Message } from "../../_core/llm";

// ── Config ────────────────────────────────────────────────────────────────────

/** Confidence below this triggers escalation from Flash → Pro */
const CONFIDENCE_ESCALATION_THRESHOLD = 0.3;

/** Per-call timeout in ms for DeepSeek calls */
const DEEPSEEK_TIMEOUT_MS = 45_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type EscalationReason =
  | "low_confidence"
  | "malformed_json"
  | "deepseek_unavailable"
  | null;

export interface EvalRouterResult {
  /** The raw InvokeResult in the same shape as invokeLLM() returns */
  invokeResult: InvokeResult;
  /** Which provider actually served this call */
  provider: "deepseek" | "claude";
  /** Which model was used */
  model: string;
  /** Why escalation or fallback occurred, if any */
  escalationReason: EscalationReason;
  /** True if the Claude fallback path was used */
  fallbackUsed: boolean;
  /** Number of retry/escalation attempts before final result */
  retryCount: number;
  /** Wall-clock latency of the winning call in ms */
  latencyMs: number;
  /** True if this result was served from the in-process LRU cache */
  fromCache?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wrap a DeepSeek result in an InvokeResult envelope so the caller
 * (councilEngine.ts) can treat it identically to an invokeLLM() response.
 */
function wrapAsInvokeResult(content: string, model: string): InvokeResult {
  return {
    id: `ds-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

/**
 * Extract a confidence value from a JSON string if present.
 * Returns null if the string is not valid JSON or has no confidence field.
 */
function extractConfidence(raw: string): number | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const conf = parsed["confidence"];
    if (typeof conf === "number") return conf;
    if (typeof conf === "string") {
      const n = parseFloat(conf);
      return isNaN(n) ? null : n;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Return true if the string is not valid JSON (used to detect malformed output).
 */
function isMalformedJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return false;
  } catch {
    return true;
  }
}

/**
 * Create an AbortSignal that fires after timeoutMs.
 */
function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * routeEvalCall — unified LLM dispatcher for council eval calls.
 *
 * Drop-in replacement for invokeLLM() inside councilEngine.ts.
 * Returns an InvokeResult-compatible object plus routing metadata.
 *
 * @param params   Same params as invokeLLM()
 * @param context  Optional context for observability (sessionId, personaId)
 */
export async function routeEvalCall(
  params: InvokeParams,
  context: { sessionId: string; personaId: string } = {
    sessionId: "unknown",
    personaId: "unknown",
  },
): Promise<EvalRouterResult> {
  // ── P4: Cache check — before any LLM call ─────────────────────────────────
  const messages = params.messages as Array<{ role: string; content: string }>;
  const cacheKey = buildEvalCacheKey(messages, context.personaId);
  const cached = evalCacheGet(cacheKey);
  if (cached) {
    // Log the cache hit so P5/P6 aggregations can compute hit rate
    logEvalCall({
      sessionId: context.sessionId,
      personaId: context.personaId,
      provider:  cached.provider,
      model:     cached.model,
      retryCount: 0,
      escalationReason: null,
      fallbackUsed: false,
      fromCache: true,
    });
    return { ...cached, fromCache: true, latencyMs: 0 };
  }

  // ── Fast path: feature flag off → existing Claude/Forge path ─────────────
  if (!ENV.enableDeepseekRouting) {
    const t0 = Date.now();
    const invokeResult = await invokeLLM(params);
    const latencyMs = Date.now() - t0;
    const model = invokeResult.model ?? ENV.fallbackModel;
    logEvalCall({
      sessionId: context.sessionId,
      personaId: context.personaId,
      provider: "claude",
      model,
      inputTokens: invokeResult.usage?.prompt_tokens,
      outputTokens: invokeResult.usage?.completion_tokens,
      latencyMs,
      retryCount: 0,
      escalationReason: null,
      fallbackUsed: false,
    });
    const result: EvalRouterResult = {
      invokeResult,
      provider: "claude",
      model,
      escalationReason: null,
      fallbackUsed: false,
      retryCount: 0,
      latencyMs,
    };
    evalCacheSet(cacheKey, result);
    return result;
  }

  // ── DeepSeek path ─────────────────────────────────────────────────────────
  const deepseekMessages = params.messages as Message[];
  let retryCount = 0;
  let escalationReason: EscalationReason = null;

  // Step 1: Try DeepSeek Flash
  try {
    const t0 = Date.now();
    const flashResult = await callDeepSeek({
      messages: deepseekMessages,
      model: ENV.defaultEvalModel,
      maxTokens: params.max_tokens ?? params.maxTokens ?? 2048,
      signal: timeoutSignal(DEEPSEEK_TIMEOUT_MS),
    });
    const latencyMs = Date.now() - t0;

    // Check if escalation is needed
    const needsEscalation =
      isMalformedJson(flashResult.content) ||
      (extractConfidence(flashResult.content) !== null &&
        (extractConfidence(flashResult.content) as number) <
          CONFIDENCE_ESCALATION_THRESHOLD);

    if (!needsEscalation) {
      // Flash succeeded cleanly
      logEvalCall({
        sessionId: context.sessionId,
        personaId: context.personaId,
        provider: "deepseek",
        model: flashResult.model,
        inputTokens: flashResult.inputTokens,
        outputTokens: flashResult.outputTokens,
        latencyMs,
        retryCount: 0,
        escalationReason: null,
        fallbackUsed: false,
      });
      const result: EvalRouterResult = {
        invokeResult: wrapAsInvokeResult(flashResult.content, flashResult.model),
        provider: "deepseek",
        model: flashResult.model,
        escalationReason: null,
        fallbackUsed: false,
        retryCount: 0,
        latencyMs,
      };
      evalCacheSet(cacheKey, result);
      return result;
    }

    // Escalation needed
    escalationReason = isMalformedJson(flashResult.content)
      ? "malformed_json"
      : "low_confidence";
    retryCount = 1;
    console.log(
      `[EvalRouter] Flash escalation — reason: ${escalationReason}, ` +
      `persona: ${context.personaId}, session: ${context.sessionId}`,
    );

    // Step 2: Try DeepSeek Pro (escalation)
    const t1 = Date.now();
    const proResult = await callDeepSeek({
      messages: deepseekMessages,
      model: ENV.strongEvalModel,
      maxTokens: params.max_tokens ?? params.maxTokens ?? 2048,
      signal: timeoutSignal(DEEPSEEK_TIMEOUT_MS),
    });
    const proLatencyMs = Date.now() - t1;

    logEvalCall({
      sessionId: context.sessionId,
      personaId: context.personaId,
      provider: "deepseek",
      model: proResult.model,
      inputTokens: proResult.inputTokens,
      outputTokens: proResult.outputTokens,
      latencyMs: proLatencyMs,
      retryCount,
      escalationReason,
      fallbackUsed: false,
    });
    const proRouterResult: EvalRouterResult = {
      invokeResult: wrapAsInvokeResult(proResult.content, proResult.model),
      provider: "deepseek",
      model: proResult.model,
      escalationReason,
      fallbackUsed: false,
      retryCount,
      latencyMs: proLatencyMs,
    };
    evalCacheSet(cacheKey, proRouterResult);
    return proRouterResult;
  } catch (err) {
    // DeepSeek unavailable (network error, 5xx, key missing, timeout)
    const isKeyMissing = err instanceof DeepSeekKeyMissingError;
    const isApiError = err instanceof DeepSeekError;
    const isAbort = err instanceof Error && err.name === "AbortError";

    if (isKeyMissing) {
      console.warn(
        "[EvalRouter] DeepSeek key missing — falling back to Claude. " +
        "Add DEEPSEEK_API_KEY via Settings → Secrets.",
      );
    } else if (isApiError || isAbort) {
      console.warn(
        `[EvalRouter] DeepSeek unavailable (${isAbort ? "timeout" : `HTTP ${(err as DeepSeekError).statusCode}`}) ` +
        `— falling back to Claude. Persona: ${context.personaId}`,
      );
    } else {
      console.error("[EvalRouter] Unexpected DeepSeek error:", err);
    }

    escalationReason = "deepseek_unavailable";
    retryCount += 1;
  }

  // Step 3: Emergency fallback — Claude via existing invokeLLM()
  console.log(
    `[EvalRouter] Using Claude fallback. Session: ${context.sessionId}, ` +
    `persona: ${context.personaId}`,
  );
  const t2 = Date.now();
  const fallbackResult = await invokeLLM(params);
  const fallbackLatencyMs = Date.now() - t2;
  const fallbackModel = fallbackResult.model ?? ENV.fallbackModel;

  logEvalCall({
    sessionId: context.sessionId,
    personaId: context.personaId,
    provider: "claude",
    model: fallbackModel,
    inputTokens: fallbackResult.usage?.prompt_tokens,
    outputTokens: fallbackResult.usage?.completion_tokens,
    latencyMs: fallbackLatencyMs,
    retryCount,
    escalationReason,
    fallbackUsed: true,
  });

  const fallbackRouterResult: EvalRouterResult = {
    invokeResult: fallbackResult,
    provider: "claude",
    model: fallbackModel,
    escalationReason,
    fallbackUsed: true,
    retryCount,
    latencyMs: fallbackLatencyMs,
  };
  // Do NOT cache fallback results — they indicate degraded state
  // (DeepSeek unavailable). We want the next call to retry DeepSeek.
  return fallbackRouterResult;
}
