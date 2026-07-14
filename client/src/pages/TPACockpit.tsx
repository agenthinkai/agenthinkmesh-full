import { useState, useMemo, useCallback } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Lock,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  ChevronRight,
} from "lucide-react";
import {
  computePortfolioMetrics,
  autoBalance,
  DEFAULT_ALLOCATION,
  REGIME_META,
  FACTOR_COLORS,
  type Allocation,
  type AssetClass,
  type MacroRegime,
  type PortfolioMode,
  type FactorName,
} from "../lib/tpaEngine";

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <button className="inline-flex items-center justify-center ml-1 text-slate-400 hover:text-cyan-400 transition-colors">
            <Info size={13} />
          </button>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            className="z-50 max-w-xs rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur px-3 py-2 text-xs text-slate-200 shadow-xl"
            sideOffset={6}
          >
            {content}
            <RadixTooltip.Arrow className="fill-slate-900" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_LABELS: Record<AssetClass, string> = {
  publicEquities: "Public Equities",
  fixedIncome: "Fixed Income",
  privateEquity: "Private Equity",
  infrastructure: "Infrastructure / RE",
  privateCredit: "Private Credit",
};

const ASSET_COLORS: Record<AssetClass, string> = {
  publicEquities: "#3b82f6",
  fixedIncome: "#22c55e",
  privateEquity: "#a855f7",
  infrastructure: "#f59e0b",
  privateCredit: "#06b6d4",
};

const TOOLTIPS: Record<string, string> = {
  TPA: "Total Portfolio Approach: Evaluates every investment based on its marginal contribution to the total fund's factor exposures, rather than rigid asset-class buckets.",
  LDI: "Liability-Driven Investment: Focuses on matching asset cash flows to the present value of future pension obligations.",
  "Sharia AAOIFI":
    "Validates debt underlying structures against AAOIFI ledger parameters. Conventional interest-bearing instruments must be replaced with Sukuk equivalents.",
  "SFDR Art.8":
    "Ensures compliance with European sustainability reporting standards. Funds must promote environmental or social characteristics.",
  "Sovereign Hedge Coefficient":
    "Measures how well the portfolio hedges against declining sovereign commodity revenues. Higher is better for oil-dependent SWFs.",
  "Funding Ratio":
    "Assets divided by the present value of liabilities. A ratio above 100% means the fund is fully funded. Sensitive to interest rate movements.",
  "Tracking Error":
    "Annualised standard deviation of the active return vs. a 60/40 benchmark. Higher tracking error = more active risk being taken.",
};

const REGIME_ICONS: Record<MacroRegime, React.ReactNode> = {
  baseline: <TrendingUp size={18} />,
  stagflation: <Flame size={18} />,
  commoditiesCollapse: <TrendingDown size={18} />,
  creditSqueeze: <Lock size={18} />,
};

// ─────────────────────────────────────────────────────────────────────────────
// METRIC BADGE
// ─────────────────────────────────────────────────────────────────────────────

function MetricBadge({
  label,
  value,
  unit,
  tooltipKey,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  tooltipKey?: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center px-4 py-2 rounded-xl border backdrop-blur-sm"
      style={{
        borderColor: `${color}40`,
        background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
      }}
    >
      <div className="flex items-center gap-1 text-xs text-slate-400 font-medium uppercase tracking-wider">
        {label}
        {tooltipKey && TOOLTIPS[tooltipKey] && (
          <InfoTooltip content={TOOLTIPS[tooltipKey]} />
        )}
      </div>
      <div className="text-2xl font-bold mt-0.5" style={{ color }}>
        {value}
        <span className="text-sm font-normal ml-0.5 text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLOCATION SLIDER
// ─────────────────────────────────────────────────────────────────────────────

function AllocationSlider({
  assetKey,
  value,
  color,
  onChange,
}: {
  assetKey: AssetClass;
  value: number;
  color: string;
  onChange: (key: AssetClass, val: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-300 font-medium">
          {ASSET_LABELS[assetKey]}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-800">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-150"
          style={{ width: `${value}%`, background: color }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(e) => onChange(assetKey, parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IC VERDICT PANEL
// ─────────────────────────────────────────────────────────────────────────────

function ICVerdictPanel({
  verdict,
  alerts,
}: {
  verdict: "Approved" | "Conditional Watchlist" | "Vetoed";
  alerts: string[];
}) {
  const config = {
    Approved: {
      icon: <CheckCircle size={20} />,
      color: "#22c55e",
      glow: "shadow-[0_0_16px_#22c55e40]",
      bg: "from-green-950/60 to-transparent",
      border: "border-green-800/50",
    },
    "Conditional Watchlist": {
      icon: <AlertTriangle size={20} />,
      color: "#f59e0b",
      glow: "shadow-[0_0_16px_#f59e0b40]",
      bg: "from-amber-950/60 to-transparent",
      border: "border-amber-800/50",
    },
    Vetoed: {
      icon: <XCircle size={20} />,
      color: "#ef4444",
      glow: "shadow-[0_0_16px_#ef444440]",
      bg: "from-red-950/60 to-transparent",
      border: "border-red-800/50",
    },
  }[verdict];

  return (
    <div
      className={`rounded-xl border p-4 bg-gradient-to-br ${config.bg} ${config.border} ${config.glow}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: config.color }}>{config.icon}</span>
        <span className="font-bold text-sm uppercase tracking-wider" style={{ color: config.color }}>
          IC Verdict: {verdict}
        </span>
      </div>
      {alerts.length === 0 ? (
        <p className="text-xs text-slate-400">
          Portfolio passes all Investment Committee governance gates. No active alerts.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-300">
              <ChevronRight size={12} className="mt-0.5 shrink-0 text-amber-400" />
              <span>{alert}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIME CARD
// ─────────────────────────────────────────────────────────────────────────────

function RegimeCard({
  regime,
  active,
  onClick,
  volDelta,
}: {
  regime: MacroRegime;
  active: boolean;
  onClick: () => void;
  volDelta: number;
}) {
  const meta = REGIME_META[regime];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
        active
          ? "shadow-[0_0_20px_var(--glow)]"
          : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600"
      }`}
      style={
        active
          ? {
              borderColor: `${meta.color}80`,
              background: `linear-gradient(135deg, ${meta.color}20 0%, transparent 100%)`,
              ["--glow" as string]: `${meta.color}40`,
            }
          : {}
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: meta.color }}>{REGIME_ICONS[regime]}</span>
        <span className="text-xs font-bold text-slate-200">{meta.label}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{meta.description}</p>
      {active && volDelta !== 0 && (
        <div className="mt-2 text-xs font-semibold" style={{ color: meta.color }}>
          Vol impact: {volDelta > 0 ? "+" : ""}
          {volDelta.toFixed(1)}pp
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COCKPIT
// ─────────────────────────────────────────────────────────────────────────────

export default function TPACockpit() {
  const [allocation, setAllocation] = useState<Allocation>(DEFAULT_ALLOCATION);
  const [mode, setMode] = useState<PortfolioMode>("swf");
  const [regime, setRegime] = useState<MacroRegime>("baseline");
  const [esgScore] = useState(7);
  const [shariaCompliant] = useState(false);
  const [simulated, setSimulated] = useState(false);

  const handleSliderChange = useCallback(
    (key: AssetClass, val: number) => {
      setAllocation((prev) => autoBalance(prev, key, val));
    },
    []
  );

  const metrics = useMemo(
    () =>
      computePortfolioMetrics(allocation, mode, regime, esgScore, shariaCompliant),
    [allocation, mode, regime, esgScore, shariaCompliant]
  );

  const radarData = useMemo(() => {
    const factors: FactorName[] = ["Growth", "Inflation", "Rates", "Liquidity", "Leverage"];
    return factors.map((f) => ({
      factor: f,
      exposure: parseFloat((metrics.factorExposure[f] * 100).toFixed(1)),
      fullMark: 100,
    }));
  }, [metrics.factorExposure]);

  const activeVol =
    regime === "baseline"
      ? metrics.volatility
      : parseFloat((metrics.volatility + metrics.regimeShock.portfolioVolatilityDelta).toFixed(2));

  const activeSHC =
    regime === "baseline"
      ? metrics.sovereignHedgeCoefficient
      : Math.max(0, Math.min(100, metrics.sovereignHedgeCoefficient + metrics.regimeShock.sovereignHedgeDelta));

  const activeFR =
    regime === "baseline"
      ? metrics.fundingRatio
      : Math.max(0, metrics.fundingRatio + metrics.regimeShock.fundingRatioDelta);

  function handleExport() {
    const title = document.title;
    document.title = "TPA_Cockpit_Board_Brief";
    window.print();
    document.title = title;
  }

  const totalAlloc = Object.values(allocation).reduce((s, v) => s + v, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Print-only styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-500">
                AgenThink Mesh
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-400">
                TPA Cockpit
                <InfoTooltip content={TOOLTIPS["TPA"]} />
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight mt-0.5">
              Sovereign Total Portfolio Steering Twin
            </h1>
          </div>

          {/* Mode Toggle */}
          <div className="no-print flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 p-1">
            {(["swf", "pension"] as PortfolioMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  mode === m
                    ? "bg-cyan-600 text-white shadow-[0_0_12px_#0891b240]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m === "swf" ? "Sovereign Wealth Fund (SWF)" : "Pension Fund"}
              </button>
            ))}
          </div>

          {/* Metric Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <MetricBadge
              label="Net Vol"
              value={activeVol}
              unit="%"
              color="#3b82f6"
            />
            {mode === "swf" ? (
              <MetricBadge
                label="Sovereign Hedge"
                value={activeSHC}
                unit="%"
                tooltipKey="Sovereign Hedge Coefficient"
                color="#22c55e"
              />
            ) : (
              <MetricBadge
                label="Funding Ratio"
                value={activeFR}
                unit="%"
                tooltipKey="Funding Ratio"
                color="#a855f7"
              />
            )}
            <MetricBadge
              label="Tracking Error"
              value={metrics.trackingError}
              unit="%"
              tooltipKey="Tracking Error"
              color="#f59e0b"
            />
          </div>
        </div>
      </header>

      {/* ── THREE-COLUMN BODY ── */}
      <main className="max-w-[1600px] mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT: ALLOCATION SLIDERS ── */}
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Strategic Asset Allocation
              </h2>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  Math.abs(totalAlloc - 100) < 0.2
                    ? "bg-green-900/50 text-green-400"
                    : "bg-red-900/50 text-red-400"
                }`}
              >
                {totalAlloc.toFixed(1)}%
              </span>
            </div>

            <div className="space-y-5">
              {(Object.keys(ASSET_LABELS) as AssetClass[]).map((key) => (
                <AllocationSlider
                  key={key}
                  assetKey={key}
                  value={allocation[key]}
                  color={ASSET_COLORS[key]}
                  onChange={handleSliderChange}
                />
              ))}
            </div>

            {/* Allocation bar */}
            <div className="mt-5 h-3 rounded-full overflow-hidden flex">
              {(Object.keys(ASSET_LABELS) as AssetClass[]).map((key) => (
                <div
                  key={key}
                  style={{
                    width: `${allocation[key]}%`,
                    background: ASSET_COLORS[key],
                    transition: "width 0.15s ease",
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {(Object.keys(ASSET_LABELS) as AssetClass[]).map((key) => (
                <div key={key} className="flex items-center gap-1 text-xs text-slate-400">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: ASSET_COLORS[key] }}
                  />
                  {ASSET_LABELS[key]}
                </div>
              ))}
            </div>

            <button
              onClick={() => setSimulated(true)}
              className="no-print mt-5 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-all duration-200 shadow-[0_0_16px_#0891b240] hover:shadow-[0_0_24px_#0891b260]"
            >
              Run Scenario Simulation
            </button>
            {simulated && (
              <p className="mt-2 text-xs text-center text-green-400">
                ✓ Simulation complete — metrics updated
              </p>
            )}
          </div>

          {/* Mandate Settings */}
          <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
              Mandate Settings
            </h2>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>
                  ESG Score
                  <InfoTooltip content={TOOLTIPS["SFDR Art.8"]} />
                </span>
                <span className="text-cyan-400 font-bold">{esgScore}/10</span>
              </div>
              <div className="flex justify-between">
                <span>
                  Sharia Compliance
                  <InfoTooltip content={TOOLTIPS["Sharia AAOIFI"]} />
                </span>
                <span className={shariaCompliant ? "text-green-400 font-bold" : "text-slate-500"}>
                  {shariaCompliant ? "AAOIFI Mandated" : "Not Required"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  LDI Mode
                  <InfoTooltip content={TOOLTIPS["LDI"]} />
                </span>
                <span className={mode === "pension" ? "text-purple-400 font-bold" : "text-slate-500"}>
                  {mode === "pension" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── CENTER: FACTOR RADAR + IC ── */}
        <section className="space-y-5">
          {/* Factor Radar */}
          <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Factor Concentration
                <InfoTooltip content={TOOLTIPS["TPA"]} />
              </h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis
                  dataKey="factor"
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 80]}
                  tick={{ fill: "#475569", fontSize: 9 }}
                  tickCount={4}
                />
                <Radar
                  name="Exposure (%)"
                  dataKey="exposure"
                  stroke="#06b6d4"
                  fill="#06b6d4"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, "Exposure"]}
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Factor legend */}
            <div className="grid grid-cols-5 gap-1 mt-1">
              {(Object.keys(FACTOR_COLORS) as FactorName[]).map((f) => (
                <div key={f} className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-xs font-bold"
                    style={{ color: FACTOR_COLORS[f] }}
                  >
                    {(metrics.factorExposure[f] * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-500">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* IC Verdict */}
          <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
              Simulated Investment Committee
            </h2>
            <ICVerdictPanel
              verdict={metrics.icVerdict}
              alerts={metrics.icAlerts}
            />
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            className="no-print w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:border-cyan-700 hover:bg-slate-800/60 text-sm text-slate-300 hover:text-white transition-all duration-200"
          >
            <Download size={15} />
            Export Board Brief (PDF)
          </button>
        </section>

        {/* ── RIGHT: REGIME + CAPITAL CALLS ── */}
        <section className="space-y-5">
          {/* Macro Regime Selectors */}
          <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
              Macro Regime Stress Test
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(["baseline", "stagflation", "commoditiesCollapse", "creditSqueeze"] as MacroRegime[]).map(
                (r) => (
                  <RegimeCard
                    key={r}
                    regime={r}
                    active={regime === r}
                    onClick={() => setRegime(r)}
                    volDelta={metrics.regimeShock.portfolioVolatilityDelta}
                  />
                )
              )}
            </div>

            {regime !== "baseline" && (
              <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300">Active Regime: </span>
                {metrics.regimeShock.description}
              </div>
            )}
          </div>

          {/* Capital Call Projections */}
          <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-1">
              Capital Call Projections
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              24-month private asset cash flow horizon ($M)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={metrics.capitalCallSeries}
                margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
              >
                <defs>
                  <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  tickFormatter={(v) => `M${v}`}
                />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v: number, name: string) => [
                    `$${v.toFixed(1)}M`,
                    name === "calls" ? "Capital Calls" : "Distributions",
                  ]}
                  labelFormatter={(l) => `Month ${l}`}
                />
                <Legend
                  formatter={(v) =>
                    v === "calls" ? (
                      <span className="text-xs text-red-400">Capital Calls</span>
                    ) : (
                      <span className="text-xs text-green-400">Distributions</span>
                    )
                  }
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="#ef4444"
                  fill="url(#callGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="distributions"
                  stroke="#22c55e"
                  fill="url(#distGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Regime impact summary */}
          {regime !== "baseline" && (
            <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Vol Δ</div>
                <div className="text-lg font-bold text-red-400 mt-0.5">
                  +{metrics.regimeShock.portfolioVolatilityDelta.toFixed(1)}pp
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  {mode === "swf" ? "SHC Δ" : "FR Δ"}
                </div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">
                  {mode === "swf"
                    ? `${metrics.regimeShock.sovereignHedgeDelta}pp`
                    : `${metrics.regimeShock.fundingRatioDelta}pp`}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Severity</div>
                <div
                  className="text-lg font-bold mt-0.5"
                  style={{ color: REGIME_META[regime].color }}
                >
                  {regime === "creditSqueeze"
                    ? "HIGH"
                    : regime === "stagflation"
                    ? "HIGH"
                    : "MED"}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
