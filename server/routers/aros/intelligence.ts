/**
 * aros/intelligence.ts — Intelligence Swarm
 *
 * Per-company deep intelligence:
 *  - Strategic initiative detection
 *  - Decision Twin generation
 *  - Executive dossier production
 *  - Opportunity signal creation
 */

import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosOpportunitySignals,
  arosMonitoringJobs,
  arosTokenLedger,
  arosAuditLog,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

// ── Helpers ───────────────────────────────────────────────────────────────────
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function requireAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

async function logTokens(
  db: Awaited<ReturnType<typeof requireDb>>,
  params: {
    runId?: string;
    companyId?: number;
    workflow: "company_research" | "decision_detection" | "outreach_generation" | "council_deliberation" | "proposal_generation" | "calibration" | "attribution";
    inputTokens: number;
    outputTokens: number;
    triggeredBy?: number;
  }
) {
  const total = params.inputTokens + params.outputTokens;
  const cost = (params.inputTokens * 0.00000015) + (params.outputTokens * 0.0000006);
  await db.insert(arosTokenLedger).values({
    runId: params.runId ?? null,
    companyId: params.companyId ?? null,
    workflow: params.workflow,
    model: "gpt-4o-mini",
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: total,
    costUsd: cost.toFixed(8),
    triggeredBy: params.triggeredBy ?? null,
  });
  return { total, cost };
}

// ── LLM: Generate Decision Twin ───────────────────────────────────────────────
async function generateDecisionTwin(company: {
  companyName: string;
  sector: string;
  country: string;
  revenueUsdBn: string | null;
  employees: number | null;
  ceoName: string | null;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  keyDecisionDomain: string | null;
}): Promise<{
  decisionTwin: string;
  executiveDossier: string;
  signals: Array<{
    signalType: string;
    signalTitle: string;
    signalEvidence: string;
    urgencyScore: number;
    acvEstimateUsd: number;
    confidenceScore: number;
  }>;
  updatedOpportunityScore: number;
  updatedAgenthinkFitScore: number;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are AROS Intelligence Swarm. You generate Decision Twins and executive intelligence for enterprise sales targeting. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Generate a Decision Twin and intelligence package for:

Company: ${company.companyName}
Sector: ${company.sector}
Country: ${company.country}
Revenue: ${company.revenueUsdBn ? `$${company.revenueUsdBn}B` : "Unknown"}
Employees: ${company.employees?.toLocaleString() ?? "Unknown"}
CEO: ${company.ceoName ?? "Unknown"}
Strategic Initiative: ${company.activeStrategicInitiative ?? "Unknown"}
AI Signal: ${company.aiTransformationSignal ?? "Unknown"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Unknown"}

Return this exact JSON:
{
  "decisionTwin": "string (200-300 words: how this company makes strategic decisions, who the real decision makers are, what their decision criteria are, what their pain points are, and why AgenThinkMesh is relevant)",
  "executiveDossier": "string (300-400 words: company background, current strategic priorities, key executives, recent news, AI/data maturity, buying signals, recommended approach)",
  "signals": [
    {
      "signalType": "one of: AI_TRANSFORMATION | MA_ACTIVITY | CAPITAL_ALLOCATION | DATA_MODERNIZATION | REGULATORY_CHANGE | LEADERSHIP_CHANGE | EARNINGS_PRESSURE | STRATEGIC_PARTNERSHIP | TECHNOLOGY_INVESTMENT | WORKFORCE_RESTRUCTURING",
      "signalTitle": "string (brief title of the signal)",
      "signalEvidence": "string (specific evidence for this signal)",
      "urgencyScore": number (0-100),
      "acvEstimateUsd": number (estimated annual contract value in USD, e.g. 50000 for $50K),
      "confidenceScore": number (0-100)
    }
  ],
  "updatedOpportunityScore": number (0-100),
  "updatedAgenthinkFitScore": number (0-100)
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "decision_twin",
        strict: true,
        schema: {
          type: "object",
          properties: {
            decisionTwin: { type: "string" },
            executiveDossier: { type: "string" },
            signals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  signalType: { type: "string" },
                  signalTitle: { type: "string" },
                  signalEvidence: { type: "string" },
                  urgencyScore: { type: "integer" },
                  acvEstimateUsd: { type: "integer" },
                  confidenceScore: { type: "integer" },
                },
                required: ["signalType", "signalTitle", "signalEvidence", "urgencyScore", "acvEstimateUsd", "confidenceScore"],
                additionalProperties: false,
              },
            },
            updatedOpportunityScore: { type: "integer" },
            updatedAgenthinkFitScore: { type: "integer" },
          },
          required: ["decisionTwin", "executiveDossier", "signals", "updatedOpportunityScore", "updatedAgenthinkFitScore"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "{}";
  const parsed = JSON.parse(content);

  return {
    decisionTwin: parsed.decisionTwin ?? "",
    executiveDossier: parsed.executiveDossier ?? "",
    signals: parsed.signals ?? [],
    updatedOpportunityScore: parsed.updatedOpportunityScore ?? 50,
    updatedAgenthinkFitScore: parsed.updatedAgenthinkFitScore ?? 50,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const arosIntelligenceRouter = router({

  // ── Generate Decision Twin for a single company ────────────────────────────
  generateDecisionTwin: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      const intel = await generateDecisionTwin(company);

      // Estimate tokens
      const inputTok = 800;
      const outputTok = 600;
      await logTokens(db, {
        companyId: company.id,
        workflow: "company_research",
        inputTokens: inputTok,
        outputTokens: outputTok,
        triggeredBy: ctx.user.id,
      });

      // Update company record
      await db.update(arosCompanies)
        .set({
          decisionTwin: intel.decisionTwin,
          executiveDossier: intel.executiveDossier,
          opportunityScore: intel.updatedOpportunityScore,
          agenthinkFitScore: intel.updatedAgenthinkFitScore,
          updatedAt: Date.now(),
        })
        .where(eq(arosCompanies.id, company.id));

      // Insert signals
      if (intel.signals.length > 0) {
        const validSignalTypes = [
          "AI_TRANSFORMATION", "MA_ACTIVITY", "CAPITAL_ALLOCATION", "DATA_MODERNIZATION",
          "REGULATORY_CHANGE", "LEADERSHIP_CHANGE", "EARNINGS_PRESSURE",
          "STRATEGIC_PARTNERSHIP", "TECHNOLOGY_INVESTMENT", "WORKFORCE_RESTRUCTURING"
        ] as const;
        type SignalType = typeof validSignalTypes[number];

        for (const sig of intel.signals) {
          const signalType = validSignalTypes.includes(sig.signalType as SignalType)
            ? (sig.signalType as SignalType)
            : "AI_TRANSFORMATION";

          await db.insert(arosOpportunitySignals).values({
            companyId: company.id,
            signalType,
            signalTitle: sig.signalTitle,
            signalEvidence: sig.signalEvidence,
            urgencyScore: sig.urgencyScore,
            acvEstimateUsd: sig.acvEstimateUsd,
            confidenceScore: sig.confidenceScore,
            isActive: true,
          });
        }
      }

      // Update monitoring job
      await db.update(arosMonitoringJobs)
        .set({
          lastMonitoredAt: Date.now(),
          lastSignalCount: intel.signals.length,
          updatedAt: Date.now(),
        })
        .where(eq(arosMonitoringJobs.companyId, company.id));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.decision_twin.generated",
        entityType: "aros_companies",
        entityId: String(company.id),
        payload: JSON.stringify({ signalCount: intel.signals.length, score: intel.updatedOpportunityScore }),
      });

      return {
        companyId: company.id,
        decisionTwin: intel.decisionTwin,
        executiveDossier: intel.executiveDossier,
        signals: intel.signals,
        updatedOpportunityScore: intel.updatedOpportunityScore,
        updatedAgenthinkFitScore: intel.updatedAgenthinkFitScore,
      };
    }),

  // ── Batch generate Decision Twins (up to 20 at a time) ────────────────────
  batchGenerateDecisionTwins: protectedProcedure
    .input(z.object({
      companyIds: z.array(z.number()).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const results: Array<{ companyId: number; status: "ok" | "error"; error?: string }> = [];

      for (const companyId of input.companyIds) {
        try {
          const [company] = await db
            .select()
            .from(arosCompanies)
            .where(eq(arosCompanies.id, companyId))
            .limit(1);
          if (!company) { results.push({ companyId, status: "error", error: "Not found" }); continue; }

          const intel = await generateDecisionTwin(company);

          await logTokens(db, {
            companyId,
            workflow: "company_research",
            inputTokens: 800,
            outputTokens: 600,
            triggeredBy: ctx.user.id,
          });

          await db.update(arosCompanies)
            .set({
              decisionTwin: intel.decisionTwin,
              executiveDossier: intel.executiveDossier,
              opportunityScore: intel.updatedOpportunityScore,
              agenthinkFitScore: intel.updatedAgenthinkFitScore,
              updatedAt: Date.now(),
            })
            .where(eq(arosCompanies.id, companyId));

          const validSignalTypes = [
            "AI_TRANSFORMATION", "MA_ACTIVITY", "CAPITAL_ALLOCATION", "DATA_MODERNIZATION",
            "REGULATORY_CHANGE", "LEADERSHIP_CHANGE", "EARNINGS_PRESSURE",
            "STRATEGIC_PARTNERSHIP", "TECHNOLOGY_INVESTMENT", "WORKFORCE_RESTRUCTURING"
          ] as const;
          type SignalType = typeof validSignalTypes[number];

          for (const sig of intel.signals) {
            const signalType = validSignalTypes.includes(sig.signalType as SignalType)
              ? (sig.signalType as SignalType)
              : "AI_TRANSFORMATION";
            await db.insert(arosOpportunitySignals).values({
              companyId,
              signalType,
              signalTitle: sig.signalTitle,
              signalEvidence: sig.signalEvidence,
              urgencyScore: sig.urgencyScore,
              acvEstimateUsd: sig.acvEstimateUsd,
              confidenceScore: sig.confidenceScore,
              isActive: true,
            });
          }

          results.push({ companyId, status: "ok" });
        } catch (err: unknown) {
          results.push({ companyId, status: "error", error: String(err) });
        }
      }

      return { results, processed: results.filter(r => r.status === "ok").length };
    }),

  // ── Get signals for a company ──────────────────────────────────────────────
  getSignals: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const conditions = [eq(arosOpportunitySignals.companyId, input.companyId)];
      if (input.activeOnly) conditions.push(eq(arosOpportunitySignals.isActive, true));
      return db
        .select()
        .from(arosOpportunitySignals)
        .where(and(...conditions))
        .orderBy(desc(arosOpportunitySignals.urgencyScore));
    }),

  // ── Get top signals across all companies ──────────────────────────────────
  getTopSignals: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      signalType: z.string().optional(),
      minUrgency: z.number().min(0).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const conditions = [eq(arosOpportunitySignals.isActive, true)];
      if (input.minUrgency !== undefined) {
        conditions.push(sql`${arosOpportunitySignals.urgencyScore} >= ${input.minUrgency}`);
      }

      const signals = await db
        .select({
          signal: arosOpportunitySignals,
          company: {
            id: arosCompanies.id,
            companyName: arosCompanies.companyName,
            sector: arosCompanies.sector,
            country: arosCompanies.country,
            ceoName: arosCompanies.ceoName,
          },
        })
        .from(arosOpportunitySignals)
        .innerJoin(arosCompanies, eq(arosOpportunitySignals.companyId, arosCompanies.id))
        .where(and(...conditions))
        .orderBy(desc(arosOpportunitySignals.urgencyScore))
        .limit(input.limit);

      return signals;
    }),

  // ── Update funnel tier for a company ──────────────────────────────────────
  updateFunnelTier: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      tier: z.enum(["UNIVERSE", "ACTIVE", "HIGH_PRIORITY", "OUTREACH_CANDIDATE"]),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const freqMap: Record<string, number> = {
        UNIVERSE: 30, ACTIVE: 7, HIGH_PRIORITY: 1, OUTREACH_CANDIDATE: 0,
      };
      const freq = freqMap[input.tier];

      await db.update(arosMonitoringJobs)
        .set({
          funnelTier: input.tier,
          monitoringFrequencyDays: freq,
          nextMonitorAt: Date.now() + freq * 86400000,
          updatedAt: Date.now(),
        })
        .where(eq(arosMonitoringJobs.companyId, input.companyId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.tier.updated",
        entityType: "aros_monitoring_jobs",
        entityId: String(input.companyId),
        payload: JSON.stringify({ tier: input.tier }),
      });

      return { success: true };
    }),
});
