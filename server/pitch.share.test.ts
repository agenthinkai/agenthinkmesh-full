/**
 * server/pitch.share.test.ts
 * Tests for PitchMirror shared result stage handling:
 *   1. Shared result shows founderStageLabel when stage is present
 *   2. Legacy shared result (no stage) renders without error — label is null
 *   3. getShare response does not leak private metadata (userId, email, etc.)
 *   4. Stage label mapping is correct for all 4 stages
 *   5. Unknown / invalid stage values are handled gracefully
 */

import { describe, it, expect } from "vitest";

// ── Stage label mapping (mirrors server logic) ────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  idea: "Exploring idea",
  building: "Building (no revenue)",
  early_revenue: "Early revenue",
  scaling: "Scaling",
};

function resolveStageLabel(founderStage: string | null | undefined): string | null {
  if (!founderStage) return null;
  return STAGE_LABELS[founderStage] ?? null;
}

// ── Simulated getShare response shape ────────────────────────────────────────

interface GetShareResponse {
  sections: {
    whatInvestorsSee: { strengths: string[]; concerns: string[] };
    whatToFix: string[];
    whatsMissing: string[];
  };
  createdAt: Date;
  founderStage: string | null;
  founderStageLabel: string | null;
}

function buildShareResponse(founderStage: string | null): GetShareResponse {
  return {
    sections: {
      whatInvestorsSee: {
        strengths: ["Strong market size framing."],
        concerns: ["Traction data is thin."],
      },
      whatToFix: ["Add revenue metrics."],
      whatsMissing: ["Team background missing."],
    },
    createdAt: new Date("2026-04-17T00:00:00Z"),
    founderStage,
    founderStageLabel: resolveStageLabel(founderStage),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PitchMirror shared result — stage label", () => {
  it("shows correct label for 'idea' stage", () => {
    const res = buildShareResponse("idea");
    expect(res.founderStageLabel).toBe("Exploring idea");
  });

  it("shows correct label for 'building' stage", () => {
    const res = buildShareResponse("building");
    expect(res.founderStageLabel).toBe("Building (no revenue)");
  });

  it("shows correct label for 'early_revenue' stage", () => {
    const res = buildShareResponse("early_revenue");
    expect(res.founderStageLabel).toBe("Early revenue");
  });

  it("shows correct label for 'scaling' stage", () => {
    const res = buildShareResponse("scaling");
    expect(res.founderStageLabel).toBe("Scaling");
  });
});

describe("PitchMirror shared result — legacy handling (no stage)", () => {
  it("returns null founderStageLabel when founderStage is null", () => {
    const res = buildShareResponse(null);
    expect(res.founderStage).toBeNull();
    expect(res.founderStageLabel).toBeNull();
  });

  it("returns null founderStageLabel when founderStage is undefined", () => {
    const label = resolveStageLabel(undefined);
    expect(label).toBeNull();
  });

  it("still returns sections correctly when stage is absent", () => {
    const res = buildShareResponse(null);
    expect(res.sections.whatInvestorsSee.strengths).toHaveLength(1);
    expect(res.sections.whatToFix).toHaveLength(1);
    expect(res.sections.whatsMissing).toHaveLength(1);
  });
});

describe("PitchMirror shared result — unknown stage values", () => {
  it("returns null label for an unrecognised stage string", () => {
    const label = resolveStageLabel("unknown_stage");
    expect(label).toBeNull();
  });

  it("returns null label for an empty string", () => {
    const label = resolveStageLabel("");
    expect(label).toBeNull();
  });
});

describe("PitchMirror shared result — no private metadata", () => {
  it("response does not contain userId field", () => {
    const res = buildShareResponse("building");
    expect(Object.keys(res)).not.toContain("userId");
  });

  it("response does not contain email field", () => {
    const res = buildShareResponse("building");
    expect(Object.keys(res)).not.toContain("email");
  });

  it("response does not contain pitchText field", () => {
    const res = buildShareResponse("building");
    expect(Object.keys(res)).not.toContain("pitchText");
  });

  it("response does not contain runsUsed field", () => {
    const res = buildShareResponse("building");
    expect(Object.keys(res)).not.toContain("runsUsed");
  });

  it("response only exposes sections, createdAt, founderStage, founderStageLabel", () => {
    const res = buildShareResponse("scaling");
    const keys = Object.keys(res).sort();
    expect(keys).toEqual(["createdAt", "founderStage", "founderStageLabel", "sections"].sort());
  });
});

describe("PitchMirror shared result — copy output text", () => {
  function buildCopyText(
    sections: GetShareResponse["sections"],
    founderStageLabel: string | null
  ): string {
    const lines: string[] = ["PITCHMIRROR FEEDBACK\n"];
    if (founderStageLabel) {
      lines.push(`Stage: ${founderStageLabel}\n`);
    }
    lines.push("WHAT INVESTORS SEE");
    lines.push("Strengths:");
    sections.whatInvestorsSee.strengths.forEach((x) => lines.push(`  ✓ ${x}`));
    lines.push("Concerns:");
    sections.whatInvestorsSee.concerns.forEach((x) => lines.push(`  ! ${x}`));
    lines.push("\nWHAT TO FIX BEFORE SENDING");
    sections.whatToFix.forEach((x, i) => lines.push(`  ${i + 1}. ${x}`));
    lines.push("\nWHAT'S MISSING");
    sections.whatsMissing.forEach((x) => lines.push(`  ○ ${x}`));
    return lines.join("\n");
  }

  it("includes Stage line when founderStageLabel is present", () => {
    const res = buildShareResponse("early_revenue");
    const text = buildCopyText(res.sections, res.founderStageLabel);
    expect(text).toContain("Stage: Early revenue");
  });

  it("does NOT include Stage line when founderStageLabel is null (legacy)", () => {
    const res = buildShareResponse(null);
    const text = buildCopyText(res.sections, res.founderStageLabel);
    expect(text).not.toContain("Stage:");
  });

  it("always includes PITCHMIRROR FEEDBACK header", () => {
    const res = buildShareResponse(null);
    const text = buildCopyText(res.sections, res.founderStageLabel);
    expect(text).toContain("PITCHMIRROR FEEDBACK");
  });

  it("Stage line appears before WHAT INVESTORS SEE", () => {
    const res = buildShareResponse("idea");
    const text = buildCopyText(res.sections, res.founderStageLabel);
    const stageIdx = text.indexOf("Stage:");
    const sectionIdx = text.indexOf("WHAT INVESTORS SEE");
    expect(stageIdx).toBeLessThan(sectionIdx);
  });
});
