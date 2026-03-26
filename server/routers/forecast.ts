/**
 * forecast.ts — tRPC router for ForecastMesh module
 * Procedures: create, list, getById, runAgents, getActivity, getTriggers, getAgents, seed
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  forecasts,
  forecastAgents,
  forecastHistory,
  forecastTriggers,
} from "../../drizzle/schema";
import { runForecastEngine, deriveStatus, type ForecastInput } from "../forecastEngine";
import { randomUUID } from "crypto";

// ─── Input Schemas ─────────────────────────────────────────────────────────────

const ForecastTypeEnum = z.enum(["deadline_risk", "budget_risk", "target_probability"]);

const CreateForecastInput = z.object({
  title: z.string().min(3).max(255),
  forecastType: ForecastTypeEnum,
  question: z.string().min(10).max(1000),
  description: z.string().max(2000).optional(),
  deadline: z.string().optional(),       // ISO date string
  threshold: z.number().optional(),
  businessArea: z.string().max(100).optional(),
  documentText: z.string().max(3000).optional(),
});

// ─── Router ────────────────────────────────────────────────────────────────────

export const forecastRouter = router({

  /**
   * Create a new forecast and immediately run the 5-agent analysis.
   */
  create: protectedProcedure
    .input(CreateForecastInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const forecastId = randomUUID();

      const engineInput: ForecastInput = {
        title: input.title,
        forecastType: input.forecastType,
        question: input.question,
        description: input.description,
        deadline: input.deadline,
        threshold: input.threshold,
        businessArea: input.businessArea,
        documentText: input.documentText,
      };

      // Run 5 agents in parallel
      const engineResult = await runForecastEngine(engineInput, undefined);
      const { consensus, triggers, status } = engineResult;

      // Persist forecast
      await db.insert(forecasts).values({
        id: forecastId,
        userId: ctx.user.id,
        title: input.title,
        forecastType: input.forecastType,
        question: input.question,
        description: input.description ?? null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        threshold: input.threshold?.toString() ?? null,
        businessArea: input.businessArea ?? null,
        currentProbability: consensus.weighted_probability.toString(),
        confidenceScore: consensus.confidence.toString(),
        status,
        agentsJson: JSON.stringify(consensus.agent_results),
        isSeeded: false,
      });

      // Persist individual agent results
      for (const agent of consensus.agent_results) {
        await db.insert(forecastAgents).values({
          id: randomUUID(),
          forecastId,
          agentName: agent.agent_name,
          agentRole: agent.agent_name,
          probabilityEstimate: agent.probability_estimate.toString(),
          confidence: agent.confidence.toString(),
          upwardForces: JSON.stringify(agent.upward_forces),
          downwardForces: JSON.stringify(agent.downward_forces),
          summary: agent.summary,
          recommendedActions: JSON.stringify(agent.recommended_actions),
        });
      }

      // Persist initial history entry
      await db.insert(forecastHistory).values({
        id: randomUUID(),
        forecastId,
        probability: consensus.weighted_probability.toString(),
        confidence: consensus.confidence.toString(),
        delta: "0.0000",
        cause: "Initial agent analysis",
        agentSource: "consensus",
        eventType: "agent_update",
        recordedAt: new Date(),
      });

      // Persist any triggers
      for (const trigger of triggers) {
        await db.insert(forecastTriggers).values({
          id: randomUUID(),
          forecastId,
          triggerType: trigger.triggerType,
          threshold: trigger.threshold?.toString() ?? null,
          description: trigger.description,
          resolved: false,
        });
      }

      return {
        forecastId,
        probability: consensus.weighted_probability,
        confidence: consensus.confidence,
        status,
        triggersCount: triggers.length,
        agentResults: consensus.agent_results,
      };
    }),

  /**
   * Re-run the 5-agent analysis on an existing forecast.
   */
  runAgents: protectedProcedure
    .input(z.object({
      forecastId: z.string().uuid(),
      documentText: z.string().max(3000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [forecast] = await db
        .select()
        .from(forecasts)
        .where(and(eq(forecasts.id, input.forecastId), eq(forecasts.userId, ctx.user.id)));

      if (!forecast) throw new TRPCError({ code: "NOT_FOUND", message: "Forecast not found" });

      const previousProbability = parseFloat(forecast.currentProbability ?? "0.5");

      const engineInput: ForecastInput = {
        title: forecast.title,
        forecastType: forecast.forecastType,
        question: forecast.question,
        description: forecast.description ?? undefined,
        deadline: forecast.deadline?.toISOString(),
        threshold: forecast.threshold ? parseFloat(forecast.threshold) : undefined,
        businessArea: forecast.businessArea ?? undefined,
        documentText: input.documentText,
      };

      const engineResult = await runForecastEngine(engineInput, previousProbability);
      const { consensus, triggers, status } = engineResult;

      const newProbability = consensus.weighted_probability;
      const delta = newProbability - previousProbability;

      // Update forecast
      await db
        .update(forecasts)
        .set({
          previousProbability: previousProbability.toString(),
          currentProbability: newProbability.toString(),
          confidenceScore: consensus.confidence.toString(),
          status,
          agentsJson: JSON.stringify(consensus.agent_results),
          updatedAt: new Date(),
        })
        .where(eq(forecasts.id, input.forecastId));

      // Delete old agent rows and insert fresh ones
      await db.delete(forecastAgents).where(eq(forecastAgents.forecastId, input.forecastId));
      for (const agent of consensus.agent_results) {
        await db.insert(forecastAgents).values({
          id: randomUUID(),
          forecastId: input.forecastId,
          agentName: agent.agent_name,
          agentRole: agent.agent_name,
          probabilityEstimate: agent.probability_estimate.toString(),
          confidence: agent.confidence.toString(),
          upwardForces: JSON.stringify(agent.upward_forces),
          downwardForces: JSON.stringify(agent.downward_forces),
          summary: agent.summary,
          recommendedActions: JSON.stringify(agent.recommended_actions),
        });
      }

      // Append history entry
      await db.insert(forecastHistory).values({
        id: randomUUID(),
        forecastId: input.forecastId,
        probability: newProbability.toString(),
        confidence: consensus.confidence.toString(),
        delta: delta.toFixed(4),
        cause: "Agent re-analysis",
        agentSource: "consensus",
        eventType: "agent_update",
        recordedAt: new Date(),
      });

      // Persist new triggers
      for (const trigger of triggers) {
        await db.insert(forecastTriggers).values({
          id: randomUUID(),
          forecastId: input.forecastId,
          triggerType: trigger.triggerType,
          threshold: trigger.threshold?.toString() ?? null,
          description: trigger.description,
          resolved: false,
        });
      }

      return {
        forecastId: input.forecastId,
        probability: newProbability,
        previousProbability,
        delta,
        confidence: consensus.confidence,
        status,
        triggersCount: triggers.length,
        agentResults: consensus.agent_results,
      };
    }),

  /**
   * List all forecasts for the authenticated user.
   */
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      type: ForecastTypeEnum.optional(),
      demo: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Allow unauthenticated reads in demo mode
      const isDemo =
        input?.demo === true ||
        (ctx.req as any)?.headers?.['x-demo-mode'] === 'true' ||
        ((ctx.req as any)?.headers?.referer ?? '').includes('demo=true');

      if (!isDemo && !ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Login required" });
      }

      // In demo mode, return all seeded scenarios; otherwise scope to user
      const rows = await db
        .select()
        .from(forecasts)
        .where(isDemo ? undefined : eq(forecasts.userId, ctx.user!.id))
        .orderBy(desc(forecasts.updatedAt))
        .limit(input?.limit ?? 50);

      return rows.map(f => ({
        ...f,
        currentProbability: parseFloat(f.currentProbability ?? "0.5"),
        previousProbability: f.previousProbability ? parseFloat(f.previousProbability) : null,
        confidenceScore: parseFloat(f.confidenceScore ?? "0.5"),
        threshold: f.threshold ? parseFloat(f.threshold) : null,
      }));
    }),

  /**
   * Get a single forecast with its latest agent results.
   */
  getById: protectedProcedure
    .input(z.object({ forecastId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [forecast] = await db
        .select()
        .from(forecasts)
        .where(and(eq(forecasts.id, input.forecastId), eq(forecasts.userId, ctx.user.id)));

      if (!forecast) throw new TRPCError({ code: "NOT_FOUND", message: "Forecast not found" });

      const agents = await db
        .select()
        .from(forecastAgents)
        .where(eq(forecastAgents.forecastId, input.forecastId))
        .orderBy(desc(forecastAgents.createdAt));

      const triggers = await db
        .select()
        .from(forecastTriggers)
        .where(eq(forecastTriggers.forecastId, input.forecastId))
        .orderBy(desc(forecastTriggers.firedAt))
        .limit(20);

      return {
        ...forecast,
        currentProbability: parseFloat(forecast.currentProbability ?? "0.5"),
        previousProbability: forecast.previousProbability ? parseFloat(forecast.previousProbability) : null,
        confidenceScore: parseFloat(forecast.confidenceScore ?? "0.5"),
        threshold: forecast.threshold ? parseFloat(forecast.threshold) : null,
        agents: agents.map(a => ({
          ...a,
          probabilityEstimate: parseFloat(a.probabilityEstimate ?? "0.5"),
          confidence: parseFloat(a.confidence ?? "0.5"),
          upwardForces: JSON.parse(a.upwardForces || "[]") as string[],
          downwardForces: JSON.parse(a.downwardForces || "[]") as string[],
          recommendedActions: JSON.parse(a.recommendedActions || "[]") as string[],
        })),
        triggers,
      };
    }),

  /**
   * Get probability history for a forecast (for Recharts).
   */
  getActivity: protectedProcedure
    .input(z.object({
      forecastId: z.string(),
      limit: z.number().min(1).max(200).default(90),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify ownership
      const [forecast] = await db
        .select({ id: forecasts.id, title: forecasts.title })
        .from(forecasts)
        .where(and(eq(forecasts.id, input.forecastId), eq(forecasts.userId, ctx.user.id)));

      if (!forecast) throw new TRPCError({ code: "NOT_FOUND", message: "Forecast not found" });

      const history = await db
        .select()
        .from(forecastHistory)
        .where(eq(forecastHistory.forecastId, input.forecastId))
        .orderBy(forecastHistory.recordedAt)
        .limit(input.limit);

      return {
        forecastId: input.forecastId,
        title: forecast.title,
        history: history.map(h => ({
          ...h,
          probability: parseFloat(h.probability ?? "0.5"),
          confidence: parseFloat(h.confidence ?? "0.5"),
          delta: parseFloat(h.delta ?? "0"),
          recordedAt: h.recordedAt,
        })),
      };
    }),

  /**
   * Get triggers for a forecast.
   */
  getTriggers: protectedProcedure
    .input(z.object({ forecastId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [forecast] = await db
        .select({ id: forecasts.id })
        .from(forecasts)
        .where(and(eq(forecasts.id, input.forecastId), eq(forecasts.userId, ctx.user.id)));

      if (!forecast) throw new TRPCError({ code: "NOT_FOUND", message: "Forecast not found" });

      const triggers = await db
        .select()
        .from(forecastTriggers)
        .where(eq(forecastTriggers.forecastId, input.forecastId))
        .orderBy(desc(forecastTriggers.firedAt));

      return triggers;
    }),

  /**
   * Resolve a trigger.
   */
  resolveTrigger: protectedProcedure
    .input(z.object({ triggerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .update(forecastTriggers)
        .set({ resolved: true, resolvedAt: new Date() })
        .where(eq(forecastTriggers.id, input.triggerId));

      return { success: true };
    }),

  /**
   * Get dashboard stats for the authenticated user.
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const allForecasts = await db
      .select()
      .from(forecasts)
      .where(eq(forecasts.userId, ctx.user.id));

    const total = allForecasts.length;
    const byStatus = {
      on_track: allForecasts.filter(f => f.status === "on_track").length,
      watchlist: allForecasts.filter(f => f.status === "watchlist").length,
      at_risk: allForecasts.filter(f => f.status === "at_risk").length,
      critical: allForecasts.filter(f => f.status === "critical").length,
      resolved: allForecasts.filter(f => f.status === "resolved").length,
    };

    const avgProbability = total > 0
      ? allForecasts.reduce((s, f) => s + parseFloat(f.currentProbability ?? "0.5"), 0) / total
      : 0.5;

    const unresolved = await db
      .select()
      .from(forecastTriggers)
      .where(eq(forecastTriggers.resolved, false));

    const unresolvedTriggers = unresolved.filter(t =>
      allForecasts.some(f => f.id === t.forecastId)
    ).length;

    return { total, byStatus, avgProbability, unresolvedTriggers };
  }),
});
