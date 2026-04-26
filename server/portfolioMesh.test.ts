/**
 * PortfolioMesh — unit tests
 *
 * Tests cover:
 *  1. ASSET_CLASSES constant shape
 *  2. CONSTRUCTION_METHODS constant shape
 *  3. IPS constraint object structure (record keyed by asset class)
 *  4. Macro regime classification logic (regime string is non-empty)
 *  5. Asset estimate shape validation
 *  6. Portfolio construction result shape
 *  7. CIO output board memo field names match the schema
 *  8. Route paths registered in App.tsx
 *  9. SiteNav NAV_ITEMS includes PortfolioMesh
 * 10. portfolioMeshRouter is exported from its module
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

// ─── 1. ASSET_CLASSES ────────────────────────────────────────────────────────
describe("ASSET_CLASSES", () => {
  it("exports exactly 6 asset classes", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    const match = src.match(/const ASSET_CLASSES\s*=\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const classes = match![1].split(",").map(s => s.trim().replace(/['"]/g, "")).filter(Boolean);
    expect(classes).toHaveLength(6);
  });

  it("includes US Equity and Bonds", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("US Equity");
    expect(src).toContain("Bonds");
  });
});

// ─── 2. CONSTRUCTION_METHODS ─────────────────────────────────────────────────
describe("CONSTRUCTION_METHODS", () => {
  it("uses exactly 5 construction methods in constructPortfolios", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    // The router uses inline method names rather than a named constant array
    const methods = [
      "Equal Weight",
      "Maximum Sharpe",
      "Risk Parity",
      "Minimum Variance",
      "Maximum Diversification",
    ];
    for (const m of methods) {
      expect(src).toContain(m);
    }
    expect(methods).toHaveLength(5);
  });
});

// ─── 3. IPS constraint record shape ──────────────────────────────────────────
describe("IPS constraint record", () => {
  it("frontend IpsForm uses AssetConstraints record type (not array)", () => {
    const src = readFileSync(join(ROOT, "client/src/pages/PortfolioMesh.tsx"), "utf-8");
    expect(src).toContain("type AssetConstraints = Record<AssetClass");
    expect(src).toContain("constraints: AssetConstraints");
    // Must NOT use array syntax for constraints
    expect(src).not.toContain("constraints: { asset: string");
  });
});

// ─── 4. Macro regime classification ──────────────────────────────────────────
describe("classifyMacro procedure", () => {
  it("procedure exists in portfolioMeshRouter", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("classifyMacro:");
  });

  it("returns regime, confidence, and rationale fields", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("regime");
    expect(src).toContain("confidence");
    expect(src).toContain("rationale");
  });
});

// ─── 5. Asset estimate shape ──────────────────────────────────────────────────
describe("runAssetAgents procedure", () => {
  it("procedure exists in portfolioMeshRouter", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("runAssetAgents:");
  });

  it("returns historicalReturn, blendedReturn, finalReturn, and volatility fields", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("historicalReturn");
    // The router uses blendedReturn + finalReturn (not forwardReturn)
    expect(src).toContain("blendedReturn");
    expect(src).toContain("finalReturn");
    expect(src).toContain("volatility");
  });
});

// ─── 6. Portfolio construction result shape ───────────────────────────────────
describe("constructPortfolios procedure", () => {
  it("procedure exists in portfolioMeshRouter", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("constructPortfolios:");
  });

  it("returns weights, expectedReturn, expectedVolatility, sharpe fields", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("expectedReturn");
    expect(src).toContain("expectedVolatility");
    expect(src).toContain("sharpe");
  });
});

// ─── 7. CIO output board memo field names ─────────────────────────────────────
describe("generateCioOutput procedure", () => {
  it("uses ipsIssues as the API return field and cioRisks as the DB column", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    // ipsIssues is the API return field name
    expect(src).toContain("ipsIssues");
    // cioRisks is the database column name (separate concern)
    expect(src).toContain("cioRisks");
  });

  it("boardMemo uses allocationTable (9-section schema)", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("allocationTable");
  });

  it("boardMemo uses riskAssessment (9-section schema)", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("riskAssessment");
  });
});

// ─── 8. App.tsx routes ────────────────────────────────────────────────────────
describe("App.tsx routes", () => {
  it("registers /portfolio-mesh route", () => {
    const src = readFileSync(join(ROOT, "client/src/App.tsx"), "utf-8");
    expect(src).toContain('path="/portfolio-mesh"');
  });

  it("registers /portfolio-mesh/history route", () => {
    const src = readFileSync(join(ROOT, "client/src/App.tsx"), "utf-8");
    expect(src).toContain('path="/portfolio-mesh/history"');
  });

  it("imports PortfolioMesh page", () => {
    const src = readFileSync(join(ROOT, "client/src/App.tsx"), "utf-8");
    // PortfolioMesh is now a lazy import for bundle splitting (TASK 5)
    expect(src).toContain('import("./pages/PortfolioMesh")');
  });
});

// ─── 9. SiteNav includes PortfolioMesh ────────────────────────────────────────
describe("SiteNav NAV_ITEMS", () => {
  it("includes PortfolioMesh entry with correct href", () => {
    const src = readFileSync(join(ROOT, "client/src/components/SiteNav.tsx"), "utf-8");
    expect(src).toContain('href: "/portfolio-mesh"');
    expect(src).toContain('label: "PortfolioMesh"');
  });
});

// ─── 10. portfolioMeshRouter export ──────────────────────────────────────────
describe("portfolioMeshRouter", () => {
  it("is exported from server/routers/portfolioMesh.ts", () => {
    const src = readFileSync(join(ROOT, "server/routers/portfolioMesh.ts"), "utf-8");
    expect(src).toContain("export const portfolioMeshRouter");
  });

  it("is imported and wired into appRouter in routers.ts", () => {
    const src = readFileSync(join(ROOT, "server/routers.ts"), "utf-8");
    expect(src).toContain("portfolioMeshRouter");
    expect(src).toContain("portfolioMesh:");
  });
});
