/**
 * aros/executiveIntelligenceFactory.ts — Executive Intelligence Factory
 *
 * Atlas does not send outreach. Atlas delivers unsolicited strategic intelligence.
 *
 * Every communication is built from four Atlas objects:
 *  1. Decision Twin
 *  2. Hidden Variable
 *  3. Strategic Decision
 *  4. Recommended Executive Conversation
 *
 * Deliverables per company:
 *  - Executive Decision Note (CEO communication — 4-paragraph structure)
 *  - Executive Brief (1-page strategic intelligence summary)
 *  - LinkedIn Intelligence Message
 *  - One-page Decision Twin Summary
 *
 * Quality tests applied before every note is queued:
 *  - Specificity: remove company name → cannot be sent to another company
 *  - Curiosity: first paragraph must provoke "how did they know we were working on that?"
 *  - Tone: sounds like an independent strategic intelligence partner, never a technology vendor
 */

import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosOutreachQueue,
  arosOpportunitySignals,
  arosTokenLedger,
  arosAuditLog,
  arosPipeline,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function requireAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ── LLM: Generate Executive Intelligence Package ──────────────────────────────
async function generateIntelligencePackage(company: {
  companyName: string;
  sector: string;
  country: string;
  ceoName: string | null;
  keyDecisionDomain: string | null;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  opportunityType: string | null;
  executiveDossier: string | null;
  decisionTwin: string | null;
  opportunityScore: number;
}, topSignal?: { signalTitle: string; signalEvidence: string; acvEstimateUsd: number }): Promise<{
  noteSubject: string;
  noteBody: string;
  executiveBrief: string;
  linkedinMessage: string;
  estimatedDealSizeUsd: number;
  priority: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Atlas Executive Intelligence Factory. You do not send outreach. You deliver unsolicited strategic intelligence to senior executives.

IDENTITY: Atlas is an Executive Decision Intelligence Network — not an AI company, not a technology vendor, not a platform.

COMMERCIAL PRINCIPLE — Never mention:
- AI, agents, LLMs, governance, platform, technology, architecture, simulations
- AgenThink Mesh, Council of AI agents, machine-verifiable audit trail
- Estimated engagement values or ROI percentages without customer evidence

Executives buy: better decisions, reduced strategic mistakes, faster execution, hidden insights, competitive advantage.

FOUR-PARAGRAPH STRUCTURE for the Executive Decision Note:
1. Decision Recognition — Open with the strategic decision Atlas believes the company is currently facing. Never state obvious public facts. Never summarize their annual report. Never flatter. Demonstrate understanding.
2. Hidden Variable — Introduce ONE hidden variable (not five). Create curiosity. Do NOT reveal the complete analysis.
3. Decision Twin — Explain that Atlas built a Decision Twin. Do NOT explain the technology. Explain the outcome. Do not mention AI agents or Council of 10.
4. Invitation — "No preparation is required. If you believe this decision deserves a second perspective, I would be pleased to walk you through the Decision Twin." No sales language. No pressure.

QUALITY TESTS (apply before generating):
- Remove the company name: if the note could be sent to another company, reject and rewrite.
- First paragraph must provoke: "How did they know we were working on that?"
- Tone must sound like an independent strategic intelligence partner, never a technology company.

Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Generate a complete Executive Intelligence Package for:

Company: ${company.companyName}
Sector: ${company.sector}
Country: ${company.country}
Executive: ${company.ceoName ?? "CEO"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Strategic Decision-Making"}
Active Strategic Initiative: ${company.activeStrategicInitiative ?? "Organizational transformation"}
Strategic Signal: ${company.aiTransformationSignal ?? "Significant strategic investment underway"}
Opportunity Type: ${company.opportunityType ?? "Executive Decision Intelligence"}
Intelligence Score: ${company.opportunityScore}/100
${topSignal ? `Top Signal: ${topSignal.signalTitle} — ${topSignal.signalEvidence}` : ""}
${company.executiveDossier ? `Dossier Intelligence: ${company.executiveDossier.substring(0, 400)}...` : ""}
${company.decisionTwin ? `Decision Twin Summary: ${company.decisionTwin.substring(0, 300)}...` : ""}

Return this exact JSON:
{
  "noteSubject": "string (intelligence note subject line — max 60 chars — specific to their strategic decision, never generic, never mentions AI)",
  "noteBody": "string (4-paragraph Executive Decision Note following the exact structure: Decision Recognition, Hidden Variable, Decision Twin, Invitation — 180-220 words total — impossible to reuse for another company)",
  "executiveBrief": "string (400-500 word one-page strategic intelligence brief: Strategic Context, Decision Analysis, Hidden Variable, Decision Twin Findings, Recommended Conversation — formatted with clear section headers)",
  "linkedinMessage": "string (60-80 word LinkedIn intelligence message — references their specific strategic decision — no sales language — ends with a specific question about their decision)",
  "estimatedDealSizeUsd": number (realistic engagement value in USD based on company size and sector),
  "priority": "IMMEDIATE | HIGH | MEDIUM | LOW"
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "intelligence_package",
        strict: true,
        schema: {
          type: "object",
          properties: {
            noteSubject: { type: "string" },
            noteBody: { type: "string" },
            executiveBrief: { type: "string" },
            linkedinMessage: { type: "string" },
            estimatedDealSizeUsd: { type: "integer" },
            priority: { type: "string" },
          },
          required: ["noteSubject", "noteBody", "executiveBrief", "linkedinMessage", "estimatedDealSizeUsd", "priority"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "{}";
  const parsed = JSON.parse(content);

  const validPriorities = ["IMMEDIATE", "HIGH", "MEDIUM", "LOW"] as const;
  const priority = validPriorities.includes(parsed.priority) ? parsed.priority : "HIGH";

  return {
    noteSubject: parsed.noteSubject ?? "",
    noteBody: parsed.noteBody ?? "",
    executiveBrief: parsed.executiveBrief ?? "",
    linkedinMessage: parsed.linkedinMessage ?? "",
    estimatedDealSizeUsd: parsed.estimatedDealSizeUsd ?? 25000,
    priority,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const arosExecutiveIntelligenceFactoryRouter = router({

  // ── Generate intelligence package for a company ───────────────────────────
  generate: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      targetEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });

      // Get top signal for personalization
      const [topSignal] = await db
        .select()
        .from(arosOpportunitySignals)
        .where(and(
          eq(arosOpportunitySignals.companyId, input.companyId),
          eq(arosOpportunitySignals.isActive, true)
        ))
        .orderBy(desc(arosOpportunitySignals.urgencyScore))
        .limit(1);

      const pkg = await generateIntelligencePackage(company, topSignal ?? undefined);

      // Log tokens
      const inputTok = 900;
      const outputTok = 600;
      const cost = (inputTok * 0.00000015) + (outputTok * 0.0000006);
      await db.insert(arosTokenLedger).values({
        companyId: input.companyId,
        workflow: "outreach_generation",
        model: "gpt-4o-mini",
        inputTokens: inputTok,
        outputTokens: outputTok,
        totalTokens: inputTok + outputTok,
        costUsd: cost.toFixed(8),
        triggeredBy: ctx.user.id,
      });

      const trackingToken = randomUUID();

      // Store in arosOutreachQueue — noteSubject → emailSubject, noteBody → emailBody, linkedinMessage → sdrTeaser
      const [inserted] = await db.insert(arosOutreachQueue).values({
        companyId: input.companyId,
        emailSubject: pkg.noteSubject,
        emailBody: pkg.noteBody,
        executiveBrief: pkg.executiveBrief,
        sdrTeaser: pkg.linkedinMessage,
        targetName: company.ceoName ?? null,
        targetEmail: input.targetEmail ?? company.ceoEmail ?? null,
        targetTitle: "CEO",
        estimatedDealSizeUsd: pkg.estimatedDealSizeUsd,
        priority: pkg.priority,
        approvalStatus: "PENDING_CEO_REVIEW",
        trackingToken,
        tokensUsed: inputTok + outputTok,
        costUsd: cost.toFixed(6),
      }).$returningId();

      // Create pipeline entry if not exists
      const [existingPipeline] = await db
        .select({ id: arosPipeline.id })
        .from(arosPipeline)
        .where(eq(arosPipeline.companyId, input.companyId))
        .limit(1);

      if (!existingPipeline) {
        await db.insert(arosPipeline).values({
          companyId: input.companyId,
          outreachId: inserted?.id ?? null,
          stage: "RESEARCHED",
          dealValueUsd: pkg.estimatedDealSizeUsd,
          researchedAt: Date.now(),
        });
      }

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.generated",
        entityType: "aros_outreach_queue",
        entityId: String(inserted?.id),
        payload: JSON.stringify({ companyId: input.companyId, priority: pkg.priority }),
      });

      return { id: inserted?.id, trackingToken, priority: pkg.priority, estimatedDealSizeUsd: pkg.estimatedDealSizeUsd };
    }),

  // ── Batch generate intelligence packages (up to 50 companies) ────────────
  batchGenerate: protectedProcedure
    .input(z.object({
      companyIds: z.array(z.number()).min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const results: Array<{ companyId: number; status: "ok" | "error"; noteId?: number; error?: string }> = [];

      for (const companyId of input.companyIds) {
        try {
          const [company] = await db
            .select()
            .from(arosCompanies)
            .where(eq(arosCompanies.id, companyId))
            .limit(1);
          if (!company) { results.push({ companyId, status: "error", error: "Not found" }); continue; }

          const [topSignal] = await db
            .select()
            .from(arosOpportunitySignals)
            .where(and(eq(arosOpportunitySignals.companyId, companyId), eq(arosOpportunitySignals.isActive, true)))
            .orderBy(desc(arosOpportunitySignals.urgencyScore))
            .limit(1);

          const pkg = await generateIntelligencePackage(company, topSignal ?? undefined);

          const inputTok = 900;
          const outputTok = 600;
          const cost = (inputTok * 0.00000015) + (outputTok * 0.0000006);
          await db.insert(arosTokenLedger).values({
            companyId,
            workflow: "outreach_generation",
            model: "gpt-4o-mini",
            inputTokens: inputTok,
            outputTokens: outputTok,
            totalTokens: inputTok + outputTok,
            costUsd: cost.toFixed(8),
            triggeredBy: ctx.user.id,
          });

          const [inserted] = await db.insert(arosOutreachQueue).values({
            companyId,
            emailSubject: pkg.noteSubject,
            emailBody: pkg.noteBody,
            executiveBrief: pkg.executiveBrief,
            sdrTeaser: pkg.linkedinMessage,
            targetName: company.ceoName ?? null,
            targetEmail: company.ceoEmail ?? null,
            targetTitle: "CEO",
            estimatedDealSizeUsd: pkg.estimatedDealSizeUsd,
            priority: pkg.priority,
            approvalStatus: "PENDING_CEO_REVIEW",
            trackingToken: randomUUID(),
            tokensUsed: inputTok + outputTok,
            costUsd: cost.toFixed(6),
          }).$returningId();

          results.push({ companyId, status: "ok", noteId: inserted?.id });
        } catch (err: unknown) {
          results.push({ companyId, status: "error", error: String(err) });
        }
      }

      return { results, generated: results.filter(r => r.status === "ok").length };
    }),

  // ── List intelligence queue ───────────────────────────────────────────────
  listQueue: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING_CEO_REVIEW", "APPROVED", "REJECTED", "SENT", "BOUNCED"]).optional(),
      priority: z.enum(["IMMEDIATE", "HIGH", "MEDIUM", "LOW"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const conditions = [];
      if (input.status) conditions.push(eq(arosOutreachQueue.approvalStatus, input.status));
      if (input.priority) conditions.push(eq(arosOutreachQueue.priority, input.priority));

      const rows = await db
        .select({
          outreach: arosOutreachQueue,
          company: {
            id: arosCompanies.id,
            companyName: arosCompanies.companyName,
            sector: arosCompanies.sector,
            country: arosCompanies.country,
          },
        })
        .from(arosOutreachQueue)
        .innerJoin(arosCompanies, eq(arosOutreachQueue.companyId, arosCompanies.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(arosOutreachQueue.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(arosOutreachQueue)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { rows, total: Number(countRow.count) };
    }),

  // ── Approve intelligence note ─────────────────────────────────────────────
  approve: protectedProcedure
    .input(z.object({ outreachId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [item] = await db
        .select()
        .from(arosOutreachQueue)
        .where(eq(arosOutreachQueue.id, input.outreachId))
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(arosOutreachQueue)
        .set({
          approvalStatus: "APPROVED",
          approvedBy: ctx.user.id,
          approvedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(eq(arosOutreachQueue.id, input.outreachId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.approved",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
      });

      return { success: true };
    }),

  // ── Reject intelligence note ──────────────────────────────────────────────
  reject: protectedProcedure
    .input(z.object({
      outreachId: z.number(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      await db.update(arosOutreachQueue)
        .set({
          approvalStatus: "REJECTED",
          rejectionReason: input.reason,
          updatedAt: Date.now(),
        })
        .where(eq(arosOutreachQueue.id, input.outreachId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.rejected",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
        payload: JSON.stringify({ reason: input.reason }),
      });

      return { success: true };
    }),

  // ── Mark as delivered ─────────────────────────────────────────────────────
  markSent: protectedProcedure
    .input(z.object({ outreachId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [item] = await db
        .select()
        .from(arosOutreachQueue)
        .where(eq(arosOutreachQueue.id, input.outreachId))
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(arosOutreachQueue)
        .set({ approvalStatus: "SENT", sentAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosOutreachQueue.id, input.outreachId));

      // Advance pipeline stage
      await db.update(arosPipeline)
        .set({ stage: "OUTREACH_SENT", outreachSentAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosPipeline.companyId, item.companyId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.delivered",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
      });

      return { success: true };
    }),

  // ── Record note opened ────────────────────────────────────────────────────
  recordOpen: protectedProcedure
    .input(z.object({ trackingToken: z.string() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.update(arosOutreachQueue)
        .set({ openedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosOutreachQueue.trackingToken, input.trackingToken));
      return { success: true };
    }),

  // ── Record executive reply ────────────────────────────────────────────────
  recordReply: protectedProcedure
    .input(z.object({ outreachId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [item] = await db
        .select()
        .from(arosOutreachQueue)
        .where(eq(arosOutreachQueue.id, input.outreachId))
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(arosOutreachQueue)
        .set({ repliedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosOutreachQueue.id, input.outreachId));

      // Advance pipeline
      await db.update(arosPipeline)
        .set({ stage: "RESPONSE_RECEIVED", responseReceivedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosPipeline.companyId, item.companyId));

      return { success: true };
    }),

  // ── Deliver intelligence note via Microsoft Graph ─────────────────────────
  sendEmail: protectedProcedure
    .input(z.object({
      outreachId: z.number(),
      toEmail: z.string().email(),
      toName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [item] = await db
        .select()
        .from(arosOutreachQueue)
        .where(eq(arosOutreachQueue.id, input.outreachId))
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Intelligence note not found" });
      if (item.approvalStatus !== "APPROVED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Intelligence note must be APPROVED before delivery" });
      }
      if (item.sentAt) {
        throw new TRPCError({ code: "CONFLICT", message: "Intelligence note already delivered" });
      }

      // ── Microsoft Graph: acquire token ──────────────────────────────────────
      const clientId = process.env.MS_CLIENT_ID;
      const clientSecret = process.env.MS_CLIENT_SECRET;
      const tenantId = process.env.MS_TENANT_ID;
      if (!clientId || !clientSecret || !tenantId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "MS Graph credentials (MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID) not configured" });
      }

      const tokenParams = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      });
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenParams.toString() }
      );
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `MS Graph token error: ${err}` });
      }
      const { access_token } = await tokenRes.json() as { access_token: string };

      // ── Build tracking pixel URL ──────────────────────────────────────────────
      const appBase = process.env.VITE_FRONTEND_FORGE_API_URL ?? "https://agenthink-7enctkan.manus.space";
      const trackingPixelUrl = `${appBase}/api/trpc/arosExecutiveIntelligenceFactory.trackOpen?token=${item.trackingToken}`;

      // ── Format HTML body ──────────────────────────────────────────────────────
      const htmlBody = `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.7; color: #1a1a1a; max-width: 600px;">
${(item.emailBody ?? "").split("\n").map((line: string) => line.trim() ? `<p style="margin: 0 0 1em 0;">${line}</p>` : "").join("\n")}
<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />
</div>`;

      // ── Send via Microsoft Graph sendMail ─────────────────────────────────────
      const SENDER_UPN = "farouq@agenthink.ai";
      const graphRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${SENDER_UPN}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              subject: item.emailSubject ?? "AgenThink — Strategic Decision Intelligence",
              body: { contentType: "HTML", content: htmlBody },
              toRecipients: [{ emailAddress: { address: input.toEmail, name: input.toName ?? "" } }],
              ccRecipients: [{ emailAddress: { address: "farouqsultan@gmail.com", name: "Farouq Sultan" } }],
              replyTo: [{ emailAddress: { address: SENDER_UPN } }],
            },
            saveToSentItems: true,
          }),
        }
      );

      if (!graphRes.ok) {
        const errBody = await graphRes.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `MS Graph sendMail error ${graphRes.status}: ${errBody}`,
        });
      }

      const graphMessageId = `graph-${Date.now()}-${item.id}`;
      const resendData = { id: graphMessageId };

      // Mark as delivered and advance pipeline
      await db.update(arosOutreachQueue)
        .set({
          approvalStatus: "SENT",
          sentAt: Date.now(),
          targetEmail: input.toEmail,
          targetName: input.toName ?? item.targetName,
          updatedAt: Date.now(),
        })
        .where(eq(arosOutreachQueue.id, input.outreachId));

      await db.update(arosPipeline)
        .set({ stage: "OUTREACH_SENT", outreachSentAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosPipeline.companyId, item.companyId));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "intelligence.delivered",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
        payload: JSON.stringify({ messageId: resendData.id, toEmail: input.toEmail }),
      });

      return { success: true, resendId: resendData.id, sentAt: Date.now() };
    }),

  // ── Public tracking pixel endpoint (open tracking) ────────────────────────
  trackOpen: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      await db.update(arosOutreachQueue)
        .set({ openedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosOutreachQueue.trackingToken, input.token));
      return { tracked: true };
    }),

  // ── Get queue stats ────────────────────────────────────────────────────────
  getQueueStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const stats = await db
        .select({
          status: arosOutreachQueue.approvalStatus,
          count: sql<number>`count(*)`,
          totalAcv: sql<number>`sum(estimated_deal_size_usd)`,
        })
        .from(arosOutreachQueue)
        .groupBy(arosOutreachQueue.approvalStatus);

      return stats.map(s => ({
        status: s.status,
        count: Number(s.count),
        totalAcv: Number(s.totalAcv ?? 0),
      }));
    }),
});
