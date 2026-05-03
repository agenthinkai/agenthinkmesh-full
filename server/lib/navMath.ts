// server/lib/navMath.ts
// Deterministic NAV / Friday Gap math for Council of 10 — GCC Equities.
// Pure arithmetic. No I/O, no LLM calls. The result of buildEvidenceBlob()
// is injected as a string into each persona's user message before dispatch.

// Weights normalized from disclosed top-10 index weights (original sum = 0.6774).
// Each value = original / 0.6774 so the basket sums to ~1.0 and a full-basket
// submission yields coverage ~100% rather than 67.74%.
export const KWT_BASKET: Record<string, number> = {
  KFH:       0.3398,
  NBK:       0.3189,
  ZAIN:      0.0720,
  WARBABANK: 0.0499,
  GBK:       0.0483,
  MABANEE:   0.0469,
  NIND:      0.0351,
  ABK:       0.0338,
  ALTIJARIA: 0.0283,
  BOURSA:    0.0269,
};
// Sanity: sum = 0.9999

export interface ConstituentQuote {
  symbol: string;
  bid?: number;
  ask?: number;
  last?: number;
}

export function mid(q: ConstituentQuote): number | null {
  if (q.bid != null && q.ask != null) return (q.bid + q.ask) / 2;
  return q.last ?? null;
}

export function computeBasketNav(
  quotes: ConstituentQuote[],
  weights: Record<string, number> = KWT_BASKET,
  minCoverage = 0.85,
) {
  const used: Record<string, { price: number; weight: number }> = {};
  let weightedSum = 0;
  let coverage = 0;
  for (const q of quotes) {
    const w = weights[q.symbol];
    if (w == null) continue;
    const price = mid(q);
    if (price == null) continue;
    used[q.symbol] = { price, weight: w };
    weightedSum += w * price;
    coverage += w;
  }
  const navKwd = coverage > 0 ? weightedSum / coverage : 0;
  const trustworthy = coverage >= minCoverage;
  const notes: string[] = [];
  if (!trustworthy) {
    notes.push(`Coverage ${(coverage * 100).toFixed(2)}% < ${(minCoverage * 100).toFixed(0)}%`);
  }
  return { navKwd, coverage, used, trustworthy, notes };
}

export function fridayGapImpliedMarks(
  kwtThu: number,
  kwtFri: number,
  thuPrices: Record<string, number>,
  weights: Record<string, number> = KWT_BASKET,
) {
  if (kwtThu <= 0) throw new Error("kwtThu must be positive");
  const kwtReturn = kwtFri / kwtThu - 1;
  const marks: Record<
    string,
    { thuClose: number; impliedOpen: number; impliedMovePct: number; weight: number }
  > = {};
  for (const [sym, w] of Object.entries(weights)) {
    const thu = thuPrices[sym];
    if (thu == null) continue;
    marks[sym] = {
      thuClose: thu,
      impliedOpen: +(thu * (1 + kwtReturn)).toFixed(6),
      impliedMovePct: +kwtReturn.toFixed(6),
      weight: w,
    };
  }
  return {
    meta: { kwtReturn: +kwtReturn.toFixed(6), thuClose: kwtThu, friClose: kwtFri },
    marks,
  };
}

export function expectedOpenVolatility(kwtFridayReturn: number, spyFridayReturn = 0) {
  const expectedAbs = 0.6 * Math.abs(kwtFridayReturn) + 0.2 * Math.abs(spyFridayReturn);
  const tier =
    expectedAbs < 0.003 ? "LOW" : expectedAbs < 0.008 ? "MEDIUM" : "HIGH";
  return { expectedAbsMove: +expectedAbs.toFixed(5), tier };
}

// Boursa Kuwait calendar — Sun-Thu 09:00-12:30 AST (UTC+3)
export function marketPhase(now = new Date()) {
  const kwt = new Date(now.getTime() + 3 * 3600 * 1000);
  const dow = kwt.getUTCDay();
  if (dow === 5 || dow === 6) return "WEEKEND_CLOSED";
  const m = kwt.getUTCHours() * 60 + kwt.getUTCMinutes();
  if (m < 510) return "OVERNIGHT_CLOSED";
  if (m < 540) return "PRE_OPEN";
  if (m < 750) return "OPEN";
  return "AFTER_HOURS_CLOSED";
}

export interface SignalRequest {
  strategy: "FRIDAY_GAP" | "NAV_DEPEG" | "SPREAD_CAPTURE";
  symbol: string;
  sideHint?: "BUY" | "SELL";
  constituentQuotes: ConstituentQuote[];
  kwtThursdayClose?: number;
  kwtFridayClose?: number;
  thresholdBps?: number;
  notes?: string;
  macroTape?: string;  // Friday global close context for Macro Sentinel
}

export function buildEvidenceBlob(req: SignalRequest): string {
  const lines: string[] = [];
  lines.push(`STRATEGY: ${req.strategy}`);
  lines.push(`TARGET: ${req.symbol}${req.sideHint ? ` (hint: ${req.sideHint})` : ""}`);
  lines.push(`MARKET PHASE: ${marketPhase()}`);
  if (req.thresholdBps) lines.push(`THRESHOLD: ${req.thresholdBps} bps`);
  lines.push("");

  const nav = computeBasketNav(req.constituentQuotes);
  lines.push(
    `NAV PROXY (KWD): ${nav.navKwd.toFixed(4)} (coverage ${(nav.coverage * 100).toFixed(2)}%)`,
  );
  if (nav.notes.length) lines.push(`  notes: ${nav.notes.join(" | ")}`);
  lines.push("");

  if (req.strategy === "FRIDAY_GAP" && req.kwtThursdayClose && req.kwtFridayClose) {
    const thuPrices: Record<string, number> = {};
    for (const q of req.constituentQuotes) {
      const m = mid(q);
      if (m != null) thuPrices[q.symbol] = m;
    }
    const gap = fridayGapImpliedMarks(req.kwtThursdayClose, req.kwtFridayClose, thuPrices);
    lines.push(`FRIDAY GAP:`);
    lines.push(`  KWT return: ${(gap.meta.kwtReturn * 100).toFixed(4)}%`);
    const t = gap.marks[req.symbol];
    if (t) {
      lines.push(`  ${req.symbol} Thu: ${t.thuClose}`);
      lines.push(`  ${req.symbol} implied open: ${t.impliedOpen}`);
      lines.push(`  ${req.symbol} implied move: ${(t.impliedMovePct * 100).toFixed(4)}%`);
    }
    const vol = expectedOpenVolatility(gap.meta.kwtReturn);
    lines.push(`  Expected open-gap: ${(vol.expectedAbsMove * 100).toFixed(4)}% (${vol.tier})`);
    lines.push("");
  }

  lines.push("CONSTITUENT QUOTES (KWD):");
  for (const q of req.constituentQuotes) {
    const m = mid(q);
    lines.push(
      `  ${q.symbol.padEnd(12)} bid=${q.bid ?? "-"} ask=${q.ask ?? "-"} last=${q.last ?? "-"} mid=${m ?? "-"}`,
    );
  }

  if (req.macroTape) {
    lines.push("");
    lines.push("MACRO TAPE (Friday global close):");
    lines.push(req.macroTape);
  }

  if (req.notes) {
    lines.push("");
    lines.push("ANALYST NOTES:");
    lines.push(req.notes);
  }
  return lines.join("\n");
}
