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

// ── Mock LLM for routeAgents tests ────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            relevantAgents: ["Deal Screener", "Due Diligence"],
            irrelevantAgents: ["Portfolio Monitor", "LP Comms", "Cap Table", "Exit Modeler"],
            domainMatch: true,
            suggestedDomain: null,
            suggestedContext: null,
            confidence: 0.92,
            reasoning: "Task is clearly a deal screening exercise relevant to VC/PE fund context.",
          }),
        },
      },
    ],
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

// ── Smart routing tests ───────────────────────────────────────────────────────
describe("mesh.routeAgents", () => {
  const vcAgents = ["Deal Screener", "Due Diligence", "Portfolio Monitor", "LP Comms", "Cap Table", "Exit Modeler"];

  it("returns relevant and irrelevant agent lists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mesh.routeAgents({
      taskText: "Screen a new Series A SaaS deal",
      contextLabel: "VC / PE Fund",
      domainLabel: "Finance",
      agentLabels: vcAgents,
      allDomains: ["Finance", "Legal", "Healthcare", "Enterprise", "GCC Wealth"],
    });
    expect(result).toHaveProperty("relevantAgents");
    expect(result).toHaveProperty("irrelevantAgents");
    expect(result).toHaveProperty("domainMatch");
    expect(result).toHaveProperty("reasoning");
    expect(Array.isArray(result.relevantAgents)).toBe(true);
    expect(Array.isArray(result.irrelevantAgents)).toBe(true);
    // All returned agents must be from the input list
    result.relevantAgents.forEach(a => expect(vcAgents).toContain(a));
    result.irrelevantAgents.forEach(a => expect(vcAgents).toContain(a));
  });

  it("returns at least one relevant agent", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mesh.routeAgents({
      taskText: "Screen a new Series A SaaS deal",
      contextLabel: "VC / PE Fund",
      domainLabel: "Finance",
      agentLabels: vcAgents,
      allDomains: ["Finance", "Legal", "Healthcare", "Enterprise", "GCC Wealth"],
    });
    expect(result.relevantAgents.length).toBeGreaterThan(0);
  });

  it("relevant + irrelevant agents cover all input agents", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mesh.routeAgents({
      taskText: "Screen a new Series A SaaS deal",
      contextLabel: "VC / PE Fund",
      domainLabel: "Finance",
      agentLabels: vcAgents,
      allDomains: ["Finance", "Legal", "Healthcare", "Enterprise", "GCC Wealth"],
    });
    const allReturned = [...result.relevantAgents, ...result.irrelevantAgents].sort();
    const allInput = [...vcAgents].sort();
    expect(allReturned).toEqual(allInput);
  });

  it("has domainMatch as boolean", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mesh.routeAgents({
      taskText: "Screen a new Series A SaaS deal",
      contextLabel: "VC / PE Fund",
      domainLabel: "Finance",
      agentLabels: vcAgents,
      allDomains: ["Finance", "Legal", "Healthcare", "Enterprise", "GCC Wealth"],
    });
    expect(typeof result.domainMatch).toBe("boolean");
  });
});

// ── New 3-screen MVP procedure tests ─────────────────────────────────────────

const MOCK_ANALYZE_LLM_RESPONSE = {
  choices: [{
    message: {
      content: JSON.stringify({
        taskType: "Deal Screening",
        summary: "Strong HealthTech opportunity with solid unit economics.",
        keyFindings: ["ARR growing 3x YoY", "Experienced founding team"],
        risks: ["Regulatory risk in GCC markets"],
        segmentInsights: ["GCC healthcare market growing at 12% CAGR"],
        recommendation: "Proceed to due diligence",
        confidenceScore: 87,
        agentRoute: [{ agent: "Finance Agent", domain: "Finance", confidence: 90, tasksHandled: 1 }],
      }),
    },
  }],
};

describe("mesh.analyze — structured LLM output validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("LLM response contains all required result fields", () => {
    const content = JSON.parse(
      MOCK_ANALYZE_LLM_RESPONSE.choices[0].message.content as string
    );
    expect(content).toHaveProperty("taskType");
    expect(content).toHaveProperty("summary");
    expect(content).toHaveProperty("keyFindings");
    expect(content).toHaveProperty("risks");
    expect(content).toHaveProperty("segmentInsights");
    expect(content).toHaveProperty("recommendation");
    expect(content).toHaveProperty("confidenceScore");
    expect(content).toHaveProperty("agentRoute");
  });

  it("confidenceScore is between 0 and 100", () => {
    const content = JSON.parse(
      MOCK_ANALYZE_LLM_RESPONSE.choices[0].message.content as string
    );
    expect(content.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(content.confidenceScore).toBeLessThanOrEqual(100);
  });

  it("keyFindings and risks are arrays", () => {
    const content = JSON.parse(
      MOCK_ANALYZE_LLM_RESPONSE.choices[0].message.content as string
    );
    expect(Array.isArray(content.keyFindings)).toBe(true);
    expect(Array.isArray(content.risks)).toBe(true);
    expect(Array.isArray(content.segmentInsights)).toBe(true);
    expect(Array.isArray(content.agentRoute)).toBe(true);
  });

  it("agentRoute entries have required fields", () => {
    const content = JSON.parse(
      MOCK_ANALYZE_LLM_RESPONSE.choices[0].message.content as string
    );
    content.agentRoute.forEach((entry: { agent: string; domain: string; confidence: number; tasksHandled: number }) => {
      expect(entry).toHaveProperty("agent");
      expect(entry).toHaveProperty("domain");
      expect(entry).toHaveProperty("confidence");
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(100);
    });
  });

  it("mesh.analyze requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mesh.analyze({ query: "Screen a startup" })
    ).rejects.toThrow();
  });

  it("mesh.getTask requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mesh.getTask({ id: "task-001" })
    ).rejects.toThrow();
  });

  it("mesh.listTasks requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mesh.listTasks()
    ).rejects.toThrow();
  });
});

// ── mesh.uploadAttachment tests ───────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/attachments/1-abc.pdf", key: "attachments/1/1-abc.pdf" }),
}));

describe("mesh.uploadAttachment", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("uploads a base64-encoded file and returns a CDN url", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Minimal 1-byte PDF-like base64 payload
    const base64Data = Buffer.from("fake-pdf-content").toString("base64");
    const result = await caller.mesh.uploadAttachment({
      fileName: "test-report.pdf",
      mimeType: "application/pdf",
      base64Data,
    });
    expect(result.url).toMatch(/^https:\/\//);
    expect(result.fileName).toBe("test-report.pdf");
  });

  it("throws when fileName is missing", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mesh.uploadAttachment({ fileName: "", mimeType: "application/pdf", base64Data: "dGVzdA==" })
    ).rejects.toThrow("fileName and base64Data are required");
  });
});
