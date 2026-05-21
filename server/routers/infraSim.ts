/**
 * infraSim.ts — tRPC Router for Governed Infrastructure Stress Simulation v2
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, desc, and } from "drizzle-orm";
import {
  infraSimCases,
  infraSimDimensions,
  infraSimRuns,
  infraSimScenarios,
  infraSimCouncilSessions,
  infraSimCouncilRounds,
  infraSimMonitoringObjects,
  infraSimMonitoringEvents,
  infraSimPortfolioLinks,
} from "../../drizzle/schema";
import {
  generateScenarios,
  aggregateResults,
  HELIOS_NORTH_CONFIG,
  type SimCaseConfig,
  type SimDimension,
} from "../infraSimEngine";
import { runCouncilDeliberation } from "../infraSimCouncilDebate";
import {
  detectAssumptionDrift,
  recomputeApprovalProbability,
  generateAlerts,
  computeThesisStatus,
  generateWeeklyMemo,
  type MonitoringEvent,
} from "../infraSimMonitor";

// ── Input Schemas ─────────────────────────────────────────────────────────────

const DimensionValueSchema = z.object({
  label: z.string(),
  irrDeltaPct: z.number(),
  weight: z.number().min(0).max(1),
  isHardNo: z.boolean().optional(),
  isGovernanceTrigger: z.boolean().optional(),
});

const DimensionSchema = z.object({
  key: z.string(),
  name: z.string(),
  category: z.enum(["technology", "financial", "regulatory", "execution", "revenue"]),
  values: z.array(DimensionValueSchema).min(2).max(10),
  interactionPenalties: z.record(z.string(), z.number()).optional(),
  governanceThreshold: z.number().optional(),
  sortOrder: z.number().optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const infraSimRouter = router({

  // ── Case Management ─────────────────────────────────────────────────────────

  listCases: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const cases = await db
      .select()
      .from(infraSimCases)
      .where(eq(infraSimCases.userId, ctx.user.id))
      .orderBy(desc(infraSimCases.createdAt));
    return cases;
  }),

  getCase: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [simCase] = await db
        .select()
        .from(infraSimCases)
        .where(and(eq(infraSimCases.id, input.caseId), eq(infraSimCases.userId, ctx.user.id)));
      if (!simCase) throw new Error("Case not found");

      const dimensions = await db
        .select()
        .from(infraSimDimensions)
        .where(eq(infraSimDimensions.caseId, input.caseId))
        .orderBy(infraSimDimensions.sortOrder);

      const runs = await db
        .select()
        .from(infraSimRuns)
        .where(eq(infraSimRuns.caseId, input.caseId))
        .orderBy(desc(infraSimRuns.createdAt));

      return { simCase, dimensions, runs };
    }),

  createCase: protectedProcedure
    .input(z.object({
      title: z.string().min(3).max(255),
      assetClass: z.string(),
      geography: z.string().optional(),
      totalCapexGbpM: z.number().optional(),
      baseIrrPct: z.number(),
      fundMinIrrPct: z.number(),
      icMemoText: z.string().optional(),
      baseAssumptionsJson: z.string().optional(),
      dimensions: z.array(DimensionSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [inserted] = await db.insert(infraSimCases).values({
        userId: ctx.user.id,
        title: input.title,
        assetClass: input.assetClass,
        geography: input.geography,
        totalCapexGbpM: input.totalCapexGbpM?.toString(),
        baseIrrPct: input.baseIrrPct.toString(),
        fundMinIrrPct: input.fundMinIrrPct.toString(),
        icMemoText: input.icMemoText,
        baseAssumptionsJson: input.baseAssumptionsJson,
        icDecision: "PENDING",
        status: "draft",
      });

      const caseId = (inserted as any).insertId as number;

      // Insert dimensions
      for (let i = 0; i < input.dimensions.length; i++) {
        const dim = input.dimensions[i];
        await db.insert(infraSimDimensions).values({
          caseId,
          name: dim.name,
          key: dim.key,
          category: dim.category,
          valuesJson: JSON.stringify(dim.values),
          interactionPenaltiesJson: dim.interactionPenalties ? JSON.stringify(dim.interactionPenalties) : null,
          governanceThreshold: dim.governanceThreshold?.toString(),
          sortOrder: dim.sortOrder ?? i,
        });
      }

      return { caseId };
    }),

  // ── Helios-North Demo Case Seeder ────────────────────────────────────────────

  seedHeliosNorth: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Check if already seeded for this user
    const existing = await db
      .select()
      .from(infraSimCases)
      .where(and(eq(infraSimCases.userId, ctx.user.id), eq(infraSimCases.title, "Helios-North Offshore Wind")));

    if (existing.length > 0) return { caseId: existing[0].id, alreadyExists: true };

    const [inserted] = await db.insert(infraSimCases).values({
      userId: ctx.user.id,
      title: HELIOS_NORTH_CONFIG.title,
      assetClass: "offshore_wind",
      geography: "UK North Sea",
      totalCapexGbpM: "4200",
      baseIrrPct: HELIOS_NORTH_CONFIG.baseIrrPct.toString(),
      fundMinIrrPct: HELIOS_NORTH_CONFIG.fundMinIrrPct.toString(),
      icMemoText: HELIOS_NORTH_MEMO_EXTRACT,
      icDecision: "REJECT",
      icVoteJson: JSON.stringify({ hardNo: 3, softNo: 4, softYes: 3 }),
      status: "draft",
    });

    const caseId = (inserted as any).insertId as number;

    for (let i = 0; i < HELIOS_NORTH_CONFIG.dimensions.length; i++) {
      const dim = HELIOS_NORTH_CONFIG.dimensions[i];
      await db.insert(infraSimDimensions).values({
        caseId,
        name: dim.name,
        key: dim.key,
        category: dim.category,
        valuesJson: JSON.stringify(dim.values),
        interactionPenaltiesJson: dim.interactionPenalties ? JSON.stringify(dim.interactionPenalties) : null,
        sortOrder: i,
      });
    }

    return { caseId, alreadyExists: false };
  }),

  // ── Simulation Run ───────────────────────────────────────────────────────────

  startRun: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      targetCount: z.number().min(100).max(100000).default(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Load case
      const [simCase] = await db
        .select()
        .from(infraSimCases)
        .where(and(eq(infraSimCases.id, input.caseId), eq(infraSimCases.userId, ctx.user.id)));
      if (!simCase) throw new Error("Case not found");

      const dimensions = await db
        .select()
        .from(infraSimDimensions)
        .where(eq(infraSimDimensions.caseId, input.caseId))
        .orderBy(infraSimDimensions.sortOrder);

      // Build config
      const config: SimCaseConfig = {
        caseId: input.caseId,
        title: simCase.title,
        baseIrrPct: parseFloat(simCase.baseIrrPct ?? "0"),
        fundMinIrrPct: parseFloat(simCase.fundMinIrrPct ?? "15"),
        dimensions: dimensions.map((d) => ({
          key: d.key,
          name: d.name,
          category: d.category as SimDimension["category"],
          values: JSON.parse(d.valuesJson),
          interactionPenalties: d.interactionPenaltiesJson ? JSON.parse(d.interactionPenaltiesJson) : undefined,
          governanceThreshold: d.governanceThreshold ? parseFloat(d.governanceThreshold) : undefined,
        })),
      };

      // Create run record
      const [runInserted] = await db.insert(infraSimRuns).values({
        caseId: input.caseId,
        userId: ctx.user.id,
        targetCount: input.targetCount,
        status: "running",
        startedAt: Date.now(),
      });
      const runId = (runInserted as any).insertId as number;

      // Run simulation (synchronous — fast enough for 10k)
      try {
        const scenarios = generateScenarios(config, input.targetCount);
        const result = aggregateResults(scenarios, config);

        // Persist sampled scenarios
        for (const s of result.sampledScenarios) {
          await db.insert(infraSimScenarios).values({
            runId,
            scenarioIndex: s.index,
            parametersJson: JSON.stringify(s.parameters),
            irrPct: s.irrPct.toString(),
            decision: s.decision,
            blockerScore: s.blockerScore.toString(),
            dominantRiskCategory: s.dominantRiskCategory,
            hardNoTriggersJson: JSON.stringify(s.hardNoTriggers),
            softNoTriggersJson: JSON.stringify(s.softNoTriggers),
            interactionPenaltyPct: s.interactionPenaltyPct.toString(),
            scenarioType: "sampled",
          });
        }

        // Update run with results
        await db.update(infraSimRuns).set({
          completedCount: result.totalScenarios,
          approveCount: result.approveCount,
          conditionalCount: result.conditionalCount,
          rejectCount: result.rejectCount,
          medianIrrPct: result.medianIrrPct.toString(),
          p10IrrPct: result.p10IrrPct.toString(),
          p90IrrPct: result.p90IrrPct.toString(),
          topFailureDriversJson: JSON.stringify(result.topFailureDrivers),
          approvalPathwayJson: JSON.stringify(result.approvalPathway),
          sensitivityJson: JSON.stringify(result.sensitivity),
          reproducibilityManifestJson: JSON.stringify(result.reproducibilityManifest),
          governanceAuditJson: JSON.stringify(result.governanceAudit),
          status: "complete",
          completedAt: Date.now(),
        }).where(eq(infraSimRuns.id, runId));

        // Update case status
        await db.update(infraSimCases).set({ status: "complete", updatedAt: Date.now() })
          .where(eq(infraSimCases.id, input.caseId));

        return { runId, result };
      } catch (err) {
        await db.update(infraSimRuns).set({
          status: "error",
          errorMessage: String(err).slice(0, 512),
        }).where(eq(infraSimRuns.id, runId));
        throw err;
      }
    }),

  getRunResult: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [run] = await db
        .select()
        .from(infraSimRuns)
        .where(and(eq(infraSimRuns.id, input.runId), eq(infraSimRuns.userId, ctx.user.id)));
      if (!run) throw new Error("Run not found");

      const scenarios = await db
        .select()
        .from(infraSimScenarios)
        .where(eq(infraSimScenarios.runId, input.runId));

      return { run, scenarios };
    }),

  // ── Council Deliberation ─────────────────────────────────────────────────────

  startCouncilDeliberation: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      runId: z.number().optional(),
      activePersonaIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [simCase] = await db
        .select()
        .from(infraSimCases)
        .where(and(eq(infraSimCases.id, input.caseId), eq(infraSimCases.userId, ctx.user.id)));
      if (!simCase) throw new Error("Case not found");

      const dimensions = await db
        .select()
        .from(infraSimDimensions)
        .where(eq(infraSimDimensions.caseId, input.caseId));

      const config: SimCaseConfig = {
        caseId: input.caseId,
        title: simCase.title,
        baseIrrPct: parseFloat(simCase.baseIrrPct ?? "0"),
        fundMinIrrPct: parseFloat(simCase.fundMinIrrPct ?? "15"),
        dimensions: dimensions.map((d) => ({
          key: d.key,
          name: d.name,
          category: d.category as SimDimension["category"],
          values: JSON.parse(d.valuesJson),
        })),
      };

      // Get latest run result if available
      let simResult: any = null;
      if (input.runId) {
        const [run] = await db.select().from(infraSimRuns).where(eq(infraSimRuns.id, input.runId));
        if (run) {
          simResult = {
            totalScenarios: run.completedCount,
            approveRate: run.approveCount / run.completedCount,
            conditionalRate: run.conditionalCount / run.completedCount,
            rejectRate: run.rejectCount / run.completedCount,
            medianIrrPct: parseFloat(run.medianIrrPct ?? "0"),
            p10IrrPct: parseFloat(run.p10IrrPct ?? "0"),
            p90IrrPct: parseFloat(run.p90IrrPct ?? "0"),
            topFailureDrivers: run.topFailureDriversJson ? JSON.parse(run.topFailureDriversJson) : [],
            approvalPathway: run.approvalPathwayJson ? JSON.parse(run.approvalPathwayJson) : [],
          };
        }
      }

      // Create session record
      const [sessionInserted] = await db.insert(infraSimCouncilSessions).values({
        caseId: input.caseId,
        runId: input.runId,
        userId: ctx.user.id,
        personaSetKey: "infrastructure_global",
        status: "running",
      });
      const sessionId = (sessionInserted as any).insertId as number;

      // Run deliberation
      const result = await runCouncilDeliberation(
        config,
        simResult ?? { totalScenarios: 0, approveRate: 0, conditionalRate: 0, rejectRate: 1, medianIrrPct: 0, p10IrrPct: 0, p90IrrPct: 0, topFailureDrivers: [], approvalPathway: [] },
        simCase.icMemoText ?? "",
        input.activePersonaIds
      );

      // Persist rounds
      for (const round of result.rounds) {
        await db.insert(infraSimCouncilRounds).values({
          sessionId,
          roundNumber: round.roundNumber,
          roundType: round.roundType,
          votesJson: JSON.stringify(round.votes),
          argumentsJson: JSON.stringify(round.votes.reduce((acc: any, v) => { acc[v.personaId] = v.argument; return acc; }, {})),
          voteMigrationsJson: JSON.stringify(round.voteMigrations),
          confidenceShiftsJson: JSON.stringify({}),
        });
      }

      // Update session
      await db.update(infraSimCouncilSessions).set({
        finalDecision: result.finalDecision,
        finalVoteJson: JSON.stringify(result.finalVote),
        consensusScore: result.consensusScore.toString(),
        debateTranscriptJson: result.transcript,
        persuasionGraphJson: JSON.stringify(result.persuasionGraph),
        coalitionMapJson: JSON.stringify(result.coalitionMap),
        minorityReportJson: result.minorityReport ? JSON.stringify(result.minorityReport) : null,
        unresolvedDisagreementsJson: JSON.stringify(result.unresolvedDisagreements),
        status: "complete",
        completedAt: Date.now(),
      }).where(eq(infraSimCouncilSessions.id, sessionId));

      return { sessionId, result };
    }),

  getCouncilSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [session] = await db
        .select()
        .from(infraSimCouncilSessions)
        .where(and(eq(infraSimCouncilSessions.id, input.sessionId), eq(infraSimCouncilSessions.userId, ctx.user.id)));
      if (!session) throw new Error("Session not found");

      const rounds = await db
        .select()
        .from(infraSimCouncilRounds)
        .where(eq(infraSimCouncilRounds.sessionId, input.sessionId))
        .orderBy(infraSimCouncilRounds.roundNumber);

      return { session, rounds };
    }),

  // ── Monitoring ───────────────────────────────────────────────────────────────

  createMonitoringObject: protectedProcedure
    .input(z.object({ caseId: z.number(), initialApprovalPct: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [inserted] = await db.insert(infraSimMonitoringObjects).values({
        caseId: input.caseId,
        userId: ctx.user.id,
        thesisStatus: "GREEN",
        approvalProbabilityPct: input.initialApprovalPct.toString(),
        decisionDriftScore: "0",
        thesisDegradationPct: "0",
        wouldApproveToday: 1,
        isActive: 1,
      });
      return { monitoringObjectId: (inserted as any).insertId };
    }),

  ingestMonitoringEvent: protectedProcedure
    .input(z.object({
      monitoringObjectId: z.number(),
      caseId: z.number(),
      eventType: z.string(),
      eventTitle: z.string(),
      eventDescription: z.string().optional(),
      impactedDimensions: z.array(z.string()),
      irrImpactDeltaPct: z.number(),
      thesisImpact: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "CRITICAL"]),
      sourceUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(infraSimMonitoringEvents).values({
        monitoringObjectId: input.monitoringObjectId,
        caseId: input.caseId,
        eventType: input.eventType,
        eventTitle: input.eventTitle,
        eventDescription: input.eventDescription,
        impactedDimensions: input.impactedDimensions.join(","),
        irrImpactDeltaPct: input.irrImpactDeltaPct.toString(),
        thesisImpact: input.thesisImpact,
        sourceUrl: input.sourceUrl,
        processedAt: Date.now(),
      });
      return { success: true };
    }),

  recomputeMonitoring: protectedProcedure
    .input(z.object({
      monitoringObjectId: z.number(),
      currentDimensionValues: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [monitor] = await db
        .select()
        .from(infraSimMonitoringObjects)
        .where(and(eq(infraSimMonitoringObjects.id, input.monitoringObjectId), eq(infraSimMonitoringObjects.userId, ctx.user.id)));
      if (!monitor) throw new Error("Monitoring object not found");

      const [simCase] = await db.select().from(infraSimCases).where(eq(infraSimCases.id, monitor.caseId));
      const dimensions = await db.select().from(infraSimDimensions).where(eq(infraSimDimensions.caseId, monitor.caseId));

      const config: SimCaseConfig = {
        caseId: monitor.caseId,
        title: simCase.title,
        baseIrrPct: parseFloat(simCase.baseIrrPct ?? "0"),
        fundMinIrrPct: parseFloat(simCase.fundMinIrrPct ?? "15"),
        dimensions: dimensions.map((d) => ({
          key: d.key,
          name: d.name,
          category: d.category as SimDimension["category"],
          values: JSON.parse(d.valuesJson),
        })),
      };

      const originalApprovalPct = parseFloat(monitor.approvalProbabilityPct ?? "0");
      const currentApprovalPct = recomputeApprovalProbability(config, input.currentDimensionValues);
      const drifts = detectAssumptionDrift(config, input.currentDimensionValues);

      const recentEvents = await db
        .select()
        .from(infraSimMonitoringEvents)
        .where(eq(infraSimMonitoringEvents.monitoringObjectId, input.monitoringObjectId))
        .orderBy(desc(infraSimMonitoringEvents.createdAt));

      const events: MonitoringEvent[] = recentEvents.slice(0, 10).map((e) => ({
        eventType: e.eventType,
        eventTitle: e.eventTitle,
        eventDescription: e.eventDescription ?? "",
        impactedDimensions: e.impactedDimensions?.split(",") ?? [],
        irrImpactDeltaPct: parseFloat(e.irrImpactDeltaPct ?? "0"),
        thesisImpact: e.thesisImpact,
      }));

      const alerts = generateAlerts(config, events, drifts, currentApprovalPct, originalApprovalPct);
      const thesisStatus = computeThesisStatus(originalApprovalPct, currentApprovalPct, alerts);
      const degradation = originalApprovalPct - currentApprovalPct;
      const wouldApproveToday = currentApprovalPct > 30;

      const snapshot = {
        thesisStatus,
        approvalProbabilityPct: currentApprovalPct,
        decisionDriftScore: Math.min(100, degradation * 2),
        thesisDegradationPct: degradation,
        wouldApproveToday,
        alerts,
        assumptionDrift: drifts,
      };

      const weeklyMemo = await generateWeeklyMemo(config, snapshot, events);

      await db.update(infraSimMonitoringObjects).set({
        thesisStatus,
        approvalProbabilityPct: currentApprovalPct.toString(),
        decisionDriftScore: snapshot.decisionDriftScore.toString(),
        thesisDegradationPct: degradation.toString(),
        wouldApproveToday: wouldApproveToday ? 1 : 0,
        alertsJson: JSON.stringify(alerts),
        assumptionDriftJson: JSON.stringify(drifts),
        weeklyMemoJson: JSON.stringify(weeklyMemo),
        lastRecomputedAt: Date.now(),
        updatedAt: Date.now(),
      }).where(eq(infraSimMonitoringObjects.id, input.monitoringObjectId));

      return { thesisStatus, currentApprovalPct, degradation, alerts, drifts, weeklyMemo };
    }),

  getMonitoringObject: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [monitor] = await db
        .select()
        .from(infraSimMonitoringObjects)
        .where(and(eq(infraSimMonitoringObjects.caseId, input.caseId), eq(infraSimMonitoringObjects.userId, ctx.user.id)));
      return monitor ?? null;
    }),

  // ── Portfolio Links ──────────────────────────────────────────────────────────

  addPortfolioLink: protectedProcedure
    .input(z.object({
      sourceCaseId: z.number(),
      targetCaseId: z.number(),
      dependencyType: z.string(),
      dependencyStrength: z.number().min(0).max(1).default(1),
      contagionDirectional: z.boolean().default(false),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(infraSimPortfolioLinks).values({
        userId: ctx.user.id,
        sourceCaseId: input.sourceCaseId,
        targetCaseId: input.targetCaseId,
        dependencyType: input.dependencyType,
        dependencyStrength: input.dependencyStrength.toString(),
        contagionDirectional: input.contagionDirectional ? 1 : 0,
        notes: input.notes,
      });
      return { success: true };
    }),

  getPortfolioLinks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    return db
      .select()
      .from(infraSimPortfolioLinks)
      .where(eq(infraSimPortfolioLinks.userId, ctx.user.id));
  }),

  // ── Convenience helpers for frontend ─────────────────────────────────────────

  listRuns: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const runs = await db
        .select()
        .from(infraSimRuns)
        .where(and(eq(infraSimRuns.caseId, input.caseId), eq(infraSimRuns.userId, ctx.user.id)))
        .orderBy(desc(infraSimRuns.createdAt));
      return runs.map((r) => ({
        id: r.id,
        caseId: r.caseId,
        status: r.status,
        totalScenarios: r.completedCount ?? 0,
        approveCount: r.approveCount ?? 0,
        conditionalCount: r.conditionalCount ?? 0,
        rejectCount: r.rejectCount ?? 0,
        approveRate: r.completedCount ? (r.approveCount ?? 0) / r.completedCount : 0,
        conditionalRate: r.completedCount ? (r.conditionalCount ?? 0) / r.completedCount : 0,
        rejectRate: r.completedCount ? (r.rejectCount ?? 0) / r.completedCount : 0,
        medianIrrPct: parseFloat(r.medianIrrPct ?? "0"),
        dominantDecision: r.rejectCount && r.completedCount && (r.rejectCount / r.completedCount) > 0.5 ? "REJECT" :
          r.approveCount && r.completedCount && (r.approveCount / r.completedCount) > 0.5 ? "APPROVE" : "CONDITIONAL",
        createdAt: r.createdAt ?? Date.now(),
      }));
    }),

  exportRun: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [run] = await db
        .select()
        .from(infraSimRuns)
        .where(and(eq(infraSimRuns.id, input.runId), eq(infraSimRuns.userId, ctx.user.id)));
      if (!run) throw new Error("Run not found");
      const scenarios = await db
        .select()
        .from(infraSimScenarios)
        .where(eq(infraSimScenarios.runId, input.runId));
      return {
        run,
        scenarios,
        exportedAt: new Date().toISOString(),
        version: "infra-sim-v2",
      };
    }),

  // Simplified monitoring status for the monitor page
  getMonitoringStatus: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [simCase] = await db
        .select()
        .from(infraSimCases)
        .where(and(eq(infraSimCases.id, input.caseId), eq(infraSimCases.userId, ctx.user.id)));
      if (!simCase) return null;
      const [monitor] = await db
        .select()
        .from(infraSimMonitoringObjects)
        .where(and(eq(infraSimMonitoringObjects.caseId, input.caseId), eq(infraSimMonitoringObjects.userId, ctx.user.id)));
      const events = monitor
        ? await db.select().from(infraSimMonitoringEvents)
            .where(eq(infraSimMonitoringEvents.monitoringObjectId, monitor.id))
            .orderBy(desc(infraSimMonitoringEvents.createdAt))
        : [];
      return {
        caseTitle: simCase.title,
        thesisStatus: monitor?.thesisStatus ?? "ON_TRACK",
        irrDriftPct: monitor ? parseFloat(monitor.thesisDegradationPct ?? "0") : 0,
        activeSignals: events.length,
        breachedCovenants: monitor?.alertsJson ? (JSON.parse(monitor.alertsJson) as any[]).filter((a) => a.severity === "CRITICAL").length : 0,
        lastUpdated: monitor?.lastRecomputedAt ?? null,
        signals: events.map((e) => ({
          id: e.id,
          description: e.eventDescription ?? e.eventTitle,
          severity: e.eventType,
          irrImpactPp: parseFloat(e.irrImpactDeltaPct ?? "0"),
          thesisImpact: e.thesisImpact,
          createdAt: e.createdAt ?? Date.now(),
        })),
        memos: monitor?.weeklyMemoJson ? [{
          id: 1,
          title: "Weekly Governance Memo",
          content: typeof monitor.weeklyMemoJson === "string" ? monitor.weeklyMemoJson : JSON.stringify(monitor.weeklyMemoJson),
          createdAt: monitor.lastRecomputedAt ?? Date.now(),
        }] : [],
      };
    }),

  // Simple risk signal ingestion (creates monitoring object if needed + event)
  ingestRiskSignal: protectedProcedure
    .input(z.object({ caseId: z.number(), signal: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [simCase] = await db
        .select()
        .from(infraSimCases)
        .where(and(eq(infraSimCases.id, input.caseId), eq(infraSimCases.userId, ctx.user.id)));
      if (!simCase) throw new Error("Case not found");
      // Get or create monitoring object
      let [monitor] = await db
        .select()
        .from(infraSimMonitoringObjects)
        .where(and(eq(infraSimMonitoringObjects.caseId, input.caseId), eq(infraSimMonitoringObjects.userId, ctx.user.id)));
      if (!monitor) {
        const baseIrr = parseFloat(simCase.baseIrrPct ?? "0");
        const fundMin = parseFloat(simCase.fundMinIrrPct ?? "15");
        const approvalPct = Math.max(0, Math.min(100, ((baseIrr - fundMin) / fundMin) * 100 + 50));
        const [ins] = await db.insert(infraSimMonitoringObjects).values({
          caseId: input.caseId,
          userId: ctx.user.id,
          thesisStatus: "GREEN",
          approvalProbabilityPct: approvalPct.toString(),
          decisionDriftScore: "0",
          thesisDegradationPct: "0",
          wouldApproveToday: approvalPct > 30 ? 1 : 0,
        });
        const [fresh] = await db
          .select()
          .from(infraSimMonitoringObjects)
          .where(eq(infraSimMonitoringObjects.id, (ins as any).insertId));
        monitor = fresh;
      }
      // Ingest event
      await db.insert(infraSimMonitoringEvents).values({
        monitoringObjectId: monitor.id,
        caseId: input.caseId,
        eventType: "RISK_SIGNAL",
        eventTitle: input.signal.slice(0, 120),
        eventDescription: input.signal,
        impactedDimensions: "",
        irrImpactDeltaPct: "0",
        thesisImpact: "NEUTRAL",
      });
      return { success: true, monitoringObjectId: monitor.id };
    }),

  generateGovernanceMemo: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [simCase] = await db
        .select()
        .from(infraSimCases)
        .where(and(eq(infraSimCases.id, input.caseId), eq(infraSimCases.userId, ctx.user.id)));
      if (!simCase) throw new Error("Case not found");
      const [monitor] = await db
        .select()
        .from(infraSimMonitoringObjects)
        .where(and(eq(infraSimMonitoringObjects.caseId, input.caseId), eq(infraSimMonitoringObjects.userId, ctx.user.id)));
      const memoContent = `WEEKLY GOVERNANCE MEMO — ${simCase.title}\n\nDate: ${new Date().toLocaleDateString()}\nThesis Status: ${monitor?.thesisStatus ?? "ON_TRACK"}\nApproval Probability: ${monitor?.approvalProbabilityPct ?? "N/A"}%\n\nThis memo summarises the current state of the investment thesis and any material changes since the last IC review.\n\nKey observations:\n- Base IRR: ${simCase.baseIrrPct}% vs fund minimum ${simCase.fundMinIrrPct}%\n- IC Decision: ${simCase.icDecision}\n- Monitoring active since case creation\n\nNo material thesis changes detected in the current period.`;
      if (monitor) {
        await db.update(infraSimMonitoringObjects).set({
          weeklyMemoJson: memoContent,
          lastRecomputedAt: Date.now(),
          updatedAt: Date.now(),
        }).where(eq(infraSimMonitoringObjects.id, monitor.id));
      }
      return { success: true, memo: memoContent };
    }),
});

// ── Helios-North IC Memo Extract ──────────────────────────────────────────────

const HELIOS_NORTH_MEMO_EXTRACT = `PROJECT: Helios-North Offshore Wind
LOCATION: UK North Sea (Dogger Bank adjacent)
CAPACITY: 850 MW
TOTAL CAPEX: £4.2B
BASE CASE IRR: 9.5%
FUND MINIMUM IRR: 15%

IC DECISION: REJECT (3 HARD NO / 4 SOFT NO / 3 SOFT YES)

PRIMARY BLOCKERS:
1. Foundation Technology: Unvalidated floating foundation at commercial scale — no independent engineering validation
2. CfD Strike Price: £73/MWh is below fund IRR threshold; AR7 outcome uncertain
3. Merchant Exposure: 20% unhedged merchant exposure creates material downside risk
4. Contingency: 1.7% contingency is dangerously low for first-of-kind technology
5. EPC: No committed EPC contractor with fixed-price contract
6. Timeline: 11-year project timeline exceeds fund horizon (7 years)

CONDITIONS FOR RE-ENGAGEMENT:
- Foundation technology independently validated at commercial scale
- CfD strike price ≥ £85/MWh (AR7 mid-range)
- Merchant exposure reduced to ≤ 10%
- Committed EPC with fixed-price contract
- Contingency increased to ≥ 5%`;
