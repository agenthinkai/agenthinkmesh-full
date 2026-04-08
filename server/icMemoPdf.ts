/**
 * icMemoPdf.ts — Generates a VC-facing IC Memo PDF from council vote data.
 *
 * Uses an LLM call to synthesise the multi-agent output into partner-level
 * investment committee prose. The output is a clean, professional PDF that
 * reads like a real IC memo — no agent-by-agent breakdown, no system detail.
 */

import { invokeLLM } from "./_core/llm";

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

export interface ICMemoInput {
  dealName:            string;
  verdict:             string;
  yesCount:            number;
  noCount:             number;
  confidenceScore:     number;
  conditionsToProceed: string[];
  blockingIssues:      string[];
  votes:               PersonaVoteInput[];
}

interface ICMemoContent {
  topSummary: {
    verdict: string;
    consensus: string;
    thesis: string;
    topRisks: string[];
    keyCondition: string;
  };
  investmentThesis: string[];
  keyRisks: string[];
  decisionTriggers: {
    upgrades: string[];
    killers: string[];
  };
  exitView: {
    paths: Array<{ path: string; timing: string; range: string; notes: string }>;
    baseCaseNarrative: string;
  };
}

// ── LLM synthesis ─────────────────────────────────────────────────────────────
async function synthesiseICMemo(input: ICMemoInput): Promise<ICMemoContent> {
  const votesSummary = input.votes.map(v =>
    `[${v.vote} | ${Math.round(v.confidence * 100)}% conf] ${v.personaRole}: ${v.rationale.slice(0, 300)}${v.rationale.length > 300 ? "..." : ""}` +
    (v.keyFlags.length ? `\n  Flags: ${v.keyFlags.join("; ")}` : "") +
    (v.conditions.length ? `\n  Conditions: ${v.conditions.slice(0, 2).join("; ")}` : "") +
    (v.blockers.length ? `\n  Blockers: ${v.blockers.slice(0, 2).join("; ")}` : "")
  ).join("\n\n");

  const verdictLabel =
    input.verdict === "APPROVED" ? "Approve" :
    input.verdict === "APPROVED_WITH_CONDITIONS" ? "Conditional Approve" :
    input.verdict === "VETOED" ? "Reject (Veto)" : "Reject";

  const prompt = `You are a senior investment partner at a top-tier VC fund writing an internal IC memo. 
Synthesise the following multi-agent council output into a clean, partner-level investment committee memo.

DEAL: ${input.dealName}
VERDICT: ${verdictLabel} (${input.yesCount} Yes / ${input.noCount} No, ${Math.round(input.confidenceScore * 100)}% consensus)

COUNCIL VOTES AND REASONING:
${votesSummary}

CONDITIONS TO PROCEED:
${input.conditionsToProceed.slice(0, 8).join("\n")}

BLOCKING ISSUES:
${input.blockingIssues.slice(0, 8).join("\n")}

Write a JSON object with EXACTLY this structure. Be extremely concise, sharp, and direct — no AI tone, no generic language, no repetition. Every bullet must be specific and actionable. Maximum 60-90 seconds to read total.

{
  "topSummary": {
    "verdict": "one of: Approve / Conditional Approve / Reject",
    "consensus": "${input.yesCount}/10",
    "thesis": "single sentence — the non-obvious reason this could be a large outcome, or why it fails",
    "topRisks": ["risk 1 in 10 words max", "risk 2 in 10 words max"],
    "keyCondition": "single most important condition, or 'None' if approved outright"
  },
  "investmentThesis": [
    "5-6 bullets — why this could be a large outcome, what is non-obvious or differentiated. Each bullet max 2 sentences. No generic market size claims."
  ],
  "keyRisks": [
    "4 bullets — real, sharp, specific risks. Not generic. Each bullet max 2 sentences."
  ],
  "decisionTriggers": {
    "upgrades": ["2-3 bullets — what data or events would upgrade this to a full yes"],
    "killers": ["2-3 bullets — what would kill the deal or force a write-down"]
  },
  "exitView": {
    "paths": [
      { "path": "Strategic acquisition — [acquirer name]", "timing": "YYYY–YYYY", "range": "$XM–$YM", "notes": "one sentence rationale" },
      { "path": "IPO / secondary", "timing": "YYYY–YYYY", "range": "$XM–$YM", "notes": "one sentence rationale" }
    ],
    "baseCaseNarrative": "2-3 sentences: base case exit, expected MOIC range, key dependency"
  }
}

Return ONLY valid JSON. No markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a senior VC investment partner writing internal IC memos. Be concise, sharp, and specific. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const rawContent = response.choices?.[0]?.message?.content ?? "{}";
  const raw = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  try {
    return JSON.parse(raw) as ICMemoContent;
  } catch {
    // Fallback: extract JSON from the response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ICMemoContent;
    throw new Error("Failed to parse IC memo JSON from LLM response");
  }
}

// ── PDF Generator ─────────────────────────────────────────────────────────────
export async function generateICMemoPdf(input: ICMemoInput): Promise<Buffer> {
  const memo = await synthesiseICMemo(input);
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    // ── Design tokens ─────────────────────────────────────────────────────────
    const BG        = "#070B12";
    const BG2       = "#0D1421";
    const BG3       = "#111827";
    const BORDER_C  = "#1E2D3D";
    const ACCENT    = "#4A9EFF";
    const GREEN     = "#00D97E";
    const AMBER     = "#F59E0B";
    const RED       = "#EF4444";
    const WHITE     = "#E2E8F0";
    const MUTED     = "#64748B";
    const GOLD      = "#D4AF37";

    const A4_W   = 595.28;
    const A4_H   = 841.89;
    const ML     = 52;
    const MR     = 52;
    const BODY_W = A4_W - ML - MR;

    const verdictColor =
      input.verdict === "APPROVED" ? GREEN :
      input.verdict === "APPROVED_WITH_CONDITIONS" ? ACCENT :
      RED;

    const verdictLabel =
      input.verdict === "APPROVED" ? "APPROVE" :
      input.verdict === "APPROVED_WITH_CONDITIONS" ? "CONDITIONAL APPROVE" :
      input.verdict === "VETOED" ? "REJECT (VETO)" : "REJECT";

    const doc = new PDFDocument({
      size: "A4",
      autoFirstPage: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `IC Memo — ${input.dealName}`,
        Author: "AgenThinkMesh · Council of 10",
        Subject: "Investment Committee Memo",
        Keywords: "VC, IC Memo, Investment Committee",
      },
    });

    // Fill background on every page
    doc.on("pageAdded", () => {
      doc.rect(0, 0, A4_W, A4_H).fill(BG);
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Helpers ───────────────────────────────────────────────────────────────
    function ensureSpace(needed: number) {
      if (doc.y + needed > A4_H - 60) {
        doc.addPage();
        doc.y = 60;
      }
    }

    function header() {
      doc.rect(0, 0, A4_W, 40).fill(BG2);
      doc.rect(0, 40, A4_W, 1).fill(GOLD);
      doc.fontSize(7).fillColor(GOLD).font("Helvetica-Bold")
        .text("AGENTHINK MESH", ML, 13, { continued: false });
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text("COUNCIL OF 10 · IC MEMO", ML + 95, 13);
      const dateStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
      });
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(dateStr, A4_W - MR - 60, 13, { width: 60, align: "right" });
    }

    function footer(pageNum: number) {
      doc.rect(0, A4_H - 28, A4_W, 1).fill(BG3);
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
        .text(
          "CONFIDENTIAL — For Authorised Recipients Only. AI-assisted analysis. Not investment advice.",
          ML, A4_H - 18, { width: BODY_W - 50 }
        );
      doc.fontSize(6.5).fillColor(MUTED).font("Helvetica")
        .text(`${pageNum}`, A4_W - MR - 20, A4_H - 18, { width: 20, align: "right" });
    }

    function sectionTitle(title: string) {
      ensureSpace(30);
      doc.rect(ML, doc.y, BODY_W, 1).fill(BORDER_C);
      doc.y += 6;
      doc.fontSize(8).fillColor(ACCENT).font("Helvetica-Bold")
        .text(title, ML, doc.y, { characterSpacing: 1.2 });
      doc.y += 14;
    }

    function bullet(text: string, color: string = WHITE, indent: number = 0) {
      ensureSpace(24);
      const x = ML + indent;
      const w = BODY_W - indent;
      // dot
      doc.circle(x + 4, doc.y + 5.5, 2).fill(color);
      doc.fontSize(9.5).fillColor(color).font("Helvetica")
        .text(text, x + 14, doc.y, { width: w - 14, lineGap: 2 });
      doc.y += 6;
    }

    function labelValue(label: string, value: string, labelColor: string = MUTED, valueColor: string = WHITE) {
      ensureSpace(18);
      doc.fontSize(8).fillColor(labelColor).font("Helvetica-Bold")
        .text(label, ML, doc.y, { continued: true, characterSpacing: 0.5 });
      doc.fontSize(9).fillColor(valueColor).font("Helvetica")
        .text("  " + value, { continued: false });
      doc.y += 4;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 1
    // ─────────────────────────────────────────────────────────────────────────
    doc.rect(0, 0, A4_W, A4_H).fill(BG);
    header();

    // ── Cover block ───────────────────────────────────────────────────────────
    doc.y = 60;

    // Verdict pill
    doc.rect(ML, doc.y, BODY_W, 52).fillAndStroke(BG2, BORDER_C);
    const pillY = doc.y + 8;
    // Verdict label
    doc.fontSize(18).fillColor(verdictColor).font("Helvetica-Bold")
      .text(verdictLabel, ML + 16, pillY, { continued: false });
    // Consensus
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
      .text(`${input.yesCount} Yes · ${input.noCount} No · ${Math.round(input.confidenceScore * 100)}% Consensus`, ML + 16, pillY + 24);
    doc.y += 66;

    // Deal name
    doc.fontSize(20).fillColor(WHITE).font("Helvetica-Bold")
      .text(input.dealName, ML, doc.y, { width: BODY_W });
    doc.y += 8;

    // Subtitle
    doc.fontSize(10).fillColor(MUTED).font("Helvetica")
      .text("Investment Committee Memo · AgenThinkMesh Council of 10", ML, doc.y);
    doc.y += 28;

    // One-line thesis
    if (memo.topSummary?.thesis) {
      doc.rect(ML, doc.y, BODY_W, 1).fill(BORDER_C);
      doc.y += 10;
      doc.fontSize(11).fillColor(WHITE).font("Helvetica-Oblique")
        .text(`"${memo.topSummary.thesis}"`, ML, doc.y, { width: BODY_W, lineGap: 3 });
      doc.y += 20;
    }

    // Top risks + key condition
    if (memo.topSummary?.topRisks?.length) {
      doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
        .text("TOP RISKS", ML, doc.y, { characterSpacing: 1 });
      doc.y += 12;
      memo.topSummary.topRisks.forEach(r => bullet(r, RED));
    }
    doc.y += 6;
    if (memo.topSummary?.keyCondition && memo.topSummary.keyCondition !== "None") {
      doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
        .text("KEY CONDITION", ML, doc.y, { characterSpacing: 1 });
      doc.y += 12;
      bullet(memo.topSummary.keyCondition, AMBER);
    }

    doc.y += 16;

    // ── Investment Thesis ─────────────────────────────────────────────────────
    sectionTitle("INVESTMENT THESIS");
    (memo.investmentThesis ?? []).forEach(b => bullet(b, WHITE));

    doc.y += 10;

    // ── Key Risks ─────────────────────────────────────────────────────────────
    sectionTitle("KEY RISKS");
    (memo.keyRisks ?? []).forEach(b => bullet(b, RED));

    doc.y += 10;

    // ── Decision Triggers ─────────────────────────────────────────────────────
    sectionTitle("WHAT WOULD CHANGE THE DECISION");

    ensureSpace(16);
    doc.fontSize(8).fillColor(GREEN).font("Helvetica-Bold")
      .text("UPGRADES TO APPROVE", ML, doc.y, { characterSpacing: 0.8 });
    doc.y += 12;
    (memo.decisionTriggers?.upgrades ?? []).forEach(b => bullet(b, GREEN));

    doc.y += 8;
    ensureSpace(16);
    doc.fontSize(8).fillColor(RED).font("Helvetica-Bold")
      .text("DEAL KILLERS", ML, doc.y, { characterSpacing: 0.8 });
    doc.y += 12;
    (memo.decisionTriggers?.killers ?? []).forEach(b => bullet(b, RED));

    doc.y += 10;

    // ── Exit View ─────────────────────────────────────────────────────────────
    sectionTitle("EXIT VIEW");

    // Exit paths table
    const paths = memo.exitView?.paths ?? [];
    if (paths.length) {
      // Table header
      ensureSpace(22);
      doc.rect(ML, doc.y, BODY_W, 18).fill(BG3);
      const cols = [ML + 8, ML + 190, ML + 270, ML + 340];
      const hY = doc.y + 5;
      doc.fontSize(7.5).fillColor(MUTED).font("Helvetica-Bold");
      doc.text("PATH", cols[0], hY);
      doc.text("TIMING", cols[1], hY);
      doc.text("RANGE", cols[2], hY);
      doc.text("NOTES", cols[3], hY, { width: BODY_W - (cols[3] - ML) - 8 });
      doc.y += 20;

      paths.forEach((p, i) => {
        ensureSpace(28);
        if (i % 2 === 0) doc.rect(ML, doc.y, BODY_W, 26).fill(BG2);
        const rY = doc.y + 7;
        doc.fontSize(8.5).fillColor(WHITE).font("Helvetica-Bold")
          .text(p.path ?? "", cols[0], rY, { width: 175 });
        doc.fontSize(8.5).fillColor(MUTED).font("Helvetica")
          .text(p.timing ?? "", cols[1], rY, { width: 74 });
        doc.fontSize(8.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text(p.range ?? "", cols[2], rY, { width: 64 });
        doc.fontSize(8).fillColor(MUTED).font("Helvetica")
          .text(p.notes ?? "", cols[3], rY, { width: BODY_W - (cols[3] - ML) - 8, lineGap: 1 });
        doc.y += 28;
      });
    }

    doc.y += 10;
    if (memo.exitView?.baseCaseNarrative) {
      ensureSpace(40);
      doc.fontSize(9.5).fillColor(WHITE).font("Helvetica")
        .text(memo.exitView.baseCaseNarrative, ML, doc.y, { width: BODY_W, lineGap: 3 });
      doc.y += 10;
    }

    // ── Council Vote Cards (all 10 personas) ────────────────────────────────
    doc.addPage();
    doc.y = 60;

    // Section divider header
    doc.rect(ML, doc.y, BODY_W, 28).fill(BG2);
    doc.fontSize(11).fillColor(ACCENT).font("Helvetica-Bold")
      .text("COUNCIL OF 10 — INDIVIDUAL VOTES", ML + 12, doc.y + 8, { characterSpacing: 1.2 });
    doc.y += 38;

    const voteColorMap: Record<string, string> = {
      HARD_YES: GREEN,
      SOFT_YES: ACCENT,
      SOFT_NO:  AMBER,
      HARD_NO:  RED,
    };
    const voteLabelMap: Record<string, string> = {
      HARD_YES: "HARD YES",
      SOFT_YES: "SOFT YES",
      SOFT_NO:  "SOFT NO",
      HARD_NO:  "HARD NO",
    };

    input.votes.forEach((v, idx) => {
      const vColor = voteColorMap[v.vote] ?? WHITE;
      const vLabel = voteLabelMap[v.vote] ?? v.vote;
      const confPct = Math.round(v.confidence * 100);

      // Estimate card height: header(28) + rationale(~40) + flags/conditions/blockers
      const flagLines   = v.keyFlags.length   ? Math.ceil(v.keyFlags.join(" · ").length / 80) + 1 : 0;
      const condLines   = v.conditions.length ? Math.ceil(v.conditions.slice(0, 3).join(" · ").length / 80) + 1 : 0;
      const blockLines  = v.blockers.length   ? Math.ceil(v.blockers.slice(0, 3).join(" · ").length / 80) + 1 : 0;
      const estHeight   = 28 + 14 + Math.ceil(v.rationale.length / 90) * 13 + (flagLines + condLines + blockLines) * 14 + 20;
      ensureSpace(estHeight);

      // Card background
      const cardY = doc.y;
      doc.rect(ML, cardY, BODY_W, 24).fill(BG3);

      // Persona number + role
      doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
        .text(`${String(idx + 1).padStart(2, "0")}`, ML + 8, cardY + 7, { continued: false });
      doc.fontSize(9.5).fillColor(WHITE).font("Helvetica-Bold")
        .text(v.personaRole, ML + 26, cardY + 6, { width: BODY_W - 130, continued: false });

      // Vote badge (right-aligned)
      const badgeW = 72;
      doc.rect(ML + BODY_W - badgeW - 4, cardY + 4, badgeW, 16)
        .fillAndStroke(`${vColor}18`, `${vColor}55`);
      doc.fontSize(8).fillColor(vColor).font("Helvetica-Bold")
        .text(vLabel, ML + BODY_W - badgeW - 4, cardY + 8, { width: badgeW, align: "center" });

      // Confidence bar
      const barX  = ML + BODY_W - badgeW - 90;
      const barW  = 70;
      const barH  = 5;
      const barY  = cardY + 10;
      doc.rect(barX, barY, barW, barH).fill(BG2);
      doc.rect(barX, barY, barW * (v.confidence), barH).fill(vColor);
      doc.fontSize(7).fillColor(MUTED).font("Helvetica")
        .text(`${confPct}%`, barX + barW + 4, barY - 1);

      doc.y = cardY + 28;

      // Rationale
      if (v.rationale) {
        doc.fontSize(9).fillColor("#94A3B8").font("Helvetica")
          .text(v.rationale, ML + 12, doc.y, { width: BODY_W - 24, lineGap: 2 });
        doc.y += 8;
      }

      // Key flags
      if (v.keyFlags.length) {
        doc.fontSize(7.5).fillColor(AMBER).font("Helvetica-Bold")
          .text("FLAGS  ", ML + 12, doc.y, { continued: true });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(v.keyFlags.join("  ·  "), { width: BODY_W - 60, continued: false });
        doc.y += 6;
      }

      // Conditions
      if (v.conditions.length) {
        doc.fontSize(7.5).fillColor(ACCENT).font("Helvetica-Bold")
          .text("CONDITIONS  ", ML + 12, doc.y, { continued: true });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(v.conditions.slice(0, 3).join("  ·  "), { width: BODY_W - 80, continued: false });
        doc.y += 6;
      }

      // Blockers
      if (v.blockers.length) {
        doc.fontSize(7.5).fillColor(RED).font("Helvetica-Bold")
          .text("BLOCKERS  ", ML + 12, doc.y, { continued: true });
        doc.fontSize(7.5).fillColor(MUTED).font("Helvetica")
          .text(v.blockers.slice(0, 3).join("  ·  "), { width: BODY_W - 70, continued: false });
        doc.y += 6;
      }

      // Bottom separator
      doc.rect(ML, doc.y + 4, BODY_W, 0.5).fill(BORDER_C);
      doc.y += 14;
    });

    // ── Footer on all pages ───────────────────────────────────────────────────
    const totalPages = (doc as any)._pageBuffer?.length ?? 1;
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) doc.switchToPage(i);
      footer(i + 1);
    }

    doc.end();
  });
}
