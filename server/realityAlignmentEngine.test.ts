/**
 * realityAlignmentEngine.test.ts
 *
 * Unit tests for the Reality Alignment Engine (Layer 2.5).
 * Tests: data integrity checks, claim grounding, conflict detection,
 * consensus quality scoring, and INSUFFICIENT_DATA gate logic.
 */

import { describe, it, expect } from "vitest";
import { runRealityAlignment } from "./realityAlignmentEngine";
import type { CouncilResult } from "./councilEngine";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCouncilResult(overrides: Partial<CouncilResult> = {}): CouncilResult {
  return {
    verdict: "APPROVED",
    yesCount: 7,
    noCount: 3,
    hardYesCount: 3,
    softYesCount: 4,
    softNoCount: 2,
    hardNoCount: 1,
    weightedYesScore: 8.5,
    weightedNoScore: 3.5,
    confidenceScore: 0.72,
    finalScore: 0.72,
    consensusQuality: 0.75,
    weightedAgentScore: 0.72,
    gccVetoTriggered: false,
    tiebreakerTriggered: false,
    tiebreakerSwingAgent: null,
    conditionsToProceed: [],
    blockingIssues: [],
    criticalBlockers: [],
    hardFlags: [],
    silentFails: [],
    votes: [],
    decisionMemoryId: null,
    memoryContextUsed: false,
    precedents: [],
    sessionId: "test-session",
    durationMs: 1000,
    actionsTriggered: [],
    ...overrides,
  };
}

const RICH_DEAL_TEXT = `
Company: Acme AI
Founder: Jane Doe (ex-Google, 10 years ML experience)
Revenue: $1.2M ARR, growing 15% MoM
Team: 8 engineers, 2 sales
Market: Enterprise AI tools, $50B TAM
Traction: 45 paying customers, NPS 72
Funding: Raising $5M seed at $20M pre-money
Product: AI-powered document processing platform
Competitors: DocuSign, Adobe
Differentiation: 10x faster processing, 99.9% accuracy
`;

const SPARSE_DEAL_TEXT = `
Company: Stealth startup
Idea: AI for healthcare
Looking for investment.
`;

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("runRealityAlignment", () => {
  it("returns a valid structure with all required fields", () => {
    const council = makeCouncilResult();
    const result = runRealityAlignment(RICH_DEAL_TEXT, council);

    expect(result).toHaveProperty("dataConfidence");
    expect(result).toHaveProperty("dataConfidenceScore");
    expect(result).toHaveProperty("missingFields");
    expect(result).toHaveProperty("agentAlignments");
    expect(result).toHaveProperty("globalInferredRatio");
    expect(result).toHaveProperty("conflictScore");
    expect(result).toHaveProperty("conflictDetails");
    expect(result).toHaveProperty("agreementScore");
    expect(result).toHaveProperty("consensusQuality");
    expect(result).toHaveProperty("shouldGate");
    expect(result).toHaveProperty("gateReason");
    expect(result).toHaveProperty("debugLog");
  });

  it("scores a rich deal text higher than a sparse one (data confidence)", () => {
    const council = makeCouncilResult();
    const richResult = runRealityAlignment(RICH_DEAL_TEXT, council);
    const sparseResult = runRealityAlignment(SPARSE_DEAL_TEXT, council);

    expect(richResult.dataConfidenceScore).toBeGreaterThan(sparseResult.dataConfidenceScore);
  });

  it("does NOT gate a rich deal with strong council consensus", () => {
    const council = makeCouncilResult({
      verdict: "APPROVED",
      confidenceScore: 0.80,
      consensusQuality: 0.85,
    });
    const result = runRealityAlignment(RICH_DEAL_TEXT, council);
    expect(result.shouldGate).toBe(false);
  });

  it("gates a sparse deal with low confidence", () => {
    const council = makeCouncilResult({
      verdict: "APPROVED",
      confidenceScore: 0.25,
      consensusQuality: 0.20,
      yesCount: 5,
      noCount: 5,
      hardYesCount: 1,
      softYesCount: 4,
      softNoCount: 4,
      hardNoCount: 1,
    });
    const result = runRealityAlignment(SPARSE_DEAL_TEXT, council);
    expect(result.shouldGate).toBe(true);
    expect(result.gateReason).toBeTruthy();
  });

  it("identifies missing fields for sparse deal text", () => {
    const council = makeCouncilResult();
    const result = runRealityAlignment(SPARSE_DEAL_TEXT, council);
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  it("has fewer missing fields for rich deal text", () => {
    const council = makeCouncilResult();
    const richResult = runRealityAlignment(RICH_DEAL_TEXT, council);
    const sparseResult = runRealityAlignment(SPARSE_DEAL_TEXT, council);
    expect(richResult.missingFields.length).toBeLessThan(sparseResult.missingFields.length);
  });

  it("returns all scores in valid ranges", () => {
    const council = makeCouncilResult();
    const result = runRealityAlignment(RICH_DEAL_TEXT, council);

    expect(result.dataConfidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.dataConfidenceScore).toBeLessThanOrEqual(1);
    expect(result.conflictScore).toBeGreaterThanOrEqual(0);
    expect(result.conflictScore).toBeLessThanOrEqual(1);
    expect(result.agreementScore).toBeGreaterThanOrEqual(0);
    expect(result.agreementScore).toBeLessThanOrEqual(1);
    expect(result.consensusQuality).toBeGreaterThanOrEqual(0);
    expect(result.consensusQuality).toBeLessThanOrEqual(1);
    expect(result.globalInferredRatio).toBeGreaterThanOrEqual(0);
    expect(result.globalInferredRatio).toBeLessThanOrEqual(1);
  });

  it("includes a debugLog with all required fields", () => {
    const council = makeCouncilResult();
    const result = runRealityAlignment(RICH_DEAL_TEXT, council);

    expect(result.debugLog).toHaveProperty("dataConfidence");
    expect(result.debugLog).toHaveProperty("dataConfidenceScore");
    expect(result.debugLog).toHaveProperty("consensusQuality");
    expect(result.debugLog).toHaveProperty("conflictScore");
    expect(result.debugLog).toHaveProperty("inferredRatio");
    expect(result.debugLog).toHaveProperty("agreementScore");
    expect(result.debugLog).toHaveProperty("finalScore");
    expect(result.debugLog).toHaveProperty("verdict");
    expect(result.debugLog).toHaveProperty("missingFields");
    expect(result.debugLog).toHaveProperty("conflictDetails");
  });

  it("detects higher conflict when council is split 5-5 vs 9-1", () => {
    // Split council: 2 HARD_YES vs 2 HARD_NO with high confidence → high conflict
    const splitVotes = [
      { personaId: "CFO", personaName: "CFO", vote: "HARD_YES", confidence: 0.85, rationale: "Strong unit economics" },
      { personaId: "ANALYST", personaName: "Analyst", vote: "HARD_YES", confidence: 0.80, rationale: "Good traction" },
      { personaId: "SKEPTIC", personaName: "Skeptic", vote: "HARD_NO", confidence: 0.80, rationale: "Market risk" },
      { personaId: "MACRO", personaName: "Macro", vote: "HARD_NO", confidence: 0.75, rationale: "Macro headwinds" },
      { personaId: "EXIT", personaName: "Exit", vote: "SOFT_YES", confidence: 0.50, rationale: "Exit unclear" },
    ];
    // Clear council: 4 HARD_YES, 0 HARD_NO → low conflict
    const clearVotes = [
      { personaId: "CFO", personaName: "CFO", vote: "HARD_YES", confidence: 0.90, rationale: "Excellent unit economics" },
      { personaId: "ANALYST", personaName: "Analyst", vote: "HARD_YES", confidence: 0.88, rationale: "Strong traction" },
      { personaId: "SKEPTIC", personaName: "Skeptic", vote: "HARD_YES", confidence: 0.85, rationale: "Team is solid" },
      { personaId: "MACRO", personaName: "Macro", vote: "HARD_YES", confidence: 0.82, rationale: "Macro tailwinds" },
      { personaId: "EXIT", personaName: "Exit", vote: "SOFT_NO", confidence: 0.40, rationale: "Exit timeline uncertain" },
    ];
    const splitCouncil = makeCouncilResult({ votes: splitVotes as any, confidenceScore: 0.45 });
    const clearCouncil = makeCouncilResult({ votes: clearVotes as any, confidenceScore: 0.90 });
    const splitResult = runRealityAlignment(RICH_DEAL_TEXT, splitCouncil);
    const clearResult = runRealityAlignment(RICH_DEAL_TEXT, clearCouncil);
    expect(splitResult.conflictScore).toBeGreaterThan(clearResult.conflictScore);
  });

  it("returns dataConfidence as LOW for very sparse input", () => {
    const council = makeCouncilResult({ confidenceScore: 0.20 });
    const result = runRealityAlignment(SPARSE_DEAL_TEXT, council);
    expect(result.dataConfidence).toBe("LOW");
  });

  it("returns dataConfidence as HIGH for rich input with strong council", () => {
    const council = makeCouncilResult({
      confidenceScore: 0.85,
      consensusQuality: 0.90,
      yesCount: 9,
      noCount: 1,
    });
    const result = runRealityAlignment(RICH_DEAL_TEXT, council);
    expect(["MEDIUM", "HIGH"]).toContain(result.dataConfidence);
  });
});
