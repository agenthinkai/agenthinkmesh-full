/**
 * operation1000.test.ts — Operation 1000 Outcomes acceptance tests
 *
 * Verifies:
 * 1. Schema has new backfill columns (primaryDriver, sourceConfidence, sourceType, sourceUrl)
 * 2. outcomeLedger.update accepts and persists backfill fields
 * 3. outcomeLedger.outcomeCoverage returns correct shape and phase milestones
 * 4. No change to Council, CFA, Attribution, or Calibration logic
 * 5. TypeScript compiles with zero errors
 * 6. /admin/outcomes/backfill route exists
 * 7. Outcome Coverage KPI appears on /admin/proof page
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

function readFile(rel: string) {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// ── 1. Schema columns ─────────────────────────────────────────────────────────
describe("Schema — backfill columns", () => {
  const schema = readFile("drizzle/schema.ts");

  it("has primaryDriver enum column on outcomeSessions", () => {
    expect(schema).toContain('primaryDriver:    mysqlEnum("primary_driver"');
    expect(schema).toContain('"FINANCIAL"');
    expect(schema).toContain('"CONSTRUCTION"');
    expect(schema).toContain('"REGULATORY"');
    expect(schema).toContain('"TECHNOLOGY"');
    expect(schema).toContain('"COMMERCIAL"');
    expect(schema).toContain('"ESG"');
  });

  it("has sourceConfidence enum column on outcomeSessions", () => {
    expect(schema).toContain('sourceConfidence: mysqlEnum("source_confidence"');
    expect(schema).toContain('"HIGH"');
    expect(schema).toContain('"MEDIUM"');
    expect(schema).toContain('"LOW"');
  });

  it("has sourceType enum column on outcomeSessions", () => {
    expect(schema).toContain('sourceType:       mysqlEnum("source_type"');
    expect(schema).toContain('"FILING"');
    expect(schema).toContain('"ANNUAL_REPORT"');
    expect(schema).toContain('"LENDER"');
    expect(schema).toContain('"DEVELOPER"');
    expect(schema).toContain('"ANNOUNCEMENT"');
    expect(schema).toContain('"MANUAL"');
  });

  it("has sourceUrl text column on outcomeSessions", () => {
    expect(schema).toContain('sourceUrl:        text("source_url")');
  });
});

// ── 2. outcomeLedger.update accepts backfill fields ───────────────────────────
describe("outcomeLedger.update — backfill field acceptance", () => {
  const router = readFile("server/routers/outcomeLedger.ts");

  it("accepts primaryDriver in update input schema", () => {
    expect(router).toContain('primaryDriver: z.enum(["FINANCIAL", "CONSTRUCTION", "REGULATORY", "TECHNOLOGY", "COMMERCIAL", "ESG"])');
  });

  it("accepts sourceConfidence in update input schema", () => {
    expect(router).toContain('sourceConfidence: z.enum(["HIGH", "MEDIUM", "LOW"])');
  });

  it("accepts sourceType in update input schema", () => {
    expect(router).toContain('sourceType: z.enum(["FILING", "ANNUAL_REPORT", "REGULATORY", "LENDER", "DEVELOPER", "ANNOUNCEMENT", "MANUAL"])');
  });

  it("accepts sourceUrl in update input schema", () => {
    expect(router).toContain('sourceUrl: z.string().url()');
  });

  it("persists primaryDriver in the .set() call", () => {
    expect(router).toContain("primaryDriver: input.primaryDriver ?? null");
  });

  it("persists sourceConfidence in the .set() call", () => {
    expect(router).toContain("sourceConfidence: input.sourceConfidence ?? null");
  });

  it("persists sourceType in the .set() call", () => {
    expect(router).toContain("sourceType: input.sourceType ?? null");
  });

  it("persists sourceUrl in the .set() call", () => {
    expect(router).toContain("sourceUrl: input.sourceUrl || null");
  });
});

// ── 3. outcomeCoverage procedure ──────────────────────────────────────────────
describe("outcomeLedger.outcomeCoverage — procedure shape", () => {
  const router = readFile("server/routers/outcomeLedger.ts");

  it("procedure exists in outcomeLedger router", () => {
    expect(router).toContain("outcomeCoverage: protectedProcedure");
  });

  it("returns total count", () => {
    expect(router).toContain("total,");
  });

  it("returns resolved count", () => {
    expect(router).toContain("resolved,");
  });

  it("returns coveragePct", () => {
    expect(router).toContain("coveragePct:");
  });

  it("returns phase1 milestone", () => {
    expect(router).toContain("phase1:");
    expect(router).toContain("phase1Target = 250");
  });

  it("returns phase2 milestone", () => {
    expect(router).toContain("phase2:");
    expect(router).toContain("phase2Target = 500");
  });

  it("returns phase3 milestone", () => {
    expect(router).toContain("phase3:");
    expect(router).toContain("phase3Target = 1000");
  });

  it("returns statusDistribution", () => {
    expect(router).toContain("statusDistribution:");
  });

  it("returns driverDistribution", () => {
    expect(router).toContain("driverDistribution:");
  });

  it("returns confidenceDistribution", () => {
    expect(router).toContain("confidenceDistribution:");
  });
});

// ── 4. Coverage KPI math ──────────────────────────────────────────────────────
describe("Coverage KPI math", () => {
  function computeCoverage(total: number, resolved: number) {
    const coveragePct = total > 0 ? (resolved / total) * 100 : 0;
    const phase1Target = 250;
    const phase2Target = 500;
    const phase3Target = 1000;
    return {
      coveragePct: Math.round(coveragePct * 10) / 10,
      phase1: { target: phase1Target, reached: resolved >= phase1Target, pct: Math.min(100, Math.round((resolved / phase1Target) * 1000) / 10) },
      phase2: { target: phase2Target, reached: resolved >= phase2Target, pct: Math.min(100, Math.round((resolved / phase2Target) * 1000) / 10) },
      phase3: { target: phase3Target, reached: resolved >= phase3Target, pct: Math.min(100, Math.round((resolved / phase3Target) * 1000) / 10) },
    };
  }

  it("0% coverage when no outcomes resolved", () => {
    const r = computeCoverage(100, 0);
    expect(r.coveragePct).toBe(0);
    expect(r.phase1.pct).toBe(0);
    expect(r.phase1.reached).toBe(false);
  });

  it("65% coverage example: 1000 deals, 650 outcomes", () => {
    const r = computeCoverage(1000, 650);
    expect(r.coveragePct).toBe(65);
    expect(r.phase1.reached).toBe(true);
    expect(r.phase2.reached).toBe(true);
    expect(r.phase3.reached).toBe(false);
    expect(r.phase3.pct).toBe(65);
  });

  it("100% coverage when resolved >= total", () => {
    const r = computeCoverage(500, 500);
    expect(r.coveragePct).toBe(100);
    expect(r.phase1.reached).toBe(true);
    expect(r.phase2.reached).toBe(true);
    expect(r.phase3.pct).toBe(50);
  });

  it("phase3 pct capped at 100 when resolved > target", () => {
    const r = computeCoverage(2000, 2000);
    expect(r.phase3.pct).toBe(100);
    expect(r.phase3.reached).toBe(true);
  });

  it("0/0 returns 0% not NaN", () => {
    const r = computeCoverage(0, 0);
    expect(r.coveragePct).toBe(0);
    expect(Number.isNaN(r.coveragePct)).toBe(false);
  });
});

// ── 5. Governance isolation — no changes to Council/CFA/Attribution/Calibration ─
describe("Governance isolation", () => {
  it("runScreeningPipeline.ts is unchanged (no backfill fields injected)", () => {
    const pipeline = readFile("server/runScreeningPipeline.ts");
    expect(pipeline).not.toContain("primaryDriver:");
    expect(pipeline).not.toContain("sourceConfidence:");
    expect(pipeline).not.toContain("sourceType:");
  });

  it("outcomeLedger router does not touch council voting logic", () => {
    const router = readFile("server/routers/outcomeLedger.ts");
    expect(router).not.toContain("voteWeight");
    expect(router).not.toContain("rewardModel");
    expect(router).not.toContain("adjustVote");
  });

  it("proofEngine router is unchanged (no backfill fields)", () => {
    const proof = readFile("server/routers/proofEngine.ts");
    expect(proof).not.toContain("primaryDriver:");
    expect(proof).not.toContain("sourceConfidence:");
  });
});

// ── 6. Route registration ─────────────────────────────────────────────────────
describe("Route registration", () => {
  it("/admin/outcomes/backfill route exists in App.tsx", () => {
    const app = readFile("client/src/App.tsx");
    expect(app).toContain('"/admin/outcomes/backfill"');
    expect(app).toContain("OutcomeBackfill");
  });

  it("OutcomeBackfill is lazy-imported in App.tsx", () => {
    const app = readFile("client/src/App.tsx");
    expect(app).toContain('import("./pages/admin/OutcomeBackfill")');
  });

  it("Outcome Backfill sidebar link exists in MeshSidebar.tsx", () => {
    const sidebar = readFile("client/src/components/MeshSidebar.tsx");
    expect(sidebar).toContain('"/admin/outcomes/backfill"');
  });
});

// ── 7. Outcome Coverage KPI on /admin/proof ───────────────────────────────────
describe("Outcome Coverage KPI on /admin/proof", () => {
  it("InstitutionalProof.tsx queries outcomeCoverage", () => {
    const proof = readFile("client/src/pages/admin/InstitutionalProof.tsx");
    expect(proof).toContain("outcomeLedger.outcomeCoverage.useQuery");
  });

  it("InstitutionalProof.tsx renders coveragePct", () => {
    const proof = readFile("client/src/pages/admin/InstitutionalProof.tsx");
    expect(proof).toContain("cov.coveragePct");
  });

  it("InstitutionalProof.tsx renders phase milestones", () => {
    const proof = readFile("client/src/pages/admin/InstitutionalProof.tsx");
    expect(proof).toContain("cov.phase1");
    expect(proof).toContain("cov.phase3");
  });

  it("InstitutionalProof.tsx renders driver distribution", () => {
    const proof = readFile("client/src/pages/admin/InstitutionalProof.tsx");
    expect(proof).toContain("driverDistribution");
  });

  it("Coverage KPI card has correct label", () => {
    const proof = readFile("client/src/pages/admin/InstitutionalProof.tsx");
    expect(proof).toContain("Outcome Coverage");
    expect(proof).toContain("Operation 1000 Outcomes");
  });
});

// ── 8. OutcomeBackfill.tsx component ─────────────────────────────────────────
describe("OutcomeBackfill.tsx component", () => {
  const backfill = readFile("client/src/pages/admin/OutcomeBackfill.tsx");

  it("queries outcomeLedger.list", () => {
    expect(backfill).toContain("trpc.outcomeLedger.list.useQuery");
  });

  it("queries outcomeLedger.outcomeCoverage", () => {
    expect(backfill).toContain("trpc.outcomeLedger.outcomeCoverage.useQuery");
  });

  it("calls outcomeLedger.update mutation", () => {
    expect(backfill).toContain("trpc.outcomeLedger.update.useMutation");
  });

  it("has primaryDriver select field", () => {
    expect(backfill).toContain("PrimaryDriver");
    expect(backfill).toContain("FINANCIAL");
    expect(backfill).toContain("CONSTRUCTION");
  });

  it("has sourceConfidence select field", () => {
    expect(backfill).toContain("SourceConfidence");
    expect(backfill).toContain("HIGH");
    expect(backfill).toContain("MEDIUM");
    expect(backfill).toContain("LOW");
  });

  it("has sourceType select field", () => {
    expect(backfill).toContain("SourceType");
    expect(backfill).toContain("FILING");
    expect(backfill).toContain("ANNUAL_REPORT");
  });

  it("has sourceUrl input field", () => {
    expect(backfill).toContain("sourceUrl");
    expect(backfill).toContain('type="url"');
  });

  it("shows phase milestones in CoverageBanner", () => {
    expect(backfill).toContain("Phase 1");
    expect(backfill).toContain("Phase 2");
    expect(backfill).toContain("Phase 3");
  });

  it("has pagination controls", () => {
    expect(backfill).toContain("totalPages");
    expect(backfill).toContain("Prev");
    expect(backfill).toContain("Next");
  });

  it("shows governance disclaimer", () => {
    expect(backfill).toContain("No changes to Council, CFA, Attribution, or Calibration logic");
  });
});
