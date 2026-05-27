/**
 * simulationFingerprintEngine.ts — Simulation Fingerprint Layer v1
 *
 * Generates a normalized SimulationFingerprint for every completed simulation run.
 * This is the data foundation for future pattern recognition — NOT winner prediction,
 * NOT investment recommendation.
 *
 * Design principles:
 *   - All metrics are deterministic (no LLM, no inference)
 *   - Missing inputs → null + dataUnavailable marker (never fabricated precision)
 *   - One fingerprint per run (never overwritten)
 *   - Upgrade/delta fields populated only when isUpgradedScenario = true
 */

import type { SimulationAggregation, DecisionDistribution, FailureVector, ApprovalPathway, SensitivityEntry } from "./scenarioAggregator";
import type { ScenarioEvalResult } from "./scenarioMutationEngine";

// ── Fingerprint Type ──────────────────────────────────────────────────────────

export interface SimulationFingerprint {
  // ── Identity ───────────────────────────────────────────────────────────────
  dealId: string;
  runId: string;
  councilMode: string | null;
  scenarioCount: number;
  simulationMode: string;
  createdAt: string; // ISO UTC

  // ── Decision distribution ──────────────────────────────────────────────────
  approvePct: number;
  conditionalPct: number;
  rejectPct: number;
  vetoPct: number;                    // hardNoPct alias
  rescuedConditionalPct: number;
  finalRejectedPct: number;
  attributionUnavailablePct: number;  // hard-nos with null terminalFlags

  // ── Resilience / fragility metrics ────────────────────────────────────────
  rescueabilityScore: number | null;         // 0–100
  vetoConcentrationScore: number | null;     // 0–100
  structuralFragilityScore: number | null;   // 0–100
  scenarioEntropy: number | null;            // 0–1 (Shannon entropy of approve/conditional/reject)
  councilDisagreementScore: number | null;   // 0–100; null if dataUnavailable
  councilDisagreementDataUnavailable: boolean;

  // ── Risk pattern fields ────────────────────────────────────────────────────
  dominantFailureVectors: string[];          // top-3 dimension labels
  dominantApprovalPathways: string[];        // top-3 pathway descriptions
  sensitivityRanking: string[];              // dimension labels ordered by impactScore
  terminalFlagFrequency: Record<string, number>; // flag → count across hard-no variants
  governanceEscalationFrequency: Record<string, number>; // category → escalation count

  // ── Upgrade / delta fields ─────────────────────────────────────────────────
  isUpgradedScenario: boolean;
  originalRunId: string | null;
  originalVerdict: string | null;
  upgradedVerdict: string | null;
  resilienceDelta: number | null;            // upgradedApprovePct - originalApprovePct (if available)
  upgradeEffectiveness: number | null;       // resilienceDelta / (100 - originalApprovePct), 0–1
  mitigationDependencyScore: number | null;  // rescuedConditionalPct / (vetoPct || 1)

  // ── Metadata ───────────────────────────────────────────────────────────────
  sourceDealName: string;
  sourceSector: string | null;               // not available in simulation input — null
  sourceGeography: string | null;            // not available in simulation input — null
  version: string;                           // fingerprint schema version
}

// ── Metric Formulas ───────────────────────────────────────────────────────────

/**
 * rescueabilityScore (0–100):
 * Measures how much of the hard-no pool is structurally rescuable.
 * Formula: rescuedConditionalPct * 1.0 + (approvalPathwayCount > 0 ? 5 : 0)
 * Capped at 100. Null if vetoPct === 0 (no hard-nos to rescue).
 */
function computeRescueabilityScore(
  dist: DecisionDistribution,
  pathways: ApprovalPathway[]
): number | null {
  if (dist.hardNoCount === 0) return null; // no hard-nos → metric not applicable
  const base = dist.rescuedConditionalPct; // already 0–100
  const pathwayBonus = pathways.length > 0 ? 5 : 0;
  return Math.min(100, Math.round(base + pathwayBonus));
}

/**
 * vetoConcentrationScore (0–100):
 * Measures how concentrated the veto/hard-no triggers are.
 * High score = one or two flags dominate all hard-nos (concentrated risk).
 * Low score = hard-nos spread across many flags (diffuse risk).
 * Formula: if vetoPct === 0 → null.
 * Otherwise: max single-flag frequency / totalHardNos * 100.
 */
function computeVetoConcentrationScore(
  dist: DecisionDistribution,
  terminalFlagFrequency: Record<string, number>
): number | null {
  if (dist.hardNoCount === 0) return null;
  const flags = Object.values(terminalFlagFrequency);
  if (flags.length === 0) return null;
  const maxFreq = Math.max(...flags);
  return Math.min(100, Math.round((maxFreq / dist.hardNoCount) * 100));
}

/**
 * structuralFragilityScore (0–100):
 * Measures the overall structural weakness of the deal under stress.
 * Formula: finalRejectedPct + vetoPct + attributionUnavailablePct
 * Capped at 100. Higher = more fragile.
 */
function computeStructuralFragilityScore(
  dist: DecisionDistribution,
  attributionUnavailablePct: number
): number | null {
  const score = dist.finalRejectedPct + dist.hardNoPct + attributionUnavailablePct;
  return Math.min(100, Math.round(score * 10) / 10);
}

/**
 * scenarioEntropy (0–1):
 * Shannon entropy of the approve/conditional/reject distribution.
 * H = -sum(p * log2(p)) for p in {approvePct, conditionalPct, rejectPct} / 100
 * Normalized to [0, 1] by dividing by log2(3) (max entropy for 3 outcomes).
 * 1.0 = perfectly uniform distribution; 0.0 = all scenarios have same outcome.
 */
function computeScenarioEntropy(dist: DecisionDistribution): number | null {
  const total = dist.totalScenarios;
  if (total === 0) return null;
  const probs = [
    dist.approveCount / total,
    dist.conditionalCount / total,
    dist.rejectCount / total,
  ].filter(p => p > 0);
  const rawEntropy = probs.reduce((h, p) => h - p * Math.log2(p), 0);
  const maxEntropy = Math.log2(3);
  return Math.round((rawEntropy / maxEntropy) * 1000) / 1000;
}

/**
 * councilDisagreementScore (0–100):
 * Measures variance in confidence scores across scenario evaluations.
 * High score = evaluations disagree strongly (high std dev of confidenceScore).
 * Low score = evaluations are uniform (all cheap-path at 0.92 or all LLM at similar confidence).
 *
 * Availability: only meaningful if at least some variants went through the LLM path.
 * If all variants are cheap-path (confidenceScore = 0.92 for all), the variance is 0
 * and the score is 0 — but this is a data-availability issue, not a real signal.
 * In that case, mark dataUnavailable = true.
 *
 * Formula: stdDev(confidenceScores) * 200, capped at 100.
 * (stdDev of 0.5 → score 100; stdDev of 0.25 → score 50)
 */
function computeCouncilDisagreementScore(
  results: ScenarioEvalResult[]
): { score: number | null; dataUnavailable: boolean } {
  if (results.length === 0) return { score: null, dataUnavailable: true };
  const scores = results.map(r => r.confidenceScore);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  // If all confidence scores are identical (all cheap-path), variance is 0 — data unavailable
  if (stdDev < 0.001) return { score: null, dataUnavailable: true };
  const score = Math.min(100, Math.round(stdDev * 200));
  return { score, dataUnavailable: false };
}

/**
 * terminalFlagFrequency:
 * Count of each terminal flag across all hard-no variants with Delta Engine results.
 * Only counts variants where attributionUnavailable is false.
 */
function computeTerminalFlagFrequency(results: ScenarioEvalResult[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const r of results) {
    if (!r.hasHardNo || !r.deltaEngine || r.deltaEngine.attributionUnavailable) continue;
    for (const flag of r.deltaEngine.triggeringFlags) {
      freq[flag] = (freq[flag] ?? 0) + 1;
    }
  }
  return freq;
}

/**
 * governanceEscalationFrequency:
 * Count of escalation triggers per category across all results.
 */
function computeGovernanceEscalationFrequency(results: ScenarioEvalResult[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const r of results) {
    for (const trigger of r.escalationTriggers) {
      // escalationTriggers are dimension keys like "capex_severe" — extract category prefix
      const category = trigger.split("_")[0];
      freq[category] = (freq[category] ?? 0) + 1;
    }
  }
  return freq;
}

/**
 * attributionUnavailablePct:
 * Percentage of hard-no variants where terminalFlags were null (ATTRIBUTION_UNAVAILABLE).
 */
function computeAttributionUnavailablePct(
  results: ScenarioEvalResult[],
  total: number
): number {
  if (total === 0) return 0;
  const count = results.filter(r => r.hasHardNo && r.deltaEngine?.attributionUnavailable === true).length;
  return Math.round((count / total) * 1000) / 10;
}

// ── Main Fingerprint Builder ──────────────────────────────────────────────────

export interface FingerprintInput {
  aggregation: SimulationAggregation;
  results: ScenarioEvalResult[];
  councilMode: string | null;
  dealName: string;
  isUpgradedScenario: boolean;
  originalRunId: string | null;
  originalVerdict: string | null;
  upgradedVerdict: string | null;
  /** Original approvePct from the first run (for resilienceDelta calculation) */
  originalApprovePct: number | null;
}

export function computeSimulationFingerprint(input: FingerprintInput): SimulationFingerprint {
  const { aggregation, results, councilMode, dealName } = input;
  const dist = aggregation.decisionDistribution;
  const total = aggregation.totalScenarios;

  // Derived fields
  const terminalFlagFrequency = computeTerminalFlagFrequency(results);
  const governanceEscalationFrequency = computeGovernanceEscalationFrequency(results);
  const attributionUnavailablePct = computeAttributionUnavailablePct(results, total);
  const { score: councilDisagreementScore, dataUnavailable: councilDisagreementDataUnavailable } =
    computeCouncilDisagreementScore(results);

  // Upgrade/delta fields
  const resilienceDelta = (input.isUpgradedScenario && input.originalApprovePct !== null)
    ? Math.round((dist.approvePct - input.originalApprovePct) * 10) / 10
    : null;
  const upgradeEffectiveness = (resilienceDelta !== null && input.originalApprovePct !== null)
    ? (100 - input.originalApprovePct) > 0
      ? Math.round((resilienceDelta / (100 - input.originalApprovePct)) * 1000) / 1000
      : null
    : null;
  const mitigationDependencyScore = (input.isUpgradedScenario && dist.hardNoCount > 0)
    ? Math.round((dist.rescuedConditionalPct / (dist.hardNoPct || 1)) * 100) / 100
    : null;

  return {
    // Identity
    dealId: aggregation.dealId,
    runId: aggregation.runId,
    councilMode,
    scenarioCount: total,
    simulationMode: aggregation.mode,
    createdAt: aggregation.completedAt,

    // Decision distribution
    approvePct: dist.approvePct,
    conditionalPct: dist.conditionalPct,
    rejectPct: dist.rejectPct,
    vetoPct: dist.hardNoPct,
    rescuedConditionalPct: dist.rescuedConditionalPct,
    finalRejectedPct: dist.finalRejectedPct,
    attributionUnavailablePct,

    // Resilience / fragility metrics
    rescueabilityScore: computeRescueabilityScore(dist, aggregation.approvalPathways),
    vetoConcentrationScore: computeVetoConcentrationScore(dist, terminalFlagFrequency),
    structuralFragilityScore: computeStructuralFragilityScore(dist, attributionUnavailablePct),
    scenarioEntropy: computeScenarioEntropy(dist),
    councilDisagreementScore,
    councilDisagreementDataUnavailable,

    // Risk pattern fields
    dominantFailureVectors: aggregation.failureVectors.slice(0, 3).map(v => v.dimensionLabel),
    dominantApprovalPathways: aggregation.approvalPathways.slice(0, 3).map(p => p.description),
    sensitivityRanking: aggregation.sensitivitySurface.map(s => s.dimensionLabel),
    terminalFlagFrequency,
    governanceEscalationFrequency,

    // Upgrade / delta fields
    isUpgradedScenario: input.isUpgradedScenario,
    originalRunId: input.originalRunId,
    originalVerdict: input.originalVerdict,
    upgradedVerdict: input.upgradedVerdict,
    resilienceDelta,
    upgradeEffectiveness,
    mitigationDependencyScore,

    // Metadata
    sourceDealName: dealName,
    sourceSector: null,     // not available in simulation input
    sourceGeography: null,  // not available in simulation input
    version: "1.0",
  };
}
