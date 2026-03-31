/**
 * dealScreener.ts — tRPC router for Deal Screener (Council of 10)
 * All verdict computation is delegated to councilEngine.ts.
 * This router handles: rate limiting, persistence, and data retrieval.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, gte } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dealScreenings, dealScreeningRateLimit, dealComparisons, dealScreenerPayments } from "../../drizzle/schema";
import { runCouncil } from "../councilEngine";
import { generateCfoDeepDiveText, generateCfoDeepDivePdf } from "../cfoDeepDivePdf";
import { runComparison } from "../comparisonEngine";
import { generateSingleDealICReport, generateComparisonICReport } from "../icReportEngine";
import { randomUUID } from "crypto";

// ── Plan-based daily rate limits ─────────────────────────────────────────────

type PlanTier = "trial" | "standard" | "pro" | "enterprise" | null | undefined;

function getDailyLimit(plan: PlanTier): number {
  if (plan === "enterprise") return Infinity;
  if (plan === "pro") return 50;
  return 50; // trial, standard, null, undefined → free tier
}

function getPlanLabel(plan: PlanTier): string {
  if (plan === "enterprise") return "enterprise";
  if (plan === "pro") return "pro";
  return "free";
}

/** Returns midnight UTC today as a Date (start of current 24h window). */
function todayMidnightUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function checkAndIncrementRateLimit(
  userId: number,
  plan: PlanTier
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const limit = getDailyLimit(plan);
  if (limit === Infinity) return; // enterprise: skip check

  const windowStart = todayMidnightUTC();

  const existing = await db
    .select()
    .from(dealScreeningRateLimit)
    .where(
      and(
        eq(dealScreeningRateLimit.userId, userId),
        gte(dealScreeningRateLimit.windowStart, windowStart)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    if (record.count >= limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: JSON.stringify({
          code: "RATE_LIMIT_EXCEEDED",
          plan: getPlanLabel(plan),
          limit,
          remaining: 0,
        }),
      });
    }
    await db
      .update(dealScreeningRateLimit)
      .set({ count: record.count + 1 })
      .where(eq(dealScreeningRateLimit.id, record.id));
  } else {
    await db.insert(dealScreeningRateLimit).values({
      userId,
      windowStart,
      count: 1,
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dealScreenerRouter = router({
  /**
   * Screen a deal through the Council of 10.
   * Rate limited by plan: free=3/day · pro=50/day · enterprise=unlimited.
   * Window resets at midnight UTC.
   */
  screen: protectedProcedure
    .input(
      z.object({
        dealName: z.string().min(1).max(255).trim(),
        dealText: z.string().min(10).max(3000).trim(),
        pdfFileKey: z.string().optional(),
        pdfFileUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Rate limit check (plan-based daily limit)
      await checkAndIncrementRateLimit(ctx.user.id, ctx.user.planTier as PlanTier);

      const dealId = randomUUID();

      // Run the council engine (with token deduction for paid plans)
      const result = await runCouncil(input.dealText, { userId: ctx.user.id });

      // Persist to database
      await db.insert(dealScreenings).values({
        userId: ctx.user.id,
        dealId,
        dealName: input.dealName,
        dealText: input.dealText,
        pdfFileKey: input.pdfFileKey ?? null,
        pdfFileUrl: input.pdfFileUrl ?? null,
        verdict: result.verdict,
        yesCount: result.yesCount,
        noCount: result.noCount,
        hardYesCount: result.hardYesCount,
        softYesCount: result.softYesCount,
        softNoCount: result.softNoCount,
        hardNoCount: result.hardNoCount,
        confidenceScore: result.confidenceScore.toString(),
        gccVetoTriggered: result.gccVetoTriggered,
        tiebreakerTriggered: result.tiebreakerTriggered,
        tiebreakerSwingAgent: result.tiebreakerSwingAgent ?? null,
        conditionsToProceed: JSON.stringify(result.conditionsToProceed),
        blockingIssues: JSON.stringify(result.blockingIssues),
        votes: JSON.stringify(result.votes),
      });

      // Generate boardroom-ready IC Report (additive — does not modify result)
      let icReport = null;
      try {
        icReport = await generateSingleDealICReport(input.dealName, input.dealText, result);
      } catch (err) {
        // IC report generation failure is non-fatal — raw Council result still returned
        console.error("[ICReport] Failed to generate IC report:", err);
      }

      return {
        dealId,
        dealName: input.dealName,
        ...result,
        icReport,
      };
    }),

  /**
   * Compare 2–5 deals through the Council of 10 and produce a ranked analysis.
   * Per spec: $32.50 × dealCount logged as pending transactions.
   * Does NOT modify any existing single-deal functionality.
   */
  compare: protectedProcedure
    .input(
      z.object({
        deals: z
          .array(
            z.object({
              name: z.string().min(1).max(255).trim(),
              summary: z.string().min(10).max(3000).trim(),
              metrics: z.record(z.string(), z.unknown()).optional(),
            })
          )
          .refine(arr => arr.length >= 2, { message: "Minimum 2 deals required for comparison" })
          .refine(arr => arr.length <= 5, { message: "Maximum 5 deals allowed per comparison" }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const dealCount = input.deals.length;
      const totalAmountUsd = (32.50 * dealCount).toFixed(2);

      // ── Log per-deal transactions as pending (no Stripe yet per spec) ──────
      const transactionIds: string[] = [];
      for (const deal of input.deals) {
        const pseudoSessionId = `cmp_${randomUUID()}_${deal.name.slice(0, 20).replace(/\s+/g, "_")}`;
        await db.insert(dealScreenerPayments).values({
          userId: ctx.user.id,
          stripeSessionId: pseudoSessionId,
          status: "pending",
          amountUsd: "32.50",
        });
        transactionIds.push(pseudoSessionId);
      }

      // ── Run comparison engine ─────────────────────────────────────────────
      let result;
      try {
        result = await runComparison(input.deals, { userId: ctx.user.id });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Comparison failed";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }

      // ── Persist to dealComparisons table ─────────────────────────────────
      await db.insert(dealComparisons).values({
        comparisonId: result.comparisonId,
        userId: ctx.user.id,
        dealIds: JSON.stringify(transactionIds),
        dealNames: JSON.stringify(input.deals.map(d => d.name)),
        dealCount,
        rankedDeals: JSON.stringify(result.comparisonSummary.rankedDeals),
        comparisonSummary: JSON.stringify(result.comparisonSummary),
        dealAnalyses: JSON.stringify(result.dealAnalyses),
        pdfUrl: null,
        totalAmountUsd,
      });

      // Generate boardroom-ready IC Comparison Report (additive — does not modify result)
      let icReport = null;
      try {
        icReport = await generateComparisonICReport(result.dealAnalyses, result.comparisonSummary);
      } catch (err) {
        console.error("[ICReport] Failed to generate comparison IC report:", err);
      }

      return {
        comparisonId: result.comparisonId,
        dealAnalyses: result.dealAnalyses,
        comparisonSummary: result.comparisonSummary,
        totalAmountUsd: parseFloat(totalAmountUsd),
        timestamp: result.timestamp,
        icReport,
      };
    }),

  /**
   * Get the authenticated user's comparison history.
   */
  comparisonHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const limit = input?.limit ?? 20;

      const rows = await db
        .select({
          id: dealComparisons.id,
          comparisonId: dealComparisons.comparisonId,
          dealNames: dealComparisons.dealNames,
          dealCount: dealComparisons.dealCount,
          totalAmountUsd: dealComparisons.totalAmountUsd,
          createdAt: dealComparisons.createdAt,
        })
        .from(dealComparisons)
        .where(eq(dealComparisons.userId, ctx.user.id))
        .orderBy(desc(dealComparisons.createdAt))
        .limit(limit);

      return rows.map(r => ({
        ...r,
        dealNames: JSON.parse(r.dealNames) as string[],
      }));
    }),

  /**
   * Get a single comparison by comparisonId (full ranked report).
   */
  getComparisonById: protectedProcedure
    .input(z.object({ comparisonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(dealComparisons)
        .where(
          and(
            eq(dealComparisons.comparisonId, input.comparisonId),
            eq(dealComparisons.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comparison not found" });
      }

      const row = rows[0];
      return {
        ...row,
        dealNames: JSON.parse(row.dealNames) as string[],
        dealIds: JSON.parse(row.dealIds) as string[],
        rankedDeals: JSON.parse(row.rankedDeals),
        comparisonSummary: JSON.parse(row.comparisonSummary),
        dealAnalyses: JSON.parse(row.dealAnalyses),
        totalAmountUsd: parseFloat(row.totalAmountUsd),
      };
    }),

  /**
   * Get the authenticated user's deal screening history.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const limit = input?.limit ?? 50;

      const rows = await db
        .select({
          id: dealScreenings.id,
          dealId: dealScreenings.dealId,
          dealName: dealScreenings.dealName,
          verdict: dealScreenings.verdict,
          yesCount: dealScreenings.yesCount,
          noCount: dealScreenings.noCount,
          confidenceScore: dealScreenings.confidenceScore,
          gccVetoTriggered: dealScreenings.gccVetoTriggered,
          tiebreakerTriggered: dealScreenings.tiebreakerTriggered,
          createdAt: dealScreenings.createdAt,
        })
        .from(dealScreenings)
        .where(eq(dealScreenings.userId, ctx.user.id))
        .orderBy(desc(dealScreenings.createdAt))
        .limit(limit);

      return rows;
    }),

  /**
   * Get a single deal screening by dealId (full IC report).
   */
  getById: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(dealScreenings)
        .where(
          and(
            eq(dealScreenings.dealId, input.dealId),
            eq(dealScreenings.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      }

      const row = rows[0];
      return {
        ...row,
        conditionsToProceed: JSON.parse(row.conditionsToProceed) as string[],
        blockingIssues: JSON.parse(row.blockingIssues) as string[],
        votes: JSON.parse(row.votes),
        confidenceScore: parseFloat(row.confidenceScore),
      };
    }),

  /**
   * Generate a full 7-section CFO Deep Dive analysis and return as base64 PDF.
   * Called on-demand from the CFO card in the results UI.
   */
  cfoDeepDive: protectedProcedure
    .input(
      z.object({
        dealName: z.string().min(1).max(255),
        dealText: z.string().min(10).max(3000),
      })
    )
    .mutation(async ({ input }) => {
      const analysisText = await generateCfoDeepDiveText(input.dealText, input.dealName);
      const pdfBuffer = await generateCfoDeepDivePdf(input.dealName, analysisText);
      return {
        base64: pdfBuffer.toString("base64"),
        filename: `CFO-DeepDive-${input.dealName.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}.pdf`,
        analysisText,
      };
    }),

  /**
   * Get remaining rate limit for the current user.
   */
  rateLimit: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const plan = ctx.user.planTier as PlanTier;
    const limit = getDailyLimit(plan);
    const planLabel = getPlanLabel(plan);

    if (limit === Infinity) {
      return { remaining: Infinity, limit: -1, plan: planLabel, resetAt: null };
    }

    if (!db) return { remaining: limit, limit, plan: planLabel, resetAt: null };

    const windowStart = todayMidnightUTC();
    const existing = await db
      .select()
      .from(dealScreeningRateLimit)
      .where(
        and(
          eq(dealScreeningRateLimit.userId, ctx.user.id),
          gte(dealScreeningRateLimit.windowStart, windowStart)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { remaining: limit, limit, plan: planLabel, resetAt: null };
    }

    const record = existing[0];
    const remaining = Math.max(0, limit - record.count);
    // Reset at next midnight UTC
    const tomorrow = new Date(windowStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return { remaining, limit, plan: planLabel, resetAt: tomorrow };
  }),
});
