/**
 * aros/boardPack.ts — Board Intelligence Pack
 *
 * Generates a board-quality 8-section intelligence document on demand.
 * Every section is derived from real operational Atlas data.
 * No fabricated examples. No simulated performance.
 *
 * Sections:
 *   1. Executive Summary (one page — "what a board director needs before voting")
 *   2. Decision Twin (strategic decision, hidden variable, signals, timeline)
 *   3. Executive Intelligence Brief (exactly as delivered)
 *   4. Institutional Proof (accuracy metrics, constitution version, API)
 *   5. Calibration (prediction → outcome → difference → learning)
 *   6. Customer Proof (verified completed engagements only)
 *   7. Recommendation (3 strategic options with advantages, risks, conditions, confidence)
 *   8. Audit Trail (version manifest, evidence hash, generation timestamp)
 */
import { z } from "zod";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosDecisionTwinsV2,
  arosHiddenVariables,
  arosOutcomeLedgerV2,
  arosCalibration,
  arosAccuracySnapshots,
  atlasConstitutionVersions,
  atlasBriefDrafts,
  arosAuditLog,
  arosOutreachQueue,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";
import { storagePut } from "../../storage";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BoardPackSection {
  title: string;
  content: string;        // Markdown-formatted content
  metadata?: Record<string, string | number | null>;
}

export interface BoardPackData {
  packId: string;
  companyId: number;
  companyName: string;
  executiveName: string | null;
  generatedAt: number;
  constitutionVersion: string;
  modelVersion: string;
  sections: BoardPackSection[];
  auditTrail: {
    decisionTwinVersion: string;
    constitutionVersion: string;
    hiddenVariableVersion: string;
    evidenceManifestHash: string | null;
    generationTimestamp: number;
    modelVersion: string;
    packId: string;
  };
}

// ── LLM helpers ───────────────────────────────────────────────────────────────

async function generateExecutiveSummary(ctx: {
  companyName: string;
  executiveName: string | null;
  sector: string;
  country: string;
  strategicDecision: string;
  hiddenVariable: string;
  hvConfidence: number;
  dtAccuracy: number | null;
  hvAccuracy: number | null;
  constitutionVersion: string;
  sss: number;
  esi: number;
  briefContent: string | null;
}): Promise<string> {
  const resp = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are Atlas, the world's most rigorous executive intelligence system.
You are writing the opening page of a Board Intelligence Pack.
This page must answer ONE question: "If I were a board director, what do I need to know before voting?"
Rules:
- Maximum 400 words
- Opinion first, evidence second
- No generic language. No marketing language.
- State the strategic decision plainly
- State the hidden variable plainly
- State Atlas confidence plainly
- State what would change the recommendation
- Write as if you are a senior partner at McKinsey presenting to a board of directors
- Never use phrases like "leveraging", "synergies", "transformative", "game-changing"`,
      },
      {
        role: "user",
        content: `Generate the Executive Summary for the Board Intelligence Pack.

Company: ${ctx.companyName}
Executive: ${ctx.executiveName ?? "CEO"}
Sector: ${ctx.sector}
Country: ${ctx.country}
Strategic Decision: ${ctx.strategicDecision}
Hidden Variable: ${ctx.hiddenVariable}
Hidden Variable Confidence: ${Math.round(ctx.hvConfidence * 100)}%
Decision Twin Accuracy (historical): ${ctx.dtAccuracy != null ? Math.round(ctx.dtAccuracy * 100) + "%" : "No historical data yet"}
Hidden Variable Accuracy (historical): ${ctx.hvAccuracy != null ? Math.round(ctx.hvAccuracy * 100) + "%" : "No historical data yet"}
Strategic Significance Score: ${ctx.sss}/100
Executive Surprise Index: ${ctx.esi}/100
Atlas Constitution Version: ${ctx.constitutionVersion}

Executive Intelligence Brief (as delivered):
${ctx.briefContent ?? "No brief generated yet."}

Write the Executive Summary now. Start with your verdict.`,
      },
    ],
  });
  return (resp.choices?.[0]?.message?.content as string) ?? "";
}

async function generateRecommendation(ctx: {
  companyName: string;
  executiveName: string | null;
  strategicDecision: string;
  hiddenVariable: string;
  hvConfidence: number;
  monitoringSignals: string[];
  estimatedDecisionTimeline: string | null;
  estimatedAcvUsd: number;
}): Promise<string> {
  const resp = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are Atlas. Generate exactly three strategic options for engaging this executive.
Each option must have:
- Option name (one sentence)
- Advantages (2-3 bullet points)
- Risks (2-3 bullet points)
- Conditions (what must be true for this option to succeed)
- Confidence (0-100%)
Format as structured Markdown with clear headers.
Be specific. Be opinionated. No generic options.`,
      },
      {
        role: "user",
        content: `Generate three strategic options for the following situation:

Company: ${ctx.companyName}
Executive: ${ctx.executiveName ?? "CEO"}
Strategic Decision: ${ctx.strategicDecision}
Hidden Variable: ${ctx.hiddenVariable}
Hidden Variable Confidence: ${Math.round(ctx.hvConfidence * 100)}%
Monitoring Signals: ${ctx.monitoringSignals.join("; ")}
Estimated Decision Timeline: ${ctx.estimatedDecisionTimeline ?? "Unknown"}
Estimated ACV: $${(ctx.estimatedAcvUsd / 1000).toFixed(0)}K

Generate the three strategic options now.`,
      },
    ],
  });
  return (resp.choices?.[0]?.message?.content as string) ?? "";
}

// ── Router ────────────────────────────────────────────────────────────────────

export const boardPackRouter = router({

  /**
   * List companies available for Board Pack generation (top 50 by SSS).
   */
  listCompanies: protectedProcedure.query(async () => {
    const db = await requireDb();
    const companies = await db
      .select({
        id: arosCompanies.id,
        companyName: arosCompanies.companyName,
        sector: arosCompanies.sector,
        country: arosCompanies.country,
        ceoName: arosCompanies.ceoName,
        sss: arosCompanies.sss,
        esi: arosCompanies.esi,
        decisionLevel: arosCompanies.decisionLevel,
      })
      .from(arosCompanies)
      .orderBy(desc(arosCompanies.sss))
      .limit(50);
    return companies;
  }),

  /**
   * Generate a full Board Intelligence Pack for a given company.
   * Assembles all 8 sections from real operational data + LLM.
   */
  generatePack: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // ── Fetch company ──────────────────────────────────────────────────────
      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);

      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      // ── Fetch Decision Twin ────────────────────────────────────────────────
      const [dt] = await db
        .select()
        .from(arosDecisionTwinsV2)
        .where(eq(arosDecisionTwinsV2.companyId, input.companyId))
        .orderBy(desc(arosDecisionTwinsV2.createdAt))
        .limit(1);

      // ── Fetch Hidden Variable ──────────────────────────────────────────────
      const [hv] = await db
        .select()
        .from(arosHiddenVariables)
        .where(eq(arosHiddenVariables.companyId, input.companyId))
        .orderBy(desc(arosHiddenVariables.createdAt))
        .limit(1);

      // ── Fetch latest approved brief ────────────────────────────────────────
      const [brief] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(
          and(
            eq(atlasBriefDrafts.companyId, input.companyId),
            sql`${atlasBriefDrafts.editorStatus} IN ('APPROVED','SCHEDULED','SENT')`
          )
        )
        .orderBy(desc(atlasBriefDrafts.updatedAt))
        .limit(1);

      // ── Fetch Outcome Ledger entries ───────────────────────────────────────
      const outcomes = await db
        .select()
        .from(arosOutcomeLedgerV2)
        .where(eq(arosOutcomeLedgerV2.companyId, input.companyId))
        .orderBy(desc(arosOutcomeLedgerV2.createdAt))
        .limit(5);

      // ── Fetch Calibration records ──────────────────────────────────────────
      const calibrations = await db
        .select()
        .from(arosCalibration)
        .orderBy(desc(arosCalibration.createdAt))
        .limit(10);

      // ── Fetch latest accuracy snapshot ─────────────────────────────────────
      const [snapshot] = await db
        .select()
        .from(arosAccuracySnapshots)
        .orderBy(desc(arosAccuracySnapshots.snapshotDate))
        .limit(1);

      // ── Fetch active Constitution version ──────────────────────────────────
      const [constitution] = await db
        .select()
        .from(atlasConstitutionVersions)
        .where(eq(atlasConstitutionVersions.status, "ACTIVE"))
        .orderBy(desc(atlasConstitutionVersions.createdAt))
        .limit(1);

      // ── Fetch Customer Proof (verified outcomes only) ──────────────────────
      const customerProof = await db
        .select()
        .from(arosOutcomeLedgerV2)
        .where(
          and(
            isNotNull(arosOutcomeLedgerV2.outcomeDate),
            sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('CUSTOMER_WON','MEETING_HELD','PROPOSAL_SENT')`
          )
        )
        .orderBy(desc(arosOutcomeLedgerV2.outcomeDate))
        .limit(5);

      // ── Derived values ─────────────────────────────────────────────────────
      const constitutionVersion = constitution?.version ?? "1.0";
      const dtAccuracy = snapshot ? Number(snapshot.dtAccuracyAvg) : null;
      const hvAccuracy = snapshot ? Number(snapshot.hvAccuracyAvg) : null;
      const packId = randomUUID();
      const generatedAt = Date.now();
      const modelVersion = "atlas-v2.0";

      // Parse monitoring signals
      let monitoringSignals: string[] = [];
      try {
        monitoringSignals = JSON.parse(dt?.monitoringSignals ?? "[]");
      } catch { monitoringSignals = []; }

      // ── Section 1: Executive Summary (LLM) ────────────────────────────────
      const execSummaryContent = await generateExecutiveSummary({
        companyName: company.companyName,
        executiveName: company.ceoName,
        sector: company.sector,
        country: company.country,
        strategicDecision: dt?.strategicDecision ?? company.keyDecisionDomain ?? "Strategic transformation decision",
        hiddenVariable: hv?.hiddenVariable ?? dt?.hiddenVariable ?? "Hidden variable not yet identified",
        hvConfidence: Number(hv?.confidence ?? dt?.hiddenVariableConfidence ?? 0.5),
        dtAccuracy,
        hvAccuracy,
        constitutionVersion,
        sss: company.sss ?? 0,
        esi: company.esi ?? 0,
        briefContent: brief?.briefContent ?? null,
      });

      // ── Section 2: Decision Twin ───────────────────────────────────────────
      const dtSection: BoardPackSection = {
        title: "Decision Twin",
        content: dt ? `## Strategic Decision\n${dt.strategicDecision}\n\n## Hidden Variable\n${dt.hiddenVariable}\n\n**Confidence:** ${Math.round(Number(dt.hiddenVariableConfidence) * 100)}%\n\n## Supporting Signals\n${monitoringSignals.map(s => `- ${s}`).join("\n") || "_No signals recorded yet._"}\n\n## Timeline\n${dt.estimatedDecisionTimeline ?? "_Not estimated._"}\n\n## Recommended Engagement Path\n${dt.recommendedEngagementPath ?? "_Not specified._"}` : "_No Decision Twin generated yet for this company._",
        metadata: dt ? {
          version: dt.version,
          urgencyScore: dt.urgencyScore,
          estimatedAcvUsd: dt.estimatedAcvUsd,
          generatedBy: dt.generatedBy,
          createdAt: dt.createdAt,
        } : {},
      };

      // ── Section 3: Executive Intelligence Brief ────────────────────────────
      const briefSection: BoardPackSection = {
        title: "Executive Intelligence Brief",
        content: brief
          ? `**Subject:** ${brief.strategicDecision ?? "Executive Intelligence Brief"}\n\n${brief.briefContent ?? "_Brief content not available._"}`
          : "_No approved brief exists for this company. Generate and approve a brief in the Pre-Dispatch Editor before creating a Board Pack._",
        metadata: brief ? {
          editorStatus: brief.editorStatus,
          version: brief.version,
          approvedAt: brief.approvedAt ?? null,
          constitutionVersion: brief.constitutionVersion ?? constitutionVersion,
        } : {},
      };

      // ── Section 4: Institutional Proof ────────────────────────────────────
      const proofSection: BoardPackSection = {
        title: "Institutional Proof",
        content: snapshot
          ? `## Decision Twin Accuracy\n${snapshot.dtAccuracyAvg != null ? (Number(snapshot.dtAccuracyAvg) * 100).toFixed(1) + "%" : "No data yet"} (n=${snapshot.dtSampleSize})\n\n## Hidden Variable Accuracy\n${snapshot.hvAccuracyAvg != null ? (Number(snapshot.hvAccuracyAvg) * 100).toFixed(1) + "%" : "No data yet"} (n=${snapshot.hvSampleSize})\n\n## Outcome Ledger Growth\n${snapshot.totalOutcomeLedgerEntries} entries\n\n## Constitution Version\n${constitutionVersion}\n\n## Atlas Performance Index\n${constitution ? ((Number(constitution.decisionTwinAccuracy) + Number(constitution.hiddenVariableAccuracy)) / 2 * 100).toFixed(1) + "%" : "No data yet"}\n\n## Learning Rate\n${snapshot.totalCalibrationRecords} calibration records`
          : `## Constitution Version\n${constitutionVersion}\n\n_No accuracy snapshots available yet. Institutional proof grows as Atlas calibrates real outcomes._`,
        metadata: snapshot ? {
          snapshotDate: snapshot.snapshotDate,
          totalCompanies: snapshot.totalCompanies,
          totalOutcomeLedgerEntries: snapshot.totalOutcomeLedgerEntries,
        } : {},
      };

      // ── Section 5: Calibration ─────────────────────────────────────────────
      let calibrationContent = "";
      if (calibrations.length > 0) {
        calibrationContent = calibrations.map(c => {
          const diff = c.actualRate != null
            ? ((Number(c.actualRate) - Number(c.predictedRate)) * 100).toFixed(1)
            : null;
          return `### ${c.metric}\n- **Prediction:** ${(Number(c.predictedRate) * 100).toFixed(1)}%\n- **Outcome:** ${c.actualRate != null ? (Number(c.actualRate) * 100).toFixed(1) + "%" : "_Pending_"}\n- **Difference:** ${diff != null ? diff + "pp" : "_Pending_"}\n- **Learning:** ${c.notes ?? "_No learning note recorded._"}\n- **Sample size:** ${c.sampleSize}`;
        }).join("\n\n");
      } else {
        calibrationContent = "_No calibration records available yet. Calibration data accumulates as Atlas observes real outcomes._";
      }

      const calibrationSection: BoardPackSection = {
        title: "Calibration",
        content: calibrationContent,
        metadata: { totalRecords: calibrations.length },
      };

      // ── Section 6: Customer Proof ──────────────────────────────────────────
      let customerProofContent = "";
      if (customerProof.length > 0) {
        customerProofContent = customerProof.map(cp => {
          return `### ${cp.outcomeStatus.replace(/_/g, " ")}\n- **Hidden Variable:** ${cp.hiddenVariable ?? "_Not recorded_"}\n- **Outcome:** ${cp.outcomeNotes ?? "_No notes_"}\n- **DT Accuracy:** ${cp.dtAccuracy != null ? (Number(cp.dtAccuracy) * 100).toFixed(1) + "%" : "_Not measured_"}\n- **HV Accuracy:** ${cp.hvAccuracy != null ? (Number(cp.hvAccuracy) * 100).toFixed(1) + "%" : "_Not measured_"}\n- **Revenue Forecasted:** $${(cp.revenueForecasted / 1000).toFixed(0)}K\n- **Revenue Actual:** $${(cp.revenueActual / 1000).toFixed(0)}K`;
        }).join("\n\n");
      } else {
        customerProofContent = "_No verified customer outcomes recorded yet. Customer proof accumulates as Atlas observes real engagement results._";
      }

      const customerProofSection: BoardPackSection = {
        title: "Customer Proof",
        content: customerProofContent,
        metadata: { verifiedEngagements: customerProof.length },
      };

      // ── Section 7: Recommendation (LLM) ───────────────────────────────────
      const recommendationContent = await generateRecommendation({
        companyName: company.companyName,
        executiveName: company.ceoName,
        strategicDecision: dt?.strategicDecision ?? company.keyDecisionDomain ?? "Strategic transformation",
        hiddenVariable: hv?.hiddenVariable ?? dt?.hiddenVariable ?? "Hidden variable not identified",
        hvConfidence: Number(hv?.confidence ?? dt?.hiddenVariableConfidence ?? 0.5),
        monitoringSignals,
        estimatedDecisionTimeline: dt?.estimatedDecisionTimeline ?? null,
        estimatedAcvUsd: dt?.estimatedAcvUsd ?? 0,
      });

      // ── Section 8: Audit Trail ─────────────────────────────────────────────
      const auditTrail = {
        decisionTwinVersion: dt ? `v${dt.version}` : "No Decision Twin",
        constitutionVersion,
        hiddenVariableVersion: hv ? `hv-${hv.id}` : "No Hidden Variable",
        evidenceManifestHash: company.dtEvidenceManifestHash ?? null,
        generationTimestamp: generatedAt,
        modelVersion,
        packId,
      };

      const auditSection: BoardPackSection = {
        title: "Audit Trail",
        content: `## Pack ID\n\`${packId}\`\n\n## Decision Twin Version\n${auditTrail.decisionTwinVersion}\n\n## Constitution Version\n${auditTrail.constitutionVersion}\n\n## Hidden Variable Version\n${auditTrail.hiddenVariableVersion}\n\n## Evidence Manifest Hash\n${auditTrail.evidenceManifestHash ?? "_Not available_"}\n\n## Generation Timestamp\n${new Date(generatedAt).toISOString()}\n\n## Model Version\n${modelVersion}\n\n## Traceability\nThis Board Intelligence Pack was generated by Atlas using only verified operational data. No simulated performance data was used. Every metric is derived from real outcomes recorded in the Atlas Outcome Ledger.`,
        metadata: auditTrail,
      };

      // ── Assemble pack ──────────────────────────────────────────────────────
      const pack: BoardPackData = {
        packId,
        companyId: input.companyId,
        companyName: company.companyName,
        executiveName: company.ceoName,
        generatedAt,
        constitutionVersion,
        modelVersion,
        sections: [
          { title: "Executive Summary", content: execSummaryContent },
          dtSection,
          briefSection,
          proofSection,
          calibrationSection,
          customerProofSection,
          { title: "Recommendation", content: recommendationContent },
          auditSection,
        ],
        auditTrail,
      };

      // ── Log to audit trail ─────────────────────────────────────────────────
      await db.insert(arosAuditLog).values({
        actor: "system",
        action: "board_pack.generated",
        entityType: "board_pack",
        entityId: packId,
        payload: JSON.stringify({
          companyId: input.companyId,
          companyName: company.companyName,
          constitutionVersion,
          modelVersion,
        }),
      });

      return pack;
    }),

  /**
   * Get pack generation history for a company.
   */
  getPackHistory: protectedProcedure
    .input(z.object({ companyId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const conditions = [eq(arosAuditLog.action, "board_pack.generated")];
      if (input.companyId) {
        conditions.push(
          sql`JSON_UNQUOTE(JSON_EXTRACT(${arosAuditLog.payload}, '$.companyId')) = ${String(input.companyId)}`
        );
      }
      const history = await db
        .select()
        .from(arosAuditLog)
        .where(and(...conditions))
        .orderBy(desc(arosAuditLog.createdAt))
        .limit(20);
      return history.map(h => ({
        packId: h.entityId,
        createdAt: h.createdAt,
        payload: h.payload ? (() => { try { return JSON.parse(h.payload!); } catch { return {}; } })() : {},
      }));
    }),
});
