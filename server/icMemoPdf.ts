/**
 * icMemoPdf.ts — Full Institutional IC Memo Generator
 *
 * Produces a 30–40 page Investment Committee memo from Council of 10 output.
 * Structured as a top-tier PE/VC IC memo with 15 sections:
 * 1. Executive Summary
 * 2. Deal Overview
 * 3. Transaction Structure
 * 4. Investment Thesis
 * 5. Market Analysis
 * 6. Competitive Landscape
 * 7. Business Model & Unit Economics
 * 8. Historical Financials
 * 9. Financial Model (Revenue, EBITDA, IRR, Sensitivity)
 * 10. Risk Analysis (Risk Matrix)
 * 11. Mitigants & Conditions
 * 12. Exit Strategy
 * 13. Management Assessment
 * 14. Key Deal Terms & Negotiation Points
 * 15. Appendix
 */

import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PersonaVoteInput {
  personaId:   string;
  personaName: string;
  personaRole: string;
  vote:        string;
  confidence:  number;
  rationale:   string;
  keyFlags:    string[];
  conditions:  string[];
  blockers:    string[];
}

export interface ICMemoInput {
  dealName:            string;
  verdict:             string;
  yesCount:            number;
  noCount:             number;
  confidenceScore:     number;
  conditionsToProceed: string[];
  blockingIssues:      string[];
  votes:               PersonaVoteInput[];
}

interface FinancialRow {
  label: string;
  values: string[];
}

interface RiskRow {
  category: string;
  risk: string;
  likelihood: string;
  impact: string;
  mitigant: string;
}

interface CompRow {
  company: string;
  evEbitda: string;
  evRevenue: string;
  revenueGrowth: string;
  ebitdaMargin: string;
  notes: string;
}

interface ExitRow {
  path: string;
  timing: string;
  evRange: string;
  moic: string;
  irr: string;
  notes: string;
}

interface FullICMemoContent {
  // Section 1
  executiveSummary: {
    theBet: string;
    verdict: string;
    consensusSummary: string;
    keyStrengths: string[];
    keyRisks: string[];
    recommendation: string;
    dealSnapshot: Array<{ label: string; value: string }>;
  };
  // Section 2
  dealOverview: {
    narrative: string;
    keyFacts: Array<{ label: string; value: string }>;
    businessDescription: string;
    geographicPresence: string;
    productServiceOverview: string;
  };
  // Section 3
  transactionStructure: {
    narrative: string;
    sourcesUses: { sources: Array<{ item: string; amount: string; pct: string }>; uses: Array<{ item: string; amount: string; pct: string }> };
    ownershipStructure: string;
    entryTerms: string;
    keyStructuralFeatures: string[];
  };
  // Section 4
  investmentThesis: {
    overarchingThesis: string;
    pillars: Array<{ title: string; narrative: string; supportingData: string }>;
    nonObviousInsight: string;
  };
  // Section 5
  marketAnalysis: {
    marketOverview: string;
    marketSizeData: Array<{ metric: string; value: string; source: string }>;
    growthDrivers: string[];
    tailwinds: string[];
    headwinds: string[];
    marketNarrative: string;
  };
  // Section 6
  competitiveLandscape: {
    narrative: string;
    competitors: CompRow[];
    competitivePositioning: string;
    moat: string;
  };
  // Section 7
  businessModel: {
    revenueModel: string;
    unitEconomics: Array<{ metric: string; value: string; notes: string }>;
    outletEconomics: string;
    scalabilityNarrative: string;
  };
  // Section 8
  historicalFinancials: {
    narrative: string;
    years: string[];
    rows: FinancialRow[];
    keyTrends: string[];
  };
  // Section 9
  financialModel: {
    assumptions: Array<{ assumption: string; value: string; rationale: string }>;
    revenueProjections: { years: string[]; rows: FinancialRow[] };
    ebitdaBridge: Array<{ item: string; amount: string; notes: string }>;
    irrScenarios: Array<{ scenario: string; entryEv: string; exitEv: string; moic: string; irr: string; exitYear: string }>;
    sensitivityTable: { rowLabel: string; colLabel: string; rows: Array<{ label: string; values: string[] }> };
  };
  // Section 10
  riskAnalysis: {
    narrative: string;
    riskMatrix: RiskRow[];
  };
  // Section 11
  mitigantsConditions: {
    narrative: string;
    conditions: Array<{ condition: string; owner: string; timeline: string; consequence: string }>;
    mitigants: Array<{ risk: string; mitigant: string; residualRisk: string }>;
  };
  // Section 12
  exitStrategy: {
    narrative: string;
    exitPaths: ExitRow[];
    comparableTransactions: Array<{ target: string; acquirer: string; year: string; ev: string; evEbitda: string; notes: string }>;
    preferredPath: string;
  };
  // Section 13
  managementAssessment: {
    narrative: string;
    teamStrengths: string[];
    teamGaps: string[];
    keyPersonRisk: string;
    recommendation: string;
  };
  // Section 14
  dealTerms: {
    narrative: string;
    keyTerms: Array<{ term: string; proposed: string; marketStandard: string; negotiationNote: string }>;
    redLines: string[];
    preferredOutcome: string;
  };
  // Section 15
  appendix: {
    comparableTransactionsTable: Array<{ deal: string; year: string; sector: string; ev: string; multiple: string }>;
    marketDataSources: Array<{ source: string; dataPoint: string; relevance: string }>;
    keyAssumptions: Array<{ assumption: string; base: string; bear: string; bull: string }>;
  };
}

// ── LLM synthesis ─────────────────────────────────────────────────────────────
async function synthesiseFullICMemo(input: ICMemoInput): Promise<FullICMemoContent> {
  const votesSummary = input.votes.map(v =>
    `[${v.vote} | ${Math.round(v.confidence * 100)}% conf] ${v.personaRole}:\n  Rationale: ${v.rationale}` +
    (v.keyFlags.length ? `\n  Flags: ${v.keyFlags.join("; ")}` : "") +
    (v.conditions.length ? `\n  Conditions: ${v.conditions.join("; ")}` : "") +
    (v.blockers.length ? `\n  Blockers: ${v.blockers.join("; ")}` : "")
  ).join("\n\n");

  const verdictLabel =
    input.verdict === "APPROVED" ? "Approve" :
    input.verdict === "APPROVED_WITH_CONDITIONS" ? "Conditional Approve" :
    input.verdict === "VETOED" ? "Reject (Veto)" : "Reject";

  const prompt = `You are a Managing Director at a top-tier Middle East private equity firm writing a full institutional Investment Committee memo.

DEAL: ${input.dealName}
COUNCIL VERDICT: ${verdictLabel} (${input.yesCount} Yes / ${input.noCount} No, ${Math.round(input.confidenceScore * 100)}% consensus)

CONDITIONS TO PROCEED:
${input.conditionsToProceed.join("\n")}

BLOCKING ISSUES:
${input.blockingIssues.join("\n")}

COUNCIL OF 10 — FULL VOTE ANALYSIS:
${votesSummary}

TASK: Convert the above council analysis into a FULL institutional IC memo (equivalent to 30–40 pages). This is NOT a summary — it is a complete, standalone investment committee document that a senior partner would present to an investment committee.

CRITICAL RULES:
- Every section must have substantive narrative prose (3–8 sentences minimum per paragraph)
- All financial data must be internally consistent — if you assume $X revenue, use that throughout
- Tables must have real, plausible numbers derived from the deal context
- Do NOT use placeholder text like "[X]" or "TBD" — make reasonable assumptions and state them
- Write as a senior PE professional, not an AI — opinionated, specific, data-driven
- Extract deal context from the council rationales to infer the industry, geography, and business type
- If the deal is in F&B/QSR in Kuwait/GCC, use Kuwait/GCC market data
- All currency in KWD unless otherwise specified

Return ONLY a valid JSON object with this EXACT structure (no markdown, no explanation):

{
  "executiveSummary": {
    "theBet": "single sentence — the one thing that must be true for this to be a great investment",
    "verdict": "Approve | Conditional Approve | Reject",
    "consensusSummary": "2–3 sentence narrative of the council consensus and key debate",
    "keyStrengths": ["strength 1 — specific and data-referenced", "strength 2", "strength 3", "strength 4"],
    "keyRisks": ["risk 1 — specific", "risk 2", "risk 3"],
    "recommendation": "2–3 sentence recommendation with specific conditions",
    "dealSnapshot": [
      {"label": "Deal Type", "value": "..."},
      {"label": "Sector", "value": "..."},
      {"label": "Geography", "value": "..."},
      {"label": "Entry EV", "value": "KWD Xm"},
      {"label": "Entry EV/EBITDA", "value": "Xx"},
      {"label": "Equity Cheque", "value": "KWD Xm"},
      {"label": "Target IRR", "value": "X%"},
      {"label": "Target MOIC", "value": "Xx"},
      {"label": "Hold Period", "value": "X years"},
      {"label": "Council Vote", "value": "${input.yesCount}/10 Yes"}
    ]
  },
  "dealOverview": {
    "narrative": "3–4 sentence overview of the business, its history, and why it is being considered",
    "keyFacts": [
      {"label": "Founded", "value": "..."},
      {"label": "Headquarters", "value": "..."},
      {"label": "Outlets", "value": "..."},
      {"label": "Employees", "value": "..."},
      {"label": "Revenue (LTM)", "value": "KWD Xm"},
      {"label": "EBITDA (LTM)", "value": "KWD Xm"},
      {"label": "EBITDA Margin", "value": "X%"},
      {"label": "Ownership", "value": "..."}
    ],
    "businessDescription": "3–5 sentence description of the business model, operations, and value proposition",
    "geographicPresence": "2–3 sentences on geographic footprint and expansion plans",
    "productServiceOverview": "2–3 sentences on product/service mix and key revenue streams"
  },
  "transactionStructure": {
    "narrative": "3–4 sentences on the transaction structure, rationale, and key terms",
    "sourcesUses": {
      "sources": [
        {"item": "Equity (Fund)", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Senior Debt", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Seller Rollover", "amount": "KWD Xm", "pct": "X%"}
      ],
      "uses": [
        {"item": "Acquisition Price", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Transaction Costs", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Working Capital", "amount": "KWD Xm", "pct": "X%"}
      ]
    },
    "ownershipStructure": "2–3 sentences on post-transaction ownership and governance",
    "entryTerms": "2–3 sentences on entry valuation, multiples, and pricing rationale",
    "keyStructuralFeatures": ["feature 1", "feature 2", "feature 3", "feature 4"]
  },
  "investmentThesis": {
    "overarchingThesis": "3–4 sentence overarching thesis — the non-obvious reason this could be a large outcome",
    "pillars": [
      {"title": "Pillar 1 title", "narrative": "3–4 sentence narrative with specific data points and market evidence", "supportingData": "specific metric or data point"},
      {"title": "Pillar 2 title", "narrative": "3–4 sentence narrative", "supportingData": "specific metric"},
      {"title": "Pillar 3 title", "narrative": "3–4 sentence narrative", "supportingData": "specific metric"},
      {"title": "Pillar 4 title", "narrative": "3–4 sentence narrative", "supportingData": "specific metric"}
    ],
    "nonObviousInsight": "2–3 sentences on the non-consensus view that underpins the investment case"
  },
  "marketAnalysis": {
    "marketOverview": "4–5 sentence overview of the market, its size, and dynamics",
    "marketSizeData": [
      {"metric": "Kuwait F&B Market Size", "value": "KWD Xm (20XX)", "source": "Euromonitor / BMI Research"},
      {"metric": "QSR Segment Share", "value": "X%", "source": "Industry estimate"},
      {"metric": "Market CAGR (20XX–20XX)", "value": "X%", "source": "BMI Research"},
      {"metric": "GCC F&B Market Size", "value": "USD Xbn", "source": "Euromonitor"},
      {"metric": "Kuwait GDP per Capita", "value": "USD X,XXX", "source": "World Bank 20XX"},
      {"metric": "Kuwait Eating-Out Frequency", "value": "X times/week", "source": "Industry survey"}
    ],
    "growthDrivers": ["driver 1 — specific", "driver 2", "driver 3", "driver 4", "driver 5"],
    "tailwinds": ["tailwind 1", "tailwind 2", "tailwind 3"],
    "headwinds": ["headwind 1", "headwind 2", "headwind 3"],
    "marketNarrative": "4–5 sentence narrative synthesising market dynamics and the opportunity"
  },
  "competitiveLandscape": {
    "narrative": "3–4 sentence overview of the competitive environment",
    "competitors": [
      {"company": "Americana Restaurants", "evEbitda": "12–14x", "evRevenue": "1.8–2.2x", "revenueGrowth": "8–10%", "ebitdaMargin": "14–16%", "notes": "Listed; KFC/Pizza Hut franchisee; GCC-wide"},
      {"company": "Kout Food Group", "evEbitda": "10–12x", "evRevenue": "1.5–1.8x", "revenueGrowth": "6–8%", "ebitdaMargin": "12–14%", "notes": "Kuwait-based; Burger King/Pizza Hut"},
      {"company": "Alshaya Group (F&B)", "evEbitda": "11–13x", "evRevenue": "1.6–2.0x", "revenueGrowth": "7–9%", "ebitdaMargin": "13–15%", "notes": "Private; Starbucks/Cheesecake Factory"},
      {"company": "Target Company", "evEbitda": "Xx (entry)", "evRevenue": "Xx", "revenueGrowth": "X%", "ebitdaMargin": "X%", "notes": "Entry valuation vs. peers"}
    ],
    "competitivePositioning": "3–4 sentences on how the target company is positioned vs. peers",
    "moat": "2–3 sentences on the company's sustainable competitive advantage"
  },
  "businessModel": {
    "revenueModel": "3–4 sentences on how the business generates revenue",
    "unitEconomics": [
      {"metric": "Average Revenue per Outlet (annual)", "value": "KWD Xm", "notes": "Based on LTM revenue / outlet count"},
      {"metric": "Average EBITDA per Outlet", "value": "KWD Xk", "notes": "X% outlet-level margin"},
      {"metric": "Outlet Capex (new build)", "value": "KWD Xk", "notes": "Includes fit-out and equipment"},
      {"metric": "Payback Period", "value": "X.X years", "notes": "Based on outlet-level EBITDA"},
      {"metric": "Average Check Size", "value": "KWD X.X", "notes": "Per customer transaction"},
      {"metric": "Daily Covers per Outlet", "value": "XXX–XXX", "notes": "Estimated from revenue build"},
      {"metric": "Occupancy Cost / Revenue", "value": "X%", "notes": "Rent as % of outlet revenue"}
    ],
    "outletEconomics": "3–4 sentences on outlet-level P&L and key value drivers",
    "scalabilityNarrative": "3–4 sentences on the scalability of the model and expansion economics"
  },
  "historicalFinancials": {
    "narrative": "3–4 sentences on historical financial performance and key trends",
    "years": ["FY20XX-2", "FY20XX-1", "FY20XX (LTM)"],
    "rows": [
      {"label": "Revenue (KWD m)", "values": ["X.X", "X.X", "X.X"]},
      {"label": "Revenue Growth (%)", "values": ["—", "X%", "X%"]},
      {"label": "Gross Profit (KWD m)", "values": ["X.X", "X.X", "X.X"]},
      {"label": "Gross Margin (%)", "values": ["X%", "X%", "X%"]},
      {"label": "EBITDA (KWD m)", "values": ["X.X", "X.X", "X.X"]},
      {"label": "EBITDA Margin (%)", "values": ["X%", "X%", "X%"]},
      {"label": "EBIT (KWD m)", "values": ["X.X", "X.X", "X.X"]},
      {"label": "Net Income (KWD m)", "values": ["X.X", "X.X", "X.X"]},
      {"label": "Capex (KWD m)", "values": ["X.X", "X.X", "X.X"]},
      {"label": "Free Cash Flow (KWD m)", "values": ["X.X", "X.X", "X.X"]}
    ],
    "keyTrends": ["trend 1 — specific with numbers", "trend 2", "trend 3", "trend 4"]
  },
  "financialModel": {
    "assumptions": [
      {"assumption": "Revenue CAGR (Base)", "value": "X%", "rationale": "Based on outlet expansion and SSSG"},
      {"assumption": "New Outlets per Year", "value": "X–X", "rationale": "Management guidance; market capacity"},
      {"assumption": "Same-Store Sales Growth", "value": "X%", "rationale": "Inflation + volume; GCC QSR benchmark"},
      {"assumption": "EBITDA Margin (Exit)", "value": "X%", "rationale": "Operational leverage on fixed cost base"},
      {"assumption": "Exit EV/EBITDA", "value": "Xx", "rationale": "In-line with listed GCC F&B peers"},
      {"assumption": "Debt / EBITDA at Entry", "value": "Xx", "rationale": "Conservative leverage; GCC bank appetite"},
      {"assumption": "Interest Rate", "value": "X%", "rationale": "KWD-denominated senior facility"},
      {"assumption": "Hold Period", "value": "X years", "rationale": "Fund lifecycle; exit window"}
    ],
    "revenueProjections": {
      "years": ["FY1", "FY2", "FY3", "FY4", "FY5"],
      "rows": [
        {"label": "Revenue (KWD m)", "values": ["X.X", "X.X", "X.X", "X.X", "X.X"]},
        {"label": "Revenue Growth (%)", "values": ["X%", "X%", "X%", "X%", "X%"]},
        {"label": "EBITDA (KWD m)", "values": ["X.X", "X.X", "X.X", "X.X", "X.X"]},
        {"label": "EBITDA Margin (%)", "values": ["X%", "X%", "X%", "X%", "X%"]},
        {"label": "Capex (KWD m)", "values": ["X.X", "X.X", "X.X", "X.X", "X.X"]},
        {"label": "Free Cash Flow (KWD m)", "values": ["X.X", "X.X", "X.X", "X.X", "X.X"]},
        {"label": "Net Debt (KWD m)", "values": ["X.X", "X.X", "X.X", "X.X", "X.X"]},
        {"label": "Outlet Count", "values": ["XX", "XX", "XX", "XX", "XX"]}
      ]
    },
    "ebitdaBridge": [
      {"item": "Entry EBITDA", "amount": "KWD X.Xm", "notes": "LTM EBITDA at acquisition"},
      {"item": "+ New Outlet Contribution", "amount": "+ KWD X.Xm", "notes": "X new outlets × KWD Xk avg EBITDA"},
      {"item": "+ Same-Store Growth", "amount": "+ KWD X.Xm", "notes": "X% SSSG on existing base"},
      {"item": "+ Margin Improvement", "amount": "+ KWD X.Xm", "notes": "Procurement savings; labour efficiency"},
      {"item": "– Cost Inflation", "amount": "– KWD X.Xm", "notes": "Food cost inflation; wage pressure"},
      {"item": "Exit EBITDA", "amount": "KWD X.Xm", "notes": "Year X EBITDA; X% CAGR from entry"}
    ],
    "irrScenarios": [
      {"scenario": "Bull Case", "entryEv": "KWD Xm", "exitEv": "KWD Xm", "moic": "X.Xx", "irr": "X%", "exitYear": "Year X"},
      {"scenario": "Base Case", "entryEv": "KWD Xm", "exitEv": "KWD Xm", "moic": "X.Xx", "irr": "X%", "exitYear": "Year X"},
      {"scenario": "Bear Case", "entryEv": "KWD Xm", "exitEv": "KWD Xm", "moic": "X.Xx", "irr": "X%", "exitYear": "Year X"},
      {"scenario": "Stress Case", "entryEv": "KWD Xm", "exitEv": "KWD Xm", "moic": "X.Xx", "irr": "X%", "exitYear": "Year X"}
    ],
    "sensitivityTable": {
      "rowLabel": "Exit EV/EBITDA",
      "colLabel": "Revenue CAGR",
      "rows": [
        {"label": "8x", "values": ["X%", "X%", "X%", "X%", "X%"]},
        {"label": "10x", "values": ["X%", "X%", "X%", "X%", "X%"]},
        {"label": "12x", "values": ["X%", "X%", "X%", "X%", "X%"]},
        {"label": "14x", "values": ["X%", "X%", "X%", "X%", "X%"]},
        {"label": "16x", "values": ["X%", "X%", "X%", "X%", "X%"]}
      ]
    }
  },
  "riskAnalysis": {
    "narrative": "3–4 sentences on the overall risk profile and key risk themes",
    "riskMatrix": [
      {"category": "Market", "risk": "specific risk description", "likelihood": "High | Medium | Low", "impact": "High | Medium | Low", "mitigant": "specific mitigant"},
      {"category": "Operational", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."},
      {"category": "Financial", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."},
      {"category": "Regulatory", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."},
      {"category": "Execution", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."},
      {"category": "ESG / Shariah", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."},
      {"category": "Macro", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."},
      {"category": "Exit", "risk": "specific risk", "likelihood": "...", "impact": "...", "mitigant": "..."}
    ]
  },
  "mitigantsConditions": {
    "narrative": "3–4 sentences on the conditions framework and how they protect the fund",
    "conditions": [
      {"condition": "specific condition from council", "owner": "Management | Fund | Advisor", "timeline": "Pre-close | 90 days | 6 months", "consequence": "what happens if not met"},
      {"condition": "...", "owner": "...", "timeline": "...", "consequence": "..."},
      {"condition": "...", "owner": "...", "timeline": "...", "consequence": "..."},
      {"condition": "...", "owner": "...", "timeline": "...", "consequence": "..."}
    ],
    "mitigants": [
      {"risk": "specific risk", "mitigant": "specific structural or contractual mitigant", "residualRisk": "Low | Medium"},
      {"risk": "...", "mitigant": "...", "residualRisk": "..."},
      {"risk": "...", "mitigant": "...", "residualRisk": "..."},
      {"risk": "...", "mitigant": "...", "residualRisk": "..."}
    ]
  },
  "exitStrategy": {
    "narrative": "3–4 sentences on the exit strategy and preferred path",
    "exitPaths": [
      {"path": "Strategic Sale — GCC F&B conglomerate", "timing": "Year 4–5", "evRange": "KWD Xm–Xm", "moic": "X.Xx", "irr": "X%", "notes": "Americana / Kout as natural acquirers; precedent transactions support Xx EV/EBITDA"},
      {"path": "Secondary PE Sale", "timing": "Year 3–4", "evRange": "KWD Xm–Xm", "moic": "X.Xx", "irr": "X%", "notes": "Regional PE appetite for scaled F&B platforms"},
      {"path": "Kuwait Boursa IPO", "timing": "Year 5–6", "evRange": "KWD Xm–Xm", "moic": "X.Xx", "irr": "X%", "notes": "Requires KWD Xm+ EBITDA; market conditions dependent"}
    ],
    "comparableTransactions": [
      {"target": "comparable company", "acquirer": "acquirer name", "year": "20XX", "ev": "USD Xm", "evEbitda": "Xx", "notes": "brief context"},
      {"target": "...", "acquirer": "...", "year": "...", "ev": "...", "evEbitda": "...", "notes": "..."},
      {"target": "...", "acquirer": "...", "year": "...", "ev": "...", "evEbitda": "...", "notes": "..."},
      {"target": "...", "acquirer": "...", "year": "...", "ev": "...", "evEbitda": "...", "notes": "..."}
    ],
    "preferredPath": "2–3 sentences on the preferred exit path and why"
  },
  "managementAssessment": {
    "narrative": "3–4 sentences on the management team and their track record",
    "teamStrengths": ["strength 1 — specific", "strength 2", "strength 3"],
    "teamGaps": ["gap 1 — specific with proposed solution", "gap 2", "gap 3"],
    "keyPersonRisk": "2–3 sentences on key person dependency and mitigation",
    "recommendation": "2–3 sentences on management retention, incentivisation, and any required hires"
  },
  "dealTerms": {
    "narrative": "3–4 sentences on the deal terms and negotiation context",
    "keyTerms": [
      {"term": "Entry Valuation", "proposed": "Xx EV/EBITDA", "marketStandard": "Xx–Xx EV/EBITDA", "negotiationNote": "specific negotiation point"},
      {"term": "Equity Stake", "proposed": "X%", "marketStandard": "Majority / Minority", "negotiationNote": "..."},
      {"term": "Board Representation", "proposed": "X/X seats", "marketStandard": "Pro-rata", "negotiationNote": "..."},
      {"term": "Anti-dilution", "proposed": "Full ratchet / Weighted avg", "marketStandard": "Weighted avg", "negotiationNote": "..."},
      {"term": "Drag / Tag Along", "proposed": "Standard", "marketStandard": "Standard", "negotiationNote": "..."},
      {"term": "Earn-out", "proposed": "X% of equity; X-year", "marketStandard": "Varies", "negotiationNote": "..."},
      {"term": "Exclusivity", "proposed": "X weeks", "marketStandard": "4–6 weeks", "negotiationNote": "..."}
    ],
    "redLines": ["red line 1 — specific", "red line 2", "red line 3"],
    "preferredOutcome": "2–3 sentences on the preferred deal structure and walk-away conditions"
  },
  "appendix": {
    "comparableTransactionsTable": [
      {"deal": "deal name", "year": "20XX", "sector": "QSR / F&B", "ev": "USD Xm", "multiple": "Xx EV/EBITDA"},
      {"deal": "...", "year": "...", "sector": "...", "ev": "...", "multiple": "..."},
      {"deal": "...", "year": "...", "sector": "...", "ev": "...", "multiple": "..."},
      {"deal": "...", "year": "...", "sector": "...", "ev": "...", "multiple": "..."},
      {"deal": "...", "year": "...", "sector": "...", "ev": "...", "multiple": "..."}
    ],
    "marketDataSources": [
      {"source": "Euromonitor International", "dataPoint": "Kuwait F&B market size and growth", "relevance": "Market sizing and CAGR validation"},
      {"source": "BMI Research / Fitch Solutions", "dataPoint": "GCC consumer spending trends", "relevance": "Macro tailwind validation"},
      {"source": "Kuwait CMA filings", "dataPoint": "Listed F&B company financials", "relevance": "Comparable company benchmarking"},
      {"source": "World Bank", "dataPoint": "Kuwait GDP per capita and demographics", "relevance": "Consumer spending capacity"}
    ],
    "keyAssumptions": [
      {"assumption": "Revenue CAGR", "base": "X%", "bear": "X%", "bull": "X%"},
      {"assumption": "Exit EV/EBITDA", "base": "Xx", "bear": "Xx", "bull": "Xx"},
      {"assumption": "EBITDA Margin at Exit", "base": "X%", "bear": "X%", "bull": "X%"},
      {"assumption": "New Outlets / Year", "base": "X", "bear": "X", "bull": "X"},
      {"assumption": "SSSG", "base": "X%", "bear": "X%", "bull": "X%"}
    ]
  }
}

IMPORTANT: Replace ALL placeholder "X" values with real, plausible, internally-consistent numbers derived from the deal context in the council votes. Make reasonable assumptions where data is not provided and state them clearly. The memo must read as if written by a senior PE professional with deep knowledge of the deal.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a Managing Director at a top-tier Middle East private equity firm. You write institutional-grade IC memos with real numbers, specific analysis, and opinionated recommendations. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const rawContent = response.choices?.[0]?.message?.content ?? "{}";
  const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  try {
    return JSON.parse(raw) as FullICMemoContent;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as FullICMemoContent;
    throw new Error("Failed to parse full IC memo JSON from LLM response");
  }
}

// ── PDF Generator ─────────────────────────────────────────────────────────────
export async function generateICMemoPdf(input: ICMemoInput): Promise<Buffer> {
  const memo = await synthesiseFullICMemo(input);
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    // ── Design tokens ─────────────────────────────────────────────────────────
    const BG       = "#070B12";
    const BG2      = "#0D1421";
    const BG3      = "#111827";
    const BORDER_C = "#1E2D3D";
    const ACCENT   = "#4A9EFF";
    const GREEN    = "#00D97E";
    const AMBER    = "#F59E0B";
    const RED      = "#EF4444";
    const WHITE    = "#E2E8F0";
    const MUTED    = "#64748B";
    const GOLD     = "#D4AF37";
    const PURPLE   = "#A855F7";

    const A4_W   = 595.28;
    const A4_H   = 841.89;
    const ML     = 48;
    const MR     = 48;
    const BODY_W = A4_W - ML - MR;

    const verdictColor =
      input.verdict === "APPROVED" ? GREEN :
      input.verdict === "APPROVED_WITH_CONDITIONS" ? ACCENT : RED;

    const verdictLabel =
      input.verdict === "APPROVED" ? "APPROVE" :
      input.verdict === "APPROVED_WITH_CONDITIONS" ? "CONDITIONAL APPROVE" :
      input.verdict === "VETOED" ? "REJECT (VETO)" : "REJECT";

    const doc = new PDFDocument({
      size: "A4",
      autoFirstPage: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `IC Memo — ${input.dealName}`,
        Author: "AgenThinkMesh · Council of 10",
        Subject: "Investment Committee Memo",
        Keywords: "VC, IC Memo, Investment Committee, Private Equity",
      },
    });

    doc.on("pageAdded", () => {
      doc.rect(0, 0, A4_W, A4_H).fill(BG);
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function ensureSpace(needed: number) {
      if (doc.y + needed > A4_H - 70) {
        doc.addPage();
        doc.y = 56;
      }
    }

    function pageHeader(sectionLabel?: string) {
      doc.rect(0, 0, A4_W, 36).fill(BG2);
      doc.rect(0, 36, A4_W, 0.5).fill(GOLD);
      doc.fontSize(6.5).fillColor(GOLD).font("Helvetica-Bold")
        .text("AGENTHINK MESH", ML, 11, { continued: false });
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
        .text("COUNCIL OF 10 · INVESTMENT COMMITTEE MEMO", ML + 90, 11);
      if (sectionLabel) {
        doc.fontSize(6.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(sectionLabel.toUpperCase(), A4_W - MR - 120, 11, { width: 120, align: "right" });
      } else {
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
          .text(dateStr, A4_W - MR - 60, 11, { width: 60, align: "right" });
      }
    }

    function pageFooter(pageNum: number) {
      doc.rect(0, A4_H - 26, A4_W, 0.5).fill(BG3);
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text("CONFIDENTIAL — For Authorised Investment Committee Members Only. AI-assisted analysis. Not investment advice.", ML, A4_H - 17, { width: BODY_W - 40 });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(`${pageNum}`, A4_W - MR - 16, A4_H - 17, { width: 16, align: "right" });
    }

    function sectionDivider(num: string, title: string, color: string = ACCENT) {
      ensureSpace(44);
      doc.rect(ML, doc.y, BODY_W, 32).fill(BG2);
      doc.rect(ML, doc.y, 3, 32).fill(color);
      const sy = doc.y + 6;
      doc.fontSize(8).fillColor(color).font("Helvetica-Bold")
        .text(num, ML + 10, sy, { continued: false });
      doc.fontSize(12).fillColor(WHITE).font("Helvetica-Bold")
        .text(title, ML + 28, sy - 1, { continued: false });
      doc.y += 40;
    }

    function subHeading(title: string, color: string = ACCENT) {
      ensureSpace(22);
      doc.rect(ML, doc.y, BODY_W, 0.5).fill(BORDER_C);
      doc.y += 5;
      doc.fontSize(8).fillColor(color).font("Helvetica-Bold")
        .text(title.toUpperCase(), ML, doc.y, { characterSpacing: 1 });
      doc.y += 14;
    }

    function bodyText(text: string, color: string = WHITE) {
      if (!text) return;
      ensureSpace(20);
      doc.fontSize(9.5).fillColor(color).font("Helvetica")
        .text(text, ML, doc.y, { width: BODY_W, lineGap: 3, align: "justify" });
      doc.y += 10;
    }

    function bullet(text: string, color: string = WHITE, indent: number = 0) {
      if (!text) return;
      ensureSpace(20);
      const x = ML + indent;
      const w = BODY_W - indent;
      doc.circle(x + 4, doc.y + 5.5, 2).fill(color);
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(text, x + 13, doc.y, { width: w - 13, lineGap: 2 });
      doc.y += 5;
    }

    function kv(label: string, value: string, labelColor: string = MUTED, valueColor: string = WHITE) {
      ensureSpace(16);
      doc.fontSize(7.5).fillColor(labelColor).font("Helvetica-Bold")
        .text(label.toUpperCase() + "  ", ML, doc.y, { continued: true, characterSpacing: 0.4 });
      doc.fontSize(9).fillColor(valueColor).font("Helvetica")
        .text(value, { continued: false });
      doc.y += 3;
    }

    // Two-column key-value grid
    function kvGrid(items: Array<{ label: string; value: string }>, colCount: number = 2) {
      const colW = BODY_W / colCount;
      let col = 0;
      let rowStartY = doc.y;
      items.forEach((item, i) => {
        const x = ML + col * colW;
        ensureSpace(32);
        if (col === 0 && i > 0) rowStartY = doc.y;
        doc.rect(x, rowStartY, colW - 4, 28).fill(BG2);
        doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
          .text(item.label.toUpperCase(), x + 8, rowStartY + 5, { width: colW - 20, characterSpacing: 0.3 });
        doc.fontSize(10).fillColor(WHITE).font("Helvetica-Bold")
          .text(item.value, x + 8, rowStartY + 15, { width: colW - 20 });
        col++;
        if (col >= colCount) {
          col = 0;
          doc.y = rowStartY + 32;
          rowStartY = doc.y;
        }
      });
      if (col > 0) doc.y = rowStartY + 32;
      doc.y += 6;
    }

    // Generic table
    function table(headers: string[], rows: string[][], colWidths?: number[], headerColor: string = ACCENT) {
      const totalW = BODY_W;
      const numCols = headers.length;
      const cw = colWidths ?? headers.map(() => totalW / numCols);

      ensureSpace(28);
      // Header row
      doc.rect(ML, doc.y, totalW, 20).fill(BG3);
      let cx = ML;
      headers.forEach((h, i) => {
        doc.fontSize(7.5).fillColor(headerColor).font("Helvetica-Bold")
          .text(h, cx + 5, doc.y + 6, { width: cw[i] - 10, lineBreak: false });
        cx += cw[i];
      });
      doc.y += 22;

      rows.forEach((row, ri) => {
        // Estimate row height
        const maxLines = Math.max(...row.map((cell, ci) => Math.ceil((cell ?? "").length / Math.max(1, (cw[ci] - 10) / 6))));
        const rowH = Math.max(18, maxLines * 12 + 6);
        ensureSpace(rowH + 4);
        if (ri % 2 === 0) doc.rect(ML, doc.y, totalW, rowH).fill(BG2);
        cx = ML;
        row.forEach((cell, ci) => {
          doc.fontSize(8.5).fillColor(WHITE).font("Helvetica")
            .text(cell ?? "", cx + 5, doc.y + 5, { width: cw[ci] - 10, lineGap: 1 });
          cx += cw[ci];
        });
        doc.y += rowH + 2;
      });
      doc.y += 8;
    }

    // Financial table with highlighted first column
    function financialTable(years: string[], rows: FinancialRow[], accentCol?: number) {
      const labelW = 160;
      const numCols = years.length;
      const colW = (BODY_W - labelW) / numCols;

      ensureSpace(24);
      // Header
      doc.rect(ML, doc.y, BODY_W, 20).fill(BG3);
      doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold")
        .text("", ML + 5, doc.y + 6, { width: labelW - 10 });
      years.forEach((y, i) => {
        const x = ML + labelW + i * colW;
        const isAccent = i === accentCol;
        doc.fontSize(7.5).fillColor(isAccent ? GOLD : ACCENT).font("Helvetica-Bold")
          .text(y, x + 5, doc.y + 6, { width: colW - 10, align: "right" });
      });
      doc.y += 22;

      rows.forEach((row, ri) => {
        const isHighlight = row.label.includes("EBITDA") || row.label.includes("Revenue") || row.label.includes("Free Cash");
        ensureSpace(18);
        if (ri % 2 === 0) doc.rect(ML, doc.y, BODY_W, 16).fill(BG2);
        doc.fontSize(8.5).fillColor(isHighlight ? WHITE : MUTED).font(isHighlight ? "Helvetica-Bold" : "Helvetica")
          .text(row.label, ML + 5, doc.y + 4, { width: labelW - 10 });
        row.values.forEach((val, i) => {
          const x = ML + labelW + i * colW;
          const isAccent = i === accentCol;
          doc.fontSize(8.5).fillColor(isAccent ? GOLD : WHITE).font("Helvetica")
            .text(val ?? "—", x + 5, doc.y + 4, { width: colW - 10, align: "right" });
        });
        doc.y += 18;
      });
      doc.y += 8;
    }

    // Sensitivity table with color coding
    function sensitivityTable(rowLabel: string, colLabel: string, colHeaders: string[], rows: Array<{ label: string; values: string[] }>) {
      const labelW = 60;
      const numCols = colHeaders.length;
      const colW = (BODY_W - labelW) / numCols;

      ensureSpace(30);
      // Corner + headers
      doc.rect(ML, doc.y, BODY_W, 20).fill(BG3);
      doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
        .text(`${rowLabel} ↓ / ${colLabel} →`, ML + 4, doc.y + 6, { width: labelW - 4 });
      colHeaders.forEach((h, i) => {
        doc.fontSize(7.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(h, ML + labelW + i * colW + 4, doc.y + 6, { width: colW - 8, align: "center" });
      });
      doc.y += 22;

      rows.forEach((row) => {
        ensureSpace(18);
        doc.rect(ML, doc.y, labelW, 16).fill(BG3);
        doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold")
          .text(row.label, ML + 4, doc.y + 4, { width: labelW - 8, align: "center" });
        row.values.forEach((val, i) => {
          const numVal = parseFloat(val.replace("%", ""));
          const cellColor =
            numVal >= 25 ? GREEN :
            numVal >= 20 ? "#22C55E" :
            numVal >= 15 ? AMBER :
            numVal >= 10 ? "#F97316" : RED;
          doc.rect(ML + labelW + i * colW, doc.y, colW, 16).fill(`${cellColor}22`);
          doc.fontSize(8.5).fillColor(cellColor).font("Helvetica-Bold")
            .text(val, ML + labelW + i * colW + 4, doc.y + 4, { width: colW - 8, align: "center" });
        });
        doc.y += 18;
      });
      doc.y += 8;
    }

    // Risk matrix row
    function riskRow(row: RiskRow, ri: number) {
      const likelihoodColor = row.likelihood === "High" ? RED : row.likelihood === "Medium" ? AMBER : GREEN;
      const impactColor = row.impact === "High" ? RED : row.impact === "Medium" ? AMBER : GREEN;
      const catW = 80; const riskW = 160; const lhW = 55; const impW = 55; const mitW = BODY_W - catW - riskW - lhW - impW;
      const rowH = Math.max(24, Math.ceil(row.risk.length / 28) * 12 + 8);
      ensureSpace(rowH + 4);
      if (ri % 2 === 0) doc.rect(ML, doc.y, BODY_W, rowH).fill(BG2);
      doc.fontSize(8).fillColor(ACCENT).font("Helvetica-Bold")
        .text(row.category, ML + 4, doc.y + 6, { width: catW - 8 });
      doc.fontSize(8).fillColor(WHITE).font("Helvetica")
        .text(row.risk, ML + catW + 4, doc.y + 6, { width: riskW - 8, lineGap: 1 });
      doc.fontSize(8).fillColor(likelihoodColor).font("Helvetica-Bold")
        .text(row.likelihood, ML + catW + riskW + 4, doc.y + 6, { width: lhW - 8, align: "center" });
      doc.fontSize(8).fillColor(impactColor).font("Helvetica-Bold")
        .text(row.impact, ML + catW + riskW + lhW + 4, doc.y + 6, { width: impW - 8, align: "center" });
      doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
        .text(row.mitigant, ML + catW + riskW + lhW + impW + 4, doc.y + 6, { width: mitW - 8, lineGap: 1 });
      doc.y += rowH + 2;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COVER PAGE
    // ─────────────────────────────────────────────────────────────────────────
    doc.rect(0, 0, A4_W, A4_H).fill(BG);
    // Gold top bar
    doc.rect(0, 0, A4_W, 6).fill(GOLD);
    // Fund header
    doc.rect(0, 6, A4_W, 60).fill(BG2);
    doc.fontSize(9).fillColor(GOLD).font("Helvetica-Bold")
      .text("AGENTHINK MESH", ML, 22, { characterSpacing: 2 });
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text("COUNCIL OF 10 · INVESTMENT COMMITTEE", ML, 35, { characterSpacing: 1 });
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text(dateStr, A4_W - MR - 100, 28, { width: 100, align: "right" });

    // Verdict pill
    doc.rect(ML, 90, BODY_W, 60).fillAndStroke(BG2, BORDER_C);
    doc.fontSize(22).fillColor(verdictColor).font("Helvetica-Bold")
      .text(verdictLabel, ML + 20, 104);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`${input.yesCount} Yes · ${input.noCount} No · ${Math.round(input.confidenceScore * 100)}% Consensus`, ML + 20, 132);

    // Deal name
    doc.fontSize(26).fillColor(WHITE).font("Helvetica-Bold")
      .text(input.dealName, ML, 170, { width: BODY_W });
    doc.y = 210;
    doc.fontSize(11).fillColor(MUTED).font("Helvetica")
      .text("INVESTMENT COMMITTEE MEMORANDUM", ML, doc.y, { characterSpacing: 1.5 });
    doc.y += 16;

    // Thesis line
    if (memo.executiveSummary?.theBet) {
      doc.rect(ML, doc.y, BODY_W, 0.5).fill(BORDER_C);
      doc.y += 10;
      doc.fontSize(12).fillColor(WHITE).font("Helvetica-Oblique")
        .text(`"${memo.executiveSummary.theBet}"`, ML, doc.y, { width: BODY_W, lineGap: 4 });
      doc.y += 24;
    }

    // Deal snapshot grid
    if (memo.executiveSummary?.dealSnapshot?.length) {
      kvGrid(memo.executiveSummary.dealSnapshot, 2);
    }

    // Confidentiality notice
    doc.y = A4_H - 80;
    doc.rect(ML, doc.y, BODY_W, 0.5).fill(BORDER_C);
    doc.y += 8;
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text("CONFIDENTIAL — For Authorised Investment Committee Members Only.", ML, doc.y, { width: BODY_W, align: "center" });
    doc.y += 10;
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
      .text("This document contains AI-assisted analysis generated by AgenThinkMesh Council of 10. It does not constitute investment advice.", ML, doc.y, { width: BODY_W, align: "center" });

    // ─────────────────────────────────────────────────────────────────────────
    // TABLE OF CONTENTS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader();

    doc.fontSize(16).fillColor(WHITE).font("Helvetica-Bold")
      .text("TABLE OF CONTENTS", ML, doc.y);
    doc.y += 20;
    doc.rect(ML, doc.y, BODY_W, 0.5).fill(GOLD);
    doc.y += 14;

    const tocItems = [
      ["1.", "Executive Summary"],
      ["2.", "Deal Overview"],
      ["3.", "Transaction Structure"],
      ["4.", "Investment Thesis"],
      ["5.", "Market Analysis"],
      ["6.", "Competitive Landscape"],
      ["7.", "Business Model & Unit Economics"],
      ["8.", "Historical Financials"],
      ["9.", "Financial Model"],
      ["10.", "Risk Analysis"],
      ["11.", "Mitigants & Conditions"],
      ["12.", "Exit Strategy"],
      ["13.", "Management Assessment"],
      ["14.", "Key Deal Terms & Negotiation Points"],
      ["15.", "Appendix"],
    ];
    tocItems.forEach(([num, title]) => {
      doc.fontSize(10).fillColor(MUTED).font("Helvetica-Bold")
        .text(num, ML, doc.y, { continued: true, width: 30 });
      doc.fontSize(10).fillColor(WHITE).font("Helvetica")
        .text(title, { continued: false });
      doc.rect(ML + 30, doc.y + 2, BODY_W - 30, 0.3).fill(BORDER_C);
      doc.y += 16;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1 — EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("1. Executive Summary");
    sectionDivider("01", "Executive Summary", verdictColor);

    const es = memo.executiveSummary;
    if (es) {
      // Verdict banner
      doc.rect(ML, doc.y, BODY_W, 44).fillAndStroke(`${verdictColor}0d`, `${verdictColor}55`);
      doc.fontSize(14).fillColor(verdictColor).font("Helvetica-Bold")
        .text(verdictLabel, ML + 16, doc.y + 8);
      doc.fontSize(9).fillColor(MUTED).font("Helvetica")
        .text(`${input.yesCount}/10 Council Members · ${Math.round(input.confidenceScore * 100)}% Consensus`, ML + 16, doc.y + 28);
      doc.y += 52;

      subHeading("The Bet", GOLD);
      if (es.theBet) {
        doc.rect(ML, doc.y, 3, 30).fill(GOLD);
        doc.fontSize(11).fillColor(WHITE).font("Helvetica-Oblique")
          .text(es.theBet, ML + 12, doc.y, { width: BODY_W - 12, lineGap: 3 });
        doc.y += 20;
      }

      subHeading("Council Consensus");
      bodyText(es.consensusSummary ?? "");

      subHeading("Key Strengths", GREEN);
      (es.keyStrengths ?? []).forEach(s => bullet(s, GREEN));
      doc.y += 4;

      subHeading("Key Risks", RED);
      (es.keyRisks ?? []).forEach(r => bullet(r, RED));
      doc.y += 4;

      subHeading("Recommendation", GOLD);
      bodyText(es.recommendation ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2 — DEAL OVERVIEW
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("2. Deal Overview");
    sectionDivider("02", "Deal Overview", ACCENT);

    const dov = memo.dealOverview;
    if (dov) {
      subHeading("Overview");
      bodyText(dov.narrative ?? "");

      if (dov.keyFacts?.length) {
        subHeading("Key Facts");
        kvGrid(dov.keyFacts, 2);
      }

      subHeading("Business Description");
      bodyText(dov.businessDescription ?? "");

      subHeading("Geographic Presence");
      bodyText(dov.geographicPresence ?? "");

      subHeading("Products & Revenue Streams");
      bodyText(dov.productServiceOverview ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3 — TRANSACTION STRUCTURE
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("3. Transaction Structure");
    sectionDivider("03", "Transaction Structure", AMBER);

    const ts = memo.transactionStructure;
    if (ts) {
      subHeading("Structure Overview");
      bodyText(ts.narrative ?? "");

      // Sources & Uses side by side
      subHeading("Sources & Uses");
      const halfW = (BODY_W - 12) / 2;
      const suY = doc.y;

      // Sources
      ensureSpace(120);
      doc.rect(ML, doc.y, halfW, 20).fill(BG3);
      doc.fontSize(8).fillColor(GREEN).font("Helvetica-Bold")
        .text("SOURCES", ML + 6, doc.y + 6, { characterSpacing: 0.8 });
      doc.y += 22;
      (ts.sourcesUses?.sources ?? []).forEach((s, i) => {
        if (i % 2 === 0) doc.rect(ML, doc.y, halfW, 16).fill(BG2);
        doc.fontSize(8.5).fillColor(WHITE).font("Helvetica")
          .text(s.item, ML + 6, doc.y + 4, { width: halfW - 80 });
        doc.fontSize(8.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(s.amount, ML + halfW - 70, doc.y + 4, { width: 40, align: "right" });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(s.pct, ML + halfW - 26, doc.y + 4, { width: 22, align: "right" });
        doc.y += 18;
      });

      // Uses (reset to suY)
      const usesX = ML + halfW + 12;
      doc.y = suY;
      doc.rect(usesX, doc.y, halfW, 20).fill(BG3);
      doc.fontSize(8).fillColor(AMBER).font("Helvetica-Bold")
        .text("USES", usesX + 6, doc.y + 6, { characterSpacing: 0.8 });
      doc.y += 22;
      (ts.sourcesUses?.uses ?? []).forEach((u, i) => {
        if (i % 2 === 0) doc.rect(usesX, doc.y, halfW, 16).fill(BG2);
        doc.fontSize(8.5).fillColor(WHITE).font("Helvetica")
          .text(u.item, usesX + 6, doc.y + 4, { width: halfW - 80 });
        doc.fontSize(8.5).fillColor(AMBER).font("Helvetica-Bold")
          .text(u.amount, usesX + halfW - 70, doc.y + 4, { width: 40, align: "right" });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(u.pct, usesX + halfW - 26, doc.y + 4, { width: 22, align: "right" });
        doc.y += 18;
      });
      doc.y += 12;

      subHeading("Ownership Structure");
      bodyText(ts.ownershipStructure ?? "");

      subHeading("Entry Terms & Valuation");
      bodyText(ts.entryTerms ?? "");

      subHeading("Key Structural Features");
      (ts.keyStructuralFeatures ?? []).forEach(f => bullet(f, ACCENT));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4 — INVESTMENT THESIS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("4. Investment Thesis");
    sectionDivider("04", "Investment Thesis", GREEN);

    const it = memo.investmentThesis;
    if (it) {
      subHeading("Overarching Thesis");
      bodyText(it.overarchingThesis ?? "");

      (it.pillars ?? []).forEach((p, i) => {
        ensureSpace(60);
        doc.rect(ML, doc.y, BODY_W, 22).fill(BG2);
        doc.rect(ML, doc.y, 3, 22).fill(GREEN);
        doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
          .text(`PILLAR ${i + 1}`, ML + 10, doc.y + 4, { characterSpacing: 0.8 });
        doc.fontSize(11).fillColor(WHITE).font("Helvetica-Bold")
          .text(p.title ?? "", ML + 10, doc.y + 12);
        doc.y += 28;
        bodyText(p.narrative ?? "");
        if (p.supportingData) {
          doc.fontSize(8.5).fillColor(AMBER).font("Helvetica-Bold")
            .text(`▶  ${p.supportingData}`, ML + 12, doc.y, { width: BODY_W - 12 });
          doc.y += 14;
        }
        doc.y += 4;
      });

      subHeading("Non-Consensus Insight", PURPLE);
      bodyText(it.nonObviousInsight ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5 — MARKET ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("5. Market Analysis");
    sectionDivider("05", "Market Analysis", ACCENT);

    const ma = memo.marketAnalysis;
    if (ma) {
      subHeading("Market Overview");
      bodyText(ma.marketOverview ?? "");

      subHeading("Market Size & Key Metrics");
      if (ma.marketSizeData?.length) {
        table(
          ["Metric", "Value", "Source"],
          (ma.marketSizeData ?? []).map(d => [d.metric, d.value, d.source]),
          [220, 140, 139]
        );
      }

      subHeading("Growth Drivers");
      (ma.growthDrivers ?? []).forEach(d => bullet(d, GREEN));
      doc.y += 4;

      subHeading("Tailwinds", GREEN);
      (ma.tailwinds ?? []).forEach(t => bullet(t, GREEN));
      doc.y += 4;

      subHeading("Headwinds", RED);
      (ma.headwinds ?? []).forEach(h => bullet(h, RED));
      doc.y += 4;

      subHeading("Market Narrative");
      bodyText(ma.marketNarrative ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6 — COMPETITIVE LANDSCAPE
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("6. Competitive Landscape");
    sectionDivider("06", "Competitive Landscape", AMBER);

    const cl = memo.competitiveLandscape;
    if (cl) {
      subHeading("Overview");
      bodyText(cl.narrative ?? "");

      subHeading("Comparable Companies");
      if (cl.competitors?.length) {
        table(
          ["Company", "EV/EBITDA", "EV/Revenue", "Rev. Growth", "EBITDA Margin", "Notes"],
          (cl.competitors ?? []).map(c => [c.company, c.evEbitda, c.evRevenue, c.revenueGrowth, c.ebitdaMargin, c.notes]),
          [120, 60, 65, 65, 75, 114]
        );
      }

      subHeading("Competitive Positioning");
      bodyText(cl.competitivePositioning ?? "");

      subHeading("Competitive Moat");
      bodyText(cl.moat ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7 — BUSINESS MODEL & UNIT ECONOMICS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("7. Business Model & Unit Economics");
    sectionDivider("07", "Business Model & Unit Economics", GREEN);

    const bm = memo.businessModel;
    if (bm) {
      subHeading("Revenue Model");
      bodyText(bm.revenueModel ?? "");

      subHeading("Unit Economics — Per Outlet");
      if (bm.unitEconomics?.length) {
        table(
          ["Metric", "Value", "Notes"],
          (bm.unitEconomics ?? []).map(u => [u.metric, u.value, u.notes]),
          [200, 100, 199]
        );
      }

      subHeading("Outlet-Level P&L");
      bodyText(bm.outletEconomics ?? "");

      subHeading("Scalability");
      bodyText(bm.scalabilityNarrative ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8 — HISTORICAL FINANCIALS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("8. Historical Financials");
    sectionDivider("08", "Historical Financials", ACCENT);

    const hf = memo.historicalFinancials;
    if (hf) {
      subHeading("Financial Performance Overview");
      bodyText(hf.narrative ?? "");

      subHeading("Historical P&L Summary");
      if (hf.years?.length && hf.rows?.length) {
        financialTable(hf.years, hf.rows);
      }

      subHeading("Key Financial Trends");
      (hf.keyTrends ?? []).forEach(t => bullet(t, ACCENT));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9 — FINANCIAL MODEL
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("9. Financial Model");
    sectionDivider("09", "Financial Model", GOLD);

    const fm = memo.financialModel;
    if (fm) {
      subHeading("Key Assumptions");
      if (fm.assumptions?.length) {
        table(
          ["Assumption", "Value", "Rationale"],
          (fm.assumptions ?? []).map(a => [a.assumption, a.value, a.rationale]),
          [160, 80, 259]
        );
      }

      subHeading("Revenue & EBITDA Projections");
      if (fm.revenueProjections?.years?.length && fm.revenueProjections?.rows?.length) {
        financialTable(fm.revenueProjections.years, fm.revenueProjections.rows);
      }

      subHeading("EBITDA Bridge (Entry → Exit)");
      if (fm.ebitdaBridge?.length) {
        fm.ebitdaBridge.forEach((b, i) => {
          ensureSpace(18);
          const isTotal = b.item.toLowerCase().includes("exit") || b.item.toLowerCase().includes("entry");
          if (isTotal) doc.rect(ML, doc.y, BODY_W, 16).fill(BG3);
          doc.fontSize(9).fillColor(isTotal ? GOLD : WHITE).font(isTotal ? "Helvetica-Bold" : "Helvetica")
            .text(b.item, ML + 8, doc.y + 4, { width: 200 });
          doc.fontSize(9).fillColor(isTotal ? GOLD : ACCENT).font("Helvetica-Bold")
            .text(b.amount, ML + 220, doc.y + 4, { width: 80, align: "right" });
          doc.fontSize(8).fillColor(MUTED).font("Helvetica")
            .text(b.notes, ML + 310, doc.y + 4, { width: BODY_W - 310 });
          doc.y += 18;
        });
        doc.y += 8;
      }

      doc.addPage();
      doc.y = 56;
      pageHeader("9. Financial Model (cont.)");

      subHeading("IRR Scenarios");
      if (fm.irrScenarios?.length) {
        table(
          ["Scenario", "Entry EV", "Exit EV", "MOIC", "IRR", "Exit Year"],
          (fm.irrScenarios ?? []).map(s => [s.scenario, s.entryEv, s.exitEv, s.moic, s.irr, s.exitYear]),
          [80, 80, 80, 60, 60, 139]
        );
      }

      subHeading("IRR Sensitivity — Exit Multiple vs. Revenue CAGR");
      if (fm.sensitivityTable?.rows?.length) {
        const colHeaders = ["5%", "8%", "10%", "12%", "15%"];
        sensitivityTable(
          fm.sensitivityTable.rowLabel ?? "Exit EV/EBITDA",
          fm.sensitivityTable.colLabel ?? "Revenue CAGR",
          colHeaders,
          fm.sensitivityTable.rows
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10 — RISK ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("10. Risk Analysis");
    sectionDivider("10", "Risk Analysis", RED);

    const ra = memo.riskAnalysis;
    if (ra) {
      subHeading("Risk Overview");
      bodyText(ra.narrative ?? "");

      subHeading("Risk Matrix");
      // Risk matrix header
      ensureSpace(24);
      const catW = 80; const riskW = 160; const lhW = 55; const impW = 55; const mitW = BODY_W - catW - riskW - lhW - impW;
      doc.rect(ML, doc.y, BODY_W, 20).fill(BG3);
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("CATEGORY", ML + 4, doc.y + 6, { width: catW - 8 });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("RISK", ML + catW + 4, doc.y + 6, { width: riskW - 8 });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("LIKELIHOOD", ML + catW + riskW + 4, doc.y + 6, { width: lhW - 8, align: "center" });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("IMPACT", ML + catW + riskW + lhW + 4, doc.y + 6, { width: impW - 8, align: "center" });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("MITIGANT", ML + catW + riskW + lhW + impW + 4, doc.y + 6, { width: mitW - 8 });
      doc.y += 22;

      (ra.riskMatrix ?? []).forEach((row, i) => riskRow(row, i));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 11 — MITIGANTS & CONDITIONS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("11. Mitigants & Conditions");
    sectionDivider("11", "Mitigants & Conditions", AMBER);

    const mc = memo.mitigantsConditions;
    if (mc) {
      subHeading("Framework Overview");
      bodyText(mc.narrative ?? "");

      subHeading("Conditions to Proceed");
      if (mc.conditions?.length) {
        table(
          ["Condition", "Owner", "Timeline", "Consequence if Unmet"],
          (mc.conditions ?? []).map(c => [c.condition, c.owner, c.timeline, c.consequence]),
          [180, 70, 70, 179]
        );
      }

      subHeading("Structural Mitigants");
      if (mc.mitigants?.length) {
        table(
          ["Risk", "Mitigant", "Residual Risk"],
          (mc.mitigants ?? []).map(m => [m.risk, m.mitigant, m.residualRisk]),
          [140, 240, 119]
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 12 — EXIT STRATEGY
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("12. Exit Strategy");
    sectionDivider("12", "Exit Strategy", PURPLE);

    const ex = memo.exitStrategy;
    if (ex) {
      subHeading("Exit Overview");
      bodyText(ex.narrative ?? "");

      subHeading("Exit Paths");
      if (ex.exitPaths?.length) {
        table(
          ["Path", "Timing", "EV Range", "MOIC", "IRR", "Notes"],
          (ex.exitPaths ?? []).map(p => [p.path, p.timing, p.evRange, p.moic, p.irr, p.notes]),
          [130, 55, 70, 45, 45, 154]
        );
      }

      subHeading("Comparable Exit Transactions");
      if (ex.comparableTransactions?.length) {
        table(
          ["Target", "Acquirer", "Year", "EV", "EV/EBITDA", "Notes"],
          (ex.comparableTransactions ?? []).map(t => [t.target, t.acquirer, t.year, t.ev, t.evEbitda, t.notes]),
          [110, 100, 40, 60, 65, 124]
        );
      }

      subHeading("Preferred Exit Path", PURPLE);
      bodyText(ex.preferredPath ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 13 — MANAGEMENT ASSESSMENT
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("13. Management Assessment");
    sectionDivider("13", "Management Assessment", ACCENT);

    const mgmt = memo.managementAssessment;
    if (mgmt) {
      subHeading("Team Overview");
      bodyText(mgmt.narrative ?? "");

      subHeading("Team Strengths", GREEN);
      (mgmt.teamStrengths ?? []).forEach(s => bullet(s, GREEN));
      doc.y += 4;

      subHeading("Team Gaps & Proposed Solutions", AMBER);
      (mgmt.teamGaps ?? []).forEach(g => bullet(g, AMBER));
      doc.y += 4;

      subHeading("Key Person Risk");
      bodyText(mgmt.keyPersonRisk ?? "");

      subHeading("Recommendation");
      bodyText(mgmt.recommendation ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 14 — KEY DEAL TERMS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("14. Deal Terms & Negotiation");
    sectionDivider("14", "Key Deal Terms & Negotiation Points", GOLD);

    const dt = memo.dealTerms;
    if (dt) {
      subHeading("Negotiation Context");
      bodyText(dt.narrative ?? "");

      subHeading("Key Terms Summary");
      if (dt.keyTerms?.length) {
        table(
          ["Term", "Proposed", "Market Standard", "Negotiation Note"],
          (dt.keyTerms ?? []).map(t => [t.term, t.proposed, t.marketStandard, t.negotiationNote]),
          [100, 90, 100, 209]
        );
      }

      subHeading("Red Lines", RED);
      (dt.redLines ?? []).forEach(r => bullet(r, RED));
      doc.y += 4;

      subHeading("Preferred Outcome", GOLD);
      bodyText(dt.preferredOutcome ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 15 — APPENDIX
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    doc.y = 56;
    pageHeader("15. Appendix");
    sectionDivider("15", "Appendix", MUTED);

    const app = memo.appendix;
    if (app) {
      subHeading("A. Comparable Transactions");
      if (app.comparableTransactionsTable?.length) {
        table(
          ["Deal", "Year", "Sector", "EV", "Multiple"],
          (app.comparableTransactionsTable ?? []).map(d => [d.deal, d.year, d.sector, d.ev, d.multiple]),
          [160, 45, 80, 80, 134]
        );
      }

      subHeading("B. Market Data Sources");
      if (app.marketDataSources?.length) {
        table(
          ["Source", "Data Point", "Relevance"],
          (app.marketDataSources ?? []).map(s => [s.source, s.dataPoint, s.relevance]),
          [140, 180, 179]
        );
      }

      subHeading("C. Key Assumptions — Base / Bear / Bull");
      if (app.keyAssumptions?.length) {
        table(
          ["Assumption", "Base", "Bear", "Bull"],
          (app.keyAssumptions ?? []).map(a => [a.assumption, a.base, a.bear, a.bull]),
          [200, 80, 80, 139]
        );
      }

      doc.y += 16;
      subHeading("D. Council of 10 — Individual Votes");
      doc.y += 4;

      const voteColorMap: Record<string, string> = {
        HARD_YES: GREEN, SOFT_YES: ACCENT, SOFT_NO: AMBER, HARD_NO: RED,
      };
      const voteLabelMap: Record<string, string> = {
        HARD_YES: "HARD YES", SOFT_YES: "SOFT YES", SOFT_NO: "SOFT NO", HARD_NO: "HARD NO",
      };

      input.votes.forEach((v, idx) => {
        const vColor = voteColorMap[v.vote] ?? WHITE;
        const vLabel = voteLabelMap[v.vote] ?? v.vote;
        const confPct = Math.round(v.confidence * 100);
        const estH = 28 + Math.ceil((v.rationale ?? "").length / 90) * 13 +
          (v.keyFlags.length ? 14 : 0) + (v.conditions.length ? 14 : 0) + (v.blockers.length ? 14 : 0) + 16;
        ensureSpace(estH);

        const cardY = doc.y;
        doc.rect(ML, cardY, BODY_W, 22).fill(BG3);
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold")
          .text(`${String(idx + 1).padStart(2, "0")}`, ML + 8, cardY + 7);
        doc.fontSize(9.5).fillColor(WHITE).font("Helvetica-Bold")
          .text(v.personaRole, ML + 26, cardY + 6, { width: BODY_W - 130 });

        const badgeW = 72;
        doc.rect(ML + BODY_W - badgeW - 4, cardY + 3, badgeW, 16).fillAndStroke(`${vColor}18`, `${vColor}55`);
        doc.fontSize(8).fillColor(vColor).font("Helvetica-Bold")
          .text(vLabel, ML + BODY_W - badgeW - 4, cardY + 7, { width: badgeW, align: "center" });

        const barX = ML + BODY_W - badgeW - 90;
        const barW = 70;
        doc.rect(barX, cardY + 9, barW, 5).fill(BG2);
        doc.rect(barX, cardY + 9, barW * v.confidence, 5).fill(vColor);
        doc.fontSize(7).fillColor(MUTED).font("Helvetica")
          .text(`${confPct}%`, barX + barW + 4, cardY + 8);

        doc.y = cardY + 26;
        if (v.rationale) {
          doc.fontSize(9).fillColor("#94A3B8").font("Helvetica")
            .text(v.rationale, ML + 12, doc.y, { width: BODY_W - 24, lineGap: 2 });
          doc.y += 8;
        }
        if (v.keyFlags.length) {
          doc.fontSize(7.5).fillColor(AMBER).font("Helvetica-Bold")
            .text("FLAGS  ", ML + 12, doc.y, { continued: true });
          doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
            .text(v.keyFlags.join("  ·  "), { width: BODY_W - 60, continued: false });
          doc.y += 6;
        }
        if (v.conditions.length) {
          doc.fontSize(7.5).fillColor(ACCENT).font("Helvetica-Bold")
            .text("CONDITIONS  ", ML + 12, doc.y, { continued: true });
          doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
            .text(v.conditions.slice(0, 3).join("  ·  "), { width: BODY_W - 80, continued: false });
          doc.y += 6;
        }
        if (v.blockers.length) {
          doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
            .text("BLOCKERS  ", ML + 12, doc.y, { continued: true });
          doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
            .text(v.blockers.slice(0, 3).join("  ·  "), { width: BODY_W - 70, continued: false });
          doc.y += 6;
        }
        doc.rect(ML, doc.y + 4, BODY_W, 0.5).fill(BORDER_C);
        doc.y += 14;
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTER ON ALL PAGES
    // ─────────────────────────────────────────────────────────────────────────
    const totalPages = (doc as any)._pageBuffer?.length ?? 1;
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) doc.switchToPage(i);
      pageFooter(i + 1);
    }

    doc.end();
  });
}
