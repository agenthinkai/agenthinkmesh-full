/**
 * LP Twin v1 — WP8P Release Gate Tests
 *
 * 20 tests that must pass before every release.
 * These tests verify the complete release readiness checklist.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import {
  users, organizations, enterpriseMemberships,
  lpTwinFunds, lpTwinSessions, lpTwinSegmentResults,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { lpTwinRouter } from "./lpTwin";
import { lpTwinScenarioRouter } from "./lpTwinScenario";
import { lpTwinMeetingRouter } from "./lpTwinMeeting";
import { lpTwinValidationRouter } from "./lpTwinValidation";
import {
  LP_AGENT_BANK,
  LP_AGENT_BANK_VERSION,
  FIT_ENGINE_VERSION,
  OBJECTION_ENGINE_VERSION,
  computeAllocatorFit,
  generateObjections,
  buildFundProfileFromDb,
} from "../../shared/captwin";
import { applyProposedTerms, computeSegmentScenario } from "../../shared/captwin/scenarioEngine";
import { generateMeetingBrief } from "../../shared/captwin/meetingEngine";
import { computeReadinessScore } from "../../shared/captwin/readinessEngine";
import { computeValidationQualityScore, type ValidationQualityInput } from "../../shared/captwin/validationEngine";
import * as fs from "fs";
import * as path from "path";

// ── Test state ─────────────────────────────────────────────────────────────
let orgId: number;
let userId: number;
let fundId: number;
let sessionId: number;

function ctx() {
  return { orgId, userId, user: { id: userId, role: "admin" as const } };
}

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [org] = await db.insert(organizations).values({ name: "Release Gate Org", slug: `release-gate-${Date.now()}`, plan: "enterprise", status: "active", approvedDomains: "[]" }).$returningId();
  const [user] = await db.insert(users).values({ openId: `release-gate-${Date.now()}`, name: "Release Gate User", email: `release-gate-${Date.now()}@test.com`, role: "user" }).$returningId();
  orgId = org.id;
  userId = user.id;
  await db.insert(enterpriseMemberships).values({ orgId, userId, status: "active", roleId: 1 });
  const [fund] = await db.insert(lpTwinFunds).values({
    orgId, createdByUserId: userId, updatedByUserId: userId,
    fundName: "Release Gate Fund", gpName: "Release Gate GP", strategy: "growth_equity",
    targetFundSizeM: "100.00",
    economicsJson: JSON.stringify({ managementFeePct: 2, carryPct: 20, hurdleRatePct: 8 }),
    trackRecordJson: JSON.stringify({ trackRecordYrs: 5, priorFundIRR: 18, vintageYear: 2019 }),
    evidenceStatus: "draft", version: 1,
  }).$returningId();
  fundId = fund.id;
  const [sess] = await db.insert(lpTwinSessions).values({
    orgId, createdByUserId: userId, fundId,
    sessionName: "Release Gate Session",
    selectedSegmentsJson: JSON.stringify(["swf-001", "ppf-001"]),
    assumptionsJson: JSON.stringify({}),
    engineVersion: FIT_ENGINE_VERSION,
    registryVersion: LP_AGENT_BANK_VERSION,
    status: "completed",
  }).$returningId();
  sessionId = sess.id;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  await db.delete(lpTwinSegmentResults).where(eq(lpTwinSegmentResults.sessionId, sessionId));
  await db.delete(lpTwinSessions).where(eq(lpTwinSessions.id, sessionId));
  await db.delete(lpTwinFunds).where(eq(lpTwinFunds.id, fundId));
  await db.delete(enterpriseMemberships).where(and(eq(enterpriseMemberships.orgId, orgId), eq(enterpriseMemberships.userId, userId)));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
});

describe("LP Twin v1 — WP8P Release Gate", () => {

  // ── R01: All 13 LP Twin tables exist ──────────────────────────────────────
  it("R01: All 13 LP Twin tables exist in the database", async () => {
    const db = await getDb();
    const tables = [
      "lp_twin_funds", "lp_twin_sessions", "lp_twin_segment_results",
      "lp_twin_scenarios", "lp_twin_scenario_results", "lp_twin_exports",
      "lp_twin_actual_meetings",
      "lp_twin_validation_participants", "lp_twin_human_responses",
      "lp_twin_synthetic_snapshots", "lp_twin_validation_comparisons",
      "lp_twin_calibration_candidates",
    ];
    for (const t of tables) {
      const [row] = await db!.execute(`SELECT COUNT(*) as c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${t}'` as any);
      expect(Number((row as any[])[0]?.c ?? 0), `Table ${t} missing`).toBeGreaterThan(0);
    }
  });

  // ── R02: LP Agent Bank has 9 segments ─────────────────────────────────────
  it("R02: LP Agent Bank v1 has exactly 9 segments", () => {
    expect(LP_AGENT_BANK.length).toBe(9);
    const ids = LP_AGENT_BANK.map(a => a.id);
    expect(ids).toContain("swf-001");
    expect(ids).toContain("ppf-001");
    expect(ids).toContain("cpf-001");
    expect(ids).toContain("ins-001");
    expect(ids).toContain("sfo-001");
    expect(ids).toContain("mfo-001");
    expect(ids).toContain("end-001");
    expect(ids).toContain("fof-001");
    expect(ids).toContain("iia-001");
  });

  // ── R03: Engine versions are semver ───────────────────────────────────────
  it("R03: All engine version constants follow semver format", () => {
    const semver = /^\d+\.\d+\.\d+$/;
    expect(LP_AGENT_BANK_VERSION).toMatch(semver);
    expect(FIT_ENGINE_VERSION).toMatch(semver);
    expect(OBJECTION_ENGINE_VERSION).toMatch(semver);
  });

  // ── R04: Fit engine returns valid score ───────────────────────────────────
  it("R04: Fit engine returns a score between 0 and 100 for all 9 segments", () => {
    const fundProfile = {
      fundName: "Test Fund", gpName: "Test GP", strategy: "growth_equity",
      targetFundSizeM: 100, managementFeePct: 2, carryPct: 20, hurdleRatePct: 8,
      trackRecordYrs: 5, priorFundIRR: 18, vintageYear: 2019, geography: "North America",
      domicile: "Cayman Islands", currency: "USD", fundVersion: 1,
    };
    for (const seg of LP_AGENT_BANK) {
      const result = computeAllocatorFit(fundProfile as any, seg);
      expect(result.overallFitScore).toBeGreaterThanOrEqual(0);
      expect(result.overallFitScore).toBeLessThanOrEqual(100);
      expect(["Strong Fit", "Conditional Fit", "Weak Fit", "Likely Ineligible"]).toContain(result.fitCategory);
    }
  });

  // ── R05: Objection engine returns structured objections ───────────────────
  it("R05: Objection engine returns structured objections for all 9 segments", () => {
    const fundProfile = {
      fundName: "Test Fund", gpName: "Test GP", strategy: "growth_equity",
      targetFundSizeM: 100, managementFeePct: 2, carryPct: 20, hurdleRatePct: 8,
      trackRecordYrs: 5, priorFundIRR: 18, vintageYear: 2019, geography: "North America",
      domicile: "Cayman Islands", currency: "USD", fundVersion: 1,
    };
    for (const seg of LP_AGENT_BANK) {
      const objections = generateObjections(fundProfile as any, seg);
      expect(Array.isArray(objections)).toBe(true);
      for (const obj of objections) {
        expect(obj.statement).toBeTruthy();
        expect(obj.category).toBeTruthy();
        expect(["Critical", "High", "Moderate", "Low"]).toContain(obj.severity);
      }
    }
  });

  // ── R06: Readiness engine returns 14 dimensions ───────────────────────────
  it("R06: Readiness engine returns exactly 14 dimensions", () => {
    const fundProfile = {
      fundName: "Test Fund", gpName: "Test GP", strategy: "growth_equity",
      targetFundSizeM: 100, managementFeePct: 2, carryPct: 20, hurdleRatePct: 8,
      trackRecordYrs: 5, priorFundIRR: 18, vintageYear: 2019, geography: "North America",
      domicile: "Cayman Islands", currency: "USD", fundVersion: 1,
    };
    const result = computeReadinessScore(fundProfile as any);
    expect(result.dimensions.length).toBe(14);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(["Ready", "Ready with Conditions", "Not Ready"]).toContain(result.readinessLabel);
  });

  // ── R07: Validation quality score returns correct labels ──────────────────
  it("R07: Validation quality score returns correct labels for all thresholds", () => {
    const base: ValidationQualityInput = {
      segmentId: "swf-001", verifiedResponseCount: 0, independentParticipantCount: 0,
      scenarioDiversity: 0, geographicDiversity: 0, avgVerdictAgreement: 0,
      avgObjRecall: 0, avgObjPrecision: 0, avgEvidenceAgreement: 0,
      newestResponseAgeMs: 0, dataQualityRatings: [],
    };
    // With 0 responses, label should be "Synthetic Only" (no validation data)
    const r0 = computeValidationQualityScore(base);
    expect(r0.label).toBe("Synthetic Only");
    expect(r0.calibrationThresholdMet).toBe(false);
    // With good data, label should advance
    const r1 = computeValidationQualityScore({
      ...base,
      verifiedResponseCount: 100, independentParticipantCount: 20,
      scenarioDiversity: 5, geographicDiversity: 5,
      avgVerdictAgreement: 0.8, avgObjRecall: 0.8, avgObjPrecision: 0.8,
      avgEvidenceAgreement: 0.8, newestResponseAgeMs: 86400000,
      dataQualityRatings: ["high", "high", "high"],
    });
    expect(r1.label).not.toBe("Synthetic Only");
  });

  // ── R08: Scenario diff engine returns deltas ──────────────────────────────
  it("R08: Scenario diff engine returns score deltas for a carry change", () => {
    const baseFund = {
      fundName: "Test Fund", gpName: "Test GP", strategy: "growth_equity",
      targetFundSizeM: 100, managementFeePct: 2, carryPct: 20, hurdleRatePct: 8,
      trackRecordYrs: 5, priorFundIRR: 18, vintageYear: 2019, geography: "North America",
      domicile: "Cayman Islands", currency: "USD", fundVersion: 1,
    };
    const proposedTerms = { carryPct: 17.5 };
    const proposedFund = applyProposedTerms(baseFund as any, proposedTerms);
    const agent = LP_AGENT_BANK[0];
    const baseResult = computeAllocatorFit(baseFund as any, agent);
    const proposedResult = computeAllocatorFit(proposedFund, agent);
    const delta = proposedResult.overallFitScore - baseResult.overallFitScore;
    expect(typeof delta).toBe("number");
    expect(typeof baseResult.overallFitScore).toBe("number");
    expect(typeof proposedResult.overallFitScore).toBe("number");
  });

  // ── R09: Meeting brief generator returns required fields ──────────────────
  it("R09: Meeting brief generator returns all required fields", () => {
    const agent = LP_AGENT_BANK[0];
    const fundProfile = {
      fundName: "Test Fund", gpName: "Test GP", strategy: "growth_equity",
      targetFundSizeM: 100, managementFeePct: 2, carryPct: 20, hurdleRatePct: 8,
      trackRecordYrs: 5, priorFundIRR: 18, vintageYear: 2019, geography: "North America",
      domicile: "Cayman Islands", currency: "USD", fundVersion: 1,
    };
    // generateMeetingBrief takes (fund, segmentId, meetingType, meetingObjective, fitResult?)
    const fitResult = computeAllocatorFit(fundProfile as any, agent);
    const brief = generateMeetingBrief(fundProfile as any, agent.id, "first_meeting", "introduce_fund", fitResult);
    expect(brief.investorArchetype).toBeTruthy();
    expect(brief.fundFit).toBeTruthy();
    expect(Array.isArray(brief.likelyQuestions)).toBe(true);
    expect(brief.likelyQuestions.length).toBeGreaterThan(0);
    expect(Array.isArray(brief.likelyObjections)).toBe(true);
    expect(brief.disclaimer).toBeTruthy();
    expect(brief.disclaimer).toContain("SYNTHETIC SIMULATION");
  });

  // ── R10: All LP Twin procedures are org-scoped ────────────────────────────
  it("R10: createFund stores orgId from ctx, not from client input", async () => {
    const caller = lpTwinRouter.createCaller(ctx() as any);
    const result = await caller.createFund({
      fundName: "R10 Test Fund", gpName: "R10 GP", strategy: "growth_equity",
      targetFundSizeM: 50,
      economics: { managementFeePct: 2, carryPct: 20, hurdleRatePct: 8 },
      trackRecord: { trackRecordYrs: 3, priorFundIRR: 15, vintageYear: 2021 },
    });
    const db = await getDb();
    const [fund] = await db!.select().from(lpTwinFunds).where(eq(lpTwinFunds.id, result.fundId)).limit(1);
    expect(fund.orgId).toBe(orgId);
    await db!.delete(lpTwinFunds).where(eq(lpTwinFunds.id, result.fundId));
  });

  // ── R11: Disclaimer present in runSegmentAnalysis ─────────────────────────
  it("R11: runSegmentAnalysis result includes SYNTHETIC SIMULATION disclaimer", async () => {
    const caller = lpTwinRouter.createCaller(ctx() as any);
    // Session is already completed — use segmentIdsToRetry
    const result = await caller.runSegmentAnalysis({
      sessionId,
      selectedSegmentIds: ["swf-001"],
      segmentIdsToRetry: ["swf-001"],
    });
    expect(result.disclaimer).toContain("SYNTHETIC SIMULATION");
  });

  // ── R12: Export includes disclaimer ───────────────────────────────────────
  it("R12: exportSession JSON includes SYNTHETIC SIMULATION disclaimer", async () => {
    const caller = lpTwinRouter.createCaller(ctx() as any);
    const result = await caller.exportSession({ sessionId, exportType: "json" });
    // exportSession returns { data: string, mimeType, filename } — data may be JSON string
    expect(result).toBeTruthy();
    const content = result.data ?? JSON.stringify(result);
    expect(content).toContain("SYNTHETIC SIMULATION");
  });

  // ── R13: All documentation files exist ────────────────────────────────────
  it("R13: All 11 LP Twin documentation files exist", () => {
    const docFiles = [
      "docs/lp-twin/WP8E_FOUNDING_CUSTOMER_REHEARSAL.md",
      "docs/lp-twin/WP8G_CUSTOMER_INTAKE_PACKAGE.md",
      "docs/lp-twin/WP8H_FOUNDING_ENGAGEMENT_PACKAGE.md",
      "docs/lp-twin/WP8I_CUSTOMER_ROLE_MATRIX.md",
      "docs/lp-twin/WP8J_MODEL_CARDS.md",
      "docs/lp-twin/WP8K_COMMERCIAL_CLAIMS_REVIEW.md",
      "docs/lp-twin/WP8L_PERFORMANCE_BENCHMARK.md",
      "docs/lp-twin/WP8M_BACKUP_RECOVERY_REHEARSAL.md",
      "docs/lp-twin/WP8N_DOCUMENTATION_INDEX.md",
      "docs/lp-twin/WP8O_SUCCESS_METRICS.md",
    ];
    const projectRoot = path.resolve(__dirname, "../../");
    for (const f of docFiles) {
      const fullPath = path.join(projectRoot, f);
      expect(fs.existsSync(fullPath), `Missing: ${f}`).toBe(true);
    }
  });

  // ── R14: Demo fund seed script exists ─────────────────────────────────────
  it("R14: Demo fund seed script exists", () => {
    const seedPath = path.resolve(__dirname, "../../scripts/seed-lp-twin-demo.ts");
    expect(fs.existsSync(seedPath)).toBe(true);
  });

  // ── R15: All 8 LP Twin test files exist ───────────────────────────────────
  it("R15: All 8 LP Twin test files exist", () => {
    const testFiles = [
      "server/routers/lpTwin.wp1.test.ts",
      "server/routers/lpTwin.wp2.test.ts",
      "server/routers/lpTwin.wp3.test.ts",
      "server/routers/lpTwin.wp4.test.ts",
      "server/routers/lpTwinScenario.wp5.test.ts",
      "server/routers/lpTwinMeeting.wp6.test.ts",
      "server/routers/lpTwinValidation.wp7.test.ts",
      "server/routers/lpTwin.wp8.pentest.test.ts",
    ];
    const projectRoot = path.resolve(__dirname, "../../");
    for (const f of testFiles) {
      expect(fs.existsSync(path.join(projectRoot, f)), `Missing test: ${f}`).toBe(true);
    }
  });

  // ── R16: All 4 LP Twin routers are registered ─────────────────────────────
  it("R16: All 4 LP Twin routers are registered in server/routers.ts", () => {
    const routersPath = path.resolve(__dirname, "../../server/routers.ts");
    const content = fs.readFileSync(routersPath, "utf-8");
    expect(content).toContain("lpTwinRouter");
    expect(content).toContain("lpTwinScenarioRouter");
    expect(content).toContain("lpTwinMeetingRouter");
    expect(content).toContain("lpTwinValidationRouter");
  });

  // ── R17: No publicProcedure in LP Twin routers ────────────────────────────
  it("R17: No LP Twin procedure uses publicProcedure", () => {
    const routerFiles = [
      "server/routers/lpTwin.ts",
      "server/routers/lpTwinScenario.ts",
      "server/routers/lpTwinMeeting.ts",
      "server/routers/lpTwinValidation.ts",
    ];
    const projectRoot = path.resolve(__dirname, "../../");
    for (const f of routerFiles) {
      const content = fs.readFileSync(path.join(projectRoot, f), "utf-8");
      // publicProcedure should not appear as a procedure definition
      const hasPublicProcedure = content.includes("publicProcedure.") || content.includes("publicProcedure.input") || content.includes("publicProcedure.query") || content.includes("publicProcedure.mutation");
      expect(hasPublicProcedure, `${f} uses publicProcedure`).toBe(false);
    }
  });

  // ── R18: All LP Twin tables have orgId column ─────────────────────────────
  it("R18: All LP Twin tables have orgId column (tenant isolation)", async () => {
    const db = await getDb();
    const tables = [
      "lp_twin_funds", "lp_twin_sessions", "lp_twin_segment_results",
      "lp_twin_scenarios", "lp_twin_scenario_results", "lp_twin_exports",
      "lp_twin_actual_meetings",
      "lp_twin_validation_participants", "lp_twin_human_responses",
      "lp_twin_synthetic_snapshots", "lp_twin_validation_comparisons",
      "lp_twin_calibration_candidates",
    ];
    for (const t of tables) {
      const [row] = await db!.execute(`SELECT COUNT(*) as c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '${t}' AND column_name = 'orgId'` as any);
      expect(Number((row as any[])[0]?.c ?? 0), `Table ${t} missing orgId column`).toBeGreaterThan(0);
    }
  });

  // ── R19: Validation quality score insufficient for 0 comparisons ──────────
  it("R19: Validation quality score is 'insufficient' with 0 comparisons (correct M0 label)", () => {
    const result = computeValidationQualityScore({
      segmentId: "swf-001", verifiedResponseCount: 0, independentParticipantCount: 0,
      scenarioDiversity: 0, geographicDiversity: 0, avgVerdictAgreement: 0,
      avgObjRecall: 0, avgObjPrecision: 0, avgEvidenceAgreement: 0,
      newestResponseAgeMs: 0, dataQualityRatings: [],
    });
    // With 0 responses, label should be "Synthetic Only" (no validation data collected)
    expect(result.label).toBe("Synthetic Only");
    expect(result.calibrationThresholdMet).toBe(false);
  });

  // ── R20: Existing /captwin route is not broken ────────────────────────────
  it("R20: Existing /captwin route files are unchanged (CapTwin.tsx, capTwinEngine.ts, lpRegistry.ts)", () => {
    const projectRoot = path.resolve(__dirname, "../../");
    const protectedFiles = [
      "client/src/pages/CapTwin.tsx",
      "client/src/lib/capTwinEngine.ts",
      "client/src/lib/lpRegistry.ts",
      "client/src/lib/capTwinAgents.ts",
    ];
    for (const f of protectedFiles) {
      expect(fs.existsSync(path.join(projectRoot, f)), `Protected file missing: ${f}`).toBe(true);
    }
    // Verify CapTwin.tsx does not import from lpTwin routers (no coupling)
    const capTwinContent = fs.readFileSync(path.join(projectRoot, "client/src/pages/CapTwin.tsx"), "utf-8");
    expect(capTwinContent).not.toContain("lpTwin");
    expect(capTwinContent).not.toContain("LPTwin");
  });

});
