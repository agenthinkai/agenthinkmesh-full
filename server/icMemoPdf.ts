/**
 * icMemoPdf.ts — Full Institutional IC Memo Generator
 *
 * Produces a 30–40 page Investment Committee memo from Council of 10 output.
 * White background, tight typography, properly aligned tables, no blank pages.
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
  executiveSummary: {
    theBet: string;
    verdict: string;
    consensusSummary: string;
    keyStrengths: string[];
    keyRisks: string[];
    recommendation: string;
    dealSnapshot: Array<{ label: string; value: string }>;
  };
  dealOverview: {
    narrative: string;
    keyFacts: Array<{ label: string; value: string }>;
    businessDescription: string;
    geographicPresence: string;
    productServiceOverview: string;
  };
  transactionStructure: {
    narrative: string;
    sourcesUses: { sources: Array<{ item: string; amount: string; pct: string }>; uses: Array<{ item: string; amount: string; pct: string }> };
    ownershipStructure: string;
    entryTerms: string;
    keyStructuralFeatures: string[];
  };
  investmentThesis: {
    overarchingThesis: string;
    pillars: Array<{ title: string; narrative: string; supportingData: string }>;
    nonObviousInsight: string;
  };
  marketAnalysis: {
    marketOverview: string;
    marketSizeData: Array<{ metric: string; value: string; source: string }>;
    growthDrivers: string[];
    tailwinds: string[];
    headwinds: string[];
    marketNarrative: string;
  };
  competitiveLandscape: {
    narrative: string;
    competitors: CompRow[];
    competitivePositioning: string;
    moat: string;
  };
  businessModel: {
    revenueModel: string;
    unitEconomics: Array<{ metric: string; value: string; notes: string }>;
    outletEconomics: string;
    scalabilityNarrative: string;
  };
  historicalFinancials: {
    narrative: string;
    years: string[];
    rows: FinancialRow[];
    keyTrends: string[];
  };
  financialModel: {
    assumptions: Array<{ assumption: string; value: string; rationale: string }>;
    revenueProjections: { years: string[]; rows: FinancialRow[] };
    ebitdaBridge: Array<{ item: string; amount: string; notes: string }>;
    irrScenarios: Array<{ scenario: string; entryEv: string; exitEv: string; moic: string; irr: string; exitYear: string }>;
    sensitivityTable: { rowLabel: string; colLabel: string; rows: Array<{ label: string; values: string[] }> };
  };
  riskAnalysis: {
    narrative: string;
    riskMatrix: RiskRow[];
  };
  mitigantsConditions: {
    narrative: string;
    conditions: Array<{ condition: string; owner: string; timeline: string; consequence: string }>;
    mitigants: Array<{ risk: string; mitigant: string; residualRisk: string }>;
  };
  exitStrategy: {
    narrative: string;
    exitPaths: ExitRow[];
    comparableTransactions: Array<{ target: string; acquirer: string; year: string; ev: string; evEbitda: string; notes: string }>;
    preferredPath: string;
  };
  managementAssessment: {
    narrative: string;
    teamStrengths: string[];
    teamGaps: string[];
    keyPersonRisk: string;
    recommendation: string;
  };
  dealTerms: {
    narrative: string;
    keyTerms: Array<{ term: string; proposed: string; marketStandard: string; negotiationNote: string }>;
    redLines: string[];
    preferredOutcome: string;
  };
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
    "keyStrengths": ["strength 1 — specific and data-referenced", "strength 2", "strength 3", "strength 4", "strength 5"],
    "keyRisks": ["risk 1 — specific", "risk 2", "risk 3", "risk 4"],
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
    "narrative": "3–4 sentence overview",
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
    "businessDescription": "3–5 sentence description",
    "geographicPresence": "2–3 sentences",
    "productServiceOverview": "2–3 sentences"
  },
  "transactionStructure": {
    "narrative": "3–4 sentences",
    "sourcesUses": {
      "sources": [
        {"item": "Equity (Fund)", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Senior Debt", "amount": "KWD 0.00m", "pct": "0%"},
        {"item": "Seller Rollover", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Management Equity", "amount": "KWD Xm", "pct": "X%"}
      ],
      "uses": [
        {"item": "Acquisition Price (60%)", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Seller Rollover (40%)", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Transaction Costs", "amount": "KWD Xm", "pct": "X%"},
        {"item": "Working Capital Adjustment", "amount": "KWD Xm", "pct": "X%"}
      ]
    },
    "ownershipStructure": "2–3 sentences",
    "entryTerms": "2–3 sentences",
    "keyStructuralFeatures": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"]
  },
  "investmentThesis": {
    "overarchingThesis": "3–4 sentences",
    "pillars": [
      {"title": "Pillar Title", "narrative": "3–4 sentences of substantive analysis", "supportingData": "One specific data point supporting this pillar"},
      {"title": "Pillar Title", "narrative": "3–4 sentences", "supportingData": "One specific data point"},
      {"title": "Pillar Title", "narrative": "3–4 sentences", "supportingData": "One specific data point"},
      {"title": "Pillar Title", "narrative": "3–4 sentences", "supportingData": "One specific data point"}
    ],
    "nonObviousInsight": "3–4 sentences on the contrarian or non-consensus view"
  },
  "marketAnalysis": {
    "marketOverview": "3–4 sentences",
    "marketSizeData": [
      {"metric": "Kuwait F&B Market Size", "value": "KWD 1.4bn (2023)", "source": "Euromonitor / BMI Research"},
      {"metric": "QSR Segment Share", "value": "35%", "source": "Industry estimate"},
      {"metric": "Market CAGR (2024–2028)", "value": "7%", "source": "BMI Research"},
      {"metric": "GCC F&B Market Size", "value": "USD 60bn", "source": "Euromonitor"},
      {"metric": "Kuwait GDP per Capita", "value": "USD 33,000", "source": "World Bank 2023"},
      {"metric": "Kuwait Eating-Out Frequency", "value": "4–5 times/week", "source": "Industry survey"}
    ],
    "growthDrivers": ["driver 1", "driver 2", "driver 3", "driver 4"],
    "tailwinds": ["tailwind 1", "tailwind 2", "tailwind 3"],
    "headwinds": ["headwind 1", "headwind 2"],
    "marketNarrative": "3–4 sentences"
  },
  "competitiveLandscape": {
    "narrative": "3–4 sentences",
    "competitors": [
      {"company": "Americana Restaurants", "evEbitda": "10–12x", "evRevenue": "1.5x", "revenueGrowth": "8%", "ebitdaMargin": "18%", "notes": "Regional consolidator, 2,000+ outlets"},
      {"company": "Kout Food Group", "evEbitda": "8–9x", "evRevenue": "1.2x", "revenueGrowth": "6%", "ebitdaMargin": "20%", "notes": "Kuwait-focused, recent M&A active"},
      {"company": "Alshaya Group (F&B)", "evEbitda": "9–11x", "evRevenue": "1.3x", "revenueGrowth": "5%", "ebitdaMargin": "17%", "notes": "GCC-wide franchise operator"},
      {"company": "Agthia Group", "evEbitda": "11x", "evRevenue": "1.8x", "revenueGrowth": "10%", "ebitdaMargin": "16%", "notes": "UAE-listed, strategic acquirer"},
      {"company": "Al-Reef (Target)", "evEbitda": "7.6x", "evRevenue": "2.1x", "revenueGrowth": "9.2%", "ebitdaMargin": "27.5%", "notes": "Entry valuation — attractive vs. peers"}
    ],
    "competitivePositioning": "3–4 sentences",
    "moat": "3–4 sentences"
  },
  "businessModel": {
    "revenueModel": "3–4 sentences",
    "unitEconomics": [
      {"metric": "Average Revenue per Outlet (LTM)", "value": "KWD 267K", "notes": "Based on 18 outlets, KWD 4.8m total"},
      {"metric": "Average EBITDA per Outlet", "value": "KWD 73K", "notes": "27.5% EBITDA margin"},
      {"metric": "Outlet Capex (new build)", "value": "KWD 120–150K", "notes": "Fit-out + franchise fee"},
      {"metric": "Payback Period", "value": "2.0–2.2 years", "notes": "Based on unit EBITDA"},
      {"metric": "Digital Revenue Share", "value": "38%", "notes": "Growing from 25% in 2021"},
      {"metric": "Same-Store Sales Growth (YoY)", "value": "9.2%", "notes": "LTM vs. prior year"},
      {"metric": "Average Check Size", "value": "KWD 4.50", "notes": "QSR segment benchmark"},
      {"metric": "Franchise Royalty Rate", "value": "5–6% of revenue", "notes": "Typical QSR franchise terms"}
    ],
    "outletEconomics": "3–4 sentences",
    "scalabilityNarrative": "3–4 sentences"
  },
  "historicalFinancials": {
    "narrative": "3–4 sentences",
    "years": ["FY2021", "FY2022", "FY2023", "LTM"],
    "rows": [
      {"label": "Revenue (KWD m)", "values": ["3.1", "3.8", "4.4", "4.8"]},
      {"label": "Revenue Growth", "values": ["—", "22.6%", "15.8%", "9.1%"]},
      {"label": "Gross Profit (KWD m)", "values": ["1.6", "2.0", "2.3", "2.5"]},
      {"label": "Gross Margin", "values": ["51.6%", "52.6%", "52.3%", "52.1%"]},
      {"label": "EBITDA (KWD m)", "values": ["0.72", "0.95", "1.18", "1.32"]},
      {"label": "EBITDA Margin", "values": ["23.2%", "25.0%", "26.8%", "27.5%"]},
      {"label": "D&A (KWD m)", "values": ["0.12", "0.14", "0.16", "0.17"]},
      {"label": "EBIT (KWD m)", "values": ["0.60", "0.81", "1.02", "1.15"]},
      {"label": "Net Income (KWD m)", "values": ["0.55", "0.74", "0.94", "1.06"]},
      {"label": "Capex (KWD m)", "values": ["0.18", "0.22", "0.25", "0.20"]},
      {"label": "Free Cash Flow (KWD m)", "values": ["0.54", "0.73", "0.93", "1.12"]}
    ],
    "keyTrends": ["trend 1 with specific data", "trend 2", "trend 3", "trend 4"]
  },
  "financialModel": {
    "assumptions": [
      {"assumption": "Revenue CAGR (Base)", "value": "12%", "rationale": "Driven by 2 new outlets/year + 8% SSSG"},
      {"assumption": "New Outlets per Year", "value": "2", "rationale": "Conservative vs. management plan of 3"},
      {"assumption": "EBITDA Margin Expansion", "value": "+150bps/year", "rationale": "Digital mix shift + procurement efficiencies"},
      {"assumption": "Exit EV/EBITDA (Base)", "value": "8.5x", "rationale": "Kout comparable at 8.5x; discount to Americana 10x"},
      {"assumption": "Hold Period", "value": "4 years", "rationale": "Optimal exit window pre-2030 Kuwait Vision"},
      {"assumption": "Franchise Royalty Rate", "value": "5.5%", "rationale": "Blended rate across 3 brands"},
      {"assumption": "Capex per New Outlet", "value": "KWD 135K", "rationale": "Mid-point of KWD 120–150K range"},
      {"assumption": "Working Capital Days", "value": "15 days", "rationale": "QSR sector norm; cash-generative model"}
    ],
    "revenueProjections": {
      "years": ["FY2024E", "FY2025E", "FY2026E", "FY2027E", "FY2028E"],
      "rows": [
        {"label": "Outlets (end of year)", "values": ["20", "22", "24", "26", "28"]},
        {"label": "Revenue (KWD m)", "values": ["5.4", "6.1", "6.9", "7.7", "8.6"]},
        {"label": "Revenue Growth", "values": ["12.5%", "13.0%", "13.1%", "11.6%", "11.7%"]},
        {"label": "EBITDA (KWD m)", "values": ["1.54", "1.80", "2.10", "2.42", "2.76"]},
        {"label": "EBITDA Margin", "values": ["28.5%", "29.5%", "30.4%", "31.4%", "32.1%"]},
        {"label": "EBIT (KWD m)", "values": ["1.36", "1.60", "1.88", "2.18", "2.50"]},
        {"label": "Free Cash Flow (KWD m)", "values": ["1.27", "1.49", "1.75", "2.02", "2.33"]},
        {"label": "Cumulative FCF (KWD m)", "values": ["1.27", "2.76", "4.51", "6.53", "8.86"]}
      ]
    },
    "ebitdaBridge": [
      {"item": "Entry EBITDA (LTM)", "amount": "KWD 1.32m", "notes": "Baseline at acquisition"},
      {"item": "+ Organic Revenue Growth", "amount": "+ KWD 0.72m", "notes": "12% CAGR over 4 years"},
      {"item": "+ New Outlet Contribution", "amount": "+ KWD 0.40m", "notes": "10 new outlets × KWD 40K avg EBITDA"},
      {"item": "+ Margin Expansion (digital/procurement)", "amount": "+ KWD 0.22m", "notes": "+150bps/year × 4 years"},
      {"item": "- Incremental Franchise Costs", "amount": "- KWD 0.08m", "notes": "Higher royalties on expanded revenue"},
      {"item": "- Corporate Overhead (post-acquisition)", "amount": "- KWD 0.06m", "notes": "CFO hire, compliance, audit"},
      {"item": "Exit EBITDA (Year 4)", "amount": "KWD 2.52m", "notes": "Target exit EBITDA"}
    ],
    "irrScenarios": [
      {"scenario": "Bull Case", "entryEv": "KWD 10.03m", "exitEv": "KWD 26.5m", "moic": "3.2x", "irr": "34%", "exitYear": "Year 3"},
      {"scenario": "Base Case", "entryEv": "KWD 10.03m", "exitEv": "KWD 21.4m", "moic": "2.5x", "irr": "22%", "exitYear": "Year 4"},
      {"scenario": "Bear Case", "entryEv": "KWD 10.03m", "exitEv": "KWD 15.8m", "moic": "1.7x", "irr": "12%", "exitYear": "Year 5"},
      {"scenario": "Downside (Stress)", "entryEv": "KWD 10.03m", "exitEv": "KWD 11.2m", "moic": "1.1x", "irr": "3%", "exitYear": "Year 5"}
    ],
    "sensitivityTable": {
      "rowLabel": "Exit EV/EBITDA",
      "colLabel": "Revenue CAGR",
      "rows": [
        {"label": "6.0x", "values": ["8%", "10%", "12%", "15%", "18%"]},
        {"label": "7.0x", "values": ["12%", "14%", "16%", "19%", "22%"]},
        {"label": "8.5x", "values": ["17%", "19%", "22%", "25%", "28%"]},
        {"label": "10.0x", "values": ["21%", "24%", "27%", "30%", "34%"]},
        {"label": "12.0x", "values": ["27%", "30%", "33%", "37%", "41%"]}
      ]
    }
  },
  "riskAnalysis": {
    "narrative": "3–4 sentences on overall risk profile",
    "riskMatrix": [
      {"category": "Franchise", "risk": "Franchisor terminates or refuses to transfer franchise agreement to new ownership", "likelihood": "Medium", "impact": "High", "mitigant": "Obtain explicit written franchisor consent pre-close; include termination right in SPA"},
      {"category": "Valuation", "risk": "7.6x entry multiple compresses if market multiples decline or EBITDA misses", "likelihood": "Medium", "impact": "Medium", "mitigant": "Conservative exit assumption at 8.5x; FCF generation provides downside buffer"},
      {"category": "Operational", "risk": "Key person dependency on founder CEO; departure disrupts operations", "likelihood": "Low", "impact": "High", "mitigant": "5-year employment contract; ESOP vesting tied to EBITDA targets"},
      {"category": "Regulatory", "risk": "Kuwait CMA notification and KSCC ownership transfer complications", "likelihood": "Medium", "impact": "Medium", "mitigant": "Engage specialist Kuwaiti legal counsel; build 60-day buffer in closing timeline"},
      {"category": "Shariah", "risk": "Franchise agreements contain riba-based penalty clauses incompatible with fund mandate", "likelihood": "Low", "impact": "High", "mitigant": "Full Shariah audit of all franchise agreements pre-close; renegotiate non-compliant clauses"},
      {"category": "Market", "risk": "Kuwait F&B market saturation or economic slowdown reduces consumer spending", "likelihood": "Low", "impact": "Medium", "mitigant": "QSR is recession-resilient; diversified brand portfolio reduces single-brand exposure"},
      {"category": "Execution", "risk": "Roll-up strategy fails to achieve target outlet count due to site scarcity or capex overruns", "likelihood": "Medium", "impact": "Medium", "mitigant": "Pipeline of 8 identified sites; capex contingency of 15% built into model"},
      {"category": "Exit", "risk": "Strategic acquirers (Americana, Kout) delay or reduce acquisition appetite by 2028", "likelihood": "Low", "impact": "High", "mitigant": "Secondary PE exit or IPO on Boursa Kuwait as alternative; strong FCF supports dividend recap"}
    ]
  },
  "mitigantsConditions": {
    "narrative": "3–4 sentences",
    "conditions": [
      {"condition": "Obtain explicit written consent from all three franchisors for ownership transfer", "owner": "Legal Counsel + Management", "timeline": "Pre-close (Day 0)", "consequence": "Deal termination"},
      {"condition": "Full Shariah compliance audit of all franchise and operational agreements", "owner": "Shariah Adviser", "timeline": "Pre-close (Day 0)", "consequence": "Deal termination"},
      {"condition": "Verify enforceability of 5-year non-compete covenant under Kuwaiti law", "owner": "Kuwaiti Legal Counsel", "timeline": "Pre-close (Day 0)", "consequence": "Price reduction or deal termination"},
      {"condition": "Confirm zero undisclosed liabilities via full financial and legal due diligence", "owner": "Financial Adviser + Legal", "timeline": "Pre-close (Day 0)", "consequence": "Price adjustment or termination"},
      {"condition": "CMA notification filed and acknowledged for KSCC ownership change", "owner": "Legal Counsel", "timeline": "Within 30 days of close", "consequence": "Regulatory penalty"},
      {"condition": "Management ESOP documentation executed and board governance framework established", "owner": "Fund + Management", "timeline": "Within 60 days of close", "consequence": "Key person retention risk"},
      {"condition": "Seller earn-out mechanism and rollover equity documentation finalised", "owner": "Fund Legal", "timeline": "Pre-close (Day 0)", "consequence": "Seller alignment risk"}
    ],
    "mitigants": [
      {"risk": "Franchise agreement non-transferability", "mitigant": "Franchisor consent clause in SPA with termination right if consent withheld", "residualRisk": "Low"},
      {"risk": "Key person departure", "mitigant": "5-year employment contract + ESOP vesting over 4 years tied to EBITDA targets", "residualRisk": "Low"},
      {"risk": "Valuation compression", "mitigant": "Conservative 8.5x exit assumption; strong FCF generation (KWD 8.86m cumulative) provides capital return floor", "residualRisk": "Medium"},
      {"risk": "Regulatory complexity", "mitigant": "Specialist Kuwaiti legal counsel engaged; 60-day closing buffer; CMA pre-notification", "residualRisk": "Low"},
      {"risk": "Roll-up execution risk", "mitigant": "8 identified sites in pipeline; 15% capex contingency; phased expansion plan", "residualRisk": "Medium"}
    ]
  },
  "exitStrategy": {
    "narrative": "3–4 sentences",
    "exitPaths": [
      {"path": "Strategic Sale to Regional Consolidator", "timing": "Year 3–4", "evRange": "KWD 20–26m", "moic": "2.3–3.0x", "irr": "22–30%", "notes": "Americana, Kout, Agthia — all active acquirers"},
      {"path": "Secondary PE Sale", "timing": "Year 4–5", "evRange": "KWD 18–22m", "moic": "2.0–2.5x", "irr": "18–22%", "notes": "GCC-focused PE funds seeking F&B platforms"},
      {"path": "IPO on Boursa Kuwait", "timing": "Year 5", "evRange": "KWD 22–28m", "moic": "2.5–3.2x", "irr": "20–26%", "notes": "Requires 25+ outlets and 3-year track record post-acquisition"},
      {"path": "Dividend Recapitalisation", "timing": "Year 2–3", "evRange": "KWD 4–6m distribution", "moic": "1.4–1.6x partial", "irr": "N/A", "notes": "Partial liquidity if strategic exit delayed"}
    ],
    "comparableTransactions": [
      {"target": "Kout Food Group (partial)", "acquirer": "Agthia Group", "year": "2023", "ev": "USD 185m", "evEbitda": "8.5x", "notes": "Kuwait QSR platform — closest comparable"},
      {"target": "Americana Restaurants", "acquirer": "PIF / ADQ", "year": "2022", "ev": "USD 2.1bn", "evEbitda": "11.2x", "notes": "GCC-wide platform; premium for scale"},
      {"target": "Herfy Food Services", "acquirer": "Strategic buyer", "year": "2021", "ev": "SAR 1.8bn", "evEbitda": "9.8x", "notes": "Saudi QSR; comparable margin profile"},
      {"target": "Kudu Corp", "acquirer": "Hassana Investment", "year": "2022", "ev": "SAR 2.4bn", "evEbitda": "10.5x", "notes": "Saudi QSR; institutional backing premium"}
    ],
    "preferredPath": "3–4 sentences on preferred exit path and rationale"
  },
  "managementAssessment": {
    "narrative": "3–4 sentences",
    "teamStrengths": ["strength 1 with specific evidence", "strength 2", "strength 3", "strength 4"],
    "teamGaps": ["gap 1 with proposed solution", "gap 2", "gap 3"],
    "keyPersonRisk": "3–4 sentences on key person risk and mitigation",
    "recommendation": "2–3 sentences on management recommendation"
  },
  "dealTerms": {
    "narrative": "3–4 sentences",
    "keyTerms": [
      {"term": "Entry Valuation", "proposed": "KWD 10.03m EV (7.6x LTM EBITDA)", "marketStandard": "6–9x for GCC QSR", "negotiationNote": "Acceptable; push for 7.0x if EBITDA misses in Q1 2026"},
      {"term": "Equity Stake", "proposed": "60% controlling stake", "marketStandard": "51–70% for PE buyouts", "negotiationNote": "Ensure board majority (3 of 5 seats) regardless of stake"},
      {"term": "Seller Rollover", "proposed": "40% retained equity", "marketStandard": "20–40% for founder-led deals", "negotiationNote": "Require drag-along rights after Year 3"},
      {"term": "Non-Compete", "proposed": "5-year, Kuwait-wide", "marketStandard": "3–5 years, geographic scope", "negotiationNote": "Verify enforceability under Kuwaiti Commercial Law"},
      {"term": "Earn-Out", "proposed": "SSSG >8% triggers 5% bonus on seller's 40%", "marketStandard": "Common in founder-led F&B deals", "negotiationNote": "Cap total earn-out at KWD 0.5m; tie to audited EBITDA"},
      {"term": "Management ESOP", "proposed": "10% pool, 4-year vest, EBITDA hurdle", "marketStandard": "5–15% for PE-backed F&B", "negotiationNote": "Ensure CEO receives 60% of pool to retain key person"},
      {"term": "Governance", "proposed": "5-member board, 3 fund nominees", "marketStandard": "Standard for 60% PE stake", "negotiationNote": "Require fund approval for capex >KWD 50K and new franchise agreements"}
    ],
    "redLines": [
      "Franchisor consent for ownership transfer must be obtained pre-close — no exceptions",
      "Full Shariah compliance certification required before fund can deploy capital",
      "Seller non-compete must be legally enforceable under Kuwaiti law — independent legal opinion required",
      "No undisclosed liabilities exceeding KWD 100K — SPA indemnity required for any breach"
    ],
    "preferredOutcome": "3–4 sentences on preferred negotiation outcome"
  },
  "appendix": {
    "comparableTransactionsTable": [
      {"deal": "Kout Food Group / Agthia", "year": "2023", "sector": "Kuwait QSR", "ev": "USD 185m", "multiple": "8.5x EBITDA"},
      {"deal": "Americana / PIF-ADQ", "year": "2022", "sector": "GCC QSR", "ev": "USD 2.1bn", "multiple": "11.2x EBITDA"},
      {"deal": "Herfy Food / Strategic", "year": "2021", "sector": "Saudi QSR", "ev": "SAR 1.8bn", "multiple": "9.8x EBITDA"},
      {"deal": "Kudu Corp / Hassana", "year": "2022", "sector": "Saudi QSR", "ev": "SAR 2.4bn", "multiple": "10.5x EBITDA"},
      {"deal": "Alsea / Vips (MENA)", "year": "2022", "sector": "MENA F&B", "ev": "USD 320m", "multiple": "8.0x EBITDA"}
    ],
    "marketDataSources": [
      {"source": "Euromonitor International", "dataPoint": "Kuwait F&B market size KWD 1.4bn (2023)", "relevance": "Market sizing and CAGR projections"},
      {"source": "BMI Research / Fitch Solutions", "dataPoint": "Kuwait QSR CAGR 7% (2024–2028)", "relevance": "Growth rate assumptions"},
      {"source": "World Bank Open Data", "dataPoint": "Kuwait GDP per capita USD 33,000 (2023)", "relevance": "Consumer spending capacity"},
      {"source": "Kuwait CMA Annual Report", "dataPoint": "F&B sector FDI and licensing data", "relevance": "Regulatory framework"},
      {"source": "Kout Food Group Annual Report", "dataPoint": "8.5x EBITDA acquisition multiple (2023)", "relevance": "Exit multiple benchmark"}
    ],
    "keyAssumptions": [
      {"assumption": "Revenue CAGR", "base": "12%", "bear": "6%", "bull": "18%"},
      {"assumption": "EBITDA Margin (Exit Year)", "base": "31%", "bear": "26%", "bull": "35%"},
      {"assumption": "Exit EV/EBITDA", "base": "8.5x", "bear": "6.5x", "bull": "10.5x"},
      {"assumption": "New Outlets/Year", "base": "2", "bear": "1", "bull": "3"},
      {"assumption": "SSSG", "base": "8%", "bear": "3%", "bull": "12%"},
      {"assumption": "Hold Period", "base": "4 years", "bear": "5 years", "bull": "3 years"}
    ]
  }
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a senior PE investment professional. Return only valid JSON, no markdown, no explanation." },
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
    // ── Design tokens — WHITE background institutional style ──────────────────
    const BG        = "#FFFFFF";   // page background
    const BG2       = "#F8FAFC";   // card / table alt row
    const BG3       = "#F1F5F9";   // table header / section header bg
    const BORDER_C  = "#E2E8F0";   // dividers, borders
    const ACCENT    = "#1E40AF";   // primary blue (dark, readable on white)
    const GREEN     = "#15803D";   // positive / approve
    const AMBER     = "#B45309";   // warning / amber
    const RED       = "#DC2626";   // risk / reject
    const TEXT      = "#0F172A";   // primary body text
    const TEXT2     = "#334155";   // secondary body text
    const MUTED     = "#64748B";   // muted / labels
    const GOLD      = "#92400E";   // gold (dark amber, readable on white)
    const PURPLE    = "#6D28D9";   // non-consensus / purple accent

    const A4_W   = 595.28;
    const A4_H   = 841.89;
    const ML     = 48;
    const MR     = 48;
    const MT     = 44;   // top margin for content (below header)
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
      bufferPages: true,   // ← required for switchToPage to work across all pages
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `IC Memo — ${input.dealName}`,
        Author: "AgenThinkMesh · Council of 10",
        Subject: "Investment Committee Memo",
        Keywords: "IC Memo, Investment Committee, Private Equity",
      },
    });

    // White background + header on every new page
    // _pageNum is incremented by the caller (ensureSpace / newSectionPage)
    doc.on("pageAdded", () => {
      doc.rect(0, 0, A4_W, A4_H).fill(BG);
      // pageHeader will be called by the caller after incrementing _pageNum
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Ensure at least `needed` pts remain on page; add page if not */
    function ensureSpace(needed: number) {
      if (doc.y + needed > A4_H - 60) {
        doc.addPage();
        _pageNum++;
        pageHeader();  // draw header on the new continuation page
        doc.y = MT + 8;
      }
    }

    /** Running page counter */
    let _pageNum = 1;

    /** Render header on current page */
    function pageHeader(sectionLabel?: string) {
      // Top rule
      doc.rect(0, 0, A4_W, 32).fill(BG3);
      doc.rect(0, 32, A4_W, 1).fill(BORDER_C);
      doc.rect(0, 0, 4, 32).fill(ACCENT);
      doc.fontSize(6.5).fillColor(ACCENT).font("Helvetica-Bold")
        .text("AGENTHINK MESH", ML, 10, { continued: false });
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
        .text("COUNCIL OF 10  ·  INVESTMENT COMMITTEE MEMO", ML + 88, 10);
      if (sectionLabel) {
        doc.fontSize(6.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(sectionLabel.toUpperCase(), A4_W - MR - 140, 10, { width: 140, align: "right" });
      } else {
        const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
          .text(dateStr, A4_W - MR - 60, 10, { width: 60, align: "right" });
      }
    }

    /** Render footer on current page */
    function pageFooter(pageNum: number) {
      doc.rect(0, A4_H - 24, A4_W, 1).fill(BORDER_C);
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text("CONFIDENTIAL — For Authorised Investment Committee Members Only. AI-assisted analysis. Not investment advice.",
          ML, A4_H - 16, { width: BODY_W - 30 });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(`${pageNum}`, A4_W - MR - 16, A4_H - 16, { width: 16, align: "right" });
    }

    /** Section divider bar — does NOT force a new page */
    function sectionDivider(num: string, title: string, color: string = ACCENT) {
      ensureSpace(36);
      const sy = doc.y;
      doc.rect(ML, sy, BODY_W, 28).fill(BG3);
      doc.rect(ML, sy, 3, 28).fill(color);
      doc.fontSize(7.5).fillColor(color).font("Helvetica-Bold")
        .text(num, ML + 10, sy + 7, { lineBreak: false });
      doc.fontSize(11).fillColor(TEXT).font("Helvetica-Bold")
        .text(title, ML + 28, sy + 6, { lineBreak: false });
      doc.y = sy + 34;
    }

    /** Sub-heading with thin rule above */
    function subHeading(title: string, color: string = ACCENT) {
      ensureSpace(20);
      const shY = doc.y;
      doc.rect(ML, shY, BODY_W, 0.5).fill(BORDER_C);
      doc.fontSize(7.5).fillColor(color).font("Helvetica-Bold")
        .text(title.toUpperCase(), ML, shY + 6, { characterSpacing: 0.8, lineBreak: false });
      doc.y = shY + 18;
    }

    /** Body paragraph text */
    function bodyText(text: string, color: string = TEXT2) {
      if (!text) return;
      ensureSpace(18);
      doc.fontSize(9.5).fillColor(color).font("Helvetica")
        .text(text, ML, doc.y, { width: BODY_W, lineGap: 2.5, align: "justify" });
      doc.y += 8;
    }

    /** Bullet point */
    function bullet(text: string, color: string = TEXT2, indent: number = 0) {
      if (!text) return;
      ensureSpace(16);
      const x = ML + indent;
      const w = BODY_W - indent;
      doc.circle(x + 4, doc.y + 5, 2).fill(color);
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(text, x + 13, doc.y, { width: w - 13, lineGap: 2 });
      doc.y += 4;
    }

    /** Two-column key-value grid with white cards */
    function kvGrid(items: Array<{ label: string; value: string }>, colCount: number = 2) {
      const colW = BODY_W / colCount;
      const rowH = 30;
      let col = 0;
      let rowStartY = doc.y;

      items.forEach((item, i) => {
        if (col === 0 && i > 0) {
          rowStartY = doc.y;
        }
        ensureSpace(rowH + 4);
        const x = ML + col * colW;
        // Card background
        doc.rect(x, rowStartY, colW - 4, rowH).fill(BG2);
        doc.rect(x, rowStartY, colW - 4, rowH).stroke(BORDER_C);
        doc.fontSize(6.5).fillColor(MUTED).font("Helvetica-Bold")
          .text(item.label.toUpperCase(), x + 8, rowStartY + 5, { width: colW - 20, characterSpacing: 0.3 });
        doc.fontSize(10).fillColor(TEXT).font("Helvetica-Bold")
          .text(item.value, x + 8, rowStartY + 15, { width: colW - 20 });

        col++;
        if (col >= colCount) {
          col = 0;
          doc.y = rowStartY + rowH + 4;
          rowStartY = doc.y;
        }
      });
      if (col > 0) doc.y = rowStartY + rowH + 4;
      doc.y += 6;
    }

    /** Generic table with proper column alignment */
    function table(
      headers: string[],
      rows: string[][],
      colWidths?: number[],
      headerColor: string = ACCENT
    ) {
      const totalW = BODY_W;
      const numCols = headers.length;
      const cw = colWidths ?? headers.map(() => totalW / numCols);

      ensureSpace(24);
      // Header row — save Y, render all headers at same Y, then advance once
      const hdrY = doc.y;
      doc.rect(ML, hdrY, totalW, 18).fill(BG3);
      let cx = ML;
      headers.forEach((h, i) => {
        doc.fontSize(7.5).fillColor(headerColor).font("Helvetica-Bold")
          .text(h, cx + 5, hdrY + 5, { width: cw[i] - 10, lineBreak: false });
        cx += cw[i];
      });
      doc.y = hdrY + 20;

      rows.forEach((row, ri) => {
        // Estimate row height based on longest cell content
        const maxLines = Math.max(...row.map((cell, ci) =>
          Math.ceil((cell ?? "").length / Math.max(1, (cw[ci] - 10) / 5.5))
        ));
        const rowH = Math.max(18, maxLines * 11 + 8);
        ensureSpace(rowH + 2);

        const rowY = doc.y;  // ← capture row Y before any text calls
        if (ri % 2 === 0) doc.rect(ML, rowY, totalW, rowH).fill(BG2);
        cx = ML;
        row.forEach((cell, ci) => {
          doc.fontSize(8.5).fillColor(TEXT2).font("Helvetica")
            .text(cell ?? "", cx + 5, rowY + 4, { width: cw[ci] - 10, lineGap: 1.5, lineBreak: true });
          cx += cw[ci];
          doc.y = rowY;  // ← restore Y after each cell so next cell is on same row
        });
        doc.y = rowY + rowH + 1;  // ← advance Y by full row height only once
      });
      doc.y += 8;
    }

    /** Financial table with label column + year columns */
    function financialTable(years: string[], rows: FinancialRow[], accentCol?: number) {
      const labelW = 160;
      const numCols = years.length;
      const colW = (BODY_W - labelW) / numCols;

      ensureSpace(22);
      // Header — save Y, render all headers at same Y
      const hdrY = doc.y;
      doc.rect(ML, hdrY, BODY_W, 18).fill(BG3);
      years.forEach((y, i) => {
        const x = ML + labelW + i * colW;
        const isAccent = i === accentCol;
        doc.fontSize(7.5).fillColor(isAccent ? GOLD : ACCENT).font("Helvetica-Bold")
          .text(y, x + 2, hdrY + 5, { width: colW - 4, align: "right" });
      });
      doc.y = hdrY + 20;

      rows.forEach((row, ri) => {
        const isHighlight = /EBITDA|Revenue|Free Cash/i.test(row.label);
        const rowH = 16;
        ensureSpace(rowH + 2);
        const rowY = doc.y;  // ← capture row Y
        if (ri % 2 === 0) doc.rect(ML, rowY, BODY_W, rowH).fill(BG2);
        // Label column
        doc.fontSize(8.5)
          .fillColor(isHighlight ? TEXT : MUTED)
          .font(isHighlight ? "Helvetica-Bold" : "Helvetica")
          .text(row.label, ML + 5, rowY + 3, { width: labelW - 10, lineBreak: false });
        // Value columns — each restores rowY
        row.values.forEach((val, i) => {
          const x = ML + labelW + i * colW;
          const isAccent = i === accentCol;
          doc.fontSize(8.5).fillColor(isAccent ? GOLD : TEXT2).font("Helvetica")
            .text(val ?? "—", x + 2, rowY + 3, { width: colW - 4, align: "right", lineBreak: false });
        });
        doc.y = rowY + rowH;  // ← advance once per row
      });
      doc.y += 8;
    }

    /** Sensitivity table with colour-coded cells */
    function sensitivityTable(
      rowLabel: string,
      colLabel: string,
      colHeaders: string[],
      rows: Array<{ label: string; values: string[] }>
    ) {
      const labelW = 64;
      const numCols = colHeaders.length;
      const colW = (BODY_W - labelW) / numCols;

      ensureSpace(28);
      // Corner + headers — save hdrY so all headers render on the same line
      const stHdrY = doc.y;
      doc.rect(ML, stHdrY, BODY_W, 18).fill(BG3);
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica-Bold")
        .text(`${rowLabel} / ${colLabel}`, ML + 3, stHdrY + 5, { width: labelW - 4, lineBreak: false });
      colHeaders.forEach((h, i) => {
        doc.fontSize(7.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(h, ML + labelW + i * colW + 2, stHdrY + 5, { width: colW - 4, align: "center", lineBreak: false });
      });
      doc.y = stHdrY + 20;

      rows.forEach((row) => {
        ensureSpace(16);
        const rowY = doc.y;  // ← capture row Y
        doc.rect(ML, rowY, labelW, 15).fill(BG3);
        doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold")
          .text(row.label, ML + 3, rowY + 3, { width: labelW - 6, align: "center", lineBreak: false });
        row.values.forEach((val, i) => {
          const numVal = parseFloat(val.replace("%", ""));
          const cellBg =
            numVal >= 25 ? "#DCFCE7" :
            numVal >= 20 ? "#D1FAE5" :
            numVal >= 15 ? "#FEF3C7" :
            numVal >= 10 ? "#FFEDD5" : "#FEE2E2";
          const cellTxt =
            numVal >= 25 ? "#15803D" :
            numVal >= 20 ? "#166534" :
            numVal >= 15 ? "#92400E" :
            numVal >= 10 ? "#C2410C" : "#DC2626";
          doc.rect(ML + labelW + i * colW, rowY, colW, 15).fill(cellBg);
          doc.fontSize(8.5).fillColor(cellTxt).font("Helvetica-Bold")
            .text(val, ML + labelW + i * colW + 2, rowY + 3, { width: colW - 4, align: "center", lineBreak: false });
        });
        doc.y = rowY + 16;  // ← advance once per row
      });
      doc.y += 8;
    }

    /** Risk matrix row */
    function riskRow(row: RiskRow, ri: number) {
      const lhColor = row.likelihood === "High" ? RED : row.likelihood === "Medium" ? AMBER : GREEN;
      const impColor = row.impact === "High" ? RED : row.impact === "Medium" ? AMBER : GREEN;
      const catW = 80; const riskW = 155; const lhW = 55; const impW = 55;
      const mitW = BODY_W - catW - riskW - lhW - impW;
      const rowH = Math.max(22, Math.ceil(row.risk.length / 26) * 11 + 8);
      ensureSpace(rowH + 2);
      const rowY = doc.y;  // ← capture row Y before any text calls
      if (ri % 2 === 0) doc.rect(ML, rowY, BODY_W, rowH).fill(BG2);
      doc.fontSize(7.5).fillColor(ACCENT).font("Helvetica-Bold")
        .text(row.category, ML + 4, rowY + 5, { width: catW - 8, lineBreak: false });
      doc.fontSize(8).fillColor(TEXT2).font("Helvetica")
        .text(row.risk, ML + catW + 4, rowY + 5, { width: riskW - 8, lineGap: 1.5, lineBreak: true });
      doc.y = rowY;  // restore after potentially multi-line risk text
      doc.fontSize(8).fillColor(lhColor).font("Helvetica-Bold")
        .text(row.likelihood, ML + catW + riskW + 4, rowY + 5, { width: lhW - 8, align: "center", lineBreak: false });
      doc.fontSize(8).fillColor(impColor).font("Helvetica-Bold")
        .text(row.impact, ML + catW + riskW + lhW + 4, rowY + 5, { width: impW - 8, align: "center", lineBreak: false });
      doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
        .text(row.mitigant, ML + catW + riskW + lhW + impW + 4, rowY + 5, { width: mitW - 8, lineGap: 1.5, lineBreak: true });
      doc.y = rowY + rowH + 1;  // ← advance once per row
    }

    /** Start a new section page with header — always starts on a fresh page */
    function newSectionPage(sectionLabel: string) {
      doc.addPage();
      _pageNum++;
      pageHeader(sectionLabel);
      doc.y = MT + 8;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COVER PAGE
    // ─────────────────────────────────────────────────────────────────────────
    doc.rect(0, 0, A4_W, A4_H).fill(BG);

    // Top accent bar
    doc.rect(0, 0, A4_W, 5).fill(ACCENT);

    // Header band
    doc.rect(0, 5, A4_W, 55).fill(BG3);
    doc.rect(0, 60, A4_W, 1).fill(BORDER_C);
    doc.fontSize(10).fillColor(ACCENT).font("Helvetica-Bold")
      .text("AGENTHINK MESH", ML, 18, { characterSpacing: 1.5 });
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text("COUNCIL OF 10  ·  INVESTMENT COMMITTEE", ML, 32, { characterSpacing: 0.8 });
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text(dateStr, A4_W - MR - 100, 28, { width: 100, align: "right" });

    // Verdict pill
    const verdictBg = input.verdict === "APPROVED" ? "#DCFCE7" :
      input.verdict === "APPROVED_WITH_CONDITIONS" ? "#DBEAFE" : "#FEE2E2";
    doc.rect(ML, 82, BODY_W, 52).fill(verdictBg);
    doc.rect(ML, 82, 4, 52).fill(verdictColor);
    doc.fontSize(20).fillColor(verdictColor).font("Helvetica-Bold")
      .text(verdictLabel, ML + 18, 95);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`${input.yesCount} Yes · ${input.noCount} No · ${Math.round(input.confidenceScore * 100)}% Consensus`,
        ML + 18, 121);

    // Deal name
    doc.y = 152;
    doc.fontSize(24).fillColor(TEXT).font("Helvetica-Bold")
      .text(input.dealName, ML, doc.y, { width: BODY_W });
    doc.y += 36;
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text("INVESTMENT COMMITTEE MEMORANDUM", ML, doc.y, { characterSpacing: 1.2 });
    doc.y += 16;
    doc.rect(ML, doc.y, BODY_W, 0.5).fill(BORDER_C);
    doc.y += 12;

    // Thesis
    if (memo.executiveSummary?.theBet) {
      doc.rect(ML, doc.y, 3, 32).fill(ACCENT);
      doc.fontSize(11).fillColor(TEXT).font("Helvetica-Oblique")
        .text(`"${memo.executiveSummary.theBet}"`, ML + 12, doc.y, { width: BODY_W - 12, lineGap: 3 });
      doc.y += 40;
    }

    // Deal snapshot grid
    if (memo.executiveSummary?.dealSnapshot?.length) {
      kvGrid(memo.executiveSummary.dealSnapshot, 2);
    }

    // Confidentiality — immediately after content, not fixed position
    doc.y += 12;
    doc.rect(ML, doc.y, BODY_W, 0.5).fill(BORDER_C);
    doc.y += 8;
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
      .text("CONFIDENTIAL — For Authorised Investment Committee Members Only.", ML, doc.y, { width: BODY_W, align: "center" });
    doc.y += 10;
    doc.fontSize(7).fillColor(MUTED).font("Helvetica")
      .text("This document contains AI-assisted analysis generated by AgenThinkMesh Council of 10. It does not constitute investment advice.",
        ML, doc.y, { width: BODY_W, align: "center" });

    // ─────────────────────────────────────────────────────────────────────────
    // TABLE OF CONTENTS
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();
    _pageNum++;
    doc.y = MT;
    pageHeader();

    doc.fontSize(15).fillColor(TEXT).font("Helvetica-Bold")
      .text("TABLE OF CONTENTS", ML, doc.y);
    doc.y += 6;
    doc.rect(ML, doc.y, BODY_W, 1.5).fill(ACCENT);
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
      ["15.", "Appendix — Council of 10 Votes"],
    ];

    tocItems.forEach(([num, title]) => {
      ensureSpace(18);
      const tocY = doc.y;  // ← capture Y so number and title are on same line
      // Number
      doc.fontSize(9.5).fillColor(ACCENT).font("Helvetica-Bold")
        .text(num, ML, tocY, { width: 28, lineBreak: false });
      // Title on same line
      doc.fontSize(9.5).fillColor(TEXT).font("Helvetica")
        .text(title, ML + 28, tocY, { width: BODY_W - 28, lineBreak: false });
      // Thin rule below
      doc.rect(ML, tocY + 13, BODY_W, 0.3).fill(BORDER_C);
      doc.y = tocY + 20;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1 — EXECUTIVE SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    newSectionPage("1. Executive Summary");
    sectionDivider("01", "Executive Summary", verdictColor);

    const es = memo.executiveSummary;
    if (es) {
      // Verdict banner
      const esBg = input.verdict === "APPROVED" ? "#DCFCE7" :
        input.verdict === "APPROVED_WITH_CONDITIONS" ? "#DBEAFE" : "#FEE2E2";
      doc.rect(ML, doc.y, BODY_W, 40).fill(esBg);
      doc.rect(ML, doc.y, 3, 40).fill(verdictColor);
      doc.fontSize(13).fillColor(verdictColor).font("Helvetica-Bold")
        .text(verdictLabel, ML + 14, doc.y + 7);
      doc.fontSize(8.5).fillColor(MUTED).font("Helvetica")
        .text(`${input.yesCount}/10 Council Members · ${Math.round(input.confidenceScore * 100)}% Consensus`,
          ML + 14, doc.y + 26);
      doc.y += 48;

      subHeading("The Bet", GOLD);
      if (es.theBet) {
        doc.rect(ML, doc.y, 3, 28).fill(GOLD);
        doc.fontSize(10.5).fillColor(TEXT).font("Helvetica-Oblique")
          .text(es.theBet, ML + 12, doc.y, { width: BODY_W - 12, lineGap: 3 });
        doc.y += 16;
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
    newSectionPage("2. Deal Overview");
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
    newSectionPage("3. Transaction Structure");
    sectionDivider("03", "Transaction Structure", AMBER);

    const ts = memo.transactionStructure;
    if (ts) {
      subHeading("Structure Overview");
      bodyText(ts.narrative ?? "");

      // Sources & Uses — side by side using absolute X positioning
      subHeading("Sources & Uses");
      const halfW = Math.floor((BODY_W - 8) / 2);
      const usesX = ML + halfW + 8;

      // Calculate total height needed for both sides
      const srcRows = ts.sourcesUses?.sources ?? [];
      const useRows = ts.sourcesUses?.uses ?? [];
      const maxRows = Math.max(srcRows.length, useRows.length);
      const tableH = 20 + maxRows * 18 + 4;
      ensureSpace(tableH + 8);

      const suStartY = doc.y;

      // Sources header
      doc.rect(ML, suStartY, halfW, 18).fill(BG3);
      doc.fontSize(7.5).fillColor(GREEN).font("Helvetica-Bold")
        .text("SOURCES", ML + 6, suStartY + 5, { characterSpacing: 0.6 });

      // Uses header
      doc.rect(usesX, suStartY, halfW, 18).fill(BG3);
      doc.fontSize(7.5).fillColor(AMBER).font("Helvetica-Bold")
        .text("USES", usesX + 6, suStartY + 5, { characterSpacing: 0.6 });

      // Sources rows
      srcRows.forEach((s, i) => {
        const rowY = suStartY + 20 + i * 18;
        if (i % 2 === 0) doc.rect(ML, rowY, halfW, 17).fill(BG2);
        doc.fontSize(8.5).fillColor(TEXT2).font("Helvetica")
          .text(s.item, ML + 6, rowY + 4, { width: halfW - 90, lineBreak: false });
        doc.fontSize(8.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(s.amount, ML + halfW - 80, rowY + 4, { width: 50, align: "right" });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(s.pct, ML + halfW - 26, rowY + 5, { width: 22, align: "right" });
      });

      // Uses rows
      useRows.forEach((u, i) => {
        const rowY = suStartY + 20 + i * 18;
        if (i % 2 === 0) doc.rect(usesX, rowY, halfW, 17).fill(BG2);
        doc.fontSize(8.5).fillColor(TEXT2).font("Helvetica")
          .text(u.item, usesX + 6, rowY + 4, { width: halfW - 90, lineBreak: false });
        doc.fontSize(8.5).fillColor(AMBER).font("Helvetica-Bold")
          .text(u.amount, usesX + halfW - 80, rowY + 4, { width: 50, align: "right" });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(u.pct, usesX + halfW - 26, rowY + 5, { width: 22, align: "right" });
      });

      doc.y = suStartY + tableH + 8;

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
    newSectionPage("4. Investment Thesis");
    sectionDivider("04", "Investment Thesis", GREEN);

    const it = memo.investmentThesis;
    if (it) {
      subHeading("Overarching Thesis");
      bodyText(it.overarchingThesis ?? "");

      (it.pillars ?? []).forEach((p, i) => {
        ensureSpace(56);
        // Pillar header card
        doc.rect(ML, doc.y, BODY_W, 20).fill(BG3);
        doc.rect(ML, doc.y, 3, 20).fill(GREEN);
        doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
          .text(`PILLAR ${i + 1}`, ML + 10, doc.y + 4, { characterSpacing: 0.6 });
        doc.fontSize(10.5).fillColor(TEXT).font("Helvetica-Bold")
          .text(p.title ?? "", ML + 60, doc.y + 4);
        doc.y += 26;
        bodyText(p.narrative ?? "");
        if (p.supportingData) {
          // Strip any stray %¶ or unicode arrow artifacts from LLM output
          const cleanData = p.supportingData.replace(/[%\u00B6\u25B6]+\s*/g, "").trim();
          if (cleanData) {
            ensureSpace(14);
            doc.fontSize(8.5).fillColor(AMBER).font("Helvetica-Bold")
              .text(`> ${cleanData}`, ML + 12, doc.y, { width: BODY_W - 12 });
            doc.y += 12;
          }
        }
        doc.y += 4;
      });

      subHeading("Non-Consensus Insight", PURPLE);
      bodyText(it.nonObviousInsight ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5 — MARKET ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    newSectionPage("5. Market Analysis");
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
          [220, 130, 149]
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
    newSectionPage("6. Competitive Landscape");
    sectionDivider("06", "Competitive Landscape", AMBER);

    const cl = memo.competitiveLandscape;
    if (cl) {
      subHeading("Overview");
      bodyText(cl.narrative ?? "");

      subHeading("Comparable Companies");
      if (cl.competitors?.length) {
        table(
          ["Company", "EV/EBITDA", "EV/Rev", "Rev Growth", "EBITDA Margin", "Notes"],
          (cl.competitors ?? []).map(c => [c.company, c.evEbitda, c.evRevenue, c.revenueGrowth, c.ebitdaMargin, c.notes]),
          [120, 58, 55, 62, 72, 132]
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
    newSectionPage("7. Business Model & Unit Economics");
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
          [200, 95, 204]
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
    newSectionPage("8. Historical Financials");
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
    newSectionPage("9. Financial Model");
    sectionDivider("09", "Financial Model", GOLD);

    const fm = memo.financialModel;
    if (fm) {
      subHeading("Key Assumptions");
      if (fm.assumptions?.length) {
        table(
          ["Assumption", "Value", "Rationale"],
          (fm.assumptions ?? []).map(a => [a.assumption, a.value, a.rationale]),
          [160, 75, 264]
        );
      }

      subHeading("Revenue & EBITDA Projections");
      if (fm.revenueProjections?.years?.length && fm.revenueProjections?.rows?.length) {
        financialTable(fm.revenueProjections.years, fm.revenueProjections.rows);
      }

      subHeading("EBITDA Bridge (Entry → Exit)");
      if (fm.ebitdaBridge?.length) {
        fm.ebitdaBridge.forEach((b) => {
          ensureSpace(16);
          const isTotal = /exit|entry/i.test(b.item);
          if (isTotal) doc.rect(ML, doc.y, BODY_W, 15).fill(BG3);
          doc.fontSize(9).fillColor(isTotal ? GOLD : TEXT2)
            .font(isTotal ? "Helvetica-Bold" : "Helvetica")
            .text(b.item, ML + 8, doc.y + 3, { width: 200 });
          doc.fontSize(9).fillColor(isTotal ? GOLD : ACCENT).font("Helvetica-Bold")
            .text(b.amount, ML + 215, doc.y + 3, { width: 80, align: "right" });
          doc.fontSize(8).fillColor(MUTED).font("Helvetica")
            .text(b.notes, ML + 305, doc.y + 3, { width: BODY_W - 305 });
          doc.y += 16;
        });
        doc.y += 8;
      }

      subHeading("IRR Scenarios");
      if (fm.irrScenarios?.length) {
        table(
          ["Scenario", "Entry EV", "Exit EV", "MOIC", "IRR", "Exit Year"],
          (fm.irrScenarios ?? []).map(s => [s.scenario, s.entryEv, s.exitEv, s.moic, s.irr, s.exitYear]),
          [80, 80, 80, 58, 58, 143]
        );
      }

      subHeading("IRR Sensitivity — Exit Multiple vs. Revenue CAGR");
      if (fm.sensitivityTable?.rows?.length) {
        const colHeaders = (fm.sensitivityTable.rows[0]?.values ?? []).map((_, i) =>
          `${5 + i * 2.5}%`
        );
        sensitivityTable(
          fm.sensitivityTable.rowLabel ?? "Exit EV/EBITDA",
          fm.sensitivityTable.colLabel ?? "Revenue CAGR",
          colHeaders.length > 0 ? colHeaders : ["5%", "8%", "10%", "12%", "15%"],
          fm.sensitivityTable.rows
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 10 — RISK ANALYSIS
    // ─────────────────────────────────────────────────────────────────────────
    newSectionPage("10. Risk Analysis");
    sectionDivider("10", "Risk Analysis", RED);

    const ra = memo.riskAnalysis;
    if (ra) {
      subHeading("Risk Overview");
      bodyText(ra.narrative ?? "");

      subHeading("Risk Matrix");
      ensureSpace(22);
      const catW = 80; const riskW = 155; const lhW = 55; const impW = 55;
      const mitW = BODY_W - catW - riskW - lhW - impW;
      doc.rect(ML, doc.y, BODY_W, 18).fill(BG3);
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("CATEGORY", ML + 4, doc.y + 5, { width: catW - 8 });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("RISK", ML + catW + 4, doc.y + 5, { width: riskW - 8 });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("LIKELIHOOD", ML + catW + riskW + 4, doc.y + 5, { width: lhW - 8, align: "center" });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("IMPACT", ML + catW + riskW + lhW + 4, doc.y + 5, { width: impW - 8, align: "center" });
      doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
        .text("MITIGANT", ML + catW + riskW + lhW + impW + 4, doc.y + 5, { width: mitW - 8 });
      doc.y += 20;
      (ra.riskMatrix ?? []).forEach((row, i) => riskRow(row, i));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 11 — MITIGANTS & CONDITIONS
    // ─────────────────────────────────────────────────────────────────────────
    newSectionPage("11. Mitigants & Conditions");
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
          [178, 72, 68, 181]
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
    newSectionPage("12. Exit Strategy");
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
          [130, 52, 68, 44, 44, 161]
        );
      }

      subHeading("Comparable Exit Transactions");
      if (ex.comparableTransactions?.length) {
        table(
          ["Target", "Acquirer", "Year", "EV", "EV/EBITDA", "Notes"],
          (ex.comparableTransactions ?? []).map(t => [t.target, t.acquirer, t.year, t.ev, t.evEbitda, t.notes]),
          [110, 100, 38, 58, 62, 131]
        );
      }

      subHeading("Preferred Exit Path", PURPLE);
      bodyText(ex.preferredPath ?? "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 13 — MANAGEMENT ASSESSMENT
    // ─────────────────────────────────────────────────────────────────────────
    newSectionPage("13. Management Assessment");
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
    newSectionPage("14. Deal Terms & Negotiation");
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
          [90, 120, 100, 189]
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
    newSectionPage("15. Appendix");
    sectionDivider("15", "Appendix", MUTED);

    const app = memo.appendix;
    if (app) {
      subHeading("A. Comparable Transactions");
      if (app.comparableTransactionsTable?.length) {
        table(
          ["Deal", "Year", "Sector", "EV", "Multiple"],
          (app.comparableTransactionsTable ?? []).map(d => [d.deal, d.year, d.sector, d.ev, d.multiple]),
          [160, 44, 80, 78, 137]
        );
      }

      subHeading("B. Market Data Sources");
      if (app.marketDataSources?.length) {
        table(
          ["Source", "Data Point", "Relevance"],
          (app.marketDataSources ?? []).map(s => [s.source, s.dataPoint, s.relevance]),
          [140, 178, 181]
        );
      }

      subHeading("C. Key Assumptions — Base / Bear / Bull");
      if (app.keyAssumptions?.length) {
        table(
          ["Assumption", "Base", "Bear", "Bull"],
          (app.keyAssumptions ?? []).map(a => [a.assumption, a.base, a.bear, a.bull]),
          [200, 78, 78, 143]
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COUNCIL OF 10 — INDIVIDUAL VOTES (Appendix D)
    // ─────────────────────────────────────────────────────────────────────────
    newSectionPage("Appendix D — Council Votes");
    subHeading("D. Council of 10 — Individual Votes");
    doc.y += 4;

    const voteColorMap: Record<string, string> = {
      HARD_YES: GREEN, SOFT_YES: ACCENT, SOFT_NO: AMBER, HARD_NO: RED,
    };
    const voteLabelMap: Record<string, string> = {
      HARD_YES: "HARD YES", SOFT_YES: "SOFT YES", SOFT_NO: "SOFT NO", HARD_NO: "HARD NO",
    };
    const voteBgMap: Record<string, string> = {
      HARD_YES: "#DCFCE7", SOFT_YES: "#DBEAFE", SOFT_NO: "#FEF3C7", HARD_NO: "#FEE2E2",
    };

    input.votes.forEach((v, idx) => {
      const vColor = voteColorMap[v.vote] ?? TEXT;
      const vLabel = voteLabelMap[v.vote] ?? v.vote;
      const vBg    = voteBgMap[v.vote] ?? BG2;
      const confPct = Math.round(v.confidence * 100);

      const estH = 24 +
        Math.ceil((v.rationale ?? "").length / 90) * 12 +
        (v.keyFlags.length ? 14 : 0) +
        (v.conditions.length ? 14 : 0) +
        (v.blockers.length ? 14 : 0) + 12;
      ensureSpace(estH);

      const cardY = doc.y;
      // Card header
      doc.rect(ML, cardY, BODY_W, 20).fill(vBg);
      doc.rect(ML, cardY, 3, 20).fill(vColor);
      doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
        .text(`${String(idx + 1).padStart(2, "0")}`, ML + 8, cardY + 6);
      doc.fontSize(9.5).fillColor(TEXT).font("Helvetica-Bold")
        .text(v.personaRole, ML + 26, cardY + 5, { width: BODY_W - 130 });

      // Vote badge
      const badgeW = 70;
      doc.rect(ML + BODY_W - badgeW - 6, cardY + 2, badgeW, 16).fill(vBg);
      doc.rect(ML + BODY_W - badgeW - 6, cardY + 2, badgeW, 16).stroke(vColor);
      doc.fontSize(7.5).fillColor(vColor).font("Helvetica-Bold")
        .text(vLabel, ML + BODY_W - badgeW - 6, cardY + 6, { width: badgeW, align: "center" });

      // Confidence bar
      const barX = ML + BODY_W - badgeW - 88;
      const barW = 68;
      doc.rect(barX, cardY + 8, barW, 4).fill(BORDER_C);
      doc.rect(barX, cardY + 8, barW * v.confidence, 4).fill(vColor);
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
        .text(`${confPct}%`, barX + barW + 3, cardY + 7);

      doc.y = cardY + 24;

      if (v.rationale) {
        doc.fontSize(9).fillColor(TEXT2).font("Helvetica")
          .text(v.rationale, ML + 12, doc.y, { width: BODY_W - 24, lineGap: 2 });
        doc.y += 6;
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
      doc.rect(ML, doc.y + 3, BODY_W, 0.5).fill(BORDER_C);
      doc.y += 12;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTER ON ALL PAGES
    // ─────────────────────────────────────────────────────────────────────────
    // With bufferPages:true, bufferedPageRange() returns { start, count }
    // switchToPage() uses absolute indices starting from range.start
    const range = (doc as any).bufferedPageRange() as { start: number; count: number };
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      pageFooter(range.start + i + 1);
    }

    doc.flushPages();  // flush all buffered pages before ending
    doc.end();
  });
}
