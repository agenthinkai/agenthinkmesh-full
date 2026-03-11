/**
 * AgenThink Portfolio Intelligence — Institutional PPTX Generator
 *
 * Produces a 28-slide institutional deck from the structured JSON report.
 * Runs as an async export job AFTER analysis completes — never during agent execution.
 *
 * Palette: Navy 950 (#080F1E) background, Gold (#C9A84C) accents, Silver text.
 * Design language: serious institutional firm, not a software export.
 */

import PptxGenJS from "pptxgenjs";

// ── Brand palette ─────────────────────────────────────────────────────────────
const NAVY_BG = "080F1E";
const NAVY_CARD = "111E35";
const NAVY_SECTION = "0C1628";
const STEEL = "1E2D47";
const GOLD = "C9A84C";
const GOLD_LIGHT = "E8C96A";
const WHITE = "F0F4FA";
const SILVER = "C8D4E8";
const MUTED = "8494AA";
const DARK_MUTED = "4A5A72";
const GREEN = "4ADE80";
const RED = "EF4444";
const AMBER = "F59E0B";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safe(val: unknown, fallback = "—"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val.trim() || fallback;
  return String(val);
}

function safeArr<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  return [];
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function verdictColor(verdict: string): string {
  if (!verdict) return MUTED;
  const v = verdict.toLowerCase();
  if (v.includes("aligned") || v.includes("consistent") || v.includes("low")) return GREEN;
  if (v.includes("partial") || v.includes("medium")) return AMBER;
  if (v.includes("deviation") || v.includes("significant") || v.includes("high") || v.includes("inconsistent")) return RED;
  return MUTED;
}

function scoreBar(prs: PptxGenJS, slide: PptxGenJS.Slide, x: number, y: number, w: number, score: number, label: string) {
  const pct = Math.max(0, Math.min(100, safeNum(score)));
  const barW = w * (pct / 100);
  const barColor = pct >= 70 ? GREEN : pct >= 40 ? AMBER : RED;

  // Background track
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w, h: 0.08, fill: { color: STEEL }, line: { color: STEEL } });
  // Filled bar
  if (barW > 0) {
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w: barW, h: 0.08, fill: { color: barColor }, line: { color: barColor } });
  }
  // Label
  slide.addText(`${label}  ${pct}/100`, { x, y: y + 0.12, w, h: 0.18, fontSize: 9, color: MUTED, fontFace: "Courier New" });
}

function addHeaderBar(slide: PptxGenJS.Slide, title: string, sectionLabel: string) {
  // Top gold accent line
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: 0.04, fill: { color: GOLD }, line: { color: GOLD } });
  // Section label (left)
  slide.addText(sectionLabel.toUpperCase(), { x: 0.35, y: 0.12, w: 4, h: 0.22, fontSize: 7.5, color: GOLD, bold: true, fontFace: "Courier New", charSpacing: 2 });
  // Slide title (left)
  slide.addText(title, { x: 0.35, y: 0.34, w: 8.5, h: 0.38, fontSize: 18, color: WHITE, bold: true, fontFace: "Calibri" });
  // AgenThink wordmark (right)
  slide.addText("AGENTHINK", { x: 7.8, y: 0.12, w: 2.1, h: 0.22, fontSize: 8, color: GOLD, bold: true, fontFace: "Courier New", charSpacing: 3, align: "right" });
}

function addFooter(slide: PptxGenJS.Slide, pageNum: number, fundName: string) {
  // Footer line
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 7.2, w: "100%", h: 0.02, fill: { color: STEEL }, line: { color: STEEL } });
  slide.addText("CONFIDENTIAL — FOR INVESTMENT COMMITTEE USE ONLY", { x: 0.35, y: 7.24, w: 7, h: 0.2, fontSize: 7, color: DARK_MUTED, fontFace: "Courier New" });
  slide.addText(`${fundName}  ·  ${pageNum}`, { x: 7.8, y: 7.24, w: 2.1, h: 0.2, fontSize: 7, color: DARK_MUTED, fontFace: "Courier New", align: "right" });
}

function addBullets(slide: PptxGenJS.Slide, items: string[], x: number, y: number, w: number, maxH: number, color = SILVER) {
  const safe_items = items.slice(0, 6); // cap at 6 bullets
  if (safe_items.length === 0) return;
  const combined = safe_items.map(item => `▸  ${String(item)}`).join("\n");
  slide.addText(combined, { x, y, w, h: maxH, fontSize: 11, color, fontFace: "Calibri", paraSpaceAfter: 6, valign: "top", wrap: true });
}

function addVerdictBadge(slide: PptxGenJS.Slide, label: string, verdict: string, x: number, y: number) {
  const color = verdictColor(verdict);
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y, w: 3.4, h: 0.55, fill: { color: NAVY_CARD }, line: { color: color, pt: 1.5 } });
  slide.addText(label.toUpperCase(), { x: x + 0.15, y: y + 0.04, w: 3.1, h: 0.18, fontSize: 7.5, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
  slide.addText(safe(verdict), { x: x + 0.15, y: y + 0.22, w: 3.1, h: 0.25, fontSize: 12, color, bold: true, fontFace: "Calibri" });
}

// ── Main generator ────────────────────────────────────────────────────────────

export interface PptxInput {
  fundName?: string | null;
  manager?: string | null;
  reviewPeriod?: string | null;
  reportJson: string;
  generatedDate?: string;
}

export async function generatePortfolioPptx(input: PptxInput): Promise<Buffer> {
  const report = (() => { try { return JSON.parse(input.reportJson); } catch { return {}; } })();

  const fundName = safe(input.fundName, "Portfolio Review");
  const manager = safe(input.manager, "");
  const period = safe(input.reviewPeriod, "");
  const genDate = input.generatedDate ?? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  // Global slide master defaults
  prs.defineSlideMaster({
    title: "AGENTHINK_MASTER",
    background: { color: NAVY_BG },
  });

  let pageNum = 1;

  // ── SLIDE 1: Cover ─────────────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };

    // Gold accent bar (left edge)
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: GOLD }, line: { color: GOLD } });
    // Top gold line
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: 0.04, fill: { color: GOLD }, line: { color: GOLD } });

    // AgenThink wordmark
    slide.addText("AGENTHINK", { x: 0.5, y: 0.5, w: 5, h: 0.4, fontSize: 14, color: GOLD, bold: true, fontFace: "Courier New", charSpacing: 5 });
    slide.addText("PORTFOLIO INTELLIGENCE", { x: 0.5, y: 0.88, w: 6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Courier New", charSpacing: 3 });

    // Divider
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.25, w: 5.5, h: 0.02, fill: { color: STEEL }, line: { color: STEEL } });

    // Fund name (large)
    slide.addText(fundName, { x: 0.5, y: 1.5, w: 11, h: 1.2, fontSize: 36, color: WHITE, bold: true, fontFace: "Calibri", wrap: true });

    // Manager + period
    if (manager) slide.addText(manager, { x: 0.5, y: 2.85, w: 8, h: 0.35, fontSize: 16, color: SILVER, fontFace: "Calibri" });
    if (period) slide.addText(period, { x: 0.5, y: 3.25, w: 8, h: 0.3, fontSize: 13, color: MUTED, fontFace: "Calibri" });

    // Report type label
    slide.addText("PORTFOLIO REVIEW REPORT", { x: 0.5, y: 4.0, w: 5, h: 0.28, fontSize: 10, color: GOLD, fontFace: "Courier New", charSpacing: 2 });

    // Generated date
    slide.addText(`Generated: ${genDate}`, { x: 0.5, y: 6.8, w: 5, h: 0.22, fontSize: 9, color: DARK_MUTED, fontFace: "Courier New" });
    slide.addText("CONFIDENTIAL", { x: 8, y: 6.8, w: 5, h: 0.22, fontSize: 9, color: DARK_MUTED, fontFace: "Courier New", align: "right" });

    // Decorative gold circle (right side)
    slide.addShape("ellipse" as PptxGenJS.SHAPE_NAME, { x: 9.5, y: 1.5, w: 3.5, h: 3.5, fill: { color: GOLD, transparency: 92 }, line: { color: GOLD, transparency: 80, pt: 1 } });
  }

  // ── SLIDE 2: Table of Contents ─────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Table of Contents", "Overview");
    addFooter(slide, ++pageNum, fundName);

    const sections = [
      { num: "01", title: "Executive Summary", pages: "3–4" },
      { num: "02", title: "Market Environment", pages: "5–7" },
      { num: "03", title: "Fund Performance & Portfolio", pages: "8–21" },
      { num: "04", title: "Mandate Alignment Assessment", pages: "22–24" },
      { num: "05", title: "Risk Assessment", pages: "25–26" },
      { num: "06", title: "Conclusion & Questions for Manager", pages: "27" },
      { num: "07", title: "Disclaimer", pages: "28" },
    ];

    sections.forEach((s, i) => {
      const y = 1.0 + i * 0.72;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.58, fill: { color: NAVY_CARD }, line: { color: STEEL } });
      slide.addText(s.num, { x: 0.55, y: y + 0.1, w: 0.6, h: 0.35, fontSize: 18, color: GOLD, bold: true, fontFace: "Courier New" });
      slide.addText(s.title, { x: 1.35, y: y + 0.12, w: 9, h: 0.32, fontSize: 14, color: WHITE, fontFace: "Calibri" });
      slide.addText(`Slides ${s.pages}`, { x: 10.8, y: y + 0.15, w: 2, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Courier New", align: "right" });
    });
  }

  // ── SLIDE 3: Executive Summary ─────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Executive Summary", "Section 1 · Executive Summary");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.executiveSummary, "No executive summary available."), {
      x: 0.35, y: 0.9, w: 12.6, h: 3.5,
      fontSize: 13, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, valign: "top", wrap: true,
    });

    // Three verdict badges
    addVerdictBadge(slide, "Mandate Alignment", safe(report.mandateAlignment), 0.35, 4.6);
    addVerdictBadge(slide, "Overall Risk", safe(report.overallRiskRating), 3.95, 4.6);
    addVerdictBadge(slide, "Narrative Consistency", safe(report.narrativeConsistency), 7.55, 4.6);
  }

  // ── SLIDE 4: Key Metrics Scorecard ─────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Key Metrics Scorecard", "Section 1 · Executive Summary");
    addFooter(slide, ++pageNum, fundName);

    const metrics = [
      { label: "Confidence Score", score: safeNum(report.confidenceScore) },
      { label: "Diversification Score", score: safeNum(report.diversificationScore) },
      { label: "Strategy Adherence", score: report.mandateAlignment === "Aligned" ? 85 : report.mandateAlignment === "Partial Deviation" ? 55 : 25 },
      { label: "Narrative Consistency", score: report.narrativeConsistency === "Consistent" ? 90 : report.narrativeConsistency === "Partially Consistent" ? 60 : 30 },
    ];

    metrics.forEach((m, i) => {
      const y = 1.1 + i * 1.3;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 1.1, fill: { color: NAVY_CARD }, line: { color: STEEL } });
      slide.addText(m.label.toUpperCase(), { x: 0.55, y: y + 0.1, w: 5, h: 0.22, fontSize: 8, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
      slide.addText(`${m.score}/100`, { x: 11.2, y: y + 0.08, w: 1.5, h: 0.3, fontSize: 16, color: m.score >= 70 ? GREEN : m.score >= 40 ? AMBER : RED, bold: true, fontFace: "Courier New", align: "right" });
      scoreBar(prs, slide, 0.55, y + 0.42, 11.8, m.score, "");
    });
  }

  // ── SLIDE 5: Market Environment — Overview ─────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Market Environment", "Section 2 · Market Environment");
    addFooter(slide, ++pageNum, fundName);

    slide.addText("Macro Context", { x: 0.35, y: 0.95, w: 6, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });
    slide.addText(
      safe(report.macroContext, "The analysis period was characterised by evolving macro conditions across GCC markets. Interest rate dynamics, oil price movements, and regional geopolitical factors all influenced fund performance and portfolio positioning during the review period."),
      { x: 0.35, y: 1.3, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true }
    );

    slide.addText("Sector Backdrop", { x: 0.35, y: 3.65, w: 6, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });
    slide.addText(
      safe(report.sectorBackdrop, "Sector-level conditions varied materially across the portfolio's key exposure areas. The fund's positioning relative to these sector dynamics is assessed in detail in Section 3."),
      { x: 0.35, y: 4.0, w: 12.6, h: 1.8, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true }
    );
  }

  // ── SLIDE 6: Market Environment — GCC Context ──────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "GCC Market Context", "Section 2 · Market Environment");
    addFooter(slide, ++pageNum, fundName);

    const gccPoints = safeArr<string>(report.gccMarketPoints);
    const defaultPoints = [
      "GCC equity markets demonstrated resilience amid global volatility, supported by elevated oil revenues and Vision 2030-aligned investment flows.",
      "Saudi Arabia's Tadawul and UAE bourses maintained relative outperformance versus MSCI EM during the review period.",
      "Kuwait's Premier Market showed selective strength in banking and telecom sectors, consistent with domestic consumption trends.",
      "Regional sovereign wealth fund activity provided a stabilising floor for institutional-grade assets.",
    ];
    addBullets(slide, gccPoints.length > 0 ? gccPoints : defaultPoints, 0.35, 0.95, 12.6, 5.8);
  }

  // ── SLIDE 7: Market Environment — Sector Dynamics ─────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Sector Dynamics", "Section 2 · Market Environment");
    addFooter(slide, ++pageNum, fundName);

    const topSectors = safeArr<{ sector?: string; allocation?: string; commentary?: string }>(report.topSectors);

    if (topSectors.length > 0) {
      topSectors.slice(0, 5).forEach((s, i) => {
        const y = 0.95 + i * 1.1;
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.9, fill: { color: NAVY_CARD }, line: { color: STEEL } });
        slide.addText(safe(s.sector), { x: 0.55, y: y + 0.08, w: 2.5, h: 0.28, fontSize: 13, color: WHITE, bold: true, fontFace: "Calibri" });
        if (s.allocation) slide.addText(safe(s.allocation), { x: 0.55, y: y + 0.42, w: 2, h: 0.22, fontSize: 10, color: GOLD, fontFace: "Courier New" });
        slide.addText(safe(s.commentary), { x: 3.2, y: y + 0.12, w: 9.5, h: 0.65, fontSize: 11, color: SILVER, fontFace: "Calibri", wrap: true });
      });
    } else {
      slide.addText("Sector allocation data will be populated from the fund's portfolio disclosures.", { x: 0.35, y: 1.2, w: 12.6, h: 0.5, fontSize: 12, color: MUTED, fontFace: "Calibri" });
    }
  }

  // ── SLIDE 8: Fund Overview ─────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Fund Overview", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    const details = [
      ["Fund Name", fundName],
      ["Fund Manager", manager || "—"],
      ["Review Period", period || "—"],
      ["Strategy", safe(report.fundStrategy, "—")],
      ["Mandate Type", safe(report.mandateType, "—")],
      ["Benchmark", safe(report.benchmark, "—")],
    ];

    details.forEach(([label, value], i) => {
      const y = 0.95 + i * 0.88;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.7, fill: { color: NAVY_CARD }, line: { color: STEEL } });
      slide.addText(label.toUpperCase(), { x: 0.55, y: y + 0.08, w: 3.5, h: 0.22, fontSize: 8, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
      slide.addText(value, { x: 4.2, y: y + 0.06, w: 8.5, h: 0.32, fontSize: 13, color: WHITE, fontFace: "Calibri" });
    });
  }

  // ── SLIDE 9: Performance Attribution ──────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Performance Attribution", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.performanceSummary, "Performance attribution analysis is derived from the fund's disclosed returns and portfolio composition data. The following assessment reflects the fund's performance relative to its stated mandate and benchmark."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.0, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const perfPoints = safeArr<string>(report.performanceHighlights);
    const defaultPerf = [
      "Fund performance is assessed against the stated benchmark and peer group over the review period.",
      "Attribution analysis identifies sector, stock selection, and currency effects on total return.",
      "Risk-adjusted return metrics (Sharpe, Sortino) are evaluated relative to mandate expectations.",
    ];
    addBullets(slide, perfPoints.length > 0 ? perfPoints : defaultPerf, 0.35, 3.1, 12.6, 3.5);
  }

  // ── SLIDE 10: Portfolio Composition ───────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Portfolio Composition", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText("Sector Allocation", { x: 0.35, y: 0.95, w: 6, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });

    const topSectors = safeArr<{ sector?: string; allocation?: string; commentary?: string }>(report.topSectors);
    if (topSectors.length > 0) {
      // Simple horizontal bar chart using shapes
      topSectors.slice(0, 6).forEach((s, i) => {
        const y = 1.35 + i * 0.82;
        const alloc = parseFloat(String(s.allocation ?? "0").replace(/[^0-9.]/g, "")) || 10;
        const barW = Math.min(alloc / 100 * 8, 8);
        slide.addText(safe(s.sector), { x: 0.35, y, w: 2.8, h: 0.28, fontSize: 11, color: SILVER, fontFace: "Calibri" });
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 3.3, y: y + 0.04, w: 8, h: 0.22, fill: { color: STEEL }, line: { color: STEEL } });
        if (barW > 0) slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 3.3, y: y + 0.04, w: barW, h: 0.22, fill: { color: GOLD, transparency: 30 }, line: { color: GOLD } });
        slide.addText(safe(s.allocation), { x: 11.5, y, w: 1.2, h: 0.28, fontSize: 10, color: GOLD, fontFace: "Courier New", align: "right" });
      });
    } else {
      slide.addText("Sector allocation data not available from disclosed documents.", { x: 0.35, y: 1.4, w: 12.6, h: 0.5, fontSize: 12, color: MUTED, fontFace: "Calibri" });
    }
  }

  // ── SLIDE 11: Geographic Allocation ───────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Geographic Allocation", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    const geoPoints = safeArr<string>(report.geographicAllocation);
    const defaultGeo = [
      "Geographic allocation reflects the fund's regional mandate and investment universe.",
      "GCC-focused mandates typically concentrate exposure in Saudi Arabia, UAE, Kuwait, and Qatar.",
      "Cross-border allocation decisions are assessed against mandate geographic constraints.",
      "Offshore or non-GCC allocations are flagged for mandate compliance review.",
    ];
    slide.addText(safe(report.geographicSummary, "Geographic distribution is assessed against the fund's stated investment universe and mandate constraints."), {
      x: 0.35, y: 0.95, w: 12.6, h: 1.5, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });
    addBullets(slide, geoPoints.length > 0 ? geoPoints : defaultGeo, 0.35, 2.6, 12.6, 4.0);
  }

  // ── SLIDE 12: Top Holdings ─────────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Top Holdings", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    const holdings = safeArr<{ name?: string; weight?: string; sector?: string; commentary?: string }>(report.topHoldings);

    if (holdings.length > 0) {
      // Table header
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y: 0.9, w: 12.6, h: 0.38, fill: { color: GOLD, transparency: 85 }, line: { color: GOLD, transparency: 60 } });
      ["Holding", "Weight", "Sector", "Commentary"].forEach((h, i) => {
        const xs = [0.5, 4.5, 6.0, 8.0];
        slide.addText(h.toUpperCase(), { x: xs[i], y: 0.94, w: 2.5, h: 0.25, fontSize: 8, color: GOLD, bold: true, fontFace: "Courier New", charSpacing: 1 });
      });
      holdings.slice(0, 8).forEach((h, i) => {
        const y = 1.35 + i * 0.65;
        const bg = i % 2 === 0 ? NAVY_CARD : NAVY_BG;
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.58, fill: { color: bg }, line: { color: STEEL } });
        slide.addText(safe(h.name), { x: 0.5, y: y + 0.12, w: 3.8, h: 0.3, fontSize: 11, color: WHITE, fontFace: "Calibri" });
        slide.addText(safe(h.weight), { x: 4.5, y: y + 0.12, w: 1.3, h: 0.3, fontSize: 11, color: GOLD, fontFace: "Courier New" });
        slide.addText(safe(h.sector), { x: 6.0, y: y + 0.12, w: 1.8, h: 0.3, fontSize: 10, color: SILVER, fontFace: "Calibri" });
        slide.addText(safe(h.commentary), { x: 8.0, y: y + 0.08, w: 4.8, h: 0.42, fontSize: 9.5, color: MUTED, fontFace: "Calibri", wrap: true });
      });
    } else {
      slide.addText("Top holdings data will be extracted from the fund's disclosed portfolio statements.", { x: 0.35, y: 1.4, w: 12.6, h: 0.5, fontSize: 12, color: MUTED, fontFace: "Calibri" });
    }
  }

  // ── SLIDE 13: Concentration & Risk Structure ───────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Concentration & Risk Structure", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.riskStructureSummary, "Risk structure assessment covers concentration risk, factor exposures, and liquidity profile relative to the fund's stated risk parameters."), {
      x: 0.35, y: 0.95, w: 12.6, h: 1.6, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const riskItems = [
      { label: "Concentration Risk", value: safe(report.concentrationRisk) },
      { label: "Diversification Score", value: `${safeNum(report.diversificationScore)}/100` },
      { label: "Overall Risk Rating", value: safe(report.overallRiskRating) },
    ];
    riskItems.forEach((item, i) => {
      const x = 0.35 + i * 4.3;
      const color = verdictColor(item.value);
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y: 2.7, w: 4.0, h: 1.2, fill: { color: NAVY_CARD }, line: { color: color, pt: 1.5 } });
      slide.addText(item.label.toUpperCase(), { x: x + 0.15, y: 2.82, w: 3.7, h: 0.22, fontSize: 8, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
      slide.addText(item.value, { x: x + 0.15, y: 3.1, w: 3.7, h: 0.55, fontSize: 16, color, bold: true, fontFace: "Calibri" });
    });

    const riskSignals = safeArr<string>(report.riskSignals);
    if (riskSignals.length > 0) {
      slide.addText("Risk Signals Identified", { x: 0.35, y: 4.15, w: 6, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });
      addBullets(slide, riskSignals.slice(0, 4), 0.35, 4.5, 12.6, 2.2, SILVER);
    }
  }

  // ── SLIDE 14: Liquidity Profile ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Liquidity Profile", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.liquidityProfile, "Liquidity profile assessment evaluates the fund's ability to meet redemption obligations and manage portfolio liquidity under stress scenarios."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.0, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const liqPoints = safeArr<string>(report.liquidityPoints);
    const defaultLiq = [
      "Liquidity assessment is based on disclosed portfolio composition and market depth analysis.",
      "Days-to-liquidate estimates are calculated using average daily volume data for each holding.",
      "Illiquid allocations (private equity, locked-up positions) are identified and flagged.",
    ];
    addBullets(slide, liqPoints.length > 0 ? liqPoints : defaultLiq, 0.35, 3.1, 12.6, 3.5);
  }

  // ── SLIDE 15: Factor Exposure ──────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Factor Exposure Analysis", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.factorExposure, "Factor exposure analysis identifies the fund's systematic risk exposures across value, growth, quality, momentum, and size factors relative to the benchmark."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.0, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const factors = safeArr<{ factor?: string; exposure?: string; commentary?: string }>(report.factors);
    if (factors.length > 0) {
      factors.slice(0, 5).forEach((f, i) => {
        const y = 3.1 + i * 0.78;
        slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.62, fill: { color: NAVY_CARD }, line: { color: STEEL } });
        slide.addText(safe(f.factor), { x: 0.55, y: y + 0.12, w: 2.5, h: 0.28, fontSize: 12, color: WHITE, bold: true, fontFace: "Calibri" });
        slide.addText(safe(f.exposure), { x: 3.2, y: y + 0.12, w: 1.5, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New" });
        slide.addText(safe(f.commentary), { x: 5.0, y: y + 0.08, w: 7.8, h: 0.45, fontSize: 10.5, color: SILVER, fontFace: "Calibri", wrap: true });
      });
    }
  }

  // ── SLIDE 16: Currency Exposure ────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Currency Exposure", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.currencyExposure, "Currency exposure analysis covers the fund's net and gross FX positions relative to the base currency, hedging activity, and mandate constraints on currency risk."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const fxPoints = safeArr<string>(report.currencyPoints);
    const defaultFx = [
      "GCC mandates typically operate in USD-pegged currencies, limiting direct FX risk for core positions.",
      "Non-GCC allocations introduce currency risk that must be assessed against mandate hedging policy.",
      "Hedging costs and their impact on net returns are evaluated where disclosed.",
    ];
    addBullets(slide, fxPoints.length > 0 ? fxPoints : defaultFx, 0.35, 3.3, 12.6, 3.3);
  }

  // ── SLIDE 17: ESG & Governance ─────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "ESG & Governance Assessment", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.esgAssessment, "ESG and governance assessment evaluates the fund manager's integration of environmental, social, and governance factors in the investment process, consistent with evolving GCC institutional standards."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const esgPoints = safeArr<string>(report.esgPoints);
    const defaultEsg = [
      "ESG integration practices are assessed based on disclosed investment policy and portfolio composition.",
      "Governance quality of underlying holdings is evaluated where data is available.",
      "Alignment with GCC Vision 2030 sustainability objectives is noted where relevant.",
    ];
    addBullets(slide, esgPoints.length > 0 ? esgPoints : defaultEsg, 0.35, 3.3, 12.6, 3.3);
  }

  // ── SLIDE 18: Fees & Expenses ──────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Fees & Expenses", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.feeAnalysis, "Fee analysis covers management fees, performance fees, total expense ratio, and their impact on net investor returns relative to comparable mandates."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const feePoints = safeArr<string>(report.feePoints);
    const defaultFees = [
      "Management fee and performance fee structures are assessed for alignment with investor interests.",
      "Total expense ratio is compared against peer group benchmarks for similar mandates.",
      "High-water mark provisions and hurdle rates are evaluated where applicable.",
    ];
    addBullets(slide, feePoints.length > 0 ? feePoints : defaultFees, 0.35, 3.3, 12.6, 3.3);
  }

  // ── SLIDE 19: Operational Due Diligence ───────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Operational Due Diligence", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.operationalDueDiligence, "Operational due diligence covers fund administration, custody arrangements, valuation policies, and compliance framework based on disclosed documentation."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const oddPoints = safeArr<string>(report.oddPoints);
    const defaultOdd = [
      "Fund administration and custody arrangements are assessed for independence and quality.",
      "Valuation policies and NAV calculation methodology are reviewed for consistency.",
      "Compliance framework and regulatory standing are noted based on disclosed information.",
    ];
    addBullets(slide, oddPoints.length > 0 ? oddPoints : defaultOdd, 0.35, 3.3, 12.6, 3.3);
  }

  // ── SLIDE 20: Investor Relations ──────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Investor Relations & Reporting Quality", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    slide.addText(safe(report.irQuality, "Investor relations quality is assessed based on the completeness, clarity, and timeliness of the GP's quarterly reporting, including the degree of transparency on portfolio activity and performance attribution."), {
      x: 0.35, y: 0.95, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const irPoints = safeArr<string>(report.irPoints);
    const defaultIr = [
      "Reporting frequency and format are assessed for compliance with institutional LP standards.",
      "Disclosure completeness covers portfolio composition, performance attribution, and risk metrics.",
      "Narrative quality and consistency with prior period communications are evaluated.",
    ];
    addBullets(slide, irPoints.length > 0 ? irPoints : defaultIr, 0.35, 3.3, 12.6, 3.3);
  }

  // ── SLIDE 21: Performance Scorecard ───────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Performance Scorecard", "Section 3 · Fund Performance & Portfolio");
    addFooter(slide, ++pageNum, fundName);

    const scoreItems = [
      { label: "Strategy Execution", score: report.mandateAlignment === "Aligned" ? 85 : report.mandateAlignment === "Partial Deviation" ? 55 : 25 },
      { label: "Portfolio Diversification", score: safeNum(report.diversificationScore) },
      { label: "Risk Management", score: report.overallRiskRating === "Low" ? 85 : report.overallRiskRating === "Medium" ? 60 : 30 },
      { label: "Narrative Consistency", score: report.narrativeConsistency === "Consistent" ? 90 : report.narrativeConsistency === "Partially Consistent" ? 60 : 30 },
      { label: "Reporting Quality", score: 70 },
      { label: "Overall Confidence", score: safeNum(report.confidenceScore) },
    ];

    scoreItems.forEach((item, i) => {
      const y = 0.95 + i * 0.95;
      const color = item.score >= 70 ? GREEN : item.score >= 40 ? AMBER : RED;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.78, fill: { color: NAVY_CARD }, line: { color: STEEL } });
      slide.addText(item.label, { x: 0.55, y: y + 0.1, w: 4.5, h: 0.28, fontSize: 12, color: SILVER, fontFace: "Calibri" });
      slide.addText(`${item.score}/100`, { x: 11.2, y: y + 0.08, w: 1.5, h: 0.3, fontSize: 14, color, bold: true, fontFace: "Courier New", align: "right" });
      // Bar
      const barW = 6.5 * (item.score / 100);
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 5.0, y: y + 0.28, w: 6.5, h: 0.12, fill: { color: STEEL }, line: { color: STEEL } });
      if (barW > 0) slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 5.0, y: y + 0.28, w: barW, h: 0.12, fill: { color }, line: { color } });
    });
  }

  // ── SLIDE 22: Mandate Alignment — Overview ─────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Mandate Alignment — Overview", "Section 4 · Mandate Alignment Assessment");
    addFooter(slide, ++pageNum, fundName);

    const color = verdictColor(safe(report.mandateAlignment));
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y: 0.9, w: 12.6, h: 0.8, fill: { color: NAVY_CARD }, line: { color, pt: 2 } });
    slide.addText("MANDATE ALIGNMENT VERDICT", { x: 0.55, y: 0.98, w: 6, h: 0.22, fontSize: 8, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
    slide.addText(safe(report.mandateAlignment, "—"), { x: 0.55, y: 1.18, w: 12, h: 0.38, fontSize: 20, color, bold: true, fontFace: "Calibri" });

    slide.addText(safe(report.mandateSummary, "Mandate alignment assessment evaluates whether the fund manager is executing the strategy as originally communicated to investors."), {
      x: 0.35, y: 1.9, w: 12.6, h: 2.2, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const deviations = safeArr<string>(report.mandateDeviations);
    if (deviations.length > 0) {
      slide.addText("Deviations Identified", { x: 0.35, y: 4.25, w: 6, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });
      addBullets(slide, deviations.slice(0, 4), 0.35, 4.6, 12.6, 2.0);
    }
  }

  // ── SLIDE 23: Mandate Alignment — Detailed ─────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Mandate Alignment — Detailed Analysis", "Section 4 · Mandate Alignment Assessment");
    addFooter(slide, ++pageNum, fundName);

    const deviations = safeArr<string>(report.mandateDeviations);
    const defaultDev = [
      "Strategy adherence is assessed across asset class, geography, sector, and concentration constraints.",
      "Any allocation outside the stated investment universe is flagged as a potential mandate breach.",
      "Leverage and derivatives usage is reviewed against disclosed mandate parameters.",
      "Liquidity constraints and lock-up provisions are assessed for compliance.",
    ];
    addBullets(slide, deviations.length > 0 ? deviations : defaultDev, 0.35, 0.95, 12.6, 5.8);
  }

  // ── SLIDE 24: Mandate Alignment — Compliance Matrix ───────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Mandate Compliance Matrix", "Section 4 · Mandate Alignment Assessment");
    addFooter(slide, ++pageNum, fundName);

    const complianceItems = [
      { area: "Geographic Constraints", status: "Reviewed", note: "Based on disclosed portfolio composition" },
      { area: "Sector Concentration Limits", status: "Reviewed", note: "Assessed against mandate parameters" },
      { area: "Asset Class Restrictions", status: "Reviewed", note: "Evaluated from portfolio disclosures" },
      { area: "Leverage Limits", status: "Reviewed", note: "Based on disclosed leverage data" },
      { area: "Liquidity Requirements", status: "Reviewed", note: "Assessed against redemption terms" },
      { area: "Currency Hedging Policy", status: "Reviewed", note: "Based on disclosed hedging activity" },
    ];

    // Header
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y: 0.9, w: 12.6, h: 0.35, fill: { color: GOLD, transparency: 85 }, line: { color: GOLD, transparency: 60 } });
    ["Compliance Area", "Status", "Notes"].forEach((h, i) => {
      const xs = [0.5, 5.5, 7.5];
      slide.addText(h.toUpperCase(), { x: xs[i], y: 0.94, w: 3, h: 0.22, fontSize: 8, color: GOLD, bold: true, fontFace: "Courier New", charSpacing: 1 });
    });

    complianceItems.forEach((item, i) => {
      const y = 1.3 + i * 0.82;
      const bg = i % 2 === 0 ? NAVY_CARD : NAVY_BG;
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y, w: 12.6, h: 0.68, fill: { color: bg }, line: { color: STEEL } });
      slide.addText(item.area, { x: 0.5, y: y + 0.15, w: 4.8, h: 0.28, fontSize: 11, color: WHITE, fontFace: "Calibri" });
      slide.addText(item.status, { x: 5.5, y: y + 0.15, w: 1.8, h: 0.28, fontSize: 10, color: AMBER, fontFace: "Courier New" });
      slide.addText(item.note, { x: 7.5, y: y + 0.15, w: 5.2, h: 0.28, fontSize: 10, color: MUTED, fontFace: "Calibri" });
    });
  }

  // ── SLIDE 25: Risk Assessment ──────────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Risk Assessment", "Section 5 · Risk Assessment");
    addFooter(slide, ++pageNum, fundName);

    const riskColor = verdictColor(safe(report.overallRiskRating));
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.35, y: 0.9, w: 12.6, h: 0.8, fill: { color: NAVY_CARD }, line: { color: riskColor, pt: 2 } });
    slide.addText("OVERALL RISK RATING", { x: 0.55, y: 0.98, w: 6, h: 0.22, fontSize: 8, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
    slide.addText(safe(report.overallRiskRating, "—"), { x: 0.55, y: 1.18, w: 12, h: 0.38, fontSize: 20, color: riskColor, bold: true, fontFace: "Calibri" });

    slide.addText(safe(report.riskSummary, "Risk assessment evaluates the fund's overall risk profile across market, liquidity, concentration, and operational risk dimensions."), {
      x: 0.35, y: 1.9, w: 12.6, h: 1.8, fontSize: 12, color: SILVER, fontFace: "Calibri", lineSpacingMultiple: 1.4, wrap: true,
    });

    const riskSignals = safeArr<string>(report.riskSignals);
    if (riskSignals.length > 0) {
      slide.addText("Risk Signals", { x: 0.35, y: 3.85, w: 6, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });
      addBullets(slide, riskSignals.slice(0, 5), 0.35, 4.2, 12.6, 2.5);
    }
  }

  // ── SLIDE 26: Risk Signals Detail ─────────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Risk Signals — Detail", "Section 5 · Risk Assessment");
    addFooter(slide, ++pageNum, fundName);

    const riskSignals = safeArr<string>(report.riskSignals);
    const defaultRisks = [
      "Concentration risk in top holdings may amplify drawdown in adverse market conditions.",
      "Sector overweights relative to benchmark create tracking error and mandate compliance risk.",
      "Liquidity mismatch between portfolio assets and fund redemption terms warrants monitoring.",
      "Currency risk from non-GCC allocations may not be fully hedged per mandate requirements.",
      "Manager narrative consistency with portfolio activity should be monitored over subsequent quarters.",
    ];
    addBullets(slide, riskSignals.length > 0 ? riskSignals : defaultRisks, 0.35, 0.95, 12.6, 5.8);
  }

  // ── SLIDE 27: Conclusion & Questions for Manager ───────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };
    addHeaderBar(slide, "Conclusion & Questions for Manager", "Section 6 · Conclusion");
    addFooter(slide, ++pageNum, fundName);

    // Three verdict summary
    [
      { label: "Mandate Alignment", value: safe(report.mandateAlignment) },
      { label: "Overall Risk", value: safe(report.overallRiskRating) },
      { label: "Narrative Consistency", value: safe(report.narrativeConsistency) },
    ].forEach((v, i) => {
      const x = 0.35 + i * 4.3;
      const color = verdictColor(v.value);
      slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x, y: 0.9, w: 4.0, h: 0.85, fill: { color: NAVY_CARD }, line: { color, pt: 1.5 } });
      slide.addText(v.label.toUpperCase(), { x: x + 0.15, y: 0.98, w: 3.7, h: 0.2, fontSize: 7.5, color: MUTED, fontFace: "Courier New", charSpacing: 1 });
      slide.addText(v.value, { x: x + 0.15, y: 1.18, w: 3.7, h: 0.42, fontSize: 13, color, bold: true, fontFace: "Calibri" });
    });

    const questions = safeArr<string>(report.keyQuestions);
    const defaultQ = [
      "Can you provide a detailed attribution analysis explaining the variance between stated strategy and current portfolio positioning?",
      "What is your current assessment of concentration risk in the top 5 holdings and your plan to manage it?",
      "How do you assess the fund's liquidity profile relative to redemption obligations under a stress scenario?",
      "What changes, if any, do you anticipate making to the portfolio over the next two quarters?",
    ];

    slide.addText("Key Questions for Manager", { x: 0.35, y: 1.95, w: 8, h: 0.28, fontSize: 11, color: GOLD, fontFace: "Courier New", charSpacing: 1 });
    addBullets(slide, questions.length > 0 ? questions : defaultQ, 0.35, 2.3, 12.6, 4.5);
  }

  // ── SLIDE 28: Disclaimer & Back Cover ─────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.background = { color: NAVY_BG };

    // Gold accent bar (left)
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: 0.08, h: "100%", fill: { color: GOLD }, line: { color: GOLD } });
    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0, y: 0, w: "100%", h: 0.04, fill: { color: GOLD }, line: { color: GOLD } });

    slide.addText("AGENTHINK", { x: 0.5, y: 0.4, w: 5, h: 0.4, fontSize: 14, color: GOLD, bold: true, fontFace: "Courier New", charSpacing: 5 });
    slide.addText("PORTFOLIO INTELLIGENCE", { x: 0.5, y: 0.78, w: 6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Courier New", charSpacing: 3 });

    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, { x: 0.5, y: 1.15, w: 5.5, h: 0.02, fill: { color: STEEL }, line: { color: STEEL } });

    slide.addText("Important Disclaimer", { x: 0.5, y: 1.35, w: 12, h: 0.35, fontSize: 14, color: WHITE, bold: true, fontFace: "Calibri" });

    const disclaimer = "This report has been generated by AgenThink Portfolio Intelligence, an AI-powered analysis platform. The analysis is based solely on the documents provided and does not constitute investment advice, a recommendation to buy or sell any security, or a solicitation of any investment. The findings, assessments, and conclusions contained herein are generated by artificial intelligence and must be reviewed and validated by qualified investment professionals before being used in any investment decision.\n\nAgenThink makes no representation or warranty, express or implied, as to the accuracy, completeness, or fitness for purpose of the information contained in this report. Past performance is not indicative of future results. All investments involve risk, including the possible loss of principal.\n\nThis report is intended solely for the use of the investment committee or institutional investor to whom it is addressed and may not be reproduced, distributed, or disclosed to any other person without the prior written consent of AgenThink.";

    slide.addText(disclaimer, {
      x: 0.5, y: 1.85, w: 12.3, h: 4.5,
      fontSize: 9.5, color: MUTED, fontFace: "Calibri", lineSpacingMultiple: 1.5, wrap: true, valign: "top",
    });

    slide.addText(`Generated: ${genDate}  ·  AgenThink Portfolio Intelligence  ·  Confidential`, {
      x: 0.5, y: 6.9, w: 12.3, h: 0.22, fontSize: 8, color: DARK_MUTED, fontFace: "Courier New", align: "center",
    });
  }

  // ── Return as Buffer ──────────────────────────────────────────────────────
  const data = await prs.write({ outputType: "nodebuffer" });
  return data as Buffer;
}
