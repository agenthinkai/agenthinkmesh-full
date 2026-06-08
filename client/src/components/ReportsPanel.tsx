/**
 * ReportsPanel.tsx — Unified Institutional Reports Export Hub
 *
 * Consolidates all three report exports:
 *   1. IC Memo (16+17 sections) — PDF
 *   2. Investment Readiness Report (Decision Upgrade Protocol) — PDF / Text / JSON
 *   3. Strategic Stress Test Report — PDF / Text / JSON
 *
 * Appears as a dedicated section at the bottom of the ICReport result view.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, FileJson, FileCode2, BarChart3, ShieldCheck } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpgradeFix {
  id: string;
  category: string;
  title: string;
  description: string;
  suggestion: string;
  tag: "ASSUMED" | "IMPROVED" | "USER_REQUIRED";
  fieldPath?: string;
  exampleValue?: string;
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

interface SimAggregation {
  executiveSummary: string | null;
  decisionDistribution: {
    // PDF-builder field names
    approvePct?: number;
    conditionalPct?: number;
    rejectPct?: number;
    vetoPct?: number;
    totalScenarios?: number;
    confidenceDistribution?: { low: number; medium: number; high: number };
    // Aggregator field names (also accepted)
    approveCount?: number;
    conditionalCount?: number;
    rejectCount?: number;
    hardNoPct?: number;
    hardNoCount?: number;
    [key: string]: unknown;
  };
  // Accept both PDF-builder and aggregator field shapes (any)
  failureVectors: Array<Record<string, unknown>>;
  approvalPathways: Array<Record<string, unknown>>;
  sensitivitySurface: Array<Record<string, unknown>>;
  governanceHeatmap: Array<Record<string, unknown>>;
}

export interface ReportsPanelProps {
  dealName: string;
  dealId?: string;
  verdict: string;
  confidenceScore: number;
  // IC Memo handler (already implemented in ICReport)
  onExportICMemo: () => void;
  icMemoLoading: boolean;
  // Proof Report — requires a council session ID
  proofSessionId?: string | null;
  // Upgrade Protocol data (lifted from DecisionUpgradePanel via callbacks)
  upgradeProtocol?: UpgradeProtocol | null;
  upgradeDelta?: DeltaOutput | null;
  // Simulation data (fetched from scenarioSim.getRunStatus if a completed run exists)
  simRunId?: string | null;
  simMode?: string;
  simTargetCount?: number;
  simCompletedAt?: string | Date;
  simAggregation?: SimAggregation | null;
  /**
   * Upgraded scenario fingerprint — when present, a "Simulation Resilience Impact"
   * section is added to the Stress Test Report PDF. Omit or pass null to suppress.
   */
  upgradedFingerprint?: {
    resilienceDelta?: number | null;
    upgradeEffectiveness?: number | null;
    rescueabilityScore?: number | null;
    structuralFragilityScore?: number | null;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ExportFormat = "pdf" | "text" | "json";

function downloadBlob(base64: string, filename: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 40);
}

function formatLabel(fmt: ExportFormat): string {
  if (fmt === "pdf") return "PDF";
  if (fmt === "text") return "TXT";
  return "JSON";
}

// ── Report Card ───────────────────────────────────────────────────────────────

interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  available: boolean;
  unavailableReason?: string;
  formats: ExportFormat[];
  selectedFormat: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  onExport: () => void;
  loading: boolean;
  done: boolean;
  accentColor?: string;
}

function ReportCard({
  icon, title, subtitle, badge, badgeVariant = "secondary",
  available, unavailableReason,
  formats, selectedFormat, onFormatChange,
  onExport, loading, done, accentColor = "border-white/10",
}: ReportCardProps) {
  return (
    <div className={`rounded-xl border ${accentColor} bg-white/[0.03] p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-white/60 shrink-0">{icon}</div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white/90">{title}</span>
              {badge && (
                <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{subtitle}</p>
          </div>
        </div>
      </div>

      {available ? (
        <div className="flex items-center gap-2 mt-1">
          {formats.length > 1 && (
            <Select value={selectedFormat} onValueChange={v => onFormatChange(v as ExportFormat)}>
              <SelectTrigger className="h-7 w-[80px] text-xs bg-white/5 border-white/10 text-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1923] border-white/10">
                {formats.map(f => (
                  <SelectItem key={f} value={f} className="text-xs text-white/80">
                    {formatLabel(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            disabled={loading || done}
            className="h-7 text-xs gap-1.5 bg-white/5 border-white/15 hover:bg-white/10 text-white/80"
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
            ) : done ? (
              <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Downloaded</>
            ) : (
              <><Download className="h-3 w-3" /> Export {formatLabel(selectedFormat)}</>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-white/30 mt-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{unavailableReason}</span>
        </div>
      )}
    </div>
  );
}

// ── Interpretation Pattern Detection ────────────────────────────────────────

interface InterpretationPattern {
  title: string;
  interpretation: string;
  icPosture: string;
  color: string; // Tailwind border/text color
}

function detectInterpretationPattern(
  approvePct: number,
  conditionalPct: number,
  rejectPct: number,
  vetoPct: number,
): InterpretationPattern {
  // 1. High Conviction / Tight Distribution — approve > 70%
  if (approvePct >= 70) {
    return {
      title: "High Conviction / Tight Distribution",
      interpretation: "Scenario outcomes converge strongly on an investable result across tested assumptions.",
      icPosture: "Proceed with standard diligence. Simulation supports high-confidence approval.",
      color: "border-emerald-500/40 text-emerald-400",
    };
  }
  // 2. Optionality / Upside Skew — approve + conditional > 60% and approve > 30%
  if (approvePct + conditionalPct >= 60 && approvePct >= 30) {
    return {
      title: "Optionality / Upside Skew",
      interpretation: "Majority of scenarios produce investable outcomes, but execution quality is material.",
      icPosture: "Conditional approval with milestone-based exposure. Monitor execution triggers closely.",
      color: "border-blue-500/40 text-blue-400",
    };
  }
  // 3. Wide Uncertainty Band — conditional > 30% and no dominant outcome
  if (conditionalPct >= 30 && approvePct < 40 && rejectPct < 50) {
    return {
      title: "Wide Uncertainty Band",
      interpretation: "Scenario outcomes vary materially across assumptions. No dominant outcome emerges.",
      icPosture: "Proceed only with milestone-based exposure or tighter diligence gating.",
      color: "border-amber-500/40 text-amber-400",
    };
  }
  // 4. Downside-Asymmetric — reject > 50% but veto < 20%
  if (rejectPct >= 50 && vetoPct < 20) {
    return {
      title: "Downside-Asymmetric",
      interpretation: "Downside scenarios dominate. Upside requires narrow conditions that rarely materialise.",
      icPosture: "Reject or require fundamental restructuring before re-evaluation. Document specific conditions for reconsideration.",
      color: "border-orange-500/40 text-orange-400",
    };
  }
  // 5. Fragile Upside — veto > 20% or approve < 5%
  if (vetoPct >= 20 || approvePct < 5) {
    return {
      title: "Fragile Upside",
      interpretation: "Hard governance blockers fire frequently. The deal is structurally fragile, not merely risky.",
      icPosture: "Reject pending fundamental restructuring. Governance, compliance, or regulatory exposure must be resolved first.",
      color: "border-red-500/40 text-red-400",
    };
  }
  // Default fallback
  return {
    title: "Wide Uncertainty Band",
    interpretation: "Scenario outcomes vary materially across assumptions.",
    icPosture: "Proceed only with milestone-based exposure or tighter diligence gating.",
    color: "border-amber-500/40 text-amber-400",
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ReportsPanel({
  dealName, dealId, verdict, confidenceScore,
  onExportICMemo, icMemoLoading,
  upgradeProtocol, upgradeDelta,
  simRunId, simMode, simTargetCount, simCompletedAt, simAggregation,
  upgradedFingerprint,
  proofSessionId,
}: ReportsPanelProps) {
  // ── Upgrade Protocol export state ─────────────────────────────────────────
  const [upgradeFmt, setUpgradeFmt] = useState<ExportFormat>("pdf");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeDone, setUpgradeDone] = useState(false);

  // ── Stress Test Report export state ──────────────────────────────────────
  const [stressFmt, setStressFmt] = useState<ExportFormat>("pdf");
  const [stressLoading, setStressLoading] = useState(false);
  const [stressDone, setStressDone] = useState(false);

  // ── IC Memo done state ────────────────────────────────────────────────────
  const [icMemoDone, setIcMemoDone] = useState(false);

  // ── Proof Report export state ─────────────────────────────────────────────
  const [proofFmt, setProofFmt] = useState<ExportFormat>("pdf");
  const [proofLoading, setProofLoading] = useState(false);
  const [proofDone, setProofDone] = useState(false);

  const upgradeProtocolPdf = trpc.dealScreener.upgradeProtocolPdf.useMutation();
  const stressTestReportPdf = trpc.dealScreener.stressTestReportPdf.useMutation();
  const proofReportMutation = trpc.proofEngine.proofReport.useMutation();

  // ── Export: Proof Report ─────────────────────────────────────────────────
  const handleExportProof = async () => {
    if (!proofSessionId) return;
    setProofLoading(true);
    setProofDone(false);
    try {
      const res = await proofReportMutation.mutateAsync({
        sessionId: proofSessionId,
        format: proofFmt === "json" ? "json" : "pdf",
      });
      const name = safeName(dealName);
      if (proofFmt === "pdf" && res.pdfBase64) {
        downloadBlob(res.pdfBase64, `${name}_Institutional_Proof_Report.pdf`, "application/pdf");
      }
      if (proofFmt === "json" && res.report) {
        downloadText(JSON.stringify(res.report, null, 2), `${name}_Institutional_Proof_Report.json`);
      }
      setProofDone(true);
      toast.success("Institutional Proof Report downloaded.");
      setTimeout(() => setProofDone(false), 3000);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message?.slice(0, 80)}`);
    } finally {
      setProofLoading(false);
    }
  };

  // ── Export: Upgrade Protocol ──────────────────────────────────────────────
  const handleExportUpgrade = async () => {
    if (!upgradeProtocol) return;
    setUpgradeLoading(true);
    setUpgradeDone(false);
    try {
      const res = await upgradeProtocolPdf.mutateAsync({
        dealName,
        verdictBefore: verdict,
        confidenceBefore: Math.round(confidenceScore * 100),
        missingInputs: upgradeProtocol.missingInputs,
        performanceGaps: upgradeProtocol.performanceGaps,
        structuralIssues: upgradeProtocol.structuralIssues,
        narrativeFix: upgradeProtocol.narrativeFix,
        riskMitigationActions: upgradeProtocol.riskMitigationActions,
        expectedOutcomeShift: upgradeProtocol.expectedOutcomeShift,
        allFixes: upgradeProtocol.allFixes,
        delta: upgradeDelta ?? undefined,
        format: upgradeFmt,
      });
      const name = safeName(dealName);
      if (res.format === "pdf" && res.base64) {
        downloadBlob(res.base64, `${name}_Investment_Readiness_Report.pdf`, "application/pdf");
      } else if (res.text) {
        const ext = res.format === "json" ? "json" : "txt";
        downloadText(res.text, `${name}_Investment_Readiness_Report.${ext}`);
      }
      setUpgradeDone(true);
      toast.success("Investment Readiness Report downloaded.");
      setTimeout(() => setUpgradeDone(false), 3000);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message?.slice(0, 80)}`);
    } finally {
      setUpgradeLoading(false);
    }
  };

  // ── Export: Stress Test Report ────────────────────────────────────────────
  const handleExportStress = async () => {
    if (!simAggregation?.decisionDistribution) return;
    setStressLoading(true);
    setStressDone(false);
    try {
      const res = await stressTestReportPdf.mutateAsync({
        dealName,
        baseVerdict: verdict,
        mode: safeSimMode,
        targetCount: safeSimTargetCount,
        completedAt: safeSimCompletedAt,
        executiveSummary: simAggregation!.executiveSummary ?? "",
        decisionDistribution: {
          approvePct:    (simAggregation!.decisionDistribution.approvePct as number | undefined) ?? 0,
          conditionalPct: (simAggregation!.decisionDistribution.conditionalPct as number | undefined) ?? 0,
          rejectPct:     (simAggregation!.decisionDistribution.rejectPct as number | undefined) ?? 0,
          vetoPct:       (simAggregation!.decisionDistribution.vetoPct as number | undefined) ?? (simAggregation!.decisionDistribution.hardNoPct as number | undefined) ?? 0,
          totalScenarios: (simAggregation!.decisionDistribution.totalScenarios as number | undefined) ?? safeSimTargetCount,
          ...(simAggregation!.decisionDistribution.confidenceDistribution ? { confidenceDistribution: simAggregation!.decisionDistribution.confidenceDistribution } : {}),
          // Pass through aggregator fields so server-side normalization can use them
          hardNoPct:     simAggregation!.decisionDistribution.hardNoPct as number | undefined,
          hardNoCount:   simAggregation!.decisionDistribution.hardNoCount as number | undefined,
          approveCount:  simAggregation!.decisionDistribution.approveCount as number | undefined,
          conditionalCount: simAggregation!.decisionDistribution.conditionalCount as number | undefined,
          rejectCount:   simAggregation!.decisionDistribution.rejectCount as number | undefined,
        } as any,
        failureVectors: simAggregation!.failureVectors ?? [],
        approvalPathways: simAggregation!.approvalPathways ?? [],
        sensitivitySurface: simAggregation!.sensitivitySurface ?? [],
        governanceHeatmap: simAggregation!.governanceHeatmap ?? [],
        // Task 2: Run ID traceability — wire through to PDF cover
        runId: simRunId ?? undefined,
        format: stressFmt,
        // DR-2: Pass upgraded fingerprint metrics for Simulation Resilience Impact section
        ...(upgradedFingerprint ? {
          upgradedFingerprint: {
            resilienceDelta:         upgradedFingerprint.resilienceDelta ?? null,
            upgradeEffectiveness:    upgradedFingerprint.upgradeEffectiveness ?? null,
            rescueabilityScore:      upgradedFingerprint.rescueabilityScore ?? null,
            structuralFragilityScore: upgradedFingerprint.structuralFragilityScore ?? null,
          },
        } : {}),
      });
      const name = safeName(dealName);
      if (res.format === "pdf" && res.base64) {
        downloadBlob(res.base64, `${name}_Strategic_Stress_Test_Report.pdf`, "application/pdf");
      } else if (res.text) {
        const ext = res.format === "json" ? "json" : "txt";
        downloadText(res.text, `${name}_Strategic_Stress_Test_Report.${ext}`);
      }
      setStressDone(true);
      toast.success("Strategic Stress Test Report downloaded.");
      setTimeout(() => setStressDone(false), 3000);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message?.slice(0, 80)}`);
    } finally {
      setStressLoading(false);
    }
  };

  // ── IC Memo wrapper ───────────────────────────────────────────────────────
  const handleICMemo = () => {
    onExportICMemo();
    setIcMemoDone(true);
    setTimeout(() => setIcMemoDone(false), 5000);
  };

  const hasProof = !!proofSessionId;
  const hasUpgrade = !!upgradeProtocol;
  // Unlock if aggregation + decisionDistribution exist; mode/targetCount/completedAt are optional
  const hasStress = !!(simAggregation?.decisionDistribution);
  // Safe fallbacks for display when some metadata is missing
  const safeSimMode = simMode ?? "unknown";
  const safeSimTargetCount = simTargetCount ?? (simAggregation?.decisionDistribution?.totalScenarios ?? 0);
  const safeSimCompletedAt = simCompletedAt
    ? (simCompletedAt instanceof Date ? simCompletedAt.toISOString() : simCompletedAt)
    : new Date().toISOString();

  return (
    <TooltipProvider>
      <Card className="border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/80 mt-6">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-white/50" />
            <CardTitle className="text-sm font-semibold text-white/80 tracking-wide uppercase">
              Institutional Reports
            </CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white/40 ml-1">
              Export Hub
            </Badge>
          </div>
          <p className="text-xs text-white/35 mt-1">
            Download standalone institutional-grade reports for this deal. Each report is independently formatted for distribution to LPs, IC committees, or internal governance teams.
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {/* ── Report 1: IC Memo ────────────────────────────────────────── */}
            <ReportCard
              icon={<FileText className="h-4 w-4" />}
              title="IC Memo"
              subtitle="Full 16-section Investment Committee Memorandum with council analysis, Monte Carlo, and scenario stress summary."
              badge="16–17 Sections"
              badgeVariant="secondary"
              available
              formats={["pdf"]}
              selectedFormat="pdf"
              onFormatChange={() => {}}
              onExport={handleICMemo}
              loading={icMemoLoading}
              done={icMemoDone}
              accentColor="border-blue-500/20"
            />

            {/* ── Report 2: Investment Readiness Report ────────────────────── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ReportCard
                    icon={<FileCode2 className="h-4 w-4" />}
                    title="Investment Readiness Report"
                    subtitle={hasUpgrade
                      ? `${upgradeProtocol!.allFixes.length} fixes identified. Includes executive summary, all fix categories, and${upgradeDelta ? " re-run delta." : " upgrade impact forecast."}`
                      : "Generate the Decision Upgrade Protocol first to unlock this report."}
                    badge={hasUpgrade ? `${upgradeProtocol!.allFixes.length} Fixes` : "Requires Protocol"}
                    badgeVariant={hasUpgrade ? "default" : "outline"}
                    available={hasUpgrade}
                    unavailableReason="Generate the Decision Upgrade Protocol first."
                    formats={["pdf", "text", "json"]}
                    selectedFormat={upgradeFmt}
                    onFormatChange={setUpgradeFmt}
                    onExport={handleExportUpgrade}
                    loading={upgradeLoading}
                    done={upgradeDone}
                    accentColor={hasUpgrade ? "border-purple-500/20" : "border-white/5"}
                  />
                </div>
              </TooltipTrigger>
              {!hasUpgrade && (
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Generate the Decision Upgrade Protocol in the section above, then return here to export the Investment Readiness Report.
                </TooltipContent>
              )}
            </Tooltip>

            {/* ── Report 3: Strategic Stress Test Report ───────────────────── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ReportCard
                    icon={<BarChart3 className="h-4 w-4" />}
                    title="Strategic Stress Test Report"
                    subtitle={hasStress
                      ? `${safeSimTargetCount.toLocaleString()} scenarios · ${safeSimMode} mode · ${((simAggregation!.decisionDistribution.approvePct as number | undefined) ?? 0).toFixed(1)}% approve rate.`
                      : "Run a Strategic Scenario Simulation first to unlock this report."}
                    badge={hasStress ? `${safeSimTargetCount.toLocaleString()} Scenarios` : "Requires Simulation"}
                    badgeVariant={hasStress ? "default" : "outline"}
                    available={hasStress}
                    unavailableReason="Run a Strategic Scenario Simulation first."
                    formats={["pdf", "text", "json"]}
                    selectedFormat={stressFmt}
                    onFormatChange={setStressFmt}
                    onExport={handleExportStress}
                    loading={stressLoading}
                    done={stressDone}
                    accentColor={hasStress ? "border-teal-500/20" : "border-white/5"}
                  />
                </div>
              </TooltipTrigger>
              {!hasStress && (
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  Run a Strategic Scenario Simulation in the section below, then return here to export the Stress Test Report.
                </TooltipContent>
              )}
            </Tooltip>

            {/* ── Report 4: Institutional Proof Report ─────────────────────── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ReportCard
                    icon={<ShieldCheck className="h-4 w-4" />}
                    title="Institutional Proof Report"
                    subtitle={hasProof
                      ? "13-section governance proof record. Includes release gate, evidence chain, constitution version, and full audit references."
                      : "Requires a completed Council session with a session ID."}
                    badge={hasProof ? "13 Sections" : "Requires Session"}
                    badgeVariant={hasProof ? "default" : "outline"}
                    available={hasProof}
                    unavailableReason="A council session ID is required to generate the Proof Report."
                    formats={["pdf", "json"]}
                    selectedFormat={proofFmt === "text" ? "pdf" : proofFmt}
                    onFormatChange={setProofFmt}
                    onExport={handleExportProof}
                    loading={proofLoading}
                    done={proofDone}
                    accentColor={hasProof ? "border-amber-500/20" : "border-white/5"}
                  />
                </div>
              </TooltipTrigger>
              {!hasProof && (
                <TooltipContent side="top" className="max-w-[220px] text-xs">
                  A completed Council session is required. Pass the session ID via the proofSessionId prop.
                </TooltipContent>
              )}
            </Tooltip>

          </div>

          {/* ── Interpretation Pattern Callout ─────────────────────────────────────── */}
          {hasStress && (() => {
            const _approvePct    = (simAggregation!.decisionDistribution.approvePct as number | undefined) ?? 0;
            const _conditionalPct = (simAggregation!.decisionDistribution.conditionalPct as number | undefined) ?? 0;
            const _rejectPct     = (simAggregation!.decisionDistribution.rejectPct as number | undefined) ?? 0;
            const _vetoPct       = (simAggregation!.decisionDistribution.vetoPct as number | undefined) ?? 0;
            const pattern = detectInterpretationPattern(_approvePct, _conditionalPct, _rejectPct, _vetoPct);
            const borderClass = pattern.color.split(" ").find(c => c.startsWith("border-")) ?? "border-white/20";
            const textClass   = pattern.color.split(" ").find(c => c.startsWith("text-")) ?? "text-white/70";
            return (
              <div className={`mt-3 rounded-lg border ${borderClass} bg-white/[0.02] px-4 py-3`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">AI IC Interpretation Guidance</span>
                    </div>
                    <div className={`text-sm font-semibold ${textClass} mb-1.5`}>{pattern.title}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      <div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider">Interpretation</span>
                        <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{pattern.interpretation}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider">Suggested IC Posture</span>
                        <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{pattern.icPosture}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Status row ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] text-white/30">
              <div className={`h-1.5 w-1.5 rounded-full ${hasUpgrade ? "bg-purple-400" : "bg-white/15"}`} />
              <span>Protocol {hasUpgrade ? "ready" : "not generated"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/30">
              <div className={`h-1.5 w-1.5 rounded-full ${upgradeDelta ? "bg-emerald-400" : "bg-white/15"}`} />
              <span>Delta {upgradeDelta ? "available" : "not run"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/30">
              <div className={`h-1.5 w-1.5 rounded-full ${hasStress ? "bg-teal-400" : "bg-white/15"}`} />
              <span>Simulation {hasStress ? `${simTargetCount!.toLocaleString()} scenarios` : "not run"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/30">
              <div className={`h-1.5 w-1.5 rounded-full ${hasProof ? "bg-amber-400" : "bg-white/15"}`} />
              <span>Proof {hasProof ? "session ready" : "no session"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
