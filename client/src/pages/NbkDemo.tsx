import ProspectDemoPage, { ProspectConfig } from "./ProspectDemoPage";

const config: ProspectConfig = {
  slug: "nbk",
  firmName: "NBK Capital",
  firmTagline: "NBK Capital",
  logoUrl: "/manus-storage/nbk_c5f77091.jpg",
  logoAlt: "NBK Capital",
  accentColor: "bg-blue-500/10",
  accentText: "text-blue-300",
  accentBorder: "border-blue-400/30",
  dealType: "PE Deal Screening — Mid-Market GCC Industrial",
  dealSubtitle: "$50M ticket · Industrial sector · EBITDA validation · Mid-market GCC target",
  councilMode: "gcc",
  councilEmphasis: ["Valuation", "GCC Macro", "Challenger Agent", "Exit Strategy"],
  memoRef: "IC-NBK-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  scenario: [
    { label: "Ticket Size", value: "$50M" },
    { label: "Sector", value: "Industrial" },
    { label: "Stage", value: "Mid-Market PE" },
    { label: "Geography", value: "GCC" },
    { label: "EBITDA Multiple", value: "7.2x" },
    { label: "Council Mode", value: "GCC Institutional" },
  ],
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 65,
  overallSummary:
    "The target presents a credible mid-market industrial platform with defensible GCC market position and Vision 2030 / UAE National Agenda tailwinds. Entry multiple of 7.2x EBITDA is at the upper bound of comparable GCC industrial transactions (5.8–7.5x range, trailing 24M). EBITDA quality requires validation — management adjustments represent 18% of reported EBITDA, above the 12% threshold that typically triggers additional diligence. Council recommends proceeding to exclusivity subject to EBITDA quality-of-earnings review and management adjustment normalisation.",
  agentOutputs: [
    {
      id: "Agent 1 — Valuation Analyst",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 66,
      summary:
        "Entry at 7.2x EBITDA is at the upper bound of GCC industrial comparables (median: 6.1x, range: 5.8–7.5x). Management-adjusted EBITDA of $6.9M includes $1.24M of non-recurring items (18% of reported EBITDA). Normalised EBITDA of $5.66M implies an effective entry multiple of 8.8x — materially above the comparable median. A quality-of-earnings review is required before price finalisation.",
      flags: ["Management adjustments: 18% of EBITDA (threshold: 12%)", "Effective entry multiple: 8.8x on normalised EBITDA"],
    },
    {
      id: "Agent 2 — GCC Macro Oracle",
      verdict: "ENGAGE",
      confidence: 73,
      summary:
        "GCC industrial sector is structurally supported by Vision 2030 localisation mandates (Saudi content requirements: 35% by 2030) and UAE industrial strategy targeting AED 300B in manufacturing output by 2031. The target's exposure to government-linked industrial contracts provides revenue visibility. Oil price at $87/bbl supports government capex programs that drive industrial demand.",
      flags: [],
    },
    {
      id: "Agent 3 — Challenger Agent",
      verdict: "WATCH",
      confidence: 58,
      summary:
        "The bull case assumes 15% revenue CAGR driven by Vision 2030 contract wins. However, GCC government procurement timelines have historically slipped 12–24 months from initial award to revenue recognition. The target has no track record of winning government contracts above $5M — the proposed $50M ticket assumes a step-change in contract scale that has not been demonstrated. Challenger agent rates the revenue CAGR assumption as optimistic by 4–6pp.",
      flags: ["No track record of contracts >$5M", "Vision 2030 procurement timeline risk: 12–24M slip"],
    },
    {
      id: "Agent 4 — Exit Strategist",
      verdict: "ENGAGE",
      confidence: 70,
      summary:
        "Exit pathways are credible: (1) strategic sale to GCC industrial conglomerate (Agility, SABIC, Emirates Steel — all active acquirers in the segment); (2) IPO on DFM or Tadawul at 5-year horizon, supported by GCC exchange IPO pipeline momentum; (3) secondary PE sale. At a 5-year hold with 12% EBITDA CAGR and 6.5x exit multiple, base case IRR is 18.4% on invested capital — above the 15% hurdle rate.",
      flags: [],
    },
    {
      id: "Agent 5 — CFO / Unit Economics",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 62,
      summary:
        "Working capital cycle is 94 days (industry median: 72 days), indicating potential cash conversion inefficiency. Capex intensity is 8.2% of revenue — elevated for the sector (median: 5.5%) — suggesting the asset base may require maintenance investment that compresses free cash flow. Debt-to-EBITDA at close would be 3.1x (covenant: 3.5x), leaving limited headroom for add-on acquisitions in years 1–2.",
      flags: ["Working capital cycle: 94 days (median: 72)", "Capex intensity: 8.2% (median: 5.5%)", "Debt/EBITDA headroom: 0.4x"],
    },
  ],
  ctaHeading: "Run your own PE screening",
  ctaSubheading: "Paste any CIM, management presentation, or deal memo into the Mesh. EBITDA validation and council output in under 60 seconds.",
  preloadedDealText: `PE Deal Screening — Mid-Market GCC Industrial Target
Ticket: $50M | Sector: Industrial | Stage: Mid-Market PE

Deal Parameters:
- Entry multiple: 7.2x EBITDA
- Reported EBITDA: $6.9M (management-adjusted)
- Management adjustments: $1.24M (18% of EBITDA)
- Normalised EBITDA: $5.66M → effective entry 8.8x
- Revenue: $84M trailing twelve months
- Geography: UAE/KSA industrial operations
- Government contract exposure: 45% of revenue

Investment Thesis:
Vision 2030 and UAE National Agenda industrial localisation tailwinds.
Target holds 3 long-term government supply contracts.
15% revenue CAGR projected over 5-year hold.

Exit: Strategic sale or Tadawul/DFM IPO at 5-year horizon.
Target IRR: 18.4% base case at 6.5x exit multiple.

Council emphasis: Valuation · EBITDA quality · GCC macro · Challenger · Exit`,
};

export default function NbkDemo() {
  return <ProspectDemoPage config={config} />;
}
