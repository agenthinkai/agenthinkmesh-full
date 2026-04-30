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
  founderAgentRunCosts, fleetConfig,
  FounderAgentIdea, FounderAgentPitch, FounderAgentEvaluation,
} from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { runCouncil } from "./councilEngine";
import { encryptWithMasterKey, decryptWithMasterKey } from "./cmk";

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

// ── GCC Institutional Fleet — domain config ───────────────────────────────────
export const GCC_FLEET_DOMAINS = [
  {
    name: "Islamic Finance",
    subSectors: ["Shariah-compliant lending", "sukuk issuance", "takaful", "waqf digitisation", "halal supply chain finance"],
  },
  {
    name: "GovTech & Smart Cities",
    subSectors: ["e-government services", "smart infrastructure", "digital identity", "public safety analytics", "citizen engagement"],
  },
  {
    name: "Energy Transition",
    subSectors: ["solar EPC", "green hydrogen", "carbon credits", "energy storage", "EV charging infrastructure"],
  },
  {
    name: "Healthcare & Wellness",
    subSectors: ["medical tourism", "preventive diagnostics", "home care", "mental health", "digital pharmacy"],
  },
  {
    name: "Logistics & Trade",
    subSectors: ["cross-border e-commerce", "free zone logistics", "cold chain", "port digitalisation", "last-mile delivery"],
  },
] as const;

export const GCC_COUNCIL_PERSONAS = [
  "Saudi Vision 2030 Fund Analyst",
  "UAE Family Office Principal",
  "Kuwait Investment Authority Associate",
  "Qatar Development Bank Director",
  "Bahrain Fintech Bay Advisor",
] as const;

function classifyShariahCompliance(domain: string, subSector: string): "Compliant" | "Non-compliant" | "Requires review" {
  const nonCompliantKeywords = ["interest", "conventional lending", "alcohol", "gambling", "pork", "tobacco", "weapons"];
  const compliantDomains = ["Islamic Finance", "GovTech & Smart Cities", "Energy Transition"];
  const combined = `${domain} ${subSector}`.toLowerCase();
  if (nonCompliantKeywords.some(k => combined.includes(k))) return "Non-compliant";
  if (compliantDomains.includes(domain)) return "Compliant";
  return "Requires review";
}


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
  tokens: number;       // total = input + output
  inputTokens: number;  // input only
  outputTokens: number; // output only
  costUsd: number;
}

function addLlmCost(
  acc: CostAccumulator,
  model: string,
  inputTokens: number,
  outputTokens: number,
): void {
  acc.llmCalls++;
  acc.inputTokens  += inputTokens;
  acc.outputTokens += outputTokens;
  acc.tokens       += inputTokens + outputTokens;
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
    // Actual token breakdown (updated incrementally)
    totalTokensInput:  acc.inputTokens,
    totalTokensOutput: acc.outputTokens,
    totalTokens:       acc.tokens,
    totalCostUsd:      acc.costUsd.toFixed(4),
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
async function generateIdeas(runId: number, acc: CostAccumulator, opts: { ideasPerDomain?: number; gccMode?: boolean } = {}): Promise<number[]> {
  const ideasPerDomain = opts.ideasPerDomain ?? 20;
  const { gccMode = false } = opts;
  const db = await requireDb();

  // Load existing fingerprints to avoid duplicates across runs
  // Load existing fingerprints once — shared across all domain calls to prevent cross-domain duplicates
  const existingRows = await db.select({ fp: founderAgentIdeas.ideaFingerprint }).from(founderAgentIdeas);
  const existingFingerprints = new Set(existingRows.map((r: { fp: string }) => r.fp));

  const domains = gccMode ? GCC_FLEET_DOMAINS : FLEET_DOMAINS;
  const insertedIds: number[] = [];

  interface IdeaRaw {
    domain: string; subSector: string; description: string;
    targetRegion: string; founderName: string; fundingStage: string; fundingAsk: string;
  }

  // ── Per-domain calls: batched at MAX_IDEAS_PER_LLM_CALL each to stay within output token budget ────
  // When ideasPerDomain > MAX_IDEAS_PER_LLM_CALL (e.g. GCC=40), we run multiple batches per domain.
  // This prevents JSON truncation that caused completed=0 on the first 200-idea GCC run.
  const MAX_IDEAS_PER_LLM_CALL = 20;
  for (const domain of domains) {
    const domainSubSectors = domain.subSectors.join(", ");
    const regionHint = gccMode ? "GCC (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman)" : "global emerging markets";
    const batchCount = Math.ceil(ideasPerDomain / MAX_IDEAS_PER_LLM_CALL);
    const batchSize = Math.min(ideasPerDomain, MAX_IDEAS_PER_LLM_CALL);
    let domainInserted = 0;
    for (let batch = 0; batch < batchCount; batch++) {
      const remaining = ideasPerDomain - domainInserted;
      const thisBatch = Math.min(batchSize, remaining);
      if (thisBatch <= 0) break;
      const prompt = `Generate exactly ${thisBatch} unique, credible early-stage startup ideas for the domain: ${domain.name}.
Sub-sectors to cover (one idea per sub-sector): ${domainSubSectors}
Target region: ${regionHint}
CRITICAL QUALITY RULES — every idea MUST include all four of these:
1. FOUNDER UNFAIR ADVANTAGE: A specific prior role, network, or domain expertise that gives this founder an edge no generalist has.
2. TRACTION SIGNAL: Minimum 2 paying customers, signed LOIs, or active pilots. Not "seeking" or "planning" — something already secured and verifiable.
3. DEFENSIBLE MOAT: A specific moat that is NOT just "AI-powered" or "first mover" — e.g. proprietary data, exclusive distribution, regulatory licence, switching costs, or network effects.
4. WHY NOW / WHY THIS FOUNDER: A specific market timing insight or structural change that makes this the right moment, and why this specific founder is positioned to capture it.
Other rules:
- No duplicates (check against existing ideas listed below)
- Each idea must cover a different sub-sector within ${domain.name}
- Return ONLY a JSON array of ${thisBatch} objects, no markdown, no explanation
Each object must have these exact keys:
{
  "domain": string (must be "${domain.name}"),
  "subSector": string,
  "description": string (2-3 sentences: what they build, founder background, traction signal — max 280 chars),
  "targetRegion": string,
  "founderName": string (realistic full name matching the target region),
  "fundingStage": string (MUST be one of: "Seed", "Series A") — Pre-seed is NOT allowed,
  "fundingAsk": string — MUST be between $1M and $15M (e.g. "$1.5M", "$3M", "$8M") — no pre-seed asks below $1M
}
Existing idea fingerprints to avoid (domain|subSector|description):
${Array.from(existingFingerprints).slice(0, 200).join("\n") || "None yet"}`;

      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a startup idea generator. Return only valid JSON arrays." },
          { role: "user", content: prompt },
        ],
        model: HAIKU,
        max_tokens: 2000,
      });
      const usage = extractUsage(resp);
      addLlmCost(acc, HAIKU, usage.prompt_tokens || 800, usage.completion_tokens || 800);
      const rawContent = extractContent(resp);
      let batchIdeas: IdeaRaw[] = [];
      try {
        const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        batchIdeas = JSON.parse(cleaned) as IdeaRaw[];
      } catch {
        console.error(`[FleetOrchestrator] Failed to parse ideas JSON for domain ${domain.name} batch ${batch + 1}:`, rawContent.slice(0, 200));
        continue; // skip this batch, try next
      }
      // Deduplicate and insert for this batch
      const toInsert = batchIdeas.filter((idea: IdeaRaw) => {
        const fp = fingerprint(idea.domain, idea.subSector, idea.description);
        if (existingFingerprints.has(fp)) return false;
        existingFingerprints.add(fp);
        return true;
      }).slice(0, thisBatch);
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
        if (insertId) { insertedIds.push(insertId); domainInserted++; }
      }
      console.log(`[FleetOrchestrator] Domain "${domain.name}" batch ${batch + 1}/${batchCount}: ${toInsert.length} ideas inserted (domain total: ${domainInserted})`);
    }
  }

  await db.update(founderAgentRuns).set({ totalIdeas: insertedIds.length }).where(eq(founderAgentRuns.id, runId));
  return insertedIds;
}

// ── Step 2: Research in batches (max 3 searches per domain) ───────────────────
async function runResearch(
  runId: number,
  acc: CostAccumulator,
  opts: { queriesPerDomain?: number; gccMode?: boolean } = {},
): Promise<Record<string, string>> {
  const queriesPerDomain = opts.queriesPerDomain ?? 3;
  const db = await requireDb();
  const researchByDomain: Record<string, string> = {};
  const researchDomains = opts.gccMode ? GCC_FLEET_DOMAINS : FLEET_DOMAINS;
  for (const domain of researchDomains) {
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
      // Rate limit backoff for research calls
      let resp!: Awaited<ReturnType<typeof invokeLLM>>;
      {
        const BACKOFF_DELAYS_R = [60_000, 120_000, 180_000];
        let lastErrR: unknown;
        let succeededR = false;
        for (let attemptR = 0; attemptR <= BACKOFF_DELAYS_R.length; attemptR++) {
          try {
            resp = await invokeLLM({
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
            succeededR = true;
            break;
          } catch (retryErrR) {
            const msgR = String(retryErrR);
            const isRateLimitR = msgR.includes("412") || msgR.toLowerCase().includes("rate limit");
            if (isRateLimitR && attemptR < BACKOFF_DELAYS_R.length) {
              const waitMsR = BACKOFF_DELAYS_R[attemptR];
              console.warn(
                `[FleetOrchestrator] Rate limit hit (research) — waiting ${waitMsR / 1000}s before retry (attempt ${attemptR + 1}/3)`
              );
              await sleep(waitMsR);
              lastErrR = retryErrR;
            } else {
              throw retryErrR;
            }
          }
        }
        if (!succeededR) throw lastErrR;
      }
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
  opts: { gccMode?: boolean } = {},
): Promise<void> {
  const db = await requireDb();
  const ideas = await db.select().from(founderAgentIdeas)
    .where(and(eq(founderAgentIdeas.runId, runId), inArray(founderAgentIdeas.id, ideaIds)));
  const pitchDomains = opts.gccMode ? GCC_FLEET_DOMAINS : FLEET_DOMAINS;
  for (const domain of pitchDomains) {
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

async function submitToMesh(runId: number, acc: CostAccumulator, opts: { maxConcurrent?: number; staggerMs?: number; gccMode?: boolean; bypassCostGuard?: boolean } = {}): Promise<void> {
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
        fleetMode: opts.gccMode ? "gcc" : "global",
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
      // Rate limit backoff: 60s → 120s → 180s, max 3 retries
      let councilResult!: Awaited<ReturnType<typeof runCouncil>>;
      {
        const BACKOFF_DELAYS = [60_000, 120_000, 180_000];
        let lastErr: unknown;
        let succeeded = false;
        for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
          try {
            councilResult = await runCouncil(pitchText, { councilMode: "global_vc", bypassCostGuard: opts.bypassCostGuard ?? false });
            succeeded = true;
            break;
          } catch (retryErr) {
            const msg = String(retryErr);
            const isRateLimit = msg.includes("412") || msg.toLowerCase().includes("rate limit");
            if (isRateLimit && attempt < BACKOFF_DELAYS.length) {
              const waitMs = BACKOFF_DELAYS[attempt];
              console.warn(
                `[FleetOrchestrator] Rate limit hit — waiting ${waitMs / 1000}s before retry (attempt ${attempt + 1}/3)`
              );
              await sleep(waitMs);
              lastErr = retryErr;
            } else {
              throw retryErr;
            }
          }
        }
        if (!succeeded) throw lastErr;
      }
      const durationMs = Date.now() - startMs;

      // Map verdict → fleet classification
      // Fleet uses a score-first approach to avoid the INSUFFICIENT_DATA gate
      // (synthetic pitches lack the financial/traction data that boosts agent confidence,
      //  so the council's confidence gate fires too aggressively for fleet use).
      //
      // Priority order:
      //   1. VETOED → always PASS (hard regulatory/compliance block)
      //   2. APPROVED → ENGAGE
      //   3. APPROVED_WITH_CONDITIONS → WATCH
      //   4. For INSUFFICIENT_DATA / REJECTED: fall back to raw finalScore:
      //      finalScore >= 0.48 → ENGAGE, >= 0.34 → WATCH, else → PASS
      //      This surfaces strong ideas even when the council lacks full data confidence.
      let rawClassification: "ENGAGE" | "WATCH" | "PASS";
      if (councilResult.verdict === "VETOED") {
        rawClassification = "PASS";
      } else if (councilResult.verdict === "APPROVED") {
        rawClassification = "ENGAGE";
      } else if (councilResult.verdict === "APPROVED_WITH_CONDITIONS") {
        rawClassification = "WATCH";
      } else {
        // INSUFFICIENT_DATA or REJECTED — use raw finalScore as tiebreaker
        const fs = councilResult.finalScore; // 0.0–1.0
        rawClassification = fs >= 0.48 ? "ENGAGE" : fs >= 0.34 ? "WATCH" : "PASS";
      }

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

      // Per-eval token tracking: estimate from council run (10 agents × Haiku)
      // These are estimates since councilEngine doesn't expose per-call usage
      const evalInputTokens  = 10 * 3000;  // ~3000 input tokens per agent
      const evalOutputTokens = 10 * 2048;  // ~2048 output tokens per agent
      const evalTokensTotal  = evalInputTokens + evalOutputTokens;
      const evalCostUsd      =
        (evalInputTokens  / 1000) * 0.00025 +   // Haiku input
        (evalOutputTokens / 1000) * 0.00125;     // Haiku output
      // Add to run accumulator
      acc.inputTokens  += evalInputTokens;
      acc.outputTokens += evalOutputTokens;
      acc.tokens       += evalTokensTotal;
      acc.costUsd      += evalCostUsd;
      acc.llmCalls     += 10;
      await dbInner.update(founderAgentEvaluations).set({
        status: "completed",
        classification: rawClassification,
        classificationScore,
        executionScore,
        marketScore,
        finalScore,
        strengths:          encryptWithMasterKey(JSON.stringify(strengths)),
        concerns:           encryptWithMasterKey(JSON.stringify(concerns)),
        flags:              encryptWithMasterKey(JSON.stringify(flags)),
        agentDisagreements: JSON.stringify(agentDisagreements),
        recommendedAction:  encryptWithMasterKey(recommendedAction),
        durationMs,
        tokensInput:  evalInputTokens,
        tokensOutput: evalOutputTokens,
        tokensTotal:  evalTokensTotal,
        costUsd:      evalCostUsd.toFixed(6),
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



// ── GCC: Assign Shariah compliance flags to evaluations ──────────────────────
async function assignShariahCompliance(runId: number): Promise<void> {
  const db = await requireDb();
  const rows = await db.select({
    evalId: founderAgentEvaluations.id,
    domain: founderAgentIdeas.domain,
    subSector: founderAgentIdeas.subSector,
  })
    .from(founderAgentEvaluations)
    .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
    .where(and(
      eq(founderAgentEvaluations.runId, runId),
      eq(founderAgentEvaluations.status, "completed"),
    ));
  for (const row of rows) {
    const compliance = classifyShariahCompliance(row.domain, row.subSector);
    await db.update(founderAgentEvaluations)
      .set({ shariahCompliance: compliance, updatedAt: Date.now() })
      .where(eq(founderAgentEvaluations.id, row.evalId));
  }
  console.log(`[FleetOrchestrator] Assigned Shariah compliance for run ${runId}`);
}

// ── GCC: Assign simulated decision outcomes based on score thresholds ─────────
async function assignDecisionOutcomes(runId: number): Promise<void> {
  const db = await requireDb();
  const rows = await db.select({
    id: founderAgentEvaluations.id,
    classification: founderAgentEvaluations.classification,
    finalScore: founderAgentEvaluations.finalScore,
  })
    .from(founderAgentEvaluations)
    .where(and(
      eq(founderAgentEvaluations.runId, runId),
      eq(founderAgentEvaluations.status, "completed"),
    ));
  for (const row of rows) {
    // ENGAGE (top 20%) → "invested", WATCH (middle 40%) → null (watch), PASS (bottom 40%) → "passed"
    const outcome: string | null =
      row.classification === "ENGAGE" ? "invested" :
      row.classification === "PASS"   ? "passed"   : null;
    if (outcome !== null) {
      await db.update(founderAgentEvaluations)
        .set({ decisionOutcome: outcome, updatedAt: Date.now() })
        .where(eq(founderAgentEvaluations.id, row.id));
    }
  }
  console.log(`[FleetOrchestrator] Assigned decision outcomes for run ${runId}`);
}

// ── Step 6b: Percentile-based re-ranking (guarantees 20/40/40 distribution) ──
async function reRankByPercentile(runId: number): Promise<void> {
  const db = await requireDb();
  // Join with ideas to get domain for diversity cap
  const rows = await db.select({
    id:             founderAgentEvaluations.id,
    executionScore: founderAgentEvaluations.executionScore,
    marketScore:    founderAgentEvaluations.marketScore,
    domain:         founderAgentIdeas.domain,
  })
    .from(founderAgentEvaluations)
    .innerJoin(founderAgentIdeas, eq(founderAgentEvaluations.ideaId, founderAgentIdeas.id))
    .where(and(
      eq(founderAgentEvaluations.runId, runId),
      eq(founderAgentEvaluations.status, "completed"),
    ));
  if (rows.length === 0) return;
  // Sort by composite score DESC (ties broken by id ASC for determinism)
  rows.sort((a, b) => {
    const aScore = (a.executionScore ?? 0) / 100 * 0.6 + (a.marketScore ?? 0) / 100 * 0.4;
    const bScore = (b.executionScore ?? 0) / 100 * 0.6 + (b.marketScore ?? 0) / 100 * 0.4;
    if (bScore !== aScore) return bScore - aScore;
    return (a.id ?? 0) - (b.id ?? 0);
  });
  const n = rows.length;
  const engageCutoff = Math.round(n * 0.20); // top 20%
  const watchCutoff  = Math.round(n * 0.60); // top 60% (20% ENGAGE + 40% WATCH)
  // Domain diversity cap: max 4 ENGAGE per domain per run (resets each run, not cumulative)
  const DOMAIN_ENGAGE_CAP = 4;
  const domainEngageCount: Record<string, number> = {};
  let capAppliedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rawClassification: "ENGAGE" | "WATCH" | "PASS" =
      i < engageCutoff ? "ENGAGE" :
      i < watchCutoff  ? "WATCH"  : "PASS";
    // Apply domain diversity cap to ENGAGE verdicts
    if (rawClassification === "ENGAGE") {
      const domain = row.domain ?? "Unknown";
      const currentCount = domainEngageCount[domain] ?? 0;
      if (currentCount >= DOMAIN_ENGAGE_CAP) {
        // Downgrade to WATCH — domain cap reached
        console.log(`[FleetOrchestrator] [${domain}] ENGAGE cap reached — downgrading to WATCH (eval id=${row.id})`);
        rawClassification = "WATCH";
        capAppliedCount++;
      } else {
        domainEngageCount[domain] = currentCount + 1;
      }
    }
    const classificationScore = classificationToScore(rawClassification);
    const finalScore = computeFinalScore(
      classificationScore,
      row.executionScore ?? 0,
      row.marketScore    ?? 0,
    );
    // If this was a cap downgrade, note it in the recommended action
    const wasCapDowngraded = rawClassification === "WATCH" && i < engageCutoff;
    const recommendedAction =
      rawClassification === "ENGAGE" ? "Run full evaluation"
      : wasCapDowngraded
        ? "Domain cap applied — strong deal but sector quota reached for this run"
        : rawClassification === "WATCH" ? "Request more information"
        : "No action required";
    await db.update(founderAgentEvaluations).set({
      classification:      rawClassification,
      classificationScore,
      finalScore,
      recommendedAction:  encryptWithMasterKey(recommendedAction),
      updatedAt: Date.now(),
    }).where(eq(founderAgentEvaluations.id, row.id!));
  }
  const engageTotal = Object.values(domainEngageCount).reduce((a, b) => a + b, 0);
  console.log(`[FleetOrchestrator] Re-ranked run ${runId}: ENGAGE=${engageTotal}, WATCH=${watchCutoff - engageCutoff + capAppliedCount}, PASS=${n - watchCutoff}${capAppliedCount > 0 ? ` (${capAppliedCount} domain cap downgrades)` : ""}`);
}

// ── Step 7: Pattern extraction (1 Sonnet call over 3-sentence summaries) ──────
async function extractInsights(runId: number, acc: CostAccumulator, fleetMode: "global" | "gcc" = "global"): Promise<void> {
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
    concerns:       JSON.parse(decryptWithMasterKey(e.eval.concerns) ?? "[]") as string[],
    strengths:      JSON.parse(decryptWithMasterKey(e.eval.strengths) ?? "[]") as string[],
  }));

  // ── Prompt selection: GCC variant vs global ─────────────────────────────
  const gccPrompt = `You are analysing the results of ${evals.length} autonomous founder simulations evaluated by a GCC Institutional Investment Council.
Dataset (${evals.length} evaluated pitches):
${JSON.stringify(dataForInsights, null, 0)}
Return ONLY a JSON object with these exact keys:
{
  "highScorePatterns": [5 specific patterns found in pitches with finalScore >= 55, grounded in actual data, referencing GCC-specific strengths],
  "lowScorePatterns": [5 specific patterns found in pitches with finalScore < 40, grounded in actual data, referencing GCC-specific weaknesses],
  "failureReasons": [top 5 most common failure reasons across all runs, with frequency counts and GCC context],
  "domainComparison": {
    "Islamic Finance": {"avgScore": number, "count": number, "topConcern": string},
    "GovTech": {"avgScore": number, "count": number, "topConcern": string},
    "Energy Transition": {"avgScore": number, "count": number, "topConcern": string},
    "Healthcare": {"avgScore": number, "count": number, "topConcern": string},
    "Logistics": {"avgScore": number, "count": number, "topConcern": string}
  },
  "improvementSuggestions": [5 specific, actionable suggestions for the bottom 30% of ideas by score, framed for GCC institutional investors],
  "idealPitchStructure": "A concise description of the pitch structure shared by pitches with finalScore >= 55 (top performers), highlighting GCC-specific success factors"
}
Evaluate each pitch across these GCC-specific dimensions:
1. Vision 2030 / UAE Net Zero alignment — Strong / Partial / None
2. Shariah revenue model (halal, riba-free, no prohibited activities) — Compliant / Requires Review / Non-compliant
3. GCC regulatory readiness (SAMA, CBUAE, CMA Kuwait, DFSA, CBB — licence or sandbox pathway defined) — Clear / Unclear / Not addressed
4. Family office / sovereign fund fit (KIA, QIA, Mubadala, PIF, ADQ appeal) — Strong fit / Possible / Unlikely
5. Localisation depth (Arabic language support, local hiring mandate, GCC data residency) — Deep / Surface / None
No generic statements. Every insight must be grounded in the actual data provided.`;

  const globalPrompt = `You are analysing the results of 100 autonomous founder simulations evaluated by an investment council.
Dataset (${evals.length} evaluated pitches):
${JSON.stringify(dataForInsights, null, 0)}
Return ONLY a JSON object with these exact keys:
{
  "highScorePatterns": [5 specific patterns found in pitches with finalScore >= 55, grounded in actual data],
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
  "idealPitchStructure": "A concise description of the pitch structure shared by pitches with finalScore >= 55 (top performers)"
}
No generic statements. Every insight must be grounded in the actual data provided.`;

  // Select prompt based on fleet mode
  const prompt = fleetMode === "gcc" ? gccPrompt : globalPrompt;

  // ── Haiku-first with Sonnet fallback ─────────────────────────────────────
  // Run Haiku first (94% cheaper). If ranking_stability check fails, re-run with Sonnet.
  const RETRY_DELAYS = [5000, 15000, 30000];
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: "You are a startup investment analyst. Return only valid JSON." },
    { role: "user", content: prompt },
  ];

  async function callWithRetry(model: string): Promise<Awaited<ReturnType<typeof invokeLLM>>> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        return await invokeLLM({ messages, model, max_tokens: 3000 });
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_DELAYS.length) {
          const delayMs = RETRY_DELAYS[attempt];
          console.warn(`[FleetOrchestrator] Insights (${model}) failed (attempt ${attempt + 1}), retrying in ${delayMs / 1000}s:`, String(err).slice(0, 120));
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    console.error(`[FleetOrchestrator] Insights (${model}) failed after all retries:`, String(lastErr).slice(0, 200));
    throw lastErr;
  }

  function rankingStabilityScore(parsed: { lowScorePatterns?: string[] }): number {
    const lsp = parsed.lowScorePatterns ?? [];
    const top5Relevant = lsp.some((p: string) => /fintech|b2b|saas|payment|compliance/i.test(p));
    const bottom5Relevant = lsp.some((p: string) => /logistic|edtech|execution|moat|generic/i.test(p));
    const capturesIdenticalPass = lsp.some((p: string) => /identical|standardized|same.*score|33/i.test(p));
    return (top5Relevant ? 1 : 0) + (bottom5Relevant ? 1 : 0) + (capturesIdenticalPass ? 1 : 0) + (lsp.length >= 5 ? 1 : 0);
  }

  // Step 1: Try Haiku
  let resp = await callWithRetry(HAIKU);
  let usedModel = HAIKU;
  let usage = extractUsage(resp);
  addLlmCost(acc, HAIKU, usage.prompt_tokens || 14732, usage.completion_tokens || 1240);

  // Step 2: Parse and check ranking_stability
  let rawContent = extractContent(resp);
  let parsedCheck: { lowScorePatterns?: string[] } | null = null;
  try {
    const c = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsedCheck = JSON.parse(c) as { lowScorePatterns?: string[] };
  } catch { /* will fall through to Sonnet */ }

  if (!parsedCheck || rankingStabilityScore(parsedCheck) < 4) {
    console.log(`[FleetOrchestrator] Haiku ranking_stability < 4 (score=${parsedCheck ? rankingStabilityScore(parsedCheck) : 'parse_fail'}), escalating to Sonnet`);
    resp = await callWithRetry(SONNET);
    usedModel = SONNET;
    usage = extractUsage(resp);
    addLlmCost(acc, SONNET, usage.prompt_tokens || 20000, usage.completion_tokens || 2000);
    rawContent = extractContent(resp);
  } else {
    console.log(`[FleetOrchestrator] Haiku insights passed ranking_stability check (score=${rankingStabilityScore(parsedCheck)}), skipping Sonnet`);
  }

  const content = rawContent;
  void usedModel; // suppress unused warning

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
    highScorePatterns:      encryptWithMasterKey(JSON.stringify(insights.highScorePatterns ?? [])) ?? "",
    lowScorePatterns:       encryptWithMasterKey(JSON.stringify(insights.lowScorePatterns ?? [])) ?? "",
    failureReasons:         encryptWithMasterKey(JSON.stringify(insights.failureReasons ?? [])) ?? "",
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
  /** GCC Institutional mode: use GCC_FLEET_DOMAINS + GCC council personas + Shariah compliance scoring */
  gccMode?: boolean;
  /** Test run flag: if true, skip simulated outcome assignment (keeps test data out of pattern engine) */
  isTestRun?: boolean;
  /** Bypass cost guard for fleet runs — skips rate/spend check in councilEngine */
  bypassCostGuard?: boolean;
  /** Override ideas per domain (default: 20). GCC fleet uses 40 (→200 total), Global uses 60 (→300 total) */
  ideasPerDomain?: number;
  /**
   * Batch mode for multi-batch global runs.
   *
   * - "single" (default): existing behaviour — run all steps, set status=completed at end.
   * - "first":  first batch of N — skip final post-processing, set status="running" when done.
   * - "middle": intermediate batch — skip final post-processing, keep status="running".
   * - "last":   final batch — run all post-processing steps and set status="completed" as normal.
   *
   * GCC and all existing callers omit this option (defaults to "single"), so behaviour
   * is completely unchanged for them.
   */
  batchMode?: "single" | "first" | "middle" | "last";
}
// -- Main orchestration entry point ------------------------------------------

export async function runFleet(runId: number, opts: FleetOptions = {}): Promise<void> {
  const { quickTest = false, isTestRun = false, bypassCostGuard = false, ideasPerDomain, batchMode = "single" } = opts;
  // Derive whether this batch should finalise the run (run post-processing + set completed)
  const isFinalBatch = batchMode === "single" || batchMode === "last";
  fleetState.set(runId, { paused: false, abort: false });
  const acc: CostAccumulator = { searches: 0, llmCalls: 0, tokens: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

  try {
    // Step 1: Generate ideas
    await updateRunStatus(runId, "generating", { startedAt: Date.now() });
    if (await waitIfPaused(runId)) { await updateRunStatus(runId, "paused"); return; }

    const ideaIds = await generateIdeas(runId, acc, quickTest ? { ideasPerDomain: 2 } : { ideasPerDomain, gccMode: opts.gccMode });
    await saveCosts(runId, acc);

    // Step 2: Research
    await updateRunStatus(runId, "researching");
    if (await waitIfPaused(runId)) { await updateRunStatus(runId, "paused"); return; }

    const researchByDomain = await runResearch(runId, acc, quickTest ? { queriesPerDomain: 1, gccMode: opts.gccMode } : { gccMode: opts.gccMode });
    await saveCosts(runId, acc);

    // Step 3: Generate pitches
    await updateRunStatus(runId, "pitching");
    if (await waitIfPaused(runId)) { await updateRunStatus(runId, "paused"); return; }

    await generatePitches(runId, ideaIds, researchByDomain, acc, { gccMode: opts.gccMode });
    await saveCosts(runId, acc);

    // Step 4: Submit to mesh
    await updateRunStatus(runId, "evaluating");
    await submitToMesh(runId, acc, quickTest
      ? { maxConcurrent: 3, staggerMs: 1000, gccMode: opts.gccMode, bypassCostGuard }
      : { gccMode: opts.gccMode, bypassCostGuard });
    await saveCosts(runId, acc);

    if (fleetState.get(runId)?.abort) {
      await updateRunStatus(runId, "paused");
      return;
    }

    if (isFinalBatch) {
      // Final batch (or single run): run all post-processing steps and mark completed
      // Step 6b: Re-rank by percentile to guarantee 20/40/40 distribution
      await reRankByPercentile(runId);
      await saveCosts(runId, acc);
      // Step 6c: Assign simulated outcomes — skipped for test runs (keeps test data out of pattern engine)
      if (!isTestRun) {
        await assignDecisionOutcomes(runId);
        await saveCosts(runId, acc);
      } else {
        console.log(`[FleetOrchestrator] Skipping outcome assignment for test run ${runId}`);
      }
      // Step 7: Extract insights
      await updateRunStatus(runId, "extracting");
      await extractInsights(runId, acc, opts.gccMode ? "gcc" : "global");
      await saveCosts(runId, acc);

      // Complete
      await updateRunStatus(runId, "completed", { completedAt: Date.now() });
      // Aggregate run cost to fleet_config
      try {
        const db2 = await requireDb();
        const [runRow] = await db2.select({
          fleetMode: founderAgentRuns.fleetMode,
          totalCostUsd: founderAgentRuns.totalCostUsd,
        }).from(founderAgentRuns).where(eq(founderAgentRuns.id, runId)).limit(1);
        if (runRow) {
          const runCost = parseFloat(String(runRow.totalCostUsd ?? "0"));
          await db2.update(fleetConfig)
            .set({
              lastRunCostUsd: runCost.toFixed(4),
              totalCostUsd: sql`total_cost_usd + ${runCost.toFixed(4)}`,
            })
            .where(eq(fleetConfig.fleetMode, runRow.fleetMode));
          console.log(`[FleetOrchestrator] Updated fleet_config cost for ${runRow.fleetMode}: lastRunCost=$${runCost.toFixed(4)}`);
        }
      } catch (costErr) {
        console.warn("[FleetOrchestrator] fleet_config cost update failed (non-fatal):", costErr);
      }
    } else {
      // Intermediate batch (first or middle): keep status=evaluating so the run stays
      // visibly in-progress while the next batch starts. The scheduler loop will
      // continue with the next batch immediately after this function returns.
      await updateRunStatus(runId, "evaluating");
      console.log(`[FleetOrchestrator] Run ${runId}: batch (${batchMode}) complete — status=evaluating, ready for next batch`);
    }
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
