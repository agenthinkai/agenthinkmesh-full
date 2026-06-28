import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Eye,
  AlertTriangle,
  RefreshCw,
  Globe,
  Zap,
} from "lucide-react";

function ValidationDot({ passed }: { passed: boolean }) {
  return passed ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
  ) : (
    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
  );
}

function SSSBadge({ value }: { value: number }) {
  const color =
    value >= 90
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : value >= 65
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-red-500/20 text-red-300 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${color}`}>
      SSS {value}
    </span>
  );
}

function ESIBadge({ value }: { value: number }) {
  const color =
    value >= 85
      ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
      : value >= 70
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-red-500/20 text-red-300 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${color}`}>
      ESI {value}
    </span>
  );
}

function QueueBadge({ queue }: { queue: string | null }) {
  if (queue === "IMMEDIATE")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 border text-xs">
        IMMEDIATE
      </Badge>
    );
  if (queue === "WATCH")
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 border text-xs">
        WATCH
      </Badge>
    );
  return (
    <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 border text-xs">
      MONITOR
    </Badge>
  );
}

export default function ArosTomorrowsDispatch() {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.arosExecutiveIntelligenceFactory.tomorrowsDispatch.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const nextDispatch = data?.nextDispatchDate
    ? new Date(data.nextDispatchDate)
    : null;

  const formatCountdown = (target: Date) => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return "Dispatch window open";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tomorrow's Dispatch</h1>
          <p className="text-slate-400 text-sm mt-1">
            Live IMMEDIATE queue · 9-point validation · Next autonomous dispatch at{" "}
            <span className="text-white font-mono">09:00 UTC</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="border-slate-600 text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Dispatch clock */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-800/60 border-slate-700 col-span-1 sm:col-span-2">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Next Autonomous Dispatch</p>
                <p className="text-lg font-bold text-white font-mono">
                  {nextDispatch ? nextDispatch.toUTCString().replace(" GMT", " UTC") : "—"}
                </p>
                {nextDispatch && (
                  <p className="text-xs text-emerald-400 font-mono">
                    {formatCountdown(nextDispatch)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-5 pb-4 flex flex-col items-center justify-center">
            <p className="text-xs text-slate-400 mb-1">IMMEDIATE Queue</p>
            <p className="text-3xl font-bold text-emerald-400">
              {isLoading ? "—" : data?.immediate.length ?? 0}
            </p>
            <p className="text-xs text-slate-500">ready to dispatch</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-5 pb-4 flex flex-col items-center justify-center">
            <p className="text-xs text-slate-400 mb-1">WATCH Queue</p>
            <p className="text-3xl font-bold text-amber-400">
              {isLoading ? "—" : data?.watch.length ?? 0}
            </p>
            <p className="text-xs text-slate-500">monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Triple Gate reminder */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/40 border border-slate-700">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300">
          <span className="font-semibold text-white">Triple Gate — </span>
          All three conditions must pass before a brief is dispatched:{" "}
          <span className="font-mono text-emerald-300">SSS ≥ 90</span> ·{" "}
          <span className="font-mono text-violet-300">ESI ≥ 85</span> ·{" "}
          <span className="font-mono text-sky-300">Evidence Confidence ≥ 80</span>.
          Atlas is rewarded for identifying the most strategically significant decisions — not for sending more briefs.
        </div>
      </div>

      {/* IMMEDIATE queue */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          IMMEDIATE Queue
          <span className="text-xs text-slate-400 font-normal ml-1">
            Board-level decisions · Max 10/day
          </span>
        </h2>

        {isLoading ? (
          <div className="text-slate-400 text-sm py-8 text-center">Loading queue…</div>
        ) : !data?.immediate.length ? (
          <Card className="bg-slate-800/40 border-slate-700">
            <CardContent className="py-10 text-center">
              <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No companies in IMMEDIATE queue.</p>
              <p className="text-slate-500 text-xs mt-1">
                The Continuous Readiness pipeline will populate this queue as decisions mature.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.immediate.map((item, idx) => {
              const isExpanded = expanded === item.outreach.id;
              const passCount = item.validationGates.filter((g) => g.passed).length;
              const allPassed = item.allValidationsPassed;

              return (
                <Card
                  key={item.outreach.id}
                  className={`border transition-colors ${
                    allPassed
                      ? "bg-slate-800/60 border-emerald-700/40"
                      : "bg-slate-800/60 border-amber-700/40"
                  }`}
                >
                  <CardHeader className="pb-2 pt-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm">
                              {item.company.companyName}
                            </span>
                            <QueueBadge queue={item.outreach.atlasQueue} />
                            {allPassed ? (
                              <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> All 9 gates passed
                              </span>
                            ) : (
                              <span className="text-xs text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> {passCount}/9 gates passed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <SSSBadge value={item.outreach.sss ?? 0} />
                            <ESIBadge value={item.outreach.esi ?? 0} />
                            <span className="text-xs text-slate-400">
                              {item.company.sector} · {item.company.country}
                            </span>
                            {item.company.ceoName && (
                              <span className="text-xs text-slate-400">
                                → {item.company.ceoName}
                              </span>
                            )}
                          </div>
                          {item.outreach.emailSubject && (
                            <p className="text-xs text-slate-300 mt-1 truncate max-w-lg">
                              "{item.outreach.emailSubject}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white text-xs"
                          onClick={() => setExpanded(isExpanded ? null : item.outreach.id)}
                        >
                          {isExpanded ? "Hide" : "Validate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-600 text-slate-300 hover:text-white text-xs"
                          onClick={() => setLocation(`/aros/dispatch-preview?id=${item.outreach.id}`)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="px-5 pb-4">
                      <div className="mt-2 border-t border-slate-700 pt-3">
                        <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">
                          9-Point Validation
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {item.validationGates.map((gate) => (
                            <div
                              key={gate.gate}
                              className="flex items-center gap-2 text-xs"
                            >
                              <ValidationDot passed={gate.passed} />
                              <span
                                className={
                                  gate.passed ? "text-slate-300" : "text-red-300"
                                }
                              >
                                {gate.gate}
                              </span>
                              <span className="text-slate-500 font-mono ml-auto">
                                {String(gate.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {item.company.sssRationale && (
                          <p className="text-xs text-slate-400 mt-3 italic border-l-2 border-slate-600 pl-3">
                            {item.company.sssRationale}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* WATCH queue */}
      {!!data?.watch.length && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            WATCH Queue
            <span className="text-xs text-slate-400 font-normal ml-1">
              Re-evaluated every 24 hours
            </span>
          </h2>
          <div className="space-y-2">
            {data.watch.map((item) => (
              <div
                key={item.outreach.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <span className="text-sm text-white font-medium">
                      {item.company.companyName}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {item.company.sector} · {item.company.country}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <SSSBadge value={item.outreach.sss ?? 0} />
                  <ESIBadge value={item.outreach.esi ?? 0} />
                  <QueueBadge queue="WATCH" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MONITOR count */}
      {!!data?.monitorCount && (
        <p className="text-xs text-slate-500 text-center">
          {data.monitorCount} additional companies in MONITOR — no communication, evidence collection active.
        </p>
      )}

      {/* Dispatch status footer */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900/60 border border-slate-700">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">
              {data?.immediate.filter((i) => i.allValidationsPassed).length ?? 0}
            </span>{" "}
            briefs ready for autonomous dispatch at 09:00 UTC
          </span>
        </div>
        {nextDispatch && (
          <span className="text-xs text-slate-400 font-mono">
            Next dispatch: {formatCountdown(nextDispatch)}
          </span>
        )}
      </div>
    </div>
  );
}
