import { useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock, Activity, AlertTriangle, CheckCircle2, XCircle, Info, Download, Building2, Briefcase, Shield } from "lucide-react";
import ProspectQRDialog from "@/components/sado/ProspectQRDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useProspectMode, useProspectFromUrl, buildProspectQuery } from "@/hooks/useProspectMode";
import { useProspectCopyLink } from "@/hooks/useProspectCopyLink";

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

const PROSPECT_EXAMPLES = ["STC", "ADNOC Digital", "Kuwait Finance House", "Core42", "G42", "Ministry of Health"];

// ── Static policy definitions (mirrors SADOGovernance.tsx) ────────────────────
const POLICY_CARDS = [
  {
    id: "PDPL_SA_ART29_001",
    name: "PDPL SA — Article 29",
    regulation: "Saudi Personal Data Protection Law",
    jurisdiction: "Saudi Arabia",
    classificationsCovered: ["PII", "SENSITIVE"],
    action: "INTERCEPT" as const,
    riskLevel: "HIGH",
    legalBasis: "Saudi PDPL Article 29 — Cross-border Transfer Restrictions",
  },
  {
    id: "CITRA_KW_DATA_RESIDENCY_001",
    name: "CITRA KW — Data Residency",
    regulation: "CITRA Decree No. 20/2014",
    jurisdiction: "Kuwait",
    classificationsCovered: ["PII", "SENSITIVE"],
    action: "INTERCEPT" as const,
    riskLevel: "HIGH",
    legalBasis: "CITRA Decree No. 20/2014 — Telecommunications Data Residency",
  },
  {
    id: "NESA_UAE_CLOUD_001",
    name: "NESA UAE — Cloud Security",
    regulation: "UAE NESA Information Assurance Standards",
    jurisdiction: "UAE",
    classificationsCovered: ["SENSITIVE", "INTERNAL"],
    action: "ESCALATE" as const,
    riskLevel: "MEDIUM",
    legalBasis: "UAE NESA IAS v3.0 — Cloud and Data Centre Security Standards",
  },
  {
    id: "INTERNAL_POLICY_001",
    name: "Internal Enterprise Policy v2.1",
    regulation: "Internal Enterprise Data Governance Policy",
    jurisdiction: "Internal",
    classificationsCovered: ["INTERNAL", "PUBLIC"],
    action: "ALLOW" as const,
    riskLevel: "LOW",
    legalBasis: "Internal Enterprise Data Governance Policy v2.1 — Section 4.2",
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
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

type OverrideRequest = {
  id: number;
  title: string;
  description: string;
  createdAt: number | null;
  status: string;
};

type GovernanceAlert = {
  id: number;
  ruleId: string | null;
  action: string;
  sourceCountry: string;
  destinationCountry: string;
  dataClassification: string;
  severity: string;
  description: string;
  createdAt: number | null;
};

// ── PDF export (client-side, jsPDF) ──────────────────────────────────────────
type SectionToggles = {
  auditTrail: boolean;
  governanceSummary: boolean;
  transferEvents: boolean;
  overrideRequests: boolean;
  generationFooter: boolean;
  demoNarrative: boolean;
};

// ── Demo narration steps (mirrors Command Centre AGENT_NARRATION) ─────────────
const DEMO_NARRATIVE_STEPS = [
  { step: 1, agent: "Discovery Agent",       narration: "Scanning connected enterprise systems and identifying available data sources across the organisation." },
  { step: 2, agent: "Classification Agent",  narration: "Classifying sensitive fields, PII, and business-critical relationships within discovered schemas." },
  { step: 3, agent: "Lineage Agent",         narration: "Tracing data lineage paths across systems, schemas, and transformation layers." },
  { step: 4, agent: "Knowledge Graph Agent", narration: "Building a live relationship map across systems, schemas, and entities for contextual governance." },
  { step: 5, agent: "Governance Agent",      narration: "Checking residency, classification, and transfer rules against GCC policy constraints (PDPL SA, CITRA KW, NESA UAE)." },
  { step: 6, agent: "Sovereignty Agent",     narration: "Enforcing data sovereignty boundaries and blocking non-compliant cross-border transfers." },
  { step: 7, agent: "Escalation Agent",      narration: "Flagging policy conflicts and preparing human approval paths for operator review." },
  { step: 8, agent: "Audit Agent",           narration: "Recording every decision, transfer event, and override request for compliance review." },
  { step: 9, agent: "Reporting Agent",       narration: "Compiling governance evidence, audit entries, and compliance metrics into this report." },
] as const;

async function exportGovernancePDF(params: {
  auditRows: AuditRow[];
  sourcesCount: number;
  entitiesCount: number;
  piiCount: number;
  governanceCount: number;
  escalationsCount: number;
  govAlerts: GovernanceAlert[];
  overrideRequests: OverrideRequest[];
  prospectName?: string;
  organization?: string;
  tagline?: string;
  presetName?: string;
  sections: SectionToggles;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;
  const now = new Date();

  // ── Helper: check page overflow and add new page ────────────────────────
  function checkPage(needed = 10) {
    if (y + needed > 278) {
      doc.addPage();
      y = 20;
    }
  }

  // ── Helper: section header ───────────────────────────────────────────────────────
  function sectionHeader(title: string) {
    checkPage(12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(title, margin, y);
    y += 4;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  // ── Cover page (only when Prospect Mode is active) ────────────────────────
  if (params.prospectName?.trim()) {
    // Full dark background
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, pageW, 297, "F");

    // Top accent bar
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 0, pageW, 3, "F");

    // SADO wordmark
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246); // blue-400
    doc.text("SADO", margin, 20);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Sovereign Autonomous Data Operations", margin + 14, 20);

    // Horizontal rule
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.line(margin, 26, pageW - margin, 26);

    // Report type label
    const reportTypeLabel = params.presetName ?? "Governance Audit Report";
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(reportTypeLabel.toUpperCase(), margin, 42);

    // Prospect name (large)
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(241, 245, 249);
    const nameLines = doc.splitTextToSize(params.prospectName.trim(), contentW);
    doc.text(nameLines, margin, 58);
    const nameBlockH = nameLines.length * 10;

    // Organisation
    if (params.organization?.trim()) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(params.organization.trim(), margin, 58 + nameBlockH + 2);
    }

    // Tagline
    if (params.tagline?.trim()) {
      const tagY = 58 + nameBlockH + (params.organization?.trim() ? 14 : 6);
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(71, 85, 105);
      const tagLines = doc.splitTextToSize(params.tagline.trim(), contentW);
      doc.text(tagLines, margin, tagY);
    }

    // Divider before narrative flow
    const midY = 160;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.line(margin, midY, pageW - margin, midY);

    // Narrative flow label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("NARRATIVE FLOW", margin, midY + 8);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    const flowSteps = [
      "Discovery",
      "Classification",
      "Policy Evaluation",
      "Intercept / Escalation",
      "Override Request",
      "Audit Evidence",
    ];
    let flowX = margin;
    const flowY = midY + 18;
    flowSteps.forEach((step, idx) => {
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "bold");
      doc.text(step, flowX, flowY);
      const stepW = doc.getTextWidth(step);
      if (idx < flowSteps.length - 1) {
        doc.setTextColor(51, 65, 85);
        doc.setFont("helvetica", "normal");
        doc.text("  →  ", flowX + stepW, flowY);
        flowX += stepW + doc.getTextWidth("  →  ");
      }
    });

    // Bottom metadata strip
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 268, pageW, 29, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated: ${now.toLocaleString()}`, margin, 280);
    doc.text("CONFIDENTIAL — For authorized personnel only", pageW - margin, 280, { align: "right" });
    doc.setTextColor(51, 65, 85);
    doc.text("AgenThinkMesh  ·  SADO GCC Compliance Platform", margin, 288);

    // Start report content on a new page
    doc.addPage();
  }

  // ── Report header (page 1 of report content) ─────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("SADO Governance Audit Report", margin, 11);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Sovereign Autonomous Data Operations  ·  GCC Compliance Platform", margin, 18);
  const prospectLabel = params.prospectName?.trim()
    ? params.organization?.trim()
      ? `Prepared for: ${params.prospectName.trim()} · ${params.organization.trim()}`
      : `Prepared for: ${params.prospectName.trim()}`
    : "Prepared for: Enterprise Stakeholder";
  doc.text(prospectLabel, margin, 24);
  doc.text(`Generated: ${now.toUTCString()}`, pageW - margin, 24, { align: "right" });
  y = 36;

  // ── Narrative flow label ──────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Discovery  →  Classification  →  Policy Evaluation  →  Intercept / Escalation  →  Override Request  →  Audit Evidence",
    margin, y
  );
  y += 8;

  // ── Section 1: Discovery & Governance Summary ─────────────────────────────
  sectionHeader("1. DISCOVERY & GOVERNANCE SUMMARY");

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

  // ── Section 2: Governance Status ─────────────────────────────────────────
  sectionHeader("2. GOVERNANCE STATUS");

  const interceptedCount = params.auditRows.filter(r => r.result === "intercepted").length;
  const allowedCount     = params.auditRows.filter(r => r.result === "allowed").length;
  const escalatedCount   = params.auditRows.filter(r => r.result === "escalated").length;

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

  // ── Shared color maps (used by sections 3 & 4) ──────────────────────────────
  const actionColor: Record<string, [number, number, number]> = {
    INTERCEPT: [239, 68, 68],
    ESCALATE:  [245, 158, 11],
    ALLOW:     [16, 185, 129],
  };
  const riskColor: Record<string, [number, number, number]> = {
    HIGH:   [239, 68, 68],
    MEDIUM: [245, 158, 11],
    LOW:    [100, 116, 139],
  };

  // ── Section 3: Active Governance Policies ────────────────────────────────
  if (params.sections.governanceSummary) {
  sectionHeader("3. ACTIVE GOVERNANCE POLICIES");

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("POLICY",        margin + 2,   y + 5);
  doc.text("JURISDICTION",  margin + 62,  y + 5);
  doc.text("ACTION",        margin + 100, y + 5);
  doc.text("RISK",          margin + 122, y + 5);
  doc.text("CLASSIFICATIONS", margin + 138, y + 5);
  y += 7;

  POLICY_CARDS.forEach((policy, i) => {
    checkPage(9);
    const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(margin, y, contentW, 8, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(policy.name.slice(0, 30),              margin + 2,   y + 5.5);
    doc.text(policy.jurisdiction.slice(0, 18),      margin + 62,  y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(actionColor[policy.action] ?? [100, 116, 139]));
    doc.text(policy.action,                          margin + 100, y + 5.5);
    doc.setTextColor(...(riskColor[policy.riskLevel] ?? [100, 116, 139]));
    doc.text(policy.riskLevel,                       margin + 122, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(policy.classificationsCovered.join(", "), margin + 138, y + 5.5);
    y += 8;
  });
  y += 4;
  } // end section 3

  // ── Section 4: Live Transfer Events ──────────────────────────────────────
  if (params.sections.transferEvents) {
  checkPage(20);
  sectionHeader("4. TRANSFER EVENTS EVALUATED");

  if (params.govAlerts.length === 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("No transfer events recorded in this session.", margin + 2, y);
    y += 8;
  } else {
    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("RULE",             margin + 2,   y + 5);
    doc.text("ROUTE",            margin + 68,  y + 5);
    doc.text("CLASSIFICATION",   margin + 100, y + 5);
    doc.text("ACTION",           margin + 138, y + 5);
    doc.text("SEVERITY",         margin + 160, y + 5);
    y += 7;

    params.govAlerts.forEach((alert, i) => {
      checkPage(8);
      const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(margin, y, contentW, 7, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text((alert.ruleId ?? "—").slice(0, 30),             margin + 2,   y + 5);
      doc.text(`${alert.sourceCountry} → ${alert.destinationCountry}`, margin + 68, y + 5);
      doc.text(alert.dataClassification.slice(0, 18),          margin + 100, y + 5);
      const aColor = alert.action === "INTERCEPTED" ? [239, 68, 68] : alert.action === "ALLOWED" ? [16, 185, 129] : [245, 158, 11];
      doc.setFont("helvetica", "bold");
      doc.setTextColor(aColor[0], aColor[1], aColor[2]);
      doc.text(alert.action.slice(0, 12),                      margin + 138, y + 5);
      const sColor: [number, number, number] = riskColor[alert.severity] ?? [100, 116, 139];
      doc.setTextColor(...sColor);
      doc.text(alert.severity,                                  margin + 160, y + 5);
      y += 7;
    });
    y += 4;
  }
  y += 4;
  } // end section 4

  // ── Section 5: Override Requests Submitted ────────────────────────────────
  if (params.sections.overrideRequests) {
  checkPage(20);
  sectionHeader("5. OVERRIDE REQUESTS SUBMITTED");

  // Filter override requests from escalations (title starts with "Override request:")
  const overrideReqs = params.overrideRequests.filter(e =>
    e.title.toLowerCase().startsWith("override request:")
  );

  if (overrideReqs.length === 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("No override requests submitted during this session.", margin + 2, y);
    y += 8;
  } else {
    overrideReqs.forEach((req, i) => {
      checkPage(20);
      const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(bg[0], bg[1], bg[2]);

      // Title row
      doc.rect(margin, y, contentW, 7, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(245, 158, 11); // amber
      doc.text("OVERRIDE REQUEST", margin + 2, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(req.title.replace(/^override request:\s*/i, "").slice(0, 50), margin + 38, y + 5);
      // Status badge
      const statusColor: [number, number, number] = req.status === "approved"
        ? [16, 185, 129] : req.status === "rejected" ? [239, 68, 68] : [245, 158, 11];
      doc.setTextColor(...statusColor);
      doc.setFont("helvetica", "bold");
      doc.text(req.status.toUpperCase(), pageW - margin - 2, y + 5, { align: "right" });
      y += 7;

      // Description
      if (req.description) {
        doc.setFillColor(bg[0], bg[1], bg[2]);
        const descLines = doc.splitTextToSize(req.description, contentW - 8);
        const descH = descLines.length * 4.5 + 4;
        checkPage(descH + 4);
        doc.rect(margin, y, contentW, descH, "F");
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(descLines, margin + 4, y + 4);
        y += descH;
      }

      // Timestamp
      if (req.createdAt) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(148, 163, 184);
        doc.text(`Submitted: ${new Date(req.createdAt).toLocaleString()}`, margin + 4, y + 3);
        y += 5;
      }
      y += 3;
    });
  }
  y += 4;
  } // end section 5

  // ── Section 6: Audit Trail (last 20 entries) ──────────────────────────────
  if (params.sections.auditTrail) {
  checkPage(20);
  sectionHeader("6. RECENT AUDIT TRAIL (last 20 entries)");

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
    pending: [245, 158, 11], approved: [16, 185, 129], rejected: [239, 68, 68],
  };

  params.auditRows.slice(0, 20).forEach((row, i) => {
    checkPage(8);
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

  } // end section 6

  // ── Section 7: Demo Narrative ─────────────────────────────────────────────
  if (params.sections.demoNarrative) {
  checkPage(20);
  sectionHeader("7. DEMO NARRATIVE — AGENT JOURNEY");

  // Narrative flow subtitle
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Discovery  →  Classification  →  Lineage  →  Knowledge Graph  →  Policy Evaluation  →  Sovereignty  →  Escalation  →  Audit  →  Reporting",
    margin, y
  );
  y += 8;

  DEMO_NARRATIVE_STEPS.forEach((item, i) => {
    checkPage(12);
    const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(margin, y, contentW, 10, "F");

    // Step number circle
    doc.setFillColor(15, 118, 110);
    doc.circle(margin + 5, y + 5, 3, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(String(item.step), margin + 5, y + 5.8, { align: "center" });

    // Agent name
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(item.agent, margin + 12, y + 4.5);

    // Narration text
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const narLines = doc.splitTextToSize(item.narration, contentW - 16);
    doc.text(narLines, margin + 12, y + 8.5);
    y += 10;
  });
  y += 4;
  } // end section 7

  // ── Footer (on last page) ─────────────────────────────────────────────────
  if (params.sections.generationFooter) {
  const footerY = 287;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Generated by SADO — Sovereign Autonomous Data Operations", margin, footerY);
  doc.text("CONFIDENTIAL — For authorized personnel only", pageW - margin, footerY, { align: "right" });

  } // end footer

  const dateSlice = now.toISOString().slice(0, 10);
  const prospectSlug = params.prospectName?.trim()
    ? `_${params.prospectName.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`
    : "";
  doc.save(`SADO_Audit${prospectSlug}_${dateSlice}.pdf`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SADOAuditTrail() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [prospectOverride, setProspectOverride] = useState("");
  const [sections, setSections] = useState<SectionToggles>({
    auditTrail: true,
    governanceSummary: true,
    transferEvents: true,
    overrideRequests: true,
    generationFooter: true,
    demoNarrative: true,
  });

  function toggleSection(key: keyof SectionToggles) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Prospect mode — auto-fill from localStorage
  useProspectFromUrl();
  const { prospect } = useProspectMode();
  const [qrOpen, setQrOpen] = useState(false);
  const { copyState, copyLink: copyProspectLink } = useProspectCopyLink();


  // Dynamic page title + OG tags
  useEffect(() => {
    const p = prospect?.prospectName ? `${prospect.prospectName} · ` : "";
    const pageTitle = `SADO · ${p}Audit Trail`;
    const pageDesc = "SADO Audit Trail: immutable, timestamped record of every agent decision, governance event, and override request for GCC compliance evidence.";
    document.title = pageTitle;
    function upsertMeta(attr: string, val: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${val}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, val); document.head.appendChild(el); }
      el.content = content;
    }
    upsertMeta("name",     "description",   pageDesc);
    upsertMeta("property", "og:title",       pageTitle);
    upsertMeta("property", "og:description", pageDesc);
    upsertMeta("property", "og:type",        "website");
    upsertMeta("property", "og:url",         window.location.href);
    return () => {
      document.title = "AgenThinkMesh";
      ["meta[name=\"description\"]","meta[property=\"og:title\"]","meta[property=\"og:description\"]","meta[property=\"og:type\"]","meta[property=\"og:url\"]"].forEach(s => document.querySelector(s)?.remove());
    };
  }, [prospect?.prospectName]);

  const auditQ       = trpc.sado.getAuditTrail.useQuery({
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

  // Keyboard shortcut: E → Export PDF
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!exporting && rows.length > 0) handleExportPDF();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exporting, rows.length]);

  async function handleConfirmExport() {
    setShowProspectModal(false);
    setExporting(true);
    try {
      await exportGovernancePDF({
        sections,
        auditRows: rows,
        sourcesCount: sources.length,
        entitiesCount: sources.length,
        piiCount,
        governanceCount: govAlerts.length,
        escalationsCount: escalations.length,
        govAlerts: govAlerts.map(a => ({
          id: a.id,
          ruleId: a.ruleId ?? null,
          action: a.action,
          sourceCountry: a.sourceCountry,
          destinationCountry: a.destinationCountry,
          dataClassification: a.dataClassification,
          severity: a.severity,
          description: a.description,
          createdAt: a.createdAt ?? null,
        })),
        overrideRequests: escalations.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          createdAt: e.createdAt ?? null,
          status: e.status,
        })),
        prospectName: prospectOverride || prospect?.prospectName,
        organization: prospect?.organization,
        tagline: prospect?.tagline,
        presetName: (() => {
          const isExecSummary =
            !sections.auditTrail &&
            sections.governanceSummary &&
            !sections.transferEvents &&
            sections.overrideRequests &&
            sections.generationFooter &&
            !sections.demoNarrative;
          const isFullCISO =
            sections.auditTrail &&
            sections.governanceSummary &&
            sections.transferEvents &&
            sections.overrideRequests &&
            sections.generationFooter &&
            sections.demoNarrative;
          if (isExecSummary) return "Executive Summary";
          if (isFullCISO)    return "Full CISO Report";
          return "Governance Audit Report";
        })(),
      });
    } finally {
      setExporting(false);
    }
  }

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

          {/* Section toggles */}
          <div className="pt-3 border-t border-slate-700/60">
            <p className="text-xs font-medium text-slate-300 mb-1">Report sections</p>
            <p className="text-xs text-slate-500 mb-2">Tailor the report for executive, CISO, or compliance review.</p>

            {/* Preset buttons */}
            {(() => {
              const isExecSummary =
                !sections.auditTrail &&
                sections.governanceSummary &&
                !sections.transferEvents &&
                sections.overrideRequests &&
                sections.generationFooter &&
                !sections.demoNarrative;
              const isFullCISO =
                sections.auditTrail &&
                sections.governanceSummary &&
                sections.transferEvents &&
                sections.overrideRequests &&
                sections.generationFooter &&
                sections.demoNarrative;
              const activeClass = "flex-1 text-xs px-2.5 py-1.5 rounded border border-blue-500 bg-blue-500/15 text-blue-300 font-medium transition-colors";
              const inactiveClass = "flex-1 text-xs px-2.5 py-1.5 rounded border border-slate-600 bg-slate-800/60 text-slate-300 hover:border-blue-500/60 hover:text-blue-300 hover:bg-blue-500/8 transition-colors";
              return (
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSections({
                      auditTrail: false,
                      governanceSummary: true,
                      transferEvents: false,
                      overrideRequests: true,
                      generationFooter: true,
                      demoNarrative: false,
                    })}
                    className={isExecSummary ? activeClass : inactiveClass}
                  >
                    Executive Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setSections({
                      auditTrail: true,
                      governanceSummary: true,
                      transferEvents: true,
                      overrideRequests: true,
                      generationFooter: true,
                      demoNarrative: true,
                    })}
                    className={isFullCISO ? activeClass : inactiveClass}
                  >
                    Full CISO Report
                  </button>
                </div>
              );
            })()}

            <div className="space-y-2">
              {([
                { key: "auditTrail"       as const, label: "Include Audit Trail Entries" },
                { key: "governanceSummary" as const, label: "Include Governance Summary" },
                { key: "transferEvents"   as const, label: "Include Transfer Events" },
                { key: "overrideRequests" as const, label: "Include Override Requests" },
                { key: "demoNarrative"    as const, label: "Include Demo Narrative" },
                { key: "generationFooter" as const, label: "Include Generation Footer" },
              ]).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`section-${key}`}
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                    className="border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label
                    htmlFor={`section-${key}`}
                    className="text-xs text-slate-300 cursor-pointer select-none"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>
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
          <Link href={`/sado${buildProspectQuery(prospect)}`}>
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
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <Shield className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-blue-300">{prospect.prospectName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  title="Show QR code for this prospect link"
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                  <span>QR</span>
                </button>
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
              {!exporting && rows.length > 0 && <span className="ml-1 text-slate-500 font-mono text-[10px]">[E]</span>}
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
              {["all", "AGENT_STARTED", "SCHEMA_EXTRACTED", "ENTITY_MAPPED", "COLUMN_CLASSIFIED", "DRIFT_DETECTED", "REWRITE_GENERATED", "TRANSFER_INTERCEPTED", "TRANSFER_ALLOWED", "GRAPH_UPDATED", "ESCALATION_CREATED", "OVERRIDE_REQUESTED"].map(v => (
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
      <ProspectQRDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        prospectName={prospect?.prospectName ?? ""}
        prospectOrg={prospect?.organization}
        qrValue={window.location.href}
        copyState={copyState}
        onCopy={copyProspectLink}
      />
    </div>
    </>
  );
}
