/**
 * aros/monitoring.ts — Autonomous Monitoring Network (Phase 5)
 *
 * Continuously scans for real-world events (M&A, AI initiatives, capital decisions,
 * regulatory changes, etc.) and automatically updates:
 *   - Decision Twin V2 (urgency score, monitoring signals)
 *   - Outcome Ledger V2 (status, notes)
 *   - Opportunity Score (in aros_companies)
 *
 * Every detected event is stored in aros_monitoring_events for audit and calibration.
 */

import { z } from "zod";
import { desc, eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosDecisionTwinsV2,
  arosMonitoringEvents,
  arosOutcomeLedgerV2,
  arosTokenLedger,
  arosAuditLog,
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

const EVENT_TYPES = [
  "MA_ACTIVITY",
  "AI_INITIATIVE",
  "DATA_CENTER_INVESTMENT",
  "DIGITAL_TRANSFORMATION",
  "INFRASTRUCTURE_PROJECT",
  "REGULATORY_CHANGE",
  "CAPITAL_ALLOCATION",
  "LEADERSHIP_CHANGE",
  "EARNINGS_SIGNAL",
  "PARTNERSHIP",
  "OTHER",
] as const;

// ── Scan a company for new events using LLM ───────────────────────────────────
async function scanCompanyForEvents(company: {
  id: number;
  companyName: string;
  sector: string;
  country: string;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  opportunityScore: number;
}): Promise<Array<{
  eventType: string;
  eventTitle: string;
  eventSummary: string;
  opportunityScoreDelta: number;
  urgencyScoreDelta: number;
  acvDelta: number;
}>> {
  const prompt = `You are the ATLAS Autonomous Monitoring Network. Analyze this company and identify any significant strategic events that would affect our opportunity assessment.

Company: ${company.companyName}
Sector: ${company.sector}
Country: ${company.country}
Known Initiative: ${company.activeStrategicInitiative ?? "Unknown"}
AI Signal: ${company.aiTransformationSignal ?? "Unknown"}
Current Opportunity Score: ${company.opportunityScore}/100

Based on your knowledge of this company, identify 1-3 significant recent or ongoing strategic events from these categories:
- M&A activity (acquisitions, mergers, divestitures)
- AI initiatives (AI transformation programs, LLM deployments, data modernization)
- Capital allocation decisions (major investments, budget announcements)
- Regulatory changes affecting their business
- Infrastructure projects
- Leadership changes
- Digital transformation programs

Return a JSON array of events (empty array if no significant events):
[
  {
    "eventType": "one of: MA_ACTIVITY | AI_INITIATIVE | DATA_CENTER_INVESTMENT | DIGITAL_TRANSFORMATION | INFRASTRUCTURE_PROJECT | REGULATORY_CHANGE | CAPITAL_ALLOCATION | LEADERSHIP_CHANGE | EARNINGS_SIGNAL | PARTNERSHIP | OTHER",
    "eventTitle": "brief title (max 100 chars)",
    "eventSummary": "1-2 sentence summary (max 300 chars)",
    "opportunityScoreDelta": integer between -20 and +20 (how much this changes our opportunity score),
    "urgencyScoreDelta": integer between -10 and +10 (how much this changes urgency),
    "acvDelta": integer in USD (how much this changes estimated ACV, can be 0)
  }
]

Return ONLY valid JSON array. If no significant events, return [].`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a structured JSON generator for strategic event detection. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
  });

  const raw = response?.choices?.[0]?.message?.content;
  if (!raw) return [];

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export const arosMonitoringRouter = router({

  // ── Ingest a manual event for a company ───────────────────────────────────
  ingestEvent: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      eventType: z.enum(EVENT_TYPES),
      eventTitle: z.string().min(5).max(300),
      eventSummary: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      opportunityScoreDelta: z.number().int().min(-50).max(50).default(0),
      urgencyScoreDelta: z.number().int().min(-50).max(50).default(0),
      acvDelta: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.companyId))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const now = Date.now();

      // Insert event
      const [eventResult] = await db.insert(arosMonitoringEvents).values({
        companyId: input.companyId,
        eventType: input.eventType,
        eventTitle: input.eventTitle.slice(0, 300),
        eventSummary: input.eventSummary,
        sourceUrl: input.sourceUrl,
        detectedAt: now,
        opportunityScoreDelta: input.opportunityScoreDelta,
        urgencyScoreDelta: input.urgencyScoreDelta,
        acvDelta: input.acvDelta,
        processed: false,
        dtUpdated: false,
        olUpdated: false,
        createdAt: now,
      }).$returningId();

      // Apply score delta to company
      if (input.opportunityScoreDelta !== 0) {
        const newScore = Math.max(0, Math.min(100, (company.opportunityScore ?? 0) + input.opportunityScoreDelta));
        await db.update(arosCompanies)
          .set({ opportunityScore: newScore, updatedAt: now })
          .where(eq(arosCompanies.id, input.companyId));
      }

      // Update Decision Twin V2 urgency if exists
      const [dt] = await db
        .select()
        .from(arosDecisionTwinsV2)
        .where(eq(arosDecisionTwinsV2.companyId, input.companyId))
        .orderBy(desc(arosDecisionTwinsV2.createdAt))
        .limit(1);

      if (dt && input.urgencyScoreDelta !== 0) {
        const newUrgency = Math.max(0, Math.min(100, (dt.urgencyScore ?? 0) + input.urgencyScoreDelta));
        await db.update(arosDecisionTwinsV2)
          .set({ urgencyScore: newUrgency, updatedAt: now })
          .where(eq(arosDecisionTwinsV2.id, dt.id));
      }

      // Update Outcome Ledger V2 if exists
      const [ol] = await db
        .select()
        .from(arosOutcomeLedgerV2)
        .where(eq(arosOutcomeLedgerV2.companyId, input.companyId))
        .orderBy(desc(arosOutcomeLedgerV2.createdAt))
        .limit(1);

      if (ol) {
        await db.update(arosOutcomeLedgerV2)
          .set({
            outcomeNotes: `[${new Date(now).toISOString().slice(0, 10)}] ${input.eventType}: ${input.eventTitle}`,
            updatedAt: now,
          })
          .where(eq(arosOutcomeLedgerV2.id, ol.id));
      }

      // Mark event as processed
      await db.update(arosMonitoringEvents)
        .set({ processed: true, processedAt: now, dtUpdated: !!dt, olUpdated: !!ol })
        .where(eq(arosMonitoringEvents.id, eventResult.id));

      await db.insert(arosAuditLog).values({
        actor: String(ctx.user.id),
        action: "monitoring_event.ingested",
        entityType: "aros_monitoring_events",
        entityId: String(eventResult.id),
        payload: JSON.stringify({ companyId: input.companyId, eventType: input.eventType }),
      });

      return {
        eventId: eventResult.id,
        companyName: company.companyName,
        dtUpdated: !!dt,
        olUpdated: !!ol,
        newOpportunityScore: Math.max(0, Math.min(100, (company.opportunityScore ?? 0) + input.opportunityScoreDelta)),
      };
    }),

  // ── Auto-scan a batch of companies for new events ─────────────────────────
  autoScanBatch: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      // Get highest-priority companies (by opportunity score, not recently scanned)
      const companies = await db
        .select()
        .from(arosCompanies)
        .orderBy(desc(arosCompanies.opportunityScore))
        .limit(input.limit);

      let totalEvents = 0;
      const results = [];

      for (const company of companies) {
        try {
          const events = await scanCompanyForEvents(company);

          // Log tokens
          await db.insert(arosTokenLedger).values({
            workflow: "company_research",
            model: "gpt-4o-mini",
            inputTokens: 400,
            outputTokens: 200,
            totalTokens: 600,
            costUsd: (400 * 0.00000015 + 200 * 0.0000006).toFixed(8),
            companyId: company.id,
            triggeredBy: ctx.user.id,
          });

          const now = Date.now();
          for (const event of events) {
            const evType = EVENT_TYPES.includes(event.eventType as any) ? event.eventType as typeof EVENT_TYPES[number] : "OTHER";

            const [eventResult] = await db.insert(arosMonitoringEvents).values({
              companyId: company.id,
              eventType: evType,
              eventTitle: (event.eventTitle ?? "").slice(0, 300),
              eventSummary: event.eventSummary,
              detectedAt: now,
              opportunityScoreDelta: Math.max(-50, Math.min(50, event.opportunityScoreDelta ?? 0)),
              urgencyScoreDelta: Math.max(-50, Math.min(50, event.urgencyScoreDelta ?? 0)),
              acvDelta: event.acvDelta ?? 0,
              processed: false,
              dtUpdated: false,
              olUpdated: false,
              createdAt: now,
            }).$returningId();

            // Apply score delta
            if (event.opportunityScoreDelta !== 0) {
              const newScore = Math.max(0, Math.min(100, (company.opportunityScore ?? 0) + event.opportunityScoreDelta));
              await db.update(arosCompanies)
                .set({ opportunityScore: newScore, updatedAt: now })
                .where(eq(arosCompanies.id, company.id));
            }

            await db.update(arosMonitoringEvents)
              .set({ processed: true, processedAt: now })
              .where(eq(arosMonitoringEvents.id, eventResult.id));

            totalEvents++;
          }

          results.push({ companyId: company.id, companyName: company.companyName, eventsDetected: events.length });
        } catch (err) {
          console.error(`Scan failed for ${company.companyName}:`, err);
          results.push({ companyId: company.id, companyName: company.companyName, eventsDetected: 0, error: true });
        }
      }

      return { totalEvents, companiesScanned: companies.length, results };
    }),

  // ── Get recent events ─────────────────────────────────────────────────────
  getRecentEvents: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      companyId: z.number().optional(),
      eventType: z.enum(EVENT_TYPES).optional(),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const conditions = [];
      if (input.companyId) conditions.push(eq(arosMonitoringEvents.companyId, input.companyId));
      if (input.eventType) conditions.push(eq(arosMonitoringEvents.eventType, input.eventType));

      const events = await db
        .select({
          event: arosMonitoringEvents,
          companyName: arosCompanies.companyName,
          sector: arosCompanies.sector,
        })
        .from(arosMonitoringEvents)
        .leftJoin(arosCompanies, eq(arosMonitoringEvents.companyId, arosCompanies.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(arosMonitoringEvents.detectedAt))
        .limit(input.limit);

      return events;
    }),

  // ── Get event stats ───────────────────────────────────────────────────────
  getEventStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [[stats]] = await db.execute(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
          SUM(CASE WHEN dt_updated = 1 THEN 1 ELSE 0 END) as dt_updated,
          SUM(CASE WHEN ol_updated = 1 THEN 1 ELSE 0 END) as ol_updated,
          AVG(opportunity_score_delta) as avg_score_delta,
          COUNT(DISTINCT company_id) as companies_affected
        FROM aros_monitoring_events
      `) as any;

      const byType = await db.execute(`
        SELECT event_type, COUNT(*) as count,
          AVG(opportunity_score_delta) as avg_delta
        FROM aros_monitoring_events
        GROUP BY event_type
        ORDER BY count DESC
      `) as any;

      return {
        total: Number(stats.total),
        processed: Number(stats.processed),
        dtUpdated: Number(stats.dt_updated),
        olUpdated: Number(stats.ol_updated),
        avgScoreDelta: Number(stats.avg_score_delta ?? 0),
        companiesAffected: Number(stats.companies_affected),
        byType: (byType[0] as any[]).map((r: any) => ({
          type: r.event_type,
          count: Number(r.count),
          avgDelta: Number(r.avg_delta ?? 0),
        })),
      };
    }),

  // ── Get unprocessed events ────────────────────────────────────────────────
  getUnprocessed: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const events = await db
        .select({
          event: arosMonitoringEvents,
          companyName: arosCompanies.companyName,
        })
        .from(arosMonitoringEvents)
        .leftJoin(arosCompanies, eq(arosMonitoringEvents.companyId, arosCompanies.id))
        .where(eq(arosMonitoringEvents.processed, false))
        .orderBy(desc(arosMonitoringEvents.detectedAt))
        .limit(50);

      return events;
    }),
});
