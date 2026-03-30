/**
 * lib/region/modelRouter.ts
 *
 * Automated Model Router — AgenThinkMesh V2.2
 *
 * Single-function lookup: resolveModel(region, role) → model string.
 * Inject `region` from the deal tag at the tRPC call site — no manual override required.
 *
 * @example
 *   const model = resolveModel("China", "default");
 *   // → "qwen-plus"
 *
 *   const model = resolveModel("Global", "debate");
 *   // → "claude-opus-4-5"
 */

import { REGION_CONFIG, type RegionProfile } from "./types";
import type { ModelRole } from "../llm/invokeAgent";

export { type ModelRole };

/**
 * resolveModel — returns the model identifier for a given region and role.
 *
 * @param region  "Global" | "China"
 * @param role    "default" | "debate" | "streaming"
 */
export function resolveModel(region: RegionProfile, role: ModelRole): string {
  return REGION_CONFIG[region].models[role];
}

/**
 * resolveSearchProviders — returns the ordered list of search/data providers
 * for a given region.
 *
 * @example
 *   const providers = resolveSearchProviders("China");
 *   // → ["Baidu", "Caixin", "XinhuaFinance", "LocalNews"]
 */
export function resolveSearchProviders(region: RegionProfile): string[] {
  return REGION_CONFIG[region].searchProviders;
}

/**
 * buildSearchPlan — returns a structured search config for GLOBAL_MARKET_SCANNER.
 */
export function buildSearchPlan(region: RegionProfile): { providers: string[]; region: RegionProfile } {
  return {
    providers: resolveSearchProviders(region),
    region,
  };
}
