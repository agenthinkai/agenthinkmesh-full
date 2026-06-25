/**
 * ArosDailyCycle.tsx — Daily Executive Intelligence Cycle Dashboard
 *
 * Displays the daily ranked table, three-queue breakdown (IMMEDIATE / WATCH / MONITOR),
 * global coverage map, and success metrics for the Atlas Daily Loop.
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Globe, Zap, Eye, Radio, Target, TrendingUp, Clock, CheckCircle2,
  AlertTriangle, BarChart2, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Queue colour helpers ──────────────────────────────────────────────────────

const QUEUE_CONFIG = {
  IMMEDIATE: {
    label: "IMMEDIATE",
    description: "Board-level strategic decisions. Ready for delivery. Max 10/day.",
    color: "text-red-400",
    bg: "bg-red-950/40 border-red-800",
    badge: "bg-red-600 text-white",
    icon: <Zap className="w-4 h-4" />,
  },
  WATCH: {
    label: "WATCH",
    description: "Strong opportunities requiring additional monitoring. Re-evaluate every 24 hours.",
    color: "text-amber-400",
    bg: "bg-amber-950/40 border-amber-800",
    badge: "bg-amber-600 text-white",
    icon: <Eye className="w-4 h-4" />,
  },
  MONITOR: {
    label: "MONITOR",
    description: "Decision not mature enough. No communication. Continue collecting evidence.",
    color: "text-slate-400",
    bg: "bg-slate-900/60 border-slate-700",
    badge: "bg-slate-600 text-white",
    icon: <Radio className="w-4 h-4" />,
  },
} as const;

// ── Global coverage regions ───────────────────────────────────────────────────

const REGIONS = [
  { name: "North America", flag: "🇺🇸", sectors: ["Global Banks", "Infrastructure Investors", "Healthcare Systems", "Industrial Technology", "Asset Managers", "Energy Companies"] },
  { name: "Europe", flag: "🇪🇺", sectors: ["Global Banks", "Telecommunications", "Industrial Technology", "Asset Managers", "Energy Companies", "Healthcare Systems"] },
  { name: "United Kingdom", flag: "🇬🇧", sectors: ["Global Banks", "Asset Managers", "Infrastructure Investors", "Telecommunications"] },
  { name: "Middle East", flag: "🌙", sectors: ["Sovereign Funds", "Global Banks", "Infrastructure Investors", "Energy Companies"] },
  { name: "Asia-Pacific", flag: "🌏", sectors: ["Global Banks", "Industrial Technology", "Telecommunications", "Asset Managers", "Infrastructure Investors", "Healthcare Systems"] },
  { name: "Major Sovereign Funds", flag: "🏛️", sectors: ["Sovereign Funds (Norway, Singapore, Abu Dhabi, China, Kuwait)"] },
  { name: "Global Banks", flag: "🏦", sectors: ["Cross-border (Switzerland, France, Singapore, Japan, India)"] },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArosDailyCycle() {
  const [showAll, setShowAll] = useState(false);

  // Fetch ranked table from queue stats
  const { data: queueStats, isLoading: queueLoading, refetch: refetchQueue } = trpc.arosExecutiveIntelligenceFactory.getQueueStats.useQuery();
  const { data: hierarchy, isLoading: hierarchyLoading } = trpc.arosSignificance.getDecisionHierarchySummary.useQuery();
  const { data: config } = trpc.arosSignificance.getConfig.useQuery();

  // Fetch the ranked outreach queue
  const { data: queueItems, isLoading: itemsLoading, refetch: refetchItems } = trpc.arosExecutiveIntelligenceFactory.listQueue.useQuery({
    status: undefined,
    limit: showAll ? 100 : 30,
  });

  const handleRefresh = () => {
    void refetchQueue();
    void refetchItems();
    toast.success("Daily cycle data refreshed");
  };

  // listQueue returns { rows, total } — extract rows
  type QueueRow = { outreach: { id: number; companyId: number; emailSubject: string | null; emailBody: string | null; executiveBrief: string | null; sdrTeaser: string | null; approvalStatus: string; priority: string; sss: number | null; esi: number | null; decisionLevel: string | null; atlasQueue: string | null; }; company: { companyName: string; sector: string; country: string } | null };
  const rows: QueueRow[] = Array.isArray(queueItems) ? (queueItems as QueueRow[]) : ((queueItems as { rows?: QueueRow[] } | null)?.rows ?? []);

  // Partition queue items into three buckets
  const immediateItems = rows.filter((r) =>
    r.outreach.atlasQueue === "IMMEDIATE" || r.outreach.priority === "IMMEDIATE"
  );
  const watchItems = rows.filter((r) =>
    r.outreach.atlasQueue === "WATCH" || (r.outreach.priority === "HIGH" && r.outreach.atlasQueue !== "IMMEDIATE")
  );
  const monitorItems = rows.filter((r) =>
    r.outreach.atlasQueue === "MONITOR" || (!r.outreach.atlasQueue && r.outreach.priority !== "IMMEDIATE" && r.outreach.priority !== "HIGH")
  );

  const threshold = config?.briefGenerationThreshold ?? 90;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-400" />
            Daily Executive Intelligence Cycle
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Atlas scans the global universe every business day. Only the most strategically significant decisions reach executives.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2 border-slate-700 text-slate-300">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Triple-Gate Reminder */}
      <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-4">
        <p className="text-blue-300 text-sm font-medium mb-1">Active Brief Generation Gate (V2 Triple-Gate)</p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> SSS ≥ {threshold}</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> ESI ≥ 85</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Evidence Confidence ≥ 80</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> All 4 Quality Gate questions = YES</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Max 10 IMMEDIATE briefs/day</span>
        </div>
      </div>

      {/* Universe Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Universe Size", value: hierarchy?.total ?? 0, icon: <Globe className="w-4 h-4" />, color: "text-blue-400" },
          { label: "LEVEL_4 Decisions", value: hierarchy?.level4 ?? 0, icon: <Zap className="w-4 h-4" />, color: "text-red-400" },
          { label: "Quality Gate Passed", value: hierarchy?.qualityGatePassed ?? 0, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-400" },
          { label: "Avg SSS", value: `${hierarchy?.avgSss ?? 0}`, icon: <Target className="w-4 h-4" />, color: "text-amber-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 ${kpi.color} mb-1`}>
                {kpi.icon}
                <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{hierarchyLoading ? "—" : kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Three Queue Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["IMMEDIATE", "WATCH", "MONITOR"] as const).map((queue) => {
          const cfg = QUEUE_CONFIG[queue];
          const items = queue === "IMMEDIATE" ? immediateItems : queue === "WATCH" ? watchItems : monitorItems;
          return (
            <Card key={queue} className={`border ${cfg.bg}`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-bold ${cfg.color} flex items-center gap-2`}>
                  {cfg.icon}
                  {cfg.label}
                  <span className="ml-auto text-xs font-normal text-slate-400">{items.length} companies</span>
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">{cfg.description}</p>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 max-h-64 overflow-y-auto">
                {queueLoading || itemsLoading ? (
                  <p className="text-slate-500 text-xs">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-slate-600 text-xs italic">No companies in this queue today.</p>
                ) : (
                  items.slice(0, 10).map((r) => (
                    <div key={r.outreach.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[140px]">
                          {r.company?.companyName ?? "Unknown"}
                        </span>
                        <span className={`text-xs font-bold ${cfg.color}`}>
                          SSS {r.outreach.sss ?? "—"}
                        </span>
                      </div>
                      <div className="flex gap-2 text-xs text-slate-500">
                        <span>ESI {r.outreach.esi ?? "—"}</span>
                        {r.outreach.decisionLevel && (
                          <span className="text-slate-600">{r.outreach.decisionLevel}</span>
                        )}
                      </div>
                      {r.outreach.emailSubject && (
                        <p className="text-xs text-slate-500 mt-1 truncate">{r.outreach.emailSubject}</p>
                      )}
                    </div>
                  ))
                )}
                {items.length > 10 && (
                  <p className="text-xs text-slate-600 text-center">+{items.length - 10} more</p>
                )}

              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator className="border-slate-800" />

      {/* Ranked Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-amber-400" />
            Global Ranked Table — Today's Detected Decisions
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs text-slate-400">
            {showAll ? "Show Top 30" : "Show All"}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="text-left p-3 text-slate-400 font-medium">Company</th>
                <th className="text-left p-3 text-slate-400 font-medium">Strategic Decision</th>
                <th className="text-center p-3 text-slate-400 font-medium">SSS</th>
                <th className="text-center p-3 text-slate-400 font-medium">ESI</th>
                <th className="text-center p-3 text-slate-400 font-medium">Level</th>
                <th className="text-center p-3 text-slate-400 font-medium">Queue</th>
                <th className="text-center p-3 text-slate-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
        {itemsLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-500">Loading ranked table…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-600 italic">No decisions detected today. The daily loop will populate this table when it runs.</td></tr>
            ) : (
              rows.map((r) => {
                  const queue = (r.outreach.atlasQueue ?? (r.outreach.priority === "IMMEDIATE" ? "IMMEDIATE" : r.outreach.priority === "HIGH" ? "WATCH" : "MONITOR")) as "IMMEDIATE" | "WATCH" | "MONITOR";
                  const qcfg = QUEUE_CONFIG[queue] ?? QUEUE_CONFIG.MONITOR;
                  const sss = r.outreach.sss ?? 0;
                  return (
                    <tr key={r.outreach.id} className="border-b border-slate-800/50 hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        <div className="font-medium text-slate-200 truncate max-w-[140px]">
                          {r.company?.companyName ?? "Unknown"}
                        </div>
                        <div className="text-slate-500 text-xs truncate max-w-[140px]">
                          {r.company?.sector ?? ""} · {r.company?.country ?? ""}
                        </div>
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <p className="text-slate-300 truncate">{r.outreach.emailSubject ?? r.outreach.executiveBrief ?? "—"}</p>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-bold ${sss >= 90 ? "text-red-400" : sss >= 65 ? "text-amber-400" : "text-slate-400"}`}>
                          {sss}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-medium ${(r.outreach.esi ?? 0) >= 85 ? "text-purple-400" : "text-slate-400"}`}>
                          {r.outreach.esi ?? "—"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-slate-500 text-xs">{r.outreach.decisionLevel ?? "—"}</span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={`text-xs ${qcfg.badge}`}>{queue}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {queue === "IMMEDIATE" && r.outreach.approvalStatus === "PENDING_CEO_REVIEW" ? (
                          <span className="text-xs text-amber-400 font-medium">Awaiting Approval</span>
                        ) : queue === "IMMEDIATE" && r.outreach.approvalStatus === "SENT" ? (
                          <span className="text-xs text-green-400 font-medium flex items-center gap-1 justify-center">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </span>
                        ) : queue === "WATCH" ? (
                          <span className="text-xs text-amber-500 flex items-center gap-1 justify-center">
                            <Clock className="w-3 h-3" /> Re-evaluate 24h
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 flex items-center gap-1 justify-center">
                            <Radio className="w-3 h-3" /> Monitoring
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
            )}
            </tbody>
          </table>
        </div>
      </div>

      <Separator className="border-slate-800" />

      {/* Global Coverage */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-blue-400" />
          Global Coverage — 7 Regions · 10 Sectors · 40 Target Pairs
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REGIONS.map((region) => (
            <Card key={region.name} className="bg-slate-900 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{region.flag}</span>
                  <span className="text-sm font-semibold text-slate-200">{region.name}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {region.sectors.map((s) => (
                    <span key={s} className="text-xs bg-slate-800 text-slate-400 rounded px-2 py-0.5">{s}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Success Metric */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">Atlas Success Metric</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Atlas is <strong className="text-white">not rewarded</strong> for sending more Executive Intelligence Briefs.
              Atlas is rewarded for identifying the most strategically significant executive decisions <em>before competitors recognise them</em>.
              Every brief should make the recipient think: <strong className="text-amber-300">"This observation deserves discussion at our executive committee."</strong>
              If Atlas cannot produce that level of insight — continue monitoring until the evidence justifies action.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
