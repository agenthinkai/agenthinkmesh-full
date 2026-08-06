/**
 * LPTwinSession.tsx — Session Results Shell
 * CapTwin Enterprise Module — WP3/WP4
 *
 * Displays:
 * - Fund summary
 * - Session assumptions
 * - Selected allocator segments
 * - Analysis status
 * - Existing stored results (from DB, not re-run)
 * - Disclaimer
 * - Export action
 * - Delete action
 * - Clear empty / loading / error states
 *
 * Historical sessions can be reopened without re-running.
 * Results are always read from the database.
 */

import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Download, BarChart3, FileText,
  Shield, MessageSquare, Trash2, Loader2, Info,
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "Approved")
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">{verdict}</Badge>;
  if (verdict === "Conditional Watchlist")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">{verdict}</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">{verdict}</Badge>;
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "Approved") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  if (verdict === "Conditional Watchlist") return <Clock className="h-4 w-4 text-amber-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
}

function FitScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold w-8 text-right">{score}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
  };
  return (
    <Badge className={`capitalize text-xs ${map[status] ?? "bg-muted text-muted-foreground"} hover:opacity-100`}>
      {status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
      {status}
    </Badge>
  );
}

// ── Segment Result Card ───────────────────────────────────────────────────────

type SegmentResult = {
  id: number;
  segmentId: string;
  fitScore: string;
  icVerdict: "Approved" | "Conditional Watchlist" | "Rejected";
  probabilityBand: string | null;
  objectionsJson: string | null;
  evidenceGapsJson: string | null;
  complianceFlagsJson: string | null;
  fitReasonsJson: string | null;
  tailoredPositioning: string | null;
  modelVersion: string;
  createdAt: number;
};

function SegmentCard({ result }: { result: SegmentResult }) {
  const [expanded, setExpanded] = useState(false);
  const score = Number(result.fitScore);

  const objections = result.objectionsJson
    ? (JSON.parse(result.objectionsJson) as Array<{ agent: string; objection: string; severity: string }>)
    : [];
  const evidenceGaps = result.evidenceGapsJson
    ? (JSON.parse(result.evidenceGapsJson) as Array<{ gap: string; priority: string }>)
    : [];
  const complianceFlags = result.complianceFlagsJson
    ? (JSON.parse(result.complianceFlagsJson) as Array<{ flag: string; status: string }>)
    : [];
  const fitReasons = result.fitReasonsJson
    ? (JSON.parse(result.fitReasonsJson) as Array<{ dimension: string; score: number }>)
    : [];

  return (
    <Card className={`transition-colors ${
      result.icVerdict === "Approved"
        ? "border-green-500/20"
        : result.icVerdict === "Conditional Watchlist"
        ? "border-amber-500/20"
        : "border-red-500/20"
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VerdictIcon verdict={result.icVerdict} />
            <CardTitle className="text-sm">{result.segmentId}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={result.icVerdict} />
            {result.probabilityBand && (
              <span className="text-xs text-muted-foreground font-mono">{result.probabilityBand}</span>
            )}
          </div>
        </div>
        <FitScoreBar score={score} />
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {fitReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fit Breakdown</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {fitReasons.map((r) => (
                  <div key={r.dimension}>
                    <p className="text-xs text-muted-foreground">{r.dimension}</p>
                    <p className="text-lg font-bold font-mono">{r.score}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {objections.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> IC Objections
              </p>
              <div className="space-y-2">
                {objections.map((obj, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">{obj.agent}</span>
                      <Badge variant={obj.severity === "High" ? "destructive" : "secondary"} className="text-xs">{obj.severity}</Badge>
                    </div>
                    <p className="text-sm">{obj.objection}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {evidenceGaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Evidence Gaps
              </p>
              <ul className="space-y-1">
                {evidenceGaps.map((gap, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${gap.priority === "high" ? "bg-red-400" : "bg-amber-400"}`} />
                    {gap.gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {complianceFlags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Compliance Flags
              </p>
              <div className="flex flex-wrap gap-2">
                {complianceFlags.map((cf, i) => (
                  <Badge key={i} variant={cf.status === "pass" ? "outline" : "destructive"} className="text-xs">
                    {cf.flag}: {cf.status.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.tailoredPositioning && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Tailored Positioning
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {result.tailoredPositioning}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground/50 font-mono">Model v{result.modelVersion}</p>
        </CardContent>
      )}

      <div className="px-6 pb-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {expanded ? <><ChevronUp className="h-3 w-3" /> Hide details</> : <><ChevronDown className="h-3 w-3" /> Show details</>}
        </button>
      </div>
    </Card>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  id: number;
  orgId: number;
  fundId: number;
  sessionName: string;
  selectedSegmentsJson: string;
  scenarioType: string;
  assumptionsJson: string | null;
  engineVersion: string;
  registryVersion: string;
  status: string;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwinSession() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/captwin/lp-twin/:id");
  const sessionId = params?.id ? Number(params.id) : 0;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.lpTwin.getSession.useQuery(
    { sessionId },
    { enabled: sessionId > 0 }
  );

  const exportMutation = trpc.lpTwin.exportSession.useMutation();
  const deleteMutation = trpc.lpTwin.deleteSession.useMutation({
    onSuccess: () => {
      toast.success("Session deleted");
      navigate("/captwin/lp-twin");
    },
    onError: (err) => toast.error("Delete failed", { description: err.message }),
  });

  const session = data?.session as SessionData | undefined;
  const results = (data?.results ?? []) as SegmentResult[];

  const approvedCount = results.filter((r) => r.icVerdict === "Approved").length;
  const watchlistCount = results.filter((r) => r.icVerdict === "Conditional Watchlist").length;
  const rejectedCount = results.filter((r) => r.icVerdict === "Rejected").length;
  const avgFit = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + Number(r.fitScore), 0) / results.length)
    : 0;

  const selectedSegments: string[] = (() => {
    try {
      return session?.selectedSegmentsJson ? JSON.parse(session.selectedSegmentsJson) : [];
    } catch { return []; }
  })();

  const assumptions: Record<string, unknown> = (() => {
    try {
      return session?.assumptionsJson ? JSON.parse(session.assumptionsJson) : {};
    } catch { return {}; }
  })();

  async function handleExport() {
    if (!session) return;
    try {
      const result = await exportMutation.mutateAsync({
        sessionId,
        exportType: "json",
        reportType: "full_session",
      });
      const blob = new Blob([JSON.stringify(result.exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lp-twin-${session.sessionName.replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { description: "Audit record written." });
    } catch (err: unknown) {
      toast.error("Export failed", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !session) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto text-center py-20 text-muted-foreground">
        <XCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
        <p className="font-medium">Session not found or access denied</p>
        <p className="text-sm mt-1">{error?.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/captwin/lp-twin")}>
          Back to LP Twin
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-background/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/captwin/lp-twin")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold leading-tight">{session.sessionName}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {session.scenarioType} · Engine {session.engineVersion}
                {session.registryVersion && ` · Registry ${session.registryVersion}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={session.status} />
            {session.status === "completed" ? (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>SYNTHETIC SIMULATION</strong> — These outputs are evidence-based synthetic simulations derived from
            anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.
          </span>
        </div>

        {/* Session metadata */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="p-3 rounded-lg border border-border min-w-[140px]">
            <p className="text-muted-foreground mb-0.5">Created</p>
            <p className="font-medium">{String(new Date(session.createdAt).toLocaleString())}</p>
          </div>
          <div className="p-3 rounded-lg border border-border min-w-[140px]">
            <p className="text-muted-foreground mb-0.5">Completed</p>
            <p className="font-medium">{session.completedAt ? String(new Date(session.completedAt).toLocaleString()) : "—"}</p>
          </div>
          <div className="p-3 rounded-lg border border-border min-w-[120px]">
            <p className="text-muted-foreground mb-0.5">Segments Tested</p>
            <p className="font-medium">{selectedSegments.length}</p>
          </div>
          <div className="p-3 rounded-lg border border-border min-w-[120px]">
            <p className="text-muted-foreground mb-0.5">Scenario</p>
            <p className="font-medium capitalize">{session.scenarioType}</p>
          </div>
        </div>

        {/* Selected segments list */}
        {selectedSegments.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Segments Tested</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedSegments.map((id) => (
                <Badge key={id} variant="outline" className="text-xs font-mono">{id}</Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Custom assumptions */}
        {assumptions.customNote ? (
          <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs">
            <p className="font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> Custom Assumptions
            </p>
            <p className="text-muted-foreground">{String(assumptions.customNote)}</p>
          </div>
        ) : null}

        {/* ── Pending / Running / Failed states ── */}
        {session.status === "pending" ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Analysis pending</p>
            <p className="text-sm mt-1">The analysis has not started yet.</p>
          </div>
        ) : null}

        {session.status === "running" ? (
          <div className="text-center py-12 text-muted-foreground border border-border rounded-lg bg-muted/10">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="font-medium">Analysis running…</p>
            <p className="text-sm mt-1">Results will appear here when complete.</p>
          </div>
        ) : null}

        {session.status === "failed" ? (
          <div className="text-center py-12 text-destructive border border-destructive/30 rounded-lg bg-destructive/5">
            <XCircle className="h-8 w-8 mx-auto mb-3" />
            <p className="font-medium">Analysis failed</p>
            <p className="text-sm mt-1 text-muted-foreground">Create a new session to retry.</p>
          </div>
        ) : null}

        {/* ── Results ── */}
        {(session.status === "completed" && results.length === 0) ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No results stored</p>
            <p className="text-sm mt-1">The session completed but no segment results were recorded.</p>
          </div>
        ) : null}

        {(session.status === "completed" && results.length > 0) ? (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold font-mono">{avgFit}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Avg Fit Score
                  </p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold font-mono text-green-400">{approvedCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Approved</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/20">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold font-mono text-amber-400">{watchlistCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Watchlist</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/20">
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold font-mono text-red-400">{rejectedCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Rejected</p>
                </CardContent>
              </Card>
            </div>

            {/* Segment results tabs */}
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({results.length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
                <TabsTrigger value="watchlist">Watchlist ({watchlistCount})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
              </TabsList>
              {(["all", "approved", "watchlist", "rejected"] as const).map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <div className="space-y-4">
                    {results
                      .filter((r) => {
                        if (tab === "all") return true;
                        if (tab === "approved") return r.icVerdict === "Approved";
                        if (tab === "watchlist") return r.icVerdict === "Conditional Watchlist";
                        return r.icVerdict === "Rejected";
                      })
                      .map((r) => <SegmentCard key={r.id} result={r} />)}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : null}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{session.sessionName}</strong>? All stored results will be removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate({ sessionId })}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
