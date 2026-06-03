/**
 * pilotConversion router
 * Procedures:
 *   admin:
 *     create       — create a new pilot from a demo request or scratch
 *     list         — list all pilots with usage summary
 *     get          — get a single pilot with full usage history
 *     update       — update status, notes, config
 *     logUsage     — record a usage event for a pilot
 *     funnelMetrics — conversion funnel: demos → pilots → converted → active
 *     executivePdf  — generate executive PDF for a pilot
 *   public:
 *     getBySlug    — get pilot by slug (for pilot landing page, no auth)
 */
import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { pilots, pilotUsage, demoRequests } from "../../drizzle/schema";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireAdmin(role: string) {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
}

function generateSlug(orgName: string): string {
  const base = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Router ────────────────────────────────────────────────────────────────────

export const pilotConversionRouter = router({

  // ── Create pilot ─────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      orgName:        z.string().min(1).max(300),
      contactName:    z.string().min(1).max(200),
      contactEmail:   z.string().email().max(300),
      contactTitle:   z.string().max(200).optional(),
      councilMode:    z.string().max(100).default("infrastructure"),
      maxEvaluations: z.number().int().min(1).max(100).default(10),
      demoRequestId:  z.number().int().optional(),
      notes:          z.string().max(2000).optional(),
      expiresInDays:  z.number().int().min(1).max(365).default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();
      const now = Date.now();
      const slug = generateSlug(input.orgName);
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashToken(rawToken);
      const expiresAt = now + input.expiresInDays * 24 * 60 * 60 * 1000;

      const [result] = await db.insert(pilots).values({
        orgName:        input.orgName,
        contactName:    input.contactName,
        contactEmail:   input.contactEmail,
        contactTitle:   input.contactTitle,
        pilotSlug:      slug,
        councilMode:    input.councilMode,
        maxEvaluations: input.maxEvaluations,
        demoRequestId:  input.demoRequestId,
        notes:          input.notes,
        status:         "INVITED",
        accessTokenHash: tokenHash,
        invitedAt:      now,
        expiresAt,
        createdAt:      now,
        updatedAt:      now,
      });

      const pilotId = (result as { insertId: number }).insertId;

      return {
        id:         pilotId,
        slug,
        accessToken: rawToken,  // returned once — store securely
        pilotUrl:   `/pilot/${slug}`,
      };
    }),

  // ── List all pilots ───────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["INVITED","ACTIVE","COMPLETED","CONVERTED","CHURNED","ALL"]).default("ALL"),
      limit:  z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();

      const conditions = input.status !== "ALL"
        ? [eq(pilots.status, input.status as "INVITED" | "ACTIVE" | "COMPLETED" | "CONVERTED" | "CHURNED")]
        : [];

      const rows = await db
        .select()
        .from(pilots)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(pilots.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Attach usage counts
      const pilotIds = rows.map(r => r.id);
      const usageCounts: Record<number, number> = {};
      if (pilotIds.length > 0) {
        const usageRows = await db
          .select({
            pilotId: pilotUsage.pilotId,
            count: sql<number>`COUNT(*)`.as("count"),
          })
          .from(pilotUsage)
          .where(sql`${pilotUsage.pilotId} IN (${sql.join(pilotIds.map(id => sql`${id}`), sql`, `)})`)
          .groupBy(pilotUsage.pilotId);
        for (const u of usageRows) usageCounts[u.pilotId] = Number(u.count);
      }

      const [totalRow] = await db
        .select({ total: sql<number>`COUNT(*)`.as("total") })
        .from(pilots)
        .where(conditions.length ? and(...conditions) : undefined);

      return {
        pilots: rows.map(p => ({
          ...p,
          usageCount: usageCounts[p.id] ?? 0,
        })),
        total: Number(totalRow?.total ?? 0),
      };
    }),

  // ── Get single pilot ──────────────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();

      const [pilot] = await db.select().from(pilots).where(eq(pilots.id, input.id));
      if (!pilot) throw new TRPCError({ code: "NOT_FOUND" });

      const usage = await db
        .select()
        .from(pilotUsage)
        .where(eq(pilotUsage.pilotId, input.id))
        .orderBy(desc(pilotUsage.createdAt))
        .limit(100);

      // Usage breakdown by event type
      const breakdown: Record<string, number> = {};
      for (const u of usage) {
        breakdown[u.eventType] = (breakdown[u.eventType] ?? 0) + 1;
      }

      return { pilot, usage, breakdown };
    }),

  // ── Update pilot ──────────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id:             z.number().int(),
      status:         z.enum(["INVITED","ACTIVE","COMPLETED","CONVERTED","CHURNED"]).optional(),
      notes:          z.string().max(2000).optional(),
      maxEvaluations: z.number().int().min(1).max(100).optional(),
      councilMode:    z.string().max(100).optional(),
      expiresAt:      z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();
      const now = Date.now();

      const updates: Partial<typeof pilots.$inferInsert> = { updatedAt: now };
      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === "ACTIVE")    updates.activatedAt  = now;
        if (input.status === "COMPLETED") updates.completedAt  = now;
        if (input.status === "CONVERTED") updates.convertedAt  = now;
      }
      if (input.notes          !== undefined) updates.notes          = input.notes;
      if (input.maxEvaluations !== undefined) updates.maxEvaluations = input.maxEvaluations;
      if (input.councilMode    !== undefined) updates.councilMode    = input.councilMode;
      if (input.expiresAt      !== undefined) updates.expiresAt      = input.expiresAt;

      await db.update(pilots).set(updates).where(eq(pilots.id, input.id));
      return { ok: true };
    }),

  // ── Log usage event ───────────────────────────────────────────────────────────
  logUsage: protectedProcedure
    .input(z.object({
      pilotId:     z.number().int(),
      eventType:   z.enum(["EVALUATION_RUN","REPORT_VIEWED","REPORT_SHARED","DEMO_VIEWED","PDF_EXPORTED","LOGIN"]),
      dealId:      z.string().max(100).optional(),
      councilMode: z.string().max(100).optional(),
      metadata:    z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();
      const now = Date.now();

      await db.insert(pilotUsage).values({
        pilotId:     input.pilotId,
        eventType:   input.eventType,
        dealId:      input.dealId,
        councilMode: input.councilMode,
        metadata:    input.metadata ? JSON.stringify(input.metadata) : undefined,
        createdAt:   now,
      });

      // Auto-activate pilot on first EVALUATION_RUN
      if (input.eventType === "EVALUATION_RUN") {
        const [pilot] = await db.select({ status: pilots.status }).from(pilots).where(eq(pilots.id, input.pilotId));
        if (pilot?.status === "INVITED") {
          await db.update(pilots).set({ status: "ACTIVE", activatedAt: now, updatedAt: now }).where(eq(pilots.id, input.pilotId));
        }
      }

      return { ok: true };
    }),

  // ── Conversion funnel metrics ─────────────────────────────────────────────────
  funnelMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();

      // Demo requests (leads)
      const [demoTotal] = await db.select({ total: sql<number>`COUNT(*)`.as("t") }).from(demoRequests);
      const [demoContacted] = await db.select({ total: sql<number>`COUNT(*)`.as("t") }).from(demoRequests)
        .where(sql`status IN ('contacted','scheduled','closed')`);
      const [demoScheduled] = await db.select({ total: sql<number>`COUNT(*)`.as("t") }).from(demoRequests)
        .where(sql`status IN ('scheduled','closed')`);

      // Pilots
      const statusCounts: Record<string, number> = {};
      const statusRows = await db
        .select({ status: pilots.status, count: sql<number>`COUNT(*)`.as("c") })
        .from(pilots)
        .groupBy(pilots.status);
      for (const r of statusRows) statusCounts[r.status] = Number(r.count);

      const totalPilots    = Object.values(statusCounts).reduce((a, b) => a + b, 0);
      const activePilots   = statusCounts["ACTIVE"]    ?? 0;
      const convertedPilots = statusCounts["CONVERTED"] ?? 0;
      const completedPilots = statusCounts["COMPLETED"] ?? 0;
      const churnedPilots  = statusCounts["CHURNED"]   ?? 0;
      const invitedPilots  = statusCounts["INVITED"]   ?? 0;

      // Usage in last 30 days
      const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const [activeUsage] = await db.select({ total: sql<number>`COUNT(DISTINCT pilot_id)`.as("t") })
        .from(pilotUsage).where(gte(pilotUsage.createdAt, since30d));

      // Total evaluations run
      const [evalRuns] = await db.select({ total: sql<number>`COUNT(*)`.as("t") })
        .from(pilotUsage).where(eq(pilotUsage.eventType, "EVALUATION_RUN"));

      // Conversion rates
      const demoToTrialRate  = totalPilots > 0 && Number(demoTotal?.total) > 0
        ? ((totalPilots / Number(demoTotal.total)) * 100).toFixed(1)
        : "0.0";
      const trialToConvertRate = totalPilots > 0
        ? ((convertedPilots / totalPilots) * 100).toFixed(1)
        : "0.0";

      return {
        funnel: {
          leadsTotal:       Number(demoTotal?.total ?? 0),
          leadsContacted:   Number(demoContacted?.total ?? 0),
          demosScheduled:   Number(demoScheduled?.total ?? 0),
          pilotsTotal:      totalPilots,
          pilotsInvited:    invitedPilots,
          pilotsActive:     activePilots,
          pilotsCompleted:  completedPilots,
          pilotsConverted:  convertedPilots,
          pilotsChurned:    churnedPilots,
        },
        metrics: {
          activeUsersLast30d:  Number(activeUsage?.total ?? 0),
          totalEvaluationsRun: Number(evalRuns?.total ?? 0),
          demoToTrialRate:     `${demoToTrialRate}%`,
          trialToConvertRate:  `${trialToConvertRate}%`,
        },
      };
    }),

  // ── Get pilot by slug (public — for pilot landing page) ───────────────────────
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().max(100) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [pilot] = await db.select({
        id:             pilots.id,
        orgName:        pilots.orgName,
        contactName:    pilots.contactName,
        pilotSlug:      pilots.pilotSlug,
        councilMode:    pilots.councilMode,
        maxEvaluations: pilots.maxEvaluations,
        status:         pilots.status,
        expiresAt:      pilots.expiresAt,
        invitedAt:      pilots.invitedAt,
      }).from(pilots).where(eq(pilots.pilotSlug, input.slug));

      if (!pilot) throw new TRPCError({ code: "NOT_FOUND" });
      if (pilot.status === "CHURNED") throw new TRPCError({ code: "FORBIDDEN", message: "Pilot access revoked" });
      if (pilot.expiresAt && pilot.expiresAt < Date.now()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Pilot access expired" });
      }

      // Usage count for this pilot
      const [usageRow] = await db
        .select({ count: sql<number>`COUNT(*)`.as("c") })
        .from(pilotUsage)
        .where(and(eq(pilotUsage.pilotId, pilot.id), eq(pilotUsage.eventType, "EVALUATION_RUN")));

      return {
        ...pilot,
        evaluationsUsed: Number(usageRow?.count ?? 0),
        evaluationsRemaining: Math.max(0, pilot.maxEvaluations - Number(usageRow?.count ?? 0)),
      };
    }),

  // ── Executive summary (for PDF export) ───────────────────────────────────────
  executiveSummary: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await requireDb();

      const [pilot] = await db.select().from(pilots).where(eq(pilots.id, input.id));
      if (!pilot) throw new TRPCError({ code: "NOT_FOUND" });

      const usage = await db
        .select()
        .from(pilotUsage)
        .where(eq(pilotUsage.pilotId, input.id))
        .orderBy(desc(pilotUsage.createdAt));

      const evalRuns = usage.filter(u => u.eventType === "EVALUATION_RUN");
      const reportsViewed = usage.filter(u => u.eventType === "REPORT_VIEWED");
      const reportsShared = usage.filter(u => u.eventType === "REPORT_SHARED");

      const firstActivity = usage.length > 0 ? Math.min(...usage.map(u => u.createdAt)) : null;
      const lastActivity  = usage.length > 0 ? Math.max(...usage.map(u => u.createdAt)) : null;

      const durationDays = firstActivity && lastActivity
        ? Math.round((lastActivity - firstActivity) / (1000 * 60 * 60 * 24))
        : 0;

      const utilizationRate = pilot.maxEvaluations > 0
        ? ((evalRuns.length / pilot.maxEvaluations) * 100).toFixed(1)
        : "0.0";

      return {
        pilot,
        summary: {
          totalEvents:       usage.length,
          evaluationsRun:    evalRuns.length,
          reportsViewed:     reportsViewed.length,
          reportsShared:     reportsShared.length,
          utilizationRate:   `${utilizationRate}%`,
          durationDays,
          firstActivity,
          lastActivity,
          councilModesUsed:  Array.from(new Set(evalRuns.map(u => u.councilMode).filter((m): m is string => m !== null))),
        },
        recentEvaluations: evalRuns.slice(0, 10),
      };
    }),
});
