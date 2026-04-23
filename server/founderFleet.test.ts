/**
 * founderFleet.test.ts
 *
 * Unit tests for the FounderAgent Fleet pure helper functions.
 * No DB, no LLM calls — all pure logic.
 */

import { describe, it, expect } from "vitest";
import {
  classificationToScore,
  computeFinalScore,
  FLEET_DOMAINS,
} from "./founderFleet";

describe("classificationToScore", () => {
  it("maps ENGAGE to 87 (midpoint 75–100)", () => {
    expect(classificationToScore("ENGAGE")).toBe(87);
  });

  it("maps WATCH to 57 (midpoint 40–74)", () => {
    expect(classificationToScore("WATCH")).toBe(57);
  });

  it("maps PASS to 19 (midpoint 0–39)", () => {
    expect(classificationToScore("PASS")).toBe(19);
  });

  it("maps unknown classification to 19 (PASS fallback)", () => {
    expect(classificationToScore("UNKNOWN")).toBe(19);
    expect(classificationToScore("")).toBe(19);
  });
});

describe("computeFinalScore", () => {
  it("returns weighted average of classification(50%), execution(25%), market(25%)", () => {
    // 80*0.5 + 60*0.25 + 40*0.25 = 40 + 15 + 10 = 65
    expect(computeFinalScore(80, 60, 40)).toBe(65);
    // 87*0.5 + 57*0.25 + 57*0.25 = 43.5 + 14.25 + 14.25 = 72
    expect(computeFinalScore(87, 57, 57)).toBe(72);
  });

  it("handles all zeros", () => {
    expect(computeFinalScore(0, 0, 0)).toBe(0);
  });

  it("handles all 100s", () => {
    expect(computeFinalScore(100, 100, 100)).toBe(100);
  });

  it("rounds to integer", () => {
    // 80*0.5 + 70*0.25 + 71*0.25 = 40 + 17.5 + 17.75 = 75.25 → 75
    const result = computeFinalScore(80, 70, 71);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("clamps to 0–100 range", () => {
    expect(computeFinalScore(0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(computeFinalScore(100, 100, 100)).toBeLessThanOrEqual(100);
  });
});

describe("FLEET_DOMAINS", () => {
  it("has at least 5 domains", () => {
    expect(FLEET_DOMAINS.length).toBeGreaterThanOrEqual(5);
  });

  it("each domain has name and subSectors", () => {
    for (const d of FLEET_DOMAINS) {
      expect(typeof d.name).toBe("string");
      expect(d.name.length).toBeGreaterThan(0);
      expect(Array.isArray(d.subSectors)).toBe(true);
      expect(d.subSectors.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate domain names", () => {
    const names = FLEET_DOMAINS.map((d) => d.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("total ideas across domains is at least 50 when using 10 per domain", () => {
    // 5 domains × 10 ideas each = 50 ideas minimum per batch
    expect(FLEET_DOMAINS.length * 10).toBeGreaterThanOrEqual(50);
  });
});
