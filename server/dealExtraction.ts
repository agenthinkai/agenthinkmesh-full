/**
 * dealExtraction.ts
 *
 * Strict LLM-based deal data extraction for Deal Data Room Ingestion V1.
 *
 * Rules (NON-NEGOTIABLE):
 *   - Only extract fields that are EXPLICITLY present in the source text.
 *   - If a field is absent or ambiguous, return null — never infer or guess.
 *   - For critical fields (revenue, funding ask), attach the exact source snippet
 *     and the file it came from.
 *   - Uses structured JSON output (json_schema response_format) to enforce the schema.
 *   - The model is explicitly instructed NOT to hallucinate founders, financials,
 *     or any other field.
 */

import { invokeLLM } from "./_core/llm";

// ── Output types ──────────────────────────────────────────────────────────────

/**
 * A field that carries both a value and a source snippet for auditability.
 * `value` is null if the field was not found in the documents.
 * `sourceSnippet` is the exact quote from the document (max ~200 chars).
 * `sourceFile` is the filename where the snippet was found.
 */
export interface SourcedField {
  value: string | null;
  sourceSnippet: string | null;
  sourceFile: string | null;
}

/**
 * Structured deal data extracted from uploaded documents.
 * Every field is nullable. The UI must treat null as "unknown".
 */
export interface ExtractedDealData {
  /** Legal or trading name of the company. */
  company_name: SourcedField;
  /** Industry or vertical (e.g., "FinTech", "SaaS", "Healthcare"). */
  sector: SourcedField;
  /** Country or region of primary operations. */
  geography: SourcedField;
  /** Funding stage (e.g., "Pre-Seed", "Series A", "Growth"). */
  stage: SourcedField;
  /** Annual revenue or ARR figure as stated in the documents. */
  revenue_arr: SourcedField;
  /** Key growth metrics (e.g., "3x YoY", "MoM growth 15%"). */
  growth_metrics: SourcedField;
  /** Amount being raised in this round. */
  funding_ask: SourcedField;
  /** Founder or key team member names and roles. */
  founder_team: SourcedField;
  /** Explicitly stated risks, regulatory notes, or red flags. */
  risks_regulatory: SourcedField;
  /** Extraction confidence: HIGH, MEDIUM, or LOW. */
  extraction_confidence: "HIGH" | "MEDIUM" | "LOW";
  /** Any notes the model has about data quality or ambiguity. */
  extraction_notes: string | null;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a strict data extraction engine for investment deal documents.

YOUR ONLY JOB: Extract specific fields from the provided text. Nothing else.

ABSOLUTE RULES — VIOLATION IS NOT ACCEPTABLE:
1. Only extract information that is EXPLICITLY and CLEARLY stated in the text.
2. If a field is not present, ambiguous, or unclear — set value to null.
3. NEVER infer, calculate, estimate, or guess any field.
4. NEVER hallucinate founder names, financial figures, or company details.
5. NEVER fill in a field based on industry norms or general knowledge.
6. For sourceSnippet: copy the EXACT text from the document (max 200 characters). Do not paraphrase.
7. For sourceFile: use the filename from the "=== SOURCE: filename ===" headers in the text.
8. If the same field appears in multiple sources, use the most specific/detailed one.

CONFIDENCE LEVELS:
- HIGH: Most fields extracted with clear source snippets.
- MEDIUM: Some fields missing or data quality is mixed.
- LOW: Fewer than 3 fields could be extracted, or document quality is poor.

OUTPUT: Return only the JSON object matching the required schema. No preamble, no explanation.`;

// ── JSON Schema for structured output ────────────────────────────────────────

const SOURCED_FIELD_SCHEMA = {
  type: "object",
  properties: {
    value: { type: ["string", "null"] },
    sourceSnippet: { type: ["string", "null"] },
    sourceFile: { type: ["string", "null"] },
  },
  required: ["value", "sourceSnippet", "sourceFile"],
  additionalProperties: false,
};

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    company_name:        SOURCED_FIELD_SCHEMA,
    sector:              SOURCED_FIELD_SCHEMA,
    geography:           SOURCED_FIELD_SCHEMA,
    stage:               SOURCED_FIELD_SCHEMA,
    revenue_arr:         SOURCED_FIELD_SCHEMA,
    growth_metrics:      SOURCED_FIELD_SCHEMA,
    funding_ask:         SOURCED_FIELD_SCHEMA,
    founder_team:        SOURCED_FIELD_SCHEMA,
    risks_regulatory:    SOURCED_FIELD_SCHEMA,
    extraction_confidence: {
      type: "string",
      enum: ["HIGH", "MEDIUM", "LOW"],
    },
    extraction_notes: { type: ["string", "null"] },
  },
  required: [
    "company_name",
    "sector",
    "geography",
    "stage",
    "revenue_arr",
    "growth_metrics",
    "funding_ask",
    "founder_team",
    "risks_regulatory",
    "extraction_confidence",
    "extraction_notes",
  ],
  additionalProperties: false,
};

// ── Main extraction function ──────────────────────────────────────────────────

/**
 * Extract structured deal data from combined document text.
 *
 * @param combinedText - The concatenated text from all uploaded files,
 *   with "=== SOURCE: filename ===" separators.
 * @returns Structured ExtractedDealData with null for any missing fields.
 */
export async function extractDealData(combinedText: string): Promise<ExtractedDealData> {
  const userPrompt = `Extract the deal fields from the following document text.
Remember: only extract what is explicitly present. Set value to null if not found.

--- DOCUMENT TEXT START ---
${combinedText}
--- DOCUMENT TEXT END ---`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "deal_extraction",
        strict: true,
        schema: EXTRACTION_JSON_SCHEMA,
      },
    },
    maxTokens: 2000,
  });

  const raw = response.choices[0]?.message?.content;
  if (typeof raw !== "string") {
    throw new Error("LLM returned no content for deal extraction");
  }

  let parsed: ExtractedDealData;
  try {
    parsed = JSON.parse(raw) as ExtractedDealData;
  } catch {
    throw new Error(`Failed to parse LLM extraction response: ${raw.slice(0, 200)}`);
  }

  return parsed;
}

// ── Utility: build dealText from extracted + reviewed data ───────────────────

/**
 * Converts the reviewed (possibly user-edited) ExtractedDealData into a
 * structured plain-text memo suitable for the existing Deal Screener `dealText` field.
 *
 * This is the bridge between the ingestion flow and the Council of 10.
 */
export function buildDealTextFromExtraction(
  data: ExtractedDealData,
  userOverrides: Partial<Record<keyof ExtractedDealData, string>>
): string {
  const get = (field: keyof ExtractedDealData): string => {
    // User override takes priority
    const override = userOverrides[field];
    if (override && override.trim()) return override.trim();
    // Then extracted value
    const extracted = data[field];
    if (
      extracted &&
      typeof extracted === "object" &&
      "value" in extracted &&
      extracted.value
    ) {
      return extracted.value;
    }
    return "Not provided";
  };

  const lines: string[] = [];

  const companyName = get("company_name");
  if (companyName !== "Not provided") lines.push(`COMPANY: ${companyName}`);

  const sector = get("sector");
  const geography = get("geography");
  const stage = get("stage");
  if (sector !== "Not provided" || geography !== "Not provided" || stage !== "Not provided") {
    lines.push(
      `MARKET:\nSector: ${sector}\nGeography: ${geography}\nStage: ${stage}`
    );
  }

  const revenue = get("revenue_arr");
  const growth = get("growth_metrics");
  if (revenue !== "Not provided" || growth !== "Not provided") {
    lines.push(`FINANCIALS:\nRevenue / ARR: ${revenue}\nGrowth: ${growth}`);
  }

  const ask = get("funding_ask");
  if (ask !== "Not provided") {
    lines.push(`FUNDING ASK: ${ask}`);
  }

  const team = get("founder_team");
  if (team !== "Not provided") {
    lines.push(`TEAM:\n${team}`);
  }

  const risks = get("risks_regulatory");
  if (risks !== "Not provided") {
    lines.push(`RISKS / REGULATORY:\n${risks}`);
  }

  if (lines.length === 0) {
    throw new Error(
      "Insufficient deal data: at least one field must be provided before running IC analysis."
    );
  }

  return lines.join("\n\n");
}
