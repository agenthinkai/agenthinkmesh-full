/**
 * fleetSchedulerStatusRoute.ts
 *
 * Public GET /api/fleet/scheduler-status
 *
 * Returns a snapshot of the fleet scheduler state:
 *   - Whether the scheduler is active
 *   - Cron schedule string
 *   - Per-fleet-mode config (runs_completed, runs_remaining, last_run_at KWT,
 *     last_run_score, last_run_status, active, next_run KWT)
 *   - Total evaluations and breakdown by mode
 */
import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { fleetConfig, founderAgentRuns, founderAgentEvaluations } from "../drizzle/schema";
import { eq, desc, count, avg, sql } from "drizzle-orm";

const CRON_SCHEDULE = "0 3 * * *";
const CRON_LABEL = "0 3 * * * (06:00 Asia/Kuwait)";

/** Format a UTC ms timestamp as "YYYY-MM-DD HH:mm KWT" */
function toKWT(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleString("en-GB", {
    timeZone: "Asia/Kuwait",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(",", "").replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
}

/** Compute the next 03:00 UTC fire time (= 06:00 KWT) */
function nextFireKWT(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return toKWT(next.getTime()) ?? "";
}

export function registerFleetSchedulerStatusRoute(app: Express): void {
  app.get("/api/fleet/scheduler-status", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        return res.status(503).json({ error: "Database unavailable" });
      }

      // ── fleet_config rows ──────────────────────────────────────────────────
      const configs = await db.select().from(fleetConfig);

      // ── last run status per fleet mode ────────────────────────────────────
      const fleetModes: string[] = [];
      for (const cfg of configs) {
        if (!fleetModes.includes(cfg.fleetMode)) fleetModes.push(cfg.fleetMode);
      }

      const lastRunStatusMap: Record<string, string> = {};
      for (const mode of fleetModes) {
        const [lastRun] = await db
          .select({ status: founderAgentRuns.status })
          .from(founderAgentRuns)
          .where(eq(founderAgentRuns.fleetMode, mode))
          .orderBy(desc(founderAgentRuns.createdAt))
          .limit(1);
        lastRunStatusMap[mode] = lastRun?.status ?? "unknown";
      }

      // ── evaluation totals ─────────────────────────────────────────────────
      const [totalRow] = await db
        .select({ total: count() })
        .from(founderAgentEvaluations);
      const totalEvaluations = Number(totalRow?.total ?? 0);

      const evalsByMode = await db
        .select({
          fleetMode: founderAgentEvaluations.fleetMode,
          total: count(),
          avgScore: avg(founderAgentEvaluations.finalScore),
          totalTokens: sql<number>`SUM(tokens_total)`,
          totalCostUsd: sql<number>`SUM(cost_usd)`,
        })
        .from(founderAgentEvaluations)
        .groupBy(founderAgentEvaluations.fleetMode);

      // ── assemble response ─────────────────────────────────────────────────
      const fleetModesOut = configs.map((cfg) => ({
        fleet_mode: cfg.fleetMode,
        runs_completed: cfg.runsCompleted,
        runs_remaining: cfg.runsRemaining,
        last_run_at: toKWT(cfg.lastRunAt ?? undefined),
        last_run_score: cfg.lastRunScore ? parseFloat(cfg.lastRunScore) : null,
        last_run_cost_usd: cfg.lastRunCostUsd ? parseFloat(String(cfg.lastRunCostUsd)) : 0,
        total_cost_usd: cfg.totalCostUsd ? parseFloat(String(cfg.totalCostUsd)) : 0,
        last_run_status: lastRunStatusMap[cfg.fleetMode] ?? "unknown",
        active: cfg.active,
        next_run: cfg.active ? nextFireKWT() : null,
      }));

      return res.json({
        scheduler_active: true,
        cron_schedule: CRON_LABEL,
        fleet_modes: fleetModesOut,
        total_evaluations: totalEvaluations,
        evaluations_by_mode: evalsByMode.map((r) => ({
          fleet_mode: r.fleetMode,
          total: Number(r.total),
          avg_score: r.avgScore ? parseFloat(String(r.avgScore)) : null,
          total_tokens: Number((r as any).totalTokens ?? 0),
          total_cost_usd: (r as any).totalCostUsd ? parseFloat(String((r as any).totalCostUsd)) : 0,
        })),
      });
    } catch (err) {
      console.error("[FleetStatus] Error:", (err as Error)?.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
