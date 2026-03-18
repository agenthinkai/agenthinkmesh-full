/**
 * Insurance & Reinsurance Intelligence Engine — tRPC Router
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { assertWorkflowAccess } from "../billing";
import { sql } from "drizzle-orm";
import { INSURANCE_AGENTS, CHAIN_MAP, getInsuranceAgentById } from "../../shared/insuranceAgents";

export const insuranceRouter = router({

  // ── List all 10 agents ────────────────────────────────────────────────────
  listAgents: protectedProcedure.query(() => {
    return INSURANCE_AGENTS;
  }),

  // ── Get workflow chain definitions ────────────────────────────────────────
  getWorkflowChains: protectedProcedure.query(() => {
    return {
      underwriting: {
        name: "Underwriting Decision Engine",
        description: "7-agent pipeline: Intake → Takaful → Risk → Shariah → Pricing → Claims → Decision",
        chain: CHAIN_MAP.underwriting,
        agents: CHAIN_MAP.underwriting.map(id => getInsuranceAgentById(id)!).filter(Boolean),
        slaMinutes: 5,
        output: "APPROVE / REFER / DECLINE",
      },
      treaty: {
        name: "Treaty Analysis Engine",
        description: "5-agent reinsurance pipeline: Intake → Risk → Treaty → CAT Model → Cession Optimizer",
        chain: CHAIN_MAP.treaty,
        agents: CHAIN_MAP.treaty.map(id => getInsuranceAgentById(id)!).filter(Boolean),
        slaMinutes: 4,
        output: "ACCEPT / DECLINE / NEGOTIATE",
      },
      claims: {
        name: "Claims Intelligence",
        description: "4-agent claims pipeline: Intake → Risk → Claims Analyst → Decision",
        chain: CHAIN_MAP.claims,
        agents: CHAIN_MAP.claims.map(id => getInsuranceAgentById(id)!).filter(Boolean),
        slaMinutes: 3,
        output: "Pay / Investigate / Deny",
      },
      compliance: {
        name: "Takaful Compliance Scan",
        description: "3-agent Shariah scan: Intake → Takaful Classifier → Shariah Compliance",
        chain: CHAIN_MAP.compliance,
        agents: CHAIN_MAP.compliance.map(id => getInsuranceAgentById(id)!).filter(Boolean),
        slaMinutes: 2,
        output: "Compliant / Non-Compliant",
      },
      cat_model: {
        name: "CAT Model",
        description: "4-agent catastrophe model: Intake → Risk → CAT Model → Cession Optimizer",
        chain: CHAIN_MAP.cat_model,
        agents: CHAIN_MAP.cat_model.map(id => getInsuranceAgentById(id)!).filter(Boolean),
        slaMinutes: 3,
        output: "PML / Reinsurance Need",
      },
    };
  }),

  // ── Start a new insurance run ─────────────────────────────────────────────
  startRun: protectedProcedure
    .input(z.object({
      runType: z.enum(["underwriting", "claims", "treaty", "compliance", "cat_model"]),
      inputText: z.string().min(10).max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkflowAccess(ctx.user.id);

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const result = await db.execute(
        sql`INSERT INTO insurance_runs (userId, runType, status, inputSummary, createdAt)
            VALUES (${ctx.user.id}, ${input.runType}, 'pending', ${input.inputText.slice(0, 500)}, ${new Date()})`
      ) as unknown as { insertId: number };

      const runId = Number(result.insertId);

      return {
        runId,
        runType: input.runType,
        streamUrl: `/api/insurance/stream/${input.runType}/${runId}`,
      };
    }),

  // ── Get run result ────────────────────────────────────────────────────────
  getRunResult: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const runs = await db.execute(
        sql`SELECT * FROM insurance_runs WHERE id = ${input.runId} AND userId = ${ctx.user.id} LIMIT 1`
      ) as unknown as Array<{
        id: number;
        runType: string;
        status: string;
        inputSummary: string;
        blackboard: string;
        uwDecision: string;
        confidenceScore: number;
        premiumIndication: string;
        riskScore: number;
        takafulCompliant: number;
        treatyRecommendation: string;
        durationMs: number;
        createdAt: number;
        completedAt: number;
      }>;

      if (!runs.length) throw new Error("Run not found");

      const run = runs[0];
      const steps = await db.execute(
        sql`SELECT * FROM insurance_steps WHERE runId = ${input.runId} ORDER BY createdAt ASC`
      ) as unknown as Array<{
        id: number;
        agentId: string;
        agentName: string;
        status: string;
        output: string;
        tokensUsed: number;
        durationMs: number;
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
      sql`SELECT id, runType, status, uwDecision, confidenceScore, riskScore, premiumIndication,
                 takafulCompliant, treatyRecommendation, durationMs, createdAt, completedAt
          FROM insurance_runs WHERE userId = ${ctx.user.id}
          ORDER BY createdAt DESC LIMIT 50`
    ) as unknown as Array<{
      id: number;
      runType: string;
      status: string;
      uwDecision: string;
      confidenceScore: number;
      riskScore: number;
      premiumIndication: string;
      takafulCompliant: number;
      treatyRecommendation: string;
      durationMs: number;
      createdAt: number;
      completedAt: number;
    }>;

    return runs;
  }),

  // ── Get Takaful alerts ────────────────────────────────────────────────────
  getTakafulAlerts: protectedProcedure
    .input(z.object({ includeAcknowledged: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const alerts = await db.execute(
        input.includeAcknowledged
          ? sql`SELECT * FROM takaful_alerts WHERE userId = ${ctx.user.id} ORDER BY createdAt DESC LIMIT 50`
          : sql`SELECT * FROM takaful_alerts WHERE userId = ${ctx.user.id} AND isAcknowledged = 0 ORDER BY createdAt DESC LIMIT 20`
      ) as unknown as Array<{
        id: number;
        alertType: string;
        severity: string;
        title: string;
        description: string;
        recommendedAction: string;
        isAcknowledged: number;
        createdAt: number;
      }>;

      return alerts;
    }),

  // ── Acknowledge a Takaful alert ───────────────────────────────────────────
  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.execute(
        sql`UPDATE takaful_alerts SET isAcknowledged = 1, acknowledgedAt = ${new Date()}
            WHERE id = ${input.alertId} AND userId = ${ctx.user.id}`
      );

      return { success: true };
    }),
});
