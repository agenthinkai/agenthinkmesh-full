import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(userId = 1): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@example.com`,
      name: `Test User ${userId}`,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

describe("agent.list (public)", () => {
  it("returns an array without authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.list({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("agent.discover (public)", () => {
  it("returns scored agents for empty capability filter", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.discover({ capabilities: [], limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    // All returned agents should have a numeric score
    result.forEach(a => expect(typeof a.score).toBe("number"));
  });

  it("returns results sorted by score descending", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.discover({ capabilities: ["risk-analysis"], limit: 20 });
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });
});

describe("agent.myAgents (protected)", () => {
  it("returns an array for authenticated user", async () => {
    const { ctx } = createAuthContext(999);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agent.myAgents();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("agent.register (protected)", () => {
  it("throws on invalid endpoint URL", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.agent.register({
        agentName: "Test Agent",
        developerName: "Test Dev",
        description: "A test agent for validation purposes",
        capabilities: ["test"],
        endpointUrl: "not-a-url",
        averageLatency: 300,
        pricingModel: "free",
      })
    ).rejects.toThrow();
  });

  it("throws on empty capabilities", async () => {
    const { ctx } = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.agent.register({
        agentName: "Test Agent",
        developerName: "Test Dev",
        description: "A test agent for validation purposes",
        capabilities: [],
        endpointUrl: "https://example.com/execute",
        averageLatency: 300,
        pricingModel: "free",
      })
    ).rejects.toThrow();
  });
});

describe("agent.deactivate (protected)", () => {
  it("throws when agent does not exist or user is not owner", async () => {
    const { ctx } = createAuthContext(999);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.agent.deactivate({ id: 99999 })
    ).rejects.toThrow();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1, openId: "sample-user", email: "sample@example.com",
        name: "Sample User", loginMethod: "manus", role: "user",
        createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
  });
});
