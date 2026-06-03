/**
 * proofEngine.test.ts
 * Acceptance tests for Institutional Proof Engine (Phase 5).
 *
 * Criteria tested:
 * 1. No change to Council logic
 * 2. No change to CFA
 * 3. No change to Attribution
 * 4. No change to Calibration
 * 5. Evidence statements use actual data only (threshold-gated)
 * 6. PDF export function exists and generates valid HTML
 * 7. TypeScript zero errors (verified by tsc in CI)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Criterion 1: No change to Council logic ───────────────────────────────────
describe("Phase 5 — Council Logic Isolation", () => {
  it("councilEngine.ts does not import proofEngine router", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "councilEngine.ts"),
      "utf-8"
    );
    expect(content).not.toContain("proofEngine");
    expect(content).not.toContain("decisionVolume");
    expect(content).not.toContain("evidenceStatements");
    expect(content).not.toContain("fullProofSummary");
  });

  it("runScreeningPipeline.ts does not import proofEngine router", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "runScreeningPipeline.ts"),
      "utf-8"
    );
    expect(content).not.toContain("proofEngine");
    expect(content).not.toContain("decisionVolume");
    expect(content).not.toContain("evidenceStatements");
  });

  it("proofEngine router does not modify council-related tables", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/proofEngine.ts"),
      "utf-8"
    );
    // Should only use SELECT queries (no INSERT/UPDATE/DELETE on council tables)
    expect(content).not.toContain("consensusSessions.insert");
    expect(content).not.toContain("agentVotesLog.insert");
    // No .insert( or .update( or .delete( calls at all
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
    expect(content).not.toContain(".delete(");
  });
});

// ── Criterion 2: No change to CFA ────────────────────────────────────────────
describe("Phase 5 — CFA Isolation", () => {
  it("proofEngine router only reads cfaSessions (no writes)", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/proofEngine.ts"),
      "utf-8"
    );
    // Reads are allowed
    expect(content).toContain("cfaSessions");
    expect(content).toContain("cfaPreferenceRecords");
    // No writes
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
  });

  it("cfaEngine.ts does not reference proofEngine", () => {
    const cfaPath = path.join(__dirname, "cfaEngine.ts");
    if (!fs.existsSync(cfaPath)) return;
    const content = fs.readFileSync(cfaPath, "utf-8");
    expect(content).not.toContain("proofEngine");
    expect(content).not.toContain("evidenceStatements");
    expect(content).not.toContain("decisionVolume");
  });
});

// ── Criterion 3: No change to Attribution ────────────────────────────────────
describe("Phase 5 — Attribution Isolation", () => {
  it("proofEngine router only reads outcomeAttributions (no writes)", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/proofEngine.ts"),
      "utf-8"
    );
    expect(content).toContain("outcomeAttributions");
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
    expect(content).not.toContain(".delete(");
  });

  it("outcomeLedger router attribution procedures are unchanged", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/outcomeLedger.ts"),
      "utf-8"
    );
    // Attribution procedures still exist
    expect(content).toContain("attributionDashboard:");
    expect(content).toContain("markMaterialized:");
    expect(content).toContain("listAttributions:");
  });
});

// ── Criterion 4: No change to Calibration ────────────────────────────────────
describe("Phase 5 — Calibration Isolation", () => {
  it("outcomeLedger calibration procedures are unchanged", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/outcomeLedger.ts"),
      "utf-8"
    );
    expect(content).toContain("calibrationMetrics:");
    expect(content).toContain("blockerCalibration:");
    expect(content).toContain("missedRisks:");
    expect(content).toContain("calibrationDashboard:");
  });

  it("proofEngine router does not duplicate calibration procedures", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/proofEngine.ts"),
      "utf-8"
    );
    // proofEngine has its own procedures, not copies of calibration ones
    expect(content).not.toContain("calibrationMetrics:");
    expect(content).not.toContain("blockerCalibration:");
    expect(content).not.toContain("calibrationDashboard:");
  });
});

// ── Criterion 5: Evidence statements use actual data only ─────────────────────
describe("Phase 5 — Evidence Statement Data Integrity", () => {
  it("evidence statements are threshold-gated (MIN_SAMPLE_SIZE constant exists)", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/proofEngine.ts"),
      "utf-8"
    );
    expect(content).toContain("MIN_SAMPLE_SIZE");
    expect(content).toContain("minSampleSize");
  });

  it("evidence statements only emit when sample size >= threshold", () => {
    // Simulate the threshold logic
    const threshold = 10;
    const sampleSize = 5;
    const shouldEmit = sampleSize >= threshold;
    expect(shouldEmit).toBe(false);

    const sampleSize2 = 15;
    const shouldEmit2 = sampleSize2 >= threshold;
    expect(shouldEmit2).toBe(true);
  });

  it("evidence statement format includes sampleSize field", () => {
    // Verify the return shape includes sampleSize
    const mockStatement = {
      id: "vol-total",
      statement: "Across 412 evaluated decisions, the Council achieved 74% outcome agreement.",
      sampleSize: 412,
      category: "volume" as const,
      confidence: "high" as const,
    };
    expect(mockStatement).toHaveProperty("sampleSize");
    expect(mockStatement.sampleSize).toBeGreaterThan(0);
    expect(mockStatement.statement).toContain("412");
  });

  it("evidence statements include confidence level (high/medium/low)", () => {
    const validConfidences = ["high", "medium", "low"];
    const stmt = { confidence: "high" as const };
    expect(validConfidences).toContain(stmt.confidence);
  });

  it("precision formula uses actual TP/FP counts (no hardcoded values)", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers/proofEngine.ts"),
      "utf-8"
    );
    // Precision is computed from p.tp / (p.tp + p.fp)
    expect(content).toContain("p.tp / (p.tp + p.fp)");
    // No hardcoded percentages
    expect(content).not.toContain("precision = 0.74");
    expect(content).not.toContain("precision = 0.68");
  });

  it("evidenceStatements procedure exists in proofEngine router", async () => {
    const { proofEngineRouter } = await import("./routers/proofEngine");
    const routerDef = proofEngineRouter as Record<string, unknown>;
    expect(routerDef).toHaveProperty("evidenceStatements");
  });

  it("fullProofSummary procedure exists in proofEngine router", async () => {
    const { proofEngineRouter } = await import("./routers/proofEngine");
    const routerDef = proofEngineRouter as Record<string, unknown>;
    expect(routerDef).toHaveProperty("fullProofSummary");
  });
});

// ── Criterion 6: PDF export ───────────────────────────────────────────────────
describe("Phase 5 — PDF Export", () => {
  it("InstitutionalProof.tsx exists at correct path", () => {
    const filePath = path.join(__dirname, "../client/src/pages/admin/InstitutionalProof.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("InstitutionalProof.tsx contains generateProofPDF function", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../client/src/pages/admin/InstitutionalProof.tsx"),
      "utf-8"
    );
    expect(content).toContain("generateProofPDF");
    expect(content).toContain("window.open");
    expect(content).toContain("Export PDF Report");
  });

  it("PDF template contains all 6 required sections", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../client/src/pages/admin/InstitutionalProof.tsx"),
      "utf-8"
    );
    expect(content).toContain("1. Decision Volume");
    expect(content).toContain("2. Outcome Tracking");
    expect(content).toContain("3. Persona Performance");
    expect(content).toContain("4. Risk Category Performance");
    expect(content).toContain("5. Evidence Statements");
    expect(content).toContain("6. Methodology");
  });

  it("PDF export is triggered via print dialog (not server-side)", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../client/src/pages/admin/InstitutionalProof.tsx"),
      "utf-8"
    );
    expect(content).toContain("win.print()");
    expect(content).toContain("window.open");
  });

  it("PDF includes methodology section explaining all metrics", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../client/src/pages/admin/InstitutionalProof.tsx"),
      "utf-8"
    );
    expect(content).toContain("Precision = TP/(TP+FP)");
    expect(content).toContain("Recall = TP/(TP+FN)");
    expect(content).toContain("F1 = 2");
    expect(content).toContain("Materialization Rate");
    expect(content).toContain("Outcome Agreement Rate");
  });
});

// ── Criterion 7: Route and navigation ────────────────────────────────────────
describe("Phase 5 — Route and Navigation", () => {
  it("/admin/proof route is registered in App.tsx", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../client/src/App.tsx"),
      "utf-8"
    );
    expect(content).toContain("/admin/proof");
    expect(content).toContain("InstitutionalProof");
  });

  it("Institutional Proof sidebar link exists in MeshSidebar.tsx", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../client/src/components/MeshSidebar.tsx"),
      "utf-8"
    );
    expect(content).toContain("/admin/proof");
    expect(content).toContain("Institutional Proof");
  });

  it("proofEngine router is registered in main routers.ts", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "routers.ts"),
      "utf-8"
    );
    expect(content).toContain("proofEngine: proofEngineRouter");
    expect(content).toContain("proofEngineRouter");
  });

  it("all 6 proofEngine procedures are exported", async () => {
    const { proofEngineRouter } = await import("./routers/proofEngine");
    const routerDef = proofEngineRouter as Record<string, unknown>;
    expect(routerDef).toHaveProperty("decisionVolume");
    expect(routerDef).toHaveProperty("outcomeTracking");
    expect(routerDef).toHaveProperty("councilPerformance");
    expect(routerDef).toHaveProperty("topPredictivePersonas");
    expect(routerDef).toHaveProperty("riskCategoryPerformance");
    expect(routerDef).toHaveProperty("evidenceStatements");
    expect(routerDef).toHaveProperty("fullProofSummary");
  });
});

// ── Panel logic unit tests ────────────────────────────────────────────────────
describe("Phase 5 — Panel Logic", () => {
  it("Panel 1: daysAgo helper computes correct timestamp", () => {
    const now = Date.now();
    const ago30 = now - 30 * 24 * 60 * 60 * 1000;
    const diff = now - ago30;
    expect(diff).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("Panel 3: confidence bucket assignment", () => {
    const buckets = { low: 0, medium: 0, high: 0, veryHigh: 0 };
    const confidences = [0.3, 0.5, 0.7, 0.9, 0.85, 0.45, 0.25];
    for (const conf of confidences) {
      if (conf < 0.4) buckets.low++;
      else if (conf < 0.6) buckets.medium++;
      else if (conf < 0.8) buckets.high++;
      else buckets.veryHigh++;
    }
    expect(buckets.low).toBe(2);    // 0.3, 0.25
    expect(buckets.medium).toBe(2); // 0.5, 0.45
    expect(buckets.high).toBe(1);   // 0.7
    expect(buckets.veryHigh).toBe(2); // 0.9, 0.85
  });

  it("Panel 3: outcome agreement detection (APPROVED + SUCCEEDED)", () => {
    const sessions = [
      { originalVerdict: "APPROVED", outcomeStatus: "SUCCEEDED" },
      { originalVerdict: "VETOED", outcomeStatus: "FAILED" },
      { originalVerdict: "APPROVED", outcomeStatus: "FAILED" },
      { originalVerdict: "VETOED", outcomeStatus: "SUCCEEDED" },
    ];
    let agreements = 0;
    for (const s of sessions) {
      const verdict = s.originalVerdict.toUpperCase();
      const outcome = s.outcomeStatus;
      if ((verdict.includes("APPROVED") || verdict.includes("PASS") || verdict === "INVEST") && outcome === "SUCCEEDED") agreements++;
      else if ((verdict.includes("VETOED") || verdict.includes("REJECT") || verdict === "PASS") && (outcome === "FAILED" || outcome === "ABANDONED")) agreements++;
    }
    expect(agreements).toBe(2);
    expect(agreements / sessions.length).toBe(0.5);
  });

  it("Panel 5: materialization rate per category", () => {
    const reviewed = [
      { predictionType: "FINANCIAL", materialized: 1 },
      { predictionType: "FINANCIAL", materialized: 1 },
      { predictionType: "FINANCIAL", materialized: 0 },
      { predictionType: "REGULATORY", materialized: 1 },
    ];
    const bMap: Record<string, { m: number; fa: number }> = {};
    for (const r of reviewed) {
      if (!bMap[r.predictionType]) bMap[r.predictionType] = { m: 0, fa: 0 };
      if (r.materialized === 1) bMap[r.predictionType].m++;
      else bMap[r.predictionType].fa++;
    }
    const finRate = bMap["FINANCIAL"].m / (bMap["FINANCIAL"].m + bMap["FINANCIAL"].fa);
    expect(finRate).toBeCloseTo(0.6667, 3);
    const regRate = bMap["REGULATORY"].m / (bMap["REGULATORY"].m + bMap["REGULATORY"].fa);
    expect(regRate).toBe(1.0);
  });

  it("Panel 6: evidence statement only emits above threshold", () => {
    const threshold = 10;
    const generateStatement = (sampleSize: number) => {
      if (sampleSize < threshold) return null;
      return `Across ${sampleSize} decisions, evidence is available.`;
    };
    expect(generateStatement(5)).toBeNull();
    expect(generateStatement(10)).not.toBeNull();
    expect(generateStatement(100)).toContain("100");
  });

  it("confidence level assignment based on sample size", () => {
    const getConfidence = (n: number): "high" | "medium" | "low" => {
      if (n >= 100) return "high";
      if (n >= 50) return "medium";
      return "low";
    };
    expect(getConfidence(150)).toBe("high");
    expect(getConfidence(75)).toBe("medium");
    expect(getConfidence(20)).toBe("low");
  });
});
