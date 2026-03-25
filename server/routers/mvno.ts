/**
 * mvno.ts — tRPC router for Kuwait MVNO Intelligence module
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mvnoAgentRuns } from "../../drizzle/schema";
import { runMvnoAgents, MOCK_SUBSCRIBERS, type SubscriberContext } from "../mvnoEngine";
import { randomUUID } from "crypto";

const SubscriberContextSchema = z.object({
  name: z.string().min(1).max(255),
  nationality: z.string().min(1).max(100),
  msisdn: z.string().min(5).max(20),
  plan: z.enum(["basic", "worker", "remittance_plus"]),
  simStatus: z.enum(["active", "suspended", "ported_out"]),
  kycStatus: z.enum(["pending", "verified", "rejected"]),
  monthlyArpu: z.number().min(0).max(9999),
  notes: z.string().max(500).optional(),
});

export const mvnoRouter = router({
  /**
   * Run all 5 MVNO agents against a subscriber profile.
   * Persists the run to mvno_agent_runs.
   */
  analyseSubscriber: protectedProcedure
    .input(SubscriberContextSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const result = await runMvnoAgents(input as SubscriberContext);

      const runId = randomUUID();
      await db.insert(mvnoAgentRuns).values({
        id: runId,
        userId: ctx.user.id,
        subscriberContext: JSON.stringify(input),
        agentResults: JSON.stringify(result.agentResults),
        overallRecommendation: result.overallRecommendation,
      });

      return {
        runId,
        subscriber: input,
        ...result,
      };
    }),

  /**
   * Get the authenticated user's MVNO run history.
   */
  subscriberHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const limit = input?.limit ?? 50;
      const rows = await db
        .select()
        .from(mvnoAgentRuns)
        .where(eq(mvnoAgentRuns.userId, ctx.user.id))
        .orderBy(desc(mvnoAgentRuns.createdAt))
        .limit(limit);

      return rows.map((r) => ({
        ...r,
        subscriberContext: JSON.parse(r.subscriberContext) as SubscriberContext,
        agentResults: JSON.parse(r.agentResults),
      }));
    }),

  /**
   * Get a single MVNO run by ID (full 5-agent report).
   */
  getById: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(mvnoAgentRuns)
        .where(eq(mvnoAgentRuns.id, input.runId))
        .limit(1);

      if (rows.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      const row = rows[0];
      if (row.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      return {
        ...row,
        subscriberContext: JSON.parse(row.subscriberContext) as SubscriberContext,
        agentResults: JSON.parse(row.agentResults),
      };
    }),

  /**
   * Return the 6 pre-built mock subscriber profiles for demo.
   * Public — no auth required for the demo grid.
   */
  mockSubscribers: protectedProcedure.query(() => {
    return MOCK_SUBSCRIBERS;
  }),
});
