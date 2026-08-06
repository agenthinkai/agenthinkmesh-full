/**
 * lpTwinScenario.ts — WP5 Fund-Term Laboratory and Fundraising Scenario Engine
 *
 * All procedures are enterprise-scoped (orgId from ctx, never from client input).
 * All computations are deterministic — no LLM calls for recomputation.
 *
 * DISCLAIMER: Scenarios test defined assumptions rather than predict markets.
 * Improved synthetic LP fit does not guarantee investment.
 * Fund-term changes may have adverse GP economics or legal consequences.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, isNull } from "drizzle-orm";
import { router } from "../_core/trpc";
import { enterpriseProcedure } from "../_core/orgMiddleware";
import { getDb } from "../db";
import {
  lpTwinFunds,
  lpTwinSessions,
  lpTwinSegmentResults,
  lpTwinScenarios,
  lpTwinScenarioResults,
  lpTwinExports,
  InsertLpTwinScenario,
  InsertLpTwinScenarioResult,
} from "../../drizzle/schema";
import {
  buildFundProfileFromDb,
  applyProposedTerms,
  computeSegmentScenario,
  analyseTermImpacts,
  generateFundraisingSequence,
  runSensitivityAnalysis,
  generateFundConfigRecommendation,
  applyMarketStress,
  computeAllocatorFit,
  SCENARIO_ENGINE_VERSION,
  FundraisingObjective,
  SequenceTemplate,
  MarketStressCondition,
  ProposedTerms,
  OBJECTIVE_WEIGHT_PROFILES,
  MARKET_STRESS_DEFINITIONS,
  LP_AGENT_BANK,
  getAgentById,
  FIT_ENGINE_VERSION,
  LP_AGENT_BANK_VERSION,
  OBJECTION_ENGINE_VERSION,
} from "../../shared/captwin";

const DISCLAIMER = "SYNTHETIC SIMULATION — Scenarios test defined assumptions rather than predict markets. Improved synthetic LP fit does not guarantee investment. Fund-term changes may have adverse GP economics or legal consequences. CapTwin does not replace placement, legal, tax or regulatory advice.";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertFundOwnership(db: Awaited<ReturnType<typeof getDb>>, fundId: number, orgId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [fund] = await db.select().from(lpTwinFunds)
    .where(and(eq(lpTwinFunds.id, fundId), eq(lpTwinFunds.orgId, orgId), isNull(lpTwinFunds.archivedAt)))
    .limit(1);
  if (!fund) throw new TRPCError({ code: "NOT_FOUND", message: "Fund not found or access denied" });
  return fund;
}

async function assertScenarioOwnership(db: Awaited<ReturnType<typeof getDb>>, scenarioId: number, orgId: number) {
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [scenario] = await db.select().from(lpTwinScenarios)
    .where(and(eq(lpTwinScenarios.id, scenarioId), eq(lpTwinScenarios.orgId, orgId)))
    .limit(1);
  if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found or access denied" });
  return scenario;
}

const ProposedTermsInput = z.object({
  managementFeePct: z.number().min(0).max(5).optional(),
  carryPct: z.number().min(0).max(50).optional(),
  hurdleRatePct: z.number().min(0).max(20).optional(),
  catchUpPct: z.number().min(0).max(100).optional(),
  gpCommitmentPct: z.number().min(0).max(20).optional(),
  targetFundSizeM: z.number().min(1).max(100000).optional(),
  firstCloseTargetM: z.number().min(1).optional(),
  fundTermYrs: z.number().min(3).max(20).optional(),
  investmentPeriodYrs: z.number().min(1).max(10).optional(),
  extensionProvisionsYrs: z.number().min(0).max(5).optional(),
  recyclingProvisions: z.boolean().optional(),
  minLpCommitmentM: z.number().min(0.1).optional(),
  assetClass: z.string().optional(),
  sectorConcentration: z.string().optional(),
  geographicConcentration: z.string().optional(),
  targetReturnPct: z.number().min(0).max(100).optional(),
  targetIrrPct: z.number().min(0).max(100).optional(),
  targetMultiple: z.number().min(1).max(20).optional(),
  incomeYieldPct: z.number().min(0).max(30).optional(),
  numPortfolioInvestments: z.number().min(1).max(200).optional(),
  avgInvestmentSizeM: z.number().min(0.1).optional(),
  coInvestmentRights: z.string().optional(),
  advisoryCommitteeRights: z.boolean().optional(),
  mfnTerms: z.boolean().optional(),
  reportingFrequency: z.string().optional(),
  transparencyLevel: z.string().optional(),
  liquidityProvisions: z.string().optional(),
  keyPersonProvisions: z.boolean().optional(),
  shariaCompliant: z.boolean().optional(),
  esgFramework: z.string().optional(),
  sfdrClassification: z.string().optional(),
  domicile: z.string().optional(),
  currency: z.string().optional(),
  leveragePolicy: z.string().optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const lpTwinScenarioRouter = router({
  // 1. createScenario — create a new scenario record
  createScenario: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      scenarioName: z.string().min(1).max(256),
      scenarioType: z.enum(["term_change", "market_stress", "fundraising_objective", "sensitivity", "custom"]).default("term_change"),
      proposedTerms: ProposedTermsInput,
      assumptions: z.record(z.string(), z.unknown()).optional(),
      marketConditions: z.array(z.string()).optional(),
      fundraisingObjective: z.string().optional(),
      sequenceTemplate: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);
      const now = Date.now();
      const payload: InsertLpTwinScenario = {
        orgId: ctx.orgId,
        fundId: input.fundId,
        baseFundVersion: fund.version,
        createdByUserId: ctx.user.id,
        scenarioName: input.scenarioName,
        scenarioType: input.scenarioType,
        changedFieldsJson: JSON.stringify(input.proposedTerms),
        assumptionsJson: input.assumptions ? JSON.stringify(input.assumptions) : undefined,
        marketConditionsJson: input.marketConditions ? JSON.stringify(input.marketConditions) : undefined,
        fundraisingObjective: input.fundraisingObjective,
        sequenceTemplate: input.sequenceTemplate,
        engineVersion: FIT_ENGINE_VERSION,
        registryVersion: LP_AGENT_BANK_VERSION,
        objectionEngineVersion: OBJECTION_ENGINE_VERSION,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      const [result] = await db.insert(lpTwinScenarios).values(payload);
      const scenarioId = (result as { insertId: number }).insertId;
      return { scenarioId, message: "Scenario created" };
    }),

  // 2. listScenarios — list scenarios for a fund
  listScenarios: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive().optional(),
      includeArchived: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conditions = [eq(lpTwinScenarios.orgId, ctx.orgId)];
      if (input.fundId) conditions.push(eq(lpTwinScenarios.fundId, input.fundId));
      if (!input.includeArchived) conditions.push(isNull(lpTwinScenarios.archivedAt));
      const scenarios = await db.select().from(lpTwinScenarios).where(and(...conditions)).limit(50);
      return { scenarios };
    }),

  // 3. getScenario — get scenario with results
  getScenario: enterpriseProcedure
    .input(z.object({ scenarioId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
      const results = await db.select().from(lpTwinScenarioResults)
        .where(and(eq(lpTwinScenarioResults.scenarioId, input.scenarioId), eq(lpTwinScenarioResults.orgId, ctx.orgId)));
      return { scenario, results };
    }),

  // 4. computeScenario — live recomputation: run all segments against proposed terms
  computeScenario: enterpriseProcedure
    .input(z.object({
      scenarioId: z.number().int().positive(),
      segmentIds: z.array(z.string()).min(1).max(9).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
      const fund = await assertFundOwnership(db, scenario.fundId, ctx.orgId);

      const baseFund = buildFundProfileFromDb(fund);
      const proposedTerms = JSON.parse(scenario.changedFieldsJson) as ProposedTerms;
      const proposedFund = applyProposedTerms(baseFund, proposedTerms);

      const targetAgents = input.segmentIds
        ? input.segmentIds.map((id) => getAgentById(id)).filter(Boolean)
        : LP_AGENT_BANK;

      const segmentResults = targetAgents.map((agent) => {
        if (!agent) return null;
        return computeSegmentScenario(baseFund, proposedFund, agent);
      }).filter(Boolean) as ReturnType<typeof computeSegmentScenario>[];

      const termImpacts = analyseTermImpacts(baseFund, proposedFund, proposedTerms, segmentResults);

      // Persist results
      const now = Date.now();
      await db.delete(lpTwinScenarioResults)
        .where(and(eq(lpTwinScenarioResults.scenarioId, input.scenarioId), eq(lpTwinScenarioResults.orgId, ctx.orgId)));

      for (const r of segmentResults) {
        const row: InsertLpTwinScenarioResult = {
          orgId: ctx.orgId,
          scenarioId: input.scenarioId,
          segmentId: r.segmentId,
          baseFitScore: String(r.baseFitScore),
          scenarioFitScore: String(r.scenarioFitScore),
          scoreDelta: String(r.scoreDelta),
          baseCategory: r.baseCategory,
          scenarioCategory: r.scenarioCategory,
          objectionsAddedJson: JSON.stringify(r.objectionsAdded),
          objectionsResolvedJson: JSON.stringify(r.objectionsResolved),
          confidenceDelta: String(r.confidenceDelta),
          priorityDelta: r.priorityChanged ? `${r.baseOutreachPriority} → ${r.scenarioOutreachPriority}` : undefined,
          dimensionDeltasJson: JSON.stringify(r.dimensionDeltas),
          evidenceGapsJson: JSON.stringify(r.evidenceGaps),
          outreachPriority: r.scenarioOutreachPriority,
          modelVersion: FIT_ENGINE_VERSION,
          createdAt: now,
        };
        await db.insert(lpTwinScenarioResults).values(row);
      }

      // Update scenario status
      await db.update(lpTwinScenarios)
        .set({ status: "computed", updatedAt: now })
        .where(eq(lpTwinScenarios.id, input.scenarioId));

      const avgScenarioScore = segmentResults.length > 0
        ? Math.round(segmentResults.reduce((s, r) => s + r.scenarioFitScore, 0) / segmentResults.length * 10) / 10
        : 0;
      const avgBasScore = segmentResults.length > 0
        ? Math.round(segmentResults.reduce((s, r) => s + r.baseFitScore, 0) / segmentResults.length * 10) / 10
        : 0;

      return {
        scenarioId: input.scenarioId,
        segmentsComputed: segmentResults.length,
        avgBaseScore: avgBasScore,
        avgScenarioScore,
        avgScoreDelta: Math.round((avgScenarioScore - avgBasScore) * 10) / 10,
        strongFitBase: segmentResults.filter((r) => r.baseFitScore >= 70).length,
        strongFitScenario: segmentResults.filter((r) => r.scenarioFitScore >= 70).length,
        termImpacts,
        segmentResults,
        disclaimer: DISCLAIMER,
      };
    }),

  // 5. previewScenario — live preview without persisting (for interactive laboratory)
  previewScenario: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      proposedTerms: ProposedTermsInput,
      segmentIds: z.array(z.string()).min(1).max(9).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);

      const baseFund = buildFundProfileFromDb(fund);
      const proposedFund = applyProposedTerms(baseFund, input.proposedTerms);

      const targetAgents = input.segmentIds
        ? input.segmentIds.map((id) => getAgentById(id)).filter(Boolean)
        : LP_AGENT_BANK;

      const segmentResults = targetAgents.map((agent) => {
        if (!agent) return null;
        return computeSegmentScenario(baseFund, proposedFund, agent);
      }).filter(Boolean) as ReturnType<typeof computeSegmentScenario>[];

      const termImpacts = analyseTermImpacts(baseFund, proposedFund, input.proposedTerms, segmentResults);

      return {
        segmentResults,
        termImpacts,
        avgScoreDelta: segmentResults.length > 0
          ? Math.round(segmentResults.reduce((s, r) => s + r.scoreDelta, 0) / segmentResults.length * 10) / 10
          : 0,
        disclaimer: DISCLAIMER,
      };
    }),

  // 6. archiveScenario
  archiveScenario: enterpriseProcedure
    .input(z.object({ scenarioId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
      await db.update(lpTwinScenarios)
        .set({ archivedAt: Date.now(), status: "archived", updatedAt: Date.now() })
        .where(eq(lpTwinScenarios.id, input.scenarioId));
      return { message: "Scenario archived" };
    }),

  // 7. saveScenarioAs — save as scenario_only, new_fund_version, or duplicated_fund
  saveScenarioAs: enterpriseProcedure
    .input(z.object({
      scenarioId: z.number().int().positive(),
      saveAs: z.enum(["scenario_only", "new_fund_version", "duplicated_fund"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
      const fund = await assertFundOwnership(db, scenario.fundId, ctx.orgId);
      const proposedTerms = JSON.parse(scenario.changedFieldsJson) as ProposedTerms;
      const now = Date.now();
      let savedFundId: number | undefined;

      if (input.saveAs === "new_fund_version") {
        // Increment fund version and apply proposed terms
        const updates: Record<string, unknown> = { version: fund.version + 1, updatedByUserId: ctx.user.id, updatedAt: now };
        if (proposedTerms.managementFeePct !== undefined || proposedTerms.carryPct !== undefined || proposedTerms.gpCommitmentPct !== undefined) {
          const econ = JSON.parse(fund.economicsJson) as Record<string, unknown>;
          if (proposedTerms.managementFeePct !== undefined) econ.managementFeePct = proposedTerms.managementFeePct;
          if (proposedTerms.carryPct !== undefined) econ.carryPct = proposedTerms.carryPct;
          if (proposedTerms.gpCommitmentPct !== undefined) econ.gpCommitmentPct = proposedTerms.gpCommitmentPct;
          updates.economicsJson = JSON.stringify(econ);
        }
        if (proposedTerms.targetFundSizeM !== undefined) updates.targetFundSizeM = String(proposedTerms.targetFundSizeM);
        if (proposedTerms.shariaCompliant !== undefined) {
          const prop = JSON.parse(fund.investmentPropositionJson ?? "{}") as Record<string, unknown>;
          prop.shariaCompliant = proposedTerms.shariaCompliant;
          updates.investmentPropositionJson = JSON.stringify(prop);
        }
        await db.update(lpTwinFunds).set(updates).where(eq(lpTwinFunds.id, fund.id));
        savedFundId = fund.id;
      } else if (input.saveAs === "duplicated_fund") {
        // Create a new fund with proposed terms applied
        const baseFund = buildFundProfileFromDb(fund);
        const proposed = applyProposedTerms(baseFund, proposedTerms);
        const [result] = await db.insert(lpTwinFunds).values({
          orgId: ctx.orgId,
          createdByUserId: ctx.user.id,
          updatedByUserId: ctx.user.id,
          fundName: `${fund.fundName} — Scenario: ${scenario.scenarioName}`,
          gpName: fund.gpName,
          strategy: fund.strategy,
          assetClass: proposed.assetClass ?? fund.assetClass ?? undefined,
          geography: proposed.geography ?? fund.geography ?? undefined,
          domicile: proposed.domicile ?? fund.domicile ?? undefined,
          currency: proposed.currency ?? fund.currency,
          targetFundSizeM: String(proposed.targetFundSizeM ?? fund.targetFundSizeM),
          economicsJson: JSON.stringify({ managementFeePct: proposed.managementFeePct, carryPct: proposed.carryPct, gpCommitmentPct: proposed.gpCommitmentPct }),
          investmentPropositionJson: JSON.stringify({ shariaCompliant: proposed.shariaCompliant, esgPolicy: proposed.esgPolicy, coInvestmentRights: proposed.coInvestmentRights }),
          trackRecordJson: fund.trackRecordJson,
          evidenceStatus: "draft",
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
        savedFundId = (result as { insertId: number }).insertId;
      }

      await db.update(lpTwinScenarios)
        .set({ savedAs: input.saveAs, savedFundId, updatedAt: now })
        .where(eq(lpTwinScenarios.id, input.scenarioId));

      return { savedAs: input.saveAs, savedFundId, message: `Scenario saved as ${input.saveAs}` };
    }),

  // 8. generateSequence — fundraising sequence engine
  generateSequence: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      scenarioId: z.number().int().positive().optional(),
      objective: z.enum(["fastest_first_close", "largest_tickets", "strongest_reference", "highest_engagement_probability", "islamic_capital_priority", "geographic_diversification", "lowest_diligence_complexity", "emerging_manager_friendly", "best_reup_potential", "balanced"]),
      template: z.enum(["existing_relationships_first", "fastest_decision_makers_first", "largest_tickets_first", "strategic_reference_first", "islamic_capital_first", "diversified_global"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);

      let fundProfile = buildFundProfileFromDb(fund);
      if (input.scenarioId) {
        const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
        const proposedTerms = JSON.parse(scenario.changedFieldsJson) as ProposedTerms;
        fundProfile = applyProposedTerms(fundProfile, proposedTerms);
      }

      // Compute fit results for all segments
      const fitResults = new Map<string, ReturnType<typeof computeAllocatorFit>>();
      for (const agent of LP_AGENT_BANK) {
        fitResults.set(agent.id, computeAllocatorFit(fundProfile, agent));
      }

      const sequence = generateFundraisingSequence(fundProfile, fitResults, input.objective as FundraisingObjective, input.template as SequenceTemplate);
      const weights = OBJECTIVE_WEIGHT_PROFILES[input.objective as FundraisingObjective];

      return {
        sequence,
        objectiveWeights: weights,
        weightingRationale: `Objective: ${input.objective}. All weights are documented and transparent. No hidden scoring.`,
        disclaimer: DISCLAIMER,
      };
    }),

  // 9. runMarketStress — apply market stress conditions to base or scenario fund
  runMarketStress: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      scenarioId: z.number().int().positive().optional(),
      conditions: z.array(z.string()).min(1).max(12),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);

      let fundProfile = buildFundProfileFromDb(fund);
      if (input.scenarioId) {
        const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
        const proposedTerms = JSON.parse(scenario.changedFieldsJson) as ProposedTerms;
        fundProfile = applyProposedTerms(fundProfile, proposedTerms);
      }

      const baseResults = new Map<string, ReturnType<typeof computeAllocatorFit>>();
      for (const agent of LP_AGENT_BANK) {
        baseResults.set(agent.id, computeAllocatorFit(fundProfile, agent));
      }

      const validConditions = input.conditions.filter((c) => c in MARKET_STRESS_DEFINITIONS) as MarketStressCondition[];
      const stressedResults = applyMarketStress(baseResults, validConditions);

      const conditionDetails = validConditions.map((c) => ({
        condition: c,
        ...MARKET_STRESS_DEFINITIONS[c],
      }));

      const segmentComparison = LP_AGENT_BANK.map((agent) => {
        const base = baseResults.get(agent.id);
        const stressed = stressedResults.get(agent.id);
        return {
          segmentId: agent.id,
          segmentName: agent.name,
          baseFitScore: base?.overallFitScore ?? 0,
          stressedFitScore: stressed?.adjustedScore ?? base?.overallFitScore ?? 0,
          scoreDelta: (stressed?.adjustedScore ?? base?.overallFitScore ?? 0) - (base?.overallFitScore ?? 0),
          adjustments: stressed?.adjustments ?? [],
        };
      });

      return {
        conditions: validConditions,
        conditionDetails,
        segmentComparison,
        disclaimer: "SCENARIO ASSUMPTION — Market stress scenarios test defined assumptions. They are not market forecasts. " + DISCLAIMER,
      };
    }),

  // 10. runSensitivity — sensitivity analysis for one variable
  runSensitivity: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      field: z.string(),
      minValue: z.number(),
      maxValue: z.number(),
      steps: z.number().int().min(3).max(20).default(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);
      const baseFund = buildFundProfileFromDb(fund);

      const analysis = runSensitivityAnalysis(
        baseFund,
        input.field as keyof ProposedTerms,
        input.minValue,
        input.maxValue,
        input.steps,
      );

      return { analysis, disclaimer: DISCLAIMER };
    }),

  // 11. getRecommendedConfig — evidence-based fund configuration recommendation
  getRecommendedConfig: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      scenarioId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);

      let fundProfile = buildFundProfileFromDb(fund);
      if (input.scenarioId) {
        const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
        const proposedTerms = JSON.parse(scenario.changedFieldsJson) as ProposedTerms;
        fundProfile = applyProposedTerms(fundProfile, proposedTerms);
      }

      const fitResults = new Map<string, ReturnType<typeof computeAllocatorFit>>();
      for (const agent of LP_AGENT_BANK) {
        fitResults.set(agent.id, computeAllocatorFit(fundProfile, agent));
      }

      const recommendation = generateFundConfigRecommendation(fundProfile, fitResults);

      return { recommendation, disclaimer: DISCLAIMER };
    }),

  // 12. askLpScenario — Ask-an-LP with scenario comparison (WP5K)
  askLpScenario: enterpriseProcedure
    .input(z.object({
      fundId: z.number().int().positive(),
      scenarioId: z.number().int().positive(),
      segmentId: z.string(),
      question: z.string().min(10).max(1000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const fund = await assertFundOwnership(db, input.fundId, ctx.orgId);
      const scenario = await assertScenarioOwnership(db, input.scenarioId, ctx.orgId);
      const agent = getAgentById(input.segmentId);
      if (!agent) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown segment ID: ${input.segmentId}` });

      const baseFund = buildFundProfileFromDb(fund);
      const proposedTerms = JSON.parse(scenario.changedFieldsJson) as ProposedTerms;
      const proposedFund = applyProposedTerms(baseFund, proposedTerms);

      const baseResult = computeAllocatorFit(baseFund, agent);
      const scenarioResult = computeAllocatorFit(proposedFund, agent);
      const comparison = computeSegmentScenario(baseFund, proposedFund, agent);

      const response = `[${agent.name} — Scenario Comparison]

Base Fund: ${baseResult.overallFitScore}/100 (${baseResult.fitCategory})
Proposed Scenario: ${scenarioResult.overallFitScore}/100 (${scenarioResult.fitCategory})
Score Delta: ${comparison.scoreDelta > 0 ? "+" : ""}${comparison.scoreDelta} points

${comparison.objectionsResolved.length > 0 ? `Objections resolved by proposed changes: ${comparison.objectionsResolved.map((o) => o.category).join(", ")}` : "No objections resolved by proposed changes."}
${comparison.objectionsAdded.length > 0 ? `New objections from proposed changes: ${comparison.objectionsAdded.map((o) => o.category).join(", ")}` : "No new objections from proposed changes."}

Regarding your question: "${input.question}"

Based on the deterministic analysis, the proposed changes ${comparison.scoreDelta > 2 ? "improve" : comparison.scoreDelta < -2 ? "reduce" : "do not materially change"} fit with this allocator archetype. ${baseResult.principalFitReasons?.[0] ?? ""} ${comparison.eligibilityChanged ? (comparison.scenarioEligible ? "The proposed terms make this fund eligible for consideration." : "The proposed terms make this fund ineligible.") : ""}

This response is grounded in deterministic scoring. The narrative does not override the quantitative comparison above.

SYNTHETIC SIMULATION — This response is from an anonymised institutional archetype and is not a prediction of real allocator behaviour.`;

      return {
        segmentId: input.segmentId,
        segmentName: agent.name,
        question: input.question,
        response,
        baseScore: baseResult.overallFitScore,
        scenarioScore: scenarioResult.overallFitScore,
        scoreDelta: comparison.scoreDelta,
        objectionsResolved: comparison.objectionsResolved.length,
        objectionsAdded: comparison.objectionsAdded.length,
        engineVersion: FIT_ENGINE_VERSION,
        scenarioEngineVersion: SCENARIO_ENGINE_VERSION,
        disclaimer: DISCLAIMER,
      };
    }),

  // 13. exportScenarioComparison — export with full audit record
  exportScenarioComparison: enterpriseProcedure
    .input(z.object({
      scenarioIds: z.array(z.number().int().positive()).min(1).max(4),
      exportType: z.enum(["json", "csv"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const scenarios = await Promise.all(input.scenarioIds.map((id) => assertScenarioOwnership(db!, id, ctx.orgId)));
      const allResults = await Promise.all(scenarios.map((s) =>
        db!.select().from(lpTwinScenarioResults)
          .where(and(eq(lpTwinScenarioResults.scenarioId, s.id), eq(lpTwinScenarioResults.orgId, ctx.orgId)))
      ));

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedByUserId: ctx.user.id,
        orgId: ctx.orgId,
        disclaimer: DISCLAIMER,
        scenarios: scenarios.map((s, i) => ({
          id: s.id,
          name: s.scenarioName,
          type: s.scenarioType,
          changedFields: JSON.parse(s.changedFieldsJson),
          engineVersion: s.engineVersion,
          registryVersion: s.registryVersion,
          objectionEngineVersion: s.objectionEngineVersion,
          status: s.status,
          results: allResults[i].map((r) => ({
            segmentId: r.segmentId,
            baseFitScore: Number(r.baseFitScore),
            scenarioFitScore: Number(r.scenarioFitScore),
            scoreDelta: Number(r.scoreDelta),
            baseCategory: r.baseCategory,
            scenarioCategory: r.scenarioCategory,
            objectionsAdded: r.objectionsAddedJson ? JSON.parse(r.objectionsAddedJson) : [],
            objectionsResolved: r.objectionsResolvedJson ? JSON.parse(r.objectionsResolvedJson) : [],
          })),
        })),
      };

      // Write audit record
      const now = Date.now();
      await db.insert(lpTwinExports).values({
        orgId: ctx.orgId,
        sessionId: 0, // no session for scenario export
        exportedByUserId: ctx.user.id,
        exportType: input.exportType,
        reportType: "full_session",
        createdAt: now,
      });

      let csvData: string | null = null;
      if (input.exportType === "csv") {
        const headers = ["scenarioName", "segmentId", "baseFitScore", "scenarioFitScore", "scoreDelta", "baseCategory", "scenarioCategory"];
        const rows: string[] = [headers.join(",")];
        for (const s of exportData.scenarios) {
          for (const r of s.results) {
            rows.push([s.name, r.segmentId, r.baseFitScore, r.scenarioFitScore, r.scoreDelta, r.baseCategory ?? "", r.scenarioCategory].map(String).join(","));
          }
        }
        csvData = rows.join("\n");
      }

      return { exportData, csvData, exportType: input.exportType, message: "Scenario comparison exported. Audit record written." };
    }),

  // 14. listObjectives — return all objectives with weights (transparent)
  listObjectives: enterpriseProcedure
    .query(() => {
      return {
        objectives: Object.entries(OBJECTIVE_WEIGHT_PROFILES).map(([key, weights]) => ({
          id: key,
          weights,
        })),
        marketStressConditions: Object.entries(MARKET_STRESS_DEFINITIONS).map(([key, def]) => ({
          id: key,
          label: def.label,
          description: def.description,
          affectedSegments: def.affectedSegments,
        })),
      };
    }),
});

export type LpTwinScenarioRouter = typeof lpTwinScenarioRouter;
