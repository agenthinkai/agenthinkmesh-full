/**
 * dealScreener.ts — tRPC router for Deal Screener (Council of 10)
 * All verdict computation is delegated to councilEngine.ts.
 * This router handles: rate limiting, persistence, and data retrieval.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, gte } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dealScreenings, dealScreeningRateLimit, dealComparisons, dealScreenerPayments, signalDeals, userSignalPrefs, scenarioSimRuns } from "../../drizzle/schema";
import { runCouncil } from "../councilEngine";
import { runAdversarialCouncil } from "../dealScreenerAdversarial";
import { deriveClassification, rescuePolicy, TERMINAL_FLAGS, type TerminalBlockerFlag } from "../lib/rescuePolicy";
import { generateCfoDeepDivePdf, type CouncilSummaryInput } from "../cfoDeepDivePdf";
import { generateICMemoPdf, type ICMemoInput } from "../icMemoPdf";
import { generateUpgradeProtocolPdf, generateUpgradeProtocolText, type UpgradeProtocolInput } from "../upgradeProtocolPdf";
import { generateStressTestReportPdf, generateStressTestReportText, type StressTestReportInput } from "../stressTestReportPdf";
import { normalizeStressTestReportInput, logValidationError } from "../normalizeStressTestReportInput";
import { runComparison } from "../comparisonEngine";
import { generateSingleDealICReport, generateComparisonICReport } from "../icReportEngine";
import { detectTier0Signal, TIER0_FEED } from "../tier0Signals";
import { getSurfacedSignals } from "../tier0Ingestion";
import { randomUUID } from "crypto";
import { runTriage } from "../triageEngine";
import { checkDuplicate } from "../dealDedup";
import { runRealityAlignment } from "../realityAlignmentEngine";
import { invokeLLM } from "../_core/llm";
import { generateRepairBriefPdf, type RepairBriefInput } from "../repairBriefPdf";

// ── Owner whitelist — these users always bypass payment and rate limits ────────
const OWNER_EMAILS = ["farouq@agenthink.ai", "farouqsultan@gmail.com"];
export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase().trim());
}

// ── Payment gate flag — set to true to disable Stripe payment for all users ────────
// To re-enable: set PAYMENT_GATE_DISABLED = false
const PAYMENT_GATE_DISABLED = true;

// ── Plan-based daily rate limits ─────────────────────────────────────────────

type PlanTier = "trial" | "standard" | "pro" | "enterprise" | null | undefined;

function getDailyLimit(plan: PlanTier): number {
  if (plan === "enterprise") return Infinity;
  if (plan === "pro") return 50;
  return 50; // trial, standard, null, undefined → free tier
}

function getPlanLabel(plan: PlanTier): string {
  if (plan === "enterprise") return "enterprise";
  if (plan === "pro") return "pro";
  return "free";
}

/** Returns midnight UTC today as a Date (start of current 24h window). */
function todayMidnightUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function checkAndIncrementRateLimit(
  userId: number,
  plan: PlanTier
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const limit = getDailyLimit(plan);
  if (limit === Infinity) return; // enterprise: skip check

  const windowStart = todayMidnightUTC();

  const existing = await db
    .select()
    .from(dealScreeningRateLimit)
    .where(
      and(
        eq(dealScreeningRateLimit.userId, userId),
        gte(dealScreeningRateLimit.windowStart, windowStart)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    if (record.count >= limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: JSON.stringify({
          code: "RATE_LIMIT_EXCEEDED",
          plan: getPlanLabel(plan),
          limit,
          remaining: 0,
        }),
      });
    }
    await db
      .update(dealScreeningRateLimit)
      .set({ count: record.count + 1 })
      .where(eq(dealScreeningRateLimit.id, record.id));
  } else {
    await db.insert(dealScreeningRateLimit).values({
      userId,
      windowStart,
      count: 1,
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dealScreenerRouter = router({
  /**
   * Screen a deal through the Council of 10.
   * Rate limited by plan: free=3/day · pro=50/day · enterprise=unlimited.
   * Window resets at midnight UTC.
   */
  screen: protectedProcedure
    .input(
      z.object({
        dealName: z.string().min(1).max(255).trim(),
        dealText: z.string().min(10).max(10000).trim(),
        pdfFileKey: z.string().optional(),
        pdfFileUrl: z.string().optional(),
        stripeSessionId: z.string().optional(), // link payment row to this deal run
        councilMode: z.enum(["gcc", "global_vc", "india_pe", "gcc_equities", "infrastructure"]).optional().default("global_vc"),
        signalPayload: z
          .object({
            strategy: z.enum(["FRIDAY_GAP", "NAV_DEPEG", "SPREAD_CAPTURE"]),
            symbol: z.string().min(1).max(20),
            sideHint: z.enum(["BUY", "SELL"]).optional(),
            constituentQuotes: z.array(
              z.object({
                symbol: z.string(),
                bid: z.number().optional(),
                ask: z.number().optional(),
                last: z.number().optional(),
              }),
            ),
            kwtThursdayClose: z.number().positive().optional(),
            kwtFridayClose:   z.number().positive().optional(),
            thresholdBps:     z.number().int().min(1).max(500).optional(),
            notes:            z.string().max(2000).optional(),
            macroTape:        z.string().max(2000).optional(),
          })
          .optional(),
        sourceType: z.enum(["manual", "signal"]).optional().default("manual"),
        includeReport: z.boolean().optional().default(true),
        investorMode: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Owner bypass — skip rate limit and payment entirely
      if (isOwner(ctx.user.email)) {
        const ownerDealId = randomUUID();
        const ownerResult = await runAdversarialCouncil(input.dealText, { userId: undefined, councilMode: input.councilMode, investorMode: input.investorMode, signalPayload: input.signalPayload });
        await db.insert(dealScreenings).values({
          dealId: ownerDealId,
          userId: ctx.user.id,
          dealName: input.dealName,
          // dealText intentionally omitted — enterprise data security policy
          // dealTextPreview: first 200 chars stored for Re-run UX context only
          dealTextPreview: input.dealText ? input.dealText.slice(0, 200) : null,
          pdfFileKey: input.pdfFileKey ?? null,
          pdfFileUrl: input.pdfFileUrl ?? null,
          verdict: ownerResult.verdict as "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA",
          yesCount: ownerResult.yesCount,
          noCount: ownerResult.noCount,
          hardYesCount: ownerResult.hardYesCount,
          softYesCount: ownerResult.softYesCount,
          softNoCount: ownerResult.softNoCount,
          hardNoCount: ownerResult.hardNoCount,
          confidenceScore: ownerResult.confidenceScore.toString(),
          gccVetoTriggered: ownerResult.gccVetoTriggered,
          tiebreakerTriggered: ownerResult.tiebreakerTriggered,
          tiebreakerSwingAgent: ownerResult.tiebreakerSwingAgent ?? null,
          conditionsToProceed: JSON.stringify(ownerResult.conditionsToProceed),
          blockingIssues: JSON.stringify(ownerResult.blockingIssues),
          terminalFlags: JSON.stringify(ownerResult.terminalFlags ?? []),
          votes: JSON.stringify(ownerResult.votes),
          councilMode: input.councilMode,
          investorMode: input.investorMode ?? false,
          sourceType: input.sourceType ?? "manual",
          evidenceBlob: ownerResult.evidenceBlob ?? null,
        });
        let ownerIcReport = null;
        try { ownerIcReport = await generateSingleDealICReport(input.dealName, input.dealText, ownerResult); } catch {}
        const ownerTier0 = detectTier0Signal(input.dealText, input.dealName);
        const ownerAre = runRealityAlignment(input.dealText, ownerResult);
        return { dealId: ownerDealId, dealName: input.dealName, ...ownerResult, investorMode: input.investorMode ?? false, icReport: ownerIcReport, universitySignal: ownerTier0, realityAlignment: ownerAre, decisionIntegrity: ownerResult.decisionIntegrity ?? null };
      }

      // Rate limit check (plan-based daily limit)
      await checkAndIncrementRateLimit(ctx.user.id, ctx.user.planTier as PlanTier);

      const dealId = randomUUID();

      // ── Pay-per-run: verify Stripe payment and bypass token guard ──────
      // When a stripeSessionId is provided, the user paid $32.50 for this run.
      // We verify the payment is confirmed and skip the subscription token guard.
      // When PAYMENT_GATE_DISABLED=true, all users bypass payment entirely.
      let skipTokenGuard = PAYMENT_GATE_DISABLED; // true = all users run free
      if (!PAYMENT_GATE_DISABLED && input.stripeSessionId) {
        const [paymentRow] = await db
          .select()
          .from(dealScreenerPayments)
          .where(
            and(
              eq(dealScreenerPayments.stripeSessionId, input.stripeSessionId),
              eq(dealScreenerPayments.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (paymentRow && (paymentRow.status === "paid" || paymentRow.status === "used")) {
          skipTokenGuard = true;
        } else {
          // Webhook may be delayed — verify directly with Stripe API
          try {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (stripeKey) {
              const Stripe = (await import("stripe")).default;
              const stripe = new Stripe(stripeKey);
              const session = await stripe.checkout.sessions.retrieve(input.stripeSessionId);
              if (session.payment_status === "paid") {
                await db.update(dealScreenerPayments)
                  .set({ status: "paid", stripePaymentIntentId: session.payment_intent as string ?? null })
                  .where(eq(dealScreenerPayments.stripeSessionId, input.stripeSessionId));
                skipTokenGuard = true;
              }
            }
          } catch (err) {
            console.error("[DealScreener] Stripe fallback verification failed:", err);
          }
        }

        if (!skipTokenGuard) {
          throw new TRPCError({
            code: "PAYMENT_REQUIRED",
            message: "Payment not confirmed. Please complete payment before running the Council.",
          });
        }
      }

      // ── Layer 0: Deduplication ──────────────────────────────────────────────
      const dedupResult = await checkDuplicate(ctx.user.id, input.dealText);
      if (dedupResult.isDuplicate && dedupResult.previousDealId) {
        const prevRows = await db
          .select()
          .from(dealScreenings)
          .where(eq(dealScreenings.dealId, dedupResult.previousDealId))
          .limit(1);
        if (prevRows.length > 0) {
          const prev = prevRows[0];
          return {
            dealId: prev.dealId,
            dealName: prev.dealName,
            verdict: prev.verdict,
            yesCount: prev.yesCount,
            noCount: prev.noCount,
            hardYesCount: prev.hardYesCount,
            softYesCount: prev.softYesCount,
            softNoCount: prev.softNoCount,
            hardNoCount: prev.hardNoCount,
            confidenceScore: Number(prev.confidenceScore),
            gccVetoTriggered: prev.gccVetoTriggered,
            tiebreakerTriggered: prev.tiebreakerTriggered,
            tiebreakerSwingAgent: prev.tiebreakerSwingAgent ?? null,
            conditionsToProceed: JSON.parse(prev.conditionsToProceed || "[]"),
            blockingIssues: JSON.parse(prev.blockingIssues || "[]"),
            terminalFlags: JSON.parse(prev.terminalFlags || "[]") as string[],
            votes: JSON.parse(prev.votes || "[]"),
            icReport: null,
            universitySignal: null,
            duplicate: true,
            triage: null,
          };
        }
      }

      // ── Layer 1: Fast Triage ────────────────────────────────────────────────
      const triageResult = await runTriage(input.dealText);
      console.log(`[Triage] ${triageResult.decision} (conf=${triageResult.confidence.toFixed(2)}) in ${triageResult.durationMs}ms`);

      if (triageResult.decision !== "PROCEED") {
        const triageDealId = randomUUID();
        try {
          await db.insert(dealScreenings).values({
            userId: ctx.user.id,
            dealId: triageDealId,
            dealName: input.dealName,
            // dealText intentionally omitted — enterprise data security policy
            // dealTextPreview: first 200 chars stored for Re-run UX context only
            dealTextPreview: input.dealText ? input.dealText.slice(0, 200) : null,
            pdfFileKey: input.pdfFileKey ?? null,
            pdfFileUrl: input.pdfFileUrl ?? null,
            verdict: "REJECTED",
            yesCount: 0,
            noCount: 0,
            hardYesCount: 0,
            softYesCount: 0,
            softNoCount: 0,
            hardNoCount: 0,
            confidenceScore: "0.000",
            gccVetoTriggered: false,
            tiebreakerTriggered: false,
            tiebreakerSwingAgent: null,
            conditionsToProceed: "[]",
            blockingIssues: JSON.stringify([triageResult.reason]),
            terminalFlags: JSON.stringify([]),
            votes: "[]",
            sourceType: input.sourceType ?? "manual",
            dealHash: dedupResult.dealHash,
            triageResult: JSON.stringify(triageResult),
            triageSkipped: false,
          });
        } catch (e) {
          console.error("[Triage] Failed to persist triage record:", e);
        }
        return {
          dealId: triageDealId,
          dealName: input.dealName,
          verdict: "REJECTED" as const,
          yesCount: 0,
          noCount: 0,
          hardYesCount: 0,
          softYesCount: 0,
          softNoCount: 0,
          hardNoCount: 0,
          confidenceScore: 0,
          gccVetoTriggered: false,
          tiebreakerTriggered: false,
          tiebreakerSwingAgent: null,
          conditionsToProceed: [],
          blockingIssues: [triageResult.reason],
          votes: [],
          icReport: null,
          universitySignal: null,
          duplicate: false,
          triage: triageResult,
        };
      }

      // ── Layer 2: Full Council (Adversarial) ─────────────────────────────────
      // Run the adversarial council engine — skip subscription token guard for pay-per-run sessions
      const result = await runAdversarialCouncil(input.dealText, {
        userId: skipTokenGuard ? undefined : ctx.user.id,
        councilMode: input.councilMode,
        investorMode: input.investorMode,
        signalPayload: input.signalPayload,
      });
      const decisionIntegrity = result.decisionIntegrity;
      // Persist to database
      await db.insert(dealScreenings).values({
        userId: ctx.user.id,
        dealId,
        dealName: input.dealName,
        // dealText intentionally omitted — enterprise data security policy
        // dealTextPreview: first 200 chars stored for Re-run UX context only
        dealTextPreview: input.dealText ? input.dealText.slice(0, 200) : null,
        pdfFileKey: input.pdfFileKey ?? null,
        pdfFileUrl: input.pdfFileUrl ?? null,
        verdict: result.verdict as "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA",
        yesCount: result.yesCount,
        noCount: result.noCount,
        hardYesCount: result.hardYesCount,
        softYesCount: result.softYesCount,
        softNoCount: result.softNoCount,
        hardNoCount: result.hardNoCount,
        confidenceScore: result.confidenceScore.toString(),
        gccVetoTriggered: result.gccVetoTriggered,
        tiebreakerTriggered: result.tiebreakerTriggered,
        tiebreakerSwingAgent: result.tiebreakerSwingAgent ?? null,
        conditionsToProceed: JSON.stringify(result.conditionsToProceed),
        blockingIssues: JSON.stringify(result.blockingIssues),
        terminalFlags: JSON.stringify(result.terminalFlags ?? []),
        votes: JSON.stringify(result.votes),
        councilMode: input.councilMode,
        investorMode: input.investorMode ?? false,
        sourceType: input.sourceType ?? "manual",
        dealHash: dedupResult.dealHash,
        triageResult: JSON.stringify(triageResult),
        triageSkipped: false,
        evidenceBlob: result.evidenceBlob ?? null,
      });

      // Link the Stripe payment row to this deal run (so billing history shows the deal name)
      if (input.stripeSessionId) {
        try {
          await db.update(dealScreenerPayments)
            .set({ dealId, status: "used" })
            .where(
              and(
                eq(dealScreenerPayments.stripeSessionId, input.stripeSessionId),
                eq(dealScreenerPayments.userId, ctx.user.id)
              )
            );
        } catch (err) {
          // Non-fatal — billing history may show "Pending" but the run still completes
          console.error("[DealScreener] Failed to link payment to deal run:", err);
        }
      }

      // ── Layer 3: Conditional IC Report ─────────────────────────────────────
      // Only generate for APPROVED or APPROVED_WITH_CONDITIONS, and only if requested.
      // Saves ~$0.14 per rejected deal.
      let icReport = null;
      const shouldGenerateReport =
        input.includeReport !== false &&
        (result.verdict === "APPROVED" || result.verdict === "APPROVED_WITH_CONDITIONS");
      if (shouldGenerateReport) {
        try {
          icReport = await generateSingleDealICReport(input.dealName, input.dealText, result);
        } catch (err) {
          console.error("[ICReport] Failed to generate IC report:", err);
        }
      }

      // Detect Tier 0 university signal (non-fatal, additive)
      let universitySignal = null;
      try {
        universitySignal = detectTier0Signal(input.dealText, input.dealName);
      } catch (err) {
        console.error("[Tier0] Signal detection failed:", err);
      }

      // ── Layer 2.5: Reality Alignment Engine ────────────────────────────────────────────────────────────────────────
      const realityAlignment = runRealityAlignment(input.dealText, result);
      // Override verdict if ARE gates the deal
      const finalVerdict = (realityAlignment.shouldGate && result.verdict !== "REJECTED" && result.verdict !== "VETOED")
        ? "INSUFFICIENT_DATA" as const
        : result.verdict;
      return {
        dealId,
        dealName: input.dealName,
        ...result,
        verdict: finalVerdict,
        councilMode: input.councilMode,
        investorMode: input.investorMode ?? false,
        icReport,
        universitySignal,
        duplicate: false,
        triage: triageResult,
        realityAlignment,
        decisionIntegrity: decisionIntegrity ?? null,
      };
    }),

  /**
   * Compare 2–5 deals through the Council of 10 and produce a ranked analysis.
   * Per spec: $32.50 × dealCount logged as pending transactions.
   * Does NOT modify any existing single-deal functionality.
   */
  compare: protectedProcedure
    .input(
      z.object({
        deals: z
          .array(
            z.object({
              name: z.string().min(1).max(255).trim(),
              summary: z.string().min(10).max(3000).trim(),
              metrics: z.record(z.string(), z.unknown()).optional(),
            })
          )
          .refine(arr => arr.length >= 2, { message: "Minimum 2 deals required for comparison" })
          .refine(arr => arr.length <= 5, { message: "Maximum 5 deals allowed per comparison" }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const dealCount = input.deals.length;
      const totalAmountUsd = (32.50 * dealCount).toFixed(2);

      // ── Log per-deal transactions as pending (no Stripe yet per spec) ──────
      const transactionIds: string[] = [];
      for (const deal of input.deals) {
        const pseudoSessionId = `cmp_${randomUUID()}_${deal.name.slice(0, 20).replace(/\s+/g, "_")}`;
        await db.insert(dealScreenerPayments).values({
          userId: ctx.user.id,
          stripeSessionId: pseudoSessionId,
          status: "pending",
          amountUsd: "32.50",
        });
        transactionIds.push(pseudoSessionId);
      }

      // ── Run comparison engine ─────────────────────────────────────────────
      let result;
      try {
        result = await runComparison(input.deals, { userId: ctx.user.id });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Comparison failed";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }

      // ── Persist to dealComparisons table ─────────────────────────────────
      await db.insert(dealComparisons).values({
        comparisonId: result.comparisonId,
        userId: ctx.user.id,
        dealIds: JSON.stringify(transactionIds),
        dealNames: JSON.stringify(input.deals.map(d => d.name)),
        dealCount,
        rankedDeals: JSON.stringify(result.comparisonSummary.rankedDeals),
        comparisonSummary: JSON.stringify(result.comparisonSummary),
        dealAnalyses: JSON.stringify(result.dealAnalyses),
        pdfUrl: null,
        totalAmountUsd,
      });

      // Generate boardroom-ready IC Comparison Report (additive — does not modify result)
      let icReport = null;
      try {
        icReport = await generateComparisonICReport(result.dealAnalyses, result.comparisonSummary);
      } catch (err) {
        console.error("[ICReport] Failed to generate comparison IC report:", err);
      }

      return {
        comparisonId: result.comparisonId,
        dealAnalyses: result.dealAnalyses,
        comparisonSummary: result.comparisonSummary,
        totalAmountUsd: parseFloat(totalAmountUsd),
        timestamp: result.timestamp,
        icReport,
      };
    }),

  /**
   * Get the authenticated user's comparison history.
   */
  comparisonHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const limit = input?.limit ?? 20;

      const rows = await db
        .select({
          id: dealComparisons.id,
          comparisonId: dealComparisons.comparisonId,
          dealNames: dealComparisons.dealNames,
          dealCount: dealComparisons.dealCount,
          totalAmountUsd: dealComparisons.totalAmountUsd,
          createdAt: dealComparisons.createdAt,
        })
        .from(dealComparisons)
        .where(eq(dealComparisons.userId, ctx.user.id))
        .orderBy(desc(dealComparisons.createdAt))
        .limit(limit);

      return rows.map(r => ({
        ...r,
        dealNames: JSON.parse(r.dealNames) as string[],
      }));
    }),

  /**
   * Get a single comparison by comparisonId (full ranked report).
   */
  getComparisonById: protectedProcedure
    .input(z.object({ comparisonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(dealComparisons)
        .where(
          and(
            eq(dealComparisons.comparisonId, input.comparisonId),
            eq(dealComparisons.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comparison not found" });
      }

      const row = rows[0];
      return {
        ...row,
        dealNames: JSON.parse(row.dealNames) as string[],
        dealIds: JSON.parse(row.dealIds) as string[],
        rankedDeals: JSON.parse(row.rankedDeals),
        comparisonSummary: JSON.parse(row.comparisonSummary),
        dealAnalyses: JSON.parse(row.dealAnalyses),
        totalAmountUsd: parseFloat(row.totalAmountUsd),
      };
    }),

  /**
   * Get the authenticated user's deal screening history.
   */
  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const limit = input?.limit ?? 50;

      const rows = await db
        .select({
          id: dealScreenings.id,
          dealId: dealScreenings.dealId,
          dealName: dealScreenings.dealName,
          dealTextPreview: dealScreenings.dealTextPreview,
          verdict: dealScreenings.verdict,
          yesCount: dealScreenings.yesCount,
          noCount: dealScreenings.noCount,
          confidenceScore: dealScreenings.confidenceScore,
          gccVetoTriggered: dealScreenings.gccVetoTriggered,
          tiebreakerTriggered: dealScreenings.tiebreakerTriggered,
          councilMode: dealScreenings.councilMode,
          investorMode: dealScreenings.investorMode,
          sourceType: dealScreenings.sourceType,
          createdAt: dealScreenings.createdAt,
          evidenceBlob: dealScreenings.evidenceBlob,
        })
        .from(dealScreenings)
        .where(eq(dealScreenings.userId, ctx.user.id))
        .orderBy(desc(dealScreenings.createdAt))
        .limit(limit);
      return rows;
    }),

  /**
   * Get a single deal screening by dealId (full IC report).
   */
  getById: protectedProcedure
    .input(z.object({ dealId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(dealScreenings)
        .where(
          and(
            eq(dealScreenings.dealId, input.dealId),
            eq(dealScreenings.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
      }

      const row = rows[0];
      return {
        ...row,
        conditionsToProceed: JSON.parse(row.conditionsToProceed) as string[],
        blockingIssues: JSON.parse(row.blockingIssues) as string[],
        terminalFlags: JSON.parse(row.terminalFlags || "[]") as string[],
        votes: JSON.parse(row.votes),
        confidenceScore: parseFloat(row.confidenceScore),
      };
    }),

  /**
   * Generate a full 7-section CFO Deep Dive analysis and return as base64 PDF.
   * Called on-demand from the CFO card in the results UI.
   */
  cfoDeepDive: protectedProcedure
    .input(
      z.object({
        dealName:            z.string().min(1).max(255),
        verdict:             z.string(),
        yesCount:            z.number(),
        noCount:             z.number(),
        confidenceScore:     z.number(),
        conditionsToProceed: z.array(z.string()),
        blockingIssues:      z.array(z.string()),
        votes: z.array(z.object({
          personaId:   z.string(),
          personaName: z.string(),
          personaRole: z.string(),
          vote:        z.string(),
          confidence:  z.number(),
          rationale:   z.string(),
          keyFlags:    z.array(z.string()),
          conditions:  z.array(z.string()),
          blockers:    z.array(z.string()),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const summary: CouncilSummaryInput = {
        dealName:            input.dealName,
        verdict:             input.verdict,
        yesCount:            input.yesCount,
        noCount:             input.noCount,
        confidenceScore:     input.confidenceScore,
        conditionsToProceed: input.conditionsToProceed,
        blockingIssues:      input.blockingIssues,
        votes:               input.votes,
      };
      const pdfBuffer = await generateCfoDeepDivePdf(summary);
      return {
        base64: pdfBuffer.toString("base64"),
        filename: `CFO-DeepDive-${input.dealName.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}.pdf`,
      };
    }),

  /**
   * Generate a VC-facing IC Memo PDF from existing council vote data.
   * Uses LLM to synthesise multi-agent output into partner-level prose.
   */
  icMemoPdf: protectedProcedure
    .input(
      z.object({
        dealName:            z.string().min(1).max(255),
        verdict:             z.string(),
        yesCount:            z.number(),
        noCount:             z.number(),
        confidenceScore:     z.number(),
        conditionsToProceed: z.array(z.string()),
        blockingIssues:      z.array(z.string()),
        councilMode:         z.enum(["gcc", "global_vc", "india_pe", "gcc_equities", "infrastructure"]).optional(),
        patternContext:       z.enum(["invested_match", "passed_match"]).optional(),
        dealId:              z.string().optional(),
        votes: z.array(z.object({
          personaId:   z.string(),
          personaName: z.string(),
          personaRole: z.string(),
          vote:        z.string(),
          confidence:  z.number(),
          rationale:   z.string(),
          keyFlags:    z.array(z.string()),
          conditions:  z.array(z.string()),
          blockers:    z.array(z.string()),
        })),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // ── Auto-fetch latest completed simulation for Section 17 ────────────
      let scenarioStress: ICMemoInput["scenarioStress"] | undefined;
      if (input.dealId) {
        try {
          const db = await getDb();
          if (db) {
            const simRuns = await db
              .select()
              .from(scenarioSimRuns)
              .where(
                and(
                  eq(scenarioSimRuns.dealId, input.dealId),
                  eq(scenarioSimRuns.userId, ctx.user.id),
                  eq(scenarioSimRuns.status, "completed")
                )
              )
              .orderBy(desc(scenarioSimRuns.completedAt))
              .limit(1);
            if (simRuns.length > 0) {
              const run = simRuns[0];
              const dd = run.decisionDistribution ? JSON.parse(run.decisionDistribution) : null;
              const fv = run.failureVectors ? JSON.parse(run.failureVectors) : [];
              const ap = run.approvalPathways ? JSON.parse(run.approvalPathways) : [];
              const gh = run.governanceHeatmap ? JSON.parse(run.governanceHeatmap) : [];
              const ss = run.sensitivitySurface ? JSON.parse(run.sensitivitySurface) : [];
              if (dd) {
                scenarioStress = {
                  mode:                run.mode,
                  targetCount:         run.targetCount,
                  completedAt:         (run.completedAt instanceof Date ? run.completedAt.toISOString() : run.completedAt) ?? new Date().toISOString(),
                  executiveSummary:    run.executiveSummary ?? "",
                  decisionDistribution: dd,
                  failureVectors:      fv,
                  approvalPathways:    ap,
                  governanceHeatmap:   gh,
                  sensitivitySurface:  ss,
                };
              }
            }
          }
        } catch (e) {
          // Non-fatal — Section 17 simply omitted if fetch fails
          console.warn("[icMemoPdf] Could not fetch simulation data for Section 17:", e);
        }
      }

      const memoInput: ICMemoInput = {
        dealName:            input.dealName,
        verdict:             input.verdict,
        yesCount:            input.yesCount,
        noCount:             input.noCount,
        confidenceScore:     input.confidenceScore,
        conditionsToProceed: input.conditionsToProceed,
        blockingIssues:      input.blockingIssues,
        councilMode:         input.councilMode,
        patternContext:      input.patternContext,
        votes:               input.votes,
        scenarioStress,
      };
      const pdfBuffer = await generateICMemoPdf(memoInput);
      const patternSuffix = input.patternContext === "invested_match"
        ? "-Invested-Match"
        : input.patternContext === "passed_match"
        ? "-Caution-Match"
        : "";
      return {
        base64: pdfBuffer.toString("base64"),
        filename: `IC-Memo-${input.dealName.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}${patternSuffix}.pdf`,
      };
    }),

  /**
   * Get remaining rate limit for the current user.
   */
  rateLimit: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const plan = ctx.user.planTier as PlanTier;
    const limit = getDailyLimit(plan);
    const planLabel = getPlanLabel(plan);

    if (limit === Infinity) {
      return { remaining: Infinity, limit: -1, plan: planLabel, resetAt: null };
    }

    if (!db) return { remaining: limit, limit, plan: planLabel, resetAt: null };

    const windowStart = todayMidnightUTC();
    const existing = await db
      .select()
      .from(dealScreeningRateLimit)
      .where(
        and(
          eq(dealScreeningRateLimit.userId, ctx.user.id),
          gte(dealScreeningRateLimit.windowStart, windowStart)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { remaining: limit, limit, plan: planLabel, resetAt: null };
    }

    const record = existing[0];
    const remaining = Math.max(0, limit - record.count);
    // Reset at next midnight UTC
    const tomorrow = new Date(windowStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return { remaining, limit, plan: planLabel, resetAt: tomorrow };
  }),

  /**
   * Tier 0 University Signal Feed — Phase 2 (controlled release)
   * Returns up to 5 high-confidence early-stage signals for discovery.
   */
  tier0Feed: protectedProcedure.query(async () => {
    // Try live DB signals first; fall back to static curated feed if DB is empty
    try {
      const dbSignals = await getSurfacedSignals();
      if (dbSignals.length > 0) {
        const lastRefreshed = dbSignals.reduce((latest, s) => {
          const t = new Date(s.ingestedAt).getTime();
          return t > latest ? t : latest;
        }, 0);
        return { signals: dbSignals, lastRefreshed: new Date(lastRefreshed).toISOString() };
      }
    } catch (err) {
      console.warn("[Tier0] DB feed unavailable, using static fallback:", err instanceof Error ? err.message : String(err));
    }
    return { signals: TIER0_FEED.slice(0, 5), lastRefreshed: null };
  }),

  // ── Deal Signal Layer ──────────────────────────────────────────────────────

  /**
   * List recent market signals for the current user (max 5).
   * Falls back to 5 static demo signals if the user has no stored signals.
   */
  listSignals: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      const unreadCount = DEMO_SIGNALS.filter(s => !s.screened).length;
      return { signals: DEMO_SIGNALS, isDemo: true, unreadCount };
    }
    const rows = await db
      .select()
      .from(signalDeals)
      .where(eq(signalDeals.userId, ctx.user.id))
      .orderBy(desc(signalDeals.createdAt))
      .limit(5);
    if (rows.length === 0) {
      const unreadCount = DEMO_SIGNALS.filter(s => !s.screened).length;
      return { signals: DEMO_SIGNALS, isDemo: true, unreadCount };
    }
    const unreadCount = rows.filter(r => !r.screened).length;
    return { signals: rows, isDemo: false, unreadCount };
  }),

  /**
   * Ingest a new market signal manually (or via background job).
   */
  ingestSignal: protectedProcedure
    .input(z.object({
      company: z.string().min(1).max(255),
      sector: z.string().min(1).max(128),
      stage: z.string().min(1).max(64),
      summary: z.string().min(1),
      source: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [result] = await db.insert(signalDeals).values({
        userId: ctx.user.id,
        company: input.company,
        sector: input.sector,
        stage: input.stage,
        summary: input.summary,
        source: input.source,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  /**
   * Toggle the auto-screen preference for the current user.
   */
  toggleAutoScreen: protectedProcedure
    .input(z.object({ autoScreen: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db
        .select()
        .from(userSignalPrefs)
        .where(eq(userSignalPrefs.userId, ctx.user.id))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(userSignalPrefs).values({ userId: ctx.user.id, autoScreen: input.autoScreen });
      } else {
        await db.update(userSignalPrefs)
          .set({ autoScreen: input.autoScreen })
          .where(eq(userSignalPrefs.userId, ctx.user.id));
      }
      return { autoScreen: input.autoScreen };
    }),

  /**
   * Get the current auto-screen preference for the current user.
   */
  getSignalPrefs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { autoScreen: false };
    const rows = await db
      .select()
      .from(userSignalPrefs)
      .where(eq(userSignalPrefs.userId, ctx.user.id))
      .limit(1);
    return { autoScreen: rows[0]?.autoScreen ?? false };
  }),

  /**
   * Mark a signal as screened (after the user opens the Deal Screener for it).
   */
  markSignalScreened: protectedProcedure
    .input(z.object({ signalId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: true };
      await db.update(signalDeals)
        .set({ screened: true })
        .where(and(eq(signalDeals.id, input.signalId), eq(signalDeals.userId, ctx.user.id)));
      return { ok: true };
    }),

  // ── Upgrade Protocol PDF / Text Export ──────────────────────────────────────
  upgradeProtocolPdf: protectedProcedure
    .input(z.object({
      dealName:             z.string().min(1).max(255),
      verdictBefore:        z.string(),
      confidenceBefore:     z.number(),
      missingInputs:        z.array(z.any()),
      performanceGaps:      z.array(z.any()),
      structuralIssues:     z.array(z.any()),
      narrativeFix:         z.object({ original: z.string(), improved: z.string(), rationale: z.string() }),
      riskMitigationActions: z.array(z.any()),
      expectedOutcomeShift: z.object({ predictedVerdict: z.string(), confidenceDelta: z.number(), rationale: z.string() }),
      allFixes:             z.array(z.any()),
      delta:                z.any().optional(),
      format:               z.enum(["pdf", "text", "json"]).default("pdf"),
    }))
    .mutation(async ({ input }) => {
      const protocolInput: UpgradeProtocolInput = {
        ...input,
        generatedAt: new Date().toISOString(),
      };
      if (input.format === "text") {
        const text = generateUpgradeProtocolText(protocolInput);
        return { format: "text" as const, text, base64: null };
      }
      if (input.format === "json") {
        return { format: "json" as const, text: JSON.stringify(protocolInput, null, 2), base64: null };
      }
      const pdfBuffer = await generateUpgradeProtocolPdf(protocolInput);
      const base64 = pdfBuffer.toString("base64");
      return { format: "pdf" as const, base64, text: null };
    }),

  // ── Stress Test Report PDF / Text Export ───────────────────────────────────
  stressTestReportPdf: protectedProcedure
    .input(z.object({
      dealName:             z.string().min(1).max(255),
      baseVerdict:          z.string(),
      mode:                 z.string(),
      targetCount:          z.number(),
      completedAt:          z.union([z.string(), z.date()]).transform(v => v instanceof Date ? v.toISOString() : v),
      executiveSummary:     z.string(),
      decisionDistribution: z.object({
        approvePct:    z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/%$/, '')) || 0 : v),
        conditionalPct: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/%$/, '')) || 0 : v),
        rejectPct:     z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/%$/, '')) || 0 : v),
        vetoPct:       z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/%$/, '')) || 0 : v).optional().default(0),
        totalScenarios: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v, 10) || 0 : v).optional().default(0),
        // aggregator uses hardNoPct instead of vetoPct — accept both
        hardNoPct:     z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v.replace(/%$/, '')) || 0 : v).optional(),
        hardNoCount:   z.number().optional(),
        approveCount:  z.number().optional(),
        conditionalCount: z.number().optional(),
        rejectCount:   z.number().optional(),
        confidenceDistribution: z.object({ low: z.number(), medium: z.number(), high: z.number() }).optional(),
      }),
      failureVectors:       z.array(z.any()),
      approvalPathways:     z.array(z.any()),
      sensitivitySurface:   z.array(z.any()),
      governanceHeatmap:    z.array(z.any()),
      scenarioClusters:     z.any().optional(),
      runId:                z.string().optional(),
      format:               z.enum(["pdf", "text", "json"]).default("pdf"),
    }))
    .mutation(async ({ input }) => {
      // Normalize aggregation data: maps aggregator field names → PDF builder field names,
      // coerces numeric strings, clamps NaN/Infinity, and provides safe fallbacks.
      const rawInput: Record<string, unknown> = {
        ...input,
        generatedAt: new Date().toISOString(),
      };
      const reportInput: StressTestReportInput = normalizeStressTestReportInput(rawInput);

      console.log(
        `[StressTestReportPdf] Export requested: dealName=${reportInput.dealName}` +
        `, mode=${reportInput.mode}, targetCount=${reportInput.targetCount}` +
        `, completedAt=${reportInput.completedAt}, format=${input.format}` +
        `, hasExecutiveSummary=${!!reportInput.executiveSummary}` +
        `, failureVectors=${reportInput.failureVectors.length}` +
        `, approvalPathways=${reportInput.approvalPathways.length}` +
        `, sensitivitySurface=${reportInput.sensitivitySurface.length}` +
        `, governanceHeatmap=${reportInput.governanceHeatmap.length}` +
        `, approvePct=${reportInput.decisionDistribution.approvePct}` +
        `, rejectPct=${reportInput.decisionDistribution.rejectPct}`
      );

      try {
        if (input.format === "text") {
          const text = generateStressTestReportText(reportInput);
          return { format: "text" as const, text, base64: null };
        }
        if (input.format === "json") {
          return { format: "json" as const, text: JSON.stringify(reportInput, null, 2), base64: null };
        }
        const pdfBuffer = await generateStressTestReportPdf(reportInput);
        const base64 = pdfBuffer.toString("base64");
        return { format: "pdf" as const, base64, text: null };
      } catch (err: any) {
        // Log full validation error path if it's a zod-style error
        if (Array.isArray(err?.data?.zodError?.fieldErrors) || Array.isArray(err?.issues)) {
          logValidationError("stressTestReportPdf mutation", err.issues ?? []);
        }
        console.error(
          `[StressTestReportPdf] Export failed: dealName=${reportInput.dealName}` +
          `, mode=${reportInput.mode}, targetCount=${reportInput.targetCount}` +
          `, completedAt=${reportInput.completedAt}, format=${input.format}` +
          `, approvePct=${reportInput.decisionDistribution.approvePct}` +
          `, error=${err?.message ?? String(err)}`,
          err?.stack ?? ""
        );
        throw err;
      }
    }),

  /**
   * Re-run the Infrastructure council with updated deal assumptions.
   * Injects improved terms as a structured preamble into the deal text,
   * re-runs runAdversarialCouncil in infrastructure mode, and returns
   * a comparison object: { original, updated, delta, whatImproved, risksRemaining }.
   *
   * IMPORTANT: This procedure does NOT force a positive outcome.
   * The council genuinely re-evaluates the updated deal text.
   */
  rerunWithUpdatedTerms: protectedProcedure
    .input(z.object({
      originalDealText: z.string().min(10).max(10000).trim(),
      originalVerdict: z.string(),
      originalConfidence: z.number(),
      originalBlockers: z.array(z.string()),
      updatedAssumptions: z.object({
        cfdStrikeGbpMwh: z.number().optional(),       // e.g. 85
        contingencyPct: z.number().optional(),         // e.g. 5
        merchantExposurePct: z.number().optional(),    // e.g. 10
        fixedPriceEpc: z.boolean().optional(),         // true = fixed-price EPC committed
        foundationValidated: z.boolean().optional(),   // true = independent engineering validation obtained
        additionalNotes: z.string().max(500).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Build an "Updated Terms" preamble that the council will see at the top of the deal text
      const { updatedAssumptions: ua } = input;
      const preambleLines: string[] = [
        "=== UPDATED TERMS SCENARIO (Infrastructure / Project Finance Council) ===",
        "The following assumptions have been updated from the original submission.",
        "The council must evaluate the deal under these revised terms.",
        "",
      ];

      if (ua.cfdStrikeGbpMwh !== undefined) {
        preambleLines.push(`CfD Strike Price: UPDATED to £${ua.cfdStrikeGbpMwh}/MWh (was below threshold in original submission)`);
      }
      if (ua.contingencyPct !== undefined) {
        preambleLines.push(`Construction Contingency: UPDATED to ${ua.contingencyPct}% of CAPEX (was critically low in original submission)`);
      }
      if (ua.merchantExposurePct !== undefined) {
        preambleLines.push(`Merchant Exposure: REDUCED to ${ua.merchantExposurePct}% uncontracted revenue (was 20% in original submission)`);
      }
      if (ua.fixedPriceEpc === true) {
        preambleLines.push(`EPC Contract: UPDATED — committed fixed-price EPC with liquidated damages backstop now in place`);
      }
      if (ua.foundationValidated === true) {
        preambleLines.push(`Floating Foundation Technology: VALIDATED — independent engineering validation at commercial scale obtained`);
      }
      if (ua.additionalNotes) {
        preambleLines.push(`Additional Notes: ${ua.additionalNotes}`);
      }

      preambleLines.push("");
      preambleLines.push("=== ORIGINAL DEAL MEMO (unchanged) ===");
      preambleLines.push("");

      const updatedDealText = preambleLines.join("\n") + input.originalDealText;

      // Re-run the council in infrastructure mode — no forced outcome
      const updatedResult = await runAdversarialCouncil(updatedDealText, {
        userId: ctx.user.id,
        councilMode: "infrastructure",
        skipMemory: true,
        bypassCostGuard: true,
      });

      // Compute verdict delta label
      const VERDICT_RANK: Record<string, number> = {
        VETOED: 0,
        REJECTED: 1,
        INSUFFICIENT_DATA: 2,
        APPROVED_WITH_CONDITIONS: 3,
        APPROVED: 4,
      };
      const origRank = VERDICT_RANK[input.originalVerdict] ?? 1;
      const updRank = VERDICT_RANK[updatedResult.verdict] ?? 1;
      let deltaLabel: string;
      if (updRank > origRank) {
        const steps = updRank - origRank;
        deltaLabel = steps >= 2 ? `SIGNIFICANT IMPROVEMENT (+${steps} levels)` : `IMPROVED (${input.originalVerdict} → ${updatedResult.verdict})`;
      } else if (updRank < origRank) {
        deltaLabel = `WORSENED (${input.originalVerdict} → ${updatedResult.verdict})`;
      } else {
        deltaLabel = `UNCHANGED (${updatedResult.verdict})`;
      }

      // Identify what improved: original blockers no longer present in updated blockers
      const updatedBlockers = updatedResult.blockingIssues ?? [];
      const updatedBlockersLower = updatedBlockers.map(b => b.toLowerCase());
      const whatImproved: string[] = [];
      const risksRemaining: string[] = [...updatedBlockers];

      for (const blocker of input.originalBlockers) {
        const bl = blocker.toLowerCase();
        const stillPresent = updatedBlockersLower.some(ub =>
          ub.includes(bl.slice(0, 20)) || bl.includes(ub.slice(0, 20))
        );
        if (!stillPresent) {
          whatImproved.push(blocker);
        }
      }

      // Add assumption-level improvements to whatImproved
      if (ua.cfdStrikeGbpMwh !== undefined) whatImproved.push(`CfD updated to £${ua.cfdStrikeGbpMwh}/MWh`);
      if (ua.contingencyPct !== undefined) whatImproved.push(`Contingency raised to ${ua.contingencyPct}%`);
      if (ua.merchantExposurePct !== undefined) whatImproved.push(`Merchant exposure reduced to ${ua.merchantExposurePct}%`);
      if (ua.fixedPriceEpc === true) whatImproved.push("Fixed-price EPC committed");
      if (ua.foundationValidated === true) whatImproved.push("Floating foundation independently validated");

      // Deduplicate whatImproved
      const uniqueImproved = Array.from(new Set(whatImproved));

      return {
        originalVerdict: input.originalVerdict,
        originalConfidence: input.originalConfidence,
        originalBlockers: input.originalBlockers,
        updatedVerdict: updatedResult.verdict,
        updatedConfidence: updatedResult.confidenceScore,
        updatedBlockers: risksRemaining,
        updatedYesCount: updatedResult.yesCount,
        updatedNoCount: updatedResult.noCount,
        deltaLabel,
        whatImproved: uniqueImproved,
        risksRemaining,
      councilMode: "infrastructure" as const,
      assumptionsApplied: {
        cfdStrikeGbpMwh: ua.cfdStrikeGbpMwh,
        contingencyPct: ua.contingencyPct,
        merchantExposurePct: ua.merchantExposurePct,
        fixedPriceEpc: ua.fixedPriceEpc,
        foundationValidated: ua.foundationValidated,
      },
    };
  }),

  // ── Fix the Deal engine ─────────────────────────────────────────────────────
  fixTheDeal: protectedProcedure
    .input(z.object({
      dealText:        z.string().min(10).max(12000).trim(),
      councilOutcome:  z.string().min(1).max(500).trim(),
      icMemoSummary:   z.string().max(4000).trim().optional(),
      councilMode:     z.string().optional(),
      // Structured terminal flags from council HARD_NO votes — shared enum, never prose.
      // Populated by the frontend from result.terminalFlags (set by councilEngine.ts).
      // Used for code-side classification derivation — never trust LLM classification alone.
      terminalFlags:   z.array(z.string()).optional().default([]),
    }))
    .mutation(async ({ input }) => {
      const modeHint = input.councilMode === "infrastructure"
        ? "This deal must be evaluated as Infrastructure / Project Finance — NOT venture capital. Use DSCR, CfD, EPC, LCOE, and project-finance logic throughout."
        : "Apply the appropriate investor archetype based on the deal type.";

      const systemPrompt = `You are the AgenThink Mesh Deal Repair Engine.
Your sole function is to analyse a rejected or vetoed investment deal brief and systematically reconstruct it to achieve a positive Council outcome WITHOUT fabricating information that cannot be commercially justified.

${modeHint}

Return ONLY valid JSON matching this schema exactly. No prose before or after the JSON.

{
  "classification": "A" | "B" | "C",
  "classificationRationale": "<max 60 words>",
  "rootCauses": [
    { "category": "<A-G label>", "description": "<max 40 words>", "priority": <1-7> }
  ],
  "revisedBrief": "<full revised deal brief with [REVISED: reason] inline tags on changed lines>",
  "changeSummaryTable": [
    { "change": "<what changed>", "original": "<before>", "revised": "<after>", "rootCauseAddressed": "<category>", "estimatedVoteImpact": "<e.g. +2 YES>" }
  ],
  "predictedOutcome": {
    "voteDistribution": "<e.g. 7 YES / 2 CONDITIONAL / 1 NO>",
    "consensusPct": <number 0-100>,
    "decision": "<APPROVED | APPROVED_WITH_CONDITIONS | CONDITIONAL | HOLD | REJECTED | VETOED>",
    "mostLikelyDissentingAgent": "<agent name>",
    "mostLikelyCondition": "<attached condition>"
  },
  "approvalSensitivityLadder": [
    { "structuralChange": "<description>", "estimatedVoteShift": "<e.g. +2 YES>", "runningVoteEstimate": "<e.g. 4 YES>" }
  ],
  "residualRisks": ["<risk 1>", "<risk 2>", "<risk 3>"]
}

RULES:
- Never fabricate approvals, remove legitimate risks, or force positive outcomes.
- Only mark something as executed/awarded/confirmed if commercially realistic and timeline-feasible.
- If classification is C (fundamentally non-viable), state this clearly in classificationRationale and set decision to REJECTED.
- Mark every changed line in revisedBrief with [REVISED: <reason>].
- Preserve 3-5 real residual risks.
- Stop applying fixes once projected outcome reaches approximately 7/10 YES.
- Terminate immediately after closing JSON brace.`;

      const userMessage = `[ORIGINAL DEAL BRIEF]
${input.dealText}

[COUNCIL OUTCOME]
${input.councilOutcome}

[IC MEMO SUMMARY]
${input.icMemoSummary ?? "Not provided."}`;

      const raw = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fix_the_deal",
            strict: true,
            schema: {
              type: "object",
              properties: {
                classification:           { type: "string" },
                classificationRationale:  { type: "string" },
                rootCauses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category:    { type: "string" },
                      description: { type: "string" },
                      priority:    { type: "number" },
                    },
                    required: ["category", "description", "priority"],
                    additionalProperties: false,
                  },
                },
                revisedBrief: { type: "string" },
                changeSummaryTable: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      change:               { type: "string" },
                      original:             { type: "string" },
                      revised:              { type: "string" },
                      rootCauseAddressed:   { type: "string" },
                      estimatedVoteImpact:  { type: "string" },
                    },
                    required: ["change", "original", "revised", "rootCauseAddressed", "estimatedVoteImpact"],
                    additionalProperties: false,
                  },
                },
                predictedOutcome: {
                  type: "object",
                  properties: {
                    voteDistribution:            { type: "string" },
                    consensusPct:                { type: "number" },
                    decision:                    { type: "string" },
                    mostLikelyDissentingAgent:   { type: "string" },
                    mostLikelyCondition:         { type: "string" },
                  },
                  required: ["voteDistribution", "consensusPct", "decision", "mostLikelyDissentingAgent", "mostLikelyCondition"],
                  additionalProperties: false,
                },
                approvalSensitivityLadder: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      structuralChange:      { type: "string" },
                      estimatedVoteShift:    { type: "string" },
                      runningVoteEstimate:   { type: "string" },
                    },
                    required: ["structuralChange", "estimatedVoteShift", "runningVoteEstimate"],
                    additionalProperties: false,
                  },
                },
                residualRisks: { type: "array", items: { type: "string" } },
              },
              required: ["classification", "classificationRationale", "rootCauses", "revisedBrief", "changeSummaryTable", "predictedOutcome", "approvalSensitivityLadder", "residualRisks"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = raw.choices?.[0]?.message?.content ?? "{}";
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Attempt to extract JSON from markdown code block
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          try { parsed = JSON.parse(match[1]); } catch { parsed = {}; }
        } else {
          parsed = {};
        }
      }

      // ── CODE-SIDE CLASSIFICATION (Guard 0 — runs before all other guards) ─────
      // codeClassification is derived from structured terminalFlags (council HARD_NO enum),
      // NOT from the LLM's self-reported classification.
      // TERMINAL_FLAGS is derived from rescuePolicy — never hand-maintained.
      // FAIL-SAFE: any unknown flag (not in enum) is treated as TERMINAL → C.
      const codeClassification = deriveClassification(input.terminalFlags);

      // ── GUARD 1: C-DEAL CLEAN CONSTRUCTOR ────────────────────────────────────
      // If codeClassification === "C", build a clean rejected result from scratch.
      // Do NOT pass LLM output through — any positive field the LLM returned is discarded.
      // This prevents fabricated-positive leakage (e.g. score=82, decision=APPROVE on a C deal).
      // The restructuring memo path is still available for C deals (separate procedure).
      if (codeClassification === "C") {
        const terminalPolicyEntries = (input.terminalFlags as TerminalBlockerFlag[])
          .filter((f) => TERMINAL_FLAGS.has(f))
          .map((f) => rescuePolicy[f]);
        const residualRisks = terminalPolicyEntries.length > 0
          ? terminalPolicyEntries.map((e) => e.residualRisk)
          : ["Terminal institutional blocker — deal cannot be rescued at the deal level."];
        return {
          // codeClassification overrides LLM classification — always C for terminal deals
          classification:           "C" as const,
          classificationRationale:  `This deal contains one or more terminal institutional blockers (${input.terminalFlags.join(", ")}). No deal-level restructuring can address these. A from-scratch resubmission through Stage 1 is required after the underlying condition is resolved.`,
          rootCauses:               [],
          // revisedBrief: null — C deals do not receive a revised brief (no rescue path)
          revisedBrief:             "",
          changeSummaryTable:       [],
          // predictedOutcome: all positive/score fields are null/zero — no fabricated signal
          predictedOutcome: {
            voteDistribution:          "0 YES / 10 NO",
            consensusPct:              0,      // ← no positive score survives
            decision:                  "REJECTED" as const,  // ← hard REJECTED, never APPROVE/CONDITIONAL
            mostLikelyDissentingAgent: "All agents",
            mostLikelyCondition:       "N/A — terminal blocker",
          },
          approvalSensitivityLadder: [],  // ← no upgrade path for C deals
          residualRisks,
          // codeClassification field exposed so frontend can gate PDF/memo surfaces
          codeClassification:        "C" as const,
          // terminalFlags echoed back so the panel header badge row can render them
          terminalFlags:             input.terminalFlags,
        };
      }

      // ── GUARD 2: DECISION NORMALIZATION (runs before Guards 3–5) ─────────────
      // Normalize the LLM decision string BEFORE any guard runs.
      // Catches casing variants ("APPROVE" → "APPROVED", "approve" → "APPROVED").
      // Guard 3 MUST precede Guard 4 (ordering is load-bearing — see Guard 4 comment).
      const rawDecision = ((parsed.predictedOutcome as Record<string, unknown>)?.decision as string ?? "REJECTED").toUpperCase().trim();
      const DECISION_SYNONYMS: Record<string, string> = {
        "APPROVE": "APPROVED",
        "APPROVED_WITH_CONDITION": "APPROVED_WITH_CONDITIONS",
        "CONDITIONAL_APPROVAL": "APPROVED_WITH_CONDITIONS",
        "CONDITIONAL": "APPROVED_WITH_CONDITIONS",
        "HOLD": "HOLD",
        "REJECT": "REJECTED",
        "VETO": "VETOED",
      };
      const normalizedDecision = DECISION_SYNONYMS[rawDecision] ?? rawDecision;

      // ── GUARD 3: CEILING CAP (APPROVED → APPROVED_WITH_CONDITIONS) ───────────
      // A rescued deal caps at APPROVED_WITH_CONDITIONS. It can NEVER mint an APPROVE.
      // APPROVED is intentionally absent from VALID_RESCUE_DECISIONS (see Guard 4).
      // This guard runs BEFORE Guard 4 so APPROVED is upgraded before the default net.
      const VALID_RESCUE_DECISIONS = new Set([
        "APPROVED_WITH_CONDITIONS",
        "HOLD",
        "REJECTED",
        "VETOED",
        "INSUFFICIENT_DATA",
      ]);
      const cappedDecision = normalizedDecision === "APPROVED"
        ? "APPROVED_WITH_CONDITIONS"  // ← ceiling cap: APPROVED → APPROVED_WITH_CONDITIONS
        : normalizedDecision;

      // ── GUARD 4: DEFAULT-REJECT NET ───────────────────────────────────────────
      // Any decision not in VALID_RESCUE_DECISIONS falls through to REJECTED.
      // APPROVED is intentionally absent — Guard 3 must have already handled it.
      // NOTE: This guard is also the BACKSTOP for the B-default in deriveClassification.
      // The A/B distinction is deferred (all non-C deals return B). Guard 4 ensures
      // B cannot leak an APPROVE even if the LLM returns one.
      // DO NOT remove Guard 4 believing B is independently safe — it is not.
      const finalDecision = VALID_RESCUE_DECISIONS.has(cappedDecision)
        ? cappedDecision
        : "REJECTED";  // ← default: REJECTED, never allow unknown values through

      // ── GUARD 5: CONSENSUS PCT CAP ────────────────────────────────────────────
      // consensusPct must not exceed 99 for a rescued deal (never 100 — that implies
      // unanimous approval which is not achievable for a previously-rejected deal).
      const rawConsensusPct = typeof (parsed.predictedOutcome as Record<string, unknown>)?.consensusPct === "number"
        ? (parsed.predictedOutcome as Record<string, unknown>).consensusPct as number
        : 0;
      const cappedConsensusPct = Math.min(Math.max(rawConsensusPct, 0), 99);

      // ── RESCUABLE FLAG MITIGATION INJECTION ─────────────────────────────────
      // For B deals, append rescuePolicy mitigation and residualRisk text for any
      // RESCUABLE flags present. This ensures the panel shows the institutional
      // mitigation text even if the LLM did not include it.
      const rescuableFlagEntries = (input.terminalFlags as TerminalBlockerFlag[])
        .filter((f) => !TERMINAL_FLAGS.has(f) && rescuePolicy[f as TerminalBlockerFlag])
        .map((f) => rescuePolicy[f as TerminalBlockerFlag]);
      const llmResidualRisks = (parsed.residualRisks as string[]) ?? [];
      const policyResidualRisks = rescuableFlagEntries
        .map((e) => e.residualRisk)
        .filter((r) => r && !llmResidualRisks.includes(r)) as string[];
      const mergedResidualRisks = [...llmResidualRisks, ...policyResidualRisks];

      return {
        classification:           codeClassification,  // ← code-derived, never LLM-judged
        classificationRationale:  (parsed.classificationRationale as string) ?? "Unable to parse engine output.",
        rootCauses:               (parsed.rootCauses as unknown[])            ?? [],
        revisedBrief:             (parsed.revisedBrief as string)             ?? "",
        changeSummaryTable:       (parsed.changeSummaryTable as unknown[])    ?? [],
        predictedOutcome: {
          ...((parsed.predictedOutcome as Record<string, unknown>) ?? {}),
          decision:      finalDecision,      // ← Guard 3+4 applied
          consensusPct:  cappedConsensusPct, // ← Guard 5 applied
        },
        approvalSensitivityLadder: (parsed.approvalSensitivityLadder as unknown[]) ?? [],
        residualRisks:             mergedResidualRisks,
        codeClassification,  // ← exposed so frontend can gate PDF/memo surfaces
        // terminalFlags echoed back so the panel header badge row can render them
        terminalFlags:             input.terminalFlags,
      };
    }),

  // ── Export Repair Brief PDF ─────────────────────────────────────────────────
  exportRepairBrief: protectedProcedure
    .input(z.object({
      dealName:                z.string().min(1).max(200).trim(),
      councilMode:             z.string().optional(),
      classification:          z.enum(["A", "B", "C"]),
      classificationRationale: z.string(),
      rootCauses:              z.array(z.object({
        category:    z.string(),
        description: z.string(),
        priority:    z.number(),
      })),
      revisedBrief:            z.string(),
      changeSummaryTable:      z.array(z.object({
        change:               z.string(),
        original:             z.string(),
        revised:              z.string(),
        rootCauseAddressed:   z.string(),
        estimatedVoteImpact:  z.string(),
      })),
      predictedOutcome:        z.object({
        voteDistribution:           z.string(),
        consensusPct:               z.number(),
        decision:                   z.string(),
        mostLikelyDissentingAgent:  z.string(),
        mostLikelyCondition:        z.string(),
      }),
      approvalSensitivityLadder: z.array(z.object({
        structuralChange:     z.string(),
        estimatedVoteShift:   z.string(),
        runningVoteEstimate:  z.string(),
      })),
      residualRisks: z.array(z.string()),
      // Structured terminal blocker flags from the council engine (TerminalBlockerFlag enum values).
      // These are the SOLE source for naming blockers in the PDF — prose inference is forbidden.
      // The frontend must pass result.terminalFlags directly; never derive from rootCauses or prose.
      // Optional to remain backward-compatible; empty array treated as "Not available."
      terminalFlags: z.array(z.string()).optional().default([]),
    }))
    .mutation(async ({ input }) => {
      const briefInput: RepairBriefInput = {
        dealName:                input.dealName,
        councilMode:             input.councilMode,
        classification:          input.classification,
        classificationRationale: input.classificationRationale,
        // Pass structured terminalFlags through to PDF generator — never infer from prose.
        terminalFlags:           input.terminalFlags,
        rootCauses:              input.rootCauses,
        revisedBrief:            input.revisedBrief,
        changeSummaryTable:      input.changeSummaryTable,
        predictedOutcome:        input.predictedOutcome,
        approvalSensitivityLadder: input.approvalSensitivityLadder,
        residualRisks:           input.residualRisks,
      };
      const buffer = await generateRepairBriefPdf(briefInput);
      return { pdfBase64: buffer.toString("base64") };
    }),

  // ── Request Restructuring Memo (Class C only) ───────────────────────────────
  // Produces a 300-word IC-partner-to-sponsor memo explaining why the deal
  // cannot be approved and what fundamental changes are required.
  requestRestructuringMemo: protectedProcedure
    .input(z.object({
      dealName:                z.string().min(1).max(200).trim(),
      classificationRationale: z.string().min(1).max(2000).trim(),
      // Structured terminal blocker flags from the council engine (TerminalBlockerFlag enum values).
      // These are the SOLE source for naming blockers in the memo — prose inference is forbidden.
      // The frontend must pass result.terminalFlags directly; never derive from rootCauses or prose.
      terminalFlags:           z.array(z.string()).min(1).max(10),
      councilMode:             z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const modeLabel = input.councilMode === "infrastructure"
        ? "Infrastructure / Project Finance"
        : "Venture Capital";

      // Derive the canonical blocker labels from the structured terminalFlags array.
      // This is the ONLY source — no prose parsing, no rootCauses inference, no fallback to text.
      // If a flag is not in rescuePolicy, it is still named verbatim (fail-safe: unknown = terminal).
      const namedBlockers = input.terminalFlags.map((flag) => {
        const policy = rescuePolicy[flag as TerminalBlockerFlag];
        const label = flag.replace(/_/g, " ").toUpperCase();
        const residual = policy?.residualRisk ?? "No deal-level mitigation available. Terminal institutional blocker.";
        return `${label}: ${residual}`;
      });

      const systemPrompt = `You are a senior Investment Committee partner writing a formal memo to a deal sponsor.
Tone: direct, professional, IC-partner-to-sponsor. Not apologetic. Not encouraging.
This deal has been classified as fundamentally non-viable (Class C) by the Council of 10.
Write a memo of exactly 250-300 words. No more.

Structure:
1. Opening sentence: state clearly that the submission cannot be approved in its current form.
2. Paragraph 1 (60-80 words): explain the primary structural reason the deal fails, referencing the terminal blockers listed below BY NAME — do not invent or substitute other blockers.
3. Paragraph 2 (80-100 words): explain why these specific blockers cannot be addressed at deal level and what condition would need to change before resubmission is viable.
4. Closing sentence: state the condition under which the sponsor may resubmit.

CRITICAL: You MUST name ONLY the blockers provided in the Terminal Blockers list. Do not infer, add, or substitute blockers from any other source.

Do NOT:
- Use bullet points
- Be apologetic or encouraging
- Suggest the deal is "close" to approval
- Use phrases like "we appreciate your submission"
- Exceed 300 words
- Name any blocker not in the Terminal Blockers list

Return only the memo text. No subject line, no salutation, no signature block.`;

      const userMessage = `Deal Name: ${input.dealName}
Council Mode: ${modeLabel}
Classification Rationale: ${input.classificationRationale}
Terminal Blockers (name ONLY these — no others):
${namedBlockers.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;

      const raw = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
      });

      const memo = raw.choices?.[0]?.message?.content ?? "Unable to generate memo.";
      const memoText = typeof memo === "string" ? memo.trim() : JSON.stringify(memo);

      // Echo back the structured terminalFlags so callers can verify which blockers were named.
      return { memo: memoText, terminalFlags: input.terminalFlags };
    }),

});

// ── Static demo signals — shown when user has no stored signals ────────────────
const DEMO_SIGNALS = [
  {
    id: -1,
    company: "Finvera",
    sector: "Fintech",
    stage: "Series A",
    summary: "Embedded lending infrastructure for GCC SMEs. $4M ARR, 3 bank partnerships signed.",
    source: "Wamda Capital Portfolio Update",
    screened: false,
    autoScreened: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: -2,
    company: "CarbonTrace MENA",
    sector: "Climate Tech",
    stage: "Seed",
    summary: "Carbon credit tokenisation for GCC sovereign funds. Harvard iLab cohort. Pre-revenue.",
    source: "Harvard iLab Cohort Announcement",
    screened: false,
    autoScreened: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: -3,
    company: "Arabi NLP",
    sector: "B2B AI",
    stage: "Pre-Seed",
    summary: "Arabic-first LLM for legal and financial document processing. MIT delta v cohort.",
    source: "MIT delta v Accelerator",
    screened: false,
    autoScreened: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: -4,
    company: "GridSoft",
    sector: "Energy Tech",
    stage: "Seed",
    summary: "Software-defined smart grid optimisation for MENA utilities. NSF SBIR Phase I awardee.",
    source: "NSF SBIR Phase I Awards",
    screened: false,
    autoScreened: false,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    id: -5,
    company: "SupplyTrace",
    sector: "Supply Chain Tech",
    stage: "Pre-Seed",
    summary: "Blockchain-based F&B supply chain provenance. Devpost Global Hackathon winner.",
    source: "Devpost Global Hackathon",
    screened: false,
    autoScreened: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];
