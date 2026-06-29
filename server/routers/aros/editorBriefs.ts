/**
 * aros/editorBriefs.ts — Pre-Dispatch Editor Mode
 *
 * The CEO reviews, edits, regenerates, and approves Executive Intelligence Briefs
 * for the top 25 companies CONTINUOUSLY — before dispatch day.
 *
 * Lifecycle:
 *   DRAFT → (CEO edits) → READY → (CEO approves) → APPROVED
 *   APPROVED + Triple Gate passes → SCHEDULED (auto-promoted to dispatch queue)
 *   SCHEDULED + sent → SENT
 *
 * Key principle: No new text generation occurs on dispatch day unless new evidence
 * changes the Decision Twin. Writing happens continuously. Dispatch day is execution only.
 */
import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosOutreachQueue,
  atlasBriefDrafts,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ── Shared LLM prompt (mirrors Constitution-aligned 4-paragraph structure) ────
async function generateBriefContent(company: {
  companyName: string;
  sector: string;
  country: string;
  ceoName: string | null;
  keyDecisionDomain: string | null;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  decisionTwin: string | null;
  executiveDossier: string | null;
  sss: number;
  esi: number;
}): Promise<{
  noteSubject: string;
  noteBody: string;
  executiveBrief: string;
  hiddenVariable: string;
  strategicDecision: string;
  evidenceConfidence: number;
}> {
  const systemPrompt = `You are Atlas — an autonomous Executive Intelligence System.
Your role is to generate a complete Executive Intelligence Brief for the CEO to review.

FOUR-PARAGRAPH STRUCTURE for the Executive Decision Note:
1. Decision Recognition — The specific strategic decision Atlas has detected. Impossible to reuse for another company.
2. Hidden Variable — ONE variable that will determine success or failure. Creates the question: "How did they know we were working on that?"
3. Decision Twin — Atlas built a model of this decision. Explain the outcome, not the technology.
4. Closing Question — End with the question the executive should now be asking. Not a meeting request. A thought.

FOUR TESTS — APPLY BEFORE FINALISING:
Test One: Could this brief be sent to another company? If yes — reject and rewrite.
Test Two: Would the CEO say "I had not considered that"? If no — reject and rewrite.
Test Three: Does the brief create insight before asking for attention? If no — reject and rewrite.
Test Four: Would this still be valuable if AgenThink Mesh were never mentioned? If no — reject and rewrite.

EVIDENCE GOVERNANCE — CONSTITUTIONAL RULE:
ATLAS NEVER INVENTS STRATEGIC INSIGHT.
Every brief must be grounded in observable evidence. When evidence is weak, express uncertainty explicitly.
Never manufacture confidence. Never imply certainty beyond the available evidence.

Return ONLY valid JSON.`;

  const userPrompt = `Generate a complete Executive Intelligence Brief for:
Company: ${company.companyName}
Sector: ${company.sector}
Country: ${company.country}
Executive: ${company.ceoName ?? "CEO"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Strategic Decision-Making"}
Active Strategic Initiative: ${company.activeStrategicInitiative ?? "Organizational transformation"}
Strategic Signal: ${company.aiTransformationSignal ?? "Significant strategic investment underway"}
Strategic Significance Score: ${company.sss}/100
Executive Surprise Index: ${company.esi}/100
${company.decisionTwin ? `Decision Twin Summary: ${company.decisionTwin.substring(0, 400)}` : ""}
${company.executiveDossier ? `Executive Dossier: ${company.executiveDossier.substring(0, 300)}` : ""}

Return this exact JSON:
{
  "noteSubject": "string (max 60 chars — names the specific strategic decision detected — never generic)",
  "noteBody": "string (4-paragraph Executive Decision Note — 180-220 words — passes all four tests)",
  "executiveBrief": "string (400-500 word strategic intelligence brief — sections: Strategic Decision Detected, Hidden Variable Analysis, Why This Matters Now, Decision Twin Findings, The Question You Should Be Asking)",
  "hiddenVariable": "string (one sentence — the single variable that determines success or failure)",
  "strategicDecision": "string (one sentence — the specific decision Atlas has detected)",
  "evidenceConfidence": number (0-100 — how confident Atlas is in the evidence base)
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "editor_brief",
        strict: true,
        schema: {
          type: "object",
          properties: {
            noteSubject: { type: "string" },
            noteBody: { type: "string" },
            executiveBrief: { type: "string" },
            hiddenVariable: { type: "string" },
            strategicDecision: { type: "string" },
            evidenceConfidence: { type: "number" },
          },
          required: ["noteSubject", "noteBody", "executiveBrief", "hiddenVariable", "strategicDecision", "evidenceConfidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return {
    noteSubject: parsed.noteSubject ?? "",
    noteBody: parsed.noteBody ?? "",
    executiveBrief: parsed.executiveBrief ?? "",
    hiddenVariable: parsed.hiddenVariable ?? "",
    strategicDecision: parsed.strategicDecision ?? "",
    evidenceConfidence: Number(parsed.evidenceConfidence ?? 0),
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const editorBriefsRouter = router({
  /**
   * getTop25 — Returns the top 25 companies ranked by SSS descending,
   * with the latest brief draft status for each.
   */
  getTop25: protectedProcedure.query(async () => {
    const db = await requireDb();

    // Fetch top 25 companies by SSS
    const companies = await db
      .select({
        id: arosCompanies.id,
        companyName: arosCompanies.companyName,
        sector: arosCompanies.sector,
        country: arosCompanies.country,
        ceoName: arosCompanies.ceoName,
        ceoEmail: arosCompanies.ceoEmail,
        sss: arosCompanies.sss,
        esi: arosCompanies.esi,
        keyDecisionDomain: arosCompanies.keyDecisionDomain,
        activeStrategicInitiative: arosCompanies.activeStrategicInitiative,
        qualityGatePassed: arosCompanies.qualityGatePassed,
        sssCalculatedAt: arosCompanies.sssCalculatedAt,
      })
      .from(arosCompanies)
      .orderBy(desc(arosCompanies.sss))
      .limit(25);

    if (companies.length === 0) return [];

    // For each company, fetch the latest brief draft
    const companyIds = companies.map((c) => c.id);
    const latestDrafts = await db
      .select()
      .from(atlasBriefDrafts)
      .where(
        sql`${atlasBriefDrafts.companyId} IN (${sql.join(companyIds.map((id) => sql`${id}`), sql`, `)})`
      )
      .orderBy(desc(atlasBriefDrafts.version));

    // Build a map: companyId → latest draft
    const draftMap = new Map<number, typeof latestDrafts[0]>();
    for (const draft of latestDrafts) {
      if (draft.companyId && !draftMap.has(draft.companyId)) {
        draftMap.set(draft.companyId, draft);
      }
    }

    return companies.map((c, idx) => {
      const draft = draftMap.get(c.id);
      const tripleGatePasses = (c.sss ?? 0) >= 90 && (c.esi ?? 0) >= 85;
      return {
        rank: idx + 1,
        companyId: c.id,
        companyName: c.companyName,
        sector: c.sector,
        country: c.country,
        executiveName: c.ceoName ?? "CEO",
        executiveEmail: c.ceoEmail ?? "",
        sss: c.sss ?? 0,
        esi: c.esi ?? 0,
        keyDecisionDomain: c.keyDecisionDomain,
        qualityGatePassed: c.qualityGatePassed === 1,
        tripleGateSss: (c.sss ?? 0) >= 90,
        tripleGateEsi: (c.esi ?? 0) >= 85,
        tripleGateConf: draft ? (draft.evidenceConfidence ?? 0) >= 80 : false,
        tripleGatePasses,
        // Draft info
        draftId: draft?.id ?? null,
        editorStatus: draft?.editorStatus ?? "NO_DRAFT",
        draftVersion: draft?.version ?? 0,
        strategicDecision: draft?.strategicDecision ?? c.keyDecisionDomain ?? "",
        hiddenVariable: draft?.hiddenVariable ?? "",
        evidenceConfidence: draft?.evidenceConfidence ?? 0,
        briefContent: draft?.briefContent ?? null,
        approvedAt: draft?.approvedAt ?? null,
        promotedAt: draft?.promotedAt ?? null,
        updatedAt: draft?.updatedAt ?? null,
      };
    });
  }),

  /**
   * getBrief — Returns the full brief content + all version history for a company.
   */
  getBrief: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      // Get company details
      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);

      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      // Get all versions ordered newest first
      const versions = await db
        .select()
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.companyId, input.companyId))
        .orderBy(desc(atlasBriefDrafts.version));

      return {
        company: {
          id: company.id,
          companyName: company.companyName,
          sector: company.sector,
          country: company.country,
          ceoName: company.ceoName,
          ceoEmail: company.ceoEmail,
          sss: company.sss ?? 0,
          esi: company.esi ?? 0,
          keyDecisionDomain: company.keyDecisionDomain,
          activeStrategicInitiative: company.activeStrategicInitiative,
          qualityGatePassed: company.qualityGatePassed === 1,
          tripleGateSss: (company.sss ?? 0) >= 90,
          tripleGateEsi: (company.esi ?? 0) >= 85,
        },
        versions,
        latestDraft: versions[0] ?? null,
      };
    }),

  /**
   * generateDraft — Invokes LLM to generate a new brief version.
   * No Triple Gate check — the CEO can generate a draft for ANY company in the top 25.
   */
  generateDraft: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);

      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      // Find the current highest version for this company
      const [latestVersion] = await db
        .select({ version: atlasBriefDrafts.version, id: atlasBriefDrafts.id })
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.companyId, input.companyId))
        .orderBy(desc(atlasBriefDrafts.version))
        .limit(1);

      const nextVersion = (latestVersion?.version ?? 0) + 1;
      const parentVersionId = latestVersion?.id ?? null;

      // Generate brief via LLM
      const generated = await generateBriefContent({
        companyName: company.companyName,
        sector: company.sector,
        country: company.country,
        ceoName: company.ceoName ?? null,
        keyDecisionDomain: company.keyDecisionDomain ?? null,
        activeStrategicInitiative: company.activeStrategicInitiative ?? null,
        aiTransformationSignal: company.aiTransformationSignal ?? null,
        decisionTwin: company.decisionTwin ?? null,
        executiveDossier: company.executiveDossier ?? null,
        sss: company.sss ?? 0,
        esi: company.esi ?? 0,
      });

      const now = Date.now();
      const traceabilityToken = randomUUID();

      // Combine subject + body as the full brief content
      const briefContent = `SUBJECT: ${generated.noteSubject}\n\n${generated.noteBody}\n\n---\n\nEXECUTIVE BRIEF:\n\n${generated.executiveBrief}`;

      await db.insert(atlasBriefDrafts).values({
        companyId: input.companyId,
        companyName: company.companyName,
        executiveName: company.ceoName ?? "CEO",
        executiveTitle: "Chief Executive Officer",
        executiveEmail: company.ceoEmail ?? "",
        strategicDecision: generated.strategicDecision,
        hiddenVariable: generated.hiddenVariable,
        sss: company.sss ?? 0,
        esi: company.esi ?? 0,
        evidenceConfidence: generated.evidenceConfidence,
        tripleGateSss: (company.sss ?? 0) >= 90 ? 1 : 0,
        tripleGateEsi: (company.esi ?? 0) >= 85 ? 1 : 0,
        tripleGateConf: generated.evidenceConfidence >= 80 ? 1 : 0,
        briefContent,
        editorStatus: "DRAFT",
        version: nextVersion,
        parentVersionId,
        createdAt: now,
        updatedAt: now,
        traceabilityToken,
        constitutionVersion: "1.0",
        generatedBy: "atlas_editor",
      });

      // Fetch the newly created draft
      const [newDraft] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(
          and(
            eq(atlasBriefDrafts.companyId, input.companyId),
            eq(atlasBriefDrafts.version, nextVersion)
          )
        )
        .limit(1);

      return { success: true, draft: newDraft };
    }),

  /**
   * saveEdit — CEO edits the brief content. Creates a new version record.
   * Status becomes READY if explicitly set, otherwise stays DRAFT.
   */
  saveEdit: protectedProcedure
    .input(z.object({
      draftId: z.number(),
      briefContent: z.string().min(1),
      editorStatus: z.enum(["DRAFT", "READY"]).optional().default("DRAFT"),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [existing] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.id, input.draftId))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      if (!existing.companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "Draft has no company" });

      const nextVersion = existing.version + 1;
      const now = Date.now();

      await db.insert(atlasBriefDrafts).values({
        companyId: existing.companyId,
        companyName: existing.companyName,
        executiveName: existing.executiveName,
        executiveTitle: existing.executiveTitle,
        executiveEmail: existing.executiveEmail,
        strategicDecision: existing.strategicDecision,
        hiddenVariable: existing.hiddenVariable,
        sss: existing.sss,
        esi: existing.esi,
        evidenceConfidence: existing.evidenceConfidence,
        tripleGateSss: existing.tripleGateSss,
        tripleGateEsi: existing.tripleGateEsi,
        tripleGateConf: existing.tripleGateConf,
        briefContent: input.briefContent,
        editorStatus: input.editorStatus,
        version: nextVersion,
        parentVersionId: existing.id,
        createdAt: now,
        updatedAt: now,
        traceabilityToken: existing.traceabilityToken,
        constitutionVersion: existing.constitutionVersion,
        generatedBy: "atlas_editor_ceo",
      });

      const [saved] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(
          and(
            eq(atlasBriefDrafts.companyId, existing.companyId),
            eq(atlasBriefDrafts.version, nextVersion)
          )
        )
        .limit(1);

      return { success: true, draft: saved };
    }),

  /**
   * approve — CEO approves the brief. Status becomes APPROVED.
   * If Triple Gate already passes, auto-promotes to SCHEDULED immediately.
   */
  approve: protectedProcedure
    .input(z.object({ draftId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [draft] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(eq(atlasBriefDrafts.id, input.draftId))
        .limit(1);

      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

      const now = Date.now();
      const tripleGatePasses =
        (draft.tripleGateSss ?? 0) === 1 &&
        (draft.tripleGateEsi ?? 0) === 1 &&
        (draft.tripleGateConf ?? 0) === 1;

      const newStatus = tripleGatePasses ? "SCHEDULED" : "APPROVED";

      await db
        .update(atlasBriefDrafts)
        .set({
          editorStatus: newStatus,
          approvedAt: now,
          updatedAt: now,
          promotedAt: tripleGatePasses ? now : undefined,
        })
        .where(eq(atlasBriefDrafts.id, input.draftId));

      // If Triple Gate passes, promote to dispatch queue
      let outreachQueueId: number | null = null;
      if (tripleGatePasses && draft.companyId) {
        const [company] = await db
          .select()
          .from(arosCompanies)
          .where(eq(arosCompanies.id, draft.companyId))
          .limit(1);

        if (company) {
          const trackingToken = randomUUID();
          const [inserted] = await db
            .insert(arosOutreachQueue)
            .values({
              companyId: draft.companyId,
              emailSubject: draft.briefContent?.split("\n")[0]?.replace("SUBJECT: ", "") ?? `Intelligence Brief — ${company.companyName}`,
              emailBody: draft.briefContent ?? "",
              executiveBrief: draft.briefContent ?? "",
              targetName: draft.executiveName ?? company.ceoName ?? "CEO",
              targetEmail: draft.executiveEmail ?? company.ceoEmail ?? "",
              targetTitle: draft.executiveTitle ?? "Chief Executive Officer",
              estimatedDealSizeUsd: 50000,
              priority: "IMMEDIATE",
              approvalStatus: "APPROVED",
              approvedAt: now,
              trackingToken,
              sss: draft.sss ?? 0,
              esi: draft.esi ?? 0,
              qualityGatePassed: 1,
              atlasQueue: "IMMEDIATE",
              constitutionVersion: draft.constitutionVersion ?? "1.0",
              generationTimestamp: now,
              createdAt: now,
              updatedAt: now,
            });

          // Update draft with outreach queue link
          await db
            .update(atlasBriefDrafts)
            .set({ outreachQueueId: (inserted as { insertId?: number })?.insertId ?? null })
            .where(eq(atlasBriefDrafts.id, input.draftId));
        }
      }

      return {
        success: true,
        newStatus,
        autoPromoted: tripleGatePasses,
        outreachQueueId,
      };
    }),

  /**
   * compareVersions — Returns two versions side-by-side for diff display.
   */
  compareVersions: protectedProcedure
    .input(z.object({
      versionIdA: z.number(),
      versionIdB: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [versionA, versionB] = await Promise.all([
        db.select().from(atlasBriefDrafts).where(eq(atlasBriefDrafts.id, input.versionIdA)).limit(1),
        db.select().from(atlasBriefDrafts).where(eq(atlasBriefDrafts.id, input.versionIdB)).limit(1),
      ]);

      if (!versionA[0] || !versionB[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or both versions not found" });
      }

      return {
        versionA: versionA[0],
        versionB: versionB[0],
      };
    }),

  /**
   * autoPromote — Called by continuousReadiness when Triple Gate passes.
   * Finds the latest APPROVED draft for the company and promotes it to SCHEDULED.
   * Returns false if no APPROVED draft exists (caller should generate a new brief normally).
   */
  autoPromote: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      sss: z.number(),
      esi: z.number(),
      evidenceConfidence: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      // Find latest APPROVED draft for this company
      const [approvedDraft] = await db
        .select()
        .from(atlasBriefDrafts)
        .where(
          and(
            eq(atlasBriefDrafts.companyId, input.companyId),
            eq(atlasBriefDrafts.editorStatus, "APPROVED")
          )
        )
        .orderBy(desc(atlasBriefDrafts.version))
        .limit(1);

      if (!approvedDraft) {
        return { promoted: false, reason: "No APPROVED draft found for this company" };
      }

      const now = Date.now();

      // Get company for queue insertion
      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);

      if (!company) return { promoted: false, reason: "Company not found" };

      // Insert into dispatch queue
      const trackingToken = randomUUID();
      await db.insert(arosOutreachQueue).values({
        companyId: input.companyId,
        emailSubject: approvedDraft.briefContent?.split("\n")[0]?.replace("SUBJECT: ", "") ?? `Intelligence Brief — ${company.companyName}`,
        emailBody: approvedDraft.briefContent ?? "",
        executiveBrief: approvedDraft.briefContent ?? "",
        targetName: approvedDraft.executiveName ?? company.ceoName ?? "CEO",
        targetEmail: approvedDraft.executiveEmail ?? company.ceoEmail ?? "",
        targetTitle: approvedDraft.executiveTitle ?? "Chief Executive Officer",
        estimatedDealSizeUsd: 50000,
        priority: "IMMEDIATE",
        approvalStatus: "APPROVED",
        approvedAt: now,
        trackingToken,
        sss: input.sss,
        esi: input.esi,
        qualityGatePassed: 1,
        atlasQueue: "IMMEDIATE",
        constitutionVersion: approvedDraft.constitutionVersion ?? "1.0",
        generationTimestamp: now,
        createdAt: now,
        updatedAt: now,
      });

      // Update draft status to SCHEDULED
      await db
        .update(atlasBriefDrafts)
        .set({
          editorStatus: "SCHEDULED",
          promotedAt: now,
          updatedAt: now,
          tripleGateSss: input.sss >= 90 ? 1 : 0,
          tripleGateEsi: input.esi >= 85 ? 1 : 0,
          tripleGateConf: input.evidenceConfidence >= 80 ? 1 : 0,
        })
        .where(eq(atlasBriefDrafts.id, approvedDraft.id));

      return {
        promoted: true,
        draftId: approvedDraft.id,
        companyName: company.companyName,
        message: `Approved draft for ${company.companyName} auto-promoted to SCHEDULED queue`,
      };
    }),
});
