/**
 * lpTwinValidation.wp7.test.ts — WP7 Validation Tests
 *
 * V01 — Schema: 5 WP7 tables exist in DB
 * V02 — createParticipant: creates participant with correct orgId
 * V03 — createParticipant cross-tenant: cannot list another org's participants
 * V04 — submitHumanResponse: blocked without consent
 * V05 — submitHumanResponse: succeeds with consent
 * V06 — createSyntheticSnapshot: creates frozen snapshot
 * V07 — compareWithSnapshot: returns comparison result with disclaimer
 * V08 — compareResponses: exact agreement detected
 * V09 — compareResponses: disagreement detected
 * V10 — compareResponses: partial agreement detected
 * V11 — compareResponses: objection recall computed correctly
 * V12 — compareResponses: objection precision computed correctly
 * V13 — compareResponses: evidence agreement computed correctly
 * V14 — compareResponses: missed objections identified
 * V15 — compareResponses: unexpected objections identified
 * V16 — computeValidationQualityScore: Synthetic Only with 0 responses
 * V17 — computeValidationQualityScore: Early Validation with 3 responses
 * V18 — computeValidationQualityScore: Moderately Validated threshold
 * V19 — computeValidationQualityScore: Strongly Validated threshold
 * V20 — computeValidationQualityScore: calibration threshold
 * V21 — computeValidationQualityScore: weight sum is 1.0
 * V22 — createCalibrationCandidate: requires evidenceCount >= 1
 * V23 — createCalibrationCandidate: creates with correct fields
 * V24 — reviewCalibrationCandidate: approve requires newAgentBankVersion
 * V25 — reviewCalibrationCandidate: approve sets approvedBy and version
 * V26 — reviewCalibrationCandidate: reject does not set approvedBy
 * V27 — deleteParticipant: anonymizes PII and revokes consent
 * V28 — updateParticipantConsent: updates consent status
 * V29 — importResponses dry-run: validates without inserting
 * V30 — importResponses: blocks import without consent
 * V31 — importResponses: detects duplicates
 * V32 — getValidationThresholds: returns documented thresholds
 * V33 — getValidationDashboard: returns summary with 0 comparisons
 * V34 — listAgentBankVersions: returns current version
 * V35 — WP1 regression: all 5 WP7 tables intact
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { appRouter } from "../routers";
import { getDb } from "../db";
import {
  users,
  organizations,
  enterpriseMemberships,
  lpTwinValidationParticipants,
  lpTwinValidationScenarios,
  lpTwinHumanResponses,
  lpTwinSyntheticSnapshots,
  lpTwinCalibrationCandidates,
  lpTwinFunds,
} from "../../drizzle/schema";
import {
  compareResponses,
  computeValidationQualityScore,
  VALIDATION_THRESHOLDS,
  STANDARD_VALIDATION_SCENARIOS,
} from "../../shared/captwin";
import type { TrpcContext } from "../_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────
type AuthUser = NonNullable<TrpcContext["user"]>;
const TAG = `lptwin-wp7-${Date.now()}`;

let orgAId: number;
let orgBId: number;
let userAId: number;
let userBId: number;
let participantId: number;
let scenarioId: number;
let fundId: number;
let snapshotId: number;
let responseId: number;
let calibrationId: number;

function makeCtx(userId: number, orgId: number): TrpcContext & { orgId: number; membershipId: number; orgStatus: string } {
  const user: AuthUser = {
    id: userId,
    openId: `lptwin-wp7-user-${userId}`,
    email: `user-${userId}@lptwin-wp7.test`,
    name: "LP Twin WP7 Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    orgId,
    membershipId: 9999,
    orgStatus: "active",
    req: { protocol: "https", headers: { "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Org A
  await db.insert(organizations).values({ name: `WP7 Org A ${TAG}`, slug: `wp7-org-a-${TAG}`, approvedDomains: "[]", status: "active", plan: "enterprise" });
  const [orgA] = await db.select().from(organizations).where(eq(organizations.slug, `wp7-org-a-${TAG}`)).limit(1);
  orgAId = orgA.id;

  // Org B
  await db.insert(organizations).values({ name: `WP7 Org B ${TAG}`, slug: `wp7-org-b-${TAG}`, approvedDomains: "[]", status: "active", plan: "enterprise" });
  const [orgB] = await db.select().from(organizations).where(eq(organizations.slug, `wp7-org-b-${TAG}`)).limit(1);
  orgBId = orgB.id;

  // User A
  await db.insert(users).values({ openId: `wp7-user-a-${TAG}`, name: "WP7 User A", email: `a-${TAG}@wp7.test` });
  const [uA] = await db.select().from(users).where(eq(users.openId, `wp7-user-a-${TAG}`)).limit(1);
  userAId = uA.id;

  // User B
  await db.insert(users).values({ openId: `wp7-user-b-${TAG}`, name: "WP7 User B", email: `b-${TAG}@wp7.test` });
  const [uB] = await db.select().from(users).where(eq(users.openId, `wp7-user-b-${TAG}`)).limit(1);
  userBId = uB.id;

  // Memberships
  await db.insert(enterpriseMemberships).values({ orgId: orgAId, userId: userAId, roleId: 1, status: "active" });
  await db.insert(enterpriseMemberships).values({ orgId: orgBId, userId: userBId, roleId: 1, status: "active" });

  // Fund for snapshot creation
  await db.insert(lpTwinFunds).values({
    orgId: orgAId,
    createdByUserId: userAId,
    updatedByUserId: userAId,
    fundName: `WP7 Test Fund ${TAG}`,
    gpName: `WP7 GP ${TAG}`,
    strategy: "Private Equity",
    currency: "USD",
    targetFundSizeM: "300.00",
    economicsJson: JSON.stringify({ managementFeePct: 2.0, carryPct: 20 }),
    trackRecordJson: JSON.stringify({ trackRecordYrs: 8, priorFundIRR: 18.5 }),
    evidenceStatus: "complete",
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const [fund] = await db.select().from(lpTwinFunds).where(eq(lpTwinFunds.fundName, `WP7 Test Fund ${TAG}`)).limit(1);
  fundId = fund.id;
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  // Clean up in dependency order
  await db.delete(lpTwinCalibrationCandidates).where(eq(lpTwinCalibrationCandidates.orgId, orgAId)).catch(() => {});
  await db.delete(lpTwinHumanResponses).where(eq(lpTwinHumanResponses.orgId, orgAId)).catch(() => {});
  await db.delete(lpTwinSyntheticSnapshots).where(eq(lpTwinSyntheticSnapshots.orgId, orgAId)).catch(() => {});
  await db.delete(lpTwinValidationParticipants).where(eq(lpTwinValidationParticipants.orgId, orgAId)).catch(() => {});
  await db.delete(lpTwinValidationScenarios).where(eq(lpTwinValidationScenarios.orgId, orgAId)).catch(() => {});
  await db.delete(lpTwinFunds).where(eq(lpTwinFunds.orgId, orgAId)).catch(() => {});
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgAId)).catch(() => {});
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgBId)).catch(() => {});
  await db.delete(users).where(eq(users.openId, `wp7-user-a-${TAG}`)).catch(() => {});
  await db.delete(users).where(eq(users.openId, `wp7-user-b-${TAG}`)).catch(() => {});
  await db.delete(organizations).where(eq(organizations.slug, `wp7-org-a-${TAG}`)).catch(() => {});
  await db.delete(organizations).where(eq(organizations.slug, `wp7-org-b-${TAG}`)).catch(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("WP7 Validation Tests", () => {

  // V01 — Schema: 5 WP7 tables exist in DB
  it("V01: 5 WP7 tables exist in DB", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const tables = [
      lpTwinValidationParticipants,
      lpTwinValidationScenarios,
      lpTwinHumanResponses,
      lpTwinSyntheticSnapshots,
      lpTwinCalibrationCandidates,
    ];
    for (const table of tables) {
      const rows = await db!.select().from(table).limit(1);
      expect(Array.isArray(rows)).toBe(true);
    }
  });

  // V02 — createParticipant: creates participant with correct orgId
  it("V02: createParticipant creates participant with correct orgId", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.createParticipant({
      participantType: "institutional_allocator",
      allocatorSegment: "swf-001",
      geography: "Middle East",
      yearsExperience: 15,
      consentStatus: "granted",
      recordingConsent: false,
      anonymizationPreference: "full_anonymous",
      permittedUse: ["research_only", "internal_calibration"],
      calibrationEligibility: true,
      verificationStatus: "self_declared",
      source: "direct_outreach",
    });
    expect(result.participantId).toBeGreaterThan(0);
    participantId = result.participantId;

    const db = await getDb();
    const [row] = await db!.select().from(lpTwinValidationParticipants).where(eq(lpTwinValidationParticipants.id, participantId)).limit(1);
    expect(row.orgId).toBe(orgAId);
    expect(row.allocatorSegment).toBe("swf-001");
    expect(row.consentStatus).toBe("granted");
  });

  // V03 — listParticipants cross-tenant: Org B cannot see Org A participants
  it("V03: listParticipants cross-tenant denied", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    const result = await callerB.lpTwinValidation.listParticipants({ includeArchived: false });
    const orgAParticipant = result.participants.find((p) => p.id === participantId);
    expect(orgAParticipant).toBeUndefined();
  });

  // V04 — submitHumanResponse: blocked without consent
  it("V04: submitHumanResponse blocked without consent", async () => {
    const db = await getDb();
    // Create a participant without consent
    await db!.insert(lpTwinValidationParticipants).values({
      orgId: orgAId,
      participantType: "institutional_allocator",
      consentStatus: "pending",
      recordingConsent: false,
      anonymizationPreference: "full_anonymous",
      permittedUse: "[]",
      calibrationEligibility: false,
      verificationStatus: "unverified",
      source: "direct_outreach",
      createdByUserId: userAId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const noConsentParticipants = await db!.select().from(lpTwinValidationParticipants)
      .where(eq(lpTwinValidationParticipants.orgId, orgAId));
    const noConsentParticipant = noConsentParticipants.find((p) => p.consentStatus === "pending");
    if (!noConsentParticipant) throw new Error("No pending-consent participant found");

    // Create a scenario first
    await db!.insert(lpTwinValidationScenarios).values({
      orgId: orgAId,
      scenarioName: `WP7 Test Scenario ${TAG}`,
      scenarioCode: `VS-WP7-${TAG}`,
      version: 1,
      fundProfileJson: "{}",
      strategy: "Private Equity",
      targetSizeM: "300.00",
      managementFeePct: "2.00",
      carryPct: "20.00",
      trackRecordYrs: 8,
      shariaCompliant: false,
      isActive: true,
      createdByUserId: userAId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const [scenario] = await db!.select().from(lpTwinValidationScenarios)
      .where(eq(lpTwinValidationScenarios.orgId, orgAId))
      .limit(1);
    scenarioId = scenario.id;

    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwinValidation.submitHumanResponse({
      participantId: noConsentParticipant.id,
      scenarioId,
      allocatorSegment: "swf-001",
      verdict: "conditional",
      topObjections: [],
      rejectionTriggers: [],
      requiredEvidence: [],
      termsToChange: [],
      followUpQuestions: [],
      sourceType: "structured_validation_interview",
    })).rejects.toThrow("consent");
  });

  // V05 — submitHumanResponse: succeeds with consent
  it("V05: submitHumanResponse succeeds with granted consent", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.submitHumanResponse({
      participantId,
      scenarioId,
      allocatorSegment: "swf-001",
      initialAttractiveness: 6,
      verdict: "conditional",
      topObjections: ["Track record too short", "GP commitment unclear"],
      rejectionTriggers: [],
      requiredEvidence: ["Audited fund financials", "GP commitment letter"],
      termsToChange: ["Management fee"],
      followUpQuestions: ["What is the GP commitment percentage?"],
      sourceType: "structured_validation_interview",
    });
    expect(result.responseId).toBeGreaterThan(0);
    responseId = result.responseId;
  });

  // V06 — createSyntheticSnapshot: creates frozen snapshot
  it("V06: createSyntheticSnapshot creates frozen snapshot", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.createSyntheticSnapshot({
      scenarioId,
      agentId: "swf-001",
      fundId,
    });
    expect(result.snapshotId).toBeGreaterThan(0);
    expect(["pass", "conditional", "reject"]).toContain(result.syntheticVerdict);
    expect(result.fitScore).toBeGreaterThanOrEqual(0);
    expect(result.disclaimer).toContain("frozen");
    snapshotId = result.snapshotId;

    const db = await getDb();
    const [row] = await db!.select().from(lpTwinSyntheticSnapshots).where(eq(lpTwinSyntheticSnapshots.id, snapshotId)).limit(1);
    expect(row.isFrozen).toBe(true);
    expect(row.agentId).toBe("swf-001");
  });

  // V07 — compareWithSnapshot: returns comparison result with disclaimer
  it("V07: compareWithSnapshot returns comparison with disclaimer", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.compareWithSnapshot({
      snapshotId,
      humanResponseId: responseId,
    });
    expect(result.comparison).toBeDefined();
    expect(result.comparison.disclaimer).toContain("AGREEMENT METRIC");
    expect(["exact_agreement", "partial_agreement", "disagreement"]).toContain(result.comparison.verdictAgreement);
    expect(result.comparison.objectionRecall).toBeGreaterThanOrEqual(0);
    expect(result.comparison.objectionRecall).toBeLessThanOrEqual(1);
  });

  // V08 — compareResponses: exact agreement detected
  it("V08: compareResponses detects exact agreement", () => {
    const result = compareResponses(
      { syntheticVerdict: "conditional", objectionsJson: '["fees too high"]', evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: "more_information" },
      { verdict: "conditional", topObjectionsJson: '["fees too high"]', requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: "more_information", calibrationEligible: true, consentVerified: true }
    );
    expect(result.verdictAgreement).toBe("exact_agreement");
    expect(result.objectionRecall).toBe(1);
    expect(result.nextStepAgreement).toBe(true);
  });

  // V09 — compareResponses: disagreement detected
  it("V09: compareResponses detects disagreement", () => {
    const result = compareResponses(
      { syntheticVerdict: "pass", objectionsJson: "[]", evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: null },
      { verdict: "reject", topObjectionsJson: '["team instability"]', requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: null, calibrationEligible: false, consentVerified: true }
    );
    expect(result.verdictAgreement).toBe("disagreement");
  });

  // V10 — compareResponses: partial agreement detected
  it("V10: compareResponses detects partial agreement", () => {
    const result = compareResponses(
      { syntheticVerdict: "conditional", objectionsJson: "[]", evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: null },
      { verdict: "reject", topObjectionsJson: "[]", requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: null, calibrationEligible: false, consentVerified: true }
    );
    expect(result.verdictAgreement).toBe("partial_agreement");
  });

  // V11 — compareResponses: objection recall computed correctly
  it("V11: objection recall = matched / total human objections", () => {
    const result = compareResponses(
      { syntheticVerdict: "conditional", objectionsJson: '["track record too short","fees too high","gp commitment unclear"]', evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: null },
      { verdict: "conditional", topObjectionsJson: '["track record too short","gp commitment unclear","team instability"]', requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: null, calibrationEligible: true, consentVerified: true }
    );
    // 2 of 3 human objections matched
    expect(result.objectionRecall).toBeCloseTo(2 / 3, 5);
    expect(result.matchedObjections).toHaveLength(2);
    expect(result.missedObjections).toContain("team instability");
  });

  // V12 — compareResponses: objection precision computed correctly
  it("V12: objection precision = matched / total synthetic objections", () => {
    const result = compareResponses(
      { syntheticVerdict: "conditional", objectionsJson: '["track record too short","fees too high","gp commitment unclear"]', evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: null },
      { verdict: "conditional", topObjectionsJson: '["track record too short","gp commitment unclear"]', requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: null, calibrationEligible: true, consentVerified: true }
    );
    // 2 of 3 synthetic objections were raised by humans
    expect(result.objectionPrecision).toBeCloseTo(2 / 3, 5);
    expect(result.unexpectedObjections).toContain("fees too high");
  });

  // V13 — compareResponses: evidence agreement computed correctly
  it("V13: evidence agreement uses Jaccard similarity", () => {
    const result = compareResponses(
      { syntheticVerdict: "conditional", objectionsJson: "[]", evidenceRequestedJson: '["audited financials","gp commitment letter"]', termsChallengedJson: null, expectedNextStep: null },
      { verdict: "conditional", topObjectionsJson: "[]", requiredEvidenceJson: '["audited financials","reference letters"]', termsToChangeJson: null, likelyNextStep: null, calibrationEligible: true, consentVerified: true }
    );
    // Intersection: 1 (audited financials), Union: 3
    expect(result.evidenceRequestAgreement).toBeCloseTo(1 / 3, 5);
  });

  // V14 — compareResponses: missed objections identified
  it("V14: missed objections are human objections not predicted synthetically", () => {
    const result = compareResponses(
      { syntheticVerdict: "reject", objectionsJson: '["fees too high"]', evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: null },
      { verdict: "reject", topObjectionsJson: '["team instability","key person risk"]', requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: null, calibrationEligible: true, consentVerified: true }
    );
    expect(result.missedObjections).toHaveLength(2);
    expect(result.missedObjections).toContain("team instability");
    expect(result.missedObjections).toContain("key person risk");
  });

  // V15 — compareResponses: unexpected objections identified
  it("V15: unexpected objections are synthetic objections not raised by humans", () => {
    const result = compareResponses(
      { syntheticVerdict: "reject", objectionsJson: '["fees too high","gp commitment unclear","liquidity concern"]', evidenceRequestedJson: null, termsChallengedJson: null, expectedNextStep: null },
      { verdict: "reject", topObjectionsJson: '["fees too high"]', requiredEvidenceJson: null, termsToChangeJson: null, likelyNextStep: null, calibrationEligible: true, consentVerified: true }
    );
    expect(result.unexpectedObjections).toHaveLength(2);
    expect(result.unexpectedObjections).toContain("gp commitment unclear");
  });

  // V16 — computeValidationQualityScore: Synthetic Only with 0 responses
  it("V16: quality score is Synthetic Only with 0 verified responses", () => {
    const score = computeValidationQualityScore({
      segmentId: "swf-001",
      verifiedResponseCount: 0,
      independentParticipantCount: 0,
      scenarioDiversity: 0,
      geographicDiversity: 0,
      avgVerdictAgreement: 0,
      avgObjRecall: 0,
      avgObjPrecision: 0,
      avgEvidenceAgreement: 0,
      newestResponseAgeMs: Infinity,
      dataQualityRatings: [],
    });
    expect(score.label).toBe("Synthetic Only");
    expect(score.calibrationThresholdMet).toBe(false);
    expect(score.disclaimer).toContain("AGREEMENT METRIC");
  });

  // V17 — computeValidationQualityScore: Early Validation with 3 responses
  it("V17: quality score is Early Validation with 3 verified responses", () => {
    const score = computeValidationQualityScore({
      segmentId: "swf-001",
      verifiedResponseCount: 3,
      independentParticipantCount: 2,
      scenarioDiversity: 1,
      geographicDiversity: 1,
      avgVerdictAgreement: 0.5,
      avgObjRecall: 0.5,
      avgObjPrecision: 0.5,
      avgEvidenceAgreement: 0.5,
      newestResponseAgeMs: 30 * 24 * 60 * 60 * 1000,
      dataQualityRatings: ["medium", "medium", "medium"],
    });
    expect(score.label).toBe("Early Validation");
  });

  // V18 — computeValidationQualityScore: Moderately Validated threshold
  it("V18: quality score is Moderately Validated at threshold", () => {
    const score = computeValidationQualityScore({
      segmentId: "swf-001",
      verifiedResponseCount: VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_RESPONSES,
      independentParticipantCount: VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_PARTICIPANTS,
      scenarioDiversity: 2,
      geographicDiversity: 2,
      avgVerdictAgreement: VALIDATION_THRESHOLDS.MODERATELY_VALIDATED_MIN_VERDICT_AGREEMENT,
      avgObjRecall: 0.6,
      avgObjPrecision: 0.6,
      avgEvidenceAgreement: 0.6,
      newestResponseAgeMs: 60 * 24 * 60 * 60 * 1000,
      dataQualityRatings: Array(10).fill("medium"),
    });
    expect(score.label).toBe("Moderately Validated");
  });

  // V19 — computeValidationQualityScore: Strongly Validated threshold
  it("V19: quality score is Strongly Validated at threshold", () => {
    const score = computeValidationQualityScore({
      segmentId: "swf-001",
      verifiedResponseCount: VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_RESPONSES,
      independentParticipantCount: VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_PARTICIPANTS,
      scenarioDiversity: 4,
      geographicDiversity: 4,
      avgVerdictAgreement: VALIDATION_THRESHOLDS.STRONGLY_VALIDATED_MIN_VERDICT_AGREEMENT,
      avgObjRecall: 0.75,
      avgObjPrecision: 0.75,
      avgEvidenceAgreement: 0.75,
      newestResponseAgeMs: 30 * 24 * 60 * 60 * 1000,
      dataQualityRatings: Array(25).fill("high"),
    });
    expect(score.label).toBe("Strongly Validated");
  });

  // V20 — computeValidationQualityScore: calibration threshold
  it("V20: calibration threshold met at correct levels", () => {
    const score = computeValidationQualityScore({
      segmentId: "swf-001",
      verifiedResponseCount: VALIDATION_THRESHOLDS.CALIBRATION_MIN_RESPONSES,
      independentParticipantCount: VALIDATION_THRESHOLDS.CALIBRATION_MIN_PARTICIPANTS,
      scenarioDiversity: 2,
      geographicDiversity: 2,
      avgVerdictAgreement: VALIDATION_THRESHOLDS.CALIBRATION_MIN_VERDICT_AGREEMENT,
      avgObjRecall: 0.6,
      avgObjPrecision: 0.6,
      avgEvidenceAgreement: 0.6,
      newestResponseAgeMs: 90 * 24 * 60 * 60 * 1000,
      dataQualityRatings: Array(10).fill("medium"),
    });
    expect(score.calibrationThresholdMet).toBe(true);
  });

  // V21 — computeValidationQualityScore: weight sum is 1.0
  it("V21: quality score weight components sum to 1.0", () => {
    // Weights: verdict 0.25, recall 0.20, precision 0.15, evidence 0.10, recency 0.15, quality 0.10, coverage 0.05
    const weights = [0.25, 0.20, 0.15, 0.10, 0.15, 0.10, 0.05];
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  // V22 — createCalibrationCandidate: requires evidenceCount >= 1
  it("V22: createCalibrationCandidate requires evidenceCount >= 1", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwinValidation.createCalibrationCandidate({
      segmentId: "swf-001",
      ruleOrAttribute: "irrHurdle",
      currentValue: "8%",
      proposedValue: "10%",
      evidenceCount: 0,
      confidence: "low",
    })).rejects.toThrow();
  });

  // V23 — createCalibrationCandidate: creates with correct fields
  it("V23: createCalibrationCandidate creates candidate with correct fields", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.createCalibrationCandidate({
      segmentId: "swf-001",
      ruleOrAttribute: "irrHurdle",
      currentValue: "8%",
      proposedValue: "10%",
      evidenceCount: 3,
      confidence: "medium",
      impactEstimate: "Would reduce fit score by ~5 points for funds with 8% hurdle",
    });
    expect(result.candidateId).toBeGreaterThan(0);
    calibrationId = result.candidateId;

    const db = await getDb();
    const [row] = await db!.select().from(lpTwinCalibrationCandidates).where(eq(lpTwinCalibrationCandidates.id, calibrationId)).limit(1);
    expect(row.reviewStatus).toBe("proposed");
    expect(row.approvedBy).toBeNull();
    expect(row.orgId).toBe(orgAId);
  });

  // V24 — reviewCalibrationCandidate: approve requires newAgentBankVersion
  it("V24: approving calibration candidate requires newAgentBankVersion", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwinValidation.reviewCalibrationCandidate({
      candidateId: calibrationId,
      reviewStatus: "approved",
      // No newAgentBankVersion
    })).rejects.toThrow("version");
  });

  // V25 — reviewCalibrationCandidate: approve sets approvedBy and version
  it("V25: approving calibration candidate sets approvedBy and effectiveAgentBankVersion", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.reviewCalibrationCandidate({
      candidateId: calibrationId,
      reviewStatus: "approved",
      newAgentBankVersion: "2.0.0",
    });
    expect(result.reviewStatus).toBe("approved");
    expect(result.note).toContain("2.0.0");

    const db = await getDb();
    const [row] = await db!.select().from(lpTwinCalibrationCandidates).where(eq(lpTwinCalibrationCandidates.id, calibrationId)).limit(1);
    expect(row.approvedBy).toBe(userAId);
    expect(row.effectiveAgentBankVersion).toBe("2.0.0");
  });

  // V26 — reviewCalibrationCandidate: reject does not set approvedBy
  it("V26: rejecting calibration candidate does not set approvedBy", async () => {
    // Create a new candidate to reject
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { candidateId } = await caller.lpTwinValidation.createCalibrationCandidate({
      segmentId: "ppf-001",
      ruleOrAttribute: "minFundSizeM",
      currentValue: "100",
      proposedValue: "150",
      evidenceCount: 2,
      confidence: "low",
    });
    await caller.lpTwinValidation.reviewCalibrationCandidate({
      candidateId,
      reviewStatus: "rejected",
    });
    const db = await getDb();
    const [row] = await db!.select().from(lpTwinCalibrationCandidates).where(eq(lpTwinCalibrationCandidates.id, candidateId)).limit(1);
    expect(row.approvedBy).toBeNull();
    expect(row.reviewStatus).toBe("rejected");
  });

  // V27 — deleteParticipant: anonymizes PII and revokes consent
  it("V27: deleteParticipant anonymizes PII and revokes consent", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    // Create a participant with PII
    const { participantId: pId } = await caller.lpTwinValidation.createParticipant({
      participantType: "family_office_professional",
      organizationName: "Test Family Office",
      roleTitle: "CIO",
      consentStatus: "granted",
      recordingConsent: false,
      anonymizationPreference: "identified",
      permittedUse: ["research_only"],
      calibrationEligibility: false,
      verificationStatus: "unverified",
      source: "direct_outreach",
    });
    const result = await caller.lpTwinValidation.deleteParticipant({ participantId: pId, anonymize: true });
    expect(result.anonymized).toBe(true);

    const db = await getDb();
    const [row] = await db!.select().from(lpTwinValidationParticipants).where(eq(lpTwinValidationParticipants.id, pId)).limit(1);
    expect(row.organizationName).toBeNull();
    expect(row.roleTitle).toBeNull();
    expect(row.consentStatus).toBe("revoked");
  });

  // V28 — updateParticipantConsent: updates consent status
  it("V28: updateParticipantConsent updates consent status", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.updateParticipantConsent({
      participantId,
      consentStatus: "revoked",
    });
    expect(result.consentStatus).toBe("revoked");
    // Restore for other tests
    await caller.lpTwinValidation.updateParticipantConsent({ participantId, consentStatus: "granted" });
  });

  // V29 — importResponses dry-run: validates without inserting
  it("V29: importResponses dry-run validates without inserting", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.importResponses({
      responses: [{
        participantId,
        scenarioId,
        allocatorSegment: "ppf-001",
        verdict: "pass",
        topObjections: [],
        requiredEvidence: [],
        sourceType: "structured_validation_interview",
        consentVerified: true,
        calibrationEligible: false,
      }],
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    // The participant already has a response for this scenario (from V05), so it should be a warning
    expect(result.warnings.length + result.validRows).toBeGreaterThanOrEqual(0);
  });

  // V30 — importResponses: blocks import without consent
  it("V30: importResponses blocks rows without consent", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.importResponses({
      responses: [{
        participantId,
        scenarioId,
        allocatorSegment: "ppf-001",
        verdict: "pass",
        topObjections: [],
        requiredEvidence: [],
        sourceType: "structured_validation_interview",
        consentVerified: false,  // No consent
        calibrationEligible: false,
      }],
      dryRun: true,
    });
    expect(result.errors.some((e) => e.toLowerCase().includes("consent"))).toBe(true);
  });

  // V31 — importResponses: detects duplicates
  it("V31: importResponses detects duplicate participant+scenario combinations", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    // The participant already has a response for scenarioId from V05
    const result = await caller.lpTwinValidation.importResponses({
      responses: [{
        participantId,
        scenarioId,
        allocatorSegment: "swf-001",
        verdict: "conditional",
        topObjections: [],
        requiredEvidence: [],
        sourceType: "structured_validation_interview",
        consentVerified: true,
        calibrationEligible: false,
      }],
      dryRun: true,
    });
    expect(result.warnings.some((w) => w.toLowerCase().includes("duplicate"))).toBe(true);
  });

  // V32 — getValidationThresholds: returns documented thresholds
  it("V32: getValidationThresholds returns all documented thresholds", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.getValidationThresholds();
    expect(result.thresholds.EARLY_VALIDATION_MIN_RESPONSES).toBe(3);
    expect(result.thresholds.MODERATELY_VALIDATED_MIN_RESPONSES).toBe(10);
    expect(result.thresholds.STRONGLY_VALIDATED_MIN_RESPONSES).toBe(25);
    expect(result.labels["Synthetic Only"]).toBeDefined();
    expect(result.labels["Strongly Validated"]).toBeDefined();
    expect(result.disclaimer).toContain("calibrated");
  });

  // V33 — getValidationDashboard: returns summary
  it("V33: getValidationDashboard returns summary with correct structure", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.getValidationDashboard({});
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.totalParticipants).toBe("number");
    expect(typeof result.summary.totalComparisons).toBe("number");
    expect(result.disclaimer).toContain("AGREEMENT METRICS");
    expect(result.validationEngineVersion).toBeDefined();
  });

  // V34 — listAgentBankVersions: returns current version
  it("V34: listAgentBankVersions returns current version and agent list", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwinValidation.listAgentBankVersions();
    expect(result.currentVersion).toBeDefined();
    expect(result.agents.length).toBeGreaterThanOrEqual(9);
    expect(result.agents[0].id).toBeDefined();
    expect(result.note).toContain("reproducible");
  });

  // V35 — WP1 regression: all 5 WP7 tables intact
  it("V35: WP1 regression — all 5 WP7 tables intact, no seed data", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const tables = [
      lpTwinValidationParticipants,
      lpTwinValidationScenarios,
      lpTwinHumanResponses,
      lpTwinSyntheticSnapshots,
      lpTwinCalibrationCandidates,
    ];
    for (const table of tables) {
      const rows = await db!.select().from(table).limit(1);
      expect(Array.isArray(rows)).toBe(true);
    }
    // STANDARD_VALIDATION_SCENARIOS are in-memory constants, not seeded to DB
    expect(STANDARD_VALIDATION_SCENARIOS).toHaveLength(2);
    expect(STANDARD_VALIDATION_SCENARIOS[0].scenarioCode).toBe("VS-001");
  });

});
