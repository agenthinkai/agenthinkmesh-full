import PDFDocument from "pdfkit";

// ── Colour palette ─────────────────────────────────────────────────────────────
const NAVY   = "#0B1629";
const WHITE  = "#F0F4FA";
const MUTED  = "#8BA3C4";
const CYAN   = "#00D4FF";
const GREEN  = "#4ADE80";
const AMBER  = "#F59E0B";
const RED    = "#FF8080";
const BLUE   = "#0080FF";
const PURPLE = "#A78BFA";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

interface FinancialTableRow {
  label: string;
  values: (string | number)[];
  isHeader?: boolean;
  isBold?: boolean;
}
interface FinancialTable {
  years: string[];
  rows: FinancialTableRow[];
}
interface DCFValuation {
  wacc: string;
  terminalGrowthRate: string;
  impliedValuation: string;
  valuationRange: string;
  assumptions: string[];
  sensitivityNote: string;
}
interface KeyMetric {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
}
interface RevenueSegment {
  segment: string;
  value: string;
  percentage?: string;
}
interface StructuredReport {
  executiveSummary?: string;
  senseCheck?: { verdict: string; observations: string[] };
  balanceSheet?: FinancialTable | null;
  cashFlowStatement?: FinancialTable | null;
  dcfValuation?: DCFValuation | null;
  keyMetrics?: KeyMetric[];
  revenueSegments?: RevenueSegment[] | null;
  nextSteps?: string[];
}

export interface TaskData {
  id: number;
  query: string;
  taskType: string;
  confidence: number;
  executionTime: number;
  keyFindings: string[];
  risks: string[];
  recommendation: string | null;
  fileName: string | null;
  structuredReport: StructuredReport | null;
  createdAt: Date | number;
}

/**
 * Generate a PDF report buffer asynchronously.
 * PDFKit emits data chunks asynchronously, so we must wait for the
 * "finish" event before resolving — otherwise Buffer.concat returns 0 bytes.
 */
export function generateReportPdf(task: TaskData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `AgenThinkMesh Report — Task #${task.id}`,
        Author: "AgenThinkMesh",
        Subject: task.query.slice(0, 100),
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = doc.page.width - 100; // usable width

    // Paint dark background on every new page (including page 1 via the initial call below)
    const [nr0, ng0, nb0] = hexToRgb(NAVY);
    let pageNumber = 1;
    const dateStr2 = new Date(task.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    function paintPageBackground() {
      const savedY = doc.y;
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill([nr0, ng0, nb0]);
      doc.restore();
      // Reset y position after background fill
      doc.y = savedY;
    }

    function drawContinuationHeader() {
      pageNumber++;
      // Background first
      paintPageBackground();
      // Slim header bar
      const [cr2, cg2, cb2] = hexToRgb(CYAN);
      const [mr2, mg2, mb2] = hexToRgb(MUTED);
      // Left: brand name
      doc.fontSize(9).font("Helvetica-Bold").fillColor([cr2, cg2, cb2])
        .text("AgenThinkMesh", 50, 20, { continued: true })
        .font("Helvetica").fillColor([mr2, mg2, mb2]).fontSize(8)
        .text(`  ·  Task #${task.id}  ·  ${task.taskType}  ·  ${dateStr2}`, { continued: false });
      // Right: page number
      doc.fontSize(8).font("Helvetica").fillColor([mr2, mg2, mb2])
        .text(`Page ${pageNumber}`, 50, 20, { width: PAGE_W, align: "right" });
      // Divider line
      doc.moveTo(50, 34).lineTo(50 + PAGE_W, 34)
        .strokeColor([cr2, cg2, cb2]).lineWidth(0.4).stroke();
      // Push cursor below the header
      doc.y = 46;
    }

    doc.on("pageAdded", drawContinuationHeader);

    // ── Helper functions ────────────────────────────────────────────────────────
    function sectionTitle(text: string, color: string = CYAN) {
      doc.moveDown(0.6);
      const [r, g, b] = hexToRgb(color);
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor([r, g, b])
        .text(text.toUpperCase(), { characterSpacing: 1.5 });
      doc
        .moveTo(50, doc.y + 3)
        .lineTo(50 + PAGE_W, doc.y + 3)
        .strokeColor([r, g, b])
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.4);
    }

    function bodyText(text: string, color: string = WHITE) {
      const [r, g, b] = hexToRgb(color);
      doc.fontSize(10).font("Helvetica").fillColor([r, g, b]).text(text, { lineGap: 3 });
    }

    function bullet(text: string, symbol = "•", color: string = WHITE) {
      const [r, g, b] = hexToRgb(color);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor([r, g, b])
        .text(`${symbol}  ${text}`, { indent: 12, lineGap: 2 });
    }

    function financialTable(table: FinancialTable) {
      const labelW = PAGE_W * 0.38;
      const colW = (PAGE_W - labelW) / table.years.length;

      // Year headers
      const [mr, mg, mb] = hexToRgb(MUTED);
      let x = 50 + labelW;
      const headerY = doc.y;
      table.years.forEach((yr) => {
        doc.fontSize(8).font("Helvetica-Bold").fillColor([mr, mg, mb])
          .text(yr, x, headerY, { width: colW, align: "right" });
        x += colW;
      });
      doc.moveDown(0.3);

      // Data rows
      table.rows.forEach((row) => {
        if (doc.y > doc.page.height - 100) doc.addPage();
        const rowY = doc.y;
        const isH = row.isHeader;
        const isBold = row.isBold || isH;
        const [wr, wg, wb] = hexToRgb(isH ? CYAN : WHITE);

        doc
          .fontSize(isH ? 8 : 9)
          .font(isBold ? "Helvetica-Bold" : "Helvetica")
          .fillColor([wr, wg, wb])
          .text(row.label, 50, rowY, { width: labelW, lineGap: 1 });

        let cx = 50 + labelW;
        (row.values ?? []).forEach((val) => {
          const display = val === null || val === undefined ? "—" : String(val);
          doc
            .fontSize(9)
            .font(isBold ? "Helvetica-Bold" : "Helvetica")
            .fillColor([wr, wg, wb])
            .text(display, cx, rowY, { width: colW, align: "right", lineGap: 1 });
          cx += colW;
        });
        doc.moveDown(isH ? 0.4 : 0.25);
      });
    }

    // ── Dark background (page 1) ────────────────────────────────────────────────
    paintPageBackground();

    // ── Header ──────────────────────────────────────────────────────────────────
    const [cr, cg, cb] = hexToRgb(CYAN);
    doc.fontSize(18).font("Helvetica-Bold").fillColor([cr, cg, cb]).text("AgenThinkMesh", 50, 50);
    doc.fontSize(9).font("Helvetica").fillColor(hexToRgb(MUTED)).text("Structured Analysis Report", 50, doc.y + 2);

    // Meta row
    const dateStr = new Date(task.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    doc.fontSize(8).fillColor(hexToRgb(MUTED))
      .text(`Task #${task.id}  ·  ${task.taskType}  ·  ${task.confidence}% confidence  ·  ${task.executionTime}s  ·  ${dateStr}`, 50, doc.y + 4);

    if (task.fileName) {
      doc.fontSize(8).fillColor(hexToRgb(GREEN)).text(`Attached: ${task.fileName}`, 50, doc.y + 2);
    }

    // Divider
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(50 + PAGE_W, doc.y).strokeColor(hexToRgb(CYAN)).lineWidth(1).stroke();
    doc.moveDown(0.5);

    // ── Query ───────────────────────────────────────────────────────────────────
    sectionTitle("Query", CYAN);
    bodyText(task.query);

    // ── Execution output path (draft, code, decision, compliance, qa) ────────────
    // When taskType ends in "Draft", "Code", "Recommendation", "Check", or "Plan",
    // the recommendation field holds the full deliverable text — render it directly.
    const EXEC_TYPES = ["Draft", "Code", "Recommendation", "Check", "Plan", "Financial Model", "DCF", "Valuation"];
    const isExecOutput = EXEC_TYPES.some((t) => task.taskType?.includes(t));

    if (isExecOutput && task.recommendation) {
      // Render the full deliverable as formatted text
      const lines = task.recommendation.split("\n");
      let inCodeBlock = false;
      for (const line of lines) {
        if (line.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          if (inCodeBlock) {
            doc.moveDown(0.3);
            doc.rect(50, doc.y, PAGE_W, 12).fill(hexToRgb("#0D2137"));
            doc.fontSize(8).font("Helvetica-Bold").fillColor(hexToRgb(MUTED)).text("CODE", 58, doc.y - 10, { characterSpacing: 1.2 });
            doc.moveDown(0.5);
          } else {
            doc.moveDown(0.5);
          }
          continue;
        }
        if (inCodeBlock) {
          doc.fontSize(9).font("Courier").fillColor(hexToRgb(GREEN)).text(line || " ", { lineGap: 1 });
          continue;
        }
        // Section headers (ALL CAPS lines or lines ending with ":")
        const isSectionHeader = /^[A-Z][A-Z ]+:/.test(line) || /^[A-Z ]{4,}$/.test(line.trim());
        if (isSectionHeader && line.trim().length > 0) {
          sectionTitle(line.replace(/:$/, ""), CYAN);
          continue;
        }
        if (line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*")) {
          bullet(line.replace(/^[•\-\*]\s*/, ""), "•", WHITE);
          continue;
        }
        // Pipe-table rows — render as a simple aligned text table
        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
          const isSep = /^\|[-| :]+\|$/.test(line.trim());
          if (isSep) { continue; } // skip separator lines
          const cells = line.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
          const colW = PAGE_W / cells.length;
          const rowY = doc.y;
          const isHeaderRow = lines.indexOf(line) === lines.findIndex(l => l.trim().startsWith("|"));
          cells.forEach((cell, ci) => {
            const [cr2, cg2, cb2] = hexToRgb(isHeaderRow ? CYAN : WHITE);
            doc.fontSize(isHeaderRow ? 8 : 9)
              .font(isHeaderRow ? "Helvetica-Bold" : "Helvetica")
              .fillColor([cr2, cg2, cb2])
              .text(cell || "—", 50 + ci * colW, rowY, { width: colW, align: ci === 0 ? "left" : "right", lineGap: 1 });
          });
          doc.moveDown(isHeaderRow ? 0.4 : 0.25);
          continue;
        }
        if (line.trim() === "") { doc.moveDown(0.4); continue; }
        bodyText(line);
      }

      // Footer and end
      doc.moveDown(1);
      doc.fontSize(7).font("Helvetica").fillColor(hexToRgb(MUTED))
        .text(`Generated by AgenThinkMesh  ·  ${new Date().toISOString()}  ·  agenthink-7enctkan.manus.space`, { align: "center" });
      doc.end();
      return;
    }

    const report = task.structuredReport;

    // ── Executive Summary ────────────────────────────────────────────────────────
    if (report?.executiveSummary) {
      sectionTitle("Executive Summary", CYAN);
      bodyText(report.executiveSummary);
    }

    // ── Sense Check ─────────────────────────────────────────────────────────────
    if (report?.senseCheck) {
      const sc = report.senseCheck;
      const verdictColor = sc.verdict === "Credible" ? GREEN : sc.verdict === "Unreliable" ? RED : AMBER;
      sectionTitle("Sense Check", verdictColor);
      const [vr, vg, vb] = hexToRgb(verdictColor);
      const icon = sc.verdict === "Credible" ? "+" : sc.verdict === "Unreliable" ? "x" : "!";
      doc.fontSize(11).font("Helvetica-Bold").fillColor([vr, vg, vb]).text(`${icon}  ${sc.verdict}`);
      doc.moveDown(0.3);
      (sc.observations ?? []).forEach((obs) => bullet(obs, "·", WHITE));
    }

    // ── Key Metrics ──────────────────────────────────────────────────────────────
    if (report?.keyMetrics && report.keyMetrics.length > 0) {
      sectionTitle("Key Metrics", BLUE);
      const metrics = report.keyMetrics;
      const colW2 = PAGE_W / Math.min(3, metrics.length);
      let mx = 50;
      const myStart = doc.y;
      metrics.forEach((m, i) => {
        const trendIcon = m.trend === "up" ? "^" : m.trend === "down" ? "v" : "-";
        const trendColor = m.trend === "up" ? GREEN : m.trend === "down" ? RED : MUTED;
        doc.fontSize(7).font("Helvetica").fillColor(hexToRgb(MUTED)).text(m.label.toUpperCase(), mx, myStart, { width: colW2, characterSpacing: 0.8 });
        doc.fontSize(11).font("Helvetica-Bold").fillColor(hexToRgb(WHITE)).text(`${m.value} `, mx, doc.y, { continued: true, width: colW2 });
        doc.fontSize(11).font("Helvetica-Bold").fillColor(hexToRgb(trendColor)).text(trendIcon, { continued: false });
        if ((i + 1) % 3 === 0) { mx = 50; doc.moveDown(0.8); } else { mx += colW2; }
      });
      doc.moveDown(0.5);
    }

    // ── Revenue Segments ─────────────────────────────────────────────────────────
    if (report?.revenueSegments && report.revenueSegments.length > 0) {
      sectionTitle("Revenue Segment Breakdown", GREEN);
      report.revenueSegments.forEach((seg) => {
        const pct = seg.percentage ? `  (${seg.percentage})` : "";
        doc.fontSize(10).font("Helvetica-Bold").fillColor(hexToRgb(WHITE)).text(`${seg.segment}`, { continued: true });
        doc.fontSize(10).font("Helvetica").fillColor(hexToRgb(GREEN)).text(`  ${seg.value}${pct}`);
      });
    }

    // ── Balance Sheet ────────────────────────────────────────────────────────────
    if (report?.balanceSheet) {
      sectionTitle("Derived Balance Sheet", BLUE);
      financialTable(report.balanceSheet);
    }

    // ── Cash Flow Statement ──────────────────────────────────────────────────────
    if (report?.cashFlowStatement) {
      if (doc.y > doc.page.height - 150) doc.addPage();
      sectionTitle("Statement of Cash Flows", PURPLE);
      financialTable(report.cashFlowStatement);
    }

    // ── DCF Valuation ────────────────────────────────────────────────────────────
    if (report?.dcfValuation) {
      if (doc.y > doc.page.height - 200) doc.addPage();
      const dcf = report.dcfValuation;
      sectionTitle("DCF Valuation", AMBER);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(hexToRgb(WHITE))
        .text(`Implied Valuation: `, { continued: true })
        .fillColor(hexToRgb(AMBER)).text(dcf.impliedValuation);
      doc.fontSize(10).font("Helvetica").fillColor(hexToRgb(WHITE))
        .text(`Range: ${dcf.valuationRange}  ·  WACC: ${dcf.wacc}  ·  Terminal Growth: ${dcf.terminalGrowthRate}`);
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(hexToRgb(MUTED)).text("Assumptions:");
      (dcf.assumptions ?? []).forEach((a) => bullet(a, "·", MUTED));
      if (dcf.sensitivityNote) {
        doc.moveDown(0.3);
        doc.fontSize(9).font("Helvetica").fillColor(hexToRgb(MUTED)).text(dcf.sensitivityNote, { lineGap: 2 });
      }
    }

    // ── Key Findings ─────────────────────────────────────────────────────────────
    if (task.keyFindings && task.keyFindings.length > 0) {
      if (doc.y > doc.page.height - 150) doc.addPage();
      sectionTitle("Key Findings", CYAN);
      task.keyFindings.forEach((f, i) => bullet(f, `${String(i + 1).padStart(2, "0")}`, WHITE));
    }

    // ── Risk Factors ─────────────────────────────────────────────────────────────
    if (task.risks && task.risks.length > 0) {
      sectionTitle("Risk Factors", AMBER);
      task.risks.forEach((r) => bullet(r, "!", AMBER));
    }

    // ── Recommendation ───────────────────────────────────────────────────────────
    if (task.recommendation) {
      sectionTitle("Recommendation", GREEN);
      bodyText(task.recommendation);
    }

    // ── Next Steps ───────────────────────────────────────────────────────────────
    if (report?.nextSteps && report.nextSteps.length > 0) {
      sectionTitle("Next Steps", GREEN);
      report.nextSteps.forEach((s, i) => bullet(s, `${i + 1}.`, WHITE));
    }

    // ── Footer ───────────────────────────────────────────────────────────────────
    doc.moveDown(1);
    doc.fontSize(7).font("Helvetica").fillColor(hexToRgb(MUTED))
      .text(`Generated by AgenThinkMesh  ·  ${new Date().toISOString()}  ·  agenthink-7enctkan.manus.space`, { align: "center" });

    // Finalise — "end" event fires after all chunks are flushed
    doc.end();
  });
}

// ── MVNO Report Types ─────────────────────────────────────────────────────────

export interface MvnoAgentResults {
  onboarding: { status: string; flags: string[]; action: string };
  billing: { healthScore: number; issues: string[]; recommendation: string };
  plan: { currentPlanFit: string; churnRisk: string; action: string };
  remittance: { primaryCorridor: string; monthlyVolume: string; bundleMatch: string; saving: string };
  fraud: { riskLevel: string; flags: string[]; action: string };
}

export interface MvnoReportData {
  runId: string;
  subscriber: {
    name: string;
    nationality: string;
    msisdn: string;
    plan: string;
    simStatus: string;
    kycStatus: string;
    monthlyArpu: number;
    notes?: string;
  };
  agentResults: MvnoAgentResults;
  overallRecommendation: string;
}

/**
 * Generate a PDF report buffer for an MVNO intelligence run.
 */
export function generateMvnoPdf(data: MvnoReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const TEAL  = "#00c4a0";
    const GOLD2 = "#d4a843";

    // ── Helpers ───────────────────────────────────────────────────────────────
    const pageBg = () => {
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(hexToRgb(NAVY));
    };
    const sectionTitle = (title: string, color: string) => {
      doc.moveDown(0.8);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(hexToRgb(color))
        .text(title.toUpperCase(), { characterSpacing: 1.5 });
      doc.moveDown(0.2);
    };
    const bodyText = (text: string) => {
      doc.fontSize(11).font("Helvetica").fillColor(hexToRgb(WHITE)).text(text, { lineGap: 3 });
      doc.moveDown(0.4);
    };
    const bullet = (text: string, prefix: string, color: string) => {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(hexToRgb(color)).text(prefix + " ", { continued: true });
      doc.font("Helvetica").fillColor(hexToRgb(WHITE)).text(text, { lineGap: 2 });
    };
    const metricRow = (label: string, value: string, color: string) => {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(hexToRgb(MUTED)).text(label + ": ", { continued: true });
      doc.font("Helvetica-Bold").fillColor(hexToRgb(color)).text(value);
    };

    // ── Page 1 ────────────────────────────────────────────────────────────────
    pageBg();

    // Header bar
    doc.rect(48, 48, doc.page.width - 96, 3)
      .fill(hexToRgb(TEAL));

    // Title block
    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica").fillColor(hexToRgb(MUTED))
      .text(`AgenThinkMesh · MVNO Intelligence Report · Kuwait · ${new Date().toLocaleDateString("en-KW", { timeZone: "Asia/Kuwait" })}  ·  CONFIDENTIAL`);
    doc.moveDown(0.3);
    doc.fontSize(22).font("Helvetica-Bold").fillColor(hexToRgb(GOLD2))
      .text("Kuwait MVNO Intelligence");
    doc.fontSize(16).font("Helvetica").fillColor(hexToRgb(WHITE))
      .text(`Subscriber Report: ${data.subscriber.name}`);
    doc.moveDown(0.6);

    // Overall recommendation banner
    const recoColors: Record<string, string> = {
      SUSPEND_SUBSCRIBER: RED,
      KYC_FAILED: RED,
      URGENT_RETENTION: AMBER,
      HEALTHY_SUBSCRIBER: TEAL,
      REVIEW_REQUIRED: PURPLE,
    };
    const recoColor = recoColors[data.overallRecommendation] ?? MUTED;
    doc.fontSize(13).font("Helvetica-Bold").fillColor(hexToRgb(recoColor))
      .text(`▶  ${data.overallRecommendation.replace(/_/g, " ")}`);
    doc.moveDown(0.4);

    // Subscriber profile
    sectionTitle("Subscriber Profile", CYAN);
    metricRow("Name",        data.subscriber.name,        WHITE);
    metricRow("Nationality", data.subscriber.nationality,  WHITE);
    metricRow("MSISDN",      data.subscriber.msisdn,       WHITE);
    metricRow("Plan",        data.subscriber.plan.replace(/_/g, " ").toUpperCase(), GOLD2);
    metricRow("SIM Status",  data.subscriber.simStatus.toUpperCase(), WHITE);
    metricRow("KYC Status",  data.subscriber.kycStatus.toUpperCase(),
      data.subscriber.kycStatus === "verified" ? TEAL : AMBER);
    metricRow("Monthly ARPU", `KWD ${data.subscriber.monthlyArpu.toFixed(2)}`, WHITE);
    if (data.subscriber.notes) {
      doc.moveDown(0.2);
      doc.fontSize(10).font("Helvetica-Oblique").fillColor(hexToRgb(MUTED))
        .text(data.subscriber.notes, { lineGap: 2 });
    }

    // ── Agent 1: Onboarding ───────────────────────────────────────────────────
    sectionTitle("Agent 1 — KYC & Onboarding", TEAL);
    const ob = data.agentResults.onboarding;
    metricRow("Status", ob.status.toUpperCase(),
      ob.status === "approved" ? TEAL : ob.status === "rejected" ? RED : AMBER);
    if (ob.flags.length) {
      doc.moveDown(0.2);
      ob.flags.forEach(f => bullet(f, "⚑", AMBER));
    }
    doc.moveDown(0.2);
    bodyText(ob.action);

    // ── Agent 2: Billing ──────────────────────────────────────────────────────
    sectionTitle("Agent 2 — Billing & Support", GOLD2);
    const bl = data.agentResults.billing;
    const blColor = bl.healthScore >= 70 ? TEAL : bl.healthScore >= 40 ? AMBER : RED;
    metricRow("Health Score", `${bl.healthScore}/100`, blColor);
    if (bl.issues.length) {
      doc.moveDown(0.2);
      bl.issues.forEach(i => bullet(i, "!", AMBER));
    }
    doc.moveDown(0.2);
    bodyText(bl.recommendation);

    // ── Agent 3: Plan ─────────────────────────────────────────────────────────
    sectionTitle("Agent 3 — Plan Optimisation", PURPLE);
    const pl = data.agentResults.plan;
    metricRow("Plan Fit",   pl.currentPlanFit.toUpperCase(),
      pl.currentPlanFit === "good" ? TEAL : GOLD2);
    metricRow("Churn Risk", pl.churnRisk.toUpperCase(),
      pl.churnRisk === "low" ? TEAL : pl.churnRisk === "medium" ? AMBER : RED);
    doc.moveDown(0.2);
    bodyText(pl.action);

    // ── Agent 4: Remittance ───────────────────────────────────────────────────
    sectionTitle("Agent 4 — Remittance Intelligence", CYAN);
    const rm = data.agentResults.remittance;
    metricRow("Primary Corridor", rm.primaryCorridor, WHITE);
    metricRow("Monthly Volume",   rm.monthlyVolume,   WHITE);
    metricRow("Estimated Saving", rm.saving,          TEAL);
    doc.moveDown(0.2);
    bodyText(rm.bundleMatch);

    // ── Agent 5: Fraud ────────────────────────────────────────────────────────
    sectionTitle("Agent 5 — Fraud Detection", RED);
    const fr = data.agentResults.fraud;
    metricRow("Risk Level", fr.riskLevel.toUpperCase(),
      fr.riskLevel === "clean" ? TEAL : fr.riskLevel === "monitor" ? AMBER : RED);
    if (fr.flags.length) {
      doc.moveDown(0.2);
      fr.flags.forEach(f => bullet(f, "⚑", RED));
    }
    doc.moveDown(0.2);
    bodyText(fr.action);

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveDown(1.5);
    doc.rect(48, doc.y, doc.page.width - 96, 1).fill(hexToRgb(MUTED));
    doc.moveDown(0.4);
    doc.fontSize(7).font("Helvetica").fillColor(hexToRgb(MUTED))
      .text(
        `Generated by AgenThinkMesh MVNO Intelligence  ·  Run ID: ${data.runId}  ·  ${new Date().toISOString()}  ·  farouq@agenthinkmesh.com`,
        { align: "center" }
      );

    doc.end();
  });
}
