import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Database,
  GitBranch, Play, RefreshCw, Shield, Zap, ChevronRight,
  Eye, Lock, Network, Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { useProspectMode } from "@/hooks/useProspectMode";
import ProspectModal from "@/components/sado/ProspectModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type AgentStatus = "idle" | "running" | "completed" | "escalated" | "error";

interface Agent {
  id: number;
  name: string;
  status: string;
  lastAction: string | null;
  currentTask: string | null;
  confidence: number | null;
  updatedAt: number;
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  idle:      { label: "Idle",      color: "bg-slate-500/10 text-slate-400 border-slate-500/20",  dot: "bg-slate-400",  icon: <Clock className="w-3 h-3" /> },
  running:   { label: "Running",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    dot: "bg-blue-400 animate-pulse", icon: <Activity className="w-3 h-3" /> },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  escalated: { label: "Escalated", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400",  icon: <AlertTriangle className="w-3 h-3" /> },
  error:     { label: "Error",     color: "bg-red-500/10 text-red-400 border-red-500/20",       dot: "bg-red-400",    icon: <AlertTriangle className="w-3 h-3" /> },
};

const AGENT_ICONS: Record<string, React.ReactNode> = {
  SchemaExtractorAgent: <Database className="w-5 h-5" />,
  SemanticMapperAgent:  <Network className="w-5 h-5" />,
  PIIDetectorAgent:     <Eye className="w-5 h-5" />,
  SchemaDriftAgent:     <GitBranch className="w-5 h-5" />,
  SQLRewriteAgent:      <Zap className="w-5 h-5" />,
  GovernanceAgent:      <Shield className="w-5 h-5" />,
};

// ── Demo step runner ──────────────────────────────────────────────────────────
export default function SADOCommandCentre() {
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [demoLog, setDemoLog] = useState<string[]>([]);
  const [prospectModalOpen, setProspectModalOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { prospect, saveProspect, clearProspect } = useProspectMode();

  const agentsQ = trpc.sado.getAgents.useQuery(undefined, { refetchInterval: demoRunning ? 1500 : 10000 });
  const escalationsQ = trpc.sado.getEscalations.useQuery();
  const governanceQ = trpc.sado.getGovernanceAlerts.useQuery();
  const stepsQ = trpc.sado.getDemoCycleSteps.useQuery();
  const applyStep = trpc.sado.applyDemoStep.useMutation();
  const resetDemo = trpc.sado.resetDemo.useMutation();
  const utils = trpc.useUtils();

  const agents: Agent[] = agentsQ.data ?? [];
  const escalations = escalationsQ.data ?? [];
  const govAlerts = governanceQ.data ?? [];
  const steps = stepsQ.data ?? [];

  const pendingEscalations = escalations.filter(e => e.status === "pending").length;
  const intercepted = govAlerts.filter(g => g.action === "INTERCEPTED").length;
  const allowed = govAlerts.filter(g => g.action === "ALLOWED").length;
  const completedAgents = agents.filter(a => a.status === "completed" || a.status === "escalated").length;

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [demoLog]);

  async function runDemo() {
    if (demoRunning) return;
    setDemoRunning(true);
    setDemoStep(0);
    setDemoLog([]);

    // Reset first
    await resetDemo.mutateAsync();
    await utils.sado.getAgents.invalidate();
    await utils.sado.getGovernanceAlerts.invalidate();
    await utils.sado.getEscalations.invalidate();
    await utils.sado.getAuditTrail.invalidate();

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      setDemoStep(i + 1);
      setDemoLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${s.agentName}: ${s.message}`]);

      await applyStep.mutateAsync({ step: s.step, agentName: s.agentName, action: s.action, message: s.message });
      await utils.sado.getAgents.invalidate();

      await new Promise(r => setTimeout(r, s.duration));
    }

    // Final invalidate
    await utils.sado.getGovernanceAlerts.invalidate();
    await utils.sado.getEscalations.invalidate();
    await utils.sado.getAuditTrail.invalidate();

    setDemoRunning(false);
    setDemoStep(0);
    // Signal knowledge graph to trigger animated reveal
    localStorage.setItem("sado_demo_completed", Date.now().toString());
    toast.success("Demo cycle complete — all 6 agents executed.");
  }

  const progress = steps.length > 0 ? Math.round((demoStep / steps.length) * 100) : 0;

  // Subtitle: prospect tagline > prospect name > default
  const headerSubtitle = prospect
    ? prospect.tagline
      ? prospect.tagline
      : `Prepared for ${prospect.prospectName}`
    : "Sovereign AI Data Operations — Phase A Demo";

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      <ProspectModal
        open={prospectModalOpen}
        onOpenChange={setProspectModalOpen}
        current={prospect}
        onSave={saveProspect}
        onClear={clearProspect}
      />

      {/* ── Header ── */}
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">SADO Command Centre</h1>
              <p className={`text-xs transition-colors ${prospect ? "text-blue-400" : "text-slate-400"}`}>
                {headerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Prospect badge / button */}
            {prospect ? (
              <button
                type="button"
                onClick={() => setProspectModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs hover:border-blue-400 hover:bg-blue-500/20 transition-colors"
                title="Edit prospect mode"
              >
                <Briefcase className="w-3 h-3" />
                {prospect.prospectName}
              </button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setProspectModalOpen(true)}
                className="text-xs text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1.5 px-2"
              >
                <Briefcase className="w-3 h-3" /> Prepare for Prospect
              </Button>
            )}

            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Operational
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={demoRunning}
              onClick={() => {
                // Clear localStorage demo-completion flag so Knowledge Graph resets to pre-animation state
                try { localStorage.removeItem("sado_demo_completed"); } catch { /* noop */ }
                // Reset local demo UI state
                setDemoRunning(false);
                setDemoStep(0);
                setDemoLog([]);
                // Reset DB agent statuses and re-seed
                resetDemo.mutateAsync().then(() => {
                  utils.sado.getAgents.invalidate();
                  utils.sado.getGovernanceAlerts.invalidate();
                  utils.sado.getEscalations.invalidate();
                  utils.sado.getAuditTrail.invalidate();
                  toast.success("Demo reset — ready to run again.");
                });
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Reset Demo
            </Button>
            <Button
              size="sm"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={runDemo}
              disabled={demoRunning}
            >
              {demoRunning ? (
                <><Activity className="w-3 h-3 mr-1 animate-spin" /> Running…</>
              ) : (
                <><Play className="w-3 h-3 mr-1" /> Run Demo</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── Demo progress bar ── */}
        {demoRunning && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-300 font-medium">Demo Cycle Running — Step {demoStep} of {steps.length}</span>
              <span className="text-xs text-blue-400">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-slate-800" />
          </div>
        )}

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Sources Discovered",  value: "3",              sub: "Oracle CRM · SAP HR · SQL Server", icon: <Database className="w-4 h-4 text-blue-400" />,    color: "text-blue-400" },
            { label: "Columns Classified",  value: "20",             sub: "6 PII/SENSITIVE detected",         icon: <Eye className="w-4 h-4 text-purple-400" />,       color: "text-purple-400" },
            { label: "Transfers Blocked",   value: String(intercepted || 2), sub: "PDPL SA · CITRA KW",       icon: <Shield className="w-4 h-4 text-red-400" />,       color: "text-red-400" },
            { label: "Escalations Pending", value: String(pendingEscalations || 2), sub: "Awaiting operator review",  icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
          ].map(k => (
            <Card key={k.label} className="bg-[oklch(0.14_0.03_255)] border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{k.label}</span>
                  {k.icon}
                </div>
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Agent grid ── */}
        <div>
          <h2 className="text-sm font-medium text-slate-300 mb-3">Agent Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {agents.map(agent => {
              const cfg = STATUS_CONFIG[agent.status as AgentStatus] ?? STATUS_CONFIG.idle;
              return (
                <Card key={agent.id} className="bg-[oklch(0.14_0.03_255)] border-slate-800 hover:border-slate-700 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="text-slate-400">{AGENT_ICONS[agent.name] ?? <Activity className="w-5 h-5" />}</div>
                        <span className="text-xs font-medium text-slate-200">{agent.name.replace("Agent", "")}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${cfg.color} flex items-center gap-1`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                    {agent.currentTask && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{agent.currentTask}</p>
                    )}
                    {agent.confidence !== null && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="text-xs text-slate-500">Conf:</div>
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((agent.confidence ?? 0) * 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-400">{Math.round((agent.confidence ?? 0) * 100)}%</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── Demo log + nav links ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Live log */}
          <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> Live Agent Log
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div
                ref={logRef}
                className="h-48 overflow-y-auto font-mono text-xs text-slate-400 space-y-1 bg-slate-900/50 rounded p-3"
              >
                {demoLog.length === 0 ? (
                  <div className="text-slate-600 italic">Click "Run Demo" to start the agent workflow…</div>
                ) : (
                  demoLog.map((line, i) => (
                    <div key={i} className={i === demoLog.length - 1 ? "text-blue-300" : ""}>{line}</div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-blue-400" /> Explore Modules
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {[
                { href: "/sado/discovery",   icon: <Database className="w-4 h-4" />,       label: "Discovery Layer",     sub: "Sources · Columns · PII classification" },
                { href: "/sado/knowledge-graph", icon: <Network className="w-4 h-4" />,        label: "Knowledge Graph",     sub: "Entity relationships · 6 nodes · 5 edges" },
                { href: "/sado/governance",   icon: <Shield className="w-4 h-4" />,         label: "Governance",          sub: "PDPL SA · CITRA KW · Transfer alerts" },
                { href: "/sado/escalations",  icon: <AlertTriangle className="w-4 h-4" />,  label: "Escalation Queue",    sub: `${pendingEscalations || 2} pending human review` },
                { href: "/sado/audit-trail",   icon: <Lock className="w-4 h-4" />,           label: "Audit Trail",         sub: "Append-only · OpenTelemetry trace IDs" },
              ].map(n => (
                <Link key={n.href} href={n.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors group">
                    <div className="text-slate-500 group-hover:text-blue-400 transition-colors">{n.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 group-hover:text-white transition-colors">{n.label}</div>
                      <div className="text-xs text-slate-500">{n.sub}</div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
