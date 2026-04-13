/**
 * triageEngine.ts
 * Layer 1 — Fast Deal Triage
 *
 * Single LLM call (claude-haiku-4-5) that decides whether a deal memo
 * is worth running through the full 10-agent council.
 *
 * Decisions:
 *   PROCEED              → move to full council evaluation
 *   OBVIOUS_REJECT       → clearly unqualified (spam, personal loan, MLM, etc.)
 *   INSUFFICIENT_INPUT   → too little information to evaluate
 *   OUT_OF_SCOPE         → not an investment deal (e.g. job application, news article)
 *
 * Performance targets:
 *   - Token usage: ~1,700 input + ~150 output per call
 *   - Latency: < 3 seconds
 *   - Cost: ~$0.002 per call
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type TriageDecision =
  | "PROCEED"
  | "OBVIOUS_REJECT"
  | "INSUFFICIENT_INPUT"
  | "OUT_OF_SCOPE";

export interface TriageResult {
  decision: TriageDecision;
  confidence: number; // 0–1
  reason: string;     // 1–2 sentences
  durationMs: number;
}

const TRIAGE_SYSTEM_PROMPT = `You are a deal intake filter for a venture capital and private equity investment committee.

Your ONLY job is to decide if a submitted text is a legitimate investment deal memo that deserves full evaluation.

Rules:
- PROCEED: The text describes a real company, startup, or investment opportunity with enough detail to evaluate (sector, business model, or ask mentioned)
- OBVIOUS_REJECT: Clearly not a real investment deal — spam, personal loan request, MLM/pyramid scheme, gambling, illegal activity, or completely off-topic content
- INSUFFICIENT_INPUT: The text is too short, vague, or incomplete to evaluate (less than 50 meaningful words about the business)
- OUT_OF_SCOPE: Not an investment deal — job application, news article, academic paper, general question, or unrelated content

DO NOT perform investment analysis. DO NOT assess quality or merit of the deal.
ONLY assess: Is this a real deal memo with enough information to evaluate?

Respond with STRICT JSON only. No explanation outside the JSON.`;

const TRIAGE_TIMEOUT_MS = 15_000;

export async function runTriage(dealText: string): Promise<TriageResult> {
  const startMs = Date.now();

  const userMessage = `Evaluate this submission and classify it:\n\n${dealText.slice(0, 4000)}\n\nRespond with strict JSON:\n{"decision":"PROCEED"|"OBVIOUS_REJECT"|"INSUFFICIENT_INPUT"|"OUT_OF_SCOPE","confidence":0.0-1.0,"reason":"1-2 sentence explanation"}`;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TRIAGE_TIMEOUT")), TRIAGE_TIMEOUT_MS)
  );

  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      timeoutPromise,
    ]);

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Non-text triage response");

    // Parse JSON — strip any markdown fences if present
    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(raw);

    const decision: TriageDecision = ["PROCEED", "OBVIOUS_REJECT", "INSUFFICIENT_INPUT", "OUT_OF_SCOPE"].includes(parsed.decision)
      ? parsed.decision
      : "PROCEED"; // default to PROCEED if parse is ambiguous

    return {
      decision,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 300) : "Triage completed.",
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message === "TRIAGE_TIMEOUT";
    console.warn(`[TriageEngine] ${isTimeout ? "Timeout" : "Error"}: ${message}`);

    // On triage failure, default to PROCEED so the deal is not silently dropped
    return {
      decision: "PROCEED",
      confidence: 0.5,
      reason: isTimeout
        ? "Triage timed out — proceeding to full council as a precaution."
        : `Triage error — proceeding to full council. (${message.slice(0, 100)})`,
      durationMs: Date.now() - startMs,
    };
  }
}
