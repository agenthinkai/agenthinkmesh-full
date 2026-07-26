/**
 * legalRedlinePdf.ts — PDFKit proof report for LegalRedline Mesh
 *
 * Generates a professional dark-themed PDF audit report with:
 * - Cover page: contract title, health score, risk summary
 * - Executive summary
 * - Clause-by-clause table with risk levels, benchmarks, and redlines
 * - Footer with audit ID and timestamp
 */

import PDFDocument from "pdfkit";

// ── Colour palette ─────────────────────────────────────────────────────────────
const NAVY    = "#0B1629";
const DARK    = "#0f172a";
const CARD    = "#1e293b";
const WHITE   = "#F0F4FA";
const MUTED   = "#94a3b8";
const CYAN    = "#38bdf8";
const RED     = "#ef4444";
const AMBER   = "#f59e0b";
const GREEN   = "#22c55e";
const BORDER  = "#334155";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgb(hex: string): [number, number, number] {
  return hexToRgb(hex);
}

interface AuditClause {
  id: number;
  clauseTitle: string;
  originalWording: string;
  persona: string;
  riskLevel: "CRITICAL" | "WARNING" | "CLEAR";
  riskRationale: string;
  marketBenchmark: string;
  redlineRewrite: string;
}

interface AuditResult {
  contractType: string;
  contractTitle: string;
  overallHealthScore: number;
  executiveSummary: string;
  criticalCount: number;
  warningCount: number;
  clearCount: number;
  clauses: AuditClause[];
}

function riskColour(level: string): string {
  if (level === "CRITICAL") return RED;
  if (level === "WARNING") return AMBER;
  return GREEN;
}

function scoreColour(score: number): string {
  if (score < 40) return RED;
  if (score < 70) return AMBER;
  return GREEN;
}

export async function generateLegalRedlinePdf(
  auditId: string,
  data: AuditResult & { filename: string; createdAt: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `LegalRedline Mesh — ${data.contractTitle}`,
        Author: "LegalRedline Mesh by AgenThinkMesh",
        Subject: "Contract Audit Proof Report",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const ML = doc.page.margins.left;
    const MR = doc.page.margins.right;
    const CONTENT_W = W - ML - MR;

    // ── Helper: fill rect ──────────────────────────────────────────────────────
    function fillRect(x: number, y: number, w: number, h: number, hex: string) {
      doc.save().rect(x, y, w, h).fill(rgb(hex)).restore();
    }

    // ── Helper: add page footer ────────────────────────────────────────────────
    function addFooter() {
      const y = doc.page.height - 30;
      doc.save()
        .fontSize(7)
        .fillColor(rgb(MUTED))
        .text(`LegalRedline Mesh  ·  Audit ID: ${auditId}  ·  ${new Date(data.createdAt).toUTCString()}  ·  Confidential`, ML, y, { width: CONTENT_W, align: "center" })
        .restore();
    }

    // ── Cover Page ─────────────────────────────────────────────────────────────
    fillRect(0, 0, W, doc.page.height, DARK);

    // Accent bar
    fillRect(0, 0, W, 6, CYAN);

    // Logo / brand
    doc.save()
      .fontSize(11)
      .fillColor(rgb(CYAN))
      .font("Helvetica-Bold")
      .text("LEGALREDLINE MESH", ML, 30)
      .restore();

    doc.save()
      .fontSize(9)
      .fillColor(rgb(MUTED))
      .font("Helvetica")
      .text("by AgenThinkMesh  ·  Contract Audit Proof Report", ML, 46)
      .restore();

    // Contract title block
    const titleY = 110;
    doc.save()
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor(rgb(WHITE))
      .text(data.contractTitle || data.filename, ML, titleY, { width: CONTENT_W })
      .restore();

    const afterTitle = doc.y + 10;

    doc.save()
      .fontSize(10)
      .font("Helvetica")
      .fillColor(rgb(MUTED))
      .text(`Contract Type: ${data.contractType}   ·   File: ${data.filename}`, ML, afterTitle)
      .restore();

    // Health score circle (text-based)
    const scoreY = afterTitle + 50;
    const scoreHex = scoreColour(data.overallHealthScore);
    fillRect(ML, scoreY, 140, 80, CARD);
    doc.save()
      .fontSize(40)
      .font("Helvetica-Bold")
      .fillColor(rgb(scoreHex))
      .text(String(data.overallHealthScore), ML, scoreY + 12, { width: 140, align: "center" })
      .restore();
    doc.save()
      .fontSize(8)
      .font("Helvetica")
      .fillColor(rgb(MUTED))
      .text("HEALTH SCORE / 100", ML, scoreY + 60, { width: 140, align: "center" })
      .restore();

    // Risk summary boxes
    const boxW = 100;
    const boxY = scoreY;
    const boxes = [
      { label: "CRITICAL", count: data.criticalCount, colour: RED },
      { label: "WARNING", count: data.warningCount, colour: AMBER },
      { label: "CLEAR", count: data.clearCount, colour: GREEN },
    ];
    boxes.forEach((b, i) => {
      const bx = ML + 160 + i * (boxW + 10);
      fillRect(bx, boxY, boxW, 80, CARD);
      doc.save()
        .fontSize(32)
        .font("Helvetica-Bold")
        .fillColor(rgb(b.colour))
        .text(String(b.count), bx, boxY + 12, { width: boxW, align: "center" })
        .restore();
      doc.save()
        .fontSize(8)
        .font("Helvetica")
        .fillColor(rgb(MUTED))
        .text(b.label, bx, boxY + 60, { width: boxW, align: "center" })
        .restore();
    });

    // Executive summary
    const summaryY = scoreY + 100;
    fillRect(ML, summaryY, CONTENT_W, 4, BORDER);

    doc.save()
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(rgb(CYAN))
      .text("EXECUTIVE SUMMARY", ML, summaryY + 12)
      .restore();

    doc.save()
      .fontSize(9)
      .font("Helvetica")
      .fillColor(rgb(WHITE))
      .text(data.executiveSummary, ML, summaryY + 30, { width: CONTENT_W, lineGap: 3 })
      .restore();

    addFooter();

    // ── Clause Pages ───────────────────────────────────────────────────────────
    for (const clause of data.clauses) {
      doc.addPage({ size: "A4", margins: { top: 40, bottom: 40, left: 50, right: 50 } });
      fillRect(0, 0, W, doc.page.height, DARK);
      fillRect(0, 0, W, 6, CYAN);

      const riskHex = riskColour(clause.riskLevel);

      // Clause header
      fillRect(ML, 30, CONTENT_W, 36, CARD);
      // Risk badge
      fillRect(ML, 30, 80, 36, riskHex);
      doc.save()
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(rgb(DARK))
        .text(clause.riskLevel, ML, 42, { width: 80, align: "center" })
        .restore();

      doc.save()
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor(rgb(WHITE))
        .text(`${clause.id}. ${clause.clauseTitle}`, ML + 90, 38, { width: CONTENT_W - 90 })
        .restore();

      let cy = 80;

      // Persona
      doc.save()
        .fontSize(8)
        .font("Helvetica")
        .fillColor(rgb(MUTED))
        .text(`Evaluating Persona: ${clause.persona}`, ML, cy)
        .restore();
      cy += 18;

      // Section helper
      const section = (label: string, content: string, colour: string = WHITE) => {
        fillRect(ML, cy, CONTENT_W, 1, BORDER);
        cy += 6;
        doc.save()
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor(rgb(CYAN))
          .text(label, ML, cy)
          .restore();
        cy += 14;
        doc.save()
          .fontSize(8.5)
          .font("Helvetica")
          .fillColor(rgb(colour))
          .text(content, ML, cy, { width: CONTENT_W, lineGap: 2 })
          .restore();
        cy = doc.y + 10;
      }

      section("ORIGINAL WORDING", `"${clause.originalWording}"`, MUTED);
      section("RISK RATIONALE", clause.riskRationale, WHITE);
      section("MARKET BENCHMARK", clause.marketBenchmark, MUTED);

      // Redline rewrite — highlighted box
      fillRect(ML, cy, CONTENT_W, 1, riskHex);
      cy += 6;
      doc.save()
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(rgb(riskHex))
        .text("AI REDLINE REWRITE", ML, cy)
        .restore();
      cy += 14;
      fillRect(ML, cy, CONTENT_W, 0, CARD);
      const rwStartY = cy;
      doc.save()
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor(rgb(GREEN))
        .text(clause.redlineRewrite, ML + 8, cy + 6, { width: CONTENT_W - 16, lineGap: 2 })
        .restore();
      const rwEndY = doc.y + 8;
      fillRect(ML, rwStartY, CONTENT_W, rwEndY - rwStartY, CARD);
      // Re-draw text on top of box
      doc.save()
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor(rgb(GREEN))
        .text(clause.redlineRewrite, ML + 8, rwStartY + 6, { width: CONTENT_W - 16, lineGap: 2 })
        .restore();

      addFooter();
    }

    doc.end();
  });
}
