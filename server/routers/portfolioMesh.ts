/**
 * PortfolioMesh — Strategic Asset Allocation Engine
 * Procedures: IPS, Macro, Asset Class Agents, Portfolio Construction, CIO Output, History
 *
 * DATA RULES:
 * - LLM is used for reasoning/rationale only, NOT for math
 * - All portfolio math is deterministic server-side
 * - Mock/seeded data is clearly labelled
 * - System does NOT imply live trading or investment advice
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { ipsConfigs, portfolioRuns } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/mysql2";

type DbType = ReturnType<typeof drizzle>;

async function requireDb(): Promise<DbType> {
  const db = await getDb() as DbType | null;
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export const ASSET_CLASSES = [
  "US Equity",
  "International Equity",
  "Bonds",
  "Credit",
  "Gold",
  "Cash",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

// Historical baseline estimates (annualised, deterministic seed data)
// Source: long-run capital market assumptions (illustrative, not live)
const HISTORICAL_ESTIMATES: Record<AssetClass, { return: number; volatility: number }> = {
  "US Equity":             { return: 0.095, volatility: 0.175 },
  "International Equity":  { return: 0.082, volatility: 0.190 },
  "Bonds":                 { return: 0.038, volatility: 0.065 },
  "Credit":                { return: 0.055, volatility: 0.090 },
  "Gold":                  { return: 0.060, volatility: 0.155 },
  "Cash":                  { return: 0.052, volatility: 0.008 },
};

// Regime adjustments (additive delta to historical estimates)
const REGIME_ADJUSTMENTS: Record<string, Record<AssetClass, { returnDelta: number; volDelta: number }>> = {
  expansion: {
    "US Equity":            { returnDelta: +0.020, volDelta: -0.010 },
    "International Equity": { returnDelta: +0.015, volDelta: -0.005 },
    "Bonds":                { returnDelta: -0.010, volDelta: +0.005 },
    "Credit":               { returnDelta: +0.010, volDelta: -0.005 },
    "Gold":                 { returnDelta: -0.005, volDelta: +0.010 },
    "Cash":                 { returnDelta: +0.005, volDelta: 0 },
  },
  "late-cycle": {
    "US Equity":            { returnDelta: -0.015, volDelta: +0.020 },
    "International Equity": { returnDelta: -0.010, volDelta: +0.015 },
    "Bonds":                { returnDelta: +0.005, volDelta: -0.005 },
    "Credit":               { returnDelta: -0.005, volDelta: +0.010 },
    "Gold":                 { returnDelta: +0.015, volDelta: -0.005 },
    "Cash":                 { returnDelta: +0.010, volDelta: 0 },
  },
  recession: {
    "US Equity":            { returnDelta: -0.040, volDelta: +0.050 },
    "International Equity": { returnDelta: -0.035, volDelta: +0.045 },
    "Bonds":                { returnDelta: +0.020, volDelta: -0.010 },
    "Credit":               { returnDelta: -0.015, volDelta: +0.030 },
    "Gold":                 { returnDelta: +0.030, volDelta: +0.010 },
    "Cash":                 { returnDelta: +0.015, volDelta: 0 },
  },
  recovery: {
    "US Equity":            { returnDelta: +0.030, volDelta: -0.015 },
    "International Equity": { returnDelta: +0.025, volDelta: -0.010 },
    "Bonds":                { returnDelta: -0.005, volDelta: 0 },
    "Credit":               { returnDelta: +0.020, volDelta: -0.010 },
    "Gold":                 { returnDelta: +0.010, volDelta: +0.005 },
    "Cash":                 { returnDelta: +0.005, volDelta: 0 },
  },
};

// Correlation matrix (symmetric, deterministic)
const CORRELATION: Record<AssetClass, Record<AssetClass, number>> = {
  "US Equity":            { "US Equity": 1.00, "International Equity": 0.78, "Bonds": -0.15, "Credit": 0.55, "Gold": 0.02, "Cash": -0.05 },
  "International Equity": { "US Equity": 0.78, "International Equity": 1.00, "Bonds": -0.10, "Credit": 0.50, "Gold": 0.05, "Cash": -0.03 },
  "Bonds":                { "US Equity": -0.15, "International Equity": -0.10, "Bonds": 1.00, "Credit": 0.40, "Gold": 0.15, "Cash": 0.10 },
  "Credit":               { "US Equity": 0.55, "International Equity": 0.50, "Bonds": 0.40, "Credit": 1.00, "Gold": 0.05, "Cash": 0.05 },
  "Gold":                 { "US Equity": 0.02, "International Equity": 0.05, "Bonds": 0.15, "Credit": 0.05, "Gold": 1.00, "Cash": 0.00 },
  "Cash":                 { "US Equity": -0.05, "International Equity": -0.03, "Bonds": 0.10, "Credit": 0.05, "Gold": 0.00, "Cash": 1.00 },
};

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function round4(n: number) { return Math.round(n * 10000) / 10000; }

function portfolioReturn(weights: Record<AssetClass, number>, returns: Record<AssetClass, number>): number {
  return ASSET_CLASSES.reduce((sum, a) => sum + (weights[a] ?? 0) * (returns[a] ?? 0), 0);
}

function portfolioVolatility(weights: Record<AssetClass, number>, vols: Record<AssetClass, number>): number {
  let variance = 0;
  for (const a of ASSET_CLASSES) {
    for (const b of ASSET_CLASSES) {
      variance += (weights[a] ?? 0) * (weights[b] ?? 0) * vols[a] * vols[b] * CORRELATION[a][b];
    }
  }
  return Math.sqrt(Math.max(variance, 0));
}

function sharpe(ret: number, vol: number, rf = 0.05): number {
  return vol === 0 ? 0 : (ret - rf) / vol;
}

// Equal Weight
function equalWeight(): Record<AssetClass, number> {
  const w = 1 / ASSET_CLASSES.length;
  return Object.fromEntries(ASSET_CLASSES.map(a => [a, w])) as Record<AssetClass, number>;
}

// Maximum Sharpe (gradient-free grid search, deterministic)
function maxSharpe(
  returns: Record<AssetClass, number>,
  vols: Record<AssetClass, number>,
  constraints: Record<AssetClass, { min: number; max: number }>,
): Record<AssetClass, number> {
  let best = -Infinity;
  let bestW = equalWeight();
  // 500 random weight draws — deterministic via seeded pseudo-random
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < 2000; i++) {
    const raw = ASSET_CLASSES.map(() => rand());
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = Object.fromEntries(ASSET_CLASSES.map((a, idx) => [a, raw[idx] / sum])) as Record<AssetClass, number>;
    // Apply constraints
    let valid = true;
    for (const a of ASSET_CLASSES) {
      const c = constraints[a] ?? { min: 0, max: 1 };
      if (w[a] < c.min || w[a] > c.max) { valid = false; break; }
    }
    if (!valid) continue;
    const s = sharpe(portfolioReturn(w, returns), portfolioVolatility(w, vols));
    if (s > best) { best = s; bestW = w; }
  }
  return bestW;
}

// Risk Parity
function riskParity(vols: Record<AssetClass, number>): Record<AssetClass, number> {
  const invVol = ASSET_CLASSES.map(a => 1 / Math.max(vols[a], 0.001));
  const sum = invVol.reduce((a, b) => a + b, 0);
  return Object.fromEntries(ASSET_CLASSES.map((a, i) => [a, invVol[i] / sum])) as Record<AssetClass, number>;
}

// Minimum Variance (same grid search, minimise vol)
function minVariance(
  vols: Record<AssetClass, number>,
  constraints: Record<AssetClass, { min: number; max: number }>,
): Record<AssetClass, number> {
  let best = Infinity;
  let bestW = equalWeight();
  let seed = 99;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < 2000; i++) {
    const raw = ASSET_CLASSES.map(() => rand());
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = Object.fromEntries(ASSET_CLASSES.map((a, idx) => [a, raw[idx] / sum])) as Record<AssetClass, number>;
    let valid = true;
    for (const a of ASSET_CLASSES) {
      const c = constraints[a] ?? { min: 0, max: 1 };
      if (w[a] < c.min || w[a] > c.max) { valid = false; break; }
    }
    if (!valid) continue;
    const v = portfolioVolatility(w, vols);
    if (v < best) { best = v; bestW = w; }
  }
  return bestW;
}

// Maximum Diversification (maximise diversification ratio)
function maxDiversification(
  vols: Record<AssetClass, number>,
  constraints: Record<AssetClass, { min: number; max: number }>,
): Record<AssetClass, number> {
  let best = -Infinity;
  let bestW = equalWeight();
  let seed = 777;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < 2000; i++) {
    const raw = ASSET_CLASSES.map(() => rand());
    const sum = raw.reduce((a, b) => a + b, 0);
    const w = Object.fromEntries(ASSET_CLASSES.map((a, idx) => [a, raw[idx] / sum])) as Record<AssetClass, number>;
    let valid = true;
    for (const a of ASSET_CLASSES) {
      const c = constraints[a] ?? { min: 0, max: 1 };
      if (w[a] < c.min || w[a] > c.max) { valid = false; break; }
    }
    if (!valid) continue;
    const weightedAvgVol = ASSET_CLASSES.reduce((s, a) => s + w[a] * vols[a], 0);
    const portVol = portfolioVolatility(w, vols);
    const dr = portVol === 0 ? 0 : weightedAvgVol / portVol;
    if (dr > best) { best = dr; bestW = w; }
  }
  return bestW;
}

function buildConstructionResult(
  method: string,
  weights: Record<AssetClass, number>,
  returns: Record<AssetClass, number>,
  vols: Record<AssetClass, number>,
) {
  const ret = portfolioReturn(weights, returns);
  const vol = portfolioVolatility(weights, vols);
  const sr = sharpe(ret, vol);
  // Diversification indicator: number of assets with weight > 5%
  const diversification = ASSET_CLASSES.filter(a => (weights[a] ?? 0) > 0.05).length;
  return {
    method,
    weights: Object.fromEntries(ASSET_CLASSES.map(a => [a, round4(weights[a] ?? 0)])),
    expectedReturn: round4(ret),
    expectedVolatility: round4(vol),
    sharpe: round4(sr),
    diversification,
  };
}

// IPS compliance check
function checkIpsCompliance(
  ret: number,
  vol: number,
  ips: { targetReturn: number; targetVolatilityMin: number; targetVolatilityMax: number; maxDrawdown: number },
): { compliant: boolean; issues: string[] } {
  const issues: string[] = [];
  if (ret < ips.targetReturn) issues.push(`Expected return ${(ret * 100).toFixed(1)}% is below target ${(ips.targetReturn * 100).toFixed(1)}%`);
  if (vol < ips.targetVolatilityMin) issues.push(`Volatility ${(vol * 100).toFixed(1)}% is below minimum ${(ips.targetVolatilityMin * 100).toFixed(1)}%`);
  if (vol > ips.targetVolatilityMax) issues.push(`Volatility ${(vol * 100).toFixed(1)}% exceeds maximum ${(ips.targetVolatilityMax * 100).toFixed(1)}%`);
  // Approximate max drawdown as 2x annual vol (rule of thumb)
  const approxMaxDD = vol * 2;
  if (approxMaxDD > ips.maxDrawdown) issues.push(`Estimated max drawdown ~${(approxMaxDD * 100).toFixed(1)}% may exceed limit ${(ips.maxDrawdown * 100).toFixed(1)}%`);
  return { compliant: issues.length === 0, issues };
}

// ─── IPS Schema ───────────────────────────────────────────────────────────────

const constraintSchema = z.object({
  "US Equity":            z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }),
  "International Equity": z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }),
  "Bonds":                z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }),
  "Credit":               z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }),
  "Gold":                 z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }),
  "Cash":                 z.object({ min: z.number().min(0).max(1), max: z.number().min(0).max(1) }),
});

const ipsInputSchema = z.object({
  name: z.string().min(1).max(255).default("My IPS"),
  constraints: constraintSchema,
  targetReturn: z.number().min(0).max(1),
  targetVolatilityMin: z.number().min(0).max(1),
  targetVolatilityMax: z.number().min(0).max(1),
  maxDrawdown: z.number().min(0).max(1),
  benchmark: z.string().default("60/40"),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const portfolioMeshRouter = router({

  // ── IPS: Save ──────────────────────────────────────────────────────────────
  saveIps: protectedProcedure
    .input(ipsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [existing] = await db
        .select({ id: ipsConfigs.id })
        .from(ipsConfigs)
        .where(eq(ipsConfigs.userId, ctx.user.id))
        .limit(1);

      const values = {
        userId: ctx.user.id,
        name: input.name,
        constraints: JSON.stringify(input.constraints),
        targetReturn: String(input.targetReturn),
        targetVolatilityMin: String(input.targetVolatilityMin),
        targetVolatilityMax: String(input.targetVolatilityMax),
        maxDrawdown: String(input.maxDrawdown),
        benchmark: input.benchmark,
      };

      if (existing) {
        await db.update(ipsConfigs).set(values).where(eq(ipsConfigs.id, existing.id));
        return { id: existing.id, ...input };
      } else {
        const [result] = await db.insert(ipsConfigs).values(values) as unknown as [{ insertId: number }, unknown];
        return { id: result.insertId, ...input };
      }
    }),

  // ── IPS: Get ───────────────────────────────────────────────────────────────
  getIps: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [row] = await db
      .select()
      .from(ipsConfigs)
      .where(eq(ipsConfigs.userId, ctx.user.id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      constraints: JSON.parse(row.constraints) as Record<AssetClass, { min: number; max: number }>,
      targetReturn: parseFloat(row.targetReturn),
      targetVolatilityMin: parseFloat(row.targetVolatilityMin),
      targetVolatilityMax: parseFloat(row.targetVolatilityMax),
      maxDrawdown: parseFloat(row.maxDrawdown),
      benchmark: row.benchmark,
    };
  }),

  // ── Macro: Classify Regime ─────────────────────────────────────────────────
  classifyMacro: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      const llmResp = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a macro regime classification engine for institutional asset allocation.
Classify the current global macro environment into exactly one of: expansion, late-cycle, recession, recovery.
Use the following signals as context (as of early 2026):
- US GDP growth: ~2.3% annualised, slowing from 2024 highs
- Global PMI: 51.2 (marginal expansion)
- US yield curve: partially inverted (2Y-10Y spread: -15bps)
- Inflation: 3.1% CPI, above Fed target but declining
- Fed policy: rates at 4.75%, one cut expected in H2 2026
- Credit spreads: IG at 95bps (tight), HY at 310bps (elevated)
- Equity valuations: S&P 500 P/E ~21x (above long-run average)

Respond in JSON only:
{
  "regime": "expansion|late-cycle|recession|recovery",
  "confidence": 0.0-1.0,
  "rationale": "2-3 sentence explanation"
}`,
          },
          { role: "user", content: "Classify the current macro regime." },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "macro_regime",
            strict: true,
            schema: {
              type: "object",
              properties: {
                regime: { type: "string", enum: ["expansion", "late-cycle", "recession", "recovery"] },
                confidence: { type: "number" },
                rationale: { type: "string" },
              },
              required: ["regime", "confidence", "rationale"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = llmResp.choices[0].message.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : content;

      const db = await requireDb();
      await db.update(portfolioRuns)
        .set({
          macroRegime: parsed.regime,
          macroConfidence: String(Math.min(1, Math.max(0, parsed.confidence))),
          macroRationale: parsed.rationale,
          status: "macro_done",
        })
        .where(eq(portfolioRuns.id, input.runId));

      return {
        regime: parsed.regime as string,
        confidence: parsed.confidence as number,
        rationale: parsed.rationale as string,
      };
    }),

  // ── Asset Class Agents ─────────────────────────────────────────────────────
  runAssetAgents: protectedProcedure
    .input(z.object({ runId: z.number(), regime: z.string() }))
    .mutation(async ({ input }) => {
      const regime = input.regime as keyof typeof REGIME_ADJUSTMENTS;
      const adj = REGIME_ADJUSTMENTS[regime] ?? REGIME_ADJUSTMENTS["expansion"];

      const estimates = ASSET_CLASSES.map((asset) => {
        const hist = HISTORICAL_ESTIMATES[asset];
        const regAdj = adj[asset];
        const regimeReturn = hist.return + regAdj.returnDelta;
        const regimeVol = Math.max(0.001, hist.volatility + regAdj.volDelta);
        // Blended: 60% regime-adjusted, 40% historical
        const blendedReturn = 0.6 * regimeReturn + 0.4 * hist.return;
        const blendedVol = 0.6 * regimeVol + 0.4 * hist.volatility;
        const confidence = regime === "expansion" || regime === "recovery" ? 0.78 : 0.72;

        return {
          asset,
          historicalReturn: round4(hist.return),
          historicalVolatility: round4(hist.volatility),
          regimeReturn: round4(regimeReturn),
          regimeVolatility: round4(regimeVol),
          blendedReturn: round4(blendedReturn),
          blendedVolatility: round4(blendedVol),
          finalReturn: round4(blendedReturn),
          finalVolatility: round4(blendedVol),
          confidence,
          rationale: `${regime.charAt(0).toUpperCase() + regime.slice(1)} regime ${regAdj.returnDelta >= 0 ? "supports" : "pressures"} ${asset}. Blended estimate weights regime-adjusted (60%) over historical (40%).`,
        };
      });

      const db = await requireDb();
      await db.update(portfolioRuns)
        .set({ assetEstimates: JSON.stringify(estimates), status: "assets_done" })
        .where(eq(portfolioRuns.id, input.runId));

      return estimates;
    }),

  // ── Portfolio Construction ─────────────────────────────────────────────────
  constructPortfolios: protectedProcedure
    .input(z.object({
      runId: z.number(),
      assetEstimates: z.array(z.object({
        asset: z.string(),
        finalReturn: z.number(),
        finalVolatility: z.number(),
      })),
      constraints: constraintSchema,
    }))
    .mutation(async ({ input }) => {
      const returns = Object.fromEntries(
        input.assetEstimates.map(e => [e.asset, e.finalReturn])
      ) as Record<AssetClass, number>;
      const vols = Object.fromEntries(
        input.assetEstimates.map(e => [e.asset, e.finalVolatility])
      ) as Record<AssetClass, number>;
      const constraints = input.constraints as Record<AssetClass, { min: number; max: number }>;

      const results = [
        buildConstructionResult("Equal Weight", equalWeight(), returns, vols),
        buildConstructionResult("Maximum Sharpe", maxSharpe(returns, vols, constraints), returns, vols),
        buildConstructionResult("Risk Parity", riskParity(vols), returns, vols),
        buildConstructionResult("Minimum Variance", minVariance(vols, constraints), returns, vols),
        buildConstructionResult("Maximum Diversification", maxDiversification(vols, constraints), returns, vols),
      ];

      const db = await requireDb();
      await db.update(portfolioRuns)
        .set({ constructionResults: JSON.stringify(results), status: "construction_done" })
        .where(eq(portfolioRuns.id, input.runId));

      return results;
    }),

  // ── CIO Output ─────────────────────────────────────────────────────────────
  generateCioOutput: protectedProcedure
    .input(z.object({
      runId: z.number(),
      constructionResults: z.array(z.object({
        method: z.string(),
        weights: z.record(z.string(), z.number()),
        expectedReturn: z.number(),
        expectedVolatility: z.number(),
        sharpe: z.number(),
        diversification: z.number(),
      })),
      macroRegime: z.string(),
      ipsSnapshot: z.object({
        targetReturn: z.number(),
        targetVolatilityMin: z.number(),
        targetVolatilityMax: z.number(),
        maxDrawdown: z.number(),
        benchmark: z.string(),
      }),
    }))
    .mutation(async ({ input }) => {
      // Sort by Sharpe, pick top 3
      const sorted = [...input.constructionResults].sort((a, b) => b.sharpe - a.sharpe);
      const top3 = sorted.slice(0, 3);

      // CIO blends top 2 with 60/40 weighting
      const w1 = top3[0].weights as Record<AssetClass, number>;
      const w2 = top3[1].weights as Record<AssetClass, number>;
      const cioWeights = Object.fromEntries(
        ASSET_CLASSES.map(a => [a, round4(0.6 * (w1[a] ?? 0) + 0.4 * (w2[a] ?? 0))])
      ) as Record<AssetClass, number>;

      const returns = Object.fromEntries(
        ASSET_CLASSES.map(a => [a, ((w1[a] ?? 0) * top3[0].expectedReturn + (w2[a] ?? 0) * top3[1].expectedReturn) / 2])
      ) as Record<AssetClass, number>;
      const vols = Object.fromEntries(
        ASSET_CLASSES.map(a => [a, HISTORICAL_ESTIMATES[a].volatility])
      ) as Record<AssetClass, number>;

      const cioReturn = round4(portfolioReturn(cioWeights, returns));
      const cioVol = round4(portfolioVolatility(cioWeights, vols));
      const cioSharpe = round4(sharpe(cioReturn, cioVol));

      const compliance = checkIpsCompliance(cioReturn, cioVol, input.ipsSnapshot);

      // Build 60/40 benchmark weights for comparison
      const bench6040: Record<AssetClass, number> = {
        "US Equity": 0.40, "International Equity": 0.20, "Bonds": 0.40,
        "Credit": 0.00, "Gold": 0.00, "Cash": 0.00,
      };
      const equityWeight = round4((cioWeights["US Equity"] ?? 0) + (cioWeights["International Equity"] ?? 0));
      const bondWeight = round4((cioWeights["Bonds"] ?? 0) + (cioWeights["Credit"] ?? 0));
      const altWeight = round4(cioWeights["Gold"] ?? 0);
      const cashWeight = round4(cioWeights["Cash"] ?? 0);
      void bench6040; // used in prompt below

      // LLM generates the Board Memo (reasoning only, not math)
      const memoPrompt = `You are the Chief Investment Officer of an institutional asset management firm.
You are writing a formal Board Memo for an Investment Committee. Your tone must be institutional, calm, precise, and authoritative.
Do NOT use hype language, vague statements, or AI-generated filler. Every sentence must be defensible and decision-oriented.

DATA PROVIDED (do not invent numbers — use only what is given):
MACRO REGIME: ${input.macroRegime}
FINAL ALLOCATION: ${JSON.stringify(cioWeights, null, 2)}
EXPECTED RETURN: ${(cioReturn * 100).toFixed(2)}%
EXPECTED VOLATILITY: ${(cioVol * 100).toFixed(2)}%
SHARPE RATIO: ${cioSharpe}
EQUITY WEIGHT: ${(equityWeight * 100).toFixed(1)}% (benchmark: 60%)
BOND+CREDIT WEIGHT: ${(bondWeight * 100).toFixed(1)}% (benchmark: 40%)
ALTERNATIVES (Gold): ${(altWeight * 100).toFixed(1)}% (benchmark: 0%)
CASH: ${(cashWeight * 100).toFixed(1)}%
IPS COMPLIANT: ${compliance.compliant}
IPS ISSUES: ${compliance.issues.join("; ") || "None"}
BENCHMARK: ${input.ipsSnapshot.benchmark}
TARGET RETURN: ${(input.ipsSnapshot.targetReturn * 100).toFixed(1)}%
VOLATILITY RANGE: ${(input.ipsSnapshot.targetVolatilityMin * 100).toFixed(1)}%–${(input.ipsSnapshot.targetVolatilityMax * 100).toFixed(1)}%
MAX DRAWDOWN LIMIT: ${(input.ipsSnapshot.maxDrawdown * 100).toFixed(1)}%
APPROX MAX DRAWDOWN: ${(cioVol * 2 * 100).toFixed(1)}%
TOP CONSTRUCTION METHODS: ${top3.map(m => m.method).join(", ")}

PRODUCE A BOARD MEMO WITH EXACTLY THESE 9 SECTIONS:

1. executiveSummary: Array of exactly 3-4 bullet strings. Opinion-first: lead with the recommendation, then macro positioning, then portfolio stance (risk-on/defensive/balanced). No generic language.

2. macroRegime: Object with:
   - regime: string (e.g. "Late-Cycle")
   - confidenceLevel: string ("High", "Medium", or "Low")
   - rationale: string (2-3 sentences covering growth, inflation, policy, and market conditions — be specific, no filler)

3. allocationTable: Array of 6 objects, one per asset class:
   - asset: string
   - weight: number (as decimal, e.g. 0.35)
   - role: string (one of: "growth driver", "defensive hedge", "income stabilizer", "inflation hedge", "liquidity buffer", "return enhancer")

4. constructionLogic: Object with:
   - topMethods: string (name the top 2 construction methods used and why they were selected over alternatives)
   - blendRationale: string (explain the 60/40 blend of top 2 methods — what each contributes to the final portfolio)
   - methodAttribution: string (which method drove the largest allocation decisions and why)

5. benchmarkComparison: Object with:
   - equityDelta: string (e.g. "Underweight equities by 8.5% vs 60/40 benchmark due to late-cycle risk")
   - bondDelta: string
   - alternativesDelta: string
   - cashDelta: string
   - summary: string (1-2 sentences plain English explaining the overall positioning vs benchmark)

6. keyAllocationDecisions: Array of 4-6 strings. Each must explain WHY a specific asset is overweight or underweight. Be explicit and logical. No vague language.

7. riskAssessment: Array of 3-5 objects:
   - risk: string (e.g. "Inflation re-acceleration")
   - portfolioImpact: string (what specifically happens to this portfolio if this risk materialises)
   - severity: string ("High", "Medium", or "Low")

8. whatWouldChangeView: Array of 3-5 strings. Each must be a specific, observable condition that would cause the CIO to revise this allocation. Examples: "If central bank pivots to rate cuts within 90 days, increase duration exposure", "If inflation re-accelerates above 4%, reduce bond allocation by 10%".

9. ipsCompliance: Object with:
   - status: string ("Compliant" or "Breach Detected")
   - volatilityCheck: string (state actual vs range)
   - drawdownCheck: string (state estimated vs limit)
   - returnCheck: string (state expected vs target)
   - notes: string (any additional compliance observations)

Also include:
- rebalanceTriggers: Array of 3-5 strings. Each must be a specific, measurable condition.
- disclaimer: string (short, professional — decision-support only, requires human approval before implementation)

Respond in valid JSON only. No markdown. No extra keys.`;

      const memoResp = await invokeLLM({
        messages: [
          { role: "system", content: memoPrompt },
          { role: "user", content: "Generate the Board Memo." },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "board_memo",
            strict: true,
            schema: {
              type: "object",
              properties: {
                executiveSummary: { type: "array", items: { type: "string" } },
                macroRegime: {
                  type: "object",
                  properties: {
                    regime: { type: "string" },
                    confidenceLevel: { type: "string" },
                    rationale: { type: "string" },
                  },
                  required: ["regime", "confidenceLevel", "rationale"],
                  additionalProperties: false,
                },
                allocationTable: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      asset: { type: "string" },
                      weight: { type: "number" },
                      role: { type: "string" },
                    },
                    required: ["asset", "weight", "role"],
                    additionalProperties: false,
                  },
                },
                benchmarkComparison: {
                  type: "object",
                  properties: {
                    equityDelta: { type: "string" },
                    bondDelta: { type: "string" },
                    alternativesDelta: { type: "string" },
                    cashDelta: { type: "string" },
                    summary: { type: "string" },
                  },
                  required: ["equityDelta", "bondDelta", "alternativesDelta", "cashDelta", "summary"],
                  additionalProperties: false,
                },
                keyAllocationDecisions: { type: "array", items: { type: "string" } },
                riskAssessment: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      risk: { type: "string" },
                      portfolioImpact: { type: "string" },
                      severity: { type: "string" },
                    },
                    required: ["risk", "portfolioImpact", "severity"],
                    additionalProperties: false,
                  },
                },
                rebalanceTriggers: { type: "array", items: { type: "string" } },
                ipsCompliance: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    volatilityCheck: { type: "string" },
                    drawdownCheck: { type: "string" },
                    returnCheck: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["status", "volatilityCheck", "drawdownCheck", "returnCheck", "notes"],
                  additionalProperties: false,
                },
                constructionLogic: {
                  type: "object",
                  properties: {
                    topMethods: { type: "string" },
                    blendRationale: { type: "string" },
                    methodAttribution: { type: "string" },
                  },
                  required: ["topMethods", "blendRationale", "methodAttribution"],
                  additionalProperties: false,
                },
                whatWouldChangeView: { type: "array", items: { type: "string" } },
                disclaimer: { type: "string" },
              },
              required: ["executiveSummary", "macroRegime", "allocationTable", "constructionLogic", "benchmarkComparison", "keyAllocationDecisions", "riskAssessment", "whatWouldChangeView", "rebalanceTriggers", "ipsCompliance", "disclaimer"],
              additionalProperties: false,
            },
          },
        },
      });

      const memoContent = memoResp.choices[0].message.content;
      const boardMemo = typeof memoContent === "string" ? JSON.parse(memoContent) : memoContent;

      const db = await requireDb();
      await db.update(portfolioRuns)
        .set({
          cioWeights: JSON.stringify(cioWeights),
          cioExpectedReturn: String(cioReturn),
          cioExpectedVolatility: String(cioVol),
          cioSharpe: String(cioSharpe),
          cioRisks: JSON.stringify(compliance.issues),
          ipsCompliant: compliance.compliant,
          boardMemo: JSON.stringify(boardMemo),
          status: "complete",
        })
        .where(eq(portfolioRuns.id, input.runId));

      return {
        cioWeights,
        cioExpectedReturn: cioReturn,
        cioExpectedVolatility: cioVol,
        cioSharpe,
        ipsCompliant: compliance.compliant,
        ipsIssues: compliance.issues,
        boardMemo,
        topMethods: top3.map(m => m.method),
      };
    }),

  // ── Create Run ─────────────────────────────────────────────────────────────
  createRun: protectedProcedure
    .input(z.object({
      ipsConfigId: z.number().optional(),
      ipsSnapshot: z.object({
        name: z.string(),
        constraints: constraintSchema,
        targetReturn: z.number(),
        targetVolatilityMin: z.number(),
        targetVolatilityMax: z.number(),
        maxDrawdown: z.number(),
        benchmark: z.string(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      // Omit ipsConfigId entirely when not provided — passing null causes
      // Drizzle to serialize it as an empty string in some MySQL driver versions
      const baseValues = {
        userId: ctx.user.id,
        ipsSnapshot: JSON.stringify(input.ipsSnapshot),
        status: "draft" as const,
      };
      const insertValues = input.ipsConfigId !== undefined
        ? { ...baseValues, ipsConfigId: input.ipsConfigId }
        : baseValues;
      const [result] = await db.insert(portfolioRuns).values(insertValues) as unknown as [{ insertId: number }, unknown];
      return { runId: result.insertId };
    }),

  // ── Benchmark: Save ────────────────────────────────────────────────────────
  saveBenchmark: protectedProcedure
    .input(z.object({
      runId: z.number(),
      label: z.string().max(128).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      // Verify ownership
      const [run] = await db.select({ id: portfolioRuns.id, userId: portfolioRuns.userId })
        .from(portfolioRuns).where(eq(portfolioRuns.id, input.runId)).limit(1);
      if (!run || run.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      // Clear any existing benchmark for this user
      await db.update(portfolioRuns)
        .set({ isBenchmark: false, benchmarkLabel: null })
        .where(eq(portfolioRuns.userId, ctx.user.id));
      // Set new benchmark
      await db.update(portfolioRuns)
        .set({ isBenchmark: true, benchmarkLabel: input.label ?? "My Benchmark" })
        .where(eq(portfolioRuns.id, input.runId));
      return { ok: true };
    }),

  // ── Benchmark: Get ─────────────────────────────────────────────────────────
  getBenchmark: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const [row] = await db
      .select({
        id: portfolioRuns.id,
        benchmarkLabel: portfolioRuns.benchmarkLabel,
        cioWeights: portfolioRuns.cioWeights,
        cioExpectedReturn: portfolioRuns.cioExpectedReturn,
        cioExpectedVolatility: portfolioRuns.cioExpectedVolatility,
        cioSharpe: portfolioRuns.cioSharpe,
        macroRegime: portfolioRuns.macroRegime,
        createdAt: portfolioRuns.createdAt,
      })
      .from(portfolioRuns)
      .where(and(eq(portfolioRuns.userId, ctx.user.id), eq(portfolioRuns.isBenchmark, true)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      label: row.benchmarkLabel ?? "My Benchmark",
      cioWeights: row.cioWeights ? JSON.parse(row.cioWeights) : null,
      cioExpectedReturn: row.cioExpectedReturn ? parseFloat(row.cioExpectedReturn) : null,
      cioExpectedVolatility: row.cioExpectedVolatility ? parseFloat(row.cioExpectedVolatility) : null,
      cioSharpe: row.cioSharpe ? parseFloat(row.cioSharpe) : null,
      macroRegime: row.macroRegime,
      createdAt: row.createdAt,
    };
  }),

  // ── Benchmark: Compare ─────────────────────────────────────────────────────
  compareToBenchmark: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      // Get the current run
      const [run] = await db.select()
        .from(portfolioRuns)
        .where(and(eq(portfolioRuns.id, input.runId), eq(portfolioRuns.userId, ctx.user.id)))
        .limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      const runReturn = run.cioExpectedReturn ? parseFloat(run.cioExpectedReturn) : null;
      const runVol = run.cioExpectedVolatility ? parseFloat(run.cioExpectedVolatility) : null;
      const runSharpe = run.cioSharpe ? parseFloat(run.cioSharpe) : null;
      const runWeights: Record<string, number> = run.cioWeights ? JSON.parse(run.cioWeights) : {};
      // Try user's pinned benchmark first
      const [bench] = await db
        .select()
        .from(portfolioRuns)
        .where(and(eq(portfolioRuns.userId, ctx.user.id), eq(portfolioRuns.isBenchmark, true)))
        .limit(1);
      // Fall back to 60/40 synthetic benchmark
      const benchLabel = bench?.benchmarkLabel ?? "60/40 Blend";
      const benchReturn = bench?.cioExpectedReturn ? parseFloat(bench.cioExpectedReturn) : 0.065;
      const benchVol = bench?.cioExpectedVolatility ? parseFloat(bench.cioExpectedVolatility) : 0.10;
      const benchSharpe = bench?.cioSharpe ? parseFloat(bench.cioSharpe) : 0.55;
      const benchWeights: Record<string, number> = bench?.cioWeights
        ? JSON.parse(bench.cioWeights)
        : { "US Equity": 0.40, "International Equity": 0.20, "Bonds": 0.40, "Credit": 0.00, "Gold": 0.00, "Cash": 0.00 };
      // Compute deltas
      const returnDelta = runReturn !== null ? runReturn - benchReturn : null;
      const volDelta = runVol !== null ? runVol - benchVol : null;
      const sharpeDelta = runSharpe !== null ? runSharpe - benchSharpe : null;
      // Largest allocation shifts
      const allAssets = Array.from(new Set([...Object.keys(runWeights), ...Object.keys(benchWeights)]));
      const allocationShifts = allAssets
        .map(asset => ({
          asset,
          runWeight: runWeights[asset] ?? 0,
          benchWeight: benchWeights[asset] ?? 0,
          delta: (runWeights[asset] ?? 0) - (benchWeights[asset] ?? 0),
        }))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 4);
      return {
        benchmarkLabel: benchLabel,
        isUserBenchmark: !!bench,
        returnDelta,
        volDelta,
        sharpeDelta,
        runReturn,
        runVol,
        runSharpe,
        benchReturn,
        benchVol,
        benchSharpe,
        allocationShifts,
      };
    }),

  // ── History: List ──────────────────────────────────────────────────────────
  listRuns: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db
      .select({
        id: portfolioRuns.id,
        status: portfolioRuns.status,
        macroRegime: portfolioRuns.macroRegime,
        ipsSnapshot: portfolioRuns.ipsSnapshot,
        cioExpectedReturn: portfolioRuns.cioExpectedReturn,
        cioExpectedVolatility: portfolioRuns.cioExpectedVolatility,
        cioSharpe: portfolioRuns.cioSharpe,
        ipsCompliant: portfolioRuns.ipsCompliant,
        isBenchmark: portfolioRuns.isBenchmark,
        benchmarkLabel: portfolioRuns.benchmarkLabel,
        boardMemo: portfolioRuns.boardMemo,
        createdAt: portfolioRuns.createdAt,
      })
      .from(portfolioRuns)
      .where(eq(portfolioRuns.userId, ctx.user.id))
      .orderBy(desc(portfolioRuns.createdAt))
      .limit(50);

    return rows.map((r: typeof rows[0]) => ({
      id: r.id,
      status: r.status,
      macroRegime: r.macroRegime,
      ipsName: (() => { try { return JSON.parse(r.ipsSnapshot).name; } catch { return "IPS"; } })(),
      cioExpectedReturn: r.cioExpectedReturn ? parseFloat(r.cioExpectedReturn) : null,
      cioExpectedVolatility: r.cioExpectedVolatility ? parseFloat(r.cioExpectedVolatility) : null,
      cioSharpe: r.cioSharpe ? parseFloat(r.cioSharpe) : null,
      ipsCompliant: r.ipsCompliant,
      isBenchmark: r.isBenchmark,
      benchmarkLabel: r.benchmarkLabel,
      hasMemo: !!r.boardMemo,
      createdAt: r.createdAt,
    }));
  }),

  // ── History: Get Single Run ────────────────────────────────────────────────
  getRun: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(portfolioRuns)
        .where(eq(portfolioRuns.id, input.runId))
        .limit(1);
      if (!row || row.userId !== ctx.user.id) return null;
      return {
        ...row,
        ipsSnapshot: JSON.parse(row.ipsSnapshot),
        assetEstimates: row.assetEstimates ? JSON.parse(row.assetEstimates) : null,
        constructionResults: row.constructionResults ? JSON.parse(row.constructionResults) : null,
        cioWeights: row.cioWeights ? JSON.parse(row.cioWeights) : null,
        cioRisks: row.cioRisks ? JSON.parse(row.cioRisks) : null,
        boardMemo: row.boardMemo ? JSON.parse(row.boardMemo) : null,
        cioExpectedReturn: row.cioExpectedReturn ? parseFloat(row.cioExpectedReturn) : null,
        cioExpectedVolatility: row.cioExpectedVolatility ? parseFloat(row.cioExpectedVolatility) : null,
        cioSharpe: row.cioSharpe ? parseFloat(row.cioSharpe) : null,
        macroConfidence: row.macroConfidence ? parseFloat(row.macroConfidence) : null,
        shareToken: row.shareToken,
      };
    }),

  // ── Share: Generate Token ───────────────────────────────────────────────────────────────
  generateShareToken: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select({ id: portfolioRuns.id, userId: portfolioRuns.userId, shareToken: portfolioRuns.shareToken })
        .from(portfolioRuns)
        .where(and(eq(portfolioRuns.id, input.runId), eq(portfolioRuns.userId, ctx.user.id)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      // Return existing token if already generated
      if (row.shareToken) return { shareToken: row.shareToken };
      // Generate a cryptographically random token
      const { randomBytes } = await import("crypto");
      const token = randomBytes(24).toString("base64url"); // 32-char URL-safe string
      await db
        .update(portfolioRuns)
        .set({ shareToken: token })
        .where(eq(portfolioRuns.id, input.runId));
      return { shareToken: token };
    }),

  // ── Share: Revoke Share Token ────────────────────────────────────────────────────
  revokeShare: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [row] = await db
        .select({ id: portfolioRuns.id, userId: portfolioRuns.userId })
        .from(portfolioRuns)
        .where(and(eq(portfolioRuns.id, input.runId), eq(portfolioRuns.userId, ctx.user.id)))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .update(portfolioRuns)
        .set({ shareToken: null })
        .where(eq(portfolioRuns.id, input.runId));
      return { revoked: true };
    }),

  // ── Share: Get Run by Token (public) ─────────────────────────────────────────────
  getRunByToken: publicProcedure
    .input(z.object({ token: z.string().min(8).max(64) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(portfolioRuns)
        .where(eq(portfolioRuns.shareToken, input.token))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found or has been revoked." });
      // Only expose run content — no userId, no private IDs
      return {
        id: row.id,
        macroRegime: row.macroRegime,
        macroConfidence: row.macroConfidence ? parseFloat(row.macroConfidence) : null,
        macroRationale: row.macroRationale,
        ipsSnapshot: JSON.parse(row.ipsSnapshot),
        cioExpectedReturn: row.cioExpectedReturn ? parseFloat(row.cioExpectedReturn) : null,
        cioExpectedVolatility: row.cioExpectedVolatility ? parseFloat(row.cioExpectedVolatility) : null,
        cioSharpe: row.cioSharpe ? parseFloat(row.cioSharpe) : null,
        ipsCompliant: row.ipsCompliant,
        boardMemo: row.boardMemo ? JSON.parse(row.boardMemo) : null,
        isBenchmark: row.isBenchmark,
        benchmarkLabel: row.benchmarkLabel,
        createdAt: row.createdAt,
      };
    }),
});
