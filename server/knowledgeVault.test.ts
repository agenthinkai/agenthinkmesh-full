/**
 * Knowledge Vault router tests
 * Tests the list, stats, search, and getById procedures via tRPC caller
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    setCookie: () => {},
    clearCookie: () => {},
  };
  return { ctx };
}

describe("Knowledge Vault Router", () => {
  it("stats procedure returns total count and domain breakdown", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.knowledgeVault.stats();
    expect(stats).toBeDefined();
    expect(typeof stats.total).toBe("number");
    expect(stats.total).toBeGreaterThan(0);
    expect(Array.isArray(stats.byDomain)).toBe(true);
    expect(stats.byDomain.length).toBeGreaterThan(0);
  });

  it("list procedure returns paginated scenarios", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.knowledgeVault.list({ page: 1, pageSize: 10 });
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThan(0);
    expect(Array.isArray(result.scenarios)).toBe(true);
    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.scenarios.length).toBeLessThanOrEqual(10);
  });

  it("list procedure filters by domain", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.knowledgeVault.list({ domain: "deal_screening", page: 1, pageSize: 5 });
    expect(result.scenarios.length).toBeGreaterThan(0);
    result.scenarios.forEach(s => {
      expect(s.domain).toBe("deal_screening");
    });
  });

  it("list procedure supports text search", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.knowledgeVault.list({ search: "Kuwait", page: 1, pageSize: 5 });
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
  });

  it("getById procedure returns scenario detail with parsedContent", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // First get a scenario ID from the list
    const list = await caller.knowledgeVault.list({ page: 1, pageSize: 1 });
    expect(list.scenarios.length).toBeGreaterThan(0);
    const scenarioId = list.scenarios[0].scenarioId;

    const detail = await caller.knowledgeVault.getById({ scenarioId });
    expect(detail).toBeDefined();
    expect(detail.scenarioId).toBe(scenarioId);
    expect(detail.title).toBeTruthy();
    expect(detail.parsedContent).toBeDefined();
  });

  it("all 8 domains are represented in the vault", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.knowledgeVault.stats();
    const domainNames = stats.byDomain.map(d => d.domain);
    const expectedDomains = [
      "deal_screening", "wealth_management", "insurance_underwriting",
      "mvno_intelligence", "legal_review", "budget_forecasting",
      "social_media", "ic_reports",
    ];
    for (const domain of expectedDomains) {
      expect(domainNames).toContain(domain);
    }
  });
});
