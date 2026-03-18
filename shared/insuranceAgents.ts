/**
 * Insurance & Reinsurance Intelligence Engine
 * Agent Registry — 10 specialist agents across 4 clusters
 * Covers both direct insurance and reinsurance (GCC / Takaful focus)
 */

export interface InsuranceAgent {
  id: string;
  name: string;
  cluster: "intake" | "underwriting" | "reinsurance" | "decision";
  function: string;
  icon: string;
  outputFields: string[];
}

export const INSURANCE_AGENTS: InsuranceAgent[] = [
  // ── Intake Cluster ──────────────────────────────────────────────────────────
  {
    id: "IN-IN-001",
    name: "RiskIntakeParser",
    cluster: "intake",
    function: "Parses risk submissions, policy documents, and reinsurance slips to extract structured data",
    icon: "📄",
    outputFields: ["insured_name", "risk_class", "sum_insured", "coverage_type", "policy_period", "territory"],
  },
  {
    id: "IN-IN-002",
    name: "TakafulClassifier",
    cluster: "intake",
    function: "Classifies the risk as conventional or Takaful, identifies Shariah compliance requirements",
    icon: "☪️",
    outputFields: ["product_type", "takaful_model", "shariah_requirements", "wakala_fee", "surplus_distribution"],
  },

  // ── Underwriting Cluster ────────────────────────────────────────────────────
  {
    id: "IN-UW-001",
    name: "RiskModeler",
    cluster: "underwriting",
    function: "Models the risk exposure, estimates loss frequency and severity, calculates technical premium",
    icon: "⚡",
    outputFields: ["risk_score", "loss_ratio_estimate", "technical_premium", "risk_factors", "risk_flags"],
  },
  {
    id: "IN-UW-002",
    name: "ShariaComplianceAgent",
    cluster: "underwriting",
    function: "Checks for gharar (uncertainty), riba (interest), maysir (gambling) and non-halal investments",
    icon: "⚖️",
    outputFields: ["takaful_compliant", "compliance_issues", "gharar_level", "riba_exposure", "compliance_score"],
  },
  {
    id: "IN-UW-003",
    name: "PricingActuary",
    cluster: "underwriting",
    function: "Calculates risk-adjusted premium, loading factors, deductibles, and net premium indication",
    icon: "🧮",
    outputFields: ["gross_premium", "net_premium", "loading_factor", "deductible_recommendation", "premium_indication"],
  },
  {
    id: "IN-UW-004",
    name: "ClaimsAnalyst",
    cluster: "underwriting",
    function: "Analyses claims history, detects fraud signals, estimates IBNR reserves, and recommends settlement",
    icon: "🔍",
    outputFields: ["claims_frequency", "average_claim_size", "fraud_score", "ibnr_estimate", "settlement_recommendation"],
  },

  // ── Reinsurance Cluster ─────────────────────────────────────────────────────
  {
    id: "IN-RE-001",
    name: "TreatyAnalyst",
    cluster: "reinsurance",
    function: "Analyses reinsurance treaty terms, quota share vs excess of loss structures, and cession rates",
    icon: "📋",
    outputFields: ["treaty_type", "cession_rate", "retention_level", "reinstatement_terms", "treaty_recommendation"],
  },
  {
    id: "IN-RE-002",
    name: "CatastropheModeler",
    cluster: "reinsurance",
    function: "Models catastrophe exposure (earthquake, flood, windstorm) using GCC-specific hazard data",
    icon: "🌪️",
    outputFields: ["cat_exposure", "probable_maximum_loss", "return_period_losses", "cat_zones", "reinsurance_need"],
  },
  {
    id: "IN-RE-003",
    name: "CessionOptimizer",
    cluster: "reinsurance",
    function: "Optimizes the reinsurance programme structure to minimize net retained risk at target cost",
    icon: "📊",
    outputFields: ["optimal_cession_rate", "programme_cost", "net_retention", "retrocession_need", "optimization_score"],
  },

  // ── Decision Cluster ────────────────────────────────────────────────────────
  {
    id: "IN-DM-001",
    name: "UnderwritingDecisionAgent",
    cluster: "decision",
    function: "Synthesizes all analysis to produce APPROVE / REFER / DECLINE with confidence score and rationale",
    icon: "🎯",
    outputFields: ["uw_decision", "confidence_score", "decision_rationale", "conditions", "key_questions"],
  },
];

// ── Workflow Chain Definitions ─────────────────────────────────────────────────

/**
 * Underwriting Decision Engine — 7 agents
 * Intake → Takaful → Risk → Shariah → Pricing → Claims → Decision
 */
export const UNDERWRITING_CHAIN = [
  "IN-IN-001",
  "IN-IN-002",
  "IN-UW-001",
  "IN-UW-002",
  "IN-UW-003",
  "IN-UW-004",
  "IN-DM-001",
];

/**
 * Treaty Analysis Engine — 5 agents
 * Intake → Risk → Treaty → CAT Model → Cession Optimizer
 */
export const TREATY_CHAIN = [
  "IN-IN-001",
  "IN-UW-001",
  "IN-RE-001",
  "IN-RE-002",
  "IN-RE-003",
];

/**
 * Claims Intelligence — 4 agents
 * Intake → Risk → Claims → Decision
 */
export const CLAIMS_CHAIN = [
  "IN-IN-001",
  "IN-UW-001",
  "IN-UW-004",
  "IN-DM-001",
];

/**
 * Takaful Compliance Scan — 3 agents
 * Intake → Takaful Classifier → Shariah Compliance
 */
export const COMPLIANCE_CHAIN = [
  "IN-IN-001",
  "IN-IN-002",
  "IN-UW-002",
];

/**
 * CAT Model — 4 agents
 * Intake → Risk → CAT Model → Cession Optimizer
 */
export const CAT_MODEL_CHAIN = [
  "IN-IN-001",
  "IN-UW-001",
  "IN-RE-002",
  "IN-RE-003",
];

export function getInsuranceAgentById(id: string): InsuranceAgent | undefined {
  return INSURANCE_AGENTS.find(a => a.id === id);
}

export const CHAIN_MAP: Record<string, string[]> = {
  underwriting: UNDERWRITING_CHAIN,
  treaty: TREATY_CHAIN,
  claims: CLAIMS_CHAIN,
  compliance: COMPLIANCE_CHAIN,
  cat_model: CAT_MODEL_CHAIN,
};
