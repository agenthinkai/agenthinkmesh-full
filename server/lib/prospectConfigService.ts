/**
 * server/lib/prospectConfigService.ts
 *
 * Prospect Configuration Service — Sprint 1 Generic Configuration Layer
 *
 * Read order: DB → in-memory cache (5 min TTL) → hardcoded fallback → not-found error
 *
 * This service replaces the hardcoded client/src/config/prospectConfigs.ts over time.
 * During the transition period, the hardcoded configs remain as fallback so no existing
 * demo breaks. New configs should be created in the DB.
 *
 * Admin CRUD is exposed via tRPC procedures in server/routers/prospectConfigs.ts.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { prospectConfigs, type ProspectConfigRow, type InsertProspectConfigRow } from "../../drizzle/schema";

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  config: ProspectConfigRow;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCached(slug: string): ProspectConfigRow | null {
  const entry = cache.get(slug);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(slug);
    return null;
  }
  return entry.config;
}

function setCached(config: ProspectConfigRow): void {
  cache.set(config.slug, { config, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCache(slug?: string): void {
  if (slug) {
    cache.delete(slug);
  } else {
    cache.clear();
  }
}

// ── Hardcoded fallback registry ───────────────────────────────────────────────
// This is the minimal fallback — just slug + organizationName + industry + geography.
// The full config lives in client/src/config/prospectConfigs.ts for the frontend.
// When a slug is not in the DB, we return a synthetic ProspectConfigRow from this map.

const HARDCODED_FALLBACK: Record<string, Partial<ProspectConfigRow>> = {
  "bakalaria": {
    slug: "bakalaria",
    organizationName: "Bakalaria Food Industries",
    industry: "Food & Beverage Manufacturing",
    geography: "Kuwait",
    tagline: "Kuwait's Premier Food Manufacturer",
    status: "ACTIVE",
  },
  "core42": {
    slug: "core42",
    organizationName: "Core42",
    industry: "AI & Cloud Infrastructure",
    geography: "Abu Dhabi, UAE",
    tagline: "National AI Infrastructure",
    status: "ACTIVE",
  },
  "damac": {
    slug: "damac",
    organizationName: "DAMAC Properties",
    industry: "Real Estate Development",
    geography: "Dubai, UAE",
    tagline: "Luxury Real Estate",
    status: "ACTIVE",
  },
  "humain": {
    slug: "humain",
    organizationName: "Humain",
    industry: "AI & Technology",
    geography: "Saudi Arabia",
    tagline: "Saudi AI Vision 2030",
    status: "ACTIVE",
  },
  "sami": {
    slug: "sami",
    organizationName: "SAMI — Saudi Arabian Military Industries",
    industry: "Defense & Aerospace",
    geography: "Saudi Arabia",
    tagline: "Sovereign Defense AI",
    status: "ACTIVE",
  },
  "alghanim": {
    slug: "alghanim",
    organizationName: "Alghanim Industries",
    industry: "Industrial Conglomerate",
    geography: "Kuwait",
    tagline: "Kuwait Industrial Sovereignty",
    status: "ACTIVE",
  },
  "floward": {
    slug: "floward",
    organizationName: "Floward",
    industry: "E-Commerce & Perishable Logistics",
    geography: "Kuwait / GCC",
    tagline: "Farm to Door, Sovereign",
    status: "ACTIVE",
  },
  "uic": {
    slug: "uic",
    organizationName: "Union of Investment Companies",
    industry: "Financial Services & Asset Management",
    geography: "Kuwait",
    tagline: "Sovereign Financial Intelligence",
    status: "ACTIVE",
  },
};

function buildFallbackRow(slug: string): ProspectConfigRow | null {
  const fb = HARDCODED_FALLBACK[slug];
  if (!fb) return null;
  const now = Date.now();
  return {
    id: -1,
    slug,
    organizationName: fb.organizationName ?? slug,
    industry: fb.industry ?? "Unknown",
    geography: fb.geography ?? "Unknown",
    tagline: fb.tagline ?? null,
    primaryColor: fb.primaryColor ?? null,
    accentColor: fb.accentColor ?? null,
    logoUrl: fb.logoUrl ?? null,
    configJson: "{}",
    featureFlags: "[]",
    status: "ACTIVE",
    version: 1,
    versionHistory: "[]",
    importedFromHardcoded: 1,
    ownerId: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * getProspectConfig — fetch a single config by slug.
 * Read order: cache → DB → hardcoded fallback → null
 */
export async function getProspectConfig(slug: string): Promise<ProspectConfigRow | null> {
  // 1. Cache hit
  const cached = getCached(slug);
  if (cached) return cached;

  // 2. DB lookup
  const db = await getDb();
  if (db) {
    const [row] = await db
      .select()
      .from(prospectConfigs)
      .where(eq(prospectConfigs.slug, slug))
      .limit(1);
    if (row && row.status === "ACTIVE") {
      setCached(row);
      return row;
    }
  }

  // 3. Hardcoded fallback — cache it so subsequent calls don't hit DB again
  const fallback = buildFallbackRow(slug);
  if (fallback) setCached(fallback);
  return fallback;
}

/**
 * listProspectConfigs — list all ACTIVE configs.
 * Returns DB rows + hardcoded fallbacks for slugs not yet in the DB.
 */
export async function listProspectConfigs(): Promise<ProspectConfigRow[]> {
  const db = await getDb();
  const dbRows: ProspectConfigRow[] = db
    ? await db.select().from(prospectConfigs).where(eq(prospectConfigs.status, "ACTIVE"))
    : [];

  // Build set of slugs already in DB
  const dbSlugs = new Set(dbRows.map(r => r.slug));

  // Add hardcoded fallbacks for slugs not yet migrated
  const fallbacks = Object.keys(HARDCODED_FALLBACK)
    .filter(slug => !dbSlugs.has(slug))
    .map(slug => buildFallbackRow(slug))
    .filter((r): r is ProspectConfigRow => r !== null);

  return [...dbRows, ...fallbacks];
}

/**
 * createProspectConfig — insert a new config row.
 * Admin-only — enforce in the tRPC procedure layer.
 */
export async function createProspectConfig(
  data: Omit<InsertProspectConfigRow, "id" | "createdAt" | "updatedAt">
): Promise<ProspectConfigRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const now = Date.now();
  await db.insert(prospectConfigs).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  });

  const [inserted] = await db
    .select()
    .from(prospectConfigs)
    .where(eq(prospectConfigs.slug, data.slug))
    .limit(1);

  if (!inserted) throw new Error("Insert succeeded but row not found");
  invalidateCache(data.slug);
  return inserted;
}

/**
 * updateProspectConfig — update an existing config row by slug.
 * Increments version, appends previous configJson to versionHistory.
 * Admin-only — enforce in the tRPC procedure layer.
 */
export async function updateProspectConfig(
  slug: string,
  updates: Partial<Omit<InsertProspectConfigRow, "id" | "slug" | "createdAt" | "updatedAt">>
): Promise<ProspectConfigRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [existing] = await db
    .select()
    .from(prospectConfigs)
    .where(eq(prospectConfigs.slug, slug))
    .limit(1);

  if (!existing) throw new Error(`ProspectConfig not found: ${slug}`);

  // Append current configJson to versionHistory before overwriting
  let history: string[] = [];
  try { history = JSON.parse(existing.versionHistory ?? "[]"); } catch { /* noop */ }
  if (updates.configJson && updates.configJson !== existing.configJson) {
    history.push(existing.configJson);
    if (history.length > 20) history = history.slice(-20); // keep last 20
  }

  await db
    .update(prospectConfigs)
    .set({
      ...updates,
      version: existing.version + 1,
      versionHistory: JSON.stringify(history),
      updatedAt: Date.now(),
    })
    .where(eq(prospectConfigs.slug, slug));

  invalidateCache(slug);

  const [updated] = await db
    .select()
    .from(prospectConfigs)
    .where(eq(prospectConfigs.slug, slug))
    .limit(1);

  return updated;
}

/**
 * deleteProspectConfig — soft-delete by setting status = "ARCHIVED".
 * Hard delete is not supported — configs are audit records.
 * Admin-only — enforce in the tRPC procedure layer.
 */
export async function archiveProspectConfig(slug: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db
    .update(prospectConfigs)
    .set({ status: "ARCHIVED", updatedAt: Date.now() })
    .where(eq(prospectConfigs.slug, slug));

  invalidateCache(slug);
}
