/**
 * AgenThink Mesh Executive Decision Twin — Customer Zero Cockpit
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY: Two-layer protection (no generic company defaults):
 *   1. Client-side: useAuth({ redirectOnUnauthenticated: true })
 *   2. Server-side: enterprise.cockpitVerifyAccess (enterpriseProcedure /
 *      orgMiddleware) — verifies active org membership, throws FORBIDDEN if
 *      not a member, writes audit log on every successful access.
 *

 * All KPI data sourced from live kpi_definitions table.
 *
 * Panels: Company Overview | Decision Queue | Scenario Workspace |
 *         Council History | Outcome Ledger | Audit Log | Reports
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Database, Activity, Target, Play, BarChart3, Shield, FileText,
  Lock, Loader2, ChevronRight, Zap, BookOpen, History, Users,
} from "lucide-react";

// ── AgenThink Customer Zero Blueprint ID (used for display + test assertions) ────
const AGENTHINK_BLUEPRINT_ID = "bp-agenthink";

// ── AgenThink-specific Decision Queue ────────────────────────────────────────────
const AGENTHINK_DECISIONS = [
  { id: "d-001", title: "Hire ML Infrastructure Engineer", type: "HIRING", priority: "HIGH", status: "PENDING_COUNCIL", submittedBy: "Farouq Sultan", submittedAt: "2026-07-28", context: "Scale GPU training pipeline for Jupiter Shot model series. RTX 5060 validation complete.", kpiImpact: ["Model Training Velocity", "Infrastructure Cost per Run"] },
  { id: "d-002", title: "Alghanim Pilot Pricing — Enterprise Tier", type: "COMMERCIAL", priority: "HIGH", status: "PENDING_COUNCIL", submittedBy: "Farouq Sultan", submittedAt: "2026-07-30", context: "Set pricing for the Alghanim conglomerate pilot. 3 twins, 12-month contract.", kpiImpact: ["ARR", "Gross Margin", "Customer Acquisition Cost"] },
  { id: "d-003", title: "Expand to Saudi Market — Entity Registration", type: "STRATEGIC", priority: "MEDIUM", status: "PENDING_COUNCIL", submittedBy: "Farouq Sultan", submittedAt: "2026-08-01", context: "SAMA fintech sandbox application and KSA entity registration for Vision 2030 alignment.", kpiImpact: ["TAM Coverage", "Regulatory Compliance Score"] },
  { id: "d-004", title: "Open-Source Council Engine v1", type: "PRODUCT", priority: "MEDIUM", status: "UNDER_REVIEW", submittedBy: "Farouq Sultan", submittedAt: "2026-08-02", context: "Release the Council Engine as open-source to drive developer adoption and community trust.", kpiImpact: ["Developer NPS", "Community Growth Rate"] },
];

const SCENARIO_TEMPLATES = [
  { id: "s-001", label: "Headcount vs. Contractor Trade-off", description: "Model the cost and velocity impact of hiring FTEs vs. contractors for ML infrastructure.", councilMode: "gcc", estimatedDuration: "4–6 min" },
  { id: "s-002", label: "Alghanim Pilot ROI Projection", description: "Project 12-month ROI for the Alghanim pilot under conservative, base, and optimistic scenarios.", councilMode: "gcc", estimatedDuration: "5–8 min" },
  { id: "s-003", label: "KSA Market Entry — Risk Assessment", description: "Assess regulatory, commercial, and operational risks of Saudi entity registration.", councilMode: "gcc", estimatedDuration: "6–9 min" },
];

// ── Badges ────────────────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = { HIGH: "bg-red-500/20 text-red-400 border-red-500/30", MEDIUM: "bg-amber-500/20 text-amber-400 border-amber-500/30", LOW: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[priority] ?? map.LOW}`}>{priority}</span>;
}

function DecisionStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { PENDING_COUNCIL: "bg-blue-500/20 text-blue-400 border-blue-500/30", UNDER_REVIEW: "bg-amber-500/20 text-amber-400 border-amber-500/30", APPROVED: "bg-green-500/20 text-green-400 border-green-500/30", REJECTED: "bg-red-500/20 text-red-400 border-red-500/30" };
  const label: Record<string, string> = { PENDING_COUNCIL: "Pending Council", UNDER_REVIEW: "Under Review", APPROVED: "Approved", REJECTED: "Rejected" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>{label[status] ?? status}</span>;
}

// ── Company Overview Panel ────────────────────────────────────────────────────
function CompanyOverviewPanel({ org, twin, sessionCount, kpis, kpisLoading }: {
  org: { name: string; slug: string; status: string; plan: string } | null;
  twin: { displayName: string; blueprintId: string; status: string; kpiSetId?: string | null } | null;
  sessionCount: number;
  kpis: Array<{ kpiId: string; name: string; label: string; unit?: string | null; category?: string | null; direction: string; verificationStatus?: string; source?: string | null }>;
  kpisLoading: boolean;
}) {
  const grouped = kpis.reduce<Record<string, typeof kpis>>((acc, k) => {
    const cat = k.category ?? "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(k);
    return acc;
  }, {});

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
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">KPI Definitions</h3>
          <span className="text-xs text-slate-500">— live from database</span>
          {kpisLoading && <Loader2 className="h-3 w-3 text-slate-500 animate-spin" />}
        </div>
        {kpisLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-800/40 border border-slate-700/50 animate-pulse" />)}
          </div>
        ) : kpis.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No KPI definitions found. Seed the registry or assign a kpiSetId to the twin instance.</div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">{category}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((kpi) => (
                  <div key={kpi.kpiId} className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/30 border border-slate-700/40">
                    <div className="mt-0.5">{kpi.direction === "higher" ? <TrendingUp className="h-3.5 w-3.5 text-green-400" /> : kpi.direction === "lower" ? <TrendingDown className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5 text-slate-400" />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-medium text-white truncate">{kpi.label}</p>
                        {kpi.verificationStatus === "live" && <span className="text-[10px] px-1 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-800/50 shrink-0">Live</span>}
                        {kpi.verificationStatus === "manual" && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-900/60 text-blue-400 border border-blue-800/50 shrink-0">Manual</span>}
                        {kpi.verificationStatus === "unverified" && <span className="text-[10px] px-1 py-0.5 rounded bg-slate-800/60 text-slate-500 border border-slate-700/50 shrink-0">Not connected</span>}
                      </div>
                      {kpi.unit && <p className="text-xs text-slate-500">{kpi.unit}</p>}
                      {kpi.source && kpi.verificationStatus !== "unverified" && <p className="text-[10px] text-slate-600 truncate" title={kpi.source}>{kpi.source}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Decision Queue Panel ──────────────────────────────────────────────────────
function DecisionQueuePanel({ onRunDecision }: { onRunDecision: (d: typeof AGENTHINK_DECISIONS[0]) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDecision = AGENTHINK_DECISIONS.find((d) => d.id === selected);
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{AGENTHINK_DECISIONS.filter((d) => d.status === "PENDING_COUNCIL").length} pending council review · {AGENTHINK_DECISIONS.filter((d) => d.priority === "HIGH").length} high priority</p>
      <div className="space-y-2">
        {AGENTHINK_DECISIONS.map((d) => (
          <div key={d.id} onClick={() => setSelected(selected === d.id ? null : d.id)} className={`p-4 rounded-lg border cursor-pointer transition-colors ${selected === d.id ? "bg-blue-500/10 border-blue-500/40" : "bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1"><span className="text-sm font-medium text-white">{d.title}</span><PriorityBadge priority={d.priority} /><DecisionStatusBadge status={d.status} /></div>
                <p className="text-xs text-slate-400 line-clamp-2">{d.context}</p>
                <p className="text-xs text-slate-600 mt-1">Submitted by {d.submittedBy} · {d.submittedAt}</p>
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5 transition-transform ${selected === d.id ? "rotate-90" : ""}`} />
            </div>
          </div>
        ))}
      </div>
      {selectedDecision && (
        <Card className="bg-slate-800/40 border-blue-500/30">
          <CardHeader className="pb-3"><CardTitle className="text-sm text-white">{selectedDecision.title}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-300">{selectedDecision.context}</p>
            <div>
              <p className="text-xs text-slate-500 mb-1">KPI Impact:</p>
              <div className="flex flex-wrap gap-1">{selectedDecision.kpiImpact.map((k) => <span key={k} className="px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300 border border-slate-600/50">{k}</span>)}</div>
            </div>
            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => onRunDecision(selectedDecision)}>
              <Play className="h-3.5 w-3.5 mr-1.5" />Run Through Executive Council
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Scenario Workspace Panel ──────────────────────────────────────────────────
function ScenarioWorkspacePanel({ onRunScenario }: { onRunScenario: (s: typeof SCENARIO_TEMPLATES[0]) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Run scenario analyses against the AgenThink Mesh blueprint using the Executive Council.</p>
      <div className="grid grid-cols-1 gap-3">
        {SCENARIO_TEMPLATES.map((s) => (
          <Card key={s.id} className="bg-slate-800/30 border-slate-700/40"><CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white mb-1">{s.label}</p>
                <p className="text-xs text-slate-400 mb-2">{s.description}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500"><span>Council: {s.councilMode.toUpperCase()}</span><span>Est. {s.estimatedDuration}</span></div>
              </div>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs flex-shrink-0" onClick={() => onRunScenario(s)}>
                <Play className="h-3 w-3 mr-1" />Run
              </Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
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
      <p className="text-xs text-slate-600 mt-1">Run your first decision from the Decision Queue tab.</p>
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
      <p className="text-xs text-slate-600 mt-1">Import historical decisions via <a href="/admin/outcome-batch-import" className="text-blue-400 hover:underline">Batch Import</a>.</p>
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
    <div className="text-center py-12">
      <Shield className="h-8 w-8 text-slate-600 mx-auto mb-3" />
      <p className="text-sm text-slate-500">No audit entries yet.</p>
    </div>
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
function ReportsPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Council session reports and platform admin links.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { title: "Customer Zero Status Report", path: "/admin/customer-zero", icon: CheckCircle2, color: "text-green-400" },
          { title: "Outcome Batch Import", path: "/admin/outcome-batch-import", icon: Database, color: "text-blue-400" },
          { title: "Enterprise Org Dashboard", path: "/admin/enterprise", icon: Users, color: "text-purple-400" },
          { title: "Conglomerate Pilot Blueprint", path: "/enterprise/setup", icon: BarChart3, color: "text-amber-400" },
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
  // Layer 1: Client-side auth guard
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });

  // Layer 2: Server-side org membership + tenant guard
  const accessQuery = trpc.enterprise.cockpitVerifyAccess.useQuery({}, {
    enabled: Boolean(user),
    retry: false,
  });

  // Live KPIs from DB
  const kpiSetId = accessQuery.data?.twin?.kpiSetId ?? undefined;
  const kpisQuery = trpc.enterprise.cockpitGetOrgKpis.useQuery(
    { kpiSetId },
    { enabled: Boolean(accessQuery.data), retry: false }
  );

  const sessionsQuery = trpc.enterprise.cockpitGetSessionHistory.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });
  const outcomesQuery = trpc.enterprise.cockpitGetOutcomeLedger.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });
  const auditQuery = trpc.enterprise.cockpitGetAuditLog.useQuery({}, { enabled: Boolean(accessQuery.data), retry: false });

  const [activeTab, setActiveTab] = useState("overview");
  const [runningDecision, setRunningDecision] = useState<string | null>(null);

  const handleRunDecision = (decision: typeof AGENTHINK_DECISIONS[0]) => {
    setRunningDecision(decision.id);
    setActiveTab("scenarios");
  };

  const handleRunScenario = (_scenario: typeof SCENARIO_TEMPLATES[0]) => {
    alert("Council session execution coming in next sprint. Twin instance ID: " + (accessQuery.data?.twin?.id ?? "—"));
  };

  // Loading states
  if (authLoading) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 text-blue-400 animate-spin" /><p className="text-sm text-slate-400">Verifying authentication…</p></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3"><Lock className="h-8 w-8 text-slate-500" /><p className="text-sm text-slate-400">Redirecting to login…</p><a href={getLoginUrl()} className="text-xs text-blue-400 hover:underline">Click here if not redirected</a></div>
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
            <TabsTrigger value="decisions" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Target className="h-3.5 w-3.5 mr-1.5" />Decision Queue<span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">{AGENTHINK_DECISIONS.filter((d) => d.status === "PENDING_COUNCIL").length}</span></TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Play className="h-3.5 w-3.5 mr-1.5" />Scenario Workspace</TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><History className="h-3.5 w-3.5 mr-1.5" />Council History{ctx.sessionCount > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-slate-600/50 text-slate-300">{ctx.sessionCount}</span>}</TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Outcome Ledger</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><Shield className="h-3.5 w-3.5 mr-1.5" />Audit Log</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white"><FileText className="h-3.5 w-3.5 mr-1.5" />Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CompanyOverviewPanel org={ctx.org} twin={ctx.twin} sessionCount={ctx.sessionCount} kpis={kpisQuery.data ?? []} kpisLoading={kpisQuery.isLoading} />
          </TabsContent>
          <TabsContent value="decisions">
            <DecisionQueuePanel onRunDecision={handleRunDecision} />
          </TabsContent>
          <TabsContent value="scenarios">
            <ScenarioWorkspacePanel onRunScenario={handleRunScenario} />
            {runningDecision && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
                Decision "{AGENTHINK_DECISIONS.find((d) => d.id === runningDecision)?.title}" queued. Wire <code>enterprise.runTwin</code> to execute.
              </div>
            )}
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
