import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import { useAuth } from "@/_core/hooks/useAuth";
import GateScreen from "@/components/GateScreen";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StepStatus = "pending" | "running" | "complete" | "failed";

interface StepData {
  agentId: string;
  agentName: string;
  status: StepStatus;
  output?: string;
  confidence?: number;
  entities?: string[];
  warnings?: string[];
  tokenCount?: number;
  durationMs?: number;
}

interface RunState {
  status: "idle" | "running" | "complete" | "failed";
  steps: StepData[];
  icDecision?: "INVEST" | "WATCH" | "REJECT";
  confidenceScore?: number;
  riskScore?: number;
  totalTokens?: number;
  durationMs?: number;
  error?: string;
}

const DECISION_COLORS = {
  INVEST: { bg: "bg-emerald-500", text: "text-emerald-300", border: "border-emerald-500/40", glow: "shadow-emerald-500/30" },
  WATCH: { bg: "bg-amber-500", text: "text-amber-300", border: "border-amber-500/40", glow: "shadow-amber-500/30" },
  REJECT: { bg: "bg-red-500", text: "text-red-300", border: "border-red-500/40", glow: "shadow-red-500/30" },
};

const WORKFLOW_LABELS: Record<string, string> = {
  ic_decision: "IC Decision Engine",
  guardian: "Guardian Mode",
  crisis: "Crisis Simulation",
};

export default function PortfolioIntelRun() {
  const { user, loading } = useAuth();
  const params = useParams<{ runType: string; runId: string }>();
  const [, setLocation] = useLocation();
  const runType = params.runType;
  const runId = parseInt(params.runId || "0");

  const [runState, setRunState] = useState<RunState>({ status: "idle", steps: [] });
  const [activeStepIdx, setActiveStepIdx] = useState<number>(-1);
  const [commitFlash, setCommitFlash] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const dossierRef = useRef<HTMLDivElement>(null);
  const portfolioRunId = `portfolio-${runId}`;
  const exportMutation = trpc.dossier.generate.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
  });

  useEffect(() => {
    if (!runId || loading || !user) return;

    // Connect to SSE stream
    const es = new EventSource(`/api/portfolio/stream/${runType}/${runId}`);
    eventSourceRef.current = es;

    es.addEventListener("pipeline_start", (e) => {
      const data = JSON.parse(e.data);
      setRunState(prev => ({
        ...prev,
        status: "running",
        steps: data.agents.map((a: { id: string; name: string }) => ({
          agentId: a.id,
          agentName: a.name,
          status: "pending" as StepStatus,
        })),
      }));
    });

    es.addEventListener("step_start", (e) => {
      const data = JSON.parse(e.data);
      setActiveStepIdx(data.stepIndex);
      setRunState(prev => {
        const steps = [...prev.steps];
        if (steps[data.stepIndex]) {
          steps[data.stepIndex] = { ...steps[data.stepIndex], status: "running" };
        }
        return { ...prev, steps };
      });
    });

    es.addEventListener("step_complete", (e) => {
      const data = JSON.parse(e.data);
      setRunState(prev => {
        const steps = [...prev.steps];
        if (steps[data.stepIndex]) {
          steps[data.stepIndex] = {
            ...steps[data.stepIndex],
            status: "complete",
            output: data.output,
            confidence: data.confidence,
            entities: data.entities,
            warnings: data.warnings,
            tokenCount: data.tokenCount,
            durationMs: data.durationMs,
          };
        }
        return { ...prev, steps };
      });
      setCommitFlash(data.stepIndex);
      setTimeout(() => setCommitFlash(null), 1200);
      // Auto-scroll dossier
      setTimeout(() => {
        dossierRef.current?.scrollTo({ top: dossierRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    });

    es.addEventListener("step_failed", (e) => {
      const data = JSON.parse(e.data);
      setRunState(prev => {
        const steps = [...prev.steps];
        if (steps[data.stepIndex]) {
          steps[data.stepIndex] = { ...steps[data.stepIndex], status: "failed", output: data.error };
        }
        return { ...prev, steps };
      });
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setRunState(prev => ({
        ...prev,
        status: "complete",
        icDecision: data.icDecision,
        confidenceScore: data.confidenceScore,
        riskScore: data.riskScore,
        totalTokens: data.totalTokens,
        durationMs: data.durationMs,
      }));
      setActiveStepIdx(-1);
      es.close();
    });

    es.addEventListener("failed", (e) => {
      const data = JSON.parse(e.data);
      setRunState(prev => ({ ...prev, status: "failed", error: data.error }));
      es.close();
    });

    es.onerror = () => {
      // If SSE fails, try polling the status endpoint
      es.close();
    };

    return () => {
      es.close();
    };
  }, [runId, loading, user]);

  if (loading) return null;
  if (!user) return <GateScreen />;

  const decisionStyle = runState.icDecision ? DECISION_COLORS[runState.icDecision] : null;
  const completedSteps = runState.steps.filter(s => s.status === "complete").length;
  const totalSteps = runState.steps.length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />

      {/* Top Bar */}
      <div className="border-b border-slate-800 bg-slate-900/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/portfolio/intel")}
              className="text-slate-400 hover:text-white text-sm"
            >
              ← Portfolio Intelligence
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-sm text-white font-medium">
              {WORKFLOW_LABELS[runType] || runType}
            </span>
            <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
              Run #{runId}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {runState.status === "running" && (
              <div className="flex items-center gap-2 text-sm text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {completedSteps}/{totalSteps} agents complete
              </div>
            )}
            {runState.status === "complete" && (
              <Button
                size="sm"
                onClick={() => exportMutation.mutate({ sessionId: portfolioRunId })}
                disabled={exportMutation.isPending}
                className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs"
              >
                {exportMutation.isPending ? "Generating..." : "⬇ Export Dossier"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Pipeline Rail + Dossier */}
          <div className="lg:col-span-2 space-y-6">

            {/* Workflow Rail */}
            {runState.steps.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  Agent Pipeline
                </h3>
                <div className="flex flex-wrap gap-2">
                  {runState.steps.map((step, idx) => {
                    const isActive = idx === activeStepIdx;
                    const isFlashing = commitFlash === idx;
                    return (
                      <div
                        key={step.agentId}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-500 ${
                          step.status === "complete"
                            ? isFlashing
                              ? "bg-emerald-400/20 border-emerald-400 text-emerald-300 scale-105"
                              : "bg-emerald-900/30 border-emerald-700/50 text-emerald-400"
                            : step.status === "running"
                            ? "bg-cyan-900/30 border-cyan-500 text-cyan-300 animate-pulse"
                            : step.status === "failed"
                            ? "bg-red-900/30 border-red-700/50 text-red-400"
                            : "bg-slate-800 border-slate-700 text-slate-500"
                        }`}
                      >
                        {step.status === "complete" ? "✓" : step.status === "running" ? "●" : step.status === "failed" ? "✗" : `${idx + 1}`}
                        <span className="hidden sm:inline">{step.agentName}</span>
                      </div>
                    );
                  })}
                </div>
                {runState.status === "running" && totalSteps > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Progress</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* IC Decision Banner */}
            {runState.status === "complete" && runState.icDecision && decisionStyle && (
              <div className={`rounded-xl border ${decisionStyle.border} bg-slate-900 p-6 shadow-lg ${decisionStyle.glow}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">IC Decision</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-5xl font-black ${decisionStyle.text}`}>
                        {runState.icDecision}
                      </span>
                      {runState.confidenceScore && (
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Confidence</p>
                          <p className="text-2xl font-bold text-white">{runState.confidenceScore}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {runState.riskScore !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400 mb-1">Risk Score</p>
                      <div className={`text-3xl font-bold ${runState.riskScore > 70 ? "text-red-400" : runState.riskScore > 40 ? "text-amber-400" : "text-emerald-400"}`}>
                        {runState.riskScore}/100
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Live Dossier */}
            <div
              ref={dossierRef}
              className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-h-[600px] overflow-y-auto space-y-4"
            >
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-900 pb-2">
                Live Dossier
              </h3>

              {runState.steps.filter(s => s.status === "complete" && s.output).map((step, idx) => (
                <div
                  key={step.agentId}
                  className="border border-slate-700/50 rounded-lg p-4 bg-slate-800/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-white">{step.agentName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {step.confidence && (
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                          {step.confidence}% conf.
                        </Badge>
                      )}
                      {step.durationMs && (
                        <span className="text-xs text-slate-500">{(step.durationMs / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                  </div>

                  {step.entities && step.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {step.entities.map((e, i) => (
                        <span key={i} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/30 rounded px-2 py-0.5">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {step.output}
                  </p>

                  {step.warnings && step.warnings.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {step.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                          <span>⚠</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {runState.steps.some(s => s.status === "running") && (
                <div className="flex items-center gap-3 p-4 bg-cyan-900/20 border border-cyan-700/30 rounded-lg">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-cyan-300">
                    {runState.steps.find(s => s.status === "running")?.agentName} is analyzing...
                  </span>
                </div>
              )}

              {runState.status === "idle" && runState.steps.length === 0 && (
                <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
                  Connecting to pipeline...
                </div>
              )}

              {runState.status === "failed" && (
                <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg text-red-300 text-sm">
                  Pipeline failed: {runState.error || "Unknown error"}
                </div>
              )}
            </div>
          </div>

          {/* Right: Side Panel */}
          <div className="space-y-4">

            {/* Run Metadata */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Run Info</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Workflow</span>
                  <span className="text-white">{WORKFLOW_LABELS[runType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Run ID</span>
                  <span className="text-white">#{runId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={`font-medium ${
                    runState.status === "complete" ? "text-emerald-400" :
                    runState.status === "running" ? "text-cyan-400" :
                    runState.status === "failed" ? "text-red-400" : "text-slate-400"
                  }`}>
                    {runState.status.toUpperCase()}
                  </span>
                </div>
                {runState.totalTokens && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tokens used</span>
                    <span className="text-white">{runState.totalTokens.toLocaleString()}</span>
                  </div>
                )}
                {runState.durationMs && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration</span>
                    <span className="text-white">{Math.round(runState.durationMs / 1000)}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Steps Summary */}
            {runState.steps.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Agent Steps</h4>
                <div className="space-y-2">
                  {runState.steps.map((step, idx) => (
                    <div key={step.agentId} className="flex items-center gap-2 text-xs">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        step.status === "complete" ? "bg-emerald-500/20 text-emerald-400" :
                        step.status === "running" ? "bg-cyan-500/20 text-cyan-400 animate-pulse" :
                        step.status === "failed" ? "bg-red-500/20 text-red-400" :
                        "bg-slate-700 text-slate-500"
                      }`}>
                        {step.status === "complete" ? "✓" : step.status === "failed" ? "✗" : idx + 1}
                      </span>
                      <span className={`truncate ${
                        step.status === "complete" ? "text-slate-300" :
                        step.status === "running" ? "text-cyan-300" :
                        "text-slate-500"
                      }`}>
                        {step.agentName}
                      </span>
                      {step.tokenCount && (
                        <span className="text-slate-600 shrink-0">{step.tokenCount}t</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings Accumulator */}
            {runState.steps.some(s => s.warnings && s.warnings.length > 0) && (
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3">⚠ Risk Flags</h4>
                <div className="space-y-1">
                  {runState.steps.flatMap(s => s.warnings || []).map((w, i) => (
                    <p key={i} className="text-xs text-amber-300">{w}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {runState.status === "complete" && (
              <div className="space-y-2">
                <Button
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-sm"
                  onClick={() => exportMutation.mutate({ sessionId: portfolioRunId })}
                  disabled={exportMutation.isPending}
                >
                  {exportMutation.isPending ? "Generating PDF..." : "⬇ Export Clinical Dossier"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-sm border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={() => setLocation("/portfolio/intel")}
                >
                  ← New Analysis
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
