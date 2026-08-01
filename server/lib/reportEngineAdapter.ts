/**
 * server/lib/reportEngineAdapter.ts
 *
 * Report Engine Adapter — Sprint 1 Generic Configuration Layer
 *
 * Provides a unified interface over the existing PDF generators.
 * The adapter pattern means existing generators are NOT deleted or modified.
 * New generators can be added to the DB registry without code changes.
 *
 * Current generator inventory (from architectural audit):
 * - dossierPdfRouter (deal dossier)
 * - proofEngineRouter (institutional proof)
 * - boardPackRouter (board pack)
 * - legalRedlinePdf (legal redline)
 * - pilotConversionRouter (pilot conversion)
 *
 * The adapter wraps these as "legacy" generators and registers them in the
 * report_templates DB table for discoverability.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { reportTemplates, type ReportTemplate, type InsertReportTemplate } from "../../drizzle/schema";

// ── Generator type ────────────────────────────────────────────────────────────

export type GeneratorType = "legacy" | "template" | "llm";

export interface ReportGeneratorManifest {
  templateId: string;
  name: string;
  description: string;
  generatorPath: string;
  generatorType: GeneratorType;
  requiredInputs: string[];
  supportsPageNumbers: boolean;
  supportsHeaderFooter: boolean;
}

// ── Hardcoded manifest for existing generators ────────────────────────────────
// These are the generators that existed before Sprint 1.
// They are registered here for discoverability but NOT modified.

export const LEGACY_GENERATORS: ReportGeneratorManifest[] = [
  {
    templateId: "deal_dossier",
    name: "Deal Dossier PDF",
    description: "Institutional deal dossier with financial analysis, risk assessment, and governance proof.",
    generatorPath: "server/routers/dossierPdf.ts",
    generatorType: "legacy",
    requiredInputs: ["dealId", "userId"],
    supportsPageNumbers: true,
    supportsHeaderFooter: true,
  },
  {
    templateId: "institutional_proof",
    name: "Institutional Proof Report",
    description: "Machine-verifiable institutional proof with Council verdicts, constitution hash, and calibration data.",
    generatorPath: "server/routers/proofEngine.ts",
    generatorType: "legacy",
    requiredInputs: ["sessionId", "userId"],
    supportsPageNumbers: true,
    supportsHeaderFooter: true,
  },
  {
    templateId: "board_pack",
    name: "Board Pack Report",
    description: "Executive board pack with strategic recommendations, scenario analysis, and governance summary.",
    generatorPath: "server/routers/aros.ts#boardPackRouter",
    generatorType: "legacy",
    requiredInputs: ["sessionId", "userId"],
    supportsPageNumbers: true,
    supportsHeaderFooter: true,
  },
  {
    templateId: "legal_redline",
    name: "Legal Redline Report",
    description: "Legal contract redline with clause-level risk scoring and attorney-client privilege metadata.",
    generatorPath: "server/routers/openclaw.ts",
    generatorType: "legacy",
    requiredInputs: ["documentId", "userId"],
    supportsPageNumbers: true,
    supportsHeaderFooter: false,
  },
  {
    templateId: "pilot_conversion",
    name: "Pilot Conversion Report",
    description: "Pilot-to-production conversion analysis with ROI calculation and deployment roadmap.",
    generatorPath: "server/routers/pilotConversion.ts",
    generatorType: "legacy",
    requiredInputs: ["pilotId", "userId"],
    supportsPageNumbers: true,
    supportsHeaderFooter: true,
  },
];

// ── In-memory cache ───────────────────────────────────────────────────────────

let templatesCache: ReportTemplate[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export function invalidateReportTemplateCache(): void {
  templatesCache = null;
  cacheExpiresAt = 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * listReportTemplates — list all ACTIVE report templates.
 * Returns DB rows + legacy generator manifests for templates not yet in DB.
 */
export async function listReportTemplates(): Promise<ReportTemplate[]> {
  if (templatesCache && Date.now() < cacheExpiresAt) {
    return templatesCache;
  }

  const db = await getDb();
  const dbRows: ReportTemplate[] = db
    ? await db
        .select()
        .from(reportTemplates)
        .where(eq(reportTemplates.status, "ACTIVE"))
    : [];

  const dbIds = new Set(dbRows.map(r => r.templateId));
  const now = Date.now();

  const fallbacks: ReportTemplate[] = LEGACY_GENERATORS
    .filter(g => !dbIds.has(g.templateId))
    .map(g => ({
      id: -1,
      templateId: g.templateId,
      name: g.name,
      description: g.description,
      generatorPath: g.generatorPath,
      generatorType: g.generatorType,
      status: "ACTIVE",
      brandingJson: "{}",
      requiredInputs: JSON.stringify(g.requiredInputs),
      supportsPageNumbers: g.supportsPageNumbers ? 1 : 0,
      supportsHeaderFooter: g.supportsHeaderFooter ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }));

  const result = [...dbRows, ...fallbacks];
  templatesCache = result;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return result;
}

/**
 * getReportTemplate — fetch a single template by templateId.
 */
export async function getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
  const all = await listReportTemplates();
  return all.find(t => t.templateId === templateId) ?? null;
}

/**
 * registerReportTemplate — insert a new template into the DB registry.
 * Admin-only — enforce in the tRPC procedure layer.
 */
export async function registerReportTemplate(
  data: Omit<InsertReportTemplate, "id" | "createdAt" | "updatedAt">
): Promise<ReportTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const now = Date.now();
  await db.insert(reportTemplates).values({ ...data, createdAt: now, updatedAt: now });

  const [inserted] = await db
    .select()
    .from(reportTemplates)
    .where(eq(reportTemplates.templateId, data.templateId))
    .limit(1);

  if (!inserted) throw new Error("Insert succeeded but row not found");
  invalidateReportTemplateCache();
  return inserted;
}

/**
 * getGeneratorManifest — get the manifest for a legacy generator by templateId.
 * Returns null if the templateId is not a legacy generator.
 */
export function getGeneratorManifest(templateId: string): ReportGeneratorManifest | null {
  return LEGACY_GENERATORS.find(g => g.templateId === templateId) ?? null;
}
