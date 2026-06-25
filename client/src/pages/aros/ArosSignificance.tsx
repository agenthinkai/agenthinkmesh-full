/**
 * ArosSignificance.tsx — Strategic Significance Engine Dashboard
 *
 * "Atlas is no longer rewarded for generating more briefs.
 *  Atlas is rewarded for generating fewer, better, more consequential briefs."
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Target, Zap, Shield, Eye, TrendingUp, AlertTriangle, Settings, BarChart2,
} from "lucide-react";

// ── Decision Level helpers ────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, { label: string; color: string; bg: string; description: string }> = {
  LEVEL_1: {
    label: "L1 — Operational Observation",
    color: "text-slate-400",
    bg: "bg-slate-800/40",
    description: "Store only. No brief generated.",
  },
  LEVEL_2: {
    label: "L2 — Strategic Watch",
    color: "text-blue-400",
    bg: "bg-blue-900/30",
    description: "Monitor continuously. Update Decision Twin.",
  },
  LEVEL_3: {
    label: "L3 — Executive Intelligence Candidate",
    color: "text-amber-400",
    bg: "bg-amber-900/30",
    description: "Eligible for review.",
  },
  LEVEL_4: {
    label: "L4 — Board-Level Decision",
    color: "text-red-400",
    bg: "bg-red-900/30",
    description: "Immediate brief. Highest calibration priority.",
  },
};

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <Badge variant="outline" className="text-slate-500">Unscored</Badge>;
  const cfg = LEVEL_LABELS[level] ?? LEVEL_LABELS.LEVEL_1;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {level.replace("LEVEL_", "L")}
    </span>
  );
}

function SSSBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = value >= 85 ? "bg-red-500" : value >= 65 ? "bg-amber-500" : value >= 40 ? "bg-blue-500" : "bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right text-slate-300">{value}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArosSignificance() {
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [localThreshold, setLocalThreshold] = useState(85);

  const { data: config, refetch: refetchConfig } = trpc.arosSignificance.getConfig.useQuery();
  // Sync threshold from server config when it loads (via useEffect to avoid setState in render)
  const configThreshold = config?.briefGenerationThreshold;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (configThreshold !== undefined && configThreshold !== localThreshold && !editingThreshold) {
    // Safe: only runs once when config first loads and user hasn't started editing
    setTimeout(() => setLocalThreshold(configThreshold), 0);
  }

  const { data: hierarchy, isLoading: hierarchyLoading } = trpc.arosSignificance.getDecisionHierarchySummary.useQuery();
  const { data: distribution, isLoading: distLoading } = trpc.arosSignificance.getScoreDistribution.useQuery();

  const updateConfig = trpc.arosSignificance.updateConfig.useMutation({
    onSuccess: () => {
      toast.success(`Brief generation threshold set to ${localThreshold}`);
      void refetchConfig();
      setEditingThreshold(false);
    },
  });

  const handleSaveThreshold = () => {
    updateConfig.mutate({ briefGenerationThreshold: localThreshold });
  };

  // Prepare histogram data — bucket index determines colour (0=0-9, 1=10-19, etc.)
  const sssHistogram = (distribution?.sss ?? []).map((b, i) => ({
    name: b.bucket,
    count: b.count,
    fill: i >= 9 ? "#ef4444" : i >= 7 ? "#f59e0b" : i >= 4 ? "#3b82f6" : "#475569",
  }));

  const esiHistogram = (distribution?.esi ?? []).map((b, i) => ({
    name: b.bucket,
    count: b.count,
    fill: i >= 8 ? "#8b5cf6" : i >= 6 ? "#6366f1" : "#334155",
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-400" />
            Strategic Significance Engine
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Every detected decision is scored before any brief is generated. Only the most consequential decisions reach executives.
          </p>
        </div>
      </div>

      {/* North Star Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-400 mb-1">Avg SSS</div>
            <div className="text-3xl font-bold text-amber-400">{hierarchy?.avgSss ?? "—"}</div>
            <div className="text-xs text-slate-500 mt-0.5">Strategic Significance Score</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-400 mb-1">Avg ESI</div>
            <div className="text-3xl font-bold text-purple-400">{hierarchy?.avgEsi ?? "—"}</div>
            <div className="text-xs text-slate-500 mt-0.5">Executive Surprise Index</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-400 mb-1">Board-Level (L4)</div>
            <div className="text-3xl font-bold text-red-400">{hierarchy?.level4 ?? "—"}</div>
            <div className="text-xs text-slate-500 mt-0.5">Immediate brief eligible</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-slate-400 mb-1">Quality Gate Passed</div>
            <div className="text-3xl font-bold text-green-400">{hierarchy?.qualityGatePassed ?? "—"}</div>
            <div className="text-xs text-slate-500 mt-0.5">All four criteria met</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Decision Hierarchy */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Decision Hierarchy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(LEVEL_LABELS).map(([level, cfg]) => {
              const countMap: Record<string, number> = {
                LEVEL_1: hierarchy?.level1 ?? 0,
                LEVEL_2: hierarchy?.level2 ?? 0,
                LEVEL_3: hierarchy?.level3 ?? 0,
                LEVEL_4: hierarchy?.level4 ?? 0,
              };
              const cnt = countMap[level] ?? 0;
              const total = hierarchy?.total ?? 1;
              const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
              return (
                <div key={level} className={`rounded-lg p-3 ${cfg.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs font-mono text-slate-300">{cnt}</span>
                  </div>
                  <div className="text-xs text-slate-500 mb-1.5">{cfg.description}</div>
                  <Progress value={pct} className="h-1" />
                </div>
              );
            })}
            <div className="pt-1 text-xs text-slate-500 flex justify-between">
              <span>Unscored: {hierarchy?.unscored ?? 0}</span>
              <span>Total: {hierarchy?.total ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* SSS Histogram */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              SSS Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distLoading ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <RechartsBarChart data={sssHistogram} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {sssHistogram.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-3 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-600 inline-block" />L1 &lt;40</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />L2 40–64</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />L3 65–84</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />L4 85+</span>
            </div>
          </CardContent>
        </Card>

        {/* ESI Histogram */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Executive Surprise Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distLoading ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <RechartsBarChart data={esiHistogram} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {esiHistogram.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-slate-500 mt-2">
              How likely is the executive to respond: "I had not considered that." Atlas optimises for ESI, not word count.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Threshold Configuration */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" />
            Brief Generation Gate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Threshold slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Brief Generation Threshold</span>
                <span className="text-lg font-bold text-amber-400">{localThreshold}</span>
              </div>
              <Slider
                value={[localThreshold]}
                onValueChange={([v]) => { setLocalThreshold(v); setEditingThreshold(true); }}
                min={50}
                max={100}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Only decisions scoring ≥ {localThreshold} SSS AND passing all four Quality Gate questions will generate a brief.
              </p>
              {editingThreshold && (
                <Button size="sm" onClick={handleSaveThreshold} disabled={updateConfig.isPending} className="w-full">
                  {updateConfig.isPending ? "Saving…" : "Save Threshold"}
                </Button>
              )}
            </div>

            {/* Quality Gate */}
            <div className="space-y-2">
              <span className="text-sm text-slate-300">Brief Quality Gate</span>
              <p className="text-xs text-slate-500 mb-2">All four must be YES before any brief is approved.</p>
              {[
                { q: "Is this insight actionable?", icon: <TrendingUp className="w-3 h-3" /> },
                { q: "Is it evidence-based?", icon: <Shield className="w-3 h-3" /> },
                { q: "Is it genuinely differentiated?", icon: <Eye className="w-3 h-3" /> },
                { q: "Would it matter to a board discussion?", icon: <AlertTriangle className="w-3 h-3" /> },
              ].map(({ q, icon }) => (
                <div key={q} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-green-400">{icon}</span>
                  {q}
                </div>
              ))}
            </div>

            {/* Dimension weights */}
            <div className="space-y-2">
              <span className="text-sm text-slate-300">Dimension Weights</span>
              {config && [
                { label: "Economic Impact", value: config.weightEconomicImpact },
                { label: "Irreversibility", value: config.weightIrreversibility },
                { label: "Time Criticality", value: config.weightTimeCriticality },
                { label: "Hidden Variable Strength", value: config.weightHiddenVariableStrength },
                { label: "Executive Relevance", value: config.weightExecutiveRelevance },
                { label: "Novelty", value: config.weightNovelty },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-mono text-slate-300">{value}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Decisions */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" />
            Highest-Significance Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hierarchyLoading ? (
            <div className="text-slate-500 text-sm py-4 text-center">Loading…</div>
          ) : !hierarchy?.topCompanies?.length ? (
            <div className="text-slate-500 text-sm py-8 text-center">
              No scored decisions yet. Run the daily loop or score individual companies from the Intelligence Factory.
            </div>
          ) : (
            <div className="space-y-3">
              {hierarchy.topCompanies.map((co) => (
                <div key={co.id} className="flex items-start gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{co.companyName}</span>
                      <LevelBadge level={co.decisionLevel} />
                      {co.qualityGatePassed ? (
                        <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">Gate ✓</span>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Gate ✗</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{co.sector} · {co.country}</div>
                    {co.sssRationale && (
                      <p className="text-xs text-slate-400 leading-relaxed">{co.sssRationale}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 min-w-[90px]">
                    <div className="text-center">
                      <div className="text-xl font-bold text-amber-400">{co.sss}</div>
                      <div className="text-xs text-slate-500">SSS</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-400">{co.esi}</div>
                      <div className="text-xs text-slate-500">ESI</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
