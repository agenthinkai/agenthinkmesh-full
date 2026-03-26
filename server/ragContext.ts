/**
 * ragContext.ts — Shared RAG Knowledge Vault retrieval helper
 * Used by forecastEngine.ts and routers.ts (runAgentTask)
 * Retrieves top-K relevant GCC scenarios from knowledge_scenarios table
 * and returns a formatted context block for injection into LLM system prompts.
 */
import { and, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { knowledgeScenarios } from "../drizzle/schema";

type KnowledgeDomain = typeof knowledgeScenarios.domain.enumValues[number];

export interface RagScenario {
  scenarioId: string;
  domain: string;
  title: string;
  summary: string;
  geography: string | null;
  sector: string | null;
}

export interface RagResult {
  ragContext: string;          // formatted block to prepend to system prompt
  ragScenarioIds: string[];    // IDs of scenarios used
  scenarios: RagScenario[];
}

/**
 * Retrieve top-K relevant GCC scenarios from the Knowledge Vault.
 * Uses keyword-based relevance scoring (no vector DB required for MVP).
 *
 * @param query     Free-text query (e.g. forecast title + business area)
 * @param topK      Number of scenarios to return (default: 3)
 * @param domain    Optional domain filter (e.g. "deal_screening")
 */
export async function getRAGContext(
  query: string,
  topK = 3,
  domain?: string
): Promise<RagResult> {
  const empty: RagResult = { ragContext: "", ragScenarioIds: [], scenarios: [] };

  try {
    const db = await getDb();
    if (!db) return empty;

    // Tokenise query — keep words > 3 chars, max 6 words
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6);

    if (words.length === 0) return empty;

    const conditions: ReturnType<typeof eq>[] = [];

    if (domain) {
      // Cast to the enum type to satisfy Drizzle's strict enum column typing
      conditions.push(sql`${knowledgeScenarios.domain} = ${domain}`);
    }

    // OR across all keyword matches in title, summary, tags, geography
    const termConditions = words.map((word) => {
      const term = `%${word}%`;
      return or(
        like(knowledgeScenarios.title, term),
        like(knowledgeScenarios.summary, term),
        like(knowledgeScenarios.tags, term),
        like(knowledgeScenarios.geography, term),
        like(knowledgeScenarios.sector, term)
      );
    });
    conditions.push(or(...termConditions) as ReturnType<typeof eq>);

    const rows = await db
      .select({
        scenarioId: knowledgeScenarios.scenarioId,
        domain: knowledgeScenarios.domain,
        title: knowledgeScenarios.title,
        summary: knowledgeScenarios.summary,
        geography: knowledgeScenarios.geography,
        sector: knowledgeScenarios.sector,
      })
      .from(knowledgeScenarios)
      .where(and(...conditions))
      .limit(topK * 4); // over-fetch then rank

    if (rows.length === 0) return empty;

    // Score by keyword hit count
    const scored = rows.map((s) => {
      const text = `${s.title} ${s.summary} ${s.geography ?? ""} ${s.sector ?? ""}`.toLowerCase();
      const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
      return { ...s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    const scenarios: RagScenario[] = top.map((s) => ({
      scenarioId: s.scenarioId,
      domain: s.domain,
      title: s.title,
      summary: s.summary,
      geography: s.geography,
      sector: s.sector,
    }));

    const ragContext =
      "RELEVANT GCC INSTITUTIONAL CONTEXT:\n" +
      scenarios
        .map(
          (s, i) =>
            `[${i + 1}] ${s.scenarioId} — ${s.title} (${s.geography ?? s.domain}): ${s.summary}`
        )
        .join("\n");

    return {
      ragContext,
      ragScenarioIds: scenarios.map((s) => s.scenarioId),
      scenarios,
    };
  } catch (err) {
    // RAG failure must never break the main LLM call
    console.warn("[RAG] getRAGContext failed silently:", err);
    return empty;
  }
}

/**
 * Prepend RAG context block to an existing system prompt.
 * Returns the original prompt unchanged if no RAG context is available.
 */
export function injectRAGContext(systemPrompt: string, ragContext: string): string {
  if (!ragContext) return systemPrompt;
  return `${ragContext}\n\n---\n\n${systemPrompt}`;
}
