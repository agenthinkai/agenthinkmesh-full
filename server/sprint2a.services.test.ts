/**
 * Sprint 2A Service Tests
 * Tests for all 9 Decision Twin Factory registries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB (all tests run without a real DB connection) ──────────────────────
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Twin Blueprint Service ────────────────────────────────────────────────────
describe("twinBlueprintService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns fallback blueprints when DB is unavailable", async () => {
    const { listBlueprints, FALLBACK_BLUEPRINTS } = await import("./lib/twinBlueprintService");
    const blueprints = await listBlueprints();
    expect(blueprints.length).toBeGreaterThan(0);
    expect(blueprints.length).toBe(FALLBACK_BLUEPRINTS.length);
  });

  it("filters blueprints by industry", async () => {
    const { listBlueprints } = await import("./lib/twinBlueprintService");
    const all = await listBlueprints();
    const banking = await listBlueprints("banking");
    expect(banking.length).toBeLessThanOrEqual(all.length);
  });

  it("returns null for unknown blueprint ID", async () => {
    const { getBlueprintById } = await import("./lib/twinBlueprintService");
    const result = await getBlueprintById("nonexistent-blueprint-xyz");
    expect(result).toBeNull();
  });

  it("each blueprint has required fields", async () => {
    const { FALLBACK_BLUEPRINTS } = await import("./lib/twinBlueprintService");
    for (const bp of FALLBACK_BLUEPRINTS) {
      expect(bp.blueprintId).toBeTruthy();
      expect(bp.name).toBeTruthy();
      expect(bp.industry).toBeTruthy();
      expect(bp.defaultSimulationMode).toBeTruthy();
    }
  });
});

// ── Council Persona Service ───────────────────────────────────────────────────
describe("councilPersonaService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns fallback persona sets when DB is unavailable", async () => {
    const { listPersonaSets, FALLBACK_PERSONA_SETS } = await import("./lib/councilPersonaService");
    const sets = await listPersonaSets();
    expect(sets.length).toBeGreaterThan(0);
    expect(sets).toEqual(expect.arrayContaining(Object.keys(FALLBACK_PERSONA_SETS)));
  });

  it("returns personas for banking industry", async () => {
    const { getPersonaSetByIndustry } = await import("./lib/councilPersonaService");
    const personas = await getPersonaSetByIndustry("banking");
    expect(personas.length).toBeGreaterThan(0);
    for (const p of personas) {
      expect(p.personaId).toBeTruthy();
      expect(p.role ?? p.title).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.systemPrompt ?? p.personaId).toBeTruthy();
    }
  });

  it("returns empty array for unknown industry", async () => {
    const { getPersonaSetByIndustry } = await import("./lib/councilPersonaService");
    const personas = await getPersonaSetByIndustry("unknown-industry-xyz");
    expect(personas).toEqual([]);
  });

  it("all fallback persona sets have at least 3 personas", async () => {
    const { FALLBACK_PERSONA_SETS } = await import("./lib/councilPersonaService");
    for (const [setId, personas] of Object.entries(FALLBACK_PERSONA_SETS)) {
      expect(personas.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ── Ontology Service ──────────────────────────────────────────────────────────
describe("ontologyService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns fallback ontologies when DB is unavailable", async () => {
    const { listOntologies, FALLBACK_ONTOLOGIES } = await import("./lib/ontologyService");
    const ontologies = await listOntologies();
    expect(ontologies.length).toBeGreaterThan(0);
    expect(ontologies.length).toBe(Object.keys(FALLBACK_ONTOLOGIES).length);
  });

  it("returns banking ontology by industry tag", async () => {
    const { getOntologyByIndustry } = await import("./lib/ontologyService");
    const ontology = await getOntologyByIndustry("banking");
    expect(ontology).not.toBeNull();
    expect(ontology!.entities.length).toBeGreaterThan(0);
    expect(ontology!.relationships.length).toBeGreaterThan(0);
  });

  it("returns null for unknown industry", async () => {
    const { getOntologyByIndustry } = await import("./lib/ontologyService");
    const result = await getOntologyByIndustry("unknown-industry-xyz");
    expect(result).toBeNull();
  });

  it("each ontology has a systemPromptFragment", async () => {
    const { FALLBACK_ONTOLOGIES } = await import("./lib/ontologyService");
    for (const o of Object.values(FALLBACK_ONTOLOGIES)) {
      expect(o.systemPromptFragment).toBeTruthy();
      expect(o.systemPromptFragment!.length).toBeGreaterThan(20);
    }
  });
});

// ── Decision Type Service ─────────────────────────────────────────────────────
describe("decisionTypeService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all fallback decision types", async () => {
    const { listDecisionTypes, FALLBACK_DECISION_TYPES } = await import("./lib/decisionTypeService");
    const types = await listDecisionTypes();
    expect(types.length).toBeGreaterThanOrEqual(10); // originally 10, expanded with Customer Zero (ai_company types)
    expect(types.length).toBe(FALLBACK_DECISION_TYPES.length);
  });

  it("filters by industry tag", async () => {
    const { listDecisionTypes } = await import("./lib/decisionTypeService");
    const bankingTypes = await listDecisionTypes("banking");
    const allTypes = await listDecisionTypes();
    // Banking-specific types + "all" types
    expect(bankingTypes.length).toBeLessThanOrEqual(allTypes.length);
    expect(bankingTypes.length).toBeGreaterThan(0);
  });

  it("returns capital-allocation decision type", async () => {
    const { getDecisionType } = await import("./lib/decisionTypeService");
    const dt = await getDecisionType("capital-allocation");
    expect(dt).not.toBeNull();
    expect(dt!.name).toBe("Capital Allocation");
    expect(dt!.requiredInputFields.length).toBeGreaterThan(0);
  });

  it("returns null for unknown decision type", async () => {
    const { getDecisionType } = await import("./lib/decisionTypeService");
    const result = await getDecisionType("nonexistent-type-xyz");
    expect(result).toBeNull();
  });
});

// ── KPI Service ───────────────────────────────────────────────────────────────
describe("kpiService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns banking KPI set", async () => {
    const { getKpiSet } = await import("./lib/kpiService");
    const kpis = await getKpiSet("banking");
    expect(kpis.length).toBeGreaterThan(0);
    for (const kpi of kpis) {
      expect(kpi.kpiId).toBeTruthy();
      expect(kpi.name).toBeTruthy();
      expect(kpi.threshold).toBeDefined();
      expect(kpi.threshold.good).toBeDefined();
    }
  });

  it("returns manufacturing KPI set", async () => {
    const { getKpiSet } = await import("./lib/kpiService");
    const kpis = await getKpiSet("manufacturing");
    expect(kpis.length).toBeGreaterThan(0);
    const oee = kpis.find(k => k.kpiId === "mfg-oee");
    expect(oee).toBeDefined();
    expect(oee!.direction).toBe("higher");
  });

  it("returns empty array for unknown KPI set", async () => {
    const { getKpiSet } = await import("./lib/kpiService");
    const kpis = await getKpiSet("unknown-industry-xyz");
    expect(kpis).toEqual([]);
  });

  it("lists all available KPI set IDs", async () => {
    const { listKpiSets, FALLBACK_KPI_SETS } = await import("./lib/kpiService");
    const sets = await listKpiSets();
    expect(sets.length).toBe(Object.keys(FALLBACK_KPI_SETS).length);
  });
});

// ── Report Registry Service ───────────────────────────────────────────────────
describe("reportRegistryService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all fallback report types", async () => {
    const { listReportTypes, FALLBACK_REPORT_TYPES } = await import("./lib/reportRegistryService");
    const types = await listReportTypes();
    expect(types.length).toBeGreaterThanOrEqual(6); // originally 6, expanded with Customer Zero (daily-operating-rhythm, weekly-performance-review)
    expect(types.length).toBe(FALLBACK_REPORT_TYPES.length);
  });

  it("returns executive-brief report type", async () => {
    const { getReportType } = await import("./lib/reportRegistryService");
    const rt = await getReportType("executive-brief");
    expect(rt).not.toBeNull();
    expect(rt!.requiredSections.length).toBeGreaterThan(0);
  });

  it("filters by industry tag", async () => {
    const { listReportTypes } = await import("./lib/reportRegistryService");
    const bankingTypes = await listReportTypes("banking");
    const allTypes = await listReportTypes();
    expect(bankingTypes.length).toBeLessThanOrEqual(allTypes.length);
  });
});

// ── Simulation Registry Service ───────────────────────────────────────────────
describe("simulationRegistryService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all 8 fallback simulation plugins", async () => {
    const { listSimulationPlugins, FALLBACK_SIMULATION_PLUGINS } = await import("./lib/simulationRegistryService");
    const plugins = await listSimulationPlugins();
    expect(plugins.length).toBe(8);
    expect(plugins.length).toBe(FALLBACK_SIMULATION_PLUGINS.length);
  });

  it("returns macro-stress plugin", async () => {
    const { getSimulationPlugin } = await import("./lib/simulationRegistryService");
    const plugin = await getSimulationPlugin("macro-stress");
    expect(plugin).not.toBeNull();
    expect(plugin!.maxScenarioCount).toBeGreaterThan(0);
    expect(plugin!.defaultConfig).toBeDefined();
  });

  it("filters by industry tag", async () => {
    const { listSimulationPlugins } = await import("./lib/simulationRegistryService");
    const logistics = await listSimulationPlugins("logistics");
    const all = await listSimulationPlugins();
    expect(logistics.length).toBeLessThanOrEqual(all.length);
  });
});

// ── Connector Adapter Interface ───────────────────────────────────────────────
describe("connectorAdapterInterface", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all built-in connectors", async () => {
    const { listConnectors, BUILTIN_CONNECTORS } = await import("./lib/connectorAdapterInterface");
    const connectors = await listConnectors();
    expect(connectors.length).toBeGreaterThanOrEqual(4); // originally 4, expanded with Customer Zero (agenthink connectors)
    expect(connectors.length).toBe(BUILTIN_CONNECTORS.length);
  });

  it("returns csv-upload connector", async () => {
    const { getConnector } = await import("./lib/connectorAdapterInterface");
    const conn = await getConnector("csv-upload");
    expect(conn).not.toBeNull();
    expect(conn!.connectorType).toBe("csv");
    expect(conn!.supportsSchemaInference).toBe(true);
  });

  it("returns null for unknown connector", async () => {
    const { getConnector } = await import("./lib/connectorAdapterInterface");
    const result = await getConnector("nonexistent-connector-xyz");
    expect(result).toBeNull();
  });

  it("test connector returns success for manual type", async () => {
    const { testConnector } = await import("./lib/connectorAdapterInterface");
    const result = await testConnector("manual-entry", {});
    expect(result.success).toBe(true);
  });
});

// ── Twin Composer Service ─────────────────────────────────────────────────────
describe("twinComposerService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no compositions exist", async () => {
    const { listCompositions } = await import("./lib/twinComposerService");
    const compositions = await listCompositions();
    expect(Array.isArray(compositions)).toBe(true);
  });

  it("returns null for unknown composition", async () => {
    const { getComposition } = await import("./lib/twinComposerService");
    const result = await getComposition("nonexistent-composition-xyz");
    expect(result).toBeNull();
  });

  it("composes two blueprints into a ComposedTwin", async () => {
    const { composeBlueprints } = await import("./lib/twinComposerService");
    const { FALLBACK_BLUEPRINTS } = await import("./lib/twinBlueprintService");
    if (FALLBACK_BLUEPRINTS.length < 2) return; // Skip if not enough blueprints
    const ids = FALLBACK_BLUEPRINTS.slice(0, 2).map(b => b.blueprintId);
    const composed = await composeBlueprints(ids);
    expect(composed).not.toBeNull();
    expect(composed!.blueprints.length).toBe(2);
    expect(composed!.primaryBlueprint.blueprintId).toBe(ids[0]);
    expect(composed!.compositionMeta.blueprintCount).toBe(2);
  });

  it("returns null for empty blueprint IDs array", async () => {
    const { composeBlueprints } = await import("./lib/twinComposerService");
    const result = await composeBlueprints([]);
    expect(result).toBeNull();
  });
});
