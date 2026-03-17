/**
 * Dossier PDF Export Router
 *
 * Generates an institutional-grade Clinical Dossier PDF from a completed workflow run.
 * Navy/gold design, 8 sections, route map, mandatory disclaimer footer on every page.
 *
 * Uses PDFKit via a Node.js script invoked from the server.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workflowRuns, workflowSteps } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { storagePut } from "../storage";
import { randomUUID } from "crypto";

// ── PDF generation (pure Node.js, no external CLI) ───────────────────────────

async function generateClinicalDossierPdf(
  run: any,
  steps: any[],
  blackboard: any
): Promise<Buffer> {
  // Dynamic import of pdfkit
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 80, left: 60, right: 60 },
      info: {
        Title: "AgenThink Mesh — Clinical Dossier",
        Author: "AgenThink Mesh · Rosie Protocol",
        Subject: "Cancer Treatment Research Dossier",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Design tokens ─────────────────────────────────────────────────────────
    const NAVY = "#050D1A";
    const NAVY_MID = "#0A1628";
    const NAVY_LIGHT = "#0F2040";
    const GOLD = "#D4AF37";
    const GOLD_LIGHT = "#F0D060";
    const CYAN = "#38BDF8";
    const WHITE = "#F0F4FA";
    const MUTED = "#8899AA";
    const RED = "#F87171";
    const GREEN = "#4ADE80";
    const AMBER = "#FBBF24";

    const PAGE_W = 595.28 - 120; // A4 width minus margins
    const PAGE_H = 841.89;

    // ── Helpers ───────────────────────────────────────────────────────────────

    function addPageBackground() {
      doc.rect(0, 0, 595.28, PAGE_H).fill(NAVY);
    }

    function addHeaderBar() {
      // Top gold bar
      doc.rect(0, 0, 595.28, 4).fill(GOLD);
      // Header area
      doc.rect(0, 4, 595.28, 44).fill(NAVY_MID);
      // Logo area
      doc.fontSize(7).fillColor(GOLD).font("Helvetica-Bold")
        .text("AGENTHINK MESH", 60, 16, { continued: false });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text("ROSIE PROTOCOL · CLINICAL DOSSIER", 60, 26);
      // Date
      const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(dateStr, 595.28 - 120, 22, { width: 60, align: "right" });
    }

    function addFooter(pageNum: number, totalPages: number) {
      // Bottom gold bar
      doc.rect(0, PAGE_H - 4, 595.28, 4).fill(GOLD);
      // Footer area
      doc.rect(0, PAGE_H - 36, 595.28, 32).fill(NAVY_MID);
      doc.fontSize(6).fillColor(RED).font("Helvetica-Bold")
        .text("RESEARCH USE ONLY — NOT MEDICAL ADVICE — REQUIRES QUALIFIED PROFESSIONAL REVIEW", 60, PAGE_H - 26, { width: PAGE_W - 60, align: "left" });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(`Page ${pageNum}`, 595.28 - 80, PAGE_H - 26, { width: 40, align: "right" });
    }

    function sectionHeader(title: string, subtitle?: string) {
      doc.moveDown(0.5);
      const y = doc.y;
      doc.rect(60, y, 3, subtitle ? 28 : 18).fill(GOLD);
      doc.fontSize(11).fillColor(GOLD).font("Helvetica-Bold")
        .text(title, 70, y);
      if (subtitle) {
        doc.fontSize(8).fillColor(MUTED).font("Helvetica")
          .text(subtitle, 70, y + 14);
      }
      doc.moveDown(subtitle ? 1.2 : 0.8);
    }

    function bodyText(text: string, color = WHITE) {
      doc.fontSize(9).fillColor(color).font("Helvetica")
        .text(text, { lineGap: 3 });
      doc.moveDown(0.3);
    }

    function tagRow(items: string[], color = CYAN) {
      if (!items || items.length === 0) return;
      let x = 60;
      const y = doc.y;
      const rowH = 16;
      items.slice(0, 8).forEach(item => {
        const w = item.length * 5.5 + 16;
        if (x + w > 535) return; // skip overflow
        doc.roundedRect(x, y, w, rowH, 3).fillAndStroke(`${color}18`, `${color}44`);
        doc.fontSize(7).fillColor(color).font("Helvetica")
          .text(item, x + 8, y + 4, { width: w - 16, lineBreak: false });
        x += w + 6;
      });
      doc.y = y + rowH + 6;
      doc.moveDown(0.3);
    }

    function divider() {
      doc.moveDown(0.4);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor(`${GOLD}30`).lineWidth(0.5).stroke();
      doc.moveDown(0.4);
    }

    function confidenceBadge(level: number | null) {
      if (level === null) return;
      const color = level >= 70 ? GREEN : level >= 50 ? AMBER : RED;
      const label = `${level}% confidence`;
      const w = 80;
      doc.roundedRect(535 - w, doc.y - 14, w, 14, 3).fillAndStroke(`${color}18`, `${color}44`);
      doc.fontSize(7).fillColor(color).font("Helvetica-Bold")
        .text(label, 535 - w + 4, doc.y - 12, { width: w - 8, lineBreak: false });
    }

    // ── Cover Page ────────────────────────────────────────────────────────────

    addPageBackground();
    doc.rect(0, 0, 595.28, 4).fill(GOLD);

    // Large title area
    doc.rect(0, 4, 595.28, 220).fill(NAVY_LIGHT);

    doc.fontSize(7).fillColor(GOLD).font("Helvetica-Bold")
      .text("AGENTHINK MESH", 60, 30);
    doc.fontSize(6).fillColor(MUTED).font("Helvetica")
      .text("ROSIE PROTOCOL · 6-AGENT SEQUENTIAL PIPELINE", 60, 44);

    doc.fontSize(28).fillColor(WHITE).font("Helvetica-Bold")
      .text("Clinical Research", 60, 80);
    doc.fontSize(28).fillColor(GOLD).font("Helvetica-Bold")
      .text("Dossier", 60, 112);

    doc.fontSize(10).fillColor(MUTED).font("Helvetica")
      .text("Cancer Treatment Research · AI-Assisted Analysis", 60, 152);

    // Metadata box
    doc.rect(60, 178, PAGE_W, 36).fill(`${CYAN}0A`).stroke(`${CYAN}30`);
    const runDate = run.createdAt ? new Date(run.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";
    const duration = run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—";
    const tokens = blackboard?.tokenUsage ?? 0;
    doc.fontSize(7).fillColor(MUTED).font("Helvetica")
      .text(`Session: ${run.sessionId?.slice(0, 16)}…  ·  Date: ${runDate}  ·  Duration: ${duration}  ·  Tokens: ${tokens.toLocaleString()}  ·  Agents: 6`, 68, 192);

    // Route map
    doc.y = 240;
    doc.fontSize(7).fillColor(GOLD).font("Helvetica-Bold")
      .text("PIPELINE ROUTE MAP", 60, 240);

    const agents = [
      { name: "Intake", icon: "📋" },
      { name: "Research", icon: "🔬" },
      { name: "Mutation", icon: "🧬" },
      { name: "Structural", icon: "⚗️" },
      { name: "Therapeutic", icon: "💊" },
      { name: "Validation", icon: "✅" },
    ];
    const nodeW = 68;
    const nodeH = 28;
    const startX = 60;
    const nodeY = 258;
    agents.forEach((a, i) => {
      const x = startX + i * (nodeW + 16);
      const step = steps.find(s => s.stepIndex === i);
      const isComplete = step?.status === "complete";
      const nodeFill = isComplete ? `${GREEN}15` : `${MUTED}10`;
      const nodeBorder = isComplete ? `${GREEN}60` : `${MUTED}30`;
      doc.roundedRect(x, nodeY, nodeW, nodeH, 4).fillAndStroke(nodeFill, nodeBorder);
      doc.fontSize(7).fillColor(isComplete ? GREEN : MUTED).font("Helvetica-Bold")
        .text(a.name, x + 4, nodeY + 5, { width: nodeW - 8, align: "center" });
      doc.fontSize(6).fillColor(MUTED).font("Helvetica")
        .text(isComplete ? "✓ Complete" : "Pending", x + 4, nodeY + 16, { width: nodeW - 8, align: "center" });
      // Arrow
      if (i < agents.length - 1) {
        const arrowX = x + nodeW + 2;
        doc.moveTo(arrowX, nodeY + nodeH / 2)
          .lineTo(arrowX + 12, nodeY + nodeH / 2)
          .strokeColor(isComplete ? `${GREEN}60` : `${MUTED}30`).lineWidth(1).stroke();
        doc.moveTo(arrowX + 9, nodeY + nodeH / 2 - 3)
          .lineTo(arrowX + 12, nodeY + nodeH / 2)
          .lineTo(arrowX + 9, nodeY + nodeH / 2 + 3)
          .strokeColor(isComplete ? `${GREEN}60` : `${MUTED}30`).lineWidth(1).stroke();
      }
    });

    // Disclaimer box
    doc.rect(60, 310, PAGE_W, 44).fill(`${RED}08`).stroke(`${RED}30`);
    doc.fontSize(7).fillColor(RED).font("Helvetica-Bold")
      .text("MANDATORY DISCLAIMER", 68, 320);
    doc.fontSize(7).fillColor(`${RED}CC`).font("Helvetica")
      .text("This dossier is produced for research purposes only and does not constitute medical advice, diagnosis, or treatment recommendation. All findings require independent review by a qualified oncologist, molecular biologist, and clinical pharmacologist before any clinical application. AgenThink Mesh and its AI agents are research tools, not medical devices.", 68, 332, { width: PAGE_W - 16, lineGap: 2 });

    addFooter(1, 1);

    // ── Section Pages ─────────────────────────────────────────────────────────

    const SECTION_AGENTS = [
      { title: "Section 1 — Case Intake", subtitle: "Structured clinical case parsing and entity extraction", stepIndex: 0, color: CYAN },
      { title: "Section 2 — Literature Review", subtitle: "Biomedical literature analysis and evidence synthesis", stepIndex: 1, color: "#A78BFA" },
      { title: "Section 3 — Molecular Target Identification", subtitle: "Candidate genes, proteins, and actionable biomarkers", stepIndex: 2, color: GREEN },
      { title: "Section 4 — Structural Analysis", subtitle: "Simulated binding analysis and drug-target compatibility", stepIndex: 3, color: "#FB923C" },
      { title: "Section 5 — Therapeutic Strategy", subtitle: "Candidate interventions and research hypotheses", stepIndex: 4, color: "#F472B6" },
      { title: "Section 6 — Validation & Risk Review", subtitle: "Cross-agent validation, contradictions, and safety flags", stepIndex: 5, color: AMBER },
    ];

    let pageNum = 2;

    SECTION_AGENTS.forEach(section => {
      doc.addPage();
      addPageBackground();
      addHeaderBar();
      doc.y = 64;

      const step = steps.find(s => s.stepIndex === section.stepIndex);
      const out = step?.structuredOutput;

      sectionHeader(section.title, section.subtitle);

      if (!step || step.status !== "complete" || !out) {
        bodyText("This agent did not complete successfully.", MUTED);
        if (step?.errorMessage) {
          bodyText(`Error: ${step.errorMessage}`, RED);
        }
        addFooter(pageNum++, 1);
        return;
      }

      // Confidence + metrics row
      const metrics = [
        step.confidenceLevel !== null ? `Confidence: ${step.confidenceLevel}%` : null,
        step.tokensUsed ? `Tokens: ${step.tokensUsed.toLocaleString()}` : null,
        step.durationMs ? `Duration: ${(step.durationMs / 1000).toFixed(1)}s` : null,
        step.warningCount > 0 ? `Warnings: ${step.warningCount}` : null,
      ].filter(Boolean) as string[];

      if (metrics.length > 0) {
        doc.fontSize(7).fillColor(MUTED).font("Helvetica")
          .text(metrics.join("  ·  "), 60, doc.y);
        doc.moveDown(0.6);
      }

      divider();

      // Summary
      if (out.summary) {
        doc.fontSize(9).fillColor(WHITE).font("Helvetica")
          .text(out.summary, { lineGap: 3 });
        doc.moveDown(0.5);
      }

      // Entities
      if (out.entities && Object.keys(out.entities).length > 0) {
        Object.entries(out.entities).forEach(([key, values]: [string, any]) => {
          if (!Array.isArray(values) || values.length === 0) return;
          doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
            .text(key.replace(/([A-Z])/g, ' $1').trim().toUpperCase());
          doc.moveDown(0.2);
          tagRow(values.slice(0, 8), section.color);
        });
      }

      // Nested object sections (caseStructure, literatureSummary, etc.)
      const nestedKeys = Object.keys(out).filter(k =>
        !["summary", "entities", "unresolvedQuestions", "confidenceLevel", "warnings"].includes(k) &&
        typeof out[k] === "object" && out[k] !== null
      );

      if (nestedKeys.length > 0) {
        divider();
        nestedKeys.forEach(key => {
          const obj = out[key];
          doc.fontSize(8).fillColor(section.color).font("Helvetica-Bold")
            .text(key.replace(/([A-Z])/g, ' $1').trim());
          doc.moveDown(0.2);
          Object.entries(obj).forEach(([k, v]: [string, any]) => {
            if (!v) return;
            const label = k.replace(/([A-Z])/g, ' $1').trim();
            if (Array.isArray(v)) {
              doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold").text(`${label}:`);
              v.forEach((item: string) => {
                doc.fontSize(8).fillColor(WHITE).font("Helvetica").text(`  • ${item}`, { lineGap: 2 });
              });
            } else {
              doc.fontSize(8).fillColor(WHITE).font("Helvetica")
                .text(`${label}: `, { continued: true }).fillColor(MUTED).text(String(v));
            }
            doc.moveDown(0.2);
          });
          doc.moveDown(0.3);
        });
      }

      // Warnings
      if (out.warnings && out.warnings.length > 0) {
        divider();
        doc.fontSize(7).fillColor(AMBER).font("Helvetica-Bold")
          .text("WARNINGS & LIMITATIONS");
        doc.moveDown(0.3);
        out.warnings.forEach((w: string) => {
          doc.fontSize(8).fillColor(AMBER).font("Helvetica")
            .text(`⚠  ${w}`, { lineGap: 2 });
        });
        doc.moveDown(0.3);
      }

      // Unresolved questions
      if (out.unresolvedQuestions && out.unresolvedQuestions.length > 0) {
        divider();
        doc.fontSize(7).fillColor(MUTED).font("Helvetica-Bold")
          .text("UNRESOLVED QUESTIONS");
        doc.moveDown(0.3);
        out.unresolvedQuestions.forEach((q: string) => {
          doc.fontSize(8).fillColor(MUTED).font("Helvetica")
            .text(`?  ${q}`, { lineGap: 2 });
        });
      }

      addFooter(pageNum++, 1);
    });

    // ── Section 7 — Risk Summary ──────────────────────────────────────────────

    doc.addPage();
    addPageBackground();
    addHeaderBar();
    doc.y = 64;

    sectionHeader("Section 7 — Accumulated Risk Flags", "All warnings and risk signals across the full pipeline");

    const riskFlags: string[] = blackboard?.riskFlags ?? [];
    if (riskFlags.length === 0) {
      bodyText("No risk flags accumulated during this pipeline run.", MUTED);
    } else {
      riskFlags.forEach((flag: string, i: number) => {
        doc.rect(60, doc.y, PAGE_W, 18).fill(`${AMBER}08`).stroke(`${AMBER}20`);
        doc.fontSize(7).fillColor(AMBER).font("Helvetica")
          .text(`${i + 1}.  ${flag}`, 68, doc.y + 4, { width: PAGE_W - 16, lineBreak: false });
        doc.y += 22;
      });
    }

    addFooter(pageNum++, 1);

    // ── Section 8 — Methodology & Disclaimer ─────────────────────────────────

    doc.addPage();
    addPageBackground();
    addHeaderBar();
    doc.y = 64;

    sectionHeader("Section 8 — Methodology & Mandatory Disclaimer", "Pipeline architecture, limitations, and legal notice");

    bodyText("The Rosie Protocol is a 6-agent sequential AI pipeline built on AgenThink Mesh. Each agent receives the full blackboard memory from all prior agents, enabling cumulative reasoning without information loss between steps.", WHITE);
    doc.moveDown(0.3);

    doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold").text("Pipeline Architecture");
    doc.moveDown(0.2);
    const archItems = [
      "Agent 1 (Intake): Parses clinical case into structured entities using AAOIFI-aligned clinical ontology.",
      "Agent 2 (Research): Synthesises relevant biomedical literature and identifies evidence gaps.",
      "Agent 3 (Mutation): Identifies candidate molecular targets and actionable biomarkers.",
      "Agent 4 (Structural): Simulates binding analysis using target class inference (no wet lab).",
      "Agent 5 (Therapeutic): Proposes candidate interventions and research hypotheses.",
      "Agent 6 (Validation): Cross-validates all outputs, identifies contradictions, and produces final dossier.",
    ];
    archItems.forEach(item => {
      doc.fontSize(8).fillColor(MUTED).font("Helvetica").text(`• ${item}`, { lineGap: 2 });
    });
    doc.moveDown(0.5);

    divider();

    doc.fontSize(8).fillColor(GOLD).font("Helvetica-Bold").text("Known Limitations");
    doc.moveDown(0.2);
    const limitations = [
      "Structural analysis (Section 4) is computationally simulated — no molecular docking software is used.",
      "Literature references are inferred from training data, not retrieved from live databases (PubMed, ClinicalTrials.gov).",
      "Confidence levels are self-reported by each agent and should not be treated as statistical confidence intervals.",
      "The pipeline does not have access to patient-specific genomic sequencing data unless explicitly provided.",
      "All drug-target interactions are based on known class-level mechanisms, not patient-specific pharmacogenomics.",
    ];
    limitations.forEach(item => {
      doc.fontSize(8).fillColor(MUTED).font("Helvetica").text(`• ${item}`, { lineGap: 2 });
    });
    doc.moveDown(0.5);

    divider();

    // Final disclaimer box
    doc.rect(60, doc.y, PAGE_W, 80).fill(`${RED}08`).stroke(`${RED}40`);
    const disclaimerY = doc.y + 10;
    doc.fontSize(8).fillColor(RED).font("Helvetica-Bold")
      .text("MANDATORY LEGAL DISCLAIMER", 68, disclaimerY);
    doc.fontSize(8).fillColor(`${RED}CC`).font("Helvetica")
      .text(
        "This Clinical Dossier is produced exclusively for research and informational purposes. It does not constitute medical advice, clinical diagnosis, treatment recommendation, or regulatory guidance of any kind. All outputs generated by AgenThink Mesh AI agents are research hypotheses that require independent validation by qualified medical professionals.\n\nBefore any clinical application, this dossier must be reviewed by: (1) a board-certified oncologist, (2) a molecular biologist with relevant domain expertise, and (3) a clinical pharmacologist. AgenThink Mesh, its operators, and its AI agents accept no liability for clinical decisions made on the basis of this document.\n\nAgenThink Mesh is a research tool, not a medical device. It is not approved by any regulatory authority for clinical use.",
        68, disclaimerY + 14,
        { width: PAGE_W - 16, lineGap: 3 }
      );

    addFooter(pageNum, 1);

    doc.end();
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dossierPdfRouter = router({
  generate: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch run
      const run = await db.select().from(workflowRuns)
        .where(and(eq(workflowRuns.sessionId, input.sessionId), eq(workflowRuns.userId, ctx.user.id)))
        .limit(1);

      if (!run[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow run not found" });
      if (run[0].status !== "complete") throw new TRPCError({ code: "BAD_REQUEST", message: "Workflow run is not complete" });

      // Fetch steps
      const steps = await db.select().from(workflowSteps)
        .where(eq(workflowSteps.sessionId, input.sessionId));

      const parsedSteps = steps.map(s => ({
        ...s,
        structuredOutput: s.structuredOutput ? JSON.parse(s.structuredOutput) : null,
      }));

      const blackboard = JSON.parse(run[0].blackboardMemory || "{}");

      // Generate PDF
      const pdfBuffer = await generateClinicalDossierPdf(run[0], parsedSteps, blackboard);

      // Upload to S3
      const fileKey = `dossiers/${ctx.user.id}/${input.sessionId}-${randomUUID().slice(0, 8)}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      return { url, fileKey };
    }),
});
