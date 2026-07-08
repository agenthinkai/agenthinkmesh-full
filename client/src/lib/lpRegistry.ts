// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — LP Registry (Static, anonymised institutional LPs)
// ─────────────────────────────────────────────────────────────────────────────

export type LPRegion = "GCC" | "Europe" | "US";
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
  /** Minimum ticket size in USD millions */
  ticketMin: number;
  /** Maximum ticket size in USD millions */
  ticketMax: number;
  /** Preferred fund strategies */
  strategies: FundStrategy[];
  /** Minimum GP track record required (years) */
  trackRecordMin: number;
  /** ESG priority score 1–10 (10 = mandatory Article 9) */
  esgPriority: number;
  /** Sharia compliance required */
  shariaRequired: boolean;
  /** Minimum net IRR hurdle (%) */
  irrHurdle: number;
  /** Maximum management fee tolerance (%) */
  maxManagementFee: number;
  /** Maximum carry tolerance (%) */
  maxCarry: number;
  /** Jurisdiction-specific compliance flags */
  complianceFlags: string[];
  /** Preferred LP currency */
  currency: string;
  /** Short description */
  description: string;
}

export const LP_REGISTRY: LimitedPartner[] = [
  {
    id: "gulf-investment-gic",
    name: "Gulf Investment GIC",
    region: "GCC",
    ticketMin: 50,
    ticketMax: 200,
    strategies: ["Infrastructure", "Private Credit"],
    trackRecordMin: 5,
    esgPriority: 6,
    shariaRequired: true,
    irrHurdle: 8,
    maxManagementFee: 1.75,
    maxCarry: 20,
    complianceFlags: ["kuwait-cma", "sharia-aaoifi"],
    currency: "USD",
    description:
      "GCC sovereign wealth vehicle with Sharia-mandated deployment. Focuses on infrastructure and debt instruments structured under Murabaha and Ijara frameworks. Requires AAOIFI-compliant documentation.",
  },
  {
    id: "continental-pension-pool",
    name: "Continental Pension Pool",
    region: "Europe",
    ticketMin: 30,
    ticketMax: 100,
    strategies: ["Infrastructure", "Private Equity", "Real Estate"],
    trackRecordMin: 7,
    esgPriority: 9,
    shariaRequired: false,
    irrHurdle: 6,
    maxManagementFee: 1.5,
    maxCarry: 20,
    complianceFlags: ["eu-aifmd", "sfdr-article-8"],
    currency: "EUR",
    description:
      "European pension fund with Article 8/9 SFDR mandate. Requires full ESG disclosure, AIFMD passporting documentation, and sustainability risk integration. Long-duration capital with 10–15 year horizon.",
  },
  {
    id: "manhattan-dynasty-wealth",
    name: "Manhattan Dynasty Wealth",
    region: "US",
    ticketMin: 5,
    ticketMax: 25,
    strategies: ["Private Equity", "Venture Capital", "Growth Equity", "Hedge Fund"],
    trackRecordMin: 3,
    esgPriority: 3,
    shariaRequired: false,
    irrHurdle: 12,
    maxManagementFee: 2.0,
    maxCarry: 20,
    complianceFlags: ["sec-506b"],
    currency: "USD",
    description:
      "US single-family office with absolute return mandate. Prioritises net IRR above 12% and is agnostic to strategy. Requires SEC Rule 506(b) private placement compliance. Shorter decision cycle (6–8 weeks).",
  },
];

export function getLPById(id: string): LimitedPartner | undefined {
  return LP_REGISTRY.find((lp) => lp.id === id);
}
