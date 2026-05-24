/**
 * upgradeProtocolPdf.ts — Institutional Investment Readiness Report Generator
 *
 * Produces a standalone PDF from the Decision Upgrade Protocol output.
 * 8 sections:
 *   1. Executive Summary
 *   2. Required Missing Inputs
 *   3. Performance Gaps
 *   4. Structural Weaknesses
 *   5. Risk Mitigation Requirements
 *   6. Narrative Improvements
 *   7. Upgrade Impact Forecast
 *   8. Re-run Summary (if delta available)
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
  // Optional delta (re-run summary)
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
  return map[v.toUpperCase()] ?? v.toUpperCase();
}

function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    ASSUMED: "⚠ ASSUMED",
    IMPROVED: "✓ IMPROVED",
    USER_REQUIRED: "⚡ USER REQUIRED",
  };
  return map[tag] ?? tag;
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

function wrap(text: string, maxLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxLen) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateUpgradeProtocolPdf(input: UpgradeProtocolInput): Promise<Buffer> {
  // Dynamic import to avoid top-level side effects
  const PDFDocument = (await import("pdfkit")).default;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: `Investment Readiness Report — ${input.dealName}`,
      Author: "AgenThinkMesh Decision Engine",
      Subject: "Decision Upgrade Protocol",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));

  const W = 595.28;
  const CONTENT_W = W - 112; // 56px margins each side
  const L = 56; // left margin

  // ── Colours ────────────────────────────────────────────────────────────────
  const BLACK   = "#0A0A0A";
  const WHITE   = "#FFFFFF";
  const ACCENT  = "#1A3C5E";   // dark navy
  const GOLD    = "#C9A84C";
  const RED     = "#C0392B";
  const GREEN   = "#1E7E34";
  const AMBER   = "#D4860A";
  const GRAY    = "#555555";
  const LGRAY   = "#888888";
  const BGLIGHT = "#F8F9FA";
  const BORDER  = "#D0D5DD";

  // ── Helpers ────────────────────────────────────────────────────────────────

  function newPage() {
    doc.addPage();
    // Subtle header rule
    doc.moveTo(L, 40).lineTo(W - L, 40).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.fontSize(7).fillColor(LGRAY).font("Helvetica")
      .text(`AGENTHINK MESH · INVESTMENT READINESS REPORT — ${input.dealName.toUpperCase()}`, L, 28, { width: CONTENT_W, align: "left" });
    doc.moveDown(0.5);
  }

  function sectionHeader(num: number, title: string) {
    // Ensure enough space
    if (doc.y > 680) newPage();
    doc.moveDown(0.8);
    // Rule
    doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.5).strokeColor(ACCENT).stroke();
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor(ACCENT).font("Helvetica-Bold")
      .text(`${num}. ${title.toUpperCase()}`, L, doc.y, { width: CONTENT_W });
    doc.moveDown(0.4);
  }

  function subHeader(text: string) {
    if (doc.y > 700) newPage();
    doc.fontSize(9).fillColor(ACCENT).font("Helvetica-Bold")
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
      .text(label + ":", L + indent, doc.y, { continued: true, width: 110 });
    doc.fillColor(BLACK).font("Helvetica")
      .text("  " + (value || "—"), { width: CONTENT_W - indent - 110 });
    doc.moveDown(0.2);
  }

  function tagBadge(tag: string) {
    const colors: Record<string, string> = {
      ASSUMED: AMBER, IMPROVED: GREEN, USER_REQUIRED: "#1A6FBF",
    };
    const col = colors[tag] ?? GRAY;
    const lbl = tagLabel(tag);
    if (doc.y > 720) newPage();
    doc.fontSize(7.5).fillColor(col).font("Helvetica-Bold")
      .text(`[${lbl}]`, L + 8, doc.y, { width: CONTENT_W });
    doc.moveDown(0.15);
  }

  function fixCard(fix: UpgradeFixInput, idx: number) {
    if (doc.y > 680) newPage();
    // Card background
    const cardY = doc.y;
    doc.rect(L, cardY, CONTENT_W, 1).fill(BGLIGHT);
    doc.moveDown(0.1);

    // Number + title
    doc.fontSize(9).fillColor(ACCENT).font("Helvetica-Bold")
      .text(`${idx + 1}. ${fix.title}`, L + 8, doc.y, { width: CONTENT_W - 16 });
    doc.moveDown(0.2);

    tagBadge(fix.tag);
    labelValue("Category", categoryLabel(fix.category), 8);
    bodyText(fix.description, 8);
    if (fix.suggestion) {
      subHeader("  Recommendation");
      bodyText(fix.suggestion, 8);
    }
    if (fix.exampleValue) {
      labelValue("Example", fix.exampleValue, 8);
    }
    // Bottom rule
    doc.moveTo(L, doc.y).lineTo(W - L, doc.y).lineWidth(0.3).strokeColor(BORDER).stroke();
    doc.moveDown(0.4);
  }

  // ── Cover Page ─────────────────────────────────────────────────────────────

  // Navy header band
  doc.rect(0, 0, W, 180).fill(ACCENT);

  // Logo
  try {
    const logoBuffer = await fetchBuffer(LOGO_CDN_URL);
    doc.image(logoBuffer, L, 20, { height: 32 });
  } catch {
    doc.fontSize(14).fillColor(WHITE).font("Helvetica-Bold").text("AGENTHINK MESH", L, 24);
  }

  // Report type label
  doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold")
    .text("INSTITUTIONAL INVESTMENT READINESS REPORT", L, 70, { width: CONTENT_W, align: "center" });

  // Deal name
  const dealLines = wrap(input.dealName.toUpperCase(), 42);
  let dealY = 90;
  for (const line of dealLines) {
    doc.fontSize(22).fillColor(WHITE).font("Helvetica-Bold")
      .text(line, L, dealY, { width: CONTENT_W, align: "center" });
    dealY += 28;
  }

  // Verdict badge
  const vLabel = verdictLabel(input.verdictBefore);
  const vColor = ["REJECTED", "VETOED"].some(x => vLabel.includes(x)) ? RED
    : vLabel.includes("CONDITIONAL") ? AMBER
    : GREEN;
  doc.fontSize(11).fillColor(vColor).font("Helvetica-Bold")
    .text(`CURRENT VERDICT: ${vLabel}`, L, 155, { width: CONTENT_W, align: "center" });

  // Meta row
  doc.rect(0, 180, W, 36).fill("#F0F4F8");
  doc.fontSize(8).fillColor(GRAY).font("Helvetica")
    .text(`Generated: ${input.generatedAt ?? new Date().toISOString().split("T")[0]}   ·   Confidence: ${input.confidenceBefore}%   ·   Total Fixes: ${input.allFixes.length}   ·   AgenThinkMesh Decision Engine`, L, 193, { width: CONTENT_W, align: "center" });

  doc.y = 230;

  // ── Preamble ───────────────────────────────────────────────────────────────
  doc.fontSize(9).fillColor(GRAY).font("Helvetica")
    .text("This report has been generated by the AgenThinkMesh Decision Upgrade Engine. It identifies the specific inputs, structural issues, performance gaps, and narrative improvements required to improve this deal's investment readiness. Each fix is tagged by type and ranked by impact. Apply the required fixes and re-run the Council of 10 to validate the upgraded verdict.", L, doc.y, { width: CONTENT_W, align: "justify" });
  doc.moveDown(1);

  // ── Section 1: Executive Summary ──────────────────────────────────────────
  sectionHeader(1, "Executive Summary");

  const expectedVerdict = input.expectedOutcomeShift.predictedVerdict;
  const confDelta = input.expectedOutcomeShift.confidenceDelta;

  labelValue("Current Verdict", verdictLabel(input.verdictBefore));
  labelValue("Current Confidence", `${input.confidenceBefore}%`);
  labelValue("Expected Upgraded Verdict", verdictLabel(expectedVerdict));
  labelValue("Expected Confidence Delta", `${confDelta >= 0 ? "+" : ""}${confDelta}%`);
  labelValue("Total Fixes Identified", `${input.allFixes.length}`);
  labelValue("User-Required Fixes", `${input.allFixes.filter(f => f.tag === "USER_REQUIRED").length}`);
  labelValue("AI-Inferred Fixes", `${input.allFixes.filter(f => f.tag === "ASSUMED" || f.tag === "IMPROVED").length}`);

  doc.moveDown(0.4);
  if (input.expectedOutcomeShift.rationale) {
    subHeader("Why This Deal Failed / Passed Conditionally");
    bodyText(input.expectedOutcomeShift.rationale);
  }

  // ── Section 2: Required Missing Inputs ────────────────────────────────────
  if (input.missingInputs.length > 0) {
    sectionHeader(2, "Required Missing Inputs");
    bodyText(`${input.missingInputs.length} missing input${input.missingInputs.length !== 1 ? "s" : ""} identified. These are data points the Council of 10 could not evaluate due to absence of evidence.`);
    doc.moveDown(0.3);
    input.missingInputs.forEach((fix, i) => fixCard(fix, i));
  }

  // ── Section 3: Performance Gaps ───────────────────────────────────────────
  if (input.performanceGaps.length > 0) {
    sectionHeader(3, "Performance Gaps");
    bodyText(`${input.performanceGaps.length} performance gap${input.performanceGaps.length !== 1 ? "s" : ""} identified. These are areas where the deal's metrics fall below institutional benchmarks.`);
    doc.moveDown(0.3);
    input.performanceGaps.forEach((fix, i) => fixCard(fix, i));
  }

  // ── Section 4: Structural Weaknesses ──────────────────────────────────────
  if (input.structuralIssues.length > 0) {
    sectionHeader(4, "Structural Weaknesses");
    bodyText(`${input.structuralIssues.length} structural issue${input.structuralIssues.length !== 1 ? "s" : ""} identified. These include moat, governance, funding, execution, and commercial model concerns.`);
    doc.moveDown(0.3);
    input.structuralIssues.forEach((fix, i) => fixCard(fix, i));
  }

  // ── Section 5: Risk Mitigation Requirements ───────────────────────────────
  if (input.riskMitigationActions.length > 0) {
    sectionHeader(5, "Risk Mitigation Requirements");
    bodyText(`${input.riskMitigationActions.length} risk mitigation action${input.riskMitigationActions.length !== 1 ? "s" : ""} required before investment can proceed.`);
    doc.moveDown(0.3);
    input.riskMitigationActions.forEach((fix, i) => fixCard(fix, i));
  }

  // ── Section 6: Narrative Improvements ────────────────────────────────────
  sectionHeader(6, "Narrative Improvements");
  if (input.narrativeFix.original || input.narrativeFix.improved) {
    subHeader("Original Narrative");
    bodyText(input.narrativeFix.original || "—");
    doc.moveDown(0.3);
    subHeader("Improved Narrative");
    bodyText(input.narrativeFix.improved || "—");
    doc.moveDown(0.3);
    subHeader("Rationale");
    bodyText(input.narrativeFix.rationale || "—");
  } else {
    bodyText("No narrative improvement required.");
  }

  // ── Section 7: Upgrade Impact Forecast ───────────────────────────────────
  sectionHeader(7, "Upgrade Impact Forecast");
  labelValue("Predicted Verdict (All Fixes Applied)", verdictLabel(input.expectedOutcomeShift.predictedVerdict));
  labelValue("Expected Confidence Change", `${confDelta >= 0 ? "+" : ""}${confDelta}%`);
  doc.moveDown(0.3);
  bodyText(input.expectedOutcomeShift.rationale || "Apply all USER_REQUIRED fixes first. AI-inferred fixes (ASSUMED/IMPROVED) will further strengthen the narrative but require human validation.");

  // Remaining blockers
  const blockers = input.allFixes.filter(f => f.tag === "USER_REQUIRED");
  if (blockers.length > 0) {
    doc.moveDown(0.3);
    subHeader("Remaining Blockers (User Action Required)");
    blockers.forEach((b, i) => {
      bodyText(`${i + 1}. ${b.title} — ${b.description}`, 8);
    });
  }

  // ── Section 8: Re-run Summary (if delta available) ────────────────────────
  if (input.delta) {
    const d = input.delta;
    sectionHeader(8, "Re-run Summary");
    bodyText("The following comparison reflects the council re-evaluation after applying the selected fixes.");
    doc.moveDown(0.3);

    labelValue("Verdict Before", verdictLabel(d.verdictBefore));
    labelValue("Verdict After", verdictLabel(d.verdictAfter));
    labelValue("Verdict Changed", d.verdictChanged ? "YES" : "NO");
    labelValue("Confidence Before", `${d.confidenceBefore}%`);
    labelValue("Confidence After", `${d.confidenceAfter}%`);
    labelValue("Confidence Delta", `${d.confidenceDelta >= 0 ? "+" : ""}${d.confidenceDelta}%`);

    if (d.keyMetricChanges.length > 0) {
      doc.moveDown(0.3);
      subHeader("Key Metric Changes");
      d.keyMetricChanges.forEach(m => {
        const arrow = m.direction === "improved" ? "↑" : m.direction === "worsened" ? "↓" : "→";
        bodyText(`${arrow} ${m.metric}: ${m.before} → ${m.after}`, 8);
      });
    }

    if (d.topImprovementFactors.length > 0) {
      doc.moveDown(0.3);
      subHeader("Top Improvement Factors");
      d.topImprovementFactors.forEach((f, i) => bodyText(`${i + 1}. ${f}`, 8));
    }

    if (d.remainingGaps.length > 0) {
      doc.moveDown(0.3);
      subHeader("Remaining Gaps");
      d.remainingGaps.forEach((g, i) => bodyText(`${i + 1}. ${g}`, 8));
    }

    if (d.summary) {
      doc.moveDown(0.3);
      subHeader("Summary");
      bodyText(d.summary);
    }
  }

  // ── Footer on all pages ───────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(7).fillColor(LGRAY).font("Helvetica")
      .text(
        `AgenThinkMesh · Investment Readiness Report · ${input.dealName} · Page ${i + 1} of ${range.count}`,
        L, 820, { width: CONTENT_W, align: "center" }
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
  const sep = "═".repeat(60);
  const dash = "─".repeat(60);

  lines.push(sep);
  lines.push("INSTITUTIONAL INVESTMENT READINESS REPORT");
  lines.push(`Deal: ${input.dealName}`);
  lines.push(`Generated: ${input.generatedAt ?? new Date().toISOString()}`);
  lines.push(sep);
  lines.push("");

  // Section 1
  lines.push("1. EXECUTIVE SUMMARY");
  lines.push(dash);
  lines.push(`Current Verdict:          ${verdictLabel(input.verdictBefore)}`);
  lines.push(`Current Confidence:       ${input.confidenceBefore}%`);
  lines.push(`Expected Upgraded Verdict: ${verdictLabel(input.expectedOutcomeShift.predictedVerdict)}`);
  lines.push(`Expected Confidence Delta: ${input.expectedOutcomeShift.confidenceDelta >= 0 ? "+" : ""}${input.expectedOutcomeShift.confidenceDelta}%`);
  lines.push(`Total Fixes Identified:   ${input.allFixes.length}`);
  lines.push(`User-Required Fixes:      ${input.allFixes.filter(f => f.tag === "USER_REQUIRED").length}`);
  lines.push(`AI-Inferred Fixes:        ${input.allFixes.filter(f => f.tag === "ASSUMED" || f.tag === "IMPROVED").length}`);
  if (input.expectedOutcomeShift.rationale) {
    lines.push("");
    lines.push(input.expectedOutcomeShift.rationale);
  }
  lines.push("");

  // Section 2
  if (input.missingInputs.length > 0) {
    lines.push("2. REQUIRED MISSING INPUTS");
    lines.push(dash);
    input.missingInputs.forEach((fix, i) => {
      lines.push(`${i + 1}. [${tagLabel(fix.tag)}] ${fix.title}`);
      lines.push(`   Category: ${categoryLabel(fix.category)}`);
      lines.push(`   ${fix.description}`);
      if (fix.suggestion) lines.push(`   Recommendation: ${fix.suggestion}`);
      lines.push("");
    });
  }

  // Section 3
  if (input.performanceGaps.length > 0) {
    lines.push("3. PERFORMANCE GAPS");
    lines.push(dash);
    input.performanceGaps.forEach((fix, i) => {
      lines.push(`${i + 1}. [${tagLabel(fix.tag)}] ${fix.title}`);
      lines.push(`   ${fix.description}`);
      if (fix.suggestion) lines.push(`   Recommendation: ${fix.suggestion}`);
      lines.push("");
    });
  }

  // Section 4
  if (input.structuralIssues.length > 0) {
    lines.push("4. STRUCTURAL WEAKNESSES");
    lines.push(dash);
    input.structuralIssues.forEach((fix, i) => {
      lines.push(`${i + 1}. [${tagLabel(fix.tag)}] ${fix.title}`);
      lines.push(`   ${fix.description}`);
      if (fix.suggestion) lines.push(`   Recommendation: ${fix.suggestion}`);
      lines.push("");
    });
  }

  // Section 5
  if (input.riskMitigationActions.length > 0) {
    lines.push("5. RISK MITIGATION REQUIREMENTS");
    lines.push(dash);
    input.riskMitigationActions.forEach((fix, i) => {
      lines.push(`${i + 1}. [${tagLabel(fix.tag)}] ${fix.title}`);
      lines.push(`   ${fix.description}`);
      if (fix.suggestion) lines.push(`   Recommendation: ${fix.suggestion}`);
      lines.push("");
    });
  }

  // Section 6
  lines.push("6. NARRATIVE IMPROVEMENTS");
  lines.push(dash);
  lines.push(`Original: ${input.narrativeFix.original || "—"}`);
  lines.push(`Improved: ${input.narrativeFix.improved || "—"}`);
  lines.push(`Rationale: ${input.narrativeFix.rationale || "—"}`);
  lines.push("");

  // Section 7
  lines.push("7. UPGRADE IMPACT FORECAST");
  lines.push(dash);
  lines.push(`Predicted Verdict (All Fixes Applied): ${verdictLabel(input.expectedOutcomeShift.predictedVerdict)}`);
  lines.push(`Expected Confidence Change: ${input.expectedOutcomeShift.confidenceDelta >= 0 ? "+" : ""}${input.expectedOutcomeShift.confidenceDelta}%`);
  lines.push("");
  lines.push(input.expectedOutcomeShift.rationale || "");
  const blockers = input.allFixes.filter(f => f.tag === "USER_REQUIRED");
  if (blockers.length > 0) {
    lines.push("");
    lines.push("Remaining Blockers (User Action Required):");
    blockers.forEach((b, i) => lines.push(`  ${i + 1}. ${b.title} — ${b.description}`));
  }
  lines.push("");

  // Section 8
  if (input.delta) {
    const d = input.delta;
    lines.push("8. RE-RUN SUMMARY");
    lines.push(dash);
    lines.push(`Verdict Before:    ${verdictLabel(d.verdictBefore)}`);
    lines.push(`Verdict After:     ${verdictLabel(d.verdictAfter)}`);
    lines.push(`Verdict Changed:   ${d.verdictChanged ? "YES" : "NO"}`);
    lines.push(`Confidence Before: ${d.confidenceBefore}%`);
    lines.push(`Confidence After:  ${d.confidenceAfter}%`);
    lines.push(`Confidence Delta:  ${d.confidenceDelta >= 0 ? "+" : ""}${d.confidenceDelta}%`);
    if (d.keyMetricChanges.length > 0) {
      lines.push("");
      lines.push("Key Metric Changes:");
      d.keyMetricChanges.forEach(m => {
        const arrow = m.direction === "improved" ? "↑" : m.direction === "worsened" ? "↓" : "→";
        lines.push(`  ${arrow} ${m.metric}: ${m.before} → ${m.after}`);
      });
    }
    if (d.topImprovementFactors.length > 0) {
      lines.push("");
      lines.push("Top Improvement Factors:");
      d.topImprovementFactors.forEach((f, i) => lines.push(`  ${i + 1}. ${f}`));
    }
    if (d.remainingGaps.length > 0) {
      lines.push("");
      lines.push("Remaining Gaps:");
      d.remainingGaps.forEach((g, i) => lines.push(`  ${i + 1}. ${g}`));
    }
    if (d.summary) {
      lines.push("");
      lines.push(d.summary);
    }
    lines.push("");
  }

  lines.push(sep);
  lines.push("END OF REPORT — AgenThinkMesh Decision Upgrade Engine");
  lines.push(sep);

  return lines.join("\n");
}
