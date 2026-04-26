/**
 * monteCarlo.ts
 *
 * Pure TypeScript Monte Carlo simulation engine.
 * No LLM calls — deterministic math only.
 * 1,000 iterations complete in < 50ms.
 */

import type { DealParams } from "./monteCarloParams";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonteCarloResult {
  p10: number;          // 10th percentile (pessimistic)
  p50: number;          // 50th percentile (base case)
  p90: number;          // 90th percentile (optimistic)
  mean: number;
  std: number;
  upside_skew: boolean; // p90 - p50 > p50 - p10
  iterations: number;
  params: DealParams;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Uniform random sample between min and max */
function uniformSample(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Clamp value to [0, 100] */
function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Compute scenario score (0–100) from sampled parameters.
 *
 * Weights:
 *   revenue_growth_rate  → 25 pts  (normalised to max 0.30)
 *   gross_margin         → 20 pts  (normalised to max 0.70)
 *   market_size_usd      → 20 pts  (normalised to max 1e10)
 *   churn_rate           → 15 pts  (inverted, normalised to max 0.20)
 *   time_to_profit       → 10 pts  (inverted, normalised to max 60)
 *   pivot_probability    → 10 pts  (inverted, normalised to max 0.40)
 */
function computeScenarioScore(
  revenue_growth_rate: number,
  gross_margin: number,
  market_size_usd: number,
  churn_rate: number,
  time_to_profit: number,
  pivot_probability: number
): number {
  const score =
    (revenue_growth_rate / 0.30) * 25 +
    (gross_margin        / 0.70) * 20 +
    (market_size_usd     / 1e10) * 20 +
    (1 - churn_rate      / 0.20) * 15 +
    (1 - time_to_profit  / 60)   * 10 +
    (1 - pivot_probability / 0.40) * 10;
  return clamp100(score);
}

/** Compute percentile from a sorted array */
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ── Main simulation ───────────────────────────────────────────────────────────

/**
 * Run Monte Carlo simulation over N iterations.
 * Each iteration samples all 6 parameters uniformly from their ranges
 * and computes a scenario score.
 *
 * @param params   DealParams with min/max ranges for each variable
 * @param iterations  Number of random scenarios (default: 1000)
 */
export function runMonteCarloSimulation(
  params: DealParams,
  iterations: number = 1000
): MonteCarloResult {
  const scores: number[] = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    const rgr  = uniformSample(params.revenue_growth_rate.min,   params.revenue_growth_rate.max);
    const gm   = uniformSample(params.gross_margin.min,          params.gross_margin.max);
    const ms   = uniformSample(params.market_size_usd.min,       params.market_size_usd.max);
    const cr   = uniformSample(params.churn_rate.min,            params.churn_rate.max);
    const ttp  = uniformSample(params.time_to_profitability.min, params.time_to_profitability.max);
    const pp   = uniformSample(params.pivot_probability.min,     params.pivot_probability.max);

    scores[i] = computeScenarioScore(rgr, gm, ms, cr, ttp, pp);
  }

  scores.sort((a, b) => a - b);

  const p10  = Math.round(percentile(scores, 10)  * 10) / 10;
  const p50  = Math.round(percentile(scores, 50)  * 10) / 10;
  const p90  = Math.round(percentile(scores, 90)  * 10) / 10;
  const mean = Math.round((scores.reduce((s, v) => s + v, 0) / iterations) * 10) / 10;

  // Standard deviation
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / iterations;
  const std = Math.round(Math.sqrt(variance) * 10) / 10;

  const upside_skew = (p90 - p50) > (p50 - p10);

  return { p10, p50, p90, mean, std, upside_skew, iterations, params };
}

// ── Distribution label ────────────────────────────────────────────────────────

/**
 * Derive a human-readable distribution label from Monte Carlo results.
 * Priority order matches the spec.
 */
export function getDistributionLabel(result: MonteCarloResult): string {
  if (result.upside_skew && result.p90 >= 70) {
    return "High upside potential";
  }
  if (result.std < 15) {
    return "Balanced risk profile";
  }
  if (result.std >= 25) {
    return "High uncertainty";
  }
  if (result.p10 < 30) {
    return "Downside risk";
  }
  return "Moderate risk profile";
}
