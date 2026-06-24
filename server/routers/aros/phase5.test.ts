import { describe, it, expect } from "vitest";

// ── Phase 5 Unit Tests: Hidden Variable Engine + Monitoring Network ────────────

// ── 1. Hidden Variable scoring logic ─────────────────────────────────────────
describe("Hidden Variable Engine — scoring", () => {
  function computeHvScore(signals: {
    aiTransformation: boolean;
    mAndA: boolean;
    capitalAllocation: boolean;
    dataModernization: boolean;
    regulatoryPressure: boolean;
    leadershipChange: boolean;
  }): number {
    const weights = {
      aiTransformation: 30,
      mAndA: 25,
      capitalAllocation: 20,
      dataModernization: 15,
      regulatoryPressure: 5,
      leadershipChange: 5,
    };
    return Object.entries(signals).reduce(
      (sum, [key, active]) => sum + (active ? weights[key as keyof typeof weights] : 0),
      0
    );
  }

  it("returns 0 when no signals are active", () => {
    const score = computeHvScore({
      aiTransformation: false,
      mAndA: false,
      capitalAllocation: false,
      dataModernization: false,
      regulatoryPressure: false,
      leadershipChange: false,
    });
    expect(score).toBe(0);
  });

  it("returns 100 when all signals are active", () => {
    const score = computeHvScore({
      aiTransformation: true,
      mAndA: true,
      capitalAllocation: true,
      dataModernization: true,
      regulatoryPressure: true,
      leadershipChange: true,
    });
    expect(score).toBe(100);
  });

  it("weights AI transformation highest at 30", () => {
    const score = computeHvScore({
      aiTransformation: true,
      mAndA: false,
      capitalAllocation: false,
      dataModernization: false,
      regulatoryPressure: false,
      leadershipChange: false,
    });
    expect(score).toBe(30);
  });

  it("AI + M&A = 55 (two highest signals)", () => {
    const score = computeHvScore({
      aiTransformation: true,
      mAndA: true,
      capitalAllocation: false,
      dataModernization: false,
      regulatoryPressure: false,
      leadershipChange: false,
    });
    expect(score).toBe(55);
  });
});

// ── 2. Monitoring urgency tier logic ─────────────────────────────────────────
describe("Monitoring Network — urgency tier", () => {
  type UrgencyTier = "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";

  function classifyUrgency(hvScore: number, opportunityScore: number): UrgencyTier {
    const composite = hvScore * 0.6 + opportunityScore * 0.4;
    if (composite >= 80) return "IMMEDIATE";
    if (composite >= 60) return "HIGH";
    if (composite >= 40) return "MEDIUM";
    return "LOW";
  }

  it("returns IMMEDIATE for top-tier composite", () => {
    expect(classifyUrgency(90, 95)).toBe("IMMEDIATE");
  });

  it("returns HIGH for mid-high composite", () => {
    expect(classifyUrgency(70, 60)).toBe("HIGH");
  });

  it("returns MEDIUM for moderate composite", () => {
    expect(classifyUrgency(50, 45)).toBe("MEDIUM");
  });

  it("returns LOW for weak signals", () => {
    expect(classifyUrgency(20, 30)).toBe("LOW");
  });

  it("boundary: composite = 80 is IMMEDIATE", () => {
    // hvScore=80, oppScore=80 → composite = 80*0.6 + 80*0.4 = 80
    expect(classifyUrgency(80, 80)).toBe("IMMEDIATE");
  });
});

// ── 3. Calibration accuracy delta ────────────────────────────────────────────
describe("Calibration Engine — accuracy delta", () => {
  function computeAccuracyDelta(predicted: number, actual: number): number {
    return Math.abs(predicted - actual);
  }

  function classifyAccuracy(delta: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
    if (delta <= 5) return "EXCELLENT";
    if (delta <= 15) return "GOOD";
    if (delta <= 30) return "FAIR";
    return "POOR";
  }

  it("delta of 0 is EXCELLENT", () => {
    expect(classifyAccuracy(computeAccuracyDelta(10, 10))).toBe("EXCELLENT");
  });

  it("delta of 5 is EXCELLENT (boundary)", () => {
    expect(classifyAccuracy(computeAccuracyDelta(10, 15))).toBe("EXCELLENT");
  });

  it("delta of 10 is GOOD", () => {
    expect(classifyAccuracy(computeAccuracyDelta(10, 20))).toBe("GOOD");
  });

  it("delta of 20 is FAIR", () => {
    expect(classifyAccuracy(computeAccuracyDelta(10, 30))).toBe("FAIR");
  });

  it("delta of 40 is POOR", () => {
    expect(classifyAccuracy(computeAccuracyDelta(10, 50))).toBe("POOR");
  });
});

// ── 4. ACV estimation from opportunity score ─────────────────────────────────
describe("Decision Twin V2 — ACV estimation", () => {
  function estimateAcv(opportunityScore: number, sector: string): number {
    const sectorMultiplier: Record<string, number> = {
      bank: 1.5,
      asset_manager: 1.3,
      energy: 1.2,
      telecom: 1.0,
      infrastructure: 1.4,
    };
    const base = opportunityScore * 1000; // $1K per score point
    const multiplier = sectorMultiplier[sector] ?? 1.0;
    return Math.round(base * multiplier);
  }

  it("bank with score 95 = $142,500", () => {
    expect(estimateAcv(95, "bank")).toBe(142500);
  });

  it("telecom with score 80 = $80,000", () => {
    expect(estimateAcv(80, "telecom")).toBe(80000);
  });

  it("unknown sector defaults to 1.0 multiplier", () => {
    expect(estimateAcv(50, "unknown")).toBe(50000);
  });

  it("score 0 yields ACV 0 regardless of sector", () => {
    expect(estimateAcv(0, "bank")).toBe(0);
  });
});

// ── 5. Outcome Ledger V2 — observation completeness ──────────────────────────
describe("Outcome Ledger V2 — observation completeness", () => {
  interface ObservationRecord {
    hasDecisionTwin: boolean;
    hasHiddenVariables: boolean;
    hasPipelineEntry: boolean;
    hasCalibrationBaseline: boolean;
    hasOutcomeLedgerEntry: boolean;
  }

  function computeCompleteness(obs: ObservationRecord): number {
    const fields = Object.values(obs);
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }

  it("fully complete record = 100%", () => {
    expect(computeCompleteness({
      hasDecisionTwin: true,
      hasHiddenVariables: true,
      hasPipelineEntry: true,
      hasCalibrationBaseline: true,
      hasOutcomeLedgerEntry: true,
    })).toBe(100);
  });

  it("empty record = 0%", () => {
    expect(computeCompleteness({
      hasDecisionTwin: false,
      hasHiddenVariables: false,
      hasPipelineEntry: false,
      hasCalibrationBaseline: false,
      hasOutcomeLedgerEntry: false,
    })).toBe(0);
  });

  it("3 of 5 filled = 60%", () => {
    expect(computeCompleteness({
      hasDecisionTwin: true,
      hasHiddenVariables: true,
      hasPipelineEntry: true,
      hasCalibrationBaseline: false,
      hasOutcomeLedgerEntry: false,
    })).toBe(60);
  });
});
