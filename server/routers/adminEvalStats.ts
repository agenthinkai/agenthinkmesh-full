/**
 * server/routers/adminEvalStats.ts — P5/P6 Observability Aggregation
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only tRPC procedures that aggregate eval_inference_log into
 * operational metrics for the AgenThinkMesh eval infrastructure.
 *
 * Procedures:
 *   admin.evalStats.summary      — Totals over a time window (default: last 7 days)
 *   admin.evalStats.byDay        — Per-day breakdown (calls, cost, latency, cache)
 *   admin.evalStats.byProvider   — Per-provider/model breakdown
 *   admin.evalStats.escalations  — Escalation reason breakdown
 *   admin.evalStats.cacheStats   — In-process LRU cache snapshot (live, not DB)
 *
 * All procedures require admin role (adminProcedure).
 * No data is returned to non-admin callers — FORBIDDEN is thrown.
 *
 * SQL strategy:
 *   • All aggregations use raw SQL via drizzle's sql`` template to keep
 *     queries readable and avoid ORM gymnastics for GROUP BY / percentile.
 *   • p95 latency uses a subquery + ORDER BY / LIMIT approach (MySQL-compatible)
 *     since MySQL 5.7/8 doesn't have PERCENTILE_CONT as a window function in
 *     all managed tiers.
 *   • createdAt is stored as Unix ms bigint; date bucketing uses
 *     FROM_UNIXTIME(created_at / 1000, '%Y-%m-%d') for UTC day grouping.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { evalInferenceLog } from "../../drizzle/schema";
import { sql, and, gte, lte } from "drizzle-orm";
import { evalCacheStats } from "../lib/llm/evalCache";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a days-ago offset to a Unix ms timestamp (start of that UTC day). */
function daysAgoMs(days: number): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.getTime();
}

/** Safe division — returns 0 when denominator is 0. */
function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Round to 4 decimal places. */
function r4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const WindowInput = z.object({
  /** Number of days to look back (default: 7, max: 90) */
  days: z.number().int().min(1).max(90).default(7),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const adminEvalStatsRouter = router({

  /**
   * summary — aggregate totals over the requested time window.
   *
   * Returns:
   *   totalCalls, cachedCalls, cacheMissRate, totalCostUsd,
   *   avgLatencyMs, p95LatencyMs,
   *   totalRetries, fallbackCalls, escalatedCalls,
   *   windowDays, fromTs, toTs
   */
  summary: adminProcedure
    .input(WindowInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fromTs = daysAgoMs(input.days);
      const toTs   = Date.now();

      // ── Main aggregation ─────────────────────────────────────────────────
      const [row] = await db
        .select({
          totalCalls:    sql<number>`COUNT(*)`,
          cachedCalls:   sql<number>`SUM(CASE WHEN ${evalInferenceLog.fromCache} = 1 THEN 1 ELSE 0 END)`,
          totalCostUsd:  sql<string>`COALESCE(SUM(CAST(${evalInferenceLog.estimatedCostUsd} AS DECIMAL(12,6))), 0)`,
          avgLatencyMs:  sql<number>`ROUND(AVG(CASE WHEN ${evalInferenceLog.fromCache} = 0 THEN ${evalInferenceLog.latencyMs} END), 0)`,
          totalRetries:  sql<number>`SUM(${evalInferenceLog.retryCount})`,
          fallbackCalls: sql<number>`SUM(${evalInferenceLog.fallbackUsed})`,
          escalatedCalls: sql<number>`SUM(CASE WHEN ${evalInferenceLog.escalationReason} IS NOT NULL THEN 1 ELSE 0 END)`,
        })
        .from(evalInferenceLog)
        .where(
          and(
            gte(evalInferenceLog.createdAt, fromTs),
            lte(evalInferenceLog.createdAt, toTs),
          ),
        );

      const totalCalls  = Number(row?.totalCalls  ?? 0);
      const cachedCalls = Number(row?.cachedCalls ?? 0);
      const missCount   = totalCalls - cachedCalls;

      // ── p95 latency (non-cache rows only) ────────────────────────────────
      // Strategy: count non-cache rows, skip to the 95th-percentile row.
      const [countRow] = await db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(evalInferenceLog)
        .where(
          and(
            gte(evalInferenceLog.createdAt, fromTs),
            lte(evalInferenceLog.createdAt, toTs),
            sql`${evalInferenceLog.fromCache} = 0`,
            sql`${evalInferenceLog.latencyMs} IS NOT NULL`,
          ),
        );
      const nonCacheCount = Number(countRow?.cnt ?? 0);
      let p95LatencyMs = 0;
      if (nonCacheCount > 0) {
        const offset = Math.max(0, Math.floor(nonCacheCount * 0.95) - 1);
        const [p95Row] = await db
          .select({ latencyMs: evalInferenceLog.latencyMs })
          .from(evalInferenceLog)
          .where(
            and(
              gte(evalInferenceLog.createdAt, fromTs),
              lte(evalInferenceLog.createdAt, toTs),
              sql`${evalInferenceLog.fromCache} = 0`,
              sql`${evalInferenceLog.latencyMs} IS NOT NULL`,
            ),
          )
          .orderBy(evalInferenceLog.latencyMs)
          .limit(1)
          .offset(offset);
        p95LatencyMs = Number(p95Row?.latencyMs ?? 0);
      }

      return {
        windowDays:      input.days,
        fromTs,
        toTs,
        totalCalls,
        cachedCalls,
        cacheMissCalls:  missCount,
        cacheHitRate:    r4(safeDivide(cachedCalls, totalCalls)),
        totalCostUsd:    r4(parseFloat(String(row?.totalCostUsd ?? "0"))),
        avgLatencyMs:    Number(row?.avgLatencyMs ?? 0),
        p95LatencyMs,
        totalRetries:    Number(row?.totalRetries  ?? 0),
        fallbackCalls:   Number(row?.fallbackCalls ?? 0),
        escalatedCalls:  Number(row?.escalatedCalls ?? 0),
        fallbackRate:    r4(safeDivide(Number(row?.fallbackCalls ?? 0), totalCalls)),
        escalationRate:  r4(safeDivide(Number(row?.escalatedCalls ?? 0), totalCalls)),
      };
    }),

  /**
   * byDay — per-UTC-day breakdown of calls, cost, avg latency, cache hits.
   *
   * Returns an array sorted by date ascending, each entry:
   *   date (YYYY-MM-DD), totalCalls, cachedCalls, totalCostUsd, avgLatencyMs
   */
  byDay: adminProcedure
    .input(WindowInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fromTs = daysAgoMs(input.days);
      const toTs   = Date.now();

      const rows = await db
        .select({
          date:         sql<string>`DATE(FROM_UNIXTIME(${evalInferenceLog.createdAt} / 1000))`,
          totalCalls:   sql<number>`COUNT(*)`,
          cachedCalls:  sql<number>`SUM(CASE WHEN ${evalInferenceLog.fromCache} = 1 THEN 1 ELSE 0 END)`,
          totalCostUsd: sql<string>`COALESCE(SUM(CAST(${evalInferenceLog.estimatedCostUsd} AS DECIMAL(12,6))), 0)`,
          avgLatencyMs: sql<number>`ROUND(AVG(CASE WHEN ${evalInferenceLog.fromCache} = 0 THEN ${evalInferenceLog.latencyMs} END), 0)`,
        })
        .from(evalInferenceLog)
        .where(
          and(
            gte(evalInferenceLog.createdAt, fromTs),
            lte(evalInferenceLog.createdAt, toTs),
          ),
        )
        .groupBy(sql`DATE(FROM_UNIXTIME(${evalInferenceLog.createdAt} / 1000))`)
        .orderBy(sql`DATE(FROM_UNIXTIME(${evalInferenceLog.createdAt} / 1000))`);

      return rows.map((r) => ({
        date:         r.date,
        totalCalls:   Number(r.totalCalls),
        cachedCalls:  Number(r.cachedCalls),
        totalCostUsd: r4(parseFloat(String(r.totalCostUsd))),
        avgLatencyMs: Number(r.avgLatencyMs ?? 0),
        cacheHitRate: r4(safeDivide(Number(r.cachedCalls), Number(r.totalCalls))),
      }));
    }),

  /**
   * byProvider — per-provider/model breakdown.
   *
   * Returns an array sorted by totalCalls descending, each entry:
   *   provider, model, totalCalls, cachedCalls, totalCostUsd,
   *   avgLatencyMs, fallbackCalls, escalatedCalls
   */
  byProvider: adminProcedure
    .input(WindowInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fromTs = daysAgoMs(input.days);
      const toTs   = Date.now();

      const rows = await db
        .select({
          provider:      evalInferenceLog.provider,
          model:         evalInferenceLog.model,
          totalCalls:    sql<number>`COUNT(*)`,
          cachedCalls:   sql<number>`SUM(CASE WHEN ${evalInferenceLog.fromCache} = 1 THEN 1 ELSE 0 END)`,
          totalCostUsd:  sql<string>`COALESCE(SUM(CAST(${evalInferenceLog.estimatedCostUsd} AS DECIMAL(12,6))), 0)`,
          avgLatencyMs:  sql<number>`ROUND(AVG(CASE WHEN ${evalInferenceLog.fromCache} = 0 THEN ${evalInferenceLog.latencyMs} END), 0)`,
          fallbackCalls: sql<number>`SUM(${evalInferenceLog.fallbackUsed})`,
          escalatedCalls: sql<number>`SUM(CASE WHEN ${evalInferenceLog.escalationReason} IS NOT NULL THEN 1 ELSE 0 END)`,
        })
        .from(evalInferenceLog)
        .where(
          and(
            gte(evalInferenceLog.createdAt, fromTs),
            lte(evalInferenceLog.createdAt, toTs),
          ),
        )
        .groupBy(evalInferenceLog.provider, evalInferenceLog.model)
        .orderBy(sql`COUNT(*) DESC`);

      return rows.map((r) => ({
        provider:      r.provider,
        model:         r.model,
        totalCalls:    Number(r.totalCalls),
        cachedCalls:   Number(r.cachedCalls),
        totalCostUsd:  r4(parseFloat(String(r.totalCostUsd))),
        avgLatencyMs:  Number(r.avgLatencyMs ?? 0),
        fallbackCalls: Number(r.fallbackCalls),
        escalatedCalls: Number(r.escalatedCalls),
        cacheHitRate:  r4(safeDivide(Number(r.cachedCalls), Number(r.totalCalls))),
      }));
    }),

  /**
   * escalations — breakdown of escalation reasons.
   *
   * Returns an array sorted by count descending, each entry:
   *   reason (null = no escalation), count, percentage
   */
  escalations: adminProcedure
    .input(WindowInput)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const fromTs = daysAgoMs(input.days);
      const toTs   = Date.now();

      const rows = await db
        .select({
          reason: evalInferenceLog.escalationReason,
          count:  sql<number>`COUNT(*)`,
        })
        .from(evalInferenceLog)
        .where(
          and(
            gte(evalInferenceLog.createdAt, fromTs),
            lte(evalInferenceLog.createdAt, toTs),
          ),
        )
        .groupBy(evalInferenceLog.escalationReason)
        .orderBy(sql`COUNT(*) DESC`);

      const total = rows.reduce((sum, r) => sum + Number(r.count), 0);

      return rows.map((r) => ({
        reason:     r.reason ?? "none",
        count:      Number(r.count),
        percentage: r4(safeDivide(Number(r.count), total) * 100),
      }));
    }),

  /**
   * cacheStats — live snapshot of the in-process LRU cache counters.
   *
   * This is NOT backed by the database — it reads directly from the
   * in-memory evalCache module. Resets on server restart.
   *
   * Returns: size, hits, misses, evictions, expirations, hitRate
   */
  cacheStats: adminProcedure
    .query(() => {
      return evalCacheStats();
    }),
});

export type AdminEvalStatsRouter = typeof adminEvalStatsRouter;
