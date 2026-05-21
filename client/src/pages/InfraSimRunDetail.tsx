import { toast } from "sonner";
/**
 * InfraSimRunDetail.tsx
 * Governed Infrastructure Stress Simulation v2 — Run Detail / Full Analysis
 */

import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "APPROVE")
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono">APPROVE</Badge>;
  if (decision === "CONDITIONAL")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-mono">CONDITIONAL</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono">REJECT</Badge>;
}

export default function InfraSimRunDetail() {
  const { id } = useParams<{ id: string }>();
  const runId = parseInt(id!, 10);
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.infraSim.getRunResult.useQuery({ runId });

  const exportRun = trpc.infraSim.exportRun.useMutation({
    onSuccess: (exportData) => {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `infra-sim-run-${runId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ready: ${exportData.scenarios.length} scenarios exported`);
    },
    onError: (e) => toast.error(`Export failed: ${e.message}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">Loading run results…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-400">Run not found</p>
          <Button size="sm" variant="ghost" onClick={() => navigate("/infra-sim")} className="mt-3 text-xs">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { run, scenarios } = data;

  const totalScenarios = run.completedCount ?? 0;
  const approveCount = run.approveCount ?? 0;
  const conditionalCount = run.conditionalCount ?? 0;
  const rejectCount = run.rejectCount ?? 0;
  const approveRate = totalScenarios ? approveCount / totalScenarios : 0;
  const conditionalRate = totalScenarios ? conditionalCount / totalScenarios : 0;
  const rejectRate = totalScenarios ? rejectCount / totalScenarios : 0;
  const medianIrr = parseFloat(run.medianIrrPct ?? "0");
  const p10Irr = parseFloat(run.p10IrrPct ?? "0");
  const p90Irr = parseFloat(run.p90IrrPct ?? "0");
  const dominantDecision = rejectRate > 0.5 ? "REJECT" : approveRate > 0.5 ? "APPROVE" : "CONDITIONAL";

  const failureDrivers: any[] = run.topFailureDriversJson ? JSON.parse(run.topFailureDriversJson) : [];
  const approvalPathway: any[] = run.approvalPathwayJson ? JSON.parse(run.approvalPathwayJson) : [];
  const sensitivity: any[] = run.sensitivityJson ? JSON.parse(run.sensitivityJson) : [];
  const governanceAudit: any = run.governanceAuditJson ? JSON.parse(run.governanceAuditJson) : null;
  const reproManifest: any = run.reproducibilityManifestJson ? JSON.parse(run.reproducibilityManifestJson) : null;

  const maxSwing = sensitivity.length > 0
    ? Math.max(...sensitivity.map((s: any) => Math.abs(s.irrSwingPct ?? 0)), 1)
    : 1;

  return (
    <div className="min-h-screen bg-[#0B1629] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1a2e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/infra-sim/case/${run.caseId}`)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white">Run #{run.id} Analysis</h1>
              <DecisionBadge decision={dominantDecision} />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5 text-xs gap-1.5"
            onClick={() => exportRun.mutate({ runId })}
            disabled={exportRun.isPending}
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total Scenarios", value: totalScenarios.toLocaleString(), sub: "Monte Carlo" },
            { label: "Reject Rate", value: `${(rejectRate * 100).toFixed(1)}%`, sub: `${rejectCount.toLocaleString()} scenarios`, color: rejectRate > 0.5 ? "text-red-400" : "text-slate-300" },
            { label: "Median IRR", value: `${medianIrr.toFixed(1)}%`, sub: `P10: ${p10Irr.toFixed(1)}% · P90: ${p90Irr.toFixed(1)}%`, color: medianIrr >= 15 ? "text-emerald-400" : "text-red-400" },
            { label: "Approve Rate", value: `${(approveRate * 100).toFixed(1)}%`, sub: `${approveCount.toLocaleString()} scenarios`, color: approveRate > 0.3 ? "text-emerald-400" : "text-slate-300" },
          ].map(({ label, value, sub, color }) => (
            <Card key={label} className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className={`text-xl font-mono font-bold ${color ?? "text-white"}`}>{value}</div>
                <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="tornado">
          <TabsList className="bg-white/5 border border-white/5 mb-6 flex-wrap">
            <TabsTrigger value="tornado" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Tornado</TabsTrigger>
            <TabsTrigger value="drivers" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Failure Drivers</TabsTrigger>
            <TabsTrigger value="pathway" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Approval Pathway</TabsTrigger>
            <TabsTrigger value="governance" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Governance Audit</TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Scenarios</TabsTrigger>
            <TabsTrigger value="manifest" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Reproducibility</TabsTrigger>
          </TabsList>

          {/* ── Tornado ── */}
          <TabsContent value="tornado">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  IRR Sensitivity — Tornado Chart
                </CardTitle>
                <p className="text-xs text-slate-500">IRR swing (pp) when dimension moves from worst to best value</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {sensitivity.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No sensitivity data available</p>
                ) : (
                  sensitivity.map((entry: any) => (
                    <div key={entry.dimensionKey} className="flex items-center gap-4">
                      <div className="w-44 text-xs text-slate-300 truncate shrink-0">{entry.dimensionName ?? entry.dimensionKey}</div>
                      <div className="flex-1 flex items-center gap-1">
                        <div className="flex-1 flex justify-end">
                          <div
                            className="h-5 rounded-l bg-red-500/30"
                            style={{ width: `${(Math.abs((entry.worstCaseIrr ?? 0) - medianIrr) / maxSwing) * 50}%` }}
                          />
                        </div>
                        <div className="w-px h-5 bg-white/20" />
                        <div className="flex-1">
                          <div
                            className="h-5 rounded-r bg-emerald-500/30"
                            style={{ width: `${(Math.abs((entry.bestCaseIrr ?? 0) - medianIrr) / maxSwing) * 50}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right shrink-0">
                        <span className="text-xs font-mono text-white">{(entry.irrSwingPct ?? 0).toFixed(1)}pp</span>
                        <div className="text-xs text-slate-600 font-mono">
                          {(entry.worstCaseIrr ?? 0).toFixed(1)}% → {(entry.bestCaseIrr ?? 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Failure Drivers ── */}
          <TabsContent value="drivers">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  Failure Drivers — Marginal Rejection Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {failureDrivers.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No failure driver data available</p>
                ) : (
                  failureDrivers.map((d: any, i: number) => (
                    <div key={d.dimensionKey ?? i} className="flex items-center gap-4 p-3 rounded-lg bg-white/3">
                      <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                        <span className="text-xs text-red-400 font-mono">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white mb-1">{d.dimensionName ?? d.dimensionKey}</div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-red-500/50 rounded-full"
                            style={{ width: `${Math.min(100, d.rejectionRateDelta ?? 0)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono text-red-400">+{(d.rejectionRateDelta ?? 0).toFixed(1)}pp</div>
                        <div className="text-xs text-slate-500 font-mono">{(d.irrSwingPct ?? 0).toFixed(1)}pp IRR swing</div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Approval Pathway ── */}
          <TabsContent value="pathway">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Approval Pathway — Reverse Optimization
                </CardTitle>
                <p className="text-xs text-slate-500">What must change for this deal to achieve approval?</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {approvalPathway.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No approval pathway data available</p>
                ) : (
                  approvalPathway.map((c: any) => (
                    <div key={c.dimensionKey} className="p-4 rounded-xl border border-white/5 bg-white/3">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white mb-0.5">{c.dimensionName}</div>
                          <div className="text-xs text-slate-500">
                            Current: <span className="text-red-400">{c.currentValue}</span>
                            {" → "}
                            Required: <span className="text-emerald-400">{c.requiredValue}</span>
                          </div>
                          {c.rationale && <div className="text-xs text-slate-600 mt-1">{c.rationale}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-mono text-emerald-400">+{(c.approvalImpactPct ?? 0).toFixed(1)}pp</div>
                          <Badge className={`text-xs border mt-1 ${
                            c.interventionCost === "CRITICAL" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                            c.interventionCost === "HIGH" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                            "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          }`}>{c.interventionCost}</Badge>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/50 rounded-full"
                          style={{ width: `${Math.min(100, (c.approvalImpactPct ?? 0) * 2)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Governance Audit ── */}
          <TabsContent value="governance">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Governance Audit — Hard NO Trigger Frequencies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!governanceAudit ? (
                  <p className="text-xs text-slate-500 text-center py-6">No governance audit data available</p>
                ) : Array.isArray(governanceAudit) ? (
                  governanceAudit.map((g: any) => (
                    <div key={g.triggerKey ?? g.triggerLabel} className="flex items-center gap-4 p-3 rounded-lg bg-white/3">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white mb-1">{g.triggerLabel}</div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-red-500/40 rounded-full"
                            style={{ width: `${Math.min(100, (g.frequency ?? 0) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono text-red-400">{((g.frequency ?? 0) * 100).toFixed(1)}%</div>
                        <div className="text-xs text-slate-500 font-mono">{(g.count ?? 0).toLocaleString()} scenarios</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <pre className="text-xs text-slate-400 font-mono bg-white/3 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(governanceAudit, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Sampled Scenarios ── */}
          <TabsContent value="scenarios">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Sampled Scenarios ({scenarios.length} shown)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-slate-500 pb-2 pr-4">#</th>
                        <th className="text-right text-slate-500 pb-2 pr-4">IRR</th>
                        <th className="text-right text-slate-500 pb-2 pr-4">Decision</th>
                        <th className="text-right text-slate-500 pb-2">Risk Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/3">
                      {scenarios.slice(0, 100).map((s: any) => (
                        <tr key={s.id} className="hover:bg-white/2">
                          <td className="py-1.5 pr-4 text-slate-600">{s.scenarioIndex}</td>
                          <td className={`py-1.5 pr-4 text-right ${parseFloat(s.irrPct ?? "0") >= 15 ? "text-emerald-400" : "text-red-400"}`}>
                            {parseFloat(s.irrPct ?? "0").toFixed(1)}%
                          </td>
                          <td className="py-1.5 pr-4 text-right">
                            <DecisionBadge decision={s.decision} />
                          </td>
                          <td className="py-1.5 text-right text-slate-500">{s.dominantRiskCategory ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scenarios.length > 100 && (
                    <p className="text-xs text-slate-600 mt-3 text-center">
                      Showing 100 of {scenarios.length} sampled scenarios. Export JSON for full dataset.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reproducibility ── */}
          <TabsContent value="manifest">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Reproducibility Manifest
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!reproManifest ? (
                  <p className="text-xs text-slate-500 text-center py-6">No reproducibility manifest available</p>
                ) : (
                  <pre className="text-xs text-slate-400 font-mono bg-white/3 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(reproManifest, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
