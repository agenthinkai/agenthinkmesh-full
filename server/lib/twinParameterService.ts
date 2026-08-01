/**
 * server/lib/twinParameterService.ts
 *
 * Twin Parameter Service — Sprint 1 Generic Configuration Layer
 *
 * Stores versioned parameters for client-side calculation engines.
 * Client engines continue to use hardcoded defaults when the DB row is absent.
 *
 * Read order: DB → in-memory cache (5 min TTL) → hardcoded fallback → null
 *
 * Admin CRUD is exposed via tRPC procedures in server/routers/twinParameters.ts.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { twinParameters, type TwinParameter, type InsertTwinParameter } from "../../drizzle/schema";

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  params: TwinParameter[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCached(twinId: string): TwinParameter[] | null {
  const entry = cache.get(twinId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(twinId);
    return null;
  }
  return entry.params;
}

function setCached(twinId: string, params: TwinParameter[]): void {
  cache.set(twinId, { params, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateTwinParamCache(twinId?: string): void {
  if (twinId) {
    cache.delete(twinId);
  } else {
    cache.clear();
  }
}

// ── Hardcoded fallback parameters ─────────────────────────────────────────────
// These are the parameters currently hardcoded in client-side engines.
// When a twinId is not in the DB, we return these as synthetic TwinParameter rows.
// This ensures backward compatibility during the migration period.

type HardcodedParam = {
  paramKey: string;
  label: string;
  value: string;
  dataType: "number" | "string" | "boolean" | "json";
  unit?: string;
  displayUnit?: string;
  source?: string;
  confidence?: number;
};

const HARDCODED_PARAMS: Record<string, HardcodedParam[]> = {
  "bakalaria": [
    { paramKey: "loan_amount_kwd", label: "Loan Amount", value: "1000000", dataType: "number", unit: "KWD", displayUnit: "KD 1,000,000", source: "Bakalaria business plan 2024", confidence: 95 },
    { paramKey: "annual_revenue_kwd", label: "Annual Revenue", value: "4200000", dataType: "number", unit: "KWD", displayUnit: "KD 4.2M", source: "Bakalaria financial statements 2023", confidence: 90 },
    { paramKey: "production_capacity_units_per_month", label: "Production Capacity", value: "847", dataType: "number", unit: "units/month", source: "Bakalaria operations report", confidence: 95 },
    { paramKey: "market_share_pct", label: "Kuwait Market Share", value: "23", dataType: "number", unit: "%", source: "Kuwait food industry report 2024", confidence: 75 },
    { paramKey: "roi_year_1_pct", label: "Year 1 ROI", value: "18.4", dataType: "number", unit: "%", source: "Financial model", confidence: 70 },
  ],
  "core42": [
    { paramKey: "savings_10yr_usd", label: "10-Year Savings vs Cloud GPU", value: "4320000000", dataType: "number", unit: "USD", displayUnit: "$4.32B", source: "Core42 infrastructure analysis 2024", confidence: 80 },
    { paramKey: "cost_per_1m_predictions_cpu_usd", label: "Cost per 1M Predictions (CPU)", value: "8000", dataType: "number", unit: "USD", source: "Core42 benchmarks", confidence: 85 },
    { paramKey: "cost_per_1m_predictions_cloud_usd", label: "Cost per 1M Predictions (Cloud GPU)", value: "320000", dataType: "number", unit: "USD", source: "AWS/Azure pricing 2024", confidence: 90 },
    { paramKey: "latency_ms_cpu", label: "CPU Inference Latency", value: "3", dataType: "number", unit: "ms", source: "Core42 benchmarks", confidence: 85 },
    { paramKey: "latency_ms_cloud", label: "Cloud Inference Latency", value: "80", dataType: "number", unit: "ms", source: "AWS latency benchmarks", confidence: 80 },
  ],
  "sami": [
    { paramKey: "uav_units", label: "UAV Fleet Size", value: "24", dataType: "number", unit: "units", source: "SAMI operational brief", confidence: 90 },
    { paramKey: "ugv_units", label: "UGV Fleet Size", value: "18", dataType: "number", unit: "units", source: "SAMI operational brief", confidence: 90 },
    { paramKey: "usv_units", label: "USV Fleet Size", value: "6", dataType: "number", unit: "units", source: "SAMI operational brief", confidence: 90 },
    { paramKey: "border_length_km", label: "Southern Border Length", value: "2400", dataType: "number", unit: "km", source: "Saudi Arabia geographic data", confidence: 95 },
    { paramKey: "cbk_penalty_per_breach_kwd", label: "CBK Penalty per Breach", value: "500000", dataType: "number", unit: "KWD", source: "CBK Circular 2022", confidence: 95 },
  ],
  "alghanim": [
    { paramKey: "vehicles_serviced_annually", label: "Vehicles Serviced Annually", value: "12000", dataType: "number", unit: "vehicles/yr", source: "Alghanim Automotive operations 2023", confidence: 90 },
    { paramKey: "hvac_units_per_month", label: "HVAC Units Manufactured Monthly", value: "847", dataType: "number", unit: "units/month", source: "Alghanim Manufacturing report 2023", confidence: 90 },
    { paramKey: "spare_parts_sku_count", label: "Spare Parts SKU Count", value: "4200", dataType: "number", unit: "SKUs", source: "Alghanim ACDelco/GM catalogue 2024", confidence: 85 },
    { paramKey: "service_centres_count", label: "Service Centres", value: "12", dataType: "number", unit: "centres", source: "Alghanim Automotive 2024", confidence: 95 },
    { paramKey: "savings_annual_kwd", label: "Annual Operational Savings", value: "5570000", dataType: "number", unit: "KWD", displayUnit: "KD 5.57M", source: "Alghanim operational analysis 2024", confidence: 75 },
  ],
  "floward": [
    { paramKey: "gcc_markets_count", label: "GCC Markets", value: "6", dataType: "number", unit: "markets", source: "Floward investor deck 2024", confidence: 95 },
    { paramKey: "delivery_vans_total", label: "Total Delivery Vans", value: "340", dataType: "number", unit: "vans", source: "Floward operations 2024", confidence: 85 },
    { paramKey: "savings_10yr_usd", label: "10-Year Savings", value: "37100000", dataType: "number", unit: "USD", displayUnit: "$37.1M", source: "Floward infrastructure analysis", confidence: 75 },
    { paramKey: "valentine_surge_multiplier", label: "Valentine's Day Demand Surge", value: "20", dataType: "number", unit: "x", source: "Floward seasonal data 2023", confidence: 90 },
    { paramKey: "shelf_life_days_min", label: "Minimum Shelf Life", value: "3", dataType: "number", unit: "days", source: "Floward operations", confidence: 95 },
  ],
  "uic": [
    { paramKey: "aum_kwd_billions", label: "Assets Under Management", value: "1.2", dataType: "number", unit: "KWD billions", source: "UIC annual report 2023", confidence: 85 },
    { paramKey: "member_firms_count", label: "Member Firms", value: "90", dataType: "number", unit: "firms", source: "UIC membership directory 2024", confidence: 90 },
    { paramKey: "cbk_penalty_per_breach_kwd", label: "CBK Penalty per Breach", value: "500000", dataType: "number", unit: "KWD", source: "CBK Circular 2022", confidence: 95 },
    { paramKey: "savings_10yr_usd", label: "10-Year Savings", value: "56800000", dataType: "number", unit: "USD", displayUnit: "$56.8M", source: "UIC infrastructure analysis", confidence: 75 },
    { paramKey: "sharia_accuracy_sovereign_pct", label: "Sharia Compliance Accuracy (Sovereign)", value: "99.7", dataType: "number", unit: "%", source: "Internal benchmark", confidence: 80 },
  ],
};

function buildFallbackParams(twinId: string): TwinParameter[] {
  const hardcoded = HARDCODED_PARAMS[twinId];
  if (!hardcoded) return [];
  const now = Date.now();
  return hardcoded.map((p, i) => ({
    id: -(i + 1),
    twinId,
    paramKey: p.paramKey,
    label: p.label,
    value: p.value,
    dataType: p.dataType,
    unit: p.unit ?? null,
    displayUnit: p.displayUnit ?? null,
    minValue: null,
    maxValue: null,
    formulaNote: null,
    source: p.source ?? null,
    sourceDate: null,
    confidence: p.confidence ?? 80,
    isEditable: 1,
    scenarioOverrides: "{}",
    version: 1,
    valueHistory: "[]",
    tenantId: null,
    createdAt: now,
    updatedAt: now,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getTwinParameters — fetch all parameters for a twin.
 * Read order: cache → DB → hardcoded fallback
 */
export async function getTwinParameters(twinId: string): Promise<TwinParameter[]> {
  const cached = getCached(twinId);
  if (cached) return cached;

  const db = await getDb();
  if (db) {
    const rows = await db
      .select()
      .from(twinParameters)
      .where(eq(twinParameters.twinId, twinId));

    if (rows.length > 0) {
      setCached(twinId, rows);
      return rows;
    }
  }

  const fallback = buildFallbackParams(twinId);
  if (fallback.length > 0) setCached(twinId, fallback);
  return fallback;
}

/**
 * getTwinParameter — fetch a single parameter by twinId + paramKey.
 * Returns null if not found in DB or fallback.
 */
export async function getTwinParameter(
  twinId: string,
  paramKey: string
): Promise<TwinParameter | null> {
  const all = await getTwinParameters(twinId);
  return all.find(p => p.paramKey === paramKey) ?? null;
}

/**
 * getTwinParameterValue — convenience helper that returns the typed value.
 * Falls back to the provided defaultValue if not found.
 */
export async function getTwinParameterValue<T extends number | string | boolean>(
  twinId: string,
  paramKey: string,
  defaultValue: T
): Promise<T> {
  const param = await getTwinParameter(twinId, paramKey);
  if (!param) return defaultValue;

  try {
    if (typeof defaultValue === "number") return Number(param.value) as T;
    if (typeof defaultValue === "boolean") return (param.value === "true") as T;
    return param.value as T;
  } catch {
    return defaultValue;
  }
}

/**
 * upsertTwinParameter — insert or update a parameter.
 * Admin-only — enforce in the tRPC procedure layer.
 */
export async function upsertTwinParameter(
  data: Omit<InsertTwinParameter, "id" | "createdAt" | "updatedAt">
): Promise<TwinParameter> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const now = Date.now();

  // Check if exists
  const [existing] = await db
    .select()
    .from(twinParameters)
    .where(and(eq(twinParameters.twinId, data.twinId), eq(twinParameters.paramKey, data.paramKey)))
    .limit(1);

  if (existing) {
    // Append old value to history
    let history: string[] = [];
    try { history = JSON.parse(existing.valueHistory ?? "[]"); } catch { /* noop */ }
    if (data.value !== existing.value) {
      history.push(existing.value);
      if (history.length > 50) history = history.slice(-50);
    }

    await db
      .update(twinParameters)
      .set({
        ...data,
        version: existing.version + 1,
        valueHistory: JSON.stringify(history),
        updatedAt: now,
      })
      .where(and(eq(twinParameters.twinId, data.twinId), eq(twinParameters.paramKey, data.paramKey)));
  } else {
    await db.insert(twinParameters).values({ ...data, createdAt: now, updatedAt: now });
  }

  invalidateTwinParamCache(data.twinId);

  const [result] = await db
    .select()
    .from(twinParameters)
    .where(and(eq(twinParameters.twinId, data.twinId), eq(twinParameters.paramKey, data.paramKey)))
    .limit(1);

  return result;
}

/**
 * deleteTwinParameter — remove a parameter by twinId + paramKey.
 * Admin-only — enforce in the tRPC procedure layer.
 */
export async function deleteTwinParameter(twinId: string, paramKey: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db
    .delete(twinParameters)
    .where(and(eq(twinParameters.twinId, twinId), eq(twinParameters.paramKey, paramKey)));

  invalidateTwinParamCache(twinId);
}
