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
import { FileText, Download, Loader2, CheckCircle2, AlertCircle, FileJson, FileCode2, BarChart3 } from "lucide-react";

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
    approvePct: number;
    conditionalPct: number;
    rejectPct: number;
    vetoPct: number;
    totalScenarios: number;
    confidenceDistribution?: { low: number; medium: number; high: number };
  };
  failureVectors: Array<{
    category: string;
    frequency: number;
    avgSeverity: number;
    affectedPct: number;
    examplePattern?: string;
  }>;
  approvalPathways: Array<{
    conditionSet: string[];
    approvalProbability: number;
    confidenceLift: number;
    remainingRisks: string[];
  }>;
  sensitivitySurface: Array<{ variable: string; impactScore: number; direction: string }>;
  governanceHeatmap: Array<{ category: string; escalationCount: number; vetoCount: number; avgSeverity: number }>;
}

export interface ReportsPanelProps {
  dealName: string;
  dealId?: string;
  verdict: string;
  confidenceScore: number;
  // IC Memo handler (already implemented in ICReport)
  onExportICMemo: () => void;
  icMemoLoading: boolean;
  // Upgrade Protocol data (lifted from DecisionUpgradePanel via callbacks)
  upgradeProtocol?: UpgradeProtocol | null;
  upgradeDelta?: DeltaOutput | null;
  // Simulation data (fetched from scenarioSim.getRunStatus if a completed run exists)
  simRunId?: string | null;
  simMode?: string;
  simTargetCount?: number;
  simCompletedAt?: string;
  simAggregation?: SimAggregation | null;
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

// ── Main Component ────────────────────────────────────────────────────────────

export function ReportsPanel({
  dealName, dealId, verdict, confidenceScore,
  onExportICMemo, icMemoLoading,
  upgradeProtocol, upgradeDelta,
  simRunId, simMode, simTargetCount, simCompletedAt, simAggregation,
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

  const upgradeProtocolPdf = trpc.dealScreener.upgradeProtocolPdf.useMutation();
  const stressTestReportPdf = trpc.dealScreener.stressTestReportPdf.useMutation();

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
        decisionDistribution: simAggregation!.decisionDistribution,
        failureVectors: simAggregation!.failureVectors ?? [],
        approvalPathways: simAggregation!.approvalPathways ?? [],
        sensitivitySurface: simAggregation!.sensitivitySurface ?? [],
        governanceHeatmap: simAggregation!.governanceHeatmap ?? [],
        format: stressFmt,
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

  const hasUpgrade = !!upgradeProtocol;
  // Unlock if aggregation + decisionDistribution exist; mode/targetCount/completedAt are optional
  const hasStress = !!(simAggregation?.decisionDistribution);
  // Safe fallbacks for display when some metadata is missing
  const safeSimMode = simMode ?? "unknown";
  const safeSimTargetCount = simTargetCount ?? (simAggregation?.decisionDistribution?.totalScenarios ?? 0);
  const safeSimCompletedAt = simCompletedAt ?? new Date().toISOString();

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

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
                      ? `${safeSimTargetCount.toLocaleString()} scenarios · ${safeSimMode} mode · ${simAggregation!.decisionDistribution.approvePct.toFixed(1)}% approve rate.`
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

          </div>

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
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
