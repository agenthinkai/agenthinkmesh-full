// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — LP Registry (Static, anonymised institutional LPs)
// Spec: SWF/Pension LPs, Family Offices, FoF, Individual Investors
// All entries are fully generic archetypes — no real company names.
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
  // ── SWF ────────────────────────────────────────────────────────────────────
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
      "GCC sovereign wealth vehicle with Sharia-mandated deployment. Focuses on infrastructure and debt instruments structured under Murabaha and Ijara frameworks. Requires AAOIFI-compliant documentation.",
    objections: [
      "Strategy is not Sharia-compliant — no Murabaha or Ijara structuring evident in fund terms.",
      "GP track record exceeds our 5-year sovereign mandate limit for emerging managers.",
      "Absence of sovereign share-class with preferred liquidity rights is a hard gate.",
    ],
  },
  // ── Pension ─────────────────────────────────────────────────────────────────
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
      "European pension fund with Article 8/9 SFDR mandate. Requires full ESG disclosure, AIFMD passporting documentation, and sustainability risk integration. Long-duration capital with 10–15 year horizon.",
    objections: [
      "No SFDR Article 9 sustainability risk disclosure provided — this is a hard regulatory gate for our investment committee.",
      "AIFMD passporting documentation is absent — we cannot accept capital calls without EU marketing passport confirmation.",
      "ESG integration score below our minimum threshold of 8/10 for new manager commitments.",
    ],
  },
  // ── Family Office (SFO) ─────────────────────────────────────────────────────
  {
    id: "horizon-legacy-sfo",
    name: "Horizon Legacy SFO",
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
      "GCC single-family office with Sharia-mandated deployment and strong key-man sensitivity. Focuses on GP-LP carry alignment and key-man risk insulation clauses. Track record limit of 3 years for new manager relationships.",
    objections: [
      "Key-man risk is unacceptably high — no succession or deputy PM clause in the LPA.",
      "GP-LP carry alignment is misaligned — we require a GP co-invest of minimum 2% of fund size.",
      "Strategy is not Sharia-compliant — no evidence of Sharia supervisory board oversight.",
    ],
  },
  // ── Fund of Funds ───────────────────────────────────────────────────────────
  {
    id: "beacon-capital-fof",
    name: "Beacon Capital FoF",
    region: "Europe",
    segment: "FoF",
    ticketMin: 10,
    ticketMax: 50,
    strategies: ["Private Equity", "Private Credit", "Venture Capital", "Growth Equity"],
    trackRecordLimit: 6,
    esgPriority: 7,
    shariaRequired: false,
    irrHurdle: 10,
    maxManagementFee: 1.5,
    maxCarry: 15,
    complianceFlags: ["eu-aifmd"],
    keyManSensitive: false,
    digitalOnboardingRequired: true,
    currency: "CHF",
    description:
      "European fund-of-funds allocator with diversified mandate across PE, credit, and growth strategies. Requires net IRR above 10% hurdle, digital reporting portals, and AIFMD passporting. Typical decision cycle of 8–12 weeks.",
    objections: [
      "Net IRR projection does not clear our 10% FoF hurdle after double layer of fee drag.",
      "No digital reporting portal or LP data room — our operations team requires automated capital call and distribution notices.",
      "AIFMD passporting documentation is absent — EU marketing compliance is non-negotiable.",
    ],
  },
  // ── Individual / UHNWI ──────────────────────────────────────────────────────
  {
    id: "global-network-qpi",
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
      "US individual investor network with absolute return mandate. Prioritises net IRR above 8.5% and is strategy-agnostic. Requires SEC Rule 506(c) verified-accreditation disclosure footer and direct digital onboarding. Shorter decision cycle of 6–8 weeks.",
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
