/**
 * sampleProofReportPdf.ts — Sample Institutional Proof Report PDF Generator
 *
 * Produces a clean, compact (3-5 page), prospect-ready PDF from deterministic
 * demo data. No Council session required.
 *
 * Layout rules (PDFKit safety):
 *  - NEVER use `continued: true` — always separate .text() calls
 *  - NEVER use Unicode arrows/checkmarks (▶ ✓) — use ASCII: "-", "[PASS]", "[COND]"
 *  - NEVER set doc.y manually inside a continued-text chain
 *  - ALWAYS pass explicit `width` to every .text() call
 *  - ALWAYS truncate long unbreakable strings (hashes, IDs) with ellipsis
 *  - No full cover page — compact header to save space
 *
 * All 13 sections present in compact institutional memo style.
 */

// ── Colours ───────────────────────────────────────────────────────────────────
const BRAND_DARK     = "#0a0f1e";
const BRAND_BLUE     = "#1e6bff";
const TEXT_SECONDARY = "#4a4a6a";
const TEXT_MUTED     = "#8888aa";
const BORDER_COLOR   = "#e0e0f0";
const SECTION_BG     = "#f4f6ff";
const GREEN          = "#16a34a";
const AMBER          = "#d97706";
const RED            = "#dc2626";

// ── Sample data ───────────────────────────────────────────────────────────────
const S = {
  reportId:   "IPR-2024-DEMO-001",
  sessionId:  "SESSION-DEMO-HN-001",
  dealName:   "Helios-North Renewable Energy Infrastructure Fund",
  date:       "2024-11-15",
  constVer:   "v4.2.1",
  constDate:  "2024-09-01",
  constHash:  "sha256:a3f8c2d1...b1a9c47d6e2",
  mode:       "INFRASTRUCTURE",
  verdict:    "APPROVED WITH CONDITIONS",
  confidence: "74%",
  vote:       "7 / 10 YES",
  gate:       "CONDITIONAL RELEASE",

  execHeadline: "Approved with Conditions — 7/10 Council Members in Favour",
  execPoints: [
    "Fund: EUR 2.1B infrastructure fund, 15-year horizon, European renewable energy.",
    "7 of 10 specialist agents voted YES. 3 dissenting votes on regulatory timeline risk.",
    "Sponsor IRR track record: 14.2% net across three prior infrastructure funds.",
    "EU taxonomy alignment: 91% of projected AUM (threshold: 85%). PASS.",
    "LP concentration: top 3 LPs at 61% of committed capital (soft limit: 55%). CONDITION.",
    "German offshore wind permitting risk: 34% probability of 18-24 month delay.",
    "FX hedging covers 78% of EUR/USD exposure — within constitutional tolerance.",
  ],

  voteRows: [
    { agent: "Infrastructure Risk Specialist",  vote: "YES", conf: "81%", note: "Milestone gate mitigates permitting risk." },
    { agent: "Regulatory Compliance Officer",   vote: "YES", conf: "76%", note: "EU taxonomy alignment confirmed." },
    { agent: "LP Relations Specialist",         vote: "YES", conf: "72%", note: "LP concentration manageable with reporting." },
    { agent: "ESG Governance Analyst",          vote: "YES", conf: "79%", note: "REPowerEU alignment strong." },
    { agent: "Macro Risk Analyst",              vote: "YES", conf: "74%", note: "EU Green Deal tailwinds durable." },
    { agent: "Quantitative Risk Modeller",      vote: "YES", conf: "68%", note: "Monte Carlo supports base case." },
    { agent: "Sponsor Due Diligence Lead",      vote: "YES", conf: "77%", note: "Track record verified." },
    { agent: "Jurisdiction Risk Specialist",    vote: "NO",  conf: "41%", note: "Single-jurisdiction concentration concern." },
    { agent: "Concentration Risk Analyst",      vote: "NO",  conf: "38%", note: "LP concentration above soft limit." },
    { agent: "Regulatory Timeline Specialist",  vote: "NO",  conf: "35%", note: "BNetzA permitting timeline uncertain." },
  ],

  personaConf: [
    { persona: "Infrastructure Risk",   score: "81%", stance: "APPROVE" },
    { persona: "ESG Governance",        score: "79%", stance: "APPROVE" },
    { persona: "Sponsor Due Diligence", score: "77%", stance: "APPROVE" },
    { persona: "Regulatory Compliance", score: "76%", stance: "APPROVE" },
    { persona: "Macro Risk",            score: "74%", stance: "APPROVE" },
    { persona: "LP Relations",          score: "72%", stance: "APPROVE" },
    { persona: "Quantitative Risk",     score: "68%", stance: "APPROVE" },
    { persona: "Jurisdiction Risk",     score: "41%", stance: "REJECT" },
    { persona: "Concentration Risk",    score: "38%", stance: "REJECT" },
    { persona: "Regulatory Timeline",   score: "35%", stance: "REJECT" },
  ],

  constRules: [
    { id: "INFRA-RISK-003",      sec: "s7.3",  title: "Regulatory Timeline Risk Stress Testing",       status: "APPLIED" },
    { id: "FUND-STRUCT-007",     sec: "s12.1", title: "LP Concentration Reporting Threshold",          status: "APPLIED" },
    { id: "INFRA-DIVERSIFY-002", sec: "s9.4",  title: "Single-Jurisdiction Diversification Condition", status: "APPLIED" },
    { id: "ESG-TAXONOMY-001",    sec: "s15.2", title: "EU Taxonomy Alignment Minimum",                 status: "APPLIED" },
    { id: "SPONSOR-TRACK-001",   sec: "s4.1",  title: "Sponsor Track Record Minimum",                  status: "APPLIED" },
  ],

  govFindings: [
    { id: "GF-001", sev: "MEDIUM", title: "German Offshore Wind Permitting Delay Risk",       res: "[CONDITION] Regulatory milestone gate at 18 months. Max 40% drawdown until BNetzA approval." },
    { id: "GF-002", sev: "LOW",    title: "LP Concentration Above Soft Limit (61% vs 55%)",   res: "[CONDITION] Quarterly LP liquidity reporting added to LPA." },
    { id: "GF-003", sev: "LOW",    title: "Single-Jurisdiction Concentration (Germany: 87%)",  res: "[CONDITION] Min 20% geographic diversification before Fund II first close." },
    { id: "GF-004", sev: "PASS",   title: "EU Taxonomy Alignment — 91% (threshold: 85%)",     res: "[PASS] No condition required." },
    { id: "GF-005", sev: "PASS",   title: "Sponsor Track Record — 14.2% net IRR (min: 12%)",  res: "[PASS] No condition required." },
  ],

  constVersions: [
    { ver: "v4.2.1", date: "2024-09-01", note: "Current — applied at decision time." },
    { ver: "v4.2.0", date: "2024-06-01", note: "Prior — infrastructure risk rules updated." },
    { ver: "v4.1.0", date: "2024-01-15", note: "ESG taxonomy alignment threshold raised to 85%." },
  ],

  contradictions: [
    "Jurisdiction Risk Specialist (NO, 41%): Single-jurisdiction concentration in Germany (87%) exceeds threshold.",
    "Concentration Risk Analyst (NO, 38%): LP concentration above 55% soft limit requires enhanced reporting.",
    "Regulatory Timeline Specialist (NO, 35%): BNetzA permitting timeline uncertainty not sufficiently mitigated.",
  ],

  calibStats: "847 comparable deals | Base rate: 68% | Deal confidence: 74% | Peer median: 72%",
  calibNotes: "Calibrated against 847 comparable infrastructure fund decisions (2018-2024). Renewable energy infrastructure funds in the EUR 1.5B-3B range show a 71% approval rate with an average of 1.8 conditions attached.",
  calibPeer:  "Peer group: Renewable energy infrastructure funds, European jurisdiction, EUR 1.5B-3B target, 12-18 year horizon, closed 2018-2024.",

  precedents: [
    { id: "PREC-2023-047", name: "Nordic Wind Partners Fund III",           year: "2023", sim: "89%", outcome: "APPROVED WITH CONDITIONS", lesson: "Milestone gate conditions on permitting risk are effective. 94% met gate within timeframe." },
    { id: "PREC-2022-031", name: "Meridian Offshore Energy Infrastructure", year: "2022", sim: "82%", outcome: "APPROVED WITH CONDITIONS", lesson: "LP concentration above 55% is manageable with enhanced reporting." },
    { id: "PREC-2021-019", name: "Solaris European Renewables Fund",        year: "2021", sim: "61%", outcome: "REJECTED",                 lesson: "Single-jurisdiction concentration above 85% in politically volatile jurisdictions is a material risk." },
  ],

  gateNarrative: "Council authorises conditional release. Three conditions attach. No hard BLOCK violations identified. Deal may proceed to LP close subject to satisfaction of all three conditions.",
  conditions: [
    { id: "COND-001", title: "Regulatory Milestone Gate — BNetzA Approval",    deadline: "2026-05-15",    rule: "INFRA-RISK-003 / s7.3" },
    { id: "COND-002", title: "LP Concentration — Enhanced Quarterly Reporting", deadline: "2024-12-31",    rule: "FUND-STRUCT-007 / s12.1" },
    { id: "COND-003", title: "Geographic Diversification — Fund II Commitment", deadline: "Fund II close", rule: "INFRA-DIVERSIFY-002 / s9.4" },
  ],

  evidenceChain: [
    "Deal memorandum (v3, final) — SHA-256 hash verified at submission.",
    "Council session transcript — 10 agents, 47-minute deliberation, recorded.",
    "Constitution v4.2.1 snapshot — hash-locked at decision time.",
    "Calibration dataset v2024.Q3 — 847 comparable decisions.",
    "Precedent database v2024.Q3 — 3 comparable precedents cited.",
    "Release gate evaluation log — CONDITIONAL_RELEASE, 3 conditions, 0 hard blocks.",
  ],

  auditRefs: [
    { id: "AUD-001", type: "COUNCIL_SESSION",       desc: "Council session transcript — 10 agents, 47-min deliberation",     date: "2024-11-15" },
    { id: "AUD-002", type: "CONSTITUTION_SNAPSHOT", desc: "Constitution v4.2.1 snapshot at time of decision",                 date: "2024-11-15" },
    { id: "AUD-003", type: "CALIBRATION_DATASET",   desc: "Calibration dataset v2024.Q3 — 847 comparable decisions",         date: "2024-11-01" },
    { id: "AUD-004", type: "DEAL_TEXT_HASH",         desc: "SHA-256 hash of submitted deal memorandum (v3, final)",           date: "2024-11-14" },
    { id: "AUD-005", type: "PRECEDENT_DATABASE",     desc: "Historical precedent database v2024.Q3 — 3 precedents cited",    date: "2024-11-01" },
    { id: "AUD-006", type: "RELEASE_GATE_LOG",       desc: "Release gate log — CONDITIONAL_RELEASE, 3 conditions, 0 blocks", date: "2024-11-15" },
  ],

  traceability: [
    `Report: ${  "IPR-2024-DEMO-001"}  |  Session: ${"SESSION-DEMO-HN-001"}`,
    `Constitution: v4.2.1 (sha256:a3f8c2d1...b1a9c47d6e2)  |  Mode: INFRASTRUCTURE`,
    `Council: 10 agents  |  Duration: 47 min  |  Calibration: v2024.Q3 (847 deals)`,
    `Precedents cited: 3  |  Conditions attached: 3  |  Hard blocks: 0`,
    `Generated: 2024-11-15T09:42:00Z  |  Format: PDF  |  Version: 1.0`,
  ],
};

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateSampleProofReportPdf(): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 44, bottom: 44, left: 52, right: 52 },
      bufferPages: true,
      info: {
        Title:   "Institutional Proof Report — Sample",
        Author:  "AgenThink Mesh Governed Decision Infrastructure",
        Subject: "Sample Institutional Proof Report — Helios-North",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const W  = PW - 104; // usable width (52 each side)
    const L  = 52;

    // ── Helpers ───────────────────────────────────────────────────────────────

    function rule() {
      const y = doc.y + 1;
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(BORDER_COLOR).lineWidth(0.3).stroke();
      doc.y = y + 2;
    }

    function maybeNewPage(minSpace = 80) {
      if (doc.y > doc.page.height - minSpace) doc.addPage();
    }

    /** Compact section header — 15px tall */
    function sec(num: number, title: string) {
      doc.moveDown(0.35);
      maybeNewPage(90);
      const y = doc.y;
      doc.rect(L, y, W, 15).fill(SECTION_BG);
      doc.fillColor(BRAND_BLUE).fontSize(6.5).font("Helvetica-Bold")
         .text(`${num}.`, L + 5, y + 4, { width: 14 });
      doc.fillColor(BRAND_DARK).fontSize(7.5).font("Helvetica-Bold")
         .text(title.toUpperCase(), L + 19, y + 4, { width: W - 24 });
      doc.y = y + 18;
    }

    /** Bullet using ASCII "-" only */
    function bullet(text: string) {
      doc.fillColor(TEXT_SECONDARY).fontSize(7.5).font("Helvetica")
         .text(`- ${text}`, L + 6, doc.y, { width: W - 12, lineGap: 0.5 });
      doc.moveDown(0.08);
    }

    // ── COMPACT HEADER (not a full cover page) ────────────────────────────────
    // Dark banner — 90px tall
    doc.rect(0, 0, PW, 90).fill(BRAND_DARK);

    doc.fillColor("#aaaacc").fontSize(6.5).font("Helvetica")
       .text("SAMPLE REPORT  |  DEMO DATA  |  NOT A REAL TRANSACTION",
             L, 14, { width: W, align: "center" });

    doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
       .text("Institutional Proof Report", L, 28, { width: W, align: "center" });

    doc.fillColor("#ccccee").fontSize(8.5).font("Helvetica")
       .text(S.dealName, L, 54, { width: W, align: "center" });

    doc.fillColor("#666688").fontSize(6.5).font("Helvetica")
       .text(`${S.reportId}  |  ${S.constVer}  |  ${S.date}`, L, 70, { width: W, align: "center" });

    doc.y = 98;

    // Verdict meta strip — 4 inline items, no boxes
    const metaItems = [
      { label: "VERDICT:",      value: S.verdict,     color: BRAND_BLUE },
      { label: "CONFIDENCE:",   value: S.confidence,  color: BRAND_DARK },
      { label: "COUNCIL VOTE:", value: S.vote,        color: GREEN },
      { label: "MODE:",         value: S.mode,        color: TEXT_SECONDARY },
    ];
    const mW = Math.floor(W / 4);
    const mY = doc.y;
    doc.rect(L, mY, W, 22).fill(SECTION_BG);
    metaItems.forEach((m, i) => {
      const x = L + i * mW;
      doc.fillColor(TEXT_MUTED).fontSize(6).font("Helvetica")
         .text(m.label, x + 4, mY + 3, { width: mW - 8 });
      doc.fillColor(m.color).fontSize(7.5).font("Helvetica-Bold")
         .text(m.value, x + 4, mY + 11, { width: mW - 8 });
    });
    doc.y = mY + 25;
    rule();

    // ── SECTION 1 — EXECUTIVE SUMMARY ────────────────────────────────────────
    sec(1, "Executive Summary");
    doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold")
       .text(S.execHeadline, L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.2);
    S.execPoints.forEach(p => bullet(p));

    // ── SECTION 2 — VOTE DISTRIBUTION ────────────────────────────────────────
    sec(2, "Vote Distribution");
    const colW = [
      Math.floor(W * 0.37),
      Math.floor(W * 0.08),
      Math.floor(W * 0.09),
      Math.floor(W * 0.46),
    ];
    // Header row
    const hY = doc.y;
    doc.rect(L, hY, W, 12).fill(BRAND_DARK);
    const hLabels = ["Agent", "Vote", "Conf.", "Note"];
    let cx = L;
    hLabels.forEach((h, i) => {
      doc.fillColor("#ffffff").fontSize(6).font("Helvetica-Bold")
         .text(h, cx + 3, hY + 3, { width: colW[i] - 6 });
      cx += colW[i];
    });
    doc.y = hY + 13;
    S.voteRows.forEach((row, idx) => {
      const rowY = doc.y;
      doc.rect(L, rowY, W, 9).fill(idx % 2 === 0 ? "#ffffff" : SECTION_BG);
      const vc = row.vote === "YES" ? GREEN : RED;
      let rx = L;
      doc.fillColor(TEXT_SECONDARY).fontSize(6).font("Helvetica")
         .text(row.agent, rx + 3, rowY + 2, { width: colW[0] - 6 });
      rx += colW[0];
      doc.fillColor(vc).fontSize(6).font("Helvetica-Bold")
         .text(row.vote, rx + 3, rowY + 2, { width: colW[1] - 6 });
      rx += colW[1];
      doc.fillColor(TEXT_SECONDARY).fontSize(6).font("Helvetica")
         .text(row.conf, rx + 3, rowY + 2, { width: colW[2] - 6 });
      rx += colW[2];
      doc.fillColor(TEXT_MUTED).fontSize(5.5).font("Helvetica")
         .text(row.note, rx + 3, rowY + 2, { width: colW[3] - 6 });
      doc.y = rowY + 10;
    });

    // ── SECTION 3 — PERSONA CONFIDENCE ───────────────────────────────────────
    sec(3, "Persona Confidence Summary");
    // Two-column layout: 5 items per column
    const half = Math.ceil(S.personaConf.length / 2);
    const colHalfW = Math.floor(W / 2) - 4;
    S.personaConf.forEach((p, i) => {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const x = L + col * (colHalfW + 8);
      const y = doc.y - (col === 1 && row === 0 ? (half * 9) : 0);
      const sc = p.stance === "APPROVE" ? GREEN : RED;
      if (col === 0) {
        // left column — advance doc.y normally
        doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
           .text(p.persona, L + 4, doc.y, { width: colHalfW * 0.6 });
        doc.fillColor(sc).fontSize(6.5).font("Helvetica-Bold")
           .text(`${p.score} ${p.stance}`, L + 4 + colHalfW * 0.6, doc.y - 9, { width: colHalfW * 0.38 });
        doc.moveDown(0.08);
      }
      // right column items are rendered alongside left column items
      if (col === 1) {
        const rightX = L + colHalfW + 8;
        const rightY = doc.y - ((half - row) * 9);
        doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
           .text(p.persona, rightX + 4, rightY, { width: colHalfW * 0.6 });
        doc.fillColor(sc).fontSize(6.5).font("Helvetica-Bold")
           .text(`${p.score} ${p.stance}`, rightX + 4 + colHalfW * 0.6, rightY, { width: colHalfW * 0.38 });
      }
      void x; void y; // suppress unused warnings
    });

    // ── SECTION 4 — CONSTITUTIONAL COMPLIANCE ────────────────────────────────
    sec(4, "Constitutional Compliance");
    doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
       .text(`${S.constVer}  |  Effective: ${S.constDate}  |  Hash: ${S.constHash}`,
             L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.25);
    S.constRules.forEach(r => {
      const rowY = doc.y;
      doc.fillColor(BRAND_BLUE).fontSize(6.5).font("Helvetica-Bold")
         .text(r.id, L + 4, rowY, { width: W * 0.27 });
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(r.title, L + 4 + W * 0.27, rowY, { width: W * 0.55 });
      doc.fillColor(GREEN).fontSize(6.5).font("Helvetica-Bold")
         .text(r.status, L + 4 + W * 0.82, rowY, { width: W * 0.16 });
      doc.moveDown(0.18);
    });

    // ── SECTION 5 — GOVERNANCE FINDINGS ──────────────────────────────────────
    sec(5, "Governance Findings");
    S.govFindings.forEach(gf => {
      const sc = gf.sev === "PASS" ? GREEN : gf.sev === "MEDIUM" ? AMBER : BRAND_BLUE;
      doc.fillColor(sc).fontSize(6.5).font("Helvetica-Bold")
         .text(`[${gf.sev}] ${gf.id} — ${gf.title}`, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
         .text(gf.res, L + 10, doc.y, { width: W - 16 });
      doc.moveDown(0.15);
    });

    // ── SECTION 6 — CONSTITUTION VERSIONS ────────────────────────────────────
    sec(6, "Constitution Versions");
    S.constVersions.forEach(v => {
      const rowY = doc.y;
      doc.fillColor(BRAND_BLUE).fontSize(7).font("Helvetica-Bold")
         .text(v.ver, L + 4, rowY, { width: W * 0.14 });
      doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica")
         .text(v.date, L + 4 + W * 0.14, rowY, { width: W * 0.2 });
      doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
         .text(v.note, L + 4 + W * 0.34, rowY, { width: W * 0.64 });
      doc.moveDown(0.18);
    });

    // ── SECTION 7 — CONTRADICTIONS / DISSENT ─────────────────────────────────
    sec(7, "Contradictions and Dissent");
    S.contradictions.forEach(c => bullet(c));

    // ── SECTION 8 — CALIBRATION CONTEXT ──────────────────────────────────────
    sec(8, "Calibration Context");
    doc.fillColor(BRAND_DARK).fontSize(7).font("Helvetica-Bold")
       .text(S.calibStats, L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.15);
    doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
       .text(S.calibNotes, L + 4, doc.y, { width: W - 8, lineGap: 1 });
    doc.moveDown(0.1);
    doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
       .text(S.calibPeer, L + 4, doc.y, { width: W - 8 });

    // ── SECTION 9 — HISTORICAL PRECEDENTS ────────────────────────────────────
    sec(9, "Historical Precedents");
    S.precedents.forEach(p => {
      const oc = p.outcome === "REJECTED" ? RED : GREEN;
      doc.fillColor(BRAND_DARK).fontSize(7).font("Helvetica-Bold")
         .text(`${p.name}  (${p.year})  |  Similarity: ${p.sim}`, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(oc).fontSize(6.5).font("Helvetica-Bold")
         .text(p.outcome, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(`Lesson: ${p.lesson}`, L + 10, doc.y, { width: W - 16, lineGap: 0.5 });
      doc.moveDown(0.2);
    });

    // ── SECTION 10 — RELEASE GATE DETERMINATION ──────────────────────────────
    sec(10, "Release Gate Determination");
    const gY = doc.y;
    doc.rect(L, gY, W, 14).fill(GREEN + "22");
    doc.fillColor(GREEN).fontSize(8).font("Helvetica-Bold")
       .text(`[PASS] ${S.gate}`, L + 6, gY + 3, { width: W - 12 });
    doc.y = gY + 17;
    doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
       .text(S.gateNarrative, L + 4, doc.y, { width: W - 8, lineGap: 0.5 });
    doc.moveDown(0.2);
    S.conditions.forEach(c => {
      doc.fillColor(AMBER).fontSize(6.5).font("Helvetica-Bold")
         .text(`[CONDITION] ${c.id} — ${c.title}`, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
         .text(`Deadline: ${c.deadline}  |  Rule: ${c.rule}`, L + 10, doc.y, { width: W - 16 });
      doc.moveDown(0.15);
    });

    // ── SECTION 11 — EVIDENCE CHAIN ──────────────────────────────────────────
    sec(11, "Evidence Chain");
    S.evidenceChain.forEach((e, i) => bullet(`${i + 1}. ${e}`));

    // ── SECTION 12 — AUDIT REFERENCES ────────────────────────────────────────
    sec(12, "Audit References");
    S.auditRefs.forEach(ref => {
      const rowY = doc.y;
      doc.fillColor(BRAND_BLUE).fontSize(6.5).font("Helvetica-Bold")
         .text(ref.id, L + 4, rowY, { width: W * 0.11 });
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
         .text(ref.type, L + 4 + W * 0.11, rowY, { width: W * 0.22 });
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(ref.desc, L + 4 + W * 0.33, rowY, { width: W * 0.52 });
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
         .text(ref.date, L + 4 + W * 0.85, rowY, { width: W * 0.13 });
      doc.moveDown(0.18);
    });

    // ── SECTION 13 — TRACEABILITY APPENDIX ───────────────────────────────────
    sec(13, "Traceability Appendix");
    S.traceability.forEach(t => bullet(t));

    // ── PAGE FOOTERS ──────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(TEXT_MUTED).fontSize(6).font("Helvetica")
         .text(
           `AgenThink Mesh  |  Institutional Proof Report  |  SAMPLE  |  ${S.reportId}  |  Page ${i + 1} of ${range.count}`,
           L, doc.page.height - 28, { width: W, align: "center" },
         );
    }

    doc.end();
  });
}
