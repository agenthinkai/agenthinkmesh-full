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
import { dealScreenings, dealScreeningRateLimit } from "../../drizzle/schema";
import { runCouncil } from "../councilEngine";
import { randomUUID } from "crypto";

// ── Plan-based daily rate limits ─────────────────────────────────────────────

type PlanTier = "trial" | "standard" | "pro" | "enterprise" | null | undefined;

function getDailyLimit(plan: PlanTier): number {
  if (plan === "enterprise") return Infinity;
  if (plan === "pro") return 50;
  return 3; // trial, standard, null, undefined → free tier
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

      return {
        dealId,
        dealName: input.dealName,
        ...result,
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
