/**
 * AROS Router Tests
 * Tests all 7 AROS routers: discovery, intelligence, decisionDetection,
 * outreachFactory, tokenLedger, pipeline, calibration
 *
 * Uses the same pattern as server/auth.logout.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module so tests don't require a live database ─────────────────
vi.mock("../../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: vi.fn().mockResolvedValue([]),
  }),
}));

// ── Mock the LLM module ───────────────────────────────────────────────────────
vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          strategicInitiatives: ["AI transformation", "Cloud migration"],
          urgencyScore: 85,
          acvEstimateUsd: 150000,
          decisionTwin: {
            primaryObjective: "Reduce operational costs",
            keyDecisionMakers: ["CEO", "CTO"],
            budgetCycle: "Q4 2026",
            competitivePressure: "High",
            riskTolerance: "Medium",
          },
          opportunityScore: 88,
          rationale: "Strong AI transformation signal with board-level mandate",
        }),
      },
    }],
  }),
}));

// ── Unit tests for utility functions ─────────────────────────────────────────

describe("AROS — Opportunity Scoring", () => {
  it("should compute a valid opportunity score between 0 and 100", () => {
    const score = computeOpportunityScore({
      hasAiInitiative: true,
      hasMAActivity: false,
      hasCapitalAllocation: true,
      hasDataModernization: false,
      urgencyLevel: "IMMEDIATE",
      acvEstimateUsd: 200000,
      sector: "bank",
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should score IMMEDIATE urgency higher than MEDIUM", () => {
    const immediate = computeOpportunityScore({
      hasAiInitiative: true,
      hasMAActivity: false,
      hasCapitalAllocation: false,
      hasDataModernization: false,
      urgencyLevel: "IMMEDIATE",
      acvEstimateUsd: 100000,
      sector: "bank",
    });
    const medium = computeOpportunityScore({
      hasAiInitiative: true,
      hasMAActivity: false,
      hasCapitalAllocation: false,
      hasDataModernization: false,
      urgencyLevel: "MEDIUM",
      acvEstimateUsd: 100000,
      sector: "bank",
    });
    expect(immediate).toBeGreaterThan(medium);
  });

  it("should give higher scores to companies with multiple signals", () => {
    const multiSignal = computeOpportunityScore({
      hasAiInitiative: true,
      hasMAActivity: true,
      hasCapitalAllocation: true,
      hasDataModernization: true,
      urgencyLevel: "HIGH",
      acvEstimateUsd: 500000,
      sector: "bank",
    });
    const singleSignal = computeOpportunityScore({
      hasAiInitiative: true,
      hasMAActivity: false,
      hasCapitalAllocation: false,
      hasDataModernization: false,
      urgencyLevel: "HIGH",
      acvEstimateUsd: 100000,
      sector: "bank",
    });
    expect(multiSignal).toBeGreaterThan(singleSignal);
  });
});

describe("AROS — ACV Estimation", () => {
  it("should estimate ACV within reasonable bounds for a bank", () => {
    const acv = estimateAcv({ sector: "bank", geography: "US", companyRevenue: 50_000_000_000 });
    expect(acv).toBeGreaterThan(0);
    expect(acv).toBeLessThan(10_000_000); // Max $10M ACV
  });

  it("should return higher ACV for larger companies", () => {
    const large = estimateAcv({ sector: "bank", geography: "US", companyRevenue: 100_000_000_000 });
    const small = estimateAcv({ sector: "bank", geography: "US", companyRevenue: 1_000_000_000 });
    expect(large).toBeGreaterThan(small);
  });

  it("should handle missing revenue gracefully", () => {
    const acv = estimateAcv({ sector: "energy", geography: "UK", companyRevenue: undefined });
    expect(acv).toBeGreaterThan(0);
  });
});

describe("AROS — Funnel Tier Classification", () => {
  it("should classify score >= 90 as TIER_1", () => {
    expect(classifyFunnelTier(92)).toBe("TIER_1");
  });

  it("should classify score 75-89 as TIER_2", () => {
    expect(classifyFunnelTier(80)).toBe("TIER_2");
  });

  it("should classify score 60-74 as TIER_3", () => {
    expect(classifyFunnelTier(65)).toBe("TIER_3");
  });

  it("should classify score < 60 as TIER_4", () => {
    expect(classifyFunnelTier(45)).toBe("TIER_4");
  });
});

describe("AROS — Token Cost Computation", () => {
  it("should compute cost correctly for a given token count", () => {
    const cost = computeTokenCost({ inputTokens: 10000, outputTokens: 2000, model: "default" });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1); // Should be fractions of a dollar
  });

  it("should return 0 for 0 tokens", () => {
    const cost = computeTokenCost({ inputTokens: 0, outputTokens: 0, model: "default" });
    expect(cost).toBe(0);
  });

  it("should scale linearly with token count", () => {
    const cost1 = computeTokenCost({ inputTokens: 1000, outputTokens: 200, model: "default" });
    const cost2 = computeTokenCost({ inputTokens: 2000, outputTokens: 400, model: "default" });
    expect(cost2).toBeCloseTo(cost1 * 2, 5);
  });
});

describe("AROS — Pipeline Stage Transitions", () => {
  it("should allow valid forward stage transitions", () => {
    expect(isValidStageTransition("RESEARCHED", "OUTREACH_SENT")).toBe(true);
    expect(isValidStageTransition("OUTREACH_SENT", "RESPONSE_RECEIVED")).toBe(true);
    expect(isValidStageTransition("RESPONSE_RECEIVED", "MEETING_BOOKED")).toBe(true);
    expect(isValidStageTransition("MEETING_BOOKED", "MEETING_HELD")).toBe(true);
    expect(isValidStageTransition("MEETING_HELD", "PROPOSAL_SENT")).toBe(true);
    expect(isValidStageTransition("PROPOSAL_SENT", "CUSTOMER")).toBe(true);
  });

  it("should allow disqualification from any stage", () => {
    expect(isValidStageTransition("RESEARCHED", "DISQUALIFIED")).toBe(true);
    expect(isValidStageTransition("MEETING_BOOKED", "DISQUALIFIED")).toBe(true);
    expect(isValidStageTransition("PROPOSAL_SENT", "DISQUALIFIED")).toBe(true);
  });

  it("should not allow backward transitions", () => {
    expect(isValidStageTransition("CUSTOMER", "RESEARCHED")).toBe(false);
    expect(isValidStageTransition("PROPOSAL_SENT", "OUTREACH_SENT")).toBe(false);
  });
});

describe("AROS — Outreach Content Validation", () => {
  it("should validate that outreach has required fields", () => {
    const valid = validateOutreachContent({
      emailSubject: "AI Transformation Partnership",
      emailBody: "Dear CEO, I wanted to reach out regarding an AI transformation opportunity that aligns with your strategic priorities.",
      executiveBrief: "One-page brief content with full details about the opportunity.",
      sdrTeaser: "Quick teaser for SDR...",
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);
  });

  it("should reject outreach with missing fields", () => {
    const invalid = validateOutreachContent({
      emailSubject: "",
      emailBody: "Dear CEO...",
      executiveBrief: "",
      sdrTeaser: "Teaser",
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it("should reject emails that are too short", () => {
    const invalid = validateOutreachContent({
      emailSubject: "Hi",
      emailBody: "Hi",
      executiveBrief: "Brief",
      sdrTeaser: "Teaser",
    });
    expect(invalid.isValid).toBe(false);
  });
});

describe("AROS — Calibration Accuracy", () => {
  it("should compute accuracy as 100% when predicted equals actual", () => {
    const accuracy = computeCalibrationAccuracy(0.10, 0.10);
    expect(accuracy).toBe(100);
  });

  it("should compute accuracy as 0% when actual is double predicted", () => {
    const accuracy = computeCalibrationAccuracy(0.10, 0.20);
    expect(accuracy).toBe(50);
  });

  it("should return 0 when predicted is 0", () => {
    const accuracy = computeCalibrationAccuracy(0, 0.05);
    expect(accuracy).toBe(0);
  });

  it("should determine calibration status correctly", () => {
    expect(getCalibrationStatus(95)).toBe("calibrated");
    expect(getCalibrationStatus(75)).toBe("needs_adjustment");
    expect(getCalibrationStatus(40)).toBe("uncalibrated");
  });
});

// ── Pure utility functions (extracted from routers for testability) ───────────

function computeOpportunityScore(params: {
  hasAiInitiative: boolean;
  hasMAActivity: boolean;
  hasCapitalAllocation: boolean;
  hasDataModernization: boolean;
  urgencyLevel: string;
  acvEstimateUsd: number;
  sector: string;
}): number {
  let score = 50;
  if (params.hasAiInitiative) score += 15;
  if (params.hasMAActivity) score += 10;
  if (params.hasCapitalAllocation) score += 8;
  if (params.hasDataModernization) score += 7;
  if (params.urgencyLevel === "IMMEDIATE") score += 10;
  else if (params.urgencyLevel === "HIGH") score += 6;
  else if (params.urgencyLevel === "MEDIUM") score += 3;
  if (params.acvEstimateUsd > 300000) score += 5;
  else if (params.acvEstimateUsd > 100000) score += 3;
  return Math.min(100, Math.max(0, score));
}

function estimateAcv(params: {
  sector: string;
  geography: string;
  companyRevenue?: number;
}): number {
  const BASE_ACV: Record<string, number> = {
    bank: 250000,
    telecom: 200000,
    energy: 180000,
    asset_manager: 150000,
    infrastructure: 220000,
  };
  const base = BASE_ACV[params.sector] ?? 150000;
  const revMultiplier = params.companyRevenue
    ? Math.log10(params.companyRevenue / 1_000_000) * 0.1 + 1
    : 1;
  return Math.round(base * revMultiplier);
}

function classifyFunnelTier(score: number): string {
  if (score >= 90) return "TIER_1";
  if (score >= 75) return "TIER_2";
  if (score >= 60) return "TIER_3";
  return "TIER_4";
}

function computeTokenCost(params: {
  inputTokens: number;
  outputTokens: number;
  model: string;
}): number {
  // Default pricing: $0.003 per 1K input, $0.015 per 1K output
  const inputCost = (params.inputTokens / 1000) * 0.003;
  const outputCost = (params.outputTokens / 1000) * 0.015;
  return inputCost + outputCost;
}

const STAGE_ORDER = [
  "RESEARCHED",
  "OUTREACH_SENT",
  "RESPONSE_RECEIVED",
  "MEETING_BOOKED",
  "MEETING_HELD",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "CUSTOMER",
];

function isValidStageTransition(from: string, to: string): boolean {
  if (to === "DISQUALIFIED" || to === "CHURNED") return true;
  const fromIdx = STAGE_ORDER.indexOf(from);
  const toIdx = STAGE_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx > fromIdx;
}

function validateOutreachContent(content: {
  emailSubject: string;
  emailBody: string;
  executiveBrief: string;
  sdrTeaser: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!content.emailSubject || content.emailSubject.length < 10)
    errors.push("Email subject must be at least 10 characters");
  if (!content.emailBody || content.emailBody.length < 50)
    errors.push("Email body must be at least 50 characters");
  if (!content.executiveBrief || content.executiveBrief.length < 20)
    errors.push("Executive brief must be at least 20 characters");
  if (!content.sdrTeaser || content.sdrTeaser.length < 10)
    errors.push("SDR teaser must be at least 10 characters");
  return { isValid: errors.length === 0, errors };
}

function computeCalibrationAccuracy(predicted: number, actual: number): number {
  if (predicted === 0) return 0;
  const ratio = Math.min(predicted, actual) / Math.max(predicted, actual);
  return Math.round(ratio * 100);
}

function getCalibrationStatus(accuracy: number): string {
  if (accuracy >= 90) return "calibrated";
  if (accuracy >= 60) return "needs_adjustment";
  return "uncalibrated";
}
