import ProspectDemoPage, { ProspectConfig } from "./ProspectDemoPage";

const config: ProspectConfig = {
  slug: "kamco",
  firmName: "Kamco Invest",
  firmTagline: "Kamco Invest",
  logoUrl: "/manus-storage/kamco_f66ab1a8.jpg",
  logoAlt: "Kamco Invest",
  accentColor: "bg-indigo-500/10",
  accentText: "text-indigo-300",
  accentBorder: "border-indigo-400/30",
  dealType: "Sukuk Allocation Strategy — 5Y GRE Issuance",
  dealSubtitle: "Fixed income mandate · Conservative risk band · GCC government-related entity sukuk",
  councilMode: "gcc",
  councilEmphasis: ["Yield Optimisation", "Credit Risk", "Tax Efficiency", "Regulatory"],
  memoRef: "IC-KAMCO-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  scenario: [
    { label: "Instrument", value: "5Y GRE Sukuk" },
    { label: "Mandate", value: "Fixed Income" },
    { label: "Risk Band", value: "Conservative" },
    { label: "Issuer Type", value: "Government-Related" },
    { label: "Geography", value: "GCC Sovereign" },
    { label: "Council Mode", value: "GCC Institutional" },
  ],
  overallVerdict: "ENGAGE",
  overallConfidence: 74,
  overallSummary:
    "The 5-year GRE sukuk issuance presents a structurally sound allocation opportunity within a conservative fixed income mandate. GCC GRE credit quality remains supported by sovereign backstop mechanisms and oil revenue buffers above $80/bbl breakeven. Yield spread over US Treasuries (T+165bps) is within the mandate's target range. AAOIFI Shariah compliance is confirmed. Primary risk is USD-peg duration exposure if Fed pivot timing deviates from consensus. Council recommends allocation at 8–12% of fixed income sleeve with a 3-year duration hedge overlay.",
  agentOutputs: [
    {
      id: "Agent 1 — Credit Risk Analyst",
      verdict: "ENGAGE",
      confidence: 78,
      summary:
        "GRE issuer carries implicit sovereign guarantee from a GCC government with AA- equivalent credit profile. Debt-to-GDP ratio remains below 35%. Oil revenue buffer provides 18-month liquidity runway at current burn rate. No covenant breaches or rating watch actions identified in the trailing 24 months. Credit spread of T+165bps is fair value for the risk profile.",
      flags: [],
    },
    {
      id: "Agent 2 — Shariah Sentinel",
      verdict: "ENGAGE",
      confidence: 82,
      summary:
        "Sukuk structure is Ijarah-based, certified by AAOIFI-accredited Shariah board. Asset pool consists of government infrastructure assets with clear ownership transfer mechanism. No prohibited income streams identified. Periodic distribution rate is fixed (not floating), eliminating riba ambiguity. Shariah compliance confirmed.",
      flags: [],
    },
    {
      id: "Agent 3 — GCC Macro Oracle",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 63,
      summary:
        "USD-peg exposure is the primary macro risk. If the Fed maintains higher-for-longer policy through H2 2026, GCC central banks face imported monetary tightening that could compress GRE refinancing capacity. Brent crude at $87/bbl provides comfortable fiscal buffer, but a sustained drop below $70/bbl would trigger sovereign support re-evaluation. Base case supports the allocation; tail risk warrants duration hedge.",
      flags: ["USD-peg duration risk if Fed pivot delayed", "Oil price sensitivity below $70/bbl"],
    },
    {
      id: "Agent 4 — CFO / Unit Economics",
      verdict: "ENGAGE",
      confidence: 71,
      summary:
        "At T+165bps over 5Y UST (current yield: 4.82%), the all-in yield of 6.47% exceeds the mandate's minimum hurdle rate of 5.50% by 97bps. Duration of 4.3 years is within the mandate's 3–5 year target range. Tax treatment in Kuwait is favourable — no withholding tax on sukuk distributions for institutional investors. Net yield after custody and management fees: approximately 6.12%.",
      flags: [],
    },
    {
      id: "Agent 5 — Devil's Advocate",
      verdict: "WATCH",
      confidence: 54,
      summary:
        "The 'implicit sovereign guarantee' on GRE debt has not been tested in a stress scenario for this issuer. Comparable GRE restructurings (Dubai World 2009, Oman GRE 2020) demonstrate that implicit guarantees can be renegotiated under fiscal pressure. The 8–12% allocation limit is appropriate; concentration above 15% of the fixed income sleeve would be imprudent without an explicit government guarantee letter.",
      flags: ["Implicit guarantee untested under stress", "Concentration limit: 15% of fixed income sleeve"],
    },
  ],
  ctaHeading: "Run your own sukuk scenario",
  ctaSubheading: "Paste any sukuk term sheet, credit memo, or fixed income mandate into the Mesh. Council output in under 60 seconds.",
  preloadedDealText: `Sukuk Allocation Strategy — 5Y GRE Issuance
Instrument: 5-Year Government-Related Entity Sukuk
Mandate: Conservative Fixed Income | Risk Band: Conservative

Deal Parameters:
- Structure: Ijarah Sukuk (AAOIFI-certified)
- Tenor: 5 years
- Spread: T+165bps over 5Y UST
- All-in yield: ~6.47%
- Issuer: GCC Government-Related Entity (AA- equivalent)
- Shariah: AAOIFI-certified, Ijarah structure

Mandate Constraints:
- Minimum yield hurdle: 5.50%
- Duration target: 3–5 years
- Conservative risk band
- No speculative-grade exposure

Council emphasis: Yield optimisation · Credit risk · Tax efficiency · Regulatory`,
};

export default function KamcoDemo() {
  return <ProspectDemoPage config={config} />;
}
