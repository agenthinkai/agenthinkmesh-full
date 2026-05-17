import ProspectDemoPage, { ProspectConfig } from "./ProspectDemoPage";

const config: ProspectConfig = {
  slug: "kia",
  firmName: "Kuwait Investment Authority",
  firmTagline: "Kuwait Investment Authority",
  logoUrl: "/manus-storage/kia_993372c8.png",
  logoAlt: "Kuwait Investment Authority (KIA)",
  accentColor: "bg-amber-500/10",
  accentText: "text-amber-300",
  accentBorder: "border-amber-400/30",
  dealType: "Sovereign Portfolio Rebalance — Geopolitical Stress Scenario",
  dealSubtitle: "Oil correlation stress test · USD-peg exposure · Macro + geopolitical scenario modelling",
  councilMode: "gcc",
  councilEmphasis: ["GCC Macro", "Geopolitical Risk", "Challenger Agent", "Concentration Risk"],
  memoRef: "IC-KIA-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  scenario: [
    { label: "Portfolio Type", value: "Sovereign Wealth" },
    { label: "Stress Scenario", value: "Oil Correlation" },
    { label: "FX Exposure", value: "USD-Peg Risk" },
    { label: "Horizon", value: "5-Year Rebalance" },
    { label: "Geography", value: "Global / GCC" },
    { label: "Council Mode", value: "GCC Institutional" },
  ],
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 61,
  overallSummary:
    "The stress scenario models a sustained oil price decline to $55/bbl combined with a USD-peg defence episode, creating a dual-shock environment for GCC sovereign portfolios. Under this scenario, the portfolio's implicit oil beta (estimated 0.68 through GCC equity and fixed income allocations) generates a projected drawdown of 14–18% of NAV. Council recommends a phased rebalance toward non-correlated assets (developed market equities, gold, infrastructure) to reduce oil beta below 0.45 within 18 months. The rebalance is operationally feasible but requires careful sequencing to avoid market impact on illiquid GCC positions.",
  agentOutputs: [
    {
      id: "Agent 1 — GCC Macro Oracle",
      verdict: "WATCH",
      confidence: 59,
      summary:
        "The $55/bbl stress scenario is a 2-standard-deviation event based on trailing 10-year Brent volatility. Probability of occurrence within 24 months: approximately 12% (Goldman Sachs commodity desk consensus). However, the scenario's portfolio impact is asymmetric — a 35% oil price decline generates a 14–18% NAV drawdown due to second-order effects on GCC fiscal spending, equity valuations, and real estate. The tail risk justifies pre-emptive rebalancing even at low probability.",
      flags: ["Oil price stress: $55/bbl (2SD event, ~12% probability)", "Second-order GCC fiscal impact amplifies drawdown"],
    },
    {
      id: "Agent 2 — Geopolitical Watch",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 64,
      summary:
        "USD-peg defence episodes (Kuwait 1990, Saudi 2015–2016) historically consume 8–15% of FX reserves over 12–18 months. Kuwait's current FX reserves ($45B) provide approximately 14 months of peg defence capacity at 2015-equivalent burn rate. The rebalance should prioritise reducing USD-denominated fixed income exposure (currently estimated at 38% of portfolio) to limit peg-defence amplification risk.",
      flags: ["USD-peg defence capacity: ~14 months at 2015 burn rate", "USD fixed income: 38% of portfolio — elevated"],
    },
    {
      id: "Agent 3 — Concentration Risk",
      verdict: "WATCH",
      confidence: 57,
      summary:
        "Implicit oil beta of 0.68 across the portfolio represents a structural concentration risk that is not visible in standard asset class allocation tables. GCC equities (direct and indirect), GCC fixed income, and real estate collectively account for 54% of portfolio NAV — all positively correlated with oil at 0.6–0.8. Effective diversification is materially lower than the nominal 40+ asset class breakdown suggests.",
      flags: ["Implicit oil beta: 0.68 (target: <0.45)", "GCC-correlated assets: 54% of NAV"],
    },
    {
      id: "Agent 4 — Challenger Agent",
      verdict: "CONDITIONAL ENGAGE",
      confidence: 60,
      summary:
        "The rebalance thesis assumes developed market equities provide non-correlated diversification. However, in a global risk-off scenario triggered by oil price collapse, DM equity correlations with GCC assets historically spike from 0.3 to 0.7+ within 30 days (2008, 2015, 2020 data). Gold and infrastructure show more durable non-correlation. The rebalance should overweight gold (target: 8–10% of portfolio) and infrastructure (target: 12–15%) rather than DM equities.",
      flags: ["DM equity correlation spikes to 0.7+ in risk-off", "Gold and infrastructure preferred for non-correlation"],
    },
    {
      id: "Agent 5 — GCC Regulatory Analyst",
      verdict: "ENGAGE",
      confidence: 76,
      summary:
        "The proposed rebalance is within KIA's statutory investment mandate (Law No. 47 of 1982, as amended). No regulatory pre-approval is required for asset class reallocation within existing mandate parameters. Cross-border capital flows from GCC to developed markets are unrestricted for sovereign wealth funds under GCC central bank frameworks. Reporting obligations to the Ministry of Finance remain unchanged.",
      flags: [],
    },
  ],
  ctaHeading: "Run your own sovereign stress scenario",
  ctaSubheading: "Paste any portfolio allocation, stress scenario brief, or geopolitical risk memo into the Mesh. Council output in under 60 seconds.",
  preloadedDealText: `Sovereign Portfolio Rebalance — Geopolitical Stress Scenario
Portfolio: Sovereign Wealth Fund | Horizon: 5-Year Rebalance

Stress Scenario:
- Oil price: sustained decline to $55/bbl (2SD event, ~12% probability)
- USD-peg defence episode: 12–18 month duration
- Dual-shock environment: oil revenue decline + FX reserve drawdown

Current Portfolio Exposure:
- Implicit oil beta: 0.68 (target: <0.45)
- GCC-correlated assets: 54% of NAV
- USD-denominated fixed income: 38% of portfolio
- Gold allocation: 3% (target: 8–10%)
- Infrastructure: 6% (target: 12–15%)

Rebalance Objective:
Reduce oil beta from 0.68 to below 0.45 within 18 months.
Increase non-correlated assets (gold, infrastructure, DM alternatives).
Maintain USD-peg defence capacity above 12-month threshold.

Council emphasis: GCC macro · Geopolitical risk · Challenger · Concentration`,
};

export default function KiaDemo() {
  return <ProspectDemoPage config={config} />;
}
