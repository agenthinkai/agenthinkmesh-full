/**
 * dealExtraction.test.ts
 *
 * Unit tests for the strict LLM deal extraction engine.
 * Tests cover:
 *   - extractDealData: correct schema parsing, null handling, error handling
 *   - buildDealTextFromExtraction: correct memo assembly, user override priority,
 *     empty field handling, and minimum-field enforcement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock invokeLLM ────────────────────────────────────────────────────────────

const mockInvokeLLM = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({
  invokeLLM: mockInvokeLLM,
}));

import { extractDealData, buildDealTextFromExtraction, type ExtractedDealData } from "./dealExtraction";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_EXTRACTION: ExtractedDealData = {
  company_name:        { value: "Tamara",         sourceSnippet: "Company: Tamara",         sourceFile: "pitch.pdf" },
  sector:              { value: "FinTech / BNPL",  sourceSnippet: "Sector: FinTech",         sourceFile: "pitch.pdf" },
  geography:           { value: "Saudi Arabia",    sourceSnippet: "HQ: Riyadh, KSA",         sourceFile: "pitch.pdf" },
  stage:               { value: "Series B",        sourceSnippet: "Series B round",          sourceFile: "pitch.pdf" },
  revenue_arr:         { value: "$120M ARR",       sourceSnippet: "ARR of $120M",            sourceFile: "financials.xlsx" },
  growth_metrics:      { value: "3x YoY",          sourceSnippet: "3x year-over-year",       sourceFile: "financials.xlsx" },
  funding_ask:         { value: "$100M",           sourceSnippet: "raising $100M",           sourceFile: "pitch.pdf" },
  founder_team:        { value: "Turki Al-Zahrani (CEO), Abdulmajeed Alsukhan (COO)", sourceSnippet: "Founded by Turki", sourceFile: "pitch.pdf" },
  risks_regulatory:    { value: "SAMA licensing pending", sourceSnippet: "SAMA approval",   sourceFile: "pitch.pdf" },
  extraction_confidence: "HIGH",
  extraction_notes:    null,
};

const PARTIAL_EXTRACTION: ExtractedDealData = {
  company_name:        { value: "AcmeCo",          sourceSnippet: "AcmeCo Ltd",              sourceFile: "memo.txt" },
  sector:              { value: null,               sourceSnippet: null,                      sourceFile: null },
  geography:           { value: null,               sourceSnippet: null,                      sourceFile: null },
  stage:               { value: null,               sourceSnippet: null,                      sourceFile: null },
  revenue_arr:         { value: null,               sourceSnippet: null,                      sourceFile: null },
  growth_metrics:      { value: null,               sourceSnippet: null,                      sourceFile: null },
  funding_ask:         { value: null,               sourceSnippet: null,                      sourceFile: null },
  founder_team:        { value: null,               sourceSnippet: null,                      sourceFile: null },
  risks_regulatory:    { value: null,               sourceSnippet: null,                      sourceFile: null },
  extraction_confidence: "LOW",
  extraction_notes:    "Only company name could be identified. Document may be a cover page only.",
};

function makeLLMResponse(data: ExtractedDealData) {
  return {
    choices: [{ message: { content: JSON.stringify(data) } }],
  };
}

// ── extractDealData tests ─────────────────────────────────────────────────────

describe("dealExtraction — extractDealData()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a fully populated ExtractedDealData when LLM returns all fields", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse(FULL_EXTRACTION));
    const result = await extractDealData("Some document text");
    expect(result.company_name.value).toBe("Tamara");
    expect(result.sector.value).toBe("FinTech / BNPL");
    expect(result.revenue_arr.value).toBe("$120M ARR");
    expect(result.extraction_confidence).toBe("HIGH");
  });

  it("returns null values for missing fields without throwing", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse(PARTIAL_EXTRACTION));
    const result = await extractDealData("Minimal document");
    expect(result.company_name.value).toBe("AcmeCo");
    expect(result.sector.value).toBeNull();
    expect(result.revenue_arr.value).toBeNull();
    expect(result.funding_ask.value).toBeNull();
    expect(result.extraction_confidence).toBe("LOW");
  });

  it("includes source snippets for extracted fields", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse(FULL_EXTRACTION));
    const result = await extractDealData("Some text");
    expect(result.revenue_arr.sourceSnippet).toBe("ARR of $120M");
    expect(result.revenue_arr.sourceFile).toBe("financials.xlsx");
  });

  it("passes the combined text to invokeLLM in the user message", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse(FULL_EXTRACTION));
    await extractDealData("DOCUMENT TEXT HERE");
    const call = mockInvokeLLM.mock.calls[0][0];
    const userMessage = call.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("DOCUMENT TEXT HERE");
  });

  it("uses json_schema response_format to enforce structured output", async () => {
    mockInvokeLLM.mockResolvedValueOnce(makeLLMResponse(FULL_EXTRACTION));
    await extractDealData("text");
    const call = mockInvokeLLM.mock.calls[0][0];
    expect(call.response_format?.type).toBe("json_schema");
    expect(call.response_format?.json_schema?.name).toBe("deal_extraction");
    expect(call.response_format?.json_schema?.strict).toBe(true);
  });

  it("throws a descriptive error if LLM returns no content", async () => {
    mockInvokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });
    await expect(extractDealData("text")).rejects.toThrow("LLM returned no content");
  });

  it("throws a descriptive error if LLM returns invalid JSON", async () => {
    mockInvokeLLM.mockResolvedValueOnce({ choices: [{ message: { content: "not json at all" } }] });
    await expect(extractDealData("text")).rejects.toThrow("Failed to parse LLM extraction response");
  });

  it("propagates LLM invocation errors", async () => {
    mockInvokeLLM.mockRejectedValueOnce(new Error("LLM timeout"));
    await expect(extractDealData("text")).rejects.toThrow("LLM timeout");
  });
});

// ── buildDealTextFromExtraction tests ─────────────────────────────────────────

describe("dealExtraction — buildDealTextFromExtraction()", () => {
  it("builds a structured memo from fully extracted data", () => {
    const text = buildDealTextFromExtraction(FULL_EXTRACTION, {});
    expect(text).toContain("COMPANY: Tamara");
    expect(text).toContain("Sector: FinTech / BNPL");
    expect(text).toContain("Geography: Saudi Arabia");
    // Revenue is nested under FINANCIALS section
    expect(text).toContain("Revenue / ARR: $120M ARR");
    expect(text).toContain("FUNDING ASK: $100M");
    expect(text).toContain("TEAM:");
    expect(text).toContain("RISKS / REGULATORY:");
  });

  it("user overrides take priority over extracted values", () => {
    const text = buildDealTextFromExtraction(FULL_EXTRACTION, {
      revenue_arr: "$200M ARR (updated)",
      funding_ask: "$150M",
    });
    // Revenue is nested under FINANCIALS section
    expect(text).toContain("Revenue / ARR: $200M ARR (updated)");
    expect(text).toContain("FUNDING ASK: $150M");
    // Original extracted values should NOT appear
    expect(text).not.toContain("$120M ARR");
    expect(text).not.toContain("$100M");
  });

  it("skips null fields without including 'Not provided' in the output", () => {
    const text = buildDealTextFromExtraction(PARTIAL_EXTRACTION, {});
    // Only company_name was extracted
    expect(text).toContain("COMPANY: AcmeCo");
    // Null fields should not appear
    expect(text).not.toContain("Not provided");
    expect(text).not.toContain("FUNDING ASK");
    expect(text).not.toContain("REVENUE");
  });

  it("uses user override for a field that was null in extraction", () => {
    const text = buildDealTextFromExtraction(PARTIAL_EXTRACTION, {
      sector: "B2B SaaS",
      geography: "Kuwait",
    });
    expect(text).toContain("Sector: B2B SaaS");
    expect(text).toContain("Geography: Kuwait");
  });

  it("throws an error if no fields have any value", () => {
    const emptyExtraction: ExtractedDealData = {
      company_name:        { value: null, sourceSnippet: null, sourceFile: null },
      sector:              { value: null, sourceSnippet: null, sourceFile: null },
      geography:           { value: null, sourceSnippet: null, sourceFile: null },
      stage:               { value: null, sourceSnippet: null, sourceFile: null },
      revenue_arr:         { value: null, sourceSnippet: null, sourceFile: null },
      growth_metrics:      { value: null, sourceSnippet: null, sourceFile: null },
      funding_ask:         { value: null, sourceSnippet: null, sourceFile: null },
      founder_team:        { value: null, sourceSnippet: null, sourceFile: null },
      risks_regulatory:    { value: null, sourceSnippet: null, sourceFile: null },
      extraction_confidence: "LOW",
      extraction_notes:    "Nothing found",
    };
    expect(() => buildDealTextFromExtraction(emptyExtraction, {})).toThrow(
      "Insufficient deal data"
    );
  });

  it("does not throw when only one field is provided", () => {
    const minimalExtraction: ExtractedDealData = {
      ...PARTIAL_EXTRACTION,
      company_name: { value: "OnlyCompany", sourceSnippet: null, sourceFile: null },
    };
    expect(() => buildDealTextFromExtraction(minimalExtraction, {})).not.toThrow();
    const text = buildDealTextFromExtraction(minimalExtraction, {});
    expect(text).toContain("COMPANY: OnlyCompany");
  });

  it("trims whitespace from user overrides", () => {
    const text = buildDealTextFromExtraction(PARTIAL_EXTRACTION, {
      sector: "  FinTech  ",
    });
    expect(text).toContain("Sector: FinTech");
    expect(text).not.toContain("  FinTech  ");
  });
});
