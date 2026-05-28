/**
 * stressTestReportPdf.ts — AI-Governed Strategic Stress Test Report Generator
 *
 * Produces a standalone PDF from Strategic Scenario Simulation Mode output.
 *
 * Sections:
 *   COVER PAGE (traceability: deal name, mode, scenario count, run ID, timestamp, base verdict, version)
 *   A. What 10,000 Strategic Simulations Means  [explanatory box]
 *   B. How to Read This Report                  [glossary]
 *   1. Executive Summary + KPI Tiles
 *   2. Methodology
 *   3. Decision Distribution
 *   4. Structural Failure Analysis              [shown when approvePct < 5%]
 *   5. Failure Vector Ranking
 *   6. Approval Pathways                        [hidden when approvePct = 0]
 *   7. Sensitivity Analysis
 *   8. Governance Escalation Map
 *   9. Scenario Clusters
 *  10. Institutional Meaning
 *  11. Comparison to Base IC Memo
 *  12. Final Investment Interpretation
 */
import https from "https";
import http from "http";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StressTestReportInput {
  dealName: string;
  baseVerdict: string;
  mode: string;
  targetCount: number;
  completedAt: string;
  executiveSummary: string;
  decisionDistribution: {
    approvePct: number;
    conditionalPct: number;
    rejectPct: number;
    vetoPct: number;
    totalScenarios: number;
    confidenceDistribution?: { low: number; medium: number; high: number };
  };
  failureVectors: Array<{
    category: string;
    frequency: number;
    avgSeverity: number;
    affectedPct: number;
    examplePattern?: string;
  }>;
  approvalPathways: Array<{
    conditionSet: string[];
    approvalProbability: number;
    confidenceLift: number;
    remainingRisks: string[];
  }>;
  sensitivitySurface: Array<{
    variable: string;
    impactScore: number;
    direction: string;
  }>;
  governanceHeatmap: Array<{
    category: string;
    escalationCount: number;
    vetoCount: number;
    avgSeverity: number;
  }>;
  scenarioClusters?: {
    resilient: number;
    conditional: number;
    failure: number;
    catastrophic: number;
  };
  generatedAt?: string;
  /** Optional run ID for traceability on cover page */
  runId?: string;
  /** Report version string */
  reportVersion?: string;
  /**
   * Upgraded scenario fingerprint metrics.
   * When present, a "Simulation Resilience Impact" section is appended to the PDF.
   * All four fields are optional; missing values render as "Not available."
   * Omit this field entirely to suppress the section.
   */
  upgradedFingerprint?: {
    resilienceDelta?: number | null;
    upgradeEffectiveness?: number | null;
    rescueabilityScore?: number | null;
    structuralFragilityScore?: number | null;
  } | null;
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

function verdictLabel(v: string): string {
  const map: Record<string, string> = {
    APPROVED: "APPROVED", APPROVE: "APPROVED",
    APPROVED_WITH_CONDITIONS: "APPROVED WITH CONDITIONS",
    CONDITIONAL_APPROVAL: "CONDITIONAL APPROVAL",
    CONDITIONAL: "CONDITIONAL APPROVAL",
    REJECTED: "REJECTED", REJECT: "REJECTED",
    VETOED: "VETOED", INSUFFICIENT_DATA: "INSUFFICIENT DATA",
  };
  return map[v.toUpperCase()] ?? v.toUpperCase();
}

function modeLabel(mode: string): string {
  const map: Record<string, string> = {
    quick: "Mode A — Quick Stress (100 scenarios)",
    institutional: "Mode B — Institutional Stress (1,000 scenarios)",
    deep: "Mode C — Strategic Deep Stress (10,000 scenarios)",
    infrastructure: "Mode D — Infrastructure Scale (100,000 scenarios)",
    extreme: "Mode E — Extreme Scale (1,000,000 scenarios)",
  };
  return map[mode] ?? mode;
}

/** Safe percentage: clamp to 0–100, guard NaN/Infinity, format to 1 decimal. */
function pct(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "0.0%";
  return `${Math.min(100, Math.max(0, n)).toFixed(1)}%`;
}

/** Safe number: clamp NaN/Infinity to 0. */
function safeNum(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0;
  return n;
}

/** Strip unsupported glyphs — keep only ASCII + common safe Unicode. */
function sanitize(text: string): string {
  if (!text) return "";
  // Remove % followed by non-numeric (e.g. %' %^ artifacts)
  let s = text.replace(/%[^0-9.\s]/g, "%");
  // Remove zero-width and non-printable characters
  s = s.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
  // Replace em-dash variants with hyphen for safety
  s = s.replace(/[\u2013\u2014]/g, "-");
  return s;
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateStressTestReportPdf(input: StressTestReportInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    bufferPages: true,
    info: {
      Title: `Strategic Stress Test Report — ${input.dealName}`,
      Author: "AgenThinkMesh Scenario Simulation Engine",
      Subject: "Strategic Scenario Simulation",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const W = 595.28;
  const CONTENT_W = W - 112;
  const L = 56;

  // ── Palette ──────────────────────────────────────────────────────────────────
  const BLACK   = "#0A0A0A";
  const WHITE   = "#FFFFFF";
  const ACCENT  = "#1A1A2E";   // deep navy/purple — cover + section headers
  const PURPLE  = "#6B21A8";
  const TEAL    = "#0D7377";
  const RED     = "#C0392B";
  const GREEN   = "#1E7E34";
  const AMBER   = "#D4860A";
  const GRAY    = "#555555";
  const LGRAY   = "#888888";
  const BGLIGHT = "#F8F9FA";
  const BORDER  = "#D0D5DD";
  const GOLD    = "#C9A84C";
  const INFOBOX = "#EFF6FF";   // light blue for explanatory boxes
  const INFOBORDER = "#3B82F6";
  const WARNBOX = "#FFF7ED";   // amber box for structural failure
  const WARNBORDER = "#F59E0B";

  // ── Page helpers ─────────────────────────────────────────────────────────────

  function newPage() {
    doc.addPage();
    doc.moveTo(L, 40).lineTo(W - L, 40).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.fontSize(7).fillColor(LGRAY).font("Helvetica")
      .text(`AGENTHINK MESH  ·  STRATEGIC STRESS TEST REPORT  —  ${sanitize(input.dealName).toUpperCase()}`, L, 28, { width: CONTENT_W, align: "left" });
    doc.y = 56;
  }

  function ensureSpace(needed = 60) {
    if (doc.y > 842 - 56 - needed) newPage();
  }

  function sectionHeader(label: string) {
    ensureSpace(50);
    doc.moveDown(0.8);
    doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.5).strokeColor(ACCENT).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor(ACCENT).font("Helvetica-Bold")
      .text(label.toUpperCase(), L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.5);
  }

  function subHeader(text: string) {
    ensureSpace(30);
    doc.fontSize(9).fillColor(PURPLE).font("Helvetica-Bold")
      .text(sanitize(text).toUpperCase(), L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.3);
  }

  function bodyText(text: string, indent = 0) {
    const s = sanitize(text);
    if (!s) return;
    ensureSpace(20);
    doc.fontSize(9).fillColor(BLACK).font("Helvetica")
      .text(s, L + indent, doc.y, { width: CONTENT_W - indent });
    doc.moveDown(0.3);
  }

  function labelValue(label: string, value: string, indent = 0) {
    ensureSpace(18);
    const safeVal = sanitize(value) || "Not available";
    doc.fontSize(8.5).fillColor(GRAY).font("Helvetica-Bold")
      .text(label + ":", L + indent, doc.y, { continued: true, width: 140 });
    doc.fillColor(BLACK).font("Helvetica")
      .text("  " + safeVal, { width: CONTENT_W - indent - 140 });
    doc.moveDown(0.2);
  }

  /** Percentage row — fixed-position rendering to avoid continued:true text clubbing. */
  function metricRow(label: string, pctVal: number, color: string) {
    ensureSpace(20);
    const safePct = safeNum(pctVal);
    const rowY = doc.y;
    const rowH = 16;
    const barWidth = 120;
    const filled = Math.round((Math.min(100, safePct) / 100) * barWidth);

    // Label — fixed position, no continued
    doc.fontSize(8.5).fillColor(GRAY).font("Helvetica-Bold")
      .text(sanitize(label), L + 8, rowY, { width: 150, lineBreak: false });

    // Percentage value — fixed position, no continued
    const pctX = L + 8 + 152;
    doc.fontSize(8.5).fillColor(color).font("Helvetica-Bold")
      .text(pct(safePct), pctX, rowY, { width: 50, lineBreak: false });

    // Bar — drawn at fixed position
    const barX = pctX + 52;
    const barY = rowY + 3;
    const barH = 8;
    doc.rect(barX, barY, barWidth, barH).fillColor("#E5E7EB").fill();
    if (filled > 0) {
      doc.rect(barX, barY, filled, barH).fillColor(color).fill();
    }

    // Advance cursor manually — never rely on continued flush
    doc.y = rowY + rowH;
    doc.moveDown(0.2);
  }

  /** Colored info box with left border accent. */
  function infoBox(title: string, lines: string[], bgColor: string, borderColor: string) {
    // Pre-measure actual heights using PDFKit's heightOfString to avoid blank-page overflow
    const padding = 10;
    const textW = CONTENT_W - 20;
    const titleH = title
      ? (doc.fontSize(9).font("Helvetica-Bold").heightOfString(sanitize(title), { width: textW }) + 4)
      : 0;
    const linesH = lines.reduce((sum, line) => {
      const s = sanitize(line);
      if (!s) return sum + 6; // empty line gap
      return sum + doc.fontSize(8.5).font("Helvetica").heightOfString(s, { width: textW }) + 3;
    }, 0);
    const totalH = padding * 2 + titleH + linesH + 4;
    ensureSpace(totalH + 10);

    const boxY = doc.y;
    doc.rect(L, boxY, CONTENT_W, totalH).fillColor(bgColor).fill();
    doc.rect(L, boxY, 3, totalH).fillColor(borderColor).fill();

    let textY = boxY + padding;
    if (title) {
      doc.fontSize(9).fillColor(borderColor).font("Helvetica-Bold")
        .text(sanitize(title), L + 12, textY, { width: textW });
      textY += titleH;
    }
    lines.forEach(line => {
      const s = sanitize(line);
      if (!s) {
        textY += 6; // empty line gap
        return;
      }
      doc.fontSize(8.5).fillColor(BLACK).font("Helvetica")
        .text(s, L + 12, textY, { width: textW });
      textY += doc.fontSize(8.5).font("Helvetica").heightOfString(s, { width: textW }) + 3;
    });
    doc.y = boxY + totalH + 8;
    doc.moveDown(0.2);
  }

  /** KPI tile — draws a small colored card with a big number and label. */
  function kpiTile(x: number, y: number, tileW: number, tileH: number, value: string, label: string, color: string) {
    doc.rect(x, y, tileW, tileH).fillColor(BGLIGHT).fill();
    doc.rect(x, y, tileW, 3).fillColor(color).fill();
    doc.fontSize(14).fillColor(color).font("Helvetica-Bold")
      .text(sanitize(value), x + 6, y + 10, { width: tileW - 12, align: "center" });
    doc.fontSize(6.5).fillColor(LGRAY).font("Helvetica")
      .text(sanitize(label).toUpperCase(), x + 4, y + 30, { width: tileW - 8, align: "center" });
  }

  // ── Cover Page ───────────────────────────────────────────────────────────────

  // Dark header band
  doc.rect(0, 0, W, 195).fill(ACCENT);

  try {
    const logoBuffer = await fetchBuffer(LOGO_CDN_URL);
    doc.image(logoBuffer, L, 20, { height: 32 });
  } catch {
    doc.fontSize(14).fillColor(WHITE).font("Helvetica-Bold").text("AGENTHINK MESH", L, 24);
  }

  doc.fontSize(7.5).fillColor(GOLD).font("Helvetica-Bold")
    .text("AI-GOVERNED STRATEGIC STRESS TEST REPORT  ·  REPORT VERSION " + (input.reportVersion ?? "1.0"), L, 68, { width: CONTENT_W, align: "center" });

  doc.fontSize(20).fillColor(WHITE).font("Helvetica-Bold")
    .text(sanitize(input.dealName).toUpperCase(), L, 88, { width: CONTENT_W, align: "center" });

  doc.fontSize(10).fillColor(GOLD).font("Helvetica")
    .text(modeLabel(input.mode).toUpperCase(), L, 125, { width: CONTENT_W, align: "center" });

  const vLabel = verdictLabel(input.baseVerdict);
  const vColor = ["REJECTED", "VETOED"].some(x => vLabel.includes(x)) ? RED
    : vLabel.includes("CONDITIONAL") ? AMBER : GREEN;
  doc.fontSize(10).fillColor(vColor).font("Helvetica-Bold")
    .text(`BASE VERDICT: ${vLabel}`, L, 148, { width: CONTENT_W, align: "center" });

  // Traceability band
  doc.rect(0, 195, W, 48).fill("#F0F4F8");

  const completedDateStr = (() => {
    try {
      const s = typeof input.completedAt === "string" ? input.completedAt
        : (input.completedAt as unknown as Date).toISOString();
      return s.split("T")[0];
    } catch { return "Unknown"; }
  })();

  const generatedDateStr = (() => {
    try {
      const s = input.generatedAt ?? new Date().toISOString();
      return s.split("T")[0];
    } catch { return new Date().toISOString().split("T")[0]; }
  })();

  // Row 1: DEAL | MODE | SCENARIOS — fixed-position rendering to avoid mid-word wrapping
  const traceRow1Y = 203;
  // DEAL label
  doc.fontSize(7.5).fillColor(GRAY).font("Helvetica-Bold")
    .text("DEAL:", L + 8, traceRow1Y, { width: 28, lineBreak: false });
  // Deal name value
  doc.fillColor(BLACK).font("Helvetica")
    .text(sanitize(input.dealName), L + 38, traceRow1Y, { width: 130, lineBreak: false });
  // MODE label
  doc.fillColor(GRAY).font("Helvetica-Bold")
    .text("MODE:", L + 178, traceRow1Y, { width: 30, lineBreak: false });
  // Mode value
  doc.fillColor(BLACK).font("Helvetica")
    .text(sanitize(input.mode).toUpperCase(), L + 210, traceRow1Y, { width: 90, lineBreak: false });
  // SCENARIOS label
  doc.fillColor(GRAY).font("Helvetica-Bold")
    .text("SCENARIOS:", L + 308, traceRow1Y, { width: 55, lineBreak: false });
  // Scenarios value
  doc.fillColor(BLACK).font("Helvetica")
    .text(input.targetCount.toLocaleString(), L + 366, traceRow1Y, { width: 80, lineBreak: false });

  // Row 2: COMPLETED | GENERATED | RUN ID — fixed-position rendering
  const traceRow2Y = 218;
  // COMPLETED label
  doc.fontSize(7.5).fillColor(GRAY).font("Helvetica-Bold")
    .text("COMPLETED:", L + 8, traceRow2Y, { width: 55, lineBreak: false });
  doc.fillColor(BLACK).font("Helvetica")
    .text(completedDateStr, L + 66, traceRow2Y, { width: 80, lineBreak: false });
  // GENERATED label
  doc.fillColor(GRAY).font("Helvetica-Bold")
    .text("GENERATED:", L + 154, traceRow2Y, { width: 55, lineBreak: false });
  doc.fillColor(BLACK).font("Helvetica")
    .text(generatedDateStr, L + 212, traceRow2Y, { width: 80, lineBreak: false });
  // RUN ID (optional)
  if (input.runId) {
    doc.fillColor(GRAY).font("Helvetica-Bold")
      .text("RUN ID:", L + 300, traceRow2Y, { width: 38, lineBreak: false });
    doc.fillColor(BLACK).font("Helvetica")
      .text(sanitize(input.runId).slice(0, 16), L + 341, traceRow2Y, { width: 120, lineBreak: false });
  }

  doc.y = 255;

  // ── Section A: What 10,000 Strategic Simulations Means ──────────────────────

  sectionHeader("A. What 10,000 Strategic Simulations Means");
  infoBox(
    "What 10,000 Strategic Simulations Means",
    [
      "This report does not repeat the same deal screen 10,000 times. It creates 10,000 structured strategic",
      "futures by perturbing key deal assumptions — financial, regulatory, market, execution, technology, and",
      "governance conditions — then re-runs the Council of 10 decision framework against each variant. The result",
      "is a probabilistic map of how resilient or fragile the investment case is under changing real-world conditions.",
      "",
      "A 0% approval rate does not mean the model failed. It means no tested combination of realistic stresses",
      "produced an investable outcome under the current deal structure.",
    ],
    INFOBOX,
    INFOBORDER
  );

  // ── Section B: Why Simulation Scale Matters ───────────────────────────────

  newPage();
  sectionHeader("B. Why Simulation Scale Matters");

  // Conceptual framing — two-paragraph institutional explanation
  infoBox(
    "The Objective of Simulation Scale",
    [
      "The objective is not to ask the same question many times.",
      "The objective is to systematically perturb strategic assumptions and observe how",
      "institutional decision outcomes change under varying conditions.",
      "",
      "Increasing simulation scale improves: decision-surface resolution, sensitivity detection,",
      "governance pattern recognition, rare-event discovery, and institutional confidence.",
      "Each order of magnitude adds a qualitatively different category of insight.",
    ],
    INFOBOX,
    INFOBORDER
  );

  doc.moveDown(0.4);
  subHeader("Simulation Maturity Curve");
  bodyText("Each scale tier represents a different depth of institutional insight:");
  doc.moveDown(0.4);

  // ── Simulation Maturity Curve (PDFKit rect-based horizontal stepped chart) ──
  {
    // Detect current tier index (0-based)
    const currentTierIdx =
      input.targetCount >= 1000000 ? 4 :
      input.targetCount >= 100000  ? 3 :
      input.targetCount >= 10000   ? 2 :
      input.targetCount >= 1000    ? 1 : 0;

    const tiers = [
      { label: "100",     tier: "Quick Scan",          desc: "Rapid directional stress scan. Detects obvious fragility.",                                          color: "#94A3B8", height: 28 },
      { label: "1,000",   tier: "Probabilistic",        desc: "Identifies recurring risk patterns. Reveals primary failure vectors.",                               color: "#60A5FA", height: 36 },
      { label: "10,000",  tier: "Institutional",        desc: "Maps decision surfaces. Detects nonlinear interactions. Reveals governance escalation patterns.",     color: "#3B82F6", height: 44 },
      { label: "100,000", tier: "Rare-Event Detection", desc: "Exposes low-frequency, high-impact edge cases. Identifies systemic governance failure clusters.",     color: "#1D4ED8", height: 52 },
      { label: "1M",      tier: "Strategic Intelligence",desc: "Approaches continuous scenario exploration. Enables rare-event discovery. Policy-scale analysis.",  color: "#1E3A8A", height: 60 },
    ];

    const GOLD = "#D4A017";

    const chartW = CONTENT_W;
    const colW = Math.floor(chartW / tiers.length) - 4;
    const baseY = doc.y;
    const maxH = tiers[tiers.length - 1].height;
    const chartBaseY = baseY + maxH + 8; // baseline of bars

    ensureSpace(maxH + 100);

    tiers.forEach((tier, i) => {
      const x = L + i * (colW + 4);
      const barTop = chartBaseY - tier.height;
      const isActive = i === currentTierIdx;

      // Bar fill
      doc.rect(x, barTop, colW, tier.height).fillColor(tier.color).fill();

      // Gold border on active tier (drawn after fill so it overlays)
      if (isActive) {
        doc.rect(x, barTop, colW, tier.height).lineWidth(2).strokeColor(GOLD).stroke();
      }

      // Scale label (inside bar top)
      doc.fontSize(9).fillColor("#FFFFFF").font("Helvetica-Bold")
        .text(tier.label, x + 2, barTop + 4, { width: colW - 4, align: "center" });

      // YOU ARE HERE label inside active bar (bottom-aligned)
      if (isActive && tier.height >= 36) {
        doc.fontSize(6).fillColor(GOLD).font("Helvetica-Bold")
          .text("YOU ARE HERE", x + 2, barTop + tier.height - 12, { width: colW - 4, align: "center" });
      }

      // Tier label below bar
      doc.fontSize(7.5).fillColor(isActive ? GOLD : ACCENT).font("Helvetica-Bold")
        .text(tier.tier, x, chartBaseY + 4, { width: colW, align: "center" });

      // Description below tier label (2 lines max)
      doc.fontSize(6.5).fillColor(GRAY).font("Helvetica")
        .text(tier.desc, x, chartBaseY + 16, { width: colW, align: "left", lineGap: 1 });
    });

    doc.y = chartBaseY + 58;

    // Tier-specific contextual sentence
    const tierContextMsg =
      currentTierIdx === 4 ? "This run exceeds traditional IC scenario analysis by several orders of magnitude. It approaches continuous institutional scenario exploration."
      : currentTierIdx === 3 ? "This run exceeds traditional IC scenario analysis by several orders of magnitude. Rare-event detection and systemic governance failure clusters are now visible."
      : currentTierIdx === 2 ? "This run operates at institutional-grade simulation depth. Nonlinear interactions and governance escalation patterns are fully mapped."
      : currentTierIdx === 1 ? "This simulation tier enables higher confidence in downside visibility. Primary failure vectors are statistically reliable."
      : "This run provides a rapid directional stress scan. Suitable for initial screening; consider deeper simulation for institutional-grade confidence.";
    doc.moveDown(0.4);
    doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold")
      .text(sanitize(tierContextMsg), L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.3);
  }

  doc.moveDown(0.5);

  // Scale-specific insight rows
  const scaleRows: [string, string][] = [
    ["100 scenarios",       "Quick directional stress scan. Detects obvious fragility. Suitable for initial screening."],
    ["1,000 scenarios",     "Identifies recurring risk patterns. Reveals primary failure vectors. Provides meaningful probabilistic confidence."],
    ["10,000 scenarios",    "Maps institutional decision surfaces. Detects nonlinear interactions. Reveals governance escalation patterns. Identifies fragile vs resilient structures."],
    ["100,000 scenarios",   "Exposes low-frequency, high-impact edge cases. Improves statistical confidence. Identifies systemic governance failure clusters."],
    ["1,000,000 scenarios", "Approaches continuous institutional scenario exploration. Enables rare-event discovery. Supports policy-scale and sovereign-scale strategic analysis."],
  ];
  scaleRows.forEach(([scale, insight]) => {
    ensureSpace(22);
    doc.fontSize(8.5).fillColor(ACCENT).font("Helvetica-Bold")
      .text(sanitize(scale), L + 8, doc.y, { continued: true, width: 120 });
    doc.fillColor(GRAY).font("Helvetica")
      .text(`  ${sanitize(insight)}`, { width: CONTENT_W - 128 });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.3);
  infoBox(
    "Why This Run Used " + input.targetCount.toLocaleString() + " Scenarios",
    [
      `This simulation ran ${input.targetCount.toLocaleString()} scenarios (${modeLabel(input.mode)}).`,
      "",
      input.targetCount >= 1000000
        ? "At 1M scenarios, this report provides strategic intelligence infrastructure — rare-event discovery, policy-scale resilience mapping, and continuous scenario coverage."
        : input.targetCount >= 100000
        ? "At 100,000+ scenarios, this report identifies low-frequency, high-impact edge cases and systemic governance failure clusters that smaller simulations cannot detect."
        : input.targetCount >= 10000
        ? "At 10,000 scenarios, this report maps the full institutional decision surface — detecting nonlinear interactions, governance escalation patterns, and fragile vs resilient deal structures."
        : input.targetCount >= 1000
        ? "At 1,000 scenarios, this report provides meaningful probabilistic confidence and identifies primary failure vectors with statistical reliability."
        : "At 100 scenarios, this report provides a rapid directional stress scan — sufficient for initial screening but not for deep institutional analysis.",
    ],
    INFOBOX,
    INFOBORDER
  );

  // ── Section E: How to Read This Report ──────────────────────────────────────

  sectionHeader("E. How to Read This Report");
  const glossaryRows: [string, string][] = [
    ["Approval Rate", "Share of scenarios where the deal remained investable (APPROVE verdict)."],
    ["Conditional Rate", "Share of scenarios where the deal may proceed only with mitigants."],
    ["Rejection Rate", "Share of scenarios where the deal failed investment criteria."],
    ["Veto Rate", "Share of scenarios triggering hard-no governance blockers. Veto is a subset of Rejection — do not add them together."],
    ["Failure Vectors", "Most frequent reasons scenarios failed, ranked by occurrence across all simulated futures."],
    ["Approval Pathways", "Conditions that would make the deal stronger, if any investable scenarios exist."],
    ["Sensitivity Analysis", "Variables ranked by their marginal impact on approval probability."],
    ["Governance Escalation", "Categories that triggered escalation or veto conditions most frequently."],
  ];
  glossaryRows.forEach(([term, def]) => {
    ensureSpace(20);
    doc.fontSize(8.5).fillColor(ACCENT).font("Helvetica-Bold")
      .text(`${sanitize(term)}:`, L + 8, doc.y, { continued: true, width: 130 });
    doc.fillColor(GRAY).font("Helvetica")
      .text(`  ${sanitize(def)}`, { width: CONTENT_W - 138 });
    doc.moveDown(0.2);
  });

  // ── Section 1: Executive Summary + KPI Tiles ────────────────────────────────

  sectionHeader("1. Executive Summary");

  // KPI tiles — 6 tiles in 2 rows of 3
  const tileW = (CONTENT_W - 20) / 3;
  const tileH = 46;
  const row1Y = doc.y;
  ensureSpace(tileH * 2 + 20);

  const topFv = input.failureVectors[0]?.category?.replace(/_/g, " ") ?? "None";
  kpiTile(L,               row1Y, tileW - 4, tileH, input.targetCount.toLocaleString(), "Scenario Count", ACCENT);
  kpiTile(L + tileW,       row1Y, tileW - 4, tileH, pct(safeNum(input.decisionDistribution.approvePct)), "Approval Rate", GREEN);
  kpiTile(L + tileW * 2,   row1Y, tileW - 4, tileH, pct(safeNum(input.decisionDistribution.rejectPct)), "Rejection Rate", RED);

  const row2Y = row1Y + tileH + 8;
  kpiTile(L,               row2Y, tileW - 4, tileH, pct(safeNum(input.decisionDistribution.vetoPct)), "Veto Rate", "#8B0000");
  kpiTile(L + tileW,       row2Y, tileW - 4, tileH, sanitize(topFv).slice(0, 18), "Top Failure Vector", AMBER);
  kpiTile(L + tileW * 2,   row2Y, tileW - 4, tileH, sanitize(input.mode).toUpperCase(), "Simulation Mode", PURPLE);

  doc.y = row2Y + tileH + 14;

  labelValue("Base Verdict", verdictLabel(input.baseVerdict));
  labelValue("Conditional Rate", pct(safeNum(input.decisionDistribution.conditionalPct)));
  if (input.executiveSummary) {
    doc.moveDown(0.3);
    subHeader("Key Conclusion");
    bodyText(input.executiveSummary);
  }

  // ── Section 2: Methodology ───────────────────────────────────────────────────

  sectionHeader("2. Methodology");
  bodyText("The AgenThinkMesh Scenario Mutation Engine generates synthetic strategic variants of the base deal by applying probabilistic perturbations across 30 dimensions in 6 categories: Capital & Financial Stress, Revenue & Market Stress, Operational & Execution Stress, Regulatory & Governance Stress, Macro & Systemic Stress, and Technology & Infrastructure Stress.");
  doc.moveDown(0.3);
  subHeader("Perturbation Dimensions");
  bodyText("Each scenario variant selects a random subset of perturbation dimensions and applies severity levels (base, mild, moderate, severe, extreme) with probability weights of 40%, 28%, 18%, 10%, and 4% respectively. Correlation groups ensure that related stresses co-occur realistically (e.g., high CapEx overrun correlates with debt cost stress).");
  doc.moveDown(0.3);
  subHeader("Council Re-evaluation");
  bodyText("Each scenario is evaluated by the Council of 10 decision framework. The council applies the same institutional logic as the base screening, but with the perturbed deal parameters. Hard-no triggers (e.g., CapEx doubling, EBITDA turning negative) automatically produce rejection outcomes.");
  doc.moveDown(0.3);
  subHeader("Aggregation Logic");
  bodyText("Results are aggregated across all scenarios to produce decision distribution percentages, failure vector rankings, approval pathway identification, governance escalation mapping, and sensitivity surface analysis.");

  // ── Section C: What This Adds Beyond Traditional IC Review ────────────────

  sectionHeader("C. What This Adds Beyond Traditional IC Review");

  ensureSpace(110);
  const compY = doc.y;
  const halfW = (CONTENT_W - 12) / 2;

  // Left column: Traditional IC Review
  doc.rect(L, compY, halfW, 90).fillColor("#FFF7ED").fill();
  doc.rect(L, compY, halfW, 3).fillColor(AMBER).fill();
  doc.fontSize(8.5).fillColor(AMBER).font("Helvetica-Bold")
    .text("TRADITIONAL IC REVIEW", L + 8, compY + 8, { width: halfW - 16 });
  const tradLines = [
    "One memo",
    "One recommendation",
    "Static assumptions",
    "Single-point judgment",
    "No resilience test",
  ];
  tradLines.forEach((line, i) => {
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(`- ${line}`, L + 8, compY + 22 + i * 13, { width: halfW - 16 });
  });

  // Right column: Strategic Simulation
  const rightX = L + halfW + 12;
  doc.rect(rightX, compY, halfW, 90).fillColor(INFOBOX).fill();
  doc.rect(rightX, compY, halfW, 3).fillColor(INFOBORDER).fill();
  doc.fontSize(8.5).fillColor(INFOBORDER).font("Helvetica-Bold")
    .text("STRATEGIC SIMULATION", rightX + 8, compY + 8, { width: halfW - 16 });
  const simLines = [
    "Thousands of governed strategic futures",
    "Probabilistic decision distributions",
    "Failure vector mapping",
    "Governance escalation analysis",
    "Sensitivity detection & resilience testing",
  ];
  simLines.forEach((line, i) => {
    doc.fontSize(8).fillColor(BLACK).font("Helvetica")
      .text(`+ ${line}`, rightX + 8, compY + 22 + i * 13, { width: halfW - 16 });
  });

  doc.y = compY + 98;
  doc.moveDown(0.4);

  infoBox(
    "",
    [
      "A deal that survives 10,000 stressed futures is fundamentally different from a deal",
      "approved once under static assumptions. Simulation does not replace IC judgment — it",
      "stress-tests it. The result is a decision basis that is robust to the realistic range",
      "of strategic futures, not just the base case.",
    ],
    INFOBOX,
    INFOBORDER
  );

  // ── Section D: Interpretation Guidance ──────────────────────────────────────

  sectionHeader("D. Interpretation Guidance");
  bodyText("How to interpret simulation result patterns:");
  doc.moveDown(0.3);

  const interpretRows: [string, string, string][] = [
    ["High approval consistency",       "Resilient deal structure.",                              "The investment thesis holds across a wide range of strategic futures. Proceed with standard diligence."],
    ["Wide conditional range",           "Execution-sensitive opportunity.",                       "The deal is investable but sensitive to execution quality. Conditional approval with operational covenants is appropriate."],
    ["High veto concentration",          "Governance fragility.",                                  "Hard-no triggers are firing frequently. Governance structure, compliance exposure, or regulatory risk must be addressed before any investment."],
    ["Low-frequency catastrophic failures","Edge-case systemic risk.",                            "The deal is broadly resilient but contains tail-risk scenarios. Stress-test the specific triggers and add protective covenants."],
    ["0% approval rate",                 "Structurally non-investable under tested assumptions.",  "No tested combination of realistic stresses produced an investable outcome. Fundamental restructuring is required — not incremental improvement."],
  ];

  interpretRows.forEach(([pattern, headline, guidance]) => {
    ensureSpace(40);
    const rowY = doc.y;
    doc.rect(L, rowY, CONTENT_W, 34).fillColor(BGLIGHT).fill();
    doc.rect(L, rowY, 3, 34).fillColor(INFOBORDER).fill();
    doc.fontSize(8.5).fillColor(ACCENT).font("Helvetica-Bold")
      .text(sanitize(pattern), L + 10, rowY + 4, { width: CONTENT_W - 20, continued: true });
    doc.fillColor(INFOBORDER).font("Helvetica-Bold")
      .text(`  →  ${sanitize(headline)}`, { width: CONTENT_W - 20 });
    doc.fontSize(8).fillColor(GRAY).font("Helvetica")
      .text(sanitize(guidance), L + 10, rowY + 18, { width: CONTENT_W - 20, height: 14, ellipsis: true });
    doc.y = rowY + 38;
    doc.moveDown(0.1);
  });

  // ── Section 3: Decision Distribution ────────────────────────────────────────

  sectionHeader("3. Decision Distribution");
  bodyText(`Across ${input.targetCount.toLocaleString()} simulated scenarios:`);
  doc.moveDown(0.3);
  metricRow("APPROVE", safeNum(input.decisionDistribution.approvePct), GREEN);
  metricRow("CONDITIONAL APPROVE", safeNum(input.decisionDistribution.conditionalPct), AMBER);
  metricRow("REJECT", safeNum(input.decisionDistribution.rejectPct), RED);
  metricRow("VETO (hard-no governance)", safeNum(input.decisionDistribution.vetoPct), "#8B0000");

  // Fix negative-outcome math: veto is a subset of rejection — never add them
  const rejectPct = safeNum(input.decisionDistribution.rejectPct);
  const vetoPct   = safeNum(input.decisionDistribution.vetoPct);
  if (rejectPct > 0 || vetoPct > 0) {
    doc.moveDown(0.3);
    let negOutcomeText = "";
    if (rejectPct > 0 && vetoPct > 0) {
      negOutcomeText = `${pct(rejectPct)} of scenarios produced a rejection outcome, and ${pct(vetoPct)} triggered hard-no governance veto conditions. Note: veto scenarios are a subset of rejected scenarios — they are not additive.`;
    } else if (rejectPct > 0) {
      negOutcomeText = `${pct(rejectPct)} of scenarios produced a rejection outcome.`;
    } else {
      negOutcomeText = `${pct(vetoPct)} of scenarios triggered hard-no governance veto conditions.`;
    }
    infoBox("", [negOutcomeText], "#FEF2F2", RED);
  }

  if (input.decisionDistribution.confidenceDistribution) {
    doc.moveDown(0.3);
    subHeader("Confidence Distribution");
    const cd = input.decisionDistribution.confidenceDistribution;
    metricRow("Low Confidence (< 40%)", safeNum(cd.low), RED);
    metricRow("Medium Confidence (40-70%)", safeNum(cd.medium), AMBER);
    metricRow("High Confidence (> 70%)", safeNum(cd.high), GREEN);
  }

  // ── Section 4: Structural Failure Analysis (shown when approvePct < 5%) ─────

  const approvePct = safeNum(input.decisionDistribution.approvePct);
  if (approvePct < 5) {
    sectionHeader("4. Structural Failure Analysis");
    infoBox(
      "Why No Approval Scenarios Emerged",
      [
        `Across ${input.targetCount.toLocaleString()} simulated strategic futures, ${pct(approvePct)} of scenarios produced an`,
        "investable outcome. This indicates that the current deal structure is not resilient to realistic",
        "perturbations of its key assumptions. The deal is structurally fragile, not merely risky.",
        "",
        "This is distinct from a deal that is risky but investable. A risky deal still produces positive",
        "outcomes under favorable conditions. A structurally fragile deal does not — the investment case",
        "collapses under almost any realistic stress scenario.",
      ],
      WARNBOX,
      WARNBORDER
    );

    if (input.failureVectors.length > 0) {
      subHeader("Top 3 Structural Blockers");
      input.failureVectors.slice(0, 3).forEach((fv, i) => {
        ensureSpace(30);
        doc.fontSize(9).fillColor(RED).font("Helvetica-Bold")
          .text(`${i + 1}. ${sanitize(fv.category).replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { width: CONTENT_W - 16 });
        doc.moveDown(0.15);
        labelValue("Present in", `${pct(safeNum(fv.affectedPct))} of scenarios`, 8);
        labelValue("Avg Severity", `${safeNum(fv.avgSeverity).toFixed(2)} / 1.0`, 8);
        doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
        doc.moveDown(0.35);
      });
    }

    subHeader("Minimum Conditions Required for Investability");
    if (input.approvalPathways.length > 0) {
      input.approvalPathways.slice(0, 2).forEach((ap, i) => {
        ensureSpace(30);
        doc.fontSize(9).fillColor(TEAL).font("Helvetica-Bold")
          .text(`Pathway ${i + 1} (${pct(safeNum(ap.approvalProbability))} approval probability)`, L + 8, doc.y, { width: CONTENT_W - 16 });
        doc.moveDown(0.15);
        if (ap.conditionSet.length > 0) {
          ap.conditionSet.forEach(c => bodyText(`• ${sanitize(c)}`, 16));
        }
        doc.moveDown(0.2);
      });
    } else {
      bodyText("No approval pathways were identified in the simulation. The deal requires fundamental restructuring before any investable pathway can emerge.", 8);
    }

    subHeader("Residual Blocker Statement");
    const topBlocker = input.failureVectors[0]?.category?.replace(/_/g, " ") ?? "structural assumptions";
    bodyText(`Even under the most favorable simulated conditions, ${sanitize(topBlocker)} consistently prevented an investable outcome. This dimension must be fundamentally addressed — not mitigated — before re-evaluation.`, 8);

    subHeader("IC Recommendation");
    infoBox(
      "",
      [
        "RECOMMENDATION: REJECT — pending fundamental restructuring.",
        "",
        "Options available to the IC:",
        "  1. Reject: Decline the deal in its current form.",
        "  2. Request Revised Inputs: Ask the sponsor to address the top structural blockers",
        "     identified above, then re-run the simulation.",
        "  3. Run Decision Upgrade Protocol: Use the Upgrade Protocol to identify minimum",
        "     changes required for the deal to become investable, then re-simulate.",
      ],
      WARNBOX,
      WARNBORDER
    );
  }

  // ── Section 5: Failure Vector Ranking ───────────────────────────────────────

  if (input.failureVectors.length > 0) {
    sectionHeader("5. Failure Vector Ranking");
    bodyText("Top rejection drivers ranked by frequency across all simulated scenarios:");
    doc.moveDown(0.3);
    input.failureVectors.slice(0, 10).forEach((fv, i) => {
      ensureSpace(70);
      doc.fontSize(9).fillColor(ACCENT).font("Helvetica-Bold")
        .text(`${i + 1}. ${sanitize(fv.category).replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { width: CONTENT_W - 16 });
      doc.moveDown(0.15);
      labelValue("Frequency", `${safeNum(fv.frequency).toLocaleString()} scenarios`, 8);
      labelValue("Affected Scenarios", pct(safeNum(fv.affectedPct)), 8);
      labelValue("Average Severity", `${safeNum(fv.avgSeverity).toFixed(2)} / 1.0`, 8);
      if (fv.examplePattern) {
        labelValue("Example Pattern", sanitize(fv.examplePattern), 8);
      }
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
    });
  } else {
    sectionHeader("5. Failure Vector Ranking");
    bodyText("No data available. No failure vectors were recorded in this simulation run.");
  }

  // ── Section 6: Approval Pathways (hidden when approvePct = 0) ───────────────

  if (approvePct > 0 && input.approvalPathways.length > 0) {
    sectionHeader("6. Approval Pathways");
    bodyText("Conditions that increase approval probability across simulated scenarios:");
    doc.moveDown(0.3);
    input.approvalPathways.slice(0, 5).forEach((ap, i) => {
      ensureSpace(80);
      doc.fontSize(9).fillColor(TEAL).font("Helvetica-Bold")
        .text(`Pathway ${i + 1}`, L + 8, doc.y, { width: CONTENT_W - 16 });
      doc.moveDown(0.15);
      labelValue("Approval Probability", pct(safeNum(ap.approvalProbability)), 8);
      labelValue("Confidence Lift", `+${safeNum(ap.confidenceLift).toFixed(1)}%`, 8);
      if (ap.conditionSet.length > 0) {
        subHeader("  Condition Set");
        ap.conditionSet.forEach(c => bodyText(`• ${sanitize(c)}`, 16));
      }
      if (ap.remainingRisks.length > 0) {
        subHeader("  Remaining Risks");
        ap.remainingRisks.forEach(r => bodyText(`• ${sanitize(r)}`, 16));
      }
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
    });
  } else if (approvePct === 0) {
    sectionHeader("6. Approval Pathways");
    bodyText("Not applicable. No approval scenarios emerged in this simulation. See Section 4 (Structural Failure Analysis) for the minimum conditions required for investability.");
  }

  // ── Section 7: Sensitivity Analysis ─────────────────────────────────────────

  if (input.sensitivitySurface.length > 0) {
    sectionHeader("7. Sensitivity Analysis");
    bodyText("Variables ranked by their impact on approval probability. Higher impact score = greater influence on the deal's outcome across simulated scenarios.");
    doc.moveDown(0.3);
    input.sensitivitySurface.slice(0, 12).forEach((sv, i) => {
      ensureSpace(20);
      const impactPct = safeNum(sv.impactScore) * 100;
      doc.fontSize(8.5).fillColor(GRAY).font("Helvetica-Bold")
        .text(`${i + 1}. ${sanitize(sv.variable).replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { continued: true, width: 180 });
      doc.fillColor(sv.direction === "negative" ? RED : GREEN).font("Helvetica")
        .text(`  ${pct(impactPct)}  (${sanitize(sv.direction)})`, { width: CONTENT_W - 188 });
      doc.moveDown(0.25);
    });
  } else {
    sectionHeader("7. Sensitivity Analysis");
    bodyText("No data available. Sensitivity surface was not computed for this simulation run.");
  }

  // ── Section 8: Governance Escalation Map ────────────────────────────────────

  if (input.governanceHeatmap.length > 0) {
    sectionHeader("8. Governance Escalation Map");
    bodyText("Categories that triggered governance escalation, veto, or compliance concerns across simulated scenarios:");
    doc.moveDown(0.3);
    input.governanceHeatmap.slice(0, 8).forEach((gh, i) => {
      ensureSpace(60);
      doc.fontSize(9).fillColor(ACCENT).font("Helvetica-Bold")
        .text(`${i + 1}. ${sanitize(gh.category).replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { width: CONTENT_W - 16 });
      doc.moveDown(0.15);
      labelValue("Escalation Count", safeNum(gh.escalationCount).toLocaleString(), 8);
      labelValue("Veto Count", safeNum(gh.vetoCount).toLocaleString(), 8);
      labelValue("Average Severity", `${safeNum(gh.avgSeverity).toFixed(2)} / 1.0`, 8);
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
    });
  } else {
    sectionHeader("8. Governance Escalation Map");
    bodyText("No data available. No governance escalation data was recorded in this simulation run.");
  }

  // ── Section 9: Scenario Clusters ────────────────────────────────────────────

  sectionHeader("9. Scenario Clusters");
  if (input.scenarioClusters) {
    const sc = input.scenarioClusters;
    const total = sc.resilient + sc.conditional + sc.failure + sc.catastrophic;
    bodyText("Scenarios grouped by outcome severity:");
    doc.moveDown(0.3);
    metricRow("RESILIENT (Approve)", total > 0 ? (sc.resilient / total) * 100 : 0, GREEN);
    metricRow("CONDITIONAL (Conditional Approve)", total > 0 ? (sc.conditional / total) * 100 : 0, AMBER);
    metricRow("FAILURE (Reject)", total > 0 ? (sc.failure / total) * 100 : 0, RED);
    metricRow("CATASTROPHIC (Veto / Hard-No)", total > 0 ? (sc.catastrophic / total) * 100 : 0, "#8B0000");
    doc.moveDown(0.3);
    labelValue("Resilient Scenarios", safeNum(sc.resilient).toLocaleString());
    labelValue("Conditional Scenarios", safeNum(sc.conditional).toLocaleString());
    labelValue("Failure Scenarios", safeNum(sc.failure).toLocaleString());
    labelValue("Catastrophic Scenarios", safeNum(sc.catastrophic).toLocaleString());
  } else {
    const total = input.targetCount;
    const resilient  = Math.round(total * approvePct / 100);
    const conditional = Math.round(total * safeNum(input.decisionDistribution.conditionalPct) / 100);
    const failure    = Math.round(total * rejectPct / 100);
    const catastrophic = Math.round(total * vetoPct / 100);
    bodyText("Scenarios grouped by outcome severity (derived from decision distribution):");
    doc.moveDown(0.3);
    metricRow("RESILIENT (Approve)", approvePct, GREEN);
    metricRow("CONDITIONAL", safeNum(input.decisionDistribution.conditionalPct), AMBER);
    metricRow("FAILURE (Reject)", rejectPct, RED);
    metricRow("CATASTROPHIC (Veto)", vetoPct, "#8B0000");
    doc.moveDown(0.3);
    labelValue("Resilient Scenarios", resilient.toLocaleString());
    labelValue("Conditional Scenarios", conditional.toLocaleString());
    labelValue("Failure Scenarios", failure.toLocaleString());
    labelValue("Catastrophic Scenarios", catastrophic.toLocaleString());
  }

  // ── Section 10: Institutional Meaning ───────────────────────────────────────

  sectionHeader("10. Institutional Meaning");
  infoBox(
    "What This Simulation Adds Beyond a Normal IC Memo",
    [
      "A normal IC memo gives one verdict — a single point estimate of the deal's investability.",
      "This simulation tests whether that verdict survives thousands of plausible futures.",
      "",
      "Specifically, it answers five questions a normal IC memo cannot:",
      "  1. Which assumptions repeatedly break the deal when stressed?",
      "  2. Is the deal fragile (collapses under most stresses) or merely risky (survives most)?",
      "  3. Under what conditions does the deal become investable, if any?",
      "  4. Which governance dimensions are most exposed to escalation or veto?",
      "  5. What is the probability-weighted distribution of outcomes, not just the base case?",
      "",
      "The result is a stress-tested decision basis — not a prediction, but a map of the",
      "investment case's resilience across the realistic range of strategic futures.",
    ],
    INFOBOX,
    INFOBORDER
  );

  // ── Section 11: Comparison to Base IC Memo ──────────────────────────────────

  sectionHeader("11. Comparison to Base IC Memo");
  const conditionalRate = safeNum(input.decisionDistribution.conditionalPct);
  const baseIsApproved    = ["APPROVED", "APPROVE"].includes(input.baseVerdict.toUpperCase());
  const baseIsConditional = ["APPROVED_WITH_CONDITIONS", "CONDITIONAL_APPROVAL", "CONDITIONAL"].includes(input.baseVerdict.toUpperCase());
  const baseIsRejected    = ["REJECTED", "REJECT", "VETOED"].includes(input.baseVerdict.toUpperCase());

  let comparison = "";
  if (baseIsApproved && approvePct >= 50) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is reinforced by the simulation. ${pct(approvePct)} of scenarios produced an APPROVE outcome, indicating strong resilience across strategic perturbations.`;
  } else if (baseIsApproved && approvePct < 50) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is challenged by the simulation. Only ${pct(approvePct)} of scenarios produced an APPROVE outcome. The deal is more fragile than the base case suggests.`;
  } else if (baseIsConditional && (approvePct + conditionalRate) >= 50) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is broadly consistent with simulation results. ${pct(approvePct + conditionalRate)} of scenarios produced APPROVE or CONDITIONAL outcomes.`;
  } else if (baseIsRejected && rejectPct >= 60) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is strongly reinforced by the simulation. ${pct(rejectPct)} of scenarios produced a REJECT outcome, confirming the deal's structural challenges.`;
  } else {
    comparison = `The simulation produced a mixed outcome distribution relative to the base IC Memo verdict of ${verdictLabel(input.baseVerdict)}. ${pct(approvePct)} APPROVE, ${pct(conditionalRate)} CONDITIONAL, ${pct(rejectPct)} REJECT across ${input.targetCount.toLocaleString()} scenarios.`;
  }
  bodyText(comparison);

  // ── Section 12: Final Investment Interpretation ──────────────────────────────

  sectionHeader("12. Final Investment Interpretation");

  const investable = approvePct + conditionalRate >= 40;
  const stronglyInvestable = approvePct >= 60;
  const marginal = approvePct + conditionalRate >= 20 && approvePct + conditionalRate < 40;

  let interpretation = "";
  if (stronglyInvestable) {
    interpretation = `This deal demonstrates strong resilience across ${input.targetCount.toLocaleString()} simulated strategic futures. With ${pct(approvePct)} of scenarios producing an APPROVE outcome, the investment case is robust. The primary variables driving approval are identified in the Sensitivity Analysis. Further diligence on the top failure vectors is recommended but the investment thesis is well-supported.`;
  } else if (investable) {
    interpretation = `This deal remains investable under most simulated conditions, with ${pct(approvePct + conditionalRate)} of scenarios producing APPROVE or CONDITIONAL outcomes. However, the deal is sensitive to the variables identified in the Sensitivity Analysis. Conditional approval with specific covenants addressing the top failure vectors is the recommended approach.`;
  } else if (marginal) {
    interpretation = `This deal is marginally investable under simulation. Only ${pct(approvePct + conditionalRate)} of scenarios produced positive outcomes. Significant structural improvements are required before the investment case can be made with confidence. The top failure vectors must be addressed before re-evaluation.`;
  } else {
    interpretation = `This deal does not demonstrate sufficient resilience across simulated strategic futures. ${pct(rejectPct)} of scenarios produced a rejection outcome${vetoPct > 0 ? `, and ${pct(vetoPct)} triggered hard-no governance veto conditions` : ""}. The investment case requires fundamental restructuring before it can be considered investable.`;
  }
  bodyText(interpretation);
  doc.moveDown(0.3);

  if (input.failureVectors.length > 0) {
    subHeader("What Must Change");
    input.failureVectors.slice(0, 3).forEach((fv, i) => {
      bodyText(`${i + 1}. ${sanitize(fv.category).replace(/_/g, " ")} — present in ${pct(safeNum(fv.affectedPct))} of scenarios. Addressing this dimension would have the highest impact on approval probability.`, 8);
    });
  }

  if (input.sensitivitySurface.length > 0) {
    doc.moveDown(0.3);
    subHeader("Variables That Matter Most");
    input.sensitivitySurface.slice(0, 5).forEach((sv, i) => {
      bodyText(`${i + 1}. ${sanitize(sv.variable).replace(/_/g, " ")} (impact: ${pct(safeNum(sv.impactScore) * 100)})`, 8);
    });
  }

  doc.moveDown(0.3);
  subHeader("Further Diligence Recommendation");
  if (stronglyInvestable) {
    bodyText("Standard diligence is sufficient. Focus on validating the top 3 sensitivity variables and confirming the governance escalation triggers are manageable.");
  } else if (investable) {
    bodyText("Extended diligence is recommended. Specifically: validate the top failure vectors with management, stress-test the financial model against the sensitivity variables, and confirm governance structures address the escalation triggers.");
  } else {
    bodyText("Deep diligence is required before any investment decision. The simulation indicates structural fragility that cannot be resolved through standard diligence alone. Consider running a follow-up simulation after structural improvements are made.");
  }

  // ── Section 13: Simulation Resilience Impact (only when upgraded fingerprint exists) ──
  if (input.upgradedFingerprint) {
    const fp = input.upgradedFingerprint;

    // Helper: format resilienceDelta (stored as percentage points, e.g. 18.4)
    const fmtResilienceDelta = (v: number | null | undefined): string => {
      if (v == null) return "Not available.";
      const sign = v >= 0 ? "+" : "";
      return `${sign}${v.toFixed(1)}pp`;
    };

    // Helper: map upgradeEffectiveness float to label (mirrors UI formatUpgradeEffectiveness)
    const fmtUpgradeEffectiveness = (v: number | null | undefined): string => {
      if (v == null) return "Not available.";
      if (v < 0.25) return "Low";
      if (v < 0.50) return "Moderate";
      if (v < 0.75) return "High";
      return "Very High";
    };

    sectionHeader("13. Simulation Resilience Impact");
    bodyText(
      "The following metrics are derived from the upgraded scenario fingerprint and reflect how the " +
      "structural improvements affected simulation resilience. These are simulation resilience metrics, " +
      "not investment success probabilities."
    );
    doc.moveDown(0.3);

    labelValue("Resilience Delta",
      fmtResilienceDelta(fp.resilienceDelta) +
      (fp.resilienceDelta != null ? "  (change in simulation resilience after fixes, in percentage points)" : ""));
    labelValue("Upgrade Effectiveness",
      fmtUpgradeEffectiveness(fp.upgradeEffectiveness) +
      (fp.upgradeEffectiveness != null ? `  (raw score: ${fp.upgradeEffectiveness.toFixed(3)})` : ""));
    labelValue("Rescueability Score",
      fp.rescueabilityScore != null
        ? `${fp.rescueabilityScore.toFixed(0)}/100  (measures how many hard-no scenarios were recoverable through structured mitigation)`
        : "Not available.");
    labelValue("Structural Fragility Score",
      fp.structuralFragilityScore != null
        ? `${fp.structuralFragilityScore.toFixed(0)}/100  (higher score = more fragile structure under stress)`
        : "Not available.");

    doc.moveDown(0.3);
    infoBox(
      "Interpretation Note",
      [
        "These metrics reflect simulation resilience only. They do not imply investment success probability,",
        "winner selection, or a change to the original council verdict. Resilience Delta measures the",
        "improvement in simulated approval rate after structural fixes were applied.",
      ],
      INFOBOX,
      INFOBORDER
    );
  }

  // ── Footer on all pages ───────────────────────────────────────────────────────

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(7).fillColor(LGRAY).font("Helvetica")
      .text(
        `AgenThinkMesh  ·  Strategic Stress Test Report  ·  ${sanitize(input.dealName)}  ·  Page ${i + 1} of ${range.count}`,
        L, 820, { width: CONTENT_W, align: "center" }
      );
  }

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// ── Text Export ───────────────────────────────────────────────────────────────

export function generateStressTestReportText(input: StressTestReportInput): string {
  const lines: string[] = [];
  const sep  = "=".repeat(72);
  const dash = "-".repeat(72);

  const approvePct    = safeNum(input.decisionDistribution.approvePct);
  const conditionalPct = safeNum(input.decisionDistribution.conditionalPct);
  const rejectPct     = safeNum(input.decisionDistribution.rejectPct);
  const vetoPct       = safeNum(input.decisionDistribution.vetoPct);

  lines.push(sep);
  lines.push("AI-GOVERNED STRATEGIC STRESS TEST REPORT");
  lines.push(`Deal:       ${sanitize(input.dealName)}`);
  lines.push(`Mode:       ${modeLabel(input.mode)}`);
  lines.push(`Scenarios:  ${input.targetCount.toLocaleString()}`);
  lines.push(`Completed:  ${input.completedAt}`);
  lines.push(`Generated:  ${input.generatedAt ?? new Date().toISOString()}`);
  if (input.runId) lines.push(`Run ID:     ${sanitize(input.runId)}`);
  lines.push(sep);
  lines.push("");

  lines.push("A. WHAT 10,000 STRATEGIC SIMULATIONS MEANS");
  lines.push(dash);
  lines.push("This report does not repeat the same deal screen 10,000 times. It creates 10,000");
  lines.push("structured strategic futures by perturbing key deal assumptions and re-runs the");
  lines.push("Council of 10 decision framework against each variant.");
  lines.push("");
  lines.push("A 0% approval rate does not mean the model failed. It means no tested combination");
  lines.push("of realistic stresses produced an investable outcome under the current deal structure.");
  lines.push("");

  lines.push("B. WHY SIMULATION SCALE MATTERS");
  lines.push(dash);
  lines.push("The objective is not to ask the same question many times.");
  lines.push("The objective is to systematically perturb strategic assumptions and observe how");
  lines.push("institutional decision outcomes change under varying conditions.");
  lines.push("");
  // Detect tier for YOU ARE HERE marker
  const textTierIdx =
    input.targetCount >= 1000000 ? 4 :
    input.targetCount >= 100000  ? 3 :
    input.targetCount >= 10000   ? 2 :
    input.targetCount >= 1000    ? 1 : 0;
  const tierLines = [
    "  100 scenarios     -- Quick Scan: Rapid directional stress scan. Detects obvious fragility.",
    "  1,000 scenarios   -- Probabilistic: Identifies recurring risk patterns. Reveals primary failure vectors.",
    "  10,000 scenarios  -- Institutional: Maps decision surfaces. Detects nonlinear interactions.",
    "  100,000 scenarios -- Rare-Event: Exposes low-frequency, high-impact edge cases.",
    "  1M scenarios      -- Strategic Intelligence: Rare-event discovery. Policy-scale analysis.",
  ];
  lines.push("SIMULATION MATURITY CURVE:");
  tierLines.forEach((line, i) => {
    lines.push(i === textTierIdx ? `${line}  << YOU ARE HERE` : line);
  });
  lines.push("");
  const tierCtxMsg =
    textTierIdx === 4 ? "This run exceeds traditional IC scenario analysis by several orders of magnitude. It approaches continuous institutional scenario exploration."
    : textTierIdx === 3 ? "This run exceeds traditional IC scenario analysis by several orders of magnitude. Rare-event detection and systemic governance failure clusters are now visible."
    : textTierIdx === 2 ? "This run operates at institutional-grade simulation depth. Nonlinear interactions and governance escalation patterns are fully mapped."
    : textTierIdx === 1 ? "This simulation tier enables higher confidence in downside visibility. Primary failure vectors are statistically reliable."
    : "This run provides a rapid directional stress scan. Suitable for initial screening; consider deeper simulation for institutional-grade confidence.";
  lines.push(`>> ${tierCtxMsg}`);
  lines.push("");
  const scaleContext = input.targetCount >= 1000000
    ? "At 1M scenarios, this report provides strategic intelligence infrastructure."
    : input.targetCount >= 100000
    ? "At 100,000+ scenarios, this report identifies low-frequency, high-impact edge cases."
    : input.targetCount >= 10000
    ? "At 10,000 scenarios, this report maps the full institutional decision surface."
    : input.targetCount >= 1000
    ? "At 1,000 scenarios, this report provides meaningful probabilistic confidence."
    : "At 100 scenarios, this report provides a rapid directional stress scan.";
  lines.push(`This run: ${input.targetCount.toLocaleString()} scenarios (${modeLabel(input.mode)}). ${scaleContext}`);
  lines.push("");

  lines.push("C. WHAT THIS ADDS BEYOND TRADITIONAL IC REVIEW");
  lines.push(dash);
  lines.push("Traditional IC Review:    One memo | One recommendation | Static assumptions | No resilience test");
  lines.push("Strategic Simulation:     Thousands of governed futures | Probabilistic distributions");
  lines.push("                          Failure vector mapping | Governance escalation analysis");
  lines.push("");
  lines.push("A deal that survives 10,000 stressed futures is fundamentally different from a deal");
  lines.push("approved once under static assumptions. Simulation stress-tests IC judgment.");
  lines.push("");

  lines.push("D. INTERPRETATION GUIDANCE");
  lines.push(dash);
  lines.push("High approval consistency    -> Resilient deal structure. Proceed with standard diligence.");
  lines.push("Wide conditional range       -> Execution-sensitive. Conditional approval with covenants.");
  lines.push("High veto concentration      -> Governance fragility. Address before any investment.");
  lines.push("Low-freq catastrophic events -> Edge-case systemic risk. Add protective covenants.");
  lines.push("0% approval rate             -> Structurally non-investable. Fundamental restructuring required.");
  lines.push("");

  lines.push("1. EXECUTIVE SUMMARY");
  lines.push(dash);
  lines.push(`Simulation Mode:    ${modeLabel(input.mode)}`);
  lines.push(`Scenario Count:     ${input.targetCount.toLocaleString()}`);
  lines.push(`Base Verdict:       ${verdictLabel(input.baseVerdict)}`);
  lines.push(`Approval Rate:      ${pct(approvePct)}`);
  lines.push(`Conditional Rate:   ${pct(conditionalPct)}`);
  lines.push(`Rejection Rate:     ${pct(rejectPct)}`);
  lines.push(`Veto Rate:          ${pct(vetoPct)}`);
  if (input.executiveSummary) {
    lines.push("");
    lines.push(sanitize(input.executiveSummary));
  }
  lines.push("");

  lines.push("3. DECISION DISTRIBUTION");
  lines.push(dash);
  lines.push(`APPROVE:            ${pct(approvePct)}`);
  lines.push(`CONDITIONAL:        ${pct(conditionalPct)}`);
  lines.push(`REJECT:             ${pct(rejectPct)}`);
  lines.push(`VETO (hard-no):     ${pct(vetoPct)}`);
  if (rejectPct > 0 && vetoPct > 0) {
    lines.push("");
    lines.push(`NOTE: ${pct(rejectPct)} of scenarios produced a rejection outcome, and ${pct(vetoPct)} triggered`);
    lines.push("hard-no governance veto conditions. Veto is a subset of rejection — do not add them.");
  }
  lines.push("");

  if (approvePct < 5) {
    lines.push("4. STRUCTURAL FAILURE ANALYSIS");
    lines.push(dash);
    lines.push(`No investable scenarios emerged (${pct(approvePct)} approval rate).`);
    lines.push("The deal is structurally fragile, not merely risky.");
    lines.push("");
    if (input.failureVectors.length > 0) {
      lines.push("Top 3 Structural Blockers:");
      input.failureVectors.slice(0, 3).forEach((fv, i) => {
        lines.push(`  ${i + 1}. ${sanitize(fv.category).replace(/_/g, " ")} (${pct(safeNum(fv.affectedPct))} of scenarios)`);
      });
      lines.push("");
    }
    lines.push("IC Recommendation: REJECT — pending fundamental restructuring.");
    lines.push("Options: Reject | Request Revised Inputs | Run Decision Upgrade Protocol");
    lines.push("");
  }

  if (input.failureVectors.length > 0) {
    lines.push("5. FAILURE VECTOR RANKING");
    lines.push(dash);
    input.failureVectors.slice(0, 10).forEach((fv, i) => {
      lines.push(`${i + 1}. ${sanitize(fv.category).replace(/_/g, " ").toUpperCase()}`);
      lines.push(`   Frequency: ${safeNum(fv.frequency).toLocaleString()} scenarios (${pct(safeNum(fv.affectedPct))})`);
      lines.push(`   Avg Severity: ${safeNum(fv.avgSeverity).toFixed(2)}`);
      if (fv.examplePattern) lines.push(`   Example: ${sanitize(fv.examplePattern)}`);
      lines.push("");
    });
  }

  if (approvePct > 0 && input.approvalPathways.length > 0) {
    lines.push("6. APPROVAL PATHWAYS");
    lines.push(dash);
    input.approvalPathways.slice(0, 5).forEach((ap, i) => {
      lines.push(`Pathway ${i + 1}: Approval Probability ${pct(safeNum(ap.approvalProbability))}, Confidence Lift +${safeNum(ap.confidenceLift).toFixed(1)}%`);
      if (ap.conditionSet.length > 0) lines.push(`  Conditions: ${ap.conditionSet.map(c => sanitize(c)).join("; ")}`);
      if (ap.remainingRisks.length > 0) lines.push(`  Remaining Risks: ${ap.remainingRisks.map(r => sanitize(r)).join("; ")}`);
      lines.push("");
    });
  }

  if (input.sensitivitySurface.length > 0) {
    lines.push("7. SENSITIVITY ANALYSIS");
    lines.push(dash);
    input.sensitivitySurface.slice(0, 12).forEach((sv, i) => {
      lines.push(`${i + 1}. ${sanitize(sv.variable).replace(/_/g, " ")} -- Impact: ${pct(safeNum(sv.impactScore) * 100)} (${sanitize(sv.direction)})`);
    });
    lines.push("");
  }

  if (input.governanceHeatmap.length > 0) {
    lines.push("8. GOVERNANCE ESCALATION MAP");
    lines.push(dash);
    input.governanceHeatmap.slice(0, 8).forEach((gh, i) => {
      lines.push(`${i + 1}. ${sanitize(gh.category).replace(/_/g, " ").toUpperCase()}`);
      lines.push(`   Escalations: ${safeNum(gh.escalationCount).toLocaleString()}, Vetoes: ${safeNum(gh.vetoCount).toLocaleString()}, Avg Severity: ${safeNum(gh.avgSeverity).toFixed(2)}`);
    });
    lines.push("");
  }

  lines.push("10. INSTITUTIONAL MEANING");
  lines.push(dash);
  lines.push("A normal IC memo gives one verdict. This simulation tests whether that verdict");
  lines.push("survives thousands of plausible futures. It identifies which assumptions repeatedly");
  lines.push("break the deal, distinguishes between a fixable deal and a structurally fragile deal,");
  lines.push("and gives the IC a stress-tested decision basis.");
  lines.push("");

  lines.push("12. FINAL INVESTMENT INTERPRETATION");
  lines.push(dash);
  const investable = approvePct + conditionalPct >= 40;
  const stronglyInvestable = approvePct >= 60;
  if (stronglyInvestable) {
    lines.push(`INVESTABLE -- ${pct(approvePct)} of scenarios approved. Strong resilience confirmed.`);
  } else if (investable) {
    lines.push(`CONDITIONALLY INVESTABLE -- ${pct(approvePct + conditionalPct)} of scenarios produced positive outcomes.`);
  } else {
    lines.push(`NOT INVESTABLE -- ${pct(rejectPct)} of scenarios produced a rejection outcome${vetoPct > 0 ? `, ${pct(vetoPct)} triggered governance veto` : ""}. Structural improvements required.`);
  }
  if (input.failureVectors.length > 0) {
    lines.push("");
    lines.push("What Must Change:");
    input.failureVectors.slice(0, 3).forEach((fv, i) => {
      lines.push(`  ${i + 1}. ${sanitize(fv.category).replace(/_/g, " ")} (${pct(safeNum(fv.affectedPct))} of scenarios)`);
    });
  }
  if (input.sensitivitySurface.length > 0) {
    lines.push("");
    lines.push("Variables That Matter Most:");
    input.sensitivitySurface.slice(0, 5).forEach((sv, i) => {
      lines.push(`  ${i + 1}. ${sanitize(sv.variable).replace(/_/g, " ")} (${pct(safeNum(sv.impactScore) * 100)})`);
    });
  }
  lines.push("");

  // DR-2: Simulation Resilience Impact section (only when upgraded fingerprint exists)
  if (input.upgradedFingerprint) {
    const fp = input.upgradedFingerprint;

    const fmtResilienceDelta = (v: number | null | undefined): string => {
      if (v == null) return "Not available.";
      const sign = v >= 0 ? "+" : "";
      return `${sign}${v.toFixed(1)}pp`;
    };
    const fmtUpgradeEffectiveness = (v: number | null | undefined): string => {
      if (v == null) return "Not available.";
      if (v < 0.25) return "Low";
      if (v < 0.50) return "Moderate";
      if (v < 0.75) return "High";
      return "Very High";
    };
    const fmtScore = (v: number | null | undefined): string =>
      v == null ? "Not available." : `${v.toFixed(0)}/100`;

    lines.push("13. SIMULATION RESILIENCE IMPACT");
    lines.push(dash);
    lines.push("The following metrics are derived from the upgraded scenario fingerprint.");
    lines.push("These are simulation resilience metrics, not investment success probabilities.");
    lines.push("");
    lines.push(`Resilience Delta:           ${fmtResilienceDelta(fp.resilienceDelta)}`);
    lines.push(`Upgrade Effectiveness:      ${fmtUpgradeEffectiveness(fp.upgradeEffectiveness)}${fp.upgradeEffectiveness != null ? ` (raw: ${fp.upgradeEffectiveness.toFixed(3)})` : ""}`);
    lines.push(`Rescueability Score:        ${fmtScore(fp.rescueabilityScore)}`);
    lines.push(`Structural Fragility Score: ${fmtScore(fp.structuralFragilityScore)}`);
    lines.push("");
    lines.push("NOTE: These metrics do not imply investment success probability, winner selection,");
    lines.push("or a change to the original council verdict.");
    lines.push("");
  }

  lines.push(sep);
  lines.push("END OF REPORT -- AgenThinkMesh Scenario Simulation Engine");
  lines.push(sep);

  return lines.join("\n");
}
