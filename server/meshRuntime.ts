/**
 * Mesh Core v0.1 — Escalation Engine (meshRuntime.ts)
 *
 * Implements the three-rule execution policy:
 *   1. PRIMARY  — deterministic structured-output validation (JSON parse + required fields)
 *   2. SECONDARY — hard failure / timeout → same-tier retry once, then escalate
 *   3. CAP-ABORT — token budget breach → abort, log cap_breach=true, return graceful fallback
 *
 * Recording rules (spec-exact):
 *   - attempts_count increments on EVERY model call (same-tier retries included)
 *   - tiers_used appends the tier of every attempt in order
 *   - escalated = true when tiers_used contains more than one distinct tier
 *   - max 6 total attempts, then fail gracefully
 *
 * Canonical acceptance test path:
 *   malformed input → SMALL attempt fails validation → MID attempt succeeds
 *   → OU row: tiers_used=["SMALL","MID"], attempts_count=2, escalated=true
 */

import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = "SMALL" | "MID" | "LARGE";

const TIER_ORDER: Tier[] = ["SMALL", "MID", "LARGE"];

/** One attempt record — appended to the execution log on every model call */
export interface AttemptRecord {
  tier: Tier;
  attemptsOnTier: number;  // 1 or 2 (same-tier retry = 2)
  validationPassed: boolean;
  hardFailure: boolean;
  failureReason?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/** Final result returned by runEscalating */
export interface EscalationResult {
  /** true = execution succeeded and output is valid */
  success: boolean;
  /** Parsed output from the successful attempt, or null on failure */
  output: Record<string, unknown> | null;
  /** Ordered list of tier names for every attempt, e.g. ["SMALL","SMALL","MID"] */
  tiersUsed: Tier[];
  /** Total model calls made (same-tier retries + escalations) */
  attemptsCount: number;
  /** true when tiersUsed contains more than one distinct tier */
  escalated: boolean;
  /** The tier that produced the final (successful or last) response */
  finalTier: Tier;
  /** true when the token budget was breached — execution aborted */
  capBreach: boolean;
  /** Human-readable reason for failure / escalation chain */
  escalationReason: string | null;
  /** Aggregated token counts across all attempts */
  totalInputTokens: number;
  totalOutputTokens: number;
  /** Latency of the final successful (or last) attempt in ms */
  latencyMs: number;
  /** Full attempt log for debugging */
  attempts: AttemptRecord[];
}

/** Workflow execution context passed to runEscalating */
export interface WorkflowContext {
  workflowType: string;
  /** JSON schema — keys are required field names, values are their expected types */
  requiredFields: Record<string, "string" | "number" | "boolean" | "object" | "array">;
  /** System prompt for the LLM */
  systemPrompt: string;
  /** User message / task input */
  userMessage: string;
  /** Hard token cap — if total tokens across all attempts would exceed this, abort */
  tokenBudgetCap?: number;
  /** Starting tier (default: SMALL) */
  startTier?: Tier;
}

// ─── Deterministic Validation ─────────────────────────────────────────────────

/**
 * Validates that `raw` is a JSON string that:
 *   1. Parses successfully
 *   2. Contains all required fields with non-null, non-empty values
 *   3. Each field matches the expected type
 *
 * Returns { valid: true, parsed } or { valid: false, reason }
 */
export function validateStructuredOutput(
  raw: string,
  requiredFields: Record<string, "string" | "number" | "boolean" | "object" | "array">
): { valid: true; parsed: Record<string, unknown> } | { valid: false; reason: string } {
  // Step 1 — JSON parse
  let parsed: unknown;
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { valid: false, reason: `JSON parse failure: ${(e as Error).message}` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, reason: "Root value is not a JSON object" };
  }

  const obj = parsed as Record<string, unknown>;

  // Step 2 — required fields check
  for (const [field, expectedType] of Object.entries(requiredFields)) {
    const val = obj[field];

    // null / undefined = missing
    if (val === null || val === undefined) {
      return { valid: false, reason: `Required field "${field}" is null or missing` };
    }

    // empty string = missing
    if (typeof val === "string" && val.trim() === "") {
      return { valid: false, reason: `Required field "${field}" is an empty string` };
    }

    // type check
    if (expectedType === "array") {
      if (!Array.isArray(val)) {
        return { valid: false, reason: `Field "${field}" expected array, got ${typeof val}` };
      }
    } else if (expectedType === "object") {
      if (typeof val !== "object" || Array.isArray(val)) {
        return { valid: false, reason: `Field "${field}" expected object, got ${typeof val}` };
      }
    } else {
      if (typeof val !== expectedType) {
        return { valid: false, reason: `Field "${field}" expected ${expectedType}, got ${typeof val}` };
      }
    }
  }

  return { valid: true, parsed: obj };
}

// ─── Token cost helpers (Amendment B pricing) ────────────────────────────────

const MODEL_PRICING: Record<Tier, { input: number; output: number }> = {
  SMALL: { input: 0.15, output: 0.60 },
  MID:   { input: 0.60, output: 2.40 },
  LARGE: { input: 2.50, output: 10.00 },
};

export function computeTokenCost(tier: Tier, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[tier];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ─── Loaded cost (Amendment A formula) ───────────────────────────────────────

export interface LoadedCostInput {
  tokenCostUsd: number;
  humanGateMinutes: number;
  humanGateCostPerMinute: number;
  residencyCacPerOuUsd: number;
  disputeRate: number;
  liabilityReservePct: number;
}

export interface LoadedCostOutput {
  humanGateCostUsd: number;
  disputeCostUsd: number;
  residencyCacUsd: number;
  liabilityReserveUsd: number;
  loadedCostUsd: number;
}

export function computeLoadedCost(input: LoadedCostInput): LoadedCostOutput {
  const { tokenCostUsd, humanGateMinutes, humanGateCostPerMinute,
          residencyCacPerOuUsd, disputeRate, liabilityReservePct } = input;

  const humanGateCostUsd = humanGateMinutes * humanGateCostPerMinute;
  const disputeCostUsd = disputeRate * (tokenCostUsd + humanGateCostUsd);
  const residencyCacUsd = residencyCacPerOuUsd;

  const subtotal = tokenCostUsd + humanGateCostUsd + disputeCostUsd + residencyCacUsd;
  // liabilityReserve is computed against priceUsd in the router; here we store the pct-of-subtotal
  // version for the engine's own cap check. The router will override with price-based value.
  const liabilityReserveUsd = subtotal * liabilityReservePct;
  const loadedCostUsd = subtotal + liabilityReserveUsd;

  return { humanGateCostUsd, disputeCostUsd, residencyCacUsd, liabilityReserveUsd, loadedCostUsd };
}

// ─── Verdict (Amendment D) ───────────────────────────────────────────────────

export type Verdict = "STRONG" | "VIABLE" | "REPRICE" | "FAIL";

export function computeVerdict(p50Margin: number, p90Margin: number): Verdict {
  if (p50Margin < 50) return "FAIL";
  if (p50Margin >= 50 && p90Margin < 20) return "REPRICE";
  if (p90Margin >= 50) return "STRONG";
  return "VIABLE";  // p90 >= 20 && < 50
}

// ─── Escalation Engine ────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 6;

/**
 * Runs a workflow with the full escalation policy:
 *   - Starts at ctx.startTier (default SMALL)
 *   - On validation failure → escalate to next tier
 *   - On hard failure → retry same tier once; if still fails → escalate
 *   - On token cap breach → abort immediately with capBreach=true
 *   - Max 6 total attempts across all tiers
 */
export async function runEscalating(ctx: WorkflowContext): Promise<EscalationResult> {
  const tiersUsed: Tier[] = [];
  const attemptLog: AttemptRecord[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let capBreach = false;
  let escalationReason: string | null = null;

  let tierIdx = TIER_ORDER.indexOf(ctx.startTier ?? "SMALL");
  if (tierIdx < 0) tierIdx = 0;

  let sametierRetryUsed = false;  // tracks whether we've already retried on the current tier

  while (tiersUsed.length < MAX_ATTEMPTS) {
    const currentTier = TIER_ORDER[tierIdx];

    // ── Token cap pre-check ──────────────────────────────────────────────────
    if (ctx.tokenBudgetCap !== undefined) {
      const projectedTokens = totalInputTokens + totalOutputTokens;
      if (projectedTokens >= ctx.tokenBudgetCap) {
        capBreach = true;
        escalationReason = `Token budget cap (${ctx.tokenBudgetCap}) reached after ${tiersUsed.length} attempts`;
        break;
      }
    }

    const attemptStart = Date.now();
    let rawContent = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let hardFailure = false;
    let hardFailureReason = "";

    // ── Model call ───────────────────────────────────────────────────────────
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: ctx.systemPrompt },
          { role: "user", content: ctx.userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "workflow_output",
            strict: true,
            schema: {
              type: "object",
              properties: Object.fromEntries(
                Object.entries(ctx.requiredFields).map(([k, t]) => [
                  k,
                  t === "array"
                    ? { type: "array", items: { type: "string" } }
                    : { type: t },
                ])
              ),
              required: Object.keys(ctx.requiredFields),
              additionalProperties: false,
            },
          },
        },
      });

      const rawMsg = response?.choices?.[0]?.message?.content;
      rawContent = typeof rawMsg === "string" ? rawMsg : (Array.isArray(rawMsg) ? JSON.stringify(rawMsg) : "");
      inputTokens = response?.usage?.prompt_tokens ?? 0;
      outputTokens = response?.usage?.completion_tokens ?? 0;
    } catch (err) {
      hardFailure = true;
      hardFailureReason = (err as Error).message ?? "Unknown error";
    }

    const latencyMs = Date.now() - attemptStart;
    tiersUsed.push(currentTier);
    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;

    // ── Token cap post-check ─────────────────────────────────────────────────
    if (ctx.tokenBudgetCap !== undefined && totalInputTokens + totalOutputTokens > ctx.tokenBudgetCap) {
      capBreach = true;
      escalationReason = `Token budget cap (${ctx.tokenBudgetCap}) exceeded during attempt ${tiersUsed.length}`;
      attemptLog.push({
        tier: currentTier,
        attemptsOnTier: sametierRetryUsed ? 2 : 1,
        validationPassed: false,
        hardFailure: false,
        failureReason: escalationReason,
        inputTokens,
        outputTokens,
        latencyMs,
      });
      break;
    }

    // ── Hard failure handling ────────────────────────────────────────────────
    if (hardFailure) {
      attemptLog.push({
        tier: currentTier,
        attemptsOnTier: sametierRetryUsed ? 2 : 1,
        validationPassed: false,
        hardFailure: true,
        failureReason: hardFailureReason,
        inputTokens,
        outputTokens,
        latencyMs,
      });

      if (!sametierRetryUsed) {
        // First hard failure on this tier → retry same tier
        sametierRetryUsed = true;
        escalationReason = `Hard failure on ${currentTier} (attempt ${tiersUsed.length}): ${hardFailureReason} — retrying same tier`;
        continue;
      } else {
        // Already retried → escalate
        sametierRetryUsed = false;
        escalationReason = `Hard failure on ${currentTier} after same-tier retry — escalating`;
        tierIdx++;
        if (tierIdx >= TIER_ORDER.length) {
          escalationReason = `All tiers exhausted after hard failures`;
          break;
        }
        continue;
      }
    }

    // ── Validation ───────────────────────────────────────────────────────────
    const validation = validateStructuredOutput(rawContent, ctx.requiredFields);

    attemptLog.push({
      tier: currentTier,
      attemptsOnTier: sametierRetryUsed ? 2 : 1,
      validationPassed: validation.valid,
      hardFailure: false,
      failureReason: validation.valid ? undefined : validation.reason,
      inputTokens,
      outputTokens,
      latencyMs,
    });

    if (validation.valid) {
      // ── SUCCESS ──────────────────────────────────────────────────────────
      const distinctTiers = new Set(tiersUsed);
      return {
        success: true,
        output: validation.parsed,
        tiersUsed,
        attemptsCount: tiersUsed.length,
        escalated: distinctTiers.size > 1,
        finalTier: currentTier,
        capBreach: false,
        escalationReason: distinctTiers.size > 1 ? escalationReason : null,
        totalInputTokens,
        totalOutputTokens,
        latencyMs,
        attempts: attemptLog,
      };
    }

    // Validation failure → escalate immediately (no same-tier retry for validation)
    sametierRetryUsed = false;
    escalationReason = `Validation failed on ${currentTier} (attempt ${tiersUsed.length}): ${validation.reason}`;
    tierIdx++;
    if (tierIdx >= TIER_ORDER.length) {
      escalationReason = `All tiers exhausted after validation failures`;
      break;
    }
  }

  // ── FAILURE / CAP-ABORT ───────────────────────────────────────────────────
  const distinctTiers = new Set(tiersUsed);
  return {
    success: false,
    output: null,
    tiersUsed,
    attemptsCount: tiersUsed.length,
    escalated: distinctTiers.size > 1,
    finalTier: tiersUsed[tiersUsed.length - 1] ?? (ctx.startTier ?? "SMALL"),
    capBreach,
    escalationReason,
    totalInputTokens,
    totalOutputTokens,
    latencyMs: 0,
    attempts: attemptLog,
  };
}
