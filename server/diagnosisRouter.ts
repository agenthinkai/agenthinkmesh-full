/**
 * diagnosisRouter.ts — Startup Idea Diagnostic Engine
 *
 * Procedures:
 *   diagnosis.run        — LLM call, writes orchestration_units row, returns score + dimensions + gaps
 *   diagnosis.captureLead — stores email + metadata to diaspora_leads
 *   diagnosis.getLeads   — admin-only, returns all leads for CSV export
 *   diagnosis.createCheckout — Stripe checkout for $14 deep report or $39/mo AI Partner
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { orchestrationUnits, diasporaLeads } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { desc } from "drizzle-orm";
import Stripe from "stripe";

// ── Stripe helper ─────────────────────────────────────────────────────────────
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try { return new Stripe(key); } catch { return null; }
}

// ── Output schema (must match the LLM JSON schema exactly) ───────────────────
const DimensionSchema = z.object({
  name: z.enum(["business_model", "market", "moat", "cashflow"]),
  score: z.number().min(0).max(100),
  note: z.string().min(1),
});

const GapSchema = z.object({
  title: z.string().min(1),
  why_fatal: z.string().min(1),
  fix: z.string().min(1),
});

const DiagnosisOutputSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z.array(DimensionSchema).length(4),
  gaps: z.array(GapSchema).length(3),
});

export type DiagnosisOutput = z.infer<typeof DiagnosisOutputSchema>;

// ── Tier pricing (SMALL model for free diagnostic) ────────────────────────────
const TIER = "SMALL";
const INPUT_PRICE_PER_M = 0.15;
const OUTPUT_PRICE_PER_M = 0.60;
const WORKFLOW_TYPE = "founder_diagnostic";

// ── Deterministic output validator (mirrors meshRuntime.validateStructuredOutput) ──
function validateDiagnosisOutput(raw: string): DiagnosisOutput | null {
  try {
    // Strip markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    const result = DiagnosisOutputSchema.safeParse(parsed);
    if (!result.success) return null;
    // Check no required string fields are empty/null
    for (const d of result.data.dimensions) {
      if (!d.note?.trim()) return null;
    }
    for (const g of result.data.gaps) {
      if (!g.title?.trim() || !g.why_fatal?.trim() || !g.fix?.trim()) return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(language: "zh" | "en"): string {
  const lang = language === "zh" ? "Chinese (Simplified)" : "English";
  return `You are a cold, investor-grade startup diagnostic engine. Your job is to identify fatal flaws in startup ideas — not to encourage. Be direct, specific, and brutal where warranted.

Respond ONLY with valid JSON matching this exact schema (no markdown, no explanation outside the JSON):
{
  "score": <integer 0-100, overall idea health>,
  "dimensions": [
    {"name": "business_model", "score": <0-100>, "note": "<2-3 sentences, specific critique>"},
    {"name": "market", "score": <0-100>, "note": "<2-3 sentences, specific critique>"},
    {"name": "moat", "score": <0-100>, "note": "<2-3 sentences, specific critique>"},
    {"name": "cashflow", "score": <0-100>, "note": "<2-3 sentences, specific critique>"}
  ],
  "gaps": [
    {"title": "<short gap name>", "why_fatal": "<why this kills the business>", "fix": "<concrete fix>"},
    {"title": "<short gap name>", "why_fatal": "<why this kills the business>", "fix": "<concrete fix>"},
    {"title": "<short gap name>", "why_fatal": "<why this kills the business>", "fix": "<concrete fix>"}
  ]
}

Rules:
- Exactly 4 dimensions, exactly 3 gaps.
- Score reflects realistic investor assessment, not founder optimism.
- All notes and gap fields must be non-empty.
- Write in ${lang}.
- No encouragement. No "this is a great idea". Identify what will kill the business.`;
}

// ── diagnosisRouter ───────────────────────────────────────────────────────────
export const diagnosisRouter = router({

  // ── Run diagnosis (public — no login required) ────────────────────────────
  run: publicProcedure
    .input(z.object({
      idea: z.string().min(10).max(2000),
      language: z.enum(["zh", "en"]).default("zh"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const startMs = Date.now();

      const systemPrompt = buildSystemPrompt(input.language);
      const userMessage = input.language === "zh"
        ? `请诊断以下创业想法：\n\n${input.idea}`
        : `Please diagnose the following startup idea:\n\n${input.idea}`;

      let attemptsCount = 0;
      const tiersUsed: string[] = [];
      let diagnosisResult: DiagnosisOutput | null = null;
      let escalated = false;
      let escalationReason: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      let capBreach = false;
      const TOKEN_CAP = 8000; // hard cap for free diagnostic

      // Escalation loop: SMALL → MID → LARGE, max 6 attempts
      const TIERS = ["SMALL", "MID", "LARGE"];
      let tierIdx = 0;

      while (attemptsCount < 6 && tierIdx < TIERS.length) {
        const currentTier = TIERS[tierIdx];
        tiersUsed.push(currentTier);
        attemptsCount++;

        // Token cap check before attempt
        if (inputTokens + outputTokens > TOKEN_CAP) {
          capBreach = true;
          break;
        }

        let rawContent: string | null = null;
        let hardFail = false;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "diagnosis_output",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    dimensions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          score: { type: "number" },
                          note: { type: "string" },
                        },
                        required: ["name", "score", "note"],
                        additionalProperties: false,
                      },
                    },
                    gaps: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          why_fatal: { type: "string" },
                          fix: { type: "string" },
                        },
                        required: ["title", "why_fatal", "fix"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["score", "dimensions", "gaps"],
                  additionalProperties: false,
                },
              },
            },
          });

          const msg = response?.choices?.[0]?.message;
          rawContent = typeof msg?.content === "string" ? msg.content : null;

          // Accumulate token counts
          if (response?.usage) {
            inputTokens += response.usage.prompt_tokens ?? 0;
            outputTokens += response.usage.completion_tokens ?? 0;
          }
        } catch {
          hardFail = true;
        }

        if (!hardFail && rawContent) {
          const validated = validateDiagnosisOutput(rawContent);
          if (validated) {
            diagnosisResult = validated;
            break; // success
          } else {
            // Validation failure → escalate immediately
            escalationReason = `Tier ${currentTier}: structured-output validation failed`;
            tierIdx++;
            if (tierIdx < TIERS.length) escalated = true;
          }
        } else {
          // Hard failure — retry same tier once
          if (attemptsCount < 6) {
            tiersUsed.push(currentTier);
            attemptsCount++;
            // Retry
            let retryContent: string | null = null;
            try {
              const retryResp = await invokeLLM({
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userMessage },
                ],
              });
              const retryMsg = retryResp?.choices?.[0]?.message;
              retryContent = typeof retryMsg?.content === "string" ? retryMsg.content : null;
              if (retryResp?.usage) {
                inputTokens += retryResp.usage.prompt_tokens ?? 0;
                outputTokens += retryResp.usage.completion_tokens ?? 0;
              }
            } catch { /* ignore */ }

            if (retryContent) {
              const validated = validateDiagnosisOutput(retryContent);
              if (validated) {
                diagnosisResult = validated;
                break;
              }
            }
          }
          // Both attempts failed → escalate
          escalationReason = `Tier ${currentTier}: hard failure after retry`;
          tierIdx++;
          if (tierIdx < TIERS.length) escalated = true;
        }
      }

      const latencyMs = Date.now() - startMs;
      const finalTier = tiersUsed[tiersUsed.length - 1] ?? TIER;

      // Compute token cost
      const tokenCostUsd = (inputTokens / 1_000_000) * INPUT_PRICE_PER_M
        + (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M;

      // Write orchestration_units row
      let ouId: number | null = null;
      if (db) {
        try {
          const [inserted] = await db.insert(orchestrationUnits).values({
            workflowType: WORKFLOW_TYPE,
            tier: finalTier,
            model: "built-in",
            provider: "manus",
            inputTokens,
            outputTokens,
            latencyMs,
            tiersUsed: JSON.stringify(tiersUsed),
            finalTier,
            attemptsCount,
            escalated: escalated ? 1 : 0,
            validationPassed: diagnosisResult ? 1 : 0,
            escalationReason: escalationReason ?? undefined,
            tokenCostUsd: tokenCostUsd.toFixed(8),
            humanGateCostUsd: "0.00000000",
            disputeCostUsd: "0.00000000",
            residencyCacUsd: "0.00400000", // self-serve CAC
            liabilityReserveUsd: "0.00000000",
            loadedCostUsd: (tokenCostUsd + 0.004).toFixed(8),
            priceUsd: "0.00000000",
            capBreach: capBreach ? 1 : 0,
            createdAt: Date.now(),
          });
          ouId = (inserted as any)?.insertId ?? null;
        } catch { /* non-fatal */ }
      }

      if (!diagnosisResult) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Diagnosis engine could not produce a valid result. Please try again.",
        });
      }

      return {
        ouId,
        score: diagnosisResult.score,
        dimensions: diagnosisResult.dimensions,
        gaps: diagnosisResult.gaps,
        tiersUsed,
        attemptsCount,
        escalated,
      };
    }),

  // ── Capture lead (public — called after diagnosis, before full report) ────
  captureLead: publicProcedure
    .input(z.object({
      email: z.string().email(),
      ideaHealthScore: z.number().min(0).max(100),
      gap1: z.string().max(512).optional(),
      gap2: z.string().max(512).optional(),
      gap3: z.string().max(512).optional(),
      language: z.enum(["zh", "en"]).default("zh"),
      buSource: z.string().max(64).default("diaspora"),
      ideaSnippet: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };

      try {
        await db.insert(diasporaLeads).values({
          email: input.email.toLowerCase().trim(),
          diagnosisDate: Date.now(),
          ideaHealthScore: input.ideaHealthScore,
          gap1: input.gap1 ?? null,
          gap2: input.gap2 ?? null,
          gap3: input.gap3 ?? null,
          language: input.language,
          buSource: input.buSource,
          ideaSnippet: input.ideaSnippet ?? null,
          createdAt: Date.now(),
        });
        return { ok: true };
      } catch {
        return { ok: false };
      }
    }),

  // ── Get leads (admin only) ────────────────────────────────────────────────
  getLeads: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(5000).default(1000),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { leads: [] };

      const leads = await db
        .select()
        .from(diasporaLeads)
        .orderBy(desc(diasporaLeads.createdAt))
        .limit(input.limit);

      return { leads };
    }),

  // ── Create Stripe checkout ($14 deep report or $39/mo AI Partner) ─────────
  createCheckout: publicProcedure
    .input(z.object({
      product: z.enum(["deep_report", "ai_partner"]),
      origin: z.string().url(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const stripe = getStripe();

      if (!stripe) {
        // Dev stub
        return {
          url: `${input.origin}/founder?stub=true&product=${input.product}`,
          stub: true,
        };
      }

      const isSubscription = input.product === "ai_partner";

      const session = await stripe.checkout.sessions.create({
        mode: isSubscription ? "subscription" : "payment",
        payment_method_types: ["card"],
        customer_email: input.email ?? undefined,
        line_items: [
          {
            price_data: {
              currency: "usd",
              ...(isSubscription
                ? { recurring: { interval: "month" } }
                : {}),
              unit_amount: isSubscription ? 3900 : 1400, // $39 or $14 in cents
              product_data: {
                name: isSubscription
                  ? "创诊 AI Partner — $39/month"
                  : "创诊 Deep Report — $14 one-time",
                description: isSubscription
                  ? "Unlimited diagnostics + weekly progress check + decision support"
                  : "Full gap analysis + industry benchmarks + investor Q&A simulation + PDF report",
              },
            },
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        success_url: `${input.origin}${input.origin.includes("/zh") ? "/zh" : "/founder"}?paid=1&product=${input.product}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}${input.origin.includes("/zh") ? "/zh" : "/founder"}?canceled=1`,
        metadata: {
          type: "founder_diagnostic",
          product: input.product,
          buSource: "diaspora",
        },
      });

      return { url: session.url, stub: false };
    }),
});

export type DiagnosisRouter = typeof diagnosisRouter;
