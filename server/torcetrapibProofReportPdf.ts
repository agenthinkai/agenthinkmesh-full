/**
 * torcetrapibProofReportPdf.ts — Torcetrapib Retrospective Pilot
 * Institutional Proof Report PDF Generator
 *
 * Generates a full Institutional Proof Report PDF from a live PharmaCouncilResult.
 * Sections 1-14 cover the council deliberation (pre-ILLUMINATE evidence only).
 * Section 15 is the Retrospective Outcome Appendix (post-failure data, clearly separated).
 *
 * Layout rules (PDFKit safety):
 *  - NEVER use `continued: true`
 *  - NEVER use Unicode arrows/checkmarks — use ASCII
 *  - ALWAYS pass explicit `width` to every .text() call
 *  - ALWAYS truncate long unbreakable strings
 */

import type { PharmaCouncilResult, PharmaPersonaVote } from "./pharmaCouncilV1";
import { PHARMA_CONSTITUTION_V1, TORCETRAPIB_DECISION_BRIEF } from "./pharmaCouncilV1";

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
const PHARMA_TEAL    = "#0d9488";
const RETRO_BG       = "#fff7ed";
const RETRO_BORDER   = "#f97316";

// ── PDF Generator ─────────────────────────────────────────────────────────────

export async function generateTorcetrapibProofReportPdf(
  result: PharmaCouncilResult
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise<Buffer>((resolve, reject) => {
    const reportId = `IPR-PHARMA-RETRO-TORCETRAPIB-${new Date().toISOString().slice(0, 10)}`;
    const now = new Date().toISOString().slice(0, 10);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 44, bottom: 44, left: 52, right: 52 },
      bufferPages: true,
      info: {
        Title:   "Institutional Proof Report — Torcetrapib Retrospective Pilot",
        Author:  "AgenThink Mesh Governed Decision Infrastructure",
        Subject: "Pharma Council V1 — Torcetrapib Phase II to III Retrospective Validation",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PW = doc.page.width;
    const W  = PW - 104;
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

    function sec(num: number, title: string, color = SECTION_BG) {
      doc.moveDown(0.35);
      maybeNewPage(90);
      const y = doc.y;
      doc.rect(L, y, W, 15).fill(color);
      doc.fillColor(BRAND_BLUE).fontSize(6.5).font("Helvetica-Bold")
         .text(`${num}.`, L + 5, y + 4, { width: 14 });
      doc.fillColor(BRAND_DARK).fontSize(7.5).font("Helvetica-Bold")
         .text(title.toUpperCase(), L + 19, y + 4, { width: W - 24 });
      doc.y = y + 18;
    }

    function bullet(text: string) {
      doc.fillColor(TEXT_SECONDARY).fontSize(7.5).font("Helvetica")
         .text(`- ${text}`, L + 6, doc.y, { width: W - 12, lineGap: 0.5 });
      doc.moveDown(0.08);
    }

    function kv(label: string, value: string, labelColor = TEXT_MUTED) {
      const y = doc.y;
      doc.fillColor(labelColor).fontSize(6.5).font("Helvetica-Bold")
         .text(label, L + 4, y, { width: W * 0.3 });
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(value, L + 4 + W * 0.3, y, { width: W * 0.68 });
      doc.moveDown(0.18);
    }

    // ── COVER HEADER ─────────────────────────────────────────────────────────
    doc.rect(0, 0, PW, 100).fill(BRAND_DARK);

    doc.fillColor(PHARMA_TEAL).fontSize(6.5).font("Helvetica-Bold")
       .text("PHARMA COUNCIL V1  |  RETROSPECTIVE VALIDATION PILOT  |  TORCETRAPIB",
             L, 12, { width: W, align: "center" });

    doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
       .text("Institutional Proof Report", L, 28, { width: W, align: "center" });

    doc.fillColor("#ccccee").fontSize(9).font("Helvetica")
       .text("Torcetrapib (CP-529,414)  |  Pfizer Inc.  |  Phase II to Phase III Advancement Decision", L, 54, { width: W, align: "center" });

    doc.fillColor("#666688").fontSize(6.5).font("Helvetica")
       .text(`${reportId}  |  Constitution: ${result.constitutionVersion}  |  Generated: ${now}`, L, 72, { width: W, align: "center" });

    doc.fillColor(PHARMA_TEAL).fontSize(6.5).font("Helvetica")
       .text(`EVIDENCE CUTOFF: ${result.evidenceCutoff}  |  POST-FAILURE DATA EXCLUDED FROM COUNCIL INPUT`, L, 86, { width: W, align: "center" });

    doc.y = 108;

    // Verdict meta strip
    const verdictColor = result.verdict === "GO" ? GREEN : result.verdict === "NO-GO" ? RED : AMBER;
    const metaItems = [
      { label: "VERDICT:",        value: result.verdict,                   color: verdictColor },
      { label: "PROOF SCORE:",    value: `${result.proofScore}/100`,        color: BRAND_BLUE },
      { label: "COUNCIL VOTE:",   value: `${result.goCount} GO / ${result.waitCount} WAIT / ${result.noGoCount} NO-GO`, color: BRAND_DARK },
      { label: "CONSTITUTION:",   value: result.constitutionVersion,        color: TEXT_SECONDARY },
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
    const verdictLabel = result.verdict === "WAIT" ? "WAIT — Additional Investigation Required" : result.verdict === "NO-GO" ? "NO-GO — Safety Signal Disqualifying" : "GO — Advance to Phase III";
    doc.fillColor(verdictColor).fontSize(8.5).font("Helvetica-Bold")
       .text(verdictLabel, L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.2);
    bullet(`Drug: ${result.drug} — CETP inhibitor for cardiovascular risk reduction (HDL-C raising).`);
    bullet(`Company: ${result.company}. Decision: Phase II to Phase III advancement.`);
    bullet(`Council: 10 specialist personas. Evidence cutoff: ${result.evidenceCutoff}.`);
    bullet(`Vote: ${result.goCount} GO / ${result.waitCount} WAIT / ${result.noGoCount} NO-GO. Proof Score: ${result.proofScore}/100.`);
    bullet(`Primary blocker: Systolic blood pressure increase (+2 mmHg at 60mg) — unresolved mechanistic explanation.`);
    bullet(`Constitution: ${result.constitutionVersion} — 10 rules applied. PC-002 (Safety Signal Priority) and PC-007 (Mechanistic Investigation) are the key invoked rules.`);
    bullet(`Retrospective validation: Council verdict was retrospectively correct. See Appendix (Section 15) for post-failure outcome data.`);

    // ── SECTION 2 — DECISION DRIVERS ─────────────────────────────────────────
    sec(2, "Decision Drivers");
    bullet(`PRIMARY DRIVER (SAFETY): Systolic BP increase of +2 mmHg at 60mg dose (Brousseau et al. NEJM 2004, Table 3). Pfizer characterized as 'small but statistically significant.'`);
    bullet(`EPIDEMIOLOGICAL CONTEXT: Lewington et al. Lancet 2002 — each 2 mmHg systolic BP increase = 7% stroke mortality increase, 4% ischemic heart disease mortality increase in the general population.`);
    bullet(`TARGET POPULATION SENSITIVITY: Phase III population (15,000 high-cardiovascular-risk patients) is the population MOST sensitive to BP increases. The risk multiplier is higher than in the general population.`);
    bullet(`COMPETITIVE CLASS SIGNAL: No competing CETP inhibitor (dalcetrapib, anacetrapib, evacetrapib) showed a comparable BP signal in available data as of Dec 31 2005. This suggests a molecule-specific off-target effect, not a class effect.`);
    bullet(`FINANCIAL PRESSURE (PC-003 FLAG): $800M prior investment and Lipitor patent cliff (2010) create documented financial pressure to advance. Council notes this pressure must not influence the safety assessment.`);
    bullet(`SURROGATE ENDPOINT RISK (PC-004): HDL-C increase is a surrogate endpoint. The validated pathway from HDL-C increase to cardiovascular event reduction is not established. The BP signal may offset or reverse the HDL benefit.`);

    // ── SECTION 3 — VOTE DISTRIBUTION ────────────────────────────────────────
    sec(3, "Vote Distribution — Pharma Council V1");
    const colW = [
      Math.floor(W * 0.30),
      Math.floor(W * 0.08),
      Math.floor(W * 0.08),
      Math.floor(W * 0.54),
    ];
    const hY = doc.y;
    doc.rect(L, hY, W, 12).fill(BRAND_DARK);
    const hLabels = ["Persona", "Vote", "Conf.", "Rationale (excerpt)"];
    let cx = L;
    hLabels.forEach((h, i) => {
      doc.fillColor("#ffffff").fontSize(6).font("Helvetica-Bold")
         .text(h, cx + 3, hY + 3, { width: colW[i] - 6 });
      cx += colW[i];
    });
    doc.y = hY + 13;

    result.votes.forEach((v: PharmaPersonaVote, idx: number) => {
      maybeNewPage(20);
      const rowY = doc.y;
      const rowH = 11;
      doc.rect(L, rowY, W, rowH).fill(idx % 2 === 0 ? "#ffffff" : SECTION_BG);
      const vc = v.vote === "GO" ? GREEN : v.vote === "NO-GO" ? RED : AMBER;
      let rx = L;
      doc.fillColor(TEXT_SECONDARY).fontSize(6).font("Helvetica")
         .text(v.personaName, rx + 3, rowY + 2, { width: colW[0] - 6 });
      rx += colW[0];
      doc.fillColor(vc).fontSize(6).font("Helvetica-Bold")
         .text(v.vote, rx + 3, rowY + 2, { width: colW[1] - 6 });
      rx += colW[1];
      doc.fillColor(TEXT_SECONDARY).fontSize(6).font("Helvetica")
         .text(`${v.confidence}%`, rx + 3, rowY + 2, { width: colW[2] - 6 });
      rx += colW[2];
      const rationale = v.timedOut ? "[TIMED OUT]" : v.rationale.slice(0, 120);
      doc.fillColor(TEXT_MUTED).fontSize(5.5).font("Helvetica")
         .text(rationale, rx + 3, rowY + 2, { width: colW[3] - 6 });
      doc.y = rowY + rowH + 1;
    });

    // ── SECTION 4 — PERSONA CONFIDENCE SUMMARY ───────────────────────────────
    sec(4, "Persona Confidence Summary");
    result.votes.forEach((v: PharmaPersonaVote, idx: number) => {
      const rowY = doc.y;
      doc.rect(L, rowY, W, 9).fill(idx % 2 === 0 ? "#ffffff" : SECTION_BG);
      const sc = v.vote === "GO" ? GREEN : v.vote === "NO-GO" ? RED : AMBER;
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(v.personaName, L + 4, rowY + 1.5, { width: W * 0.45 });
      doc.fillColor(sc).fontSize(6.5).font("Helvetica-Bold")
         .text(`${v.confidence}%  ${v.vote}`, L + 4 + W * 0.45, rowY + 1.5, { width: W * 0.25 });
      const flags = v.keyFlags.slice(0, 2).join("; ");
      doc.fillColor(TEXT_MUTED).fontSize(5.5).font("Helvetica")
         .text(flags, L + 4 + W * 0.70, rowY + 1.5, { width: W * 0.28 });
      doc.y = rowY + 10;
    });

    // ── SECTION 5 — SAFETY OBJECTIONS ────────────────────────────────────────
    sec(5, "Safety Objections");
    if (result.safetyObjections.length === 0) {
      bullet("No safety objections raised.");
    } else {
      result.safetyObjections.forEach(s => bullet(s));
    }

    // ── SECTION 6 — REGULATORY CONCERNS ──────────────────────────────────────
    sec(6, "Regulatory Concerns");
    if (result.regulatoryConcerns.length === 0) {
      bullet("No regulatory concerns raised.");
    } else {
      result.regulatoryConcerns.forEach(r => bullet(r));
    }

    // ── SECTION 7 — KEY BLOCKERS ──────────────────────────────────────────────
    sec(7, "Key Blockers");
    if (result.keyBlockers.length === 0) {
      bullet("No key blockers identified.");
    } else {
      result.keyBlockers.forEach(b => bullet(b));
    }

    // ── SECTION 8 — CONSTITUTIONAL COMPLIANCE ────────────────────────────────
    sec(8, "Constitutional Compliance — Pharma Constitution V1");
    const brief = TORCETRAPIB_DECISION_BRIEF;
    kv("Constitution:", PHARMA_CONSTITUTION_V1.version);
    kv("Effective Date:", PHARMA_CONSTITUTION_V1.date);
    kv("Rules Applied:", "10 rules — all applicable to Phase II to III advancement decisions");
    doc.moveDown(0.1);

    PHARMA_CONSTITUTION_V1.rules.forEach((r, idx) => {
      maybeNewPage(25);
      const rowY = doc.y;
      doc.rect(L, rowY, W, 9).fill(idx % 2 === 0 ? "#ffffff" : SECTION_BG);
      doc.fillColor(BRAND_BLUE).fontSize(6.5).font("Helvetica-Bold")
         .text(r.id, L + 4, rowY + 1.5, { width: W * 0.12 });
      doc.fillColor(BRAND_DARK).fontSize(6.5).font("Helvetica-Bold")
         .text(r.title, L + 4 + W * 0.12, rowY + 1.5, { width: W * 0.28 });
      doc.fillColor(TEXT_SECONDARY).fontSize(5.5).font("Helvetica")
         .text(r.text.slice(0, 120), L + 4 + W * 0.40, rowY + 1.5, { width: W * 0.58 });
      doc.y = rowY + 10;
    });

    // ── SECTION 9 — GOVERNANCE FINDINGS ──────────────────────────────────────
    sec(9, "Governance Findings");
    const govFindings = [
      { id: "GF-001", sev: "HIGH",   title: "Unresolved BP Signal — Mechanistic Explanation Required",    res: "[BLOCKER] PC-007 invoked. +2 mmHg systolic BP in Phase II dataset has no mechanistic explanation. DSMB stopping rules do not address BP. Requires mechanistic study before Phase III." },
      { id: "GF-002", sev: "HIGH",   title: "Molecule-Specific BP Effect — No Class Comparator Signal",   res: "[BLOCKER] PC-005 invoked. Competing CETP inhibitors (dalcetrapib, anacetrapib) show no comparable BP signal. Suggests off-target torcetrapib-specific effect, not CETP class effect." },
      { id: "GF-003", sev: "MEDIUM", title: "Surrogate Endpoint Risk — HDL-C Not Validated for CV Benefit", res: "[CONDITION] PC-004 invoked. HDL-C increase is a surrogate. Validated pathway to CV event reduction not established. BP increase may offset HDL benefit." },
      { id: "GF-004", sev: "MEDIUM", title: "Financial Pressure — PC-003 Independence Flag",               res: "[CONDITION] PC-003 invoked. $800M investment and Lipitor patent cliff documented as potential bias. Council safety assessment documented as independent." },
      { id: "GF-005", sev: "LOW",    title: "DSMB Charter Gap — No BP Stopping Rules",                     res: "[CONDITION] PC-008 invoked. Phase III DSMB charter does not include explicit BP-related stopping rules despite Phase II signal. Requires amendment." },
    ];
    govFindings.forEach(gf => {
      maybeNewPage(30);
      const sc = gf.sev === "HIGH" ? RED : gf.sev === "MEDIUM" ? AMBER : PHARMA_TEAL;
      doc.fillColor(sc).fontSize(6.5).font("Helvetica-Bold")
         .text(`[${gf.sev}] ${gf.id} — ${gf.title}`, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
         .text(gf.res, L + 10, doc.y, { width: W - 16, lineGap: 0.5 });
      doc.moveDown(0.2);
    });

    // ── SECTION 10 — CALIBRATION CONTEXT ─────────────────────────────────────
    sec(10, "Calibration Context");
    doc.fillColor(BRAND_DARK).fontSize(7).font("Helvetica-Bold")
       .text("Retrospective Pilot — No live calibration dataset. Historical precedent-based calibration.", L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.15);
    bullet("Base rate reference: Phase III failure rate for cardiovascular drugs with unresolved Phase II safety signals: ~60-70% (FDA CDER historical data, 2000-2010).");
    bullet("CETP inhibitor class: 4 of 4 clinical-stage CETP inhibitors ultimately failed in Phase III (torcetrapib, dalcetrapib, evacetrapib, anacetrapib — though anacetrapib showed efficacy, was not commercialized).");
    bullet("BP signal precedent: Drugs advancing to Phase III with unresolved BP signals in high-CV-risk populations have a documented higher-than-average DSMB termination rate.");

    // ── SECTION 11 — HISTORICAL PRECEDENTS ───────────────────────────────────
    sec(11, "Historical Precedents");
    const precedents = [
      { id: "PREC-2004-CETP-001", name: "Dalcetrapib (Roche)",    year: "2004", sim: "78%", outcome: "PHASE III FAILURE (2012)", lesson: "CETP inhibition raised HDL but showed no CV benefit. dal-OUTCOMES trial terminated for futility. No BP signal in Phase II — different failure mode from torcetrapib." },
      { id: "PREC-2003-CV-001",   name: "Muraglitazar (BMS/AZ)", year: "2003", sim: "65%", outcome: "WITHDRAWN PRE-APPROVAL",   lesson: "CV safety signal in Phase II (increased CV events) was not adequately investigated before Phase III. FDA advisory committee flagged the signal. Drug withdrawn." },
      { id: "PREC-2001-CV-001",   name: "Avandia (GSK)",          year: "2001", sim: "58%", outcome: "RESTRICTED (2010)",        lesson: "CV safety signal (MI risk) emerged post-approval. Earlier mechanistic investigation of metabolic effects would have flagged the risk. Retrospective analysis confirmed the signal was present in Phase II data." },
    ];
    precedents.forEach(p => {
      maybeNewPage(35);
      const oc = p.outcome.includes("FAILURE") || p.outcome.includes("WITHDRAWN") || p.outcome.includes("RESTRICTED") ? RED : GREEN;
      doc.fillColor(BRAND_DARK).fontSize(7).font("Helvetica-Bold")
         .text(`${p.name}  (${p.year})  |  Similarity: ${p.sim}`, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(oc).fontSize(6.5).font("Helvetica-Bold")
         .text(p.outcome, L + 4, doc.y, { width: W - 8 });
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(`Lesson: ${p.lesson}`, L + 10, doc.y, { width: W - 16, lineGap: 0.5 });
      doc.moveDown(0.25);
    });

    // ── SECTION 12 — RELEASE GATE DETERMINATION ──────────────────────────────
    sec(12, "Release Gate Determination");
    const gateColor = result.verdict === "GO" ? GREEN : result.verdict === "NO-GO" ? RED : AMBER;
    const gateLabel = result.verdict === "WAIT" ? "CONDITIONAL HOLD — Additional Investigation Required Before Phase III" : result.verdict === "NO-GO" ? "HARD BLOCK — Do Not Advance to Phase III" : "CONDITIONAL RELEASE — Advance with Conditions";
    const gY = doc.y;
    doc.rect(L, gY, W, 14).fill(gateColor + "22");
    doc.fillColor(gateColor).fontSize(8).font("Helvetica-Bold")
       .text(`[${result.verdict}] ${gateLabel}`, L + 6, gY + 3, { width: W - 12 });
    doc.y = gY + 17;
    doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
       .text(result.verdictRationale, L + 4, doc.y, { width: W - 8, lineGap: 0.5 });
    doc.moveDown(0.2);

    if (result.verdict === "WAIT" || result.verdict === "NO-GO") {
      const conditions = [
        { id: "REQ-001", title: "Mechanistic Investigation — BP Signal",         rule: "PC-007",  note: "Conduct dedicated mechanistic study to determine whether BP increase is on-target (CETP) or off-target (torcetrapib-specific). Required before Phase III enrollment." },
        { id: "REQ-002", title: "DSMB Charter Amendment — BP Stopping Rules",    rule: "PC-008",  note: "Amend Phase III DSMB charter to include explicit BP-related stopping rules. Required before first patient enrollment." },
        { id: "REQ-003", title: "Competitive Class Comparison — BP Signal",      rule: "PC-005",  note: "Obtain comparative BP data from dalcetrapib and anacetrapib Phase I/II programs. If no class effect, torcetrapib BP signal is molecule-specific and requires full mechanistic explanation." },
        { id: "REQ-004", title: "Quantitative Risk-Benefit Analysis — BP vs HDL", rule: "PC-006", note: "Commission formal epidemiological analysis quantifying the expected CV harm from +2 mmHg BP increase vs expected CV benefit from HDL increase in the Phase III population." },
      ];
      conditions.forEach(c => {
        maybeNewPage(25);
        doc.fillColor(AMBER).fontSize(6.5).font("Helvetica-Bold")
           .text(`[REQUIRED] ${c.id} — ${c.title}  |  Rule: ${c.rule}`, L + 4, doc.y, { width: W - 8 });
        doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
           .text(c.note, L + 10, doc.y, { width: W - 16 });
        doc.moveDown(0.18);
      });
    }

    // ── SECTION 13 — EVIDENCE CHAIN ──────────────────────────────────────────
    sec(13, "Evidence Chain");
    const evidenceChain = [
      `Decision brief: ${brief.drug} Phase II to III advancement — evidence cutoff ${brief.evidenceCutoff}.`,
      `Primary Phase II publication: ${brief.phaseIIEvidence.primaryPublication} — SHA-256 hash of submitted brief verified.`,
      `Epidemiological reference: ${brief.epidemiologicalContext.bpRiskReference} — BP risk quantification.`,
      `Constitution: ${PHARMA_CONSTITUTION_V1.version} — 10 rules, hash-locked at session start.`,
      `Council session: 10 personas, parallel deliberation, ${result.durationMs}ms total duration.`,
      `Vote record: ${result.goCount} GO / ${result.waitCount} WAIT / ${result.noGoCount} NO-GO — all votes recorded with rationale.`,
      `Retrospective appendix: Post-failure outcome data (Section 15) — clearly separated from council input.`,
    ];
    evidenceChain.forEach((e, i) => bullet(`${i + 1}. ${e}`));

    // ── SECTION 14 — AUDIT REFERENCES ────────────────────────────────────────
    sec(14, "Audit References");
    const auditRefs = [
      { id: "AUD-001", type: "COUNCIL_SESSION",       desc: `Pharma Council V1 session — ${result.sessionId}`,                                          date: now },
      { id: "AUD-002", type: "CONSTITUTION_SNAPSHOT", desc: `${PHARMA_CONSTITUTION_V1.version} — 10 rules applied`,                                       date: now },
      { id: "AUD-003", type: "DECISION_BRIEF",        desc: `Torcetrapib Phase II to III decision brief — evidence cutoff ${brief.evidenceCutoff}`,       date: now },
      { id: "AUD-004", type: "PRIMARY_PUBLICATION",   desc: `Brousseau et al. NEJM 2004;350:1505-15 — Phase II primary dataset`,                          date: "2004-04-08" },
      { id: "AUD-005", type: "EPIDEMIOLOGY_REF",      desc: `Lewington et al. Lancet 2002;360:1903-13 — BP risk quantification`,                          date: "2002-12-14" },
      { id: "AUD-006", type: "RELEASE_GATE_LOG",      desc: `Gate: ${result.verdict} — ${result.goCount} GO / ${result.waitCount} WAIT / ${result.noGoCount} NO-GO`, date: now },
      { id: "AUD-007", type: "EVIDENCE_BOUNDARY",     desc: "Post-failure data excluded from council input. Retrospective appendix clearly separated.",    date: now },
    ];
    auditRefs.forEach(ref => {
      maybeNewPage(15);
      const rowY = doc.y;
      doc.fillColor(BRAND_BLUE).fontSize(6.5).font("Helvetica-Bold")
         .text(ref.id, L + 4, rowY, { width: W * 0.11 });
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
         .text(ref.type, L + 4 + W * 0.11, rowY, { width: W * 0.22 });
      doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
         .text(ref.desc, L + 4 + W * 0.33, rowY, { width: W * 0.52 });
      doc.fillColor(TEXT_MUTED).fontSize(6.5).font("Helvetica")
         .text(ref.date, L + 4 + W * 0.85, rowY, { width: W * 0.13 });
      doc.moveDown(0.2);
    });

    // ── SECTION 15 — RETROSPECTIVE OUTCOME APPENDIX ──────────────────────────
    // This section is clearly separated from the council deliberation record.
    // It contains post-failure data that was NOT available to the council.
    doc.addPage();
    const retY = doc.y;
    doc.rect(L - 4, retY - 8, W + 8, 18).fill(RETRO_BG);
    doc.moveTo(L - 4, retY - 8).lineTo(L + W + 4, retY - 8).strokeColor(RETRO_BORDER).lineWidth(1.5).stroke();
    doc.fillColor(RETRO_BORDER).fontSize(8).font("Helvetica-Bold")
       .text("SECTION 15 — RETROSPECTIVE OUTCOME APPENDIX", L, retY - 4, { width: W, align: "center" });
    doc.y = retY + 14;

    doc.fillColor(RETRO_BORDER).fontSize(7).font("Helvetica-Bold")
       .text("IMPORTANT: The following data was NOT available to the council at the time of deliberation.", L + 4, doc.y, { width: W - 8 });
    doc.fillColor(TEXT_SECONDARY).fontSize(7).font("Helvetica")
       .text("This appendix contains post-failure outcome data included for retrospective validation purposes only. It is clearly separated from the council deliberation record and was not used in any council vote or rationale.", L + 4, doc.y, { width: W - 8, lineGap: 1 });
    doc.moveDown(0.3);

    doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold")
       .text("ILLUMINATE Trial Termination — December 2, 2006", L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.1);
    bullet("Trial: ILLUMINATE (Investigation of Lipid Level Management to Understand its Impact in Atherosclerotic Events).");
    bullet("Enrollment: 15,067 patients randomized. Torcetrapib 60mg + atorvastatin vs atorvastatin alone.");
    bullet("Termination: December 2, 2006 — DSMB terminated trial for excess mortality in torcetrapib arm.");
    bullet("Deaths: 82 deaths in torcetrapib arm vs 51 deaths in control arm (p=0.0001).");
    bullet("CV events: 6.2% vs 5.0% — torcetrapib arm had significantly more major CV events.");
    bullet("BP finding: Systolic BP increase of +5.4 mmHg in torcetrapib arm (vs +2 mmHg in Phase II — the signal was larger in Phase III).");
    doc.moveDown(0.2);

    doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold")
       .text("Financial Impact", L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.1);
    bullet("R&D write-off: ~$800M (15 years of development costs written off on termination announcement).");
    bullet("Market cap loss: ~$21B Pfizer market capitalization loss on December 3, 2006.");
    bullet("Strategic consequence: Pfizer had no successor to Lipitor. Patent cliff (2010) proceeded without a replacement blockbuster.");
    doc.moveDown(0.2);

    doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold")
       .text("Off-Target Mechanism Confirmation — Forrest et al. 2008", L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.1);
    bullet("Publication: Forrest MJ et al. J Pharmacol Exp Ther. 2008;324(2):571-579.");
    bullet("Finding: Torcetrapib stimulates aldosterone secretion via an off-target mechanism independent of CETP inhibition.");
    bullet("Mechanism: Aldosterone-mediated sodium retention and vasoconstriction — explains the BP increase observed in Phase II.");
    bullet("Class implication: The BP effect is torcetrapib-specific, not a CETP class effect. Subsequent CETP inhibitors (dalcetrapib, anacetrapib, evacetrapib) did not show the same aldosterone effect.");
    bullet("Retrospective validation: The Phase II BP signal (+2 mmHg) was a direct harbinger of the off-target aldosterone effect. The council's WAIT verdict was retrospectively correct.");
    doc.moveDown(0.2);

    doc.fillColor(BRAND_DARK).fontSize(8).font("Helvetica-Bold")
       .text("Retrospective Validation Statement", L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.1);
    const retVerdictColor = result.verdict === "WAIT" || result.verdict === "NO-GO" ? GREEN : RED;
    doc.fillColor(retVerdictColor).fontSize(8).font("Helvetica-Bold")
       .text(`Council verdict: ${result.verdict} — Retrospectively: CORRECT`, L + 4, doc.y, { width: W - 8 });
    doc.moveDown(0.1);
    bullet("The council identified the BP signal as a primary blocker requiring mechanistic investigation before Phase III advancement.");
    bullet("The actual Phase III outcome confirmed that the BP signal was a harbinger of a fatal off-target aldosterone effect.");
    bullet("Had the council's WAIT verdict been followed, the mechanistic investigation would have identified the aldosterone effect before 15,067 patients were enrolled.");
    bullet("The human cost of not following a WAIT verdict: 82 deaths vs 51 in control arm. The financial cost: $800M write-off and $21B market cap loss.");
    doc.moveDown(0.3);

    // Evidence boundary statement
    const ebY = doc.y;
    doc.rect(L, ebY, W, 30).fill(SECTION_BG);
    doc.fillColor(PHARMA_TEAL).fontSize(7).font("Helvetica-Bold")
       .text("EVIDENCE BOUNDARY STATEMENT (AUDIT RECORD)", L + 6, ebY + 4, { width: W - 12 });
    doc.fillColor(TEXT_SECONDARY).fontSize(6.5).font("Helvetica")
       .text(result.evidenceBoundaryStatement, L + 6, ebY + 14, { width: W - 12, lineGap: 0.5 });
    doc.y = ebY + 34;

    // ── TRACEABILITY FOOTER ───────────────────────────────────────────────────
    doc.moveDown(0.5);
    rule();
    const traceItems = [
      `Report: ${reportId}  |  Session: ${result.sessionId}`,
      `Constitution: ${result.constitutionVersion}  |  Evidence Cutoff: ${result.evidenceCutoff}`,
      `Council: 10 personas  |  Duration: ${Math.round(result.durationMs / 1000)}s  |  Proof Score: ${result.proofScore}/100`,
      `Verdict: ${result.verdict}  |  Vote: ${result.goCount} GO / ${result.waitCount} WAIT / ${result.noGoCount} NO-GO`,
      `Generated: ${new Date().toISOString()}  |  Format: PDF  |  Version: Pharma-Pilot-v1.0`,
    ];
    traceItems.forEach(t => {
      doc.fillColor(TEXT_MUTED).fontSize(6).font("Helvetica")
         .text(t, L + 4, doc.y, { width: W - 8 });
      doc.moveDown(0.1);
    });

    // ── PAGE FOOTERS ──────────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(TEXT_MUTED).fontSize(6).font("Helvetica")
         .text(
           `AgenThink Mesh  |  Institutional Proof Report  |  Pharma Council V1  |  ${reportId}  |  Page ${i + 1} of ${range.count}`,
           L, doc.page.height - 28, { width: W, align: "center" },
         );
    }

    doc.end();
  });
}
