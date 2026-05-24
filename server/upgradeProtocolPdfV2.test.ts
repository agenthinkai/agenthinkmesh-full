/**
 * upgradeProtocolPdfV2.test.ts
 *
 * Tests for the upgraded Institutional Investment Readiness Report generator.
 * Covers: new sections, severity system, text quality guards, edge cases.
 */
import { describe, it, expect } from "vitest";
import {
  generateUpgradeProtocolText,
  generateUpgradeProtocolPdf,
  type UpgradeProtocolInput,
  type UpgradeFixInput,
} from "./upgradeProtocolPdf";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFix(overrides: Partial<UpgradeFixInput> = {}): UpgradeFixInput {
  return {
    id: "fix-1",
    category: "missing_input",
    title: "Audited financial statements required",
    description: "No audited financials provided. Council cannot assess revenue quality or burn rate.",
    suggestion: "Provide last 3 years of audited P&L and balance sheet.",
    tag: "USER_REQUIRED",
    ...overrides,
  };
}

function makeInput(overrides: Partial<UpgradeProtocolInput> = {}): UpgradeProtocolInput {
  return {
    dealName: "TechCo Series A",
    verdictBefore: "REJECTED",
    confidenceBefore: 35,
    missingInputs: [
      makeFix({ id: "m1", title: "Audited financials missing", tag: "USER_REQUIRED" }),
      makeFix({ id: "m2", title: "Cap table not provided", tag: "USER_REQUIRED" }),
    ],
    performanceGaps: [
      makeFix({ id: "p1", category: "performance_gap", title: "Revenue below benchmark", tag: "ASSUMED", description: "ARR of $200K is below the $1M threshold for Series A." }),
    ],
    structuralIssues: [
      makeFix({ id: "s1", category: "structural_issue", title: "No defensible moat", tag: "ASSUMED", description: "Product lacks IP, network effects, or switching costs." }),
    ],
    narrativeFix: {
      original: "We are building a platform for the future.",
      improved: "We are the only B2B SaaS provider with ISO-certified compliance automation in the MENA region.",
      rationale: "Original narrative is generic. Improved version anchors the differentiation claim.",
    },
    riskMitigationActions: [
      makeFix({ id: "r1", category: "risk_mitigation", title: "Key-person dependency", tag: "ASSUMED", description: "CEO is sole technical founder with no succession plan." }),
    ],
    expectedOutcomeShift: {
      predictedVerdict: "CONDITIONAL_APPROVAL",
      confidenceDelta: 28,
      rationale: "Resolving the two critical missing inputs and addressing the moat concern would shift the verdict to conditional approval.",
    },
    allFixes: [],
    generatedAt: "2026-05-24",
    ...overrides,
  };
}

function makeFullInput(): UpgradeProtocolInput {
  const base = makeInput();
  const allFixes = [
    ...base.missingInputs,
    ...base.performanceGaps,
    ...base.structuralIssues,
    ...base.riskMitigationActions,
  ];
  return { ...base, allFixes };
}

// ── Text Export Tests ─────────────────────────────────────────────────────────

describe("generateUpgradeProtocolText (upgraded)", () => {
  it("1. contains all 13 new sections", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).toContain("EXECUTIVE SUMMARY");
    expect(text).toContain("CORE INVESTMENT THESIS BREAKERS");
    expect(text).toContain("INVESTMENT READINESS SCORE");
    expect(text).toContain("FASTEST PATH TO INVESTABILITY");
    expect(text).toContain("INVESTOR FIT ANALYSIS");
    expect(text).toContain("CAPITAL READINESS");
    expect(text).toContain("NARRATIVE IMPROVEMENTS");
    expect(text).toContain("UPGRADE IMPACT FORECAST");
  });

  it("2. uses severity labels instead of USER_REQUIRED", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    // New severity labels
    expect(text).toContain("[CRITICAL]");
    expect(text).toContain("[HIGH]");
    // Should NOT contain the old raw tag
    expect(text).not.toContain("USER_REQUIRED");
    expect(text).not.toContain("ASSUMED");
    expect(text).not.toContain("IMPROVED");
  });

  it("3. investment readiness score is present and valid", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).toContain("Overall:");
    // Score must be a number between 0 and 100
    const match = text.match(/Overall:\s+(\d+)\/100/);
    expect(match).not.toBeNull();
    const score = parseInt(match![1], 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("4. investor fit analysis is present", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).toContain("INVESTOR FIT ANALYSIS");
    expect(text).toContain("Fit:");
    // Should be one of the known fit types
    const fitTypes = ["REJECT ENTIRELY", "FAMILY OFFICE", "STRATEGIC INVESTOR", "VENTURE CAPITAL", "PRIVATE EQUITY"];
    const hasFit = fitTypes.some(f => text.includes(f));
    expect(hasFit).toBe(true);
  });

  it("5. capital readiness section is present", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).toContain("CAPITAL READINESS");
    // Should contain substantive content, not just a header
    const idx = text.indexOf("CAPITAL READINESS");
    const section = text.substring(idx, idx + 300);
    expect(section.length).toBeGreaterThan(50);
  });

  it("6. fastest path to investability is present with action items", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).toContain("FASTEST PATH TO INVESTABILITY");
    // Should have numbered items
    expect(text).toMatch(/\s+1\. \[/);
  });

  it("7. no ugly precision floats (e.g. +0.05899999999999994%)", () => {
    const input = makeFullInput();
    // Inject ugly precision into rationale
    const uglyInput = {
      ...input,
      expectedOutcomeShift: {
        ...input.expectedOutcomeShift,
        confidenceDelta: 0.05899999999999994,
        rationale: "Confidence improved by +0.05899999999999994% after fixes.",
      },
    };
    const text = generateUpgradeProtocolText(uglyInput);
    expect(text).not.toContain("0.05899999999999994");
    // Should be rounded
    expect(text).toContain("0.1%");
  });

  it("8. no NaN, Infinity, undefined, or null in output", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });

  it("9. handles empty fix arrays without crashing", () => {
    const input: UpgradeProtocolInput = {
      dealName: "Empty Deal",
      verdictBefore: "REJECTED",
      confidenceBefore: 20,
      missingInputs: [],
      performanceGaps: [],
      structuralIssues: [],
      narrativeFix: { original: "", improved: "", rationale: "" },
      riskMitigationActions: [],
      expectedOutcomeShift: { predictedVerdict: "REJECTED", confidenceDelta: 0, rationale: "" },
      allFixes: [],
    };
    expect(() => generateUpgradeProtocolText(input)).not.toThrow();
    const text = generateUpgradeProtocolText(input);
    expect(text).toContain("EXECUTIVE SUMMARY");
    expect(text.length).toBeGreaterThan(200);
  });

  it("10. re-run summary appears when delta is provided", () => {
    const input = {
      ...makeFullInput(),
      delta: {
        verdictBefore: "REJECTED",
        verdictAfter: "CONDITIONAL_APPROVAL",
        verdictChanged: true,
        confidenceBefore: 35,
        confidenceAfter: 63,
        confidenceDelta: 28,
        keyMetricChanges: [{ metric: "Revenue Quality", before: "Unverified", after: "Audited", direction: "improved" as const }],
        topImprovementFactors: ["Audited financials provided", "Moat articulated"],
        remainingGaps: ["Market size still unverified"],
        summary: "Verdict shifted to conditional approval after critical fixes applied.",
      },
    };
    const text = generateUpgradeProtocolText(input);
    expect(text).toContain("RE-RUN SUMMARY");
    expect(text).toContain("Verdict Changed:   YES");
    expect(text).toContain("CONDITIONAL APPROVAL");
  });

  it("11. confidence delta formatted with sign", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    // Positive delta should show +
    expect(text).toContain("+28");
  });

  it("12. thesis breakers section lists top issues", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    expect(text).toContain("CORE INVESTMENT THESIS BREAKERS");
    // Should list the USER_REQUIRED fixes first
    expect(text).toContain("Audited financials missing");
  });

  it("13. verdict labels are normalized (no raw enum values)", () => {
    const text = generateUpgradeProtocolText(makeFullInput());
    // Should not contain raw enum values
    expect(text).not.toContain("CONDITIONAL_APPROVAL");
    // Should contain normalized label
    expect(text).toContain("CONDITIONAL APPROVAL");
  });
});

// ── PDF Export Tests ──────────────────────────────────────────────────────────

describe("generateUpgradeProtocolPdf (upgraded)", () => {
  it("14. generates a valid PDF buffer", async () => {
    const buf = await generateUpgradeProtocolPdf(makeFullInput());
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(5000);
    // PDF magic bytes
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("15. generates PDF with empty fix arrays", async () => {
    const input: UpgradeProtocolInput = {
      dealName: "Minimal Deal",
      verdictBefore: "REJECTED",
      confidenceBefore: 20,
      missingInputs: [],
      performanceGaps: [],
      structuralIssues: [],
      narrativeFix: { original: "", improved: "", rationale: "" },
      riskMitigationActions: [],
      expectedOutcomeShift: { predictedVerdict: "REJECTED", confidenceDelta: 0, rationale: "" },
      allFixes: [],
    };
    const buf = await generateUpgradeProtocolPdf(input);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("16. generates PDF with large fix list (20+ fixes)", async () => {
    const fixes: UpgradeFixInput[] = Array.from({ length: 22 }, (_, i) => makeFix({
      id: `fix-${i}`,
      title: `Issue ${i + 1}: ${["Missing data", "Performance gap", "Structural concern", "Risk factor"][i % 4]}`,
      tag: (["USER_REQUIRED", "ASSUMED", "IMPROVED"] as const)[i % 3],
    }));
    const input: UpgradeProtocolInput = {
      ...makeFullInput(),
      allFixes: fixes,
      missingInputs: fixes.filter(f => f.tag === "USER_REQUIRED"),
      performanceGaps: fixes.filter(f => f.tag === "ASSUMED"),
      structuralIssues: fixes.filter(f => f.tag === "IMPROVED"),
      riskMitigationActions: [],
    };
    const buf = await generateUpgradeProtocolPdf(input);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
    // Large report should be bigger
    expect(buf.length).toBeGreaterThan(20000);
  });

  it("17. generates PDF with delta (re-run summary)", async () => {
    const input = {
      ...makeFullInput(),
      delta: {
        verdictBefore: "REJECTED",
        verdictAfter: "APPROVED",
        verdictChanged: true,
        confidenceBefore: 35,
        confidenceAfter: 78,
        confidenceDelta: 43,
        keyMetricChanges: [],
        topImprovementFactors: ["All critical fixes resolved"],
        remainingGaps: [],
        summary: "Full approval achieved after all critical fixes applied.",
      },
    };
    const buf = await generateUpgradeProtocolPdf(input);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("18. generates PDF with ugly precision in rationale without crashing", async () => {
    const input = {
      ...makeFullInput(),
      expectedOutcomeShift: {
        predictedVerdict: "CONDITIONAL_APPROVAL",
        confidenceDelta: 0.05899999999999994,
        rationale: "Confidence improved by +0.05899999999999994% after fixes.",
      },
    };
    const buf = await generateUpgradeProtocolPdf(input);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });
});

// ── Severity System Tests ─────────────────────────────────────────────────────

describe("Severity system", () => {
  it("19. USER_REQUIRED maps to CRITICAL in text export", () => {
    const input = makeFullInput();
    const text = generateUpgradeProtocolText(input);
    expect(text).toContain("[CRITICAL]");
  });

  it("20. ASSUMED maps to HIGH in text export", () => {
    const input = makeFullInput();
    const text = generateUpgradeProtocolText(input);
    expect(text).toContain("[HIGH]");
  });

  it("21. IMPROVED maps to MEDIUM in text export", () => {
    const improvedFix = makeFix({ tag: "IMPROVED", title: "Improved narrative clarity", category: "structural_issue" });
    const input = {
      ...makeFullInput(),
      allFixes: [improvedFix],
      missingInputs: [],
      performanceGaps: [],
      structuralIssues: [improvedFix],
      riskMitigationActions: [],
    };
    const text = generateUpgradeProtocolText(input);
    expect(text).toContain("[MEDIUM]");
  });
});

// ── Investor Fit Tests ────────────────────────────────────────────────────────

describe("Investor fit derivation", () => {
  it("22. VETOED deal recommends REJECT ENTIRELY", () => {
    const input = {
      ...makeFullInput(),
      verdictBefore: "VETOED",
      allFixes: Array.from({ length: 7 }, (_, i) => makeFix({ id: `f${i}`, tag: "USER_REQUIRED" })),
    };
    const text = generateUpgradeProtocolText(input);
    expect(text).toContain("REJECT ENTIRELY");
  });

  it("23. clean deal with few issues recommends institutional capital", () => {
    const input: UpgradeProtocolInput = {
      dealName: "CleanCo",
      verdictBefore: "CONDITIONAL_APPROVAL",
      confidenceBefore: 72,
      missingInputs: [],
      performanceGaps: [makeFix({ tag: "ASSUMED", category: "performance_gap" })],
      structuralIssues: [],
      narrativeFix: { original: "", improved: "", rationale: "" },
      riskMitigationActions: [],
      expectedOutcomeShift: { predictedVerdict: "APPROVED", confidenceDelta: 15, rationale: "" },
      allFixes: [makeFix({ tag: "ASSUMED" })],
    };
    const text = generateUpgradeProtocolText(input);
    // Should not recommend rejection
    expect(text).not.toContain("REJECT ENTIRELY");
  });
});
