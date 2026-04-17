/**
 * server/routers/pitch.ts
 * Revenue Bridge — Public Pitch API
 *
 * Procedures:
 *   pitch.submit        — publicProcedure: run Council on pitch text, store result
 *   pitch.getResult     — publicProcedure: poll for result + payment status
 *   pitch.confirmPayment — publicProcedure: mark session as PAID (called by webhook)
 *   pitch.adminList     — protectedProcedure: admin view of all pitch sessions
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb, savePitchTriage, getPitchTriageHistory, getPitchTriageById } from "../db";
import { sql } from "drizzle-orm";
import { runCouncil } from "../councilEngine";
import { invokeLLM } from "../_core/llm";
import crypto from "crypto";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function sanitisePhone(raw: string): string {
  // Normalise Kuwait mobile: strip spaces, dashes, leading +965 or 00965
  return raw.replace(/[\s\-().]/g, "").replace(/^(\+965|00965)/, "965");
}

function isKuwaitMobile(phone: string): boolean {
  const clean = sanitisePhone(phone);
  // Kuwait mobiles: 965 + 8 digits starting with 5,6,9
  return /^(965)?[569]\d{7}$/.test(clean);
}

// ── Router ────────────────────────────────────────────────────────────────────

export const pitchRouter = router({
  /**
   * Submit a pitch for Council evaluation.
   * Returns pitchToken immediately; Council runs asynchronously.
   * Poll getResult to check progress.
   */
  submit: publicProcedure
    .input(
      z.object({
        pitchText: z.string().min(20, "Pitch must be at least 20 characters").max(2000, "Pitch must be under 2000 characters"),
        phone: z.string().min(8, "Enter a valid Kuwait mobile number"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const phone = sanitisePhone(input.phone);
      if (!isKuwaitMobile(phone)) {
        throw new Error("Please enter a valid Kuwait mobile number (e.g. 9XXXXXXX or 6XXXXXXX)");
      }

      const pitchToken = generateToken();

      // Insert pending session immediately so client can start polling
      await db.execute(
        sql`INSERT INTO pitch_sessions (pitchToken, phone, pitchText, paymentStatus, reportUnlocked)
            VALUES (${pitchToken}, ${phone}, ${input.pitchText}, 'PENDING', 0)`
      );

      // Run Council asynchronously — do not await
      (async () => {
        try {
          const result = await runCouncil(input.pitchText, {
            taskId: `pitch-${pitchToken.slice(0, 12)}`,
            taskDomain: "pitch",
            skipMemory: false,
          });

          // Build compact vote summary for report
          const voteSummary = result.votes.map((v) => ({
            persona: v.personaName,
            vote: v.vote,
            confidence: v.confidence,
            rationale: v.rationale,
            weight: v.weight,
          }));

          // Determine if APPROVED verdict → payment required
          const isApproved =
            result.verdict === "APPROVED" ||
            result.verdict === "APPROVED_WITH_CONDITIONS";
          const paymentStatus = isApproved ? "PENDING" : "FREE";

          // Persist to decision_memory
          let decisionMemoryId: number | null = null;
          try {
            const tfMap: Record<string, number> = {};
            for (const t of input.pitchText
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length > 2)) {
              tfMap[t] = (tfMap[t] ?? 0) + 1;
            }
            const embeddingJson = JSON.stringify(tfMap);
            const [dmRes] = await (db as any).$client.execute(
              `INSERT INTO decision_memory (taskId, taskDescription, taskDomain, embedding, finalVerdict, confidenceScore, paymentStatus, phone, pitchToken)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `pitch-${pitchToken.slice(0, 12)}`,
                input.pitchText.slice(0, 500),
                "pitch",
                embeddingJson,
                result.verdict,
                result.confidenceScore,
                paymentStatus,
                phone,
                pitchToken,
              ]
            );
            decisionMemoryId = (dmRes as any).insertId ?? null;
          } catch (_) {
            // Non-fatal — pitch session still works without decision_memory link
          }

          // Update pitch session with results
          await db.execute(
            sql`UPDATE pitch_sessions
                SET verdict = ${result.verdict},
                    confidenceScore = ${result.confidenceScore},
                    decisionMemoryId = ${decisionMemoryId},
                    paymentStatus = ${paymentStatus},
                    voteSummaryJson = ${JSON.stringify(voteSummary)},
                    updatedAt = NOW()
                WHERE pitchToken = ${pitchToken}`
          );
        } catch (err) {
          console.error("[PitchRouter] Council run failed:", err);
          // Mark session as errored so client can show friendly message
          await db.execute(
            sql`UPDATE pitch_sessions SET verdict = 'ERROR', updatedAt = NOW() WHERE pitchToken = ${pitchToken}`
          );
        }
      })();

      return { pitchToken };
    }),

  /**
   * Poll for pitch result + payment status.
   * Returns null verdict while Council is still running.
   */
  getResult: publicProcedure
    .input(z.object({ pitchToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [rows] = await (db as any).$client.execute(
        `SELECT pitchToken, verdict, confidenceScore, paymentStatus, reportUnlocked, voteSummaryJson, createdAt
         FROM pitch_sessions WHERE pitchToken = ? LIMIT 1`,
        [input.pitchToken]
      );
      if (!rows || rows.length === 0) throw new Error("Pitch session not found");

      const row = rows[0];
      const votes = row.voteSummaryJson ? JSON.parse(row.voteSummaryJson) : null;

      return {
        pitchToken: row.pitchToken as string,
        verdict: row.verdict as string | null,
        confidenceScore: row.confidenceScore ? parseFloat(row.confidenceScore) : null,
        paymentStatus: row.paymentStatus as "PENDING" | "PAID" | "FREE",
        reportUnlocked: !!row.reportUnlocked,
        votes,
        createdAt: row.createdAt as Date,
      };
    }),

  /**
   * Confirm payment and unlock the report.
   * Called by the /api/payment-confirm webhook.
   */
  confirmPayment: publicProcedure
    .input(
      z.object({
        pitchToken: z.string(),
        webhookSecret: z.string().optional(), // Simple shared secret for now
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Optional: validate webhook secret
      const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET ?? "knet-dev-secret-2026";
      if (input.webhookSecret && input.webhookSecret !== expectedSecret) {
        throw new Error("Invalid webhook secret");
      }

      const [rows] = await (db as any).$client.execute(
        `SELECT id, paymentStatus FROM pitch_sessions WHERE pitchToken = ? LIMIT 1`,
        [input.pitchToken]
      );
      if (!rows || rows.length === 0) throw new Error("Pitch session not found");

      await db.execute(
        sql`UPDATE pitch_sessions
            SET paymentStatus = 'PAID', reportUnlocked = 1, updatedAt = NOW()
            WHERE pitchToken = ${input.pitchToken}`
      );

      // Also update decision_memory if linked
      await db.execute(
        sql`UPDATE decision_memory SET paymentStatus = 'PAID' WHERE pitchToken = ${input.pitchToken}`
      );

      console.log(`[PitchRouter] Payment confirmed for pitchToken=${input.pitchToken}`);
      return { success: true, message: "Payment confirmed. Report unlocked." };
    }),

  /**
   * Admin: list all pitch sessions (protected).
   */
  adminList: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [rows] = await (db as any).$client.execute(
        `SELECT id, pitchToken, phone, LEFT(pitchText, 100) as pitchPreview,
                verdict, confidenceScore, paymentStatus, reportUnlocked, createdAt
         FROM pitch_sessions ORDER BY createdAt DESC LIMIT ?`,
        [input.limit]
      );
      return rows as Array<{
        id: number;
        pitchToken: string;
        phone: string;
        pitchPreview: string;
        verdict: string | null;
        confidenceScore: number | null;
        paymentStatus: string;
        reportUnlocked: number;
        createdAt: Date;
      }>;
    }),

  /**
   * pitch.triage — Lightweight 6-agent micro-evaluation.
   * All agents run in parallel via Promise.all.
   * No DB persistence. Server-side only.
   */
  triage: protectedProcedure
    .input(
      z.object({
        pitchText: z.string().min(10).max(20000),
        parentTriageId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const truncated = input.pitchText.slice(0, 3000);

      // ── Agent definitions ─────────────────────────────────────────────────
      type AgentName = "Market Signal" | "Business Model" | "Traction" | "Founder Signal" | "Risk" | "Completeness";
      const AGENTS: Array<{
        name: AgentName;
        labels: string[];
        fallback: string;
        systemPrompt: string;
      }> = [
        {
          name: "Market Signal",
          labels: ["strong", "weak", "unclear"],
          fallback: "weak",
          systemPrompt: `You are a market signal analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite a specific fact from the pitch text, e.g. market size, named competitor, geography, or growth rate; (2) reasoning MUST be ≤18 words; (3) NEVER use generic phrases like "the pitch mentions" or "there is potential".
Format: {"label": "strong"|"weak"|"unclear", "reasoning": "<concrete signal from pitch, ≤18 words>"}`,
        },
        {
          name: "Business Model",
          labels: ["clear", "weak", "missing"],
          fallback: "weak",
          systemPrompt: `You are a business model analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite the specific revenue mechanism stated (e.g. SaaS subscription, transaction fee, licensing); (2) reasoning MUST be ≤18 words; (3) if no model is stated, label="missing" and say what is absent.
Format: {"label": "clear"|"weak"|"missing", "reasoning": "<concrete signal from pitch, ≤18 words>"}`,
        },
        {
          name: "Traction",
          labels: ["strong", "early", "none"],
          fallback: "early",
          systemPrompt: `You are a traction analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) quote or paraphrase a specific metric from the pitch (e.g. "$120k ARR", "3 pilots signed", "10k MAU"); (2) reasoning MUST be ≤18 words; (3) if no metrics are present, label="none" and state that.
Format: {"label": "strong"|"early"|"none", "reasoning": "<concrete signal from pitch, ≤18 words>"}`,
        },
        {
          name: "Founder Signal",
          labels: ["strong", "neutral", "risk"],
          fallback: "neutral",
          systemPrompt: `You are a founder signal analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) reference a specific credential, prior exit, domain tenure, or red flag mentioned in the pitch; (2) reasoning MUST be ≤18 words; (3) if no founder info is present, label="neutral" and note the absence.
Format: {"label": "strong"|"neutral"|"risk", "reasoning": "<concrete signal from pitch, ≤18 words>"}`,
        },
        {
          name: "Risk",
          labels: ["low", "medium", "high"],
          fallback: "medium",
          systemPrompt: `You are a risk analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) name the single most significant risk factor visible in the pitch (regulatory, competitive, execution, market timing, or capital); (2) reasoning MUST be ≤18 words; (3) be specific — cite the actual risk, not a category.
Format: {"label": "low"|"medium"|"high", "reasoning": "<concrete risk from pitch, ≤18 words>"}`,
        },
        {
          name: "Completeness",
          labels: ["complete", "partial", "insufficient"],
          fallback: "partial",
          systemPrompt: `You are a pitch completeness analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) list the specific missing elements by name (e.g. "no financials", "no team info", "no market size"); (2) reasoning MUST be ≤18 words; (3) "complete" requires market, model, traction, and team all present.
Format: {"label": "complete"|"partial"|"insufficient", "reasoning": "<specific missing fields or confirmation, ≤18 words>"}`,
        },
      ];

      // ── Run all 6 agents in parallel ──────────────────────────────────────
      type AgentResult = {
        name: AgentName;
        label: string;
        reasoning: string;
        fallback: boolean;
      };

      const agentOutputs: AgentResult[] = await Promise.all(
        AGENTS.map(async (agent) => {
          try {
            const res = await invokeLLM({
              messages: [
                { role: "system", content: agent.systemPrompt },
                { role: "user", content: `Pitch:\n${truncated}` },
              ],
              max_tokens: 120,
            });
            const contentRaw = res?.choices?.[0]?.message?.content;
            const raw = (typeof contentRaw === "string" ? contentRaw : "").trim();
            const cleaned = raw
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```$/i, "")
              .trim();
            const parsed = JSON.parse(cleaned) as { label?: unknown; reasoning?: unknown };
            const label =
              typeof parsed.label === "string" && agent.labels.includes(parsed.label)
                ? parsed.label
                : agent.fallback;
            const reasoning =
              typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
                ? parsed.reasoning.slice(0, 120)
                : "Unable to determine from available information.";
            const usedFallback = label === agent.fallback && parsed.label !== agent.fallback;
            return { name: agent.name, label, reasoning, fallback: usedFallback };
          } catch {
            return {
              name: agent.name,
              label: agent.fallback,
              reasoning: "Unable to determine from available information.",
              fallback: true,
            };
          }
        })
      );

      // ── Deterministic scoring ─────────────────────────────────────────────
      const WEIGHTS: Record<AgentName, number> = {
        "Market Signal": 20,
        "Business Model": 18,
        "Traction": 22,
        "Founder Signal": 20,
        "Risk": 15,
        "Completeness": 5,
      };
      const LABEL_SCORES: Record<string, number> = {
        // Market Signal
        strong: 100, weak: 40, unclear: 20,
        // Business Model
        clear: 100, missing: 0,
        // Traction
        early: 50, none: 0,
        // Founder Signal
        neutral: 50, risk: 0,
        // Risk (inverted — low is good)
        low: 100, medium: 50, high: 0,
        // Completeness
        complete: 100, partial: 50, insufficient: 0,
      };

      const byName = Object.fromEntries(
        agentOutputs.map((r) => [r.name, r])
      ) as Record<AgentName, AgentResult>;

      let rawScore = 0;
      for (const agent of AGENTS) {
        const labelScore = LABEL_SCORES[byName[agent.name].label] ?? 50;
        rawScore += (labelScore * WEIGHTS[agent.name]) / 100;
      }
      const score = Math.round(rawScore);

      // ── Classification ────────────────────────────────────────────────────
      const completenessLabel = byName["Completeness"].label;
      const riskLabel = byName["Risk"].label;
      const founderLabel = byName["Founder Signal"].label;

      // Confidence guardrail: insufficient completeness always → LOW confidence
      const confidence =
        completenessLabel === "complete" ? "HIGH" :
        completenessLabel === "partial" ? "MEDIUM" : "LOW";

      let classification: "ENGAGE" | "WATCH" | "IGNORE";
      if (completenessLabel === "insufficient" && score < 35) {
        classification = "IGNORE";
      } else if (score >= 62 && riskLabel !== "high" && founderLabel !== "risk") {
        // Guardrail: insufficient completeness downgrades ENGAGE → WATCH
        classification = confidence === "LOW" ? "WATCH" : "ENGAGE";
      } else if (score >= 38) {
        classification = "WATCH";
      } else {
        classification = "IGNORE";
      }

      const nextStep =
        classification === "ENGAGE" ? "Run full evaluation" :
        classification === "WATCH" ? "Request more information" : "No action";

      // ── Top 2 missing fields (for confidence guardrail warning) ──────────
      // These are the highest-weight agents with red-tier labels
      const redLabelsSet = new Set(["unclear", "missing", "none", "risk", "high", "insufficient"]);
      const topMissingFields: string[] = agentOutputs
        .filter((r) => redLabelsSet.has(r.label))
        .sort((a, b) => (WEIGHTS[b.name] ?? 0) - (WEIGHTS[a.name] ?? 0))
        .slice(0, 2)
        .map((r) => r.name);

      // ── Key signals (top 3 positive agents) ──────────────────────────────
      const positiveLabels = new Set(["strong", "clear", "low", "complete"]);
      const keySignals: string[] = agentOutputs
        .filter((r) => positiveLabels.has(r.label))
        .slice(0, 3)
        .map((r) => `${r.name}: ${r.reasoning}`);
      if (keySignals.length < 3) {
        for (const r of agentOutputs) {
          if (keySignals.length >= 3) break;
          const sig = `${r.name}: ${r.reasoning}`;
          if (!keySignals.includes(sig)) keySignals.push(sig);
        }
      }

      // ── Missing info (red-label agents) ──────────────────────────────────
      const redLabels = new Set(["unclear", "missing", "none", "risk", "high", "insufficient"]);
      const missingInfo: string[] = agentOutputs
        .filter((r) => redLabels.has(r.label))
        .map((r) => `${r.name}: ${r.reasoning}`);

      // ── Persist to history (fire-and-forget, never blocks response) ─────────────
      const pitchPreview = input.pitchText.slice(0, 200).trim();
      savePitchTriage({
        userId: ctx.user.id.toString(),
        pitchPreview,
        score,
        classification,
        confidence,
        agentOutputs: JSON.stringify(agentOutputs),
        keySignals: JSON.stringify(keySignals),
        missingInfo: JSON.stringify(missingInfo),
        topMissingFields: JSON.stringify(topMissingFields),
        nextStep,
        parentTriageId: input.parentTriageId ?? null,
      }).catch((err) => console.error("[PitchTriage] Failed to persist history:", err));

      return {
        score,
        classification,
        confidence,
        nextStep,
        agentOutputs,
        keySignals,
        missingInfo,
        topMissingFields,
      };
    }),

  /**
   * pitch.history — Returns the last 50 triage runs for the current user.
   */
  history: protectedProcedure.query(async ({ ctx }) => {
    const rows = await getPitchTriageHistory(ctx.user.id.toString(), 50);
    return rows;
  }),

  /**
   * pitch.historyItem — Returns a single triage record by id (ownership-checked).
   */
  historyItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const row = await getPitchTriageById(input.id, ctx.user.id.toString());
      if (!row) throw new Error("Triage record not found");
      return row;
    }),
});
