/**
 * cfoDeepDivePdf.ts — Generates a CFO Deep Dive PDF from existing council vote data.
 *
 * NO additional LLM call — uses the vote data already produced by the council run.
 * Instant generation (< 1 second).
 *
 * Blank-page fix: uses `doc.on('pageAdded', ...)` to fill the navy background
 * on every page PDFKit creates (both manual addPage() and auto-overflow pages).
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PersonaVoteInput {
  personaId:   string;
  personaName: string;
  personaRole: string;
  vote:        string;
  confidence:  number;
  rationale:   string;
  keyFlags:    string[];
  conditions:  string[];
  blockers:    string[];
}

export interface CouncilSummaryInput {
  dealName:            string;
  verdict:             string;
  yesCount:            number;
  noCount:             number;
  confidenceScore:     number;
  conditionsToProceed: string[];
  blockingIssues:      string[];
  votes:               PersonaVoteInput[];
}

// ── PDF Generator ─────────────────────────────────────────────────────────────
export async function generateCfoDeepDivePdf(
  summary: CouncilSummaryInput
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const NAVY       = "#050D1A";
    const NAVY_MID   = "#0A1628";
    const NAVY_LIGHT = "#0F2040";
    const GOLD       = "#D4AF37";
    const CYAN       = "#38BDF8";
    const WHITE      = "#F0F4FA";
    const MUTED      = "#8899AA";
    const RED        = "#F87171";
    const GREEN      = "#4ADE80";
    const AMBER      = "#FBBF24";

    const A4_W   = 595.28;
    const A4_H   = 841.89;
    const ML     = 50;
    const MR     = 50;
    const BODY_W = A4_W - ML - MR;

    // KEY FIX: Use autoFirstPage:true and listen to pageAdded to fill background
    // on EVERY page (including auto-overflow pages created by PDFKit text wrapping).
    const doc = new PDFDocument({
      size: "A4",
      autoFirstPage: true,
      info: {
        Title: `CFO Deep Dive — ${summary.dealName}`,
        Author: "AgenThinkMesh · CFO Council",
        Subject: "GCC Investment Council Report",
      },
    });

    // ── Background on every page (including auto-overflow) ────────────────────
    doc.on("pageAdded", () => {
      doc.rect(0, 0, A4_W, A4_H).fill(NAVY);
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function headerBar() {
      const savedY = doc.y;
      doc.rect(0, 0, A4_W, 36).fill(NAVY_MID);
      doc.rect(0, 36, A4_W, 1).fill(GOLD);
      doc.fontSize(7).fillColor(GOLD).font("Helvetica-Bold")
        .text("AGENTHINK MESH", ML, 10, { continued: false });
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text("CFO COUNCIL · FINANCIAL DEEP DIVE", ML + 95, 10);
      const dateStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      });
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(dateStr, A4_W - MR - 60, 10, { width: 60, align: "right" });
      doc.y = savedY;
    }

    function footer(num: number) {
      doc.rect(0, A4_H - 28, A4_W, 1).fill(NAVY_LIGHT);
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(
          "CONFIDENTIAL — For Authorised Recipients Only. AI-generated analysis. Not investment advice.",
          ML, A4_H - 18, { width: BODY_W - 50 }
        );
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(`Page ${num}`, A4_W - MR - 30, A4_H - 18, { width: 30, align: "right" });
    }

    function voteColor(vote: string): string {
      if (vote === "HARD_YES") return GREEN;
      if (vote === "SOFT_YES") return CYAN;
      if (vote === "SOFT_NO")  return AMBER;
      return RED;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 1: COVER (manual layout, no text overflow)
    // ─────────────────────────────────────────────────────────────────────────
    // Fill first page background (pageAdded fires for subsequent pages only)
    doc.rect(0, 0, A4_W, A4_H).fill(NAVY);
    headerBar();

    // Gold accent bar + title
    doc.rect(ML, 60, 4, 64).fill(GOLD);
    doc.fontSize(24).fillColor(WHITE).font("Helvetica-Bold")
      .text("CFO DEEP DIVE", ML + 14, 60, { lineBreak: false });
    doc.fontSize(12).fillColor(GOLD).font("Helvetica")
      .text("Council of 10 · Financial Analysis Report", ML + 14, 92, { lineBreak: false });

    // Deal name box
    doc.rect(ML, 140, BODY_W, 52).fill(NAVY_MID);
    doc.rect(ML, 140, 3, 52).fill(CYAN);
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text("DEAL UNDER REVIEW", ML + 12, 148, { lineBreak: false });
    doc.fontSize(13).fillColor(WHITE).font("Helvetica-Bold")
      .text(summary.dealName, ML + 12, 162, { width: BODY_W - 20, lineBreak: false });

    // Verdict box
    const verdictColor = (summary.verdict === "APPROVED" || summary.verdict === "APPROVED WITH CONDITIONS") ? GREEN : RED;
    doc.rect(ML, 208, BODY_W, 44).fill(NAVY_LIGHT);
    doc.rect(ML, 208, 3, 44).fill(verdictColor);
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
      .text("COUNCIL VERDICT", ML + 12, 214, { lineBreak: false });
    doc.fontSize(13).fillColor(verdictColor).font("Helvetica-Bold")
      .text(summary.verdict, ML + 12, 228, { lineBreak: false });
    const confPct = Math.round(summary.confidenceScore * 100);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`${summary.yesCount} YES  ·  ${summary.noCount} NO  ·  ${confPct}% conf`, A4_W - MR - 160, 232, { width: 160, align: "right", lineBreak: false });

    // Sections list
    doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold")
      .text("SECTIONS IN THIS REPORT", ML, 270, { lineBreak: false });
    const sectionList = [
      "1. Council Vote Summary (all personas)",
      "2. CFO Financial Assessment",
      "3. Conditions to Proceed",
      "4. Blocking Issues",
      "5. Key Risk Flags (all personas)",
      "6. Full Persona Breakdown",
    ];
    sectionList.forEach((s, i) => {
      doc.fontSize(9).fillColor(WHITE).font("Helvetica")
        .text(`  ${s}`, ML, 284 + i * 14, { lineBreak: false });
    });

    // Disclaimer
    doc.rect(ML, A4_H - 120, BODY_W, 56).fill(NAVY_MID);
    doc.rect(ML, A4_H - 120, BODY_W, 1).fill(AMBER);
    doc.fontSize(7).fillColor(AMBER).font("Helvetica-Bold")
      .text("⚠  IMPORTANT NOTICE", ML + 8, A4_H - 112, { lineBreak: false });
    doc.fontSize(7).fillColor(MUTED).font("Helvetica")
      .text(
        "This report is generated by an AI model and is for informational purposes only. It does not constitute " +
        "investment advice, a recommendation to buy or sell any security, or a solicitation of any investment. " +
        "All projections are illustrative. Verify all figures independently before making investment decisions.",
        ML + 8, A4_H - 98, { width: BODY_W - 16, lineGap: 2 }
      );
    footer(1);

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 2+: CONTENT (uses PDFKit text flow with pageAdded background fix)
    // ─────────────────────────────────────────────────────────────────────────
    let pageNum = 2;

    // Helper: add a new page with header
    function nextPage() {
      footer(pageNum);
      doc.addPage();
      // pageAdded event already fills the background
      headerBar();
      pageNum++;
      doc.y = 52;
    }

    // Helper: section header box
    function sectionHeader(title: string) {
      if (doc.y > A4_H - 80) nextPage();
      const sy = doc.y;
      doc.rect(ML, sy, BODY_W, 22).fill(NAVY_LIGHT);
      doc.rect(ML, sy, 3, 22).fill(GOLD);
      doc.fontSize(9).fillColor(GOLD).font("Helvetica-Bold")
        .text(title.toUpperCase(), ML + 10, sy + 7, { width: BODY_W - 20, lineBreak: false });
      doc.y = sy + 28;
    }

    // Helper: body text with auto page break
    function bodyText(text: string, color = WHITE, indent = 0) {
      const clean = text.replace(/\*\*/g, "").trim();
      if (!clean) return;
      if (doc.y > A4_H - 60) nextPage();
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(clean, ML + indent, doc.y, { width: BODY_W - indent, lineGap: 1 });
      doc.y += 4;
    }

    // Helper: bullet
    function bullet(text: string, color = WHITE) {
      const clean = text.replace(/\*\*/g, "").trim();
      if (!clean) return;
      if (doc.y > A4_H - 60) nextPage();
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(`  •  ${clean}`, ML + 6, doc.y, { width: BODY_W - 12, lineGap: 1 });
      doc.y += 4;
    }

    // ── SECTION 1: Vote Summary ───────────────────────────────────────────────
    nextPage();
    sectionHeader("1. Council Vote Summary");
    doc.y += 4;

    // Vote tally bar
    const total   = summary.votes.length || 1;
    const hardYes = summary.votes.filter(v => v.vote === "HARD_YES").length;
    const softYes = summary.votes.filter(v => v.vote === "SOFT_YES").length;
    const softNo  = summary.votes.filter(v => v.vote === "SOFT_NO").length;
    const hardNo  = summary.votes.filter(v => v.vote === "HARD_NO").length;
    const tallies = [
      { label: "HARD YES", count: hardYes, color: GREEN },
      { label: "SOFT YES", count: softYes, color: CYAN },
      { label: "SOFT NO",  count: softNo,  color: AMBER },
      { label: "HARD NO",  count: hardNo,  color: RED },
    ];
    const barY = doc.y;
    let bx = ML;
    tallies.forEach(t => {
      const w = Math.round((t.count / total) * BODY_W);
      if (w > 0) {
        doc.rect(bx, barY, w, 16).fill(t.color + "44");
        doc.rect(bx, barY, w, 1).fill(t.color);
        if (w > 40) {
          doc.fontSize(7).fillColor(t.color).font("Helvetica-Bold")
            .text(`${t.label} ${t.count}`, bx + 4, barY + 4, { width: w - 6, lineBreak: false });
        }
        bx += w;
      }
    });
    doc.y = barY + 24;

    // Vote rows
    summary.votes.forEach(v => {
      if (doc.y > A4_H - 60) nextPage();
      const vc = voteColor(v.vote);
      const rowY = doc.y;
      doc.rect(ML, rowY, BODY_W, 36).fill(NAVY_MID);
      doc.rect(ML, rowY, 3, 36).fill(vc);
      doc.fontSize(8).fillColor(WHITE).font("Helvetica-Bold")
        .text(v.personaId, ML + 10, rowY + 5, { width: 100, lineBreak: false });
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(v.personaRole, ML + 10, rowY + 18, { width: 140, lineBreak: false });
      doc.fontSize(8).fillColor(vc).font("Helvetica-Bold")
        .text(v.vote.replace(/_/g, " "), ML + 155, rowY + 5, { width: 80, lineBreak: false });
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(`${Math.round(v.confidence * 100)}% conf`, ML + 155, rowY + 18, { width: 80, lineBreak: false });
      const rat = v.rationale.length > 130 ? v.rationale.slice(0, 127) + "…" : v.rationale;
      doc.fontSize(7.5).fillColor(WHITE).font("Helvetica")
        .text(rat, ML + 245, rowY + 5, { width: BODY_W - 250, lineBreak: false });
      doc.y = rowY + 40;
    });

    // ── SECTION 2: CFO Assessment ─────────────────────────────────────────────
    const cfoVote = summary.votes.find(v => v.personaId === "CFO");
    if (cfoVote) {
      if (doc.y > A4_H - 80) nextPage();
      sectionHeader("2. CFO Financial Assessment");
      doc.y += 4;

      const vc = voteColor(cfoVote.vote);
      const badgeY = doc.y;
      doc.rect(ML, badgeY, BODY_W, 28).fill(NAVY_LIGHT);
      doc.rect(ML, badgeY, 3, 28).fill(vc);
      doc.fontSize(9).fillColor(vc).font("Helvetica-Bold")
        .text(`${cfoVote.vote.replace(/_/g, " ")} — ${Math.round(cfoVote.confidence * 100)}% confidence`, ML + 10, badgeY + 4, { width: BODY_W - 20, lineBreak: false });
      doc.fontSize(8).fillColor(MUTED).font("Helvetica")
        .text(cfoVote.personaRole, ML + 10, badgeY + 16, { width: BODY_W - 20, lineBreak: false });
      doc.y = badgeY + 34;

      bodyText(cfoVote.rationale, WHITE);
      doc.y += 6;

      if (cfoVote.keyFlags.length > 0) {
        doc.fontSize(8).fillColor(AMBER).font("Helvetica-Bold")
          .text("KEY FINANCIAL FLAGS", ML, doc.y, { lineBreak: false });
        doc.y += 14;
        cfoVote.keyFlags.forEach(f => bullet(f, AMBER));
        doc.y += 4;
      }
      if (cfoVote.conditions.length > 0) {
        doc.fontSize(8).fillColor(CYAN).font("Helvetica-Bold")
          .text("CFO CONDITIONS TO PROCEED", ML, doc.y, { lineBreak: false });
        doc.y += 14;
        cfoVote.conditions.forEach(c => bullet(c, CYAN));
        doc.y += 4;
      }
      if (cfoVote.blockers.length > 0) {
        doc.fontSize(8).fillColor(RED).font("Helvetica-Bold")
          .text("CFO BLOCKERS", ML, doc.y, { lineBreak: false });
        doc.y += 14;
        cfoVote.blockers.forEach(b => bullet(b, RED));
        doc.y += 4;
      }
    }

    // ── SECTION 3: Conditions to Proceed ─────────────────────────────────────
    if (doc.y > A4_H - 80) nextPage();
    sectionHeader("3. Conditions to Proceed");
    doc.y += 4;
    if (summary.conditionsToProceed.length === 0) {
      bodyText("No conditions flagged by the council.", MUTED);
    } else {
      summary.conditionsToProceed.forEach((c, i) => {
        if (doc.y > A4_H - 60) nextPage();
        doc.fontSize(8).fillColor(CYAN).font("Helvetica-Bold")
          .text(`${i + 1}.`, ML, doc.y, { width: 16, lineBreak: false });
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(c, ML + 20, doc.y, { width: BODY_W - 22, lineGap: 1 });
        doc.y += 4;
      });
    }
    doc.y += 6;

    // ── SECTION 4: Blocking Issues ────────────────────────────────────────────
    if (doc.y > A4_H - 80) nextPage();
    sectionHeader("4. Blocking Issues");
    doc.y += 4;
    if (summary.blockingIssues.length === 0) {
      bodyText("No blocking issues flagged by the council.", MUTED);
    } else {
      summary.blockingIssues.forEach((b, i) => {
        if (doc.y > A4_H - 60) nextPage();
        doc.fontSize(8).fillColor(RED).font("Helvetica-Bold")
          .text(`${i + 1}.`, ML, doc.y, { width: 16, lineBreak: false });
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(b, ML + 20, doc.y, { width: BODY_W - 22, lineGap: 1 });
        doc.y += 4;
      });
    }
    doc.y += 6;

    // ── SECTION 5: Key Risk Flags ─────────────────────────────────────────────
    if (doc.y > A4_H - 80) nextPage();
    sectionHeader("5. Key Risk Flags — All Personas");
    doc.y += 4;
    const allFlags = summary.votes.flatMap(v => v.keyFlags.map(f => ({ flag: f, persona: v.personaId })));
    if (allFlags.length === 0) {
      bodyText("No risk flags raised.", MUTED);
    } else {
      allFlags.forEach(({ flag, persona }) => {
        if (doc.y > A4_H - 60) nextPage();
        doc.fontSize(7).fillColor(AMBER).font("Helvetica-Bold")
          .text(`[${persona}]`, ML, doc.y, { width: 62, lineBreak: false });
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(flag.replace(/\*\*/g, ""), ML + 66, doc.y, { width: BODY_W - 70, lineGap: 1 });
        doc.y += 4;
      });
    }
    doc.y += 6;

    // ── SECTION 6: Full Persona Breakdown ─────────────────────────────────────
    if (doc.y > A4_H - 80) nextPage();
    sectionHeader("6. Full Persona Breakdown");
    doc.y += 4;

    summary.votes.forEach(v => {
      if (doc.y > A4_H - 60) nextPage();
      const vc = voteColor(v.vote);
      const hdrY = doc.y;
      doc.rect(ML, hdrY, BODY_W, 24).fill(NAVY_LIGHT);
      doc.rect(ML, hdrY, 3, 24).fill(vc);
      doc.fontSize(9).fillColor(WHITE).font("Helvetica-Bold")
        .text(v.personaId, ML + 10, hdrY + 4, { width: 120, lineBreak: false });
      doc.fontSize(8).fillColor(MUTED).font("Helvetica")
        .text(v.personaRole, ML + 10, hdrY + 15, { width: 180, lineBreak: false });
      doc.fontSize(9).fillColor(vc).font("Helvetica-Bold")
        .text(`${v.vote.replace(/_/g, " ")} · ${Math.round(v.confidence * 100)}%`, ML + 200, hdrY + 8, { width: BODY_W - 210, align: "right", lineBreak: false });
      doc.y = hdrY + 28;

      bodyText(v.rationale, WHITE, 6);

      v.keyFlags.forEach(f => {
        if (doc.y > A4_H - 60) nextPage();
        doc.fontSize(8).fillColor(AMBER).font("Helvetica")
          .text(`  ⚑  ${f.replace(/\*\*/g, "")}`, ML + 6, doc.y, { width: BODY_W - 12 });
        doc.y += 2;
      });

      if (v.conditions.length > 0) {
        if (doc.y > A4_H - 60) nextPage();
        doc.fontSize(7).fillColor(CYAN).font("Helvetica-Bold")
          .text("CONDITIONS:", ML + 6, doc.y, { lineBreak: false });
        doc.y += 12;
        v.conditions.forEach(c => bullet(c, CYAN));
      }
      if (v.blockers.length > 0) {
        if (doc.y > A4_H - 60) nextPage();
        doc.fontSize(7).fillColor(RED).font("Helvetica-Bold")
          .text("BLOCKERS:", ML + 6, doc.y, { lineBreak: false });
        doc.y += 12;
        v.blockers.forEach(b => bullet(b, RED));
      }
      doc.y += 10;
    });

    footer(pageNum);
    doc.end();
  });
}
