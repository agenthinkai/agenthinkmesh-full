/**
 * TPA Engine — Total Portfolio Approach Digital Twin
 * 100% deterministic, zero LLM variance.
 * All mathematics are client-side and reproducible.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AssetClass =
  | "publicEquities"
  | "fixedIncome"
  | "privateEquity"
  | "infrastructure"
  | "privateCredit";

export type FactorName =
  | "Growth"
  | "Inflation"
  | "Rates"
  | "Liquidity"
  | "Leverage";

export type MacroRegime =
  | "baseline"
  | "stagflation"
  | "commoditiesCollapse"
  | "creditSqueeze";

export type PortfolioMode = "swf" | "pension";

export interface Allocation {
  publicEquities: number;   // 0–100 (%)
  fixedIncome: number;
  privateEquity: number;
  infrastructure: number;
  privateCredit: number;
}

export interface FactorExposure {
  Growth: number;
  Inflation: number;
  Rates: number;
  Liquidity: number;
  Leverage: number;
}

export interface PortfolioMetrics {
  factorExposure: FactorExposure;
  volatility: number;           // annualised % (e.g. 12.4)
  trackingError: number;        // vs 60/40 benchmark, %
  sovereignHedgeCoefficient: number; // 0–100 (SWF mode)
  fundingRatio: number;         // % (Pension mode)
  icVerdict: "Approved" | "Conditional Watchlist" | "Vetoed";
  icAlerts: string[];
  capitalCallSeries: CapitalCallPoint[];
  regimeShock: RegimeShockResult;
}

export interface CapitalCallPoint {
  month: number;
  calls: number;    // $M
  distributions: number; // $M
  netCashflow: number;
}

export interface RegimeShockResult {
  regime: MacroRegime;
  portfolioVolatilityDelta: number; // pp change
  sovereignHedgeDelta: number;
  fundingRatioDelta: number;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FACTOR LOADING MATRIX
// ─────────────────────────────────────────────────────────────────────────────

const FACTOR_LOADINGS: Record<AssetClass, FactorExposure> = {
  publicEquities:  { Growth: 0.80, Inflation: 0.10, Rates: 0.00, Liquidity: 0.00, Leverage: 0.10 },
  fixedIncome:     { Growth: 0.00, Inflation: 0.20, Rates: 0.80, Liquidity: 0.00, Leverage: 0.00 },
  privateEquity:   { Growth: 0.50, Inflation: 0.00, Rates: 0.00, Liquidity: 0.20, Leverage: 0.30 },
  infrastructure:  { Growth: 0.00, Inflation: 0.60, Rates: 0.40, Liquidity: 0.00, Leverage: 0.00 },
  privateCredit:   { Growth: 0.40, Inflation: 0.00, Rates: 0.00, Liquidity: 0.30, Leverage: 0.30 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. VOLATILITY MODEL — individual asset-class vols (annualised %)
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_VOL: Record<AssetClass, number> = {
  publicEquities: 18.0,
  fixedIncome:     6.5,
  privateEquity:  22.0,
  infrastructure:  9.0,
  privateCredit:  10.5,
};

// Correlation matrix (symmetric, diagonal = 1.0)
// Order: publicEquities, fixedIncome, privateEquity, infrastructure, privateCredit
const CORR: number[][] = [
  [1.00, -0.20,  0.75,  0.10,  0.30],  // publicEquities
  [-0.20, 1.00, -0.15,  0.20, -0.10],  // fixedIncome
  [0.75, -0.15,  1.00,  0.05,  0.40],  // privateEquity
  [0.10,  0.20,  0.05,  1.00,  0.15],  // infrastructure
  [0.30, -0.10,  0.40,  0.15,  1.00],  // privateCredit
];

const ASSET_ORDER: AssetClass[] = [
  "publicEquities",
  "fixedIncome",
  "privateEquity",
  "infrastructure",
  "privateCredit",
];

function computeVolatility(alloc: Allocation): number {
  const w = ASSET_ORDER.map((a) => alloc[a] / 100);
  let variance = 0;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      variance +=
        w[i] * w[j] * ASSET_VOL[ASSET_ORDER[i]] * ASSET_VOL[ASSET_ORDER[j]] * CORR[i][j];
    }
  }
  return Math.sqrt(Math.max(variance, 0));
}

function computeTrackingError(alloc: Allocation): number {
  // Benchmark: 60% public equities, 40% fixed income
  const benchmarkAlloc: Allocation = {
    publicEquities: 60,
    fixedIncome: 40,
    privateEquity: 0,
    infrastructure: 0,
    privateCredit: 0,
  };
  const activeW = ASSET_ORDER.map(
    (a) => (alloc[a] - benchmarkAlloc[a]) / 100
  );
  let teVariance = 0;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      teVariance +=
        activeW[i] *
        activeW[j] *
        ASSET_VOL[ASSET_ORDER[i]] *
        ASSET_VOL[ASSET_ORDER[j]] *
        CORR[i][j];
    }
  }
  return Math.sqrt(Math.max(teVariance, 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FACTOR EXPOSURE AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

function computeFactorExposure(alloc: Allocation): FactorExposure {
  const exposure: FactorExposure = {
    Growth: 0,
    Inflation: 0,
    Rates: 0,
    Liquidity: 0,
    Leverage: 0,
  };
  for (const asset of ASSET_ORDER) {
    const w = alloc[asset] / 100;
    const loadings = FACTOR_LOADINGS[asset];
    for (const factor of Object.keys(loadings) as FactorName[]) {
      exposure[factor] += w * loadings[factor];
    }
  }
  return exposure;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DUAL-MODE OBJECTIVE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SWF Mode — Sovereign Hedge Coefficient (0–100%)
 * Rewards portfolios that are negatively correlated to oil/commodity revenues.
 * Infrastructure + Fixed Income act as sovereign hedges; Public Equities + PE hurt it.
 */
function computeSovereignHedgeCoefficient(alloc: Allocation): number {
  const hedge =
    (alloc.infrastructure * 0.8 +
      alloc.fixedIncome * 0.5 +
      alloc.privateCredit * 0.3) /
    100;
  const drag =
    (alloc.publicEquities * 0.4 + alloc.privateEquity * 0.3) / 100;
  const raw = Math.max(0, Math.min(1, hedge - drag + 0.5));
  return Math.round(raw * 100);
}

/**
 * Pension Mode — Funding Ratio (%)
 * Assets / Liabilities. Liabilities are discount-rate sensitive:
 * higher rates allocation → lower liability PV → higher funding ratio.
 */
function computeFundingRatio(alloc: Allocation): number {
  // Baseline: assets = 100, liabilities = 100 → 100%
  // Rates allocation reduces liability PV (duration effect)
  const ratesContribution = (alloc.fixedIncome + alloc.infrastructure * 0.5) / 100;
  const liabilityPV = 100 * (1 - ratesContribution * 0.25);
  const assetReturn =
    alloc.publicEquities * 0.08 +
    alloc.fixedIncome * 0.04 +
    alloc.privateEquity * 0.12 +
    alloc.infrastructure * 0.07 +
    alloc.privateCredit * 0.09;
  const assetValue = 100 * (1 + assetReturn / 100 / 10); // 10-yr horizon proxy
  return Math.round((assetValue / liabilityPV) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. INVESTMENT COMMITTEE SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

function computeICVerdict(
  alloc: Allocation,
  factorExposure: FactorExposure,
  esgScore: number,
  shariaCompliant: boolean
): { verdict: "Approved" | "Conditional Watchlist" | "Vetoed"; alerts: string[] } {
  const alerts: string[] = [];

  // Rule 1: Liquidity lockup alert
  if (alloc.privateCredit + alloc.privateEquity > 30) {
    alerts.push(
      `Liquidity Premium Lockup Alert: Private Credit (${alloc.privateCredit}%) + Private Equity (${alloc.privateEquity}%) = ${alloc.privateCredit + alloc.privateEquity}% exceeds 30% illiquidity threshold. Redemption gates may apply in a credit squeeze.`
    );
  }

  // Rule 2: ESG mandate mismatch
  if (esgScore < 6) {
    alerts.push(
      `Mandate Mismatch Warning: ESG score (${esgScore}/10) is below the minimum 6/10 threshold required by SFDR Article 8 mandates. Infrastructure and Private Credit allocations must include ESG screening.`
    );
  }

  // Rule 3: Sharia compliance — interest-bearing fixed income
  if (shariaCompliant && alloc.fixedIncome > 15) {
    alerts.push(
      `Sharia Compliance Alert: Fixed Income allocation (${alloc.fixedIncome}%) includes conventional interest-bearing instruments. AAOIFI standards require Sukuk substitution above 15% threshold.`
    );
  }

  // Rule 4: Excessive leverage factor concentration
  if (factorExposure.Leverage > 0.25) {
    alerts.push(
      `Leverage Concentration Warning: Aggregate leverage factor exposure (${(factorExposure.Leverage * 100).toFixed(1)}%) exceeds 25% portfolio weight. Stress scenarios indicate amplified drawdown risk.`
    );
  }

  // Rule 5: Rates concentration in pension mode
  if (factorExposure.Rates > 0.50) {
    alerts.push(
      `Duration Risk Alert: Rates factor exposure (${(factorExposure.Rates * 100).toFixed(1)}%) is highly concentrated. A 100bps rate shock would materially impair fixed income and infrastructure valuations.`
    );
  }

  let verdict: "Approved" | "Conditional Watchlist" | "Vetoed";
  if (alerts.length === 0) {
    verdict = "Approved";
  } else if (alerts.length <= 2) {
    verdict = "Conditional Watchlist";
  } else {
    verdict = "Vetoed";
  }

  return { verdict, alerts };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. CAPITAL CALL PROJECTIONS (24-month horizon)
// ─────────────────────────────────────────────────────────────────────────────

function computeCapitalCallSeries(alloc: Allocation): CapitalCallPoint[] {
  const totalPrivate = alloc.privateEquity + alloc.privateCredit + alloc.infrastructure;
  const series: CapitalCallPoint[] = [];

  for (let month = 1; month <= 24; month++) {
    // Capital calls front-loaded in months 1–12, distributions back-loaded 12–24
    const callCurve = month <= 12
      ? (totalPrivate / 100) * 8 * Math.sin((month / 12) * Math.PI)
      : (totalPrivate / 100) * 2 * Math.exp(-(month - 12) / 6);

    const distCurve = month <= 8
      ? 0
      : (totalPrivate / 100) * 6 * Math.sin(((month - 8) / 16) * Math.PI);

    const calls = Math.max(0, callCurve);
    const distributions = Math.max(0, distCurve);

    series.push({
      month,
      calls: parseFloat(calls.toFixed(2)),
      distributions: parseFloat(distributions.toFixed(2)),
      netCashflow: parseFloat((distributions - calls).toFixed(2)),
    });
  }

  return series;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. MACRO REGIME SHOCK TABLE
// ─────────────────────────────────────────────────────────────────────────────

const REGIME_SHOCKS: Record<
  MacroRegime,
  { volMultiplier: number; hedgeDelta: number; fundingDelta: number; description: string }
> = {
  baseline: {
    volMultiplier: 1.0,
    hedgeDelta: 0,
    fundingDelta: 0,
    description: "Standard baseline: historical average correlations and volatilities apply.",
  },
  stagflation: {
    volMultiplier: 1.6,
    hedgeDelta: -15,
    fundingDelta: -12,
    description:
      "Stagflation Shock (1970s analog): simultaneous high inflation and low growth. Equity and credit drawdowns amplified. Infrastructure and real assets provide partial hedge.",
  },
  commoditiesCollapse: {
    volMultiplier: 1.35,
    hedgeDelta: -22,
    fundingDelta: -8,
    description:
      "Commodities Collapse: oil and commodity prices fall >40%. SWF sovereign hedge coefficient deteriorates sharply. GCC-linked portfolios face revenue correlation risk.",
  },
  creditSqueeze: {
    volMultiplier: 1.8,
    hedgeDelta: -10,
    fundingDelta: -18,
    description:
      "Credit Squeeze: credit spreads widen 400bps+. Private credit and leveraged buyout valuations impaired. Liquidity premium lockup risk materialises for illiquid allocations.",
  },
};

function computeRegimeShock(
  alloc: Allocation,
  regime: MacroRegime,
  baseVol: number,
  baseSHC: number,
  baseFR: number
): RegimeShockResult {
  const shock = REGIME_SHOCKS[regime];
  const shockedVol = baseVol * shock.volMultiplier;
  return {
    regime,
    portfolioVolatilityDelta: parseFloat((shockedVol - baseVol).toFixed(2)),
    sovereignHedgeDelta: shock.hedgeDelta,
    fundingRatioDelta: shock.fundingDelta,
    description: shock.description,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. MAIN COMPUTE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function computePortfolioMetrics(
  alloc: Allocation,
  mode: PortfolioMode,
  regime: MacroRegime,
  esgScore: number,
  shariaCompliant: boolean
): PortfolioMetrics {
  const factorExposure = computeFactorExposure(alloc);
  const volatility = parseFloat(computeVolatility(alloc).toFixed(2));
  const trackingError = parseFloat(computeTrackingError(alloc).toFixed(2));
  const sovereignHedgeCoefficient = computeSovereignHedgeCoefficient(alloc);
  const fundingRatio = computeFundingRatio(alloc);
  const { verdict: icVerdict, alerts: icAlerts } = computeICVerdict(
    alloc,
    factorExposure,
    esgScore,
    shariaCompliant
  );
  const capitalCallSeries = computeCapitalCallSeries(alloc);
  const regimeShock = computeRegimeShock(
    alloc,
    regime,
    volatility,
    sovereignHedgeCoefficient,
    fundingRatio
  );

  return {
    factorExposure,
    volatility,
    trackingError,
    sovereignHedgeCoefficient,
    fundingRatio,
    icVerdict,
    icAlerts,
    capitalCallSeries,
    regimeShock,
  };
}

/**
 * Auto-balance: when one slider changes, proportionally adjust the others
 * to maintain exactly 100% total.
 */
export function autoBalance(
  prev: Allocation,
  changedKey: AssetClass,
  newValue: number
): Allocation {
  const clamped = Math.max(0, Math.min(100, newValue));
  const remaining = 100 - clamped;
  const others = ASSET_ORDER.filter((k) => k !== changedKey);
  const prevSum = others.reduce((s, k) => s + prev[k], 0);

  const next: Allocation = { ...prev, [changedKey]: clamped };

  if (prevSum === 0) {
    // Distribute evenly
    const each = remaining / others.length;
    for (const k of others) next[k] = parseFloat(each.toFixed(1));
  } else {
    for (const k of others) {
      next[k] = parseFloat(((prev[k] / prevSum) * remaining).toFixed(1));
    }
  }

  // Fix floating-point drift: adjust the first "other" to make sum exactly 100
  const sum = ASSET_ORDER.reduce((s, k) => s + next[k], 0);
  const drift = parseFloat((100 - sum).toFixed(1));
  if (drift !== 0 && others.length > 0) {
    next[others[0]] = parseFloat((next[others[0]] + drift).toFixed(1));
  }

  return next;
}

export const REGIME_META: Record<
  MacroRegime,
  { label: string; icon: string; color: string; description: string }
> = {
  baseline: {
    label: "Standard Baseline",
    icon: "TrendingUp",
    color: "#3b82f6",
    description: "Historical average correlations and volatilities.",
  },
  stagflation: {
    label: "Stagflation Shock (1970s)",
    icon: "Flame",
    color: "#f59e0b",
    description: "High inflation + low growth. Equity and credit drawdowns amplified.",
  },
  commoditiesCollapse: {
    label: "Commodities Collapse",
    icon: "TrendingDown",
    color: "#ef4444",
    description: "Oil/commodity prices fall >40%. SWF sovereign hedge deteriorates.",
  },
  creditSqueeze: {
    label: "Credit Squeeze",
    icon: "Lock",
    color: "#8b5cf6",
    description: "Credit spreads widen 400bps+. Illiquid allocations impaired.",
  },
};

export const FACTOR_COLORS: Record<FactorName, string> = {
  Growth: "#22c55e",
  Inflation: "#f59e0b",
  Rates: "#3b82f6",
  Liquidity: "#a855f7",
  Leverage: "#ef4444",
};

export const DEFAULT_ALLOCATION: Allocation = {
  publicEquities: 30,
  fixedIncome: 25,
  privateEquity: 20,
  infrastructure: 15,
  privateCredit: 10,
};
