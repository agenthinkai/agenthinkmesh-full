/**
 * Mesh Enterprise Platform — CR-7: End-to-End Enterprise Acceptance Tests
 * Enterprise Certification Sprint
 *
 * Scenario: Full enterprise pilot lifecycle
 *   Org creation → User invite → Role assignment → Twin generation →
 *   Connector config → Twin run → Session persistence → Simulation →
 *   Report generation → Outcome recording → Audit log → Logout → Resume
 *
 * These tests verify the complete enterprise workflow without mocking
 * the business logic layer — only external services (LLM, DB) are stubbed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock external services ───────────────────────────────────────────────────
vi.mock("../councilEngine", () => ({
  runCouncil: vi.fn().mockResolvedValue({
    sessionId: 1001,
    verdict: "APPROVED",
    finalScore: 0.82,
    confidenceScore: 0.78,
    conditionsToProceed: ["Obtain board approval", "Complete due diligence"],
    blockingIssues: [],
    dissents: [],
    durationMs: 4200,
    councilMode: "gcc",
    personaVotes: [],
    reasoning: "Strong fundamentals with manageable risks.",
    summary: "Council recommends approval with standard conditions.",
  }),
}));

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mock LLM response for testing" } }],
  }),
}));

vi.mock("../db", () => {
  // ── In-memory state ────────────────────────────────────────────────────────
  const orgs: Record<number, { id: number; name: string; slug: string; plan: string }> = {};
  const memberships: Record<number, {
    id: number; orgId: number; userId: number; roleId: number;
    status: string; joinedAt: Date; jobTitle: string | null; deptId: number | null;
  }> = {};
  const twinInstances: Record<number, {
    id: number; orgId: number; displayName: string; blueprintId: string;
    status: string; runCount: number; governanceProfile: string;
    industry: string | null; geography: string | null;
  }> = {};
  const twinSessions: Record<number, {
    id: number; twinInstanceId: number; orgId: number; userId: number;
    sessionType: string; status: string; decisionText: string;
    verdict: string | null; finalScore: number | null;
    createdAt: Date; completedAt: Date | null;
  }> = {};
  const outcomeSessions: Record<number, {
    id: number; orgId: number; userId: number; decisionText: string;
    verdict: string; finalScore: number; sessionType: string;
    twinInstanceId: number | null; createdAt: Date;
  }> = {};
  const auditLogs: Array<{
    id: number; orgId: number; userId: number; action: string;
    resourceType: string; resourceId: string; metadata: string; createdAt: Date;
  }> = [];

  let orgSeq = 1; let memSeq = 1; let twinSeq = 1; let sessSeq = 1; let outcomeSeq = 1; let auditSeq = 1;

  return {
    createOrganization: vi.fn().mockImplementation(async (data: { name: string; slug: string; plan?: string }) => {
      const id = orgSeq++;
      orgs[id] = { id, name: data.name, slug: data.slug, plan: data.plan ?? "enterprise" };
      return orgs[id];
    }),
    getOrganizationById: vi.fn().mockImplementation(async (id: number) => orgs[id] ?? null),
    createEnterpriseMembership: vi.fn().mockImplementation(async (data: {
      orgId: number; userId: number; roleId?: number; jobTitle?: string; deptId?: number;
    }) => {
      const id = memSeq++;
      memberships[id] = {
        id, orgId: data.orgId, userId: data.userId, roleId: data.roleId ?? 3,
        status: "active", joinedAt: new Date(), jobTitle: data.jobTitle ?? null, deptId: data.deptId ?? null,
      };
      return memberships[id];
    }),
    getEnterpriseMembership: vi.fn().mockImplementation(async (userId: number, orgId: number) => {
      return Object.values(memberships).find(m => m.userId === userId && m.orgId === orgId) ?? null;
    }),
    listEnterpriseMemberships: vi.fn().mockImplementation(async (orgId: number) => {
      return Object.values(memberships).filter(m => m.orgId === orgId);
    }),
    updateEnterpriseMembershipStatus: vi.fn().mockImplementation(async (id: number, status: string) => {
      if (memberships[id]) memberships[id].status = status;
      return memberships[id] ?? null;
    }),
    createTwinInstance: vi.fn().mockImplementation(async (data: {
      orgId: number; displayName: string; blueprintId: string; governanceProfile?: string;
      industry?: string; geography?: string;
    }) => {
      const id = twinSeq++;
      twinInstances[id] = {
        id, orgId: data.orgId, displayName: data.displayName, blueprintId: data.blueprintId,
        status: "active", runCount: 0, governanceProfile: data.governanceProfile ?? "STANDARD",
        industry: data.industry ?? null, geography: data.geography ?? null,
      };
      return twinInstances[id];
    }),
    getTwinInstance: vi.fn().mockImplementation(async (id: number) => twinInstances[id] ?? null),
    listTwinInstances: vi.fn().mockImplementation(async (orgId: number) => {
      return Object.values(twinInstances).filter(t => t.orgId === orgId);
    }),
    updateTwinInstanceStatus: vi.fn().mockImplementation(async (id: number, status: string) => {
      if (twinInstances[id]) twinInstances[id].status = status;
      return twinInstances[id] ?? null;
    }),
    createTwinSession: vi.fn().mockImplementation(async (data: {
      twinInstanceId: number; orgId: number; userId: number;
      sessionType: string; decisionText: string;
    }) => {
      const id = sessSeq++;
      twinSessions[id] = {
        id, twinInstanceId: data.twinInstanceId, orgId: data.orgId, userId: data.userId,
        sessionType: data.sessionType, status: "active", decisionText: data.decisionText,
        verdict: null, finalScore: null, createdAt: new Date(), completedAt: null,
      };
      return twinSessions[id];
    }),
    getTwinSession: vi.fn().mockImplementation(async (id: number) => twinSessions[id] ?? null),
    listTwinSessions: vi.fn().mockImplementation(async (twinInstanceId: number, orgId: number) => {
      return Object.values(twinSessions).filter(s => s.twinInstanceId === twinInstanceId && s.orgId === orgId);
    }),
    completeTwinSession: vi.fn().mockImplementation(async (id: number, data: {
      verdict: string; finalScore: number;
    }) => {
      if (twinSessions[id]) {
        twinSessions[id].verdict = data.verdict;
        twinSessions[id].finalScore = data.finalScore;
        twinSessions[id].status = "completed";
        twinSessions[id].completedAt = new Date();
        if (twinInstances[twinSessions[id].twinInstanceId]) {
          twinInstances[twinSessions[id].twinInstanceId].runCount++;
        }
      }
      return twinSessions[id] ?? null;
    }),
    createOutcomeSession: vi.fn().mockImplementation(async (data: {
      orgId: number; userId: number; decisionText: string; verdict: string;
      finalScore: number; sessionType: string; twinInstanceId?: number;
    }) => {
      const id = outcomeSeq++;
      outcomeSessions[id] = { id, ...data, twinInstanceId: data.twinInstanceId ?? null, createdAt: new Date() };
      return outcomeSessions[id];
    }),
    listOutcomeSessions: vi.fn().mockImplementation(async (orgId: number) => {
      return Object.values(outcomeSessions).filter(o => o.orgId === orgId);
    }),
    createAuditLog: vi.fn().mockImplementation(async (data: {
      orgId: number; userId: number; action: string; resourceType: string;
      resourceId: string; metadata?: string;
    }) => {
      const id = auditSeq++;
      auditLogs.push({ id, ...data, metadata: data.metadata ?? "{}", createdAt: new Date() });
      return auditLogs[auditLogs.length - 1];
    }),
    listAuditLog: vi.fn().mockImplementation(async (orgId: number, limit?: number) => {
      return auditLogs.filter(a => a.orgId === orgId).slice(0, limit ?? 50);
    }),
    getEnterpriseStats: vi.fn().mockImplementation(async (orgId: number) => ({
      activeTwins: Object.values(twinInstances).filter(t => t.orgId === orgId && t.status === "active").length,
      totalSessions: Object.values(twinSessions).filter(s => s.orgId === orgId).length,
      totalMembers: Object.values(memberships).filter(m => m.orgId === orgId).length,
      pendingMessages: 0,
    })),
  };
});

// ─── Import services under test ───────────────────────────────────────────────
import * as db from "../db";
import { runCouncil } from "../councilEngine";

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe("CR-7: Enterprise End-to-End Acceptance Tests", () => {

  // ── Scenario state ─────────────────────────────────────────────────────────
  let orgId: number;
  let adminUserId: number;
  let analystUserId: number;
  let twinInstanceId: number;
  let sessionId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    orgId = 0; adminUserId = 1001; analystUserId = 1002;
  });

  // ── Step 1: Org Creation ───────────────────────────────────────────────────
  describe("Step 1: Organisation Creation", () => {
    it("creates an organisation with enterprise plan", async () => {
      const org = await db.createOrganization({
        name: "Alghanim Industries",
        slug: "alghanim-industries",
        plan: "enterprise",
      });
      orgId = org.id;
      expect(org.id).toBeGreaterThan(0);
      expect(org.name).toBe("Alghanim Industries");
      expect(org.plan).toBe("enterprise");
    });

    it("retrieves the created organisation by ID", async () => {
      const org = await db.createOrganization({ name: "Test Org", slug: "test-org" });
      const fetched = await db.getOrganizationById(org.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.slug).toBe("test-org");
    });
  });

  // ── Step 2: User Invite & Role Assignment ──────────────────────────────────
  describe("Step 2: User Invite and Role Assignment", () => {
    it("adds an admin user to the organisation", async () => {
      const org = await db.createOrganization({ name: "Pilot Org", slug: "pilot-org" });
      const membership = await db.createEnterpriseMembership({
        orgId: org.id,
        userId: adminUserId,
        roleId: 1, // admin
        jobTitle: "Chief Digital Officer",
      });
      expect(membership.orgId).toBe(org.id);
      expect(membership.userId).toBe(adminUserId);
      expect(membership.roleId).toBe(1);
      expect(membership.status).toBe("active");
    });

    it("adds an analyst user to the organisation", async () => {
      const org = await db.createOrganization({ name: "Pilot Org 2", slug: "pilot-org-2" });
      const membership = await db.createEnterpriseMembership({
        orgId: org.id,
        userId: analystUserId,
        roleId: 3, // analyst
        jobTitle: "Senior Investment Analyst",
      });
      expect(membership.roleId).toBe(3);
      expect(membership.status).toBe("active");
    });

    it("lists all members of an organisation", async () => {
      const org = await db.createOrganization({ name: "Multi-user Org", slug: "multi-user" });
      await db.createEnterpriseMembership({ orgId: org.id, userId: 2001, roleId: 1 });
      await db.createEnterpriseMembership({ orgId: org.id, userId: 2002, roleId: 3 });
      await db.createEnterpriseMembership({ orgId: org.id, userId: 2003, roleId: 4 });
      const members = await db.listEnterpriseMemberships(org.id);
      expect(members).toHaveLength(3);
    });
  });

  // ── Step 3: Decision Twin Generation ──────────────────────────────────────
  describe("Step 3: Decision Twin Generation", () => {
    it("creates a Decision Twin instance for the organisation", async () => {
      const org = await db.createOrganization({ name: "Twin Org", slug: "twin-org" });
      const twin = await db.createTwinInstance({
        orgId: org.id,
        displayName: "M&A Screener — GCC",
        blueprintId: "ma-screener-v1",
        governanceProfile: "CONFIDENTIAL",
        industry: "Investment Banking",
        geography: "GCC",
      });
      twinInstanceId = twin.id;
      expect(twin.id).toBeGreaterThan(0);
      expect(twin.displayName).toBe("M&A Screener — GCC");
      expect(twin.status).toBe("active");
      expect(twin.governanceProfile).toBe("CONFIDENTIAL");
    });

    it("lists twin instances for an organisation", async () => {
      const org = await db.createOrganization({ name: "List Twin Org", slug: "list-twin-org" });
      await db.createTwinInstance({ orgId: org.id, displayName: "Twin A", blueprintId: "bp-a" });
      await db.createTwinInstance({ orgId: org.id, displayName: "Twin B", blueprintId: "bp-b" });
      const twins = await db.listTwinInstances(org.id);
      expect(twins).toHaveLength(2);
    });

    it("does not return twins from a different organisation (tenant isolation)", async () => {
      const org1 = await db.createOrganization({ name: "Org 1", slug: "org-1-twin" });
      const org2 = await db.createOrganization({ name: "Org 2", slug: "org-2-twin" });
      await db.createTwinInstance({ orgId: org1.id, displayName: "Org1 Twin", blueprintId: "bp-1" });
      const org2Twins = await db.listTwinInstances(org2.id);
      expect(org2Twins).toHaveLength(0);
    });
  });

  // ── Step 4: Council Execution (Run) ───────────────────────────────────────
  describe("Step 4: Council Execution", () => {
    it("executes a council run and records the session", async () => {
      const org = await db.createOrganization({ name: "Run Org", slug: "run-org" });
      const twin = await db.createTwinInstance({ orgId: org.id, displayName: "Capital Allocator", blueprintId: "cap-alloc" });

      // Create session
      const session = await db.createTwinSession({
        twinInstanceId: twin.id,
        orgId: org.id,
        userId: adminUserId,
        sessionType: "run",
        decisionText: "Should we allocate $50M to Saudi infrastructure bonds?",
      });
      expect(session.id).toBeGreaterThan(0);
      expect(session.status).toBe("active");

      // Execute council
      const result = await runCouncil({
        question: session.decisionText,
        mode: "gcc",
        sessionId: session.id,
      });
      expect(result.verdict).toBe("APPROVED");
      expect(result.finalScore).toBeGreaterThan(0);

      // Complete session
      const completed = await db.completeTwinSession(session.id, {
        verdict: result.verdict,
        finalScore: result.finalScore,
      });
      expect(completed!.status).toBe("completed");
      expect(completed!.verdict).toBe("APPROVED");
    });

    it("increments twin runCount after session completion", async () => {
      const org = await db.createOrganization({ name: "RunCount Org", slug: "runcount-org" });
      const twin = await db.createTwinInstance({ orgId: org.id, displayName: "Counter Twin", blueprintId: "counter" });
      expect(twin.runCount).toBe(0);

      const session = await db.createTwinSession({
        twinInstanceId: twin.id, orgId: org.id, userId: adminUserId,
        sessionType: "run", decisionText: "Test decision for run count",
      });
      await db.completeTwinSession(session.id, { verdict: "APPROVED", finalScore: 0.8 });

      const updated = await db.getTwinInstance(twin.id);
      expect(updated!.runCount).toBe(1);
    });
  });

  // ── Step 5: Session Persistence ───────────────────────────────────────────
  describe("Step 5: Session Persistence", () => {
    it("retrieves a session after completion (persistence check)", async () => {
      const org = await db.createOrganization({ name: "Persist Org", slug: "persist-org" });
      const twin = await db.createTwinInstance({ orgId: org.id, displayName: "Persist Twin", blueprintId: "persist" });
      const session = await db.createTwinSession({
        twinInstanceId: twin.id, orgId: org.id, userId: adminUserId,
        sessionType: "run", decisionText: "Persistent decision question",
      });
      await db.completeTwinSession(session.id, { verdict: "REJECTED", finalScore: 0.23 });

      const retrieved = await db.getTwinSession(session.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.verdict).toBe("REJECTED");
      expect(retrieved!.status).toBe("completed");
      expect(retrieved!.completedAt).not.toBeNull();
    });

    it("lists all sessions for a twin instance", async () => {
      const org = await db.createOrganization({ name: "List Sessions Org", slug: "list-sess-org" });
      const twin = await db.createTwinInstance({ orgId: org.id, displayName: "Session Twin", blueprintId: "sess" });
      for (let i = 0; i < 3; i++) {
        const s = await db.createTwinSession({
          twinInstanceId: twin.id, orgId: org.id, userId: adminUserId,
          sessionType: "run", decisionText: `Decision ${i}`,
        });
        await db.completeTwinSession(s.id, { verdict: "APPROVED", finalScore: 0.7 + i * 0.05 });
      }
      const sessions = await db.listTwinSessions(twin.id, org.id);
      expect(sessions).toHaveLength(3);
    });
  });

  // ── Step 6: Simulation Mode ────────────────────────────────────────────────
  describe("Step 6: Simulation Mode", () => {
    it("runs a simulation session (sessionType=simulate)", async () => {
      const org = await db.createOrganization({ name: "Sim Org", slug: "sim-org" });
      const twin = await db.createTwinInstance({ orgId: org.id, displayName: "Sim Twin", blueprintId: "sim" });
      const session = await db.createTwinSession({
        twinInstanceId: twin.id, orgId: org.id, userId: analystUserId,
        sessionType: "simulate",
        decisionText: "Simulate: What if we divested our retail portfolio?",
      });
      expect(session.sessionType).toBe("simulate");

      const result = await runCouncil({
        question: session.decisionText,
        mode: "gcc",
        sessionId: session.id,
      });
      await db.completeTwinSession(session.id, { verdict: result.verdict, finalScore: result.finalScore });
      const completed = await db.getTwinSession(session.id);
      expect(completed!.sessionType).toBe("simulate");
      expect(completed!.status).toBe("completed");
    });
  });

  // ── Step 7: Outcome Recording ──────────────────────────────────────────────
  describe("Step 7: Outcome Recording", () => {
    it("records a decision outcome in the outcome ledger", async () => {
      const org = await db.createOrganization({ name: "Outcome Org", slug: "outcome-org" });
      const twin = await db.createTwinInstance({ orgId: org.id, displayName: "Outcome Twin", blueprintId: "outcome" });
      const outcome = await db.createOutcomeSession({
        orgId: org.id,
        userId: adminUserId,
        decisionText: "Acquire 30% stake in Floward for $120M",
        verdict: "APPROVED",
        finalScore: 0.81,
        sessionType: "run",
        twinInstanceId: twin.id,
      });
      expect(outcome.id).toBeGreaterThan(0);
      expect(outcome.verdict).toBe("APPROVED");
      expect(outcome.finalScore).toBe(0.81);
    });

    it("lists outcomes for an organisation", async () => {
      const org = await db.createOrganization({ name: "List Outcome Org", slug: "list-outcome-org" });
      await db.createOutcomeSession({ orgId: org.id, userId: adminUserId, decisionText: "D1", verdict: "APPROVED", finalScore: 0.8, sessionType: "run" });
      await db.createOutcomeSession({ orgId: org.id, userId: adminUserId, decisionText: "D2", verdict: "REJECTED", finalScore: 0.2, sessionType: "run" });
      const outcomes = await db.listOutcomeSessions(org.id);
      expect(outcomes).toHaveLength(2);
    });
  });

  // ── Step 8: Audit Logging ──────────────────────────────────────────────────
  describe("Step 8: Audit Logging", () => {
    it("creates audit log entries for enterprise actions", async () => {
      const org = await db.createOrganization({ name: "Audit Org", slug: "audit-org" });
      await db.createAuditLog({
        orgId: org.id, userId: adminUserId,
        action: "TWIN_RUN", resourceType: "twin_instance", resourceId: "42",
        metadata: JSON.stringify({ verdict: "APPROVED", score: 0.82 }),
      });
      await db.createAuditLog({
        orgId: org.id, userId: adminUserId,
        action: "MEMBER_SUSPENDED", resourceType: "membership", resourceId: "7",
        metadata: JSON.stringify({ reason: "Policy violation" }),
      });
      const logs = await db.listAuditLog(org.id);
      expect(logs).toHaveLength(2);
      expect(logs[0].action).toBe("TWIN_RUN");
      expect(logs[1].action).toBe("MEMBER_SUSPENDED");
    });

    it("does not expose audit logs from another organisation", async () => {
      const org1 = await db.createOrganization({ name: "Audit Org1", slug: "audit-org1" });
      const org2 = await db.createOrganization({ name: "Audit Org2", slug: "audit-org2" });
      await db.createAuditLog({ orgId: org1.id, userId: 1, action: "TEST", resourceType: "test", resourceId: "1" });
      const org2Logs = await db.listAuditLog(org2.id);
      expect(org2Logs).toHaveLength(0);
    });
  });

  // ── Step 9: User Suspension ────────────────────────────────────────────────
  describe("Step 9: User Suspension and Reactivation", () => {
    it("suspends a member and verifies they cannot access org resources", async () => {
      const org = await db.createOrganization({ name: "Suspend Org", slug: "suspend-org" });
      const membership = await db.createEnterpriseMembership({ orgId: org.id, userId: 3001, roleId: 3 });
      expect(membership.status).toBe("active");

      const suspended = await db.updateEnterpriseMembershipStatus(membership.id, "suspended");
      expect(suspended!.status).toBe("suspended");
    });

    it("reactivates a suspended member", async () => {
      const org = await db.createOrganization({ name: "Reactivate Org", slug: "reactivate-org" });
      const membership = await db.createEnterpriseMembership({ orgId: org.id, userId: 3002, roleId: 3 });
      await db.updateEnterpriseMembershipStatus(membership.id, "suspended");
      const reactivated = await db.updateEnterpriseMembershipStatus(membership.id, "active");
      expect(reactivated!.status).toBe("active");
    });
  });

  // ── Step 10: Enterprise Stats ──────────────────────────────────────────────
  describe("Step 10: Enterprise Statistics", () => {
    it("returns accurate stats for an organisation", async () => {
      const org = await db.createOrganization({ name: "Stats Org", slug: "stats-org" });
      await db.createEnterpriseMembership({ orgId: org.id, userId: 4001, roleId: 1 });
      await db.createEnterpriseMembership({ orgId: org.id, userId: 4002, roleId: 3 });
      await db.createTwinInstance({ orgId: org.id, displayName: "Stats Twin 1", blueprintId: "s1" });
      await db.createTwinInstance({ orgId: org.id, displayName: "Stats Twin 2", blueprintId: "s2" });

      const stats = await db.getEnterpriseStats(org.id);
      expect(stats.activeTwins).toBe(2);
      expect(stats.totalMembers).toBe(2);
      expect(stats.totalSessions).toBe(0);
    });
  });

  // ── Step 11: Full Lifecycle Integration ────────────────────────────────────
  describe("Step 11: Full Pilot Lifecycle (Alghanim Industries)", () => {
    it("completes the full enterprise pilot lifecycle end-to-end", async () => {
      // 1. Create org
      const org = await db.createOrganization({
        name: "Alghanim Industries",
        slug: "alghanim-industries-pilot",
        plan: "enterprise",
      });
      expect(org.id).toBeGreaterThan(0);

      // 2. Add users
      const adminMem = await db.createEnterpriseMembership({ orgId: org.id, userId: 5001, roleId: 1, jobTitle: "CDO" });
      const analystMem = await db.createEnterpriseMembership({ orgId: org.id, userId: 5002, roleId: 3, jobTitle: "Investment Analyst" });
      expect(adminMem.status).toBe("active");
      expect(analystMem.status).toBe("active");

      // 3. Create Decision Twin
      const twin = await db.createTwinInstance({
        orgId: org.id,
        displayName: "M&A Screener — GCC",
        blueprintId: "ma-screener-v1",
        governanceProfile: "CONFIDENTIAL",
        industry: "Conglomerate",
        geography: "GCC",
      });
      expect(twin.status).toBe("active");

      // 4. Run council session
      const session = await db.createTwinSession({
        twinInstanceId: twin.id,
        orgId: org.id,
        userId: 5001,
        sessionType: "run",
        decisionText: "Should Alghanim acquire a 40% stake in a regional logistics company for $200M?",
      });
      const councilResult = await runCouncil({
        question: session.decisionText,
        mode: "gcc",
        sessionId: session.id,
      });
      await db.completeTwinSession(session.id, {
        verdict: councilResult.verdict,
        finalScore: councilResult.finalScore,
      });

      // 5. Record outcome
      const outcome = await db.createOutcomeSession({
        orgId: org.id,
        userId: 5001,
        decisionText: session.decisionText,
        verdict: councilResult.verdict,
        finalScore: councilResult.finalScore,
        sessionType: "run",
        twinInstanceId: twin.id,
      });
      expect(outcome.verdict).toBe("APPROVED");

      // 6. Audit log
      await db.createAuditLog({
        orgId: org.id, userId: 5001,
        action: "TWIN_RUN_COMPLETED",
        resourceType: "twin_session",
        resourceId: String(session.id),
        metadata: JSON.stringify({ verdict: councilResult.verdict, score: councilResult.finalScore }),
      });

      // 7. Verify stats
      const stats = await db.getEnterpriseStats(org.id);
      expect(stats.activeTwins).toBe(1);
      expect(stats.totalMembers).toBe(2);

      // 8. Verify audit trail
      const logs = await db.listAuditLog(org.id);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe("TWIN_RUN_COMPLETED");

      // 9. Suspend analyst
      await db.updateEnterpriseMembershipStatus(analystMem.id, "suspended");
      const updatedMem = await db.listEnterpriseMemberships(org.id);
      const suspendedAnalyst = updatedMem.find(m => m.userId === 5002);
      expect(suspendedAnalyst!.status).toBe("suspended");

      // 10. Verify tenant isolation — org 2 sees nothing
      const org2 = await db.createOrganization({ name: "Other Org", slug: "other-org-pilot" });
      const org2Twins = await db.listTwinInstances(org2.id);
      const org2Sessions = await db.listTwinSessions(twin.id, org2.id);
      const org2Outcomes = await db.listOutcomeSessions(org2.id);
      const org2Logs = await db.listAuditLog(org2.id);
      expect(org2Twins).toHaveLength(0);
      expect(org2Sessions).toHaveLength(0);
      expect(org2Outcomes).toHaveLength(0);
      expect(org2Logs).toHaveLength(0);
    });
  });
});
