// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — Shared IC Debate Agents (server-safe, no browser dependencies)
// Extracted from client/src/lib/capTwinAgents.ts — pure TypeScript only.
// localStorage-dependent ledger/moat persistence remains in the client lib.
// ─────────────────────────────────────────────────────────────────────────────

import type { LimitedPartner, FundStrategy } from "./lpRegistry";
import type { FundParams, FitScoreResult } from "./engine";

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

// ── Agent 1: Pitch Architect ─────────────────────────────────────────────────

export function generateTailoredPitch(
  params: FundParams,
  lp: LimitedPartner
): string {
  const ticketRange = `USD ${lp.ticketMin}M–${lp.ticketMax}M`;
  const trackRecord = `${params.trackRecord}-year`;

  if (lp.shariaRequired) {
    return `We are pleased to present ${params.strategy} Fund, targeting ${ticketRange} from Sharia-compliant institutional investors. \
Our ${trackRecord} track record in ${params.strategy.toLowerCase()} is supported by full Sharia supervisory board oversight and AAOIFI-compliant documentation. \
We believe this structure aligns directly with your ${ticketRange} ticket mandate and infrastructure/debt focus.

We welcome the opportunity to present our Sharia compliance framework and AAOIFI certification documentation at your earliest convenience.`;
  }

  if (lp.esgPriority >= 8) {
    return `We are pleased to present ${params.strategy} Fund, targeting ${ticketRange} from ESG-mandated institutional investors. \
Our ${trackRecord} track record demonstrates consistent integration of ESG risk factors across the portfolio lifecycle. \
We are prepared to provide full SFDR pre-contractual disclosure, PAI statements, and AIFMD passporting documentation.

We would welcome the opportunity to provide our full SFDR pre-contractual disclosure and AIFMD passporting documentation.`;
  }

  return `We are pleased to present ${params.strategy} Fund, targeting ${ticketRange} from institutional investors. \
Our ${trackRecord} track record in ${params.strategy.toLowerCase()} demonstrates consistent risk-adjusted returns across market cycles. \
The fund targets a net IRR of ${params.priorIRR}%+ with a ${params.managementFee}% management fee and ${params.carry}% carry structure.

The fund is targeting a first close within 6 months, with a final close at 18–24 months. \
The subscription cycle is targeted at 6–8 weeks from first close to final commitment. \
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
