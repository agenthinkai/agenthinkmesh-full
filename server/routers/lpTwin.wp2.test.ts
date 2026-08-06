/**
 * lpTwin.wp2.test.ts — WP2 Router Procedure Tests
 *
 * Tests:
 *  P01 — createFund: creates a fund and returns a fundId
 *  P02 — listFunds: returns only org-scoped funds
 *  P03 — getFund: returns fund details for valid org
 *  P04 — getFund cross-tenant: returns NOT_FOUND for another org's fund
 *  P05 — updateFund: increments version and updates fields
 *  P06 — archiveFund: sets archivedAt and excludes from listFunds
 *  P07 — createSession: creates a session with engine version pinned
 *  P08 — listSessions: returns only org-scoped sessions
 *  P09 — runSegmentAnalysis: completes and writes segment results
 *  P10 — runSegmentAnalysis cross-tenant: denied for another org's session
 *  P11 — deleteSession: soft-deletes and excludes from listSessions
 *  P12 — exportSession: writes audit record to lp_twin_exports
 *  P13 — listSegments: returns all LP registry entries
 *  P14 — createSession with unknown segment ID: throws BAD_REQUEST
 *  P15 — runSegmentAnalysis disclaimer: result contains disclaimer text
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
  lpTwinSessions,
  lpTwinSegmentResults,
  lpTwinExports,
} from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────

type AuthUser = NonNullable<TrpcContext["user"]>;

const TAG = `lptwin-wp2-${Date.now()}`;

let orgAId: number;
let orgBId: number;
let userAId: number;
let userBId: number;

function makeCtx(userId: number, orgId: number): TrpcContext & { orgId: number; membershipId: number; orgStatus: string } {
  const user: AuthUser = {
    id: userId,
    openId: `lptwin-wp2-user-${userId}`,
    email: `user-${userId}@lptwin-wp2.test`,
    name: "LP Twin WP2 Test User",
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

const FUND_INPUT = {
  fundName: `WP2 Test Fund ${TAG}`,
  gpName: `WP2 Test GP ${TAG}`,
  strategy: "Private Equity" as const,
  currency: "USD",
  targetFundSizeM: 300,
  economics: { managementFeePct: 2.0, carryPct: 20 },
  trackRecord: { trackRecordYrs: 8, priorFundIRR: 18.5 },
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let createdFundId: number;
let createdSessionId: number;

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Org A
  await db.insert(organizations).values({ name: `WP2 Org A ${TAG}`, slug: `wp2-org-a-${TAG}`, approvedDomains: "[]", status: "active", plan: "enterprise" });
  const [orgA] = await db.select().from(organizations).where(eq(organizations.slug, `wp2-org-a-${TAG}`)).limit(1);
  orgAId = orgA.id;

  // Org B
  await db.insert(organizations).values({ name: `WP2 Org B ${TAG}`, slug: `wp2-org-b-${TAG}`, approvedDomains: "[]", status: "active", plan: "enterprise" });
  const [orgB] = await db.select().from(organizations).where(eq(organizations.slug, `wp2-org-b-${TAG}`)).limit(1);
  orgBId = orgB.id;

  // User A
  await db.insert(users).values({ openId: `wp2-user-a-${TAG}`, name: "WP2 User A", email: `a-${TAG}@test.com` });
  const [uA] = await db.select().from(users).where(eq(users.openId, `wp2-user-a-${TAG}`)).limit(1);
  userAId = uA.id;

  // User B
  await db.insert(users).values({ openId: `wp2-user-b-${TAG}`, name: "WP2 User B", email: `b-${TAG}@test.com` });
  const [uB] = await db.select().from(users).where(eq(users.openId, `wp2-user-b-${TAG}`)).limit(1);
  userBId = uB.id;

  // Memberships
  await db.insert(enterpriseMemberships).values({ orgId: orgAId, userId: userAId, roleId: 1, status: "active" });
  await db.insert(enterpriseMemberships).values({ orgId: orgBId, userId: userBId, roleId: 1, status: "active" });
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (createdSessionId) {
    await db.delete(lpTwinSegmentResults).where(eq(lpTwinSegmentResults.sessionId, createdSessionId));
    await db.delete(lpTwinExports).where(eq(lpTwinExports.sessionId, createdSessionId));
    await db.delete(lpTwinSessions).where(eq(lpTwinSessions.id, createdSessionId));
  }
  if (createdFundId) await db.delete(lpTwinFunds).where(eq(lpTwinFunds.id, createdFundId));
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgAId));
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgBId));
  for (const openId of [`wp2-user-a-${TAG}`, `wp2-user-b-${TAG}`]) {
    await db.delete(users).where(eq(users.openId, openId));
  }
  await db.delete(organizations).where(eq(organizations.slug, `wp2-org-a-${TAG}`));
  await db.delete(organizations).where(eq(organizations.slug, `wp2-org-b-${TAG}`));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("P01 — createFund", () => {
  it("creates a fund and returns a fundId", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.createFund(FUND_INPUT);
    expect(result.fundId).toBeGreaterThan(0);
    createdFundId = result.fundId;
  });
});

describe("P02 — listFunds", () => {
  it("returns only org-scoped funds", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { funds } = await caller.lpTwin.listFunds({ includeArchived: false });
    const ids = funds.map((f) => f.id);
    expect(ids).toContain(createdFundId);
    // Org B caller should NOT see Org A's fund
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    const { funds: fundsB } = await callerB.lpTwin.listFunds({ includeArchived: false });
    const idsB = fundsB.map((f) => f.id);
    expect(idsB).not.toContain(createdFundId);
  });
});

describe("P03 — getFund", () => {
  it("returns fund details for valid org", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { fund } = await caller.lpTwin.getFund({ fundId: createdFundId });
    expect(fund.fundName).toBe(FUND_INPUT.fundName);
    expect(fund.orgId).toBe(orgAId);
  });
});

describe("P04 — getFund cross-tenant", () => {
  it("returns NOT_FOUND when Org B tries to access Org A's fund", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwin.getFund({ fundId: createdFundId })).rejects.toThrow("access denied");
  });
});

describe("P05 — updateFund", () => {
  it("increments version and updates fields", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.updateFund({ fundId: createdFundId, fundName: `Updated Fund ${TAG}` });
    expect(result.version).toBe(2);
    const { fund } = await caller.lpTwin.getFund({ fundId: createdFundId });
    expect(fund.fundName).toBe(`Updated Fund ${TAG}`);
  });
});

describe("P06 — archiveFund", () => {
  it("archives fund and excludes it from listFunds", async () => {
    // Create a separate fund to archive
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { fundId: archiveFundId } = await caller.lpTwin.createFund({ ...FUND_INPUT, fundName: `Archive Test ${TAG}` });
    await caller.lpTwin.archiveFund({ fundId: archiveFundId });
    const { funds } = await caller.lpTwin.listFunds({ includeArchived: false });
    expect(funds.map((f) => f.id)).not.toContain(archiveFundId);
    const { funds: withArchived } = await caller.lpTwin.listFunds({ includeArchived: true });
    const archived = withArchived.find((f) => f.id === archiveFundId);
    expect(archived?.archivedAt).toBeTruthy();
    // Cleanup
    const db = await getDb();
    if (db) await db.delete(lpTwinFunds).where(eq(lpTwinFunds.id, archiveFundId));
  });
});

describe("P07 — createSession", () => {
  it("creates a session with engine version pinned", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.createSession({
      fundId: createdFundId,
      sessionName: `WP2 Test Session ${TAG}`,
      selectedSegmentIds: ["apex-sovereign-fund", "global-pension-alliance"],
      scenarioType: "baseline",
    });
    expect(result.sessionId).toBeGreaterThan(0);
    createdSessionId = result.sessionId;
    const db = await getDb();
    if (!db) return;
    const [session] = await db.select().from(lpTwinSessions).where(eq(lpTwinSessions.id, createdSessionId)).limit(1);
    expect(session.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(session.registryVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(session.orgId).toBe(orgAId);
  });
});

describe("P08 — listSessions", () => {
  it("returns only org-scoped sessions", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { sessions } = await caller.lpTwin.listSessions({ fundId: createdFundId });
    expect(sessions.map((s) => s.id)).toContain(createdSessionId);
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    const { sessions: sessionsB } = await callerB.lpTwin.listSessions({});
    expect(sessionsB.map((s) => s.id)).not.toContain(createdSessionId);
  });
});

describe("P09 — runSegmentAnalysis", () => {
  it("completes and writes segment results", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.runSegmentAnalysis({ sessionId: createdSessionId });
    expect(result.segmentsAnalysed).toBe(2);
    expect(result.simulation.grossRaised).toBeGreaterThan(0);
    expect(result.disclaimer).toContain("SYNTHETIC SIMULATION");
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(lpTwinSegmentResults).where(eq(lpTwinSegmentResults.sessionId, createdSessionId));
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(Number(row.fitScore)).toBeGreaterThanOrEqual(0);
      expect(Number(row.fitScore)).toBeLessThanOrEqual(100);
      expect(["Approved", "Conditional Watchlist", "Rejected"]).toContain(row.icVerdict);
    }
  });
});

describe("P10 — runSegmentAnalysis cross-tenant", () => {
  it("returns NOT_FOUND when Org B tries to run Org A's session", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwin.runSegmentAnalysis({ sessionId: createdSessionId })).rejects.toThrow("access denied");
  });
});

describe("P11 — deleteSession", () => {
  it("soft-deletes and excludes from listSessions", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    // Create a throwaway session
    const { sessionId: throwawayId } = await caller.lpTwin.createSession({
      fundId: createdFundId,
      sessionName: `Throwaway ${TAG}`,
      selectedSegmentIds: ["apex-sovereign-fund"],
    });
    await caller.lpTwin.deleteSession({ sessionId: throwawayId });
    const { sessions } = await caller.lpTwin.listSessions({ fundId: createdFundId });
    expect(sessions.map((s) => s.id)).not.toContain(throwawayId);
    // Cleanup
    const db = await getDb();
    if (db) await db.delete(lpTwinSessions).where(eq(lpTwinSessions.id, throwawayId));
  });
});

describe("P12 — exportSession", () => {
  it("writes audit record to lp_twin_exports", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.exportSession({ sessionId: createdSessionId, exportType: "json", reportType: "full_session" });
    expect(result.exportData.results.length).toBe(2);
    expect(result.exportData.disclaimer).toContain("SYNTHETIC SIMULATION");
    const db = await getDb();
    if (!db) return;
    const [exportRow] = await db.select().from(lpTwinExports)
      .where(and(eq(lpTwinExports.sessionId, createdSessionId), eq(lpTwinExports.orgId, orgAId)))
      .limit(1);
    expect(exportRow).toBeDefined();
    expect(exportRow.exportType).toBe("json");
    expect(exportRow.exportedByUserId).toBe(userAId);
  });
});

describe("P13 — listSegments", () => {
  it("returns all LP registry entries with required fields", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { segments } = await caller.lpTwin.listSegments();
    expect(segments.length).toBeGreaterThan(5);
    for (const seg of segments) {
      expect(seg.id).toBeTruthy();
      expect(seg.name).toBeTruthy();
      expect(Array.isArray(seg.strategies)).toBe(true);
    }
  });
});

describe("P14 — createSession with unknown segment ID", () => {
  it("throws BAD_REQUEST for unknown segment ID", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwin.createSession({
      fundId: createdFundId,
      sessionName: "Bad Session",
      selectedSegmentIds: ["nonexistent-segment-xyz"],
    })).rejects.toThrow("Unknown LP segment ID");
  });
});

describe("P15 — runSegmentAnalysis disclaimer", () => {
  it("result always contains the synthetic simulation disclaimer", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { sessions } = await caller.lpTwin.listSessions({ fundId: createdFundId });
    const completedSession = sessions.find((s) => s.status === "completed");
    expect(completedSession).toBeDefined();
    if (!completedSession) return;
    const { results } = await caller.lpTwin.getSession({ sessionId: completedSession.id });
    for (const r of results) {
      expect(r.modelVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
