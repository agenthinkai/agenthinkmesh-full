/**
 * recoveryMemoPdf.ts — Institutional PDF generator for the Deal Recovery Memo.
 *
 * Produces a dark-themed, executive-facing PDF from a RecoveryEngineResult.
 * Uses PDFKit (same as repairBriefPdf.ts / icMemoPdf.ts).
 * No emoji, no unsupported glyphs.
 *
 * Sections:
 *   COVER      — Deal name, verdict, classification, date
 *   01         — Failure Analysis
 *   02         — Terminal Blockers
 *   03         — Recovery Path A
 *   04         — Recovery Path B
 *   05         — Recovery Path C
 *   06         — Re-entry Conditions
 *   07         — Probability of Recovery
 *   08         — Required Structural Changes
 *   09         — Conditions for Reconsideration
 *   FOOTER     — Governance disclaimer on every page
 */

import PDFDocument from "pdfkit";
import type { RecoveryEngineResult, RecoveryPath } from "./recoveryEngine";

// ── Palette (matches repairBriefPdf.ts) ──────────────────────────────────────
const DARK_BG    = "#060C1A";
const CARD_BG    = "#0D1526";
const ACCENT_BG  = "#0A1020";
const WHITE      = "#FFFFFF";
const BODY_TEXT  = "#C8D4E8";
const MUTED      = "#5A6A82";
const BORDER     = "#1E2D44";
const RED        = "#FF4757";
const AMBER      = "#FFB347";
const GREEN      = "#00D4AA";
const BLUE       = "#4A9EFF";
const PURPLE     = "#9B59B6";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function ensurePage(doc: InstanceType<typeof PDFDocument>, y: number, needed: number): number {
  if (y + needed > 790) {
    doc.addPage();
    doc.rect(0, 0, 595, 842).fill(DARK_BG);
    return 50;
  }
  return y;
}

function sectionHeader(doc: InstanceType<typeof PDFDocument>, title: string, y: number): number {
  y = ensurePage(doc, y, 28);
  doc.rect(50, y, 495, 22).fill(CARD_BG);
  doc.rect(50, y, 3, 22).fill(BLUE);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
    .text(title, 60, y + 7, { lineBreak: false });
  return y + 30;
}

function subHeader(doc: InstanceType<typeof PDFDocument>, title: string, y: number, color: string = MUTED): number {
  y = ensurePage(doc, y, 16);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(color)
    .text(title, 58, y, { lineBreak: false, characterSpacing: 0.8 });
  return y + 14;
}

function bodyText(doc: InstanceType<typeof PDFDocument>, text: string, y: number, indent: number = 58): number {
  y = ensurePage(doc, y, 14);
  doc.font("Helvetica").fontSize(8.5).fillColor(BODY_TEXT)
    .text(safe(text), indent, y, { width: 495 - (indent - 50), lineBreak: true });
  return doc.y + 6;
}

function citationRow(doc: InstanceType<typeof PDFDocument>, label: string, value: string, y: number): number {
  y = ensurePage(doc, y, 14);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
    .text(label.toUpperCase(), 62, y, { lineBreak: false, width: 100 });
  doc.font("Helvetica").fontSize(7.5).fillColor(AMBER)
    .text(safe(value), 168, y, { width: 370, lineBreak: true });
  return doc.y + 3;
}

function probabilityBar(doc: InstanceType<typeof PDFDocument>, pct: number, y: number, color: string = GREEN): number {
  y = ensurePage(doc, y, 18);
  const barW = 300;
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * barW);
  doc.rect(62, y + 4, barW, 8).fill(BORDER);
  if (filled > 0) doc.rect(62, y + 4, filled, 8).fill(color);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(color)
    .text(`${pct}%`, 370, y + 2, { lineBreak: false });
  return y + 18;
}

function recoveryPathBlock(
  doc: InstanceType<typeof PDFDocument>,
  path: RecoveryPath,
  y: number,
  accentColor: string,
): number {
  y = ensurePage(doc, y, 30);
  // Path header card
  doc.rect(50, y, 495, 26).fill(CARD_BG);
  doc.rect(50, y, 4, 26).fill(accentColor);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(accentColor)
    .text(`PATH ${path.label}`, 62, y + 4, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE)
    .text(safe(path.title), 110, y + 6, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
    .text(safe(path.estimatedTimeline), 420, y + 8, { lineBreak: false });
  y += 32;

  // Description
  y = bodyText(doc, path.description, y);

  // Probability bar
  y = ensurePage(doc, y, 22);
  doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text("PROBABILITY OF RECONSIDERATION", 62, y, { lineBreak: false });
  y += 10;
  const barColor = path.probabilityPct >= 40 ? GREEN : path.probabilityPct >= 20 ? AMBER : RED;
  y = probabilityBar(doc, path.probabilityPct, y, barColor);

  // Citation chain
  y = citationRow(doc, "Governing Blocker", path.governingBlocker, y);
  y = citationRow(doc, "Council Concern", path.councilConcern, y);
  y = citationRow(doc, "Constitutional Finding", path.constitutionalFinding, y);

  // Milestones
  if (path.milestones && path.milestones.length > 0) {
    y = ensurePage(doc, y, 14);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text("MILESTONES", 62, y, { lineBreak: false, characterSpacing: 0.8 });
    y += 10;
    path.milestones.forEach((m, i) => {
      y = ensurePage(doc, y, 13);
      doc.rect(62, y + 4, 4, 4).fill(accentColor);
      doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
        .text(`${i + 1}. ${safe(m)}`, 72, y + 2, { width: 465, lineBreak: true });
      y = doc.y + 2;
    });
  }
  return y + 8;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface RecoveryMemoPdfInput {
  dealName: string;
  verdict: string;
  councilMode?: string;
  terminalFlags: string[];
  result: RecoveryEngineResult;
}

export async function generateRecoveryMemoPdf(input: RecoveryMemoPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      info: {
        Title: `Deal Recovery Memo — ${input.dealName}`,
        Author: "AgenThink Mesh Recovery Engine",
        Subject: "Institutional Deal Recovery Analysis",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const r = input.result;
    const modeLabel = input.councilMode === "infrastructure"
      ? "Infrastructure / Project Finance"
      : "Venture Capital";
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

    // ── COVER PAGE ────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 842).fill(DARK_BG);

    // Top accent bar
    doc.rect(0, 0, 595, 6).fill(RED);

    // Logo area
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED)
      .text("AGENTHINK MESH", 50, 30, { lineBreak: false, characterSpacing: 2 });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("DEAL RECOVERY ENGINE  ·  INSTITUTIONAL ANALYSIS", 50, 42, { lineBreak: false });

    // Title block
    doc.rect(50, 90, 495, 4).fill(RED);
    doc.font("Helvetica-Bold").fontSize(22).fillColor(WHITE)
      .text("DEAL RECOVERY MEMO", 50, 106, { lineBreak: false });
    doc.font("Helvetica").fontSize(11).fillColor(`${RED}cc`)
      .text("GOVERNANCE-GOVERNED RECOVERY ANALYSIS", 50, 134, { lineBreak: false });
    doc.rect(50, 150, 495, 1).fill(BORDER);

    // Deal info card
    doc.rect(50, 162, 495, 80).fill(CARD_BG);
    doc.rect(50, 162, 4, 80).fill(RED);

    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("DEAL NAME", 62, 170, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE)
      .text(safe(input.dealName), 62, 180, { width: 460, lineBreak: false });

    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("VERDICT", 62, 204, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(RED)
      .text(safe(input.verdict), 62, 214, { lineBreak: false });

    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("COUNCIL MODE", 200, 204, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor(BODY_TEXT)
      .text(modeLabel, 200, 214, { lineBreak: false });

    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("DATE", 400, 204, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor(BODY_TEXT)
      .text(dateStr, 400, 214, { lineBreak: false });

    // Governance disclaimer
    doc.rect(50, 260, 495, 50).fill(ACCENT_BG);
    doc.rect(50, 260, 4, 50).fill(AMBER);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(AMBER)
      .text("GOVERNANCE INVARIANT", 62, 268, { lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
      .text(
        "This memo does not override, soften, or contradict the Council's rejection verdict. " +
        "It answers only: \"What would need to change for this deal to be reconsidered?\" " +
        "All recommendations cite the governing blocker, council concern, and constitutional finding.",
        62, 280, { width: 475, lineBreak: true }
      );

    // Recovery probability overview
    const overallPct = r.overallProbabilityOfRecovery?.pct ?? 0;
    const overallColor = overallPct >= 40 ? GREEN : overallPct >= 20 ? AMBER : RED;
    doc.rect(50, 330, 495, 60).fill(CARD_BG);
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("OVERALL PROBABILITY OF RECOVERY", 62, 340, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(28).fillColor(overallColor)
      .text(`${overallPct}%`, 62, 350, { lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
      .text(safe(r.overallProbabilityOfRecovery?.rationale), 160, 355, { width: 375, lineBreak: true });

    // Suggested next review
    doc.rect(50, 410, 495, 30).fill(CARD_BG);
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("SUGGESTED NEXT REVIEW DATE", 62, 418, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BLUE)
      .text(safe(r.suggestedNextReviewDate), 62, 428, { lineBreak: false });

    // Terminal flags
    if (input.terminalFlags.length > 0) {
      let fx = 50;
      let fy = 460;
      doc.font("Helvetica").fontSize(7).fillColor(MUTED)
        .text("TERMINAL BLOCKERS", 50, fy, { lineBreak: false });
      fy += 12;
      input.terminalFlags.forEach((flag) => {
        const label = flag.replace(/_/g, " ").toUpperCase();
        const w = label.length * 5.5 + 16;
        if (fx + w > 540) { fx = 50; fy += 18; }
        doc.rect(fx, fy, w, 14).fill(`${RED}18`);
        doc.rect(fx, fy, w, 14).stroke(RED);
        doc.font("Helvetica-Bold").fontSize(7).fillColor(RED)
          .text(label, fx + 6, fy + 4, { lineBreak: false });
        fx += w + 6;
      });
    }

    // ── PAGE 2+ ───────────────────────────────────────────────────────────────
    doc.addPage();
    doc.rect(0, 0, 595, 842).fill(DARK_BG);
    let y = 50;

    // ── SECTION 01: FAILURE ANALYSIS ─────────────────────────────────────────
    y = sectionHeader(doc, "01  FAILURE ANALYSIS", y);
    y = subHeader(doc, "PRIMARY FAILURE MODE", y, RED);
    y = bodyText(doc, r.failureAnalysis?.primaryFailureMode, y);
    y += 4;

    if (r.failureAnalysis?.rootCauses?.length > 0) {
      y = subHeader(doc, "ROOT CAUSES", y);
      r.failureAnalysis.rootCauses.forEach((rc, i) => {
        y = ensurePage(doc, y, 60);
        doc.rect(58, y, 479, 1).fill(BORDER);
        y += 5;
        doc.font("Helvetica-Bold").fontSize(8).fillColor(AMBER)
          .text(`[${safe(rc.category)}]`, 62, y, { lineBreak: false });
        doc.font("Helvetica").fontSize(8.5).fillColor(BODY_TEXT)
          .text(safe(rc.description), 100, y, { width: 437, lineBreak: true });
        y = doc.y + 3;
        y = citationRow(doc, "Governing Blocker", rc.governingBlocker, y);
        y = citationRow(doc, "Council Concern", rc.councilConcern, y);
        y = citationRow(doc, "Constitutional Finding", rc.constitutionalFinding, y);
        y += 4;
        void i;
      });
    }

    y += 4;
    y = subHeader(doc, "WHY REPAIR IS INSUFFICIENT", y, RED);
    y = bodyText(doc, r.failureAnalysis?.whyRepairIsInsufficient, y);
    y += 8;

    // ── SECTION 02: TERMINAL BLOCKERS ─────────────────────────────────────────
    y = sectionHeader(doc, "02  TERMINAL BLOCKERS", y);
    if (r.terminalBlockers?.length > 0) {
      r.terminalBlockers.forEach((tb) => {
        y = ensurePage(doc, y, 70);
        doc.rect(58, y, 479, 20).fill(`${RED}10`);
        doc.rect(58, y, 3, 20).fill(RED);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(RED)
          .text(safe(tb.label), 68, y + 6, { lineBreak: false });
        y += 24;
        y = citationRow(doc, "Governing Blocker", tb.governingBlocker, y);
        y = citationRow(doc, "Council Concern", tb.councilConcern, y);
        y = citationRow(doc, "Constitutional Finding", tb.constitutionalFinding, y);
        y = subHeader(doc, "RESIDUAL RISK", y + 2, MUTED);
        y = bodyText(doc, tb.residualRisk, y);
        y += 6;
      });
    } else {
      y = bodyText(doc, "No terminal blockers specified. Rejection based on structural deficiencies.", y);
    }
    y += 4;

    // ── SECTIONS 03–05: RECOVERY PATHS ────────────────────────────────────────
    y = sectionHeader(doc, "03  RECOVERY PATH A", y);
    if (r.recoveryPathA) y = recoveryPathBlock(doc, r.recoveryPathA, y, GREEN);

    y = sectionHeader(doc, "04  RECOVERY PATH B", y);
    if (r.recoveryPathB) y = recoveryPathBlock(doc, r.recoveryPathB, y, AMBER);

    y = sectionHeader(doc, "05  RECOVERY PATH C", y);
    if (r.recoveryPathC) y = recoveryPathBlock(doc, r.recoveryPathC, y, BLUE);

    // ── SECTION 06: RE-ENTRY CONDITIONS ───────────────────────────────────────
    y = sectionHeader(doc, "06  RE-ENTRY CONDITIONS", y);
    if (r.reentryConditions?.length > 0) {
      r.reentryConditions.forEach((rc, i) => {
        y = ensurePage(doc, y, 60);
        doc.rect(58, y, 479, 18).fill(i % 2 === 0 ? CARD_BG : ACCENT_BG);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
          .text(safe(rc.condition), 66, y + 5, { width: 460, lineBreak: false });
        y += 22;
        y = citationRow(doc, "Measurable Threshold", rc.measurableThreshold, y);
        y = citationRow(doc, "Verification Method", rc.verificationMethod, y);
        y = citationRow(doc, "Timeframe", rc.timeframe, y);
        y += 4;
      });
    }
    y += 4;

    // ── SECTION 07: PROBABILITY OF RECOVERY ───────────────────────────────────
    y = sectionHeader(doc, "07  PROBABILITY OF RECOVERY", y);
    y = ensurePage(doc, y, 60);
    doc.rect(58, y, 479, 52).fill(CARD_BG);
    doc.rect(58, y, 4, 52).fill(overallColor);

    const PCOLS = [66, 200, 350];
    const PHEADS = ["OVERALL", "MOST VIABLE PATH", "SUGGESTED REVIEW"];
    const PVALS = [
      `${r.overallProbabilityOfRecovery?.pct ?? 0}%`,
      `PATH ${r.overallProbabilityOfRecovery?.mostViablePath ?? "A"}`,
      safe(r.suggestedNextReviewDate),
    ];
    const PCOLORS = [overallColor, GREEN, BLUE];
    PHEADS.forEach((h, i) => {
      doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(h, PCOLS[i], y + 6, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(12).fillColor(PCOLORS[i]).text(PVALS[i], PCOLS[i], y + 16, { lineBreak: false });
    });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("RATIONALE", 66, y + 36, { lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
      .text(safe(r.overallProbabilityOfRecovery?.rationale), 66, y + 46, { width: 463, lineBreak: false });
    y += 60;

    // Path probability comparison
    const paths = [r.recoveryPathA, r.recoveryPathB, r.recoveryPathC];
    const pathColors = [GREEN, AMBER, BLUE];
    paths.forEach((p, i) => {
      if (!p) return;
      y = ensurePage(doc, y, 20);
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
        .text(`PATH ${p.label}  ${safe(p.title)}`, 62, y, { lineBreak: false });
      y += 10;
      y = probabilityBar(doc, p.probabilityPct, y, pathColors[i]);
    });
    y += 6;

    // ── SECTION 08: REQUIRED STRUCTURAL CHANGES ───────────────────────────────
    y = sectionHeader(doc, "08  REQUIRED STRUCTURAL CHANGES", y);
    if (r.requiredStructuralChanges?.length > 0) {
      const RCOLS = [58, 80, 280, 430];
      const RHEADS = ["#", "CHANGE", "RATIONALE", "BLOCKER"];
      y = ensurePage(doc, y, 18);
      doc.rect(58, y, 479, 16).fill(CARD_BG);
      RHEADS.forEach((h, i) => {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
          .text(h, RCOLS[i], y + 5, { lineBreak: false });
      });
      y += 18;
      r.requiredStructuralChanges.forEach((ch, idx) => {
        y = ensurePage(doc, y, 18);
        const bg = idx % 2 === 0 ? "#0D1526" : "#0A0F1E";
        doc.rect(58, y, 479, 18).fill(bg);
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(AMBER)
          .text(String(ch.rank), RCOLS[0], y + 5, { lineBreak: false });
        doc.font("Helvetica").fontSize(7.5).fillColor(BODY_TEXT)
          .text(safe(ch.change), RCOLS[1], y + 5, { width: 190, lineBreak: false });
        doc.font("Helvetica").fontSize(7).fillColor(MUTED)
          .text(safe(ch.rationale), RCOLS[2], y + 5, { width: 140, lineBreak: false });
        doc.font("Helvetica").fontSize(7).fillColor(RED)
          .text(safe(ch.governingBlocker), RCOLS[3], y + 5, { width: 100, lineBreak: false });
        y += 18;
      });
    }
    y += 8;

    // ── SECTION 09: CONDITIONS FOR RECONSIDERATION ────────────────────────────
    y = sectionHeader(doc, "09  CONDITIONS FOR RECONSIDERATION", y);
    if (r.conditionsForReconsideration?.length > 0) {
      r.conditionsForReconsideration.forEach((cond, i) => {
        y = ensurePage(doc, y, 16);
        doc.rect(62, y + 5, 5, 5).fill(BLUE);
        doc.font("Helvetica").fontSize(8.5).fillColor(BODY_TEXT)
          .text(safe(cond), 74, y + 3, { width: 463, lineBreak: true });
        y = doc.y + 4;
        void i;
      });
    }
    y += 8;

    // ── FOOTER on all pages ───────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(0, 810, 595, 32).fill(DARK_BG);
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED)
        .text(
          `AgenThink Mesh  ·  Deal Recovery Engine  ·  ${safe(input.dealName)}  ·  CONFIDENTIAL — NOT FOR DISTRIBUTION`,
          50, 817, { lineBreak: false }
        );
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED)
        .text(`Page ${i + 1} of ${totalPages}`, 0, 817, { align: "right", lineBreak: false });
    }

    doc.flushPages();
    doc.end();
  });
}
