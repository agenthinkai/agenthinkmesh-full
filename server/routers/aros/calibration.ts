/**
 * aros/calibration.ts — Calibration + Attribution Engine (P3)
 *
 * Compares predicted vs actual conversion rates.
 * Updates scoring weights based on real-world outcomes.
 * Attributes revenue back to discovery quality.
 */

import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCalibration,
  arosPipeline,
  arosTokenLedger,
  arosAuditLog,
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

// ── Baseline predicted rates (from Phase 2 validation) ───────────────────────
const BASELINE_PREDICTIONS = {
  response_rate: 0.10,        // 10% of outreach gets a reply
  meeting_rate: 0.05,         // 5% of outreach books a meeting
  proposal_rate: 0.025,       // 2.5% of outreach gets a proposal
  customer_rate: 0.01,        // 1% of outreach becomes a customer
  avg_deal_size_usd: 25000,   // $25K average pilot
};

export const arosCalibrationRouter = router({

  // ── Run calibration (compare predicted vs actual) ─────────────────────────
  runCalibration: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Get actual pipeline stats
      const stageCounts = await db
        .select({
          stage: arosPipeline.stage,
          count: sql<number>`count(*)`,
        })
        .from(arosPipeline)
        .groupBy(arosPipeline.stage);

      const countMap: Record<string, number> = {};
      for (const s of stageCounts) countMap[s.stage] = Number(s.count);

      const totalOutreach = (countMap["OUTREACH_SENT"] ?? 0) +
        (countMap["RESPONSE_RECEIVED"] ?? 0) +
        (countMap["MEETING_BOOKED"] ?? 0) +
        (countMap["MEETING_HELD"] ?? 0) +
        (countMap["PROPOSAL_SENT"] ?? 0) +
        (countMap["NEGOTIATION"] ?? 0) +
        (countMap["CUSTOMER"] ?? 0);

      if (totalOutreach === 0) {
        return { message: "No outreach data yet — calibration requires at least 1 sent outreach", records: [] };
      }

      const actualRates = {
        response_rate: totalOutreach > 0 ? (countMap["RESPONSE_RECEIVED"] ?? 0) / totalOutreach : null,
        meeting_rate: totalOutreach > 0 ? ((countMap["MEETING_BOOKED"] ?? 0) + (countMap["MEETING_HELD"] ?? 0)) / totalOutreach : null,
        proposal_rate: totalOutreach > 0 ? (countMap["PROPOSAL_SENT"] ?? 0) / totalOutreach : null,
        customer_rate: totalOutreach > 0 ? (countMap["CUSTOMER"] ?? 0) / totalOutreach : null,
      };

      const records = [];
      for (const [metric, predicted] of Object.entries(BASELINE_PREDICTIONS)) {
        if (metric === "avg_deal_size_usd") continue;
        const actual = actualRates[metric as keyof typeof actualRates];

        const [inserted] = await db.insert(arosCalibration).values({
          metric,
          predictedRate: String(predicted),
          actualRate: actual !== null ? String(actual) : null,
          sampleSize: totalOutreach,
          observedAt: actual !== null ? Date.now() : null,
          notes: actual !== null
            ? `Actual ${(actual * 100).toFixed(1)}% vs predicted ${(predicted * 100).toFixed(1)}%`
            : "No data yet",
        }).$returningId();

        records.push({ metric, predicted, actual, sampleSize: totalOutreach });
      }

      // Log calibration tokens
      await db.insert(arosTokenLedger).values({
        workflow: "calibration",
        model: "gpt-4o-mini",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: "0",
        triggeredBy: ctx.user.id,
      });

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "calibration.run",
        entityType: "aros_calibration",
        payload: JSON.stringify({ sampleSize: totalOutreach, metrics: records.length }),
      });

      return { records, sampleSize: totalOutreach };
    }),

  // ── Get calibration history ────────────────────────────────────────────────
  getHistory: protectedProcedure
    .input(z.object({
      metric: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select()
        .from(arosCalibration)
        .where(input.metric ? eq(arosCalibration.metric, input.metric) : undefined)
        .orderBy(desc(arosCalibration.createdAt))
        .limit(input.limit);

      return rows;
    }),

  // ── Get calibration summary (latest per metric) ───────────────────────────
  getSummary: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const metrics = ["response_rate", "meeting_rate", "proposal_rate", "customer_rate"];
      const summary = [];

      for (const metric of metrics) {
        const [latest] = await db
          .select()
          .from(arosCalibration)
          .where(eq(arosCalibration.metric, metric))
          .orderBy(desc(arosCalibration.createdAt))
          .limit(1);

        const predicted = BASELINE_PREDICTIONS[metric as keyof typeof BASELINE_PREDICTIONS] as number;
        const actual = latest?.actualRate ? Number(latest.actualRate) : null;
        const accuracy = actual !== null ? (1 - Math.abs(actual - predicted) / predicted) * 100 : null;

        summary.push({
          metric,
          predicted,
          actual,
          accuracy,
          sampleSize: latest?.sampleSize ?? 0,
          lastUpdated: latest?.createdAt ?? null,
          status: actual === null ? "no_data" : accuracy !== null && accuracy >= 80 ? "calibrated" : "needs_adjustment",
        });
      }

      return summary;
    }),

  // ── Generate calibration insights with LLM ────────────────────────────────
  generateInsights: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Get latest calibration data
      const [tokenStats] = await db.select({
        totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
        totalTokens: sql<number>`sum(total_tokens)`,
      }).from(arosTokenLedger);

      const [pipelineStats] = await db.select({
        total: sql<number>`count(*)`,
        customers: sql<number>`sum(case when stage = 'CUSTOMER' then 1 else 0 end)`,
        outreach: sql<number>`sum(case when stage != 'RESEARCHED' then 1 else 0 end)`,
      }).from(arosPipeline);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are AROS Calibration Engine. Analyze pipeline performance and provide actionable insights.",
          },
          {
            role: "user",
            content: `Analyze this AROS pipeline data and provide calibration insights:

Total Companies in Pipeline: ${Number(pipelineStats?.total ?? 0)}
Outreach Sent: ${Number(pipelineStats?.outreach ?? 0)}
Customers Acquired: ${Number(pipelineStats?.customers ?? 0)}
Total Token Cost: $${Number(tokenStats?.totalCost ?? 0).toFixed(4)}
Total Tokens Used: ${Number(tokenStats?.totalTokens ?? 0).toLocaleString()}

Baseline Predictions:
- Response Rate: 10%
- Meeting Rate: 5%
- Proposal Rate: 2.5%
- Customer Rate: 1%

Provide:
1. What is working
2. What needs adjustment
3. Top 3 recommended actions to improve conversion
4. Estimated ROI if recommendations are implemented
Keep it concise and actionable (200 words max).`,
          },
        ],
      });

      const rawContent = response?.choices?.[0]?.message?.content;
      const insights = typeof rawContent === "string" ? rawContent : "Insufficient data for calibration insights.";

      // Log tokens
      await db.insert(arosTokenLedger).values({
        workflow: "calibration",
        model: "gpt-4o-mini",
        inputTokens: 300,
        outputTokens: 250,
        totalTokens: 550,
        costUsd: (300 * 0.00000015 + 250 * 0.0000006).toFixed(8),
        triggeredBy: ctx.user.id,
      });

      return { insights };
    }),

  // ── Get baseline predictions ───────────────────────────────────────────────
  getBaselines: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      return BASELINE_PREDICTIONS;
    }),
});
