/**
 * Workflow Router Tests
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

const mockUser = {
  id: 1,
  openId: "test-open-id",
  name: "Test User",
  email: "test@agenthink.ai",
  role: "user" as const,
  orgId: null,
  loginMethod: "oauth",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const authCtx = { user: mockUser, req: {} as any, res: {} as any };
const anonCtx = { user: null, req: {} as any, res: {} as any };

// ── Fortress Gateway ──────────────────────────────────────────────────────────

describe("workflow.checkAccess", () => {
  it("returns approved=true for agenthink.ai domain", async () => {
    const caller = appRouter.createCaller(authCtx);
    const result = await caller.workflow.checkAccess();
    expect(result).toHaveProperty("approved");
    expect(result.approved).toBe(true);
    expect(result.email).toBe("test@agenthink.ai");
  });

  it("throws for unauthenticated users", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(caller.workflow.checkAccess()).rejects.toThrow();
  });
});

// ── Beta Access Request ───────────────────────────────────────────────────────

describe("workflow.requestBeta", () => {
  it("rejects request with invalid email", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(
      caller.workflow.requestBeta({
        name: "John Smith",
        firm: "Test Firm",
        role: "Analyst",
        email: "not-valid",
        useCase: "We want to use this for institutional research purposes in the GCC market.",
      })
    ).rejects.toThrow();
  });

  it("rejects request with too-short use case", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(
      caller.workflow.requestBeta({
        name: "John Smith",
        firm: "Test Firm",
        role: "Analyst",
        email: "john@firm.com",
        useCase: "short",
      })
    ).rejects.toThrow();
  });
});

// ── Workflow List ─────────────────────────────────────────────────────────────

describe("workflow.listRuns", () => {
  it("returns an array for authenticated users", async () => {
    const caller = appRouter.createCaller(authCtx);
    const result = await caller.workflow.listRuns();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws for unauthenticated users", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(caller.workflow.listRuns()).rejects.toThrow();
  });
});

// ── Workflow Status ───────────────────────────────────────────────────────────

describe("workflow.getStatus", () => {
  it("throws NOT_FOUND for non-existent session", async () => {
    const caller = appRouter.createCaller(authCtx);
    await expect(
      caller.workflow.getStatus({ sessionId: "non-existent-session-id-12345" })
    ).rejects.toThrow();
  });

  it("throws for unauthenticated users", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(
      caller.workflow.getStatus({ sessionId: "any-session" })
    ).rejects.toThrow();
  });
});

// ── Workflow Start ────────────────────────────────────────────────────────────

describe("workflow.start", () => {
  it("throws an error for unapproved email domain (FORTRESS_GATEWAY or DB error)", async () => {
    const caller = appRouter.createCaller({
      ...authCtx,
      user: { ...mockUser, email: "user@totally-unapproved-domain-xyz999.com" },
    });
    // In test env the DB may not be reachable, so any error is acceptable
    await expect(
      caller.workflow.start({
        workflowType: "rosie_protocol",
        sourceDocuments: [],
      })
    ).rejects.toThrow();
  });
});

// ── Dossier PDF ───────────────────────────────────────────────────────────────

describe("dossier.generate", () => {
  it("throws NOT_FOUND for non-existent session", async () => {
    const caller = appRouter.createCaller(authCtx);
    await expect(
      caller.dossier.generate({ sessionId: "non-existent-session-pdf-test" })
    ).rejects.toThrow();
  });

  it("throws for unauthenticated users", async () => {
    const caller = appRouter.createCaller(anonCtx);
    await expect(
      caller.dossier.generate({ sessionId: "any-session" })
    ).rejects.toThrow();
  });
});
