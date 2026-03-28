/**
 * selfLearning.ts — tRPC router for the Self-Learning Loop dashboard
 *
 * Exposes:
 *   selfLearning.agentWeights      — current weight leaderboard
 *   selfLearning.decisionHistory   — paginated decision memory
 *   selfLearning.decisionDetail    — single decision with votes + outcome
 *   selfLearning.triggerOutcomes   — manually trigger outcome collection (admin)
 *   selfLearning.triggerCritic     — manually trigger critic agent (admin)
 *   selfLearning.stats             — summary stats for the dashboard
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  agentWeights,
  agentVotesLog,
  decisionMemory,
  decisionOutcomes,
} from "../../drizzle/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { runOutcomeCollection } from "../jobs/outcomeCollector";
import { runCriticAgent } from "../jobs/criticAgent";

export const selfLearningRouter = router({
  // ── Agent weight leaderboard ────────────────────────────────────────────────
  agentWeights: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const rows = await db
      .select({
        personaId: agentWeights.personaId,
        weight: agentWeights.weight,
        totalEvaluations: agentWeights.totalEvaluations,
        correctPredictions: agentWeights.correctPredictions,
        lastEvaluatedAt: agentWeights.lastEvaluatedAt,
        updatedAt: agentWeights.updatedAt,
      })
      .from(agentWeights)
      .orderBy(desc(agentWeights.weight));

    return rows.map((r) => ({
      personaId: r.personaId,
      weight: parseFloat(String(r.weight)),
      totalEvaluations: r.totalEvaluations ?? 0,
      correctPredictions: r.correctPredictions ?? 0,
      accuracyRate:
        (r.totalEvaluations ?? 0) > 0
          ? Math.round(((r.correctPredictions ?? 0) / (r.totalEvaluations ?? 1)) * 1000) / 10
          : null,
      lastEvaluatedAt: r.lastEvaluatedAt,
      updatedAt: r.updatedAt,
    }));
  }),

  // ── Decision memory history ─────────────────────────────────────────────────
  decisionHistory: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
        domain: z.string().optional(),
        verdict: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.pageSize;
      const conditions = [];
      if (input.domain) conditions.push(sql`${decisionMemory.taskDomain} = ${input.domain}`);
      if (input.verdict) conditions.push(sql`${decisionMemory.finalVerdict} = ${input.verdict}`);
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db
          .select({
            id: decisionMemory.id,
            taskId: decisionMemory.taskId,
            taskDomain: decisionMemory.taskDomain,
            finalVerdict: decisionMemory.finalVerdict,
            confidenceScore: decisionMemory.confidenceScore,
            createdAt: decisionMemory.createdAt,
            taskDescription: sql<string>`SUBSTRING(${decisionMemory.taskDescription}, 1, 200)`,
          })
          .from(decisionMemory)
          .where(whereClause)
          .orderBy(desc(decisionMemory.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(decisionMemory)
          .where(whereClause),
      ]);

      return {
        decisions: rows.map((r) => ({
          ...r,
          confidenceScore: r.confidenceScore ? parseFloat(String(r.confidenceScore)) : null,
        })),
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ── Single decision detail with votes + outcome ─────────────────────────────
  decisionDetail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [memRows, voteRows, outcomeRows] = await Promise.all([
        db
          .select()
          .from(decisionMemory)
          .where(eq(decisionMemory.id, input.id)),
        db
          .select({
            id: agentVotesLog.id,
            personaId: agentVotesLog.personaId,
            personaName: agentVotesLog.personaName,
            vote: agentVotesLog.vote,
            confidence: agentVotesLog.confidence,
            rationale: agentVotesLog.rationale,
            wasCorrect: agentVotesLog.wasCorrect,
            scoredAt: agentVotesLog.scoredAt,
          })
          .from(agentVotesLog)
          .where(eq(agentVotesLog.decisionMemoryId, input.id))
          .orderBy(agentVotesLog.personaId),
        db
          .select()
          .from(decisionOutcomes)
          .where(eq(decisionOutcomes.decisionMemoryId, input.id))
          .orderBy(desc(decisionOutcomes.outcomeRecordedAt)),
      ]);

      if (memRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Decision not found" });
      }

      const mem = memRows[0];
      return {
        id: mem.id,
        taskId: mem.taskId,
        taskDescription: mem.taskDescription,
        taskDomain: mem.taskDomain,
        finalVerdict: mem.finalVerdict,
        confidenceScore: mem.confidenceScore ? parseFloat(String(mem.confidenceScore)) : null,
        createdAt: mem.createdAt,
        votes: voteRows.map((v) => ({
          ...v,
          confidence: v.confidence ? parseFloat(String(v.confidence)) : null,
        })),
        outcomes: outcomeRows,
      };
    }),

  // ── Dashboard summary stats ─────────────────────────────────────────────────
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [
      totalDecisions,
      verdictBreakdown,
      outcomeBreakdown,
      weightStats,
      recentActivity,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(decisionMemory),
      db
        .select({ verdict: decisionMemory.finalVerdict, count: sql<number>`COUNT(*)` })
        .from(decisionMemory)
        .groupBy(decisionMemory.finalVerdict),
      db
        .select({ verdict: decisionOutcomes.outcomeVerdict, count: sql<number>`COUNT(*)` })
        .from(decisionOutcomes)
        .groupBy(decisionOutcomes.outcomeVerdict),
      db
        .select({
          avgWeight: sql<number>`AVG(CAST(${agentWeights.weight} AS DECIMAL(4,2)))`,
          minWeight: sql<number>`MIN(CAST(${agentWeights.weight} AS DECIMAL(4,2)))`,
          maxWeight: sql<number>`MAX(CAST(${agentWeights.weight} AS DECIMAL(4,2)))`,
        })
        .from(agentWeights),
      db
        .select({
          id: decisionMemory.id,
          taskDomain: decisionMemory.taskDomain,
          finalVerdict: decisionMemory.finalVerdict,
          createdAt: decisionMemory.createdAt,
          taskDescription: sql<string>`SUBSTRING(${decisionMemory.taskDescription}, 1, 100)`,
        })
        .from(decisionMemory)
        .orderBy(desc(decisionMemory.createdAt))
        .limit(5),
    ]);

    const correctCount = outcomeBreakdown.find((o) => o.verdict === "CORRECT")?.count ?? 0;
    const incorrectCount = outcomeBreakdown.find((o) => o.verdict === "INCORRECT")?.count ?? 0;
    const totalScored = Number(correctCount) + Number(incorrectCount);
    const overallAccuracy = totalScored > 0
      ? Math.round((Number(correctCount) / totalScored) * 1000) / 10
      : null;

    return {
      totalDecisions: Number(totalDecisions[0]?.count ?? 0),
      verdictBreakdown: verdictBreakdown.map((v) => ({
        verdict: v.verdict,
        count: Number(v.count),
      })),
      outcomeBreakdown: outcomeBreakdown.map((o) => ({
        verdict: o.verdict,
        count: Number(o.count),
      })),
      overallAccuracy,
      totalScored,
      weightStats: {
        avg: weightStats[0]?.avgWeight ? parseFloat(String(weightStats[0].avgWeight)) : null,
        min: weightStats[0]?.minWeight ? parseFloat(String(weightStats[0].minWeight)) : null,
        max: weightStats[0]?.maxWeight ? parseFloat(String(weightStats[0].maxWeight)) : null,
      },
      recentActivity,
    };
  }),

  // ── Manual trigger: outcome collection (admin only) ─────────────────────────
  triggerOutcomes: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    // Fire and forget — returns immediately
    runOutcomeCollection().catch((err) =>
      console.error("[selfLearning.triggerOutcomes] Error:", err)
    );
    return { triggered: true, message: "Outcome collection started in background" };
  }),

  // ── Manual trigger: critic agent (admin only) ───────────────────────────────
  triggerCritic: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }
    runCriticAgent().catch((err) =>
      console.error("[selfLearning.triggerCritic] Error:", err)
    );
    return { triggered: true, message: "Critic agent started in background" };
  }),
});
