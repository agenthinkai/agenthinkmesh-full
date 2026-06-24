/**
 * ArosCommandCenterV2.tsx — Revenue Command Center V2
 *
 * The primary observation interface for the ATLAS decision network.
 * Shows 8 live dashboards:
 *   1. Executive Conversations
 *   2. Meetings Booked
 *   3. Proposals Generated
 *   4. Customers Won
 *   5. Hidden Variable Accuracy
 *   6. Decision Twin Accuracy
 *   7. Outcome Ledger Growth
 *   8. Revenue Forecast Accuracy
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  TrendingUp,
  Users,
  MessageSquare,
  FileText,
  Trophy,
  Target,
  Activity,
  Database,
  DollarSign,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

function usd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${(Number(n) / 1000).toFixed(0)}K`;
}

function AccuracyBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <Badge variant="outline" className="text-xs">No data yet</Badge>;
  const pctVal = Number(value) * 100;
  if (pctVal >= 70) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">{pctVal.toFixed(0)}% accurate</Badge>;
  if (pctVal >= 40) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{pctVal.toFixed(0)}% accurate</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{pctVal.toFixed(0)}% accurate</Badge>;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
  trend?: string;
  color: string;
}) {
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
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-emerald-400">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Accuracy Gauge ────────────────────────────────────────────────────────────

function AccuracyGauge({
  label,
  predicted,
  actual,
  sampleSize,
}: {
  label: string;
  predicted: number | null | undefined;
  actual: number | null | undefined;
  sampleSize?: number;
}) {
  const hasSample = sampleSize && sampleSize > 0;
  const accuracy = predicted !== null && predicted !== undefined && actual !== null && actual !== undefined && Number(predicted) > 0
    ? Math.min(1, Number(actual) / Number(predicted))
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <div className="flex items-center gap-2">
          {sampleSize !== undefined && (
            <span className="text-xs text-slate-500">n={sampleSize}</span>
          )}
          <AccuracyBadge value={accuracy} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/50 rounded px-2 py-1">
          <span className="text-slate-500">Predicted: </span>
          <span className="text-slate-300">{pct(predicted)}</span>
        </div>
        <div className="bg-slate-800/50 rounded px-2 py-1">
          <span className="text-slate-500">Actual: </span>
          <span className={hasSample ? "text-emerald-400" : "text-slate-500"}>
            {hasSample ? pct(actual) : "awaiting data"}
          </span>
        </div>
      </div>
      {accuracy !== null && (
        <Progress value={accuracy * 100} className="h-1.5" />
      )}
    </div>
  );
}

// ── Outcome Ledger Growth ─────────────────────────────────────────────────────

function OutcomeLedgerGrowthPanel({ snapshots }: { snapshots: any[] }) {
  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Database className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No snapshots yet. Take the first snapshot to start tracking growth.</p>
      </div>
    );
  }

  const latest = snapshots[0];
  const prev = snapshots[1];
  const growth = prev ? Number(latest.totalOutcomeLedgerEntries) - Number(prev.totalOutcomeLedgerEntries) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Entries</p>
          <p className="text-xl font-bold text-violet-400">{fmt(latest.totalOutcomeLedgerEntries)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Companies</p>
          <p className="text-xl font-bold text-blue-400">{fmt(latest.totalCompanies)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Calibration Records</p>
          <p className="text-xl font-bold text-emerald-400">{fmt(latest.totalCalibrationRecords)}</p>
        </div>
      </div>
      {growth > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <TrendingUp className="w-4 h-4" />
          <span>+{growth} entries since last snapshot</span>
        </div>
      )}
      <div className="space-y-2">
        {snapshots.slice(0, 7).map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-800">
            <span className="text-slate-400">{s.snapshotDate}</span>
            <span className="text-slate-300">{fmt(s.totalOutcomeLedgerEntries)} entries</span>
            <span className="text-slate-500">{fmt(s.totalCompanies)} companies</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ArosCommandCenterV2() {
  const [activeTab, setActiveTab] = useState("overview");

  // Data queries
  const funnelStats = trpc.arosDecisionDetection.getFunnelSummary.useQuery(undefined, { refetchInterval: 30000 });
  const pipelineConversions = trpc.arosPipeline.getConversionFunnel.useQuery(undefined, { refetchInterval: 30000 });
  const tokenStats = trpc.arosTokenLedger.getEconomics.useQuery(undefined, { refetchInterval: 30000 });
  const hvAccuracy = trpc.arosHiddenVariable.getAccuracyStats.useQuery(undefined, { refetchInterval: 60000 });
  const coverageStats = trpc.arosHiddenVariable.getCoverageStats.useQuery(undefined, { refetchInterval: 60000 });
  const snapshotHistory = trpc.arosHiddenVariable.getSnapshotHistory.useQuery({ limit: 30 }, { refetchInterval: 60000 });

  // Mutations
  const takeSnapshot = trpc.arosHiddenVariable.takeAccuracySnapshot.useMutation({
    onSuccess: (data) => {
      toast.success(`Snapshot taken for ${data.snapshotDate}`);
      snapshotHistory.refetch();
    },
    onError: () => toast.error("Failed to take snapshot"),
  });

  const batchGenerate = trpc.arosHiddenVariable.batchGenerateMissing.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.processed} Decision Twins`);
      coverageStats.refetch();
    },
    onError: () => toast.error("Failed to generate Decision Twins"),
  });

  // Derived values
  const pipeline = pipelineConversions.data;
  const funnel = funnelStats.data;
  const tokens = tokenStats.data;
  const hv = hvAccuracy.data;
  const coverage = coverageStats.data;
  const snapshots = snapshotHistory.data ?? [];

  const stageMap = Object.fromEntries((pipeline?.stages ?? []).map(s => [s.stage, s.count]));
  const totalOutreach = stageMap["OUTREACH_SENT"] ?? 0;
  const totalResponses = stageMap["RESPONSE_RECEIVED"] ?? 0;
  const totalMeetings = (stageMap["MEETING_BOOKED"] ?? 0) + (stageMap["MEETING_HELD"] ?? 0);
  const totalProposals = stageMap["PROPOSAL_SENT"] ?? 0;
  const totalCustomers = stageMap["CUSTOMER"] ?? 0;

  const latestSnapshot = snapshots[0];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-medium">
                Decision Observation Network — Active
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white">Revenue Command Center</h1>
            <p className="text-slate-400 text-sm mt-1">
              Engine A: Revenue Generation · Engine B: Asset Accumulation · Both running simultaneously
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => takeSnapshot.mutate()}
              disabled={takeSnapshot.isPending}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <Activity className="w-4 h-4 mr-2" />
              {takeSnapshot.isPending ? "Snapshotting..." : "Take Snapshot"}
            </Button>
            <Button
              size="sm"
              onClick={() => batchGenerate.mutate({ limit: 10 })}
              disabled={batchGenerate.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Brain className="w-4 h-4 mr-2" />
              {batchGenerate.isPending ? "Generating..." : "Generate 10 DT V2"}
            </Button>
          </div>
        </div>

        {/* Engine Status Banner */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-r from-blue-950/60 to-blue-900/30 border border-blue-800/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Engine A — Revenue Generation</span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse ml-auto" />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Outreach", value: totalOutreach },
                { label: "Responses", value: totalResponses },
                { label: "Meetings", value: totalMeetings },
                { label: "Customers", value: totalCustomers },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-xs text-blue-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-r from-violet-950/60 to-violet-900/30 border border-violet-800/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-violet-300">Engine B — Asset Accumulation</span>
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse ml-auto" />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Companies", value: coverage?.totalCompanies ?? 0 },
                { label: "DT V2", value: coverage?.withDecisionTwinV2 ?? 0 },
                { label: "Hidden Vars", value: coverage?.withHiddenVariable ?? 0 },
                { label: "OL V2", value: coverage?.withOutcomeLedgerV2 ?? 0 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-xs text-violet-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 8 KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiCard
            icon={MessageSquare}
            label="Executive Conversations"
            value={String(totalResponses)}
            subValue={`${totalOutreach} outreach sent`}
            color="text-blue-400"
          />
          <KpiCard
            icon={Users}
            label="Meetings Booked"
            value={String(totalMeetings)}
            subValue={totalResponses > 0 ? `${((totalMeetings / totalResponses) * 100).toFixed(0)}% of responses` : "—"}
            color="text-cyan-400"
          />
          <KpiCard
            icon={FileText}
            label="Proposals Generated"
            value={String(totalProposals)}
            subValue={totalMeetings > 0 ? `${((totalProposals / totalMeetings) * 100).toFixed(0)}% of meetings` : "—"}
            color="text-amber-400"
          />
          <KpiCard
            icon={Trophy}
            label="Customers Won"
            value={String(totalCustomers)}
            subValue={totalProposals > 0 ? `${((totalCustomers / totalProposals) * 100).toFixed(0)}% close rate` : "—"}
            color="text-emerald-400"
          />
          <KpiCard
            icon={Target}
            label="Hidden Variable Accuracy"
            value={hv?.overallAccuracy !== null && hv?.overallAccuracy !== undefined ? pct(hv.overallAccuracy) : "—"}
            subValue={`${hv?.correct ?? 0} correct / ${hv?.total ?? 0} validated`}
            color="text-violet-400"
          />
          <KpiCard
            icon={Brain}
            label="Decision Twin Accuracy"
            value={latestSnapshot?.dtAccuracyAvg !== null && latestSnapshot?.dtAccuracyAvg !== undefined ? pct(Number(latestSnapshot.dtAccuracyAvg)) : "—"}
            subValue={`${latestSnapshot?.dtSampleSize ?? 0} validated twins`}
            color="text-pink-400"
          />
          <KpiCard
            icon={Database}
            label="Outcome Ledger Growth"
            value={fmt(coverage?.withOutcomeLedgerV2 ?? 0)}
            subValue={`${coverage?.totalCompanies ?? 0} companies observed`}
            color="text-indigo-400"
          />
          <KpiCard
            icon={DollarSign}
            label="Revenue Forecast Accuracy"
            value={latestSnapshot?.revenueForecastAccuracy !== null && latestSnapshot?.revenueForecastAccuracy !== undefined ? pct(Number(latestSnapshot.revenueForecastAccuracy)) : "—"}
            subValue=                      {latestSnapshot ? `Forecasted: ${usd(Number(latestSnapshot.revenueForecastedTotal))} · Actual: ${usd(Number(latestSnapshot.revenueActualTotal))}` : "No snapshot yet"}
            color="text-green-400"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/60 border border-slate-700/50 mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">Overview</TabsTrigger>
            <TabsTrigger value="calibration" className="data-[state=active]:bg-slate-700">Calibration</TabsTrigger>
            <TabsTrigger value="hidden-variables" className="data-[state=active]:bg-slate-700">Hidden Variables</TabsTrigger>
            <TabsTrigger value="outcome-ledger" className="data-[state=active]:bg-slate-700">Outcome Ledger</TabsTrigger>
            <TabsTrigger value="token-economics" className="data-[state=active]:bg-slate-700">Token Economics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-6">
              {/* Pipeline Funnel */}
              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Revenue Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Researched", value: funnel?.totalCompanies ?? 0, color: "bg-slate-600", pctOf: null },
                    { label: "Outreach Sent", value: totalOutreach, color: "bg-blue-600", pctOf: funnel?.totalCompanies },
                    { label: "Responses", value: totalResponses, color: "bg-cyan-600", pctOf: totalOutreach },
                    { label: "Meetings", value: totalMeetings, color: "bg-amber-600", pctOf: totalResponses },
                    { label: "Proposals", value: totalProposals, color: "bg-orange-600", pctOf: totalMeetings },
                    { label: "Customers", value: totalCustomers, color: "bg-emerald-600", pctOf: totalProposals },
                  ].map(({ label, value, color, pctOf }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-slate-300">
                          {value}
                          {pctOf !== null && pctOf !== undefined && pctOf > 0 && (
                            <span className="text-slate-500 ml-1">({((value / pctOf) * 100).toFixed(0)}%)</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${funnel?.totalCompanies ? Math.min(100, (value / funnel.totalCompanies) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Asset Coverage */}
              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-violet-400" />
                    Intelligence Asset Coverage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coverage && [
                    { label: "Companies in Universe", value: coverage.totalCompanies, total: coverage.totalCompanies, color: "bg-slate-600" },
                    { label: "Decision Twins V2", value: coverage.withDecisionTwinV2, total: coverage.totalCompanies, color: "bg-violet-600" },
                    { label: "Hidden Variables", value: coverage.withHiddenVariable, total: coverage.totalCompanies, color: "bg-pink-600" },
                    { label: "Outcome Ledger V2", value: coverage.withOutcomeLedgerV2, total: coverage.totalCompanies, color: "bg-indigo-600" },
                  ].map(({ label, value, total, color }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-slate-300">{value} / {total}</span>
                      </div>
                      <Progress value={total > 0 ? (value / total) * 100 : 0} className="h-2" />
                    </div>
                  ))}
                  {coverage && coverage.missingDtV2 > 0 && (
                    <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/30 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-amber-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{coverage.missingDtV2} companies still need Decision Twin V2. Click "Generate 10 DT V2" to backfill.</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Calibration Tab */}
          <TabsContent value="calibration">
            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Conversion Rate Calibration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <AccuracyGauge
                    label="Outreach → Response Rate"
                    predicted={0.10}
                    actual={totalOutreach > 0 ? totalResponses / totalOutreach : null}
                    sampleSize={totalOutreach}
                  />
                  <AccuracyGauge
                    label="Response → Meeting Rate"
                    predicted={0.50}
                    actual={totalResponses > 0 ? totalMeetings / totalResponses : null}
                    sampleSize={totalResponses}
                  />
                  <AccuracyGauge
                    label="Meeting → Proposal Rate"
                    predicted={0.40}
                    actual={totalMeetings > 0 ? totalProposals / totalMeetings : null}
                    sampleSize={totalMeetings}
                  />
                  <AccuracyGauge
                    label="Proposal → Customer Rate"
                    predicted={0.25}
                    actual={totalProposals > 0 ? totalCustomers / totalProposals : null}
                    sampleSize={totalProposals}
                  />
                  <div className="pt-2 border-t border-slate-800 text-xs text-slate-500">
                    Calibration updates automatically on every pipeline stage transition.
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    Snapshot History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <OutcomeLedgerGrowthPanel snapshots={snapshots} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Hidden Variables Tab */}
          <TabsContent value="hidden-variables">
            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-400" />
                    Hidden Variable Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hv ? (
                    <>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-xl font-bold text-emerald-400">{hv.correct}</p>
                          <p className="text-xs text-slate-500">Correct</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-xl font-bold text-red-400">{hv.incorrect}</p>
                          <p className="text-xs text-slate-500">Incorrect</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-xl font-bold text-slate-400">{hv.pending}</p>
                          <p className="text-xs text-slate-500">Pending</p>
                        </div>
                      </div>
                      {hv.overallAccuracy !== null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Overall Accuracy</span>
                            <span className="text-violet-400 font-semibold">{pct(hv.overallAccuracy)}</span>
                          </div>
                          <Progress value={Number(hv.overallAccuracy) * 100} className="h-2" />
                        </div>
                      )}
                      <div className="space-y-2 mt-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">By Type</p>
                        {hv.byType.map((t) => (
                          <div key={t.type} className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">{t.type.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">n={t.count}</span>
                              <AccuracyBadge value={t.accuracy} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                      <Target className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">No hidden variable validations yet.</p>
                      <p className="text-xs mt-1">Generate Decision Twins V2 and validate predictions as outcomes arrive.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/60 border-slate-700/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-pink-400" />
                    Decision Twin V2 Coverage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coverage ? (
                    <>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Coverage</span>
                          <span className="text-pink-400 font-semibold">{coverage.coveragePct}%</span>
                        </div>
                        <Progress value={coverage.coveragePct} className="h-3" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-xl font-bold text-pink-400">{coverage.withDecisionTwinV2}</p>
                          <p className="text-xs text-slate-500">With DT V2</p>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-xl font-bold text-slate-400">{coverage.missingDtV2}</p>
                          <p className="text-xs text-slate-500">Missing</p>
                        </div>
                      </div>
                      {coverage.missingDtV2 > 0 && (
                        <Button
                          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                          onClick={() => batchGenerate.mutate({ limit: 10 })}
                          disabled={batchGenerate.isPending}
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          {batchGenerate.isPending ? "Generating..." : `Generate Next 10 (${coverage.missingDtV2} remaining)`}
                        </Button>
                      )}
                      {coverage.missingDtV2 === 0 && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400 justify-center py-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>All companies have Decision Twin V2</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      <span>Loading coverage data...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Outcome Ledger Tab */}
          <TabsContent value="outcome-ledger">
            <Card className="bg-slate-900/60 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  Outcome Ledger Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OutcomeLedgerGrowthPanel snapshots={snapshots} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token Economics Tab */}
          <TabsContent value="token-economics">
            <Card className="bg-slate-900/60 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Token Economics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tokens ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-400">{fmt(tokens.totalTokens)}</p>
                      <p className="text-xs text-slate-500 mt-1">Total Tokens</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-400">${Number(tokens.totalCostUsd ?? 0).toFixed(4)}</p>
                      <p className="text-xs text-slate-500 mt-1">Total Cost</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-400">{fmt(tokens.byWorkflow?.reduce((s, w) => s + w.count, 0) ?? 0)}</p>
                      <p className="text-xs text-slate-500 mt-1">Total Runs</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span>Loading token data...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
