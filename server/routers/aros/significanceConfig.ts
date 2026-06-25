/**
 * significanceConfig.ts — Strategic Significance Engine Configuration Router
 *
 * Exposes tRPC procedures to read and update the significance thresholds,
 * retrieve score distributions, and summarise the Decision Hierarchy.
 */

import { z } from "zod";
import { eq, sql, and, gte, lt, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { atlasSignificanceConfig, arosCompanies } from "../../../drizzle/schema";

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

export const significanceConfigRouter = router({

  // ── Get active config ─────────────────────────────────────────────────────
  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const [cfg] = await db.select().from(atlasSignificanceConfig).where(eq(atlasSignificanceConfig.id, 1)).limit(1);
      if (!cfg) {
        // Return defaults if no config row exists
        return {
          id: 1,
          briefGenerationThreshold: 90,
          autoRejectBelow: 40,
          notifyOnLevel4: 1,
          weightEconomicImpact: 25,
          weightIrreversibility: 20,
          weightTimeCriticality: 15,
          weightHiddenVariableStrength: 20,
          weightExecutiveRelevance: 10,
          weightNovelty: 10,
          updatedAt: Date.now(),
          updatedBy: null,
        };
      }
      return cfg;
    }),

  // ── Update threshold and weights ──────────────────────────────────────────
  updateConfig: protectedProcedure
    .input(z.object({
      briefGenerationThreshold: z.number().min(0).max(100).optional(),
      autoRejectBelow: z.number().min(0).max(100).optional(),
      notifyOnLevel4: z.number().min(0).max(1).optional(),
      weightEconomicImpact: z.number().min(0).max(100).optional(),
      weightIrreversibility: z.number().min(0).max(100).optional(),
      weightTimeCriticality: z.number().min(0).max(100).optional(),
      weightHiddenVariableStrength: z.number().min(0).max(100).optional(),
      weightExecutiveRelevance: z.number().min(0).max(100).optional(),
      weightNovelty: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const updates: Record<string, unknown> = {
        updatedAt: Date.now(),
        updatedBy: String(ctx.user.id),
      };
      if (input.briefGenerationThreshold !== undefined) updates.briefGenerationThreshold = input.briefGenerationThreshold;
      if (input.autoRejectBelow !== undefined) updates.autoRejectBelow = input.autoRejectBelow;
      if (input.notifyOnLevel4 !== undefined) updates.notifyOnLevel4 = input.notifyOnLevel4;
      if (input.weightEconomicImpact !== undefined) updates.weightEconomicImpact = input.weightEconomicImpact;
      if (input.weightIrreversibility !== undefined) updates.weightIrreversibility = input.weightIrreversibility;
      if (input.weightTimeCriticality !== undefined) updates.weightTimeCriticality = input.weightTimeCriticality;
      if (input.weightHiddenVariableStrength !== undefined) updates.weightHiddenVariableStrength = input.weightHiddenVariableStrength;
      if (input.weightExecutiveRelevance !== undefined) updates.weightExecutiveRelevance = input.weightExecutiveRelevance;
      if (input.weightNovelty !== undefined) updates.weightNovelty = input.weightNovelty;

      await db.update(atlasSignificanceConfig).set(updates).where(eq(atlasSignificanceConfig.id, 1));
      return { success: true };
    }),

  // ── Score distribution (histogram) ───────────────────────────────────────
  getScoreDistribution: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Count companies in each SSS bucket (0-9, 10-19, ..., 90-100)
      const buckets = await Promise.all(
        Array.from({ length: 11 }, (_, i) => {
          const lo = i * 10;
          const hi = i === 10 ? 101 : lo + 10;
          return db
            .select({ count: count() })
            .from(arosCompanies)
            .where(and(gte(arosCompanies.sss, lo), lt(arosCompanies.sss, hi)))
            .then(([r]) => ({ bucket: `${lo}–${Math.min(hi - 1, 100)}`, count: r?.count ?? 0, lo, hi: hi - 1 }));
        })
      );

      // ESI distribution
      const esiBuckets = await Promise.all(
        Array.from({ length: 11 }, (_, i) => {
          const lo = i * 10;
          const hi = i === 10 ? 101 : lo + 10;
          return db
            .select({ count: count() })
            .from(arosCompanies)
            .where(and(gte(arosCompanies.esi, lo), lt(arosCompanies.esi, hi)))
            .then(([r]) => ({ bucket: `${lo}–${Math.min(hi - 1, 100)}`, count: r?.count ?? 0 }));
        })
      );

      return { sss: buckets, esi: esiBuckets };
    }),

  // ── Decision Hierarchy summary ────────────────────────────────────────────
  getDecisionHierarchySummary: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [level1] = await db.select({ count: count() }).from(arosCompanies).where(eq(arosCompanies.decisionLevel, "LEVEL_1"));
      const [level2] = await db.select({ count: count() }).from(arosCompanies).where(eq(arosCompanies.decisionLevel, "LEVEL_2"));
      const [level3] = await db.select({ count: count() }).from(arosCompanies).where(eq(arosCompanies.decisionLevel, "LEVEL_3"));
      const [level4] = await db.select({ count: count() }).from(arosCompanies).where(eq(arosCompanies.decisionLevel, "LEVEL_4"));
      const [unscored] = await db.select({ count: count() }).from(arosCompanies).where(sql`${arosCompanies.decisionLevel} IS NULL`);
      const [qualityPassed] = await db.select({ count: count() }).from(arosCompanies).where(eq(arosCompanies.qualityGatePassed, 1));
      const [total] = await db.select({ count: count() }).from(arosCompanies);

      // Average SSS and ESI across all scored companies
      const [avgs] = await db
        .select({
          avgSss: sql<number>`ROUND(AVG(${arosCompanies.sss}), 1)`,
          avgEsi: sql<number>`ROUND(AVG(${arosCompanies.esi}), 1)`,
          maxSss: sql<number>`MAX(${arosCompanies.sss})`,
          maxEsi: sql<number>`MAX(${arosCompanies.esi})`,
        })
        .from(arosCompanies)
        .where(sql`${arosCompanies.sssCalculatedAt} IS NOT NULL`);

      // Top 5 highest-SSS companies
      const topCompanies = await db
        .select({
          id: arosCompanies.id,
          companyName: arosCompanies.companyName,
          sector: arosCompanies.sector,
          country: arosCompanies.country,
          sss: arosCompanies.sss,
          esi: arosCompanies.esi,
          decisionLevel: arosCompanies.decisionLevel,
          qualityGatePassed: arosCompanies.qualityGatePassed,
          sssRationale: arosCompanies.sssRationale,
        })
        .from(arosCompanies)
        .where(sql`${arosCompanies.sssCalculatedAt} IS NOT NULL`)
        .orderBy(sql`${arosCompanies.sss} DESC`)
        .limit(10);

      return {
        total: total?.count ?? 0,
        level1: level1?.count ?? 0,
        level2: level2?.count ?? 0,
        level3: level3?.count ?? 0,
        level4: level4?.count ?? 0,
        unscored: unscored?.count ?? 0,
        qualityGatePassed: qualityPassed?.count ?? 0,
        avgSss: avgs?.avgSss ?? 0,
        avgEsi: avgs?.avgEsi ?? 0,
        maxSss: avgs?.maxSss ?? 0,
        maxEsi: avgs?.maxEsi ?? 0,
        topCompanies,
      };
    }),

  // ── Score a single company on demand ─────────────────────────────────────
  scoreCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      // Import dynamically to avoid circular dependency
      const { scoreAndPersistCompany } = await import("./strategicSignificanceEngine");
      const result = await scoreAndPersistCompany(company.id, {
        companyName: company.companyName,
        sector: company.sector,
        country: company.country,
        detectedDecision: company.activeStrategicInitiative ?? company.keyDecisionDomain ?? "Strategic decision under analysis",
        hiddenVariable: company.aiTransformationSignal ?? "Hidden variable under analysis",
        decisionTwinSummary: company.decisionTwin ? String(company.decisionTwin).slice(0, 400) : "Decision Twin not yet generated",
        revenueUsdBn: company.revenueUsdBn ? Number(company.revenueUsdBn) : undefined,
        employees: company.employees ?? undefined,
      });

      return result;
    }),
});
