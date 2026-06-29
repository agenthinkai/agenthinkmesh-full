/**
 * aros/morningReview.ts — CEO Morning Editorial Review
 *
 * The single most important page in Atlas.
 * The CEO reviews tomorrow's entire Executive Intelligence publication in < 15 minutes.
 *
 * FINAL RULE: Nothing leaves AgenThink Mesh unless it has appeared in the Morning Editorial Review.
 * Atlas behaves like the editor of the Financial Times or The Economist.
 * The objective is not to publish more. The objective is to publish only what deserves to be read.
 *
 * Sections:
 *   S6 — CEO Question: "If I could send only ONE brief tomorrow..."
 *   S1 — Tomorrow's Publication (all SCHEDULED/APPROVED briefs as cards)
 *   S2 — Full Brief (exact delivery text, no summaries)
 *   S3 — Editorial Opinion (6-question self-critique + score 0-100)
 *   S4 — Publication Controls (Approve All / Selected / Reject / Regenerate / Edit / Schedule / Send)
 *   S5 — Tomorrow's Summary (aggregate stats + projections)
 *   S7 — Final Rule Gate (block Approve All if any brief lacks editorial review)
 */
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  atlasBriefDrafts,
  atlasEditorialReviews,
  arosOutreachQueue,
  arosCompanies,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ── Decision level helper ────────────────────────────────────────────────────
function decisionLevel(sss: number): string {
  if (sss >= 90) return "BOARD";
  if (sss >= 75) return "C-SUITE";
  if (sss >= 60) return "DIVISIONAL";
  return "OPERATIONAL";
}

// ── Next dispatch window (next working day 07:00 local) ──────────────────────
function nextDispatchTime(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(7, 0, 0, 0);
  return next.getTime();
}

// ── Editorial Opinion LLM prompt ─────────────────────────────────────────────
async function runEditorialOpinion(brief: {
  companyName: string;
  executiveName: string | null;
  strategicDecision: string | null;
  hiddenVariable: string | null;
  briefContent: string | null;
  sss: number;
  esi: number;
  evidenceConfidence: number;
}): Promise<{
  isOpeningCompelling: boolean;
  isHiddenVariableUnique: boolean;
  hasMarketingLanguage: boolean;
  wouldCeoForward: boolean;
  weakOrGenericNotes: string;
  editorialScore: number;
  recommendation: "APPROVE" | "REGENERATE";
  openingAnalysis: string;
  hiddenVariableAnalysis: string;
  marketingLanguageAnalysis: string;
  forwardabilityAnalysis: string;
  weaknessAnalysis: string;
  overallVerdict: string;
}> {
  const systemPrompt = `You are the Editorial Director of AgenThink Mesh — the most demanding editor in executive intelligence.
You apply the standards of the Financial Times and The Economist to every brief before it leaves the building.
Your job is to protect the reputation of AgenThink Mesh by ensuring only genuinely valuable intelligence is dispatched.
You are not kind. You are not encouraging. You are honest.
Return ONLY valid JSON with this exact structure:
{
  "isOpeningCompelling": boolean,
  "isHiddenVariableUnique": boolean,
  "hasMarketingLanguage": boolean,
  "wouldCeoForward": boolean,
  "weakOrGenericNotes": "string — specific weaknesses or empty string if none",
  "editorialScore": number (0-100),
  "recommendation": "APPROVE" or "REGENERATE",
  "openingAnalysis": "1-2 sentences on whether the opening creates immediate executive attention",
  "hiddenVariableAnalysis": "1-2 sentences on whether the hidden variable is genuinely differentiated or generic",
  "marketingLanguageAnalysis": "1-2 sentences identifying any marketing or promotional language",
  "forwardabilityAnalysis": "1-2 sentences on whether a CEO would forward this to colleagues",
  "weaknessAnalysis": "1-2 sentences on the single weakest element of the brief",
  "overallVerdict": "2-3 sentences editorial verdict — honest, direct, no hedging"
}
SCORING GUIDE:
90-100: Exceptional. Dispatch immediately. This is what Atlas should always produce.
75-89: Good but improvable. Approve with notes.
60-74: Acceptable but generic in parts. Recommend regeneration.
Below 60: Reject. This does not meet Atlas standards.
AUTOMATIC REGENERATE triggers: score < 90, OR marketing language detected, OR hidden variable is generic.`;

  const userPrompt = `Editorial review for:
Company: ${brief.companyName}
Executive: ${brief.executiveName || "Unknown"}
Strategic Decision: ${brief.strategicDecision || "Not specified"}
Hidden Variable: ${brief.hiddenVariable || "Not specified"}
SSS: ${brief.sss} | ESI: ${brief.esi} | Evidence Confidence: ${brief.evidenceConfidence}%

FULL BRIEF TEXT:
${brief.briefContent || "(No brief content generated yet)"}

Apply the six editorial tests:
1. Is the opening compelling? (Would a CEO stop scrolling?)
2. Is the Hidden Variable genuinely differentiated? (Could it be copy-pasted to another company?)
3. Is there unnecessary marketing language? (Phrases like "cutting-edge", "revolutionary", "game-changing")
4. Would a CEO forward this to colleagues? (Is it genuinely insightful?)
5. Is there anything weak or generic? (Identify the single weakest sentence)
6. Overall Editorial Score (0-100) — be strict. 90+ means this is exceptional.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "editorial_opinion",
        strict: true,
        schema: {
          type: "object",
          properties: {
            isOpeningCompelling: { type: "boolean" },
            isHiddenVariableUnique: { type: "boolean" },
            hasMarketingLanguage: { type: "boolean" },
            wouldCeoForward: { type: "boolean" },
            weakOrGenericNotes: { type: "string" },
            editorialScore: { type: "integer" },
            recommendation: { type: "string", enum: ["APPROVE", "REGENERATE"] },
            openingAnalysis: { type: "string" },
            hiddenVariableAnalysis: { type: "string" },
            marketingLanguageAnalysis: { type: "string" },
            forwardabilityAnalysis: { type: "string" },
            weaknessAnalysis: { type: "string" },
            overallVerdict: { type: "string" },
          },
          required: [
            "isOpeningCompelling", "isHiddenVariableUnique", "hasMarketingLanguage",
            "wouldCeoForward", "weakOrGenericNotes", "editorialScore", "recommendation",
            "openingAnalysis", "hiddenVariableAnalysis", "marketingLanguageAnalysis",
            "forwardabilityAnalysis", "weaknessAnalysis", "overallVerdict",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content as string | undefined;
  if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty editorial opinion" });
  return JSON.parse(content);
}

// ── Router ────────────────────────────────────────────────────────────────────
export const morningReviewRouter = router({

  /**
   * getPublication — Return all SCHEDULED/APPROVED briefs for next dispatch window.
   * Includes full metadata, editorial review if it exists, and decision level.
   */
  getPublication: protectedProcedure.query(async () => {
    const db = await requireDb();
    const briefs = await db
      .select()
      .from(atlasBriefDrafts)
      .where(
        sql`${atlasBriefDrafts.editorStatus} IN ('SCHEDULED', 'APPROVED')`
      )
      .orderBy(desc(atlasBriefDrafts.sss));

    if (briefs.length === 0) return { briefs: [], hasUnreviewed: false };

    const briefIds = briefs.map(b => b.id);
    const reviews = briefIds.length > 0
      ? await db
          .select()
          .from(atlasEditorialReviews)
          .where(inArray(atlasEditorialReviews.briefDraftId, briefIds))
      : [];

    const reviewMap = new Map(reviews.map(r => [r.briefDraftId, r]));

    const enriched = briefs.map(b => ({
      ...b,
      decisionLevel: decisionLevel(b.sss ?? 0),
      scheduledSendTime: nextDispatchTime(),
      editorialReview: reviewMap.get(b.id) ?? null,
    }));

    const hasUnreviewed = enriched.some(b => !b.editorialReview);

    return { briefs: enriched, hasUnreviewed };
  }),

  /**
   * generateEditorialOpinion — LLM self-critique of a brief (6 questions + score 0-100).
   * Auto-flags REGENERATE if score < 90.
   */
  generateEditorialOpinion: protectedProcedure
    .input(z.object({ briefDraftId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [brief] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.id, input.briefDraftId))
        .limit(1);

      if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });

      const opinion = await runEditorialOpinion({
        companyName: brief.companyName,
        executiveName: brief.executiveName,
        strategicDecision: brief.strategicDecision,
        hiddenVariable: brief.hiddenVariable,
        briefContent: brief.briefContent,
        sss: brief.sss ?? 0,
        esi: brief.esi ?? 0,
        evidenceConfidence: brief.evidenceConfidence ?? 0,
      });

      const now = Date.now();

      // Upsert: delete existing review for this brief, then insert fresh
      await db
        .delete(atlasEditorialReviews)
        .where(eq(atlasEditorialReviews.briefDraftId, input.briefDraftId));

      await db.insert(atlasEditorialReviews).values({
        briefDraftId: input.briefDraftId,
        companyId: brief.companyId,
        companyName: brief.companyName,
        isOpeningCompelling: opinion.isOpeningCompelling ? 1 : 0,
        isHiddenVariableUnique: opinion.isHiddenVariableUnique ? 1 : 0,
        hasMarketingLanguage: opinion.hasMarketingLanguage ? 1 : 0,
        wouldCeoForward: opinion.wouldCeoForward ? 1 : 0,
        weakOrGenericNotes: opinion.weakOrGenericNotes,
        editorialScore: opinion.editorialScore,
        recommendation: opinion.recommendation,
        reviewerNotes: JSON.stringify({
          openingAnalysis: opinion.openingAnalysis,
          hiddenVariableAnalysis: opinion.hiddenVariableAnalysis,
          marketingLanguageAnalysis: opinion.marketingLanguageAnalysis,
          forwardabilityAnalysis: opinion.forwardabilityAnalysis,
          weaknessAnalysis: opinion.weaknessAnalysis,
          overallVerdict: opinion.overallVerdict,
        }),
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return { opinion, briefId: input.briefDraftId };
    }),

  /**
   * getRecommendedOne — Atlas picks the single best brief to send if only one could go out.
   */
  getRecommendedOne: protectedProcedure.query(async () => {
    const db = await requireDb();

    const briefs = await db
      .select()
      .from(atlasBriefDrafts)
      .where(sql`${atlasBriefDrafts.editorStatus} IN ('SCHEDULED', 'APPROVED')`)
      .orderBy(desc(atlasBriefDrafts.sss))
      .limit(10);

    if (briefs.length === 0) return { recommendation: null };
    if (briefs.length === 1) {
      return {
        recommendation: {
          briefId: briefs[0].id,
          companyName: briefs[0].companyName,
          executiveName: briefs[0].executiveName,
          strategicDecision: briefs[0].strategicDecision,
          explanation: "This is the only brief scheduled for tomorrow's dispatch.",
          confidence: 100,
        },
      };
    }

    const briefSummaries = briefs.map((b, i) => (
      `${i + 1}. ${b.companyName} | Executive: ${b.executiveName || "Unknown"} | SSS: ${b.sss} | ESI: ${b.esi} | Confidence: ${b.evidenceConfidence}% | Decision: ${b.strategicDecision || "Not specified"} | Hidden Variable: ${b.hiddenVariable || "Not specified"}`
    )).join("\n");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are Atlas — the Editorial Director of AgenThink Mesh.
You must recommend exactly ONE Executive Intelligence Brief to send tomorrow if only one could be dispatched.
Your recommendation must be based on: strategic significance, executive surprise potential, evidence quality, and the likelihood of generating a meaningful response.
Return ONLY valid JSON: { "briefIndex": number (1-based), "explanation": "2-3 sentences explaining why this brief is the most valuable one to send tomorrow", "confidence": number (0-100) }`,
        },
        {
          role: "user",
          content: `Tomorrow's scheduled briefs:\n${briefSummaries}\n\nWhich single brief should be sent if only one can go out?`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recommended_one",
          strict: true,
          schema: {
            type: "object",
            properties: {
              briefIndex: { type: "integer" },
              explanation: { type: "string" },
              confidence: { type: "integer" },
            },
            required: ["briefIndex", "explanation", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content as string | undefined;
    if (!content) return { recommendation: null };

    const parsed = JSON.parse(content);
    const idx = Math.max(0, Math.min(briefs.length - 1, parsed.briefIndex - 1));
    const chosen = briefs[idx];

    return {
      recommendation: {
        briefId: chosen.id,
        companyName: chosen.companyName,
        executiveName: chosen.executiveName,
        strategicDecision: chosen.strategicDecision,
        explanation: parsed.explanation,
        confidence: parsed.confidence,
      },
    };
  }),

  /**
   * approveAll — Set all SCHEDULED briefs to APPROVED (requires all to have editorial reviews).
   */
  approveAll: protectedProcedure.mutation(async () => {
    const db = await requireDb();

    const briefs = await db
      .select({ id: atlasBriefDrafts.id })
      .from(atlasBriefDrafts)
      .where(sql`${atlasBriefDrafts.editorStatus} IN ('SCHEDULED', 'APPROVED')`);

    if (briefs.length === 0) return { approved: 0 };

    const briefIds = briefs.map(b => b.id);
    const reviews = await db
      .select({ briefDraftId: atlasEditorialReviews.briefDraftId })
      .from(atlasEditorialReviews)
      .where(inArray(atlasEditorialReviews.briefDraftId, briefIds));

    const reviewedIds = new Set(reviews.map(r => r.briefDraftId));
    const unreviewed = briefIds.filter(id => !reviewedIds.has(id));

    if (unreviewed.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${unreviewed.length} brief(s) have not passed editorial review. Every brief must pass editorial review before dispatch.`,
      });
    }

    const now = Date.now();
    await db
      .update(atlasBriefDrafts)
      .set({ editorStatus: "APPROVED", approvedAt: now, updatedAt: now })
      .where(inArray(atlasBriefDrafts.id, briefIds));

    return { approved: briefIds.length };
  }),

  /**
   * approveSelected — Set selected brief IDs to APPROVED.
   */
  approveSelected: protectedProcedure
    .input(z.object({ briefIds: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const now = Date.now();
      await db
        .update(atlasBriefDrafts)
        .set({ editorStatus: "APPROVED", approvedAt: now, updatedAt: now })
        .where(inArray(atlasBriefDrafts.id, input.briefIds));
      return { approved: input.briefIds.length };
    }),

  /**
   * rejectBrief — Set brief back to DRAFT with rejection note.
   */
  rejectBrief: protectedProcedure
    .input(z.object({ briefDraftId: z.number(), note: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const now = Date.now();
      await db
        .update(atlasBriefDrafts)
        .set({ editorStatus: "DRAFT", updatedAt: now })
        .where(eq(atlasBriefDrafts.id, input.briefDraftId));
      return { rejected: true };
    }),

  /**
   * regenerateBrief — Trigger regeneration for a brief (delegates to editorBriefs generateDraft logic).
   * Resets the editorial review so a fresh opinion is generated.
   */
  regenerateBrief: protectedProcedure
    .input(z.object({ briefDraftId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [brief] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.id, input.briefDraftId))
        .limit(1);

      if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });

      // Get company data for regeneration
      let companyData: {
        sector: string;
        country: string;
        ceoName: string | null;
        keyDecisionDomain: string | null;
        activeStrategicInitiative: string | null;
        aiTransformationSignal: string | null;
        decisionTwin: string | null;
        executiveDossier: string | null;
      } = {
        sector: "Technology",
        country: "Unknown",
        ceoName: brief.executiveName,
        keyDecisionDomain: brief.strategicDecision,
        activeStrategicInitiative: null,
        aiTransformationSignal: null,
        decisionTwin: null,
        executiveDossier: null,
      };

      if (brief.companyId) {
        const [company] = await db
          .select()
          .from(arosCompanies)
          .where(eq(arosCompanies.id, brief.companyId))
          .limit(1);
        if (company) {
          companyData = {
            sector: company.sector ?? "Technology",
            country: company.country ?? "Unknown",
            ceoName: company.ceoName,
            keyDecisionDomain: company.keyDecisionDomain,
            activeStrategicInitiative: company.activeStrategicInitiative,
            aiTransformationSignal: company.aiTransformationSignal,
            decisionTwin: company.decisionTwin,
            executiveDossier: company.executiveDossier,
          };
        }
      }

      // Inline brief generation
      const systemPrompt = `You are Atlas — an autonomous Executive Intelligence System.
Generate a complete Executive Intelligence Brief.
FOUR-PARAGRAPH STRUCTURE:
1. Decision Recognition — The specific strategic decision Atlas has detected.
2. Hidden Variable — ONE variable that will determine success or failure.
3. Decision Twin — Atlas built a model of this decision. Outcome, not technology.
4. Closing Question — The question the executive should now be asking.
Return ONLY valid JSON: { "noteSubject": string, "noteBody": string, "executiveBrief": string, "hiddenVariable": string, "strategicDecision": string, "evidenceConfidence": number }`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Company: ${brief.companyName}\nSector: ${companyData.sector}\nCountry: ${companyData.country}\nExecutive: ${brief.executiveName || "CEO"}\nSSS: ${brief.sss} | ESI: ${brief.esi}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
            if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty content" });
      const contentStr = content as string;
      let parsed: { noteSubject: string; noteBody: string; executiveBrief: string; hiddenVariable: string; strategicDecision: string; evidenceConfidence: number };
      try {
        parsed = JSON.parse(contentStr);
      } catch {
        parsed = { noteSubject: "Intelligence Brief", noteBody: contentStr, executiveBrief: contentStr, hiddenVariable: "", strategicDecision: "", evidenceConfidence: 70 };
      }

      const now = Date.now();
      const newVersion = (brief.version ?? 1) + 1;
      const briefContent = `SUBJECT: ${parsed.noteSubject}\n\n${parsed.noteBody}\n\n${parsed.executiveBrief}`;

      // Insert new version
      const [result] = await db.insert(atlasBriefDrafts).values({
        companyId: brief.companyId,
        companyName: brief.companyName,
        executiveName: brief.executiveName,
        executiveTitle: brief.executiveTitle,
        executiveEmail: brief.executiveEmail,
        strategicDecision: parsed.strategicDecision || brief.strategicDecision,
        hiddenVariable: parsed.hiddenVariable || brief.hiddenVariable,
        sss: brief.sss,
        esi: brief.esi,
        evidenceConfidence: parsed.evidenceConfidence,
        tripleGateSss: brief.tripleGateSss,
        tripleGateEsi: brief.tripleGateEsi,
        tripleGateConf: brief.tripleGateConf,
        briefContent,
        editorStatus: "DRAFT",
        version: newVersion,
        parentVersionId: brief.id,
        createdAt: now,
        updatedAt: now,
        generatedBy: "morning_review_regenerate",
        constitutionVersion: brief.constitutionVersion,
      });

      // Delete old editorial review so a fresh one is generated
      await db
        .delete(atlasEditorialReviews)
        .where(eq(atlasEditorialReviews.briefDraftId, input.briefDraftId));

      return { newBriefId: (result as { insertId: number }).insertId, version: newVersion };
    }),

  /**
   * scheduleDispatch — Confirm scheduled send time for a brief.
   */
  scheduleDispatch: protectedProcedure
    .input(z.object({ briefDraftId: z.number(), scheduledAt: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const now = Date.now();
      const scheduledAt = input.scheduledAt ?? nextDispatchTime();
      await db
        .update(atlasBriefDrafts)
        .set({ editorStatus: "SCHEDULED", updatedAt: now })
        .where(eq(atlasBriefDrafts.id, input.briefDraftId));
      return { scheduled: true, scheduledAt };
    }),

  /**
   * sendImmediately — Mark brief as SENT and insert into outreach queue.
   */
  sendImmediately: protectedProcedure
    .input(z.object({ briefDraftId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [brief] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.id, input.briefDraftId))
        .limit(1);

      if (!brief) throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found" });

      const now = Date.now();

      // Mark as SENT
      await db
        .update(atlasBriefDrafts)
        .set({ editorStatus: "SENT", updatedAt: now })
        .where(eq(atlasBriefDrafts.id, input.briefDraftId));

      // Insert into outreach queue if not already there
      if (brief.companyId) {
        const existing = await db
          .select({ id: arosOutreachQueue.id })
          .from(arosOutreachQueue)
          .where(
            and(
              eq(arosOutreachQueue.companyId, brief.companyId),
              sql`${arosOutreachQueue.approvalStatus} IN ('PENDING_CEO_REVIEW', 'APPROVED')`
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(arosOutreachQueue).values({
            companyId: brief.companyId!,
            emailSubject: brief.briefContent?.split("\n")[0]?.replace("SUBJECT: ", "") ?? "Executive Intelligence Brief",
            emailBody: brief.briefContent ?? "",
            targetName: brief.executiveName ?? "",
            targetEmail: brief.executiveEmail ?? "",
            targetTitle: brief.executiveTitle ?? "",
            sss: brief.sss ?? 0,
            esi: brief.esi ?? 0,
            approvalStatus: "APPROVED",
            atlasQueue: "IMMEDIATE",
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      return { sent: true };
    }),

  /**
   * getPublicationSummary — Aggregate stats for tomorrow's dispatch.
   */
  getPublicationSummary: protectedProcedure.query(async () => {
    const db = await requireDb();

    const briefs = await db
      .select()
      .from(atlasBriefDrafts)
      .where(sql`${atlasBriefDrafts.editorStatus} IN ('SCHEDULED', 'APPROVED')`);

    if (briefs.length === 0) {
      return {
        companiesScheduled: 0,
        avgSss: 0,
        avgEsi: 0,
        avgConfidence: 0,
        avgEditorialScore: 0,
        expectedResponseRate: 0,
        expectedMeetings: 0,
        expectedProposals: 0,
        expectedRevenueOpportunity: 0,
      };
    }

    const briefIds = briefs.map(b => b.id);
    const reviews = await db
      .select()
      .from(atlasEditorialReviews)
      .where(inArray(atlasEditorialReviews.briefDraftId, briefIds));

    const reviewMap = new Map(reviews.map(r => [r.briefDraftId, r]));

    const avgSss = Math.round(briefs.reduce((s, b) => s + (b.sss ?? 0), 0) / briefs.length);
    const avgEsi = Math.round(briefs.reduce((s, b) => s + (b.esi ?? 0), 0) / briefs.length);
    const avgConf = Math.round(briefs.reduce((s, b) => s + (b.evidenceConfidence ?? 0), 0) / briefs.length);

    const reviewedBriefs = briefs.filter(b => reviewMap.has(b.id));
    const avgEditorialScore = reviewedBriefs.length > 0
      ? Math.round(reviewedBriefs.reduce((s, b) => s + (reviewMap.get(b.id)?.editorialScore ?? 0), 0) / reviewedBriefs.length)
      : 0;

    // Projections based on Atlas calibration model
    // Response rate: base 8% + SSS bonus + ESI bonus + editorial quality bonus
    const responseRateBase = 0.08;
    const sssBonus = (avgSss - 70) * 0.002;
    const esiBonus = (avgEsi - 70) * 0.0015;
    const editorialBonus = (avgEditorialScore - 70) * 0.001;
    const expectedResponseRate = Math.min(35, Math.max(3, Math.round((responseRateBase + sssBonus + esiBonus + editorialBonus) * 100)));

    const expectedMeetings = Math.round(briefs.length * (expectedResponseRate / 100) * 0.4);
    const expectedProposals = Math.round(expectedMeetings * 0.35);
    const avgDealSize = 45000; // USD — Atlas calibration baseline
    const expectedRevenueOpportunity = expectedProposals * avgDealSize;

    return {
      companiesScheduled: briefs.length,
      avgSss,
      avgEsi,
      avgConfidence: avgConf,
      avgEditorialScore,
      expectedResponseRate,
      expectedMeetings,
      expectedProposals,
      expectedRevenueOpportunity,
    };
  }),
});
