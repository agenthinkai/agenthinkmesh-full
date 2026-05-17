/**
 * voiceDemo.ts — tRPC router for the VoiceDemoAgent
 *
 * Procedures:
 *   voiceDemo.classifyQuestion  — classifies a free-text question into 1 of 14 categories
 *   voiceDemo.captureLead       — persists a lead event and fires a notification email
 *   voiceDemo.logEvent          — lightweight analytics event log (demo_started, step_advanced, etc.)
 */
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { sendGraphEmail } from "../graphEmail";
import { invokeLLM } from "../_core/llm";

// ── 14 Q&A categories ─────────────────────────────────────────────────────────
export const QA_CATEGORIES = [
  "council_mechanics",       // How does the Council of 10 work?
  "agent_roles",             // What does each agent do?
  "shariah_compliance",      // Shariah screening, AAOIFI
  "sovereign_ai",            // Sovereign AI, data residency, SADO
  "pricing_and_access",      // Cost, trial, subscription
  "integration",             // API, connectors, A2A
  "data_security",           // Encryption, CMK, audit trail
  "use_cases",               // What can I use this for?
  "deal_types",              // Supported deal/asset types
  "performance_and_latency", // Speed, throughput, SLA
  "governance_and_audit",    // Audit replay, escalation, explainability
  "onboarding",              // How do I get started?
  "comparison",              // vs. Bloomberg, vs. GPT-4, vs. human analysts
  "other",                   // Catch-all
] as const;

export type QaCategory = typeof QA_CATEGORIES[number];

// ── Lead event types ──────────────────────────────────────────────────────────
export const LEAD_EVENTS = [
  "demo_started",
  "step_advanced",
  "handoff_requested",
  "partnership_interest",
  "question_asked",
] as const;

export type LeadEvent = typeof LEAD_EVENTS[number];

// ── Email template ────────────────────────────────────────────────────────────
function buildLeadEmailHtml(params: {
  event: LeadEvent;
  route: string;
  name?: string;
  email?: string;
  company?: string;
  question?: string;
  step?: number;
  userAgent: string;
  timestamp: string;
}): string {
  const { event, route, name, email, company, question, step, userAgent, timestamp } = params;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { background: #0a0f1e; color: #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { border-bottom: 1px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 24px; }
  .logo { color: #06b6d4; font-size: 18px; font-weight: 700; letter-spacing: 0.05em; }
  .badge { display: inline-block; background: #06b6d420; border: 1px solid #06b6d440; border-radius: 20px; padding: 4px 14px; font-size: 11px; color: #06b6d4; font-family: monospace; letter-spacing: 0.06em; margin-bottom: 16px; }
  h2 { color: #f1f5f9; font-size: 20px; font-weight: 700; margin: 0 0 16px; }
  .row { display: flex; gap: 8px; margin-bottom: 8px; }
  .label { color: #64748b; font-size: 12px; font-family: monospace; min-width: 120px; }
  .value { color: #e2e8f0; font-size: 13px; }
  .question-box { background: #0f172a; border: 1px solid #1e3a5f; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 14px; color: #94a3b8; font-style: italic; }
  .footer { border-top: 1px solid #1e3a5f; padding-top: 16px; margin-top: 32px; color: #475569; font-size: 11px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">AgenThink<span style="color:#f59e0b">Mesh</span></div>
  </div>
  <div class="badge">${event.toUpperCase().replace(/_/g, " ")}</div>
  <h2>New Demo Lead Event</h2>
  <div class="row"><span class="label">Event</span><span class="value">${event}</span></div>
  <div class="row"><span class="label">Route</span><span class="value">${route}</span></div>
  ${step !== undefined ? `<div class="row"><span class="label">Step</span><span class="value">${step}</span></div>` : ""}
  ${name ? `<div class="row"><span class="label">Name</span><span class="value">${name}</span></div>` : ""}
  ${email ? `<div class="row"><span class="label">Email</span><span class="value">${email}</span></div>` : ""}
  ${company ? `<div class="row"><span class="label">Company</span><span class="value">${company}</span></div>` : ""}
  <div class="row"><span class="label">Timestamp</span><span class="value">${timestamp}</span></div>
  <div class="row"><span class="label">User Agent</span><span class="value" style="font-size:11px;word-break:break-all">${userAgent}</span></div>
  ${question ? `<div class="question-box">"${question}"</div>` : ""}
  <div class="footer">AgenThinkMesh · Automated lead capture · voiceDemo router</div>
</div>
</body>
</html>`;
}

// ── Router ────────────────────────────────────────────────────────────────────
export const voiceDemoRouter = router({
  /**
   * Classify a free-text question into one of the 14 Q&A categories.
   * Uses LLM structured output for accuracy; falls back to "other" on error.
   */
  classifyQuestion: publicProcedure
    .input(z.object({
      question: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a classifier for AgenThinkMesh demo questions.
Classify the user question into exactly one of these 14 categories:
${QA_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Respond with JSON only: { "category": "<category_name>", "confidence": 0.0-1.0 }`,
            },
            { role: "user", content: input.question },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "question_classification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  category: { type: "string", enum: QA_CATEGORIES as unknown as string[] },
                  confidence: { type: "number" },
                },
                required: ["category", "confidence"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = result?.choices?.[0]?.message?.content;
        if (!content) return { category: "other" as QaCategory, confidence: 0 };
        const rawContent = typeof content === "string" ? content : JSON.stringify(content);
        const parsed = JSON.parse(rawContent) as { category: QaCategory; confidence: number };
        return { category: parsed.category, confidence: parsed.confidence };
      } catch {
        return { category: "other" as QaCategory, confidence: 0 };
      }
    }),

  /**
   * Capture a lead event and send a notification email to farouq@agenthink.com.
   * All fields except event, route, and userAgent are optional.
   */
  captureLead: publicProcedure
    .input(z.object({
      event: z.enum(LEAD_EVENTS),
      route: z.string().min(1).max(200),
      name: z.string().max(200).optional(),
      email: z.string().email().optional(),
      company: z.string().max(200).optional(),
      question: z.string().max(2000).optional(),
      step: z.number().int().min(0).max(20).optional(),
      userAgent: z.string().max(500).default("unknown"),
    }))
    .mutation(async ({ input }) => {
      const timestamp = new Date().toISOString();
      // Fire-and-forget — never block the UI on email delivery
      sendGraphEmail({
        to: "farouq@agenthink.com",
        subject: `[AgenThinkMesh Demo] ${input.event} · ${input.route}`,
        html: buildLeadEmailHtml({ ...input, timestamp }),
      }).catch((err) => {
        console.warn("[voiceDemo.captureLead] Email delivery failed:", err?.message ?? err);
      });
      return { captured: true, timestamp };
    }),

  /**
   * Lightweight analytics event log — fire-and-forget from the client.
   * Returns immediately; any persistence happens async.
   */
  logEvent: publicProcedure
    .input(z.object({
      event: z.string().min(1).max(100),
      route: z.string().min(1).max(200),
      step: z.number().int().min(0).max(20).optional(),
      meta: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      // Console log for now — can be persisted to eval_inference_log or a
      // dedicated events table in a future iteration.
      console.log("[voiceDemo.logEvent]", JSON.stringify({
        event: input.event,
        route: input.route,
        step: input.step,
        meta: input.meta,
        ts: Date.now(),
      }));
      return { logged: true };
    }),
});
