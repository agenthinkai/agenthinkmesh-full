// AgenThink Decision Twin — Productized Dashboard v2
// What-If Engine · Decision Record · PDF Export · All 4 tabs
// Design: Command Intelligence Terminal — dark navy, electric cyan

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { getCompany, type ScenarioKey } from "@/lib/companyData";
import {
  computeWhatIf, DEFAULT_ASSUMPTIONS, SLIDER_DEFS,
  type WhatIfAssumptions
} from "@/lib/whatIfEngine";
import { saveDecisionRecord, loadDecisionRecords, clearDecisionRecords, formatTimestamp, scenarioLabel } from "@/lib/decisionRecord";
import { exportExecutivePDF } from "@/lib/pdfExport";
import {
  ArrowLeft, Activity, TrendingUp, TrendingDown, AlertTriangle,
  ChevronRight, BarChart3, FileDown, BookOpen, Settings2,
  Users, Target, Shield, RotateCcw, CheckCircle, XCircle, MinusCircle,
  Sliders, ClipboardList, Map
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { toast } from "sonner";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SCENARIOS: { key: ScenarioKey; label: string; color: string }[] = [
  { key: "statusQuo",         label: "Status Quo",          color: "oklch(0.55 0.01 220)" },
  { key: "aiAugmented",       label: "AI-Augmented",        color: "oklch(0.78 0.15 195)" },
  { key: "marginCompression", label: "Margin Compression",  color: "oklch(0.75 0.18 85)"  },
  { key: "growthScenario",    label: "Growth Scenario",     color: "oklch(0.72 0.18 155)" },
  { key: "competitiveThreat", label: "Competitive Threat",  color: "oklch(0.65 0.22 25)"  },
];

const TABS = [
  { id: "whatif",      label: "What-If Engine", icon: Sliders     },
  { id: "overview",   label: "Overview",        icon: BarChart3   },
  { id: "pathways",   label: "Pathways",        icon: Target      },
  { id: "assumptions",label: "Assumptions",     icon: Shield      },
  { id: "council",    label: "Council",         icon: Users       },
  { id: "ledger",     label: "Decision Ledger", icon: ClipboardList },
  { id: "roadmap",    label: "Twin Roadmap",    icon: Map         },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number, unit: string): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}T ${unit}`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}B ${unit}`;
  return `${n} ${unit}`;
}

function deltaColor(d: number) {
  if (d > 0) return "oklch(0.72 0.18 155)";
  if (d < 0) return "oklch(0.65 0.22 25)";
  return "oklch(0.50 0.01 220)";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 rounded text-xs" style={{ background: "oklch(0.18 0.02 240)", border: "1px solid oklch(0.28 0.015 240)" }}>
      <p className="mb-1" style={{ color: "oklch(0.60 0.01 220)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-medium" style={{ color: p.color || "oklch(0.78 0.15 195)" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ - (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="oklch(0.22 0.015 240)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 0.6s cubic-bezier(0.23,1,0.32,1)" }}
        />
        <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="800" fontFamily="Space Grotesk, sans-serif">{value}</text>
      </svg>
      <span className="text-xs text-center" style={{ color: "oklch(0.45 0.01 220)", fontFamily: "Space Grotesk, sans-serif" }}>{label}</span>
    </div>
  );
}

function WhatIfSlider({
  def, value, onChange
}: {
  def: typeof SLIDER_DEFS[number];
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - def.min) / (def.max - def.min)) * 100;
  const isNegative = value < 0;
  const isPositive = value > 0;
  const trackColor = isNegative ? "oklch(0.65 0.22 25)" : isPositive ? "oklch(0.72 0.18 155)" : "oklch(0.78 0.15 195)";

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold" style={{ color: "oklch(0.70 0.01 220)", fontFamily: "Space Grotesk, sans-serif" }}>
          {def.label}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{
            color: trackColor,
            background: `${trackColor.replace(")", " / 0.12)")}`,
            border: `1px solid ${trackColor.replace(")", " / 0.3)")}`,
            fontFamily: "Space Grotesk, sans-serif",
            minWidth: "52px",
            textAlign: "center",
          }}
        >
          {def.formatValue(value)}
        </span>
      </div>
      <div className="relative" style={{ height: "20px", display: "flex", alignItems: "center" }}>
        <div
          className="absolute w-full rounded-full"
          style={{ height: "4px", background: "oklch(0.22 0.015 240)" }}
        />
        <div
          className="absolute rounded-full transition-all duration-150"
          style={{
            height: "4px",
            width: `${pct}%`,
            background: trackColor,
          }}
        />
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute w-full appearance-none bg-transparent cursor-pointer"
          style={{ height: "20px" }}
        />
      </div>
      <p className="text-xs mt-1" style={{ color: "oklch(0.38 0.01 220)" }}>{def.description}</p>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function TwinDashboard() {
  const params = useParams<{ companyId: string }>();
  const [, navigate] = useLocation();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("statusQuo");
  const [activeTab, setActiveTab] = useState<TabId>("whatif");
  const [assumptions, setAssumptions] = useState<WhatIfAssumptions>(DEFAULT_ASSUMPTIONS);
  const [savedCount, setSavedCount] = useState(0);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const company = getCompany(params.companyId || "");

  const outputs = useMemo(() => {
    if (!company) return null;
    return computeWhatIf(company, activeScenario, assumptions);
  }, [company, activeScenario, assumptions]);

  const scenarioData = useMemo(() => {
    if (!company) return null;
    return company.scenarios[activeScenario];
  }, [company, activeScenario]);

  const activeScenarioMeta = SCENARIOS.find(s => s.key === activeScenario)!;

  // Auto-save decision record 2s after assumptions change
  useEffect(() => {
    if (!company || !outputs) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDecisionRecord({
        companyId: company.id,
        companyName: company.name,
        scenario: activeScenario,
        scenarioLabel: scenarioLabel(activeScenario),
        assumptions,
        outputs,
        recommendation: outputs.recommendation,
        recommendationConfidence: outputs.recommendationConfidence,
        councilSentiment: outputs.councilSentiment as string,
      });
      setSavedCount(c => c + 1);
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [assumptions, activeScenario, company, outputs]);

  const handleReset = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    toast.success("Assumptions reset to defaults");
  }, []);

  const handleExportPDF = useCallback(() => {
    if (!company || !outputs) return;
    exportExecutivePDF(company, activeScenario, assumptions, outputs);
    toast.success("Executive brief opening for print…");
  }, [company, activeScenario, assumptions, outputs]);

  const updateAssumption = useCallback(<K extends keyof WhatIfAssumptions>(key: K, value: WhatIfAssumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  }, []);

  if (!company || !outputs || !scenarioData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.115 0.018 240)" }}>
        <div className="text-center">
          <p style={{ color: "oklch(0.65 0.22 25)" }}>Company not found</p>
          <button onClick={() => navigate("/")} className="mt-4 text-sm" style={{ color: "oklch(0.78 0.15 195)" }}>
            ← Return to selector
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.115 0.018 240)" }}>
      {/* ── Top Nav ── */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "oklch(0.10 0.018 240 / 0.96)", borderBottom: "1px solid oklch(0.20 0.015 240)", backdropFilter: "blur(12px)" }}
      >
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: "oklch(0.50 0.01 220)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.78 0.15 195)")}
              onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.50 0.01 220)")}
            >
              <ArrowLeft size={14} />
              <span>All Entities</span>
            </button>
            <span style={{ color: "oklch(0.25 0.015 240)" }}>·</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full pulse-cyan" style={{ background: "oklch(0.78 0.15 195)" }} />
              <span className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>
                {company.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.78 0.15 195 / 0.1)", color: "oklch(0.78 0.15 195)", border: "1px solid oklch(0.78 0.15 195 / 0.2)" }}>
                Decision Twin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {savedCount > 0 && (
              <span className="text-xs flex items-center gap-1" style={{ color: "oklch(0.55 0.01 220)" }}>
                <CheckCircle size={11} style={{ color: "oklch(0.72 0.18 155)" }} />
                {savedCount} runs saved
              </span>
            )}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded transition-all duration-150"
              style={{ background: "oklch(0.78 0.15 195 / 0.1)", color: "oklch(0.78 0.15 195)", border: "1px solid oklch(0.78 0.15 195 / 0.25)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "oklch(0.78 0.15 195 / 0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "oklch(0.78 0.15 195 / 0.1)"; }}
            >
              <FileDown size={13} />
              Export Brief
            </button>
            <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>
              <Activity size={12} style={{ color: "oklch(0.72 0.18 155)" }} />
              <span>Public Data · {company.dataYear}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-5 flex-1">
        {/* ── Company Header ── */}
        <div className="mb-5 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "Space Grotesk, sans-serif", color: "oklch(0.95 0.008 220)" }}>
              {company.name}
            </h1>
            <p className="text-sm" style={{ color: "oklch(0.50 0.01 220)" }}>
              {company.sector} · {company.geography} · {company.employees} employees
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded text-center" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.25 0.015 240)" }}>
              <div className="text-2xl font-bold" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif" }}>{company.confidenceScore}%</div>
              <div className="text-xs mt-0.5" style={{ color: "oklch(0.40 0.01 220)" }}>Model Confidence</div>
            </div>
          </div>
        </div>

        {/* ── Scenario Selector ── */}
        <div className="mb-5 p-4 rounded" style={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.20 0.015 240)" }}>
          <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
            Active Scenario
          </div>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveScenario(s.key)}
                className="px-3 py-2 rounded text-xs font-medium transition-all duration-150"
                style={{
                  background: activeScenario === s.key ? s.color.replace(")", " / 0.15)") : "oklch(0.155 0.018 240)",
                  border: `1px solid ${activeScenario === s.key ? s.color.replace(")", " / 0.5)") : "oklch(0.22 0.015 240)"}`,
                  color: activeScenario === s.key ? s.color : "oklch(0.55 0.01 220)",
                  fontFamily: "Space Grotesk, sans-serif",
                  transform: activeScenario === s.key ? "scale(1.02)" : "scale(1)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>
            {scenarioData.scenarioDescription}
          </p>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition-all duration-150 shrink-0"
                style={{
                  background: isActive ? "oklch(0.78 0.15 195 / 0.12)" : "oklch(0.13 0.015 240)",
                  color: isActive ? "oklch(0.78 0.15 195)" : "oklch(0.45 0.01 220)",
                  border: isActive ? "1px solid oklch(0.78 0.15 195 / 0.3)" : "1px solid oklch(0.20 0.015 240)",
                  fontFamily: "Space Grotesk, sans-serif",
                }}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════
            TAB: WHAT-IF ENGINE
        ════════════════════════════════════════════ */}
        {activeTab === "whatif" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Left: Sliders */}
            <div
              className="lg:col-span-2 p-5 rounded"
              style={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.20 0.015 240)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                  <Settings2 size={12} /> Assumption Sliders
                </h2>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: "oklch(0.45 0.01 220)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.78 0.15 195)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.45 0.01 220)")}
                >
                  <RotateCcw size={11} /> Reset
                </button>
              </div>

              <style>{`
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 16px; height: 16px;
                  border-radius: 50%;
                  background: oklch(0.78 0.15 195);
                  border: 2px solid oklch(0.115 0.018 240);
                  cursor: pointer;
                  box-shadow: 0 0 6px oklch(0.78 0.15 195 / 0.5);
                  transition: box-shadow 0.15s;
                }
                input[type=range]::-webkit-slider-thumb:hover {
                  box-shadow: 0 0 12px oklch(0.78 0.15 195 / 0.8);
                }
                input[type=range]::-moz-range-thumb {
                  width: 16px; height: 16px;
                  border-radius: 50%;
                  background: oklch(0.78 0.15 195);
                  border: 2px solid oklch(0.115 0.018 240);
                  cursor: pointer;
                }
              `}</style>

              {SLIDER_DEFS.map(def => (
                <WhatIfSlider
                  key={def.key}
                  def={def}
                  value={assumptions[def.key]}
                  onChange={v => updateAssumption(def.key, v)}
                />
              ))}
            </div>

            {/* Right: Live Outputs */}
            <div className="lg:col-span-3 space-y-4">
              {/* Recommendation Banner */}
              <div
                className="p-4 rounded"
                style={{
                  background: outputs.evDelta > 10
                    ? "oklch(0.72 0.18 155 / 0.08)"
                    : outputs.evDelta < -10
                    ? "oklch(0.65 0.22 25 / 0.08)"
                    : "oklch(0.78 0.15 195 / 0.06)",
                  border: `1px solid ${outputs.evDelta > 10 ? "oklch(0.72 0.18 155 / 0.3)" : outputs.evDelta < -10 ? "oklch(0.65 0.22 25 / 0.3)" : "oklch(0.78 0.15 195 / 0.2)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.1em" }}>
                      Live Recommendation
                    </div>
                    <div className="font-bold text-sm" style={{ color: "oklch(0.92 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>
                      {outputs.recommendation}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "oklch(0.55 0.01 220)" }}>
                      {outputs.councilRationale}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif" }}>
                      {outputs.recommendationConfidence}%
                    </div>
                    <div className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>Confidence</div>
                  </div>
                </div>
              </div>

              {/* Key Metrics Row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Revenue", value: fmt(outputs.revenue, outputs.revenueUnit), delta: outputs.revenueDelta },
                  { label: "EBITDA Margin", value: `${outputs.ebitdaMargin}%`, delta: outputs.ebitdaMarginDelta },
                  { label: "Enterprise Value", value: fmt(outputs.enterpriseValue, outputs.evUnit), delta: outputs.evDelta },
                ].map(m => (
                  <div key={m.label} className="p-3 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                    <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.1em" }}>{m.label}</div>
                    <div className="text-lg font-bold" style={{ color: "oklch(0.92 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>{m.value}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {m.delta >= 0 ? <TrendingUp size={11} style={{ color: deltaColor(m.delta) }} /> : <TrendingDown size={11} style={{ color: deltaColor(m.delta) }} />}
                      <span className="text-xs font-medium" style={{ color: deltaColor(m.delta) }}>
                        {m.delta >= 0 ? "+" : ""}{m.delta}% vs base
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Score Rings */}
              <div className="p-4 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                <div className="text-xs uppercase tracking-widest mb-4" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                  Strategic Signal Scores
                </div>
                <div className="flex justify-around">
                  <ScoreRing value={outputs.aiLeverageScore} label="AI Leverage" color={outputs.aiLeverageScore >= 60 ? "oklch(0.72 0.18 155)" : outputs.aiLeverageScore >= 40 ? "oklch(0.75 0.18 85)" : "oklch(0.65 0.22 25)"} />
                  <ScoreRing value={outputs.resilienceScore} label="Resilience" color={outputs.resilienceScore >= 60 ? "oklch(0.72 0.18 155)" : outputs.resilienceScore >= 40 ? "oklch(0.75 0.18 85)" : "oklch(0.65 0.22 25)"} />
                  <ScoreRing value={outputs.growthMomentum} label="Growth Momentum" color={outputs.growthMomentum >= 60 ? "oklch(0.72 0.18 155)" : outputs.growthMomentum >= 40 ? "oklch(0.75 0.18 85)" : "oklch(0.65 0.22 25)"} />
                </div>
              </div>

              {/* Live Projection Chart */}
              <div className="p-4 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                <div className="text-xs uppercase tracking-widest mb-3" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                  Live Revenue Projection
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={outputs.projectionData}>
                    <defs>
                      <linearGradient id="liveRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeScenarioMeta.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={activeScenarioMeta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fill: "oklch(0.40 0.01 220)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "oklch(0.40 0.01 220)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke={activeScenarioMeta.color} strokeWidth={2} fill="url(#liveRevGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* EWI Alerts */}
              {outputs.earlyWarningIndicators.some(e => e.status === "alert") && (
                <div className="p-4 rounded" style={{ background: "oklch(0.65 0.22 25 / 0.06)", border: "1px solid oklch(0.65 0.22 25 / 0.25)" }}>
                  <div className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "oklch(0.65 0.22 25)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                    <AlertTriangle size={12} /> Live Assumption Alerts
                  </div>
                  <div className="space-y-2">
                    {outputs.earlyWarningIndicators.filter(e => e.status === "alert").map((ewi, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "oklch(0.65 0.22 25)" }} />
                        <span className="text-xs" style={{ color: "oklch(0.70 0.01 220)" }}>{ewi.name}: {ewi.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Pathways Live */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded" style={{ background: "oklch(0.72 0.18 155 / 0.06)", border: "1px solid oklch(0.72 0.18 155 / 0.2)" }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.72 0.18 155)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.1em" }}>
                    Top Growth Path
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>
                    {outputs.growthPathways[0]?.name ?? "—"}
                  </div>
                  <div className="text-xl font-bold" style={{ color: "oklch(0.72 0.18 155)", fontFamily: "Space Grotesk, sans-serif" }}>
                    {outputs.growthPathways[0]?.probability ?? 0}%
                  </div>
                </div>
                <div className="p-3 rounded" style={{ background: "oklch(0.65 0.22 25 / 0.06)", border: "1px solid oklch(0.65 0.22 25 / 0.2)" }}>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.65 0.22 25)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.1em" }}>
                    Top Risk Path
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>
                    {outputs.failurePathways[0]?.name ?? "—"}
                  </div>
                  <div className="text-xl font-bold" style={{ color: "oklch(0.65 0.22 25)", fontFamily: "Space Grotesk, sans-serif" }}>
                    {outputs.failurePathways[0]?.probability ?? 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: OVERVIEW
        ════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                <BarChart3 size={12} /> Six Engine Outputs · {activeScenarioMeta.label}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Revenue", e: scenarioData.engines.revenue },
                  { label: "Margin", e: scenarioData.engines.margin },
                  { label: "Geography", e: scenarioData.engines.geography },
                  { label: "AI Impact", e: scenarioData.engines.aiImpact },
                  { label: "Pricing", e: scenarioData.engines.pricing },
                  { label: "Enterprise Value", e: scenarioData.engines.enterpriseValue },
                ].map(({ label, e }) => (
                  <div key={label} className="p-4 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                    <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.1em" }}>{label}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold" style={{ color: activeScenarioMeta.color, fontFamily: "Space Grotesk, sans-serif" }}>{e.value}</span>
                      <span className="text-sm" style={{ color: "oklch(0.45 0.01 220)" }}>{e.unit}</span>
                    </div>
                    {e.delta !== undefined && (
                      <div className="flex items-center gap-1 mt-1">
                        {e.delta >= 0 ? <TrendingUp size={12} style={{ color: deltaColor(e.delta) }} /> : <TrendingDown size={12} style={{ color: deltaColor(e.delta) }} />}
                        <span className="text-xs" style={{ color: deltaColor(e.delta) }}>
                          {e.delta >= 0 ? "+" : ""}{e.delta}% vs base
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                <h3 className="text-xs uppercase tracking-widest mb-4" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>Revenue Projection (5-Year)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={scenarioData.projectionData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeScenarioMeta.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={activeScenarioMeta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fill: "oklch(0.40 0.01 220)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "oklch(0.40 0.01 220)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke={activeScenarioMeta.color} strokeWidth={2} fill="url(#revGrad)" />
                    <Area type="monotone" dataKey="ebitda" name="EBITDA" stroke="oklch(0.72 0.18 155)" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                <h3 className="text-xs uppercase tracking-widest mb-4" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>EV Impact by Scenario</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={company.scenarioComparison} layout="vertical">
                    <XAxis type="number" tick={{ fill: "oklch(0.40 0.01 220)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="scenario" tick={{ fill: "oklch(0.55 0.01 220)", fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="evChange" name="EV Change %" radius={[0, 3, 3, 0]}>
                      {company.scenarioComparison.map((entry, i) => (
                        <Cell key={i} fill={entry.evChange >= 0 ? "oklch(0.72 0.18 155)" : "oklch(0.65 0.22 25)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Early Warning Indicators */}
            <div className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
              <h3 className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                <AlertTriangle size={12} /> Early Warning Indicators
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {outputs.earlyWarningIndicators.map((ewi, i) => {
                  const statusColors = { safe: "oklch(0.72 0.18 155)", watch: "oklch(0.75 0.18 85)", alert: "oklch(0.65 0.22 25)" };
                  const c = statusColors[ewi.status];
                  return (
                    <div key={i} className="p-3 rounded" style={{ background: "oklch(0.13 0.015 240)", border: `1px solid ${c.replace(")", " / 0.2)")}` }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: "oklch(0.80 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>{ewi.name}</span>
                        <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: c, background: `${c.replace(")", " / 0.1)")}`, border: `1px solid ${c.replace(")", " / 0.25)")}` }}>
                          {ewi.status}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "oklch(0.55 0.01 220)" }}>{ewi.description}</p>
                      <p className="text-xs mt-1" style={{ color: "oklch(0.38 0.01 220)" }}>Monitor: {ewi.frequency}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: PATHWAYS
        ════════════════════════════════════════════ */}
        {activeTab === "pathways" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "oklch(0.72 0.18 155)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                <TrendingUp size={12} /> Growth Pathways
              </h2>
              <div className="space-y-4">
                {outputs.growthPathways.map((p, i) => (
                  <div key={i} className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                    <div className="flex items-start justify-between mb-3 gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase px-2 py-0.5 rounded mb-2 inline-block" style={{ background: "oklch(0.72 0.18 155 / 0.1)", color: "oklch(0.72 0.18 155)", border: "1px solid oklch(0.72 0.18 155 / 0.25)" }}>Growth</span>
                        <h3 className="font-semibold" style={{ fontFamily: "Space Grotesk, sans-serif", color: "oklch(0.92 0.008 220)" }}>{p.name}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold" style={{ color: "oklch(0.72 0.18 155)", fontFamily: "Space Grotesk, sans-serif" }}>{p.probability}%</div>
                        <div className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>Probability</div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "oklch(0.60 0.01 220)" }}>{p.description}</p>
                    <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid oklch(0.22 0.015 240)" }}>
                      <span className="text-xs uppercase tracking-wider" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Driven by:</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "oklch(0.78 0.15 195 / 0.1)", color: "oklch(0.78 0.15 195)", border: "1px solid oklch(0.78 0.15 195 / 0.25)" }}>{SLIDER_DEFS.find(s => s.key === p.driver)?.label ?? p.driver}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "oklch(0.65 0.22 25)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                <TrendingDown size={12} /> Failure Pathways
              </h2>
              <div className="space-y-4">
                {outputs.failurePathways.map((p, i) => (
                  <div key={i} className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                    <div className="flex items-start justify-between mb-3 gap-4">
                      <div>
                        <span className="text-xs font-bold uppercase px-2 py-0.5 rounded mb-2 inline-block" style={{ background: "oklch(0.65 0.22 25 / 0.1)", color: "oklch(0.65 0.22 25)", border: "1px solid oklch(0.65 0.22 25 / 0.25)" }}>Risk</span>
                        <h3 className="font-semibold" style={{ fontFamily: "Space Grotesk, sans-serif", color: "oklch(0.92 0.008 220)" }}>{p.name}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold" style={{ color: "oklch(0.65 0.22 25)", fontFamily: "Space Grotesk, sans-serif" }}>{p.probability}%</div>
                        <div className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>Probability</div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "oklch(0.60 0.01 220)" }}>{p.description}</p>
                    <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid oklch(0.22 0.015 240)" }}>
                      <span className="text-xs uppercase tracking-wider" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Driven by:</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "oklch(0.65 0.22 25 / 0.1)", color: "oklch(0.65 0.22 25)", border: "1px solid oklch(0.65 0.22 25 / 0.25)" }}>{SLIDER_DEFS.find(s => s.key === p.driver)?.label ?? p.driver}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: ASSUMPTIONS
        ════════════════════════════════════════════ */}
        {activeTab === "assumptions" && (
          <div className="space-y-4">
            <div className="p-4 rounded mb-2" style={{ background: "oklch(0.78 0.15 195 / 0.05)", border: "1px solid oklch(0.78 0.15 195 / 0.2)" }}>
              <p className="text-sm" style={{ color: "oklch(0.70 0.01 220)" }}>
                <span className="font-semibold" style={{ color: "oklch(0.78 0.15 195)" }}>Critical Assumptions:</span>{" "}
                These are the beliefs the model depends on. If the most dangerous assumption fails, the entire strategy collapses.
              </p>
            </div>
            {company.criticalAssumptions.map((a, i) => (
              <div key={i} className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: `1px solid ${a.isMostDangerous ? "oklch(0.65 0.22 25 / 0.4)" : "oklch(0.22 0.015 240)"}` }}>
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: "oklch(0.22 0.015 240)", color: "oklch(0.60 0.01 220)", fontFamily: "Space Grotesk, sans-serif" }}>{i + 1}</span>
                    <h3 className="font-semibold" style={{ fontFamily: "Space Grotesk, sans-serif", color: "oklch(0.92 0.008 220)" }}>
                      {a.name}
                      {a.isMostDangerous && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.65 0.22 25 / 0.15)", color: "oklch(0.65 0.22 25)", border: "1px solid oklch(0.65 0.22 25 / 0.3)" }}>
                          MOST DANGEROUS
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold" style={{ color: a.isMostDangerous ? "oklch(0.65 0.22 25)" : "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif" }}>{a.confidence}%</div>
                    <div className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>Confidence</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.60 0.01 220)" }}>{a.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3" style={{ borderTop: "1px solid oklch(0.22 0.015 240)" }}>
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>If This Assumption Fails</p>
                    <p className="text-sm" style={{ color: "oklch(0.65 0.01 220)" }}>{a.failureConsequence}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Historical Precedent</p>
                    <p className="text-sm" style={{ color: "oklch(0.65 0.01 220)" }}>{a.historicalFailure}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: COUNCIL
        ════════════════════════════════════════════ */}
        {activeTab === "council" && (
          <div className="space-y-4">
            <div className="p-4 rounded mb-2" style={{ background: "oklch(0.78 0.15 195 / 0.05)", border: "1px solid oklch(0.78 0.15 195 / 0.2)" }}>
              <p className="text-sm" style={{ color: "oklch(0.70 0.01 220)" }}>
                <span className="font-semibold" style={{ color: "oklch(0.78 0.15 195)" }}>Council Review:</span>{" "}
                Four independent strategic perspectives applying adversarial scrutiny. Disagreements identify the highest-uncertainty zones.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {outputs.councilMembers.map((m, i) => {
                const verdictColor = m.verdict === "Support" ? "oklch(0.72 0.18 155)" : m.verdict === "Oppose" ? "oklch(0.65 0.22 25)" : "oklch(0.75 0.18 85)";
                const VerdictIcon = m.verdict === "Support" ? CheckCircle : m.verdict === "Oppose" ? XCircle : MinusCircle;
                return (
                  <div key={i} className="p-5 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-sm" style={{ fontFamily: "Space Grotesk, sans-serif", color: "oklch(0.92 0.008 220)" }}>{m.persona}</h3>
                        <p className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>{m.role}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded font-medium" style={{ background: `${verdictColor.replace(")", " / 0.12)")}`, color: verdictColor, border: `1px solid ${verdictColor.replace(")", " / 0.3)")}` }}>
                        <VerdictIcon size={11} /> {m.verdict}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "oklch(0.60 0.01 220)" }}>{m.assumptionReaction}</p>
                    <div className="p-3 rounded" style={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.20 0.015 240)" }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Key Concern</p>
                      <p className="text-sm" style={{ color: "oklch(0.70 0.01 220)" }}>{m.keyConcern}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>Confidence</span>
                      <div className="flex items-center gap-2">
                        <div className="rounded-full overflow-hidden" style={{ width: "80px", height: "4px", background: "oklch(0.22 0.015 240)" }}>
                          <div className="h-full rounded-full" style={{ width: `${m.confidence}%`, background: verdictColor }} />
                        </div>
                        <span className="text-xs" style={{ color: "oklch(0.55 0.01 220)" }}>{m.confidence}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-6 rounded mt-2" style={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.78 0.15 195 / 0.3)" }}>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
                <ChevronRight size={14} /> Final Recommendation
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.70 0.01 220)" }}>{company.finalRecommendation.text}</p>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1.5 rounded text-sm font-semibold" style={{ background: "oklch(0.78 0.15 195 / 0.12)", color: "oklch(0.78 0.15 195)", border: "1px solid oklch(0.78 0.15 195 / 0.3)", fontFamily: "Space Grotesk, sans-serif" }}>
                  {company.finalRecommendation.verdict}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>Confidence:</span>
                  <span className="text-sm font-bold" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif" }}>{company.finalRecommendation.confidence}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: DECISION LEDGER
        ════════════════════════════════════════════ */}
        {activeTab === "ledger" && <DecisionLedgerTab companyId={company.id} />}

        {/* ════════════════════════════════════════════
            TAB: TWIN ROADMAP
        ════════════════════════════════════════════ */}
        {activeTab === "roadmap" && <TwinRoadmapTab />}
      </div>

      <div className="container py-4 mt-4" style={{ borderTop: "1px solid oklch(0.18 0.015 240)" }}>
        <p className="text-xs" style={{ color: "oklch(0.28 0.01 220)" }}>
          AgenThink Mesh Decision Twin v1 · Public data only · {company.dataYear} · Framework validated across 5 industries
        </p>
      </div>
    </div>
  );
}

// ─── DECISION LEDGER TAB ──────────────────────────────────────────────────────

function DecisionLedgerTab({ companyId }: { companyId: string }) {
  const [records, setRecords] = useState(() => loadDecisionRecords().filter((r: any) => r.companyId === companyId));

  const handleClear = () => {
    clearDecisionRecords();
    setRecords([]);
    toast.success("Decision ledger cleared");
  };

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen size={40} style={{ color: "oklch(0.30 0.01 220)" }} className="mb-4" />
        <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.50 0.01 220)", fontFamily: "Space Grotesk, sans-serif" }}>No simulations recorded yet</p>
        <p className="text-xs" style={{ color: "oklch(0.35 0.01 220)" }}>Adjust sliders in the What-If Engine to auto-save runs</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
          <ClipboardList size={12} /> Outcome Ledger — {records.length} Simulation{records.length !== 1 ? "s" : ""}
        </h2>
        <button
          onClick={handleClear}
          className="text-xs px-3 py-1.5 rounded transition-colors"
          style={{ color: "oklch(0.65 0.22 25)", border: "1px solid oklch(0.65 0.22 25 / 0.3)", background: "oklch(0.65 0.22 25 / 0.06)" }}
        >
          Clear All
        </button>
      </div>

      <div className="space-y-3">
        {records.map((r: any) => (
          <div key={r.id} className="p-4 rounded" style={{ background: "oklch(0.155 0.018 240)", border: "1px solid oklch(0.22 0.015 240)" }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif" }}>{r.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.22 0.015 240)", color: "oklch(0.55 0.01 220)" }}>{r.scenarioLabel}</span>
                </div>
                <p className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>{formatTimestamp(r.timestamp)}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ color: r.outputs.evDelta >= 0 ? "oklch(0.72 0.18 155)" : "oklch(0.65 0.22 25)", fontFamily: "Space Grotesk, sans-serif" }}>
                  EV {r.outputs.evDelta >= 0 ? "+" : ""}{r.outputs.evDelta}%
                </div>
                <div className="text-xs" style={{ color: "oklch(0.40 0.01 220)" }}>{r.councilSentiment}</div>
              </div>
            </div>
            <div className="text-xs mb-3" style={{ color: "oklch(0.60 0.01 220)" }}>{r.recommendation}</div>
            <div className="grid grid-cols-4 gap-2 pt-2" style={{ borderTop: "1px solid oklch(0.20 0.015 240)" }}>
              {[
                ["AI Adopt", `${r.assumptions.aiAdoption}%`],
                ["Mkt Share", `${r.assumptions.marketShare > 0 ? "+" : ""}${r.assumptions.marketShare}pp`],
                ["Pricing", `${r.assumptions.pricingPower > 0 ? "+" : ""}${r.assumptions.pricingPower}%`],
                ["Cost Infl", `${r.assumptions.costInflation}%`],
              ].map(([label, val]) => (
                <div key={label} className="text-center">
                  <div className="text-xs" style={{ color: "oklch(0.38 0.01 220)" }}>{label}</div>
                  <div className="text-xs font-semibold" style={{ color: "oklch(0.65 0.01 220)", fontFamily: "Space Grotesk, sans-serif" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TWIN ROADMAP TAB ─────────────────────────────────────────────────────────

function TwinRoadmapTab() {
  const layers = [
    {
      id: "decision",
      label: "Decision Twin",
      status: "live",
      statusLabel: "LIVE NOW",
      color: "oklch(0.78 0.15 195)",
      icon: "⬡",
      description: "Public data intelligence layer. Generates strategic scenarios, pathway analysis, and council review from public information alone. No client data required.",
      capabilities: ["5-scenario simulation", "6-engine output model", "What-If assumption engine", "Decision Record / Outcome Ledger", "Executive PDF export", "Early warning indicators"],
      input: "Company name",
      output: "Strategic intelligence brief",
    },
    {
      id: "operating",
      label: "Operating Twin",
      status: "next",
      statusLabel: "PHASE 2",
      color: "oklch(0.72 0.18 155)",
      icon: "⬡",
      description: "Operational data integration layer. Connects to internal KPIs, financial systems, and operational metrics to calibrate the Decision Twin with real company data.",
      capabilities: ["ERP / financial data ingestion", "Real-time KPI calibration", "Variance analysis vs. public benchmarks", "Operational scenario modeling", "Department-level impact modeling", "Management dashboard"],
      input: "Internal KPIs + financial data",
      output: "Calibrated operational model",
    },
    {
      id: "digital",
      label: "Digital Twin",
      status: "future",
      statusLabel: "PHASE 3",
      color: "oklch(0.75 0.18 85)",
      icon: "⬡",
      description: "Full digital replica of the organization. Real-time simulation of business processes, market dynamics, and competitive responses. The organization as a living model.",
      capabilities: ["Real-time process simulation", "Competitive response modeling", "Customer behavior modeling", "Supply chain simulation", "Regulatory impact modeling", "Board-level scenario planning"],
      input: "Full enterprise data streams",
      output: "Living organizational model",
    },
    {
      id: "ledger",
      label: "Outcome Ledger",
      status: "future",
      statusLabel: "PHASE 4",
      color: "oklch(0.65 0.22 25)",
      icon: "⬡",
      description: "Prediction validation and learning layer. Tracks every strategic decision made in the twin against real-world outcomes. The model learns and improves from results.",
      capabilities: ["Decision tracking vs. outcomes", "Model accuracy scoring", "Prediction confidence calibration", "Strategic learning loops", "Board accountability records", "Institutional memory"],
      input: "Decisions + real-world outcomes",
      output: "Self-improving strategic model",
    },
  ];

  const statusStyles: Record<string, { bg: string; border: string; badge: string; badgeBg: string }> = {
    live: { bg: "oklch(0.78 0.15 195 / 0.06)", border: "oklch(0.78 0.15 195 / 0.35)", badge: "oklch(0.78 0.15 195)", badgeBg: "oklch(0.78 0.15 195 / 0.12)" },
    next: { bg: "oklch(0.72 0.18 155 / 0.05)", border: "oklch(0.72 0.18 155 / 0.25)", badge: "oklch(0.72 0.18 155)", badgeBg: "oklch(0.72 0.18 155 / 0.10)" },
    future: { bg: "oklch(0.155 0.018 240)", border: "oklch(0.22 0.015 240)", badge: "oklch(0.45 0.01 220)", badgeBg: "oklch(0.22 0.015 240)" },
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: "oklch(0.40 0.01 220)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
          <Map size={12} /> Digital Twin Architecture Roadmap
        </h2>
        <p className="text-sm" style={{ color: "oklch(0.55 0.01 220)" }}>
          The four-layer evolution from public intelligence to a self-improving organizational model.
        </p>
      </div>

      {/* Architecture flow */}
      <div className="relative">
        {layers.map((layer, i) => {
          const s = statusStyles[layer.status];
          return (
            <div key={layer.id} className="relative">
              {/* Connector line */}
              {i < layers.length - 1 && (
                <div
                  className="absolute left-6 z-10"
                  style={{
                    top: "100%",
                    width: "2px",
                    height: "24px",
                    background: `linear-gradient(to bottom, ${layer.color}, ${layers[i + 1].color})`,
                    opacity: 0.4,
                  }}
                />
              )}

              <div
                className="mb-6 p-5 rounded"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <div className="flex items-start gap-4">
                  {/* Layer number */}
                  <div
                    className="w-12 h-12 rounded flex items-center justify-center text-lg font-bold shrink-0"
                    style={{ background: `${layer.color.replace(")", " / 0.12)")}`, color: layer.color, border: `1px solid ${layer.color.replace(")", " / 0.3)")}`, fontFamily: "Space Grotesk, sans-serif" }}
                  >
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold text-base" style={{ fontFamily: "Space Grotesk, sans-serif", color: "oklch(0.92 0.008 220)" }}>
                        {layer.label}
                      </h3>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                        style={{ color: s.badge, background: s.badgeBg, border: `1px solid ${s.badge.replace(")", " / 0.3)")}` }}
                      >
                        {layer.statusLabel}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.60 0.01 220)" }}>
                      {layer.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Capabilities</p>
                        <div className="grid grid-cols-2 gap-1">
                          {layer.capabilities.map((cap, j) => (
                            <div key={j} className="flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full shrink-0" style={{ background: layer.color }} />
                              <span className="text-xs" style={{ color: "oklch(0.60 0.01 220)" }}>{cap}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Input</p>
                          <p className="text-xs font-medium" style={{ color: layer.color }}>{layer.input}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "oklch(0.40 0.01 220)", letterSpacing: "0.1em" }}>Output</p>
                          <p className="text-xs font-medium" style={{ color: "oklch(0.70 0.01 220)" }}>{layer.output}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Architecture principle */}
      <div
        className="p-5 rounded mt-2"
        style={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.78 0.15 195 / 0.2)" }}
      >
        <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: "oklch(0.78 0.15 195)", fontFamily: "Space Grotesk, sans-serif", letterSpacing: "0.12em" }}>
          Architecture Principle
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm" style={{ color: "oklch(0.60 0.01 220)" }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: "oklch(0.80 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>No ERP Integration Required</p>
            <p>Each layer adds value independently. A CEO can use the Decision Twin today with zero internal data. Calibration improves accuracy but is never a prerequisite.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "oklch(0.80 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>Progressive Accuracy</p>
            <p>The model starts at 70–80% accuracy using public data and industry benchmarks. Each layer of internal data adds 5–10 percentage points of precision.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "oklch(0.80 0.008 220)", fontFamily: "Space Grotesk, sans-serif" }}>Outcome-Driven Learning</p>
            <p>The Outcome Ledger closes the loop. Every prediction is tracked against reality. The model improves with every decision cycle, creating compounding institutional intelligence.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
