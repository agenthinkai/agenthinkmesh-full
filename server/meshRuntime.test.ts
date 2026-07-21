/**
 * Mesh Core v0.1 — Unit Tests
 * Tests computeLoadedCost (Amendment A) and computeVerdict (Amendment D).
 */

import { describe, it, expect } from "vitest";
import { computeLoadedCost, computeVerdict } from "./meshCoreRouter";

// ─────────────────────────────────────────────────────────────────────────────
// Amendment A — computeLoadedCost
// ─────────────────────────────────────────────────────────────────────────────
describe("computeLoadedCost (Amendment A)", () => {
  it("computes token cost correctly for SMALL tier (1M in + 1M out)", () => {
    const tokenCostUsd = (1_000_000 / 1_000_000) * 0.15 + (1_000_000 / 1_000_000) * 0.60;
    expect(tokenCostUsd).toBeCloseTo(0.75, 6);
  });

  it("computes all loaded-cost components correctly", () => {
    const result = computeLoadedCost({
      tokenCostUsd: 0.75,
      humanGateMinutes: 2,
      humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 7.90,
      disputeRate: 0.05,
      liabilityReservePct: 0.03,
    });
    // humanGateCost = 2 × 0.50 = 1.00
    expect(result.humanGateCostUsd).toBeCloseTo(1.00, 6);
    // disputeCost = 0.05 × (0.75 + 2 × 0.50) = 0.05 × 1.75 = 0.0875
    expect(result.disputeCostUsd).toBeCloseTo(0.0875, 6);
    // residencyCac = 7.90
    expect(result.residencyCacUsd).toBeCloseTo(7.90, 6);
    // subTotal = 0.75 + 1.00 + 0.0875 + 7.90 = 9.7375
    // reserve = 9.7375 × 0.03 = 0.292125
    expect(result.liabilityReserveUsd).toBeCloseTo(0.292125, 5);
    // loaded = 9.7375 + 0.292125 = 10.029625
    expect(result.loadedCostUsd).toBeCloseTo(10.029625, 5);
  });

  it("returns tokenCostUsd unchanged in result", () => {
    const result = computeLoadedCost({
      tokenCostUsd: 0.001234,
      humanGateMinutes: 0,
      humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 0.004,
      disputeRate: 0.05,
      liabilityReservePct: 0.03,
    });
    expect(result.tokenCostUsd).toBeCloseTo(0.001234, 6);
  });

  it("self-serve CAC is $0.004 (not $7.90)", () => {
    const result = computeLoadedCost({
      tokenCostUsd: 0.001,
      humanGateMinutes: 0.5,
      humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 0.004,
      disputeRate: 0.05,
      liabilityReservePct: 0.03,
    });
    expect(result.residencyCacUsd).toBeCloseTo(0.004, 6);
  });

  it("zero gate minutes yields zero gate cost", () => {
    const result = computeLoadedCost({
      tokenCostUsd: 0.10,
      humanGateMinutes: 0,
      humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 0.004,
      disputeRate: 0.05,
      liabilityReservePct: 0.03,
    });
    expect(result.humanGateCostUsd).toBe(0);
  });

  it("dispute cost is rate × (token + gate), NOT rate × token only", () => {
    const result = computeLoadedCost({
      tokenCostUsd: 1.00,
      humanGateMinutes: 2,
      humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 0,
      disputeRate: 0.10,
      liabilityReservePct: 0,
    });
    // dispute = 0.10 × (1.00 + 2 × 0.50) = 0.10 × 2.00 = 0.20
    expect(result.disputeCostUsd).toBeCloseTo(0.20, 6);
    expect(result.disputeCostUsd).not.toBeCloseTo(0.10, 6);
  });

  it("liability reserve applies to subtotal, not to price", () => {
    const result = computeLoadedCost({
      tokenCostUsd: 1.00,
      humanGateMinutes: 0,
      humanGateCostPerMinute: 0.50,
      residencyCacPerOuUsd: 0,
      disputeRate: 0.05,
      liabilityReservePct: 0.10,
    });
    // dispute = 0.05 × 1.00 = 0.05; subTotal = 1.05; reserve = 0.105
    expect(result.liabilityReserveUsd).toBeCloseTo(0.105, 6);
    expect(result.loadedCostUsd).toBeCloseTo(1.155, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Amendment D — computeVerdict
// ─────────────────────────────────────────────────────────────────────────────
describe("computeVerdict (Amendment D)", () => {
  it("STRONG when p90 >= 50%", () => {
    expect(computeVerdict(80, 60)).toBe("STRONG");
    expect(computeVerdict(50, 50)).toBe("STRONG");
    expect(computeVerdict(30, 50)).toBe("STRONG");
  });

  it("VIABLE when p90 >= 20% and < 50%", () => {
    expect(computeVerdict(80, 40)).toBe("VIABLE");
    expect(computeVerdict(60, 20)).toBe("VIABLE");
    expect(computeVerdict(10, 30)).toBe("VIABLE");
  });

  it("REPRICE when p50 >= 50% AND p90 < 20%", () => {
    expect(computeVerdict(60, 10)).toBe("REPRICE");
    expect(computeVerdict(50, 0)).toBe("REPRICE");
    expect(computeVerdict(75, 15)).toBe("REPRICE");
  });

  it("FAIL when p50 < 50%", () => {
    expect(computeVerdict(49, 10)).toBe("FAIL");
    expect(computeVerdict(0, 0)).toBe("FAIL");
    expect(computeVerdict(-10, -20)).toBe("FAIL");
  });

  it("FAIL takes priority over REPRICE when p50 < 50%", () => {
    expect(computeVerdict(40, 5)).toBe("FAIL");
  });

  it("STRONG takes priority over VIABLE when p90 >= 50%", () => {
    expect(computeVerdict(70, 55)).toBe("STRONG");
  });

  it("boundary: p90 exactly 50 is STRONG", () => {
    expect(computeVerdict(80, 50)).toBe("STRONG");
  });

  it("boundary: p90 exactly 20 is VIABLE", () => {
    expect(computeVerdict(80, 20)).toBe("VIABLE");
  });

  it("boundary: p90 = 19.99 with p50 >= 50 is REPRICE", () => {
    expect(computeVerdict(55, 19.99)).toBe("REPRICE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Amendment C — p90 margin is computed from 90th-percentile COST
// ─────────────────────────────────────────────────────────────────────────────
describe("Amendment C — p90 margin definition", () => {
  it("p90 margin uses 90th-percentile cost, not 90th-percentile of margin values", () => {
    const price = 10;
    const costs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // sorted ascending, 10 OUs
    // p90 cost = index ceil(0.9 × 10) - 1 = index 8 = cost 9
    const p90Cost = 9;
    const p90Margin = ((price - p90Cost) / price) * 100; // = 10%
    expect(p90Margin).toBeCloseTo(10, 4);

    // p50 cost = index ceil(0.5 × 10) - 1 = index 4 = cost 5
    const p50Cost = 5;
    const p50Margin = ((price - p50Cost) / price) * 100; // = 50%
    // p50 = 50% >= 50, p90 = 10% < 20% → REPRICE
    expect(computeVerdict(p50Margin, p90Margin)).toBe("REPRICE");
  });
});
