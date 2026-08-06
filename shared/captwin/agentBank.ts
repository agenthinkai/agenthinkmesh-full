/**
 * CapTwin LP Agent Bank v1
 * Version: 2.0.0
 *
 * Nine anonymised institutional allocator archetypes.
 * Every profile is labelled "Synthetic LP Archetype".
 * No identifiable institution names are used.
 * Not validated against real allocator responses.
 * Must be updated when calibration data is available.
 *
 * DISCLAIMER: These are evidence-based synthetic simulations.
 * They are not predictions of real allocator behaviour.
 */

// ── Version ───────────────────────────────────────────────────────────────────
export const LP_AGENT_BANK_VERSION = "2.0.0";
export const LP_OBJECTION_RULES_VERSION = "2.0.0";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type AllocatorSegmentType =
  | "Sovereign Wealth Fund"
  | "Public Pension Fund"
  | "Corporate Pension Fund"
  | "Insurance Company"
  | "Single Family Office"
  | "Multi-Family Office"
  | "University Endowment"
  | "Fund of Funds"
  | "Islamic Institutional Allocator";

export type LikelihoodBand = "Low" | "Moderate" | "High" | "Very High";
export type SeverityLevel = "Low" | "Moderate" | "High" | "Critical";
export type FitCategory = "Strong Fit" | "Conditional Fit" | "Weak Fit" | "Likely Ineligible";
export type OutreachPriority = "First Priority" | "Secondary" | "Avoid For Now" | "Not Applicable";
export type VerificationStatus = "Unverified" | "Partially Verified" | "Verified";

// ── LP Agent Profile ──────────────────────────────────────────────────────────

export interface LPAgent {
  /** Unique stable identifier */
  id: string;
  /** Display name — anonymised archetype label */
  name: string;
  /** MUST always be "Synthetic LP Archetype" */
  label: "Synthetic LP Archetype";
  /** Segment classification */
  segmentType: AllocatorSegmentType;
  /** Primary mandate description */
  mandate: string;
  /** Geographic focus */
  geography: string;
  /** Typical ticket size range (USD millions) */
  ticketSizeMinM: number;
  ticketSizeMaxM: number;
  /** Preferred asset classes */
  preferredAssetClasses: string[];
  /** Preferred fund size range (USD millions) */
  fundSizeMinM: number;
  fundSizeMaxM: number;
  /** Minimum net IRR threshold (%) — null if not applicable */
  returnThresholdPct: number | null;
  /** Liquidity tolerance: "Illiquid OK" | "Moderate" | "Liquid Required" */
  liquidityTolerance: string;
  /** Typical investment horizon (years) */
  investmentHorizonYrs: number;
  /** Minimum GP track record required (years) */
  trackRecordRequiredYrs: number;
  /** Whether first-time funds are considered */
  firstTimeFundTolerance: boolean;
  /** Maximum management fee tolerance (%) */
  maxManagementFeePct: number;
  /** Maximum carried interest tolerance (%) */
  maxCarryPct: number;
  /** Minimum GP commitment expected (% of fund) */
  minGpCommitmentPct: number;
  /** Governance requirements */
  governanceRequirements: string;
  /** Reporting expectations */
  reportingExpectations: string;
  /** Co-investment preferences */
  coInvestmentPreference: string;
  /** ESG requirements */
  esgRequirements: string;
  /** Whether Sharia compliance is required */
  shariaRequired: boolean;
  /** Typical diligence duration (months) */
  diligenceDurationMonths: number;
  /** Decision authority */
  decisionAuthority: string;
  /** Common objections raised by this segment */
  commonObjections: string[];
  /** Factors that trigger commitment */
  commitmentTriggers: string[];
  /** Factors that trigger rejection */
  rejectionTriggers: string[];
  /** Evidence basis for this archetype */
  evidenceBasis: string;
  /** Verification status */
  verificationStatus: VerificationStatus;
  /** Registry version */
  registryVersion: string;
}

// ── LP Agent Bank ─────────────────────────────────────────────────────────────

export const LP_AGENT_BANK: LPAgent[] = [

  // ── 1. Sovereign Wealth Fund ────────────────────────────────────────────────
  {
    id: "swf-001",
    name: "Sovereign Capital Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Sovereign Wealth Fund",
    mandate: "Long-term wealth preservation and diversification for a national reserve. Deploys across private markets with a focus on infrastructure, private credit, and large-cap private equity. Capital preservation takes precedence over return maximisation.",
    geography: "Global, with concentration in developed markets and GCC",
    ticketSizeMinM: 50,
    ticketSizeMaxM: 300,
    preferredAssetClasses: ["Infrastructure", "Private Credit", "Private Equity", "Real Assets"],
    fundSizeMinM: 500,
    fundSizeMaxM: 10000,
    returnThresholdPct: null,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 15,
    trackRecordRequiredYrs: 8,
    firstTimeFundTolerance: false,
    maxManagementFeePct: 1.75,
    maxCarryPct: 20,
    minGpCommitmentPct: 1.0,
    governanceRequirements: "LPAC seat required for commitments above USD 100M. Quarterly reporting. Audited financials within 90 days of year-end.",
    reportingExpectations: "Quarterly NAV, annual audited accounts, ESG impact report, portfolio company updates.",
    coInvestmentPreference: "Co-investment rights expected on all deals above USD 50M. Pro-rata rights preferred.",
    esgRequirements: "ESG policy required. Article 8 or equivalent preferred. Exclusion list must be provided.",
    shariaRequired: false,
    diligenceDurationMonths: 9,
    decisionAuthority: "Investment committee with board ratification above threshold commitment size.",
    commonObjections: [
      "Track record too short for fund size requested",
      "GP commitment below institutional minimum",
      "Governance structure does not include LPAC representation",
      "Reporting frequency insufficient",
      "ESG framework not documented",
    ],
    commitmentTriggers: [
      "Audited track record exceeding 8 years with realized exits",
      "GP commitment of 2%+ of fund",
      "LPAC seat offered",
      "Co-investment rights confirmed in side letter",
    ],
    rejectionTriggers: [
      "First-time fund",
      "No realized exits",
      "Fund size below USD 500M",
      "Management fee above 2%",
    ],
    evidenceBasis: "Derived from publicly available sovereign wealth fund investment policies, annual reports, and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 2. Public Pension Fund ──────────────────────────────────────────────────
  {
    id: "ppf-001",
    name: "Public Pension Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Public Pension Fund",
    mandate: "Generate risk-adjusted returns to meet defined-benefit pension obligations. Allocates to private equity, infrastructure, and real assets. Subject to public accountability and regulatory oversight.",
    geography: "North America, Europe",
    ticketSizeMinM: 25,
    ticketSizeMaxM: 200,
    preferredAssetClasses: ["Private Equity", "Infrastructure", "Real Assets", "Private Credit"],
    fundSizeMinM: 300,
    fundSizeMaxM: 5000,
    returnThresholdPct: 8,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 12,
    trackRecordRequiredYrs: 7,
    firstTimeFundTolerance: false,
    maxManagementFeePct: 1.75,
    maxCarryPct: 20,
    minGpCommitmentPct: 1.0,
    governanceRequirements: "Fiduciary standard required. Investment policy statement compliance. Board-approved allocation limits.",
    reportingExpectations: "Quarterly performance reports, annual audited accounts, public disclosure compliance.",
    coInvestmentPreference: "Co-investment rights valued but not required. Preferred for large commitments.",
    esgRequirements: "ESG integration required. Exclusion of controversial weapons, tobacco. Climate risk disclosure preferred.",
    shariaRequired: false,
    diligenceDurationMonths: 8,
    decisionAuthority: "Investment committee with trustee board approval for commitments above threshold.",
    commonObjections: [
      "Net IRR below actuarial return assumption",
      "Fund size too small for meaningful portfolio allocation",
      "Weak realized exits — unrealized value too high",
      "Fee load reduces net return below hurdle",
      "Governance does not meet fiduciary standard",
    ],
    commitmentTriggers: [
      "Net IRR track record above 8% over multiple funds",
      "Realized DPI above 1.5x",
      "Fund size large enough to absorb minimum ticket",
      "Strong reference checks from peer institutions",
    ],
    rejectionTriggers: [
      "No prior fund track record",
      "Unrealized value above 70% of portfolio",
      "Net IRR below 7%",
      "Fees above 2% management + 20% carry without hurdle",
    ],
    evidenceBasis: "Derived from public pension fund investment policy statements, CIO interviews, and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 3. Corporate Pension Fund ───────────────────────────────────────────────
  {
    id: "cpf-001",
    name: "Corporate Pension Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Corporate Pension Fund",
    mandate: "Match pension liabilities with risk-adjusted returns. Conservative allocation to private markets with emphasis on liability-driven investment. Prefers income-generating strategies.",
    geography: "North America, Europe",
    ticketSizeMinM: 10,
    ticketSizeMaxM: 75,
    preferredAssetClasses: ["Private Credit", "Infrastructure", "Real Assets"],
    fundSizeMinM: 200,
    fundSizeMaxM: 3000,
    returnThresholdPct: 7,
    liquidityTolerance: "Moderate",
    investmentHorizonYrs: 10,
    trackRecordRequiredYrs: 5,
    firstTimeFundTolerance: false,
    maxManagementFeePct: 1.5,
    maxCarryPct: 15,
    minGpCommitmentPct: 1.0,
    governanceRequirements: "Fiduciary compliance. Liability-matching framework. Sponsor approval for large commitments.",
    reportingExpectations: "Semi-annual performance reports, annual audited accounts.",
    coInvestmentPreference: "Limited appetite for co-investment. Prefers passive LP role.",
    esgRequirements: "Basic ESG policy required. Exclusion list for controversial sectors.",
    shariaRequired: false,
    diligenceDurationMonths: 6,
    decisionAuthority: "Pension committee with sponsor CFO approval.",
    commonObjections: [
      "Strategy too illiquid for liability profile",
      "Carry too high relative to net return",
      "Fund term too long",
      "J-curve too steep for near-term obligations",
    ],
    commitmentTriggers: [
      "Income-generating strategy with predictable cash flows",
      "Short J-curve",
      "Low fee load",
      "Strong credit quality in portfolio",
    ],
    rejectionTriggers: [
      "Venture capital or early-stage strategy",
      "Fund term above 12 years",
      "No income distribution mechanism",
    ],
    evidenceBasis: "Derived from corporate pension fund investment guidelines and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 4. Insurance Company ────────────────────────────────────────────────────
  {
    id: "ins-001",
    name: "Insurance Allocator Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Insurance Company",
    mandate: "Deploy insurance float into private markets to generate risk-adjusted returns above liability cost. Regulatory capital constraints limit illiquid exposure. Prefers investment-grade credit and infrastructure.",
    geography: "North America, Europe, Asia",
    ticketSizeMinM: 15,
    ticketSizeMaxM: 100,
    preferredAssetClasses: ["Private Credit", "Infrastructure", "Real Assets"],
    fundSizeMinM: 300,
    fundSizeMaxM: 5000,
    returnThresholdPct: 6,
    liquidityTolerance: "Moderate",
    investmentHorizonYrs: 10,
    trackRecordRequiredYrs: 5,
    firstTimeFundTolerance: false,
    maxManagementFeePct: 1.5,
    maxCarryPct: 15,
    minGpCommitmentPct: 0.5,
    governanceRequirements: "Solvency II / NAIC capital treatment required. Regulatory approval for large commitments.",
    reportingExpectations: "Quarterly reports with capital treatment data, annual audited accounts.",
    coInvestmentPreference: "Limited co-investment appetite. Regulatory capital cost is a constraint.",
    esgRequirements: "ESG integration required. Climate risk disclosure. Exclusion of fossil fuel extraction preferred.",
    shariaRequired: false,
    diligenceDurationMonths: 7,
    decisionAuthority: "CIO with board risk committee approval.",
    commonObjections: [
      "Regulatory capital charge too high",
      "Strategy too illiquid for insurance balance sheet",
      "Leverage concern — amplifies capital charge",
      "Currency risk not hedged",
    ],
    commitmentTriggers: [
      "Investment-grade credit quality",
      "Predictable income distributions",
      "Favourable Solvency II capital treatment",
      "Currency hedging available",
    ],
    rejectionTriggers: [
      "Equity-like risk profile",
      "No income distribution",
      "Leverage above 50% LTV",
      "Unhedged currency exposure",
    ],
    evidenceBasis: "Derived from insurance company investment guidelines, Solvency II frameworks, and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 5. Single Family Office ─────────────────────────────────────────────────
  {
    id: "sfo-001",
    name: "Single Family Office Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Single Family Office",
    mandate: "Preserve and grow multi-generational family wealth. High risk tolerance with long investment horizon. Appetite for emerging managers and niche strategies. Decision-making is concentrated and fast.",
    geography: "Global",
    ticketSizeMinM: 5,
    ticketSizeMaxM: 50,
    preferredAssetClasses: ["Private Equity", "Venture Capital", "Real Estate", "Growth Equity", "Private Credit"],
    fundSizeMinM: 50,
    fundSizeMaxM: 2000,
    returnThresholdPct: 15,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 15,
    trackRecordRequiredYrs: 3,
    firstTimeFundTolerance: true,
    maxManagementFeePct: 2.0,
    maxCarryPct: 25,
    minGpCommitmentPct: 2.0,
    governanceRequirements: "Minimal formal governance. Principal relationship preferred. Annual reporting sufficient.",
    reportingExpectations: "Annual reports with portfolio updates. Informal communication preferred.",
    coInvestmentPreference: "Strong appetite for co-investment. Prefers direct deal access.",
    esgRequirements: "ESG preferred but not mandatory. Impact investing appetite in some cases.",
    shariaRequired: false,
    diligenceDurationMonths: 3,
    decisionAuthority: "Principal or family CIO. Fast decision cycle.",
    commonObjections: [
      "GP commitment too low — alignment concern",
      "No co-investment rights",
      "Strategy too commoditised",
      "Team too large — dilutes GP economics",
    ],
    commitmentTriggers: [
      "Strong GP commitment (3%+)",
      "Co-investment rights with deal-by-deal access",
      "Differentiated strategy with clear edge",
      "Principal relationship with GP",
    ],
    rejectionTriggers: [
      "No co-investment rights",
      "GP commitment below 1%",
      "Strategy indistinguishable from index",
    ],
    evidenceBasis: "Derived from family office investment surveys, industry research, and practitioner interviews. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 6. Multi-Family Office ──────────────────────────────────────────────────
  {
    id: "mfo-001",
    name: "Multi-Family Office Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Multi-Family Office",
    mandate: "Aggregate private market allocations across multiple family clients. Requires institutional-grade reporting and governance. Aggregates tickets from multiple families — effective commitment may be larger than stated minimum.",
    geography: "Global, with North America and Europe focus",
    ticketSizeMinM: 5,
    ticketSizeMaxM: 75,
    preferredAssetClasses: ["Private Equity", "Private Credit", "Real Estate", "Growth Equity"],
    fundSizeMinM: 100,
    fundSizeMaxM: 3000,
    returnThresholdPct: 12,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 12,
    trackRecordRequiredYrs: 4,
    firstTimeFundTolerance: true,
    maxManagementFeePct: 2.0,
    maxCarryPct: 20,
    minGpCommitmentPct: 1.5,
    governanceRequirements: "Institutional reporting required. Quarterly updates. Audited accounts within 120 days.",
    reportingExpectations: "Quarterly NAV, annual audited accounts, portfolio company updates, ESG summary.",
    coInvestmentPreference: "Co-investment rights valued. Aggregated co-investment across family clients possible.",
    esgRequirements: "ESG policy required. Some family clients have specific ESG mandates.",
    shariaRequired: false,
    diligenceDurationMonths: 4,
    decisionAuthority: "Investment committee with client advisory board input.",
    commonObjections: [
      "Reporting does not meet institutional standard",
      "No co-investment rights",
      "Strategy too niche for client diversification",
      "GP commitment below family office minimum",
    ],
    commitmentTriggers: [
      "Institutional-grade reporting",
      "Co-investment rights",
      "Clear differentiation from public markets",
      "GP commitment of 2%+",
    ],
    rejectionTriggers: [
      "No audited track record",
      "Reporting below institutional standard",
      "Strategy too concentrated for family client diversification",
    ],
    evidenceBasis: "Derived from multi-family office investment policies and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 7. University Endowment ─────────────────────────────────────────────────
  {
    id: "end-001",
    name: "University Endowment Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "University Endowment",
    mandate: "Preserve endowment in perpetuity while generating annual distribution for institutional operations. Long investment horizon with high illiquidity tolerance. Pioneer allocator to alternative strategies.",
    geography: "Global",
    ticketSizeMinM: 10,
    ticketSizeMaxM: 100,
    preferredAssetClasses: ["Private Equity", "Venture Capital", "Real Assets", "Hedge Fund"],
    fundSizeMinM: 100,
    fundSizeMaxM: 5000,
    returnThresholdPct: 10,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 20,
    trackRecordRequiredYrs: 5,
    firstTimeFundTolerance: true,
    maxManagementFeePct: 2.0,
    maxCarryPct: 25,
    minGpCommitmentPct: 1.0,
    governanceRequirements: "Investment committee approval. Annual reporting to board of trustees.",
    reportingExpectations: "Annual audited accounts, portfolio updates, ESG impact report.",
    coInvestmentPreference: "Co-investment rights valued, especially for venture and growth equity.",
    esgRequirements: "ESG policy required. Fossil fuel exclusion increasingly common. Impact investing appetite.",
    shariaRequired: false,
    diligenceDurationMonths: 6,
    decisionAuthority: "CIO with investment committee approval.",
    commonObjections: [
      "Strategy not differentiated from existing portfolio",
      "ESG policy insufficient",
      "Track record too short for fund size",
      "Governance does not meet endowment standard",
    ],
    commitmentTriggers: [
      "Strong ESG credentials",
      "Differentiated strategy with academic or research edge",
      "Long track record with realized exits",
      "Co-investment rights",
    ],
    rejectionTriggers: [
      "No ESG policy",
      "Strategy replicable by public markets",
      "No realized exits",
    ],
    evidenceBasis: "Derived from endowment investment policy statements, CIO interviews, and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 8. Fund of Funds / OCIO ─────────────────────────────────────────────────
  {
    id: "fof-001",
    name: "Fund of Funds / OCIO Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Fund of Funds",
    mandate: "Build diversified private markets portfolios for institutional and family clients. Requires institutional-grade reporting, governance, and fee transparency. Adds a layer of fees — sensitive to underlying fund fee load.",
    geography: "Global",
    ticketSizeMinM: 5,
    ticketSizeMaxM: 50,
    preferredAssetClasses: ["Private Equity", "Private Credit", "Real Assets", "Infrastructure"],
    fundSizeMinM: 100,
    fundSizeMaxM: 5000,
    returnThresholdPct: 12,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 12,
    trackRecordRequiredYrs: 5,
    firstTimeFundTolerance: false,
    maxManagementFeePct: 1.75,
    maxCarryPct: 20,
    minGpCommitmentPct: 1.0,
    governanceRequirements: "Institutional reporting required. Quarterly updates. Audited accounts. LPAC access preferred.",
    reportingExpectations: "Quarterly NAV, annual audited accounts, portfolio company updates, ESG summary.",
    coInvestmentPreference: "Co-investment rights valued for client direct deal programmes.",
    esgRequirements: "ESG integration required. Client-specific ESG mandates must be accommodated.",
    shariaRequired: false,
    diligenceDurationMonths: 5,
    decisionAuthority: "Investment committee with client advisory input.",
    commonObjections: [
      "Fee load too high — double layer of fees reduces net return",
      "Strategy too concentrated for portfolio diversification",
      "No institutional reporting infrastructure",
      "Track record too short",
    ],
    commitmentTriggers: [
      "Low fee load relative to net return",
      "Diversified strategy with low correlation to existing portfolio",
      "Institutional reporting",
      "Strong reference checks",
    ],
    rejectionTriggers: [
      "Management fee above 1.75%",
      "No audited track record",
      "Strategy already represented in portfolio",
    ],
    evidenceBasis: "Derived from fund of funds investment policies and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

  // ── 9. Islamic Institutional Allocator ─────────────────────────────────────
  {
    id: "iia-001",
    name: "Islamic Institutional Allocator Archetype",
    label: "Synthetic LP Archetype",
    segmentType: "Islamic Institutional Allocator",
    mandate: "Deploy capital in accordance with Islamic finance principles. Requires Sharia-compliant structures (Murabaha, Ijara, Musharaka). Excludes interest-bearing instruments, prohibited sectors, and non-compliant leverage.",
    geography: "GCC, Southeast Asia, Malaysia",
    ticketSizeMinM: 10,
    ticketSizeMaxM: 150,
    preferredAssetClasses: ["Infrastructure", "Private Credit", "Real Assets", "Private Equity"],
    fundSizeMinM: 200,
    fundSizeMaxM: 5000,
    returnThresholdPct: 8,
    liquidityTolerance: "Illiquid OK",
    investmentHorizonYrs: 12,
    trackRecordRequiredYrs: 5,
    firstTimeFundTolerance: false,
    maxManagementFeePct: 1.75,
    maxCarryPct: 20,
    minGpCommitmentPct: 1.0,
    governanceRequirements: "Sharia Supervisory Board (SSB) approval required. AAOIFI or IFSB standards. Annual Sharia audit.",
    reportingExpectations: "Quarterly reports, annual Sharia audit report, audited accounts.",
    coInvestmentPreference: "Co-investment rights valued. Must be Sharia-compliant.",
    esgRequirements: "ESG and Sharia alignment preferred. Exclusion of alcohol, tobacco, weapons, gambling, conventional finance.",
    shariaRequired: true,
    diligenceDurationMonths: 8,
    decisionAuthority: "Investment committee with Sharia Supervisory Board approval.",
    commonObjections: [
      "Fund structure not Sharia-compliant",
      "Leverage uses conventional interest-bearing debt",
      "Portfolio includes prohibited sectors",
      "No Sharia Supervisory Board approval process",
      "Carry structure not Sharia-compliant",
    ],
    commitmentTriggers: [
      "AAOIFI-compliant fund structure",
      "Sharia Supervisory Board approval",
      "No prohibited sector exposure",
      "Profit-sharing structure (Musharaka/Mudaraba)",
    ],
    rejectionTriggers: [
      "Conventional interest-bearing debt in fund structure",
      "Prohibited sector exposure (alcohol, tobacco, weapons, gambling)",
      "No Sharia compliance documentation",
    ],
    evidenceBasis: "Derived from Islamic finance standards (AAOIFI, IFSB), GCC institutional investment policies, and industry research. Not based on any specific institution.",
    verificationStatus: "Unverified",
    registryVersion: LP_AGENT_BANK_VERSION,
  },

];

// ── Utility functions ─────────────────────────────────────────────────────────

export function getAgentById(id: string): LPAgent | undefined {
  return LP_AGENT_BANK.find((a) => a.id === id);
}

export function getAgentsBySegment(segmentType: AllocatorSegmentType): LPAgent[] {
  return LP_AGENT_BANK.filter((a) => a.segmentType === segmentType);
}

export function getAllAgentIds(): string[] {
  return LP_AGENT_BANK.map((a) => a.id);
}
