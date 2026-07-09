// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — LP Registry (Generic Institutional Investor Segments)
// All entries are fully anonymised representative archetypes.
// No real company names or identifiable entities are referenced.
// ─────────────────────────────────────────────────────────────────────────────

export type LPRegion = "GCC" | "Europe" | "US";
export type LPSegment = "SWF" | "Pension" | "SFO" | "FoF" | "Individual";
export type FundStrategy =
  | "Infrastructure"
  | "Private Equity"
  | "Private Credit"
  | "Real Estate"
  | "Growth Equity"
  | "Venture Capital"
  | "Hedge Fund";

export interface LimitedPartner {
  id: string;
  name: string;
  region: LPRegion;
  segment: LPSegment;
  /** Minimum ticket size in USD millions */
  ticketMin: number;
  /** Maximum ticket size in USD millions */
  ticketMax: number;
  /** Preferred fund strategies */
  strategies: FundStrategy[];
  /** Maximum GP track record accepted (years) */
  trackRecordLimit: number;
  /** ESG priority score 1–10 (10 = mandatory Article 9) */
  esgPriority: number;
  /** Sharia compliance required */
  shariaRequired: boolean;
  /** Minimum net IRR hurdle (%) — null if not applicable */
  irrHurdle: number | null;
  /** Maximum management fee tolerance (%) */
  maxManagementFee: number;
  /** Maximum carry tolerance (%) */
  maxCarry: number;
  /** Jurisdiction-specific compliance flags */
  complianceFlags: string[];
  /** Key-man risk sensitive */
  keyManSensitive: boolean;
  /** Requires digital onboarding */
  digitalOnboardingRequired: boolean;
  /** Preferred LP currency */
  currency: string;
  /** Short description */
  description: string;
  /** Segment-specific IC objections (3 per LP) */
  objections: [string, string, string];
}

export const LP_REGISTRY: LimitedPartner[] = [
  // ── 1. Sovereign Wealth Fund ────────────────────────────────────────────────
  {
    id: "apex-sovereign-fund",
    name: "Apex Sovereign Fund",
    region: "GCC",
    segment: "SWF",
    ticketMin: 50,
    ticketMax: 200,
    strategies: ["Infrastructure", "Private Credit"],
    trackRecordLimit: 5,
    esgPriority: 6,
    shariaRequired: true,
    irrHurdle: null,
    maxManagementFee: 1.75,
    maxCarry: 20,
    complianceFlags: ["kuwait-cma", "sharia-aaoifi"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "GCC sovereign wealth vehicle with Sharia-mandated deployment. Focuses on infrastructure and debt instruments structured under Murabaha and Ijara frameworks. Requires AAOIFI-compliant documentation. 5-year GP track record limit.",
    objections: [
      "Strategy is not Sharia-compliant — no Murabaha or Ijara structuring evident in fund terms.",
      "GP track record exceeds our 5-year sovereign mandate limit for emerging managers.",
      "Absence of sovereign share-class with preferred liquidity rights is a hard gate.",
    ],
  },
  // ── 2. Pension Fund ─────────────────────────────────────────────────────────
  {
    id: "global-pension-alliance",
    name: "Global Pension Alliance",
    region: "Europe",
    segment: "Pension",
    ticketMin: 30,
    ticketMax: 100,
    strategies: ["Infrastructure", "Private Equity", "Real Estate"],
    trackRecordLimit: 7,
    esgPriority: 9,
    shariaRequired: false,
    irrHurdle: null,
    maxManagementFee: 1.5,
    maxCarry: 20,
    complianceFlags: ["eu-aifmd", "sfdr-article-9"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "EUR",
    description:
      "European pension fund domiciled in Norway with Article 8/9 SFDR mandate. Requires full ESG disclosure, AIFMD passporting documentation, and sustainability risk integration. Long-duration capital with 10–15 year horizon. 7-year GP track record limit.",
    objections: [
      "No SFDR Article 9 sustainability risk disclosure provided — this is a hard regulatory gate for our investment committee.",
      "AIFMD passporting documentation is absent — we cannot accept capital calls without EU marketing passport confirmation.",
      "ESG integration score below our minimum threshold of 8/10 for new manager commitments.",
    ],
  },
  // ── 3. Single Family Office ─────────────────────────────────────────────────
  {
    id: "horizon-legacy-sfo",
    name: "Horizon Legacy Single Family Office",
    region: "GCC",
    segment: "SFO",
    ticketMin: 5,
    ticketMax: 25,
    strategies: ["Private Equity", "Growth Equity", "Real Estate"],
    trackRecordLimit: 3,
    esgPriority: 5,
    shariaRequired: true,
    irrHurdle: null,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["kuwait-cma", "sharia-aaoifi"],
    keyManSensitive: true,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "GCC single-family office domiciled in Kuwait with Sharia-mandated deployment and strong key-man sensitivity. Focuses on GP-LP carry alignment and key-man risk insulation clauses. 3-year track record limit for new manager relationships.",
    objections: [
      "Key-man risk is unacceptably high — no succession or deputy PM clause in the LPA.",
      "GP-LP carry alignment is misaligned — we require a GP co-invest of minimum 2% of fund size.",
      "Strategy is not Sharia-compliant — no evidence of Sharia supervisory board oversight.",
    ],
  },
  // ── 4. Fund of Funds ────────────────────────────────────────────────────────
  {
    id: "beacon-capital-fof",
    name: "Beacon Capital Fund of Funds",
    region: "Europe",
    segment: "FoF",
    ticketMin: 15,
    ticketMax: 50,
    strategies: ["Private Equity", "Private Credit", "Growth Equity", "Venture Capital"],
    trackRecordLimit: 4,
    esgPriority: 7,
    shariaRequired: false,
    irrHurdle: null,
    maxManagementFee: 1.75,
    maxCarry: 20,
    complianceFlags: ["eu-aifmd", "sfdr-article-8"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "CHF",
    description:
      "Swiss-domiciled fund of funds with absolute return focus and 4-year GP track record limit. Requires AIFMD compliance and SFDR Article 8 disclosure. Diversified across strategies with strong preference for co-investment rights.",
    objections: [
      "No co-investment rights clause in the LPA — our FoF mandate requires at least 10% co-invest allocation.",
      "SFDR Article 8 disclosure is absent — Swiss regulatory equivalence requires full sustainability risk documentation.",
      "GP track record exceeds our 4-year emerging manager threshold — requires enhanced due diligence package.",
    ],
  },
  // ── 5. Individual Accredited Investor ───────────────────────────────────────
  {
    id: "global-network-qualified-private",
    name: "Global Network of Qualified Private Investors",
    region: "US",
    segment: "Individual",
    ticketMin: 0.25,   // $250k
    ticketMax: 2,      // $2M
    strategies: ["Private Equity", "Venture Capital", "Growth Equity", "Hedge Fund"],
    trackRecordLimit: 2,
    esgPriority: 3,
    shariaRequired: false,
    irrHurdle: 8.5,
    maxManagementFee: 2.5,
    maxCarry: 20,
    complianceFlags: ["sec-506c", "accreditation-required"],
    keyManSensitive: false,
    digitalOnboardingRequired: true,
    currency: "USD",
    description:
      "US-based network of qualified private investors with absolute return mandate. Requires net IRR above 8.5%, SEC Rule 506(c) verified-accreditation disclosure, and direct digital onboarding. 2-year track record limit. Decision cycle of 6–8 weeks.",
    objections: [
      "No verified accredited-investor status disclosure footer — SEC Rule 506(c) compliance is mandatory for general solicitation.",
      "Digital onboarding portal is absent — this network will not accept paper-based capital call processes.",
      "Net IRR projection does not clear our 8.5% absolute return hurdle after fee drag.",
    ],
  },
];

export function getLPById(id: string): LimitedPartner | undefined {
  return LP_REGISTRY.find((lp) => lp.id === id);
}

export function getLPsBySegment(segment: LPSegment): LimitedPartner[] {
  return LP_REGISTRY.filter((lp) => lp.segment === segment);
}
