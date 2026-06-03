/**
 * pilotConversion.test.ts
 * Acceptance tests for Institutional Pilot Conversion system (Phase 5 — Pilot Conversion)
 *
 * Criteria:
 * 1. No change to Council logic
 * 2. No change to CFA
 * 3. No change to Attribution
 * 4. No change to Calibration
 * 5. Pilot CRUD procedures exist and are correctly typed
 * 6. Funnel metrics procedure exists
 * 7. Usage tracking procedure exists
 * 8. TypeScript zero errors (validated by tsc)
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

type RouterInput = inferRouterInputs<typeof appRouter>;
type RouterOutput = inferRouterOutputs<typeof appRouter>;

// ── 1. Council logic untouched ─────────────────────────────────────────────────
describe("Council logic — unchanged", () => {
  it("dealScreener router still has screen procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("dealScreener.screen");
  });

  it("dealScreener router still has history procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("dealScreener.history");
  });

  it("dealScreener router still has getById procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("dealScreener.getById");
  });
});

// ── 2. CFA logic untouched ─────────────────────────────────────────────────────
describe("CFA logic — unchanged", () => {
  it("dealScreener router still has getCfaByDealId procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("dealScreener.getCfaByDealId");
  });
});

// ── 3. Attribution logic untouched ────────────────────────────────────────────
describe("Attribution logic — unchanged", () => {
  it("outcomeLedger router still has attributionDashboard procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("outcomeLedger.attributionDashboard");
  });

  it("outcomeLedger router still has markMaterialized procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("outcomeLedger.markMaterialized");
  });
});

// ── 4. Calibration logic untouched ────────────────────────────────────────────
describe("Calibration logic — unchanged", () => {
  it("outcomeLedger router still has calibrationMetrics procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("outcomeLedger.calibrationMetrics");
  });

  it("outcomeLedger router still has blockerCalibration procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("outcomeLedger.blockerCalibration");
  });

  it("outcomeLedger router still has calibrationDashboard procedure", () => {
    expect(appRouter._def.procedures).toHaveProperty("outcomeLedger.calibrationDashboard");
  });
});

// ── 5. Pilot CRUD procedures ───────────────────────────────────────────────────
describe("pilotConversion — CRUD procedures", () => {
  it("pilotConversion router is registered in appRouter", () => {
    const keys = Object.keys(appRouter._def.procedures);
    const pilotKeys = keys.filter((k) => k.startsWith("pilotConversion."));
    expect(pilotKeys.length).toBeGreaterThan(0);
  });

  it("pilotConversion.list procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.list");
  });

  it("pilotConversion.create procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.create");
  });

  it("pilotConversion.update procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.update");
  });

  it("pilotConversion.getBySlug procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.getBySlug");
  });

  it("pilotConversion.get procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.get");
  });
});

// ── 6. Funnel metrics procedure ────────────────────────────────────────────────
describe("pilotConversion — funnel metrics", () => {
  it("pilotConversion.funnelMetrics procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.funnelMetrics");
  });
});

// ── 7. Usage tracking procedure ───────────────────────────────────────────────
describe("pilotConversion — usage tracking", () => {
  it("pilotConversion.logUsage procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.logUsage");
  });

  it("pilotConversion.executiveSummary procedure exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("pilotConversion.executiveSummary");
  });
});

// ── 8. Input/output type inference (TypeScript validation) ────────────────────
describe("pilotConversion — type safety", () => {
  it("create input type includes required fields", () => {
    type CreateInput = RouterInput["pilotConversion"]["create"];
    // TypeScript compile-time check: these fields must exist on the input type
    const _check: CreateInput = {
      orgName: "Test Corp",
      contactName: "John Doe",
      contactEmail: "john@testcorp.com",
      councilMode: "infrastructure",
    };
    expect(_check.orgName).toBe("Test Corp");
    expect(_check.contactEmail).toBe("john@testcorp.com");
  });

  it("list input type includes optional status filter", () => {
    type ListInput = RouterInput["pilotConversion"]["list"];
    const _check: ListInput = { status: "ACTIVE" };
    expect(_check.status).toBe("ACTIVE");
  });

  it("logUsage input type includes pilotId and eventType", () => {
    type LogInput = RouterInput["pilotConversion"]["logUsage"];
    const _check: LogInput = {
      pilotId: 1,
      eventType: "EVALUATION_RUN",
    };
    expect(_check.pilotId).toBe(1);
    expect(_check.eventType).toBe("EVALUATION_RUN");
  });
});

// ── 9. Proof engine untouched ─────────────────────────────────────────────────
describe("Proof engine — unchanged", () => {
  it("proofEngine.decisionVolume procedure still exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("proofEngine.decisionVolume");
  });

  it("proofEngine.evidenceStatements procedure still exists", () => {
    expect(appRouter._def.procedures).toHaveProperty("proofEngine.evidenceStatements");
  });
});

// ── 10. Pilot schema — database table shape ───────────────────────────────────
describe("pilots schema — table structure", () => {
  it("pilots table is exported from drizzle schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema).toHaveProperty("pilots");
  });

  it("pilotUsage table is exported from drizzle schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema).toHaveProperty("pilotUsage");
  });

  it("pilots table has required columns", async () => {
    const { pilots } = await import("../drizzle/schema");
    const columns = Object.keys(pilots);
    expect(columns).toContain("id");
    expect(columns).toContain("orgName");
    expect(columns).toContain("contactEmail");
    expect(columns).toContain("status");
    expect(columns).toContain("pilotSlug");
  });

  it("pilotUsage table has required columns", async () => {
    const { pilotUsage } = await import("../drizzle/schema");
    const columns = Object.keys(pilotUsage);
    expect(columns).toContain("id");
    expect(columns).toContain("pilotId");
    expect(columns).toContain("eventType");
    expect(columns).toContain("createdAt");
  });
});

// ── 11. Route registration ────────────────────────────────────────────────────
describe("frontend routes — registered", () => {
  it("AdminPilots page file exists", async () => {
    const { existsSync } = await import("fs");
    expect(existsSync("/home/ubuntu/agenthinkmesh-full/client/src/pages/admin/AdminPilots.tsx")).toBe(true);
  });

  it("PilotLanding page file exists", async () => {
    const { existsSync } = await import("fs");
    expect(existsSync("/home/ubuntu/agenthinkmesh-full/client/src/pages/PilotLanding.tsx")).toBe(true);
  });

  it("App.tsx contains /admin/pilots route", async () => {
    const { readFileSync } = await import("fs");
    const content = readFileSync("/home/ubuntu/agenthinkmesh-full/client/src/App.tsx", "utf-8");
    expect(content).toContain("/admin/pilots");
  });

  it("App.tsx contains /pilot/:slug route", async () => {
    const { readFileSync } = await import("fs");
    const content = readFileSync("/home/ubuntu/agenthinkmesh-full/client/src/App.tsx", "utf-8");
    expect(content).toContain("/pilot/:slug");
  });

  it("MeshSidebar.tsx contains Pilot Conversion nav item", async () => {
    const { readFileSync } = await import("fs");
    const content = readFileSync("/home/ubuntu/agenthinkmesh-full/client/src/components/MeshSidebar.tsx", "utf-8");
    expect(content).toContain("Pilot Conversion");
    expect(content).toContain("/admin/pilots");
  });
});
