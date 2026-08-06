/**
 * LPTwinSession.tsx — Session Results Dashboard
 * CapTwin Enterprise Module — WP3/WP4
 *
 * Displays the full results of a simulation session:
 * - Segment fit matrix
 * - IC verdict per segment
 * - Objections and evidence gaps
 * - Compliance flags
 * - Tailored positioning
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
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Download, BarChart3, FileText, Shield, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "Approved") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">{verdict}</Badge>;
  if (verdict === "Conditional Watchlist") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">{verdict}</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">{verdict}</Badge>;
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "Approved") return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  if (verdict === "Conditional Watchlist") return <Clock className="h-5 w-5 text-amber-400" />;
  return <XCircle className="h-5 w-5 text-red-400" />;
}

function FitScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-mono font-semibold w-10 text-right">{score}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "High") return <Badge variant="destructive" className="text-xs">{severity}</Badge>;
  if (severity === "Medium") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs hover:bg-amber-500/20">{severity}</Badge>;
  return <Badge variant="secondary" className="text-xs">{severity}</Badge>;
}

// ── Segment Result Card ───────────────────────────────────────────────────────

function SegmentCard({ result }: { result: {
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
} }) {
  const [expanded, setExpanded] = useState(false);
  const score = Number(result.fitScore);
  const objections = result.objectionsJson ? JSON.parse(result.objectionsJson) as Array<{ agent: string; objection: string; severity: string }> : [];
  const evidenceGaps = result.evidenceGapsJson ? JSON.parse(result.evidenceGapsJson) as Array<{ gap: string; priority: string }> : [];
  const complianceFlags = result.complianceFlagsJson ? JSON.parse(result.complianceFlagsJson) as Array<{ flag: string; status: string }> : [];
  const fitReasons = result.fitReasonsJson ? JSON.parse(result.fitReasonsJson) as Array<{ dimension: string; score: number }> : [];

  return (
    <Card className={`transition-colors ${result.icVerdict === "Approved" ? "border-green-500/20" : result.icVerdict === "Conditional Watchlist" ? "border-amber-500/20" : "border-red-500/20"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VerdictIcon verdict={result.icVerdict} />
            <CardTitle className="text-base">{result.segmentId}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={result.icVerdict} />
            {result.probabilityBand && (
              <span className="text-xs text-muted-foreground font-mono">{result.probabilityBand}</span>
            )}
          </div>
        </div>
        <div className="mt-2">
          <FitScoreBar score={score} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Fit breakdown */}
          {fitReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fit Breakdown</p>
              <div className="grid grid-cols-3 gap-3">
                {fitReasons.map((r) => (
                  <div key={r.dimension} className="text-center">
                    <p className="text-xs text-muted-foreground">{r.dimension}</p>
                    <p className="text-lg font-bold font-mono">{r.score}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IC Objections */}
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
                      <SeverityBadge severity={obj.severity} />
                    </div>
                    <p className="text-sm">{obj.objection}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Gaps */}
          {evidenceGaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Evidence Gaps
              </p>
              <ul className="space-y-1">
                {evidenceGaps.map((gap, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${gap.priority === "high" ? "bg-red-400" : "bg-amber-400"}`} />
                    {gap.gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Compliance Flags */}
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

          {/* Tailored Positioning */}
          {result.tailoredPositioning && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="h-3 w-3" /> Tailored Positioning
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{result.tailoredPositioning}</p>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function LPTwinSession() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/captwin/lp-twin/session/:id");
  const sessionId = params?.id ? Number(params.id) : 0;
  

  const { data, isLoading, error } = trpc.lpTwin.getSession.useQuery(
    { sessionId },
    { enabled: sessionId > 0 }
  );

  const exportMutation = trpc.lpTwin.exportSession.useMutation();

  const session = data?.session;
  const results = data?.results ?? [];

  const approvedCount = results.filter((r) => r.icVerdict === "Approved").length;
  const watchlistCount = results.filter((r) => r.icVerdict === "Conditional Watchlist").length;
  const rejectedCount = results.filter((r) => r.icVerdict === "Rejected").length;
  const avgFit = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + Number(r.fitScore), 0) / results.length) : 0;

  async function handleExport(type: "json" | "csv") {
    if (!session) return;
    try {
      const result = await exportMutation.mutateAsync({ sessionId, exportType: type, reportType: "full_session" });
      const blob = new Blob([JSON.stringify(result.exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lp-twin-${session.sessionName.replace(/\s+/g, "-")}-${type}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { description: "Audit record written." });
    } catch (err: unknown) {
      toast.error("Export failed", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
        <div className="text-center py-16 text-muted-foreground">
          <XCircle className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <p className="font-medium">Session not found or access denied</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/captwin/lp-twin")}>
            Back to LP Twin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/captwin/lp-twin")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{session.sessionName}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.scenarioType} · Engine {session.engineVersion} · {new Date(session.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleExport("json")}>
            <Download className="h-3 w-3" /> Export JSON
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6 text-xs text-amber-400">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>SYNTHETIC SIMULATION</strong> — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes.
          They are not validated predictions of real allocator behaviour.
        </span>
      </div>

      {/* Summary stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold font-mono">{avgFit}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1"><BarChart3 className="h-3 w-3" /> Avg Fit Score</p>
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
      )}

      {/* Results */}
      {results.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No results yet</p>
          <p className="text-sm mt-1">Session status: {session.status}</p>
        </div>
      ) : (
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
                  .map((r) => (
                    <SegmentCard key={r.id} result={r} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
