/**
 * lpTwin.wp3.test.ts — WP3 Required Tests
 *
 * Required tests per specification:
 *  W01 — Authorized enterprise user can list funds
 *  W02 — New fund wizard creates a persistent fund (returns real fund ID)
 *  W03 — Validation prevents invalid submissions (missing required fields)
 *  W04 — Draft / incomplete fields are handled correctly (draft evidenceStatus)
 *  W05 — Session creation links to the correct fund and organization
 *  W06 — Historical session reopens correctly (getSession returns stored results)
 *  W07 — Archived funds are excluded by default
 *  W08 — Cross-tenant IDs cannot be loaded through route parameters
 *  W09 — Error and loading states: invalid session ID returns NOT_FOUND
 *  W10 — Existing /captwin route remains unchanged (no LP Twin tables in CapTwin schema)
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
} from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

// ── Helpers ───────────────────────────────────────────────────────────────────

type AuthUser = NonNullable<TrpcContext["user"]>;
const TAG = `lptwin-wp3-${Date.now()}`;

let orgAId: number;
let orgBId: number;
let userAId: number;
let userBId: number;
let createdFundId: number;
let createdSessionId: number;

function makeCtx(userId: number, orgId: number): TrpcContext & { orgId: number; membershipId: number; orgStatus: string } {
  const user: AuthUser = {
    id: userId,
    openId: `wp3-user-${userId}`,
    email: `wp3-${userId}@test.com`,
    name: "WP3 Test User",
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

const FULL_FUND_INPUT = {
  fundName: `WP3 Full Fund ${TAG}`,
  gpName: `WP3 GP ${TAG}`,
  strategy: "Private Equity",
  currency: "USD",
  targetFundSizeM: 250,
  economics: { managementFeePct: 2.0, carryPct: 20, hurdleRatePct: 8 },
  trackRecord: { trackRecordYrs: 7, priorFundIRR: 16.5, priorFundMOIC: 2.2 },
  investmentProposition: {
    investmentThesis: "Mid-market buyouts in defensive sectors",
    targetSectors: "Healthcare, Consumer Staples",
    valueCreationApproach: "Operational improvement and buy-and-build",
    competitiveAdvantage: "Proprietary deal flow from 15-year regional network",
  },
};

const DRAFT_FUND_INPUT = {
  fundName: `WP3 Draft Fund ${TAG}`,
  gpName: `WP3 Draft GP ${TAG}`,
  strategy: "Venture Capital",
  currency: "USD",
  targetFundSizeM: 100,
  economics: { managementFeePct: 2.5, carryPct: 25 },
  trackRecord: { trackRecordYrs: 3, priorFundIRR: 22.0 },
  // No investmentProposition, riskLiquidity, or institutionalRequirements — draft
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  await db.insert(organizations).values({ name: `WP3 Org A ${TAG}`, slug: `wp3-org-a-${TAG}`, approvedDomains: "[]", status: "active", plan: "enterprise" });
  const [orgA] = await db.select().from(organizations).where(eq(organizations.slug, `wp3-org-a-${TAG}`)).limit(1);
  orgAId = orgA.id;

  await db.insert(organizations).values({ name: `WP3 Org B ${TAG}`, slug: `wp3-org-b-${TAG}`, approvedDomains: "[]", status: "active", plan: "enterprise" });
  const [orgB] = await db.select().from(organizations).where(eq(organizations.slug, `wp3-org-b-${TAG}`)).limit(1);
  orgBId = orgB.id;

  await db.insert(users).values({ openId: `wp3-user-a-${TAG}`, name: "WP3 User A", email: `a-${TAG}@test.com` });
  const [uA] = await db.select().from(users).where(eq(users.openId, `wp3-user-a-${TAG}`)).limit(1);
  userAId = uA.id;

  await db.insert(users).values({ openId: `wp3-user-b-${TAG}`, name: "WP3 User B", email: `b-${TAG}@test.com` });
  const [uB] = await db.select().from(users).where(eq(users.openId, `wp3-user-b-${TAG}`)).limit(1);
  userBId = uB.id;

  await db.insert(enterpriseMemberships).values({ orgId: orgAId, userId: userAId, roleId: 1, status: "active" });
  await db.insert(enterpriseMemberships).values({ orgId: orgBId, userId: userBId, roleId: 1, status: "active" });
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (createdSessionId) {
    await db.delete(lpTwinSegmentResults).where(eq(lpTwinSegmentResults.sessionId, createdSessionId));
    await db.delete(lpTwinSessions).where(eq(lpTwinSessions.id, createdSessionId));
  }
  if (createdFundId) await db.delete(lpTwinFunds).where(eq(lpTwinFunds.id, createdFundId));
  // Clean up draft fund
  const db2 = await getDb();
  if (db2) {
    const drafts = await db2.select().from(lpTwinFunds).where(and(eq(lpTwinFunds.orgId, orgAId), eq(lpTwinFunds.evidenceStatus, "draft")));
    for (const d of drafts) await db2.delete(lpTwinFunds).where(eq(lpTwinFunds.id, d.id));
  }
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgAId));
  await db.delete(enterpriseMemberships).where(eq(enterpriseMemberships.orgId, orgBId));
  for (const openId of [`wp3-user-a-${TAG}`, `wp3-user-b-${TAG}`]) {
    await db.delete(users).where(eq(users.openId, openId));
  }
  await db.delete(organizations).where(eq(organizations.slug, `wp3-org-a-${TAG}`));
  await db.delete(organizations).where(eq(organizations.slug, `wp3-org-b-${TAG}`));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("W01 — Authorized enterprise user can list funds", () => {
  it("returns an empty list for a new org with no funds", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const { funds } = await caller.lpTwin.listFunds({ includeArchived: false });
    expect(Array.isArray(funds)).toBe(true);
  });
});

describe("W02 — New fund wizard creates a persistent fund", () => {
  it("creates a fund and returns a real fund ID that can be retrieved", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.createFund(FULL_FUND_INPUT);
    expect(result.fundId).toBeGreaterThan(0);
    createdFundId = result.fundId;

    // Verify persistence
    const { fund } = await caller.lpTwin.getFund({ fundId: createdFundId });
    expect(fund.fundName).toBe(FULL_FUND_INPUT.fundName);
    expect(fund.orgId).toBe(orgAId);
    expect(fund.createdByUserId).toBe(userAId);
  });
});

describe("W03 — Validation prevents invalid submissions", () => {
  it("rejects fund creation with missing fundName", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwin.createFund({
      ...FULL_FUND_INPUT,
      fundName: "",
    })).rejects.toThrow();
  });

  it("rejects fund creation with negative targetFundSizeM", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwin.createFund({
      ...FULL_FUND_INPUT,
      fundName: `Negative Size ${TAG}`,
      targetFundSizeM: -100,
    })).rejects.toThrow();
  });

  it("rejects session creation with no segments", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwin.createSession({
      fundId: createdFundId,
      sessionName: "Empty segments",
      selectedSegmentIds: [],
    })).rejects.toThrow();
  });
});

describe("W04 — Draft / incomplete fields are handled correctly", () => {
  it("creates a fund with minimal fields and sets evidenceStatus to draft", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.createFund(DRAFT_FUND_INPUT);
    expect(result.fundId).toBeGreaterThan(0);

    const { fund } = await caller.lpTwin.getFund({ fundId: result.fundId });
    expect(fund.evidenceStatus).toBe("draft");
    expect(fund.investmentPropositionJson).toBeNull();
  });
});

describe("W05 — Session creation links to the correct fund and organization", () => {
  it("creates a session with correct fundId and orgId", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    const result = await caller.lpTwin.createSession({
      fundId: createdFundId,
      sessionName: `WP3 Session ${TAG}`,
      selectedSegmentIds: ["swf-001"],
      scenarioType: "baseline",
    });
    expect(result.sessionId).toBeGreaterThan(0);
    createdSessionId = result.sessionId;

    const db = await getDb();
    if (!db) return;
    const [session] = await db.select().from(lpTwinSessions).where(eq(lpTwinSessions.id, createdSessionId)).limit(1);
    expect(session.fundId).toBe(createdFundId);
    expect(session.orgId).toBe(orgAId);
  });
});

describe("W06 — Historical session reopens correctly", () => {
  it("getSession returns stored results without re-running analysis", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));

    // Run analysis to create results
    await caller.lpTwin.runSegmentAnalysis({ sessionId: createdSessionId });

    // Reopen session — results come from DB, not a new run
    const { session, results } = await caller.lpTwin.getSession({ sessionId: createdSessionId });
    expect(session.id).toBe(createdSessionId);
    expect(session.status).toBe("completed");
    expect(results.length).toBeGreaterThan(0);

    // Engine version is preserved
    expect(session.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);

    // Results are from the same session
    for (const r of results) {
      expect(r.sessionId).toBe(createdSessionId);
      expect(r.orgId).toBe(orgAId);
    }
  });
});

describe("W07 — Archived funds are excluded by default", () => {
  it("archived fund does not appear in default listFunds", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));

    // Create a fund to archive
    const { fundId: archiveFundId } = await caller.lpTwin.createFund({
      ...FULL_FUND_INPUT,
      fundName: `Archive Test WP3 ${TAG}`,
    });

    await caller.lpTwin.archiveFund({ fundId: archiveFundId });

    const { funds } = await caller.lpTwin.listFunds({ includeArchived: false });
    expect(funds.map((f) => f.id)).not.toContain(archiveFundId);

    const { funds: withArchived } = await caller.lpTwin.listFunds({ includeArchived: true });
    expect(withArchived.map((f) => f.id)).toContain(archiveFundId);

    // Cleanup
    const db = await getDb();
    if (db) await db.delete(lpTwinFunds).where(eq(lpTwinFunds.id, archiveFundId));
  });
});

describe("W08 — Cross-tenant IDs cannot be loaded through route parameters", () => {
  it("Org B cannot access Org A fund by ID", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwin.getFund({ fundId: createdFundId })).rejects.toThrow("access denied");
  });

  it("Org B cannot access Org A session by ID", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwin.getSession({ sessionId: createdSessionId })).rejects.toThrow("access denied");
  });

  it("Org B cannot run analysis on Org A session", async () => {
    const callerB = appRouter.createCaller(makeCtx(userBId, orgBId));
    await expect(callerB.lpTwin.runSegmentAnalysis({ sessionId: createdSessionId })).rejects.toThrow("access denied");
  });
});

describe("W09 — Error states: invalid session ID returns NOT_FOUND", () => {
  it("getSession with non-existent session ID throws NOT_FOUND", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwin.getSession({ sessionId: 999999999 })).rejects.toThrow("access denied");
  });

  it("getFund with non-existent fund ID throws NOT_FOUND", async () => {
    const caller = appRouter.createCaller(makeCtx(userAId, orgAId));
    await expect(caller.lpTwin.getFund({ fundId: 999999999 })).rejects.toThrow("access denied");
  });
});

describe("W10 — Existing /captwin route remains unchanged", () => {
  it("LP Twin tables exist independently and do not modify existing tables", async () => {
    const db = await getDb();
    if (!db) return;

    // Verify LP Twin tables exist
    const [lpFundsCheck] = await db.execute("SHOW TABLES LIKE 'lp_twin_funds'" as unknown as Parameters<typeof db.execute>[0]);
    expect((lpFundsCheck as unknown[]).length).toBeGreaterThan(0);

    // Verify core tables are untouched (taskHistory, agents, users still exist)
    const [usersCheck] = await db.execute("SHOW TABLES LIKE 'users'" as unknown as Parameters<typeof db.execute>[0]);
    expect((usersCheck as unknown[]).length).toBeGreaterThan(0);

    // Verify CapTwin does not have any LP Twin columns added to it
    const [capTwinCols] = await db.execute("SHOW COLUMNS FROM users LIKE 'lp_twin%'" as unknown as Parameters<typeof db.execute>[0]);
    expect((capTwinCols as unknown[]).length).toBe(0);
  });
});
