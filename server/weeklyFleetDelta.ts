import { and, desc, eq, lt } from "drizzle-orm";
import {
  founderAgentEvaluations,
  founderAgentIdeas,
  founderAgentPitches,
  founderAgentResearch,
  founderAgentRuns,
} from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

const SYSTEM_METADATA_DOMAIN = "__SYSTEM__";
export const WEEKLY_DELTA_QUERY = "weekly_delta_report_v1";
const NOVELTY_METRICS_QUERY = "weekly_novelty_metrics_v1";
const LIGHT_RECHECK_MODEL = "gpt-5-nano";

export type FleetClassification = "ENGAGE" | "WATCH" | "PASS";

export interface WeeklyNoveltyMetrics {
  candidatesGenerated: number;
  candidatesSurvived: number;
  duplicatesDropped: number;
}

export interface WeeklyEngageItem {
  domain: string;
  subSector: string;
  region: string;
  finalScore: number | null;
}

export interface WeeklyStatusFlip {
  domain: string;
  subSector: string;
  region: string;
  previousClassification: "ENGAGE";
  newClassification: "WATCH" | "PASS";
  rationale: string;
}

export interface WeeklyDeltaReport {
  runId: number;
  fleetMode: string;
  previousRunId: number | null;
  novelty: WeeklyNoveltyMetrics;
  newIdeasScanned: number;
  newEngageHits: WeeklyEngageItem[];
  engageShortlistChecked: number;
  engageStatusFlips: WeeklyStatusFlip[];
  generatedAt: number;
}

export interface LightRecheckCost {
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface PreviousEngageItem extends WeeklyEngageItem {
  problem: string;
  solution: string;
  businessModel: string;
  keyRisk: string;
  currentResearch: string;
}

interface RecheckResult {
  domain: string;
  subSector: string;
  region: string;
  classification: FleetClassification;
  rationale: string;
}

function normalizeComboPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(new RegExp("[^\\p{L}\\p{N}]+", "gu"), " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function comboKey(domain: string, subSector: string, region: string): string {
  return [domain, subSector, region].map(normalizeComboPart).join("|");
}

export function isPreviousRunEngageCandidate(candidateRunId: number, previousRunId: number): boolean {
  return candidateRunId === previousRunId;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function emptyCost(): LightRecheckCost {
  return { llmCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
}

async function loadPreviousEngageShortlist(
  runId: number,
  fleetMode: string,
): Promise<{ previousRunId: number | null; items: PreviousEngageItem[] }> {
  const db = await getDb();
  if (!db) return { previousRunId: null, items: [] };

  const [previousRun] = await db
    .select({ id: founderAgentRuns.id })
    .from(founderAgentRuns)
    .where(and(
      eq(founderAgentRuns.fleetMode, fleetMode),
      eq(founderAgentRuns.status, "completed"),
      lt(founderAgentRuns.id, runId),
    ))
    .orderBy(desc(founderAgentRuns.id))
    .limit(1);

  if (!previousRun) return { previousRunId: null, items: [] };

  const [researchRows, engageRows, priorDeltaRows] = await Promise.all([
    db.select({
      domain: founderAgentResearch.domain,
      resultSummary: founderAgentResearch.resultSummary,
    })
      .from(founderAgentResearch)
      .where(eq(founderAgentResearch.runId, runId)),
    db.select({
      evaluationId: founderAgentEvaluations.id,
      runId: founderAgentEvaluations.runId,
      domain: founderAgentIdeas.domain,
      subSector: founderAgentIdeas.subSector,
      region: founderAgentIdeas.targetRegion,
      finalScore: founderAgentEvaluations.finalScore,
      problem: founderAgentPitches.problem,
      solution: founderAgentPitches.solution,
      businessModel: founderAgentPitches.businessModel,
      keyRisk: founderAgentPitches.keyRisk,
    })
      .from(founderAgentEvaluations)
      .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
      .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
      .where(and(
        eq(founderAgentEvaluations.fleetMode, fleetMode),
        eq(founderAgentEvaluations.runId, previousRun.id),
        eq(founderAgentEvaluations.status, "completed"),
        eq(founderAgentEvaluations.classification, "ENGAGE"),
      ))
      .orderBy(desc(founderAgentEvaluations.id)),
    db.select({ resultSummary: founderAgentResearch.resultSummary })
      .from(founderAgentResearch)
      .innerJoin(founderAgentRuns, eq(founderAgentResearch.runId, founderAgentRuns.id))
      .where(and(
        eq(founderAgentRuns.fleetMode, fleetMode),
        lt(founderAgentRuns.id, runId),
        eq(founderAgentResearch.query, WEEKLY_DELTA_QUERY),
      ))
      .orderBy(desc(founderAgentRuns.id)),
  ]);

  const researchByDomain = new Map<string, string>();
  for (const row of researchRows) {
    if (row.domain === SYSTEM_METADATA_DOMAIN) continue;
    const prior = researchByDomain.get(row.domain) ?? "";
    researchByDomain.set(row.domain, `${prior}${row.resultSummary}\n`.trim());
  }

  const downgradedKeys = new Set<string>();
  for (const row of priorDeltaRows) {
    try {
      const priorReport = JSON.parse(row.resultSummary) as Partial<WeeklyDeltaReport>;
      for (const flip of priorReport.engageStatusFlips ?? []) {
        downgradedKeys.add(comboKey(flip.domain, flip.subSector, flip.region));
      }
    } catch {
      // Ignore malformed legacy metadata and retain the scored corpus as source of truth.
    }
  }

  const deduped = new Map<string, PreviousEngageItem>();
  for (const row of engageRows) {
    if (!isPreviousRunEngageCandidate(row.runId, previousRun.id)) continue;
    const key = comboKey(row.domain, row.subSector, row.region);
    if (downgradedKeys.has(key) || deduped.has(key)) continue;
    deduped.set(key, {
      domain: row.domain,
      subSector: row.subSector,
      region: row.region,
      finalScore: row.finalScore,
      problem: row.problem,
      solution: row.solution,
      businessModel: row.businessModel,
      keyRisk: row.keyRisk,
      currentResearch: researchByDomain.get(row.domain) ?? "No new domain research was available in this run.",
    });
  }

  return { previousRunId: previousRun.id, items: Array.from(deduped.values()) };
}

async function lightRecheckEngage(
  items: PreviousEngageItem[],
): Promise<{ results: RecheckResult[]; cost: LightRecheckCost }> {
  if (items.length === 0) return { results: [], cost: emptyCost() };

  const allResults: RecheckResult[] = [];
  const totalCost = emptyCost();
  const BATCH_SIZE = 25;

  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    const response = await invokeLLM({
    model: LIGHT_RECHECK_MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: "You perform a light weekly status re-check of an existing investment ENGAGE shortlist. Use only the supplied prior pitch and current weekly research. Do not calculate, infer, repeat, or modify execution_score, market_score, final_score, percentile ranks, or any other numeric score. Return the same domain, subSector, and region strings exactly as supplied.",
      },
      {
        role: "user",
        content: `Re-check only these existing ENGAGE items. Classify each as ENGAGE, WATCH, or PASS based on whether the current weekly research materially changes the prior investment status. Keep ENGAGE unless there is concrete supplied evidence for a downgrade. Rationales must be at most 25 words.\n\n${JSON.stringify(batch)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "weekly_engage_recheck",
        strict: true,
        schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  domain: { type: "string" },
                  subSector: { type: "string" },
                  region: { type: "string" },
                  classification: { type: "string", enum: ["ENGAGE", "WATCH", "PASS"] },
                  rationale: { type: "string" },
                },
                required: ["domain", "subSector", "region", "classification", "rationale"],
                additionalProperties: false,
              },
            },
          },
          required: ["results"],
          additionalProperties: false,
        },
      },
    },
  });

    const parsed = JSON.parse(extractText(response.choices[0]?.message.content) || '{"results":[]}') as { results?: RecheckResult[] };
    const allowedKeys = new Set(batch.map((item) => comboKey(item.domain, item.subSector, item.region)));
    allResults.push(...(parsed.results ?? []).filter((result) => allowedKeys.has(comboKey(result.domain, result.subSector, result.region))));
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    totalCost.llmCalls++;
    totalCost.inputTokens += inputTokens;
    totalCost.outputTokens += outputTokens;
    totalCost.costUsd += inputTokens * 0.00000005 + outputTokens * 0.0000004;
  }

  return { results: allResults, cost: totalCost };
}

async function loadNoveltyMetrics(runId: number): Promise<WeeklyNoveltyMetrics> {
  const db = await getDb();
  if (!db) return { candidatesGenerated: 0, candidatesSurvived: 0, duplicatesDropped: 0 };
  const [row] = await db.select({ resultSummary: founderAgentResearch.resultSummary })
    .from(founderAgentResearch)
    .where(and(
      eq(founderAgentResearch.runId, runId),
      eq(founderAgentResearch.query, NOVELTY_METRICS_QUERY),
    ))
    .limit(1);
  if (!row) return { candidatesGenerated: 0, candidatesSurvived: 0, duplicatesDropped: 0 };
  try {
    const parsed = JSON.parse(row.resultSummary) as Partial<WeeklyNoveltyMetrics>;
    return {
      candidatesGenerated: Number(parsed.candidatesGenerated ?? 0),
      candidatesSurvived: Number(parsed.candidatesSurvived ?? 0),
      duplicatesDropped: Number(parsed.duplicatesDropped ?? 0),
    };
  } catch {
    return { candidatesGenerated: 0, candidatesSurvived: 0, duplicatesDropped: 0 };
  }
}

async function loadNewEngageHits(runId: number): Promise<WeeklyEngageItem[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    domain: founderAgentIdeas.domain,
    subSector: founderAgentIdeas.subSector,
    region: founderAgentIdeas.targetRegion,
    finalScore: founderAgentEvaluations.finalScore,
  })
    .from(founderAgentEvaluations)
    .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
    .where(and(
      eq(founderAgentEvaluations.runId, runId),
      eq(founderAgentEvaluations.status, "completed"),
      eq(founderAgentEvaluations.classification, "ENGAGE"),
    ));

  const deduped = new Map<string, WeeklyEngageItem>();
  for (const row of rows) {
    const key = comboKey(row.domain, row.subSector, row.region);
    const prior = deduped.get(key);
    if (!prior || (row.finalScore ?? 0) > (prior.finalScore ?? 0)) deduped.set(key, row);
  }
  return Array.from(deduped.values());
}

export async function buildAndPersistWeeklyDelta(
  runId: number,
  fleetMode: string,
): Promise<{ report: WeeklyDeltaReport; cost: LightRecheckCost }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while building weekly fleet delta");

  const novelty = await loadNoveltyMetrics(runId);
  const newEngageHits = await loadNewEngageHits(runId);
  const { previousRunId, items } = await loadPreviousEngageShortlist(runId, fleetMode);
  const recheck = await lightRecheckEngage(items);
  const engageStatusFlips: WeeklyStatusFlip[] = recheck.results
    .filter((result): result is RecheckResult & { classification: "WATCH" | "PASS" } => result.classification !== "ENGAGE")
    .map((result) => ({
      domain: result.domain,
      subSector: result.subSector,
      region: result.region,
      previousClassification: "ENGAGE",
      newClassification: result.classification,
      rationale: result.rationale,
    }));

  const report: WeeklyDeltaReport = {
    runId,
    fleetMode,
    previousRunId,
    novelty,
    newIdeasScanned: novelty.candidatesSurvived,
    newEngageHits,
    engageShortlistChecked: items.length,
    engageStatusFlips,
    generatedAt: Date.now(),
  };

  const [existing] = await db.select({ id: founderAgentResearch.id })
    .from(founderAgentResearch)
    .where(and(
      eq(founderAgentResearch.runId, runId),
      eq(founderAgentResearch.query, WEEKLY_DELTA_QUERY),
    ))
    .limit(1);
  const values = {
    runId,
    domain: SYSTEM_METADATA_DOMAIN,
    query: WEEKLY_DELTA_QUERY,
    resultSummary: JSON.stringify(report),
  };
  if (existing) {
    await db.update(founderAgentResearch).set(values).where(eq(founderAgentResearch.id, existing.id));
  } else {
    await db.insert(founderAgentResearch).values(values);
  }

  return { report, cost: recheck.cost };
}

export async function getWeeklyDeltaReport(runId: number): Promise<WeeklyDeltaReport | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({ resultSummary: founderAgentResearch.resultSummary })
    .from(founderAgentResearch)
    .where(and(
      eq(founderAgentResearch.runId, runId),
      eq(founderAgentResearch.query, WEEKLY_DELTA_QUERY),
    ))
    .limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.resultSummary) as WeeklyDeltaReport;
  } catch {
    return null;
  }
}
