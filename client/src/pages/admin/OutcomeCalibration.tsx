/**
 * OutcomeCalibration.tsx — Outcome Calibration Engine Dashboard (Phase 3)
 *
 * Read-only governance view. Displays calibration metrics derived from the
 * Attribution Engine. Does NOT modify any Council verdict, CFA score, voting
 * logic, or outcome attribution workflow.
 *
 * Route: /admin/outcomes/calibration
 * Access: admin only
 *
 * Panels:
 *  1. Most Predictive Personas
 *  2. Least Predictive Personas
 *  3. Most Accurate Blockers
 *  4. Most Overused Blockers
 *  5. Most Missed Risks
 *
 * Persona Scorecard (expandable table):
 *  Fidelity Score (CFA), Precision, Recall, F1, Outcome Agreement Rate,
 *  Total Decisions, Materialized Predictions, False Alarms, Missed Risks
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, TrendingUp, TrendingDown, Target, AlertTriangle, Eye, ChevronDown, ChevronUp } from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────────────

function pct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(decimals)}%`;
}

function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return String(n);
}

function formatPersonaId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-KW", {
    timeZone: "Asia/Kuwait",
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Metric bar (mini progress bar) ───────────────────────────────────────────

function MetricBar({ value, color = "bg-blue-500" }: { value: number | null | undefined; color?: string }) {
  const pctVal = value != null ? Math.max(0, Math.min(1, value)) * 100 : 0;
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pctVal}%` }} />
    </div>
  );
}

// ── F1 badge color ────────────────────────────────────────────────────────────

function f1Color(f1: number | null): string {
  if (f1 == null) return "bg-zinc-700 text-zinc-400";
  if (f1 >= 0.7) return "bg-emerald-800 text-emerald-200";
  if (f1 >= 0.4) return "bg-amber-800 text-amber-200";
  return "bg-red-900 text-red-300";
}

function materializationColor(rate: number | null): string {
  if (rate == null) return "bg-zinc-700 text-zinc-400";
  if (rate >= 0.6) return "bg-emerald-800 text-emerald-200";
  if (rate >= 0.3) return "bg-amber-800 text-amber-200";
  return "bg-red-900 text-red-300";
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-6 text-slate-500 text-sm">
      <p>{message}</p>
      <p className="text-xs mt-1 text-slate-600">Calibration data accumulates as outcomes are reviewed.</p>
    </div>
  );
}

// ── Persona row for scorecard ─────────────────────────────────────────────────

type PersonaRow = {
  personaId: string;
  personaName: string;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  totalPredictions: number;
  materializedPredictions: number;
  falseAlarms: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  fidelityScore: number | null;
  outcomeAgreementRate: number | null;
  outcomeAgreementTotal: number;
};

function PersonaScorecardRow({ p }: { p: PersonaRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        className="border-b border-zinc-800 hover:bg-zinc-800/40 cursor-pointer transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="py-2 px-3 text-xs text-slate-300 font-medium">
          <div className="flex items-center gap-1">
            {expanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
            {formatPersonaId(p.personaId)}
          </div>
        </td>
        <td className="py-2 px-3 text-xs text-center">
          <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${f1Color(p.f1)}`}>
            {pct(p.f1)}
          </span>
        </td>
        <td className="py-2 px-3 text-xs text-center text-slate-300 font-mono">{pct(p.precision)}</td>
        <td className="py-2 px-3 text-xs text-center text-slate-300 font-mono">{pct(p.recall)}</td>
        <td className="py-2 px-3 text-xs text-center text-slate-300 font-mono">{pct(p.fidelityScore)}</td>
        <td className="py-2 px-3 text-xs text-center text-slate-300 font-mono">{pct(p.outcomeAgreementRate)}</td>
        <td className="py-2 px-3 text-xs text-center text-slate-400 font-mono">{num(p.totalPredictions)}</td>
        <td className="py-2 px-3 text-xs text-center text-emerald-400 font-mono">{num(p.materializedPredictions)}</td>
        <td className="py-2 px-3 text-xs text-center text-rose-400 font-mono">{num(p.falseAlarms)}</td>
      </tr>
      {expanded && (
        <tr className="bg-zinc-900/60 border-b border-zinc-800">
          <td colSpan={9} className="px-6 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-500 mb-1">Confusion Matrix</p>
                <div className="grid grid-cols-2 gap-1 text-center">
                  <div className="bg-emerald-900/40 rounded p-1.5">
                    <p className="text-emerald-300 font-mono text-base font-bold">{p.tp}</p>
                    <p className="text-slate-500">TP</p>
                  </div>
                  <div className="bg-red-900/40 rounded p-1.5">
                    <p className="text-red-300 font-mono text-base font-bold">{p.fp}</p>
                    <p className="text-slate-500">FP</p>
                  </div>
                  <div className="bg-zinc-800/60 rounded p-1.5">
                    <p className="text-slate-400 font-mono text-base font-bold">{p.fn}</p>
                    <p className="text-slate-500">FN</p>
                  </div>
                  <div className="bg-zinc-800/60 rounded p-1.5">
                    <p className="text-slate-400 font-mono text-base font-bold">{p.tn}</p>
                    <p className="text-slate-500">TN</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Prediction Accuracy</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">Precision</span>
                      <span className="text-slate-300 font-mono">{pct(p.precision)}</span>
                    </div>
                    <MetricBar value={p.precision} color="bg-blue-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">Recall</span>
                      <span className="text-slate-300 font-mono">{pct(p.recall)}</span>
                    </div>
                    <MetricBar value={p.recall} color="bg-violet-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">F1 Score</span>
                      <span className="text-slate-300 font-mono">{pct(p.f1)}</span>
                    </div>
                    <MetricBar value={p.f1} color="bg-emerald-500" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Governance Scores</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">CFA Fidelity</span>
                      <span className="text-slate-300 font-mono">{pct(p.fidelityScore)}</span>
                    </div>
                    <MetricBar value={p.fidelityScore} color="bg-amber-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">Outcome Agreement</span>
                      <span className="text-slate-300 font-mono">{pct(p.outcomeAgreementRate)}</span>
                    </div>
                    <MetricBar value={p.outcomeAgreementRate} color="bg-teal-500" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Prediction Counts</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Predictions</span>
                    <span className="text-slate-300 font-mono">{p.totalPredictions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Materialized</span>
                    <span className="text-emerald-400 font-mono">{p.materializedPredictions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">False Alarms</span>
                    <span className="text-rose-400 font-mono">{p.falseAlarms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Outcome Decisions</span>
                    <span className="text-slate-300 font-mono">{p.outcomeAgreementTotal}</span>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OutcomeCalibration() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showScorecard, setShowScorecard] = useState(false);

  const enabled = !authLoading && user?.role === "admin";

  const dashboard = trpc.outcomeLedger.calibrationDashboard.useQuery(undefined, {
    enabled, retry: false,
  });
  const scorecard = trpc.outcomeLedger.calibrationMetrics.useQuery(undefined, {
    enabled: enabled && showScorecard, retry: false,
  });
  const missed = trpc.outcomeLedger.missedRisks.useQuery(
    { limit: 10, offset: 0 },
    { enabled, retry: false }
  );

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Verifying access…</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-2">Access Denied</p>
          <p className="text-slate-500 text-sm">Admin access is required to view this page.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  const d = dashboard.data;
  const isLoading = dashboard.isLoading;

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200 -ml-2"
              onClick={() => navigate("/admin/outcomes")}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Outcome Ledger
            </Button>
            <span className="text-slate-600">|</span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Calibration Engine</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                TP/FP/TN/FN · Precision · Recall · F1 · Blocker Materialization · Missed Risks · Read-only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-slate-300 hover:bg-zinc-800"
              onClick={() => navigate("/admin/outcomes/attribution")}
            >
              Attribution Engine
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => { dashboard.refetch(); missed.refetch(); }}
              disabled={dashboard.isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Summary strip ── */}
        {d && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Reviewed Attributions", value: String(d.totalReviewed), color: "text-blue-400" },
              { label: "Most Predictive Persona", value: d.mostPredictivePersonas[0] ? formatPersonaId(d.mostPredictivePersonas[0].personaId) : "—", color: "text-emerald-400" },
              { label: "Top Blocker Type", value: d.mostAccurateBlockers[0] ? formatType(d.mostAccurateBlockers[0].type) : "—", color: "text-amber-400" },
              { label: "Missed Risks", value: String(missed.data?.total ?? "—"), color: "text-rose-400" },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-sm font-semibold truncate ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="bg-zinc-900 border-zinc-800">
                <CardHeader><div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" /></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-8 bg-zinc-800 rounded animate-pulse" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && d && (
          <>
            {/* ── 5-panel grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* Panel 1: Most Predictive Personas */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <SectionHeader
                    icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                    title="Most Predictive Personas"
                    subtitle="Ranked by F1 score (precision × recall balance)"
                  />
                </CardHeader>
                <CardContent>
                  {d.mostPredictivePersonas.length === 0 ? (
                    <EmptyState message="No reviewed attributions yet." />
                  ) : (
                    <div className="space-y-2">
                      {d.mostPredictivePersonas.map((p, idx) => (
                        <div key={p.personaId} className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-slate-500 w-5 shrink-0">{idx + 1}.</span>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 truncate">{formatPersonaId(p.personaId)}</p>
                              <p className="text-xs text-slate-500 font-mono">P:{pct(p.precision)} R:{pct(p.recall)}</p>
                            </div>
                          </div>
                          <Badge className={`${f1Color(p.f1)} shrink-0 ml-2 font-mono`}>
                            F1 {pct(p.f1)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Panel 2: Least Predictive Personas */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <SectionHeader
                    icon={<TrendingDown className="w-5 h-5 text-rose-400" />}
                    title="Least Predictive Personas"
                    subtitle="Lowest F1 scores — highest false alarm or miss rate"
                  />
                </CardHeader>
                <CardContent>
                  {d.leastPredictivePersonas.length === 0 ? (
                    <EmptyState message="No reviewed attributions yet." />
                  ) : (
                    <div className="space-y-2">
                      {d.leastPredictivePersonas.map((p, idx) => (
                        <div key={p.personaId} className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-slate-500 w-5 shrink-0">{idx + 1}.</span>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 truncate">{formatPersonaId(p.personaId)}</p>
                              <p className="text-xs text-slate-500 font-mono">TP:{p.tp} FP:{p.fp}</p>
                            </div>
                          </div>
                          <Badge className={`${f1Color(p.f1)} shrink-0 ml-2 font-mono`}>
                            F1 {pct(p.f1)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Panel 3: Most Accurate Blockers */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <SectionHeader
                    icon={<Target className="w-5 h-5 text-blue-400" />}
                    title="Most Accurate Blockers"
                    subtitle="Blocker types with highest materialization rate"
                  />
                </CardHeader>
                <CardContent>
                  {d.mostAccurateBlockers.length === 0 ? (
                    <EmptyState message="No reviewed blocker attributions yet." />
                  ) : (
                    <div className="space-y-2">
                      {d.mostAccurateBlockers.map((b, idx) => (
                        <div key={b.type} className="px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-500 w-5">{idx + 1}.</span>
                              <span className="text-sm text-slate-200">{formatType(b.type)}</span>
                            </div>
                            <Badge className={`${materializationColor(b.materializationRate)} shrink-0 font-mono`}>
                              {pct(b.materializationRate)}
                            </Badge>
                          </div>
                          <div className="flex gap-4 ml-7 text-xs text-slate-500">
                            <span>Predicted: <span className="text-slate-300">{b.predicted}</span></span>
                            <span>Materialized: <span className="text-emerald-400">{b.materialized}</span></span>
                            <span>False Alarms: <span className="text-rose-400">{b.falseAlarms}</span></span>
                          </div>
                          <div className="ml-7 mt-1">
                            <MetricBar value={b.materializationRate} color="bg-blue-500" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Panel 4: Most Overused Blockers */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <SectionHeader
                    icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
                    title="Most Overused Blockers"
                    subtitle="Blocker types with highest false alarm count"
                  />
                </CardHeader>
                <CardContent>
                  {d.mostOverusedBlockers.length === 0 ? (
                    <EmptyState message="No false alarms recorded yet." />
                  ) : (
                    <div className="space-y-2">
                      {d.mostOverusedBlockers.map((b, idx) => (
                        <div key={b.type} className="px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-500 w-5">{idx + 1}.</span>
                              <span className="text-sm text-slate-200">{formatType(b.type)}</span>
                            </div>
                            <Badge className="bg-amber-900 text-amber-200 shrink-0 font-mono">
                              {b.falseAlarms} false alarms
                            </Badge>
                          </div>
                          <div className="flex gap-4 ml-7 text-xs text-slate-500">
                            <span>Predicted: <span className="text-slate-300">{b.predicted}</span></span>
                            <span>Materialized: <span className="text-emerald-400">{b.materialized}</span></span>
                            <span>Rate: <span className="text-slate-300">{pct(b.materializationRate)}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Panel 5: Most Missed Risks (full width) */}
            <Card className="bg-zinc-900 border-zinc-800 mb-6">
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={<Eye className="w-5 h-5 text-rose-400" />}
                  title="Most Missed Risks"
                  subtitle="Outcome factors that materialized but were not predicted by any persona"
                />
              </CardHeader>
              <CardContent>
                {missed.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (missed.data?.rows.length ?? 0) === 0 ? (
                  <EmptyState message="No missed risks found in resolved outcome sessions." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left py-2 px-3 text-slate-500 font-medium">Deal</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium">Outcome</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium">Factor Type</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium">Description</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missed.data?.rows.map((r) => (
                          <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="py-2 px-3 text-slate-400 font-mono">{r.dealId.slice(0, 8)}…</td>
                            <td className="py-2 px-3">
                              <Badge className={
                                r.outcomeStatus === "SUCCEEDED" ? "bg-emerald-800 text-emerald-200" :
                                r.outcomeStatus === "FAILED" ? "bg-red-800 text-red-200" :
                                r.outcomeStatus === "ABANDONED" ? "bg-orange-800 text-orange-200" :
                                "bg-zinc-700 text-zinc-300"
                              }>
                                {r.outcomeStatus}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">
                              <Badge className="bg-zinc-700 text-zinc-300">{formatType(r.factorType)}</Badge>
                            </td>
                            <td className="py-2 px-3 text-slate-300 max-w-xs truncate">{r.factorDescription}</td>
                            <td className="py-2 px-3 text-slate-500">{formatDate(r.decisionDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(missed.data?.total ?? 0) > 10 && (
                      <p className="text-xs text-slate-600 text-center pt-3">
                        Showing 10 of {missed.data?.total} missed risks
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Persona Scorecard (expandable) ── */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <SectionHeader
                    icon={<Target className="w-5 h-5 text-violet-400" />}
                    title="Persona Scorecard"
                    subtitle="Full calibration metrics per persona — click row to expand confusion matrix"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-slate-300 hover:bg-zinc-800 shrink-0"
                    onClick={() => setShowScorecard((s) => !s)}
                  >
                    {showScorecard ? "Hide Scorecard" : "Show Scorecard"}
                  </Button>
                </div>
              </CardHeader>
              {showScorecard && (
                <CardContent>
                  {scorecard.isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (scorecard.data?.personas.length ?? 0) === 0 ? (
                    <EmptyState message="No reviewed attributions available for scorecard." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[800px]">
                        <thead>
                          <tr className="border-b border-zinc-700">
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Persona</th>
                            <th className="text-center py-2 px-3 text-slate-500 font-medium">F1</th>
                            <th className="text-center py-2 px-3 text-slate-500 font-medium">Precision</th>
                            <th className="text-center py-2 px-3 text-slate-500 font-medium">Recall</th>
                            <th className="text-center py-2 px-3 text-slate-500 font-medium">CFA Fidelity</th>
                            <th className="text-center py-2 px-3 text-slate-500 font-medium">Agreement</th>
                            <th className="text-center py-2 px-3 text-slate-500 font-medium">Total</th>
                            <th className="text-center py-2 px-3 text-emerald-600 font-medium">Materialized</th>
                            <th className="text-center py-2 px-3 text-rose-600 font-medium">False Alarms</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scorecard.data?.personas.map((p) => (
                            <PersonaScorecardRow key={p.personaId} p={p} />
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-slate-600 mt-3 text-center">
                        {scorecard.data?.personas.length} personas · {scorecard.data?.totalReviewed} reviewed attributions · {scorecard.data?.totalResolved} resolved sessions
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </>
        )}

        {/* ── Governance disclaimer ── */}
        <div className="mt-6 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
          <p className="text-xs text-slate-600 text-center">
            Calibration Engine — read-only governance layer. Metrics are computed from reviewed attribution records.
            No model training, no vote weighting, no verdict changes. Council and CFA behavior is unaffected.
          </p>
        </div>
      </div>
    </div>
  );
}
