/**
 * CapTwin LP Twin — Validation Engine (WP7E + WP7J)
 *
 * Provides deterministic, transparent comparison metrics between synthetic
 * LP archetype outputs and human validator responses.
 *
 * IMPORTANT: These metrics measure AGREEMENT, not predictive accuracy.
 * Do not label outputs as "predictive accuracy" until validated evidence
 * thresholds are met and independently reviewed.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerdictType = "pass" | "conditional" | "reject";
export type NextStepType = "reject" | "more_information" | "meeting" | "diligence" | "ic_progression";

export type VerdictAgreement = "exact_agreement" | "partial_agreement" | "disagreement";

export interface SyntheticSnapshot {
  syntheticVerdict: VerdictType;
  objectionsJson: string;          // JSON string[]
  evidenceRequestedJson?: string | null;  // JSON string[]
  termsChallengedJson?: string | null;    // JSON string[]
  expectedNextStep?: NextStepType | null;
}

export interface HumanResponse {
  verdict: VerdictType;
  topObjectionsJson?: string | null;       // JSON string[]
  requiredEvidenceJson?: string | null;    // JSON string[]
  termsToChangeJson?: string | null;       // JSON string[]
  likelyNextStep?: NextStepType | null;
  calibrationEligible: boolean;
  consentVerified: boolean;
}

export interface ComparisonResult {
  verdictAgreement: VerdictAgreement;
  objectionRecall: number;        // 0–1: fraction of human objections predicted synthetically
  objectionPrecision: number;     // 0–1: fraction of synthetic objections raised by humans
  evidenceRequestAgreement: number; // 0–1: Jaccard similarity of evidence requests
  termSensitivityAgreement: number; // 0–1: Jaccard similarity of terms challenged
  nextStepAgreement: boolean;
  humanObjections: string[];
  syntheticObjections: string[];
  matchedObjections: string[];
  missedObjections: string[];      // human raised but synthetic missed
  unexpectedObjections: string[];  // synthetic raised but human didn't
  humanEvidence: string[];
  syntheticEvidence: string[];
  humanTerms: string[];
  syntheticTerms: string[];
  disclaimer: string;
}

export interface SegmentAggregation {
  segmentId: string;
  totalComparisons: number;
  verdictExactAgreement: number;
  verdictPartialAgreement: number;
  verdictDisagreement: number;
  avgObjRecall: number;
  avgObjPrecision: number;
  avgEvidenceAgreement: number;
  avgTermAgreement: number;
  nextStepAgreementRate: number;
  largestGaps: string[];
}

export type ValidationQualityLabel =
  | "Synthetic Only"
  | "Early Validation"
  | "Moderately Validated"
  | "Strongly Validated";

export interface ValidationQualityScore {
  segmentId: string;
  label: ValidationQualityLabel;
  score: number;                    // 0–100 composite
  verifiedResponseCount: number;
  independentParticipantCount: number;
  scenarioDiversity: number;        // distinct scenarios covered
  geographicDiversity: number;      // distinct geographies
  avgVerdictAgreement: number;
  avgObjRecall: number;
  avgObjPrecision: number;
  avgEvidenceAgreement: number;
  recencyScore: number;             // 0–1, decays with age
  dataQualityScore: number;         // 0–1, weighted by quality ratings
  thresholdsMet: {
    minimumResponses: boolean;
    minimumParticipants: boolean;
    minimumScenarios: boolean;
    minimumVerdictAgreement: boolean;
  };
  calibrationThresholdMet: boolean;
  disclaimer: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum evidence thresholds to reach each validation label */
export const VALIDATION_THRESHOLDS = {
  EARLY_VALIDATION_MIN_RESPONSES: 3,
  MODERATELY_VALIDATED_MIN_RESPONSES: 10,
  STRONGLY_VALIDATED_MIN_RESPONSES: 25,
  MODERATELY_VALIDATED_MIN_PARTICIPANTS: 5,
  STRONGLY_VALIDATED_MIN_PARTICIPANTS: 10,
  MODERATELY_VALIDATED_MIN_VERDICT_AGREEMENT: 0.6,
  STRONGLY_VALIDATED_MIN_VERDICT_AGREEMENT: 0.75,
  CALIBRATION_MIN_RESPONSES: 10,
  CALIBRATION_MIN_PARTICIPANTS: 5,
  CALIBRATION_MIN_VERDICT_AGREEMENT: 0.6,
} as const;

export const VALIDATION_ENGINE_VERSION = "1.0.0";

const DISCLAIMER =
  "AGREEMENT METRIC — These figures measure agreement between synthetic LP archetype " +
  "outputs and human validator responses. They do not constitute validated predictive " +
  "accuracy. Do not use these metrics to claim predictive performance until the minimum " +
  "evidence thresholds are met and independently reviewed.";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonArray(json?: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
}

/** Fuzzy match: two strings are considered matching if one contains the other after normalisation */
function fuzzyMatch(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function jaccardSimilarity(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 1;
  if (setA.length === 0 || setB.length === 0) return 0;
  let intersectionCount = 0;
  for (const a of setA) {
    if (setB.some((b) => fuzzyMatch(a, b))) intersectionCount++;
  }
  const unionCount = setA.length + setB.length - intersectionCount;
  return intersectionCount / unionCount;
}

function computeVerdictAgreement(
  syntheticVerdict: VerdictType,
  humanVerdict: VerdictType
): VerdictAgreement {
  if (syntheticVerdict === humanVerdict) return "exact_agreement";
  // Partial: adjacent verdicts (pass/conditional or conditional/reject)
  const adjacentPairs: Array<[VerdictType, VerdictType]> = [
    ["pass", "conditional"],
    ["conditional", "pass"],
    ["conditional", "reject"],
    ["reject", "conditional"],
  ];
  if (adjacentPairs.some(([a, b]) => a === syntheticVerdict && b === humanVerdict)) {
    return "partial_agreement";
  }
  return "disagreement";
}

// ── WP7E: Comparison Engine ───────────────────────────────────────────────────

/**
 * Compare a single synthetic snapshot against a single human response.
 * Both must be for the same scenario version.
 */
export function compareResponses(
  snapshot: SyntheticSnapshot,
  human: HumanResponse
): ComparisonResult {
  const syntheticObjections = parseJsonArray(snapshot.objectionsJson);
  const humanObjections = parseJsonArray(human.topObjectionsJson);
  const syntheticEvidence = parseJsonArray(snapshot.evidenceRequestedJson);
  const humanEvidence = parseJsonArray(human.requiredEvidenceJson);
  const syntheticTerms = parseJsonArray(snapshot.termsChallengedJson);
  const humanTerms = parseJsonArray(human.termsToChangeJson);

  const verdictAgreement = computeVerdictAgreement(snapshot.syntheticVerdict, human.verdict);

  // Objection recall: how many human objections did synthetic predict?
  const matchedObjections: string[] = [];
  const missedObjections: string[] = [];
  for (const ho of humanObjections) {
    if (syntheticObjections.some((so) => fuzzyMatch(ho, so))) {
      matchedObjections.push(ho);
    } else {
      missedObjections.push(ho);
    }
  }
  const objectionRecall =
    humanObjections.length === 0 ? 1 : matchedObjections.length / humanObjections.length;

  // Objection precision: how many synthetic objections were raised by humans?
  const unexpectedObjections: string[] = [];
  for (const so of syntheticObjections) {
    if (!humanObjections.some((ho) => fuzzyMatch(so, ho))) {
      unexpectedObjections.push(so);
    }
  }
  const objectionPrecision =
    syntheticObjections.length === 0
      ? 1
      : (syntheticObjections.length - unexpectedObjections.length) / syntheticObjections.length;

  const evidenceRequestAgreement = jaccardSimilarity(syntheticEvidence, humanEvidence);
  const termSensitivityAgreement = jaccardSimilarity(syntheticTerms, humanTerms);
  const nextStepAgreement = snapshot.expectedNextStep === human.likelyNextStep;

  return {
    verdictAgreement,
    objectionRecall,
    objectionPrecision,
    evidenceRequestAgreement,
    termSensitivityAgreement,
    nextStepAgreement,
    humanObjections,
    syntheticObjections,
    matchedObjections,
    missedObjections,
    unexpectedObjections,
    humanEvidence,
    syntheticEvidence,
    humanTerms,
    syntheticTerms,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Aggregate comparison results by allocator segment.
 */
export function aggregateBySegment(
  comparisons: Array<{ segmentId: string; result: ComparisonResult }>
): SegmentAggregation[] {
  const bySegment = new Map<string, ComparisonResult[]>();
  for (const { segmentId, result } of comparisons) {
    const existing = bySegment.get(segmentId) ?? [];
    existing.push(result);
    bySegment.set(segmentId, existing);
  }

  const aggregations: SegmentAggregation[] = [];
  for (const [segmentId, results] of Array.from(bySegment.entries())) {
    const n = results.length;
    const exactAgreement = results.filter((r) => r.verdictAgreement === "exact_agreement").length;
    const partialAgreement = results.filter((r) => r.verdictAgreement === "partial_agreement").length;
    const disagreement = results.filter((r) => r.verdictAgreement === "disagreement").length;
    const avgObjRecall = results.reduce((s, r) => s + r.objectionRecall, 0) / n;
    const avgObjPrecision = results.reduce((s, r) => s + r.objectionPrecision, 0) / n;
    const avgEvidenceAgreement = results.reduce((s, r) => s + r.evidenceRequestAgreement, 0) / n;
    const avgTermAgreement = results.reduce((s, r) => s + r.termSensitivityAgreement, 0) / n;
    const nextStepAgreementRate = results.filter((r) => r.nextStepAgreement).length / n;

    // Identify largest gaps (dimensions with lowest agreement)
    const gaps: Array<[string, number]> = [
      ["Verdict agreement", exactAgreement / n],
      ["Objection recall", avgObjRecall],
      ["Objection precision", avgObjPrecision],
      ["Evidence request agreement", avgEvidenceAgreement],
      ["Term sensitivity agreement", avgTermAgreement],
      ["Next-step agreement", nextStepAgreementRate],
    ];
    gaps.sort((a, b) => a[1] - b[1]);
    const largestGaps = gaps.slice(0, 3).map(([label, score]) => `${label}: ${(score * 100).toFixed(0)}%`);

    aggregations.push({
      segmentId,
      totalComparisons: n,
      verdictExactAgreement: exactAgreement,
      verdictPartialAgreement: partialAgreement,
      verdictDisagreement: disagreement,
      avgObjRecall,
      avgObjPrecision,
      avgEvidenceAgreement,
      avgTermAgreement,
      nextStepAgreementRate,
      largestGaps,
    });
  }
  return aggregations;
}

// ── WP7J: Validation Quality Score ────────────────────────────────────────────

export interface ValidationQualityInput {
  segmentId: string;
  verifiedResponseCount: number;
  independentParticipantCount: number;
  scenarioDiversity: number;
  geographicDiversity: number;
  avgVerdictAgreement: number;      // 0–1
  avgObjRecall: number;             // 0–1
  avgObjPrecision: number;          // 0–1
  avgEvidenceAgreement: number;     // 0–1
  newestResponseAgeMs: number;      // milliseconds since newest response
  dataQualityRatings: Array<"high" | "medium" | "low" | "unrated">;
}

const RECENCY_HALF_LIFE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function computeRecencyScore(ageMs: number): number {
  // Exponential decay: score = e^(-age / half_life)
  return Math.exp(-ageMs / RECENCY_HALF_LIFE_MS);
}

function computeDataQualityScore(ratings: Array<"high" | "medium" | "low" | "unrated">): number {
  if (ratings.length === 0) return 0;
  const weights = { high: 1.0, medium: 0.6, low: 0.3, unrated: 0.1 };
  const total = ratings.reduce((s, r) => s + weights[r], 0);
  return total / ratings.length;
}

/**
 * Compute a transparent validation quality score for a segment.
 * Weights are documented and deterministic.
 *
 * Score components (weights sum to 1):
 *   - Verdict agreement:        0.25
 *   - Objection recall:         0.20
 *   - Objection precision:      0.15
 *   - Evidence agreement:       0.10
 *   - Recency:                  0.15
 *   - Data quality:             0.10
 *   - Coverage (scenarios×geo): 0.05
 */
export function computeValidationQualityScore(
  input: ValidationQualityInput
): ValidationQualityScore {
  const {
    segmentId,
    verifiedResponseCount,
    independentParticipantCount,
    scenarioDiversity,
    geographicDiversity,
    avgVerdictAgreement,
    avgObjRecall,
    avgObjPrecision,
    avgEvidenceAgreement,
    newestResponseAgeMs,
    dataQualityRatings,
  } = input;

  const recencyScore = computeRecencyScore(newestResponseAgeMs);
  const dataQualityScore = computeDataQualityScore(dataQualityRatings);
  const coverageScore = Math.min(1, (scenarioDiversity / 3) * (geographicDiversity / 3));

  const compositeScore =
    avgVerdictAgreement * 0.25 +
    avgObjRecall * 0.20 +
    avgObjPrecision * 0.15 +
    avgEvidenceAgreement * 0.10 +
    recencyScore * 0.15 +
    dataQualityScore * 0.10 +
    coverageScore * 0.05;

  const score = Math.round(compositeScore * 100);

  const thresholdsMet = {
    minimumResponses: verifiedResponseCount >= VALIDATION_THRESHOLDS.EARLY_VALIDATION_MIN_RESPONSES,
    minimumParticipants: independentParticipantCount >= VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_PARTICIPANTS,
    minimumScenarios: scenarioDiversity >= 1,
    minimumVerdictAgreement: avgVerdictAgreement >= VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_VERDICT_AGREEMENT,
  };

  const calibrationThresholdMet =
    verifiedResponseCount >= VALIDATION_THRESHOLDS.CALIBRATION_MIN_RESPONSES &&
    independentParticipantCount >= VALIDATION_THRESHOLDS.CALIBRATION_MIN_PARTICIPANTS &&
    avgVerdictAgreement >= VALIDATION_THRESHOLDS.CALIBRATION_MIN_VERDICT_AGREEMENT;

  // Determine label
  let label: ValidationQualityLabel = "Synthetic Only";
  if (
    verifiedResponseCount >= VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_RESPONSES &&
    independentParticipantCount >= VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_PARTICIPANTS &&
    avgVerdictAgreement >= VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_VERDICT_AGREEMENT
  ) {
    label = "Strongly Validated";
  } else if (
    verifiedResponseCount >= VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_RESPONSES &&
    independentParticipantCount >= VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_PARTICIPANTS &&
    avgVerdictAgreement >= VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_VERDICT_AGREEMENT
  ) {
    label = "Moderately Validated";
  } else if (verifiedResponseCount >= VALIDATION_THRESHOLDS.EARLY_VALIDATION_MIN_RESPONSES) {
    label = "Early Validation";
  }

  return {
    segmentId,
    label,
    score,
    verifiedResponseCount,
    independentParticipantCount,
    scenarioDiversity,
    geographicDiversity,
    avgVerdictAgreement,
    avgObjRecall,
    avgObjPrecision,
    avgEvidenceAgreement,
    recencyScore,
    dataQualityScore,
    thresholdsMet,
    calibrationThresholdMet,
    disclaimer: DISCLAIMER,
  };
}

// ── WP7B: Standard Validation Scenarios ───────────────────────────────────────

/** Two initial standard validation scenarios as per the WP7 spec */
export const STANDARD_VALIDATION_SCENARIOS = [
  {
    scenarioCode: "VS-001",
    scenarioName: "Spin-Out Emerging Manager",
    strategy: "Growth Equity",
    geography: "North America",
    targetSizeM: 150,
    managementFeePct: 2.0,
    carryPct: 20,
    trackRecordYrs: 4,
    priorFundIRR: 18.5,
    shariaCompliant: false,
    esgPolicy: "ESG Integrated",
    description:
      "A spin-out team of 3 partners from a top-quartile growth equity firm raising their first independent fund. " +
      "Strong track record at prior firm but limited standalone brand recognition. " +
      "Target: $150M, 2% management fee, 20% carry, 8% hurdle.",
    expectedChallenges: [
      "First-time fund risk",
      "GP commitment level",
      "Team stability without institutional backing",
      "LP reference network",
    ],
    version: 1,
  },
  {
    scenarioCode: "VS-002",
    scenarioName: "Pivot Growth Fund",
    strategy: "Growth Equity",
    geography: "Europe",
    targetSizeM: 300,
    managementFeePct: 1.75,
    carryPct: 20,
    trackRecordYrs: 8,
    priorFundIRR: 14.2,
    shariaCompliant: false,
    esgPolicy: "Article 8",
    description:
      "An established mid-market buyout manager pivoting to growth equity for Fund IV. " +
      "Prior three funds were buyout-focused with solid but not top-quartile returns. " +
      "Strategy pivot raises questions about team capability in growth context. " +
      "Target: €300M, 1.75% management fee, 20% carry, no hurdle.",
    expectedChallenges: [
      "Strategy pivot credibility",
      "Team growth equity experience",
      "No hurdle rate",
      "Return profile vs. buyout LPs",
    ],
    version: 1,
  },
] as const;

export const VALIDATION_ENGINE_REGISTRY_VERSION = "1.0.0";
