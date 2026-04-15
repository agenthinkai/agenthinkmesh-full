/**
 * client/src/pages/ProcurementScreener.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Procurement / Vendor Evaluation Workflow UI
 * Visually and structurally distinct from the Investment workflow.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentEvaluation {
  agentId: string;
  agentName: string;
  agentRole: string;
  verdict: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL";
  score: number;
  confidence: "High" | "Medium" | "Low";
  rationale: string;
  keyRisks: string[];
  keyStrengths: string[];
  conditions?: string[];
}

interface ConsensusData {
  approveCount: number;
  rejectCount: number;
  conditionalCount: number;
  averageScore: number;
  topRisks: string[];
  topStrengths: string[];
  keyConditions: string[];
}

interface VendorEvaluationReport {
  vendorName: string;
  category: string;
  finalRecommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL";
  overallScore: number;
  overallConfidence: "High" | "Medium" | "Low";
  executiveSummary: string;
  agentEvaluations: AgentEvaluation[];
  consensus: ConsensusData;
  approvedConditions?: string[];
  rejectionReasons?: string[];
  nextSteps: string[];
  evaluatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  APPROVE: {
    label: "APPROVED",
    color: "text-emerald-400",
    bg: "bg-emerald-950/60 border-emerald-700/50",
    badge: "bg-emerald-900/80 text-emerald-300 border-emerald-700",
    icon: "✅",
  },
  REJECT: {
    label: "REJECTED",
    color: "text-red-400",
    bg: "bg-red-950/60 border-red-700/50",
    badge: "bg-red-900/80 text-red-300 border-red-700",
    icon: "❌",
  },
  CONDITIONAL_APPROVAL: {
    label: "CONDITIONAL APPROVAL",
    color: "text-amber-400",
    bg: "bg-amber-950/60 border-amber-700/50",
    badge: "bg-amber-900/80 text-amber-300 border-amber-700",
    icon: "⚠️",
  },
};

const CONFIDENCE_COLORS = {
  High: "text-emerald-400",
  Medium: "text-amber-400",
  Low: "text-red-400",
};

const AGENT_VERDICT_COLORS = {
  APPROVE: "bg-emerald-900/60 border-emerald-700/40 text-emerald-300",
  REJECT: "bg-red-900/60 border-red-700/40 text-red-300",
  CONDITIONAL_APPROVAL: "bg-amber-900/60 border-amber-700/40 text-amber-300",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerdictBanner({ report }: { report: VendorEvaluationReport }) {
  const cfg = VERDICT_CONFIG[report.finalRecommendation];
  const approveRate = Math.round(
    (report.consensus.approveCount / report.agentEvaluations.length) * 100
  );

  return (
    <div className={`rounded-xl border p-6 mb-6 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{cfg.icon}</span>
            <div>
              <div className={`text-2xl font-black tracking-widest ${cfg.color}`}>
                {cfg.label}
              </div>
              <div className="text-slate-400 text-sm font-medium mt-0.5">
                {report.vendorName} · {report.category}
              </div>
            </div>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed max-w-2xl mt-3">
            {report.executiveSummary}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <div className={`text-4xl font-black ${cfg.color}`}>
              {report.overallScore.toFixed(1)}
              <span className="text-lg text-slate-500">/10</span>
            </div>
            <div className="text-slate-400 text-xs">Overall Score</div>
          </div>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs font-semibold px-2 py-1 rounded border ${cfg.badge}`}>
              {CONFIDENCE_COLORS[report.overallConfidence] ? report.overallConfidence : "Medium"} Confidence
            </span>
            <span className="text-xs font-semibold px-2 py-1 rounded border bg-slate-800/80 text-slate-300 border-slate-600">
              {approveRate}% Approve Rate
            </span>
          </div>
        </div>
      </div>

      {/* Vote bar */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-400 font-semibold">
            ✓ {report.consensus.approveCount} Approve
          </span>
          <span className="text-amber-400 font-semibold">
            ◐ {report.consensus.conditionalCount} Conditional
          </span>
          <span className="text-red-400 font-semibold">
            ✗ {report.consensus.rejectCount} Reject
          </span>
          <span className="ml-auto text-slate-400 text-xs">
            {report.agentEvaluations.length} agents evaluated
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${(report.consensus.approveCount / report.agentEvaluations.length) * 100}%` }}
          />
          <div
            className="bg-amber-500 h-full transition-all"
            style={{ width: `${(report.consensus.conditionalCount / report.agentEvaluations.length) * 100}%` }}
          />
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${(report.consensus.rejectCount / report.agentEvaluations.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentEvaluation }) {
  const [expanded, setExpanded] = useState(false);
  const verdictCfg = VERDICT_CONFIG[agent.verdict];

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-slate-700/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`text-xs font-bold px-2 py-1 rounded border shrink-0 ${AGENT_VERDICT_COLORS[agent.verdict]}`}>
              {agent.verdict === "CONDITIONAL_APPROVAL" ? "CONDITIONAL" : agent.verdict}
            </div>
            <div className="min-w-0">
              <div className="text-slate-200 font-semibold text-sm truncate">{agent.agentName}</div>
              <div className="text-slate-500 text-xs">{agent.agentRole}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={`text-lg font-black ${verdictCfg.color}`}>{agent.score.toFixed(1)}</div>
              <div className="text-slate-500 text-xs">{agent.confidence}</div>
            </div>
            <span className="text-slate-500 text-sm">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-3">
          <p className="text-slate-300 text-sm leading-relaxed">{agent.rationale}</p>

          {agent.keyStrengths.length > 0 && (
            <div>
              <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Key Strengths
              </div>
              <ul className="space-y-1">
                {agent.keyStrengths.map((s, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className="text-emerald-500 shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.keyRisks.length > 0 && (
            <div>
              <div className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Key Risks
              </div>
              <ul className="space-y-1">
                {agent.keyRisks.map((r, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className="text-red-500 shrink-0">!</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.conditions && agent.conditions.length > 0 && (
            <div>
              <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Conditions
              </div>
              <ul className="space-y-1">
                {agent.conditions.map((c, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className="text-amber-500 shrink-0">→</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConsensusPanel({ report }: { report: VendorEvaluationReport }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Top Risks */}
      <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-4">
        <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">
          🚨 Top Risks Identified
        </div>
        {report.consensus.topRisks.length > 0 ? (
          <ul className="space-y-2">
            {report.consensus.topRisks.slice(0, 5).map((r, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-red-500 shrink-0 font-bold">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm">No major risks identified.</p>
        )}
      </div>

      {/* Top Strengths */}
      <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-4">
        <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">
          ✅ Top Strengths
        </div>
        {report.consensus.topStrengths.length > 0 ? (
          <ul className="space-y-2">
            {report.consensus.topStrengths.slice(0, 5).map((s, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-emerald-500 shrink-0 font-bold">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm">No strengths noted.</p>
        )}
      </div>

      {/* Conditions */}
      {report.consensus.keyConditions.length > 0 && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-4 md:col-span-2">
          <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
            ⚠️ Approval Conditions
          </div>
          <ul className="space-y-2">
            {report.consensus.keyConditions.map((c, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-amber-500 shrink-0 font-bold">{i + 1}.</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {report.nextSteps.length > 0 && (
        <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-4 md:col-span-2">
          <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">
            📋 Recommended Next Steps
          </div>
          <ol className="space-y-2">
            {report.nextSteps.map((s, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-blue-400 shrink-0 font-bold">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function EvaluationReport({ report, onNewEvaluation }: { report: VendorEvaluationReport; onNewEvaluation: () => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-wide">
            🏛️ VENDOR EVALUATION REPORT
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            {report.agentEvaluations.length} specialist agents · {new Date(report.evaluatedAt).toLocaleString()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewEvaluation}
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          ← NEW EVALUATION
        </Button>
      </div>

      {/* Verdict banner (opinion first) */}
      <VerdictBanner report={report} />

      {/* Consensus panels */}
      <ConsensusPanel report={report} />

      {/* Agent evaluations */}
      <div className="mb-6">
        <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
          ⚡ AGENT EVALUATIONS ({report.agentEvaluations.length})
        </div>
        <div className="space-y-2">
          {report.agentEvaluations.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Processing State ─────────────────────────────────────────────────────────

function ProcessingState({ vendorName, agents }: { vendorName: string; agents: { id: string; name: string; role: string }[] }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="text-5xl mb-4 animate-pulse">🔍</div>
      <h2 className="text-2xl font-black text-slate-100 tracking-wide mb-2">
        EVALUATING VENDOR
      </h2>
      <p className="text-slate-400 text-sm mb-2">
        <span className="text-blue-400 font-semibold">{vendorName}</span>
      </p>
      <p className="text-slate-500 text-xs mb-8">
        {agents.length} specialist procurement agents are running parallel evaluations
      </p>

      <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
        {agents.map((agent, i) => (
          <div
            key={agent.id}
            className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/40"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
            <div className="text-left min-w-0">
              <div className="text-slate-300 text-xs font-semibold truncate">{agent.name}</div>
              <div className="text-slate-500 text-xs truncate">{agent.role}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-slate-600 text-xs mt-8">This typically takes 60–90 seconds</p>
    </div>
  );
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({
  item,
  onSelect,
}: {
  item: {
    id: number;
    vendorName: string;
    category: string;
    finalRecommendation: string;
    overallScore: string;
    overallConfidence: string;
    createdAt: Date;
  };
  onSelect: (id: number) => void;
}) {
  const cfg = VERDICT_CONFIG[item.finalRecommendation as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG.REJECT;
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg border border-slate-700/40 bg-slate-800/30 hover:bg-slate-700/30 cursor-pointer transition-colors"
      onClick={() => onSelect(item.id)}
    >
      <span className={`text-xs font-bold px-2 py-1 rounded border shrink-0 ${AGENT_VERDICT_COLORS[item.finalRecommendation as keyof typeof AGENT_VERDICT_COLORS] ?? ""}`}>
        {item.finalRecommendation === "CONDITIONAL_APPROVAL" ? "CONDITIONAL" : item.finalRecommendation}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-slate-200 text-sm font-semibold truncate">{item.vendorName}</div>
        <div className="text-slate-500 text-xs">{item.category}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-black ${cfg.color}`}>{parseFloat(item.overallScore).toFixed(1)}</div>
        <div className="text-slate-500 text-xs">{new Date(item.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProcurementScreener() {
  const { user } = useAuth();
  const [view, setView] = useState<"form" | "processing" | "result" | "history">("form");
  const [result, setResult] = useState<VendorEvaluationReport | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  // Form state
  const [vendorName, setVendorName] = useState("");
  const [proposalText, setProposalText] = useState("");
  const [category, setCategory] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [duration, setDuration] = useState("");
  const [requirements, setRequirements] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");

  const { data: agents = [] } = trpc.procurement.getAgents.useQuery();
  const { data: history = [], refetch: refetchHistory } = trpc.procurement.getHistory.useQuery(
    { limit: 20 },
    { enabled: !!user }
  );
  const { data: historyReport } = trpc.procurement.getReport.useQuery(
    { id: selectedHistoryId! },
    { enabled: selectedHistoryId !== null }
  );

  const screenMutation = trpc.procurement.screen.useMutation({
    onSuccess: (data) => {
      setResult(data as unknown as VendorEvaluationReport);
      setView("result");
      refetchHistory();
    },
    onError: (err) => {
      toast.error("Evaluation failed: " + err.message);
      setView("form");
    },
  });

  const handleSubmit = () => {
    if (!vendorName.trim() || !proposalText.trim() || !category.trim()) {
      toast.error("Please fill in Vendor Name, Category, and Proposal/Description.");
      return;
    }
    setView("processing");
    screenMutation.mutate({
      vendorName: vendorName.trim(),
      proposalText: proposalText.trim(),
      category: category.trim(),
      contractValue: contractValue.trim() || undefined,
      duration: duration.trim() || undefined,
      requirements: requirements.trim() || undefined,
      additionalContext: additionalContext.trim() || undefined,
    });
  };

  const handleNewEvaluation = () => {
    setResult(null);
    setSelectedHistoryId(null);
    setVendorName("");
    setProposalText("");
    setCategory("");
    setContractValue("");
    setDuration("");
    setRequirements("");
    setAdditionalContext("");
    setView("form");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Authentication Required</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to access the Procurement Evaluation Engine.</p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            SIGN IN
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top nav */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 font-black text-sm tracking-widest">🏢 PROCUREMENT</span>
            <span className="text-slate-600 text-xs">|</span>
            <span className="text-slate-400 text-xs">VENDOR EVALUATION ENGINE</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50 font-semibold">
              PROCUREMENT WORKFLOW
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("form")}
              className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors ${
                view === "form" || view === "processing"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              NEW EVALUATION
            </button>
            <button
              onClick={() => { setView("history"); refetchHistory(); }}
              className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors ${
                view === "history"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              HISTORY ({history.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Form view */}
        {view === "form" && (
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs px-2 py-1 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50 font-bold tracking-wider">
                  📦 PROCUREMENT WORKFLOW · EXAMPLE USE CASE
                </span>
              </div>
              <h1 className="text-3xl font-black text-slate-100 tracking-tight">
                Vendor Evaluation
              </h1>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Submit a vendor proposal or RFP response. {agents.length} specialist agents will evaluate
                financial stability, technical capability, compliance, risk, and strategic fit in parallel.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                    Vendor / Supplier Name *
                  </Label>
                  <Input
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Acme Solutions Ltd."
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                    Category / Service Type *
                  </Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. IT Infrastructure, Logistics, SaaS"
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                    Contract Value (optional)
                  </Label>
                  <Input
                    value={contractValue}
                    onChange={(e) => setContractValue(e.target.value)}
                    placeholder="e.g. $500,000 / year"
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                    Contract Duration (optional)
                  </Label>
                  <Input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3 years, 12 months"
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                  Proposal / Vendor Description *
                </Label>
                <Textarea
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  placeholder="Paste the vendor's proposal, RFP response, or provide a detailed description of the vendor's offering, capabilities, pricing, and track record..."
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 min-h-[160px] resize-y"
                />
              </div>

              <div>
                <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                  Your Requirements (optional)
                </Label>
                <Textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="List your specific requirements, compliance needs, SLA expectations, or evaluation criteria..."
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 min-h-[100px] resize-y"
                />
              </div>

              <div>
                <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">
                  Additional Context (optional)
                </Label>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Industry context, competing bids, strategic considerations, or any other relevant information..."
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 min-h-[80px] resize-y"
                />
              </div>

              {/* Agent preview */}
              {agents.length > 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
                    ⚡ {agents.length} SPECIALIST AGENTS WILL EVALUATE
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {agents.map((agent) => (
                      <div key={agent.id} className="text-center p-2 rounded-lg bg-slate-800/60 border border-slate-700/30">
                        <div className="text-slate-300 text-xs font-semibold">{agent.name}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{agent.role}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={screenMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black tracking-widest py-6 text-base"
              >
                🔍 EVALUATE THIS VENDOR
              </Button>
            </div>
          </div>
        )}

        {/* Processing view */}
        {view === "processing" && (
          <ProcessingState vendorName={vendorName} agents={agents} />
        )}

        {/* Result view */}
        {view === "result" && result && (
          <EvaluationReport report={result} onNewEvaluation={handleNewEvaluation} />
        )}

        {/* History view */}
        {view === "history" && (
          <div className="max-w-3xl mx-auto">
            {selectedHistoryId && historyReport ? (
              <div>
                <button
                  onClick={() => setSelectedHistoryId(null)}
                  className="text-slate-400 hover:text-slate-200 text-sm mb-6 flex items-center gap-2"
                >
                  ← Back to History
                </button>
                <EvaluationReport
                  report={historyReport.report as VendorEvaluationReport}
                  onNewEvaluation={handleNewEvaluation}
                />
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-black text-slate-100 tracking-wide mb-6">
                  📋 EVALUATION HISTORY
                </h2>
                {history.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-slate-400 text-sm">No evaluations yet.</p>
                    <Button
                      onClick={handleNewEvaluation}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Run First Evaluation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <HistoryRow
                        key={item.id}
                        item={item}
                        onSelect={(id) => setSelectedHistoryId(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
