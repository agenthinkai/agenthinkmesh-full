import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Lightbulb, TrendingUp, Target, Brain, BarChart2,
  CheckCircle, XCircle, AlertCircle, Clock,
} from "lucide-react";

function EffBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-xs w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-700/50 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-300 text-xs w-12 text-right">{value} ({pct}%)</span>
    </div>
  );
}

function SectorBar({ sector, count, max }: { sector: string; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-xs w-32 shrink-0 truncate">{sector}</span>
      <div className="flex-1 bg-slate-700/50 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-300 text-xs w-8 text-right">{count}</span>
    </div>
  );
}

export default function ArosLearning() {
  const { data: stats, isLoading } = trpc.arosExecutiveMemory.getLearningStats.useQuery();
  const { data: recentData } = trpc.arosExecutiveMemory.getRecentLearningEvents.useQuery({ limit: 20 });

  const events = recentData?.events ?? [];
  const total = stats?.total ?? 0;

  const sectorEntries = Object.entries(stats?.bySector ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxSector = sectorEntries[0]?.[1] ?? 1;

  const triggerEntries = Object.entries(stats?.byTrigger ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-slate-950 text-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Lightbulb className="w-7 h-7 text-amber-400" />
          Learning Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Every executive response improves Atlas — {total} learning events recorded
        </p>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-center py-16">Loading learning data...</div>
      ) : total === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No learning events yet.</p>
            <p className="text-slate-500 text-xs mt-1">Learning events are generated automatically after each executive response, meeting, proposal, or customer conversion.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {/* Panel 1 — Subject Line Effectiveness */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" />
                Subject Line Effectiveness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EffBar label="High" value={stats?.subjectLineHigh ?? 0} total={total} color="bg-emerald-500" />
              <EffBar label="Medium" value={stats?.subjectLineMedium ?? 0} total={total} color="bg-amber-500" />
              <EffBar label="Low" value={stats?.subjectLineLow ?? 0} total={total} color="bg-red-500" />
              <EffBar label="Unknown" value={stats?.subjectLineUnknown ?? 0} total={total} color="bg-slate-500" />
            </CardContent>
          </Card>

          {/* Panel 2 — Hidden Variable Accuracy */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                Hidden Variable Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EffBar label="Confirmed" value={stats?.hiddenVariableConfirmed ?? 0} total={total} color="bg-emerald-500" />
              <EffBar label="Partial" value={stats?.hiddenVariablePartial ?? 0} total={total} color="bg-amber-500" />
              <EffBar label="Incorrect" value={stats?.hiddenVariableIncorrect ?? 0} total={total} color="bg-red-500" />
              <EffBar label="Unknown" value={stats?.hiddenVariableUnknown ?? 0} total={total} color="bg-slate-500" />
            </CardContent>
          </Card>

          {/* Panel 3 — Decision Framing Accuracy */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-400" />
                Decision Framing Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EffBar label="Accurate" value={stats?.decisionFramingAccurate ?? 0} total={total} color="bg-emerald-500" />
              <EffBar label="Partial" value={stats?.decisionFramingPartial ?? 0} total={total} color="bg-amber-500" />
              <EffBar label="Missed" value={stats?.decisionFramingMissed ?? 0} total={total} color="bg-red-500" />
              <EffBar label="Unknown" value={stats?.decisionFramingUnknown ?? 0} total={total} color="bg-slate-500" />
            </CardContent>
          </Card>

          {/* Panel 4 — Constitution Effectiveness */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Constitution Effectiveness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EffBar label="Strong" value={stats?.constitutionStrong ?? 0} total={total} color="bg-emerald-500" />
              <EffBar label="Adequate" value={stats?.constitutionAdequate ?? 0} total={total} color="bg-blue-500" />
              <EffBar label="Weak" value={stats?.constitutionWeak ?? 0} total={total} color="bg-red-500" />
              <EffBar label="Unknown" value={stats?.constitutionUnknown ?? 0} total={total} color="bg-slate-500" />
            </CardContent>
          </Card>

          {/* Panel 5 — Sector Performance */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Learning Events by Sector
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sectorEntries.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-2">No sector data yet</p>
              ) : (
                sectorEntries.map(([sector, count]) => (
                  <SectorBar key={sector} sector={sector} count={count} max={maxSector} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Panel 6 — Trigger Type Breakdown */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Learning Trigger Types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {triggerEntries.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-2">No trigger data yet</p>
              ) : (
                triggerEntries.map(([trigger, count]) => (
                  <div key={trigger} className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">{trigger}</span>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">{count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Panel 7 — Recent Learning Events (spans 3 cols) */}
          <Card className="bg-slate-900 border-slate-800 md:col-span-2 xl:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Recent Learning Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No events yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {events.map(event => (
                    <div key={event.id} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                            {event.triggerType}
                          </Badge>
                          {event.companyName && (
                            <span className="text-slate-300 text-xs font-medium">{event.companyName}</span>
                          )}
                          {event.executiveName && (
                            <span className="text-slate-500 text-xs">· {event.executiveName}</span>
                          )}
                        </div>
                        <span className="text-slate-500 text-xs">
                          {new Date(event.eventDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {event.subjectLineEffectiveness && event.subjectLineEffectiveness !== "UNKNOWN" && (
                          <span className="text-xs text-slate-400">Subject: <span className={
                            event.subjectLineEffectiveness === "HIGH" ? "text-emerald-400" :
                            event.subjectLineEffectiveness === "MEDIUM" ? "text-amber-400" : "text-red-400"
                          }>{event.subjectLineEffectiveness}</span></span>
                        )}
                        {event.hiddenVariableEffectiveness && event.hiddenVariableEffectiveness !== "UNKNOWN" && (
                          <span className="text-xs text-slate-400">HV: <span className={
                            event.hiddenVariableEffectiveness === "CONFIRMED" ? "text-emerald-400" :
                            event.hiddenVariableEffectiveness === "PARTIAL" ? "text-amber-400" : "text-red-400"
                          }>{event.hiddenVariableEffectiveness}</span></span>
                        )}
                        {event.constitutionEffectiveness && event.constitutionEffectiveness !== "UNKNOWN" && (
                          <span className="text-xs text-slate-400">Constitution: <span className={
                            event.constitutionEffectiveness === "STRONG" ? "text-emerald-400" :
                            event.constitutionEffectiveness === "ADEQUATE" ? "text-blue-400" : "text-red-400"
                          }>{event.constitutionEffectiveness}</span></span>
                        )}
                      </div>
                      {event.whatWorked && (
                        <div className="flex gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <p className="text-slate-300 text-xs">{event.whatWorked}</p>
                        </div>
                      )}
                      {event.whatFailed && (
                        <div className="flex gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          <p className="text-slate-300 text-xs">{event.whatFailed}</p>
                        </div>
                      )}
                      {event.recommendedImprovements && (
                        <div className="bg-amber-950/20 border border-amber-500/20 rounded p-2">
                          <p className="text-amber-300 text-xs">{event.recommendedImprovements}</p>
                        </div>
                      )}
                      <Separator className="bg-slate-700/50" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
