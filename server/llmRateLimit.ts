/**
 * LLM Rate Limiter Middleware
 *
 * Rules:
 * - Max 10 requests per IP per day
 * - Max 2,000 tokens per request (enforced via max_tokens cap)
 * - Daily platform-wide circuit breaker at 50,000 tokens
 *   → new requests return a "high demand" message and log the user
 * - All usage is recorded in llm_usage table for admin dashboard
 */

import type { Request, Response, NextFunction } from "express";
import { getDb } from "./db";
import { llmUsage, highDemandLog } from "../drizzle/schema";
import { sql, eq, and, sum } from "drizzle-orm";

const MAX_REQUESTS_PER_IP_PER_DAY = 10;
const MAX_TOKENS_PER_REQUEST = 2000;
const DAILY_PLATFORM_TOKEN_LIMIT = 50000;

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

/**
 * Express middleware that enforces rate limits before any LLM call.
 * Attach to any route that triggers an LLM invocation.
 *
 * Sets req.llmTokenCap (number) so downstream handlers know the allowed max_tokens.
 */
export async function llmRateLimitMiddleware(
  req: Request & { llmTokenCap?: number; llmUsageContext?: { ip: string; userId: number | null; endpoint: string; date: string } },
  res: Response,
  next: NextFunction
) {
  const db = await getDb();
  if (!db) {
    // If DB is unavailable, allow through with default cap (fail open)
    req.llmTokenCap = MAX_TOKENS_PER_REQUEST;
    return next();
  }

  const ip = getClientIp(req);
  const today = getTodayDate();
  const userId = (req as any).user?.id ?? null;

  // Derive endpoint label from path
  const endpoint = req.path.replace(/^\/api\//, "").replace(/\//g, "-");

  // ── 1. Check daily platform-wide token total ──────────────────────────────
  const [platformRow] = await db
    .select({ total: sum(llmUsage.tokensUsed) })
    .from(llmUsage)
    .where(eq(llmUsage.requestDate, today));

  const platformTotal = Number(platformRow?.total ?? 0);

  if (platformTotal >= DAILY_PLATFORM_TOKEN_LIMIT) {
    // Log the blocked request
    await db.insert(highDemandLog).values({
      userId,
      ipAddress: ip,
      endpoint,
      requestDate: today,
      dailyTotalAtTime: platformTotal,
    });

    return res.status(429).json({
      error: "high_demand",
      message:
        "AgenThinkMesh is experiencing high demand today. Your request has been logged and our team will follow up. Please try again tomorrow.",
      retryAfter: "tomorrow",
    });
  }

  // ── 2. Check per-IP daily request count ──────────────────────────────────
  const [ipRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(llmUsage)
    .where(and(eq(llmUsage.ipAddress, ip), eq(llmUsage.requestDate, today)));

  const ipCount = Number(ipRow?.count ?? 0);

  if (ipCount >= MAX_REQUESTS_PER_IP_PER_DAY) {
    return res.status(429).json({
      error: "rate_limit_exceeded",
      message: `You have reached the daily limit of ${MAX_REQUESTS_PER_IP_PER_DAY} requests. Please try again tomorrow.`,
      retryAfter: "tomorrow",
    });
  }

  // ── 3. Pass token cap and context to downstream handler ──────────────────
  req.llmTokenCap = MAX_TOKENS_PER_REQUEST;
  req.llmUsageContext = { ip, userId, endpoint, date: today };

  next();
}

/**
 * Call this AFTER the LLM call completes to record actual token usage.
 * tokensUsed should come from the LLM response's usage.total_tokens field.
 */
export async function recordLlmUsage(
  context: { ip: string; userId: number | null; endpoint: string; date: string },
  tokensUsed: number
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(llmUsage).values({
      userId: context.userId,
      ipAddress: context.ip,
      endpoint: context.endpoint,
      tokensUsed,
      requestDate: context.date,
    });
  } catch {
    // Non-fatal — don't break the response if logging fails
  }
}
