import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ── Mock the database ─────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 1,
                userId: 1,
                task: "Screen new deal for Series A SaaS company",
                contextKey: "vc",
                contextLabel: "VC / PE Fund",
                agentCount: 8,
                outputs: null,
                createdAt: new Date("2026-03-09T10:00:00Z"),
              },
            ]),
          }),
        }),
      }),
    }),
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@agenthinkmesh.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

// ── Auth tests ────────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1, httpOnly: true, path: "/" });
  });

  it("returns current user from auth.me when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.email).toBe("test@agenthinkmesh.com");
    expect(user?.name).toBe("Test User");
  });

  it("returns null from auth.me when unauthenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

// ── Mesh router tests ─────────────────────────────────────────────────────────
describe("mesh.saveTask", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("saves a task and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mesh.saveTask({
      task: "Screen new deal for Series A SaaS company",
      contextKey: "vc",
      contextLabel: "VC / PE Fund",
      agentCount: 8,
      outputs: JSON.stringify({ "Deal Screener": "SUMMARY: Deal looks promising." }),
    });
    expect(result).toEqual({ success: true });
  });

  it("saves a task without outputs", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mesh.saveTask({
      task: "Run due diligence on target company",
      contextKey: "vc",
      contextLabel: "VC / PE Fund",
      agentCount: 10,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("mesh.getHistory", () => {
  it("returns task history for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const history = await caller.mesh.getHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]).toMatchObject({
      task: "Screen new deal for Series A SaaS company",
      contextLabel: "VC / PE Fund",
      agentCount: 8,
    });
  });
});
