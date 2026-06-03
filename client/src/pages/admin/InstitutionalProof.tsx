/**
 * InstitutionalProof.tsx — Institutional Proof Engine (Phase 5)
 *
 * Read-only dashboard at /admin/proof.
 * Aggregates governance, attribution, and calibration data into
 * evidence panels for institutional audiences.
 *
 * No changes to Council logic, CFA, Attribution, or Calibration.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ── Helpers ──────────────────────────────────────────────────────────────────
function pct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}
function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString();
}
function fmtScore(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function ProgressBar({ value, color = "bg-emerald-500" }: { value: number; color?: string }) {
  const w = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div className="w-full bg-slate-700 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${w}%` }} />
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const map: Record<string, string> = {
    high: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
    medium: "bg-amber-900/50 text-amber-300 border-amber-700",
    low: "bg-slate-700 text-slate-300 border-slate-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${map[confidence]}`}>
      {confidence.toUpperCase()}
    </span>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────────
async function generateProofPDF(data: {
  volume: { totalOutcomeTracked: number; totalCfaAudited: number };
  outcomes: { succeeded: number; failed: number; restructured: number; abandoned: number; inProgress: number; unknown: number };
  governance: { avgCfaFidelity: number | null };
  topPersonas: Array<{ personaName: string; f1: number | null; precision: number | null; recall: number | null; fidelity: number | null; totalReviewed: number }>;
  blockerPerformance: Array<{ type: string; predicted: number; materialized: number; falseAlarms: number; materializationRate: number | null }>;
  statements: Array<{ statement: string; category: string; confidence: string }>;
  generatedAt: number;
}) {
  // Build HTML for PDF
  const date = new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const personaRows = data.topPersonas.map(p => `
    <tr>
      <td>${p.personaName}</td>
      <td>${fmtScore(p.f1)}</td>
      <td>${pct(p.precision)}</td>
      <td>${pct(p.recall)}</td>
      <td>${pct(p.fidelity)}</td>
      <td>${p.totalReviewed}</td>
    </tr>`).join("");

  const blockerRows = data.blockerPerformance.map(b => `
    <tr>
      <td>${b.type}</td>
      <td>${b.predicted}</td>
      <td>${b.materialized}</td>
      <td>${b.falseAlarms}</td>
      <td>${pct(b.materializationRate)}</td>
    </tr>`).join("");

  const statementItems = data.statements.map(s => `
    <div class="statement">
      <span class="stmt-badge ${s.confidence}">${s.confidence.toUpperCase()}</span>
      <p>${s.statement}</p>
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>AgenThink Mesh — Institutional Proof Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 11px; line-height: 1.5; }
  .cover { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 60px 48px; min-height: 200px; }
  .cover h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .cover .subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
  .cover .meta { font-size: 11px; color: #64748b; }
  .cover .badge { display: inline-block; background: #1d4ed8; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-bottom: 16px; }
  .section { padding: 32px 48px; border-bottom: 1px solid #e2e8f0; }
  .section h2 { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .section .section-desc { font-size: 10px; color: #64748b; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
  .kpi .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .kpi .value { font-size: 22px; font-weight: 700; color: #0f172a; }
  .kpi .sub { font-size: 9px; color: #94a3b8; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f1f5f9; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; padding: 6px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; color: #334155; }
  tr:nth-child(even) td { background: #f8fafc; }
  .statement { background: #f8fafc; border-left: 3px solid #1d4ed8; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 4px 4px 0; }
  .statement p { font-size: 11px; color: #1e293b; line-height: 1.6; margin-top: 4px; }
  .stmt-badge { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 3px; }
  .stmt-badge.high { background: #d1fae5; color: #065f46; }
  .stmt-badge.medium { background: #fef3c7; color: #92400e; }
  .stmt-badge.low { background: #f1f5f9; color: #475569; }
  .methodology { background: #f8fafc; border-radius: 6px; padding: 16px; font-size: 10px; color: #475569; line-height: 1.7; }
  .methodology h3 { font-size: 12px; color: #0f172a; margin-bottom: 8px; }
  .footer { padding: 24px 48px; background: #0f172a; color: #475569; font-size: 9px; text-align: center; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .stat-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
  .stat-row .stat-label { color: #64748b; }
  .stat-row .stat-value { font-weight: 600; color: #0f172a; }
</style>
</head>
<body>

<div class="cover">
  <div class="badge">INSTITUTIONAL PROOF REPORT</div>
  <h1>AgenThink Mesh</h1>
  <div class="subtitle">Governance Evidence &amp; Performance Validation</div>
  <div class="meta">Generated: ${date} &nbsp;·&nbsp; Confidential — For Institutional Distribution Only</div>
</div>

<!-- Section 1: Volume -->
<div class="section">
  <h2>1. Decision Volume</h2>
  <div class="section-desc">Total evaluated decisions tracked through the Outcome Ledger and CFA audit system.</div>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="label">Outcome-Tracked Decisions</div>
      <div class="value">${data.volume.totalOutcomeTracked.toLocaleString()}</div>
      <div class="sub">All time</div>
    </div>
    <div class="kpi">
      <div class="label">CFA-Audited Runs</div>
      <div class="value">${data.volume.totalCfaAudited.toLocaleString()}</div>
      <div class="sub">Completed audits</div>
    </div>
    <div class="kpi">
      <div class="label">Resolved Outcomes</div>
      <div class="value">${(data.outcomes.succeeded + data.outcomes.failed + data.outcomes.restructured + data.outcomes.abandoned).toLocaleString()}</div>
      <div class="sub">Succeeded + Failed + Restructured + Abandoned</div>
    </div>
    <div class="kpi">
      <div class="label">In Progress / Unknown</div>
      <div class="value">${(data.outcomes.inProgress + data.outcomes.unknown).toLocaleString()}</div>
      <div class="sub">Pending resolution</div>
    </div>
  </div>
</div>

<!-- Section 2: Outcomes -->
<div class="section">
  <h2>2. Outcome Tracking</h2>
  <div class="section-desc">Real-world outcome status of tracked investment decisions.</div>
  <div class="two-col">
    <div>
      <div class="stat-row"><span class="stat-label">Succeeded</span><span class="stat-value">${data.outcomes.succeeded}</span></div>
      <div class="stat-row"><span class="stat-label">Failed</span><span class="stat-value">${data.outcomes.failed}</span></div>
      <div class="stat-row"><span class="stat-label">Restructured</span><span class="stat-value">${data.outcomes.restructured}</span></div>
      <div class="stat-row"><span class="stat-label">Abandoned</span><span class="stat-value">${data.outcomes.abandoned}</span></div>
      <div class="stat-row"><span class="stat-label">In Progress</span><span class="stat-value">${data.outcomes.inProgress}</span></div>
      <div class="stat-row"><span class="stat-label">Unknown</span><span class="stat-value">${data.outcomes.unknown}</span></div>
    </div>
    <div>
      <div class="kpi">
        <div class="label">Average CFA Fidelity</div>
        <div class="value">${data.governance.avgCfaFidelity != null ? Math.round(data.governance.avgCfaFidelity * 100) + "%" : "—"}</div>
        <div class="sub">Persona rule adherence</div>
      </div>
    </div>
  </div>
</div>

<!-- Section 3: Persona Performance -->
<div class="section">
  <h2>3. Persona Performance</h2>
  <div class="section-desc">Predictive accuracy metrics for top-performing investment committee personas.</div>
  <table>
    <thead>
      <tr>
        <th>Persona</th><th>F1 Score</th><th>Precision</th><th>Recall</th><th>CFA Fidelity</th><th>Reviewed</th>
      </tr>
    </thead>
    <tbody>${personaRows || "<tr><td colspan='6' style='text-align:center;color:#94a3b8;'>No reviewed attributions yet</td></tr>"}</tbody>
  </table>
</div>

<!-- Section 4: Risk Performance -->
<div class="section">
  <h2>4. Risk Category Performance</h2>
  <div class="section-desc">Prediction accuracy by risk category across all tracked outcomes.</div>
  <table>
    <thead>
      <tr>
        <th>Category</th><th>Predicted</th><th>Materialized</th><th>False Alarms</th><th>Mat. Rate</th>
      </tr>
    </thead>
    <tbody>${blockerRows || "<tr><td colspan='5' style='text-align:center;color:#94a3b8;'>No reviewed attributions yet</td></tr>"}</tbody>
  </table>
</div>

<!-- Section 5: Governance -->
<div class="section">
  <h2>5. Evidence Statements</h2>
  <div class="section-desc">Institution-ready statements derived exclusively from verified data. Only shown when sample size exceeds minimum threshold.</div>
  ${statementItems || "<p style='color:#94a3b8;font-size:10px;'>No evidence statements available yet. Run more council decisions and review attributions to generate statements.</p>"}
</div>

<!-- Section 6: Methodology -->
<div class="section">
  <h2>6. Methodology</h2>
  <div class="methodology">
    <h3>How AgenThink Mesh Measures Performance</h3>
    <p><strong>Council Decisions:</strong> Each deal evaluation runs through a 10-persona Investment Committee Council. Personas vote independently, then undergo adversarial and convergence rounds before a final verdict is issued.</p>
    <p style="margin-top:8px;"><strong>CFA Audit:</strong> Every council run is independently audited by the Counterfactual Alignment (CFA) engine, which scores each persona on four dimensions: in-character reasoning, rule fidelity, evidence grounding, and confidence calibration.</p>
    <p style="margin-top:8px;"><strong>Outcome Tracking:</strong> Decisions are tracked post-close through the Outcome Ledger. Admins record real-world outcomes (SUCCEEDED, FAILED, RESTRUCTURED, ABANDONED) and link them back to the original council reasoning.</p>
    <p style="margin-top:8px;"><strong>Attribution:</strong> Each persona's predictions are reviewed against realized outcomes. Materialized predictions are marked YES; non-materialized predictions are marked NO. These form the basis of precision, recall, and F1 calculations.</p>
    <p style="margin-top:8px;"><strong>Calibration Metrics:</strong> Precision = TP/(TP+FP). Recall = TP/(TP+FN). F1 = 2·P·R/(P+R). Outcome Agreement Rate = agreements / total resolved sessions. Materialization Rate = materialized / (materialized + false alarms).</p>
    <p style="margin-top:8px;"><strong>Evidence Threshold:</strong> Evidence statements are only generated when the underlying sample size exceeds the configured minimum threshold, ensuring statistical validity.</p>
  </div>
</div>

<div class="footer">
  AgenThink Mesh — Institutional Proof Report &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; Confidential
</div>

</body>
</html>`;

  // Open in new window and trigger print
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InstitutionalProof() {
  const [minSample, setMinSample] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  const volumeQ = trpc.proofEngine.decisionVolume.useQuery();
  const outcomeQ = trpc.proofEngine.outcomeTracking.useQuery();
  const councilQ = trpc.proofEngine.councilPerformance.useQuery();
  const personaQ = trpc.proofEngine.topPredictivePersonas.useQuery();
  const riskQ = trpc.proofEngine.riskCategoryPerformance.useQuery();
  const statementsQ = trpc.proofEngine.evidenceStatements.useQuery({ minSampleSize: minSample });
  const summaryQ = trpc.proofEngine.fullProofSummary.useQuery({ minSampleSize: minSample });

  const isLoading =
    volumeQ.isLoading || outcomeQ.isLoading || councilQ.isLoading ||
    personaQ.isLoading || riskQ.isLoading || statementsQ.isLoading;

  const handleExport = useCallback(async () => {
    if (!summaryQ.data || !statementsQ.data) {
      toast.error("Data not ready — please wait for all panels to load.");
      return;
    }
    setIsExporting(true);
    try {
      await generateProofPDF({
        volume: summaryQ.data.volume,
        outcomes: summaryQ.data.outcomes,
        governance: summaryQ.data.governance,
        topPersonas: summaryQ.data.topPersonas.map(p => ({
          personaName: p.personaName,
          f1: p.f1,
          precision: p.precision,
          recall: p.recall,
          fidelity: null,
          totalReviewed: p.totalReviewed,
        })),
        blockerPerformance: summaryQ.data.blockerPerformance,
        statements: statementsQ.data.statements,
        generatedAt: summaryQ.data.generatedAt,
      });
      toast.success("Print dialog opened. Save as PDF to download.");
    } catch (e) {
      toast.error(`Export failed: ${String(e)}`);
    } finally {
      setIsExporting(false);
    }
  }, [summaryQ.data, statementsQ.data]);

  const categoryLabels: Record<string, string> = {
    FINANCIAL: "DSCR / Financial",
    TECHNICAL: "Technical / Engineering",
    CONSTRUCTION: "EPC / Construction",
    REGULATORY: "Regulatory / Permitting",
    COMMERCIAL: "Merchant Tail / Commercial",
    ESG: "ESG / Sustainability",
  };

  const categoryColors: Record<string, string> = {
    FINANCIAL: "bg-blue-500",
    TECHNICAL: "bg-violet-500",
    CONSTRUCTION: "bg-amber-500",
    REGULATORY: "bg-rose-500",
    COMMERCIAL: "bg-emerald-500",
    ESG: "bg-teal-500",
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Institutional Proof Engine</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only governance evidence for clients, investors, and prospects.
              All data sourced from Outcome Ledger, CFA, and Attribution Engine.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Min sample:</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={minSample}
                onChange={(e) => setMinSample(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-foreground"
              />
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              {isExporting ? "Generating..." : "Export PDF Report"}
            </Button>
          </div>
        </div>

        {/* Panel 1 — Decision Volume */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              📊 Panel 1 — Decision Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            {volumeQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : volumeQ.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Outcome-Tracked</div>
                    <div className="text-3xl font-bold text-foreground">{fmt(volumeQ.data.outcomeTracked.allTime)}</div>
                    <div className="text-xs text-muted-foreground mt-1">All time</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last 30 Days</div>
                    <div className="text-3xl font-bold text-blue-400">{fmt(volumeQ.data.outcomeTracked.last30Days)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Outcome-tracked</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last 90 Days</div>
                    <div className="text-3xl font-bold text-violet-400">{fmt(volumeQ.data.outcomeTracked.last90Days)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Outcome-tracked</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CFA-Audited</div>
                    <div className="text-3xl font-bold text-emerald-400">{fmt(volumeQ.data.cfaAudited.allTime)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Completed audits</div>
                  </div>
                </div>
                {volumeQ.data.outcomeTracked.byMode.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">By Council Mode</div>
                    <div className="flex flex-wrap gap-2">
                      {volumeQ.data.outcomeTracked.byMode.map((m) => (
                        <div key={m.mode} className="bg-slate-800 rounded px-3 py-1.5 text-xs">
                          <span className="text-muted-foreground">{m.mode}</span>
                          <span className="ml-2 font-semibold text-foreground">{m.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Panel 2 — Outcome Tracking */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              🎯 Panel 2 — Outcome Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outcomeQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : outcomeQ.data ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Succeeded", value: outcomeQ.data.succeeded, color: "text-emerald-400" },
                  { label: "Failed", value: outcomeQ.data.failed, color: "text-rose-400" },
                  { label: "Restructured", value: outcomeQ.data.restructured, color: "text-amber-400" },
                  { label: "Abandoned", value: outcomeQ.data.abandoned, color: "text-slate-400" },
                  { label: "In Progress", value: outcomeQ.data.inProgress, color: "text-blue-400" },
                  { label: "Unknown", value: outcomeQ.data.unknown, color: "text-slate-500" },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-800 rounded-lg p-4 text-center">
                    <div className={`text-2xl font-bold ${item.color}`}>{fmt(item.value)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Panel 3 — Council Performance */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              🏛 Panel 3 — Council Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {councilQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : councilQ.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Outcome Agreement</div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {councilQ.data.outcomeAgreementRate != null
                        ? `${Math.round(councilQ.data.outcomeAgreementRate * 100)}%`
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {councilQ.data.totalResolved} resolved decisions
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg CFA Fidelity</div>
                    <div className="text-3xl font-bold text-blue-400">
                      {councilQ.data.avgCfaFidelity != null
                        ? `${Math.round(councilQ.data.avgCfaFidelity * 100)}%`
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Persona rule adherence</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Consensus Score</div>
                    <div className="text-3xl font-bold text-violet-400">
                      {councilQ.data.avgConsensusScore != null
                        ? councilQ.data.avgConsensusScore.toFixed(2)
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">0–1 scale</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Confidence Distribution</div>
                    <div className="space-y-1 mt-1">
                      {[
                        { label: "Very High (≥80%)", value: councilQ.data.confidenceDistribution.veryHigh, color: "bg-emerald-500" },
                        { label: "High (60–80%)", value: councilQ.data.confidenceDistribution.high, color: "bg-blue-500" },
                        { label: "Medium (40–60%)", value: councilQ.data.confidenceDistribution.medium, color: "bg-amber-500" },
                        { label: "Low (<40%)", value: councilQ.data.confidenceDistribution.low, color: "bg-rose-500" },
                      ].map((b) => (
                        <div key={b.label} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${b.color}`} />
                          <span className="text-muted-foreground flex-1">{b.label}</span>
                          <span className="font-medium text-foreground">{b.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Panel 4 — Top Predictive Personas */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              🧠 Panel 4 — Top Predictive Personas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {personaQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : personaQ.data && personaQ.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-muted-foreground text-xs">Persona</TableHead>
                    <TableHead className="text-muted-foreground text-xs">F1 Score</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Precision</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Recall</TableHead>
                    <TableHead className="text-muted-foreground text-xs">CFA Fidelity</TableHead>
                    <TableHead className="text-muted-foreground text-xs">TP / FP / FN</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Reviewed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personaQ.data.map((p) => (
                    <TableRow key={p.personaId} className="border-slate-800 hover:bg-slate-800/50">
                      <TableCell className="font-medium text-sm text-foreground">{p.personaName}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-sm font-semibold text-emerald-400">{fmtScore(p.f1)}</span>
                          {p.f1 != null && <ProgressBar value={p.f1} color="bg-emerald-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-blue-400">{pct(p.precision)}</TableCell>
                      <TableCell className="text-sm text-violet-400">{pct(p.recall)}</TableCell>
                      <TableCell className="text-sm text-amber-400">{pct(p.fidelity)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="text-emerald-400">{p.tp}</span>
                        {" / "}
                        <span className="text-rose-400">{p.fp}</span>
                        {" / "}
                        <span className="text-amber-400">{p.fn}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.totalReviewed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No reviewed attributions yet. Review attribution candidates in the Attribution Engine to populate this panel.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel 5 — Risk Category Performance */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              ⚠️ Panel 5 — Top Predictive Risk Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : riskQ.data ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {riskQ.data.map((cat) => (
                  <div key={cat.category} className="bg-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${categoryColors[cat.category] ?? "bg-slate-500"}`} />
                      <span className="text-sm font-medium text-foreground">
                        {categoryLabels[cat.category] ?? cat.category}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-foreground">{cat.predicted}</div>
                        <div className="text-xs text-muted-foreground">Predicted</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{cat.materialized}</div>
                        <div className="text-xs text-muted-foreground">Materialized</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-rose-400">{cat.falseAlarms}</div>
                        <div className="text-xs text-muted-foreground">False Alarms</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Materialization Rate</span>
                        <span className="font-semibold text-foreground">{pct(cat.materializationRate)}</span>
                      </div>
                      {cat.materializationRate != null && (
                        <ProgressBar
                          value={cat.materializationRate}
                          color={categoryColors[cat.category] ?? "bg-slate-500"}
                        />
                      )}
                    </div>
                    {cat.unreviewed > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {cat.unreviewed} unreviewed predictions
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available.</div>
            )}
          </CardContent>
        </Card>

        {/* Panel 6 — Evidence Statements */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              📜 Panel 6 — Evidence Statements
              <Badge variant="outline" className="text-xs ml-2 border-slate-600 text-muted-foreground">
                Min sample: {minSample}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statementsQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : statementsQ.data && statementsQ.data.statements.length > 0 ? (
              <div className="space-y-3">
                {statementsQ.data.statements.map((s) => (
                  <div
                    key={s.id}
                    className="border-l-2 border-blue-500 pl-4 py-2 bg-slate-800/50 rounded-r-lg"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ConfidenceBadge confidence={s.confidence} />
                      <span className="text-xs text-muted-foreground capitalize">{s.category}</span>
                      <span className="text-xs text-muted-foreground ml-auto">n={s.sampleSize}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{s.statement}</p>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground pt-2">
                  {statementsQ.data.totalStatements} statement{statementsQ.data.totalStatements !== 1 ? "s" : ""} generated from verified data.
                  Statements only appear when sample size ≥ {statementsQ.data.minSampleSize}.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No evidence statements available yet.
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground mb-2">How to generate evidence statements:</div>
                  <div>1. Run council decisions and track them in the Outcome Ledger</div>
                  <div>2. Update outcome status (SUCCEEDED / FAILED / etc.) for resolved deals</div>
                  <div>3. Review attribution candidates in the Attribution Engine (mark YES/NO)</div>
                  <div>4. Once sample size ≥ {minSample}, statements will auto-generate here</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="bg-slate-800" />
        <div className="text-xs text-muted-foreground text-center pb-4">
          Institutional Proof Engine — Phase 5 · Read-only · No changes to Council, CFA, Attribution, or Calibration logic
        </div>
      </div>
    </DashboardLayout>
  );
}
