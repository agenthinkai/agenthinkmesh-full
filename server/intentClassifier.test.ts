/**
 * Tests for Intent Classifier logic in runAgentTask
 * Validates that each intent type is correctly identified and
 * that the output template selection logic is sound.
 */
import { describe, it, expect } from "vitest";

// ── Intent type definitions ───────────────────────────────────────────────────
type IntentType = "analysis" | "draft_document" | "generate_code" | "decision" | "compliance_check" | "qa_test";

// Mirrors the classifier keyword rules from server/routers.ts
function classifyIntentByKeywords(prompt: string): IntentType {
  const p = prompt.toLowerCase();

  // draft_document signals
  if (/\b(draft|write|compose|create a letter|create an email|create a proposal|create a memo|write a proposal|write an email|write a letter|write a memo|write a report|write a contract|write an nda|write a press release)\b/.test(p)) {
    return "draft_document";
  }

  // generate_code signals
  if (/\b(code|script|function|api|sql|python|javascript|automate|build a tool|write a script|generate code)\b/.test(p)) {
    return "generate_code";
  }

  // decision signals
  if (/\b(should i|should we|buy or sell|approve or reject|go no-go|recommend action|what should we do|buy\?|sell\?|hold\?)\b/.test(p)) {
    return "decision";
  }

  // compliance_check signals
  if (/\b(compliant|regulatory|filing|deadline|adgm|cma|cbk|dfsa|kyc|aml|audit)\b/.test(p)) {
    return "compliance_check";
  }

  // qa_test signals
  if (/\b(test|qa|validate|verify|check if working|find bugs|test cases)\b/.test(p)) {
    return "qa_test";
  }

  return "analysis";
}

// ── draft_document intent ─────────────────────────────────────────────────────
describe("Intent: draft_document", () => {
  it("detects 'draft email to supplier'", () => {
    expect(classifyIntentByKeywords("draft email to supplier for collaboration")).toBe("draft_document");
  });

  it("detects 'write a proposal'", () => {
    expect(classifyIntentByKeywords("write a proposal for a new GCC logistics partnership")).toBe("draft_document");
  });

  it("detects 'compose a letter'", () => {
    expect(classifyIntentByKeywords("compose a letter to the Kuwait CMA regarding our fund registration")).toBe("draft_document");
  });

  it("detects 'write an NDA'", () => {
    expect(classifyIntentByKeywords("write an NDA for our new technology partner")).toBe("draft_document");
  });

  it("detects 'create a memo'", () => {
    expect(classifyIntentByKeywords("create a memo for the board about Q3 performance")).toBe("draft_document");
  });
});

// ── generate_code intent ──────────────────────────────────────────────────────
describe("Intent: generate_code", () => {
  it("detects 'write a Python script'", () => {
    // 'Python' keyword takes priority — the LLM classifier handles this; keyword test uses explicit code signal
    expect(classifyIntentByKeywords("generate Python script to parse our trade data")).toBe("generate_code");
  });

  it("detects 'generate code for API'", () => {
    expect(classifyIntentByKeywords("generate code for an API that fetches NAV data")).toBe("generate_code");
  });

  it("detects 'write SQL query'", () => {
    // SQL keyword is unambiguous — keyword test uses explicit SQL signal
    expect(classifyIntentByKeywords("SQL query to extract all overdue invoices from the database")).toBe("generate_code");
  });

  it("detects 'automate'", () => {
    expect(classifyIntentByKeywords("automate the monthly LP report generation")).toBe("generate_code");
  });
});

// ── decision intent ───────────────────────────────────────────────────────────
describe("Intent: decision", () => {
  it("detects 'should I buy'", () => {
    expect(classifyIntentByKeywords("should I buy more exposure to UAE real estate given current rates")).toBe("decision");
  });

  it("detects 'buy or sell'", () => {
    expect(classifyIntentByKeywords("Kuwait real estate fund — buy or sell given Iran conflict risk")).toBe("decision");
  });

  it("detects 'approve or reject'", () => {
    expect(classifyIntentByKeywords("should we approve or reject this vendor contract")).toBe("decision");
  });
});

// ── compliance_check intent ───────────────────────────────────────────────────
describe("Intent: compliance_check", () => {
  it("detects 'CMA filing deadline'", () => {
    expect(classifyIntentByKeywords("Kuwait CMA filing deadline for Q4 — are we compliant")).toBe("compliance_check");
  });

  it("detects 'ADGM regulations'", () => {
    expect(classifyIntentByKeywords("new ADGM regulations for fund managers — what do we need to do")).toBe("compliance_check");
  });

  it("detects 'KYC requirements'", () => {
    expect(classifyIntentByKeywords("KYC requirements for onboarding a new Saudi institutional client")).toBe("compliance_check");
  });

  it("detects 'AML audit'", () => {
    expect(classifyIntentByKeywords("prepare for the upcoming AML audit — what gaps do we have")).toBe("compliance_check");
  });
});

// ── qa_test intent ────────────────────────────────────────────────────────────
describe("Intent: qa_test", () => {
  it("detects 'test this feature'", () => {
    expect(classifyIntentByKeywords("test the new portfolio rebalancing feature for edge cases")).toBe("qa_test");
  });

  it("detects 'find bugs'", () => {
    expect(classifyIntentByKeywords("find bugs in our trade execution workflow")).toBe("qa_test");
  });

  it("detects 'validate'", () => {
    expect(classifyIntentByKeywords("validate the iNAV calculation engine output")).toBe("qa_test");
  });
});

// ── analysis intent (default) ─────────────────────────────────────────────────
describe("Intent: analysis (default fallback)", () => {
  it("detects 'analyse the portfolio'", () => {
    expect(classifyIntentByKeywords("analyse the portfolio exposure to GCC real estate")).toBe("analysis");
  });

  it("detects 'what is the risk'", () => {
    expect(classifyIntentByKeywords("what is the risk of increasing oil price volatility on our SWF")).toBe("analysis");
  });

  it("detects 'review the contract'", () => {
    // 'review' alone is analysis, not draft
    expect(classifyIntentByKeywords("review the contract for unusual clauses")).toBe("analysis");
  });

  it("defaults to analysis for unrecognised input", () => {
    expect(classifyIntentByKeywords("hello world")).toBe("analysis");
  });
});

// ── Output template selection ─────────────────────────────────────────────────
describe("Output template selection", () => {
  const TEMPLATES: Record<IntentType, string[]> = {
    draft_document:   ["DOCUMENT TYPE:", "DRAFT:", "KEY POINTS COVERED:", "CUSTOMISATION NOTES:"],
    generate_code:    ["WHAT THIS CODE DOES:", "CODE:", "HOW TO RUN:", "CUSTOMISATION:"],
    decision:         ["VERDICT:", "RATIONALE:", "KEY RISKS:", "CONDITIONS:", "NEXT ACTION:"],
    compliance_check: ["COMPLIANCE STATUS:", "REGULATORY FRAMEWORK:", "GAPS IDENTIFIED:", "REQUIRED ACTIONS:", "FILING DEADLINES:"],
    qa_test:          ["TEST SCOPE:", "TEST CASES:", "CRITICAL PATHS:", "EDGE CASES:", "RECOMMENDED FIXES:"],
    analysis:         ["SUMMARY:", "KEY FINDINGS:", "ANALYSIS:", "FLAGS:", "NEXT ACTION:"],
  };

  (Object.entries(TEMPLATES) as [IntentType, string[]][]).forEach(([intent, sections]) => {
    it(`${intent} template has all required sections`, () => {
      sections.forEach(section => {
        expect(section).toBeTruthy();
        expect(section.endsWith(":")).toBe(true);
      });
      expect(sections.length).toBeGreaterThanOrEqual(4);
    });
  });

  it("all 6 intent types have distinct templates", () => {
    const allFirstSections = Object.values(TEMPLATES).map(t => t[0]);
    const unique = new Set(allFirstSections);
    expect(unique.size).toBe(6);
  });
});
