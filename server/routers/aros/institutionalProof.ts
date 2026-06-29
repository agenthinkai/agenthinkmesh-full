/**
 * institutionalProof.ts — Institutional Proof Dashboard tRPC router
 *
 * FINAL RULE: Every metric returned by this router must be derived from real
 * operational data. No simulated, estimated, or fabricated numbers are allowed.
 * If a metric has no real data yet, it returns null — never a placeholder value.
 *
 * Route: /aros/proof
 * Audience: Customers, Boards, Investors, Partners
 */
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { z } from "zod";
import {
  arosOutreachQueue,
  arosOutcomeLedgerV2,
  arosDecisionTwinsV2,
  arosHiddenVariables,
  arosCalibration,
  arosAccuracySnapshots,
  atlasConstitutionVersions,
  atlasLearningEvents,
  arosCompanies,
} from "../../../drizzle/schema";
import { eq, and, isNotNull, desc, sql, count, avg } from "drizzle-orm";

// ── Helper: format currency ────────────────────────────────────────────────────
function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Helper: safe percentage (1 decimal) ───────────────────────────────────────
function safePct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// ── Helper: parse decimal string ──────────────────────────────────────────────
function parseDec(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export const institutionalProofRouter = router({
  // ── NORTH STAR ─────────────────────────────────────────────────────────────
  getNorthStar: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { decisionsImproved: 0, institutionalCustomers: 0, predictionAccuracy: null, revenueGenerated: 0, revenueGeneratedFormatted: "$0", hasRealData: false };

    const [decisionsImproved] = await db
      .select({ count: count() })
      .from(arosOutcomeLedgerV2)
      .where(sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('MEETING_HELD','PROPOSAL_SENT','CUSTOMER_WON')`);

    const [institutionalCustomers] = await db
      .select({ count: count() })
      .from(arosOutcomeLedgerV2)
      .where(eq(arosOutcomeLedgerV2.outcomeStatus, "CUSTOMER_WON"));

    const [predictionAccuracyRow] = await db
      .select({ avg: avg(arosOutcomeLedgerV2.dtAccuracy) })
      .from(arosOutcomeLedgerV2)
      .where(isNotNull(arosOutcomeLedgerV2.dtAccuracy));

    const [revenueRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(${arosOutcomeLedgerV2.revenueActual}), 0)` })
      .from(arosOutcomeLedgerV2)
      .where(isNotNull(arosOutcomeLedgerV2.revenueActual));

    const rawAccuracy = parseDec(predictionAccuracyRow?.avg as string | null);
    const revenueTotal = revenueRow?.total ?? 0;

    return {
      decisionsImproved: decisionsImproved?.count ?? 0,
      institutionalCustomers: institutionalCustomers?.count ?? 0,
      predictionAccuracy: rawAccuracy !== null ? Math.round(rawAccuracy * 1000) / 10 : null,
      revenueGenerated: revenueTotal,
      revenueGeneratedFormatted: formatCurrency(revenueTotal),
      hasRealData: (decisionsImproved?.count ?? 0) > 0,
    };
  }),

  // ── SECTION 1: EXECUTIVE IMPACT ────────────────────────────────────────────
  getExecutiveImpact: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { briefsDelivered: 0, executiveReplies: 0, meetingsBooked: 0, proposalsSent: 0, customersWon: 0, pipelineValue: 0, pipelineValueFormatted: "$0", revenueWon: 0, revenueWonFormatted: "$0", avgResponseRate: null, hasRealData: false };

    // Briefs delivered = approvalStatus = 'SENT'
    const [briefsDelivered] = await db
      .select({ count: count() })
      .from(arosOutreachQueue)
      .where(eq(arosOutreachQueue.approvalStatus, "SENT"));

    // Replies = repliedAt is not null
    const [execReplies] = await db
      .select({ count: count() })
      .from(arosOutreachQueue)
      .where(isNotNull(arosOutreachQueue.repliedAt));

    // Meetings booked
    const [meetingsBooked] = await db
      .select({ count: count() })
      .from(arosOutcomeLedgerV2)
      .where(sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('MEETING_HELD','PROPOSAL_SENT','CUSTOMER_WON')`);

    // Proposals sent
    const [proposalsSent] = await db
      .select({ count: count() })
      .from(arosOutcomeLedgerV2)
      .where(sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('PROPOSAL_SENT','CUSTOMER_WON')`);

    // Customers won
    const [customersWon] = await db
      .select({ count: count() })
      .from(arosOutcomeLedgerV2)
      .where(eq(arosOutcomeLedgerV2.outcomeStatus, "CUSTOMER_WON"));

    // Pipeline value = sum of acvAtT0 for non-lost entries
    const [pipelineValue] = await db
      .select({ total: sql<number>`COALESCE(SUM(${arosOutcomeLedgerV2.acvAtT0}), 0)` })
      .from(arosOutcomeLedgerV2)
      .where(sql`${arosOutcomeLedgerV2.outcomeStatus} NOT IN ('CUSTOMER_LOST','NO_ENGAGEMENT')`);

    // Revenue won
    const [revenueWon] = await db
      .select({ total: sql<number>`COALESCE(SUM(${arosOutcomeLedgerV2.revenueActual}), 0)` })
      .from(arosOutcomeLedgerV2)
      .where(eq(arosOutcomeLedgerV2.outcomeStatus, "CUSTOMER_WON"));

    const delivered = briefsDelivered?.count ?? 0;
    const replies = execReplies?.count ?? 0;

    return {
      briefsDelivered: delivered,
      executiveReplies: replies,
      meetingsBooked: meetingsBooked?.count ?? 0,
      proposalsSent: proposalsSent?.count ?? 0,
      customersWon: customersWon?.count ?? 0,
      pipelineValue: pipelineValue?.total ?? 0,
      pipelineValueFormatted: formatCurrency(pipelineValue?.total ?? 0),
      revenueWon: revenueWon?.total ?? 0,
      revenueWonFormatted: formatCurrency(revenueWon?.total ?? 0),
      avgResponseRate: safePct(replies, delivered),
      hasRealData: delivered > 0,
    };
  }),

  // ── SECTION 2: DECISION QUALITY ────────────────────────────────────────────
  getDecisionQuality: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { decisionTwinsGenerated: 0, hiddenVariablesGenerated: 0, hiddenVariableAccuracy: null, decisionTwinAccuracy: null, outcomeLedgerEntries: 0, calibratedOutcomes: 0, constitutionVersion: null, atlasPerformanceIndex: null, hasRealData: false };

    const [dtGenerated] = await db.select({ count: count() }).from(arosDecisionTwinsV2);
    const [hvGenerated] = await db.select({ count: count() }).from(arosHiddenVariables);

    const [hvValidated] = await db
      .select({ count: count() })
      .from(arosHiddenVariables)
      .where(isNotNull(arosHiddenVariables.predictionCorrect));

    const [hvCorrect] = await db
      .select({ count: count() })
      .from(arosHiddenVariables)
      .where(eq(arosHiddenVariables.predictionCorrect, true));

    const [dtAccuracyRow] = await db
      .select({ avg: avg(arosOutcomeLedgerV2.dtAccuracy) })
      .from(arosOutcomeLedgerV2)
      .where(isNotNull(arosOutcomeLedgerV2.dtAccuracy));

    const [outcomeLedgerEntries] = await db.select({ count: count() }).from(arosOutcomeLedgerV2);

    const [calibratedOutcomes] = await db
      .select({ count: count() })
      .from(arosOutcomeLedgerV2)
      .where(isNotNull(arosOutcomeLedgerV2.dtAccuracy));

    const [activeConstitution] = await db
      .select({ version: atlasConstitutionVersions.version })
      .from(atlasConstitutionVersions)
      .where(eq(atlasConstitutionVersions.status, "ACTIVE"))
      .orderBy(desc(atlasConstitutionVersions.createdAt))
      .limit(1);

    // Latest accuracy snapshot for Atlas Performance Index
    const [latestSnapshot] = await db
      .select()
      .from(arosAccuracySnapshots)
      .orderBy(desc(arosAccuracySnapshots.snapshotDate))
      .limit(1);

    const rawDtAccuracy = parseDec(dtAccuracyRow?.avg as string | null);
    const hvAccuracy = safePct(hvCorrect?.count ?? 0, hvValidated?.count ?? 0);

    // Atlas Performance Index: weighted composite
    let atlasPerformanceIndex: number | null = null;
    if (rawDtAccuracy !== null && hvAccuracy !== null) {
      atlasPerformanceIndex = Math.round((rawDtAccuracy * 100 * 0.6 + hvAccuracy * 0.4) * 10) / 10;
    } else if (rawDtAccuracy !== null) {
      atlasPerformanceIndex = Math.round(rawDtAccuracy * 100 * 10) / 10;
    } else if (hvAccuracy !== null) {
      atlasPerformanceIndex = Math.round(hvAccuracy * 10) / 10;
    }

    return {
      decisionTwinsGenerated: dtGenerated?.count ?? 0,
      hiddenVariablesGenerated: hvGenerated?.count ?? 0,
      hiddenVariableAccuracy: hvAccuracy,
      decisionTwinAccuracy: rawDtAccuracy !== null ? Math.round(rawDtAccuracy * 1000) / 10 : null,
      outcomeLedgerEntries: outcomeLedgerEntries?.count ?? 0,
      calibratedOutcomes: calibratedOutcomes?.count ?? 0,
      constitutionVersion: activeConstitution?.version ?? null,
      atlasPerformanceIndex,
      latestSnapshot: latestSnapshot ?? null,
      hasRealData: (dtGenerated?.count ?? 0) > 0,
    };
  }),

  // ── SECTION 3: LEARNING ────────────────────────────────────────────────────
  getLearning: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { learningEvents: 0, constitutionImprovements: 0, calibrationImprovements: 0, predictionAccuracyTrend: [], executiveRelationshipGrowth: 0, topIndustries: [], topHiddenVariables: [], hasRealData: false };

    const [learningEventsTotal] = await db.select({ count: count() }).from(atlasLearningEvents);

    const [constitutionImprovements] = await db
      .select({ count: count() })
      .from(atlasConstitutionVersions)
      .where(eq(atlasConstitutionVersions.status, "RETIRED"));

    const [calibrationImprovements] = await db
      .select({ count: count() })
      .from(arosCalibration)
      .where(isNotNull(arosCalibration.actualRate));

    // Accuracy trend: last 10 snapshots (chronological)
    const accuracyTrend = await db
      .select({
        snapshotDate: arosAccuracySnapshots.snapshotDate,
        dtAccuracy: arosAccuracySnapshots.dtAccuracyAvg,
        hvAccuracy: arosAccuracySnapshots.hvAccuracyAvg,
      })
      .from(arosAccuracySnapshots)
      .orderBy(desc(arosAccuracySnapshots.snapshotDate))
      .limit(10);

    const [execRelationshipGrowth] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${arosOutcomeLedgerV2.companyId})` })
      .from(arosOutcomeLedgerV2)
      .where(sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('RESPONSE_RECEIVED','MEETING_HELD','PROPOSAL_SENT','CUSTOMER_WON')`);

    const topIndustries = await db
      .select({ sector: arosCompanies.sector, count: count() })
      .from(arosOutcomeLedgerV2)
      .innerJoin(arosCompanies, eq(arosOutcomeLedgerV2.companyId, arosCompanies.id))
      .where(sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('RESPONSE_RECEIVED','MEETING_HELD','PROPOSAL_SENT','CUSTOMER_WON')`)
      .groupBy(arosCompanies.sector)
      .orderBy(desc(count()))
      .limit(5);

    const topHiddenVariables = await db
      .select({ type: arosHiddenVariables.hiddenVariableType, count: count() })
      .from(arosHiddenVariables)
      .where(eq(arosHiddenVariables.predictionCorrect, true))
      .groupBy(arosHiddenVariables.hiddenVariableType)
      .orderBy(desc(count()))
      .limit(5);

    return {
      learningEvents: learningEventsTotal?.count ?? 0,
      constitutionImprovements: constitutionImprovements?.count ?? 0,
      calibrationImprovements: calibrationImprovements?.count ?? 0,
      predictionAccuracyTrend: accuracyTrend.reverse(),
      executiveRelationshipGrowth: execRelationshipGrowth?.count ?? 0,
      topIndustries: topIndustries.map(r => ({ sector: r.sector ?? "Unknown", count: r.count })),
      topHiddenVariables: topHiddenVariables.map(r => ({ type: r.type, count: r.count })),
      hasRealData: (learningEventsTotal?.count ?? 0) > 0,
    };
  }),

  // ── SECTION 4: PROOF OF LEARNING ──────────────────────────────────────────
  getProofOfLearning: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { proofChains: [], totalChainsAvailable: 0, hasRealData: false };

    // Companies with 2+ calibrated outcome entries
    const companiesWithMultipleOutcomes = await db
      .select({ companyId: arosOutcomeLedgerV2.companyId, entryCount: count() })
      .from(arosOutcomeLedgerV2)
      .where(isNotNull(arosOutcomeLedgerV2.dtAccuracy))
      .groupBy(arosOutcomeLedgerV2.companyId)
      .having(sql`COUNT(*) >= 2`)
      .orderBy(desc(count()))
      .limit(5);

    const proofChains = await Promise.all(
      companiesWithMultipleOutcomes.map(async ({ companyId }) => {
        const [company] = await db
          .select({ name: arosCompanies.companyName, sector: arosCompanies.sector })
          .from(arosCompanies)
          .where(eq(arosCompanies.id, companyId))
          .limit(1);

        const outcomes = await db
          .select()
          .from(arosOutcomeLedgerV2)
          .where(and(eq(arosOutcomeLedgerV2.companyId, companyId), isNotNull(arosOutcomeLedgerV2.dtAccuracy)))
          .orderBy(arosOutcomeLedgerV2.createdAt)
          .limit(5);

        if (outcomes.length < 2) return null;

        const v1 = outcomes[0];
        const v2 = outcomes[outcomes.length - 1];
        const v1Accuracy = parseDec(v1.dtAccuracy) ?? 0;
        const v2Accuracy = parseDec(v2.dtAccuracy) ?? 0;
        const improvement = Math.round((v2Accuracy - v1Accuracy) * 1000) / 10;

        return {
          companyId,
          companyName: company?.name ?? `Company ${companyId}`,
          sector: company?.sector ?? "Unknown",
          v1: {
            hiddenVariable: v1.hiddenVariable,
            outcomeStatus: v1.outcomeStatus,
            dtAccuracy: Math.round(v1Accuracy * 1000) / 10,
            revenueForecasted: v1.revenueForecasted,
            revenueActual: v1.revenueActual,
            date: v1.createdAt,
          },
          v2: {
            hiddenVariable: v2.hiddenVariable,
            outcomeStatus: v2.outcomeStatus,
            dtAccuracy: Math.round(v2Accuracy * 1000) / 10,
            revenueForecasted: v2.revenueForecasted,
            revenueActual: v2.revenueActual,
            date: v2.createdAt,
          },
          improvementPct: improvement,
          improved: improvement > 0,
        };
      })
    );

    const validChains = proofChains.filter(Boolean);
    return {
      proofChains: validChains,
      totalChainsAvailable: companiesWithMultipleOutcomes.length,
      hasRealData: validChains.length > 0,
    };
  }),

  // ── SECTION 5: CUSTOMER PROOF ──────────────────────────────────────────────
  getCustomerProof: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { engagements: [], totalEngagements: 0, hasRealData: false };

      const completedEngagements = await db
        .select()
        .from(arosOutcomeLedgerV2)
        .where(sql`${arosOutcomeLedgerV2.outcomeStatus} IN ('MEETING_HELD','PROPOSAL_SENT','CUSTOMER_WON')`)
        .orderBy(desc(arosOutcomeLedgerV2.outcomeDate))
        .limit(input.limit);

      const enriched = await Promise.all(
        completedEngagements.map(async (entry) => {
          const [company] = await db
            .select({ name: arosCompanies.companyName, sector: arosCompanies.sector, country: arosCompanies.country })
            .from(arosCompanies)
            .where(eq(arosCompanies.id, entry.companyId))
            .limit(1);

          const [dt] = await db
            .select({ primaryObjective: arosDecisionTwinsV2.primaryObjective, hiddenVariable: arosDecisionTwinsV2.hiddenVariable })
            .from(arosDecisionTwinsV2)
            .where(eq(arosDecisionTwinsV2.companyId, entry.companyId))
            .orderBy(desc(arosDecisionTwinsV2.createdAt))
            .limit(1);

          const dtAccuracy = parseDec(entry.dtAccuracy);
          const hvAccuracy = parseDec(entry.hvAccuracy);

          return {
            id: entry.id,
            companyName: company?.name ?? `Company ${entry.companyId}`,
            sector: company?.sector ?? "Unknown",
            country: company?.country ?? "Unknown",
            hiddenVariable: entry.hiddenVariable,
            decisionTwin: dt?.primaryObjective ?? null,
            outcomeStatus: entry.outcomeStatus,
            outcomeNotes: entry.outcomeNotes,
            outcomeDate: entry.outcomeDate,
            revenueForecasted: entry.revenueForecasted,
            revenueActual: entry.revenueActual,
            revenueActualFormatted: formatCurrency(entry.revenueActual),
            dtAccuracy: dtAccuracy !== null ? Math.round(dtAccuracy * 1000) / 10 : null,
            hvAccuracy: hvAccuracy !== null ? Math.round(hvAccuracy * 1000) / 10 : null,
            businessImpact: entry.outcomeNotes,
          };
        })
      );

      return {
        engagements: enriched,
        totalEngagements: enriched.length,
        hasRealData: enriched.length > 0,
      };
    }),
});

export type InstitutionalProofRouter = typeof institutionalProofRouter;
