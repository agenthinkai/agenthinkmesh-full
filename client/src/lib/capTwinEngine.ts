// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — Deterministic What-If Simulation Engine
// 100% pure functions. Zero LLM variance. Zero side-effects.
// ─────────────────────────────────────────────────────────────────────────────

import type { LimitedPartner, FundStrategy } from "./lpRegistry";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FundParams {
  /** Target capital raise in USD millions */
  targetCapital: number;
  /** Management fee annual % (0.5 – 2.5) */
  managementFee: number;
  /** Carry % (typically 20) */
  carry: number;
  /** GP track record in years */
  trackRecord: number;
  /** Fundraising velocity lever 0–100 */
  velocityLever: number;
  /** Whether a placement agent is engaged */
  placementAgent: boolean;
  /** Fund strategy */
  strategy: FundStrategy;
  /** GP net IRR on prior fund (%) */
  priorIRR: number;
}

export interface MonthlyDataPoint {
  month: number;
  cumulativeRaised: number;
  netAUM: number;
  cumulativeFees: number;
  placementCommissions: number;
}

export interface SimulationResult {
  /** 24-month time series */
  timeSeries: MonthlyDataPoint[];
  /** Final gross raised at month 24 (USD M) */
  grossRaised: number;
  /** Total cumulative management fees (USD M) */
  totalFees: number;
  /** Total placement commissions (USD M) */
  totalCommissions: number;
  /** Net investable AUM at month 24 (USD M) */
  netAUM: number;
  /** Estimated close month (when 90% of target is reached) */
  estimatedCloseMonth: number;
}

export interface FitScoreResult {
  /** Composite score 0–100 */
  score: number;
  strategyFit: number;
  pedigreeFit: number;
  feeAlignment: number;
  penalties: number;
  penaltyReasons: string[];
}

// ── 1. Fundraising Velocity S-Curve ─────────────────────────────────────────

/**
 * Logistic growth function: C(t) = Target / (1 + exp(-k * (t - midpoint)))
 * velocityLever (0–100) shifts k and pulls midpoint forward.
 * Placement agent multiplies velocity by 1.25.
 */
export function sCurveRaised(
  t: number,
  targetCapital: number,
  velocityLever: number,
  placementAgent: boolean
): number {
  const baseK = 0.15 + (velocityLever / 100) * 0.35; // k range: 0.15 – 0.50
  const k = placementAgent ? baseK * 1.25 : baseK;
  const midpoint = 18 - (velocityLever / 100) * 8; // midpoint range: 10 – 18 months
  const raw = targetCapital / (1 + Math.exp(-k * (t - midpoint)));
  return Math.min(raw, targetCapital);
}

// ── 2. Net AUM & Fee Drag Curve ──────────────────────────────────────────────

/**
 * Net AUM(t) = C(t) - [Cumulative Management Fees(t) + Placement Commissions]
 * Management fee is annual %, applied monthly on committed capital.
 * Placement commission is 2.0% on closed capital (one-time at close).
 */
export function runSimulation(params: FundParams): SimulationResult {
  const {
    targetCapital,
    managementFee,
    velocityLever,
    placementAgent,
  } = params;

  const monthlyFeeRate = managementFee / 100 / 12;
  const placementRate = placementAgent ? 0.02 : 0;

  const timeSeries: MonthlyDataPoint[] = [];
  let cumulativeFees = 0;

  for (let month = 1; month <= 24; month++) {
    const cumulativeRaised = sCurveRaised(month, targetCapital, velocityLever, placementAgent);
    const monthlyFee = cumulativeRaised * monthlyFeeRate;
    cumulativeFees += monthlyFee;
    const placementCommissions = cumulativeRaised * placementRate;
    const netAUM = Math.max(0, cumulativeRaised - cumulativeFees - placementCommissions);

    timeSeries.push({
      month,
      cumulativeRaised: parseFloat(cumulativeRaised.toFixed(2)),
      netAUM: parseFloat(netAUM.toFixed(2)),
      cumulativeFees: parseFloat(cumulativeFees.toFixed(2)),
      placementCommissions: parseFloat(placementCommissions.toFixed(2)),
    });
  }

  const final = timeSeries[23];
  const closePoint = timeSeries.find((d) => d.cumulativeRaised >= targetCapital * 0.9);

  return {
    timeSeries,
    grossRaised: final.cumulativeRaised,
    totalFees: final.cumulativeFees,
    totalCommissions: final.placementCommissions,
    netAUM: final.netAUM,
    estimatedCloseMonth: closePoint ? closePoint.month : 24,
  };
}

// ── 3. Deterministic GP-LP Fit Score ─────────────────────────────────────────

/**
 * Score = (0.5 * Strategy_Fit) + (0.3 * Pedigree_Fit) + (0.2 * Fee_Alignment) - Penalties
 * Sharia mismatch on Sharia-mandated LP triggers a hard 40-point penalty.
 */
export function computeFitScore(
  params: FundParams,
  lp: LimitedPartner
): FitScoreResult {
  const penalties: number[] = [];
  const penaltyReasons: string[] = [];

  // Strategy fit (0–100)
  const strategyFit = lp.strategies.includes(params.strategy) ? 100 : 30;

  // Pedigree fit (0–100): track record vs LP minimum
  const trackRecordRatio = Math.min(params.trackRecord / lp.trackRecordLimit, 1);
  const irrBonus = lp.irrHurdle !== null && params.priorIRR >= lp.irrHurdle ? 20 : 0;
  const pedigreeFit = Math.min(trackRecordRatio * 80 + irrBonus, 100);

  // Fee alignment (0–100): lower fees = better score
  const feeRatio = params.managementFee / lp.maxManagementFee;
  const feeAlignment = Math.max(0, 100 - (feeRatio - 1) * 80);

  // Penalties
  if (lp.shariaRequired && params.strategy !== "Private Credit" && params.strategy !== "Infrastructure") {
    penalties.push(40);
    penaltyReasons.push("Sharia mismatch: strategy not Sharia-compatible");
  }
  if (params.trackRecord < lp.trackRecordLimit) {
    const shortfall = lp.trackRecordLimit - params.trackRecord;
    penalties.push(shortfall * 5);
    penaltyReasons.push(`Track record ${params.trackRecord}yr below LP limit ${lp.trackRecordLimit}yr`);
  }
  if (params.managementFee > lp.maxManagementFee) {
    penalties.push(15);
    penaltyReasons.push(`Management fee ${params.managementFee}% exceeds LP maximum ${lp.maxManagementFee}%`);
  }
  if (lp.irrHurdle !== null && params.priorIRR < lp.irrHurdle) {
    penalties.push(10);
    penaltyReasons.push(`Prior IRR ${params.priorIRR}% below LP hurdle ${lp.irrHurdle}%`);
  }

  const totalPenalty = penalties.reduce((a, b) => a + b, 0);
  const rawScore =
    0.5 * strategyFit + 0.3 * pedigreeFit + 0.2 * feeAlignment - totalPenalty;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score: parseFloat(score.toFixed(1)),
    strategyFit,
    pedigreeFit: parseFloat(pedigreeFit.toFixed(1)),
    feeAlignment: parseFloat(feeAlignment.toFixed(1)),
    penalties: totalPenalty,
    penaltyReasons,
  };
}
