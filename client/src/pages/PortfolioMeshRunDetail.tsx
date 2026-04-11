/**
 * PortfolioMesh Run Detail — renders a stored CIO Board Memo from DB
 * Route: /portfolio-mesh/run/:id
 */
import { useLocation, useParams } from "wouter";
import SiteNav from "@/components/SiteNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type BoardMemo = {
  executiveSummary?: string[];
  macroRegime?: { regime: string; confidenceLevel: string; rationale: string };
  allocationTable?: { asset: string; weight: number; role: string }[];
  constructionLogic?: { topMethods: string; blendRationale: string; methodAttribution: string };
  benchmarkComparison?: { equityDelta: string; bondDelta: string; alternativesDelta: string; cashDelta: string; summary: string };
  keyAllocationDecisions?: string[];
  riskAssessment?: { risk: string; portfolioImpact: string; severity: string }[];
  whatWouldChangeView?: string[];
  rebalanceTriggers?: string[];
  ipsCompliance?: { status: string; volatilityCheck: string; drawdownCheck: string; returnCheck: string; notes: string };
  disclaimer?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-slate-900/60 border-white/10">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-slate-300 text-sm font-medium uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">{children}</CardContent>
    </Card>
  );
}

function severityBadge(s: string) {
  if (s === "High") return "bg-red-500/20 text-red-300 border border-red-500/40";
  if (s === "Medium") return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  return "bg-slate-500/20 text-slate-300 border border-slate-500/40";
}

function deltaColor(delta: number | null, lowerIsBetter = false) {
  if (delta === null) return "text-slate-400";
  const positive = lowerIsBetter ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 0.001) return "text-slate-400";
  return positive ? "text-emerald-400" : "text-red-400";
}

function deltaSign(delta: number | null) {
  if (delta === null) return "—";
  return delta >= 0 ? `+${(delta * 100).toFixed(2)}%` : `${(delta * 100).toFixed(2)}%`;
}

function deltaSharpe(delta: number | null) {
  if (delta === null) return "—";
  return delta >= 0 ? `+${delta.toFixed(3)}` : `${delta.toFixed(3)}`;
}

function exportMemo(run: { ipsSnapshot: { name?: string }; boardMemo: BoardMemo; cioExpectedReturn?: number | null; cioExpectedVolatility?: number | null; cioSharpe?: number | null }) {
  const m = run.boardMemo;
  const lines: string[] = [
    "AGENTHINK MESH — CIO BOARD MEMO",
    "================================",
    `IPS: ${run.ipsSnapshot?.name ?? "IPS"}`,
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
  if (run.cioExpectedReturn !== null && run.cioExpectedReturn !== undefined) {
    lines.push(`Expected Return: ${(run.cioExpectedReturn * 100).toFixed(2)}%   Volatility: ${((run.cioExpectedVolatility ?? 0) * 100).toFixed(2)}%   Sharpe: ${(run.cioSharpe ?? 0).toFixed(3)}`);
    lines.push("");
  }
  if (m.constructionLogic) {
    lines.push("PORTFOLIO CONSTRUCTION LOGIC");
    lines.push(`Methods: ${m.constructionLogic.topMethods}`);
    lines.push(`Blend Rationale: ${m.constructionLogic.blendRationale}`);
    lines.push(`Method Attribution: ${m.constructionLogic.methodAttribution}`);
    lines.push("");
  }
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
  if (m.whatWouldChangeView?.length) {
    lines.push("WHAT WOULD CHANGE THIS VIEW");
    m.whatWouldChangeView.forEach(t => lines.push(`• ${t}`));
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioMeshRunDetail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const runId = parseInt(params.id ?? "0", 10);

  const { data: run, isLoading } = trpc.portfolioMesh.getRun.useQuery(
    { runId },
    { enabled: !!user && !!runId }
  );

  const { data: benchDelta } = trpc.portfolioMesh.compareToBenchmark.useQuery(
    { runId },
    { enabled: !!user && !!runId && !!run?.cioExpectedReturn }
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <SiteNav />
        <p className="text-slate-400 mt-20">Please sign in to view this run.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1629] text-slate-100">
        <SiteNav />
        <div className="max-w-4xl mx-auto px-4 pt-24 text-center text-slate-500">Loading run…</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[#0B1629] text-slate-100">
        <SiteNav />
        <div className="max-w-4xl mx-auto px-4 pt-24 text-center">
          <p className="text-slate-400 mb-4">Run not found or access denied.</p>
          <Button onClick={() => navigate("/portfolio-mesh/history")} variant="outline" className="border-white/20 text-slate-300">
            ← Back to History
          </Button>
        </div>
      </div>
    );
  }

  const memo = run.boardMemo as BoardMemo | null;
  const ips = run.ipsSnapshot as { name?: string; targetReturn?: number; targetVolatilityMax?: number; benchmark?: string };

  return (
    <div className="min-h-screen bg-[#0B1629] text-slate-100">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-8 pt-24 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/portfolio-mesh/history")}
              className="text-slate-400 hover:text-slate-200 -ml-2 mb-2"
            >
              ← History
            </Button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">{ips?.name ?? "Portfolio Run"}</h1>
              {run.isBenchmark && (
                <Badge className="text-xs bg-violet-600/20 text-violet-300 border-violet-500/30">
                  ◉ {run.benchmarkLabel ?? "Benchmark"}
                </Badge>
              )}
              {run.ipsCompliant !== null && (
                <Badge className={`text-xs ${run.ipsCompliant ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30" : "bg-red-600/20 text-red-300 border-red-500/30"}`}>
                  {run.ipsCompliant ? "IPS ✓" : "IPS ✗"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
              <span>{new Date(run.createdAt).toLocaleString()}</span>
              {run.macroRegime && <span>Regime: <span className="text-slate-300 capitalize">{run.macroRegime}</span></span>}
              {ips?.benchmark && <span>Benchmark: <span className="text-slate-300">{ips.benchmark}</span></span>}
            </div>
          </div>
          {memo && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMemo({ ipsSnapshot: ips, boardMemo: memo, cioExpectedReturn: run.cioExpectedReturn, cioExpectedVolatility: run.cioExpectedVolatility, cioSharpe: run.cioSharpe })}
              className="border-white/20 text-slate-300 hover:bg-white/5 shrink-0"
            >
              ⤓ Download Memo
            </Button>
          )}
        </div>

        {/* Portfolio Metrics */}
        {run.cioExpectedReturn !== null && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Expected Return", value: `${((run.cioExpectedReturn ?? 0) * 100).toFixed(2)}%`, color: "text-emerald-400" },
              { label: "Expected Volatility", value: `${((run.cioExpectedVolatility ?? 0) * 100).toFixed(2)}%`, color: "text-amber-400" },
              { label: "Sharpe Ratio", value: (run.cioSharpe ?? 0).toFixed(3), color: "text-blue-400" },
            ].map(m => (
              <div key={m.label} className="bg-slate-900/60 border border-white/10 rounded-lg p-4 text-center">
                <p className="text-slate-500 text-xs mb-1">{m.label}</p>
                <p className={`text-xl font-semibold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Benchmark Delta Strip */}
        {benchDelta && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
                vs {benchDelta.benchmarkLabel}
              </span>
              {!benchDelta.isUserBenchmark && (
                <span className="text-xs text-slate-500 italic">(default 60/40 baseline)</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-slate-500 text-xs mb-1">Return Δ</p>
                <p className={`text-lg font-semibold ${deltaColor(benchDelta.returnDelta)}`}>
                  {deltaSign(benchDelta.returnDelta)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-xs mb-1">Volatility Δ</p>
                <p className={`text-lg font-semibold ${deltaColor(benchDelta.volDelta, true)}`}>
                  {deltaSign(benchDelta.volDelta)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 text-xs mb-1">Sharpe Δ</p>
                <p className={`text-lg font-semibold ${deltaColor(benchDelta.sharpeDelta)}`}>
                  {deltaSharpe(benchDelta.sharpeDelta)}
                </p>
              </div>
            </div>
            {benchDelta.allocationShifts?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-slate-500 text-xs mb-2">Largest allocation shifts</p>
                <div className="space-y-1">
                  {benchDelta.allocationShifts.map((s: { asset: string; runWeight: number; benchWeight: number; delta: number }) => (
                    <div key={s.asset} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{s.asset}</span>
                      <span className={deltaColor(s.delta)}>
                        {s.delta >= 0 ? "+" : ""}{(s.delta * 100).toFixed(1)}pp
                        <span className="text-slate-600 ml-1">
                          ({(s.benchWeight * 100).toFixed(1)}% → {(s.runWeight * 100).toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Board Memo — all sections */}
        {!memo && (
          <div className="text-center py-12 text-slate-500">
            No Board Memo available for this run. The CIO output step may not have completed.
          </div>
        )}

        {memo && (
          <>
            {/* 1. Executive Summary */}
            {memo.executiveSummary?.length ? (
              <div className={`rounded-lg border px-5 py-4 ${run.ipsCompliant ? "bg-emerald-900/20 border-emerald-500/40" : "bg-red-900/20 border-red-500/40"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{run.ipsCompliant ? "✅" : "⚠️"}</span>
                  <span className={`font-semibold text-sm ${run.ipsCompliant ? "text-emerald-300" : "text-red-300"}`}>
                    {run.ipsCompliant ? "IPS Compliant" : "IPS Breach Detected"}
                  </span>
                </div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">1. Executive Summary</p>
                <ul className="space-y-1.5">
                  {memo.executiveSummary.map((b, i) => (
                    <li key={i} className="text-slate-200 text-sm flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* 2. Macro Regime */}
            {memo.macroRegime && (
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

            {/* 3. Final Allocation */}
            {memo.allocationTable?.length ? (
              <SectionCard title="3. Final Portfolio Allocation">
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
              </SectionCard>
            ) : null}

            {/* 4. Portfolio Construction Logic */}
            {memo.constructionLogic && (
              <SectionCard title="4. Portfolio Construction Logic">
                <div className="space-y-3">
                  {[
                    { label: "Methods Used", value: memo.constructionLogic.topMethods },
                    { label: "Blend Rationale", value: memo.constructionLogic.blendRationale },
                    { label: "Method Attribution", value: memo.constructionLogic.methodAttribution },
                  ].map(row => (
                    <div key={row.label} className="bg-white/5 rounded p-3 border border-white/10">
                      <p className="text-slate-500 text-xs mb-1">{row.label}</p>
                      <p className="text-slate-200 text-sm">{row.value}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* 5. Benchmark Comparison (LLM section) */}
            {memo.benchmarkComparison && (
              <SectionCard title="5. Benchmark Comparison">
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

            {/* 6. Key Allocation Decisions */}
            {(memo.keyAllocationDecisions?.length ?? 0) > 0 && (
              <SectionCard title="6. Key Allocation Decisions">
                <ul className="space-y-2">
                  {memo.keyAllocationDecisions!.map((d, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-blue-400 shrink-0 mt-0.5">{i + 1}.</span><span>{d}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 7. Risk Assessment */}
            {(memo.riskAssessment?.length ?? 0) > 0 && (
              <SectionCard title="7. Risk Assessment">
                <div className="space-y-3">
                  {memo.riskAssessment!.map((r, i) => (
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

            {/* 8. What Would Change This View */}
            {(memo.whatWouldChangeView?.length ?? 0) > 0 && (
              <SectionCard title="8. What Would Change This View">
                <ul className="space-y-2">
                  {memo.whatWouldChangeView!.map((t, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-violet-400 shrink-0 mt-0.5">◈</span><span>{t}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 9. Rebalance Triggers */}
            {(memo.rebalanceTriggers?.length ?? 0) > 0 && (
              <SectionCard title="9. Rebalance Triggers">
                <ul className="space-y-2">
                  {memo.rebalanceTriggers!.map((t, i) => (
                    <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                      <span className="text-amber-400 shrink-0 mt-0.5">⚠</span><span>{t}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 10. IPS Compliance */}
            {memo.ipsCompliance && (
              <SectionCard title="10. IPS Compliance">
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

            {/* Disclaimer */}
            {memo.disclaimer && (
              <div className="bg-white/5 rounded p-3 border border-white/10">
                <p className="text-slate-500 text-xs italic">{memo.disclaimer}</p>
              </div>
            )}
          </>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap gap-3 pb-8">
          {memo && (
            <Button
              onClick={() => exportMemo({ ipsSnapshot: ips, boardMemo: memo, cioExpectedReturn: run.cioExpectedReturn, cioExpectedVolatility: run.cioExpectedVolatility, cioSharpe: run.cioSharpe })}
              variant="outline"
              className="border-white/20 text-slate-300 hover:bg-white/5"
            >
              ⤓ Download Board Memo
            </Button>
          )}
          <Button onClick={() => navigate("/portfolio-mesh/history")} variant="outline" className="border-white/20 text-slate-300 hover:bg-white/5">
            ← Back to History
          </Button>
          <Button onClick={() => navigate("/portfolio-mesh")} className="bg-blue-600 hover:bg-blue-500 text-white">
            New Run
          </Button>
        </div>
      </div>
    </div>
  );
}
