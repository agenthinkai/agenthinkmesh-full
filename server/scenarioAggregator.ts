/**
 * scenarioAggregator.ts — Strategic Scenario Simulation Aggregation Layer v1.0
 *
 * Aggregates all simulation outputs into 5 institutional-grade surfaces:
 *
 *   1. Decision Distribution    — Approve / Conditional / Reject %
 *   2. Failure Vector Ranking   — Most common rejection causes
 *   3. Approval Pathways        — Combinations that increase approval probability
 *   4. Governance Heatmap       — Escalation clusters, veto clusters
 *   5. Sensitivity Surface      — Highest-impact variables, tipping points
 */

import type { ScenarioEvalResult, PerturbationCategory } from "./scenarioMutationEngine";
import { PERTURBATION_DIMENSIONS } from "./scenarioMutationEngine";

// ── Output Types ──────────────────────────────────────────────────────────────

export interface DecisionDistribution {
  approveCount: number;
  conditionalCount: number;
  rejectCount: number;
  approvePct: number;
  conditionalPct: number;
  rejectPct: number;
  totalScenarios: number;
  hardNoCount: number;
  hardNoPct: number;
}

export interface FailureVector {
  dimensionKey: string;
  dimensionLabel: string;
  category: PerturbationCategory;
  rejectionCount: number;
  rejectionContributionPct: number;
  avgApprovalDelta: number;
  escalationTriggerCount: number;
}

export interface ApprovalPathway {
  rank: number;
  description: string;
  /** Dimension keys that are at base/mild severity in this pathway */
  safeDimensions: string[];
  /** Estimated approval probability if these dimensions are kept safe */
  estimatedApprovalPct: number;
  scenarioCount: number;
}

export interface GovernanceHeatmapCell {
  category: PerturbationCategory;
  escalationCount: number;
  vetoCount: number;
  complianceCount: number;
  regulatoryFragilityScore: number; // 0–100
  totalScenarios: number;
  escalationPct: number;
}

export interface SensitivityEntry {
  rank: number;
  dimensionKey: string;
  dimensionLabel: string;
  category: PerturbationCategory;
  /** Average approval delta when this dimension is stressed */
  avgDeltaWhenStressed: number;
  /** Tipping point — severity level at which approval probability drops below 50% */
  tippingPointSeverity: string | null;
  /** Nonlinear interaction score — how much correlated dims amplify this dimension */
  interactionScore: number;
  impactScore: number; // 0–100 normalized
}

export interface SimulationAggregation {
  runId: string;
  dealId: string;
  mode: string;
  totalScenarios: number;
  completedAt: string;
  decisionDistribution: DecisionDistribution;
  failureVectors: FailureVector[];
  approvalPathways: ApprovalPathway[];
  governanceHeatmap: GovernanceHeatmapCell[];
  sensitivitySurface: SensitivityEntry[];
  /** Summary narrative for IC Memo integration */
  executiveSummary: string;
}

// ── Aggregation Engine ────────────────────────────────────────────────────────

export function aggregateSimulationResults(
  results: ScenarioEvalResult[],
  runId: string,
  dealId: string,
  mode: string
): SimulationAggregation {
  const total = results.length;
  if (total === 0) {
    throw new Error("Cannot aggregate empty results array");
  }

  // ── 1. Decision Distribution ─────────────────────────────────────────────
  const distribution = computeDecisionDistribution(results, total);

  // ── 2. Failure Vector Ranking ────────────────────────────────────────────
  const failureVectors = computeFailureVectors(results, total);

  // ── 3. Approval Pathways ─────────────────────────────────────────────────
  const approvalPathways = computeApprovalPathways(results, total);

  // ── 4. Governance Heatmap ────────────────────────────────────────────────
  const governanceHeatmap = computeGovernanceHeatmap(results, total);

  // ── 5. Sensitivity Surface ───────────────────────────────────────────────
  const sensitivitySurface = computeSensitivitySurface(results, total);

  // ── Executive Summary ────────────────────────────────────────────────────
  const executiveSummary = buildExecutiveSummary(
    distribution,
    failureVectors,
    approvalPathways,
    sensitivitySurface,
    total,
    mode
  );

  return {
    runId,
    dealId,
    mode,
    totalScenarios: total,
    completedAt: new Date().toISOString(),
    decisionDistribution: distribution,
    failureVectors,
    approvalPathways,
    governanceHeatmap,
    sensitivitySurface,
    executiveSummary,
  };
}

// ── 1. Decision Distribution ──────────────────────────────────────────────────

function computeDecisionDistribution(
  results: ScenarioEvalResult[],
  total: number
): DecisionDistribution {
  let approveCount = 0;
  let conditionalCount = 0;
  let rejectCount = 0;
  let hardNoCount = 0;

  for (const r of results) {
    if (r.decision === "APPROVE") approveCount++;
    else if (r.decision === "CONDITIONAL") conditionalCount++;
    else rejectCount++;
    if (r.hasHardNo) hardNoCount++;
  }

  return {
    approveCount,
    conditionalCount,
    rejectCount,
    approvePct: Math.round((approveCount / total) * 1000) / 10,
    conditionalPct: Math.round((conditionalCount / total) * 1000) / 10,
    rejectPct: Math.round((rejectCount / total) * 1000) / 10,
    totalScenarios: total,
    hardNoCount,
    hardNoPct: Math.round((hardNoCount / total) * 1000) / 10,
  };
}

// ── 2. Failure Vector Ranking ─────────────────────────────────────────────────

function computeFailureVectors(
  results: ScenarioEvalResult[],
  total: number
): FailureVector[] {
  // Count how often each dimension key appears in top blockers of rejected scenarios
  const rejections = results.filter(r => r.decision === "REJECT" || r.decision === "CONDITIONAL");
  const dimCounts = new Map<string, { count: number; deltaSum: number; escalations: number }>();

  for (const r of rejections) {
    for (const blocker of r.topBlockers) {
      // Match blocker text to dimension key
      for (const dim of PERTURBATION_DIMENSIONS) {
        if (blocker.toLowerCase().includes(dim.key.replace(/_/g, " ")) ||
            blocker.toLowerCase().includes(dim.label.toLowerCase().substring(0, 10))) {
          const existing = dimCounts.get(dim.key) ?? { count: 0, deltaSum: 0, escalations: 0 };
          existing.count++;
          existing.deltaSum += r.approvalDelta;
          if (r.escalationTriggers.length > 0) existing.escalations++;
          dimCounts.set(dim.key, existing);
        }
      }
    }
    // Also count by dominant risk category
    const catKey = `category:${r.dominantRiskCategory}`;
    const existing = dimCounts.get(catKey) ?? { count: 0, deltaSum: 0, escalations: 0 };
    existing.count++;
    existing.deltaSum += r.approvalDelta;
    dimCounts.set(catKey, existing);
  }

  // Also aggregate by category for broader picture
  const categoryRejections = new Map<string, { count: number; deltaSum: number; escalations: number }>();
  for (const r of rejections) {
    const key = r.dominantRiskCategory;
    const existing = categoryRejections.get(key) ?? { count: 0, deltaSum: 0, escalations: 0 };
    existing.count++;
    existing.deltaSum += r.approvalDelta;
    if (r.escalationTriggers.length > 0) existing.escalations++;
    categoryRejections.set(key, existing);
  }

  const vectors: FailureVector[] = [];

  // Add category-level vectors
  for (const [category, stats] of categoryRejections.entries()) {
    const dim = PERTURBATION_DIMENSIONS.find(d => d.category === category);
    vectors.push({
      dimensionKey: `category_${category}`,
      dimensionLabel: `${category.charAt(0).toUpperCase() + category.slice(1)} Stress`,
      category: category as PerturbationCategory,
      rejectionCount: stats.count,
      rejectionContributionPct: Math.round((stats.count / Math.max(rejections.length, 1)) * 1000) / 10,
      avgApprovalDelta: Math.round((stats.deltaSum / stats.count) * 100) / 100,
      escalationTriggerCount: stats.escalations,
    });
  }

  return vectors
    .sort((a, b) => b.rejectionCount - a.rejectionCount)
    .slice(0, 8);
}

// ── 3. Approval Pathways ──────────────────────────────────────────────────────

function computeApprovalPathways(
  results: ScenarioEvalResult[],
  total: number
): ApprovalPathway[] {
  const approvals = results.filter(r => r.decision === "APPROVE");
  const approvalPct = (approvals.length / total) * 100;

  // Find which categories are most commonly unstressed in approval scenarios
  const categoryStressInApprovals = new Map<string, number>();
  for (const r of approvals) {
    for (const cat of r.stressedCategories) {
      categoryStressInApprovals.set(cat, (categoryStressInApprovals.get(cat) ?? 0) + 1);
    }
  }

  const pathways: ApprovalPathway[] = [];

  // Pathway 1: Financial + Execution stability
  const finExecApprovals = approvals.filter(
    r => !r.stressedCategories.includes("financial") && !r.stressedCategories.includes("execution")
  );
  if (finExecApprovals.length > 0) {
    pathways.push({
      rank: 1,
      description: "Financial assumptions hold + Execution delivers on plan",
      safeDimensions: ["capex_inflation", "ebitda_compression", "construction_delays", "vendor_underperformance"],
      estimatedApprovalPct: Math.round((finExecApprovals.length / total) * 1000) / 10,
      scenarioCount: finExecApprovals.length,
    });
  }

  // Pathway 2: No governance stress
  const noGovApprovals = approvals.filter(r => !r.stressedCategories.includes("governance"));
  if (noGovApprovals.length > 0) {
    pathways.push({
      rank: 2,
      description: "Governance integrity maintained — no board conflict or compliance violations",
      safeDimensions: ["board_disagreement", "compliance_violations", "audit_concerns", "escalation_frequency"],
      estimatedApprovalPct: Math.round((noGovApprovals.length / total) * 1000) / 10,
      scenarioCount: noGovApprovals.length,
    });
  }

  // Pathway 3: Regulatory stability
  const noRegApprovals = approvals.filter(r => !r.stressedCategories.includes("regulatory"));
  if (noRegApprovals.length > 0) {
    pathways.push({
      rank: 3,
      description: "Regulatory environment remains stable — no subsidy cuts or approval delays",
      safeDimensions: ["subsidy_reduction", "delayed_approvals", "sovereign_restrictions"],
      estimatedApprovalPct: Math.round((noRegApprovals.length / total) * 1000) / 10,
      scenarioCount: noRegApprovals.length,
    });
  }

  // Pathway 4: Market resilience
  const noMktApprovals = approvals.filter(r => !r.stressedCategories.includes("market"));
  if (noMktApprovals.length > 0) {
    pathways.push({
      rank: 4,
      description: "Market demand and competitive dynamics remain favourable",
      safeDimensions: ["recession_scenario", "competitor_aggression", "demand_contraction", "pricing_pressure"],
      estimatedApprovalPct: Math.round((noMktApprovals.length / total) * 1000) / 10,
      scenarioCount: noMktApprovals.length,
    });
  }

  return pathways.sort((a, b) => b.estimatedApprovalPct - a.estimatedApprovalPct).slice(0, 4);
}

// ── 4. Governance Heatmap ─────────────────────────────────────────────────────

function computeGovernanceHeatmap(
  results: ScenarioEvalResult[],
  total: number
): GovernanceHeatmapCell[] {
  const categories: PerturbationCategory[] = ["financial", "regulatory", "execution", "market", "technology", "governance"];
  const cells: GovernanceHeatmapCell[] = [];

  for (const cat of categories) {
    const catResults = results.filter(r => r.stressedCategories.includes(cat));
    const escalationCount = catResults.filter(r => r.escalationTriggers.length > 0).length;
    const vetoCount = catResults.filter(r => r.hasHardNo).length;
    const complianceCount = cat === "governance"
      ? results.filter(r => r.governanceConcerns.length > 0).length
      : 0;

    const fragility = catResults.length > 0
      ? Math.round(((escalationCount + vetoCount * 2) / catResults.length) * 50)
      : 0;

    cells.push({
      category: cat,
      escalationCount,
      vetoCount,
      complianceCount,
      regulatoryFragilityScore: Math.min(100, fragility),
      totalScenarios: catResults.length,
      escalationPct: catResults.length > 0
        ? Math.round((escalationCount / catResults.length) * 1000) / 10
        : 0,
    });
  }

  return cells;
}

// ── 5. Sensitivity Surface ────────────────────────────────────────────────────

function computeSensitivitySurface(
  results: ScenarioEvalResult[],
  total: number
): SensitivityEntry[] {
  const entries: SensitivityEntry[] = [];

  // Compute impact score per category based on rejection rates when stressed
  const categories: PerturbationCategory[] = ["financial", "regulatory", "execution", "market", "technology", "governance"];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const stressed = results.filter(r => r.stressedCategories.includes(cat));
    const unstressed = results.filter(r => !r.stressedCategories.includes(cat));

    if (stressed.length === 0) continue;

    const stressedRejectPct = stressed.filter(r => r.decision === "REJECT").length / stressed.length;
    const unstressedRejectPct = unstressed.length > 0
      ? unstressed.filter(r => r.decision === "REJECT").length / unstressed.length
      : 0;

    const avgDelta = stressed.reduce((s, r) => s + r.approvalDelta, 0) / stressed.length;
    const interactionScore = stressed.filter(r => r.stressedCategories.length >= 3).length / stressed.length;

    // Find tipping point: severity where rejection rate first exceeds 50%
    const tippingPoint = stressedRejectPct > 0.5 ? "moderate" : stressedRejectPct > 0.3 ? "severe" : null;

    // Normalized impact score 0–100
    const impactScore = Math.round(Math.min(100, (stressedRejectPct - unstressedRejectPct) * 200));

    // Representative dimension for this category
    const repDim = PERTURBATION_DIMENSIONS.find(d => d.category === cat);

    entries.push({
      rank: i + 1,
      dimensionKey: `category_${cat}`,
      dimensionLabel: `${cat.charAt(0).toUpperCase() + cat.slice(1)} Stress`,
      category: cat,
      avgDeltaWhenStressed: Math.round(avgDelta * 100) / 100,
      tippingPointSeverity: tippingPoint,
      interactionScore: Math.round(interactionScore * 100) / 100,
      impactScore: Math.max(0, impactScore),
    });
  }

  return entries
    .sort((a, b) => b.impactScore - a.impactScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ── Executive Summary Builder ─────────────────────────────────────────────────

function buildExecutiveSummary(
  dist: DecisionDistribution,
  vectors: FailureVector[],
  pathways: ApprovalPathway[],
  sensitivity: SensitivityEntry[],
  total: number,
  mode: string
): string {
  const topVector = vectors[0];
  const topPathway = pathways[0];
  const topSensitivity = sensitivity[0];

  const modeLabel = {
    quick: "100-scenario quick stress",
    institutional: "1,000-scenario institutional stress",
    deep: "10,000-scenario strategic deep stress",
    infrastructure: "100,000-scenario infrastructure scale",
  }[mode] ?? `${total}-scenario`;

  return `Strategic Scenario Simulation (${modeLabel}) across ${total.toLocaleString()} governed scenarios. ` +
    `Decision distribution: ${dist.approvePct}% APPROVE, ${dist.conditionalPct}% CONDITIONAL, ${dist.rejectPct}% REJECT. ` +
    `${dist.hardNoPct > 0 ? `Hard-no governance triggers activated in ${dist.hardNoPct}% of scenarios. ` : ""}` +
    `Primary failure vector: ${topVector?.dimensionLabel ?? "N/A"} (${topVector?.rejectionContributionPct ?? 0}% of rejections). ` +
    `Highest-impact variable: ${topSensitivity?.dimensionLabel ?? "N/A"} (impact score ${topSensitivity?.impactScore ?? 0}/100). ` +
    `Strongest approval pathway: ${topPathway?.description ?? "N/A"} (${topPathway?.estimatedApprovalPct ?? 0}% approval rate).`;
}
