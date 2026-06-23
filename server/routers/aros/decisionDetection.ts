/**
 * aros/decisionDetection.ts — Decision Detection Swarm
 *
 * Ranks opportunities across the universe:
 *  - Urgency scoring with ACV estimation
 *  - Funnel tier promotion (UNIVERSE → ACTIVE → HIGH_PRIORITY → OUTREACH_CANDIDATE)
 *  - Top-N opportunity ranking
 *  - Opportunity summary for Revenue Command Center
 */

import { z } from "zod";
import { and, desc, eq, sql, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosOpportunitySignals,
  arosMonitoringJobs,
  arosTokenLedger,
  arosAuditLog,
  arosFunnelSnapshots,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

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

// ── Composite opportunity score ───────────────────────────────────────────────
// Weights: opportunityScore 40% + agenthinkFitScore 30% + decisionComplexityScore 20% + signal urgency 10%
function computeCompositeScore(
  opportunityScore: number,
  agenthinkFitScore: number,
  decisionComplexityScore: number,
  maxSignalUrgency: number
): number {
  return Math.round(
    opportunityScore * 0.4 +
    agenthinkFitScore * 0.3 +
    decisionComplexityScore * 0.2 +
    maxSignalUrgency * 0.1
  );
}

// ── LLM: Score urgency and estimate ACV ──────────────────────────────────────
async function scoreOpportunity(company: {
  companyName: string;
  sector: string;
  country: string;
  revenueUsdBn: string | null;
  keyDecisionDomain: string | null;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  opportunityScore: number;
  agenthinkFitScore: number;
  decisionComplexityScore: number;
}, signals: Array<{ signalType: string; urgencyScore: number; acvEstimateUsd: number }>): Promise<{
  urgencyScore: number;
  acvEstimateUsd: number;
  urgencyRationale: string;
  recommendedAction: string;
  tier: "UNIVERSE" | "ACTIVE" | "HIGH_PRIORITY" | "OUTREACH_CANDIDATE";
}> {
  const signalSummary = signals.map(s => `${s.signalType}: urgency ${s.urgencyScore}, ACV $${s.acvEstimateUsd.toLocaleString()}`).join("; ");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are AROS Decision Detection. Score opportunity urgency and estimate ACV. Return ONLY valid JSON.",
      },
      {
        role: "user",
        content: `Score this opportunity:

Company: ${company.companyName} (${company.sector}, ${company.country})
Revenue: ${company.revenueUsdBn ? `$${company.revenueUsdBn}B` : "Unknown"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Unknown"}
Strategic Initiative: ${company.activeStrategicInitiative ?? "Unknown"}
AI Signal: ${company.aiTransformationSignal ?? "Unknown"}
Opportunity Score: ${company.opportunityScore}/100
AgenThink Fit: ${company.agenthinkFitScore}/100
Decision Complexity: ${company.decisionComplexityScore}/100
Active Signals: ${signalSummary || "None detected"}

Return:
{
  "urgencyScore": number (0-100, how urgent is it to reach out NOW),
  "acvEstimateUsd": number (realistic annual contract value in USD for AgenThinkMesh pilot/platform),
  "urgencyRationale": "string (1-2 sentences explaining the urgency score)",
  "recommendedAction": "string (specific next action: e.g. 'CEO outreach this week', 'Monitor for 30 days')",
  "tier": "UNIVERSE | ACTIVE | HIGH_PRIORITY | OUTREACH_CANDIDATE"
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "opportunity_score",
        strict: true,
        schema: {
          type: "object",
          properties: {
            urgencyScore: { type: "integer" },
            acvEstimateUsd: { type: "integer" },
            urgencyRationale: { type: "string" },
            recommendedAction: { type: "string" },
            tier: { type: "string" },
          },
          required: ["urgencyScore", "acvEstimateUsd", "urgencyRationale", "recommendedAction", "tier"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "{}";
  const parsed = JSON.parse(content);

  const validTiers = ["UNIVERSE", "ACTIVE", "HIGH_PRIORITY", "OUTREACH_CANDIDATE"] as const;
  const tier = validTiers.includes(parsed.tier) ? parsed.tier : "ACTIVE";

  return {
    urgencyScore: parsed.urgencyScore ?? 50,
    acvEstimateUsd: parsed.acvEstimateUsd ?? 25000,
    urgencyRationale: parsed.urgencyRationale ?? "",
    recommendedAction: parsed.recommendedAction ?? "",
    tier,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const arosDecisionDetectionRouter = router({

  // ── Get ranked opportunities ───────────────────────────────────────────────
  getRankedOpportunities: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      tier: z.enum(["UNIVERSE", "ACTIVE", "HIGH_PRIORITY", "OUTREACH_CANDIDATE"]).optional(),
      sector: z.string().optional(),
      minScore: z.number().min(0).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Join companies with monitoring jobs to get tier info
      const conditions = [];
      if (input.tier) conditions.push(eq(arosMonitoringJobs.funnelTier, input.tier));
      if (input.sector) conditions.push(eq(arosCompanies.sector, input.sector));
      if (input.minScore !== undefined) {
        conditions.push(sql`${arosCompanies.opportunityScore} >= ${input.minScore}`);
      }

      const rows = await db
        .select({
          company: arosCompanies,
          job: {
            funnelTier: arosMonitoringJobs.funnelTier,
            lastMonitoredAt: arosMonitoringJobs.lastMonitoredAt,
            lastSignalCount: arosMonitoringJobs.lastSignalCount,
          },
        })
        .from(arosCompanies)
        .leftJoin(arosMonitoringJobs, eq(arosCompanies.id, arosMonitoringJobs.companyId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(arosCompanies.opportunityScore))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(arosCompanies)
        .leftJoin(arosMonitoringJobs, eq(arosCompanies.id, arosMonitoringJobs.companyId))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { rows, total: Number(countRow.count) };
    }),

  // ── Get top 20 opportunities (Decision Detection output) ──────────────────
  getTop20: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select({
          company: arosCompanies,
          job: arosMonitoringJobs,
        })
        .from(arosCompanies)
        .leftJoin(arosMonitoringJobs, eq(arosCompanies.id, arosMonitoringJobs.companyId))
        .orderBy(desc(arosCompanies.opportunityScore))
        .limit(20);

      // Enrich with signal counts
      const enriched = await Promise.all(rows.map(async (row) => {
        const signals = await db
          .select({ count: sql<number>`count(*)`, maxUrgency: sql<number>`max(urgency_score)`, totalAcv: sql<number>`sum(acv_estimate_usd)` })
          .from(arosOpportunitySignals)
          .where(and(
            eq(arosOpportunitySignals.companyId, row.company.id),
            eq(arosOpportunitySignals.isActive, true)
          ));
        return {
          ...row,
          signalCount: Number(signals[0]?.count ?? 0),
          maxUrgency: Number(signals[0]?.maxUrgency ?? 0),
          totalAcv: Number(signals[0]?.totalAcv ?? 0),
        };
      }));

      return enriched;
    }),

  // ── Score a single opportunity with LLM ───────────────────────────────────
  scoreOpportunity: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const signals = await db
        .select({ signalType: arosOpportunitySignals.signalType, urgencyScore: arosOpportunitySignals.urgencyScore, acvEstimateUsd: arosOpportunitySignals.acvEstimateUsd })
        .from(arosOpportunitySignals)
        .where(and(
          eq(arosOpportunitySignals.companyId, input.companyId),
          eq(arosOpportunitySignals.isActive, true)
        ));

      const scored = await scoreOpportunity(company, signals);

      // Log tokens
      await db.insert(arosTokenLedger).values({
        companyId: input.companyId,
        workflow: "decision_detection",
        model: "gpt-4o-mini",
        inputTokens: 400,
        outputTokens: 200,
        totalTokens: 600,
        costUsd: (400 * 0.00000015 + 200 * 0.0000006).toFixed(8),
        triggeredBy: ctx.user.id,
      });

      // Update monitoring tier
      const freqMap: Record<string, number> = {
        UNIVERSE: 30, ACTIVE: 7, HIGH_PRIORITY: 1, OUTREACH_CANDIDATE: 0,
      };
      const freq = freqMap[scored.tier] ?? 30;

      await db.update(arosMonitoringJobs)
        .set({
          funnelTier: scored.tier,
          monitoringFrequencyDays: freq,
          nextMonitorAt: Date.now() + freq * 86400000,
          updatedAt: Date.now(),
        })
        .where(eq(arosMonitoringJobs.companyId, input.companyId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "decision_detection.scored",
        entityType: "aros_companies",
        entityId: String(input.companyId),
        payload: JSON.stringify(scored),
      });

      return scored;
    }),

  // ── Get funnel summary (tier counts) ──────────────────────────────────────
  getFunnelSummary: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const tiers = await db
        .select({
          tier: arosMonitoringJobs.funnelTier,
          count: sql<number>`count(*)`,
        })
        .from(arosMonitoringJobs)
        .where(eq(arosMonitoringJobs.status, "active"))
        .groupBy(arosMonitoringJobs.funnelTier);

      const tierMap: Record<string, number> = {};
      for (const t of tiers) tierMap[t.tier] = Number(t.count);

      const [totalCompanies] = await db.select({ count: sql<number>`count(*)` }).from(arosCompanies);

      // Token economics
      const [tokenStats] = await db.select({
        totalTokens: sql<number>`sum(total_tokens)`,
        totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
      }).from(arosTokenLedger);

      return {
        universe: tierMap["UNIVERSE"] ?? 0,
        active: tierMap["ACTIVE"] ?? 0,
        highPriority: tierMap["HIGH_PRIORITY"] ?? 0,
        outreachCandidate: tierMap["OUTREACH_CANDIDATE"] ?? 0,
        totalCompanies: Number(totalCompanies.count),
        totalTokensUsed: Number(tokenStats?.totalTokens ?? 0),
        totalCostUsd: Number(tokenStats?.totalCost ?? 0),
      };
    }),

  // ── Take a funnel snapshot ─────────────────────────────────────────────────
  takeFunnelSnapshot: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const tiers = await db
        .select({ tier: arosMonitoringJobs.funnelTier, count: sql<number>`count(*)` })
        .from(arosMonitoringJobs)
        .groupBy(arosMonitoringJobs.funnelTier);

      const tierMap: Record<string, number> = {};
      for (const t of tiers) tierMap[t.tier] = Number(t.count);

      const [tokenStats] = await db.select({
        totalTokens: sql<number>`sum(total_tokens)`,
        totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
      }).from(arosTokenLedger);

      const today = new Date().toISOString().split("T")[0];

      await db.insert(arosFunnelSnapshots).values({
        snapshotDate: today,
        universeCount: tierMap["UNIVERSE"] ?? 0,
        activeCount: tierMap["ACTIVE"] ?? 0,
        highPriorityCount: tierMap["HIGH_PRIORITY"] ?? 0,
        outreachCandidateCount: tierMap["OUTREACH_CANDIDATE"] ?? 0,
        totalTokensUsed: Number(tokenStats?.totalTokens ?? 0),
        totalCostUsd: String(Number(tokenStats?.totalCost ?? 0).toFixed(4)),
      });

      return { snapshotDate: today };
    }),

  // ── Get funnel history ─────────────────────────────────────────────────────
  getFunnelHistory: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      return db
        .select()
        .from(arosFunnelSnapshots)
        .where(sql`${arosFunnelSnapshots.snapshotDate} >= ${cutoffStr}`)
        .orderBy(arosFunnelSnapshots.snapshotDate);
    }),
});
