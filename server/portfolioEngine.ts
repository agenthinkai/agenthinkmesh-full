/**
 * Portfolio Intelligence Engine
 * Implements IC Decision, Crisis Simulation, and Guardian Mode pipelines
 * Uses the same blackboard pattern as multiAgentSolveSSE
 */

import { invokeLLM } from "./_core/llm";
import {
  IC_DECISION_CHAIN,
  CRISIS_SIMULATION_CHAIN,
  GUARDIAN_TRIGGER_CHAIN,
  getAgentById,
} from "../shared/portfolioAgents";

export interface PortfolioBlackboard {
  // Intake outputs
  fund_name?: string;
  strategy_summary?: string;
  sectors?: string[];
  geography?: string[];
  structure_type?: string;
  aum_estimate?: string;
  // Strategy
  fund_type?: string;
  investment_style?: string;
  stage_focus?: string;
  return_profile?: string;
  classification_confidence?: number;
  // Risk
  risk_score?: number;
  volatility_band?: string;
  max_drawdown_estimate?: string;
  concentration_risk?: string;
  risk_flags?: string[];
  // Exposure
  geo_exposure_map?: Record<string, number>;
  sector_exposure_map?: Record<string, number>;
  correlation_risk?: string;
  overexposure_alerts?: string[];
  diversification_score?: number;
  // Liquidity
  liquidity_score?: number;
  lockup_analysis?: string;
  redemption_risk?: string;
  cash_flow_stress?: string;
  liquidity_alerts?: string[];
  // Performance
  alpha_estimate?: number;
  beta_exposure?: number;
  macro_factor_contribution?: string;
  skill_score?: number;
  attribution_breakdown?: string;
  // Benchmark
  benchmark_selected?: string;
  relative_performance?: string;
  sharpe_ratio_estimate?: number;
  peer_percentile?: number;
  outperformance_score?: number;
  // Fees
  fee_structure?: string;
  fee_drag_estimate?: string;
  net_return_adjusted?: string;
  fee_fairness_score?: number;
  fee_flags?: string[];
  // Decision
  ic_decision?: "INVEST" | "WATCH" | "REJECT";
  confidence_score?: number;
  decision_rationale?: string;
  key_ic_questions?: string[];
  risk_reward_summary?: string;
  // Actions
  recommended_actions?: string[];
  priority_actions?: string[];
  hedge_suggestions?: string[];
  timeline?: string;
  action_confidence?: number;
  // Crisis
  worst_case_scenario?: string;
  portfolio_survival_analysis?: string;
  defensive_actions?: string[];
  // Guardian
  guardian_status?: "healthy" | "warning" | "critical";
  active_alerts?: string[];
  threat_level?: "low" | "medium" | "critical";
  // Meta
  [key: string]: unknown;
}

export interface PortfolioStepEvent {
  type: "step_start" | "step_complete" | "complete" | "error";
  agentId: string;
  agentName: string;
  stepIndex: number;
  totalSteps: number;
  output?: Partial<PortfolioBlackboard>;
  blackboard?: PortfolioBlackboard;
  tokensUsed?: number;
  durationMs?: number;
  error?: string;
}

type StepCallback = (event: PortfolioStepEvent) => void;

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  "PF-IN-001": `You are IntakeParser, a specialist AI agent for institutional portfolio analysis.
Parse the provided fund document/description and extract structured information.
Return a JSON object with: fund_name, strategy_summary, sectors (array), geography (array), structure_type, aum_estimate.
Be specific and factual. If information is not available, use reasonable estimates based on context.`,

  "PF-IN-002": `You are StrategyClassifier, an expert in fund classification.
Based on the parsed fund data, classify the fund type and investment style.
Return JSON with: fund_type (VC/PE/Hedge/Credit/RealEstate/MultiStrategy), investment_style, stage_focus, return_profile, classification_confidence (0-100).`,

  "PF-RS-001": `You are RiskModeler, an institutional risk analysis agent.
Build a comprehensive risk profile for this fund.
Return JSON with: risk_score (0-100, higher=riskier), volatility_band (Low/Medium/High/Very High), max_drawdown_estimate, concentration_risk (description), risk_flags (array of specific risk concerns).`,

  "PF-RS-002": `You are ExposureMapper, a portfolio exposure analysis specialist.
Map the geographic, sector, and asset class exposures.
Return JSON with: geo_exposure_map (object: region->percentage), sector_exposure_map (object: sector->percentage), correlation_risk, overexposure_alerts (array), diversification_score (0-100).`,

  "PF-RS-003": `You are LiquiditySentinel, a liquidity risk specialist.
Analyze liquidity risk, lockup periods, and redemption constraints.
Return JSON with: liquidity_score (0-100, higher=more liquid), lockup_analysis, redemption_risk, cash_flow_stress, liquidity_alerts (array).`,

  "PF-PA-001": `You are AlphaDecomposer, a performance attribution specialist.
Decompose returns into alpha, beta, and macro factor contributions.
Return JSON with: alpha_estimate (percentage), beta_exposure (0-2), macro_factor_contribution, skill_score (0-100), attribution_breakdown (narrative).`,

  "PF-PA-002": `You are BenchmarkComparator, a benchmark analysis agent.
Compare this fund against the most relevant benchmark indices.
Return JSON with: benchmark_selected, relative_performance, sharpe_ratio_estimate (number), peer_percentile (0-100), outperformance_score (0-100).`,

  "PF-PA-003": `You are FeeAnalyzer, a fee structure analysis specialist.
Evaluate the fee structure and its drag on net returns.
Return JSON with: fee_structure, fee_drag_estimate, net_return_adjusted, fee_fairness_score (0-100), fee_flags (array).`,

  "PF-DM-001": `You are ICDecisionAgent, the final investment committee decision engine.
Based on all prior analysis, output a clear IC recommendation.
Return JSON with: ic_decision (must be exactly "INVEST", "WATCH", or "REJECT"), confidence_score (0-100), decision_rationale (2-3 sentences), key_ic_questions (array of 3-5 questions the IC should ask), risk_reward_summary.`,

  "PF-DM-002": `You are ActionRecommender, a portfolio action specialist.
Based on the analysis and IC decision, recommend specific portfolio actions.
Return JSON with: recommended_actions (array), priority_actions (array of top 3), hedge_suggestions (array), timeline (e.g., "Immediate / 30 days / 90 days"), action_confidence (0-100).`,

  "PF-DM-003": `You are DriftDetector, a mandate drift analysis agent.
Detect any style drift, mandate drift, or strategy deviation.
Return JSON with: drift_detected (boolean), drift_type, drift_severity (Low/Medium/High), drift_description, drift_alerts (array).`,

  "PF-DM-004": `You are PortfolioGuardian, the always-on monitoring engine.
Analyze the portfolio for threshold breaches and emerging risks.
Return JSON with: guardian_status ("healthy", "warning", or "critical"), active_alerts (array), triggered_workflows (array), last_scan_time (ISO string), threat_level ("low", "medium", or "critical").`,
};

async function runPortfolioAgent(
  agentId: string,
  blackboard: PortfolioBlackboard,
  userInput: string
): Promise<{ output: Partial<PortfolioBlackboard>; tokensUsed: number }> {
  const agent = getAgentById(agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  const systemPrompt = AGENT_SYSTEM_PROMPTS[agentId] || `You are ${agent.name}. ${agent.function}`;

  const contextSummary = Object.entries(blackboard)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `PORTFOLIO INPUT:\n${userInput}\n\nCURRENT ANALYSIS CONTEXT:\n${contextSummary || "No prior context yet."}\n\nProvide your analysis as a JSON object only. No markdown, no explanation — pure JSON.`,
      },
    ],
    response_format: { type: "json_object" } as { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content ?? "{}";
  const tokensUsed = response.usage?.total_tokens ?? 0;

  let output: Partial<PortfolioBlackboard> = {};
  try {
    output = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    output = { strategy_summary: typeof content === "string" ? content : "Analysis complete" };
  }

  return { output, tokensUsed };
}

export async function runICDecisionEngine(
  userInput: string,
  onStep: StepCallback
): Promise<PortfolioBlackboard> {
  const blackboard: PortfolioBlackboard = {};
  const chain = IC_DECISION_CHAIN;

  for (let i = 0; i < chain.length; i++) {
    const agentId = chain[i];
    const agent = getAgentById(agentId)!;

    onStep({
      type: "step_start",
      agentId,
      agentName: agent.name,
      stepIndex: i,
      totalSteps: chain.length,
    });

    const start = Date.now();
    try {
      const { output, tokensUsed } = await runPortfolioAgent(agentId, blackboard, userInput);
      Object.assign(blackboard, output);
      const durationMs = Date.now() - start;

      onStep({
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
      onStep({
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

  onStep({
    type: "complete",
    agentId: "complete",
    agentName: "Pipeline Complete",
    stepIndex: chain.length,
    totalSteps: chain.length,
    blackboard,
  });

  return blackboard;
}

export async function runCrisisSimulation(
  userInput: string,
  onStep: StepCallback
): Promise<PortfolioBlackboard> {
  const blackboard: PortfolioBlackboard = {};
  const chain = CRISIS_SIMULATION_CHAIN;

  // Inject crisis scenario context
  const crisisInput = `CRISIS SIMULATION MODE - Analyze worst-case scenarios:\n${userInput}\n\nAssume: Global recession, 40% market drawdown, liquidity crisis, credit freeze.`;

  for (let i = 0; i < chain.length; i++) {
    const agentId = chain[i];
    const agent = getAgentById(agentId)!;

    onStep({
      type: "step_start",
      agentId,
      agentName: agent.name,
      stepIndex: i,
      totalSteps: chain.length,
    });

    const start = Date.now();
    try {
      const { output, tokensUsed } = await runPortfolioAgent(agentId, blackboard, crisisInput);
      Object.assign(blackboard, output);
      const durationMs = Date.now() - start;

      onStep({
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
      onStep({
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

  // Synthesize crisis-specific outputs
  if (!blackboard.worst_case_scenario) {
    blackboard.worst_case_scenario = `Based on analysis: ${blackboard.risk_score && blackboard.risk_score > 70 ? "HIGH RISK" : "MODERATE RISK"} portfolio under crisis conditions. Estimated drawdown: ${blackboard.max_drawdown_estimate || "30-50%"}.`;
  }
  if (!blackboard.portfolio_survival_analysis) {
    blackboard.portfolio_survival_analysis = `Liquidity score ${blackboard.liquidity_score || 50}/100. ${(blackboard.liquidity_score || 50) > 60 ? "Portfolio can survive 12+ months of stress." : "Liquidity constraints may force early exits within 6 months."}`;
  }
  if (!blackboard.defensive_actions) {
    blackboard.defensive_actions = blackboard.recommended_actions || ["Increase cash allocation", "Reduce illiquid positions", "Add downside hedges"];
  }

  onStep({
    type: "complete",
    agentId: "complete",
    agentName: "Crisis Analysis Complete",
    stepIndex: chain.length,
    totalSteps: chain.length,
    blackboard,
  });

  return blackboard;
}

export async function runGuardianScan(
  portfolioContext: string,
  onStep: StepCallback
): Promise<PortfolioBlackboard> {
  const blackboard: PortfolioBlackboard = {};
  const chain = GUARDIAN_TRIGGER_CHAIN;

  const guardianInput = `GUARDIAN MODE SCAN - Continuous monitoring check:\n${portfolioContext}\n\nCheck all thresholds: concentration >25%, liquidity stress, geo overexposure, performance deviation >15%.`;

  for (let i = 0; i < chain.length; i++) {
    const agentId = chain[i];
    const agent = getAgentById(agentId)!;

    onStep({
      type: "step_start",
      agentId,
      agentName: agent.name,
      stepIndex: i,
      totalSteps: chain.length,
    });

    const start = Date.now();
    try {
      const { output, tokensUsed } = await runPortfolioAgent(agentId, blackboard, guardianInput);
      Object.assign(blackboard, output);
      const durationMs = Date.now() - start;

      onStep({
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
      onStep({
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

  // Determine guardian status from outputs
  const riskScore = blackboard.risk_score || 0;
  const liquidityScore = blackboard.liquidity_score || 100;
  const alerts = [...(blackboard.overexposure_alerts || []), ...(blackboard.liquidity_alerts || []), ...(blackboard.risk_flags || [])];

  blackboard.guardian_status =
    riskScore > 75 || liquidityScore < 30 || alerts.length > 3 ? "critical" :
    riskScore > 55 || liquidityScore < 60 || alerts.length > 1 ? "warning" : "healthy";

  blackboard.threat_level =
    blackboard.guardian_status === "critical" ? "critical" :
    blackboard.guardian_status === "warning" ? "medium" : "low";

  blackboard.active_alerts = alerts;

  onStep({
    type: "complete",
    agentId: "complete",
    agentName: "Guardian Scan Complete",
    stepIndex: chain.length,
    totalSteps: chain.length,
    blackboard,
  });

  return blackboard;
}
