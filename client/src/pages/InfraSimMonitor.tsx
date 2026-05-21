import { toast } from "sonner";
/**
 * InfraSimMonitor.tsx
 * Governed Infrastructure Stress Simulation v2 — Continuous Monitoring Dashboard
 *
 * Post-IC thesis integrity tracking, risk signal ingestion,
 * weekly governance memo generation, and alert management.
 */

import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

type MonitorData = {
  id: number;
  caseId: number;
  thesisStatus: string;
  approvalProbabilityPct: string | null;
  decisionDriftScore: string | null;
  thesisDegradationPct: string | null;
  wouldApproveToday: number | null;
  irrDriftPct: number;
  activeSignals: number;
  breachedCovenants: number;
  signals: any[];
  memos: any[];
  alerts: any[];
  drifts: any[];
  weeklyMemo: any;
  updatedAt: number;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ON_TRACK")
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">On Track</Badge>;
  if (status === "WATCH")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Watch</Badge>;
  if (status === "AT_RISK")
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">At Risk</Badge>;
  if (status === "BREACHED")
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Breached</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs">{status}</Badge>;
}

export default function InfraSimMonitor() {
  const { id } = useParams<{ id: string }>();
  const caseId = parseInt(id!, 10);
  const [, navigate] = useLocation();
  const [newSignal, setNewSignal] = useState("");
  const [generatingMemo, setGeneratingMemo] = useState(false);

  const { data: _monitorRaw, isLoading, refetch } = trpc.infraSim.getMonitoringObject.useQuery({ caseId });
  const monitorData = _monitorRaw as MonitorData | null | undefined;

  const ingestSignal = trpc.infraSim.ingestRiskSignal.useMutation({
    onSuccess: () => {
      toast.success("Signal ingested: Risk signal processed and thesis re-evaluated");
      setNewSignal("");
      refetch();
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const generateMemo = trpc.infraSim.recomputeMonitoring.useMutation({
    onSuccess: () => {
      toast.success("Governance memo generated: Weekly IC update memo ready");
      setGeneratingMemo(false);
      refetch();
    },
    onError: (e) => {
      toast.error(`Failed: ${e.message}`);
      setGeneratingMemo(false);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">Loading monitoring data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1629] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1a2e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/infra-sim/case/${caseId}`)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h1 className="text-sm font-semibold text-white">
                  {`Case #${monitorData?.caseId ?? ""} — Continuous Monitoring`}
                </h1>
                {monitorData?.thesisStatus && <StatusBadge status={monitorData.thesisStatus} />}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Post-IC thesis integrity tracking
                {monitorData?.updatedAt && (
                  <> · Last updated {new Date(monitorData.updatedAt).toLocaleString()}</>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
            disabled={generateMemo.isPending || generatingMemo}
            onClick={() => {
              setGeneratingMemo(true);
              // recomputeMonitoring needs monitoringObjectId — use monitoring data if available
              const monId = (monitorData as any)?.id;
              if (monId) {
                generateMemo.mutate({ monitoringObjectId: monId, currentDimensionValues: {} });
              } else {
                toast.error("No monitoring object: Create a monitoring object first by ingesting a signal.");
                setGeneratingMemo(false);
              }
            }}
          >
            {generatingMemo ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Generating memo…
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Generate Weekly Memo
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Thesis Integrity KPIs */}
        {monitorData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-mono mb-1">Thesis Status</div>
                <StatusBadge status={monitorData.thesisStatus} />
              </CardContent>
            </Card>
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-mono mb-1">IRR Drift</div>
                <div className={`text-xl font-bold ${(monitorData.irrDriftPct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(monitorData.irrDriftPct ?? 0) >= 0 ? "+" : ""}{(monitorData.irrDriftPct ?? 0).toFixed(1)}pp
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-mono mb-1">Active Signals</div>
                <div className="text-xl font-bold text-white">{monitorData.activeSignals ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-mono mb-1">Breached Covenants</div>
                <div className={`text-xl font-bold ${(monitorData.breachedCovenants ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {monitorData.breachedCovenants ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ingest Risk Signal */}
        <Card className="bg-[#0d1a2e] border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Ingest Risk Signal
            </CardTitle>
            <p className="text-xs text-slate-500">
              Describe a new risk event, regulatory change, market development, or operational update.
              The system will re-evaluate thesis integrity and update monitoring status.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={newSignal}
              onChange={(e) => setNewSignal(e.target.value)}
              placeholder="e.g. 'AR7 CfD auction results published — strike price £79/MWh, below base case assumption of £73/MWh but below fund minimum threshold. Competitor Hornsea 4 awarded at £82/MWh.'"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 text-xs min-h-[80px] resize-none"
            />
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5"
              disabled={ingestSignal.isPending || !newSignal.trim()}
              onClick={() => ingestSignal.mutate({ caseId: caseId, signal: newSignal })}
            >
              {ingestSignal.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Processing signal…
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Ingest Signal
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Risk Signal Log */}
        {monitorData?.signals && monitorData.signals.length > 0 && (
          <Card className="bg-[#0d1a2e] border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Risk Signal Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {monitorData.signals.map((signal: any) => (
                <div key={signal.id} className="p-4 rounded-xl border border-white/5 bg-white/3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={signal.severity} />
                      <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(signal.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {signal.irrImpactPp !== undefined && (
                      <span className={`text-xs font-mono ${signal.irrImpactPp >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {signal.irrImpactPp >= 0 ? "+" : ""}{signal.irrImpactPp.toFixed(1)}pp IRR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mb-2">{signal.description}</p>
                  {signal.thesisImpact && (
                    <p className="text-xs text-slate-500 italic">{signal.thesisImpact}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Governance Memos */}
        {monitorData?.memos && monitorData.memos.length > 0 && (
          <Card className="bg-[#0d1a2e] border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Governance Memos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {monitorData.memos.map((memo: any) => (
                <div key={memo.id} className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">{memo.title}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(memo.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none">
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{memo.content}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {(!monitorData || (!monitorData.signals?.length && !monitorData.memos?.length)) && (
          <Card className="bg-[#0d1a2e] border-dashed border-white/10">
            <CardContent className="p-10 text-center">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 mb-1">No monitoring data yet</p>
              <p className="text-xs text-slate-600">
                Ingest a risk signal above to begin continuous thesis monitoring
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
