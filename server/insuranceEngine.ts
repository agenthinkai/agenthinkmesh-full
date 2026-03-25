/**
 * Insurance & Reinsurance Intelligence Engine
 * Sequential multi-agent pipeline using the blackboard pattern.
 * Covers: Underwriting Decision, Treaty Analysis, Claims Intelligence,
 *         Takaful Compliance Scan, CAT Model workflows.
 */

import { invokeLLM } from "./_core/llm";
import {
  CHAIN_MAP,
  getInsuranceAgentById,
} from "../shared/insuranceAgents";

// ── Blackboard ─────────────────────────────────────────────────────────────────

export interface InsuranceBlackboard {
  // Intake
  insured_name?: string;
  risk_class?: string;
  sum_insured?: string;
  coverage_type?: string;
  policy_period?: string;
  territory?: string;
  // Takaful / Shariah
  product_type?: string;
  takaful_model?: string;
  shariah_requirements?: string[];
  wakala_fee?: string;
  surplus_distribution?: string;
  takaful_compliant?: boolean;
  compliance_issues?: string[];
  gharar_level?: string;
  riba_exposure?: string;
  compliance_score?: number;
  // Risk
  risk_score?: number;
  loss_ratio_estimate?: number;
  technical_premium?: string;
  risk_factors?: string[];
  risk_flags?: string[];
  // Pricing
  gross_premium?: string;
  net_premium?: string;
  loading_factor?: number;
  deductible_recommendation?: string;
  premium_indication?: string;
  // Claims
  claims_frequency?: string;
  average_claim_size?: string;
  fraud_score?: number;
  ibnr_estimate?: string;
  settlement_recommendation?: string;
  // Treaty / Reinsurance
  treaty_type?: string;
  cession_rate?: number;
  retention_level?: string;
  reinstatement_terms?: string;
  treaty_recommendation?: "ACCEPT" | "DECLINE" | "NEGOTIATE";
  // CAT Model
  cat_exposure?: string;
  probable_maximum_loss?: string;
  return_period_losses?: Record<string, string>;
  cat_zones?: string[];
  reinsurance_need?: string;
  // Cession Optimisation
  optimal_cession_rate?: number;
  programme_cost?: string;
  net_retention?: string;
  retrocession_need?: string;
  optimization_score?: number;
  // Decision
  uw_decision?: "APPROVE" | "REFER" | "DECLINE";
  confidence_score?: number;
  decision_rationale?: string;
  conditions?: string[];
  key_questions?: string[];
  // Meta
  [key: string]: unknown;
}

// ── Step Event ─────────────────────────────────────────────────────────────────

export interface InsuranceStepEvent {
  type: "step_start" | "step_complete" | "complete" | "error";
  agentId: string;
  agentName: string;
  stepIndex: number;
  totalSteps: number;
  output?: Partial<InsuranceBlackboard>;
  blackboard?: InsuranceBlackboard;
  tokensUsed?: number;
  durationMs?: number;
  error?: string;
}

type StepCallback = (event: InsuranceStepEvent) => void | Promise<void>;

// ── Agent System Prompts ───────────────────────────────────────────────────────

const AGENT_PROMPTS: Record<string, string> = {
  "IN-IN-001": `You are RiskIntakeParser, a specialist AI agent for insurance and reinsurance risk intake.
Parse the provided risk submission, policy document, or reinsurance slip and extract structured data.
Return a JSON object with: insured_name, risk_class (e.g. Property/Marine/Motor/Medical/Liability/Energy), sum_insured (with currency), coverage_type, policy_period, territory (country/region).
Be specific. If data is missing, make reasonable inferences from context.`,

  "IN-IN-002": `You are TakafulClassifier, an Islamic insurance product specialist.
Classify whether this risk requires conventional insurance or Takaful (Islamic insurance).
Return JSON with: product_type ("conventional" or "takaful"), takaful_model ("wakala" or "mudharaba" or "hybrid" or "N/A"), shariah_requirements (array of specific requirements), wakala_fee (e.g. "15% of contributions"), surplus_distribution (description or "N/A").
For GCC risks, default to Takaful unless explicitly stated otherwise.`,

  "IN-UW-001": `You are RiskModeler, an institutional insurance risk analysis agent.
Build a comprehensive risk profile for this submission.
Return JSON with: risk_score (0-100, higher=riskier), loss_ratio_estimate (percentage as number), technical_premium (estimated with currency), risk_factors (array of key risk drivers), risk_flags (array of specific concerns requiring attention).
Consider GCC-specific risks: oil price sensitivity, geopolitical exposure, construction boom, healthcare inflation.`,

  "IN-UW-002": `You are ShariaComplianceAgent, an Islamic finance compliance specialist.
Evaluate this insurance product/risk for Shariah compliance under AAOIFI standards.
Return JSON with: takaful_compliant (boolean), compliance_issues (array of specific issues found), gharar_level ("none", "acceptable", "excessive"), riba_exposure ("none", "indirect", "direct"), compliance_score (0-100, higher=more compliant).
Flag any gharar (uncertainty), riba (interest), maysir (gambling), or non-halal investment elements.`,

  "IN-UW-003": `You are PricingActuary, an insurance pricing specialist.
Calculate the risk-adjusted premium for this submission.
Return JSON with: gross_premium (with currency), net_premium (after reinsurance, with currency), loading_factor (number, e.g. 1.25 = 25% loading), deductible_recommendation (description), premium_indication (summary string like "USD 450,000 gross / USD 280,000 net").
Apply GCC market rates and consider Takaful contribution structure if applicable.`,

  "IN-UW-004": `You are ClaimsAnalyst, an insurance claims intelligence specialist.
Analyse the claims history and exposure for this risk.
Return JSON with: claims_frequency ("Low/Medium/High"), average_claim_size (estimated with currency), fraud_score (0-100, higher=more suspicious), ibnr_estimate (Incurred But Not Reported reserve, with currency), settlement_recommendation ("Pay/Investigate/Deny" with brief rationale).
For medical/motor risks in GCC, apply elevated fraud detection scrutiny.`,

  "IN-RE-001": `You are TreatyAnalyst, a reinsurance treaty specialist.
Analyse the reinsurance structure for this risk or portfolio.
Return JSON with: treaty_type ("Quota Share", "Excess of Loss", "Stop Loss", "Facultative", or combination), cession_rate (percentage as number), retention_level (with currency), reinstatement_terms (description), treaty_recommendation ("ACCEPT", "DECLINE", or "NEGOTIATE" with brief rationale).
Consider GCC reinsurance market conditions and Arab Re / regional capacity.`,

  "IN-RE-002": `You are CatastropheModeler, a catastrophe risk modelling specialist for the GCC region.
Model the catastrophe exposure for this risk or portfolio.
Return JSON with: cat_exposure ("Low/Medium/High/Extreme"), probable_maximum_loss (PML estimate with currency), return_period_losses (object: "1-in-100": "USD Xm", "1-in-250": "USD Xm"), cat_zones (array of exposed zones), reinsurance_need ("None/Facultative/Treaty CAT XL" with rationale).
GCC-specific perils: earthquake (UAE/Oman fault lines), flood (Saudi/Kuwait wadi flooding), windstorm (dust storms), terrorism.`,

  "IN-RE-003": `You are CessionOptimizer, a reinsurance programme optimisation specialist.
Optimise the reinsurance programme structure to balance risk transfer cost against net retained exposure.
Return JSON with: optimal_cession_rate (percentage as number), programme_cost (estimated annual premium with currency), net_retention (maximum net retained loss with currency), retrocession_need (boolean), optimization_score (0-100, higher=better optimised).
Target: net retention should not exceed 10% of capital for any single event.`,

  "IN-DM-001": `You are UnderwritingDecisionAgent, the final underwriting decision engine.
Synthesise all prior analysis to produce a clear underwriting recommendation.
Return JSON with: uw_decision (must be exactly "APPROVE", "REFER", or "DECLINE"), confidence_score (0-100), decision_rationale (2-3 sentences explaining the decision), conditions (array of specific conditions or endorsements required if APPROVE or REFER), key_questions (array of 3-5 questions the underwriter should clarify before binding).
APPROVE = acceptable risk at indicated premium. REFER = needs senior review or additional information. DECLINE = outside appetite or unacceptable risk.`,
};

// ── Core Agent Runner ──────────────────────────────────────────────────────────

async function runInsuranceAgent(
  agentId: string,
  blackboard: InsuranceBlackboard,
  userInput: string
): Promise<{ output: Partial<InsuranceBlackboard>; tokensUsed: number }> {
  const agent = getInsuranceAgentById(agentId);
  if (!agent) throw new Error(`Insurance agent ${agentId} not found`);

  const systemPrompt = AGENT_PROMPTS[agentId] || `You are ${agent.name}. ${agent.function}`;

  const contextSummary = Object.entries(blackboard)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const response = await invokeLLM({ // Insurance streaming: haiku for speed
    model: "claude-haiku-3-5",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `RISK SUBMISSION / INPUT:\n${userInput}\n\nCURRENT ANALYSIS CONTEXT:\n${contextSummary || "No prior context yet."}\n\nProvide your analysis as a JSON object only. No markdown, no explanation — pure JSON.`,
      },
    ],
    response_format: { type: "json_object" } as { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content ?? "{}";
  const tokensUsed = response.usage?.total_tokens ?? 0;

  let output: Partial<InsuranceBlackboard> = {};
  try {
    output = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    output = { decision_rationale: typeof content === "string" ? content : "Analysis complete" };
  }

  return { output, tokensUsed };
}

// ── Pipeline Runner ────────────────────────────────────────────────────────────

async function runPipeline(
  runType: string,
  userInput: string,
  onStep: StepCallback
): Promise<InsuranceBlackboard> {
  const chain = CHAIN_MAP[runType];
  if (!chain) throw new Error(`Unknown insurance run type: ${runType}`);

  const blackboard: InsuranceBlackboard = {};

  for (let i = 0; i < chain.length; i++) {
    const agentId = chain[i];
    const agent = getInsuranceAgentById(agentId)!;

    await onStep({
      type: "step_start",
      agentId,
      agentName: agent.name,
      stepIndex: i,
      totalSteps: chain.length,
    });

    const start = Date.now();
    try {
      const { output, tokensUsed } = await runInsuranceAgent(agentId, blackboard, userInput);
      Object.assign(blackboard, output);
      const durationMs = Date.now() - start;

      await onStep({
        type: "step_complete",
        agentId,
        agentName: agent.name,
        stepIndex: i,
        totalSteps: chain.length,
        output,
        blackboard: { ...blackboard },
        tokensUsed,
        durationMs,
      });
    } catch (err) {
      await onStep({
        type: "error",
        agentId,
        agentName: agent.name,
        stepIndex: i,
        totalSteps: chain.length,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  }

  await onStep({
    type: "complete",
    agentId: "complete",
    agentName: "Pipeline Complete",
    stepIndex: chain.length,
    totalSteps: chain.length,
    blackboard,
  });

  return blackboard;
}

// ── Public Exports ─────────────────────────────────────────────────────────────

export async function runUnderwritingEngine(
  userInput: string,
  onStep: StepCallback
): Promise<InsuranceBlackboard> {
  return runPipeline("underwriting", userInput, onStep);
}

export async function runTreatyAnalysis(
  userInput: string,
  onStep: StepCallback
): Promise<InsuranceBlackboard> {
  return runPipeline("treaty", userInput, onStep);
}

export async function runClaimsIntelligence(
  userInput: string,
  onStep: StepCallback
): Promise<InsuranceBlackboard> {
  return runPipeline("claims", userInput, onStep);
}

export async function runComplianceScan(
  userInput: string,
  onStep: StepCallback
): Promise<InsuranceBlackboard> {
  return runPipeline("compliance", userInput, onStep);
}

export async function runCatModel(
  userInput: string,
  onStep: StepCallback
): Promise<InsuranceBlackboard> {
  return runPipeline("cat_model", userInput, onStep);
}
