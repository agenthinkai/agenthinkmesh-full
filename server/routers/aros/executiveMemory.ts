/**
 * aros/executiveMemory.ts — Phase 9: Executive Memory & Learning Engine
 *
 * Permanent institutional memory for every executive and organisation Atlas has
 * ever interacted with. Nothing is overwritten. Everything is appended.
 *
 * Relationship Score (0–100) is computed from:
 *  - Briefs delivered (weight 10)
 *  - Replies received (weight 25)
 *  - Meetings held (weight 25)
 *  - Proposals sent (weight 20)
 *  - Customer conversion (weight 15)
 *  - Recency decay (penalty for >30 days since last contact)
 */

import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import {
  atlasExecutiveMemory,
  atlasConversationTimeline,
  atlasOrgIntelligence,
  atlasLearningEvents,
  arosCompanies,
} from "../../../drizzle/schema";

// ─── DB Helper ───────────────────────────────────────────────────────────────
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// ─── Relationship Score Calculator ────────────────────────────────────────────

export function computeRelationshipScore(mem: {
  totalBriefsDelivered: number;
  totalReplies: number;
  meetings: number;
  proposals: number;
  customers: number;
  lastContactDate: number | null;
}): number {
  const briefs = Math.min(mem.totalBriefsDelivered, 10) * 1;   // max 10 pts
  const replies = Math.min(mem.totalReplies, 5) * 5;            // max 25 pts
  const meets = Math.min(mem.meetings, 5) * 5;                  // max 25 pts
  const props = Math.min(mem.proposals, 4) * 5;                 // max 20 pts
  const custs = Math.min(mem.customers, 3) * 5;                 // max 15 pts
  let score = briefs + replies + meets + props + custs;

  // Recency decay: -5 pts per 30-day period since last contact (max -20)
  if (mem.lastContactDate) {
    const daysSince = (Date.now() - mem.lastContactDate) / (1000 * 60 * 60 * 24);
    const periods = Math.floor(daysSince / 30);
    score -= Math.min(periods * 5, 20);
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Upsert Helper ────────────────────────────────────────────────────────────

export async function upsertExecutiveMemory(params: {
  companyId?: number | null;
  companyName: string;
  executiveName: string;
  executiveEmail?: string | null;
  role?: string | null;
  eventType: "BRIEF_DELIVERED" | "REPLY" | "MEETING" | "PROPOSAL" | "CUSTOMER";
  eventSummary?: string;
  eventDetail?: string;
  outreachQueueId?: number;
  sss?: number;
  esi?: number;
  constitutionVersion?: string;
}) {
  const db = await getDb();
  if (!db) return;

  // Find or create executive memory record
  const [existing] = await db
    .select()
    .from(atlasExecutiveMemory)
    .where(
      params.executiveEmail
        ? eq(atlasExecutiveMemory.executiveEmail, params.executiveEmail)
        : eq(atlasExecutiveMemory.executiveName, params.executiveName)
    )
    .limit(1);

  const now = Date.now();

  let memId: number;
  if (existing) {
    // Increment the relevant counter
    const updates: Record<string, number | null> = {
      lastContactDate: now,
      updatedAt: now,
    };
    if (params.eventType === "BRIEF_DELIVERED") updates.totalBriefsDelivered = (existing.totalBriefsDelivered ?? 0) + 1;
    if (params.eventType === "REPLY") updates.totalReplies = (existing.totalReplies ?? 0) + 1;
    if (params.eventType === "MEETING") updates.meetings = (existing.meetings ?? 0) + 1;
    if (params.eventType === "PROPOSAL") updates.proposals = (existing.proposals ?? 0) + 1;
    if (params.eventType === "CUSTOMER") updates.customers = (existing.customers ?? 0) + 1;

    // Recompute relationship score
    const updatedMem = { ...existing, ...updates };
    updates.relationshipScore = computeRelationshipScore({
      totalBriefsDelivered: updatedMem.totalBriefsDelivered ?? 0,
      totalReplies: updatedMem.totalReplies ?? 0,
      meetings: updatedMem.meetings ?? 0,
      proposals: updatedMem.proposals ?? 0,
      customers: updatedMem.customers ?? 0,
      lastContactDate: now,
    });

    await db.update(atlasExecutiveMemory).set(updates).where(eq(atlasExecutiveMemory.id, existing.id));
    memId = existing.id;
  } else {
    const counters = {
      totalBriefsDelivered: params.eventType === "BRIEF_DELIVERED" ? 1 : 0,
      totalReplies: params.eventType === "REPLY" ? 1 : 0,
      meetings: params.eventType === "MEETING" ? 1 : 0,
      proposals: params.eventType === "PROPOSAL" ? 1 : 0,
      customers: params.eventType === "CUSTOMER" ? 1 : 0,
    };
    const relScore = computeRelationshipScore({ ...counters, lastContactDate: now });
    const [result] = await db.insert(atlasExecutiveMemory).values({
      companyId: params.companyId ?? null,
      companyName: params.companyName,
      executiveName: params.executiveName,
      executiveEmail: params.executiveEmail ?? null,
      role: params.role ?? null,
      firstContactDate: now,
      lastContactDate: now,
      ...counters,
      relationshipScore: relScore,
      createdAt: now,
      updatedAt: now,
    });
    memId = (result as unknown as { insertId: number }).insertId;
  }

  // Append to conversation timeline
  await db.insert(atlasConversationTimeline).values({
    companyId: params.companyId ?? null,
    executiveMemoryId: memId,
    companyName: params.companyName,
    executiveName: params.executiveName,
    eventType: params.eventType,
    eventDate: now,
    summary: params.eventSummary ?? null,
    detail: params.eventDetail ?? null,
    outreachQueueId: params.outreachQueueId ?? null,
    sss: params.sss ?? null,
    esi: params.esi ?? null,
    constitutionVersion: params.constitutionVersion ?? null,
    createdAt: now,
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const executiveMemoryRouter = router({
  /** List all executive memory records */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      companyId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const rows = await db
        .select()
        .from(atlasExecutiveMemory)
        .where(input.companyId ? eq(atlasExecutiveMemory.companyId, input.companyId) : undefined)
        .orderBy(desc(atlasExecutiveMemory.relationshipScore))
        .limit(input.limit)
        .offset(input.offset);
      const [countRow] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(atlasExecutiveMemory)
        .where(input.companyId ? eq(atlasExecutiveMemory.companyId, input.companyId) : undefined);
      return { rows, total: Number(countRow?.total ?? 0) };
    }),

  /** Get a single executive memory record */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(atlasExecutiveMemory)
        .where(eq(atlasExecutiveMemory.id, input.id))
        .limit(1);
      return row ?? null;
    }),

  /** Get conversation timeline for an executive */
  getTimeline: protectedProcedure
    .input(z.object({
      executiveMemoryId: z.number().optional(),
      companyId: z.number().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const condition = input.executiveMemoryId
        ? eq(atlasConversationTimeline.executiveMemoryId, input.executiveMemoryId)
        : input.companyId
          ? eq(atlasConversationTimeline.companyId, input.companyId)
          : undefined;
      const rows = await db
        .select()
        .from(atlasConversationTimeline)
        .where(condition)
        .orderBy(desc(atlasConversationTimeline.eventDate))
        .limit(input.limit);
      return rows;
    }),

  /** Get org intelligence profile for a company */
  getOrgProfile: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db
        .select()
        .from(atlasOrgIntelligence)
        .where(eq(atlasOrgIntelligence.companyId, input.companyId))
        .limit(1);
      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      return { orgIntelligence: row ?? null, company: company ?? null };
    }),

  /** Summary stats for the Learning Dashboard */
  getSummaryStats: protectedProcedure
    .query(async () => {
      const db = await requireDb();
      const [stats] = await db
        .select({
          totalExecutives: sql<number>`COUNT(*)`,
          totalBriefs: sql<number>`SUM(total_briefs_delivered)`,
          totalReplies: sql<number>`SUM(total_replies)`,
          totalMeetings: sql<number>`SUM(meetings)`,
          totalProposals: sql<number>`SUM(proposals)`,
          totalCustomers: sql<number>`SUM(customers)`,
          avgRelationshipScore: sql<number>`AVG(relationship_score)`,
        })
        .from(atlasExecutiveMemory);
      const [timelineCount] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(atlasConversationTimeline);
      return {
        totalExecutives: Number(stats?.totalExecutives ?? 0),
        totalBriefs: Number(stats?.totalBriefs ?? 0),
        totalReplies: Number(stats?.totalReplies ?? 0),
        totalMeetings: Number(stats?.totalMeetings ?? 0),
        totalProposals: Number(stats?.totalProposals ?? 0),
        totalCustomers: Number(stats?.totalCustomers ?? 0),
        avgRelationshipScore: Math.round(Number(stats?.avgRelationshipScore ?? 0)),
        totalTimelineEvents: Number(timelineCount?.total ?? 0),
      };
    }),

  /** Aggregate stats for the Learning Dashboard */
  getLearningStats: protectedProcedure
    .query(async () => {
      const db = await requireDb();
      const rows = await db.select().from(atlasLearningEvents);
      const total = rows.length;
      const count = (field: keyof typeof rows[0], val: string) =>
        rows.filter(r => r[field] === val).length;
      const bySector: Record<string, number> = {};
      const byTrigger: Record<string, number> = {};
      for (const r of rows) {
        if (r.sector) bySector[r.sector] = (bySector[r.sector] ?? 0) + 1;
        if (r.triggerType) byTrigger[r.triggerType] = (byTrigger[r.triggerType] ?? 0) + 1;
      }
      return {
        total,
        subjectLineHigh: count("subjectLineEffectiveness", "HIGH"),
        subjectLineMedium: count("subjectLineEffectiveness", "MEDIUM"),
        subjectLineLow: count("subjectLineEffectiveness", "LOW"),
        subjectLineUnknown: count("subjectLineEffectiveness", "UNKNOWN"),
        hiddenVariableConfirmed: count("hiddenVariableEffectiveness", "CONFIRMED"),
        hiddenVariablePartial: count("hiddenVariableEffectiveness", "PARTIAL"),
        hiddenVariableIncorrect: count("hiddenVariableEffectiveness", "INCORRECT"),
        hiddenVariableUnknown: count("hiddenVariableEffectiveness", "UNKNOWN"),
        decisionFramingAccurate: count("decisionFramingEffectiveness", "ACCURATE"),
        decisionFramingPartial: count("decisionFramingEffectiveness", "PARTIAL"),
        decisionFramingMissed: count("decisionFramingEffectiveness", "MISSED"),
        decisionFramingUnknown: count("decisionFramingEffectiveness", "UNKNOWN"),
        constitutionStrong: count("constitutionEffectiveness", "STRONG"),
        constitutionAdequate: count("constitutionEffectiveness", "ADEQUATE"),
        constitutionWeak: count("constitutionEffectiveness", "WEAK"),
        constitutionUnknown: count("constitutionEffectiveness", "UNKNOWN"),
        bySector,
        byTrigger,
      };
    }),

  /** Recent learning events for the Learning Dashboard */
  getRecentLearningEvents: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const events = await db
        .select()
        .from(atlasLearningEvents)
        .orderBy(desc(atlasLearningEvents.eventDate))
        .limit(input.limit);
      return { events };
    }),

  /** Update interests/objections/preferred topics on an executive memory record */
  updateProfile: protectedProcedure
    .input(z.object({
      id: z.number(),
      interests: z.string().optional(),
      objections: z.string().optional(),
      preferredTopics: z.string().optional(),
      preferredCommunicationStyle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const { id, ...updates } = input;
      await db
        .update(atlasExecutiveMemory)
        .set({ ...updates, updatedAt: Date.now() })
        .where(eq(atlasExecutiveMemory.id, id));
      return { success: true };
    }),
});
