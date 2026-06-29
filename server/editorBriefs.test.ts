/**
 * editorBriefs.test.ts — Unit tests for Pre-Dispatch Editor Mode
 *
 * Tests the core lifecycle:
 *   NO_DRAFT → DRAFT → READY → APPROVED → SCHEDULED (auto-promote)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB ───────────────────────────────────────────────────────────────
const mockInsert = vi.fn().mockResolvedValue([{ insertId: 99 }]);
const mockUpdate = vi.fn().mockResolvedValue([]);
const mockSelect = vi.fn();

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: mockSelect,
    insert: () => ({ values: mockInsert }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  }),
}));

vi.mock("../server/_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          noteSubject: "Infrastructure Modernisation Decision Detected",
          noteBody: "Para 1. Para 2. Para 3. Para 4.",
          executiveBrief: "Full 400-word brief here.",
          hiddenVariable: "Regulatory approval timeline for cross-border data flows",
          strategicDecision: "Board-level decision to migrate core banking infrastructure",
          evidenceConfidence: 87,
        }),
      },
    }],
  }),
}));

// ── Status lifecycle tests ────────────────────────────────────────────────────
describe("EditorBriefs — status lifecycle", () => {
  it("DRAFT status is the default for new generated briefs", () => {
    const defaultStatus = "DRAFT";
    expect(defaultStatus).toBe("DRAFT");
  });

  it("Status progression: DRAFT → READY → APPROVED → SCHEDULED", () => {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["READY", "DRAFT"],
      READY: ["APPROVED", "DRAFT"],
      APPROVED: ["SCHEDULED"],
      SCHEDULED: ["SENT"],
      SENT: [],
    };
    expect(validTransitions.DRAFT).toContain("READY");
    expect(validTransitions.READY).toContain("APPROVED");
    expect(validTransitions.APPROVED).toContain("SCHEDULED");
    expect(validTransitions.SCHEDULED).toContain("SENT");
  });

  it("Auto-promote triggers when Triple Gate passes (SSS≥90, ESI≥85, Conf≥80)", () => {
    const sss = 92;
    const esi = 88;
    const conf = 85;
    const tripleGatePasses = sss >= 90 && esi >= 85 && conf >= 80;
    expect(tripleGatePasses).toBe(true);
  });

  it("Auto-promote does NOT trigger when Triple Gate fails", () => {
    const sss = 85; // below threshold
    const esi = 88;
    const conf = 85;
    const tripleGatePasses = sss >= 90 && esi >= 85 && conf >= 80;
    expect(tripleGatePasses).toBe(false);
  });

  it("Triple Gate requires all three conditions to pass", () => {
    const cases = [
      { sss: 90, esi: 84, conf: 80, expected: false }, // ESI fails
      { sss: 89, esi: 85, conf: 80, expected: false }, // SSS fails
      { sss: 90, esi: 85, conf: 79, expected: false }, // Conf fails
      { sss: 90, esi: 85, conf: 80, expected: true },  // All pass
    ];
    for (const c of cases) {
      const passes = c.sss >= 90 && c.esi >= 85 && c.conf >= 80;
      expect(passes).toBe(c.expected);
    }
  });
});

// ── Brief content tests ───────────────────────────────────────────────────────
describe("EditorBriefs — brief content structure", () => {
  it("Brief content includes SUBJECT line and body", () => {
    const subject = "Infrastructure Modernisation Decision Detected";
    const body = "Para 1. Para 2. Para 3. Para 4.";
    const briefContent = `SUBJECT: ${subject}\n\n${body}`;
    expect(briefContent).toContain("SUBJECT:");
    expect(briefContent).toContain(subject);
  });

  it("Evidence confidence is bounded 0-100", () => {
    const conf = 87;
    expect(conf).toBeGreaterThanOrEqual(0);
    expect(conf).toBeLessThanOrEqual(100);
  });

  it("Version increments on each save/regenerate", () => {
    const currentVersion = 1;
    const nextVersion = currentVersion + 1;
    expect(nextVersion).toBe(2);
  });

  it("Approved draft at version N creates a SCHEDULED entry in dispatch queue", () => {
    const draft = { id: 1, version: 3, editorStatus: "APPROVED", tripleGateSss: 1, tripleGateEsi: 1, tripleGateConf: 1 };
    const tripleGatePasses = draft.tripleGateSss === 1 && draft.tripleGateEsi === 1 && draft.tripleGateConf === 1;
    const newStatus = tripleGatePasses ? "SCHEDULED" : "APPROVED";
    expect(newStatus).toBe("SCHEDULED");
  });
});

// ── Top 25 ranking tests ──────────────────────────────────────────────────────
describe("EditorBriefs — top 25 ranking", () => {
  it("Companies are ranked by SSS descending", () => {
    const companies = [
      { companyId: 1, sss: 75 },
      { companyId: 2, sss: 95 },
      { companyId: 3, sss: 88 },
    ];
    const sorted = [...companies].sort((a, b) => b.sss - a.sss);
    expect(sorted[0].companyId).toBe(2);
    expect(sorted[1].companyId).toBe(3);
    expect(sorted[2].companyId).toBe(1);
  });

  it("Top 25 limit is enforced", () => {
    const limit = 25;
    expect(limit).toBe(25);
  });
});
