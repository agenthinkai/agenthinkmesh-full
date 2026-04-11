/**
 * PortfolioMesh — Institutional Asset Allocation Decision Support
 * 6-step stepper: IPS Setup → Macro → Asset Agents → Construction → Strategy Review → CIO Output
 */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASSES = ["US Equity", "International Equity", "Bonds", "Credit", "Gold", "Cash"] as const;
type AssetClass = typeof ASSET_CLASSES[number];

const STEPS = [
  { id: 1, label: "IPS Setup",       icon: "📋" },
  { id: 2, label: "Macro Regime",    icon: "🌐" },
  { id: 3, label: "Asset Agents",    icon: "🤖" },
  { id: 4, label: "Construction",    icon: "🏗️" },
  { id: 5, label: "Strategy Review", icon: "🔍" },
  { id: 6, label: "CIO Output",      icon: "📊" },
] as const;

const REGIME_COLORS: Record<string, string> = {
  expansion:  "text-emerald-400 border-emerald-500/40 bg-emerald-900/20",
  recession:  "text-red-400    border-red-500/40    bg-red-900/20",
  recovery:   "text-amber-400  border-amber-500/40  bg-amber-900/20",
  stagflation:"text-orange-400 border-orange-500/40 bg-orange-900/20",
};

const CONSTRUCTION_COLORS = ["#7BA3D4", "#F472B6", "#4ADE80", "#FBBF24", "#C084FC"];

/// ─── Types ────────────────────────────────────────────────────────────────────
type AssetConstraints = Record<AssetClass, { min: number; max: number }>;
interface IpsForm {
  name: string;
  targetReturn: number;
  targetVolatilityMin: number;
  targetVolatilityMax: number;
  maxDrawdown: number;
  benchmark: string;
  constraints: AssetConstraints;
}

interface AssetEstimate {
  asset: string;
  historicalReturn: number;
  historicalVolatility: number;
  blendedReturn: number;
  blendedVolatility: number;
  finalReturn: number;
  finalVolatility: number;
  rationale: string;
}

interface ConstructionResult {
  method: string;
  weights: Record<string, number>;
  expectedReturn: number;
  expectedVolatility: number;
  sharpe: number;
  diversification: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            s.id === current
              ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
              : s.id < current
              ? "bg-emerald-900/20 text-emerald-400 border border-emerald-500/30"
              : "bg-white/5 text-slate-500 border border-white/10"
          }`}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
            {s.id < current && <span className="text-emerald-400">✓</span>}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 h-px mx-1 ${s.id < current ? "bg-emerald-500/40" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-200">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PctBar({ value, color = "#7BA3D4" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
      </div>
      <span className="text-xs text-slate-400 w-10 text-right">{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

// ─── Step 1: IPS Setup ────────────────────────────────────────────────────────

function IpsSetupStep({
  form, setForm, onNext, isSaving,
}: {
  form: IpsForm;
  setForm: (f: IpsForm) => void;
  onNext: () => void;
  isSaving: boolean;
}) {
  const updateConstraint = (asset: AssetClass, field: "min" | "max", val: number) => {
    setForm({ ...form, constraints: { ...form.constraints, [asset]: { ...form.constraints[asset], [field]: val } } });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Investment Policy Statement">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-slate-300 text-xs mb-1 block">IPS Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Gulf Sovereign Endowment IPS"
              className="bg-white/5 border-white/15 text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs mb-1 block">Benchmark</Label>
            <Input
              value={form.benchmark}
              onChange={e => setForm({ ...form, benchmark: e.target.value })}
              placeholder="e.g. MSCI World / 60-40 Blend"
              className="bg-white/5 border-white/15 text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs mb-1 block">Target Return (% p.a.)</Label>
            <Input
              type="number" step="0.1" min="0" max="30"
              value={(form.targetReturn * 100).toFixed(1)}
              onChange={e => setForm({ ...form, targetReturn: parseFloat(e.target.value) / 100 })}
              className="bg-white/5 border-white/15 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs mb-1 block">Max Drawdown (%)</Label>
            <Input
              type="number" step="0.5" min="0" max="50"
              value={(form.maxDrawdown * 100).toFixed(1)}
              onChange={e => setForm({ ...form, maxDrawdown: parseFloat(e.target.value) / 100 })}
              className="bg-white/5 border-white/15 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs mb-1 block">Target Volatility Min (%)</Label>
            <Input
              type="number" step="0.5" min="0" max="30"
              value={(form.targetVolatilityMin * 100).toFixed(1)}
              onChange={e => setForm({ ...form, targetVolatilityMin: parseFloat(e.target.value) / 100 })}
              className="bg-white/5 border-white/15 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-slate-300 text-xs mb-1 block">Target Volatility Max (%)</Label>
            <Input
              type="number" step="0.5" min="0" max="30"
              value={(form.targetVolatilityMax * 100).toFixed(1)}
              onChange={e => setForm({ ...form, targetVolatilityMax: parseFloat(e.target.value) / 100 })}
              className="bg-white/5 border-white/15 text-slate-200"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Asset Class Constraints">
        <div className="space-y-3">
          {ASSET_CLASSES.map(asset => (
            <div key={asset} className="flex items-center gap-3">
              <span className="text-slate-300 text-sm w-40 shrink-0">{asset}</span>
              <div className="flex items-center gap-2 flex-1">
                <Label className="text-slate-500 text-xs">Min</Label>
                <Input
                  type="number" step="1" min="0" max="100"
                  value={Math.round((form.constraints[asset]?.min ?? 0) * 100)}
                  onChange={e => updateConstraint(asset, "min", parseFloat(e.target.value) / 100)}
                  className="bg-white/5 border-white/15 text-slate-200 w-20"
                />
                <Label className="text-slate-500 text-xs">Max</Label>
                <Input
                  type="number" step="1" min="0" max="100"
                  value={Math.round((form.constraints[asset]?.max ?? 0) * 100)}
                  onChange={e => updateConstraint(asset, "max", parseFloat(e.target.value) / 100)}
                  className="bg-white/5 border-white/15 text-slate-200 w-20"
                />
                <span className="text-slate-500 text-xs">%</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-6">
          {isSaving ? "Saving…" : "Save IPS & Continue →"}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Macro Regime ─────────────────────────────────────────────────────

function MacroStep({
  macroResult, onRun, isRunning,
  onNext,
}: {
  macroResult: { regime: string; confidence: number; rationale: string } | null;
  onRun: () => void;
  isRunning: boolean;
  onNext: () => void;
}) {
  const regimeColor = macroResult ? (REGIME_COLORS[macroResult.regime] ?? "text-slate-300 border-white/20 bg-white/5") : "";
  return (
    <div className="space-y-6">
      <SectionCard title="Macro Regime Classification Agent">
        <p className="text-slate-400 text-sm mb-4">
          The Macro Agent analyses current global economic indicators — yield curves, PMI trends, inflation expectations,
          and credit spreads — to classify the prevailing regime. This regime adjusts forward return expectations for all asset classes.
        </p>
        {!macroResult ? (
          <Button onClick={onRun} disabled={isRunning} className="bg-blue-600 hover:bg-blue-500 text-white">
            {isRunning ? (
              <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Classifying regime…</span>
            ) : "Run Macro Agent →"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className={`inline-flex items-center gap-3 px-4 py-3 rounded-lg border font-semibold text-lg ${regimeColor}`}>
              <span className="capitalize">{macroResult.regime}</span>
              <Badge variant="outline" className="text-xs border-current">
                {(macroResult.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="text-slate-300 text-sm leading-relaxed">{macroResult.rationale}</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={onRun} disabled={isRunning} variant="outline" size="sm" className="border-white/20 text-slate-300 hover:bg-white/5">
                Re-run
              </Button>
              <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                Continue to Asset Agents →
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Step 3: Asset Agents ─────────────────────────────────────────────────────

function AssetAgentsStep({
  estimates, onRun, isRunning, onNext,
}: {
  estimates: AssetEstimate[] | null;
  onRun: () => void;
  isRunning: boolean;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Asset Class Estimation Agents">
        <p className="text-slate-400 text-sm mb-4">
          Six specialist agents — one per asset class — blend long-run historical capital market assumptions with
          regime-adjusted forward estimates to produce final return and volatility inputs for portfolio construction.
        </p>
        {!estimates ? (
          <Button onClick={onRun} disabled={isRunning} className="bg-blue-600 hover:bg-blue-500 text-white">
            {isRunning ? (
              <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Running 6 agents…</span>
            ) : "Run Asset Agents →"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-slate-400 font-medium">Asset Class</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Hist. Return</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Hist. Vol</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Final Return</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Final Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map(e => (
                    <tr key={e.asset} className="border-b border-white/5 hover:bg-white/3">
                      <td className="py-2 text-slate-200 font-medium">{e.asset}</td>
                      <td className="py-2 text-right text-slate-400">{(e.historicalReturn * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right text-slate-400">{(e.historicalVolatility * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right text-emerald-400 font-semibold">{(e.finalReturn * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right text-amber-400">{(e.finalVolatility * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <Button onClick={onRun} disabled={isRunning} variant="outline" size="sm" className="border-white/20 text-slate-300 hover:bg-white/5">
                Re-run
              </Button>
              <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                Continue to Construction →
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Step 4: Portfolio Construction ──────────────────────────────────────────

function ConstructionStep({
  results, onRun, isRunning, onNext,
}: {
  results: ConstructionResult[] | null;
  onRun: () => void;
  isRunning: boolean;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState(0);

  return (
    <div className="space-y-6">
      <SectionCard title="Portfolio Construction Engine">
        <p className="text-slate-400 text-sm mb-4">
          Five construction methods — Maximum Sharpe, Risk Parity, Equal Weight, Minimum Variance, and Maximum Diversification —
          are computed simultaneously against your IPS constraints.
        </p>
        {!results ? (
          <Button onClick={onRun} disabled={isRunning} className="bg-blue-600 hover:bg-blue-500 text-white">
            {isRunning ? (
              <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Running 5 methods…</span>
            ) : "Run Construction →"}
          </Button>
        ) : (
          <div className="space-y-4">
            {/* Method selector tabs */}
            <div className="flex gap-2 flex-wrap">
              {results.map((r, i) => (
                <button
                  key={r.method}
                  onClick={() => setSelected(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    i === selected
                      ? "border-blue-500/60 bg-blue-600/20 text-blue-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {r.method}
                </button>
              ))}
            </div>

            {/* Selected method detail */}
            {results[selected] && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-slate-300 text-sm font-semibold">Weights</h4>
                  {Object.entries(results[selected].weights).map(([asset, w], i) => (
                    <div key={asset}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{asset}</span>
                        <span className="text-slate-400">{(w * 100).toFixed(1)}%</span>
                      </div>
                      <PctBar value={w} color={CONSTRUCTION_COLORS[i % CONSTRUCTION_COLORS.length]} />
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h4 className="text-slate-300 text-sm font-semibold">Portfolio Metrics</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Expected Return", value: `${(results[selected].expectedReturn * 100).toFixed(2)}%`, color: "text-emerald-400" },
                      { label: "Expected Volatility", value: `${(results[selected].expectedVolatility * 100).toFixed(2)}%`, color: "text-amber-400" },
                      { label: "Sharpe Ratio", value: results[selected].sharpe.toFixed(3), color: "text-blue-400" },
                      { label: "Diversification Ratio", value: results[selected].diversification.toFixed(3), color: "text-purple-400" },
                    ].map(m => (
                      <div key={m.label} className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-slate-400 text-sm">{m.label}</span>
                        <span className={`font-semibold text-sm ${m.color}`}>{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={onRun} disabled={isRunning} variant="outline" size="sm" className="border-white/20 text-slate-300 hover:bg-white/5">
                Re-run
              </Button>
              <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                Continue to Strategy Review →
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Step 5: Strategy Review ──────────────────────────────────────────────────

function StrategyReviewStep({
  estimates, results, macroRegime, onNext,
}: {
  estimates: AssetEstimate[];
  results: ConstructionResult[];
  macroRegime: string;
  onNext: () => void;
}) {
  const best = results.reduce((a, b) => a.sharpe > b.sharpe ? a : b, results[0]);

  return (
    <div className="space-y-6">
      <SectionCard title="Strategy Review">
        <div className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm font-medium mb-1">Macro Context</p>
            <p className="text-slate-300 text-sm capitalize">
              Current regime: <span className="font-semibold">{macroRegime}</span>. Asset return estimates have been
              adjusted to reflect regime-specific risk premia.
            </p>
          </div>

          <div>
            <h4 className="text-slate-300 text-sm font-semibold mb-3">Efficient Frontier Summary</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-slate-400 font-medium">Method</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Return</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Volatility</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Sharpe</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.method} className={`border-b border-white/5 ${r.method === best.method ? "bg-blue-900/10" : ""}`}>
                      <td className="py-2 text-slate-200">
                        {r.method}
                        {r.method === best.method && <Badge className="ml-2 bg-blue-600/30 text-blue-300 text-xs">Best Sharpe</Badge>}
                      </td>
                      <td className="py-2 text-right text-emerald-400">{(r.expectedReturn * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right text-amber-400">{(r.expectedVolatility * 100).toFixed(2)}%</td>
                      <td className="py-2 text-right text-blue-400 font-semibold">{r.sharpe.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-500 text-white">
              Generate CIO Output →
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Step 6: CIO Output ───────────────────────────────────────────────────────

type BoardMemo = {
  executiveSummary?: string[];
  macroRegime?: { regime: string; confidenceLevel: string; rationale: string };
  allocationTable?: { asset: string; weight: number; role: string }[];
  benchmarkComparison?: { equityDelta: string; bondDelta: string; alternativesDelta: string; cashDelta: string; summary: string };
  keyAllocationDecisions?: string[];
  riskAssessment?: { risk: string; portfolioImpact: string; severity: string }[];
  rebalanceTriggers?: string[];
  ipsCompliance?: { status: string; volatilityCheck: string; drawdownCheck: string; returnCheck: string; notes: string };
  disclaimer?: string;
  // legacy backward-compat fields
  title?: string; macroSummary?: string; allocationRationale?: string;
  keyRisks?: string[]; recommendation?: string;
};

function severityBadge(s: string) {
  if (s === "High") return "bg-red-500/20 text-red-300 border border-red-500/40";
  if (s === "Medium") return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  return "bg-slate-500/20 text-slate-300 border border-slate-500/40";
}

function exportBoardMemo(cioResult: NonNullable<CioOutputStepProps["cioResult"]>) {
  const m = cioResult.boardMemo as BoardMemo;
  const lines: string[] = [
    "AGENTHINK MESH — CIO BOARD MEMO",
    "================================",
    "",
  ];
  if (m.executiveSummary?.length) {
    lines.push("EXECUTIVE SUMMARY");
    m.executiveSummary.forEach(b => lines.push(`• ${b}`));
    lines.push("");
  }
  if (m.macroRegime) {
    lines.push(`MACRO REGIME: ${m.macroRegime.regime} (Confidence: ${m.macroRegime.confidenceLevel})`);
    lines.push(m.macroRegime.rationale);
    lines.push("");
  }
  if (m.allocationTable?.length) {
    lines.push("FINAL ALLOCATION");
    m.allocationTable.forEach(r => lines.push(`  ${r.asset.padEnd(26)} ${(r.weight * 100).toFixed(1).padStart(5)}%   ${r.role}`));
    lines.push("");
  }
  lines.push(`Expected Return: ${(cioResult.cioExpectedReturn * 100).toFixed(2)}%   Volatility: ${(cioResult.cioExpectedVolatility * 100).toFixed(2)}%   Sharpe: ${cioResult.cioSharpe.toFixed(3)}`);
  lines.push("");
  if (m.benchmarkComparison) {
    lines.push("BENCHMARK COMPARISON");
    lines.push(`Equity: ${m.benchmarkComparison.equityDelta}`);
    lines.push(`Bonds/Credit: ${m.benchmarkComparison.bondDelta}`);
    lines.push(`Alternatives: ${m.benchmarkComparison.alternativesDelta}`);
    lines.push(`Cash: ${m.benchmarkComparison.cashDelta}`);
    lines.push(m.benchmarkComparison.summary);
    lines.push("");
  }
  if (m.keyAllocationDecisions?.length) {
    lines.push("KEY ALLOCATION DECISIONS");
    m.keyAllocationDecisions.forEach(d => lines.push(`• ${d}`));
    lines.push("");
  }
  if (m.riskAssessment?.length) {
    lines.push("RISK ASSESSMENT");
    m.riskAssessment.forEach(r => lines.push(`[${r.severity}] ${r.risk}: ${r.portfolioImpact}`));
    lines.push("");
  }
  if (m.rebalanceTriggers?.length) {
    lines.push("REBALANCE TRIGGERS");
    m.rebalanceTriggers.forEach(t => lines.push(`• ${t}`));
    lines.push("");
  }
  if (m.ipsCompliance) {
    lines.push("IPS COMPLIANCE");
    lines.push(`Status: ${m.ipsCompliance.status}`);
    lines.push(`Return: ${m.ipsCompliance.returnCheck}`);
    lines.push(`Volatility: ${m.ipsCompliance.volatilityCheck}`);
    lines.push(`Drawdown: ${m.ipsCompliance.drawdownCheck}`);
    if (m.ipsCompliance.notes) lines.push(m.ipsCompliance.notes);
    lines.push("");
  }
  if (m.disclaimer) { lines.push("DISCLAIMER"); lines.push(m.disclaimer); }
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "AgenThinkMesh_CIO_BoardMemo.txt";
  a.click(); URL.revokeObjectURL(url);
}

type CioOutputStepProps = {
  cioResult: {
    cioWeights: Record<string, number>;
    cioExpectedReturn: number;
    cioExpectedVolatility: number;
    cioSharpe: number;
    ipsCompliant: boolean;
    ipsIssues: string[];
    boardMemo: BoardMemo;
  } | null;
  onRun: () => void;
  isRunning: boolean;
};

function CioOutputStep({ cioResult, onRun, isRunning }: CioOutputStepProps) {
  const [, navigate] = useLocation();
  const memo = cioResult?.boardMemo as BoardMemo | undefined;

  return (
    <div className="space-y-6">
      {!cioResult ? (
        <SectionCard title="CIO Output Agent">
          <p className="text-slate-400 text-sm mb-4">
            The CIO Agent synthesises macro regime, asset estimates, and construction results to produce a final
            recommended portfolio with IPS compliance check and an institutional Board Memo.
          </p>
          <Button onClick={onRun} disabled={isRunning} className="bg-blue-600 hover:bg-blue-500 text-white">
            {isRunning ? (
              <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Generating CIO Output…</span>
            ) : "Generate CIO Output →"}
          </Button>
        </SectionCard>
      ) : (
        <>
          {/* 1. Executive Summary (opinion-first) */}
          {memo?.executiveSummary?.length ? (
            <div className={`rounded-lg border px-5 py-4 ${
              cioResult.ipsCompliant
                ? "bg-emerald-900/20 border-emerald-500/40"
                : "bg-red-900/20 border-red-500/40"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{cioResult.ipsCompliant ? "✅" : "⚠️"}</span>
                <span className={`font-semibold text-sm ${cioResult.ipsCompliant ? "text-emerald-300" : "text-red-300"}`}>
                  {cioResult.ipsCompliant ? "IPS Compliant" : "IPS Breach Detected"}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Executive Summary</p>
              <ul className="space-y-1.5">
                {memo.executiveSummary.map((b, i) => (
                  <li key={i} className="text-slate-200 text-sm flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 shrink-0">•</span><span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
              cioResult.ipsCompliant
                ? "bg-emerald-900/20 border-emerald-500/40 text-emerald-300"
                : "bg-red-900/20 border-red-500/40 text-red-300"
            }`}>
              <span className="text-lg">{cioResult.ipsCompliant ? "✅" : "⚠️"}</span>
              <span className="font-semibold">{cioResult.ipsCompliant ? "IPS Compliant" : "IPS Breach Detected"}</span>
            </div>
          )}

          {/* 2. Macro Regime */}
          {memo?.macroRegime && (
            <SectionCard title="2. Macro Regime">
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs">{memo.macroRegime.regime}</Badge>
                <Badge className={`text-xs ${
                  memo.macroRegime.confidenceLevel === "High" ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/40" :
                  memo.macroRegime.confidenceLevel === "Medium" ? "bg-amber-600/30 text-amber-300 border-amber-500/40" :
                  "bg-slate-600/30 text-slate-300 border-slate-500/40"
                }`}>{memo.macroRegime.confidenceLevel} Confidence</Badge>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{memo.macroRegime.rationale}</p>
            </SectionCard>
          )}

          {/* 3. Final Allocation + Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="3. Final Portfolio Allocation">
              {memo?.allocationTable?.length ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-slate-400 font-medium pb-2">Asset Class</th>
                      <th className="text-right text-slate-400 font-medium pb-2">Weight</th>
                      <th className="text-left text-slate-400 font-medium pb-2 pl-3">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memo.allocationTable.map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="text-slate-200 py-2">{r.asset}</td>
                        <td className="text-right">
                          <span className="text-blue-300 font-semibold">{(r.weight * 100).toFixed(1)}%</span>
                        </td>
                        <td className="pl-3 text-slate-400 italic">{r.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cioResult.cioWeights).map(([asset, w], i) => (
                    <div key={asset}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{asset}</span>
                        <span className="text-slate-400">{(w * 100).toFixed(1)}%</span>
                      </div>
                      <PctBar value={w} color={CONSTRUCTION_COLORS[i % CONSTRUCTION_COLORS.length]} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Portfolio Metrics">
              <div className="space-y-2">
                {[
                  { label: "Expected Return", value: `${(cioResult.cioExpectedReturn * 100).toFixed(2)}%`, color: "text-emerald-400" },
                  { label: "Expected Volatility", value: `${(cioResult.cioExpectedVolatility * 100).toFixed(2)}%`, color: "text-amber-400" },
                  { label: "Sharpe Ratio", value: cioResult.cioSharpe.toFixed(3), color: "text-blue-400" },
                ].map(m => (
                  <div key={m.label} className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-slate-400 text-sm">{m.label}</span>
                    <span className={`font-semibold text-sm ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>
              {(cioResult.ipsIssues?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-slate-400 text-xs font-medium mb-2">IPS Issues</p>
                  <div className="space-y-1">
                    {cioResult.ipsIssues.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                        <span>⚠</span><span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* 4. Benchmark Comparison */}
          {memo?.benchmarkComparison && (
            <SectionCard title="4. Benchmark Comparison">
              <p className="text-slate-300 text-sm mb-3">{memo.benchmarkComparison.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "Equity", value: memo.benchmarkComparison.equityDelta },
                  { label: "Bonds / Credit", value: memo.benchmarkComparison.bondDelta },
                  { label: "Alternatives", value: memo.benchmarkComparison.alternativesDelta },
                  { label: "Cash", value: memo.benchmarkComparison.cashDelta },
                ].map(row => (
                  <div key={row.label} className="bg-white/5 rounded p-3 border border-white/10">
                    <p className="text-slate-500 text-xs mb-1">{row.label}</p>
                    <p className="text-slate-200 text-xs">{row.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* 5. Key Allocation Decisions */}
          {(memo?.keyAllocationDecisions?.length ?? 0) > 0 && (
            <SectionCard title="5. Key Allocation Decisions">
              <ul className="space-y-2">
                {memo!.keyAllocationDecisions!.map((d, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-blue-400 shrink-0 mt-0.5">{i + 1}.</span><span>{d}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* 6. Risk Assessment */}
          {(memo?.riskAssessment?.length ?? 0) > 0 && (
            <SectionCard title="6. Risk Assessment">
              <div className="space-y-3">
                {memo!.riskAssessment!.map((r, i) => (
                  <div key={i} className="bg-white/5 rounded p-3 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${severityBadge(r.severity)}`}>{r.severity}</span>
                      <span className="text-slate-200 text-sm font-medium">{r.risk}</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{r.portfolioImpact}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* 7. Rebalance Triggers */}
          {(memo?.rebalanceTriggers?.length ?? 0) > 0 && (
            <SectionCard title="7. Rebalance Triggers">
              <ul className="space-y-2">
                {memo!.rebalanceTriggers!.map((t, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-amber-400 shrink-0 mt-0.5">⚠</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* 8. IPS Compliance */}
          {memo?.ipsCompliance && (
            <SectionCard title="8. IPS Compliance">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`text-xs ${
                  memo.ipsCompliance.status === "Compliant"
                    ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/40"
                    : "bg-red-600/30 text-red-300 border-red-500/40"
                }`}>{memo.ipsCompliance.status}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { label: "Return Check", value: memo.ipsCompliance.returnCheck },
                  { label: "Volatility Check", value: memo.ipsCompliance.volatilityCheck },
                  { label: "Drawdown Check", value: memo.ipsCompliance.drawdownCheck },
                ].map(row => (
                  <div key={row.label} className="bg-white/5 rounded p-3 border border-white/10">
                    <p className="text-slate-500 text-xs mb-1">{row.label}</p>
                    <p className="text-slate-200 text-xs">{row.value}</p>
                  </div>
                ))}
              </div>
              {memo.ipsCompliance.notes && (
                <p className="text-slate-400 text-xs mt-3">{memo.ipsCompliance.notes}</p>
              )}
            </SectionCard>
          )}

          {/* 9. Disclaimer */}
          {memo?.disclaimer && (
            <div className="bg-white/5 rounded p-3 border border-white/10">
              <p className="text-slate-500 text-xs italic">{memo.disclaimer}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => exportBoardMemo(cioResult)}
              variant="outline"
              className="border-white/20 text-slate-300 hover:bg-white/5"
            >
              ⤓ Download Board Memo
            </Button>
            <Button onClick={() => navigate("/portfolio-mesh/history")} variant="outline" className="border-white/20 text-slate-300 hover:bg-white/5">
              View History
            </Button>
            <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-500 text-white">
              New Run
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioMesh() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [runId, setRunId] = useState<number | null>(null);

  // IPS form state
  const [ipsForm, setIpsForm] = useState<IpsForm>({
    name: "Institutional Endowment IPS",
    targetReturn: 0.075,
    targetVolatilityMin: 0.06,
    targetVolatilityMax: 0.12,
    maxDrawdown: 0.15,
    benchmark: "60/40 Blend",
    constraints: Object.fromEntries(
      ASSET_CLASSES.map(a => [a, {
        min: a === "Cash" ? 0.02 : 0.05,
        max: a === "US Equity" ? 0.40 : a === "Cash" ? 0.10 : 0.30,
      }])
    ) as AssetConstraints,
  });

  // Step results
  const [macroResult, setMacroResult] = useState<{ regime: string; confidence: number; rationale: string } | null>(null);
  const [assetEstimates, setAssetEstimates] = useState<AssetEstimate[] | null>(null);
  const [constructionResults, setConstructionResults] = useState<ConstructionResult[] | null>(null);
  const [cioResult, setCioResult] = useState<{
    cioWeights: Record<string, number>;
    cioExpectedReturn: number;
    cioExpectedVolatility: number;
    cioSharpe: number;
    ipsCompliant: boolean;
    ipsIssues: string[];
    boardMemo: BoardMemo;
  } | null>(null);

  // tRPC mutations
  const saveIps = trpc.portfolioMesh.saveIps.useMutation();
  const createRun = trpc.portfolioMesh.createRun.useMutation();
  const classifyMacro = trpc.portfolioMesh.classifyMacro.useMutation();
  const runAssetAgents = trpc.portfolioMesh.runAssetAgents.useMutation();
  const constructPortfolios = trpc.portfolioMesh.constructPortfolios.useMutation();
  const generateCioOutput = trpc.portfolioMesh.generateCioOutput.useMutation();

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleSaveIps = useCallback(async () => {
    try {
      await saveIps.mutateAsync(ipsForm);
      // Create a new run
      const { runId: newRunId } = await createRun.mutateAsync({
        ipsSnapshot: {
          name: ipsForm.name,
          constraints: ipsForm.constraints,
          targetReturn: ipsForm.targetReturn,
          targetVolatilityMin: ipsForm.targetVolatilityMin,
          targetVolatilityMax: ipsForm.targetVolatilityMax,
          maxDrawdown: ipsForm.maxDrawdown,
          benchmark: ipsForm.benchmark,
        },
      });
      setRunId(newRunId);
      setStep(2);
      toast.success("IPS saved. Starting Macro Agent…");
    } catch (e) {
      toast.error("Failed to save IPS");
    }
  }, [ipsForm, saveIps, createRun]);

  const handleRunMacro = useCallback(async () => {
    if (!runId) return;
    try {
      const result = await classifyMacro.mutateAsync({ runId });
      setMacroResult({ regime: result.regime, confidence: result.confidence, rationale: result.rationale });
      toast.success(`Macro regime: ${result.regime}`);
    } catch {
      toast.error("Macro classification failed");
    }
  }, [runId, classifyMacro]);

  const handleRunAssetAgents = useCallback(async () => {
    if (!runId || !macroResult) return;
    try {
      const estimates = await runAssetAgents.mutateAsync({
        runId,
        regime: macroResult.regime,
      });
      setAssetEstimates(estimates as AssetEstimate[]);
      toast.success("Asset estimates ready");
    } catch {
      toast.error("Asset agent run failed");
    }
  }, [runId, macroResult, runAssetAgents]);

  const handleConstruct = useCallback(async () => {
    if (!runId || !assetEstimates) return;
    try {
      const results = await constructPortfolios.mutateAsync({
        runId,
        assetEstimates: assetEstimates.map(e => ({
          asset: e.asset,
          finalReturn: e.finalReturn,
          finalVolatility: e.finalVolatility,
        })),
        constraints: ipsForm.constraints,
      });
      setConstructionResults(results as ConstructionResult[]);
      toast.success("Construction complete");
    } catch {
      toast.error("Construction failed");
    }
  }, [runId, assetEstimates, ipsForm.constraints, constructPortfolios]);

  const handleGenerateCio = useCallback(async () => {
    if (!runId || !constructionResults || !macroResult) return;
    try {
      const result = await generateCioOutput.mutateAsync({
        runId,
        constructionResults,
        macroRegime: macroResult.regime,
        ipsSnapshot: {
          targetReturn: ipsForm.targetReturn,
          targetVolatilityMin: ipsForm.targetVolatilityMin,
          targetVolatilityMax: ipsForm.targetVolatilityMax,
          maxDrawdown: ipsForm.maxDrawdown,
          benchmark: ipsForm.benchmark,
        },
      });
      setCioResult(result as unknown as typeof cioResult);
      toast.success("CIO Output generated");
    } catch {
      toast.error("CIO output generation failed");
    }
  }, [runId, constructionResults, macroResult, ipsForm, generateCioOutput]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <SiteNav />
        <div className="text-center mt-20">
          <p className="text-slate-400 mb-4">Please sign in to use PortfolioMesh.</p>
          <Button onClick={() => navigate("/")} className="bg-blue-600 hover:bg-blue-500 text-white">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1629] text-slate-100">
      <SiteNav />
      <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-2xl font-bold text-slate-100">PortfolioMesh</h1>
              <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 text-xs">PROTOTYPE</Badge>
            </div>
            <p className="text-slate-400 text-sm">
              Institutional asset allocation decision support — IPS-constrained, macro-aware, multi-method construction.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/portfolio-mesh/history")}
            className="border-white/20 text-slate-300 hover:bg-white/5 shrink-0"
          >
            History
          </Button>
        </div>

        {/* Stepper */}
        <StepBar current={step} />

        {/* Step content */}
        {step === 1 && (
          <IpsSetupStep
            form={ipsForm}
            setForm={setIpsForm}
            onNext={handleSaveIps}
            isSaving={saveIps.isPending || createRun.isPending}
          />
        )}
        {step === 2 && (
          <MacroStep
            macroResult={macroResult}
            onRun={handleRunMacro}
            isRunning={classifyMacro.isPending}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <AssetAgentsStep
            estimates={assetEstimates}
            onRun={handleRunAssetAgents}
            isRunning={runAssetAgents.isPending}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <ConstructionStep
            results={constructionResults}
            onRun={handleConstruct}
            isRunning={constructPortfolios.isPending}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && assetEstimates && constructionResults && macroResult && (
          <StrategyReviewStep
            estimates={assetEstimates}
            results={constructionResults}
            macroRegime={macroResult.regime}
            onNext={() => setStep(6)}
          />
        )}
        {step === 6 && (
          <CioOutputStep
            cioResult={cioResult}
            onRun={handleGenerateCio}
            isRunning={generateCioOutput.isPending}
          />
        )}
      </div>
    </div>
  );
}
