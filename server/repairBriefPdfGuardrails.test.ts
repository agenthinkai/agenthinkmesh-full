/**
 * repairBriefPdfGuardrails.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ADVERSARIAL GUARDRAIL PROOF — Repair Brief PDF structured terminalFlags
 *
 * Verifies that the Repair Brief PDF derives terminal blocker names ONLY from
 * the structured `terminalFlags` array — never from councilOutcome prose,
 * blockingIssues text, classificationRationale, or any other text field.
 *
 * Three tests (pure-function unit tests on terminalBlockersLine):
 *   PDF-1: exact match — [fraud, capital_controls] → "FRAUD · CAPITAL_CONTROLS"
 *   PDF-2: divergence guard — terminalFlags=["fraud"], prose mentions "sanctions"
 *          → only "FRAUD", NOT "SANCTIONS"
 *   PDF-3: empty flags structural guard → "Terminal Blockers: Not available."
 *
 * Three procedure tests (exportRepairBrief → generateRepairBriefPdf call capture):
 *   PDF-1 (proc): terminalFlags=[fraud, capital_controls] flows through to PDF generator
 *   PDF-2 (proc): prose mentions sanctions, terminalFlags=["fraud"] → generator gets only ["fraud"]
 *   PDF-3 (proc): empty terminalFlags → generator gets [] (no prose fallback)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies at module level (hoisted) ─────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./cfoDeepDivePdf", () => ({ generateCfoDeepDivePdf: vi.fn() }));
vi.mock("./icMemoPdf", () => ({ generateICMemoPdf: vi.fn() }));
vi.mock("./upgradeProtocolPdf", () => ({
  generateUpgradeProtocolPdf: vi.fn(),
  generateUpgradeProtocolText: vi.fn(),
}));
vi.mock("./stressTestReportPdf", () => ({
  generateStressTestReportPdf: vi.fn(),
  generateStressTestReportText: vi.fn(),
}));

// Mock repairBriefPdf at module level so the router uses the mock.
// We expose terminalBlockersLine as the REAL implementation for unit testing,
// and generateRepairBriefPdf as a spy that returns a fake buffer.
vi.mock("./repairBriefPdf", async (importOriginal) => {
  // Import the real module to get the real terminalBlockersLine implementation
  const real = await importOriginal<typeof import("./repairBriefPdf")>();
  return {
    // terminalBlockersLine: real implementation (pure function, no side effects)
    terminalBlockersLine: real.terminalBlockersLine,
    // generateRepairBriefPdf: spy that captures input and returns a fake buffer
    generateRepairBriefPdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf-content")),
  };
});

vi.mock("./icReportEngine", () => ({
  generateSingleDealICReport: vi.fn().mockResolvedValue(null),
  generateComparisonICReport: vi.fn().mockResolvedValue(null),
}));
vi.mock("./tier0Signals", () => ({
  detectTier0Signal: vi.fn().mockReturnValue(null),
  TIER0_FEED: [],
}));
vi.mock("./realityAlignmentEngine", () => ({
  runRealityAlignment: vi.fn().mockReturnValue({ shouldGate: false, flags: [] }),
}));
vi.mock("./councilEngine", () => ({ runCouncil: vi.fn() }));
vi.mock("./dealScreenerAdversarial", () => ({ runAdversarialCouncil: vi.fn() }));
vi.mock("./lib/llm/evalRouter", () => ({ routeEvalCall: vi.fn() }));

// Import AFTER mocks are registered
import { generateRepairBriefPdf, terminalBlockersLine } from "./repairBriefPdf";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/** Minimal valid exportRepairBrief input (non-terminalFlags fields) */
const BASE_BRIEF_INPUT = {
  dealName: "TestCo Ltd",
  councilMode: "global_vc",
  classification: "C" as const,
  // classificationRationale intentionally mentions "sanctions" in prose
  // to test that prose-only blockers are NOT passed to the PDF generator
  classificationRationale:
    "Council outcome: fraud allegation; capital controls prevent exit repatriation; sanctions exposure (mentioned in prose only).",
  rootCauses: [],
  revisedBrief: "",
  changeSummaryTable: [],
  predictedOutcome: {
    voteDistribution: "0 YES / 10 NO",
    consensusPct: 0,
    decision: "REJECTED",
    mostLikelyDissentingAgent: "Risk Officer",
    mostLikelyCondition: "None — terminal deal",
  },
  approvalSensitivityLadder: [],
  residualRisks: ["Terminal institutional blocker — no deal-level mitigation available."],
};

// ── UNIT TESTS: terminalBlockersLine (pure function, real implementation) ─────

describe("terminalBlockersLine — pure function unit tests (PDF-1, PDF-2, PDF-3)", () => {
  it("PDF-1: [fraud, capital_controls] → 'Terminal Blockers: FRAUD · CAPITAL_CONTROLS'", () => {
    const result = terminalBlockersLine(["fraud", "capital_controls"]);

    // Must contain both canonical labels
    expect(result).toContain("FRAUD");
    expect(result).toContain("CAPITAL CONTROLS");

    // Must use the · separator (U+00B7)
    expect(result).toContain("\u00B7");

    // Must start with the standard prefix
    expect(result).toMatch(/^Terminal Blockers:/);

    // Must NOT contain "Not available"
    expect(result).not.toContain("Not available");

    // Must NOT contain "SANCTIONS" (not in the flags array)
    expect(result).not.toContain("SANCTIONS");

    // Exact format check
    expect(result).toBe("Terminal Blockers: FRAUD \u00B7 CAPITAL CONTROLS");
  });

  it("PDF-2: divergence guard — terminalFlags=['fraud'], prose mentions 'sanctions' → only FRAUD, NOT SANCTIONS", () => {
    // terminalBlockersLine receives ONLY the structured array — it never sees prose.
    // The prose (classificationRationale) mentions "sanctions" but that is NOT passed here.
    const result = terminalBlockersLine(["fraud"]);

    // Must contain FRAUD
    expect(result).toContain("FRAUD");

    // CRITICAL: Must NOT contain SANCTIONS (prose-only blocker)
    expect(result).not.toContain("SANCTIONS");
    expect(result).not.toContain("sanctions");

    // Must NOT contain "Not available"
    expect(result).not.toContain("Not available");

    // Exact format check
    expect(result).toBe("Terminal Blockers: FRAUD");
  });

  it("PDF-3: empty terminalFlags → 'Terminal Blockers: Not available.' (no prose fallback)", () => {
    // Empty array
    const resultEmpty = terminalBlockersLine([]);
    expect(resultEmpty).toBe("Terminal Blockers: Not available.");

    // Undefined (missing field from old DB row)
    const resultUndefined = terminalBlockersLine(undefined);
    expect(resultUndefined).toBe("Terminal Blockers: Not available.");
  });
});

// ── PROCEDURE TESTS: exportRepairBrief passes terminalFlags to generateRepairBriefPdf ─

describe("exportRepairBrief — terminalFlags flows through to generateRepairBriefPdf (PDF-1, PDF-2, PDF-3)", () => {
  beforeEach(() => {
    // Reset the spy before each test so call history is clean
    vi.mocked(generateRepairBriefPdf).mockClear();
    vi.mocked(generateRepairBriefPdf).mockResolvedValue(Buffer.from("fake-pdf-content"));
  });

  it("PDF-1 (procedure): exportRepairBrief with [fraud, capital_controls] → generateRepairBriefPdf receives both flags", async () => {
    const caller = appRouter.createCaller(makeCtx());

    await caller.dealScreener.exportRepairBrief({
      ...BASE_BRIEF_INPUT,
      terminalFlags: ["fraud", "capital_controls"],
    });

    // generateRepairBriefPdf must have been called exactly once
    expect(vi.mocked(generateRepairBriefPdf)).toHaveBeenCalledTimes(1);

    // Capture the input passed to the PDF generator
    const capturedInput = vi.mocked(generateRepairBriefPdf).mock.calls[0][0];

    // The PDF generator must have received the structured terminalFlags
    expect(capturedInput.terminalFlags).toEqual(["fraud", "capital_controls"]);

    // Verify the blocker line would render correctly (using the real pure function)
    const blockersLine = terminalBlockersLine(capturedInput.terminalFlags);
    expect(blockersLine).toContain("FRAUD");
    expect(blockersLine).toContain("CAPITAL CONTROLS");
    expect(blockersLine).not.toContain("Not available");
  });

  it("PDF-2 (procedure): prose mentions 'sanctions' but terminalFlags=['fraud'] → generateRepairBriefPdf receives only ['fraud']", async () => {
    const caller = appRouter.createCaller(makeCtx());

    await caller.dealScreener.exportRepairBrief({
      ...BASE_BRIEF_INPUT,
      // classificationRationale mentions "sanctions" in prose — but terminalFlags does NOT
      classificationRationale:
        "Council outcome: fraud allegation; capital controls; sanctions exposure (mentioned in prose only).",
      terminalFlags: ["fraud"],  // ← structured: only fraud, no sanctions
    });

    expect(vi.mocked(generateRepairBriefPdf)).toHaveBeenCalledTimes(1);
    const capturedInput = vi.mocked(generateRepairBriefPdf).mock.calls[0][0];

    // Must contain fraud
    expect(capturedInput.terminalFlags).toContain("fraud");

    // CRITICAL: Must NOT contain sanctions (prose-only blocker)
    expect(capturedInput.terminalFlags).not.toContain("sanctions");
    expect(capturedInput.terminalFlags).toHaveLength(1);

    // Verify the blocker line would render correctly (no SANCTIONS)
    const blockersLine = terminalBlockersLine(capturedInput.terminalFlags);
    expect(blockersLine).toContain("FRAUD");
    expect(blockersLine).not.toContain("SANCTIONS");
  });

  it("PDF-3 (procedure): empty terminalFlags → generateRepairBriefPdf receives [] → 'Not available.'", async () => {
    const caller = appRouter.createCaller(makeCtx());

    await caller.dealScreener.exportRepairBrief({
      ...BASE_BRIEF_INPUT,
      terminalFlags: [],  // ← empty structured flags
    });

    expect(vi.mocked(generateRepairBriefPdf)).toHaveBeenCalledTimes(1);
    const capturedInput = vi.mocked(generateRepairBriefPdf).mock.calls[0][0];

    // Must be an empty array — no prose fallback, no inferred blockers
    expect(capturedInput.terminalFlags).toEqual([]);

    // The PDF generator (via terminalBlockersLine) renders "Not available."
    const blockersLine = terminalBlockersLine(capturedInput.terminalFlags);
    expect(blockersLine).toBe("Terminal Blockers: Not available.");
  });
});
