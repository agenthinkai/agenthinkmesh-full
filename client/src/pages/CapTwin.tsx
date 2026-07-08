import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LP_REGISTRY, type LimitedPartner, type FundStrategy } from "@/lib/lpRegistry";
import { runSimulation, computeFitScore, type FundParams } from "@/lib/capTwinEngine";
import { runComplianceCheck } from "@/lib/regInterceptor";
import { simulateIC, saveDecisionLedgerEntry, loadDecisionLedger } from "@/lib/capTwinAgents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constants ─────────────────────────────────────────────────────────────────

const STRATEGIES: FundStrategy[] = [
  "Infrastructure",
  "Private Equity",
  "Private Credit",
  "Real Estate",
  "Growth Equity",
  "Venture Capital",
  "Hedge Fund",
];

const DEFAULT_PARAMS: FundParams = {
  targetCapital: 500,
  managementFee: 1.75,
  carry: 20,
  trackRecord: 8,
  velocityLever: 50,
  placementAgent: false,
  strategy: "Private Equity",
  priorIRR: 14,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function verdictColor(verdict: string) {
  if (verdict === "Approved") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (verdict === "Conditional Watchlist") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-red-500/20 text-red-300 border-red-500/40";
}

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}

function complianceBadge(passed: boolean) {
  return passed
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : "bg-red-500/20 text-red-300 border-red-500/40";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CapTwin() {
  const [params, setParams] = useState<FundParams>(DEFAULT_PARAMS);
  const [selectedLPId, setSelectedLPId] = useState<string>(LP_REGISTRY[0].id);
  const [activeTab, setActiveTab] = useState("cockpit");
  const [savedToLedger, setSavedToLedger] = useState(false);

  const selectedLP: LimitedPartner = LP_REGISTRY.find((lp) => lp.id === selectedLPId)!;

  // ── Deterministic computations ─────────────────────────────────────────────
  const simulation = useMemo(() => runSimulation(params), [params]);
  const fitResult = useMemo(() => computeFitScore(params, selectedLP), [params, selectedLP]);
  const icResult = useMemo(() => simulateIC(params, selectedLP, fitResult), [params, selectedLP, fitResult]);
  const compliance = useMemo(
    () => runComplianceCheck(icResult.tailoredPitch, params, selectedLP),
    [icResult.tailoredPitch, params, selectedLP]
  );
  const ledger = useMemo(() => loadDecisionLedger(), [savedToLedger]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function updateParam<K extends keyof FundParams>(key: K, value: FundParams[K]) {
    setParams((p) => ({ ...p, [key]: value }));
    setSavedToLedger(false);
  }

  function handleSaveToLedger() {
    saveDecisionLedgerEntry({
      lpId: selectedLP.id,
      strategy: params.strategy,
      fitScore: fitResult.score,
      icVerdict: icResult.icVerdict,
    });
    setSavedToLedger(true);
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = simulation.timeSeries.map((d) => ({
    month: `M${d.month}`,
    "Gross Raised": d.cumulativeRaised,
    "Net AUM": d.netAUM,
    "Fee Drag": d.cumulativeFees,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 font-sans">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#0d1426] px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Capital Formation Digital Twin
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic LP simulation · Compliance gate · Adversarial IC · Auto-calibration
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
            CapTwin v1.0 · AgenThinkMesh
          </Badge>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-5">

          {/* ── LEFT PANEL: Controls ─────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-3 space-y-4">

            {/* Fund Parameters */}
            <Card className="bg-[#0d1426] border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300">Fund Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Strategy */}
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Strategy</label>
                  <Select
                    value={params.strategy}
                    onValueChange={(v) => updateParam("strategy", v as FundStrategy)}
                  >
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200 text-sm h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {STRATEGIES.map((s) => (
                        <SelectItem key={s} value={s} className="text-slate-200 text-sm">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Capital */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-slate-400">Target Capital</label>
                    <span className="text-xs text-white font-mono">${params.targetCapital}M</span>
                  </div>
                  <Slider
                    min={50} max={5000} step={50}
                    value={[params.targetCapital]}
                    onValueChange={([v]) => updateParam("targetCapital", v)}
                    className="[&>span]:bg-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>$50M</span><span>$5,000M</span>
                  </div>
                </div>

                {/* Management Fee */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-slate-400">Management Fee</label>
                    <span className="text-xs text-white font-mono">{params.managementFee.toFixed(2)}%</span>
                  </div>
                  <Slider
                    min={0.5} max={2.5} step={0.05}
                    value={[params.managementFee]}
                    onValueChange={([v]) => updateParam("managementFee", v)}
                    className="[&>span]:bg-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>0.50%</span><span>2.50%</span>
                  </div>
                </div>

                {/* Track Record */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-slate-400">GP Track Record</label>
                    <span className="text-xs text-white font-mono">{params.trackRecord} yrs</span>
                  </div>
                  <Slider
                    min={1} max={25} step={1}
                    value={[params.trackRecord]}
                    onValueChange={([v]) => updateParam("trackRecord", v)}
                    className="[&>span]:bg-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>1 yr</span><span>25 yrs</span>
                  </div>
                </div>

                {/* Prior IRR */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-slate-400">Prior Fund Net IRR</label>
                    <span className="text-xs text-white font-mono">{params.priorIRR}%</span>
                  </div>
                  <Slider
                    min={0} max={35} step={0.5}
                    value={[params.priorIRR]}
                    onValueChange={([v]) => updateParam("priorIRR", v)}
                    className="[&>span]:bg-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>0%</span><span>35%</span>
                  </div>
                </div>

                {/* Velocity Lever */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-slate-400">Fundraising Velocity</label>
                    <span className="text-xs text-white font-mono">{params.velocityLever}/100</span>
                  </div>
                  <Slider
                    min={0} max={100} step={5}
                    value={[params.velocityLever]}
                    onValueChange={([v]) => updateParam("velocityLever", v)}
                    className="[&>span]:bg-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>Slow</span><span>Aggressive</span>
                  </div>
                </div>

                {/* Placement Agent */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400">Placement Agent</label>
                  <button
                    onClick={() => updateParam("placementAgent", !params.placementAgent)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      params.placementAgent ? "bg-blue-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        params.placementAgent ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {params.placementAgent && (
                  <p className="text-[10px] text-amber-400">+25% velocity · 2% commission drag</p>
                )}
              </CardContent>
            </Card>

            {/* LP Selector */}
            <Card className="bg-[#0d1426] border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-300">Target LP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {LP_REGISTRY.map((lp) => (
                  <button
                    key={lp.id}
                    onClick={() => setSelectedLPId(lp.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedLPId === lp.id
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-200">{lp.name}</span>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400 px-1.5 py-0">
                        {lp.region}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">{lp.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] text-slate-400">${lp.ticketMin}M–${lp.ticketMax}M</span>
                      {lp.shariaRequired && (
                        <span className="text-[10px] text-amber-400">Sharia</span>
                      )}
                      <span className="text-[10px] text-slate-500">ESG {lp.esgPriority}/10</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── CENTER + RIGHT PANELS ────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-9">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-900 border border-slate-800 mb-4">
                <TabsTrigger value="cockpit" className="text-xs data-[state=active]:bg-slate-700">
                  Executive Cockpit
                </TabsTrigger>
                <TabsTrigger value="simulation" className="text-xs data-[state=active]:bg-slate-700">
                  S-Curve Simulation
                </TabsTrigger>
                <TabsTrigger value="ic" className="text-xs data-[state=active]:bg-slate-700">
                  IC Simulation
                </TabsTrigger>
                <TabsTrigger value="compliance" className="text-xs data-[state=active]:bg-slate-700">
                  Compliance Gate
                </TabsTrigger>
                <TabsTrigger value="ledger" className="text-xs data-[state=active]:bg-slate-700">
                  Decision Ledger
                </TabsTrigger>
              </TabsList>

              {/* ── TAB 1: Executive Cockpit ─────────────────────────────── */}
              <TabsContent value="cockpit">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Gross Raised (M24)", value: `$${simulation.grossRaised.toFixed(0)}M`, sub: `of $${params.targetCapital}M target` },
                    { label: "Net Investable AUM", value: `$${simulation.netAUM.toFixed(0)}M`, sub: `after fee & commission drag` },
                    { label: "Est. Final Close", value: `Month ${simulation.estimatedCloseMonth}`, sub: `at 90% of target` },
                    { label: "LP Fit Score", value: `${fitResult.score}/100`, sub: icResult.icVerdict, scoreVal: fitResult.score },
                  ].map((kpi) => (
                    <Card key={kpi.label} className="bg-[#0d1426] border-slate-800">
                      <CardContent className="pt-4 pb-3">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-bold font-mono ${kpi.scoreVal !== undefined ? scoreColor(kpi.scoreVal) : "text-white"}`}>
                          {kpi.value}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{kpi.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Fundraising Health Score */}
                <Card className="bg-[#0d1426] border-slate-800 mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">Fundraising Health Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Strategy Fit", value: fitResult.strategyFit, max: 100 },
                        { label: "Pedigree Fit", value: fitResult.pedigreeFit, max: 100 },
                        { label: "Fee Alignment", value: fitResult.feeAlignment, max: 100 },
                      ].map((metric) => (
                        <div key={metric.label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs text-slate-400">{metric.label}</span>
                            <span className={`text-xs font-mono font-medium ${scoreColor(metric.value)}`}>
                              {metric.value.toFixed(0)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                metric.value >= 70 ? "bg-emerald-500" : metric.value >= 45 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${metric.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {fitResult.penaltyReasons.length > 0 && (
                      <div className="mt-4 space-y-1.5">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Penalty Flags</p>
                        {fitResult.penaltyReasons.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-red-400 text-xs mt-0.5">⚠</span>
                            <span className="text-xs text-slate-400">{r}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Fee Drag Summary */}
                <Card className="bg-[#0d1426] border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">Capital Formation Economics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Total Mgmt Fees (24M)", value: `$${simulation.totalFees.toFixed(1)}M` },
                        { label: "Placement Commissions", value: `$${simulation.totalCommissions.toFixed(1)}M` },
                        { label: "Total Fee Drag", value: `$${(simulation.totalFees + simulation.totalCommissions).toFixed(1)}M` },
                        { label: "Net/Gross Ratio", value: `${((simulation.netAUM / Math.max(simulation.grossRaised, 0.01)) * 100).toFixed(1)}%` },
                      ].map((item) => (
                        <div key={item.label} className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-[10px] text-slate-500 mb-1">{item.label}</p>
                          <p className="text-lg font-mono font-semibold text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── TAB 2: S-Curve Simulation ────────────────────────────── */}
              <TabsContent value="simulation">
                <Card className="bg-[#0d1426] border-slate-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-slate-300">
                        Capital Formation S-Curve — 24-Month Projection
                      </CardTitle>
                      <span className="text-xs text-slate-500">
                        Close at Month {simulation.estimatedCloseMonth} · ${simulation.grossRaised.toFixed(0)}M raised
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                        <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                        <Tooltip
                          contentStyle={{ background: "#0d1426", border: "1px solid #1e293b", borderRadius: 8 }}
                          labelStyle={{ color: "#94a3b8", fontSize: 11 }}
                          itemStyle={{ fontSize: 11 }}
                          formatter={(value: number) => [`$${value.toFixed(1)}M`]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                        <Line
                          type="monotone"
                          dataKey="Gross Raised"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="Net AUM"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="Fee Drag"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-slate-500 mb-1">Velocity Lever</p>
                        <p className="text-lg font-mono font-semibold text-blue-400">{params.velocityLever}/100</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-slate-500 mb-1">Placement Agent</p>
                        <p className="text-lg font-mono font-semibold text-white">{params.placementAgent ? "Yes (+25%)" : "No"}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-slate-500 mb-1">Fee Drag Total</p>
                        <p className="text-lg font-mono font-semibold text-amber-400">
                          ${(simulation.totalFees + simulation.totalCommissions).toFixed(1)}M
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── TAB 3: IC Simulation ─────────────────────────────────── */}
              <TabsContent value="ic">
                <div className="space-y-4">
                  {/* Verdict */}
                  <Card className="bg-[#0d1426] border-slate-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-slate-300">
                          Adversarial IC Simulation — {selectedLP.name}
                        </CardTitle>
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${verdictColor(icResult.icVerdict)}`}>
                          {icResult.icVerdict}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300 leading-relaxed">{icResult.icRationale}</p>
                    </CardContent>
                  </Card>

                  {/* Objections */}
                  <Card className="bg-[#0d1426] border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-300">IC Objections</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {icResult.icObjections.map((obj, i) => (
                        <div key={i} className="border border-slate-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-slate-300">{obj.agent}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              obj.severity === "High"
                                ? "bg-red-500/20 text-red-300 border-red-500/40"
                                : obj.severity === "Medium"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-slate-700 text-slate-400 border-slate-600"
                            }`}>
                              {obj.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{obj.objection}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Tailored Pitch */}
                  <Card className="bg-[#0d1426] border-slate-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-slate-300">
                        Tailored LP Pitch — {selectedLP.region} Jurisdiction
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-900/50 rounded-lg p-4">
                        {icResult.tailoredPitch}
                      </pre>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleSaveToLedger}
                    disabled={savedToLedger}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                  >
                    {savedToLedger ? "Saved to Decision Ledger ✓" : "Save to Decision Ledger"}
                  </Button>
                </div>
              </TabsContent>

              {/* ── TAB 4: Compliance Gate ───────────────────────────────── */}
              <TabsContent value="compliance">
                <Card className="bg-[#0d1426] border-slate-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-slate-300">
                        RegInterceptor — Compliance Gate
                      </CardTitle>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${complianceBadge(compliance.passed)}`}>
                        {compliance.passed ? "CLEARED" : "BLOCKED"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-sm text-slate-300">{compliance.summary}</p>
                    </div>
                    {compliance.flags.length === 0 ? (
                      <p className="text-xs text-emerald-400">No compliance issues detected for {selectedLP.name} under {selectedLP.complianceFlags.join(", ")} rules.</p>
                    ) : (
                      <div className="space-y-3">
                        {compliance.flags.map((flag, i) => (
                          <div key={i} className={`border rounded-lg p-3 ${
                            flag.severity === "BLOCK"
                              ? "border-red-500/40 bg-red-500/5"
                              : "border-amber-500/40 bg-amber-500/5"
                          }`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-slate-200">{flag.rule}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                flag.severity === "BLOCK"
                                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              }`}>
                                {flag.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mb-1">{flag.message}</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">{flag.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border border-slate-800 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Active Compliance Rules</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedLP.complianceFlags.map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── TAB 5: Decision Ledger ───────────────────────────────── */}
              <TabsContent value="ledger">
                <Card className="bg-[#0d1426] border-slate-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-slate-300">
                        Auto-Calibration Decision Ledger
                      </CardTitle>
                      <span className="text-xs text-slate-500">{ledger.length} entries</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {ledger.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-sm text-slate-500">No decisions recorded yet.</p>
                        <p className="text-xs text-slate-600 mt-1">Run a simulation and click "Save to Decision Ledger" to begin calibration.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {[...ledger].reverse().map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-slate-300">{entry.lpId}</span>
                              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                {entry.strategy}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-mono ${scoreColor(entry.fitScore)}`}>
                                {entry.fitScore}/100
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${verdictColor(entry.icVerdict)}`}>
                                {entry.icVerdict}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
