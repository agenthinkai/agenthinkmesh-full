/**
 * realityAlignmentEngine.ts — Layer 2.5: Reality Alignment Engine
 *
 * Sits between Layer 2 (Council of Agents) and Layer 3 (IC Memo).
 *
 * Responsibilities:
 *   1. Data Integrity Check — validates key fields; sets dataConfidence
 *   2. Claim Grounding — tags each agent statement as source=input|inferred
 *   3. Conflict Detection — identifies contradictions across agents; outputs conflictScore
 *   4. Consensus Quality Score — composite score from agreement + data confidence + conflict
 *
 * Output feeds into:
 *   - Confidence gating (INSUFFICIENT_DATA verdict when quality is too low)
 *   - IC Memo "Decision Confidence & Limitations" section
 *   - Debug logging panel
 */

import type { CouncilResult, PersonaVote } from "./councilEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DataConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface GroundedClaim {
  statement: string;
  source: "input" | "inferred";
  confidence: number;
}

export interface AgentAlignment {
  personaId: string;
  personaName: string;
  vote: string;
  groundedClaims: GroundedClaim[];
  inferredRatio: number;  // 0–1, fraction of claims that are inferred
}

export interface RealityAlignmentResult {
  // Data integrity
  dataConfidence: DataConfidence;
  dataConfidenceScore: number;  // 0–1
  missingFields: string[];

  // Claim grounding
  agentAlignments: AgentAlignment[];
  globalInferredRatio: number;  // 0–1 across all agents

  // Conflict detection
  conflictScore: number;  // 0–1, higher = more conflict
  conflictDetails: string[];

  // Consensus quality
  agreementScore: number;       // 0–1
  consensusQuality: number;     // composite 0–1

  // Gate decision
  shouldGate: boolean;          // true when data is too weak to decide
  gateReason: string | null;

  // Debug
  debugLog: RealityAlignmentDebugLog;
}

export interface RealityAlignmentDebugLog {
  dataConfidence: DataConfidence;
  dataConfidenceScore: number;
  consensusQuality: number;
  conflictScore: number;
  inferredRatio: number;
  agreementScore: number;
  finalScore: number;           // weighted agent score * 0.6 + consensusQuality * 0.4
  verdict: string;
  missingFields: string[];
  conflictDetails: string[];
}

// ── Key field presence detection ──────────────────────────────────────────────

const KEY_FIELDS = [
  { label: "revenue",    patterns: [/revenue|arr|mrr|gmv|sales|turnover/i] },
  { label: "growth",     patterns: [/growth|yoy|mom|cagr|traction/i] },
  { label: "margins",    patterns: [/margin|ebitda|gross profit|net profit|profitab/i] },
  { label: "team",       patterns: [/founder|team|ceo|cto|management|leadership/i] },
  { label: "geography",  patterns: [/market|country|region|city|geography|india|gcc|uae|saudi|kuwait/i] },
  { label: "valuation",  patterns: [/valuation|pre-money|post-money|price|multiple|irr/i] },
];

function detectMissingFields(dealText: string): string[] {
  const missing: string[] = [];
  for (const field of KEY_FIELDS) {
    const found = field.patterns.some((p) => p.test(dealText));
    if (!found) missing.push(field.label);
  }
  return missing;
}

function computeDataConfidence(
  missingFields: string[],
  dealTextLength: number
): { confidence: DataConfidence; score: number } {
  const missingCount = missingFields.length;
  const hasMinLength = dealTextLength >= 200;

  // Very short input is always LOW
  if (!hasMinLength) return { confidence: "LOW", score: 0.2 };

  if (missingCount >= 4) return { confidence: "LOW",    score: 0.25 };
  if (missingCount >= 2) return { confidence: "MEDIUM", score: 0.55 };
  return                        { confidence: "HIGH",   score: 0.85 };
}

// ── Claim grounding ───────────────────────────────────────────────────────────

/**
 * Heuristically classify each sentence in a rationale as input-grounded or inferred.
 * "Input" = references numbers, names, or facts from the deal text.
 * "Inferred" = general reasoning, assumptions, or speculation.
 */
function groundClaims(rationale: string, dealText: string): GroundedClaim[] {
  if (!rationale || rationale.length < 10) return [];

  // Split into sentences
  const sentences = rationale
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  // Build a token set from the deal text (words 4+ chars)
  const dealTokens = new Set(
    dealText
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4)
  );

  return sentences.map((sentence) => {
    const sentenceTokens = sentence
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4);

    const overlapCount = sentenceTokens.filter((t) => dealTokens.has(t)).length;
    const overlapRatio = sentenceTokens.length > 0
      ? overlapCount / sentenceTokens.length
      : 0;

    // Heuristics for "inferred" language
    const inferredPhrases = [
      /\bassume\b|\bassuming\b|\blikely\b|\bprobably\b|\btypically\b|\bgenerally\b/i,
      /\bmay\b|\bmight\b|\bcould\b|\bwould\b|\bshould\b/i,
      /\bexpected\b|\banticipated\b|\bprojected\b|\bestimated\b/i,
      /\bif\b.*\bthen\b|\bwithout\b.*\bdata\b|\bno\b.*\binformation\b/i,
    ];
    const hasInferredLanguage = inferredPhrases.some((p) => p.test(sentence));

    const isInput = overlapRatio >= 0.25 && !hasInferredLanguage;

    return {
      statement: sentence,
      source: isInput ? "input" : "inferred",
      confidence: isInput ? 0.75 : 0.45,
    };
  });
}

function computeInferredRatio(claims: GroundedClaim[]): number {
  if (claims.length === 0) return 0.5;
  const inferred = claims.filter((c) => c.source === "inferred").length;
  return inferred / claims.length;
}

// ── Conflict detection ────────────────────────────────────────────────────────

/**
 * Detect contradictions between agents.
 * High conflict = agents with opposite votes AND high confidence.
 */
function detectConflicts(votes: PersonaVote[]): { score: number; details: string[] } {
  const details: string[] = [];
  if (votes.length === 0) return { score: 0, details: [] };

  const hardYes = votes.filter((v) => v.vote === "HARD_YES" && v.confidence >= 0.7);
  const hardNo  = votes.filter((v) => v.vote === "HARD_NO"  && v.confidence >= 0.7);

  // Direct contradiction: both HARD_YES and HARD_NO with high confidence
  if (hardYes.length > 0 && hardNo.length > 0) {
    for (const yes of hardYes) {
      for (const no of hardNo) {
        details.push(
          `${yes.personaName} (HARD_YES, ${Math.round(yes.confidence * 100)}%) vs ` +
          `${no.personaName} (HARD_NO, ${Math.round(no.confidence * 100)}%)`
        );
      }
    }
  }

  // Spread: variance in confidence scores across all agents
  const confidences = votes.map((v) => v.confidence);
  const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
  const stdDev = Math.sqrt(variance);

  // High std dev (> 0.25) indicates disagreement
  if (stdDev > 0.25) {
    details.push(`High confidence spread (σ=${stdDev.toFixed(2)}) — agents disagree on certainty`);
  }

  // Score: based on ratio of conflicting pairs + std dev
  const conflictPairs = hardYes.length * hardNo.length;
  const maxPairs = Math.max(1, votes.length * votes.length / 4);
  const pairScore = Math.min(1, conflictPairs / maxPairs);
  const devScore  = Math.min(1, stdDev / 0.4);

  const score = Math.round((pairScore * 0.6 + devScore * 0.4) * 100) / 100;

  return { score, details };
}

// ── Agreement score ───────────────────────────────────────────────────────────

function computeAgreementScore(votes: PersonaVote[]): number {
  const total = votes.length;
  if (total === 0) return 0;

  const yesCount = votes.filter((v) => v.vote === "HARD_YES" || v.vote === "SOFT_YES").length;
  const noCount  = votes.filter((v) => v.vote === "HARD_NO"  || v.vote === "SOFT_NO").length;

  // Agreement = how lopsided the vote is (0 = 50/50 split, 1 = unanimous)
  const majority = Math.max(yesCount, noCount);
  return Math.round((majority / total) * 100) / 100;
}

// ── Weighted agent score (for final score formula) ────────────────────────────

/**
 * Compute a weighted agent score using the fixed evaluation weights:
 *   Unit Economics: 25%
 *   Execution:      25%
 *   Market:         20%
 *   Deal Structure: 15%
 *   Regulatory:     10%
 *   Macro:           5%
 */
const DOMAIN_WEIGHTS: Record<string, number> = {
  // Unit Economics (25%)
  CFO:              0.25,
  IN_CFO:           0.25,
  VC_CFO:           0.25,

  // Execution (25%)
  ANALYST:          0.25,
  IN_ANALYST:       0.25,
  VC_ANALYST:       0.25,
  SKEPTIC:          0.15,  // Execution skeptic
  IN_SKEPTIC:       0.15,
  VC_SKEPTIC:       0.15,

  // Market (20%)
  MACRO:            0.20,
  IN_MACRO:         0.20,
  VC_MARKET:        0.20,
  IN_MARKET:        0.20,
  CONTRARIAN:       0.10,
  IN_CONTRARIAN:    0.10,
  VC_CONTRARIAN:    0.10,

  // Deal Structure (15%)
  EXIT:             0.15,
  IN_EXIT:          0.15,
  VC_EXIT:          0.15,
  DEVILS_ADVOCATE:  0.10,
  IN_DEVILS_ADVOCATE: 0.10,
  VC_DEVILS_ADVOCATE: 0.10,

  // Regulatory (10%)
  GCC_REG:          0.10,
  GCC_SHARIAH:      0.10,
  IN_LEGAL:         0.10,
  VC_LEGAL:         0.10,
  GEOPOLITICAL:     0.08,
  IN_ESG:           0.08,

  // Macro (5%)
  // (already covered above; fallback for unlisted agents)
};

const DEFAULT_DOMAIN_WEIGHT = 0.12;

function computeWeightedAgentScore(votes: PersonaVote[]): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const vote of votes) {
    const domainWeight = DOMAIN_WEIGHTS[vote.personaId] ?? DEFAULT_DOMAIN_WEIGHT;
    const voteScore =
      vote.vote === "HARD_YES" ? 1.0 :
      vote.vote === "SOFT_YES" ? 0.7 :
      vote.vote === "SOFT_NO"  ? 0.3 :
      0.0; // HARD_NO

    weightedScore += domainWeight * voteScore * vote.confidence;
    totalWeight   += domainWeight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedScore / totalWeight) * 1000) / 1000;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runRealityAlignment(
  dealText: string,
  councilResult: CouncilResult
): RealityAlignmentResult {
  const votes = councilResult.votes ?? [];

  // 1. Data integrity
  const missingFields = detectMissingFields(dealText);
  const { confidence: dataConfidence, score: dataConfidenceScore } =
    computeDataConfidence(missingFields, dealText.length);

  // 2. Claim grounding
  const agentAlignments: AgentAlignment[] = votes.map((vote) => {
    const claims = groundClaims(vote.rationale ?? "", dealText);
    const inferredRatio = computeInferredRatio(claims);
    return {
      personaId:     vote.personaId,
      personaName:   vote.personaName,
      vote:          vote.vote,
      groundedClaims: claims,
      inferredRatio,
    };
  });

  const globalInferredRatio =
    agentAlignments.length > 0
      ? agentAlignments.reduce((sum, a) => sum + a.inferredRatio, 0) / agentAlignments.length
      : 0.5;

  // 3. Conflict detection
  const { score: conflictScore, details: conflictDetails } = detectConflicts(votes);

  // 4. Agreement score
  // When votes are empty (e.g., in tests or dedup returns), fall back to councilResult.consensusQuality
  const agreementScore = votes.length > 0
    ? computeAgreementScore(votes)
    : (councilResult.consensusQuality ?? 0.5);

  // 5. Consensus quality
  //    consensusQuality = (agreementScore * 0.4) + (dataConfidenceScore * 0.3) + ((1 - conflictScore) * 0.3)
  const consensusQuality = Math.round(
    (agreementScore * 0.4 + dataConfidenceScore * 0.3 + (1 - conflictScore) * 0.3) * 1000
  ) / 1000;

  // 6. Weighted agent score
  const weightedAgentScore = computeWeightedAgentScore(votes);

  // 7. Final score (used by verdict engine)
  //    finalScore = (weightedAgentScore * 0.6) + (consensusQuality * 0.4)
  const finalScore = Math.round(
    (weightedAgentScore * 0.6 + consensusQuality * 0.4) * 1000
  ) / 1000;

  // 8. Confidence gating
  const shouldGate =
    dataConfidence === "LOW" || consensusQuality < 0.6;

  let gateReason: string | null = null;
  if (dataConfidence === "LOW") {
    gateReason = `Insufficient input data — missing: ${missingFields.join(", ")}. Cannot render a reliable verdict.`;
  } else if (consensusQuality < 0.6) {
    gateReason = `Consensus quality too low (${(consensusQuality * 100).toFixed(0)}%) — high agent disagreement or data gaps prevent a reliable decision.`;
  }

  // 9. Debug log
  const debugLog: RealityAlignmentDebugLog = {
    dataConfidence,
    dataConfidenceScore,
    consensusQuality,
    conflictScore,
    inferredRatio: Math.round(globalInferredRatio * 1000) / 1000,
    agreementScore,
    finalScore,
    verdict: councilResult.verdict,
    missingFields,
    conflictDetails,
  };

  return {
    dataConfidence,
    dataConfidenceScore,
    missingFields,
    agentAlignments,
    globalInferredRatio: Math.round(globalInferredRatio * 1000) / 1000,
    conflictScore,
    conflictDetails,
    agreementScore,
    consensusQuality,
    shouldGate,
    gateReason,
    debugLog,
  };
}
