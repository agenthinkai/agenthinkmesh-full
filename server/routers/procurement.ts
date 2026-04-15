/**
 * server/routers/procurement.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC procedures for the Procurement / Vendor Evaluation workflow.
 * Completely independent from dealScreener.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { vendorEvaluations } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { runProcurementCouncil, runProcurementTriage, PROCUREMENT_AGENTS } from "../procurementEngine";
import { generateProcurementPdf, generateProcurementCsv } from "../procurementPdf";

// ─── Input schema ─────────────────────────────────────────────────────────────

const ProcurementInputSchema = z.object({
  vendorName: z.string().min(1).max(255),
  proposalText: z.string().min(10),
  category: z.string().min(1).max(128),
  contractValue: z.string().optional(),
  duration: z.string().optional(),
  requirements: z.string().optional(),
  additionalContext: z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const procurementRouter = router({
  /**
   * Returns the list of procurement agents (for UI indicator).
   */
  getAgents: publicProcedure.query(() => {
    return PROCUREMENT_AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
    }));
  }),

  /**
   * Fast triage — check relevance and data quality before full evaluation.
   */
  triage: protectedProcedure
    .input(ProcurementInputSchema)
    .mutation(async ({ input }) => {
      return runProcurementTriage(input);
    }),

  /**
   * Full vendor evaluation — runs all 8 agents in parallel, builds consensus,
   * generates final Vendor Evaluation Report, and saves to DB.
   */
  screen: protectedProcedure
    .input(ProcurementInputSchema)
    .mutation(async ({ ctx, input }) => {
      const report = await runProcurementCouncil(input);

      // Save to DB
      try {
        const db = await getDb();
        if (db) {
          await db.insert(vendorEvaluations).values({
            userId: ctx.user.id,
            vendorName: report.vendorName,
            category: report.category,
            contractValue: input.contractValue ?? null,
            duration: input.duration ?? null,
            finalRecommendation: report.finalRecommendation,
            overallScore: String(report.overallScore),
            overallConfidence: report.overallConfidence,
            reportJson: JSON.stringify(report),
          });
        }
      } catch (err) {
        console.error("[Procurement] Failed to save evaluation to DB:", err);
        // Don't throw — return the report even if DB save fails
      }

      return report;
    }),

  /**
   * Get evaluation history for the current user.
   */
  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: vendorEvaluations.id,
          vendorName: vendorEvaluations.vendorName,
          category: vendorEvaluations.category,
          finalRecommendation: vendorEvaluations.finalRecommendation,
          overallScore: vendorEvaluations.overallScore,
          overallConfidence: vendorEvaluations.overallConfidence,
          createdAt: vendorEvaluations.createdAt,
        })
        .from(vendorEvaluations)
        .where(eq(vendorEvaluations.userId, ctx.user.id))
        .orderBy(desc(vendorEvaluations.createdAt))
        .limit(input.limit);

      return rows;
    }),

  /**
   * Generate a PDF for a given evaluation report JSON.
   * Returns base64-encoded PDF bytes.
   */
  generatePdf: protectedProcedure
    .input(z.object({ reportJson: z.string() }))
    .mutation(async ({ input }) => {
      const report = JSON.parse(input.reportJson);
      const pdfBuffer = await generateProcurementPdf(report);
      return { pdf: pdfBuffer.toString("base64") };
    }),

  /**
   * Generate a CSV export for a given evaluation report JSON.
   * Returns the CSV string directly.
   */
  exportCsv: protectedProcedure
    .input(z.object({ reportJson: z.string() }))
    .mutation(async ({ input }) => {
      const report = JSON.parse(input.reportJson);
      const csv = generateProcurementCsv(report);
      return { csv };
    }),

  /**
   * Get full report for a specific evaluation.
   */
  getReport: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(vendorEvaluations)
        .where(eq(vendorEvaluations.id, input.id))
        .limit(1);

      if (!row || row.userId !== ctx.user.id) return null;

      return {
        ...row,
        report: JSON.parse(row.reportJson),
      };
    }),
});
