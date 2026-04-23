/**
 * FounderAgent Fleet Orchestration Engine
 *
 * Runs 100 autonomous founder simulations end-to-end with minimum credit consumption:
 *   - 1 LLM call  → 100 ideas (Haiku)
 *   - 5 LLM calls → 100 pitches in domain batches of 20 (Haiku)
 *   - 15 searches → 3 per domain, shared across all 20 agents in that domain
 *   - 100 mesh evaluations → max 10 concurrent, 3s stagger, resume on restart
 *   - 1 LLM call  → pattern extraction over 3-sentence summaries (Sonnet)
 */

import crypto from "crypto";
import { getDb } from "./db";
import {
  founderAgentRuns, founderAgentIdeas, founderAgentResearch,
  founderAgentPitches, founderAgentEvaluations, founderAgentInsights,
  founderAgentRunCosts,
  FounderAgentIdea, FounderAgentPitch, FounderAgentEvaluation,
} from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { runCouncil } from "./councilEngine";

// ── Model constants ────────────────────────────────────────────────────────────
const HAIKU  = "claude-haiku-3-5";
const SONNET = "claude-sonnet-4-5";

// ── Domain definitions ────────────────────────────────────────────────────────
export const FLEET_DOMAINS = [
  {
    name: "Fintech",
    subSectors: ["payments", "lending", "insurance", "wealth", "compliance"],
  },
  {
    name: "Healthtech",
    subSectors: ["diagnostics", "telemedicine", "pharma supply chain", "mental health", "elder care"],
  },
  {
    name: "Edtech",
    subSectors: ["corporate training", "K12", "vocational", "language learning", "credentialing"],
  },
  {
    name: "Logistics",
    subSectors: ["last mile", "cold chain", "freight", "reverse logistics", "cross-border"],
  },
  {
    name: "B2B SaaS",
    subSectors: ["HR", "procurement", "legal", "finance ops", "customer success"],
  },
] as const;

// ── Scoring helpers ───────────────────────────────────────────────────────────
export function classificationToScore(classification: string): number {
  if (classification === "ENGAGE") return 87; // midpoint of 75-100
  if (classification === "WATCH")  return 64; // midpoint of 50-79
  return 24; // PASS midpoint of 0-49
}

export function computeFinalScore(
  classificationScore: number,
  executionScore: number,
  marketScore: number,
): number {
  return Math.round(classificationScore * 0.5 + executionScore * 0.25 + marketScore * 0.25);
}

/** Derive execution score from CouncilResult (team credibility, plan clarity, go-to-market) */
function deriveExecutionScore(councilResult: { weightedAgentScore: number }): number {
  return Math.round(councilResult.weightedAgentScore * 100);
}

/** Derive market score from CouncilResult (market size, accessibility, timing) */
function deriveMarketScore(councilResult: { consensusQuality: number }): number {
  return Math.round(councilResult.consensusQuality * 100);
}

// ── Idea fingerprint ──────────────────────────────────────────────────────────
function fingerprint(domain: string, subSector: string, description: string): string {
  return crypto.createHash("sha256")
    .update(`${domain}|${subSector}|${description.toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 64);
}

// ── Cost tracking ─────────────────────────────────────────────────────────────
// Rough token cost estimates (USD per 1K tokens)
const COST_PER_1K_INPUT_HAIKU   = 0.00025;
const COST_PER_1K_INPUT_SONNET  = 0.003;
const COST_PER_1K_OUTPUT_HAIKU  = 0.00125;
const COST_PER_1K_OUTPUT_SONNET = 0.015;

interface CostAccumulator {
  searches: number;
  llmCalls: number;
  tokens: number;
  costUsd: number;
}

function addLlmCost(
  acc: CostAccumulator,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  acc.llmCalls++;
  acc.tokens += inputTokens + outputTokens;
  const isHaiku = model.includes("haiku");
  acc.costUsd += (inputTokens  / 1000) * (isHaiku ? COST_PER_1K_INPUT_HAIKU  : COST_PER_1K_INPUT_SONNET);
  acc.costUsd += (outputTokens / 1000) * (isHaiku ? COST_PER_1K_OUTPUT_HAIKU : COST_PER_1K_OUTPUT_SONNET);
}

// ── LLM response helpers ──────────────────────────────────────────────────────
interface LlmResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function extractContent(resp: unknown): string {
  return (resp as LlmResponse)?.choices?.[0]?.message?.content ?? "";
}

function extractUsage(resp: unknown): { prompt_tokens: number; completion_tokens: number } {
  return (resp as LlmResponse)?.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
}

// ── In-memory fleet state ─────────────────────────────────────────────────────
// Keyed by runId — allows pause/resume signals
const fleetState: Map<number, { paused: boolean; abort: boolean }> = new Map();

export function pauseFleet(runId: number): void {
  const s = fleetState.get(runId);
  if (s) s.paused = true;
}

export function resumeFleet(runId: number): void {
  const s = fleetState.get(runId);
  if (s) s.paused = false;
}

export function abortFleet(runId: number): void {
  const s = fleetState.get(runId);
  if (s) s.abort = true;
}

export function getFleetState(runId: number): { paused: boolean; abort: boolean } | undefined {
  return fleetState.get(runId);
}

async function waitIfPaused(runId: number): Promise<boolean> {
  const state = fleetState.get(runId);
  if (!state) return false;
  while (state.paused && !state.abort) {
    await sleep(1000);
  }
  return state.abort;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

async function updateRunStatus(
  runId: number,
  status: "pending" | "generating" | "researching" | "pitching" | "evaluating" | "extracting" | "completed" | "paused" | "failed",
  extra: Partial<typeof founderAgentRuns.$inferInsert> = {},
): Promise<void> {
  const db = await requireDb();
  await db.update(founderAgentRuns)
    .set({ status, ...extra })
    .where(eq(founderAgentRuns.id, runId));
}

async function incrementRunCounters(
  runId: number,
  delta: { completed?: number; queued?: number; running?: number },
): Promise<void> {
  const db = await requireDb();
  const sets: Record<string, unknown> = {};
  if (delta.completed) sets.completed = sql`completed + ${delta.completed}`;
  if (delta.queued !== undefined) sets.queued = sql`queued + ${delta.queued}`;
  if (delta.running !== undefined) sets.running = sql`running + ${delta.running}`;
  if (Object.keys(sets).length > 0) {
    await db.update(founderAgentRuns)
      .set(sets as Partial<typeof founderAgentRuns.$inferInsert>)
      .where(eq(founderAgentRuns.id, runId));
  }
}

async function saveCosts(runId: number, acc: CostAccumulator): Promise<void> {
  const db = await requireDb();
  await db.update(founderAgentRuns).set({
    totalSearches:    acc.searches,
    totalLlmCalls:    acc.llmCalls,
    estimatedTokens:  acc.tokens,
    estimatedCostUsd: acc.costUsd.toFixed(4),
  }).where(eq(founderAgentRuns.id, runId));

  const existing = await db.select({ id: founderAgentRunCosts.id })
    .from(founderAgentRunCosts)
    .where(eq(founderAgentRunCosts.runId, runId))
    .limit(1);

  const costData = {
    totalSearches:    acc.searches,
    totalLlmCalls:    acc.llmCalls,
    estimatedTokens:  acc.tokens,
    estimatedCostUsd: acc.costUsd.toFixed(4),
  };

  if (existing.length > 0) {
    await db.update(founderAgentRunCosts).set(costData).where(eq(founderAgentRunCosts.runId, runId));
  } else {
    await db.insert(founderAgentRunCosts).values({ runId, ...costData });
  }
}

// ── Step 1: Generate 100 ideas in one LLM call ────────────────────────────────
async function generateIdeas(runId: number, acc: CostAccumulator, opts: { ideasPerDomain?: number } = {}): Promise<number[]> {
  const ideasPerDomain = opts.ideasPerDomain ?? 20;
  const db = await requireDb();

  // Load existing fingerprints to avoid duplicates across runs
  const existingRows = await db.select({ fp: founderAgentIdeas.ideaFingerprint }).from(founderAgentIdeas);
  const existingFingerprints = new Set(existingRows.map((r: { fp: string }) => r.fp));

  const domainSpec = FLEET_DOMAINS.map((d) =>
    `${d.name} (${d.subSectors.join(", ")})`
  ).join("; ");

  const totalIdeas = ideasPerDomain * 5;
  const prompt = `Generate exactly ${totalIdeas} unique, credible early-stage startup ideas across 5 domains — ${ideasPerDomain} per domain.
Domains and sub-sectors: ${domainSpec}

CRITICAL QUALITY RULES — every idea MUST include all four of these:
1. FOUNDER UNFAIR ADVANTAGE: A specific prior role, network, or domain expertise that gives this founder an edge no generalist has (e.g. "Former Grab regional HR director", "Ex-WHO malaria programme lead", "10-year supply chain operator at Maersk").
2. TRACTION SIGNAL: At least one concrete early signal — signed LOIs, paid pilots, proprietary dataset, regulatory approval, or paying customers. Not "seeking" or "planning" — something already secured.
3. DEFENSIBLE MOAT: A specific moat that is NOT just "AI-powered" or "first mover" — e.g. proprietary data accumulated over years, exclusive distribution partnerships, regulatory licence, switching costs, or network effects with a named mechanism.
4. WHY NOW / WHY THIS FOUNDER: A specific market timing insight or structural change (regulation, infrastructure, demographic shift) that makes this the right moment, and why this specific founder is positioned to capture it.

WEAK example (do NOT generate): "AI-powered HR platform for SMEs."
STRONG example (generate at this level): "Former Grab regional HR director building compliance automation for gig economy platforms in Southeast Asia — 3 pilots signed with Grab, Gojek, and Shopee, leveraging 8 years of relationships and proprietary workforce classification data from 2M+ gig contracts."

Other rules:
- No duplicates (check against existing ideas listed below)
- Each idea must cover a different sub-sector within its domain
- Return ONLY a JSON array of ${totalIdeas} objects, no markdown, no explanation

Each object must have these exact keys:
{
  "domain": string,
  "subSector": string,
  "description": string (2-3 sentences: what they build, founder background, traction signal — max 280 chars),
  "targetRegion": string (e.g. "GCC", "Southeast Asia", "Sub-Saharan Africa", "Latin America", "South Asia", "Europe", "North America"),
  "founderName": string (realistic full name matching the target region),
  "fundingStage": string (one of: "Pre-seed", "Seed", "Series A"),
  "fundingAsk": string (e.g. "$500K", "$2M", "$8M")
}
Existing idea fingerprints to avoid (domain|subSector|description):
${Array.from(existingFingerprints).slice(0, 500).join("\n") || "None yet"}`;

  const resp = await invokeLLM({
    messages: [
      { role: "system", content: "You are a startup idea generator. Return only valid JSON arrays." },
      { role: "user", content: prompt },
    ],
    model: HAIKU,
    max_tokens: 8000,
  });

  const usage = extractUsage(resp);
  addLlmCost(acc, HAIKU, usage.prompt_tokens || 4000, usage.completion_tokens || 4000);

  const content = extractContent(resp);

  interface IdeaRaw {
    domain: string; subSector: string; description: string;
    targetRegion: string; founderName: string; fundingStage: string; fundingAsk: string;
  }
  let ideas: IdeaRaw[] = [];

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    ideas = JSON.parse(cleaned) as IdeaRaw[];
  } catch {
    console.error("[FleetOrchestrator] Failed to parse ideas JSON:", content.slice(0, 200));
    throw new Error("Failed to parse idea generation response");
  }

  // Deduplicate and insert
  const insertedIds: number[] = [];
  const toInsert = ideas.filter((idea: IdeaRaw) => {
    const fp = fingerprint(idea.domain, idea.subSector, idea.description);
    if (existingFingerprints.has(fp)) return false;
    existingFingerprints.add(fp);
    return true;
  }).slice(0, totalIdeas);

  for (const idea of toInsert) {
    const fp = fingerprint(idea.domain, idea.subSector, idea.description);
    const result = await db.insert(founderAgentIdeas).values({
      runId,
      domain: idea.domain,
      subSector: idea.subSector,
      description: idea.description,
      targetRegion: idea.targetRegion,
      founderName: idea.founderName,
      fundingStage: idea.fundingStage,
      fundingAsk: idea.fundingAsk,
      ideaFingerprint: fp,
    });
    const insertId = (result as unknown as [{ insertId: number }])[0]?.insertId;
    if (insertId) insertedIds.push(insertId);
  }

  await db.update(founderAgentRuns).set({ totalIdeas: insertedIds.length }).where(eq(founderAgentRuns.id, runId));
  return insertedIds;
}

// ── Step 2: Research in batches (max 3 searches per domain) ───────────────────
async function runResearch(
  runId: number,
  acc: CostAccumulator,
  opts: { queriesPerDomain?: number } = {},
): Promise<Record<string, string>> {
  const queriesPerDomain = opts.queriesPerDomain ?? 3;
  const db = await requireDb();
  const researchByDomain: Record<string, string> = {};

  for (const domain of FLEET_DOMAINS) {
    const allQueries = [
      `${domain.name} startup market size 2024 2025`,
      `${domain.name} key competitors and market leaders`,
      `${domain.name} regulatory risks and compliance requirements`,
    ];
    const queries = allQueries.slice(0, queriesPerDomain);

    const summaries: string[] = [];
    for (const query of queries) {
      acc.searches++;
      // Use LLM to synthesise research (shared across all 20 agents in this domain)
      const resp = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a concise market research analyst. Provide factual, specific answers in 2-3 sentences.",
          },
          {
            role: "user",
            content: `Provide a brief, factual answer to: "${query}". Be specific with numbers and names where possible.`,
          },
        ],
        model: HAIKU,
        max_tokens: 300,
      });
      const usage = extractUsage(resp);
      addLlmCost(acc, HAIKU, usage.prompt_tokens || 200, usage.completion_tokens || 150);
      const summary = extractContent(resp);
      summaries.push(`Q: ${query}\nA: ${summary}`);

      await db.insert(founderAgentResearch).values({
        runId,
        domain: domain.name,
        query,
        resultSummary: summary,
      });
    }

    researchByDomain[domain.name] = summaries.join("\n\n");
  }

  return researchByDomain;
}

// ── Step 3: Generate pitches in domain batches of 20 ─────────────────────────
async function generatePitches(
  runId: number,
  ideaIds: number[],
  researchByDomain: Record<string, string>,
  acc: CostAccumulator,
): Promise<void> {
  const db = await requireDb();

  const ideas = await db.select().from(founderAgentIdeas)
    .where(and(eq(founderAgentIdeas.runId, runId), inArray(founderAgentIdeas.id, ideaIds)));

  for (const domain of FLEET_DOMAINS) {
    const domainIdeas = ideas.filter((i: FounderAgentIdea) => i.domain === domain.name);
    if (domainIdeas.length === 0) continue;

    const research = researchByDomain[domain.name] ?? "";

    const ideasList = domainIdeas.map((idea: FounderAgentIdea, idx: number) =>
      `${idx + 1}. Founder: ${idea.founderName} | Sub-sector: ${idea.subSector} | Region: ${idea.targetRegion} | Stage: ${idea.fundingStage} | Ask: ${idea.fundingAsk}\n   Idea: ${idea.description}`
    ).join("\n");

    const prompt = `You are generating ${domainIdeas.length} startup pitches for ${domain.name} founders.

Market context:
${research}

Ideas to pitch:
${ideasList}

For each idea, write a realistic founder pitch. No hype. Moderate quality — feels like a real founder wrote it.

Return ONLY a JSON array of ${domainIdeas.length} objects in the same order as the ideas above. Each object:
{
  "problem": string (2-3 sentences),
  "solution": string (2-3 sentences),
  "targetMarket": string (include market size estimate),
  "businessModel": string (1-2 sentences),
  "competitiveAdvantage": string (1-2 sentences),
  "keyRisk": string (1 sentence),
  "fundingAsk": string,
  "summary3s": string (exactly 3 sentences summarising the pitch for pattern analysis)
}`;

    const resp = await invokeLLM({
      messages: [
        { role: "system", content: "You are a startup pitch writer. Return only valid JSON arrays." },
        { role: "user", content: prompt },
      ],
      model: HAIKU,
      max_tokens: 8000,
    });

    const usage = extractUsage(resp);
    addLlmCost(acc, HAIKU, usage.prompt_tokens || 3000, usage.completion_tokens || 4000);

    const content = extractContent(resp);

    interface PitchRaw {
      problem: string; solution: string; targetMarket: string;
      businessModel: string; competitiveAdvantage: string;
      keyRisk: string; fundingAsk: string; summary3s: string;
    }
    let pitches: PitchRaw[] = [];

    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      pitches = JSON.parse(cleaned) as PitchRaw[];
    } catch {
      console.error(`[FleetOrchestrator] Failed to parse pitches for ${domain.name}:`, content.slice(0, 200));
      continue;
    }

    for (let i = 0; i < domainIdeas.length && i < pitches.length; i++) {
      const idea = domainIdeas[i];
      const pitch = pitches[i];
      await db.insert(founderAgentPitches).values({
        runId,
        ideaId: idea.id,
        problem:              pitch.problem ?? "",
        solution:             pitch.solution ?? "",
        targetMarket:         pitch.targetMarket ?? "",
        businessModel:        pitch.businessModel ?? "",
        competitiveAdvantage: pitch.competitiveAdvantage ?? "",
        keyRisk:              pitch.keyRisk ?? "",
        fundingAsk:           pitch.fundingAsk ?? idea.fundingAsk,
        summary3s:            pitch.summary3s ?? "",
      });
    }
  }
}

// ── Step 4: Submit to mesh with concurrency queue ─────────────────────────────
const MAX_CONCURRENT = 10;
const STAGGER_MS = 3000;

interface PitchEntry {
  pitch: FounderAgentPitch;
  idea: FounderAgentIdea;
}

async function submitToMesh(runId: number, acc: CostAccumulator, opts: { maxConcurrent?: number; staggerMs?: number } = {}): Promise<void> {
  const maxConcurrent = opts.maxConcurrent ?? MAX_CONCURRENT;
  const staggerMs = opts.staggerMs ?? STAGGER_MS;
  const db = await requireDb();

  // Load all pitches for this run (or resume queued ones)
  const pitches: PitchEntry[] = await db.select({
    pitch: founderAgentPitches,
    idea: founderAgentIdeas,
  })
    .from(founderAgentPitches)
    .innerJoin(founderAgentIdeas, eq(founderAgentPitches.ideaId, founderAgentIdeas.id))
    .where(eq(founderAgentPitches.runId, runId)) as PitchEntry[];

  // Get existing evaluations to support resume
  const existingEvals = await db.select({
    ideaId: founderAgentEvaluations.ideaId,
    status: founderAgentEvaluations.status,
  })
    .from(founderAgentEvaluations)
    .where(eq(founderAgentEvaluations.runId, runId));

  const completedIdeaIds = new Set(
    existingEvals
      .filter((e: { ideaId: number; status: string }) => e.status === "completed")
      .map((e: { ideaId: number; status: string }) => e.ideaId)
  );

  // Ensure evaluation rows exist for all pitches (idempotent)
  for (const { pitch, idea } of pitches) {
    if (completedIdeaIds.has(idea.id)) continue;
    const alreadyQueued = existingEvals.some(
      (e: { ideaId: number; status: string }) => e.ideaId === idea.id
    );
    if (!alreadyQueued) {
      await db.insert(founderAgentEvaluations).values({
        runId,
        ideaId: idea.id,
        pitchId: pitch.id,
        status: "queued",
      });
    }
  }

  // Load all queued evaluations
  const queuedEvals: FounderAgentEvaluation[] = await db.select()
    .from(founderAgentEvaluations)
    .where(and(eq(founderAgentEvaluations.runId, runId), eq(founderAgentEvaluations.status, "queued")));

  await incrementRunCounters(runId, { queued: queuedEvals.length });

  // Build pitch text lookup
  const pitchMap = new Map<number, PitchEntry>(
    pitches.map(({ pitch, idea }) => [idea.id, { pitch, idea }])
  );

  // Concurrency queue
  let activeCount = 0;
  let queueIndex = 0;

  const processNext = async (): Promise<void> => {
    if (queueIndex >= queuedEvals.length) return;
    const evalRow = queuedEvals[queueIndex++];
    activeCount++;

    const entry = pitchMap.get(evalRow.ideaId ?? 0);
    if (!entry) {
      activeCount--;
      return processNext();
    }

    const aborted = await waitIfPaused(runId);
    if (aborted) { activeCount--; return; }

    const { pitch, idea } = entry;
    const pitchText = [
      `Problem: ${pitch.problem}`,
      `Solution: ${pitch.solution}`,
      `Target Market: ${pitch.targetMarket}`,
      `Business Model: ${pitch.businessModel}`,
      `Competitive Advantage: ${pitch.competitiveAdvantage}`,
      `Key Risk: ${pitch.keyRisk}`,
      `Funding Ask: ${pitch.fundingAsk}`,
    ].join("\n");

    // Mark as running
    const dbInner = await requireDb();
    await dbInner.update(founderAgentEvaluations)
      .set({ status: "running", updatedAt: Date.now() })
      .where(eq(founderAgentEvaluations.id, evalRow.id));
    await incrementRunCounters(runId, { queued: -1, running: 1 });

    const startMs = Date.now();
    try {
      const councilResult = await runCouncil(pitchText, { councilMode: "global_vc" });
      const durationMs = Date.now() - startMs;

      // Map verdict → fleet classification
      // APPROVED → ENGAGE (75-100), APPROVED_WITH_CONDITIONS → WATCH (50-79), all else → PASS (0-49)
      const rawClassification =
        councilResult.verdict === "APPROVED" ? "ENGAGE"
        : councilResult.verdict === "APPROVED_WITH_CONDITIONS" ? "WATCH"
        : "PASS";

      const classificationScore = classificationToScore(rawClassification);
      const executionScore = deriveExecutionScore(councilResult);
      const marketScore = deriveMarketScore(councilResult);
      const finalScore = computeFinalScore(classificationScore, executionScore, marketScore);

      const strengths = councilResult.conditionsToProceed.slice(0, 3);
      const concerns = councilResult.blockingIssues.slice(0, 3);
      const flags = councilResult.hardFlags.slice(0, 3);
      const agentDisagreements = councilResult.votes
        .filter((v) => v.vote === "HARD_NO" || v.vote === "HARD_YES")
        .map((v) => `${v.personaName}: ${v.vote}`)
        .slice(0, 3);

      const recommendedAction =
        rawClassification === "ENGAGE" ? "Run full evaluation"
        : rawClassification === "WATCH" ? "Request more information"
        : "No action required";

      await dbInner.update(founderAgentEvaluations).set({
        status: "completed",
        classification: rawClassification,
        classificationScore,
        executionScore,
        marketScore,
        finalScore,
        strengths:          JSON.stringify(strengths),
        concerns:           JSON.stringify(concerns),
        flags:              JSON.stringify(flags),
        agentDisagreements: JSON.stringify(agentDisagreements),
        recommendedAction,
        durationMs,
        updatedAt: Date.now(),
      }).where(eq(founderAgentEvaluations.id, evalRow.id));

      await incrementRunCounters(runId, { completed: 1, running: -1 });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      await dbInner.update(founderAgentEvaluations).set({
        status: "failed",
        errorMessage: String(err).slice(0, 500),
        durationMs,
        updatedAt: Date.now(),
      }).where(eq(founderAgentEvaluations.id, evalRow.id));
      await incrementRunCounters(runId, { running: -1 });
    }

    activeCount--;
    await processNext();
  };

  // Launch up to maxConcurrent workers with stagger
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(maxConcurrent, queuedEvals.length); i++) {
    await sleep(i * staggerMs);
    workers.push(processNext());
  }

  await Promise.all(workers);
  // suppress unused variable warning
  void activeCount;
}

// ── Step 7: Pattern extraction (1 Sonnet call over 3-sentence summaries) ──────
async function extractInsights(runId: number, acc: CostAccumulator): Promise<void> {
  const db = await requireDb();

  interface EvalJoinRow {
    eval: FounderAgentEvaluation;
    pitch: FounderAgentPitch;
    idea: FounderAgentIdea;
  }

  const evals: EvalJoinRow[] = await db.select({
    eval: founderAgentEvaluations,
    pitch: founderAgentPitches,
    idea: founderAgentIdeas,
  })
    .from(founderAgentEvaluations)
    .innerJoin(founderAgentPitches, eq(founderAgentEvaluations.pitchId, founderAgentPitches.id))
    .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
    .where(and(
      eq(founderAgentEvaluations.runId, runId),
      eq(founderAgentEvaluations.status, "completed"),
    )) as EvalJoinRow[];

  if (evals.length === 0) return;

  const dataForInsights = evals.map((e: EvalJoinRow) => ({
    domain:         e.idea.domain,
    subSector:      e.idea.subSector,
    founderName:    e.idea.founderName,
    fundingStage:   e.idea.fundingStage,
    targetRegion:   e.idea.targetRegion,
    summary:        e.pitch.summary3s,
    classification: e.eval.classification,
    finalScore:     e.eval.finalScore,
    executionScore: e.eval.executionScore,
    marketScore:    e.eval.marketScore,
    concerns:       JSON.parse(e.eval.concerns ?? "[]") as string[],
    strengths:      JSON.parse(e.eval.strengths ?? "[]") as string[],
  }));

  const prompt = `You are analysing the results of 100 autonomous founder simulations evaluated by an investment council.

Dataset (${evals.length} evaluated pitches):
${JSON.stringify(dataForInsights, null, 0)}

Return ONLY a JSON object with these exact keys:
{
  "highScorePatterns": [5 specific patterns found in pitches with finalScore >= 70, grounded in actual data],
  "lowScorePatterns": [5 specific patterns found in pitches with finalScore < 40, grounded in actual data],
  "failureReasons": [top 5 most common failure reasons across all runs, with frequency counts],
  "domainComparison": {
    "Fintech": {"avgScore": number, "count": number, "topConcern": string},
    "Healthtech": {"avgScore": number, "count": number, "topConcern": string},
    "Edtech": {"avgScore": number, "count": number, "topConcern": string},
    "Logistics": {"avgScore": number, "count": number, "topConcern": string},
    "B2B SaaS": {"avgScore": number, "count": number, "topConcern": string}
  },
  "improvementSuggestions": [5 specific, actionable suggestions for the bottom 30% of ideas by score],
  "idealPitchStructure": "A concise description of the pitch structure shared by the top 10% of ideas"
}

No generic statements. Every insight must be grounded in the actual data provided.`;

  // Retry with exponential backoff: 5s, 15s, 30s
  const RETRY_DELAYS = [5000, 15000, 30000];
  let resp: Awaited<ReturnType<typeof invokeLLM>> | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a startup investment analyst. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        model: SONNET,
        max_tokens: 3000,
      });
      break; // success
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        const delayMs = RETRY_DELAYS[attempt];
        console.warn(`[FleetOrchestrator] Insights LLM call failed (attempt ${attempt + 1}), retrying in ${delayMs / 1000}s:`, String(err).slice(0, 120));
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error("[FleetOrchestrator] Insights LLM call failed after all retries:", String(err).slice(0, 200));
        throw err;
      }
    }
  }
  if (!resp) return;
  const usage = extractUsage(resp);
  addLlmCost(acc, SONNET, usage.prompt_tokens || 20000, usage.completion_tokens || 2000);
  const content = extractContent(resp);

  interface InsightsRaw {
    highScorePatterns: string[];
    lowScorePatterns: string[];
    failureReasons: string[];
    domainComparison: Record<string, { avgScore: number; count: number; topConcern: string }>;
    improvementSuggestions: string[];
    idealPitchStructure: string;
  }

  let insights: InsightsRaw;

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    insights = JSON.parse(cleaned) as InsightsRaw;
  } catch {
    console.error("[FleetOrchestrator] Failed to parse insights:", content.slice(0, 200));
    return;
  }

  const insightData = {
    runId,
    highScorePatterns:      JSON.stringify(insights.highScorePatterns ?? []),
    lowScorePatterns:       JSON.stringify(insights.lowScorePatterns ?? []),
    failureReasons:         JSON.stringify(insights.failureReasons ?? []),
    domainComparison:       JSON.stringify(insights.domainComparison ?? {}),
    improvementSuggestions: JSON.stringify(insights.improvementSuggestions ?? []),
    idealPitchStructure:    insights.idealPitchStructure ?? "",
    rawJson:                content,
  };

  const existing = await db.select({ id: founderAgentInsights.id })
    .from(founderAgentInsights)
    .where(eq(founderAgentInsights.runId, runId))
    .limit(1);

  if (existing.length > 0) {
    await db.update(founderAgentInsights).set(insightData).where(eq(founderAgentInsights.runId, runId));
  } else {
    await db.insert(founderAgentInsights).values(insightData);
  }
}

// -- Fleet run options -------------------------------------------------------
export interface FleetOptions {
  /** Quick Test mode: 2 ideas/domain, 1 search/domain, 1 batch pitch call, 3 concurrent evals */
  quickTest?: boolean;
}
// -- Main orchestration entry point ------------------------------------------

export async function runFleet(runId: number, opts: FleetOptions = {}): Promise<void> {
  const { quickTest = false } = opts;
  fleetState.set(runId, { paused: false, abort: false });
  const acc: CostAccumulator = { searches: 0, llmCalls: 0, tokens: 0, costUsd: 0 };

  try {
    // Step 1: Generate ideas
    await updateRunStatus(runId, "generating", { startedAt: Date.now() });
    if (await waitIfPaused(runId)) { await updateRunStatus(runId, "paused"); return; }

    const ideaIds = await generateIdeas(runId, acc, quickTest ? { ideasPerDomain: 2 } : {});
    await saveCosts(runId, acc);

    // Step 2: Research
    await updateRunStatus(runId, "researching");
    if (await waitIfPaused(runId)) { await updateRunStatus(runId, "paused"); return; }

    const researchByDomain = await runResearch(runId, acc, quickTest ? { queriesPerDomain: 1 } : {});
    await saveCosts(runId, acc);

    // Step 3: Generate pitches
    await updateRunStatus(runId, "pitching");
    if (await waitIfPaused(runId)) { await updateRunStatus(runId, "paused"); return; }

    await generatePitches(runId, ideaIds, researchByDomain, acc);
    await saveCosts(runId, acc);

    // Step 4: Submit to mesh
    await updateRunStatus(runId, "evaluating");
    await submitToMesh(runId, acc, quickTest ? { maxConcurrent: 3, staggerMs: 1000 } : {});
    await saveCosts(runId, acc);

    if (fleetState.get(runId)?.abort) {
      await updateRunStatus(runId, "paused");
      return;
    }

    // Step 7: Extract insights
    await updateRunStatus(runId, "extracting");
    await extractInsights(runId, acc);
    await saveCosts(runId, acc);

    // Complete
    await updateRunStatus(runId, "completed", { completedAt: Date.now() });
  } catch (err) {
    console.error(`[FleetOrchestrator] Run ${runId} failed:`, err);
    await updateRunStatus(runId, "failed");
  } finally {
    fleetState.delete(runId);
  }
}

// ── Resume queued evaluations on server restart ───────────────────────────────
export async function resumeInterruptedRuns(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const interrupted = await db.select().from(founderAgentRuns)
    .where(inArray(founderAgentRuns.status, ["evaluating", "generating", "researching", "pitching", "extracting"]));

  for (const run of interrupted) {
    console.log(`[FleetOrchestrator] Resuming interrupted run ${run.id} (status: ${run.status})`);
    runFleet(run.id).catch((err) =>
      console.error(`[FleetOrchestrator] Resume of run ${run.id} failed:`, err)
    );
  }
}
