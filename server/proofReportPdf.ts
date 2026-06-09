/**
 * proofReportPdf.ts — Institutional Proof Report PDF Generator (v3)
 *
 * Architecture:
 * - All text is written via doc.text() with explicit width and lineBreak:true so PDFKit
 *   manages cursor advancement automatically.
 * - ensureSpace(minPts) checks remaining page height before each block and adds a page
 *   if insufficient space remains. This prevents any section from starting at the bottom.
 * - tableRow() measures actual wrapped cell heights before drawing, so rows never overlap.
 * - kv() writes label and value as sequential lines, not at the same y-coordinate.
 * - sectionHeader() advances doc.y cleanly without negative offsets.
 * - A "Proof Completeness" panel summarises which data sources were available.
 * - Decision labeling separates: Council Verdict / Governance Compliance / Report Release Status.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProofReportInput {
  reportId: string;
  generatedAt: number;
  sessionId: string;
  dealId?: string | null;
  dealName?: string | null;
  councilMode: string;
  executiveSummary: {
    originalVerdict: string;
    consensusScore: number | null;
    confidenceLevel: number | null;
    cfaFidelityScore: number | null;
    releaseGate: "RELEASED" | "BLOCKED" | "PENDING";
    blockReasons: string[];
    summaryStatement: string;
  };
  voteDistribution: {
    yesCount: number;
    noCount: number;
    totalPersonas: number;
    verdict: string;
    consensusReached: boolean;
    hardFlags: string[];
    silentFails: string[];
  };
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
  constitutionalCompliance: {
    averageFidelityScore: number;
    totalPersonasAudited: number;
    totalChanged: number;
    complianceRate: number;
    status: "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT";
  };
  governanceFindings: Array<{
    findingId: string;
    ruleId: string;
    ruleText: string;
    severity: string;
    status: "violation" | "pass";
    detectedAt: number;
    constitutionVersion: number;
  }>;
  constitutionVersions: Array<{
    version: number;
    activeRules: number;
    description: string;
  }>;
  contradictions: Array<{
    contradictionId: string;
    decisionIdA: string;
    decisionIdB: string;
    ruleId: string;
    description: string;
    detectedAt: number;
  }>;
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
  historicalPrecedents: Array<{
    decisionId: string;
    dealType: string;
    verdict: string;
    outcomeStatus: string;
    decisionDate: number;
    similarity: string;
  }>;
  releaseGate: {
    gate: "RELEASED" | "BLOCKED" | "PENDING";
    blockingRules: string[];
    warningRules: string[];
    councilConsensusPosition: string;
    finalPosition: string;
    rationale: string;
  };
  evidenceChain: Array<{
    stage: string;
    artifactId: string;
    artifactType: string;
    summary: string;
    timestamp: number;
  }>;
  auditReferences: Array<{
    eventType: string;
    module: string;
    timestamp: number;
    summary: string;
  }>;
  traceability: {
    sessionId: string;
    cfaSessionId: string | null;
    outcomeSessionId: string | null;
    constitutionVersion: number;
    reportGeneratedAt: number;
    reportVersion: string;
  };
}

// ── Palette ───────────────────────────────────────────────────────────────────
const BRAND_DARK       = "#0a0f1e";
const BRAND_BLUE       = "#1e6bff";
const BRAND_LIGHT_BLUE = "#4a9eff";
const TEXT_PRIMARY     = "#1a1a2e";
const TEXT_SECONDARY   = "#4a4a6a";
const TEXT_MUTED       = "#888899";
const BORDER_COLOR     = "#d8d8ee";
const SECTION_BG       = "#f7f8ff";
const BLOCKED_RED      = "#dc2626";
const RELEASED_GREEN   = "#16a34a";
const WARN_AMBER       = "#d97706";
const NA_GRAY          = "#9ca3af";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtPct(v: number | null): string {
  if (v == null || isNaN(v as number)) return "—";
  return `${Math.round(v * 100)}%`;
}
function fmtScore(v: number | null, dp = 3): string {
  if (v == null || isNaN(v as number)) return "—";
  return v.toFixed(dp);
}
function verdictColor(v: string): string {
  const u = v.toUpperCase();
  if (u === "APPROVED") return RELEASED_GREEN;
  if (u.includes("CONDITION")) return WARN_AMBER;
  if (u === "REJECTED" || u === "VETOED") return BLOCKED_RED;
  return TEXT_SECONDARY;
}

export async function generateProofReportPdf(input: ProofReportInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      autoFirstPage: true,
      bufferPages: true,
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

    const ML = 50;
    const MR = 50;
    const PAGE_W = doc.page.width - ML - MR;
    const PAGE_H = doc.page.height;
    const FOOTER_H = 40;
    const BOTTOM_LIMIT = PAGE_H - FOOTER_H - 30;

    // Track page numbers for footer rendering.
    // PDFKit draws footers using the buffered page approach:
    // we keep a per-page footer queue and flush them via the pageAdded event.
    let pageNum = 1;
    // Store footer data per page index so we can render them at doc.end time
    const footerQueue: Array<{ pageIndex: number; num: number }> = [];

    // Register footer for the current page (called before addPage)
    function queueFooter() {
      footerQueue.push({ pageIndex: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1, num: pageNum });
    }

    // Flush all queued footers by switching to each buffered page.
    // IMPORTANT: After doc.text() with explicit y, PDFKit sets doc.y = y + textHeight.
    // If that exceeds page height, PDFKit auto-creates a new page.
    // We prevent this by clamping doc.y back to a safe value after each text call.
    function flushFooters() {
      const range = doc.bufferedPageRange();
      const safeY = BOTTOM_LIMIT - 10; // safe cursor position within page bounds
      for (const { pageIndex, num } of footerQueue) {
        const relIndex = pageIndex - range.start;
        if (relIndex < 0 || relIndex >= range.count) continue;
        doc.switchToPage(pageIndex);
        const y = PAGE_H - FOOTER_H;
        doc
          .moveTo(ML, y)
          .lineTo(ML + PAGE_W, y)
          .strokeColor(BORDER_COLOR)
          .lineWidth(0.5)
          .stroke();
        doc
          .fillColor(TEXT_MUTED)
          .fontSize(7)
          .font("Helvetica")
          .text(
            `AgenThink Mesh — Institutional Proof Engine   ·   Report ID: ${input.reportId}   ·   ${fmtDate(input.generatedAt)}   ·   Page ${num}`,
            ML,
            y + 8,
            { width: PAGE_W, align: "center", height: 20, ellipsis: false }
          );
        // Clamp cursor back to prevent PDFKit from auto-creating overflow pages
        doc.y = safeY;
      }
    }

    function drawFooter() {
      // Called at the very end for the last page — just queue it.
      queueFooter();
    }

    function addPage() {
      queueFooter();
      doc.addPage();
      pageNum++;
      doc.y = 50;
    }

    function ensureSpace(needed: number) {
      // Only add a page if we are not already at the top of a fresh page.
      // doc.y < 80 means we just started a new page — adding another would create a blank.
      if (doc.y + needed > BOTTOM_LIMIT && doc.y > 80) {
        addPage();
      }
    }

    function sectionHeader(title: string, sectionNum: number) {
      ensureSpace(60);
      doc.moveDown(0.8);
      const y = doc.y;
      doc.rect(ML, y, 4, 22).fill(BRAND_BLUE);
      doc.fillColor(BRAND_BLUE).fontSize(9).font("Helvetica-Bold")
        .text(`${sectionNum}.`, ML + 10, y + 4, { width: 20 });
      doc.fillColor(TEXT_PRIMARY).fontSize(13).font("Helvetica-Bold")
        .text(title, ML + 32, y + 3, { width: PAGE_W - 32 });
      doc.y = y + 28;
      doc.moveTo(ML, doc.y).lineTo(ML + PAGE_W, doc.y)
        .strokeColor(BRAND_BLUE).lineWidth(1).stroke();
      doc.y += 10;
    }

    function kv(label: string, value: string, opts?: { indent?: number; valueColor?: string }) {
      const indent = opts?.indent ?? 0;
      const x = ML + indent;
      const w = PAGE_W - indent;
      ensureSpace(32);
      doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Bold")
        .text(label.toUpperCase(), x, doc.y, { width: w });
      doc.fillColor(opts?.valueColor ?? TEXT_PRIMARY).fontSize(10).font("Helvetica")
        .text(value || "—", x, doc.y, { width: w });
      doc.moveDown(0.45);
    }

    function tableRow(cells: string[], widths: number[], isHeader = false) {
      const CELL_PAD_X = 5;
      const CELL_PAD_Y = 5;
      const fontSize = isHeader ? 8 : 8.5;
      const font = isHeader ? "Helvetica-Bold" : "Helvetica";

      doc.font(font).fontSize(fontSize);
      const cellHeights = cells.map((cell, i) => {
        const textW = widths[i] - CELL_PAD_X * 2;
        return doc.heightOfString(cell || " ", { width: textW }) + CELL_PAD_Y * 2;
      });
      const rowH = Math.max(22, ...cellHeights);

      ensureSpace(rowH + 4);
      const startY = doc.y;

      if (isHeader) {
        doc.rect(ML, startY, PAGE_W, rowH).fill(BRAND_DARK);
      } else {
        doc.rect(ML, startY, PAGE_W, rowH).fill(SECTION_BG);
        doc.rect(ML, startY, PAGE_W, rowH).strokeColor(BORDER_COLOR).lineWidth(0.3).stroke();
      }

      let x = ML;
      cells.forEach((cell, i) => {
        const color = isHeader ? "#ffffff" : TEXT_PRIMARY;
        doc.fillColor(color).font(font).fontSize(fontSize)
          .text(cell || " ", x + CELL_PAD_X, startY + CELL_PAD_Y, {
            width: widths[i] - CELL_PAD_X * 2,
            lineBreak: true,
          });
        x += widths[i];
      });

      doc.y = startY + rowH + 2;
    }

    function naBlock(message: string) {
      ensureSpace(50);
      doc.rect(ML, doc.y, PAGE_W, 38).fill("#f9fafb").strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
      doc.fillColor(NA_GRAY).fontSize(8.5).font("Helvetica")
        .text(message, ML + 10, doc.y + 10, { width: PAGE_W - 20 });
      doc.y += 48;
    }

    // ── Proof completeness flags ──────────────────────────────────────────────
    const hasCouncil     = input.voteDistribution.totalPersonas > 0;
    const hasCfa         = input.personaConfidence.length > 0;
    const hasOutcome     = !!input.traceability.outcomeSessionId;
    const hasCalib       = input.calibrationContext.personaWeights.length > 0;
    const hasPrecedents  = input.historicalPrecedents.length > 0;
    const hasAuditTrail  = input.auditReferences.length > 0;
    const completeness   = [hasCouncil, hasCfa, hasOutcome, hasCalib, hasPrecedents, hasAuditTrail].filter(Boolean).length;

    const verdictC  = verdictColor(input.executiveSummary.originalVerdict);
    const complianceC = input.constitutionalCompliance.status === "COMPLIANT" ? RELEASED_GREEN
      : input.constitutionalCompliance.status === "PARTIAL" ? WARN_AMBER : BLOCKED_RED;
    const gateC = input.releaseGate.gate === "RELEASED" ? RELEASED_GREEN
      : input.releaseGate.gate === "BLOCKED" ? BLOCKED_RED : WARN_AMBER;

    // ═══════════════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════════════════════════
    doc.rect(0, 0, doc.page.width, 155).fill(BRAND_DARK);

    doc.fillColor("#ffffff").fontSize(19).font("Helvetica-Bold")
      .text("INSTITUTIONAL PROOF REPORT", ML, 36, { width: PAGE_W });
    doc.fillColor(BRAND_LIGHT_BLUE).fontSize(9.5).font("Helvetica")
      .text("AgenThink Mesh — Decision Intelligence Layer", ML, 62, { width: PAGE_W });

    const dealLabel = input.dealName ?? input.sessionId;
    doc.fillColor("#ffffff").fontSize(14).font("Helvetica-Bold")
      .text(dealLabel, ML, 82, { width: PAGE_W });

    doc.fillColor("#aabbcc").fontSize(7.5).font("Helvetica")
      .text(
        `Session: ${input.sessionId}   ·   Mode: ${input.councilMode.toUpperCase()}   ·   Generated: ${fmtDate(input.generatedAt)}`,
        ML, 112, { width: PAGE_W }
      );

    doc.y = 168;

    // ── IC-Grade Three-Card Header ────────────────────────────────────────────
    // Layout: Card 1 (dominant, left 52%) | Card 2 + Card 3 (right 48%, stacked)
    // Card 1 is the investment decision — it must dominate visually.
    const card1W = Math.floor(PAGE_W * 0.52);
    const card23W = PAGE_W - card1W - 10;
    const card1H = 120;
    const card23H = 56;
    const cardY = doc.y;

    // Vote-split label — never use "X% consensus" as primary decision statistic
    const vd = input.voteDistribution;
    const voteSplitLine = vd.totalPersonas > 0
      ? `${vd.noCount} of ${vd.totalPersonas} Personas Opposed Approval`
      : "Vote distribution not available";
    const confidenceLine = input.executiveSummary.confidenceLevel != null
      ? `Confidence: ${fmtPct(input.executiveSummary.confidenceLevel)}`
      : "";

    // CARD 1 — FINAL RECOMMENDATION (dominant, left half)
    doc.rect(ML, cardY, card1W, card1H).fill("#fff8f8").strokeColor(verdictC).lineWidth(3).stroke();
    doc.rect(ML, cardY, card1W, 5).fill(verdictC);  // top accent bar
    doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica-Bold")
      .text("FINAL RECOMMENDATION", ML + 10, cardY + 14, { width: card1W - 20 });
    doc.fillColor(verdictC).fontSize(22).font("Helvetica-Bold")
      .text(input.executiveSummary.originalVerdict.replace(/_/g, " "), ML + 10, cardY + 30, { width: card1W - 20 });
    doc.fillColor(TEXT_SECONDARY).fontSize(8.5).font("Helvetica")
      .text(voteSplitLine, ML + 10, cardY + 72, { width: card1W - 20 });
    if (confidenceLine) {
      doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
        .text(confidenceLine, ML + 10, cardY + 90, { width: card1W - 20 });
    }

    // CARD 2 — GOVERNANCE REVIEW (top-right)
    const card2X = ML + card1W + 10;
    doc.rect(card2X, cardY, card23W, card23H).fill("#f7f8ff").strokeColor(complianceC).lineWidth(1.5).stroke();
    doc.rect(card2X, cardY, card23W, 4).fill(complianceC);  // top accent bar
    doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica-Bold")
      .text("GOVERNANCE REVIEW", card2X + 8, cardY + 12, { width: card23W - 16 });
    doc.fillColor(complianceC).fontSize(10.5).font("Helvetica-Bold")
      .text(
        input.constitutionalCompliance.status === "COMPLIANT" ? "FULL COMPLIANCE"
        : input.constitutionalCompliance.status === "PARTIAL" ? "PARTIAL COMPLIANCE"
        : "NON-COMPLIANT",
        card2X + 8, cardY + 24, { width: card23W - 16 }
      );
    const revisionNote = input.constitutionalCompliance.totalChanged > 0
      ? `   ·   ${input.constitutionalCompliance.totalChanged} Revision${input.constitutionalCompliance.totalChanged > 1 ? "s" : ""} Applied`
      : "";
    // Show CFA fidelity as percentage (e.g. 84.1%) not raw decimal (0.841)
    const cfaFidelityPct = input.constitutionalCompliance.averageFidelityScore != null
      ? `${(input.constitutionalCompliance.averageFidelityScore * 100).toFixed(1)}%`
      : "—";
    doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
      .text(
        `CFA Fidelity: ${cfaFidelityPct}${revisionNote}`,
        card2X + 8, cardY + 40, { width: card23W - 16 }
      );

    // CARD 3 — AUDIT STATUS (bottom-right)
    const card3Y = cardY + card23H + 8;
    doc.rect(card2X, card3Y, card23W, card23H).fill("#f7fff9").strokeColor(gateC).lineWidth(1.5).stroke();
    doc.rect(card2X, card3Y, card23W, 4).fill(gateC);  // top accent bar
    doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica-Bold")
      .text("AUDIT STATUS", card2X + 8, card3Y + 12, { width: card23W - 16 });
    doc.fillColor(gateC).fontSize(10.5).font("Helvetica-Bold")
      .text(input.releaseGate.gate, card2X + 8, card3Y + 24, { width: card23W - 16 });
    doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
      .text(
        input.releaseGate.gate === "RELEASED" ? "Eligible for Institutional Export" : "Export Blocked",
        card2X + 8, card3Y + 40, { width: card23W - 16 }
      );

    // Footnote: clarify RELEASED ≠ APPROVED
    const footnoteY = cardY + card1H + 6;
    doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
      .text(
        "† Audit Status indicates whether this proof record is eligible for export and audit review. It does not indicate investment approval.",
        ML, footnoteY, { width: PAGE_W }
      );

    doc.y = footnoteY + 16;

    // ── Institutional Proof Statement ─────────────────────────────────────────
    ensureSpace(70);
    const ipsY = doc.y;
    doc.rect(ML, ipsY, PAGE_W, 58).fill("#f0f4ff").strokeColor(BRAND_BLUE).lineWidth(0.8).stroke();
    doc.fillColor(BRAND_DARK).fontSize(7.5).font("Helvetica-Bold")
      .text("INSTITUTIONAL PROOF STATEMENT", ML + 12, ipsY + 8, { width: PAGE_W - 24 });
    const personaCount = input.voteDistribution.totalPersonas || 10;
    const constitutionVer = `Constitution v${input.traceability.constitutionVersion}`;
    doc.fillColor(TEXT_SECONDARY).fontSize(8.5).font("Helvetica")
      .text(
        `This recommendation was produced through a ${personaCount}-persona deliberative process, audited against ${constitutionVer}, ` +
        `evaluated using calibration data and historical precedents, and validated through governance controls. ` +
        `The recommendation below represents the final council position after all constitutional review procedures were completed.`,
        ML + 12, ipsY + 22, { width: PAGE_W - 24 }
      );
    doc.y = ipsY + 68;

    // ── Proof Completeness Panel ──────────────────────────────────────────────
    const pcPanelH = 148;
    ensureSpace(pcPanelH + 10);
    const pcY = doc.y;
    doc.rect(ML, pcY, PAGE_W, pcPanelH).fill("#fafbff").strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();

    doc.fillColor(BRAND_DARK).fontSize(9.5).font("Helvetica-Bold")
      .text("PROOF COMPLETENESS", ML + 12, pcY + 12, { width: PAGE_W - 24 });
    doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica")
      .text(`${completeness} of 6 evidence sources available`, ML + 12, pcY + 28, { width: PAGE_W - 24 });

    const pcItems: Array<[string, boolean]> = [
      ["Council session data",   hasCouncil],
      ["CFA audit records",      hasCfa],
      ["Outcome ledger entry",   hasOutcome],
      ["Calibration weights",    hasCalib],
      ["Historical precedents",  hasPrecedents],
      ["Audit trail references", hasAuditTrail],
    ];
    const colW2 = Math.floor(PAGE_W / 2) - 12;
    pcItems.forEach(([label, ok], idx) => {
      const col = idx < 3 ? 0 : 1;
      const row = idx % 3;
      const ix = ML + 12 + col * (colW2 + 24);
      const iy = pcY + 50 + row * 24;
      const icon = ok ? "✓" : "✗";
      const color = ok ? RELEASED_GREEN : BLOCKED_RED;
      doc.fillColor(color).fontSize(8.5).font("Helvetica-Bold")
        .text(`${icon}  ${label}`, ix, iy, { width: colW2 });
    });

    doc.y = pcY + pcPanelH + 14;

    // Summary statement
    ensureSpace(40);
    doc.fillColor(TEXT_SECONDARY).fontSize(9.5).font("Helvetica")
      .text(input.executiveSummary.summaryStatement, ML, doc.y, { width: PAGE_W });
    doc.moveDown(0.8);

    doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica")
      .text(
        `Report ID: ${input.reportId}   ·   Version: ${input.traceability.reportVersion}   ·   Constitution v${input.traceability.constitutionVersion}`,
        ML, doc.y, { width: PAGE_W }
      );
    doc.moveDown(1);

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 1 — Executive Summary
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Executive Summary", 1);
    kv("Final Recommendation", input.executiveSummary.originalVerdict.replace(/_/g, " "), { valueColor: verdictC });
    // Vote split — never use raw consensus percentage as the primary decision statistic
    const execVoteSplit = input.voteDistribution.totalPersonas > 0
      ? `${input.voteDistribution.noCount} of ${input.voteDistribution.totalPersonas} Personas Opposed Approval  (Vote Split: ${input.voteDistribution.yesCount} Approval / ${input.voteDistribution.noCount} Reject)`
      : "Vote distribution not available";
    kv("Vote Outcome", execVoteSplit);
    kv("Confidence Level", fmtPct(input.executiveSummary.confidenceLevel));
    kv("CFA Fidelity Score", fmtScore(input.executiveSummary.cfaFidelityScore));
    kv("Governance Review", input.constitutionalCompliance.status, { valueColor: complianceC });
    kv("Audit Status", `${input.releaseGate.gate} — Eligible for institutional export only`, { valueColor: gateC });
    if (input.executiveSummary.blockReasons.length > 0) {
      kv("Block Reasons", input.executiveSummary.blockReasons.join("; "), { valueColor: BLOCKED_RED });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 2 — Council Vote Distribution
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Council Vote Distribution", 2);
    kv("Recommendation", input.voteDistribution.verdict.replace(/_/g, " "), { valueColor: verdictColor(input.voteDistribution.verdict) });
    // Primary vote statistic: show vote split, not consensus percentage
    const totalP = input.voteDistribution.totalPersonas || 1;
    const negShare = Math.round((input.voteDistribution.noCount / totalP) * 100);
    kv("Vote Split", `${input.voteDistribution.yesCount} Approval  /  ${input.voteDistribution.noCount} Reject  (${input.voteDistribution.totalPersonas} personas total)`);
    kv("Negative Vote Share", `${negShare}% — ${input.voteDistribution.noCount} of ${input.voteDistribution.totalPersonas} personas opposed approval`);
    kv("Consensus Reached", input.voteDistribution.consensusReached ? "Yes" : "No");
    kv("Hard Flags", input.voteDistribution.hardFlags.length > 0 ? input.voteDistribution.hardFlags.join(", ") : "None",
      { valueColor: input.voteDistribution.hardFlags.length > 0 ? BLOCKED_RED : TEXT_PRIMARY });
    if (input.voteDistribution.silentFails.length > 0) {
      kv("Silent Fails", input.voteDistribution.silentFails.join(", "), { valueColor: WARN_AMBER });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 3 — Persona Confidence Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Persona Confidence Analysis", 3);
    if (!hasCfa) {
      naBlock(
        "CFA audit records are not yet available. The Constitutional Fidelity Auditor runs asynchronously after the council vote. " +
        "If you exported immediately after the council completed, please wait 30–60 seconds and re-export."
      );
    } else {
      const pcW = [PAGE_W * 0.24, PAGE_W * 0.11, PAGE_W * 0.11, PAGE_W * 0.11, PAGE_W * 0.11, PAGE_W * 0.11, PAGE_W * 0.21];
      tableRow(["Persona", "Fidelity", "In-Char", "Rule Fid.", "Evidence", "Conf.Cal.", "Revised?"], pcW, true);
      for (const p of input.personaConfidence) {
        tableRow([
          p.personaName || p.personaId,
          fmtScore(p.fidelityScore),
          fmtScore(p.scoreInCharacter),
          fmtScore(p.scoreRuleFidelity),
          fmtScore(p.scoreEvidenceGrounding),
          fmtScore(p.scoreConfidenceCalib),
          p.changed ? "Yes" : "No",
        ], pcW);
      }
      doc.moveDown(0.5);
      const withCritique = input.personaConfidence.filter((p) => p.critique);
      if (withCritique.length > 0) {
        ensureSpace(30);
        doc.fillColor(TEXT_SECONDARY).fontSize(8.5).font("Helvetica-Bold")
          .text("Revision Critiques", ML, doc.y, { width: PAGE_W });
        doc.moveDown(0.3);
        for (const p of withCritique) {
          ensureSpace(30);
          doc.fillColor(TEXT_MUTED).fontSize(7.5).font("Helvetica-Bold")
            .text((p.personaName || p.personaId).toUpperCase(), ML + 8, doc.y, { width: PAGE_W - 8 });
          doc.fillColor(TEXT_SECONDARY).fontSize(8.5).font("Helvetica")
            .text(p.critique!, ML + 8, doc.y, { width: PAGE_W - 8 });
          doc.moveDown(0.3);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 4 — Constitutional Compliance Review
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Constitutional Compliance Review", 4);
    kv("Compliance Status", input.constitutionalCompliance.status, { valueColor: complianceC });
    kv("Average Fidelity Score", fmtScore(input.constitutionalCompliance.averageFidelityScore));
    kv("Compliance Rate", fmtPct(input.constitutionalCompliance.complianceRate));
    kv("Personas Audited", String(input.constitutionalCompliance.totalPersonasAudited));
    kv("Personas Revised by CFA", String(input.constitutionalCompliance.totalChanged));

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 5 — Governance Findings
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Governance Findings", 5);
    if (input.governanceFindings.length === 0) {
      naBlock(
        "No governance rule violations detected. All council personas operated within their constitutional mandates. " +
        "If CFA audit records are unavailable (see Section 3), governance findings cannot be derived until the CFA run completes."
      );
    } else {
      const gfW = [PAGE_W * 0.14, PAGE_W * 0.12, PAGE_W * 0.10, PAGE_W * 0.09, PAGE_W * 0.55];
      tableRow(["Finding ID", "Rule ID", "Status", "Severity", "Rule Text"], gfW, true);
      for (const f of input.governanceFindings) {
        tableRow([
          f.findingId.slice(0, 14),
          f.ruleId,
          f.status.toUpperCase(),
          f.severity.toUpperCase(),
          f.ruleText,
        ], gfW);
      }
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 6 — Constitution Version References
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Constitution Version References", 6);
    if (input.constitutionVersions.length === 0) {
      naBlock("Constitution version data not available.");
    } else {
      const cvW = [PAGE_W * 0.15, PAGE_W * 0.18, PAGE_W * 0.67];
      tableRow(["Version", "Active Rules", "Description"], cvW, true);
      for (const cv of input.constitutionVersions) {
        tableRow([`v${cv.version}`, String(cv.activeRules), cv.description], cvW);
      }
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 7 — Contradiction Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Contradiction Analysis", 7);
    if (input.contradictions.length === 0) {
      naBlock(
        "No inter-decision contradictions detected. This module requires at least two completed decisions " +
        "in the same council mode to produce findings."
      );
    } else {
      const cdW = [PAGE_W * 0.18, PAGE_W * 0.18, PAGE_W * 0.16, PAGE_W * 0.48];
      tableRow(["Contradiction ID", "Decision A", "Decision B", "Description"], cdW, true);
      for (const c of input.contradictions) {
        tableRow([
          c.contradictionId.slice(0, 16),
          c.decisionIdA.slice(0, 16),
          c.decisionIdB.slice(0, 16),
          c.description,
        ], cdW);
      }
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 8 — Calibration Context
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Calibration Context", 8);
    kv("Apply Weights to Consensus", input.calibrationContext.applyWeightsEnabled ? "ENABLED" : "DISABLED (safety gate active)");
    kv("Minimum Samples for Trust", String(input.calibrationContext.minSamplesForTrust));
    doc.moveDown(0.3);

    if (!hasCalib) {
      naBlock(
        "Calibration weight data is not yet available. Persona weights require a minimum of " +
        `${input.calibrationContext.minSamplesForTrust} completed sessions per persona. ` +
        "This is an early session for this council mode."
      );
    } else {
      const pwW = [PAGE_W * 0.30, PAGE_W * 0.14, PAGE_W * 0.14, PAGE_W * 0.18, PAGE_W * 0.24];
      tableRow(["Persona", "Weight", "Brier Score", "Sample Size", "Trusted"], pwW, true);
      for (const pw of input.calibrationContext.personaWeights) {
        tableRow([
          pw.personaId,
          fmtScore(pw.weight, 4),
          fmtScore(pw.brierScore, 4),
          String(pw.sampleSize),
          pw.trusted ? "Yes" : `No (< ${input.calibrationContext.minSamplesForTrust} samples)`,
        ], pwW);
      }
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 9 — Historical Precedents
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Historical Precedents", 9);
    if (!hasPrecedents) {
      naBlock(
        "No comparable historical decisions found. Historical precedents are drawn from the Outcome Ledger " +
        "for the same council mode. This section will populate once prior decisions have been recorded with confirmed outcomes."
      );
    } else {
      const hpW = [PAGE_W * 0.22, PAGE_W * 0.16, PAGE_W * 0.16, PAGE_W * 0.16, PAGE_W * 0.30];
      tableRow(["Decision ID", "Deal Type", "Verdict", "Outcome", "Date"], hpW, true);
      for (const h of input.historicalPrecedents) {
        tableRow([
          h.decisionId.slice(0, 18),
          h.dealType,
          h.verdict.replace(/_/g, " "),
          h.outcomeStatus,
          fmtDate(h.decisionDate),
        ], hpW);
      }
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 10 — Release Gate Determination
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Release Gate Determination", 10);
    const rg = input.releaseGate;
    kv("Gate Decision (Report Export Eligibility)", rg.gate, { valueColor: gateC });
    kv("Council Consensus Position", rg.councilConsensusPosition.replace(/_/g, " "));
    kv("Final Governance Position", rg.finalPosition.replace(/_/g, " "));
    kv("Rationale", rg.rationale);
    kv("Blocking Rules", rg.blockingRules.length > 0 ? rg.blockingRules.join("; ") : "None",
      { valueColor: rg.blockingRules.length > 0 ? BLOCKED_RED : TEXT_PRIMARY });
    if (rg.warningRules.length > 0) {
      kv("Warning Rules", rg.warningRules.join("; "), { valueColor: WARN_AMBER });
    }

    ensureSpace(40);
    doc.rect(ML, doc.y, PAGE_W, 32).fill("#fffbeb").strokeColor(WARN_AMBER).lineWidth(0.5).stroke();
    doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica")
      .text(
        "Note: \"Report Release Status\" refers to whether this governance proof record is eligible for export. " +
        "It does not indicate investment approval. The Council Verdict above is the authoritative decision.",
        ML + 10, doc.y + 8, { width: PAGE_W - 20 }
      );
    doc.y += 42;

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 11 — Evidence Chain
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Evidence Chain", 11);
    if (input.evidenceChain.length === 0) {
      naBlock("No evidence chain artifacts recorded for this session.");
    } else {
      const ecW = [PAGE_W * 0.16, PAGE_W * 0.18, PAGE_W * 0.16, PAGE_W * 0.36, PAGE_W * 0.14];
      tableRow(["Stage", "Artifact ID", "Type", "Summary", "Date"], ecW, true);
      for (const e of input.evidenceChain) {
        tableRow([
          e.stage,
          e.artifactId.slice(0, 16),
          e.artifactType,
          e.summary.slice(0, 60),
          fmtDate(e.timestamp),
        ], ecW);
      }
      doc.moveDown(0.5);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 12 — Audit References
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Audit References", 12);
    if (!hasAuditTrail) {
      naBlock("No audit log entries found for this session.");
    } else {
      const arW = [PAGE_W * 0.22, PAGE_W * 0.14, PAGE_W * 0.14, PAGE_W * 0.50];
      tableRow(["Event Type", "Module", "Date", "Summary"], arW, true);
      for (const a of input.auditReferences.slice(0, 30)) {
        tableRow([
          a.eventType,
          a.module,
          fmtDate(a.timestamp),
          a.summary.slice(0, 80),
        ], arW);
      }
      if (input.auditReferences.length > 30) {
        ensureSpace(20);
        doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
          .text(
            `... and ${input.auditReferences.length - 30} additional audit entries (see JSON export for full log).`,
            ML, doc.y, { width: PAGE_W }
          );
        doc.moveDown(0.3);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 13 — Traceability Appendix
    // ═══════════════════════════════════════════════════════════════════════════
    sectionHeader("Traceability Appendix", 13);
    const tr = input.traceability;
    kv("Session ID", tr.sessionId);
    kv("CFA Session ID", tr.cfaSessionId ?? "Not yet available — CFA runs asynchronously after council");
    kv("Outcome Session ID", tr.outcomeSessionId ?? "Not yet recorded — outcome is logged post-decision");
    kv("Constitution Version", `v${tr.constitutionVersion}`);
    kv("Report Generated At", fmtDate(tr.reportGeneratedAt));
    kv("Report Version", tr.reportVersion);
    doc.moveDown(1);

    drawFooter();
    flushFooters();
    doc.end();
  });
}
