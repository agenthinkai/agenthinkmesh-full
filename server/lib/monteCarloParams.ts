/**
 * monteCarloParams.ts
 *
 * Extracts probabilistic parameter ranges for Monte Carlo simulation
 * from a pitch text using a single lightweight LLM call (Haiku).
 *
 * If any variable cannot be extracted, conservative defaults are used.
 */

import { invokeLLM } from "../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParamRange {
  min: number;
  max: number;
}

export interface DealParams {
  revenue_growth_rate: ParamRange;   // annual, 0–1 (e.g. 0.05 = 5%)
  gross_margin: ParamRange;          // 0–1
  market_size_usd: ParamRange;       // USD absolute (e.g. 1e9 = $1B)
  churn_rate: ParamRange;            // annual, 0–1
  time_to_profitability: ParamRange; // months
  pivot_probability: ParamRange;     // 0–1
}

// ── Conservative defaults ─────────────────────────────────────────────────────

export const DEFAULT_DEAL_PARAMS: DealParams = {
  revenue_growth_rate:   { min: 0.05, max: 0.30 },
  gross_margin:          { min: 0.20, max: 0.70 },
  market_size_usd:       { min: 1e8,  max: 1e10  },
  churn_rate:            { min: 0.02, max: 0.20  },
  time_to_profitability: { min: 12,   max: 60    },
  pivot_probability:     { min: 0.05, max: 0.40  },
};

// ── LLM extraction ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial analyst extracting quantitative parameter ranges from startup pitch text.
Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "revenue_growth_rate":   { "min": <number 0-1>, "max": <number 0-1> },
  "gross_margin":          { "min": <number 0-1>, "max": <number 0-1> },
  "market_size_usd":       { "min": <number>,     "max": <number>     },
  "churn_rate":            { "min": <number 0-1>, "max": <number 0-1> },
  "time_to_profitability": { "min": <number months>, "max": <number months> },
  "pivot_probability":     { "min": <number 0-1>, "max": <number 0-1> }
}
Rules:
- revenue_growth_rate: annual growth rate as decimal (0.20 = 20%). Use conservative range if not stated.
- gross_margin: gross margin as decimal. Use conservative range if not stated.
- market_size_usd: total addressable market in USD. Use 1e8 to 1e10 if not stated.
- churn_rate: annual customer churn as decimal. Use conservative range if not stated.
- time_to_profitability: months to profitability. Use 12-60 if not stated.
- pivot_probability: probability of major pivot as decimal. Use 0.05-0.40 if not stated.
- Always ensure min < max.
- Never return null or undefined values — always use the conservative defaults if uncertain.`;

function mergeWithDefaults(raw: Partial<DealParams>): DealParams {
  const merged: DealParams = { ...DEFAULT_DEAL_PARAMS };
  for (const key of Object.keys(DEFAULT_DEAL_PARAMS) as (keyof DealParams)[]) {
    const val = raw[key];
    if (
      val &&
      typeof val.min === "number" &&
      typeof val.max === "number" &&
      isFinite(val.min) &&
      isFinite(val.max) &&
      val.min < val.max
    ) {
      merged[key] = val;
    }
  }
  return merged;
}

/**
 * Extract deal parameter ranges from pitch text using a single Haiku LLM call.
 * Falls back to conservative defaults for any missing or invalid values.
 */
export async function extractDealParams(pitchText: string): Promise<DealParams> {
  try {
    const truncated = pitchText.slice(0, 3000); // keep it cheap
    const response = await invokeLLM({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract parameter ranges from this pitch:\n\n${truncated}`,
        },
      ],
      response_format: { type: "json_object" } as { type: "json_object" },
    });

    const content = response?.choices?.[0]?.message?.content ?? "";
    const raw = JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as Partial<DealParams>;
    return mergeWithDefaults(raw);
  } catch (err) {
    console.warn("[MonteCarloParams] extractDealParams failed, using defaults:", err);
    return { ...DEFAULT_DEAL_PARAMS };
  }
}
