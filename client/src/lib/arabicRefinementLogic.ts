/**
 * arabicRefinementLogic.ts
 * Pure processing functions for the SADO Arabic Data Refinement pipeline.
 * All logic runs client-side; no network calls are made here.
 */

import type {
  DialectMarkerConfig,
  DialectResult,
  DialectScoreMap,
  IngestResult,
  NormalizationResult,
  PIIPatternConfig,
  PIIResult,
  PIIMatch,
  PIISeverity,
  RecommendationCode,
  RecommendationObject,
} from './arabicRefinementTypes';

// ─── Dialect marker config ────────────────────────────────────────────────────

export const DIALECT_MARKERS: DialectMarkerConfig = {
  khaleeji_saudi: {
    name: 'Saudi (Najdi / Hijazi)',
    markers: [
      'ابغى', 'أبغى', 'ابي', 'أبي', 'زين', 'الحين', 'وش', 'ايش', 'شلون',
      'يبا', 'تبي', 'خلاص', 'كذا', 'ياخوي', 'عاد', 'يالغالي', 'احس', 'مرة',
      'بعدين', 'طيب يا', 'والله',
    ],
  },
  khaleeji_emirati: {
    name: 'Emirati',
    markers: [
      'شو', 'وايد', 'بزر', 'يهال', 'عيال', 'شخبارك', 'جذي', 'هاي',
      'احين', 'يبه', 'زود', 'هلا والله',
    ],
  },
  khaleeji_kuwaiti: {
    name: 'Kuwaiti',
    markers: ['شنو', 'شلونك', 'خوش', 'راعي', 'يا حلو', 'هلا حبيبي', 'هيه'],
  },
  khaleeji_generic: {
    name: 'Khaleeji (generic)',
    markers: [
      'يالله', 'الله يعافيك', 'الله يخليك', 'يخوي', 'يا غالي',
      'الله يطول', 'تكفى', 'الله يوفقك',
    ],
  },
  msa: {
    name: 'Modern Standard Arabic',
    markers: [
      'الذي', 'التي', 'كما', 'لقد', 'إنه', 'لكن', 'بل', 'سوف', 'كذلك',
      'علاوة', 'حيث', 'يرجى', 'تفضلوا', 'نحيطكم', 'بناءً', 'استناداً',
      'فيما يخص', 'وفقاً',
    ],
  },
};

// ─── PII pattern config ───────────────────────────────────────────────────────

export const PII_PATTERNS: PIIPatternConfig[] = [
  { type: 'Saudi mobile',      regex: /(?:\+?966|00966)?[\s-]?5\d{8}\b/g,                                                severity: 'HIGH',   tier: 'identifier' },
  { type: 'UAE mobile',        regex: /(?:\+?971|00971)?[\s-]?5[024568]\d{7}\b/g,                                        severity: 'HIGH',   tier: 'identifier' },
  { type: 'Kuwait mobile',     regex: /(?:\+?965|00965)[\s-]?[569]\d{7}\b/g,                                             severity: 'HIGH',   tier: 'identifier' },
  { type: 'Saudi national ID', regex: /\b[12]\d{9}\b/g,                                                                  severity: 'HIGH',   tier: 'government-id' },
  { type: 'Emirates ID',       regex: /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g,                                         severity: 'HIGH',   tier: 'government-id' },
  { type: 'GCC IBAN',          regex: /\b(?:SA\d{22}|AE\d{21}|KW\d{28}|BH\d{20}|QA\d{27}|OM\d{21})\b/g,                severity: 'HIGH',   tier: 'financial' },
  { type: 'Email address',     regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,                                severity: 'MEDIUM', tier: 'contact' },
  { type: 'Arabic name marker',regex: /(?:أبو|ابو|عبد\s?ال|بن|بنت)\s*[\u0621-\u064A]{2,}/g,                             severity: 'MEDIUM', tier: 'identity' },
];

// ─── Sample input ─────────────────────────────────────────────────────────────

export const SAMPLE_INPUT = `السلام عليكم، أنا محمد بن عبدالله، رقمي ٠٥٥١٢٣٤٥٦٧ والإيميل m.abdullah@stc.example.sa

والله يا أخوي الحين عندي مشكلة وايد كبيرة مع الخط، وش السالفة؟ شلون أحدث بياناتي؟ بطاقتي 1051234567 وأبغى أغير العنوان. بعد الحين بدت من ٣ أيام ولين الحين ما تحلت.

I called yesterday and the agent said it would be fixed but nothing happened.

محتاج المساعدة بأسرع وقت، الحساب على اسم والدي عبد الرحمن السعدي، رقمه 0507778899
الايبان للتحويل SA4420000001234567891234`;

// ─── Encoding detection ───────────────────────────────────────────────────────

export function detectEncodingIssues(text: string): IngestResult {
  const issues: string[] = [];
  if (text.charCodeAt(0) === 0xFEFF) issues.push('BOM detected at start of input');
  const zw = (text.match(/[\u200B-\u200F\u202A-\u202E]/g) ?? []).length;
  if (zw > 0) issues.push(`${zw} zero-width / bidi marker(s) present`);
  if (/\uFFFD/.test(text)) issues.push('Replacement characters (U+FFFD) — likely encoding error');
  const tat = (text.match(/\u0640/g) ?? []).length;
  if (tat > 0) issues.push(`${tat} tatweel (kashida) character(s)`);
  const diac = (text.match(/[\u064B-\u0652\u0670]/g) ?? []).length;
  if (diac > 0) issues.push(`${diac} diacritic mark(s) (tashkeel)`);
  const indic = (text.match(/[\u0660-\u0669\u06F0-\u06F9]/g) ?? []).length;
  if (indic > 0) issues.push(`${indic} Arabic-Indic digit(s) — consider folding for downstream tools`);

  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) ?? []).length;
  const total = arabicChars + latinChars;
  let direction: IngestResult['direction'] = 'unknown';
  if (total > 0) {
    const arRatio = arabicChars / total;
    if (arRatio > 0.7) direction = 'RTL-dominant';
    else if (arRatio < 0.3) direction = 'LTR-dominant';
    else direction = 'mixed bidi';
  }

  return { issues, direction, arabicChars, latinChars, charCount: text.length, lineCount: text.split('\n').length };
}

// ─── Arabic normalization ─────────────────────────────────────────────────────

export function normalizeArabic(text: string): NormalizationResult {
  const log: NormalizationResult['log'] = [];
  let result = text;

  if (result.charCodeAt(0) === 0xFEFF) {
    result = result.slice(1);
    log.push({ step: 'Stripped BOM marker', count: 1 });
  }
  const zwCount = (result.match(/[\u200B-\u200F\u202A-\u202E]/g) ?? []).length;
  if (zwCount > 0) {
    result = result.replace(/[\u200B-\u200F\u202A-\u202E]/g, '');
    log.push({ step: 'Removed zero-width / bidi markers', count: zwCount });
  }
  const tatCount = (result.match(/\u0640/g) ?? []).length;
  if (tatCount > 0) {
    result = result.replace(/\u0640/g, '');
    log.push({ step: 'Removed tatweel characters', count: tatCount });
  }
  const diacCount = (result.match(/[\u064B-\u0652\u0670]/g) ?? []).length;
  if (diacCount > 0) {
    result = result.replace(/[\u064B-\u0652\u0670]/g, '');
    log.push({ step: 'Removed diacritical marks', count: diacCount });
  }
  const alefCount = (result.match(/[أإآٱ]/g) ?? []).length;
  if (alefCount > 0) {
    result = result.replace(/[أإآٱ]/g, 'ا');
    log.push({ step: 'Folded alef variants to ا', count: alefCount });
  }
  const indicCount = (result.match(/[\u0660-\u0669\u06F0-\u06F9]/g) ?? []).length;
  if (indicCount > 0) {
    result = result.replace(/[\u0660-\u0669]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 0x30));
    result = result.replace(/[\u06F0-\u06F9]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x06F0 + 0x30));
    log.push({ step: 'Folded Arabic-Indic digits to ASCII', count: indicCount });
  }
  const replCount = (result.match(/\uFFFD/g) ?? []).length;
  if (replCount > 0) {
    result = result.replace(/\uFFFD/g, '');
    log.push({ step: 'Removed replacement characters', count: replCount });
  }
  const before = result.length;
  result = result.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (before !== result.length) {
    log.push({ step: 'Collapsed redundant whitespace', count: before - result.length });
  }

  if (log.length === 0) log.push({ step: 'Input already normalized — no changes applied', count: 0 });
  return { text: result, log };
}

// ─── Dialect detection ────────────────────────────────────────────────────────

export function detectDialect(text: string): DialectResult {
  const scores: DialectScoreMap = {};
  let totalHits = 0;
  for (const [key, def] of Object.entries(DIALECT_MARKERS)) {
    let count = 0;
    const found: Array<{ marker: string; hits: number }> = [];
    for (const marker of def.markers) {
      const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^\\u0621-\\u064A])${escaped}(?:$|[^\\u0621-\\u064A])`, 'g');
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
        found.push({ marker, hits: matches.length });
      }
    }
    scores[key] = { name: def.name, hits: count, found };
    totalHits += count;
  }
  let primary = 'unclassified';
  let primaryName = 'Unclassified — insufficient lexical signal';
  let confidence = 0;
  if (totalHits > 0) {
    const sorted = Object.entries(scores).sort((a, b) => b[1].hits - a[1].hits);
    if (sorted[0][1].hits > 0) {
      primary = sorted[0][0];
      primaryName = sorted[0][1].name;
      const top = sorted[0][1].hits;
      const second = sorted[1] ? sorted[1][1].hits : 0;
      const margin = top - second;
      confidence = Math.min(94, Math.round(((top / totalHits) * 70) + (margin / Math.max(top, 1)) * 25));
    }
  }
  return { primary, primaryName, confidence, scores, totalHits };
}

// ─── PII detection ────────────────────────────────────────────────────────────

export function maskPII(value: string): string {
  if (value.length <= 4) return '•'.repeat(value.length);
  return value.slice(0, 2) + '•'.repeat(Math.min(value.length - 4, 8)) + value.slice(-2);
}

export function detectPII(text: string): PIIResult {
  const found: PIIMatch[] = [];
  let high = 0, medium = 0;
  for (const pattern of PII_PATTERNS) {
    pattern.regex.lastIndex = 0;
    const matches = Array.from(text.matchAll(pattern.regex));
    if (matches.length > 0) {
      found.push({
        type: pattern.type,
        count: matches.length,
        severity: pattern.severity,
        tier: pattern.tier,
        examples: matches.slice(0, 3).map((m) => maskPII(m[0])),
      });
      if (pattern.severity === 'HIGH') high += matches.length;
      else if (pattern.severity === 'MEDIUM') medium += matches.length;
    }
  }
  let sensitivity: PIISeverity = 'LOW';
  if (high > 0) sensitivity = 'HIGH';
  else if (medium > 0) sensitivity = 'MEDIUM';
  return { found, sensitivity, highCount: high, mediumCount: medium };
}

// ─── PII redaction ────────────────────────────────────────────────────────────

export function redactPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    pattern.regex.lastIndex = 0;
    result = result.replace(pattern.regex, () => `[${pattern.type.toUpperCase().replace(/\s/g, '_')}]`);
  }
  return result;
}

// ─── Governance recommendation ────────────────────────────────────────────────

export function determineRecommendation(
  sensitivity: PIISeverity,
  dialectConfidence: number,
  encodingIssueCount: number,
): RecommendationObject {
  if (sensitivity === 'HIGH') {
    return { code: 'ESCALATE' as RecommendationCode, reason: 'High-severity PII detected — route to data protection officer before downstream use.' };
  }
  if (sensitivity === 'MEDIUM' || encodingIssueCount > 3) {
    return { code: 'REVIEW' as RecommendationCode, reason: 'Medium-severity content or significant encoding artifacts — human review recommended.' };
  }
  if (dialectConfidence < 40) {
    return { code: 'REVIEW' as RecommendationCode, reason: 'Low dialect confidence — verify language tagging before training/RAG ingestion.' };
  }
  return { code: 'ALLOW' as RecommendationCode, reason: 'No high-severity findings — eligible for downstream processing within tenant policy.' };
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

export async function hashSHA256(text: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) { h = (h << 5) - h + text.charCodeAt(i); h |= 0; }
    return 'fallback_' + Math.abs(h).toString(16);
  }
}

export function makeTraceId(): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(r).map((b) => b.toString(16).padStart(2, '0')).join('');
}
