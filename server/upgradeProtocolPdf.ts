/**
 * upgradeProtocolPdf.ts — Institutional Investment Readiness Report Generator
 *
 * Sovereign IC / top-tier strategy consulting quality.
 * 13 sections across 5 pages:
 *
 * Page 1: Executive Summary · KPI Strip · Core Thesis Breakers · Investment Readiness Score · Fastest Path to Investability
 * Page 2: Critical Missing Inputs · Structural Weaknesses · Severity Matrix
 * Page 3: Performance Gaps · Market & Scalability · Investor Fit Analysis
 * Page 4: Risk Mitigation · Governance Concerns · Capital Readiness
 * Page 5: Narrative Improvements · Re-run Summary · Expected Upgraded Outcome
 * Appendix: Full Issue Log
 */
import https from "https";
import http from "http";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpgradeFixInput {
  id: string;
  category: string;
  title: string;
  description: string;
  suggestion: string;
  tag: "ASSUMED" | "IMPROVED" | "USER_REQUIRED";
  fieldPath?: string;
  exampleValue?: string;
}

export interface UpgradeProtocolInput {
  dealName: string;
  verdictBefore: string;
  confidenceBefore: number;
  missingInputs: UpgradeFixInput[];
  performanceGaps: UpgradeFixInput[];
  structuralIssues: UpgradeFixInput[];
  narrativeFix: { original: string; improved: string; rationale: string };
  riskMitigationActions: UpgradeFixInput[];
  expectedOutcomeShift: { predictedVerdict: string; confidenceDelta: number; rationale: string };
  allFixes: UpgradeFixInput[];
  delta?: {
    verdictBefore: string;
    verdictAfter: string;
    verdictChanged: boolean;
    confidenceBefore: number;
    confidenceAfter: number;
    confidenceDelta: number;
    keyMetricChanges: Array<{ metric: string; before: string; after: string; direction: "improved" | "unchanged" | "worsened" }>;
    topImprovementFactors: string[];
    remainingGaps: string[];
    summary: string;
  };
  generatedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const LOGO_CDN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663268376562/7EnctkaNppkKLbjFfnH6YY/agenthink-logo_f76cbf68.png";

/** Sanitize text: remove control chars, normalize whitespace, strip bad precision. */
function sanitize(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\t/g, "  ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Fix ugly floating-point precision: +0.05899999999999994% → +5.9%
    .replace(/([+-]?\d+\.\d{4,})%/g, (_, n) => {
      const v = parseFloat(n);
      if (!isFinite(v)) return "0%";
      return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
    })
    // Remove raw NaN/Infinity/undefined/null
    .replace(/\b(NaN|Infinity|-Infinity|undefined|null)\b/g, "—")
    .trim();
}

/** Safe number: clamp NaN/Infinity to 0, round to given decimals. */
function safeNum(v: unknown, decimals = 1): number {
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.\-]/g, "")) : Number(v);
  if (!isFinite(n)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/** Format a percentage cleanly: 0.059 → "+5.9%" */
function fmtPct(v: number, showSign = false): string {
  const safe = safeNum(v, 1);
  if (showSign && safe > 0) return `+${safe}%`;
  return `${safe}%`;
}

function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    APPROVED: "APPROVED",
    APPROVE: "APPROVED",
    APPROVED_WITH_CONDITIONS: "APPROVED WITH CONDITIONS",
    CONDITIONAL_APPROVAL: "CONDITIONAL APPROVAL",
    CONDITIONAL: "CONDITIONAL APPROVAL",
    REJECTED: "REJECTED",
    REJECT: "REJECTED",
    VETOED: "VETOED",
    INSUFFICIENT_DATA: "INSUFFICIENT DATA",
  };
  return map[v?.toUpperCase?.()] ?? (v?.toUpperCase?.() ?? "—");
}

/** Map tag → severity label */
function severityLabel(tag: string): string {
  const map: Record<string, string> = {
    USER_REQUIRED: "CRITICAL",
    ASSUMED: "HIGH",
    IMPROVED: "MEDIUM",
  };
  return map[tag] ?? "LOW";
}

/** Map tag → severity color */
function severityColor(tag: string): string {
  const map: Record<string, string> = {
    USER_REQUIRED: "#C0392B",  // red
    ASSUMED:       "#D4860A",  // amber
    IMPROVED:      "#1A6FBF",  // blue
  };
  return map[tag] ?? "#555555"; // gray
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    missing_input: "Missing Input",
    performance_gap: "Performance Gap",
    structural_issue: "Structural Issue",
    narrative: "Narrative",
    risk_mitigation: "Risk Mitigation",
  };
  return map[cat] ?? cat;
}

/** Compute a 0–100 readiness score from the fix list */
function computeReadinessScore(input: UpgradeProtocolInput): {
  overall: number;
  team: number;
  market: number;
  financials: number;
  defensibility: number;
  governance: number;
  scalability: number;
} {
  const total = Math.max(input.allFixes.length, 1);
  const critical = input.allFixes.filter(f => f.tag === "USER_REQUIRED").length;
  const high = input.allFixes.filter(f => f.tag === "ASSUMED").length;
  const penalty = Math.min(critical * 8 + high * 3, 65);
  const base = Math.max(100 - penalty, 15);

  // Distribute sub-scores based on fix categories
  const byCategory = (cats: string[]) => {
    const n = input.allFixes.filter(f => cats.includes(f.category)).length;
    return Math.max(100 - n * 12, 10);
  };

  return {
    overall: safeNum(base, 0),
    team: safeNum(byCategory(["structural_issue"]), 0),
    market: safeNum(byCategory(["performance_gap"]), 0),
    financials: safeNum(byCategory(["missing_input"]), 0),
    defensibility: safeNum(byCategory(["structural_issue", "risk_mitigation"]), 0),
    governance: safeNum(byCategory(["risk_mitigation"]), 0),
    scalability: safeNum(byCategory(["performance_gap", "structural_issue"]), 0),
  };
}

/** Derive investor fit from the deal profile */
function deriveInvestorFit(input: UpgradeProtocolInput): { fit: string; rationale: string } {
  const critical = input.allFixes.filter(f => f.tag === "USER_REQUIRED").length;
  const structural = input.structuralIssues.length;
  const verdict = verdictLabel(input.verdictBefore);

  if (verdict.includes("VETOED") || critical >= 6) {
    return { fit: "REJECT ENTIRELY", rationale: "Deal has critical structural blockers that preclude institutional capital at this stage." };
  }
  if (structural >= 4 || critical >= 4) {
    return { fit: "FAMILY OFFICE / ANGEL", rationale: "Risk profile and governance maturity are below institutional thresholds. Better suited to patient, flexible capital." };
  }
  if (verdict.includes("CONDITIONAL") && critical <= 2) {
    return { fit: "STRATEGIC INVESTOR / CORPORATE VC", rationale: "Deal has strategic merit but requires operational support. A strategic partner with domain expertise would add more value than pure financial capital." };
  }
  if (input.performanceGaps.length >= 3) {
    return { fit: "VENTURE CAPITAL (EARLY STAGE)", rationale: "Performance metrics are pre-institutional but the thesis is directionally sound. VC with operational support is the appropriate capital type." };
  }
  return { fit: "PRIVATE EQUITY / GROWTH EQUITY", rationale: "Deal has institutional-grade fundamentals with identifiable improvement levers. PE or growth equity is the appropriate capital type." };
}

/** Derive capital readiness assessment */
function deriveCapitalReadiness(input: UpgradeProtocolInput): string {
  const critical = input.allFixes.filter(f => f.tag === "USER_REQUIRED").length;
  const missing = input.missingInputs.length;

  if (critical >= 5 || missing >= 4) {
    return "Company is too early for institutional capital. Critical data gaps and structural blockers must be resolved before approaching institutional LPs or IC committees.";
  }
  if (critical >= 3) {
    return "Company is approaching capital readiness but has unresolved blockers. Raising now risks a down-round or onerous terms. Address critical fixes first.";
  }
  if (input.performanceGaps.length >= 3) {
    return "Company may be over-raising relative to current traction. Benchmarks suggest a smaller bridge round to prove key metrics before a full institutional raise.";
  }
  return "Company is broadly capital-ready subject to resolving the high-priority fixes identified in this report. Institutional capital is achievable within 60–90 days of remediation.";
}

/** Get top 3 thesis breakers */
function getThesisBreakers(input: UpgradeProtocolInput): string[] {
  const critical = input.allFixes.filter(f => f.tag === "USER_REQUIRED").slice(0, 3);
  if (critical.length > 0) return critical.map(f => f.title);
  const high = input.allFixes.filter(f => f.tag === "ASSUMED").slice(0, 3);
  return high.map(f => f.title);
}

/** Get fastest path fixes (top 3–5 by impact) */
function getFastestPath(input: UpgradeProtocolInput): UpgradeFixInput[] {
  const critical = input.allFixes.filter(f => f.tag === "USER_REQUIRED");
  const high = input.allFixes.filter(f => f.tag === "ASSUMED");
  return [...critical.slice(0, 3), ...high.slice(0, 2)].slice(0, 5);
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateUpgradeProtocolPdf(input: UpgradeProtocolInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: `Investment Readiness Report — ${input.dealName}`,
      Author: "AgenThinkMesh Decision Engine",
      Subject: "Institutional Investment Readiness Report",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const W = 595.28;
  const CONTENT_W = W - 112;
  const L = 56;

  // ── Palette ────────────────────────────────────────────────────────────────
  const BLACK   = "#0D1117";
  const WHITE   = "#FFFFFF";
  const NAVY    = "#0F2744";
  const NAVY_LT = "#1A3C5E";
  const GOLD    = "#C9A84C";
  const RED     = "#C0392B";
  const RED_LT  = "#FDECEA";
  const AMBER   = "#D4860A";
  const AMBER_LT= "#FFF8E7";
  const BLUE    = "#1A6FBF";
  const BLUE_LT = "#EBF4FF";
  const GREEN   = "#1E7E34";
  const GREEN_LT= "#E8F5E9";
  const GRAY    = "#4A5568";
  const LGRAY   = "#718096";
  const BGLIGHT = "#F7F9FC";
  const BORDER  = "#CBD5E0";
  const DIVIDER = "#E2E8F0";

  // ── Derived data ──────────────────────────────────────────────────────────
  const scores = computeReadinessScore(input);
  const investorFit = deriveInvestorFit(input);
  const capitalReadiness = deriveCapitalReadiness(input);
  const thesisBreakers = getThesisBreakers(input);
  const fastestPath = getFastestPath(input);
  const confDelta = safeNum(input.expectedOutcomeShift.confidenceDelta, 1);
  const criticalCount = input.allFixes.filter(f => f.tag === "USER_REQUIRED").length;
  const highestRiskArea = input.allFixes.filter(f => f.tag === "USER_REQUIRED")[0]?.category
    ?? input.allFixes[0]?.category ?? "—";

  // ── Page helpers ──────────────────────────────────────────────────────────

  function newPage() {
    doc.addPage();
    // Header rule
    doc.moveTo(L, 38).lineTo(W - L, 38).lineWidth(0.4).strokeColor(DIVIDER).stroke();
    doc.fontSize(6.5).fillColor(LGRAY).font("Helvetica")
      .text(
        `AGENTHINK MESH  ·  INVESTMENT READINESS REPORT  ·  ${sanitize(input.dealName).toUpperCase()}`,
        L, 26, { width: CONTENT_W, align: "left" }
      );
    doc.y = 52;
  }

  function ensureSpace(needed: number) {
    if (doc.y + needed > 780) newPage();
  }

  function rule(color = DIVIDER, weight = 0.4) {
    doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(weight).strokeColor(color).stroke();
  }

  function sectionHeader(title: string, pageBreak = false) {
    if (pageBreak || doc.y > 660) newPage();
    else { doc.moveDown(0.9); }
    rule(NAVY_LT, 0.6);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(NAVY).font("Helvetica-Bold")
      .text(sanitize(title).toUpperCase(), L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.4);
  }

  function subHead(text: string) {
    ensureSpace(20);
    doc.fontSize(8.5).fillColor(NAVY_LT).font("Helvetica-Bold")
      .text(sanitize(text).toUpperCase(), L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.25);
  }

  function body(text: string, indent = 0) {
    const t = sanitize(text);
    if (!t) return;
    ensureSpace(14);
    doc.fontSize(8.5).fillColor(BLACK).font("Helvetica")
      .text(t, L + indent, doc.y, { width: CONTENT_W - indent, lineGap: 1.5 });
    doc.moveDown(0.3);
  }

  function bullet(text: string, indent = 8) {
    const t = sanitize(text);
    if (!t) return;
    ensureSpace(14);
    doc.fontSize(8.5).fillColor(BLACK).font("Helvetica")
      .text(`•  ${t}`, L + indent, doc.y, { width: CONTENT_W - indent, lineGap: 1.5 });
    doc.moveDown(0.2);
  }

  function labelVal(label: string, value: string, indent = 0) {
    ensureSpace(14);
    const lw = 130;
    const rowY = doc.y;
    // Fixed-position rendering — no continued:true to prevent text clubbing
    doc.fontSize(8).fillColor(GRAY).font("Helvetica-Bold")
      .text(sanitize(label) + ":", L + indent, rowY, { width: lw, lineBreak: false });
    doc.fontSize(8).fillColor(BLACK).font("Helvetica")
      .text("  " + sanitize(value || "\u2014"), L + indent + lw, rowY, { width: CONTENT_W - indent - lw, lineBreak: true });
    doc.moveDown(0.2);
  }

  /** Severity pill */
  function severityPill(tag: string, x: number, y: number) {
    const lbl = severityLabel(tag);
    const col = severityColor(tag);
    const bgMap: Record<string, string> = {
      CRITICAL: RED_LT, HIGH: AMBER_LT, MEDIUM: BLUE_LT, LOW: BGLIGHT,
    };
    const bg = bgMap[lbl] ?? BGLIGHT;
    const pillW = 62;
    const pillH = 12;
    doc.roundedRect(x, y - 1, pillW, pillH, 2).fill(bg);
    doc.fontSize(6.5).fillColor(col).font("Helvetica-Bold")
      .text(lbl, x + 4, y + 1, { width: pillW - 8 });
  }

  /** Score bar */
  function scoreBar(label: string, score: number, y: number) {
    const barW = 120;
    const barH = 8;
    const barX = W - L - barW;
    const filled = Math.round((score / 100) * barW);
    const col = score >= 70 ? GREEN : score >= 45 ? AMBER : RED;
    doc.rect(barX, y, barW, barH).fill(DIVIDER);
    if (filled > 0) doc.rect(barX, y, filled, barH).fill(col);
    doc.fontSize(7.5).fillColor(GRAY).font("Helvetica")
      .text(sanitize(label), L, y, { width: barX - L - 8 });
    doc.fontSize(7.5).fillColor(col).font("Helvetica-Bold")
      .text(`${score}`, barX + barW + 4, y, { width: 24 });
  }

  /** Issue card — dynamic height, no continued:true chaining to prevent text overflow */
  function issueCard(fix: UpgradeFixInput, idx: number) {
    const titleText = `${idx + 1}. ${sanitize(fix.title)}`;
    const descText  = sanitize(fix.description);
    const actionText = fix.suggestion ? sanitize(fix.suggestion) : "";

    // Measure heights before drawing
    doc.fontSize(8.5).font("Helvetica-Bold");
    const titleH = doc.heightOfString(titleText, { width: CONTENT_W - 90 });
    doc.fontSize(8).font("Helvetica");
    const descH = doc.heightOfString(descText, { width: CONTENT_W - 20 });
    doc.fontSize(7.5).font("Helvetica");
    const actionH = actionText ? doc.heightOfString(actionText, { width: CONTENT_W - 80 }) : 0;

    const innerH = 8 + titleH + 4 + descH + (actionText ? 4 + 10 + actionH + 4 : 0) + 8;
    const cardH  = Math.max(innerH, 52);

    ensureSpace(cardH + 8);
    const cardY = doc.y;

    // Left severity stripe
    const stripeCol = severityColor(fix.tag);
    doc.rect(L, cardY, 3, cardH).fill(stripeCol);

    // Card background
    doc.rect(L + 3, cardY, CONTENT_W - 3, cardH).fill(BGLIGHT);

    // Title row
    const titleY = cardY + 8;
    doc.fontSize(8.5).fillColor(NAVY).font("Helvetica-Bold")
      .text(titleText, L + 10, titleY, { width: CONTENT_W - 90, lineBreak: true });
    severityPill(fix.tag, W - L - 68, titleY);

    // Description — full text, no height clipping
    const descY = titleY + titleH + 4;
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(descText, L + 10, descY, { width: CONTENT_W - 20, lineBreak: true });
    // Use doc.y after rendering (not pre-calculated descH) to get actual rendered position
    const afterDescY = doc.y;

    // ACTION label + suggestion on separate lines to avoid continued:true overflow
    if (actionText) {
      const actionLabelY = afterDescY + 4;
      doc.fontSize(7.5).fillColor(BLUE).font("Helvetica-Bold")
        .text("ACTION:", L + 10, actionLabelY, { width: CONTENT_W - 20, lineBreak: false });
      const actionTextY = actionLabelY + 11;
      doc.fontSize(7.5).fillColor(BLACK).font("Helvetica")
        .text(actionText, L + 10, actionTextY, { width: CONTENT_W - 20, lineBreak: true });
    }

    // Advance past card bottom — use whichever is lower: pre-calculated cardH or actual doc.y
    doc.y = Math.max(cardY + cardH, doc.y) + 4;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════════════

  // Navy header band
  doc.rect(0, 0, W, 200).fill(NAVY);

  // Logo
  try {
    const logoBuffer = await fetchBuffer(LOGO_CDN_URL);
    doc.image(logoBuffer, L, 18, { height: 30 });
  } catch {
    doc.fontSize(13).fillColor(WHITE).font("Helvetica-Bold").text("AGENTHINK MESH", L, 22);
  }

  // Report type
  doc.fontSize(7.5).fillColor(GOLD).font("Helvetica-Bold")
    .text("INSTITUTIONAL INVESTMENT READINESS REPORT", L, 68, { width: CONTENT_W, align: "center", characterSpacing: 1 });

  // Deal name
  const dealName = sanitize(input.dealName).toUpperCase();
  doc.fontSize(20).fillColor(WHITE).font("Helvetica-Bold")
    .text(dealName, L, 88, { width: CONTENT_W, align: "center" });

  // Verdict badge
  const vLabel = verdictLabel(input.verdictBefore);
  const vColor = vLabel.includes("REJECTED") || vLabel.includes("VETOED") ? RED
    : vLabel.includes("CONDITIONAL") ? AMBER : GREEN;
  doc.fontSize(10).fillColor(vColor).font("Helvetica-Bold")
    .text(`CURRENT VERDICT: ${vLabel}`, L, 148, { width: CONTENT_W, align: "center" });

  // Meta strip
  doc.rect(0, 200, W, 32).fill("#EEF2F7");
  const genDate = sanitize(input.generatedAt ?? new Date().toISOString().split("T")[0]);
  doc.fontSize(7.5).fillColor(GRAY).font("Helvetica")
    .text(
      `Generated: ${genDate}   ·   Confidence: ${safeNum(input.confidenceBefore, 0)}%   ·   Fixes Identified: ${input.allFixes.length}   ·   Critical: ${criticalCount}   ·   AgenThinkMesh Decision Engine`,
      L, 212, { width: CONTENT_W, align: "center" }
    );

  doc.y = 248;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Executive Summary · KPI Strip · Core Thesis Breakers · Readiness Score · Fastest Path
  // ══════════════════════════════════════════════════════════════════════════

  // ── Executive Summary ─────────────────────────────────────────────────────
  sectionHeader("Executive Summary");

  // KPI tile strip (6 tiles)
  const tileW = Math.floor(CONTENT_W / 3) - 4;
  const tileH = 44;
  const tileY = doc.y;
  const kpis = [
    { label: "Current Verdict",    value: vLabel,                                color: vColor },
    { label: "Fixes Required",     value: `${input.allFixes.length} (${criticalCount} critical)`,    color: criticalCount > 3 ? RED : AMBER },
    { label: "Confidence Shift",   value: `${confDelta >= 0 ? "+" : ""}${confDelta}%`, color: confDelta >= 0 ? GREEN : RED },
    { label: "Critical Issues",    value: `${criticalCount}`,                    color: criticalCount > 3 ? RED : AMBER },
    { label: "Highest-Risk Area",  value: categoryLabel(highestRiskArea),        color: AMBER },
    { label: "Readiness Score",    value: `${scores.overall}/100`,               color: scores.overall >= 60 ? GREEN : scores.overall >= 35 ? AMBER : RED },
  ];
  kpis.forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const tx = L + col * (tileW + 4);
    const ty = tileY + row * (tileH + 4);
    doc.rect(tx, ty, tileW, tileH).fill(BGLIGHT);
    doc.moveTo(tx, ty).lineTo(tx + tileW, ty).lineWidth(2).strokeColor(kpi.color).stroke();
    doc.fontSize(6.5).fillColor(LGRAY).font("Helvetica")
      .text(kpi.label.toUpperCase(), tx + 6, ty + 6, { width: tileW - 12 });
    doc.fontSize(9.5).fillColor(kpi.color).font("Helvetica-Bold")
      .text(sanitize(kpi.value), tx + 6, ty + 18, { width: tileW - 12, height: 20, ellipsis: true });
  });
  doc.y = tileY + 2 * (tileH + 4) + 8;

  // Why this deal failed
  if (input.expectedOutcomeShift.rationale) {
    body(sanitize(input.expectedOutcomeShift.rationale));
  }

  // ── Core Thesis Breakers ──────────────────────────────────────────────────
  sectionHeader("Core Investment Thesis Breakers");
  body("The following issues represent the primary reasons this deal currently fails institutional screening:");
  thesisBreakers.forEach((t, i) => bullet(`${i + 1}. ${sanitize(t)}`));

  // ── Investment Readiness Score ────────────────────────────────────────────
  sectionHeader("Investment Readiness Score");
  body(`Overall readiness: ${scores.overall}/100. Scores below 50 indicate material blockers that preclude institutional capital.`);
  doc.moveDown(0.3);
  const scoreRows = [
    ["Team & Execution",  scores.team],
    ["Market & Scalability", scores.market],
    ["Financials",        scores.financials],
    ["Defensibility",     scores.defensibility],
    ["Governance",        scores.governance],
    ["Scalability",       scores.scalability],
  ] as [string, number][];
  const scoreStartY = doc.y;
  scoreRows.forEach((row, i) => {
    scoreBar(row[0], row[1], scoreStartY + i * 16);
  });
  doc.y = scoreStartY + scoreRows.length * 16 + 8;

  // ── Fastest Path to Investability ────────────────────────────────────────
  sectionHeader("Fastest Path to Investability");
  body("Applying the following changes would most improve approval probability:");
  fastestPath.forEach((fix, i) => {
    ensureSpace(20);
    const fpY = doc.y;
    // Title at fixed position — no continued:true to prevent text clubbing after severityPill
    doc.fontSize(8.5).fillColor(NAVY).font("Helvetica-Bold")
      .text(`${i + 1}. ${sanitize(fix.title)}`, L + 8, fpY, { width: CONTENT_W - 80, lineBreak: false });
    severityPill(fix.tag, W - L - 68, fpY - 1);
    doc.y = fpY + 14;
    body(sanitize(fix.suggestion || fix.description), 16);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Critical Missing Inputs · Structural Weaknesses · Severity Matrix
  // ══════════════════════════════════════════════════════════════════════════

  // ── Critical Missing Inputs ───────────────────────────────────────────────
  if (input.missingInputs.length > 0) {
    sectionHeader("Critical Missing Inputs", true);
    body(`${input.missingInputs.length} missing input${input.missingInputs.length !== 1 ? "s" : ""} identified. The Council could not evaluate these dimensions due to absent evidence.`);
    doc.moveDown(0.3);
    input.missingInputs.forEach((fix, i) => issueCard(fix, i));
  }

  // ── Structural Weaknesses ─────────────────────────────────────────────────
  if (input.structuralIssues.length > 0) {
    sectionHeader("Structural Weaknesses");
    body(`${input.structuralIssues.length} structural issue${input.structuralIssues.length !== 1 ? "s" : ""} identified. These include moat, governance, funding, execution, and commercial model concerns.`);
    doc.moveDown(0.3);
    input.structuralIssues.forEach((fix, i) => issueCard(fix, i));
  }

  // ── Severity Matrix ───────────────────────────────────────────────────────
  sectionHeader("Severity Matrix");
  const matrixData = [
    { sev: "CRITICAL", col: RED,   bg: RED_LT,   count: input.allFixes.filter(f => f.tag === "USER_REQUIRED").length, desc: "Immediate action required. Blocks institutional approval." },
    { sev: "HIGH",     col: AMBER, bg: AMBER_LT, count: input.allFixes.filter(f => f.tag === "ASSUMED").length,       desc: "Significant risk. Address before IC presentation." },
    { sev: "MEDIUM",   col: BLUE,  bg: BLUE_LT,  count: input.allFixes.filter(f => f.tag === "IMPROVED").length,      desc: "Improvement opportunity. Strengthens investment thesis." },
  ];
  matrixData.forEach(row => {
    ensureSpace(22);
    const rowY = doc.y;
    doc.rect(L, rowY, CONTENT_W, 18).fill(row.bg);
    doc.rect(L, rowY, 4, 18).fill(row.col);
    doc.fontSize(7.5).fillColor(row.col).font("Helvetica-Bold")
      .text(row.sev, L + 10, rowY + 5, { width: 60 });
    doc.fontSize(7.5).fillColor(GRAY).font("Helvetica")
      .text(`${row.count} issue${row.count !== 1 ? "s" : ""}  —  ${row.desc}`, L + 75, rowY + 5, { width: CONTENT_W - 85 });
    doc.y = rowY + 22;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Performance Gaps · Market & Scalability · Investor Fit Analysis
  // ══════════════════════════════════════════════════════════════════════════

  // ── Performance Gaps ──────────────────────────────────────────────────────
  if (input.performanceGaps.length > 0) {
    sectionHeader("Performance Gaps", true);
    body(`${input.performanceGaps.length} performance gap${input.performanceGaps.length !== 1 ? "s" : ""} identified. Metrics fall below institutional benchmarks in the following areas:`);
    doc.moveDown(0.3);
    input.performanceGaps.forEach((fix, i) => issueCard(fix, i));
  } else {
    sectionHeader("Performance Gaps", true);
    body("No performance gaps identified. Deal metrics meet or exceed institutional benchmarks.");
  }

  // ── Investor Fit Analysis ─────────────────────────────────────────────────
  sectionHeader("Investor Fit Analysis");
  ensureSpace(50);
  const fitCol = investorFit.fit.includes("REJECT") ? RED
    : investorFit.fit.includes("FAMILY") ? AMBER
    : investorFit.fit.includes("VENTURE") ? BLUE : GREEN;
  // Measure rationale height before drawing the box
  doc.fontSize(8).font("Helvetica");
  const fitRationaleH = doc.heightOfString(sanitize(investorFit.rationale), { width: CONTENT_W - 16 });
  const fitBoxH = Math.max(14 + 12 + fitRationaleH + 10, 44);
  ensureSpace(fitBoxH + 8);
  const fitY = doc.y;
  doc.rect(L, fitY, CONTENT_W, fitBoxH).fill(BGLIGHT);
  doc.moveTo(L, fitY).lineTo(L + CONTENT_W, fitY).lineWidth(2).strokeColor(fitCol).stroke();
  doc.fontSize(9).fillColor(fitCol).font("Helvetica-Bold")
    .text(sanitize(investorFit.fit), L + 8, fitY + 8, { width: CONTENT_W - 16, lineBreak: false });
  doc.fontSize(8).fillColor(GRAY).font("Helvetica")
    .text(sanitize(investorFit.rationale), L + 8, fitY + 24, { width: CONTENT_W - 16, lineBreak: true });
  doc.y = fitY + fitBoxH + 6;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 4 — Risk Mitigation · Governance Concerns · Capital Readiness
  // ══════════════════════════════════════════════════════════════════════════

  // ── Risk Mitigation Requirements ─────────────────────────────────────────
  if (input.riskMitigationActions.length > 0) {
    sectionHeader("Risk Mitigation Requirements", true);
    body(`${input.riskMitigationActions.length} risk mitigation action${input.riskMitigationActions.length !== 1 ? "s" : ""} required before investment can proceed.`);
    doc.moveDown(0.3);
    input.riskMitigationActions.forEach((fix, i) => issueCard(fix, i));
  } else {
    sectionHeader("Risk Mitigation Requirements", true);
    body("No outstanding risk mitigation actions identified at this stage.");
  }

  // ── Capital Readiness ─────────────────────────────────────────────────────
  sectionHeader("Capital Readiness");
  ensureSpace(44);
  const capY = doc.y;
  const capCritical = criticalCount;
  const capCol = capCritical >= 5 ? RED : capCritical >= 3 ? AMBER : GREEN;
  doc.rect(L, capY, CONTENT_W, 36).fill(BGLIGHT);
  doc.rect(L, capY, 4, 36).fill(capCol);
  doc.fontSize(8.5).fillColor(BLACK).font("Helvetica")
    .text(sanitize(capitalReadiness), L + 10, capY + 8, { width: CONTENT_W - 18, lineGap: 1.5 });
  doc.y = capY + 44;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 5 — Narrative Improvements · Re-run Summary · Expected Upgraded Outcome
  // ══════════════════════════════════════════════════════════════════════════

  sectionHeader("Narrative Improvements", true);
  if (sanitize(input.narrativeFix.original) || sanitize(input.narrativeFix.improved)) {
    subHead("Original Narrative");
    body(sanitize(input.narrativeFix.original) || "—");
    doc.moveDown(0.3);
    subHead("Improved Narrative");
    body(sanitize(input.narrativeFix.improved) || "—");
    if (input.narrativeFix.rationale) {
      doc.moveDown(0.2);
      subHead("Rationale");
      body(sanitize(input.narrativeFix.rationale));
    }
  } else {
    body("No narrative improvement required.");
  }

  // ── Upgrade Impact Forecast ───────────────────────────────────────────────
  sectionHeader("Upgrade Impact Forecast");
  labelVal("Predicted Verdict (All Fixes Applied)", verdictLabel(input.expectedOutcomeShift.predictedVerdict));
  labelVal("Expected Confidence Change", `${confDelta >= 0 ? "+" : ""}${confDelta}%`);
  doc.moveDown(0.3);
  if (input.expectedOutcomeShift.rationale) {
    body(sanitize(input.expectedOutcomeShift.rationale));
  }
  const blockers = input.allFixes.filter(f => f.tag === "USER_REQUIRED");
  if (blockers.length > 0) {
    doc.moveDown(0.3);
    subHead("Remaining Blockers (Action Required)");
    blockers.forEach((b, i) => bullet(`${i + 1}. ${sanitize(b.title)} — ${sanitize(b.description)}`));
  }

  // ── Re-run Summary ────────────────────────────────────────────────────────
  if (input.delta) {
    const d = input.delta;
    sectionHeader("Re-run Summary");
    body("Council re-evaluation after applying selected fixes:");
    doc.moveDown(0.2);
    labelVal("Verdict Before", verdictLabel(d.verdictBefore));
    labelVal("Verdict After", verdictLabel(d.verdictAfter));
    labelVal("Verdict Changed", d.verdictChanged ? "YES" : "NO");
    labelVal("Confidence Before", `${safeNum(d.confidenceBefore, 0)}%`);
    labelVal("Confidence After", `${safeNum(d.confidenceAfter, 0)}%`);
    labelVal("Confidence Delta", `${safeNum(d.confidenceDelta, 1) >= 0 ? "+" : ""}${safeNum(d.confidenceDelta, 1)}%`);

    if (d.keyMetricChanges.length > 0) {
      doc.moveDown(0.3);
      subHead("Key Metric Changes");
      d.keyMetricChanges.forEach(m => {
        const arrow = m.direction === "improved" ? "+" : m.direction === "worsened" ? "-" : "~";
        bullet(`[${arrow}] ${sanitize(m.metric)}: ${sanitize(m.before)} → ${sanitize(m.after)}`);
      });
    }
    if (d.topImprovementFactors.length > 0) {
      doc.moveDown(0.3);
      subHead("Top Improvement Factors");
      d.topImprovementFactors.forEach((f, i) => bullet(`${i + 1}. ${sanitize(f)}`));
    }
    if (d.remainingGaps.length > 0) {
      doc.moveDown(0.3);
      subHead("Remaining Gaps");
      d.remainingGaps.forEach((g, i) => bullet(`${i + 1}. ${sanitize(g)}`));
    }
    if (d.summary) {
      doc.moveDown(0.3);
      subHead("Summary");
      body(sanitize(d.summary));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // APPENDIX — Full Issue Log
  // ══════════════════════════════════════════════════════════════════════════

  if (input.allFixes.length > 0) {
    newPage();
    doc.fontSize(10).fillColor(NAVY).font("Helvetica-Bold")
      .text("APPENDIX — FULL ISSUE LOG", L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.4);
    rule(NAVY_LT, 0.6);
    doc.moveDown(0.4);
    body(`Complete log of all ${input.allFixes.length} identified issues, ordered by severity.`);
    doc.moveDown(0.3);

    const sorted = [...input.allFixes].sort((a, b) => {
      const order = { USER_REQUIRED: 0, ASSUMED: 1, IMPROVED: 2 };
      return (order[a.tag] ?? 3) - (order[b.tag] ?? 3);
    });
    sorted.forEach((fix, i) => issueCard(fix, i));
  }

  // ── Footer on all pages ───────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(6.5).fillColor(LGRAY).font("Helvetica")
      .text(
        `AgenThinkMesh  ·  Investment Readiness Report  ·  ${sanitize(input.dealName)}  ·  Page ${i + 1} of ${range.count}`,
        L, 826, { width: CONTENT_W, align: "center" }
      );
  }

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// ── Text Export ───────────────────────────────────────────────────────────────

export function generateUpgradeProtocolText(input: UpgradeProtocolInput): string {
  const lines: string[] = [];
  const sep  = "═".repeat(70);
  const dash = "─".repeat(70);

  const confDelta = safeNum(input.expectedOutcomeShift.confidenceDelta, 1);
  const scores = computeReadinessScore(input);
  const investorFit = deriveInvestorFit(input);
  const capitalReadiness = deriveCapitalReadiness(input);
  const thesisBreakers = getThesisBreakers(input);
  const fastestPath = getFastestPath(input);
  const criticalCount = input.allFixes.filter(f => f.tag === "USER_REQUIRED").length;

  lines.push(sep);
  lines.push("INSTITUTIONAL INVESTMENT READINESS REPORT");
  lines.push(`Deal: ${sanitize(input.dealName)}`);
  lines.push(`Generated: ${sanitize(input.generatedAt ?? new Date().toISOString().split("T")[0])}`);
  lines.push(sep);
  lines.push("");

  // 1. Executive Summary
  lines.push("1. EXECUTIVE SUMMARY");
  lines.push(dash);
  lines.push(`Current Verdict:           ${verdictLabel(input.verdictBefore)}`);
  lines.push(`Current Confidence:        ${safeNum(input.confidenceBefore, 0)}%`);
  lines.push(`Expected Upgraded Verdict: ${verdictLabel(input.expectedOutcomeShift.predictedVerdict)}`);
  lines.push(`Expected Confidence Delta: ${confDelta >= 0 ? "+" : ""}${confDelta}%`);
  lines.push(`Total Fixes Identified:    ${input.allFixes.length}`);
  lines.push(`Critical (User-Required):  ${criticalCount}`);
  lines.push(`Readiness Score:           ${scores.overall}/100`);
  if (input.expectedOutcomeShift.rationale) {
    lines.push("");
    lines.push(sanitize(input.expectedOutcomeShift.rationale));
  }
  lines.push("");

  // 2. Core Thesis Breakers
  lines.push("2. CORE INVESTMENT THESIS BREAKERS");
  lines.push(dash);
  thesisBreakers.forEach((t, i) => lines.push(`  ${i + 1}. ${sanitize(t)}`));
  lines.push("");

  // 3. Investment Readiness Score
  lines.push("3. INVESTMENT READINESS SCORE");
  lines.push(dash);
  lines.push(`  Overall:       ${scores.overall}/100`);
  lines.push(`  Team:          ${scores.team}/100`);
  lines.push(`  Market:        ${scores.market}/100`);
  lines.push(`  Financials:    ${scores.financials}/100`);
  lines.push(`  Defensibility: ${scores.defensibility}/100`);
  lines.push(`  Governance:    ${scores.governance}/100`);
  lines.push(`  Scalability:   ${scores.scalability}/100`);
  lines.push("");

  // 4. Fastest Path to Investability
  lines.push("4. FASTEST PATH TO INVESTABILITY");
  lines.push(dash);
  fastestPath.forEach((fix, i) => {
    lines.push(`  ${i + 1}. [${severityLabel(fix.tag)}] ${sanitize(fix.title)}`);
    lines.push(`     ${sanitize(fix.suggestion || fix.description)}`);
  });
  lines.push("");

  // 5. Missing Inputs
  if (input.missingInputs.length > 0) {
    lines.push("5. CRITICAL MISSING INPUTS");
    lines.push(dash);
    input.missingInputs.forEach((fix, i) => {
      lines.push(`  ${i + 1}. [${severityLabel(fix.tag)}] ${sanitize(fix.title)}`);
      lines.push(`     ${sanitize(fix.description)}`);
      if (fix.suggestion) lines.push(`     Action: ${sanitize(fix.suggestion)}`);
      lines.push("");
    });
  }

  // 6. Structural Weaknesses
  if (input.structuralIssues.length > 0) {
    lines.push("6. STRUCTURAL WEAKNESSES");
    lines.push(dash);
    input.structuralIssues.forEach((fix, i) => {
      lines.push(`  ${i + 1}. [${severityLabel(fix.tag)}] ${sanitize(fix.title)}`);
      lines.push(`     ${sanitize(fix.description)}`);
      if (fix.suggestion) lines.push(`     Action: ${sanitize(fix.suggestion)}`);
      lines.push("");
    });
  }

  // 7. Performance Gaps
  if (input.performanceGaps.length > 0) {
    lines.push("7. PERFORMANCE GAPS");
    lines.push(dash);
    input.performanceGaps.forEach((fix, i) => {
      lines.push(`  ${i + 1}. [${severityLabel(fix.tag)}] ${sanitize(fix.title)}`);
      lines.push(`     ${sanitize(fix.description)}`);
      if (fix.suggestion) lines.push(`     Action: ${sanitize(fix.suggestion)}`);
      lines.push("");
    });
  }

  // 8. Investor Fit
  lines.push("8. INVESTOR FIT ANALYSIS");
  lines.push(dash);
  lines.push(`  Fit: ${sanitize(investorFit.fit)}`);
  lines.push(`  ${sanitize(investorFit.rationale)}`);
  lines.push("");

  // 9. Risk Mitigation
  if (input.riskMitigationActions.length > 0) {
    lines.push("9. RISK MITIGATION REQUIREMENTS");
    lines.push(dash);
    input.riskMitigationActions.forEach((fix, i) => {
      lines.push(`  ${i + 1}. [${severityLabel(fix.tag)}] ${sanitize(fix.title)}`);
      lines.push(`     ${sanitize(fix.description)}`);
      if (fix.suggestion) lines.push(`     Action: ${sanitize(fix.suggestion)}`);
      lines.push("");
    });
  }

  // 10. Capital Readiness
  lines.push("10. CAPITAL READINESS");
  lines.push(dash);
  lines.push(`  ${sanitize(capitalReadiness)}`);
  lines.push("");

  // 11. Narrative Improvements
  lines.push("11. NARRATIVE IMPROVEMENTS");
  lines.push(dash);
  lines.push(`  Original: ${sanitize(input.narrativeFix.original) || "—"}`);
  lines.push(`  Improved: ${sanitize(input.narrativeFix.improved) || "—"}`);
  if (input.narrativeFix.rationale) {
    lines.push(`  Rationale: ${sanitize(input.narrativeFix.rationale)}`);
  }
  lines.push("");

  // 12. Upgrade Impact Forecast
  lines.push("12. UPGRADE IMPACT FORECAST");
  lines.push(dash);
  lines.push(`  Predicted Verdict:    ${verdictLabel(input.expectedOutcomeShift.predictedVerdict)}`);
  lines.push(`  Confidence Change:    ${confDelta >= 0 ? "+" : ""}${confDelta}%`);
  if (input.expectedOutcomeShift.rationale) {
    lines.push("");
    lines.push(`  ${sanitize(input.expectedOutcomeShift.rationale)}`);
  }
  const blockers = input.allFixes.filter(f => f.tag === "USER_REQUIRED");
  if (blockers.length > 0) {
    lines.push("");
    lines.push("  Remaining Blockers:");
    blockers.forEach((b, i) => lines.push(`    ${i + 1}. ${sanitize(b.title)} — ${sanitize(b.description)}`));
  }
  lines.push("");

  // 13. Re-run Summary
  if (input.delta) {
    const d = input.delta;
    lines.push("13. RE-RUN SUMMARY");
    lines.push(dash);
    lines.push(`  Verdict Before:    ${verdictLabel(d.verdictBefore)}`);
    lines.push(`  Verdict After:     ${verdictLabel(d.verdictAfter)}`);
    lines.push(`  Verdict Changed:   ${d.verdictChanged ? "YES" : "NO"}`);
    lines.push(`  Confidence Before: ${safeNum(d.confidenceBefore, 0)}%`);
    lines.push(`  Confidence After:  ${safeNum(d.confidenceAfter, 0)}%`);
    lines.push(`  Confidence Delta:  ${safeNum(d.confidenceDelta, 1) >= 0 ? "+" : ""}${safeNum(d.confidenceDelta, 1)}%`);
    if (d.keyMetricChanges.length > 0) {
      lines.push("");
      lines.push("  Key Metric Changes:");
      d.keyMetricChanges.forEach(m => {
        const arrow = m.direction === "improved" ? "+" : m.direction === "worsened" ? "-" : "~";
        lines.push(`    [${arrow}] ${sanitize(m.metric)}: ${sanitize(m.before)} → ${sanitize(m.after)}`);
      });
    }
    if (d.topImprovementFactors.length > 0) {
      lines.push("");
      lines.push("  Top Improvement Factors:");
      d.topImprovementFactors.forEach((f, i) => lines.push(`    ${i + 1}. ${sanitize(f)}`));
    }
    if (d.remainingGaps.length > 0) {
      lines.push("");
      lines.push("  Remaining Gaps:");
      d.remainingGaps.forEach((g, i) => lines.push(`    ${i + 1}. ${sanitize(g)}`));
    }
    if (d.summary) {
      lines.push("");
      lines.push(`  ${sanitize(d.summary)}`);
    }
    lines.push("");
  }

  lines.push(sep);
  lines.push("END OF REPORT — AgenThinkMesh Investment Readiness Engine");
  lines.push(sep);

  return lines.join("\n");
}
