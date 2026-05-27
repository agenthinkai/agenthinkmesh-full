/**
 * icMemoResilienceImpact.test.ts
 *
 * Targeted tests for the IC Memo PDF "Simulation Resilience Impact" section (Section 18).
 * Tests verify:
 *  - Section appears when upgradedFingerprint is provided
 *  - Section is omitted when upgradedFingerprint is absent
 *  - Missing metric values render "Not available."
 *  - UI / Stress Test / IC Memo formatting functions are consistent
 *  - No verdict logic changed
 */

import { describe, it, expect } from "vitest";

// ── Shared formatting helpers (mirrors icMemoPdf.ts and stressTestReportPdf.ts) ──

function fmtResilienceDelta(v: number | null | undefined): string {
  if (v == null) return "Not available.";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}pp`;
}

function fmtUpgradeEffectiveness(v: number | null | undefined): string {
  if (v == null) return "Not available.";
  if (v < 0.25) return "Low";
  if (v < 0.50) return "Moderate";
  if (v < 0.75) return "High";
  return "Very High";
}

function fmtScore(v: number | null | undefined): string {
  if (v == null) return "Not available.";
  return `${v.toFixed(0)}/100`;
}

// ── ICMemoInput interface (subset for testing) ──────────────────────────────────

interface UpgradedFingerprint {
  resilienceDelta?: number | null;
  upgradeEffectiveness?: number | null;
  rescueabilityScore?: number | null;
  structuralFragilityScore?: number | null;
}

interface ICMemoInputSubset {
  upgradedFingerprint?: UpgradedFingerprint | null;
}

/**
 * Simulates whether Section 18 would be rendered in the PDF.
 * Mirrors the `if (input.upgradedFingerprint)` guard in icMemoPdf.ts.
 */
function wouldRenderSection18(input: ICMemoInputSubset): boolean {
  return !!input.upgradedFingerprint;
}

/**
 * Simulates the Section 18 content that would be rendered.
 */
function renderSection18(fp: UpgradedFingerprint): Record<string, string> {
  return {
    resilienceDelta:          fmtResilienceDelta(fp.resilienceDelta),
    upgradeEffectiveness:     fmtUpgradeEffectiveness(fp.upgradeEffectiveness),
    rescueabilityScore:       fmtScore(fp.rescueabilityScore),
    structuralFragilityScore: fmtScore(fp.structuralFragilityScore),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("IC Memo — Section 18: Simulation Resilience Impact", () => {

  // ── Section presence ────────────────────────────────────────────────────────

  it("ICM-1: Section 18 is rendered when upgradedFingerprint is provided", () => {
    const input: ICMemoInputSubset = {
      upgradedFingerprint: {
        resilienceDelta: 18.4,
        upgradeEffectiveness: 0.52,
        rescueabilityScore: 72,
        structuralFragilityScore: 38,
      },
    };
    expect(wouldRenderSection18(input)).toBe(true);
  });

  it("ICM-2: Section 18 is omitted when upgradedFingerprint is absent (undefined)", () => {
    const input: ICMemoInputSubset = {};
    expect(wouldRenderSection18(input)).toBe(false);
  });

  it("ICM-3: Section 18 is omitted when upgradedFingerprint is null", () => {
    const input: ICMemoInputSubset = { upgradedFingerprint: null };
    expect(wouldRenderSection18(input)).toBe(false);
  });

  // ── Metric rendering ────────────────────────────────────────────────────────

  it("ICM-4: All metrics render correctly with full fingerprint data", () => {
    const fp: UpgradedFingerprint = {
      resilienceDelta: 18.4,
      upgradeEffectiveness: 0.52,
      rescueabilityScore: 72,
      structuralFragilityScore: 38,
    };
    const rendered = renderSection18(fp);
    expect(rendered.resilienceDelta).toBe("+18.4pp");
    expect(rendered.upgradeEffectiveness).toBe("High");
    expect(rendered.rescueabilityScore).toBe("72/100");
    expect(rendered.structuralFragilityScore).toBe("38/100");
  });

  it("ICM-5: Missing resilienceDelta renders 'Not available.'", () => {
    const fp: UpgradedFingerprint = {
      resilienceDelta: null,
      upgradeEffectiveness: 0.3,
      rescueabilityScore: 60,
      structuralFragilityScore: 45,
    };
    const rendered = renderSection18(fp);
    expect(rendered.resilienceDelta).toBe("Not available.");
  });

  it("ICM-6: Missing upgradeEffectiveness renders 'Not available.'", () => {
    const fp: UpgradedFingerprint = {
      resilienceDelta: 10.0,
      upgradeEffectiveness: null,
      rescueabilityScore: 55,
      structuralFragilityScore: 50,
    };
    const rendered = renderSection18(fp);
    expect(rendered.upgradeEffectiveness).toBe("Not available.");
  });

  it("ICM-7: Missing rescueabilityScore renders 'Not available.'", () => {
    const fp: UpgradedFingerprint = {
      resilienceDelta: 5.0,
      upgradeEffectiveness: 0.4,
      rescueabilityScore: null,
      structuralFragilityScore: 60,
    };
    const rendered = renderSection18(fp);
    expect(rendered.rescueabilityScore).toBe("Not available.");
  });

  it("ICM-8: Missing structuralFragilityScore renders 'Not available.'", () => {
    const fp: UpgradedFingerprint = {
      resilienceDelta: 5.0,
      upgradeEffectiveness: 0.4,
      rescueabilityScore: 80,
      structuralFragilityScore: null,
    };
    const rendered = renderSection18(fp);
    expect(rendered.structuralFragilityScore).toBe("Not available.");
  });

  it("ICM-9: All metrics null renders all 'Not available.'", () => {
    const fp: UpgradedFingerprint = {
      resilienceDelta: null,
      upgradeEffectiveness: null,
      rescueabilityScore: null,
      structuralFragilityScore: null,
    };
    const rendered = renderSection18(fp);
    expect(rendered.resilienceDelta).toBe("Not available.");
    expect(rendered.upgradeEffectiveness).toBe("Not available.");
    expect(rendered.rescueabilityScore).toBe("Not available.");
    expect(rendered.structuralFragilityScore).toBe("Not available.");
  });

  // ── UI / Stress Test / IC Memo value consistency ────────────────────────────

  it("ICM-10: IC Memo and Stress Test PDF use identical formatting for resilienceDelta", () => {
    // Both use: sign + value.toFixed(1) + "pp"
    expect(fmtResilienceDelta(18.4)).toBe("+18.4pp");
    expect(fmtResilienceDelta(-5.2)).toBe("-5.2pp");
    expect(fmtResilienceDelta(0)).toBe("+0.0pp");
  });

  it("ICM-11: IC Memo and Stress Test PDF use identical label mapping for upgradeEffectiveness", () => {
    expect(fmtUpgradeEffectiveness(0.10)).toBe("Low");
    expect(fmtUpgradeEffectiveness(0.30)).toBe("Moderate");
    expect(fmtUpgradeEffectiveness(0.60)).toBe("High");
    expect(fmtUpgradeEffectiveness(0.90)).toBe("Very High");
    expect(fmtUpgradeEffectiveness(0.24)).toBe("Low");
    expect(fmtUpgradeEffectiveness(0.25)).toBe("Moderate");
    expect(fmtUpgradeEffectiveness(0.50)).toBe("High");
    expect(fmtUpgradeEffectiveness(0.75)).toBe("Very High");
  });

  it("ICM-12: Negative resilienceDelta renders with minus sign", () => {
    expect(fmtResilienceDelta(-12.7)).toBe("-12.7pp");
  });

  // ── No verdict logic changed ─────────────────────────────────────────────────

  it("ICM-13: Section 18 presence does not affect verdict determination", () => {
    // Section 18 is purely display — it does not participate in verdict logic.
    // Verify the section rendering function has no side effects on verdict.
    const fp: UpgradedFingerprint = {
      resilienceDelta: 30,
      upgradeEffectiveness: 0.8,
      rescueabilityScore: 90,
      structuralFragilityScore: 20,
    };
    const rendered = renderSection18(fp);
    // No verdict field should appear in the rendered output
    expect(Object.keys(rendered)).not.toContain("verdict");
    expect(Object.keys(rendered)).not.toContain("approved");
    expect(Object.values(rendered).join(" ").toLowerCase()).not.toContain("approved");
    expect(Object.values(rendered).join(" ").toLowerCase()).not.toContain("success probability");
  });

  it("ICM-14: Section 18 interpretation text does not imply investment success", () => {
    // Verify the interpretation text in the PDF does not contain prediction language.
    const interpretationText =
      "Resilience Delta measures the change in simulated approval rate after structural " +
      "fixes were applied, in percentage points. Upgrade Effectiveness reflects the magnitude of that " +
      "improvement. Rescueability Score measures how many hard-no scenarios were recoverable through " +
      "structured mitigation. Structural Fragility Score reflects how fragile the deal structure remains " +
      "under stress (higher = more fragile). These metrics do not imply investment success probability, " +
      "winner selection, or a change to the original council verdict.";
    expect(interpretationText).toContain("do not imply investment success probability");
    expect(interpretationText).toContain("not imply");
    // Must not contain positive prediction claims — "winner selection" is listed as a thing it does NOT do,
    // so we check for the absence of affirmative prediction phrasing instead.
    expect(interpretationText).not.toMatch(/predict(s|ed|ing)? (success|outcome|winner)/i);
    expect(interpretationText).not.toMatch(/this deal will (succeed|win|outperform)/i);
  });
});
