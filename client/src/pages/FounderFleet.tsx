/**
 * FounderFleet — /founder-fleet
 *
 * Live dashboard for the FounderAgent Fleet:
 *   - Start / Pause / Resume / Abort controls
 *   - Progress bar + live counters
 *   - Scrolling card feed (last 10 evaluated pitches)
 *   - Stats strip (ENGAGE / WATCH / PASS / avg score)
 *   - Domain breakdown table
 *   - Filterable full results table (sortable, expandable)
 *   - Pattern Extraction Insights panel
 *   - Run history dropdown
 *   - Trend Analytics tab (cross-run domain scores)
 *   - Export CSV button
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────
type Classification = "ENGAGE" | "WATCH" | "PASS";
type RunStatus = "pending" | "generating" | "researching" | "pitching" | "evaluating" | "extracting" | "completed" | "paused" | "failed";

interface EvalCard {
  id: number;
  ideaId: number;
  domain: string;
  subSector: string;
  founderName: string;
  targetRegion: string;
  fundingStage: string;
  classification: Classification | null;
  finalScore: number | null;
  executionScore: number | null;
  marketScore: number | null;
  recommendedAction: string | null;
  strengths: string[];
  concerns: string[];
  flags: string[];
  summary3s: string | null;
  updatedAt: number | null;
}

interface DomainBreakdown {
  count: number;
  avgScore: number;
  engage: number;
  watch: number;
  pass: number;
}

interface FleetRun {
  id: number;
  runDate: string;
  status: RunStatus;
  totalIdeas: number;
  completed: number;
  queued: number;
  running: number;
  totalSearches: number;
  totalLlmCalls: number;
  estimatedTokens: number;
  estimatedCostUsd: string | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number | null;
  fleetMode: string | null; // "global" | "gcc"
  isTestRun: boolean | null; // test runs excluded from pattern engine seeding
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CLASS_CONFIG: Record<Classification, { label: string; color: string; bg: string }> = {
  ENGAGE: { label: "ENGAGE", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  WATCH:  { label: "WATCH",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  PASS:   { label: "PASS",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

const STATUS_LABELS: Record<RunStatus, string> = {
  pending:    "Pending",
  generating: "Generating ideas…",
  researching:"Researching domains…",
  pitching:   "Writing pitches…",
  evaluating: "Evaluating with mesh…",
  extracting: "Extracting insights…",
  completed:  "Completed",
  paused:     "Paused",
  failed:     "Failed",
};

function scoreColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 75) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function fmtTs(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ClassBadge({ cls }: { cls: Classification | null }) {
  if (!cls) return <span className="text-muted-foreground text-xs">—</span>;
  const cfg = CLASS_CONFIG[cls];
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded"
      style={{ color: scoreColor(score), background: `${scoreColor(score)}20` }}
    >
      {score}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #06b6d4)" }}
      />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FounderFleet() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && (!user || (user as { role?: string }).role !== "admin")) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"live" | "table" | "insights" | "trends">("live");
  const [expandedEvalId, setExpandedEvalId] = useState<number | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [sortField, setSortField] = useState<"finalScore" | "domain" | "founderName">("finalScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exportLabel, setExportLabel] = useState("Export CSV");
  // GCC Institutional mode toggle
  const [gccMode, setGccMode] = useState(false);
  const cardFeedRef = useRef<HTMLDivElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const runsQuery = trpc.fleet.runs.useQuery(undefined, { refetchInterval: 30000 });
  const runs = (runsQuery.data ?? []) as FleetRun[];

  // Auto-select latest run
  useEffect(() => {
    if (runs.length > 0 && activeRunId === null) {
      setActiveRunId(runs[0].id);
    }
  }, [runs, activeRunId]);

  const statusQuery = trpc.fleet.status.useQuery(
    { runId: activeRunId! },
    {
      enabled: activeRunId !== null,
      refetchInterval: (data) => {
        const status = (data as { run?: FleetRun })?.run?.status;
        if (!status) return 3000;
        if (["completed", "failed", "paused"].includes(status)) return false;
        return 3000;
      },
    }
  );

  const run = (statusQuery.data?.run ?? null) as FleetRun | null;
  const recentEvals = (statusQuery.data?.recentEvals ?? []) as EvalCard[];
  const domainBreakdown = (statusQuery.data?.domainBreakdown ?? {}) as Record<string, DomainBreakdown>;

  const detailQuery = trpc.fleet.runDetail.useQuery(
    { runId: activeRunId!, limit: 100, offset: 0 },
    { enabled: activeRunId !== null && activeTab === "table" }
  );

  const insightsQuery = trpc.fleet.insights.useQuery(
    { runId: activeRunId! },
    { enabled: activeRunId !== null && activeTab === "insights" }
  );

  const fleetConfigsQuery = trpc.fleet.fleetConfigs.useQuery(undefined, { refetchInterval: 30000 });
  const trendQuery = trpc.fleet.trendStats.useQuery(
    undefined,
    { enabled: activeTab === "trends" }
  );

  const exportCsvQuery = trpc.fleet.exportCsv.useQuery(
    { runId: activeRunId! },
    { enabled: false }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const startMut = trpc.fleet.start.useMutation({
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      runsQuery.refetch();
      statusQuery.refetch();
      toast.success(gccMode ? "🕌 GCC Institutional Fleet run started" : "Fleet run started");
    },
    onError: (e) => toast.error(e.message),
  });

  const quickTestMut = trpc.fleet.start.useMutation({
    onSuccess: (data) => {
      setActiveRunId(data.runId);
      runsQuery.refetch();
      statusQuery.refetch();
      toast.success("Quick Test run started (10 agents)");
    },
    onError: (e) => toast.error(e.message),
  });
  const pauseMut = trpc.fleet.pause.useMutation({
    onSuccess: () => { statusQuery.refetch(); toast.info("Fleet paused"); },
    onError: (e) => toast.error(e.message),
  });

  const resumeMut = trpc.fleet.resume.useMutation({
    onSuccess: () => { statusQuery.refetch(); toast.success("Fleet resumed"); },
    onError: (e) => toast.error(e.message),
  });

  const abortMut = trpc.fleet.abort.useMutation({
    onSuccess: () => { statusQuery.refetch(); toast.warning("Fleet aborted"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Auto-scroll card feed ──────────────────────────────────────────────────
  useEffect(() => {
    if (cardFeedRef.current) {
      cardFeedRef.current.scrollTop = 0;
    }
  }, [recentEvals.length]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = Object.values(domainBreakdown);
    const engage = all.reduce((s, d) => s + d.engage, 0);
    const watch  = all.reduce((s, d) => s + d.watch, 0);
    const pass   = all.reduce((s, d) => s + d.pass, 0);
    const total  = engage + watch + pass;
    const avgScore = total > 0
      ? Math.round(all.reduce((s, d) => s + d.avgScore * d.count, 0) / total)
      : 0;
    return { engage, watch, pass, total, avgScore };
  }, [domainBreakdown]);

  // ── Filtered + sorted table rows ───────────────────────────────────────────
  const tableRows = useMemo(() => {
    const rows = detailQuery.data ?? [];
    const filtered = rows.filter((r) => {
      if (filterDomain !== "all" && r.domain !== filterDomain) return false;
      if (filterClass !== "all" && r.classification !== filterClass) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortField === "finalScore") { av = a.finalScore ?? 0; bv = b.finalScore ?? 0; }
      else if (sortField === "domain") { av = a.domain; bv = b.domain; }
      else if (sortField === "founderName") { av = a.founderName; bv = b.founderName; }
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [detailQuery.data, filterDomain, filterClass, sortField, sortDir]);

  const uniqueDomains = useMemo(() => {
    const rows = detailQuery.data ?? [];
    const domainSet = new Set(rows.map((r) => r.domain));
    return Array.from(domainSet).sort();
  }, [detailQuery.data]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    if (!activeRunId) return;
    const result = await exportCsvQuery.refetch();
    if (!result.data) return;
    const { csv, count } = result.data;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `founder-fleet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLabel(`✓ Exported ${count} rows`);
    setTimeout(() => setExportLabel("Export CSV"), 3000);
  };

  // ── Run controls ───────────────────────────────────────────────────────────
  const isActive = run && !["completed", "failed", "paused"].includes(run.status);
  const isPaused = run?.status === "paused";
  const isIdle = !run || ["completed", "failed"].includes(run.status);

  if (authLoading) return null;
  if (!user || (user as { role?: string }).role !== "admin") return null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">FounderAgent Fleet</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              100 autonomous founder simulations evaluated by the PitchMirror mesh
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Run history dropdown */}
            {runs.length > 0 && (
              <Select
                value={activeRunId?.toString() ?? ""}
                onValueChange={(v) => setActiveRunId(Number(v))}
              >
                <SelectTrigger className="w-48 text-xs h-8">
                  <SelectValue placeholder="Select run" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      {r.isTestRun
                        ? `🧪 ${r.fleetMode === "gcc" ? "GCC Quick Test" : "Global Quick Test"} · ${r.totalIdeas} pitches · ${r.runDate}`
                        : `${r.fleetMode === "gcc" ? "🕌 GCC Run" : "🌐 Global Run"} · ${r.totalIdeas} pitches · ${r.runDate}`
                      }
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Controls */}
            {isIdle && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                  onClick={() => quickTestMut.mutate({ quickTest: true, gccMode })} // pass current mode so test run uses correct domain config
                  disabled={quickTestMut.isPending || startMut.isPending}
                  title={gccMode ? "GCC Quick Test: 10 agents, Shariah + Vision 2030 scoring" : "Quick Test: 10 agents, ~5 min"}
                >
                  {quickTestMut.isPending ? "Starting…" : gccMode ? "⚡ GCC Quick Test (10)" : "⚡ Quick Test (10 agents)"}
                </Button>
                {/* GCC mode toggle — switches domain config and council personas */}
                <button
                  type="button"
                  onClick={() => setGccMode((v) => !v)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    gccMode
                      ? "border-amber-400 bg-amber-400/20 text-amber-300 font-semibold"
                      : "border-white/20 bg-white/5 text-muted-foreground hover:border-white/40"
                  }`}
                  title="Toggle GCC Institutional mode (Islamic Finance, GovTech, Energy Transition, Healthcare, Logistics)"
                >
                  {gccMode ? "🕌 GCC Mode" : "🌐 Global Mode"}
                </button>
                <Button
                  size="sm"
                  className={gccMode ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                  onClick={() => startMut.mutate({ gccMode })}
                  disabled={startMut.isPending || quickTestMut.isPending}
                >
                  {startMut.isPending ? "Starting…" : gccMode ? "🕌 Start GCC Fleet" : "▶ Start Fleet Run"}
                </Button>
              </div>
            )}
            {isActive && (
              <Button
                size="sm" variant="outline"
                onClick={() => pauseMut.mutate({ runId: activeRunId! })}
                disabled={pauseMut.isPending}
              >
                ⏸ Pause
              </Button>
            )}
            {isPaused && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => resumeMut.mutate({ runId: activeRunId! })}
                disabled={resumeMut.isPending}
              >
                ▶ Resume
              </Button>
            )}
            {(isActive || isPaused) && (
              <Button
                size="sm" variant="destructive"
                onClick={() => abortMut.mutate({ runId: activeRunId! })}
                disabled={abortMut.isPending}
              >
                ✕ Abort
              </Button>
            )}
            {activeRunId && (
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                {exportLabel}
              </Button>
            )}
          </div>
        </div>

        {/* ── Run status bar ───────────────────────────────────────────────── */}
        {run && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: run.status === "completed" ? "#10b981" : run.status === "failed" ? "#ef4444" : "#f59e0b" }}
                >
                  {STATUS_LABELS[run.status]}
                </span>
                {/* Test run badge — shown for quick test runs, excluded from pattern engine seeding */}
                {run.isTestRun && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 font-medium">
                    🧪 Test Run · {run.totalIdeas} pitches · {run.fleetMode === "gcc" ? "GCC Mode" : "Global Mode"}
                  </span>
                )}
                {run.status === "evaluating" && (
                  <span className="text-xs text-muted-foreground">
                    {run.completed}/{run.totalIdeas} evaluated · {run.running} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>🔍 {run.totalSearches} searches</span>
                <span>🤖 {run.totalLlmCalls} LLM calls</span>
                <span>🪙 ~{run.estimatedTokens.toLocaleString()} tokens</span>
                <span>💵 ~${Number(run.estimatedCostUsd ?? 0).toFixed(4)}</span>
              </div>
            </div>
            <ProgressBar value={run.completed} max={Math.max(run.totalIdeas, 1)} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Started: {fmtTs(run.startedAt)}</span>
              {run.completedAt && <span>Completed: {fmtTs(run.completedAt)}</span>}
              <span>{run.completed} / {run.totalIdeas} ({run.totalIdeas > 0 ? Math.round((run.completed / run.totalIdeas) * 100) : 0}%)</span>
            </div>
          </div>
        )}

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        {stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "ENGAGE", value: stats.engage, color: "#10b981" },
              { label: "WATCH",  value: stats.watch,  color: "#f59e0b" },
              { label: "PASS",   value: stats.pass,   color: "#6b7280" },
              { label: "Avg Score", value: stats.avgScore, color: scoreColor(stats.avgScore) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 border-b border-white/10">
          {(["live", "table", "insights", "trends"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "live" ? "Live Feed" : tab === "table" ? "All Results" : tab === "insights" ? "Insights" : "Trends"}
            </button>
          ))}
        </div>

        {/* ── Live Feed tab ────────────────────────────────────────────────── */}
        {activeTab === "live" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card feed */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Latest Evaluations
              </h2>
              <div ref={cardFeedRef} className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {recentEvals.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12 text-sm">
                    {run ? "Waiting for first evaluation…" : "Start a fleet run to see live results"}
                  </div>
                ) : (
                  recentEvals.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer hover:bg-white/8 transition-colors"
                      onClick={() => setExpandedEvalId(expandedEvalId === e.id ? null : e.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{e.founderName}</span>
                            <span className="text-xs text-muted-foreground">{e.domain} · {e.subSector}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{e.targetRegion} · {e.fundingStage}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ClassBadge cls={e.classification} />
                          <ScorePill score={e.finalScore} />
                        </div>
                      </div>
                      {e.summary3s && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{e.summary3s}</p>
                      )}
                      {expandedEvalId === e.id && (
                        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground mb-1">Execution</div>
                              <ScorePill score={e.executionScore} />
                            </div>
                            <div>
                              <div className="text-muted-foreground mb-1">Market</div>
                              <ScorePill score={e.marketScore} />
                            </div>
                            <div>
                              <div className="text-muted-foreground mb-1">Action</div>
                              <span className="text-xs text-foreground">{e.recommendedAction ?? "—"}</span>
                            </div>
                          </div>
                          {e.strengths.length > 0 && (
                            <div>
                              <div className="text-xs text-emerald-400 font-medium mb-1">Strengths</div>
                              <ul className="space-y-0.5">
                                {e.strengths.map((s, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">• {s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {e.concerns.length > 0 && (
                            <div>
                              <div className="text-xs text-amber-400 font-medium mb-1">Concerns</div>
                              <ul className="space-y-0.5">
                                {e.concerns.map((c, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">• {c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {e.flags.length > 0 && (
                            <div>
                              <div className="text-xs text-red-400 font-medium mb-1">Flags</div>
                              <ul className="space-y-0.5">
                                {e.flags.map((f, i) => (
                                  <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* GCC Institutional Summary — shown only for GCC mode runs */}
            {run?.fleetMode === "gcc" && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
                  🕌 GCC Institutional Summary
                </h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-muted-foreground mb-1">Council Mandate</div>
                    <div className="text-foreground font-medium">$10M – $50M · Seed / Series A</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-muted-foreground mb-1">Domains</div>
                    <div className="text-foreground font-medium">Islamic Finance · GovTech · Energy · Healthcare · Logistics</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-muted-foreground mb-1">Council Personas</div>
                    <div className="text-foreground font-medium">Vision 2030 · UAE Family Office · KIA · QDB · Bahrain Fintech Bay</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <div className="text-muted-foreground mb-1">Shariah Compliance</div>
                    <div className="text-foreground font-medium">Compliant / Requires Review / Non-compliant</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Shariah compliance is auto-classified per idea. View the All Results tab for per-idea compliance status.
                </p>
              </div>
            )}

            {/* Domain breakdown */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Domain Breakdown
              </h2>
              {Object.keys(domainBreakdown).length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">No data yet</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(domainBreakdown)
                    .sort(([, a], [, b]) => b.avgScore - a.avgScore)
                    .map(([domain, d]) => (
                      <div key={domain} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{domain}</span>
                          <ScorePill score={d.avgScore} />
                        </div>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span className="text-emerald-400">{d.engage}E</span>
                          <span className="text-amber-400">{d.watch}W</span>
                          <span className="text-gray-400">{d.pass}P</span>
                          <span className="ml-auto">{d.count} total</span>
                        </div>
                        <div className="mt-2 flex gap-0.5 h-1.5 rounded overflow-hidden">
                          {d.count > 0 && (
                            <>
                              <div style={{ width: `${(d.engage / d.count) * 100}%`, background: "#10b981" }} />
                              <div style={{ width: `${(d.watch / d.count) * 100}%`, background: "#f59e0b" }} />
                              <div style={{ width: `${(d.pass / d.count) * 100}%`, background: "#6b7280" }} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── All Results tab ───────────────────────────────────────────────── */}
        {activeTab === "table" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={filterDomain} onValueChange={setFilterDomain}>
                <SelectTrigger className="w-36 text-xs h-8">
                  <SelectValue placeholder="Domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {uniqueDomains.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-36 text-xs h-8">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classifications</SelectItem>
                  <SelectItem value="ENGAGE">ENGAGE</SelectItem>
                  <SelectItem value="WATCH">WATCH</SelectItem>
                  <SelectItem value="PASS">PASS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortField} onValueChange={(v) => setSortField(v as typeof sortField)}>
                <SelectTrigger className="w-36 text-xs h-8">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finalScore">Score</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="founderName">Founder</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm" variant="ghost" className="h-8 text-xs"
                onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              >
                {sortDir === "desc" ? "▼ Desc" : "▲ Asc"}
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {tableRows.length} results
              </span>
            </div>

            {/* Table */}
            {detailQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
            ) : tableRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No results yet</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Founder</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Domain</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Region</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Stage</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Class</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Score</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Exec</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Market</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Action</th>
                      {run?.fleetMode === "gcc" && (
                        <th className="text-center px-4 py-3 text-xs font-semibold text-amber-400">Shariah</th>
                      )}
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr
                        key={r.evalId}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs font-medium text-foreground">
                          {r.founderName}
                          {/* 🧪 badge on each row for test run results — muted, subtle */}
                          {run?.isTestRun && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400/70 border border-amber-400/20 font-normal align-middle">
                              🧪 test
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.domain}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.targetRegion}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.fundingStage}</td>
                        <td className="px-4 py-3 text-center"><ClassBadge cls={r.classification as Classification | null} /></td>
                        <td className="px-4 py-3 text-center"><ScorePill score={r.finalScore} /></td>
                        <td className="px-4 py-3 text-center"><ScorePill score={r.executionScore} /></td>
                        <td className="px-4 py-3 text-center"><ScorePill score={r.marketScore} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.recommendedAction ?? "—"}</td>
                        {run?.fleetMode === "gcc" && (
                          <td className="px-4 py-3 text-center">
                            {(r as { shariahCompliance?: string | null }).shariahCompliance ? (
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                (r as { shariahCompliance?: string | null }).shariahCompliance === "Compliant"
                                  ? "text-emerald-400 bg-emerald-400/10"
                                  : (r as { shariahCompliance?: string | null }).shariahCompliance === "Non-compliant"
                                  ? "text-red-400 bg-red-400/10"
                                  : "text-amber-400 bg-amber-400/10"
                              }`}>
                                {(r as { shariahCompliance?: string | null }).shariahCompliance}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <button
                            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                            onClick={() => setExpandedEvalId(r.evalId)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Insights tab ─────────────────────────────────────────────────── */}
        {activeTab === "insights" && (
          <div className="space-y-6">
            {insightsQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading insights…</div>
            ) : !insightsQuery.data ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {run?.status === "completed"
                  ? "No insights extracted yet"
                  : "Insights are extracted after the run completes"}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InsightSection
                    title="High-Score Patterns"
                    items={insightsQuery.data.highScorePatterns}
                    color="#10b981"
                  />
                  <InsightSection
                    title="Low-Score Patterns"
                    items={insightsQuery.data.lowScorePatterns}
                    color="#ef4444"
                  />
                  <InsightSection
                    title="Common Failure Reasons"
                    items={insightsQuery.data.failureReasons}
                    color="#f59e0b"
                  />
                  <InsightSection
                    title="Improvement Suggestions"
                    items={insightsQuery.data.improvementSuggestions}
                    color="#06b6d4"
                  />
                </div>
                {insightsQuery.data.idealPitchStructure && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3">Ideal Pitch Structure</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {insightsQuery.data.idealPitchStructure}
                    </p>
                  </div>
                )}
                {Object.keys(insightsQuery.data.domainComparison).length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3">Domain Comparison</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Domain</th>
                            <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Avg Score</th>
                            <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Count</th>
                            <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Top Concern</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(insightsQuery.data.domainComparison)
                            .sort(([, a], [, b]) => b.avgScore - a.avgScore)
                            .map(([domain, d]) => (
                              <tr key={domain} className="border-b border-white/5">
                                <td className="py-2 text-xs text-foreground">{domain}</td>
                                <td className="py-2 text-center"><ScorePill score={d.avgScore} /></td>
                                <td className="py-2 text-center text-xs text-muted-foreground">{d.count}</td>
                                <td className="py-2 text-xs text-muted-foreground">{d.topConcern}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground text-right">
                  Extracted: {fmtTs(insightsQuery.data.createdAt)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Trends tab ───────────────────────────────────────────────────── */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            {trendQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading trends…</div>
            ) : !trendQuery.data || trendQuery.data.runs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Trend data appears after 2+ completed runs
              </div>
            ) : (
              <>
                {/* Run summary table */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-3">Run History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Run Date</th>
                          <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Status</th>
                          <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Completed</th>
                          <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Cost (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendQuery.data.runs.map((r: { id: number; runDate: string; status: string; completed: number; totalIdeas: number; estimatedCostUsd: string | null }) => (
                          <tr key={r.id} className="border-b border-white/5">
                            <td className="py-2 text-xs text-foreground">{r.runDate}</td>
                            <td className="py-2 text-center">
                              <span className="text-xs text-emerald-400">{r.status}</span>
                            </td>
                            <td className="py-2 text-center text-xs text-muted-foreground">
                              {r.completed}/{r.totalIdeas}
                            </td>
                            <td className="py-2 text-right text-xs text-muted-foreground">
                              ${Number(r.estimatedCostUsd ?? 0).toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Domain trend table */}
                {Object.keys(trendQuery.data.domainTrends).length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3">Domain Score Trends (last 30 runs)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Domain</th>
                            <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Latest Avg</th>
                            <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Runs</th>
                            <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Score History</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(trendQuery.data.domainTrends)
                            .sort(([, a], [, b]) => {
                              const aLast = (a as Array<{ avgScore: number }>).at(-1)?.avgScore ?? 0;
                              const bLast = (b as Array<{ avgScore: number }>).at(-1)?.avgScore ?? 0;
                              return bLast - aLast;
                            })
                            .map(([domain, trend]) => {
                              const trendArr = trend as Array<{ runId: number; avgScore: number; count: number }>;
                              const latest = trendArr.at(-1)?.avgScore ?? 0;
                              return (
                                <tr key={domain} className="border-b border-white/5">
                                  <td className="py-2 text-xs text-foreground">{domain}</td>
                                  <td className="py-2 text-center"><ScorePill score={latest} /></td>
                                  <td className="py-2 text-center text-xs text-muted-foreground">{trendArr.length}</td>
                                  <td className="py-2">
                                    <div className="flex items-center gap-1">
                                      {trendArr.slice(-10).map((t, i) => (
                                        <div
                                          key={i}
                                          className="w-2 rounded-sm"
                                          style={{
                                            height: `${Math.max(4, (t.avgScore / 100) * 24)}px`,
                                            background: scoreColor(t.avgScore),
                                            opacity: 0.7 + (i / trendArr.length) * 0.3,
                                          }}
                                          title={`Run ${t.runId}: ${t.avgScore}`}
                                        />
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Fleet Scheduler card ─────────────────────────────────────────── */}
      <FleetSchedulerCard />
      {/* ── Expanded eval detail dialog ───────────────────────────────────── */}
      {expandedEvalId !== null && (() => {
        const evalRow = tableRows.find((r) => r.evalId === expandedEvalId)
          ?? recentEvals.find((r) => r.id === expandedEvalId);
        if (!evalRow) return null;
        const isDetail = "problem" in evalRow;
        return (
          <Dialog open onOpenChange={() => setExpandedEvalId(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {"founderName" in evalRow ? evalRow.founderName : ""} — {("domain" in evalRow) ? evalRow.domain : ""}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <ClassBadge cls={("classification" in evalRow ? evalRow.classification : null) as Classification | null} />
                  <ScorePill score={"finalScore" in evalRow ? evalRow.finalScore : null} />
                  {"recommendedAction" in evalRow && (
                    <span className="text-xs text-muted-foreground">{evalRow.recommendedAction}</span>
                  )}
                </div>
                {"summary3s" in evalRow && evalRow.summary3s && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Summary</div>
                    <p className="text-sm text-foreground">{evalRow.summary3s}</p>
                  </div>
                )}
                {isDetail && (
                  <>
                    {[
                      { label: "Problem", key: "problem" },
                      { label: "Solution", key: "solution" },
                      { label: "Target Market", key: "targetMarket" },
                      { label: "Business Model", key: "businessModel" },
                      { label: "Competitive Advantage", key: "competitiveAdvantage" },
                      { label: "Key Risk", key: "keyRisk" },
                    ].map(({ label, key }) => {
                      const val = (evalRow as Record<string, unknown>)[key];
                      if (!val) return null;
                      return (
                        <div key={key}>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">{label}</div>
                          <p className="text-sm text-foreground">{String(val)}</p>
                        </div>
                      );
                    })}
                  </>
                )}
                {("strengths" in evalRow) && (evalRow.strengths as string[]).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-emerald-400 mb-1">Strengths</div>
                    <ul className="space-y-1">
                      {(evalRow.strengths as string[]).map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {("concerns" in evalRow) && (evalRow.concerns as string[]).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-amber-400 mb-1">Concerns</div>
                    <ul className="space-y-1">
                      {(evalRow.concerns as string[]).map((c, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {("flags" in evalRow) && (evalRow.flags as string[]).length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-red-400 mb-1">Flags</div>
                    <ul className="space-y-1">
                      {(evalRow.flags as string[]).map((f, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </DashboardLayout>
  );
}

// ── InsightSection helper ─────────────────────────────────────────────────────
function InsightSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold mb-3" style={{ color }}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── FleetSchedulerCard ────────────────────────────────────────────────────────
function FleetSchedulerCard() {
  const { data, isLoading } = trpc.fleet.fleetConfigs.useQuery(undefined, { refetchInterval: 30000 });

  const scoringModeLabel = (mode: string) => {
    if (mode === "shariah_gcc") return "Shariah + GCC";
    if (mode === "standard") return "Standard";
    return mode;
  };

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-lg">🗓️</span>
        <h2 className="text-base font-semibold text-white">Fleet Scheduler</h2>
        <span className="text-xs text-slate-500 ml-auto">Runs daily at 06:00 KWT</span>
      </div>
      {isLoading ? (
        <div className="text-slate-500 text-sm">Loading scheduler state…</div>
      ) : !data || data.length === 0 ? (
        <div className="text-slate-500 text-sm">No fleet configs found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4">Mode</th>
                <th className="pb-2 pr-4">Scoring</th>
                <th className="pb-2 pr-4 text-center">Total</th>
                <th className="pb-2 pr-4 text-center">Done</th>
                <th className="pb-2 pr-4 text-center">Remaining</th>
                <th className="pb-2 pr-4">Last Run</th>
                <th className="pb-2 pr-4 text-center">Last Score</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((cfg) => (
                <tr key={cfg.id} className="border-b border-white/5 last:border-0">
                  <td className="py-3 pr-4 font-mono text-emerald-400 uppercase text-xs">{cfg.fleetMode}</td>
                  <td className="py-3 pr-4 text-slate-300">{scoringModeLabel(cfg.scoringMode ?? "standard")}</td>
                  <td className="py-3 pr-4 text-center text-slate-400">{cfg.runsTotal}</td>
                  <td className="py-3 pr-4 text-center text-slate-300">{cfg.runsCompleted}</td>
                  <td className="py-3 pr-4 text-center">
                    <span className={cfg.runsRemaining === 0 ? "text-red-400" : "text-emerald-400"}>
                      {cfg.runsRemaining}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">
                    {cfg.lastRunAt
                      ? new Date(cfg.lastRunAt).toLocaleString("en-KW", { timeZone: "Asia/Kuwait", dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-center">
                    {cfg.lastRunScore != null
                      ? <span className="font-mono text-sky-400">{parseFloat(String(cfg.lastRunScore)).toFixed(1)}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3">
                    {cfg.active
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />Active</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />Exhausted</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
