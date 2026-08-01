/**
 * Twin Factory Router
 * Sprint 2A: Unified admin router for all Decision Twin Factory registries.
 * Covers: TwinBlueprints, CouncilPersonas, Ontologies, DecisionTypes, KPIs,
 *         ReportRegistry, SimulationPlugins, DataConnectors, TwinCompositions
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

import {
  getBlueprintById,
  listBlueprints,
  createBlueprint,
  FALLBACK_BLUEPRINTS,
} from "../lib/twinBlueprintService";

import {
  getPersonaSet,
  getPersonaSetByIndustry,
  listPersonaSets,
  createPersona,
  FALLBACK_PERSONA_SETS,
} from "../lib/councilPersonaService";

import {
  getOntology,
  getOntologyByIndustry,
  listOntologies,
  createOntology,
} from "../lib/ontologyService";

import {
  getDecisionType,
  listDecisionTypes,
  createDecisionType,
} from "../lib/decisionTypeService";

import {
  getKpiSet,
  listKpiSets,
  createKpi,
} from "../lib/kpiService";

import {
  getReportType,
  listReportTypes,
  createReportType,
} from "../lib/reportRegistryService";

import {
  getSimulationPlugin,
  listSimulationPlugins,
  createSimulationPlugin,
} from "../lib/simulationRegistryService";

import {
  getConnector,
  listConnectors,
  testConnector,
  registerConnector,
} from "../lib/connectorAdapterInterface";

import {
  getComposition,
  listCompositions,
  composeBlueprints,
  createComposition,
} from "../lib/twinComposerService";

// ── Helper: admin guard ───────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ── Router ────────────────────────────────────────────────────────────────────
export const twinFactoryRouter = router({

  // ── Twin Blueprints ─────────────────────────────────────────────────────────
  blueprints: router({
    list: publicProcedure
      .input(z.object({ industryTag: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return listBlueprints(input?.industryTag);
      }),

    get: publicProcedure
      .input(z.object({ blueprintId: z.string() }))
      .query(async ({ input }) => {
        const bp = await getBlueprintById(input.blueprintId);
        if (!bp) throw new TRPCError({ code: "NOT_FOUND", message: "Blueprint not found" });
        return bp;
      }),

    create: adminProcedure
      .input(z.object({
        blueprintId: z.string(),
        name: z.string(),
        industry: z.string(),
        subIndustry: z.string().optional(),
        geography: z.string().default("GCC"),
        description: z.string().optional(),
        defaultCouncilPersonaSetId: z.string().optional(),
        defaultKpiSetId: z.string().optional(),
        defaultSimulationMode: z.string().default("institutional"),
        defaultDecisionTypeId: z.string().optional(),
        contextSchema: z.record(z.string(), z.unknown()).optional(),
        promptTemplate: z.string().optional(),
        brandingConfig: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createBlueprint(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create blueprint" });
        return { success: true };
      }),

    listFallbacks: adminProcedure.query(() => FALLBACK_BLUEPRINTS),
  }),

  // ── Council Personas ────────────────────────────────────────────────────────
  councilPersonas: router({
    listSets: publicProcedure.query(async () => {
      return listPersonaSets();
    }),

    getByIndustry: publicProcedure
      .input(z.object({ industryTag: z.string() }))
      .query(async ({ input }) => {
        return getPersonaSetByIndustry(input.industryTag);
      }),

    getSet: publicProcedure
      .input(z.object({ personaSetId: z.string() }))
      .query(async ({ input }) => {
        return getPersonaSet(input.personaSetId);
      }),

    create: adminProcedure
      .input(z.object({
        personaId: z.string(),
        personaSetId: z.string(),
        industryTag: z.string(),
        name: z.string(),
        title: z.string(),
        expertise: z.array(z.string()),
        biasProfile: z.record(z.string(), z.unknown()).optional(),
        votingWeight: z.number().default(1.0),
        deliberationStyle: z.string().default("analytical"),
        systemPromptFragment: z.string().optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createPersona(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create persona" });
        return { success: true };
      }),

    listFallbackSets: adminProcedure.query(() => Object.keys(FALLBACK_PERSONA_SETS)),
  }),

  // ── Domain Ontologies ───────────────────────────────────────────────────────
  ontologies: router({
    list: publicProcedure.query(async () => listOntologies()),

    getByIndustry: publicProcedure
      .input(z.object({ industryTag: z.string() }))
      .query(async ({ input }) => {
        const ontology = await getOntologyByIndustry(input.industryTag);
        if (!ontology) throw new TRPCError({ code: "NOT_FOUND", message: "Ontology not found for industry" });
        return ontology;
      }),

    get: publicProcedure
      .input(z.object({ ontologyId: z.string() }))
      .query(async ({ input }) => {
        const ontology = await getOntology(input.ontologyId);
        if (!ontology) throw new TRPCError({ code: "NOT_FOUND", message: "Ontology not found" });
        return ontology;
      }),

    create: adminProcedure
      .input(z.object({
        ontologyId: z.string(),
        name: z.string(),
        industryTag: z.string(),
        version: z.string().default("1.0"),
        entities: z.array(z.string()),
        relationships: z.array(z.string()),
        terminology: z.record(z.string(), z.string()),
        regulatoryContext: z.record(z.string(), z.unknown()).optional(),
        geographicContext: z.record(z.string(), z.unknown()).optional(),
        systemPromptFragment: z.string().optional(),
        evaluationCriteria: z.string().optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createOntology(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create ontology" });
        return { success: true };
      }),
  }),

  // ── Decision Types ──────────────────────────────────────────────────────────
  decisionTypes: router({
    list: publicProcedure
      .input(z.object({ industryTag: z.string().optional() }).optional())
      .query(async ({ input }) => listDecisionTypes(input?.industryTag)),

    get: publicProcedure
      .input(z.object({ decisionTypeId: z.string() }))
      .query(async ({ input }) => {
        const dt = await getDecisionType(input.decisionTypeId);
        if (!dt) throw new TRPCError({ code: "NOT_FOUND", message: "Decision type not found" });
        return dt;
      }),

    create: adminProcedure
      .input(z.object({
        decisionTypeId: z.string(),
        name: z.string(),
        category: z.string(),
        description: z.string().optional(),
        defaultCouncilPersonaSetId: z.string().optional(),
        defaultKpiSetId: z.string().optional(),
        defaultSimulationMode: z.string().default("institutional"),
        evaluationFramework: z.record(z.string(), z.unknown()).optional(),
        requiredInputFields: z.array(z.string()).optional(),
        outputSchema: z.record(z.string(), z.unknown()).optional(),
        industryTags: z.array(z.string()).optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createDecisionType(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create decision type" });
        return { success: true };
      }),
  }),

  // ── KPI Definitions ─────────────────────────────────────────────────────────
  kpis: router({
    listSets: publicProcedure.query(async () => listKpiSets()),

    getSet: publicProcedure
      .input(z.object({ kpiSetId: z.string() }))
      .query(async ({ input }) => getKpiSet(input.kpiSetId)),

    create: adminProcedure
      .input(z.object({
        kpiId: z.string(),
        kpiSetId: z.string(),
        industryTag: z.string(),
        name: z.string(),
        label: z.string(),
        unit: z.string().optional(),
        direction: z.enum(["higher", "lower", "target"]),
        threshold: z.object({ good: z.number(), warning: z.number(), critical: z.number() }),
        benchmarkSource: z.string().optional(),
        description: z.string().optional(),
        formula: z.string().optional(),
        category: z.string().optional(),
        sortOrder: z.number().default(0),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createKpi(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create KPI" });
        return { success: true };
      }),
  }),

  // ── Report Registry ─────────────────────────────────────────────────────────
  reports: router({
    list: publicProcedure
      .input(z.object({ industryTag: z.string().optional() }).optional())
      .query(async ({ input }) => listReportTypes(input?.industryTag)),

    get: publicProcedure
      .input(z.object({ reportTypeId: z.string() }))
      .query(async ({ input }) => {
        const rt = await getReportType(input.reportTypeId);
        if (!rt) throw new TRPCError({ code: "NOT_FOUND", message: "Report type not found" });
        return rt;
      }),

    create: adminProcedure
      .input(z.object({
        reportTypeId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        category: z.string(),
        outputFormat: z.string().default("pdf"),
        templateSchema: z.record(z.string(), z.unknown()).optional(),
        requiredSections: z.array(z.string()).optional(),
        optionalSections: z.array(z.string()).optional(),
        brandingDefaults: z.record(z.string(), z.unknown()).optional(),
        industryTags: z.array(z.string()).optional(),
        generatorType: z.string().default("template"),
        legacyGeneratorPath: z.string().optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createReportType(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create report type" });
        return { success: true };
      }),
  }),

  // ── Simulation Plugins ──────────────────────────────────────────────────────
  simulations: router({
    list: publicProcedure
      .input(z.object({ industryTag: z.string().optional() }).optional())
      .query(async ({ input }) => listSimulationPlugins(input?.industryTag)),

    get: publicProcedure
      .input(z.object({ pluginId: z.string() }))
      .query(async ({ input }) => {
        const plugin = await getSimulationPlugin(input.pluginId);
        if (!plugin) throw new TRPCError({ code: "NOT_FOUND", message: "Simulation plugin not found" });
        return plugin;
      }),

    create: adminProcedure
      .input(z.object({
        pluginId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        category: z.string(),
        engineType: z.string(),
        configSchema: z.record(z.string(), z.unknown()).optional(),
        defaultConfig: z.record(z.string(), z.unknown()).optional(),
        maxScenarioCount: z.number().default(1000),
        costTier: z.enum(["low", "medium", "high"]).default("medium"),
        requiresConfirmation: z.boolean().default(false),
        industryTags: z.array(z.string()).optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await createSimulationPlugin(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create simulation plugin" });
        return { success: true };
      }),
  }),

  // ── Data Connectors ─────────────────────────────────────────────────────────
  connectors: router({
    list: publicProcedure.query(async () => listConnectors()),

    get: publicProcedure
      .input(z.object({ connectorId: z.string() }))
      .query(async ({ input }) => {
        const conn = await getConnector(input.connectorId);
        if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
        return conn;
      }),

    test: protectedProcedure
      .input(z.object({
        connectorId: z.string(),
        config: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        return testConnector(input.connectorId, input.config);
      }),

    register: adminProcedure
      .input(z.object({
        connectorId: z.string(),
        name: z.string(),
        connectorType: z.enum(["csv", "rest", "sql", "webhook", "manual"]),
        description: z.string().optional(),
        configSchema: z.record(z.string(), z.unknown()).optional(),
        adapterPath: z.string().optional(),
        authType: z.string().default("none"),
        supportsTestConnection: z.boolean().default(false),
        supportsSchemaInference: z.boolean().default(false),
        supportsStreaming: z.boolean().default(false),
        maxRowsPerSync: z.number().default(10000),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const success = await registerConnector(input as any);
        if (!success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to register connector" });
        return { success: true };
      }),

    /**
     * syncCsv — Sprint 3 WP-4
     * Accepts raw CSV text (uploaded by client), parses it, validates row count against
     * the connector's maxRowsPerSync limit, and returns a ConnectorSyncResult.
     * The parsed rows are returned so the caller can persist them to the twin context.
     */
    syncCsv: protectedProcedure
      .input(z.object({
        connectorId: z.string().default("csv-upload"),
        csvText: z.string().min(1).max(10_000_000), // 10 MB text limit
        delimiter: z.string().max(3).default(","),
        hasHeader: z.boolean().default(true),
        maxRows: z.number().int().min(1).max(100_000).default(10_000),
      }))
      .mutation(async ({ input }): Promise<{ success: boolean; rowsIngested: number; headers: string[]; rows: Record<string, string>[]; errors: string[]; syncedAt: number }> => {
        const conn = await getConnector(input.connectorId);
        if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: `Connector '${input.connectorId}' not found` });
        if (conn.connectorType !== "csv") throw new TRPCError({ code: "BAD_REQUEST", message: "Connector is not of type csv" });

        const lines = input.csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const effectiveLimit = Math.min(input.maxRows, conn.maxRowsPerSync);
        const errors: string[] = [];

        if (lines.length === 0) {
          return { success: false, rowsIngested: 0, headers: [], rows: [], errors: ["Empty CSV"], syncedAt: Date.now() };
        }

        const splitLine = (line: string) =>
          line.split(input.delimiter).map((cell) => cell.replace(/^"|"$/g, "").trim());

        const headers = input.hasHeader ? splitLine(lines[0]) : lines[0].split(input.delimiter).map((_, i) => `col_${i}`);
        const dataLines = input.hasHeader ? lines.slice(1) : lines;

        if (dataLines.length > effectiveLimit) {
          errors.push(`Row count (${dataLines.length}) exceeds limit (${effectiveLimit}). Truncating.`);
        }

        const rows: Record<string, string>[] = [];
        for (const line of dataLines.slice(0, effectiveLimit)) {
          const cells = splitLine(line);
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
          rows.push(row);
        }

        return {
          success: true,
          rowsIngested: rows.length,
          headers,
          rows,
          errors,
          syncedAt: Date.now(),
        };
      }),

    /**
     * syncExcel — Sprint 3 WP-5
     * Accepts a base64-encoded XLSX/XLS file, parses the first sheet using
     * a simple tab/comma-delimited text extraction, and returns rows.
     * Full XLSX binary parsing requires a library (xlsx/exceljs) — this
     * implementation provides the server-side procedure contract and a
     * lightweight CSV-fallback for TSV exports from Excel.
     */
    syncExcel: protectedProcedure
      .input(z.object({
        connectorId: z.string().default("csv-upload"),
        tsvText: z.string().min(1).max(10_000_000), // TSV text exported from Excel
        hasHeader: z.boolean().default(true),
        maxRows: z.number().int().min(1).max(100_000).default(10_000),
        sheetName: z.string().optional(), // informational only for now
      }))
      .mutation(async ({ input }): Promise<{ success: boolean; rowsIngested: number; headers: string[]; rows: Record<string, string>[]; errors: string[]; syncedAt: number }> => {
        // Delegate to the same tab-delimited parsing logic as syncCsv
        const lines = input.tsvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const effectiveLimit = input.maxRows;
        const errors: string[] = [];

        if (lines.length === 0) {
          return { success: false, rowsIngested: 0, headers: [], rows: [], errors: ["Empty TSV"], syncedAt: Date.now() };
        }

        const splitLine = (line: string) => line.split("\t").map((cell) => cell.replace(/^"|"$/g, "").trim());
        const headers = input.hasHeader ? splitLine(lines[0]) : lines[0].split("\t").map((_, i) => `col_${i}`);
        const dataLines = input.hasHeader ? lines.slice(1) : lines;

        if (dataLines.length > effectiveLimit) {
          errors.push(`Row count (${dataLines.length}) exceeds limit (${effectiveLimit}). Truncating.`);
        }

        const rows: Record<string, string>[] = [];
        for (const line of dataLines.slice(0, effectiveLimit)) {
          const cells = splitLine(line);
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
          rows.push(row);
        }

        return { success: true, rowsIngested: rows.length, headers, rows, errors, syncedAt: Date.now() };
      }),

    /**
     * syncRest — Sprint 3 WP-6
     * Fetches JSON data from a REST endpoint (GET) and returns the array of records.
     * Supports optional bearer token auth and a JSONPath-like root key to extract the array.
     */
    syncRest: protectedProcedure
      .input(z.object({
        url: z.string().url(),
        bearerToken: z.string().optional(),
        rootKey: z.string().optional(), // e.g. "data" or "results" to drill into the response
        maxRows: z.number().int().min(1).max(10_000).default(1_000),
        timeoutMs: z.number().int().min(1000).max(30_000).default(10_000),
      }))
      .mutation(async ({ input }): Promise<{ success: boolean; rowsIngested: number; rows: Record<string, unknown>[]; errors: string[]; syncedAt: number }> => {
        const errors: string[] = [];
        let rows: Record<string, unknown>[] = [];

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), input.timeoutMs);
          const headers: Record<string, string> = { "Accept": "application/json" };
          if (input.bearerToken) headers["Authorization"] = `Bearer ${input.bearerToken}`;

          const resp = await fetch(input.url, { headers, signal: controller.signal });
          clearTimeout(timer);

          if (!resp.ok) {
            errors.push(`HTTP ${resp.status}: ${resp.statusText}`);
            return { success: false, rowsIngested: 0, rows: [], errors, syncedAt: Date.now() };
          }

          const json = await resp.json() as unknown;
          let data: unknown = json;
          if (input.rootKey) {
            data = (json as Record<string, unknown>)[input.rootKey];
          }

          if (!Array.isArray(data)) {
            // Wrap single object in array
            data = [data];
          }

          rows = (data as Record<string, unknown>[]).slice(0, input.maxRows);
          if ((data as unknown[]).length > input.maxRows) {
            errors.push(`Response contained ${(data as unknown[]).length} rows; truncated to ${input.maxRows}.`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Fetch error: ${msg}`);
          return { success: false, rowsIngested: 0, rows: [], errors, syncedAt: Date.now() };
        }

        return { success: true, rowsIngested: rows.length, rows, errors, syncedAt: Date.now() };
      }),

    /**
     * syncSql — Sprint 3 WP-7
     * Executes a read-only SQL query against the platform's own database
     * (for internal data federation) and returns the result rows.
     * External SQL connections require a separate connector config; this
     * procedure exposes the internal DB for cross-module data federation.
     */
    syncSql: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(4000),
        maxRows: z.number().int().min(1).max(10_000).default(1_000),
      }))
      .mutation(async ({ input }): Promise<{ success: boolean; rowsIngested: number; rows: Record<string, unknown>[]; errors: string[]; syncedAt: number }> => {
        // Security: only allow SELECT statements
        const trimmed = input.query.trim().toUpperCase();
        if (!trimmed.startsWith("SELECT")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only SELECT queries are permitted in syncSql" });
        }

        const db = await getDb();
        const errors: string[] = [];
        let rows: Record<string, unknown>[] = [];

        try {
          const raw = await db.execute(input.query as any) as unknown;
          // Drizzle execute returns [rows, fields] for MySQL
          const rawRows = Array.isArray(raw) ? (raw[0] as Record<string, unknown>[]) : (raw as Record<string, unknown>[]);
          rows = rawRows.slice(0, input.maxRows);
          if (rawRows.length > input.maxRows) {
            errors.push(`Query returned ${rawRows.length} rows; truncated to ${input.maxRows}.`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `SQL error: ${msg}` });
        }

        return { success: true, rowsIngested: rows.length, rows, errors, syncedAt: Date.now() };
      }),
  }),

  // ── Twin Compositions ───────────────────────────────────────────────────────
  compositions: router({
    list: protectedProcedure.query(async () => listCompositions()),

    get: protectedProcedure
      .input(z.object({ compositionId: z.string() }))
      .query(async ({ input }) => {
        const comp = await getComposition(input.compositionId);
        if (!comp) throw new TRPCError({ code: "NOT_FOUND", message: "Composition not found" });
        return comp;
      }),

    compose: protectedProcedure
      .input(z.object({
        blueprintIds: z.array(z.string()).min(1).max(5),
        councilMergeStrategy: z.enum(["weighted", "union", "primary_only"]).optional(),
        kpiAggregationStrategy: z.enum(["weighted_avg", "union", "primary_only"]).optional(),
        name: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const composed = await composeBlueprints(input.blueprintIds, {
          councilMergeStrategy: input.councilMergeStrategy,
          kpiAggregationStrategy: input.kpiAggregationStrategy,
          name: input.name,
        });
        if (!composed) throw new TRPCError({ code: "NOT_FOUND", message: "One or more blueprints not found" });
        return composed;
      }),

    create: adminProcedure
      .input(z.object({
        compositionId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        componentBlueprintIds: z.array(z.string()),
        conflictResolutionStrategy: z.enum(["union", "intersection", "primary_wins"]).default("union"),
        councilMergeStrategy: z.enum(["weighted", "union", "primary_only"]).default("union"),
        kpiAggregationStrategy: z.enum(["weighted_avg", "union", "primary_only"]).default("union"),
        outputBlueprintId: z.string().optional(),
        compositionSchema: z.record(z.string(), z.unknown()).optional(),
        status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
      }))
      .mutation(async ({ input }) => {
        const comp = await createComposition(input as any);
        if (!comp) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create composition" });
        return comp;
      }),
  }),
});
