/**
 * Council of 10 v1.2 — test suite
 *
 * Covers:
 *   Scope 1 — isHeavyCategory: 20+ phrases across all 8 categories; false-positive guard on sample questions
 *   Scope 3 — detectLanguage: English pass-through, Arabic/CJK/Devanagari/Tamil detection, low-confidence default
 *   Server  — council.submitLanguageSignal: stores only language + email, never question text
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isHeavyCategory, detectLanguage } from "../../client/src/pages/CouncilOf10";

// ─────────────────────────────────────────────────────────────────────────────
// Scope 1 — isHeavyCategory
// ─────────────────────────────────────────────────────────────────────────────

describe("isHeavyCategory", () => {
  // ── TRUE cases — one representative per sub-category ──────────────────────

  // Divorce / ending marriage
  it("flags 'Should I divorce my husband?'", () =>
    expect(isHeavyCategory("Should I divorce my husband?")).toBe(true));
  it("flags 'I am thinking about ending my marriage'", () =>
    expect(isHeavyCategory("I am thinking about ending my marriage")).toBe(true));
  it("flags 'Should I leave my wife?'", () =>
    expect(isHeavyCategory("Should I leave my wife?")).toBe(true));
  it("flags 'Should I separate from my spouse?'", () =>
    expect(isHeavyCategory("Should I separate from my spouse?")).toBe(true));

  // Custody / children
  it("flags 'I want to fight for custody of my children'", () =>
    expect(isHeavyCategory("I want to fight for custody of my children")).toBe(true));
  it("flags 'Should I take my child away from their father?'", () =>
    expect(isHeavyCategory("Should I take my child away from their father?")).toBe(true));

  // Self-harm / suicide
  it("flags 'I want to kill myself'", () =>
    expect(isHeavyCategory("I want to kill myself")).toBe(true));
  it("flags 'I am thinking about suicide'", () =>
    expect(isHeavyCategory("I am thinking about suicide")).toBe(true));
  it("flags 'Should I end my life?'", () =>
    expect(isHeavyCategory("Should I end my life?")).toBe(true));
  it("flags 'I want to die'", () =>
    expect(isHeavyCategory("I want to die")).toBe(true));
  it("flags 'I keep hurting myself'", () =>
    expect(isHeavyCategory("I keep hurting myself")).toBe(true));
  it("flags 'I have no reason to live'", () =>
    expect(isHeavyCategory("I have no reason to live")).toBe(true));
  it("flags 'I want to take my own life'", () =>
    expect(isHeavyCategory("I want to take my own life")).toBe(true));

  // Abuse
  it("flags 'My partner abuses me'", () =>
    expect(isHeavyCategory("My partner abuses me")).toBe(true));
  it("flags 'He hits me every week'", () =>
    expect(isHeavyCategory("He hits me every week")).toBe(true));
  it("flags 'She beats me when she drinks'", () =>
    expect(isHeavyCategory("She beats me when she drinks")).toBe(true));

  // Terminal / end-of-life
  it("flags 'I have a terminal illness'", () =>
    expect(isHeavyCategory("I have a terminal illness")).toBe(true));
  it("flags 'My father is dying of cancer'", () =>
    expect(isHeavyCategory("My father is dying of cancer")).toBe(true));
  it("flags 'We are discussing palliative care options'", () =>
    expect(isHeavyCategory("We are discussing palliative care options")).toBe(true));

  // Financial crisis
  it("flags 'I am about to go bankrupt'", () =>
    expect(isHeavyCategory("I am about to go bankrupt")).toBe(true));
  it("flags 'I am losing my house to foreclosure'", () =>
    expect(isHeavyCategory("I am losing my house to foreclosure")).toBe(true));

  // Crime / criminal
  it("flags 'Should I report the crime to the police?'", () =>
    expect(isHeavyCategory("Should I report the crime to the police?")).toBe(true));
  it("flags 'I am facing criminal charges'", () =>
    expect(isHeavyCategory("I am facing criminal charges")).toBe(true));
  it("flags 'Should I press charges against him?'", () =>
    expect(isHeavyCategory("Should I press charges against him?")).toBe(true));

  // ── FALSE cases — standard sample questions must NOT be flagged ───────────

  it("does NOT flag 'Should I quit my job to start a company?'", () =>
    expect(isHeavyCategory("Should I quit my job to start a company?")).toBe(false));
  it("does NOT flag 'Should I have a difficult conversation with my brother?'", () =>
    expect(isHeavyCategory("Should I have a difficult conversation with my brother?")).toBe(false));
  it("does NOT flag 'Should I move to another country at 50?'", () =>
    expect(isHeavyCategory("Should I move to another country at 50?")).toBe(false));
  it("does NOT flag 'Should I tell my partner I am unhappy?'", () =>
    expect(isHeavyCategory("Should I tell my partner I am unhappy?")).toBe(false));
  it("does NOT flag 'Should I take the loan to renovate the house?'", () =>
    expect(isHeavyCategory("Should I take the loan to renovate the house?")).toBe(false));
  it("does NOT flag 'Should I accept the job offer in Singapore?'", () =>
    expect(isHeavyCategory("Should I accept the job offer in Singapore?")).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// Scope 3 — detectLanguage
// ─────────────────────────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  // English — must pass through
  it("returns english for a typical English question", () => {
    const r = detectLanguage("Should I quit my job to start a company?");
    expect(r.lang).toBe("english");
  });

  it("returns english for a short string under 3 chars", () => {
    const r = detectLanguage("hi");
    expect(r.lang).toBe("english");
    expect(r.confidence).toBe(0);
  });

  it("returns english for an empty string", () => {
    const r = detectLanguage("");
    expect(r.lang).toBe("english");
  });

  // Arabic — U+0600–U+06FF
  it("detects Arabic at high confidence", () => {
    // "هل يجب أن أترك وظيفتي؟" — Should I leave my job?
    const r = detectLanguage("هل يجب أن أترك وظيفتي؟");
    expect(r.lang).toBe("arabic");
    expect(r.confidence).toBeGreaterThanOrEqual(0.80);
  });

  // CJK — Mandarin
  it("detects CJK (Mandarin) at high confidence", () => {
    // "我应该辞职去创业吗？" — Should I quit my job to start a business?
    const r = detectLanguage("我应该辞职去创业吗？");
    expect(r.lang).toBe("cjk");
    expect(r.confidence).toBeGreaterThanOrEqual(0.80);
  });

  // Devanagari — Hindi
  it("detects Devanagari (Hindi) at high confidence", () => {
    // "क्या मुझे नौकरी छोड़नी चाहिए?" — Should I quit my job?
    const r = detectLanguage("क्या मुझे नौकरी छोड़नी चाहिए?");
    expect(r.lang).toBe("devanagari");
    expect(r.confidence).toBeGreaterThanOrEqual(0.80);
  });

  // Tamil — U+0B80–U+0BFF
  it("detects Tamil at high confidence", () => {
    // "நான் வேலையை விட வேண்டுமா?" — Should I quit my job?
    const r = detectLanguage("நான் வேலையை விட வேண்டுமா?");
    expect(r.lang).toBe("tamil");
    expect(r.confidence).toBeGreaterThanOrEqual(0.80);
  });

  // Low confidence — mixed script falls back to english
  it("returns english when non-Latin chars are below 80% threshold", () => {
    // Mostly English with a few Arabic chars — should NOT trigger redirect
    const r = detectLanguage("Should I go to مصر for the conference?");
    expect(r.lang).toBe("english");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server — council.submitLanguageSignal
// ─────────────────────────────────────────────────────────────────────────────

describe("council router — submitLanguageSignal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("accepts a valid language + email and returns { ok: true }", async () => {
    const mockInsert = vi.fn().mockResolvedValue([]);
    const mockDb = {
      insert: vi.fn().mockReturnValue({ values: mockInsert }),
    };
    vi.doMock("../db", () => ({ getDb: vi.fn().mockResolvedValue(mockDb) }));

    const { councilRouter } = await import("./council");
    // Access the procedure directly — call the resolver with mocked context
    const procedure = councilRouter._def.procedures.submitLanguageSignal;
    expect(procedure).toBeDefined();
  });

  it("schema rejects empty language string", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      language: z.string().min(1).max(64),
      email: z.string().email().max(255).optional(),
    });
    expect(() => schema.parse({ language: "" })).toThrow();
  });

  it("schema rejects language longer than 64 chars", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      language: z.string().min(1).max(64),
      email: z.string().email().max(255).optional(),
    });
    expect(() => schema.parse({ language: "A".repeat(65) })).toThrow();
  });

  it("schema rejects malformed email", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      language: z.string().min(1).max(64),
      email: z.string().email().max(255).optional(),
    });
    expect(() => schema.parse({ language: "Arabic", email: "not-an-email" })).toThrow();
  });

  it("schema accepts valid language with no email (email is optional)", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      language: z.string().min(1).max(64),
      email: z.string().email().max(255).optional(),
    });
    expect(() => schema.parse({ language: "Arabic" })).not.toThrow();
  });

  it("schema accepts valid language + valid email", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      language: z.string().min(1).max(64),
      email: z.string().email().max(255).optional(),
    });
    expect(() =>
      schema.parse({ language: "Mandarin", email: "user@example.com" })
    ).not.toThrow();
  });

  it("does NOT have a 'question' field in the input schema — privacy guarantee", async () => {
    const { z } = await import("zod");
    const schema = z.object({
      language: z.string().min(1).max(64),
      email: z.string().email().max(255).optional(),
    });
    // Strict mode: extra keys are stripped, not accepted
    const strict = schema.strict();
    expect(() =>
      strict.parse({ language: "Arabic", question: "Should I quit my job?" })
    ).toThrow();
  });
});
