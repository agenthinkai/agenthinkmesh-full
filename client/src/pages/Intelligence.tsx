import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { skipToken } from "@tanstack/react-query";
import { Activity, BarChart3, Brain, CheckCircle2, Flame, TrendingUp, XCircle } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function signalColor(signal: string) {
  if (signal === "high") return "text-emerald-400";
  if (signal === "moderate") return "text-amber-400";
  if (signal === "low") return "text-red-400";
  return "text-slate-500";
}

function signalBg(signal: string) {
  if (signal === "high") return "bg-emerald-900/30 border-emerald-900/50";
  if (signal === "moderate") return "bg-amber-900/30 border-amber-900/50";
  if (signal === "low") return "bg-red-900/20 border-red-900/40";
  return "bg-slate-800/60 border-slate-700";
}

function signalLabel(signal: string) {
  if (signal === "high") return "High Reliability";
  if (signal === "moderate") return "Moderate";
  if (signal === "low") return "Low Signal";
  return "Insufficient Data";
}

function relativeTime(date: Date | string) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Intelligence() {
  const { data: calibration, isLoading: calLoading } =
    trpc.pitch.agentCalibration.useQuery(undefined, { refetchInterval: 120_000 });

  // patternInsight requires currentAgentOutputs — skip it on the Intelligence page
  // (it is designed for per-deal context; we show a placeholder here instead)
  const patternData = null;
  const patternLoading = false;

  const { data: signalSummary, isLoading: signalLoading } =
    trpc.pitch.signalTypeSummary.useQuery(undefined, { refetchInterval: 120_000 });

  const { data: triggerData } =
    trpc.pitch.autoTriggerCount.useQuery(undefined, { refetchInterval: 120_000 });

  // Sort signal types by count descending
  const signalEntries = signalSummary
    ? Object.entries(signalSummary).sort((a, b) => b[1] - a[1])
    : [];

  const totalSignals = signalEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="min-h-screen bg-[#0d0f14] text-slate-100 p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
          Intelligence
        </p>
        <h1 className="text-2xl font-bold text-white">Agent Intelligence</h1>
        <p className="text-sm text-slate-400 mt-1">
          Calibration signals, pattern insights, and trigger activity across your pipeline.
        </p>
      </div>

      {/* ── Row 1: Agent Reliability + Pattern Signals ── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Agent Reliability */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Agent Reliability
            </h2>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800">
            {calLoading
              ? [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-5 w-full bg-slate-800" />
                  </div>
                ))
              : calibration?.map((agent) => (
                  <div
                    key={agent.agentName}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {agent.signal === "high" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : agent.signal === "low" ? (
                        <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-200">
                        {agent.agentName}
                      </span>
                      {agent.outcomeGrounded && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-emerald-900/50 text-emerald-500 px-1.5 py-0"
                        >
                          outcome-grounded
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold ${signalColor(agent.signal)}`}>
                        {signalLabel(agent.signal)}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        n={agent.sampleSize}
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        </section>

        {/* Pattern Signals */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-400">
              Pattern Signals
            </h2>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            {patternLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 bg-slate-800" />
                ))}
              </div>
            ) : !patternData || (typeof patternData === "object" && "error" in patternData) ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Not enough outcome data yet. Record decisions on deals to unlock pattern insights.
              </p>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed bg-transparent p-0">
                  {typeof patternData === "string"
                    ? patternData
                    : JSON.stringify(patternData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Row 2: Trigger Activity + Signal Type Breakdown ── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Trigger Activity */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-orange-400">
              Trigger Activity (30d)
            </h2>
          </div>
          <div className="rounded-xl border border-orange-900/30 bg-orange-900/10 p-6 flex items-center gap-6">
            <div>
              <p className="text-5xl font-bold tabular-nums text-orange-300">
                {triggerData?.count ?? 0}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                auto-triggers fired in the last 30 days
              </p>
            </div>
            <div className="flex-1 text-xs text-slate-500 leading-relaxed">
              Auto-triggers fire when a deal becomes stale in diligence or IC-ready, or when a new
              signal causes a score shift. Each trigger re-runs the full 6-agent pipeline.
            </div>
          </div>
        </section>

        {/* Signal Type Breakdown */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Signal Type Breakdown
            </h2>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800">
            {signalLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 bg-slate-800" />
                ))}
              </div>
            ) : !signalEntries.length ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No signals logged yet.
              </div>
            ) : (
              signalEntries.map(([type, count]) => {
                const pct = totalSignals > 0 ? Math.round((count / totalSignals) * 100) : 0;
                return (
                  <div key={type} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-300">{type}</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800">
                      <div
                        className="h-1.5 rounded-full bg-emerald-500/70 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
