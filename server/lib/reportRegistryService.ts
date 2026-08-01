/**
 * Report Registry Service
 * Unified registry for all report types across the platform.
 * Pattern: DB → 5-min cache → hardcoded fallback → []
 */
import { getDb } from "../db";
import { reportRegistry, ReportRegistryEntry, InsertReportRegistryEntry } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface ReportRegistryRecord {
  reportTypeId: string;
  name: string;
  description?: string;
  category: string;
  outputFormat: string;
  templateSchema: Record<string, unknown>;
  requiredSections: string[];
  optionalSections: string[];
  brandingDefaults: Record<string, unknown>;
  industryTags: string[];
  generatorType: string;
  legacyGeneratorPath?: string;
  status: string;
}

const FALLBACK_REPORT_TYPES: ReportRegistryRecord[] = [
  {
    reportTypeId: "executive-brief",
    name: "Executive Decision Brief",
    description: "One-page executive summary of a decision with Council verdict and recommendation",
    category: "decision",
    outputFormat: "pdf",
    templateSchema: { sections: ["context", "council_verdict", "recommendation", "risk_summary"] },
    requiredSections: ["context", "council_verdict", "recommendation"],
    optionalSections: ["risk_summary", "financial_impact", "timeline"],
    brandingDefaults: { headerColor: "#1a1a2e", accentColor: "#c8a951" },
    industryTags: ["all"],
    generatorType: "template",
    status: "ACTIVE",
  },
  {
    reportTypeId: "board-report",
    name: "Board Decision Report",
    description: "Full board-level report with scenario analysis, risk register, and governance trail",
    category: "governance",
    outputFormat: "pdf",
    templateSchema: { sections: ["executive_summary", "decision_context", "scenario_analysis", "council_deliberation", "risk_register", "recommendation", "governance_trail"] },
    requiredSections: ["executive_summary", "decision_context", "council_deliberation", "recommendation"],
    optionalSections: ["scenario_analysis", "risk_register", "governance_trail", "appendices"],
    brandingDefaults: { headerColor: "#1a1a2e", accentColor: "#c8a951" },
    industryTags: ["all"],
    generatorType: "template",
    status: "ACTIVE",
  },
  {
    reportTypeId: "investment-memo",
    name: "Investment Memorandum",
    description: "Investment committee memo with financial analysis, risk assessment, and recommendation",
    category: "financial",
    outputFormat: "pdf",
    templateSchema: { sections: ["investment_thesis", "financial_analysis", "risk_assessment", "comparable_transactions", "recommendation"] },
    requiredSections: ["investment_thesis", "financial_analysis", "recommendation"],
    optionalSections: ["risk_assessment", "comparable_transactions", "sensitivity_analysis"],
    brandingDefaults: { headerColor: "#1a237e", accentColor: "#c8a951" },
    industryTags: ["financial-services", "banking", "investment"],
    generatorType: "template",
    legacyGeneratorPath: "server/lib/pdfGenerators/investmentMemo.ts",
    status: "ACTIVE",
  },
  {
    reportTypeId: "credit-memo",
    name: "Credit Memorandum",
    description: "Credit committee memo with borrower analysis, collateral assessment, and credit decision",
    category: "financial",
    outputFormat: "pdf",
    templateSchema: { sections: ["borrower_profile", "financial_analysis", "collateral_assessment", "risk_rating", "recommendation"] },
    requiredSections: ["borrower_profile", "financial_analysis", "risk_rating", "recommendation"],
    optionalSections: ["collateral_assessment", "covenant_structure", "comparable_credits"],
    brandingDefaults: { headerColor: "#1a237e", accentColor: "#c8a951" },
    industryTags: ["financial-services", "banking"],
    generatorType: "template",
    status: "ACTIVE",
  },
  {
    reportTypeId: "operational-review",
    name: "Operational Review Report",
    description: "Operations performance review with KPI dashboard, root cause analysis, and action plan",
    category: "operational",
    outputFormat: "pdf",
    templateSchema: { sections: ["kpi_dashboard", "performance_summary", "root_cause_analysis", "action_plan"] },
    requiredSections: ["kpi_dashboard", "performance_summary", "action_plan"],
    optionalSections: ["root_cause_analysis", "benchmarking", "forecast"],
    brandingDefaults: { headerColor: "#1e3a5f", accentColor: "#c8102e" },
    industryTags: ["manufacturing", "logistics", "e-commerce"],
    generatorType: "template",
    status: "ACTIVE",
  },
  {
    reportTypeId: "scenario-analysis",
    name: "Scenario Analysis Report",
    description: "Full scenario simulation report with stress tests, sensitivity analysis, and probability distributions",
    category: "analytical",
    outputFormat: "pdf",
    templateSchema: { sections: ["base_case", "stress_scenarios", "sensitivity_analysis", "probability_distribution", "recommendation"] },
    requiredSections: ["base_case", "stress_scenarios", "recommendation"],
    optionalSections: ["sensitivity_analysis", "probability_distribution", "monte_carlo"],
    brandingDefaults: { headerColor: "#1a1a2e", accentColor: "#c8a951" },
    industryTags: ["all"],
    generatorType: "template",
    status: "ACTIVE",
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: ReportRegistryRecord; expiresAt: number }>();

function fromRow(row: ReportRegistryEntry): ReportRegistryRecord {
  return {
    reportTypeId: row.reportTypeId,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    outputFormat: row.outputFormat,
    templateSchema: JSON.parse(row.templateSchema || "{}"),
    requiredSections: JSON.parse(row.requiredSections || "[]"),
    optionalSections: JSON.parse(row.optionalSections || "[]"),
    brandingDefaults: JSON.parse(row.brandingDefaults || "{}"),
    industryTags: JSON.parse(row.industryTags || "[]"),
    generatorType: row.generatorType,
    legacyGeneratorPath: row.legacyGeneratorPath ?? undefined,
    status: row.status,
  };
}

export async function getReportType(reportTypeId: string): Promise<ReportRegistryRecord | null> {
  const cacheKey = `rpt:${reportTypeId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(reportRegistry)
        .where(eq(reportRegistry.reportTypeId, reportTypeId))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[ReportRegistryService] DB error, falling back:", e);
    }
  }

  const fallback = FALLBACK_REPORT_TYPES.find(r => r.reportTypeId === reportTypeId) ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function listReportTypes(industryTag?: string): Promise<ReportRegistryRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(reportRegistry)
        .where(eq(reportRegistry.status, "ACTIVE"));
      if (rows.length > 0) {
        const all = rows.map(fromRow);
        return industryTag
          ? all.filter(r => r.industryTags.includes("all") || r.industryTags.includes(industryTag))
          : all;
      }
    } catch (e) {
      console.warn("[ReportRegistryService] DB error, falling back:", e);
    }
  }
  return industryTag
    ? FALLBACK_REPORT_TYPES.filter(r => r.industryTags.includes("all") || r.industryTags.includes(industryTag))
    : [...FALLBACK_REPORT_TYPES];
}

export async function createReportType(input: Omit<InsertReportRegistryEntry, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = Date.now();
  await db.insert(reportRegistry).values({
    ...input,
    templateSchema: JSON.stringify(input.templateSchema ?? {}),
    requiredSections: JSON.stringify(input.requiredSections ?? []),
    optionalSections: JSON.stringify(input.optionalSections ?? []),
    brandingDefaults: JSON.stringify(input.brandingDefaults ?? {}),
    industryTags: JSON.stringify(input.industryTags ?? []),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return true;
}

export function invalidateReportRegistryCache(): void {
  cache.clear();
}

export { FALLBACK_REPORT_TYPES };
