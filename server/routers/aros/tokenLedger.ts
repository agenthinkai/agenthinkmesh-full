/**
 * aros/tokenLedger.ts — Token Accounting & ROI
 *
 * Tracks all token consumption per workflow, computes:
 *  - Cost per opportunity
 *  - Cost per meeting
 *  - Cost per proposal
 *  - Token ROI (revenue / cost)
 */

import { z } from "zod";
import { desc, eq, sql, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosTokenLedger,
  arosCompanies,
  arosPipeline,
} from "../../../drizzle/schema";

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

export const arosTokenLedgerRouter = router({

  // ── Get overall token economics ────────────────────────────────────────────
  getEconomics: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Total tokens and cost by workflow
      const byWorkflow = await db
        .select({
          workflow: arosTokenLedger.workflow,
          totalTokens: sql<number>`sum(total_tokens)`,
          totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
          count: sql<number>`count(*)`,
        })
        .from(arosTokenLedger)
        .groupBy(arosTokenLedger.workflow);

      // Pipeline counts for ROI computation
      const [pipelineStats] = await db.select({
        totalCompanies: sql<number>`count(*)`,
        outreachSent: sql<number>`sum(case when stage != 'RESEARCHED' then 1 else 0 end)`,
        responses: sql<number>`sum(case when stage in ('RESPONSE_RECEIVED','MEETING_BOOKED','PROPOSAL_SENT','CUSTOMER') then 1 else 0 end)`,
        meetings: sql<number>`sum(case when stage in ('MEETING_BOOKED','PROPOSAL_SENT','CUSTOMER') then 1 else 0 end)`,
        proposals: sql<number>`sum(case when stage in ('PROPOSAL_SENT','CUSTOMER') then 1 else 0 end)`,
        customers: sql<number>`sum(case when stage = 'CUSTOMER' then 1 else 0 end)`,
        totalRevenue: sql<number>`sum(case when stage = 'CUSTOMER' then deal_value_usd else 0 end)`,
      }).from(arosPipeline);

      const [totals] = await db.select({
        totalTokens: sql<number>`sum(total_tokens)`,
        totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
      }).from(arosTokenLedger);

      const totalCostUsd = Number(totals?.totalCost ?? 0);
      const totalTokens = Number(totals?.totalTokens ?? 0);
      const companies = Number(pipelineStats?.totalCompanies ?? 0);
      const outreach = Number(pipelineStats?.outreachSent ?? 0);
      const meetings = Number(pipelineStats?.meetings ?? 0);
      const proposals = Number(pipelineStats?.proposals ?? 0);
      const customers = Number(pipelineStats?.customers ?? 0);
      const revenue = Number(pipelineStats?.totalRevenue ?? 0);

      return {
        totalTokens,
        totalCostUsd,
        byWorkflow: byWorkflow.map(w => ({
          workflow: w.workflow,
          totalTokens: Number(w.totalTokens ?? 0),
          totalCost: Number(w.totalCost ?? 0),
          count: Number(w.count),
        })),
        costPerOpportunity: companies > 0 ? totalCostUsd / companies : 0,
        costPerOutreach: outreach > 0 ? totalCostUsd / outreach : 0,
        costPerMeeting: meetings > 0 ? totalCostUsd / meetings : 0,
        costPerProposal: proposals > 0 ? totalCostUsd / proposals : 0,
        costPerCustomer: customers > 0 ? totalCostUsd / customers : 0,
        tokenRoi: totalCostUsd > 0 ? revenue / totalCostUsd : 0,
        revenueGeneratedUsd: revenue,
        pipelineSummary: {
          companies,
          outreach,
          responses: Number(pipelineStats?.responses ?? 0),
          meetings,
          proposals,
          customers,
        },
      };
    }),

  // ── Get token usage over time ──────────────────────────────────────────────
  getUsageHistory: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const cutoff = Date.now() - input.days * 86400000;

      const rows = await db
        .select({
          date: sql<string>`DATE(FROM_UNIXTIME(created_at / 1000))`,
          totalTokens: sql<number>`sum(total_tokens)`,
          totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
          count: sql<number>`count(*)`,
        })
        .from(arosTokenLedger)
        .where(gte(arosTokenLedger.createdAt, cutoff))
        .groupBy(sql`DATE(FROM_UNIXTIME(created_at / 1000))`)
        .orderBy(sql`DATE(FROM_UNIXTIME(created_at / 1000))`);

      return rows.map(r => ({
        date: r.date,
        totalTokens: Number(r.totalTokens ?? 0),
        totalCost: Number(r.totalCost ?? 0),
        count: Number(r.count),
      }));
    }),

  // ── Get per-company token costs ────────────────────────────────────────────
  getPerCompanyCosts: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select({
          companyId: arosTokenLedger.companyId,
          companyName: arosCompanies.companyName,
          sector: arosCompanies.sector,
          totalTokens: sql<number>`sum(${arosTokenLedger.totalTokens})`,
          totalCost: sql<number>`sum(CAST(${arosTokenLedger.costUsd} AS DECIMAL(20,8)))`,
          workflowCount: sql<number>`count(*)`,
        })
        .from(arosTokenLedger)
        .innerJoin(arosCompanies, eq(arosTokenLedger.companyId, arosCompanies.id))
        .groupBy(arosTokenLedger.companyId, arosCompanies.companyName, arosCompanies.sector)
        .orderBy(desc(sql`sum(CAST(${arosTokenLedger.costUsd} AS DECIMAL(20,8)))`))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map(r => ({
        companyId: r.companyId,
        companyName: r.companyName,
        sector: r.sector,
        totalTokens: Number(r.totalTokens ?? 0),
        totalCost: Number(r.totalCost ?? 0),
        workflowCount: Number(r.workflowCount),
      }));
    }),

  // ── Get cost aggregated by workflow ─────────────────────────────────────────
  getByWorkflow: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select({
          workflow: arosTokenLedger.workflow,
          runs: sql<number>`count(*)`,
          totalTokens: sql<number>`sum(total_tokens)`,
          totalCost: sql<number>`sum(CAST(cost_usd AS DECIMAL(20,8)))`,
        })
        .from(arosTokenLedger)
        .groupBy(arosTokenLedger.workflow)
        .orderBy(desc(sql`sum(CAST(cost_usd AS DECIMAL(20,8)))`));

      return rows.map(r => ({
        workflow: r.workflow,
        runs: Number(r.runs),
        totalTokens: Number(r.totalTokens ?? 0),
        totalCost: Number(r.totalCost ?? 0),
      }));
    }),

  // ── List raw ledger entries ────────────────────────────────────────────────
  listEntries: protectedProcedure
    .input(z.object({
      workflow: z.string().optional(),
      companyId: z.number().optional(),
      runId: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const conditions = [];
      if (input.workflow) conditions.push(eq(arosTokenLedger.workflow, input.workflow as any));
      if (input.companyId) conditions.push(eq(arosTokenLedger.companyId, input.companyId));
      if (input.runId) conditions.push(eq(arosTokenLedger.runId, input.runId));

      const rows = await db
        .select()
        .from(arosTokenLedger)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(arosTokenLedger.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),
});
