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
import { getDb, savePitchTriage, getPitchTriageHistory, getPitchTriageById, markPitchTriageEscalated, updateTriageStage, recordOutcome, getOutcomeHistory, createPitchMirrorShare, getPitchMirrorShare, insertDealSignal, markDealSignalProcessed, getDealSignals, getAutoTriggerLogCount, getSignalCountsForUser, getPreviousTriageForDeal, getSignalTypeSummary, getScoreHistory, getFullScoreHistory, getCommandCenterData } from "../db";
import { PitchTriage } from "../../drizzle/schema";
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

// ── Module-scope agent pipeline (shared by triage, checkAndTrigger, logSignal) ──

export type AgentName = "Market Signal" | "Business Model" | "Traction" | "Founder Signal" | "Risk" | "Completeness";

const MODULE_AGENTS: Array<{ name: AgentName; labels: string[]; fallback: string; systemPrompt: string }> = [
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

const MODULE_WEIGHTS: Record<AgentName, number> = {
  "Market Signal": 20, "Business Model": 18, "Traction": 22,
  "Founder Signal": 20, "Risk": 15, "Completeness": 5,
};

const MODULE_LABEL_SCORES: Record<string, number> = {
  strong: 100, weak: 40, unclear: 20,
  clear: 100, missing: 0,
  early: 50, none: 0,
  neutral: 50, risk: 0,
  low: 100, medium: 50, high: 0,
  complete: 100, partial: 50, insufficient: 0,
};

export type TriagePipelineResult = {
  score: number;
  classification: "ENGAGE" | "WATCH" | "IGNORE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  nextStep: string;
  agentOutputs: Array<{ name: AgentName; label: string; reasoning: string; fallback: boolean }>;
  keySignals: string[];
  missingInfo: string[];
  topMissingFields: string[];
};

export async function runTriagePipeline(pitchText: string): Promise<TriagePipelineResult> {
  const truncated = pitchText.slice(0, 3000);
  type AgentResult = { name: AgentName; label: string; reasoning: string; fallback: boolean };
  const agentOutputs: AgentResult[] = await Promise.all(
    MODULE_AGENTS.map(async (agent) => {
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
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned) as { label?: unknown; reasoning?: unknown };
        const label = typeof parsed.label === "string" && agent.labels.includes(parsed.label)
          ? parsed.label : agent.fallback;
        const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
          ? parsed.reasoning.slice(0, 120) : "Unable to determine from available information.";
        return { name: agent.name, label, reasoning, fallback: label === agent.fallback && parsed.label !== agent.fallback };
      } catch {
        return { name: agent.name, label: agent.fallback, reasoning: "Unable to determine.", fallback: true };
      }
    })
  );
  const byName = Object.fromEntries(agentOutputs.map((r) => [r.name, r])) as Record<AgentName, AgentResult>;
  let rawScore = 0;
  for (const agent of MODULE_AGENTS) {
    rawScore += ((MODULE_LABEL_SCORES[byName[agent.name].label] ?? 50) * MODULE_WEIGHTS[agent.name]) / 100;
  }
  const score = Math.round(rawScore);
  const completenessLabel = byName["Completeness"].label;
  const riskLabel = byName["Risk"].label;
  const founderLabel = byName["Founder Signal"].label;
  const confidence: "HIGH" | "MEDIUM" | "LOW" = completenessLabel === "complete" ? "HIGH" : completenessLabel === "partial" ? "MEDIUM" : "LOW";
  let classification: "ENGAGE" | "WATCH" | "IGNORE";
  if (completenessLabel === "insufficient" && score < 35) classification = "IGNORE";
  else if (score >= 62 && riskLabel !== "high" && founderLabel !== "risk") classification = confidence === "LOW" ? "WATCH" : "ENGAGE";
  else if (score >= 38) classification = "WATCH";
  else classification = "IGNORE";
  const nextStep = classification === "ENGAGE" ? "Run full evaluation" : classification === "WATCH" ? "Request more information" : "No action";
  const redLabels = new Set(["unclear", "missing", "none", "risk", "high", "insufficient"]);
  const positiveLabels = new Set(["strong", "clear", "low", "complete"]);
  const topMissingFields = agentOutputs.filter((r) => redLabels.has(r.label)).sort((a, b) => (MODULE_WEIGHTS[b.name] ?? 0) - (MODULE_WEIGHTS[a.name] ?? 0)).slice(0, 2).map((r) => r.name);
  const keySignals = agentOutputs.filter((r) => positiveLabels.has(r.label)).slice(0, 3).map((r) => `${r.name}: ${r.reasoning}`);
  if (keySignals.length < 3) {
    for (const r of agentOutputs) {
      if (keySignals.length >= 3) break;
      const sig = `${r.name}: ${r.reasoning}`;
      if (!keySignals.includes(sig)) keySignals.push(sig);
    }
  }
  const missingInfo = agentOutputs.filter((r) => redLabels.has(r.label)).map((r) => `${r.name}: ${r.reasoning}`);
  return { score, classification, confidence, nextStep, agentOutputs, keySignals, missingInfo, topMissingFields };
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

      // ── Persist to history (await so we can return the id for escalation tracking) ──
      const pitchPreview = input.pitchText.slice(0, 200).trim();
      const savedId = await savePitchTriage({
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
      }).catch((err) => { console.error("[PitchTriage] Failed to persist history:", err); return null; });

      return {
        id: savedId ?? undefined,
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
    const userId = ctx.user.id.toString();
    const rows = await getPitchTriageHistory(userId, 50);
    const signalCounts = await getSignalCountsForUser(userId);
    // Inject scoreHistory for rows with 3+ triages (same pitchPreview prefix)
    // Group rows by 40-char pitchPreview prefix to count triages per deal
    const prefixCounts: Record<string, number> = {};
    for (const r of rows) {
      const prefix = r.pitchPreview ? r.pitchPreview.slice(0, 40) : "";
      prefixCounts[prefix] = (prefixCounts[prefix] ?? 0) + 1;
    }
    // Fetch score history only for prefixes with 3+ triages (deduplicated)
    const prefixesNeedingHistory = Array.from(new Set(
      rows
        .filter((r) => (prefixCounts[r.pitchPreview ? r.pitchPreview.slice(0, 40) : ""] ?? 0) >= 3)
        .map((r) => r.pitchPreview ? r.pitchPreview.slice(0, 40) : "")
    ));
    const scoreHistoryMap: Record<string, number[]> = {};
    await Promise.all(
      prefixesNeedingHistory.map(async (prefix) => {
        scoreHistoryMap[prefix] = await getScoreHistory(userId, prefix, 5);
      })
    );
    return rows.map((r) => {
      const prefix = r.pitchPreview ? r.pitchPreview.slice(0, 40) : "";
      const scoreHistory = scoreHistoryMap[prefix] ?? [];
      return { ...r, signalCount: signalCounts[String(r.id)] ?? 0, scoreHistory };
    });
  }),

  /**
   * pitch.historyItem — Returns a single triage record by id (ownership-checked).
   */
  historyItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id.toString();
      const row = await getPitchTriageById(input.id, userId);
      if (!row) throw new Error("Triage record not found");
      // Compute prevScore for score-diff display on signal-triggered rows
      let prevScore: number | null = null;
      const tt = (row as unknown as { triggerType?: string }).triggerType;
      if (tt === "signal_triggered" || tt === "external_signal") {
        const prefix = row.pitchPreview ? row.pitchPreview.slice(0, 40) : "";
        const prev = await getPreviousTriageForDeal(userId, prefix, row.createdAt);
        prevScore = prev?.score ?? null;
      }
      return { ...row, prevScore };
    }),

  /**
   * pitch.markEscalated — Marks a triage record as escalated to Deal Screener.
   * Called from PitchTriage.tsx handleEscalate when the analyst clicks "Escalate".
   */
  markEscalated: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const ok = await markPitchTriageEscalated(input.id, ctx.user.id.toString());
      return { ok };
    }),

  /**
   * pitch.updateStage — Updates the pipeline stage of a triage record.
   * Ownership-checked. Valid stages: triaged | diligence | ic_ready | decision_made | archived.
   */
  updateStage: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        stage: z.enum(["triaged", "diligence", "ic_ready", "decision_made", "archived"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ok = await updateTriageStage(input.id, ctx.user.id.toString(), input.stage);
      return { ok };
    }),

  /**
   * pitch.mirror — PitchMirror founder-facing feedback.
   * Reuses the 6 triage agents, then transforms IC output into 3 plain-language sections.
   * Tracks usage (pitchMirrorRuns) and gates after PITCH_MIRROR_FREE_RUNS.
   */
  /**
   * pitch.createShare — Authenticated: saves mirror result JSON, returns shareToken.
   */
  createShare: protectedProcedure
    .input(z.object({
      sections: z.object({
        whatInvestorsSee: z.object({
          strengths: z.array(z.string()),
          concerns: z.array(z.string()),
        }),
        whatToFix: z.array(z.string()),
        whatsMissing: z.array(z.string()),
      }),
      founderStage: z.enum(["idea", "building", "early_revenue", "scaling", "portfolio"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const json = JSON.stringify(input.sections);
      const shareToken = await createPitchMirrorShare(json, input.founderStage ?? null);
      if (!shareToken) throw new Error("Failed to create share");
      return { shareToken };
    }),

  /**
   * pitch.createGuestShare — Public (no auth): persists mirror result anonymously, returns shareToken.
   * Identical payload to createShare but uses publicProcedure so guests can share without signing up.
   * The pitch_mirror_shares table has no userId column, so all shares are inherently anonymous.
   */
  createGuestShare: publicProcedure
    .input(z.object({
      sections: z.object({
        whatInvestorsSee: z.object({
          strengths: z.array(z.string()),
          concerns: z.array(z.string()),
        }),
        whatToFix: z.array(z.string()),
        whatsMissing: z.array(z.string()),
      }),
      founderStage: z.enum(["idea", "building", "early_revenue", "scaling", "portfolio"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const json = JSON.stringify(input.sections);
      const shareToken = await createPitchMirrorShare(json, input.founderStage ?? null);
      if (!shareToken) throw new Error("Failed to create guest share");
      return { shareToken };
    }),

  /**
   * pitch.getShare — Public: returns mirror result by shareToken (no user data).
   */
  getShare: publicProcedure
    .input(z.object({ shareToken: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const row = await getPitchMirrorShare(input.shareToken);
      if (!row) return null;
      try {
        const sections = JSON.parse(row.mirrorResultJson);
        const STAGE_LABELS: Record<string, string> = {
          idea: "Exploring idea",
          building: "Building (no revenue)",
          early_revenue: "Early revenue",
          scaling: "Scaling",
          portfolio: "Portfolio company review",
        };
        const founderStage = row.founderStage ?? null;
        const founderStageLabel = founderStage ? (STAGE_LABELS[founderStage] ?? null) : null;
        return {
          sections,
          createdAt: row.createdAt,
          founderStage,
          founderStageLabel,
        };
      } catch {
        return null;
      }
    }),

  mirror: publicProcedure
    .input(
      z.object({
        pitchText: z.string().min(30, "Pitch must be at least 30 characters").max(3000, "Pitch must be under 3000 characters"),
        founderStage: z.enum(["idea", "building", "early_revenue", "scaling", "portfolio"]).optional().default("building"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const stage = input.founderStage ?? "building";
      const PITCH_MIRROR_FREE_RUNS = 2;
      const isAuthenticated = !!(ctx as { user?: { id: number; pitchMirrorRuns?: number } }).user;
      const authedUser = isAuthenticated ? (ctx as { user: { id: number; pitchMirrorRuns?: number } }).user : null;

      // ── Usage gate (authenticated users only) ─────────────────────────────
      const currentRuns: number = authedUser?.pitchMirrorRuns ?? 0;
      const isGated = isAuthenticated && currentRuns >= PITCH_MIRROR_FREE_RUNS;

      // ── Run the 6 triage agents (same as pitch.triage) ────────────────────
      const truncated = input.pitchText.slice(0, 1500);

      type AgentName = "Market Signal" | "Business Model" | "Traction" | "Founder Signal" | "Risk" | "Completeness";
      const AGENTS: Array<{ name: AgentName; labels: string[]; fallback: string; systemPrompt: string }> = [
        {
          name: "Market Signal",
          labels: ["strong", "weak", "unclear"],
          fallback: "unclear",
          systemPrompt: `You are a market analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite the specific market size, geography, or sector mentioned in the pitch; (2) reasoning MUST be ≤18 words; (3) if no market data is present, label="unclear" and note the absence.
Format: {"label": "strong"|"weak"|"unclear", "reasoning": "<concrete market signal from pitch, ≤18 words>"}`,
        },
        {
          name: "Business Model",
          labels: ["clear", "partial", "missing"],
          fallback: "partial",
          systemPrompt: `You are a business model analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) name the specific revenue mechanism stated in the pitch (subscription, transaction fee, licensing, etc.); (2) reasoning MUST be ≤18 words; (3) if no revenue model is described, label="missing".
Format: {"label": "clear"|"partial"|"missing", "reasoning": "<specific revenue model or absence, ≤18 words>"}`,
        },
        {
          name: "Traction",
          labels: ["strong", "early", "none"],
          fallback: "none",
          systemPrompt: `You are a traction analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite the specific metric, customer count, or revenue figure stated in the pitch; (2) reasoning MUST be ≤18 words; (3) if no traction data is present, label="none" and state that explicitly.
Format: {"label": "strong"|"early"|"none", "reasoning": "<specific traction metric or absence, ≤18 words>"}`,
        },
        {
          name: "Founder Signal",
          labels: ["strong", "neutral", "risk"],
          fallback: "neutral",
          systemPrompt: `You are a founder due-diligence analyst. Evaluate the pitch and return ONLY valid JSON.
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

      type AgentResult = { name: AgentName; label: string; reasoning: string; fallback: boolean };
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
            const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
            const parsed = JSON.parse(cleaned) as { label?: unknown; reasoning?: unknown };
            const label = typeof parsed.label === "string" && agent.labels.includes(parsed.label) ? parsed.label : agent.fallback;
            const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.length > 0 ? parsed.reasoning.slice(0, 120) : "Unable to determine from available information.";
            return { name: agent.name, label, reasoning, fallback: label === agent.fallback && parsed.label !== agent.fallback };
          } catch {
            return { name: agent.name, label: agent.fallback, reasoning: "Unable to determine from available information.", fallback: true };
          }
        })
      );

      const byName = Object.fromEntries(agentOutputs.map((r) => [r.name, r])) as Record<AgentName, AgentResult>;

      // ── Transformation layer: IC output → PitchMirror 3 sections ─────────
      //
      // SECTION 1: What Investors See
      //   Strengths = agents with positive labels (strong/clear/low/complete)
      //   Concerns  = agents with negative labels (weak/unclear/missing/none/risk/high/insufficient)
      //
      const POSITIVE_LABELS = new Set(["strong", "clear", "low", "complete"]);
      const NEGATIVE_LABELS = new Set(["weak", "unclear", "missing", "none", "risk", "high", "insufficient"]);

      const FRIENDLY_NAMES: Record<AgentName, string> = {
        "Market Signal": "market opportunity",
        "Business Model": "business model",
        "Traction": "traction",
        "Founder Signal": "founding team",
        "Risk": "risk profile",
        "Completeness": "pitch completeness",
      };

      const STRENGTH_PHRASES: Record<string, Record<string, string>> = {
        "Market Signal": { strong: "The market opportunity comes across as credible and well-defined." },
        "Business Model": { clear: "The revenue model is clearly articulated and easy to follow." },
        "Traction": { strong: "The traction data is compelling and shows real momentum.", early: "Early traction signals suggest the idea is being validated." },
        "Founder Signal": { strong: "The founding team’s background is relevant and credible." },
        "Risk": { low: "The risk profile appears manageable at this stage." },
        "Completeness": { complete: "The pitch covers all key areas investors typically look for." },
      };

      const CONCERN_PHRASES: Record<string, Record<string, string>> = {
        "Market Signal": {
          weak: "Investors may question the size or defensibility of the market.",
          unclear: "The market opportunity is not fully visible yet — more specifics would help.",
        },
        "Business Model": {
          partial: "This could be clearer — investors will want to understand exactly how revenue is generated.",
          missing: "Investors may question how the business makes money — the revenue model is not stated.",
        },
        "Traction": {
          early: "Investors may want to see more concrete traction before committing.",
          none: "The absence of traction data is likely to raise questions about validation.",
        },
        "Founder Signal": {
          neutral: "Investors may question whether the team has the right background for this problem.",
          risk: "There are signals in the pitch that investors may flag as founder-related concerns.",
        },
        "Risk": {
          medium: "Investors may question how key risks will be managed as the business scales.",
          high: "There is a significant risk factor that investors are likely to probe in detail.",
        },
        "Completeness": {
          partial: "Some important areas are not fully addressed — investors will likely ask follow-up questions.",
          insufficient: "The pitch is missing several key elements that investors typically require.",
        },
      };

      const strengths: string[] = [];
      const concerns: string[] = [];

      for (const agent of AGENTS) {
        const r = byName[agent.name];
        if (POSITIVE_LABELS.has(r.label)) {
          const phrase = STRENGTH_PHRASES[agent.name]?.[r.label];
          if (phrase && strengths.length < 3) strengths.push(phrase);
        } else if (NEGATIVE_LABELS.has(r.label)) {
          const phrase = CONCERN_PHRASES[agent.name]?.[r.label];
          if (phrase && concerns.length < 3) concerns.push(phrase);
        }
      }
      // Ensure at least 1 strength and 1 concern
      if (strengths.length === 0) strengths.push("The core idea is clear enough to evaluate.");
      if (concerns.length === 0) concerns.push("Investors may want more detail to make a confident assessment.");

      // ── Stage-specific wording overrides ────────────────────────────────
      // Traction concern overrides by stage
      const TRACTION_CONCERN_BY_STAGE: Record<string, Record<string, string>> = {
        idea: {
          early: "Clarify who this is for, why they care, and what early signals suggest demand.",
          none: "Clarify who this is for, why they care, and what early signals suggest demand.",
        },
        building: {
          early: "Add early validation signals such as pilot interest, waitlist activity, user interviews, or early usage.",
          none: "Add early validation signals such as pilot interest, waitlist activity, user interviews, or early usage.",
        },
        early_revenue: {
          early: "Add revenue, growth, usage, and retention signals to show momentum.",
          none: "Add revenue, growth, usage, and retention signals to show momentum.",
        },
        scaling: {
          early: "Add ARR, growth rate, retention, and cohort evidence to support the case.",
          none: "Add ARR, growth rate, retention, and cohort evidence to support the case.",
        },
        portfolio: {
          early: "Summarise performance against targets: revenue, growth, and key KPIs since last review.",
          none: "Include current performance data: revenue, headcount, key milestones, and any risks flagged since last review.",
        },
      };

      // Business model concern overrides by stage
      const BM_CONCERN_BY_STAGE: Record<string, Record<string, string>> = {
        idea: {
          partial: "The revenue model is still unresolved — that's expected at this stage, but worth sketching out.",
          missing: "The revenue model is unresolved — that's acceptable at the idea stage, but investors will ask about it.",
        },
        building: {
          partial: "This could be clearer — investors will want to understand exactly how revenue is generated.",
          missing: "Investors may question how the business makes money — the revenue model is not stated.",
        },
        early_revenue: {
          partial: "At this stage, investors expect a clear and validated revenue model — clarify your primary stream.",
          missing: "A missing revenue model is a major concern at the early revenue stage — add it explicitly.",
        },
        scaling: {
          partial: "At scale, investors expect a fully defined model with unit economics — this needs to be explicit.",
          missing: "A missing revenue model is a critical gap at the scaling stage — this must be addressed.",
        },
        portfolio: {
          partial: "Clarify the current revenue model and whether it has evolved since the original investment thesis.",
          missing: "Include a clear description of how the company currently generates revenue and its unit economics.",
        },
      };

      // Fix prefix by stage
      const FIX_PREFIX: Record<string, string> = {
        idea: "To validate your idea, add",
        building: "To show investor readiness, add",
        early_revenue: "To demonstrate traction, add",
        scaling: "To meet investor expectations, add",
        portfolio: "To strengthen your portfolio review, add",
      };
      const fixPrefix = FIX_PREFIX[stage] ?? FIX_PREFIX.building;

      // Apply stage overrides to concern phrases
      const tractionConcernOverride = TRACTION_CONCERN_BY_STAGE[stage];
      const bmConcernOverride = BM_CONCERN_BY_STAGE[stage];
      if (tractionConcernOverride) {
        if (tractionConcernOverride.early) CONCERN_PHRASES["Traction"].early = tractionConcernOverride.early;
        if (tractionConcernOverride.none) CONCERN_PHRASES["Traction"].none = tractionConcernOverride.none;
      }
      if (bmConcernOverride) {
        if (bmConcernOverride.partial) CONCERN_PHRASES["Business Model"].partial = bmConcernOverride.partial;
        if (bmConcernOverride.missing) CONCERN_PHRASES["Business Model"].missing = bmConcernOverride.missing;
      }

      // SECTION 2: What to Fix Before Sending
      //   Map negative agents to specific, actionable improvements
      const FIX_MAP: Record<string, Record<string, string>> = {
        "Market Signal": {
          weak: "Add a specific market size figure (e.g. \"$2B GCC fintech market\") and name 1–2 direct competitors to show you understand the landscape.",
          unclear: "State the total addressable market with a number, the geography you’re targeting, and why now is the right time.",
        },
        "Business Model": {
          partial: "Clarify your primary revenue stream: is it subscription, transaction fee, or licensing? Add a rough price point or unit economics.",
          missing: "Add a dedicated revenue model section: how do you charge, who pays, and what does a single customer relationship look like financially?",
        },
        "Traction": {
          early: "Quantify your traction: number of users, revenue, pilots, or letters of intent. Even small numbers are better than none.",
          none: "Include at least one proof point — a pilot customer, an LOI, waitlist signups, or a completed prototype with user feedback.",
        },
        "Founder Signal": {
          neutral: "Add a 2–3 line team section: name each founder, their relevant background, and why this team is uniquely positioned to solve this problem.",
          risk: "Address the concern directly: if there is a gap in the team, explain how you plan to fill it or who your advisors are.",
        },
        "Risk": {
          medium: "Acknowledge the main risk and explain your mitigation plan in 1–2 sentences. Investors respect founders who have thought this through.",
          high: "The pitch needs a clear risk section: name the primary risk, why it exists, and what you are doing to reduce it.",
        },
        "Completeness": {
          partial: "Review your pitch against this checklist: market size, revenue model, traction, team, and ask (how much are you raising and for what).",
          insufficient: "The pitch is missing too many key sections. Use a standard structure: problem, solution, market, model, traction, team, ask.",
        },
      };

      const fixes: string[] = [];
      for (const agent of AGENTS) {
        const r = byName[agent.name];
        if (NEGATIVE_LABELS.has(r.label)) {
          const fix = FIX_MAP[agent.name]?.[r.label];
          if (fix && fixes.length < 5) {
            // Prepend stage-specific prefix to fix items
            const prefixed = fix.replace(/^(Add|Clarify|Include|Review|Address|Acknowledge|The pitch)/i, (m) => `${fixPrefix} ${m.charAt(0).toLowerCase()}${m.slice(1)}`);
            fixes.push(prefixed !== fix ? prefixed : `${fixPrefix} ${fix.charAt(0).toLowerCase()}${fix.slice(1)}`);
          }
        }
      }
      if (fixes.length === 0) fixes.push("Your pitch covers the key areas well. Consider tightening the language and adding a clear ask.");

      // SECTION 3: What’s Missing
      //   Derived from INSUFFICIENT DATA or low-confidence agents
      const MISSING_MAP: Record<AgentName, string> = {
        "Market Signal": "Market size and competitive landscape",
        "Business Model": "Revenue model and unit economics",
        "Traction": "Traction data (users, revenue, pilots)",
        "Founder Signal": "Team background and credentials",
        "Risk": "Risk acknowledgement and mitigation plan",
        "Completeness": "Key pitch sections (problem, solution, ask)",
      };

      const missingItems: string[] = agentOutputs
        .filter((r) => NEGATIVE_LABELS.has(r.label))
        .map((r) => MISSING_MAP[r.name])
        .filter(Boolean)
        .slice(0, 5);

      if (missingItems.length === 0) missingItems.push("No critical gaps detected — the pitch covers the main areas.");

      // ── Increment pitchMirrorRuns (authenticated users only, fire-and-forget) ─
      if (isAuthenticated && authedUser) {
        const db = await getDb();
        if (db) {
          db.execute(sql`UPDATE users SET pitchMirrorRuns = pitchMirrorRuns + 1 WHERE id = ${authedUser.id}`)
            .catch((err: unknown) => console.error("[PitchMirror] Failed to increment runs:", err));
        }
      }

      const STAGE_LABELS: Record<string, string> = {
        idea: "Exploring idea",
        building: "Building (no revenue)",
        early_revenue: "Early revenue",
        scaling: "Scaling",
        portfolio: "Portfolio company review",
      };

      return {
        gated: isGated,
        runsUsed: isAuthenticated ? currentRuns + 1 : 1,
        freeRunsAllowed: PITCH_MIRROR_FREE_RUNS,
        founderStage: stage,
        founderStageLabel: STAGE_LABELS[stage] ?? "Building (no revenue)",
        sections: {
          whatInvestorsSee: { strengths, concerns },
          whatToFix: fixes,
          whatsMissing: missingItems,
        },
      };
    }),

  /**
   * pitch.recordOutcome — Record the real investment decision outcome for a triage record.
   * Ownership-checked. Valid outcomes: 'invested' | 'passed'.
   * This feeds into agentCalibration as the ground-truth signal.
   */
  recordOutcome: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      outcome: z.enum(["invested", "passed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const ok = await recordOutcome(input.id, ctx.user.id.toString(), input.outcome);
      if (!ok) throw new Error("Failed to record outcome");
      return { success: true, outcome: input.outcome };
    }),

  /**
   * pitch.agentCalibration — Outcome-grounded calibration signal for each triage agent.
   * Priority: uses decision_outcome (invested/passed) when available.
   * Fallback: uses stage progression (diligence/ic_ready/decision_made) when outcome is null.
   * Returns: { agentName, signal: 'high' | 'moderate' | 'low' | 'insufficient', sampleSize, outcomeGrounded }
   */
  patternInsight: protectedProcedure
    .input(
      z.object({
        // Current deal's agent outputs as JSON string
        currentAgentOutputs: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch last 20 triage records that have a real outcome
      const rows = await getOutcomeHistory(ctx.user.id.toString(), 20) as PitchTriage[];
      if (!rows) return { type: "none" as const, signals: [] as string[], phrase: "" };

      if (rows.length < 3) return { type: "none" as const, signals: [] as string[], phrase: "" };

      const POSITIVE_LABELS = new Set(["strong", "clear", "low", "complete"]);
      const AGENT_NAMES = ["Traction", "Market Signal", "Founder Signal", "Business Model", "Risk"] as const;
      type AgentName = typeof AGENT_NAMES[number];

      // Signal → readable phrase mapping
      const SIGNAL_PHRASES: Record<AgentName, { positive: string; negative: string }> = {
        "Traction": { positive: "strong traction", negative: "weak traction" },
        "Market Signal": { positive: "strong market signal", negative: "weak market signal" },
        "Founder Signal": { positive: "strong founder signal", negative: "weak founder signal" },
        "Business Model": { positive: "clear revenue model", negative: "unclear revenue model" },
        "Risk": { positive: "manageable risk", negative: "high risk" },
      };

      // Compute dominant positive signals per outcome group
      const investedSignalCounts: Record<AgentName, number> = {} as Record<AgentName, number>;
      const passedSignalCounts: Record<AgentName, number> = {} as Record<AgentName, number>;
      let investedCount = 0;
      let passedCount = 0;

      for (const row of rows) {
        if (!row.agentOutputs) continue;
        let agents: Array<{ name: string; label: string }> = [];
        try { agents = JSON.parse(row.agentOutputs); } catch { continue; }

        const isInvested = row.decisionOutcome === "invested";
        const isPassed = row.decisionOutcome === "passed";
        if (isInvested) investedCount++;
        if (isPassed) passedCount++;

        for (const agent of agents) {
          const name = agent.name as AgentName;
          if (!AGENT_NAMES.includes(name)) continue;
          if (POSITIVE_LABELS.has(agent.label)) {
            if (isInvested) investedSignalCounts[name] = (investedSignalCounts[name] ?? 0) + 1;
          } else {
            // Negative label on a passed deal = dominant passed signal
            if (isPassed) passedSignalCounts[name] = (passedSignalCounts[name] ?? 0) + 1;
          }
        }
      }

      // Require at least 5 records in the matched group (confidence gating)
      const MIN_GROUP = 5;

      // Parse current deal's agent outputs
      let currentAgents: Array<{ name: string; label: string }> = [];
      try { currentAgents = JSON.parse(input.currentAgentOutputs); } catch { /* ignore */ }

      const currentPositive = new Set(
        currentAgents
          .filter(a => POSITIVE_LABELS.has(a.label) && AGENT_NAMES.includes(a.name as AgentName))
          .map(a => a.name as AgentName)
      );
      const currentNegative = new Set(
        currentAgents
          .filter(a => !POSITIVE_LABELS.has(a.label) && AGENT_NAMES.includes(a.name as AgentName))
          .map(a => a.name as AgentName)
      );

      // Find top 2 dominant signals for each group (must appear in ≥50% of that group)
      const topInvestedSignals = (Object.entries(investedSignalCounts) as [AgentName, number][])
        .filter(([, count]) => investedCount >= MIN_GROUP && count / investedCount >= 0.5)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([name]) => name);

      const topPassedSignals = (Object.entries(passedSignalCounts) as [AgentName, number][])
        .filter(([, count]) => passedCount >= MIN_GROUP && count / passedCount >= 0.5)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([name]) => name);

      // Match current deal against patterns
      // Confidence gating: require ≥2 dominant signals to match (not just 1)
      const MIN_MATCH_SIGNALS = 2;

      // Invested match: current deal has positive votes on the top invested signals
      const investedMatchCount = topInvestedSignals.filter(name => currentPositive.has(name)).length;
      // Passed match: current deal has negative votes on the top passed signals
      const passedMatchCount = topPassedSignals.filter(name => currentNegative.has(name)).length;

      const investedMatch = topInvestedSignals.length >= MIN_MATCH_SIGNALS &&
        investedMatchCount >= MIN_MATCH_SIGNALS;
      const passedMatch = topPassedSignals.length >= MIN_MATCH_SIGNALS &&
        passedMatchCount >= MIN_MATCH_SIGNALS;

      // Mixed signal: current deal matches both patterns simultaneously
      if (investedMatch && passedMatch) {
        // Combine signals from both groups for the explanation
        const allSignals = Array.from(new Set([...topInvestedSignals, ...topPassedSignals]));
        return {
          type: "mixed_signal" as const,
          signals: allSignals,
          phrase: "Mixed signals — this deal shares traits with both invested and passed deals",
        };
      }

      if (investedMatch) {
        const phrases = topInvestedSignals.map(n => SIGNAL_PHRASES[n].positive);
        return {
          type: "invested_match" as const,
          signals: topInvestedSignals,
          phrase: `This deal matches your past invested pattern (${phrases.join(" + ")})`,
        };
      }

      if (passedMatch) {
        const phrases = topPassedSignals.map(n => SIGNAL_PHRASES[n].negative);
        return {
          type: "passed_match" as const,
          signals: topPassedSignals,
          phrase: `Caution: similar deals with ${phrases.join(" + ")} were passed`,
        };
      }

      return { type: "none" as const, signals: [] as string[], phrase: "" };
    }),

  agentCalibration: protectedProcedure.query(async ({ ctx }) => {
    const rows = await getPitchTriageHistory(ctx.user.id.toString(), 50) as PitchTriage[];

    const POSITIVE_LABELS = new Set(["strong", "clear", "low", "complete"]);
    const PROGRESSED_STAGES = new Set(["diligence", "ic_ready", "decision_made"]);
    const AGENT_NAMES = ["Traction", "Market Signal", "Founder Signal", "Business Model", "Risk"] as const;

    type AgentName = typeof AGENT_NAMES[number];
    type SignalLevel = "high" | "moderate" | "low" | "insufficient";

    const stats: Record<AgentName, { positiveVotes: number; alignedWithProgress: number; outcomeVotes: number; outcomeAligned: number }> = {
      "Traction": { positiveVotes: 0, alignedWithProgress: 0, outcomeVotes: 0, outcomeAligned: 0 },
      "Market Signal": { positiveVotes: 0, alignedWithProgress: 0, outcomeVotes: 0, outcomeAligned: 0 },
      "Founder Signal": { positiveVotes: 0, alignedWithProgress: 0, outcomeVotes: 0, outcomeAligned: 0 },
      "Business Model": { positiveVotes: 0, alignedWithProgress: 0, outcomeVotes: 0, outcomeAligned: 0 },
      "Risk": { positiveVotes: 0, alignedWithProgress: 0, outcomeVotes: 0, outcomeAligned: 0 },
    };

    for (const row of rows) {
      if (!row.agentOutputs) continue;
      let agents: Array<{ name: string; label: string }> = [];
      try { agents = JSON.parse(row.agentOutputs); } catch { continue; }

      const hasRealOutcome = row.decisionOutcome === "invested" || row.decisionOutcome === "passed";
      const investedByOutcome = row.decisionOutcome === "invested";
      const progressedByStage = PROGRESSED_STAGES.has(row.stage ?? "");

      for (const agent of agents) {
        const name = agent.name as AgentName;
        if (!AGENT_NAMES.includes(name)) continue;
        if (POSITIVE_LABELS.has(agent.label)) {
          if (hasRealOutcome) {
            // Ground truth path: use real outcome
            stats[name].outcomeVotes++;
            if (investedByOutcome) stats[name].outcomeAligned++;
          } else {
            // Fallback path: use stage progression
            stats[name].positiveVotes++;
            if (progressedByStage) stats[name].alignedWithProgress++;
          }
        }
      }
    }

    const MIN_SAMPLES = 5;
    const HIGH_THRESHOLD = 0.60;
    const MODERATE_THRESHOLD = 0.35;

    return AGENT_NAMES.map((name) => {
      const s = stats[name];
      // Prefer outcome-grounded calibration when enough real outcomes exist
      const useOutcome = s.outcomeVotes >= MIN_SAMPLES;
      const votes = useOutcome ? s.outcomeVotes : s.positiveVotes;
      const aligned = useOutcome ? s.outcomeAligned : s.alignedWithProgress;
      const sampleSize = votes;

      let signal: SignalLevel = "insufficient";
      if (sampleSize >= MIN_SAMPLES) {
        const rate = aligned / sampleSize;
        if (rate >= HIGH_THRESHOLD) signal = "high";
        else if (rate >= MODERATE_THRESHOLD) signal = "moderate";
        else signal = "low";
      }
      return { agentName: name, signal, sampleSize, outcomeGrounded: useOutcome };
    });
  }),

  /**
   * pitch.checkAndTrigger — Auto re-triage engine.
   * Scans the user's deals for trigger conditions and creates new triage records
   * for each triggered deal (max 1 auto re-triage per deal per 24 hours).
   *
   * Trigger types:
   *   stale_diligence  — deal in diligence 30+ days, no outcome
   *   stale_ic_ready   — deal in ic_ready 30+ days, no outcome
   *   score_drop       — a newer triage of same deal scored 10+ points lower
   *   pattern_shift    — a similar deal's outcome conflicts with current signal
   *
   * Optional input: dealId (number) — if provided, only check that specific deal.
   */
  checkAndTrigger: protectedProcedure
    .input(
      z.object({
        dealId: z.number().int().positive().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id.toString();

      // Fetch all triage records for the user (up to 200 for pattern analysis)
      const allRows = await getPitchTriageHistory(userId, 200) as PitchTriage[];
      if (!allRows || allRows.length === 0) {
        return { triggered: 0, skipped: 0, deals: [] as string[] };
      }

      // If a specific dealId is provided, restrict to that deal only
      const targetRows = input?.dealId
        ? allRows.filter((r) => r.id === input.dealId)
        : allRows;

      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      const SCORE_DROP_THRESHOLD = 10;
      const now = Date.now();

      // Build a map of parentTriageId → latest child (for score_drop detection)
      // and a map of id → latest auto re-triage createdAt (for 24h cooldown)
      const latestAutoByParent = new Map<number, Date>();
      for (const r of allRows) {
        if (r.source === "auto" && r.parentTriageId) {
          const existing = latestAutoByParent.get(r.parentTriageId);
          if (!existing || new Date(r.createdAt) > existing) {
            latestAutoByParent.set(r.parentTriageId, new Date(r.createdAt));
          }
        }
      }

      // Build outcome history for pattern_shift detection
      // A pattern_shift occurs when: current deal matches invested pattern but a
      // similar-stage deal was recently marked as passed (or vice versa).
      const recentOutcomes = allRows.filter(
        (r) => (r.decisionOutcome === "invested" || r.decisionOutcome === "passed") &&
          now - new Date(r.createdAt).getTime() <= 30 * THIRTY_DAYS_MS // 90 days
      );
      const recentPassedCount = recentOutcomes.filter((r) => r.decisionOutcome === "passed").length;
      const recentInvestedCount = recentOutcomes.filter((r) => r.decisionOutcome === "invested").length;

      type TriggerType = "stale_diligence" | "stale_ic_ready" | "score_drop" | "pattern_shift";

      const triggered: string[] = [];
      let skipped = 0;

      // Agent pipeline helper — reuses the same 6-agent logic as pitch.triage
      type AgentName = "Market Signal" | "Business Model" | "Traction" | "Founder Signal" | "Risk" | "Completeness";
      const AGENTS: Array<{ name: AgentName; labels: string[]; fallback: string; systemPrompt: string }> = [
        {
          name: "Market Signal",
          labels: ["strong", "weak", "unclear"],
          fallback: "weak",
          systemPrompt: `You are a market signal analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite a specific fact from the pitch text; (2) reasoning MUST be ≤18 words; (3) NEVER use generic phrases.
Format: {"label": "strong"|"weak"|"unclear", "reasoning": "<concrete signal, ≤18 words>"}`,
        },
        {
          name: "Business Model",
          labels: ["clear", "weak", "missing"],
          fallback: "weak",
          systemPrompt: `You are a business model analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite the specific revenue mechanism; (2) reasoning MUST be ≤18 words.
Format: {"label": "clear"|"weak"|"missing", "reasoning": "<concrete signal, ≤18 words>"}`,
        },
        {
          name: "Traction",
          labels: ["strong", "early", "none"],
          fallback: "early",
          systemPrompt: `You are a traction analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) quote a specific metric; (2) reasoning MUST be ≤18 words.
Format: {"label": "strong"|"early"|"none", "reasoning": "<concrete signal, ≤18 words>"}`,
        },
        {
          name: "Founder Signal",
          labels: ["strong", "neutral", "risk"],
          fallback: "neutral",
          systemPrompt: `You are a founder signal analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) reference a specific credential or red flag; (2) reasoning MUST be ≤18 words.
Format: {"label": "strong"|"neutral"|"risk", "reasoning": "<concrete signal, ≤18 words>"}`,
        },
        {
          name: "Risk",
          labels: ["low", "medium", "high"],
          fallback: "medium",
          systemPrompt: `You are a risk analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) name the single most significant risk; (2) reasoning MUST be ≤18 words.
Format: {"label": "low"|"medium"|"high", "reasoning": "<concrete risk, ≤18 words>"}`,
        },
        {
          name: "Completeness",
          labels: ["complete", "partial", "insufficient"],
          fallback: "partial",
          systemPrompt: `You are a pitch completeness analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) list specific missing elements; (2) reasoning MUST be ≤18 words.
Format: {"label": "complete"|"partial"|"insufficient", "reasoning": "<specific missing fields, ≤18 words>"}`,
        },
      ];

      const WEIGHTS: Record<AgentName, number> = {
        "Market Signal": 20, "Business Model": 18, "Traction": 22,
        "Founder Signal": 20, "Risk": 15, "Completeness": 5,
      };
      const LABEL_SCORES: Record<string, number> = {
        strong: 100, weak: 40, unclear: 20,
        clear: 100, missing: 0,
        early: 50, none: 0,
        neutral: 50, risk: 0,
        low: 100, medium: 50, high: 0,
        complete: 100, partial: 50, insufficient: 0,
      };

      async function runTriagePipeline(pitchText: string): Promise<{
        score: number;
        classification: "ENGAGE" | "WATCH" | "IGNORE";
        confidence: "HIGH" | "MEDIUM" | "LOW";
        nextStep: string;
        agentOutputs: Array<{ name: AgentName; label: string; reasoning: string; fallback: boolean }>;
        keySignals: string[];
        missingInfo: string[];
        topMissingFields: string[];
      }> {
        const truncated = pitchText.slice(0, 3000);
        type AgentResult = { name: AgentName; label: string; reasoning: string; fallback: boolean };
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
              const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
              const parsed = JSON.parse(cleaned) as { label?: unknown; reasoning?: unknown };
              const label = typeof parsed.label === "string" && agent.labels.includes(parsed.label)
                ? parsed.label : agent.fallback;
              const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
                ? parsed.reasoning.slice(0, 120) : "Unable to determine from available information.";
              return { name: agent.name, label, reasoning, fallback: label === agent.fallback && parsed.label !== agent.fallback };
            } catch {
              return { name: agent.name, label: agent.fallback, reasoning: "Unable to determine.", fallback: true };
            }
          })
        );
        const byName = Object.fromEntries(agentOutputs.map((r) => [r.name, r])) as Record<AgentName, AgentResult>;
        let rawScore = 0;
        for (const agent of AGENTS) {
          rawScore += ((LABEL_SCORES[byName[agent.name].label] ?? 50) * WEIGHTS[agent.name]) / 100;
        }
        const score = Math.round(rawScore);
        const completenessLabel = byName["Completeness"].label;
        const riskLabel = byName["Risk"].label;
        const founderLabel = byName["Founder Signal"].label;
        const confidence: "HIGH" | "MEDIUM" | "LOW" = completenessLabel === "complete" ? "HIGH" : completenessLabel === "partial" ? "MEDIUM" : "LOW";
        let classification: "ENGAGE" | "WATCH" | "IGNORE";
        if (completenessLabel === "insufficient" && score < 35) classification = "IGNORE";
        else if (score >= 62 && riskLabel !== "high" && founderLabel !== "risk") classification = confidence === "LOW" ? "WATCH" : "ENGAGE";
        else if (score >= 38) classification = "WATCH";
        else classification = "IGNORE";
        const nextStep = classification === "ENGAGE" ? "Run full evaluation" : classification === "WATCH" ? "Request more information" : "No action";
        const redLabels = new Set(["unclear", "missing", "none", "risk", "high", "insufficient"]);
        const positiveLabels = new Set(["strong", "clear", "low", "complete"]);
        const topMissingFields = agentOutputs.filter((r) => redLabels.has(r.label)).sort((a, b) => (WEIGHTS[b.name] ?? 0) - (WEIGHTS[a.name] ?? 0)).slice(0, 2).map((r) => r.name);
        const keySignals = agentOutputs.filter((r) => positiveLabels.has(r.label)).slice(0, 3).map((r) => `${r.name}: ${r.reasoning}`);
        if (keySignals.length < 3) {
          for (const r of agentOutputs) {
            if (keySignals.length >= 3) break;
            const sig = `${r.name}: ${r.reasoning}`;
            if (!keySignals.includes(sig)) keySignals.push(sig);
          }
        }
        const missingInfo = agentOutputs.filter((r) => redLabels.has(r.label)).map((r) => `${r.name}: ${r.reasoning}`);
        return { score, classification, confidence, nextStep, agentOutputs, keySignals, missingInfo, topMissingFields };
      }

      // Process each candidate deal
      for (const row of targetRows) {
        // Only consider deals that are in diligence or ic_ready with no outcome,
        // or any deal that might have a score_drop or pattern_shift trigger.
        // Skip auto-generated records as trigger sources (only manual triages trigger).
        if (row.source === "auto") continue;

        const ageMs = now - new Date(row.createdAt).getTime();

        // 24-hour cooldown: skip if this deal was auto re-triaged in the last 24h
        const lastAutoAt = latestAutoByParent.get(row.id);
        if (lastAutoAt && now - lastAutoAt.getTime() < TWENTY_FOUR_HOURS_MS) {
          skipped++;
          continue;
        }

        // Determine trigger type
        let triggerType: TriggerType | null = null;

        // stale_diligence / stale_ic_ready
        if (!row.decisionOutcome && ageMs >= THIRTY_DAYS_MS) {
          if (row.stage === "diligence") triggerType = "stale_diligence";
          else if (row.stage === "ic_ready") triggerType = "stale_ic_ready";
        }

        // score_drop: find the most recent child triage for this deal
        if (!triggerType) {
          const children = allRows.filter((r) => r.parentTriageId === row.id && r.source !== "auto");
          if (children.length > 0) {
            const latestChild = children.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            if (row.score - latestChild.score >= SCORE_DROP_THRESHOLD) {
              triggerType = "score_drop";
            }
          }
        }

        // pattern_shift: deal is in diligence/ic_ready with no outcome, and recent
        // outcomes show a shift (e.g. majority of recent outcomes are "passed" but
        // deal has ENGAGE classification, or vice versa)
        if (!triggerType && (row.stage === "diligence" || row.stage === "ic_ready") && !row.decisionOutcome) {
          const totalOutcomes = recentPassedCount + recentInvestedCount;
          if (totalOutcomes >= 3) {
            const passedRate = recentPassedCount / totalOutcomes;
            const investedRate = recentInvestedCount / totalOutcomes;
            // Pattern shift: deal is ENGAGE but recent outcomes are mostly passed
            if (row.classification === "ENGAGE" && passedRate >= 0.7) triggerType = "pattern_shift";
            // Pattern shift: deal is IGNORE but recent outcomes are mostly invested
            if (row.classification === "IGNORE" && investedRate >= 0.7) triggerType = "pattern_shift";
          }
        }

        if (!triggerType) {
          skipped++;
          continue;
        }

        // Re-run the full triage pipeline on the original pitch text
        const pitchText = row.pitchPreview; // use stored preview as input
        try {
          const result = await runTriagePipeline(pitchText);
          const dealName = row.pitchPreview.slice(0, 40).trim();
          await savePitchTriage({
            userId,
            pitchPreview: row.pitchPreview,
            score: result.score,
            classification: result.classification,
            confidence: result.confidence,
            agentOutputs: JSON.stringify(result.agentOutputs),
            keySignals: JSON.stringify(result.keySignals),
            missingInfo: JSON.stringify(result.missingInfo),
            topMissingFields: JSON.stringify(result.topMissingFields),
            nextStep: result.nextStep,
            parentTriageId: row.id,
            triggerType,
            source: "auto",
          });
          triggered.push(dealName);
        } catch (err) {
          console.error(`[checkAndTrigger] Failed to re-triage deal ${row.id}:`, err);
          skipped++;
        }
      }

      return { triggered: triggered.length, skipped, deals: triggered };
    }),

  // ── Phase 2 Sprint 1: Signal intake ──────────────────────────────────────────

  /**
   * pitch.logSignal — Log a manual external signal for a deal and immediately
   * trigger a re-triage for that deal.
   */
  logSignal: protectedProcedure
    .input(z.object({
      dealId: z.string(),
      signalType: z.enum(["founder_update", "competitor_news", "market_event", "negative_press", "positive_press", "other"]),
      signalText: z.string().max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id.toString();
      const dealIdNum = parseInt(input.dealId, 10);
      if (isNaN(dealIdNum)) throw new Error("Invalid dealId");
      const deal = await getPitchTriageById(dealIdNum, userId);
      if (!deal) throw new Error("Deal not found or access denied");

      // Insert signal row
      const signalId = await insertDealSignal({
        userId,
        dealId: input.dealId,
        signalType: input.signalType,
        signalText: input.signalText,
        source: "manual",
        processed: false,
      });

      // Immediately re-triage the deal using the stored pitch preview
      let triggered = false;
      try {
        const result = await runTriagePipeline(deal.pitchPreview);
        await savePitchTriage({
          userId,
          pitchPreview: deal.pitchPreview,
          score: result.score,
          classification: result.classification,
          confidence: result.confidence,
          agentOutputs: JSON.stringify(result.agentOutputs),
          keySignals: JSON.stringify(result.keySignals),
          missingInfo: JSON.stringify(result.missingInfo),
          topMissingFields: JSON.stringify(result.topMissingFields),
          nextStep: result.nextStep,
          parentTriageId: deal.id,
          triggerType: "signal_triggered",
          source: "auto",
        });
        triggered = true;
      } catch (err) {
        console.error("[logSignal] Re-triage failed:", err);
      }

      // Mark signal as processed
      if (signalId) await markDealSignalProcessed(signalId);

      return { signalId, triggered };
    }),

  /**
   * pitch.getSignals — Fetch last 10 signals for a deal (ownership-checked).
   */
  getSignals: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id.toString();
      return getDealSignals(input.dealId, userId, 10);
    }),

  /**
   * pitch.autoTriggerCount — Returns count of auto_trigger_log rows in last 30 days.
   */
  autoTriggerCount: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id.toString();
      const count = await getAutoTriggerLogCount(userId);
      return { count };
    }),

  /**
   * pitch.signalTypeSummary — Returns count per signalType for processed signals.
   * Used by Pipeline Summary to show top signal types.
   */
  signalTypeSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id.toString();
      return getSignalTypeSummary(userId);
    }),

  /**
   * pitch.scoreHistory — Returns full score history for a deal (all triages ordered ASC).
   * Used by the score history modal on sparkline click-through.
   */
  scoreHistory: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dealIdNum = parseInt(input.dealId, 10);
      if (isNaN(dealIdNum)) throw new Error("Invalid dealId");
      const userId = ctx.user.id.toString();
      const deal = await getPitchTriageById(dealIdNum, userId);
      if (!deal) throw new Error("Deal not found or access denied");
      return getFullScoreHistory(dealIdNum);
    }),

  /**
   * pitch.commandCenter — Aggregated summary for the Command Center homepage.
   * Returns needsAttention deals, pipeline counts, recent signals, and auto-trigger count.
   */
  commandCenter: protectedProcedure.query(async ({ ctx }) => {
    return getCommandCenterData(ctx.user.id.toString());
  }),
});
