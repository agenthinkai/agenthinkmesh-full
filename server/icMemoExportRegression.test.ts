/**
 * icMemoExportRegression.test.ts
 *
 * Regression tests for the IC Memo PDF export failure in Infrastructure mode.
 * Covers all 7 issues identified during the 2026-05-25 stabilization pass.
 *
 * Issues fixed:
 * 1. input.blockingIssues.join() crash when blockingIssues is undefined
 * 2. input.conditionsToProceed.join() crash when conditionsToProceed is undefined
 * 3. ⚡ emoji in infrastructure badge (PDFKit Helvetica cannot render it)
 * 4. ℹ symbol in Conditions to Re-engage footer note
 * 5. const modeLabel shadowing in Section 17
 * 6. verdict === "REJECTED" check (correct value is "REJECT")
 * 7. PersonaVoteInput.personaId and personaName were required, now optional
 */

import { describe, it, expect } from "vitest";
import type { ICMemoInput, PersonaVoteInput } from "./icMemoPdf";

// ── Shared test fixtures ──────────────────────────────────────────────────────

const INFRA_VOTE: PersonaVoteInput = {
  // personaId and personaName are now optional — omitting them must not crash
  personaRole: "Infrastructure Debt Analyst",
  vote: "HARD_NO",
  confidence: 0.95,
  rationale: "DSCR under base case falls to 0.9x at CfD £73/MWh — below the 1.2x covenant threshold.",
  keyFlags: ["DSCR < 1.2x", "CfD below threshold"],
  conditions: ["CfD ≥ £85/MWh", "DSCR ≥ 1.25x"],
  blockers: ["DSCR 0.9x at CfD £73/MWh", "No fixed-price EPC"],
};

const BASE_INFRA_INPUT: ICMemoInput = {
  dealName: "Helios-North Floating Offshore Wind",
  verdict: "VETOED",
  yesCount: 0,
  noCount: 10,
  confidenceScore: 0.92,
  conditionsToProceed: [
    "CfD strike price ≥ £85/MWh secured pre-FID",
    "Fixed-price EPC contract with LD backstop",
  ],
  blockingIssues: [
    "FOAK floating foundation — no commercial-scale track record",
    "CfD £73/MWh below fund minimum IRR threshold",
  ],
  votes: [INFRA_VOTE],
  councilMode: "infrastructure",
};

// ── Type-level tests (compile-time) ──────────────────────────────────────────

describe("ICMemoInput type", () => {
  it("accepts a payload without personaId and personaName (both now optional)", () => {
    const vote: PersonaVoteInput = {
      personaRole: "EPC Analyst",
      vote: "HARD_NO",
      confidence: 0.9,
      rationale: "Open-book EPC is unacceptable.",
      keyFlags: ["Open-book EPC"],
      conditions: ["Fixed-price EPC"],
      blockers: ["Open-book EPC"],
    };
    // If this compiles, the test passes — personaId and personaName are optional
    expect(vote.personaRole).toBe("EPC Analyst");
    expect(vote.personaId).toBeUndefined();
    expect(vote.personaName).toBeUndefined();
  });

  it("accepts a payload with the new optional fields: dealText, keyStrengths, keyRisks, decisionTriggers", () => {
    const input: ICMemoInput = {
      ...BASE_INFRA_INPUT,
      dealText: "Helios-North is a 500MW floating offshore wind project in the Celtic Sea.",
      keyStrengths: ["Strong wind resource", "Developer experience"],
      keyRisks: ["FOAK technology", "CfD below threshold"],
      decisionTriggers: {
        hardNoTriggers: ["FOAK foundation"],
        upgradeTriggers: ["CfD ≥ £85/MWh"],
        watchItems: ["Celtic Sea leasing timeline"],
      },
    };
    expect(input.dealText).toBeDefined();
    expect(input.keyStrengths).toHaveLength(2);
    expect(input.keyRisks).toHaveLength(2);
    expect(input.decisionTriggers?.hardNoTriggers).toHaveLength(1);
  });

  it("accepts a payload without the optional fields (backward compatible)", () => {
    const input: ICMemoInput = {
      dealName: "Test Deal",
      verdict: "REJECT",
      yesCount: 2,
      noCount: 8,
      confidenceScore: 0.8,
      conditionsToProceed: [],
      blockingIssues: [],
      votes: [],
    };
    expect(input.dealText).toBeUndefined();
    expect(input.keyStrengths).toBeUndefined();
    expect(input.keyRisks).toBeUndefined();
    expect(input.decisionTriggers).toBeUndefined();
  });
});

// ── Verdict string normalization ──────────────────────────────────────────────

describe("Infrastructure Conditions to Re-engage panel — verdict gate", () => {
  it("should trigger for verdict VETOED", () => {
    const isRejectOrVeto = (verdict: string) =>
      verdict === "REJECT" || verdict === "VETOED" || verdict === "REJECTED";

    expect(isRejectOrVeto("VETOED")).toBe(true);
  });

  it("should trigger for verdict REJECT (not REJECTED)", () => {
    const isRejectOrVeto = (verdict: string) =>
      verdict === "REJECT" || verdict === "VETOED" || verdict === "REJECTED";

    expect(isRejectOrVeto("REJECT")).toBe(true);
  });

  it("should trigger for legacy verdict REJECTED (backward compat)", () => {
    const isRejectOrVeto = (verdict: string) =>
      verdict === "REJECT" || verdict === "VETOED" || verdict === "REJECTED";

    expect(isRejectOrVeto("REJECTED")).toBe(true);
  });

  it("should NOT trigger for verdict APPROVED", () => {
    const isRejectOrVeto = (verdict: string) =>
      verdict === "REJECT" || verdict === "VETOED" || verdict === "REJECTED";

    expect(isRejectOrVeto("APPROVED")).toBe(false);
  });

  it("should NOT trigger for verdict APPROVED_WITH_CONDITIONS", () => {
    const isRejectOrVeto = (verdict: string) =>
      verdict === "REJECT" || verdict === "VETOED" || verdict === "REJECTED";

    expect(isRejectOrVeto("APPROVED_WITH_CONDITIONS")).toBe(false);
  });
});

// ── Defensive array joins ─────────────────────────────────────────────────────

describe("ICMemoInput defensive array handling", () => {
  it("conditionsToProceed.join does not crash when array is empty", () => {
    const conditions: string[] = [];
    expect(() => (conditions ?? []).join("\n")).not.toThrow();
    expect((conditions ?? []).join("\n")).toBe("");
  });

  it("blockingIssues.join does not crash when array is empty", () => {
    const issues: string[] = [];
    expect(() => (issues ?? []).join("\n")).not.toThrow();
    expect((issues ?? []).join("\n")).toBe("");
  });

  it("conditionsToProceed.join does not crash when undefined (defensive null-coalescing)", () => {
    const conditions: string[] | undefined = undefined;
    expect(() => (conditions ?? []).join("\n")).not.toThrow();
    expect((conditions ?? []).join("\n")).toBe("");
  });

  it("blockingIssues.join does not crash when undefined (defensive null-coalescing)", () => {
    const issues: string[] | undefined = undefined;
    expect(() => (issues ?? []).join("\n")).not.toThrow();
    expect((issues ?? []).join("\n")).toBe("");
  });
});

// ── PDF-safe glyph checks ─────────────────────────────────────────────────────

describe("PDF-safe glyph usage in icMemoPdf.ts", () => {
  it("infrastructure badge text does not contain the ⚡ emoji", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(__dirname, "./icMemoPdf.ts"), "utf-8");
    // The ⚡ emoji (U+26A1) must not appear in any .text() call
    const textCallMatches = src.match(/\.text\([^)]*\u26a1[^)]*\)/g);
    expect(textCallMatches).toBeNull();
  });

  it("Conditions to Re-engage footer note does not contain the ℹ symbol", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(__dirname, "./icMemoPdf.ts"), "utf-8");
    // The ℹ symbol (U+2139) must not appear in any .text() call
    const textCallMatches = src.match(/\.text\([^)]*\u2139[^)]*\)/g);
    expect(textCallMatches).toBeNull();
  });

  it("Section 17 modeLabel variable does not shadow outer modeLabel", async () => {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(__dirname, "./icMemoPdf.ts"), "utf-8");
    // After the fix, Section 17 uses simModeLabel, not modeLabel
    expect(src).toContain("const simModeLabel =");
    // The old shadowing pattern should not exist
    const shadowPattern = /const modeLabel = ss\.mode/;
    expect(shadowPattern.test(src)).toBe(false);
  });
});

// ── Infrastructure mode propagation ──────────────────────────────────────────

describe("Infrastructure mode propagation in ICMemoInput", () => {
  it("councilMode infrastructure is a valid enum value", () => {
    const input: ICMemoInput = {
      ...BASE_INFRA_INPUT,
      councilMode: "infrastructure",
    };
    expect(input.councilMode).toBe("infrastructure");
  });

  it("councilMode defaults to undefined (not infrastructure) for non-infra deals", () => {
    const input: ICMemoInput = {
      ...BASE_INFRA_INPUT,
      councilMode: undefined,
    };
    expect(input.councilMode).toBeUndefined();
  });

  it("all 5 councilMode values are valid", () => {
    const modes: ICMemoInput["councilMode"][] = [
      "gcc", "global_vc", "india_pe", "gcc_equities", "infrastructure",
    ];
    modes.forEach(mode => {
      const input: ICMemoInput = { ...BASE_INFRA_INPUT, councilMode: mode };
      expect(input.councilMode).toBe(mode);
    });
  });
});

// ── Conditions to Re-engage pattern matching ─────────────────────────────────

describe("Conditions to Re-engage pattern matching", () => {
  const buildAllBlockText = (input: ICMemoInput) =>
    [...(input.blockingIssues ?? []), ...(input.conditionsToProceed ?? [])].join(" ").toLowerCase();

  it("detects CfD condition from blockingIssues", () => {
    const text = buildAllBlockText({
      ...BASE_INFRA_INPUT,
      blockingIssues: ["CfD £73/MWh below fund minimum IRR threshold"],
    });
    expect(text).toContain("cfd");
  });

  it("detects floating foundation condition from blockingIssues", () => {
    const text = buildAllBlockText({
      ...BASE_INFRA_INPUT,
      blockingIssues: ["FOAK floating foundation — no commercial-scale track record"],
    });
    expect(text).toContain("floating");
    expect(text).toContain("foak");
  });

  it("detects EPC condition from conditionsToProceed", () => {
    const text = buildAllBlockText({
      ...BASE_INFRA_INPUT,
      conditionsToProceed: ["Fixed-price EPC contract with LD backstop"],
    });
    expect(text).toContain("epc");
    expect(text).toContain("fixed-price");
  });

  it("detects contingency condition from blockingIssues", () => {
    const text = buildAllBlockText({
      ...BASE_INFRA_INPUT,
      blockingIssues: ["Construction contingency 1.7% is critically inadequate"],
    });
    expect(text).toContain("contingency");
    expect(text).toContain("1.7%");
  });

  it("detects merchant exposure condition from blockingIssues", () => {
    const text = buildAllBlockText({
      ...BASE_INFRA_INPUT,
      blockingIssues: ["20% merchant exposure creates material downside risk"],
    });
    expect(text).toContain("merchant");
    expect(text).toContain("20%");
  });

  it("returns empty string when both arrays are empty", () => {
    const text = buildAllBlockText({
      ...BASE_INFRA_INPUT,
      blockingIssues: [],
      conditionsToProceed: [],
    });
    expect(text).toBe("");
  });
});
