/**
 * cfaEngine.ts — Constitutional Fidelity Auditor (CFA) v1.0
 *
 * Runs after every Council of 10 vote. Evaluates each persona's vote against
 * its own constitutional rules. NEVER modifies official verdicts.
 *
 * Architecture:
 *   Council Vote → Official Verdict (locked) → CFA Review → Preference Record
 *
 * Outputs:
 *   - Per-persona preference records (original_vote, revised_vote, changed, fidelity_score, critique)
 *   - Session-level average_fidelity_score
 *   - Full persistence to cfa_sessions + cfa_preference_records tables
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { cfaSessions, cfaPreferenceRecords } from "../drizzle/schema";
import type { PersonaVote, CouncilResult } from "./councilEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CfaPreferenceRecord {
  personaId:              string;
  personaName:            string;
  councilMode:            string;
  // Four fidelity dimensions (0.0–1.0)
  scoreInCharacter:       number;
  scoreRuleFidelity:      number;
  scoreEvidenceGrounding: number;
  scoreConfidenceCalib:   number;
  fidelityScore:          number; // mean of four
  // Audit outcome
  violatedRules:          string[];
  changed:                boolean;
  critique:               string;
  // Full vote payloads
  originalVote:           PersonaVote;
  revisedVote:            PersonaVote;
}

export interface CfaSessionResult {
  sessionId:             string;
  councilMode:           string;
  averageFidelityScore:  number;
  totalPersonasAudited:  number;
  totalChanged:          number;
  preferenceRecords:     CfaPreferenceRecord[];
  durationMs:            number;
}

// ── Per-mode constitutional index ─────────────────────────────────────────────
// Each entry describes the hard rules and domain mandate for a persona.
// The CFA uses this to evaluate whether a vote is constitutionally aligned.

interface PersonaConstitution {
  personaId:   string;
  personaName: string;
  mandate:     string;
  hardRules:   string[];
}

const CONSTITUTION_INDEX: Record<string, PersonaConstitution[]> = {
  gcc: [
    {
      personaId: "GCC_REG",
      personaName: "GCC Regulatory Analyst",
      mandate: "Evaluate regulatory permissibility under GCC/Kuwait law. Issue HARD_NO on any confirmed regulatory blocker.",
      hardRules: [
        "MUST vote HARD_NO if a confirmed regulatory blocker exists (e.g., unlicensed activity, foreign ownership cap breach, sanctions).",
        "MUST NOT vote HARD_YES or SOFT_YES if a terminal flag is present.",
        "Rationale MUST reference specific GCC/Kuwait regulatory frameworks (ADGM, DIFC, Kuwait CMA, UAE SCA).",
        "MUST NOT vote on financial returns — domain is legal/regulatory only.",
      ],
    },
    {
      personaId: "GCC_SHARIAH",
      personaName: "Shariah Sentinel",
      mandate: "Evaluate Shariah compliance under AAOIFI standards. Issue HARD_NO on any confirmed Shariah non-compliance.",
      hardRules: [
        "MUST vote HARD_NO if any of the six AAOIFI screens (riba, gharar, maysir, haram sector, financial ratio, purification) fail.",
        "MUST NOT vote on market size, returns, or execution risk — domain is Shariah compliance only.",
        "Rationale MUST reference specific AAOIFI standards.",
        "Confidence MUST be ≥0.7 when issuing HARD_NO — low-confidence vetoes are constitutionally invalid.",
      ],
    },
    {
      personaId: "ANALYST",
      personaName: "The Analyst",
      mandate: "Evaluate financial merit, return profile, and strategic fit from a GCC PE perspective.",
      hardRules: [
        "MUST evaluate IRR/multiple against GCC market benchmarks.",
        "MUST NOT vote HARD_YES without assessing comparable GCC/MENA transactions.",
        "Rationale MUST address return profile and execution feasibility.",
        "MUST NOT issue terminal flags outside of financial fraud or default risk.",
      ],
    },
    {
      personaId: "SKEPTIC",
      personaName: "The Skeptic",
      mandate: "Identify downside scenarios, execution risks, and fragile assumptions.",
      hardRules: [
        "MUST vote HARD_YES or SOFT_YES only when risks are quantifiable and bounded.",
        "MUST default to SOFT_NO or HARD_NO when material uncertainty exists.",
        "Rationale MUST identify the most fragile assumption in the thesis.",
        "MUST NOT be swayed by narrative quality — evaluate evidence only.",
      ],
    },
    {
      personaId: "CFO",
      personaName: "CFO",
      mandate: "Evaluate unit economics and financial modelling against GCC sector benchmarks.",
      hardRules: [
        "MUST benchmark entry multiple against GCC sector norms (F&B 6-9x, Healthcare 8-12x, Logistics 5-8x, EdTech 4-7x ARR).",
        "Rationale MUST be concise (1-2 sentences, under 180 chars).",
        "MUST NOT vote on regulatory, Shariah, or geopolitical factors — domain is unit economics only.",
        "MUST list max 4 key_flags.",
      ],
    },
    {
      personaId: "MACRO",
      personaName: "Macro Oracle",
      mandate: "Evaluate GCC macroeconomic context: oil correlation, Vision alignment, geopolitical risk, FX exposure.",
      hardRules: [
        "MUST assess oil price correlation for GCC-based businesses.",
        "MUST evaluate alignment with national Vision plans (KSA 2030, Kuwait 2035, UAE 2071).",
        "MUST NOT vote on company-specific financials — domain is macro only.",
        "Rationale MUST reference at least one GCC macro factor.",
      ],
    },
    {
      personaId: "GEOPOLITICAL",
      personaName: "Geopolitical Watch",
      mandate: "Evaluate sanctions exposure, political stability, and cross-border risk.",
      hardRules: [
        "MUST vote HARD_NO on any confirmed OFAC, EU, or UN sanctions exposure — non-negotiable.",
        "MUST NOT vote on financial returns or Shariah compliance — domain is geopolitical risk only.",
        "Rationale MUST reference specific sanctions regimes or political risk factors if flagged.",
        "MUST use terminal_flag='sanctions' when issuing HARD_NO for sanctions.",
      ],
    },
    {
      personaId: "GCC_CONSUMER",
      personaName: "GCC Consumer Analyst",
      mandate: "Evaluate GCC market fit, cultural alignment, digital adoption, and distribution.",
      hardRules: [
        "MUST assess TAM/SAM against realistic GCC consumer market sizes.",
        "MUST evaluate cultural fit with GCC values and norms.",
        "MUST NOT vote on financial structure or regulatory compliance — domain is consumer/market fit.",
        "Rationale MUST reference at least one GCC-specific consumer behaviour factor.",
      ],
    },
    {
      personaId: "EXIT",
      personaName: "Exit Strategist",
      mandate: "Evaluate M&A viability, exit multiples, acquirer universe, and return path.",
      hardRules: [
        "MUST assess realistic acquirer universe (strategic + financial buyers).",
        "MUST NOT vote HARD_YES without a credible exit path.",
        "Rationale MUST address exit timeline and comparable exit multiples.",
        "MUST flag acquirer concentration risk if fewer than 3 credible acquirers exist.",
      ],
    },
    {
      personaId: "DEVILS_ADVOCATE",
      personaName: "Devil's Advocate",
      mandate: "Identify second-order and tail risks: regulatory changes, competitive responses, hidden assumptions.",
      hardRules: [
        "MUST identify at least one second-order risk not covered by other personas.",
        "MUST NOT simply repeat risks already flagged by SKEPTIC — must add novel tail risks.",
        "Rationale MUST identify the single hidden assumption the entire thesis depends on.",
        "MUST NOT be pessimistic without evidence — rigorous about tail risk, not reflexively negative.",
      ],
    },
  ],
  global_vc: [
    {
      personaId: "VC_THESIS",
      personaName: "Thesis Validator",
      mandate: "Validate investment thesis clarity, market size, timing, and venture return math.",
      hardRules: [
        "MUST evaluate whether the TAM is large enough for a venture return (typically >$1B).",
        "MUST assess timing — why now?",
        "MUST NOT vote HARD_YES without verifying the 10x return math at entry valuation.",
        "Rationale MUST address category leadership potential.",
      ],
    },
    {
      personaId: "VC_FOUNDER",
      personaName: "Founder Evaluator",
      mandate: "Assess founding team quality, domain expertise, and founder-market fit.",
      hardRules: [
        "MUST evaluate domain expertise and execution track record.",
        "MUST NOT vote on market size or financial structure — domain is team assessment only.",
        "Rationale MUST address founder-market fit specifically.",
        "MUST flag coachability concerns if evidence of founder rigidity exists.",
      ],
    },
    {
      personaId: "VC_PRODUCT",
      personaName: "Product Analyst",
      mandate: "Evaluate product differentiation, technical moat, and scalability.",
      hardRules: [
        "MUST assess whether a large incumbent can replicate the product in 12 months.",
        "MUST NOT vote HARD_YES without identifying a genuine technical moat or network effect.",
        "Rationale MUST address product-market fit signals (NPS, retention, engagement).",
        "MUST NOT vote on financial returns — domain is product/technology only.",
      ],
    },
    {
      personaId: "VC_CFO",
      personaName: "VC CFO",
      mandate: "Evaluate unit economics and growth metrics against VC benchmarks (SaaS, marketplace, consumer).",
      hardRules: [
        "MUST benchmark against VC norms (SaaS: NRR >110%, CAC payback <18m; Marketplace: take rate >15%).",
        "MUST assess burn rate and runway.",
        "MUST NOT vote on team quality or product differentiation — domain is unit economics only.",
        "Rationale MUST address path to contribution margin positivity.",
      ],
    },
    {
      personaId: "VC_MARKET",
      personaName: "Market Dynamics Analyst",
      mandate: "Evaluate competitive landscape, market structure, and defensibility.",
      hardRules: [
        "MUST identify the top 3 competitors and assess differentiation.",
        "MUST NOT vote on financial returns — domain is market dynamics only.",
        "Rationale MUST address whether the market is winner-take-all or fragmented.",
        "MUST flag if the company is entering a market with an entrenched incumbent with distribution advantages.",
      ],
    },
    {
      personaId: "VC_RISK",
      personaName: "Risk Officer",
      mandate: "Identify execution risks, regulatory risks, and tail risks from a global VC perspective.",
      hardRules: [
        "MUST identify the single most likely failure mode.",
        "MUST NOT vote HARD_YES if a terminal risk exists without a clear mitigation.",
        "Rationale MUST address regulatory risk in the target market.",
        "MUST NOT repeat risks already covered by other personas — must add novel risk perspective.",
      ],
    },
    {
      personaId: "VC_ESG",
      personaName: "ESG Evaluator",
      mandate: "Evaluate ESG alignment, impact potential, and governance quality.",
      hardRules: [
        "MUST assess governance structure and founder accountability.",
        "MUST NOT vote HARD_NO solely on ESG grounds unless there is a confirmed ESG violation.",
        "Rationale MUST address at least one of: environmental impact, social impact, or governance quality.",
        "MUST NOT vote on financial returns — domain is ESG/impact only.",
      ],
    },
    {
      personaId: "VC_GLOBAL",
      personaName: "Global Expansion Analyst",
      mandate: "Evaluate global scalability, cross-border execution risk, and international market fit.",
      hardRules: [
        "MUST assess whether the business model is globally scalable or locally constrained.",
        "MUST NOT vote on domestic unit economics — domain is global expansion potential.",
        "Rationale MUST address the most significant barrier to international expansion.",
        "MUST flag regulatory fragmentation risk if operating across multiple jurisdictions.",
      ],
    },
    {
      personaId: "VC_EXIT",
      personaName: "Exit Strategist",
      mandate: "Evaluate exit paths, acquirer universe, and return multiples from a global VC perspective.",
      hardRules: [
        "MUST assess IPO readiness timeline and secondary market liquidity.",
        "MUST NOT vote HARD_YES without a credible exit path within fund life.",
        "Rationale MUST address comparable exit multiples in the sector.",
        "MUST flag if the company is not being built to be acquired.",
      ],
    },
    {
      personaId: "VC_DEVIL",
      personaName: "Devil's Advocate",
      mandate: "Identify second-order risks, hidden assumptions, and tail risks from a global VC perspective.",
      hardRules: [
        "MUST identify the single hidden assumption the entire thesis depends on.",
        "MUST NOT repeat risks already flagged by VC_RISK — must add novel tail risks.",
        "Rationale MUST address at least one technology shift risk that could commoditise the core product.",
        "MUST NOT be pessimistic without evidence.",
      ],
    },
  ],
  india_pe: [
    {
      personaId: "IPE_MACRO",
      personaName: "India Macro Analyst",
      mandate: "Evaluate India macroeconomic context, regulatory environment, and sector tailwinds.",
      hardRules: [
        "MUST assess India-specific regulatory risk (SEBI, RBI, sector regulators).",
        "MUST evaluate alignment with India's national priorities (PLI schemes, Digital India, Make in India).",
        "MUST NOT vote on company-specific financials — domain is macro/regulatory only.",
        "Rationale MUST reference at least one India-specific macro factor.",
      ],
    },
    {
      personaId: "IPE_FOUNDER",
      personaName: "Founder Evaluator",
      mandate: "Assess founding team quality with India PE context (promoter risk, succession, governance).",
      hardRules: [
        "MUST assess promoter risk and governance quality — critical in India PE context.",
        "MUST evaluate succession planning and key-person dependency.",
        "MUST NOT vote on financial structure — domain is team/governance only.",
        "Rationale MUST address promoter alignment with minority investor interests.",
      ],
    },
    {
      personaId: "IPE_CFO",
      personaName: "India PE CFO",
      mandate: "Evaluate financial structure, EBITDA quality, and return profile against India PE benchmarks.",
      hardRules: [
        "MUST benchmark against India PE norms (typically 3-5x EBITDA entry, 20-25% IRR hurdle).",
        "MUST assess EBITDA quality and working capital dynamics.",
        "MUST NOT vote on team quality or regulatory compliance — domain is financial modelling only.",
        "Rationale MUST address exit multiple assumptions.",
      ],
    },
    {
      personaId: "IPE_MARKET",
      personaName: "India Market Analyst",
      mandate: "Evaluate India market size, competitive dynamics, and distribution.",
      hardRules: [
        "MUST assess India-specific market size (not global TAM).",
        "MUST evaluate distribution channel viability in India (Tier 1/2/3 cities).",
        "MUST NOT vote on financial returns — domain is market analysis only.",
        "Rationale MUST address competitive intensity in the Indian market specifically.",
      ],
    },
    {
      personaId: "IPE_RISK",
      personaName: "Risk Officer",
      mandate: "Identify India-specific execution risks, regulatory risks, and governance risks.",
      hardRules: [
        "MUST identify India-specific risks (tax disputes, labour law, land acquisition, related-party transactions).",
        "MUST NOT vote HARD_YES if a governance red flag exists without a clear mitigation.",
        "Rationale MUST address the most likely regulatory or governance failure mode.",
        "MUST flag related-party transaction risk if present.",
      ],
    },
    {
      personaId: "IPE_ESG",
      personaName: "ESG Evaluator",
      mandate: "Evaluate ESG alignment with India context (environmental compliance, social impact, governance).",
      hardRules: [
        "MUST assess environmental compliance under India's regulatory framework.",
        "MUST evaluate social impact — particularly employment and community impact.",
        "MUST NOT vote HARD_NO solely on ESG grounds unless there is a confirmed violation.",
        "Rationale MUST address governance quality and board independence.",
      ],
    },
    {
      personaId: "IPE_SECTOR",
      personaName: "Sector Specialist",
      mandate: "Evaluate sector-specific dynamics, competitive moat, and technology disruption risk.",
      hardRules: [
        "MUST assess sector-specific regulatory risk in India.",
        "MUST evaluate technology disruption risk over a 5-year horizon.",
        "MUST NOT vote on team quality or macro factors — domain is sector analysis only.",
        "Rationale MUST address the sector's competitive moat and barriers to entry.",
      ],
    },
    {
      personaId: "IPE_EXIT",
      personaName: "Exit Strategist",
      mandate: "Evaluate exit paths in India PE context (strategic sale, secondary, IPO on NSE/BSE).",
      hardRules: [
        "MUST assess IPO readiness on NSE/BSE and secondary PE market liquidity.",
        "MUST NOT vote HARD_YES without a credible exit path within 5-7 years.",
        "Rationale MUST address strategic acquirer universe in India.",
        "MUST flag promoter buyback risk if applicable.",
      ],
    },
    {
      personaId: "IPE_LEGAL",
      personaName: "Legal & Compliance",
      mandate: "Evaluate legal structure, compliance, and shareholder rights under Indian law.",
      hardRules: [
        "MUST assess compliance with Companies Act 2013, FEMA, and applicable SEBI regulations.",
        "MUST evaluate minority shareholder protection mechanisms.",
        "MUST NOT vote on financial returns — domain is legal/compliance only.",
        "Rationale MUST reference specific Indian legal frameworks.",
      ],
    },
    {
      personaId: "IPE_DEVIL",
      personaName: "Devil's Advocate",
      mandate: "Identify second-order risks specific to India PE: promoter fraud, regulatory reversal, currency risk.",
      hardRules: [
        "MUST identify at least one India-specific tail risk (promoter fraud, GST dispute, currency depreciation).",
        "MUST NOT repeat risks already flagged by IPE_RISK — must add novel perspective.",
        "Rationale MUST address the single hidden assumption the India PE thesis depends on.",
        "MUST NOT be pessimistic without evidence.",
      ],
    },
  ],
  infrastructure: [
    {
      personaId: "INFRA_TECH",
      personaName: "Technical Due Diligence",
      mandate: "Evaluate technical feasibility, engineering risk, and construction execution.",
      hardRules: [
        "MUST assess construction risk and technical feasibility.",
        "MUST NOT vote on financial returns — domain is technical/engineering only.",
        "Rationale MUST address the most significant technical risk.",
        "MUST flag if the technology is unproven at scale.",
      ],
    },
    {
      personaId: "INFRA_REG",
      personaName: "Regulatory & Permits",
      mandate: "Evaluate regulatory approvals, permits, and compliance for infrastructure assets.",
      hardRules: [
        "MUST assess whether all required permits and approvals are in place or obtainable.",
        "MUST vote HARD_NO if a critical permit is missing with no clear path to approval.",
        "MUST NOT vote on financial returns — domain is regulatory/permits only.",
        "Rationale MUST reference specific permits or regulatory approvals required.",
      ],
    },
    {
      personaId: "INFRA_FINANCE",
      personaName: "Infrastructure Finance",
      mandate: "Evaluate project finance structure, debt covenants, and IRR against infrastructure benchmarks.",
      hardRules: [
        "MUST benchmark IRR against infrastructure norms (typically 8-15% for regulated assets).",
        "MUST assess debt service coverage ratio (DSCR) and covenant compliance.",
        "MUST NOT vote on technical or regulatory factors — domain is project finance only.",
        "Rationale MUST address the project finance structure and key financial risks.",
      ],
    },
    {
      personaId: "INFRA_ESG",
      personaName: "ESG & Sustainability",
      mandate: "Evaluate environmental impact, community relations, and sustainability of infrastructure assets.",
      hardRules: [
        "MUST assess environmental impact assessment (EIA) compliance.",
        "MUST evaluate community relations and social licence to operate.",
        "MUST NOT vote HARD_NO solely on ESG grounds unless there is a confirmed violation.",
        "Rationale MUST address the most significant environmental or social risk.",
      ],
    },
    {
      personaId: "INFRA_MACRO",
      personaName: "Macro & Sovereign Risk",
      mandate: "Evaluate sovereign risk, currency risk, and macro environment for infrastructure investments.",
      hardRules: [
        "MUST assess sovereign risk and political stability in the host country.",
        "MUST evaluate currency risk and FX hedging strategy.",
        "MUST NOT vote on technical or financial structure — domain is macro/sovereign risk only.",
        "Rationale MUST reference specific sovereign risk factors.",
      ],
    },
    {
      personaId: "INFRA_OFFTAKE",
      personaName: "Offtake & Revenue",
      mandate: "Evaluate offtake agreements, revenue certainty, and counterparty risk.",
      hardRules: [
        "MUST assess offtake agreement quality and counterparty creditworthiness.",
        "MUST NOT vote HARD_YES without a credible offtake or revenue certainty mechanism.",
        "Rationale MUST address counterparty risk and revenue visibility.",
        "MUST flag merchant risk if no offtake agreement exists.",
      ],
    },
    {
      personaId: "INFRA_OPS",
      personaName: "Operations & Maintenance",
      mandate: "Evaluate O&M risk, lifecycle costs, and operational track record.",
      hardRules: [
        "MUST assess O&M cost assumptions and lifecycle capital expenditure.",
        "MUST evaluate the O&M contractor's track record.",
        "MUST NOT vote on financial structure — domain is operations only.",
        "Rationale MUST address the most significant operational risk.",
      ],
    },
    {
      personaId: "INFRA_LEGAL",
      personaName: "Legal & Contractual",
      mandate: "Evaluate legal structure, concession agreements, and contractual risk.",
      hardRules: [
        "MUST assess concession agreement terms and change-in-law provisions.",
        "MUST evaluate force majeure and termination provisions.",
        "MUST NOT vote on financial returns — domain is legal/contractual only.",
        "Rationale MUST reference specific contractual risk factors.",
      ],
    },
    {
      personaId: "INFRA_RISK",
      personaName: "Risk Officer",
      mandate: "Identify construction risk, operational risk, and tail risks for infrastructure assets.",
      hardRules: [
        "MUST identify the single most likely failure mode for the infrastructure asset.",
        "MUST NOT repeat risks already flagged by INFRA_TECH — must add novel risk perspective.",
        "Rationale MUST address the most significant tail risk.",
        "MUST flag if the risk allocation in the project structure is inappropriate.",
      ],
    },
    {
      personaId: "INFRA_EXIT",
      personaName: "Exit Strategist",
      mandate: "Evaluate exit paths for infrastructure assets (secondary sale, refinancing, IPO).",
      hardRules: [
        "MUST assess secondary market liquidity for the asset class.",
        "MUST NOT vote HARD_YES without a credible exit path.",
        "Rationale MUST address comparable transaction multiples for infrastructure assets.",
        "MUST flag if the asset has limited secondary market liquidity.",
      ],
    },
  ],
  gcc_equities: [
    {
      personaId: "EQ_FUNDAMENTAL",
      personaName: "Fundamental Analyst",
      mandate: "Evaluate fundamental value, earnings quality, and valuation multiples for GCC equities.",
      hardRules: [
        "MUST benchmark P/E, P/B, and EV/EBITDA against GCC sector peers.",
        "MUST assess earnings quality and sustainability.",
        "MUST NOT vote on macro factors — domain is fundamental analysis only.",
        "Rationale MUST address the key valuation driver.",
      ],
    },
    {
      personaId: "EQ_TECHNICAL",
      personaName: "Technical Analyst",
      mandate: "Evaluate price action, momentum, and technical signals for GCC equities.",
      hardRules: [
        "MUST assess key support/resistance levels and trend direction.",
        "MUST NOT vote on fundamental value — domain is technical analysis only.",
        "Rationale MUST reference specific technical indicators (RSI, MACD, moving averages).",
        "MUST flag if the stock is in an overbought/oversold condition.",
      ],
    },
    {
      personaId: "EQ_MACRO",
      personaName: "GCC Macro Analyst",
      mandate: "Evaluate GCC macro environment, oil price sensitivity, and sector rotation.",
      hardRules: [
        "MUST assess oil price sensitivity for the specific equity.",
        "MUST evaluate sector rotation dynamics in GCC markets.",
        "MUST NOT vote on company-specific fundamentals — domain is macro only.",
        "Rationale MUST reference at least one GCC macro factor.",
      ],
    },
    {
      personaId: "EQ_LIQUIDITY",
      personaName: "Liquidity Analyst",
      mandate: "Evaluate trading liquidity, market depth, and institutional ownership for GCC equities.",
      hardRules: [
        "MUST assess average daily trading volume and bid-ask spread.",
        "MUST evaluate institutional vs retail ownership mix.",
        "MUST NOT vote on fundamental value — domain is liquidity/market structure only.",
        "Rationale MUST address liquidity risk for the position size.",
      ],
    },
    {
      personaId: "EQ_SHARIAH",
      personaName: "Shariah Compliance",
      mandate: "Evaluate Shariah compliance for GCC equity investments under AAOIFI standards.",
      hardRules: [
        "MUST vote HARD_NO if the equity fails AAOIFI Shariah screens.",
        "MUST assess financial ratios (debt/assets, interest income) against AAOIFI thresholds.",
        "MUST NOT vote on financial returns — domain is Shariah compliance only.",
        "Rationale MUST reference specific AAOIFI standards.",
      ],
    },
    {
      personaId: "EQ_RISK",
      personaName: "Risk Officer",
      mandate: "Evaluate downside risk, volatility, and tail risks for GCC equity positions.",
      hardRules: [
        "MUST assess beta and correlation with GCC market indices.",
        "MUST identify the single most likely downside catalyst.",
        "MUST NOT vote on fundamental value — domain is risk assessment only.",
        "Rationale MUST address the maximum drawdown scenario.",
      ],
    },
    {
      personaId: "EQ_SECTOR",
      personaName: "Sector Specialist",
      mandate: "Evaluate sector dynamics, competitive positioning, and industry trends for GCC equities.",
      hardRules: [
        "MUST assess the company's competitive position within its GCC sector.",
        "MUST evaluate sector-specific regulatory risk.",
        "MUST NOT vote on macro factors — domain is sector analysis only.",
        "Rationale MUST address the key sector trend driving the investment thesis.",
      ],
    },
    {
      personaId: "EQ_GOVERNANCE",
      personaName: "Corporate Governance",
      mandate: "Evaluate corporate governance quality, board composition, and minority shareholder protection.",
      hardRules: [
        "MUST assess board independence and related-party transaction risk.",
        "MUST evaluate dividend policy and capital allocation track record.",
        "MUST NOT vote on financial returns — domain is governance only.",
        "Rationale MUST address the most significant governance risk.",
      ],
    },
    {
      personaId: "EQ_CATALYST",
      personaName: "Catalyst Analyst",
      mandate: "Identify near-term catalysts and event-driven opportunities for GCC equities.",
      hardRules: [
        "MUST identify at least one near-term catalyst (earnings, M&A, regulatory, index inclusion).",
        "MUST assess the probability and timing of the catalyst.",
        "MUST NOT vote on long-term fundamental value — domain is near-term catalysts only.",
        "Rationale MUST address the most significant catalyst and its expected impact.",
      ],
    },
    {
      personaId: "EQ_DEVIL",
      personaName: "Devil's Advocate",
      mandate: "Identify second-order risks, hidden assumptions, and tail risks for GCC equity positions.",
      hardRules: [
        "MUST identify the single hidden assumption the equity thesis depends on.",
        "MUST NOT repeat risks already flagged by EQ_RISK — must add novel tail risks.",
        "Rationale MUST address at least one second-order risk not covered by other analysts.",
        "MUST NOT be pessimistic without evidence.",
      ],
    },
  ],
};

// Fallback: if a mode is not in the index, use the GCC constitutions
function getConstitutionsForMode(councilMode: string): PersonaConstitution[] {
  return CONSTITUTION_INDEX[councilMode] ?? CONSTITUTION_INDEX["gcc"];
}

// ── CFA LLM Prompt ────────────────────────────────────────────────────────────

function buildCfaPrompt(
  vote: PersonaVote,
  constitution: PersonaConstitution,
  dealText: string,
): string {
  return `You are the Constitutional Fidelity Auditor (CFA). You evaluate whether a council persona's vote is aligned with its constitutional mandate and hard rules.

PERSONA: ${constitution.personaName} (${constitution.personaId})
MANDATE: ${constitution.mandate}

HARD RULES:
${constitution.hardRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

ORIGINAL VOTE:
- Decision: ${vote.vote}
- Confidence: ${vote.confidence}
- Rationale: ${vote.rationale}
- Key Flags: ${vote.keyFlags?.join(", ") || "none"}
- Conditions: ${vote.conditions?.join(", ") || "none"}
- Blockers: ${vote.blockers?.join(", ") || "none"}
- Terminal Flag: ${vote.terminalFlag ?? "none"}

DEAL SUMMARY (first 800 chars):
${dealText.slice(0, 800)}

AUDIT TASK:
1. Score the vote on four dimensions (0.0–1.0 each):
   - in_character: Does the vote reflect this persona's specific domain and perspective?
   - rule_fidelity: Are all hard rules followed? (1.0 = all rules followed, 0.0 = critical rule violated)
   - evidence_grounding: Is the rationale grounded in evidence from the deal text?
   - confidence_calibration: Is the confidence score appropriate given the evidence quality?

2. Identify any violated hard rules (list rule text, or empty array if none).

3. Determine if the vote should be REVISED (changed=true) — ONLY when a hard rule was violated (e.g., HARD_NO required but SOFT_NO given, or domain boundary crossed). Do NOT revise for stylistic or minor issues.

4. If changed=true, provide the revised vote fields. If changed=false, copy the original vote fields exactly.

5. Write a critique: 1-2 sentences max. Be specific. If no issues, write "Vote is constitutionally aligned."

Return ONLY valid JSON — no markdown, no preamble:
{
  "score_in_character": 0.0-1.0,
  "score_rule_fidelity": 0.0-1.0,
  "score_evidence_grounding": 0.0-1.0,
  "score_confidence_calib": 0.0-1.0,
  "violated_rules": ["rule text if violated"],
  "changed": true|false,
  "critique": "1-2 sentence critique",
  "revised_vote": "${vote.vote}",
  "revised_confidence": ${vote.confidence},
  "revised_rationale": "${vote.rationale.replace(/"/g, '\\"').slice(0, 200)}",
  "revised_terminal_flag": ${vote.terminalFlag ? `"${vote.terminalFlag}"` : "null"}
}`;
}

// ── Run CFA for a single persona ──────────────────────────────────────────────

async function auditPersonaVote(
  vote: PersonaVote,
  constitution: PersonaConstitution,
  dealText: string,
  councilMode: string,
): Promise<CfaPreferenceRecord> {
  const prompt = buildCfaPrompt(vote, constitution, dealText);

  let raw: string;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: "You are the Constitutional Fidelity Auditor. Return only valid JSON." },
        { role: "user" as const, content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cfa_audit_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score_in_character:       { type: "number" },
              score_rule_fidelity:      { type: "number" },
              score_evidence_grounding: { type: "number" },
              score_confidence_calib:   { type: "number" },
              violated_rules:           { type: "array", items: { type: "string" } },
              changed:                  { type: "boolean" },
              critique:                 { type: "string" },
              revised_vote:             { type: "string" },
              revised_confidence:       { type: "number" },
              revised_rationale:        { type: "string" },
              revised_terminal_flag:    { type: ["string", "null"] },
            },
            required: [
              "score_in_character", "score_rule_fidelity", "score_evidence_grounding",
              "score_confidence_calib", "violated_rules", "changed", "critique",
              "revised_vote", "revised_confidence", "revised_rationale", "revised_terminal_flag",
            ],
            additionalProperties: false,
          },
        },
      },
    });
    const msgContent = response?.choices?.[0]?.message?.content;
    raw = typeof msgContent === "string" ? msgContent : JSON.stringify(msgContent ?? {});
  } catch (err) {
    console.warn(`[CFA] LLM call failed for ${vote.personaId}:`, err);
    // Return a neutral pass-through record on failure
    return buildPassthroughRecord(vote, councilMode);
  }

  let parsed: any;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    console.warn(`[CFA] JSON parse failed for ${vote.personaId}`);
    return buildPassthroughRecord(vote, councilMode);
  }

  const sIC  = clamp(parsed.score_in_character       ?? 0.8);
  const sRF  = clamp(parsed.score_rule_fidelity      ?? 0.8);
  const sEG  = clamp(parsed.score_evidence_grounding ?? 0.8);
  const sCC  = clamp(parsed.score_confidence_calib   ?? 0.8);
  const fidelityScore = (sIC + sRF + sEG + sCC) / 4;

  const changed = Boolean(parsed.changed);

  const revisedVote: PersonaVote = changed
    ? {
        ...vote,
        vote:         (parsed.revised_vote ?? vote.vote) as PersonaVote["vote"],
        confidence:   clamp(parsed.revised_confidence ?? vote.confidence),
        rationale:    parsed.revised_rationale ?? vote.rationale,
        terminalFlag: parsed.revised_terminal_flag ?? vote.terminalFlag,
      }
    : { ...vote };

  return {
    personaId:              vote.personaId,
    personaName:            vote.personaName,
    councilMode,
    scoreInCharacter:       sIC,
    scoreRuleFidelity:      sRF,
    scoreEvidenceGrounding: sEG,
    scoreConfidenceCalib:   sCC,
    fidelityScore,
    violatedRules:          Array.isArray(parsed.violated_rules) ? parsed.violated_rules : [],
    changed,
    critique:               (parsed.critique ?? "Vote is constitutionally aligned.").slice(0, 512),
    originalVote:           vote,
    revisedVote,
  };
}

function buildPassthroughRecord(vote: PersonaVote, councilMode: string): CfaPreferenceRecord {
  return {
    personaId:              vote.personaId,
    personaName:            vote.personaName,
    councilMode,
    scoreInCharacter:       0.8,
    scoreRuleFidelity:      0.8,
    scoreEvidenceGrounding: 0.8,
    scoreConfidenceCalib:   0.8,
    fidelityScore:          0.8,
    violatedRules:          [],
    changed:                false,
    critique:               "CFA audit unavailable — passthrough record.",
    originalVote:           vote,
    revisedVote:            { ...vote },
  };
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, Number(v) || 0));
}

// ── Main CFA runner ───────────────────────────────────────────────────────────

export async function runCfa(
  councilResult: CouncilResult,
  dealText: string,
  options: {
    dealId?:  string;
    userId?:  number;
    skipPersist?: boolean; // for tests
  } = {},
): Promise<CfaSessionResult> {
  const startMs = Date.now();
  const sessionId = councilResult.sessionId;
  const councilMode = (councilResult as any).councilMode ?? "gcc";
  const votes = councilResult.votes;
  const constitutions = getConstitutionsForMode(councilMode);

  // Build a map of personaId → constitution for fast lookup
  const constitutionMap = new Map<string, PersonaConstitution>(
    constitutions.map((c) => [c.personaId, c])
  );

  // Run all persona audits in parallel (fire-and-forget per seat, never throws)
  const auditPromises = votes.map(async (vote) => {
    const constitution = constitutionMap.get(vote.personaId);
    if (!constitution) {
      // No constitution defined for this persona — return passthrough
      return buildPassthroughRecord(vote, councilMode);
    }
    return auditPersonaVote(vote, constitution, dealText, councilMode);
  });

  const preferenceRecords = await Promise.all(auditPromises);

  const totalChanged = preferenceRecords.filter((r) => r.changed).length;
  const averageFidelityScore =
    preferenceRecords.reduce((sum, r) => sum + r.fidelityScore, 0) /
    Math.max(preferenceRecords.length, 1);

  const result: CfaSessionResult = {
    sessionId,
    councilMode,
    averageFidelityScore,
    totalPersonasAudited: preferenceRecords.length,
    totalChanged,
    preferenceRecords,
    durationMs: Date.now() - startMs,
  };

  // Persist to DB (fire-and-forget, never throws)
  if (!options.skipPersist) {
    persistCfaSession(result, options).catch((err) =>
      console.warn("[CFA] Persistence failed (non-fatal):", err)
    );
  }

  return result;
}

// ── DB Persistence ────────────────────────────────────────────────────────────

async function persistCfaSession(
  result: CfaSessionResult,
  options: { dealId?: string; userId?: number },
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Insert session record
  const [sessionRow] = await db.insert(cfaSessions).values({
    sessionId:             result.sessionId,
    dealId:                options.dealId ?? null,
    userId:                options.userId ?? null,
    councilMode:           result.councilMode,
    averageFidelityScore:  result.averageFidelityScore.toFixed(4),
    totalPersonasAudited:  result.totalPersonasAudited,
    totalChanged:          result.totalChanged,
    preferenceRecordsJson: JSON.stringify(result.preferenceRecords),
    status:                "completed",
    durationMs:            result.durationMs,
  }).$returningId();

  const cfaSessionId = (sessionRow as any)?.id ?? 0;

  // Insert per-persona preference records
  if (result.preferenceRecords.length > 0) {
    await db.insert(cfaPreferenceRecords).values(
      result.preferenceRecords.map((r) => ({
        cfaSessionId,
        sessionId:              result.sessionId,
        personaId:              r.personaId,
        personaName:            r.personaName,
        councilMode:            r.councilMode,
        scoreInCharacter:       r.scoreInCharacter.toFixed(3),
        scoreRuleFidelity:      r.scoreRuleFidelity.toFixed(3),
        scoreEvidenceGrounding: r.scoreEvidenceGrounding.toFixed(3),
        scoreConfidenceCalib:   r.scoreConfidenceCalib.toFixed(3),
        fidelityScore:          r.fidelityScore.toFixed(3),
        violatedRulesJson:      JSON.stringify(r.violatedRules),
        changed:                r.changed ? 1 : 0,
        critique:               r.critique,
        originalVoteJson:       JSON.stringify(r.originalVote),
        revisedVoteJson:        JSON.stringify(r.revisedVote),
      }))
    );
  }

  console.log(
    `[CFA] Session ${result.sessionId.slice(0, 8)} persisted — ` +
    `avg fidelity: ${(result.averageFidelityScore * 100).toFixed(1)}%, ` +
    `changed: ${result.totalChanged}/${result.totalPersonasAudited}`
  );
}
