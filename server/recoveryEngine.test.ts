/**
 * recoveryEngine.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the Deal Recovery Engine.
 *
 * Verifies:
 *   1. Output shape — all 5 sections present with correct types
 *   2. Governance invariant — probability values clamped to 0–99
 *   3. Hard terminal flag cap — probability capped at 25% for TERMINAL_FLAGS
 *   4. Path labels are always A, B, C
 *   5. Fallback result is well-formed when LLM parse fails
 *   6. generateRecovery procedure is callable via router (smoke test)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies at module level (hoisted) ─────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock DB — not used by recoveryEngine but imported at module level by dealScreener router
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock all PDF generation — imported at module level by dealScreener router
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
vi.mock("./repairBriefPdf", () => ({ generateRepairBriefPdf: vi.fn() }));
vi.mock("./recoveryMemoPdf", () => ({ generateRecoveryMemoPdf: vi.fn() }));
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
vi.mock("./tier0Ingestion", () => ({ getSurfacedSignals: vi.fn().mockResolvedValue([]) }));
vi.mock("./dealDedup", () => ({ checkDuplicate: vi.fn().mockResolvedValue({ isDuplicate: false, dealHash: "abc123" }) }));
vi.mock("./triageEngine", () => ({ runTriage: vi.fn().mockResolvedValue({ decision: "PROCEED", confidence: 0.9, reason: "", durationMs: 10 }) }));
vi.mock("./normalizeStressTestReportInput", () => ({
  normalizeStressTestReportInput: vi.fn((x: unknown) => x),
  logValidationError: vi.fn(),
}));
vi.mock("./comparisonEngine", () => ({ runComparison: vi.fn() }));

// Import AFTER mocks are registered
import { invokeLLM } from "./_core/llm";
import { generateRecovery, type RecoveryEngineInput } from "./recoveryEngine";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      email: "test@example.com",
      name: "Test User",
      role: "user",
      planTier: "pro",
      openId: "test-open-id",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as TrpcContext;
}

function makeRecoveryInput(overrides: Partial<RecoveryEngineInput> = {}): RecoveryEngineInput {
  return {
    dealName: "TestCo Series A",
    dealText: "A fintech startup seeking $5M Series A investment.",
    councilOutcome: "Verdict: REJECTED · 2/10 YES · Confidence: 15%\nTop blockers: sanctions exposure; no audited financials",
    verdict: "REJECTED",
    terminalFlags: ["sanctions_exposure"],
    classificationRationale: "Deal is fundamentally non-viable due to OFAC sanctions exposure.",
    councilMode: "global_vc",
    ...overrides,
  };
}

/** Builds a minimal valid RecoveryEngineResult JSON string */
function makeValidRecoveryJson(overrides: Record<string, unknown> = {}): string {
  const base = {
    failureAnalysis: {
      primaryFailureMode: "Sanctions exposure blocks institutional participation.",
      rootCauses: [{
        category: "REGULATORY",
        description: "OFAC sanctions exposure on founding team member.",
        governingBlocker: "SANCTIONS_EXPOSURE",
        councilConcern: "Institutional liability — cannot proceed.",
        constitutionalFinding: "AgenThink Mesh Constitution §4.2 — Terminal blocker.",
      }],
      whyRepairIsInsufficient: "Sanctions cannot be resolved at deal level.",
    },
    terminalBlockers: [{
      flag: "sanctions_exposure",
      label: "SANCTIONS EXPOSURE",
      governingBlocker: "SANCTIONS_EXPOSURE",
      councilConcern: "Institutional liability.",
      constitutionalFinding: "AgenThink Mesh Constitution §4.2",
      residualRisk: "Terminal — no deal-level mitigation.",
    }],
    recoveryPathA: {
      label: "A",
      title: "Sanctions Resolution Path",
      description: "Await OFAC delisting and resubmit.",
      governingBlocker: "SANCTIONS_EXPOSURE",
      councilConcern: "Institutional liability.",
      constitutionalFinding: "AgenThink Mesh Constitution §4.2",
      probabilityPct: 15,
      estimatedTimeline: "12–24 months",
      milestones: ["Obtain OFAC legal opinion", "Confirm delisting", "Resubmit"],
    },
    recoveryPathB: {
      label: "B",
      title: "Alternative Sponsor Path",
      description: "Replace sanctioned team member and resubmit under clean sponsor.",
      governingBlocker: "SANCTIONS_EXPOSURE",
      councilConcern: "Sponsor qualification.",
      constitutionalFinding: "AgenThink Mesh Constitution §2.4",
      probabilityPct: 12,
      estimatedTimeline: "6–12 months",
      milestones: ["Replace team member", "Obtain clean compliance opinion", "Resubmit"],
    },
    recoveryPathC: {
      label: "C",
      title: "Restructure via Clean Entity",
      description: "Transfer IP to a new clean entity with no sanctions exposure.",
      governingBlocker: "SANCTIONS_EXPOSURE",
      councilConcern: "Structural contamination.",
      constitutionalFinding: "AgenThink Mesh Constitution §3.1",
      probabilityPct: 8,
      estimatedTimeline: "9–18 months",
      milestones: ["Establish clean entity", "Transfer IP", "Obtain legal clearance", "Resubmit"],
    },
    reentryConditions: [{
      condition: "Full OFAC delisting confirmed",
      measurableThreshold: "Written OFAC delisting confirmation",
      verificationMethod: "External legal review",
      timeframe: "Before resubmission",
    }],
    conditionsForReconsideration: [
      "Full OFAC delisting confirmed",
      "Clean compliance opinion from external counsel",
    ],
    suggestedNextReviewDate: "Q1 2027",
    overallProbabilityOfRecovery: {
      pct: 12,
      rationale: "Sanctions exposure is terminal — low probability until resolved.",
      mostViablePath: "A",
    },
    requiredStructuralChanges: [{
      rank: 1,
      change: "Resolve OFAC sanctions exposure",
      rationale: "Terminal blocker — no path forward without resolution.",
      governingBlocker: "SANCTIONS_EXPOSURE",
      councilConcern: "Institutional liability.",
    }],
    ...overrides,
  };
  return JSON.stringify(base);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateRecovery — output shape", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: makeValidRecoveryJson() } }],
    } as any);
  });

  it("returns all 5 required sections", async () => {
    const result = await generateRecovery(makeRecoveryInput());
    expect(result.failureAnalysis).toBeDefined();
    expect(result.terminalBlockers).toBeDefined();
    expect(result.recoveryPathA).toBeDefined();
    expect(result.recoveryPathB).toBeDefined();
    expect(result.recoveryPathC).toBeDefined();
    expect(result.reentryConditions).toBeDefined();
    expect(result.conditionsForReconsideration).toBeDefined();
    expect(result.suggestedNextReviewDate).toBeDefined();
    expect(result.overallProbabilityOfRecovery).toBeDefined();
    expect(result.requiredStructuralChanges).toBeDefined();
  });

  it("returns correct path labels A, B, C", async () => {
    const result = await generateRecovery(makeRecoveryInput());
    expect(result.recoveryPathA.label).toBe("A");
    expect(result.recoveryPathB.label).toBe("B");
    expect(result.recoveryPathC.label).toBe("C");
  });

  it("failureAnalysis has primaryFailureMode and rootCauses", async () => {
    const result = await generateRecovery(makeRecoveryInput());
    expect(typeof result.failureAnalysis.primaryFailureMode).toBe("string");
    expect(Array.isArray(result.failureAnalysis.rootCauses)).toBe(true);
    expect(typeof result.failureAnalysis.whyRepairIsInsufficient).toBe("string");
  });

  it("reentryConditions are measurable (have threshold and verification)", async () => {
    const result = await generateRecovery(makeRecoveryInput());
    result.reentryConditions.forEach((rc) => {
      expect(typeof rc.condition).toBe("string");
      expect(typeof rc.measurableThreshold).toBe("string");
      expect(typeof rc.verificationMethod).toBe("string");
      expect(typeof rc.timeframe).toBe("string");
    });
  });

  it("requiredStructuralChanges have rank and citation fields", async () => {
    const result = await generateRecovery(makeRecoveryInput());
    result.requiredStructuralChanges.forEach((ch) => {
      expect(typeof ch.rank).toBe("number");
      expect(typeof ch.change).toBe("string");
      expect(typeof ch.governingBlocker).toBe("string");
      expect(typeof ch.councilConcern).toBe("string");
    });
  });
});

describe("generateRecovery — governance invariants", () => {
  it("clamps probability to 0–99 (never 100)", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: makeValidRecoveryJson({
        recoveryPathA: { label: "A", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 100, estimatedTimeline: "1y", milestones: [] },
        recoveryPathB: { label: "B", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 150, estimatedTimeline: "1y", milestones: [] },
        recoveryPathC: { label: "C", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 99, estimatedTimeline: "1y", milestones: [] },
        overallProbabilityOfRecovery: { pct: 100, rationale: "R", mostViablePath: "A" },
      }) } }],
    } as any);
    const result = await generateRecovery(makeRecoveryInput({ terminalFlags: [] }));
    expect(result.recoveryPathA.probabilityPct).toBeLessThanOrEqual(99);
    expect(result.recoveryPathB.probabilityPct).toBeLessThanOrEqual(99);
    expect(result.overallProbabilityOfRecovery.pct).toBeLessThanOrEqual(99);
  });

  it("caps probability at 25% for hard terminal flags (TERMINAL_FLAGS set)", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: makeValidRecoveryJson({
        recoveryPathA: { label: "A", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 60, estimatedTimeline: "1y", milestones: [] },
        recoveryPathB: { label: "B", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 55, estimatedTimeline: "1y", milestones: [] },
        recoveryPathC: { label: "C", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 50, estimatedTimeline: "1y", milestones: [] },
        overallProbabilityOfRecovery: { pct: 58, rationale: "R", mostViablePath: "A" },
      }) } }],
    } as any);
    // "sanctions" is in TERMINAL_FLAGS (the canonical flag name)
    const result = await generateRecovery(makeRecoveryInput({ terminalFlags: ["sanctions"] }));
    expect(result.recoveryPathA.probabilityPct).toBeLessThanOrEqual(25);
    expect(result.recoveryPathB.probabilityPct).toBeLessThanOrEqual(25);
    expect(result.recoveryPathC.probabilityPct).toBeLessThanOrEqual(25);
    expect(result.overallProbabilityOfRecovery.pct).toBeLessThanOrEqual(25);
  });

  it("does not cap probability for non-terminal flags", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: makeValidRecoveryJson({
        recoveryPathA: { label: "A", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 45, estimatedTimeline: "1y", milestones: [] },
        recoveryPathB: { label: "B", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 40, estimatedTimeline: "1y", milestones: [] },
        recoveryPathC: { label: "C", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 35, estimatedTimeline: "1y", milestones: [] },
        overallProbabilityOfRecovery: { pct: 42, rationale: "R", mostViablePath: "A" },
      }) } }],
    } as any);
    // "default_risk" is RESCUABLE in rescuePolicy, so it is NOT in TERMINAL_FLAGS
    const result = await generateRecovery(makeRecoveryInput({ terminalFlags: ["default_risk"] }));
    expect(result.recoveryPathA.probabilityPct).toBeGreaterThan(25);
  });

  it("path labels are always A, B, C regardless of LLM output", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: makeValidRecoveryJson({
        recoveryPathA: { label: "X", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 10, estimatedTimeline: "1y", milestones: [] },
        recoveryPathB: { label: "Y", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 10, estimatedTimeline: "1y", milestones: [] },
        recoveryPathC: { label: "Z", title: "T", description: "D", governingBlocker: "B", councilConcern: "C", constitutionalFinding: "F", probabilityPct: 10, estimatedTimeline: "1y", milestones: [] },
      }) } }],
    } as any);
    const result = await generateRecovery(makeRecoveryInput({ terminalFlags: [] }));
    expect(result.recoveryPathA.label).toBe("A");
    expect(result.recoveryPathB.label).toBe("B");
    expect(result.recoveryPathC.label).toBe("C");
  });
});

describe("generateRecovery — fallback on parse failure", () => {
  it("returns a well-formed fallback when LLM returns unparseable content", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "INVALID JSON {{{{" } }],
    } as any);
    const result = await generateRecovery(makeRecoveryInput());
    // Fallback must still have all required sections
    expect(result.failureAnalysis).toBeDefined();
    expect(result.recoveryPathA).toBeDefined();
    expect(result.recoveryPathB).toBeDefined();
    expect(result.recoveryPathC).toBeDefined();
    expect(result.reentryConditions).toBeDefined();
    expect(result.overallProbabilityOfRecovery).toBeDefined();
    // Fallback labels must be correct
    expect(result.recoveryPathA.label).toBe("A");
    expect(result.recoveryPathB.label).toBe("B");
    expect(result.recoveryPathC.label).toBe("C");
    // Fallback probability must be within bounds
    expect(result.overallProbabilityOfRecovery.pct).toBeGreaterThanOrEqual(0);
    expect(result.overallProbabilityOfRecovery.pct).toBeLessThanOrEqual(99);
  });

  it("returns a well-formed fallback when LLM returns empty content", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "" } }],
    } as any);
    const result = await generateRecovery(makeRecoveryInput());
    expect(result.failureAnalysis).toBeDefined();
    expect(result.recoveryPathA.label).toBe("A");
  });
});

describe("generateRecovery — router procedure smoke test", () => {
  it("generateRecovery procedure is callable via router", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: makeValidRecoveryJson() } }],
    } as any);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.generateRecovery({
      dealName: "TestCo",
      dealText: "A fintech startup.",
      councilOutcome: "Verdict: REJECTED · 2/10 YES",
      verdict: "REJECTED",
      terminalFlags: ["sanctions"],
      classificationRationale: "Sanctions exposure.",
      councilMode: "global_vc",
    });
    expect(result.failureAnalysis).toBeDefined();
    expect(result.recoveryPathA.label).toBe("A");
    expect(result.overallProbabilityOfRecovery.pct).toBeLessThanOrEqual(25); // terminal flag cap
  });
});
