// Portfolio Intelligence Engine — Agent Registry
// 12 agents across 4 clusters

export type AgentStatus = "active" | "standby" | "running" | "idle";

export interface PortfolioAgent {
  id: string;
  name: string;
  cluster: "intake" | "risk" | "performance" | "decision";
  clusterLabel: string;
  function: string;
  inputs: string[];
  outputs: string[];
  avgLatencyMs: number;
  status: AgentStatus;
  confidenceScore: number; // baseline confidence 0-100
  icon: string;
}

export const PORTFOLIO_AGENTS: PortfolioAgent[] = [
  // ── CLUSTER 1: INTAKE & STRATEGY ──────────────────────────────────────────
  {
    id: "PF-IN-001",
    name: "IntakeParser",
    cluster: "intake",
    clusterLabel: "Intake & Strategy",
    function: "Parses uploaded PDFs and text, extracts fund strategy, sectors, geography, and structure",
    inputs: ["raw_document", "file_url"],
    outputs: ["fund_name", "strategy_summary", "sectors", "geography", "structure_type", "aum_estimate"],
    avgLatencyMs: 4200,
    status: "active",
    confidenceScore: 91,
    icon: "📄",
  },
  {
    id: "PF-IN-002",
    name: "StrategyClassifier",
    cluster: "intake",
    clusterLabel: "Intake & Strategy",
    function: "Identifies fund type (VC, PE, hedge, credit, real estate) and investment style",
    inputs: ["strategy_summary", "sectors", "structure_type"],
    outputs: ["fund_type", "investment_style", "stage_focus", "return_profile", "classification_confidence"],
    avgLatencyMs: 2800,
    status: "active",
    confidenceScore: 88,
    icon: "🏷️",
  },

  // ── CLUSTER 2: RISK & EXPOSURE ─────────────────────────────────────────────
  {
    id: "PF-RS-001",
    name: "RiskModeler",
    cluster: "risk",
    clusterLabel: "Risk & Exposure",
    function: "Builds comprehensive risk profile including volatility, drawdown, and concentration metrics",
    inputs: ["fund_type", "sectors", "geography", "aum_estimate", "strategy_summary"],
    outputs: ["risk_score", "volatility_band", "max_drawdown_estimate", "concentration_risk", "risk_flags"],
    avgLatencyMs: 5600,
    status: "active",
    confidenceScore: 85,
    icon: "⚠️",
  },
  {
    id: "PF-RS-002",
    name: "ExposureMapper",
    cluster: "risk",
    clusterLabel: "Risk & Exposure",
    function: "Maps geographic, sector, and asset class exposure with correlation analysis",
    inputs: ["sectors", "geography", "fund_type", "risk_flags"],
    outputs: ["geo_exposure_map", "sector_exposure_map", "correlation_risk", "overexposure_alerts", "diversification_score"],
    avgLatencyMs: 4100,
    status: "active",
    confidenceScore: 87,
    icon: "🗺️",
  },
  {
    id: "PF-RS-003",
    name: "LiquiditySentinel",
    cluster: "risk",
    clusterLabel: "Risk & Exposure",
    function: "Detects liquidity risk, lockup periods, redemption constraints, and cash flow stress",
    inputs: ["fund_type", "structure_type", "strategy_summary", "risk_score"],
    outputs: ["liquidity_score", "lockup_analysis", "redemption_risk", "cash_flow_stress", "liquidity_alerts"],
    avgLatencyMs: 3300,
    status: "active",
    confidenceScore: 83,
    icon: "💧",
  },

  // ── CLUSTER 3: PERFORMANCE & ATTRIBUTION ──────────────────────────────────
  {
    id: "PF-PA-001",
    name: "AlphaDecomposer",
    cluster: "performance",
    clusterLabel: "Performance & Attribution",
    function: "Breaks down returns into alpha vs beta vs external macro factors",
    inputs: ["fund_type", "investment_style", "return_profile", "risk_score", "sectors"],
    outputs: ["alpha_estimate", "beta_exposure", "macro_factor_contribution", "skill_score", "attribution_breakdown"],
    avgLatencyMs: 6200,
    status: "active",
    confidenceScore: 79,
    icon: "📊",
  },
  {
    id: "PF-PA-002",
    name: "BenchmarkComparator",
    cluster: "performance",
    clusterLabel: "Performance & Attribution",
    function: "Compares fund against relevant benchmarks and peer group indices",
    inputs: ["fund_type", "geography", "investment_style", "alpha_estimate", "beta_exposure"],
    outputs: ["benchmark_selected", "relative_performance", "sharpe_ratio_estimate", "peer_percentile", "outperformance_score"],
    avgLatencyMs: 3800,
    status: "active",
    confidenceScore: 82,
    icon: "📈",
  },
  {
    id: "PF-PA-003",
    name: "FeeAnalyzer",
    cluster: "performance",
    clusterLabel: "Performance & Attribution",
    function: "Evaluates management and performance fee drag relative to net returns",
    inputs: ["fund_type", "strategy_summary", "alpha_estimate", "relative_performance"],
    outputs: ["fee_structure", "fee_drag_estimate", "net_return_adjusted", "fee_fairness_score", "fee_flags"],
    avgLatencyMs: 2400,
    status: "active",
    confidenceScore: 86,
    icon: "💰",
  },

  // ── CLUSTER 4: DECISION & MONITORING ──────────────────────────────────────
  {
    id: "PF-DM-001",
    name: "ICDecisionAgent",
    cluster: "decision",
    clusterLabel: "Decision & Monitoring",
    function: "Outputs final IC recommendation: INVEST / WATCH / REJECT with confidence score and rationale",
    inputs: ["risk_score", "alpha_estimate", "relative_performance", "fee_drag_estimate", "liquidity_score", "concentration_risk"],
    outputs: ["ic_decision", "confidence_score", "decision_rationale", "key_ic_questions", "risk_reward_summary"],
    avgLatencyMs: 7100,
    status: "active",
    confidenceScore: 90,
    icon: "⚖️",
  },
  {
    id: "PF-DM-002",
    name: "ActionRecommender",
    cluster: "decision",
    clusterLabel: "Decision & Monitoring",
    function: "Suggests specific portfolio actions: rebalance, hedge, increase allocation, reduce, exit",
    inputs: ["ic_decision", "risk_flags", "overexposure_alerts", "liquidity_alerts", "concentration_risk"],
    outputs: ["recommended_actions", "priority_actions", "hedge_suggestions", "timeline", "action_confidence"],
    avgLatencyMs: 4500,
    status: "active",
    confidenceScore: 84,
    icon: "🎯",
  },
  {
    id: "PF-DM-003",
    name: "DriftDetector",
    cluster: "decision",
    clusterLabel: "Decision & Monitoring",
    function: "Detects mandate drift, style drift, and strategy deviation over time",
    inputs: ["fund_type", "investment_style", "sectors", "strategy_summary", "classification_confidence"],
    outputs: ["drift_detected", "drift_type", "drift_severity", "drift_description", "drift_alerts"],
    avgLatencyMs: 3900,
    status: "standby",
    confidenceScore: 81,
    icon: "🧭",
  },
  {
    id: "PF-DM-004",
    name: "PortfolioGuardian",
    cluster: "decision",
    clusterLabel: "Decision & Monitoring",
    function: "Always-on monitoring engine: watches concentration, liquidity, geo-exposure, and market signals. Triggers sub-workflows when thresholds are breached.",
    inputs: ["risk_score", "concentration_risk", "liquidity_score", "geo_exposure_map", "overexposure_alerts"],
    outputs: ["guardian_status", "active_alerts", "triggered_workflows", "last_scan_time", "threat_level"],
    avgLatencyMs: 1800,
    status: "standby",
    confidenceScore: 93,
    icon: "🛡️",
  },
];

// Workflow definitions
export const IC_DECISION_CHAIN = [
  "PF-IN-001", "PF-IN-002", "PF-RS-001", "PF-RS-002",
  "PF-PA-001", "PF-PA-002", "PF-DM-001", "PF-DM-002",
];

export const GUARDIAN_TRIGGER_CHAIN = ["PF-RS-001", "PF-RS-002", "PF-DM-002"];

export const CRISIS_SIMULATION_CHAIN = ["PF-RS-001", "PF-RS-002", "PF-PA-001", "PF-DM-002"];

export const getAgentById = (id: string) => PORTFOLIO_AGENTS.find(a => a.id === id);
export const getAgentsByCluster = (cluster: PortfolioAgent["cluster"]) =>
  PORTFOLIO_AGENTS.filter(a => a.cluster === cluster);
