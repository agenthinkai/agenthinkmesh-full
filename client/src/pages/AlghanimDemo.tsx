import ProspectDemoPage, { ProspectConfig } from "./ProspectDemoPage";

const config: ProspectConfig = {
  slug: "alghanim",
  firmName: "Alghanim Industries",
  firmTagline: "Alghanim Industries",
  logoUrl: "/manus-storage/alghanim_5dbe5e90.png",
  logoAlt: "Alghanim Industries",
  accentColor: "bg-emerald-500/10",
  accentText: "text-emerald-300",
  accentBorder: "border-emerald-400/30",
  dealType: "M&A Target Screening — Retail / Auto Adjacent",
  dealSubtitle: "$100M acquisition · KSA expansion play · Retail and automotive adjacent sector",
  councilMode: "gcc",
  councilEmphasis: ["Valuation", "Concentration Risk", "ESG", "Exit Strategy"],
  memoRef: "IC-ALGHANIM-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  scenario: [
    { label: "Deal Size", value: "$100M" },
    { label: "Sector", value: "Retail / Auto Adjacent" },
    { label: "Geography", value: "KSA Expansion" },
    { label: "Deal Type", value: "Acquisition" },
    { label: "Revenue Multiple", value: "1.8x" },
    { label: "Council Mode", value: "GCC Institutional" },
  ],
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 67,
  overallSummary:
    "The target presents a strategically coherent bolt-on for Alghanim's retail and automotive distribution platform, with direct synergy potential in KSA's rapidly growing consumer market. Entry at 1.8x revenue and 9.1x EBITDA is within the range of comparable GCC retail M&A transactions. The primary risk is integration complexity — the target operates on legacy ERP infrastructure incompatible with Alghanim's Oracle stack, creating a 12–18 month integration runway and $8–12M integration capex requirement. ESG screening flags a moderate governance concern (family-controlled board, no independent directors). Council recommends proceeding to exclusivity with governance remediation as a closing condition.",
  agentOutputs: [
    {
      id: "Agent 1 — Valuation Analyst",
      verdict: "ENGAGE",
      confidence: 71,
      summary:
        "Entry at 1.8x revenue and 9.1x EBITDA is within the GCC retail M&A comparable range (revenue: 1.2–2.1x, EBITDA: 7.5–10.5x, trailing 24M transactions). Synergy case adds $6–9M EBITDA annually through procurement consolidation and shared logistics — implying a post-synergy entry multiple of 6.8–7.4x. The $100M price is defensible at base case synergy realisation.",
      flags: [],
    },
    {
      id: "Agent 2 — ESG Analyst",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 63,
      summary:
        "Governance: family-controlled board with no independent directors — below GCC Corporate Governance Code minimum (2 independent directors for companies with >KWD 5M equity). Environmental: no material ESG violations identified; carbon footprint is within sector norms. Social: labour practices are compliant with KSA Saudisation requirements (Nitaqat: Green band). Governance remediation (appointment of 2 independent directors) should be a closing condition.",
      flags: ["No independent directors (GCC CG Code minimum: 2)", "Governance remediation required as closing condition"],
    },
    {
      id: "Agent 3 — Concentration Risk",
      verdict: "WATCH",
      confidence: 60,
      summary:
        "Post-acquisition, KSA revenue would represent 34% of Alghanim's consolidated group revenue — up from 18% currently. This increases geographic concentration risk in a market where regulatory environment for foreign-owned retail is evolving under Vision 2030. The target's top 3 customers account for 41% of its revenue, creating customer concentration risk that does not diversify the acquirer's existing portfolio.",
      flags: ["KSA revenue post-acquisition: 34% of group (from 18%)", "Target top-3 customers: 41% of target revenue"],
    },
    {
      id: "Agent 4 — Exit Strategist",
      verdict: "ENGAGE",
      confidence: 74,
      summary:
        "The acquisition is a strategic hold, not a financial PE play. Exit optionality exists through: (1) partial IPO of the combined KSA retail platform on Tadawul (3–5 year horizon, supported by Vision 2030 IPO pipeline); (2) strategic sale to a GCC conglomerate seeking KSA retail exposure. The acquisition enhances Alghanim's overall exit optionality for a potential group-level transaction or partial listing.",
      flags: [],
    },
    {
      id: "Agent 5 — Devil's Advocate",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 56,
      summary:
        "The integration risk is the most underweighted factor in the deal thesis. Legacy ERP incompatibility (target: SAP B1, Alghanim: Oracle Fusion) requires a full data migration — historically a 12–18 month programme with 40% cost overrun probability. The $8–12M integration capex estimate is likely understated; comparable ERP migrations in GCC retail have run $15–20M. Synergy realisation should be modelled with an 18-month delay and 30% haircut to be conservative.",
      flags: ["ERP incompatibility: SAP B1 vs Oracle Fusion", "Integration capex likely understated: $15–20M comparable", "Synergy delay: 18 months + 30% haircut recommended"],
    },
  ],
  ctaHeading: "Run your own M&A screening",
  ctaSubheading: "Paste any CIM, acquisition brief, or target profile into the Mesh. Valuation, ESG, and integration risk council output in under 60 seconds.",
  preloadedDealText: `M&A Target Screening — Retail / Auto Adjacent
Deal Size: $100M | Sector: Retail/Automotive Adjacent | Geography: KSA

Deal Parameters:
- Entry multiple: 1.8x revenue, 9.1x EBITDA
- Target revenue: $55M trailing twelve months
- Target EBITDA: $11M (20% margin)
- Synergy case: $6–9M EBITDA annually (procurement + logistics)
- Post-synergy entry multiple: 6.8–7.4x EBITDA

Strategic Rationale:
Bolt-on acquisition for GCC retail/automotive distribution platform.
KSA expansion play aligned with Vision 2030 consumer market growth.
Procurement consolidation and shared logistics synergies.

Integration Risk:
- Legacy ERP: SAP B1 (target) vs Oracle Fusion (acquirer)
- Integration capex: $8–12M estimated (12–18 month programme)
- Governance: family-controlled board, no independent directors

Council emphasis: Valuation · Concentration risk · ESG · Exit strategy`,
};

export default function AlghanimDemo() {
  return <ProspectDemoPage config={config} />;
}
