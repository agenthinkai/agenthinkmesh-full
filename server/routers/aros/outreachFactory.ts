/**
 * aros/outreachFactory.ts — Outreach Factory
 *
 * Generates and manages outreach assets:
 *  - Personalized CEO email
 *  - Executive brief (1-page)
 *  - SDR teaser
 *  - Approval queue management (approve / reject / send)
 *  - Tracking token generation
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

// ── LLM: Generate outreach package ───────────────────────────────────────────
async function generateOutreachPackage(company: {
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
  emailSubject: string;
  emailBody: string;
  executiveBrief: string;
  sdrTeaser: string;
  estimatedDealSizeUsd: number;
  priority: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are AROS Outreach Factory. Generate highly personalized, executive-grade outreach for enterprise sales. Write like a seasoned enterprise sales professional — not a marketer. Be specific, brief, and value-focused. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Generate a complete outreach package for:

Company: ${company.companyName}
Sector: ${company.sector}
Country: ${company.country}
CEO: ${company.ceoName ?? "CEO"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Strategic Decision-Making"}
Strategic Initiative: ${company.activeStrategicInitiative ?? "Digital transformation"}
AI Signal: ${company.aiTransformationSignal ?? "AI investment underway"}
Opportunity Type: ${company.opportunityType ?? "AI Decision Intelligence"}
Opportunity Score: ${company.opportunityScore}/100
${topSignal ? `Top Signal: ${topSignal.signalTitle} — ${topSignal.signalEvidence}` : ""}
${company.executiveDossier ? `Dossier Summary: ${company.executiveDossier.substring(0, 300)}...` : ""}

Return this exact JSON:
{
  "emailSubject": "string (compelling subject line, max 60 chars, specific to their initiative)",
  "emailBody": "string (150-200 word personalized CEO email: reference their specific initiative, explain AgenThinkMesh value in 1 sentence, propose a 20-min call, include specific ROI claim)",
  "executiveBrief": "string (400-500 word executive brief: Problem, Solution, Evidence, ROI, Next Step — formatted with clear sections)",
  "sdrTeaser": "string (50-80 word SDR teaser for LinkedIn or cold call opener — punchy, specific, not generic)",
  "estimatedDealSizeUsd": number (realistic pilot deal size in USD),
  "priority": "IMMEDIATE | HIGH | MEDIUM | LOW"
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "outreach_package",
        strict: true,
        schema: {
          type: "object",
          properties: {
            emailSubject: { type: "string" },
            emailBody: { type: "string" },
            executiveBrief: { type: "string" },
            sdrTeaser: { type: "string" },
            estimatedDealSizeUsd: { type: "integer" },
            priority: { type: "string" },
          },
          required: ["emailSubject", "emailBody", "executiveBrief", "sdrTeaser", "estimatedDealSizeUsd", "priority"],
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
    emailSubject: parsed.emailSubject ?? "",
    emailBody: parsed.emailBody ?? "",
    executiveBrief: parsed.executiveBrief ?? "",
    sdrTeaser: parsed.sdrTeaser ?? "",
    estimatedDealSizeUsd: parsed.estimatedDealSizeUsd ?? 25000,
    priority,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────
export const arosOutreachFactoryRouter = router({

  // ── Generate outreach for a company ───────────────────────────────────────
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

      const pkg = await generateOutreachPackage(company, topSignal ?? undefined);

      // Log tokens
      const inputTok = 700;
      const outputTok = 500;
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

      const [inserted] = await db.insert(arosOutreachQueue).values({
        companyId: input.companyId,
        emailSubject: pkg.emailSubject,
        emailBody: pkg.emailBody,
        executiveBrief: pkg.executiveBrief,
        sdrTeaser: pkg.sdrTeaser,
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
        action: "outreach.generated",
        entityType: "aros_outreach_queue",
        entityId: String(inserted?.id),
        payload: JSON.stringify({ companyId: input.companyId, priority: pkg.priority }),
      });

      return { id: inserted?.id, trackingToken, priority: pkg.priority, estimatedDealSizeUsd: pkg.estimatedDealSizeUsd };
    }),

  // ── Batch generate outreach (up to 50 companies) ──────────────────────────
  batchGenerate: protectedProcedure
    .input(z.object({
      companyIds: z.array(z.number()).min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const results: Array<{ companyId: number; status: "ok" | "error"; outreachId?: number; error?: string }> = [];

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

          const pkg = await generateOutreachPackage(company, topSignal ?? undefined);

          const inputTok = 700;
          const outputTok = 500;
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
            emailSubject: pkg.emailSubject,
            emailBody: pkg.emailBody,
            executiveBrief: pkg.executiveBrief,
            sdrTeaser: pkg.sdrTeaser,
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

          results.push({ companyId, status: "ok", outreachId: inserted?.id });
        } catch (err: unknown) {
          results.push({ companyId, status: "error", error: String(err) });
        }
      }

      return { results, generated: results.filter(r => r.status === "ok").length };
    }),

  // ── List approval queue ────────────────────────────────────────────────────
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

  // ── Approve outreach ───────────────────────────────────────────────────────
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
        action: "outreach.approved",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
      });

      return { success: true };
    }),

  // ── Reject outreach ────────────────────────────────────────────────────────
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
        action: "outreach.rejected",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
        payload: JSON.stringify({ reason: input.reason }),
      });

      return { success: true };
    }),

  // ── Mark as sent ───────────────────────────────────────────────────────────
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
        action: "outreach.sent",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
      });

      return { success: true };
    }),

  // ── Record email open ──────────────────────────────────────────────────────
  recordOpen: protectedProcedure
    .input(z.object({ trackingToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(arosOutreachQueue)
        .set({ openedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(arosOutreachQueue.trackingToken, input.trackingToken));
      return { success: true };
    }),

  // ── Record reply ───────────────────────────────────────────────────────────
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

  // ── Send email via Resend ──────────────────────────────────────────────────
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
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Outreach item not found" });
      if (item.approvalStatus !== "APPROVED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Outreach must be APPROVED before sending" });
      }
      if (item.sentAt) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already sent" });
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RESEND_API_KEY not configured" });

      // Build tracking pixel URL
      const trackingPixelUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL ?? "https://agenthink-7enctkan.manus.space"}/api/trpc/arosOutreach.trackOpen?token=${item.trackingToken}`;

      // Format email body as HTML with tracking pixel
      const htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
${(item.emailBody ?? "").split("\n").map((line: string) => line.trim() ? `<p>${line}</p>` : "<br/>").join("\n")}
<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />
</div>`;

      // Send via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Farouq Sultan <farouq@agenthink.ai>",
          to: [input.toEmail],
          cc: ["farouqsultan@gmail.com"],
          subject: item.emailSubject ?? "AgenThink — Decision Intelligence Partnership",
          html: htmlBody,
          text: item.emailBody ?? "",
          reply_to: "farouq@agenthink.ai",
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Resend API error ${resendRes.status}: ${errBody}`,
        });
      }

      const resendData = await resendRes.json() as { id?: string };

      // Mark as sent and advance pipeline
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
        action: "outreach.email_sent",
        entityType: "aros_outreach_queue",
        entityId: String(input.outreachId),
        payload: JSON.stringify({ resendId: resendData.id, toEmail: input.toEmail }),
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
