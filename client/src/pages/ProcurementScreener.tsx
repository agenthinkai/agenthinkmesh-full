/**
 * client/src/pages/ProcurementScreener.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Procurement / Vendor Evaluation Workflow UI — v2
 * Matches procurementEngine.ts v2 output schema.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { DecisionUpgradePanel } from "@/components/DecisionUpgradePanel";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ─── Report export helpers ────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Types (mirrors procurementEngine.ts) ─────────────────────────────────────

interface AgentScore {
  agentId: string;
  agentName: string;
  agentRole: string;
  score: number;
  verdict: "APPROVE" | "REJECT" | "CONDITIONAL";
  confidence: "High" | "Medium" | "Low";
  keyReasoning: string;
  topRisks: string[];
  redFlags: string[];
  positives: string[];
}

interface ConsensusResult {
  averageScore: number;
  approveCount: number;
  rejectCount: number;
  conditionalCount: number;
  majorDisagreements: string[];
  highestRiskAreas: string[];
  overallConfidence: "High" | "Medium" | "Low";
  decisionRationale: string;
  conflictingScoringPairs: string[];
}

interface VendorEvaluationReport {
  vendorName: string;
  category: string;
  insufficientData: boolean;
  finalRecommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL" | "INSUFFICIENT_DATA";
  recommendationRationale: string;
  overallScore: number;
  overallConfidence: "High" | "Medium" | "Low";
  agentScores: AgentScore[];
  consensus: ConsensusResult;
  topDecisionDrivers: string[];
  topRisks: string[];
  suggestedNegotiationPoints: string[];
  missingRequiredInformation: string[];
  triage: {
    relevance: string;
    dataQuality: string;
    basicRiskFlags: string[];
    missingFields: string[];
    summary: string;
  };
  generatedAt: number;
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
  INSUFFICIENT_DATA: {
    label: "INSUFFICIENT DATA",
    color: "text-slate-400",
    bg: "bg-slate-800/60 border-slate-600/50",
    badge: "bg-slate-700/80 text-slate-300 border-slate-600",
    icon: "🚫",
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
  CONDITIONAL: "bg-amber-900/60 border-amber-700/40 text-amber-300",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerdictBanner({ report }: { report: VendorEvaluationReport }) {
  const cfg = VERDICT_CONFIG[report.finalRecommendation] ?? VERDICT_CONFIG.REJECT;
  const totalAgents = report.agentScores.length;
  const approveRate = totalAgents > 0 ? Math.round((report.consensus.approveCount / totalAgents) * 100) : 0;

  if (report.insufficientData) {
    return (
      <div className="rounded-xl border border-slate-600/50 bg-slate-800/60 p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="text-4xl">🚫</span>
          <div className="flex-1">
            <div className="text-slate-300 text-2xl font-black tracking-widest mb-1">INSUFFICIENT DATA</div>
            <div className="text-slate-400 text-sm mb-3">{report.vendorName} · {report.category}</div>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">{report.recommendationRationale}</p>
            {report.missingRequiredInformation.length > 0 && (
              <div>
                <div className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
                  Required Information Missing:
                </div>
                <ul className="space-y-1">
                  {report.missingRequiredInformation.map((item, i) => (
                    <li key={i} className="text-slate-300 text-sm flex gap-2">
                      <span className="text-amber-500 shrink-0">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
            {report.recommendationRationale}
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
              {report.overallConfidence} Confidence
            </span>
            {totalAgents > 0 && (
              <span className="text-xs font-semibold px-2 py-1 rounded border bg-slate-800/80 text-slate-300 border-slate-600">
                {approveRate}% Approve Rate
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vote bar */}
      {totalAgents > 0 && (
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
              {totalAgents} agents evaluated
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${(report.consensus.approveCount / totalAgents) * 100}%` }}
            />
            <div
              className="bg-amber-500 h-full transition-all"
              style={{ width: `${(report.consensus.conditionalCount / totalAgents) * 100}%` }}
            />
            <div
              className="bg-red-500 h-full transition-all"
              style={{ width: `${(report.consensus.rejectCount / totalAgents) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TopDecisionDrivers({ drivers }: { drivers: string[] }) {
  if (!drivers || drivers.length === 0) return null;
  return (
    <div className="rounded-xl border border-blue-800/40 bg-blue-950/30 p-4 mb-6">
      <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">
        🎯 TOP DECISION DRIVERS
      </div>
      <ol className="space-y-2">
        {drivers.map((driver, i) => (
          <li key={i} className="text-slate-200 text-sm flex gap-3">
            <span className="text-blue-400 font-black shrink-0 w-5">{i + 1}.</span>
            <span>{driver}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ConsensusPanel({ report }: { report: VendorEvaluationReport }) {
  const { consensus } = report;
  return (
    <div className="space-y-4 mb-6">
      {/* Decision Rationale */}
      {consensus.decisionRationale && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
            🧠 CONSENSUS RATIONALE
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{consensus.decisionRationale}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Risks */}
        <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-4">
          <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">
            🚨 Top Risks Identified
          </div>
          {report.topRisks.length > 0 ? (
            <ul className="space-y-2">
              {report.topRisks.slice(0, 5).map((r, i) => (
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

        {/* Highest Risk Areas */}
        <div className="rounded-xl border border-orange-800/40 bg-orange-950/30 p-4">
          <div className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-3">
            ⚡ HIGHEST RISK DIMENSIONS
          </div>
          {consensus.highestRiskAreas.length > 0 ? (
            <ul className="space-y-2">
              {consensus.highestRiskAreas.map((area, i) => (
                <li key={i} className="text-slate-300 text-sm flex gap-2">
                  <span className="text-orange-500 shrink-0">▶</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">No high-risk dimensions.</p>
          )}
        </div>
      </div>

      {/* Conflicting Scores */}
      {consensus.conflictingScoringPairs.length > 0 && (
        <div className="rounded-xl border border-purple-800/40 bg-purple-950/30 p-4">
          <div className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">
            ⚔️ CONFLICTING AGENT SCORES
          </div>
          <p className="text-slate-400 text-xs mb-3">
            Significant scoring gaps between agents indicate genuine uncertainty in this evaluation.
          </p>
          <ul className="space-y-1.5">
            {consensus.conflictingScoringPairs.map((pair, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-purple-500 shrink-0">↔</span>
                <span>{pair}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Negotiation Points */}
      {report.suggestedNegotiationPoints.length > 0 && (
        <div className="rounded-xl border border-teal-800/40 bg-teal-950/30 p-4">
          <div className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-3">
            🤝 SUGGESTED NEGOTIATION POINTS
          </div>
          <ul className="space-y-2">
            {report.suggestedNegotiationPoints.map((point, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-teal-400 shrink-0 font-bold">{i + 1}.</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Information */}
      {report.missingRequiredInformation.length > 0 && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-4">
          <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">
            📋 MISSING INFORMATION
          </div>
          <ul className="space-y-1.5">
            {report.missingRequiredInformation.map((item, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-amber-500 shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentScore }) {
  const [expanded, setExpanded] = useState(false);
  const isDevilsAdvocate = agent.agentId === "devils_advocate";
  const verdictColor = agent.verdict === "APPROVE"
    ? "text-emerald-400"
    : agent.verdict === "REJECT"
    ? "text-red-400"
    : "text-amber-400";

  const cardBg = isDevilsAdvocate
    ? "border-red-700/60 bg-red-950/40"
    : "border-slate-700/50 bg-slate-800/40";

  return (
    <div className={`rounded-lg border overflow-hidden ${cardBg}`}>
      <button
        className="w-full text-left p-4 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {isDevilsAdvocate && (
              <span className="text-base shrink-0">😈</span>
            )}
            <div className={`text-xs font-bold px-2 py-1 rounded border shrink-0 ${AGENT_VERDICT_COLORS[agent.verdict] ?? AGENT_VERDICT_COLORS.CONDITIONAL}`}>
              {agent.verdict}
            </div>
            <div className="min-w-0">
              <div className={`font-semibold text-sm truncate ${isDevilsAdvocate ? "text-red-300" : "text-slate-200"}`}>
                {agent.agentName}
                {isDevilsAdvocate && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-red-900/80 text-red-400 border border-red-700/50 font-bold">
                    ADVERSARIAL
                  </span>
                )}
              </div>
              <div className="text-slate-500 text-xs">{agent.agentRole}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={`text-lg font-black ${verdictColor}`}>{agent.score.toFixed(1)}</div>
              <div className={`text-xs ${CONFIDENCE_COLORS[agent.confidence]}`}>{agent.confidence}</div>
            </div>
            <span className="text-slate-500 text-sm">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/30 pt-3 space-y-3">
          {isDevilsAdvocate && (
            <div className="text-xs text-red-400 bg-red-950/60 border border-red-800/40 rounded px-3 py-2">
              ⚠️ This agent is specifically tasked with arguing for rejection. Its score is capped at 5/10 by design.
            </div>
          )}
          <p className="text-slate-300 text-sm leading-relaxed">{agent.keyReasoning}</p>

          {agent.positives.length > 0 && !isDevilsAdvocate && (
            <div>
              <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Positives
              </div>
              <ul className="space-y-1">
                {agent.positives.map((s, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className="text-emerald-500 shrink-0">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.topRisks.length > 0 && (
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDevilsAdvocate ? "text-red-400" : "text-red-400"}`}>
                {isDevilsAdvocate ? "Rejection Arguments" : "Top Risks"}
              </div>
              <ul className="space-y-1">
                {agent.topRisks.map((r, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className={`shrink-0 ${isDevilsAdvocate ? "text-red-400" : "text-red-500"}`}>!</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.redFlags.length > 0 && (
            <div>
              <div className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Red Flags
              </div>
              <ul className="space-y-1">
                {agent.redFlags.map((f, i) => (
                  <li key={i} className="text-slate-300 text-xs flex gap-2">
                    <span className="text-orange-500 shrink-0">🚩</span>
                    <span>{f}</span>
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

function EvaluationReport({ report, onNewEvaluation }: { report: VendorEvaluationReport; onNewEvaluation: () => void }) {
  // Separate Devil's Advocate from other agents
  const regularAgents = report.agentScores.filter((a) => a.agentId !== "devils_advocate");
  const devilsAdvocate = report.agentScores.find((a) => a.agentId === "devils_advocate");

  const generatePdfMutation = trpc.procurement.generatePdf.useMutation({
    onSuccess: (data) => {
      const bytes = base64ToBuffer(data.pdf);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const safeName = report.vendorName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadBlob(blob, `vendor_evaluation_${safeName}.pdf`);
      toast.success("PDF downloaded successfully.");
    },
    onError: (err) => toast.error("PDF generation failed: " + err.message),
  });

  const exportCsvMutation = trpc.procurement.exportCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
      const safeName = report.vendorName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      downloadBlob(blob, `vendor_evaluation_${safeName}.csv`);
      toast.success("CSV exported successfully.");
    },
    onError: (err) => toast.error("CSV export failed: " + err.message),
  });

  const handleGeneratePdf = () => {
    toast.info("Generating PDF report…");
    generatePdfMutation.mutate({ reportJson: JSON.stringify(report) });
  };

  const handleExportCsv = () => {
    exportCsvMutation.mutate({ reportJson: JSON.stringify(report) });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-100 tracking-wide">
            🏛️ VENDOR EVALUATION REPORT
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            {report.agentScores.length} specialist agents · {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export actions */}
          <Button
            size="sm"
            onClick={handleGeneratePdf}
            disabled={generatePdfMutation.isPending}
            className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs tracking-wide"
          >
            {generatePdfMutation.isPending ? "Generating…" : "📄 Download Report (PDF)"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={exportCsvMutation.isPending}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 font-bold text-xs tracking-wide"
          >
            {exportCsvMutation.isPending ? "Exporting…" : "📊 Export CSV"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewEvaluation}
            className="border-slate-600 text-slate-400 hover:bg-slate-700 text-xs"
          >
            ← NEW EVALUATION
          </Button>
        </div>
      </div>

      {/* Verdict banner */}
      <VerdictBanner report={report} />

      {/* Top Decision Drivers (only if not insufficient data) */}
      {!report.insufficientData && report.topDecisionDrivers?.length > 0 && (
        <TopDecisionDrivers drivers={report.topDecisionDrivers} />
      )}

      {/* Consensus panels (only if not insufficient data) */}
      {!report.insufficientData && <ConsensusPanel report={report} />}

      {/* Agent evaluations (only if not insufficient data) */}
      {!report.insufficientData && report.agentScores.length > 0 && (
        <div className="mb-6">
          {/* Regular agents */}
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
            ⚡ SPECIALIST AGENT EVALUATIONS ({regularAgents.length})
          </div>
          <div className="space-y-2 mb-4">
            {regularAgents.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>

          {/* Devil's Advocate — separated visually */}
          {devilsAdvocate && (
            <div>
              <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <span>😈</span>
                <span>DEVIL'S ADVOCATE — ADVERSARIAL CHALLENGE</span>
              </div>
              <AgentCard agent={devilsAdvocate} />
            </div>
          )}
        </div>
      )}

      {/* ── Decision Upgrade Protocol ─────────────────────────────────────── */}
      <DecisionUpgradePanel
        domain="procurement"
        originalRunId={String(report.vendorName + "_" + report.generatedAt)}
        originalInput={report.recommendationRationale ?? ""}
        verdictBefore={report.finalRecommendation}
        confidenceBefore={
          report.overallConfidence === "High" ? 0.82
          : report.overallConfidence === "Medium" ? 0.62 : 0.42
        }
        blockingIssues={
          report.agentScores
            .filter(a => a.verdict === "REJECT")
            .flatMap(a => a.topRisks ?? [])
            .slice(0, 5)
        }
        conditions={report.suggestedNegotiationPoints ?? []}
        agentFeedback={
          report.agentScores
            .map(a => `${a.agentName}: ${a.keyReasoning}`)
            .join("\n")
        }
        procurementMeta={{
          vendorName: report.vendorName,
          category: report.category,
        }}
      />
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
        {agents.map((agent, i) => {
          const isDA = agent.id === "devils_advocate";
          return (
            <div
              key={agent.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                isDA
                  ? "bg-red-950/40 border-red-700/40"
                  : "bg-slate-800/60 border-slate-700/40"
              }`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${isDA ? "bg-red-400" : "bg-blue-400"}`} />
              <div className="text-left min-w-0">
                <div className={`text-xs font-semibold truncate ${isDA ? "text-red-300" : "text-slate-300"}`}>
                  {isDA ? "😈 " : ""}{agent.name}
                </div>
                <div className="text-slate-500 text-xs truncate">{agent.role}</div>
              </div>
            </div>
          );
        })}
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
      <span className={`text-xs font-bold px-2 py-1 rounded border shrink-0 ${cfg.badge}`}>
        {item.finalRecommendation === "CONDITIONAL_APPROVAL" ? "CONDITIONAL" : item.finalRecommendation}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-slate-200 text-sm font-semibold truncate">{item.vendorName}</div>
        <div className="text-slate-500 text-xs">{item.category}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-black ${cfg.color}`}>
          {item.finalRecommendation === "INSUFFICIENT_DATA" ? "N/A" : parseFloat(item.overallScore || "0").toFixed(1)}
        </div>
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
      <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
        {/* Blurred sample output */}
        <div className="filter blur-md opacity-30 pointer-events-none select-none p-10">
          <div className="max-w-4xl mx-auto">
            <div className="font-mono text-xs text-blue-400 tracking-widest mb-6">PROCUREMENT EVALUATION — SAMPLE OUTPUT</div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[{l:"VENDOR SCORE",v:"78 / 100",c:"text-green-400"},{l:"RECOMMENDATION",v:"APPROVE",c:"text-green-400"},{l:"RISK RATING",v:"LOW",c:"text-green-400"}].map(m => (
                <div key={m.l} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div className="font-mono text-[9px] text-slate-500 tracking-widest mb-2">{m.l}</div>
                  <div className={`text-2xl font-bold ${m.c}`}>{m.v}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 mb-4">
              <div className="font-mono text-[9px] text-blue-400 tracking-widest mb-4">AGENT COUNCIL BREAKDOWN</div>
              {["Financial Stability Agent","Compliance & Regulatory Agent","Delivery Capability Agent","ESG Screening Agent","Shariah Compliance Agent"].map((a, i) => (
                <div key={a} className="flex items-center gap-3 mb-3">
                  <div className="font-mono text-xs text-slate-400 flex-1">{a}</div>
                  <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${[78,82,71,88,75][i]}%` }} />
                  </div>
                  <div className="font-mono text-xs text-blue-400 w-8 text-right">{[78,82,71,88,75][i]}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="font-mono text-[9px] text-blue-400 tracking-widest mb-3">EVALUATION SUMMARY</div>
              <p className="text-sm text-slate-400 leading-relaxed">Vendor demonstrates strong financial stability with 8+ years of operating history and ISO 27001 certification. Delivery SLA compliance at 97.3% over the past 24 months. Minor ESG gap identified in Scope 3 emissions reporting. Shariah screening: no prohibited activities detected...</p>
            </div>
          </div>
        </div>

        {/* Overlay gate */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(2,6,23,0.88) 35%, rgba(2,6,23,0.97) 60%)" }}>
          <div className="text-center max-w-md px-6">
            <div className="text-4xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-slate-100 mb-3">Procurement Evaluation Engine</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">Score any vendor or supplier across financial stability, compliance, delivery capability, ESG, and Shariah criteria — structured output in under 60 seconds.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs tracking-widest px-6">
                SIGN IN TO EVALUATE →
              </Button>
              <a href="/pitchmirror" className="inline-flex items-center px-5 py-2 border border-slate-700 rounded text-slate-400 font-mono text-xs tracking-widest hover:text-slate-200 transition-colors">
                Try PitchMirror free →
              </a>
            </div>
            <p className="mt-5 font-mono text-[10px] text-slate-600">9 agents · ISO/Shariah/ESG criteria · avg 47s</p>
          </div>
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
            <a href="/deals" className="text-slate-500 hover:text-slate-300 text-xs font-mono tracking-widest transition-colors" title="Back to Workflow Selector">← WORKFLOWS</a>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-green-400 font-black text-sm tracking-widest">ACTIVE WORKFLOW: PROCUREMENT / VENDOR EVALUATION</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-700/40 font-semibold">
              AGENTS LOADED: 9
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
                  📦 PROCUREMENT WORKFLOW · VENDOR EVALUATION
                </span>
              </div>
              <h1 className="text-3xl font-black text-slate-100 tracking-tight">
                Vendor Evaluation Engine
              </h1>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Submit a vendor proposal or RFP response. {agents.length} specialist agents — including a Devil's Advocate — will evaluate
                financial stability, technical capability, compliance, security, risk, and strategic fit in parallel.
              </p>
              <div className="mt-3 text-xs text-slate-500 bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-2">
                💡 For best results, include: pricing details, technical specifications, compliance certifications, and contract terms.
                Vague proposals will trigger the <span className="text-amber-400 font-semibold">INSUFFICIENT DATA</span> override.
              </div>
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
                  placeholder="Paste the vendor's proposal, RFP response, or provide a detailed description of the vendor's offering, capabilities, pricing, security posture, compliance certifications, and track record..."
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 min-h-[180px] resize-y"
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
                    {agents.map((agent) => {
                      const isDA = agent.id === "devils_advocate";
                      return (
                        <div
                          key={agent.id}
                          className={`text-center p-2 rounded-lg border ${
                            isDA
                              ? "bg-red-950/40 border-red-700/30"
                              : "bg-slate-800/60 border-slate-700/30"
                          }`}
                        >
                          <div className={`text-xs font-semibold ${isDA ? "text-red-300" : "text-slate-300"}`}>
                            {isDA ? "😈 " : ""}{agent.name}
                          </div>
                          <div className="text-slate-500 text-xs mt-0.5">{agent.role}</div>
                        </div>
                      );
                    })}
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
                  report={historyReport.report as unknown as VendorEvaluationReport}
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
