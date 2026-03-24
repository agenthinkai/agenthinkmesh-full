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

// ── Rate limit: 20 screens per user per hour ──────────────────────────────────

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function checkAndIncrementRateLimit(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  // Find existing rate limit record for this user in the current window
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
    if (record.count >= RATE_LIMIT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. You can screen up to ${RATE_LIMIT_MAX} deals per hour. Please try again later.`,
      });
    }
    // Increment count
    await db
      .update(dealScreeningRateLimit)
      .set({ count: record.count + 1 })
      .where(eq(dealScreeningRateLimit.id, record.id));
  } else {
    // Create new window record
    await db.insert(dealScreeningRateLimit).values({
      userId,
      windowStart: new Date(),
      count: 1,
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dealScreenerRouter = router({
  /**
   * Screen a deal through the Council of 10.
   * Rate limited to 20 screens/hour per user.
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

      // Rate limit check
      await checkAndIncrementRateLimit(ctx.user.id);

      const dealId = randomUUID();

      // Run the council engine
      const result = await runCouncil(input.dealText);

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
    if (!db) return { remaining: RATE_LIMIT_MAX, resetAt: null };

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
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
      return { remaining: RATE_LIMIT_MAX, resetAt: null };
    }

    const record = existing[0];
    const remaining = Math.max(0, RATE_LIMIT_MAX - record.count);
    const resetAt = new Date(record.windowStart.getTime() + RATE_LIMIT_WINDOW_MS);
    return { remaining, resetAt };
  }),
});
