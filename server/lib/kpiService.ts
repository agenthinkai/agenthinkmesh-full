/**
 * KPI Definition Service
 * Industry-specific KPI sets for calibration and evaluation.
 * Pattern: DB → 5-min cache → hardcoded fallback → []
 */
import { getDb } from "../db";
import { kpiDefinitions, KpiDefinition, InsertKpiDefinition } from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

export interface KpiRecord {
  kpiId: string;
  kpiSetId: string;
  industryTag: string;
  name: string;
  label: string;
  unit?: string;
  direction: "higher" | "lower" | "target";
  threshold: { good: number; warning: number; critical: number };
  benchmarkSource?: string;
  description?: string;
  formula?: string;
  category?: string;
  sortOrder: number;
  status: string;
}

const FALLBACK_KPI_SETS: Record<string, KpiRecord[]> = {
  "banking": [
    { kpiId: "bank-nim", kpiSetId: "banking", industryTag: "banking", name: "Net Interest Margin", label: "NIM", unit: "%", direction: "higher", threshold: { good: 3.5, warning: 2.5, critical: 1.5 }, benchmarkSource: "CBK Annual Report 2023", category: "Profitability", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "bank-roe", kpiSetId: "banking", industryTag: "banking", name: "Return on Equity", label: "ROE", unit: "%", direction: "higher", threshold: { good: 15, warning: 10, critical: 5 }, benchmarkSource: "GCC Banking Sector Report 2023", category: "Profitability", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "bank-npl", kpiSetId: "banking", industryTag: "banking", name: "Non-Performing Loan Ratio", label: "NPL", unit: "%", direction: "lower", threshold: { good: 2, warning: 4, critical: 7 }, benchmarkSource: "CBK Supervisory Report 2023", category: "Asset Quality", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "bank-car", kpiSetId: "banking", industryTag: "banking", name: "Capital Adequacy Ratio", label: "CAR", unit: "%", direction: "higher", threshold: { good: 16, warning: 13, critical: 10.5 }, benchmarkSource: "Basel III / CBK Circular 2/2022", category: "Capital", sortOrder: 3, status: "ACTIVE" },
    { kpiId: "bank-cir", kpiSetId: "banking", industryTag: "banking", name: "Cost-to-Income Ratio", label: "CIR", unit: "%", direction: "lower", threshold: { good: 35, warning: 45, critical: 55 }, benchmarkSource: "GCC Banking Benchmarks 2023", category: "Efficiency", sortOrder: 4, status: "ACTIVE" },
    { kpiId: "bank-lcr", kpiSetId: "banking", industryTag: "banking", name: "Liquidity Coverage Ratio", label: "LCR", unit: "%", direction: "higher", threshold: { good: 150, warning: 120, critical: 100 }, benchmarkSource: "Basel III / CBK Circular 3/2022", category: "Liquidity", sortOrder: 5, status: "ACTIVE" },
  ],
  "manufacturing": [
    { kpiId: "mfg-oee", kpiSetId: "manufacturing", industryTag: "manufacturing", name: "Overall Equipment Effectiveness", label: "OEE", unit: "%", direction: "higher", threshold: { good: 85, warning: 70, critical: 55 }, benchmarkSource: "World Class Manufacturing Benchmarks", category: "Efficiency", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "mfg-defect", kpiSetId: "manufacturing", industryTag: "manufacturing", name: "Defect Rate", label: "Defect Rate", unit: "PPM", direction: "lower", threshold: { good: 500, warning: 2000, critical: 5000 }, benchmarkSource: "ISO 9001 GCC Implementation Guide", category: "Quality", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "mfg-mtbf", kpiSetId: "manufacturing", industryTag: "manufacturing", name: "Mean Time Between Failures", label: "MTBF", unit: "hours", direction: "higher", threshold: { good: 2000, warning: 1000, critical: 500 }, benchmarkSource: "Industry Standard", category: "Reliability", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "mfg-mttr", kpiSetId: "manufacturing", industryTag: "manufacturing", name: "Mean Time To Repair", label: "MTTR", unit: "hours", direction: "lower", threshold: { good: 2, warning: 6, critical: 12 }, benchmarkSource: "Industry Standard", category: "Maintenance", sortOrder: 3, status: "ACTIVE" },
    { kpiId: "mfg-energy", kpiSetId: "manufacturing", industryTag: "manufacturing", name: "Energy Intensity", label: "Energy/Unit", unit: "kWh/unit", direction: "lower", threshold: { good: 0.5, warning: 1.0, critical: 2.0 }, benchmarkSource: "GCC Industrial Energy Benchmarks", category: "Sustainability", sortOrder: 4, status: "ACTIVE" },
    { kpiId: "mfg-safety", kpiSetId: "manufacturing", industryTag: "manufacturing", name: "Lost Time Injury Frequency Rate", label: "LTIFR", unit: "per million hours", direction: "lower", threshold: { good: 0.5, warning: 1.5, critical: 3.0 }, benchmarkSource: "GCC HSE Benchmarks", category: "Safety", sortOrder: 5, status: "ACTIVE" },
  ],
  "healthcare": [
    { kpiId: "health-bed", kpiSetId: "healthcare", industryTag: "healthcare", name: "Bed Occupancy Rate", label: "BOR", unit: "%", direction: "target", threshold: { good: 80, warning: 65, critical: 50 }, benchmarkSource: "MOH Healthcare Statistics 2023", category: "Capacity", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "health-alos", kpiSetId: "healthcare", industryTag: "healthcare", name: "Average Length of Stay", label: "ALOS", unit: "days", direction: "lower", threshold: { good: 3, warning: 5, critical: 7 }, benchmarkSource: "JCI Benchmarks GCC", category: "Efficiency", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "health-readmit", kpiSetId: "healthcare", industryTag: "healthcare", name: "30-Day Readmission Rate", label: "Readmission", unit: "%", direction: "lower", threshold: { good: 5, warning: 10, critical: 15 }, benchmarkSource: "JCI Quality Metrics", category: "Quality", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "health-nps", kpiSetId: "healthcare", industryTag: "healthcare", name: "Patient Net Promoter Score", label: "Patient NPS", unit: "score", direction: "higher", threshold: { good: 70, warning: 50, critical: 30 }, benchmarkSource: "GCC Healthcare CX Benchmarks", category: "Patient Experience", sortOrder: 3, status: "ACTIVE" },
    { kpiId: "health-cost", kpiSetId: "healthcare", industryTag: "healthcare", name: "Cost per Patient Day", label: "Cost/Day", unit: "USD", direction: "lower", threshold: { good: 800, warning: 1200, critical: 1800 }, benchmarkSource: "GCC Healthcare Financial Benchmarks", category: "Financial", sortOrder: 4, status: "ACTIVE" },
  ],
  "retail": [
    { kpiId: "retail-sssg", kpiSetId: "retail", industryTag: "retail", name: "Same-Store Sales Growth", label: "SSSG", unit: "%", direction: "higher", threshold: { good: 5, warning: 0, critical: -5 }, benchmarkSource: "GCC Retail Industry Report 2023", category: "Revenue", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "retail-gm", kpiSetId: "retail", industryTag: "retail", name: "Gross Margin", label: "GM", unit: "%", direction: "higher", threshold: { good: 50, warning: 35, critical: 20 }, benchmarkSource: "GCC Retail Benchmarks", category: "Profitability", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "retail-inv", kpiSetId: "retail", industryTag: "retail", name: "Inventory Turns", label: "Inv Turns", unit: "x/year", direction: "higher", threshold: { good: 8, warning: 5, critical: 3 }, benchmarkSource: "GCC Retail Operations Benchmarks", category: "Efficiency", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "retail-ltv", kpiSetId: "retail", industryTag: "retail", name: "Customer Lifetime Value", label: "CLV", unit: "USD", direction: "higher", threshold: { good: 2000, warning: 1000, critical: 500 }, benchmarkSource: "GCC E-Commerce Report 2023", category: "Customer", sortOrder: 3, status: "ACTIVE" },
    { kpiId: "retail-cac", kpiSetId: "retail", industryTag: "retail", name: "Customer Acquisition Cost", label: "CAC", unit: "USD", direction: "lower", threshold: { good: 20, warning: 50, critical: 100 }, benchmarkSource: "GCC Digital Marketing Benchmarks", category: "Marketing", sortOrder: 4, status: "ACTIVE" },
  ],
  "logistics": [
    { kpiId: "log-otd", kpiSetId: "logistics", industryTag: "logistics", name: "On-Time Delivery Rate", label: "OTD", unit: "%", direction: "higher", threshold: { good: 98, warning: 95, critical: 90 }, benchmarkSource: "GCC Logistics Industry Report 2023", category: "Service", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "log-util", kpiSetId: "logistics", industryTag: "logistics", name: "Fleet Utilisation", label: "Utilisation", unit: "%", direction: "higher", threshold: { good: 85, warning: 70, critical: 55 }, benchmarkSource: "GCC Transport Benchmarks", category: "Efficiency", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "log-cost", kpiSetId: "logistics", industryTag: "logistics", name: "Cost per Shipment", label: "Cost/Shipment", unit: "USD", direction: "lower", threshold: { good: 15, warning: 25, critical: 40 }, benchmarkSource: "GCC Logistics Cost Benchmarks", category: "Financial", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "log-damage", kpiSetId: "logistics", industryTag: "logistics", name: "Damage Rate", label: "Damage Rate", unit: "%", direction: "lower", threshold: { good: 0.1, warning: 0.5, critical: 1.0 }, benchmarkSource: "GCC Logistics Quality Standards", category: "Quality", sortOrder: 3, status: "ACTIVE" },
  ],
  "ai_company": [
    { kpiId: "ai-arr", kpiSetId: "ai_company", industryTag: "ai_company", name: "Annual Recurring Revenue", label: "ARR", unit: "USD", direction: "higher", threshold: { good: 1000000, warning: 250000, critical: 50000 }, benchmarkSource: "SaaS Capital Index 2024", category: "Revenue", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "ai-nrr", kpiSetId: "ai_company", industryTag: "ai_company", name: "Net Revenue Retention", label: "NRR", unit: "%", direction: "higher", threshold: { good: 120, warning: 100, critical: 85 }, benchmarkSource: "SaaS Capital Index 2024", category: "Revenue", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "ai-cac", kpiSetId: "ai_company", industryTag: "ai_company", name: "Customer Acquisition Cost", label: "CAC", unit: "USD", direction: "lower", threshold: { good: 5000, warning: 20000, critical: 50000 }, benchmarkSource: "OpenView SaaS Benchmarks 2024", category: "Sales Efficiency", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "ai-ltv-cac", kpiSetId: "ai_company", industryTag: "ai_company", name: "LTV:CAC Ratio", label: "LTV:CAC", unit: "x", direction: "higher", threshold: { good: 5, warning: 3, critical: 1 }, benchmarkSource: "OpenView SaaS Benchmarks 2024", category: "Sales Efficiency", sortOrder: 3, status: "ACTIVE" },
    { kpiId: "ai-burn", kpiSetId: "ai_company", industryTag: "ai_company", name: "Burn Multiple", label: "Burn Multiple", unit: "x", direction: "lower", threshold: { good: 1, warning: 2, critical: 4 }, benchmarkSource: "Bessemer Venture Partners Cloud Index 2024", category: "Capital Efficiency", sortOrder: 4, status: "ACTIVE" },
    { kpiId: "ai-runway", kpiSetId: "ai_company", industryTag: "ai_company", name: "Cash Runway", label: "Runway", unit: "months", direction: "higher", threshold: { good: 18, warning: 12, critical: 6 }, benchmarkSource: "Y Combinator Default Alive Framework", category: "Capital Efficiency", sortOrder: 5, status: "ACTIVE" },
    { kpiId: "ai-gpu-util", kpiSetId: "ai_company", industryTag: "ai_company", name: "GPU Utilisation", label: "GPU Util", unit: "%", direction: "higher", threshold: { good: 80, warning: 60, critical: 40 }, benchmarkSource: "MLCommons Infrastructure Benchmarks 2024", category: "Infrastructure", sortOrder: 6, status: "ACTIVE" },
    { kpiId: "ai-inference-cost", kpiSetId: "ai_company", industryTag: "ai_company", name: "Inference Cost per 1M Tokens", label: "Cost/1M Tokens", unit: "USD", direction: "lower", threshold: { good: 1, warning: 5, critical: 20 }, benchmarkSource: "Artificial Analysis AI Benchmark 2024", category: "Infrastructure", sortOrder: 7, status: "ACTIVE" },
    { kpiId: "ai-talent", kpiSetId: "ai_company", industryTag: "ai_company", name: "ML Engineer Retention Rate", label: "ML Retention", unit: "%", direction: "higher", threshold: { good: 90, warning: 75, critical: 60 }, benchmarkSource: "Radford Technology Compensation Survey 2024", category: "Talent", sortOrder: 8, status: "ACTIVE" },
    { kpiId: "ai-model-acc", kpiSetId: "ai_company", industryTag: "ai_company", name: "Model Accuracy vs Baseline", label: "Model Accuracy", unit: "%", direction: "higher", threshold: { good: 95, warning: 85, critical: 70 }, benchmarkSource: "Internal benchmark vs GPT-4o baseline", category: "Product Quality", sortOrder: 9, status: "ACTIVE" },
  ],
  "gcc_ai_startup": [
    { kpiId: "gckai-arr", kpiSetId: "gcc_ai_startup", industryTag: "ai_company", name: "Annual Recurring Revenue", label: "ARR", unit: "USD", direction: "higher", threshold: { good: 500000, warning: 100000, critical: 20000 }, benchmarkSource: "MENA Startup Benchmarks 2024", category: "Revenue", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "gckai-runway", kpiSetId: "gcc_ai_startup", industryTag: "ai_company", name: "Cash Runway", label: "Runway", unit: "months", direction: "higher", threshold: { good: 18, warning: 12, critical: 6 }, benchmarkSource: "Y Combinator Default Alive Framework", category: "Capital Efficiency", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "gckai-gov-pipeline", kpiSetId: "gcc_ai_startup", industryTag: "ai_company", name: "Government Pipeline Value", label: "Gov Pipeline", unit: "USD", direction: "higher", threshold: { good: 2000000, warning: 500000, critical: 100000 }, benchmarkSource: "Internal", category: "Revenue", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "gckai-nrr", kpiSetId: "gcc_ai_startup", industryTag: "ai_company", name: "Net Revenue Retention", label: "NRR", unit: "%", direction: "higher", threshold: { good: 110, warning: 95, critical: 80 }, benchmarkSource: "MENA SaaS Benchmarks 2024", category: "Revenue", sortOrder: 3, status: "ACTIVE" },
    { kpiId: "gckai-headcount", kpiSetId: "gcc_ai_startup", industryTag: "ai_company", name: "Revenue per Employee", label: "Rev/Employee", unit: "USD", direction: "higher", threshold: { good: 150000, warning: 75000, critical: 30000 }, benchmarkSource: "MENA Tech Startup Report 2024", category: "Efficiency", sortOrder: 4, status: "ACTIVE" },
  ],
  "defense": [
    { kpiId: "def-local", kpiSetId: "defense", industryTag: "defense", name: "Localisation Percentage", label: "Localisation", unit: "%", direction: "higher", threshold: { good: 50, warning: 30, critical: 15 }, benchmarkSource: "GAMI Vision 2030 Targets", category: "Sovereignty", sortOrder: 0, status: "ACTIVE" },
    { kpiId: "def-readiness", kpiSetId: "defense", industryTag: "defense", name: "System Readiness Rate", label: "Readiness", unit: "%", direction: "higher", threshold: { good: 95, warning: 85, critical: 70 }, benchmarkSource: "Defense Operational Standards", category: "Operational", sortOrder: 1, status: "ACTIVE" },
    { kpiId: "def-accuracy", kpiSetId: "defense", industryTag: "defense", name: "Target Classification Accuracy", label: "Accuracy", unit: "%", direction: "higher", threshold: { good: 96, warning: 90, critical: 80 }, benchmarkSource: "Defense AI Performance Standards", category: "AI Performance", sortOrder: 2, status: "ACTIVE" },
    { kpiId: "def-latency", kpiSetId: "defense", industryTag: "defense", name: "Inference Latency", label: "Latency", unit: "ms", direction: "lower", threshold: { good: 50, warning: 200, critical: 500 }, benchmarkSource: "Tactical AI Requirements", category: "Performance", sortOrder: 3, status: "ACTIVE" },
  ],
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: KpiRecord[]; expiresAt: number }>();

function fromRow(row: KpiDefinition): KpiRecord {
  return {
    kpiId: row.kpiId,
    kpiSetId: row.kpiSetId,
    industryTag: row.industryTag,
    name: row.name,
    label: row.label,
    unit: row.unit ?? undefined,
    direction: row.direction as "higher" | "lower" | "target",
    threshold: JSON.parse(row.threshold || '{"good":0,"warning":0,"critical":0}'),
    benchmarkSource: row.benchmarkSource ?? undefined,
    description: row.description ?? undefined,
    formula: row.formula ?? undefined,
    category: row.category ?? undefined,
    sortOrder: row.sortOrder,
    status: row.status,
  };
}

export async function getKpiSet(kpiSetId: string): Promise<KpiRecord[]> {
  const cacheKey = `kpi:${kpiSetId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(kpiDefinitions)
        .where(and(eq(kpiDefinitions.kpiSetId, kpiSetId), eq(kpiDefinitions.status, "ACTIVE")))
        .orderBy(asc(kpiDefinitions.sortOrder));
      if (rows.length > 0) {
        const data = rows.map(fromRow);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[KpiService] DB error, falling back:", e);
    }
  }

  const fallback = FALLBACK_KPI_SETS[kpiSetId] ?? [];
  cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function getKpiSetByIndustry(industryTag: string): Promise<KpiRecord[]> {
  return getKpiSet(industryTag);
}

export async function listKpiSets(): Promise<string[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.selectDistinct({ kpiSetId: kpiDefinitions.kpiSetId })
        .from(kpiDefinitions)
        .where(eq(kpiDefinitions.status, "ACTIVE"));
      if (rows.length > 0) return rows.map(r => r.kpiSetId);
    } catch (e) {
      console.warn("[KpiService] DB error, falling back:", e);
    }
  }
  return Object.keys(FALLBACK_KPI_SETS);
}

export async function createKpi(input: Omit<InsertKpiDefinition, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = Date.now();
  await db.insert(kpiDefinitions).values({
    ...input,
    threshold: JSON.stringify(input.threshold ?? {}),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return true;
}

export function invalidateKpiCache(): void {
  cache.clear();
}

export { FALLBACK_KPI_SETS };
