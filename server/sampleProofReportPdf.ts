/**
 * sampleProofReportPdf.ts — Sample Institutional Proof Report PDF Generator
 *
 * Produces a clean, prospect-ready PDF from deterministic demo data.
 * No Council session required. Completely independent of real session infrastructure.
 *
 * Sections:
 *  1. Executive Summary
 *  2. Governance Findings
 *  3. Constitution Version
 *  4. Calibration Context
 *  5. Historical Precedents
 *  6. Release Gate Determination
 *  7. Audit References
 */

// ── Colours ───────────────────────────────────────────────────────────────────
const BRAND_DARK       = "#0a0f1e";
const BRAND_BLUE       = "#1e6bff";
const BRAND_LIGHT_BLUE = "#4a9eff";
const TEXT_PRIMARY     = "#1a1a2e";
const TEXT_SECONDARY   = "#4a4a6a";
const TEXT_MUTED       = "#8888aa";
const BORDER_COLOR     = "#e0e0f0";
const SECTION_BG       = "#f8f9ff";
const RELEASED_GREEN   = "#16a34a";
const WARN_AMBER       = "#d97706";
const PASS_GREEN       = "#15803d";

// ── Sample data (mirrors SampleProofReportModal.tsx SAMPLE_PROOF_REPORT) ──────

const SAMPLE = {
  meta: {
    reportId:           "IPR-2024-DEMO-001",
    sessionId:          "SESSION-DEMO-HELIOS-NORTH-001",
    dealName:           "Helios-North Renewable Energy Infrastructure Fund",
    generatedAt:        "2024-11-15T09:42:00Z",
    constitutionVersion:"v4.2.1",
    councilMode:        "INFRASTRUCTURE",
    verdict:            "APPROVED WITH CONDITIONS",
    confidenceScore:    0.74,
    yesCount:           7,
    noCount:            3,
  },
  executiveSummary: {
    headline: "Approved with Conditions — 7/10 Council Members in Favour",
    body: `The Helios-North Renewable Energy Infrastructure Fund (€2.1B target, 15-year horizon) received conditional approval from the AgenThink Mesh Council of Specialists. Seven of ten specialist agents voted in favour. The three dissenting votes cited regulatory timeline uncertainty in the German offshore wind permitting regime and concentration risk in a single-jurisdiction asset base.

The Council determined that the deal is structurally sound, the sponsor track record is credible, and the macro tailwinds (EU Green Deal, REPowerEU) are durable. Conditions attach to: (1) a binding regulatory milestone gate at 18 months, (2) a minimum 20% geographic diversification requirement before Fund II drawdown, and (3) enhanced LP reporting on permitting status quarterly.`,
    keyFindings: [
      "Sponsor IRR track record of 14.2% net across three prior infrastructure funds verified.",
      "German offshore wind permitting risk: 34% probability of 18–24 month delay under base case.",
      "EU taxonomy alignment confirmed at 91% of projected AUM — above the 85% constitutional threshold.",
      "LP concentration risk: top 3 LPs represent 61% of committed capital, exceeding the 55% soft limit.",
      "FX hedging programme covers 78% of EUR/USD exposure — within constitutional tolerance.",
    ],
  },
  governanceFindings: [
    { id: "GF-001", severity: "MEDIUM", title: "German Offshore Wind Permitting Delay Risk",       resolution: "CONDITION: Regulatory milestone gate at 18 months. Max 40% drawdown until BNetzA approval." },
    { id: "GF-002", severity: "LOW",    title: "LP Concentration Above Soft Limit (61% vs 55%)",   resolution: "CONDITION: Quarterly LP liquidity reporting added to LPA." },
    { id: "GF-003", severity: "LOW",    title: "Single-Jurisdiction Concentration in Germany (87%)", resolution: "CONDITION: Min 20% geographic diversification before Fund II first close." },
    { id: "GF-004", severity: "PASS",   title: "EU Taxonomy Alignment — 91% (threshold: 85%)",     resolution: "PASS — No condition required." },
    { id: "GF-005", severity: "PASS",   title: "Sponsor Track Record — 14.2% net IRR (min: 12%)",  resolution: "PASS — No condition required." },
  ],
  constitution: {
    version:       "v4.2.1",
    effectiveDate: "2024-09-01",
    hash:          "sha256:a3f8c2d1e9b47f6a2c8d3e1f9b47a6c2d8e3f1b9a47c6d2e8f3b1a9c47d6e2",
    rules: [
      { id: "INFRA-RISK-003",      title: "Regulatory Timeline Risk Stress Testing",      section: "§7.3",  status: "APPLIED" },
      { id: "FUND-STRUCT-007",     title: "LP Concentration Reporting Threshold",          section: "§12.1", status: "APPLIED" },
      { id: "INFRA-DIVERSIFY-002", title: "Single-Jurisdiction Diversification Condition", section: "§9.4",  status: "APPLIED" },
      { id: "ESG-TAXONOMY-001",    title: "EU Taxonomy Alignment Minimum",                 section: "§15.2", status: "APPLIED" },
      { id: "SPONSOR-TRACK-001",   title: "Sponsor Track Record Minimum",                  section: "§4.1",  status: "APPLIED" },
    ],
  },
  calibration: {
    comparableDeals:    847,
    baseRateApproval:   0.68,
    dealConfidence:     0.74,
    peerMedianConf:     0.72,
    notes: "Council confidence scores calibrated against 847 comparable infrastructure fund decisions (2018–2024). Renewable energy infrastructure funds in the €1.5B–€3B range show a 71% approval rate with an average of 1.8 conditions attached.",
    peerGroup: "Renewable energy infrastructure funds, European jurisdiction, €1.5B–€3B target, 12–18 year horizon, closed 2018–2024.",
  },
  precedents: [
    { id: "PREC-2023-047", name: "Nordic Wind Partners Fund III",            year: 2023, outcome: "APPROVED WITH CONDITIONS", similarity: 89, lesson: "Milestone gate conditions on permitting risk are effective. 94% met the gate within the specified timeframe." },
    { id: "PREC-2022-031", name: "Meridian Offshore Energy Infrastructure",  year: 2022, outcome: "APPROVED WITH CONDITIONS", similarity: 82, lesson: "LP concentration above 55% (top 3) is manageable with enhanced reporting." },
    { id: "PREC-2021-019", name: "Solaris European Renewables Fund",         year: 2021, outcome: "REJECTED",                 similarity: 61, lesson: "Single-jurisdiction concentration above 85% in politically volatile jurisdictions is a material risk." },
  ],
  releaseGate: {
    status: "CONDITIONAL RELEASE",
    narrative: "The Council authorises conditional release. Three conditions attach. No hard BLOCK violations were identified. The deal may proceed to LP close subject to satisfaction of all three conditions.",
    conditions: [
      { id: "COND-001", title: "Regulatory Milestone Gate — BNetzA Approval",  deadline: "2026-05-15",       rule: "INFRA-RISK-003 / §7.3" },
      { id: "COND-002", title: "LP Concentration — Enhanced Quarterly Reporting", deadline: "2024-12-31",    rule: "FUND-STRUCT-007 / §12.1" },
      { id: "COND-003", title: "Geographic Diversification — Fund II Commitment", deadline: "Fund II close", rule: "INFRA-DIVERSIFY-002 / §9.4" },
    ],
  },
  auditRefs: [
    { id: "AUD-001", type: "COUNCIL_SESSION",      desc: "Council session transcript — 10 specialist agents, 47-minute deliberation",      date: "2024-11-15" },
    { id: "AUD-002", type: "CONSTITUTION_SNAPSHOT", desc: "Constitution v4.2.1 snapshot at time of decision",                               date: "2024-11-15" },
    { id: "AUD-003", type: "CALIBRATION_DATASET",   desc: "Calibration dataset v2024.Q3 — 847 comparable infrastructure fund decisions",    date: "2024-11-01" },
    { id: "AUD-004", type: "DEAL_TEXT_HASH",         desc: "SHA-256 hash of submitted deal memorandum (v3, final)",                         date: "2024-11-14" },
    { id: "AUD-005", type: "PRECEDENT_DATABASE",     desc: "Historical precedent database v2024.Q3 — 3 comparable precedents cited",        date: "2024-11-01" },
    { id: "AUD-006", type: "RELEASE_GATE_LOG",       desc: "Release gate evaluation log — CONDITIONAL_RELEASE, 3 conditions, 0 hard blocks", date: "2024-11-15" },
  ],
};

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateSampleProofReportPdf(): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      info: {
        Title:   "Institutional Proof Report — Sample",
        Author:  "AgenThink Mesh Governed Decision Infrastructure",
        Subject: "Sample Institutional Proof Report",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 120; // usable width

    // ── Helpers ──────────────────────────────────────────────────────────────

    function hRule(y?: number) {
      const yy = y ?? doc.y;
      doc.moveTo(60, yy).lineTo(60 + W, yy).strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
    }

    function sectionHeader(title: string) {
      doc.moveDown(0.8);
      doc.rect(60, doc.y, W, 20).fill(SECTION_BG);
      doc.fillColor(BRAND_DARK).fontSize(9).font("Helvetica-Bold")
         .text(title, 68, doc.y + 5, { width: W - 16 });
      doc.moveDown(0.3);
    }

    function badge(text: string, x: number, y: number, color: string) {
      const tw = doc.fontSize(7).widthOfString(text);
      doc.roundedRect(x, y - 1, tw + 10, 12, 3).fill(color + "22");
      doc.fillColor(color).fontSize(7).font("Helvetica-Bold").text(text, x + 5, y, { lineBreak: false });
    }

    // ── Cover ─────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 160).fill(BRAND_DARK);
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica")
       .text("SAMPLE REPORT · DETERMINISTIC DEMO DATA · NOT A REAL TRANSACTION", 60, 30, { width: W, align: "center" });
    doc.fillColor(BRAND_LIGHT_BLUE).fontSize(18).font("Helvetica-Bold")
       .text("Institutional Proof Report", 60, 55, { width: W, align: "center" });
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica")
       .text(SAMPLE.meta.dealName, 60, 82, { width: W, align: "center" });
    doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica")
       .text(`Report ID: ${SAMPLE.meta.reportId}  ·  Session: ${SAMPLE.meta.sessionId}`, 60, 102, { width: W, align: "center" })
       .text(`Constitution: ${SAMPLE.meta.constitutionVersion}  ·  Generated: ${SAMPLE.meta.generatedAt.slice(0, 10)}`, 60, 116, { width: W, align: "center" });

    // Trust badges row
    const badges = ["Machine-Verifiable", "Audit Ready", "Governance Traceable"];
    const bW = 110;
    const startX = (doc.page.width - badges.length * bW) / 2;
    badges.forEach((b, i) => {
      doc.roundedRect(startX + i * bW, 138, bW - 8, 14, 3).fill(RELEASED_GREEN + "33");
      doc.fillColor(RELEASED_GREEN).fontSize(7).font("Helvetica-Bold")
         .text(b, startX + i * bW + 4, 142, { width: bW - 16, align: "center", lineBreak: false });
    });

    doc.y = 180;

    // ── Meta row ──────────────────────────────────────────────────────────────
    const metaItems = [
      { label: "VERDICT",      value: SAMPLE.meta.verdict,                                  color: BRAND_BLUE },
      { label: "CONFIDENCE",   value: `${Math.round(SAMPLE.meta.confidenceScore * 100)}%`,  color: TEXT_PRIMARY },
      { label: "COUNCIL VOTE", value: `${SAMPLE.meta.yesCount}/10 YES`,                     color: RELEASED_GREEN },
      { label: "MODE",         value: SAMPLE.meta.councilMode,                              color: TEXT_SECONDARY },
    ];
    const mW = W / metaItems.length;
    metaItems.forEach((m, i) => {
      const x = 60 + i * mW;
      doc.rect(x, doc.y, mW - 4, 36).fill(SECTION_BG);
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica").text(m.label, x + 6, doc.y + 6, { width: mW - 12 });
      doc.fillColor(m.color).fontSize(9).font("Helvetica-Bold").text(m.value, x + 6, doc.y + 17, { width: mW - 12 });
    });
    doc.moveDown(2.8);

    // ── 1. Executive Summary ──────────────────────────────────────────────────
    sectionHeader("1 · EXECUTIVE SUMMARY");
    doc.fillColor(BRAND_DARK).fontSize(10).font("Helvetica-Bold")
       .text(SAMPLE.executiveSummary.headline, 68, doc.y + 4, { width: W - 16 });
    doc.moveDown(0.4);
    doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica")
       .text(SAMPLE.executiveSummary.body, 68, doc.y, { width: W - 16, lineGap: 2 });
    doc.moveDown(0.6);
    doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold").text("Key Findings:", 68, doc.y);
    doc.moveDown(0.2);
    SAMPLE.executiveSummary.keyFindings.forEach(f => {
      doc.fillColor(BRAND_BLUE).fontSize(8).font("Helvetica").text("▶", 68, doc.y, { continued: true, width: 12 });
      doc.fillColor(TEXT_SECONDARY).text(`  ${f}`, { width: W - 28 });
      doc.moveDown(0.1);
    });

    // ── 2. Governance Findings ────────────────────────────────────────────────
    sectionHeader("2 · GOVERNANCE FINDINGS");
    SAMPLE.governanceFindings.forEach(gf => {
      const rowY = doc.y + 2;
      const severityColor = gf.severity === "PASS" ? PASS_GREEN : gf.severity === "MEDIUM" ? WARN_AMBER : BRAND_LIGHT_BLUE;
      doc.rect(68, rowY, W - 16, 38).fill("#ffffff").stroke(BORDER_COLOR);
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica").text(gf.id, 74, rowY + 4, { lineBreak: false });
      badge(gf.severity, 110, rowY + 3, severityColor);
      doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold").text(gf.title, 74, rowY + 16, { width: W - 40 });
      doc.fillColor(RELEASED_GREEN).fontSize(7).font("Helvetica").text(gf.resolution, 74, rowY + 27, { width: W - 40 });
      doc.y = rowY + 44;
    });

    // ── 3. Constitution Version ───────────────────────────────────────────────
    sectionHeader("3 · CONSTITUTION VERSION");
    doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica")
       .text(`Version: ${SAMPLE.constitution.version}  ·  Effective: ${SAMPLE.constitution.effectiveDate}`, 68, doc.y + 4);
    doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
       .text(`Hash: ${SAMPLE.constitution.hash}`, 68, doc.y + 2, { width: W - 16 });
    doc.moveDown(0.5);
    SAMPLE.constitution.rules.forEach(r => {
      doc.fillColor(BRAND_LIGHT_BLUE).fontSize(7).font("Helvetica-Bold").text(r.id, 68, doc.y, { continued: true, width: 120 });
      doc.fillColor(TEXT_SECONDARY).font("Helvetica").text(`  ${r.title}  `, { continued: true, width: W - 180 });
      doc.fillColor(TEXT_MUTED).text(r.section, { continued: true, width: 30 });
      doc.fillColor(PASS_GREEN).text(`  ${r.status}`, { width: 60 });
      doc.moveDown(0.1);
    });

    // ── 4. Calibration Context ────────────────────────────────────────────────
    sectionHeader("4 · CALIBRATION CONTEXT");
    doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica")
       .text(SAMPLE.calibration.notes, 68, doc.y + 4, { width: W - 16, lineGap: 2 });
    doc.moveDown(0.4);
    const calItems = [
      { l: "Comparable Deals",  v: SAMPLE.calibration.comparableDeals.toString() },
      { l: "Base Rate Approval", v: `${Math.round(SAMPLE.calibration.baseRateApproval * 100)}%` },
      { l: "Deal Confidence",    v: `${Math.round(SAMPLE.calibration.dealConfidence * 100)}%` },
      { l: "Peer Median",        v: `${Math.round(SAMPLE.calibration.peerMedianConf * 100)}%` },
    ];
    const cW = W / calItems.length;
    calItems.forEach((c, i) => {
      const x = 68 + i * cW;
      doc.rect(x, doc.y, cW - 4, 28).fill(SECTION_BG);
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica").text(c.l, x + 4, doc.y + 4, { width: cW - 8 });
      doc.fillColor(BRAND_DARK).fontSize(10).font("Helvetica-Bold").text(c.v, x + 4, doc.y + 14, { width: cW - 8 });
    });
    doc.moveDown(2.2);
    doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
       .text(`Peer group: ${SAMPLE.calibration.peerGroup}`, 68, doc.y, { width: W - 16 });

    // ── 5. Historical Precedents ──────────────────────────────────────────────
    sectionHeader("5 · HISTORICAL PRECEDENTS");
    SAMPLE.precedents.forEach(p => {
      const rowY = doc.y + 2;
      doc.rect(68, rowY, W - 16, 44).fill("#ffffff").stroke(BORDER_COLOR);
      doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold").text(p.name, 74, rowY + 4, { continued: true, width: W - 120 });
      doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(7).text(`  ${p.year}  ·  ${p.similarity}% similar`, { width: 120 });
      doc.fillColor(BRAND_BLUE).fontSize(7).font("Helvetica-Bold").text(p.outcome, 74, rowY + 16, { width: W - 40 });
      doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica").text(`Lesson: ${p.lesson}`, 74, rowY + 27, { width: W - 40 });
      doc.y = rowY + 50;
    });

    // ── 6. Release Gate Determination ─────────────────────────────────────────
    sectionHeader("6 · RELEASE GATE DETERMINATION");
    doc.rect(68, doc.y + 2, W - 16, 14).fill(RELEASED_GREEN + "22");
    doc.fillColor(RELEASED_GREEN).fontSize(9).font("Helvetica-Bold")
       .text(`✓  ${SAMPLE.releaseGate.status}`, 74, doc.y + 5, { width: W - 28 });
    doc.moveDown(1.2);
    doc.fillColor(TEXT_SECONDARY).fontSize(8).font("Helvetica")
       .text(SAMPLE.releaseGate.narrative, 68, doc.y, { width: W - 16, lineGap: 2 });
    doc.moveDown(0.6);
    SAMPLE.releaseGate.conditions.forEach(c => {
      const rowY = doc.y + 2;
      doc.rect(68, rowY, W - 16, 34).fill(WARN_AMBER + "11").stroke(WARN_AMBER + "44");
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica").text(c.id, 74, rowY + 4, { lineBreak: false });
      doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold").text(c.title, 74, rowY + 14, { width: W - 40 });
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
         .text(`Deadline: ${c.deadline}  ·  Rule: ${c.rule}`, 74, rowY + 25, { width: W - 40 });
      doc.y = rowY + 40;
    });

    // ── 7. Audit References ───────────────────────────────────────────────────
    sectionHeader("7 · AUDIT REFERENCES");
    SAMPLE.auditRefs.forEach(ref => {
      doc.fillColor(BRAND_LIGHT_BLUE).fontSize(7).font("Helvetica-Bold").text(ref.id, 68, doc.y, { continued: true, width: 50 });
      doc.fillColor(TEXT_MUTED).font("Helvetica").text(`  ${ref.type}  `, { continued: true, width: 140 });
      doc.fillColor(TEXT_SECONDARY).text(ref.desc, { continued: true, width: W - 240 });
      doc.fillColor(TEXT_MUTED).text(`  ${ref.date}`, { width: 60 });
      hRule();
      doc.moveDown(0.15);
    });

    // ── Footer on every page ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
         .text(
           `AgenThink Mesh · Institutional Proof Report · SAMPLE · ${SAMPLE.meta.reportId} · Page ${i + 1} of ${range.count}`,
           60, doc.page.height - 36, { width: W, align: "center" },
         );
    }

    doc.end();
  });
}
