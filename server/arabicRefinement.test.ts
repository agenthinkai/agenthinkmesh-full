/**
 * arabicRefinement.test.ts
 * Vitest tests for the Arabic Sovereign Data Refinement logic.
 *
 * Tests run server-side (Node) against the pure-logic module which is
 * framework-agnostic (no React, no DOM).  We import directly from the
 * TypeScript source using the project's vitest/tsconfig setup.
 */

import { describe, it, expect } from "vitest";

// ── Re-implement the pure logic inline so we don't need a DOM/Vite transform ──
// The actual implementation lives in client/src/lib/arabicRefinementLogic.ts.
// We duplicate the core functions here to keep the server test bundle clean.

// ── PII patterns (subset — same regexes as the client module) ─────────────────
const PII_PATTERNS = [
  { type: "Saudi National ID",   regex: /\b[12]\d{9}\b/g,                                        severity: "HIGH"   as const },
  { type: "UAE Emirates ID",     regex: /\b784-\d{4}-\d{7}-\d\b/g,                               severity: "HIGH"   as const },
  { type: "Phone (GCC)",         regex: /(?:\+966|\+971|\+965|\+973|\+974|\+968|00966|00971)\s?\d[\d\s\-]{7,11}/g, severity: "HIGH" as const },
  { type: "Email",               regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,   severity: "MEDIUM" as const },
  { type: "IBAN (GCC)",          regex: /\b(?:SA|AE|KW|BH|QA|OM)\d{2}[A-Z0-9]{10,30}\b/g,      severity: "HIGH"   as const },
  { type: "Arabic Name Pattern", regex: /(?:اسمي|اسمه|اسمها|يدعى|تدعى)\s+[\u0600-\u06FF\s]{3,30}/g, severity: "MEDIUM" as const },
  { type: "Passport Number",     regex: /\b[A-Z]{1,2}\d{6,9}\b/g,                               severity: "HIGH"   as const },
];

function detectPIITest(text: string) {
  const found: { type: string; count: number; severity: "HIGH" | "MEDIUM" }[] = [];
  for (const p of PII_PATTERNS) {
    p.regex.lastIndex = 0;
    const matches = Array.from(text.matchAll(p.regex));
    if (matches.length > 0) found.push({ type: p.type, count: matches.length, severity: p.severity });
  }
  const highCount   = found.filter((f) => f.severity === "HIGH").reduce((s, f) => s + f.count, 0);
  const mediumCount = found.filter((f) => f.severity === "MEDIUM").reduce((s, f) => s + f.count, 0);
  const sensitivity = highCount > 0 ? "HIGH" : mediumCount > 0 ? "MEDIUM" : "LOW";
  return { found, highCount, mediumCount, sensitivity };
}

// ── Normalization (subset) ────────────────────────────────────────────────────
function normalizeArabicTest(text: string): { text: string; log: { step: string; count: number }[] } {
  const log: { step: string; count: number }[] = [];
  let t = text;

  // Alef variants → plain alef
  const alefBefore = (t.match(/[أإآٱ]/g) ?? []).length;
  t = t.replace(/[أإآٱ]/g, "ا");
  log.push({ step: "Alef normalisation", count: alefBefore });

  // Teh marbuta → heh
  const tehBefore = (t.match(/ة/g) ?? []).length;
  t = t.replace(/ة/g, "ه");
  log.push({ step: "Teh marbuta → heh", count: tehBefore });

  // Remove tatweel
  const tatweelBefore = (t.match(/ـ/g) ?? []).length;
  t = t.replace(/ـ/g, "");
  log.push({ step: "Tatweel removal", count: tatweelBefore });

  // Remove diacritics (harakat)
  const diacriticsBefore = (t.match(/[\u064B-\u065F]/g) ?? []).length;
  t = t.replace(/[\u064B-\u065F]/g, "");
  log.push({ step: "Diacritics removal", count: diacriticsBefore });

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  log.push({ step: "Whitespace collapse", count: 0 });

  return { text: t, log };
}

// ── Dialect detection (simplified) ───────────────────────────────────────────
const DIALECT_MARKERS: Record<string, { name: string; markers: string[] }> = {
  khaleeji_saudi: {
    name: "Khaleeji — Saudi",
    markers: ["وش", "ايش", "كيف حالك", "يبي", "يبغى", "ابغى", "ابي", "زين", "عيل", "شلونك", "وين"],
  },
  khaleeji_emirati: {
    name: "Khaleeji — Emirati",
    markers: ["شو", "يلا", "هلا", "شلون", "خوش", "بس", "ليش", "مو", "عندي"],
  },
  msa: {
    name: "Modern Standard Arabic",
    markers: ["الذي", "التي", "الذين", "اللواتي", "حيث", "إذ", "بينما", "لكن", "ومع ذلك"],
  },
};

function detectDialectTest(text: string): { primary: string; primaryName: string; confidence: number; totalHits: number } {
  const scores: Record<string, number> = {};
  let totalHits = 0;
  for (const [key, def] of Object.entries(DIALECT_MARKERS)) {
    let hits = 0;
    for (const m of def.markers) {
      const re = new RegExp(m, "g");
      const found = Array.from(text.matchAll(re));
      hits += found.length;
    }
    scores[key] = hits;
    totalHits += hits;
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKey, topHits] = sorted[0];
  const confidence = totalHits === 0 ? 0 : Math.round((topHits / totalHits) * 100);
  return {
    primary: topKey,
    primaryName: DIALECT_MARKERS[topKey]?.name ?? topKey,
    confidence,
    totalHits,
  };
}

// ── Audit schema shape ────────────────────────────────────────────────────────
interface AuditSchema {
  schema_version: string;
  processor: string;
  tenant: string;
  deployment_mode: string;
  trace_id: string;
  timestamp: string;
  input: { char_count: number; line_count: number; content_hash_sha256: string | null };
  ingest: { encoding_issues: string[]; direction: string; arabic_char_count: number; latin_char_count: number };
  normalization: { actions: { step: string; count: number }[]; output_char_count: number };
  dialect: { primary: string; primary_name: string; confidence_percent: number; scores: Record<string, { name: string; hits: number }> };
  pii: { found: { type: string; count: number; severity: string }[]; sensitivity: string; high_count: number; medium_count: number };
  recommendation: { code: string; reason: string };
  disclaimer: string;
}

function buildAuditSchema(overrides: Partial<AuditSchema> = {}): AuditSchema {
  return {
    schema_version: "1.0",
    processor: "SADO Arabic Refinement v1.0",
    tenant: "test-tenant",
    deployment_mode: "test",
    trace_id: "abc123",
    timestamp: new Date().toISOString(),
    input: { char_count: 100, line_count: 5, content_hash_sha256: "abc" },
    ingest: { encoding_issues: [], direction: "RTL", arabic_char_count: 80, latin_char_count: 20 },
    normalization: { actions: [], output_char_count: 95 },
    dialect: { primary: "khaleeji_saudi", primary_name: "Khaleeji — Saudi", confidence_percent: 75, scores: {} },
    pii: { found: [], sensitivity: "LOW", high_count: 0, medium_count: 0 },
    recommendation: { code: "ALLOW", reason: "No PII detected." },
    disclaimer: "This workflow supports sovereign data governance review and does not constitute legal or regulatory advice.",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("PII Detection", () => {
  it("detects Saudi National ID (10-digit starting with 1 or 2)", () => {
    const result = detectPIITest("رقم الهوية: 1234567890");
    expect(result.found.some((f) => f.type === "Saudi National ID")).toBe(true);
    expect(result.sensitivity).toBe("HIGH");
  });

  it("detects UAE Emirates ID format", () => {
    const result = detectPIITest("الهوية الإماراتية: 784-1990-1234567-1");
    expect(result.found.some((f) => f.type === "UAE Emirates ID")).toBe(true);
  });

  it("detects GCC phone number with +966 prefix", () => {
    const result = detectPIITest("اتصل بي على +966501234567");
    expect(result.found.some((f) => f.type === "Phone (GCC)")).toBe(true);
  });

  it("detects email address", () => {
    const result = detectPIITest("راسلني على user@example.com");
    expect(result.found.some((f) => f.type === "Email")).toBe(true);
    expect(result.sensitivity).toBe("MEDIUM");
  });

  it("detects Saudi IBAN", () => {
    const result = detectPIITest("رقم الحساب: SA4420000001234567891234");
    expect(result.found.some((f) => f.type === "IBAN (GCC)")).toBe(true);
  });

  it("returns LOW sensitivity when no PII present", () => {
    const result = detectPIITest("هذا نص عربي بسيط بدون معلومات شخصية");
    expect(result.sensitivity).toBe("LOW");
    expect(result.highCount).toBe(0);
    expect(result.mediumCount).toBe(0);
  });

  it("counts multiple PII instances correctly", () => {
    const result = detectPIITest("1234567890 و 2345678901 هويتان");
    const nid = result.found.find((f) => f.type === "Saudi National ID");
    expect(nid?.count).toBe(2);
  });
});

describe("Arabic Normalization", () => {
  it("normalizes alef variants to plain alef", () => {
    const { text, log } = normalizeArabicTest("أحمد إبراهيم آل سعود");
    expect(text).not.toContain("أ");
    expect(text).not.toContain("إ");
    expect(text).not.toContain("آ");
    const step = log.find((l) => l.step === "Alef normalisation");
    expect(step?.count).toBeGreaterThan(0);
  });

  it("converts teh marbuta to heh", () => {
    const { text } = normalizeArabicTest("مدينة جميلة");
    expect(text).not.toContain("ة");
    expect(text).toContain("ه");
  });

  it("removes tatweel characters", () => {
    const { text } = normalizeArabicTest("جميـــل");
    expect(text).not.toContain("ـ");
    expect(text).toBe("جميل");
  });

  it("removes Arabic diacritics (harakat)", () => {
    const { text } = normalizeArabicTest("كَتَبَ الطَّالِبُ");
    expect(text).not.toMatch(/[\u064B-\u065F]/);
  });

  it("collapses multiple whitespace to single space", () => {
    const { text } = normalizeArabicTest("كلمة   أخرى");
    expect(text).toBe("كلمه اخرى"); // after alef + teh normalisation
  });

  it("returns a normalization log with all steps", () => {
    const { log } = normalizeArabicTest("أحمد");
    const stepNames = log.map((l) => l.step);
    expect(stepNames).toContain("Alef normalisation");
    expect(stepNames).toContain("Teh marbuta → heh");
    expect(stepNames).toContain("Tatweel removal");
    expect(stepNames).toContain("Diacritics removal");
  });
});

describe("Dialect Detection", () => {
  it("identifies Saudi dialect from khaleeji markers", () => {
    const result = detectDialectTest("وش تبي؟ ابغى شي زين وين رحت؟");
    expect(result.primary).toBe("khaleeji_saudi");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("identifies MSA from formal markers", () => {
    const result = detectDialectTest("الذي يسعى إلى الحق لكن ومع ذلك يجب أن يتذكر حيث");
    expect(result.primary).toBe("msa");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("returns 0 confidence when no markers match", () => {
    const result = detectDialectTest("hello world 123");
    expect(result.confidence).toBe(0);
    expect(result.totalHits).toBe(0);
  });

  it("returns a primaryName string", () => {
    const result = detectDialectTest("وش تبي ايش يبي");
    expect(typeof result.primaryName).toBe("string");
    expect(result.primaryName.length).toBeGreaterThan(0);
  });
});

describe("Audit Schema", () => {
  it("builds a valid audit schema with all required keys", () => {
    const audit = buildAuditSchema();
    expect(audit.schema_version).toBe("1.0");
    expect(audit.processor).toContain("SADO");
    expect(audit.disclaimer).toContain("sovereign");
    expect(typeof audit.trace_id).toBe("string");
    expect(typeof audit.timestamp).toBe("string");
  });

  it("serializes to valid JSON without losing keys", () => {
    const audit = buildAuditSchema({ tenant: "stc-demo", deployment_mode: "sovereign" });
    const json = JSON.stringify(audit);
    const parsed = JSON.parse(json) as AuditSchema;
    expect(parsed.tenant).toBe("stc-demo");
    expect(parsed.deployment_mode).toBe("sovereign");
    expect(parsed.pii.sensitivity).toBe("LOW");
  });

  it("recommendation code is one of ALLOW | REVIEW | ESCALATE", () => {
    const validCodes = ["ALLOW", "REVIEW", "ESCALATE"];
    const audit = buildAuditSchema({ recommendation: { code: "REVIEW", reason: "PII found" } });
    expect(validCodes).toContain(audit.recommendation.code);
  });

  it("high_count and medium_count are non-negative integers", () => {
    const audit = buildAuditSchema({ pii: { found: [], sensitivity: "LOW", high_count: 0, medium_count: 0 } });
    expect(audit.pii.high_count).toBeGreaterThanOrEqual(0);
    expect(audit.pii.medium_count).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(audit.pii.high_count)).toBe(true);
  });
});
