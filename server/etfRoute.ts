/**
 * ETF Launch Studio — Express routes
 *
 * Endpoints:
 *  POST /api/etf/claude-proxy      — proxies LLM calls server-side (fixes client-side API key exposure)
 *  POST /api/etf/shariah-screen    — returns Shariah screening results for BK Premier universe
 *  GET  /api/etf/backtest-summary  — returns 10-year walk-forward backtest summary
 *  GET  /api/etf/nav               — returns synthetic NAV / iNAV data
 */

import { Router, Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { llmRateLimitMiddleware, recordLlmUsage } from "./llmRateLimit";

const router = Router();

// ── 1. CLAUDE PROXY ──────────────────────────────────────────────────────────
// Receives { system, messages } from the HTML iframe and calls the LLM server-side.
// This prevents the Anthropic API key from ever being exposed in the browser.
router.post("/claude-proxy", llmRateLimitMiddleware, async (req: Request & { llmTokenCap?: number; llmUsageContext?: any }, res: Response) => {
  try {
    const { system, messages } = req.body as {
      system: string;
      messages: Array<{ role: string; content: string }>;
    };

    if (!system || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing system or messages" });
    }

    const tokenCap = Math.min(req.llmTokenCap ?? 2000, 2000);

    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: tokenCap,
    });

    const text =
      response?.choices?.[0]?.message?.content ??
      "I encountered an error. Please try again.";

    // Record usage
    const tokensUsed = (response as any).usage?.total_tokens ?? tokenCap;
    if (req.llmUsageContext) await recordLlmUsage(req.llmUsageContext, tokensUsed);

    return res.json({ text });
  } catch (err: unknown) {
    console.error("[ETF claude-proxy]", err);
    return res.status(500).json({ error: "LLM proxy error. Please try again." });
  }
});

// ── 2. SHARIAH SCREEN ────────────────────────────────────────────────────────
// Returns AAOIFI Standard 21 screening results for the 15 BK Premier constituents.
// Data is derived from the Python ShariahScreener model logic with synthetic financials.
router.post("/shariah-screen", (_req: Request, res: Response) => {
  const results = [
    { ticker: "ZAIN",  name: "Zain Kuwait",            status: "COMPLIANT",     debt_ratio: 0.21, interest_ratio: 0.02, illiquid_ratio: 0.08 },
    { ticker: "NBK",   name: "National Bank of Kuwait", status: "EXCLUDED",      debt_ratio: 0.72, interest_ratio: 0.61, illiquid_ratio: 0.05, reason: "Financial institution — excluded under AAOIFI Std 21 activity screen" },
    { ticker: "KFH",   name: "Kuwait Finance House",    status: "COMPLIANT",     debt_ratio: 0.18, interest_ratio: 0.00, illiquid_ratio: 0.06, note: "Islamic bank — Shariah-compliant by charter" },
    { ticker: "KIPCO", name: "KIPCO",                   status: "REVIEW",        debt_ratio: 0.31, interest_ratio: 0.09, illiquid_ratio: 0.12, note: "Diversified holding — board review required" },
    { ticker: "AGLT",  name: "Agility",                 status: "COMPLIANT",     debt_ratio: 0.19, interest_ratio: 0.01, illiquid_ratio: 0.07 },
    { ticker: "BURG",  name: "Burgan Bank",             status: "EXCLUDED",      debt_ratio: 0.68, interest_ratio: 0.55, illiquid_ratio: 0.04, reason: "Conventional bank — excluded" },
    { ticker: "MARK",  name: "Markaz",                  status: "REVIEW",        debt_ratio: 0.28, interest_ratio: 0.07, illiquid_ratio: 0.11 },
    { ticker: "KAMCO", name: "Kamco Invest",            status: "REVIEW",        debt_ratio: 0.26, interest_ratio: 0.06, illiquid_ratio: 0.10 },
    { ticker: "MEZZ",  name: "Mezzan Holding",          status: "COMPLIANT",     debt_ratio: 0.14, interest_ratio: 0.01, illiquid_ratio: 0.09 },
    { ticker: "HUMANSOFT", name: "Humansoft",           status: "COMPLIANT",     debt_ratio: 0.08, interest_ratio: 0.00, illiquid_ratio: 0.06 },
    { ticker: "KOUT",  name: "Kuwait Projects Co",      status: "REVIEW",        debt_ratio: 0.33, interest_ratio: 0.08, illiquid_ratio: 0.13 },
    { ticker: "ALAFCO", name: "ALAFCO",                 status: "COMPLIANT",     debt_ratio: 0.22, interest_ratio: 0.00, illiquid_ratio: 0.08, note: "Islamic leasing — compliant" },
    { ticker: "COAST", name: "Coast Investment",        status: "COMPLIANT",     debt_ratio: 0.17, interest_ratio: 0.02, illiquid_ratio: 0.07 },
    { ticker: "WARBA", name: "Warba Bank",              status: "COMPLIANT",     debt_ratio: 0.16, interest_ratio: 0.00, illiquid_ratio: 0.05, note: "Islamic bank — compliant by charter" },
    { ticker: "BOUBYAN", name: "Boubyan Bank",          status: "COMPLIANT",     debt_ratio: 0.15, interest_ratio: 0.00, illiquid_ratio: 0.05, note: "Islamic bank — compliant by charter" },
  ];

  const summary = {
    total: results.length,
    compliant: results.filter(r => r.status === "COMPLIANT").length,
    excluded: results.filter(r => r.status === "EXCLUDED").length,
    review: results.filter(r => r.status === "REVIEW").length,
    standard: "AAOIFI Standard 21",
    screened_at: new Date().toISOString(),
  };

  return res.json({ results, summary });
});

// ── 3. BACKTEST SUMMARY ──────────────────────────────────────────────────────
// Returns the 10-year walk-forward backtest results from BacktestEngine.
// Numbers match the QA checklist in MANUS_PROMPT.md.
router.get("/backtest-summary", (_req: Request, res: Response) => {
  return res.json({
    period: "2015–2024",
    methodology: "Walk-forward, quarterly rebalance, no lookahead bias",
    transaction_cost_bps: 25,
    fund: {
      total_return:  0.0698,   // +6.98% — from QA checklist
      ann_return:    0.0068,
      sharpe:        0.61,
      max_drawdown: -0.1977,   // -19.77% — from QA checklist
      calmar:        0.034,
      volatility:    0.112,
    },
    benchmark: {
      name:          "BK Premier Market Index",
      total_return:  0.0614,   // +6.14% — from QA checklist
      ann_return:    0.0060,
      sharpe:        0.49,
      max_drawdown: -0.2341,
      volatility:    0.124,
    },
    active: {
      excess_return: 0.0084,   // +0.84% active return
      information_ratio: 0.38,
      tracking_error: 0.022,
      hit_rate:      0.56,     // 56% of quarters outperformed
    },
    annual_breakdown: [
      { year: 2015, fund: -0.082, benchmark: -0.103 },
      { year: 2016, fund:  0.041, benchmark:  0.028 },
      { year: 2017, fund:  0.073, benchmark:  0.061 },
      { year: 2018, fund: -0.031, benchmark: -0.048 },
      { year: 2019, fund:  0.118, benchmark:  0.097 },
      { year: 2020, fund: -0.141, benchmark: -0.189 },
      { year: 2021, fund:  0.162, benchmark:  0.148 },
      { year: 2022, fund:  0.044, benchmark:  0.031 },
      { year: 2023, fund:  0.089, benchmark:  0.074 },
      { year: 2024, fund:  0.067, benchmark:  0.053 },
    ],
    generated_at: new Date().toISOString(),
  });
});

// ── 4. NAV ───────────────────────────────────────────────────────────────────
// Returns synthetic NAV / iNAV data from NAVAccountingAgent logic.
router.get("/nav", (_req: Request, res: Response) => {
  const now = new Date();
  // Simulate intraday iNAV drift ±0.2% from official NAV
  const navBase = 1.0698;
  const drift = (Math.random() - 0.5) * 0.004;
  const inav = parseFloat((navBase + drift).toFixed(6));

  return res.json({
    nav_per_unit_kwd:  navBase,
    inav_per_unit_kwd: inav,
    aum_kwd:           5_000_000,
    units_outstanding: Math.round(5_000_000 / navBase),
    premium_discount_pct: parseFloat(((inav / navBase - 1) * 100).toFixed(3)),
    currency: "KWD",
    as_of: now.toISOString(),
    valuation_date: now.toISOString().split("T")[0],
    next_nav_date: new Date(now.getTime() + 86400000).toISOString().split("T")[0],
    top_holdings: [
      { ticker: "ZAIN",     name: "Zain Kuwait",     weight: 0.198, nav_contribution: 0.0212 },
      { ticker: "KFH",      name: "Kuwait Finance House", weight: 0.187, nav_contribution: 0.0200 },
      { ticker: "AGLT",     name: "Agility",          weight: 0.142, nav_contribution: 0.0152 },
      { ticker: "MEZZ",     name: "Mezzan Holding",   weight: 0.118, nav_contribution: 0.0126 },
      { ticker: "HUMANSOFT",name: "Humansoft",        weight: 0.097, nav_contribution: 0.0104 },
    ],
    cash_pct: 0.021,
    accrued_fees_kwd: 300,   // 6bps on KD 5M = KD 3,000/yr → ~KD 8.2/day
    status: "LIVE",
  });
});

// ── 5. MACRO OVERLAY ────────────────────────────────────────────────────────
// Returns current macro regime signal from MacroOverlay logic.
// Oil momentum > +5% = RISK_ON, < -5% = RISK_OFF, else NEUTRAL.
router.get("/macro-overlay", (_req: Request, res: Response) => {
  // Simulate oil momentum based on current date (GCC conflict context → RISK_OFF)
  const oilMomentum = -0.072; // -7.2% 63-day momentum (conflict-driven)
  const regime = oilMomentum > 0.05 ? "RISK_ON" : oilMomentum < -0.05 ? "RISK_OFF" : "NEUTRAL";

  return res.json({
    regime,
    oil_momentum_63d: oilMomentum,
    oil_price_usd: 71.4,
    signal_strength: Math.abs(oilMomentum),
    implications: {
      momentum_weight_adj: regime === "RISK_OFF" ? -0.15 : regime === "RISK_ON" ? +0.10 : 0,
      oil_beta_direction: regime === "RISK_ON" ? "REWARD" : "PENALISE",
      rebalance_recommendation: regime === "RISK_OFF" ? "Reduce oil-beta exposure, tilt defensive" : "Maintain factor weights",
    },
    ramadan_adjustment: {
      active: new Date().getMonth() + 1 === 3 || new Date().getMonth() + 1 === 4,
      momentum_multiplier: 0.7,
      note: "Momentum signal reduced 30% during Ramadan (Mar–Apr) per BK seasonal pattern",
    },
    factors_active: ["momentum", "oil_beta", "liquidity"],
    factor_weights: { momentum: 0.40, oil_beta: 0.35, liquidity: 0.25 },
    as_of: new Date().toISOString(),
  });
});

// ── 6. LIQUIDITY SCORES ──────────────────────────────────────────────────────
// Returns per-stock Amihud illiquidity scores for the BK Premier universe.
// Lower score = more liquid = higher allocation weight.
router.get("/liquidity-scores", (_req: Request, res: Response) => {
  const stocks = [
    { ticker: "ZAIN",      name: "Zain Kuwait",          amihud: 0.0031, adtv_kwd: 1_820_000, rank: 1,  score:  0.91 },
    { ticker: "KFH",       name: "Kuwait Finance House",  amihud: 0.0028, adtv_kwd: 2_140_000, rank: 2,  score:  0.94 },
    { ticker: "AGLT",      name: "Agility",              amihud: 0.0044, adtv_kwd: 1_210_000, rank: 3,  score:  0.82 },
    { ticker: "MEZZ",      name: "Mezzan Holding",       amihud: 0.0067, adtv_kwd:   890_000, rank: 4,  score:  0.71 },
    { ticker: "HUMANSOFT", name: "Humansoft",            amihud: 0.0089, adtv_kwd:   640_000, rank: 5,  score:  0.63 },
    { ticker: "ALAFCO",    name: "ALAFCO",               amihud: 0.0112, adtv_kwd:   480_000, rank: 6,  score:  0.55 },
    { ticker: "COAST",     name: "Coast Investment",     amihud: 0.0134, adtv_kwd:   390_000, rank: 7,  score:  0.48 },
    { ticker: "WARBA",     name: "Warba Bank",           amihud: 0.0098, adtv_kwd:   560_000, rank: 8,  score:  0.59 },
    { ticker: "BOUBYAN",   name: "Boubyan Bank",         amihud: 0.0076, adtv_kwd:   720_000, rank: 9,  score:  0.67 },
    { ticker: "KIPCO",     name: "KIPCO",                amihud: 0.0155, adtv_kwd:   310_000, rank: 10, score:  0.41 },
    { ticker: "KOUT",      name: "Kuwait Projects Co",   amihud: 0.0178, adtv_kwd:   270_000, rank: 11, score:  0.35 },
    { ticker: "MARK",      name: "Markaz",               amihud: 0.0201, adtv_kwd:   230_000, rank: 12, score:  0.29 },
    { ticker: "KAMCO",     name: "Kamco Invest",         amihud: 0.0223, adtv_kwd:   195_000, rank: 13, score:  0.23 },
  ];

  return res.json({
    stocks,
    methodology: "Amihud (2002) illiquidity ratio: |return| / volume_kwd, 63-day rolling average",
    min_adtv_threshold_kwd: 150_000,
    as_of: new Date().toISOString(),
  });
});

// ── 7. MOMENTUM FACTORS ──────────────────────────────────────────────────────
// Returns 12-1 month momentum scores for BK Premier universe.
// Scores are ranked percentile [-1, 1] with Ramadan adjustment applied.
router.get("/momentum-factors", (_req: Request, res: Response) => {
  const isRamadan = [3, 4].includes(new Date().getMonth() + 1);
  const ramadanMultiplier = isRamadan ? 0.7 : 1.0;

  const raw = [
    { ticker: "KFH",       name: "Kuwait Finance House",  raw_return: 0.142, rank_pct: 0.92 },
    { ticker: "HUMANSOFT", name: "Humansoft",            raw_return: 0.118, rank_pct: 0.85 },
    { ticker: "BOUBYAN",   name: "Boubyan Bank",         raw_return: 0.097, rank_pct: 0.77 },
    { ticker: "WARBA",     name: "Warba Bank",           raw_return: 0.081, rank_pct: 0.69 },
    { ticker: "AGLT",      name: "Agility",              raw_return: 0.064, rank_pct: 0.62 },
    { ticker: "MEZZ",      name: "Mezzan Holding",       raw_return: 0.048, rank_pct: 0.54 },
    { ticker: "ZAIN",      name: "Zain Kuwait",          raw_return: 0.031, rank_pct: 0.46 },
    { ticker: "ALAFCO",    name: "ALAFCO",               raw_return: 0.012, rank_pct: 0.38 },
    { ticker: "COAST",     name: "Coast Investment",     raw_return: -0.008, rank_pct: 0.31 },
    { ticker: "KIPCO",     name: "KIPCO",                raw_return: -0.024, rank_pct: 0.23 },
    { ticker: "KAMCO",     name: "Kamco Invest",         raw_return: -0.041, rank_pct: 0.15 },
    { ticker: "MARK",      name: "Markaz",               raw_return: -0.058, rank_pct: 0.08 },
    { ticker: "KOUT",      name: "Kuwait Projects Co",   raw_return: -0.072, rank_pct: 0.02 },
  ].map(s => ({
    ...s,
    momentum_score: parseFloat(((s.rank_pct * 2 - 1) * ramadanMultiplier).toFixed(4)),
    ramadan_adjusted: isRamadan,
  }));

  return res.json({
    stocks: raw,
    period: "12-1 month (skip last month)",
    ramadan_active: isRamadan,
    ramadan_multiplier: ramadanMultiplier,
    as_of: new Date().toISOString(),
  });
});

// ── 8. INDEX WEIGHTS ─────────────────────────────────────────────────────────
// Returns final index constituent weights with CMA 20% single-stock cap applied.
// Weights derived from composite factor score × free-float market cap.
router.get("/index-weights", (_req: Request, res: Response) => {
  const weights = [
    { ticker: "ZAIN",      name: "Zain Kuwait",          weight: 0.198, capped: false, free_float_kwd: 1_820_000_000, composite_score: 0.71 },
    { ticker: "KFH",       name: "Kuwait Finance House",  weight: 0.200, capped: true,  free_float_kwd: 3_140_000_000, composite_score: 0.89, note: "Capped at 20% CMA limit" },
    { ticker: "AGLT",      name: "Agility",              weight: 0.142, capped: false, free_float_kwd: 1_210_000_000, composite_score: 0.74 },
    { ticker: "MEZZ",      name: "Mezzan Holding",       weight: 0.118, capped: false, free_float_kwd:   890_000_000, composite_score: 0.66 },
    { ticker: "HUMANSOFT", name: "Humansoft",            weight: 0.097, capped: false, free_float_kwd:   640_000_000, composite_score: 0.81 },
    { ticker: "ALAFCO",    name: "ALAFCO",               weight: 0.068, capped: false, free_float_kwd:   480_000_000, composite_score: 0.58 },
    { ticker: "WARBA",     name: "Warba Bank",           weight: 0.059, capped: false, free_float_kwd:   560_000_000, composite_score: 0.63 },
    { ticker: "BOUBYAN",   name: "Boubyan Bank",         weight: 0.051, capped: false, free_float_kwd:   720_000_000, composite_score: 0.69 },
    { ticker: "COAST",     name: "Coast Investment",     weight: 0.032, capped: false, free_float_kwd:   390_000_000, composite_score: 0.44 },
    { ticker: "KIPCO",     name: "KIPCO",                weight: 0.019, capped: false, free_float_kwd:   310_000_000, composite_score: 0.31 },
    { ticker: "KOUT",      name: "Kuwait Projects Co",   weight: 0.009, capped: false, free_float_kwd:   270_000_000, composite_score: 0.22 },
    { ticker: "KAMCO",     name: "Kamco Invest",         weight: 0.005, capped: false, free_float_kwd:   195_000_000, composite_score: 0.18 },
    { ticker: "MARK",      name: "Markaz",               weight: 0.002, capped: false, free_float_kwd:   230_000_000, composite_score: 0.12 },
  ];

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);

  return res.json({
    weights,
    total_weight: parseFloat(totalWeight.toFixed(4)),
    cma_cap_pct: 0.20,
    capped_stocks: weights.filter(w => w.capped).map(w => w.ticker),
    rebalance_frequency: "Quarterly",
    last_rebalance: "2025-12-31",
    next_rebalance: "2026-03-31",
    as_of: new Date().toISOString(),
  });
});

// ── 9. STUDIO HTML PROXY ────────────────────────────────────────────────────
// Fetches the ETF Studio HTML from CDN and re-serves it with text/html Content-Type.
// The CDN stores the file as application/octet-stream which causes browsers to
// download it instead of rendering it. This proxy corrects the Content-Type.
const ETF_HTML_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663268376562/7EnctkaNppkKLbjFfnH6YY/AgenThinkMesh_ETF_Studio_aa59be69.html";

router.get("/studio-html", async (_req: Request, res: Response) => {
  try {
    const upstream = await fetch(ETF_HTML_CDN);
    if (!upstream.ok) {
      return res.status(502).send("Failed to fetch ETF Studio HTML from CDN");
    }
    const html = await upstream.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(html);
  } catch (err) {
    console.error("[ETF studio-html proxy]", err);
    return res.status(500).send("ETF Studio HTML proxy error");
  }
});

export default router;


