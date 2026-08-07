/**
 * meetingEngine.ts — LP Meeting Intelligence Engine v1.0.0
 *
 * Provides:
 *  - generateMeetingBrief: structured pre-meeting preparation
 *  - evaluateObjectionResponse: rehearsal scoring (factual/decision quality only)
 *  - runLPPanel: multi-agent panel simulation
 *
 * All outputs are deterministic and grounded in fit/objection engine results.
 * No charisma or personality evaluation.
 */

import type { FundProfile, FitResultV2 } from "./fitEngine";
import { computeAllocatorFit as computeFitScore } from "./fitEngine";
import { generateObjections } from "./objectionEngine";
import type { LPAgent } from "./agentBank";
import { getAgentById, LP_AGENT_BANK } from "./agentBank";

export const MEETING_ENGINE_VERSION = "1.0.0";

// ── Meeting Types and Objectives ──────────────────────────────────────────────

export type MeetingType =
  | "introductory"
  | "first_diligence"
  | "follow_up"
  | "ic_preparation"
  | "terms_discussion"
  | "final_diligence"
  | "reup_discussion"
  | "consultant_gatekeeper";

export type MeetingObjective =
  | "secure_second_meeting"
  | "enter_formal_diligence"
  | "obtain_data_room_request"
  | "resolve_objections"
  | "discuss_terms"
  | "secure_soft_circle"
  | "progress_toward_commitment"
  | "understand_rejection";

// ── Meeting Brief ─────────────────────────────────────────────────────────────

export interface LikelyQuestion {
  question: string;
  category: string;
  priority: "critical" | "high" | "moderate" | "low";
  suggestedResponse: string;
  evidenceNeeded: string[];
}

export interface ObjectionBriefItem {
  category: string;
  statement: string;
  severity: "critical" | "high" | "moderate" | "low";
  whyItMayArise: string;
  evidenceNeeded: string[];
  recommendedResponse: string;
  curable: boolean;
}

export interface PositioningGuidance {
  emphasize: string[];
  doNotOverstate: string[];
  leadWithEvidence: string[];
  termsThatMayNeedFlexibility: string[];
}

export interface GPQuestion {
  question: string;
  purpose: string;
  category: string;
}

export interface MeetingBrief {
  fundName: string;
  fundVersion: number;
  segmentId: string;
  segmentName: string;
  meetingType: MeetingType;
  meetingObjective: MeetingObjective;
  // Investor Archetype
  investorArchetype: {
    allocatorType: string;
    typicalMandate: string;
    ticketSizeRange: string;
    decisionProcess: string;
    keyConstraints: string[];
    typicalDiligenceCycle: string;
  };
  // Fund Fit
  fundFit: {
    overallScore: number;
    fitCategory: string;
    strongestDimensions: Array<{ dimension: string; score: number; reasoning: string }>;
    weakestDimensions: Array<{ dimension: string; score: number; reasoning: string }>;
    eligibilityIssues: string[];
    evidenceGaps: Array<{ field: string; description: string; priority: string }>;
  };
  // Likely Questions
  likelyQuestions: LikelyQuestion[];
  // Likely Objections
  likelyObjections: ObjectionBriefItem[];
  // Recommended Positioning
  positioning: PositioningGuidance;
  // GP Questions to Ask
  gpQuestionsToAsk: GPQuestion[];
  // Meeting Objective
  objectiveStatement: string;
  // Topics to avoid overstating
  avoidOverstating: string[];
  // Suggested next action
  suggestedNextAction: string;
  // Metadata
  engineVersion: string;
  meetingEngineVersion: string;
  disclaimer: string;
}

// ── Question Banks by Meeting Type ────────────────────────────────────────────

const UNIVERSAL_QUESTIONS: Array<Omit<LikelyQuestion, "suggestedResponse" | "evidenceNeeded">> = [
  { question: "Why this strategy now?", category: "Strategy", priority: "high" },
  { question: "Why this fund size?", category: "Fund Structure", priority: "high" },
  { question: "Why should we believe the track record is repeatable?", category: "Track Record", priority: "critical" },
  { question: "How much capital is the GP committing?", category: "Alignment", priority: "high" },
  { question: "What realized exits support the target return?", category: "Track Record", priority: "critical" },
  { question: "How are valuations determined?", category: "Governance", priority: "high" },
  { question: "What happens if exits remain slow?", category: "Risk", priority: "high" },
  { question: "What is the co-investment policy?", category: "Terms", priority: "moderate" },
  { question: "How does the strategy behave under stress?", category: "Risk", priority: "high" },
  { question: "Who are your current investors?", category: "Investor Base", priority: "moderate" },
];

const MEETING_TYPE_QUESTIONS: Record<MeetingType, Array<Omit<LikelyQuestion, "suggestedResponse" | "evidenceNeeded">>> = {
  introductory: [
    { question: "What differentiates this fund from alternatives in the market?", category: "Strategy", priority: "high" },
    { question: "What is the GP's competitive advantage?", category: "Strategy", priority: "high" },
    { question: "What is the minimum commitment size?", category: "Terms", priority: "moderate" },
  ],
  first_diligence: [
    { question: "Can you provide audited track record attribution?", category: "Track Record", priority: "critical" },
    { question: "Who are your fund administrator and auditor?", category: "Governance", priority: "high" },
    { question: "What is the fund's legal structure and domicile?", category: "Governance", priority: "high" },
    { question: "How do you handle key-man risk?", category: "Risk", priority: "high" },
  ],
  follow_up: [
    { question: "Can you address the concerns raised in our last meeting?", category: "Follow-Up", priority: "critical" },
    { question: "What additional evidence can you provide?", category: "Evidence", priority: "high" },
    { question: "What is the current pipeline?", category: "Portfolio", priority: "moderate" },
  ],
  ic_preparation: [
    { question: "What is the worst-case scenario for this fund?", category: "Risk", priority: "critical" },
    { question: "How do you compare to peer funds on fees and terms?", category: "Terms", priority: "high" },
    { question: "What is the expected DPI at fund end?", category: "Returns", priority: "critical" },
    { question: "What are the key risks the IC should be aware of?", category: "Risk", priority: "critical" },
  ],
  terms_discussion: [
    { question: "Are the management fees negotiable for anchor investors?", category: "Terms", priority: "high" },
    { question: "What are the MFN provisions?", category: "Terms", priority: "high" },
    { question: "What are the clawback provisions?", category: "Terms", priority: "high" },
    { question: "What are the reporting obligations?", category: "Reporting", priority: "moderate" },
  ],
  final_diligence: [
    { question: "Can we speak with your existing LPs?", category: "References", priority: "critical" },
    { question: "Are there any pending legal or regulatory issues?", category: "Legal", priority: "critical" },
    { question: "What is the final closing timeline?", category: "Process", priority: "high" },
  ],
  reup_discussion: [
    { question: "What has changed since the prior fund?", category: "Strategy", priority: "high" },
    { question: "What were the lessons learned from the prior fund?", category: "Track Record", priority: "critical" },
    { question: "How has the team evolved?", category: "Team", priority: "high" },
  ],
  consultant_gatekeeper: [
    { question: "What is your track record in our asset class?", category: "Track Record", priority: "critical" },
    { question: "How do you compare to your peer group on a risk-adjusted basis?", category: "Performance", priority: "critical" },
    { question: "What is your operational due diligence process?", category: "Governance", priority: "high" },
  ],
};

// ── GP Questions to Ask ───────────────────────────────────────────────────────

const GP_QUESTIONS_TO_ASK: GPQuestion[] = [
  { question: "What is your current allocation to this strategy?", purpose: "Understand mandate fit", category: "Mandate" },
  { question: "What is your target allocation for this vintage year?", purpose: "Understand timing", category: "Allocation Timing" },
  { question: "What is your typical commitment size for a fund of this type?", purpose: "Understand ticket size", category: "Ticket Size" },
  { question: "Who makes the final investment decision?", purpose: "Understand decision process", category: "Decision Process" },
  { question: "What is your current exposure to this geography and strategy?", purpose: "Understand portfolio fit", category: "Portfolio Exposure" },
  { question: "Do you have any re-up requirements from prior fund managers?", purpose: "Understand competing commitments", category: "Re-Up Requirements" },
  { question: "What is your appetite for co-investment opportunities?", purpose: "Understand co-investment interest", category: "Co-Investment Appetite" },
  { question: "Are there any internal constraints we should be aware of?", purpose: "Surface hidden blockers", category: "Internal Constraints" },
  { question: "What is your typical diligence timeline?", purpose: "Set process expectations", category: "Process" },
  { question: "What would a successful outcome from this meeting look like for you?", purpose: "Align on objective", category: "Meeting Objective" },
];

// ── Meeting Brief Generator ───────────────────────────────────────────────────

export function generateMeetingBrief(
  fund: FundProfile,
  segmentId: string,
  meetingType: MeetingType,
  meetingObjective: MeetingObjective,
  fitResult?: FitResultV2
): MeetingBrief {
  const agent = getAgentById(segmentId);
  if (!agent) throw new Error(`Unknown segment: ${segmentId}`);

  // Use provided fit result or compute
  const fit = fitResult ?? computeFitScore(fund, agent);

  // Generate objections
  const objections = generateObjections(fund, agent);

  // Build investor archetype section
  const investorArchetype = {
    allocatorType: agent.segmentType,
    typicalMandate: agent.mandate,
    ticketSizeRange: `$${agent.ticketSizeMinM}M – $${agent.ticketSizeMaxM}M`,
    decisionProcess: agent.decisionAuthority,
    keyConstraints: agent.commonObjections,
    typicalDiligenceCycle: `${agent.diligenceDurationMonths} months`,
  };

  // Fund fit section
  const sortedDims = [...fit.dimensions].sort((a: { score: number }, b: { score: number }) => b.score - a.score);
  const fundFit = {
    overallScore: fit.overallFitScore,
    fitCategory: fit.fitCategory,
    strongestDimensions: sortedDims.slice(0, 3).map((d: { dimension: string; score: number; reasoning: string }) => ({ dimension: d.dimension, score: d.score, reasoning: d.reasoning })),
    weakestDimensions: sortedDims.slice(-3).reverse().map((d: { dimension: string; score: number; reasoning: string }) => ({ dimension: d.dimension, score: d.score, reasoning: d.reasoning })),
    eligibilityIssues: fit.disqualifyingIssues,
    evidenceGaps: fit.evidenceGaps,
  };

  // Build likely questions
  const universalQs = UNIVERSAL_QUESTIONS.map((q) => ({
    ...q,
    suggestedResponse: buildSuggestedResponse(q.question, fund, fit),
    evidenceNeeded: buildEvidenceNeeded(q.question, fund, fit),
  }));
  const typeQs = (MEETING_TYPE_QUESTIONS[meetingType] ?? []).map((q) => ({
    ...q,
    suggestedResponse: buildSuggestedResponse(q.question, fund, fit),
    evidenceNeeded: buildEvidenceNeeded(q.question, fund, fit),
  }));
  // Add segment-specific questions
  const segmentQs = buildSegmentQuestions(agent, fund, fit);
  const likelyQuestions = [...universalQs, ...typeQs, ...segmentQs]
    .sort((a, b) => {
      const order = { critical: 0, high: 1, moderate: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 15);

  // Build objection brief items
  const likelyObjections: ObjectionBriefItem[] = objections.slice(0, 8).map((obj) => ({
    category: obj.category,
    statement: obj.statement,
    severity: obj.severity as "critical" | "high" | "moderate" | "low",
    whyItMayArise: obj.statement ?? `${agent.name} prioritises ${obj.category.toLowerCase()} as a key screening criterion`,
    evidenceNeeded: obj.missingEvidence ? [obj.missingEvidence] : [],
    recommendedResponse: obj.recommendedResponse ?? `Address ${obj.category.toLowerCase()} directly with specific data points and third-party verification`,
    curable: obj.isCurable ?? true,
  }));

  // Positioning guidance
  const positioning = buildPositioningGuidance(fund, agent, fit, objections);

  // Meeting objective statement
  const objectiveStatement = buildObjectiveStatement(meetingObjective, agent);

  // Suggested next action
  const suggestedNextAction = buildNextAction(meetingType, meetingObjective, fit);

  // Topics to avoid overstating
  const avoidOverstating = buildAvoidOverstating(fund, fit, objections);

  return {
    fundName: fund.fundName,
    fundVersion: fund.fundVersion,
    segmentId,
    segmentName: agent.name,
    meetingType,
    meetingObjective,
    investorArchetype,
    fundFit,
    likelyQuestions,
    likelyObjections,
    positioning,
    gpQuestionsToAsk: GP_QUESTIONS_TO_ASK,
    objectiveStatement,
    avoidOverstating,
    suggestedNextAction,
    engineVersion: "2.0.0",
    meetingEngineVersion: MEETING_ENGINE_VERSION,
    disclaimer: "SYNTHETIC SIMULATION — This meeting brief is generated from institutional archetype data and deterministic fit analysis. It does not represent the views of any specific investor. Actual meeting dynamics will vary. This brief does not constitute placement advice.",
  };
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function buildSuggestedResponse(question: string, fund: FundProfile, fit: FitResultV2): string {
  const q = question.toLowerCase();
  if (q.includes("track record")) {
    return `Present ${fund.trackRecordYrs} years of audited track record with ${fund.priorFundIRR ? `${fund.priorFundIRR}% prior fund IRR` : "detailed attribution analysis"}. Emphasize realized exits and DPI.`;
  }
  if (q.includes("gp commit")) {
    return `GP commitment is ${fund.gpCommitmentPct ?? 1}% of fund size, demonstrating alignment of interest. This is ${(fund.gpCommitmentPct ?? 1) >= 2 ? "above" : "at"} market standard.`;
  }
  if (q.includes("strategy")) {
    return `${fund.strategy} in ${fund.geography ?? "target markets"} — focus on ${fund.assetClass ?? "the target asset class"} with a target return of ${fund.targetReturnPct ?? "market-leading"} IRR.`;
  }
  if (q.includes("fee") || q.includes("terms")) {
    return `Management fee of ${fund.managementFeePct}%, carry of ${fund.carryPct}%, hurdle of ${fund.hurdleRatePct ?? 8}%. ${fund.managementFeePct <= 2 ? "Fee structure is at or below market standard." : "Fee structure reflects the fund's differentiated strategy."}`;
  }
  if (q.includes("co-investment")) {
    return fund.coInvestmentRights && fund.coInvestmentRights !== "None"
      ? `Co-investment rights are ${fund.coInvestmentRights.toLowerCase()} — available to qualifying LPs on a case-by-case basis.`
      : "Co-investment policy is being finalised. We will provide details in the data room.";
  }
  return `Refer to the fund's data room documentation for detailed supporting evidence on this question.`;
}

function buildEvidenceNeeded(question: string, fund: FundProfile, fit: FitResultV2): string[] {
  const q = question.toLowerCase();
  const evidence: string[] = [];
  if (q.includes("track record") || q.includes("exit") || q.includes("return")) {
    evidence.push("Audited track record with attribution analysis");
    evidence.push("Realized exit documentation with DPI and TVPI");
  }
  if (q.includes("valuation")) {
    evidence.push("Independent valuation methodology document");
    evidence.push("Fund administrator confirmation of NAV calculation process");
  }
  if (q.includes("gp commit")) {
    evidence.push("GP commitment confirmation letter or fund document excerpt");
  }
  if (q.includes("legal") || q.includes("structure") || q.includes("domicile")) {
    evidence.push("Fund formation documents and legal structure summary");
  }
  // Add evidence gaps from fit result
  if (fit.evidenceGaps.length > 0 && evidence.length === 0) {
    evidence.push(...fit.evidenceGaps.slice(0, 2).map((g: { description: string }) => g.description));
  }
  return evidence;
}

function buildSegmentQuestions(agent: LPAgent, fund: FundProfile, fit: FitResultV2): LikelyQuestion[] {
  const questions: LikelyQuestion[] = [];

  if (agent.shariaRequired) {
    questions.push({
      question: "How is Sharia compliance governed and certified?",
      category: "Sharia Compliance",
      priority: "critical",
      suggestedResponse: fund.shariaCompliant
        ? "The fund is Sharia-compliant with certification from an independent Sharia supervisory board."
        : "The fund is not currently structured as Sharia-compliant. We can discuss structuring options.",
      evidenceNeeded: ["Sharia supervisory board certification", "Sharia compliance methodology document"],
    });
  }

  if (agent.esgRequirements && agent.esgRequirements.toLowerCase().includes("sfdr")) {
    questions.push({
      question: "What is your ESG framework and SFDR classification?",
      category: "ESG",
      priority: "high",
      suggestedResponse: fund.esgPolicy
        ? `The fund operates under ${fund.esgPolicy} with integrated ESG monitoring across the portfolio.`
        : "We are developing our ESG framework and will provide documentation before final diligence.",
      evidenceNeeded: ["ESG policy document", "SFDR classification confirmation", "Portfolio ESG monitoring methodology"],
    });
  }

  if (fit.overallFitScore < 50) {
    questions.push({
      question: "Why do you believe this fund fits our mandate?",
      category: "Mandate Fit",
      priority: "critical",
      suggestedResponse: `While there are areas to address, the fund's ${fit.principalFitReasons[0] ?? "core strategy"} aligns with your mandate. We would welcome the opportunity to discuss how we can address your specific requirements.`,
      evidenceNeeded: [...fit.evidenceGaps.slice(0, 2).map((g: { description: string }) => g.description)],
    });
  }

  return questions;
}

function buildPositioningGuidance(fund: FundProfile, agent: LPAgent, fit: FitResultV2, objections: ReturnType<typeof generateObjections>): PositioningGuidance {
  const emphasize: string[] = [];
  const doNotOverstate: string[] = [];
  const leadWithEvidence: string[] = [];
  const termsThatMayNeedFlexibility: string[] = [];

  // Emphasize strong dimensions
  const strongDims = fit.dimensions.filter((d) => d.score >= 75).slice(0, 3);
  emphasize.push(...strongDims.map((d) => `${d.dimension}: ${d.reasoning}`));

  // Do not overstate weak dimensions
  const weakDims = fit.dimensions.filter((d) => d.score < 50 && d.dataPresent);
  doNotOverstate.push(...weakDims.map((d) => `${d.dimension} — score is ${d.score}/100, avoid overstating`));

  // Lead with evidence for critical objections
  const criticalObjections = objections.filter((o: { severity: string }) => o.severity === "critical");
  leadWithEvidence.push(...criticalObjections.flatMap((o) => o.missingEvidence ?? []).slice(0, 3));

  // Terms that may need flexibility
  if (fund.managementFeePct > 2.0) {
    termsThatMayNeedFlexibility.push(`Management fee (${fund.managementFeePct}%) — consider fee offset or reduced fee for anchor investors`);
  }
  if ((fund.gpCommitmentPct ?? 1) < 2) {
    termsThatMayNeedFlexibility.push(`GP commitment (${fund.gpCommitmentPct ?? 1}%) — consider increasing to improve alignment signal`);
  }
  if (!fund.coInvestmentRights || fund.coInvestmentRights === "None") {
    if (agent.segmentType.includes("Family Office") || agent.segmentType.includes("Sovereign")) {
      termsThatMayNeedFlexibility.push("Co-investment rights — this allocator type typically expects co-investment access");
    }
  }

  return { emphasize, doNotOverstate, leadWithEvidence, termsThatMayNeedFlexibility };
}

function buildObjectiveStatement(objective: MeetingObjective, agent: LPAgent): string {
  const statements: Record<MeetingObjective, string> = {
    secure_second_meeting: `Secure a follow-up meeting with ${agent.name} to present the full investment case and track record.`,
    enter_formal_diligence: `Initiate formal diligence process with ${agent.name} and obtain data room access request.`,
    obtain_data_room_request: `Obtain a formal data room access request from ${agent.name} to advance the process.`,
    resolve_objections: `Address the specific objections raised by ${agent.name} with targeted evidence and documentation.`,
    discuss_terms: `Reach agreement on fund terms with ${agent.name} to enable soft circle confirmation.`,
    secure_soft_circle: `Obtain a soft circle commitment from ${agent.name} ahead of first close.`,
    progress_toward_commitment: `Advance the relationship with ${agent.name} toward a formal commitment decision.`,
    understand_rejection: `Understand the specific reasons for ${agent.name}'s rejection to inform future fundraising strategy.`,
  };
  return statements[objective];
}

function buildNextAction(meetingType: MeetingType, objective: MeetingObjective, fit: FitResultV2): string {
  if (fit.fitCategory === "Likely Ineligible") {
    return "Send a brief thank-you note. Do not pursue further until fund terms are materially improved. Document the rejection reasons for future reference.";
  }
  const actions: Record<MeetingType, string> = {
    introductory: "Send a follow-up email within 24 hours with the fund teaser and a request for a second meeting. Include a brief summary of the key points discussed.",
    first_diligence: "Provide the data room access link within 48 hours. Include the DDQ response template and audited track record.",
    follow_up: "Address all outstanding questions in writing within 5 business days. Schedule a follow-up call to confirm receipt.",
    ic_preparation: "Prepare the IC presentation deck. Offer to present directly to the IC if requested.",
    terms_discussion: "Provide a marked-up term sheet within 3 business days. Confirm any agreed modifications in writing.",
    final_diligence: "Provide reference contacts within 24 hours. Confirm the closing timeline and soft circle status.",
    reup_discussion: "Provide the prior fund performance update and the new fund teaser. Schedule a dedicated re-up discussion call.",
    consultant_gatekeeper: "Provide the consultant questionnaire response within 5 business days. Follow up with the underlying LP contact.",
  };
  return actions[meetingType];
}

function buildAvoidOverstating(fund: FundProfile, fit: FitResultV2, objections: ReturnType<typeof generateObjections>): string[] {
  const avoid: string[] = [];
  const weakDims = fit.dimensions.filter((d) => d.score < 50 && d.dataPresent);
  avoid.push(...weakDims.map((d) => `${d.dimension} performance — current score is ${d.score}/100`));
  if (fund.trackRecordYrs < 5) {
    avoid.push("Track record length — do not imply a longer track record than the documented period");
  }
  if (!fund.priorFundIRR || fund.priorFundIRR <= 0) {
    avoid.push("Return projections — no audited prior fund IRR is available to support return claims");
  }
  const criticalObjections = objections.filter((o: { severity: string }) => o.severity === "critical");
  avoid.push(...criticalObjections.map((o) => `${o.category} — this is a critical objection; do not dismiss it without evidence`));
  return avoid.slice(0, 6);
}

// ── Objection Rehearsal Evaluator ─────────────────────────────────────────────

export type RehearsalVerdict = "Strong" | "Adequate" | "Weak" | "Unsupported";

export interface RehearsalEvaluation {
  verdict: RehearsalVerdict;
  overallScore: number; // 0–100
  dimensions: {
    evidenceCompleteness: number;
    directness: number;
    credibility: number;
    consistencyWithFundData: number;
    objectionActuallyAnswered: boolean;
    unsupportedClaims: string[];
    newRisksIntroduced: string[];
  };
  coaching: string[];
  disclaimer: string;
}

export function evaluateObjectionResponse(
  objection: string,
  gpResponse: string,
  fund: FundProfile,
  fitResult: FitResultV2
): RehearsalEvaluation {
  const resp = gpResponse.toLowerCase();
  const obj = objection.toLowerCase();
  const unsupportedClaims: string[] = [];
  const newRisks: string[] = [];
  const coaching: string[] = [];

  // 1. Evidence Completeness (0–100)
  let evidenceCompleteness = 50;
  const evidenceKeywords = ["audited", "verified", "documented", "data room", "track record", "irr", "dpi", "tvpi", "exit", "attribution", "independent", "certified"];
  const evidenceCount = evidenceKeywords.filter((k) => resp.includes(k)).length;
  evidenceCompleteness = Math.min(100, 30 + evidenceCount * 10);
  if (evidenceCount === 0) {
    coaching.push("Provide specific, verifiable evidence to support your response. Assertions without data are not credible in institutional diligence.");
  }

  // 2. Directness (0–100)
  let directness = 60;
  const deflectionKeywords = ["we believe", "we think", "we feel", "we hope", "we expect", "should be", "will be", "plan to"];
  const deflectionCount = deflectionKeywords.filter((k) => resp.includes(k)).length;
  directness = Math.max(20, 80 - deflectionCount * 15);
  if (deflectionCount > 1) {
    coaching.push("Replace forward-looking statements with documented facts. Institutional allocators discount projections without historical support.");
  }

  // 3. Credibility (0–100)
  let credibility = 60;
  // Check for unsupported superlatives
  const superlatives = ["best", "top", "leading", "unique", "unmatched", "superior", "exceptional", "outstanding"];
  const superlativeCount = superlatives.filter((k) => resp.includes(k)).length;
  if (superlativeCount > 0) {
    credibility -= superlativeCount * 10;
    unsupportedClaims.push(...superlatives.filter((k) => resp.includes(k)).map((s) => `Unsupported superlative: "${s}"`));
    coaching.push("Remove unsupported superlatives. Replace with specific, quantified claims that can be verified.");
  }
  credibility = Math.max(20, Math.min(100, credibility + evidenceCount * 5));

  // 4. Consistency with Fund Data (0–100)
  let consistency = 80;
  // Check for inconsistencies with known fund data
  if (resp.includes("no fee") || resp.includes("zero fee")) {
    if (fund.managementFeePct > 0) {
      consistency -= 40;
      unsupportedClaims.push(`Response claims no fee but fund management fee is ${fund.managementFeePct}%`);
      coaching.push("Your response is inconsistent with the fund's documented management fee. Correct this immediately.");
    }
  }
  if (resp.includes("sharia") && resp.includes("compliant") && fund.shariaCompliant !== true) {
    consistency -= 30;
    unsupportedClaims.push("Response claims Sharia compliance but fund is not documented as Sharia-compliant");
    coaching.push("Do not claim Sharia compliance unless the fund has formal Sharia supervisory board certification.");
  }

  // 5. Objection Actually Answered
  const objectionActuallyAnswered = resp.length > 50 && !deflectionKeywords.every((k) => resp.includes(k));
  if (!objectionActuallyAnswered) {
    coaching.push("The response does not directly address the objection. Restate the objection in your response to confirm you understood it, then address it specifically.");
  }

  // 6. New Risks Introduced
  const riskKeywords = ["uncertain", "unclear", "not yet", "pending", "to be determined", "tbd", "working on"];
  const newRiskCount = riskKeywords.filter((k) => resp.includes(k)).length;
  if (newRiskCount > 0) {
    newRisks.push(...riskKeywords.filter((k) => resp.includes(k)).map((r) => `Uncertainty introduced: "${r}"`));
    coaching.push("Your response introduces new uncertainties. If an issue is unresolved, acknowledge it and provide a specific timeline for resolution.");
  }

  // Overall Score
  const overallScore = Math.round(
    (evidenceCompleteness * 0.30) +
    (directness * 0.20) +
    (credibility * 0.25) +
    (consistency * 0.25)
  );

  const verdict: RehearsalVerdict =
    overallScore >= 75 ? "Strong" :
    overallScore >= 55 ? "Adequate" :
    overallScore >= 35 ? "Weak" :
    "Unsupported";

  if (coaching.length === 0) {
    coaching.push("Response demonstrates good evidence grounding and directness. Ensure all claims can be verified in the data room.");
  }

  return {
    verdict,
    overallScore,
    dimensions: {
      evidenceCompleteness,
      directness,
      credibility,
      consistencyWithFundData: consistency,
      objectionActuallyAnswered,
      unsupportedClaims,
      newRisksIntroduced: newRisks,
    },
    coaching,
    disclaimer: "EVALUATION NOTE — This rehearsal evaluates factual and decision quality only. Charisma, tone, and interpersonal dynamics are not assessed. Scoring is based on evidence completeness, directness, credibility, and consistency with documented fund data.",
  };
}

// ── Multi-Agent LP Panel ──────────────────────────────────────────────────────

export interface PanelAgentResult {
  segmentId: string;
  segmentName: string;
  decision: "Would Continue" | "Requires More Evidence" | "Requires Term Changes" | "Would Decline";
  fitScore: number;
  fitCategory: string;
  topObjections: Array<{ category: string; statement: string; severity: string }>;
  topQuestions: string[];
  evidenceRequired: string[];
  termChangesRequired: string[];
  positiveSignals: string[];
}

export interface PanelResult {
  fundName: string;
  fundVersion: number;
  segmentsPresented: string[];
  agentResults: PanelAgentResult[];
  summary: {
    wouldContinueCount: number;
    requiresEvidenceCount: number;
    requiresTermChangesCount: number;
    wouldDeclineCount: number;
    commonObjections: string[];
    segmentSpecificObjections: Array<{ segmentName: string; objections: string[] }>;
    areasOfConsensus: string[];
    areasOfDisagreement: string[];
    fundraisingRecommendation: string;
  };
  disclaimer: string;
  engineVersion: string;
}

export function runLPPanel(
  fund: FundProfile,
  segmentIds: string[]
): PanelResult {
  const agents = segmentIds.map((id) => {
    const agent = getAgentById(id);
    if (!agent) throw new Error(`Unknown segment: ${id}`);
    return agent;
  });

  const agentResults: PanelAgentResult[] = agents.map((agent) => {
    const fit = computeFitScore(fund, agent);
    const objections = generateObjections(fund, agent);

    // Decision logic
    let decision: PanelAgentResult["decision"];
    if (fit.fitCategory === "Likely Ineligible" || fit.disqualifyingIssues.length > 0) {
      decision = "Would Decline";
    } else if (fit.fitCategory === "Strong Fit") {
      decision = "Would Continue";
    } else if (objections.filter((o: { severity: string }) => o.severity === "critical").length > 0) {
      decision = "Requires More Evidence";
    } else if (fit.fitCategory === "Weak Fit") {
      decision = "Requires Term Changes";
    } else {
      decision = "Requires More Evidence";
    }

    const topObjections = objections.slice(0, 3).map((o) => ({
      category: o.category,
      statement: o.statement,
      severity: o.severity,
    }));

    const topQuestions = UNIVERSAL_QUESTIONS.slice(0, 3).map((q) => q.question);

    const evidenceRequired = fit.evidenceGaps.slice(0, 3).map((g: { description: string }) => g.description);

    const termChangesRequired: string[] = [];
    if (fit.fitCategory === "Weak Fit" || fit.fitCategory === "Likely Ineligible") {
      if (fund.managementFeePct > 2.0) termChangesRequired.push(`Reduce management fee from ${fund.managementFeePct}%`);
      if ((fund.gpCommitmentPct ?? 1) < 2) termChangesRequired.push(`Increase GP commitment from ${fund.gpCommitmentPct ?? 1}%`);
    }

    const positiveSignals = fit.principalFitReasons.slice(0, 2);

    return {
      segmentId: agent.id,
      segmentName: agent.name,
      decision,
      fitScore: fit.overallFitScore,
      fitCategory: fit.fitCategory,
      topObjections,
      topQuestions,
      evidenceRequired,
      termChangesRequired,
      positiveSignals,
    };
  });

  // Summary
  const wouldContinueCount = agentResults.filter((r) => r.decision === "Would Continue").length;
  const requiresEvidenceCount = agentResults.filter((r) => r.decision === "Requires More Evidence").length;
  const requiresTermChangesCount = agentResults.filter((r) => r.decision === "Requires Term Changes").length;
  const wouldDeclineCount = agentResults.filter((r) => r.decision === "Would Decline").length;

  // Common objections (appear in 2+ segments)
  const objectionCounts = new Map<string, number>();
  for (const r of agentResults) {
    for (const o of r.topObjections) {
      objectionCounts.set(o.category, (objectionCounts.get(o.category) ?? 0) + 1);
    }
  }
  const commonObjections = Array.from(objectionCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // Segment-specific objections
  const segmentSpecificObjections = agentResults
    .filter((r) => r.topObjections.some((o) => !commonObjections.includes(o.category)))
    .map((r) => ({
      segmentName: r.segmentName,
      objections: r.topObjections
        .filter((o) => !commonObjections.includes(o.category))
        .map((o) => o.statement),
    }));

  // Areas of consensus (all agents agree)
  const areasOfConsensus: string[] = [];
  if (wouldContinueCount === agentResults.length) {
    areasOfConsensus.push("All presented segments would continue to diligence");
  }
  if (commonObjections.length > 0) {
    areasOfConsensus.push(`Common objection across segments: ${commonObjections[0]}`);
  }

  // Areas of disagreement
  const areasOfDisagreement: string[] = [];
  if (wouldContinueCount > 0 && wouldDeclineCount > 0) {
    areasOfDisagreement.push(`${wouldContinueCount} segment(s) would continue while ${wouldDeclineCount} would decline — fund terms may need segment-specific adjustments`);
  }

  // Fundraising recommendation
  let fundraisingRecommendation: string;
  if (wouldContinueCount >= agentResults.length * 0.6) {
    fundraisingRecommendation = `Strong panel response. Prioritise outreach to the ${wouldContinueCount} segments that would continue. Address common objections before beginning the roadshow.`;
  } else if (requiresEvidenceCount > wouldDeclineCount) {
    fundraisingRecommendation = `Panel requires additional evidence before proceeding. Complete the evidence gaps identified and re-run the panel before beginning LP outreach.`;
  } else if (requiresTermChangesCount > 0) {
    fundraisingRecommendation = `${requiresTermChangesCount} segment(s) require term changes. Use the Fund-Term Laboratory to test term adjustments before beginning the roadshow.`;
  } else {
    fundraisingRecommendation = `Panel response is mixed. Review the objections raised by declining segments and consider whether fund terms or evidence can be improved before outreach.`;
  }

  return {
    fundName: fund.fundName,
    fundVersion: fund.fundVersion,
    segmentsPresented: segmentIds,
    agentResults,
    summary: {
      wouldContinueCount,
      requiresEvidenceCount,
      requiresTermChangesCount,
      wouldDeclineCount,
      commonObjections,
      segmentSpecificObjections,
      areasOfConsensus,
      areasOfDisagreement,
      fundraisingRecommendation,
    },
    disclaimer: "SYNTHETIC SIMULATION — This panel simulation tests the fund against institutional archetype profiles. It does not predict the decisions of any specific investor. Panel results are evidence-based synthetic simulations and do not constitute placement advice or a guarantee of investor interest.",
    engineVersion: MEETING_ENGINE_VERSION,
  };
}
