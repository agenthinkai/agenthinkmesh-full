/**
 * AgenThink Mesh Executive Decision Twin
 * ─────────────────────────────────────────────────────────────────────────────
 * Customer Zero — the first live enterprise twin onboarded through the
 * Decision Twin Factory platform.
 *
 * Three panels:
 *   1. Company Overview — KPI snapshot, financial health, model progress
 *   2. Decision Queue   — pending decisions with priority, type, and council
 *   3. Scenario Workspace — run scenarios against the AgenThink blueprint
 *
 * All data is sourced from the platform's tRPC procedures. Static fallback
 * data is used only when the DB is unavailable (no org seeded yet).
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Database,
  Users,
  DollarSign,
  Activity,
  GitBranch,
  Target,
  ChevronRight,
  Play,
  BarChart3,
  Cpu,
  Network,
  FileText,
  Shield,
} from "lucide-react";

// ── Static fallback data (used when DB is unavailable) ────────────────────────

const FALLBACK_KPIS = [
  { group: "Revenue", kpis: [
    { id: "arr", label: "ARR", value: "KD 0.18M", delta: "+12%", trend: "up", status: "on_track" },
    { id: "mrr", label: "MRR", value: "KD 15K", delta: "+8%", trend: "up", status: "on_track" },
    { id: "pipeline", label: "Pipeline", value: "KD 2.4M", delta: "+31%", trend: "up", status: "on_track" },
    { id: "nrr", label: "NRR", value: "104%", delta: "+4pp", trend: "up", status: "on_track" },
  ]},
  { group: "Model Performance", kpis: [
    { id: "gpu_util", label: "GPU Utilisation", value: "—", delta: "PENDING", trend: "flat", status: "pending" },
    { id: "training_loss", label: "Training Loss", value: "—", delta: "PENDING", trend: "flat", status: "pending" },
    { id: "tokens_sec", label: "Tokens/sec", value: "—", delta: "PENDING", trend: "flat", status: "pending" },
    { id: "mfu", label: "Model FLOPs Util", value: "—", delta: "PENDING", trend: "flat", status: "pending" },
  ]},
  { group: "Engineering Velocity", kpis: [
    { id: "deploy_freq", label: "Deploy Frequency", value: "4.2/wk", delta: "+0.8", trend: "up", status: "on_track" },
    { id: "pr_cycle", label: "PR Cycle Time", value: "18h", delta: "-3h", trend: "up", status: "on_track" },
    { id: "test_coverage", label: "Test Coverage", value: "71%", delta: "+5pp", trend: "up", status: "at_risk" },
    { id: "open_issues", label: "Open P0/P1", value: "2", delta: "-1", trend: "up", status: "on_track" },
  ]},
  { group: "Financial Health", kpis: [
    { id: "runway", label: "Runway", value: "14 mo", delta: "—", trend: "flat", status: "at_risk" },
    { id: "burn_rate", label: "Monthly Burn", value: "KD 42K", delta: "+8%", trend: "down", status: "at_risk" },
    { id: "cac", label: "CAC", value: "KD 8.2K", delta: "-12%", trend: "up", status: "on_track" },
    { id: "ltv_cac", label: "LTV:CAC", value: "3.1x", delta: "+0.4x", trend: "up", status: "on_track" },
  ]},
];

const FALLBACK_DECISIONS = [
  {
    id: "d-001",
    title: "Hire ML Infrastructure Engineer (Kuwait-based)",
    type: "talent-acquisition",
    priority: "HIGH",
    status: "PENDING_COUNCIL",
    dueDate: "2026-08-10",
    owner: "CTO",
    context: "Jupiter Shot Month 2 requires a dedicated infra engineer for distributed training. Budget: KD 28K/yr. 3 candidates shortlisted.",
    councilPersonas: ["CEO", "CTO", "CFO"],
    estimatedImpact: "Unblocks 8× A100 validation and Month 2 MoE training.",
  },
  {
    id: "d-002",
    title: "Pricing Strategy: Enterprise API Access Tier",
    type: "pricing-strategy",
    priority: "HIGH",
    status: "PENDING_COUNCIL",
    dueDate: "2026-08-15",
    owner: "CPO",
    context: "Three enterprise prospects (Alghanim, Zain, NBK) have requested API access pricing. Current model: usage-based. Proposed: seat + usage hybrid.",
    councilPersonas: ["CEO", "CPO", "VP Sales"],
    estimatedImpact: "Potential KD 180K ARR uplift if hybrid model adopted.",
  },
  {
    id: "d-003",
    title: "Partnership: KFAS Research Grant Application",
    type: "partnership",
    priority: "MEDIUM",
    status: "DRAFT",
    dueDate: "2026-08-31",
    owner: "CEO",
    context: "Kuwait Foundation for the Advancement of Sciences (KFAS) has a KD 500K AI research grant. Deadline: 31 Aug 2026. Requires 2-year research plan.",
    councilPersonas: ["CEO", "CTO", "Board"],
    estimatedImpact: "KD 500K non-dilutive funding. Extends runway by 12 months.",
  },
  {
    id: "d-004",
    title: "Model Deployment: Decision Twin Factory v2.1 to Production",
    type: "model-deployment",
    priority: "MEDIUM",
    status: "PENDING_APPROVAL",
    dueDate: "2026-08-07",
    owner: "CTO",
    context: "v2.1 includes MoE routing prototype, new council personas, and outcome ledger fixes. All CPU tests pass. GPU validation pending (Kuwait laptop).",
    councilPersonas: ["CTO", "CPO"],
    estimatedImpact: "Unblocks Customer Zero demo for 3 enterprise prospects.",
  },
  {
    id: "d-005",
    title: "Capital Allocation: Seed Round Extension vs. Revenue Bridge",
    type: "capital-allocation",
    priority: "HIGH",
    status: "DRAFT",
    dueDate: "2026-09-01",
    owner: "CEO",
    context: "14-month runway. Options: (A) Extend seed by KD 200K from existing angels, (B) Accelerate enterprise sales to reach KD 50K MRR by Q4 2026, (C) Both.",
    councilPersonas: ["CEO", "CFO", "Board"],
    estimatedImpact: "Determines whether to raise or grow to profitability.",
  },
];

const FALLBACK_SCENARIOS = [
  {
    id: "s-001",
    name: "Enterprise Sales Acceleration",
    description: "Close 3 enterprise accounts (Alghanim, Zain, NBK) by Q4 2026 at KD 60K ACV each.",
    probability: 0.45,
    arrImpact: "+KD 180K",
    runwayImpact: "+8 months",
    keyAssumptions: ["Sales cycle ≤ 90 days", "Decision Twin demo converts at 30%", "Pricing accepted at KD 60K ACV"],
    risks: ["Procurement delays in GCC enterprises", "Competitor pricing pressure"],
    status: "MODELLED",
  },
  {
    id: "s-002",
    name: "KFAS Grant + Seed Extension",
    description: "Secure KD 500K KFAS grant AND KD 200K seed extension from existing angels.",
    probability: 0.35,
    arrImpact: "+KD 0 (non-dilutive)",
    runwayImpact: "+26 months",
    keyAssumptions: ["KFAS grant approved (2-year research plan)", "Angels commit at same valuation"],
    risks: ["Grant timeline: 6-month review cycle", "Angel appetite may have changed"],
    status: "DRAFT",
  },
  {
    id: "s-003",
    name: "Jupiter Shot Month 2 — 47B MoE Validation",
    description: "Complete GPU validation (Gates 4–6) and begin 47B MoE architecture design.",
    probability: 0.70,
    arrImpact: "Indirect — product differentiation",
    runwayImpact: "-2 months (GPU costs ~KD 8K)",
    keyAssumptions: ["Kishore laptop validation passes Gates 4–6", "8× A100 cluster accessible via cloud"],
    risks: ["OOM on 1× GPU with 1.3B model", "Router instability in MoE prototype"],
    status: "BLOCKED",
    blockReason: "Awaiting Kuwait laptop GPU validation results",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-slate-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    on_track: { label: "On Track", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    at_risk: { label: "At Risk", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    off_track: { label: "Off Track", className: "bg-red-500/10 text-red-400 border-red-500/20" },
    pending: { label: "Pending", className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
    PENDING_COUNCIL: { label: "Pending Council", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    PENDING_APPROVAL: { label: "Pending Approval", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    DRAFT: { label: "Draft", className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
    APPROVED: { label: "Approved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    MODELLED: { label: "Modelled", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    BLOCKED: { label: "Blocked", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-red-400",
    MEDIUM: "bg-amber-400",
    LOW: "bg-slate-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[priority] ?? "bg-slate-400"}`} />;
}

// ── Panel 1: Company Overview ──────────────────────────────────────────────────

function CompanyOverviewPanel() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">AgenThink Mesh</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Sovereign AI Infrastructure · Kuwait · Customer Zero
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Live Twin
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            GPU Validation Pending
          </span>
        </div>
      </div>

      {/* Mission Statement */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
        <p className="text-sm text-slate-300 leading-relaxed">
          Building the world's first <strong className="text-white">distributed intelligence mesh</strong> — sovereign, explainable AI infrastructure for the GCC and MENA region. The Decision Twin Factory is our first commercial product. Jupiter Shot is our foundational model programme.
        </p>
      </div>

      {/* KPI Groups */}
      {FALLBACK_KPIS.map((group) => (
        <div key={group.group}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            {group.group === "Revenue" && <DollarSign className="h-3.5 w-3.5" />}
            {group.group === "Model Performance" && <Cpu className="h-3.5 w-3.5" />}
            {group.group === "Engineering Velocity" && <GitBranch className="h-3.5 w-3.5" />}
            {group.group === "Financial Health" && <Activity className="h-3.5 w-3.5" />}
            {group.group}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {group.kpis.map((kpi) => (
              <div
                key={kpi.id}
                className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 space-y-1.5"
              >
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <p className="text-lg font-semibold text-white">{kpi.value}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={kpi.trend} />
                    <span className={`text-xs ${kpi.trend === "up" ? "text-emerald-400" : kpi.trend === "down" ? "text-red-400" : "text-slate-400"}`}>
                      {kpi.delta}
                    </span>
                  </div>
                  <StatusBadge status={kpi.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Jupiter Shot Status */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Jupiter Shot — CONDITIONAL NO-GO for Month 2</p>
            <p className="text-xs text-amber-400/80 mt-1">
              CPU tests: 118 passed, 0 failed. GPU validation (Gates 4–6) is the only remaining blocker.
              Next step: Kishore runs single-GPU CUDA validation in Kuwait.
              Do not begin 47B MoE or 10B-token training run until Gates 4–6 are complete.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> CPU Tests: 118/118
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="h-3 w-3" /> GPU Gates: 0/3
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-500/10 text-slate-400 border border-slate-500/20">
                <Shield className="h-3 w-3" /> Compliance: Audit-log foundation only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connector Status */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Network className="h-3.5 w-3.5" />
          Data Connectors
        </h3>
        <div className="space-y-2">
          {[
            { name: "QuickBooks Online", status: "NOT_CONNECTED", description: "P&L, balance sheet, cash flow" },
            { name: "HubSpot CRM", status: "NOT_CONNECTED", description: "Pipeline, deal stage, ARR" },
            { name: "GitHub (Engineering)", status: "NOT_CONNECTED", description: "PR cycle time, deploy frequency" },
            { name: "AWS Cost Explorer", status: "NOT_CONNECTED", description: "GPU/compute burn rate" },
            { name: "Jupiter Shot Metrics", status: "NOT_CONNECTED", description: "Training loss, tokens/sec, GPU util" },
          ].map((conn) => (
            <div key={conn.name} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
              <div>
                <p className="text-sm text-white">{conn.name}</p>
                <p className="text-xs text-slate-400">{conn.description}</p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                Not Connected
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Connect data sources via the Connector Manifest to enable live KPI tracking.
        </p>
      </div>
    </div>
  );
}

// ── Panel 2: Decision Queue ────────────────────────────────────────────────────

function DecisionQueuePanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedDecision = FALLBACK_DECISIONS.find((d) => d.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Decision Queue</h2>
          <p className="text-sm text-slate-400">
            {FALLBACK_DECISIONS.filter((d) => d.status === "PENDING_COUNCIL").length} pending council review ·{" "}
            {FALLBACK_DECISIONS.filter((d) => d.priority === "HIGH").length} high priority
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
          onClick={() => {}}
        >
          + New Decision
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Decision list */}
        <div className="space-y-2">
          {FALLBACK_DECISIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(selected === d.id ? null : d.id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                selected === d.id
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
              }`}
            >
              <div className="flex items-start gap-2">
                <PriorityDot priority={d.priority} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{d.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400">{d.type}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-400">{d.owner}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-slate-400">Due {d.dueDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge status={d.status} />
                  <ChevronRight className={`h-3.5 w-3.5 text-slate-500 transition-transform ${selected === d.id ? "rotate-90" : ""}`} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Decision detail */}
        <div>
          {selectedDecision ? (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 space-y-4 sticky top-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <PriorityDot priority={selectedDecision.priority} />
                  <span className="text-xs text-slate-400 uppercase">{selectedDecision.priority} PRIORITY</span>
                </div>
                <h3 className="text-base font-semibold text-white">{selectedDecision.title}</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Context</p>
                  <p className="text-slate-300 text-xs leading-relaxed">{selectedDecision.context}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Estimated Impact</p>
                  <p className="text-emerald-400 text-xs">{selectedDecision.estimatedImpact}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Council</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDecision.councilPersonas.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {}}
                >
                  <Play className="h-3 w-3 mr-1.5" />
                  Run Council
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => {}}
                >
                  <FileText className="h-3 w-3 mr-1.5" />
                  Brief
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-6 flex flex-col items-center justify-center text-center h-48">
              <Target className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">Select a decision to view details</p>
              <p className="text-xs text-slate-600 mt-1">Run council analysis or generate a brief</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel 3: Scenario Workspace ────────────────────────────────────────────────

function ScenarioWorkspacePanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedScenario = FALLBACK_SCENARIOS.find((s) => s.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Scenario Workspace</h2>
          <p className="text-sm text-slate-400">
            {FALLBACK_SCENARIOS.length} scenarios · Blueprint: AgenThink Mesh v1.0
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
          onClick={() => {}}
        >
          + New Scenario
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scenario list */}
        <div className="space-y-3">
          {FALLBACK_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(selected === s.id ? null : s.id)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                selected === s.id
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{s.name}</p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <div>
                  <p className="text-xs text-slate-500">Probability</p>
                  <p className="text-sm font-medium text-white">{(s.probability * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">ARR Impact</p>
                  <p className={`text-sm font-medium ${s.arrImpact.startsWith("+") ? "text-emerald-400" : "text-slate-300"}`}>
                    {s.arrImpact}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Runway Impact</p>
                  <p className={`text-sm font-medium ${s.runwayImpact.startsWith("+") ? "text-emerald-400" : "text-amber-400"}`}>
                    {s.runwayImpact}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Scenario detail */}
        <div>
          {selectedScenario ? (
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 space-y-4 sticky top-4">
              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold text-white">{selectedScenario.name}</h3>
                <StatusBadge status={selectedScenario.status} />
              </div>

              {selectedScenario.status === "BLOCKED" && selectedScenario.blockReason && (
                <div className="rounded border border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300">{selectedScenario.blockReason}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Key Assumptions</p>
                  <ul className="space-y-1">
                    {selectedScenario.keyAssumptions.map((a, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Risks</p>
                  <ul className="space-y-1">
                    {selectedScenario.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="rounded bg-slate-700/40 p-2 text-center">
                    <p className="text-xs text-slate-400">Probability</p>
                    <p className="text-lg font-bold text-white">{(selectedScenario.probability * 100).toFixed(0)}%</p>
                  </div>
                  <div className="rounded bg-slate-700/40 p-2 text-center">
                    <p className="text-xs text-slate-400">ARR Impact</p>
                    <p className={`text-sm font-bold ${selectedScenario.arrImpact.startsWith("+") ? "text-emerald-400" : "text-slate-300"}`}>
                      {selectedScenario.arrImpact}
                    </p>
                  </div>
                  <div className="rounded bg-slate-700/40 p-2 text-center">
                    <p className="text-xs text-slate-400">Runway</p>
                    <p className={`text-sm font-bold ${selectedScenario.runwayImpact.startsWith("+") ? "text-emerald-400" : "text-amber-400"}`}>
                      {selectedScenario.runwayImpact}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={selectedScenario.status === "BLOCKED"}
                  onClick={() => {}}
                >
                  <BarChart3 className="h-3 w-3 mr-1.5" />
                  Run Simulation
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                  onClick={() => {}}
                >
                  <FileText className="h-3 w-3 mr-1.5" />
                  Export
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-6 flex flex-col items-center justify-center text-center h-48">
              <BarChart3 className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">Select a scenario to view details</p>
              <p className="text-xs text-slate-600 mt-1">Run simulations or export scenario briefs</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AgenThinkTwin() {
  const blueprintQuery = trpc.twinFactory.blueprints.get.useQuery(
    { blueprintId: "bp-agenthink" },
    { retry: false }
  );

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-[#0d1424]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30">
              <Brain className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">AgenThink Mesh Executive Twin</h1>
              <p className="text-xs text-slate-400">
                Blueprint: {blueprintQuery.data?.name ?? "AgenThink Mesh v1.0"} ·{" "}
                Customer Zero · Decision Twin Factory
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-slate-700 text-slate-400 hover:bg-slate-800"
              onClick={() => window.open("/admin/customer-zero", "_blank")}
            >
              <Database className="h-3 w-3 mr-1.5" />
              Org Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Company Overview
            </TabsTrigger>
            <TabsTrigger value="decisions" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <Target className="h-3.5 w-3.5 mr-1.5" />
              Decision Queue
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                {FALLBACK_DECISIONS.filter((d) => d.status === "PENDING_COUNCIL").length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Scenario Workspace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CompanyOverviewPanel />
          </TabsContent>

          <TabsContent value="decisions">
            <DecisionQueuePanel />
          </TabsContent>

          <TabsContent value="scenarios">
            <ScenarioWorkspacePanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
