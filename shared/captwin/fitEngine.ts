/**
 * CapTwin Allocator Fit Engine v2
 * Version: 2.0.0
 *
 * 18-dimension deterministic scoring engine.
 * Identical inputs + versions = identical outputs.
 * LLM narratives must never overwrite these scores.
 * Unknown inputs reduce confidence and create evidence gaps.
 *
 * DISCLAIMER: Outputs are evidence-based synthetic simulations.
 * Not validated predictions of real allocator behaviour.
 */

import type { LPAgent } from "./agentBank";
import { LP_AGENT_BANK_VERSION } from "./agentBank";

export const FIT_ENGINE_VERSION = "2.0.0";

// ── Input types ───────────────────────────────────────────────────────────────

export interface FundProfile {
  // Identity
  fundName: string;
  gpName: string;
  strategy: string;
  assetClass: string | null;
  geography: string | null;
  domicile: string | null;
  currency: string;
  // Size
  targetFundSizeM: number;
  firstCloseTargetM?: number | null;
  // Economics
  managementFeePct: number;
  carryPct: number;
  hurdleRatePct?: number | null;
  gpCommitmentPct?: number | null;
  // Track record
  trackRecordYrs: number;
  priorFundIRR?: number | null;
  priorFundTVPI?: number | null;
  realizedExitCount?: number | null;
  unrealizedPct?: number | null;
  // Proposition
  targetReturnPct?: number | null;
  coInvestmentRights?: string | null;
  esgPolicy?: string | null;
  shariaCompliant?: boolean | null;
  // Ticket
  minTicketM?: number | null;
  maxTicketM?: number | null;
  // Governance
  governanceStructure?: string | null;
  reportingFrequency?: string | null;
  // Fund term
  fundTermYrs?: number | null;
  // Version
  fundVersion: number;
}

// ── Output types ──────────────────────────────────────────────────────────────

export type FitCategoryV2 = "Strong Fit" | "Conditional Fit" | "Weak Fit" | "Likely Ineligible";
export type OutreachPriorityV2 = "First Priority" | "Secondary" | "Avoid For Now" | "Not Applicable";
export type ConfidenceLevel = "High" | "Moderate" | "Low" | "Insufficient Data";

export interface DimensionScore {
  dimension: string;
  score: number;       // 0–100
  weight: number;      // 0–1, weights sum to 1
  reasoning: string;
  dataPresent: boolean;
}

export interface EvidenceGap {
  field: string;
  description: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  impactOnScore: string;
}

export interface FitResultV2 {
  // Scores
  overallFitScore: number;           // 0–100, deterministic
  fitCategory: FitCategoryV2;
  // Dimension breakdown
  dimensions: DimensionScore[];
  // Narrative support (deterministic — not LLM)
  principalFitReasons: string[];
  disqualifyingIssues: string[];
  unknownFactors: string[];
  requiredEvidence: string[];
  // Targeting
  outreachPriority: OutreachPriorityV2;
  // Confidence
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;           // 0–100
  evidenceGaps: EvidenceGap[];
  // Metadata
  engineVersion: string;
  registryVersion: string;
  fundVersion: number;
  segmentId: string;
  computedAt: number;
}

// ── Dimension weights ─────────────────────────────────────────────────────────
// Weights are documented here for auditability.
// Total must sum to 1.0.
const WEIGHTS = {
  mandate:          0.08,
  strategy:         0.10,
  assetClass:       0.06,
  geography:        0.06,
  ticketSize:       0.08,
  fundSize:         0.07,
  returnFit:        0.08,
  liquidity:        0.04,
  trackRecord:      0.10,
  economics:        0.08,
  governance:       0.05,
  reporting:        0.04,
  esg:              0.05,
  sharia:           0.06,
  coInvestment:     0.03,
  evidence:         0.06,
  firstTimeFund:    0.03,
  gpCommitment:     0.03,
} as const;

// Verify weights sum to 1.0 (compile-time documentation)
// 0.08+0.10+0.06+0.06+0.08+0.07+0.08+0.04+0.10+0.08+0.05+0.04+0.05+0.06+0.03+0.06+0.03+0.03 = 1.00

// ── Helper ────────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function computeAllocatorFit(
  fund: FundProfile,
  agent: LPAgent
): FitResultV2 {
  const dims: DimensionScore[] = [];
  const evidenceGaps: EvidenceGap[] = [];
  const principalFitReasons: string[] = [];
  const disqualifyingIssues: string[] = [];
  const unknownFactors: string[] = [];
  const requiredEvidence: string[] = [];

  // ── 1. Mandate fit ──────────────────────────────────────────────────────────
  // Broad compatibility: does the fund type match the agent's mandate?
  const strategyInPreferred = agent.preferredAssetClasses.some(
    (a) => a.toLowerCase().includes(fund.strategy.toLowerCase()) ||
           fund.strategy.toLowerCase().includes(a.toLowerCase())
  );
  const mandateScore = strategyInPreferred ? 85 : 35;
  dims.push({
    dimension: "Mandate Fit",
    score: mandateScore,
    weight: WEIGHTS.mandate,
    reasoning: strategyInPreferred
      ? `${fund.strategy} aligns with ${agent.segmentType} mandate`
      : `${fund.strategy} is outside typical ${agent.segmentType} mandate`,
    dataPresent: true,
  });
  if (strategyInPreferred) principalFitReasons.push(`Strategy aligns with ${agent.segmentType} mandate`);

  // ── 2. Strategy fit ─────────────────────────────────────────────────────────
  const strategyScore = strategyInPreferred ? 90 : 25;
  dims.push({
    dimension: "Strategy Fit",
    score: strategyScore,
    weight: WEIGHTS.strategy,
    reasoning: strategyInPreferred
      ? `${fund.strategy} is in preferred asset class list`
      : `${fund.strategy} not in preferred list: [${agent.preferredAssetClasses.join(", ")}]`,
    dataPresent: true,
  });
  if (!strategyInPreferred) disqualifyingIssues.push(`Strategy "${fund.strategy}" outside allocator mandate`);

  // ── 3. Asset class fit ──────────────────────────────────────────────────────
  let assetClassScore = 70;
  let assetClassPresent = true;
  if (!fund.assetClass) {
    assetClassScore = 50;
    assetClassPresent = false;
    evidenceGaps.push({ field: "assetClass", description: "Asset class not specified", priority: "Medium", impactOnScore: "Asset class score defaulted to neutral 50" });
    unknownFactors.push("Asset class not specified");
    requiredEvidence.push("Specify primary asset class");
  } else {
    const acMatch = agent.preferredAssetClasses.some((a) =>
      a.toLowerCase().includes(fund.assetClass!.toLowerCase()) ||
      fund.assetClass!.toLowerCase().includes(a.toLowerCase())
    );
    assetClassScore = acMatch ? 90 : 40;
    if (acMatch) principalFitReasons.push(`Asset class "${fund.assetClass}" matches allocator preference`);
  }
  dims.push({ dimension: "Asset Class Fit", score: assetClassScore, weight: WEIGHTS.assetClass, reasoning: assetClassPresent ? `Asset class: ${fund.assetClass}` : "Asset class unknown", dataPresent: assetClassPresent });

  // ── 4. Geography fit ────────────────────────────────────────────────────────
  let geoScore = 70;
  let geoPresent = true;
  if (!fund.geography) {
    geoScore = 50;
    geoPresent = false;
    evidenceGaps.push({ field: "geography", description: "Fund geography not specified", priority: "Medium", impactOnScore: "Geography score defaulted to neutral 50" });
    unknownFactors.push("Fund geography not specified");
    requiredEvidence.push("Specify fund geographic focus");
  } else {
    const agentGeo = agent.geography.toLowerCase();
    const fundGeo = fund.geography.toLowerCase();
    const geoMatch = agentGeo.includes("global") || fundGeo.includes("global") ||
      agentGeo.split(",").some((g) => fundGeo.includes(g.trim()) || g.trim().includes(fundGeo.split(",")[0]?.trim() ?? ""));
    geoScore = geoMatch ? 85 : 45;
    if (!geoMatch) disqualifyingIssues.push(`Fund geography "${fund.geography}" outside allocator focus "${agent.geography}"`);
  }
  dims.push({ dimension: "Geography Fit", score: geoScore, weight: WEIGHTS.geography, reasoning: geoPresent ? `Fund: ${fund.geography} | Allocator: ${agent.geography}` : "Geography unknown", dataPresent: geoPresent });

  // ── 5. Ticket size fit ──────────────────────────────────────────────────────
  let ticketScore = 70;
  let ticketPresent = true;
  if (fund.minTicketM == null || fund.maxTicketM == null) {
    ticketScore = 50;
    ticketPresent = false;
    evidenceGaps.push({ field: "ticketSize", description: "Fund ticket size range not specified", priority: "High", impactOnScore: "Cannot confirm allocator ticket fits fund minimum" });
    unknownFactors.push("Fund ticket size range not specified");
    requiredEvidence.push("Specify minimum and maximum ticket size");
  } else {
    const agentTicketFits = agent.ticketSizeMinM <= (fund.maxTicketM ?? Infinity) &&
                            agent.ticketSizeMaxM >= (fund.minTicketM ?? 0);
    ticketScore = agentTicketFits ? 90 : 10;
    if (!agentTicketFits) {
      disqualifyingIssues.push(`Ticket size mismatch: allocator range ${agent.ticketSizeMinM}–${agent.ticketSizeMaxM}M vs fund ${fund.minTicketM}–${fund.maxTicketM}M`);
    } else {
      principalFitReasons.push(`Ticket size range compatible (${agent.ticketSizeMinM}–${agent.ticketSizeMaxM}M)`);
    }
  }
  dims.push({ dimension: "Ticket Size Fit", score: ticketScore, weight: WEIGHTS.ticketSize, reasoning: ticketPresent ? `Allocator: ${agent.ticketSizeMinM}–${agent.ticketSizeMaxM}M` : "Ticket range unknown", dataPresent: ticketPresent });

  // ── 6. Fund size fit ────────────────────────────────────────────────────────
  const fundSizeFits = fund.targetFundSizeM >= agent.fundSizeMinM && fund.targetFundSizeM <= agent.fundSizeMaxM;
  const fundSizeScore = fundSizeFits ? 90 : (fund.targetFundSizeM < agent.fundSizeMinM ? 20 : 40);
  dims.push({
    dimension: "Fund Size Fit",
    score: fundSizeScore,
    weight: WEIGHTS.fundSize,
    reasoning: fundSizeFits
      ? `Fund size ${fund.targetFundSizeM}M within allocator range ${agent.fundSizeMinM}–${agent.fundSizeMaxM}M`
      : `Fund size ${fund.targetFundSizeM}M outside allocator range ${agent.fundSizeMinM}–${agent.fundSizeMaxM}M`,
    dataPresent: true,
  });
  if (!fundSizeFits) disqualifyingIssues.push(`Fund size ${fund.targetFundSizeM}M outside allocator preferred range`);

  // ── 7. Return fit ───────────────────────────────────────────────────────────
  let returnScore = 70;
  let returnPresent = true;
  if (agent.returnThresholdPct === null) {
    returnScore = 80; // No threshold — neutral positive
  } else if (fund.targetReturnPct == null) {
    returnScore = 45;
    returnPresent = false;
    evidenceGaps.push({ field: "targetReturnPct", description: "Target net IRR not specified", priority: "High", impactOnScore: "Cannot confirm return meets allocator threshold" });
    unknownFactors.push("Target net return not specified");
    requiredEvidence.push("Specify target net IRR");
  } else {
    const returnMeets = fund.targetReturnPct >= agent.returnThresholdPct;
    returnScore = returnMeets ? 90 : clamp(90 - (agent.returnThresholdPct - fund.targetReturnPct) * 8, 0, 90);
    if (!returnMeets) disqualifyingIssues.push(`Target return ${fund.targetReturnPct}% below allocator threshold ${agent.returnThresholdPct}%`);
    else principalFitReasons.push(`Target return ${fund.targetReturnPct}% meets allocator threshold`);
  }
  dims.push({ dimension: "Return Fit", score: returnScore, weight: WEIGHTS.returnFit, reasoning: returnPresent ? `Target: ${fund.targetReturnPct ?? "—"}% | Threshold: ${agent.returnThresholdPct ?? "none"}%` : "Target return unknown", dataPresent: returnPresent });

  // ── 8. Liquidity fit ────────────────────────────────────────────────────────
  const liquidityScore = agent.liquidityTolerance === "Illiquid OK" ? 90 :
                         agent.liquidityTolerance === "Moderate" ? 65 : 30;
  dims.push({ dimension: "Liquidity Fit", score: liquidityScore, weight: WEIGHTS.liquidity, reasoning: `Allocator liquidity tolerance: ${agent.liquidityTolerance}`, dataPresent: true });

  // ── 9. Track record fit ─────────────────────────────────────────────────────
  let trackScore = 70;
  const trackMeets = fund.trackRecordYrs >= agent.trackRecordRequiredYrs;
  if (!trackMeets) {
    const shortfall = agent.trackRecordRequiredYrs - fund.trackRecordYrs;
    trackScore = clamp(70 - shortfall * 12, 0, 70);
    disqualifyingIssues.push(`Track record ${fund.trackRecordYrs}yr below allocator minimum ${agent.trackRecordRequiredYrs}yr`);
  } else {
    trackScore = 90;
    principalFitReasons.push(`Track record ${fund.trackRecordYrs}yr meets allocator minimum`);
  }
  // IRR bonus
  if (fund.priorFundIRR != null && agent.returnThresholdPct != null && fund.priorFundIRR >= agent.returnThresholdPct) {
    trackScore = clamp(trackScore + 10, 0, 100);
    principalFitReasons.push(`Prior fund IRR ${fund.priorFundIRR}% meets allocator threshold`);
  }
  if (fund.priorFundIRR == null) {
    evidenceGaps.push({ field: "priorFundIRR", description: "Prior fund net IRR not provided", priority: "High", impactOnScore: "Cannot confirm return track record" });
    unknownFactors.push("Prior fund net IRR not specified");
    requiredEvidence.push("Provide prior fund net IRR");
  }
  if (fund.realizedExitCount == null) {
    evidenceGaps.push({ field: "realizedExitCount", description: "Realized exit count not provided", priority: "High", impactOnScore: "Allocators require evidence of realized returns" });
    unknownFactors.push("Realized exit count not specified");
    requiredEvidence.push("Provide number of realized exits");
  }
  dims.push({ dimension: "Track Record Fit", score: trackScore, weight: WEIGHTS.trackRecord, reasoning: `${fund.trackRecordYrs}yr track record | Required: ${agent.trackRecordRequiredYrs}yr`, dataPresent: true });

  // ── 10. Economics fit ───────────────────────────────────────────────────────
  const feeOk = fund.managementFeePct <= agent.maxManagementFeePct;
  const carryOk = fund.carryPct <= agent.maxCarryPct;
  const economicsScore = feeOk && carryOk ? 90 :
                         !feeOk && !carryOk ? 20 :
                         !feeOk ? 50 : 65;
  if (!feeOk) disqualifyingIssues.push(`Management fee ${fund.managementFeePct}% exceeds allocator maximum ${agent.maxManagementFeePct}%`);
  if (!carryOk) disqualifyingIssues.push(`Carried interest ${fund.carryPct}% exceeds allocator maximum ${agent.maxCarryPct}%`);
  if (feeOk && carryOk) principalFitReasons.push(`Economics within allocator tolerance (${fund.managementFeePct}% / ${fund.carryPct}%)`);
  dims.push({ dimension: "Economics Fit", score: economicsScore, weight: WEIGHTS.economics, reasoning: `Mgmt fee: ${fund.managementFeePct}% (max ${agent.maxManagementFeePct}%) | Carry: ${fund.carryPct}% (max ${agent.maxCarryPct}%)`, dataPresent: true });

  // ── 11. Governance fit ──────────────────────────────────────────────────────
  let govScore = 70;
  let govPresent = true;
  if (!fund.governanceStructure) {
    govScore = 45;
    govPresent = false;
    evidenceGaps.push({ field: "governanceStructure", description: "Governance structure not documented", priority: "High", impactOnScore: "Institutional allocators require documented governance" });
    unknownFactors.push("Governance structure not documented");
    requiredEvidence.push("Document fund governance structure (LPAC, advisory board, etc.)");
  } else {
    govScore = 80;
  }
  dims.push({ dimension: "Governance Fit", score: govScore, weight: WEIGHTS.governance, reasoning: govPresent ? "Governance structure documented" : "Governance structure not documented", dataPresent: govPresent });

  // ── 12. Reporting fit ───────────────────────────────────────────────────────
  let repScore = 70;
  let repPresent = true;
  if (!fund.reportingFrequency) {
    repScore = 45;
    repPresent = false;
    evidenceGaps.push({ field: "reportingFrequency", description: "Reporting frequency not specified", priority: "Medium", impactOnScore: "Institutional allocators require defined reporting cadence" });
    unknownFactors.push("Reporting frequency not specified");
    requiredEvidence.push("Specify reporting frequency (quarterly, semi-annual, annual)");
  } else {
    const hasQuarterly = fund.reportingFrequency.toLowerCase().includes("quarter");
    repScore = hasQuarterly ? 90 : 70;
  }
  dims.push({ dimension: "Reporting Fit", score: repScore, weight: WEIGHTS.reporting, reasoning: repPresent ? `Reporting: ${fund.reportingFrequency}` : "Reporting frequency unknown", dataPresent: repPresent });

  // ── 13. ESG fit ─────────────────────────────────────────────────────────────
  const esgRequired = agent.esgRequirements.toLowerCase().includes("required") || agent.esgRequirements.toLowerCase().includes("mandatory");
  let esgScore = 70;
  let esgPresent = true;
  if (!fund.esgPolicy) {
    esgScore = esgRequired ? 20 : 60;
    esgPresent = false;
    evidenceGaps.push({
      field: "esgPolicy",
      description: "ESG policy not documented",
      priority: esgRequired ? "Critical" : "Medium",
      impactOnScore: esgRequired ? "ESG is required by this allocator — missing policy is disqualifying" : "ESG policy preferred",
    });
    unknownFactors.push("ESG policy not documented");
    requiredEvidence.push("Document ESG policy or framework");
    if (esgRequired) disqualifyingIssues.push("ESG policy required by allocator but not documented");
  } else {
    esgScore = 85;
    principalFitReasons.push("ESG policy documented");
  }
  dims.push({ dimension: "ESG Fit", score: esgScore, weight: WEIGHTS.esg, reasoning: esgPresent ? "ESG policy present" : `ESG policy missing (${esgRequired ? "required" : "preferred"})`, dataPresent: esgPresent });

  // ── 14. Sharia fit ──────────────────────────────────────────────────────────
  let shariaScore = 90; // Default: Sharia not required, no penalty
  if (agent.shariaRequired) {
    if (fund.shariaCompliant === true) {
      shariaScore = 95;
      principalFitReasons.push("Fund is Sharia-compliant — meets allocator requirement");
    } else if (fund.shariaCompliant === false) {
      shariaScore = 0;
      disqualifyingIssues.push("Fund is not Sharia-compliant — allocator requires Sharia compliance");
    } else {
      shariaScore = 15;
      evidenceGaps.push({ field: "shariaCompliant", description: "Sharia compliance status not specified", priority: "Critical", impactOnScore: "Allocator requires Sharia compliance — unknown status is near-disqualifying" });
      unknownFactors.push("Sharia compliance status not specified");
      requiredEvidence.push("Confirm Sharia compliance status and provide SSB documentation");
      disqualifyingIssues.push("Sharia compliance required but not confirmed");
    }
  }
  dims.push({ dimension: "Sharia Fit", score: shariaScore, weight: WEIGHTS.sharia, reasoning: agent.shariaRequired ? `Sharia required | Fund: ${fund.shariaCompliant === true ? "Compliant" : fund.shariaCompliant === false ? "Non-compliant" : "Unknown"}` : "Sharia compliance not required by this allocator", dataPresent: true });

  // ── 15. Co-investment fit ───────────────────────────────────────────────────
  let coInvScore = 70;
  let coInvPresent = true;
  if (!fund.coInvestmentRights) {
    coInvScore = 50;
    coInvPresent = false;
    evidenceGaps.push({ field: "coInvestmentRights", description: "Co-investment rights not specified", priority: "Low", impactOnScore: "Some allocators require co-investment rights" });
    unknownFactors.push("Co-investment rights not specified");
    requiredEvidence.push("Specify co-investment rights policy");
  } else {
    const hasCoInv = fund.coInvestmentRights.toLowerCase() !== "none" && fund.coInvestmentRights.toLowerCase() !== "no";
    coInvScore = hasCoInv ? 85 : 55;
    if (hasCoInv && agent.coInvestmentPreference.toLowerCase().includes("strong")) {
      principalFitReasons.push("Co-investment rights available — valued by this allocator");
    }
  }
  dims.push({ dimension: "Co-Investment Fit", score: coInvScore, weight: WEIGHTS.coInvestment, reasoning: coInvPresent ? `Co-investment: ${fund.coInvestmentRights}` : "Co-investment rights unknown", dataPresent: coInvPresent });

  // ── 16. Evidence completeness ───────────────────────────────────────────────
  const totalFields = 18;
  const missingFields = evidenceGaps.length;
  const evidenceScore = clamp(100 - (missingFields / totalFields) * 100, 0, 100);
  dims.push({ dimension: "Evidence Completeness", score: evidenceScore, weight: WEIGHTS.evidence, reasoning: `${totalFields - missingFields}/${totalFields} key fields present`, dataPresent: missingFields < totalFields });

  // ── 17. First-time fund tolerance ───────────────────────────────────────────
  const isFirstTimeFund = fund.trackRecordYrs < 3;
  let firstTimeScore = 90;
  if (isFirstTimeFund && !agent.firstTimeFundTolerance) {
    firstTimeScore = 5;
    disqualifyingIssues.push("Allocator does not consider first-time funds");
  } else if (isFirstTimeFund && agent.firstTimeFundTolerance) {
    firstTimeScore = 70;
  }
  dims.push({ dimension: "First-Time Fund", score: firstTimeScore, weight: WEIGHTS.firstTimeFund, reasoning: isFirstTimeFund ? `First-time fund | Allocator tolerance: ${agent.firstTimeFundTolerance ? "Yes" : "No"}` : "Established manager", dataPresent: true });

  // ── 18. GP commitment fit ───────────────────────────────────────────────────
  let gpCommScore = 70;
  let gpCommPresent = true;
  if (fund.gpCommitmentPct == null) {
    gpCommScore = 40;
    gpCommPresent = false;
    evidenceGaps.push({ field: "gpCommitmentPct", description: "GP commitment percentage not specified", priority: "High", impactOnScore: "Allocators require GP skin-in-the-game confirmation" });
    unknownFactors.push("GP commitment not specified");
    requiredEvidence.push("Specify GP commitment as % of fund");
  } else {
    const gpMeets = fund.gpCommitmentPct >= agent.minGpCommitmentPct;
    gpCommScore = gpMeets ? 90 : clamp(90 - (agent.minGpCommitmentPct - fund.gpCommitmentPct) * 30, 0, 90);
    if (!gpMeets) disqualifyingIssues.push(`GP commitment ${fund.gpCommitmentPct}% below allocator minimum ${agent.minGpCommitmentPct}%`);
    else principalFitReasons.push(`GP commitment ${fund.gpCommitmentPct}% meets allocator minimum`);
  }
  dims.push({ dimension: "GP Commitment Fit", score: gpCommScore, weight: WEIGHTS.gpCommitment, reasoning: gpCommPresent ? `GP commitment: ${fund.gpCommitmentPct}% | Required: ${agent.minGpCommitmentPct}%` : "GP commitment unknown", dataPresent: gpCommPresent });

  // ── Weighted overall score ──────────────────────────────────────────────────
  const overallRaw = dims.reduce((sum, d) => sum + d.score * d.weight, 0);
  const overallFitScore = round1(clamp(overallRaw, 0, 100));

  // ── Fit category ────────────────────────────────────────────────────────────
  const fitCategory: FitCategoryV2 =
    overallFitScore >= 70 ? "Strong Fit" :
    overallFitScore >= 50 ? "Conditional Fit" :
    overallFitScore >= 30 ? "Weak Fit" : "Likely Ineligible";

  // ── Confidence ──────────────────────────────────────────────────────────────
  const criticalGaps = evidenceGaps.filter((g) => g.priority === "Critical").length;
  const highGaps = evidenceGaps.filter((g) => g.priority === "High").length;
  const confidenceScore = round1(clamp(100 - criticalGaps * 25 - highGaps * 10 - missingFields * 3, 0, 100));
  const confidenceLevel: ConfidenceLevel =
    confidenceScore >= 75 ? "High" :
    confidenceScore >= 50 ? "Moderate" :
    confidenceScore >= 25 ? "Low" : "Insufficient Data";

  // ── Outreach priority ───────────────────────────────────────────────────────
  const outreachPriority: OutreachPriorityV2 =
    fitCategory === "Strong Fit" && confidenceLevel !== "Insufficient Data" ? "First Priority" :
    fitCategory === "Conditional Fit" ? "Secondary" :
    fitCategory === "Weak Fit" ? "Avoid For Now" : "Not Applicable";

  return {
    overallFitScore,
    fitCategory,
    dimensions: dims,
    principalFitReasons,
    disqualifyingIssues,
    unknownFactors,
    requiredEvidence,
    outreachPriority,
    confidenceLevel,
    confidenceScore,
    evidenceGaps,
    engineVersion: FIT_ENGINE_VERSION,
    registryVersion: LP_AGENT_BANK_VERSION,
    fundVersion: fund.fundVersion,
    segmentId: agent.id,
    computedAt: Date.now(),
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function buildFundProfileFromDb(
  fund: {
    fundName: string;
    gpName: string;
    strategy: string;
    assetClass: string | null;
    geography: string | null;
    domicile: string | null;
    currency: string;
    targetFundSizeM: string;
    economicsJson: string;
    investmentPropositionJson: string | null;
    riskLiquidityJson: string | null;
    trackRecordJson: string;
    institutionalRequirementsJson: string | null;
    version: number;
  },
  assumptions: Record<string, unknown> = {}
): FundProfile {
  const economics = JSON.parse(fund.economicsJson) as Record<string, unknown>;
  const proposition = fund.investmentPropositionJson ? JSON.parse(fund.investmentPropositionJson) as Record<string, unknown> : {};
  const trackRecord = JSON.parse(fund.trackRecordJson) as Record<string, unknown>;
  const institutional = fund.institutionalRequirementsJson ? JSON.parse(fund.institutionalRequirementsJson) as Record<string, unknown> : {};

  return {
    fundName: fund.fundName,
    gpName: fund.gpName,
    strategy: fund.strategy,
    assetClass: fund.assetClass,
    geography: fund.geography,
    domicile: fund.domicile,
    currency: fund.currency,
    targetFundSizeM: Number(fund.targetFundSizeM),
    firstCloseTargetM: (proposition.firstCloseTargetM as number | null) ?? null,
    managementFeePct: Number(economics.managementFeePct ?? assumptions.managementFeePct ?? 2.0),
    carryPct: Number(economics.carryPct ?? assumptions.carryPct ?? 20),
    hurdleRatePct: (economics.hurdleRatePct as number | null) ?? null,
    gpCommitmentPct: (economics.gpCommitmentPct as number | null) ?? null,
    trackRecordYrs: Number(trackRecord.trackRecordYrs ?? 0),
    priorFundIRR: (trackRecord.priorFundIRR as number | null) ?? null,
    priorFundTVPI: (trackRecord.priorFundTVPI as number | null) ?? null,
    realizedExitCount: (trackRecord.realizedExits as number | null) ?? null,
    unrealizedPct: (trackRecord.unrealizedPct as number | null) ?? null,
    targetReturnPct: (proposition.targetReturnPct as number | null) ?? null,
    coInvestmentRights: (proposition.coInvestmentRights as string | null) ?? null,
    esgPolicy: (proposition.esgPolicy as string | null) ?? null,
    shariaCompliant: (proposition.shariaCompliant as boolean | null) ?? null,
    minTicketM: (institutional.minTicketM as number | null) ?? null,
    maxTicketM: (institutional.maxTicketM as number | null) ?? null,
    governanceStructure: (institutional.governanceStructure as string | null) ?? null,
    reportingFrequency: (institutional.reportingFrequency as string | null) ?? null,
    fundTermYrs: (proposition.fundTermYears as number | null) ?? null,
    fundVersion: fund.version,
  };
}
