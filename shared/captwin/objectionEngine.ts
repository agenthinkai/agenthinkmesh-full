/**
 * CapTwin Objection Engine v2
 * Version: 2.0.0
 *
 * 30-category structured objection registry.
 * Deterministic: identical inputs = identical outputs.
 * Returns severity, likelihood, curability, and recommended response.
 *
 * DISCLAIMER: Outputs are evidence-based synthetic simulations.
 * Not validated predictions of real allocator behaviour.
 */

import type { LPAgent } from "./agentBank";
import type { FundProfile } from "./fitEngine";
import { LP_OBJECTION_RULES_VERSION } from "./agentBank";

export const OBJECTION_ENGINE_VERSION = "2.0.0";

export type ObjectionCategory =
  | "track-record-limited"
  | "weak-realized-exits"
  | "excessive-unrealized"
  | "fund-size-too-large"
  | "fund-size-too-small"
  | "strategy-too-broad"
  | "strategy-drift"
  | "geography-outside-mandate"
  | "fees-too-high"
  | "carry-too-high"
  | "gp-commitment-too-low"
  | "fund-term-too-long"
  | "liquidity-concern"
  | "j-curve-concern"
  | "leverage-concern"
  | "currency-concern"
  | "team-instability"
  | "key-person-risk"
  | "governance-weakness"
  | "reporting-weakness"
  | "pipeline-credibility"
  | "valuation-discipline"
  | "esg-concern"
  | "sharia-concern"
  | "co-investment-insufficient"
  | "operational-infrastructure"
  | "differentiation-unclear"
  | "deployment-pace-risk"
  | "domicile-concern"
  | "tax-complexity";

export type ObjectionSeverity = "Low" | "Moderate" | "High" | "Critical";
export type ObjectionLikelihood = "Low" | "Moderate" | "High" | "Very High";

export interface Objection {
  category: ObjectionCategory;
  statement: string;
  allocatorSegment: string;
  trigger: string;
  severity: ObjectionSeverity;
  likelihood: ObjectionLikelihood;
  supportingFundData: string;
  missingEvidence: string;
  isCurable: boolean;
  recommendedResponse: string;
  suggestedTermAdjustment: string | null;
  suggestedPositioningAdjustment: string | null;
  confidenceLevel: string;
  sourceType: "Deterministic Rule";
  engineVersion: string;
  rulesVersion: string;
}

// ── Main objection generation function ───────────────────────────────────────

export function generateObjections(
  fund: FundProfile,
  agent: LPAgent
): Objection[] {
  const objections: Objection[] = [];
  const seg = agent.segmentType;

  // ── 1. Track record too limited ─────────────────────────────────────────────
  if (fund.trackRecordYrs < agent.trackRecordRequiredYrs) {
    const shortfall = agent.trackRecordRequiredYrs - fund.trackRecordYrs;
    objections.push({
      category: "track-record-limited",
      statement: `Track record of ${fund.trackRecordYrs} years is below the ${agent.trackRecordRequiredYrs}-year minimum required by this allocator type.`,
      allocatorSegment: seg,
      trigger: `trackRecordYrs (${fund.trackRecordYrs}) < required (${agent.trackRecordRequiredYrs})`,
      severity: shortfall >= 4 ? "Critical" : shortfall >= 2 ? "High" : "Moderate",
      likelihood: shortfall >= 4 ? "Very High" : shortfall >= 2 ? "High" : "Moderate",
      supportingFundData: `Fund track record: ${fund.trackRecordYrs} years`,
      missingEvidence: "Audited track record for prior funds, realized exit documentation",
      isCurable: false,
      recommendedResponse: "Provide full audited track record, reference LPs from prior funds, and emphasize realized exits.",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: "Lead with realized returns and exits rather than fund vintage.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 2. Weak realized exits ──────────────────────────────────────────────────
  if (fund.realizedExitCount != null && fund.realizedExitCount < 3) {
    objections.push({
      category: "weak-realized-exits",
      statement: `Only ${fund.realizedExitCount} realized exit(s) documented. Institutional allocators require evidence of realized returns.`,
      allocatorSegment: seg,
      trigger: `realizedExitCount (${fund.realizedExitCount}) < 3`,
      severity: fund.realizedExitCount === 0 ? "Critical" : "High",
      likelihood: fund.realizedExitCount === 0 ? "Very High" : "High",
      supportingFundData: `Realized exits: ${fund.realizedExitCount}`,
      missingEvidence: "Exit documentation, realized DPI, exit multiples",
      isCurable: false,
      recommendedResponse: "Document all realized exits with multiples and IRR. Provide audited DPI.",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: "If exits are pending, provide timeline and expected realization schedule.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 3. Excessive unrealized value ───────────────────────────────────────────
  if (fund.unrealizedPct != null && fund.unrealizedPct > 70) {
    objections.push({
      category: "excessive-unrealized",
      statement: `${fund.unrealizedPct}% of portfolio value is unrealized. Allocators require evidence of realized returns.`,
      allocatorSegment: seg,
      trigger: `unrealizedPct (${fund.unrealizedPct}) > 70`,
      severity: fund.unrealizedPct > 85 ? "Critical" : "High",
      likelihood: "High",
      supportingFundData: `Unrealized value: ${fund.unrealizedPct}%`,
      missingEvidence: "Realized exit documentation, audited DPI",
      isCurable: false,
      recommendedResponse: "Provide realization timeline and expected exit schedule. Highlight any near-term exits.",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: "Frame unrealized value as near-term realization opportunity.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 4. Fund size too large ──────────────────────────────────────────────────
  if (fund.targetFundSizeM > agent.fundSizeMaxM) {
    objections.push({
      category: "fund-size-too-large",
      statement: `Target fund size of ${fund.targetFundSizeM}M exceeds this allocator's preferred maximum of ${agent.fundSizeMaxM}M.`,
      allocatorSegment: seg,
      trigger: `targetFundSizeM (${fund.targetFundSizeM}) > fundSizeMaxM (${agent.fundSizeMaxM})`,
      severity: "Moderate",
      likelihood: "High",
      supportingFundData: `Target fund size: ${fund.targetFundSizeM}M`,
      missingEvidence: "None — fund size is a fixed parameter",
      isCurable: true,
      recommendedResponse: "Consider whether a smaller fund size or a separate co-investment vehicle could accommodate this allocator.",
      suggestedTermAdjustment: `Consider reducing target fund size or offering a dedicated co-investment sleeve`,
      suggestedPositioningAdjustment: null,
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 5. Fund size too small ──────────────────────────────────────────────────
  if (fund.targetFundSizeM < agent.fundSizeMinM) {
    objections.push({
      category: "fund-size-too-small",
      statement: `Target fund size of ${fund.targetFundSizeM}M is below this allocator's minimum preferred size of ${agent.fundSizeMinM}M.`,
      allocatorSegment: seg,
      trigger: `targetFundSizeM (${fund.targetFundSizeM}) < fundSizeMinM (${agent.fundSizeMinM})`,
      severity: "High",
      likelihood: "Very High",
      supportingFundData: `Target fund size: ${fund.targetFundSizeM}M`,
      missingEvidence: "None — fund size is a fixed parameter",
      isCurable: true,
      recommendedResponse: "Consider whether fund size can be increased, or target allocators with smaller fund size preferences.",
      suggestedTermAdjustment: "Consider increasing target fund size if market conditions support it",
      suggestedPositioningAdjustment: null,
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 6. Geography outside mandate ────────────────────────────────────────────
  if (fund.geography && !agent.geography.toLowerCase().includes("global")) {
    const agentGeos = agent.geography.toLowerCase().split(",").map((g) => g.trim());
    const fundGeos = fund.geography.toLowerCase().split(",").map((g) => g.trim());
    const overlap = agentGeos.some((ag) => fundGeos.some((fg) => ag.includes(fg) || fg.includes(ag)));
    if (!overlap) {
      objections.push({
        category: "geography-outside-mandate",
        statement: `Fund geography "${fund.geography}" is outside this allocator's mandate focus: "${agent.geography}".`,
        allocatorSegment: seg,
        trigger: `geography mismatch: fund "${fund.geography}" vs allocator "${agent.geography}"`,
        severity: "High",
        likelihood: "Very High",
        supportingFundData: `Fund geography: ${fund.geography}`,
        missingEvidence: "None — geography is a fixed fund parameter",
        isCurable: false,
        recommendedResponse: "Target allocators with matching geographic mandate. Consider whether fund strategy can accommodate allocator geography.",
        suggestedTermAdjustment: null,
        suggestedPositioningAdjustment: "Emphasise any geographic overlap or diversification benefit.",
        confidenceLevel: "High",
        sourceType: "Deterministic Rule",
        engineVersion: OBJECTION_ENGINE_VERSION,
        rulesVersion: LP_OBJECTION_RULES_VERSION,
      });
    }
  }

  // ── 7. Fees too high ────────────────────────────────────────────────────────
  if (fund.managementFeePct > agent.maxManagementFeePct) {
    const excess = (fund.managementFeePct - agent.maxManagementFeePct).toFixed(2);
    objections.push({
      category: "fees-too-high",
      statement: `Management fee of ${fund.managementFeePct}% exceeds this allocator's maximum tolerance of ${agent.maxManagementFeePct}%.`,
      allocatorSegment: seg,
      trigger: `managementFeePct (${fund.managementFeePct}) > maxManagementFeePct (${agent.maxManagementFeePct})`,
      severity: Number(excess) > 0.5 ? "High" : "Moderate",
      likelihood: "High",
      supportingFundData: `Management fee: ${fund.managementFeePct}%`,
      missingEvidence: "None — fee is a fixed fund parameter",
      isCurable: true,
      recommendedResponse: "Consider reducing management fee or offering a fee break for large commitments.",
      suggestedTermAdjustment: `Reduce management fee from ${fund.managementFeePct}% to ${agent.maxManagementFeePct}% or below`,
      suggestedPositioningAdjustment: "Offer fee concessions for anchor investors.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 8. Carry too high ───────────────────────────────────────────────────────
  if (fund.carryPct > agent.maxCarryPct) {
    objections.push({
      category: "carry-too-high",
      statement: `Carried interest of ${fund.carryPct}% exceeds this allocator's maximum tolerance of ${agent.maxCarryPct}%.`,
      allocatorSegment: seg,
      trigger: `carryPct (${fund.carryPct}) > maxCarryPct (${agent.maxCarryPct})`,
      severity: "Moderate",
      likelihood: "Moderate",
      supportingFundData: `Carried interest: ${fund.carryPct}%`,
      missingEvidence: "None — carry is a fixed fund parameter",
      isCurable: true,
      recommendedResponse: "Consider reducing carry or adding a hurdle rate to align interests.",
      suggestedTermAdjustment: `Reduce carry from ${fund.carryPct}% to ${agent.maxCarryPct}% or add hurdle rate`,
      suggestedPositioningAdjustment: null,
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 9. GP commitment too low ────────────────────────────────────────────────
  if (fund.gpCommitmentPct != null && fund.gpCommitmentPct < agent.minGpCommitmentPct) {
    objections.push({
      category: "gp-commitment-too-low",
      statement: `GP commitment of ${fund.gpCommitmentPct}% is below this allocator's minimum of ${agent.minGpCommitmentPct}%.`,
      allocatorSegment: seg,
      trigger: `gpCommitmentPct (${fund.gpCommitmentPct}) < minGpCommitmentPct (${agent.minGpCommitmentPct})`,
      severity: "High",
      likelihood: "High",
      supportingFundData: `GP commitment: ${fund.gpCommitmentPct}%`,
      missingEvidence: "GP commitment documentation",
      isCurable: true,
      recommendedResponse: "Increase GP commitment to meet allocator minimum. Document commitment in fund documents.",
      suggestedTermAdjustment: `Increase GP commitment from ${fund.gpCommitmentPct}% to ${agent.minGpCommitmentPct}% minimum`,
      suggestedPositioningAdjustment: "Emphasise GP personal investment alongside fund commitment.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 10. Fund term too long ──────────────────────────────────────────────────
  if (fund.fundTermYrs != null && fund.fundTermYrs > agent.investmentHorizonYrs) {
    objections.push({
      category: "fund-term-too-long",
      statement: `Fund term of ${fund.fundTermYrs} years exceeds this allocator's preferred investment horizon of ${agent.investmentHorizonYrs} years.`,
      allocatorSegment: seg,
      trigger: `fundTermYrs (${fund.fundTermYrs}) > investmentHorizonYrs (${agent.investmentHorizonYrs})`,
      severity: "Moderate",
      likelihood: "Moderate",
      supportingFundData: `Fund term: ${fund.fundTermYrs} years`,
      missingEvidence: "None — fund term is a fixed parameter",
      isCurable: true,
      recommendedResponse: "Consider whether fund term can be shortened or whether extension provisions can be limited.",
      suggestedTermAdjustment: `Reduce fund term from ${fund.fundTermYrs} to ${agent.investmentHorizonYrs} years`,
      suggestedPositioningAdjustment: null,
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 11. ESG concern ─────────────────────────────────────────────────────────
  if (!fund.esgPolicy && agent.esgRequirements.toLowerCase().includes("required")) {
    objections.push({
      category: "esg-concern",
      statement: "No ESG policy documented. This allocator requires ESG integration.",
      allocatorSegment: seg,
      trigger: "esgPolicy is null and allocator requires ESG",
      severity: "High",
      likelihood: "Very High",
      supportingFundData: "ESG policy: not documented",
      missingEvidence: "ESG policy, responsible investment framework, exclusion list",
      isCurable: true,
      recommendedResponse: "Develop and document an ESG policy. Consider adopting a recognised framework (PRI, TCFD).",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: "Lead with ESG credentials in initial outreach.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 12. Sharia concern ──────────────────────────────────────────────────────
  if (agent.shariaRequired && fund.shariaCompliant !== true) {
    objections.push({
      category: "sharia-concern",
      statement: fund.shariaCompliant === false
        ? "Fund is explicitly non-Sharia-compliant. This allocator requires Sharia compliance."
        : "Sharia compliance status not confirmed. This allocator requires Sharia-compliant structures.",
      allocatorSegment: seg,
      trigger: `shariaRequired=true and shariaCompliant=${fund.shariaCompliant}`,
      severity: "Critical",
      likelihood: "Very High",
      supportingFundData: `Sharia compliant: ${fund.shariaCompliant === null ? "unknown" : "no"}`,
      missingEvidence: "Sharia Supervisory Board approval, AAOIFI compliance documentation",
      isCurable: fund.shariaCompliant !== false,
      recommendedResponse: "Engage a Sharia Supervisory Board. Structure fund under AAOIFI-compliant frameworks (Murabaha, Ijara, Musharaka).",
      suggestedTermAdjustment: "Restructure fund to Sharia-compliant format",
      suggestedPositioningAdjustment: "Do not approach this allocator until Sharia compliance is confirmed.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 13. Governance weakness ─────────────────────────────────────────────────
  if (!fund.governanceStructure) {
    objections.push({
      category: "governance-weakness",
      statement: "Governance structure not documented. Institutional allocators require formal governance frameworks.",
      allocatorSegment: seg,
      trigger: "governanceStructure is null",
      severity: "High",
      likelihood: "High",
      supportingFundData: "Governance structure: not documented",
      missingEvidence: "LPAC structure, advisory board composition, conflict of interest policy",
      isCurable: true,
      recommendedResponse: "Document governance structure including LPAC composition, advisory board, and conflict of interest policy.",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: "Offer LPAC seat to anchor investors.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 14. Reporting weakness ──────────────────────────────────────────────────
  if (!fund.reportingFrequency) {
    objections.push({
      category: "reporting-weakness",
      statement: "Reporting frequency not specified. Institutional allocators require defined reporting cadence.",
      allocatorSegment: seg,
      trigger: "reportingFrequency is null",
      severity: "Moderate",
      likelihood: "Moderate",
      supportingFundData: "Reporting frequency: not specified",
      missingEvidence: "Reporting schedule, reporting format, auditor details",
      isCurable: true,
      recommendedResponse: "Define reporting schedule (quarterly preferred for institutional allocators). Specify auditor and reporting format.",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: null,
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 15. Co-investment insufficient ─────────────────────────────────────────
  if (!fund.coInvestmentRights && agent.coInvestmentPreference.toLowerCase().includes("strong")) {
    objections.push({
      category: "co-investment-insufficient",
      statement: "Co-investment rights not specified. This allocator has strong co-investment appetite.",
      allocatorSegment: seg,
      trigger: "coInvestmentRights is null and allocator has strong co-investment preference",
      severity: "Moderate",
      likelihood: "Moderate",
      supportingFundData: "Co-investment rights: not specified",
      missingEvidence: "Co-investment policy, deal-by-deal access terms",
      isCurable: true,
      recommendedResponse: "Define co-investment rights policy. Offer pro-rata co-investment rights to anchor investors.",
      suggestedTermAdjustment: "Add co-investment rights to fund terms",
      suggestedPositioningAdjustment: "Lead with co-investment opportunity in outreach.",
      confidenceLevel: "Moderate",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  // ── 16. First-time fund ─────────────────────────────────────────────────────
  if (fund.trackRecordYrs < 3 && !agent.firstTimeFundTolerance) {
    objections.push({
      category: "track-record-limited",
      statement: "This allocator does not consider first-time funds or managers with less than 3 years of track record.",
      allocatorSegment: seg,
      trigger: "trackRecordYrs < 3 and firstTimeFundTolerance = false",
      severity: "Critical",
      likelihood: "Very High",
      supportingFundData: `Track record: ${fund.trackRecordYrs} years`,
      missingEvidence: "Prior fund track record, reference LPs",
      isCurable: false,
      recommendedResponse: "Target allocators with first-time fund tolerance. Build track record before approaching this segment.",
      suggestedTermAdjustment: null,
      suggestedPositioningAdjustment: "Do not approach this allocator segment until track record exceeds 3 years.",
      confidenceLevel: "High",
      sourceType: "Deterministic Rule",
      engineVersion: OBJECTION_ENGINE_VERSION,
      rulesVersion: LP_OBJECTION_RULES_VERSION,
    });
  }

  return objections;
}

// ── Objection summary ─────────────────────────────────────────────────────────

export interface ObjectionSummary {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  curable: number;
  incurable: number;
  topObjection: Objection | null;
}

export function summariseObjections(objections: Objection[]): ObjectionSummary {
  const critical = objections.filter((o) => o.severity === "Critical").length;
  const high = objections.filter((o) => o.severity === "High").length;
  const moderate = objections.filter((o) => o.severity === "Moderate").length;
  const low = objections.filter((o) => o.severity === "Low").length;
  const curable = objections.filter((o) => o.isCurable).length;
  const incurable = objections.filter((o) => !o.isCurable).length;
  const sorted = [...objections].sort((a, b) => {
    const order: Record<string, number> = { Critical: 4, High: 3, Moderate: 2, Low: 1 };
    return (order[b.severity] ?? 0) - (order[a.severity] ?? 0);
  });
  return { total: objections.length, critical, high, moderate, low, curable, incurable, topObjection: sorted[0] ?? null };
}
