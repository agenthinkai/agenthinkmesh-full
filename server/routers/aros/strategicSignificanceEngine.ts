/**
 * strategicSignificanceEngine.ts — Strategic Significance Engine
 *
 * Scores every detected decision on six dimensions before any brief is generated.
 * Atlas is no longer rewarded for generating more briefs.
 * Atlas is rewarded for generating fewer, better, more consequential briefs.
 *
 * DECISION HIERARCHY:
 *   LEVEL_1 — Operational Observation: store only, no brief
 *   LEVEL_2 — Strategic Watch: monitor continuously, update Decision Twin
 *   LEVEL_3 — Executive Intelligence Candidate: eligible for review
 *   LEVEL_4 — Board-Level Decision: immediate brief, highest calibration priority
 *
 * BRIEF GENERATION GATE:
 *   SSS >= threshold (default 90) AND ESI >= 85 AND Evidence Confidence >= 80
 *   AND all four Quality Gate questions = YES
 *
 * QUEUE CLASSIFICATION:
 *   IMMEDIATE — LEVEL_4, SSS≥90, ESI≥85, Confidence≥80 (max 10/day)
 *   WATCH     — LEVEL_3/4, SSS 65-89 or ESI/Confidence below threshold
 *   MONITOR   — LEVEL_1/2, or any gate failure
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import { arosCompanies, atlasSignificanceConfig } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "../../_core/notification";

export type DecisionLevel = "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "LEVEL_4";

export interface SSSResult {
  sss: number;                      // 0-100 composite score
  esi: number;                      // 0-100 Executive Surprise Index
  decisionLevel: DecisionLevel;
  // Six dimension sub-scores
  economicImpact: number;           // 0-100
  irreversibility: number;          // 0-100
  timeCriticality: number;          // 0-100
  hiddenVariableStrength: number;   // 0-100
  executiveRelevance: number;       // 0-100
  novelty: number;                  // 0-100
  // Quality Gate
  qualityGateActionable: boolean;
  qualityGateEvidenceBased: boolean;
  qualityGateDifferentiated: boolean;
  qualityGateBoardRelevant: boolean;
  qualityGatePassed: boolean;
  // Explanation
  rationale: string;
  briefRejectionReason?: string;    // set when qualityGatePassed = false
}

export interface SSSInput {
  companyName: string;
  sector: string;
  country: string;
  detectedDecision: string;         // the strategic decision Atlas detected
  hiddenVariable: string;           // the hidden variable identified
  decisionTwinSummary: string;      // brief summary of the Decision Twin
  revenueUsdBn?: number;
  employees?: number;
}

/**
 * Compute the weighted SSS from six dimension scores.
 * Weights are loaded from atlas_significance_config (default: 25/20/15/20/10/10).
 */
function computeWeightedSSS(
  dims: { economicImpact: number; irreversibility: number; timeCriticality: number; hiddenVariableStrength: number; executiveRelevance: number; novelty: number },
  weights: { weightEconomicImpact: number; weightIrreversibility: number; weightTimeCriticality: number; weightHiddenVariableStrength: number; weightExecutiveRelevance: number; weightNovelty: number }
): number {
  const total =
    dims.economicImpact * weights.weightEconomicImpact +
    dims.irreversibility * weights.weightIrreversibility +
    dims.timeCriticality * weights.weightTimeCriticality +
    dims.hiddenVariableStrength * weights.weightHiddenVariableStrength +
    dims.executiveRelevance * weights.weightExecutiveRelevance +
    dims.novelty * weights.weightNovelty;
  const weightSum =
    weights.weightEconomicImpact +
    weights.weightIrreversibility +
    weights.weightTimeCriticality +
    weights.weightHiddenVariableStrength +
    weights.weightExecutiveRelevance +
    weights.weightNovelty;
  return Math.round(total / weightSum);
}

/**
 * Classify a decision into the four-level hierarchy.
 */
function classifyDecisionLevel(sss: number, autoRejectBelow: number): DecisionLevel {
  if (sss < autoRejectBelow) return "LEVEL_1";
  if (sss < 65) return "LEVEL_2";
  if (sss < 90) return "LEVEL_3";
  return "LEVEL_4";
}

/**
 * Core scoring function. Calls LLM to evaluate the six dimensions and ESI,
 * then computes the weighted SSS and classifies the decision.
 */
export async function scoreStrategicSignificance(
  input: SSSInput,
  config?: { briefGenerationThreshold: number; autoRejectBelow: number; weights: Record<string, number> }
): Promise<SSSResult> {
  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Atlas Strategic Significance Engine.

Your role is to evaluate whether a detected strategic decision is important enough to deserve an Executive Intelligence Brief.

SCORING PHILOSOPHY:
Atlas is no longer rewarded for generating more briefs.
Atlas is rewarded for generating fewer, better, more consequential briefs.

The long-term ambition is not to become the company that sends the most Executive Intelligence Briefs.
The ambition is to become the company whose Executive Intelligence Briefs are considered important enough to be circulated inside executive committees and boardrooms.

EVIDENCE GOVERNANCE:
Never invent significance. If evidence is weak, score low. Express uncertainty explicitly.
A decision that appears significant but lacks evidence should score LOW on hiddenVariableStrength and novelty.

Return ONLY valid JSON matching the schema exactly.`,
      },
      {
        role: "user",
        content: `Evaluate the strategic significance of this detected decision.

Company: ${input.companyName}
Sector: ${input.sector}
Country: ${input.country}
Revenue (USD bn): ${input.revenueUsdBn ?? "unknown"}
Employees: ${input.employees ?? "unknown"}

Detected Strategic Decision:
${input.detectedDecision}

Hidden Variable Identified:
${input.hiddenVariable}

Decision Twin Summary:
${input.decisionTwinSummary}

Score each dimension from 0 to 100:

1. ECONOMIC IMPACT — Capital allocation affected, revenue impact, margin impact, market value impact
2. IRREVERSIBILITY — How difficult is the decision to reverse?
3. TIME CRITICALITY — Does delay materially change the outcome?
4. HIDDEN VARIABLE STRENGTH — How central is the hidden variable to success or failure?
5. EXECUTIVE RELEVANCE — Is this a CEO, Board, CFO, CIO, or business-unit decision?
6. NOVELTY — Is Atlas providing an observation that is genuinely uncommon?

EXECUTIVE SURPRISE INDEX (0-100):
How likely is the executive to respond: "I had not considered that."
Atlas should optimise for ESI, not word count.

QUALITY GATE — Answer YES or NO to each:
1. Is this insight actionable?
2. Is it evidence-based?
3. Is it genuinely differentiated?
4. Would it matter to a board discussion?

Return this exact JSON:
{
  "economicImpact": number,
  "irreversibility": number,
  "timeCriticality": number,
  "hiddenVariableStrength": number,
  "executiveRelevance": number,
  "novelty": number,
  "esi": number,
  "qualityGateActionable": boolean,
  "qualityGateEvidenceBased": boolean,
  "qualityGateDifferentiated": boolean,
  "qualityGateBoardRelevant": boolean,
  "rationale": "string — 2-3 sentences explaining the score",
  "briefRejectionReason": "string or null — if any quality gate fails, explain which and why"
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sss_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            economicImpact: { type: "number" },
            irreversibility: { type: "number" },
            timeCriticality: { type: "number" },
            hiddenVariableStrength: { type: "number" },
            executiveRelevance: { type: "number" },
            novelty: { type: "number" },
            esi: { type: "number" },
            qualityGateActionable: { type: "boolean" },
            qualityGateEvidenceBased: { type: "boolean" },
            qualityGateDifferentiated: { type: "boolean" },
            qualityGateBoardRelevant: { type: "boolean" },
            rationale: { type: "string" },
            briefRejectionReason: { type: ["string", "null"] },
          },
          required: [
            "economicImpact", "irreversibility", "timeCriticality",
            "hiddenVariableStrength", "executiveRelevance", "novelty",
            "esi", "qualityGateActionable", "qualityGateEvidenceBased",
            "qualityGateDifferentiated", "qualityGateBoardRelevant",
            "rationale", "briefRejectionReason",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = llmResponse?.choices?.[0]?.message?.content;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : {};

  const weights = config?.weights ?? {
    weightEconomicImpact: 25,
    weightIrreversibility: 20,
    weightTimeCriticality: 15,
    weightHiddenVariableStrength: 20,
    weightExecutiveRelevance: 10,
    weightNovelty: 10,
  };

  const autoRejectBelow = config?.autoRejectBelow ?? 40;
  const threshold = config?.briefGenerationThreshold ?? 85;

  const dims = {
    economicImpact: Math.min(100, Math.max(0, Math.round(parsed.economicImpact ?? 0))),
    irreversibility: Math.min(100, Math.max(0, Math.round(parsed.irreversibility ?? 0))),
    timeCriticality: Math.min(100, Math.max(0, Math.round(parsed.timeCriticality ?? 0))),
    hiddenVariableStrength: Math.min(100, Math.max(0, Math.round(parsed.hiddenVariableStrength ?? 0))),
    executiveRelevance: Math.min(100, Math.max(0, Math.round(parsed.executiveRelevance ?? 0))),
    novelty: Math.min(100, Math.max(0, Math.round(parsed.novelty ?? 0))),
  };

  const sss = computeWeightedSSS(dims, weights as Parameters<typeof computeWeightedSSS>[1]);
  const esi = Math.min(100, Math.max(0, Math.round(parsed.esi ?? 0)));
  const decisionLevel = classifyDecisionLevel(sss, autoRejectBelow);

  const qualityGateActionable = Boolean(parsed.qualityGateActionable);
  const qualityGateEvidenceBased = Boolean(parsed.qualityGateEvidenceBased);
  const qualityGateDifferentiated = Boolean(parsed.qualityGateDifferentiated);
  const qualityGateBoardRelevant = Boolean(parsed.qualityGateBoardRelevant);
  const qualityGatePassed =
    qualityGateActionable &&
    qualityGateEvidenceBased &&
    qualityGateDifferentiated &&
    qualityGateBoardRelevant &&
    sss >= threshold;

  return {
    sss,
    esi,
    decisionLevel,
    ...dims,
    qualityGateActionable,
    qualityGateEvidenceBased,
    qualityGateDifferentiated,
    qualityGateBoardRelevant,
    qualityGatePassed,
    rationale: parsed.rationale ?? "",
    briefRejectionReason: parsed.briefRejectionReason ?? undefined,
  };
}

/**
 * Load the active significance config from the database.
 * Returns defaults if no config row exists.
 */
export async function loadSignificanceConfig() {
  try {
    const db = await getDb();
    if (!db) return null;
    const [cfg] = await db.select().from(atlasSignificanceConfig).where(eq(atlasSignificanceConfig.id, 1)).limit(1);
    return cfg ?? null;
  } catch {
    return null;
  }
}

/**
 * Score a company and persist the result to aros_companies.
 * Returns the full SSSResult.
 */
export async function scoreAndPersistCompany(
  companyId: number,
  input: SSSInput
): Promise<SSSResult> {
  const cfg = await loadSignificanceConfig();
  const weights = cfg
    ? {
        weightEconomicImpact: cfg.weightEconomicImpact,
        weightIrreversibility: cfg.weightIrreversibility,
        weightTimeCriticality: cfg.weightTimeCriticality,
        weightHiddenVariableStrength: cfg.weightHiddenVariableStrength,
        weightExecutiveRelevance: cfg.weightExecutiveRelevance,
        weightNovelty: cfg.weightNovelty,
      }
    : undefined;

  const result = await scoreStrategicSignificance(input, {
    briefGenerationThreshold: cfg?.briefGenerationThreshold ?? 85,
    autoRejectBelow: cfg?.autoRejectBelow ?? 40,
    weights: weights ?? {},
  });

  // Persist to database
  const db = await getDb();
  if (db) {
    await db
      .update(arosCompanies)
      .set({
        sss: result.sss,
        esi: result.esi,
        decisionLevel: result.decisionLevel,
        sssEconomicImpact: result.economicImpact,
        sssIrreversibility: result.irreversibility,
        sssTimeCriticality: result.timeCriticality,
        sssHiddenVariableStrength: result.hiddenVariableStrength,
        sssExecutiveRelevance: result.executiveRelevance,
        sssNovelty: result.novelty,
        qualityGateActionable: result.qualityGateActionable ? 1 : 0,
        qualityGateEvidenceBased: result.qualityGateEvidenceBased ? 1 : 0,
        qualityGateDifferentiated: result.qualityGateDifferentiated ? 1 : 0,
        qualityGateBoardRelevant: result.qualityGateBoardRelevant ? 1 : 0,
        qualityGatePassed: result.qualityGatePassed ? 1 : 0,
        sssRationale: result.rationale,
        sssCalculatedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(arosCompanies.id, companyId));

    // Notify owner immediately on LEVEL_4
    if (result.decisionLevel === "LEVEL_4" && cfg?.notifyOnLevel4) {
      await notifyOwner({
        title: `LEVEL 4 Decision Detected — ${input.companyName} (SSS: ${result.sss})`,
        content: `Board-Level Decision identified.\n\nCompany: ${input.companyName} (${input.sector}, ${input.country})\nSSS: ${result.sss}/100 | ESI: ${result.esi}/100\n\nDecision: ${input.detectedDecision}\n\nHidden Variable: ${input.hiddenVariable}\n\nRationale: ${result.rationale}\n\nImmediate Executive Intelligence Brief is eligible for generation.`,
      }).catch(() => {/* non-blocking */});
    }
  }

  return result;
}

/**
 * V2 Triple-Gate: SSS ≥90 AND ESI ≥85 AND Evidence Confidence ≥80
 * AND all four Quality Gate questions = YES.
 * If any gate fails, returns eligible=false with the specific reason.
 */
export function isBriefEligible(
  result: SSSResult,
  threshold = 90,
  esiThreshold = 85,
  confidenceThreshold = 80,
  evidenceConfidence?: number
): { eligible: boolean; reason?: string; queue: "IMMEDIATE" | "WATCH" | "MONITOR" } {
  if (result.decisionLevel === "LEVEL_1") {
    return { eligible: false, reason: `LEVEL_1 Operational Observation — SSS ${result.sss} below auto-reject threshold. Store only.`, queue: "MONITOR" };
  }
  if (result.decisionLevel === "LEVEL_2") {
    return { eligible: false, reason: `LEVEL_2 Strategic Watch — SSS ${result.sss} below brief generation threshold. Continue monitoring.`, queue: "MONITOR" };
  }
  if (!result.qualityGatePassed) {
    return { eligible: false, reason: result.briefRejectionReason ?? "Brief Quality Gate failed — one or more quality criteria not met.", queue: "WATCH" };
  }
  if (result.sss < threshold) {
    return { eligible: false, reason: `SSS ${result.sss} is below the required threshold of ${threshold}. Add to WATCH queue.`, queue: "WATCH" };
  }
  if (result.esi < esiThreshold) {
    return { eligible: false, reason: `ESI ${result.esi} is below the required threshold of ${esiThreshold}. Executive Surprise Index insufficient for brief generation.`, queue: "WATCH" };
  }
  if (evidenceConfidence !== undefined && evidenceConfidence < confidenceThreshold) {
    return { eligible: false, reason: `Evidence Confidence ${evidenceConfidence} is below the required threshold of ${confidenceThreshold}. Gather more evidence before generating brief.`, queue: "WATCH" };
  }
  return { eligible: true, queue: "IMMEDIATE" };
}
