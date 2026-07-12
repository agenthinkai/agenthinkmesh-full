// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — LP Registry (Generic Institutional Investor Segments)
// All entries are fully anonymised representative archetypes.
// No real company names or identifiable entities are referenced.
// ─────────────────────────────────────────────────────────────────────────────

export type LPRegion = "GCC" | "Europe" | "US" | "Asia" | "North America";
export type LPSegment = "SWF" | "Pension" | "SFO" | "FoF" | "Individual" | "Endowment";
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
  // ── 1. Sovereign Wealth Fund ───────────────────────────────────────────────
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
      "European pension fund with Article 8/9 SFDR mandate. Requires full ESG disclosure, AIFMD passporting documentation, and sustainability risk integration. Long-duration capital with 10–15 year horizon.",
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
  // ── 6. Pacific Rim Sovereign Trust ────────────────────────────────────────
  {
    id: "pacific-rim-sovereign-trust",
    name: "Pacific Rim Sovereign Trust",
    region: "Asia",
    segment: "SWF",
    ticketMin: 30,
    ticketMax: 100,
    strategies: ["Venture Capital", "Private Credit"],
    trackRecordLimit: 5,
    esgPriority: 6,
    shariaRequired: false,
    irrHurdle: null,
    maxManagementFee: 1.75,
    maxCarry: 20,
    complianceFlags: ["mas-cis"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "Singapore-domiciled sovereign trust with a mandate across Venture and Credit strategies. Operates under MAS Collective Investment Scheme regulations. 5-year track record limit for new manager relationships. ESG integration at 6/10 with preference for climate-adjacent infrastructure.",
    objections: [
      "GP track record exceeds our 5-year sovereign mandate limit for emerging managers.",
      "No MAS CIS-compliant offering document provided — Singapore regulatory requirements must be met before capital commitment.",
      "Strategy does not include climate-adjacent infrastructure exposure, which is a priority allocation theme for this trust.",
    ],
  },
  // ── 7. Al-Hamra Legacy SFO ──────────────────────────────────────────────────
  {
    id: "al-hamra-legacy-sfo",
    name: "Al-Hamra Legacy SFO",
    region: "GCC",
    segment: "SFO",
    ticketMin: 10,
    ticketMax: 25,
    strategies: ["Private Credit", "Infrastructure"],
    trackRecordLimit: 3,
    esgPriority: 4,
    shariaRequired: true,
    irrHurdle: null,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["kuwait-cma", "sharia-aaoifi"],
    keyManSensitive: true,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "Kuwait-domiciled single-family office with Sharia-mandated deployment. Focuses on Private Debt and Infrastructure structured under Murabaha and Ijara frameworks. 3-year track record limit. Strong key-man sensitivity with mandatory succession clause requirements.",
    objections: [
      "No Sharia supervisory board oversight documented — AAOIFI-compliant structuring is a hard gate for this SFO.",
      "Key-man risk is unacceptably high — the LPA must include a named deputy PM succession clause before IC review.",
      "GP track record of 3+ years triggers enhanced due diligence — a full fund cycle audit is required.",
    ],
  },
  // ── 8. Academia Global Endowment Fund ──────────────────────────────────────
  {
    id: "academia-global-endowment",
    name: "Academia Global Endowment Fund",
    region: "North America",
    segment: "Endowment",
    ticketMin: 5,
    ticketMax: 20,
    strategies: ["Venture Capital", "Private Credit"],
    trackRecordLimit: 4,
    esgPriority: 8,
    shariaRequired: false,
    irrHurdle: null,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["sec-506b"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "US-based academic endowment fund with ESG 8/10 mandate and 4-year track record limit. Focuses on Venture Capital and Credit strategies with a long-duration perpetual capital horizon. Requires full ESG integration methodology and sustainability risk disclosure.",
    objections: [
      "ESG integration score below our minimum threshold of 8/10 — full sustainability risk disclosure and PAI statement required.",
      "GP track record exceeds our 4-year emerging manager threshold — enhanced due diligence package required.",
      "No co-investment rights clause in the LPA — our endowment mandate requires at least 5% co-invest allocation.",
    ],
  },
  // ── 9. GCC Elite Syndicate ──────────────────────────────────────────────────
  {
    id: "gcc-elite-syndicate",
    name: "GCC Elite Syndicate",
    region: "GCC",
    segment: "Individual",
    ticketMin: 1,
    ticketMax: 5,
    strategies: ["Hedge Fund", "Growth Equity", "Private Equity"],
    trackRecordLimit: 2,
    esgPriority: 3,
    shariaRequired: true,
    irrHurdle: 10,
    maxManagementFee: 2.5,
    maxCarry: 20,
    complianceFlags: ["kuwait-cma", "sharia-aaoifi"],
    keyManSensitive: false,
    digitalOnboardingRequired: true,
    currency: "USD",
    description:
      "Saudi Arabia-based network of accredited GCC private investors with absolute return mandate and Sharia compliance requirement. Net IRR hurdle of 10%. 2-year track record limit. Requires digital onboarding and AAOIFI-compliant structuring documentation.",
    objections: [
      "Strategy is not Sharia-compliant — no Murabaha or Ijara structuring evident in the fund terms.",
      "Net IRR projection does not clear our 10% absolute return hurdle after fee drag.",
      "Digital onboarding portal is absent — this syndicate will not accept paper-based capital call processes.",
    ],
  },
  // ── 10. North American Teachers Pension Pool ────────────────────────────────
  {
    id: "north-american-teachers-pension",
    name: "North American Teachers Pension Pool",
    region: "North America",
    segment: "Pension",
    ticketMin: 25,
    ticketMax: 75,
    strategies: ["Infrastructure", "Private Equity"],
    trackRecordLimit: 6,
    esgPriority: 9,
    shariaRequired: false,
    irrHurdle: null,
    maxManagementFee: 1.5,
    maxCarry: 20,
    complianceFlags: ["sec-506b"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "CAD",
    description:
      "Canada-based teachers pension pool with ESG 9/10 mandate and 6-year track record limit. Focuses on ESG Buyouts and Infrastructure with a long-duration 15–20 year capital horizon. Requires full sustainability risk disclosure and ESG integration methodology aligned with UNPRI.",
    objections: [
      "ESG integration score below our minimum threshold of 9/10 — full UNPRI-aligned sustainability disclosure required before IC review.",
      "GP track record exceeds our 6-year limit — a full fund cycle audit with stress-scenario performance attribution is required.",
      "No infrastructure allocation within the proposed portfolio — our mandate requires minimum 40% infrastructure exposure.",
    ],
  },
];

export function getLPById(id: string): LimitedPartner | undefined {
  return LP_REGISTRY.find((lp) => lp.id === id);
}

export function getLPsBySegment(segment: LPSegment): LimitedPartner[] {
  return LP_REGISTRY.filter((lp) => lp.segment === segment);
}
