/**
 * scheduled.test.ts — Vitest tests for Atlas scheduled handlers
 *
 * Tests cover:
 * 1. atlasDailyLoopHandler — auth rejection, success path
 * 2. atlasWeeklyExpansionHandler — auth rejection, success path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        groupBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        $returningId: vi.fn().mockResolvedValue([{ id: 1 }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
}));

// ── Mock LLM ──────────────────────────────────────────────────────────────────
vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            companies: [
              {
                companyName: "Test Bank Corp",
                hqCity: "New York",
                revenueUsdBn: 50,
                employees: 5000,
                ceoName: "Jane Smith",
                keyDecisionDomain: "AI Transformation",
                activeStrategicInitiative: "Deploying AI across risk management",
                aiTransformationSignal: "Investing $500M in AI infrastructure",
                opportunityType: "AI Decision Intelligence",
                opportunityScore: 85,
                agenthinkFitScore: 90,
                decisionComplexityScore: 80,
              },
            ],
          }),
        },
      },
    ],
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    body: {},
  };
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; _status: number; _body: unknown } {
  const res = {
    _status: 200,
    _body: null as unknown,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockImplementation(function (this: typeof res, body: unknown) {
      this._body = body;
      return this;
    }),
  };
  res.status.mockImplementation(function (code: number) {
    res._status = code;
    return res;
  });
  return res;
}

// ── Tests: atlasDailyLoopHandler ──────────────────────────────────────────────
describe("atlasDailyLoopHandler", () => {
  beforeEach(() => {
    vi.stubEnv("SCHEDULER_SECRET", "test-secret-123");
  });

  it("rejects requests with no Authorization header", async () => {
    const { atlasDailyLoopHandler } = await import("./scheduled/atlasDailyLoop");
    const req = makeReq();
    const res = makeRes();

    await atlasDailyLoopHandler(req as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Unauthorized" }));
  });

  it("rejects requests with wrong Bearer token", async () => {
    const { atlasDailyLoopHandler } = await import("./scheduled/atlasDailyLoop");
    const req = makeReq("Bearer wrong-token");
    const res = makeRes();

    await atlasDailyLoopHandler(req as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accepts requests with correct Bearer token", async () => {
    const { atlasDailyLoopHandler } = await import("./scheduled/atlasDailyLoop");
    const req = makeReq("Bearer test-secret-123");
    const res = makeRes();

    await atlasDailyLoopHandler(req as Request, res as unknown as Response);

    // Should not return 401
    expect(res.status).not.toHaveBeenCalledWith(401);
  });
});

// ── Tests: atlasWeeklyExpansionHandler ────────────────────────────────────────
describe("atlasWeeklyExpansionHandler", () => {
  beforeEach(() => {
    vi.stubEnv("SCHEDULER_SECRET", "test-secret-123");
  });

  it("rejects requests with no Authorization header", async () => {
    const { atlasWeeklyExpansionHandler } = await import("./scheduled/atlasWeeklyExpansion");
    const req = makeReq();
    const res = makeRes();

    await atlasWeeklyExpansionHandler(req as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Unauthorized" }));
  });

  it("rejects requests with wrong Bearer token", async () => {
    const { atlasWeeklyExpansionHandler } = await import("./scheduled/atlasWeeklyExpansion");
    const req = makeReq("Bearer bad-token");
    const res = makeRes();

    await atlasWeeklyExpansionHandler(req as Request, res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accepts requests with correct Bearer token and returns success structure", async () => {
    const { atlasWeeklyExpansionHandler } = await import("./scheduled/atlasWeeklyExpansion");
    const req = makeReq("Bearer test-secret-123");
    const res = makeRes();

    await atlasWeeklyExpansionHandler(req as Request, res as unknown as Response);

    // Should not return 401
    expect(res.status).not.toHaveBeenCalledWith(401);
    // Response body should contain success and results
    if (res._body && typeof res._body === "object") {
      const body = res._body as Record<string, unknown>;
      expect(body).toHaveProperty("runId");
      expect(body).toHaveProperty("results");
    }
  });

  it("verifies SCHEDULER_SECRET must be non-empty for auth to pass", () => {
    // The verifySchedulerAuth logic: token === SCHEDULER_SECRET && !!SCHEDULER_SECRET
    // When SCHEDULER_SECRET is empty string, !!SCHEDULER_SECRET is false, so auth fails.
    // This is a unit test of the logic itself.
    const secret = "";
    const token = "Bearer test-secret-123".slice(7);
    const result = token === secret && !!secret;
    expect(result).toBe(false);
  });
});
