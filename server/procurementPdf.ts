/**
 * server/procurementPdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates an institutional Vendor Evaluation Report PDF from the
 * VendorEvaluationReport JSON produced by procurementEngine.ts.
 *
 * No LLM call — pure layout from existing structured data.
 * White background, tight typography, consistent with IC Memo style.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types (mirrors procurementEngine.ts output) ───────────────────────────────

export interface AgentScoreInput {
  agentId: string;
  agentName: string;
  agentRole: string;
  score: number;
  verdict: "APPROVE" | "REJECT" | "CONDITIONAL";
  confidence: "High" | "Medium" | "Low";
  keyReasoning: string;
  topRisks: string[];
  redFlags: string[];
  positives: string[];
}

export interface ConsensusInput {
  averageScore: number;
  approveCount: number;
  rejectCount: number;
  conditionalCount: number;
  majorDisagreements: string[];
  highestRiskAreas: string[];
  overallConfidence: "High" | "Medium" | "Low";
  decisionRationale: string;
  conflictingScoringPairs: string[];
}

export interface ProcurementReportInput {
  vendorName: string;
  category: string;
  insufficientData: boolean;
  finalRecommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL" | "INSUFFICIENT_DATA";
  recommendationRationale: string;
  overallScore: number;
  overallConfidence: "High" | "Medium" | "Low";
  agentScores: AgentScoreInput[];
  consensus: ConsensusInput;
  topDecisionDrivers: string[];
  topRisks: string[];
  suggestedNegotiationPoints: string[];
  missingRequiredInformation: string[];
  triage?: {
    relevance: string;
    dataQuality: string;
    basicRiskFlags: string[];
    missingFields: string[];
    summary: string;
  };
  generatedAt: number;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateProcurementPdf(report: ProcurementReportInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    // ── Design tokens (white background institutional style) ──────────────────
    const BG       = "#FFFFFF";
    const BG2      = "#F8FAFC";
    const BG3      = "#F1F5F9";
    const BORDER_C = "#E2E8F0";
    const ACCENT   = "#1E40AF";   // primary blue
    const GREEN    = "#15803D";   // approve
    const AMBER    = "#B45309";   // conditional
    const RED      = "#DC2626";   // reject
    const TEXT     = "#0F172A";
    const TEXT2    = "#334155";
    const MUTED    = "#64748B";
    const TEAL     = "#0F766E";   // negotiation points

    const A4_W   = 595.28;
    const A4_H   = 841.89;
    const ML     = 48;
    const MR     = 48;
    const MT     = 44;
    const BODY_W = A4_W - ML - MR;

    // Verdict colour
    const verdictColor =
      report.finalRecommendation === "APPROVE"             ? GREEN  :
      report.finalRecommendation === "CONDITIONAL_APPROVAL" ? AMBER  :
      report.finalRecommendation === "INSUFFICIENT_DATA"    ? MUTED  : RED;

    const verdictLabel =
      report.finalRecommendation === "APPROVE"             ? "APPROVED"             :
      report.finalRecommendation === "CONDITIONAL_APPROVAL" ? "CONDITIONAL APPROVAL" :
      report.finalRecommendation === "INSUFFICIENT_DATA"    ? "INSUFFICIENT DATA"    : "REJECTED";

    const doc = new PDFDocument({
      size: "A4",
      autoFirstPage: true,
      bufferPages: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Vendor Evaluation Report — ${report.vendorName}`,
        Author: "AgenThinkMesh · Procurement Engine",
        Subject: "Vendor Evaluation Report",
        Keywords: "Procurement, Vendor Evaluation, Risk Assessment",
      },
    });

    let _pageNum = 1;

    doc.on("pageAdded", () => {
      doc.rect(0, 0, A4_W, A4_H).fill(BG);
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ───────────────────────────────────────────────────────────────

    function ensureSpace(needed: number) {
      if (doc.y + needed > A4_H - 60) {
        doc.addPage();
        _pageNum++;
        pageHeader();
        doc.y = MT + 8;
      }
    }

    function pageHeader(sectionLabel?: string) {
      doc.rect(0, 0, A4_W, 32).fill(BG3);
      doc.rect(0, 32, A4_W, 1).fill(BORDER_C);
      doc.rect(0, 0, 4, 32).fill(ACCENT);
      doc.fontSize(6.5).fillColor(ACCENT).font("Helvetica-Bold")
        .text("AGENTHINK MESH", ML, 10, { continued: false });
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
        .text("PROCUREMENT ENGINE  ·  VENDOR EVALUATION REPORT", ML + 88, 10);
      if (sectionLabel) {
        doc.fontSize(6.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(sectionLabel.toUpperCase(), A4_W - MR - 140, 10, { width: 140, align: "right" });
      } else {
        const dateStr = new Date(report.generatedAt).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        });
        doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
          .text(dateStr, A4_W - MR - 60, 10, { width: 60, align: "right" });
      }
    }

    function pageFooter(pageNum: number) {
      doc.rect(0, A4_H - 24, A4_W, 1).fill(BORDER_C);
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text("CONFIDENTIAL — For Authorised Procurement Committee Members Only. AI-assisted analysis. Not a final procurement decision.",
          ML, A4_H - 16, { width: BODY_W - 30 });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(`${pageNum}`, A4_W - MR - 16, A4_H - 16, { width: 16, align: "right" });
    }

    function sectionDivider(num: string, title: string, color: string = ACCENT) {
      ensureSpace(36);
      const sy = doc.y;
      doc.rect(ML, sy, BODY_W, 28).fill(BG3);
      doc.rect(ML, sy, 3, 28).fill(color);
      doc.fontSize(7.5).fillColor(color).font("Helvetica-Bold")
        .text(num, ML + 10, sy + 7, { lineBreak: false });
      doc.fontSize(11).fillColor(TEXT).font("Helvetica-Bold")
        .text(title, ML + 28, sy + 6, { lineBreak: false });
      doc.y = sy + 34;
    }

    function subHeading(title: string, color: string = ACCENT) {
      ensureSpace(20);
      const shY = doc.y;
      doc.rect(ML, shY, BODY_W, 0.5).fill(BORDER_C);
      doc.fontSize(7.5).fillColor(color).font("Helvetica-Bold")
        .text(title.toUpperCase(), ML, shY + 6, { characterSpacing: 0.8, lineBreak: false });
      doc.y = shY + 18;
    }

    function bodyText(text: string, color: string = TEXT2) {
      if (!text) return;
      ensureSpace(18);
      doc.fontSize(9.5).fillColor(color).font("Helvetica")
        .text(text, ML, doc.y, { width: BODY_W, lineGap: 2.5, align: "justify" });
      doc.y += 8;
    }

    function bullet(text: string, color: string = TEXT2, indent: number = 0) {
      if (!text) return;
      ensureSpace(16);
      const x = ML + indent;
      const w = BODY_W - indent;
      doc.circle(x + 4, doc.y + 5, 2).fill(color);
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(text, x + 13, doc.y, { width: w - 13, lineGap: 2 });
      doc.y += 4;
    }

    function numberedItem(n: number, text: string, color: string = TEXT2) {
      if (!text) return;
      ensureSpace(16);
      doc.fontSize(9).fillColor(color).font("Helvetica-Bold")
        .text(`${n}.`, ML, doc.y, { continued: true, width: 16 });
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(text, ML + 18, doc.y, { width: BODY_W - 18, lineGap: 2 });
      doc.y += 4;
    }

    // ── COVER PAGE ────────────────────────────────────────────────────────────

    // Header bar
    pageHeader();

    // Cover content starts below header
    doc.y = 80;

    // Verdict badge (large)
    const badgeW = 220;
    const badgeX = (A4_W - badgeW) / 2;
    doc.rect(badgeX, doc.y, badgeW, 36).fill(verdictColor);
    doc.fontSize(14).fillColor("#FFFFFF").font("Helvetica-Bold")
      .text(verdictLabel, badgeX, doc.y + 10, { width: badgeW, align: "center" });
    doc.y += 46;

    // Score circle (simple box)
    const scoreBoxX = (A4_W - 80) / 2;
    doc.rect(scoreBoxX, doc.y, 80, 40).fill(BG3).stroke(BORDER_C);
    doc.fontSize(22).fillColor(verdictColor).font("Helvetica-Bold")
      .text(report.overallScore.toFixed(1), scoreBoxX, doc.y + 4, { width: 80, align: "center" });
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
      .text("/ 10  OVERALL SCORE", scoreBoxX, doc.y + 28, { width: 80, align: "center" });
    doc.y += 52;

    // Vendor name + category
    doc.fontSize(22).fillColor(TEXT).font("Helvetica-Bold")
      .text(report.vendorName, ML, doc.y, { width: BODY_W, align: "center" });
    doc.y += 28;
    doc.fontSize(11).fillColor(MUTED).font("Helvetica")
      .text(report.category, ML, doc.y, { width: BODY_W, align: "center" });
    doc.y += 20;

    // Thin rule
    doc.rect(ML + 60, doc.y, BODY_W - 120, 1).fill(BORDER_C);
    doc.y += 16;

    // Vote summary bar
    const totalAgents = report.agentScores.length;
    if (totalAgents > 0) {
      const { approveCount, conditionalCount, rejectCount } = report.consensus;
      const barW = BODY_W - 40;
      const barX = ML + 20;
      const barH = 10;
      const approveW = (approveCount / totalAgents) * barW;
      const condW    = (conditionalCount / totalAgents) * barW;
      const rejectW  = (rejectCount / totalAgents) * barW;

      doc.rect(barX, doc.y, approveW, barH).fill(GREEN);
      doc.rect(barX + approveW, doc.y, condW, barH).fill(AMBER);
      doc.rect(barX + approveW + condW, doc.y, rejectW, barH).fill(RED);
      doc.y += barH + 6;

      doc.fontSize(7.5).fillColor(GREEN).font("Helvetica-Bold")
        .text(`✓ ${approveCount} Approve`, barX, doc.y, { continued: true, width: 90 });
      doc.fillColor(AMBER)
        .text(`◐ ${conditionalCount} Conditional`, barX + 90, doc.y, { continued: true, width: 110 });
      doc.fillColor(RED)
        .text(`✗ ${rejectCount} Reject`, barX + 200, doc.y, { continued: true, width: 80 });
      doc.fillColor(MUTED)
        .text(`${totalAgents} agents`, barX + 280, doc.y, { width: 80, align: "right" });
      doc.y += 18;
    }

    // Confidence badge
    doc.rect(ML + 20, doc.y, 120, 22).fill(BG3).stroke(BORDER_C);
    doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
      .text(`${report.overallConfidence.toUpperCase()} CONFIDENCE`, ML + 20, doc.y + 6, { width: 120, align: "center" });
    doc.y += 32;

    // Thin rule
    doc.rect(ML + 60, doc.y, BODY_W - 120, 1).fill(BORDER_C);
    doc.y += 16;

    // Recommendation rationale
    doc.fontSize(10).fillColor(TEXT2).font("Helvetica")
      .text(report.recommendationRationale, ML + 20, doc.y, { width: BODY_W - 40, lineGap: 3, align: "justify" });
    doc.y += 24;

    // Generated at
    doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
      .text(`Generated: ${new Date(report.generatedAt).toLocaleString("en-GB")}  ·  ${totalAgents} specialist agents  ·  AgenThinkMesh Procurement Engine`,
        ML, doc.y, { width: BODY_W, align: "center" });

    pageFooter(1);

    // ── SECTION 1: TOP DECISION DRIVERS ───────────────────────────────────────

    if (!report.insufficientData && report.topDecisionDrivers?.length > 0) {
      doc.addPage();
      _pageNum++;
      pageHeader("Decision Drivers");
      doc.y = MT + 8;

      sectionDivider("01", "Top Decision Drivers", ACCENT);
      doc.y += 6;

      report.topDecisionDrivers.forEach((driver, i) => {
        numberedItem(i + 1, driver, TEXT2);
        doc.y += 2;
      });
    }

    // ── SECTION 2: CONSENSUS RATIONALE ────────────────────────────────────────

    if (!report.insufficientData && report.consensus.decisionRationale) {
      ensureSpace(80);
      sectionDivider("02", "Consensus Rationale", ACCENT);
      doc.y += 6;
      bodyText(report.consensus.decisionRationale);
    }

    // ── SECTION 3: RISK SUMMARY ────────────────────────────────────────────────

    if (!report.insufficientData && (report.topRisks?.length > 0 || report.consensus.highestRiskAreas?.length > 0)) {
      ensureSpace(60);
      sectionDivider("03", "Risk Summary", RED);
      doc.y += 6;

      if (report.topRisks?.length > 0) {
        subHeading("Top Risks Identified", RED);
        report.topRisks.forEach((r, i) => {
          numberedItem(i + 1, r, TEXT2);
          doc.y += 2;
        });
        doc.y += 6;
      }

      if (report.consensus.highestRiskAreas?.length > 0) {
        subHeading("Highest Risk Dimensions", AMBER);
        report.consensus.highestRiskAreas.forEach((area) => {
          bullet(area, TEXT2);
          doc.y += 2;
        });
        doc.y += 6;
      }

      if (report.consensus.conflictingScoringPairs?.length > 0) {
        subHeading("Conflicting Agent Scores", MUTED);
        report.consensus.conflictingScoringPairs.forEach((pair) => {
          bullet(pair, MUTED);
          doc.y += 1;
        });
        doc.y += 6;
      }
    }

    // ── SECTION 4: SPECIALIST AGENT EVALUATIONS ───────────────────────────────

    if (!report.insufficientData && report.agentScores.length > 0) {
      doc.addPage();
      _pageNum++;
      pageHeader("Agent Evaluations");
      doc.y = MT + 8;

      sectionDivider("04", "Specialist Agent Evaluations", ACCENT);
      doc.y += 6;

      const regularAgents = report.agentScores.filter((a) => a.agentId !== "devils_advocate");
      const devilsAdvocate = report.agentScores.find((a) => a.agentId === "devils_advocate");

      regularAgents.forEach((agent) => {
        ensureSpace(60);

        const agentVerdictColor =
          agent.verdict === "APPROVE"      ? GREEN :
          agent.verdict === "CONDITIONAL"  ? AMBER : RED;

        // Agent header row
        const agentRowY = doc.y;
        doc.rect(ML, agentRowY, BODY_W, 26).fill(BG3);
        doc.rect(ML, agentRowY, 3, 26).fill(agentVerdictColor);

        // Verdict badge
        doc.rect(ML + 10, agentRowY + 5, 70, 16).fill(agentVerdictColor);
        doc.fontSize(7).fillColor("#FFFFFF").font("Helvetica-Bold")
          .text(agent.verdict, ML + 10, agentRowY + 9, { width: 70, align: "center" });

        // Agent name
        doc.fontSize(9.5).fillColor(TEXT).font("Helvetica-Bold")
          .text(agent.agentName, ML + 90, agentRowY + 4, { continued: false, width: BODY_W - 180 });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(agent.agentRole, ML + 90, agentRowY + 15, { width: BODY_W - 180 });

        // Score
        doc.fontSize(14).fillColor(agentVerdictColor).font("Helvetica-Bold")
          .text(agent.score.toFixed(1), ML + BODY_W - 50, agentRowY + 4, { width: 40, align: "right" });
        doc.fontSize(7).fillColor(MUTED).font("Helvetica")
          .text(`/ 10  ${agent.confidence}`, ML + BODY_W - 50, agentRowY + 18, { width: 40, align: "right" });

        doc.y = agentRowY + 32;

        // Key reasoning
        bodyText(agent.keyReasoning);

        if (agent.positives.length > 0) {
          subHeading("Positives", GREEN);
          agent.positives.forEach((p) => bullet(p, GREEN));
          doc.y += 4;
        }

        if (agent.topRisks.length > 0) {
          subHeading("Risks", RED);
          agent.topRisks.forEach((r) => bullet(r, RED));
          doc.y += 4;
        }

        if (agent.redFlags.length > 0) {
          subHeading("Red Flags", AMBER);
          agent.redFlags.forEach((f) => bullet(f, AMBER));
          doc.y += 4;
        }

        doc.y += 8;
        doc.rect(ML, doc.y, BODY_W, 0.5).fill(BORDER_C);
        doc.y += 12;
      });

      // Devil's Advocate — separate section
      if (devilsAdvocate) {
        ensureSpace(80);
        sectionDivider("04b", "Devil's Advocate — Adversarial Challenge", RED);
        doc.y += 6;

        doc.fontSize(8).fillColor(RED).font("Helvetica-Bold")
          .text("⚠ This agent is specifically tasked with arguing for rejection. Its score is capped at 5/10 by design.",
            ML, doc.y, { width: BODY_W, lineGap: 2 });
        doc.y += 14;

        bodyText(devilsAdvocate.keyReasoning, RED);

        if (devilsAdvocate.topRisks.length > 0) {
          subHeading("Rejection Arguments", RED);
          devilsAdvocate.topRisks.forEach((r) => bullet(r, RED));
          doc.y += 4;
        }

        if (devilsAdvocate.redFlags.length > 0) {
          subHeading("Red Flags", AMBER);
          devilsAdvocate.redFlags.forEach((f) => bullet(f, AMBER));
          doc.y += 4;
        }

        doc.y += 8;
      }
    }

    // ── SECTION 5: SUGGESTED NEGOTIATION POINTS ───────────────────────────────

    if (!report.insufficientData && report.suggestedNegotiationPoints?.length > 0) {
      ensureSpace(80);
      sectionDivider("05", "Suggested Negotiation Points", TEAL);
      doc.y += 6;

      report.suggestedNegotiationPoints.forEach((point, i) => {
        numberedItem(i + 1, point, TEXT2);
        doc.y += 2;
      });
      doc.y += 8;
    }

    // ── SECTION 6: MISSING INFORMATION ────────────────────────────────────────

    if (report.missingRequiredInformation?.length > 0) {
      ensureSpace(60);
      sectionDivider("06", "Missing Information", AMBER);
      doc.y += 6;

      report.missingRequiredInformation.forEach((item) => {
        bullet(item, AMBER);
        doc.y += 2;
      });
      doc.y += 8;
    }

    // ── SECTION 7: MAJOR DISAGREEMENTS ────────────────────────────────────────

    if (!report.insufficientData && report.consensus.majorDisagreements?.length > 0) {
      ensureSpace(60);
      sectionDivider("07", "Major Disagreements Between Agents", MUTED);
      doc.y += 6;

      report.consensus.majorDisagreements.forEach((d) => {
        bullet(d, MUTED);
        doc.y += 2;
      });
      doc.y += 8;
    }

    // ── FOOTERS on all pages ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      pageFooter(range.start + i + 1);
    }

    doc.end();
  });
}

// ── CSV export helper ─────────────────────────────────────────────────────────

export function generateProcurementCsv(report: ProcurementReportInput): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows: string[][] = [];

  // Header
  rows.push(["Section", "Field", "Value"]);

  // Summary
  rows.push(["Summary", "Vendor Name", report.vendorName]);
  rows.push(["Summary", "Category", report.category]);
  rows.push(["Summary", "Final Recommendation", report.finalRecommendation]);
  rows.push(["Summary", "Overall Score", String(report.overallScore)]);
  rows.push(["Summary", "Overall Confidence", report.overallConfidence]);
  rows.push(["Summary", "Recommendation Rationale", report.recommendationRationale]);
  rows.push(["Summary", "Generated At", new Date(report.generatedAt).toISOString()]);

  // Consensus
  rows.push(["Consensus", "Approve Count", String(report.consensus.approveCount)]);
  rows.push(["Consensus", "Conditional Count", String(report.consensus.conditionalCount)]);
  rows.push(["Consensus", "Reject Count", String(report.consensus.rejectCount)]);
  rows.push(["Consensus", "Decision Rationale", report.consensus.decisionRationale]);

  // Decision drivers
  report.topDecisionDrivers?.forEach((d, i) => {
    rows.push(["Decision Drivers", `Driver ${i + 1}`, d]);
  });

  // Top risks
  report.topRisks?.forEach((r, i) => {
    rows.push(["Top Risks", `Risk ${i + 1}`, r]);
  });

  // Negotiation points
  report.suggestedNegotiationPoints?.forEach((p, i) => {
    rows.push(["Negotiation Points", `Point ${i + 1}`, p]);
  });

  // Missing information
  report.missingRequiredInformation?.forEach((m, i) => {
    rows.push(["Missing Information", `Item ${i + 1}`, m]);
  });

  // Agent scores
  report.agentScores.forEach((agent) => {
    rows.push(["Agent Evaluation", `${agent.agentName} — Verdict`, agent.verdict]);
    rows.push(["Agent Evaluation", `${agent.agentName} — Score`, String(agent.score)]);
    rows.push(["Agent Evaluation", `${agent.agentName} — Confidence`, agent.confidence]);
    rows.push(["Agent Evaluation", `${agent.agentName} — Reasoning`, agent.keyReasoning]);
    agent.topRisks.forEach((r, i) => {
      rows.push(["Agent Evaluation", `${agent.agentName} — Risk ${i + 1}`, r]);
    });
    agent.redFlags.forEach((f, i) => {
      rows.push(["Agent Evaluation", `${agent.agentName} — Red Flag ${i + 1}`, f]);
    });
  });

  return rows.map((row) => row.map(escape).join(",")).join("\n");
}
