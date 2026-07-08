// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — Orchestration Agents & Auto-Calibration Decision Ledger
// ─────────────────────────────────────────────────────────────────────────────

import type { LimitedPartner, FundStrategy } from "./lpRegistry";
import type { FundParams, FitScoreResult } from "./capTwinEngine";

// ── Types ────────────────────────────────────────────────────────────────────

export type ICVerdict = "Approved" | "Conditional Watchlist" | "Rejected";

export interface ICObjection {
  agent: string;
  objection: string;
  severity: "High" | "Medium" | "Low";
}

export interface AgentSimulationResult {
  tailoredPitch: string;
  icObjections: ICObjection[];
  icVerdict: ICVerdict;
  icRationale: string;
}

export interface DecisionLedgerEntry {
  id: string;
  timestamp: number;
  lpId: string;
  strategy: FundStrategy;
  fitScore: number;
  icVerdict: ICVerdict;
  /** Simulated actual close rate 0–1 (stored after outcome known) */
  actualCloseRate?: number;
}

export interface PatternMoat {
  multiplier: number;
  sampleSize: number;
  lastUpdated: number;
}

const LEDGER_KEY = "captwin_decision_ledger";
const MOAT_KEY = "captwin_pattern_moat";

// ── Agent 1: Pitch Optimizer ─────────────────────────────────────────────────

/**
 * Generates a customised outreach pitch tailored to the target LP.
 * Deterministic template-based generation — no LLM variance.
 */
export function generateTailoredPitch(params: FundParams, lp: LimitedPartner): string {
  const { strategy, targetCapital, managementFee, carry, trackRecord, priorIRR } = params;
  const ticketRange = `USD ${lp.ticketMin}M–${lp.ticketMax}M`;

  if (lp.region === "GCC") {
    return `Dear Investment Committee,

We are pleased to present ${strategy} Fund IV, a ${targetCapital}M vehicle structured under AAOIFI-compliant Murabaha and Ijara frameworks to meet your Sharia-mandated deployment requirements.

The Fund targets ${strategy.toLowerCase()} opportunities across GCC and MENA markets, with a ${priorIRR}% net IRR on the prior fund. Management fees are set at ${managementFee}% per annum on committed capital, with a ${carry}% carried interest above an 8% preferred return.

Our ${trackRecord}-year track record in ${strategy.toLowerCase()} is supported by full Sharia supervisory board oversight and AAOIFI-compliant documentation. We believe this structure aligns directly with your ${ticketRange} ticket mandate and infrastructure/debt focus.

We welcome the opportunity to present our Sharia compliance framework and AAOIFI certification documentation at your earliest convenience.`;
  }

  if (lp.region === "Europe") {
    return `Dear Investment Committee,

We are writing to present ${strategy} Fund IV as an Article 8 SFDR-classified vehicle, designed to meet the ESG integration and sustainability risk requirements of European institutional investors under AIFMD.

The Fund targets ${strategy.toLowerCase()} investments with a ${priorIRR}% net IRR track record over ${trackRecord} years. Our ESG integration methodology follows the UNPRI framework, with full sustainability risk disclosure in accordance with SFDR Articles 8 and 9.

Management fees are ${managementFee}% per annum on committed capital, with ${carry}% carried interest. The Fund is AIFMD-passported across EU member states and is available to eligible professional investors within your ${ticketRange} allocation range.

We would welcome the opportunity to provide our full SFDR pre-contractual disclosure and AIFMD passporting documentation.`;
  }

  // US Single Family Office
  return `Dear Investment Committee,

We are presenting ${strategy} Fund IV, a ${targetCapital}M vehicle targeting absolute returns with a ${priorIRR}% net IRR on the prior fund — structured to meet your 12%+ hurdle rate requirement.

The Fund is offered exclusively to accredited investors under SEC Rule 506(b) as a private placement. Management fees are ${managementFee}% per annum with ${carry}% carried interest above an 8% preferred return. Our ${trackRecord}-year track record is fully audited and available for due diligence review.

Given your ${ticketRange} ticket range and preference for ${strategy.toLowerCase()} exposure, we believe this fund represents a compelling fit. Decision cycle is targeted at 6–8 weeks from first close to final commitment.

We are available for a 45-minute IC presentation at your convenience.`;
}

// ── Agent 2: LP Simulator (Adversarial IC Critic) ────────────────────────────

/**
 * Simulates the LP's Investment Committee as an adversarial challenger.
 * Raises 3 logical objections based on fit score and terms.
 * Returns a verdict: Approved / Conditional Watchlist / Rejected.
 */
export function simulateIC(
  params: FundParams,
  lp: LimitedPartner,
  fit: FitScoreResult
): AgentSimulationResult {
  const tailoredPitch = generateTailoredPitch(params, lp);
  const objections: ICObjection[] = [];

  // Objection 1: Track record
  if (params.trackRecord < lp.trackRecordLimit) {
    objections.push({
      agent: "IC Risk Officer",
      objection: `GP track record of ${params.trackRecord} years is below our ${lp.trackRecordLimit}-year limit. We require a full fund cycle of evidence before committing capital at this size.`,
      severity: "High",
    });
  } else if (params.trackRecord === lp.trackRecordLimit) {
    objections.push({
      agent: "IC Risk Officer",
      objection: `Track record meets our minimum threshold, but we would prefer to see one additional full fund cycle before a first-time allocation at this ticket size.`,
      severity: "Medium",
    });
  } else {
    objections.push({
      agent: "IC Risk Officer",
      objection: `Track record of ${params.trackRecord} years is satisfactory. However, we note the prior fund vintage was in a favourable rate environment — we would want to understand performance attribution in a stress scenario.`,
      severity: "Low",
    });
  }

  // Objection 2: Fee structure
  if (params.managementFee > lp.maxManagementFee) {
    objections.push({
      agent: "IC Portfolio Manager",
      objection: `Management fee of ${params.managementFee}% exceeds our internal policy maximum of ${lp.maxManagementFee}%. Fee drag at this level reduces our net return expectation below the hurdle rate on a risk-adjusted basis.`,
      severity: "High",
    });
  } else {
    objections.push({
      agent: "IC Portfolio Manager",
      objection: `Fee structure is within tolerance, but we would request a Most Favoured Nation (MFN) clause and fee offset provisions for any co-investment rights at this commitment level.`,
      severity: "Low",
    });
  }

  // Objection 3: Strategy / compliance specific
  if (lp.shariaRequired && fit.penaltyReasons.some((r) => r.includes("Sharia"))) {
    objections.push({
      agent: "Sharia Supervisory Board",
      objection: `The proposed strategy does not appear to be structured under AAOIFI-compliant instruments. We require Murabaha or Ijara documentation before this can proceed to full IC review.`,
      severity: "High",
    });
  } else if (lp.esgPriority >= 8) {
    objections.push({
      agent: "ESG Integration Officer",
      objection: `The pitch does not include a Principal Adverse Impact (PAI) statement or SFDR pre-contractual disclosure. Article 8 classification requires these before we can proceed to due diligence.`,
      severity: "Medium",
    });
  } else if (lp.irrHurdle !== null && params.priorIRR < lp.irrHurdle) {
    objections.push({
      agent: "IC Chair",
      objection: `Prior fund net IRR of ${params.priorIRR}% does not meet our ${lp.irrHurdle}% absolute return hurdle. We would need to understand the performance attribution and whether the shortfall was structural or cyclical.`,
      severity: "High",
    });
  } else {
    objections.push({
      agent: "IC Chair",
      objection: `Concentration risk in the proposed portfolio is not addressed. We would require a maximum single-asset exposure cap of 15% and a geographic diversification commitment before final approval.`,
      severity: "Medium",
    });
  }

  // Verdict based on fit score
  let icVerdict: ICVerdict;
  let icRationale: string;

  if (fit.score >= 70) {
    icVerdict = "Approved";
    icRationale = `Fit score of ${fit.score}/100 meets our internal threshold. Subject to resolution of the above conditions, the IC recommends proceeding to full due diligence and term sheet negotiation.`;
  } else if (fit.score >= 45) {
    icVerdict = "Conditional Watchlist";
    icRationale = `Fit score of ${fit.score}/100 is below our preferred threshold but above the rejection floor. The IC recommends placing this manager on a 12-month watchlist, with a re-evaluation trigger if track record or fee terms improve.`;
  } else {
    icVerdict = "Rejected";
    icRationale = `Fit score of ${fit.score}/100 is below our minimum threshold. The combination of ${fit.penaltyReasons.join("; ")} creates structural barriers that cannot be resolved within the current fund terms. The IC recommends no further engagement at this time.`;
  }

  return { tailoredPitch, icObjections: objections, icVerdict, icRationale };
}

// ── Part 5: Auto-Calibration Decision Ledger ─────────────────────────────────

export function loadDecisionLedger(): DecisionLedgerEntry[] {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDecisionLedgerEntry(entry: Omit<DecisionLedgerEntry, "id" | "timestamp">): void {
  const ledger = loadDecisionLedger();
  const newEntry: DecisionLedgerEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  ledger.push(newEntry);
  // Keep last 500 entries
  const trimmed = ledger.slice(-500);
  localStorage.setItem(LEDGER_KEY, JSON.stringify(trimmed));
  recalibrate(trimmed);
}

/**
 * Ridge/Lasso-style approximation calibration.
 * Compares predicted IC scores against simulated actual close rates.
 * Calculates a Pattern Moat Multiplier that adjusts fit coefficients.
 */
function recalibrate(ledger: DecisionLedgerEntry[]): void {
  const withOutcomes = ledger.filter((e) => e.actualCloseRate !== undefined);
  if (withOutcomes.length < 5) return;

  // Simple linear regression: predicted score → actual close rate
  const n = withOutcomes.length;
  const xs = withOutcomes.map((e) => e.fitScore / 100);
  const ys = withOutcomes.map((e) => e.actualCloseRate!);

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (ys[i] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);

  const slope = denominator !== 0 ? numerator / denominator : 1;
  // Multiplier: how much better our predictions are vs a naive baseline
  const multiplier = Math.max(0.8, Math.min(1.5, 1 + slope * 0.1));

  const moat: PatternMoat = {
    multiplier: parseFloat(multiplier.toFixed(3)),
    sampleSize: n,
    lastUpdated: Date.now(),
  };
  localStorage.setItem(MOAT_KEY, JSON.stringify(moat));
}

export function loadPatternMoat(): PatternMoat {
  try {
    const raw = localStorage.getItem(MOAT_KEY);
    return raw ? JSON.parse(raw) : { multiplier: 1.0, sampleSize: 0, lastUpdated: 0 };
  } catch {
    return { multiplier: 1.0, sampleSize: 0, lastUpdated: 0 };
  }
}

/** Apply the Pattern Moat multiplier to a raw fit score */
export function applyPatternMoat(rawScore: number): number {
  const moat = loadPatternMoat();
  return Math.min(100, parseFloat((rawScore * moat.multiplier).toFixed(1)));
}
