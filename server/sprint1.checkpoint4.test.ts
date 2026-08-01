/**
 * server/sprint1.checkpoint4.test.ts
 *
 * Sprint 1 Checkpoint 4 — Workflow Protocol Registry and Report Engine Adapter tests.
 * Uses the fallback path (no DB) to verify backward compatibility.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

import {
  getWorkflowProtocol,
  listWorkflowProtocols,
  invalidateProtocolCache,
} from "./lib/workflowProtocolService";
import {
  listReportTemplates,
  getReportTemplate,
  getGeneratorManifest,
  LEGACY_GENERATORS,
  invalidateReportTemplateCache,
} from "./lib/reportEngineAdapter";

describe("WorkflowProtocolService — fallback path (no DB)", () => {
  beforeEach(() => {
    invalidateProtocolCache();
  });

  it("returns rosie_protocol from hardcoded fallback", async () => {
    const protocol = await getWorkflowProtocol("rosie_protocol");
    expect(protocol).not.toBeNull();
    expect(protocol!.protocolId).toBe("rosie_protocol");
    expect(protocol!.status).toBe("ACTIVE");
    expect(protocol!.agentCount).toBe(5);
  });

  it("returns null for unknown protocol", async () => {
    const protocol = await getWorkflowProtocol("nonexistent_protocol_xyz");
    expect(protocol).toBeNull();
  });

  it("lists all 4 hardcoded protocols", async () => {
    const protocols = await listWorkflowProtocols();
    expect(protocols.length).toBeGreaterThanOrEqual(4);
    const ids = protocols.map(p => p.protocolId);
    expect(ids).toContain("rosie_protocol");
    expect(ids).toContain("gcc_deal_screening");
    expect(ids).toContain("industrial_ops");
    expect(ids).toContain("sovereign_defense");
  });

  it("all fallback protocols have required fields", async () => {
    const protocols = await listWorkflowProtocols();
    for (const p of protocols) {
      expect(p.protocolId).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.version).toBeTruthy();
      expect(p.agentCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("caches the result on second call", async () => {
    const { getDb } = await import("./db");
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockClear();

    await getWorkflowProtocol("rosie_protocol");
    await getWorkflowProtocol("rosie_protocol");
    expect(getDbMock).toHaveBeenCalledTimes(1);
  });

  it("invalidateProtocolCache clears the cache", async () => {
    const { getDb } = await import("./db");
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockClear();

    await getWorkflowProtocol("gcc_deal_screening");
    invalidateProtocolCache("gcc_deal_screening");
    await getWorkflowProtocol("gcc_deal_screening");
    expect(getDbMock).toHaveBeenCalledTimes(2);
  });
});

describe("ReportEngineAdapter — fallback path (no DB)", () => {
  beforeEach(() => {
    invalidateReportTemplateCache();
  });

  it("lists all 5 legacy generators as report templates", async () => {
    const templates = await listReportTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(5);
    const ids = templates.map(t => t.templateId);
    expect(ids).toContain("deal_dossier");
    expect(ids).toContain("institutional_proof");
    expect(ids).toContain("board_pack");
    expect(ids).toContain("legal_redline");
    expect(ids).toContain("pilot_conversion");
  });

  it("getReportTemplate returns a specific template", async () => {
    const template = await getReportTemplate("institutional_proof");
    expect(template).not.toBeNull();
    expect(template!.templateId).toBe("institutional_proof");
    expect(template!.status).toBe("ACTIVE");
    expect(template!.generatorType).toBe("legacy");
  });

  it("getReportTemplate returns null for unknown templateId", async () => {
    const template = await getReportTemplate("nonexistent_template_xyz");
    expect(template).toBeNull();
  });

  it("getGeneratorManifest returns the manifest for a legacy generator", async () => {
    const manifest = getGeneratorManifest("deal_dossier");
    expect(manifest).not.toBeNull();
    expect(manifest!.templateId).toBe("deal_dossier");
    expect(manifest!.generatorType).toBe("legacy");
    expect(manifest!.requiredInputs).toContain("dealId");
  });

  it("getGeneratorManifest returns null for non-legacy templateId", async () => {
    const manifest = getGeneratorManifest("nonexistent_xyz");
    expect(manifest).toBeNull();
  });

  it("LEGACY_GENERATORS constant has 5 entries", () => {
    expect(LEGACY_GENERATORS.length).toBe(5);
  });

  it("all legacy generators have required fields", () => {
    for (const g of LEGACY_GENERATORS) {
      expect(g.templateId).toBeTruthy();
      expect(g.name).toBeTruthy();
      expect(g.generatorPath).toBeTruthy();
      expect(g.generatorType).toBe("legacy");
      expect(Array.isArray(g.requiredInputs)).toBe(true);
    }
  });

  it("caches templates on second call", async () => {
    const { getDb } = await import("./db");
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockClear();

    await listReportTemplates();
    await listReportTemplates();
    expect(getDbMock).toHaveBeenCalledTimes(1);
  });
});
