/**
 * Decision Type Service
 * 10 pre-registered decision types covering GCC enterprise decisions.
 * Pattern: DB → 5-min cache → hardcoded fallback → null
 */
import { getDb } from "../db";
import { decisionTypes, DecisionType, InsertDecisionType } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface DecisionTypeRecord {
  decisionTypeId: string;
  name: string;
  category: string;
  description?: string;
  defaultCouncilPersonaSetId?: string;
  defaultKpiSetId?: string;
  defaultSimulationMode: string;
  evaluationFramework: Record<string, unknown>;
  requiredInputFields: string[];
  outputSchema: Record<string, unknown>;
  industryTags: string[];
  status: string;
}

const FALLBACK_DECISION_TYPES: DecisionTypeRecord[] = [
  {
    decisionTypeId: "capital-allocation",
    name: "Capital Allocation",
    category: "Financial",
    description: "Decisions about deploying capital across competing investment opportunities",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["ROI", "risk", "strategic_fit", "payback_period"], horizon: "5-10 years" },
    requiredInputFields: ["investment_amount", "expected_return", "risk_profile", "strategic_rationale"],
    outputSchema: { verdict: "string", roi_estimate: "number", risk_score: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "expansion",
    name: "Geographic or Product Expansion",
    category: "Strategic",
    description: "Decisions about entering new markets, geographies, or product categories",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["market_size", "competitive_intensity", "regulatory_risk", "operational_readiness"], horizon: "3-7 years" },
    requiredInputFields: ["target_market", "investment_required", "competitive_landscape", "regulatory_environment"],
    outputSchema: { verdict: "string", market_attractiveness: "number", execution_risk: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "acquisition",
    name: "Merger & Acquisition",
    category: "Corporate",
    description: "Decisions about acquiring, merging with, or divesting business units",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["valuation", "synergies", "integration_risk", "regulatory_approval"], horizon: "2-5 years" },
    requiredInputFields: ["target_company", "deal_value", "synergy_estimate", "integration_plan"],
    outputSchema: { verdict: "string", fair_value_estimate: "number", synergy_confidence: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "procurement",
    name: "Strategic Procurement",
    category: "Operational",
    description: "Decisions about major vendor selection, technology procurement, or outsourcing",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["total_cost", "vendor_risk", "strategic_fit", "sovereignty_compliance"], horizon: "3-10 years" },
    requiredInputFields: ["procurement_category", "budget", "vendor_shortlist", "requirements"],
    outputSchema: { verdict: "string", recommended_vendor: "string", total_cost_estimate: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "transformation",
    name: "Digital or Operational Transformation",
    category: "Strategic",
    description: "Decisions about major transformation programmes — digital, operational, or cultural",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["change_readiness", "technology_fit", "roi", "risk"], horizon: "3-5 years" },
    requiredInputFields: ["transformation_scope", "investment", "timeline", "change_management_plan"],
    outputSchema: { verdict: "string", readiness_score: "number", roi_estimate: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "investment",
    name: "Investment Decision",
    category: "Financial",
    description: "Decisions about portfolio investments, fund allocation, or asset management",
    defaultCouncilPersonaSetId: "banking",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["expected_return", "risk_adjusted_return", "liquidity", "sharia_compliance"], horizon: "1-10 years" },
    requiredInputFields: ["asset_class", "investment_amount", "expected_return", "risk_tolerance"],
    outputSchema: { verdict: "string", expected_irr: "number", risk_rating: "string", recommendation: "string" },
    industryTags: ["financial-services", "banking", "investment"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "credit",
    name: "Credit Decision",
    category: "Financial",
    description: "Decisions about loan approvals, credit limits, or debt restructuring",
    defaultCouncilPersonaSetId: "banking",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["creditworthiness", "collateral", "cash_flow", "regulatory_capital"], horizon: "1-7 years" },
    requiredInputFields: ["borrower_profile", "loan_amount", "purpose", "collateral"],
    outputSchema: { verdict: "string", credit_score: "number", recommended_rate: "number", recommendation: "string" },
    industryTags: ["financial-services", "banking"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "risk",
    name: "Risk Assessment",
    category: "Risk Management",
    description: "Decisions about risk appetite, risk mitigation, or risk transfer",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["probability", "impact", "velocity", "controllability"], horizon: "1-3 years" },
    requiredInputFields: ["risk_category", "risk_description", "current_controls", "risk_appetite"],
    outputSchema: { verdict: "string", risk_score: "number", residual_risk: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "supply-chain",
    name: "Supply Chain Decision",
    category: "Operational",
    description: "Decisions about supply chain structure, sourcing, or logistics strategy",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["cost", "resilience", "lead_time", "sustainability"], horizon: "2-5 years" },
    requiredInputFields: ["supply_chain_scope", "current_cost", "resilience_requirements", "sustainability_targets"],
    outputSchema: { verdict: "string", cost_impact: "number", resilience_score: "number", recommendation: "string" },
    industryTags: ["manufacturing", "retail", "logistics", "e-commerce"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "regulatory-compliance",
    name: "Regulatory Compliance Decision",
    category: "Compliance",
    description: "Decisions about regulatory strategy, compliance investment, or regulatory engagement",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["compliance_gap", "penalty_risk", "remediation_cost", "reputational_risk"], horizon: "1-3 years" },
    requiredInputFields: ["regulatory_requirement", "current_compliance_level", "remediation_options", "deadline"],
    outputSchema: { verdict: "string", compliance_score: "number", penalty_risk_estimate: "number", recommendation: "string" },
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "talent-acquisition",
    name: "Talent Acquisition & Hiring",
    category: "People",
    description: "Decisions about hiring key roles, compensation structures, and talent sourcing strategy",
    defaultCouncilPersonaSetId: "ai_company",
    defaultKpiSetId: "ai_company",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["role_criticality", "compensation_market_rate", "runway_impact", "culture_fit", "time_to_hire"], horizon: "1-2 years" },
    requiredInputFields: ["role_title", "compensation_range", "headcount_budget", "strategic_rationale", "alternatives_considered"],
    outputSchema: { verdict: "string", hire_recommendation: "string", compensation_assessment: "string", runway_impact_months: "number" },
    industryTags: ["ai_company", "all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "partnership",
    name: "Strategic Partnership",
    category: "Strategic",
    description: "Decisions about forming, structuring, or exiting strategic partnerships, alliances, or joint ventures",
    defaultCouncilPersonaSetId: "ai_company",
    defaultKpiSetId: "ai_company",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["strategic_fit", "revenue_potential", "exclusivity_risk", "integration_complexity", "exit_optionality"], horizon: "2-5 years" },
    requiredInputFields: ["partner_name", "partnership_structure", "revenue_share", "exclusivity_terms", "exit_conditions"],
    outputSchema: { verdict: "string", strategic_value_score: "number", risk_score: "number", recommendation: "string" },
    industryTags: ["ai_company", "all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "pricing-strategy",
    name: "Pricing Strategy",
    category: "Commercial",
    description: "Decisions about pricing models, price changes, discounting policies, and packaging",
    defaultCouncilPersonaSetId: "ai_company",
    defaultKpiSetId: "ai_company",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["willingness_to_pay", "competitive_positioning", "arr_impact", "churn_risk", "cac_payback"], horizon: "1-3 years" },
    requiredInputFields: ["current_pricing", "proposed_pricing", "customer_segments", "competitive_benchmarks", "revenue_model"],
    outputSchema: { verdict: "string", arr_impact_estimate: "number", churn_risk_score: "number", recommendation: "string" },
    industryTags: ["ai_company", "all"],
    status: "ACTIVE",
  },
  {
    decisionTypeId: "model-deployment",
    name: "AI Model Deployment",
    category: "Technical",
    description: "Decisions about deploying, updating, or retiring AI models in production",
    defaultCouncilPersonaSetId: "ai_company",
    defaultKpiSetId: "ai_company",
    defaultSimulationMode: "institutional",
    evaluationFramework: { dimensions: ["model_accuracy", "inference_cost", "latency", "safety_evaluation", "rollback_plan", "customer_impact"], horizon: "6-18 months" },
    requiredInputFields: ["model_name", "benchmark_results", "inference_cost_estimate", "deployment_plan", "rollback_procedure", "safety_evaluation"],
    outputSchema: { verdict: "string", readiness_score: "number", risk_flags: "string[]", recommendation: "string" },
    industryTags: ["ai_company"],
    status: "ACTIVE",
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: DecisionTypeRecord; expiresAt: number }>();

function fromRow(row: DecisionType): DecisionTypeRecord {
  return {
    decisionTypeId: row.decisionTypeId,
    name: row.name,
    category: row.category,
    description: row.description ?? undefined,
    defaultCouncilPersonaSetId: row.defaultCouncilPersonaSetId ?? undefined,
    defaultKpiSetId: row.defaultKpiSetId ?? undefined,
    defaultSimulationMode: row.defaultSimulationMode,
    evaluationFramework: JSON.parse(row.evaluationFramework || "{}"),
    requiredInputFields: JSON.parse(row.requiredInputFields || "[]"),
    outputSchema: JSON.parse(row.outputSchema || "{}"),
    industryTags: JSON.parse(row.industryTags || "[]"),
    status: row.status,
  };
}

export async function getDecisionType(decisionTypeId: string): Promise<DecisionTypeRecord | null> {
  const cacheKey = `dt:${decisionTypeId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(decisionTypes)
        .where(and(eq(decisionTypes.decisionTypeId, decisionTypeId), eq(decisionTypes.status, "ACTIVE")))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[DecisionTypeService] DB error, falling back:", e);
    }
  }

  const fallback = FALLBACK_DECISION_TYPES.find(d => d.decisionTypeId === decisionTypeId) ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function listDecisionTypes(industryTag?: string): Promise<DecisionTypeRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(decisionTypes)
        .where(eq(decisionTypes.status, "ACTIVE"));
      if (rows.length > 0) {
        const all = rows.map(fromRow);
        return industryTag
          ? all.filter(d => d.industryTags.includes("all") || d.industryTags.includes(industryTag))
          : all;
      }
    } catch (e) {
      console.warn("[DecisionTypeService] DB error, falling back:", e);
    }
  }

  return industryTag
    ? FALLBACK_DECISION_TYPES.filter(d => d.industryTags.includes("all") || d.industryTags.includes(industryTag))
    : [...FALLBACK_DECISION_TYPES];
}

export async function createDecisionType(input: Omit<InsertDecisionType, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = Date.now();
  await db.insert(decisionTypes).values({
    ...input,
    evaluationFramework: JSON.stringify(input.evaluationFramework ?? {}),
    requiredInputFields: JSON.stringify(input.requiredInputFields ?? []),
    outputSchema: JSON.stringify(input.outputSchema ?? {}),
    industryTags: JSON.stringify(input.industryTags ?? []),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return true;
}

export function invalidateDecisionTypeCache(): void {
  cache.clear();
}

export { FALLBACK_DECISION_TYPES };
