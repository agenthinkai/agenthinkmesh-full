/**
 * server/procurementPdf.test.ts
 * Tests for procurement PDF and CSV export generators.
 */

import { describe, it, expect } from "vitest";
import { generateProcurementPdf, generateProcurementCsv } from "./procurementPdf";
import type { ProcurementReportInput } from "./procurementPdf";

// ── Minimal fixture ────────────────────────────────────────────────────────────

const SAMPLE_REPORT: ProcurementReportInput = {
  vendorName: "Acme Solutions Ltd.",
  category: "IT Infrastructure",
  insufficientData: false,
  finalRecommendation: "CONDITIONAL_APPROVAL",
  recommendationRationale: "Vendor meets most technical requirements but lacks ISO 27001 certification.",
  overallScore: 6.8,
  overallConfidence: "Medium",
  generatedAt: 1700000000000,
  agentScores: [
    {
      agentId: "financial_analyst",
      agentName: "Financial Analyst",
      agentRole: "Financial Stability Assessment",
      score: 7.2,
      verdict: "APPROVE",
      confidence: "High",
      keyReasoning: "Vendor has solid financials with 5-year track record.",
      topRisks: ["Revenue concentration in single client"],
      redFlags: [],
      positives: ["Profitable for 5 consecutive years"],
    },
    {
      agentId: "devils_advocate",
      agentName: "Devil's Advocate",
      agentRole: "Adversarial Challenge",
      score: 3.5,
      verdict: "REJECT",
      confidence: "Medium",
      keyReasoning: "Vendor has no ISO 27001 certification and limited enterprise references.",
      topRisks: ["No security certification", "Small team size"],
      redFlags: ["No enterprise references above $1M contract"],
      positives: [],
    },
  ],
  consensus: {
    averageScore: 6.8,
    approveCount: 1,
    rejectCount: 1,
    conditionalCount: 0,
    majorDisagreements: ["Financial vs Security scoring gap of 3.7 points"],
    highestRiskAreas: ["Security & Compliance", "Scalability"],
    overallConfidence: "Medium",
    decisionRationale: "Majority agents approve with conditions. Security gap is the primary blocker.",
    conflictingScoringPairs: ["Financial Analyst (7.2) vs Devil's Advocate (3.5)"],
  },
  topDecisionDrivers: [
    "Vendor has proven financial stability",
    "Missing ISO 27001 certification is a hard requirement",
    "Competitive pricing within budget",
  ],
  topRisks: [
    "No ISO 27001 certification",
    "Limited enterprise references",
    "Single-client revenue concentration",
  ],
  suggestedNegotiationPoints: [
    "Require ISO 27001 certification within 6 months as contract condition",
    "Include SLA penalties for uptime below 99.5%",
    "Add data residency clause for GCC compliance",
  ],
  missingRequiredInformation: [
    "ISO 27001 certification status",
    "Full list of enterprise clients",
  ],
  triage: {
    relevance: "High",
    dataQuality: "Medium",
    basicRiskFlags: ["Missing security certification"],
    missingFields: ["ISO 27001 status"],
    summary: "Proposal is relevant but lacks key compliance documentation.",
  },
};

// ── PDF tests ──────────────────────────────────────────────────────────────────

describe("generateProcurementPdf", () => {
  it("returns a non-empty Buffer", async () => {
    const result = await generateProcurementPdf(SAMPLE_REPORT);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(1000);
  }, 30_000);

  it("starts with PDF magic bytes %PDF", async () => {
    const result = await generateProcurementPdf(SAMPLE_REPORT);
    const header = result.slice(0, 4).toString("ascii");
    expect(header).toBe("%PDF");
  }, 30_000);

  it("handles REJECT recommendation without throwing", async () => {
    const rejectReport: ProcurementReportInput = {
      ...SAMPLE_REPORT,
      finalRecommendation: "REJECT",
      overallScore: 2.1,
      overallConfidence: "High",
    };
    const result = await generateProcurementPdf(rejectReport);
    expect(result.length).toBeGreaterThan(1000);
  }, 30_000);

  it("handles INSUFFICIENT_DATA report without throwing", async () => {
    const insufficientReport: ProcurementReportInput = {
      ...SAMPLE_REPORT,
      insufficientData: true,
      finalRecommendation: "INSUFFICIENT_DATA",
      agentScores: [],
      topDecisionDrivers: [],
      topRisks: [],
      suggestedNegotiationPoints: [],
    };
    const result = await generateProcurementPdf(insufficientReport);
    expect(result.length).toBeGreaterThan(500);
  }, 30_000);
});

// ── CSV tests ──────────────────────────────────────────────────────────────────

describe("generateProcurementCsv", () => {
  it("returns a non-empty string", () => {
    const csv = generateProcurementCsv(SAMPLE_REPORT);
    expect(typeof csv).toBe("string");
    expect(csv.length).toBeGreaterThan(100);
  });

  it("includes a header row", () => {
    const csv = generateProcurementCsv(SAMPLE_REPORT);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe("Section,Field,Value");
  });

  it("includes vendor name in output", () => {
    const csv = generateProcurementCsv(SAMPLE_REPORT);
    expect(csv).toContain("Acme Solutions Ltd.");
  });

  it("includes final recommendation", () => {
    const csv = generateProcurementCsv(SAMPLE_REPORT);
    expect(csv).toContain("CONDITIONAL_APPROVAL");
  });

  it("includes agent evaluations", () => {
    const csv = generateProcurementCsv(SAMPLE_REPORT);
    expect(csv).toContain("Financial Analyst");
    expect(csv).toContain("Devil's Advocate");
  });

  it("includes negotiation points", () => {
    const csv = generateProcurementCsv(SAMPLE_REPORT);
    expect(csv).toContain("Negotiation Points");
    expect(csv).toContain("ISO 27001");
  });

  it("escapes commas in values correctly", () => {
    const reportWithComma: ProcurementReportInput = {
      ...SAMPLE_REPORT,
      vendorName: "Acme, Inc.",
    };
    const csv = generateProcurementCsv(reportWithComma);
    expect(csv).toContain('"Acme, Inc."');
  });
});
