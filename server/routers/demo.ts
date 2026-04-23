import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { demoRequests, demoEmailLog } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import { sendGraphEmail } from "../graphEmail";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const DEMO_STATUSES = ["new", "contacted", "scheduled", "closed"] as const;
type DemoStatus = typeof DEMO_STATUSES[number];

// ── Calendly booking link ─────────────────────────────────────────────────────
// Live booking link — update this constant to change the URL everywhere at once.
const CALENDLY_BASE_URL = "https://calendly.com/farouqsultan/30min";

export function buildCalendlyLink(name: string, email: string): string {
  return `${CALENDLY_BASE_URL}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
}

// ── 48-hour guard ─────────────────────────────────────────────────────────────
const FOLLOW_UP_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours in ms — one contact per 48h institutional cadence

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

// ── Follow-up email template ──────────────────────────────────────────────────
function buildFollowUpHtml(name: string, institution: string, calendlyUrl: string): string {
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
      I wanted to follow up on your demo request for ${institution}.
    </p>

    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      We would love to walk you through how AgenThinkMesh can support your team's investment analysis workflows —
      from pitch triage and deal screening to IC memo generation and portfolio monitoring.
    </p>

    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      If you are available for a 30-minute call, you can book a time directly here:
    </p>

    <div style="margin:28px 0;">
      <a
        href="${calendlyUrl}"
        style="display:inline-block;background:#10b981;color:#ffffff;font-size:14px;font-weight:600;
               padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.02em;"
      >
        Book a 30-minute call →
      </a>
    </div>

    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      If that link does not work, you can also copy this URL into your browser:<br/>
      <a href="${calendlyUrl}" style="color:#10b981;word-break:break-all;">${calendlyUrl}</a>
    </p>

    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;">
      Feel free to reply to this email with any questions in the meantime.
    </p>

    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin-top:32px;">
      Best regards,<br/>
      Farouq Sultan<br/>
      AgenThinkMesh<br/>
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

      // Owner notification — subject: "New demo request — [Institution]"
      notifyOwner({
        title: `New demo request — ${input.institution}`,
        content: `**Name:** ${input.name}\n**Institution:** ${input.institution}\n**Email:** ${input.email}\n\n**Use case:**\n${input.useCase}\n\n**Manage:** https://agenthink-7enctkan.manus.space/admin/demo-requests`,
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

  // ── Admin: save notes for a demo request ──────────────────────────────────
  saveNotes: protectedProcedure
    .input(
      z.object({
        id:    z.number().int().positive(),
        notes: z.string().max(5000),
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
        .set({ notes: input.notes, updatedAt: Date.now() })
        .where(eq(demoRequests.id, input.id));
      return { success: true };
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

  // ── Admin: send a follow-up email to a requester ─────────────────────────
  // force=true bypasses the 24-hour cooldown guard (used after user confirms the warning dialog)
  sendFollowUp: protectedProcedure
    .input(
      z.object({
        id:    z.number().int().positive(),
        force: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch the request
      const rows = await db
        .select()
        .from(demoRequests)
        .where(eq(demoRequests.id, input.id))
        .limit(1);

      if (!rows.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Demo request not found" });
      }

      const req = rows[0];
      const now = Date.now();

      // 24-hour cooldown guard — return a warning payload instead of throwing
      if (!input.force && req.followUpSentAt) {
        const elapsedMs = now - req.followUpSentAt;
        if (elapsedMs < FOLLOW_UP_COOLDOWN_MS) {
          const hoursAgo = Math.round(elapsedMs / (1000 * 60 * 60) * 10) / 10;
          return {
            success: false,
            cooldownWarning: true,
            hoursAgo,
            newStatus: req.status,
          };
        }
      }

      const calendlyUrl = buildCalendlyLink(req.name, req.email);

      // Send follow-up email
      const sent = await sendGraphEmail({
        to:      req.email,
        cc:      "farouq@agenthink.ai",
        subject: "Following up on your AgenThinkMesh demo request",
        html:    buildFollowUpHtml(req.name, req.institution, calendlyUrl),
      });

      if (!sent) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send follow-up email. Please try again.",
        });
      }

      const newStatus: DemoStatus = req.status === "new" ? "contacted" : req.status as DemoStatus;

      // Update followUpSentAt + auto-advance status new → contacted
      await db
        .update(demoRequests)
        .set({
          followUpSentAt: now,
          status:         newStatus,
          updatedAt:      now,
        })
        .where(eq(demoRequests.id, input.id));

      // Append to email log
      await db.insert(demoEmailLog).values({
        demoRequestId: req.id,
        recipientName: req.name,
        institution:   req.institution,
        email:         req.email,
        statusAtSend:  req.status,
        sentAt:        now,
      });

      return { success: true, cooldownWarning: false, hoursAgo: 0, newStatus };
    }),

  // ── Admin: list email log, most recent first ──────────────────────────────
  emailLog: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(demoEmailLog)
      .orderBy(desc(demoEmailLog.sentAt));
  }),
});
