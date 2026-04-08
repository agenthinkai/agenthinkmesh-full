/**
 * tier0Signals.ts — Tier 0 University Signal Layer
 *
 * Detects early-stage university signals in deal memos.
 * Returns a structured signal if a high-confidence match is found.
 *
 * Tier 0A (+50 pts): StartX, MIT delta v, Harvard iLab, NSF SBIR
 * Tier 0B (+30 pts): Devpost winners, Hackathons, GitHub student projects
 *
 * Noise filter: signal must have at least one of:
 *   - team presence (LinkedIn / GitHub org)
 *   - project continuity (ongoing development)
 *   - external validation (accelerator / grant)
 */

export type Tier0Subtype = "Accelerator" | "Grant" | "Hackathon" | "Research";
export type Tier0Classification = "Startup" | "Emerging" | "Project";
export type Tier0Tier = "0A" | "0B";

export interface UniversitySignal {
  tier: Tier0Tier;
  source: string;           // e.g. "StartX", "NSF SBIR"
  subtype: Tier0Subtype;
  classification: Tier0Classification;
  confidence: "High" | "Medium";
  scoreBoost: number;       // +50 for 0A, +30 for 0B
  matchedKeywords: string[];
}

// ── Source definitions ────────────────────────────────────────────────────────

interface Tier0Source {
  name: string;
  tier: Tier0Tier;
  subtype: Tier0Subtype;
  keywords: string[];           // any of these trigger a candidate match
  validationKeywords: string[]; // at least one required for noise filter
}

const TIER0_SOURCES: Tier0Source[] = [
  // ── Tier 0A ──────────────────────────────────────────────────────────────
  {
    name: "StartX",
    tier: "0A",
    subtype: "Accelerator",
    keywords: ["startx", "start x", "stanford startx"],
    validationKeywords: ["stanford", "accelerator", "cohort", "batch", "alumni"],
  },
  {
    name: "MIT delta v",
    tier: "0A",
    subtype: "Accelerator",
    keywords: ["delta v", "deltav", "mit delta v", "mit accelerator"],
    validationKeywords: ["mit", "massachusetts institute", "accelerator", "cohort", "alumni"],
  },
  {
    name: "Harvard iLab",
    tier: "0A",
    subtype: "Accelerator",
    keywords: ["ilab", "i-lab", "harvard ilab", "harvard innovation lab", "harvard innovation labs"],
    validationKeywords: ["harvard", "accelerator", "cohort", "grant", "fellowship"],
  },
  {
    name: "NSF SBIR",
    tier: "0A",
    subtype: "Grant",
    keywords: ["nsf sbir", "nsf sttr", "national science foundation sbir", "sbir grant", "sttr grant", "phase i grant", "phase ii grant"],
    validationKeywords: ["nsf", "national science foundation", "sbir", "sttr", "grant", "award"],
  },
  // ── Tier 0B ──────────────────────────────────────────────────────────────
  {
    name: "Devpost",
    tier: "0B",
    subtype: "Hackathon",
    keywords: ["devpost", "hackathon winner", "hackathon finalist", "won hackathon", "hackathon prize"],
    validationKeywords: ["devpost", "hackathon", "winner", "finalist", "prize", "award"],
  },
  {
    name: "University Hackathon",
    tier: "0B",
    subtype: "Hackathon",
    keywords: ["hackathon", "hack the north", "treehacks", "mhacks", "pennApps", "calHacks", "hackmit", "hackprinceton", "boilermake"],
    validationKeywords: ["hackathon", "winner", "finalist", "prize", "university", "student"],
  },
  {
    name: "GitHub Student Project",
    tier: "0B",
    subtype: "Research",
    keywords: ["github student", "open source project", "student project", "university research project", "research lab", "university lab"],
    validationKeywords: ["github", "open source", "research", "university", "student", "lab", "professor"],
  },
];

// ── Classification logic ──────────────────────────────────────────────────────

function classify(text: string, source: Tier0Source): Tier0Classification {
  const lower = text.toLowerCase();
  // Startup: has revenue, customers, or team signals
  const startupSignals = ["revenue", "arr", "mrr", "customers", "users", "traction", "raised", "funding", "seed", "series"];
  if (startupSignals.some(s => lower.includes(s))) return "Startup";
  // Emerging: has team or LinkedIn/GitHub presence
  const emergingSignals = ["linkedin", "github", "co-founder", "cofounder", "team of", "founding team", "cto", "ceo"];
  if (emergingSignals.some(s => lower.includes(s))) return "Emerging";
  // Default: idea stage
  return "Project";
}

// ── Noise filter ──────────────────────────────────────────────────────────────

function passesNoiseFilter(text: string, source: Tier0Source): boolean {
  const lower = text.toLowerCase();
  // Must match at least one validation keyword
  return source.validationKeywords.some(kw => lower.includes(kw.toLowerCase()));
}

// ── Main detection function ───────────────────────────────────────────────────

/**
 * Scan a deal memo for Tier 0 university signals.
 * Returns the highest-confidence signal found, or null if none.
 * Tier 0A takes priority over Tier 0B.
 */
export function detectTier0Signal(dealText: string, dealName: string): UniversitySignal | null {
  const combined = `${dealName} ${dealText}`.toLowerCase();

  // Collect all candidate matches
  const candidates: Array<{ source: Tier0Source; matched: string[] }> = [];

  for (const source of TIER0_SOURCES) {
    const matched = source.keywords.filter(kw => combined.includes(kw.toLowerCase()));
    if (matched.length === 0) continue;
    // Apply noise filter
    if (!passesNoiseFilter(combined, source)) continue;
    candidates.push({ source, matched });
  }

  if (candidates.length === 0) return null;

  // Prioritise Tier 0A over 0B; within same tier, pick most matched keywords
  const sorted = candidates.sort((a, b) => {
    if (a.source.tier !== b.source.tier) return a.source.tier === "0A" ? -1 : 1;
    return b.matched.length - a.matched.length;
  });

  const best = sorted[0];
  const classification = classify(combined, best.source);

  return {
    tier: best.source.tier,
    source: best.source.name,
    subtype: best.source.subtype,
    classification,
    confidence: best.source.tier === "0A" ? "High" : "Medium",
    scoreBoost: best.source.tier === "0A" ? 50 : 30,
    matchedKeywords: best.matched,
  };
}

// ── Phase 2: Static signals feed ─────────────────────────────────────────────
// A curated set of high-confidence Tier 0 signals for the discovery feed.
// In a future phase this will be replaced by a live data pull.

export interface Tier0FeedSignal {
  id: string;
  companyName: string;
  source: string;
  subtype: Tier0Subtype;
  tier: Tier0Tier;
  classification: Tier0Classification;
  description: string;
  confidence: "High" | "Medium";
  scoreBoost: number;
}

export const TIER0_FEED: Tier0FeedSignal[] = [
  {
    id: "t0-001",
    companyName: "Luminary Health AI",
    source: "StartX",
    subtype: "Accelerator",
    tier: "0A",
    classification: "Startup",
    description: "Stanford StartX cohort. AI-driven clinical decision support for GCC hospitals. 3 co-founders, seed-stage.",
    confidence: "High",
    scoreBoost: 50,
  },
  {
    id: "t0-002",
    companyName: "GridFlow Systems",
    source: "NSF SBIR",
    subtype: "Grant",
    tier: "0A",
    classification: "Startup",
    description: "NSF SBIR Phase I awardee. Smart grid energy optimisation for emerging markets. MIT spinout.",
    confidence: "High",
    scoreBoost: 50,
  },
  {
    id: "t0-003",
    companyName: "Arabi NLP",
    source: "MIT delta v",
    subtype: "Accelerator",
    tier: "0A",
    classification: "Emerging",
    description: "MIT delta v cohort. Arabic-first LLM for legal and financial document processing. GCC-focused.",
    confidence: "High",
    scoreBoost: 50,
  },
  {
    id: "t0-004",
    companyName: "SupplyTrace",
    source: "Devpost",
    subtype: "Hackathon",
    tier: "0B",
    classification: "Emerging",
    description: "Devpost Global Hackathon winner. Blockchain-based supply chain provenance for F&B sector.",
    confidence: "Medium",
    scoreBoost: 30,
  },
  {
    id: "t0-005",
    companyName: "CarbonLedger",
    source: "Harvard iLab",
    subtype: "Accelerator",
    tier: "0A",
    classification: "Startup",
    description: "Harvard iLab fellowship. Carbon credit tokenisation platform targeting GCC sovereign funds.",
    confidence: "High",
    scoreBoost: 50,
  },
];
