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
  ShieldCheck,
  AlertOctagon,
  FileText,
  Info,
  Download,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceStatus = "sourced" | "triaged" | "promoted" | "screened" | "ignored" | "all";
type SourceType = "seeded_test" | "manual" | "pattern_match" | "public_signal" | "all";
type VerdictFilter = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA" | "all";
type ActiveTab = "pipeline" | "screened";

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

interface ScreenedLead {
  id: number;
  companyName: string;
  sector: string | null;
  region: string | null;
  sourceType: string;
  sourceLabel: string | null;
  rawInput: string;
  triageScore: number | null;
  triageReasoning: TriageReasoning | null;
  createdAt: number;
  fullEvalId: number | null;
  // Full council data
  verdict: string | null;
  yesCount: number | null;
  noCount: number | null;
  hardYesCount: number | null;
  softYesCount: number | null;
  softNoCount: number | null;
  hardNoCount: number | null;
  confidenceScore: string | null;
  gccVetoTriggered: boolean;
  tiebreakerTriggered: boolean;
  tiebreakerSwingAgent: string | null;
  conditionsToProceed: string[];
  blockingIssues: string[];
  votes: unknown[];
  screenedAt: Date | string | null;
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

function verdictIcon(verdict: string | null) {
  if (!verdict) return <Info className="w-3.5 h-3.5 text-slate-500" />;
  if (verdict === "APPROVED") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (verdict === "APPROVED_WITH_CONDITIONS") return <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />;
  if (verdict === "VETOED") return <AlertOctagon className="w-3.5 h-3.5 text-red-300" />;
  if (verdict === "REJECTED") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />;
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
  const ms = Date.now() - new Date(typeof d === "number" ? d : String(d)).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function confidencePct(score: string | null): string {
  if (!score) return "—";
  const n = parseFloat(score);
  if (isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

// ── CSV Export Utility ───────────────────────────────────────────────────────

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Escape double-quotes, wrap in quotes if contains comma, quote, or newline
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatDateForCSV(d: Date | string | number | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(typeof d === "number" ? d : String(d)).toISOString();
  } catch {
    return "";
  }
}

function exportScreenedLeadsCSV(leads: ScreenedLead[]): void {
  const headers = [
    "company",
    "sector",
    "region",
    "triage_score",
    "full_council_verdict",
    "confidence",
    "yes_votes",
    "no_votes",
    "hard_no_count",
    "conditions_count",
    "blocking_issues_count",
    "source_agent",
    "created_at",
    "screened_at",
  ];

  const rows = leads.map((l) => [
    csvCell(l.companyName),
    csvCell(l.sector),
    csvCell(l.region),
    csvCell(l.triageScore),
    csvCell(l.verdict),
    csvCell(l.confidenceScore ? String(Math.round(parseFloat(l.confidenceScore) * 100)) + "%" : ""),
    csvCell(l.yesCount),
    csvCell(l.noCount),
    csvCell(l.hardNoCount),
    csvCell(l.conditionsToProceed.length),
    csvCell(l.blockingIssues.length),
    csvCell(l.sourceLabel ?? l.sourceType),
    csvCell(formatDateForCSV(l.createdAt)),
    csvCell(formatDateForCSV(l.screenedAt)),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deal_sourcing_screened_leads_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Lead Row (Pipeline) ───────────────────────────────────────────────────────

function LeadRow({ lead, onTriage, onPromote, onIgnore, onReTriageLead, triageLoading, promoteLoading, ignoreLoading, reTriageLeadLoading }: {
  lead: Lead;
  onTriage: (id: number) => void;
  onPromote: (id: number) => void;
  onIgnore: (id: number) => void;
  onReTriageLead: (id: number) => void;
  triageLoading: boolean;
  promoteLoading: boolean;
  ignoreLoading: boolean;
  reTriageLeadLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const canTriage = lead.status === "sourced";
  const canPromote = lead.status === "triaged" || lead.status === "promoted";
  const canIgnore = lead.status !== "screened" && lead.status !== "ignored";
  const canReTriageLead = lead.status === "sourced" || lead.status === "triaged" || lead.status === "promoted";

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
          {canReTriageLead && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs border-slate-600/60 text-slate-400 hover:border-blue-600/50 hover:text-blue-300 hover:bg-blue-900/20"
              onClick={() => onReTriageLead(lead.id)}
              disabled={reTriageLeadLoading}
              title="Re-run quick triage for this lead"
            >
              {reTriageLeadLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span className="ml-1">Re-triage</span>
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
                <span className="text-xs text-slate-500">
                  Confidence: {confidencePct(lead.councilVerdict.confidenceScore)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Screened Lead Row ─────────────────────────────────────────────────────────

function ScreenedLeadRow({ lead }: { lead: ScreenedLead }) {
  const [expanded, setExpanded] = useState(false);

  const triageAgents = lead.triageReasoning?.agents ?? [];
  const hasConditions = lead.conditionsToProceed.length > 0;
  const hasBlocking = lead.blockingIssues.length > 0;

  return (
    <div className="border border-slate-700/50 rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
      {/* Compact table row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: Company + verdict + score */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {verdictIcon(lead.verdict)}
              <span className="font-semibold text-slate-100 text-sm">{lead.companyName}</span>
            </div>
            {lead.verdict && verdictBadge(lead.verdict)}
            {lead.triageScore !== null && (
              <span className={`text-xs font-mono font-semibold ${triageScoreColor(lead.triageScore)}`}>
                T:{lead.triageScore}
              </span>
            )}
            {lead.gccVetoTriggered && (
              <Badge className="bg-red-900/60 text-red-300 text-xs px-1.5 py-0.5">GCC VETO</Badge>
            )}
            {lead.tiebreakerTriggered && (
              <Badge className="bg-purple-900/60 text-purple-300 text-xs px-1.5 py-0.5">TIEBREAKER</Badge>
            )}
          </div>

          {/* Row 2: Metadata */}
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
            {lead.sector && <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{lead.sector}</span>}
            {lead.region && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{lead.region}</span>}
            {lead.yesCount !== null && lead.noCount !== null && (
              <span className="flex items-center gap-1">
                <span className="text-emerald-500">{lead.yesCount}Y</span>
                <span className="text-slate-600">·</span>
                <span className="text-red-500">{lead.noCount}N</span>
              </span>
            )}
            {lead.confidenceScore && (
              <span className="flex items-center gap-1 text-slate-400">
                {confidencePct(lead.confidenceScore)} conf
              </span>
            )}
            {lead.sourceLabel && (
              <span className="flex items-center gap-1 text-slate-600">
                via {lead.sourceLabel}
              </span>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime(lead.createdAt)}</span>
            {lead.screenedAt && (
              <span className="flex items-center gap-1 text-slate-600">
                screened {relativeTime(lead.screenedAt)}
              </span>
            )}
          </div>

          {/* Row 3: Conditions / blocking summary (inline preview) */}
          {(hasConditions || hasBlocking) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {hasBlocking && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {lead.blockingIssues.length} blocking issue{lead.blockingIssues.length !== 1 ? "s" : ""}
                </span>
              )}
              {hasConditions && (
                <span className="text-xs text-teal-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {lead.conditionsToProceed.length} condition{lead.conditionsToProceed.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-300 shrink-0 mt-0.5"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/40 pt-3">

          {/* Raw input */}
          <div>
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Source Input</p>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{lead.rawInput}</p>
          </div>

          {/* Triage reasoning */}
          {triageAgents.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Quick Triage Reasoning</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {triageAgents.map((a) => (
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
              {lead.triageReasoning?.summary && (
                <p className="text-xs text-slate-400 mt-2 italic">{lead.triageReasoning.summary}</p>
              )}
            </div>
          )}

          {/* Full council verdict summary */}
          {lead.verdict && (
            <div>
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Full Council Verdict Summary</p>
              <div className="bg-slate-900/60 rounded-lg border border-slate-700/40 p-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  {verdictBadge(lead.verdict)}
                  <span className="text-xs text-slate-300">
                    {lead.yesCount} YES · {lead.noCount} NO
                    {lead.hardYesCount ? ` (${lead.hardYesCount} hard YES)` : ""}
                    {lead.hardNoCount ? ` · ${lead.hardNoCount} hard NO` : ""}
                  </span>
                  <span className="text-xs text-slate-400">
                    Confidence: {confidencePct(lead.confidenceScore)}
                  </span>
                </div>
                {lead.gccVetoTriggered && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3" />
                    GCC Veto triggered — regional compliance block
                  </p>
                )}
                {lead.tiebreakerTriggered && lead.tiebreakerSwingAgent && (
                  <p className="text-xs text-purple-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Tiebreaker resolved by: {lead.tiebreakerSwingAgent}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conditions to proceed */}
          {hasConditions && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Conditions to Proceed</p>
              <ul className="space-y-1">
                {lead.conditionsToProceed.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-teal-300">
                    <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0 text-teal-500" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blocking issues */}
          {hasBlocking && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wide">Blocking Issues</p>
              <ul className="space-y-1">
                {lead.blockingIssues.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-400">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decision Integrity note */}
          {lead.fullEvalId && (
            <div className="flex items-center gap-2 text-xs text-slate-600 border-t border-slate-700/30 pt-2">
              <FileText className="w-3 h-3" />
              <span>Full screening record ID: {lead.fullEvalId} — open Deal Screener to view per-persona votes</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DealSourcing() {
  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("pipeline");

  // Pipeline filters
  const [statusFilter, setStatusFilter] = useState<SourceStatus>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType>("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  // Screened leads filters
  const [screenedVerdictFilter, setScreenedVerdictFilter] = useState<VerdictFilter>("all");
  const [screenedSectorFilter, setScreenedSectorFilter] = useState("all");
  const [screenedRegionFilter, setScreenedRegionFilter] = useState("all");

  // Auto-promote threshold (0–100, default 60)
  const [promoteThreshold, setPromoteThreshold] = useState(60);

  // Per-row loading state
  const [triagingId, setTriagingId] = useState<number | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [ignoringId, setIgnoringId] = useState<number | null>(null);

  // Queries
  const leadsQ = trpc.dealSourcing.listLeads.useQuery(
    { status: statusFilter, sourceType: sourceTypeFilter, sector: sectorFilter === "all" ? undefined : sectorFilter, region: regionFilter === "all" ? undefined : regionFilter, limit: 100 },
    { refetchInterval: 30000 }
  );

  const screenedQ = trpc.dealSourcing.listScreenedLeads.useQuery(
    {
      verdict: screenedVerdictFilter,
      sector: screenedSectorFilter === "all" ? undefined : screenedSectorFilter,
      region: screenedRegionFilter === "all" ? undefined : screenedRegionFilter,
      limit: 100,
    },
    { refetchInterval: 30000 }
  );

  const agentStatsQ = trpc.dealSourcing.agentStats.useQuery(undefined, { refetchInterval: 30000 });

  // Mutations
  const generateMut = trpc.dealSourcing.generateLeads.useMutation({
    onSuccess: (data) => {
      const desc = data.duplicateSkipped && data.duplicateSkipped > 0
        ? `${data.message}`
        : data.message;
      toast.success("Leads generated", { description: desc });
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
      screenedQ.refetch();
    },
    onError: (e) => { toast.error("Promotion failed", { description: e.message }); setPromotingId(null); },
  });

  const ignoreMut = trpc.dealSourcing.ignoreLead.useMutation({
    onSuccess: () => { setIgnoringId(null); leadsQ.refetch(); },
    onError: (e) => { toast.error("Error", { description: e.message }); setIgnoringId(null); },
  });

  const [reTriageLeadId, setReTriageLeadId] = useState<number | null>(null);
  const reTriageLeadMut = trpc.dealSourcing.reTriageLead.useMutation({
    onSuccess: (data) => {
      toast.success("Re-triage complete", { description: data.message });
      setReTriageLeadId(null);
      leadsQ.refetch();
      agentStatsQ.refetch();
    },
    onError: (e) => { toast.error("Re-triage failed", { description: e.message }); setReTriageLeadId(null); },
  });
  const reTriageMut = trpc.dealSourcing.reTriageSourced.useMutation({
    onSuccess: (data) => {
      toast.success("Re-triage complete", { description: data.message });
      leadsQ.refetch();
      agentStatsQ.refetch();
    },
    onError: (e) => toast.error("Re-triage failed", { description: e.message }),
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
      screenedQ.refetch();
    },
    onError: (e) => toast.error("Bulk screening failed", { description: e.message }),
  });

  const clearIgnoredMut = trpc.dealSourcing.clearIgnoredLeads.useMutation({
    onSuccess: (data) => {
      toast.success("Ignored leads cleared", { description: data.message });
      leadsQ.refetch();
      agentStatsQ.refetch();
    },
    onError: (e) => toast.error("Clear failed", { description: e.message }),
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
  const screenedLeads = (screenedQ.data?.leads ?? []) as ScreenedLead[];

  // Stats
  const stats = {
    total: leads.length,
    sourced: leads.filter((l) => l.status === "sourced").length,
    triaged: leads.filter((l) => l.status === "triaged").length,
    promoted: leads.filter((l) => l.status === "promoted").length,
    screened: leads.filter((l) => l.status === "screened").length,
    ignored: leads.filter((l) => l.status === "ignored").length,
  };

  // Unique sectors/regions for pipeline filters
  const sectors = Array.from(new Set(leads.map((l) => l.sector).filter(Boolean))) as string[];
  const regions = Array.from(new Set(leads.map((l) => l.region).filter(Boolean))) as string[];

  // Unique sectors/regions for screened filters
  const screenedSectors = Array.from(new Set(screenedLeads.map((l) => l.sector).filter(Boolean))) as string[];
  const screenedRegions = Array.from(new Set(screenedLeads.map((l) => l.region).filter(Boolean))) as string[];

  const handleClearIgnored = useCallback(() => {
    const count = leads.filter((l) => l.status === "ignored").length;
    if (count === 0) return;
    const confirmed = window.confirm(`Clear ${count} ignored lead${count !== 1 ? "s" : ""}? This cannot be undone.`);
    if (confirmed) clearIgnoredMut.mutate();
  }, [leads, clearIgnoredMut]);

  // Screened verdict breakdown
  const screenedStats = {
    approved: screenedLeads.filter((l) => l.verdict === "APPROVED").length,
    approvedWithConditions: screenedLeads.filter((l) => l.verdict === "APPROVED_WITH_CONDITIONS").length,
    rejected: screenedLeads.filter((l) => l.verdict === "REJECTED").length,
    vetoed: screenedLeads.filter((l) => l.verdict === "VETOED").length,
    insufficientData: screenedLeads.filter((l) => l.verdict === "INSUFFICIENT_DATA").length,
  };

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
              onClick={() => { leadsQ.refetch(); screenedQ.refetch(); agentStatsQ.refetch(); }}
              disabled={leadsQ.isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${leadsQ.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-700/50 text-blue-300 hover:bg-blue-900/30"
              onClick={() => bulkTriageMut.mutate({ autoPromoteTop: 5, autoPromoteThreshold: promoteThreshold })}
              disabled={bulkTriageMut.isPending || stats.sourced === 0}
            >
              {bulkTriageMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5 mr-1.5" />}
              Triage All ({stats.sourced})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-600/40 text-blue-400 hover:bg-blue-900/20"
              onClick={() => reTriageMut.mutate({ limit: 50, autoPromoteThreshold: promoteThreshold })}
              disabled={reTriageMut.isPending || stats.sourced === 0}
              title={stats.sourced === 0 ? "No sourced leads pending triage" : `Re-triage ${stats.sourced} sourced lead${stats.sourced !== 1 ? "s" : ""}`}
            >
              {reTriageMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Re-triage Sourced
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-700/50 text-amber-300 hover:bg-amber-900/30"
              onClick={() => bulkPromoteMut.mutate({ concurrency: 5 })}
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
            <Card
              key={s.label}
              className={`border-slate-700/50 cursor-pointer transition-colors ${
                s.label === "Screened" && activeTab === "screened"
                  ? "bg-emerald-900/20 border-emerald-700/40"
                  : "bg-slate-800/50 hover:bg-slate-800/70"
              }`}
              onClick={() => {
                if (s.label === "Screened") setActiveTab("screened");
              }}
            >
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sourcing Agents Panel */}
        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Sourcing Agents
              <span className="text-xs text-slate-500 font-normal ml-1">— operator visibility</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(agentStatsQ.data ?? [
                { agent: "GCC Signals", total: 0, promoted: 0, screened: 0, ignored: 0, hitRate: 0, lastRun: null },
                { agent: "Public Filings", total: 0, promoted: 0, screened: 0, ignored: 0, hitRate: 0, lastRun: null },
                { agent: "Founder Network", total: 0, promoted: 0, screened: 0, ignored: 0, hitRate: 0, lastRun: null },
                { agent: "Pattern Match", total: 0, promoted: 0, screened: 0, ignored: 0, hitRate: 0, lastRun: null },
              ]).map((a) => (
                <div key={a.agent} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{a.agent}</span>
                    <span className={`text-xs font-mono font-bold ${
                      a.hitRate >= 50 ? "text-emerald-400" : a.hitRate >= 25 ? "text-amber-400" : "text-slate-500"
                    }`}>{a.hitRate}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        a.hitRate >= 50 ? "bg-emerald-500" : a.hitRate >= 25 ? "bg-amber-500" : "bg-slate-600"
                      }`}
                      style={{ width: `${Math.min(a.hitRate, 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-slate-500">Generated</span>
                    <span className="text-slate-300 font-mono text-right">{a.total}</span>
                    <span className="text-slate-500">Promoted</span>
                    <span className="text-amber-400 font-mono text-right">{a.promoted}</span>
                    <span className="text-slate-500">Screened</span>
                    <span className="text-emerald-400 font-mono text-right">{a.screened}</span>
                    <span className="text-slate-500">Ignored</span>
                    <span className="text-red-400 font-mono text-right">{a.ignored}</span>
                  </div>
                  {a.lastRun && (
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {relativeTime(a.lastRun)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b border-slate-700/50">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "pipeline"
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setActiveTab("pipeline")}
          >
            Pipeline
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === "screened"
                ? "border-emerald-500 text-emerald-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
            onClick={() => setActiveTab("screened")}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Screened Leads
            {screenedQ.data && screenedQ.data.total > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                activeTab === "screened" ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-700 text-slate-400"
              }`}>
                {screenedQ.data.total}
              </span>
            )}
          </button>
        </div>

        {/* ── PIPELINE TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "pipeline" && (
          <>
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

                  {/* Auto-promote threshold control */}
                  <div className="flex items-center gap-1.5 h-8 bg-slate-900/60 border border-slate-600 rounded-md px-2.5">
                    <span className="text-xs text-slate-400 whitespace-nowrap">Auto-promote</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={promoteThreshold}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                        setPromoteThreshold(isNaN(v) ? 60 : v);
                      }}
                      className="w-10 text-xs font-mono text-amber-300 bg-transparent border-none outline-none text-center"
                    />
                    <span className="text-xs text-slate-500">+</span>
                  </div>
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

            {/* Clear Ignored button */}
            {stats.ignored > 0 && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-3 text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 border border-slate-700/40 hover:border-red-700/40"
                  onClick={handleClearIgnored}
                  disabled={clearIgnoredMut.isPending}
                >
                  {clearIgnoredMut.isPending
                    ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    : <EyeOff className="w-3 h-3 mr-1.5" />
                  }
                  Clear Ignored ({stats.ignored})
                </Button>
              </div>
            )}

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
                  onReTriageLead={(id) => {
                    setReTriageLeadId(id);
                    reTriageLeadMut.mutate({ id, autoPromoteThreshold: promoteThreshold });
                  }}
                  triageLoading={triagingId === lead.id}
                  promoteLoading={promotingId === lead.id}
                  ignoreLoading={ignoringId === lead.id}
                  reTriageLeadLoading={reTriageLeadId === lead.id && reTriageLeadMut.isPending}
                />
              ))}
            </div>
          </>
        )}

        {/* ── SCREENED LEADS TAB ────────────────────────────────────────────────── */}
        {activeTab === "screened" && (
          <>
            {/* Verdict breakdown strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: "Approved", value: screenedStats.approved, color: "text-emerald-400", verdict: "APPROVED" as VerdictFilter },
                { label: "With Conditions", value: screenedStats.approvedWithConditions, color: "text-teal-400", verdict: "APPROVED_WITH_CONDITIONS" as VerdictFilter },
                { label: "Rejected", value: screenedStats.rejected, color: "text-red-400", verdict: "REJECTED" as VerdictFilter },
                { label: "Vetoed", value: screenedStats.vetoed, color: "text-red-300", verdict: "VETOED" as VerdictFilter },
                { label: "Insufficient Data", value: screenedStats.insufficientData, color: "text-slate-400", verdict: "INSUFFICIENT_DATA" as VerdictFilter },
              ].map((s) => (
                <Card
                  key={s.label}
                  className={`border-slate-700/50 cursor-pointer transition-colors ${
                    screenedVerdictFilter === s.verdict
                      ? "bg-slate-700/60 border-slate-500/60"
                      : "bg-slate-800/50 hover:bg-slate-800/70"
                  }`}
                  onClick={() => setScreenedVerdictFilter(screenedVerdictFilter === s.verdict ? "all" : s.verdict)}
                >
                  <CardContent className="p-3 text-center">
                    <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Screened filters */}
            <Card className="bg-slate-800/40 border-slate-700/50">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {screenedVerdictFilter !== "all" && (
                    <Badge className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 ml-1">
                      {screenedVerdictFilter.replace(/_/g, " ")}
                      <button
                        className="ml-1 text-slate-400 hover:text-slate-200"
                        onClick={() => setScreenedVerdictFilter("all")}
                      >×</button>
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  <Select value={screenedVerdictFilter} onValueChange={(v) => setScreenedVerdictFilter(v as VerdictFilter)}>
                    <SelectTrigger className="h-8 w-48 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                      <SelectValue placeholder="Verdict" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem value="all" className="text-xs">All Verdicts</SelectItem>
                      <SelectItem value="APPROVED" className="text-xs">Approved</SelectItem>
                      <SelectItem value="APPROVED_WITH_CONDITIONS" className="text-xs">Approved with Conditions</SelectItem>
                      <SelectItem value="REJECTED" className="text-xs">Rejected</SelectItem>
                      <SelectItem value="VETOED" className="text-xs">Vetoed</SelectItem>
                      <SelectItem value="INSUFFICIENT_DATA" className="text-xs">Insufficient Data</SelectItem>
                    </SelectContent>
                  </Select>

                  {screenedSectors.length > 0 && (
                    <Select value={screenedSectorFilter} onValueChange={setScreenedSectorFilter}>
                      <SelectTrigger className="h-8 w-44 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                        <SelectValue placeholder="Sector" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                        <SelectItem value="all" className="text-xs">All Sectors</SelectItem>
                        {screenedSectors.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {screenedRegions.length > 0 && (
                    <Select value={screenedRegionFilter} onValueChange={setScreenedRegionFilter}>
                      <SelectTrigger className="h-8 w-40 text-xs bg-slate-900/60 border-slate-600 text-slate-300">
                        <SelectValue placeholder="Region" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                        <SelectItem value="all" className="text-xs">All Regions</SelectItem>
                        {screenedRegions.map((r) => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Export CSV button */}
            {screenedLeads.length > 0 && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/30"
                  onClick={() => {
                    exportScreenedLeadsCSV(screenedLeads);
                    toast.success("CSV exported", {
                      description: `${screenedLeads.length} lead${screenedLeads.length !== 1 ? "s" : ""} exported to deal_sourcing_screened_leads_*.csv`,
                    });
                  }}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export CSV ({screenedLeads.length})
                </Button>
              </div>
            )}

            {/* Screened lead list */}
            <div className="space-y-2">
              {screenedQ.isLoading && (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading screened leads...
                </div>
              )}

              {!screenedQ.isLoading && screenedLeads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ShieldCheck className="w-8 h-8 text-slate-600 mb-3" />
                  <p className="text-slate-400 font-medium">No screened leads yet</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Promote leads through the pipeline and run the full council to see results here.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-800"
                    onClick={() => setActiveTab("pipeline")}
                  >
                    <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                    Go to Pipeline
                  </Button>
                </div>
              )}

              {screenedLeads.map((lead) => (
                <ScreenedLeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          </>
        )}

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
