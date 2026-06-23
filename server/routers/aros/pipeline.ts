/**
 * aros/pipeline.ts — Revenue Loop Tracker
 *
 * Tracks every company through the revenue loop:
 *  RESEARCHED → OUTREACH_SENT → RESPONSE_RECEIVED → MEETING_BOOKED
 *  → PROPOSAL_SENT → NEGOTIATION → CUSTOMER → LOST
 *
 * Measures conversion at every stage.
 */

import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosPipeline,
  arosCompanies,
  arosOutreachQueue,
  arosAuditLog,
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

const PIPELINE_STAGES = [
  "RESEARCHED",
  "OUTREACH_SENT",
  "RESPONSE_RECEIVED",
  "MEETING_BOOKED",
  "MEETING_HELD",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CUSTOMER",
  "CHURNED",
  "DISQUALIFIED",
] as const;

type PipelineStage = typeof PIPELINE_STAGES[number];

const STAGE_TIMESTAMP_MAP: Partial<Record<PipelineStage, string>> = {
  RESEARCHED: "researchedAt",
  OUTREACH_SENT: "outreachSentAt",
  RESPONSE_RECEIVED: "responseReceivedAt",
  MEETING_BOOKED: "meetingBookedAt",
  PROPOSAL_SENT: "proposalSentAt",
  NEGOTIATION: "negotiationStartedAt",
  CUSTOMER: "customerAt",
};

export const arosPipelineRouter = router({

  // ── Get pipeline overview (Kanban data) ────────────────────────────────────
  getKanban: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select({
          pipeline: arosPipeline,
          company: {
            id: arosCompanies.id,
            companyName: arosCompanies.companyName,
            sector: arosCompanies.sector,
            country: arosCompanies.country,
            ceoName: arosCompanies.ceoName,
            opportunityScore: arosCompanies.opportunityScore,
          },
        })
        .from(arosPipeline)
        .innerJoin(arosCompanies, eq(arosPipeline.companyId, arosCompanies.id))
        .orderBy(desc(arosCompanies.opportunityScore));

      // Group by stage
      const kanban: Record<string, typeof rows> = {};
      for (const stage of PIPELINE_STAGES) kanban[stage] = [];
      for (const row of rows) kanban[row.pipeline.stage]?.push(row);

      return kanban;
    }),

  // ── Get pipeline stats (conversion funnel) ─────────────────────────────────
  getConversionFunnel: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const stageCounts = await db
        .select({
          stage: arosPipeline.stage,
          count: sql<number>`count(*)`,
          totalDealValue: sql<number>`sum(deal_value_usd)`,
        })
        .from(arosPipeline)
        .groupBy(arosPipeline.stage);

      const countMap: Record<string, { count: number; totalDealValue: number }> = {};
      for (const s of stageCounts) {
        countMap[s.stage] = { count: Number(s.count), totalDealValue: Number(s.totalDealValue ?? 0) };
      }

      const researched = countMap["RESEARCHED"]?.count ?? 0;
      const outreachSent = countMap["OUTREACH_SENT"]?.count ?? 0;
      const responses = countMap["RESPONSE_RECEIVED"]?.count ?? 0;
      const meetings = (countMap["MEETING_BOOKED"]?.count ?? 0) + (countMap["MEETING_HELD"]?.count ?? 0);
      const proposals = countMap["PROPOSAL_SENT"]?.count ?? 0;
      const customers = countMap["CUSTOMER"]?.count ?? 0;

      const totalInPipeline = Object.values(countMap).reduce((sum, v) => sum + v.count, 0);

      return {
        stages: PIPELINE_STAGES.map(stage => ({
          stage,
          count: countMap[stage]?.count ?? 0,
          totalDealValue: countMap[stage]?.totalDealValue ?? 0,
        })),
        conversionRates: {
          researchToOutreach: researched > 0 ? (outreachSent / researched) * 100 : 0,
          outreachToResponse: outreachSent > 0 ? (responses / outreachSent) * 100 : 0,
          responseToMeeting: responses > 0 ? (meetings / responses) * 100 : 0,
          meetingToProposal: meetings > 0 ? (proposals / meetings) * 100 : 0,
          proposalToCustomer: proposals > 0 ? (customers / proposals) * 100 : 0,
          overallConversion: totalInPipeline > 0 ? (customers / totalInPipeline) * 100 : 0,
        },
        totalPipelineValue: Object.values(countMap).reduce((sum, v) => sum + v.totalDealValue, 0),
        customerRevenue: countMap["CUSTOMER"]?.totalDealValue ?? 0,
      };
    }),

  // ── Advance pipeline stage ─────────────────────────────────────────────────
  advanceStage: protectedProcedure
    .input(z.object({
      pipelineId: z.number(),
      newStage: z.enum(PIPELINE_STAGES),
      notes: z.string().optional(),
      dealValueUsd: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [entry] = await db
        .select()
        .from(arosPipeline)
        .where(eq(arosPipeline.id, input.pipelineId))
        .limit(1);
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      const now = Date.now();
      const updates: Record<string, unknown> = {
        stage: input.newStage,
        updatedAt: now,
      };

      // Set the stage-specific timestamp
      const tsField = STAGE_TIMESTAMP_MAP[input.newStage as PipelineStage];
      if (tsField) updates[tsField] = now;
      if (input.notes) updates.notes = input.notes;
      if (input.dealValueUsd !== undefined) updates.dealValueUsd = input.dealValueUsd;

      await db.update(arosPipeline)
        .set(updates as any)
        .where(eq(arosPipeline.id, input.pipelineId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: `pipeline.stage.advanced`,
        entityType: "aros_pipeline",
        entityId: String(input.pipelineId),
        payload: JSON.stringify({ from: entry.stage, to: input.newStage, notes: input.notes }),
      });

      return { success: true, newStage: input.newStage };
    }),

  // ── Create pipeline entry manually ────────────────────────────────────────
  createEntry: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      dealValueUsd: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [existing] = await db
        .select({ id: arosPipeline.id })
        .from(arosPipeline)
        .where(eq(arosPipeline.companyId, input.companyId))
        .limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Pipeline entry already exists" });

      const [inserted] = await db.insert(arosPipeline).values({
        companyId: input.companyId,
        stage: "RESEARCHED",
        dealValueUsd: input.dealValueUsd ?? 25000,
        notes: input.notes ?? null,
        researchedAt: Date.now(),
      }).$returningId();

      return { id: inserted?.id };
    }),

  // ── Get pipeline entry for a company ──────────────────────────────────────
  getByCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [entry] = await db
        .select({
          pipeline: arosPipeline,
          company: arosCompanies,
        })
        .from(arosPipeline)
        .innerJoin(arosCompanies, eq(arosPipeline.companyId, arosCompanies.id))
        .where(eq(arosPipeline.companyId, input.companyId))
        .limit(1);

      return entry ?? null;
    }),

  // ── List all pipeline entries ──────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      stage: z.enum(PIPELINE_STAGES).optional(),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const rows = await db
        .select({
          pipeline: arosPipeline,
          company: {
            id: arosCompanies.id,
            companyName: arosCompanies.companyName,
            sector: arosCompanies.sector,
            country: arosCompanies.country,
            ceoName: arosCompanies.ceoName,
            opportunityScore: arosCompanies.opportunityScore,
          },
        })
        .from(arosPipeline)
        .innerJoin(arosCompanies, eq(arosPipeline.companyId, arosCompanies.id))
        .where(input.stage ? eq(arosPipeline.stage, input.stage) : undefined)
        .orderBy(desc(arosPipeline.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  // ── Mark as disqualified ──────────────────────────────────────────────────
  markDisqualified: protectedProcedure
    .input(z.object({
      pipelineId: z.number(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      await db.update(arosPipeline)
        .set({
          stage: "DISQUALIFIED",
          notes: input.reason,
          updatedAt: Date.now(),
        })
        .where(eq(arosPipeline.id, input.pipelineId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "pipeline.disqualified",
        entityType: "aros_pipeline",
        entityId: String(input.pipelineId),
        payload: JSON.stringify({ reason: input.reason }),
      });

      return { success: true };
    }),
});
