// Bakalaria Digital Twin — Cockpit UI
// Matches the Warba Bank / TPA Cockpit format:
// Dark glassmorphic theme · Sticky header with metric badges · Scenario selector
// IC Verdict panel · P&L table · Covenant tracker · Tranche cards · Board Brief export

import { useState, useMemo } from "react";
import { BakalariaCouncilPanel } from "@/components/BakalariaCouncilPanel";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  CheckCircle, AlertTriangle, XCircle, ChevronRight, Download,
  TrendingUp, TrendingDown, Minus, Info,
} from "lucide-react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import {
  computeBakalariaMetrics,
  HISTORICAL,
  SCENARIOS,
  DEFAULT_SCENARIO_ID,
  type YearlyProjection,
  type ICVerdict,
  type CovenantStatus,
  type TrancheSummary,
} from "@/lib/bakalariaEngine";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fKD(v: number, decimals = 3): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "(" : "";
  const end = v < 0 ? ")" : "";
  if (abs >= 1_000_000) return `${sign}KD ${(abs / 1_000_000).toFixed(decimals)}M${end}`;
  if (abs >= 1_000) return `${sign}KD ${(abs / 1_000).toFixed(0)}K${end}`;
  return `${sign}KD ${abs.toFixed(0)}${end}`;
}

function fKDShort(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}KD ${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}KD ${(abs / 1_000).toFixed(0)}K`;
  return `${sign}KD ${abs.toFixed(0)}`;
}

// ─── INFO TOOLTIP ─────────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <button className="inline-flex items-center justify-center ml-1 text-slate-400 hover:text-cyan-400 transition-colors">
            <Info size={12} />
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

// ─── METRIC BADGE ─────────────────────────────────────────────────────────────

function MetricBadge({
  label, value, sub, color = "#22d3ee", tooltip,
}: {
  label: string; value: string; sub?: string; color?: string; tooltip?: string;
}) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur min-w-[90px]">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5 flex items-center gap-0.5">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-slate-500 mt-0.5">{sub}</span>}
    </div>
  );
}

// ─── IC VERDICT PANEL ─────────────────────────────────────────────────────────

function ICVerdictPanel({ verdict }: { verdict: ICVerdict }) {
  const config = {
    "Approved — Proceed with Covenant Holiday": {
      icon: <CheckCircle size={18} />,
      color: "#22c55e",
      glow: "shadow-[0_0_16px_#22c55e40]",
      bg: "from-green-950/60 to-transparent",
      border: "border-green-800/50",
    },
    "Conditional — Watchlist M1–M16": {
      icon: <AlertTriangle size={18} />,
      color: "#f59e0b",
      glow: "shadow-[0_0_16px_#f59e0b40]",
      bg: "from-amber-950/60 to-transparent",
      border: "border-amber-800/50",
    },
    Vetoed: {
      icon: <XCircle size={18} />,
      color: "#ef4444",
      glow: "shadow-[0_0_16px_#ef444440]",
      bg: "from-red-950/60 to-transparent",
      border: "border-red-800/50",
    },
    "High Risk — Covenant Holiday + Force Majeure Clause": {
      icon: <AlertTriangle size={18} />,
      color: "#f97316",
      glow: "shadow-[0_0_16px_#f9731640]",
      bg: "from-orange-950/60 to-transparent",
      border: "border-orange-700/50",
    },
    "Approved — Accelerated Drawdown": {
      icon: <CheckCircle size={18} />,
      color: "#06b6d4",
      glow: "shadow-[0_0_16px_#06b6d440]",
      bg: "from-cyan-950/60 to-transparent",
      border: "border-cyan-800/50",
    },
  }[verdict.verdict] ?? {
    icon: <AlertTriangle size={18} />,
    color: "#94a3b8",
    glow: "",
    bg: "from-slate-900/60 to-transparent",
    border: "border-slate-700/50",
  };

  return (
    <div className={`rounded-xl border p-4 bg-gradient-to-br ${config.bg} ${config.border} ${config.glow}`}>
      {/* Verdict header */}
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: config.color }}>{config.icon}</span>
        <span className="font-bold text-sm uppercase tracking-wider" style={{ color: config.color }}>
          IC Verdict: {verdict.verdict}
        </span>
        <span className="ml-auto text-xs text-slate-400 font-mono">{verdict.confidencePct}% confidence</span>
      </div>

      {/* The Bet */}
      <p className="text-xs text-slate-300 italic mb-3 border-l-2 pl-2" style={{ borderColor: config.color }}>
        THE BET: {verdict.theBet}
      </p>

      <div className="grid grid-cols-1 gap-3">
        {/* For lending */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-green-400 mb-1.5 font-semibold">3 Reasons to Lend</p>
          <ul className="space-y-1.5">
            {verdict.forLending.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-300">
                <TrendingUp size={11} className="mt-0.5 shrink-0 text-green-400" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Against lending */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1.5 font-semibold">3 Reasons NOT to Lend</p>
          <ul className="space-y-1.5">
            {verdict.againstLending.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-300">
                <TrendingDown size={11} className="mt-0.5 shrink-0 text-red-400" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What changes decision */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1.5 font-semibold">What Would Change the Decision</p>
          <ul className="space-y-1.5">
            {verdict.whatChangesDecision.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-300">
                <ChevronRight size={11} className="mt-0.5 shrink-0 text-amber-400" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── SCENARIO CARD ────────────────────────────────────────────────────────────

function ScenarioCard({
  id, name, tag, active, conf, onClick,
}: {
  id: string; name: string; tag: string; active: boolean;
  conf: string; onClick: () => void;
}) {
  const confColor = {
    High: "#22c55e", "Moderate-High": "#22d3ee",
    Moderate: "#f59e0b", Exploratory: "#a855f7",
  }[conf] ?? "#94a3b8";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
        active
          ? "border-cyan-500/60 bg-gradient-to-br from-cyan-950/60 to-transparent shadow-[0_0_18px_#06b6d440]"
          : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-200">{name}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
          style={{ color: confColor, borderColor: `${confColor}50`, background: `${confColor}15` }}>
          {conf}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 italic">{tag}</p>
    </button>
  );
}

// ─── COVENANT ROW ─────────────────────────────────────────────────────────────

function CovenantRow({ cov }: { cov: CovenantStatus }) {
  const statusConfig = {
    breach: { color: "#ef4444", icon: <XCircle size={13} />, label: "Breach (M1–M16)" },
    watch: { color: "#f59e0b", icon: <AlertTriangle size={13} />, label: "Watch — resolves M17" },
    clean: { color: "#22c55e", icon: <CheckCircle size={13} />, label: "Clean" },
  }[cov.status];

  return (
    <tr className="border-b border-slate-800/50">
      <td className="py-2 pr-3 text-xs text-slate-300 font-medium">{cov.metric}</td>
      <td className="py-2 pr-3 text-xs text-slate-400 font-mono">{cov.threshold}</td>
      <td className="py-2 pr-3 text-xs font-mono text-amber-300">{cov.month17}</td>
      <td className="py-2 pr-3 text-xs font-mono text-cyan-300">{cov.month24}</td>
      <td className="py-2 pr-3 text-xs font-mono text-green-300">{cov.month48}</td>
      <td className="py-2">
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: statusConfig.color }}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </td>
    </tr>
  );
}

// ─── TRANCHE CARD ─────────────────────────────────────────────────────────────

function TrancheCard({ t }: { t: TrancheSummary }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
        <span className="text-xs font-bold text-slate-200">{t.name}</span>
        <span className="ml-auto text-xs font-mono font-bold" style={{ color: t.color }}>
          {fKD(t.limitKD, 0)}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-1">{t.purpose}</p>
      <p className="text-[11px] text-slate-500 mb-1">{t.structure} · {t.rateLabel}</p>
      <p className="text-[11px] font-semibold" style={{ color: t.color }}>Month 48: {t.statusMonth48}</p>
    </div>
  );
}

// ─── MAIN COCKPIT ─────────────────────────────────────────────────────────────

export default function BakalariaTwin() {
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO_ID);
  const [facilityKD, setFacilityKD] = useState(1_000_000);

  const metrics = useMemo(() => computeBakalariaMetrics(scenarioId, facilityKD), [scenarioId, facilityKD]);
  const { scenario, projections, tranches, covenants, icVerdict } = metrics;

  // Combined historical + projected for charts
  const allYears: (YearlyProjection & { isHistorical: boolean })[] = [
    ...HISTORICAL.map(h => ({ ...h, isHistorical: true })),
    ...projections.map(p => ({ ...p, isHistorical: false })),
  ];

  const revenueChartData = allYears.map(y => ({
    year: y.year,
    revenue: parseFloat((y.revenueKD / 1_000_000).toFixed(3)),
    ebitda: parseFloat((y.ebitdaKD / 1_000_000).toFixed(3)),
    isHistorical: y.isHistorical,
  }));

  const mooChartData = allYears.map(y => ({
    year: y.year,
    moo: y.moo,
    isHistorical: y.isHistorical,
  }));

  function handleExport() {
    const title = document.title;
    document.title = `Bakalaria_Digital_Twin_Board_Brief_${new Date().toISOString().slice(0, 10)}`;
    window.print();
    document.title = title;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl no-print">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-500">
                AgenThink · Decision Twin
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-sm font-bold text-slate-100">Bakalaria</span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-400">B2B/B2C Food Distribution · Kuwait · KD {(facilityKD/1_000_000).toFixed(2)}M Facility</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Seeded from verified 2023–2025 audited baselines · 48-month pro-forma · All values in KD
            </p>
          </div>

          {/* Live metric badges */}
          <div className="flex flex-wrap gap-2">
            <MetricBadge
              label="2025 Revenue" value="KD 2.44M"
              sub="Baseline" color="#94a3b8"
              tooltip="Verified 2025 operating baseline — 3-year revenue contraction from KD 3.13M"
            />
            <MetricBadge
              label="2029 Target" value="KD 48.78M"
              sub="20× target" color="#22d3ee"
              tooltip="20× revenue target driven by MOO growth from 1,297 to 7,500+ outlets"
            />
            <MetricBadge
              label="Cum. FCF" value="KD 7.08M"
              sub="48 months" color="#22c55e"
              tooltip="Cumulative free cash flow over 48 months — 7× return on the KD 1M facility"
            />
            <MetricBadge
              label="DSCR M48" value="41.92×"
              sub="Min: 1.20×" color="#22c55e"
              tooltip="Debt Service Coverage Ratio at month 48. Covenant minimum is 1.20×. Breach in months 1–16 is a ramp-up artefact."
            />
            <MetricBadge
              label="Breach Period" value="M1–M16"
              sub="Resolves M17" color="#f59e0b"
              tooltip="DSCR covenant breach during ramp-up phase. Clears at month 17 (May 2027) at 1.74×."
            />
          </div>

          {/* Facility Size Slider */}
          <div className="flex flex-col gap-1 no-print min-w-[180px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Facility Size</span>
              <span className="text-xs font-bold font-mono text-cyan-400">KD {(facilityKD/1_000).toFixed(0)}K</span>
            </div>
            <input
              type="range"
              min={500_000}
              max={2_000_000}
              step={50_000}
              value={facilityKD}
              onChange={e => setFacilityKD(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#22d3ee' }}
            />
            <div className="flex justify-between text-[9px] text-slate-600">
              <span>KD 500K</span><span>KD 2.0M</span>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-slate-300 hover:border-cyan-600 hover:text-cyan-300 transition-colors"
          >
            <Download size={13} />
            Board Brief
          </button>
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <div className="max-w-[1600px] mx-auto px-4 py-6 grid grid-cols-1 xl:grid-cols-[280px_1fr_320px] gap-6">

        {/* ── LEFT: SCENARIO SELECTOR ── */}
        <aside className="space-y-4 no-print">
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-semibold">
              Scenario
            </h3>
            <div className="space-y-2">
              {Object.values(SCENARIOS).map(s => (
                <ScenarioCard
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  tag={s.tag}
                  conf={s.conf}
                  active={scenarioId === s.id}
                  onClick={() => setScenarioId(s.id)}
                />
              ))}
            </div>
          </div>

          {/* Scenario recommendation */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-1.5 font-semibold">
              Recommendation
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">{scenario.rec}</p>
          </div>

          {/* Actions */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1.5 font-semibold">
              Immediate Actions
            </p>
            <ul className="space-y-1.5">
              {scenario.actions.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300">
                  <ChevronRight size={11} className="mt-0.5 shrink-0 text-amber-400" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── CENTRE: CHARTS + P&L TABLE ── */}
        <main className="space-y-5 min-w-0">

          {/* Overview text */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Bakalaria is a B2B/B2C food distribution platform in Kuwait with{" "}
              <strong className="text-slate-100">1,297 active monthly order outlets</strong> and{" "}
              <strong className="text-slate-100">87.4% outlet retention</strong> — product-market fit is proven.
              Revenue has contracted from KD 3.13M (2023) to KD 2.44M (2025).
              The <strong className="text-cyan-400">20× growth target</strong> requires MOO to reach 7,500+ outlets by 2029,
              driving revenue to KD 48.78M and EBITDA to KD 7.887M.
              The KD 1M bank facility is the catalyst — not the constraint.
              The DSCR breach in months 1–16 is a{" "}
              <strong className="text-amber-400">known ramp-up artefact</strong>, not a structural problem.
            </p>
          </div>

          {/* Revenue + EBITDA chart */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Revenue & EBITDA — 2023 Historical → 2029 Target
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueChartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={v => `KD ${v}M`} />
                <RechartsTooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v: number, name: string) => [
                    `KD ${v.toFixed(3)}M`,
                    name === "revenue" ? "Revenue" : "EBITDA",
                  ]}
                />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                  {revenueChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isHistorical ? "#475569" : "#1A7A6E"} />
                  ))}
                </Bar>
                <Bar dataKey="ebitda" name="EBITDA" radius={[4, 4, 0, 0]}>
                  {revenueChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.ebitda >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#475569] inline-block" /> Historical</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#1A7A6E] inline-block" /> Projected Revenue</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#22c55e] inline-block" /> Positive EBITDA</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#ef4444] inline-block" /> Negative EBITDA</span>
            </div>
          </div>

          {/* MOO growth chart */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Monthly Active Order Outlets (MOO) — The Critical Driver
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={mooChartData}>
                <defs>
                  <linearGradient id="mooGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickFormatter={v => v.toLocaleString()} />
                <RechartsTooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v: number) => [v.toLocaleString(), "MOO"]}
                />
                <Area type="monotone" dataKey="moo" stroke="#22d3ee" strokeWidth={2.5}
                  fill="url(#mooGrad)" dot={{ fill: "#22d3ee", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* P&L Summary Table */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 overflow-x-auto">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              P&L Summary — 2023 Historical → 2029 Target (All values in KD)
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-3 text-slate-400 font-medium">Year</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">Revenue</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">GM%</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">Gross Profit</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">Payroll</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">Logistics</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">EBITDA</th>
                  <th className="text-right py-2 pr-3 text-slate-400 font-medium">MOO</th>
                  <th className="text-right py-2 text-slate-400 font-medium">DSCR</th>
                </tr>
              </thead>
              <tbody>
                {HISTORICAL.map(h => (
                  <tr key={h.year} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3 text-slate-400 font-mono">{h.year} <span className="text-[10px] text-slate-600">hist.</span></td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{fKD(h.revenueKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-400">{h.grossMarginPct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{fKD(h.grossProfitKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-400">{fKD(h.payrollKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-400">{fKD(h.logisticsKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-red-400">{fKD(h.ebitdaKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-300">{h.moo.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-slate-500">—</td>
                  </tr>
                ))}
                {projections.map((p, i) => (
                  <tr key={p.year} className={`border-b border-slate-800/50 ${i === projections.length - 1 ? "bg-cyan-950/20" : ""}`}>
                    <td className="py-2 pr-3 font-mono text-cyan-300">{p.year} <span className="text-[10px] text-slate-500">proj.</span></td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-200 font-semibold">{fKD(p.revenueKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-cyan-300">{p.grossMarginPct.toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-200">{fKD(p.grossProfitKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-400">{fKD(p.payrollKD)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-400">{fKD(p.logisticsKD)}</td>
                    <td className={`py-2 pr-3 text-right font-mono font-semibold ${p.ebitdaKD >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fKD(p.ebitdaKD)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-cyan-300">{p.moo.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-green-300">{p.dscr.toFixed(2)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Covenant Tracker */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 overflow-x-auto">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Covenant Tracker — KD 1M Facility
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-3 text-slate-400 font-medium">Metric</th>
                  <th className="text-left py-2 pr-3 text-slate-400 font-medium">Threshold</th>
                  <th className="text-right py-2 pr-3 text-amber-400 font-medium">Month 17</th>
                  <th className="text-right py-2 pr-3 text-cyan-400 font-medium">Month 24</th>
                  <th className="text-right py-2 pr-3 text-green-400 font-medium">Month 48</th>
                  <th className="text-left py-2 text-slate-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {covenants.map((c, i) => <CovenantRow key={i} cov={c} />)}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-500 mt-2 italic">
              * DSCR breach in months 1–16 is a ramp-up artefact. Recommend pre-negotiating a covenant holiday with formal waiver documentation for this period.
            </p>
          </div>

        </main>

        {/* ── RIGHT: IC VERDICT + TRANCHES ── */}
        <aside className="space-y-4">

          {/* IC Verdict */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-semibold">
              Investment Committee
            </h3>
            <ICVerdictPanel verdict={icVerdict} />
          </div>

          {/* Facility Summary */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 font-semibold">
              KD 1,000,000 Bank Facility
            </h3>
            <div className="space-y-2">
              {tranches.map((t, i) => <TrancheCard key={i} t={t} />)}
            </div>
          </div>

          {/* Key milestones */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 mb-3 font-semibold">
              Key Milestones
            </h3>
            <div className="space-y-2.5">
              {[
                { month: "M6", label: "Tranche C deployed", color: "#94a3b8", detail: "KD 100K AI platform" },
                { month: "M7", label: "Tranche B amortisation begins", color: "#f59e0b", detail: "KD 13,095/month" },
                { month: "M17", label: "DSCR covenant cleared", color: "#22c55e", detail: "1.74× — clean" },
                { month: "M24", label: "DSCR 6.17×", color: "#22c55e", detail: "Well above covenant" },
                { month: "M48", label: "Tranche B fully repaid", color: "#22d3ee", detail: "KD 0 balance" },
                { month: "M48", label: "Cumulative FCF", color: "#22d3ee", detail: "KD 7.076M" },
              ].map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0"
                    style={{ color: m.color, borderColor: `${m.color}50`, background: `${m.color}15` }}>
                    {m.month}
                  </span>
                  <div>
                    <p className="text-xs text-slate-300">{m.label}</p>
                    <p className="text-[10px] text-slate-500">{m.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Council of 8 Specialist Agents */}
          <BakalariaCouncilPanel
            scenarioId={scenarioId}
            scenarioLabel={SCENARIOS[scenarioId]?.name ?? scenarioId}
          />

          {/* Data sources */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">Data Sources</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              2023–2025 baselines: verified audited/operational data.
              Pro-forma 2026–2029: 48-month simulation seeded from verified baselines.
              Bank facility: KD 1M structured corporate debt (Tranche A/B/C).
              All values in Kuwaiti Dinars (KD).
            </p>
            <p className="text-[10px] text-slate-600 mt-1.5">
              Generated by AgenThink AI · Bakalaria Digital Twin v1.0
            </p>
          </div>

        </aside>
      </div>
    </div>
  );
}
