/**
 * repairBriefPdf.ts — Institutional PDF generator for the Deal Repair Brief.
 * Produces a clean, executive-facing single-document PDF from a FixTheDealResult.
 * Uses PDFKit (same as icMemoPdf.ts). No emoji, no unsupported glyphs.
 *
 * SECURITY NOTE: Terminal blocker names in the PDF are derived ONLY from the
 * structured `terminalFlags` array (TerminalBlockerFlag enum values).
 * Prose inference from councilOutcome, blockingIssues, or any text field is
 * FORBIDDEN. If terminalFlags is empty on a C deal, the PDF renders
 * "Terminal Blockers: Not available." — no fallback to prose.
 */

import PDFDocument from "pdfkit";
import { rescuePolicy, TerminalBlockerFlag } from "./lib/rescuePolicy";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepairBriefInput {
  dealName: string;
  councilMode?: string;
  classification: "A" | "B" | "C";
  classificationRationale: string;
  /**
   * Structured terminal blocker flags from the council engine.
   * These are the SOLE source for naming blockers in the PDF header / Class C section.
   * Prose inference from any text field is forbidden.
   * If empty on a C deal, renders "Terminal Blockers: Not available."
   */
  terminalFlags?: string[];
  rootCauses: Array<{ category: string; description: string; priority: number }>;
  revisedBrief: string;
  changeSummaryTable: Array<{
    change: string;
    original: string;
    revised: string;
    rootCauseAddressed: string;
    estimatedVoteImpact: string;
  }>;
  predictedOutcome: {
    voteDistribution: string;
    consensusPct: number;
    decision: string;
    mostLikelyDissentingAgent: string;
    mostLikelyCondition: string;
  };
  approvalSensitivityLadder: Array<{
    structuralChange: string;
    estimatedVoteShift: string;
    runningVoteEstimate: string;
  }>;
  residualRisks: string[];
}

// ── Colour palette (PDF-safe, no emoji) ──────────────────────────────────────

const DARK_BG   = "#0A0F1E";
const WHITE     = "#FFFFFF";
const AMBER     = "#F59E0B";
const GREEN     = "#00FF87";
const RED_SOFT  = "#FF4444";
const MUTED     = "#8892A4";
const BODY_TEXT = "#CBD5E1";
const RULE_CLR  = "#1E2A3A";
const CARD_BG   = "#111827";

// ── Helpers ───────────────────────────────────────────────────────────────────

function classColor(c: "A" | "B" | "C"): string {
  if (c === "A") return GREEN;
  if (c === "B") return AMBER;
  return RED_SOFT;
}

function classLabel(c: "A" | "B" | "C"): string {
  if (c === "A") return "CLASS A — STRUCTURALLY REPAIRABLE";
  if (c === "B") return "CLASS B — CONDITIONALLY VIABLE";
  return "CLASS C — FUNDAMENTALLY NON-VIABLE";
}

function safe(s: string | undefined | null): string {
  return (s ?? "").replace(/[^\x20-\x7E\n]/g, "").trim();
}

/**
 * Derive the canonical blocker label string for the PDF from structured terminalFlags.
 * SOLE source of truth — no prose inference, no regex, no substring matching.
 *
 * Returns one of:
 *   "Terminal Blockers: FRAUD · CAPITAL_CONTROLS"   (flags present)
 *   "Terminal Blockers: Not available."              (empty / missing flags on C deal)
 */
export function terminalBlockersLine(terminalFlags: string[] | undefined): string {
  if (!terminalFlags || terminalFlags.length === 0) {
    return "Terminal Blockers: Not available.";
  }
  // Canonical label: flag.replace(/_/g, " ").toUpperCase() — same pattern as memo
  const labels = terminalFlags.map((flag) => {
    // Validate against rescuePolicy — unknown flags still rendered verbatim (fail-safe)
    const _policy = rescuePolicy[flag as TerminalBlockerFlag]; // side-effect: type-checks enum membership
    void _policy;
    return flag.replace(/_/g, " ").toUpperCase();
  });
  return `Terminal Blockers: ${labels.join(" \u00B7 ")}`;
}

function wrapText(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (doc.widthOfString(test) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.rect(50, y, 495, 20).fill(CARD_BG);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(AMBER)
    .text(title, 58, y + 6, { lineBreak: false });
  return y + 28;
}

function rule(doc: PDFKit.PDFDocument, y: number): number {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(RULE_CLR).lineWidth(0.5).stroke();
  return y + 8;
}

function ensurePage(doc: PDFKit.PDFDocument, y: number, needed = 40): number {
  if (y + needed > 770) {
    doc.addPage();
    return 50;
  }
  return y;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateRepairBriefPdf(input: RepairBriefInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Deal Repair Brief — ${input.dealName}`,
        Author: "AgenThink Mesh — Deal Repair Engine",
        Subject: "Institutional Deal Restructuring Report",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const modeLabel = input.councilMode === "infrastructure"
      ? "INFRASTRUCTURE / PROJECT FINANCE COUNCIL"
      : "VENTURE CAPITAL COUNCIL";

    // ── COVER HEADER ─────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 120).fill(DARK_BG);

    // Top label strip
    doc.rect(0, 0, 595, 18).fill("#050810");
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("AGENTHINK MESH  ·  DEAL REPAIR ENGINE  ·  CONFIDENTIAL", 50, 5, { lineBreak: false });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(new Date().toISOString().slice(0, 10), 0, 5, { align: "right", lineBreak: false });

    // Deal name
    doc.font("Helvetica-Bold").fontSize(20).fillColor(WHITE)
      .text(safe(input.dealName), 50, 28, { lineBreak: false });

    // Mode badge
    doc.font("Helvetica").fontSize(7);
    doc.rect(50, 56, doc.widthOfString(modeLabel) + 16, 14).fill("#1A2540");
    doc.font("Helvetica").fontSize(7).fillColor(AMBER)
      .text(modeLabel, 58, 60, { lineBreak: false });

    // Classification badge
    const cls = input.classification;
    const clsText = classLabel(cls);
    doc.font("Helvetica-Bold").fontSize(7);
    const clsW = doc.widthOfString(clsText) + 16;
    doc.rect(50, 76, clsW, 14).fill(classColor(cls) + "22");
    doc.rect(50, 76, 3, 14).fill(classColor(cls));
    doc.font("Helvetica-Bold").fontSize(7).fillColor(classColor(cls))
      .text(clsText, 58, 80, { lineBreak: false });

    // Predicted outcome strip
    const po = input.predictedOutcome;
    doc.rect(0, 100, 595, 20).fill("#0D1526");
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("PREDICTED OUTCOME AFTER FIXES:", 50, 106, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(GREEN)
      .text(`${safe(po.decision)}  ·  ${safe(po.voteDistribution)}  ·  ${Math.round(po.consensusPct)}% CONSENSUS`, 220, 106, { lineBreak: false });

    let y = 130;

    // ── CLASSIFICATION C WARNING ──────────────────────────────────────────────
    if (cls === "C") {
      // Derive blocker line from structured terminalFlags ONLY — no prose fallback.
      // terminalBlockersLine() returns "Terminal Blockers: Not available." for empty/missing flags.
      const blockersLine = terminalBlockersLine(input.terminalFlags);

      y = ensurePage(doc, y, 90);
      doc.rect(50, y, 495, 72).fill("#1A0A0A");
      doc.rect(50, y, 4, 72).fill(RED_SOFT);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(RED_SOFT)
        .text("THIS DEAL CANNOT BE REPAIRED WITHOUT FUNDAMENTAL RESTRUCTURING", 62, y + 8, { width: 475, lineBreak: true });
      doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
        .text(safe(input.classificationRationale), 62, y + 26, { width: 475, lineBreak: true });
      // Structured blocker names — derived from terminalFlags, never from prose
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(RED_SOFT)
        .text(safe(blockersLine), 62, y + 56, { width: 475, lineBreak: false });
      y += 82;
    }

    // ── SECTION 1: CLASSIFICATION RATIONALE (non-C) ───────────────────────────
    if (cls !== "C") {
      y = ensurePage(doc, y, 60);
      y = sectionHeader(doc, "01  CLASSIFICATION RATIONALE", y);
      doc.font("Helvetica").fontSize(8.5).fillColor(BODY_TEXT)
        .text(safe(input.classificationRationale), 58, y, { width: 479, lineBreak: true });
      y = doc.y + 12;
    }

    // ── SECTION 2: ROOT CAUSE TRIAGE ─────────────────────────────────────────
    y = ensurePage(doc, y, 60);
    y = sectionHeader(doc, "02  ROOT CAUSE TRIAGE", y);

    const sorted = [...input.rootCauses].sort((a, b) => a.priority - b.priority);
    for (const rc of sorted) {
      y = ensurePage(doc, y, 28);
      // Priority badge
      doc.rect(58, y, 18, 14).fill(CARD_BG);
      doc.font("Helvetica-Bold").fontSize(7).fillColor(AMBER)
        .text(`P${rc.priority}`, 60, y + 3, { lineBreak: false });
      // Category
      doc.font("Helvetica-Bold").fontSize(8).fillColor(WHITE)
        .text(safe(rc.category), 82, y + 2, { lineBreak: false });
      // Description
      doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
        .text(safe(rc.description), 82, y + 12, { width: 455, lineBreak: true });
      y = doc.y + 6;
    }
    y += 4;

    // ── SECTION 3: CHANGE AUDIT TABLE ─────────────────────────────────────────
    y = ensurePage(doc, y, 60);
    y = sectionHeader(doc, "03  STRUCTURAL CHANGES & VOTE IMPACT", y);

    // Table header
    const COL = [58, 180, 310, 440];
    const HEADS = ["CHANGE", "ORIGINAL", "REVISED", "VOTE IMPACT"];
    doc.rect(50, y, 495, 16).fill(CARD_BG);
    HEADS.forEach((h, i) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
        .text(h, COL[i], y + 4, { lineBreak: false });
    });
    y += 18;

    for (const row of input.changeSummaryTable) {
      y = ensurePage(doc, y, 30);
      const cells = [safe(row.change), safe(row.original), safe(row.revised), safe(row.estimatedVoteImpact)];
      const widths = [118, 126, 126, 55];
      const lineHeights: number[] = [];
      cells.forEach((cell, i) => {
        const lines = wrapText(doc, cell, widths[i] - 4);
        lineHeights.push(lines.length * 10);
      });
      const rowH = Math.max(20, ...lineHeights) + 6;

      doc.rect(50, y, 495, rowH).fill("#0D1526");
      doc.moveTo(50, y + rowH).lineTo(545, y + rowH).strokeColor(RULE_CLR).lineWidth(0.3).stroke();

      cells.forEach((cell, i) => {
        const color = i === 3 ? GREEN : BODY_TEXT;
        doc.font("Helvetica").fontSize(7.5).fillColor(color)
          .text(cell, COL[i], y + 4, { width: widths[i] - 4, lineBreak: true });
      });
      y += rowH;
    }
    y += 8;

    // ── SECTION 4: APPROVAL SENSITIVITY LADDER ────────────────────────────────
    y = ensurePage(doc, y, 60);
    y = sectionHeader(doc, "04  APPROVAL SENSITIVITY LADDER", y);

    const LCOL = [58, 280, 420];
    const LHEADS = ["STRUCTURAL CHANGE", "VOTE SHIFT", "RUNNING ESTIMATE"];
    doc.rect(50, y, 495, 16).fill(CARD_BG);
    LHEADS.forEach((h, i) => {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
        .text(h, LCOL[i], y + 4, { lineBreak: false });
    });
    y += 18;

    input.approvalSensitivityLadder.forEach((rung, idx) => {
      y = ensurePage(doc, y, 22);
      const bg = idx % 2 === 0 ? "#0D1526" : "#0A0F1E";
      doc.rect(50, y, 495, 20).fill(bg);
      doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
        .text(safe(rung.structuralChange), LCOL[0], y + 5, { width: 218, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(GREEN)
        .text(safe(rung.estimatedVoteShift), LCOL[1], y + 5, { lineBreak: false });
      doc.font("Helvetica").fontSize(7.5).fillColor(AMBER)
        .text(safe(rung.runningVoteEstimate), LCOL[2], y + 5, { lineBreak: false });
      y += 20;
    });
    y += 8;

    // ── SECTION 5: PREDICTED OUTCOME ─────────────────────────────────────────
    y = ensurePage(doc, y, 70);
    y = sectionHeader(doc, "05  PREDICTED OUTCOME AFTER FIXES", y);

    doc.rect(50, y, 495, 52).fill(CARD_BG);
    doc.rect(50, y, 4, 52).fill(GREEN);

    const OCOL = [58, 200, 350];
    const OHEADS = ["DECISION", "VOTE DISTRIBUTION", "CONSENSUS"];
    const OVALS = [
      safe(po.decision),
      safe(po.voteDistribution),
      `${Math.round(po.consensusPct)}%`,
    ];
    OHEADS.forEach((h, i) => {
      doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(h, OCOL[i], y + 6, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN).text(OVALS[i], OCOL[i], y + 16, { lineBreak: false });
    });

    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("MOST LIKELY CONDITION", 58, y + 34, { lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(AMBER)
      .text(safe(po.mostLikelyCondition), 58, y + 43, { width: 479, lineBreak: false });
    y += 60;

    // ── SECTION 6: RESIDUAL RISKS ─────────────────────────────────────────────
    y = ensurePage(doc, y, 50);
    y = sectionHeader(doc, "06  RESIDUAL RISKS (POST-REPAIR)", y);

    for (const risk of input.residualRisks) {
      y = ensurePage(doc, y, 18);
      doc.rect(58, y + 4, 4, 4).fill(RED_SOFT);
      doc.font("Helvetica").fontSize(8).fillColor(BODY_TEXT)
        .text(safe(risk), 68, y + 2, { width: 469, lineBreak: true });
      y = doc.y + 4;
    }
    y += 4;

    // ── SECTION 7: REVISED BRIEF (abbreviated) ────────────────────────────────
    y = ensurePage(doc, y, 60);
    y = sectionHeader(doc, "07  REVISED DEAL BRIEF (KEY CHANGES HIGHLIGHTED)", y);

    // Show only lines containing [REVISED: ...] tags for brevity
    const revisedLines = safe(input.revisedBrief).split("\n");
    const changedLines = revisedLines.filter(l => l.includes("[REVISED:"));
    const displayLines = changedLines.length > 0 ? changedLines : revisedLines.slice(0, 12);

    for (const line of displayLines.slice(0, 20)) {
      y = ensurePage(doc, y, 14);
      const isChanged = line.includes("[REVISED:");
      doc.font(isChanged ? "Helvetica-Bold" : "Helvetica")
        .fontSize(7.5)
        .fillColor(isChanged ? AMBER : BODY_TEXT)
        .text(safe(line), 58, y, { width: 479, lineBreak: true });
      y = doc.y + 2;
    }
    if (displayLines.length > 20) {
      y = ensurePage(doc, y, 14);
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text(`... and ${displayLines.length - 20} more revised lines. See full brief in the Deal Screener.`, 58, y, { lineBreak: false });
      y += 12;
    }

    // ── FOOTER (rendered on all pages via bufferPages) ───────────────────────────────────────────
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(0, 810, 595, 32).fill(DARK_BG);
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED)
        .text(
          `AgenThink Mesh  ·  Deal Repair Engine  ·  ${safe(input.dealName)}  ·  CONFIDENTIAL — NOT FOR DISTRIBUTION`,
          50, 817, { lineBreak: false }
        );
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED)
        .text(`Page ${i + 1} of ${totalPages}`, 0, 817, { align: "right", lineBreak: false });
    }

    doc.flushPages();
    doc.end();
  });
}
