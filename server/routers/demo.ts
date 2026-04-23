import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { demoRequests } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { sendGraphEmail } from "../graphEmail";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const DEMO_STATUSES = ["new", "contacted", "scheduled", "closed"] as const;
type DemoStatus = typeof DEMO_STATUSES[number];

// ── Auto-reply email template ─────────────────────────────────────────────────
function buildAutoReplyHtml(name: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0a0f1e;color:#e2e8f0;font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="border-bottom:1px solid #1e3a5f;padding-bottom:20px;margin-bottom:28px;">
      <span style="color:#06b6d4;font-size:18px;font-weight:700;letter-spacing:0.05em;">Agen<span style="color:#10b981;">Think</span>Mesh</span>
    </div>
    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">Hi ${name},</p>
    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      Thank you for your demo request. We have received it and will be in touch within one business day.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      In the meantime, you can explore the platform at
      <a href="https://agenthink-7enctkan.manus.space" style="color:#10b981;">agenthink-7enctkan.manus.space</a>
      or review our IC memo examples at
      <a href="https://agenthink-7enctkan.manus.space/demos" style="color:#10b981;">/demos</a>.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      If you have any questions before we connect, reply directly to this email.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin-top:32px;">
      The AgenThinkMesh Team<br/>
      <a href="mailto:farouq@agenthink.ai" style="color:#10b981;">farouq@agenthink.ai</a>
    </p>
    <div style="border-top:1px solid #1e3a5f;margin-top:40px;padding-top:16px;">
      <p style="font-size:11px;color:#475569;">AgenThinkMesh · The Google of AI Agents · GCC Edition</p>
    </div>
  </div>
</body>
</html>`;
}

export const demoRouter = router({
  // ── Public: submit a demo request ─────────────────────────────────────────
  submit: publicProcedure
    .input(
      z.object({
        name:        z.string().min(1).max(200),
        institution: z.string().min(1).max(300),
        email:       z.string().email().max(300),
        useCase:     z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const now = Date.now();
      await db.insert(demoRequests).values({
        name:        input.name,
        institution: input.institution,
        email:       input.email,
        useCase:     input.useCase,
        status:      "new",
        createdAt:   now,
        updatedAt:   now,
      });

      // Owner notification — fire and forget
      notifyOwner({
        title: `New demo request from ${input.institution}`,
        content: `**Name:** ${input.name}\n**Institution:** ${input.institution}\n**Email:** ${input.email}\n\n**Use case:**\n${input.useCase}`,
      }).catch(() => {/* swallow */});

      // Auto-reply to requester — fire and forget, do not fail the mutation
      sendGraphEmail({
        to:      input.email,
        cc:      "farouqsultan@gmail.com",
        subject: "Your demo request — AgenThinkMesh",
        html:    buildAutoReplyHtml(input.name),
      }).catch(() => {/* swallow */});

      return { success: true };
    }),

  // ── Admin: list all demo requests, most recent first ──────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(demoRequests)
      .orderBy(desc(demoRequests.createdAt));
  }),

  // ── Admin: update the status of a demo request ────────────────────────────
  updateStatus: protectedProcedure
    .input(
      z.object({
        id:     z.number().int().positive(),
        status: z.enum(DEMO_STATUSES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(demoRequests)
        .set({ status: input.status, updatedAt: Date.now() })
        .where(eq(demoRequests.id, input.id));
      return { success: true };
    }),
});
