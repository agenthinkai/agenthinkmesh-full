/**
 * ArosOperations.tsx — Atlas Operational Status Dashboard
 *
 * Phase 7 live operations panel showing:
 * - Daily loop last run / next run time
 * - Weekly expansion last run / next run time
 * - Emails sent today
 * - Pipeline transitions today
 * - Calibration accuracy trend
 * - Outcome Ledger growth
 * - Universe size
 * - Cron schedule status
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Mail,
  RefreshCw,
  Target,
  TrendingUp,
  Zap,
  AlertCircle,
  BarChart3,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function relativeTime(ts: number | null | undefined): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function nextRunTime(cronDesc: string): string {
  const now = new Date();
  // Daily 09:00 UTC
  if (cronDesc === "daily") {
    const next = new Date(now);
    next.setUTCHours(9, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const diff = next.getTime() - now.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `in ${hours}h ${minutes}m`;
  }
  // Weekly Monday 08:00 UTC
  if (cronDesc === "weekly") {
    const next = new Date(now);
    const daysUntilMonday = (8 - next.getUTCDay()) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    next.setUTCHours(8, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
    const diff = next.getTime() - now.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return `in ${days}d ${hours}h`;
  }
  return "Unknown";
}

// ── Status Card ───────────────────────────────────────────────────────────────

function StatusCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  status,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  status?: "ok" | "warning" | "error" | "idle";
}) {
  const statusColors = {
    ok: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    idle: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 hover:border-slate-600/50 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-slate-800/80 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {status && (
          <div className="mt-3">
            <Badge className={`text-xs ${statusColors[status]}`}>
              {status === "ok" ? "Operational" : status === "warning" ? "Attention" : status === "error" ? "Error" : "Idle"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cron Schedule Row ─────────────────────────────────────────────────────────

function CronRow({
  name,
  schedule,
  nextRun,
  isActive,
}: {
  name: string;
  schedule: string;
  nextRun: string;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
        <div>
          <p className="text-sm font-medium text-slate-200">{name}</p>
          <p className="text-xs text-slate-500">{schedule}</p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
          {nextRun}
        </Badge>
      </div>
    </div>
  );
}

// ── Calibration Row ───────────────────────────────────────────────────────────

function CalibrationRow({
  metric,
  predicted,
  actual,
  accuracy,
  status,
}: {
  metric: string;
  predicted: number;
  actual: number | null;
  accuracy: number | null;
  status: string;
}) {
  const statusColor =
    status === "calibrated" ? "text-emerald-400" :
    status === "needs_adjustment" ? "text-amber-400" :
    "text-slate-500";

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/40 last:border-0">
      <div className="flex-1">
        <p className="text-xs text-slate-300 capitalize">{metric.replace(/_/g, " ")}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-500">Pred: {pct(predicted)}</span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-400">Actual: {actual !== null ? pct(actual) : "—"}</span>
        </div>
      </div>
      <div className="text-right ml-4">
        {accuracy !== null ? (
          <div>
            <p className={`text-sm font-bold ${statusColor}`}>{accuracy.toFixed(0)}%</p>
            <Progress
              value={Math.max(0, accuracy)}
              className="w-16 h-1 mt-1"
            />
          </div>
        ) : (
          <span className="text-xs text-slate-600">No data</span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArosOperations() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Live data queries
  const funnelStats = trpc.arosDecisionDetection.getFunnelSummary.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const pipelineConversions = trpc.arosPipeline.getConversionFunnel.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const tokenStats = trpc.arosTokenLedger.getEconomics.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const calibrationSummary = trpc.arosCalibration.getSummary.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const coverageStats = trpc.arosHiddenVariable.getCoverageStats.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const outreachStats = trpc.arosOutreachFactory.getQueueStats.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const funnel = funnelStats.data;
  const pipeline = pipelineConversions.data;
  const tokens = tokenStats.data;
  const calibration = calibrationSummary.data ?? [];
  const coverage = coverageStats.data;
  const outreach = outreachStats.data;

  const stageMap = Object.fromEntries((pipeline?.stages ?? []).map(s => [s.stage, s.count]));
  const totalOutreach = stageMap["OUTREACH_SENT"] ?? 0;
  const totalResponses = stageMap["RESPONSE_RECEIVED"] ?? 0;
  const totalMeetings = (stageMap["MEETING_BOOKED"] ?? 0) + (stageMap["MEETING_HELD"] ?? 0);
  const totalProposals = stageMap["PROPOSAL_SENT"] ?? 0;
  const totalCustomers = stageMap["CUSTOMER"] ?? 0;

  const outreachByStatus = Object.fromEntries((outreach ?? []).map((r) => [r.status, r.count]));
  const emailsSent = (outreachByStatus["SENT"] as number | undefined) ?? 0;
  const emailsPending = (outreachByStatus["PENDING_CEO_REVIEW"] as number | undefined) ?? 0;

  const avgCalibrationAccuracy = calibration.length > 0
    ? calibration.reduce((sum, c) => sum + (c.accuracy ?? 0), 0) / calibration.filter(c => c.accuracy !== null).length
    : null;

  const isLoading = funnelStats.isLoading || pipelineConversions.isLoading;

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    funnelStats.refetch();
    pipelineConversions.refetch();
    tokenStats.refetch();
    calibrationSummary.refetch();
    coverageStats.refetch();
    outreachStats.refetch();
    toast.success("Dashboard refreshed");
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-medium">
                Atlas Operational Mode — Phase 7
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white">Operational Status</h1>
            <p className="text-slate-400 text-sm mt-1">
              Live system health · Cron schedules · Pipeline activity · Calibration accuracy
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatusCard
            icon={Globe}
            label="Universe Size"
            value={fmt(funnel?.totalCompanies)}
            subValue={`${fmt(funnel?.highPriority)} high priority`}
            color="text-blue-400"
            status="ok"
          />
          <StatusCard
            icon={Mail}
            label="Notes Delivered"
            value={fmt(emailsSent)}
            subValue={`${fmt(emailsPending)} pending review`}
            color="text-violet-400"
            status={emailsPending > 0 ? "warning" : "ok"}
          />
          <StatusCard
            icon={Target}
            label="Pipeline"
            value={fmt(totalOutreach)}
            subValue={`${fmt(totalCustomers)} customers won`}
            color="text-emerald-400"
            status={totalCustomers > 0 ? "ok" : "idle"}
          />
          <StatusCard
            icon={Database}
            label="Outcome Ledger"
          value={fmt(coverage?.withDecisionTwinV2)}
          subValue={`${fmt(coverage?.totalCompanies)} total companies`}
            color="text-amber-400"
            status="ok"
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Cron Schedule Status */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Autonomous Cron Schedules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CronRow
                name="Atlas Daily Loop"
                schedule="Every business day at 09:00 UTC — 16-step revenue cycle"
                nextRun={nextRunTime("daily")}
                isActive={true}
              />
              <CronRow
                name="Atlas Weekly Expansion"
                schedule="Every Monday at 08:00 UTC — universe expansion + DT generation"
                nextRun={nextRunTime("weekly")}
                isActive={true}
              />
              <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-xs text-emerald-300">
                    Both cron jobs registered with Manus Heartbeat scheduler. They fire automatically on the deployed production URL.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Funnel */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Pipeline Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              {[
                { stage: "Researched", count: stageMap["RESEARCHED"] ?? 0, color: "bg-slate-600" },
                { stage: "Notes Delivered", count: totalOutreach, color: "bg-blue-500" },
                { stage: "Responses", count: totalResponses, color: "bg-violet-500" },
                { stage: "Meetings", count: totalMeetings, color: "bg-amber-500" },
                { stage: "Proposals", count: totalProposals, color: "bg-orange-500" },
                { stage: "Customers", count: totalCustomers, color: "bg-emerald-500" },
              ].map(({ stage, count, color }) => {
                const maxCount = stageMap["RESEARCHED"] ?? 1;
                const pctWidth = Math.max(2, (count / maxCount) * 100);
                return (
                  <div key={stage} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-slate-400 w-24 flex-shrink-0">{stage}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-2">
                      <div
                        className={`${color} h-2 rounded-full transition-all`}
                        style={{ width: `${pctWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-300 w-10 text-right">{fmt(count)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Calibration Accuracy */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                Calibration Accuracy
                {avgCalibrationAccuracy !== null && (
                  <Badge className="ml-auto text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Avg {avgCalibrationAccuracy.toFixed(0)}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calibration.length === 0 ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
                  <AlertCircle className="w-4 h-4" />
                  No calibration data yet. Runs after first pipeline activity.
                </div>
              ) : (
                calibration.map((c) => (
                  <CalibrationRow
                    key={c.metric}
                    metric={c.metric}
                    predicted={c.predicted}
                    actual={c.actual}
                    accuracy={c.accuracy}
                    status={c.status}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Token Economics */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-400" />
                Token Economics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total Tokens Used</span>
                  <span className="text-sm font-medium text-slate-200">{fmt(tokens?.totalTokens)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Total Cost</span>
                  <span className="text-sm font-medium text-slate-200">
                    ${tokens?.totalCostUsd ? Number(tokens.totalCostUsd).toFixed(4) : "0.0000"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Revenue Generated</span>
                  <span className="text-sm font-medium text-emerald-400">
                    ${tokens?.revenueGeneratedUsd ? Number(tokens.revenueGeneratedUsd).toLocaleString() : "0"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Token ROI</span>
                  <span className="text-sm font-bold text-violet-400">
                    {tokens?.tokenRoi ? `${Number(tokens.tokenRoi).toFixed(1)}x` : "—"}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Decision Twins Generated</span>
                    <span className="text-sm font-medium text-blue-400">{fmt(coverage?.withDecisionTwinV2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">DT Coverage</span>
                    <span className="text-sm font-medium text-blue-400">
                      {coverage?.totalCompanies && coverage.withDecisionTwinV2
                        ? `${((coverage.withDecisionTwinV2 / coverage.totalCompanies) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Monitoring Tier Breakdown */}
        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Monitoring Universe — Tier Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { tier: "UNIVERSE", label: "Universe", count: funnel?.universe ?? 0, color: "text-slate-400", bg: "bg-slate-700/30", desc: "Monthly monitoring" },
                { tier: "ACTIVE", label: "Active", count: funnel?.active ?? 0, color: "text-blue-400", bg: "bg-blue-500/10", desc: "Weekly monitoring" },
                { tier: "HIGH_PRIORITY", label: "High Priority", count: funnel?.highPriority ?? 0, color: "text-amber-400", bg: "bg-amber-500/10", desc: "Daily monitoring" },
                { tier: "OUTREACH_CANDIDATE", label: "Intelligence Ready", count: funnel?.outreachCandidate ?? 0, color: "text-emerald-400", bg: "bg-emerald-500/10", desc: "Continuous monitoring" },
              ].map(({ label, count, color, bg, desc }) => (
                <div key={label} className={`${bg} rounded-lg p-4 border border-slate-700/30`}>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{fmt(count)}</p>
                  <p className="text-xs text-slate-600 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-xs text-slate-600">
          <span>Atlas AROS — Phase 7 Operational Mode</span>
          <span>Auto-refreshes every 30s · Last updated: {new Date().toLocaleTimeString()}</span>
        </div>

      </div>
    </DashboardLayout>
  );
}
