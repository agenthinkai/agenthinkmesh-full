/**
 * tieredPipeline.test.ts
 * Unit tests for the 3-layer tiered Deal Screener pipeline:
 * - dealDedup: normaliseDealText, hashDealText
 * - triageEngine: runTriage output shape
 */

import { describe, it, expect } from "vitest";
import { normaliseDealText, hashDealText } from "./dealDedup";

describe("dealDedup — normaliseDealText", () => {
  it("lowercases input", () => {
    expect(normaliseDealText("HELLO WORLD")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normaliseDealText("  hello world  ")).toBe("hello world");
  });

  it("collapses multiple spaces to single space", () => {
    expect(normaliseDealText("hello   world")).toBe("hello world");
  });

  it("collapses newlines to single space", () => {
    expect(normaliseDealText("hello\n\nworld\n")).toBe("hello world");
  });

  it("handles mixed whitespace", () => {
    expect(normaliseDealText("  Hello\n\n  World  ")).toBe("hello world");
  });
});

describe("dealDedup — hashDealText", () => {
  it("returns a 64-character hex string", () => {
    const hash = hashDealText("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns same hash for identical input", () => {
    const h1 = hashDealText("hello world");
    const h2 = hashDealText("hello world");
    expect(h1).toBe(h2);
  });

  it("returns different hashes for different inputs", () => {
    const h1 = hashDealText("hello world");
    const h2 = hashDealText("goodbye world");
    expect(h1).not.toBe(h2);
  });

  it("normalised variants of the same deal produce the same hash", () => {
    const raw1 = normaliseDealText("  SaaS platform for GCC  ");
    const raw2 = normaliseDealText("saas platform for gcc");
    expect(hashDealText(raw1)).toBe(hashDealText(raw2));
  });
});

describe("triageEngine — runTriage output shape", () => {
  it("returns a valid TriageResult shape for a real deal memo", async () => {
    // Import dynamically to avoid top-level Anthropic SDK init in test env
    const { runTriage } = await import("./triageEngine");
    const dealText = `
      Company: TechFlow AI
      Sector: B2B SaaS, AI-powered workflow automation
      Stage: Series A, raising $5M
      Revenue: $800K ARR, 3x YoY growth
      Market: GCC enterprise market, $2B TAM
      Team: Ex-McKinsey founders, 15 years combined experience
      Ask: $5M for 18 months runway, product expansion into Saudi Arabia
    `.trim();

    const result = await runTriage(dealText);

    // Shape validation
    expect(result).toHaveProperty("decision");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("reason");
    expect(result).toHaveProperty("durationMs");

    // Decision must be one of the valid values
    expect(["PROCEED", "OBVIOUS_REJECT", "INSUFFICIENT_INPUT", "OUT_OF_SCOPE"]).toContain(result.decision);

    // Confidence must be between 0 and 1
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);

    // Duration must be positive
    expect(result.durationMs).toBeGreaterThan(0);

    // Reason must be a non-empty string
    expect(typeof result.reason).toBe("string");
    expect(result.reason.length).toBeGreaterThan(0);
  }, 30000); // 30s timeout for live LLM call
});
