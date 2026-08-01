/**
 * server/lib/workflowProtocolService.ts
 *
 * Workflow Protocol Registry Service — Sprint 1 Generic Configuration Layer
 *
 * The WORKFLOW_REGISTRY in multiAgentSolve.ts currently has one entry (rosie_protocol).
 * This service provides a DB-backed registry that falls back to the hardcoded entry.
 *
 * Read order: DB → in-memory cache (10 min TTL) → hardcoded fallback → null
 *
 * Admin CRUD is exposed via tRPC procedures in server/routers/workflowProtocols.ts.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  workflowProtocolRegistry,
  type WorkflowProtocolRegistryRow,
  type InsertWorkflowProtocolRegistryRow,
} from "../../drizzle/schema";

// ── In-memory cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  protocol: WorkflowProtocolRegistryRow;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, CacheEntry>();

function getCached(protocolId: string): WorkflowProtocolRegistryRow | null {
  const entry = cache.get(protocolId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(protocolId);
    return null;
  }
  return entry.protocol;
}

function setCached(protocol: WorkflowProtocolRegistryRow): void {
  cache.set(protocol.protocolId, { protocol, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateProtocolCache(protocolId?: string): void {
  if (protocolId) {
    cache.delete(protocolId);
  } else {
    cache.clear();
  }
}

// ── Hardcoded fallback registry ───────────────────────────────────────────────
// Mirrors the WORKFLOW_REGISTRY in multiAgentSolve.ts.
// When a protocolId is not in the DB, we return a synthetic row from this map.

const HARDCODED_PROTOCOLS: Record<string, Partial<WorkflowProtocolRegistryRow>> = {
  "rosie_protocol": {
    protocolId: "rosie_protocol",
    name: "ROSIE Protocol — Research Oncology Sovereign Intelligence Engine",
    version: "1.0.0",
    description: "Multi-agent cancer research workflow: literature review, clinical trial analysis, biomarker discovery, regulatory pathway assessment, and institutional proof generation.",
    supportedTwinTypes: JSON.stringify(["research", "clinical", "regulatory"]),
    status: "ACTIVE",
    agentCount: 5,
    estimatedDurationSec: 120,
  },
  "gcc_deal_screening": {
    protocolId: "gcc_deal_screening",
    name: "GCC Deal Screening Protocol",
    version: "1.0.0",
    description: "Multi-agent GCC investment deal screening: market analysis, financial modelling, regulatory compliance, ESG assessment, and institutional proof generation.",
    supportedTwinTypes: JSON.stringify(["investment", "deal", "financial"]),
    status: "DRAFT",
    agentCount: 6,
    estimatedDurationSec: 90,
  },
  "industrial_ops": {
    protocolId: "industrial_ops",
    name: "Industrial Operations Protocol",
    version: "1.0.0",
    description: "Multi-agent industrial operations workflow: predictive maintenance, supply chain optimisation, quality control, energy management, and operational proof generation.",
    supportedTwinTypes: JSON.stringify(["industrial", "manufacturing", "operations"]),
    status: "DRAFT",
    agentCount: 5,
    estimatedDurationSec: 80,
  },
  "sovereign_defense": {
    protocolId: "sovereign_defense",
    name: "Sovereign Defense Protocol",
    version: "1.0.0",
    description: "Multi-agent defense AI workflow: threat assessment, tactical simulation, sovereignty compliance, ITAR/EAR audit, and operational proof generation.",
    supportedTwinTypes: JSON.stringify(["defense", "security", "tactical"]),
    status: "DRAFT",
    agentCount: 5,
    estimatedDurationSec: 60,
  },
};

function buildFallbackRow(protocolId: string): WorkflowProtocolRegistryRow | null {
  const fb = HARDCODED_PROTOCOLS[protocolId];
  if (!fb) return null;
  const now = Date.now();
  return {
    id: -1,
    protocolId,
    name: fb.name ?? protocolId,
    version: fb.version ?? "1.0.0",
    description: fb.description ?? null,
    supportedTwinTypes: fb.supportedTwinTypes ?? "[]",
    status: fb.status ?? "DRAFT",
    tenantAvailability: fb.tenantAvailability ?? null,
    configSchemaRef: fb.configSchemaRef ?? null,
    reportTemplateRef: fb.reportTemplateRef ?? null,
    agentCount: fb.agentCount ?? 0,
    estimatedDurationSec: fb.estimatedDurationSec ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getWorkflowProtocol(
  protocolId: string
): Promise<WorkflowProtocolRegistryRow | null> {
  const cached = getCached(protocolId);
  if (cached) return cached;

  const db = await getDb();
  if (db) {
    const [row] = await db
      .select()
      .from(workflowProtocolRegistry)
      .where(eq(workflowProtocolRegistry.protocolId, protocolId))
      .limit(1);
    if (row && row.status !== "ARCHIVED") {
      setCached(row);
      return row;
    }
  }

  const fallback = buildFallbackRow(protocolId);
  if (fallback) setCached(fallback);
  return fallback;
}

export async function listWorkflowProtocols(): Promise<WorkflowProtocolRegistryRow[]> {
  const db = await getDb();
  const dbRows: WorkflowProtocolRegistryRow[] = db
    ? await db
        .select()
        .from(workflowProtocolRegistry)
        .where(eq(workflowProtocolRegistry.status, "ACTIVE"))
    : [];

  const dbIds = new Set(dbRows.map(r => r.protocolId));
  const fallbacks = Object.keys(HARDCODED_PROTOCOLS)
    .filter(id => !dbIds.has(id))
    .map(id => buildFallbackRow(id))
    .filter((r): r is WorkflowProtocolRegistryRow => r !== null);

  return [...dbRows, ...fallbacks];
}

export async function createWorkflowProtocol(
  data: Omit<InsertWorkflowProtocolRegistryRow, "id" | "createdAt" | "updatedAt">
): Promise<WorkflowProtocolRegistryRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const now = Date.now();
  await db.insert(workflowProtocolRegistry).values({ ...data, createdAt: now, updatedAt: now });

  const [inserted] = await db
    .select()
    .from(workflowProtocolRegistry)
    .where(eq(workflowProtocolRegistry.protocolId, data.protocolId))
    .limit(1);

  if (!inserted) throw new Error("Insert succeeded but row not found");
  invalidateProtocolCache(data.protocolId);
  return inserted;
}

export async function updateWorkflowProtocol(
  protocolId: string,
  updates: Partial<Omit<InsertWorkflowProtocolRegistryRow, "id" | "protocolId" | "createdAt" | "updatedAt">>
): Promise<WorkflowProtocolRegistryRow> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [existing] = await db
    .select()
    .from(workflowProtocolRegistry)
    .where(eq(workflowProtocolRegistry.protocolId, protocolId))
    .limit(1);

  if (!existing) throw new Error(`Protocol not found: ${protocolId}`);

  await db
    .update(workflowProtocolRegistry)
    .set({ ...updates, updatedAt: Date.now() })
    .where(eq(workflowProtocolRegistry.protocolId, protocolId));

  invalidateProtocolCache(protocolId);

  const [updated] = await db
    .select()
    .from(workflowProtocolRegistry)
    .where(eq(workflowProtocolRegistry.protocolId, protocolId))
    .limit(1);

  return updated;
}
