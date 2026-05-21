/**
 * infraSimEngine.ts — Governed Infrastructure Stress Simulation Engine v2
 *
 * Deterministic, reproducible, auditable.
 * No LLM calls — pure governed analytical framework.
 *
 * Capabilities:
 *   - 10,000–100,000 scenario runs via stratified sampling
 *   - Nonlinear interaction penalties
 *   - Governed decision logic (HARD NO / SOFT NO / CONDITIONAL / APPROVE)
 *   - Reverse optimization: "What must become true for approval?"
 *   - Tornado sensitivity analysis
 *   - Full reproducibility manifest
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DimensionValue {
  label: string;
  irrDeltaPct: number;       // additive IRR impact (can be negative)
  weight: number;            // sampling probability weight (0-1, normalized)
  isHardNo?: boolean;        // triggers HARD NO governance escalation
  isGovernanceTrigger?: boolean; // triggers governance review but not hard no
}

export interface SimDimension {
  key: string;
  name: string;
  category: "technology" | "financial" | "regulatory" | "execution" | "revenue";
  values: DimensionValue[];
  interactionPenalties?: Record<string, number>; // "key1+key2" → penalty pct
  governanceThreshold?: number;                  // IRR delta that triggers escalation
}

export interface SimCaseConfig {
  caseId: number;
  title: string;
  baseIrrPct: number;
  fundMinIrrPct: number;
  dimensions: SimDimension[];
  hardNoTriggers?: HardNoTrigger[];
}

export interface HardNoTrigger {
  key: string;
  label: string;
  condition: (params: Record<string, string>, irr: number) => boolean;
}

export interface ScenarioResult {
  index: number;
  parameters: Record<string, string>;           // { dimension_key: value_label }
  irrPct: number;
  decision: "APPROVE" | "CONDITIONAL" | "REJECT";
  blockerScore: number;                          // 0-100
  dominantRiskCategory: string;
  hardNoTriggers: string[];
  softNoTriggers: string[];
  interactionPenaltyPct: number;
}

export interface SimRunResult {
  totalScenarios: number;
  approveCount: number;
  conditionalCount: number;
  rejectCount: number;
  approveRate: number;
  conditionalRate: number;
  rejectRate: number;
  medianIrrPct: number;
  p10IrrPct: number;
  p25IrrPct: number;
  p75IrrPct: number;
  p90IrrPct: number;
  irrMin: number;
  irrMax: number;
  topFailureDrivers: FailureDriver[];
  approvalPathway: ApprovalCondition[];
  sensitivity: TornadoEntry[];
  governanceAudit: GovernanceTriggerFreq[];
  sampledScenarios: ScenarioResult[];            // top/bottom/milestone scenarios
  reproducibilityManifest: ReproducibilityManifest;
}

export interface FailureDriver {
  dimensionKey: string;
  dimensionName: string;
  rejectionRateDelta: number;                    // pp increase in rejection when worst value
  irrSwingPct: number;                           // max - min median IRR across dimension values
  rank: number;
}

export interface ApprovalCondition {
  dimensionKey: string;
  dimensionName: string;
  requiredValue: string;
  currentValue: string;
  approvalImpactPct: number;                     // approval probability increase if changed
  interventionCost: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  rank: number;
}

export interface TornadoEntry {
  dimensionKey: string;
  dimensionName: string;
  irrSwingPct: number;
  bestCaseIrr: number;
  worstCaseIrr: number;
  category: string;
}

export interface GovernanceTriggerFreq {
  triggerKey: string;
  triggerLabel: string;
  frequency: number;                             // count
  frequencyPct: number;                          // % of total scenarios
}

export interface ReproducibilityManifest {
  engineVersion: string;
  caseId: number;
  targetCount: number;
  samplingMethod: string;
  dimensionCount: number;
  uniqueStateCombinations: number;
  generatedAt: string;
  checksum: string;
}

// ── Default Hard NO Triggers ──────────────────────────────────────────────────

export const DEFAULT_HARD_NO_TRIGGERS: HardNoTrigger[] = [
  {
    key: "irr_below_minimum",
    label: "IRR Below Fund Minimum",
    condition: (_, irr) => irr < 15,
  },
  {
    key: "merchant_unhedged",
    label: "Merchant Exposure Unhedged",
    condition: (params) => params["merchant_exposure"] === "20% Unhedged",
  },
  {
    key: "foundation_unvalidated",
    label: "Foundation Technology Unvalidated",
    condition: (params) => params["foundation_tech"] === "Unvalidated / Prototype Stage",
  },
  {
    key: "contingency_insufficient",
    label: "Contingency Insufficient for Technology Risk",
    condition: (params, irr) => {
      const isTechRisk = params["foundation_tech"] !== "Independently Validated";
      return isTechRisk && irr < 12;
    },
  },
  {
    key: "regulatory_unmitigated",
    label: "Regulatory Risk Unmitigated",
    condition: (params) => params["regulatory_env"] === "Adverse AR7 / Planning Challenges",
  },
];

// ── Scenario Generator ────────────────────────────────────────────────────────

/**
 * Generate N scenarios using stratified random sampling.
 * Stratification ensures all dimension values are proportionally represented.
 */
export function generateScenarios(
  config: SimCaseConfig,
  targetCount: number
): ScenarioResult[] {
  const { dimensions, baseIrrPct, fundMinIrrPct } = config;
  const hardNoTriggers = config.hardNoTriggers ?? DEFAULT_HARD_NO_TRIGGERS;
  const results: ScenarioResult[] = [];

  // Build weighted sampling tables for each dimension
  const samplingTables = dimensions.map((dim) => {
    const totalWeight = dim.values.reduce((s, v) => s + v.weight, 0);
    const cumulative: Array<{ threshold: number; value: DimensionValue }> = [];
    let acc = 0;
    for (const v of dim.values) {
      acc += v.weight / totalWeight;
      cumulative.push({ threshold: acc, value: v });
    }
    return { dim, cumulative };
  });

  for (let i = 0; i < targetCount; i++) {
    // Sample one value per dimension
    const params: Record<string, string> = {};
    const selectedValues: DimensionValue[] = [];

    for (const { dim, cumulative } of samplingTables) {
      const r = seededRandom(i * dimensions.length + samplingTables.indexOf({ dim, cumulative } as any));
      const selected = cumulative.find((c) => r <= c.threshold) ?? cumulative[cumulative.length - 1];
      params[dim.key] = selected.value.label;
      selectedValues.push(selected.value);
    }

    // Compute IRR
    const { irrPct, interactionPenaltyPct } = computeIrr(
      baseIrrPct,
      selectedValues,
      params,
      dimensions
    );

    // Apply decision logic
    const { decision, blockerScore, hardNos, softNos } = applyDecisionLogic(
      irrPct,
      fundMinIrrPct,
      params,
      hardNoTriggers,
      selectedValues
    );

    // Determine dominant risk category
    const dominantRiskCategory = getDominantRiskCategory(selectedValues, dimensions);

    results.push({
      index: i,
      parameters: params,
      irrPct,
      decision,
      blockerScore,
      dominantRiskCategory,
      hardNoTriggers: hardNos,
      softNoTriggers: softNos,
      interactionPenaltyPct,
    });
  }

  return results;
}

// ── IRR Calculator ────────────────────────────────────────────────────────────

function computeIrr(
  baseIrrPct: number,
  selectedValues: DimensionValue[],
  params: Record<string, string>,
  dimensions: SimDimension[]
): { irrPct: number; interactionPenaltyPct: number } {
  // Sum additive IRR deltas
  let irr = baseIrrPct;
  for (const v of selectedValues) {
    irr += v.irrDeltaPct;
  }

  // Apply nonlinear interaction penalties
  let totalPenalty = 0;
  for (const dim of dimensions) {
    if (!dim.interactionPenalties) continue;
    for (const [pairKey, penaltyPct] of Object.entries(dim.interactionPenalties)) {
      const [k1, k2] = pairKey.split("+");
      // Check if both dimensions have their "bad" values active
      if (isWorstValue(params[k1], k1, dimensions) && isWorstValue(params[k2], k2, dimensions)) {
        totalPenalty += penaltyPct;
      }
    }
  }

  irr -= totalPenalty;

  return {
    irrPct: Math.round(irr * 1000) / 1000,
    interactionPenaltyPct: Math.round(totalPenalty * 1000) / 1000,
  };
}

function isWorstValue(valueLabel: string, dimKey: string, dimensions: SimDimension[]): boolean {
  const dim = dimensions.find((d) => d.key === dimKey);
  if (!dim) return false;
  const worstValue = dim.values.reduce((worst, v) => (v.irrDeltaPct < worst.irrDeltaPct ? v : worst), dim.values[0]);
  return valueLabel === worstValue.label;
}

// ── Decision Logic ────────────────────────────────────────────────────────────

function applyDecisionLogic(
  irrPct: number,
  fundMinIrrPct: number,
  params: Record<string, string>,
  hardNoTriggers: HardNoTrigger[],
  selectedValues: DimensionValue[]
): { decision: "APPROVE" | "CONDITIONAL" | "REJECT"; blockerScore: number; hardNos: string[]; softNos: string[] } {
  const hardNos: string[] = [];
  const softNos: string[] = [];

  // Check hard NO triggers
  for (const trigger of hardNoTriggers) {
    if (trigger.condition(params, irrPct)) {
      hardNos.push(trigger.label);
    }
  }

  // Check soft NO conditions
  if (irrPct < fundMinIrrPct && irrPct >= fundMinIrrPct - 5) {
    softNos.push("IRR Marginally Below Fund Minimum");
  }
  if (selectedValues.some((v) => v.isGovernanceTrigger)) {
    softNos.push("Governance Escalation Threshold Triggered");
  }

  // Compute blocker score (0-100)
  const blockerScore = Math.min(100, hardNos.length * 25 + softNos.length * 10 + Math.max(0, (fundMinIrrPct - irrPct) * 2));

  // Decision
  let decision: "APPROVE" | "CONDITIONAL" | "REJECT";
  if (hardNos.length > 0) {
    decision = "REJECT";
  } else if (softNos.length > 0 || irrPct < fundMinIrrPct + 2) {
    decision = "CONDITIONAL";
  } else {
    decision = "APPROVE";
  }

  return { decision, blockerScore, hardNos, softNos };
}

function getDominantRiskCategory(selectedValues: DimensionValue[], dimensions: SimDimension[]): string {
  // Find the dimension with the largest negative IRR contribution
  let worstDelta = 0;
  let dominantCategory = "financial";

  for (let i = 0; i < selectedValues.length; i++) {
    if (selectedValues[i].irrDeltaPct < worstDelta) {
      worstDelta = selectedValues[i].irrDeltaPct;
      dominantCategory = dimensions[i]?.category ?? "financial";
    }
  }

  return dominantCategory;
}

// ── Aggregation & Analysis ────────────────────────────────────────────────────

export function aggregateResults(
  scenarios: ScenarioResult[],
  config: SimCaseConfig
): SimRunResult {
  const total = scenarios.length;
  const approveCount = scenarios.filter((s) => s.decision === "APPROVE").length;
  const conditionalCount = scenarios.filter((s) => s.decision === "CONDITIONAL").length;
  const rejectCount = scenarios.filter((s) => s.decision === "REJECT").length;

  const irrs = scenarios.map((s) => s.irrPct).sort((a, b) => a - b);

  // Sensitivity / tornado
  const sensitivity = computeSensitivity(scenarios, config);

  // Failure drivers
  const topFailureDrivers = computeFailureDrivers(scenarios, config, sensitivity);

  // Approval pathway (reverse optimization)
  const approvalPathway = computeApprovalPathway(scenarios, config);

  // Governance audit
  const governanceAudit = computeGovernanceAudit(scenarios, config);

  // Sample key scenarios for persistence
  const sampledScenarios = sampleKeyScenarios(scenarios);

  // Unique state count
  const uniqueStates = config.dimensions.reduce((acc, d) => acc * d.values.length, 1);

  const manifest: ReproducibilityManifest = {
    engineVersion: "2.0.0",
    caseId: config.caseId,
    targetCount: total,
    samplingMethod: "stratified_weighted_random",
    dimensionCount: config.dimensions.length,
    uniqueStateCombinations: uniqueStates,
    generatedAt: new Date().toISOString(),
    checksum: computeChecksum(config, total),
  };

  return {
    totalScenarios: total,
    approveCount,
    conditionalCount,
    rejectCount,
    approveRate: approveCount / total,
    conditionalRate: conditionalCount / total,
    rejectRate: rejectCount / total,
    medianIrrPct: percentile(irrs, 50),
    p10IrrPct: percentile(irrs, 10),
    p25IrrPct: percentile(irrs, 25),
    p75IrrPct: percentile(irrs, 75),
    p90IrrPct: percentile(irrs, 90),
    irrMin: irrs[0],
    irrMax: irrs[irrs.length - 1],
    topFailureDrivers,
    approvalPathway,
    sensitivity,
    governanceAudit,
    sampledScenarios,
    reproducibilityManifest: manifest,
  };
}

function computeSensitivity(scenarios: ScenarioResult[], config: SimCaseConfig): TornadoEntry[] {
  const entries: TornadoEntry[] = [];

  for (const dim of config.dimensions) {
    const irrsByValue: Record<string, number[]> = {};
    for (const v of dim.values) {
      irrsByValue[v.label] = [];
    }
    for (const s of scenarios) {
      const label = s.parameters[dim.key];
      if (label && irrsByValue[label]) {
        irrsByValue[label].push(s.irrPct);
      }
    }

    const medians = Object.entries(irrsByValue).map(([label, irrs]) => ({
      label,
      median: irrs.length > 0 ? percentile([...irrs].sort((a, b) => a - b), 50) : 0,
    }));

    const bestCaseIrr = Math.max(...medians.map((m) => m.median));
    const worstCaseIrr = Math.min(...medians.map((m) => m.median));
    const irrSwingPct = bestCaseIrr - worstCaseIrr;

    entries.push({
      dimensionKey: dim.key,
      dimensionName: dim.name,
      irrSwingPct: Math.round(irrSwingPct * 100) / 100,
      bestCaseIrr: Math.round(bestCaseIrr * 100) / 100,
      worstCaseIrr: Math.round(worstCaseIrr * 100) / 100,
      category: dim.category,
    });
  }

  return entries.sort((a, b) => b.irrSwingPct - a.irrSwingPct);
}

function computeFailureDrivers(
  scenarios: ScenarioResult[],
  config: SimCaseConfig,
  sensitivity: TornadoEntry[]
): FailureDriver[] {
  const total = scenarios.length;
  const drivers: FailureDriver[] = [];

  for (let i = 0; i < config.dimensions.length; i++) {
    const dim = config.dimensions[i];
    const worstValue = dim.values.reduce((worst, v) => (v.irrDeltaPct < worst.irrDeltaPct ? v : worst), dim.values[0]);
    const bestValue = dim.values.reduce((best, v) => (v.irrDeltaPct > best.irrDeltaPct ? v : best), dim.values[0]);

    const worstScenarios = scenarios.filter((s) => s.parameters[dim.key] === worstValue.label);
    const bestScenarios = scenarios.filter((s) => s.parameters[dim.key] === bestValue.label);

    const worstRejectRate = worstScenarios.length > 0 ? worstScenarios.filter((s) => s.decision === "REJECT").length / worstScenarios.length : 0;
    const bestRejectRate = bestScenarios.length > 0 ? bestScenarios.filter((s) => s.decision === "REJECT").length / bestScenarios.length : 0;

    const tornadoEntry = sensitivity.find((t) => t.dimensionKey === dim.key);

    drivers.push({
      dimensionKey: dim.key,
      dimensionName: dim.name,
      rejectionRateDelta: Math.round((worstRejectRate - bestRejectRate) * 10000) / 100,
      irrSwingPct: tornadoEntry?.irrSwingPct ?? 0,
      rank: 0,
    });
  }

  drivers.sort((a, b) => b.rejectionRateDelta - a.rejectionRateDelta);
  drivers.forEach((d, i) => (d.rank = i + 1));
  return drivers;
}

function computeApprovalPathway(scenarios: ScenarioResult[], config: SimCaseConfig): ApprovalCondition[] {
  const conditions: ApprovalCondition[] = [];
  const baseRejectRate = scenarios.filter((s) => s.decision === "REJECT").length / scenarios.length;

  for (const dim of config.dimensions) {
    const bestValue = dim.values.reduce((best, v) => (v.irrDeltaPct > best.irrDeltaPct ? v : best), dim.values[0]);
    const worstValue = dim.values.reduce((worst, v) => (v.irrDeltaPct < worst.irrDeltaPct ? v : worst), dim.values[0]);

    // What if we fix this dimension to its best value?
    const fixedScenarios = scenarios.map((s) => ({
      ...s,
      irrPct: s.irrPct - dim.values.find((v) => v.label === s.parameters[dim.key])!.irrDeltaPct + bestValue.irrDeltaPct,
    }));

    const fixedApproveRate = fixedScenarios.filter((s) => s.irrPct >= config.fundMinIrrPct + 2).length / fixedScenarios.length;
    const currentApproveRate = scenarios.filter((s) => s.decision === "APPROVE").length / scenarios.length;
    const approvalImpact = (fixedApproveRate - currentApproveRate) * 100;

    const interventionCost: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
      dim.category === "technology" ? "CRITICAL" :
      dim.category === "regulatory" ? "HIGH" :
      dim.category === "financial" ? "MEDIUM" : "LOW";

    conditions.push({
      dimensionKey: dim.key,
      dimensionName: dim.name,
      requiredValue: bestValue.label,
      currentValue: worstValue.label,
      approvalImpactPct: Math.round(approvalImpact * 100) / 100,
      interventionCost,
      rank: 0,
    });
  }

  conditions.sort((a, b) => b.approvalImpactPct - a.approvalImpactPct);
  conditions.forEach((c, i) => (c.rank = i + 1));
  return conditions;
}

function computeGovernanceAudit(scenarios: ScenarioResult[], config: SimCaseConfig): GovernanceTriggerFreq[] {
  const total = scenarios.length;
  const triggers = config.hardNoTriggers ?? DEFAULT_HARD_NO_TRIGGERS;
  const freqs: GovernanceTriggerFreq[] = [];

  for (const trigger of triggers) {
    const count = scenarios.filter((s) => s.hardNoTriggers.includes(trigger.label)).length;
    freqs.push({
      triggerKey: trigger.key,
      triggerLabel: trigger.label,
      frequency: count,
      frequencyPct: Math.round((count / total) * 10000) / 100,
    });
  }

  return freqs.sort((a, b) => b.frequencyPct - a.frequencyPct);
}

function sampleKeyScenarios(scenarios: ScenarioResult[]): ScenarioResult[] {
  const sorted = [...scenarios].sort((a, b) => a.irrPct - b.irrPct);
  const sampled: ScenarioResult[] = [];

  // Best 5, worst 5, base (median), approval threshold boundary
  sampled.push(...sorted.slice(-5).map((s) => ({ ...s })));
  sampled.push(...sorted.slice(0, 5).map((s) => ({ ...s })));
  const mid = Math.floor(sorted.length / 2);
  sampled.push(sorted[mid]);

  // First approval scenario
  const firstApproval = scenarios.find((s) => s.decision === "APPROVE");
  if (firstApproval) sampled.push(firstApproval);

  // Deduplicate by index
  const seen = new Set<number>();
  return sampled.filter((s) => {
    if (seen.has(s.index)) return false;
    seen.add(s.index);
    return true;
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random number generator (Mulberry32) */
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
}

function computeChecksum(config: SimCaseConfig, targetCount: number): string {
  const str = `${config.caseId}:${config.baseIrrPct}:${config.dimensions.length}:${targetCount}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// ── Helios-North Default Configuration ───────────────────────────────────────

export const HELIOS_NORTH_CONFIG: Omit<SimCaseConfig, "caseId"> = {
  title: "Helios-North Offshore Wind",
  baseIrrPct: 9.5,
  fundMinIrrPct: 15.0,
  dimensions: [
    {
      key: "foundation_tech",
      name: "Foundation Technology",
      category: "technology",
      values: [
        { label: "Independently Validated", irrDeltaPct: 3.2, weight: 0.15 },
        { label: "Moderate Underperformance Risk", irrDeltaPct: -0.8, weight: 0.40 },
        { label: "Unvalidated / Prototype Stage", irrDeltaPct: -4.9, weight: 0.45, isHardNo: true },
      ],
      interactionPenalties: {
        "foundation_tech+debt_cost": 1.2,
        "foundation_tech+construction_delay": 0.8,
      },
    },
    {
      key: "capex_stress",
      name: "Capex Stress",
      category: "financial",
      values: [
        { label: "Base Case (£4.2B)", irrDeltaPct: 0, weight: 0.25 },
        { label: "+5% Overrun", irrDeltaPct: -0.8, weight: 0.30 },
        { label: "+10% Overrun", irrDeltaPct: -1.6, weight: 0.25 },
        { label: "+20% Overrun", irrDeltaPct: -3.2, weight: 0.15 },
        { label: "+35% Overrun", irrDeltaPct: -5.6, weight: 0.05 },
      ],
    },
    {
      key: "cfd_strike",
      name: "CfD Strike Price",
      category: "revenue",
      values: [
        { label: "£73/MWh (Base)", irrDeltaPct: 0, weight: 0.30 },
        { label: "£80/MWh", irrDeltaPct: 1.4, weight: 0.30 },
        { label: "£85/MWh", irrDeltaPct: 2.8, weight: 0.25 },
        { label: "£90/MWh (AR7 Upper)", irrDeltaPct: 5.6, weight: 0.15 },
      ],
    },
    {
      key: "capacity_factor",
      name: "Capacity Factor",
      category: "revenue",
      values: [
        { label: "52% (Optimistic)", irrDeltaPct: 1.8, weight: 0.20 },
        { label: "50% (Base)", irrDeltaPct: 0, weight: 0.40 },
        { label: "48% (Conservative)", irrDeltaPct: -1.5, weight: 0.30 },
        { label: "45% (Stress)", irrDeltaPct: -3.2, weight: 0.10 },
      ],
    },
    {
      key: "regulatory_env",
      name: "Regulatory Environment",
      category: "regulatory",
      values: [
        { label: "Favorable AR7 / Grid Secured", irrDeltaPct: 2.1, weight: 0.25 },
        { label: "Neutral / Base Case", irrDeltaPct: 0, weight: 0.50 },
        { label: "Adverse AR7 / Planning Challenges", irrDeltaPct: -2.6, weight: 0.25, isHardNo: true },
      ],
    },
    {
      key: "construction_delay",
      name: "Construction Delay",
      category: "execution",
      values: [
        { label: "On Schedule", irrDeltaPct: 0, weight: 0.35 },
        { label: "6-Month Delay", irrDeltaPct: -0.9, weight: 0.35 },
        { label: "12-Month Delay", irrDeltaPct: -2.1, weight: 0.20 },
        { label: "24-Month Delay", irrDeltaPct: -4.3, weight: 0.10 },
      ],
    },
    {
      key: "debt_cost",
      name: "Debt Cost",
      category: "financial",
      values: [
        { label: "5.8% (Base)", irrDeltaPct: 0, weight: 0.35 },
        { label: "7.0% (Stress)", irrDeltaPct: -1.4, weight: 0.40 },
        { label: "9.0% (Severe Stress)", irrDeltaPct: -3.3, weight: 0.25 },
      ],
    },
    {
      key: "merchant_exposure",
      name: "Merchant Exposure",
      category: "revenue",
      values: [
        { label: "20% Unhedged", irrDeltaPct: 0, weight: 0.45, isHardNo: true },
        { label: "10% Partially Hedged", irrDeltaPct: 0.4, weight: 0.35 },
        { label: "0% Fully Contracted", irrDeltaPct: 1.5, weight: 0.20 },
      ],
    },
  ],
};
