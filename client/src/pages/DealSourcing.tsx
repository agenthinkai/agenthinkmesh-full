import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  EyeOff,
  Loader2,
  BarChart2,
  Globe,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceStatus = "sourced" | "triaged" | "promoted" | "screened" | "ignored" | "all";
type SourceType = "seeded_test" | "manual" | "pattern_match" | "public_signal" | "all";

interface TriageAgent {
  agentName: string;
  score: number;
  reasoning: string;
  recommendation: "PROMOTE" | "WATCH" | "IGNORE";
}

interface TriageReasoning {
  agents: TriageAgent[];
  recommendation: "PROMOTE" | "WATCH" | "IGNORE";
  summary: string;
}

interface CouncilVerdict {
  verdict: string;
  yesCount: number;
  noCount: number;
  confidenceScore: string;
}

interface Lead {
  id: number;
  companyName: string;
  sector: string | null;
  region: string | null;
  sourceType: string;
  sourceLabel: string | null;
  status: string;
  triageScore: number | null;
  triageReasoning: TriageReasoning | null;
  councilVerdict: CouncilVerdict | null;
  rawInput: string;
  createdAt: Date | string | number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    sourced: { label: "Sourced", className: "bg-slate-700 text-slate-200" },
    triaged: { label: "Triaged", className: "bg-blue-900/60 text-blue-300" },
    promoted: { label: "Promoted", className: "bg-amber-900/60 text-amber-300" },
    screened: { label: "Screened", className: "bg-emerald-900/60 text-emerald-300" },
    ignored: { label: "Ignored", className: "bg-red-900/40 text-red-400" },
  };
  const s = map[status] ?? { label: status, className: "bg-slate-700 text-slate-300" };
  return <Badge className={`text-xs px-2 py-0.5 ${s.className}`}>{s.label}</Badge>;
}

function verdictBadge(verdict: string) {
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-900/60 text-emerald-300",
    APPROVED_WITH_CONDITIONS: "bg-teal-900/60 text-teal-300",
    REJECTED: "bg-red-900/60 text-red-400",
    VETOED: "bg-red-900/80 text-red-300",
    INSUFFICIENT_DATA: "bg-slate-700 text-slate-300",
  };
  return (
    <Badge className={`text-xs px-2 py-0.5 ${map[verdict] ?? "bg-slate-700 text-slate-300"}`}>
      {verdict.replace(/_/g, " ")}
    </Badge>
  );
}

function recommendationIcon(rec: string) {
  if (rec === "PROMOTE") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (rec === "WATCH") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
}

function triageScoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}
function relativeTime(d: Date | string | number) {
  const ms = Date.now() - new Date(typeof d === 'number' ? d : String(d)).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ── Lead Row ──────────────────────────────────────────────────────────────────

function LeadRow({ lead, onTriage, onPromote, onIgnore, triageLoading, promoteLoading, ignoreLoading }: {
  lead: Lead;
  onTriage: (id: number) => void;
  onPromote: (id: number) => void;
  onIgnore: (id: number) => void;
  triageLoading: boolean;
  promoteLoading: boolean;
  ignoreLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const canTriage = lead.status === "sourced";
  const canPromote = lead.status === "triaged" || lead.status === "promoted";
  const canIgnore = lead.status !== "screened" && lead.status !== "ignored";

  return (
    <div className="border border-slate-700/50 rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Company */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-100 text-sm truncate">{lead.companyName}</span>
            {statusBadge(lead.status)}
            {lead.triageScore !== null && (
              <span className={`text-xs font-mono font-semibold ${triageScoreColor(lead.triageScore)}`}>
                {lead.triageScore}/100
              </span>
            )}
            {lead.councilVerdict && verdictBadge(lead.councilVerdict.verdict)}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            {lead.sector && <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{lead.sector}</span>}
            {lead.region && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{lead.region}</span>}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime(lead.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canTriage && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs border-blue-700/50 text-blue-300 hover:bg-blue-900/30"
              onClick={() => onTriage(lead.id)}
              disabled={triageLoading}
            >
              {triageLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart2 className="w-3 h-3" />}
              <span className="ml-1">Triage</span>
            </Button>
          )}
          {canPromote && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs border-amber-700/50 text-amber-300 hover:bg-amber-900/30"
              onClick={() => onPromote(lead.id)}
              disabled={promoteLoading}
            >
              {promoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
              <span className="ml-1">Screen</span>
            </Button>
          )}
          {canIgnore && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20"
              onClick={() => onIgnore(lead.id)}
              disabled={ignoreLoading}
            >
              {ignoreLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-slate-500 hover:text-slate-300"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3">
          {/* Raw input */}
          <div>
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Source Input</p>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{lead.rawInput}</p>
          </div>

          {/* Triage agents */}
          {lead.triageReasoning?.agents && lead.triageReasoning.agents.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Quick Triage Council</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {lead.triageReasoning.agents.map((a) => (
                  <div key={a.agentName} className="bg-slate-900/60 rounded p-2.5 border border-slate-700/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-200">{a.agentName}</span>
                      <div className="flex items-center gap-1">
                        {recommendationIcon(a.recommendation)}
                        <span className={`text-xs font-mono font-semibold ${triageScoreColor(a.score)}`}>{a.score}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{a.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Council verdict */}
          {lead.councilVerdict && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Full Council Verdict</p>
              <div className="flex items-center gap-3 flex-wrap">
                {verdictBadge(lead.councilVerdict.verdict)}
                <span className="text-xs text-slate-400">
                  {lead.councilVerdict.yesCount} YES · {lead.councilVerdict.noCount} NO
                </span>
                <span className="text-xs text-slate-400">
                  Confidence: {(Number(lead.councilVerdict.confidenceScore) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DealSourcing() {
  // Filters
  const [statusFilter, setStatusFilter] = useState<SourceStatus>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType>("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  // Per-row loading state
  const [triagingId, setTriagingId] = useState<number | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [ignoringId, setIgnoringId] = useState<number | null>(null);

  // Queries
  const leadsQ = trpc.dealSourcing.listLeads.useQuery(
    { status: statusFilter, sourceType: sourceTypeFilter, sector: sectorFilter === "all" ? undefined : sectorFilter, region: regionFilter === "all" ? undefined : regionFilter, limit: 100 },
    { refetchInterval: 30000 }
  );

  // Mutations
  const generateMut = trpc.dealSourcing.generateLeads.useMutation({
    onSuccess: (data) => {
      toast.success("Leads generated", { description: data.message });
      leadsQ.refetch();
    },
    onError: (e) => toast.error("Generation failed", { description: e.message }),
  });

  const triageMut = trpc.dealSourcing.runTriage.useMutation({
    onSuccess: (data) => {
      toast.success("Triage complete", { description: data.message });
      setTriagingId(null);
      leadsQ.refetch();
    },
    onError: (e) => { toast.error("Triage failed", { description: e.message }); setTriagingId(null); },
  });

  const promoteMut = trpc.dealSourcing.promoteToScreener.useMutation({
    onSuccess: (data) => {
      toast.success("Council complete", { description: data.message });
      setPromotingId(null);
      leadsQ.refetch();
    },
    onError: (e) => { toast.error("Promotion failed", { description: e.message }); setPromotingId(null); },
  });

  const ignoreMut = trpc.dealSourcing.ignoreLead.useMutation({
    onSuccess: () => { setIgnoringId(null); leadsQ.refetch(); },
    onError: (e) => { toast.error("Error", { description: e.message }); setIgnoringId(null); },
  });

  const bulkTriageMut = trpc.dealSourcing.runTriage.useMutation({
    onSuccess: (data) => {
      toast.success("Bulk triage complete", { description: data.message });
      leadsQ.refetch();
    },
    onError: (e) => toast.error("Bulk triage failed", { description: e.message }),
  });

  const bulkPromoteMut = trpc.dealSourcing.bulkPromoteToScreener.useMutation({
    onSuccess: (data) => {
      toast.success("Bulk screening complete", { description: data.message });
      leadsQ.refetch();
    },
    onError: (e) => toast.error("Bulk screening failed", { description: e.message }),
  });

  const handleTriage = useCallback((id: number) => {
    setTriagingId(id);
    triageMut.mutate({ ids: [id], autoPromoteTop: 0 });
  }, [triageMut]);

  const handlePromote = useCallback((id: number) => {
    setPromotingId(id);
    promoteMut.mutate({ id });
  }, [promoteMut]);

  const handleIgnore = useCallback((id: number) => {
    setIgnoringId(id);
    ignoreMut.mutate({ id });
  }, [ignoreMut]);

  const leads = (leadsQ.data?.leads ?? []) as Lead[];

  // Stats
  const stats = {
    total: leads.length,
    sourced: leads.filter((l) => l.status === "sourced").length,
    triaged: leads.filter((l) => l.status === "triaged").length,
    promoted: leads.filter((l) => l.status === "promoted").length,
    screened: leads.filter((l) => l.status === "screened").length,
    ignored: leads.filter((l) => l.status === "ignored").length,
  };

  // Unique sectors/regions for filters
  const sectors = Array.from(new Set(leads.map((l) => l.sector).filter(Boolean))) as string[];
  const regions = Array.from(new Set(leads.map((l) => l.region).filter(Boolean))) as string[];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-semibold text-slate-100">Deal Sourcing Fleet</h1>
              <Badge className="bg-amber-900/40 text-amber-300 text-xs px-2 py-0.5">TEST MODE</Badge>
            </div>
            <p className="text-sm text-slate-400">
              4-agent sourcing layer → 3-agent quick triage → full council promotion
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => leadsQ.refetch()}
              disabled={leadsQ.isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${leadsQ.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-700/50 text-blue-300 hover:bg-blue-900/30"
              onClick={() => bulkTriageMut.mutate({ autoPromoteTop: 5 })}
              disabled={bulkTriageMut.isPending || stats.sourced === 0}
            >
              {bulkTriageMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5 mr-1.5" />}
              Triage All ({stats.sourced})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-700/50 text-amber-300 hover:bg-amber-900/30"
              onClick={() => bulkPromoteMut.mutate({ limit: 5 })}
              disabled={bulkPromoteMut.isPending || stats.promoted === 0}
            >
              {bulkPromoteMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 mr-1.5" />}
              Screen Promoted ({stats.promoted})
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-500 text-white"
              onClick={() => generateMut.mutate({ count: 20 })}
              disabled={generateMut.isPending}
            >
              {generateMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
              Generate Leads
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Total", value: stats.total, color: "text-slate-200" },
            { label: "Sourced", value: stats.sourced, color: "text-slate-400" },
            { label: "Triaged", value: stats.triaged, color: "text-blue-400" },
            { label: "Promoted", value: stats.promoted, color: "text-amber-400" },
            { label: "Screened", value: stats.screened, color: "text-emerald-400" },
            { label: "Ignored", value: stats.ignored, color: "text-red-400" },
          ].map((s) => (
            <Card key={s.label} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SourceStatus)}>
                <SelectTrigger className="h-8 w-36 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  {["all", "sourced", "triaged", "promoted", "screened", "ignored"].map((s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">{s === "all" ? "All Statuses" : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceTypeFilter} onValueChange={(v) => setSourceTypeFilter(v as SourceType)}>
                <SelectTrigger className="h-8 w-40 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                  <SelectValue placeholder="Source Type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  <SelectItem value="all" className="text-xs">All Sources</SelectItem>
                  <SelectItem value="seeded_test" className="text-xs">Seeded Test</SelectItem>
                  <SelectItem value="pattern_match" className="text-xs">Pattern Match</SelectItem>
                  <SelectItem value="public_signal" className="text-xs">Public Signal</SelectItem>
                  <SelectItem value="manual" className="text-xs">Manual</SelectItem>
                </SelectContent>
              </Select>

              {sectors.length > 0 && (
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                  <SelectTrigger className="h-8 w-44 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                    <SelectValue placeholder="Sector" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="all" className="text-xs">All Sectors</SelectItem>
                    {sectors.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {regions.length > 0 && (
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="h-8 w-40 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="all" className="text-xs">All Regions</SelectItem>
                    {regions.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lead list */}
        <div className="space-y-2">
          {leadsQ.isLoading && (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading leads...
            </div>
          )}

          {!leadsQ.isLoading && leads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Zap className="w-8 h-8 text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">No leads yet</p>
              <p className="text-slate-500 text-sm mt-1">Click "Generate Leads" to run the sourcing agents.</p>
            </div>
          )}

          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              onTriage={handleTriage}
              onPromote={handlePromote}
              onIgnore={handleIgnore}
              triageLoading={triagingId === lead.id}
              promoteLoading={promotingId === lead.id}
              ignoreLoading={ignoringId === lead.id}
            />
          ))}
        </div>

        {/* Pipeline guide */}
        <Separator className="bg-slate-700/40" />
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 justify-center">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" />Generate</span>
          <ArrowRight className="w-3 h-3" />
          <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3 text-blue-400" />Quick Triage (3 agents)</span>
          <ArrowRight className="w-3 h-3" />
          <span className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-amber-400" />Promote to Full Council</span>
          <ArrowRight className="w-3 h-3" />
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" />Screened Verdict</span>
          <span className="ml-2 text-slate-600">· All candidates are TEST MODE — not live deal data</span>
        </div>
      </div>
    </div>
  );
}
