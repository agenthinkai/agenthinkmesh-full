import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, BarChart3, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

const COUNCIL_MODE_LABELS: Record<string, string> = {
  gcc: "GCC PE",
  global_vc: "Global VC",
  india_pe: "India PE",
  infrastructure: "Infrastructure",
  gcc_equities: "GCC Equities",
};

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function AccuracyCard({
  label,
  data,
}: {
  label: string;
  data: {
    total: number;
    accuracy: number | null;
    falsePositiveRate: number | null;
    falseNegativeRate: number | null;
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
  };
}) {
  const hasData = data.total > 0;
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-300">{label}</CardTitle>
        <p className="text-xs text-zinc-500">{data.total} resolved outcome{data.total !== 1 ? "s" : ""}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasData ? (
          <p className="text-xs text-zinc-600 italic">No resolved outcomes yet</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Overall Accuracy</span>
              <span className="text-sm font-semibold text-emerald-400">{pct(data.accuracy)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-emerald-900/30 rounded p-2">
                <p className="text-zinc-500 mb-0.5">True Positives</p>
                <p className="text-emerald-400 font-medium">{data.truePositive}</p>
                <p className="text-zinc-600">Approved → Succeeded</p>
              </div>
              <div className="bg-blue-900/30 rounded p-2">
                <p className="text-zinc-500 mb-0.5">True Negatives</p>
                <p className="text-blue-400 font-medium">{data.trueNegative}</p>
                <p className="text-zinc-600">Rejected → Failed</p>
              </div>
              <div className="bg-red-900/30 rounded p-2">
                <p className="text-zinc-500 mb-0.5">False Positives</p>
                <p className="text-red-400 font-medium">{data.falsePositive}</p>
                <p className="text-zinc-600">Approved → Failed</p>
                <p className="text-red-400/70 text-[10px] mt-0.5">Rate: {pct(data.falsePositiveRate)}</p>
              </div>
              <div className="bg-orange-900/30 rounded p-2">
                <p className="text-zinc-500 mb-0.5">False Negatives</p>
                <p className="text-orange-400 font-medium">{data.falseNegative}</p>
                <p className="text-zinc-600">Rejected → Succeeded</p>
                <p className="text-orange-400/70 text-[10px] mt-0.5">Rate: {pct(data.falseNegativeRate)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function VoteBar({ label, pct: p, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-zinc-500 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(p * 100).toFixed(1)}%` }} />
      </div>
      <span className="w-10 text-right text-zinc-400">{(p * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function OutcomeMetrics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const metricsQuery = trpc.outcomeLedger.accuracyMetrics.useQuery();
  const personaQuery = trpc.outcomeLedger.personaAnalytics.useQuery();

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Admin access required.</p>
      </div>
    );
  }

  const metrics = metricsQuery.data;
  const personas = personaQuery.data?.personas ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/outcomes")} className="text-zinc-400 hover:text-zinc-100">
          <ChevronLeft className="w-4 h-4 mr-1" /> Outcome Ledger
        </Button>
        <BarChart3 className="w-5 h-5 text-indigo-400" />
        <h1 className="text-xl font-semibold text-zinc-100">Outcome Metrics</h1>
        <Badge className="bg-indigo-900 text-indigo-200 text-xs ml-2">Read-only · No retraining</Badge>
      </div>

      {metricsQuery.isLoading ? (
        <p className="text-zinc-500">Loading metrics…</p>
      ) : metrics ? (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Total Records</p>
                <p className="text-2xl font-semibold text-zinc-100">{metrics.totalRows}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Resolved</p>
                <p className="text-2xl font-semibold text-zinc-100">{metrics.resolvedRows}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">Overall Accuracy</p>
                <p className="text-2xl font-semibold text-emerald-400">{pct(metrics.overall.accuracy)}</p>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <p className="text-xs text-zinc-500 mb-1">False Positive Rate</p>
                <p className="text-2xl font-semibold text-red-400">{pct(metrics.overall.falsePositiveRate)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Overall */}
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Overall</h2>
          <div className="mb-6">
            <AccuracyCard label="All Council Modes" data={metrics.overall} />
          </div>

          {/* By mode */}
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">By Council Mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {Object.entries(metrics.byMode).map(([mode, data]) => (
              <AccuracyCard
                key={mode}
                label={COUNCIL_MODE_LABELS[mode] ?? mode}
                data={data as any}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* Persona Analytics */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" /> Persona Analytics
        <span className="text-xs font-normal text-zinc-600 normal-case tracking-normal">— display only, no weighting, no retraining</span>
      </h2>

      {personaQuery.isLoading ? (
        <p className="text-zinc-500 text-sm">Loading persona data…</p>
      ) : personas.length === 0 ? (
        <p className="text-zinc-600 text-sm italic">No CFA records yet. Persona analytics populate after council runs are audited by CFA.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-medium">Persona</th>
                <th className="text-right px-3 py-2 font-medium">Votes Cast</th>
                <th className="text-left px-3 py-2 font-medium w-48">Vote Distribution</th>
                <th className="text-right px-3 py-2 font-medium">Alignment Score</th>
                <th className="text-right px-3 py-2 font-medium">Outcome Agreement</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.personaId} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="px-3 py-3">
                    <p className="text-zinc-200 font-medium">{p.personaName}</p>
                    <p className="text-zinc-600 text-xs font-mono">{p.personaId}</p>
                  </td>
                  <td className="px-3 py-3 text-right text-zinc-300">{p.votesCast}</td>
                  <td className="px-3 py-3 space-y-1">
                    <VoteBar label="Hard Yes" pct={p.hardYesPct} color="bg-emerald-500" />
                    <VoteBar label="Soft Yes" pct={p.softYesPct} color="bg-teal-500" />
                    <VoteBar label="Soft No" pct={p.softNoPct} color="bg-orange-500" />
                    <VoteBar label="Hard No" pct={p.hardNoPct} color="bg-red-500" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    {p.alignmentScore != null ? (
                      <span className={`font-semibold ${p.alignmentScore >= 0.75 ? "text-emerald-400" : p.alignmentScore >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                        {(p.alignmentScore * 100).toFixed(1)}%
                      </span>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {p.outcomeAgreementRate != null ? (
                      <div className="flex items-center justify-end gap-1">
                        {p.outcomeAgreementRate >= 0.6 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : p.outcomeAgreementRate >= 0.4 ? (
                          <Minus className="w-3.5 h-3.5 text-yellow-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className={`font-semibold ${p.outcomeAgreementRate >= 0.6 ? "text-emerald-400" : p.outcomeAgreementRate >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                          {(p.outcomeAgreementRate * 100).toFixed(1)}%
                        </span>
                        <span className="text-zinc-600 text-xs">({p.outcomeTotal})</span>
                      </div>
                    ) : <span className="text-zinc-600">—</span>}
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
