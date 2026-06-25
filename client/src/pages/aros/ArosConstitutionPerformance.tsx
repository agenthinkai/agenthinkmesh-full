/**
 * ArosConstitutionPerformance.tsx — Constitution Performance Dashboard
 *
 * Compares performance metrics across all Constitution versions.
 * The Constitution itself is measurable. Every improvement is traceable.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BarChart2, TrendingUp, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

function pct(val: string | null | undefined) {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n * 100;
}

function pctLabel(val: string | null | undefined) {
  const n = pct(val);
  return n === 0 ? "—" : `${n.toFixed(1)}%`;
}

const METRICS = [
  { key: "executiveResponseRate", label: "Executive Response Rate", color: "bg-violet-500" },
  { key: "meetingRate", label: "Meeting Rate", color: "bg-blue-500" },
  { key: "proposalRate", label: "Proposal Rate", color: "bg-amber-500" },
  { key: "customerRate", label: "Customer Rate", color: "bg-emerald-500" },
  { key: "decisionTwinAccuracy", label: "Decision Twin Accuracy", color: "bg-cyan-500" },
  { key: "hiddenVariableAccuracy", label: "Hidden Variable Accuracy", color: "bg-pink-500" },
  { key: "revenueForecastAccuracy", label: "Revenue Forecast Accuracy", color: "bg-orange-500" },
  { key: "outcomeLedgerAccuracy", label: "Outcome Ledger Accuracy", color: "bg-teal-500" },
] as const;

type MetricKey = typeof METRICS[number]["key"];

export default function ArosConstitutionPerformance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [reviewPeriod, setReviewPeriod] = useState(30);
  const [generating, setGenerating] = useState(false);

  const { data: versions, isLoading } = trpc.arosConstitution.getPerformance.useQuery();
  const { data: reviews, refetch: refetchReviews } = trpc.arosConstitution.getReviews.useQuery();
  const generateReview = trpc.arosConstitution.generateReview.useMutation({
    onSuccess: () => {
      refetchReviews();
      setGenerating(false);
    },
    onError: () => setGenerating(false),
  });

  const handleGenerateReview = () => {
    if (!selectedVersionId) return;
    setGenerating(true);
    generateReview.mutate({ constitutionVersionId: selectedVersionId, reviewPeriodDays: reviewPeriod });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-16">

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <BarChart2 className="w-5 h-5 text-slate-500" />
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-700 font-mono tracking-widest">
                CONSTITUTION PERFORMANCE
              </Badge>
            </div>
            <h1 className="text-3xl font-light text-slate-100 tracking-tight mb-2">
              Performance Comparison
            </h1>
            <p className="text-slate-500 text-sm font-light">
              The Constitution itself is measurable. Every improvement is traceable and grounded in evidence.
            </p>
          </div>

          <Separator className="bg-slate-800 mb-12" />

          {/* Metric comparison table */}
          {isLoading ? (
            <div className="h-64 rounded-xl bg-slate-800/40 animate-pulse mb-12" />
          ) : !versions || versions.length === 0 ? (
            <div className="text-center py-16 text-slate-600 mb-12">
              <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No constitution versions to compare.</p>
            </div>
          ) : (
            <div className="mb-12">
              <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500 mb-6">
                Metric Comparison
              </h2>

              {/* Version column headers */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left text-slate-600 text-xs font-normal pb-4 pr-6 w-48">Metric</th>
                      {versions.map((v) => (
                        <th key={v.id} className="text-center text-slate-400 text-xs font-normal pb-4 px-4 min-w-[120px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-mono">v{v.version}</span>
                            {v.status === "ACTIVE" && (
                              <Badge className="bg-violet-600/20 text-violet-300 border border-violet-700/40 text-xs py-0">
                                Active
                              </Badge>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => (
                      <tr key={m.key} className="border-b border-slate-800/50">
                        <td className="py-4 pr-6 text-slate-400 text-xs">{m.label}</td>
                        {versions.map((v) => {
                          const val = pct(v[m.key as MetricKey] as string);
                          const maxVal = Math.max(
                            ...versions.map((vv) => pct(vv[m.key as MetricKey] as string))
                          );
                          const isMax = val > 0 && val === maxVal && versions.length > 1;
                          return (
                            <td key={v.id} className="py-4 px-4 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <span className={`font-mono text-sm ${isMax ? "text-emerald-400" : "text-slate-300"}`}>
                                  {pctLabel(v[m.key as MetricKey] as string)}
                                  {isMax && <TrendingUp className="w-3 h-3 inline ml-1" />}
                                </span>
                                {val > 0 && (
                                  <div className="w-16 h-1 rounded-full bg-slate-800">
                                    <div
                                      className={`h-full rounded-full ${m.color}`}
                                      style={{ width: `${Math.min(val * 2, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {/* Volume row */}
                    <tr className="border-b border-slate-800/50">
                      <td className="py-4 pr-6 text-slate-400 text-xs">Briefs Sent</td>
                      {versions.map((v) => (
                        <td key={v.id} className="py-4 px-4 text-center">
                          <span className="font-mono text-sm text-slate-300">
                            {v.totalBriefsSent.toLocaleString()}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-4 pr-6 text-slate-400 text-xs">Customers</td>
                      {versions.map((v) => (
                        <td key={v.id} className="py-4 px-4 text-center">
                          <span className="font-mono text-sm text-slate-300">
                            {v.totalCustomers.toLocaleString()}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Separator className="bg-slate-800 mb-12" />

          {/* Generate Review section (admin only) */}
          {isAdmin && versions && versions.length > 0 && (
            <div className="mb-12">
              <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500 mb-6">
                Generate Constitution Review Report
              </h2>
              <div className="p-6 border border-slate-700/50 rounded-xl bg-slate-900/40">
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Atlas will analyse performance data and produce evidence-based recommendations.
                  It will never modify the Constitution automatically.
                  Only recommendations are generated. Human approval creates the next version.
                </p>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="text-slate-600 text-xs block mb-2">Constitution Version</label>
                    <select
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm"
                      value={selectedVersionId ?? ""}
                      onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                    >
                      <option value="">Select version...</option>
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.version} {v.status === "ACTIVE" ? "(Active)" : "(Retired)"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 text-xs block mb-2">Review Period (days)</label>
                    <select
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm"
                      value={reviewPeriod}
                      onChange={(e) => setReviewPeriod(Number(e.target.value))}
                    >
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleGenerateReview}
                    disabled={!selectedVersionId || generating}
                    className="bg-violet-700 hover:bg-violet-600 text-white gap-2"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {generating ? "Generating..." : "Generate Review"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Review Reports */}
          {reviews && reviews.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500 mb-6">
                Constitution Review Reports
              </h2>
              <div className="space-y-4">
                {reviews.map((r) => {
                  const amendments = (() => {
                    try { return JSON.parse(r.suggestedAmendments ?? "[]") as string[]; }
                    catch { return []; }
                  })();
                  const patterns = (() => {
                    try { return JSON.parse(r.recurringFailurePatterns ?? "[]") as string[]; }
                    catch { return []; }
                  })();
                  return (
                    <div key={r.id} className="p-6 border border-slate-700/50 rounded-xl bg-slate-900/40">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-slate-200 text-sm font-medium">
                            Review Report #{r.id}
                          </p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {new Date(r.reviewPeriodStart).toLocaleDateString()} — {new Date(r.reviewPeriodEnd).toLocaleDateString()}
                            {" · "}{r.calibratedOutcomeCount} calibrated outcomes
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            r.status === "PUBLISHED"
                              ? "text-emerald-400 border-emerald-700/40"
                              : "text-slate-500 border-slate-700"
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </div>

                      {r.constitutionPerformance && (
                        <p className="text-slate-400 text-sm leading-relaxed mb-4">
                          {r.constitutionPerformance}
                        </p>
                      )}

                      {amendments.length > 0 && (
                        <div className="mb-3">
                          <p className="text-slate-600 text-xs mb-2">Suggested Amendments</p>
                          <div className="space-y-1">
                            {amendments.map((a, i) => (
                              <div key={i} className="flex gap-2 text-xs text-slate-400">
                                <span className="text-violet-500 flex-shrink-0">→</span>
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {patterns.length > 0 && (
                        <div>
                          <p className="text-slate-600 text-xs mb-2">Recurring Failure Patterns</p>
                          <div className="space-y-1">
                            {patterns.map((p, i) => (
                              <div key={i} className="flex gap-2 text-xs text-slate-400">
                                <span className="text-red-500 flex-shrink-0">!</span>
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 p-6 border border-slate-800 rounded-xl bg-slate-900/20 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-slate-400 text-xs font-medium">Evidence Governance Active</p>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              Future constitutional changes must be justified by accumulated evidence from real-world outcomes,
              never by opinion alone.
            </p>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
