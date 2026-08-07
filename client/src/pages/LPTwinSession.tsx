import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Play, RefreshCw, Download, Trash2,
  ChevronDown, ChevronUp, MessageSquare, AlertTriangle,
  CheckCircle2, XCircle, Clock, Target, TrendingUp,
  Shield, Info, Loader2,
} from "lucide-react";

interface DimensionScore { dimension: string; score: number; weight: number; reasoning: string; dataPresent: boolean; }
interface EvidenceGap { field: string; description: string; priority: "Critical" | "High" | "Medium" | "Low"; impactOnScore: string; }
interface Objection { category: string; statement: string; severity: "Critical" | "High" | "Moderate" | "Low"; likelihood: string; isCurable: boolean; recommendedResponse: string; suggestedTermAdjustment: string | null; suggestedPositioningAdjustment: string | null; }
interface SegmentResult { id: number; segmentId: string; fitScore: string; fitReasonsJson: string | null; disqualifiersJson: string | null; objectionsJson: string | null; evidenceGapsJson: string | null; complianceFlagsJson: string | null; icVerdict: string | null; tailoredPositioning: string | null; probabilityBand: string | null; modelVersion: string | null; createdAt: number; }

function fitCategoryFromScore(s: number) { return s >= 70 ? "Strong Fit" : s >= 50 ? "Conditional Fit" : s >= 30 ? "Weak Fit" : "Likely Ineligible"; }
function fitCategoryColor(s: number) { return s >= 70 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : s >= 30 ? "text-orange-400" : "text-red-400"; }
function fitBadgeVariant(s: number): "default" | "secondary" | "destructive" | "outline" { return s >= 70 ? "default" : s >= 50 ? "secondary" : "destructive"; }
function severityColor(sev: string) { return sev === "Critical" ? "text-red-400 bg-red-950/40 border-red-800/40" : sev === "High" ? "text-orange-400 bg-orange-950/40 border-orange-800/40" : sev === "Moderate" ? "text-amber-400 bg-amber-950/40 border-amber-800/40" : "text-slate-400 bg-slate-800/40 border-slate-700/40"; }
function statusIcon(status: string) { switch (status) { case "completed": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />; case "running": return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />; case "failed": return <XCircle className="w-4 h-4 text-red-400" />; case "failed": return <AlertTriangle className="w-4 h-4 text-amber-400" />; default: return <Clock className="w-4 h-4 text-slate-400" />; } }

function SegmentResultCard({ result, sessionId, agentName, onAskLp }: { result: SegmentResult; sessionId: number; agentName: string; onAskLp: (segId: string, name: string) => void; }) {
  const [expanded, setExpanded] = useState(false);
  const score = parseFloat(result.fitScore);
  const dimensions: DimensionScore[] = (() => { try { return JSON.parse(result.fitReasonsJson ?? "[]") as DimensionScore[]; } catch { return []; } })();
  const disqualifiers: string[] = (() => { try { return JSON.parse(result.disqualifiersJson ?? "[]") as string[]; } catch { return []; } })();
  const objections: Objection[] = (() => { try { return JSON.parse(result.objectionsJson ?? "[]") as Objection[]; } catch { return []; } })();
  const evidenceGaps: EvidenceGap[] = (() => { try { return JSON.parse(result.evidenceGapsJson ?? "[]") as EvidenceGap[]; } catch { return []; } })();
  const criticalCount = objections.filter((o) => o.severity === "Critical" || o.severity === "High").length;
  const curableCount = objections.filter((o) => o.isCurable).length;
  return (
    <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-white text-sm">{agentName}</span>
            <Badge variant={fitBadgeVariant(score)} className="text-xs">{fitCategoryFromScore(score)}</Badge>
            {result.probabilityBand ? <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Probability: {result.probabilityBand}</span> : null}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className={`text-2xl font-bold ${fitCategoryColor(score)}`}>{score.toFixed(1)}</span>
            <span className="text-slate-500 text-sm">/ 100</span>
            {result.icVerdict ? <span className="text-xs text-slate-400">IC: {result.icVerdict}</span> : null}
          </div>
          {disqualifiers.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {disqualifiers.slice(0, 2).map((d, i) => <span key={i} className="text-xs text-red-400 bg-red-950/30 border border-red-800/30 px-2 py-0.5 rounded">{d}</span>)}
              {disqualifiers.length > 2 ? <span className="text-xs text-slate-500">+{disqualifiers.length - 2} more</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-300 hover:bg-slate-800" onClick={() => onAskLp(result.segmentId, agentName)}>
            <MessageSquare className="w-3 h-3 mr-1" />Ask LP
          </Button>
          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="border-t border-slate-700/50 p-4 space-y-5">
          {dimensions.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">18-Dimension Fit Analysis</h4>
              <div className="grid grid-cols-1 gap-1.5">
                {dimensions.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-40 shrink-0 truncate">{d.dimension}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${d.score >= 70 ? "bg-emerald-500" : d.score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${d.score}%` }} /></div>
                    <span className={`text-xs w-8 text-right shrink-0 ${d.score >= 70 ? "text-emerald-400" : d.score >= 50 ? "text-amber-400" : "text-red-400"}`}>{d.score.toFixed(0)}</span>
                    {!d.dataPresent ? <span className="text-xs text-slate-600 shrink-0">no data</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {objections.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Objection Map ({objections.length} total · {criticalCount} critical/high · {curableCount} curable)</h4>
              <div className="space-y-2">
                {objections.map((o, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${severityColor(o.severity)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs leading-relaxed">{o.statement}</p>
                      <div className="flex gap-1 shrink-0">
                        <span className="text-xs opacity-70">{o.severity}</span>
                        {o.isCurable ? <span className="text-xs text-emerald-400 bg-emerald-950/40 px-1.5 rounded">Curable</span> : <span className="text-xs text-slate-500 bg-slate-800 px-1.5 rounded">Fixed</span>}
                      </div>
                    </div>
                    {o.recommendedResponse ? <p className="text-xs mt-2 opacity-80 border-t border-current/20 pt-2"><span className="font-medium">Response: </span>{o.recommendedResponse}</p> : null}
                    {o.suggestedTermAdjustment ? <p className="text-xs mt-1 opacity-70"><span className="font-medium">Term adjustment: </span>{o.suggestedTermAdjustment}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {evidenceGaps.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Evidence Gaps</h4>
              <div className="space-y-1.5">
                {evidenceGaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${g.priority === "Critical" ? "bg-red-950/40 text-red-400" : g.priority === "High" ? "bg-orange-950/40 text-orange-400" : "bg-slate-800 text-slate-400"}`}>{g.priority}</span>
                    <div><p className="text-xs text-slate-300">{g.description}</p><p className="text-xs text-slate-500">{g.impactOnScore}</p></div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {result.tailoredPositioning ? (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Targeting Recommendation</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 rounded p-3">{result.tailoredPositioning}</p>
            </div>
          ) : null}
          <p className="text-xs text-slate-600 italic border-t border-slate-700/50 pt-3">SYNTHETIC SIMULATION — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.</p>
        </div>
      ) : null}
    </div>
  );
}

function AskLpPanel({ sessionId, segmentId, agentName, onClose }: { sessionId: number; segmentId: string; agentName: string; onClose: () => void; }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: string; warning: string | null }>>([]);
  const askMutation = trpc.lpTwin.askLp.useMutation({
    onSuccess: (data) => { setHistory((prev) => [...prev, { q: question, a: data.response, warning: data.inconsistencyWarning ?? null }]); setQuestion(""); },
    onError: (err) => toast.error(`Ask LP failed: ${err.message}`),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div><p className="text-sm font-semibold text-white">Ask an LP</p><p className="text-xs text-slate-400">{agentName} · Synthetic LP Archetype</p></div>
          <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400">✕</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {history.length === 0 ? (
            <div className="text-center py-8"><MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-500">Ask this allocator archetype a question about your fund.</p><p className="text-xs text-slate-600 mt-1">Responses are grounded in the deterministic fit score.</p></div>
          ) : null}
          {history.map((item, i) => (
            <div key={i} className="space-y-2">
              <div className="bg-slate-800 rounded-lg p-3"><p className="text-xs text-slate-400 mb-1">You</p><p className="text-sm text-slate-200">{item.q}</p></div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">{agentName}</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.a}</p>
                {item.warning ? <div className="mt-2 flex items-start gap-2 bg-amber-950/30 border border-amber-800/30 rounded p-2"><AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" /><p className="text-xs text-amber-400">{item.warning}</p></div> : null}
              </div>
            </div>
          ))}
          {askMutation.isPending ? <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Generating response...</span></div> : null}
        </div>
        <div className="p-4 border-t border-slate-700 space-y-2">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What would make you reconsider this fund?" className="bg-slate-800 border-slate-600 text-slate-200 text-sm resize-none" rows={3} />
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm" onClick={() => { if (!question.trim()) return; askMutation.mutate({ sessionId, segmentId, question: question.trim() }); }} disabled={askMutation.isPending || !question.trim()}>
            {askMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Send
          </Button>
          <p className="text-xs text-slate-600">Not predictions of real allocator behaviour.</p>
        </div>
      </div>
    </div>
  );
}

export default function LPTwinSession() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const sessionId = parseInt(id ?? "0", 10);
  const [askLpState, setAskLpState] = useState<{ segmentId: string; agentName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data, isLoading, error, refetch } = trpc.lpTwin.getSession.useQuery(
    { sessionId },
    { enabled: sessionId > 0, refetchInterval: (q) => { const s = q.state.data?.session?.status; return s === "running" ? 3000 : false; } }
  );
  const { data: agentsData } = trpc.lpTwin.listAgents.useQuery();
  const runMutation = trpc.lpTwin.runSegmentAnalysis.useMutation({ onSuccess: () => { void refetch(); toast.success("Analysis started"); }, onError: (err) => toast.error(`Failed: ${err.message}`) });
  const deleteMutation = trpc.lpTwin.deleteSession.useMutation({ onSuccess: () => { navigate("/captwin/lp-twin"); toast.success("Session deleted"); }, onError: (err) => toast.error(`Delete failed: ${err.message}`) });
  const exportMutation = trpc.lpTwin.exportSession.useMutation({
    onSuccess: (exportData) => { const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `lp-twin-session-${sessionId}.json`; a.click(); URL.revokeObjectURL(url); toast.success("Export downloaded"); },
    onError: (err) => toast.error(`Export failed: ${err.message}`),
  });
  const agentNameMap = useCallback((segId: string) => agentsData?.agents.find((a) => a.id === segId)?.name ?? segId, [agentsData]);

  if (!sessionId || isNaN(sessionId)) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Invalid session ID</p></div>;
  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>;
  if (error || !data) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center"><XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" /><p className="text-slate-300 mb-4">{error?.message ?? "Session not found"}</p><Button variant="outline" onClick={() => navigate("/captwin/lp-twin")}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button></div>
    </div>
  );

  const { session, results } = data;
  const sortedResults = [...results].sort((a, b) => parseFloat(b.fitScore) - parseFloat(a.fitScore));
  const selectedIds: string[] = (() => { try { return JSON.parse(session.selectedSegmentsJson) as string[]; } catch { return []; } })();
  const assumptions: Record<string, unknown> = (() => { try { return session.assumptionsJson ? JSON.parse(session.assumptionsJson) as Record<string, unknown> : {}; } catch { return {}; } })();
  const avgScore = results.length > 0 ? results.reduce((s, r) => s + parseFloat(r.fitScore), 0) / results.length : 0;
  const strongFit = results.filter((r) => parseFloat(r.fitScore) >= 70).length;
  const conditionalFit = results.filter((r) => parseFloat(r.fitScore) >= 50 && parseFloat(r.fitScore) < 70).length;
  const weakFit = results.filter((r) => parseFloat(r.fitScore) < 50).length;
  const isPending = session.status === "pending";
  const isRunning = session.status === "running";
  const isComplete = session.status === "completed" || session.status === "failed";
  const isFailed = session.status === "failed";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/captwin/lp-twin")} className="text-slate-400 hover:text-white shrink-0"><ArrowLeft className="w-4 h-4" /></Button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">{session.sessionName}</h1>
              <div className="flex items-center gap-2 mt-0.5">{statusIcon(session.status)}<span className="text-xs text-slate-400 capitalize">{session.status.replace("_", " ")}</span><span className="text-xs text-slate-600">·</span><span className="text-xs text-slate-500">{selectedIds.length} segments</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(isPending || isFailed) ? <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs" onClick={() => runMutation.mutate({ sessionId })} disabled={runMutation.isPending}>{runMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}Run Analysis</Button> : null}
            {isRunning ? <Button size="sm" variant="outline" onClick={() => void refetch()} className="text-xs border-slate-600 text-slate-300"><RefreshCw className="w-3 h-3 mr-1" />Refresh</Button> : null}
            {isComplete ? <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-300 hover:bg-slate-800" onClick={() => exportMutation.mutate({ sessionId, exportType: "json", reportType: "full_session" })} disabled={exportMutation.isPending}><Download className="w-3 h-3 mr-1" />Export</Button> : null}
            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => setDeleteConfirm(true)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {isComplete && results.length > 0 ? (
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-indigo-400" /><h2 className="text-sm font-semibold text-white">Executive Summary</h2><span className="text-xs text-slate-500 ml-auto">Engine v{results[0]?.modelVersion ?? "2.0.0"}</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="bg-slate-800/50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-white">{avgScore.toFixed(1)}</p><p className="text-xs text-slate-400 mt-1">Avg Fit Score</p></div>
              <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-emerald-400">{strongFit}</p><p className="text-xs text-slate-400 mt-1">Strong Fit</p></div>
              <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-400">{conditionalFit}</p><p className="text-xs text-slate-400 mt-1">Conditional</p></div>
              <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-red-400">{weakFit}</p><p className="text-xs text-slate-400 mt-1">Weak / Ineligible</p></div>
            </div>
            {strongFit > 0 ? (
              <div className="mt-4 bg-indigo-950/30 border border-indigo-800/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1"><Target className="w-3 h-3 text-indigo-400" /><span className="text-xs font-semibold text-indigo-300">Targeting Recommendation</span></div>
                <p className="text-xs text-slate-300">Prioritise outreach to {strongFit} Strong Fit segment{strongFit > 1 ? "s" : ""}.{conditionalFit > 0 ? ` ${conditionalFit} Conditional Fit segment${conditionalFit > 1 ? "s" : ""} may be approachable after addressing key objections.` : ""}{weakFit > 0 ? ` Defer ${weakFit} Weak Fit / Ineligible segment${weakFit > 1 ? "s" : ""} until fund terms or track record improve.` : ""}</p>
              </div>
            ) : null}
            <p className="text-xs text-slate-600 mt-3 italic">SYNTHETIC SIMULATION — These outputs are evidence-based synthetic simulations derived from anonymised institutional archetypes. They are not validated predictions of real allocator behaviour.</p>
          </div>
        ) : null}

        <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-slate-400" /><h2 className="text-sm font-semibold text-slate-300">Session Parameters</h2></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Scenario</span><span className="text-slate-300 capitalize">{session.scenarioType}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Segments</span><span className="text-slate-300">{selectedIds.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Engine</span><span className="text-slate-300">{session.engineVersion}</span></div>
            {Object.entries(assumptions).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500 capitalize">{k}</span><span className="text-slate-300">{String(v)}</span></div>)}
          </div>
        </div>

        {isRunning ? (
          <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-6 text-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-blue-300 font-medium">Analysis in progress</p>
            <p className="text-xs text-slate-400 mt-1">{(session as Record<string, unknown>).segmentsCompleted as number ?? 0} of {selectedIds.length} segments complete</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()} className="mt-3 text-xs border-slate-600"><RefreshCw className="w-3 h-3 mr-1" />Refresh</Button>
          </div>
        ) : null}

        {isPending ? (
          <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-8 text-center">
            <Shield className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-medium mb-2">Analysis not yet started</p>
            <p className="text-sm text-slate-500 mb-4">Run the analysis to score {selectedIds.length} LP segment{selectedIds.length > 1 ? "s" : ""} against your fund profile.</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => runMutation.mutate({ sessionId })} disabled={runMutation.isPending}>
              {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}Run Segment Analysis
            </Button>
          </div>
        ) : null}

        {isFailed ? (
          <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-6 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-300 font-medium mb-2">Analysis failed</p>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => runMutation.mutate({ sessionId })} disabled={runMutation.isPending}>Retry Analysis</Button>
          </div>
        ) : null}

        {sortedResults.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold text-white">Segment Results <span className="text-slate-500 font-normal">ranked by fit score</span></h2></div>
            <div className="space-y-3">
              {sortedResults.map((result) => <SegmentResultCard key={result.id} result={result} sessionId={sessionId} agentName={agentNameMap(result.segmentId)} onAskLp={(segId, name) => setAskLpState({ segmentId: segId, agentName: name })} />)}
            </div>
          </div>
        ) : null}

        {session.status === "failed" ? (
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-300 font-medium">Partial results</p>
              <p className="text-xs text-slate-400 mt-1">{(session as Record<string, unknown>).segmentsCompleted as number ?? 0} segments scored, {(session as Record<string, unknown>).segmentsFailed as number ?? 0} failed.</p>
              <Button size="sm" className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs" onClick={() => runMutation.mutate({ sessionId })} disabled={runMutation.isPending}>Retry Failed Segments</Button>
            </div>
          </div>
        ) : null}
      </div>

      {askLpState ? <AskLpPanel sessionId={sessionId} segmentId={askLpState.segmentId} agentName={askLpState.agentName} onClose={() => setAskLpState(null)} /> : null}

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-sm font-semibold text-white mb-2">Delete session?</h3>
            <p className="text-xs text-slate-400 mb-4">This will permanently delete the session and all segment results. This cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => deleteMutation.mutate({ sessionId })} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Delete</Button>
              <Button variant="outline" size="sm" className="flex-1 border-slate-600" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
