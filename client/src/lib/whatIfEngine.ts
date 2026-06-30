// AgenThink Decision Twin — What-If Engine v2
// Every slider change recomputes ALL outputs in real time:
//   Revenue · EBITDA · EV · Strategic Pathways · Failure Pathways
//   Council Recommendation · Early Warning Indicators · Recommendation

import type { Company, ScenarioKey } from "./companyData";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface WhatIfAssumptions {
  aiAdoption: number;       // 0–100 %
  marketShare: number;      // -30 to +30 pp
  pricingPower: number;     // -20 to +20 %
  costInflation: number;    // 0–20 %
  revenueGrowth: number;    // -10 to +30 %
  geographicMix: number;    // 0–100 %
  digitalRevenue: number;   // 0–50 %
}

export const DEFAULT_ASSUMPTIONS: WhatIfAssumptions = {
  aiAdoption: 20,
  marketShare: 0,
  pricingPower: 0,
  costInflation: 5,
  revenueGrowth: 0,
  geographicMix: 30,
  digitalRevenue: 10,
};

export interface DynamicPathway {
  name: string;
  description: string;
  probability: number;
  type: "growth" | "risk";
  driver: keyof WhatIfAssumptions;
}

export interface DynamicEWI {
  name: string;
  status: "safe" | "watch" | "alert";
  description: string;
  frequency: string;
}

export interface DynamicCouncilMember {
  persona: string;
  role: string;
  verdict: "Support" | "Neutral" | "Oppose";
  keyConcern: string;
  confidence: number;
  assumptionReaction: string;
}

export interface WhatIfOutputs {
  // Financial
  revenue: number;
  revenueUnit: string;
  revenueDelta: number;
  ebitda: number;
  ebitdaMargin: number;
  ebitdaMarginDelta: number;
  enterpriseValue: number;
  evUnit: string;
  evDelta: number;
  evMultiple: number;
  // Scores
  aiLeverageScore: number;
  resilienceScore: number;
  growthMomentum: number;
  // Dynamic outputs — all updated by sliders
  growthPathways: DynamicPathway[];
  failurePathways: DynamicPathway[];
  earlyWarningIndicators: DynamicEWI[];
  councilMembers: DynamicCouncilMember[];
  councilSentiment: "Bullish" | "Neutral" | "Bearish";
  councilRationale: string;
  recommendation: string;
  recommendationConfidence: number;
  projectionData: { year: string; revenue: number; ebitda: number }[];
}

// ─── CORE ENGINE ──────────────────────────────────────────────────────────────

export function computeWhatIf(
  company: Company,
  scenario: ScenarioKey,
  assumptions: WhatIfAssumptions
): WhatIfOutputs {
  const base = company.baseMetrics;
  const scenarioData = company.scenarios[scenario];
  const baseRevenue = base.revenue;
  const baseMargin = base.ebitdaMargin;
  const baseEV = base.enterpriseValue;

  // ── Financial Computation ─────────────────────────────────────────────────
  const scenarioRevenue = scenarioData.engines.revenue.value as number;
  const revenueGrowthFactor = 1 + (assumptions.revenueGrowth / 100);
  const marketShareFactor   = 1 + (assumptions.marketShare / 100);
  const pricingFactor       = 1 + (assumptions.pricingPower / 100);
  const digitalBoost        = 1 + (assumptions.digitalRevenue / 200);
  const aiRevenueBoost      = 1 + (assumptions.aiAdoption / 500);

  const computedRevenue = Math.round(
    scenarioRevenue * revenueGrowthFactor * marketShareFactor * pricingFactor * digitalBoost * aiRevenueBoost
  );
  const revenueDelta = Math.round(((computedRevenue - baseRevenue) / baseRevenue) * 100);

  const scenarioMargin    = scenarioData.engines.margin.value as number;
  const costInflationHit  = -(assumptions.costInflation * 0.3);
  const aiMarginBoost     = assumptions.aiAdoption * 0.08;
  const digitalMarginBoost= assumptions.digitalRevenue * 0.12;
  const pricingMarginBoost= assumptions.pricingPower * 0.25;
  const computedMargin    = Math.min(60, Math.max(2,
    scenarioMargin + costInflationHit + aiMarginBoost + digitalMarginBoost + pricingMarginBoost
  ));
  const ebitdaMarginDelta = Math.round((computedMargin - baseMargin) * 10) / 10;
  const computedEbitda    = Math.round(computedRevenue * computedMargin / 100);

  const baseMultiple       = baseEV / (baseRevenue * baseMargin / 100);
  const growthQualityBoost = (assumptions.digitalRevenue / 50) * 2;
  const aiMultipleBoost    = (assumptions.aiAdoption / 100) * 1.5;
  const geoMultipleBoost   = (assumptions.geographicMix / 100) * 0.8;
  const adjustedMultiple   = Math.max(4, Math.min(25,
    baseMultiple + growthQualityBoost + aiMultipleBoost + geoMultipleBoost
  ));
  const computedEV  = Math.round(computedEbitda * adjustedMultiple);
  const evDelta     = Math.round(((computedEV - baseEV) / baseEV) * 100);

  // ── Scores ────────────────────────────────────────────────────────────────
  const aiLeverageScore = Math.min(100, Math.round(
    (assumptions.aiAdoption * 0.5) + (assumptions.digitalRevenue * 0.8) + (assumptions.pricingPower * 1.2 + 20)
  ));
  const resilienceScore = Math.min(100, Math.max(0, Math.round(
    50 + (assumptions.geographicMix * 0.4) - (assumptions.costInflation * 1.5) + (assumptions.marketShare * 0.5)
  )));
  const growthMomentum = Math.min(100, Math.max(0, Math.round(
    50 + (assumptions.revenueGrowth * 1.5) + (assumptions.marketShare * 1.2) + (assumptions.digitalRevenue * 0.6)
  )));

  // ── Dynamic Growth Pathways ───────────────────────────────────────────────
  const growthPathways: DynamicPathway[] = [];

  if (assumptions.aiAdoption >= 35) {
    growthPathways.push({
      name: "AI-Driven Efficiency Transformation",
      description: `At ${assumptions.aiAdoption}% AI adoption, ${company.name} captures ${(assumptions.aiAdoption * 0.08).toFixed(1)}pp of margin expansion through automated workflows and intelligent resource allocation. Competitors operating at lower adoption face a structural cost disadvantage.`,
      probability: Math.min(85, 35 + Math.round(assumptions.aiAdoption * 0.5)),
      type: "growth",
      driver: "aiAdoption",
    });
  }

  if (assumptions.digitalRevenue >= 15) {
    growthPathways.push({
      name: "Digital Revenue Model Expansion",
      description: `${assumptions.digitalRevenue}% digital revenue creates a recurring, higher-margin revenue stream. Digital channels carry ${(assumptions.digitalRevenue * 0.12).toFixed(1)}pp margin premium vs legacy revenue.`,
      probability: Math.min(78, 28 + Math.round(assumptions.digitalRevenue * 1.8)),
      type: "growth",
      driver: "digitalRevenue",
    });
  }

  if (assumptions.geographicMix >= 45) {
    growthPathways.push({
      name: "Geographic Diversification Premium",
      description: `${assumptions.geographicMix}% international/diversified revenue reduces single-market concentration risk and unlocks access to higher-growth markets with stronger pricing dynamics.`,
      probability: Math.min(72, 22 + Math.round(assumptions.geographicMix * 0.9)),
      type: "growth",
      driver: "geographicMix",
    });
  }

  if (assumptions.marketShare >= 5) {
    growthPathways.push({
      name: "Market Share Consolidation",
      description: `+${assumptions.marketShare}pp market share gain adds ${Math.round(assumptions.marketShare * 0.8)}% to revenue base. Likely driven by competitor weakness or superior product positioning.`,
      probability: Math.min(68, 18 + Math.round(assumptions.marketShare * 2.5)),
      type: "growth",
      driver: "marketShare",
    });
  }

  if (assumptions.pricingPower >= 5) {
    growthPathways.push({
      name: "Pricing Power Realization",
      description: `+${assumptions.pricingPower}% pricing improvement signals strong brand equity and low substitution risk. Directly expands EBITDA margin by ${(assumptions.pricingPower * 0.25).toFixed(1)}pp.`,
      probability: Math.min(70, 22 + Math.round(assumptions.pricingPower * 2.8)),
      type: "growth",
      driver: "pricingPower",
    });
  }

  if (assumptions.revenueGrowth >= 10) {
    growthPathways.push({
      name: "Above-Market Revenue Acceleration",
      description: `+${assumptions.revenueGrowth}% revenue growth significantly outpaces industry average, indicating successful new market entry or product expansion with strong demand signals.`,
      probability: Math.min(65, 18 + Math.round(assumptions.revenueGrowth * 2)),
      type: "growth",
      driver: "revenueGrowth",
    });
  }

  // Minimum 2 growth pathways
  while (growthPathways.length < 2) {
    if (growthPathways.length === 0) {
      growthPathways.push({
        name: "Operational Excellence Program",
        description: "Systematic cost reduction and process optimization delivers 2–4% annual efficiency gains without requiring revenue growth.",
        probability: 42,
        type: "growth",
        driver: "costInflation",
      });
    } else {
      growthPathways.push({
        name: "Customer Retention & Loyalty Deepening",
        description: "Deepening relationships with existing customers reduces churn and increases lifetime value, providing a stable revenue foundation for growth initiatives.",
        probability: 38,
        type: "growth",
        driver: "marketShare",
      });
    }
  }

  growthPathways.sort((a, b) => b.probability - a.probability);

  // ── Dynamic Failure Pathways ──────────────────────────────────────────────
  const failurePathways: DynamicPathway[] = [];

  if (assumptions.costInflation >= 8) {
    failurePathways.push({
      name: "Margin Compression Spiral",
      description: `${assumptions.costInflation}% cost inflation without equivalent pricing power erodes EBITDA margin by ${(assumptions.costInflation * 0.3).toFixed(1)}pp. At this rate, the company enters a value destruction cycle within 18 months.`,
      probability: Math.min(80, 18 + Math.round(assumptions.costInflation * 3.5)),
      type: "risk",
      driver: "costInflation",
    });
  }

  if (assumptions.marketShare <= -5) {
    failurePathways.push({
      name: "Competitive Displacement",
      description: `${assumptions.marketShare}pp market share loss signals structural competitive weakness. At this rate, ${Math.abs(assumptions.marketShare) * 0.8}% of revenue base is lost annually to competitors.`,
      probability: Math.min(75, 22 + Math.round(Math.abs(assumptions.marketShare) * 2.5)),
      type: "risk",
      driver: "marketShare",
    });
  }

  if (assumptions.aiAdoption <= 15) {
    failurePathways.push({
      name: "AI Disruption Exposure",
      description: `Only ${assumptions.aiAdoption}% AI adoption leaves ${company.name} exposed to AI-native competitors operating at 20–35% lower cost structures. The window for transformation is narrowing.`,
      probability: Math.min(68, 58 - assumptions.aiAdoption * 2),
      type: "risk",
      driver: "aiAdoption",
    });
  }

  if (assumptions.pricingPower <= -5) {
    failurePathways.push({
      name: "Commoditization Trap",
      description: `${assumptions.pricingPower}% pricing decline indicates commoditization pressure. Without differentiation, the company enters a race to the bottom on price, compressing margins structurally.`,
      probability: Math.min(70, 18 + Math.round(Math.abs(assumptions.pricingPower) * 3)),
      type: "risk",
      driver: "pricingPower",
    });
  }

  if (assumptions.revenueGrowth <= 0) {
    failurePathways.push({
      name: "Revenue Stagnation / Real Decline",
      description: `${assumptions.revenueGrowth}% revenue growth in an inflationary environment represents real revenue contraction. This compresses EV multiples and triggers investor concern about the growth thesis.`,
      probability: Math.min(62, 38 + Math.round(Math.abs(assumptions.revenueGrowth) * 2.5)),
      type: "risk",
      driver: "revenueGrowth",
    });
  }

  if (assumptions.geographicMix <= 20) {
    failurePathways.push({
      name: "Geographic Concentration Risk",
      description: `Only ${assumptions.geographicMix}% diversified revenue creates dangerous single-market dependency. A regional downturn or regulatory change could impact 80%+ of revenue simultaneously.`,
      probability: Math.min(58, 48 - assumptions.geographicMix * 0.8),
      type: "risk",
      driver: "geographicMix",
    });
  }

  // Minimum 2 failure pathways
  while (failurePathways.length < 2) {
    if (failurePathways.length === 0) {
      failurePathways.push({
        name: "Talent and Execution Risk",
        description: "Rapid transformation initiatives require specialized talent. Failure to attract and retain AI/digital talent creates execution gaps that delay value realization by 12–24 months.",
        probability: 38,
        type: "risk",
        driver: "aiAdoption",
      });
    } else {
      failurePathways.push({
        name: "Macroeconomic Headwinds",
        description: "Rising interest rates and tightening credit conditions increase the cost of capital, compressing EV multiples even when operational performance is stable.",
        probability: 42,
        type: "risk",
        driver: "costInflation",
      });
    }
  }

  failurePathways.sort((a, b) => b.probability - a.probability);

  // ── Dynamic Early Warning Indicators ─────────────────────────────────────
  const earlyWarningIndicators: DynamicEWI[] = [
    {
      name: "AI Adoption Rate",
      status: assumptions.aiAdoption >= 50 ? "safe" : assumptions.aiAdoption >= 25 ? "watch" : "alert",
      description: assumptions.aiAdoption >= 50
        ? `${assumptions.aiAdoption}% AI adoption — above industry threshold; efficiency gains materializing`
        : assumptions.aiAdoption >= 25
        ? `${assumptions.aiAdoption}% AI adoption — below optimal; competitors may be moving faster`
        : `${assumptions.aiAdoption}% AI adoption — critically low; AI-native competitors have structural cost advantage`,
      frequency: "Quarterly",
    },
    {
      name: "Market Share Trajectory",
      status: assumptions.marketShare >= 0 ? "safe" : assumptions.marketShare >= -8 ? "watch" : "alert",
      description: assumptions.marketShare >= 0
        ? `Market share stable or growing (+${assumptions.marketShare}pp) — competitive position intact`
        : assumptions.marketShare >= -8
        ? `${assumptions.marketShare}pp market share loss — monitor competitive dynamics closely`
        : `${assumptions.marketShare}pp market share loss — structural competitive threat requires strategic response`,
      frequency: "Monthly",
    },
    {
      name: "Cost Inflation Pressure",
      status: assumptions.costInflation <= 6 ? "safe" : assumptions.costInflation <= 10 ? "watch" : "alert",
      description: assumptions.costInflation <= 6
        ? `${assumptions.costInflation}% cost inflation — manageable; within historical norms`
        : assumptions.costInflation <= 10
        ? `${assumptions.costInflation}% cost inflation — above comfortable range; margin protection required`
        : `${assumptions.costInflation}% cost inflation — critical; pricing action or cost restructuring needed immediately`,
      frequency: "Monthly",
    },
    {
      name: "Pricing Power Signal",
      status: assumptions.pricingPower >= 0 ? "safe" : assumptions.pricingPower >= -8 ? "watch" : "alert",
      description: assumptions.pricingPower >= 0
        ? `Pricing power positive (+${assumptions.pricingPower}%) — brand equity and differentiation holding`
        : assumptions.pricingPower >= -8
        ? `${assumptions.pricingPower}% pricing pressure — commoditization risk emerging`
        : `${assumptions.pricingPower}% pricing decline — commoditization active; differentiation strategy required`,
      frequency: "Quarterly",
    },
    {
      name: "Digital Revenue Mix",
      status: assumptions.digitalRevenue >= 20 ? "safe" : assumptions.digitalRevenue >= 10 ? "watch" : "alert",
      description: assumptions.digitalRevenue >= 20
        ? `${assumptions.digitalRevenue}% digital revenue — strong platform economics developing`
        : assumptions.digitalRevenue >= 10
        ? `${assumptions.digitalRevenue}% digital revenue — below target; digital transformation acceleration needed`
        : `${assumptions.digitalRevenue}% digital revenue — critically low; legacy revenue concentration creates disruption exposure`,
      frequency: "Quarterly",
    },
    {
      name: "Enterprise Value Trajectory",
      status: evDelta >= 10 ? "safe" : evDelta >= -10 ? "watch" : "alert",
      description: evDelta >= 10
        ? `+${evDelta}% EV trajectory — current assumptions support material value creation`
        : evDelta >= -10
        ? `${evDelta}% EV change — neutral trajectory; strategic action needed to unlock value`
        : `${evDelta}% EV decline — current assumptions signal value destruction; board intervention required`,
      frequency: "Quarterly",
    },
  ];

  // ── Dynamic Council ───────────────────────────────────────────────────────
  const growthVerdict: DynamicCouncilMember["verdict"] =
    assumptions.revenueGrowth >= 10 && assumptions.marketShare >= 0 ? "Support" :
    assumptions.revenueGrowth <= 0 ? "Oppose" : "Neutral";

  const riskVerdict: DynamicCouncilMember["verdict"] =
    assumptions.costInflation <= 6 && assumptions.marketShare >= -5 ? "Support" :
    assumptions.costInflation >= 12 || assumptions.marketShare <= -10 ? "Oppose" : "Neutral";

  const financeVerdict: DynamicCouncilMember["verdict"] =
    ebitdaMarginDelta >= 2 && evDelta >= 15 ? "Support" :
    ebitdaMarginDelta <= -5 || evDelta <= -20 ? "Oppose" : "Neutral";

  const digitalVerdict: DynamicCouncilMember["verdict"] =
    assumptions.aiAdoption >= 50 && assumptions.digitalRevenue >= 20 ? "Support" :
    assumptions.aiAdoption <= 15 && assumptions.digitalRevenue <= 8 ? "Oppose" : "Neutral";

  const councilMembers: DynamicCouncilMember[] = [
    {
      persona: "Growth Strategist",
      role: "Market expansion and revenue acceleration",
      verdict: growthVerdict,
      keyConcern: assumptions.revenueGrowth >= 10
        ? "Execution capacity: can the organization actually deliver at this growth rate?"
        : assumptions.revenueGrowth <= 0
        ? "Revenue stagnation is not a strategy — what is the growth catalyst?"
        : "Growth assumptions are conservative; upside may be underestimated",
      confidence: Math.min(85, 50 + Math.abs(assumptions.revenueGrowth) * 2),
      assumptionReaction: `Revenue growth at ${assumptions.revenueGrowth}% with ${assumptions.marketShare}pp market share change — ${growthVerdict === "Support" ? "compelling growth thesis" : growthVerdict === "Oppose" ? "growth thesis is broken" : "growth thesis needs strengthening"}`,
    },
    {
      persona: "Risk Officer",
      role: "Downside protection and scenario stress-testing",
      verdict: riskVerdict,
      keyConcern: assumptions.costInflation >= 10
        ? `${assumptions.costInflation}% cost inflation is the primary risk — margin protection must be the board's first agenda item`
        : assumptions.marketShare <= -8
        ? "Market share loss of this magnitude indicates a structural competitive problem, not a cyclical one"
        : "Risk profile is manageable under current assumptions",
      confidence: Math.min(88, 55 + assumptions.costInflation * 1.5),
      assumptionReaction: `Cost inflation at ${assumptions.costInflation}%, market share at ${assumptions.marketShare}pp — risk profile is ${riskVerdict === "Support" ? "acceptable" : riskVerdict === "Oppose" ? "unacceptable" : "elevated but manageable"}`,
    },
    {
      persona: "CFO Perspective",
      role: "Capital allocation and financial performance",
      verdict: financeVerdict,
      keyConcern: ebitdaMarginDelta <= -3
        ? `EBITDA margin declining ${Math.abs(ebitdaMarginDelta)}pp — this is not a sustainable trajectory; restructuring required`
        : evDelta >= 20
        ? "EV upside is compelling but requires disciplined capital allocation to materialize"
        : "Financial assumptions are within acceptable range; focus on execution",
      confidence: Math.min(82, 50 + Math.abs(evDelta) * 0.8),
      assumptionReaction: `EBITDA margin ${ebitdaMarginDelta >= 0 ? "+" : ""}${ebitdaMarginDelta}pp, EV ${evDelta >= 0 ? "+" : ""}${evDelta}% — ${financeVerdict === "Support" ? "financial case is strong" : financeVerdict === "Oppose" ? "financial case is broken" : "financial case is neutral"}`,
    },
    {
      persona: "Digital Transformation Lead",
      role: "AI adoption and technology strategy",
      verdict: digitalVerdict,
      keyConcern: assumptions.aiAdoption <= 20
        ? `${assumptions.aiAdoption}% AI adoption is dangerously low — the window for transformation is closing`
        : assumptions.digitalRevenue <= 10
        ? "Digital revenue at this level means the business model is not yet transformed — still dependent on legacy revenue"
        : "AI and digital assumptions are ambitious but achievable with the right execution",
      confidence: Math.min(80, 40 + assumptions.aiAdoption * 0.5 + assumptions.digitalRevenue * 0.8),
      assumptionReaction: `AI adoption ${assumptions.aiAdoption}%, digital revenue ${assumptions.digitalRevenue}% — digital transformation is ${digitalVerdict === "Support" ? "on track" : digitalVerdict === "Oppose" ? "critically behind" : "progressing but needs acceleration"}`,
    },
  ];

  const supportCount = councilMembers.filter(m => m.verdict === "Support").length;
  const opposeCount  = councilMembers.filter(m => m.verdict === "Oppose").length;
  const councilSentiment: WhatIfOutputs["councilSentiment"] =
    supportCount >= 3 ? "Bullish" : opposeCount >= 3 ? "Bearish" : "Neutral";

  const councilRationale =
    councilSentiment === "Bullish"
      ? `${supportCount} of 4 council members support current assumptions. AI adoption (${assumptions.aiAdoption}%) and revenue growth (${assumptions.revenueGrowth}%) are the primary drivers of confidence.`
      : councilSentiment === "Bearish"
      ? `${opposeCount} of 4 council members oppose current assumptions. Cost inflation (${assumptions.costInflation}%) and market share trajectory (${assumptions.marketShare}pp) are the primary concerns.`
      : `Council is divided. Upside from AI and digital transformation is offset by cost and competitive pressures. Strategic clarity is required.`;

  // ── Recommendation ────────────────────────────────────────────────────────
  let recommendation: string;
  let recommendationConfidence: number;

  if (evDelta > 30 && computedMargin > baseMargin) {
    recommendation = "Strong Buy — Assumptions support material value creation";
    recommendationConfidence = Math.min(88, 60 + Math.round(evDelta / 3));
  } else if (evDelta > 10) {
    recommendation = "Buy — Moderate upside with manageable risk profile";
    recommendationConfidence = Math.min(80, 55 + Math.round(evDelta / 4));
  } else if (evDelta > -10) {
    recommendation = "Hold — Assumptions produce a neutral value trajectory";
    recommendationConfidence = 55;
  } else if (evDelta > -25) {
    recommendation = "Reduce — Assumptions signal value erosion; review strategy";
    recommendationConfidence = Math.min(75, 50 + Math.round(Math.abs(evDelta) / 4));
  } else {
    recommendation = "Exit — Assumptions indicate structural value destruction";
    recommendationConfidence = Math.min(82, 55 + Math.round(Math.abs(evDelta) / 5));
  }

  // ── 5-Year Projection ─────────────────────────────────────────────────────
  const years = ["2024", "2025", "2026", "2027", "2028"];
  const annualGrowth = 1 + (assumptions.revenueGrowth / 100) * 0.4 + 0.04;
  const projectionData = years.map((year, i) => {
    const r = Math.round(computedRevenue * Math.pow(annualGrowth, i - 4));
    const m = Math.min(60, computedMargin + i * 0.3);
    return { year, revenue: r, ebitda: Math.round(r * m / 100) };
  });

  return {
    revenue: computedRevenue,
    revenueUnit: base.revenueUnit,
    revenueDelta,
    ebitda: computedEbitda,
    ebitdaMargin: Math.round(computedMargin * 10) / 10,
    ebitdaMarginDelta,
    enterpriseValue: computedEV,
    evUnit: base.evUnit,
    evDelta,
    evMultiple: Math.round(adjustedMultiple * 10) / 10,
    aiLeverageScore,
    resilienceScore,
    growthMomentum,
    growthPathways: growthPathways.slice(0, 4),
    failurePathways: failurePathways.slice(0, 4),
    earlyWarningIndicators,
    councilMembers,
    councilSentiment,
    councilRationale,
    recommendation,
    recommendationConfidence,
    projectionData,
  };
}

// ─── SLIDER DEFINITIONS ───────────────────────────────────────────────────────

export interface SliderDef {
  key: keyof WhatIfAssumptions;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  formatValue: (v: number) => string;
}

export const SLIDER_DEFS: SliderDef[] = [
  { key: "aiAdoption",    label: "AI Adoption",    min: 0,   max: 100, step: 5,   unit: "%",  description: "% of available AI efficiency gains captured",          formatValue: v => `${v}%` },
  { key: "marketShare",   label: "Market Share",   min: -30, max: 30,  step: 1,   unit: "pp", description: "Percentage point change in market share",              formatValue: v => `${v > 0 ? "+" : ""}${v}pp` },
  { key: "pricingPower",  label: "Pricing Power",  min: -20, max: 20,  step: 1,   unit: "%",  description: "% change in average selling price / fee rate",         formatValue: v => `${v > 0 ? "+" : ""}${v}%` },
  { key: "costInflation", label: "Cost Inflation", min: 0,   max: 20,  step: 0.5, unit: "%",  description: "Annual operating cost inflation rate",                  formatValue: v => `${v}%` },
  { key: "revenueGrowth", label: "Revenue Growth", min: -10, max: 30,  step: 1,   unit: "%",  description: "Annual revenue growth rate delta vs base",              formatValue: v => `${v > 0 ? "+" : ""}${v}%` },
  { key: "geographicMix", label: "Geographic Mix", min: 0,   max: 100, step: 5,   unit: "%",  description: "% international / diversified revenue",                 formatValue: v => `${v}%` },
  { key: "digitalRevenue",label: "Digital Revenue",min: 0,   max: 50,  step: 1,   unit: "%",  description: "% of revenue from digital / new business models",       formatValue: v => `${v}%` },
];
