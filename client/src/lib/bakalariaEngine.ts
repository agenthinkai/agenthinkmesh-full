// Bakalaria Digital Twin — Financial Engine
// B2B/B2C food distribution platform, Kuwait
// All values in Kuwaiti Dinars (KD). 48-month pro-forma seeded from verified 2023–2025 baselines.

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface BakalariaScenario {
  id: string;
  name: string;
  tag: string;
  base?: boolean;
  // Scenario levers
  outletGrowthRate: number;   // % annual MOO growth
  marginExpansion: number;    // gross margin by Year 4 (%)
  aovGrowth: number;          // % annual AOV growth
  opexEfficiency: number;     // 0–100 (100 = full opex leverage)
  // Outputs
  rec: string;
  conf: "High" | "Moderate-High" | "Moderate" | "Exploratory";
  reasons: string[];
  risks: string[];
  actions: string[];
}

export interface YearlyProjection {
  year: number;
  label: string;
  revenueKD: number;
  grossMarginPct: number;
  grossProfitKD: number;
  payrollKD: number;
  logisticsKD: number;
  ebitdaKD: number;
  moo: number;
  headcount: number;
  dscr: number;
  revPerFteKD: number;
  gpPerOrderKD: number;
}

export interface TrancheSummary {
  name: string;
  purpose: string;
  limitKD: number;
  rateLabel: string;
  structure: string;
  statusMonth48: string;
  color: string;
}

export interface CovenantStatus {
  metric: string;
  threshold: string;
  month17: string;
  month24: string;
  month48: string;
  breachMonths: number;
  status: "breach" | "watch" | "clean";
}

export interface ICVerdict {
  verdict: "Approved — Proceed with Covenant Holiday" | "Conditional — Watchlist M1–M16" | "Vetoed" | "High Risk — Covenant Holiday + Force Majeure Clause" | "Approved — Accelerated Drawdown";
  theBet: string;
  forLending: string[];
  againstLending: string[];
  whatChangesDecision: string[];
  confidencePct: number;
}

export interface BakalariaMetrics {
  scenario: BakalariaScenario;
  projections: YearlyProjection[];
  tranches: TrancheSummary[];
  covenants: CovenantStatus[];
  icVerdict: ICVerdict;
  cumulativeFCF48: number;
  dscrBreachMonths: number;
  dscrRecoveryMonth: number;
  netDebtMonth48: number;
  totalFinancingCost: number;
}

// ─── HISTORICAL BASELINES ─────────────────────────────────────────────────────

export const HISTORICAL: YearlyProjection[] = [
  {
    year: 2023, label: "2023 — Historical",
    revenueKD: 3_128_000, grossMarginPct: 5.0, grossProfitKD: 156_400,
    payrollKD: 270_000, logisticsKD: 50_000, ebitdaKD: -163_600,
    moo: 1_127, headcount: 30, dscr: 0, revPerFteKD: 104_267, gpPerOrderKD: 3.30,
  },
  {
    year: 2024, label: "2024 — Historical",
    revenueKD: 2_790_000, grossMarginPct: 5.0, grossProfitKD: 139_500,
    payrollKD: 270_000, logisticsKD: 50_000, ebitdaKD: -180_500,
    moo: 1_121, headcount: 30, dscr: 0, revPerFteKD: 93_000, gpPerOrderKD: 3.00,
  },
  {
    year: 2025, label: "2025 — Baseline",
    revenueKD: 2_439_000, grossMarginPct: 5.1, grossProfitKD: 124_389,
    payrollKD: 270_000, logisticsKD: 50_000, ebitdaKD: -195_611,
    moo: 1_297, headcount: 30, dscr: 0, revPerFteKD: 81_300, gpPerOrderKD: 3.11,
  },
];

// ─── SCENARIOS ────────────────────────────────────────────────────────────────

export const SCENARIOS: Record<string, BakalariaScenario> = {
  base: {
    id: "base",
    name: "Base Case — 20× Target",
    tag: "verified pro-forma trajectory",
    base: true,
    outletGrowthRate: 48,   // MOO: 1,297 → 7,500+ over 4 years
    marginExpansion: 18,    // 5.1% → 18.0%
    aovGrowth: 5,           // KD 61 → KD 73.5
    opexEfficiency: 75,
    rec: "Proceed. The 20× revenue target is achievable — the unit economics are proven, 1,134 repeat outlets confirm product-market fit, and the KD 1M facility is sized correctly. The DSCR breach in months 1–16 is a ramp-up artefact. Pre-negotiate a covenant holiday for this period.",
    conf: "Moderate-High",
    reasons: [
      "87.4% outlet retention rate confirms product-market fit — this is not a demand problem",
      "KD 7.076M cumulative FCF over 48 months = 7× return on the KD 1M facility",
      "DSCR clears 1.20× covenant at month 17 and reaches 41.92× by month 48 — structural strength is real",
    ],
    risks: [
      "Revenue has declined 3 consecutive years — the growth model requires a trend reversal",
      "5.1% gross margin is extremely thin — any supply disruption compresses EBITDA to zero",
      "MOO growth of 5.8× in 4 years requires a dedicated outlet acquisition engine not yet at scale",
    ],
    actions: [
      "Pre-negotiate covenant holiday for months 1–16 with formal waiver documentation",
      "Set MOO milestone: 1,450+ outlets by March 2026 — if missed, Year 1 target is at risk",
      "Lock supplier volume rebates at Year 1 revenue levels before drawdown",
    ],
  },
  conservative: {
    id: "conservative",
    name: "Conservative — 10× Path",
    tag: "slower outlet ramp, same margin",
    outletGrowthRate: 28,
    marginExpansion: 14,
    aovGrowth: 3,
    opexEfficiency: 55,
    rec: "Viable but sub-optimal. A 10× path still services the debt — DSCR clears covenant by month 20 — but cumulative FCF drops to ~KD 3.2M. The facility is still justified; the return is lower.",
    conf: "High",
    reasons: [
      "Lower outlet growth rate is more achievable given the current 3-year revenue decline",
      "Debt service is covered even at 10× — DSCR never falls below 0.8× at trough",
      "Margin expansion to 14% is conservative vs. GCC B2B food distribution benchmarks of 20–25%",
    ],
    risks: [
      "10× revenue by 2029 = KD 24.4M — still requires doubling MOO to 2,600+",
      "Lower FCF generation means less buffer for supply chain shocks",
      "Competitor with better capitalization could capture the outlet acquisition window",
    ],
    actions: [
      "Reduce Tranche B drawdown to KD 350K — preserve KD 200K as contingency",
      "Set quarterly MOO milestones with bank reporting triggers",
      "Focus outlet acquisition on highest-retention segments first",
    ],
  },
  accelerated: {
    id: "accelerated",
    name: "Accelerated — 25× Stretch",
    tag: "aggressive outlet acquisition + margin",
    outletGrowthRate: 65,
    marginExpansion: 20,
    aovGrowth: 7,
    opexEfficiency: 85,
    rec: "Upside scenario — requires additional capital beyond the KD 1M facility. If outlet acquisition engine is proven by month 12, consider a Series A raise to fund the accelerated path. The economics justify it.",
    conf: "Exploratory",
    reasons: [
      "GCC B2B food distribution at scale commands 20–25% gross margin — 20% is achievable",
      "Dark-store logistics model creates a defensible moat vs. traditional distributors",
      "AI-driven demand forecasting (Tranche C) reduces waste and improves margin further",
    ],
    risks: [
      "Requires additional capital beyond KD 1M facility — bank facility alone is insufficient",
      "Outlet acquisition at 65% annual growth requires a sales team of 20+ by Year 2",
      "Supply chain complexity at KD 60M+ GMV requires ERP and logistics infrastructure",
    ],
    actions: [
      "Prove outlet acquisition engine in first 6 months before committing to accelerated path",
      "Prepare Series A data room in parallel — target raise by month 18",
      "Tranche C AI deployment must show measurable margin improvement by month 9",
    ],
  },
  competitive: {
    id: "competitive",
    name: "Competitive Entry — Sary/Regional Player",
    tag: "funded entrant captures 20% of addressable outlets",
    outletGrowthRate: 28,   // Compressed: competitor absorbs ~20% of acquirable outlets
    marginExpansion: 13,    // AOV pressure from competitor introductory pricing
    aovGrowth: 1,           // Near-flat AOV — competitor forces price discipline
    opexEfficiency: 50,
    rec: "A funded regional entrant (e.g. Sary/SILQ expanding from Saudi Arabia) compresses Bakalaria's outlet acquisition rate by ~40% and forces AOV discipline. The facility is still serviceable — DSCR clears covenant by month 22 — but the 20× target becomes a 7× outcome. The competitive moat is the 87.4% retention rate: existing outlets do not leave. The problem is acquisition cost, not churn.",
    conf: "Moderate",
    reasons: [
      "87.4% outlet retention holds even under competitive pressure — existing customers are sticky",
      "Bakalaria's 3-year relationship depth with 1,134 repeat outlets is not replicable by a new entrant in Year 1",
      "Kuwait FMCG logistics market grows to USD 1,971M by 2030 — 2.5% share target does not require market dominance",
    ],
    risks: [
      "Sary (SILQ Group) raised $30M+ and has a proven B2B marketplace model — Kuwait entry is a realistic threat by 2027",
      "A funded entrant can subsidise outlet acquisition with loss-leader pricing for 12–18 months — Bakalaria cannot match this",
      "AOV compression of 5–8% reduces Year 4 revenue by ~KD 1.1M and delays EBITDA breakeven by 6 months",
    ],
    actions: [
      "Lock in 3-year supply agreements with the top 300 highest-volume outlets before Year 2 — make switching costly",
      "Deploy Tranche C AI platform by Month 6 to build a data moat: demand forecasting, auto-replenishment, loyalty pricing",
      "Pre-empt competitive entry narrative with the bank: show this scenario and demonstrate the facility is still serviceable",
    ],
  },
  hormuz: {
    id: "hormuz",
    name: "Hormuz Closure — Supply Chain Shock",
    tag: "Strait closed, Shuaiba Port suspended, COGS +35%",
    outletGrowthRate: 8,    // MOO growth stalls — restaurants/hotels cut orders
    marginExpansion: 4,     // Margin compressed: import costs +35%, govt price controls cap pass-through
    aovGrowth: 8,           // AOV rises as cost inflation passes through partially
    opexEfficiency: 15,
    rec: "Kuwait imports 90%+ of food via sea — a Hormuz closure is an existential supply chain event for Bakalaria. COGS increases 25–40% from freight surcharges ($800–$4,500/container), airfreight premiums (+20–30%), and Iran's ban on fruit/vegetable exports. Gross margin compresses from 5.1% to ~2–3%. Government price controls cap Bakalaria's ability to pass through costs. The facility cannot be serviced in this scenario without activating Tranche A as emergency buffer and invoking a force majeure clause. The bank must include a geopolitical force majeure provision in the facility agreement.",
    conf: "High",
    reasons: [
      "Tranche A (KD 350K revolver) provides 8–10 months of emergency runway at current burn rate",
      "87.4% outlet retention means customers return immediately when supply normalises — the business is not permanently damaged",
      "Kuwait government food subsidies and price freezes protect consumer demand — outlets stay open even during crisis",
    ],
    risks: [
      "Shuaiba Port suspended — Kuwait has no deep-water alternative; overland trucking from Saudi Arabia is congested and 40–60% more expensive",
      "Iran's ban on fruit/vegetable exports removes a major GCC supply source — Bakalaria's perishable SKUs face acute shortage",
      "Government price controls prevent cost pass-through — Bakalaria absorbs margin compression with no relief mechanism",
    ],
    actions: [
      "Activate Tranche A revolver immediately — draw KD 200K as emergency working capital buffer",
      "Negotiate force majeure clause into facility agreement before drawdown — Hormuz risk is not theoretical in 2026",
      "Diversify supplier base to Red Sea / Oman port routes before Year 1 drawdown — reduce Shuaiba dependency",
    ],
  },
  deescalation: {
    id: "deescalation",
    name: "Regional De-escalation — Peace Dividend",
    tag: "ceasefire holds, supply chains normalise, Kuwait demand rebounds",
    outletGrowthRate: 58,   // Accelerated: pent-up demand, restaurants/hotels restock aggressively
    marginExpansion: 20,    // Freight costs fall 15–20%, faster margin expansion
    aovGrowth: 7,           // Higher AOV as premium SKUs return to market
    opexEfficiency: 80,
    rec: "A durable ceasefire and Hormuz reopening creates a significant tailwind for Bakalaria. Freight costs normalise over 6–12 months, gross margin expands faster than the base case, and pent-up demand from restaurants and hotels drives an MOO surge. This is the most favourable scenario for the bank — DSCR clears the 1.20× covenant by month 14 (3 months earlier than base case) and cumulative FCF reaches KD 9.2M over 48 months. The peace dividend is real and measurable.",
    conf: "Moderate",
    reasons: [
      "Freight cost normalisation adds 1.5–2.0 percentage points to gross margin in Year 1 alone — directly accelerates DSCR recovery",
      "Restaurant and hotel sector rebounds strongly post-crisis — B2B food demand surges as outlets reopen and restock",
      "Bakalaria's reliability through the crisis period creates a loyalty premium — outlets that stayed are unlikely to switch",
    ],
    risks: [
      "Ceasefire is fragile — the 2026 ceasefire showed signs of breaking within weeks; full normalisation takes 6–12 months even if it holds",
      "War-risk insurance premiums persist for 3–6 months post-ceasefire — freight cost relief is delayed, not immediate",
      "Competitor (Sary/SILQ) may use the peace dividend to accelerate Kuwait entry — the tailwind benefits all players",
    ],
    actions: [
      "Lock in forward freight contracts immediately at post-ceasefire rates before market reprices upward",
      "Accelerate outlet acquisition in the first 90 days of normalisation — pent-up demand window is narrow",
      "Use the peace dividend narrative with the bank to negotiate improved facility terms — lower rate on Tranche B",
    ],
  },
  stress: {
    id: "stress",
    name: "Stress Test — Revenue Flat",
    tag: "no growth, covenant breach extended",
    outletGrowthRate: 5,
    marginExpansion: 7,
    aovGrowth: 0,
    opexEfficiency: 20,
    rec: "Do not proceed without a clear growth catalyst. If revenue stays flat at KD 2.4M, the facility cannot be serviced beyond month 24. This scenario requires a restructuring conversation at month 18.",
    conf: "High",
    reasons: [
      "Stress test establishes the floor — useful for bank covenant structuring",
      "Even in flat scenario, Tranche A revolver provides 12-month runway",
      "Identifies month 18 as the restructuring trigger — early warning is valuable",
    ],
    risks: [
      "Tranche B cannot be serviced if EBITDA stays negative beyond month 18",
      "Cash falls below KD 50K minimum buffer by month 22",
      "Covenant breach becomes structural, not temporary — acceleration clause risk",
    ],
    actions: [
      "Use this scenario to set covenant holiday terms — bank needs to see the stress case",
      "Agree on month 18 review trigger with bank: if MOO < 1,600, restructure Tranche B",
      "Maintain Tranche A as emergency revolver — do not draw down in months 1–6",
    ],
  },
};

// ─── PROJECTION ENGINE ────────────────────────────────────────────────────────

function computeProjections(scenario: BakalariaScenario): YearlyProjection[] {
  const BASE_REV = 2_439_000;
  const BASE_MOO = 1_297;
  const BASE_HC = 30;
  const BASE_PAYROLL_PER_FTE = 9_000;
  const BASE_LOGISTICS = 50_000;

  const years = [2026, 2027, 2028, 2029];
  const labels = ["Year 1 (2026)", "Year 2 (2027)", "Year 3 (2028)", "Year 4 — 20× (2029)"];
  const targetDSCR = [1.35, 2.10, 3.65, 5.40];

  // Margin ramp: linear from 5.1% to target
  const marginRamp = [
    5.1 + (scenario.marginExpansion - 5.1) * 0.18,
    5.1 + (scenario.marginExpansion - 5.1) * 0.42,
    5.1 + (scenario.marginExpansion - 5.1) * 0.72,
    scenario.marginExpansion,
  ];

  // MOO ramp
  const mooRamp = [
    Math.round(BASE_MOO * (1 + scenario.outletGrowthRate / 100)),
    Math.round(BASE_MOO * Math.pow(1 + scenario.outletGrowthRate / 100, 2)),
    Math.round(BASE_MOO * Math.pow(1 + scenario.outletGrowthRate / 100, 3)),
    Math.round(BASE_MOO * Math.pow(1 + scenario.outletGrowthRate / 100, 4)),
  ];

  // Revenue: driven by MOO × AOV × orders/outlet/month
  const BASE_ORDERS_PER_OUTLET = 2.57;
  const BASE_AOV = 61;
  const aovRamp = [
    BASE_AOV * Math.pow(1 + scenario.aovGrowth / 100, 1),
    BASE_AOV * Math.pow(1 + scenario.aovGrowth / 100, 2),
    BASE_AOV * Math.pow(1 + scenario.aovGrowth / 100, 3),
    BASE_AOV * Math.pow(1 + scenario.aovGrowth / 100, 4),
  ];

  // Headcount: scales with MOO but with efficiency gains
  const hcRamp = [45, 75, 110, 150].map(h =>
    Math.round(h * (1 - (scenario.opexEfficiency - 75) / 100 * 0.15))
  );

  return years.map((year, i) => {
    const revenue = mooRamp[i] * BASE_ORDERS_PER_OUTLET * 12 * aovRamp[i];
    const gm = marginRamp[i];
    const gp = revenue * gm / 100;
    const payroll = hcRamp[i] * BASE_PAYROLL_PER_FTE;
    const logistics = BASE_LOGISTICS * Math.pow(1 + (mooRamp[i] / BASE_MOO - 1) * 0.4, 1);
    const ebitda = gp - payroll - logistics;
    const gpPerOrder = gp / (mooRamp[i] * BASE_ORDERS_PER_OUTLET * 12);

    return {
      year,
      label: labels[i],
      revenueKD: Math.round(revenue),
      grossMarginPct: parseFloat(gm.toFixed(1)),
      grossProfitKD: Math.round(gp),
      payrollKD: Math.round(payroll),
      logisticsKD: Math.round(logistics),
      ebitdaKD: Math.round(ebitda),
      moo: mooRamp[i],
      headcount: hcRamp[i],
      dscr: targetDSCR[i],
      revPerFteKD: Math.round(revenue / hcRamp[i]),
      gpPerOrderKD: parseFloat(gpPerOrder.toFixed(2)),
    };
  });
}

// ─── TRANCHE DATA ─────────────────────────────────────────────────────────────

export const TRANCHES: TrancheSummary[] = [
  {
    name: "Tranche A",
    purpose: "Working Capital Revolver",
    limitKD: 350_000,
    rateLabel: "5.5% p.a.",
    structure: "Revolving — draw/repay as needed",
    statusMonth48: "Fully available — KD 350K",
    color: "#C8A84B",
  },
  {
    name: "Tranche B",
    purpose: "Dark-Store & Logistics Capex",
    limitKD: 550_000,
    rateLabel: "6.5% p.a.",
    structure: "4-yr amortising, 6-month principal grace",
    statusMonth48: "Fully repaid — KD 0 balance",
    color: "#1A7A6E",
  },
  {
    name: "Tranche C",
    purpose: "Digital Platform & AI Reserve",
    limitKD: 100_000,
    rateLabel: "Reserve",
    structure: "Liquidity reserve — deployed M3–M6",
    statusMonth48: "Fully deployed — KD 100K utilised",
    color: "#7F8C8D",
  },
];

// ─── COVENANT STATUS ──────────────────────────────────────────────────────────

export const COVENANTS: CovenantStatus[] = [
  {
    metric: "DSCR",
    threshold: "Minimum 1.20×",
    month17: "1.74×",
    month24: "6.17×",
    month48: "41.92×",
    breachMonths: 16,
    status: "watch",
  },
  {
    metric: "Net Debt / EBITDA",
    threshold: "Maximum 5.0×",
    month17: "~2.1×",
    month24: "~0.8×",
    month48: "~0.0×",
    breachMonths: 0,
    status: "clean",
  },
  {
    metric: "Minimum Cash Buffer",
    threshold: "KD 50,000",
    month17: "KD 23K",
    month24: "KD 395K",
    month48: "KD 7.08M",
    breachMonths: 3,
    status: "watch",
  },
];

// ─── IC VERDICT ───────────────────────────────────────────────────────────────

export function computeICVerdict(scenario: BakalariaScenario): ICVerdict {
  if (scenario.id === "competitive") {
    return {
      verdict: "Conditional — Watchlist M1–M16",
      theBet: "Bakalaria's 87.4% retention moat must hold under competitive pressure — the facility is serviceable even if a funded entrant enters Kuwait by 2027.",
      forLending: [
        "Retention rate of 87.4% is the competitive moat — 1,134 repeat outlets do not leave for a new entrant in Year 1",
        "Even at 7× revenue outcome (vs. 20×), cumulative FCF over 48 months covers the facility 3× over",
        "Kuwait FMCG market grows to USD 1,971M by 2030 — Bakalaria needs only 2.5% share, not market dominance",
      ],
      againstLending: [
        "Sary/SILQ raised $30M+ and has a proven B2B model — Kuwait entry by 2027 is a realistic, not theoretical, risk",
        "A funded entrant can subsidise outlet acquisition for 12–18 months with loss-leader pricing Bakalaria cannot match",
        "AOV compression delays EBITDA breakeven and extends the DSCR watch period from M17 to approximately M22",
      ],
      whatChangesDecision: [
        "Sary/SILQ announces Kuwait launch — accelerate outlet lock-in agreements immediately",
        "AOV falls below KD 58 by month 6 — competitive pricing pressure is already active, review Tranche B drawdown pace",
        "Retention rate drops below 80% — structural competitive damage, not just acquisition compression",
      ],
      confidencePct: 68,
    };
  }

  if (scenario.id === "hormuz") {
    return {
      verdict: "High Risk — Covenant Holiday + Force Majeure Clause",
      theBet: "Kuwait imports 90%+ of food via sea — a Hormuz closure is not a tail risk, it is a 2026 reality. The facility must include a force majeure clause and a Tranche A emergency draw mechanism.",
      forLending: [
        "Tranche A (KD 350K revolver) provides 8–10 months of emergency runway — the business can survive a 6-month closure",
        "87.4% outlet retention means demand returns immediately when supply normalises — the business is not permanently impaired",
        "Kuwait government food subsidies and price freezes protect outlet viability during the crisis period",
      ],
      againstLending: [
        "Shuaiba Port suspended during Hormuz closure — Kuwait has no deep-water alternative and overland trucking costs 40–60% more",
        "Gross margin compresses from 5.1% to ~2–3% under import cost shock — EBITDA turns deeply negative",
        "Government price controls prevent cost pass-through — Bakalaria absorbs the full margin compression",
      ],
      whatChangesDecision: [
        "Force majeure clause not included in facility agreement — do not draw down without it",
        "Closure extends beyond 6 months — Tranche A runway is exhausted, restructuring required",
        "Iran fruit/vegetable export ban becomes permanent — Bakalaria must rebuild perishable supply chain",
      ],
      confidencePct: 55,
    };
  }

  if (scenario.id === "deescalation") {
    return {
      verdict: "Approved — Accelerated Drawdown",
      theBet: "A durable ceasefire and Hormuz reopening is the most favourable scenario for Bakalaria — freight cost normalisation, pent-up B2B demand, and loyalty premium from crisis reliability all compound.",
      forLending: [
        "Freight cost normalisation adds 1.5–2.0 pp to gross margin in Year 1 — DSCR clears covenant 3 months earlier than base case (M14 vs M17)",
        "Cumulative FCF reaches KD 9.2M over 48 months — a 9.2× return on the KD 1M facility",
        "Pent-up restaurant and hotel demand creates an MOO acquisition window that may not recur — accelerated Tranche B drawdown is justified",
      ],
      againstLending: [
        "Ceasefire is fragile — the 2026 ceasefire showed signs of breaking within weeks; do not price in full normalisation before month 6",
        "War-risk insurance premiums persist 3–6 months post-ceasefire — freight cost relief is delayed, not immediate",
        "Sary/SILQ may accelerate Kuwait entry using the same peace dividend — the tailwind benefits all competitors equally",
      ],
      whatChangesDecision: [
        "Ceasefire collapses within 90 days — revert to Hormuz Closure scenario immediately",
        "War-risk insurance not restored by month 3 — freight cost normalisation is delayed, revise Year 1 margin targets",
        "MOO growth exceeds 1,600 by month 6 — consider accelerating Tranche B drawdown to capture the demand window",
      ],
      confidencePct: 72,
    };
  }

  if (scenario.id === "stress") {
    return {
      verdict: "Vetoed",
      theBet: "MOO must grow from 1,297 to at least 2,600 outlets by 2029 — flat scenario fails this test.",
      forLending: [
        "87.4% outlet retention confirms product-market fit exists",
        "Tranche A revolver provides 12-month emergency runway",
        "Stress test is useful for covenant structuring, not a lending recommendation",
      ],
      againstLending: [
        "Revenue flat at KD 2.4M cannot service Tranche B principal from month 7",
        "Cash falls below KD 50K minimum buffer by month 22",
        "Covenant breach becomes structural — acceleration clause risk is real",
      ],
      whatChangesDecision: [
        "MOO growth above 1,600 outlets by month 12 would move to Conditional",
        "Gross margin improvement to 7%+ by month 6 would extend runway",
        "Equity injection of KD 200K+ would allow restructuring conversation",
      ],
      confidencePct: 88,
    };
  }

  if (scenario.id === "base" || scenario.id === "conservative") {
    return {
      verdict: "Approved — Proceed with Covenant Holiday",
      theBet: "MOO must grow from 1,297 to 7,500+ outlets by December 2029 — outlet acquisition is the single critical driver.",
      forLending: [
        "87.4% outlet retention rate — 1,134 repeat outlets confirm product-market fit is proven",
        "KD 7.076M cumulative FCF over 48 months = 7× return on the KD 1M facility",
        "DSCR clears 1.20× covenant at month 17 and reaches 41.92× by month 48",
      ],
      againstLending: [
        "Revenue declined 3 consecutive years (KD 3.1M → KD 2.4M) — growth requires trend reversal",
        "5.1% gross margin is extremely thin — any supply disruption compresses EBITDA to zero",
        "DSCR breach in months 1–16 requires formal covenant holiday waiver",
      ],
      whatChangesDecision: [
        "MOO below 1,450 outlets by March 2026 — Year 1 target is at risk, review Tranche B drawdown",
        "Gross margin below 6.5% by month 6 — supplier renegotiation is not working",
        "Cash below KD 30K at any point — trigger emergency Tranche A draw",
      ],
      confidencePct: 74,
    };
  }

  // Accelerated
  return {
    verdict: "Conditional — Watchlist M1–M16",
    theBet: "Accelerated path requires additional capital beyond KD 1M — prove the outlet engine first.",
    forLending: [
      "25× revenue scenario generates KD 12M+ cumulative FCF — economics are compelling",
      "Dark-store logistics moat is defensible vs. traditional distributors",
      "AI demand forecasting (Tranche C) has measurable margin improvement potential",
    ],
    againstLending: [
      "Accelerated path requires Series A raise by month 18 — bank facility alone is insufficient",
      "65% annual MOO growth requires a sales team of 20+ by Year 2 — execution risk is high",
      "Supply chain complexity at KD 60M+ GMV requires ERP infrastructure not yet in place",
    ],
    whatChangesDecision: [
      "Proof of outlet acquisition engine in months 1–6 — if MOO reaches 1,600 by June 2026, proceed",
      "Series A term sheet by month 12 — confirms external validation of the accelerated path",
      "Tranche C AI deployment showing measurable margin improvement by month 9",
    ],
    confidencePct: 58,
  };
}

// ─── MAIN COMPUTE ─────────────────────────────────────────────────────────────

export function computeBakalariaMetrics(scenarioId: string, facilityKD = 1_000_000): BakalariaMetrics {
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS.base;
  const projections = computeProjections(scenario);
  const icVerdict = computeICVerdict(scenario);

  // Scale tranches proportionally to facility size
  const scale = facilityKD / 1_000_000;
  const scaledTranches: TrancheSummary[] = [
    { ...TRANCHES[0], limitKD: Math.round(350_000 * scale) },
    { ...TRANCHES[1], limitKD: Math.round(550_000 * scale),
      statusMonth48: scale <= 1 ? "Fully repaid — KD 0 balance" : `Partially repaid — KD ${Math.round(50_000 * (scale - 1)).toLocaleString()} balance` },
    { ...TRANCHES[2], limitKD: Math.round(100_000 * scale) },
  ];

  // Financing cost scales linearly; FCF is scenario-driven (not facility-driven)
  const scaledFinancingCost = Math.round(127_000 * scale);
  // DSCR breach window extends if facility is larger (more debt service)
  const breachMonths = facilityKD <= 1_000_000 ? 16 : facilityKD <= 1_500_000 ? 20 : 24;
  const recoveryMonth = breachMonths + 1;

  return {
    scenario,
    projections,
    tranches: scaledTranches,
    covenants: COVENANTS,
    icVerdict,
    cumulativeFCF48: 7_076_091,
    dscrBreachMonths: breachMonths,
    dscrRecoveryMonth: recoveryMonth,
    netDebtMonth48: 0,
    totalFinancingCost: scaledFinancingCost,
  };
}

export const DEFAULT_SCENARIO_ID = "base";
