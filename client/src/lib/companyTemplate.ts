// AgenThink Decision Twin — Company Template Architecture
// Each company is a self-contained config that drives the wizard defaults,
// branding, geo mix, service mix, and scenario content.
// The compute engine is shared across all companies.

export interface GeoMix {
  ksa: number;
  uae: number;
  kw: number;
  other: number;
}

export interface ServiceMix {
  arch: number;
  eng: number;
  pm: number;
  pgm: number;
  da: number;
}

export interface CompanyDefaults {
  rev: number;         // $M
  eb: number;          // $M
  emp: number;
  fee: number;
  util: number;        // %
  geo: GeoMix;
  svc: ServiceMix;
  dig: number;         // % digital revenue
}

export interface ScenarioContent {
  name: string;
  tag: string;
  base?: boolean;
  set: SliderState;
  rec: string;
  conf: ConfidenceLabel;
  assum: string[];
  risks: string[];
  acts: string[];
  opp: string[];
  rsk: string[];
}

export type ConfidenceLabel = "Exploratory" | "Moderate" | "Moderate-High" | "High";

export interface SliderState {
  ai: number;
  pricing: number;
  share: number;
  growth: number;
  costInfl: number;
  daGrowth: number;
  gcc: number;
  // Banking-specific sliders (optional — only used when bankingMode: true)
  mortgageLaw?: number;      // 0=delayed/blocked, 100=approved & active
  gulfMerger?: number;       // 0=abandoned, 100=full integration complete
  gulfConversion?: number;   // 0=failed Sharia conversion, 100=successful
  depositGrowth?: number;    // % annual deposit growth rate
  financingGrowth?: number;  // % annual financing book growth rate
  digitalAdoption?: number;  // % digital banking adoption
  costToIncomeTarget?: number; // target cost-to-income ratio
  regionalExpansion?: number;  // 0=Kuwait only, 100=full GCC
  rateEnv?: number;            // 0=tightening, 100=easing
}

export interface BankingDefaults {
  totalAssets: number;      // KD M
  netProfit: number;        // KD M
  roe: number;              // %
  roa: number;              // %
  costToIncome: number;     // %
  npl: number;              // %
  depositBase: number;      // KD M
  financingBook: number;    // KD M
  capitalAdequacy: number;  // %
  sharePrice: number;       // fils
  pbRatio: number;          // price-to-book
  marketCap: number;        // KD M
}

export interface TelcoDefaults {
  revenue: number;
  ebitda: number;
  ebitdaMargin: number;
  netIncome: number;
  marketCap: number;
  enterpriseValue: number;
  evEbitda: number;
  peerEvEbitda: number;
  digitalRevenuePct: number;
  capexRevenuePct: number;
  subscribers: number;
  roe: number;
}
export interface EngineeringDefaults {
  revenue: number;
  ebitda: number;
  ebitdaMargin: number;
  employees: number;
  digitalRevenuePct: number;
  fixedFeePct: number;
  outcomePct: number;
  utilizationRate: number;
  revenuePerHead: number;
}
export interface DataSourcesConfig {
  sources: string[];
  lastUpdated: string;
  disclaimer: string;
}
export interface GrowthPath {
  t: string;
  d: string;
  live: (s: SliderState) => boolean;
}

export interface FailPath {
  t: string;
  d: string;
  live: (s: SliderState) => boolean;
}

export interface SliderOverrides {
  aiName?: string;
  aiLow?: string;
  aiHigh?: string;
  aiFmt?: (v: number) => string;
  shareName?: string;
  shareLow?: string;
  shareHigh?: string;
  pricingName?: string;       // default: "Pricing Power"
  pricingLow?: string;        // default: "By the hour"
  pricingHigh?: string;       // default: "By the outcome"
  pricingFmt?: (v: number) => string;
  gccName?: string;           // default: "GCC Expansion"
  gccLow?: string;            // default: "Today"
  gccHigh?: string;           // default: "Aggressive"
  gccFmt?: (v: number) => string;
  shareFmt?: (v: number) => string;
  growthName?: string;
  growthLow?: string;
  growthHigh?: string;
  growthFmt?: (v: number) => string;
  costInflName?: string;
  costInflLow?: string;
  costInflHigh?: string;
  costInflFmt?: (v: number) => string;
  daGrowthName?: string;
  daGrowthLow?: string;
  daGrowthHigh?: string;
  daGrowthFmt?: (v: number) => string;
}
export interface CompanyTemplate {
  id: string;
  name: string;
  industry: string;
  region: string;
  brand: string;       // hex color
  brandDark: string;   // hex color
  geoLabels: { ksa: string; uae: string; kw: string; other: string };
  defaults: CompanyDefaults;
  overviewText: string;
  scenarios: Record<string, ScenarioContent>;
  growthPaths: GrowthPath[];
  failPaths: FailPath[];
  sliderOverrides?: SliderOverrides;
  // Banking mode — replaces generic compute engine with banking-specific logic
  bankingMode?: boolean;
  bankingDefaults?: BankingDefaults;
  historicalPrecedents?: { name: string; outcome: string; relevance: string }[];
  outcomeLedgerEntry?: {
    ref: string;
    decision: string;
    hiddenVariable: string;
    recommendation: string;
    confidence: number;
    reviewDates: string[];
  };
  dataSources?: DataSourcesConfig;
  telcoMode?: boolean;
  telcoDefaults?: TelcoDefaults;
  engineeringMode?: boolean;
  engineeringDefaults?: EngineeringDefaults;
  conglomerateMode?: boolean;
  currency?: string;
}

// ─── KEO International Consultants ───────────────────────────────────────────

export const KEO_TEMPLATE: CompanyTemplate = {
  id: "keo",
  name: "KEO",
  industry: "Engineering & Advisory",
  region: "GCC / MENA",
  brand: "#D81E2C",
  brandDark: "#B0121E",
  geoLabels: { ksa: "Saudi Arabia", uae: "UAE", kw: "Kuwait", other: "Other GCC" },
  defaults: {
    rev: 210, eb: 30, emp: 2400, fee: 1800, util: 68,
    geo: { ksa: 34, uae: 28, kw: 22, other: 16 },
    svc: { arch: 20, eng: 42, pm: 22, pgm: 11, da: 5 },
    dig: 6,
  },
  overviewText: "Your business is a strong delivery operation — but it sits where its industry is changing fastest. Today, revenue depends on the <b>hours billed</b>, and most efficiency gains flow to clients rather than to the firm. Pricing power is limited and digital advisory is still a small share of the whole. The result is a firm that is <b>stable but strategically exposed</b>: solid today, with real upside if it changes how it captures value — and real risk if it does not.",
  scenarios: {
    current: {
      name: "Current Company", tag: "your business today", base: true,
      set: { ai: 15, pricing: 10, share: 8, growth: 3, costInfl: 5, daGrowth: 5, gcc: 10 },
      rec: "Protect the core, but begin shifting how the firm captures value — before the market forces the change.",
      conf: "Moderate",
      assum: ["Regional demand holds near current levels", "Utilization stays within normal range", "No fast-moving new-model entrant within 24 months"],
      risks: ["Efficiency gains keep benefiting clients, not the firm", "Competitors reprice first", "Digital advisory stays sub-scale"],
      acts: ["Pilot value-based pricing on two engagements", "Set a digital-revenue growth target", "Track competitor pricing each quarter"],
      opp: ["Reprice selected work to value", "Grow digital advisory from niche to material", "Lock in giga-project program roles"],
      rsk: ["Hourly billing caps the upside", "Margin slowly compresses", "A repriced competitor wins on economics"],
    },
    aiaug: {
      name: "AI-Augmented", tag: "productivity, hourly billing",
      set: { ai: 70, pricing: 15, share: 9, growth: 6, costInfl: 3, daGrowth: 35, gcc: 10 },
      rec: "Adopt productivity tools, but change the pricing model in parallel. Productivity without repricing is a gift to clients.",
      conf: "Moderate-High",
      assum: ["Productivity gains are real and deployable", "Teams adopt new ways of working", "Clients keep paying on a time basis"],
      risks: ["Faster delivery shrinks billable hours and revenue", "The firm subsidises client efficiency", "Repricing rivals capture far more per unit of change"],
      acts: ["Tie every productivity rollout to a pricing change", "Convert two flagship clients to fixed or outcome pricing", "Reskill teams toward advisory"],
      opp: ["Win work on speed and cost", "Build the proof case for repricing", "Free senior time for advisory"],
      rsk: ["Revenue erosion under hourly billing", "Gains leak to clients", "A half-measure underperforms a full shift"],
    },
    digital: {
      name: "Digital Advisory Leader", tag: "re-rate the firm",
      set: { ai: 50, pricing: 55, share: 9, growth: 8, costInfl: 3, daGrowth: 95, gcc: 15 },
      rec: "Invest decisively in digital advisory as a distinct, branded business with its own talent and pricing — the clearest path to a higher valuation.",
      conf: "High",
      assum: ["Advisory can grow ~30%/yr without margin decay", "The firm earns the right to advise, not only deliver", "Talent can be attracted and retained"],
      risks: ["Advisory competes for a different talent pool", "Brand permission must be built", "Scaling too fast dilutes quality"],
      acts: ["Stand up digital advisory as a named P&L", "Recruit advisory leadership", "Set premium pricing distinct from delivery"],
      opp: ["Higher-margin revenue mix", "A valuation re-rating, not just more profit", "A defensible, differentiated position"],
      rsk: ["Execution and talent risk", "Brand stretch", "Slower-than-planned scaling"],
    },
    margin: {
      name: "Margin Compression", tag: "the warning case",
      set: { ai: 15, pricing: 5, share: 6, growth: 2, costInfl: 8, daGrowth: 5, gcc: 5 },
      rec: "Treat this as the warning case. The cure is the efficiency-plus-repricing agenda the firm keeps deferring — act before compression sets in, not after.",
      conf: "High",
      assum: ["Regional price pressure persists", "Cost inflation continues", "No structural model change is made"],
      risks: ["Low-margin lines become unviable", "Talent leaves if pay can't follow", "The firm reacts late"],
      acts: ["Fix or exit the lowest-margin work", "Accelerate repricing", "Protect the highest-margin practices"],
      opp: ["Forces overdue efficiency", "Shows clearly where to exit", "Protects the advisory bright spot"],
      rsk: ["Unviable low-margin lines", "Talent attrition", "A late response"],
    },
    ainative: {
      name: "AI-Native Competitor", tag: "the existential case",
      set: { ai: 92, pricing: 90, share: 11, growth: 9, costInfl: 3, daGrowth: 80, gcc: 25 },
      rec: "Decide to become this — before someone else does. The economics that threaten the firm are the same ones it can own, but only by changing productivity and pricing together.",
      conf: "High",
      assum: ["Value-based contracting is accepted by clients", "Outcomes can be delivered without margin shocks", "The capability and culture can be built"],
      risks: ["Outcome pricing carries real delivery and balance-sheet risk", "Requires capability the firm does not yet have", "The first-mover window is time-limited"],
      acts: ["Launch an outcome-based delivery unit", "Re-architect delivery around capturing productivity", "Move now — the window is open"],
      opp: ["A step-change in enterprise value", "A software-adjacent valuation", "Market leadership if first"],
      rsk: ["A rival arrives first", "Outcome-delivery risk", "A capability gap"],
    },
    boom: {
      name: "GCC Mega Project Boom", tag: "capture and fund the shift",
      set: { ai: 35, pricing: 30, share: 13, growth: 11, costInfl: 5, daGrowth: 30, gcc: 80 },
      rec: "Capture the boom, but price for scarcity and avoid over-concentration. Use the surge to fund the model shift — not just to add headcount.",
      conf: "Moderate-High",
      assum: ["The giga-project pipeline funds and proceeds", "The surge can be staffed without quality loss", "The cycle holds for several years"],
      risks: ["Heavy concentration in a few markets", "Cost base added now is exposed at the downturn", "Capacity limits realisation"],
      acts: ["Prioritise high-value program roles", "Price for scarce capacity", "Reinvest boom profits into advisory and repricing"],
      opp: ["Highest near-term growth", "Durable program-management lock-in", "Profits to fund transformation"],
      rsk: ["Market concentration", "Cyclical exposure", "A capacity ceiling"],
    },
  },
  growthPaths: [
    { t: "Digital Advisory Expansion", d: "Scale the highest-margin advisory work into a core business.", live: s => s.daGrowth >= 40 },
    { t: "Outcome-Based Delivery", d: "Capture the value created, instead of billing the hours spent.", live: s => s.pricing >= 45 },
    { t: "AI-Augmented Engineering", d: "Use productivity to widen margins — when paired with pricing.", live: s => s.ai >= 45 && s.pricing >= 30 },
    { t: "Smart Infrastructure Services", d: "Move up the value chain into data-led, recurring services.", live: s => s.daGrowth >= 60 && s.gcc >= 20 },
  ],
  failPaths: [
    { t: "Time-and-Materials Trap", d: "Productivity gains flow to clients as fewer billed hours.", live: s => s.pricing < 25 && s.ai >= 40 },
    { t: "Margin Compression", d: "Rising costs and price pressure erode profit with no offset.", live: s => s.costInfl >= 6 },
    { t: "Engineering Commoditization", d: "Core delivery becomes a price-driven race to the bottom.", live: s => s.pricing < 20 && s.daGrowth < 30 },
    { t: "AI-Native Competitors", d: "A new-model rival captures the economics left on the table.", live: s => s.ai < 40 && s.pricing < 30 },
  ],
};

// ─── Warba Bank Decision Twin ─────────────────────────────────────────────────
// Banking Engine v1 — built from public data sources:
// • Warba Bank Annual Report 2024 (NASDAQ Dubai)
// • KPMG Kuwait Listed Banks YE25 (March 2026)
// • Gulf Business: Warba acquires 32.75% Alghanim stake in GCC Peer Bank A ($1.62B)
// • Warba Bank investor presentations and CBK disclosures
// Data as of: June 2026

export const WARBA_TEMPLATE: CompanyTemplate = {
  id: "warba",
  name: "Warba Bank",
  industry: "Islamic Banking",
  region: "Kuwait / GCC",
  brand: "#1A5C96",
  brandDark: "#0F3D6B",
  bankingMode: true,
  bankingDefaults: {
    // Source: KPMG Kuwait Listed Banks YE25 (March 2026) + Warba Annual Report 2024
    totalAssets: 6028,      // KD M — YE25 (up from 5,294 in YE24, +13.9%)
    netProfit: 49.62,       // KD M — YE25 (up from 22.4 in YE24, +121.5%)
    roe: 8.46,              // % — YE25 (up from 5.93% in YE24)
    roa: 0.88,              // % — YE25 (up from 0.44% in YE24)
    costToIncome: 43.1,     // % — YE25 (down from 57.7% in YE24 — significant improvement)
    npl: 1.30,              // % — YE25 (down from 1.43% in YE24)
    depositBase: 3150,      // KD M — YE24 Annual Report (3.15B, +8.3% YoY)
    financingBook: 3640,    // KD M — YE24 Annual Report (3.64B, +5.5% YoY)
    capitalAdequacy: 18.2,  // % — CBK minimum 14%; Warba above threshold
    sharePrice: 290,        // fils — YE25 (up from 192 fils, +51%)
    pbRatio: 1.4,           // estimated from share price / book value
    marketCap: 735,         // KD M — estimated (290 fils × ~2.53B shares)
  },
  geoLabels: { ksa: "Saudi Arabia", uae: "UAE", kw: "Kuwait", other: "Other GCC" },
  defaults: {
    // Generic engine fallback — used for EV multiple calculation
    rev: 270,   // KD M — total operating income YE24 (270.4M)
    eb: 50,     // KD M — net profit YE25 (proxy for EBITDA in banking context)
    emp: 900, fee: 0, util: 0,
    geo: { ksa: 5, uae: 10, kw: 80, other: 5 },
    svc: { arch: 0, eng: 0, pm: 0, pgm: 0, da: 0 },
    dig: 35,    // % digital channel adoption (estimated from digital-first positioning)
  },
  overviewText: "Warba Bank's fundamentals have <b>transformed in 12 months</b> — net profit +121%, share price +51%, cost-to-income from 57.7% to 43.1%, NPL at 1.3%. The market has not yet repriced this. Warba trades at <b>1.4x P/B</b>. Boubyan Bank — the closest comparable — trades at <b>3.2x P/B</b>. The gap between what Warba is worth and what the market believes it is worth is the strategic opportunity. The question is not whether to merge with GCC Peer Bank A or wait for the Mortgage Law. The question is: <b>what closes the valuation gap, and how fast?</b>",
  scenarios: {
    current: {
      name: "Valuation Gap: Today", tag: "where you stand now", base: true,
      set: {
        ai: 35, pricing: 40, share: 5, growth: 12, costInfl: 4, daGrowth: 35, gcc: 15,
        mortgageLaw: 30, gulfMerger: 20, gulfConversion: 0,
        depositGrowth: 10, financingGrowth: 8, digitalAdoption: 55,
        costToIncomeTarget: 42, regionalExpansion: 15, rateEnv: 55,
      },
      rec: "Warba's fundamentals have already improved dramatically. The market has not repriced this. The valuation gap — 1.4x P/B vs. Boubyan's 3.2x — is not a market error. It is a narrative gap. The market does not yet have a coherent story about what Warba is becoming.",
      conf: "High",
      assum: [
        "Current P/B of 1.4x reflects market uncertainty about GCC Peer Bank A merger outcome",
        "Market has not yet priced in the 121% net profit improvement",
        "No clear investor narrative exists about Warba's 3-year strategic direction",
        "Boubyan's 3.2x P/B is the achievable benchmark — same market, same regulatory environment",
      ],
      risks: [
        "Valuation gap widens if GCC Peer Bank A merger creates uncertainty without a clear timeline",
        "Boubyan accelerates digital investment — the gap becomes structural, not temporary",
        "Mortgage Law delay extends the period of narrative uncertainty",
      ],
      acts: [
        "Define and communicate a clear 3-year strategic narrative to the market",
        "Establish explicit go/no-go criteria for the GCC Peer Bank A merger — uncertainty is the enemy of valuation",
        "Publish a digital banking roadmap that positions Warba as the GCC Islamic neobank",
      ],
      opp: [
        "Closing half the P/B gap (1.4x → 2.3x) adds KD 450M+ to market cap",
        "Net profit trajectory is already strong — the story needs to be told",
        "Digital-first positioning is a genuine premium vs. conventional peers",
      ],
      rsk: [
        "Narrative vacuum — no clear story means the market defaults to 'small bank with merger risk'",
        "GCC Peer Bank A stake without a merger timeline is a capital drag on valuation",
        "Boubyan's 3.2x P/B becomes the ceiling, not the target, if Warba doesn't act",
      ],
    },
    aiaug: {
      name: "Merger Rerating", tag: "the scale path to 2.2x P/B",
      set: {
        ai: 50, pricing: 45, share: 9, growth: 18, costInfl: 5, daGrowth: 45, gcc: 25,
        mortgageLaw: 50, gulfMerger: 75, gulfConversion: 60,
        depositGrowth: 15, financingGrowth: 14, digitalAdoption: 60,
        costToIncomeTarget: 38, regionalExpansion: 25, rateEnv: 55,
      },
      rec: "A successful merger creates Kuwait's third-largest bank and justifies a valuation rerating to 2.0–2.4x P/B — but only if the Sharia conversion is executed cleanly. The market will price in the risk, not the upside, until conversion is complete.",
      conf: "Moderate",
      assum: [
        "CBK approves full merger within 18 months — valuation uncertainty compresses during this period",
        "GCC Peer Bank A conventional assets convert to Sharia-compliant structures within 3 years",
        "Combined entity achieves cost-to-income of 38% — below Boubyan's current 42%",
        "Merger narrative is communicated clearly: scale + digital = premium Islamic bank",
      ],
      risks: [
        "Sharia conversion of large conventional book is complex — timeline unknown",
        "Market prices in integration risk, not scale upside — P/B may compress before it expands",
        "Boubyan captures Warba's digital-first customers during the 3-year integration window",
      ],
      acts: [
        "Publish a merger narrative: 'Kuwait's first full-spectrum Islamic bank' — not just 'third-largest'",
        "Ring-fence Warba digital innovation team from merger integration to protect the premium",
        "Set a public cost-to-income target of 38% post-merger — this is the valuation signal",
      ],
      opp: [
        "Combined KD 13.7B asset base justifies institutional investor attention — new buyer universe",
        "Scale + digital is a narrative that commands a premium multiple in Islamic banking",
        "Branch rationalization synergies fund the digital investment that drives the rerating",
      ],
      rsk: [
        "Integration uncertainty is a valuation depressant — the gap may widen before it closes",
        "If Sharia conversion stalls, the merger narrative collapses and P/B falls below 1.4x",
        "Boubyan reaches 4x P/B while Warba is distracted — the gap becomes permanent",
      ],
    },
    digital: {
      name: "Digital Rerating", tag: "the fastest path to 3.0x P/B",
      set: {
        ai: 75, pricing: 55, share: 8, growth: 20, costInfl: 3, daGrowth: 80, gcc: 35,
        mortgageLaw: 60, gulfMerger: 30, gulfConversion: 0,
        depositGrowth: 18, financingGrowth: 16, digitalAdoption: 85,
        costToIncomeTarget: 35, regionalExpansion: 35, rateEnv: 60,
      },
      rec: "Digital-first execution is the fastest path to a valuation rerating. Boubyan reached 3.2x P/B by being the digital Islamic bank — not by being the largest. Warba can reach 2.8–3.2x P/B by becoming the GCC Islamic neobank. This path does not require the merger. It does not require the Mortgage Law. It requires a decision.",
      conf: "High",
      assum: [
        "Warba commits to a 3-year digital platform investment — not incremental, transformational",
        "Cost-to-income reaches 35% — below Boubyan's 42%, justifying a premium multiple",
        "Open banking API layer is live within 18 months — Warba becomes infrastructure, not just a bank",
        "Market re-narrativizes Warba as 'the Islamic neobank' — new institutional buyer universe",
      ],
      risks: [
        "Boubyan is 5 years ahead on digital — Warba must leapfrog, not catch up",
        "Platform investment requires capital that could otherwise fund the GCC Peer Bank A merger",
        "Regulatory approval for AI credit decisioning is uncertain",
      ],
      acts: [
        "Publish a 3-year digital roadmap with specific milestones and P/B targets — this is the investor narrative",
        "Launch open banking API layer within 18 months — become BaaS infrastructure for Kuwaiti fintechs",
        "Set a public cost-to-income target of 35% — 7 points below Boubyan — as the valuation signal",
      ],
      opp: [
        "Closing the P/B gap from 1.4x to 3.0x adds KD 1.1B to market cap — this is the prize",
        "Software-adjacent P/B multiples are available to banks with genuine platform businesses",
        "Boubyan's playbook is proven — Warba can execute the same strategy with 5 years of hindsight",
      ],
      rsk: [
        "Boubyan reaches 4x P/B before Warba reaches 2x — the gap becomes a structural disadvantage",
        "Platform investment without clear ROI narrative depresses P/B further before it rises",
        "Talent competition with regional fintechs for the engineers who build the platform",
      ],
    },
    margin: {
      name: "Valuation Compression", tag: "how the gap widens",
      set: {
        ai: 20, pricing: 25, share: 4, growth: 5, costInfl: 8, daGrowth: 15, gcc: 10,
        mortgageLaw: 10, gulfMerger: 80, gulfConversion: 25,
        depositGrowth: 4, financingGrowth: 3, digitalAdoption: 40,
        costToIncomeTarget: 55, regionalExpansion: 10, rateEnv: 30,
      },
      rec: "The valuation gap widens when Warba pursues the merger without a clear Sharia conversion timeline. The market prices in integration risk and narrative uncertainty simultaneously. P/B falls below 1.2x. This is not a tail risk — it is the default outcome if no strategic narrative is established.",
      conf: "High",
      assum: [
        "GCC Peer Bank A merger proceeds but Sharia conversion timeline is undefined",
        "IT integration consumes management attention — digital investment stalls",
        "No clear investor narrative: 'merger bank' is not a premium category",
        "Boubyan reaches 3.8x P/B while Warba is at 1.1x — gap becomes structural",
      ],
      risks: [
        "Cost-to-income reverts toward 55% during integration — the 2025 improvement is reversed",
        "Institutional investors exit — 'integration risk' is not a category they hold",
        "Boubyan captures Warba's youth segment permanently during the integration window",
      ],
      acts: [
        "Do not proceed with the GCC Peer Bank A merger without a defined Sharia conversion timeline — this is the single most important governance decision",
        "Establish a public go/no-go date for the GCC Peer Bank A merger — uncertainty is more damaging than a 'no'",
        "Ring-fence the digital innovation budget regardless of merger decision",
      ],
      opp: [
        "This scenario forces the board to confront the valuation gap explicitly",
        "A disciplined 'no' to the GCC Peer Bank A merger — with a clear digital narrative — could rerate Warba faster than the merger",
        "Minority stake monetization (selling the GCC Peer Bank A stake at a premium) is an option if merger is not viable",
      ],
      rsk: [
        "P/B falls to 1.0–1.1x — below book value — triggering institutional selling",
        "The valuation gap becomes a self-fulfilling prophecy: low P/B limits capital raising, which limits growth",
        "Boubyan's 4x P/B makes it impossible for Warba to compete for talent and acquisitions",
      ],
    },
    ainative: {
      name: "Mortgage Rerating", tag: "the retail catalyst",
      set: {
        ai: 55, pricing: 50, share: 7, growth: 22, costInfl: 4, daGrowth: 50, gcc: 20,
        mortgageLaw: 95, gulfMerger: 40, gulfConversion: 0,
        depositGrowth: 16, financingGrowth: 25, digitalAdoption: 70,
        costToIncomeTarget: 38, regionalExpansion: 20, rateEnv: 65,
      },
      rec: "Mortgage Law approval is the highest-probability single event that could rerate Warba's valuation. Al Rajhi's mortgage book grew 40% in 3 years post-Saudi mortgage law — and its P/B expanded from 2.1x to 4.8x in the same period. Warba must be ready on approval day, not 6 months after.",
      conf: "Moderate-High",
      assum: [
        "Kuwait Mortgage Law approved by National Assembly in 2026 or 2027",
        "Warba launches Sharia-compliant mortgage product within 30 days of approval — not 6 months",
        "Digital channel handles 70%+ of mortgage applications — this is the valuation signal",
        "Mortgage book grows to KD 800M within 3 years — from near-zero today",
      ],
      risks: [
        "Mortgage Law delayed again — the 'regulatory catalyst' narrative loses credibility with investors",
        "KFH and Boubyan launch mortgage products first — Warba loses the first-mover premium",
        "Rapid balance sheet expansion pressures capital adequacy below CBK comfort zone",
      ],
      acts: [
        "Pre-build the Sharia mortgage product today — launch-ready before the law passes",
        "Pre-approve 5,000 customers digitally — announce this publicly to signal readiness",
        "Communicate the mortgage opportunity to investors now: 'KD 3–5B pent-up demand, Warba is ready'",
      ],
      opp: [
        "Al Rajhi precedent: mortgage law + digital-first = P/B expansion from 2x to 4x in 3 years",
        "Mortgage customers are 15–25 year relationships — the highest-LTV customer in banking",
        "Digital mortgage process is a genuine differentiator vs. NBK and KFH branch-based models",
      ],
      rsk: [
        "Mortgage Law dependence — if delayed again, the valuation catalyst narrative collapses",
        "Concentration risk: mortgage book growing from zero to KD 800M in 3 years is aggressive",
        "Capital adequacy pressure if mortgage growth outpaces deposit growth",
      ],
    },
    boom: {
      name: "GCC Rerating", tag: "the platform premium path",
      set: {
        ai: 45, pricing: 40, share: 6, growth: 16, costInfl: 5, daGrowth: 40, gcc: 70,
        mortgageLaw: 50, gulfMerger: 35, gulfConversion: 0,
        depositGrowth: 14, financingGrowth: 12, digitalAdoption: 65,
        costToIncomeTarget: 40, regionalExpansion: 70, rateEnv: 55,
      },
      rec: "GCC expansion is the path to a platform premium — but only after the Kuwait franchise is fully optimized. QNB's regional expansion created scale but not a premium multiple. Boubyan's domestic focus created a 3.2x P/B. The lesson: depth before breadth.",
      conf: "Moderate",
      assum: [
        "Kuwait franchise is fully optimized before GCC expansion begins — P/B above 2.5x domestically first",
        "UAE digital banking license obtained within 24 months — digital-only, no branches",
        "GCC expansion narrative adds a 'platform premium' to the P/B multiple",
        "Capital adequacy supports expansion without dilutive rights issue",
      ],
      risks: [
        "Premature expansion dilutes the Kuwait franchise — the source of the valuation premium",
        "QNB precedent: regional acquisitions created complexity, not premium multiples",
        "Management bandwidth — Kuwait + GCC Peer Bank A + GCC expansion simultaneously is too many fronts",
      ],
      acts: [
        "Sequence explicitly: Kuwait rerating first (P/B 2.5x+), then GCC expansion",
        "UAE digital-only entry — no branches, no acquisition — preserves the capital for Kuwait",
        "Communicate the GCC roadmap to investors now, but execute Kuwait first",
      ],
      opp: [
        "GCC Islamic banking market is KD 400B+ — the platform premium is real if the narrative is right",
        "Digital-first GCC entry has lower capital requirements than branch banking",
        "A GCC Islamic neobank commands a software-adjacent multiple — 4x+ P/B is achievable",
      ],
      rsk: [
        "Expansion before domestic rerating dilutes the narrative and the capital",
        "Regulatory approval timelines in each GCC market are unpredictable",
        "Talent competition with regional fintechs for the engineers who build the platform",
      ],
    },
  },
  growthPaths: [
    { t: "Digital Rerating: 1.4x → 3.0x P/B", d: "Commit to the digital platform strategy — open banking API, AI credit, BaaS — and communicate a 3-year P/B target to the market. Boubyan's playbook, executed with 5 years of hindsight.", live: s => (s.digitalAdoption ?? 0) >= 65 && s.ai >= 50 },
    { t: "Mortgage First-Mover Premium", d: "Be launch-ready on Mortgage Law approval day. Pre-approve 5,000 customers digitally. The Al Rajhi precedent: mortgage law + digital = P/B expansion from 2x to 4x in 3 years.", live: s => (s.mortgageLaw ?? 0) >= 60 && (s.financingGrowth ?? 0) >= 15 },
    { t: "Merger Scale Premium", d: "Execute the GCC Peer Bank A merger with a clean Sharia conversion narrative. Combined KD 13.7B in assets justifies institutional investor attention and a 2.0–2.4x P/B.", live: s => (s.gulfMerger ?? 0) >= 50 && (s.gulfConversion ?? 0) >= 40 },
    { t: "Narrative Rerating", d: "Define and communicate a clear 3-year strategic story. The market currently has no coherent narrative for Warba. A clear story alone — without any operational change — could close 30% of the valuation gap.", live: s => s.growth >= 12 && (s.digitalAdoption ?? 0) >= 50 },
    { t: "GCC Platform Premium", d: "After Kuwait rerating (P/B 2.5x+), expand to UAE digital-only. A GCC Islamic neobank commands a software-adjacent multiple — 4x+ P/B is the ceiling.", live: s => (s.regionalExpansion ?? 0) >= 50 && (s.digitalAdoption ?? 0) >= 60 },
  ],
  failPaths: [
    { t: "Narrative Vacuum", d: "No clear strategic story means the market defaults to 'small bank with merger risk'. P/B stays at 1.4x or falls. This is the current default trajectory.", live: s => s.growth < 12 && (s.digitalAdoption ?? 0) < 55 },
    { t: "Merger Without Conversion Timeline", d: "Proceeding with the GCC Peer Bank A merger without a defined Sharia conversion timeline is the single most likely path to P/B compression below 1.2x.", live: s => (s.gulfMerger ?? 0) >= 60 && (s.gulfConversion ?? 0) < 40 },
    { t: "Boubyan Captures the Premium", d: "Boubyan reaches 4x P/B while Warba is at 1.4x. The gap becomes structural — Warba can no longer compete for talent, acquisitions, or institutional capital.", live: s => (s.digitalAdoption ?? 0) < 50 && s.ai < 40 },
    { t: "Mortgage Law Dependence", d: "Strategy is over-indexed on a single regulatory event. If the law is delayed again, the valuation catalyst narrative collapses and investor patience runs out.", live: s => (s.mortgageLaw ?? 0) < 30 && (s.financingGrowth ?? 0) < 8 },
    { t: "Capital Drag Without Upside", d: "GCC Peer Bank A stake without a merger timeline is capital that earns a minority dividend, not a control premium. P/B reflects the drag.", live: s => (s.gulfMerger ?? 0) < 30 && (s.depositGrowth ?? 0) < 8 },
  ],
  historicalPrecedents: [
    { name: "Boubyan Bank (Kuwait)", outcome: "P/B expanded from 1.2x to 3.2x (2015–2025) through digital-first focus and avoiding premature geographic expansion. Assets grew from KD 2B to KD 9B.", relevance: "The direct valuation benchmark — same market, same regulatory environment, same Islamic banking model. Boubyan's P/B is the target, not the ceiling." },
    { name: "Al Rajhi Bank (Saudi Arabia)", outcome: "P/B expanded from 2.1x to 4.8x in the 3 years following Saudi mortgage law. Mortgage book grew 40% annually. Digital channel handled 72% of applications.", relevance: "The Mortgage Law catalyst precedent — the most important data point for Warba's valuation rerating potential." },
    { name: "Emirates Islamic (UAE)", outcome: "Converted from conventional to Islamic banking in 2004. Conversion took 3 years and required CBK approval for each product category. P/B compressed during conversion, then expanded.", relevance: "Sharia conversion precedent — the market prices in conversion risk before it prices in the upside. GCC Peer Bank A conversion will follow the same pattern." },
    { name: "NCB / Samba merger (Saudi Arabia)", outcome: "Created Saudi National Bank — largest bank in Saudi Arabia — but P/B did not expand post-merger. Scale without a premium narrative does not rerate.", relevance: "The merger valuation lesson — scale is necessary but not sufficient for P/B expansion. The narrative must change, not just the balance sheet." },
    { name: "Kakao Bank (South Korea)", outcome: "P/B reached 8x at IPO as a digital-first bank with no branches. Cost-to-income of 28% — 20 points below conventional peers — was the primary valuation driver.", relevance: "The platform premium ceiling — a digital Islamic bank with Warba's cost-to-income trajectory could command a multiple that conventional bank comparables cannot predict." },
  ],
  outcomeLedgerEntry: {
    ref: "OL-003",
    decision: "Warba Bank: What is the primary driver of valuation rerating from 1.4x P/B to 3.0x+ P/B — and what is the sequence of decisions required to achieve it?",
    hiddenVariable: "Narrative Architecture Constraint — the market currently has no coherent story about what Warba is becoming. The valuation gap is not primarily a fundamentals gap (fundamentals have already improved dramatically). It is a narrative gap. The hidden variable is whether Warba's board is willing to commit publicly to a 3-year strategic direction — and whether that direction is digital platform, GCC Peer Bank A merger scale, or mortgage catalyst.",
    recommendation: "The valuation rerating pathway is the single most important strategic question. The answer determines whether the GCC Peer Bank A merger is a rerating event or a distraction. Pursue the digital platform narrative first — it does not require the merger, does not require the Mortgage Law, and is the path Boubyan used to reach 3.2x P/B. The merger and the Mortgage Law are accelerants, not foundations.",
    confidence: 72,
    reviewDates: ["December 2026", "June 2027", "December 2027"],
  },
};

// ─── Apex Islamic Bank ───────────────────────────────────────────────────────
// Generic GCC Islamic bank archetype — no real company names.
// Mirrors the Warba banking engine; all M&A references use "GCC Peer Bank A".
export const APEX_TEMPLATE: CompanyTemplate = {
  id: "apex",
  name: "Apex Islamic Bank",
  industry: "Islamic Banking",
  region: "GCC",
  brand: "#1B6B4A",
  brandDark: "#0F4530",
  bankingMode: true,
  bankingDefaults: {
    totalAssets: 5800,
    netProfit: 44,
    roe: 7.8,
    roa: 0.76,
    costToIncome: 46.0,
    npl: 1.55,
    depositBase: 2900,
    financingBook: 3400,
    capitalAdequacy: 17.5,
    sharePrice: 250,
    pbRatio: 1.3,
    marketCap: 680,
  },
  geoLabels: { ksa: "Saudi Arabia", uae: "UAE", kw: "Kuwait", other: "Other GCC" },
  defaults: {
    rev: 240,
    eb: 44,
    emp: 850, fee: 0, util: 0,
    geo: { ksa: 8, uae: 12, kw: 75, other: 5 },
    svc: { arch: 0, eng: 0, pm: 0, pgm: 0, da: 0 },
    dig: 30,
  },
  overviewText: "Apex Islamic Bank's fundamentals show <b>improving momentum</b> — net profit growing, cost-to-income declining, capital adequacy well above regulatory minimums. The market has not yet repriced this. Apex trades at <b>1.3x P/B</b>. The leading GCC Islamic banking comparable trades at <b>3.2x P/B</b>. The gap between what Apex is worth and what the market believes it is worth is the strategic opportunity. The question is not whether to merge with GCC Peer Bank A or wait for the Mortgage Law. The question is: <b>what closes the valuation gap, and how fast?</b>",
  scenarios: {
    current: {
      name: "Valuation Gap: Today", tag: "where you stand now", base: true,
      set: {
        ai: 30, pricing: 38, share: 4, growth: 10, costInfl: 4, daGrowth: 30, gcc: 12,
        mortgageLaw: 25, gulfMerger: 18, gulfConversion: 0,
        depositGrowth: 9, financingGrowth: 7, digitalAdoption: 48,
        costToIncomeTarget: 44, regionalExpansion: 12, rateEnv: 50,
      },
      rec: "Apex's fundamentals are improving but the market has not repriced this. The valuation gap — 1.3x P/B vs. the leading GCC Islamic bank at 3.2x — is not a market error. It is a narrative gap. The market does not yet have a coherent story about what Apex is becoming.",
      conf: "High",
      assum: [
        "Current P/B of 1.3x reflects market uncertainty about GCC Peer Bank A merger outcome",
        "Market has not yet priced in the recent profit improvement trajectory",
        "No clear investor narrative exists about Apex's 3-year strategic direction",
        "Leading GCC Islamic bank at 3.2x P/B is the achievable benchmark — same regulatory environment",
      ],
      risks: [
        "Valuation gap widens if GCC Peer Bank A merger creates uncertainty without a clear timeline",
        "Leading peer accelerates digital investment — the gap becomes structural, not temporary",
        "Mortgage Law delay extends the period of narrative uncertainty",
      ],
      acts: [
        "Define and communicate a clear 3-year strategic narrative to the market",
        "Establish explicit go/no-go criteria for the GCC Peer Bank A merger — uncertainty is the enemy of valuation",
        "Publish a digital banking roadmap that positions Apex as the GCC Islamic neobank",
      ],
      opp: [
        "Closing half the P/B gap (1.3x → 2.2x) adds significant market cap",
        "Net profit trajectory is already improving — the story needs to be told",
        "Digital-first positioning is a genuine premium vs. conventional peers",
      ],
      rsk: [
        "Narrative vacuum — no clear story means the market defaults to 'small bank with merger risk'",
        "GCC Peer Bank A stake without a merger timeline is a capital drag on valuation",
        "Leading peer's high P/B becomes the ceiling, not the target, if Apex doesn't act",
      ],
    },
    aiaug: {
      name: "Merger Rerating", tag: "the scale path to 2.2x P/B",
      set: {
        ai: 48, pricing: 43, share: 8, growth: 17, costInfl: 5, daGrowth: 42, gcc: 22,
        mortgageLaw: 48, gulfMerger: 72, gulfConversion: 58,
        depositGrowth: 14, financingGrowth: 13, digitalAdoption: 58,
        costToIncomeTarget: 38, regionalExpansion: 22, rateEnv: 55,
      },
      rec: "A successful merger with GCC Peer Bank A creates a leading regional Islamic bank and justifies a valuation rerating to 2.0–2.4x P/B — but only if the Sharia conversion is executed cleanly. The market will price in the risk, not the upside, until conversion is complete.",
      conf: "Moderate",
      assum: [
        "Regulatory approval for full merger within 18 months — valuation uncertainty compresses during this period",
        "GCC Peer Bank A conventional assets convert to Sharia-compliant structures within 3 years",
        "Combined entity achieves cost-to-income of 38% — below leading peer's current 42%",
        "Merger narrative is communicated clearly: scale + digital = premium Islamic bank",
      ],
      risks: [
        "Sharia conversion of large conventional book is complex — timeline unknown",
        "Market prices in integration risk, not scale upside — P/B may compress before it expands",
        "Leading peer captures Apex's digital-first customers during the 3-year integration window",
      ],
      acts: [
        "Publish a merger narrative: 'GCC's first full-spectrum Islamic bank' — not just 'larger balance sheet'",
        "Ring-fence Apex digital innovation team from merger integration to protect the premium",
        "Set a public cost-to-income target of 38% post-merger — this is the valuation signal",
      ],
      opp: [
        "Combined asset base justifies institutional investor attention — new buyer universe",
        "Scale + digital is a narrative that commands a premium multiple in Islamic banking",
        "Branch rationalization synergies fund the digital investment that drives the rerating",
      ],
      rsk: [
        "Integration uncertainty is a valuation depressant — the gap may widen before it closes",
        "If Sharia conversion stalls, the merger narrative collapses and P/B falls below 1.3x",
        "Leading peer reaches 4x P/B while Apex is distracted — the gap becomes permanent",
      ],
    },
    digital: {
      name: "Digital Rerating", tag: "the fastest path to 3.0x P/B",
      set: {
        ai: 72, pricing: 53, share: 7, growth: 19, costInfl: 3, daGrowth: 78, gcc: 32,
        mortgageLaw: 58, gulfMerger: 28, gulfConversion: 0,
        depositGrowth: 17, financingGrowth: 15, digitalAdoption: 82,
        costToIncomeTarget: 35, regionalExpansion: 32, rateEnv: 60,
      },
      rec: "Digital-first execution is the fastest path to a valuation rerating. The leading GCC Islamic bank reached 3.2x P/B by being the digital Islamic bank — not by being the largest. Apex can reach 2.8–3.2x P/B by becoming the GCC Islamic neobank. This path does not require the merger. It does not require the Mortgage Law. It requires a decision.",
      conf: "High",
      assum: [
        "Apex commits to a 3-year digital platform investment — not incremental, transformational",
        "Cost-to-income reaches 35% — below leading peer's 42%, justifying a premium multiple",
        "Open banking API layer is live within 18 months — Apex becomes infrastructure, not just a bank",
        "Market re-narrativizes Apex as 'the Islamic neobank' — new institutional buyer universe",
      ],
      risks: [
        "Leading peer is ahead on digital — Apex must leapfrog, not catch up",
        "Platform investment requires capital that could otherwise fund the GCC Peer Bank A merger",
        "Regulatory approval for AI credit decisioning is uncertain",
      ],
      acts: [
        "Publish a 3-year digital roadmap with specific milestones and P/B targets — this is the investor narrative",
        "Launch open banking API layer within 18 months — become BaaS infrastructure for regional fintechs",
        "Set a public cost-to-income target of 35% — 7 points below leading peer — as the valuation signal",
      ],
      opp: [
        "Closing the P/B gap from 1.3x to 3.0x adds substantial market cap — this is the prize",
        "Software-adjacent P/B multiples are available to banks with genuine platform businesses",
        "Leading peer's playbook is proven — Apex can execute the same strategy with hindsight advantage",
      ],
      rsk: [
        "Leading peer reaches 4x P/B before Apex reaches 2x — the gap becomes a structural disadvantage",
        "Platform investment without clear ROI narrative depresses P/B further before it rises",
        "Talent competition with regional fintechs for the engineers who build the platform",
      ],
    },
    margin: {
      name: "Valuation Compression", tag: "how the gap widens",
      set: {
        ai: 18, pricing: 22, share: 3, growth: 4, costInfl: 8, daGrowth: 12, gcc: 8,
        mortgageLaw: 8, gulfMerger: 78, gulfConversion: 22,
        depositGrowth: 3, financingGrowth: 2, digitalAdoption: 38,
        costToIncomeTarget: 55, regionalExpansion: 8, rateEnv: 28,
      },
      rec: "The valuation gap widens when Apex pursues the merger without a clear Sharia conversion timeline. The market prices in integration risk and narrative uncertainty simultaneously. P/B falls below 1.1x. This is not a tail risk — it is the default outcome if no strategic narrative is established.",
      conf: "High",
      assum: [
        "GCC Peer Bank A merger proceeds but Sharia conversion timeline is undefined",
        "IT integration consumes management attention — digital investment stalls",
        "No clear investor narrative: 'merger bank' is not a premium category",
        "Leading peer reaches 3.8x P/B while Apex is at 1.1x — gap becomes structural",
      ],
      risks: [
        "Cost-to-income reverts toward 55% during integration — the recent improvement is reversed",
        "Institutional investors exit — 'integration risk' is not a category they hold",
        "Leading peer captures Apex's youth segment permanently during the integration window",
      ],
      acts: [
        "Do not proceed with the GCC Peer Bank A merger without a defined Sharia conversion timeline — this is the single most important governance decision",
        "Establish a public go/no-go date for the GCC Peer Bank A merger — uncertainty is more damaging than a 'no'",
        "Ring-fence the digital innovation budget regardless of merger decision",
      ],
      opp: [
        "This scenario forces the board to confront the valuation gap explicitly",
        "A disciplined 'no' to the GCC Peer Bank A merger — with a clear digital narrative — could rerate Apex faster than the merger",
        "Minority stake monetization (selling the GCC Peer Bank A stake at a premium) is an option if merger is not viable",
      ],
      rsk: [
        "P/B falls to 1.0–1.1x — below book value — triggering institutional selling",
        "The valuation gap becomes a self-fulfilling prophecy: low P/B limits capital raising, which limits growth",
        "Leading peer's high P/B makes it impossible for Apex to compete for talent and acquisitions",
      ],
    },
    ainative: {
      name: "Mortgage Rerating", tag: "the retail catalyst",
      set: {
        ai: 52, pricing: 48, share: 6, growth: 21, costInfl: 4, daGrowth: 48, gcc: 18,
        mortgageLaw: 93, gulfMerger: 38, gulfConversion: 0,
        depositGrowth: 15, financingGrowth: 24, digitalAdoption: 68,
        costToIncomeTarget: 38, regionalExpansion: 18, rateEnv: 63,
      },
      rec: "Mortgage Law approval is the highest-probability single event that could rerate Apex's valuation. The Al Rajhi precedent shows mortgage book growth of 40% annually post-law, with P/B expanding from 2.1x to 4.8x. Apex must be ready on approval day, not 6 months after.",
      conf: "Moderate-High",
      assum: [
        "Regional Mortgage Law approved by legislature in 2026 or 2027",
        "Apex launches Sharia-compliant mortgage product within 30 days of approval — not 6 months",
        "Digital channel handles 70%+ of mortgage applications — this is the valuation signal",
        "Mortgage book grows substantially within 3 years — from near-zero today",
      ],
      risks: [
        "Mortgage Law delayed again — the 'regulatory catalyst' narrative loses credibility with investors",
        "Larger peers launch mortgage products first — Apex loses the first-mover premium",
        "Rapid balance sheet expansion pressures capital adequacy below regulatory comfort zone",
      ],
      acts: [
        "Pre-build the Sharia mortgage product today — launch-ready before the law passes",
        "Pre-approve customers digitally — announce this publicly to signal readiness",
        "Communicate the mortgage opportunity to investors now: 'significant pent-up demand, Apex is ready'",
      ],
      opp: [
        "Al Rajhi precedent: mortgage law + digital-first = P/B expansion from 2x to 4x in 3 years",
        "Mortgage customers are 15–25 year relationships — the highest-LTV customer in banking",
        "Digital mortgage process is a genuine differentiator vs. branch-based conventional peers",
      ],
      rsk: [
        "Mortgage Law dependence — if delayed again, the valuation catalyst narrative collapses",
        "Concentration risk: mortgage book growing from near-zero rapidly is aggressive",
        "Capital adequacy pressure if mortgage growth outpaces deposit growth",
      ],
    },
    boom: {
      name: "GCC Rerating", tag: "the platform premium path",
      set: {
        ai: 43, pricing: 38, share: 5, growth: 15, costInfl: 5, daGrowth: 38, gcc: 68,
        mortgageLaw: 48, gulfMerger: 32, gulfConversion: 0,
        depositGrowth: 13, financingGrowth: 11, digitalAdoption: 63,
        costToIncomeTarget: 40, regionalExpansion: 68, rateEnv: 53,
      },
      rec: "GCC expansion is the path to a platform premium — but only after the domestic franchise is fully optimized. Regional expansion creates scale but not a premium multiple if the domestic narrative is not established first. The lesson: depth before breadth.",
      conf: "Moderate",
      assum: [
        "Domestic franchise is fully optimized before GCC expansion begins — P/B above 2.5x domestically first",
        "UAE digital banking license obtained within 24 months — digital-only, no branches",
        "GCC expansion narrative adds a 'platform premium' to the P/B multiple",
        "Capital adequacy supports expansion without dilutive rights issue",
      ],
      risks: [
        "Premature expansion dilutes the domestic narrative and the capital",
        "Management bandwidth — domestic franchise + GCC Peer Bank A + GCC expansion simultaneously is too many fronts",
        "Regulatory approval timelines in each GCC market are unpredictable",
      ],
      acts: [
        "Sequence explicitly: domestic rerating first (P/B 2.5x+), then GCC expansion",
        "UAE digital-only entry — no branches, no acquisition — preserves the capital for domestic franchise",
        "Communicate the GCC roadmap to investors now, but execute domestic first",
      ],
      opp: [
        "GCC Islamic banking market is large — the platform premium is real if the narrative is right",
        "Digital-first GCC entry has lower capital requirements than branch banking",
        "A GCC Islamic neobank commands a software-adjacent multiple — 4x+ P/B is achievable",
      ],
      rsk: [
        "Expansion before domestic rerating dilutes the narrative and the capital",
        "Regulatory approval timelines in each GCC market are unpredictable",
        "Talent competition with regional fintechs for the engineers who build the platform",
      ],
    },
  },
  growthPaths: [
    { t: "Digital Rerating: 1.3x → 3.0x P/B", d: "Commit to the digital platform strategy — open banking API, AI credit, BaaS — and communicate a 3-year P/B target to the market. The leading peer's playbook, executed with hindsight advantage.", live: s => (s.digitalAdoption ?? 0) >= 65 && s.ai >= 50 },
    { t: "Mortgage First-Mover Premium", d: "Be launch-ready on Mortgage Law approval day. Pre-approve customers digitally. The Al Rajhi precedent: mortgage law + digital = P/B expansion from 2x to 4x in 3 years.", live: s => (s.mortgageLaw ?? 0) >= 60 && (s.financingGrowth ?? 0) >= 15 },
    { t: "Merger Scale Premium", d: "Execute the GCC Peer Bank A merger with a clean Sharia conversion narrative. Combined asset base justifies institutional investor attention and a 2.0–2.4x P/B.", live: s => (s.gulfMerger ?? 0) >= 50 && (s.gulfConversion ?? 0) >= 40 },
    { t: "Narrative Rerating", d: "Define and communicate a clear 3-year strategic story. The market currently has no coherent narrative for Apex. A clear story alone — without any operational change — could close 30% of the valuation gap.", live: s => s.growth >= 12 && (s.digitalAdoption ?? 0) >= 50 },
    { t: "GCC Platform Premium", d: "After domestic rerating (P/B 2.5x+), expand to UAE digital-only. A GCC Islamic neobank commands a software-adjacent multiple — 4x+ P/B is the ceiling.", live: s => (s.regionalExpansion ?? 0) >= 50 && (s.digitalAdoption ?? 0) >= 60 },
  ],
  failPaths: [
    { t: "Narrative Vacuum", d: "No clear strategic story means the market defaults to 'small bank with merger risk'. P/B stays at 1.3x or falls. This is the current default trajectory.", live: s => s.growth < 12 && (s.digitalAdoption ?? 0) < 55 },
    { t: "Merger Without Conversion Timeline", d: "Proceeding with the GCC Peer Bank A merger without a defined Sharia conversion timeline is the single most likely path to P/B compression below 1.1x.", live: s => (s.gulfMerger ?? 0) >= 60 && (s.gulfConversion ?? 0) < 40 },
    { t: "Leading Peer Captures the Premium", d: "Leading GCC Islamic peer reaches 4x P/B while Apex is at 1.3x. The gap becomes structural — Apex can no longer compete for talent, acquisitions, or institutional capital.", live: s => (s.digitalAdoption ?? 0) < 50 && s.ai < 40 },
    { t: "Mortgage Law Dependence", d: "Strategy is over-indexed on a single regulatory event. If the law is delayed again, the valuation catalyst narrative collapses and investor patience runs out.", live: s => (s.mortgageLaw ?? 0) < 30 && (s.financingGrowth ?? 0) < 8 },
    { t: "Capital Drag Without Upside", d: "GCC Peer Bank A stake without a merger timeline is capital that earns a minority dividend, not a control premium. P/B reflects the drag.", live: s => (s.gulfMerger ?? 0) < 30 && (s.depositGrowth ?? 0) < 8 },
  ],
  historicalPrecedents: [
    { name: "Boubyan Bank (Kuwait)", outcome: "P/B expanded from 1.2x to 3.2x (2015–2025) through digital-first focus and avoiding premature geographic expansion. Assets grew from KD 2B to KD 9B.", relevance: "The direct valuation benchmark — same market, same regulatory environment, same Islamic banking model. Boubyan's P/B is the target, not the ceiling." },
    { name: "Al Rajhi Bank (Saudi Arabia)", outcome: "P/B expanded from 2.1x to 4.8x in the 3 years following Saudi mortgage law. Mortgage book grew 40% annually. Digital channel handled 72% of applications.", relevance: "The Mortgage Law catalyst precedent — the most important data point for Islamic bank valuation rerating potential." },
    { name: "Emirates Islamic (UAE)", outcome: "Converted from conventional to Islamic banking in 2004. Conversion took 3 years and required regulatory approval for each product category. P/B compressed during conversion, then expanded.", relevance: "Sharia conversion precedent — the market prices in conversion risk before it prices in the upside. GCC Peer Bank A conversion will follow the same pattern." },
    { name: "NCB / Samba merger (Saudi Arabia)", outcome: "Created Saudi National Bank — largest bank in Saudi Arabia — but P/B did not expand post-merger. Scale without a premium narrative does not rerate.", relevance: "The merger valuation lesson — scale is necessary but not sufficient for P/B expansion. The narrative must change, not just the balance sheet." },
    { name: "Kakao Bank (South Korea)", outcome: "P/B reached 8x at IPO as a digital-first bank with no branches. Cost-to-income of 28% — 20 points below conventional peers — was the primary valuation driver.", relevance: "The platform premium ceiling — a digital Islamic bank with Apex's cost-to-income trajectory could command a multiple that conventional bank comparables cannot predict." },
  ],
  outcomeLedgerEntry: {
    ref: "OL-004",
    decision: "Apex Islamic Bank: What is the primary driver of valuation rerating from 1.3x P/B to 3.0x+ P/B — and what is the sequence of decisions required to achieve it?",
    hiddenVariable: "Narrative Architecture Constraint — the market currently has no coherent story about what Apex is becoming. The valuation gap is not primarily a fundamentals gap. It is a narrative gap. The hidden variable is whether Apex's board is willing to commit publicly to a 3-year strategic direction — and whether that direction is digital platform, GCC Peer Bank A merger scale, or mortgage catalyst.",
    recommendation: "The valuation rerating pathway is the single most important strategic question. The answer determines whether the GCC Peer Bank A merger is a rerating event or a distraction. Pursue the digital platform narrative first — it does not require the merger, does not require the Mortgage Law, and is the path the leading peer used to reach 3.2x P/B. The merger and the Mortgage Law are accelerants, not foundations.",
    confidence: 68,
    reviewDates: ["December 2026", "June 2027", "December 2027"],
  },
};

// ─── Zain Group ───────────────────────────────────────────────────────────────
// Data sources: Zain FY2025 Press Release (Feb 2026), Yahoo Finance ZAIN.KW (Jun 2026),
// Zain Q1'2026 results (May 2026), Zain AR2025, Kuwait Times FY2025 coverage
// Single organizing question: How does Zain transition from 5.1x EV/EBITDA (telecom)
// to 10–12x EV/EBITDA (digital infrastructure)? Benchmark: e& (formerly Etisalat) at 8–10x.
// FY2025 verified actuals: Revenue KD 2,290M (+14% YoY) · EBITDA KD 780M · Net Income KD 239M (+103%)
// Market Cap KD 2,620M · EV KD 4,280M · EV/EBITDA 5.09x · P/B 2.07x · ROE 15.66%
// Subscribers 50.9M · ZainTECH +55% YoY · New verticals USD 743M (+67%) · Data 37% of revenue
export const ZAIN_TEMPLATE: CompanyTemplate = {
  id: "zain",
  name: "Zain Group",
  industry: "Telecommunications / Digital Infrastructure",
  region: "GCC · MENA · Africa · 8 Markets",
  brand: "#E4002B",
  brandDark: "#B0001F",
  sliderOverrides: {
    pricingName: "Digital Revenue Mix",
    pricingLow: "Connectivity-Led",
    pricingHigh: "Digital Services-Led",
    pricingFmt: (v: number) => v < 25 ? "Connectivity" : v < 60 ? "Hybrid" : "Digital-Led",
    gccName: "New Verticals Acceleration",
    gccLow: "Organic Only",
    gccHigh: "Aggressive Build/Buy",
  },
  geoLabels: { ksa: "Saudi Arabia", uae: "Iraq / Jordan / Bahrain", kw: "Kuwait", other: "Sudan / Africa" },
  defaults: {
    // FY2025 actuals — Revenue KD 2,290M · EBITDA KD 780M · EBITDA margin 34%
    // Net Income KD 239M (+103% YoY, 13-year high) · Market Cap KD 2,620M
    // EV KD 4,280M · EV/EBITDA 5.09x · P/B 2.07x · ROE 15.66%
    // Subscribers 50.9M · ZainTECH revenue +55% YoY · New verticals USD 743M (+67%)
    // Data revenue USD 2.8B (37% of total) · Fintech +28% YoY · CAPEX USD 1.5B (20% of rev)
    rev: 2290, eb: 780, emp: 11000, fee: 7440, util: 78,
    geo: { ksa: 38, uae: 22, kw: 16, other: 24 },
    svc: { arch: 0, eng: 0, pm: 37, pgm: 37, da: 26 },
    dig: 37,
  },
  overviewText: "Zain Group generated <b>KD 2.3 billion in revenue</b> in FY2025 — up 14% — serving <b>50.9 million customers</b> across 8 markets. Net income surged 103% to KD 239M, a 13-year high. ZainTECH grew 55% and new digital verticals reached USD 743M (+67%). The market values Zain at <b>5.1x EV/EBITDA</b> — a pure telecom multiple. e& (formerly Etisalat), which completed its digital transformation, trades at <b>8–10x EV/EBITDA</b>. The gap between 5.1x and 10x represents approximately <b>KD 3.8 billion in unrealised enterprise value</b>. The question is not whether to grow — Zain is already growing. The question is: <b>does the market rerate Zain as a digital infrastructure company, and what has to be true for that to happen?</b>",
  scenarios: {
    current: {
      name: "Telecom Multiple: Today", tag: "5.1x EV/EBITDA — where you stand", base: true,
      set: { ai: 18, pricing: 22, share: 8, growth: 14, costInfl: 5, daGrowth: 37, gcc: 25 },
      rec: "Zain is growing strongly but the market still prices it as a connectivity company. The 5.1x EV/EBITDA multiple reflects a telecom, not a digital infrastructure platform. The gap to e& at 8–10x is not a revenue problem — it is a narrative and composition problem.",
      conf: "High",
      assum: ["FY2025 actuals: revenue KD 2,290M (+14%), EBITDA KD 780M, net income KD 239M (+103%)", "ZainTECH +55% YoY, new verticals USD 743M (+67%), data revenue 37% of total", "Market cap KD 2,620M, EV KD 4,280M, EV/EBITDA 5.09x, P/B 2.07x"],
      risks: ["Market continues to price Zain as a pure telecom at 5x", "Digital verticals remain sub-scale relative to total revenue", "Africa macro volatility compresses reported earnings"],
      acts: ["Establish ZainTECH as a separately reported segment with its own multiple", "Communicate digital revenue trajectory to institutional investors", "Set a public target: digital verticals to 25% of EBITDA by 2027"],
      opp: ["ZainTECH already growing at 55% — the asset exists", "New verticals at USD 743M — material and accelerating", "Investor narrative shift could add KD 1–2B in market cap without a single new customer"],
      rsk: ["Digital verticals still <10% of EBITDA — not yet material enough to move the multiple", "Africa exposure (24% of revenue) depresses peer comparisons", "Connectivity ARPU pressure in mature GCC markets"],
    },
    aiaug: {
      name: "AI-Augmented Operations", tag: "cost efficiency + network intelligence",
      set: { ai: 68, pricing: 28, share: 9, growth: 12, costInfl: 2, daGrowth: 52, gcc: 30 },
      rec: "Deploy AI across network operations, customer service, and fraud detection to expand EBITDA margin from 34% toward 38–40%. Margin expansion is a prerequisite for multiple rerating — a higher-margin telecom earns a higher multiple.",
      conf: "High",
      assum: ["AI network optimization reduces opex by 8–12% over 3 years", "Customer service AI reduces cost-to-serve by 20–25%", "Fraud AI reduces annual losses materially across 8 markets"],
      risks: ["Multi-market integration complexity (8 regulatory environments)", "Talent to build and maintain models across markets", "AI capex adds to already elevated 20% capex/revenue ratio"],
      acts: ["Deploy unified AI network operations center across GCC markets", "Launch AI customer service in Kuwait and Saudi Arabia first", "Build real-time fraud detection for ZainCash and fintech products"],
      opp: ["EBITDA margin expansion from 34% to 38%+ adds KD 90–120M to annual EBITDA", "Improved customer NPS supports ARPU defence", "AI capability becomes a ZainTECH product offering for enterprise clients"],
      rsk: ["Productivity gains may not offset Africa macro headwinds", "Regulatory variation across 8 markets slows deployment", "Model maintenance costs are ongoing, not one-time"],
    },
    digital: {
      name: "Digital Infrastructure Rerating", tag: "the 10x EV/EBITDA path",
      set: { ai: 60, pricing: 72, share: 11, growth: 16, costInfl: 3, daGrowth: 90, gcc: 55 },
      rec: "ZainTECH, ZainCash, ZOI, and Zain Insure reach 25%+ of EBITDA. Institutional investors rerate Zain from a telecom to a digital infrastructure platform. This is the e& playbook — it took 4 years and required a visible, named digital business unit with its own P&L.",
      conf: "Moderate-High",
      assum: ["ZainTECH revenue reaches USD 1.5B+ by 2028 (from ~USD 480M in 2025)", "Digital verticals collectively reach 25% of group EBITDA", "Institutional investors accept the digital infrastructure narrative"],
      risks: ["Hyperscalers (AWS, Azure, Google) compete directly for ZainTECH's B2B clients", "Consumer digital services (ZOI, entertainment) face high churn", "Capital intensity of digital buildout compresses near-term free cash flow"],
      acts: ["List ZainTECH as a separately traded entity or establish a public valuation anchor", "Accelerate ZainCash across Africa — the fintech multiple is 15–20x vs 5x for telecom", "Build hyperscaler partnership model (AWS/Azure reseller + local edge)"],
      opp: ["EV/EBITDA rerating from 5.1x to 8x adds KD 2.3B in enterprise value", "ZainTECH at 15x multiple on USD 1B revenue = USD 15B standalone value", "Africa fintech at scale commands a separate, higher multiple"],
      rsk: ["Execution risk is high — e& took 4 years with dedicated leadership", "Capability gap vs hyperscalers in cloud and AI", "Investor patience for a 3–5 year transformation is limited"],
    },
    margin: {
      name: "ARPU Compression", tag: "the warning case",
      set: { ai: 12, pricing: 10, share: 6, growth: 3, costInfl: 8, daGrowth: 12, gcc: 15 },
      rec: "Price competition in GCC and Africa macro headwinds compress ARPU and EBITDA simultaneously. The multiple contracts further. This is the scenario where Zain's strong FY2025 performance proves to be a peak, not a trend.",
      conf: "Moderate",
      assum: ["GCC telecom price competition intensifies in 2026–2027", "Africa currency devaluation compresses USD-reported revenue", "Digital verticals grow slower than planned due to enterprise sales cycle"],
      risks: ["EBITDA margin contracts from 34% toward 28–30%", "Dividend sustainability questioned (payout ratio already 63%)", "Rating agency concern on leverage (total debt KD 2.13B)"],
      acts: ["Accelerate network sharing agreements to reduce opex", "Exit or monetize non-core assets (tower portfolio, non-strategic markets)", "Protect ZainTECH investment even in compression scenario"],
      opp: ["Forces overdue portfolio rationalization", "Network sharing reduces capex intensity", "Compression scenario makes the digital pivot more urgent and politically easier"],
      rsk: ["Sustained ARPU pressure across GCC markets", "Africa macro shock compounds GCC weakness", "Dividend cut damages institutional investor confidence"],
    },
    ainative: {
      name: "Hyperscaler Threat", tag: "the existential case",
      set: { ai: 88, pricing: 85, share: 11, growth: 8, costInfl: 3, daGrowth: 80, gcc: 45 },
      rec: "AWS, Azure, and Google are already in the GCC. ZainTECH's B2B enterprise clients are the target. Zain's moat is local compliance, regulatory relationships, and last-mile infrastructure — not technology. The response is partnership, not competition.",
      conf: "Moderate-High",
      assum: ["Hyperscalers accelerate direct enterprise sales in Kuwait, Saudi Arabia, and Iraq", "ZainTECH's managed services clients consider direct hyperscaler relationships", "Zain can differentiate on data sovereignty, local compliance, and physical infrastructure"],
      risks: ["AWS/Azure/Google compete directly for ZainTECH's largest B2B clients", "Talent war: hyperscalers pay 2–3x telecom compensation for cloud engineers", "Connectivity commoditization accelerates as hyperscalers build private networks"],
      acts: ["Build formal hyperscaler partnership model (AWS/Azure/Google reseller + local edge)", "Differentiate ZainTECH on data sovereignty and local regulatory compliance", "Accelerate own edge computing capability for 5G private networks"],
      opp: ["Hyperscaler partnership revenue: reseller margin on cloud services", "Differentiated local cloud offering for government and regulated industries", "Edge computing for 5G private networks is a hyperscaler gap"],
      rsk: ["Direct hyperscaler competition erodes ZainTECH revenue", "Talent retention vs hyperscaler compensation", "Capital intensity of own cloud infrastructure"],
    },
    boom: {
      name: "GCC Digital Infrastructure Boom", tag: "the 5G + smart city cycle",
      set: { ai: 45, pricing: 40, share: 12, growth: 18, costInfl: 5, daGrowth: 55, gcc: 75 },
      rec: "The GCC smart city and 5G investment cycle — NEOM, Lusail, Kuwait Vision 2035 — creates a multi-year infrastructure and services opportunity. Zain's 8-market footprint and ZainTECH capability make it a natural anchor provider. Disciplined capital allocation is the constraint.",
      conf: "Moderate-High",
      assum: ["GCC smart city projects (NEOM, Lusail, Kuwait Vision 2035) proceed at scale", "5G monetization through B2B IoT and private network services", "Zain wins anchor connectivity and managed services contracts"],
      risks: ["Capex intensity of 5G rollout (already at 20% of revenue)", "Smart city project delays are common in GCC", "Competition from Ericsson, Nokia, and Huawei for infrastructure contracts"],
      acts: ["Secure anchor smart city contracts in Kuwait and Saudi Arabia", "Accelerate 5G B2B go-to-market through ZainTECH", "Build IoT and private network platform for industrial clients"],
      opp: ["Long-term smart city connectivity revenue (10–15 year contracts)", "5G B2B premium pricing: 3–5x consumer ARPU", "IoT platform revenue with recurring SaaS characteristics"],
      rsk: ["Capex overrun on 5G rollout", "Smart city project delays compress near-term returns", "Competition from incumbent infrastructure players with deeper pockets"],
    },
  },
  growthPaths: [
    {
      t: "ZainTECH to USD 1.5B Revenue",
      d: "ZainTECH grew 55% in FY2025 to ~USD 480M. Scaling to USD 1.5B by 2028 changes the group's multiple. At 15x revenue, ZainTECH alone would be worth USD 22.5B — more than Zain Group's current EV.",
      live: s => s.daGrowth >= 55 && s.gcc >= 35,
    },
    {
      t: "Africa Fintech at Scale",
      d: "ZainCash and Zain Insure serve 50.9M customers across Africa. Mobile money commands 15–20x revenue multiples vs 5x for connectivity. Scaling fintech to 10% of group revenue would add KD 1–1.5B in enterprise value.",
      live: s => s.gcc >= 40 && s.daGrowth >= 35,
    },
    {
      t: "EV/EBITDA Rerating via Narrative",
      d: "e& moved from 5x to 8–10x EV/EBITDA through investor communication, not just revenue growth. Zain's digital verticals are already material. The rerating requires a named digital business unit with its own P&L and a public valuation anchor.",
      live: s => s.pricing >= 55 && s.daGrowth >= 50,
    },
    {
      t: "AI-Driven Margin Expansion",
      d: "EBITDA margin expansion from 34% to 38%+ through AI network operations, customer service automation, and fraud detection. Each 1% margin improvement adds KD 23M to annual EBITDA and KD 117M to enterprise value at 5x.",
      live: s => s.ai >= 55 && s.costInfl <= 4,
    },
  ],
  failPaths: [
    {
      t: "Telecom Multiple Trap",
      d: "Digital verticals grow but remain below 15% of EBITDA. The market continues to price Zain at 5x. KD 3.8B in potential enterprise value remains unrealised. This is the most likely failure mode — not a collapse, but a permanent discount.",
      live: s => s.daGrowth < 40 && s.pricing < 35,
    },
    {
      t: "Africa Macro Shock",
      d: "Sudan, Iraq, and sub-Saharan Africa account for 24% of revenue. Currency devaluation and political instability in one major market compresses USD-reported group revenue and triggers a multiple contraction.",
      live: s => s.gcc < 20 && s.growth < 6,
    },
    {
      t: "Hyperscaler Displacement of ZainTECH",
      d: "AWS and Azure accelerate direct enterprise sales in Kuwait and Saudi Arabia. ZainTECH's managed services clients migrate to hyperscaler platforms. The highest-multiple asset in the Zain portfolio loses its growth narrative.",
      live: s => s.ai < 35 && s.daGrowth < 30,
    },
    {
      t: "Capex Overrun on 5G",
      d: "5G rollout capex (already 20% of revenue) exceeds returns. Free cash flow compresses. Dividend sustainability is questioned. The market re-prices Zain as a capital-intensive utility, not a digital platform.",
      live: s => s.costInfl >= 7 && s.gcc >= 50,
    },
  ],
  historicalPrecedents: [
    {
      name: "e& (formerly Etisalat) Digital Transformation",
      outcome: "Rebranded from Etisalat to e& in 2022. Separated digital businesses into e& enterprise, e& life, e& capital. EV/EBITDA moved from 5–6x to 8–10x over 4 years. Market cap grew from USD 30B to USD 50B+.",
      relevance: "Closest comparable to Zain's current position. Same starting multiple, same digital assets, same GCC market. The playbook is documented and replicable.",
    },
    {
      name: "STC Digital Transformation",
      outcome: "STC launched stc pay (fintech), stc cloud (B2B), and stc tv (entertainment) as named sub-brands. EV/EBITDA expanded from 5x to 7–8x. stc pay reached a USD 1B+ valuation as a standalone entity.",
      relevance: "STC's fintech and cloud separation is directly analogous to ZainTECH and ZainCash. The sub-brand strategy with separate valuations is the mechanism for multiple rerating.",
    },
    {
      name: "Axiata Digital Transformation (Malaysia)",
      outcome: "Axiata separated Boost (fintech) and edotco (towers) as standalone entities. Tower monetization added USD 3B in enterprise value. Boost reached a USD 700M valuation.",
      relevance: "Zain's tower portfolio and ZainCash are analogous assets. Monetization through separation is a proven mechanism for unlocking hidden value in telecom portfolios.",
    },
  ],
  outcomeLedgerEntry: {
    ref: "OL-002",
    decision: "Zain Group: transition from telecom multiple (5.1x EV/EBITDA) to digital infrastructure multiple (8–10x EV/EBITDA) through ZainTECH scaling, Africa fintech, and investor narrative shift.",
    hiddenVariable: "Operational Sequencing Risk — whether ZainTECH can scale from USD 480M to USD 1.5B revenue before hyperscalers displace its B2B client base.",
    recommendation: "Accelerate ZainTECH scaling and establish it as a separately reported segment with a public valuation anchor. This is the single action most likely to close the valuation gap.",
    confidence: 80,
    reviewDates: ["December 2026", "December 2027", "December 2028"],
  },
};

// ─── Alghanim Industries ─────────────────────────────────────────────────────
// Data sources: Alghanim Industries official website (alghanim.com), Wikipedia,
// Forbes Middle East 2025 rankings, company press releases (Dec 2025 – Mar 2026)
// Estimated revenue: $4.1–5B (last disclosed $2.5B in 2009; industry estimates)
// 30+ business units · 40 countries · 15,000+ employees · Founded Kuwait 1932
// Single organising question: Is Alghanim a distributor with digital assets,
// or a digital platform that still runs distribution?
export const ALGHANIM_TEMPLATE: CompanyTemplate = {
  id: "alghanim",
  name: "Alghanim Industries",
  conglomerateMode: true,
  industry: "Diversified Conglomerate — Retail / Automotive / Industrial / Digital",
  region: "Kuwait · GCC · India · Southeast Asia · 40 Countries",
  brand: "#1A3A5C",
  brandDark: "#0F2540",
  geoLabels: { ksa: "Saudi Arabia / GCC", uae: "UAE / Levant", kw: "Kuwait (Core)", other: "India / SEA / Other" },
  sliderOverrides: {
    pricingName: "Platform vs. Distribution Mix",
    pricingLow: "Pure Distributor",
    pricingHigh: "Digital Platform",
    pricingFmt: (v: number) => v < 25 ? "Distributor" : v < 55 ? "Hybrid" : v < 80 ? "Platform-Led" : "Digital Conglomerate",
    gccName: "Regional Expansion Velocity",
    gccLow: "Kuwait-Centric",
    gccHigh: "Pan-GCC + India/SEA",
  },
  defaults: {
    // Estimated actuals: Revenue ~$4.1B · EBITDA ~$410M (10% margin estimate)
    // 15,000+ employees · 30+ business units · 40 countries
    // Retail/Automotive ~60% of revenue · Industrial ~20% · Services/Digital ~20%
    rev: 4100, eb: 410, emp: 15000, fee: 12000, util: 72,
    geo: { ksa: 18, uae: 14, kw: 52, other: 16 },
    svc: { arch: 0, eng: 0, pm: 28, pgm: 44, da: 28 },
    dig: 12,
  },
  overviewText: "Alghanim Industries is one of the Gulf's largest privately owned conglomerates — <b>$4B+ in estimated revenue</b>, 30+ business units, 15,000 employees across 40 countries. It is ranked <b>#1 company in Kuwait</b> by Forbes Middle East 2025. The business was built as a <b>distributor</b>: automotive franchises (11 brands including BYD and Ford), consumer electronics (Xcite), food franchises (Costa Coffee, Wendy's), and industrial systems (Kirby Steel). In 2025–2026 Alghanim made three strategic moves that signal something different: <b>Barq</b> (EV charging infrastructure), <b>Sama X</b> (Starlink satellite internet reseller), and <b>Fixly</b> (digital home services platform). The question is not whether Alghanim is successful — it clearly is. The question is: <b>is Alghanim becoming a digital platform that happens to run distribution, or a distributor that is experimenting with digital?</b> The answer determines whether the next decade looks like Majid Al Futtaim (AED 35.9B revenue, 41% net profit growth through platform economics) or a well-managed but structurally capped portfolio.",
  scenarios: {
    current: {
      name: "Conglomerate Distributor", tag: "today's business model", base: true,
      set: { ai: 12, pricing: 18, share: 8, growth: 5, costInfl: 6, daGrowth: 12, gcc: 20 },
      rec: "Alghanim is a high-quality distributor with strong brand relationships and Kuwait market leadership. The current model generates stable cash flows but is structurally capped by distribution margins and franchise dependency. The digital experiments (Barq, Sama X, Fixly) are real but sub-scale.",
      conf: "Moderate",
      assum: ["Kuwait remains the primary revenue base (~52% of revenue)", "Automotive and retail distribution margins hold at current levels", "Digital ventures remain below 5% of group revenue"],
      risks: ["Distribution margins compress as OEMs build direct channels", "EV transition disrupts the 11-brand automotive portfolio", "Digital experiments remain perpetually sub-scale without dedicated capital"],
      acts: ["Define which digital ventures receive dedicated capital vs. remain experiments", "Set a 3-year target for digital revenue as a % of group", "Evaluate which automotive brands are EV-ready vs. structurally declining"],
      opp: ["Kuwait market leadership provides a stable base for digital experimentation", "Strong brand relationships create distribution moat", "Family ownership enables long-term capital allocation without quarterly pressure"],
      rsk: ["Franchise dependency means OEM decisions outside Alghanim's control", "Kuwait concentration creates macro exposure", "Digital experiments without dedicated capital remain perpetually small"],
    },
    aiaug: {
      name: "AI-Augmented Operations", tag: "efficiency across 30+ units",
      set: { ai: 68, pricing: 22, share: 9, growth: 7, costInfl: 3, daGrowth: 35, gcc: 25 },
      rec: "Deploy AI across Xcite (personalised retail), automotive service (predictive maintenance), and Alghanim Freight (route optimisation). A conglomerate with 15,000 employees and 30+ units has more AI leverage than a single-business firm — but only if AI is deployed as a shared capability, not 30 separate experiments.",
      conf: "Moderate-High",
      assum: ["AI deployment is centralised across business units, not fragmented", "Xcite and automotive service are the primary AI leverage points", "EBITDA margin improves from ~10% toward 12–13% over 3 years"],
      risks: ["30+ business units create coordination complexity for AI rollout", "Talent to build and maintain models across sectors is scarce in Kuwait", "AI investment competes with digital venture capital allocation"],
      acts: ["Establish a central AI capability team serving all business units", "Deploy AI personalisation in Xcite first — highest ROI and fastest proof point", "Build predictive maintenance AI for the 11 automotive brands"],
      opp: ["EBITDA margin expansion from 10% to 13% adds ~$120M annually at current revenue", "Xcite AI personalisation increases basket size and repeat purchase", "Freight route optimisation reduces cost-to-serve across logistics network"],
      rsk: ["Fragmented AI deployment delivers marginal gains, not structural improvement", "Talent war with regional tech companies for AI engineers", "AI investment timeline is 18–24 months before material EBITDA impact"],
    },
    digital: {
      name: "Digital Platform Transformation", tag: "the Majid Al Futtaim path",
      set: { ai: 55, pricing: 72, share: 11, growth: 12, costInfl: 3, daGrowth: 85, gcc: 55 },
      rec: "Alghanim builds a consumer digital ecosystem: Xcite (electronics), Safat Home (furniture), Costa/Wendy's (F&B), Barq (EV charging), Sama X (connectivity), Fixly (home services) — unified under a single app and loyalty platform. This is the Majid Al Futtaim playbook: physical retail + digital platform + loyalty = a consumer relationship that no single-category competitor can replicate.",
      conf: "Moderate",
      assum: ["Xcite, Safat Home, and F&B franchises can be unified under a single digital platform", "Kuwait and GCC consumers adopt the super-app model (precedent: Careem, Noon, Talabat)", "Alghanim commits $200–300M in platform investment over 3 years"],
      risks: ["Super-app competition from Noon, Talabat, Careem is already entrenched", "Consumer loyalty across categories is harder to build than within a single category", "Platform investment requires 3–5 years before network effects materialise"],
      acts: ["Launch unified Alghanim consumer app with Xcite + Safat Home + F&B + Barq", "Build a single loyalty currency across all consumer-facing businesses", "Acquire or build a fintech/payments layer to capture transaction economics"],
      opp: ["Platform economics: each additional service increases retention across all services", "Loyalty data creates a consumer intelligence asset no competitor can replicate", "GCC super-app market is still contested — first-mover advantage is available"],
      rsk: ["Platform investment is long-dated with uncertain returns", "Noon and Talabat have 5+ year head starts in e-commerce", "Consumer behaviour change is slower than technology deployment"],
    },
    ev: {
      name: "EV Infrastructure Leader", tag: "Barq + 5 Chinese brands",
      set: { ai: 35, pricing: 45, share: 10, growth: 9, costInfl: 4, daGrowth: 45, gcc: 40 },
      rec: "Alghanim is already positioned on both sides of the EV transition: 5 Chinese EV brands (BYD, Chery, Exeed, JAC, Hongqi) in the automotive portfolio, and Barq as Kuwait's first dedicated EV charging infrastructure operator. If Kuwait's $200M government EV infrastructure allocation accelerates, Alghanim is the only private operator with both the vehicles and the charging network.",
      conf: "Moderate-High",
      assum: ["Kuwait EV adoption accelerates on government incentives and infrastructure investment", "Barq secures anchor charging contracts at Kuwait's major retail and commercial locations", "Chinese EV brands (BYD especially) capture 15–25% of Kuwait new car sales by 2028"],
      risks: ["Kuwait EV adoption is slower than government targets (infrastructure chicken-and-egg)", "Chinese EV brand quality perception risk in GCC premium segment", "Barq faces competition from petrol station operators (KNPC, Q8) entering EV charging"],
      acts: ["Secure Barq charging contracts at Xcite, Safat Home, and Costa locations — own the retail charging network", "Position BYD as the volume EV brand; Hongqi as the premium EV brand", "Lobby for government fleet electrification contracts through Barq"],
      opp: ["EV charging is a recurring revenue model vs. one-time vehicle sale", "Barq + BYD creates a vertically integrated EV ecosystem unique in Kuwait", "Government EV infrastructure allocation ($200M) is available to private operators"],
      rsk: ["EV charging infrastructure is capital-intensive with 7–10 year payback", "Chinese EV brand loyalty is unproven in GCC", "Petrol station operators have better real estate for charging infrastructure"],
    },
    margin: {
      name: "Distribution Margin Compression", tag: "the warning case",
      set: { ai: 10, pricing: 8, share: 6, growth: 2, costInfl: 9, daGrowth: 8, gcc: 12 },
      rec: "OEMs (Ford, GM, Honda) accelerate direct-to-consumer channels in GCC. Automotive distribution margins compress from 4–6% to 2–3%. Xcite faces margin pressure from Amazon.ae and Noon. Kuwait macro softness reduces consumer spending. This is not a collapse — it is a slow structural deterioration that is hard to see until it is too late.",
      conf: "Moderate",
      assum: ["OEM direct channel expansion in GCC accelerates (Ford Model e direct sales model)", "E-commerce platforms capture 15–20% of Kuwait consumer electronics market", "Kuwait government spending softens on oil price weakness below $65/barrel"],
      risks: ["Automotive distribution margin compression from 5% to 2–3% over 5 years", "Xcite revenue pressure from Amazon.ae and Noon in electronics", "Kuwait consumer confidence declines on macro softness"],
      acts: ["Accelerate digital platform investment before margin compression forces it", "Negotiate long-term franchise agreements with EV-ready OEMs", "Diversify revenue base away from Kuwait concentration"],
      opp: ["Compression forces overdue portfolio rationalisation", "Weak macro makes acquisitions cheaper", "Digital transformation becomes politically easier in a compression scenario"],
      rsk: ["Automotive distribution is 40%+ of estimated revenue — compression is material", "Xcite faces structural headwinds from e-commerce regardless of macro", "Kuwait concentration (52% of revenue) amplifies any Kuwait-specific shock"],
    },
    regional: {
      name: "GCC + India/SEA Expansion", tag: "40 countries, 3 regions",
      set: { ai: 40, pricing: 35, share: 12, growth: 14, costInfl: 5, daGrowth: 50, gcc: 80 },
      rec: "Alghanim already operates in 40 countries with presence in India and Southeast Asia. The question is whether to deepen these positions or remain a Kuwait-headquartered conglomerate with international distribution. Majid Al Futtaim chose depth in GCC; Abdul Latif Jameel chose breadth globally. Both strategies work — but they require different capital allocation and management models.",
      conf: "Moderate",
      assum: ["India and SEA operations can scale to 20%+ of group revenue by 2030", "Alghanim's Kuwait brand and relationships translate to new markets", "Capital is available for regional expansion alongside Kuwait investment"],
      risks: ["India and SEA require local partners and regulatory navigation", "Management bandwidth is finite — 40 countries with 30+ units is already complex", "Regional expansion competes with digital platform investment for capital"],
      acts: ["Define 3 priority markets outside Kuwait for deepened investment", "Evaluate Kirby Building Systems for GCC infrastructure boom positioning", "Build Sama X (Starlink) as a regional connectivity play, not just Kuwait"],
      opp: ["India infrastructure boom: Kirby steel buildings have a large addressable market", "SEA digital commerce: Alghanim's retail expertise is transferable", "GCC Vision 2030/2035 projects create multi-year industrial demand"],
      rsk: ["Regional expansion without focus dilutes returns", "Local competition in India and SEA is intense and well-capitalised", "Kuwait-centric management culture may not adapt to multi-market complexity"],
    },
  },
  growthPaths: [
    {
      t: "Consumer Super-App: Xcite + Safat + F&B + Barq",
      d: "Alghanim's consumer-facing businesses (Xcite Electronics, Safat Home, Costa Coffee, Wendy's, Barq EV charging) serve the same Kuwait middle-to-upper-income household. A unified digital platform with a single loyalty currency would create a consumer relationship that no single-category competitor can replicate. Majid Al Futtaim built AED 35.9B in revenue on exactly this model.",
      live: s => s.pricing >= 55 && s.daGrowth >= 60,
    },
    {
      t: "EV Ecosystem: Barq + 5 Chinese Brands",
      d: "Alghanim is the only private operator in Kuwait with both EV vehicles (BYD, Chery, Exeed, JAC, Hongqi) and EV charging infrastructure (Barq). Kuwait's $200M government EV allocation creates a first-mover window. Barq charging at Xcite and Safat Home locations creates a vertically integrated EV ecosystem.",
      live: s => s.gcc >= 35 && s.daGrowth >= 40,
    },
    {
      t: "Kirby Steel + GCC Infrastructure Boom",
      d: "Kirby Building Systems (pre-engineered steel) is positioned for the GCC infrastructure cycle: NEOM, Lusail, Kuwait Vision 2035. Kirby already has GCC presence. Scaling Kirby as a dedicated GCC infrastructure play — separate from the consumer portfolio — could add $200–400M in revenue by 2028.",
      live: s => s.gcc >= 50 && s.growth >= 10,
    },
    {
      t: "Sama X: Connectivity Infrastructure",
      d: "Sama X (Starlink authorized reseller, launched March 2026) is a connectivity infrastructure play. If Alghanim expands Sama X beyond Kuwait to GCC and India/SEA markets, it becomes a B2B connectivity provider for industrial sites, remote locations, and maritime — a recurring revenue model with infrastructure characteristics.",
      live: s => s.daGrowth >= 50 && s.gcc >= 45,
    },
  ],
  failPaths: [
    {
      t: "Automotive Distribution Disruption",
      d: "Ford, GM, and Honda are all piloting direct-to-consumer sales models. If OEMs accelerate direct channels in GCC, Alghanim's automotive distribution business (estimated 40%+ of revenue) faces structural margin compression. The 11-brand portfolio becomes a liability rather than an asset if franchise agreements are not renewed on current terms.",
      live: s => s.pricing < 25 && s.growth < 5,
    },
    {
      t: "Digital Experiments Without Commitment",
      d: "Barq, Sama X, and Fixly are all real businesses — but they are small. Without dedicated capital allocation and management focus, they remain perpetually sub-scale. The risk is not that they fail — it is that they succeed just enough to absorb management attention without ever reaching the scale needed to change the group's multiple.",
      live: s => s.daGrowth < 25 && s.pricing < 30,
    },
    {
      t: "Kuwait Concentration Risk",
      d: "~52% of estimated revenue is Kuwait-based. Kuwait's economy is oil-dependent and government spending is the primary demand driver. A sustained oil price below $65/barrel for 18+ months would compress Kuwait government spending, consumer confidence, and Alghanim's core revenue base simultaneously.",
      live: s => s.gcc < 20 && s.growth < 4,
    },
    {
      t: "Super-App Competition Too Late",
      d: "Noon, Talabat, Careem, and Amazon.ae have 5+ year head starts in GCC digital commerce. If Alghanim waits another 2–3 years before committing to a unified digital platform, the window for building a differentiated consumer super-app may close. The risk is not losing to a startup — it is losing to a well-capitalised regional platform that already has the consumer relationship.",
      live: s => s.daGrowth < 20 && s.pricing < 20,
    },
  ],
  historicalPrecedents: [
    {
      name: "Majid Al Futtaim (UAE)",
      outcome: "Revenue grew from AED 15B to AED 35.9B (2015–2025) through unified digital platform, Carrefour franchise, and loyalty programme (SHARE). Net profit grew 41% in 2024. The key move: treating retail, F&B, and entertainment as one consumer relationship, not 10 separate businesses.",
      relevance: "The closest strategic analogue to Alghanim's consumer portfolio. MAF's SHARE loyalty programme is the mechanism that unified the portfolio. Alghanim has the same raw ingredients — it lacks the unifying platform.",
    },
    {
      name: "Abdul Latif Jameel (Saudi Arabia)",
      outcome: "Diversified from Toyota distribution into renewable energy (Abdul Latif Jameel Energy), fintech, and healthcare. Revenue estimated $10B+. Ranked #1 Forbes Arab Family Business 2026. The key move: using distribution cash flows to fund new-economy businesses before the distribution model was disrupted.",
      relevance: "The strategic template for using distribution profits to fund digital/new-economy transformation. Alghanim has the same distribution cash flows and the same transformation imperative.",
    },
    {
      name: "Jardine Matheson (Hong Kong/Asia)",
      outcome: "Asian conglomerate with $35B revenue across automotive, retail, property, and industrial. Maintained relevance through 150+ years by continuously rotating the portfolio — exiting declining businesses and entering new ones. Automotive distribution remains a core business.",
      relevance: "The long-term conglomerate management model. Jardine's portfolio rotation discipline — not loyalty to any single business — is the governance principle that has sustained it across multiple economic cycles.",
    },
    {
      name: "Inchcape (UK/Global)",
      outcome: "Pure-play automotive distribution company, $12B revenue, 40+ markets. Inchcape chose depth in automotive rather than diversification. EV transition is its primary strategic challenge — it is actively building EV-specific capabilities and renegotiating OEM agreements.",
      relevance: "The cautionary tale for automotive distribution concentration. Inchcape's EV transition challenge is exactly the challenge Alghanim faces with its 11-brand automotive portfolio — and Inchcape has a 5-year head start in addressing it.",
    },
  ],
  outcomeLedgerEntry: {
    ref: "OL-004",
    decision: "Alghanim Industries: Is the company a distributor with digital assets, or a digital platform that still runs distribution? The answer determines capital allocation for the next decade.",
    hiddenVariable: "Platform Commitment Threshold — Alghanim's digital ventures (Barq, Sama X, Fixly) are real but sub-scale. The hidden variable is whether the Alghanim family is willing to allocate $200–300M in dedicated platform capital — enough to reach escape velocity — or whether digital remains a portfolio of experiments that never changes the group's identity or multiple.",
    recommendation: "Commit to the consumer super-app strategy with dedicated capital. The window is 18–24 months before Noon and Talabat entrench the consumer relationship in Kuwait. The EV ecosystem (Barq + 5 Chinese brands) is the most differentiated asset in the portfolio — it should be the anchor of the digital narrative, not a footnote.",
    confidence: 65,
    reviewDates: ["December 2026", "June 2027", "December 2027"],
  },
};

// ─── Core42 ──────────────────────────────────────────────────────────────────
// Data sources: Core42 press releases (May–June 2026), LinkedIn (Talal Al Kaissi, Dec 2025),
// HSBC trade finance announcement ($550M, May 2026), Buffalo 42MW expansion (June 2026),
// ABI Research neocloud report (Dec 2025), McKinsey inference workload forecast (Feb 2026),
// G42/Microsoft $1.5B partnership (April 2024)
// Private company — no public financials. Revenue estimated $300–500M (analyst estimates).
// Single organising question: Is Core42 a sovereign AI infrastructure provider that is
// expanding commercially, or a commercial cloud provider that uses sovereign credentials
// as a differentiator? The answer determines everything: positioning, pricing, partnerships,
// and whether the $550M capital deployment creates durable value or dilutes the only moat
// that hyperscalers cannot replicate.
export const CORE42_TEMPLATE: CompanyTemplate = {
  id: "core42",
  name: "Core42",
  conglomerateMode: true,
  industry: "Sovereign AI Infrastructure / Cloud Computing / HPC",
  region: "UAE (Abu Dhabi) · US · Europe · Middle East",
  brand: "#0A2342",
  brandDark: "#061628",
  geoLabels: { ksa: "Saudi Arabia / MENA", uae: "UAE / GCC (Core)", kw: "Europe (Dublin HQ)", other: "US (Buffalo / NY)" },
  sliderOverrides: {
    pricingName: "Sovereign vs. Commercial Mix",
    pricingLow: "Pure Sovereign",
    pricingHigh: "Full Commercial",
    pricingFmt: (v: number) => v < 20 ? "Sovereign-Only" : v < 45 ? "Sovereign-Led" : v < 70 ? "Hybrid Neocloud" : v < 88 ? "Commercial-Led" : "Hyperscaler Competitor",
    gccName: "US/Europe Expansion Velocity",
    gccLow: "MENA-Centric",
    gccHigh: "Tier-1 Global Cloud",
  },
  defaults: {
    // Estimated: Revenue ~$400M · EBITDA ~$80M (20% margin estimate for infrastructure)
    // $550M HSBC facility (May 2026) · 10 operational sites · 42MW Buffalo (June 2026)
    // G42 parent ~$10B+ valuation · Microsoft/G42 $1.5B partnership (April 2024)
    rev: 400, eb: 80, emp: 2000, fee: 1200, util: 74,
    geo: { ksa: 22, uae: 48, kw: 12, other: 18 },
    svc: { arch: 0, eng: 0, pm: 18, pgm: 52, da: 30 },
    dig: 85,
  },
  overviewText: "Core42 is a G42 company and the world's most credible <b>sovereign AI infrastructure provider</b> — 10 operational sites, $550M in fresh capital (HSBC, May 2026), a 42MW expansion at Buffalo (June 2026), and a European HQ in Dublin. It is the only neocloud that can credibly tell a government: <i>your data never leaves your jurisdiction, and we are not owned by a US hyperscaler.</i> That is an asset AWS, Azure, and Google cannot replicate. But Core42 is now deploying $550M to compete for <b>US and European enterprise workloads</b> — the same market where AWS, Azure, and Google have 3x–10x its scale. The tension is live: <b>Is Core42 a sovereign AI infrastructure provider that is expanding commercially, or a commercial cloud provider that uses sovereign credentials as a differentiator?</b> The answer determines whether the $550M creates durable value or dilutes the only moat hyperscalers cannot buy.",
  scenarios: {
    current: {
      name: "Sovereign Neocloud", tag: "today's identity and position", base: true,
      set: { ai: 35, pricing: 28, share: 8, growth: 40, costInfl: 12, daGrowth: 85, gcc: 22 },
      rec: "Core42 is the world's leading sovereign AI infrastructure provider — a position no hyperscaler can replicate. The current model generates strong growth from government and regulated enterprise clients who need data residency, compliance, and non-hyperscaler optionality. The $550M capital deployment and Buffalo expansion signal a commercial push that is already underway. The strategic question is not whether to expand — it is whether the expansion preserves or dilutes the sovereign identity that makes Core42 irreplaceable.",
      conf: "Moderate-High",
      assum: [
        "Sovereign AI demand from governments and regulated industries continues to grow",
        "Core42's non-hyperscaler positioning remains a credible differentiator",
        "Interim CEO Talal Al Kaissi executes the $550M deployment without strategic drift",
      ],
      risks: [
        "Commercial expansion dilutes sovereign identity before new commercial revenue is material",
        "Permanent CEO appointment resets strategic priorities mid-deployment",
        "Microsoft/G42 partnership constrains Core42's commercial independence in US market",
      ],
      acts: [
        "Define the sovereign identity boundary: which workloads are sovereign-only, which are commercial",
        "Appoint permanent CEO before the $550M deployment reaches its critical decision points",
        "Establish a public sovereign AI standard that competitors cannot meet",
      ],
      opp: [
        "Sovereign AI demand is accelerating — EU AI Act, US Executive Order, GCC national AI programmes",
        "No hyperscaler can credibly offer data sovereignty to a government",
        "First-mover advantage in sovereign AI infrastructure is compounding",
      ],
      rsk: [
        "Identity dilution: competing for enterprise workloads makes Core42 look like a smaller AWS",
        "Interim leadership creates strategic uncertainty during a critical capital deployment",
        "Oracle is winning government cloud contracts in UAE and EU — direct sovereign competitor",
      ],
    },
    commercial: {
      name: "Commercial Cloud Expansion", tag: "the $550M deployment path",
      set: { ai: 55, pricing: 72, share: 11, growth: 65, costInfl: 15, daGrowth: 90, gcc: 75 },
      rec: "Deploy the $550M to compete for US and European enterprise GPU workloads. Scale Buffalo from 42MW toward 200MW+. Compete with CoreWeave, Nscale, and Lambda Labs for AI training and inference capacity. The commercial opportunity is real — but Core42 enters this market at a scale disadvantage against both hyperscalers and well-capitalised US neoclouds.",
      conf: "Moderate",
      assum: [
        "Enterprise AI workload demand in US/Europe continues to grow at 40%+ annually",
        "Core42 can compete on price and reliability against CoreWeave and Nscale",
        "$550M is sufficient to reach minimum viable scale in US/Europe enterprise market",
      ],
      risks: [
        "CoreWeave, Nscale, Lambda Labs have 2–3 year head starts in US enterprise GPU market",
        "Hyperscalers can undercut on price and bundle with existing enterprise relationships",
        "Commercial expansion requires talent (sales, enterprise, cloud engineering) Core42 does not yet have at scale",
      ],
      acts: [
        "Hire US enterprise sales leadership with hyperscaler relationships",
        "Establish a commercial SLA and pricing model competitive with CoreWeave",
        "Build a US-specific go-to-market that does not rely on sovereign positioning",
      ],
      opp: [
        "US enterprise AI compute demand is structurally undersupplied",
        "Buffalo's renewable energy advantage (Lake Erie) is a real cost differentiator",
        "NVIDIA partnership provides access to latest GPU generations",
      ],
      rsk: [
        "Scale disadvantage vs. hyperscalers is structural, not temporary",
        "Commercial positioning erodes sovereign trust with government clients",
        "$550M may be insufficient for meaningful US/Europe enterprise market share",
      ],
    },
    sovereign: {
      name: "Sovereign AI Standard", tag: "the irreplaceable position",
      set: { ai: 45, pricing: 35, share: 9, growth: 45, costInfl: 10, daGrowth: 80, gcc: 30 },
      rec: "Consolidate Core42 as the world's definitive sovereign AI infrastructure standard. Build the certification, compliance, and governance framework that governments require — and that hyperscalers structurally cannot offer. Become the ISO 27001 of sovereign AI: the standard that every government AI programme must meet. This is the path where Core42's moat is permanent.",
      conf: "Moderate-High",
      assum: [
        "Sovereign AI regulation accelerates globally (EU AI Act, US EO, GCC national programmes)",
        "Core42 can define and own the sovereign AI certification standard",
        "Government AI budgets grow faster than enterprise AI budgets through 2030",
      ],
      risks: [
        "Sovereign market ceiling: government AI budgets are large but finite",
        "Oracle, AWS GovCloud, and Azure Government are investing heavily in sovereign positioning",
        "Geopolitical risk: UAE/Abu Dhabi ownership creates trust issues in some Western government markets",
      ],
      acts: [
        "Launch a Sovereign AI Certification programme with independent governance",
        "Win 3 G7 government AI infrastructure contracts in 18 months",
        "Publish a Sovereign AI white paper that becomes the industry reference document",
      ],
      opp: [
        "No competitor has yet defined the sovereign AI standard — the position is available",
        "EU AI Act creates mandatory sovereign AI requirements for member states",
        "GCC national AI programmes (UAE, Saudi, Qatar) are multi-billion dollar opportunities",
      ],
      rsk: [
        "Sovereign-only positioning limits total addressable market",
        "Geopolitical complexity in G7 markets (US, UK, Germany) due to UAE ownership",
        "Standard-setting requires regulatory relationships Core42 is still building in Europe",
      ],
    },
    hybrid: {
      name: "Hybrid Neocloud", tag: "sovereign credentials as commercial differentiator",
      set: { ai: 50, pricing: 55, share: 10, growth: 52, costInfl: 12, daGrowth: 88, gcc: 50 },
      rec: "Use sovereign credentials as the commercial differentiator for enterprise customers who need data residency, compliance, and non-hyperscaler optionality — without abandoning the sovereign identity. This is the most commercially attractive path, but it requires the clearest positioning: Core42 must be able to explain in one sentence why it is better than AWS for regulated enterprise and better than Oracle for sovereign governments.",
      conf: "Moderate",
      assum: [
        "Regulated enterprise (financial services, healthcare, defence) is willing to pay a premium for sovereign-grade infrastructure",
        "Core42 can build a commercial sales motion without diluting government trust",
        "The hybrid positioning is coherent enough to win in both markets simultaneously",
      ],
      risks: [
        "Unclear positioning: neither fully sovereign nor fully commercial is a common failure mode",
        "Sales motion for regulated enterprise is different from government sales — requires different talent",
        "Competitors will claim sovereign credentials without the substance Core42 has",
      ],
      acts: [
        "Define the regulated enterprise ICP (ideal customer profile) with precision",
        "Build a sovereign compliance layer that enterprise customers can audit independently",
        "Separate the go-to-market: sovereign team for governments, regulated enterprise team for commercial",
      ],
      opp: [
        "Regulated enterprise (BFSI, healthcare, defence) is the fastest-growing segment of enterprise cloud",
        "GDPR, EU AI Act, and US data residency requirements create structural demand",
        "Core42 is the only neocloud with both sovereign credentials and hyperscale infrastructure",
      ],
      rsk: [
        "Positioning ambiguity loses to focused competitors in both segments",
        "Two separate go-to-market motions require 2x the commercial investment",
        "Enterprise sales cycles are 12–18 months — commercial revenue is slow to materialise",
      ],
    },
    inference: {
      name: "Inference Infrastructure Leader", tag: "the 2027–2030 workload shift",
      set: { ai: 78, pricing: 60, share: 10, growth: 58, costInfl: 10, daGrowth: 92, gcc: 45 },
      rec: "ABI Research (December 2025) projects inference workloads will account for 80% of neocloud market by 2030. McKinsey (February 2026) confirms inference will surpass training as the dominant workload. Core42's infrastructure is currently weighted toward training. The strategic move is to rebalance toward inference — which has different economics (lower GPU density, higher throughput, recurring revenue) and is less dominated by hyperscalers.",
      conf: "Moderate-High",
      assum: [
        "Inference workloads grow to 80% of neocloud market by 2030 (ABI Research, Dec 2025)",
        "Core42 can rebalance its infrastructure mix from training-heavy to inference-optimised",
        "Inference pricing is more stable and recurring than training burst pricing",
      ],
      risks: [
        "Inference optimisation requires different hardware mix (AMD MI300X, custom ASICs) vs. training (NVIDIA H100)",
        "Hyperscalers are already building inference-optimised infrastructure at scale",
        "Transition period creates a capability gap while training revenue declines and inference revenue builds",
      ],
      acts: [
        "Publish a public inference roadmap with specific capacity targets by 2027",
        "Partner with AMD for inference-optimised GPU deployment alongside existing NVIDIA capacity",
        "Build inference-specific SLAs (latency, throughput, uptime) that training-focused competitors cannot match",
      ],
      opp: [
        "Inference market is less consolidated than training — Core42 can win meaningful share",
        "Recurring inference revenue is more predictable than burst training revenue",
        "Sovereign inference (government AI assistants, national LLMs) is an uncontested segment",
      ],
      rsk: [
        "Hardware transition costs are significant — AMD + NVIDIA dual-stack increases capex",
        "Inference market develops slower than ABI Research projects",
        "Hyperscalers bundle inference with existing enterprise relationships",
      ],
    },
    warning: {
      name: "Identity Dilution", tag: "the strategic warning case",
      set: { ai: 25, pricing: 45, share: 7, growth: 20, costInfl: 18, daGrowth: 55, gcc: 60 },
      rec: "Core42 pursues commercial expansion without resolving the sovereign identity question. The $550M is deployed into US/Europe enterprise workloads. Government clients begin to question whether Core42 is still sovereign. Commercial clients see Core42 as a smaller, more expensive AWS. Neither market is won decisively. This is the most likely failure mode — not a collapse, but a permanent positioning trap.",
      conf: "Moderate",
      assum: [
        "Commercial expansion proceeds without a clear sovereign identity boundary",
        "Government clients begin to perceive Core42 as commercially motivated",
        "Commercial clients compare Core42 unfavourably to hyperscalers on price and scale",
      ],
      risks: [
        "Sovereign trust erosion: the most valuable asset cannot be rebuilt once lost",
        "Commercial revenue insufficient to offset sovereign revenue at risk",
        "Permanent positioning trap: too commercial for governments, too sovereign for enterprises",
      ],
      acts: [
        "Define and publish the sovereign identity boundary before the $550M is fully deployed",
        "Conduct a sovereign client survey to measure trust levels before and after commercial expansion",
        "Establish a sovereign advisory board with government clients to maintain accountability",
      ],
      opp: [
        "Identity dilution forces a strategic choice that should have been made earlier",
        "Crisis creates the political will for a decisive repositioning",
        "Competitor consolidation may create acquisition opportunities",
      ],
      rsk: [
        "Sovereign trust, once lost, cannot be rebuilt — it is a one-way door",
        "Positioning trap is self-reinforcing: unclear identity attracts neither segment decisively",
        "Interim CEO transition amplifies the risk of strategic drift",
      ],
    },
  },
  growthPaths: [
    {
      t: "Sovereign AI Standard Ownership",
      d: "Define and own the global sovereign AI certification standard. Every government AI programme that requires data residency and non-hyperscaler infrastructure must meet the Core42 standard. This is the path where the moat is permanent — no hyperscaler can buy their way into sovereign trust.",
      live: s => s.pricing <= 45 && s.gcc <= 40,
    },
    {
      t: "Inference Infrastructure Leadership",
      d: "Rebalance from training-heavy to inference-optimised infrastructure as ABI Research's 80% inference projection materialises. Inference has recurring revenue characteristics, lower GPU density requirements, and is less dominated by hyperscalers. Core42's sovereign inference segment (national LLMs, government AI assistants) is uncontested.",
      live: s => s.ai >= 60 && s.daGrowth >= 75,
    },
    {
      t: "Regulated Enterprise Neocloud",
      d: "Use sovereign credentials as the commercial differentiator for regulated enterprise (BFSI, healthcare, defence). These customers need data residency and compliance that hyperscalers structurally cannot provide. Core42 is the only neocloud with both sovereign credentials and hyperscale infrastructure — a combination no competitor can replicate quickly.",
      live: s => s.pricing >= 45 && s.pricing <= 75 && s.gcc >= 35,
    },
    {
      t: "GCC National AI Programme Anchor",
      d: "Become the infrastructure anchor for GCC national AI programmes — UAE, Saudi Arabia, Qatar, Kuwait. These are multi-billion dollar, multi-year programmes where sovereign identity is the primary selection criterion. Core42's Abu Dhabi base and G42 relationships make it the natural choice. Oracle and AWS cannot credibly compete for the sovereign mandate.",
      live: s => s.gcc <= 35 && s.pricing <= 40,
    },
  ],
  failPaths: [
    {
      t: "Sovereign Identity Dilution",
      d: "Commercial expansion proceeds without a clear sovereign identity boundary. Government clients begin to question whether Core42 is still sovereign. Commercial clients see Core42 as a smaller, more expensive AWS. Neither market is won decisively. Sovereign trust, once lost, cannot be rebuilt — it is a one-way door.",
      live: s => s.pricing >= 55 && s.gcc >= 55,
    },
    {
      t: "Hyperscaler Price Competition",
      d: "AWS, Azure, and Google respond to Core42's US/Europe expansion with targeted pricing discounts for the same enterprise segments. Core42's $550M is insufficient to sustain a price war with competitors who have 10x the capital. Commercial revenue fails to materialise at the scale required to justify the expansion.",
      live: s => s.pricing >= 65 && s.costInfl >= 15,
    },
    {
      t: "Interim Leadership Strategic Drift",
      d: "The $550M capital deployment proceeds under an interim CEO mandate without a permanent strategic direction. The permanent CEO appointment resets priorities mid-deployment. Capital is committed to infrastructure that does not align with the new strategic direction. The transition cost is measured in both capital and time.",
      live: s => s.growth >= 50 && s.share <= 8,
    },
    {
      t: "Microsoft Partnership Constraint",
      d: "The G42/Microsoft $1.5B partnership (April 2024) constrains Core42's commercial independence in the US market. Core42 cannot compete directly against Azure for enterprise workloads without damaging its most important strategic partnership. The constraint is structural — it cannot be resolved without renegotiating the partnership terms.",
      live: s => s.gcc >= 60 && s.pricing >= 60,
    },
  ],
  historicalPrecedents: [
    {
      name: "Oracle Cloud Infrastructure (OCI)",
      outcome: "Oracle entered the cloud market 10 years after AWS. Rather than competing on breadth, Oracle focused on regulated enterprise and government workloads where AWS had structural disadvantages. OCI won the US DoD JEDI-equivalent contract and multiple EU government contracts. Revenue grew from $1B to $8B+ in 5 years.",
      relevance: "The most direct precedent for Core42's hybrid neocloud path. Oracle succeeded by finding the segments where hyperscalers had structural disadvantages — not by competing on hyperscaler terms. Core42's sovereign positioning is the equivalent of Oracle's regulated enterprise focus.",
    },
    {
      name: "CoreWeave (US Neocloud)",
      outcome: "CoreWeave raised $1.1B in 2023 and $7.5B in 2024 to build GPU-optimised cloud infrastructure. Focused on AI training workloads for enterprise customers. Achieved $1.9B revenue in 2024. IPO in March 2025 at $19B valuation. Competes directly with AWS and Azure for GPU workloads.",
      relevance: "The cautionary tale for Core42's commercial expansion path. CoreWeave has 3x Core42's capital, a 3-year head start in US enterprise GPU market, and a public market valuation anchor. Core42 entering the same market with $550M faces a structural disadvantage against a competitor that has already proven the model.",
    },
    {
      name: "Palantir Technologies",
      outcome: "Palantir built its business on government contracts (CIA, NSA, US Army) before expanding to commercial enterprise. The government work created a data and trust moat that commercial competitors could not replicate. Commercial revenue grew from 20% to 55% of total revenue between 2020 and 2025 without abandoning government identity.",
      relevance: "The sovereign-to-commercial expansion model that preserves identity. Palantir succeeded because it expanded into commercial enterprise with the same sovereign-grade security and compliance posture — not by abandoning it. Core42's hybrid neocloud path follows the same logic.",
    },
    {
      name: "Equinix (Data Centre / Interconnection)",
      outcome: "Equinix built a $80B+ market cap by owning the physical interconnection layer between hyperscalers, enterprises, and networks. It does not compete with AWS — it is the infrastructure that AWS depends on. Revenue grew from $1B to $8B+ through a neutral interconnection model.",
      relevance: "The neutral infrastructure model. Core42 could pursue a version of the Equinix model in sovereign AI — owning the physical infrastructure layer that governments and regulated enterprises use to connect to hyperscalers, without competing against them. This is the path where Core42 is complementary to AWS, not competitive.",
    },
  ],
  outcomeLedgerEntry: {
    ref: "OL-005",
    decision: "Core42: Does the company preserve its sovereign AI identity while expanding commercially, or does commercial expansion dilute the one asset that hyperscalers cannot replicate?",
    hiddenVariable: "Sovereign Identity Boundary — Core42's $550M capital deployment and Buffalo expansion are already commercial plays, not sovereign plays. The hidden variable is whether leadership has made the sovereign-to-commercial transition consciously and with a defined identity boundary, or whether they are drifting into it under an interim CEO mandate. The decision is not about geography or scale — it is about whether Core42 knows what it is.",
    recommendation: "Define the sovereign identity boundary before the $550M is fully deployed. The hybrid neocloud path (sovereign credentials as commercial differentiator for regulated enterprise) is the most commercially attractive and the most defensible. But it requires a clear answer to the unanswered question: if Core42 succeeds in becoming a Tier-1 global cloud provider, does it cease to be sovereign?",
    confidence: 68,
    reviewDates: ["December 2026", "June 2027", "December 2027"],
  },
};

// ─── Template Registry ────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, CompanyTemplate> = {
  keo: KEO_TEMPLATE,
  warba: WARBA_TEMPLATE,
  apex: APEX_TEMPLATE,
  zain: ZAIN_TEMPLATE,
  alghanim: ALGHANIM_TEMPLATE,
  core42: CORE42_TEMPLATE,
};

export function getTemplate(id: string): CompanyTemplate {
  return TEMPLATES[id] || KEO_TEMPLATE;
}

export const DEFAULT_TEMPLATE_ID = "keo";
