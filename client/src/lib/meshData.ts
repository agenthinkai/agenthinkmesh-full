// ─────────────────────────────────────────────────────────────────────────────
// AGENTHINKMESH — Shared mesh data: contexts, agents, spawning, layout
// 14 contexts · 112 base agents · 22 spawnable extras
// ─────────────────────────────────────────────────────────────────────────────

export const DOMAIN_MAP: Record<string, { label: string; icon: string }> = {
  finance:    { label: "Finance",    icon: "💹" },
  legal:      { label: "Legal",      icon: "⚖️" },
  healthcare: { label: "Healthcare", icon: "🏥" },
  enterprise: { label: "Enterprise", icon: "🏢" },
  gccwealth:  { label: "GCC Wealth", icon: "🏦" },
};

export interface MeshContext {
  icon: string;
  label: string;
  domain: string;
  color: string;
  agents: string[];
  quickTasks: string[];
  systemPromptBase: string;
}

export const CONTEXTS: Record<string, MeshContext> = {
  // ── Finance ──────────────────────────────────────────────────────────────
  vc: {
    icon: "💹", label: "VC / PE Fund", domain: "finance", color: "#7BA3D4",
    agents: ["Deal Screener","Due Diligence","Portfolio Monitor","LP Comms","Cap Table","Exit Modeler","Valuation","Term Sheet"],
    quickTasks: ["Draft term sheet for new deal","Should we approve this investment?","Write LP update email for Q3","Model exit scenario and recommend timing"],
    systemPromptBase: "You are operating within a VC/PE Fund institutional Mesh. Apply venture capital and private equity frameworks.",
  },
  swf: {
    icon: "💹", label: "Sovereign Wealth Fund", domain: "finance", color: "#7BA3D4",
    agents: ["Asset Allocation","Macro Intel","Risk Monitor","ESG Screener","FX Overlay","Rebalancing","Liquidity","Board Reporter"],
    quickTasks: ["Should we rebalance the portfolio now?","Draft board report for Q3 SWF performance","Write ESG screening memo for new holding","Is our FX exposure compliant with policy?"],
    systemPromptBase: "You are operating within a Sovereign Wealth Fund institutional Mesh. Apply sovereign investment and macro frameworks.",
  },
  fm: {
    icon: "💹", label: "Fund Manager", domain: "finance", color: "#7BA3D4",
    agents: ["iNAV Engine","Compliance","Performance","Trade Exec","Risk Monitor","Report Gen","Benchmark","Investor Notifier"],
    quickTasks: ["Draft investor notification for NAV update","Are we compliant with CBK capital requirements?","Write performance report for fund committee","Should we execute this trade given current risk?"],
    systemPromptBase: "You are operating within a Fund Management institutional Mesh. Apply fund administration and portfolio management frameworks.",
  },
  // ── Legal ─────────────────────────────────────────────────────────────────
  lawfirm: {
    icon: "⚖️", label: "Law Firm", domain: "legal", color: "#7C3AED",
    agents: ["Contract Review","Clause Extractor","Risk Flagger","Jurisdiction Intel","Precedent Search","Draft Gen","Redline","Deadline Monitor"],
    quickTasks: ["Write NDA for new technology partner","Draft supplier collaboration agreement","Should we sign this contract as-is?","Write legal opinion memo on jurisdiction risk"],
    systemPromptBase: "You are operating within a Law Firm institutional Mesh. Apply legal analysis, contract review, and risk assessment frameworks.",
  },
  inhouse: {
    icon: "⚖️", label: "In-House Counsel", domain: "legal", color: "#7C3AED",
    agents: ["Policy Monitor","Regulatory Watch","Contract Tracker","Approval Workflow","Liability Screener","Report Gen","Entity Manager","NDA"],
    quickTasks: ["Are we compliant with new ADGM regulations?","Draft policy memo on regulatory change","Should we approve this vendor contract?","Write entity restructuring recommendation"],
    systemPromptBase: "You are operating within an In-House Counsel institutional Mesh. Apply corporate legal, compliance, and regulatory frameworks.",
  },
  // ── Healthcare ────────────────────────────────────────────────────────────
  hospital: {
    icon: "🏥", label: "Hospital Ops", domain: "healthcare", color: "#059669",
    agents: ["Bed Manager","Staffing Optimizer","Procurement Intel","Patient Flow","Cost Analyzer","Compliance","Incident Logger","Shift Planner"],
    quickTasks: ["Draft incident report for clinical review","Should we approve this procurement request?","Write staffing plan for Q4 peak season","Are we compliant with MOH patient safety standards?"],
    systemPromptBase: "You are operating within a Hospital Operations institutional Mesh. Apply healthcare operations, patient safety, and clinical compliance frameworks.",
  },
  clinical: {
    icon: "🏥", label: "Clinical Research", domain: "healthcare", color: "#059669",
    agents: ["Trial Screener","Protocol Checker","Data Curator","Safety Monitor","Regulatory Mapper","Report Gen","Site Monitor","IRB"],
    quickTasks: ["Draft IRB submission for Phase 2 trial","Are we compliant with GCP protocol requirements?","Write safety signal report for regulatory filing","Should we proceed to next trial phase?"],
    systemPromptBase: "You are operating within a Clinical Research institutional Mesh. Apply clinical trial, GCP, and regulatory submission frameworks.",
  },
  // ── Enterprise ────────────────────────────────────────────────────────────
  hr: {
    icon: "🏢", label: "HR & People Ops", domain: "enterprise", color: "#0891B2",
    agents: ["Talent Screener","Policy Checker","Onboarding","Performance","Comp Benchmarker","Culture Pulse","Leave Tracker","L&D"],
    quickTasks: ["Draft offer letter for senior hire","Write performance improvement plan","Should we approve this compensation package?","Are our HR policies compliant with Kuwait Labour Law?"],
    systemPromptBase: "You are operating within an HR & People Operations institutional Mesh. Apply talent management, HR policy, and organisational development frameworks.",
  },
  procurement: {
    icon: "🏢", label: "Procurement", domain: "enterprise", color: "#0891B2",
    agents: ["Vendor Screener","RFP Analyzer","Contract Tracker","Spend Optimizer","Risk Assessor","Supplier Intel","PO Manager","Audit"],
    quickTasks: ["Draft RFP for new logistics vendor","Should we approve this supplier contract?","Write vendor evaluation report","Are our procurement practices compliant with policy?"],
    systemPromptBase: "You are operating within a Procurement institutional Mesh. Apply vendor management, spend analysis, and supply chain risk frameworks.",
  },
  operations: {
    icon: "🏢", label: "Operations", domain: "enterprise", color: "#0891B2",
    agents: ["Process Monitor","KPI Tracker","Bottleneck Finder","Resource Planner","Incident Logger","Report Gen","SLA Monitor","Escalation"],
    quickTasks: ["Write SLA breach escalation memo","Draft ops performance report for leadership","Should we approve this process change?","Generate Python script to automate KPI tracking"],
    systemPromptBase: "You are operating within an Operations institutional Mesh. Apply process optimisation, KPI management, and operational excellence frameworks.",
  },
  // ── GCC Wealth & Investment Banking ──────────────────────────────────────
  privatewealth: {
    icon: "🏦", label: "Private Wealth Mgmt", domain: "gccwealth", color: "#B45309",
    agents: ["Client Profiler","Suitability Checker","Portfolio Builder","Rebalancing Advisor","Report Generator","Tax Optimizer","Estate Planner","Onboarding Agent"],
    quickTasks: ["Draft client portfolio review letter","Should we recommend this product to the client?","Write suitability assessment for new HNWI client","Are we compliant with DFSA suitability requirements?"],
    systemPromptBase: "You are operating within a GCC Private Wealth Management institutional Mesh. Apply HNWI client profiling, Shariah-compliant product suitability, DFSA/ADGM regulatory frameworks, and GCC estate planning (including Faraid succession law).",
  },
  ibgcc: {
    icon: "🏦", label: "Investment Banking GCC", domain: "gccwealth", color: "#B45309",
    agents: ["Deal Originator","Pitch Deck Builder","Mandate Tracker","Regulatory Mapper","Valuation Agent","Syndication Desk","Tombstone Writer","Compliance Checker"],
    quickTasks: ["Draft pitch deck outline for M&A mandate","Should we proceed with this deal at current valuation?","Write regulatory mapping memo for ADGM listing","Are we compliant with CMA disclosure requirements?"],
    systemPromptBase: "You are operating within a GCC Investment Banking institutional Mesh. Apply M&A, ECM, DCM, and capital markets frameworks with GCC regulatory context (CMA, DFSA, ADGM, Vision 2030).",
  },
  familyoffice: {
    icon: "🏦", label: "Family Office GCC", domain: "gccwealth", color: "#B45309",
    agents: ["Asset Allocator","Alternatives Scout","Succession Planner","Philanthropy Advisor","Real Assets Monitor","FX Hedger","Liquidity Manager","Reporting Agent"],
    quickTasks: ["Draft succession plan memo for family council","Should we increase alternatives allocation?","Write real estate investment recommendation","Are our structures compliant with Faraid succession law?"],
    systemPromptBase: "You are operating within a GCC Family Office institutional Mesh. Apply multi-generational wealth preservation, Shariah-compliant alternatives, GCC real estate, and succession planning frameworks.",
  },
  funddist: {
    icon: "🏦", label: "Fund Distribution GCC", domain: "gccwealth", color: "#B45309",
    agents: ["Investor Matcher","Subscription Tracker","LP Relations Agent","Fund Fact Sheet Writer","Roadshow Planner","Due Diligence Responder","Regulatory Filing Agent","Investor Comms"],
    quickTasks: ["Draft DD questionnaire response for LP","Write roadshow presentation outline","Should we accept this investor subscription?","Are our fund documents compliant with CIMA requirements?"],
    systemPromptBase: "You are operating within a GCC Fund Distribution institutional Mesh. Apply fund marketing, LP relations, CIMA/DFSA fund registration, and institutional investor frameworks.",
  },
};

export const ROLE_CONTEXT_MAP: Record<string, string> = {
  vc: "vc", finance: "vc", legal: "lawfirm", healthcare: "hospital",
  hr: "hr", operations: "operations", procurement: "procurement",
  wealth: "privatewealth", banking: "ibgcc",
};

// ── Spawnable extras ──────────────────────────────────────────────────────────
const SPAWN_RULES: Array<{ keywords: string[]; agents: string[] }> = [
  { keywords: ["risk","exposure","volatility","downside"], agents: ["Risk Assessor","Scenario Modeller"] },
  { keywords: ["esg","sustainability","climate","impact"], agents: ["ESG Analyst","Impact Scorer"] },
  { keywords: ["shariah","islamic","sukuk","halal"], agents: ["Shariah Screener","Sukuk Structurer"] },
  { keywords: ["hnwi","family office","ultra","billionaire"], agents: ["HNWI Profiler","Wealth Structurer"] },
  { keywords: ["fx","currency","hedge","exchange rate"], agents: ["FX Hedger","Currency Analyst"] },
  { keywords: ["ipo","listing","public offering","equity capital"], agents: ["IPO Advisor","Equity Structurer"] },
  { keywords: ["m&a","merger","acquisition","takeover"], agents: ["M&A Advisor","Integration Planner"] },
  { keywords: ["compliance","regulatory","sanction","aml","kyc"], agents: ["Compliance Officer","AML Screener"] },
  { keywords: ["litigation","dispute","arbitration","court"], agents: ["Litigation Analyst","Dispute Resolver"] },
  { keywords: ["clinical","trial","patient","protocol"], agents: ["Clinical Analyst","Protocol Reviewer"] },
  { keywords: ["procurement","vendor","rfp","tender"], agents: ["Procurement Specialist","Vendor Ranker"] },
  { keywords: ["succession","inheritance","estate","faraid"], agents: ["Succession Planner","Estate Structurer"] },
];

export interface AgentNode {
  id: string;
  label: string;
  spawned: boolean;
}

export function inferAgents(task: string, baseAgents: string[]): AgentNode[] {
  const lower = task.toLowerCase();
  const extras: string[] = [];
  for (const rule of SPAWN_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      rule.agents.forEach(a => {
        if (!baseAgents.includes(a) && !extras.includes(a)) extras.push(a);
      });
    }
  }
  const all = [...baseAgents, ...extras].slice(0, 50);
  return all.map((label, i) => ({
    id: "a" + i,
    label,
    spawned: !baseAgents.includes(label),
  }));
}

// ── Radial layout ─────────────────────────────────────────────────────────────
export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  center?: boolean;
  color: string;
  spawned?: boolean;
}

export function buildLayout(agents: AgentNode[], contextColor: string): LayoutNode[] {
  const nodes: LayoutNode[] = [
    { id: "core", label: "Mesh Core", x: 50, y: 50, center: true, color: contextColor },
  ];
  const count = agents.length;
  const rings = count <= 8 ? 1 : count <= 20 ? 2 : 3;
  const perRing = Math.ceil(count / rings);
  agents.forEach((ag, i) => {
    const ring = Math.floor(i / perRing) + 1;
    const posInRing = i % perRing;
    const total = Math.min(perRing, count - (ring - 1) * perRing);
    const angle = (posInRing / total) * 2 * Math.PI - Math.PI / 2;
    const r = ring * (rings === 1 ? 32 : rings === 2 ? 26 : 20);
    nodes.push({
      id: ag.id,
      label: ag.label,
      x: 50 + r * Math.cos(angle),
      y: 50 + r * Math.sin(angle),
      color: ag.spawned ? "#F59E0B" : contextColor,
      spawned: ag.spawned,
    });
  });
  return nodes;
}

// ── Agent-specific placeholder examples ──────────────────────────────────────
// Shown in the query textarea when an agent is selected.
// Keys match the agent label strings used in CONTEXTS[*].agents arrays.
export const AGENT_PLACEHOLDERS: Record<string, string> = {
  // VC / PE Fund
  "Deal Screener":        "e.g. Screen this Series B deal — $8M raise, SaaS, UAE-based, 3x ARR. Should we proceed to due diligence?",
  "Due Diligence":        "e.g. Run due diligence on AgenThink — upload their financials and flag any red flags before we term sheet.",
  "Portfolio Monitor":    "e.g. Which of our portfolio companies are at risk of missing Q3 targets? Flag the top 3 for intervention.",
  "LP Comms":             "e.g. Draft Q3 LP update email — portfolio up 12%, two new investments, one exit in progress.",
  "Cap Table":            "e.g. Model the cap table impact of a $15M Series B at $60M pre-money with 15% ESOP top-up.",
  "Exit Modeler":         "e.g. Model exit scenarios for our logistics holding — trade sale vs IPO vs secondary at 3x, 5x, 8x revenue.",
  "Valuation":            "e.g. Do a DCF valuation of AgenThink based on the uploaded financial projections. Use 12% WACC.",
  "Term Sheet":           "e.g. Draft a term sheet for a $5M seed investment in a GCC fintech — 20% equity, 1x liquidation preference.",

  // Sovereign Wealth Fund
  "Asset Allocation":     "e.g. Should we increase our alternatives allocation from 15% to 25% given current macro conditions?",
  "Macro Intel":          "e.g. Analyse the impact of rising US rates on our GCC fixed income portfolio. What should we rebalance?",
  "Risk Monitor":         "e.g. What is our current VaR exposure across the equity portfolio? Flag any positions exceeding 5% concentration.",
  "ESG Screener":         "e.g. Screen our top 10 holdings against ESG criteria. Which fail our sustainability policy thresholds?",
  "FX Overlay":           "e.g. Analyse our USD/EUR/GBP exposure. Are we within policy limits? Recommend hedging adjustments.",
  "Rebalancing":          "e.g. Our equity allocation has drifted to 68% vs 60% target. Draft a rebalancing recommendation.",
  "Liquidity":            "e.g. Model our liquidity position under a 30-day stress scenario with 20% redemption pressure.",
  "Board Reporter":       "e.g. Draft the Q3 board report — AUM $42B, returns +6.2% YTD, 3 new mandates, ESG progress update.",

  // Fund Manager
  "iNAV Engine":          "e.g. Calculate the iNAV for our GCC equity ETF based on the uploaded constituent prices.",
  "Compliance":           "e.g. Are we compliant with CBK capital adequacy requirements? Upload our latest balance sheet.",
  "Performance":          "e.g. Write a performance attribution report for Q3 — benchmark MSCI GCC, active return +1.8%.",
  "Trade Exec":           "e.g. Should we execute this block trade of 500,000 shares in Aramco at current market conditions?",
  "Report Gen":           "e.g. Generate the monthly investor report for October — NAV, performance, top holdings, outlook.",
  "Benchmark":            "e.g. Compare our fund performance against the S&P 500 and MSCI EM over 1, 3, and 5 years.",
  "Investor Notifier":    "e.g. Draft an investor notification for the upcoming NAV adjustment and distribution announcement.",

  // Law Firm
  "Contract Review":      "e.g. Review this supplier agreement — flag any clauses that expose us to unlimited liability or auto-renewal traps.",
  "Clause Extractor":     "e.g. Extract all payment terms, termination clauses, and IP ownership provisions from the uploaded contract.",
  "Risk Flagger":         "e.g. Flag the top 5 legal risks in this joint venture agreement with a Saudi counterparty.",
  "Jurisdiction Intel":   "e.g. What are the key differences between ADGM and DIFC jurisdiction for a fintech licensing application?",
  "Precedent Search":     "e.g. Find precedents for force majeure clauses in GCC construction contracts post-COVID.",
  "Draft Gen":            "e.g. Draft a shareholders agreement for a 3-party GCC joint venture — 40/35/25 split, UAE LLC structure.",
  "Redline":              "e.g. Redline this NDA — we need stronger confidentiality periods and mutual indemnity provisions.",
  "Deadline Monitor":     "e.g. List all upcoming regulatory filing deadlines for our ADGM-licensed entities in the next 90 days.",

  // In-House Counsel
  "Policy Monitor":       "e.g. Have there been any changes to Kuwait Labour Law in 2025 that affect our HR policies?",
  "Regulatory Watch":     "e.g. Summarise the new CBUAE open banking regulations and their impact on our fintech operations.",
  "Contract Tracker":     "e.g. Which of our vendor contracts are expiring in the next 60 days and need renewal review?",
  "Approval Workflow":    "e.g. Should we approve this vendor contract? Upload the agreement and flag any non-standard terms.",
  "Liability Screener":   "e.g. Screen this partnership agreement for indemnity clauses that could expose us to third-party liability.",
  "Entity Manager":       "e.g. What are the annual compliance obligations for our DIFC holding company and UAE LLC subsidiaries?",
  "NDA":                  "e.g. Draft a mutual NDA for a new technology partnership with a GCC government entity.",

  // Hospital Ops
  "Bed Manager":          "e.g. Analyse our bed occupancy for Q3 — flag wards above 90% and recommend capacity adjustments.",
  "Staffing Optimizer":   "e.g. Draft a staffing plan for the Q4 peak season — we expect 20% higher patient volumes in December.",
  "Procurement Intel":    "e.g. Should we approve this medical equipment procurement request? Compare 3 vendor quotes uploaded.",
  "Patient Flow":         "e.g. Analyse our A&E patient flow data — identify the top 3 bottlenecks causing wait times above 4 hours.",
  "Cost Analyzer":        "e.g. Which departments are over budget in Q3? Upload the cost report and flag variances above 15%.",
  "Incident Logger":      "e.g. Draft an incident report for a medication error in Ward 4 — patient stable, no harm, root cause unknown.",
  "Shift Planner":        "e.g. Build a shift plan for ICU nursing staff for December — 3 shifts, 12 nurses, 2 on leave.",

  // Clinical Research
  "Trial Screener":       "e.g. Screen this Phase 2 trial protocol for eligibility — upload the protocol and flag GCP compliance gaps.",
  "Protocol Checker":     "e.g. Review our Phase 3 trial protocol against ICH E6 GCP guidelines. Flag any deviations.",
  "Data Curator":         "e.g. Summarise the interim efficacy data from our uploaded trial dataset. Flag any safety signals.",
  "Safety Monitor":       "e.g. Analyse the adverse event data from our trial — are there any signals that require DSMB escalation?",
  "Regulatory Mapper":    "e.g. What are the regulatory submission requirements for a Phase 2 oncology trial in Saudi Arabia?",
  "Site Monitor":         "e.g. Review the site monitoring report for Site 03 — flag protocol deviations and corrective actions needed.",
  "IRB":                  "e.g. Draft an IRB submission for a Phase 2 diabetes trial — upload the protocol and consent form.",

  // HR & People Ops
  "Talent Screener":      "e.g. Screen these 5 CVs for a Senior Financial Analyst role — GCC experience required, CFA preferred.",
  "Policy Checker":       "e.g. Are our leave policies compliant with the new UAE Labour Law amendments effective January 2025?",
  "Onboarding":           "e.g. Draft an onboarding plan for a new CFO joining in 30 days — first 90 days, key stakeholders, priorities.",
  "HR Performance":       "e.g. Write a performance improvement plan for an underperforming analyst — 3-month timeline, clear KPIs.",
  "Comp Benchmarker":     "e.g. Is our CFO compensation package competitive for a $500M AUM fund in Dubai? Upload the offer letter.",
  "Culture Pulse":        "e.g. Analyse our employee survey results — identify the top 3 engagement risks and recommend actions.",
  "Leave Tracker":        "e.g. How many days of annual leave liability do we have across the team? Upload the leave register.",
  "L&D":                  "e.g. Design a 6-month L&D programme for our junior analysts — focus on financial modelling and GCC markets.",

  // Procurement
  "Vendor Screener":      "e.g. Screen these 3 IT vendors against our procurement policy — price, SLA, references, financial stability.",
  "RFP Analyzer":         "e.g. Analyse the responses to our logistics RFP — rank vendors by price, capability, and risk profile.",
  "Procurement Contract Tracker": "e.g. Which procurement contracts are expiring in Q1 2026? Flag those with no renewal clause.",
  "Spend Optimizer":      "e.g. Analyse our Q3 procurement spend — identify the top 5 categories with consolidation opportunities.",
  "Risk Assessor":        "e.g. Assess the supply chain risk for our top 10 vendors — flag any single-source dependencies.",
  "Supplier Intel":       "e.g. Research the financial stability and reputation of this new UAE-based logistics supplier.",
  "PO Manager":           "e.g. Should we approve this purchase order for $2.3M of IT equipment? Flag any policy exceptions.",
  "Audit":                "e.g. Conduct a procurement audit for Q3 — flag any purchases that bypassed the approval workflow.",

  // Operations
  "Process Mapper":       "e.g. Map our invoice approval process — identify bottlenecks causing delays beyond 30 days.",
  "SLA Monitor":          "e.g. Which vendors are breaching their SLA commitments? Upload the service performance data.",
  "Incident Tracker":     "e.g. Analyse our IT incident log for Q3 — categorise by severity and identify recurring root causes.",
  "Automation Scout":     "e.g. Which of our manual back-office processes are best suited for RPA automation? Prioritise by ROI.",
  "Cost Controller":      "e.g. Analyse our operational cost structure — identify the top 5 areas for efficiency improvement.",
  "Vendor Manager":       "e.g. Draft a vendor performance review for our top 3 IT suppliers — SLA compliance, quality, responsiveness.",
  "Workflow Designer":    "e.g. Design an automated approval workflow for expense claims above $5,000.",
  "KPI Dashboard":        "e.g. Build a KPI framework for our operations team — 10 metrics covering cost, quality, and speed.",

  // Private Wealth
  "Portfolio Advisor":    "e.g. Should we rebalance this HNWI portfolio? Upload the holdings and recommend adjustments for Q4.",
  "Tax Optimizer":        "e.g. What are the tax implications of this real estate sale for a UAE-resident GCC national?",
  "Estate Planner":       "e.g. Draft an estate planning memo for a GCC family — Faraid succession, offshore structures, philanthropy.",
  "Alternatives Scout":   "e.g. Identify 3 alternative investment opportunities suitable for a $50M family office portfolio.",
  "Real Assets Monitor":  "e.g. Analyse the performance of our GCC real estate holdings — yield, vacancy, capital appreciation.",
  "Philanthropy Advisor": "e.g. Design a philanthropy strategy for a GCC family — Waqf structure, education focus, $5M annual budget.",
  "HNWI Profiler":        "e.g. Build an investment profile for a new HNWI client — risk tolerance, liquidity needs, Shariah preference.",
  "Wealth Structurer":    "e.g. Recommend an offshore holding structure for a GCC family with assets in UAE, KSA, and UK.",

  // IB GCC
  "Deal Originator":      "e.g. Identify M&A targets in the GCC healthcare sector — mid-market, $50-200M EV, profitable.",
  "Pitch Deck Writer":    "e.g. Draft a pitch deck outline for a $100M GCC infrastructure fund — LP audience, 5-year horizon.",
  "Financial Modeler":    "e.g. Build a DCF model for this GCC logistics company — upload the financials and use 10% WACC.",
  "Syndication Agent":    "e.g. Draft a syndication memo for a $200M real estate development loan — 4 banks, equal participation.",
  "Regulatory Filing":    "e.g. What are the CMA filing requirements for a public offering on Tadawul? Draft the checklist.",
  "Roadshow Planner":     "e.g. Plan a 5-city roadshow for our new GCC equity fund — London, New York, Singapore, Zurich, Abu Dhabi.",
  "Tombstone Writer":     "e.g. Write a tombstone announcement for our $150M sukuk issuance for a UAE developer.",
  "Fairness Opinion":     "e.g. Draft a fairness opinion framework for this $80M acquisition — comparable transactions, DCF, multiples.",

  // Family Office GCC
  "Asset Allocator":      "e.g. Recommend an asset allocation for a $200M GCC family office — 10-year horizon, Shariah-compliant.",
  "Succession Planner":   "e.g. Draft a succession plan memo for a 3rd-generation GCC family — governance, Faraid, offshore trusts.",
  "FX Hedger":            "e.g. Analyse our USD/SAR/AED exposure and recommend a hedging strategy for the next 12 months.",
  "Liquidity Manager":    "e.g. Model our liquidity needs for the next 24 months — planned distributions, capital calls, expenses.",
  "Reporting Agent":      "e.g. Generate the Q3 family office report — consolidated AUM, returns by asset class, key decisions.",

  // Fund Distribution GCC
  "Investor Matcher":     "e.g. Match our new GCC infrastructure fund to suitable institutional investors in the Gulf — min $5M ticket.",
  "Subscription Tracker": "e.g. Track the status of our current fundraise — $120M target, $85M committed, 8 investors pending.",
  "LP Relations Agent":   "e.g. Draft a response to an LP's request for additional information on our Q3 performance.",
  "Fund Fact Sheet Writer":"e.g. Write a fund fact sheet for our GCC equity fund — 1-page, institutional audience, DFSA-compliant.",
  "FundDist Roadshow Planner": "e.g. Plan a roadshow for our new sukuk fund — 4 cities, 3 days, target family offices and SWFs.",
  "Due Diligence Responder":"e.g. Draft responses to the LP due diligence questionnaire — upload the DDQ and our fund documents.",
  "Regulatory Filing Agent":"e.g. What are the CIMA registration requirements for our Cayman-domiciled GCC fund? Draft the checklist.",
  "Investor Comms":       "e.g. Draft a quarterly investor letter for our LP base — performance, portfolio update, market outlook.",

  // Spawnable extras
  "Spawned Risk Assessor": "e.g. Assess the risk profile of this investment — upload the term sheet and flag the top 5 risk factors.",
  "Scenario Modeller":    "e.g. Model 3 scenarios for our portfolio: base case, bear case (oil at $50), bull case (oil at $100).",
  "ESG Analyst":          "e.g. Score this company against our ESG framework — upload the sustainability report.",
  "Impact Scorer":        "e.g. Measure the social impact of our microfinance portfolio — jobs created, communities served.",
  "Shariah Screener":     "e.g. Screen this equity portfolio for Shariah compliance — flag any non-compliant holdings.",
  "Sukuk Structurer":     "e.g. Structure a $50M Ijara sukuk for a UAE real estate developer — draft the term sheet.",
  "Spawned Wealth Structurer": "e.g. Recommend a holding structure for a GCC family with assets across 5 jurisdictions.",
  "Currency Analyst":     "e.g. Analyse the impact of a 10% USD depreciation on our GCC fixed income portfolio.",
  "IPO Advisor":          "e.g. Advise on the readiness of this GCC company for a Tadawul IPO — upload the financials.",
  "Equity Structurer":    "e.g. Structure the equity for a $30M Series B — preference shares, anti-dilution, drag-along rights.",
  "M&A Advisor":          "e.g. Advise on this $120M acquisition of a GCC logistics company — synergies, risks, deal structure.",
  "Integration Planner":  "e.g. Draft a 100-day integration plan for the acquisition of a 200-person GCC company.",
  "Compliance Officer":   "e.g. Are we compliant with FATF recommendations for our AML/KYC programme? Upload our policy.",
  "AML Screener":         "e.g. Screen this new client against PEP and sanctions lists — upload the KYC documents.",
  "Litigation Analyst":   "e.g. Analyse the strength of our position in this commercial dispute — upload the contract and correspondence.",
  "Dispute Resolver":     "e.g. Draft a without-prejudice settlement proposal for this $2M contract dispute.",
  "Clinical Analyst":     "e.g. Analyse the Phase 2 efficacy data — is the primary endpoint met? Upload the interim results.",
  "Protocol Reviewer":    "e.g. Review this clinical trial protocol for GCP compliance — flag any deviations from ICH E6.",
  "Procurement Specialist":"e.g. Evaluate these 4 vendor proposals for our ERP implementation — recommend the best fit.",
  "Vendor Ranker":        "e.g. Rank these 5 suppliers by price, quality, delivery time, and financial stability.",
  "Estate Structurer":    "e.g. Design an estate structure for a GCC national with assets in UAE, UK, and Switzerland.",

  // Default fallback
  "Financial Analysis":   "e.g. Do a DCF valuation of AgenThink — upload the financials and use 12% WACC. Also derive the Balance Sheet and Cash Flow Statement.",
};

export const DEFAULT_PLACEHOLDER = "Describe your task — e.g. Screen a Series A deal, Simulate consumer reactions, Analyse pricing sensitivity...";

export function getAgentPlaceholder(agentLabel: string): string {
  return AGENT_PLACEHOLDERS[agentLabel] ?? DEFAULT_PLACEHOLDER;
}
