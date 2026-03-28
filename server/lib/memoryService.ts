/**
 * memoryService.ts — Self-Learning Loop: Phases 2 & 3
 *
 * Phase 2: Persist every Council decision + all votes to decision_memory and agent_votes_log.
 * Phase 3: TF-IDF similarity search → inject Top-3 past decisions as context.
 *
 * Uses TF-IDF keyword similarity computed in-process (no external vector DB or embedding API required).
 * Vectors are stored as JSON-serialised TF-IDF weight arrays in MySQL LONGTEXT columns.
 */

import { desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  decisionMemory,
  agentVotesLog,
  agentWeights,
  InsertDecisionMemory,
  InsertAgentVoteLog,
} from "../../drizzle/schema";
import type { CouncilResult, PersonaVote } from "../councilEngine";

// ── Text normalisation ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "this","that","these","those","it","its","we","our","you","your","they",
  "their","he","she","his","her","not","no","nor","so","yet","both","either",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// ── TF-IDF vector ─────────────────────────────────────────────────────────────

function buildTfVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  Array.from(freq.entries()).forEach(([term, count]) => tf.set(term, count / total));
  return tf;
}

function cosineSimilarityMaps(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  Array.from(a.entries()).forEach(([term, wa]) => {
    dot += wa * (b.get(term) ?? 0);
    normA += wa * wa;
  });
  Array.from(b.values()).forEach((wb) => { normB += wb * wb; });
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Serialise TF vector to JSON for storage ───────────────────────────────────

function serialiseTfVector(tf: Map<string, number>): string {
  return JSON.stringify(Object.fromEntries(Array.from(tf.entries())));
}

function deserialiseTfVector(json: string): Map<string, number> {
  try {
    const obj = JSON.parse(json) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

// ── Phase 2: Persist decision + votes ────────────────────────────────────────

export interface PersistDecisionInput {
  taskId?: string;
  taskDescription: string;
  taskDomain?: string;
  result: CouncilResult;
}

export async function persistDecision(input: PersistDecisionInput): Promise<number | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    // Build TF-IDF vector for the task description
    const tokens = tokenise(input.taskDescription);
    const tfVector = buildTfVector(tokens);
    const embeddingJson = serialiseTfVector(tfVector);

    // Insert decision memory row
    const memoryRow: InsertDecisionMemory = {
      taskId: input.taskId ?? null,
      taskDescription: input.taskDescription,
      taskDomain: input.taskDomain ?? null,
      embedding: embeddingJson,
      finalVerdict: input.result.verdict,
      confidenceScore: String(input.result.confidenceScore),
    };

    const [insertResult] = await db.insert(decisionMemory).values(memoryRow);
    const decisionMemoryId = (insertResult as { insertId: number }).insertId;

    if (!decisionMemoryId) {
      console.warn("[MemoryService] Failed to get insertId for decision_memory");
      return null;
    }

    // Insert one row per vote into agent_votes_log
    const voteRows: InsertAgentVoteLog[] = input.result.votes.map((v: PersonaVote) => ({
      decisionMemoryId,
      personaId: v.personaId,
      personaName: v.personaName,
      vote: v.vote,
      confidence: String(v.confidence),
      rationale: v.rationale,
      wasCorrect: null,
      scoredAt: null,
    }));

    if (voteRows.length > 0) {
      await db.insert(agentVotesLog).values(voteRows);
    }

    console.log(`[MemoryService] Persisted decision ${decisionMemoryId} with ${voteRows.length} votes`);
    return decisionMemoryId;
  } catch (err) {
    // Never block the main Council flow
    console.warn("[MemoryService] persistDecision failed silently:", err);
    return null;
  }
}

// ── Phase 3: Memory retrieval — Top-K similar past decisions ─────────────────

export interface SimilarDecision {
  id: number;
  taskDescription: string;
  taskDomain: string | null;
  finalVerdict: string | null;
  confidenceScore: string | null;
  similarity: number;
  createdAt: Date;
}

export async function findSimilarDecisions(
  taskDescription: string,
  topK = 3,
  domain?: string
): Promise<SimilarDecision[]> {
  try {
    const db = await getDb();
    if (!db) return [];

    // Build query TF vector
    const queryTokens = tokenise(taskDescription);
    const queryTf = buildTfVector(queryTokens);
    if (queryTf.size === 0) return [];

    // Fetch recent decisions (last 500 to avoid full table scan)
    const rows = await db
      .select({
        id: decisionMemory.id,
        taskDescription: decisionMemory.taskDescription,
        taskDomain: decisionMemory.taskDomain,
        finalVerdict: decisionMemory.finalVerdict,
        confidenceScore: decisionMemory.confidenceScore,
        embedding: decisionMemory.embedding,
        createdAt: decisionMemory.createdAt,
      })
      .from(decisionMemory)
      .orderBy(desc(decisionMemory.createdAt))
      .limit(500);

    if (rows.length === 0) return [];

    // Compute TF-IDF cosine similarity for each row
    const scored = rows
      .filter((r) => {
        if (domain && r.taskDomain && r.taskDomain !== domain) return false;
        return true;
      })
      .map((r) => {
        const docTf = deserialiseTfVector(r.embedding);
        const sim = cosineSimilarityMaps(queryTf, docTf);
        return { ...r, similarity: sim };
      });

    // Sort by similarity descending, take topK
    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored.slice(0, topK);

    return top.map((r) => ({
      id: r.id,
      taskDescription: r.taskDescription,
      taskDomain: r.taskDomain,
      finalVerdict: r.finalVerdict,
      confidenceScore: r.confidenceScore,
      similarity: Math.round(r.similarity * 1000) / 1000,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn("[MemoryService] findSimilarDecisions failed silently:", err);
    return [];
  }
}

// ── Build memory context block for injection into Council prompts ─────────────

export function buildMemoryContext(similar: SimilarDecision[]): string {
  if (similar.length === 0) return "";

  const lines = similar.map((d, i) => {
    const score = (d.similarity * 100).toFixed(1);
    const verdict = d.finalVerdict ?? "UNKNOWN";
    const conf = d.confidenceScore ? ` (confidence ${d.confidenceScore})` : "";
    const domain = d.taskDomain ? ` [${d.taskDomain}]` : "";
    const preview = d.taskDescription.slice(0, 200);
    return `[${i + 1}] ${score}% match${domain} — Verdict: ${verdict}${conf}\n    Task: "${preview}..."`;
  });

  return (
    "COUNCIL MEMORY — TOP SIMILAR PAST DECISIONS:\n" +
    lines.join("\n") +
    "\n\nUse these precedents to calibrate your analysis. Similar past verdicts are informative but not binding."
  );
}

// ── Get current agent weights map ─────────────────────────────────────────────

export async function getAgentWeightsMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const db = await getDb();
    if (!db) return map;
    const rows = await db
      .select({ personaId: agentWeights.personaId, weight: agentWeights.weight })
      .from(agentWeights);
    for (const r of rows) {
      map.set(r.personaId, parseFloat(String(r.weight)));
    }
  } catch (err) {
    console.warn("[MemoryService] getAgentWeightsMap failed:", err);
  }
  return map;
}
