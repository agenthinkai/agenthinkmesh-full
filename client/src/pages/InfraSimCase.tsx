import { toast } from "sonner";
/**
 * InfraSimCase.tsx
 * Governed Infrastructure Stress Simulation v2 — Case Detail Page
 */

import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Clock,
  Cpu,
  Play,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const SCENARIO_COUNTS = [1000, 5000, 10000, 25000, 50000, 90000];

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "APPROVE")
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono">APPROVE</Badge>;
  if (decision === "CONDITIONAL")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-mono">CONDITIONAL</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono">REJECT</Badge>;
}

export default function InfraSimCase() {
  const { id } = useParams<{ id: string }>();
  const caseId = parseInt(id!, 10);
  const [, navigate] = useLocation();
  const [scenarioCount, setScenarioCount] = useState(10000);
  const [runningCouncil, setRunningCouncil] = useState(false);

  const { data: caseData, isLoading, refetch } = trpc.infraSim.getCase.useQuery({ caseId });
  const { data: runs, refetch: refetchRuns } = trpc.infraSim.listRuns.useQuery({ caseId });

  const startRun = trpc.infraSim.startRun.useMutation({
    onSuccess: (data) => {
      const r = data.result;
      toast.success(`Simulation complete: ${r.totalScenarios.toLocaleString()} scenarios · Reject: ${(r.rejectRate * 100).toFixed(1)}%`);
      refetch();
      refetchRuns();
    },
    onError: (e) => toast.error(`Simulation failed: ${e.message}`),
  });

  const startCouncil = trpc.infraSim.startCouncilDeliberation.useMutation({
    onSuccess: (data) => {
      toast.success(`Council deliberation complete: Session ${data.sessionId}`);
      setRunningCouncil(false);
      navigate(`/infra-sim/council/${data.sessionId}`);
    },
    onError: (e) => {
      toast.error(`Council failed: ${e.message}`);
      setRunningCouncil(false);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">Loading case…</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-400">Case not found</p>
          <Button size="sm" variant="ghost" onClick={() => navigate("/infra-sim")} className="mt-3 text-xs">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { simCase, dimensions, runs: caseRuns } = caseData;
  const latestRun = caseRuns?.[0];
  const latestRunResult = latestRun
    ? {
        id: latestRun.id,
        totalScenarios: latestRun.completedCount ?? 0,
        approveRate: latestRun.completedCount ? (latestRun.approveCount ?? 0) / latestRun.completedCount : 0,
        conditionalRate: latestRun.completedCount ? (latestRun.conditionalCount ?? 0) / latestRun.completedCount : 0,
        rejectRate: latestRun.completedCount ? (latestRun.rejectCount ?? 0) / latestRun.completedCount : 0,
        medianIrrPct: parseFloat(latestRun.medianIrrPct ?? "0"),
        p10IrrPct: parseFloat(latestRun.p10IrrPct ?? "0"),
        p90IrrPct: parseFloat(latestRun.p90IrrPct ?? "0"),
        irrMin: parseFloat(latestRun.p10IrrPct ?? "0"),
        irrMax: parseFloat(latestRun.p90IrrPct ?? "0"),
        dominantDecision: latestRun.rejectCount && latestRun.completedCount && (latestRun.rejectCount / latestRun.completedCount) > 0.5
          ? "REJECT"
          : latestRun.approveCount && latestRun.completedCount && (latestRun.approveCount / latestRun.completedCount) > 0.5
          ? "APPROVE"
          : "CONDITIONAL",
        dimensionCount: dimensions.length,
        failureDrivers: latestRun.topFailureDriversJson ? JSON.parse(latestRun.topFailureDriversJson) : [],
        approvalPathway: latestRun.approvalPathwayJson ? JSON.parse(latestRun.approvalPathwayJson) : [],
      }
    : null;

  const baseIrr = parseFloat(simCase.baseIrrPct ?? "0");
  const fundMin = parseFloat(simCase.fundMinIrrPct ?? "15");

  return (
    <div className="min-h-screen bg-[#0B1629] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1a2e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate("/infra-sim")} className="text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white">{simCase.title}</h1>
              {latestRunResult && <DecisionBadge decision={latestRunResult.dominantDecision} />}
              <DecisionBadge decision={simCase.icDecision ?? "PENDING"} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono ml-7">
            <span>{simCase.assetClass}</span>
            {simCase.geography && <><span>·</span><span>{simCase.geography}</span></>}
            {simCase.totalCapexGbpM && <><span>·</span><span>£{parseFloat(simCase.totalCapexGbpM).toLocaleString()}M</span></>}
            <span>·</span>
            <span>Base IRR {baseIrr.toFixed(1)}%</span>
            <span>·</span>
            <span>Fund min {fundMin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="overview">
          <TabsList className="bg-white/5 border border-white/5 mb-6">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">Overview</TabsTrigger>
            <TabsTrigger value="runs" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Runs {runs && runs.length > 0 && `(${runs.length})`}
            </TabsTrigger>
            <TabsTrigger value="dimensions" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Dimensions ({dimensions.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Run Simulation Panel */}
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  Run Stress Simulation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Scenario Count</span>
                    <span className="text-xs font-mono text-white">{scenarioCount.toLocaleString()} scenarios</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {SCENARIO_COUNTS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setScenarioCount(n)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                          scenarioCount === n
                            ? "bg-blue-600 text-white"
                            : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {n >= 1000 ? `${n / 1000}k` : n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                    disabled={startRun.isPending}
                    onClick={() => startRun.mutate({ caseId, targetCount: scenarioCount })}
                  >
                    {startRun.isPending ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running {scenarioCount.toLocaleString()} scenarios…</>
                    ) : (
                      <><Play className="w-3.5 h-3.5" />Run {scenarioCount.toLocaleString()} Scenarios</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-slate-300 hover:bg-white/5 text-xs gap-1.5"
                    disabled={startCouncil.isPending || runningCouncil || !latestRunResult}
                    onClick={() => {
                      setRunningCouncil(true);
                      startCouncil.mutate({ caseId, runId: latestRunResult!.id });
                    }}
                  >
                    {runningCouncil ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Council deliberating…</>
                    ) : (
                      <><Users className="w-3.5 h-3.5" />Run Council Deliberation</>
                    )}
                  </Button>
                  {latestRunResult && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white text-xs gap-1.5"
                      onClick={() => navigate(`/infra-sim/monitor/${caseId}`)}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Monitoring
                    </Button>
                  )}
                </div>
                {!latestRunResult && (
                  <p className="text-xs text-slate-500">Run a simulation first to enable council deliberation.</p>
                )}
              </CardContent>
            </Card>

            {/* Latest Run Summary */}
            {latestRunResult ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Decision Distribution */}
                <Card className="bg-[#0d1a2e] border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Decision Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "REJECT", rate: latestRunResult.rejectRate, color: "bg-red-500/40", textColor: "text-red-400" },
                      { label: "CONDITIONAL", rate: latestRunResult.conditionalRate, color: "bg-amber-500/40", textColor: "text-amber-400" },
                      { label: "APPROVE", rate: latestRunResult.approveRate, color: "bg-emerald-500/40", textColor: "text-emerald-400" },
                    ].map(({ label, rate, color, textColor }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className={`w-24 text-xs font-mono ${textColor}`}>{label}</div>
                        <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                          <div className={`h-full ${color} rounded`} style={{ width: `${rate * 100}%` }} />
                        </div>
                        <div className={`w-12 text-right text-xs font-mono ${textColor}`}>
                          {(rate * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/5 text-xs text-slate-500 font-mono">
                      {latestRunResult.totalScenarios.toLocaleString()} scenarios · {latestRunResult.dimensionCount} dimensions
                    </div>
                  </CardContent>
                </Card>

                {/* IRR Summary */}
                <Card className="bg-[#0d1a2e] border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wide">IRR Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "P10", value: latestRunResult.p10IrrPct },
                      { label: "Median", value: latestRunResult.medianIrrPct, highlight: true },
                      { label: "P90", value: latestRunResult.p90IrrPct },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-mono">{label}</span>
                        <span className={`text-sm font-mono ${
                          highlight
                            ? value >= fundMin ? "text-emerald-400" : "text-red-400"
                            : "text-slate-400"
                        }`}>
                          {value.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/5 text-xs text-slate-500">
                      Fund minimum: <span className="text-blue-400">{fundMin}%</span>
                      {" · "}
                      Median is <span className={latestRunResult.medianIrrPct >= fundMin ? "text-emerald-400" : "text-red-400"}>
                        {latestRunResult.medianIrrPct >= fundMin ? "above" : "below"} threshold
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Failure Drivers */}
                {latestRunResult.failureDrivers?.length > 0 && (
                  <Card className="bg-[#0d1a2e] border-white/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        Top Failure Drivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {latestRunResult.failureDrivers.slice(0, 5).map((d: any, i: number) => (
                        <div key={d.dimensionKey ?? i} className="flex items-center gap-3">
                          <div className="w-4 text-xs text-slate-600 font-mono">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white truncate">{d.dimensionName ?? d.dimensionKey}</div>
                            <div className="h-1 mt-1 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min(100, (d.rejectionRateDelta ?? 0))}%` }} />
                            </div>
                          </div>
                          <div className="text-xs font-mono text-red-400 shrink-0">
                            +{(d.rejectionRateDelta ?? 0).toFixed(1)}pp
                          </div>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full mt-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 gap-1"
                        onClick={() => navigate(`/infra-sim/run/${latestRunResult.id}`)}
                      >
                        View Full Analysis <ChevronRight className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Approval Pathway */}
                {latestRunResult.approvalPathway?.length > 0 && (
                  <Card className="bg-[#0d1a2e] border-white/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        Approval Pathway
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {latestRunResult.approvalPathway.slice(0, 4).map((c: any) => (
                        <div key={c.dimensionKey} className="flex items-start gap-3 p-2 rounded-lg bg-white/3">
                          <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                            c.interventionCost === "CRITICAL" ? "bg-red-400" :
                            c.interventionCost === "HIGH" ? "bg-amber-400" :
                            c.interventionCost === "MEDIUM" ? "bg-yellow-400" : "bg-emerald-400"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white">{c.dimensionName}</div>
                            <div className="text-xs text-slate-500 truncate">→ {c.requiredValue}</div>
                          </div>
                          <div className="text-xs font-mono text-emerald-400 shrink-0">
                            +{(c.approvalImpactPct ?? 0).toFixed(1)}pp
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="bg-[#0d1a2e] border-dashed border-white/10">
                <CardContent className="p-10 text-center">
                  <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 mb-1">No simulation runs yet</p>
                  <p className="text-xs text-slate-600">Run a stress simulation above to see results</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Runs Tab ── */}
          <TabsContent value="runs" className="space-y-3">
            {!runs || runs.length === 0 ? (
              <Card className="bg-[#0d1a2e] border-dashed border-white/10">
                <CardContent className="p-10 text-center">
                  <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No simulation runs yet</p>
                </CardContent>
              </Card>
            ) : (
              runs.map((run: any) => (
                <div
                  key={run.id}
                  className="group rounded-xl border border-white/5 bg-[#0d1a2e] hover:border-blue-500/30 hover:bg-[#0f1e35] transition-all cursor-pointer p-5"
                  onClick={() => navigate(`/infra-sim/run/${run.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DecisionBadge decision={run.dominantDecision} />
                      <span className="text-xs font-mono text-slate-400">{run.totalScenarios.toLocaleString()} scenarios</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500 font-mono">
                        Reject {(run.rejectRate * 100).toFixed(1)}% · Median IRR {run.medianIrrPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(run.createdAt).toLocaleDateString()}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ── Dimensions Tab ── */}
          <TabsContent value="dimensions" className="space-y-3">
            {dimensions.map((dim: any) => (
              <Card key={dim.id} className="bg-[#0d1a2e] border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{dim.name}</span>
                      <Badge className="bg-white/5 text-slate-400 border-white/10 text-xs">{dim.category}</Badge>
                    </div>
                    <span className="text-xs text-slate-600 font-mono">{dim.key}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(JSON.parse(dim.valuesJson) as any[]).map((v: any) => (
                      <div key={v.label} className={`px-2 py-1 rounded text-xs font-mono ${
                        v.isHardNo ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        v.irrDeltaPct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {v.label} ({v.irrDeltaPct >= 0 ? "+" : ""}{v.irrDeltaPct}pp)
                        {v.isHardNo && " ⚠"}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
