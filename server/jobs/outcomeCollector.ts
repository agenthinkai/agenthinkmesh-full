/**
 * outcomeCollector.ts — Self-Learning Loop Phase 4
 *
 * Nightly cron job (02:00 UTC) that collects real-world outcomes for pending decisions.
 *
 * Domain routing:
 *   - Finance / deal_screening → Yahoo Finance price movement check
 *   - Legal / regulatory       → News API regulatory/legal keywords
 *   - General                  → News API keyword match on company/topic name
 *   - Healthcare (v1)          → SKIPPED (no reliable automated source)
 *
 * Outcome verdicts:
 *   CORRECT   — real-world data supports the Council's verdict
 *   INCORRECT — real-world data contradicts the Council's verdict
 *   PENDING   — not enough data yet (< 30 days old or no data found)
 *   SKIPPED   — domain excluded from auto-scoring in v1
 */

import cron from "node-cron";
import { eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { decisionMemory, decisionOutcomes } from "../../drizzle/schema";
import { ENV } from "../_core/env";

// ── Constants ─────────────────────────────────────────────────────────────────

const NEWS_API_KEY = process.env.NEWS_API_KEY ?? "";
const OUTCOME_WINDOW_DAYS = 30;   // minimum days before scoring
const LOOKBACK_DAYS = 90;         // only score decisions made in last 90 days

// ── Yahoo Finance price fetch ─────────────────────────────────────────────────

interface YahooQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
}

async function fetchYahooQuote(ticker: string): Promise<YahooQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1mo`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 AgenThinkMesh/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: { symbol: string; regularMarketPrice: number; regularMarketChangePercent: number };
        }>;
      };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      symbol: meta.symbol,
      regularMarketPrice: meta.regularMarketPrice,
      regularMarketChangePercent: meta.regularMarketChangePercent ?? 0,
    };
  } catch {
    return null;
  }
}

// ── News API search ───────────────────────────────────────────────────────────

interface NewsArticle {
  title: string;
  description: string | null;
  publishedAt: string;
  source: { name: string };
}

async function fetchNewsArticles(query: string, fromDate: string): Promise<NewsArticle[]> {
  if (!NEWS_API_KEY) return [];
  try {
    const params = new URLSearchParams({
      q: query,
      from: fromDate,
      sortBy: "relevancy",
      pageSize: "10",
      apiKey: NEWS_API_KEY,
    });
    const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { articles?: NewsArticle[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

// ── Extract ticker from task description ─────────────────────────────────────

function extractTicker(text: string): string | null {
  // Look for patterns like "$AAPL", "AAPL:", "(AAPL)", "ticker: AAPL"
  const patterns = [
    /\$([A-Z]{1,5})\b/,
    /ticker[:\s]+([A-Z]{1,5})\b/i,
    /\(([A-Z]{2,5})\)/,
    /\b([A-Z]{2,5})\s*(?:stock|shares|equity)\b/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

// ── Extract company/topic name from task description ─────────────────────────

function extractSearchQuery(text: string, maxWords = 6): string {
  // Take first sentence or first 6 meaningful words
  const firstSentence = text.split(/[.!?\n]/)[0] ?? text;
  const words = firstSentence
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, maxWords);
  return words.join(" ");
}

// ── Score a single decision ───────────────────────────────────────────────────

interface OutcomeResult {
  outcomeVerdict: "CORRECT" | "INCORRECT" | "PENDING" | "SKIPPED";
  outcomeSource: string;
  outcomeData: string;
}

async function scoreDecision(
  decisionId: number,
  taskDescription: string,
  taskDomain: string | null,
  finalVerdict: string | null,
  decisionDate: Date
): Promise<OutcomeResult> {
  // Skip healthcare domain in v1
  if (taskDomain === "healthcare") {
    return {
      outcomeVerdict: "SKIPPED",
      outcomeSource: "none",
      outcomeData: "Healthcare domain excluded from auto-scoring in v1",
    };
  }

  // Only score decisions older than OUTCOME_WINDOW_DAYS
  const ageMs = Date.now() - decisionDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < OUTCOME_WINDOW_DAYS) {
    return {
      outcomeVerdict: "PENDING",
      outcomeSource: "none",
      outcomeData: `Decision is only ${Math.round(ageDays)} days old; waiting for ${OUTCOME_WINDOW_DAYS}-day window`,
    };
  }

  // Finance domain: try Yahoo Finance ticker
  if (taskDomain === "finance" || taskDomain === "deal_screening") {
    const ticker = extractTicker(taskDescription);
    if (ticker) {
      const quote = await fetchYahooQuote(ticker);
      if (quote) {
        const pct = quote.regularMarketChangePercent;
        // Council APPROVED → expect positive price movement (>= +5%)
        // Council REJECTED/VETOED → expect flat or negative
        const councilWasPositive = finalVerdict === "APPROVED" || finalVerdict === "APPROVED_WITH_CONDITIONS";
        const marketIsPositive = pct >= 5;
        const marketIsNegative = pct <= -5;

        let outcomeVerdict: "CORRECT" | "INCORRECT" | "PENDING";
        if (councilWasPositive && marketIsPositive) outcomeVerdict = "CORRECT";
        else if (!councilWasPositive && marketIsNegative) outcomeVerdict = "CORRECT";
        else if (councilWasPositive && marketIsNegative) outcomeVerdict = "INCORRECT";
        else if (!councilWasPositive && marketIsPositive) outcomeVerdict = "INCORRECT";
        else outcomeVerdict = "PENDING"; // flat movement — inconclusive

        return {
          outcomeVerdict,
          outcomeSource: "yahoo_finance",
          outcomeData: JSON.stringify({
            ticker,
            price: quote.regularMarketPrice,
            changePercent: pct,
            councilVerdict: finalVerdict,
          }),
        };
      }
    }
  }

  // Legal / regulatory domain: news API search for regulatory outcomes
  if (taskDomain === "legal" || taskDomain === "regulatory") {
    const query = extractSearchQuery(taskDescription) + " regulation compliance GCC";
    const fromDate = new Date(decisionDate.getTime() + OUTCOME_WINDOW_DAYS * 86400000)
      .toISOString()
      .split("T")[0];
    const articles = await fetchNewsArticles(query, fromDate);

    if (articles.length > 0) {
      const negativeKeywords = ["banned", "fined", "rejected", "shutdown", "violation", "penalty", "illegal"];
      const positiveKeywords = ["approved", "licensed", "compliant", "cleared", "authorised", "authorized"];

      const allText = articles.map((a) => `${a.title} ${a.description ?? ""}`).join(" ").toLowerCase();
      const negHits = negativeKeywords.filter((k) => allText.includes(k)).length;
      const posHits = positiveKeywords.filter((k) => allText.includes(k)).length;

      const councilWasPositive = finalVerdict === "APPROVED" || finalVerdict === "APPROVED_WITH_CONDITIONS";
      let outcomeVerdict: "CORRECT" | "INCORRECT" | "PENDING" = "PENDING";

      if (posHits > negHits && councilWasPositive) outcomeVerdict = "CORRECT";
      else if (negHits > posHits && !councilWasPositive) outcomeVerdict = "CORRECT";
      else if (posHits > negHits && !councilWasPositive) outcomeVerdict = "INCORRECT";
      else if (negHits > posHits && councilWasPositive) outcomeVerdict = "INCORRECT";

      return {
        outcomeVerdict,
        outcomeSource: "news_api",
        outcomeData: JSON.stringify({
          query,
          articleCount: articles.length,
          positiveSignals: posHits,
          negativeSignals: negHits,
          topHeadline: articles[0]?.title ?? "",
        }),
      };
    }
  }

  // General: news API keyword search
  const query = extractSearchQuery(taskDescription);
  const fromDate = new Date(decisionDate.getTime() + OUTCOME_WINDOW_DAYS * 86400000)
    .toISOString()
    .split("T")[0];
  const articles = await fetchNewsArticles(query, fromDate);

  if (articles.length > 0) {
    const negativeKeywords = ["failed", "bankrupt", "shutdown", "fraud", "scandal", "collapsed", "closed"];
    const positiveKeywords = ["raised", "launched", "expanded", "acquired", "profitable", "grew", "funded"];

    const allText = articles.map((a) => `${a.title} ${a.description ?? ""}`).join(" ").toLowerCase();
    const negHits = negativeKeywords.filter((k) => allText.includes(k)).length;
    const posHits = positiveKeywords.filter((k) => allText.includes(k)).length;

    const councilWasPositive = finalVerdict === "APPROVED" || finalVerdict === "APPROVED_WITH_CONDITIONS";
    let outcomeVerdict: "CORRECT" | "INCORRECT" | "PENDING" = "PENDING";

    if (posHits > negHits && councilWasPositive) outcomeVerdict = "CORRECT";
    else if (negHits > posHits && !councilWasPositive) outcomeVerdict = "CORRECT";
    else if (posHits > negHits && !councilWasPositive) outcomeVerdict = "INCORRECT";
    else if (negHits > posHits && councilWasPositive) outcomeVerdict = "INCORRECT";

    return {
      outcomeVerdict,
      outcomeSource: "news_api",
      outcomeData: JSON.stringify({
        query,
        articleCount: articles.length,
        positiveSignals: posHits,
        negativeSignals: negHits,
        topHeadline: articles[0]?.title ?? "",
      }),
    };
  }

  return {
    outcomeVerdict: "PENDING",
    outcomeSource: "none",
    outcomeData: "No data sources returned results for this decision",
  };
}

// ── Main outcome collection run ───────────────────────────────────────────────

export async function runOutcomeCollection(): Promise<void> {
  console.log("[OutcomeCollector] Starting nightly outcome collection run...");

  const db = await getDb();
  if (!db) {
    console.warn("[OutcomeCollector] Database not available, skipping run");
    return;
  }

  try {
    // Find decisions that:
    //   1. Don't yet have a CORRECT or INCORRECT outcome
    //   2. Were made in the last LOOKBACK_DAYS days
    const cutoffDate = new Date(Date.now() - LOOKBACK_DAYS * 86400000);

    const pendingDecisions = await db
      .select({
        id: decisionMemory.id,
        taskDescription: decisionMemory.taskDescription,
        taskDomain: decisionMemory.taskDomain,
        finalVerdict: decisionMemory.finalVerdict,
        createdAt: decisionMemory.createdAt,
      })
      .from(decisionMemory)
      .where(
        sql`${decisionMemory.createdAt} >= ${cutoffDate.toISOString().slice(0, 19).replace("T", " ")}`
      )
      .limit(50);

    // Filter to those without a final outcome already
    const existingOutcomes = await db
      .select({ decisionMemoryId: decisionOutcomes.decisionMemoryId, outcomeVerdict: decisionOutcomes.outcomeVerdict })
      .from(decisionOutcomes)
      .where(
        sql`${decisionOutcomes.outcomeVerdict} IN ('CORRECT', 'INCORRECT')`
      );

    const scoredIds = new Set(existingOutcomes.map((o) => o.decisionMemoryId));
    const toScore = pendingDecisions.filter((d) => !scoredIds.has(d.id));

    console.log(`[OutcomeCollector] Found ${toScore.length} decisions to score`);

    let scored = 0;
    let skipped = 0;
    let pending = 0;

    for (const decision of toScore) {
      try {
        const result = await scoreDecision(
          decision.id,
          decision.taskDescription,
          decision.taskDomain,
          decision.finalVerdict,
          decision.createdAt
        );

        // Upsert outcome record
        await db.insert(decisionOutcomes).values({
          decisionMemoryId: decision.id,
          outcomeSource: result.outcomeSource,
          outcomeData: result.outcomeData,
          outcomeVerdict: result.outcomeVerdict,
        });

        if (result.outcomeVerdict === "CORRECT" || result.outcomeVerdict === "INCORRECT") {
          scored++;
        } else if (result.outcomeVerdict === "SKIPPED") {
          skipped++;
        } else {
          pending++;
        }

        console.log(`[OutcomeCollector] Decision ${decision.id}: ${result.outcomeVerdict} (${result.outcomeSource})`);

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.warn(`[OutcomeCollector] Failed to score decision ${decision.id}:`, err);
      }
    }

    console.log(
      `[OutcomeCollector] Run complete. Scored: ${scored}, Pending: ${pending}, Skipped: ${skipped}`
    );
  } catch (err) {
    console.error("[OutcomeCollector] Fatal error during run:", err);
  }
}

// ── Cron scheduler ────────────────────────────────────────────────────────────

export function startOutcomeCollectorJob(): void {
  // Run at 02:00 UTC every night
  cron.schedule("0 2 * * *", async () => {
    await runOutcomeCollection();
  });
  console.log("[OutcomeCollector] Nightly outcome collection job scheduled (02:00 UTC)");
}
