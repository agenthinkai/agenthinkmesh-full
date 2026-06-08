/**
 * proofReportPdf.ts — Institutional Proof Report PDF Generator
 *
 * Produces a structured, institution-ready Proof Report from governance artifacts.
 * Uses PDFKit (same pattern as icMemoPdf.ts / stressTestReportPdf.ts).
 *
 * 13 sections:
 *  1. Executive Summary
 *  2. Council Vote Distribution
 *  3. Persona Confidence Analysis
 *  4. Constitutional Compliance Review
 *  5. Governance Findings
 *  6. Constitution Version References
 *  7. Contradiction Analysis
 *  8. Calibration Context
 *  9. Historical Precedents
 * 10. Release Gate Determination
 * 11. Evidence Chain
 * 12. Audit References
 * 13. Traceability Appendix
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProofReportInput {
  // Identity
  reportId: string;
  generatedAt: number; // UTC ms
  sessionId: string;
  dealId?: string | null;
  dealName?: string | null;
  councilMode: string;

  // Section 1 — Executive Summary
  executiveSummary: {
    originalVerdict: string;
    consensusScore: number | null;
    confidenceLevel: number | null;
    cfaFidelityScore: number | null;
    releaseGate: "RELEASED" | "BLOCKED" | "PENDING";
    blockReasons: string[];
    summaryStatement: string;
  };

  // Section 2 — Council Vote Distribution
  voteDistribution: {
    yesCount: number;
    noCount: number;
    totalPersonas: number;
    verdict: string;
    consensusReached: boolean;
    hardFlags: string[];
    silentFails: string[];
  };

  // Section 3 — Persona Confidence Analysis
  personaConfidence: Array<{
    personaId: string;
    personaName: string;
    fidelityScore: number;
    changed: boolean;
    critique: string | null;
    violatedRules: string[];
    scoreInCharacter: number;
    scoreRuleFidelity: number;
    scoreEvidenceGrounding: number;
    scoreConfidenceCalib: number;
  }>;

  // Section 4 — Constitutional Compliance Review
  constitutionalCompliance: {
    averageFidelityScore: number;
    totalPersonasAudited: number;
    totalChanged: number;
    complianceRate: number; // 0–1
    status: "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT";
  };

  // Section 5 — Governance Findings
  governanceFindings: Array<{
    findingId: string;
    ruleId: string;
    ruleText: string;
    severity: string;
    status: "violation" | "pass";
    detectedAt: number;
    constitutionVersion: number;
  }>;

  // Section 6 — Constitution Version References
  constitutionVersions: Array<{
    version: number;
    activeRules: number;
    description: string;
  }>;

  // Section 7 — Contradiction Analysis
  contradictions: Array<{
    contradictionId: string;
    decisionIdA: string;
    decisionIdB: string;
    ruleId: string;
    description: string;
    detectedAt: number;
  }>;

  // Section 8 — Calibration Context
  calibrationContext: {
    personaWeights: Array<{
      personaId: string;
      weight: number;
      sampleSize: number;
      brierScore: number;
      trusted: boolean;
    }>;
    applyWeightsEnabled: boolean;
    minSamplesForTrust: number;
  };

  // Section 9 — Historical Precedents
  historicalPrecedents: Array<{
    decisionId: string;
    dealType: string;
    verdict: string;
    outcomeStatus: string;
    decisionDate: number;
    similarity: string;
  }>;

  // Section 10 — Release Gate Determination
  releaseGate: {
    gate: "RELEASED" | "BLOCKED" | "PENDING";
    blockingRules: string[];
    warningRules: string[];
    councilConsensusPosition: string;
    finalPosition: string;
    rationale: string;
  };

  // Section 11 — Evidence Chain
  evidenceChain: Array<{
    stage: string;
    artifactId: string;
    artifactType: string;
    summary: string;
    timestamp: number;
  }>;

  // Section 12 — Audit References
  auditReferences: Array<{
    eventType: string;
    module: string;
    timestamp: number;
    summary: string;
  }>;

  // Section 13 — Traceability Appendix
  traceability: {
    sessionId: string;
    cfaSessionId: string | null;
    outcomeSessionId: string | null;
    constitutionVersion: number;
    reportGeneratedAt: number;
    reportVersion: string;
  };
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

const BRAND_DARK = "#0a0f1e";
const BRAND_BLUE = "#1e6bff";
const BRAND_LIGHT_BLUE = "#4a9eff";
const TEXT_PRIMARY = "#1a1a2e";
const TEXT_SECONDARY = "#4a4a6a";
const TEXT_MUTED = "#8888aa";
const BORDER_COLOR = "#e0e0f0";
const SECTION_BG = "#f8f9ff";
const BLOCKED_RED = "#dc2626";
const RELEASED_GREEN = "#16a34a";
const WARN_AMBER = "#d97706";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtScore(v: number | null, dp = 3): string {
  if (v == null) return "—";
  return v.toFixed(dp);
}

export async function generateProofReportPdf(input: ProofReportInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Institutional Proof Report — ${input.dealName ?? input.sessionId}`,
        Author: "AgenThink Mesh Proof Engine",
        Subject: "Institutional Governance Proof Record",
        Keywords: "proof, governance, institutional, decision intelligence",
        CreationDate: new Date(input.generatedAt),
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width - 100; // usable width

    // ── Helpers ────────────────────────────────────────────────────────────────

    function addPage() {
      doc.addPage();
    }

    function sectionHeader(title: string, sectionNum: number) {
      if (doc.y > doc.page.height - 120) addPage();
      doc.moveDown(0.5);
      // Section number pill
      doc.roundedRect(50, doc.y, 28, 18, 4)
        .fill(BRAND_BLUE);
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
        .text(String(sectionNum), 50, doc.y - 17, { width: 28, align: "center" });
      doc.fillColor(TEXT_PRIMARY).fontSize(13).font("Helvetica-Bold")
        .text(title, 85, doc.y - 17, { width: pageW - 35 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(BRAND_BLUE).lineWidth(1.5).stroke();
      doc.moveDown(0.5);
    }

    function kv(label: string, value: string, indent = 0) {
      const x = 50 + indent;
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
        .text(label.toUpperCase(), x, doc.y, { continued: false });
      doc.fillColor(TEXT_PRIMARY).fontSize(10).font("Helvetica")
        .text(value, x, doc.y, { width: pageW - indent });
      doc.moveDown(0.3);
    }

    function tableRow(cells: string[], widths: number[], isHeader = false) {
      if (doc.y > doc.page.height - 60) addPage();
      const startY = doc.y;
      let x = 50;
      const rowH = 18;
      if (isHeader) {
        doc.rect(50, startY, pageW, rowH).fill(BRAND_DARK);
      } else {
        doc.rect(50, startY, pageW, rowH).fill(SECTION_BG);
      }
      cells.forEach((cell, i) => {
        const color = isHeader ? "#ffffff" : TEXT_PRIMARY;
        const font = isHeader ? "Helvetica-Bold" : "Helvetica";
        doc.fillColor(color).fontSize(8).font(font)
          .text(cell, x + 4, startY + 5, { width: widths[i] - 8, lineBreak: false, ellipsis: true });
        x += widths[i];
      });
      doc.y = startY + rowH + 1;
    }

    function badge(text: string, color: string) {
      const w = doc.widthOfString(text) + 12;
      const h = 14;
      doc.roundedRect(50, doc.y, w, h, 3).fill(color);
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
        .text(text, 50, doc.y - h + 3, { width: w, align: "center" });
      doc.moveDown(0.8);
    }

    // ── Cover Page ─────────────────────────────────────────────────────────────

    // Dark header band
    doc.rect(0, 0, doc.page.width, 180).fill(BRAND_DARK);

    // Title
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold")
      .text("INSTITUTIONAL PROOF REPORT", 50, 40, { width: pageW });
    doc.fillColor(BRAND_LIGHT_BLUE).fontSize(12).font("Helvetica")
      .text("AgenThink Mesh — Decision Intelligence Layer", 50, 70, { width: pageW });

    // Deal name
    const dealLabel = input.dealName ?? input.sessionId;
    doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
      .text(dealLabel, 50, 100, { width: pageW });

    // Meta strip
    doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
      .text(
        `Session ID: ${input.sessionId}   |   Council Mode: ${input.councilMode.toUpperCase()}   |   Generated: ${fmtDate(input.generatedAt)}`,
        50, 140, { width: pageW }
      );

    doc.y = 200;

    // Release gate badge (large)
    const gateColor = input.releaseGate.gate === "RELEASED" ? RELEASED_GREEN
      : input.releaseGate.gate === "BLOCKED" ? BLOCKED_RED : WARN_AMBER;
    const gateLabel = `RELEASE GATE: ${input.releaseGate.gate}`;
    doc.roundedRect(50, doc.y, 220, 32, 6).fill(gateColor);
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold")
      .text(gateLabel, 50, doc.y - 30, { width: 220, align: "center" });
    doc.y += 10;
    doc.moveDown(1);

    // Summary statement
    doc.fillColor(TEXT_PRIMARY).fontSize(11).font("Helvetica")
      .text(input.executiveSummary.summaryStatement, 50, doc.y, { width: pageW });
    doc.moveDown(1);

    // Quick stats table
    const statsW = [pageW / 4, pageW / 4, pageW / 4, pageW / 4];
    tableRow(["Verdict", "Consensus", "CFA Fidelity", "Confidence"], statsW, true);
    tableRow([
      input.executiveSummary.originalVerdict,
      fmtPct(input.executiveSummary.consensusScore),
      fmtScore(input.executiveSummary.cfaFidelityScore),
      fmtPct(input.executiveSummary.confidenceLevel),
    ], statsW);

    doc.moveDown(1.5);

    // Report ID + version
    doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
      .text(`Report ID: ${input.reportId}   |   Report Version: ${input.traceability.reportVersion}   |   Constitution Version: ${input.traceability.constitutionVersion}`, 50, doc.y);
    doc.moveDown(2);

    // ── Section 1 — Executive Summary ─────────────────────────────────────────
    sectionHeader("Executive Summary", 1);
    kv("Original Verdict", input.executiveSummary.originalVerdict);
    kv("Release Gate", input.executiveSummary.releaseGate);
    if (input.executiveSummary.blockReasons.length > 0) {
      kv("Block Reasons", input.executiveSummary.blockReasons.join("; "));
    }
    kv("CFA Fidelity Score", fmtScore(input.executiveSummary.cfaFidelityScore));
    kv("Consensus Score", fmtPct(input.executiveSummary.consensusScore));
    kv("Confidence Level", fmtPct(input.executiveSummary.confidenceLevel));
    doc.moveDown(0.5);

    // ── Section 2 — Council Vote Distribution ─────────────────────────────────
    sectionHeader("Council Vote Distribution", 2);
    kv("Verdict", input.voteDistribution.verdict);
    kv("Yes / No", `${input.voteDistribution.yesCount} / ${input.voteDistribution.noCount} of ${input.voteDistribution.totalPersonas} personas`);
    kv("Consensus Reached", input.voteDistribution.consensusReached ? "Yes" : "No");
    if (input.voteDistribution.hardFlags.length > 0) {
      kv("Hard Flags", input.voteDistribution.hardFlags.join(", "));
    }
    if (input.voteDistribution.silentFails.length > 0) {
      kv("Silent Fails", input.voteDistribution.silentFails.join(", "));
    }
    doc.moveDown(0.5);

    // ── Section 3 — Persona Confidence Analysis ───────────────────────────────
    sectionHeader("Persona Confidence Analysis", 3);
    if (input.personaConfidence.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No CFA persona records available for this session.", 50, doc.y);
      doc.moveDown(0.5);
    } else {
      const pcW = [pageW * 0.22, pageW * 0.12, pageW * 0.12, pageW * 0.12, pageW * 0.12, pageW * 0.12, pageW * 0.18];
      tableRow(["Persona", "Fidelity", "In-Char", "Rule Fid.", "Evidence", "Conf.Cal.", "Changed"], pcW, true);
      for (const p of input.personaConfidence) {
        tableRow([
          p.personaName,
          fmtScore(p.fidelityScore),
          fmtScore(p.scoreInCharacter),
          fmtScore(p.scoreRuleFidelity),
          fmtScore(p.scoreEvidenceGrounding),
          fmtScore(p.scoreConfidenceCalib),
          p.changed ? "Yes" : "No",
        ], pcW);
      }
    }
    doc.moveDown(0.5);

    // ── Section 4 — Constitutional Compliance Review ──────────────────────────
    sectionHeader("Constitutional Compliance Review", 4);
    const cc = input.constitutionalCompliance;
    kv("Compliance Status", cc.status);
    kv("Average Fidelity Score", fmtScore(cc.averageFidelityScore));
    kv("Compliance Rate", fmtPct(cc.complianceRate));
    kv("Personas Audited", String(cc.totalPersonasAudited));
    kv("Personas Revised by CFA", String(cc.totalChanged));
    doc.moveDown(0.5);

    // ── Section 5 — Governance Findings ───────────────────────────────────────
    sectionHeader("Governance Findings", 5);
    if (input.governanceFindings.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No governance findings recorded for this session.", 50, doc.y);
      doc.moveDown(0.5);
    } else {
      const gfW = [pageW * 0.15, pageW * 0.12, pageW * 0.12, pageW * 0.08, pageW * 0.53];
      tableRow(["Finding ID", "Rule ID", "Status", "Severity", "Rule Text"], gfW, true);
      for (const f of input.governanceFindings) {
        tableRow([
          f.findingId.slice(0, 12),
          f.ruleId,
          f.status.toUpperCase(),
          f.severity.toUpperCase(),
          f.ruleText.slice(0, 80),
        ], gfW);
      }
    }
    doc.moveDown(0.5);

    // ── Section 6 — Constitution Version References ───────────────────────────
    sectionHeader("Constitution Version References", 6);
    if (input.constitutionVersions.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("Constitution version data not available.", 50, doc.y);
    } else {
      const cvW = [pageW * 0.15, pageW * 0.2, pageW * 0.65];
      tableRow(["Version", "Active Rules", "Description"], cvW, true);
      for (const v of input.constitutionVersions) {
        tableRow([String(v.version), String(v.activeRules), v.description.slice(0, 100)], cvW);
      }
    }
    doc.moveDown(0.5);

    // ── Section 7 — Contradiction Analysis ────────────────────────────────────
    sectionHeader("Contradiction Analysis", 7);
    if (input.contradictions.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No cross-decision contradictions detected.", 50, doc.y);
      doc.moveDown(0.5);
    } else {
      const ctW = [pageW * 0.18, pageW * 0.18, pageW * 0.14, pageW * 0.5];
      tableRow(["Decision A", "Decision B", "Rule", "Description"], ctW, true);
      for (const c of input.contradictions) {
        tableRow([
          c.decisionIdA.slice(0, 14),
          c.decisionIdB.slice(0, 14),
          c.ruleId,
          c.description.slice(0, 80),
        ], ctW);
      }
    }
    doc.moveDown(0.5);

    // ── Section 8 — Calibration Context ───────────────────────────────────────
    sectionHeader("Calibration Context", 8);
    const cal = input.calibrationContext;
    kv("Apply Weights to Consensus", cal.applyWeightsEnabled ? "ENABLED" : "DISABLED (safety gate)");
    kv("Min Samples for Trust", String(cal.minSamplesForTrust));
    doc.moveDown(0.3);
    if (cal.personaWeights.length > 0) {
      const pwW = [pageW * 0.3, pageW * 0.15, pageW * 0.15, pageW * 0.2, pageW * 0.2];
      tableRow(["Persona", "Weight", "Brier Score", "Sample Size", "Trusted"], pwW, true);
      for (const pw of cal.personaWeights) {
        tableRow([
          pw.personaId,
          fmtScore(pw.weight, 4),
          fmtScore(pw.brierScore, 4),
          String(pw.sampleSize),
          pw.trusted ? "Yes" : "No (below floor)",
        ], pwW);
      }
    } else {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No calibration weight data available.", 50, doc.y);
    }
    doc.moveDown(0.5);

    // ── Section 9 — Historical Precedents ─────────────────────────────────────
    sectionHeader("Historical Precedents", 9);
    if (input.historicalPrecedents.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No comparable historical decisions found.", 50, doc.y);
      doc.moveDown(0.5);
    } else {
      const hpW = [pageW * 0.22, pageW * 0.18, pageW * 0.18, pageW * 0.18, pageW * 0.24];
      tableRow(["Decision ID", "Deal Type", "Verdict", "Outcome", "Date"], hpW, true);
      for (const h of input.historicalPrecedents) {
        tableRow([
          h.decisionId.slice(0, 16),
          h.dealType,
          h.verdict,
          h.outcomeStatus,
          fmtDate(h.decisionDate),
        ], hpW);
      }
    }
    doc.moveDown(0.5);

    // ── Section 10 — Release Gate Determination ───────────────────────────────
    sectionHeader("Release Gate Determination", 10);
    const rg = input.releaseGate;
    kv("Gate Decision", rg.gate);
    kv("Council Consensus Position", rg.councilConsensusPosition);
    kv("Final Position", rg.finalPosition);
    kv("Rationale", rg.rationale);
    if (rg.blockingRules.length > 0) {
      kv("Blocking Rules", rg.blockingRules.join(", "));
    }
    if (rg.warningRules.length > 0) {
      kv("Warning Rules", rg.warningRules.join(", "));
    }
    doc.moveDown(0.5);

    // ── Section 11 — Evidence Chain ───────────────────────────────────────────
    sectionHeader("Evidence Chain", 11);
    if (input.evidenceChain.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No evidence chain artifacts recorded.", 50, doc.y);
      doc.moveDown(0.5);
    } else {
      const ecW = [pageW * 0.18, pageW * 0.18, pageW * 0.18, pageW * 0.3, pageW * 0.16];
      tableRow(["Stage", "Artifact ID", "Type", "Summary", "Timestamp"], ecW, true);
      for (const e of input.evidenceChain) {
        tableRow([
          e.stage,
          e.artifactId.slice(0, 14),
          e.artifactType,
          e.summary.slice(0, 40),
          fmtDate(e.timestamp),
        ], ecW);
      }
    }
    doc.moveDown(0.5);

    // ── Section 12 — Audit References ─────────────────────────────────────────
    sectionHeader("Audit References", 12);
    if (input.auditReferences.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(9).text("No audit log entries found for this session.", 50, doc.y);
      doc.moveDown(0.5);
    } else {
      const arW = [pageW * 0.22, pageW * 0.18, pageW * 0.18, pageW * 0.42];
      tableRow(["Event Type", "Module", "Timestamp", "Summary"], arW, true);
      for (const a of input.auditReferences.slice(0, 30)) { // cap at 30 for readability
        tableRow([
          a.eventType,
          a.module,
          fmtDate(a.timestamp),
          a.summary.slice(0, 60),
        ], arW);
      }
      if (input.auditReferences.length > 30) {
        doc.fillColor(TEXT_MUTED).fontSize(8)
          .text(`... and ${input.auditReferences.length - 30} additional audit entries (see JSON export for full log).`, 50, doc.y);
        doc.moveDown(0.3);
      }
    }
    doc.moveDown(0.5);

    // ── Section 13 — Traceability Appendix ────────────────────────────────────
    sectionHeader("Traceability Appendix", 13);
    const tr = input.traceability;
    kv("Session ID", tr.sessionId);
    kv("CFA Session ID", tr.cfaSessionId ?? "Not available");
    kv("Outcome Session ID", tr.outcomeSessionId ?? "Not available");
    kv("Constitution Version", String(tr.constitutionVersion));
    kv("Report Generated At", fmtDate(tr.reportGeneratedAt));
    kv("Report Version", tr.reportVersion);
    doc.moveDown(1);

    // ── Footer on last page ────────────────────────────────────────────────────
    doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
      .text(
        `AgenThink Mesh — Institutional Proof Engine   |   Report ID: ${input.reportId}   |   ${fmtDate(input.generatedAt)}`,
        50, doc.page.height - 40, { width: pageW, align: "center" }
      );

    doc.end();
  });
}
