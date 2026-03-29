/**
 * billing.ts — tRPC router for billing, trial, and upgrade procedures
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, count, avg, sql } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users, subscriptions, payments } from "../../drizzle/schema";
import {
  getUsageStatus,
  assertWorkflowAccess,
  applyUpgrade,
  assignEnterprisePlan,
  PLAN_MONTHLY_LIMITS,
} from "../billing";
import { tokenUsage } from "../../drizzle/schema";
import { desc, sum } from "drizzle-orm";
import { STRIPE_PLANS } from "../lib/stripePlans";

// ── Stripe stub (keys injected when STRIPE_SECRET_KEY is set) ─────────────────
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Stripe = require("stripe");
    return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  } catch {
    return null;
  }
}

// Legacy plan prices (kept for backwards compat)
const PLAN_PRICES: Record<string, string | undefined> = {
  standard: process.env.STRIPE_STANDARD_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  // New plans
  professional: STRIPE_PLANS.professional.priceId ?? undefined,
  enterprise: STRIPE_PLANS.enterprise.priceId ?? undefined,
};

export const billingRouter = router({
  // ── Usage status (for PlanUsageBadge) ──────────────────────────────────────
  getUsageStatus: protectedProcedure.query(async ({ ctx }) => {
    return getUsageStatus(ctx.user.id);
  }),

  // ── Upgrade summary (for /upgrade screen) ──────────────────────────────────
  getUpgradeSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    // Count vault documents
    let vaultDocs = 0;
    try {
      const { vaultDocuments } = await import("../../drizzle/schema");
      const [vaultCount] = await db.select({ count: count() }).from(vaultDocuments).where(eq(vaultDocuments.userId, ctx.user.id));
      vaultDocs = vaultCount?.count ?? 0;
    } catch { /* vault table may not exist */ }

    // Count workflow runs
    let workflowsCompleted = 0;
    try {
      const { workflowRuns } = await import("../../drizzle/schema");
      const [wfCount] = await db.select({ count: count() }).from(workflowRuns)
        .where(and(eq(workflowRuns.userId, ctx.user.id), sql`${workflowRuns.status} = 'complete'`));
      workflowsCompleted = wfCount?.count ?? 0;
    } catch { /* workflow_runs may not exist */ }

    return {
      runsUsed: (user.totalCompletedRuns ?? 0),
      agentsFired: (user.totalAgentsFired ?? 0),
      workflowsCompleted,
      documentsSaved: vaultDocs,
      planTier: user.planTier ?? "trial",
    };
  }),

  // ── Check run access (lightweight check for UI) ────────────────────────────
  checkAccess: protectedProcedure.query(async ({ ctx }) => {
    return assertWorkflowAccess(ctx.user.id);
  }),

  // ── Create Stripe checkout session ─────────────────────────────────────────
  createCheckoutSession: protectedProcedure
    .input(z.object({
      plan: z.enum(["standard", "pro", "professional", "enterprise"]),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const priceId = PLAN_PRICES[input.plan];

      if (!stripe || !priceId) {
        // Stub mode — return a placeholder URL
        return {
          url: `${input.origin}/pricing?stub=true&plan=${input.plan}`,
          stub: true,
        };
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      // Reuse existing Stripe customer if available
      const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
      let customerId = existingSub?.stripeCustomerId ?? undefined;

      if (!customerId && stripe) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          metadata: { userId: String(ctx.user.id) },
        });
        customerId = customer.id;
        // Save customer ID
        if (existingSub) {
          await db.update(subscriptions).set({ stripeCustomerId: customerId }).where(eq(subscriptions.userId, ctx.user.id));
        } else {
          await db.insert(subscriptions).values({
            userId: ctx.user.id,
            planTier: "trial",
            plan: "starter",
            status: "active",
            tokensRemaining: 50,
            tokensTotal: 50,
            stripeCustomerId: customerId,
          });
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        client_reference_id: String(ctx.user.id),
        success_url: `${input.origin}/account/billing?success=1&plan=${input.plan}`,
        cancel_url: `${input.origin}/pricing?canceled=1`,
        metadata: {
          userId: String(ctx.user.id),
          plan: input.plan,
          customer_email: user.email ?? "",
          customer_name: user.name ?? "",
        },
      });

      return { url: session.url ?? `${input.origin}/pricing`, stub: false };
    }),

  // ── Get current subscription + token balance ───────────────────────────────
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, ctx.user.id))
      .limit(1);

    if (!sub) {
      if (db) await db.insert(subscriptions).values({
        userId: ctx.user.id,
        planTier: "trial",
        plan: "starter",
        status: "active",
        tokensRemaining: 50,
        tokensTotal: 50,
      });
      return { plan: "starter" as const, status: "active", tokensRemaining: 50, tokensTotal: 50, renewsAt: null, stripeSubscriptionId: null };
    }

    return {
      plan: (sub.plan ?? "starter") as string,
      status: sub.status,
      tokensRemaining: sub.tokensRemaining ?? 50,
      tokensTotal: sub.tokensTotal ?? 50,
      renewsAt: sub.renewsAt ?? null,
      stripeSubscriptionId: sub.stripeSubscriptionId ?? null,
    };
  }),

  // ── Get token usage history ────────────────────────────────────────────────
  getTokenHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(tokenUsage)
        .where(eq(tokenUsage.userId, ctx.user.id))
        .orderBy(desc(tokenUsage.createdAt))
        .limit(input.limit);
    }),

  // ── Get billing portal URL ─────────────────────────────────────────────────
  getBillingPortal: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      if (!stripe) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe not configured" });

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);

      if (!sub?.stripeCustomerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No Stripe customer found. Please subscribe first." });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${input.origin}/account/billing`,
      });

      return { portalUrl: session.url };
    }),

  // ── Billing stats for the /account/billing page ────────────────────────────
  getBillingStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, ctx.user.id)).limit(1);
    const [usageResult] = await db
      .select({ total: sum(tokenUsage.tokensUsed) })
      .from(tokenUsage)
      .where(eq(tokenUsage.userId, ctx.user.id));

    const totalTokensUsed = Number(usageResult?.total ?? 0);
    const tokensRemaining = sub?.tokensRemaining ?? 50;
    const tokensTotal = sub?.tokensTotal ?? 50;
    const plan = sub?.plan ?? "starter";

    return {
      plan,
      tokensRemaining,
      tokensTotal,
      totalTokensUsed,
      usagePercent: tokensTotal > 0 ? Math.round(((tokensTotal - tokensRemaining) / tokensTotal) * 100) : 0,
      renewsAt: sub?.renewsAt ?? null,
      status: sub?.status ?? "active",
    };
  }),

  // ── Refresh monthly allowance ───────────────────────────────────────────────
  refreshRunAllowanceIfNeeded: protectedProcedure.mutation(async ({ ctx }) => {
    const { refreshMonthlyAllowanceIfNeeded } = await import("../billing");
    await refreshMonthlyAllowanceIfNeeded(ctx.user.id);
    return { ok: true };
  }),

  // ── ADMIN: assign enterprise plan ──────────────────────────────────────────
  assignEnterprise: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await assignEnterprisePlan(input.userId);
      return { ok: true };
    }),

  // ── ADMIN: trial metrics ────────────────────────────────────────────────────
  listTrialMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();

    const allUsers = await db.select({
      id: users.id,
      planTier: users.planTier,
      trialRunsRemaining: users.trialRunsRemaining,
      trialExpiresAt: users.trialExpiresAt,
      totalCompletedRuns: users.totalCompletedRuns,
      convertedAt: users.convertedAt,
      createdAt: users.createdAt,
    }).from(users);

    const trialUsers = allUsers.filter(u => u.planTier === "trial");
    const activeTrials = trialUsers.filter(u =>
      u.trialExpiresAt && new Date(u.trialExpiresAt) > now && (u.trialRunsRemaining ?? 0) > 0
    );
    const expiredTrials = trialUsers.filter(u =>
      !u.trialExpiresAt || new Date(u.trialExpiresAt) <= now || (u.trialRunsRemaining ?? 0) <= 0
    );
    const convertedUsers = allUsers.filter(u => u.convertedAt != null);

    const avgRunsPerTrial = trialUsers.length > 0
      ? trialUsers.reduce((sum, u) => sum + (u.totalCompletedRuns ?? 0), 0) / trialUsers.length
      : 0;

    const conversionRate = trialUsers.length > 0
      ? (convertedUsers.length / allUsers.length) * 100
      : 0;

    // Users near expiry (within 7 days)
    const nearExpiry = activeTrials.filter(u => {
      if (!u.trialExpiresAt) return false;
      const msLeft = new Date(u.trialExpiresAt).getTime() - now.getTime();
      return msLeft <= 7 * 24 * 60 * 60 * 1000;
    });

    return {
      totalTrialUsers: trialUsers.length,
      activeTrials: activeTrials.length,
      expiredTrials: expiredTrials.length,
      convertedUsers: convertedUsers.length,
      avgRunsPerTrial: Math.round(avgRunsPerTrial * 10) / 10,
      conversionRate: Math.round(conversionRate * 10) / 10,
      nearExpiry: nearExpiry.length,
      recentSignups: allUsers
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(u => ({
          id: u.id,
          planTier: u.planTier,
          totalCompletedRuns: u.totalCompletedRuns ?? 0,
          createdAt: u.createdAt,
        })),
    };
  }),

  // ── ADMIN: revenue metrics ──────────────────────────────────────────────────
  listRevenueMetrics: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const allPayments = await db.select().from(payments).where(eq(payments.status, "succeeded"));
    const totalRevenue = allPayments.reduce((sum, p) => sum + parseFloat(String(p.amountUsd)), 0);

    const allSubs = await db.select().from(subscriptions).where(eq(subscriptions.status, "active"));
    const mrr = allSubs.reduce((sum, s) => {
      const price = s.planTier === "standard" ? 49 : s.planTier === "pro" ? 149 : 0;
      return sum + price;
    }, 0);

    const standardCount = allSubs.filter(s => s.planTier === "standard").length;
    const proCount = allSubs.filter(s => s.planTier === "pro").length;
    const enterpriseCount = allSubs.filter(s => s.planTier === "enterprise").length;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      mrr,
      activeSubscriptions: allSubs.length,
      standardCount,
      proCount,
      enterpriseCount,
      recentPayments: allPayments
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    };
  }),

  // ── ADMIN: list all users with plan info ───────────────────────────────────
  listUsersWithPlan: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      planTier: users.planTier,
      trialRunsRemaining: users.trialRunsRemaining,
      trialExpiresAt: users.trialExpiresAt,
      monthlyRunsUsed: users.monthlyRunsUsed,
      monthlyRunsLimit: users.monthlyRunsLimit,
      totalCompletedRuns: users.totalCompletedRuns,
      convertedAt: users.convertedAt,
      createdAt: users.createdAt,
    }).from(users).orderBy(sql`createdAt DESC`).limit(100);
  }),
});
