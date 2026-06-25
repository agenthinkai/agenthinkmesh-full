/**
 * ArosConstitutionHistory.tsx — Constitution Version History
 *
 * Every version of the Atlas Constitution is preserved permanently.
 * Nothing is overwritten. This page shows the full audit trail.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { History, CheckCircle2, Archive, ChevronRight, BookOpen } from "lucide-react";
import { Link } from "wouter";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function pct(val: string | null | undefined) {
  if (!val) return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;
}

export default function ArosConstitutionHistory() {
  const { data: versions, isLoading } = trpc.arosConstitution.getHistory.useQuery();

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-6 py-16">

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <History className="w-5 h-5 text-slate-500" />
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-700 font-mono tracking-widest">
                CONSTITUTION HISTORY
              </Badge>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-light text-slate-100 tracking-tight mb-2">
                  Version History
                </h1>
                <p className="text-slate-500 text-sm font-light">
                  Every version is preserved permanently. Nothing is overwritten.
                </p>
              </div>
              <Link href="/aros/constitution">
                <Button variant="outline" size="sm" className="text-slate-400 border-slate-700 gap-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  View Active
                </Button>
              </Link>
            </div>
          </div>

          <Separator className="bg-slate-800 mb-12" />

          {/* Version list */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 rounded-xl bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          ) : !versions || versions.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <History className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No constitution versions found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {versions.map((v, idx) => (
                <div
                  key={v.id}
                  className={`rounded-2xl border p-8 ${
                    v.status === "ACTIVE"
                      ? "border-violet-700/40 bg-violet-900/10"
                      : "border-slate-700/50 bg-slate-900/40"
                  }`}
                >
                  {/* Version header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-mono text-slate-400">{v.version}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-slate-100 font-medium">
                            Constitution {v.version}
                          </h2>
                          {v.status === "ACTIVE" ? (
                            <Badge className="bg-violet-600/20 text-violet-300 border border-violet-700/40 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 border-slate-700 text-xs">
                              <Archive className="w-3 h-3 mr-1" />
                              Retired
                            </Badge>
                          )}
                          {idx === 0 && v.status === "ACTIVE" && (
                            <Badge className="bg-emerald-600/20 text-emerald-300 border border-emerald-700/40 text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs">
                          Activated {formatDate(v.effectiveDate)}
                        </p>
                      </div>
                    </div>
                    <Link href={`/aros/constitution/performance`}>
                      <Button variant="ghost" size="sm" className="text-slate-500 gap-1 text-xs">
                        Compare
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>

                  {/* Description */}
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {v.description}
                  </p>

                  {/* Performance metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Response Rate", value: pct(v.executiveResponseRate) },
                      { label: "Meeting Rate", value: pct(v.meetingRate) },
                      { label: "Proposal Rate", value: pct(v.proposalRate) },
                      { label: "Customer Rate", value: pct(v.customerRate) },
                      { label: "DT Accuracy", value: pct(v.decisionTwinAccuracy) },
                      { label: "HV Accuracy", value: pct(v.hiddenVariableAccuracy) },
                      { label: "Revenue Forecast", value: pct(v.revenueForecastAccuracy) },
                      { label: "Outcome Ledger", value: pct(v.outcomeLedgerAccuracy) },
                    ].map((m) => (
                      <div key={m.label} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                        <p className="text-slate-600 text-xs mb-1">{m.label}</p>
                        <p className="text-slate-200 text-sm font-mono">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 flex gap-6 text-xs text-slate-600">
                    <span>{v.totalBriefsSent} briefs sent</span>
                    <span>{v.totalResponses} responses</span>
                    <span>{v.totalMeetings} meetings</span>
                    <span>{v.totalProposals} proposals</span>
                    <span>{v.totalCustomers} customers</span>
                  </div>

                  {/* Checksum */}
                  <div className="mt-4 pt-4 border-t border-slate-800/60">
                    <p className="text-slate-700 text-xs font-mono truncate">
                      checksum: {v.checksum}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer note */}
          <div className="mt-12 p-6 border border-slate-800 rounded-xl bg-slate-900/20 text-center">
            <p className="text-slate-600 text-xs leading-relaxed">
              Atlas never modifies the active Constitution automatically.
              Every amendment requires evidence from accumulated outcomes and explicit human approval.
            </p>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
