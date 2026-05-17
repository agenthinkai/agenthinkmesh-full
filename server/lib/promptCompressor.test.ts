/**
 * promptCompressor.test.ts — P3 prompt/context compression tests
 *
 * Covers:
 *   1. trimMemoryContext — passthrough, truncation, header/footer preservation
 *   2. compressDealText — passthrough, whitespace collapse, boilerplate strip, truncation
 *   3. estimateTokens — basic token estimation
 *   4. No semantic loss on short inputs
 *   5. Edge cases — empty strings, null-like inputs
 */

import { describe, it, expect } from "vitest";
import {
  trimMemoryContext,
  compressDealText,
  estimateTokens,
  MEMORY_CONTEXT_MAX_CHARS,
  DEAL_TEXT_MAX_CHARS,
  TRUNCATION_MARKER,
} from "./promptCompressor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMORY_HEADER = "COUNCIL MEMORY — TOP SIMILAR PAST DECISIONS:";
const MEMORY_FOOTER = "Use these precedents to calibrate your analysis. Similar past verdicts are informative but not binding.";

function makeMemoryContext(entries: string[]): string {
  const lines = entries.map((e, i) => `[${i + 1}] ${e}`).join("\n");
  return `${MEMORY_HEADER}\n${lines}\n\n${MEMORY_FOOTER}`;
}

const SHORT_MEMORY = makeMemoryContext([
  "90.0% match [VC] — Verdict: APPROVED (confidence 0.85)\n    Task: \"Acme Corp Series A $5M...\"",
]);

const LONG_MEMORY = makeMemoryContext(
  Array.from({ length: 10 }, (_, i) =>
    `${90 - i}.0% match [VC] — Verdict: APPROVED (confidence 0.85)\n    Task: "Deal ${i} — ${("x").repeat(200)}..."`,
  ),
);

const SHORT_DEAL = "Acme Corp is raising a $5M Series A at a $20M pre-money valuation.";

const PADDED_DEAL = `


Acme Corp is raising a $5M Series A at a $20M pre-money valuation.


The team has 3 years of experience in the GCC market.


`;

const BOILERPLATE_DEAL = "Please evaluate the following deal memo: Acme Corp is raising $5M.";

const LONG_DEAL = "A".repeat(DEAL_TEXT_MAX_CHARS + 500);

// ── trimMemoryContext ─────────────────────────────────────────────────────────

describe("trimMemoryContext", () => {
  it("returns the original string when it fits within budget", () => {
    const result = trimMemoryContext(SHORT_MEMORY);
    expect(result).toBe(SHORT_MEMORY);
  });

  it("returns empty string for empty input", () => {
    expect(trimMemoryContext("")).toBe("");
  });

  it("trims long context to within budget", () => {
    const result = trimMemoryContext(LONG_MEMORY, MEMORY_CONTEXT_MAX_CHARS);
    expect(result.length).toBeLessThanOrEqual(MEMORY_CONTEXT_MAX_CHARS);
  });

  it("preserves the COUNCIL MEMORY header in trimmed output", () => {
    const result = trimMemoryContext(LONG_MEMORY, MEMORY_CONTEXT_MAX_CHARS);
    expect(result).toContain(MEMORY_HEADER);
  });

  it("preserves the footer in trimmed output", () => {
    const result = trimMemoryContext(LONG_MEMORY, MEMORY_CONTEXT_MAX_CHARS);
    expect(result).toContain(MEMORY_FOOTER);
  });

  it("keeps at least the first (highest-similarity) entry when trimming", () => {
    const result = trimMemoryContext(LONG_MEMORY, MEMORY_CONTEXT_MAX_CHARS);
    expect(result).toContain("[1]");
  });

  it("drops lower-similarity entries when budget is tight", () => {
    // With a very tight budget, only the header/footer should survive
    const result = trimMemoryContext(LONG_MEMORY, 300);
    // Should not contain [10] (lowest similarity entry)
    expect(result).not.toContain("[10]");
  });

  it("respects a custom maxChars parameter", () => {
    const result = trimMemoryContext(LONG_MEMORY, 500);
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it("handles unrecognized format with hard truncation", () => {
    const weird = "Some random context without the standard header.";
    const result = trimMemoryContext(weird, 20);
    expect(result.length).toBeLessThanOrEqual(20 + TRUNCATION_MARKER.length);
  });
});

// ── compressDealText ──────────────────────────────────────────────────────────

describe("compressDealText", () => {
  it("returns the original string when it fits and needs no compression", () => {
    const result = compressDealText(SHORT_DEAL);
    expect(result).toBe(SHORT_DEAL);
  });

  it("returns empty string for empty input", () => {
    expect(compressDealText("")).toBe("");
  });

  it("collapses multiple blank lines into a single blank line", () => {
    const result = compressDealText(PADDED_DEAL);
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("trims leading/trailing whitespace from lines", () => {
    const padded = "  Acme Corp   \n  Series A  ";
    const result = compressDealText(padded);
    expect(result).not.toMatch(/  $/m); // no trailing spaces
  });

  it("strips boilerplate preamble: 'Please evaluate the following deal memo:'", () => {
    const result = compressDealText(BOILERPLATE_DEAL);
    expect(result).not.toContain("Please evaluate the following deal memo:");
    expect(result).toContain("Acme Corp");
  });

  it("strips boilerplate preamble: 'Here is the deal memo to evaluate:'", () => {
    const text = "Here is the deal memo to evaluate: Acme Corp is raising $5M.";
    const result = compressDealText(text);
    expect(result).not.toContain("Here is the deal memo to evaluate:");
    expect(result).toContain("Acme Corp");
  });

  it("strips boilerplate preamble: 'Evaluate this deal memo:'", () => {
    const text = "Evaluate this deal memo: Acme Corp is raising $5M.";
    const result = compressDealText(text);
    expect(result).not.toContain("Evaluate this deal memo:");
    expect(result).toContain("Acme Corp");
  });

  it("hard-truncates at DEAL_TEXT_MAX_CHARS with TRUNCATION_MARKER", () => {
    const result = compressDealText(LONG_DEAL);
    expect(result).toContain(TRUNCATION_MARKER);
    expect(result.length).toBeLessThanOrEqual(DEAL_TEXT_MAX_CHARS + TRUNCATION_MARKER.length);
  });

  it("does not truncate text that fits within budget", () => {
    const result = compressDealText(SHORT_DEAL);
    expect(result).not.toContain(TRUNCATION_MARKER);
  });

  it("respects a custom maxChars parameter", () => {
    const result = compressDealText("A".repeat(200), 100);
    expect(result.length).toBeLessThanOrEqual(100 + TRUNCATION_MARKER.length);
    expect(result).toContain(TRUNCATION_MARKER);
  });

  it("preserves the substantive content of a short deal memo", () => {
    const result = compressDealText(SHORT_DEAL);
    expect(result).toContain("Acme Corp");
    expect(result).toContain("$5M");
    expect(result).toContain("$20M");
  });

  it("reduces character count for padded input", () => {
    const result = compressDealText(PADDED_DEAL);
    expect(result.length).toBeLessThan(PADDED_DEAL.length);
  });
});

// ── estimateTokens ────────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates ~1 token per 4 chars", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2); // ceil(5/4) = 2
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("rounds up (ceiling)", () => {
    expect(estimateTokens("abc")).toBe(1); // ceil(3/4) = 1
    expect(estimateTokens("abcde")).toBe(2); // ceil(5/4) = 2
  });
});

// ── Integration: compression reduces token budget ─────────────────────────────

describe("compression reduces token budget without semantic loss", () => {
  it("compressing a padded deal memo reduces estimated tokens", () => {
    const before = estimateTokens(PADDED_DEAL);
    const after  = estimateTokens(compressDealText(PADDED_DEAL));
    expect(after).toBeLessThan(before);
  });

  it("compressing a short deal memo does not change its content", () => {
    const before = SHORT_DEAL;
    const after  = compressDealText(SHORT_DEAL);
    expect(after).toBe(before);
  });

  it("trimming a short memory context does not change its content", () => {
    const before = SHORT_MEMORY;
    const after  = trimMemoryContext(SHORT_MEMORY);
    expect(after).toBe(before);
  });
});
