/**
 * client/src/components/DecisionUpgradePanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Closed-Loop Decision Upgrade System — shared UI component.
 *
 * States:
 *   idle        → show "Generate Upgrade Protocol" button
 *   generating  → loading spinner while LLM generates protocol
 *   protocol    → show fix list with checkboxes and tags
 *   rerunning   → loading spinner while re-running pipeline
 *   delta       → show Delta Output panel (verdict change, confidence delta, etc.)
 *
 * Usage:
 *   <DecisionUpgradePanel
 *     domain="deal" | "procurement"
 *     originalRunId="123"
 *     originalInput="..."
 *     verdictBefore="REJECTED"
 *     confidenceBefore={0.38}
 *     blockingIssues={[...]}
 *     conditions={[...]}
 *     agentFeedback="..."
 *     // for procurement re-run:
 *     procurementMeta={{ vendorName, category, contractValue, duration, requirements }}
 *     // for deal re-run:
 *     dealMeta={{ dealName, councilMode }}
 *   />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Zap, ChevronDown, ChevronUp, RefreshCw, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle2, XCircle, Info, Edit3, RotateCcw,
  ArrowRight, Sparkles, Target
} from "lucide-react";

// ─── Types (mirrored from server) ─────────────────────────────────────────────

type FixTag = "ASSUMED" | "IMPROVED" | "USER_REQUIRED";
type FixCategory = "missing_input" | "performance_gap" | "structural_issue" | "narrative" | "risk_mitigation";

interface UpgradeFix {
  id: string;
  category: FixCategory;
  title: string;
  description: string;
  suggestion: string;
  tag: FixTag;
  fieldPath?: string;
  exampleValue?: string;
}

interface AppliedFix extends UpgradeFix {
  applied: boolean;
  userEdited?: string;
}

interface UpgradeProtocol {
  missingInputs: UpgradeFix[];
  performanceGaps: UpgradeFix[];
  structuralIssues: UpgradeFix[];
  narrativeFix: { original: string; improved: string; rationale: string };
  riskMitigationActions: UpgradeFix[];
  expectedOutcomeShift: { predictedVerdict: string; confidenceDelta: number; rationale: string };
  allFixes: UpgradeFix[];
}

interface DeltaOutput {
  verdictBefore: string;
  verdictAfter: string;
  verdictChanged: boolean;
  confidenceBefore: number;
  confidenceAfter: number;
  confidenceDelta: number;
  keyMetricChanges: Array<{ metric: string; before: string; after: string; direction: "improved" | "unchanged" | "worsened" }>;
  topImprovementFactors: string[];
  remainingGaps: string[];
  summary: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DecisionUpgradePanelProps {
  domain: "deal" | "procurement" | "enterprise" | "hiring";
  originalRunId: string;
  originalInput: string;
  verdictBefore: string;
  confidenceBefore: number;
  blockingIssues?: string[];
  conditions?: string[];
  agentFeedback?: string;
  procurementMeta?: {
    vendorName: string;
    category: string;
    contractValue?: string;
    duration?: string;
    requirements?: string;
  };
  dealMeta?: {
    dealName: string;
    councilMode?: "gcc" | "global_vc" | "india_pe";
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<FixTag, { label: string; color: string; bg: string; border: string; description: string }> = {
  ASSUMED: {
    label: "ASSUMED",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    description: "AI-generated placeholder — review before re-running",
  },
  IMPROVED: {
    label: "IMPROVED",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    description: "AI-improved framing — no new data required",
  },
  USER_REQUIRED: {
    label: "USER REQUIRED",
    color: "text-blue-300",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    description: "Real data needed from you before re-running",
  },
};

const CATEGORY_ICONS: Record<FixCategory, React.ReactNode> = {
  missing_input: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  performance_gap: <TrendingDown className="w-3.5 h-3.5 text-red-400" />,
  structural_issue: <XCircle className="w-3.5 h-3.5 text-orange-400" />,
  narrative: <Edit3 className="w-3.5 h-3.5 text-purple-400" />,
  risk_mitigation: <Target className="w-3.5 h-3.5 text-cyan-400" />,
};

const VERDICT_COLORS: Record<string, string> = {
  APPROVED: "text-emerald-400",
  APPROVE: "text-emerald-400",
  APPROVED_WITH_CONDITIONS: "text-yellow-400",
  CONDITIONAL_APPROVAL: "text-yellow-400",
  CONDITIONAL: "text-yellow-400",
  REJECTED: "text-red-400",
  REJECT: "text-red-400",
  VETOED: "text-red-500",
  INSUFFICIENT_DATA: "text-gray-400",
};

function verdictColor(v: string) {
  return VERDICT_COLORS[v.toUpperCase()] ?? "text-gray-300";
}

function verdictLabel(v: string) {
  const map: Record<string, string> = {
    APPROVED: "APPROVED",
    APPROVE: "APPROVED",
    APPROVED_WITH_CONDITIONS: "APPROVED WITH CONDITIONS",
    CONDITIONAL_APPROVAL: "CONDITIONAL APPROVAL",
    CONDITIONAL: "CONDITIONAL",
    REJECTED: "REJECTED",
    REJECT: "REJECTED",
    VETOED: "VETOED",
    INSUFFICIENT_DATA: "INSUFFICIENT DATA",
  };
  return map[v.toUpperCase()] ?? v;
}

// ─── Fix Card ─────────────────────────────────────────────────────────────────

function FixCard({
  fix,
  appliedFix,
  onToggle,
  onEdit,
}: {
  fix: UpgradeFix;
  appliedFix: AppliedFix;
  onToggle: (id: string) => void;
  onEdit: (id: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(appliedFix.userEdited ?? fix.suggestion);
  const tag = TAG_CONFIG[fix.tag];

  return (
    <div className={`rounded-lg border p-3 transition-all ${appliedFix.applied ? `${tag.bg} ${tag.border}` : "bg-white/3 border-white/10 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={appliedFix.applied}
          onCheckedChange={() => onToggle(fix.id)}
          className="mt-0.5 border-white/30"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {CATEGORY_ICONS[fix.category]}
            <span className="text-sm font-medium text-white/90">{fix.title}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.bg} ${tag.color} ${tag.border} border`}>
              {tag.label}
            </span>
          </div>
          <p className="text-xs text-white/60 mb-2">{fix.description}</p>

          {appliedFix.applied && (
            <div className="mt-2">
              {editing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-xs bg-black/30 border-white/20 text-white/90 min-h-[60px] resize-none"
                    placeholder="Edit the suggestion..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-6 px-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                      onClick={() => { onEdit(fix.id, editValue); setEditing(false); }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-6 px-2 text-white/50"
                      onClick={() => { setEditValue(appliedFix.userEdited ?? fix.suggestion); setEditing(false); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 text-xs text-white/75 bg-black/20 rounded p-2 border border-white/10">
                    {appliedFix.userEdited ?? fix.suggestion}
                    {fix.tag === "ASSUMED" && fix.exampleValue && !appliedFix.userEdited && (
                      <span className="ml-1 text-amber-400/70">[ASSUMED: {fix.exampleValue}]</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-white/40 hover:text-white/80 shrink-0"
                    onClick={() => setEditing(true)}
                    title="Edit suggestion"
                  >
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delta Output Panel ───────────────────────────────────────────────────────

function DeltaPanel({ delta, onReset }: { delta: DeltaOutput; onReset: () => void }) {
  const deltaSign = delta.confidenceDelta >= 0 ? "+" : "";
  const deltaColor = delta.confidenceDelta > 0 ? "text-emerald-400" : delta.confidenceDelta < 0 ? "text-red-400" : "text-gray-400";

  return (
    <div className="space-y-4">
      {/* Verdict change banner */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-white/2 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Before</div>
              <div className={`text-sm font-bold ${verdictColor(delta.verdictBefore)}`}>
                {verdictLabel(delta.verdictBefore)}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white/30" />
            <div className="text-center">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">After</div>
              <div className={`text-sm font-bold ${verdictColor(delta.verdictAfter)}`}>
                {verdictLabel(delta.verdictAfter)}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Confidence Δ</div>
            <div className={`text-lg font-bold ${deltaColor}`}>
              {deltaSign}{(delta.confidenceDelta * 100).toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">New Confidence</div>
            <div className="text-lg font-bold text-white">
              {(delta.confidenceAfter * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        {delta.verdictChanged && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 rounded-lg px-3 py-2 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Verdict upgraded — the applied fixes resolved key blocking issues.
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="text-sm text-white/70 leading-relaxed bg-white/3 rounded-lg p-3 border border-white/8">
        {delta.summary}
      </div>

      {/* Key metric changes */}
      {delta.keyMetricChanges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Key Metric Changes</h4>
          <div className="space-y-2">
            {delta.keyMetricChanges.map((m, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className="w-4 shrink-0">
                  {m.direction === "improved" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> :
                   m.direction === "worsened" ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> :
                   <Minus className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                <span className="text-white/60 w-32 shrink-0">{m.metric}</span>
                <span className="text-white/40 line-through">{m.before}</span>
                <ArrowRight className="w-3 h-3 text-white/20 shrink-0" />
                <span className={m.direction === "improved" ? "text-emerald-300" : m.direction === "worsened" ? "text-red-300" : "text-white/60"}>
                  {m.after}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top improvement factors */}
      {delta.topImprovementFactors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Top Improvement Factors</h4>
          <div className="space-y-1">
            {delta.topImprovementFactors.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Remaining gaps */}
      {delta.remainingGaps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Remaining Gaps</h4>
          <div className="space-y-1">
            {delta.remainingGaps.map((g, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                {g}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-white/40 hover:text-white/70 gap-1.5"
        onClick={onReset}
      >
        <RotateCcw className="w-3 h-3" />
        Run another upgrade cycle
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type PanelState = "idle" | "generating" | "protocol" | "rerunning" | "delta";

export function DecisionUpgradePanel(props: DecisionUpgradePanelProps) {
  const {
    domain, originalRunId, originalInput, verdictBefore, confidenceBefore,
    blockingIssues = [], conditions = [], agentFeedback = "",
    procurementMeta, dealMeta,
  } = props;

  const [state, setState] = useState<PanelState>("idle");
  const [protocol, setProtocol] = useState<UpgradeProtocol | null>(null);
  const [upgradeRunId, setUpgradeRunId] = useState<number | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<AppliedFix[]>([]);
  const [delta, setDelta] = useState<DeltaOutput | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [strictMode, setStrictMode] = useState(false);

  const generateProtocol = trpc.decisionUpgrade.generateProtocol.useMutation();
  const applyFixesRerun = trpc.decisionUpgrade.applyFixesRerun.useMutation();

  // Only show for non-approved verdicts
  const triggerVerdicts = ["REJECTED", "APPROVED_WITH_CONDITIONS", "VETOED", "INSUFFICIENT_DATA",
    "REJECT", "CONDITIONAL_APPROVAL", "CONDITIONAL"];
  const shouldShow = triggerVerdicts.some(v => verdictBefore.toUpperCase().includes(v.toUpperCase()));

  if (!shouldShow) return null;

  const handleGenerate = useCallback(async () => {
    setState("generating");
    try {
      const result = await generateProtocol.mutateAsync({
        domain,
        originalRunId,
        originalInput,
        verdictBefore,
        confidenceBefore,
        blockingIssues,
        conditions,
        agentFeedback,
        strictMode,
      });
      setProtocol(result.protocol);
      setUpgradeRunId(result.upgradeRunId);
      // Initialize all fixes as checked
      setAppliedFixes(result.protocol.allFixes.map(f => ({ ...f, applied: true })));
      setState("protocol");
    } catch (err: any) {
      toast.error(`Failed to generate upgrade protocol: ${err.message}`);
      setState("idle");
    }
  }, [domain, originalRunId, originalInput, verdictBefore, confidenceBefore, blockingIssues, conditions, agentFeedback, strictMode]);

  const handleToggleFix = useCallback((id: string) => {
    setAppliedFixes(prev => prev.map(f => f.id === id ? { ...f, applied: !f.applied } : f));
  }, []);

  const handleEditFix = useCallback((id: string, value: string) => {
    setAppliedFixes(prev => prev.map(f => f.id === id ? { ...f, userEdited: value } : f));
  }, []);

  const handleAcceptAll = useCallback(() => {
    setAppliedFixes(prev => prev.map(f => ({ ...f, applied: true })));
  }, []);

  const handleRerun = useCallback(async () => {
    if (!upgradeRunId) return;
    const selectedFixes = appliedFixes.filter(f => f.applied);
    if (selectedFixes.length === 0) {
      toast.error("No fixes selected — select at least one fix before re-running.");
      return;
    }
    setState("rerunning");
    try {
      const result = await applyFixesRerun.mutateAsync({
        upgradeRunId,
        domain,
        originalInput,
        appliedFixes: selectedFixes,
        procurementMeta,
        dealMeta,
      });
      setDelta(result.delta);
      setState("delta");
    } catch (err: any) {
      toast.error(`Re-run failed: ${err.message}`);
      setState("protocol");
    }
  }, [upgradeRunId, appliedFixes, domain, originalInput, procurementMeta, dealMeta]);

  const handleReset = useCallback(() => {
    setState("idle");
    setProtocol(null);
    setUpgradeRunId(null);
    setAppliedFixes([]);
    setDelta(null);
  }, []);

  const selectedCount = appliedFixes.filter(f => f.applied).length;
  const userRequiredCount = appliedFixes.filter(f => f.applied && f.tag === "USER_REQUIRED").length;

  return (
    <Card className="border-white/10 bg-gradient-to-br from-indigo-950/40 to-purple-950/30 mt-6">
      <CardHeader className="pb-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-white/90">
                Decision Upgrade Protocol
              </CardTitle>
              <p className="text-[11px] text-white/45 mt-0.5">
                {state === "idle" && "AI-powered closed-loop improvement system"}
                {state === "generating" && "Analyzing evaluation gaps..."}
                {state === "protocol" && `${selectedCount} fix${selectedCount !== 1 ? "es" : ""} selected — ready to re-run`}
                {state === "rerunning" && "Re-running evaluation with improvements..."}
                {state === "delta" && "Upgrade complete — delta output ready"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state === "delta" && delta?.verdictChanged && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                Verdict Upgraded
              </Badge>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* ── IDLE ── */}
          {state === "idle" && (
            <div className="space-y-4">
              <div className="text-xs text-white/55 leading-relaxed">
                The Decision Upgrade Protocol analyzes why this evaluation was <span className={`font-semibold ${verdictColor(verdictBefore)}`}>{verdictLabel(verdictBefore)}</span> and generates a structured set of fixes — missing inputs, performance gaps, structural issues, and risk mitigations. You select which fixes to apply, then re-run the evaluation to see the verdict change.
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="strict-mode"
                    checked={strictMode}
                    onCheckedChange={(v) => setStrictMode(!!v)}
                    className="border-white/30"
                  />
                  <label htmlFor="strict-mode" className="text-xs text-white/60 cursor-pointer">
                    Strict mode (no ASSUMED fixes)
                  </label>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 w-full sm:w-auto"
                size="sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Upgrade Protocol
              </Button>
            </div>
          )}

          {/* ── GENERATING ── */}
          {state === "generating" && (
            <div className="flex items-center gap-3 py-6 justify-center">
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm text-white/60">Analyzing evaluation gaps and generating upgrade fixes...</span>
            </div>
          )}

          {/* ── PROTOCOL ── */}
          {state === "protocol" && protocol && (
            <div className="space-y-5">
              {/* Expected outcome shift */}
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/8 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300">Expected Outcome If All Fixes Applied</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/70">
                  <span>Predicted verdict: <span className={`font-bold ${verdictColor(protocol.expectedOutcomeShift.predictedVerdict)}`}>{verdictLabel(protocol.expectedOutcomeShift.predictedVerdict)}</span></span>
                  <span className="text-white/30">·</span>
                  <span>Confidence: <span className="text-emerald-300 font-semibold">+{(protocol.expectedOutcomeShift.confidenceDelta * 100).toFixed(0)}%</span></span>
                </div>
                <p className="text-xs text-white/50 mt-1.5">{protocol.expectedOutcomeShift.rationale}</p>
              </div>

              {/* Narrative fix */}
              {protocol.narrativeFix.original && (
                <div>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Edit3 className="w-3 h-3 text-purple-400" /> Narrative Improvement
                  </h4>
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                    <div>
                      <span className="text-[10px] text-white/40 uppercase tracking-wider">Original</span>
                      <p className="text-xs text-white/50 mt-0.5 line-through">{protocol.narrativeFix.original}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Improved</span>
                      <p className="text-xs text-emerald-300/80 mt-0.5">{protocol.narrativeFix.improved}</p>
                    </div>
                    <p className="text-[11px] text-white/40 italic">{protocol.narrativeFix.rationale}</p>
                  </div>
                </div>
              )}

              {/* Fix sections */}
              {[
                { key: "missingInputs", label: "Missing Inputs", fixes: protocol.missingInputs },
                { key: "performanceGaps", label: "Performance Gaps", fixes: protocol.performanceGaps },
                { key: "structuralIssues", label: "Structural Issues", fixes: protocol.structuralIssues },
                { key: "riskMitigationActions", label: "Risk Mitigation Actions", fixes: protocol.riskMitigationActions },
              ].filter(s => s.fixes.length > 0).map(section => (
                <div key={section.key}>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{section.label}</h4>
                  <div className="space-y-2">
                    {section.fixes.map(fix => {
                      const af = appliedFixes.find(f => f.id === fix.id) ?? { ...fix, applied: true };
                      return (
                        <FixCard
                          key={fix.id}
                          fix={fix}
                          appliedFix={af}
                          onToggle={handleToggleFix}
                          onEdit={handleEditFix}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Tag legend */}
              <div className="flex flex-wrap gap-3 pt-1">
                {Object.entries(TAG_CONFIG).map(([tag, cfg]) => (
                  <div key={tag} className="flex items-center gap-1.5 text-[10px] text-white/40">
                    <span className={`px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} ${cfg.border} border font-bold`}>{cfg.label}</span>
                    <span>{cfg.description}</span>
                  </div>
                ))}
              </div>

              {/* USER_REQUIRED warning */}
              {userRequiredCount > 0 && (
                <div className="flex items-start gap-2 text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-2 border border-blue-500/20">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{userRequiredCount} fix{userRequiredCount !== 1 ? "es" : ""} require real data from you. Edit the suggestion field before re-running for best results.</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <Button
                  onClick={handleRerun}
                  disabled={selectedCount === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                  size="sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Apply {selectedCount} Fix{selectedCount !== 1 ? "es" : ""} & Re-run
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-white/20 text-white/60 hover:text-white gap-1.5"
                  onClick={handleAcceptAll}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Accept All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-white/40 hover:text-white/60 gap-1.5"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
              </div>
            </div>
          )}

          {/* ── RERUNNING ── */}
          {state === "rerunning" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <div className="text-center">
                <p className="text-sm text-white/70 font-medium">Re-running evaluation with improvements...</p>
                <p className="text-xs text-white/40 mt-1">All {selectedCount} selected fix{selectedCount !== 1 ? "es" : ""} applied to the improved submission</p>
              </div>
            </div>
          )}

          {/* ── DELTA ── */}
          {state === "delta" && delta && (
            <DeltaPanel delta={delta} onReset={handleReset} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default DecisionUpgradePanel;
