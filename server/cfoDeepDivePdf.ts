/**
 * cfoDeepDivePdf.ts — Generates a full 7-section CFO analysis PDF
 *
 * Called on-demand when user clicks "📄 CFO Deep Dive" on the results page.
 * Uses PDFKit (already installed) with the same navy/gold design as dossierPdf.ts.
 */
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

// ── Full CFO system prompt (7-section framework) ──────────────────────────────
const CFO_DEEP_DIVE_PROMPT = `You are the CFO and Head of Financial Modelling on a GCC Investment Council.
Produce a FULL structured financial analysis in exactly 7 sections. Use specific numbers wherever possible.

GCC SECTOR BENCHMARKS:
- F&B QSR: Entry 6x-9x EBITDA, EBITDA margin 18-28%, IRR target 18-25%, hurdle 12%
- Healthcare: Entry 8x-12x EBITDA, EBITDA margin 20-30%, IRR target 15-22%, hurdle 12%
- Logistics: Entry 5x-8x EBITDA, EBITDA margin 12-20%, IRR target 20-28%, hurdle 15%
- EdTech: Entry 4x-7x ARR, EBITDA margin 15-35%, IRR target 25-35%, hurdle 18%
- Real Estate: Entry 10x-15x EBITDA, EBITDA margin 30-50%, IRR target 12-18%, hurdle 10%
- FinTech: Entry 5x-10x ARR, EBITDA margin neg to 20%, IRR target 25-40%, hurdle 20%
- Retail: Entry 4x-7x EBITDA, EBITDA margin 8-15%, IRR target 20-30%, hurdle 15%
- Industrial: Entry 5x-9x EBITDA, EBITDA margin 15-25%, IRR target 18-25%, hurdle 13%

FORMAT YOUR RESPONSE AS FOLLOWS (use these exact section headers):

## 1. VALUATION SANITY CHECK
State the implied entry multiple. Compare to GCC sector benchmark. Is it cheap, fair, or expensive?

## 2. IRR / MOIC STRESS TEST
Compute 3 scenarios:
- Base Case: [assumptions] → IRR X%, MOIC Xx
- Bull Case: [assumptions] → IRR X%, MOIC Xx  
- Bear Case: [assumptions] → IRR X%, MOIC Xx
State whether each clears the sector hurdle rate.

## 3. UNIT ECONOMICS
Per-unit/per-outlet/per-customer economics:
- Revenue per unit: KWD X
- COGS per unit: KWD X
- Gross margin: X%
- EBITDA per unit: KWD X
- Payback period: X months

## 4. CASH CONVERSION QUALITY
FCF margin estimate. Working capital dynamics. Capex intensity. Quality of earnings (recurring vs one-off).

## 5. LEVERAGE CAPACITY
Debt capacity at current EBITDA. Optimal debt/equity structure. Interest coverage ratio. Any covenant risks.

## 6. REVENUE QUALITY SCORE
Score 1-5 with rationale:
1 = Highly speculative / one-off
2 = Early traction, unproven model
3 = Moderate visibility, some recurring
4 = Strong recurring, diversified
5 = Contracted, high-visibility revenue

## 7. FINANCIAL RED FLAGS
List all financial red flags (minimum 3, maximum 8). Be specific and actionable.

Be rigorous. Use specific numbers. An LP or IC must be able to act on this analysis directly.`;

// ── Generate the full CFO analysis text ──────────────────────────────────────
export async function generateCfoDeepDiveText(dealText: string, dealName: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: CFO_DEEP_DIVE_PROMPT,
    messages: [
      {
        role: "user",
        content: `Deal: ${dealName}\n\n${dealText}\n\nProvide the full 7-section CFO analysis.`,
      },
    ],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Non-text response from CFO deep dive");
  return content.text;
}

// ── Generate PDF from the analysis text ──────────────────────────────────────
export async function generateCfoDeepDivePdf(
  dealName: string,
  analysisText: string
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 80, left: 60, right: 60 },
      info: {
        Title: `CFO Deep Dive — ${dealName}`,
        Author: "AgenThinkMesh · CFO Council",
        Subject: "GCC Investment Financial Analysis",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Design tokens ─────────────────────────────────────────────────────────
    const NAVY      = "#050D1A";
    const NAVY_MID  = "#0A1628";
    const NAVY_LIGHT = "#0F2040";
    const GOLD      = "#D4AF37";
    const GOLD_LIGHT = "#F0D060";
    const CYAN      = "#38BDF8";
    const WHITE     = "#F0F4FA";
    const MUTED     = "#8899AA";
    const RED       = "#F87171";
    const GREEN     = "#4ADE80";
    const AMBER     = "#FBBF24";
    const PAGE_W    = 595.28 - 120; // A4 width minus margins
    const PAGE_H    = 841.89;

    // ── Helpers ───────────────────────────────────────────────────────────────
    function addPageBackground() {
      doc.rect(0, 0, 595.28, PAGE_H).fill(NAVY);
    }

    function addHeaderBar() {
      doc.rect(0, 0, 595.28, 4).fill(GOLD);
      doc.rect(0, 4, 595.28, 44).fill(NAVY_MID);
      doc.fontSize(7).fillColor(GOLD).font("Helvetica-Bold")
        .text("AGENTHINK MESH", 60, 16, { continued: false });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text("CFO COUNCIL · FINANCIAL DEEP DIVE", 60, 26);
      const dateStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(dateStr, 595.28 - 120, 22, { width: 60, align: "right" });
    }

    function addFooter(pageNum: number) {
      doc.rect(0, PAGE_H - 36, 595.28, 36).fill(NAVY_MID);
      doc.rect(0, PAGE_H - 36, 595.28, 1).fill(GOLD);
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(
          "CONFIDENTIAL — For Authorised Recipients Only. This analysis is generated by AI and does not constitute investment advice.",
          60, PAGE_H - 24, { width: PAGE_W - 60, align: "left" }
        );
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(`Page ${pageNum}`, 595.28 - 80, PAGE_H - 24, { width: 40, align: "right" });
    }

    // ── Page 1: Cover ─────────────────────────────────────────────────────────
    addPageBackground();
    addHeaderBar();

    // Gold accent bar
    doc.rect(60, 80, 4, 60).fill(GOLD);

    // Title
    doc.fontSize(22).fillColor(WHITE).font("Helvetica-Bold")
      .text("CFO DEEP DIVE", 76, 82, { width: PAGE_W });
    doc.fontSize(13).fillColor(GOLD).font("Helvetica")
      .text("7-Section Financial Analysis", 76, 108, { width: PAGE_W });

    // Deal name box
    doc.rect(60, 155, PAGE_W, 50).fill(NAVY_LIGHT);
    doc.rect(60, 155, 3, 50).fill(CYAN);
    doc.fontSize(10).fillColor(MUTED).font("Helvetica")
      .text("DEAL UNDER REVIEW", 72, 163);
    doc.fontSize(14).fillColor(WHITE).font("Helvetica-Bold")
      .text(dealName, 72, 177, { width: PAGE_W - 20 });

    // Sections covered
    const sections = [
      "1. Valuation Sanity Check",
      "2. IRR / MOIC Stress Test (3 Scenarios)",
      "3. Unit Economics",
      "4. Cash Conversion Quality",
      "5. Leverage Capacity",
      "6. Revenue Quality Score",
      "7. Financial Red Flags",
    ];
    doc.fontSize(9).fillColor(GOLD).font("Helvetica-Bold")
      .text("SECTIONS COVERED", 60, 225);
    sections.forEach((s, i) => {
      doc.fontSize(9).fillColor(WHITE).font("Helvetica")
        .text(`  ${s}`, 60, 242 + i * 16);
    });

    // Disclaimer box
    doc.rect(60, PAGE_H - 160, PAGE_W, 60).fill(NAVY_MID);
    doc.rect(60, PAGE_H - 160, PAGE_W, 1).fill(AMBER);
    doc.fontSize(7).fillColor(AMBER).font("Helvetica-Bold")
      .text("⚠  IMPORTANT NOTICE", 68, PAGE_H - 152);
    doc.fontSize(7).fillColor(MUTED).font("Helvetica")
      .text(
        "This CFO analysis is generated by an AI model and is intended for informational purposes only. " +
        "It does not constitute investment advice, a recommendation to buy or sell any security, or a solicitation " +
        "of any investment. All projections are illustrative. Verify all figures independently before making " +
        "investment decisions. Past performance is not indicative of future results.",
        68, PAGE_H - 140, { width: PAGE_W - 16, lineGap: 2 }
      );

    addFooter(1);

    // ── Page 2+: Analysis ─────────────────────────────────────────────────────
    doc.addPage();
    addPageBackground();
    addHeaderBar();

    let y = 70;
    let pageNum = 2;

    // Parse sections from the analysis text
    const lines = analysisText.split("\n");

    for (const line of lines) {
      // Check if we need a new page
      if (y > PAGE_H - 120) {
        addFooter(pageNum);
        doc.addPage();
        addPageBackground();
        addHeaderBar();
        pageNum++;
        y = 70;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        y += 6;
        continue;
      }

      // Section headers (## 1. ...)
      if (trimmed.startsWith("## ")) {
        if (y > 80) y += 8;
        const headerText = trimmed.replace(/^## /, "");
        doc.rect(60, y, PAGE_W, 22).fill(NAVY_LIGHT);
        doc.rect(60, y, 3, 22).fill(GOLD);
        doc.fontSize(10).fillColor(GOLD).font("Helvetica-Bold")
          .text(headerText.toUpperCase(), 72, y + 7, { width: PAGE_W - 20 });
        y += 30;
        continue;
      }

      // Sub-headers (### or **bold**)
      if (trimmed.startsWith("### ") || (trimmed.startsWith("**") && trimmed.endsWith("**"))) {
        const subText = trimmed.replace(/^### /, "").replace(/^\*\*/, "").replace(/\*\*$/, "");
        doc.fontSize(9).fillColor(CYAN).font("Helvetica-Bold")
          .text(subText, 60, y, { width: PAGE_W });
        y += 14;
        continue;
      }

      // Bullet points
      if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        const bulletText = trimmed.replace(/^[-•] /, "");
        // Render inline bold within bullet
        const cleanText = bulletText.replace(/\*\*/g, "");
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(`  •  ${cleanText}`, 60, y, { width: PAGE_W, lineGap: 1 });
        const textHeight = doc.heightOfString(`  •  ${cleanText}`, { width: PAGE_W });
        y += textHeight + 4;
        continue;
      }

      // Numbered list items
      if (/^\d+\.\s/.test(trimmed)) {
        const cleanText = trimmed.replace(/\*\*/g, "");
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(`  ${cleanText}`, 60, y, { width: PAGE_W, lineGap: 1 });
        const textHeight = doc.heightOfString(`  ${cleanText}`, { width: PAGE_W });
        y += textHeight + 4;
        continue;
      }

      // Regular text — strip markdown bold markers
      const cleanText = trimmed.replace(/\*\*/g, "");
      if (cleanText) {
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(cleanText, 60, y, { width: PAGE_W, lineGap: 1 });
        const textHeight = doc.heightOfString(cleanText, { width: PAGE_W });
        y += textHeight + 4;
      }
    }

    addFooter(pageNum);
    doc.end();
  });
}
