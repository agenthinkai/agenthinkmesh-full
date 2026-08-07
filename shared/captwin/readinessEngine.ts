/**
 * readinessEngine.ts — Global Investor Readiness Score Engine v1.0.0
 *
 * Evaluates a fund profile across 14 institutional readiness dimensions.
 * All weights and scoring rules are documented and transparent.
 * No unexplained arithmetic. Every score maps to a named factor.
 *
 * Output labels: "Ready" | "Ready with Conditions" | "Not Ready"
 */

import type { FundProfile } from "./fitEngine";
import { LP_AGENT_BANK } from "./agentBank";
import { computeAllocatorFit as computeFitScoreV2 } from "./fitEngine";

export const READINESS_ENGINE_VERSION = "1.0.0";

// ── Dimension Definitions ─────────────────────────────────────────────────────

export interface ReadinessDimension {
  id: string;
  label: string;
  weight: number; // 0–1, all weights sum to 1.0
  score: number;  // 0–100
  label_score: "strong" | "adequate" | "weak" | "missing";
  rationale: string;
  blockers: string[];
  corrections: string[];
}

export interface ReadinessResult {
  overallScore: number;
  readinessLabel: "Ready" | "Ready with Conditions" | "Not Ready";
  dimensions: ReadinessDimension[];
  topBlockers: string[];
  highestImpactCorrections: string[];
  accessibleSegments: string[];
  blockedSegments: string[];
  evidenceRequiredBeforeOutreach: string[];
  disclaimer: string;
  engineVersion: string;
}

// ── Dimension Weights (must sum to 1.0) ───────────────────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  strategy_clarity:          0.10,
  track_record_evidence:     0.12,
  fund_economics:            0.09,
  gp_commitment:             0.06,
  governance:                0.06,
  reporting:                 0.05,
  institutional_infrastructure: 0.06,
  liquidity:                 0.06,
  risk_controls:             0.05,
  esg:                       0.05,
  sharia_readiness:          0.05,
  co_investment_readiness:   0.05,
  evidence_completeness:     0.09,
  diligence_readiness:       0.11,
};

// Verify weights sum to 1.0 at module load
const WEIGHT_SUM = Object.values(DIMENSION_WEIGHTS).reduce((s, v) => s + v, 0);
if (Math.abs(WEIGHT_SUM - 1.0) > 0.001) {
  throw new Error(`READINESS_ENGINE: dimension weights sum to ${WEIGHT_SUM}, expected 1.0`);
}

// ── Scoring Functions ─────────────────────────────────────────────────────────

function scoreStrategyClarify(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 100;

  if (!fund.strategy || fund.strategy === "Unknown") {
    score -= 50; blockers.push("Strategy is undefined or unknown");
    corrections.push("Define a clear investment strategy statement");
  }
  if (!fund.assetClass) {
    score -= 20; corrections.push("Specify the primary asset class");
  }
  if (!fund.geography) {
    score -= 15; corrections.push("Define the geographic focus");
  }
  if (!fund.targetReturnPct) {
    score -= 15; corrections.push("Write a clear investment proposition statement");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "strategy_clarity",
    label: "Strategy Clarity",
    weight: DIMENSION_WEIGHTS.strategy_clarity,
    score: Math.max(0, score),
    label_score,
    rationale: "Institutional allocators require a clear, differentiated strategy statement before initiating diligence.",
    blockers,
    corrections,
  };
}

function scoreTrackRecord(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 100;

  if (fund.trackRecordYrs < 3) {
    score -= 40; blockers.push(`Track record of ${fund.trackRecordYrs} years is below the 3-year institutional minimum`);
    corrections.push("Provide attribution analysis from prior roles if fund track record is short");
  } else if (fund.trackRecordYrs < 5) {
    score -= 15; corrections.push("Track record under 5 years may limit access to pension funds and insurance allocators");
  }

  if (!(fund.priorFundIRR ?? 0) || (fund.priorFundIRR ?? 0) <= 0) {
    score -= 30; blockers.push("No prior fund IRR data available");
    corrections.push("Document realized exits and interim IRR with audited support");
  } else if ((fund.priorFundIRR ?? 0) > 0 && (fund.priorFundIRR ?? 0) < 8) {
    score -= 20; corrections.push("Prior fund IRR below 8% hurdle rate will face scrutiny from most institutional allocators");
  }

  if (!fund.fundVersion) {
    score -= 10; corrections.push("Specify the vintage year of prior fund(s)");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "track_record_evidence",
    label: "Track Record Evidence",
    weight: DIMENSION_WEIGHTS.track_record_evidence,
    score: Math.max(0, score),
    label_score,
    rationale: "Track record is the primary institutional credibility signal. Short or unaudited records are the most common rejection reason.",
    blockers,
    corrections,
  };
}

function scoreFundEconomics(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 100;

  if (fund.managementFeePct > 2.5) {
    score -= 25; blockers.push(`Management fee of ${fund.managementFeePct}% exceeds the 2.5% institutional ceiling`);
    corrections.push("Consider reducing management fee or providing a fee offset mechanism");
  } else if (fund.managementFeePct > 2.0) {
    score -= 10; corrections.push("Management fee above 2% will be challenged by pension and insurance allocators");
  }

  if (fund.carryPct > 25) {
    score -= 15; corrections.push("Carried interest above 25% requires exceptional track record justification");
  }

  if (fund.hurdleRatePct ?? 8 < 6) {
    score -= 20; blockers.push("Hurdle rate below 6% is below most institutional minimums");
    corrections.push("Set hurdle rate at 6–8% minimum to meet institutional standards");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "fund_economics",
    label: "Fund Economics",
    weight: DIMENSION_WEIGHTS.fund_economics,
    score: Math.max(0, score),
    label_score,
    rationale: "Fee structure is a primary screening criterion. Fees above market norms require exceptional track record justification.",
    blockers,
    corrections,
  };
}

function scoreGPCommitment(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 100;
  const gpPct = fund.gpCommitmentPct ?? 1;

  if (gpPct < 1) {
    score -= 35; blockers.push(`GP commitment of ${gpPct}% is below the 1% institutional minimum`);
    corrections.push("Increase GP commitment to at least 1% of fund size to meet institutional standards");
  } else if (gpPct < 2) {
    score -= 10; corrections.push("GP commitment below 2% may be challenged by large institutional allocators");
  } else if (gpPct >= 3) {
    score = Math.min(100, score + 5); // Bonus for strong alignment
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "gp_commitment",
    label: "GP Commitment",
    weight: DIMENSION_WEIGHTS.gp_commitment,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "GP commitment signals alignment of interest. Below 1% is a common hard rejection criterion.",
    blockers,
    corrections,
  };
}

function scoreGovernance(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 70; // Default moderate — governance details rarely in fund profile

  // Infer from available data
  if (fund.domicile) {
    if (["Cayman Islands", "Delaware", "Luxembourg", "Ireland"].includes(fund.domicile)) {
      score += 20;
    } else if (fund.domicile === "Unknown") {
      score -= 20; blockers.push("Fund domicile is unknown");
      corrections.push("Confirm fund domicile and legal structure");
    }
  } else {
    score -= 10; corrections.push("Specify fund domicile and legal structure");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "governance",
    label: "Governance",
    weight: DIMENSION_WEIGHTS.governance,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Governance structure and fund domicile affect regulatory compliance and institutional eligibility.",
    blockers,
    corrections,
  };
}

function scoreReporting(fund: FundProfile): ReadinessDimension {
  const corrections: string[] = [];
  let score = 65; // Default — reporting details not in fund profile

  if (fund.currency && fund.currency !== "Unknown") {
    score += 10;
  } else {
    corrections.push("Confirm reporting currency and frequency");
  }

  corrections.push("Prepare ILPA-compliant quarterly reporting templates before LP outreach");
  corrections.push("Document NAV calculation methodology and independent valuation process");

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "reporting",
    label: "Reporting Standards",
    weight: DIMENSION_WEIGHTS.reporting,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Institutional allocators require ILPA-compliant reporting with independent valuation and defined NAV methodology.",
    blockers: [],
    corrections,
  };
}

function scoreInstitutionalInfrastructure(fund: FundProfile): ReadinessDimension {
  const corrections: string[] = [];
  let score = 60; // Default — infrastructure details not in fund profile

  corrections.push("Confirm independent fund administrator is appointed");
  corrections.push("Confirm independent auditor is appointed");
  corrections.push("Confirm legal counsel is appointed for fund formation");
  corrections.push("Confirm compliance officer or outsourced compliance function is in place");

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "institutional_infrastructure",
    label: "Institutional Infrastructure",
    weight: DIMENSION_WEIGHTS.institutional_infrastructure,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Independent administrator, auditor, and legal counsel are table-stakes requirements for institutional investors.",
    blockers: [],
    corrections,
  };
}

function scoreLiquidity(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 80;

  const fundTerm = (fund.fundTermYrs ?? 10);
  if (fundTerm > 12) {
    score -= 20; blockers.push(`Fund term of ${fundTerm} years exceeds the 12-year maximum for many institutional mandates`);
    corrections.push("Consider reducing fund term or adding extension provisions with LP consent");
  } else if (fundTerm < 7) {
    score -= 10; corrections.push("Fund term under 7 years may be too short for private equity strategies");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "liquidity",
    label: "Liquidity Profile",
    weight: DIMENSION_WEIGHTS.liquidity,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Fund term and liquidity profile must align with institutional allocation horizons and liability matching requirements.",
    blockers,
    corrections,
  };
}

function scoreRiskControls(fund: FundProfile): ReadinessDimension {
  const corrections: string[] = [];
  let score = 65;

  corrections.push("Document portfolio concentration limits and diversification policy");
  corrections.push("Prepare stress-scenario analysis for the investment strategy");
  corrections.push("Define key-man provisions and succession planning");

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "risk_controls",
    label: "Risk Controls",
    weight: DIMENSION_WEIGHTS.risk_controls,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Institutional allocators require documented risk controls, concentration limits, and key-man provisions.",
    blockers: [],
    corrections,
  };
}

function scoreESG(fund: FundProfile): ReadinessDimension {
  const corrections: string[] = [];
  let score = 50;

  if (fund.esgPolicy && fund.esgPolicy !== "none") {
    score += 35;
    if (fund.esgPolicy.includes("SFDR Article 8") || fund.esgPolicy.includes("SFDR Article 9")) {
      score += 10;
    }
  } else {
    corrections.push("Adopt a recognised ESG framework (minimum: UN PRI signatory) before approaching European institutional allocators");
    corrections.push("Prepare an ESG policy statement and integration methodology");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "esg",
    label: "ESG Framework",
    weight: DIMENSION_WEIGHTS.esg,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "ESG compliance is a hard requirement for European institutional allocators and increasingly required by pension funds globally.",
    blockers: [],
    corrections,
  };
}

function scoreSharia(fund: FundProfile): ReadinessDimension {
  const corrections: string[] = [];
  let score = 60; // Neutral — Sharia is not required for most segments

  if (fund.shariaCompliant === true) {
    score = 95;
  } else if (fund.shariaCompliant === false) {
    score = 55; // Not a blocker for non-Islamic allocators
    corrections.push("Sharia compliance not established — Islamic institutional allocators (SWFs, Islamic banks) will be inaccessible");
  } else {
    corrections.push("Clarify Sharia compliance status to determine accessibility of Islamic institutional capital");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "sharia_readiness",
    label: "Sharia Readiness",
    weight: DIMENSION_WEIGHTS.sharia_readiness,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Sharia compliance is required to access Islamic institutional capital. Non-compliant funds are ineligible for Islamic SWFs and Islamic bank mandates.",
    blockers: [],
    corrections,
  };
}

function scoreCoInvestment(fund: FundProfile): ReadinessDimension {
  const corrections: string[] = [];
  let score = 65;

  if (fund.coInvestmentRights && fund.coInvestmentRights !== "None") {
    score += 25;
  } else {
    corrections.push("Define a co-investment policy — family offices and large institutional allocators frequently require co-investment rights");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "co_investment_readiness",
    label: "Co-Investment Readiness",
    weight: DIMENSION_WEIGHTS.co_investment_readiness,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Co-investment rights are a differentiating factor for family offices and large institutional allocators seeking fee reduction.",
    blockers: [],
    corrections,
  };
}

function scoreEvidenceCompleteness(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 100;

  if (!fund.targetReturnPct) {
    score -= 20; blockers.push("Investment proposition is missing");
    corrections.push("Write a clear investment proposition for the data room");
  }
  if (!fund.reportingFrequency) {
    score -= 15; corrections.push("Prepare a risk and liquidity profile document");
  }
  if (!fund.governanceStructure) {
    score -= 15; corrections.push("Document institutional requirements (minimum ticket, investor eligibility, regulatory status)");
  }
  if (fund.trackRecordYrs < 3) {
    score -= 20; blockers.push("Track record evidence is insufficient for institutional diligence");
  }

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "evidence_completeness",
    label: "Evidence Completeness",
    weight: DIMENSION_WEIGHTS.evidence_completeness,
    score: Math.max(0, score),
    label_score,
    rationale: "Evidence completeness determines whether a fund can survive institutional diligence. Missing evidence is the primary cause of stalled processes.",
    blockers,
    corrections,
  };
}

function scoreDiligenceReadiness(fund: FundProfile): ReadinessDimension {
  const blockers: string[] = [];
  const corrections: string[] = [];
  let score = 70;

  if (fund.targetFundSizeM < 25) {
    score -= 20; blockers.push("Fund size below $25M is below the minimum for most institutional allocators");
    corrections.push("Institutional minimum fund size is typically $50M–$100M for most allocator segments");
  } else if (fund.targetFundSizeM < 50) {
    score -= 10; corrections.push("Fund size below $50M limits access to large institutional allocators");
  }

  corrections.push("Prepare a data room with audited financials, legal documents, and track record attribution");
  corrections.push("Prepare a DDQ (Due Diligence Questionnaire) response template");
  corrections.push("Prepare reference contacts from prior fund investors");

  const label_score = score >= 80 ? "strong" : score >= 60 ? "adequate" : score >= 40 ? "weak" : "missing";
  return {
    id: "diligence_readiness",
    label: "Diligence Readiness",
    weight: DIMENSION_WEIGHTS.diligence_readiness,
    score: Math.max(0, Math.min(100, score)),
    label_score,
    rationale: "Diligence readiness determines whether a fund can complete an institutional process once initiated.",
    blockers,
    corrections,
  };
}

// ── Main Readiness Computation ────────────────────────────────────────────────

export function computeReadinessScore(fund: FundProfile): ReadinessResult {
  const dimensions: ReadinessDimension[] = [
    scoreStrategyClarify(fund),
    scoreTrackRecord(fund),
    scoreFundEconomics(fund),
    scoreGPCommitment(fund),
    scoreGovernance(fund),
    scoreReporting(fund),
    scoreInstitutionalInfrastructure(fund),
    scoreLiquidity(fund),
    scoreRiskControls(fund),
    scoreESG(fund),
    scoreSharia(fund),
    scoreCoInvestment(fund),
    scoreEvidenceCompleteness(fund),
    scoreDiligenceReadiness(fund),
  ];

  // Weighted overall score
  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
  );

  // Readiness label
  const readinessLabel: "Ready" | "Ready with Conditions" | "Not Ready" =
    overallScore >= 75 ? "Ready" :
    overallScore >= 55 ? "Ready with Conditions" :
    "Not Ready";

  // Top blockers (from all dimensions, sorted by weight × severity)
  const allBlockers = dimensions
    .filter((d) => d.blockers.length > 0)
    .sort((a, b) => b.weight - a.weight)
    .flatMap((d) => d.blockers);

  // Highest-impact corrections (from weak/missing dimensions, sorted by weight)
  const highestImpactCorrections = dimensions
    .filter((d) => d.label_score === "weak" || d.label_score === "missing")
    .sort((a, b) => b.weight - a.weight)
    .flatMap((d) => d.corrections)
    .slice(0, 8);

  // Segment accessibility based on fit scores
  const accessibleSegments: string[] = [];
  const blockedSegments: string[] = [];
  for (const agent of LP_AGENT_BANK) {
    const fitResult = computeFitScoreV2(fund, agent);
    if (fitResult.fitCategory === "Likely Ineligible") {
      blockedSegments.push(agent.name);
    } else if (fitResult.fitCategory === "Strong Fit" || fitResult.fitCategory === "Conditional Fit") {
      accessibleSegments.push(agent.name);
    }
  }

  // Evidence required before outreach
  const evidenceRequired = dimensions
    .filter((d) => d.label_score === "missing" || d.blockers.length > 0)
    .flatMap((d) => d.corrections)
    .filter((c) => c.toLowerCase().includes("prepare") || c.toLowerCase().includes("document") || c.toLowerCase().includes("confirm"))
    .slice(0, 6);

  return {
    overallScore,
    readinessLabel,
    dimensions,
    topBlockers: allBlockers.slice(0, 5),
    highestImpactCorrections,
    accessibleSegments,
    blockedSegments,
    evidenceRequiredBeforeOutreach: evidenceRequired,
    disclaimer: "SYNTHETIC SIMULATION — This readiness assessment is based on fund profile data and institutional archetype benchmarks. It does not constitute placement advice, regulatory guidance, or a guarantee of investor interest. Actual institutional requirements vary by allocator, mandate, and market conditions.",
    engineVersion: READINESS_ENGINE_VERSION,
  };
}
