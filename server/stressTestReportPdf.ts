/**
 * stressTestReportPdf.ts — AI-Governed Strategic Stress Test Report Generator
 *
 * Produces a standalone PDF from Strategic Scenario Simulation Mode output.
 * 10 sections:
 *   1. Executive Summary
 *   2. Methodology
 *   3. Decision Distribution
 *   4. Failure Vector Ranking
 *   5. Approval Pathways
 *   6. Sensitivity Analysis
 *   7. Governance Escalation Map
 *   8. Scenario Clusters
 *   9. Comparison to Base IC Memo
 *  10. Final Investment Interpretation
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

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function bar(pctVal: number, width = 30): string {
  const filled = Math.round((pctVal / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateStressTestReportPdf(input: StressTestReportInput): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
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

  const BLACK   = "#0A0A0A";
  const WHITE   = "#FFFFFF";
  const ACCENT  = "#1A1A2E"; // deep navy/purple
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

  function newPage() {
    doc.addPage();
    doc.moveTo(L, 40).lineTo(W - L, 40).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.fontSize(7).fillColor(LGRAY).font("Helvetica")
      .text(`AGENTHINK MESH · STRATEGIC STRESS TEST REPORT — ${input.dealName.toUpperCase()}`, L, 28, { width: CONTENT_W, align: "left" });
    doc.moveDown(0.5);
  }

  function sectionHeader(num: number, title: string) {
    if (doc.y > 680) newPage();
    doc.moveDown(0.8);
    doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.5).strokeColor(ACCENT).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor(ACCENT).font("Helvetica-Bold")
      .text(`${num}. ${title.toUpperCase()}`, L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.4);
  }

  function subHeader(text: string) {
    if (doc.y > 700) newPage();
    doc.fontSize(9).fillColor(PURPLE).font("Helvetica-Bold")
      .text(text.toUpperCase(), L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.25);
  }

  function bodyText(text: string, indent = 0) {
    if (!text) return;
    if (doc.y > 720) newPage();
    doc.fontSize(9).fillColor(BLACK).font("Helvetica")
      .text(text, L + indent, doc.y, { width: CONTENT_W - indent });
    doc.moveDown(0.25);
  }

  function labelValue(label: string, value: string, indent = 0) {
    if (doc.y > 720) newPage();
    doc.fontSize(8.5).fillColor(GRAY).font("Helvetica-Bold")
      .text(label + ":", L + indent, doc.y, { continued: true, width: 130 });
    doc.fillColor(BLACK).font("Helvetica")
      .text("  " + (value || "—"), { width: CONTENT_W - indent - 130 });
    doc.moveDown(0.2);
  }

  function metricRow(label: string, pctVal: number, color: string) {
    if (doc.y > 720) newPage();
    doc.fontSize(8.5).fillColor(GRAY).font("Helvetica-Bold")
      .text(label, L + 8, doc.y, { continued: true, width: 130 });
    doc.fillColor(color).font("Helvetica-Bold")
      .text(pct(pctVal), { continued: true, width: 50 });
    doc.fillColor(color).font("Helvetica")
      .text(`  ${bar(pctVal, 25)}`, { width: CONTENT_W - 188 });
    doc.moveDown(0.25);
  }

  // ── Cover Page ─────────────────────────────────────────────────────────────

  // Deep navy/purple header band
  doc.rect(0, 0, W, 180).fill(ACCENT);

  try {
    const logoBuffer = await fetchBuffer(LOGO_CDN_URL);
    doc.image(logoBuffer, L, 20, { height: 32 });
  } catch {
    doc.fontSize(14).fillColor(WHITE).font("Helvetica-Bold").text("AGENTHINK MESH", L, 24);
  }

  doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold")
    .text("AI-GOVERNED STRATEGIC STRESS TEST REPORT", L, 70, { width: CONTENT_W, align: "center" });

  doc.fontSize(20).fillColor(WHITE).font("Helvetica-Bold")
    .text(input.dealName.toUpperCase(), L, 95, { width: CONTENT_W, align: "center" });

  doc.fontSize(10).fillColor(GOLD).font("Helvetica")
    .text(`${modeLabel(input.mode).toUpperCase()}`, L, 130, { width: CONTENT_W, align: "center" });

  const vLabel = verdictLabel(input.baseVerdict);
  const vColor = ["REJECTED", "VETOED"].some(x => vLabel.includes(x)) ? RED
    : vLabel.includes("CONDITIONAL") ? AMBER : GREEN;
  doc.fontSize(10).fillColor(vColor).font("Helvetica-Bold")
    .text(`BASE VERDICT: ${vLabel}`, L, 153, { width: CONTENT_W, align: "center" });

  doc.rect(0, 180, W, 36).fill("#F0F4F8");
  doc.fontSize(8).fillColor(GRAY).font("Helvetica")
    .text(`Generated: ${input.generatedAt ?? new Date().toISOString().split("T")[0]}   ·   Scenarios: ${input.targetCount.toLocaleString()}   ·   Completed: ${(typeof input.completedAt === "string" ? input.completedAt : (input.completedAt as unknown as Date).toISOString()).split("T")[0]}   ·   AgenThinkMesh Scenario Engine`, L, 193, { width: CONTENT_W, align: "center" });

  doc.y = 230;

  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text("This report presents the results of a strategic scenario simulation conducted by the AgenThinkMesh Scenario Mutation Engine. The simulation perturbs deal parameters across 30 dimensions in 6 categories and re-evaluates each scenario through the Council of 10 decision framework. Results are aggregated to produce probabilistic governance intelligence.", L, doc.y, { width: CONTENT_W, align: "justify" });
  doc.moveDown(1);

  // ── Section 1: Executive Summary ──────────────────────────────────────────
  sectionHeader(1, "Executive Summary");
  labelValue("Simulation Mode", modeLabel(input.mode));
  labelValue("Scenario Count", input.targetCount.toLocaleString());
  labelValue("Base Verdict", verdictLabel(input.baseVerdict));
  labelValue("Approval Rate", pct(input.decisionDistribution.approvePct));
  labelValue("Conditional Rate", pct(input.decisionDistribution.conditionalPct));
  labelValue("Rejection Rate", pct(input.decisionDistribution.rejectPct));
  labelValue("Veto Rate", pct(input.decisionDistribution.vetoPct));
  doc.moveDown(0.3);
  if (input.executiveSummary) {
    subHeader("Key Conclusion");
    bodyText(input.executiveSummary);
  }

  // ── Section 2: Methodology ────────────────────────────────────────────────
  sectionHeader(2, "Methodology");
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
  doc.moveDown(0.3);
  subHeader("Confidence Interpretation");
  bodyText("Approval percentage represents the fraction of scenarios where the deal received an APPROVE verdict. Conditional percentage includes APPROVED_WITH_CONDITIONS outcomes. The sensitivity surface ranks variables by their marginal impact on approval probability.");

  // ── Section 3: Decision Distribution ─────────────────────────────────────
  sectionHeader(3, "Decision Distribution");
  bodyText(`Across ${input.targetCount.toLocaleString()} simulated scenarios:`);
  doc.moveDown(0.3);
  metricRow("APPROVE", input.decisionDistribution.approvePct, GREEN);
  metricRow("CONDITIONAL APPROVE", input.decisionDistribution.conditionalPct, AMBER);
  metricRow("REJECT", input.decisionDistribution.rejectPct, RED);
  metricRow("VETO", input.decisionDistribution.vetoPct, "#8B0000");

  if (input.decisionDistribution.confidenceDistribution) {
    doc.moveDown(0.3);
    subHeader("Confidence Distribution");
    const cd = input.decisionDistribution.confidenceDistribution;
    metricRow("Low Confidence (< 40%)", cd.low, RED);
    metricRow("Medium Confidence (40–70%)", cd.medium, AMBER);
    metricRow("High Confidence (> 70%)", cd.high, GREEN);
  }

  // ── Section 4: Failure Vector Ranking ────────────────────────────────────
  if (input.failureVectors.length > 0) {
    sectionHeader(4, "Failure Vector Ranking");
    bodyText("Top rejection drivers ranked by frequency across all simulated scenarios:");
    doc.moveDown(0.3);
    input.failureVectors.slice(0, 10).forEach((fv, i) => {
      if (doc.y > 700) newPage();
      doc.fontSize(9).fillColor(ACCENT).font("Helvetica-Bold")
        .text(`${i + 1}. ${fv.category.replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { width: CONTENT_W - 16 });
      doc.moveDown(0.15);
      labelValue("Frequency", fv.frequency.toLocaleString() + " scenarios", 8);
      labelValue("Affected Scenarios", pct(fv.affectedPct), 8);
      labelValue("Average Severity", fv.avgSeverity.toFixed(2) + " / 1.0", 8);
      if (fv.examplePattern) {
        labelValue("Example Pattern", fv.examplePattern, 8);
      }
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
    });
  }

  // ── Section 5: Approval Pathways ──────────────────────────────────────────
  if (input.approvalPathways.length > 0) {
    sectionHeader(5, "Approval Pathways");
    bodyText("Conditions that increase approval probability across simulated scenarios:");
    doc.moveDown(0.3);
    input.approvalPathways.slice(0, 5).forEach((ap, i) => {
      if (doc.y > 700) newPage();
      doc.fontSize(9).fillColor(TEAL).font("Helvetica-Bold")
        .text(`Pathway ${i + 1}`, L + 8, doc.y, { width: CONTENT_W - 16 });
      doc.moveDown(0.15);
      labelValue("Approval Probability", pct(ap.approvalProbability), 8);
      labelValue("Confidence Lift", `+${ap.confidenceLift.toFixed(1)}%`, 8);
      if (ap.conditionSet.length > 0) {
        subHeader("  Condition Set");
        ap.conditionSet.forEach(c => bodyText(`• ${c}`, 16));
      }
      if (ap.remainingRisks.length > 0) {
        subHeader("  Remaining Risks");
        ap.remainingRisks.forEach(r => bodyText(`• ${r}`, 16));
      }
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
    });
  }

  // ── Section 6: Sensitivity Analysis ──────────────────────────────────────
  if (input.sensitivitySurface.length > 0) {
    sectionHeader(6, "Sensitivity Analysis");
    bodyText("Variables ranked by their impact on approval probability. Higher impact score = greater influence on the deal's outcome across simulated scenarios.");
    doc.moveDown(0.3);
    input.sensitivitySurface.slice(0, 12).forEach((sv, i) => {
      if (doc.y > 720) newPage();
      const impactBar = "█".repeat(Math.round(sv.impactScore * 20)) + "░".repeat(20 - Math.round(sv.impactScore * 20));
      doc.fontSize(8.5).fillColor(GRAY).font("Helvetica-Bold")
        .text(`${i + 1}. ${sv.variable.replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { continued: true, width: 160 });
      doc.fillColor(sv.direction === "negative" ? RED : GREEN).font("Helvetica")
        .text(`  ${impactBar}  ${(sv.impactScore * 100).toFixed(1)}%`, { width: CONTENT_W - 168 });
      doc.moveDown(0.25);
    });
  }

  // ── Section 7: Governance Escalation Map ─────────────────────────────────
  if (input.governanceHeatmap.length > 0) {
    sectionHeader(7, "Governance Escalation Map");
    bodyText("Categories that triggered governance escalation, veto, or compliance concerns across simulated scenarios:");
    doc.moveDown(0.3);
    input.governanceHeatmap.slice(0, 8).forEach((gh, i) => {
      if (doc.y > 720) newPage();
      doc.fontSize(9).fillColor(ACCENT).font("Helvetica-Bold")
        .text(`${i + 1}. ${gh.category.replace(/_/g, " ").toUpperCase()}`, L + 8, doc.y, { width: CONTENT_W - 16 });
      doc.moveDown(0.15);
      labelValue("Escalation Count", gh.escalationCount.toLocaleString(), 8);
      labelValue("Veto Count", gh.vetoCount.toLocaleString(), 8);
      labelValue("Average Severity", gh.avgSeverity.toFixed(2) + " / 1.0", 8);
      doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
    });
  }

  // ── Section 8: Scenario Clusters ─────────────────────────────────────────
  sectionHeader(8, "Scenario Clusters");
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
    labelValue("Resilient Scenarios", sc.resilient.toLocaleString());
    labelValue("Conditional Scenarios", sc.conditional.toLocaleString());
    labelValue("Failure Scenarios", sc.failure.toLocaleString());
    labelValue("Catastrophic Scenarios", sc.catastrophic.toLocaleString());
  } else {
    // Derive from distribution
    const total = input.targetCount;
    const resilient = Math.round(total * input.decisionDistribution.approvePct / 100);
    const conditional = Math.round(total * input.decisionDistribution.conditionalPct / 100);
    const failure = Math.round(total * input.decisionDistribution.rejectPct / 100);
    const catastrophic = Math.round(total * input.decisionDistribution.vetoPct / 100);
    metricRow("RESILIENT (Approve)", input.decisionDistribution.approvePct, GREEN);
    metricRow("CONDITIONAL", input.decisionDistribution.conditionalPct, AMBER);
    metricRow("FAILURE (Reject)", input.decisionDistribution.rejectPct, RED);
    metricRow("CATASTROPHIC (Veto)", input.decisionDistribution.vetoPct, "#8B0000");
    doc.moveDown(0.3);
    labelValue("Resilient Scenarios", resilient.toLocaleString());
    labelValue("Conditional Scenarios", conditional.toLocaleString());
    labelValue("Failure Scenarios", failure.toLocaleString());
    labelValue("Catastrophic Scenarios", catastrophic.toLocaleString());
  }

  // ── Section 9: Comparison to Base IC Memo ────────────────────────────────
  sectionHeader(9, "Comparison to Base IC Memo");
  const approveRate = input.decisionDistribution.approvePct;
  const conditionalRate = input.decisionDistribution.conditionalPct;
  const rejectRate = input.decisionDistribution.rejectPct;
  const baseIsApproved = ["APPROVED", "APPROVE"].includes(input.baseVerdict.toUpperCase());
  const baseIsConditional = ["APPROVED_WITH_CONDITIONS", "CONDITIONAL_APPROVAL", "CONDITIONAL"].includes(input.baseVerdict.toUpperCase());
  const baseIsRejected = ["REJECTED", "REJECT", "VETOED"].includes(input.baseVerdict.toUpperCase());

  let comparison = "";
  if (baseIsApproved && approveRate >= 50) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is reinforced by the simulation. ${pct(approveRate)} of scenarios produced an APPROVE outcome, indicating strong resilience across strategic perturbations.`;
  } else if (baseIsApproved && approveRate < 50) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is challenged by the simulation. Only ${pct(approveRate)} of scenarios produced an APPROVE outcome. The deal is more fragile than the base case suggests.`;
  } else if (baseIsConditional && (approveRate + conditionalRate) >= 50) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is broadly consistent with simulation results. ${pct(approveRate + conditionalRate)} of scenarios produced APPROVE or CONDITIONAL outcomes.`;
  } else if (baseIsRejected && rejectRate >= 60) {
    comparison = `The base IC Memo verdict of ${verdictLabel(input.baseVerdict)} is strongly reinforced by the simulation. ${pct(rejectRate)} of scenarios produced a REJECT outcome, confirming the deal's structural challenges.`;
  } else {
    comparison = `The simulation produced a mixed outcome distribution relative to the base IC Memo verdict of ${verdictLabel(input.baseVerdict)}. ${pct(approveRate)} APPROVE, ${pct(conditionalRate)} CONDITIONAL, ${pct(rejectRate)} REJECT across ${input.targetCount.toLocaleString()} scenarios.`;
  }
  bodyText(comparison);

  // ── Section 10: Final Investment Interpretation ───────────────────────────
  sectionHeader(10, "Final Investment Interpretation");

  const investable = approveRate + conditionalRate >= 40;
  const stronglyInvestable = approveRate >= 60;
  const marginal = approveRate + conditionalRate >= 20 && approveRate + conditionalRate < 40;

  let interpretation = "";
  if (stronglyInvestable) {
    interpretation = `This deal demonstrates strong resilience across ${input.targetCount.toLocaleString()} simulated strategic futures. With ${pct(approveRate)} of scenarios producing an APPROVE outcome, the investment case is robust. The primary variables driving approval are identified in the Sensitivity Analysis. Further diligence on the top failure vectors is recommended but the investment thesis is well-supported.`;
  } else if (investable) {
    interpretation = `This deal remains investable under most simulated conditions, with ${pct(approveRate + conditionalRate)} of scenarios producing APPROVE or CONDITIONAL outcomes. However, the deal is sensitive to the variables identified in the Sensitivity Analysis. Conditional approval with specific covenants addressing the top failure vectors is the recommended approach.`;
  } else if (marginal) {
    interpretation = `This deal is marginally investable under simulation. Only ${pct(approveRate + conditionalRate)} of scenarios produced positive outcomes. Significant structural improvements are required before the investment case can be made with confidence. The top failure vectors must be addressed before re-evaluation.`;
  } else {
    interpretation = `This deal does not demonstrate sufficient resilience across simulated strategic futures. ${pct(rejectRate + input.decisionDistribution.vetoPct)} of scenarios produced negative outcomes. The investment case requires fundamental restructuring before it can be considered investable.`;
  }

  bodyText(interpretation);
  doc.moveDown(0.3);

  // What must change
  if (input.failureVectors.length > 0) {
    subHeader("What Must Change");
    const topVectors = input.failureVectors.slice(0, 3);
    topVectors.forEach((fv, i) => {
      bodyText(`${i + 1}. ${fv.category.replace(/_/g, " ")} — present in ${pct(fv.affectedPct)} of scenarios. Addressing this dimension would have the highest impact on approval probability.`, 8);
    });
  }

  // What variables matter most
  if (input.sensitivitySurface.length > 0) {
    doc.moveDown(0.3);
    subHeader("Variables That Matter Most");
    input.sensitivitySurface.slice(0, 5).forEach((sv, i) => {
      bodyText(`${i + 1}. ${sv.variable.replace(/_/g, " ")} (impact: ${(sv.impactScore * 100).toFixed(1)}%)`, 8);
    });
  }

  // Further diligence
  doc.moveDown(0.3);
  subHeader("Further Diligence Recommendation");
  if (stronglyInvestable) {
    bodyText("Standard diligence is sufficient. Focus on validating the top 3 sensitivity variables and confirming the governance escalation triggers are manageable.");
  } else if (investable) {
    bodyText("Extended diligence is recommended. Specifically: validate the top failure vectors with management, stress-test the financial model against the sensitivity variables, and confirm governance structures address the escalation triggers.");
  } else {
    bodyText("Deep diligence is required before any investment decision. The simulation indicates structural fragility that cannot be resolved through standard diligence alone. Consider running a follow-up simulation after structural improvements are made.");
  }

  // ── Footer on all pages ───────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(7).fillColor(LGRAY).font("Helvetica")
      .text(
        `AgenThinkMesh · Strategic Stress Test Report · ${input.dealName} · Page ${i + 1} of ${range.count}`,
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
  const sep = "═".repeat(60);
  const dash = "─".repeat(60);

  lines.push(sep);
  lines.push("AI-GOVERNED STRATEGIC STRESS TEST REPORT");
  lines.push(`Deal: ${input.dealName}`);
  lines.push(`Mode: ${modeLabel(input.mode)}`);
  lines.push(`Scenarios: ${input.targetCount.toLocaleString()}`);
  lines.push(`Generated: ${input.generatedAt ?? new Date().toISOString()}`);
  lines.push(sep);
  lines.push("");

  lines.push("1. EXECUTIVE SUMMARY");
  lines.push(dash);
  lines.push(`Simulation Mode:    ${modeLabel(input.mode)}`);
  lines.push(`Scenario Count:     ${input.targetCount.toLocaleString()}`);
  lines.push(`Base Verdict:       ${verdictLabel(input.baseVerdict)}`);
  lines.push(`Approval Rate:      ${pct(input.decisionDistribution.approvePct)}`);
  lines.push(`Conditional Rate:   ${pct(input.decisionDistribution.conditionalPct)}`);
  lines.push(`Rejection Rate:     ${pct(input.decisionDistribution.rejectPct)}`);
  lines.push(`Veto Rate:          ${pct(input.decisionDistribution.vetoPct)}`);
  if (input.executiveSummary) {
    lines.push("");
    lines.push(input.executiveSummary);
  }
  lines.push("");

  lines.push("3. DECISION DISTRIBUTION");
  lines.push(dash);
  lines.push(`APPROVE:            ${pct(input.decisionDistribution.approvePct)}  ${bar(input.decisionDistribution.approvePct)}`);
  lines.push(`CONDITIONAL:        ${pct(input.decisionDistribution.conditionalPct)}  ${bar(input.decisionDistribution.conditionalPct)}`);
  lines.push(`REJECT:             ${pct(input.decisionDistribution.rejectPct)}  ${bar(input.decisionDistribution.rejectPct)}`);
  lines.push(`VETO:               ${pct(input.decisionDistribution.vetoPct)}  ${bar(input.decisionDistribution.vetoPct)}`);
  lines.push("");

  if (input.failureVectors.length > 0) {
    lines.push("4. FAILURE VECTOR RANKING");
    lines.push(dash);
    input.failureVectors.slice(0, 10).forEach((fv, i) => {
      lines.push(`${i + 1}. ${fv.category.replace(/_/g, " ").toUpperCase()}`);
      lines.push(`   Frequency: ${fv.frequency.toLocaleString()} scenarios (${pct(fv.affectedPct)})`);
      lines.push(`   Avg Severity: ${fv.avgSeverity.toFixed(2)}`);
      if (fv.examplePattern) lines.push(`   Example: ${fv.examplePattern}`);
      lines.push("");
    });
  }

  if (input.approvalPathways.length > 0) {
    lines.push("5. APPROVAL PATHWAYS");
    lines.push(dash);
    input.approvalPathways.slice(0, 5).forEach((ap, i) => {
      lines.push(`Pathway ${i + 1}: Approval Probability ${pct(ap.approvalProbability)}, Confidence Lift +${ap.confidenceLift.toFixed(1)}%`);
      if (ap.conditionSet.length > 0) lines.push(`  Conditions: ${ap.conditionSet.join("; ")}`);
      if (ap.remainingRisks.length > 0) lines.push(`  Remaining Risks: ${ap.remainingRisks.join("; ")}`);
      lines.push("");
    });
  }

  if (input.sensitivitySurface.length > 0) {
    lines.push("6. SENSITIVITY ANALYSIS");
    lines.push(dash);
    input.sensitivitySurface.slice(0, 12).forEach((sv, i) => {
      lines.push(`${i + 1}. ${sv.variable.replace(/_/g, " ")} — Impact: ${(sv.impactScore * 100).toFixed(1)}% (${sv.direction})`);
    });
    lines.push("");
  }

  if (input.governanceHeatmap.length > 0) {
    lines.push("7. GOVERNANCE ESCALATION MAP");
    lines.push(dash);
    input.governanceHeatmap.slice(0, 8).forEach((gh, i) => {
      lines.push(`${i + 1}. ${gh.category.replace(/_/g, " ").toUpperCase()}`);
      lines.push(`   Escalations: ${gh.escalationCount.toLocaleString()}, Vetoes: ${gh.vetoCount.toLocaleString()}, Avg Severity: ${gh.avgSeverity.toFixed(2)}`);
    });
    lines.push("");
  }

  lines.push("10. FINAL INVESTMENT INTERPRETATION");
  lines.push(dash);
  const approveRate = input.decisionDistribution.approvePct;
  const conditionalRate = input.decisionDistribution.conditionalPct;
  const rejectRate = input.decisionDistribution.rejectPct;
  const investable = approveRate + conditionalRate >= 40;
  const stronglyInvestable = approveRate >= 60;
  if (stronglyInvestable) {
    lines.push(`INVESTABLE — ${pct(approveRate)} of scenarios approved. Strong resilience confirmed.`);
  } else if (investable) {
    lines.push(`CONDITIONALLY INVESTABLE — ${pct(approveRate + conditionalRate)} of scenarios produced positive outcomes.`);
  } else {
    lines.push(`NOT INVESTABLE — ${pct(rejectRate + input.decisionDistribution.vetoPct)} of scenarios rejected. Structural improvements required.`);
  }
  if (input.failureVectors.length > 0) {
    lines.push("");
    lines.push("What Must Change:");
    input.failureVectors.slice(0, 3).forEach((fv, i) => {
      lines.push(`  ${i + 1}. ${fv.category.replace(/_/g, " ")} (${pct(fv.affectedPct)} of scenarios)`);
    });
  }
  if (input.sensitivitySurface.length > 0) {
    lines.push("");
    lines.push("Variables That Matter Most:");
    input.sensitivitySurface.slice(0, 5).forEach((sv, i) => {
      lines.push(`  ${i + 1}. ${sv.variable.replace(/_/g, " ")} (${(sv.impactScore * 100).toFixed(1)}%)`);
    });
  }
  lines.push("");
  lines.push(sep);
  lines.push("END OF REPORT — AgenThinkMesh Scenario Simulation Engine");
  lines.push(sep);

  return lines.join("\n");
}
