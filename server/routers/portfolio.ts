/**
 * Portfolio Intelligence Engine — tRPC Router
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { assertWorkflowAccess } from "../billing";
import { sql } from "drizzle-orm";
import { PORTFOLIO_AGENTS, IC_DECISION_CHAIN, CRISIS_SIMULATION_CHAIN, GUARDIAN_TRIGGER_CHAIN } from "../../shared/portfolioAgents";

export const portfolioRouter = router({

  // ── List all 12 agents ────────────────────────────────────────────────────
  listAgents: protectedProcedure.query(() => {
    return PORTFOLIO_AGENTS;
  }),

  // ── Start a new portfolio run ─────────────────────────────────────────────
  startRun: protectedProcedure
    .input(z.object({
      runType: z.enum(["ic_decision", "guardian", "crisis"]),
      inputText: z.string().min(10).max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkflowAccess(ctx.user.id);

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const now = Date.now();
      const result = await db.execute(
        sql`INSERT INTO portfolio_runs (user_id, run_type, status, input_summary, created_at)
            VALUES (${ctx.user.id}, ${input.runType}, 'pending', ${input.inputText.slice(0, 500)}, ${now})`
      ) as unknown as { insertId: number };

      const runId = result.insertId || Number((result as { insertId?: unknown }).insertId);

      return {
        runId,
        runType: input.runType,
        streamUrl: `/api/portfolio/stream/${input.runType}/${runId}`,
      };
    }),

  // ── Get run status and result ─────────────────────────────────────────────
  getRunResult: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const runs = await db.execute(
        sql`SELECT * FROM portfolio_runs WHERE id = ${input.runId} AND user_id = ${ctx.user.id} LIMIT 1`
      ) as unknown as Array<{
        id: number;
        run_type: string;
        status: string;
        input_summary: string;
        blackboard: string;
        ic_decision: string;
        confidence_score: number;
        threat_level: string;
        total_tokens: number;
        duration_ms: number;
        created_at: number;
        completed_at: number;
      }>;

      if (!runs.length) throw new Error("Run not found");

      const run = runs[0];
      const steps = await db.execute(
        sql`SELECT * FROM portfolio_steps WHERE run_id = ${input.runId} ORDER BY created_at ASC`
      ) as unknown as Array<{
        id: number;
        agent_id: string;
        agent_name: string;
        status: string;
        output: string;
        tokens_used: number;
        duration_ms: number;
      }>;

      return {
        ...run,
        blackboard: run.blackboard ? JSON.parse(run.blackboard) : null,
        steps: steps.map(s => ({
          ...s,
          output: s.output ? JSON.parse(s.output as unknown as string) : null,
        })),
      };
    }),

  // ── List all runs for the user ────────────────────────────────────────────
  listRuns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const runs = await db.execute(
      sql`SELECT id, run_type, status, ic_decision, confidence_score, threat_level, duration_ms, created_at, completed_at
          FROM portfolio_runs WHERE user_id = ${ctx.user.id}
          ORDER BY created_at DESC LIMIT 50`
    ) as unknown as Array<{
      id: number;
      run_type: string;
      status: string;
      ic_decision: string;
      confidence_score: number;
      threat_level: string;
      duration_ms: number;
      created_at: number;
      completed_at: number;
    }>;

    return runs;
  }),

  // ── Guardian: get active alerts ───────────────────────────────────────────
  getGuardianAlerts: protectedProcedure
    .input(z.object({ includeAcknowledged: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const alerts = await db.execute(
        input.includeAcknowledged
          ? sql`SELECT * FROM guardian_alerts WHERE user_id = ${ctx.user.id} ORDER BY created_at DESC LIMIT 50`
          : sql`SELECT * FROM guardian_alerts WHERE user_id = ${ctx.user.id} AND is_acknowledged = 0 ORDER BY created_at DESC LIMIT 20`
      ) as unknown as Array<{
        id: number;
        alert_type: string;
        threat_level: string;
        title: string;
        description: string;
        recommended_action: string;
        is_acknowledged: number;
        created_at: number;
      }>;

      return alerts;
    }),

  // ── Guardian: acknowledge an alert ───────────────────────────────────────
  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.execute(
        sql`UPDATE guardian_alerts SET is_acknowledged = 1, acknowledged_at = ${Date.now()}
            WHERE id = ${input.alertId} AND user_id = ${ctx.user.id}`
      );

      return { success: true };
    }),

  // ── Get workflow chain definitions ────────────────────────────────────────
  getWorkflowChains: protectedProcedure.query(() => {
    return {
      ic_decision: {
        name: "IC Decision Engine",
        description: "8-agent sequential pipeline: Intake → Risk → Performance → Decision",
        chain: IC_DECISION_CHAIN,
        agents: IC_DECISION_CHAIN.map(id => PORTFOLIO_AGENTS.find(a => a.id === id)!).filter(Boolean),
        slaMinutes: 5,
      },
      guardian: {
        name: "Guardian Mode",
        description: "3-agent monitoring scan: Risk → Exposure → Action",
        chain: GUARDIAN_TRIGGER_CHAIN,
        agents: GUARDIAN_TRIGGER_CHAIN.map(id => PORTFOLIO_AGENTS.find(a => a.id === id)!).filter(Boolean),
        slaMinutes: 2,
      },
      crisis: {
        name: "Crisis Simulation",
        description: "4-agent stress test: Risk → Exposure → Performance → Action",
        chain: CRISIS_SIMULATION_CHAIN,
        agents: CRISIS_SIMULATION_CHAIN.map(id => PORTFOLIO_AGENTS.find(a => a.id === id)!).filter(Boolean),
        slaMinutes: 3,
      },
    };
  }),
});
