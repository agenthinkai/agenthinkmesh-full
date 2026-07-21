/**
 * Mesh Core v0.1 — tRPC Router
 *
 * Exports:
 *   - meshCoreRouter  (wired into appRouter as "meshCore")
 *   - computeLoadedCost()  (exported for unit tests)
 *   - computeVerdict()     (exported for unit tests)
 *
 * Implements:
 *   - Amendment A: full loaded-cost formula
 *   - Amendment C: p90 = margin at 90th-percentile cost OU
 *   - Amendment D: STRONG / VIABLE / REPRICE / FAIL verdict thresholds
 */

import { z } from "zod";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  modelPricing,
  workflowPricebook,
  orchestrationUnits,
} from "../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Amendment A — Loaded Cost Formula (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────
export interface LoadedCostInput {
  tokenCostUsd: number;
  humanGateMinutes: number;
  humanGateCostPerMinute: number;
  residencyCacPerOuUsd: number;
  disputeRate: number;
  liabilityReservePct: number;
}

export interface LoadedCostResult {
  tokenCostUsd: number;
  humanGateCostUsd: number;
  disputeCostUsd: number;
  residencyCacUsd: number;
  liabilityReserveUsd: number;
  loadedCostUsd: number;
}

/**
 * Amendment A — exact loaded-cost formula:
 *   dispute = rate × (token + gate_min × gate_rate)
 *   sub     = token + gate + dispute + cac
 *   reserve = sub × reserve_pct
 *   loaded  = sub + reserve
 */
export function computeLoadedCost(input: LoadedCostInput): LoadedCostResult {
  const { tokenCostUsd, humanGateMinutes, humanGateCostPerMinute, residencyCacPerOuUsd, disputeRate, liabilityReservePct } = input;
  const humanGateCostUsd = humanGateMinutes * humanGateCostPerMinute;
  const disputeCostUsd = disputeRate * (tokenCostUsd + humanGateMinutes * humanGateCostPerMinute);
  const subTotal = tokenCostUsd + humanGateCostUsd + disputeCostUsd + residencyCacPerOuUsd;
  const liabilityReserveUsd = subTotal * liabilityReservePct;
  const loadedCostUsd = subTotal + liabilityReserveUsd;
  return { tokenCostUsd, humanGateCostUsd, disputeCostUsd, residencyCacUsd: residencyCacPerOuUsd, liabilityReserveUsd, loadedCostUsd };
}

// ─────────────────────────────────────────────────────────────────────────────
// Amendment D — Verdict Thresholds (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────
export type Verdict = "STRONG" | "VIABLE" | "REPRICE" | "FAIL";

/**
 * Amendment D — exhaustive verdict rules:
 *   STRONG:  p90 ≥ 50%
 *   VIABLE:  p90 ≥ 20% AND p90 < 50%
 *   REPRICE: p50 ≥ 50% AND p90 < 20%
 *   FAIL:    p50 < 50%
 * (Rules are evaluated in this order; first match wins.)
 */
export function computeVerdict(p50Margin: number, p90Margin: number): Verdict {
  if (p90Margin >= 50) return "STRONG";
  if (p90Margin >= 20) return "VIABLE";
  if (p50Margin >= 50) return "REPRICE";
  return "FAIL";
}

// ─────────────────────────────────────────────────────────────────────────────
// Amendment C — Percentile helper
// ─────────────────────────────────────────────────────────────────────────────
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(idx, sortedAsc.length - 1))];
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin guard
// ─────────────────────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────
export const meshCoreRouter = router({

  // ── Model Pricing ──────────────────────────────────────────────────────────
  getModelPricing: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(modelPricing);
    return rows.map((r) => ({
      id: r.id,
      tier: r.tier,
      inputPricePerMillion: parseFloat(r.inputPricePerMillion as unknown as string),
      outputPricePerMillion: parseFloat(r.outputPricePerMillion as unknown as string),
    }));
  }),

  // ── Pricebook ──────────────────────────────────────────────────────────────
  getPricebook: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(workflowPricebook);
    return rows.map((r) => ({
      id: r.id,
      workflowType: r.workflowType,
      priceUsd: parseFloat(r.priceUsd as unknown as string),
      liabilityReservePct: parseFloat(r.liabilityReservePct as unknown as string),
      humanGateCostPerMinute: parseFloat(r.humanGateCostPerMinute as unknown as string),
      humanGateMinutes: parseFloat(r.humanGateMinutes as unknown as string),
      residencyCacPerOuUsd: parseFloat(r.residencyCacPerOuUsd as unknown as string),
      disputeRate: parseFloat(r.disputeRate as unknown as string),
      isEnterprise: Boolean(r.isEnterprise),
    }));
  }),

  updatePricebook: adminProcedure
    .input(z.object({
      workflowType: z.string(),
      priceUsd: z.number().optional(),
      liabilityReservePct: z.number().min(0).max(1).optional(),
      humanGateCostPerMinute: z.number().min(0).optional(),
      humanGateMinutes: z.number().min(0).optional(),
      residencyCacPerOuUsd: z.number().min(0).optional(),
      disputeRate: z.number().min(0).max(1).optional(),
      isEnterprise: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { workflowType, ...updates } = input;
      const updateData: Record<string, string | number> = {};
      if (updates.priceUsd !== undefined) updateData.priceUsd = updates.priceUsd.toFixed(6);
      if (updates.liabilityReservePct !== undefined) updateData.liabilityReservePct = updates.liabilityReservePct.toFixed(6);
      if (updates.humanGateCostPerMinute !== undefined) updateData.humanGateCostPerMinute = updates.humanGateCostPerMinute.toFixed(6);
      if (updates.humanGateMinutes !== undefined) updateData.humanGateMinutes = updates.humanGateMinutes.toFixed(4);
      if (updates.residencyCacPerOuUsd !== undefined) updateData.residencyCacPerOuUsd = updates.residencyCacPerOuUsd.toFixed(6);
      if (updates.disputeRate !== undefined) updateData.disputeRate = updates.disputeRate.toFixed(6);
      if (updates.isEnterprise !== undefined) updateData.isEnterprise = updates.isEnterprise ? 1 : 0;
      await db.update(workflowPricebook).set(updateData as Partial<typeof workflowPricebook.$inferInsert>).where(eq(workflowPricebook.workflowType, workflowType));
      return { success: true };
    }),

  // ── OU Ledger ──────────────────────────────────────────────────────────────
  getOULedger: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
      workflowType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { rows: [], total: 0, page: 1, totalPages: 1 };
      const { page, pageSize, workflowType } = input;
      const offset = (page - 1) * pageSize;

      const where = workflowType ? eq(orchestrationUnits.workflowType, workflowType) : undefined;

      const [rows, countResult] = await Promise.all([
        db.select().from(orchestrationUnits)
          .where(where)
          .orderBy(desc(orchestrationUnits.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(orchestrationUnits).where(where),
      ]);

      const total = Number(countResult[0]?.count ?? 0);
      return {
        rows: rows.map((r) => ({
          id: r.id,
          workflowType: r.workflowType,
          workflowId: r.workflowId,
          tier: r.tier,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          tokenCostUsd: parseFloat(r.tokenCostUsd as unknown as string),
          humanGateCostUsd: parseFloat(r.humanGateCostUsd as unknown as string),
          disputeCostUsd: parseFloat(r.disputeCostUsd as unknown as string),
          residencyCacUsd: parseFloat(r.residencyCacUsd as unknown as string),
          liabilityReserveUsd: parseFloat(r.liabilityReserveUsd as unknown as string),
          loadedCostUsd: parseFloat(r.loadedCostUsd as unknown as string),
          priceUsd: parseFloat(r.priceUsd as unknown as string),
          latencyMs: r.latencyMs,
          attemptsCount: r.attemptsCount,
          tiersUsed: (() => { try { return JSON.parse(r.tiersUsed ?? "[]"); } catch { return []; } })(),
          finalTier: r.finalTier,
          capBreach: Boolean(r.capBreach),
          escalated: Boolean(r.escalated),
          validationPassed: Boolean(r.validationPassed),
          escalationReason: r.escalationReason,
          createdAt: r.createdAt,
        })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }),

  // ── Workflow Margin Analysis (Amendment C + D) ─────────────────────────────
  getWorkflowMargins: adminProcedure
    .input(z.object({
      workflowType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Fetch pricebook for price lookups
      const pricebookRows = await db.select().from(workflowPricebook);
      const priceMap = new Map(pricebookRows.map((r) => [
        r.workflowType,
        parseFloat(r.priceUsd as unknown as string),
      ]));

      // Fetch all OUs grouped by workflow
      const where = input.workflowType ? eq(orchestrationUnits.workflowType, input.workflowType) : undefined;
      const allOUs = await db.select({
        workflowType: orchestrationUnits.workflowType,
        loadedCostUsd: orchestrationUnits.loadedCostUsd,
        priceUsd: orchestrationUnits.priceUsd,
      }).from(orchestrationUnits).where(where);

      // Group by workflowType
      const grouped = new Map<string, number[]>();
      for (const ou of allOUs) {
        const wt = ou.workflowType;
        if (!grouped.has(wt)) grouped.set(wt, []);
        grouped.get(wt)!.push(parseFloat(ou.loadedCostUsd as unknown as string));
      }

      const results = [];
      for (const [wt, costs] of Array.from(grouped.entries())) {
        const sorted = [...costs].sort((a, b) => a - b);
        const price = priceMap.get(wt) ?? (sorted[sorted.length - 1] ?? 0) * 2;
        const p50Cost = percentile(sorted, 50);
        const p90Cost = percentile(sorted, 90);
        const marginFn = (c: number) => price > 0 ? ((price - c) / price) * 100 : 0;
        const p50Margin = marginFn(p50Cost);
        const p90Margin = marginFn(p90Cost);
        const verdict = computeVerdict(p50Margin, p90Margin);
        results.push({
          workflowType: wt,
          ouCount: costs.length,
          price,
          p50Cost,
          p90Cost,
          p50Margin,
          p90Margin,
          verdict,
        });
      }

      return results.sort((a, b) => a.workflowType.localeCompare(b.workflowType));
    }),

  // ── Live Alerts (last 24h) ─────────────────────────────────────────────────
  getLiveAlerts: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const since = Date.now() - 24 * 60 * 60 * 1000;

    const [capBreaches, escalations, failedValidations] = await Promise.all([
      db.select({
        workflowType: orchestrationUnits.workflowType,
        count: sql<number>`count(*)`,
      }).from(orchestrationUnits)
        .where(and(gte(orchestrationUnits.createdAt, since), eq(orchestrationUnits.capBreach, 1)))
        .groupBy(orchestrationUnits.workflowType),

      db.select({
        workflowType: orchestrationUnits.workflowType,
        count: sql<number>`count(*)`,
      }).from(orchestrationUnits)
        .where(and(gte(orchestrationUnits.createdAt, since), eq(orchestrationUnits.escalated, 1)))
        .groupBy(orchestrationUnits.workflowType),

      db.select({
        workflowType: orchestrationUnits.workflowType,
        count: sql<number>`count(*)`,
      }).from(orchestrationUnits)
        .where(and(gte(orchestrationUnits.createdAt, since), eq(orchestrationUnits.validationPassed, 0)))
        .groupBy(orchestrationUnits.workflowType),
    ]);

    const alerts: Array<{ type: string; workflowType: string; count: number; message: string }> = [];

    for (const r of capBreaches) {
      alerts.push({ type: "CAP_BREACH", workflowType: r.workflowType, count: Number(r.count), message: `${r.count} OUs exceeded token budget` });
    }
    for (const r of escalations) {
      alerts.push({ type: "ESCALATION", workflowType: r.workflowType, count: Number(r.count), message: `${r.count} OUs escalated to higher tier` });
    }
    for (const r of failedValidations) {
      alerts.push({ type: "FAIL_VERDICT", workflowType: r.workflowType, count: Number(r.count), message: `${r.count} OUs failed validation` });
    }

    // Also check for FAIL/REPRICE verdicts by computing margins on the fly
    const allOUs = await db.select({
      workflowType: orchestrationUnits.workflowType,
      loadedCostUsd: orchestrationUnits.loadedCostUsd,
      priceUsd: orchestrationUnits.priceUsd,
    }).from(orchestrationUnits).where(gte(orchestrationUnits.createdAt, since));

    const grouped = new Map<string, number[]>();
    const priceByWt = new Map<string, number>();
    for (const ou of allOUs) {
      const wt = ou.workflowType;
      if (!grouped.has(wt)) grouped.set(wt, []);
      grouped.get(wt)!.push(parseFloat(ou.loadedCostUsd as unknown as string));
      priceByWt.set(wt, parseFloat(ou.priceUsd as unknown as string));
    }

    for (const [wt, costs] of Array.from(grouped.entries())) {
      const sorted = [...costs].sort((a, b) => a - b);
      const price = priceByWt.get(wt) ?? 0;
      if (price <= 0) continue;
      const p50Cost = percentile(sorted, 50);
      const p90Cost = percentile(sorted, 90);
      const p50Margin = ((price - p50Cost) / price) * 100;
      const p90Margin = ((price - p90Cost) / price) * 100;
      const verdict = computeVerdict(p50Margin, p90Margin);
      if (verdict === "FAIL") {
        alerts.push({ type: "FAIL_VERDICT", workflowType: wt, count: costs.length, message: `p50 margin ${p50Margin.toFixed(1)}% — below 50% threshold` });
      } else if (verdict === "REPRICE") {
        alerts.push({ type: "REPRICE_VERDICT", workflowType: wt, count: costs.length, message: `p90 margin ${p90Margin.toFixed(1)}% — repricing required` });
      }
    }

    return alerts;
  }),

  // ── Seed Demo OUs ──────────────────────────────────────────────────────────
  seedDemoOUs: adminProcedure
    .input(z.object({ count: z.number().int().min(10).max(500).default(120) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const pricebookRows = await db.select().from(workflowPricebook);
      if (pricebookRows.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Seed workflow_pricebook first" });

      const modelRows = await db.select().from(modelPricing);
      const tierPricing = new Map(modelRows.map((r) => [
        r.tier,
        { input: parseFloat(r.inputPricePerMillion as unknown as string), output: parseFloat(r.outputPricePerMillion as unknown as string) },
      ]));

      const tiers: Array<"SMALL" | "MID" | "LARGE"> = ["SMALL", "MID", "LARGE"];
      const records: typeof orchestrationUnits.$inferInsert[] = [];

      for (let i = 0; i < input.count; i++) {
        const pb = pricebookRows[i % pricebookRows.length];
        const tier = tiers[Math.floor(Math.random() * 3)];
        const pricing = tierPricing.get(tier) ?? { input: 0.15, output: 0.60 };

        const inputTokens = Math.floor(200 + Math.random() * 3800);
        const outputTokens = Math.floor(50 + Math.random() * 1200);
        const tokenCostUsd = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

        const pbGateMin = parseFloat(pb.humanGateMinutes as unknown as string);
        const pbGateRate = parseFloat(pb.humanGateCostPerMinute as unknown as string);
        const pbCac = parseFloat(pb.residencyCacPerOuUsd as unknown as string);
        const pbDisputeRate = parseFloat(pb.disputeRate as unknown as string);
        const pbReservePct = parseFloat(pb.liabilityReservePct as unknown as string);
        const pbPrice = parseFloat(pb.priceUsd as unknown as string);

        const gateMinutes = pbGateMin * (0.5 + Math.random());
        const { humanGateCostUsd, disputeCostUsd, residencyCacUsd, liabilityReserveUsd, loadedCostUsd } = computeLoadedCost({
          tokenCostUsd,
          humanGateMinutes: gateMinutes,
          humanGateCostPerMinute: pbGateRate,
          residencyCacPerOuUsd: pbCac,
          disputeRate: pbDisputeRate,
          liabilityReservePct: pbReservePct,
        });

        const capBreach = loadedCostUsd > pbPrice * 0.95 ? 1 : 0;

        // Simulate realistic escalation paths
        // ~10% of OUs escalate: SMALL→MID or SMALL→SMALL(retry)→MID
        // ~3% cap breach (no escalation, just abort)
        // ~87% clean single-tier runs
        const rand = Math.random();
        let tiersUsed: string[];
        let attemptsCount: number;
        let escalatedFlag: number;
        let validationPassed: number;
        let finalTier: string;
        let escalationReason: string | null = null;

        if (capBreach) {
          tiersUsed = [tier];
          attemptsCount = 1;
          escalatedFlag = 0;
          validationPassed = 0;
          finalTier = tier;
          escalationReason = "Token budget cap breached";
        } else if (rand < 0.05) {
          // SMALL→MID escalation (validation failure on SMALL)
          const startTier = "SMALL";
          tiersUsed = [startTier, "MID"];
          attemptsCount = 2;
          escalatedFlag = 1;
          validationPassed = 1;
          finalTier = "MID";
          escalationReason = `Validation failed on ${startTier} — escalated to MID`;
        } else if (rand < 0.08) {
          // SMALL→SMALL(retry)→MID (hard failure + retry + escalation)
          tiersUsed = ["SMALL", "SMALL", "MID"];
          attemptsCount = 3;
          escalatedFlag = 1;
          validationPassed = 1;
          finalTier = "MID";
          escalationReason = "Hard failure on SMALL, same-tier retry failed, escalated to MID";
        } else if (rand < 0.10) {
          // MID→LARGE escalation
          tiersUsed = ["MID", "LARGE"];
          attemptsCount = 2;
          escalatedFlag = 1;
          validationPassed = 1;
          finalTier = "LARGE";
          escalationReason = "Validation failed on MID — escalated to LARGE";
        } else {
          // Clean single-tier run
          tiersUsed = [tier];
          attemptsCount = 1;
          escalatedFlag = 0;
          validationPassed = 1;
          finalTier = tier;
        }

        const createdAt = Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);

        records.push({
          workflowType: pb.workflowType,
          tier,
          inputTokens,
          outputTokens,
          tokenCostUsd: tokenCostUsd.toFixed(8),
          humanGateCostUsd: humanGateCostUsd.toFixed(8),
          disputeCostUsd: disputeCostUsd.toFixed(8),
          residencyCacUsd: residencyCacUsd.toFixed(8),
          liabilityReserveUsd: liabilityReserveUsd.toFixed(8),
          loadedCostUsd: loadedCostUsd.toFixed(8),
          priceUsd: pbPrice.toFixed(8),
          latencyMs: Math.floor(800 + Math.random() * 4200),
          attemptsCount,
          tiersUsed: JSON.stringify(tiersUsed),
          finalTier,
          capBreach,
          escalated: escalatedFlag,
          validationPassed,
          escalationReason,
          createdAt,
        } as typeof orchestrationUnits.$inferInsert);
      }

      // Insert in batches of 50
      for (let i = 0; i < records.length; i += 50) {
        await db.insert(orchestrationUnits).values(records.slice(i, i + 50) as typeof orchestrationUnits.$inferInsert[]);
      }

      return { inserted: records.length };
    }),

  // ── Record OU (called by MeshRuntime after each execution) ─────────────────
  recordOU: protectedProcedure
    .input(z.object({
      workflowType: z.string(),
      workflowId: z.string().optional(),
      tier: z.enum(["SMALL", "MID", "LARGE"]),
      inputTokens: z.number().int().min(0),
      outputTokens: z.number().int().min(0),
      tokenCostUsd: z.number(),
      humanGateCostUsd: z.number(),
      disputeCostUsd: z.number(),
      residencyCacUsd: z.number(),
      liabilityReserveUsd: z.number(),
      loadedCostUsd: z.number(),
      priceUsd: z.number(),
      latencyMs: z.number().int().optional(),
      attemptsCount: z.number().int().min(1).default(1),
      tiersUsed: z.array(z.enum(["SMALL", "MID", "LARGE"])).default([]),
      finalTier: z.string().optional(),
      capBreach: z.boolean().default(false),
      escalated: z.boolean().default(false),
      validationPassed: z.boolean().default(true),
      escalationReason: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(orchestrationUnits).values({
        workflowType: input.workflowType,
        workflowId: input.workflowId,
        userId: String(ctx.user.id),
        tier: input.tier,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        tokenCostUsd: input.tokenCostUsd.toFixed(8),
        humanGateCostUsd: input.humanGateCostUsd.toFixed(8),
        disputeCostUsd: input.disputeCostUsd.toFixed(8),
        residencyCacUsd: input.residencyCacUsd.toFixed(8),
        liabilityReserveUsd: input.liabilityReserveUsd.toFixed(8),
        loadedCostUsd: input.loadedCostUsd.toFixed(8),
        priceUsd: input.priceUsd.toFixed(6),
        latencyMs: input.latencyMs,
        attemptsCount: input.attemptsCount,
        tiersUsed: JSON.stringify(input.tiersUsed),
        finalTier: input.finalTier ?? input.tier,
        capBreach: input.capBreach ? 1 : 0,
        escalated: input.escalated ? 1 : 0,
        validationPassed: input.validationPassed ? 1 : 0,
        escalationReason: input.escalationReason ?? null,
        createdAt: Date.now(),
      } as typeof orchestrationUnits.$inferInsert);
      return { success: true };
    }),
});
