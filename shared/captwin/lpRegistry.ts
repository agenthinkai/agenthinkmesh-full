// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — LP Registry (Generic Institutional Investor Segments)
// All entries are fully anonymised representative archetypes.
// No real company names or identifiable entities are referenced.
// ─────────────────────────────────────────────────────────────────────────────

export type LPRegion = "GCC" | "Europe" | "US" | "Asia" | "North America";
export type LPSegment = "SWF" | "Pension" | "SFO" | "MFO" | "FoF" | "Individual" | "Endowment" | "Foundation";
export type FundStrategy =
  | "Infrastructure"
  | "Private Equity"
  | "Private Credit"
  | "Real Estate"
  | "Growth Equity"
  | "Venture Capital"
  | "Hedge Fund"
  | "Direct Lending"
  | "Real Assets"
  | "Opportunistic Credit";

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
  // ── 11. Al-Falah Capital Partners (UAE SFO) ────────────────────────────────
  {
    id: "al-falah-capital-partners-uae",
    name: "Al-Falah Capital Partners",
    region: "GCC",
    segment: "SFO",
    ticketMin: 15,
    ticketMax: 50,
    strategies: ["Private Credit", "Private Equity"],
    trackRecordLimit: 3,
    esgPriority: 6,
    shariaRequired: true,
    irrHurdle: 8,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["sharia-aaoifi"],
    keyManSensitive: true,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "UAE-domiciled single-family office with Sharia-mandated deployment. Focuses on Private Credit and Private Equity within the GCC region, seeking long-term capital preservation and growth. 3-year track record limit with strong key-man sensitivity. Informed by BNY Mellon GCC SFO Report and KPMG GCC Wealth Report 2024.",
    objections: [
      "Strategy is not Sharia-compliant — AAOIFI-compliant structuring documentation is a hard gate before IC review.",
      "GP track record exceeds our 3-year emerging manager limit — a full fund cycle audit is required.",
      "No key-man succession clause in the LPA — this SFO requires a named deputy PM provision before commitment.",
    ],
  },
  // ── 12. Riyadh Heritage Capital Partners (Saudi SFO) ────────────────────────
  {
    id: "riyadh-heritage-capital-partners",
    name: "Riyadh Heritage Capital Partners",
    region: "GCC",
    segment: "SFO",
    ticketMin: 10,
    ticketMax: 30,
    strategies: ["Private Credit", "Private Equity", "Real Estate", "Venture Capital"],
    trackRecordLimit: 5,
    esgPriority: 7,
    shariaRequired: true,
    irrHurdle: 8,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["sharia-aaoifi"],
    keyManSensitive: true,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "Saudi Arabia-domiciled single-family office with diversified alternative investment mandate. Prioritises Private Credit and Private Equity with Sharia compliance. 5-year track record limit. Requires robust ESG frameworks and sustainability risk disclosure. Informed by EY GCC Wealth Management Industry Report 2025 and S&P Global private debt data.",
    objections: [
      "No Sharia supervisory board oversight documented — AAOIFI-compliant structuring is a hard gate.",
      "GP track record exceeds our 5-year limit — enhanced due diligence package with full fund cycle audit required.",
      "ESG framework not disclosed — this SFO requires full sustainability risk methodology before IC review.",
    ],
  },
  // ── 13. Al-Waha Capital Partners (Kuwait MFO) ────────────────────────────────
  {
    id: "al-waha-capital-partners-kuwait",
    name: "Al-Waha Capital Partners",
    region: "GCC",
    segment: "MFO",
    ticketMin: 20,
    ticketMax: 75,
    strategies: ["Private Credit", "Private Equity", "Real Estate", "Venture Capital"],
    trackRecordLimit: 3,
    esgPriority: 7,
    shariaRequired: true,
    irrHurdle: 9.5,
    maxManagementFee: 1.75,
    maxCarry: 20,
    complianceFlags: ["kuwait-cma", "sharia-aaoifi"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "Kuwait-domiciled multi-family office serving 5–15 UHNWI families. Generates stable Sharia-compliant returns through diversified private market investments with a strong emphasis on Private Credit. Net IRR hurdle of 9.5%. 3-year track record limit. Informed by Kuwait CMA public disclosures and KPMG GCC private credit analysis.",
    objections: [
      "Strategy is not Sharia-compliant — AAOIFI and Kuwait CMA documentation is a hard gate before IC review.",
      "Net IRR projection does not clear our 9.5% absolute return hurdle after fee drag.",
      "GP track record exceeds our 3-year emerging manager limit — full fund cycle audit required.",
    ],
  },
  // ── 14. Continental European Pension Partners (Netherlands) ─────────────────
  {
    id: "continental-european-pension-partners",
    name: "Continental European Pension Partners",
    region: "Europe",
    segment: "Pension",
    ticketMin: 50,
    ticketMax: 150,
    strategies: ["Private Credit", "Direct Lending"],
    trackRecordLimit: 3,
    esgPriority: 9,
    shariaRequired: false,
    irrHurdle: null,
    maxManagementFee: 1.5,
    maxCarry: 15,
    complianceFlags: ["sfdr-article-8", "eu-aifmd"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "EUR",
    description:
      "Netherlands-domiciled large institutional pension pool with strict SFDR Article 8 mandate. Actively allocates to Private Credit and Direct Lending, seeking risk-adjusted returns with positive environmental and social outcomes. 3-year track record limit. Informed by Dutch pension fund public disclosures and SFDR regulatory filings.",
    objections: [
      "No SFDR Article 8 sustainability disclosure — full PAI statement and ESG integration methodology required before IC review.",
      "GP track record exceeds our 3-year emerging manager limit — enhanced due diligence package required.",
      "AIFMD passporting documentation absent — EU marketing compliance requires full passporting disclosure.",
    ],
  },
  // ── 15. Nordic Sustainable Credit Pension Fund (Sweden) ─────────────────────
  {
    id: "nordic-sustainable-credit-pension",
    name: "Nordic Sustainable Credit Pension Fund",
    region: "Europe",
    segment: "Pension",
    ticketMin: 25,
    ticketMax: 100,
    strategies: ["Private Credit", "Direct Lending"],
    trackRecordLimit: 3,
    esgPriority: 8,
    shariaRequired: false,
    irrHurdle: 8.5,
    maxManagementFee: 1.5,
    maxCarry: 15,
    complianceFlags: ["sfdr-article-9", "eu-aifmd"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "EUR",
    description:
      "Sweden-domiciled impact-focused pension fund with strict SFDR Article 9 mandate. Considers Private Credit a core allocation, focusing on Direct Lending and stressed credits. Requires minimum ESG score and robust fundamental analysis from all managers. Informed by HedgeNordic analysis of Nordic pension private credit allocations.",
    objections: [
      "No SFDR Article 9 impact disclosure — full sustainability objectives statement and PAI indicators required.",
      "Net IRR projection does not clear our 8.5% hurdle rate after fee drag and ESG overlay costs.",
      "AIFMD passporting documentation absent — EU marketing compliance requires full passporting disclosure.",
    ],
  },
  // ── 16. North American Public Employee Retirement System (USA) ──────────────
  {
    id: "north-american-public-employee-retirement",
    name: "North American Public Employee Retirement System",
    region: "North America",
    segment: "Pension",
    ticketMin: 30,
    ticketMax: 100,
    strategies: ["Private Credit", "Private Equity", "Real Assets", "Infrastructure"],
    trackRecordLimit: 5,
    esgPriority: 8,
    shariaRequired: false,
    irrHurdle: 8.5,
    maxManagementFee: 1.75,
    maxCarry: 20,
    complianceFlags: ["sec-506b"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "USA-domiciled public employee retirement system with diversified alternatives mandate including Private Credit, Real Assets, and Infrastructure. Strong ESG integration with 8/10 priority. 5-year track record limit. Informed by CalPERS public disclosures, American Investment Council reports, and Ontario Teachers' Pension Plan public statements.",
    objections: [
      "ESG integration score below our minimum threshold of 8/10 — full UNPRI-aligned sustainability disclosure required.",
      "GP track record exceeds our 5-year limit — full fund cycle audit with stress-scenario performance attribution required.",
      "No infrastructure allocation within the proposed portfolio — our mandate requires minimum 30% real assets exposure.",
    ],
  },
  // ── 17. Academic Capital Management (USA Endowment) ─────────────────────────
  {
    id: "academic-capital-management-usa",
    name: "Academic Capital Management",
    region: "North America",
    segment: "Endowment",
    ticketMin: 10,
    ticketMax: 30,
    strategies: ["Private Credit", "Private Equity", "Venture Capital", "Real Assets"],
    trackRecordLimit: 5,
    esgPriority: 7,
    shariaRequired: false,
    irrHurdle: 8.3,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["sec-506b"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "USD",
    description:
      "USA-domiciled university endowment with perpetual capital horizon and active alternatives allocation. Focuses on long-term capital appreciation through Private Credit, Private Equity, and Venture Capital. ESG 7/10 priority with full sustainability risk disclosure required. Informed by SEC ADV filings and industry reports on Ivy League endowment investment strategies.",
    objections: [
      "ESG integration score below our minimum threshold of 7/10 — full sustainability risk disclosure and PAI statement required.",
      "GP track record exceeds our 5-year emerging manager threshold — enhanced due diligence package required.",
      "No co-investment rights clause in the LPA — our endowment mandate requires at least 5% co-invest allocation.",
    ],
  },
  // ── 18. Commonwealth Academic Investment Trust (UK Foundation) ───────────────
  {
    id: "commonwealth-academic-investment-trust",
    name: "Commonwealth Academic Investment Trust",
    region: "Europe",
    segment: "Foundation",
    ticketMin: 5,
    ticketMax: 20,
    strategies: ["Private Equity", "Venture Capital", "Private Credit", "Opportunistic Credit"],
    trackRecordLimit: 5,
    esgPriority: 9,
    shariaRequired: false,
    irrHurdle: 5,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["eu-aifmd", "sfdr-article-8"],
    keyManSensitive: false,
    digitalOnboardingRequired: false,
    currency: "GBP",
    description:
      "UK-domiciled university foundation with long-term capital growth mandate supporting educational and research initiatives. Strong emphasis on intergenerational equity and responsible investing. ESG 9/10 priority. AIFMD-compliant. 5-year track record limit. Informed by Oxford Endowment Fund Report 2025 and UK university foundation public disclosures.",
    objections: [
      "No SFDR Article 8 sustainability disclosure — full PAI statement and ESG integration methodology required.",
      "AIFMD passporting documentation absent — UK marketing compliance requires full FCA registration disclosure.",
      "GP track record exceeds our 5-year limit — full fund cycle audit with intergenerational equity assessment required.",
    ],
  },
  // ── 19. Al-Nour Private Capital Syndicate (UAE UHNWI) ───────────────────────
  {
    id: "al-nour-private-capital-syndicate",
    name: "Al-Nour Private Capital Syndicate",
    region: "GCC",
    segment: "Individual",
    ticketMin: 2,
    ticketMax: 10,
    strategies: ["Private Equity", "Private Credit", "Real Estate"],
    trackRecordLimit: 5,
    esgPriority: 7,
    shariaRequired: true,
    irrHurdle: 8.5,
    maxManagementFee: 2.5,
    maxCarry: 20,
    complianceFlags: ["sharia-aaoifi"],
    keyManSensitive: false,
    digitalOnboardingRequired: true,
    currency: "USD",
    description:
      "UAE-domiciled UHNWI syndicate operating through club deal structures. Focuses on Sharia-compliant growth-oriented private companies and real assets. Net IRR hurdle of 8.5%. Requires digital onboarding and AAOIFI-compliant structuring documentation. Informed by GCC UHNWI investment trend reports and Sharia-compliant finance publications.",
    objections: [
      "Strategy is not Sharia-compliant — AAOIFI-compliant structuring documentation is a hard gate before IC review.",
      "Net IRR projection does not clear our 8.5% absolute return hurdle after fee drag.",
      "Digital onboarding portal is absent — this syndicate will not accept paper-based capital call processes.",
    ],
  },
  // ── 20. Northern Private Capital Syndicate (USA UHNWI) ──────────────────────
  {
    id: "northern-private-capital-syndicate",
    name: "Northern Private Capital Syndicate",
    region: "North America",
    segment: "Individual",
    ticketMin: 1,
    ticketMax: 5,
    strategies: ["Private Equity", "Venture Capital", "Private Credit", "Real Estate"],
    trackRecordLimit: 5,
    esgPriority: 6,
    shariaRequired: false,
    irrHurdle: 8,
    maxManagementFee: 2.5,
    maxCarry: 20,
    complianceFlags: ["sec-506b"],
    keyManSensitive: false,
    digitalOnboardingRequired: true,
    currency: "USD",
    description:
      "USA-domiciled accredited investor syndicate focused on co-investment opportunities alongside established sponsors. Seeks diversified exposure to alternative assets with preference for direct and co-investment structures. 5-year track record limit. Informed by SEC guidance on accredited investors and family office co-investment reports.",
    objections: [
      "No co-investment rights clause in the LPA — this syndicate requires at least 10% co-invest allocation per deal.",
      "Net IRR projection does not clear our 8% hurdle rate after fee drag.",
      "Digital onboarding portal is absent — this syndicate requires fully digital subscription and capital call processes.",
    ],
  },
];

export function getLPById(id: string): LimitedPartner | undefined {
  return LP_REGISTRY.find((lp) => lp.id === id);
}

export function getLPsBySegment(segment: LPSegment): LimitedPartner[] {
  return LP_REGISTRY.filter((lp) => lp.segment === segment);
}
