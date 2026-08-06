/**
 * scenarioEngine.ts — WP5 Fund-Term Laboratory Engine
 *
 * Pure TypeScript, deterministic, no LLM calls.
 * All computations are reproducible given the same inputs.
 *
 * DISCLAIMER: Scenarios test defined assumptions rather than predict markets.
 * Improved synthetic LP fit does not guarantee investment.
 * Fund-term changes may have adverse GP economics or legal consequences.
 * CapTwin does not replace placement, legal, tax or regulatory advice.
 * Synthetic archetypes are not identifiable real institutions.
 * Outputs remain uncalibrated until compared with real allocator responses.
 */

import { computeAllocatorFit, buildFundProfileFromDb, FundProfile, FitResultV2, FIT_ENGINE_VERSION } from "./fitEngine";
import { generateObjections, summariseObjections, Objection } from "./objectionEngine";
import { LP_AGENT_BANK, LPAgent, getAgentById } from "./agentBank";
import { OBJECTION_ENGINE_VERSION } from "./objectionEngine";

export const SCENARIO_ENGINE_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────────
// WP5A: Proposed Fund Terms (all fields that can be changed in the laboratory)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposedTerms {
  // Economics
  managementFeePct?: number;
  carryPct?: number;
  hurdleRatePct?: number;
  catchUpPct?: number;
  gpCommitmentPct?: number;
  // Fund structure
  targetFundSizeM?: number;
  firstCloseTargetM?: number;
  fundTermYrs?: number;
  investmentPeriodYrs?: number;
  extensionProvisionsYrs?: number;
  recyclingProvisions?: boolean;
  minLpCommitmentM?: number;
  // Investment strategy
  assetClass?: string;
  sectorConcentration?: string;
  geographicConcentration?: string;
  targetReturnPct?: number;
  targetIrrPct?: number;
  targetMultiple?: number;
  incomeYieldPct?: number;
  numPortfolioInvestments?: number;
  avgInvestmentSizeM?: number;
  // Investor terms
  coInvestmentRights?: string;
  advisoryCommitteeRights?: boolean;
  mfnTerms?: boolean;
  reportingFrequency?: string;
  transparencyLevel?: string;
  liquidityProvisions?: string;
  keyPersonProvisions?: boolean;
  // Institutional positioning
  shariaCompliant?: boolean;
  esgFramework?: string;
  sfdrClassification?: string;
  domicile?: string;
  currency?: string;
  leveragePolicy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5C: Build a FundProfile from base + proposed terms override
// ─────────────────────────────────────────────────────────────────────────────

export function applyProposedTerms(base: FundProfile, proposed: ProposedTerms): FundProfile {
  const economics = {
    managementFeePct: proposed.managementFeePct ?? base.managementFeePct,
    carryPct: proposed.carryPct ?? base.carryPct,
    hurdleRatePct: proposed.hurdleRatePct ?? base.hurdleRatePct,
    gpCommitmentPct: proposed.gpCommitmentPct ?? base.gpCommitmentPct,
  };
  return {
    ...base,
    targetFundSizeM: proposed.targetFundSizeM ?? base.targetFundSizeM,
    assetClass: proposed.assetClass ?? base.assetClass,
    geography: proposed.geographicConcentration ?? base.geography,
    domicile: proposed.domicile ?? base.domicile,
    currency: proposed.currency ?? base.currency,
    managementFeePct: economics.managementFeePct,
    carryPct: economics.carryPct,
    hurdleRatePct: economics.hurdleRatePct,
    gpCommitmentPct: economics.gpCommitmentPct,
    targetReturnPct: proposed.targetReturnPct ?? base.targetReturnPct,
    coInvestmentRights: proposed.coInvestmentRights ?? base.coInvestmentRights,
    esgPolicy: proposed.esgFramework ?? base.esgPolicy,
    shariaCompliant: proposed.shariaCompliant ?? base.shariaCompliant,
    reportingFrequency: proposed.reportingFrequency ?? base.reportingFrequency,
    minTicketM: proposed.minLpCommitmentM ?? base.minTicketM,
    fundTermYrs: proposed.fundTermYrs ?? base.fundTermYrs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5C: Compute scenario result for one segment
// ─────────────────────────────────────────────────────────────────────────────

export interface SegmentScenarioResult {
  segmentId: string;
  segmentName: string;
  baseFitScore: number;
  scenarioFitScore: number;
  scoreDelta: number;
  baseCategory: string;
  scenarioCategory: string;
  baseConfidence: number;
  scenarioConfidence: number;
  confidenceDelta: number;
  baseOutreachPriority: string;
  scenarioOutreachPriority: string;
  priorityChanged: boolean;
  objectionsAdded: Objection[];
  objectionsResolved: Objection[];
  objectionsAddedCount: number;
  objectionsResolvedCount: number;
  dimensionDeltas: Array<{
    dimension: string;
    baseScore: number;
    scenarioScore: number;
    delta: number;
    weight: number;
  }>;
  evidenceGaps: string[];
  eligibilityChanged: boolean;
  baseEligible: boolean;
  scenarioEligible: boolean;
}

export function computeSegmentScenario(
  base: FundProfile,
  proposed: FundProfile,
  agent: LPAgent,
): SegmentScenarioResult {
  const baseResult = computeAllocatorFit(base, agent);
  const scenarioResult = computeAllocatorFit(proposed, agent);

  const baseObjections = generateObjections(base, agent);
  const scenarioObjections = generateObjections(proposed, agent);

  const baseCategories = new Set<string>(baseObjections.map((o) => o.category as string));
  const scenarioCategories = new Set<string>(scenarioObjections.map((o) => o.category as string));

  const objectionsAdded = scenarioObjections.filter((o) => !baseCategories.has(o.category));
  const objectionsResolved = baseObjections.filter((o) => !scenarioCategories.has(o.category));

  const dimensionDeltas = baseResult.dimensions.map((bd) => {
    const sd = scenarioResult.dimensions.find((d) => d.dimension === bd.dimension);
    return {
      dimension: bd.dimension,
      baseScore: bd.score,
      scenarioScore: sd?.score ?? bd.score,
      delta: (sd?.score ?? bd.score) - bd.score,
      weight: bd.weight,
    };
  });

  const baseEligible = baseResult.fitCategory !== "Likely Ineligible";
  const scenarioEligible = scenarioResult.fitCategory !== "Likely Ineligible";

  return {
    segmentId: agent.id,
    segmentName: agent.name,
    baseFitScore: baseResult.overallFitScore,
    scenarioFitScore: scenarioResult.overallFitScore,
    scoreDelta: Math.round((scenarioResult.overallFitScore - baseResult.overallFitScore) * 10) / 10,
    baseCategory: baseResult.fitCategory,
    scenarioCategory: scenarioResult.fitCategory,
    baseConfidence: baseResult.confidenceScore,
    scenarioConfidence: scenarioResult.confidenceScore,
    confidenceDelta: Math.round((scenarioResult.confidenceScore - baseResult.confidenceScore) * 10) / 10,
    baseOutreachPriority: baseResult.outreachPriority,
    scenarioOutreachPriority: scenarioResult.outreachPriority,
    priorityChanged: baseResult.outreachPriority !== scenarioResult.outreachPriority,
    objectionsAdded,
    objectionsResolved,
    objectionsAddedCount: objectionsAdded.length,
    objectionsResolvedCount: objectionsResolved.length,
    dimensionDeltas,
    evidenceGaps: scenarioResult.evidenceGaps.map((g) => g.description),
    eligibilityChanged: baseEligible !== scenarioEligible,
    baseEligible,
    scenarioEligible,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5D: Term Impact Analysis — which terms changed and what was the effect
// ─────────────────────────────────────────────────────────────────────────────

export interface TermImpact {
  field: string;
  label: string;
  baseValue: unknown;
  proposedValue: unknown;
  segmentsHelped: string[];
  segmentsHarmed: string[];
  objectionsResolved: string[];
  newObjections: string[];
  avgFitDelta: number;
  eligibilityChanges: string[];
  commercialTradeOff: string;
  governanceConsequence: string;
  evidenceRequired: string[];
}

const TERM_LABELS: Record<string, string> = {
  managementFeePct: "Management Fee",
  carryPct: "Carried Interest",
  hurdleRatePct: "Preferred Return",
  gpCommitmentPct: "GP Commitment",
  targetFundSizeM: "Target Fund Size",
  shariaCompliant: "Sharia Compliance",
  esgFramework: "ESG Framework",
  coInvestmentRights: "Co-Investment Rights",
  domicile: "Fund Domicile",
  currency: "Currency",
  fundTermYrs: "Fund Term",
  targetReturnPct: "Target Return",
  reportingFrequency: "Reporting Frequency",
  minLpCommitmentM: "Minimum LP Commitment",
};

function getCommercialTradeOff(field: string, baseVal: unknown, proposedVal: unknown): string {
  if (field === "managementFeePct") {
    const diff = (proposedVal as number) - (baseVal as number);
    if (diff < 0) return `Lower management fee reduces GP operating revenue by ~${Math.abs(diff * 100).toFixed(0)}bps on committed capital. Ensure fund economics remain viable at target size.`;
    return `Higher management fee increases GP operating revenue but may face LP pushback above market norms.`;
  }
  if (field === "gpCommitmentPct") {
    const diff = (proposedVal as number) - (baseVal as number);
    if (diff > 0) return `Increased GP commitment of ${proposedVal}% requires additional GP capital. Demonstrates alignment but creates liquidity burden on the GP.`;
    return `Reduced GP commitment may signal lower alignment to institutional LPs.`;
  }
  if (field === "shariaCompliant") {
    if (proposedVal === true) return "Sharia compliance requires SSB appointment, AAOIFI-compliant instruments, and ongoing governance cost. Opens GCC Islamic capital markets.";
    return "Removing Sharia compliance closes Islamic allocator segment.";
  }
  if (field === "fundTermYrs") {
    const diff = (proposedVal as number) - (baseVal as number);
    if (diff > 0) return `Longer fund term (${proposedVal} years) increases LP illiquidity exposure. May require enhanced liquidity provisions or secondary market access rights.`;
    return `Shorter fund term (${proposedVal} years) reduces deployment flexibility. Ensure investment period is sufficient.`;
  }
  if (field === "carryPct") {
    return `Carry of ${proposedVal}% is the GP's primary performance incentive. Changes above market norms (20%) face resistance from institutional LPs.`;
  }
  return `Review implications of changing ${TERM_LABELS[field] ?? field} with legal and placement advisers.`;
}

function getGovernanceConsequence(field: string, proposedVal: unknown): string {
  if (field === "shariaCompliant" && proposedVal === true) return "Requires Sharia Supervisory Board (SSB) appointment, AAOIFI compliance, and regular Sharia audit. Adds governance layer and cost.";
  if (field === "esgFramework") return "ESG framework selection affects SFDR classification, reporting obligations, and eligible investment universe.";
  if (field === "domicile") return "Domicile change affects regulatory jurisdiction, LP eligibility, tax treatment, and AIFMD passport availability.";
  if (field === "coInvestmentRights") return "Co-investment rights require clear LPAC governance, conflict-of-interest policy, and pro-rata allocation procedures.";
  return "";
}

function getEvidenceRequired(field: string, proposedVal: unknown): string[] {
  const evidence: string[] = [];
  if (field === "shariaCompliant" && proposedVal === true) evidence.push("SSB appointment letter", "AAOIFI compliance certificate", "Sharia audit framework");
  if (field === "esgFramework") evidence.push("ESG policy document", "SFDR disclosure template", "ESG due diligence questionnaire");
  if (field === "gpCommitmentPct") evidence.push(`GP commitment evidence: ${proposedVal}% of fund size`);
  if (field === "domicile") evidence.push("Regulatory approval in new domicile", "Updated LPA reflecting new jurisdiction");
  return evidence;
}

export function analyseTermImpacts(
  base: FundProfile,
  proposed: FundProfile,
  changedFields: ProposedTerms,
  segmentResults: SegmentScenarioResult[],
): TermImpact[] {
  const impacts: TermImpact[] = [];
  for (const [field, proposedVal] of Object.entries(changedFields)) {
    if (proposedVal === undefined || proposedVal === null) continue;
    const baseVal = (base as unknown as Record<string, unknown>)[field];
    const helped = segmentResults.filter((r) => r.scoreDelta > 2).map((r) => r.segmentName);
    const harmed = segmentResults.filter((r) => r.scoreDelta < -2).map((r) => r.segmentName);
    const allResolved = Array.from(new Set<string>(segmentResults.flatMap((r) => r.objectionsResolved.map((o) => o.category as string))));
    const allAdded = Array.from(new Set<string>(segmentResults.flatMap((r) => r.objectionsAdded.map((o) => o.category as string))));
    const avgDelta = segmentResults.length > 0
      ? Math.round(segmentResults.reduce((s, r) => s + r.scoreDelta, 0) / segmentResults.length * 10) / 10
      : 0;
    const eligChanges = segmentResults
      .filter((r) => r.eligibilityChanged)
      .map((r) => r.scenarioEligible ? `${r.segmentName}: now eligible` : `${r.segmentName}: now ineligible`);

    impacts.push({
      field,
      label: TERM_LABELS[field] ?? field,
      baseValue: baseVal,
      proposedValue: proposedVal,
      segmentsHelped: helped,
      segmentsHarmed: harmed,
      objectionsResolved: allResolved,
      newObjections: allAdded,
      avgFitDelta: avgDelta,
      eligibilityChanges: eligChanges,
      commercialTradeOff: getCommercialTradeOff(field, baseVal, proposedVal),
      governanceConsequence: getGovernanceConsequence(field, proposedVal),
      evidenceRequired: getEvidenceRequired(field, proposedVal),
    });
  }
  return impacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5E: Fundraising Objectives — 10 objectives with transparent weights
// ─────────────────────────────────────────────────────────────────────────────

export type FundraisingObjective =
  | "fastest_first_close"
  | "largest_tickets"
  | "strongest_reference"
  | "highest_engagement_probability"
  | "islamic_capital_priority"
  | "geographic_diversification"
  | "lowest_diligence_complexity"
  | "emerging_manager_friendly"
  | "best_reup_potential"
  | "balanced";

export interface ObjectiveWeights {
  fitScore: number;
  ticketCapacity: number;
  decisionSpeed: number;
  relationshipAccessibility: number;
  diligenceComplexity: number;
  referenceValue: number;
  coInvestmentPotential: number;
  reupPotential: number;
  geographicRelevance: number;
  shariaRelevance: number;
  evidenceBurden: number;
  expectedObjections: number;
}

// All weights documented and transparent — no hidden scoring
export const OBJECTIVE_WEIGHT_PROFILES: Record<FundraisingObjective, ObjectiveWeights> = {
  fastest_first_close: {
    fitScore: 0.15, ticketCapacity: 0.05, decisionSpeed: 0.30, relationshipAccessibility: 0.20,
    diligenceComplexity: 0.15, referenceValue: 0.02, coInvestmentPotential: 0.02,
    reupPotential: 0.02, geographicRelevance: 0.03, shariaRelevance: 0.01,
    evidenceBurden: 0.03, expectedObjections: 0.02,
  },
  largest_tickets: {
    fitScore: 0.20, ticketCapacity: 0.35, decisionSpeed: 0.05, relationshipAccessibility: 0.05,
    diligenceComplexity: 0.05, referenceValue: 0.05, coInvestmentPotential: 0.05,
    reupPotential: 0.05, geographicRelevance: 0.05, shariaRelevance: 0.02,
    evidenceBurden: 0.03, expectedObjections: 0.05,
  },
  strongest_reference: {
    fitScore: 0.15, ticketCapacity: 0.05, decisionSpeed: 0.05, relationshipAccessibility: 0.10,
    diligenceComplexity: 0.05, referenceValue: 0.35, coInvestmentPotential: 0.05,
    reupPotential: 0.05, geographicRelevance: 0.05, shariaRelevance: 0.02,
    evidenceBurden: 0.03, expectedObjections: 0.05,
  },
  highest_engagement_probability: {
    fitScore: 0.30, ticketCapacity: 0.10, decisionSpeed: 0.15, relationshipAccessibility: 0.15,
    diligenceComplexity: 0.10, referenceValue: 0.05, coInvestmentPotential: 0.03,
    reupPotential: 0.03, geographicRelevance: 0.03, shariaRelevance: 0.01,
    evidenceBurden: 0.03, expectedObjections: 0.02,
  },
  islamic_capital_priority: {
    fitScore: 0.20, ticketCapacity: 0.10, decisionSpeed: 0.05, relationshipAccessibility: 0.10,
    diligenceComplexity: 0.05, referenceValue: 0.05, coInvestmentPotential: 0.05,
    reupPotential: 0.05, geographicRelevance: 0.05, shariaRelevance: 0.20,
    evidenceBurden: 0.05, expectedObjections: 0.05,
  },
  geographic_diversification: {
    fitScore: 0.20, ticketCapacity: 0.10, decisionSpeed: 0.05, relationshipAccessibility: 0.05,
    diligenceComplexity: 0.05, referenceValue: 0.05, coInvestmentPotential: 0.05,
    reupPotential: 0.05, geographicRelevance: 0.25, shariaRelevance: 0.05,
    evidenceBurden: 0.03, expectedObjections: 0.02,
  },
  lowest_diligence_complexity: {
    fitScore: 0.20, ticketCapacity: 0.10, decisionSpeed: 0.20, relationshipAccessibility: 0.10,
    diligenceComplexity: 0.20, referenceValue: 0.03, coInvestmentPotential: 0.02,
    reupPotential: 0.03, geographicRelevance: 0.03, shariaRelevance: 0.02,
    evidenceBurden: 0.05, expectedObjections: 0.02,
  },
  emerging_manager_friendly: {
    fitScore: 0.20, ticketCapacity: 0.05, decisionSpeed: 0.15, relationshipAccessibility: 0.20,
    diligenceComplexity: 0.10, referenceValue: 0.05, coInvestmentPotential: 0.05,
    reupPotential: 0.05, geographicRelevance: 0.03, shariaRelevance: 0.02,
    evidenceBurden: 0.05, expectedObjections: 0.05,
  },
  best_reup_potential: {
    fitScore: 0.20, ticketCapacity: 0.10, decisionSpeed: 0.05, relationshipAccessibility: 0.10,
    diligenceComplexity: 0.05, referenceValue: 0.10, coInvestmentPotential: 0.05,
    reupPotential: 0.25, geographicRelevance: 0.03, shariaRelevance: 0.02,
    evidenceBurden: 0.03, expectedObjections: 0.02,
  },
  balanced: {
    fitScore: 0.20, ticketCapacity: 0.10, decisionSpeed: 0.10, relationshipAccessibility: 0.10,
    diligenceComplexity: 0.10, referenceValue: 0.10, coInvestmentPotential: 0.05,
    reupPotential: 0.05, geographicRelevance: 0.05, shariaRelevance: 0.05,
    evidenceBurden: 0.05, expectedObjections: 0.05,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// WP5F: Fundraising Sequence Engine — 6 templates
// ─────────────────────────────────────────────────────────────────────────────

export type SequenceTemplate =
  | "existing_relationships_first"
  | "fastest_decision_makers_first"
  | "largest_tickets_first"
  | "strategic_reference_first"
  | "islamic_capital_first"
  | "diversified_global";

export interface SequencedSegment {
  wave: number;
  segmentId: string;
  segmentName: string;
  fitScore: number;
  fitCategory: string;
  outreachPriority: string;
  objectiveScore: number;
  rationale: string;
  evidenceRequired: string[];
  anchorValue: string;
  estimatedDecisionMonths: number;
}

export interface FundraisingSequence {
  template: SequenceTemplate;
  objective: FundraisingObjective;
  disclaimer: string;
  waves: Array<{
    wave: number;
    label: string;
    segments: SequencedSegment[];
    evidenceGates: string[];
    anchorNote: string;
  }>;
  avoidUntilTermsImprove: Array<{ segmentId: string; segmentName: string; reason: string }>;
}

// Agent attributes used for sequencing (deterministic, from LP_AGENT_BANK)
function getAgentSequencingAttributes(agent: LPAgent): {
  decisionSpeedScore: number;
  ticketCapacityScore: number;
  diligenceComplexityScore: number;
  referenceValueScore: number;
  reupPotentialScore: number;
  shariaScore: number;
  geographicScore: Record<string, number>;
} {
  const decisionSpeedScore = agent.diligenceDurationMonths <= 3 ? 90 :
    agent.diligenceDurationMonths <= 6 ? 70 :
    agent.diligenceDurationMonths <= 9 ? 50 : 30;

  const ticketCapacityScore = agent.ticketSizeMaxM >= 100 ? 90 :
    agent.ticketSizeMaxM >= 50 ? 70 :
    agent.ticketSizeMaxM >= 20 ? 50 : 30;

  const diligenceComplexityScore = agent.diligenceDurationMonths <= 3 ? 90 :
    agent.diligenceDurationMonths <= 6 ? 70 : 40;

  const referenceValueScore = agent.segmentType === "Sovereign Wealth Fund" ? 90 :
    agent.segmentType === "Public Pension Fund" ? 85 :
    agent.segmentType === "Corporate Pension Fund" ? 75 :
    agent.segmentType === "Insurance Company" ? 70 :
    agent.segmentType === "University Endowment" ? 65 : 50;

  const reupPotentialScore = agent.segmentType === "Sovereign Wealth Fund" ? 85 :
    agent.segmentType === "Public Pension Fund" ? 80 :
    agent.segmentType === "Corporate Pension Fund" ? 75 :
    agent.segmentType === "Fund of Funds" ? 70 : 55;

  const shariaScore = agent.shariaRequired ? 90 : 10;

  const geographicScore: Record<string, number> = {};
  for (const geo of agent.geography) {
    geographicScore[geo] = 90;
  }

  return { decisionSpeedScore, ticketCapacityScore, diligenceComplexityScore, referenceValueScore, reupPotentialScore, shariaScore, geographicScore };
}

export function computeObjectiveScore(
  fitResult: FitResultV2,
  agent: LPAgent,
  weights: ObjectiveWeights,
  fund: FundProfile,
): number {
  const attrs = getAgentSequencingAttributes(agent);
  const objections = generateObjections(fund, agent);
  const objectionPenalty = Math.max(0, 100 - objections.length * 8);
  const evidenceBurdenScore = Math.max(0, 100 - fitResult.evidenceGaps.length * 15);

  const raw =
    fitResult.overallFitScore * weights.fitScore +
    attrs.ticketCapacityScore * weights.ticketCapacity +
    attrs.decisionSpeedScore * weights.decisionSpeed +
    70 * weights.relationshipAccessibility + // neutral default
    attrs.diligenceComplexityScore * weights.diligenceComplexity +
    attrs.referenceValueScore * weights.referenceValue +
    (agent.coInvestmentPreference === "Preferred" ? 80 : agent.coInvestmentPreference === "Required" ? 90 : 40) * weights.coInvestmentPotential +
    attrs.reupPotentialScore * weights.reupPotential +
    70 * weights.geographicRelevance + // neutral default
    attrs.shariaScore * weights.shariaRelevance +
    evidenceBurdenScore * weights.evidenceBurden +
    objectionPenalty * weights.expectedObjections;

  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
}

export function generateFundraisingSequence(
  fund: FundProfile,
  fitResults: Map<string, FitResultV2>,
  objective: FundraisingObjective,
  template: SequenceTemplate,
): FundraisingSequence {
  const weights = OBJECTIVE_WEIGHT_PROFILES[objective];

  const scored: Array<{ agent: LPAgent; fitResult: FitResultV2; objectiveScore: number }> = [];
  for (const agent of LP_AGENT_BANK) {
    const fitResult = fitResults.get(agent.id);
    if (!fitResult) continue;
    const objectiveScore = computeObjectiveScore(fitResult, agent, weights, fund);
    scored.push({ agent, fitResult, objectiveScore });
  }

  // Sort by objective score descending
  scored.sort((a, b) => b.objectiveScore - a.objectiveScore);

  const avoid: Array<{ segmentId: string; segmentName: string; reason: string }> = [];
  const wave1: typeof scored = [];
  const wave2: typeof scored = [];
  const wave3: typeof scored = [];

  for (const item of scored) {
    const { agent, fitResult } = item;
    if (fitResult.fitCategory === "Likely Ineligible") {
      avoid.push({ segmentId: agent.id, segmentName: agent.name, reason: `Fit score ${fitResult.overallFitScore}/100 — ${fitResult.disqualifyingIssues[0] ?? "does not meet minimum criteria"}` });
    } else if (item.objectiveScore >= 65) {
      wave1.push(item);
    } else if (item.objectiveScore >= 45) {
      wave2.push(item);
    } else {
      wave3.push(item);
    }
  }

  function toSequenced(items: typeof scored, wave: number): SequencedSegment[] {
    return items.map(({ agent, fitResult, objectiveScore }) => ({
      wave,
      segmentId: agent.id,
      segmentName: agent.name,
      fitScore: fitResult.overallFitScore,
      fitCategory: fitResult.fitCategory,
      outreachPriority: fitResult.outreachPriority,
      objectiveScore,
      rationale: `Fit: ${fitResult.overallFitScore}/100 (${fitResult.fitCategory}). Objective score: ${objectiveScore}/100.`,
      evidenceRequired: fitResult.evidenceGaps.filter((g) => g.priority === "Critical" || g.priority === "High").map((g) => g.description),
      anchorValue: agent.segmentType === "Sovereign Wealth Fund" || agent.segmentType === "Public Pension Fund" ? "High reference value for subsequent waves" : "",
      estimatedDecisionMonths: agent.diligenceDurationMonths,
    }));
  }

  const waves = [];
  if (wave1.length > 0) waves.push({ wave: 1, label: "Priority Outreach", segments: toSequenced(wave1, 1), evidenceGates: Array.from(new Set<string>(wave1.flatMap((i) => i.fitResult.evidenceGaps.filter((g: { priority: string; description: string }) => g.priority === "Critical").map((g: { priority: string; description: string }) => g.description)))), anchorNote: wave1[0] ? `Lead with ${wave1[0].agent.name} as potential anchor investor` : "" });
  if (wave2.length > 0) waves.push({ wave: 2, label: "Secondary Outreach", segments: toSequenced(wave2, 2), evidenceGates: [], anchorNote: "Begin after Wave 1 commitments secured" });
  if (wave3.length > 0) waves.push({ wave: 3, label: "Opportunistic Outreach", segments: toSequenced(wave3, 3), evidenceGates: [], anchorNote: "Approach after first close or with improved terms" });

  return {
    template,
    objective,
    disclaimer: "SYNTHETIC SIMULATION — Fundraising sequences are evidence-based estimates derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour or commitment timelines.",
    waves,
    avoidUntilTermsImprove: avoid,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5G: Market Stress Scenarios — 12 configurable conditions
// ─────────────────────────────────────────────────────────────────────────────

export type MarketStressCondition =
  | "higher_interest_rates"
  | "lower_public_market_valuations"
  | "reduced_distributions"
  | "slower_exits"
  | "increased_lp_liquidity_pressure"
  | "stronger_demand_for_yield"
  | "higher_currency_volatility"
  | "increased_coinvestment_preference"
  | "lower_tolerance_first_time_managers"
  | "increased_sharia_allocation"
  | "increased_esg_scrutiny"
  | "longer_ic_cycles";

export interface MarketStressEffect {
  condition: MarketStressCondition;
  label: string;
  description: string;
  affectedSegments: string[];
  fitAdjustments: Record<string, number>; // segmentId -> score adjustment
  newObjectionCategories: string[];
  decisionTimingAdjustment: string;
  sequenceImpact: string;
  recommendedResponse: string;
  disclaimer: string;
}

export const MARKET_STRESS_DEFINITIONS: Record<MarketStressCondition, Omit<MarketStressEffect, "condition">> = {
  higher_interest_rates: {
    label: "Higher Interest Rates",
    description: "Risk-free rates elevated. LPs reassess private market return premiums. Hurdle rate expectations rise.",
    affectedSegments: ["ppf-001", "cpf-001", "ins-001", "fof-001"],
    fitAdjustments: { "ppf-001": -8, "cpf-001": -8, "ins-001": -10, "fof-001": -5 },
    newObjectionCategories: ["return-insufficient", "fees-too-high"],
    decisionTimingAdjustment: "IC cycles extend 1–2 months as LPs reassess return premium vs risk-free alternatives",
    sequenceImpact: "Deprioritise return-sensitive segments. Lead with strategic reference investors less sensitive to rate environment.",
    recommendedResponse: "Stress-test fund return projections against elevated hurdle rates. Consider enhanced preferred return to maintain LP economics.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  lower_public_market_valuations: {
    label: "Lower Public Market Valuations",
    description: "Public equity drawdown. Denominator effect reduces LP allocation capacity. Portfolio rebalancing required.",
    affectedSegments: ["ppf-001", "cpf-001", "end-001", "fof-001"],
    fitAdjustments: { "ppf-001": -12, "cpf-001": -10, "end-001": -8, "fof-001": -6 },
    newObjectionCategories: ["allocation-capacity-exceeded"],
    decisionTimingAdjustment: "Allocation decisions delayed 3–6 months pending portfolio rebalancing",
    sequenceImpact: "Sovereign wealth funds and family offices less affected by denominator effect. Reprioritise SWF and SFO segments.",
    recommendedResponse: "Target allocators with flexible mandate and lower denominator sensitivity. SWFs and family offices preferred.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  reduced_distributions: {
    label: "Reduced Private Market Distributions",
    description: "Exit activity slows. LPs receive fewer distributions. Recycling capacity constrained.",
    affectedSegments: ["ppf-001", "cpf-001", "fof-001", "end-001"],
    fitAdjustments: { "ppf-001": -6, "cpf-001": -6, "fof-001": -8, "end-001": -5 },
    newObjectionCategories: ["liquidity-concern"],
    decisionTimingAdjustment: "New commitments deferred until existing portfolio generates distributions",
    sequenceImpact: "Prioritise LPs with lower existing PE exposure and higher cash allocation.",
    recommendedResponse: "Highlight fund's distribution strategy and expected exit timeline. Consider co-investment rights to improve LP liquidity optionality.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  slower_exits: {
    label: "Slower Exits",
    description: "M&A and IPO markets subdued. Portfolio company exits delayed. Fund extension risk increases.",
    affectedSegments: ["ppf-001", "cpf-001", "fof-001"],
    fitAdjustments: { "ppf-001": -5, "cpf-001": -5, "fof-001": -7 },
    newObjectionCategories: ["liquidity-concern", "track-record-insufficient"],
    decisionTimingAdjustment: "LPs scrutinise exit track record more carefully. Diligence extends 1 month.",
    sequenceImpact: "Emphasise GP's ability to manage through cycles. Prioritise LPs with longer investment horizons.",
    recommendedResponse: "Document GP's portfolio company operational improvement capability. Provide exit track record across market cycles.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  increased_lp_liquidity_pressure: {
    label: "Increased LP Liquidity Pressure",
    description: "LPs face increased liquidity demands from beneficiaries or policy changes. Illiquid commitments scrutinised.",
    affectedSegments: ["ppf-001", "cpf-001", "ins-001"],
    fitAdjustments: { "ppf-001": -10, "cpf-001": -10, "ins-001": -12 },
    newObjectionCategories: ["liquidity-concern"],
    decisionTimingAdjustment: "Liquidity stress tests added to IC process. Approval timelines extend 2 months.",
    sequenceImpact: "Prioritise SWFs and family offices with lower liquidity obligations. Offer secondary market access provisions.",
    recommendedResponse: "Offer enhanced liquidity provisions including secondary market facilitation and co-investment rights.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  stronger_demand_for_yield: {
    label: "Stronger Demand for Yield",
    description: "LPs increase allocation to income-generating strategies. Yield-focused mandates expand.",
    affectedSegments: ["ins-001", "ppf-001", "cpf-001"],
    fitAdjustments: { "ins-001": 8, "ppf-001": 5, "cpf-001": 5 },
    newObjectionCategories: [],
    decisionTimingAdjustment: "Faster decisions for income-generating strategies",
    sequenceImpact: "Prioritise insurance and pension segments if fund has yield component.",
    recommendedResponse: "Highlight income yield component of strategy. Quantify expected yield distribution schedule.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  higher_currency_volatility: {
    label: "Higher Currency Volatility",
    description: "FX volatility increases hedging costs. Non-USD investors face currency risk on USD-denominated funds.",
    affectedSegments: ["swf-001", "ppf-001", "iia-001"],
    fitAdjustments: { "swf-001": -5, "ppf-001": -4, "iia-001": -6 },
    newObjectionCategories: ["currency-mismatch"],
    decisionTimingAdjustment: "Currency hedging strategy review adds 2–4 weeks to diligence",
    sequenceImpact: "Prioritise USD-base currency allocators. Offer currency hedging provisions for non-USD LPs.",
    recommendedResponse: "Provide currency hedging options or multi-currency share classes where operationally feasible.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  increased_coinvestment_preference: {
    label: "Increased Co-Investment Preference",
    description: "LPs increasingly require co-investment rights as condition of commitment. Direct deal access valued.",
    affectedSegments: ["swf-001", "sfo-001", "mfo-001"],
    fitAdjustments: { "swf-001": 8, "sfo-001": 10, "mfo-001": 8 },
    newObjectionCategories: [],
    decisionTimingAdjustment: "Co-investment framework negotiation may extend closing timeline",
    sequenceImpact: "Prioritise segments with co-investment preference. Lead with SWFs and family offices.",
    recommendedResponse: "Formalise co-investment programme with clear allocation policy and LPAC governance.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  lower_tolerance_first_time_managers: {
    label: "Lower Tolerance for First-Time Managers",
    description: "Risk-off environment. LPs concentrate allocations with established managers. Emerging manager programmes paused.",
    affectedSegments: ["ppf-001", "cpf-001", "end-001", "fof-001"],
    fitAdjustments: { "ppf-001": -10, "cpf-001": -10, "end-001": -8, "fof-001": -12 },
    newObjectionCategories: ["track-record-insufficient"],
    decisionTimingAdjustment: "First-time manager diligence extends 3–4 months. Additional reference checks required.",
    sequenceImpact: "Prioritise LPs with explicit emerging manager programmes. SFOs and MFOs more flexible.",
    recommendedResponse: "Strengthen GP pedigree evidence. Secure anchor commitment from established LP to de-risk for others.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  increased_sharia_allocation: {
    label: "Increased Sharia-Compliant Allocation",
    description: "GCC sovereign and institutional capital increasingly directed to Sharia-compliant vehicles.",
    affectedSegments: ["iia-001", "swf-001"],
    fitAdjustments: { "iia-001": 12, "swf-001": 6 },
    newObjectionCategories: [],
    decisionTimingAdjustment: "Sharia-compliant funds benefit from faster GCC IC approvals",
    sequenceImpact: "Prioritise Islamic allocator segment. Sharia compliance becomes competitive differentiator.",
    recommendedResponse: "If fund is Sharia-compliant, lead with Islamic allocator segment. If not, assess cost-benefit of Sharia structuring.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  increased_esg_scrutiny: {
    label: "Increased ESG Scrutiny",
    description: "Regulatory and beneficiary pressure increases ESG requirements. SFDR compliance becomes table stakes.",
    affectedSegments: ["ppf-001", "cpf-001", "end-001"],
    fitAdjustments: { "ppf-001": -6, "cpf-001": -5, "end-001": -8 },
    newObjectionCategories: ["esg-insufficient"],
    decisionTimingAdjustment: "ESG due diligence adds 3–6 weeks. SFDR disclosure review required.",
    sequenceImpact: "Prioritise ESG-aligned segments only if fund has credible ESG framework. Avoid ESG-mandatory segments without documentation.",
    recommendedResponse: "Prepare comprehensive ESG policy, SFDR disclosure, and impact measurement framework before approaching ESG-mandatory LPs.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
  longer_ic_cycles: {
    label: "Longer Investment Committee Cycles",
    description: "Governance tightening. IC meetings less frequent. Approval processes extended across all institution types.",
    affectedSegments: ["swf-001", "ppf-001", "cpf-001", "ins-001"],
    fitAdjustments: { "swf-001": 0, "ppf-001": 0, "cpf-001": 0, "ins-001": 0 },
    newObjectionCategories: [],
    decisionTimingAdjustment: "Add 2–3 months to all IC-dependent closing timelines",
    sequenceImpact: "Start outreach earlier. Prioritise family offices and SFOs with faster decision authority.",
    recommendedResponse: "Begin outreach 6 months earlier than planned. Prioritise segments with streamlined IC processes for first close.",
    disclaimer: "SCENARIO ASSUMPTION — Not a market forecast.",
  },
};

export function applyMarketStress(
  baseResults: Map<string, FitResultV2>,
  conditions: MarketStressCondition[],
): Map<string, { adjustedScore: number; adjustments: Array<{ condition: string; delta: number }> }> {
  const output = new Map<string, { adjustedScore: number; adjustments: Array<{ condition: string; delta: number }> }>();
  for (const [segmentId, result] of Array.from(baseResults.entries())) {
    let score = result.overallFitScore;
    const adjustments: Array<{ condition: string; delta: number }> = [];
    for (const condition of conditions) {
      const def = MARKET_STRESS_DEFINITIONS[condition];
      const delta = def.fitAdjustments[segmentId] ?? 0;
      if (delta !== 0) {
        score += delta;
        adjustments.push({ condition: def.label, delta });
      }
    }
    output.set(segmentId, { adjustedScore: Math.round(Math.min(100, Math.max(0, score)) * 10) / 10, adjustments });
  }
  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5I: Sensitivity Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface SensitivityPoint {
  value: number;
  segmentResults: Array<{
    segmentId: string;
    segmentName: string;
    fitScore: number;
    fitCategory: string;
    objectionCount: number;
  }>;
  avgFitScore: number;
  strongFitCount: number;
  eligibleCount: number;
}

export interface SensitivityAnalysis {
  field: string;
  label: string;
  minValue: number;
  maxValue: number;
  stepSize: number;
  points: SensitivityPoint[];
  inflectionPoints: Array<{ value: number; description: string }>;
  disclaimer: string;
}

export function runSensitivityAnalysis(
  base: FundProfile,
  field: keyof ProposedTerms,
  minValue: number,
  maxValue: number,
  steps: number,
): SensitivityAnalysis {
  const stepSize = (maxValue - minValue) / Math.max(steps - 1, 1);
  const points: SensitivityPoint[] = [];

  for (let i = 0; i < steps; i++) {
    const value = Math.round((minValue + i * stepSize) * 100) / 100;
    const proposed = applyProposedTerms(base, { [field]: value } as ProposedTerms);
    const segmentResults = LP_AGENT_BANK.map((agent) => {
      const result = computeAllocatorFit(proposed, agent);
      const objections = generateObjections(proposed, agent);
      return {
        segmentId: agent.id,
        segmentName: agent.name,
        fitScore: result.overallFitScore,
        fitCategory: result.fitCategory,
        objectionCount: objections.length,
      };
    });
    const avgFitScore = Math.round(segmentResults.reduce((s, r) => s + r.fitScore, 0) / segmentResults.length * 10) / 10;
    const strongFitCount = segmentResults.filter((r) => r.fitScore >= 70).length;
    const eligibleCount = segmentResults.filter((r) => r.fitCategory !== "Likely Ineligible").length;
    points.push({ value, segmentResults, avgFitScore, strongFitCount, eligibleCount });
  }

  // Detect inflection points (where strong-fit count changes)
  const inflectionPoints: Array<{ value: number; description: string }> = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (curr.strongFitCount !== prev.strongFitCount) {
      inflectionPoints.push({
        value: curr.value,
        description: curr.strongFitCount > prev.strongFitCount
          ? `Strong-fit count increases from ${prev.strongFitCount} to ${curr.strongFitCount} at ${TERM_LABELS[field] ?? field} = ${curr.value}`
          : `Strong-fit count decreases from ${prev.strongFitCount} to ${curr.strongFitCount} at ${TERM_LABELS[field] ?? field} = ${curr.value}`,
      });
    }
  }

  return {
    field,
    label: TERM_LABELS[field] ?? field,
    minValue,
    maxValue,
    stepSize,
    points,
    inflectionPoints,
    disclaimer: "SYNTHETIC SIMULATION — Sensitivity analysis tests defined assumptions. Mathematically optimal values may not represent the best commercial choice. Fund-term changes have GP economic and legal consequences.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WP5J: Recommended Fund Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface FundConfigRecommendation {
  currentStrengths: string[];
  currentWeaknesses: string[];
  highImpactCurableObjections: Array<{ category: string; statement: string; recommendedResponse: string; segmentsAffected: string[] }>;
  recommendedChanges: Array<{ field: string; label: string; currentValue: unknown; suggestedValue: unknown; rationale: string; expectedImpact: string; tradeOff: string }>;
  changesNotRecommended: Array<{ field: string; label: string; reason: string }>;
  expectedSegmentImpact: Array<{ segmentId: string; segmentName: string; currentCategory: string; expectedCategory: string }>;
  economicConsequences: string[];
  governanceConsequences: string[];
  evidenceRequired: string[];
  overallConfidence: number;
  unresolvedTradeOffs: string[];
  disclaimer: string;
  sourceAttribution: {
    deterministicFindings: string[];
    ruleBasedTradeOffs: string[];
    customerAssumptions: string[];
  };
}

export function generateFundConfigRecommendation(
  fund: FundProfile,
  fitResults: Map<string, FitResultV2>,
): FundConfigRecommendation {
  const allObjections: Array<Objection & { segmentId: string; segmentName: string }> = [];
  for (const agent of LP_AGENT_BANK) {
    const objections = generateObjections(fund, agent);
    for (const o of objections) {
      allObjections.push({ ...o, segmentId: agent.id, segmentName: agent.name });
    }
  }

  // Group curable objections by category
  const curableByCategory = new Map<string, Array<Objection & { segmentId: string; segmentName: string }>>();
  for (const o of allObjections.filter((o) => o.isCurable)) {
    const existing = curableByCategory.get(o.category) ?? [];
    existing.push(o);
    curableByCategory.set(o.category, existing);
  }

  const highImpactCurable = Array.from(curableByCategory.entries())
    .filter(([, items]) => items.some((i) => i.severity === "Critical" || i.severity === "High"))
    .slice(0, 5)
    .map(([category, items]) => ({
      category,
      statement: items[0].statement,
      recommendedResponse: items[0].recommendedResponse,
      segmentsAffected: Array.from(new Set(items.map((i) => i.segmentName))),
    }));

  const avgScore = Array.from(fitResults.values()).reduce((s, r) => s + r.overallFitScore, 0) / fitResults.size;
  const strongFit = Array.from(fitResults.values()).filter((r) => r.overallFitScore >= 70);
  const weakFit = Array.from(fitResults.values()).filter((r) => r.overallFitScore < 50);

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (avgScore >= 60) strengths.push(`Average allocator fit score of ${Math.round(avgScore)}/100 across ${fitResults.size} segments`);
  if (strongFit.length > 0) strengths.push(`${strongFit.length} segment(s) in Strong Fit category`);
  if (fund.gpCommitmentPct && fund.gpCommitmentPct >= 2) strengths.push(`GP commitment of ${fund.gpCommitmentPct}% demonstrates alignment`);
  if (fund.shariaCompliant) strengths.push("Sharia-compliant structure opens Islamic capital markets");
  if (fund.trackRecordYrs && fund.trackRecordYrs >= 8) strengths.push(`${fund.trackRecordYrs}-year GP track record exceeds most institutional minimums`);

  if (avgScore < 50) weaknesses.push(`Average allocator fit score of ${Math.round(avgScore)}/100 is below institutional threshold`);
  if (weakFit.length >= 3) weaknesses.push(`${weakFit.length} segments in Weak Fit or Likely Ineligible category`);
  if (!fund.gpCommitmentPct || fund.gpCommitmentPct < 1) weaknesses.push("GP commitment below 1% — alignment concern for institutional LPs");
  if (fund.managementFeePct && fund.managementFeePct > 2) weaknesses.push(`Management fee of ${fund.managementFeePct}% above market norm for institutional mandates`);

  const overallConfidence = Math.round(Array.from(fitResults.values()).reduce((s, r) => s + r.confidenceScore, 0) / fitResults.size);

  return {
    currentStrengths: strengths,
    currentWeaknesses: weaknesses,
    highImpactCurableObjections: highImpactCurable,
    recommendedChanges: [],
    changesNotRecommended: [],
    expectedSegmentImpact: [],
    economicConsequences: ["All recommended changes should be reviewed with legal and placement advisers before implementation"],
    governanceConsequences: ["Structural changes may require LPA amendment and LP consent"],
    evidenceRequired: Array.from(new Set(Array.from(fitResults.values()).flatMap((r: FitResultV2) => r.evidenceGaps.filter((g: { priority: string; description: string }) => g.priority === "Critical").map((g: { priority: string; description: string }) => g.description)))).slice(0, 8),
    overallConfidence,
    unresolvedTradeOffs: ["Lower fees improve LP fit but reduce GP operating revenue", "Higher GP commitment improves alignment but requires GP capital"],
    disclaimer: "SYNTHETIC SIMULATION — This recommendation is derived from anonymised institutional archetypes. It does not constitute placement, legal, tax or regulatory advice. The fund manager makes the final decision.",
    sourceAttribution: {
      deterministicFindings: ["Fit scores computed by deterministic 18-dimension engine", "Objections generated by deterministic 30-category rule engine"],
      ruleBasedTradeOffs: ["Commercial trade-offs derived from documented rule-based analysis"],
      customerAssumptions: ["Fund profile data provided by the user"],
    },
  };
}
