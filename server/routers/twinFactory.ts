/**
 * Twin Factory Router
 * Sprint 2A: Unified admin router for all Decision Twin Factory registries.
 * Covers: TwinBlueprints, CouncilPersonas, Ontologies, DecisionTypes, KPIs,
 *         ReportRegistry, SimulationPlugins, DataConnectors, TwinCompositions
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

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
