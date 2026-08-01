/**
 * Twin Blueprint Service
 * The root registry for all Decision Twins.
 * Pattern: DB → 5-min in-memory cache → hardcoded fallback → null
 */
import { getDb } from "../db";
import { twinBlueprints, TwinBlueprint, InsertTwinBlueprint } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TwinBlueprintRecord {
  blueprintId: string;
  name: string;
  slug: string;
  industry: string;
  organizationType?: string;
  description?: string;
  ontologyId?: string;
  defaultCouncilPersonaSetId?: string;
  defaultDecisionTypeIds: string[];
  defaultKpiSetId?: string;
  defaultSimulationMode: string;
  defaultReportTemplateIds: string[];
  defaultWorkflowProtocolId?: string;
  governanceProfileId?: string;
  securityProfile: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  uiTheme: string;
  executiveDashboardLayout: Record<string, unknown>;
  promptTemplates: Record<string, unknown>;
  status: string;
  version: string;
  parentBlueprintId?: string;
}

// ── Hardcoded fallback blueprints (from existing prospect configs) ────────────

const FALLBACK_BLUEPRINTS: TwinBlueprintRecord[] = [
  {
    blueprintId: "bp-damac",
    name: "DAMAC Properties Decision Twin",
    slug: "damac",
    industry: "Real Estate",
    organizationType: "Developer",
    description: "Strategic decision twin for luxury real estate development and investment decisions",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["capital-allocation", "expansion", "acquisition"],
    defaultReportTemplateIds: ["executive-brief", "board-report"],
    securityProfile: "standard",
    primaryColor: "#b8860b",
    accentColor: "#1a1a2e",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-humain",
    name: "Humain Sovereign AI Decision Twin",
    slug: "humain",
    industry: "Technology",
    organizationType: "Sovereign AI Company",
    description: "Decision twin for sovereign AI infrastructure investment and Vision 2030 alignment",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["capital-allocation", "transformation", "investment"],
    defaultReportTemplateIds: ["executive-brief", "investment-memo"],
    securityProfile: "sovereign",
    primaryColor: "#006c35",
    accentColor: "#c8a951",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-core42",
    name: "Core42 Enterprise AI Decision Twin",
    slug: "core42",
    industry: "Technology",
    organizationType: "AI Infrastructure",
    description: "Decision twin for enterprise AI deployment and sovereign cloud infrastructure",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["capital-allocation", "procurement", "transformation"],
    defaultReportTemplateIds: ["executive-brief", "board-report"],
    securityProfile: "sovereign",
    primaryColor: "#0066cc",
    accentColor: "#c0c0c0",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-bakalaria",
    name: "Bakalaria Food Group Decision Twin",
    slug: "bakalaria",
    industry: "Food & Beverage",
    organizationType: "Restaurant Group",
    description: "Decision twin for restaurant expansion, franchise, and supply chain decisions",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["expansion", "capital-allocation", "supply-chain"],
    defaultReportTemplateIds: ["executive-brief", "credit-memo"],
    securityProfile: "standard",
    primaryColor: "#008080",
    accentColor: "#c8a951",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-sami",
    name: "SAMI Defense AI Decision Twin",
    slug: "sami",
    industry: "Defense",
    organizationType: "Defense Manufacturer",
    description: "Sovereign defense AI decision twin for tactical operations and localization strategy",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["procurement", "transformation", "capital-allocation"],
    defaultReportTemplateIds: ["executive-brief", "board-report"],
    securityProfile: "air-gapped",
    primaryColor: "#4a5e3a",
    accentColor: "#c8a951",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-alghanim",
    name: "Alghanim Industries Decision Twin",
    slug: "alghanim",
    industry: "Industrial Conglomerate",
    organizationType: "Conglomerate",
    description: "Decision twin for automotive, HVAC manufacturing, engineering, and industrial services",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["capital-allocation", "procurement", "transformation"],
    defaultReportTemplateIds: ["executive-brief", "operational-review"],
    securityProfile: "standard",
    primaryColor: "#1e3a5f",
    accentColor: "#c8102e",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-floward",
    name: "Floward E-Commerce Decision Twin",
    slug: "floward",
    industry: "E-Commerce",
    organizationType: "Online Retailer",
    description: "Decision twin for perishable logistics, GCC expansion, and customer intelligence",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["expansion", "supply-chain", "capital-allocation"],
    defaultReportTemplateIds: ["executive-brief", "operational-review"],
    securityProfile: "standard",
    primaryColor: "#c2185b",
    accentColor: "#b8860b",
    uiTheme: "light",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
  {
    blueprintId: "bp-uic",
    name: "UIC Financial Intelligence Decision Twin",
    slug: "uic",
    industry: "Financial Services",
    organizationType: "Investment Company",
    description: "Sovereign financial intelligence twin for portfolio management and Sharia compliance",
    defaultSimulationMode: "institutional",
    defaultDecisionTypeIds: ["investment", "credit", "risk"],
    defaultReportTemplateIds: ["executive-brief", "investment-memo"],
    securityProfile: "fiduciary",
    primaryColor: "#1a237e",
    accentColor: "#c8a951",
    uiTheme: "dark",
    executiveDashboardLayout: {},
    promptTemplates: {},
    status: "ACTIVE",
    version: "1.0.0",
  },
];

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: TwinBlueprintRecord; expiresAt: number }>();

function fromRow(row: TwinBlueprint): TwinBlueprintRecord {
  return {
    blueprintId: row.blueprintId,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    organizationType: row.organizationType ?? undefined,
    description: row.description ?? undefined,
    ontologyId: row.ontologyId ?? undefined,
    defaultCouncilPersonaSetId: row.defaultCouncilPersonaSetId ?? undefined,
    defaultDecisionTypeIds: JSON.parse(row.defaultDecisionTypeIds || "[]"),
    defaultKpiSetId: row.defaultKpiSetId ?? undefined,
    defaultSimulationMode: row.defaultSimulationMode,
    defaultReportTemplateIds: JSON.parse(row.defaultReportTemplateIds || "[]"),
    defaultWorkflowProtocolId: row.defaultWorkflowProtocolId ?? undefined,
    governanceProfileId: row.governanceProfileId ?? undefined,
    securityProfile: row.securityProfile,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    logoUrl: row.logoUrl ?? undefined,
    uiTheme: row.uiTheme,
    executiveDashboardLayout: JSON.parse(row.executiveDashboardLayout || "{}"),
    promptTemplates: JSON.parse(row.promptTemplates || "{}"),
    status: row.status,
    version: row.version,
    parentBlueprintId: row.parentBlueprintId ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getBlueprintBySlug(slug: string): Promise<TwinBlueprintRecord | null> {
  const cacheKey = `slug:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(twinBlueprints)
        .where(and(eq(twinBlueprints.slug, slug), eq(twinBlueprints.status, "ACTIVE")))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[TwinBlueprintService] DB error, falling back:", e);
    }
  }

  // Fallback
  const fallback = FALLBACK_BLUEPRINTS.find(b => b.slug === slug) ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function getBlueprintById(blueprintId: string): Promise<TwinBlueprintRecord | null> {
  const cacheKey = `id:${blueprintId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(twinBlueprints)
        .where(eq(twinBlueprints.blueprintId, blueprintId))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[TwinBlueprintService] DB error, falling back:", e);
    }
  }

  const fallback = FALLBACK_BLUEPRINTS.find(b => b.blueprintId === blueprintId) ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function listBlueprints(industry?: string): Promise<TwinBlueprintRecord[]> {
  const cacheKey = `list:${industry ?? "all"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return [cached.data];

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(twinBlueprints)
        .where(eq(twinBlueprints.status, "ACTIVE"));
      const data = rows.map(fromRow).filter(b => !industry || b.industry === industry);
      return data;
    } catch (e) {
      console.warn("[TwinBlueprintService] DB error, falling back:", e);
    }
  }

  return industry
    ? FALLBACK_BLUEPRINTS.filter(b => b.industry === industry)
    : [...FALLBACK_BLUEPRINTS];
}

export async function createBlueprint(input: Omit<InsertTwinBlueprint, "id" | "createdAt" | "updatedAt">): Promise<TwinBlueprintRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const now = Date.now();
  await db.insert(twinBlueprints).values({
    ...input,
    defaultDecisionTypeIds: JSON.stringify(input.defaultDecisionTypeIds ?? []),
    defaultReportTemplateIds: JSON.stringify(input.defaultReportTemplateIds ?? []),
    executiveDashboardLayout: JSON.stringify(input.executiveDashboardLayout ?? {}),
    promptTemplates: JSON.stringify(input.promptTemplates ?? {}),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return getBlueprintById(input.blueprintId);
}

export async function updateBlueprint(blueprintId: string, updates: Partial<InsertTwinBlueprint>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(twinBlueprints)
    .set({ ...updates, updatedAt: Date.now() } as any)
    .where(eq(twinBlueprints.blueprintId, blueprintId));
  cache.clear();
  return true;
}

export async function archiveBlueprint(blueprintId: string): Promise<boolean> {
  return updateBlueprint(blueprintId, { status: "ARCHIVED" } as any);
}

export function invalidateBlueprintCache(): void {
  cache.clear();
}

export { FALLBACK_BLUEPRINTS };
