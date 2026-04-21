import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, BarChart3, Brain, ChevronRight, Clock, Flame, Layers, TrendingUp, Zap } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function stageLabel(stage: string) {
  const map: Record<string, string> = {
    triaged: "Triaged",
    diligence: "Diligence",
    ic_ready: "IC Ready",
    decision_made: "Decided",
    archived: "Archived",
  };
  return map[stage] ?? stage;
}

function stageColor(stage: string) {
  const map: Record<string, string> = {
    triaged: "bg-slate-700 text-slate-200",
    diligence: "bg-amber-900/60 text-amber-300",
    ic_ready: "bg-blue-900/60 text-blue-300",
    decision_made: "bg-emerald-900/60 text-emerald-300",
    archived: "bg-slate-800 text-slate-400",
  };
  return map[stage] ?? "bg-slate-700 text-slate-200";
}

function scoreColor(score: number) {
  if (score >= 65) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function relativeTime(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function triggerBadge(triggerType: string | null) {
  if (!triggerType) return null;
  const labels: Record<string, string> = {
    stale_diligence: "Stale",
    stale_ic_ready: "IC Stale",
    score_drop: "Score Drop",
    pattern_shift: "Pattern Shift",
  };
  return labels[triggerType] ?? triggerType;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.pitch.commandCenter.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const firstName = user?.name?.split(" ")[0] ?? "Analyst";

  const pipelineTotal =
    (data?.pipelineCounts.triaged ?? 0) +
    (data?.pipelineCounts.diligence ?? 0) +
    (data?.pipelineCounts.ic_ready ?? 0) +
    (data?.pipelineCounts.decision_made ?? 0);

  return (
    <div className="min-h-screen bg-[#0d0f14] text-slate-100 p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
            Command Center
          </p>
          <h1 className="text-2xl font-bold text-white">
            Good morning, {firstName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
          onClick={() => navigate("/pitch-triage")}
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" />
          New Triage
        </Button>
      </div>

      {/* ── Zone 1: Needs Attention ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400">
            Needs Attention
          </h2>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full bg-slate-800" />
            ))}
          </div>
        ) : !data?.needsAttention.length ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-500">
            No deals need attention right now.
          </div>
        ) : (
          <div className="grid gap-3">
            {data.needsAttention.map((deal) => {
              const trigger = triggerBadge(deal.triggerType);
              return (
                <button
                  key={deal.id}
                  onClick={() => navigate("/pitch-triage")}
                  className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 transition-colors p-4 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`text-lg font-bold tabular-nums ${scoreColor(deal.score)}`}>
                      {deal.score}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate max-w-xs">
                        {deal.pitchPreview.slice(0, 60).trim()}…
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${stageColor(deal.stage)}`}>
                          {stageLabel(deal.stage)}
                        </span>
                        {trigger && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
                            {trigger}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                          {relativeTime(deal.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Zone 2: Pipeline Pulse ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Pipeline Pulse
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading
            ? [1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full bg-slate-800" />
              ))
            : [
                {
                  label: "Triaged",
                  count: data?.pipelineCounts.triaged ?? 0,
                  color: "text-slate-300",
                  bg: "bg-slate-800/60",
                  border: "border-slate-700",
                },
                {
                  label: "Diligence",
                  count: data?.pipelineCounts.diligence ?? 0,
                  color: "text-amber-300",
                  bg: "bg-amber-900/20",
                  border: "border-amber-900/40",
                },
                {
                  label: "IC Ready",
                  count: data?.pipelineCounts.ic_ready ?? 0,
                  color: "text-blue-300",
                  bg: "bg-blue-900/20",
                  border: "border-blue-900/40",
                },
                {
                  label: "Decided",
                  count: data?.pipelineCounts.decision_made ?? 0,
                  color: "text-emerald-300",
                  bg: "bg-emerald-900/20",
                  border: "border-emerald-900/40",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl border ${item.border} ${item.bg} p-4`}
                >
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  <p className={`text-3xl font-bold tabular-nums ${item.color}`}>
                    {item.count}
                  </p>
                  {pipelineTotal > 0 && (
                    <p className="text-[10px] text-slate-600 mt-1">
                      {Math.round((item.count / pipelineTotal) * 100)}% of pipeline
                    </p>
                  )}
                </div>
              ))}
        </div>

        <button
          onClick={() => navigate("/pitch-triage")}
          className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 transition-colors p-3 flex items-center justify-between text-sm text-slate-400 group"
        >
          <span>View full pipeline</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </section>

      {/* ── Zone 3: Evaluate + Signal Feed ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Evaluate CTA */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Evaluate
            </h2>
          </div>
          <div className="rounded-xl border border-violet-900/40 bg-violet-900/10 p-6 flex flex-col gap-4">
            <p className="text-sm text-slate-300">
              Run a new deal through the 6-agent triage pipeline. Results in under 30 seconds.
            </p>
            <div className="flex gap-3">
              <Button
                className="bg-violet-600 hover:bg-violet-500 text-white flex-1"
                onClick={() => navigate("/pitch-triage")}
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                New Triage
              </Button>
              <Button
                variant="outline"
                className="border-violet-800 text-violet-300 hover:bg-violet-900/30 flex-1"
                onClick={() => navigate("/intelligence")}
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                Intelligence
              </Button>
            </div>
            {data && (
              <div className="flex items-center gap-2 text-xs text-slate-500 border-t border-slate-800 pt-3 mt-1">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>
                  {data.autoTriggerCount30d} auto-triggers fired in the last 30 days
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Recent Signal Feed */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Recent Signals
            </h2>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full bg-slate-800" />
                ))}
              </div>
            ) : !data?.recentSignals.length ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No signals logged yet.
              </div>
            ) : (
              data.recentSignals.slice(0, 6).map((sig) => (
                <div key={sig.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-300 truncate">
                      {sig.signalType}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-xs">
                      {sig.signalText.slice(0, 80)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <Badge
                      variant="outline"
                      className="text-[9px] border-slate-700 text-slate-500 px-1.5 py-0"
                    >
                      {sig.source}
                    </Badge>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {relativeTime(sig.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
