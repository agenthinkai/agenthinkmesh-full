/**
 * Simulation Registry Service
 * Registry of simulation plugins that can be attached to any Twin Blueprint.
 * Pattern: DB → 5-min cache → hardcoded fallback → []
 */
import { getDb } from "../db";
import { simulationPlugins, SimulationPlugin, InsertSimulationPlugin } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface SimulationPluginRecord {
  pluginId: string;
  name: string;
  description?: string;
  category: string;
  engineType: string;
  configSchema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  maxScenarioCount: number;
  costTier: string;
  requiresConfirmation: boolean;
  industryTags: string[];
  status: string;
}

const FALLBACK_PLUGINS: SimulationPluginRecord[] = [
  {
    pluginId: "macro-stress",
    name: "Macroeconomic Stress Test",
    description: "Stress test decisions against oil price shocks, interest rate changes, and GDP scenarios",
    category: "stress_test",
    engineType: "perturbation",
    configSchema: { oilPriceRange: "number[]", interestRateRange: "number[]", gdpGrowthRange: "number[]" },
    defaultConfig: { oilPriceRange: [40, 120], interestRateRange: [2, 8], gdpGrowthRange: [-3, 6] },
    maxScenarioCount: 1000,
    costTier: "medium",
    requiresConfirmation: false,
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    pluginId: "geopolitical-risk",
    name: "Geopolitical Risk Simulation",
    description: "Simulate impact of regional conflicts, sanctions, and diplomatic events on decisions",
    category: "stress_test",
    engineType: "perturbation",
    configSchema: { conflictScenarios: "string[]", sanctionRisk: "number", diplomaticRisk: "number" },
    defaultConfig: { conflictScenarios: ["regional_conflict", "sanctions", "trade_war"], sanctionRisk: 0.15, diplomaticRisk: 0.1 },
    maxScenarioCount: 500,
    costTier: "medium",
    requiresConfirmation: false,
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    pluginId: "regulatory-change",
    name: "Regulatory Change Simulation",
    description: "Simulate impact of new regulations, compliance requirements, or policy changes",
    category: "regulatory",
    engineType: "perturbation",
    configSchema: { regulatoryScenarios: "string[]", complianceCost: "number", implementationTimeline: "number" },
    defaultConfig: { regulatoryScenarios: ["new_cbk_circular", "vat_increase", "data_localisation"], complianceCost: 0.05, implementationTimeline: 12 },
    maxScenarioCount: 200,
    costTier: "low",
    requiresConfirmation: false,
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    pluginId: "competitor-response",
    name: "Competitor Response Simulation",
    description: "Simulate how competitors might respond to strategic decisions",
    category: "competitive",
    engineType: "game_theory",
    configSchema: { competitorCount: "number", responseIntensity: "number", marketShareImpact: "number" },
    defaultConfig: { competitorCount: 3, responseIntensity: 0.7, marketShareImpact: 0.15 },
    maxScenarioCount: 300,
    costTier: "medium",
    requiresConfirmation: false,
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    pluginId: "supply-chain-disruption",
    name: "Supply Chain Disruption Simulation",
    description: "Simulate supply chain disruptions from logistics failures, supplier defaults, or port closures",
    category: "operational",
    engineType: "perturbation",
    configSchema: { disruptionScenarios: "string[]", recoveryTime: "number", inventoryBuffer: "number" },
    defaultConfig: { disruptionScenarios: ["port_closure", "supplier_default", "logistics_failure"], recoveryTime: 30, inventoryBuffer: 0.2 },
    maxScenarioCount: 500,
    costTier: "medium",
    requiresConfirmation: false,
    industryTags: ["manufacturing", "retail", "logistics", "e-commerce"],
    status: "ACTIVE",
  },
  {
    pluginId: "currency-risk",
    name: "Currency Risk Simulation",
    description: "Simulate impact of currency fluctuations on cross-border decisions",
    category: "financial",
    engineType: "monte_carlo",
    configSchema: { currencyPairs: "string[]", volatilityRange: "number[]", hedgingRatio: "number" },
    defaultConfig: { currencyPairs: ["USD/KWD", "EUR/KWD", "GBP/KWD"], volatilityRange: [0.05, 0.25], hedgingRatio: 0.5 },
    maxScenarioCount: 10000,
    costTier: "low",
    requiresConfirmation: false,
    industryTags: ["financial-services", "banking", "investment"],
    status: "ACTIVE",
  },
  {
    pluginId: "technology-disruption",
    name: "Technology Disruption Simulation",
    description: "Simulate impact of AI, automation, or digital disruption on business models",
    category: "strategic",
    engineType: "perturbation",
    configSchema: { disruptionTimeline: "number", adoptionRate: "number", costReduction: "number" },
    defaultConfig: { disruptionTimeline: 36, adoptionRate: 0.3, costReduction: 0.4 },
    maxScenarioCount: 200,
    costTier: "low",
    requiresConfirmation: false,
    industryTags: ["all"],
    status: "ACTIVE",
  },
  {
    pluginId: "climate-risk",
    name: "Climate & ESG Risk Simulation",
    description: "Simulate physical and transition climate risks on long-term decisions",
    category: "esg",
    engineType: "perturbation",
    configSchema: { climateScenarios: "string[]", carbonPrice: "number", physicalRiskScore: "number" },
    defaultConfig: { climateScenarios: ["1.5C", "2C", "4C"], carbonPrice: 50, physicalRiskScore: 0.3 },
    maxScenarioCount: 300,
    costTier: "medium",
    requiresConfirmation: false,
    industryTags: ["energy", "manufacturing", "real-estate"],
    status: "ACTIVE",
  },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: SimulationPluginRecord; expiresAt: number }>();

function fromRow(row: SimulationPlugin): SimulationPluginRecord {
  return {
    pluginId: row.pluginId,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    engineType: row.engineType,
    configSchema: JSON.parse(row.configSchema || "{}"),
    defaultConfig: JSON.parse(row.defaultConfig || "{}"),
    maxScenarioCount: row.maxScenarioCount,
    costTier: row.costTier,
    requiresConfirmation: row.requiresConfirmation === 1,
    industryTags: JSON.parse(row.industryTags || "[]"),
    status: row.status,
  };
}

export async function getSimulationPlugin(pluginId: string): Promise<SimulationPluginRecord | null> {
  const cacheKey = `sim:${pluginId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(simulationPlugins)
        .where(eq(simulationPlugins.pluginId, pluginId))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[SimulationRegistryService] DB error, falling back:", e);
    }
  }

  const fallback = FALLBACK_PLUGINS.find(p => p.pluginId === pluginId) ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function listSimulationPlugins(industryTag?: string): Promise<SimulationPluginRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(simulationPlugins)
        .where(eq(simulationPlugins.status, "ACTIVE"));
      if (rows.length > 0) {
        const all = rows.map(fromRow);
        return industryTag
          ? all.filter(p => p.industryTags.includes("all") || p.industryTags.includes(industryTag))
          : all;
      }
    } catch (e) {
      console.warn("[SimulationRegistryService] DB error, falling back:", e);
    }
  }
  return industryTag
    ? FALLBACK_PLUGINS.filter(p => p.industryTags.includes("all") || p.industryTags.includes(industryTag))
    : [...FALLBACK_PLUGINS];
}

export async function createSimulationPlugin(input: Omit<InsertSimulationPlugin, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = Date.now();
  await db.insert(simulationPlugins).values({
    ...input,
    configSchema: JSON.stringify(input.configSchema ?? {}),
    defaultConfig: JSON.stringify(input.defaultConfig ?? {}),
    industryTags: JSON.stringify(input.industryTags ?? []),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return true;
}

export function invalidateSimulationRegistryCache(): void {
  cache.clear();
}

export { FALLBACK_PLUGINS as FALLBACK_SIMULATION_PLUGINS };
