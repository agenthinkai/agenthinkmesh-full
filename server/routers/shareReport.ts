/**
 * shareReport router
 * Procedures: create, get (public), revoke, list, logView (public)
 *
 * Token: 256-bit (32 bytes) random, URL-safe base64 (~43 chars)
 * Storage: SHA-256 hex hash only — raw token never stored in DB
 * Rate limit: 15 req/min per IP for public procedures
 */
import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sharedReports, reportViews, dealScreenings, dealComparisons } from "../../drizzle/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a 256-bit URL-safe base64 token (~43 chars, no padding) */
function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** SHA-256 hex hash of a raw token */
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** In-memory rate limiter: 15 req/min per IP */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Try again in a minute." });
  }
}

// Clean up stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitMap.entries()).forEach(([key, val]) => {
    if (now > val.resetAt) rateLimitMap.delete(key);
  });
}, 5 * 60_000);

function getIp(ctx: Record<string, unknown>): string {
  const req = ctx.req as Record<string, unknown> | undefined;
  if (!req) return "unknown";
  const fwd = (req.headers as Record<string, unknown>)?.["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim().slice(0, 45);
  return String((req as Record<string, unknown>).ip ?? "unknown").slice(0, 45);
}

// ── Router ────────────────────────────────────────────────────────────────────

export const shareReportRouter = router({

  /**
   * Create a share link.
   * Returns the raw token — the only time it is ever visible.
   */
  create: protectedProcedure
    .input(z.object({
      reportType: z.enum(["single_deal", "comparison"]),
      dealId: z.string().optional(),
      comparisonId: z.string().optional(),
      expiryDays: z.number().int().min(1).max(30).default(7),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership before creating link
      if (input.reportType === "single_deal") {
        if (!input.dealId) throw new TRPCError({ code: "BAD_REQUEST", message: "dealId required for single_deal" });
        const [deal] = await (await getDb())!.select({ userId: dealScreenings.userId })
          .from(dealScreenings)
          .where(and(eq(dealScreenings.dealId, input.dealId), eq(dealScreenings.userId, ctx.user.id)))
          .limit(1);
        if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found or not yours" });
      } else {
        if (!input.comparisonId) throw new TRPCError({ code: "BAD_REQUEST", message: "comparisonId required for comparison" });
        const [comp] = await (await getDb())!.select({ userId: dealComparisons.userId })
          .from(dealComparisons)
          .where(and(eq(dealComparisons.comparisonId, input.comparisonId), eq(dealComparisons.userId, ctx.user.id)))
          .limit(1);
        if (!comp) throw new TRPCError({ code: "NOT_FOUND", message: "Comparison not found or not yours" });
      }

      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = Date.now() + input.expiryDays * 24 * 60 * 60 * 1000;

      await (await getDb())!.insert(sharedReports).values({
        tokenHash,
        reportType: input.reportType,
        dealId: input.dealId ?? null,
        comparisonId: input.comparisonId ?? null,
        userId: ctx.user.id,
        expiresAt,
        viewCount: 0,
      });

      return { token: rawToken, expiresAt };
    }),

  /**
   * Public: resolve a share token and return read-only report data.
   * Rate-limited: 15 req/min per IP.
   */
  get: publicProcedure
    .input(z.object({ token: z.string().min(10).max(100) }))
    .query(async ({ ctx, input }) => {
      checkRateLimit(getIp(ctx as Record<string, unknown>));

      const tokenHash = hashToken(input.token);
      const now = Date.now();

      const [share] = await (await getDb())!.select()
        .from(sharedReports)
        .where(eq(sharedReports.tokenHash, tokenHash))
        .limit(1);

      if (!share) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      if (share.revokedAt) throw new TRPCError({ code: "FORBIDDEN", message: "This report link has been revoked" });
      if (now > share.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "This report link has expired" });

      let reportData: Record<string, unknown> | null = null;

      if (share.reportType === "single_deal" && share.dealId) {
        const [deal] = await (await getDb())!.select()
          .from(dealScreenings)
          .where(eq(dealScreenings.dealId, share.dealId))
          .limit(1);
        if (deal) {
          reportData = {
            type: "single_deal",
            dealName: deal.dealName,
            verdict: deal.verdict,
            confidenceScore: deal.confidenceScore,
            yesCount: deal.yesCount,
            noCount: deal.noCount,
            votes: JSON.parse(deal.votes),
            conditionsToProceed: JSON.parse(deal.conditionsToProceed),
            blockingIssues: JSON.parse(deal.blockingIssues),
            gccVetoTriggered: deal.gccVetoTriggered,
            createdAt: deal.createdAt,
          };
        }
      } else if (share.reportType === "comparison" && share.comparisonId) {
        const [comp] = await (await getDb())!.select()
          .from(dealComparisons)
          .where(eq(dealComparisons.comparisonId, share.comparisonId))
          .limit(1);
        if (comp) {
          reportData = {
            type: "comparison",
            dealNames: JSON.parse(comp.dealNames),
            rankedDeals: JSON.parse(comp.rankedDeals),
            comparisonSummary: JSON.parse(comp.comparisonSummary),
            dealAnalyses: JSON.parse(comp.dealAnalyses),
            totalAmountUsd: comp.totalAmountUsd,
            createdAt: comp.createdAt,
          };
        }
      }

      if (!reportData) throw new TRPCError({ code: "NOT_FOUND", message: "Report data not found" });

      return {
        reportType: share.reportType,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
        viewCount: share.viewCount,
        reportData,
      };
    }),

  /**
   * Public: log a view after a successful get.
   * Rate-limited: 15 req/min per IP.
   */
  logView: publicProcedure
    .input(z.object({ token: z.string().min(10).max(100) }))
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(getIp(ctx as Record<string, unknown>));

      const tokenHash = hashToken(input.token);
      const now = Date.now();
      const req = (ctx as Record<string, unknown>).req as Record<string, unknown> | undefined;
      const userAgent = req ? String((req.headers as Record<string, unknown>)?.["user-agent"] ?? "").slice(0, 500) : null;
      const ip = getIp(ctx as Record<string, unknown>);

      await (await getDb())!.insert(reportViews).values({
        tokenHash,
        viewerIp: ip,
        userAgent: userAgent || null,
        viewedAt: now,
      });

      // Increment viewCount and update lastViewedAt
      await (await getDb())!.update(sharedReports)
        .set({
          viewCount: sql`${sharedReports.viewCount} + 1`,
          lastViewedAt: now,
        })
        .where(eq(sharedReports.tokenHash, tokenHash));

      return { ok: true };
    }),

  /**
   * Revoke a share link. Only the owner can revoke.
   * Accepts tokenHash (from the list endpoint) for security — raw token never stored.
   */
  revoke: protectedProcedure
    .input(z.object({ tokenHash: z.string().length(64) }))
    .mutation(async ({ ctx, input }) => {
      const [share] = await (await getDb())!.select({ id: sharedReports.id, userId: sharedReports.userId })
        .from(sharedReports)
        .where(eq(sharedReports.tokenHash, input.tokenHash))
        .limit(1);

      if (!share) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
      if (share.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Not your report" });

      await (await getDb())!.update(sharedReports)
        .set({ revokedAt: Date.now() })
        .where(eq(sharedReports.tokenHash, input.tokenHash));

      return { ok: true };
    }),

  /**
   * List all shared reports created by the current user.
   * Returns tokenHash for revocation (raw token is never stored).
   */
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.select()
        .from(sharedReports)
        .where(eq(sharedReports.userId, ctx.user.id))
        .orderBy(desc(sharedReports.createdAt))
        .limit(input?.limit ?? 50);

      // Enrich with deal names
      const enriched = await Promise.all(rows.map(async (r) => {
        let dealName: string | null = null;
        if (r.reportType === "single_deal" && r.dealId) {
          const [ds] = await db.select({ dealName: dealScreenings.dealName })
            .from(dealScreenings)
            .where(eq(dealScreenings.dealId, r.dealId))
            .limit(1);
          dealName = ds?.dealName ?? null;
        } else if (r.reportType === "comparison" && r.comparisonId) {
          const [dc] = await db.select({ dealNames: dealComparisons.dealNames })
            .from(dealComparisons)
            .where(eq(dealComparisons.comparisonId, r.comparisonId))
            .limit(1);
          if (dc) {
            const names = JSON.parse(dc.dealNames) as string[];
            dealName = names.slice(0, 2).join(" vs ") + (names.length > 2 ? " +" + (names.length - 2) : "");
          }
        }

        return {
          id: r.id,
          reportType: r.reportType as "single_deal" | "comparison",
          dealId: r.dealId,
          comparisonId: r.comparisonId,
          dealName,
          expiresAt: r.expiresAt,
          revokedAt: r.revokedAt,
          viewCount: r.viewCount ?? 0,
          lastViewedAt: r.lastViewedAt,
          createdAt: typeof r.createdAt === "number" ? r.createdAt : new Date(r.createdAt).getTime(),
          isActive: !r.revokedAt && Date.now() < r.expiresAt,
          tokenHash: r.tokenHash,
        };
      }));

      return enriched;
    }),
});
