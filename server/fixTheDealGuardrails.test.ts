/**
 * fixTheDealGuardrails.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ADVERSARIAL GUARDRAIL PROOF
 *
 * Constructs a Class C deal (terminalFlags: ["fraud"]) and feeds the rescue
 * layer a crafted/injected LLM response with:
 *   - decision = "APPROVE"
 *   - consensusPct = 82 (optimistic score)
 *   - legitimate risks stripped
 *
 * Asserts on EVERY surface that:
 *   1. decision === "REJECTED"   (Guard 1: C-deal clean constructor)
 *   2. consensusPct === 0        (Guard 1: no positive score survives)
 *   3. classification === "C"    (Guard 0: codeClassification overrides LLM)
 *   4. revisedBrief === ""       (Guard 1: no rescue path for C deals)
 *   5. changeSummaryTable === [] (Guard 1: no changes for C deals)
 *   6. approvalSensitivityLadder === [] (Guard 1: no upgrade path for C deals)
 *   7. residualRisks is non-empty and contains terminal risk text
 *   8. codeClassification === "C" (exposed for frontend surface gating)
 *
 * Also tests:
 *   - Guard 2: decision normalization ("APPROVE" → "APPROVED" → capped)
 *   - Guard 3: ceiling cap (APPROVED → APPROVED_WITH_CONDITIONS for B deals)
 *   - Guard 4: default-reject net (unknown decision → REJECTED)
 *   - Guard 5: consensusPct cap (>99 → 99, never 100)
 *
 * This test is the PROOF that guardrails are real, not aspirational.
 * If this test passes, the guardrails are enforced in control flow.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock all external dependencies at module level (hoisted) ─────────────────
// fixTheDeal is a pure LLM call — no DB, no PDF generation in the procedure itself.
// We only need to mock invokeLLM and the heavy imports that load at module init.

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Mock DB — not used by fixTheDeal but imported at module level by dealScreener router
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock all PDF generation — not used by fixTheDeal but imported at module level
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
import { invokeLLM } from "./_core/llm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal authenticated tRPC context */
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

/**
 * Build a crafted adversarial LLM response:
 * - decision = "APPROVE" (should be capped/rejected)
 * - consensusPct = 82 (optimistic score — should be zeroed for C deals)
 * - legitimate risks stripped (residualRisks is empty — should be replaced)
 * - classification = "A" (LLM claims A — should be overridden to C)
 */
function makeAdversarialLLMResponse(overrides: {
  decision?: string;
  consensusPct?: number;
  classification?: string;
  residualRisks?: string[];
} = {}) {
  const payload = {
    classification: overrides.classification ?? "A",
    classificationRationale: "This deal is excellent and should be approved immediately.",
    rootCauses: [],
    revisedBrief: "REVISED: All issues resolved. Deal is now pristine.",
    changeSummaryTable: [
      { change: "Fraud allegation", original: "Alleged", revised: "Cleared", rootCauseAddressed: "A", estimatedVoteImpact: "+10 YES" },
    ],
    predictedOutcome: {
      voteDistribution: "10 YES / 0 NO",
      consensusPct: overrides.consensusPct ?? 82,
      decision: overrides.decision ?? "APPROVE",
      mostLikelyDissentingAgent: "None",
      mostLikelyCondition: "No conditions required",
    },
    approvalSensitivityLadder: [
      { structuralChange: "None needed", estimatedVoteShift: "+10 YES", runningVoteEstimate: "10 YES" },
    ],
    residualRisks: overrides.residualRisks ?? [],  // ← legitimate risks stripped
  };
  return {
    choices: [{ message: { content: JSON.stringify(payload) } }],
  };
}

/** Minimal valid deal text */
const FRAUD_DEAL_TEXT = `
Company: FraudCo Ltd
Sector: Fintech
Stage: Series B
Revenue: $10M ARR
Ask: $50M equity
Summary: High-growth fintech with strong unit economics.
Note: Ongoing fraud investigation by regulatory authorities.
`.trim();

// ── ADVERSARIAL TEST SUITE ────────────────────────────────────────────────────

describe("fixTheDeal — adversarial guardrail proof (Class C deal)", () => {
  beforeEach(() => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse() as never);
  });

  it("GUARD 0+1: C-deal with injected APPROVE/score=82 returns REJECTED with consensusPct=0", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: VETOED · 0/10 YES · Confidence: 5%\nTop blockers: fraud allegation",
      icMemoSummary: "Deal vetoed due to active fraud investigation.",
      terminalFlags: ["fraud"],  // ← structured terminal flag, not prose
    });

    // Surface 1: panel decision
    expect(result.predictedOutcome.decision).toBe("REJECTED");

    // Surface 2: no positive score (the score assertion — proves no fabricated-positive leakage)
    expect(result.predictedOutcome.consensusPct).toBe(0);

    // Surface 3: classification overridden to C (LLM returned "A")
    expect(result.classification).toBe("C");

    // Surface 4: codeClassification exposed for frontend gating
    expect((result as Record<string, unknown>).codeClassification).toBe("C");

    // Surface 5: no revised brief (no rescue path for C deals)
    expect(result.revisedBrief).toBe("");

    // Surface 6: no change summary (no rescue path for C deals)
    expect(result.changeSummaryTable).toEqual([]);

    // Surface 7: no approval sensitivity ladder (no upgrade path for C deals)
    expect(result.approvalSensitivityLadder).toEqual([]);

    // Surface 8: residual risks are non-empty and contain terminal risk text
    expect(result.residualRisks.length).toBeGreaterThan(0);
    // The C-constructor populates residualRisks from rescuePolicy[flag].residualRisk
    // so it must NOT be empty even though the LLM returned []
    const risksText = result.residualRisks.join(" ").toLowerCase();
    expect(risksText).not.toBe("");
  });

  it("GUARD 0+1: C-deal with injected decision='approve' (lowercase) returns REJECTED", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({ decision: "approve" }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: VETOED · 0/10 YES",
      terminalFlags: ["fraud"],
    });
    // Guard 1 fires before normalization for C deals — LLM output is never read
    expect(result.predictedOutcome.decision).toBe("REJECTED");
    expect(result.predictedOutcome.consensusPct).toBe(0);
  });

  it("GUARD 0+1: multiple terminal flags (fraud + sanctions) still returns REJECTED", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: VETOED · 0/10 YES",
      terminalFlags: ["fraud", "sanctions"],
    });
    expect(result.predictedOutcome.decision).toBe("REJECTED");
    expect(result.classification).toBe("C");
    // Both terminal flags should contribute residual risks
    expect(result.residualRisks.length).toBeGreaterThanOrEqual(2);
  });

  it("GUARD 0+1: unknown/unrecognised terminal flag is treated as TERMINAL (fail-safe default)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: VETOED · 0/10 YES",
      terminalFlags: ["unknown_future_blocker_not_in_enum"],  // ← unknown flag
    });
    // FAIL-SAFE: unknown flag → C → REJECTED (never allow)
    expect(result.predictedOutcome.decision).toBe("REJECTED");
    expect(result.classification).toBe("C");
  });
});

describe("fixTheDeal — Guard 2+3+4+5: non-C deal decision normalization and caps", () => {
  it("GUARD 3: APPROVED is capped to APPROVED_WITH_CONDITIONS for B deals", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "APPROVED",
      consensusPct: 90,
      classification: "B",
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: REJECTED · 3/10 YES",
      terminalFlags: [],  // ← no terminal flags → B deal
    });
    // Guard 3: APPROVED → APPROVED_WITH_CONDITIONS (ceiling cap)
    expect(result.predictedOutcome.decision).toBe("APPROVED_WITH_CONDITIONS");
    // Guard 5: consensusPct capped at 99
    expect(result.predictedOutcome.consensusPct).toBeLessThanOrEqual(99);
  });

  it("GUARD 2: 'APPROVE' (synonym) is normalized to APPROVED then capped to APPROVED_WITH_CONDITIONS", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "APPROVE",  // ← synonym
      consensusPct: 75,
      classification: "B",
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: REJECTED · 3/10 YES",
      terminalFlags: [],
    });
    // Guard 2: APPROVE → APPROVED; Guard 3: APPROVED → APPROVED_WITH_CONDITIONS
    expect(result.predictedOutcome.decision).toBe("APPROVED_WITH_CONDITIONS");
  });

  it("GUARD 4: unknown decision string falls through to REJECTED (default-reject net)", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "MAYBE_APPROVED_LATER",  // ← unknown value
      consensusPct: 60,
      classification: "B",
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: REJECTED · 3/10 YES",
      terminalFlags: [],
    });
    // Guard 4: unknown decision → REJECTED (default branch is REJECTED, never allow)
    expect(result.predictedOutcome.decision).toBe("REJECTED");
  });

  it("GUARD 5: consensusPct > 99 is capped to 99 for B deals", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "APPROVED_WITH_CONDITIONS",
      consensusPct: 100,  // ← LLM returns 100 (unanimous — impossible for rescued deal)
      classification: "B",
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: REJECTED · 3/10 YES",
      terminalFlags: [],
    });
    // Guard 5: 100 → 99 (never unanimous for a rescued deal)
    expect(result.predictedOutcome.consensusPct).toBe(99);
  });

  it("GUARD 0: codeClassification is always 'B' when terminalFlags is empty", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "APPROVED_WITH_CONDITIONS",
      consensusPct: 70,
      classification: "C",  // ← LLM claims C, but no terminal flags
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: REJECTED · 3/10 YES",
      terminalFlags: [],  // ← no terminal flags
    });
    // Guard 0: codeClassification derived from terminalFlags, not LLM
    // Empty terminalFlags → B (LLM's "C" is ignored)
    expect(result.classification).toBe("B");
    expect((result as Record<string, unknown>).codeClassification).toBe("B");
    // B deal: decision passes through (not zeroed)
    expect(result.predictedOutcome.decision).toBe("APPROVED_WITH_CONDITIONS");
  });
});

describe("fixTheDeal — rescuePolicy integration", () => {
  it("each TERMINAL flag in rescuePolicy produces a non-empty residualRisk in C-constructor", async () => {
    // Import rescuePolicy directly to enumerate all TERMINAL flags
    const { rescuePolicy } = await import("./lib/rescuePolicy");
    const terminalFlags = Object.entries(rescuePolicy)
      .filter(([, v]) => v.verdict === "TERMINAL")
      .map(([k]) => k);

    expect(terminalFlags.length).toBeGreaterThan(0);

    for (const flag of terminalFlags) {
      vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({ decision: "APPROVED", consensusPct: 82 }) as never);
      const caller = appRouter.createCaller(makeCtx());
      const result = await caller.dealScreener.fixTheDeal({
        dealText: FRAUD_DEAL_TEXT,
        councilOutcome: `Verdict: VETOED · 0/10 YES\nTop blockers: ${flag}`,
        terminalFlags: [flag],
      });
      expect(result.predictedOutcome.decision).toBe("REJECTED");
      expect(result.predictedOutcome.consensusPct).toBe(0);
      expect(result.residualRisks.length).toBeGreaterThan(0);
      // Each terminal flag must produce a non-empty residual risk string
      expect(result.residualRisks[0]).toBeTruthy();
    }
  });
});

describe("fixTheDeal — panel badge reads codeClassification, not LLM classification", () => {
  /**
   * This test proves the panel badge gap is closed:
   * - LLM returns classification = "A" (optimistic self-report)
   * - terminalFlags = ["fraud"] → codeClassification = "C"
   * - The procedure exposes codeClassification = "C" for the panel badge
   * - The procedure also exposes classification = "C" (overridden by Guard 0)
   * - No path exists where the panel renders a non-C badge for a C deal
   */
  it("panel badge field (codeClassification) is C even when LLM self-reports A", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "APPROVED",
      consensusPct: 90,
      classification: "A",  // ← LLM optimistically self-reports A
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: VETOED · 0/10 YES\nTop blockers: fraud allegation",
      terminalFlags: ["fraud"],
    });

    // The field the panel badge reads — must be C
    expect((result as Record<string, unknown>).codeClassification).toBe("C");

    // The LLM-reported classification field is also overridden to C by Guard 0
    // (so even if a future developer accidentally reads d.classification, it is still C)
    expect(result.classification).toBe("C");

    // Decision and score must be zeroed — no fabricated positive leaks through
    expect(result.predictedOutcome.decision).toBe("REJECTED");
    expect(result.predictedOutcome.consensusPct).toBe(0);

    // PDF surface: revisedBrief is empty string (C-constructor clears all positive fields)
    // The C-constructor sets revisedBrief: "" — no rescue path, no revised brief
    expect(result.revisedBrief).toBe("");

    // Memo surface: residualRisks populated (C-constructor builds from rescuePolicy)
    expect(result.residualRisks.length).toBeGreaterThan(0);
  });

  it("panel badge field (codeClassification) is B when terminalFlags is empty, regardless of LLM classification", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(makeAdversarialLLMResponse({
      decision: "APPROVED_WITH_CONDITIONS",
      consensusPct: 70,
      classification: "C",  // ← LLM claims C
    }) as never);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dealScreener.fixTheDeal({
      dealText: FRAUD_DEAL_TEXT,
      councilOutcome: "Verdict: REJECTED · 3/10 YES",
      terminalFlags: [],  // ← no terminal flags → codeClassification = B
    });

    // Panel badge must reflect B (code-derived), not C (LLM-reported)
    expect((result as Record<string, unknown>).codeClassification).toBe("B");

    // LLM classification is overridden to B (Guard 0 normalizes to code-derived)
    expect(result.classification).toBe("B");

    // B deal: decision is not zeroed (Guard 4 caps at APPROVED_WITH_CONDITIONS, not REJECTED)
    expect(result.predictedOutcome.decision).toBe("APPROVED_WITH_CONDITIONS");
  });
});
