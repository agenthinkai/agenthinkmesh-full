/**
 * OutcomeAttribution.tsx — Attribution Engine Dashboard (Phase 2)
 *
 * Governance-only view. Displays predictive accuracy of Council personas and
 * blocker types against realized outcomes. Does NOT modify any Council verdict,
 * CFA score, or voting logic.
 *
 * Route: /admin/outcomes/attribution
 * Access: admin only
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, ChevronLeft, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatPersonaId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mt-0.5 text-blue-400">{icon}</div>
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-slate-500 text-sm">
      <p>{message}</p>
      <p className="text-xs mt-1 text-slate-600">Attribution data accumulates as outcomes are reviewed.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OutcomeAttribution() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = trpc.outcomeLedger.attributionDashboard.useQuery(undefined, {
    enabled: !authLoading && user?.role === "admin",
    retry: false,
  });

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
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    toast.error("Failed to load attribution data");
  }

  const topPersonas = data?.topPredictivePersonas ?? [];
  const topBlockers = data?.topPredictiveBlockers ?? [];
  const missedRisks = data?.topMissedRisks ?? [];
  const falseAlarms = data?.topFalseAlarms ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-100 p-6">
      {/* ── Page header ── */}
      <div className="max-w-6xl mx-auto">
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
              <h1 className="text-xl font-bold text-slate-100">Attribution Engine</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Predictive accuracy of Council personas and blocker types · Governance only · No model training
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-slate-300 hover:bg-zinc-800"
              onClick={() => navigate("/admin/outcomes/metrics")}
            >
              Accuracy Metrics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
                </CardHeader>
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

        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Panel 1: Top Predictive Personas ── */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={<TrendingUp className="w-5 h-5" />}
                  title="Top Predictive Personas"
                  subtitle="Personas with the most confirmed predictions (reviewed outcomes only)"
                />
              </CardHeader>
              <CardContent>
                {topPersonas.length === 0 ? (
                  <EmptyState message="No confirmed predictions yet." />
                ) : (
                  <div className="space-y-2">
                    {topPersonas.map((p, idx) => (
                      <div
                        key={p.personaId}
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-slate-500 w-5 shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="text-sm text-slate-200 truncate">
                            {formatPersonaId(p.personaId)}
                          </span>
                        </div>
                        <Badge className="bg-emerald-800 text-emerald-200 shrink-0 ml-2">
                          {p.confirmedPredictions} confirmed
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Panel 2: Top Predictive Blockers ── */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={<CheckCircle className="w-5 h-5" />}
                  title="Top Predictive Blockers"
                  subtitle="Blocker types most frequently confirmed as materialized risks"
                />
              </CardHeader>
              <CardContent>
                {topBlockers.length === 0 ? (
                  <EmptyState message="No confirmed blocker types yet." />
                ) : (
                  <div className="space-y-2">
                    {topBlockers.map((b, idx) => (
                      <div
                        key={b.type}
                        className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-slate-500 w-5 shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="text-sm text-slate-200 truncate">
                            {formatType(b.type)}
                          </span>
                        </div>
                        <Badge className="bg-blue-800 text-blue-200 shrink-0 ml-2">
                          {b.confirmedPredictions} confirmed
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Panel 3: Top Missed Risks ── */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={<AlertTriangle className="w-5 h-5" />}
                  title="Top Missed Risks"
                  subtitle="Unreviewed attribution candidates — pending materialization assessment"
                />
              </CardHeader>
              <CardContent>
                {missedRisks.length === 0 ? (
                  <EmptyState message="No unreviewed attribution candidates." />
                ) : (
                  <div className="space-y-2">
                    {missedRisks.slice(0, 10).map((r) => (
                      <div
                        key={r.id}
                        className="px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400 truncate">
                            {formatPersonaId(r.personaId)}
                          </span>
                          <Badge className="bg-amber-900 text-amber-200 text-xs shrink-0 ml-2">
                            {formatType(r.predictionType)}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {r.predictionText}
                        </p>
                      </div>
                    ))}
                    {missedRisks.length > 10 && (
                      <p className="text-xs text-slate-600 text-center pt-1">
                        +{missedRisks.length - 10} more unreviewed
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Panel 4: Top False Alarms ── */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <SectionHeader
                  icon={<XCircle className="w-5 h-5" />}
                  title="Top False Alarms"
                  subtitle="Predictions that were reviewed and confirmed as non-materialized"
                />
              </CardHeader>
              <CardContent>
                {falseAlarms.length === 0 ? (
                  <EmptyState message="No false alarms recorded yet." />
                ) : (
                  <div className="space-y-2">
                    {falseAlarms.map((r) => (
                      <div
                        key={r.id}
                        className="px-3 py-2 rounded-md bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400 truncate">
                            {formatPersonaId(r.personaId)}
                          </span>
                          <Badge className="bg-rose-900 text-rose-200 text-xs shrink-0 ml-2">
                            {formatType(r.predictionType)}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {r.predictionText}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* ── Governance disclaimer ── */}
        <div className="mt-6 p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
          <p className="text-xs text-slate-600 text-center">
            Attribution Engine — governance data collection only. This view does not modify Council verdicts,
            CFA scores, voting logic, or consensus rules. No model training occurs.
          </p>
        </div>
      </div>
    </div>
  );
}
