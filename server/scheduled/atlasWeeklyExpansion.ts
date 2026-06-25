/**
 * Atlas Weekly Expansion — Scheduled Handler
 *
 * Runs every Monday 08:00 UTC. Expands the monitored universe by:
 * 1. Generating new companies (LLM-powered, deduped) across target sectors/geographies
 * 2. Creating monitoring jobs for each new company
 * 3. Creating pipeline entries (RESEARCHED stage)
 * 4. Generating Decision Twin V2 + Hidden Variable + Outcome Ledger V2 for new companies
 * 5. Running calibration to update accuracy metrics
 *
 * POST /api/scheduled/atlas-weekly-expansion
 * Auth: Manus Heartbeat cron JWT (SCHEDULER_SECRET)
 */

import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import {
  arosCompanies,
  arosDiscoveryRuns,
  arosMonitoringJobs,
  arosPipeline,
  arosTokenLedger,
  arosDecisionTwinsV2,
  arosHiddenVariables,
  arosOutcomeLedgerV2,
  arosCalibration,
  arosAuditLog,
} from "../../drizzle/schema";

const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET;

// Expansion targets per run
const COMPANIES_PER_RUN = 20; // new companies to add each week
const DT_BATCH_SIZE = 10;     // Decision Twins to generate for new companies

// Rotating sector/geography pairs to ensure diverse coverage
const EXPANSION_TARGETS = [
  { sector: "Banks", geography: "United States" },
  { sector: "Asset Managers", geography: "United Kingdom" },
  { sector: "Infrastructure Investors", geography: "Australia" },
  { sector: "Telecom Operators", geography: "Germany" },
  { sector: "Energy Companies", geography: "UAE" },
  { sector: "Banks", geography: "Canada" },
  { sector: "Asset Managers", geography: "Singapore" },
  { sector: "Infrastructure Investors", geography: "Saudi Arabia" },
  { sector: "Telecom Operators", geography: "France" },
  { sector: "Energy Companies", geography: "Japan" },
] as const;

// Monitoring frequency by tier (days)
const TIER_FREQUENCY: Record<string, number> = {
  UNIVERSE: 30,
  ACTIVE: 7,
  HIGH_PRIORITY: 1,
  OUTREACH_CANDIDATE: 0,
};

const HV_TYPES = [
  "REGULATORY_DELAY",
  "AI_GOVERNANCE_FAILURE",
  "CAPITAL_ALLOCATION_ERROR",
  "DATA_SOVEREIGNTY_CONSTRAINT",
  "COMPETITIVE_RESPONSE",
  "INFRASTRUCTURE_BOTTLENECK",
  "TALENT_SHORTAGE",
  "EXECUTION_RISK",
  "MARKET_TIMING",
  "OTHER",
] as const;

function verifySchedulerAuth(req: Request): boolean {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === SCHEDULER_SECRET && !!SCHEDULER_SECRET;
}

interface ExpansionResult {
  step: string;
  count: number;
  notes?: string;
}

// ── LLM: Generate a batch of companies for a sector/geography ─────────────────
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
        content: "You are AROS Discovery Swarm. Generate real, well-known companies for the ATLAS target universe. Return ONLY valid JSON — no markdown, no explanation.",
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
                  "opportunityType", "opportunityScore", "agenthinkFitScore", "decisionComplexityScore",
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
  const parsed = JSON.parse(content) as { companies?: unknown[] };
  return (parsed.companies ?? []) as Array<{
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
  }>;
}

// ── LLM: Generate Decision Twin V2 + Hidden Variable for a company ────────────
async function generateDTv2(company: {
  id: number;
  companyName: string;
  sector: string | null;
  country: string | null;
  opportunityScore: number | null;
  keyDecisionDomain: string | null;
  activeStrategicInitiative: string | null;
}): Promise<{
  primaryObjective: string;
  secondaryObjective: string;
  strategicDecision: string;
  hiddenVariable: string;
  hiddenVariableType: string;
  hiddenVariableConfidence: number;
  monitoringSignals: string[];
  estimatedDecisionTimeline: string;
  estimatedAcvUsd: number;
  urgencyScore: number;
  recommendedEngagementPath: string;
  assumptions: string[];
  calibrationBaseline: Record<string, number>;
}> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Atlas Decision Twin Engine. Generate a structured 10-field Decision Twin for enterprise companies. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Generate a Decision Twin V2 for ${company.companyName} (${company.sector ?? "Unknown"}, ${company.country ?? "Unknown"}).
Key domain: ${company.keyDecisionDomain ?? "AI Transformation"}
Strategic initiative: ${company.activeStrategicInitiative ?? "Digital transformation"}
Opportunity score: ${company.opportunityScore ?? 70}/100`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "decision_twin_v2",
        strict: true,
        schema: {
          type: "object",
          properties: {
            primaryObjective: { type: "string" },
            secondaryObjective: { type: "string" },
            strategicDecision: { type: "string" },
            hiddenVariable: { type: "string" },
            hiddenVariableType: { type: "string" },
            hiddenVariableConfidence: { type: "number" },
            monitoringSignals: { type: "array", items: { type: "string" } },
            estimatedDecisionTimeline: { type: "string" },
            estimatedAcvUsd: { type: "number" },
            urgencyScore: { type: "number" },
            recommendedEngagementPath: { type: "string" },
            assumptions: { type: "array", items: { type: "string" } },
            calibrationBaseline: {
              type: "object",
              properties: {
                response_rate: { type: "number" },
                meeting_rate: { type: "number" },
                proposal_rate: { type: "number" },
                close_rate: { type: "number" },
              },
              required: ["response_rate", "meeting_rate", "proposal_rate", "close_rate"],
              additionalProperties: false,
            },
          },
          required: [
            "primaryObjective", "secondaryObjective", "strategicDecision",
            "hiddenVariable", "hiddenVariableType", "hiddenVariableConfidence",
            "monitoringSignals", "estimatedDecisionTimeline", "estimatedAcvUsd",
            "urgencyScore", "recommendedEngagementPath", "assumptions", "calibrationBaseline",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : "{}";
  return JSON.parse(content) as ReturnType<typeof generateDTv2> extends Promise<infer T> ? T : never;
}

export async function atlasWeeklyExpansionHandler(req: Request, res: Response) {
  if (!verifySchedulerAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startTime = Date.now();
  const results: ExpansionResult[] = [];
  const runId = randomUUID();
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  // Rotate through expansion targets by week number
  const target = EXPANSION_TARGETS[weekNumber % EXPANSION_TARGETS.length];

  try {
    const dbRaw = await getDb();
    if (!dbRaw) throw new Error("DB unavailable");
    const db = dbRaw;

    // ── Step 1: Create discovery run record ───────────────────────────────────
    await db.insert(arosDiscoveryRuns).values({
      runId,
      triggeredBy: 1, // system
      status: "running",
      sectors: JSON.stringify([target.sector]),
      geographies: JSON.stringify([target.geography]),
      targetCount: COMPANIES_PER_RUN,
      completedCount: 0,
      totalTokensUsed: 0,
      totalCostUsd: "0",
      startedAt: Date.now(),
    });

    results.push({ step: "1_create_run", count: 1, notes: `Run ${runId} for ${target.sector} / ${target.geography}` });

    // ── Step 2: Generate new companies via LLM ────────────────────────────────
    let newCompanies: Array<{ id: number; companyName: string; sector: string | null; country: string | null; opportunityScore: number | null; keyDecisionDomain: string | null; activeStrategicInitiative: string | null }> = [];
    let companiesAdded = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      const batch = await generateCompanyBatch(target.sector, target.geography, COMPANIES_PER_RUN);
      totalInputTokens += batch.length * 500;
      totalOutputTokens += batch.length * 200;

      for (const co of batch) {
        // Dedup by name + country
        const [existing] = await db
          .select({ id: arosCompanies.id })
          .from(arosCompanies)
          .where(and(
            eq(arosCompanies.companyName, co.companyName),
            eq(arosCompanies.country, target.geography)
          ))
          .limit(1);

        if (existing) continue;

        const [inserted] = await db.insert(arosCompanies).values({
          companyName: co.companyName,
          sector: target.sector,
          country: target.geography,
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
          // Create monitoring job
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

          // Create pipeline entry at RESEARCHED stage
          await db.insert(arosPipeline).values({
            companyId: inserted.id,
            stage: "RESEARCHED",
            researchedAt: Date.now(),
            dealValueUsd: 25000,
            dealType: "pilot",
          });

          newCompanies.push({
            id: inserted.id,
            companyName: co.companyName,
            sector: target.sector,
            country: target.geography,
            opportunityScore: co.opportunityScore,
            keyDecisionDomain: co.keyDecisionDomain,
            activeStrategicInitiative: co.activeStrategicInitiative,
          });
          companiesAdded++;
        }
      }
    } catch (err) {
      console.error("[WeeklyExpansion] Company generation error:", err);
    }

    // Log token usage for company generation
    await db.insert(arosTokenLedger).values({
      runId,
      workflow: "company_research",
      model: "gpt-4o-mini",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      costUsd: ((totalInputTokens * 0.00000015) + (totalOutputTokens * 0.0000006)).toFixed(8),
    });

    results.push({ step: "2_generate_companies", count: companiesAdded, notes: `${companiesAdded} new companies added to universe` });

    // ── Step 3: Generate Decision Twins V2 for new companies ──────────────────
    let dtGenerated = 0;
    const dtBatch = newCompanies.slice(0, DT_BATCH_SIZE);

    for (const company of dtBatch) {
      try {
        const dtData = await generateDTv2(company);
        const now = Date.now();
        const hvType = (HV_TYPES as readonly string[]).includes(dtData.hiddenVariableType)
          ? dtData.hiddenVariableType as typeof HV_TYPES[number]
          : "OTHER";

        const [dtResult] = await db.insert(arosDecisionTwinsV2).values({
          companyId: company.id,
          primaryObjective: dtData.primaryObjective.slice(0, 300),
          secondaryObjective: dtData.secondaryObjective?.slice(0, 300),
          strategicDecision: dtData.strategicDecision.slice(0, 400),
          hiddenVariable: dtData.hiddenVariable.slice(0, 300),
          hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
          monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
          estimatedDecisionTimeline: dtData.estimatedDecisionTimeline?.slice(0, 100),
          estimatedAcvUsd: Math.round(dtData.estimatedAcvUsd ?? 25000),
          urgencyScore: Math.max(0, Math.min(100, Math.round(dtData.urgencyScore ?? 50))),
          recommendedEngagementPath: dtData.recommendedEngagementPath?.slice(0, 500),
          version: 2,
          generatedBy: "atlas_weekly_expansion",
          createdAt: now,
          updatedAt: now,
        }).$returningId();

        const [hvResult] = await db.insert(arosHiddenVariables).values({
          companyId: company.id,
          decisionTwinV2Id: dtResult.id,
          hiddenVariable: dtData.hiddenVariable.slice(0, 300),
          hiddenVariableType: hvType,
          confidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
          monitoringSignal: (dtData.monitoringSignals ?? []).join("; ").slice(0, 400),
          reviewDate: now + 90 * 24 * 60 * 60 * 1000,
          createdAt: now,
          updatedAt: now,
        }).$returningId();

        await db.insert(arosOutcomeLedgerV2).values({
          companyId: company.id,
          decisionTwinV2Id: dtResult.id,
          hiddenVariableId: hvResult.id,
          hiddenVariable: dtData.hiddenVariable.slice(0, 300),
          hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
          assumptions: JSON.stringify(dtData.assumptions ?? []),
          monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
          calibrationBaseline: JSON.stringify(dtData.calibrationBaseline ?? {}),
          reviewDate: now + 90 * 24 * 60 * 60 * 1000,
          opportunityScoreAtT0: company.opportunityScore ?? 0,
          acvAtT0: Math.round(dtData.estimatedAcvUsd ?? 25000),
          urgencyAtT0: Math.max(0, Math.min(100, Math.round(dtData.urgencyScore ?? 50))),
          outcomeStatus: "PENDING",
          revenueForecasted: Math.round(dtData.estimatedAcvUsd ?? 25000),
          revenueActual: 0,
          createdAt: now,
          updatedAt: now,
        });

        // Log token usage for DT generation
        await db.insert(arosTokenLedger).values({
          runId,
          workflow: "company_research",
          model: "gpt-4o-mini",
          inputTokens: 350,
          outputTokens: 250,
          totalTokens: 600,
          costUsd: (350 * 0.00000015 + 250 * 0.0000006).toFixed(8),
          companyId: company.id,
        });

        dtGenerated++;
      } catch (err) {
        console.error(`[WeeklyExpansion] DT generation error for ${company.companyName}:`, err);
      }
    }

    results.push({ step: "3_generate_decision_twins", count: dtGenerated, notes: `Decision Twin V2 + HV + Outcome Ledger V2 created` });

    // ── Step 4: Update calibration accuracy ───────────────────────────────────
    let calibrationUpdated = 0;
    try {
      // Compute actual pipeline conversion rates
      const pipelineRows = await db.select().from(arosPipeline);
      const total = pipelineRows.length;
      if (total > 0) {
        const outreachSent = pipelineRows.filter(r => r.stage !== "RESEARCHED").length;
        const responses = pipelineRows.filter(r => ["RESPONSE_RECEIVED", "MEETING_BOOKED", "MEETING_HELD", "PROPOSAL_SENT", "NEGOTIATION", "CUSTOMER"].includes(r.stage)).length;
        const meetings = pipelineRows.filter(r => ["MEETING_BOOKED", "MEETING_HELD", "PROPOSAL_SENT", "NEGOTIATION", "CUSTOMER"].includes(r.stage)).length;
        const proposals = pipelineRows.filter(r => ["PROPOSAL_SENT", "NEGOTIATION", "CUSTOMER"].includes(r.stage)).length;
        const customers = pipelineRows.filter(r => r.stage === "CUSTOMER").length;

        const metrics = [
          { metric: "response_rate", actual: outreachSent > 0 ? responses / outreachSent : 0, predicted: 0.15 },
          { metric: "meeting_rate", actual: responses > 0 ? meetings / responses : 0, predicted: 0.40 },
          { metric: "proposal_rate", actual: meetings > 0 ? proposals / meetings : 0, predicted: 0.50 },
          { metric: "close_rate", actual: proposals > 0 ? customers / proposals : 0, predicted: 0.25 },
        ];

        const now = Date.now();
        for (const m of metrics) {
          await db.insert(arosCalibration).values({
            runId,
            metric: m.metric,
            predictedRate: String(m.predicted),
            actualRate: String(m.actual.toFixed(4)),
            sampleSize: total,
            observedAt: now,
            notes: `Weekly expansion calibration update — ${new Date(now).toISOString().split("T")[0]}`,
          });
          calibrationUpdated++;
        }
      }
    } catch (err) {
      console.error("[WeeklyExpansion] Calibration update error:", err);
    }

    results.push({ step: "4_calibration_update", count: calibrationUpdated });

    // ── Step 5: Write audit log ───────────────────────────────────────────────
    await db.insert(arosAuditLog).values({
      actor: "atlas_weekly_expansion",
      action: "weekly.expansion.complete",
      entityType: "discovery_run",
      entityId: runId,
      payload: JSON.stringify({ companiesAdded, dtGenerated, calibrationUpdated }),
    });

    // ── Finalize discovery run ────────────────────────────────────────────────
    const totalTokens = totalInputTokens + totalOutputTokens + (dtGenerated * 600);
    const totalCost = (totalInputTokens * 0.00000015) + (totalOutputTokens * 0.0000006) + (dtGenerated * (350 * 0.00000015 + 250 * 0.0000006));

    await db.update(arosDiscoveryRuns)
      .set({
        status: "complete",
        completedCount: companiesAdded,
        totalTokensUsed: totalTokens,
        totalCostUsd: totalCost.toFixed(6),
        completedAt: Date.now(),
        durationMs: Date.now() - startTime,
      })
      .where(eq(arosDiscoveryRuns.runId, runId));

    const durationMs = Date.now() - startTime;
    console.log(`[WeeklyExpansion] Complete in ${durationMs}ms. Companies: ${companiesAdded}, DTs: ${dtGenerated}, Calibration: ${calibrationUpdated}`);

    return res.json({
      success: true,
      runId,
      target: `${target.sector} / ${target.geography}`,
      durationMs,
      results,
      summary: {
        companiesAdded,
        dtGenerated,
        calibrationUpdated,
      },
    });

  } catch (err) {
    console.error("[WeeklyExpansion] Fatal error:", err);
    // Mark run as failed
    try {
      const dbRaw = await getDb();
      if (dbRaw) {
        await dbRaw.update(arosDiscoveryRuns)
          .set({ status: "failed", errorMessage: String(err) })
          .where(eq(arosDiscoveryRuns.runId, runId));
      }
    } catch (_) { /* ignore */ }

    return res.status(500).json({
      success: false,
      error: String(err),
      results,
    });
  }
}
