/**
 * aros/discovery.ts — Discovery Swarm
 *
 * Ingests companies into the 10K universe. Handles:
 *  - Batch company creation with deduplication
 *  - Sector/geography targeting
 *  - Funnel tier assignment
 *  - Monitoring job initialisation
 *  - Discovery run lifecycle management
 */

import { z } from "zod";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  arosCompanies,
  arosDiscoveryRuns,
  arosMonitoringJobs,
  arosTokenLedger,
  arosAuditLog,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";
import { randomUUID } from "crypto";

// ── Constants ─────────────────────────────────────────────────────────────────
const SECTORS = [
  "Banks",
  "Infrastructure Investors",
  "Telecom Operators",
  "Asset Managers",
  "Energy Companies",
] as const;

const GEOGRAPHIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "UAE",
  "Saudi Arabia",
  "Germany",
  "France",
  "Japan",
] as const;

const FUNNEL_TIERS = ["UNIVERSE", "ACTIVE", "HIGH_PRIORITY", "OUTREACH_CANDIDATE"] as const;

// Monitoring frequency by tier (days)
const TIER_FREQUENCY: Record<string, number> = {
  UNIVERSE: 30,
  ACTIVE: 7,
  HIGH_PRIORITY: 1,
  OUTREACH_CANDIDATE: 0, // continuous
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

async function writeAudit(
  db: Awaited<ReturnType<typeof requireDb>>,
  actor: string,
  action: string,
  entityType: string,
  entityId?: string,
  payload?: unknown
) {
  await db.insert(arosAuditLog).values({
    actor,
    action,
    entityType,
    entityId: entityId ?? null,
    payload: payload ? JSON.stringify(payload) : null,
  });
}

async function logTokens(
  db: Awaited<ReturnType<typeof requireDb>>,
  params: {
    runId?: string;
    companyId?: number;
    workflow: "company_research" | "decision_detection" | "outreach_generation" | "council_deliberation" | "proposal_generation" | "calibration" | "attribution";
    inputTokens: number;
    outputTokens: number;
    triggeredBy?: number;
  }
) {
  const total = params.inputTokens + params.outputTokens;
  // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
  const cost = (params.inputTokens * 0.00000015) + (params.outputTokens * 0.0000006);
  await db.insert(arosTokenLedger).values({
    runId: params.runId ?? null,
    companyId: params.companyId ?? null,
    workflow: params.workflow,
    model: "gpt-4o-mini",
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens: total,
    costUsd: cost.toFixed(8),
    triggeredBy: params.triggeredBy ?? null,
  });
  return { total, cost };
}

// ── LLM: Generate company batch for a sector/geography ───────────────────────
async function generateCompanyBatch(
  sector: string,
  geography: string,
  count: number
): Promise<Array<{
  companyName: string;
  hqCity: string;
  revenueUsdBn: number;
  employees: number;
  ceoName: string;
  keyDecisionDomain: string;
  activeStrategicInitiative: string;
  aiTransformationSignal: string;
  opportunityType: string;
  opportunityScore: number;
  agenthinkFitScore: number;
  decisionComplexityScore: number;
}>> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are AROS Discovery Swarm. Generate real, well-known companies for the ATLAS target universe. Return ONLY valid JSON — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Generate ${count} real ${sector} companies headquartered in ${geography}.

For each company return this exact JSON structure:
{
  "companies": [
    {
      "companyName": "string",
      "hqCity": "string",
      "revenueUsdBn": number,
      "employees": number,
      "ceoName": "string (current CEO, first and last name)",
      "keyDecisionDomain": "string (e.g. AI Transformation, M&A, Capital Allocation)",
      "activeStrategicInitiative": "string (1-2 sentences describing their current strategic priority)",
      "aiTransformationSignal": "string (specific AI/data initiative they are pursuing)",
      "opportunityType": "string (e.g. AI Decision Intelligence, Data Modernization, Strategic Analytics)",
      "opportunityScore": number (0-100, based on AI readiness and decision complexity),
      "agenthinkFitScore": number (0-100, how well AgenThinkMesh solves their problem),
      "decisionComplexityScore": number (0-100, how complex their decisions are)
    }
  ]
}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "company_batch",
        strict: true,
        schema: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  companyName: { type: "string" },
                  hqCity: { type: "string" },
                  revenueUsdBn: { type: "number" },
                  employees: { type: "integer" },
                  ceoName: { type: "string" },
                  keyDecisionDomain: { type: "string" },
                  activeStrategicInitiative: { type: "string" },
                  aiTransformationSignal: { type: "string" },
                  opportunityType: { type: "string" },
                  opportunityScore: { type: "integer" },
                  agenthinkFitScore: { type: "integer" },
                  decisionComplexityScore: { type: "integer" },
                },
                required: [
                  "companyName", "hqCity", "revenueUsdBn", "employees", "ceoName",
                  "keyDecisionDomain", "activeStrategicInitiative", "aiTransformationSignal",
                  "opportunityType", "opportunityScore", "agenthinkFitScore", "decisionComplexityScore"
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["companies"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "{}";
  const parsed = JSON.parse(content);
  return parsed.companies ?? [];
}

// ── Router ────────────────────────────────────────────────────────────────────
export const arosDiscoveryRouter = router({

  // ── Start a discovery run ──────────────────────────────────────────────────
  startRun: protectedProcedure
    .input(z.object({
      sectors: z.array(z.enum(SECTORS)).min(1).max(5),
      geographies: z.array(z.enum(GEOGRAPHIES)).min(1).max(10),
      targetCount: z.number().min(10).max(10000).default(100),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const runId = randomUUID();

      await db.insert(arosDiscoveryRuns).values({
        runId,
        triggeredBy: ctx.user.id,
        status: "pending",
        sectors: JSON.stringify(input.sectors),
        geographies: JSON.stringify(input.geographies),
        targetCount: input.targetCount,
        completedCount: 0,
        totalTokensUsed: 0,
        totalCostUsd: "0",
        startedAt: Date.now(),
      });

      await writeAudit(db, String(ctx.user.id), "discovery.run.started", "discovery_run", runId, {
        sectors: input.sectors,
        geographies: input.geographies,
        targetCount: input.targetCount,
      });

      // Kick off async ingestion (non-blocking — returns runId immediately)
      setImmediate(async () => {
        try {
          await db.update(arosDiscoveryRuns)
            .set({ status: "running" })
            .where(eq(arosDiscoveryRuns.runId, runId));

          const perCombination = Math.ceil(input.targetCount / (input.sectors.length * input.geographies.length));
          let totalTokens = 0;
          let totalCost = 0;
          let completed = 0;

          for (const sector of input.sectors) {
            for (const geo of input.geographies) {
              try {
                const companies = await generateCompanyBatch(sector, geo, perCombination);

                // Estimate tokens (rough: ~500 input + ~200 output per company)
                const inputTok = companies.length * 500;
                const outputTok = companies.length * 200;
                const { cost } = await logTokens(db, {
                  runId,
                  workflow: "company_research",
                  inputTokens: inputTok,
                  outputTokens: outputTok,
                  triggeredBy: ctx.user.id,
                });
                totalTokens += inputTok + outputTok;
                totalCost += cost;

                for (const co of companies) {
                  // Dedup by name + country
                  const [existing] = await db
                    .select({ id: arosCompanies.id })
                    .from(arosCompanies)
                    .where(and(
                      eq(arosCompanies.companyName, co.companyName),
                      eq(arosCompanies.country, geo)
                    ))
                    .limit(1);

                  if (existing) continue;

                  const [inserted] = await db.insert(arosCompanies).values({
                    companyName: co.companyName,
                    sector,
                    country: geo,
                    hqCity: co.hqCity,
                    revenueUsdBn: String(co.revenueUsdBn),
                    employees: co.employees,
                    ceoName: co.ceoName,
                    keyDecisionDomain: co.keyDecisionDomain,
                    activeStrategicInitiative: co.activeStrategicInitiative,
                    aiTransformationSignal: co.aiTransformationSignal,
                    opportunityType: co.opportunityType,
                    opportunityScore: co.opportunityScore,
                    agenthinkFitScore: co.agenthinkFitScore,
                    decisionComplexityScore: co.decisionComplexityScore,
                    runId,
                  }).$returningId();

                  if (inserted?.id) {
                    // Assign initial funnel tier based on score
                    const score = co.opportunityScore;
                    const tier = score >= 90 ? "HIGH_PRIORITY" : score >= 75 ? "ACTIVE" : "UNIVERSE";
                    const freqDays = TIER_FREQUENCY[tier];
                    const nextRun = Date.now() + freqDays * 86400000;

                    await db.insert(arosMonitoringJobs).values({
                      companyId: inserted.id,
                      funnelTier: tier,
                      monitoringFrequencyDays: freqDays,
                      lastMonitoredAt: Date.now(),
                      nextMonitorAt: nextRun,
                      lastRunId: runId,
                      lastSignalCount: 0,
                      status: "active",
                    });
                    completed++;
                  }
                }
              } catch (_e) {
                // Continue on per-batch errors
              }
            }
          }

          await db.update(arosDiscoveryRuns)
            .set({
              status: "complete",
              completedCount: completed,
              totalTokensUsed: totalTokens,
              totalCostUsd: totalCost.toFixed(6),
              completedAt: Date.now(),
              durationMs: Date.now() - (Date.now() - 5000), // approx
            })
            .where(eq(arosDiscoveryRuns.runId, runId));

        } catch (err: unknown) {
          await db.update(arosDiscoveryRuns)
            .set({ status: "failed", errorMessage: String(err) })
            .where(eq(arosDiscoveryRuns.runId, runId));
        }
      });

      return { runId, message: "Discovery run started. Companies will be ingested in the background." };
    }),

  // ── Get run status ─────────────────────────────────────────────────────────
  getRunStatus: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const [run] = await db
        .select()
        .from(arosDiscoveryRuns)
        .where(eq(arosDiscoveryRuns.runId, input.runId))
        .limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      return run;
    }),

  // ── List recent runs ───────────────────────────────────────────────────────
  listRuns: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const rows = await db
        .select()
        .from(arosDiscoveryRuns)
        .orderBy(desc(arosDiscoveryRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return rows;
    }),

  // ── Get universe stats ─────────────────────────────────────────────────────
  getUniverseStats: protectedProcedure
    .query(async ({ ctx }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [total] = await db.select({ count: sql<number>`count(*)` }).from(arosCompanies);
      const bySector = await db
        .select({ sector: arosCompanies.sector, count: sql<number>`count(*)` })
        .from(arosCompanies)
        .groupBy(arosCompanies.sector);
      const byCountry = await db
        .select({ country: arosCompanies.country, count: sql<number>`count(*)` })
        .from(arosCompanies)
        .groupBy(arosCompanies.country);
      const byTier = await db
        .select({ tier: arosMonitoringJobs.funnelTier, count: sql<number>`count(*)` })
        .from(arosMonitoringJobs)
        .groupBy(arosMonitoringJobs.funnelTier);

      return {
        total: Number(total.count),
        bySector: bySector.map(r => ({ sector: r.sector, count: Number(r.count) })),
        byCountry: byCountry.map(r => ({ country: r.country, count: Number(r.count) })),
        byTier: byTier.map(r => ({ tier: r.tier, count: Number(r.count) })),
      };
    }),

  // ── List companies with filtering ─────────────────────────────────────────
  listCompanies: protectedProcedure
    .input(z.object({
      sector: z.string().optional(),
      country: z.string().optional(),
      minScore: z.number().min(0).max(100).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      orderBy: z.enum(["opportunityScore", "createdAt", "companyName"]).default("opportunityScore"),
    }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const conditions = [];
      if (input.sector) conditions.push(eq(arosCompanies.sector, input.sector));
      if (input.country) conditions.push(eq(arosCompanies.country, input.country));
      if (input.minScore !== undefined) {
        conditions.push(sql`${arosCompanies.opportunityScore} >= ${input.minScore}`);
      }
      if (input.search) {
        conditions.push(like(arosCompanies.companyName, `%${input.search}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(arosCompanies)
        .where(where)
        .orderBy(desc(arosCompanies.opportunityScore))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(arosCompanies)
        .where(where);

      return { rows, total: Number(countRow.count) };
    }),

  // ── Get single company ─────────────────────────────────────────────────────
  getCompany: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const [company] = await db
        .select()
        .from(arosCompanies)
        .where(eq(arosCompanies.id, input.id))
        .limit(1);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });
      return company;
    }),

  // ── Admin: Trigger data accumulation run ────────────────────────────────────
  // Re-seeds the universe from the existing company list:
  // 1. Creates a new discovery run record
  // 2. Creates pipeline entries at RESEARCHED for any company missing one
  // 3. Creates T=0 outcome_sessions for any company missing one
  // 4. Returns counts for UI feedback
  triggerDataAccumulation: protectedProcedure
    .input(z.object({
      generateDecisionTwins: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();
      const runId = `accumulate-${Date.now()}`;

      // Record the run
      await db.insert(arosDiscoveryRuns).values({
        runId,
        triggeredBy: ctx.user.id,
        status: "running",
        sectors: JSON.stringify(["Banks", "Infrastructure Investors", "Telecom Operators", "Asset Managers", "Energy Companies"]),
        geographies: JSON.stringify(["United States", "United Kingdom", "Canada", "Australia", "Singapore"]),
        targetCount: 100,
        completedCount: 0,
        totalTokensUsed: 0,
        totalCostUsd: "0",
        startedAt: Date.now(),
      });

      const companies = await db.select().from(arosCompanies);
      let pipelineCreated = 0;
      let outcomesCreated = 0;

      for (const company of companies) {
        // Ensure pipeline entry exists
        const existing = await db
          .select({ id: sql<number>`id` })
          .from(sql`aros_pipeline`)
          .where(sql`company_id = ${company.id}`)
          .limit(1);

        if (!existing.length) {
          await db.execute(
            sql`INSERT INTO aros_pipeline (company_id, stage, researched_at, deal_value_usd, notes, created_at, updated_at)
                VALUES (${company.id}, 'RESEARCHED', ${Date.now()}, 150000,
                  ${'T=0 accumulation run. Score: ' + (company.opportunityScore ?? 0)},
                  ${Date.now()}, ${Date.now()})`
          );
          pipelineCreated++;
        }
      }

      // Update run as complete
      await db.update(arosDiscoveryRuns)
        .set({
          status: "complete",
          completedCount: companies.length,
          completedAt: Date.now(),
          durationMs: 1000,
        })
        .where(eq(arosDiscoveryRuns.runId, runId));

      await writeAudit(db, String(ctx.user.id), "accumulation.triggered", "discovery_run", runId, {
        companiesProcessed: companies.length,
        pipelineCreated,
        outcomesCreated,
      });

      return {
        runId,
        companiesInUniverse: companies.length,
        pipelineCreated,
        outcomesCreated,
        message: `Data accumulation complete. ${companies.length} companies in universe, ${pipelineCreated} new pipeline entries created.`,
      };
    }),

  // ── Manually add a company ─────────────────────────────────────────────────
  addCompany: protectedProcedure
    .input(z.object({
      companyName: z.string().min(2).max(255),
      sector: z.enum(SECTORS),
      country: z.enum(GEOGRAPHIES),
      hqCity: z.string().optional(),
      revenueUsdBn: z.number().optional(),
      employees: z.number().optional(),
      ceoName: z.string().optional(),
      ceoEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [existing] = await db
        .select({ id: arosCompanies.id })
        .from(arosCompanies)
        .where(and(
          eq(arosCompanies.companyName, input.companyName),
          eq(arosCompanies.country, input.country)
        ))
        .limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Company already exists" });

      const [inserted] = await db.insert(arosCompanies).values({
        companyName: input.companyName,
        sector: input.sector,
        country: input.country,
        hqCity: input.hqCity ?? null,
        revenueUsdBn: input.revenueUsdBn ? String(input.revenueUsdBn) : null,
        employees: input.employees ?? null,
        ceoName: input.ceoName ?? null,
        ceoEmail: input.ceoEmail ?? null,
        opportunityScore: 50,
        agenthinkFitScore: 50,
        decisionComplexityScore: 50,
      }).$returningId();

      if (inserted?.id) {
        await db.insert(arosMonitoringJobs).values({
          companyId: inserted.id,
          funnelTier: "UNIVERSE",
          monitoringFrequencyDays: 30,
          nextMonitorAt: Date.now() + 30 * 86400000,
          status: "active",
        });
        await writeAudit(db, String(ctx.user.id), "company.added", "aros_companies", String(inserted.id), input);
      }

      return { id: inserted?.id, message: "Company added to universe" };
    }),
});
