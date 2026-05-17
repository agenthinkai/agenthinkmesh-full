import ProspectDemoPage, { ProspectConfig } from "./ProspectDemoPage";

const config: ProspectConfig = {
  slug: "markaz",
  firmName: "Markaz (Kuwait Financial Centre)",
  firmTagline: "Kuwait Financial Centre",
  logoUrl: "/manus-storage/markaz_e4b6fc12.png",
  logoAlt: "Markaz — Kuwait Financial Centre",
  accentColor: "bg-sky-500/10",
  accentText: "text-sky-300",
  accentBorder: "border-sky-400/30",
  dealType: "GCC REIT Portfolio Rebalance — Shariah-Screened",
  dealSubtitle: "Real estate fund rebalance across 30 GCC REIT holdings · AED 200M AUM",
  councilMode: "gcc",
  councilEmphasis: ["Shariah Compliance", "Concentration Risk", "GCC Macro", "Regulatory"],
  memoRef: "IC-MARKAZ-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  scenario: [
    { label: "AUM", value: "AED 200M" },
    { label: "Holdings", value: "30 GCC REITs" },
    { label: "Strategy", value: "Shariah-Screened" },
    { label: "Rebalance Type", value: "Sector + Concentration" },
    { label: "Geography", value: "UAE · KSA · Kuwait" },
    { label: "Council Mode", value: "GCC Institutional" },
  ],
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 68,
  overallSummary:
    "The portfolio exhibits elevated concentration in UAE retail REIT sub-sector (42% of NAV), creating single-sector tail risk in a rising-rate environment. Shariah screening is current but three holdings require re-certification following Q1 2026 structural changes. Macro headwinds from USD-peg pressure and GCC office vacancy trends warrant a phased rebalance rather than a single-event rotation. Council recommends reducing retail REIT exposure by 12–15% and reallocating to logistics and healthcare sub-sectors pending Shariah re-certification.",
  agentOutputs: [
    {
      id: "Agent 1 — Shariah Sentinel",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 72,
      summary:
        "Three holdings (ENBD REIT, Emaar Malls REIT, Alinma Retail REIT) require Shariah re-certification following Q1 2026 structural amendments. Current sukuk-to-debt ratios remain within AAOIFI thresholds for 27 of 30 holdings. Recommend conditional hold pending re-certification, with a 45-day remediation window before mandatory divestment.",
      flags: ["3 holdings pending Shariah re-certification", "AAOIFI re-audit required by Q3 2026"],
    },
    {
      id: "Agent 2 — Concentration Risk",
      verdict: "WATCH",
      confidence: 61,
      summary:
        "UAE retail REIT sub-sector represents 42% of portfolio NAV — materially above the 25% single-sector concentration limit in the fund mandate. Top 5 holdings account for 58% of total exposure. Correlation between top holdings is 0.81 (trailing 12M), reducing effective diversification to approximately 8 independent positions from 30 nominal holdings.",
      flags: ["UAE retail REIT: 42% NAV (mandate limit: 25%)", "Top-5 concentration: 58%", "Effective diversification: ~8 positions"],
    },
    {
      id: "Agent 3 — GCC Macro Oracle",
      verdict: "WATCH",
      confidence: 58,
      summary:
        "GCC office vacancy rates are rising (Dubai: +3.2pp YoY, Riyadh: +1.8pp YoY) driven by new supply absorption lag. Retail footfall is recovering post-COVID but e-commerce penetration is accelerating at 18% CAGR, compressing retail REIT rental yields. Logistics and healthcare sub-sectors show positive absorption trends aligned with Vision 2030 and UAE National Agenda 2031.",
      flags: ["Dubai office vacancy +3.2pp YoY", "Retail REIT yield compression risk"],
    },
    {
      id: "Agent 4 — GCC Regulatory Analyst",
      verdict: "ENGAGE",
      confidence: 79,
      summary:
        "All 30 holdings are listed on regulated GCC exchanges (DFM, ADX, Tadawul, Boursa Kuwait). CMA and SCA reporting requirements are current. No regulatory actions or investigations identified. The proposed rebalance is within fund mandate parameters and does not require CMA pre-approval.",
      flags: [],
    },
    {
      id: "Agent 5 — Devil's Advocate",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 55,
      summary:
        "The rebalance thesis assumes logistics and healthcare REIT sub-sectors will absorb the rotation without significant bid-ask spread impact. At AED 200M AUM, a 15% rotation (AED 30M) in Kuwait-listed REITs may face liquidity constraints — average daily trading volume for the three target logistics REITs is AED 4.2M combined. A phased 90-day execution window is recommended to minimise market impact.",
      flags: ["Logistics REIT liquidity: AED 4.2M avg daily volume", "90-day phased execution recommended"],
    },
  ],
  ctaHeading: "Run your own GCC REIT scenario",
  ctaSubheading: "Paste any portfolio memo, REIT prospectus, or fund mandate into the Mesh. The council runs in under 60 seconds.",
  preloadedDealText: `GCC REIT Portfolio Rebalance — Shariah-Screened
AUM: AED 200M | Holdings: 30 GCC REITs | Strategy: Shariah-Screened

Portfolio Overview:
- UAE retail REIT sub-sector: 42% of NAV (mandate limit: 25%)
- Top 5 holdings: 58% of total exposure
- 3 holdings pending Shariah re-certification (AAOIFI Q1 2026)
- Geography: UAE (60%), KSA (25%), Kuwait (15%)

Rebalance Objective:
Reduce retail REIT concentration from 42% to 27% NAV.
Reallocate to GCC logistics and healthcare REIT sub-sectors.
Maintain full Shariah compliance throughout transition.

Council emphasis: Shariah compliance · Concentration risk · GCC macro · Regulatory`,
};

export default function MarkazDemo() {
  return <ProspectDemoPage config={config} />;
}
