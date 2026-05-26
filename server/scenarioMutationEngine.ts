/**
 * scenarioMutationEngine.ts — Strategic Scenario Simulation Mode v1.0
 *
 * Generates coherent, internally-consistent strategic variants of a deal brief
 * for probabilistic institutional stress testing.
 *
 * Architecture:
 *   Deal Memo
 *   → Scenario Mutation Engine  (this file)
 *   → Structured Strategic Variants
 *   → Council Evaluation (lightweight, LLM-based per variant)
 *   → Aggregation Layer
 *   → Probabilistic Decision Surface
 *
 * Design principles:
 *   - No random hallucination. Mutations are structured, sector-aware, and
 *     financially plausible.
 *   - Internally coherent: correlated stresses are applied together (e.g.,
 *     recession + demand contraction + pricing pressure).
 *   - Governed: every scenario carries a perturbation provenance manifest for
 *     auditability.
 *   - Resumable: large runs (10k, 100k) are chunked and can be paused/resumed.
 */

// ── Perturbation Categories ────────────────────────────────────────────────────

export type PerturbationCategory =
  | "financial"
  | "regulatory"
  | "execution"
  | "market"
  | "technology"
  | "governance";

export type SimulationMode = "quick" | "institutional" | "deep" | "infrastructure" | "extreme";

export interface SimulationModeConfig {
  label: string;
  count: number;
  description: string;
  /** If true, requires user confirmation before launching */
  gated?: boolean;
  /** Confirmation modal message shown before launch */
  warningMessage?: string;
  /** Whether this mode supports checkpointing and resumability */
  resumable?: boolean;
  /** Estimated cost tier for display */
  costTier?: "low" | "medium" | "high" | "extreme";
}

export const SIMULATION_MODES: Record<SimulationMode, SimulationModeConfig> = {
  quick:          { label: "Mode A — Quick Stress",          count: 100,       description: "Rapid sensitivity scan across 100 scenarios",                                  costTier: "low" },
  institutional:  { label: "Mode B — Institutional Stress",  count: 1000,      description: "Probabilistic approval mapping across 1,000 scenarios",                       costTier: "low" },
  deep:           { label: "Mode C — Strategic Deep Stress",  count: 10000,     description: "Decision-surface analysis across 10,000 scenarios",                           costTier: "medium" },
  infrastructure: {
    label: "Mode D — Infrastructure Scale",
    count: 100000,
    description: "Continuous institutional stress testing at 100,000 scenarios",
    gated: true,
    resumable: true,
    costTier: "high",
    warningMessage: "Infrastructure Scale mode runs 100,000 scenarios. This is a long-duration run with checkpointing and resumability. Estimated wall-clock time depends on RPM limits and worker configuration. Confirm only if you accept the cost and time implications.",
  },
  extreme: {
    label: "Mode E — Extreme Scale",
    count: 1000000,
    description: "Extreme-scale stress testing across 1,000,000 strategic futures",
    gated: true,
    resumable: true,
    costTier: "extreme",
    warningMessage: "You are about to launch Extreme Scale Simulation Mode. This may run for days depending on RPM limits and worker configuration. Confirm only if checkpointing, telemetry, and cost limits are acceptable.",
  },
};

// ── Perturbation Dimension Definitions ────────────────────────────────────────

export interface PerturbationDimension {
  category: PerturbationCategory;
  key: string;
  label: string;
  levels: PerturbationLevel[];
  /** Correlated dimensions that should be stressed together */
  correlations?: string[];
}

export interface PerturbationLevel {
  id: string;
  label: string;
  severity: "base" | "mild" | "moderate" | "severe" | "extreme";
  /** Additive impact on approval probability (-1.0 to +1.0) */
  approvalDelta: number;
  /** Text fragment injected into the scenario brief */
  stressFragment: string;
  isHardNo?: boolean;
}

export const PERTURBATION_DIMENSIONS: PerturbationDimension[] = [
  // ── 1. Financial Stress ──────────────────────────────────────────────────
  {
    category: "financial",
    key: "capex_inflation",
    label: "CapEx Inflation",
    correlations: ["debt_refinancing", "liquidity_tightening"],
    levels: [
      { id: "capex_base",     label: "On-budget",              severity: "base",     approvalDelta:  0.00, stressFragment: "Capital expenditure is tracking on-budget." },
      { id: "capex_mild",     label: "+15% CapEx overrun",     severity: "mild",     approvalDelta: -0.05, stressFragment: "Capital expenditure has increased by 15% due to input cost inflation." },
      { id: "capex_moderate", label: "+30% CapEx overrun",     severity: "moderate", approvalDelta: -0.12, stressFragment: "Capital expenditure has risen 30% above plan, driven by materials and labour cost inflation." },
      { id: "capex_severe",   label: "+60% CapEx overrun",     severity: "severe",   approvalDelta: -0.25, stressFragment: "Capital expenditure has ballooned 60% above plan. Project economics are materially impaired." },
      { id: "capex_extreme",  label: "+100% CapEx overrun",    severity: "extreme",  approvalDelta: -0.45, stressFragment: "Capital expenditure has doubled. The project is no longer viable at current equity returns.", isHardNo: true },
    ],
  },
  {
    category: "financial",
    key: "ebitda_compression",
    label: "EBITDA Compression",
    correlations: ["margin_degradation", "pricing_pressure"],
    levels: [
      { id: "ebitda_base",     label: "On-plan EBITDA",         severity: "base",     approvalDelta:  0.00, stressFragment: "EBITDA is tracking in line with the base case." },
      { id: "ebitda_mild",     label: "-10% EBITDA",            severity: "mild",     approvalDelta: -0.06, stressFragment: "EBITDA has compressed 10% below plan due to cost pressures." },
      { id: "ebitda_moderate", label: "-25% EBITDA",            severity: "moderate", approvalDelta: -0.15, stressFragment: "EBITDA is 25% below plan. Margin recovery requires operational restructuring." },
      { id: "ebitda_severe",   label: "-50% EBITDA",            severity: "severe",   approvalDelta: -0.30, stressFragment: "EBITDA has halved. The business is approaching breakeven and covenant risk is elevated." },
      { id: "ebitda_extreme",  label: "EBITDA negative",        severity: "extreme",  approvalDelta: -0.50, stressFragment: "EBITDA has turned negative. The business is cash-burning at scale.", isHardNo: true },
    ],
  },
  {
    category: "financial",
    key: "debt_refinancing",
    label: "Debt Refinancing Stress",
    correlations: ["liquidity_tightening", "capex_inflation"],
    levels: [
      { id: "debt_base",     label: "Refinancing on terms",    severity: "base",     approvalDelta:  0.00, stressFragment: "Debt refinancing is expected on current terms." },
      { id: "debt_mild",     label: "+150bps spread",          severity: "mild",     approvalDelta: -0.04, stressFragment: "Refinancing spread has widened by 150bps, increasing interest cost." },
      { id: "debt_moderate", label: "+300bps spread",          severity: "moderate", approvalDelta: -0.12, stressFragment: "Refinancing spread has widened 300bps. Debt service coverage is under pressure." },
      { id: "debt_severe",   label: "Refinancing at risk",     severity: "severe",   approvalDelta: -0.28, stressFragment: "Refinancing is at risk. Lenders are requiring covenant amendments and additional security." },
      { id: "debt_extreme",  label: "Refinancing failure",     severity: "extreme",  approvalDelta: -0.55, stressFragment: "Refinancing has failed. The company faces a liquidity crisis and potential default.", isHardNo: true },
    ],
  },
  {
    category: "financial",
    key: "fx_movement",
    label: "FX Movement",
    levels: [
      { id: "fx_base",     label: "FX stable",              severity: "base",     approvalDelta:  0.00, stressFragment: "Foreign exchange rates are stable relative to the base case." },
      { id: "fx_mild",     label: "5% adverse FX move",     severity: "mild",     approvalDelta: -0.03, stressFragment: "A 5% adverse FX movement has reduced USD-equivalent revenues." },
      { id: "fx_moderate", label: "15% adverse FX move",    severity: "moderate", approvalDelta: -0.10, stressFragment: "A 15% adverse FX move has materially impacted USD returns and local cost structures." },
      { id: "fx_severe",   label: "30% currency devaluation", severity: "severe", approvalDelta: -0.22, stressFragment: "A 30% currency devaluation has severely impaired USD returns and created balance sheet stress." },
    ],
  },
  {
    category: "financial",
    key: "liquidity_tightening",
    label: "Liquidity Tightening",
    correlations: ["debt_refinancing"],
    levels: [
      { id: "liq_base",     label: "Adequate liquidity",     severity: "base",     approvalDelta:  0.00, stressFragment: "Liquidity headroom is adequate for the operating plan." },
      { id: "liq_mild",     label: "Tight but manageable",   severity: "mild",     approvalDelta: -0.05, stressFragment: "Liquidity is tight but manageable. Working capital discipline is required." },
      { id: "liq_moderate", label: "Covenant headroom <10%", severity: "moderate", approvalDelta: -0.18, stressFragment: "Covenant headroom has fallen below 10%. A liquidity event in the next 12 months is possible." },
      { id: "liq_severe",   label: "Cash runway <6 months",  severity: "severe",   approvalDelta: -0.40, stressFragment: "Cash runway is under 6 months. Emergency financing or asset sales are required.", isHardNo: true },
    ],
  },
  {
    category: "financial",
    key: "margin_degradation",
    label: "Margin Degradation",
    correlations: ["ebitda_compression", "pricing_pressure"],
    levels: [
      { id: "margin_base",     label: "Margins on plan",       severity: "base",     approvalDelta:  0.00, stressFragment: "Gross and operating margins are tracking in line with the investment thesis." },
      { id: "margin_mild",     label: "-5pp gross margin",     severity: "mild",     approvalDelta: -0.06, stressFragment: "Gross margin has contracted 5 percentage points due to input cost and pricing pressure." },
      { id: "margin_moderate", label: "-15pp gross margin",    severity: "moderate", approvalDelta: -0.18, stressFragment: "Gross margin has contracted 15 percentage points. The unit economics thesis is impaired." },
      { id: "margin_severe",   label: "-30pp gross margin",    severity: "severe",   approvalDelta: -0.35, stressFragment: "Gross margin has contracted 30 percentage points. The business model requires fundamental restructuring.", isHardNo: true },
    ],
  },

  // ── 2. Regulatory Stress ─────────────────────────────────────────────────
  {
    category: "regulatory",
    key: "subsidy_reduction",
    label: "Subsidy Reduction",
    levels: [
      { id: "sub_base",     label: "Subsidies maintained",    severity: "base",     approvalDelta:  0.00, stressFragment: "Government subsidies and incentives are maintained as modelled." },
      { id: "sub_mild",     label: "10% subsidy cut",         severity: "mild",     approvalDelta: -0.05, stressFragment: "Government subsidies have been reduced by 10%, modestly impacting project economics." },
      { id: "sub_moderate", label: "40% subsidy cut",         severity: "moderate", approvalDelta: -0.15, stressFragment: "Government subsidies have been cut 40%. The project's IRR falls below the fund hurdle rate." },
      { id: "sub_severe",   label: "Full subsidy removal",    severity: "severe",   approvalDelta: -0.35, stressFragment: "All government subsidies have been removed. The project is no longer economically viable without restructuring.", isHardNo: true },
    ],
  },
  {
    category: "regulatory",
    key: "localization_requirements",
    label: "Localization Requirements",
    levels: [
      { id: "local_base",     label: "No new requirements",   severity: "base",     approvalDelta:  0.00, stressFragment: "No new localization or content requirements have been imposed." },
      { id: "local_mild",     label: "Minor compliance cost", severity: "mild",     approvalDelta: -0.04, stressFragment: "New localization requirements add minor compliance costs but are manageable." },
      { id: "local_moderate", label: "Significant local content mandate", severity: "moderate", approvalDelta: -0.14, stressFragment: "A significant local content mandate requires operational restructuring and increases costs materially." },
      { id: "local_severe",   label: "Prohibitive localization", severity: "severe", approvalDelta: -0.30, stressFragment: "Localization requirements are prohibitive. The current operating model cannot comply without fundamental redesign.", isHardNo: true },
    ],
  },
  {
    category: "regulatory",
    key: "delayed_approvals",
    label: "Regulatory Approval Delays",
    correlations: ["construction_delays"],
    levels: [
      { id: "approval_base",     label: "On-schedule approvals", severity: "base",     approvalDelta:  0.00, stressFragment: "Regulatory approvals are proceeding on schedule." },
      { id: "approval_mild",     label: "3-month delay",         severity: "mild",     approvalDelta: -0.04, stressFragment: "Regulatory approvals have been delayed by 3 months, pushing the revenue start date." },
      { id: "approval_moderate", label: "9-month delay",         severity: "moderate", approvalDelta: -0.12, stressFragment: "Regulatory approvals are delayed 9 months. Carrying costs are increasing and investor confidence is eroding." },
      { id: "approval_severe",   label: "Approval blocked",      severity: "severe",   approvalDelta: -0.40, stressFragment: "A key regulatory approval has been blocked. The project cannot proceed without a legal challenge or political intervention.", isHardNo: true },
    ],
  },
  {
    category: "regulatory",
    key: "tariff_changes",
    label: "Tariff & Trade Policy Changes",
    levels: [
      { id: "tariff_base",     label: "Stable trade policy",    severity: "base",     approvalDelta:  0.00, stressFragment: "Trade policy and tariff structures are stable." },
      { id: "tariff_mild",     label: "Minor tariff increase",  severity: "mild",     approvalDelta: -0.04, stressFragment: "Minor tariff increases have raised import costs modestly." },
      { id: "tariff_moderate", label: "Significant tariff shock", severity: "moderate", approvalDelta: -0.15, stressFragment: "A significant tariff shock has disrupted the supply chain and raised input costs materially." },
      { id: "tariff_severe",   label: "Trade war / sanctions",  severity: "severe",   approvalDelta: -0.35, stressFragment: "A trade war or sanctions regime has blocked key supply routes and markets.", isHardNo: true },
    ],
  },
  {
    category: "regulatory",
    key: "sovereign_restrictions",
    label: "Sovereign / Capital Restrictions",
    levels: [
      { id: "sov_base",     label: "No restrictions",          severity: "base",     approvalDelta:  0.00, stressFragment: "No sovereign capital or repatriation restrictions are in force." },
      { id: "sov_mild",     label: "Minor reporting requirements", severity: "mild",  approvalDelta: -0.03, stressFragment: "New reporting requirements add administrative burden but do not restrict capital flows." },
      { id: "sov_moderate", label: "Capital repatriation limits", severity: "moderate", approvalDelta: -0.20, stressFragment: "Capital repatriation limits have been imposed, restricting dividend flows to the fund." },
      { id: "sov_severe",   label: "Full capital controls",    severity: "severe",   approvalDelta: -0.45, stressFragment: "Full capital controls have been imposed. Exit proceeds cannot be repatriated.", isHardNo: true },
    ],
  },

  // ── 3. Execution Stress ──────────────────────────────────────────────────
  {
    category: "execution",
    key: "construction_delays",
    label: "Construction / Build Delays",
    correlations: ["delayed_approvals", "vendor_underperformance"],
    levels: [
      { id: "build_base",     label: "On-schedule delivery",   severity: "base",     approvalDelta:  0.00, stressFragment: "Construction and build milestones are tracking on schedule." },
      { id: "build_mild",     label: "2-month delay",          severity: "mild",     approvalDelta: -0.04, stressFragment: "A 2-month construction delay has pushed the commercial launch date." },
      { id: "build_moderate", label: "6-month delay",          severity: "moderate", approvalDelta: -0.13, stressFragment: "A 6-month construction delay has materially increased carrying costs and delayed revenue." },
      { id: "build_severe",   label: "18-month delay",         severity: "severe",   approvalDelta: -0.28, stressFragment: "An 18-month construction delay has severely impaired project economics and triggered lender review." },
      { id: "build_extreme",  label: "Project abandonment risk", severity: "extreme", approvalDelta: -0.55, stressFragment: "Construction delays have reached a point where project abandonment is being evaluated.", isHardNo: true },
    ],
  },
  {
    category: "execution",
    key: "integration_failures",
    label: "Integration Failures",
    levels: [
      { id: "int_base",     label: "Integration on track",    severity: "base",     approvalDelta:  0.00, stressFragment: "System and operational integration is proceeding as planned." },
      { id: "int_mild",     label: "Minor integration issues", severity: "mild",    approvalDelta: -0.05, stressFragment: "Minor integration issues have caused delays but are being resolved." },
      { id: "int_moderate", label: "Significant integration failure", severity: "moderate", approvalDelta: -0.18, stressFragment: "A significant integration failure has disrupted operations and required emergency remediation." },
      { id: "int_severe",   label: "Critical system failure", severity: "severe",   approvalDelta: -0.40, stressFragment: "A critical system integration failure has halted operations. Customer impact is severe.", isHardNo: true },
    ],
  },
  {
    category: "execution",
    key: "supply_chain_disruption",
    label: "Supply Chain Disruption",
    correlations: ["tariff_changes", "vendor_underperformance"],
    levels: [
      { id: "supply_base",     label: "Supply chain stable",   severity: "base",     approvalDelta:  0.00, stressFragment: "Supply chain is operating without material disruption." },
      { id: "supply_mild",     label: "Minor disruptions",     severity: "mild",     approvalDelta: -0.04, stressFragment: "Minor supply chain disruptions have caused short-term cost increases." },
      { id: "supply_moderate", label: "Significant disruption", severity: "moderate", approvalDelta: -0.16, stressFragment: "Significant supply chain disruption has caused production delays and inventory shortfalls." },
      { id: "supply_severe",   label: "Critical supply failure", severity: "severe", approvalDelta: -0.35, stressFragment: "A critical supply chain failure has halted production. Alternative sourcing is unavailable at acceptable cost.", isHardNo: true },
    ],
  },
  {
    category: "execution",
    key: "vendor_underperformance",
    label: "Vendor / Partner Underperformance",
    correlations: ["construction_delays", "supply_chain_disruption"],
    levels: [
      { id: "vendor_base",     label: "Vendors performing",    severity: "base",     approvalDelta:  0.00, stressFragment: "Key vendors and partners are delivering on contractual commitments." },
      { id: "vendor_mild",     label: "Minor underperformance", severity: "mild",    approvalDelta: -0.04, stressFragment: "Minor vendor underperformance has caused schedule slippage but is being managed." },
      { id: "vendor_moderate", label: "Key vendor failure",    severity: "moderate", approvalDelta: -0.18, stressFragment: "A key vendor has failed to deliver. Replacement sourcing is underway but will cause significant delays." },
      { id: "vendor_severe",   label: "Multiple vendor failures", severity: "severe", approvalDelta: -0.35, stressFragment: "Multiple vendor failures have cascaded across the project. Delivery timelines are no longer credible.", isHardNo: true },
    ],
  },
  {
    category: "execution",
    key: "staffing_issues",
    label: "Staffing & Talent Gaps",
    levels: [
      { id: "staff_base",     label: "Team fully staffed",     severity: "base",     approvalDelta:  0.00, stressFragment: "The management team and operational workforce are fully staffed." },
      { id: "staff_mild",     label: "Minor talent gaps",      severity: "mild",     approvalDelta: -0.03, stressFragment: "Minor talent gaps exist in non-critical roles and are being addressed." },
      { id: "staff_moderate", label: "Key person departure",   severity: "moderate", approvalDelta: -0.15, stressFragment: "A key executive has departed. Succession planning is in progress but creates near-term execution risk." },
      { id: "staff_severe",   label: "Management team breakdown", severity: "severe", approvalDelta: -0.32, stressFragment: "The management team has experienced significant departures. Operational continuity is at risk.", isHardNo: true },
    ],
  },

  // ── 4. Market Stress ─────────────────────────────────────────────────────
  {
    category: "market",
    key: "recession_scenario",
    label: "Macro Recession",
    correlations: ["demand_contraction", "pricing_pressure", "ebitda_compression"],
    levels: [
      { id: "rec_base",     label: "Stable macro",            severity: "base",     approvalDelta:  0.00, stressFragment: "The macroeconomic environment is stable and consistent with the base case." },
      { id: "rec_mild",     label: "Mild slowdown",           severity: "mild",     approvalDelta: -0.06, stressFragment: "A mild economic slowdown has reduced consumer confidence and discretionary spending." },
      { id: "rec_moderate", label: "Moderate recession",      severity: "moderate", approvalDelta: -0.18, stressFragment: "A moderate recession has materially reduced demand across the target market." },
      { id: "rec_severe",   label: "Deep recession",          severity: "severe",   approvalDelta: -0.35, stressFragment: "A deep recession has severely impaired demand, credit availability, and investor appetite." },
      { id: "rec_extreme",  label: "Financial crisis",        severity: "extreme",  approvalDelta: -0.55, stressFragment: "A financial crisis has frozen credit markets and caused widespread demand destruction.", isHardNo: true },
    ],
  },
  {
    category: "market",
    key: "competitor_aggression",
    label: "Competitor Aggression",
    levels: [
      { id: "comp_base",     label: "Stable competitive landscape", severity: "base", approvalDelta:  0.00, stressFragment: "The competitive landscape is stable and consistent with the investment thesis." },
      { id: "comp_mild",     label: "New entrant",             severity: "mild",     approvalDelta: -0.05, stressFragment: "A new entrant has entered the market, increasing competitive pressure modestly." },
      { id: "comp_moderate", label: "Aggressive price war",   severity: "moderate", approvalDelta: -0.18, stressFragment: "A well-funded competitor has launched an aggressive price war, compressing margins across the sector." },
      { id: "comp_severe",   label: "Dominant platform entry", severity: "severe",  approvalDelta: -0.35, stressFragment: "A dominant platform (e.g., hyperscaler or Big Tech) has entered the market, threatening the company's core value proposition.", isHardNo: true },
    ],
  },
  {
    category: "market",
    key: "commodity_price_shifts",
    label: "Commodity Price Shifts",
    levels: [
      { id: "comm_base",     label: "Commodity prices stable", severity: "base",    approvalDelta:  0.00, stressFragment: "Commodity prices are stable relative to the base case assumptions." },
      { id: "comm_mild",     label: "+20% commodity cost",    severity: "mild",     approvalDelta: -0.04, stressFragment: "Key commodity costs have risen 20%, modestly impacting input cost assumptions." },
      { id: "comm_moderate", label: "+50% commodity cost",    severity: "moderate", approvalDelta: -0.14, stressFragment: "Key commodity costs have risen 50%, materially impairing the cost structure." },
      { id: "comm_severe",   label: "+100% commodity cost",   severity: "severe",   approvalDelta: -0.28, stressFragment: "Key commodity costs have doubled, rendering the current business model unviable without price increases." },
    ],
  },
  {
    category: "market",
    key: "demand_contraction",
    label: "Demand Contraction",
    correlations: ["recession_scenario", "pricing_pressure"],
    levels: [
      { id: "dem_base",     label: "Demand on plan",          severity: "base",     approvalDelta:  0.00, stressFragment: "Market demand is tracking in line with the base case forecast." },
      { id: "dem_mild",     label: "-10% demand",             severity: "mild",     approvalDelta: -0.06, stressFragment: "Market demand has contracted 10% below plan." },
      { id: "dem_moderate", label: "-25% demand",             severity: "moderate", approvalDelta: -0.18, stressFragment: "Market demand has contracted 25%. Revenue projections require material downward revision." },
      { id: "dem_severe",   label: "-50% demand",             severity: "severe",   approvalDelta: -0.38, stressFragment: "Market demand has collapsed 50%. The addressable market thesis is fundamentally challenged.", isHardNo: true },
    ],
  },
  {
    category: "market",
    key: "pricing_pressure",
    label: "Pricing Pressure",
    correlations: ["competitor_aggression", "demand_contraction"],
    levels: [
      { id: "price_base",     label: "Pricing power maintained", severity: "base",  approvalDelta:  0.00, stressFragment: "The company maintains pricing power consistent with the investment thesis." },
      { id: "price_mild",     label: "-5% ASP decline",        severity: "mild",    approvalDelta: -0.05, stressFragment: "Average selling prices have declined 5% due to competitive pressure." },
      { id: "price_moderate", label: "-15% ASP decline",       severity: "moderate", approvalDelta: -0.16, stressFragment: "Average selling prices have declined 15%. Revenue and margin assumptions require significant revision." },
      { id: "price_severe",   label: "-30% ASP decline",       severity: "severe",  approvalDelta: -0.32, stressFragment: "Average selling prices have declined 30%. The pricing thesis has collapsed.", isHardNo: true },
    ],
  },

  // ── 5. Technology Stress ─────────────────────────────────────────────────
  {
    category: "technology",
    key: "tech_underperformance",
    label: "Technology Underperformance",
    levels: [
      { id: "tech_base",     label: "Technology performing",  severity: "base",     approvalDelta:  0.00, stressFragment: "Core technology is performing as specified in the investment thesis." },
      { id: "tech_mild",     label: "Minor performance gaps", severity: "mild",     approvalDelta: -0.05, stressFragment: "Minor technology performance gaps have emerged but are within acceptable tolerances." },
      { id: "tech_moderate", label: "Significant underperformance", severity: "moderate", approvalDelta: -0.18, stressFragment: "Core technology is significantly underperforming specifications, requiring remediation investment." },
      { id: "tech_severe",   label: "Technology failure",     severity: "severe",   approvalDelta: -0.40, stressFragment: "The core technology has failed to achieve its stated performance targets. A fundamental redesign is required.", isHardNo: true },
    ],
  },
  {
    category: "technology",
    key: "scale_failure",
    label: "Scale Failure",
    correlations: ["integration_failures"],
    levels: [
      { id: "scale_base",     label: "Scales as designed",    severity: "base",     approvalDelta:  0.00, stressFragment: "The technology platform scales as designed at projected load levels." },
      { id: "scale_mild",     label: "Minor scaling issues",  severity: "mild",     approvalDelta: -0.05, stressFragment: "Minor scaling issues have emerged at higher load levels but are being addressed." },
      { id: "scale_moderate", label: "Significant scale limitations", severity: "moderate", approvalDelta: -0.20, stressFragment: "The platform has hit significant scale limitations, capping growth and requiring infrastructure investment." },
      { id: "scale_severe",   label: "Platform cannot scale", severity: "severe",   approvalDelta: -0.42, stressFragment: "The platform fundamentally cannot scale to the required volume. A re-architecture is required.", isHardNo: true },
    ],
  },
  {
    category: "technology",
    key: "deployment_delays",
    label: "Technology Deployment Delays",
    correlations: ["construction_delays"],
    levels: [
      { id: "deploy_base",     label: "On-schedule deployment", severity: "base",   approvalDelta:  0.00, stressFragment: "Technology deployment is proceeding on schedule." },
      { id: "deploy_mild",     label: "1-month delay",          severity: "mild",   approvalDelta: -0.03, stressFragment: "A 1-month technology deployment delay has pushed the go-live date." },
      { id: "deploy_moderate", label: "4-month delay",          severity: "moderate", approvalDelta: -0.12, stressFragment: "A 4-month technology deployment delay has materially impacted the revenue ramp." },
      { id: "deploy_severe",   label: "12-month delay",         severity: "severe", approvalDelta: -0.28, stressFragment: "A 12-month technology deployment delay has severely impaired the business case.", isHardNo: true },
    ],
  },
  {
    category: "technology",
    key: "model_degradation",
    label: "AI / Model Degradation",
    levels: [
      { id: "model_base",     label: "Model performing",       severity: "base",    approvalDelta:  0.00, stressFragment: "AI and algorithmic models are performing within expected parameters." },
      { id: "model_mild",     label: "Minor accuracy drift",   severity: "mild",    approvalDelta: -0.04, stressFragment: "Minor model accuracy drift has been detected and is being monitored." },
      { id: "model_moderate", label: "Significant degradation", severity: "moderate", approvalDelta: -0.16, stressFragment: "Significant model degradation has impaired product quality and customer satisfaction." },
      { id: "model_severe",   label: "Model failure",          severity: "severe",  approvalDelta: -0.38, stressFragment: "Core AI models have failed, rendering the product non-functional. Retraining is required.", isHardNo: true },
    ],
  },
  {
    category: "technology",
    key: "infrastructure_instability",
    label: "Infrastructure Instability",
    levels: [
      { id: "infra_base",     label: "Infrastructure stable",  severity: "base",    approvalDelta:  0.00, stressFragment: "Infrastructure is stable with uptime meeting SLA requirements." },
      { id: "infra_mild",     label: "Occasional outages",     severity: "mild",    approvalDelta: -0.04, stressFragment: "Occasional infrastructure outages have impacted SLA compliance." },
      { id: "infra_moderate", label: "Frequent instability",   severity: "moderate", approvalDelta: -0.16, stressFragment: "Frequent infrastructure instability has caused customer churn and reputational damage." },
      { id: "infra_severe",   label: "Critical infrastructure failure", severity: "severe", approvalDelta: -0.38, stressFragment: "A critical infrastructure failure has caused extended downtime and material customer loss.", isHardNo: true },
    ],
  },

  // ── 6. Governance Stress ─────────────────────────────────────────────────
  {
    category: "governance",
    key: "escalation_frequency",
    label: "Governance Escalation Frequency",
    levels: [
      { id: "esc_base",     label: "Normal governance cadence", severity: "base",   approvalDelta:  0.00, stressFragment: "Governance is operating at normal cadence with no unusual escalations." },
      { id: "esc_mild",     label: "Elevated escalations",    severity: "mild",     approvalDelta: -0.04, stressFragment: "Governance escalation frequency is elevated, indicating management tension." },
      { id: "esc_moderate", label: "Frequent board interventions", severity: "moderate", approvalDelta: -0.15, stressFragment: "Frequent board interventions are required, signalling a breakdown in management authority." },
      { id: "esc_severe",   label: "Governance crisis",       severity: "severe",   approvalDelta: -0.35, stressFragment: "A governance crisis has erupted. Board and management are in open conflict.", isHardNo: true },
    ],
  },
  {
    category: "governance",
    key: "compliance_violations",
    label: "Compliance Violations",
    levels: [
      { id: "comp_v_base",     label: "Full compliance",       severity: "base",    approvalDelta:  0.00, stressFragment: "The company is in full compliance with applicable laws and regulations." },
      { id: "comp_v_mild",     label: "Minor violations",      severity: "mild",    approvalDelta: -0.06, stressFragment: "Minor compliance violations have been identified and remediation is underway." },
      { id: "comp_v_moderate", label: "Regulatory investigation", severity: "moderate", approvalDelta: -0.22, stressFragment: "A regulatory investigation has been launched. Legal costs are rising and management attention is diverted." },
      { id: "comp_v_severe",   label: "Material breach / fine", severity: "severe", approvalDelta: -0.42, stressFragment: "A material compliance breach has resulted in a significant regulatory fine and operational restrictions.", isHardNo: true },
    ],
  },
  {
    category: "governance",
    key: "board_disagreement",
    label: "Board Disagreement",
    correlations: ["escalation_frequency"],
    levels: [
      { id: "board_base",     label: "Board aligned",          severity: "base",    approvalDelta:  0.00, stressFragment: "The board is aligned on strategy and operating plan." },
      { id: "board_mild",     label: "Minor board tension",    severity: "mild",    approvalDelta: -0.04, stressFragment: "Minor board tensions exist on strategic direction but are being managed." },
      { id: "board_moderate", label: "Significant board conflict", severity: "moderate", approvalDelta: -0.18, stressFragment: "Significant board conflict is impairing decision-making speed and management morale." },
      { id: "board_severe",   label: "Board breakdown",        severity: "severe",  approvalDelta: -0.38, stressFragment: "The board has broken down. Shareholder disputes are threatening the company's ability to operate.", isHardNo: true },
    ],
  },
  {
    category: "governance",
    key: "audit_concerns",
    label: "Audit Concerns",
    levels: [
      { id: "audit_base",     label: "Clean audit",            severity: "base",    approvalDelta:  0.00, stressFragment: "The company has received a clean audit opinion." },
      { id: "audit_mild",     label: "Minor audit findings",   severity: "mild",    approvalDelta: -0.05, stressFragment: "Minor audit findings have been raised and management is addressing them." },
      { id: "audit_moderate", label: "Qualified opinion",      severity: "moderate", approvalDelta: -0.22, stressFragment: "Auditors have issued a qualified opinion. Financial reporting reliability is in question." },
      { id: "audit_severe",   label: "Adverse opinion / fraud", severity: "severe", approvalDelta: -0.50, stressFragment: "An adverse audit opinion or fraud allegation has been issued. The company's financial statements cannot be relied upon.", isHardNo: true },
    ],
  },
  {
    category: "governance",
    key: "policy_conflict",
    label: "Policy / Regulatory Conflict",
    correlations: ["sovereign_restrictions", "compliance_violations"],
    levels: [
      { id: "policy_base",     label: "Policy aligned",        severity: "base",    approvalDelta:  0.00, stressFragment: "The company's operations are aligned with current policy and regulatory frameworks." },
      { id: "policy_mild",     label: "Minor policy friction", severity: "mild",    approvalDelta: -0.04, stressFragment: "Minor policy friction exists but is being navigated through regulatory engagement." },
      { id: "policy_moderate", label: "Significant policy conflict", severity: "moderate", approvalDelta: -0.20, stressFragment: "A significant policy conflict has emerged. The company's operating model may require restructuring to comply." },
      { id: "policy_severe",   label: "Operating licence at risk", severity: "severe", approvalDelta: -0.45, stressFragment: "The company's operating licence is at risk due to a fundamental conflict with regulatory policy.", isHardNo: true },
    ],
  },
];

// ── Scenario Generation ────────────────────────────────────────────────────────

export interface ScenarioVariant {
  /** Unique index within the simulation run */
  index: number;
  /** Selected perturbation level for each dimension */
  perturbations: Record<string, string>; // dimensionKey → levelId
  /** Aggregated approval delta from all perturbations */
  totalApprovalDelta: number;
  /** Whether any hard-no trigger was activated */
  hasHardNo: boolean;
  /** Categories stressed in this scenario */
  stressedCategories: PerturbationCategory[];
  /** Dominant risk category (highest absolute delta contributor) */
  dominantRiskCategory: PerturbationCategory;
  /** Stress fragments to inject into the deal brief */
  stressFragments: string[];
  /** Provenance manifest for auditability */
  provenance: {
    seed: number;
    correlationGroupsActivated: string[];
    hardNoTriggers: string[];
  };
}

/** Seeded pseudo-random number generator (LCG) for reproducibility */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Generate N coherent scenario variants using stratified sampling.
 *
 * Strategy:
 * 1. Each scenario samples a severity level for every dimension.
 * 2. Correlated dimensions are stress-linked: if one is stressed, correlated
 *    dimensions have elevated probability of being stressed too.
 * 3. Hard-no triggers are tracked for governance escalation.
 */
export function generateScenarioVariants(
  count: number,
  baseSeed: number = Date.now()
): ScenarioVariant[] {
  const rng = seededRandom(baseSeed);
  const variants: ScenarioVariant[] = [];

  // Build a lookup map for quick correlation resolution
  const dimByKey = new Map<string, PerturbationDimension>();
  for (const d of PERTURBATION_DIMENSIONS) dimByKey.set(d.key, d);

  for (let i = 0; i < count; i++) {
    const perturbations: Record<string, string> = {};
    const deltaByDim: Record<string, number> = {};
    const stressedCategories = new Set<PerturbationCategory>();
    const hardNoTriggers: string[] = [];
    const correlationGroupsActivated: string[] = [];
    const stressFragments: string[] = [];

    // ── Pass 1: sample base severity for each dimension ──────────────────
    for (const dim of PERTURBATION_DIMENSIONS) {
      // Severity probability weights: base=40%, mild=28%, moderate=18%, severe=10%, extreme=4%
      const r = rng();
      let levelIdx: number;
      if      (r < 0.40) levelIdx = 0; // base
      else if (r < 0.68) levelIdx = 1; // mild
      else if (r < 0.86) levelIdx = 2; // moderate
      else if (r < 0.96) levelIdx = 3; // severe
      else               levelIdx = Math.min(4, dim.levels.length - 1); // extreme

      levelIdx = Math.min(levelIdx, dim.levels.length - 1);
      perturbations[dim.key] = dim.levels[levelIdx].id;
      deltaByDim[dim.key] = dim.levels[levelIdx].approvalDelta;
    }

    // ── Pass 2: apply correlation boosts ─────────────────────────────────
    for (const dim of PERTURBATION_DIMENSIONS) {
      if (!dim.correlations) continue;
      const currentLevel = dim.levels.findIndex(l => l.id === perturbations[dim.key]);
      if (currentLevel >= 2) {
        // This dimension is moderately+ stressed — boost correlated dims
        for (const corrKey of dim.correlations) {
          const corrDim = dimByKey.get(corrKey);
          if (!corrDim) continue;
          const corrLevel = corrDim.levels.findIndex(l => l.id === perturbations[corrKey]);
          if (corrLevel < currentLevel - 1) {
            // Boost correlated dimension by 1 severity level
            const newLevel = Math.min(corrLevel + 1, corrDim.levels.length - 1);
            perturbations[corrKey] = corrDim.levels[newLevel].id;
            deltaByDim[corrKey] = corrDim.levels[newLevel].approvalDelta;
            correlationGroupsActivated.push(`${dim.key}→${corrKey}`);
          }
        }
      }
    }

    // ── Pass 3: collect outputs ───────────────────────────────────────────
    let totalDelta = 0;
    let maxAbsDelta = 0;
    let dominantRisk: PerturbationCategory = "financial";

    for (const dim of PERTURBATION_DIMENSIONS) {
      const levelId = perturbations[dim.key];
      const level = dim.levels.find(l => l.id === levelId)!;
      totalDelta += level.approvalDelta;
      deltaByDim[dim.key] = level.approvalDelta;

      if (level.approvalDelta !== 0) {
        stressedCategories.add(dim.category);
        stressFragments.push(level.stressFragment);
      }
      if (level.isHardNo) {
        hardNoTriggers.push(dim.key);
      }
      if (Math.abs(level.approvalDelta) > maxAbsDelta) {
        maxAbsDelta = Math.abs(level.approvalDelta);
        dominantRisk = dim.category;
      }
    }

    variants.push({
      index: i,
      perturbations,
      totalApprovalDelta: Math.max(-1, totalDelta),
      hasHardNo: hardNoTriggers.length > 0,
      stressedCategories: Array.from(stressedCategories),
      dominantRiskCategory: dominantRisk,
      stressFragments,
      provenance: {
        seed: baseSeed + i,
        correlationGroupsActivated,
        hardNoTriggers,
      },
    });
  }

  return variants;
}

// ── Scenario Brief Builder ────────────────────────────────────────────────────

/**
 * Build the modified deal brief for a given scenario variant.
 * Appends the stress context as a clearly labelled section so the council
 * evaluates the deal under the specified conditions.
 */
export function buildScenarioBrief(
  originalDealText: string,
  variant: ScenarioVariant
): string {
  if (variant.stressFragments.length === 0) {
    return originalDealText; // base case — no mutations
  }

  const stressBlock = variant.stressFragments
    .slice(0, 8) // cap at 8 fragments to keep brief concise
    .join(" ");

  return `${originalDealText}

--- STRATEGIC STRESS SCENARIO (Simulation Index ${variant.index}) ---
The following conditions apply to this evaluation scenario:
${stressBlock}
Dominant risk category: ${variant.dominantRiskCategory.toUpperCase()}.
${variant.hasHardNo ? "NOTE: One or more hard-no governance triggers are active in this scenario." : ""}
--- END STRESS SCENARIO ---`;
}

// ── Lightweight Council Evaluator ─────────────────────────────────────────────

export interface ScenarioEvalResult {
  index: number;
  decision: "APPROVE" | "CONDITIONAL" | "REJECT";
  confidenceScore: number;
  dominantRiskCategory: PerturbationCategory;
  topBlockers: string[];
  topMitigants: string[];
  escalationTriggers: string[];
  governanceConcerns: string[];
  hasHardNo: boolean;
  approvalDelta: number;
  stressedCategories: PerturbationCategory[];
  provenance: ScenarioVariant["provenance"];
}

/**
 * Threshold beyond which the heuristic signal is unambiguous — no LLM call needed.
 * effectiveDelta >= +CONFIDENT_THRESHOLD → cheap APPROVE
 * effectiveDelta <= -CONFIDENT_THRESHOLD → cheap REJECT
 * Otherwise → spend the LLM call in the ambiguous middle band.
 */
const CONFIDENT_THRESHOLD = 0.30;

/**
 * Evaluate a single scenario variant.
 *
 * Architecture:
 *   - Hard-no triggers → deterministic REJECT (no LLM)
 *   - Unambiguous signal (|effectiveDelta| >= CONFIDENT_THRESHOLD) → cheap heuristic
 *   - Ambiguous middle band → LLM call with assembled stress brief
 *
 * baseApprovalScore reflects the deal's starting quality from the council verdict:
 *   APPROVE      →  +0.55
 *   CONDITIONAL  →  +0.20
 *   REJECT       →  -0.15
 *   (default 0.0 for backward compatibility)
 */
export async function evaluateScenario(
  variant: ScenarioVariant,
  scenarioBrief: string,
  invokeLLM: (params: { messages: Array<{ role: string; content: string }> }) => Promise<{ choices: Array<{ message: { content: string } }> }>,
  councilMode?: string,
  baseApprovalScore: number = 0.0
): Promise<ScenarioEvalResult> {
  // ── 1. Hard-no: deterministic reject, no LLM ──────────────────────────────
  if (variant.hasHardNo) {
    return {
      index: variant.index,
      decision: "REJECT",
      confidenceScore: 0.92,
      dominantRiskCategory: variant.dominantRiskCategory,
      topBlockers: variant.provenance.hardNoTriggers.map(k => `Hard-no trigger: ${k}`),
      topMitigants: [],
      escalationTriggers: variant.provenance.hardNoTriggers,
      governanceConcerns: variant.provenance.hardNoTriggers,
      hasHardNo: true,
      approvalDelta: variant.totalApprovalDelta,
      stressedCategories: variant.stressedCategories,
      provenance: variant.provenance,
    };
  }

  const delta = variant.totalApprovalDelta;
  const effectiveDelta = baseApprovalScore + delta;

  // ── 2. Cheap path: unambiguous signal ────────────────────────────────────
  if (effectiveDelta >= CONFIDENT_THRESHOLD || effectiveDelta <= -CONFIDENT_THRESHOLD) {
    let decision: "APPROVE" | "CONDITIONAL" | "REJECT";
    let confidence: number;

    if (effectiveDelta >= CONFIDENT_THRESHOLD) {
      decision = "APPROVE";
      confidence = 0.72 + Math.min(0.20, (effectiveDelta - CONFIDENT_THRESHOLD) * 0.5);
    } else {
      decision = "REJECT";
      confidence = 0.70 + Math.min(0.25, Math.abs(effectiveDelta + CONFIDENT_THRESHOLD) * 0.3);
    }

    const topBlockers = variant.stressFragments
      .filter((_, i) => i < 3)
      .map(f => f.split(".")[0]);

    return {
      index: variant.index,
      decision,
      confidenceScore: Math.min(0.97, confidence),
      dominantRiskCategory: variant.dominantRiskCategory,
      topBlockers,
      topMitigants: effectiveDelta > 0
        ? councilMode === "infrastructure"
          ? ["Base case project economics remain intact", "DSCR headroom and contracted revenue structure provide buffer"]
          : ["Base case fundamentals remain intact", "Management track record provides buffer"]
        : [],
      escalationTriggers: variant.stressedCategories.includes("governance") ? ["governance_stress"] : [],
      governanceConcerns: variant.stressedCategories.includes("governance") ? ["Governance stress detected in this scenario"] : [],
      hasHardNo: false,
      approvalDelta: delta,
      stressedCategories: variant.stressedCategories,
      provenance: variant.provenance,
    };
  }

  // ── 3. Ambiguous middle band: spend the LLM call ─────────────────────────
  // The scenarioBrief already contains the assembled stress context from
  // buildScenarioBrief(). The LLM evaluates the deal UNDER those specific
  // stress conditions, not the base case.
  let llmDecision: "APPROVE" | "CONDITIONAL" | "REJECT" = "CONDITIONAL";
  let llmConfidence = 0.65;

  try {
    const infraContext = councilMode === "infrastructure"
      ? " You are evaluating an infrastructure / project-finance deal. Apply DSCR, CfD, and contracted-revenue standards."
      : "";
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a senior investment committee analyst.${infraContext} Evaluate the deal brief below — which includes specific stress scenario conditions — and return a JSON object with exactly these fields: {"decision":"APPROVE"|"CONDITIONAL"|"REJECT","confidence":0.0-1.0,"rationale":"max 40 words"}. Terminate immediately after the closing brace.`,
        },
        {
          role: "user",
          content: scenarioBrief,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const match = raw.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (["APPROVE", "CONDITIONAL", "REJECT"].includes(parsed.decision)) {
        llmDecision = parsed.decision as "APPROVE" | "CONDITIONAL" | "REJECT";
      }
      if (typeof parsed.confidence === "number") {
        llmConfidence = Math.min(0.97, Math.max(0.50, parsed.confidence));
      }
    }
  } catch {
    // LLM call failed — fall back to heuristic for this scenario
    if (effectiveDelta >= 0) llmDecision = "CONDITIONAL";
    else llmDecision = "REJECT";
  }

  const topBlockers = variant.stressFragments
    .filter((_, i) => i < 3)
    .map(f => f.split(".")[0]);

  return {
    index: variant.index,
    decision: llmDecision,
    confidenceScore: llmConfidence,
    dominantRiskCategory: variant.dominantRiskCategory,
    topBlockers,
    topMitigants: llmDecision !== "REJECT"
      ? councilMode === "infrastructure"
        ? ["Base case project economics remain intact", "DSCR headroom and contracted revenue structure provide buffer"]
        : ["Base case fundamentals remain intact", "Management track record provides buffer"]
      : [],
    escalationTriggers: variant.stressedCategories.includes("governance") ? ["governance_stress"] : [],
    governanceConcerns: variant.stressedCategories.includes("governance") ? ["Governance stress detected in this scenario"] : [],
    hasHardNo: false,
    approvalDelta: delta,
    stressedCategories: variant.stressedCategories,
    provenance: variant.provenance,
  };
}
