/**
 * SampleProofReportModal.tsx
 *
 * Renders a full Institutional Proof Report using deterministic demo data.
 * No Council session required — designed to be shown to prospects before
 * any session exists.
 *
 * Sections:
 *   1. Executive Summary
 *   2. Governance Findings
 *   3. Constitution Version
 *   4. Calibration Context
 *   5. Historical Precedents
 *   6. Release Gate Determination
 *   7. Audit References
 *
 * Exports:
 *   - View Sample Report (inline modal)
 *   - Export Sample PDF (client-side PDF via server procedure)
 */

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldCheck, Download, Loader2, X, CheckCircle2, AlertTriangle, BookOpen, Clock, FileText, Scale, Database } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Deterministic demo data ────────────────────────────────────────────────────

export const SAMPLE_PROOF_REPORT = {
  meta: {
    reportId: "IPR-2024-DEMO-001",
    sessionId: "SESSION-DEMO-HELIOS-NORTH-001",
    dealName: "Helios-North Renewable Energy Infrastructure Fund",
    generatedAt: "2024-11-15T09:42:00Z",
    constitutionVersion: "v4.2.1",
    councilMode: "INFRASTRUCTURE",
    verdict: "APPROVED_WITH_CONDITIONS",
    confidenceScore: 0.74,
    yesCount: 7,
    noCount: 3,
  },

  executiveSummary: {
    headline: "Approved with Conditions — 7/10 Council Members in Favour",
    body: `The Helios-North Renewable Energy Infrastructure Fund (€2.1B target, 15-year horizon) received conditional approval from the AgenThink Mesh Council of Specialists. Seven of ten specialist agents voted in favour. The three dissenting votes cited regulatory timeline uncertainty in the German offshore wind permitting regime and concentration risk in a single-jurisdiction asset base.

The Council determined that the deal is structurally sound, the sponsor track record is credible, and the macro tailwinds (EU Green Deal, REPowerEU) are durable. Conditions attach to: (1) a binding regulatory milestone gate at 18 months, (2) a minimum 20% geographic diversification requirement before Fund II drawdown, and (3) enhanced LP reporting on permitting status quarterly.

This report constitutes the machine-verifiable evidence chain for the Council's recommendation. Every finding references a decision ID, rule version, and audit reference.`,
    keyFindings: [
      "Sponsor IRR track record of 14.2% net across three prior infrastructure funds verified against public filings.",
      "German offshore wind permitting risk quantified at 18–24 month delay probability of 34% under base case.",
      "EU taxonomy alignment confirmed at 91% of projected AUM — above the 85% constitutional threshold.",
      "LP concentration risk flagged: top 3 LPs represent 61% of committed capital, exceeding the 55% soft limit.",
      "FX hedging programme covers 78% of EUR/USD exposure — within constitutional tolerance.",
    ],
  },

  governanceFindings: [
    {
      findingId: "GF-001",
      category: "Regulatory Risk",
      severity: "MEDIUM",
      title: "German Offshore Wind Permitting Delay Risk",
      description: "BNetzA permitting timelines for offshore wind projects in the North Sea have extended from 14 to 22 months on average since Q1 2023. Three of the fund's anchor assets (Helios-7, Helios-9, Helios-12) are in active permitting. A 24-month delay scenario reduces base-case IRR by 180bps.",
      governingRule: "INFRA-RISK-003: Regulatory timeline risk must be stress-tested across P10/P50/P90 scenarios.",
      councilConcern: "Infrastructure Risk Specialist (Agent 4): 'Permitting risk is not adequately hedged. The fund has no contractual backstop if BNetzA delays exceed 18 months.'",
      constitutionalFinding: "Constitution v4.2.1 §7.3: Regulatory timeline risk exceeding 20% probability of 12-month delay triggers mandatory milestone gate condition.",
      resolution: "CONDITION ATTACHED: Regulatory milestone gate at 18 months. Fund may not draw beyond 40% of committed capital until Helios-7 receives final BNetzA approval.",
    },
    {
      findingId: "GF-002",
      category: "Concentration Risk",
      severity: "LOW",
      title: "LP Concentration Above Soft Limit",
      description: "Top 3 LPs (Sovereign Wealth Fund A, Pension Fund B, Insurance Group C) represent 61% of committed capital against a constitutional soft limit of 55%. This creates redemption risk in a stress scenario.",
      governingRule: "FUND-STRUCT-007: LP concentration above 55% (top 3) triggers enhanced reporting requirement.",
      councilConcern: "Fund Structure Specialist (Agent 8): 'Concentration is manageable given LP quality, but quarterly reporting on LP liquidity positions is warranted.'",
      constitutionalFinding: "Constitution v4.2.1 §12.1: LP concentration above 55% requires enhanced quarterly reporting. Does not trigger BLOCK.",
      resolution: "CONDITION ATTACHED: Quarterly LP liquidity reporting added to LPA. No capital constraint imposed.",
    },
    {
      findingId: "GF-003",
      category: "Geographic Diversification",
      severity: "LOW",
      title: "Single-Jurisdiction Concentration in Germany",
      description: "87% of Fund I AUM is domiciled in German-jurisdiction assets. While Germany is AAA-rated, single-jurisdiction concentration amplifies regulatory and political risk.",
      governingRule: "INFRA-DIVERSIFY-002: Single-jurisdiction concentration above 80% triggers diversification condition for Fund II.",
      councilConcern: "Geopolitical Risk Specialist (Agent 6): 'Germany is low-risk today, but energy policy reversals are non-zero. Fund II must diversify.'",
      constitutionalFinding: "Constitution v4.2.1 §9.4: Geographic concentration above 80% in a single jurisdiction requires diversification commitment for subsequent fund vehicle.",
      resolution: "CONDITION ATTACHED: Minimum 20% geographic diversification required before Fund II first close.",
    },
    {
      findingId: "GF-004",
      category: "EU Taxonomy Alignment",
      severity: "PASS",
      title: "EU Taxonomy Alignment — Above Threshold",
      description: "91% of projected AUM qualifies under EU Taxonomy Regulation Article 9 (dark green). This exceeds the constitutional 85% threshold and supports SFDR Article 9 classification.",
      governingRule: "ESG-TAXONOMY-001: EU Taxonomy alignment must exceed 85% for infrastructure funds seeking Article 9 classification.",
      councilConcern: "ESG & Regulatory Specialist (Agent 3): 'Taxonomy alignment is strong. The 9% non-qualifying exposure is in grid-balancing assets that may qualify under delegated acts by 2025.'",
      constitutionalFinding: "Constitution v4.2.1 §15.2: EU Taxonomy alignment above 85% — PASS. No condition required.",
      resolution: "PASS — No condition attached.",
    },
    {
      findingId: "GF-005",
      category: "Sponsor Track Record",
      severity: "PASS",
      title: "Sponsor IRR Track Record Verified",
      description: "Helios Capital Partners has delivered 14.2% net IRR across three prior infrastructure funds (Fund I: 13.8%, Fund II: 14.1%, Fund III: 14.7%). Track record verified against audited financial statements and public filings.",
      governingRule: "SPONSOR-TRACK-001: Sponsor must demonstrate minimum 12% net IRR over two or more prior funds.",
      councilConcern: "Investment Committee Specialist (Agent 1): 'Track record is strong and consistent. No concerns.'",
      constitutionalFinding: "Constitution v4.2.1 §4.1: Sponsor track record above 12% net IRR over 2+ funds — PASS.",
      resolution: "PASS — No condition attached.",
    },
  ],

  constitutionVersion: {
    version: "v4.2.1",
    effectiveDate: "2024-09-01",
    applicableRules: [
      { ruleId: "INFRA-RISK-003",       title: "Regulatory Timeline Risk Stress Testing",       section: "§7.3",  status: "APPLIED" },
      { ruleId: "FUND-STRUCT-007",      title: "LP Concentration Reporting Threshold",           section: "§12.1", status: "APPLIED" },
      { ruleId: "INFRA-DIVERSIFY-002",  title: "Single-Jurisdiction Diversification Condition",  section: "§9.4",  status: "APPLIED" },
      { ruleId: "ESG-TAXONOMY-001",     title: "EU Taxonomy Alignment Minimum",                  section: "§15.2", status: "APPLIED" },
      { ruleId: "SPONSOR-TRACK-001",    title: "Sponsor Track Record Minimum",                   section: "§4.1",  status: "APPLIED" },
      { ruleId: "FX-HEDGE-004",         title: "FX Hedging Coverage Minimum",                    section: "§11.2", status: "APPLIED" },
    ],
    supersededRules: [
      { ruleId: "INFRA-RISK-002", supersededBy: "INFRA-RISK-003", reason: "Updated permitting delay probability thresholds for post-2023 BNetzA data." },
    ],
    constitutionHash: "sha256:a3f8c2d1e9b47f6a2c8d3e1f9b47a6c2d8e3f1b9a47c6d2e8f3b1a9c47d6e2",
  },

  calibrationContext: {
    historicalDataset: "AgenThink Infrastructure Decisions Database v2024.Q3",
    comparableDeals: 847,
    calibrationDate: "2024-11-01",
    baseRateApproval: 0.68,
    baseRateConditional: 0.21,
    baseRateReject: 0.11,
    calibrationNotes: "Council confidence scores calibrated against 847 comparable infrastructure fund decisions (2018–2024). Renewable energy infrastructure funds in the €1.5B–€3B range show a 71% approval rate with an average of 1.8 conditions attached. This deal's 74% confidence score is consistent with the peer group median of 72%.",
    peerGroupDefinition: "Renewable energy infrastructure funds, European jurisdiction, €1.5B–€3B target, 12–18 year horizon, closed 2018–2024.",
    confidenceCalibration: {
      dealConfidence: 0.74,
      peerMedianConfidence: 0.72,
      peerP25Confidence: 0.61,
      peerP75Confidence: 0.83,
      calibrationVerdict: "WITHIN_NORMAL_RANGE",
    },
  },

  historicalPrecedents: [
    {
      precedentId: "PREC-INFRA-2023-047",
      dealName: "Nordic Wind Partners Fund III",
      year: 2023,
      outcome: "APPROVED_WITH_CONDITIONS",
      similarity: 0.89,
      relevantFinding: "Permitting delay condition attached — BNetzA milestone gate at 18 months. Fund subsequently met condition and drew full capital.",
      lesson: "Milestone gate conditions on permitting risk are effective. 94% of comparable deals with this condition met the gate within the specified timeframe.",
    },
    {
      precedentId: "PREC-INFRA-2022-031",
      dealName: "Meridian Offshore Energy Infrastructure",
      year: 2022,
      outcome: "APPROVED_WITH_CONDITIONS",
      similarity: 0.82,
      relevantFinding: "LP concentration condition attached — quarterly reporting requirement. No adverse outcomes observed over 24-month monitoring period.",
      lesson: "LP concentration above 55% (top 3) is manageable with enhanced reporting. No capital constraints required in comparable cases.",
    },
    {
      precedentId: "PREC-INFRA-2021-019",
      dealName: "Solaris European Renewables Fund",
      year: 2021,
      outcome: "REJECTED",
      similarity: 0.61,
      relevantFinding: "Single-jurisdiction concentration above 90% in Italy — regulatory reversal risk materialised. Fund suffered 340bps IRR drag from Superbonus policy reversal.",
      lesson: "Single-jurisdiction concentration above 85% in politically volatile jurisdictions is a material risk. Germany is lower risk, but diversification condition for Fund II is warranted.",
    },
  ],

  releaseGateDetermination: {
    gateStatus: "CONDITIONAL_RELEASE",
    gateVersion: "GATE-v4.2.1",
    hardBlocks: [],
    softBlocks: [],
    conditions: [
      {
        conditionId: "COND-001",
        title: "Regulatory Milestone Gate — BNetzA Approval",
        description: "Fund may not draw beyond 40% of committed capital until Helios-7 receives final BNetzA approval or the 18-month milestone date passes with a documented contingency plan.",
        deadline: "2026-05-15",
        verificationMethod: "Audited regulatory filing confirmation from BNetzA public register.",
        governingRule: "INFRA-RISK-003 / Constitution v4.2.1 §7.3",
      },
      {
        conditionId: "COND-002",
        title: "LP Concentration — Enhanced Quarterly Reporting",
        description: "Quarterly LP liquidity position reporting to be added to LPA before first close.",
        deadline: "2024-12-31",
        verificationMethod: "Executed LPA amendment confirming quarterly reporting obligation.",
        governingRule: "FUND-STRUCT-007 / Constitution v4.2.1 §12.1",
      },
      {
        conditionId: "COND-003",
        title: "Geographic Diversification — Fund II Commitment",
        description: "Minimum 20% geographic diversification (non-German assets) required before Fund II first close.",
        deadline: "Fund II first close",
        verificationMethod: "Fund II LPA confirming geographic diversification mandate.",
        governingRule: "INFRA-DIVERSIFY-002 / Constitution v4.2.1 §9.4",
      },
    ],
    releaseNarrative: "The Council authorises conditional release of the Helios-North Institutional Proof Report. Three conditions attach. No hard BLOCK violations were identified. The deal may proceed to LP close subject to satisfaction of all three conditions. The Release Gate will be re-evaluated at the 18-month milestone review.",
  },

  auditReferences: [
    { refId: "AUD-001", type: "COUNCIL_SESSION",       description: "Council session transcript — 10 specialist agents, 47-minute deliberation",         timestamp: "2024-11-15T09:00:00Z", hash: "sha256:b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7" },
    { refId: "AUD-002", type: "CONSTITUTION_SNAPSHOT",  description: "Constitution v4.2.1 snapshot at time of decision",                                   timestamp: "2024-11-15T09:00:00Z", hash: "sha256:c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8" },
    { refId: "AUD-003", type: "CALIBRATION_DATASET",    description: "Calibration dataset v2024.Q3 — 847 comparable infrastructure fund decisions",         timestamp: "2024-11-01T00:00:00Z", hash: "sha256:d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9" },
    { refId: "AUD-004", type: "DEAL_TEXT_HASH",          description: "SHA-256 hash of submitted deal memorandum (v3, final)",                               timestamp: "2024-11-14T16:30:00Z", hash: "sha256:e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0" },
    { refId: "AUD-005", type: "PRECEDENT_DATABASE",      description: "Historical precedent database v2024.Q3 — 3 comparable precedents cited",              timestamp: "2024-11-01T00:00:00Z", hash: "sha256:f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1" },
    { refId: "AUD-006", type: "RELEASE_GATE_LOG",        description: "Release gate evaluation log — CONDITIONAL_RELEASE, 3 conditions, 0 hard blocks",      timestamp: "2024-11-15T09:42:00Z", hash: "sha256:a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2" },
  ],
};

// ── Helper: severity badge ─────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PASS:   { label: "PASS",   className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    LOW:    { label: "LOW",    className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
    MEDIUM: { label: "MEDIUM", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    HIGH:   { label: "HIGH",   className: "bg-red-500/15 text-red-400 border-red-500/30" },
  };
  const s = map[severity] ?? map.LOW;
  return (
    <span className={`inline-flex items-center text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border font-mono ${s.className}`}>
      {s.label}
    </span>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
        <span className="text-white/50">{icon}</span>
        <h3 className="text-xs font-bold text-white/70 uppercase tracking-widest font-mono">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface SampleProofReportModalProps {
  open: boolean;
  onClose: () => void;
}

export function SampleProofReportModal({ open, onClose }: SampleProofReportModalProps) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const sampleProofPdf = trpc.proofEngine.sampleProofReport.useMutation();

  const handleExportSamplePdf = async () => {
    setExportingPdf(true);
    setExportDone(false);
    try {
      const res = await sampleProofPdf.mutateAsync({});
      const bytes = Uint8Array.from(atob(res.pdfBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Helios-North_Institutional_Proof_Report_SAMPLE.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportDone(true);
      toast.success("Sample Proof Report downloaded.");
      setTimeout(() => setExportDone(false), 3000);
    } catch (err: any) {
      toast.error(`Export failed: ${err.message?.slice(0, 80)}`);
    } finally {
      setExportingPdf(false);
    }
  };

  const r = SAMPLE_PROOF_REPORT;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full bg-[#0B1629] border-white/10 text-white p-0 gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-sky-400 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base font-bold text-white">Institutional Proof Report</DialogTitle>
                  <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">SAMPLE</Badge>
                  <Badge className="text-[9px] px-1.5 py-0 bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono">NEW</Badge>
                </div>
                <p className="text-xs text-white/40 mt-0.5 font-mono">{r.meta.dealName} · {r.meta.reportId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportSamplePdf}
                disabled={exportingPdf || exportDone}
                className="h-7 text-xs gap-1.5 bg-sky-500/10 border-sky-500/40 hover:bg-sky-500/20 text-sky-400"
              >
                {exportingPdf ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                ) : exportDone ? (
                  <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Downloaded</>
                ) : (
                  <><Download className="h-3 w-3" /> Export Sample PDF</>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Trust badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {["Machine-Verifiable", "Audit Ready", "Governance Traceable", "Constitution v4.2.1"].map(b => (
              <span key={b} className="text-[9px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{b}</span>
            ))}
            <span className="text-[9px] font-mono text-white/30 ml-auto">Advisory sample — does not represent a real transaction</span>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-6 py-6">

            {/* Meta row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Verdict",       value: "APPROVED WITH CONDITIONS", color: "text-sky-400" },
                { label: "Confidence",    value: `${Math.round(r.meta.confidenceScore * 100)}%`, color: "text-white/80" },
                { label: "Council Vote",  value: `${r.meta.yesCount}/10 YES`, color: "text-emerald-400" },
                { label: "Constitution",  value: r.meta.constitutionVersion, color: "text-white/60" },
              ].map(m => (
                <div key={m.label} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">{m.label}</div>
                  <div className={`text-sm font-bold font-mono ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* 1. Executive Summary */}
            <Section icon={<FileText className="h-4 w-4" />} title="1 · Executive Summary">
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-4 mb-4">
                <p className="text-sm font-semibold text-white/90 mb-3">{r.executiveSummary.headline}</p>
                <p className="text-xs text-white/60 leading-relaxed whitespace-pre-line">{r.executiveSummary.body}</p>
              </div>
              <div className="space-y-2">
                {r.executiveSummary.keyFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-sky-400 text-[10px] mt-0.5 shrink-0 font-mono">▶</span>
                    <span className="text-xs text-white/60 leading-relaxed">{f}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 2. Governance Findings */}
            <Section icon={<Scale className="h-4 w-4" />} title="2 · Governance Findings">
              <div className="space-y-4">
                {r.governanceFindings.map(gf => (
                  <div key={gf.findingId} className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono text-white/30">{gf.findingId}</span>
                        <SeverityBadge severity={gf.severity} />
                        <span className="text-xs font-semibold text-white/80">{gf.title}</span>
                      </div>
                      <span className="text-[9px] font-mono text-white/30 shrink-0">{gf.category}</span>
                    </div>
                    <p className="text-xs text-white/55 leading-relaxed mb-3">{gf.description}</p>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <span className="text-[9px] font-mono text-white/30 shrink-0 w-28">Governing Rule</span>
                        <span className="text-[10px] font-mono text-amber-400/80">{gf.governingRule}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-mono text-white/30 shrink-0 w-28">Council Concern</span>
                        <span className="text-[10px] text-white/50 italic">{gf.councilConcern}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-mono text-white/30 shrink-0 w-28">Constitutional</span>
                        <span className="text-[10px] font-mono text-sky-400/80">{gf.constitutionalFinding}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-mono text-white/30 shrink-0 w-28">Resolution</span>
                        <span className="text-[10px] font-semibold text-emerald-400">{gf.resolution}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* 3. Constitution Version */}
            <Section icon={<BookOpen className="h-4 w-4" />} title="3 · Constitution Version">
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-[9px] font-mono text-white/30 mb-1">VERSION</div>
                    <div className="text-sm font-bold font-mono text-sky-400">{r.constitutionVersion.version}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-white/30 mb-1">EFFECTIVE DATE</div>
                    <div className="text-sm font-bold font-mono text-white/70">{r.constitutionVersion.effectiveDate}</div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[9px] font-mono text-white/30 mb-1">CONSTITUTION HASH</div>
                    <div className="text-[9px] font-mono text-white/40 break-all">{r.constitutionVersion.constitutionHash}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {r.constitutionVersion.applicableRules.map(rule => (
                    <div key={rule.ruleId} className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-sky-400/70 w-36 shrink-0">{rule.ruleId}</span>
                      <span className="text-[10px] text-white/55 flex-1">{rule.title}</span>
                      <span className="text-[9px] font-mono text-white/30 w-12 text-right">{rule.section}</span>
                      <Badge className="text-[8px] px-1 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono">{rule.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              {r.constitutionVersion.supersededRules.length > 0 && (
                <div className="text-[10px] text-white/30 font-mono">
                  Superseded: {r.constitutionVersion.supersededRules.map(s => `${s.ruleId} → ${s.supersededBy}`).join(", ")}
                </div>
              )}
            </Section>

            {/* 4. Calibration Context */}
            <Section icon={<Database className="h-4 w-4" />} title="4 · Calibration Context">
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs text-white/55 leading-relaxed mb-4">{r.calibrationContext.calibrationNotes}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Comparable Deals",  value: r.calibrationContext.comparableDeals.toString() },
                    { label: "Base Rate Approval", value: `${Math.round(r.calibrationContext.baseRateApproval * 100)}%` },
                    { label: "Deal Confidence",    value: `${Math.round(r.calibrationContext.confidenceCalibration.dealConfidence * 100)}%` },
                    { label: "Peer Median",        value: `${Math.round(r.calibrationContext.confidenceCalibration.peerMedianConfidence * 100)}%` },
                  ].map(m => (
                    <div key={m.label} className="rounded border border-white/8 bg-white/[0.03] px-3 py-2">
                      <div className="text-[9px] font-mono text-white/30 mb-1">{m.label.toUpperCase()}</div>
                      <div className="text-sm font-bold font-mono text-white/80">{m.value}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono text-white/30">
                  Peer group: {r.calibrationContext.peerGroupDefinition}
                </div>
              </div>
            </Section>

            {/* 5. Historical Precedents */}
            <Section icon={<Clock className="h-4 w-4" />} title="5 · Historical Precedents">
              <div className="space-y-3">
                {r.historicalPrecedents.map(p => (
                  <div key={p.precedentId} className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="text-xs font-semibold text-white/80">{p.dealName}</span>
                        <span className="text-[9px] font-mono text-white/30 ml-2">{p.year}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] font-mono text-white/30">{Math.round(p.similarity * 100)}% similar</span>
                        <Badge className="text-[8px] px-1.5 py-0 bg-sky-500/10 text-sky-400 border-sky-500/20 font-mono">{p.outcome.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed mb-2">{p.relevantFinding}</p>
                    <p className="text-[10px] text-amber-400/70 font-mono italic">Lesson: {p.lesson}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* 6. Release Gate Determination */}
            <Section icon={<AlertTriangle className="h-4 w-4" />} title="6 · Release Gate Determination">
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-sky-400" />
                  <span className="text-sm font-bold text-sky-400 font-mono">CONDITIONAL RELEASE</span>
                  <span className="text-[9px] font-mono text-white/30">{r.releaseGateDetermination.gateVersion}</span>
                </div>
                <p className="text-xs text-white/55 leading-relaxed mb-4">{r.releaseGateDetermination.releaseNarrative}</p>
                <div className="space-y-3">
                  {r.releaseGateDetermination.conditions.map(c => (
                    <div key={c.conditionId} className="rounded border border-amber-500/20 bg-amber-500/[0.04] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-mono text-amber-400/60">{c.conditionId}</span>
                        <span className="text-xs font-semibold text-white/80">{c.title}</span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed mb-2">{c.description}</p>
                      <div className="flex gap-4 flex-wrap">
                        <div className="text-[9px] font-mono text-white/30">Deadline: <span className="text-amber-400/70">{c.deadline}</span></div>
                        <div className="text-[9px] font-mono text-white/30">Rule: <span className="text-sky-400/70">{c.governingRule}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* 7. Audit References */}
            <Section icon={<ShieldCheck className="h-4 w-4" />} title="7 · Audit References">
              <div className="space-y-2">
                {r.auditReferences.map(ref => (
                  <div key={ref.refId} className="flex items-start gap-3 rounded border border-white/6 bg-white/[0.02] px-3 py-2.5">
                    <span className="text-[9px] font-mono text-white/30 w-16 shrink-0 mt-0.5">{ref.refId}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-mono text-sky-400/70 mb-0.5">{ref.type}</div>
                      <div className="text-xs text-white/55">{ref.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[8px] font-mono text-white/25 mb-0.5">{new Date(ref.timestamp).toLocaleDateString()}</div>
                      <div className="text-[8px] font-mono text-white/20 break-all max-w-[120px]">{ref.hash.slice(0, 20)}…</div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex-shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[9px] font-mono text-white/25">
            Sample report · Deterministic demo data · Not a real transaction · AgenThink Mesh Governed Decision Infrastructure
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportSamplePdf}
            disabled={exportingPdf || exportDone}
            className="h-7 text-xs gap-1.5 bg-sky-500/10 border-sky-500/40 hover:bg-sky-500/20 text-sky-400"
          >
            {exportingPdf ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
            ) : exportDone ? (
              <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Downloaded</>
            ) : (
              <><Download className="h-3 w-3" /> Export Sample PDF</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Trigger button (standalone, for use in ReportsPanel and Landing) ──────────

interface ViewSampleProofReportButtonProps {
  variant?: "primary" | "secondary" | "inline";
  className?: string;
}

export function ViewSampleProofReportButton({ variant = "secondary", className = "" }: ViewSampleProofReportButtonProps) {
  const [open, setOpen] = useState(false);

  if (variant === "primary") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border transition-colors ${className}`}
          style={{ background: "transparent", color: "#A8B4C8", border: "1px solid #243B6E", cursor: "pointer" }}
        >
          <ShieldCheck className="h-4 w-4" />
          View Sample Proof Report
        </button>
        <SampleProofReportModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors font-mono ${className}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <ShieldCheck className="h-3 w-3" />
          View Sample Report →
        </button>
        <SampleProofReportModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`h-7 text-xs gap-1.5 bg-sky-500/10 border-sky-500/40 hover:bg-sky-500/20 text-sky-400 ${className}`}
      >
        <ShieldCheck className="h-3 w-3" />
        View Sample Report
      </Button>
      <SampleProofReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
