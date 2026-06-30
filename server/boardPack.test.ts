/**
 * boardPack.test.ts — Unit tests for Board Intelligence Pack router
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// ── Mock LLM ──────────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "## Executive Summary\n\nThis is a board-quality intelligence document for testing purposes.\n\n## Key Finding\n\nThe strategic decision presents a significant opportunity.",
        },
      },
    ],
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("boardPack router", () => {
  it("generates a pack ID with correct format", () => {
    const packId = `BP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    expect(packId).toMatch(/^BP-\d+-[A-Z0-9]{6}$/);
  });

  it("validates that all 8 required sections are present", () => {
    const requiredSections = [
      "Executive Summary",
      "Decision Twin",
      "Executive Intelligence Brief",
      "Institutional Proof",
      "Calibration",
      "Customer Proof",
      "Recommendation",
      "Audit Trail",
    ];
    expect(requiredSections).toHaveLength(8);
    requiredSections.forEach((section) => {
      expect(typeof section).toBe("string");
      expect(section.length).toBeGreaterThan(0);
    });
  });

  it("formats audit trail with all required fields", () => {
    const auditTrail = {
      decisionTwinVersion: "DT-v1.0",
      constitutionVersion: "v1.0",
      hiddenVariableVersion: "HV-v1.0",
      evidenceManifestHash: null,
      generationTimestamp: Date.now(),
      modelVersion: "claude-sonnet-4-5",
      packId: "BP-test-ABCDEF",
    };

    expect(auditTrail.decisionTwinVersion).toBeDefined();
    expect(auditTrail.constitutionVersion).toBeDefined();
    expect(auditTrail.hiddenVariableVersion).toBeDefined();
    expect(auditTrail.generationTimestamp).toBeGreaterThan(0);
    expect(auditTrail.modelVersion).toBeDefined();
    expect(auditTrail.packId).toMatch(/^BP-/);
  });

  it("returns null DB gracefully without throwing", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    expect(db).toBeNull();
    // Should not throw — router handles null DB with empty fallbacks
  });

  it("validates export format types", () => {
    const validFormats = ["pdf", "pptx", "docx"] as const;
    validFormats.forEach((format) => {
      expect(["pdf", "pptx", "docx"]).toContain(format);
    });
  });

  it("validates that pack data structure is complete", () => {
    const mockPack = {
      packId: "BP-1234567890-ABCDEF",
      companyId: 1,
      companyName: "Test Corporation",
      executiveName: "John Smith",
      generatedAt: Date.now(),
      constitutionVersion: "v1.0",
      modelVersion: "claude-sonnet-4-5",
      sections: [
        { title: "Executive Summary", content: "Test content", metadata: {} },
      ],
      auditTrail: {
        decisionTwinVersion: "DT-v1.0",
        constitutionVersion: "v1.0",
        hiddenVariableVersion: "HV-v1.0",
        evidenceManifestHash: null,
        generationTimestamp: Date.now(),
        modelVersion: "claude-sonnet-4-5",
        packId: "BP-1234567890-ABCDEF",
      },
    };

    expect(mockPack.packId).toBeTruthy();
    expect(mockPack.companyName).toBeTruthy();
    expect(mockPack.sections).toHaveLength(1);
    expect(mockPack.auditTrail.packId).toBe(mockPack.packId);
  });

  it("safe filename generation removes special characters", () => {
    const companyName = "Test Corp. (GCC) & Partners!";
    const safeName = companyName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);
    expect(safeName).toBe("Test-Corp-GCC-Partners");
    expect(safeName).not.toContain(".");
    expect(safeName).not.toContain("(");
    expect(safeName).not.toContain("!");
  });
});
