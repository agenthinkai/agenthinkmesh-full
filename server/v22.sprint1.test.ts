/**
 * server/v22.sprint1.test.ts
 *
 * Vitest test suite — AgenThinkMesh V2.2 Sprint 1
 *
 * Covers all four modules:
 *   1. Unified LLM Adapter (invokeAgent)
 *   2. Kill-Switch (TreasuryKillSwitch + KillSwitchError)
 *   3. FX Service (convertPrice, convertAmount)
 *   4. REGION_CONFIG + Model Router + Vault Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: Unified LLM Adapter
// ─────────────────────────────────────────────────────────────────────────────

describe("invokeAgent — Unified LLM Adapter", () => {
  it("throws UnsupportedRegionError for unknown region", async () => {
    const { invokeAgent, UnsupportedRegionError } = await import("./lib/llm/invokeAgent");
    await expect(
      invokeAgent({
        region: "Mars" as never,
        role: "default",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow(UnsupportedRegionError);
  });

  it("throws UnsupportedRegionError with descriptive message", async () => {
    const { invokeAgent, UnsupportedRegionError } = await import("./lib/llm/invokeAgent");
    await expect(
      invokeAgent({ region: "EU" as never, role: "default", messages: [] })
    ).rejects.toThrow('Unsupported region: "EU"');
  });

  it("UnsupportedRegionError has correct name", async () => {
    const { UnsupportedRegionError } = await import("./lib/llm/invokeAgent");
    const err = new UnsupportedRegionError("Atlantis");
    expect(err.name).toBe("UnsupportedRegionError");
    expect(err).toBeInstanceOf(Error);
  });

  it("ChinaModelError has correct name", async () => {
    const { ChinaModelError } = await import("./lib/llm/invokeAgent");
    const err = new ChinaModelError("dashscope", "API key missing");
    expect(err.name).toBe("ChinaModelError");
    expect(err.message).toContain("dashscope");
    expect(err.message).toContain("API key missing");
  });

  it("Global invokeAgent returns normalized response shape (mocked)", async () => {
    // Mock the underlying invokeLLM helper
    vi.doMock("./_core/llm", () => ({
      invokeLLM: vi.fn().mockResolvedValue({
        choices: [{ message: { content: "Mock analysis complete." } }],
      }),
    }));

    // Re-import after mock
    const { invokeAgent } = await import("./lib/llm/invokeAgent?mock=1");
    const result = await invokeAgent({
      region: "Global",
      role: "default",
      messages: [{ role: "user", content: "Analyse this deal." }],
      systemPrompt: "You are a senior analyst.",
    });

    expect(result).toMatchObject({
      content: expect.any(String),
      model: "claude-sonnet-4-5",
      region: "Global",
    });

    vi.doUnmock("./_core/llm");
  });

  it("China region throws ChinaRegionNotEnabledError when CHINA_LLM is not set", async () => {
    const { invokeAgent, ChinaRegionNotEnabledError } = await import("./lib/llm/invokeAgent");
    // Ensure CHINA_LLM is not set
    delete process.env.CHINA_LLM;
    await expect(
      invokeAgent({
        region: "China",
        role: "default",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow(ChinaRegionNotEnabledError);
  });

  it("isChinaEnabled returns false when CHINA_LLM is not set", async () => {
    const { isChinaEnabled } = await import("./lib/llm/invokeAgent");
    delete process.env.CHINA_LLM;
    expect(isChinaEnabled()).toBe(false);
  });

  it("isChinaEnabled returns true when CHINA_LLM=true", async () => {
    const { isChinaEnabled } = await import("./lib/llm/invokeAgent");
    process.env.CHINA_LLM = "true";
    expect(isChinaEnabled()).toBe(true);
    delete process.env.CHINA_LLM;
  });

  it("Global model map: default=claude-sonnet-4-5, debate=claude-opus-4-5, streaming=claude-haiku-4-5-20251001", async () => {
    const { resolveModel } = await import("./lib/region/modelRouter");
    expect(resolveModel("Global", "default")).toBe("claude-sonnet-4-5");
    expect(resolveModel("Global", "debate")).toBe("claude-opus-4-5");
    expect(resolveModel("Global", "streaming")).toBe("claude-haiku-4-5-20251001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: Kill-Switch
// ─────────────────────────────────────────────────────────────────────────────

describe("TreasuryKillSwitch", () => {
  it("does NOT throw for spend below the limit ($499.99)", async () => {
    const { TreasuryKillSwitch } = await import("./lib/safety/killSwitch");
    await expect(TreasuryKillSwitch.check(499.99, 1)).resolves.toBeUndefined();
  });

  it("does NOT throw for spend of $0", async () => {
    const { TreasuryKillSwitch } = await import("./lib/safety/killSwitch");
    await expect(TreasuryKillSwitch.check(0, 1)).resolves.toBeUndefined();
  });

  it("THROWS KillSwitchError for spend exactly at limit ($500.00)", async () => {
    const { TreasuryKillSwitch, KillSwitchError } = await import("./lib/safety/killSwitch");
    await expect(TreasuryKillSwitch.check(500.00, 42)).rejects.toThrow(KillSwitchError);
  });

  it("THROWS KillSwitchError for spend above limit ($1000)", async () => {
    const { TreasuryKillSwitch, KillSwitchError } = await import("./lib/safety/killSwitch");
    await expect(TreasuryKillSwitch.check(1000, 99)).rejects.toThrow(KillSwitchError);
  });

  it("KillSwitchError carries proposedSpend and txId", async () => {
    const { TreasuryKillSwitch, KillSwitchError } = await import("./lib/safety/killSwitch");
    let caught: InstanceType<typeof KillSwitchError> | null = null;
    try {
      await TreasuryKillSwitch.check(750, 7);
    } catch (err) {
      caught = err as InstanceType<typeof KillSwitchError>;
    }
    expect(caught).not.toBeNull();
    expect(caught?.proposedSpend).toBe(750);
    expect(caught?.txId).toBe(7);
    expect(caught?.name).toBe("KillSwitchError");
  });

  it("KillSwitchError message contains spend amount and limit", async () => {
    const { KillSwitchError } = await import("./lib/safety/killSwitch");
    const err = new KillSwitchError(600, 5);
    expect(err.message).toContain("$600.00");
    expect(err.message).toContain("$500.00");
    expect(err.message).toContain("Approval Required");
  });

  it("hard limit is exactly 500 (not configurable)", async () => {
    const { TreasuryKillSwitch } = await import("./lib/safety/killSwitch");
    expect(TreasuryKillSwitch.limit).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: FX Service
// ─────────────────────────────────────────────────────────────────────────────

describe("fxService — convertPrice", () => {
  beforeEach(async () => {
    const { clearFxCache } = await import("./lib/billing/fxService");
    clearFxCache();
  });

  it("returns base price for USD without calling provider", async () => {
    const { convertPrice, BASE_PRICE_USD } = await import("./lib/billing/fxService");
    const result = await convertPrice("USD");
    expect(result.amount).toBe(BASE_PRICE_USD);
    expect(result.rate).toBe(1);
    expect(result.from).toBe("USD");
    expect(result.to).toBe("USD");
  });

  it("BASE_PRICE_USD is exactly 32.50", async () => {
    const { BASE_PRICE_USD } = await import("./lib/billing/fxService");
    expect(BASE_PRICE_USD).toBe(32.50);
  });

  it("returns ConvertedPrice shape for KWD (mocked provider)", async () => {
    // Mock fetch
    const mockRates = { KWD: 0.3073, CNY: 7.24, EUR: 0.92, USD: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: mockRates }),
    }));

    const { convertPrice, clearFxCache } = await import("./lib/billing/fxService");
    clearFxCache();

    const result = await convertPrice("KWD");
    expect(result.to).toBe("KWD");
    expect(result.from).toBe("USD");
    expect(typeof result.amount).toBe("number");
    expect(typeof result.rate).toBe("number");
    expect(result.rateAt).toBeInstanceOf(Date);
    expect(result.amount).toBeCloseTo(32.50 * 0.3073, 2);

    vi.unstubAllGlobals();
  });

  it("returns ConvertedPrice shape for CNY (mocked provider)", async () => {
    const mockRates = { KWD: 0.3073, CNY: 7.24, EUR: 0.92, USD: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: mockRates }),
    }));

    const { convertPrice, clearFxCache } = await import("./lib/billing/fxService");
    clearFxCache();

    const result = await convertPrice("CNY");
    expect(result.to).toBe("CNY");
    expect(result.amount).toBeCloseTo(32.50 * 7.24, 2);

    vi.unstubAllGlobals();
  });

  it("returns ConvertedPrice shape for EUR (mocked provider)", async () => {
    const mockRates = { KWD: 0.3073, CNY: 7.24, EUR: 0.92, USD: 1 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: mockRates }),
    }));

    const { convertPrice, clearFxCache } = await import("./lib/billing/fxService");
    clearFxCache();

    const result = await convertPrice("EUR");
    expect(result.to).toBe("EUR");
    expect(result.amount).toBeCloseTo(32.50 * 0.92, 2);

    vi.unstubAllGlobals();
  });

  it("caches rates — fetch called only once for multiple conversions", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { KWD: 0.3073, CNY: 7.24, EUR: 0.92, USD: 1 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { convertPrice, clearFxCache } = await import("./lib/billing/fxService");
    clearFxCache();

    await convertPrice("KWD");
    await convertPrice("CNY");
    await convertPrice("EUR");

    // fetch should only be called once (cache hit for 2nd and 3rd)
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("throws on provider HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const { convertPrice, clearFxCache } = await import("./lib/billing/fxService");
    clearFxCache();

    await expect(convertPrice("KWD")).rejects.toThrow("FX provider error: HTTP 503");

    vi.unstubAllGlobals();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: REGION_CONFIG + Model Router + Vault Client
// ─────────────────────────────────────────────────────────────────────────────

describe("REGION_CONFIG + Model Router", () => {
  it("REGION_CONFIG has Global and China keys", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG).toHaveProperty("Global");
    expect(REGION_CONFIG).toHaveProperty("China");
  });

  it("Global models are Anthropic models", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG.Global.models.default).toBe("claude-sonnet-4-5");
    expect(REGION_CONFIG.Global.models.debate).toBe("claude-opus-4-5");
    expect(REGION_CONFIG.Global.models.streaming).toBe("claude-haiku-4-5-20251001");
  });

  it("China models are DashScope/DeepSeek/Qianfan models", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG.China.models.default).toBe("qwen-plus");
    expect(REGION_CONFIG.China.models.debate).toBe("deepseek-chat");
    expect(REGION_CONFIG.China.models.streaming).toBe("ernie-speed");
  });

  it("Global vault is global_vault", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG.Global.vault).toBe("global_vault");
  });

  it("China vault is china_sovereign_vault", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG.China.vault).toBe("china_sovereign_vault");
  });

  it("Global currency is USD", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG.Global.currency).toBe("USD");
  });

  it("China currency is CNY", async () => {
    const { REGION_CONFIG } = await import("./lib/region/types");
    expect(REGION_CONFIG.China.currency).toBe("CNY");
  });

  it("resolveModel returns correct model for Global default", async () => {
    const { resolveModel } = await import("./lib/region/modelRouter");
    expect(resolveModel("Global", "default")).toBe("claude-sonnet-4-5");
  });

  it("resolveModel returns correct model for China debate", async () => {
    const { resolveModel } = await import("./lib/region/modelRouter");
    expect(resolveModel("China", "debate")).toBe("deepseek-chat");
  });

  it("resolveModel returns correct model for China streaming", async () => {
    const { resolveModel } = await import("./lib/region/modelRouter");
    expect(resolveModel("China", "streaming")).toBe("ernie-speed");
  });

  it("buildSearchPlan returns correct providers for Global", async () => {
    const { buildSearchPlan } = await import("./lib/region/modelRouter");
    const plan = buildSearchPlan("Global");
    expect(plan.providers).toContain("SEC");
    expect(plan.providers).toContain("Bloomberg");
    expect(plan.region).toBe("Global");
  });

  it("buildSearchPlan returns correct providers for China", async () => {
    const { buildSearchPlan } = await import("./lib/region/modelRouter");
    const plan = buildSearchPlan("China");
    expect(plan.providers).toContain("Baidu");
    expect(plan.providers).toContain("Caixin");
    expect(plan.region).toBe("China");
  });
});

describe("VaultClient — cross-vault policy enforcement", () => {
  it("getVaultName returns global_vault for Global", async () => {
    const { getVaultName } = await import("./lib/region/vaultClient");
    expect(getVaultName("Global")).toBe("global_vault");
  });

  it("getVaultName returns china_sovereign_vault for China", async () => {
    const { getVaultName } = await import("./lib/region/vaultClient");
    expect(getVaultName("China")).toBe("china_sovereign_vault");
  });

  it("CrossVaultAccessError is thrown when wrong vault is requested", async () => {
    const { CrossVaultAccessError } = await import("./lib/region/vaultClient");
    const err = new CrossVaultAccessError("global_vault", "china_sovereign_vault", "China");
    expect(err.name).toBe("CrossVaultAccessError");
    expect(err.message).toContain("China");
    expect(err.message).toContain("china_sovereign_vault");
    expect(err.message).toContain("global_vault");
  });

  it("COMPLIANCE_RULES has correct rules for Global", async () => {
    const { COMPLIANCE_RULES } = await import("./lib/region/types");
    expect(COMPLIANCE_RULES.Global).toContain("SEC Regulation D");
    expect(COMPLIANCE_RULES.Global).toContain("FATF AML Standards");
  });

  it("COMPLIANCE_RULES has correct rules for China", async () => {
    const { COMPLIANCE_RULES } = await import("./lib/region/types");
    expect(COMPLIANCE_RULES.China).toContain("CSRC Securities Law");
    expect(COMPLIANCE_RULES.China).toContain("PBOC AML Regulations");
  });
});
