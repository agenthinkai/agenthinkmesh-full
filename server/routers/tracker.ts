/**
 * tracker.ts — Email Reply Tracker tRPC router
 *
 * Procedures:
 *  tracker.getStats         — aggregate stats (total, replied, by status, by market)
 *  tracker.getEmails        — paginated list of outbound emails with filters
 *  tracker.updateStatus     — update reply status for an outbound email
 *  tracker.getRecentReplies — get the 20 most recent replies
 *  tracker.getSyncLog       — get the last 10 Gmail sync log entries
 *  tracker.getGmailStatus   — check if Gmail is connected
 *  tracker.triggerSync      — manually trigger a Gmail sync
 *  tracker.getFollowUpCount — count of emails with follow-up due
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, sql, count, gte, lt, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  outboundEmails,
  emailReplies,
  gmailSyncLog,
  gmailOAuthTokens,
} from "../../drizzle/schema";
import { isGmailConnected, syncGmailReplies } from "../gmailTracker";

const TRACKER_EMAIL = "farouqsultan@gmail.com";

const replyStatusEnum = z.enum([
  "no_response",
  "new_reply",
  "interested",
  "meeting_booked",
  "pilot_started",
  "not_interested",
]);

export const trackerRouter = router({
  // ── Stats ──────────────────────────────────────────────────────────────────
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // Total emails sent
    const [totalRow] = await db
      .select({ count: count() })
      .from(outboundEmails);
    const total = totalRow?.count ?? 0;

    // Count by status
    const statusCounts = await db
      .select({
        status: outboundEmails.replyStatus,
        count: count(),
      })
      .from(outboundEmails)
      .groupBy(outboundEmails.replyStatus);

    // Count by market
    const marketCounts = await db
      .select({
        market: outboundEmails.market,
        total: count(),
        replied: sql<number>`SUM(CASE WHEN ${outboundEmails.replyStatus} != 'no_response' THEN 1 ELSE 0 END)`,
      })
      .from(outboundEmails)
      .groupBy(outboundEmails.market)
      .orderBy(desc(count()));

    // Follow-up due count
    const [followUpRow] = await db
      .select({ count: count() })
      .from(outboundEmails)
      .where(eq(outboundEmails.followUpDue, true));
    const followUpDue = followUpRow?.count ?? 0;

    // Total replies received
    const [repliesRow] = await db
      .select({ count: count() })
      .from(emailReplies);
    const totalReplies = repliesRow?.count ?? 0;

    // Build status map
    const statusMap: Record<string, number> = {
      no_response: 0,
      new_reply: 0,
      interested: 0,
      meeting_booked: 0,
      pilot_started: 0,
      not_interested: 0,
    };
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
    }

    const replied = total - statusMap.no_response;
    const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

    return {
      total,
      replied,
      replyRate,
      totalReplies,
      followUpDue,
      byStatus: statusMap,
      byMarket: marketCounts,
    };
  }),

  // ── List emails ────────────────────────────────────────────────────────────
  getEmails: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        status: replyStatusEnum.optional(),
        market: z.string().optional(),
        search: z.string().optional(),
        followUpOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const conditions = [];
      if (input.status) {
        conditions.push(eq(outboundEmails.replyStatus, input.status));
      }
      if (input.market) {
        conditions.push(eq(outboundEmails.market, input.market));
      }
      if (input.followUpOnly) {
        conditions.push(eq(outboundEmails.followUpDue, true));
      }
      if (input.search) {
        const searchLike = `%${input.search}%`;
        conditions.push(
          sql`(${outboundEmails.recipientName} LIKE ${searchLike} OR ${outboundEmails.recipientEmail} LIKE ${searchLike} OR ${outboundEmails.recipientFirm} LIKE ${searchLike})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [emails, [totalRow]] = await Promise.all([
        db
          .select()
          .from(outboundEmails)
          .where(whereClause)
          .orderBy(desc(outboundEmails.sentAt))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(outboundEmails)
          .where(whereClause),
      ]);

      return {
        emails,
        total: totalRow?.count ?? 0,
        page: input.page,
        limit: input.limit,
      };
    }),

  // ── Update status ──────────────────────────────────────────────────────────────────────────────
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: replyStatusEnum,
        notes: z.string().optional(),
        followUpDate: z.string().optional(), // ISO date string or null
        clearFollowUp: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const updatePayload: Record<string, unknown> = {
        replyStatus: input.status,
        lastActivityAt: new Date(),
        followUpDue: false,
      };
      if (input.notes !== undefined) updatePayload.notes = input.notes;
      if (input.followUpDate) updatePayload.followUpDate = new Date(input.followUpDate);
      if (input.clearFollowUp) updatePayload.followUpDate = null;

      await db
        .update(outboundEmails)
        .set(updatePayload)
        .where(eq(outboundEmails.id, input.id));

      return { success: true };
    }),

  // ── Update notes only (without changing status) ───────────────────────────────────────
  updateNotes: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string(), followUpDate: z.string().nullable().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const updatePayload: Record<string, unknown> = { notes: input.notes };
      if (input.followUpDate !== undefined) {
        updatePayload.followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
      }

      await db.update(outboundEmails).set(updatePayload).where(eq(outboundEmails.id, input.id));
      return { success: true };
    }),

  // ── Bulk import contacts from pasted text ────────────────────────────────────────────────
  bulkImport: protectedProcedure
    .input(
      z.object({
        contacts: z.array(
          z.object({
            name: z.string().min(1),
            email: z.string().email(),
            firm: z.string().optional(),
            role: z.string().optional(),
            market: z.string().default("Other"),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      if (input.contacts.length === 0) return { success: true, inserted: 0 };

      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < input.contacts.length; i += batchSize) {
        const batch = input.contacts.slice(i, i + batchSize);
        await db.insert(outboundEmails).values(
          batch.map((c) => ({
            recipientName: c.name,
            recipientEmail: c.email,
            recipientFirm: c.firm,
            recipientRole: c.role,
            market: c.market,
            subject: "Outreach",
            language: "English",
            sentAt: new Date(),
            replyStatus: "no_response" as const,
            followUpDue: false,
          }))
        );
        inserted += batch.length;
      }

      return { success: true, inserted };
    }),

  // ── Get follow-up due today count (for nav badge) ──────────────────────────────────────
  getFollowUpDueToday: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0 };

    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const [row] = await db
      .select({ count: count() })
      .from(outboundEmails)
      .where(
        sql`${outboundEmails.followUpDate} IS NOT NULL AND ${outboundEmails.followUpDate} <= ${endOfDay}`
      );

    return { count: row?.count ?? 0 };
  }),

  // ── Recent replies ──────────────────────────────────────────────────────────────────────────────
  getRecentReplies: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return db
        .select({
          reply: emailReplies,
          outbound: {
            id: outboundEmails.id,
            recipientName: outboundEmails.recipientName,
            recipientFirm: outboundEmails.recipientFirm,
            market: outboundEmails.market,
            replyStatus: outboundEmails.replyStatus,
          },
        })
        .from(emailReplies)
        .leftJoin(outboundEmails, eq(emailReplies.outboundEmailId, outboundEmails.id))
        .orderBy(desc(emailReplies.receivedAt))
        .limit(input.limit);
    }),

  // ── Sync log ───────────────────────────────────────────────────────────────
  getSyncLog: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    return db
      .select()
      .from(gmailSyncLog)
      .orderBy(desc(gmailSyncLog.createdAt))
      .limit(10);
  }),

  // ── Gmail connection status ────────────────────────────────────────────────
  getGmailStatus: protectedProcedure.query(async () => {
    const connected = await isGmailConnected(TRACKER_EMAIL);
    return { connected, email: TRACKER_EMAIL };
  }),

  // ── Manual sync trigger ────────────────────────────────────────────────────
  triggerSync: protectedProcedure.mutation(async () => {
    const connected = await isGmailConnected(TRACKER_EMAIL);
    if (!connected) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Gmail not connected. Please authorize Gmail first.",
      });
    }
    // Run sync in background
    syncGmailReplies(TRACKER_EMAIL).catch((err) =>
      console.error("[TrackerRouter] Sync error:", err)
    );
    return { success: true, message: "Sync started in background" };
  }),

  // ── Follow-up count (for nav badge) ───────────────────────────────────────
  getFollowUpCount: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0 };

    const [row] = await db
      .select({ count: count() })
      .from(outboundEmails)
      .where(eq(outboundEmails.followUpDue, true));

    return { count: row?.count ?? 0 };
  }),

  // ── Get Gmail auth URL ─────────────────────────────────────────────────────
  getGmailAuthUrl: protectedProcedure
    .input(z.object({ origin: z.string() }))
    .query(({ input }) => {
      const state = Buffer.from(JSON.stringify({ origin: input.origin })).toString("base64");
      const params = new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID || "",
        redirect_uri: process.env.GMAIL_REDIRECT_URI || "",
        response_type: "code",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
        access_type: "offline",
        prompt: "consent",
        state,
      });
      return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      };
    }),

  // ── Add a single contact manually ──────────────────────────────────────────
  addContact: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        firm: z.string().optional(),
        role: z.string().optional(),
        market: z.string().default("Other"),
        sentAt: z.string().optional(), // ISO date, defaults to now
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const sentDate = input.sentAt ? new Date(input.sentAt) : new Date();
      const followUpDue = sentDate < new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);

      const [inserted] = await db.insert(outboundEmails).values({
        recipientName: input.name,
        recipientEmail: input.email,
        recipientFirm: input.firm,
        recipientRole: input.role,
        market: input.market,
        subject: "Outreach",
        language: "English",
        sentAt: sentDate,
        replyStatus: "no_response",
        followUpDue,
        followUpDueAt: followUpDue ? new Date() : undefined,
      });

      return { success: true, id: (inserted as { insertId?: number })?.insertId };
    }),

  // ── Seed outbound emails (admin only) ─────────────────────────────────────
  seedOutboundEmails: protectedProcedure
    .input(
      z.object({
        emails: z.array(
          z.object({
            recipientName: z.string(),
            recipientEmail: z.string().email(),
            recipientFirm: z.string().optional(),
            recipientRole: z.string().optional(),
            market: z.string(),
            subject: z.string(),
            language: z.string().default("English"),
            msMessageId: z.string().optional(),
            sentAt: z.string(), // ISO date string
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Insert in batches of 100
      const batchSize = 100;
      let inserted = 0;
      for (let i = 0; i < input.emails.length; i += batchSize) {
        const batch = input.emails.slice(i, i + batchSize);
        await db.insert(outboundEmails).values(
          batch.map((e) => ({
            recipientName: e.recipientName,
            recipientEmail: e.recipientEmail,
            recipientFirm: e.recipientFirm,
            recipientRole: e.recipientRole,
            market: e.market,
            subject: e.subject,
            language: e.language,
            msMessageId: e.msMessageId,
            sentAt: new Date(e.sentAt),
            // Auto-flag follow-up if sent more than 6 weeks ago
            followUpDue: new Date(e.sentAt) < new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
            followUpDueAt:
              new Date(e.sentAt) < new Date(Date.now() - 42 * 24 * 60 * 60 * 1000)
                ? new Date()
                : undefined,
          }))
        );
        inserted += batch.length;
      }

      return { success: true, inserted };
    }),
});
