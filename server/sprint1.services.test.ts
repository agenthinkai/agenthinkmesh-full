/**
 * server/sprint1.services.test.ts
 *
 * Sprint 1 — Prospect Config Service and Twin Parameter Service tests.
 * These tests use the fallback path (no DB) to verify backward compatibility.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock getDb to return null (no DB) ────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

import { getProspectConfig, listProspectConfigs, invalidateCache } from "./lib/prospectConfigService";
import { getTwinParameters, getTwinParameter, getTwinParameterValue, invalidateTwinParamCache } from "./lib/twinParameterService";

describe("ProspectConfigService — fallback path (no DB)", () => {
  beforeEach(() => {
    invalidateCache();
    invalidateTwinParamCache();
  });

  it("returns a hardcoded fallback for a known slug", async () => {
    const config = await getProspectConfig("bakalaria");
    expect(config).not.toBeNull();
    expect(config!.slug).toBe("bakalaria");
    expect(config!.organizationName).toContain("Bakalaria");
    expect(config!.status).toBe("ACTIVE");
    expect(config!.importedFromHardcoded).toBe(1);
  });

  it("returns null for an unknown slug", async () => {
    const config = await getProspectConfig("nonexistent-org-xyz");
    expect(config).toBeNull();
  });

  it("returns all 8 hardcoded fallback configs in list", async () => {
    const configs = await listProspectConfigs();
    expect(configs.length).toBeGreaterThanOrEqual(8);
    const slugs = configs.map(c => c.slug);
    expect(slugs).toContain("bakalaria");
    expect(slugs).toContain("core42");
    expect(slugs).toContain("sami");
    expect(slugs).toContain("alghanim");
    expect(slugs).toContain("floward");
    expect(slugs).toContain("uic");
  });

  it("all fallback configs have required fields", async () => {
    const configs = await listProspectConfigs();
    for (const config of configs) {
      expect(config.slug).toBeTruthy();
      expect(config.organizationName).toBeTruthy();
      expect(config.industry).toBeTruthy();
      expect(config.geography).toBeTruthy();
      expect(config.status).toBe("ACTIVE");
    }
  });

  it("caches the result on second call", async () => {
    const { getDb } = await import("./db");
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockClear();

    await getProspectConfig("sami");
    await getProspectConfig("sami"); // second call — should use cache
    // getDb is called once for DB lookup (returns null), then fallback is cached
    // On second call, cache hit means getDb is NOT called again
    // getDb is called once per cache miss (returns null), then fallback is cached
    // On second call, cache hit means getDb is NOT called again
    expect(getDbMock).toHaveBeenCalledTimes(1);
  });

  it("invalidateCache clears the cache", async () => {
    const { getDb } = await import("./db");
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockClear();

    await getProspectConfig("floward");
    invalidateCache("floward");
    await getProspectConfig("floward"); // cache was cleared, DB called again
    expect(getDbMock).toHaveBeenCalledTimes(2);
  });
});

describe("TwinParameterService — fallback path (no DB)", () => {
  beforeEach(() => {
    invalidateTwinParamCache();
  });

  it("returns hardcoded params for a known twinId", async () => {
    const params = await getTwinParameters("bakalaria");
    expect(params.length).toBeGreaterThan(0);
    const loanParam = params.find(p => p.paramKey === "loan_amount_kwd");
    expect(loanParam).toBeDefined();
    expect(loanParam!.value).toBe("1000000");
  });

  it("returns empty array for unknown twinId", async () => {
    const params = await getTwinParameters("unknown-twin-xyz");
    expect(params).toEqual([]);
  });

  it("getTwinParameter returns a specific param by key", async () => {
    const param = await getTwinParameter("core42", "savings_10yr_usd");
    expect(param).not.toBeNull();
    expect(param!.value).toBe("4320000000");
  });

  it("getTwinParameter returns null for unknown paramKey", async () => {
    const param = await getTwinParameter("core42", "nonexistent_param_xyz");
    expect(param).toBeNull();
  });

  it("getTwinParameterValue returns typed number with fallback", async () => {
    const val = await getTwinParameterValue("sami", "uav_units", 0);
    expect(val).toBe(24);
  });

  it("getTwinParameterValue returns default for missing param", async () => {
    const val = await getTwinParameterValue("sami", "nonexistent_xyz", 999);
    expect(val).toBe(999);
  });

  it("all fallback params have required fields", async () => {
    const params = await getTwinParameters("alghanim");
    for (const p of params) {
      expect(p.twinId).toBe("alghanim");
      expect(p.paramKey).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.value).toBeTruthy();
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThanOrEqual(100);
    }
  });

  it("invalidateTwinParamCache clears the cache", async () => {
    const { getDb } = await import("./db");
    const getDbMock = vi.mocked(getDb);
    getDbMock.mockClear();

    await getTwinParameters("floward");
    invalidateTwinParamCache("floward");
    await getTwinParameters("floward");
    expect(getDbMock).toHaveBeenCalledTimes(2);
  });
});
