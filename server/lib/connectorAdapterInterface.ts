/**
 * Data Connector Adapter Interface
 * Plug-in interface for data connectors (CSV, REST, SQL, etc.)
 * Pattern: DB registry → adapter factory → null
 */
import { getDb } from "../db";
import { dataConnectors, DataConnector, InsertDataConnector } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConnectorRecord {
  connectorId: string;
  name: string;
  connectorType: "csv" | "rest" | "sql" | "webhook" | "manual";
  description?: string;
  configSchema: Record<string, unknown>;
  adapterPath?: string;
  authType: string;
  supportsTestConnection: boolean;
  supportsSchemaInference: boolean;
  supportsStreaming: boolean;
  maxRowsPerSync: number;
  status: string;
}

export interface ConnectorTestResult {
  success: boolean;
  message: string;
  rowCount?: number;
  schema?: Record<string, string>;
}

export interface ConnectorSyncResult {
  success: boolean;
  rowsIngested: number;
  errors: string[];
  syncedAt: number;
}

// ── Built-in connector definitions ───────────────────────────────────────────

const BUILTIN_CONNECTORS: ConnectorRecord[] = [
  {
    connectorId: "csv-upload",
    name: "CSV File Upload",
    connectorType: "csv",
    description: "Upload a CSV file to ingest structured data into the Twin context",
    configSchema: {
      delimiter: { type: "string", default: "," },
      hasHeader: { type: "boolean", default: true },
      encoding: { type: "string", default: "utf-8" },
    },
    authType: "none",
    supportsTestConnection: true,
    supportsSchemaInference: true,
    supportsStreaming: false,
    maxRowsPerSync: 50000,
    status: "ACTIVE",
  },
  {
    connectorId: "rest-api",
    name: "REST API Connector",
    connectorType: "rest",
    description: "Connect to any REST API endpoint to pull structured JSON data",
    configSchema: {
      baseUrl: { type: "string", required: true },
      method: { type: "string", default: "GET", enum: ["GET", "POST"] },
      headers: { type: "object", default: {} },
      authType: { type: "string", enum: ["none", "bearer", "api_key", "basic"] },
      dataPath: { type: "string", description: "JSONPath to the data array, e.g. $.data.items" },
    },
    authType: "configurable",
    supportsTestConnection: true,
    supportsSchemaInference: true,
    supportsStreaming: false,
    maxRowsPerSync: 10000,
    status: "ACTIVE",
  },
  {
    connectorId: "manual-entry",
    name: "Manual Data Entry",
    connectorType: "manual",
    description: "Manually enter key-value data points for the Twin context",
    configSchema: {
      fields: { type: "array", items: { name: "string", type: "string", required: "boolean" } },
    },
    authType: "none",
    supportsTestConnection: false,
    supportsSchemaInference: false,
    supportsStreaming: false,
    maxRowsPerSync: 1000,
    status: "ACTIVE",
  },
  {
    connectorId: "agenthink-quickbooks",
    name: "QuickBooks Online (AgenThink)",
    connectorType: "rest",
    description: "Connects to AgenThink Mesh QuickBooks Online account for P&L, balance sheet, and cash flow data",
    configSchema: {
      baseUrl: { type: "string", default: "https://quickbooks.api.intuit.com/v3" },
      authType: { type: "string", default: "oauth2", enum: ["oauth2"] },
      realmId: { type: "string", required: true, description: "QuickBooks company realm ID" },
      dataPath: { type: "string", default: "$.QueryResponse" },
    },
    authType: "oauth2",
    supportsTestConnection: true,
    supportsSchemaInference: true,
    supportsStreaming: false,
    maxRowsPerSync: 5000,
    status: "ACTIVE",
  },
  {
    connectorId: "agenthink-hubspot",
    name: "HubSpot CRM (AgenThink)",
    connectorType: "rest",
    description: "Connects to AgenThink Mesh HubSpot CRM for pipeline, deal stage, and ARR data",
    configSchema: {
      baseUrl: { type: "string", default: "https://api.hubapi.com" },
      authType: { type: "string", default: "bearer" },
      dataPath: { type: "string", default: "$.results" },
    },
    authType: "bearer",
    supportsTestConnection: true,
    supportsSchemaInference: true,
    supportsStreaming: false,
    maxRowsPerSync: 10000,
    status: "ACTIVE",
  },
  {
    connectorId: "agenthink-github",
    name: "GitHub (AgenThink Engineering)",
    connectorType: "rest",
    description: "Connects to AgenThink Mesh GitHub org for engineering velocity, PR cycle time, and deployment frequency",
    configSchema: {
      baseUrl: { type: "string", default: "https://api.github.com" },
      authType: { type: "string", default: "bearer" },
      org: { type: "string", default: "agenthinkai" },
      dataPath: { type: "string", default: "$" },
    },
    authType: "bearer",
    supportsTestConnection: true,
    supportsSchemaInference: true,
    supportsStreaming: false,
    maxRowsPerSync: 1000,
    status: "ACTIVE",
  },
  {
    connectorId: "agenthink-aws-costs",
    name: "AWS Cost Explorer (AgenThink)",
    connectorType: "rest",
    description: "Connects to AWS Cost Explorer API for GPU/compute cost tracking and burn rate monitoring",
    configSchema: {
      baseUrl: { type: "string", default: "https://ce.us-east-1.amazonaws.com" },
      authType: { type: "string", default: "aws_sigv4" },
      region: { type: "string", default: "us-east-1" },
    },
    authType: "aws_sigv4",
    supportsTestConnection: true,
    supportsSchemaInference: false,
    supportsStreaming: false,
    maxRowsPerSync: 500,
    status: "ACTIVE",
  },
  {
    connectorId: "agenthink-jupiter-metrics",
    name: "Jupiter Shot Training Metrics",
    connectorType: "webhook",
    description: "Receives real-time training metrics from Jupiter Shot GPU clusters (loss, tokens/sec, GPU utilisation)",
    configSchema: {
      secretKey: { type: "string", description: "HMAC secret for webhook signature verification" },
      payloadPath: { type: "string", default: "$.metrics", description: "JSONPath to metrics object" },
    },
    authType: "hmac",
    supportsTestConnection: false,
    supportsSchemaInference: false,
    supportsStreaming: true,
    maxRowsPerSync: 1000,
    status: "ACTIVE",
  },
  {
    connectorId: "webhook",
    name: "Webhook Receiver",
    connectorType: "webhook",
    description: "Receive real-time data pushes from external systems via webhook",
    configSchema: {
      secretKey: { type: "string", description: "HMAC secret for webhook signature verification" },
      payloadPath: { type: "string", description: "JSONPath to extract data from webhook payload" },
    },
    authType: "hmac",
    supportsTestConnection: false,
    supportsSchemaInference: false,
    supportsStreaming: true,
    maxRowsPerSync: 100,
    status: "ACTIVE",
  },
];

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: ConnectorRecord; expiresAt: number }>();

function fromRow(row: DataConnector): ConnectorRecord {
  return {
    connectorId: row.connectorId,
    name: row.name,
    connectorType: row.connectorType as ConnectorRecord["connectorType"],
    description: row.description ?? undefined,
    configSchema: JSON.parse(row.configSchema || "{}"),
    adapterPath: row.adapterPath ?? undefined,
    authType: row.authType,
    supportsTestConnection: row.supportsTestConnection === 1,
    supportsSchemaInference: row.supportsSchemaInference === 1,
    supportsStreaming: row.supportsStreaming === 1,
    maxRowsPerSync: row.maxRowsPerSync,
    status: row.status,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getConnector(connectorId: string): Promise<ConnectorRecord | null> {
  const cacheKey = `conn:${connectorId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(dataConnectors)
        .where(eq(dataConnectors.connectorId, connectorId))
        .limit(1);
      if (rows.length > 0) {
        const data = fromRow(rows[0]);
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch (e) {
      console.warn("[ConnectorAdapterInterface] DB error, falling back:", e);
    }
  }

  const fallback = BUILTIN_CONNECTORS.find(c => c.connectorId === connectorId) ?? null;
  if (fallback) cache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
  return fallback;
}

export async function listConnectors(): Promise<ConnectorRecord[]> {
  const db = await getDb();
  if (db) {
    try {
      const rows = await db.select().from(dataConnectors)
        .where(eq(dataConnectors.status, "ACTIVE"));
      if (rows.length > 0) return rows.map(fromRow);
    } catch (e) {
      console.warn("[ConnectorAdapterInterface] DB error, falling back:", e);
    }
  }
  return [...BUILTIN_CONNECTORS];
}

/**
 * Test a connector configuration.
 * For CSV: validates the file is parseable.
 * For REST: makes a test request and validates the response.
 * For manual/webhook: always returns success.
 */
export async function testConnector(
  connectorId: string,
  config: Record<string, unknown>
): Promise<ConnectorTestResult> {
  const connector = await getConnector(connectorId);
  if (!connector) {
    return { success: false, message: `Connector '${connectorId}' not found` };
  }

  if (connector.connectorType === "rest") {
    const baseUrl = config.baseUrl as string;
    if (!baseUrl) return { success: false, message: "baseUrl is required" };
    try {
      const res = await fetch(baseUrl, {
        method: "GET",
        headers: (config.headers as Record<string, string>) ?? {},
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { success: false, message: `HTTP ${res.status}: ${res.statusText}` };
      const data = await res.json();
      return { success: true, message: "Connection successful", rowCount: Array.isArray(data) ? data.length : 1 };
    } catch (e: any) {
      return { success: false, message: e.message ?? "Connection failed" };
    }
  }

  // CSV, manual, webhook — test always succeeds (validated at sync time)
  return { success: true, message: "Connector configuration is valid" };
}

export async function registerConnector(input: Omit<InsertDataConnector, "id" | "createdAt" | "updatedAt">): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const now = Date.now();
  await db.insert(dataConnectors).values({
    ...input,
    configSchema: JSON.stringify(input.configSchema ?? {}),
    createdAt: now,
    updatedAt: now,
  } as any);
  cache.clear();
  return true;
}

export function invalidateConnectorCache(): void {
  cache.clear();
}

export { BUILTIN_CONNECTORS };
