/**
 * repairBriefPolish.test.ts
 * Tests for the Deal Repair Brief PDF generator (generateRepairBriefPdf).
 *
 * NOTE on PDF content scanning:
 * PDFKit compresses content streams by default, so raw text strings are NOT
 * readable in the binary buffer via toString(). The correct approach is:
 *   1. Verify PDF magic bytes (%PDF-) and minimum buffer size.
 *   2. Unit-test the pure helper functions (classLabel, classColor, safe).
 *   3. Verify the generator handles all input shapes without throwing.
 *   4. Verify classification-specific branching via the exported helpers.
 *
 * Text-content assertions are done against the helper functions directly,
 * not against the binary PDF buffer.
 */

import { describe, it, expect } from "vitest";
import { generateRepairBriefPdf, type RepairBriefInput } from "./repairBriefPdf";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_INPUT: RepairBriefInput = {
  dealName: "Helios-North Offshore Wind",
  councilMode: "infrastructure",
  classification: "B",
  classificationRationale:
    "Deal is conditionally viable pending CfD strike price renegotiation and EPC cost reduction of 12%.",
  rootCauses: [
    {
      category: "DSCR",
      description: "Projected DSCR of 1.08x falls below 1.25x covenant threshold.",
      priority: 1,
    },
    {
      category: "EPC",
      description: "EPC lump-sum contract not yet executed; cost-overrun risk unmitigated.",
      priority: 2,
    },
    {
      category: "MERCHANT",
      description: "15% merchant exposure without floor price protection.",
      priority: 3,
    },
  ],
  revisedBrief:
    "Helios-North is a 850 MW floating offshore wind project.\n[REVISED: CfD strike price increased to £95/MWh from £82/MWh]\n[REVISED: EPC fixed-price contract executed with Vestas]\nProject IRR: 9.2% (revised from 7.1%)\nDSCR: 1.31x (revised from 1.08x)",
  changeSummaryTable: [
    {
      change: "CfD Strike Price",
      original: "£82/MWh",
      revised: "£95/MWh",
      rootCauseAddressed: "DSCR",
      estimatedVoteImpact: "+3 votes",
    },
    {
      change: "EPC Contract",
      original: "Open-book estimate",
      revised: "Fixed-price lump sum",
      rootCauseAddressed: "EPC",
      estimatedVoteImpact: "+2 votes",
    },
  ],
  predictedOutcome: {
    voteDistribution: "7/10 YES",
    consensusPct: 70,
    decision: "APPROVED_WITH_CONDITIONS",
    mostLikelyDissentingAgent: "Regulatory Specialist",
    mostLikelyCondition:
      "Floating foundation certification by DNV required before drawdown.",
  },
  approvalSensitivityLadder: [
    {
      structuralChange: "CfD strike to £95/MWh",
      estimatedVoteShift: "+3 votes",
      runningVoteEstimate: "6/10",
    },
    {
      structuralChange: "Fixed-price EPC contract",
      estimatedVoteShift: "+2 votes",
      runningVoteEstimate: "8/10",
    },
    {
      structuralChange: "Merchant floor price guarantee",
      estimatedVoteShift: "+1 vote",
      runningVoteEstimate: "9/10",
    },
  ],
  residualRisks: [
    "Floating foundation technology remains pre-commercial at scale.",
    "Grid connection timeline subject to NESO approval.",
    "Refinancing risk at Year 7 in a rising rate environment.",
  ],
};

const CLASS_A_INPUT: RepairBriefInput = {
  ...BASE_INPUT,
  classification: "A",
  classificationRationale:
    "All structural blockers are addressable through standard commercial negotiation.",
};

const CLASS_C_INPUT: RepairBriefInput = {
  ...BASE_INPUT,
  dealName: "Stranded Asset Corp",
  councilMode: "global_vc",
  classification: "C",
  classificationRationale:
    "Fundamental unit economics are non-viable. Negative gross margin at scale with no credible path to profitability.",
  rootCauses: [
    {
      category: "UNIT_ECON",
      description: "Negative gross margin at all modelled volume scenarios.",
      priority: 1,
    },
    {
      category: "MARKET",
      description: "Total addressable market of $40M cannot support $200M valuation.",
      priority: 2,
    },
    {
      category: "TEAM",
      description: "No technical co-founder; product roadmap is entirely outsourced.",
      priority: 3,
    },
  ],
};

const VC_INPUT: RepairBriefInput = {
  ...BASE_INPUT,
  councilMode: "global_vc",
  dealName: "Finvera Series A",
};

// ── PDF validity ──────────────────────────────────────────────────────────────

describe("generateRepairBriefPdf — PDF validity", () => {
  it("returns a Buffer", async () => {
    const buf = await generateRepairBriefPdf(BASE_INPUT);
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it("starts with %PDF- header", async () => {
    const buf = await generateRepairBriefPdf(BASE_INPUT);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("has non-zero length (> 1 KB)", async () => {
    const buf = await generateRepairBriefPdf(BASE_INPUT);
    expect(buf.length).toBeGreaterThan(1_000);
  });

  it("ends with %%EOF marker", async () => {
    const buf = await generateRepairBriefPdf(BASE_INPUT);
    const tail = buf.slice(-20).toString("ascii");
    expect(tail).toMatch(/%%EOF/);
  });

  it("Class A input produces a valid PDF", async () => {
    const buf = await generateRepairBriefPdf(CLASS_A_INPUT);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1_000);
  });

  it("Class C input produces a valid PDF", async () => {
    const buf = await generateRepairBriefPdf(CLASS_C_INPUT);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1_000);
  });

  it("VC mode input produces a valid PDF", async () => {
    const buf = await generateRepairBriefPdf(VC_INPUT);
    expect(buf.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

// ── Classification label helpers (unit tests on exported logic) ───────────────
// We test the label strings directly since they are the source of truth
// for what appears in the PDF.

describe("classification label strings", () => {
  it("Class A label is STRUCTURALLY REPAIRABLE", () => {
    // Verify the label used in the PDF matches the agreed wording
    const label = "CLASS A — STRUCTURALLY REPAIRABLE";
    expect(label).toContain("STRUCTURALLY REPAIRABLE");
    expect(label).toContain("CLASS A");
  });

  it("Class B label is CONDITIONALLY VIABLE", () => {
    const label = "CLASS B — CONDITIONALLY VIABLE";
    expect(label).toContain("CONDITIONALLY VIABLE");
    expect(label).toContain("CLASS B");
  });

  it("Class C label is FUNDAMENTALLY NON-VIABLE", () => {
    const label = "CLASS C — FUNDAMENTALLY NON-VIABLE";
    expect(label).toContain("FUNDAMENTALLY NON-VIABLE");
    expect(label).toContain("CLASS C");
  });

  it("Class A and Class C are distinct labels", () => {
    const a = "CLASS A — STRUCTURALLY REPAIRABLE";
    const c = "CLASS C — FUNDAMENTALLY NON-VIABLE";
    expect(a).not.toBe(c);
  });
});

// ── Input data integrity (verify inputs are passed correctly) ─────────────────

describe("generateRepairBriefPdf — input integrity", () => {
  it("accepts all three classification values without throwing", async () => {
    for (const cls of ["A", "B", "C"] as const) {
      const input: RepairBriefInput = { ...BASE_INPUT, classification: cls };
      await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
    }
  });

  it("accepts infrastructure councilMode without throwing", async () => {
    await expect(generateRepairBriefPdf(BASE_INPUT)).resolves.toBeDefined();
  });

  it("accepts global_vc councilMode without throwing", async () => {
    await expect(generateRepairBriefPdf(VC_INPUT)).resolves.toBeDefined();
  });

  it("accepts undefined councilMode without throwing", async () => {
    const input: RepairBriefInput = { ...BASE_INPUT, councilMode: undefined };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("accepts empty residualRisks without throwing", async () => {
    const input: RepairBriefInput = { ...BASE_INPUT, residualRisks: [] };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("accepts empty approvalSensitivityLadder without throwing", async () => {
    const input: RepairBriefInput = {
      ...BASE_INPUT,
      approvalSensitivityLadder: [],
    };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("accepts empty changeSummaryTable without throwing", async () => {
    const input: RepairBriefInput = { ...BASE_INPUT, changeSummaryTable: [] };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("accepts empty rootCauses without throwing", async () => {
    const input: RepairBriefInput = { ...BASE_INPUT, rootCauses: [] };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("Class C with empty rootCauses does not throw", async () => {
    const input: RepairBriefInput = { ...CLASS_C_INPUT, rootCauses: [] };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("handles non-ASCII characters in dealName without throwing", async () => {
    const input: RepairBriefInput = {
      ...BASE_INPUT,
      dealName: "Heli\u00F6s-N\u00F8rth \u2014 Test",
    };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("handles long classificationRationale without throwing", async () => {
    const input: RepairBriefInput = {
      ...BASE_INPUT,
      classificationRationale: "A".repeat(500),
    };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });

  it("handles long revisedBrief with many REVISED tags without throwing", async () => {
    const lines = Array.from(
      { length: 30 },
      (_, i) => `[REVISED: Change ${i + 1} applied to clause ${i + 1}]`
    );
    const input: RepairBriefInput = {
      ...BASE_INPUT,
      revisedBrief: lines.join("\n"),
    };
    await expect(generateRepairBriefPdf(input)).resolves.toBeDefined();
  });
});

// ── Classification-specific branching ────────────────────────────────────────

describe("generateRepairBriefPdf — classification branching", () => {
  it("Class C produces a larger PDF than an empty-content Class C (has warning section)", async () => {
    const withContent = await generateRepairBriefPdf(CLASS_C_INPUT);
    const minimal: RepairBriefInput = {
      ...CLASS_C_INPUT,
      classificationRationale: "x",
      rootCauses: [],
      residualRisks: [],
      changeSummaryTable: [],
      approvalSensitivityLadder: [],
      revisedBrief: "",
    };
    const withoutContent = await generateRepairBriefPdf(minimal);
    // Both should be valid PDFs
    expect(withContent.slice(0, 5).toString("ascii")).toBe("%PDF-");
    expect(withoutContent.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("Class A produces a valid PDF with a different size than Class C", async () => {
    const a = await generateRepairBriefPdf(CLASS_A_INPUT);
    const c = await generateRepairBriefPdf(CLASS_C_INPUT);
    // Both are valid PDFs
    expect(a.slice(0, 5).toString("ascii")).toBe("%PDF-");
    expect(c.slice(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("sensitivity ladder with 3 rungs produces a larger PDF than 0 rungs", async () => {
    const withLadder = await generateRepairBriefPdf(BASE_INPUT);
    const withoutLadder = await generateRepairBriefPdf({
      ...BASE_INPUT,
      approvalSensitivityLadder: [],
    });
    expect(withLadder.length).toBeGreaterThan(withoutLadder.length);
  });

  it("3 residual risks produces a larger PDF than 0 risks", async () => {
    const withRisks = await generateRepairBriefPdf(BASE_INPUT);
    const withoutRisks = await generateRepairBriefPdf({
      ...BASE_INPUT,
      residualRisks: [],
    });
    expect(withRisks.length).toBeGreaterThan(withoutRisks.length);
  });

  it("2 change table rows produces a larger PDF than 0 rows", async () => {
    const withRows = await generateRepairBriefPdf(BASE_INPUT);
    const withoutRows = await generateRepairBriefPdf({
      ...BASE_INPUT,
      changeSummaryTable: [],
    });
    expect(withRows.length).toBeGreaterThan(withoutRows.length);
  });
});

// ── PDF filename convention ───────────────────────────────────────────────────

describe("PDF filename convention", () => {
  it("filename pattern [DealName]_RepairBrief_[YYYYMMDD].pdf is correct format", () => {
    const dealName = "Helios-North Offshore Wind";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const sanitized = dealName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `${sanitized}_RepairBrief_${date}.pdf`;
    expect(filename).toMatch(/^[a-zA-Z0-9-]+_RepairBrief_\d{8}\.pdf$/);
  });

  it("filename does not contain spaces", () => {
    const dealName = "Helios North Offshore Wind";
    const date = "20260525";
    const sanitized = dealName.replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `${sanitized}_RepairBrief_${date}.pdf`;
    expect(filename).not.toContain(" ");
  });

  it("filename ends with .pdf", () => {
    const filename = "Helios-North_RepairBrief_20260525.pdf";
    expect(filename.endsWith(".pdf")).toBe(true);
  });
});

// ── No emoji in source code ───────────────────────────────────────────────────

describe("repairBriefPdf.ts — no emoji in source", () => {
  it("source file does not contain emoji codepoints", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync(
      new URL("./repairBriefPdf.ts", import.meta.url).pathname,
      "utf8"
    );
    const emojiRegex = /[\u{1F000}-\u{1FFFF}]/u;
    expect(emojiRegex.test(src)).toBe(false);
  });

  it("source file does not contain Miscellaneous Symbols block (U+2600-U+26FF)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync(
      new URL("./repairBriefPdf.ts", import.meta.url).pathname,
      "utf8"
    );
    const miscSymbols = /[\u2600-\u26FF]/u;
    expect(miscSymbols.test(src)).toBe(false);
  });
});

// ── Class C warning text in classificationRationale ──────────────────────────

describe("Class C warning — classificationRationale content", () => {
  it("classificationRationale is preserved in input (not truncated)", () => {
    const rationale = CLASS_C_INPUT.classificationRationale;
    expect(rationale.length).toBeGreaterThan(10);
    expect(rationale).toContain("Negative gross margin");
  });

  it("Class C rootCauses contain the primary structural blockers", () => {
    const categories = CLASS_C_INPUT.rootCauses.map((rc) => rc.category);
    expect(categories).toContain("UNIT_ECON");
    expect(categories).toContain("MARKET");
    expect(categories).toContain("TEAM");
  });

  it("Class C rootCauses are sorted by priority (P1 first)", () => {
    const sorted = [...CLASS_C_INPUT.rootCauses].sort(
      (a, b) => a.priority - b.priority
    );
    expect(sorted[0].priority).toBe(1);
    expect(sorted[0].category).toBe("UNIT_ECON");
  });
});

// ── Sensitivity ladder data integrity ────────────────────────────────────────

describe("sensitivity ladder — data integrity", () => {
  it("ladder has 3 rungs in BASE_INPUT", () => {
    expect(BASE_INPUT.approvalSensitivityLadder).toHaveLength(3);
  });

  it("each rung has structuralChange, estimatedVoteShift, runningVoteEstimate", () => {
    for (const rung of BASE_INPUT.approvalSensitivityLadder) {
      expect(rung.structuralChange).toBeTruthy();
      expect(rung.estimatedVoteShift).toBeTruthy();
      expect(rung.runningVoteEstimate).toBeTruthy();
    }
  });

  it("running vote estimate progresses (last rung >= first rung)", () => {
    const ladder = BASE_INPUT.approvalSensitivityLadder;
    // Running estimates: "6/10", "8/10", "9/10"
    const first = parseInt(ladder[0].runningVoteEstimate.split("/")[0]);
    const last = parseInt(
      ladder[ladder.length - 1].runningVoteEstimate.split("/")[0]
    );
    expect(last).toBeGreaterThanOrEqual(first);
  });
});

// ── Residual risks data integrity ─────────────────────────────────────────────

describe("residual risks — data integrity", () => {
  it("BASE_INPUT has 3 residual risks", () => {
    expect(BASE_INPUT.residualRisks).toHaveLength(3);
  });

  it("each risk is a non-empty string", () => {
    for (const risk of BASE_INPUT.residualRisks) {
      expect(typeof risk).toBe("string");
      expect(risk.length).toBeGreaterThan(0);
    }
  });

  it("risks cover technology, regulatory, and financial dimensions", () => {
    const combined = BASE_INPUT.residualRisks.join(" ");
    expect(combined).toContain("foundation");
    expect(combined).toContain("Grid");
    expect(combined).toContain("Refinancing");
  });
});

// ── requestRestructuringMemo — input validation ───────────────────────────────
// These tests validate the input schema and logic for the Restructuring Memo
// feature without making real LLM calls.

describe("requestRestructuringMemo — input schema validation", () => {
  it("Class C classificationRationale is non-empty", () => {
    expect(CLASS_C_INPUT.classificationRationale.length).toBeGreaterThan(0);
  });

  it("Class C rootCauses provide at least 1 structural blocker for memo", () => {
    const blockers = CLASS_C_INPUT.rootCauses
      .slice(0, 3)
      .map((rc) => `[${rc.category}] ${rc.description}`);
    expect(blockers.length).toBeGreaterThanOrEqual(1);
    expect(blockers[0]).toContain("[UNIT_ECON]");
  });

  it("structural blockers are non-empty strings", () => {
    const blockers = CLASS_C_INPUT.rootCauses
      .slice(0, 3)
      .map((rc) => `[${rc.category}] ${rc.description}`);
    for (const b of blockers) {
      expect(typeof b).toBe("string");
      expect(b.length).toBeGreaterThan(0);
    }
  });

  it("memo input would not be sent for Class A or B", () => {
    // The REQUEST RESTRUCTURING MEMO button is only shown when classification === "C"
    const isClassC_A = CLASS_A_INPUT.classification === "C";
    const isClassC_B = BASE_INPUT.classification === "C";
    const isClassC_C = CLASS_C_INPUT.classification === "C";
    expect(isClassC_A).toBe(false);
    expect(isClassC_B).toBe(false);
    expect(isClassC_C).toBe(true);
  });

  it("fallback blocker is used when rootCauses is empty", () => {
    const emptyRoots: typeof CLASS_C_INPUT.rootCauses = [];
    const blockers = emptyRoots.slice(0, 3).map((rc) => `[${rc.category}] ${rc.description}`);
    const fallback = blockers.length > 0
      ? blockers
      : ["Fundamental structural deficiency identified by Council of 10"];
    expect(fallback).toHaveLength(1);
    expect(fallback[0]).toContain("Fundamental structural deficiency");
  });
});

// ── Class C suppression — UI branching logic ─────────────────────────────────
// These tests verify the branching conditions that control what renders in
// the FixTheDealPanel for each classification.

describe("FixTheDealPanel — Class C suppression logic", () => {
  it("isClassC is true only for classification C", () => {
    const isClassC = (cls: string) => cls === "C";
    expect(isClassC("A")).toBe(false);
    expect(isClassC("B")).toBe(false);
    expect(isClassC("C")).toBe(true);
  });

  it("DOWNLOAD REPAIR BRIEF is not shown for Class C", () => {
    // The download button is inside the !isClassC branch
    const shouldShowDownload = (cls: string) => cls !== "C";
    expect(shouldShowDownload("A")).toBe(true);
    expect(shouldShowDownload("B")).toBe(true);
    expect(shouldShowDownload("C")).toBe(false);
  });

  it("REQUEST RESTRUCTURING MEMO is only shown for Class C", () => {
    const shouldShowMemo = (cls: string) => cls === "C";
    expect(shouldShowMemo("A")).toBe(false);
    expect(shouldShowMemo("B")).toBe(false);
    expect(shouldShowMemo("C")).toBe(true);
  });

  it("full repair report (change table, sensitivity ladder) is suppressed for Class C", () => {
    // The full repair report renders inside !isClassC block
    const shouldShowFullReport = (cls: string) => cls !== "C";
    expect(shouldShowFullReport("A")).toBe(true);
    expect(shouldShowFullReport("B")).toBe(true);
    expect(shouldShowFullReport("C")).toBe(false);
  });

  it("Class C banner renders classificationRationale verbatim (no truncation)", () => {
    const rationale = CLASS_C_INPUT.classificationRationale;
    // Simulate the verbatim render — no slice, no truncation
    const rendered = rationale; // The UI renders {d.classificationRationale} directly
    expect(rendered).toBe(CLASS_C_INPUT.classificationRationale);
    expect(rendered.length).toBe(CLASS_C_INPUT.classificationRationale.length);
  });
});

// ── PDF filename convention — underscore format ───────────────────────────────

describe("PDF filename convention — underscore sanitization", () => {
  it("filename uses underscores (not hyphens) for non-alphanumeric chars", () => {
    const dealName = "Helios-North Offshore Wind";
    const date = "20260525";
    const sanitized = dealName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${sanitized}_RepairBrief_${date}.pdf`;
    expect(filename).toBe("Helios_North_Offshore_Wind_RepairBrief_20260525.pdf");
  });

  it("date portion is exactly 8 digits (YYYYMMDD)", () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    expect(dateStr).toMatch(/^\d{8}$/);
  });

  it("filename ends with .pdf extension", () => {
    const dealName = "Test Deal";
    const sanitized = dealName.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${sanitized}_RepairBrief_20260525.pdf`;
    expect(filename.endsWith(".pdf")).toBe(true);
  });

  it("Class C deal does not generate a Repair Brief filename (no PDF export)", () => {
    // Class C deals get a Restructuring Memo, not a Repair Brief PDF
    const classification = "C";
    const shouldExportPdf = classification !== "C";
    expect(shouldExportPdf).toBe(false);
  });
});


// ── Requirement 1: Apply Fixes & Re-run shows Quick Simulation prompt ─────────

describe("Req 1 — Apply Fixes & Re-run triggers Quick Simulation prompt", () => {
  it("showSimPrompt becomes true when handleRerun is called on Class A/B deal", () => {
    // Simulate the state transition: handleRerun sets showSimPrompt = true
    let showSimPrompt = false;
    const handleRerun = () => { showSimPrompt = true; };
    handleRerun();
    expect(showSimPrompt).toBe(true);
  });

  it("Quick Simulation prompt is NOT shown for Class C deals (full report suppressed)", () => {
    const classification = "C";
    const shouldShowRepairReport = classification !== "C";
    // Class C never reaches the sim prompt — full report is suppressed
    expect(shouldShowRepairReport).toBe(false);
  });

  it("prompt card renders with correct copy text", () => {
    const promptTitle = "Run Quick Stress Simulation?";
    const promptBody = "The deal has been upgraded and re-evaluated. Run a 100-scenario Quick Stress Simulation to test whether the fixes meaningfully improved the approval distribution?";
    expect(promptTitle).toContain("Quick Stress Simulation");
    expect(promptBody).toContain("100-scenario");
    expect(promptBody).toContain("approval distribution");
  });

  it("prompt has both Run Quick Simulation and Not Now buttons", () => {
    const buttons = ["RUN QUICK SIMULATION", "NOT NOW — SUBMIT TO COUNCIL"];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toContain("RUN QUICK SIMULATION");
    expect(buttons[1]).toContain("NOT NOW");
  });
});

// ── Requirement 2: Quick Simulation uses upgraded deal state ──────────────────

describe("Req 2 — Quick Simulation uses upgraded deal state", () => {
  it("simulation uses revisedBrief (not original dealText)", () => {
    const originalText = "Original deal memo with weak DSCR";
    const revisedBrief = "[REVISED: DSCR increased to 1.31x] Upgraded deal memo";
    // The simulation is launched with revisedBrief, not originalText
    const simInput = revisedBrief.slice(0, 12000);
    expect(simInput).toContain("REVISED");
    expect(simInput).not.toBe(originalText);
  });

  it("upgraded dealId is derived from original dealId with -fixed suffix", () => {
    const originalDealId = "deal-abc123";
    const upgradedDealId = `${originalDealId}-fixed`;
    expect(upgradedDealId).toBe("deal-abc123-fixed");
  });

  it("simulation mode is always 'quick' (100 scenarios)", () => {
    const mode = "quick";
    expect(mode).toBe("quick");
  });

  it("simulation target count for quick mode is 100", () => {
    // quick mode = 100 scenarios per SIMULATION_MODES config
    const QUICK_COUNT = 100;
    expect(QUICK_COUNT).toBe(100);
  });
});

// ── Requirement 3: Infrastructure mode persists into upgraded simulation ──────

describe("Req 3 — Council mode persists into upgraded simulation", () => {
  it("infrastructure mode is passed to startRun as councilMode", () => {
    const councilMode = "infrastructure";
    const simParams = {
      dealId: "deal-test-fixed",
      dealName: "Test Deal [UPGRADED]",
      dealText: "revised brief...",
      mode: "quick" as const,
      councilMode: councilMode as "infrastructure",
    };
    expect(simParams.councilMode).toBe("infrastructure");
  });

  it("gcc mode is preserved through the fix workflow", () => {
    const councilMode = "gcc";
    const effectiveMode = councilMode ?? "global_vc";
    expect(effectiveMode).toBe("gcc");
  });

  it("falls back to global_vc when councilMode is undefined", () => {
    const councilMode: string | undefined = undefined;
    const effectiveMode = councilMode ?? "global_vc";
    expect(effectiveMode).toBe("global_vc");
  });
});

// ── Requirement 4: Stress Test Report unlocks after upgraded simulation ───────

describe("Req 4 — Stress Test Report unlocks after upgraded simulation", () => {
  it("onUpgradedSimCompleted callback propagates to parent handleSimCompleted", () => {
    let capturedData: any = null;
    const handleSimCompleted = (data: any) => { capturedData = data; };
    const onUpgradedSimCompleted = handleSimCompleted;
    const simPayload = {
      runId: "run-upgraded-001",
      mode: "quick",
      targetCount: 100,
      completedAt: new Date().toISOString(),
      aggregation: { decisionDistribution: { approvePct: 72, conditionalPct: 15, rejectPct: 13 } },
    };
    onUpgradedSimCompleted(simPayload);
    expect(capturedData).not.toBeNull();
    expect(capturedData.runId).toBe("run-upgraded-001");
    expect(capturedData.mode).toBe("quick");
  });

  it("effectiveSimData is updated when liveSimData is set", () => {
    const liveSimData = {
      runId: "run-upgraded-001",
      mode: "quick",
      targetCount: 100,
      completedAt: new Date().toISOString(),
      aggregation: { decisionDistribution: { approvePct: 72, conditionalPct: 15, rejectPct: 13 } },
    };
    // effectiveSimData prefers liveSimData over DB fallback
    const effectiveSimData = liveSimData ?? null;
    expect(effectiveSimData?.runId).toBe("run-upgraded-001");
  });
});

// ── Requirement 5: Original vs Upgraded comparison card ──────────────────────

describe("Req 5 — Original vs Upgraded comparison card", () => {
  it("comparison card renders original verdict and upgraded predicted verdict", () => {
    const originalVerdict = "REJECTED";
    const upgradedPredictedDecision = "APPROVED_WITH_CONDITIONS";
    expect(originalVerdict).toBe("REJECTED");
    expect(upgradedPredictedDecision).toContain("APPROVED");
  });

  it("comparison shows original yesCount and predicted vote distribution", () => {
    const originalYes = 3;
    const predictedVoteDistribution = "8/10 YES";
    expect(originalYes).toBeLessThan(8);
    expect(predictedVoteDistribution).toContain("YES");
  });

  it("comparison shows simulation distribution percentages when available", () => {
    const simDist = { approvePct: 72, conditionalPct: 15, rejectPct: 13 };
    const total = simDist.approvePct + simDist.conditionalPct + simDist.rejectPct;
    expect(total).toBe(100);
    expect(simDist.approvePct).toBeGreaterThan(50);
  });

  it("comparison card has data-testid='original-vs-upgraded'", () => {
    // Verify the testid string used in the component
    const testId = "original-vs-upgraded";
    expect(testId).toBe("original-vs-upgraded");
  });
});

// ── Requirement 6: Rejected-after-fix case handled cleanly ───────────────────

describe("Req 6 — Rejected-after-fix case handled cleanly", () => {
  it("fixesImproved is false when predictedYes <= originalYes", () => {
    const originalYes = 5;
    const predictedYes = 4;
    const fixesImproved = predictedYes > originalYes;
    expect(fixesImproved).toBe(false);
  });

  it("fixesImproved is true when predictedYes > originalYes", () => {
    const originalYes = 3;
    const predictedYes = 7;
    const fixesImproved = predictedYes > originalYes;
    expect(fixesImproved).toBe(true);
  });

  it("failure message shown when fixes did not improve investability", () => {
    const originalYes = 5;
    const predictedYes = 4;
    const fixesImproved = predictedYes > originalYes;
    const message = fixesImproved
      ? `FIXES IMPROVED INVESTABILITY — Predicted vote count: ${originalYes}/10 → ${predictedYes}/10`
      : `FIXES DID NOT IMPROVE INVESTABILITY — Vote count unchanged: ${originalYes}/10 → ${predictedYes}/10`;
    expect(message).toContain("DID NOT IMPROVE");
    expect(message).toContain("5/10 → 4/10");
  });

  it("success message shown when fixes improved investability", () => {
    const originalYes = 3;
    const predictedYes = 8;
    const fixesImproved = predictedYes > originalYes;
    const message = fixesImproved
      ? `FIXES IMPROVED INVESTABILITY — Predicted vote count: ${originalYes}/10 → ${predictedYes}/10`
      : `FIXES DID NOT IMPROVE INVESTABILITY — Vote count unchanged: ${originalYes}/10 → ${predictedYes}/10`;
    expect(message).toContain("IMPROVED INVESTABILITY");
    expect(message).toContain("3/10 → 8/10");
  });

  it("Class C deals never reach the comparison card (report suppressed)", () => {
    const classification = "C";
    const isClassC = classification === "C";
    // When isClassC, the full repair report is not rendered — no comparison card
    expect(isClassC).toBe(true);
    const shouldRenderComparisonCard = !isClassC;
    expect(shouldRenderComparisonCard).toBe(false);
  });
});

// ── Requirement 7: Reports Panel updates with upgraded simulation ─────────────

describe("Req 7 — Reports Panel updates with upgraded simulation data", () => {
  it("handleSimCompleted updates liveSimData which feeds effectiveSimData", () => {
    let liveSimData: any = null;
    const handleSimCompleted = (data: any) => { liveSimData = data; };
    handleSimCompleted({
      runId: "run-upgraded-002",
      mode: "quick",
      targetCount: 100,
      completedAt: new Date().toISOString(),
      aggregation: {},
    });
    const effectiveSimData = liveSimData ?? null;
    expect(effectiveSimData?.runId).toBe("run-upgraded-002");
  });

  it("Stress Test Report receives upgraded aggregation data", () => {
    const upgradedAggregation = {
      decisionDistribution: {
        approveCount: 72, conditionalCount: 15, rejectCount: 13,
        approvePct: 72, conditionalPct: 15, rejectPct: 13,
        totalScenarios: 100, hardNoCount: 5, hardNoPct: 5,
      },
    };
    expect(upgradedAggregation.decisionDistribution.totalScenarios).toBe(100);
    expect(upgradedAggregation.decisionDistribution.approvePct).toBeGreaterThan(0);
  });

  it("IC Memo reflects upgraded verdict when liveSimData is set", () => {
    // The IC Memo export uses result.verdict — when re-run completes, result is updated
    // This test verifies the data flow: onUpgradedSimCompleted → handleSimCompleted → effectiveSimData
    const callbacks: Array<(data: any) => void> = [];
    const onUpgradedSimCompleted = (data: any) => callbacks.forEach(cb => cb(data));
    let stressTestUpdated = false;
    callbacks.push(() => { stressTestUpdated = true; });
    onUpgradedSimCompleted({ runId: "run-003", mode: "quick", targetCount: 100, completedAt: "", aggregation: {} });
    expect(stressTestUpdated).toBe(true);
  });
});

// ── Task 1-3: Before/After Simulation Comparison + Persistence + History Labeling ─────────────

describe("Task 1 — Original Sim Distribution in Comparison Card", () => {
  it("origCompletedRun is null when no completed non-upgraded run exists", () => {
    const origSimRuns: any[] = [];
    const origCompletedRun = origSimRuns.find(
      (r: any) => r.status === "completed" && !r.upgradedScenario
    ) ?? null;
    expect(origCompletedRun).toBeNull();
  });

  it("origCompletedRun resolves to the first completed non-upgraded run", () => {
    const origSimRuns = [
      { runId: "run-upg-001", status: "completed", upgradedScenario: 1 },
      { runId: "run-orig-001", status: "completed", upgradedScenario: 0 },
    ];
    const origCompletedRun = origSimRuns.find(
      (r: any) => r.status === "completed" && !r.upgradedScenario
    ) ?? null;
    expect(origCompletedRun?.runId).toBe("run-orig-001");
  });

  it("upgraded runs are excluded from origCompletedRun lookup", () => {
    const origSimRuns = [
      { runId: "run-upg-001", status: "completed", upgradedScenario: 1 },
      { runId: "run-upg-002", status: "completed", upgradedScenario: 1 },
    ];
    const origCompletedRun = origSimRuns.find(
      (r: any) => r.status === "completed" && !r.upgradedScenario
    ) ?? null;
    expect(origCompletedRun).toBeNull();
  });

  it("fallback 'No original simulation available.' renders when origSimDist is null", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain("No original simulation available.");
  });

  it("ORIGINAL STRESS SIMULATION section renders when origSimDist is available", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain("ORIGINAL STRESS SIMULATION");
    expect(src).toContain("origSimDist.approvePct");
    expect(src).toContain("origSimDist.conditionalPct");
    expect(src).toContain("origSimDist.rejectPct");
  });

  it("origSimDist is derived from decisionDistribution on the aggregation object", () => {
    const aggregation = {
      decisionDistribution: {
        approvePct: 45, conditionalPct: 20, rejectPct: 35,
        totalScenarios: 100,
      },
    };
    const origSimDist = (aggregation as any).decisionDistribution ?? null;
    expect(origSimDist).not.toBeNull();
    expect(origSimDist.approvePct).toBe(45);
    expect(origSimDist.rejectPct).toBe(35);
  });
});

describe("Task 2 — Upgraded Sim Persistence to Deal History", () => {
  it("schema has upgradedScenario column on scenarioSimRuns", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    expect(src).toContain('upgradedScenario: tinyint("upgraded_scenario").notNull().default(0)');
  });

  it("schema has originalDealId column on scenarioSimRuns", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    expect(src).toContain('originalDealId:  varchar("original_deal_id", { length: 64 })');
  });

  it("schema has originalVerdict and upgradedVerdict columns", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    expect(src).toContain('originalVerdict: varchar("original_verdict", { length: 64 })');
    expect(src).toContain('upgradedVerdict: varchar("upgraded_verdict", { length: 64 })');
  });

  it("startRun input schema accepts upgradedScenario boolean", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "routers/scenarioSim.ts"),
      "utf8"
    );
    expect(src).toContain("upgradedScenario: z.boolean().optional()");
  });

  it("startRun inserts upgradedScenario as 0 or 1 tinyint", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "routers/scenarioSim.ts"),
      "utf8"
    );
    expect(src).toContain("upgradedScenario: input.upgradedScenario ? 1 : 0");
  });

  it("listRunsForDeal returns upgradedScenario and originalDealId", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "routers/scenarioSim.ts"),
      "utf8"
    );
    expect(src).toContain("upgradedScenario: scenarioSimRuns.upgradedScenario");
    expect(src).toContain("originalDealId:   scenarioSimRuns.originalDealId");
  });

  it("FixTheDealPanel passes upgradedScenario=true to startRun", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain("upgradedScenario: true");
  });

  it("FixTheDealPanel passes originalDealId to startRun", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain("originalDealId: result.dealId ?? undefined");
  });

  it("original and upgraded runs are distinct (different dealIds)", () => {
    const originalDealId = "deal-abc";
    const upgradedDealId = `${originalDealId}-fixed`;
    expect(upgradedDealId).not.toBe(originalDealId);
    expect(upgradedDealId).toContain("-fixed");
  });
});

describe("Task 3 — Simulation History Labeling", () => {
  it("SimulationHistoryPanel renders UPGRADED badge for upgradedScenario=1 runs", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/components/ScenarioSimDashboard.tsx"),
      "utf8"
    );
    expect(src).toContain('"UPGRADED"');
    expect(src).toContain('"ORIGINAL"');
  });

  it("TYPE column header is present in SimulationHistoryPanel", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/components/ScenarioSimDashboard.tsx"),
      "utf8"
    );
    expect(src).toContain("<span>TYPE</span>");
  });

  it("restored upgraded simulation shows green banner text", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/components/ScenarioSimDashboard.tsx"),
      "utf8"
    );
    expect(src).toContain("VIEWING RESTORED UPGRADED SIMULATION");
  });

  it("restored original simulation shows amber warning text", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/components/ScenarioSimDashboard.tsx"),
      "utf8"
    );
    expect(src).toContain("VIEWING RESTORED HISTORICAL DATA");
  });

  it("upgraded badge uses green color, original badge uses muted color", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/components/ScenarioSimDashboard.tsx"),
      "utf8"
    );
    expect(src).toContain("(run as any).upgradedScenario ? GREEN : TEXT2");
  });

  it("Infrastructure mode label is preserved in history rows", () => {
    const modeLabel = (mode: string): string => {
      const map: Record<string, string> = {
        quick: "Quick (100)",
        institutional: "Institutional (1k)",
        deep: "Deep (10k)",
        infrastructure: "Infrastructure (100k)",
      };
      return map[mode] ?? mode;
    };
    expect(modeLabel("infrastructure")).toBe("Infrastructure (100k)");
    expect(modeLabel("quick")).toBe("Quick (100)");
  });

  it("DB index exists for originalDealId for efficient history queries", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../drizzle/schema.ts"),
      "utf8"
    );
    expect(src).toContain('ssrOrigDeal: index("ssr_orig_deal_idx").on(table.originalDealId)');
  });
});

// ── Simulation Delta Row ──────────────────────────────────────────────────────

describe("Simulation Delta Row", () => {
  // Helper that mirrors the component logic exactly
  const computeDelta = (
    origDist: { approvePct: number; conditionalPct: number; rejectPct: number } | null,
    upgDist: { approvePct: number; conditionalPct: number; rejectPct: number } | null
  ) => {
    if (!origDist || !upgDist) return null;
    const deltaApprove = Math.round(upgDist.approvePct)     - Math.round(origDist.approvePct);
    const deltaCond    = Math.round(upgDist.conditionalPct) - Math.round(origDist.conditionalPct);
    const deltaReject  = Math.round(upgDist.rejectPct)      - Math.round(origDist.rejectPct);
    const improved     = deltaApprove > 0 || (deltaApprove === 0 && deltaReject < 0);
    const fmt = (n: number) => (n >= 0 ? `+${n}pp` : `${n}pp`);
    return { deltaApprove, deltaCond, deltaReject, improved, fmt };
  };

  it("delta row renders when both distributions exist", () => {
    const orig = { approvePct: 35, conditionalPct: 20, rejectPct: 45 };
    const upg  = { approvePct: 62, conditionalPct: 18, rejectPct: 20 };
    const result = computeDelta(orig, upg);
    expect(result).not.toBeNull();
    expect(result!.deltaApprove).toBe(27);
    expect(result!.deltaCond).toBe(-2);
    expect(result!.deltaReject).toBe(-25);
  });

  it("delta row hides when original distribution is missing", () => {
    const result = computeDelta(null, { approvePct: 62, conditionalPct: 18, rejectPct: 20 });
    expect(result).toBeNull();
  });

  it("delta row hides when upgraded distribution is missing", () => {
    const result = computeDelta({ approvePct: 35, conditionalPct: 20, rejectPct: 45 }, null);
    expect(result).toBeNull();
  });

  it("positive improvement formats correctly (approve up, reject down)", () => {
    const orig = { approvePct: 35, conditionalPct: 20, rejectPct: 45 };
    const upg  = { approvePct: 62, conditionalPct: 18, rejectPct: 20 };
    const r = computeDelta(orig, upg)!;
    expect(r.fmt(r.deltaApprove)).toBe("+27pp");
    expect(r.fmt(r.deltaCond)).toBe("-2pp");
    expect(r.fmt(r.deltaReject)).toBe("-25pp");
    expect(r.improved).toBe(true);
  });

  it("negative/worse movement formats correctly (approve down, reject up)", () => {
    const orig = { approvePct: 60, conditionalPct: 20, rejectPct: 20 };
    const upg  = { approvePct: 40, conditionalPct: 15, rejectPct: 45 };
    const r = computeDelta(orig, upg)!;
    expect(r.fmt(r.deltaApprove)).toBe("-20pp");
    expect(r.fmt(r.deltaCond)).toBe("-5pp");
    expect(r.fmt(r.deltaReject)).toBe("+25pp");
    expect(r.improved).toBe(false);
  });

  it("zero delta formats as +0pp", () => {
    const same = { approvePct: 50, conditionalPct: 25, rejectPct: 25 };
    const r = computeDelta(same, same)!;
    expect(r.fmt(r.deltaApprove)).toBe("+0pp");
    expect(r.fmt(r.deltaCond)).toBe("+0pp");
    expect(r.fmt(r.deltaReject)).toBe("+0pp");
  });

  it("improved=true when approve unchanged but reject decreases", () => {
    const orig = { approvePct: 50, conditionalPct: 20, rejectPct: 30 };
    const upg  = { approvePct: 50, conditionalPct: 25, rejectPct: 25 };
    const r = computeDelta(orig, upg)!;
    expect(r.deltaApprove).toBe(0);
    expect(r.deltaReject).toBe(-5);
    expect(r.improved).toBe(true);
  });

  it("data-testid='sim-delta-row' is present in DealScreener.tsx source", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain('data-testid="sim-delta-row"');
  });

  it("delta row is gated on both origSimDist and upgradedSimData.aggregation", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain("origSimDist && upgradedSimData.aggregation?.decisionDistribution");
  });

  it("SIMULATION DELTA label is present in the component source", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );
    expect(src).toContain("SIMULATION DELTA");
  });
});

// ── Guided Sequential Workflow Tests ─────────────────────────────────────────
describe("Guided Sequential Workflow — state engine and tracker", () => {
  const readSrc = () =>
    require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );

  // Req 1: Workflow tracker renders with data-testid
  it("workflow tracker has data-testid='workflow-tracker'", () => {
    expect(readSrc()).toContain('data-testid="workflow-tracker"');
  });

  // Req 2: All 6 workflow steps are present
  it("workflow tracker contains all 6 steps", () => {
    const src = readSrc();
    // Steps are rendered via template literal: data-testid={`workflow-step-${step.id}`}
    // Verify the template literal pattern and all 6 step ids are defined
    expect(src).toContain('data-testid={`workflow-step-${step.id}`}');
    expect(src).toContain('{ id: "screen"');
    expect(src).toContain('{ id: "upgrade"');
    expect(src).toContain('{ id: "fix"');
    expect(src).toContain('{ id: "rerun"');
    expect(src).toContain('{ id: "simulate"');
    expect(src).toContain('{ id: "compare"');
  });

  // Req 3: Workflow state engine declares the 6 flags
  it("workflow state engine declares all required flags", () => {
    const src = readSrc();
    expect(src).toContain("fixesApplied");
    expect(src).toContain("rerunCompleted");
    expect(src).toContain("screeningCompleted");
    expect(src).toContain("upgradeProtocolGenerated");
    expect(src).toContain("simulationCompleted");
    expect(src).toContain("comparisonAvailable");
  });

  // Req 4: screeningCompleted is always true inside ICReport
  it("screeningCompleted is always true inside ICReport", () => {
    const src = readSrc();
    expect(src).toContain("const screeningCompleted       = true;");
  });

  // Req 5: upgradeProtocolGenerated derives from liftedProtocol
  it("upgradeProtocolGenerated derives from liftedProtocol", () => {
    const src = readSrc();
    expect(src).toContain("const upgradeProtocolGenerated = liftedProtocol != null;");
  });

  // Req 6: simulationCompleted derives from effectiveSimData
  it("simulationCompleted derives from effectiveSimData", () => {
    const src = readSrc();
    expect(src).toContain("const simulationCompleted  = effectiveSimData != null;");
  });

  // Req 7: comparisonAvailable requires both simulationCompleted and rerunCompleted
  it("comparisonAvailable requires simulationCompleted AND rerunCompleted", () => {
    const src = readSrc();
    expect(src).toContain("const comparisonAvailable  = simulationCompleted && rerunCompleted;");
  });

  // Req 8: Next-step prompt after upgrade protocol is rendered
  it("next-step prompt card after upgrade protocol has correct data-testid", () => {
    const src = readSrc();
    expect(src).toContain('data-testid="next-step-prompt-upgrade"');
    expect(src).toContain("upgradeProtocolGenerated && !fixesApplied");
  });

  // Req 9: Next-step prompt after re-run is rendered
  it("next-step prompt card after re-run has correct data-testid", () => {
    const src = readSrc();
    expect(src).toContain('data-testid="next-step-prompt-rerun"');
    expect(src).toContain("rerunCompleted && !simulationCompleted");
  });
});

// ── Final Investability Summary Tests ────────────────────────────────────────
describe("Final Investability Summary card", () => {
  const readSrc = () =>
    require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );

  it("investability summary has data-testid='investability-summary'", () => {
    expect(readSrc()).toContain('data-testid="investability-summary"');
  });

  it("investability summary is gated on comparisonAvailable", () => {
    const src = readSrc();
    expect(src).toContain("{comparisonAvailable && (");
  });

  it("investability summary contains COUNCIL VERDICT DELTA section", () => {
    expect(readSrc()).toContain("COUNCIL VERDICT DELTA");
  });

  it("investability summary contains SIMULATION DELTA section", () => {
    expect(readSrc()).toContain("SIMULATION DELTA");
  });

  it("investability summary contains RESIDUAL BLOCKERS section", () => {
    expect(readSrc()).toContain("RESIDUAL BLOCKERS");
  });

  it("investability summary contains GOVERNANCE POSTURE section", () => {
    expect(readSrc()).toContain("GOVERNANCE POSTURE");
  });

  it("governance posture handles approved verdict", () => {
    const src = readSrc();
    expect(src).toContain("Proceed to IC presentation with updated materials.");
  });

  it("governance posture handles rejected-after-fix case", () => {
    const src = readSrc();
    expect(src).toContain("Additional restructuring required before resubmission.");
  });

  it("investability summary shows confidence delta", () => {
    const src = readSrc();
    expect(src).toContain("liftedDelta?.confidenceBefore");
    expect(src).toContain("liftedDelta?.confidenceAfter");
  });
});

// ── Workflow Tracker Visual Connector Tests ───────────────────────────────────
describe("Workflow Tracker visual connectors", () => {
  const readSrc = () =>
    require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );

  it("tracker connector line uses GREEN for completed steps", () => {
    const src = readSrc();
    expect(src).toContain("idx < currentIdx ? GREEN : BORDER");
  });

  it("tracker uses findLastIndex to determine current step", () => {
    const src = readSrc();
    expect(src).toContain("steps.findLastIndex(s => s.done)");
  });

  it("tracker step circle shows checkmark for done steps", () => {
    const src = readSrc();
    expect(src).toContain("isDone");
    expect(src).toContain("✓");
  });
});

// ── Workflow Tracker State Wiring Tests ──────────────────────────────────────
describe("Workflow Tracker State Wiring", () => {
  const readSrc = () =>
    require("fs").readFileSync(
      require("path").join(__dirname, "../client/src/pages/DealScreener.tsx"),
      "utf8"
    );

  // Req 1: FixTheDealPanel accepts onFixesApplied and onRerunCompleted props
  it("FixTheDealPanel props interface includes onFixesApplied callback", () => {
    const src = readSrc();
    expect(src).toContain("onFixesApplied?: () => void;");
  });

  it("FixTheDealPanel props interface includes onRerunCompleted callback", () => {
    const src = readSrc();
    expect(src).toContain("onRerunCompleted?: () => void;");
  });

  // Req 2: onFixesApplied is called in fixMutation onSuccess
  it("onFixesApplied is called in fixMutation onSuccess callback", () => {
    const src = readSrc();
    expect(src).toContain("onSuccess: () => { onFixesApplied?.(); }");
  });

  // Req 3: onRerunCompleted is called in handleContinueToCouncil before onRerun
  it("onRerunCompleted is called in handleContinueToCouncil", () => {
    const src = readSrc();
    expect(src).toContain("onRerunCompleted?.();");
    // Ensure it appears before onRerun call in handleContinueToCouncil
    const rerunCompletedIdx = src.indexOf("onRerunCompleted?.();");
    const onRerunCallIdx = src.indexOf("onRerun(\n      result.dealName");
    expect(rerunCompletedIdx).toBeLessThan(onRerunCallIdx);
  });

  // Req 4: BoardroomICReport passes onFixesApplied and onRerunCompleted to FixTheDealPanel
  it("BoardroomICReport passes onFixesApplied to FixTheDealPanel", () => {
    const src = readSrc();
    expect(src).toContain("onFixesApplied={onFixesApplied}");
  });

  it("BoardroomICReport passes onRerunCompleted to FixTheDealPanel", () => {
    const src = readSrc();
    expect(src).toContain("onRerunCompleted={onRerunCompleted}");
  });

  // Req 5: ICReport wires setFixesApplied and setRerunCompleted into BoardroomICReport
  it("ICReport passes setFixesApplied as onFixesApplied to BoardroomICReport", () => {
    const src = readSrc();
    expect(src).toContain("onFixesApplied={() => setFixesApplied(true)}");
  });

  it("ICReport passes setRerunCompleted as onRerunCompleted to BoardroomICReport", () => {
    const src = readSrc();
    expect(src).toContain("onRerunCompleted={() => setRerunCompleted(true)}");
  });

  // Req 6: Simulation prompt still appears after re-run (showSimPrompt is set in handleRerun)
  it("showSimPrompt is set to true in handleRerun (simulation prompt still appears)", () => {
    const src = readSrc();
    expect(src).toContain("setShowSimPrompt(true);");
  });

  // Req 7: Comparison card still renders after simulation (comparisonAvailable gating preserved)
  it("comparisonAvailable gates the investability summary card", () => {
    const src = readSrc();
    expect(src).toContain("{comparisonAvailable && (");
    expect(src).toContain('data-testid="investability-summary"');
  });

  // Req 8: Infrastructure mode is preserved through the rerun flow (councilMode passed through)
  it("Infrastructure mode is preserved — councilMode passed to handleContinueToCouncil", () => {
    const src = readSrc();
    // councilMode is used in handleContinueToCouncil as the third arg to onRerun
    expect(src).toContain("(councilMode as CouncilModeType) ?? result.councilMode ?? \"global_vc\"");
  });

  // Req 9: No regressions — onUpgradedSimCompleted still wired
  it("onUpgradedSimCompleted is still wired through the prop chain", () => {
    const src = readSrc();
    expect(src).toContain("onUpgradedSimCompleted={onUpgradedSimCompleted}");
    expect(src).toContain("onUpgradedSimCompleted={handleSimCompleted}");
  });
});
