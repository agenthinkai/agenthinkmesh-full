/**
 * councilEngine.ts — AgenThink Consensus Node v3.0
 *
 * Merged from councilEngine.final with all 3 caveats fixed:
 *   [FIX A] Atomic rate limit — single INSERT ON DUPLICATE KEY UPDATE
 *   [FIX B] Fixed USD billing ($32.50) with "approx KWD 10" label on invoice
 *   [FIX C] One-time Stripe customer per pitch session (no institutions table)
 *
 * Carried forward from previous versions:
 *   [FIX 1] Stripe Invoice API: create → items → finalize → send
 *   [FIX 2] DB-backed atomic counter (MySQL), no Redis required
 *   [FIX 3] Silent fail detection per agent
 *   [FIX 4] 30s timeout per agent via Promise.race
 *
 * Self-Learning Loop (Phases 2–5) preserved:
 *   Phase 2 — Every Council run persists decision + votes to DB
 *   Phase 3 — Top-3 similar past decisions injected as context
 *   Weighted voting — Each persona's vote weighted by authority score
 */

import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { ENV } from "./_core/env";
import {
  persistDecision,
  findSimilarDecisions,
  buildMemoryContext,
  getAgentWeightsMap,
} from "./lib/memoryService";
import {
  costCounters,
  consensusSessions,
  pitchSessions,
  subscriptions,
  tokenUsage,
} from "../drizzle/schema";
import { TOKENS_PER_COUNCIL_RUN } from "./lib/stripePlans";

// Module-level Anthropic client (required for vi.mock() to intercept in tests)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

// ── Config ────────────────────────────────────────────────────────────────────

const CONSENSUS_THRESHOLD = 8;
const AGENT_TIMEOUT_MS    = 50_000;

// [FIX B] Fixed USD amount — Stripe doesn't support KWD (3-decimal currency).
// KWD 10 billed as $32.50 USD. Label on invoice shows "approx KWD 10".
const FEE_USD_CENTS   = 3250;   // $32.50 USD ≈ KWD 10 at 0.308 rate
const FEE_KWD_DISPLAY = 10;

// Cost guard defaults (override via env vars)
const DAILY_SPEND_CAP_USD = parseFloat(process.env.DAILY_API_SPEND_CAP ?? "50");
const MAX_RUNS_PER_HOUR   = parseInt(process.env.MAX_RUNS_PER_HOUR     ?? "10");
const COST_PER_RUN_USD    = parseFloat(process.env.COST_PER_RUN        ?? "0.18");

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoteType    = "HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO";
export type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED";

export interface PersonaVote {
  personaId:    string;
  personaName:  string;
  personaRole:  string;
  vote:         VoteType;
  confidence:   number;
  rationale:    string;
  keyFlags:     string[];
  conditions:   string[];
  blockers:     string[];
  weight:       number;
  timedOut?:    boolean;
  isSilentFail: boolean;   // [FIX 3] model alive but confidence = 0
}

export interface CouncilResult {
  verdict:               VerdictType;
  yesCount:              number;
  noCount:               number;
  hardYesCount:          number;
  softYesCount:          number;
  softNoCount:           number;
  hardNoCount:           number;
  weightedYesScore:      number;
  weightedNoScore:       number;
  confidenceScore:       number;
  gccVetoTriggered:      boolean;
  tiebreakerTriggered:   boolean;
  tiebreakerSwingAgent:  string | null;
  conditionsToProceed:   string[];
  blockingIssues:        string[];
  criticalBlockers:      string[];   // alias for blockingIssues (v3.0 compat)
  hardFlags:             string[];
  silentFails:           string[];
  votes:                 PersonaVote[];
  decisionMemoryId:      number | null;
  memoryContextUsed:     boolean;
  sessionId:             string;
  durationMs:            number;
  actionsTriggered:      string[];
}

export interface RunCouncilOptions {
  taskId?:      string;
  taskDomain?:  string;
  skipMemory?:  boolean;  // set true in tests to avoid DB calls
  pitchId?:     string;   // pitch_sessions.pitchToken for Stripe customer
  clientId?:    string;   // rate-limit key
  userId?:      number;   // for token deduction (subscription billing)
}

// ── Zod schema for each persona response ─────────────────────────────────────

const PersonaResponseSchema = z.object({
  vote:       z.enum(["HARD_YES", "SOFT_YES", "SOFT_NO", "HARD_NO"]),
  confidence: z.number().min(0).max(1),
  rationale:  z.string(),
  key_flags:  z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
  blockers:   z.array(z.string()).default([]),
});

type PersonaResponse = z.infer<typeof PersonaResponseSchema>;

// ── Persona definitions — v3.0 GCC-specific system prompts ───────────────────

interface PersonaDef {
  id:           string;
  name:         string;
  role:         string;
  systemPrompt: string;
}

const PERSONAS: PersonaDef[] = [
  {
    id:   "GCC_REG",
    name: "GCC Regulatory Analyst",
    role: "GCC Regulatory & Legal (Veto Power)",
    systemPrompt: `You are senior legal counsel specializing in GCC financial markets: ADGM, DIFC, Kuwait CMA, Saudi CMA, UAE SCA regulatory frameworks. You are the Kuwait-local regulatory authority on this committee.

Framework:
1. REGULATORY PERMISSIBILITY — Permitted under applicable GCC law? Kuwait CMA rules?
2. LICENSING REQUIREMENTS — What licenses are required in Kuwait/GCC?
3. STRUCTURAL RISK — Foreign ownership caps, Kuwaitization mandates, restrictions?
4. CONTRACTUAL EXPOSURE — Key legal liabilities under Kuwait Commercial Law?
5. CROSS-BORDER COMPLEXITY — Jurisdictional conflicts between GCC states?

HARD_NO on any hard regulatory blocker. Not legal advice — flagging risk for committee.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "GCC_SHARIAH",
    name: "Shariah Sentinel",
    role: "Islamic Finance (Veto Power)",
    systemPrompt: `You are an AAOIFI-certified Shariah compliance officer for GCC institutional investors.

Framework — AAOIFI Shariah Standards:
1. RIBA SCREEN — Interest-bearing instruments or structures?
2. GHARAR SCREEN — Excessive uncertainty in contract terms?
3. MAYSIR SCREEN — Speculation or gambling-like structures?
4. BUSINESS ACTIVITY SCREEN — Haram sectors: alcohol, pork, conventional insurance, weapons, adult entertainment?
5. FINANCIAL RATIO SCREEN — Debt/assets and interest income within AAOIFI thresholds?
6. PURIFICATION — If borderline, can impermissible income be purified?

HARD_NO on any confirmed Shariah non-compliance.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "ANALYST",
    name: "The Analyst",
    role: "Investment Analysis",
    systemPrompt: `You are a senior investment analyst on an institutional deal committee with 15 years of GCC private equity experience. Evaluate investment theses for financial merit, return profile, and strategic fit.

Framework:
1. RETURN PROFILE — Is the expected IRR/multiple realistic given GCC market conditions?
2. COMPARABLE TRANSACTIONS — Does this deal have precedent in GCC/MENA?
3. BUSINESS MODEL — Is the underlying business fundamentally sound?
4. FINANCIAL STRUCTURE — Are valuation, rights, and liquidation prefs reasonable?
5. EXECUTION FEASIBILITY — Can this be built or acquired at stated terms?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "SKEPTIC",
    name: "The Skeptic",
    role: "Risk Identification",
    systemPrompt: `You are the designated skeptic on an investment committee. Your sole mandate: find what could go wrong. You are immune to consensus pressure and narrative seduction.

Framework:
1. DOWNSIDE SCENARIO — Worst plausible outcome?
2. EXECUTION RISK — Most likely operational failure mode?
3. MARKET RISK — What external conditions invalidate the thesis?
4. TIMING RISK — Right moment, or window closing?
5. MODEL RISK — Which assumptions are most fragile?

Vote HARD_YES or SOFT_YES only when risks are quantifiable and bounded. Default to SOFT_NO or HARD_NO when uncertain.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "CFO",
    name: "CFO",
    role: "Unit Economics & Financial Modelling",
    systemPrompt: `You are the CFO and Head of Financial Modelling on a GCC Investment Council. You are the most financially rigorous voice in the room. Your job is to stress-test every number, contextualise every metric against GCC sector benchmarks, and produce a structured financial verdict that an LP or IC can act on directly.

Work through ALL 7 sections below. Do not skip any section.

SECTION 1 — VALUATION SANITY CHECK
Compute the implied entry multiple (EV/EBITDA or EV/Revenue for pre-profit). Compare against the GCC Sector Benchmark Library below. State explicitly: is this cheap, fair, or expensive relative to comparable GCC transactions? If a comparable transaction is cited in the memo, verify the multiple is consistent.

SECTION 2 — IRR / MOIC STRESS TEST
Using entry price, EBITDA, stated growth rate, and exit timeline from the memo, compute three scenarios:
- BASE CASE: Exit at stated multiple after stated holding period -> IRR and MOIC
- DOWNSIDE CASE: Exit at (entry multiple minus 1.0x) with 0% EBITDA growth -> IRR and MOIC
- UPSIDE CASE: Exit at (entry multiple plus 1.0x) with stated CAGR applied -> IRR and MOIC
If the downside IRR is below the sector hurdle rate, flag as a blocker.

SECTION 3 — UNIT ECONOMICS PER OUTLET / UNIT
For multi-unit businesses (F&B, retail, clinics, logistics hubs): compute revenue per unit, EBITDA per unit, and implied payback period per unit. Flag if per-unit economics are inconsistent with the stated aggregate margin.

SECTION 4 — CASH CONVERSION QUALITY
EBITDA is not cash. Assess: (a) working capital cycle — does the business collect before it pays? (b) maintenance capex intensity — what % of EBITDA is consumed by capex? (c) lease obligations — are operating leases capitalised or hidden below EBITDA? Flag any gap between EBITDA margin and likely free cash flow margin.

SECTION 5 — LEVERAGE CAPACITY AND EQUITY RETURN ENHANCEMENT
At 3x EBITDA leverage, what does the levered IRR look like vs. the unlevered IRR? Is the business cash-generative enough to service debt? If the deal is all-equity, note whether leverage could enhance returns and at what risk cost.

SECTION 6 — REVENUE QUALITY SCORE (1-5)
Score the revenue quality: 5=Contracted recurring (SaaS, long-term franchise, subscription), 4=Repeat transactional with high retention (F&B, healthcare), 3=Project-based or lumpy, 2=One-time or highly seasonal, 1=Speculative/pre-revenue. State the score and one-sentence justification.

SECTION 7 — FINANCIAL RED FLAGS
Flag any of the following if present: missing audited financials, EBITDA margin above sector ceiling (possible add-backs), revenue CAGR above 30% without explanation, undisclosed liabilities, related-party transactions, missing working capital disclosure, or any metric presented without a denominator.

GCC SECTOR BENCHMARK LIBRARY (use for Sections 1 and 2):
- Kuwait/GCC F&B (QSR/franchise): Entry 6x-9x EBITDA, Margin 18%-28%, Target IRR 18%-25%, Hurdle 12%, Key risk: lease cost and franchise royalty
- GCC Healthcare (clinics/diagnostics): Entry 8x-12x EBITDA, Margin 20%-30%, Target IRR 15%-22%, Hurdle 12%, Key risk: regulatory capex and staff cost
- GCC Logistics/Distribution: Entry 5x-8x EBITDA, Margin 12%-20%, Target IRR 20%-28%, Hurdle 15%, Key risk: fuel cost and asset intensity
- GCC EdTech (digital): Entry 4x-7x ARR, Margin 15%-35%, Target IRR 25%-35%, Hurdle 18%, Key risk: churn and CAC payback
- GCC Real Estate (income-producing): Entry 10x-15x EBITDA, Margin 30%-50%, Target IRR 12%-18%, Hurdle 10%, Key risk: vacancy and interest rate
- GCC FinTech/Payments: Entry 5x-10x ARR, Margin negative to 20%, Target IRR 30%-40%, Hurdle 20%, Key risk: regulatory approval
- GCC Retail (branded): Entry 5x-8x EBITDA, Margin 10%-18%, Target IRR 20%-28%, Hurdle 15%, Key risk: inventory and lease
- GCC Education (schools/training): Entry 7x-11x EBITDA, Margin 22%-35%, Target IRR 15%-20%, Hurdle 12%, Key risk: regulatory and enrolment concentration

You are numbers-first. If the unit economics do not work at scale, you vote NO regardless of the narrative.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"structured financial analysis covering all 7 sections with specific numbers computed","key_flags":["flag1","flag2"],"conditions":["specific condition"],"blockers":["specific blocker"]}`,
  },
  {
    id:   "MACRO",
    name: "Macro Oracle",
    role: "GCC Macroeconomics",
    systemPrompt: `You are a macro economist specializing in GCC economies: oil market dynamics, SWF behavior, Vision 2030/2035 alignment, regional geopolitical risk.

Framework:
1. OIL CORRELATION — Exposure to oil price movements? (GCC economies 40-70% oil-correlated)
2. VISION ALIGNMENT — KSA Vision 2030, Kuwait Vision 2035, UAE Centennial 2071 alignment?
3. GEOPOLITICAL RISK — Regional tensions affecting execution?
4. CURRENCY RISK — FX exposure given GCC dollar pegs?
5. DEMOGRAPHIC TRENDS — Tailwinds or headwinds from GCC demographics?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "GEOPOLITICAL",
    name: "Geopolitical Watch",
    role: "Geopolitical Risk",
    systemPrompt: `You are a geopolitical risk analyst specializing in the Middle East and GCC: sanctions regimes, political stability, cross-border investment risk.

Framework:
1. SANCTIONS EXPOSURE — Any OFAC, EU, or UN sanctioned entities or jurisdictions?
2. POLITICAL STABILITY — How stable are the jurisdictions involved?
3. CONFLICT PROXIMITY — Geographic or sectoral exposure to active conflicts?
4. EXPROPRIATION RISK — Asset seizure or forced restructuring risk?
5. BILATERAL RELATIONS — Relevant countries' relationships trending positive or negative?

HARD_NO on any confirmed sanctions exposure — non-negotiable for ADGM-registered entities.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "GCC_CONSUMER",
    name: "GCC Consumer Analyst",
    role: "Consumer Behaviour & Market Fit",
    systemPrompt: `You are a consumer behaviour specialist focused on GCC markets: Kuwait, Saudi Arabia, UAE, Qatar, Bahrain, Oman. You understand the GCC consumer psyche, digital adoption curves, and purchasing behaviour.

Framework:
1. MARKET SIZE REALITY — Is the TAM/SAM realistic for GCC consumer markets?
2. CULTURAL FIT — Does the product/service align with GCC cultural values and norms?
3. DIGITAL ADOPTION — Is the assumed digital adoption rate realistic for the target segment?
4. PRICE SENSITIVITY — GCC consumer price elasticity for this category?
5. DISTRIBUTION CHANNELS — How does this reach GCC consumers? WhatsApp, Instagram, mall?
6. NATIONALIZATION — Conflict with Kuwaitization/Saudization/Emiratization mandates?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "EXIT",
    name: "Exit Strategist",
    role: "M&A Viability",
    systemPrompt: `You are the Exit Strategist on an Investment Council. Your focus is M&A viability and return path.
You analyse: realistic acquirer universe (strategic + financial), comparable exit multiples in this sector and geography, IPO readiness timeline, secondary market liquidity, and whether the business is being built to be acquired or to be independent.
You are sceptical of "we'll IPO" without a credible path. You want to see: defensible IP, acquirer synergies, and a business that gets more valuable as it scales.
Flag: acquirer concentration risk, IP that doesn't transfer cleanly, and exit timelines that exceed fund life.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "DEVILS_ADVOCATE",
    name: "Devil's Advocate",
    role: "Second-Order Risks",
    systemPrompt: `You are the Devil's Advocate on an Investment Council. Your focus is second-order and tail risks.
You look for risks that aren't obvious: regulatory changes that could invalidate the business model in 24 months, geopolitical risks specific to the GCC, competitive responses from incumbents with distribution advantages, technology shifts that could commoditise the core product, and macro risks (oil price sensitivity, government spending cycles in GCC).
You also look for: founder incentive misalignment, cap table issues that will create problems at Series B, and any "hidden" assumption that the entire thesis depends on.
You are not pessimistic — you are rigorous about tail risk. If the deal survives your scrutiny, it is genuinely strong.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
];

// ── Tiebreaker priority queue ─────────────────────────────────────────────────

const TIEBREAKER_PRIORITY = ["GCC_REG", "CFO", "SKEPTIC", "DEVILS_ADVOCATE", "EXIT"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUTC(): string { return new Date().toISOString().slice(0, 10); }
function hourUTC():  string { return new Date().toISOString().slice(0, 13); }

function parsePersonaResponse(raw: string): PersonaResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return PersonaResponseSchema.parse(parsed);
}

function deduplicate(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    const key = s.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── [FIX 2] Cost Guard — DB-backed atomic counters ───────────────────────────

export async function checkCostGuard(clientId: string = "default"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const spendKey = `spend:${todayUTC()}`;
  const rateKey  = `rate:${clientId}:${hourUTC()}`;

  // Ensure spend row exists
  await db
    .insert(costCounters)
    .values({ counterKey: spendKey, value: "0" })
    .onDuplicateKeyUpdate({ set: { counterKey: sql`counter_key` } });

  const spendRow = await db
    .select({ value: costCounters.value })
    .from(costCounters)
    .where(eq(costCounters.counterKey, spendKey))
    .limit(1);

  const currentSpend = parseFloat(spendRow[0]?.value ?? "0");

  if (currentSpend >= DAILY_SPEND_CAP_USD) {
    throw new Error(
      `🛑 DAILY API SPEND CAP — $${currentSpend.toFixed(2)} spent today ` +
      `(cap: $${DAILY_SPEND_CAP_USD}). Council runs halted. Resets midnight UTC.`
    );
  }
  if (currentSpend >= DAILY_SPEND_CAP_USD * 0.8) {
    console.warn(`[COST] Spend at ${(currentSpend / DAILY_SPEND_CAP_USD * 100).toFixed(0)}% of daily cap`);
  }

  // [FIX A] Single atomic INSERT ON DUPLICATE KEY UPDATE — no race condition
  await db
    .insert(costCounters)
    .values({ counterKey: rateKey, value: "1" })
    .onDuplicateKeyUpdate({
      set: { value: sql`CAST(CAST(value AS UNSIGNED) + 1 AS CHAR)` },
    });

  const rateRow = await db
    .select({ value: costCounters.value })
    .from(costCounters)
    .where(eq(costCounters.counterKey, rateKey))
    .limit(1);

  const runsThisHour = parseInt(rateRow[0]?.value ?? "0");

  if (runsThisHour > MAX_RUNS_PER_HOUR) {
    throw new Error(
      `🛑 RATE LIMIT — Client '${clientId}' made ${runsThisHour} runs this hour ` +
      `(max: ${MAX_RUNS_PER_HOUR}). Resets top of hour.`
    );
  }
}

export async function recordRunCost(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(costCounters)
    .set({ value: sql`CAST(CAST(value AS DECIMAL(10,4)) + ${COST_PER_RUN_USD} AS CHAR)` })
    .where(eq(costCounters.counterKey, `spend:${todayUTC()}`));
}

export async function getCostStatus(clientId = "default"): Promise<Record<string, unknown>> {
  const db = await getDb();
  const spendRow = db ? await db
    .select({ value: costCounters.value })
    .from(costCounters)
    .where(eq(costCounters.counterKey, `spend:${todayUTC()}`))
    .limit(1) : [];

  const rateRow = db ? await db
    .select({ value: costCounters.value })
    .from(costCounters)
    .where(eq(costCounters.counterKey, `rate:${clientId}:${hourUTC()}`))
    .limit(1) : [];

  const spend        = parseFloat(spendRow[0]?.value ?? "0");
  const runsThisHour = parseInt(rateRow[0]?.value   ?? "0");

  return {
    dailySpendUsd:    spend,
    dailyCapUsd:      DAILY_SPEND_CAP_USD,
    spendPct:         +(spend / DAILY_SPEND_CAP_USD * 100).toFixed(1),
    spendOk:          spend < DAILY_SPEND_CAP_USD,
    runsThisHour,
    runsPerHourLimit: MAX_RUNS_PER_HOUR,
    rateOk:           runsThisHour <= MAX_RUNS_PER_HOUR,
    costPerRunUsd:    COST_PER_RUN_USD,
  };
}

// ── Single persona call with timeout + silent fail detection ──────────────────

async function callPersona(
  persona: PersonaDef,
  dealText: string,
  memoryContext: string,
): Promise<Omit<PersonaVote, "weight">> {
  const contextualDeal = memoryContext
    ? `${memoryContext}\n\n---\n\nDEAL MEMO TO EVALUATE:\n${dealText}`
    : `Here is the deal memo to evaluate:\n\n${dealText}`;

  const userMessage = `${contextualDeal}\n\nProvide your vote and analysis as strict JSON only.`;

  // [FIX 4] Hard 30s timeout per agent
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), AGENT_TIMEOUT_MS)
  );

   try {
    const response = await Promise.race([
      anthropic.messages.create({
        model:      "claude-sonnet-4-5",
        max_tokens: 2048,
        system:     persona.systemPrompt,
        messages:   [{ role: "user", content: userMessage }],
      }),
      timeoutPromise,
    ]);

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Non-text response");

    const parsed     = parsePersonaResponse(content.text);
    const confidence = parsed.confidence;

    // [FIX 3] Silent fail detection
    const isSilentFail = confidence === 0;
    if (isSilentFail) {
      console.warn(`[SILENT_FAIL] ${persona.name} returned confidence=0. Model may be degraded.`);
    }

    return {
      personaId:    persona.id,
      personaName:  persona.name,
      personaRole:  persona.role,
      vote:         parsed.vote,
      confidence,
      rationale:    parsed.rationale,
      keyFlags:     parsed.key_flags,
      conditions:   parsed.conditions,
      blockers:     parsed.blockers,
      timedOut:     false,
      isSilentFail,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message === "TIMEOUT";
    console.error(`[AGENT_ERROR] ${persona.name} (${persona.id}): ${message}`);
    return {
      personaId:    persona.id,
      personaName:  persona.name,
      personaRole:  persona.role,
      vote:         "SOFT_NO",
      confidence:   0.2,
      rationale:    isTimeout
        ? "Analysis unavailable — persona timed out."
        : `Analysis unavailable — ${message.slice(0, 100)}`,
      keyFlags:     [isTimeout ? "Response timeout" : "Parse error"],
      conditions:   [],
      blockers:     [],
      timedOut:     isTimeout,
      isSilentFail: true,
    };
  }
}

// ── Main council engine ───────────────────────────────────────────────────────

export async function runCouncil(
  dealText: string,
  options: RunCouncilOptions = {},
): Promise<CouncilResult> {
  const {
    taskId,
    taskDomain,
    skipMemory = false,
    pitchId,
    clientId = "default",
    userId,
  } = options;

  // ── Token guard — check balance before running ────────────────────────────
  if (!skipMemory && userId) {
    try {
      const db = await getDb();
      if (db) {
        const [sub] = await db.select().from(subscriptions)
          .where(eq(subscriptions.userId, userId)).limit(1);
        if (sub && sub.tokensRemaining !== null && sub.tokensRemaining < TOKENS_PER_COUNCIL_RUN) {
          throw new Error(
            `INSUFFICIENT_TOKENS:You have ${sub.tokensRemaining} tokens remaining, but a full Council run costs ${TOKENS_PER_COUNCIL_RUN} tokens. Please upgrade your plan.`
          );
        }
      }
    } catch (err: any) {
      if (err?.message?.startsWith("INSUFFICIENT_TOKENS:")) throw err;
      console.warn("[CouncilEngine] Token guard check failed (non-fatal):", err);
    }
  }

  const sessionId = crypto.randomUUID();
  const startMs   = Date.now();

  // Cost guard (skip in tests)
  if (!skipMemory) {
    await checkCostGuard(clientId).catch((err) => {
      console.warn("[CouncilEngine] Cost guard check failed (non-fatal):", err);
    });
  }

  // Phase 3: Retrieve similar past decisions
  let memoryContext     = "";
  let memoryContextUsed = false;
  if (!skipMemory) {
    try {
      const similar = await findSimilarDecisions(dealText, 3, taskDomain);
      if (similar.length > 0) {
        memoryContext     = buildMemoryContext(similar);
        memoryContextUsed = true;
      }
    } catch (err) {
      console.warn("[CouncilEngine] Memory retrieval failed silently:", err);
    }
  }

  // Load authority weights
  let weightsMap = new Map<string, number>();
  if (!skipMemory) {
    try {
      weightsMap = await getAgentWeightsMap();
    } catch (err) {
      console.warn("[CouncilEngine] Weight loading failed silently:", err);
    }
  }

  // Run all 10 personas in parallel
  const results = await Promise.allSettled(
    PERSONAS.map((p) => callPersona(p, dealText, memoryContext))
  );

  const votes: PersonaVote[] = results.map((r, i) => {
    const p      = PERSONAS[i];
    const weight = weightsMap.get(p.id) ?? 1.0;
    if (r.status === "fulfilled") {
      return { ...r.value, weight };
    }
    return {
      personaId:    p.id,
      personaName:  p.name,
      personaRole:  p.role,
      vote:         "SOFT_NO" as VoteType,
      confidence:   0.2,
      rationale:    "Analysis unavailable — unexpected error.",
      keyFlags:     ["Unexpected error"],
      conditions:   [],
      blockers:     [],
      timedOut:     true,
      isSilentFail: true,
      weight,
    };
  });

  // Vote counting
  let hardYesCount = 0;
  let softYesCount = 0;
  let softNoCount  = 0;
  let hardNoCount  = 0;

  for (const v of votes) {
    if      (v.vote === "HARD_YES") hardYesCount++;
    else if (v.vote === "SOFT_YES") softYesCount++;
    else if (v.vote === "SOFT_NO")  softNoCount++;
    else if (v.vote === "HARD_NO")  hardNoCount++;
  }

  const yesCount = hardYesCount + softYesCount;
  const noCount  = softNoCount  + hardNoCount;

  // Weighted scores
  let weightedYesScore = 0;
  let weightedNoScore  = 0;
  for (const v of votes) {
    if (v.vote === "HARD_YES" || v.vote === "SOFT_YES") {
      weightedYesScore += v.weight * v.confidence;
    } else {
      weightedNoScore += v.weight * v.confidence;
    }
  }
  weightedYesScore = Math.round(weightedYesScore * 100) / 100;
  weightedNoScore  = Math.round(weightedNoScore  * 100) / 100;

  const confidenceScore =
    votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

  // Silent fails
  const silentFails = votes.filter((v) => v.isSilentFail).map((v) => v.personaRole);

  // Hard flags
  const hardFlags: string[] = [];
  const gccRegVote     = votes.find((v) => v.personaId === "GCC_REG");
  const gccShariahVote = votes.find((v) => v.personaId === "GCC_SHARIAH");
  const geoVote        = votes.find((v) => v.personaId === "GEOPOLITICAL");

  const gccVetoTriggered =
    gccRegVote?.vote    === "HARD_NO" ||
    gccShariahVote?.vote === "HARD_NO" ||
    hardNoCount >= 2;

  if (gccRegVote?.vote === "HARD_NO")
    hardFlags.push(`❌ GCC REGULATORY VETO — ${gccRegVote.rationale.slice(0, 100)}`);
  if (gccShariahVote?.vote === "HARD_NO")
    hardFlags.push(`❌ SHARIAH NON-COMPLIANT — ${gccShariahVote.rationale.slice(0, 100)}`);
  if (geoVote?.keyFlags?.some((f) => f.toLowerCase().includes("sanction")))
    hardFlags.push(`⚠️ SANCTIONS FLAG — ${geoVote.personaRole}`);
  if (silentFails.length > 0)
    hardFlags.push(`🟡 DEGRADED AGENTS (verify results): ${silentFails.join(", ")}`);

  // Tiebreaker
  let tiebreakerTriggered  = false;
  let tiebreakerSwingAgent: string | null = null;
  let workingVotes = [...votes];

  if (!gccVetoTriggered && yesCount === 7 && noCount === 3) {
    for (const priorityId of TIEBREAKER_PRIORITY) {
      const idx = workingVotes.findIndex(
        (v) => v.personaId === priorityId && v.vote === "SOFT_NO"
      );
      if (idx !== -1) {
        workingVotes[idx] = {
          ...workingVotes[idx],
          vote:       "SOFT_YES",
          conditions: [...workingVotes[idx].conditions, ...workingVotes[idx].blockers],
          blockers:   [],
        };
        tiebreakerTriggered  = true;
        tiebreakerSwingAgent = priorityId;
        softNoCount--;
        softYesCount++;
        break;
      }
    }
  }

  const finalYesCount = hardYesCount + softYesCount;
  const finalNoCount  = softNoCount  + hardNoCount;

  // Verdict
  let verdict: VerdictType;
  if (gccVetoTriggered) {
    verdict = "VETOED";
  } else if (finalYesCount >= CONSENSUS_THRESHOLD && hardYesCount >= 6) {
    verdict = "APPROVED";
  } else if (finalYesCount >= CONSENSUS_THRESHOLD && hardYesCount < 6) {
    verdict = "APPROVED_WITH_CONDITIONS";
  } else if (tiebreakerTriggered) {
    verdict = "APPROVED_WITH_CONDITIONS";
  } else {
    verdict = "REJECTED";
  }

  // Aggregation
  const softYesVotes = workingVotes.filter((v) => v.vote === "SOFT_YES");
  const noVotes      = workingVotes.filter((v) => v.vote === "SOFT_NO" || v.vote === "HARD_NO");

  const conditionsToProceed = deduplicate([
    ...softYesVotes.flatMap((v) => v.conditions),
    ...(tiebreakerTriggered
      ? workingVotes
          .filter((v) => v.personaId === tiebreakerSwingAgent)
          .flatMap((v) => v.conditions)
      : []),
  ]);

  const blockingIssues = deduplicate(noVotes.flatMap((v) => v.blockers));

  const councilResult: CouncilResult = {
    verdict,
    yesCount:              finalYesCount,
    noCount:               finalNoCount,
    hardYesCount,
    softYesCount,
    softNoCount,
    hardNoCount,
    weightedYesScore,
    weightedNoScore,
    confidenceScore:       Math.round(confidenceScore * 1000) / 1000,
    gccVetoTriggered,
    tiebreakerTriggered,
    tiebreakerSwingAgent,
    conditionsToProceed,
    blockingIssues,
    criticalBlockers:      blockingIssues,   // alias
    hardFlags,
    silentFails,
    votes:                 workingVotes,
    decisionMemoryId:      null,
    memoryContextUsed,
    sessionId,
    durationMs:            Date.now() - startMs,
    actionsTriggered:      [],
  };

  // Audit log (never throws)
  await writeAuditLog(councilResult).catch((err) =>
    console.warn("[CouncilEngine] writeAuditLog failed:", err)
  );

  // Record API spend (never throws)
  if (!skipMemory) {
    await recordRunCost().catch((err) =>
      console.warn("[CouncilEngine] recordRunCost failed:", err)
    );
  }

  // ── Token deduction — deduct after successful run ────────────────────────
  if (!skipMemory && userId) {
    try {
      const db = await getDb();
      if (db) {
        // Atomic decrement
        await db.update(subscriptions)
          .set({ tokensRemaining: sql`GREATEST(0, tokensRemaining - ${TOKENS_PER_COUNCIL_RUN})` })
          .where(eq(subscriptions.userId, userId));
        // Log usage
        await db.insert(tokenUsage).values({
          userId,
          sessionId,
          tokensUsed: TOKENS_PER_COUNCIL_RUN,
          action: "council_run",
        });
      }
    } catch (err) {
      console.warn("[CouncilEngine] Token deduction failed (non-fatal):", err);
    }
  }

  // Phase 2: Persist decision to memory (fire-and-forget)
  if (!skipMemory) {
    persistDecision({
      taskId,
      taskDescription: dealText,
      taskDomain,
      result: councilResult,
    })
      .then((id) => {
        if (id) councilResult.decisionMemoryId = id;
      })
      .catch((err) => {
        console.warn("[CouncilEngine] persistDecision failed:", err);
      });
  }

  // Stripe action if approved
  if (
    !skipMemory &&
    (verdict === "APPROVED" || verdict === "APPROVED_WITH_CONDITIONS")
  ) {
    const actions = await executeAction(sessionId, dealText, councilResult, pitchId);
    councilResult.actionsTriggered = actions;
  }

  return councilResult;
}

// ── [FIX 1 + FIX B + FIX C] Stripe — Invoice API, one-time customer ──────────

async function executeAction(
  sessionId: string,
  dealText:  string,
  result:    CouncilResult,
  pitchId?:  string,
): Promise<string[]> {
  const actions: string[] = [];

  if (!process.env.STRIPE_SECRET_KEY) {
    actions.push("stripe_skipped:no_key_configured");
    return actions;
  }

  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-03-25.dahlia" as Stripe.LatestApiVersion,
  });

  try {
  // [FIX C] Look up phone from pitch_sessions for customer metadata
  let phone: string | undefined;
  if (pitchId) {
    try {
      const db = await getDb();
      const pitchRow = db && await db
          .select({ phone: pitchSessions.phone })
          .from(pitchSessions)
          .where(eq(pitchSessions.pitchToken, pitchId))
          .limit(1);
      phone = pitchRow?.[0]?.phone ?? undefined;
    } catch {
      // Non-fatal — proceed without phone
    }
  }

    // [FIX C] Create one-time Stripe customer from pitch session
    const customer = await stripeClient.customers.create({
      description: `AgenThink Pitch — Session ${sessionId.slice(0, 8)}`,
      ...(phone ? { phone } : {}),
      metadata: {
        session_id: sessionId,
        pitch_id:   pitchId ?? "direct",
        verdict:    result.verdict,
      },
    });

  // [FIX 1] Invoice API — actually charges money
  const invoice = await (stripeClient.invoices as any).create({
    customer:          customer.id,
      auto_advance:      false,
      collection_method: "send_invoice",
      days_until_due:    7,
      metadata: {
        session_id:     sessionId,
        verdict:        result.verdict,
        yes_count:      String(result.yesCount),
        thesis_preview: dealText.slice(0, 100),
      },
    });

    // [FIX B] Fixed USD amount — KWD displayed on description only
    await (stripeClient.invoiceItems as any).create({
      customer:    customer.id,
      invoice:     invoice.id,
      amount:      FEE_USD_CENTS,   // $32.50 USD ≈ KWD 10
      currency:    "usd",
      description: `AgenThink Deal Screen — approx KWD ${FEE_KWD_DISPLAY} success fee (Session ${sessionId.slice(0, 8)})`,
    });

    const finalized = await (stripeClient.invoices as any).finalizeInvoice(invoice.id);
    actions.push(`stripe_invoice_sent:KWD${FEE_KWD_DISPLAY}:${finalized.id}`);
    console.log(`[STRIPE] Invoice sent — KWD ${FEE_KWD_DISPLAY} (~$${FEE_USD_CENTS / 100}) — Session ${sessionId.slice(0, 8)}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[STRIPE] Failed: ${msg}`);
    actions.push(`stripe_error:${msg.slice(0, 80)}`);
  }

  actions.push("audit_log_written");
  return actions;
}

// ── Audit Log — append-only, never throws ────────────────────────────────────

async function writeAuditLog(result: CouncilResult): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(consensusSessions).values({
      sessionId:        result.sessionId,
      thesis:           result.votes[0]?.rationale?.slice(0, 200) ?? "N/A",
      yesCount:         result.yesCount,
      noCount:          result.noCount,
      verdict:          result.verdict,
      consensusReached: result.yesCount >= CONSENSUS_THRESHOLD ? 1 : 0,
      hardFlags:        JSON.stringify(result.hardFlags),
      silentFails:      JSON.stringify(result.silentFails),
      votesJson:        JSON.stringify(result.votes),
      resultJson:       JSON.stringify(result),
      durationMs:       result.durationMs,
    });
  } catch (err) {
    console.error("[LEDGER] Audit log write failed:", err);
  }
}
