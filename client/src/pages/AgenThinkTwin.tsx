/**
 * AgenThink Mesh Executive Decision Twin — Customer Zero Cockpit
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY: Two-layer protection:
 *   1. Client-side: useAuth({ redirectOnUnauthenticated: true, redirectPath: getLoginUrl("/twin/agenthink") })
 *   2. Server-side: enterprise.cockpitVerifyAccess — verifies active org membership, writes audit log.
 *
 * Panels: Company Overview | Decision Queue | Scenario Workspace |
 *         Council History | Outcome Ledger | Audit Log | Reports
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Database, Activity, Target, Play, BarChart3, Shield, FileText,
  Lock, Loader2, ChevronRight, Zap, BookOpen, History, Users,
  Edit3, Download, RefreshCw, Award, ThumbsUp, ThumbsDown, HelpCircle,
  Plus, X, ChevronDown, ChevronUp, Gavel, BarChart2,
} from "lucide-react";

const AGENTHINK_BLUEPRINT_ID = "bp-agenthink";

// ── Shared Badges ─────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    HIGH: "bg-red-500/20 text-red-400 border-red-500/30",
    MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[priority] ?? map.LOW}`}>{priority}</span>;
}

function DecisionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_COUNCIL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    UNDER_REVIEW: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    APPROVED: "bg-green-500/20 text-green-400 border-green-500/30",
    REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
    DEFERRED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };
  const label: Record<string, string> = {
    PENDING_COUNCIL: "Pending Council", UNDER_REVIEW: "Under Review",
    APPROVED: "Approved", REJECTED: "Rejected", DEFERRED: "Deferred",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>{label[status] ?? status}</span>;
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-green-500/20 text-green-400 border-green-500/30",
    APPROVED_WITH_CONDITIONS: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[verdict] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>{verdict.replace(/_/g, " ")}</span>;
}

// ── Company Overview Panel ────────────────────────────────────────────────────
function CompanyOverviewPanel({ org, twin, sessionCount }: {
  org: { name: string; slug: string; status: string; plan: string } | null;
  twin: { displayName: string; blueprintId: string; status: string } | null;
  sessionCount: number;
}) {
  const kpisQuery = trpc.enterprise.cockpitGetOperatingKpis.useQuery({}, { retry: false });
  const updateKpi = trpc.enterprise.cockpitUpdateOperatingKpi.useMutation({ onSuccess: () => kpisQuery.refetch() });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const grouped = (kpisQuery.data ?? []).reduce<Record<string, typeof kpisQuery.data>>((acc, k) => {
    if (!acc[k.section]) acc[k.section] = [];
    acc[k.section]!.push(k);
    return acc;
  }, {});

  const sectionColors: Record<string, string> = {
    Commercial: "text-green-400", Platform: "text-blue-400",
    Engineering: "text-purple-400", "Customer Activation": "text-amber-400",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/40 border-slate-700/50"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-blue-400" /><span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Organisation</span></div>
          <p className="text-sm font-semibold text-white">{org?.name ?? "AgenThinkMesh"}</p>
          <p className="text-xs text-slate-500 mt-0.5">Plan: {org?.plan ?? "—"} · Status: {org?.status ?? "—"}</p>
        </CardContent></Card>
        <Card className="bg-slate-800/40 border-slate-700/50"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2"><Zap className="h-4 w-4 text-purple-400" /><span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Active Twin</span></div>
          <p className="text-sm font-semibold text-white">{twin?.displayName ?? "Executive Decision Twin"}</p>
          <p className="text-xs text-slate-500 mt-0.5">Blueprint: {twin?.blueprintId ?? AGENTHINK_BLUEPRINT_ID} · {twin?.status ?? "active"}</p>
        </CardContent></Card>
        <Card className="bg-slate-800/40 border-slate-700/50"><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-green-400" /><span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Council Sessions</span></div>
          <p className="text-2xl font-bold text-white">{sessionCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total sessions run</p>
        </CardContent></Card>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Operating KPIs</h3>
          <span className="text-xs text-slate-500">— click a value to update</span>
          {kpisQuery.isLoading && <Loader2 className="h-3 w-3 text-slate-500 animate-spin" />}
        </div>
        {kpisQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-800/40 border border-slate-700/50 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([section, items]) => (
              <div key={section}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${sectionColors[section] ?? "text-slate-400"}`}>{section}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(items ?? []).map((kpi) => (
                    <div key={kpi.id} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">{kpi.label}</p>
                          {editingId === kpi.id ? (
                            <div className="flex items-center gap-1 mt-1">
                              <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-6 text-xs bg-slate-700 border-slate-600 text-white px-1.5 py-0" />
                              <button onClick={() => { updateKpi.mutate({ id: kpi.id, value: editValue }); setEditingId(null); }} className="text-green-400 hover:text-green-300"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-400"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-white">{kpi.value ?? <span className="text-slate-600 text-xs italic">Not connected</span>}</p>
                              {kpi.unit && <span className="text-xs text-slate-500">{kpi.unit}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {kpi.verificationStatus === "live" && <span className="text-[10px] px-1 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-800/50">Live</span>}
                          {kpi.verificationStatus === "manual" && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-900/60 text-blue-400 border border-blue-800/50">Manual</span>}
                          {kpi.verificationStatus === "unverified" && <span className="text-[10px] px-1 py-0.5 rounded bg-slate-800/60 text-slate-500 border border-slate-700/50">—</span>}
                          <button onClick={() => { setEditingId(kpi.id); setEditValue(kpi.value ?? ""); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity">
                            <Edit3 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {kpi.source && <p className="text-[10px] text-slate-600 mt-1 truncate">{kpi.source}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Decision Edit Modal ───────────────────────────────────────────────────────
type DbDecision = {
  id: number; orgId: number; decisionRef: string; title: string; decisionType: string;
  priority: "HIGH" | "MEDIUM" | "LOW"; status: "PENDING_COUNCIL" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DEFERRED";
  context: string | null; assumptions: string | null; owner: string; urgency: string;
  kpiImpact: string; submittedBy: string; outcomeAction: string | null; outcomeDate: string | null;
  outcomeConfidence: number | null; createdAt: Date; updatedAt: Date;
};

function DecisionEditModal({ decision, open, onClose, onSaved }: {
  decision: DbDecision | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(decision?.title ?? "");
  const [context, setContext] = useState(decision?.context ?? "");
  const [assumptions, setAssumptions] = useState(decision?.assumptions ?? "");
  const [owner, setOwner] = useState(decision?.owner ?? "");
  const [urgency, setUrgency] = useState(decision?.urgency ?? "normal");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">(decision?.priority ?? "MEDIUM");

  const saveDecision = trpc.enterprise.cockpitSaveDecision.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  const handleSave = () => {
    if (!decision) return;
    saveDecision.mutate({ id: decision.id, decisionRef: decision.decisionRef, title, context, assumptions, owner, urgency, priority });
  };

  if (!decision) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
        <DialogHeader><DialogTitle className="text-sm font-semibold">Edit Decision — {decision.decisionRef}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label className="text-xs text-slate-400">Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-white text-sm" /></div>
          <div><Label className="text-xs text-slate-400">Context</Label><Textarea value={context} onChange={e => setContext(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-white text-xs min-h-[80px]" /></div>
          <div><Label className="text-xs text-slate-400">Assumptions</Label><Textarea value={assumptions} onChange={e => setAssumptions(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-white text-xs min-h-[60px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-slate-400">Owner</Label><Input value={owner} onChange={e => setOwner(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-white text-sm" /></div>
            <div><Label className="text-xs text-slate-400">Urgency</Label>
              <select value={urgency} onChange={e => setUrgency(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-2 py-1.5">
                <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div><Label className="text-xs text-slate-400">Priority</Label>
            <div className="flex gap-2 mt-1">
              {(["HIGH", "MEDIUM", "LOW"] as const).map(p => (
                <button key={p} onClick={() => setPriority(p)} className={`px-3 py-1 rounded text-xs border font-medium transition-colors ${priority === p ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-slate-600 text-slate-400">Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saveDecision.isPending} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
            {saveDecision.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Council Result Panel ──────────────────────────────────────────────────────
type CouncilResult = {
  agents: Array<{ id: string; name: string; icon: string; vote: "APPROVE" | "CONDITIONAL" | "REJECT"; confidence: number; headline: string; rationale: string; key_condition: string; risk: string; error?: string | null }>;
  judge: { final_verdict: string; confidence: number; synthesis: string; the_bet: string; conditions: string[]; dissent: string; required_evidence: string };
  tally: { approve: number; conditional: number; reject: number };
  runAt: string;
};

function CouncilResultView({ result }: { result: CouncilResult }) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const total = result.tally.approve + result.tally.conditional + result.tally.reject;
  const verdictColor = result.judge.final_verdict === "APPROVED" ? "text-green-400 border-green-500/30 bg-green-500/10" : result.judge.final_verdict === "REJECTED" ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10";

  return (
    <div className="space-y-4 mt-4">
      {/* Tally */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-2xl font-bold text-green-400">{result.tally.approve}</p>
          <p className="text-xs text-green-400/70 mt-0.5">Approve</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-2xl font-bold text-amber-400">{result.tally.conditional}</p>
          <p className="text-xs text-amber-400/70 mt-0.5">Conditional</p>
        </div>
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-2xl font-bold text-red-400">{result.tally.reject}</p>
          <p className="text-xs text-red-400/70 mt-0.5">Reject</p>
        </div>
      </div>

      {/* Vote bar */}
      <div className="h-2 rounded-full overflow-hidden flex">
        <div className="bg-green-500 transition-all" style={{ width: `${(result.tally.approve / total) * 100}%` }} />
        <div className="bg-amber-500 transition-all" style={{ width: `${(result.tally.conditional / total) * 100}%` }} />
        <div className="bg-red-500 transition-all" style={{ width: `${(result.tally.reject / total) * 100}%` }} />
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {result.agents.map((agent) => {
          const voteColor = agent.vote === "APPROVE" ? "text-green-400 border-green-500/30" : agent.vote === "REJECT" ? "text-red-400 border-red-500/30" : "text-amber-400 border-amber-500/30";
          const isExpanded = expandedAgent === agent.id;
          return (
            <div key={agent.id} className={`p-3 rounded-lg bg-slate-800/30 border border-slate-700/40 cursor-pointer hover:bg-slate-800/50 transition-colors`} onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base">{agent.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{agent.name}</p>
                    <p className="text-xs text-slate-400 line-clamp-1">{agent.headline}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-xs font-semibold border px-1.5 py-0.5 rounded ${voteColor}`}>{agent.vote}</span>
                  <span className="text-xs text-slate-500">{agent.confidence}%</span>
                  {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-slate-700/50 pt-2">
                  <p className="text-xs text-slate-300">{agent.rationale}</p>
                  {agent.key_condition && <p className="text-xs text-amber-400/80"><span className="font-medium">Condition:</span> {agent.key_condition}</p>}
                  <p className="text-xs text-red-400/80"><span className="font-medium">Risk:</span> {agent.risk}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Judge verdict */}
      <div className={`p-4 rounded-lg border ${verdictColor}`}>
        <div className="flex items-center gap-2 mb-3">
          <Gavel className="h-4 w-4" />
          <span className="text-sm font-semibold">Judge's Verdict</span>
          <VerdictBadge verdict={result.judge.final_verdict} />
          <span className="text-xs text-slate-400 ml-auto">{result.judge.confidence}% confidence</span>
        </div>
        <p className="text-xs font-medium text-white mb-1">The Bet</p>
        <p className="text-sm text-slate-200 mb-3 italic">"{result.judge.the_bet}"</p>
        <p className="text-xs text-slate-300 mb-3">{result.judge.synthesis}</p>
        {result.judge.conditions.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-amber-400 mb-1">Conditions</p>
            <ul className="space-y-1">{result.judge.conditions.map((c, i) => <li key={i} className="text-xs text-slate-300 flex gap-1.5"><span className="text-amber-400 flex-shrink-0">→</span>{c}</li>)}</ul>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><p className="text-xs font-medium text-red-400 mb-1">Dissent</p><p className="text-xs text-slate-400">{result.judge.dissent}</p></div>
          <div><p className="text-xs font-medium text-blue-400 mb-1">Required Evidence</p><p className="text-xs text-slate-400">{result.judge.required_evidence}</p></div>
        </div>
        <p className="text-[10px] text-slate-600 mt-3">Council run at {new Date(result.runAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

// ── Outcome Record Modal ──────────────────────────────────────────────────────
function OutcomeModal({ decision, open, onClose, onSaved }: {
  decision: DbDecision | null; open: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [action, setAction] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [confidence, setConfidence] = useState(75);
  const [status, setStatus] = useState<"APPROVED" | "REJECTED" | "DEFERRED">("APPROVED");

  const recordOutcome = trpc.enterprise.cockpitRecordOutcome.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  if (!decision) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader><DialogTitle className="text-sm font-semibold">Record Outcome — {decision.decisionRef}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label className="text-xs text-slate-400">Decision</Label><p className="text-xs text-slate-300 mt-1">{decision.title}</p></div>
          <div><Label className="text-xs text-slate-400">Final Status</Label>
            <div className="flex gap-2 mt-1">
              {(["APPROVED", "REJECTED", "DEFERRED"] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1 rounded text-xs border font-medium transition-colors ${status === s ? (s === "APPROVED" ? "bg-green-600 border-green-500 text-white" : s === "REJECTED" ? "bg-red-600 border-red-500 text-white" : "bg-slate-600 border-slate-500 text-white") : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs text-slate-400">Action Taken / Decision Made</Label><Textarea value={action} onChange={e => setAction(e.target.value)} placeholder="Describe the specific action or decision..." className="mt-1 bg-slate-800 border-slate-600 text-white text-xs min-h-[70px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-slate-400">Outcome Measurement Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 bg-slate-800 border-slate-600 text-white text-sm" /></div>
            <div><Label className="text-xs text-slate-400">Confidence — {confidence}%</Label>
              <div className="mt-2"><Slider value={[confidence]} onValueChange={([v]) => setConfidence(v)} min={0} max={100} step={5} className="w-full" /></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs border-slate-600 text-slate-400">Cancel</Button>
          <Button size="sm" onClick={() => recordOutcome.mutate({ decisionId: decision.id, outcomeAction: action, outcomeDate: date, outcomeConfidence: confidence, status })} disabled={!action || recordOutcome.isPending} className="text-xs bg-green-600 hover:bg-green-700 text-white">
            {recordOutcome.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Record Outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Decision Queue Panel ──────────────────────────────────────────────────────
function DecisionQueuePanel({ onSwitchToCouncil }: { onSwitchToCouncil: (decisionId: number) => void }) {
  const decisionsQuery = trpc.enterprise.cockpitGetDecisions.useQuery({}, { retry: false });
  const decisions = decisionsQuery.data ?? [];
  const [selected, setSelected] = useState<number | null>(null);
  const [editDecision, setEditDecision] = useState<DbDecision | null>(null);
  const [outcomeDecision, setOutcomeDecision] = useState<DbDecision | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newType, setNewType] = useState("STRATEGIC");

  const saveDecision = trpc.enterprise.cockpitSaveDecision.useMutation({ onSuccess: () => { decisionsQuery.refetch(); setShowNewForm(false); setNewTitle(""); setNewContext(""); } });
  const selectedDecision = decisions.find(d => d.id === selected);

  const pendingCount = decisions.filter(d => d.status === "PENDING_COUNCIL").length;
  const highCount = decisions.filter(d => d.priority === "HIGH").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{pendingCount} pending council review · {highCount} high priority</p>
        <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:bg-slate-800" onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="h-3 w-3 mr-1" />Add Decision
        </Button>
      </div>

      {showNewForm && (
        <Card className="bg-slate-800/40 border-blue-500/30">
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-medium text-blue-400">New Decision</p>
            <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Decision title..." className="bg-slate-700 border-slate-600 text-white text-sm" />
            <Textarea value={newContext} onChange={e => setNewContext(e.target.value)} placeholder="Context and background..." className="bg-slate-700 border-slate-600 text-white text-xs min-h-[60px]" />
            <div className="flex gap-2">
              <select value={newType} onChange={e => setNewType(e.target.value)} className="bg-slate-700 border border-slate-600 text-white text-xs rounded px-2 py-1.5 flex-1">
                {["STRATEGIC","COMMERCIAL","HIRING","PRODUCT","OPERATIONAL"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button size="sm" onClick={() => saveDecision.mutate({ decisionRef: `d-${Date.now().toString(36)}`, title: newTitle, context: newContext, decisionType: newType, priority: "MEDIUM", status: "PENDING_COUNCIL" })} disabled={!newTitle || saveDecision.isPending} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
                {saveDecision.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewForm(false)} className="text-xs border-slate-600 text-slate-400">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {decisionsQuery.isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-800/40 border border-slate-700/50 animate-pulse" />)}</div>
      ) : decisions.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No decisions in queue. Add one above.</div>
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => (
            <div key={d.id} onClick={() => setSelected(selected === d.id ? null : d.id)} className={`p-4 rounded-lg border cursor-pointer transition-colors ${selected === d.id ? "bg-blue-500/10 border-blue-500/40" : "bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-white">{d.title}</span>
                    <PriorityBadge priority={d.priority} />
                    <DecisionStatusBadge status={d.status} />
                    <span className="text-xs text-slate-600">{d.decisionType}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{d.context}</p>
                  <p className="text-xs text-slate-600 mt-1">Owner: {d.owner || d.submittedBy} · {new Date(d.createdAt).toLocaleDateString()}</p>
                </div>
                <ChevronRight className={`h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5 transition-transform ${selected === d.id ? "rotate-90" : ""}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDecision && (
        <Card className="bg-slate-800/40 border-blue-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm text-white">{selectedDecision.title}</CardTitle>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 h-7 px-2" onClick={() => setEditDecision(selectedDecision as DbDecision)}>
                  <Edit3 className="h-3 w-3 mr-1" />Edit
                </Button>
                <Button size="sm" variant="outline" className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 h-7 px-2" onClick={() => setOutcomeDecision(selectedDecision as DbDecision)}>
                  <Award className="h-3 w-3 mr-1" />Record Outcome
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-300">{selectedDecision.context}</p>
            {selectedDecision.assumptions && (
              <div><p className="text-xs text-slate-500 mb-1">Assumptions:</p><p className="text-xs text-slate-400 italic">{selectedDecision.assumptions}</p></div>
            )}
            {selectedDecision.kpiImpact && selectedDecision.kpiImpact !== "[]" && (
              <div>
                <p className="text-xs text-slate-500 mb-1">KPI Impact:</p>
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(selectedDecision.kpiImpact).map((k: string) => <span key={k} className="px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50">{k}</span>)}
                </div>
              </div>
            )}
            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => onSwitchToCouncil(selectedDecision.id)}>
              <Play className="h-3.5 w-3.5 mr-1.5" />Run Through Executive Council
            </Button>
          </CardContent>
        </Card>
      )}

      <DecisionEditModal decision={editDecision} open={!!editDecision} onClose={() => setEditDecision(null)} onSaved={() => decisionsQuery.refetch()} />
      <OutcomeModal decision={outcomeDecision} open={!!outcomeDecision} onClose={() => setOutcomeDecision(null)} onSaved={() => decisionsQuery.refetch()} />
    </div>
  );
}

// ── Scenario Workspace Panel ──────────────────────────────────────────────────
const DEFAULT_WEIGHTS = { relationshipStrength: 8, probabilityOfMeeting: 7, timeToPilot: 6, regulatoryComplexity: 5, dataAccessComplexity: 5, implementationEffort: 5, contractValue: 8, referenceValue: 7, expansionPotential: 9 };
const WEIGHT_LABELS: Record<string, string> = {
  relationshipStrength: "Relationship Strength", probabilityOfMeeting: "Probability of Meeting",
  timeToPilot: "Time to Pilot", regulatoryComplexity: "Regulatory Complexity",
  dataAccessComplexity: "Data Access Complexity", implementationEffort: "Implementation Effort",
  contractValue: "Contract Value", referenceValue: "Reference Value", expansionPotential: "Expansion Potential",
};
const INVERTED_WEIGHTS = ["regulatoryComplexity", "dataAccessComplexity", "implementationEffort", "timeToPilot"];

function ScenarioWorkspacePanel({ preselectedDecisionId }: { preselectedDecisionId: number | null }) {
  const decisionsQuery = trpc.enterprise.cockpitGetDecisions.useQuery({}, { retry: false });
  const decisions = decisionsQuery.data ?? [];
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(preselectedDecisionId);
  const [scenarioName, setScenarioName] = useState("Fastest Revenue");
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [result, setResult] = useState<any>(null);
  const [pastResults, setPastResults] = useState<any[]>([]);

  const runScenario = trpc.enterprise.cockpitRunScenario.useMutation({
    onSuccess: (data) => { setResult(data); setPastResults(prev => [data, ...prev].slice(0, 5)); },
  });

  const pastQuery = trpc.enterprise.cockpitGetScenarioResults.useQuery(
    { decisionId: selectedDecisionId! },
    { enabled: !!selectedDecisionId, retry: false }
  );

  const handleRun = () => {
    if (!selectedDecisionId) return;
    runScenario.mutate({ decisionId: selectedDecisionId, scenarioName, weights });
  };

  const displayResult = result ?? (pastQuery.data?.[0] ? { ...pastQuery.data[0], rankings: pastQuery.data[0].rankings, scenarioName: pastQuery.data[0].scenarioName } : null);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Config panel */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-400">Link to Decision</Label>
            <select value={selectedDecisionId ?? ""} onChange={e => setSelectedDecisionId(Number(e.target.value) || null)} className="mt-1 w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-2 py-1.5">
              <option value="">— Select a decision —</option>
              {decisions.map(d => <option key={d.id} value={d.id}>{d.decisionRef}: {d.title.slice(0, 50)}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Scenario Name</Label>
            <div className="flex gap-2 mt-1">
              {["Fastest Revenue", "Highest Contract Value", "Strongest Reference"].map(n => (
                <button key={n} onClick={() => setScenarioName(n)} className={`px-2 py-1 rounded text-xs border transition-colors ${scenarioName === n ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">Scoring Weights <span className="text-slate-600">(1–10)</span></p>
            <div className="space-y-3">
              {Object.entries(weights).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-44 flex-shrink-0">{WEIGHT_LABELS[key]}</span>
                  <Slider value={[val]} onValueChange={([v]) => setWeights(prev => ({ ...prev, [key]: v }))} min={1} max={10} step={1} className="flex-1" />
                  <span className={`text-xs font-medium w-6 text-right ${INVERTED_WEIGHTS.includes(key) ? "text-red-400" : "text-green-400"}`}>{val}</span>
                  {INVERTED_WEIGHTS.includes(key) && <span className="text-[10px] text-red-400/60">↓</span>}
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleRun} disabled={!selectedDecisionId || runScenario.isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
            {runScenario.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Running Scenario…</> : <><Play className="h-3.5 w-3.5 mr-1.5" />Run Scenario</>}
          </Button>
        </div>

        {/* Results panel */}
        <div>
          {displayResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-400" />
                <p className="text-sm font-semibold text-white">Results — {displayResult.scenarioName}</p>
              </div>
              <div className="space-y-2">
                {displayResult.rankings.map((r: any, i: number) => (
                  <div key={r.name} className={`p-3 rounded-lg border ${i === 0 ? "bg-blue-500/10 border-blue-500/30" : "bg-slate-800/30 border-slate-700/40"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 ${i === 0 ? "text-blue-400" : "text-slate-500"}`}>#{i + 1}</span>
                        <span className="text-sm font-medium text-white">{r.name}</span>
                        {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-500/30">Top Pick</span>}
                      </div>
                      <span className={`text-sm font-bold ${i === 0 ? "text-blue-400" : "text-slate-300"}`}>{r.weightedScore}/10</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${i === 0 ? "bg-blue-500" : "bg-slate-500"}`} style={{ width: `${(r.weightedScore / 10) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {displayResult.recommendation && (
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
                  <p className="text-xs text-slate-400 mb-1">Recommendation</p>
                  <p className="text-xs text-slate-200">{displayResult.recommendation}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
              <BarChart3 className="h-8 w-8 mb-2" />
              <p className="text-sm">Select a decision and run a scenario</p>
            </div>
          )}
        </div>
      </div>

      {/* Past results */}
      {pastQuery.data && pastQuery.data.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Previous Scenario Runs</p>
          <div className="space-y-1">
            {pastQuery.data.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 rounded bg-slate-800/20 border border-slate-700/30 text-xs">
                <span className="text-slate-300">{r.scenarioName}</span>
                <span className="text-slate-500">{new Date(r.runAt).toLocaleDateString()}</span>
                <span className="text-blue-400">{r.rankings[0]?.name} #{1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Council Execution Panel ───────────────────────────────────────────────────
function CouncilExecutionPanel({ preselectedDecisionId }: { preselectedDecisionId: number | null }) {
  const decisionsQuery = trpc.enterprise.cockpitGetDecisions.useQuery({}, { retry: false });
  const decisions = decisionsQuery.data ?? [];
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | null>(preselectedDecisionId);
  const [councilResult, setCouncilResult] = useState<CouncilResult | null>(null);

  const selectedDecision = decisions.find(d => d.id === selectedDecisionId);

  const runCouncil = trpc.enterprise.cockpitRunCouncil.useMutation({
    onSuccess: (data) => setCouncilResult(data as CouncilResult),
  });

  const pastResultsQuery = trpc.enterprise.cockpitGetCouncilResults.useQuery(
    { decisionId: selectedDecisionId! },
    { enabled: !!selectedDecisionId, retry: false }
  );

  const handleRun = () => {
    if (!selectedDecision) return;
    setCouncilResult(null);
    runCouncil.mutate({
      decisionId: selectedDecision.id,
      decisionRef: selectedDecision.decisionRef,
      decisionTitle: selectedDecision.title,
      decisionContext: selectedDecision.context ?? "",
      assumptions: selectedDecision.assumptions ?? "",
    });
  };

  const displayResult = councilResult ?? (pastResultsQuery.data?.[0] ? { agents: pastResultsQuery.data[0].agents, judge: pastResultsQuery.data[0].judge, tally: { approve: pastResultsQuery.data[0].tallyApprove, conditional: pastResultsQuery.data[0].tallyConditional, reject: pastResultsQuery.data[0].tallyReject }, runAt: pastResultsQuery.data[0].runAt.toString() } : null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-slate-400">Select Decision for Council</Label>
          <select value={selectedDecisionId ?? ""} onChange={e => { setSelectedDecisionId(Number(e.target.value) || null); setCouncilResult(null); }} className="mt-1 w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-2 py-1.5">
            <option value="">— Select a decision —</option>
            {decisions.map(d => <option key={d.id} value={d.id}>{d.decisionRef}: {d.title.slice(0, 50)}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleRun} disabled={!selectedDecision || runCouncil.isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
            {runCouncil.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Running 8-Agent Council…</> : <><Gavel className="h-3.5 w-3.5 mr-1.5" />Run Executive Council</>}
          </Button>
        </div>
      </div>

      {selectedDecision && (
        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
          <p className="text-xs text-slate-400 mb-1">Decision Brief</p>
          <p className="text-sm font-medium text-white">{selectedDecision.title}</p>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{selectedDecision.context}</p>
        </div>
      )}

      {runCouncil.isPending && (
        <div className="p-6 rounded-lg bg-slate-800/30 border border-slate-700/40 text-center">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-white font-medium">Executive Council in session…</p>
          <p className="text-xs text-slate-400 mt-1">8 agents deliberating · Judge synthesising verdict</p>
          <div className="flex justify-center gap-2 mt-3">
            {["🎯 CEO", "💰 CFO", "⚙️ CTO", "🤝 CCO", "⚠️ Risk", "🧭 Strategy", "🔧 Ops", "🔥 Dissent"].map(a => (
              <span key={a} className="text-xs text-slate-500 animate-pulse">{a}</span>
            ))}
          </div>
        </div>
      )}

      {runCouncil.isError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          Council execution failed: {runCouncil.error.message}
        </div>
      )}

      {displayResult && !runCouncil.isPending && <CouncilResultView result={displayResult} />}

      {!displayResult && !runCouncil.isPending && !selectedDecision && (
        <div className="text-center py-12 text-slate-600">
          <Gavel className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Select a decision and run the Executive Council</p>
        </div>
      )}
    </div>
  );
}

// ── Council History Panel ─────────────────────────────────────────────────────
function CouncilHistoryPanel({ sessions, loading }: { sessions: Array<{ id: number; sessionType: string; status: string; startedAt: Date; durationMs?: number | null; tokensUsed: number }>; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/40 border border-slate-700/50 animate-pulse" />)}</div>;
  if (sessions.length === 0) return (
    <div className="text-center py-12">
      <History className="h-8 w-8 text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-500">No council sessions yet.</p>
      <p className="text-xs text-slate-600 mt-1">Run your first decision from the Decision Queue or Council Execution tab.</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${s.status === "completed" ? "bg-green-400" : s.status === "failed" ? "bg-red-400" : "bg-amber-400"}`} />
            <div><p className="text-xs font-medium text-white capitalize">{s.sessionType} session #{s.id}</p><p className="text-xs text-slate-500">{new Date(s.startedAt).toLocaleString()}</p></div>
          </div>
          <div className="text-right"><p className="text-xs text-slate-400">{s.durationMs ? `${(s.durationMs / 1000).toFixed(1)}s` : "—"}</p><p className="text-xs text-slate-600">{s.tokensUsed.toLocaleString()} tokens</p></div>
        </div>
      ))}
    </div>
  );
}

// ── Outcome Ledger Panel ──────────────────────────────────────────────────────
function OutcomeLedgerPanel({ outcomes, loading }: { outcomes: Array<{ id: number; dealId: string; councilMode: string; originalVerdict: string; outcomeStatus: string; decisionDate: number }>; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-800/40 border border-slate-700/50 animate-pulse" />)}</div>;
  if (outcomes.length === 0) return (
    <div className="text-center py-12">
      <BookOpen className="h-8 w-8 text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-500">Outcome Ledger is empty.</p>
      <p className="text-xs text-slate-600 mt-1">Record outcomes from the Decision Queue tab.</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {outcomes.map((o) => (
        <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
          <div><p className="text-xs font-medium text-white">{o.dealId}</p><p className="text-xs text-slate-500">{o.councilMode.toUpperCase()} · {new Date(o.decisionDate).toLocaleDateString()}</p></div>
          <div className="text-right"><p className="text-xs text-white">{o.originalVerdict}</p><p className={`text-xs ${o.outcomeStatus === "SUCCEEDED" ? "text-green-400" : o.outcomeStatus === "FAILED" ? "text-red-400" : "text-slate-400"}`}>{o.outcomeStatus}</p></div>
        </div>
      ))}
    </div>
  );
}

// ── Audit Log Panel ───────────────────────────────────────────────────────────
function AuditLogPanel({ entries, loading }: { entries: Array<{ id: number; action: string; resourceType: string; details?: string | null; severity: string; createdAt: Date }>; loading: boolean }) {
  if (loading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-800/40 border border-slate-700/50 animate-pulse" />)}</div>;
  if (entries.length === 0) return (
    <div className="text-center py-12"><Shield className="h-8 w-8 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No audit entries yet.</p></div>
  );
  return (
    <div className="space-y-1.5">
      {entries.map((e) => (
        <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/20 border border-slate-700/30">
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${e.severity === "critical" ? "bg-red-400" : e.severity === "warning" ? "bg-amber-400" : "bg-blue-400"}`} />
          <div className="flex-1 min-w-0"><p className="text-xs text-white font-medium">{e.action}</p>{e.details && <p className="text-xs text-slate-500 truncate">{e.details}</p>}</div>
          <p className="text-xs text-slate-600 flex-shrink-0">{new Date(e.createdAt).toLocaleTimeString()}</p>
        </div>
      ))}
    </div>
  );
}

// ── Reports Panel ─────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: "executive_decision" as const, title: "Executive Decision Report", desc: "Full decision analysis with Council result and action plan", icon: Gavel, color: "text-blue-400" },
  { id: "customer_prioritization" as const, title: "Customer Prioritization Report", desc: "Prospect ranking with selection rationale and risk assessment", icon: Target, color: "text-green-400" },
  { id: "board_summary" as const, title: "Board Summary", desc: "One-page company status, pipeline, and 30-day priorities", icon: BarChart3, color: "text-purple-400" },
  { id: "weekly_ops" as const, title: "Weekly Operating Review", desc: "Commercial, engineering, and Customer Zero progress", icon: Activity, color: "text-amber-400" },
  { id: "customer_zero_status" as const, title: "Customer Zero Status Report", desc: "Auth, cockpit, and activation status with next steps", icon: CheckCircle2, color: "text-teal-400" },
];

function ReportsPanel() {
  const decisionsQuery = trpc.enterprise.cockpitGetDecisions.useQuery({}, { retry: false });
  const [selectedDecisionId, setSelectedDecisionId] = useState<number | undefined>(undefined);
  const [generatedReports, setGeneratedReports] = useState<Record<string, { content: string; generatedAt: string }>>({});
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const generateReport = trpc.enterprise.cockpitGenerateReport.useMutation({
    onSuccess: (data) => {
      setGeneratedReports(prev => ({ ...prev, [data.reportType]: { content: data.content, generatedAt: data.generatedAt } }));
      setActiveReport(data.reportType);
      setLoadingReport(null);
    },
    onError: () => setLoadingReport(null),
  });

  const handleGenerate = (reportType: typeof REPORT_TYPES[0]["id"]) => {
    setLoadingReport(reportType);
    generateReport.mutate({ reportType, decisionId: selectedDecisionId });
  };

  const handleDownload = (reportType: string) => {
    const report = generatedReports[reportType];
    if (!report) return;
    const blob = new Blob([report.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${reportType}-${new Date().toISOString().split("T")[0]}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="text-xs text-slate-400">Link to Decision (optional)</Label>
          <select value={selectedDecisionId ?? ""} onChange={e => setSelectedDecisionId(Number(e.target.value) || undefined)} className="mt-1 w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-md px-2 py-1.5">
            <option value="">— No specific decision —</option>
            {(decisionsQuery.data ?? []).map(d => <option key={d.id} value={d.id}>{d.decisionRef}: {d.title.slice(0, 50)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.map((r) => {
          const generated = generatedReports[r.id];
          const isLoading = loadingReport === r.id;
          return (
            <div key={r.id} className={`p-3 rounded-lg border transition-colors ${activeReport === r.id ? "bg-blue-500/10 border-blue-500/30" : "bg-slate-800/30 border-slate-700/40"}`}>
              <div className="flex items-start gap-2 mb-2">
                <r.icon className={`h-4 w-4 ${r.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" onClick={() => handleGenerate(r.id)} disabled={isLoading} className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-white h-7">
                  {isLoading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating…</> : <><RefreshCw className="h-3 w-3 mr-1" />Generate</>}
                </Button>
                {generated && (
                  <Button size="sm" variant="outline" onClick={() => handleDownload(r.id)} className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 h-7 px-2">
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {generated && <p className="text-[10px] text-slate-600 mt-1">Generated {new Date(generated.generatedAt).toLocaleTimeString()}</p>}
            </div>
          );
        })}
      </div>

      {activeReport && generatedReports[activeReport] && (
        <Card className="bg-slate-800/40 border-slate-700/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-white">{REPORT_TYPES.find(r => r.id === activeReport)?.title}</CardTitle>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => handleDownload(activeReport)} className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 h-7 px-2">
                  <Download className="h-3 w-3 mr-1" />Download
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveReport(null)} className="text-xs border-slate-600 text-slate-400 hover:bg-slate-700 h-7 px-2">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">{generatedReports[activeReport].content}</pre>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-800 pt-4">
        {[
          { title: "Enterprise Org Dashboard", path: "/admin/customer-zero", icon: Database, color: "text-blue-400" },
          { title: "Outcome Batch Import", path: "/admin/outcome-batch-import", icon: BookOpen, color: "text-green-400" },
          { title: "Enterprise Admin", path: "/admin/enterprise", icon: Users, color: "text-purple-400" },
          { title: "Conglomerate Pilot Setup", path: "/enterprise/setup", icon: BarChart3, color: "text-amber-400" },
        ].map((r) => (
          <a key={r.path} href={r.path} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/40 hover:bg-slate-800/50 transition-colors">
            <r.icon className={`h-4 w-4 ${r.color}`} />
            <span className="text-sm text-white">{r.title}</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-500 ml-auto" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AgenThinkTwin() {
  const { user, loading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: getLoginUrl("/twin/agenthink"),
  });

  const accessQuery = trpc.enterprise.cockpitVerifyAccess.useQuery({}, { enabled: Boolean(user), retry: false });
  const sessionsQuery = trpc.enterprise.cockpitGetSessionHistory.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });
  const outcomesQuery = trpc.enterprise.cockpitGetOutcomeLedger.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });
  const auditQuery = trpc.enterprise.cockpitGetAuditLog.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });

  const [activeTab, setActiveTab] = useState("overview");
  const [councilDecisionId, setCouncilDecisionId] = useState<number | null>(null);
  const [scenarioDecisionId, setScenarioDecisionId] = useState<number | null>(null);
  // Must be called unconditionally (rules of hooks) — enabled only after access verified
  const decisionsQuery = trpc.enterprise.cockpitGetDecisions.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });

  const handleRunDecision = useCallback((decisionId: number) => {
    setCouncilDecisionId(decisionId);
    setActiveTab("council");
  }, []);

  if (authLoading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /><p className="text-sm text-slate-400">Verifying authentication…</p></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Lock className="h-8 w-8 text-slate-500" /><p className="text-sm text-slate-400">Redirecting to login…</p><a href={getLoginUrl("/twin/agenthink")} className="text-xs text-blue-400 hover:underline">Click here if not redirected</a></div>
    </div>
  );

  if (accessQuery.isLoading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /><p className="text-sm text-slate-400">Verifying organisation membership…</p></div>
    </div>
  );

  if (accessQuery.error) {
    const code = (accessQuery.error as any)?.data?.code;
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm font-semibold text-white">{code === "FORBIDDEN" ? "Access Denied" : code === "NOT_FOUND" ? "Organisation Not Found" : "Access Error"}</p>
          <p className="text-xs text-slate-400">{code === "FORBIDDEN" ? "You are not a member of the AgenThinkMesh organisation. Contact the platform administrator." : code === "NOT_FOUND" ? "The AgenThinkMesh organisation record was not found." : accessQuery.error.message}</p>
          <a href="/" className="text-xs text-blue-400 hover:underline">Return to home</a>
        </div>
      </div>
    );
  }

  const ctx = accessQuery.data!;
  const pendingCount = (decisionsQuery.data ?? []).filter(d => d.status === "PENDING_COUNCIL").length;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-[#0d1424]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30"><Brain className="h-4 w-4 text-blue-400" /></div>
            <div>
              <h1 className="text-sm font-semibold text-white">AgenThink Mesh — Customer Zero Executive Twin</h1>
              <p className="text-xs text-slate-400">Org: {ctx.org.name} · Twin: {ctx.twin?.displayName ?? "Executive Decision Twin"} · <span className="text-green-400">Customer Zero</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20"><CheckCircle2 className="h-3 w-3 text-green-400" /><span className="text-xs text-green-400">Verified</span></div>
            <span className="text-xs text-slate-500 hidden sm:block">{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
            <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-400 hover:bg-slate-800" onClick={() => window.open("/admin/customer-zero", "_blank")}>
              <Database className="h-3 w-3 mr-1.5" />Org Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Activity className="h-3.5 w-3.5 mr-1.5" />Company Overview</TabsTrigger>
            <TabsTrigger value="decisions" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Target className="h-3.5 w-3.5 mr-1.5" />Decision Queue{pendingCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">{pendingCount}</span>}</TabsTrigger>
            <TabsTrigger value="council" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Gavel className="h-3.5 w-3.5 mr-1.5" />Council Execution</TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Scenario Workspace</TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><History className="h-3.5 w-3.5 mr-1.5" />Council History{ctx.sessionCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-slate-600/50 text-slate-300">{ctx.sessionCount}</span>}</TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Outcome Ledger</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Shield className="h-3.5 w-3.5 mr-1.5" />Audit Log</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><FileText className="h-3.5 w-3.5 mr-1.5" />Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CompanyOverviewPanel org={ctx.org} twin={ctx.twin} sessionCount={ctx.sessionCount} />
          </TabsContent>
          <TabsContent value="decisions">
            <DecisionQueuePanel onSwitchToCouncil={handleRunDecision} />
          </TabsContent>
          <TabsContent value="council">
            <CouncilExecutionPanel preselectedDecisionId={councilDecisionId} />
          </TabsContent>
          <TabsContent value="scenarios">
            <ScenarioWorkspacePanel preselectedDecisionId={scenarioDecisionId} />
          </TabsContent>
          <TabsContent value="history">
            <CouncilHistoryPanel sessions={sessionsQuery.data ?? []} loading={sessionsQuery.isLoading} />
          </TabsContent>
          <TabsContent value="ledger">
            <OutcomeLedgerPanel outcomes={outcomesQuery.data ?? []} loading={outcomesQuery.isLoading} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogPanel entries={auditQuery.data ?? []} loading={auditQuery.isLoading} />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
