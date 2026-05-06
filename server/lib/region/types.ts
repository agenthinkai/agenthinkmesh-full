/**
 * lib/region/types.ts
 *
 * REGION_CONFIG — AgenThinkMesh V2.2
 *
 * Defines the RegionProfile enum and the full configuration map for each region.
 * This is the single source of truth for region-specific settings across the platform.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RegionProfile = "Global" | "China";

export type VaultName = "global_vault" | "china_sovereign_vault";

export type SupportedCurrency = "USD" | "KWD" | "CNY" | "EUR";

export interface RegionModels {
  /** Default model for standard agent tasks. */
  default: string;
  /** High-capability model for council debate / adversarial reasoning. */
  debate: string;
  /** Fast/streaming model for real-time output. */
  streaming: string;
}

export interface RegionSettings {
  models: RegionModels;
  /** Ordered list of search/data providers for this region. */
  searchProviders: string[];
  /** Sovereign vault name — enforced at ORM query layer. */
  vault: VaultName;
  /** Default billing currency for this region. */
  currency: SupportedCurrency;
}

// ── REGION_CONFIG map ─────────────────────────────────────────────────────────

export const REGION_CONFIG: Record<RegionProfile, RegionSettings> = {
  Global: {
    models: {
      default:   "claude-sonnet-4-5",
      debate:    "claude-opus-4-5",
      streaming: "claude-haiku-4-5-20251001",
    },
    searchProviders: ["SEC", "FINRA", "Reuters", "Bloomberg"],
    vault: "global_vault",
    currency: "USD",
  },
  China: {
    models: {
      default:   "qwen-plus",       // Alibaba Qwen via DashScope
      debate:    "deepseek-chat",   // DeepSeek via DeepSeek API
      streaming: "ernie-speed",     // Baidu ERNIE via Qianfan
    },
    searchProviders: ["Baidu", "Caixin", "XinhuaFinance", "LocalNews"],
    vault: "china_sovereign_vault",
    currency: "CNY",
  },
};

// ── Compliance rules per region ───────────────────────────────────────────────

export const COMPLIANCE_RULES: Record<RegionProfile, string[]> = {
  Global: [
    "SEC Regulation D",
    "FINRA Rule 2111",
    "FATF AML Standards",
    "ADGM FSRA Guidelines",
  ],
  China: [
    "CSRC Securities Law",
    "PBOC AML Regulations",
    "SAFE Foreign Exchange Rules",
    "CAC Data Security Requirements",
  ],
};

// ── Agent name registry (V2.2 renames) ───────────────────────────────────────

export const AGENT_NAMES = {
  GLOBAL_MARKET_SCANNER: "GLOBAL_MARKET_SCANNER",  // was: GlobalResearcher
  COMPLIANCE_AUDITOR:    "COMPLIANCE_AUDITOR",      // was: ComplianceAgent
} as const;

export type AgentName = typeof AGENT_NAMES[keyof typeof AGENT_NAMES];
