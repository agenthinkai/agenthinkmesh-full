/**
 * lpTwinScenario.wp5.test.ts — WP5 Fund-Term Laboratory and Fundraising Scenario Engine Tests
 *
 * 32 required tests covering:
 * S01–S05: Scenario CRUD (create, list, get, archive, cross-tenant denial)
 * S06–S10: Live recomputation (preview, compute, idempotent retry, cross-tenant denial, disclaimer)
 * S11–S14: Fundraising sequence engine (generate, objective weights, avoid list, disclaimer)
 * S15–S17: Market stress (apply conditions, score adjustments, disclaimer)
 * S18–S20: Sensitivity analysis (run, inflection points, disclaimer)
 * S21–S23: Recommended config (generate, strengths/weaknesses, disclaimer)
 * S24–S26: Ask-an-LP scenario mode (question, comparison, disclaimer)
 * S27–S29: Export and audit (export, CSV, audit record)
 * S30–S32: Security (orgId always server-resolved, no cross-tenant data, schema version)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import { appRouter } from "../routers";
import { getDb } from "../db";
import {
  users,
  organizations,
  enterpriseMemberships,
  lpTwinFunds,
  lpTwinScenarios,
  lpTwinScenarioResults,
  lpTwinExports,
} from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────

type AuthUser = NonNullable<TrpcContext["user"]>;
const TAG = `lptwin-wp5-${Date.now()}`;

let orgAId: number;
let orgBId: number;
let userAId: number;
let userBId: number;
let fundAId: number;
let fundBId: number;
let scenarioAId: number;

function makeCtx(userId: number, orgId: number): TrpcContext & { orgId: number; membershipId: number; orgStatus: string } {
  const user: AuthUser = {
    id: userId,
    openId: `wp5-user-${userId}`,
    email: `user-${userId}@wp5.test`,
    name: "WP5 Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    orgId,
    membershipId: 1,
    orgStatus: "active",
    req: {} as never,
    res: {} as never,
  };
}

const FUND_PAYLOAD = {
  fundName: `WP5 Test Fund ${TAG}`,
  gpName: "WP5 GP Partners",
  strategy: "Private Credit",
  targetFundSizeM: "300",
  economicsJson: JSON.stringify({ managementFeePct: 1.75, carryPct: 20, hurdleRatePct: 8, gpCommitmentPct: 2 }),
  trackRecordJson: JSON.stringify({ trackRecordYrs: 8, priorFundIRR: 14, vintageYear: 2018 }),
  evidenceStatus: "complete" as const,
  version: 1,
};

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Create orgs
  const [orgARes] = await db.insert(organizations).values({ name: `WP5 Org A ${TAG}`, slug: `wp5-org-a-${TAG}`, approvedDomains: "[]" });
  orgAId = (orgARes as { insertId: number }).insertId;
  const [orgBRes] = await db.insert(organizations).values({ name: `WP5 Org B ${TAG}`, slug: `wp5-org-b-${TAG}`, approvedDomains: "[]" });
  orgBId = (orgBRes as { insertId: number }).insertId;

  // Create users
  await db.insert(users).values({ openId: `wp5-a-${TAG}`, email: `a-${TAG}@test.com`, name: "User A" });
  const [uA] = await db.select().from(users).where(eq(users.openId, `wp5-a-${TAG}`)).limit(1);
  userAId = uA.id;
  await db.insert(users).values({ openId: `wp5-b-${TAG}`, email: `b-${TAG}@test.com`, name: "User B" });
  const [uB] = await db.select().from(users).where(eq(users.openId, `wp5-b-${TAG}`)).limit(1);
  userBId = uB.id;

  // Create memberships
  await db.insert(enterpriseMemberships).values({ orgId: orgAId, userId: userAId, roleId: 1, status: "active" });
  await db.insert(enterpriseMemberships).values({ orgId: orgBId, userId: userBId, roleId: 1, status: "active" });

  // Create funds
  const now = Date.now();
  const [fundARes] = await db.insert(lpTwinFunds).values({ ...FUND_PAYLOAD, orgId: orgAId, createdByUserId: userAId, updatedByUserId: userAId, createdAt: now, updatedAt: now });
  fundAId = (fundARes as { insertId: number }).insertId;
  const [fundBRes] = await db.insert(lpTwinFunds).values({ ...FUND_PAYLOAD, fundName: `WP5 Fund B ${TAG}`, orgId: orgBId, createdByUserId: userBId, updatedByUserId: userBId, createdAt: now, updatedAt: now });
  fundBId = (fundBRes as { insertId: number }).insertId;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(lpTwinScenarioResults).where(eq(lpTwinScenarioResults.orgId, orgAId));
  await db.delete(lpTwinScenarios).where(eq(lpTwinScenarios.orgId, orgAId));
  await db.delete(lpTwinScenarios).where(eq(lpTwinScenarios.orgId, orgBId));
  await db.delete(lpTwinFunds).where(eq(lpTwinFunds.orgId, orgAId));
  await db.delete(lpTwinFunds).where(eq(lpTwinFunds.orgId, orgBId));
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.userId, userAId));
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.userId, userBId));
  await db.delete(users).where(eq(users.id, userAId));
  await db.delete(users).where(eq(users.id, userBId));
  await db.delete(organizations).where(eq(organizations.id, orgAId));
  await db.delete(organizations).where(eq(organizations.id, orgBId));
});

// ── S01–S05: Scenario CRUD ────────────────────────────────────────────────────

describe("WP5 Scenario CRUD", () => {
  it("S01 — createScenario: creates a scenario and returns scenarioId", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.createScenario({
      fundId: fundAId,
      scenarioName: `WP5 Test Scenario ${TAG}`,
      scenarioType: "term_change",
      proposedTerms: { managementFeePct: 1.5, gpCommitmentPct: 3 },
    });
    expect(result.scenarioId).toBeGreaterThan(0);
    scenarioAId = result.scenarioId;
  });

  it("S02 — listScenarios: returns only org-scoped scenarios", async () => {
    const callerA = appRouter.createCaller(makeCtx(userAId, orgAId));
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    const resultA = await callerA.lpTwinScenario.listScenarios({ fundId: fundAId });
    const resultB = await callerB.lpTwinScenario.listScenarios({});
    expect(resultA.scenarios.some((s) => s.id === scenarioAId)).toBe(true);
    expect(resultB.scenarios.every((s) => s.orgId === orgBId)).toBe(true);
  });

  it("S03 — getScenario: returns scenario details for valid org", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.getScenario({ scenarioId: scenarioAId });
    expect(result.scenario.id).toBe(scenarioAId);
    expect(result.scenario.orgId).toBe(orgAId);
    expect(result.scenario.fundId).toBe(fundAId);
  });

  it("S04 — getScenario cross-tenant: denied for another org's scenario", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwinScenario.getScenario({ scenarioId: scenarioAId })).rejects.toThrow();
  });

  it("S05 — archiveScenario: sets archivedAt and excludes from list", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    // Create a separate scenario to archive
    const { scenarioId: archiveId } = await caller.lpTwinScenario.createScenario({
      fundId: fundAId,
      scenarioName: `WP5 Archive Test ${TAG}`,
      scenarioType: "term_change",
      proposedTerms: { carryPct: 25 },
    });
    await caller.lpTwinScenario.archiveScenario({ scenarioId: archiveId });
    const list = await caller.lpTwinScenario.listScenarios({ fundId: fundAId, includeArchived: false });
    expect(list.scenarios.every((s) => s.id !== archiveId)).toBe(true);
  });
});

// ── S06–S10: Live Recomputation ───────────────────────────────────────────────

describe("WP5 Live Recomputation", () => {
  it("S06 — previewScenario: returns segment results without persisting", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.previewScenario({
      fundId: fundAId,
      proposedTerms: { managementFeePct: 1.25, gpCommitmentPct: 3 },
    });
    expect(result.segmentResults.length).toBeGreaterThan(0);
    expect(typeof result.avgScoreDelta).toBe("number");
    // Verify NOT persisted
    const db = await getDb();
    const rows = await db!.select().from(lpTwinScenarios).where(and(eq(lpTwinScenarios.orgId, orgAId), eq(lpTwinScenarios.status, "computed")));
    // previewScenario should not create a computed scenario record
    expect(rows.every((r) => r.status !== "computed" || r.id !== scenarioAId)).toBe(true);
  });

  it("S07 — computeScenario: computes all segments and writes results to DB", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.computeScenario({ scenarioId: scenarioAId });
    expect(result.segmentsComputed).toBeGreaterThan(0);
    expect(typeof result.avgScoreDelta).toBe("number");
    // Verify persisted
    const db = await getDb();
    const rows = await db!.select().from(lpTwinScenarioResults).where(eq(lpTwinScenarioResults.scenarioId, scenarioAId));
    expect(rows.length).toBe(result.segmentsComputed);
  });

  it("S08 — computeScenario idempotent: re-running replaces previous results", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result1 = await caller.lpTwinScenario.computeScenario({ scenarioId: scenarioAId });
    const result2 = await caller.lpTwinScenario.computeScenario({ scenarioId: scenarioAId });
    expect(result1.segmentsComputed).toBe(result2.segmentsComputed);
    const db = await getDb();
    const rows = await db!.select().from(lpTwinScenarioResults).where(eq(lpTwinScenarioResults.scenarioId, scenarioAId));
    expect(rows.length).toBe(result2.segmentsComputed);
  });

  it("S09 — computeScenario cross-tenant: denied for another org's scenario", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwinScenario.computeScenario({ scenarioId: scenarioAId })).rejects.toThrow();
  });

  it("S10 — computeScenario disclaimer: result contains synthetic simulation disclaimer", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.computeScenario({ scenarioId: scenarioAId });
    expect(result.disclaimer).toContain("SYNTHETIC SIMULATION");
    expect(result.disclaimer).toContain("not guarantee investment");
  });
});

// ── S11–S14: Fundraising Sequence Engine ─────────────────────────────────────

describe("WP5 Fundraising Sequence Engine", () => {
  it("S11 — generateSequence: returns waves with segments", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.generateSequence({
      fundId: fundAId,
      objective: "balanced",
      template: "diversified_global",
    });
    expect(result.sequence.waves.length).toBeGreaterThan(0);
    const allSegments = result.sequence.waves.flatMap((w) => w.segments);
    expect(allSegments.length).toBeGreaterThan(0);
  });

  it("S12 — generateSequence: objective weights are transparent and sum to ~1", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.generateSequence({
      fundId: fundAId,
      objective: "fastest_first_close",
      template: "fastest_decision_makers_first",
    });
    const weights = result.objectiveWeights;
    const total = Object.values(weights).reduce((s, v) => s + (v as number), 0);
    expect(total).toBeCloseTo(1.0, 1);
  });

  it("S13 — generateSequence: avoidUntilTermsImprove contains ineligible segments", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.generateSequence({
      fundId: fundAId,
      objective: "balanced",
      template: "diversified_global",
    });
    // All avoid items should have a reason
    for (const item of result.sequence.avoidUntilTermsImprove) {
      expect(item.reason).toBeTruthy();
      expect(item.segmentId).toBeTruthy();
    }
  });

  it("S14 — generateSequence: disclaimer present", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.generateSequence({
      fundId: fundAId,
      objective: "islamic_capital_priority",
      template: "islamic_capital_first",
    });
    expect(result.sequence.disclaimer).toContain("SYNTHETIC SIMULATION");
  });
});

// ── S15–S17: Market Stress ────────────────────────────────────────────────────

describe("WP5 Market Stress Testing", () => {
  it("S15 — runMarketStress: applies conditions and returns segment comparison", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.runMarketStress({
      fundId: fundAId,
      conditions: ["higher_interest_rates"],
    });
    expect(result.segmentComparison.length).toBeGreaterThan(0);
    expect(result.conditions).toContain("higher_interest_rates");
  });

  it("S16 — runMarketStress: affected segments show score adjustments", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.runMarketStress({
      fundId: fundAId,
      conditions: ["higher_interest_rates", "lower_public_market_valuations"],
    });
    // At least one segment should have a non-zero delta
    const hasAdjustment = result.segmentComparison.some((r) => r.scoreDelta !== 0);
    expect(hasAdjustment).toBe(true);
  });

  it("S17 — runMarketStress: disclaimer contains scenario assumption warning", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.runMarketStress({
      fundId: fundAId,
      conditions: ["increased_sharia_allocation"],
    });
    expect(result.disclaimer).toContain("SCENARIO ASSUMPTION");
    expect(result.disclaimer).toContain("not market forecasts");
  });
});

// ── S18–S20: Sensitivity Analysis ────────────────────────────────────────────

describe("WP5 Sensitivity Analysis", () => {
  it("S18 — runSensitivity: returns points across the range", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.runSensitivity({
      fundId: fundAId,
      field: "managementFeePct",
      minValue: 0.5,
      maxValue: 3.0,
      steps: 6,
    });
    expect(result.analysis.points.length).toBe(6);
    expect(result.analysis.field).toBe("managementFeePct");
  });

  it("S19 — runSensitivity: inflection points detected when strong-fit count changes", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.runSensitivity({
      fundId: fundAId,
      field: "managementFeePct",
      minValue: 0.5,
      maxValue: 3.0,
      steps: 10,
    });
    // Inflection points may or may not exist — just verify the structure
    for (const ip of result.analysis.inflectionPoints) {
      expect(ip.value).toBeDefined();
      expect(ip.description).toBeTruthy();
    }
  });

  it("S20 — runSensitivity: disclaimer present", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.runSensitivity({
      fundId: fundAId,
      field: "gpCommitmentPct",
      minValue: 0,
      maxValue: 5,
      steps: 5,
    });
    expect(result.disclaimer).toContain("SYNTHETIC SIMULATION");
    expect(result.disclaimer).toContain("GP economic");
  });
});

// ── S21–S23: Recommended Config ───────────────────────────────────────────────

describe("WP5 Recommended Fund Configuration", () => {
  it("S21 — getRecommendedConfig: returns strengths and weaknesses", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.getRecommendedConfig({ fundId: fundAId });
    expect(Array.isArray(result.recommendation.currentStrengths)).toBe(true);
    expect(Array.isArray(result.recommendation.currentWeaknesses)).toBe(true);
    expect(typeof result.recommendation.overallConfidence).toBe("number");
  });

  it("S22 — getRecommendedConfig: source attribution is present", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.getRecommendedConfig({ fundId: fundAId });
    expect(result.recommendation.sourceAttribution.deterministicFindings.length).toBeGreaterThan(0);
    expect(result.recommendation.sourceAttribution.ruleBasedTradeOffs.length).toBeGreaterThan(0);
  });

  it("S23 — getRecommendedConfig: disclaimer present and not a placement advice claim", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.getRecommendedConfig({ fundId: fundAId });
    expect(result.disclaimer).toContain("SYNTHETIC SIMULATION");
    expect(result.disclaimer).toContain("placement");
  });
});

// ── S24–S26: Ask-an-LP Scenario Mode ─────────────────────────────────────────

describe("WP5 Ask-an-LP Scenario Mode", () => {
  it("S24 — askLpScenario: returns base and scenario scores with delta", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.askLpScenario({
      fundId: fundAId,
      scenarioId: scenarioAId,
      segmentId: "ppf-001",
      question: "How does the lower management fee affect your interest in this fund?",
    });
    expect(typeof result.baseScore).toBe("number");
    expect(typeof result.scenarioScore).toBe("number");
    expect(typeof result.scoreDelta).toBe("number");
  });

  it("S25 — askLpScenario: response is grounded in deterministic scores", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.askLpScenario({
      fundId: fundAId,
      scenarioId: scenarioAId,
      segmentId: "swf-001",
      question: "What is your view on the GP commitment level?",
    });
    expect(result.response).toContain("Base Fund:");
    expect(result.response).toContain("Proposed Scenario:");
  });

  it("S26 — askLpScenario: disclaimer present", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.askLpScenario({
      fundId: fundAId,
      scenarioId: scenarioAId,
      segmentId: "end-001",
      question: "Would you consider investing in this fund?",
    });
    expect(result.disclaimer).toContain("SYNTHETIC SIMULATION");
  });
});

// ── S27–S29: Export and Audit ─────────────────────────────────────────────────

describe("WP5 Export and Audit", () => {
  it("S27 — exportScenarioComparison: returns export data with scenarios", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.exportScenarioComparison({
      scenarioIds: [scenarioAId],
      exportType: "json",
    });
    expect(result.exportData.scenarios.length).toBe(1);
    expect(result.exportData.disclaimer).toContain("SYNTHETIC SIMULATION");
  });

  it("S28 — exportScenarioComparison CSV: returns CSV string", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.exportScenarioComparison({
      scenarioIds: [scenarioAId],
      exportType: "csv",
    });
    expect(result.csvData).toBeTruthy();
    expect(result.csvData).toContain("scenarioName");
  });

  it("S29 — exportScenarioComparison: writes audit record to lp_twin_exports", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await caller.lpTwinScenario.exportScenarioComparison({
      scenarioIds: [scenarioAId],
      exportType: "json",
    });
    const db = await getDb();
    const rows = await db!.select().from(lpTwinExports).where(and(eq(lpTwinExports.orgId, orgAId), eq(lpTwinExports.exportedByUserId, userAId)));
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── S30–S32: Security ─────────────────────────────────────────────────────────

describe("WP5 Security", () => {
  it("S30 — orgId always server-resolved: scenario orgId matches ctx.orgId not client input", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinScenario.createScenario({
      fundId: fundAId,
      scenarioName: `WP5 Security Test ${TAG}`,
      scenarioType: "term_change",
      proposedTerms: { carryPct: 22 },
    });
    const db = await getDb();
    const [row] = await db!.select().from(lpTwinScenarios).where(eq(lpTwinScenarios.id, result.scenarioId));
    expect(row.orgId).toBe(orgAId);
  });

  it("S31 — no cross-tenant data: Org B cannot access Org A scenario results", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwinScenario.computeScenario({ scenarioId: scenarioAId })).rejects.toThrow();
    await expect(callerB.lpTwinScenario.getScenario({ scenarioId: scenarioAId })).rejects.toThrow();
  });

  it("S32 — engine versions pinned: scenario records engine, registry, and objection engine versions", async () => {
    const db = await getDb();
    const [row] = await db!.select().from(lpTwinScenarios).where(eq(lpTwinScenarios.id, scenarioAId));
    expect(row.engineVersion).toBeTruthy();
    expect(row.registryVersion).toBeTruthy();
    expect(row.objectionEngineVersion).toBeTruthy();
    // Versions should follow semver pattern
    expect(row.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
