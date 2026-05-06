import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock, Activity, AlertTriangle, CheckCircle2, XCircle, Info, Download, Building2, Briefcase } from "lucide-react";
import { useProspectMode } from "@/hooks/useProspectMode";

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  HIGH:   { color: "bg-red-500/10 text-red-400 border-red-500/20",       icon: <AlertTriangle className="w-3 h-3" /> },
  MEDIUM: { color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
  LOW:    { color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: <Info className="w-3 h-3" /> },
  INFO:   { color: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: <Info className="w-3 h-3" /> },
};

const RESULT_ICON: Record<string, React.ReactNode> = {
  success:     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  escalated:   <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  intercepted: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  allowed:     <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />,
};

// ── PDF export (client-side, jsPDF) ──────────────────────────────────────────
type AuditRow = {
  agentName: string | null;
  action: string;
  entity: string | null;
  severity: string | null;
  result: string | null;
  confidence: number | null;
  timestamp: number | null;
  traceId: string | null;
  details: string | null;
};

async function exportGovernancePDF(params: {
  auditRows: AuditRow[];
  sourcesCount: number;
  entitiesCount: number;
  piiCount: number;
  governanceCount: number;
  escalationsCount: number;
  prospectName?: string;
  organization?: string;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("SADO Governance Audit Report", margin, 11);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Software-Defined Data Operations  ·  Sovereign AI Platform", margin, 18);
  const now = new Date();
  const prospectLabel = params.prospectName?.trim()
    ? params.organization?.trim()
      ? `Prepared for: ${params.prospectName.trim()} · ${params.organization.trim()}`
      : `Prepared for: ${params.prospectName.trim()}`
    : "Prepared for: Enterprise Stakeholder";
  doc.text(prospectLabel, margin, 24);
  doc.text(`Generated: ${now.toUTCString()}`, pageW - margin, 24, { align: "right" });
  y = 36;

  // Summary counts
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("DISCOVERY & GOVERNANCE SUMMARY", margin, y);
  y += 5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const summaryItems = [
    { label: "Discovered Sources",    value: String(params.sourcesCount) },
    { label: "Mapped Entities",       value: String(params.entitiesCount) },
    { label: "PII / Sensitive Cols",  value: String(params.piiCount) },
    { label: "Governance Checks",     value: String(params.governanceCount) },
    { label: "Escalations",           value: String(params.escalationsCount) },
    { label: "Audit Events",          value: String(params.auditRows.length) },
  ];
  const colW = contentW / 3;
  summaryItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * colW;
    const itemY = y + row * 18;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, itemY - 3, colW - 4, 14, 2, 2, "F");
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 118, 110);
    doc.text(item.value, x + 4, itemY + 6);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + 4, itemY + 11);
  });
  y += Math.ceil(summaryItems.length / 3) * 18 + 8;

  // Governance status
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("GOVERNANCE STATUS", margin, y);
  y += 5;
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const interceptedCount = params.auditRows.filter(r => r.result === "intercepted").length;
  const allowedCount = params.auditRows.filter(r => r.result === "allowed").length;
  const escalatedCount = params.auditRows.filter(r => r.result === "escalated").length;

  const statusItems: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: "Transfers Intercepted", value: String(interceptedCount), color: [239, 68, 68] },
    { label: "Transfers Allowed",     value: String(allowedCount),     color: [16, 185, 129] },
    { label: "Escalated to Human",    value: String(escalatedCount),   color: [245, 158, 11] },
  ];
  statusItems.forEach((item, i) => {
    const x = margin + i * (contentW / 3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y - 3, contentW / 3 - 4, 14, 2, 2, "F");
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...item.color);
    doc.text(item.value, x + 4, y + 6);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + 4, y + 11);
  });
  y += 22;

  // Audit trail table
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("RECENT AUDIT TRAIL (last 20 entries)", margin, y);
  y += 5;
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("TIMESTAMP",  margin + 2,   y + 5);
  doc.text("AGENT",      margin + 36,  y + 5);
  doc.text("ACTION",     margin + 72,  y + 5);
  doc.text("ENTITY",     margin + 108, y + 5);
  doc.text("SEV",        margin + 152, y + 5);
  doc.text("RESULT",     margin + 163, y + 5);
  y += 7;

  const sevColor: Record<string, [number, number, number]> = {
    HIGH: [239, 68, 68], MEDIUM: [245, 158, 11], LOW: [59, 130, 246], INFO: [100, 116, 139],
  };
  const resColor: Record<string, [number, number, number]> = {
    success: [16, 185, 129], intercepted: [239, 68, 68], escalated: [245, 158, 11], allowed: [59, 130, 246],
  };

  params.auditRows.slice(0, 20).forEach((row, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const ts = row.timestamp ? new Date(row.timestamp).toLocaleString() : "—";
    doc.text(ts.slice(0, 18),                     margin + 2,   y + 5);
    doc.text((row.agentName ?? "").slice(0, 20),   margin + 36,  y + 5);
    doc.text((row.action ?? "").slice(0, 22),      margin + 72,  y + 5);
    doc.text((row.entity ?? "").slice(0, 24),      margin + 108, y + 5);
    doc.setTextColor(...(sevColor[row.severity ?? "INFO"] ?? sevColor.INFO));
    doc.text((row.severity ?? "INFO").slice(0, 6), margin + 152, y + 5);
    doc.setTextColor(...(resColor[row.result ?? "success"] ?? resColor.success));
    doc.text((row.result ?? "—").slice(0, 12),     margin + 163, y + 5);
    y += 7;
  });

  // Footer
  const footerY = 287;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Generated by SADO — Software-Defined Data Operations", margin, footerY);
  doc.text("CONFIDENTIAL — For authorized personnel only", pageW - margin, footerY, { align: "right" });

  doc.save(`SADO_Governance_Audit_${now.toISOString().slice(0, 10)}.pdf`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SADOAuditTrail() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [prospectOverride, setProspectOverride] = useState("");

  // Prospect mode — auto-fill from localStorage
  const { prospect } = useProspectMode();

  const auditQ = trpc.sado.getAuditTrail.useQuery({
    limit: 50,
    severityFilter: severityFilter !== "all" ? severityFilter : undefined,
    actionFilter: actionFilter !== "all" ? actionFilter : undefined,
  });
  const sourcesQ      = trpc.sado.getSources.useQuery();
  const governanceQ   = trpc.sado.getGovernanceAlerts.useQuery();
  const escalationsQ  = trpc.sado.getEscalations.useQuery();

  const rows          = auditQ.data ?? [];
  const sources       = sourcesQ.data ?? [];
  const govAlerts     = governanceQ.data ?? [];
  const escalations   = escalationsQ.data ?? [];

  // Compute PII/sensitive column count from source data
  const piiCount = sources.reduce((acc, s) => {
    const cols = (s as { columns?: Array<{ classification: string }> }).columns ?? [];
    return acc + cols.filter(c => c.classification === "PII" || c.classification === "SENSITIVE").length;
  }, 0);

  function handleExportPDF() {
    // Pre-fill with prospect mode value if set
    setProspectOverride(prospect?.prospectName ?? "");
    setShowProspectModal(true);
  }

  async function handleConfirmExport() {
    setShowProspectModal(false);
    setExporting(true);
    try {
      await exportGovernancePDF({
        auditRows: rows,
        sourcesCount: sources.length,
        entitiesCount: sources.length,
        piiCount,
        governanceCount: govAlerts.length,
        escalationsCount: escalations.length,
        prospectName: prospectOverride || prospect?.prospectName,
        organization: prospect?.organization,
      });
    } finally {
      setExporting(false);
    }
  }

  const PROSPECT_EXAMPLES = ["STC", "ADNOC Digital", "Kuwait Finance House", "Core42", "G42", "Ministry of Health"];

  return (
    <>
    {/* Prospect name modal for PDF */}
    <Dialog open={showProspectModal} onOpenChange={setShowProspectModal}>
      <DialogContent className="bg-[oklch(0.14_0.03_255)] border-slate-700 text-slate-100 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Building2 className="w-4 h-4 text-blue-400" />
            Personalise Report
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label className="text-xs text-slate-400">Prepared for</Label>
          <Input
            value={prospectOverride}
            onChange={e => setProspectOverride(e.target.value)}
            placeholder="e.g. ADNOC Digital"
            className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm"
            onKeyDown={e => { if (e.key === "Enter") handleConfirmExport(); }}
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PROSPECT_EXAMPLES.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => setProspectOverride(ex)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors bg-slate-800 ${
                  prospectOverride === ex
                    ? "border-blue-500 text-blue-300"
                    : "border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-300"
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
          {prospect?.prospectName && prospectOverride !== prospect.prospectName && (
            <p className="text-xs text-blue-400/70">
              Prospect mode active: <span className="font-medium">{prospect.prospectName}</span>
              {" "}— <button type="button" className="underline" onClick={() => setProspectOverride(prospect.prospectName)}>use it</button>
            </p>
          )}
          <p className="text-xs text-slate-500">Leave blank to use "Enterprise Stakeholder".</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowProspectModal(false)}
            className="border-slate-700 text-slate-400 hover:bg-slate-800">
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirmExport}
            className="bg-blue-600 hover:bg-blue-500 text-white">
            <Download className="w-3 h-3 mr-1" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/sado">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Lock className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Audit Trail</h1>
            <p className="text-xs text-slate-400">Append-only · OpenTelemetry trace IDs · Immutable log</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Prospect mode indicator in audit header */}
            {prospect && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/8 text-blue-400 text-xs">
                <Briefcase className="w-3 h-3" />
                {prospect.prospectName}
              </div>
            )}
            <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
              {rows.length} entries
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exporting || rows.length === 0}
              className="h-7 text-xs bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white gap-1.5"
            >
              <Download className="w-3 h-3" />
              {exporting ? "Generating…" : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-[oklch(0.14_0.03_255)] border-slate-700 text-slate-300">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-[oklch(0.14_0.03_255)] border-slate-700">
              {["all", "HIGH", "MEDIUM", "LOW", "INFO"].map(v => (
                <SelectItem key={v} value={v} className="text-xs text-slate-300">{v === "all" ? "All Severities" : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-48 h-8 text-xs bg-[oklch(0.14_0.03_255)] border-slate-700 text-slate-300">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent className="bg-[oklch(0.14_0.03_255)] border-slate-700">
              {["all", "AGENT_STARTED", "SCHEMA_EXTRACTED", "ENTITY_MAPPED", "COLUMN_CLASSIFIED", "DRIFT_DETECTED", "REWRITE_GENERATED", "TRANSFER_INTERCEPTED", "TRANSFER_ALLOWED", "GRAPH_UPDATED", "ESCALATION_CREATED"].map(v => (
                <SelectItem key={v} value={v} className="text-xs text-slate-300">{v === "all" ? "All Actions" : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Audit log */}
        <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Lock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No audit entries yet. Run the demo from the Command Centre.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {rows.map((row, i) => {
                  const sev = SEVERITY_CONFIG[row.severity ?? "INFO"] ?? SEVERITY_CONFIG.INFO;
                  return (
                    <div key={row.id ?? i} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {RESULT_ICON[row.result ?? "success"] ?? <Activity className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-200">{row.agentName}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-slate-800 border-slate-700 text-slate-400">
                              {row.action}
                            </Badge>
                            <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-1 ${sev.color}`}>
                              {sev.icon} {row.severity}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{row.entity}</div>
                          {row.details && (
                            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{row.details}</div>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                            <span>{new Date(row.timestamp ?? 0).toLocaleString()}</span>
                            {row.traceId && <span className="font-mono">trace:{row.traceId}</span>}
                            {row.confidence !== null && <span>conf:{Math.round((row.confidence ?? 0) * 100)}%</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
