/**
 * Twin Composer Service
 * Compose multiple Twin Blueprints into a multi-domain Decision Twin.
 * Pattern: DB → 5-min cache → null
 */
import { getDb } from "../db";
import { twinCompositions, TwinComposition, InsertTwinComposition } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getBlueprintById, TwinBlueprintRecord } from "./twinBlueprintService";
import { getPersonaSet, CouncilPersonaRecord } from "./councilPersonaService";
import { getKpiSet, KpiRecord } from "./kpiService";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TwinCompositionRecord {
  compositionId: string;
  name: string;
  description?: string;
  componentBlueprintIds: string[];
  conflictResolutionStrategy: "union" | "intersection" | "primary_wins";
  councilMergeStrategy: "weighted" | "union" | "primary_only";
  kpiAggregationStrategy: "weighted_avg" | "union" | "primary_only";
  outputBlueprintId?: string;
  compositionSchema: Record<string, unknown>;
  status: string;
}

export interface ComposedTwin {
  compositionId: string;
  name: string;
  blueprints: TwinBlueprintRecord[];
  mergedCouncilPersonas: CouncilPersonaRecord[];
  mergedKpis: KpiRecord[];
  primaryBlueprint: TwinBlueprintRecord;
  compositionMeta: Record<string, unknown>;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const compositionCache = new Map<string, { data: TwinCompositionRecord; expiresAt: number }>();
const composedCache = new Map<string, { data: ComposedTwin; expiresAt: number }>();

function fromRow(row: TwinComposition): TwinCompositionRecord {
  return {
    compositionId: row.compositionId,
    name: row.name,
    description: row.description ?? undefined,
    componentBlueprintIds: JSON.parse(row.componentBlueprintIds || "[]"),
    conflictResolutionStrategy: row.conflictResolutionStrategy as TwinCompositionRecord["conflictResolutionStrategy"],
    councilMergeStrategy: row.councilMergeStrategy as TwinCompositionRecord["councilMergeStrategy"],
    kpiAggregationStrategy: row.kpiAggregationStrategy as TwinCompositionRecord["kpiAggregationStrategy"],
    outputBlueprintId: row.outputBlueprintId ?? undefined,
    compositionSchema: JSON.parse(row.compositionSchema || "{}"),
    status: row.status,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getComposition(compositionId: string): Promise<TwinCompositionRecord | null> {
  const cacheKey = `comp:${compositionId}`;
  const cached = compositionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (!db) return null;

  try {
    const rows = await db.select().from(twinCompositions)
      .where(eq(twinCompositions.compositionId, compositionId))
      .limit(1);
    if (rows.length > 0) {
      const data = fromRow(rows[0]);
      compositionCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    }
  } catch (e) {
    console.warn("[TwinComposerService] DB error:", e);
  }
  return null;
}

export async function listCompositions(): Promise<TwinCompositionRecord[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.select().from(twinCompositions)
      .where(eq(twinCompositions.status, "ACTIVE"));
    return rows.map(fromRow);
  } catch (e) {
    console.warn("[TwinComposerService] DB error:", e);
    return [];
  }
}

/**
 * Compose multiple blueprints into a unified ComposedTwin.
 * Merges council personas and KPIs according to the composition strategy.
 */
export async function composeBlueprints(
  blueprintIds: string[],
  options: {
    councilMergeStrategy?: "weighted" | "union" | "primary_only";
    kpiAggregationStrategy?: "weighted_avg" | "union" | "primary_only";
    name?: string;
  } = {}
): Promise<ComposedTwin | null> {
  if (blueprintIds.length === 0) return null;

  const cacheKey = `composed:${blueprintIds.join(",")}:${options.councilMergeStrategy}:${options.kpiAggregationStrategy}`;
  const cached = composedCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // Load all blueprints
  const blueprints = (await Promise.all(blueprintIds.map(id => getBlueprintById(id))))
    .filter((b): b is TwinBlueprintRecord => b !== null);

  if (blueprints.length === 0) return null;

  const primaryBlueprint = blueprints[0];
  const councilStrategy = options.councilMergeStrategy ?? "union";
  const kpiStrategy = options.kpiAggregationStrategy ?? "union";

  // Merge council personas
  let mergedCouncilPersonas: CouncilPersonaRecord[] = [];
  if (councilStrategy === "primary_only") {
    mergedCouncilPersonas = primaryBlueprint.defaultCouncilPersonaSetId
      ? await getPersonaSet(primaryBlueprint.defaultCouncilPersonaSetId)
      : [];
  } else {
    // Union: collect all personas from all blueprints, deduplicate by personaId
    const personaMap = new Map<string, CouncilPersonaRecord>();
    for (const bp of blueprints) {
      if (bp.defaultCouncilPersonaSetId) {
        const personas = await getPersonaSet(bp.defaultCouncilPersonaSetId);
        for (const p of personas) {
          if (!personaMap.has(p.personaId)) {
            personaMap.set(p.personaId, p);
          }
        }
      }
    }
    mergedCouncilPersonas = Array.from(personaMap.values());
  }

  // Merge KPIs
  let mergedKpis: KpiRecord[] = [];
  if (kpiStrategy === "primary_only") {
    mergedKpis = primaryBlueprint.defaultKpiSetId
      ? await getKpiSet(primaryBlueprint.defaultKpiSetId)
      : [];
  } else {
    // Union: collect all KPIs from all blueprints, deduplicate by kpiId
    const kpiMap = new Map<string, KpiRecord>();
    for (const bp of blueprints) {
      if (bp.defaultKpiSetId) {
        const kpis = await getKpiSet(bp.defaultKpiSetId);
        for (const k of kpis) {
          if (!kpiMap.has(k.kpiId)) {
            kpiMap.set(k.kpiId, k);
          }
        }
      }
    }
    mergedKpis = Array.from(kpiMap.values());
  }

  const composed: ComposedTwin = {
    compositionId: `composed-${blueprintIds.join("-")}`,
    name: options.name ?? blueprints.map(b => b.name).join(" + "),
    blueprints,
    mergedCouncilPersonas,
    mergedKpis,
    primaryBlueprint,
    compositionMeta: {
      blueprintCount: blueprints.length,
      councilPersonaCount: mergedCouncilPersonas.length,
      kpiCount: mergedKpis.length,
      councilMergeStrategy: councilStrategy,
      kpiAggregationStrategy: kpiStrategy,
      composedAt: Date.now(),
    },
  };

  composedCache.set(cacheKey, { data: composed, expiresAt: Date.now() + CACHE_TTL_MS });
  return composed;
}

export async function createComposition(input: Omit<InsertTwinComposition, "id" | "createdAt" | "updatedAt">): Promise<TwinCompositionRecord | null> {
  const db = await getDb();
  if (!db) return null;
  const now = Date.now();
  await db.insert(twinCompositions).values({
    ...input,
    componentBlueprintIds: JSON.stringify(input.componentBlueprintIds ?? []),
    compositionSchema: JSON.stringify(input.compositionSchema ?? {}),
    createdAt: now,
    updatedAt: now,
  } as any);
  compositionCache.clear();
  composedCache.clear();
  return getComposition(input.compositionId);
}

export function invalidateTwinComposerCache(): void {
  compositionCache.clear();
  composedCache.clear();
}
