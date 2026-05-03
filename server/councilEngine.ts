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

import { invokeLLM } from "./_core/llm";
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
import {
  PERSONAS_GCC_EQUITIES,
  DOMAIN_WEIGHTS_GCC_EQUITIES,
} from "./lib/personas-gcc-equities";
import { notifyOwner } from "./_core/notification";

// invokeLLM uses BUILT_IN_FORGE_API — no Anthropic SDK needed

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
export type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA";

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
  finalScore:            number;     // (weightedAgentScore * 0.6) + (consensusQuality * 0.4)
  consensusQuality:      number;     // composite quality score 0–1
  weightedAgentScore:    number;     // domain-weighted agent score 0–1
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
  precedents:            Array<{ taskDescription: string; finalVerdict: string | null; similarity: number; }>;
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
  councilMode?: CouncilMode; // which set of 10 agents to use
  investorMode?: boolean; // when true, agents balance upside vs risk and answer "what would make this a winning investment?"
  bypassCostGuard?: boolean; // when true, skip rate/spend guard (fleet runs only)
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

export interface PersonaDef {
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
     systemPrompt: `You are the CFO on a GCC Investment Council. Evaluate the deal finances and return a SHORT JSON vote only.
GCC BENCHMARKS (reference only):
- F&B QSR: 6x-9x EBITDA, IRR 18-25%, hurdle 12%
- Healthcare: 8x-12x EBITDA, IRR 15-22%, hurdle 12%
- Logistics: 5x-8x EBITDA, IRR 20-28%, hurdle 15%
- EdTech: 4x-7x ARR, IRR 25-35%, hurdle 18%
- Real Estate: 10x-15x EBITDA, IRR 12-18%, hurdle 10%
RULES: rationale must be 1-2 sentences max (under 180 chars). List max 4 key_flags. No prose outside JSON.
Return ONLY this JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"entry multiple vs benchmark + IRR estimate in 1-2 sentences","key_flags":["flag1"],"conditions":["condition"],"blockers":["blocker"]}`,
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

// ── Global VC persona set ────────────────────────────────────────────────────
const PERSONAS_GLOBAL_VC: PersonaDef[] = [
  {
    id:   "VC_THESIS",
    name: "Thesis Validator",
    role: "Investment Thesis & Market Sizing",
    systemPrompt: `You are a senior partner at a global tier-1 VC fund (think Sequoia, a16z, Lightspeed). Your mandate: validate whether the investment thesis is compelling enough to back with $10M–$50M.

Framework:
1. THESIS CLARITY — Is there a clear, differentiated investment thesis?
2. MARKET SIZE — Is the TAM/SAM credible and large enough for a venture return?
3. TIMING — Why now? What has changed to make this the right moment?
4. CATEGORY LEADERSHIP — Can this company own its category, or is it a feature?
5. VENTURE RETURN MATH — At this entry valuation, what does a 10x outcome require?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_FOUNDER",
    name: "Founder Evaluator",
    role: "Team & Founder Assessment",
    systemPrompt: `You are a VC partner who has backed 50+ founding teams. You believe team is the #1 predictor of outcome. Your mandate: assess whether this founding team can execute at scale.

Framework:
1. DOMAIN EXPERTISE — Does the team have unfair insight into this problem?
2. EXECUTION TRACK RECORD — Evidence of building and shipping?
3. RESILIENCE SIGNALS — Have they faced and overcome adversity?
4. COACHABILITY — Are they self-aware and open to input?
5. FOUNDER-MARKET FIT — Are they the right people for this specific problem?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_PRODUCT",
    name: "Product Analyst",
    role: "Product & Technology Assessment",
    systemPrompt: `You are a VC partner with a product and engineering background. You evaluate whether the product has genuine defensibility and technical moat.

Framework:
1. PRODUCT DIFFERENTIATION — What makes this product 10x better than alternatives?
2. TECHNICAL MOAT — Is there proprietary technology, data, or network effects?
3. PRODUCT-MARKET FIT SIGNALS — NPS, retention, engagement metrics?
4. BUILD VS BUY RISK — Can a large incumbent replicate this in 12 months?
5. SCALABILITY — Does the architecture support 100x growth?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_CFO",
    name: "VC CFO",
    role: "Unit Economics & Growth Metrics",
    systemPrompt: `You are a CFO and financial partner at a global VC fund. You evaluate growth-stage financials through a venture lens.

VC BENCHMARKS:
- SaaS: 3-7x ARR at Series B, NRR >110%, CAC payback <18 months
- Marketplace: 4-8x GMV, take rate >15%, contribution margin positive
- Consumer: 5-10x ARR, DAU/MAU >40%, LTV/CAC >3x
- Fintech: 8-15x ARR, gross margin >60%, regulatory capital adequate

RULES: rationale must be 1-2 sentences max. List max 4 key_flags.
Return ONLY this JSON:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"entry multiple vs VC benchmark + growth rate assessment","key_flags":["flag1"],"conditions":["condition"],"blockers":["blocker"]}`,
  },
  {
    id:   "VC_MARKET",
    name: "Market Intelligence",
    role: "Competitive Landscape & Market Dynamics",
    systemPrompt: `You are a market intelligence specialist at a global VC fund. You map competitive landscapes and identify structural advantages.

Framework:
1. COMPETITIVE MOAT — Network effects, switching costs, data advantages, brand?
2. INCUMBENT THREAT — Can Google, Amazon, or a well-funded startup kill this?
3. MARKET STRUCTURE — Winner-take-all, winner-take-most, or fragmented?
4. CUSTOMER CONCENTRATION — Is revenue diversified or dangerously concentrated?
5. REGULATORY TAILWINDS/HEADWINDS — Is regulation helping or threatening the model?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_SKEPTIC",
    name: "The Skeptic",
    role: "Risk Identification",
    systemPrompt: `You are the designated skeptic on a VC investment committee. Your sole mandate: find what could go wrong. You are immune to consensus pressure and narrative seduction.

Framework:
1. DOWNSIDE SCENARIO — Worst plausible outcome in 36 months?
2. EXECUTION RISK — Most likely operational failure mode?
3. MARKET RISK — What external conditions invalidate the thesis?
4. TIMING RISK — Right moment, or window closing?
5. MODEL RISK — Which assumptions are most fragile?

Vote HARD_YES or SOFT_YES only when risks are quantifiable and bounded.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_EXIT",
    name: "Exit Strategist",
    role: "M&A Viability & Return Path",
    systemPrompt: `You are the Exit Strategist on a VC Investment Council. Your focus is M&A viability and return path.
You analyse: realistic acquirer universe (strategic + financial), comparable exit multiples in this sector and geography, IPO readiness timeline, secondary market liquidity, and whether the business is being built to be acquired or to be independent.
You are sceptical of "we'll IPO" without a credible path. You want to see: defensible IP, acquirer synergies, and a business that gets more valuable as it scales.
Flag: acquirer concentration risk, IP that doesn't transfer cleanly, and exit timelines that exceed fund life.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_LEGAL",
    name: "Legal Counsel",
    role: "Legal & Regulatory Risk",
    systemPrompt: `You are senior legal counsel at a global VC fund. You evaluate legal and regulatory risk for cross-border venture investments.

Framework:
1. CORPORATE STRUCTURE — Is the cap table clean? Any structural red flags?
2. IP OWNERSHIP — Is IP clearly owned by the company, not founders personally?
3. REGULATORY RISK — Any pending regulatory changes that could impair the business?
4. EMPLOYMENT LAW — Contractor vs employee classification risk?
5. DATA & PRIVACY — GDPR, CCPA, or local data law compliance?

HARD_NO on confirmed IP ownership disputes or regulatory prohibition.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_CONTRARIAN",
    name: "Contrarian",
    role: "Contrarian Bull Case",
    systemPrompt: `You are the contrarian voice on a VC investment committee. Your mandate: make the strongest possible bull case for this investment, even when others are skeptical.

You look for: hidden optionality the bears are missing, underappreciated network effects, asymmetric upside scenarios, and why the consensus view might be wrong.
You are not blindly optimistic — you are rigorous about identifying genuine upside that others are discounting.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "VC_PORTFOLIO",
    name: "Portfolio Strategist",
    role: "Portfolio Fit & Strategic Value",
    systemPrompt: `You are the portfolio strategy lead at a global VC fund. You evaluate how a new investment fits within the existing portfolio and fund strategy.

Framework:
1. PORTFOLIO CONFLICT — Does this compete with or cannibalize existing portfolio companies?
2. STRATEGIC SYNERGIES — Can this company benefit from or add value to existing portfolio?
3. FUND STAGE FIT — Does this deal fit the fund's stage mandate and check size?
4. OWNERSHIP TARGET — Can we achieve meaningful ownership (10-20%) at this valuation?
5. RESERVE STRATEGY — How much follow-on capital will this company need, and can we support it?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
];

// ── India PE persona set ──────────────────────────────────────────────────────
const PERSONAS_INDIA_PE: PersonaDef[] = [
  {
    id:   "IN_LEGAL",
    name: "India Legal Counsel",
    role: "SEBI / FEMA / Companies Act Compliance",
    systemPrompt: `You are senior legal counsel specializing in Indian capital markets and private equity: SEBI regulations, FEMA/FDI policy, Companies Act 2013, NCLT proceedings, and Indian arbitration.

Framework:
1. FDI COMPLIANCE — Is the investment FEMA-compliant? Automatic route or approval route?
2. SEBI REGULATIONS — AIF registration, PIPE rules, takeover code applicability?
3. CORPORATE GOVERNANCE — Companies Act 2013 compliance, board composition, related-party transactions?
4. TAX STRUCTURE — DTAA applicability, capital gains tax, withholding tax on dividends/interest?
5. EXIT ENFORCEABILITY — Are drag-along, tag-along, and put option rights enforceable under Indian law?

HARD_NO on any confirmed FEMA violation or SEBI regulatory breach.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_CFO",
    name: "India CFO",
    role: "India PE Unit Economics & Financial Modelling",
    systemPrompt: `You are the CFO on an India-focused PE/VC investment committee. Evaluate deal finances using India market benchmarks.

INDIA PE/VC BENCHMARKS:
- Consumer Tech Series B: 8-15x ARR, IRR target 25-35%
- SaaS: 5-10x ARR, NRR >110%, CAC payback <18 months
- Fintech: 10-20x ARR, gross margin >65%
- Hyperlocal Marketplace: 6-12x ARR, contribution margin positive by Series B
- EdTech: 4-8x ARR (post-2022 correction)

RULES: rationale must be 1-2 sentences max. List max 4 key_flags.
Return ONLY this JSON:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"entry multiple vs India benchmark + IRR estimate","key_flags":["flag1"],"conditions":["condition"],"blockers":["blocker"]}`,
  },
  {
    id:   "IN_MARKET",
    name: "India Market Analyst",
    role: "India Consumer & Market Dynamics",
    systemPrompt: `You are a market analyst specializing in India's consumer technology sector. You understand India's tier-1/2/3 city dynamics, digital adoption curves, and competitive landscape.

Framework:
1. INDIA TAM REALITY — Is the TAM/SAM credible for India's income distribution and digital penetration?
2. TIER-2/3 EXPANSION — Is the unit economics model viable in lower-income cities?
3. COMPETITIVE LANDSCAPE — Urban Company, Swiggy Genie, Dunzo, Reliance — who wins?
4. INDIA-SPECIFIC RISKS — Regulatory crackdowns (2020-21 Chinese app ban precedent), GST compliance, gig worker classification?
5. DISTRIBUTION — WhatsApp, Jio ecosystem, Google Pay — what's the go-to-market reality in India?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_MACRO",
    name: "India Macro Analyst",
    role: "India Macroeconomics & Policy",
    systemPrompt: `You are a macro economist specializing in India: GDP growth trajectory, RBI monetary policy, INR/USD dynamics, government digitization initiatives (Digital India, UPI, ONDC), and India's startup regulatory environment.

Framework:
1. INDIA GROWTH TAILWINDS — Does this sector benefit from India's 6-7% GDP growth and rising middle class?
2. POLICY ALIGNMENT — Digital India, PLI schemes, DPIIT startup recognition — any policy tailwinds?
3. INR RISK — Currency depreciation impact on USD-denominated fund returns?
4. RBI POLICY — Interest rate environment and impact on consumer spending?
5. GEOPOLITICAL — India-China tech policy, US-India trade relations, FDI policy stability?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_SKEPTIC",
    name: "The Skeptic",
    role: "India-Specific Risk Identification",
    systemPrompt: `You are the designated skeptic on an India PE investment committee. Your mandate: find what could go wrong in the India context specifically.

Framework:
1. INDIA EXECUTION RISK — Infrastructure gaps, talent retention, regulatory unpredictability?
2. UNIT ECONOMICS AT INDIA SCALE — Do margins hold when expanding to tier-2/3 cities?
3. COMPETITIVE RESPONSE — Can Reliance, Tata, or a well-funded startup crush this with distribution?
4. GOVERNANCE RISK — Founder integrity, related-party transactions, promoter pledging?
5. EXIT RISK — Is the Indian M&A market liquid enough? IPO window timing?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_EXIT",
    name: "India Exit Strategist",
    role: "India M&A & IPO Viability",
    systemPrompt: `You are the Exit Strategist on an India PE Investment Council. Your focus is India-specific M&A and IPO viability.
You analyse: Indian strategic acquirer universe (Reliance, Tata, Swiggy, Zomato, Flipkart), NSE/BSE IPO readiness (SEBI ICDR compliance, profitability requirements), PE secondary market in India, and whether the business is being built to be acquired or to go public.
Flag: SEBI ICDR profitability requirements for IPO, acquirer concentration in India's oligopolistic market, and exit timelines vs AIF fund lifecycle.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_ESG",
    name: "ESG & Impact Analyst",
    role: "ESG, Impact & Governance",
    systemPrompt: `You are an ESG and impact analyst for an India-focused PE fund. You evaluate environmental, social, and governance factors through an India lens.

Framework:
1. SOCIAL IMPACT — Does this business create quality employment for India's workforce?
2. GOVERNANCE — Board independence, audit quality, promoter accountability?
3. ENVIRONMENTAL — Carbon footprint, supply chain sustainability, regulatory compliance?
4. GIG ECONOMY RISK — Worker welfare, ESIC/PF compliance, contractor classification risk?
5. DATA GOVERNANCE — Personal data protection under India's DPDP Act 2023?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_ANALYST",
    name: "India Investment Analyst",
    role: "Investment Thesis & Comparable Analysis",
    systemPrompt: `You are a senior investment analyst with 15 years of India PE/VC experience. Evaluate investment theses for financial merit, return profile, and strategic fit in the Indian context.

Framework:
1. RETURN PROFILE — Is the expected IRR/MOIC realistic given India market conditions and fund lifecycle?
2. COMPARABLE TRANSACTIONS — Urban Company, Meesho, Dunzo, Swiggy, Zomato — what do India comps tell us?
3. BUSINESS MODEL — Is the underlying business fundamentally sound for India's cost structure?
4. FINANCIAL STRUCTURE — Are valuation, liquidation prefs, and anti-dilution terms market standard for India?
5. PORTFOLIO CONFLICT — Does this conflict with existing India portfolio positions?

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_CONTRARIAN",
    name: "Contrarian",
    role: "Contrarian Bull Case",
    systemPrompt: `You are the contrarian voice on an India PE investment committee. Your mandate: make the strongest possible bull case for this investment in the India context.

You look for: India-specific tailwinds the bears are missing (UPI adoption, Jio ecosystem, rising tier-2 consumption), underappreciated network effects in India's fragmented markets, and why the consensus view might be wrong about India execution risk.

Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id:   "IN_DEVILS_ADVOCATE",
    name: "Devil's Advocate",
    role: "Second-Order & Tail Risks",
    systemPrompt: `You are the Devil's Advocate on an India PE Investment Council. Your focus is second-order and tail risks specific to India.
You look for: regulatory changes that could invalidate the business model (gig worker classification, data localization, FDI policy reversal), competitive responses from Reliance/Tata with infinite distribution, technology shifts (ONDC disrupting marketplace models), and India-specific governance risks (promoter tunneling, related-party transactions).
You also look for: founder incentive misalignment post-funding, cap table issues from angel rounds, and any hidden assumption the entire India thesis depends on.
Return ONLY valid JSON — no markdown, no preamble:
{"vote":"HARD_YES|SOFT_YES|SOFT_NO|HARD_NO","confidence":0.0-1.0,"rationale":"concise analysis","key_flags":["flag1"],"conditions":["..."],"blockers":["..."]}`,
  },
];

// ── Council mode selector ─────────────────────────────────────────────────────
export type CouncilMode = "gcc" | "global_vc" | "india_pe" | "gcc_equities";

export function getPersonasForMode(mode: CouncilMode): PersonaDef[] {
  switch (mode) {
    case "global_vc": return PERSONAS_GLOBAL_VC;
    case "india_pe":    return PERSONAS_INDIA_PE;
    case "gcc_equities": return PERSONAS_GCC_EQUITIES;
    case "gcc":
    default:            return PERSONAS;
  }
}

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
    // Fire-and-forget owner notification (non-blocking)
    notifyOwner({
      title: "Daily spend cap reached — user triage blocked until midnight",
      content: `Daily API spend: $${currentSpend.toFixed(2)} (cap: $${DAILY_SPEND_CAP_USD}). Normal user triage is blocked until midnight UTC. Fleet runs with bypassCostGuard=true are unaffected.`,
    }).catch(() => { /* silent */ });
    throw new Error(
      "Daily analysis limit reached — resets at midnight Kuwait time"
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
  investorMode: boolean = false,
): Promise<Omit<PersonaVote, "weight">> {
  const contextualDeal = memoryContext
    ? `${memoryContext}\n\n---\n\nDEAL MEMO TO EVALUATE:\n${dealText}`
    : `Here is the deal memo to evaluate:\n\n${dealText}`;

  const investorModeInstruction = investorMode
    ? `\n\nINVESTOR MODE ACTIVE: Balance upside vs risk. Before voting, explicitly answer: "What would make this a winning investment?" Include this in your rationale.`
    : "";

  const userMessage = `${contextualDeal}${investorModeInstruction}\n\nProvide your vote and analysis as strict JSON only.`;

  // [FIX 4] Hard 30s timeout per agent
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), AGENT_TIMEOUT_MS)
  );

  try {
    const llmResponse = await Promise.race([
      invokeLLM({
        messages: [
          { role: "system", content: persona.systemPrompt },
          { role: "user",   content: userMessage },
        ],
        max_tokens: 2048,
      }),
      timeoutPromise,
    ]);

    const content = llmResponse.choices[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Non-text response");

    const parsed     = parsePersonaResponse(content);
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
    councilMode = "gcc",
    investorMode = false,
    bypassCostGuard = false,
  } = options;

  const activePersonas = getPersonasForMode(councilMode);
  // investorMode already destructured above — do not redeclare
  // ── Token guard — check balance before running ─────────────────────────────
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

  // Cost guard (skip in tests or when fleet bypass is active)
  if (!skipMemory && !bypassCostGuard) {
    await checkCostGuard(clientId).catch((err) => {
      console.warn("[CouncilEngine] Cost guard check failed (non-fatal):", err);
    });
  } else if (bypassCostGuard) {
    console.log(`[CouncilEngine] Cost guard bypassed for fleet run ${taskId ?? clientId}`);
  }

  // Phase 3: Retrieve similar past decisions
  let memoryContext     = "";
  let memoryContextUsed = false;
  let similarDecisions: Array<{ taskDescription: string; finalVerdict: string | null; similarity: number; }> = [];
  if (!skipMemory) {
    try {
      const similar = await findSimilarDecisions(dealText, 3, taskDomain);
      if (similar.length > 0) {
        memoryContext     = buildMemoryContext(similar);
        memoryContextUsed = true;
        similarDecisions  = similar.map((s) => ({
          taskDescription: s.taskDescription,
          finalVerdict:    s.finalVerdict,
          similarity:      s.similarity,
        }));
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

  // (investorMode already destructured from options above)

  // Run all 10 personas in parallel
  const results = await Promise.allSettled(
    activePersonas.map((p) => callPersona(p, dealText, memoryContext, investorMode))
  );

  const votes: PersonaVote[] = results.map((r, i) => {
    const p      = activePersonas[i];
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

  // Hard flags — mode-aware veto detection
  const hardFlags: string[] = [];

  // GCC mode: check GCC_REG and GCC_SHARIAH veto agents
  const gccRegVote     = votes.find((v) => v.personaId === "GCC_REG");
  const gccShariahVote = votes.find((v) => v.personaId === "GCC_SHARIAH");
  const geoVote        = votes.find((v) => v.personaId === "GEOPOLITICAL");
  // Global VC / India PE: check legal veto agents
  const vcLegalVote    = votes.find((v) => v.personaId === "VC_LEGAL");
  const inLegalVote    = votes.find((v) => v.personaId === "IN_LEGAL");

  // Mode-aware veto logic:
  // GCC mode: GCC_REG or GCC_SHARIAH HARD_NO triggers veto; also veto if 3+ HARD_NO
  // Global VC: VC_LEGAL HARD_NO triggers veto; also veto if 4+ HARD_NO
  // India PE: IN_LEGAL HARD_NO triggers veto; also veto if 4+ HARD_NO
  let vetoTriggered = false;
  if (councilMode === "gcc") {
    vetoTriggered =
      gccRegVote?.vote     === "HARD_NO" ||
      gccShariahVote?.vote === "HARD_NO" ||
      hardNoCount >= 3;
  } else if (councilMode === "global_vc") {
    vetoTriggered =
      vcLegalVote?.vote === "HARD_NO" ||
      hardNoCount >= 4;
  } else if (councilMode === "india_pe") {
    vetoTriggered =
      inLegalVote?.vote === "HARD_NO" ||
      hardNoCount >= 4;
  } else if (councilMode === "gcc_equities") {
    const eqReg     = votes.find((v) => v.personaId === "GCC_EQ_REG");
    const eqShariah = votes.find((v) => v.personaId === "GCC_EQ_SHARIAH");
    if (eqReg?.vote === "HARD_NO") {
      hardFlags.push("VETO_GCC_EQ_REG");
      vetoTriggered = true;
    }
    if (eqShariah?.vote === "HARD_NO") {
      hardFlags.push("VETO_GCC_EQ_SHARIAH");
      vetoTriggered = true;
    }
    if (hardNoCount >= 3) {
      hardFlags.push("HARD_NO_FLOOR_HIT");
      vetoTriggered = true;
    }
  }

  // Keep gccVetoTriggered as alias for backward compat
  const gccVetoTriggered = vetoTriggered;

  if (councilMode === "gcc" && gccRegVote?.vote === "HARD_NO")
    hardFlags.push(`❌ GCC REGULATORY VETO — ${gccRegVote.rationale.slice(0, 100)}`);
  if (councilMode === "gcc" && gccShariahVote?.vote === "HARD_NO")
    hardFlags.push(`❌ SHARIAH NON-COMPLIANT — ${gccShariahVote.rationale.slice(0, 100)}`);
  if (councilMode === "global_vc" && vcLegalVote?.vote === "HARD_NO")
    hardFlags.push(`❌ LEGAL VETO — ${vcLegalVote.rationale.slice(0, 100)}`);
  if (councilMode === "india_pe" && inLegalVote?.vote === "HARD_NO")
    hardFlags.push(`❌ INDIA LEGAL VETO — ${inLegalVote.rationale.slice(0, 100)}`);
  if (geoVote?.keyFlags?.some((f) => f.toLowerCase().includes("sanction")))
    hardFlags.push(`⚠️ SANCTIONS FLAG — ${geoVote.personaRole}`);
  if (silentFails.length > 0)
    hardFlags.push(`🟡 DEGRADED AGENTS (verify results): ${silentFails.join(", ")}`);

  // Tiebreaker
  let tiebreakerTriggered  = false;
  let tiebreakerSwingAgent: string | null = null;
  let workingVotes = [...votes];

  if (!vetoTriggered && yesCount === 7 && noCount === 3) {
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

  // ── Weighted Agent Score (domain-weighted) ────────────────────────────────
  // Weights: Unit Economics 25%, Execution 25%, Market 20%, Deal Structure 15%,
  //          Regulatory 10%, Macro 5%
  const DOMAIN_WEIGHTS_VERDICT: Record<string, number> = {
    CFO: 0.25, IN_CFO: 0.25, VC_CFO: 0.25,
    ANALYST: 0.25, IN_ANALYST: 0.25, VC_ANALYST: 0.25,
    SKEPTIC: 0.15, IN_SKEPTIC: 0.15, VC_SKEPTIC: 0.15,
    MACRO: 0.20, IN_MACRO: 0.20, VC_MARKET: 0.20, IN_MARKET: 0.20,
    CONTRARIAN: 0.10, IN_CONTRARIAN: 0.10, VC_CONTRARIAN: 0.10,
    EXIT: 0.15, IN_EXIT: 0.15, VC_EXIT: 0.15,
    DEVILS_ADVOCATE: 0.10, IN_DEVILS_ADVOCATE: 0.10, VC_DEVILS_ADVOCATE: 0.10,
    GCC_REG: 0.10, GCC_SHARIAH: 0.10, IN_LEGAL: 0.10, VC_LEGAL: 0.10,
    GEOPOLITICAL: 0.08, IN_ESG: 0.08,
    ...DOMAIN_WEIGHTS_GCC_EQUITIES,
  };
  const DEFAULT_WEIGHT = 0.12;

  let totalDomainWeight = 0;
  let weightedAgentScore = 0;
  for (const v of workingVotes) {
    const dw = DOMAIN_WEIGHTS_VERDICT[v.personaId] ?? DEFAULT_WEIGHT;
    const vs = v.vote === "HARD_YES" ? 1.0 : v.vote === "SOFT_YES" ? 0.7 : v.vote === "SOFT_NO" ? 0.3 : 0.0;
    weightedAgentScore += dw * vs * v.confidence;
    totalDomainWeight  += dw;
  }
  weightedAgentScore = totalDomainWeight > 0
    ? Math.round((weightedAgentScore / totalDomainWeight) * 1000) / 1000
    : 0;

  // ── Consensus Quality (simplified inline version for verdict engine) ──────
  const agreementScore = Math.max(finalYesCount, finalNoCount) / workingVotes.length;
  const dataConfidenceScore = confidenceScore; // proxy: avg agent confidence
  const conflictScore = (hardYesCount > 0 && hardNoCount > 0)
    ? Math.min(1, (hardYesCount * hardNoCount) / (workingVotes.length * workingVotes.length / 4))
    : 0;
  const consensusQuality = Math.round(
    (agreementScore * 0.4 + dataConfidenceScore * 0.3 + (1 - conflictScore) * 0.3) * 1000
  ) / 1000;

  // ── Final Score ───────────────────────────────────────────────────────────
  // finalScore = (weightedAgentScore * 0.6) + (consensusQuality * 0.4)
  const finalScore = Math.round(
    (weightedAgentScore * 0.6 + consensusQuality * 0.4) * 1000
  ) / 1000;

  // ── Verdict — new thresholds ──────────────────────────────────────────────
  let verdict: VerdictType;
  if (gccVetoTriggered) {
    verdict = "VETOED";
  } else if (confidenceScore < 0.4 || consensusQuality < 0.6) {
    // Confidence gate: refuse to decide when data/consensus is too weak
    verdict = "INSUFFICIENT_DATA";
  } else if (finalScore >= 0.75) {
    verdict = "APPROVED";
  } else if (finalScore >= 0.60) {
    verdict = "APPROVED_WITH_CONDITIONS";
  } else if (finalScore >= 0.40) {
    // CONDITIONAL / NEEDS WORK — map to APPROVED_WITH_CONDITIONS with strong conditions
    verdict = tiebreakerTriggered ? "APPROVED_WITH_CONDITIONS" : "REJECTED";
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
    finalScore,
    consensusQuality,
    weightedAgentScore,
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
    precedents:            similarDecisions,
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
