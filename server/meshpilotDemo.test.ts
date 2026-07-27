import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the database ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue([[]])
  })
}));

// ── Mock invokeLLM ────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "This is a test AI response about banking compliance." } }]
  })
}));

// ── Import the functions we can test directly ─────────────────────────────────
// We test the PII detection and task classification logic inline since they
// are pure functions embedded in the route file.

// ── PII Detection Tests ───────────────────────────────────────────────────────
describe("PII Detection Logic", () => {
  // Replicate the PII detection logic from meshpilotDemoRoute.ts
  const PII_PATTERNS = [
    { type: "Aadhaar (India)", regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
    { type: "PAN Card (India)", regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g },
    { type: "NRIC (Singapore)", regex: /\b[STFG]\d{7}[A-Z]\b/g },
    { type: "NIK (Indonesia)", regex: /\b\d{16}\b/g },
    { type: "Email Address", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
    { type: "Phone Number", regex: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
    { type: "Credit Card", regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g },
    { type: "Passport Number", regex: /\b[A-Z]{1,2}\d{6,9}\b/g },
  ];

  function detectPII(text: string) {
    const detected: { type: string; count: number; redacted: string }[] = [];
    let redactedText = text;
    for (const pattern of PII_PATTERNS) {
      const matches = text.match(new RegExp(pattern.regex.source, "g"));
      if (matches && matches.length > 0) {
        detected.push({ type: pattern.type, count: matches.length, redacted: `[${pattern.type.toUpperCase()}_REDACTED]` });
        redactedText = redactedText.replace(new RegExp(pattern.regex.source, "g"), `[${pattern.type.toUpperCase()}_REDACTED]`);
      }
    }
    return { detected, redactedText, hasPII: detected.length > 0 };
  }

  it("detects Aadhaar numbers", () => {
    const result = detectPII("Customer Aadhaar: 1234 5678 9012");
    expect(result.hasPII).toBe(true);
    expect(result.detected.some(d => d.type === "Aadhaar (India)")).toBe(true);
  });

  it("detects PAN card numbers", () => {
    const result = detectPII("PAN: ABCDE1234F");
    expect(result.hasPII).toBe(true);
    expect(result.detected.some(d => d.type === "PAN Card (India)")).toBe(true);
  });

  it("detects email addresses", () => {
    const result = detectPII("Contact: john.doe@example.com");
    expect(result.hasPII).toBe(true);
    expect(result.detected.some(d => d.type === "Email Address")).toBe(true);
  });

  it("detects NRIC numbers", () => {
    const result = detectPII("NRIC: S1234567D");
    expect(result.hasPII).toBe(true);
    expect(result.detected.some(d => d.type === "NRIC (Singapore)")).toBe(true);
  });

  it("returns clean result for non-PII text", () => {
    const result = detectPII("What are the KYC requirements for corporate onboarding?");
    expect(result.hasPII).toBe(false);
    expect(result.detected).toHaveLength(0);
  });

  it("redacts PII from text", () => {
    const result = detectPII("Email: test@example.com");
    expect(result.redactedText).not.toContain("test@example.com");
    expect(result.redactedText).toContain("REDACTED");
  });
});

// ── Task Classification Tests ─────────────────────────────────────────────────
describe("Task Classification Logic", () => {
  function classifyTask(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("kyc") || lower.includes("aml") || lower.includes("compliance") || lower.includes("ojk") || lower.includes("ppatk")) return "compliance";
    if (lower.includes("contract") || lower.includes("clause") || lower.includes("agreement") || lower.includes("spa") || lower.includes("sha")) return "contract_review";
    if (lower.includes("loan") || lower.includes("credit") || lower.includes("borrower") || lower.includes("dscr")) return "credit_analysis";
    if (lower.includes("fraud") || lower.includes("suspicious") || lower.includes("transaction")) return "fraud_detection";
    if (lower.includes("report") || lower.includes("summary") || lower.includes("analyse") || lower.includes("analyze")) return "document_analysis";
    return "general_banking";
  }

  it("classifies KYC queries as compliance", () => {
    expect(classifyTask("What KYC documents are required?")).toBe("compliance");
  });

  it("classifies contract queries as contract_review", () => {
    expect(classifyTask("Analyse this loan agreement clause")).toBe("contract_review");
  });

  it("classifies loan queries as credit_analysis", () => {
    expect(classifyTask("What is the DSCR requirement for this loan?")).toBe("credit_analysis");
  });

  it("classifies fraud queries as fraud_detection", () => {
    expect(classifyTask("This transaction looks suspicious")).toBe("fraud_detection");
  });

  it("defaults to general_banking for unclassified queries", () => {
    expect(classifyTask("Hello, how are you?")).toBe("general_banking");
  });
});

// ── Data Classification Tests ─────────────────────────────────────────────────
describe("Data Classification Logic", () => {
  function classifyData(message: string, hasPII: boolean): string {
    if (hasPII) return "RESTRICTED";
    const lower = message.toLowerCase();
    if (lower.includes("confidential") || lower.includes("secret") || lower.includes("internal only")) return "CONFIDENTIAL";
    if (lower.includes("internal") || lower.includes("employee") || lower.includes("staff")) return "INTERNAL";
    return "PUBLIC";
  }

  it("classifies PII-containing messages as RESTRICTED", () => {
    expect(classifyData("Customer data", true)).toBe("RESTRICTED");
  });

  it("classifies confidential messages correctly", () => {
    expect(classifyData("This is confidential information", false)).toBe("CONFIDENTIAL");
  });

  it("classifies internal messages correctly", () => {
    expect(classifyData("Internal staff policy", false)).toBe("INTERNAL");
  });

  it("classifies public messages correctly", () => {
    expect(classifyData("What are the KYC requirements?", false)).toBe("PUBLIC");
  });
});
