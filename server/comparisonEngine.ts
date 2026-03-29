/**
 * comparisonEngine.ts — Deal Comparison Engine V2.1
 *
 * Orchestrates parallel Council-of-10 runs for 2–5 deals, then feeds
 * the structured results to a single Comparison Agent LLM call that
 * produces scores, rankings, and tradeoff analysis.
 *
 * RULES (from spec):
 *  - Uses existing runCouncil() — never reimplements it
 *  - Per-deal timeout: 10 seconds
 *  - Global timeout: 30 seconds
 *  - Failed deals are excluded from comparison (not a hard stop)
 *  - If >50% deals fail → throw "insufficient valid analyses"
 *  - REJECTED deals cannot be top priority
 *  - Unresolved major regulatory risk cannot rank #1
 *  - Tie-breaking: consensus% → confidence → risk_level (lower=better) → alphabetical
 */

import { runCouncil, CouncilResult, VerdictType } from "./councilEngine";
import { invokeLLM } from "./_core/llm";

// ── Public types ──────────────────────────────────────────────────────────────

export interface DealInput {
  name: string;
  summary: string;
  metrics?: Record<string, unknown>;
}

export interface DealDimensions {
  marketAttractiveness: number;   // 1–10
  regulatoryReadiness: number;    // 1–10
  financialQuality: number;       // 1–10
  executionFeasibility: number;   // 1–10
  strategicFit: number;           // 1–10
  riskLevel: number;              // 1–10 (higher = lower risk, i.e. safer)
}

export interface RankedDeal {
  dealName: string;
  overallRank: number;
  overallScore: number;
  recommendedPriority: "HIGH" | "MEDIUM" | "LOW";
  whyItRanksHere: string;
  dimensions: DealDimensions;
  finalDecision: VerdictType;
  consensusPercentage: number;
  confidenceLevel: string;
}

export interface ComparisonSummary {
  rankedDeals: RankedDeal[];
  bestOverall: string;
  lowestRisk: string;
  highestUpside: string;
  mostIcReady: string;
  keyTradeoffs: string[];
}

export interface DealAnalysisResult {
  dealName: string;
  status: "success" | "analysis_failed";
  failureReason: "timeout" | "error" | "invalid_input" | null;
  data: {
    finalDecision: VerdictType;
    consensusPercentage: number;
    confidenceLevel: string;
    keyAgreements: string[];
    keyDisagreements: string[];
    riskFlags: string[];
    thirtyDayChecklist: string[];
    marketContext: string[];
  } | null;
}

export interface ComparisonResult {
  comparisonId: string;
  dealAnalyses: DealAnalysisResult[];
  comparisonSummary: ComparisonSummary;
  timestamp: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PER_DEAL_TIMEOUT_MS = 10_000;
const GLOBAL_TIMEOUT_MS   = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a council result to a structured DealAnalysisResult.data block. */
function councilResultToAnalysis(result: CouncilResult): DealAnalysisResult["data"] {
  const consensusPct = Math.round(
    ((result.yesCount) / (result.yesCount + result.noCount || 1)) * 100
  );

  const confidenceLabel =
    result.confidenceScore >= 0.8 ? "HIGH" :
    result.confidenceScore >= 0.5 ? "MEDIUM" : "LOW";

  // Extract key agreements (conditions shared by multiple YES votes)
  const keyAgreements = result.conditionsToProceed.slice(0, 3);

  // Extract key disagreements (blocking issues from NO votes)
  const keyDisagreements = result.blockingIssues.slice(0, 3);

  // Risk flags = hard flags + critical blockers
  const riskFlagSet = Array.from(new Set([...result.hardFlags, ...result.criticalBlockers]));
  const riskFlags = riskFlagSet.slice(0, 5);

  // 30-day checklist from conditions
  const thirtyDayChecklist = result.conditionsToProceed.slice(0, 5);

  // Market context from votes rationale (top 2 YES votes)
  const marketContext = result.votes
    .filter(v => v.vote === "HARD_YES" || v.vote === "SOFT_YES")
    .slice(0, 2)
    .map(v => v.rationale.slice(0, 120));

  return {
    finalDecision: result.verdict,
    consensusPercentage: consensusPct,
    confidenceLevel: confidenceLabel,
    keyAgreements,
    keyDisagreements,
    riskFlags,
    thirtyDayChecklist,
    marketContext,
  };
}

/**
 * Risk normalization per spec:
 *  0–1 risk flags → Risk Level 8–10 (safe)
 *  2–3 risk flags → Risk Level 5–7
 *  4+  risk flags → Risk Level 1–4 (risky)
 */
function normalizeRiskLevel(riskFlagCount: number): number {
  if (riskFlagCount <= 1) return 9;
  if (riskFlagCount <= 3) return 6;
  return 3;
}

/**
 * Deterministic tie-breaking sort (spec section 6):
 * 1. Higher consensus_percentage
 * 2. Higher confidence_level (HIGH > MEDIUM > LOW)
 * 3. Lower risk_level (lower raw risk = safer = better)
 * 4. Alphabetical deal name (final fallback)
 */
function confidenceToNumber(level: string): number {
  if (level === "HIGH") return 3;
  if (level === "MEDIUM") return 2;
  return 1;
}

function tieBreakSort(a: RankedDeal, b: RankedDeal): number {
  if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
  if (b.consensusPercentage !== a.consensusPercentage) return b.consensusPercentage - a.consensusPercentage;
  const confDiff = confidenceToNumber(b.confidenceLevel) - confidenceToNumber(a.confidenceLevel);
  if (confDiff !== 0) return confDiff;
  // Lower risk_level number = riskier; we prefer higher riskLevel (safer)
  if (b.dimensions.riskLevel !== a.dimensions.riskLevel) return b.dimensions.riskLevel - a.dimensions.riskLevel;
  return a.dealName.localeCompare(b.dealName);
}

// ── Comparison Agent LLM call ─────────────────────────────────────────────────

interface ComparisonAgentInput {
  deals: Array<{
    name: string;
    finalDecision: VerdictType;
    consensusPercentage: number;
    confidenceLevel: string;
    keyAgreements: string[];
    keyDisagreements: string[];
    riskFlags: string[];
    marketContext: string[];
  }>;
}

interface ComparisonAgentOutput {
  ranked_deals: Array<{
    deal_name: string;
    overall_score: number;
    recommended_priority: "HIGH" | "MEDIUM" | "LOW";
    why_it_ranks_here: string;
    dimensions: {
      market_attractiveness: number;
      regulatory_readiness: number;
      financial_quality: number;
      execution_feasibility: number;
      strategic_fit: number;
      risk_level: number;
    };
  }>;
  best_overall: string;
  lowest_risk: string;
  highest_upside: string;
  most_ic_ready: string;
  key_tradeoffs: string[];
}

async function runComparisonAgent(input: ComparisonAgentInput): Promise<ComparisonAgentOutput> {
  const systemPrompt = `You are a senior Investment Committee analyst at a GCC sovereign wealth fund.
You receive structured analysis results from the Council of 10 for multiple deals and produce a comparative ranking.

SCORING RULES:
- Score each deal 1–10 on: Market Attractiveness, Regulatory Readiness, Financial Quality, Execution Feasibility, Strategic Fit, Risk Level
- Risk Level: 8–10 = low risk (0–1 flags), 5–7 = moderate (2–3 flags), 1–4 = high risk (4+ flags). Adjust ±1 for severity.
- overall_score = weighted average: Market(20%) + Regulatory(20%) + Financial(20%) + Execution(15%) + Strategic(15%) + Risk(10%)
- REJECTED deals cannot be recommended_priority = HIGH
- Deals with unresolved major regulatory risk cannot rank #1
- If scores are close, explain tradeoffs clearly — prefer explainability over forced certainty

OUTPUT: Return valid JSON only. No markdown. No explanation outside the JSON.`;

  const userMessage = `Compare these deals and return a JSON object matching the schema exactly:\n\n${JSON.stringify(input, null, 2)}

Return JSON with this exact structure:
{
  "ranked_deals": [
    {
      "deal_name": "...",
      "overall_score": 7.4,
      "recommended_priority": "HIGH",
      "why_it_ranks_here": "...",
      "dimensions": {
        "market_attractiveness": 8,
        "regulatory_readiness": 7,
        "financial_quality": 6,
        "execution_feasibility": 7,
        "strategic_fit": 8,
        "risk_level": 7
      }
    }
  ],
  "best_overall": "Deal Name",
  "lowest_risk": "Deal Name",
  "highest_upside": "Deal Name",
  "most_ic_ready": "Deal Name",
  "key_tradeoffs": ["...", "..."]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "comparison_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            ranked_deals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  deal_name: { type: "string" },
                  overall_score: { type: "number" },
                  recommended_priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
                  why_it_ranks_here: { type: "string" },
                  dimensions: {
                    type: "object",
                    properties: {
                      market_attractiveness: { type: "number" },
                      regulatory_readiness: { type: "number" },
                      financial_quality: { type: "number" },
                      execution_feasibility: { type: "number" },
                      strategic_fit: { type: "number" },
                      risk_level: { type: "number" },
                    },
                    required: ["market_attractiveness", "regulatory_readiness", "financial_quality", "execution_feasibility", "strategic_fit", "risk_level"],
                    additionalProperties: false,
                  },
                },
                required: ["deal_name", "overall_score", "recommended_priority", "why_it_ranks_here", "dimensions"],
                additionalProperties: false,
              },
            },
            best_overall: { type: "string" },
            lowest_risk: { type: "string" },
            highest_upside: { type: "string" },
            most_ic_ready: { type: "string" },
            key_tradeoffs: { type: "array", items: { type: "string" } },
          },
          required: ["ranked_deals", "best_overall", "lowest_risk", "highest_upside", "most_ic_ready", "key_tradeoffs"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("Comparison Agent returned empty response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  return JSON.parse(content) as ComparisonAgentOutput;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run a full deal comparison:
 * 1. Execute runCouncil() for each deal in parallel (per-deal 10s timeout)
 * 2. Collect results; mark failures
 * 3. If >50% fail → throw error
 * 4. Run single Comparison Agent LLM call on structured results
 * 5. Apply tie-breaking sort and return final ComparisonResult
 */
export async function runComparison(
  deals: DealInput[],
  options: { userId?: number; skipMemory?: boolean } = {}
): Promise<ComparisonResult> {
  if (deals.length < 2 || deals.length > 5) {
    throw new Error("Deal comparison requires between 2 and 5 deals.");
  }

  const comparisonId = crypto.randomUUID();
  const globalDeadline = Date.now() + GLOBAL_TIMEOUT_MS;

  // ── Step 1: Parallel council runs ─────────────────────────────────────────
  const councilPromises = deals.map(async (deal): Promise<DealAnalysisResult> => {
    const perDealDeadline = Math.min(Date.now() + PER_DEAL_TIMEOUT_MS, globalDeadline);
    const timeoutMs = perDealDeadline - Date.now();

    try {
      const councilPromise = runCouncil(deal.summary, {
        skipMemory: options.skipMemory ?? false,
        userId: options.userId,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      );

      const result = await Promise.race([councilPromise, timeoutPromise]);

      return {
        dealName: deal.name,
        status: "success",
        failureReason: null,
        data: councilResultToAnalysis(result),
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message === "timeout";
      return {
        dealName: deal.name,
        status: "analysis_failed",
        failureReason: isTimeout ? "timeout" : "error",
        data: null,
      };
    }
  });

  const dealAnalyses = await Promise.all(councilPromises);

  // ── Step 2: Failure threshold check ───────────────────────────────────────
  const successfulAnalyses = dealAnalyses.filter(d => d.status === "success" && d.data !== null);
  const failureRate = (dealAnalyses.length - successfulAnalyses.length) / dealAnalyses.length;

  if (failureRate > 0.5) {
    throw new Error(
      `insufficient valid analyses: ${successfulAnalyses.length}/${dealAnalyses.length} deals completed successfully`
    );
  }

  // ── Step 3: Build Comparison Agent input ──────────────────────────────────
  const agentInput: ComparisonAgentInput = {
    deals: successfulAnalyses.map(d => ({
      name: d.dealName,
      finalDecision: d.data!.finalDecision,
      consensusPercentage: d.data!.consensusPercentage,
      confidenceLevel: d.data!.confidenceLevel,
      keyAgreements: d.data!.keyAgreements,
      keyDisagreements: d.data!.keyDisagreements,
      riskFlags: d.data!.riskFlags,
      marketContext: d.data!.marketContext,
    })),
  };

  // ── Step 4: Comparison Agent LLM call ─────────────────────────────────────
  const agentOutput = await runComparisonAgent(agentInput);

  // ── Step 5: Build RankedDeal list with risk normalization ─────────────────
  const rankedDealsRaw: RankedDeal[] = agentOutput.ranked_deals.map((r) => {
    const analysis = successfulAnalyses.find(d => d.dealName === r.deal_name);
    const riskFlagCount = analysis?.data?.riskFlags.length ?? 0;
    const normalizedRisk = normalizeRiskLevel(riskFlagCount);

    // Comparison Agent may adjust ±1 based on severity
    const finalRiskLevel = Math.max(1, Math.min(10,
      r.dimensions.risk_level !== undefined
        ? Math.round((normalizedRisk + r.dimensions.risk_level) / 2)
        : normalizedRisk
    ));

    // Enforce: REJECTED deals cannot be HIGH priority
    let priority = r.recommended_priority;
    if (analysis?.data?.finalDecision === "REJECTED" && priority === "HIGH") {
      priority = "MEDIUM";
    }

    return {
      dealName: r.deal_name,
      overallRank: 0, // assigned after sort
      overallScore: Math.round(r.overall_score * 10) / 10,
      recommendedPriority: priority,
      whyItRanksHere: r.why_it_ranks_here,
      dimensions: {
        marketAttractiveness: r.dimensions.market_attractiveness,
        regulatoryReadiness: r.dimensions.regulatory_readiness,
        financialQuality: r.dimensions.financial_quality,
        executionFeasibility: r.dimensions.execution_feasibility,
        strategicFit: r.dimensions.strategic_fit,
        riskLevel: finalRiskLevel,
      },
      finalDecision: analysis?.data?.finalDecision ?? "REJECTED",
      consensusPercentage: analysis?.data?.consensusPercentage ?? 0,
      confidenceLevel: analysis?.data?.confidenceLevel ?? "LOW",
    };
  });

  // ── Step 6: Deterministic sort + rank assignment ───────────────────────────
  rankedDealsRaw.sort(tieBreakSort);

  // Enforce: unresolved major regulatory risk cannot rank #1
  // If rank-1 deal has regulatoryReadiness < 4, swap with rank-2
  if (rankedDealsRaw.length >= 2 && rankedDealsRaw[0].dimensions.regulatoryReadiness < 4) {
    [rankedDealsRaw[0], rankedDealsRaw[1]] = [rankedDealsRaw[1], rankedDealsRaw[0]];
  }

  const rankedDeals: RankedDeal[] = rankedDealsRaw.map((d, i) => ({
    ...d,
    overallRank: i + 1,
  }));

  // ── Step 7: Build comparison summary ──────────────────────────────────────
  const comparisonSummary: ComparisonSummary = {
    rankedDeals,
    bestOverall: agentOutput.best_overall,
    lowestRisk: agentOutput.lowest_risk,
    highestUpside: agentOutput.highest_upside,
    mostIcReady: agentOutput.most_ic_ready,
    keyTradeoffs: agentOutput.key_tradeoffs,
  };

  return {
    comparisonId,
    dealAnalyses,
    comparisonSummary,
    timestamp: new Date().toISOString(),
  };
}
