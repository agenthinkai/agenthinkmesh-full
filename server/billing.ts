/**
 * billing.ts — AgenThinkMesh Free Trial + Billing Engine
 *
 * Exports:
 *  - assignTrialOnFirstLogin(userId)  — called from OAuth callback
 *  - assertWorkflowAccess(userId)     — gateway before every workflow run
 *  - recordRunCompletion(userId, agentSteps) — decrement after successful run
 *  - refreshMonthlyAllowanceIfNeeded(userId) — auto-reset on billing cycle rollover
 *  - getUsageStatus(userId)           — for PlanUsageBadge + /upgrade screen
 */

import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { users, subscriptions, emailEvents } from "../drizzle/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanTier = "trial" | "standard" | "pro" | "enterprise";

export type AccessResult =
  | { allowed: true; planTier: PlanTier }
  | { allowed: false; reason: "TRIAL_ENDED" | "PLAN_LIMIT_REACHED" | "SUBSCRIPTION_INACTIVE"; planTier: PlanTier };

export interface UsageStatus {
  planTier: PlanTier;
  trialRunsRemaining: number;
  daysUntilTrialExpiry: number | null;
  monthlyRunsLimit: number | null;
  monthlyRunsUsed: number;
  totalCompletedRuns: number;
  totalAgentsFired: number;
  isExpired: boolean;
  shouldRedirectToConversion: boolean;
}

// ── Plan limits ───────────────────────────────────────────────────────────────

export const PLAN_MONTHLY_LIMITS: Record<string, number | null> = {
  trial: null,
  standard: 200,
  pro: 500,
  enterprise: null,
};

// ── Trial assignment ──────────────────────────────────────────────────────────

/**
 * Called after every OAuth login. Idempotent — only sets trial fields if not
 * already set (i.e., first login).
 */
export async function assignTrialOnFirstLogin(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  // Already has trial dates set — not first login
  if (user.trialStartedAt) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // +60 days

  await db.update(users)
    .set({
      planTier: "trial",
      trialRunsRemaining: 50,
      trialStartedAt: now,
      trialExpiresAt: expiresAt,
      monthlyRunsUsed: 0,
      totalCompletedRuns: 0,
      totalAgentsFired: 0,
    })
    .where(and(eq(users.id, userId), sql`trialStartedAt IS NULL`));
}

// ── Monthly allowance reset ───────────────────────────────────────────────────

/**
 * For standard/pro users: reset monthly_runs_used if billing cycle has rolled over.
 * Called on every access check — no cron needed.
 */
export async function refreshMonthlyAllowanceIfNeeded(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  if (user.planTier !== "standard" && user.planTier !== "pro") return;
  if (!user.billingCycleAnchor) return;

  const now = new Date();
  const anchor = new Date(user.billingCycleAnchor);

  // Calculate next cycle boundary: anchor + N months where N = months elapsed
  const monthsElapsed = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth());
  const nextReset = new Date(anchor);
  nextReset.setMonth(nextReset.getMonth() + monthsElapsed + 1);
  const currentCycleStart = new Date(anchor);
  currentCycleStart.setMonth(currentCycleStart.getMonth() + monthsElapsed);

  // If we're past the current cycle start and used > 0, reset
  if (now >= currentCycleStart && user.monthlyRunsUsed > 0) {
    // Check if last reset was before current cycle start
    const lastResetMarker = user.billingCycleAnchor;
    if (new Date(lastResetMarker) < currentCycleStart) {
      await db.update(users)
        .set({
          monthlyRunsUsed: 0,
          billingCycleAnchor: currentCycleStart,
        })
        .where(eq(users.id, userId));
    }
  }
}

// ── Access gateway ────────────────────────────────────────────────────────────

/**
 * The single shared access checker used by every workflow before execution.
 * Returns { allowed: true } or { allowed: false, reason }.
 */
export async function assertWorkflowAccess(userId: number): Promise<AccessResult> {
  const db = await getDb();
  if (!db) return { allowed: true, planTier: "trial" }; // fail open if DB down

  // Auto-reset monthly allowance if needed
  await refreshMonthlyAllowanceIfNeeded(userId);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { allowed: false, reason: "TRIAL_ENDED", planTier: "trial" };

  const planTier = (user.planTier ?? "trial") as PlanTier;

  if (planTier === "enterprise") {
    return { allowed: true, planTier };
  }

  if (planTier === "trial") {
    const now = new Date();
    const expired = user.trialExpiresAt ? now > new Date(user.trialExpiresAt) : false;
    const noRunsLeft = (user.trialRunsRemaining ?? 0) <= 0;
    if (expired || noRunsLeft) {
      return { allowed: false, reason: "TRIAL_ENDED", planTier };
    }
    return { allowed: true, planTier };
  }

  if (planTier === "standard" || planTier === "pro") {
    // Check subscription is active
    const [sub] = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
      .limit(1);
    if (!sub) {
      return { allowed: false, reason: "SUBSCRIPTION_INACTIVE", planTier };
    }
    const limit = user.monthlyRunsLimit ?? PLAN_MONTHLY_LIMITS[planTier] ?? 200;
    const used = user.monthlyRunsUsed ?? 0;
    if (used >= limit) {
      return { allowed: false, reason: "PLAN_LIMIT_REACHED", planTier };
    }
    return { allowed: true, planTier };
  }

  return { allowed: true, planTier };
}

// ── Run decrement ─────────────────────────────────────────────────────────────

/**
 * Called ONLY after a successful completed run.
 * Atomic update — decrements usage counters.
 */
export async function recordRunCompletion(userId: number, agentSteps: number = 1): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const planTier = (user.planTier ?? "trial") as PlanTier;

  if (planTier === "trial") {
    await db.update(users)
      .set({
        trialRunsRemaining: sql`GREATEST(0, trialRunsRemaining - 1)`,
        totalCompletedRuns: sql`totalCompletedRuns + 1`,
        totalAgentsFired: sql`totalAgentsFired + ${agentSteps}`,
      })
      .where(eq(users.id, userId));
  } else if (planTier === "standard" || planTier === "pro") {
    await db.update(users)
      .set({
        monthlyRunsUsed: sql`monthlyRunsUsed + 1`,
        totalCompletedRuns: sql`totalCompletedRuns + 1`,
        totalAgentsFired: sql`totalAgentsFired + ${agentSteps}`,
      })
      .where(eq(users.id, userId));
  } else {
    // enterprise — just track totals
    await db.update(users)
      .set({
        totalCompletedRuns: sql`totalCompletedRuns + 1`,
        totalAgentsFired: sql`totalAgentsFired + ${agentSteps}`,
      })
      .where(eq(users.id, userId));
  }
}

// ── Usage status ──────────────────────────────────────────────────────────────

/**
 * Returns the full usage status for a user — used by PlanUsageBadge and /upgrade screen.
 */
export async function getUsageStatus(userId: number): Promise<UsageStatus> {
  const db = await getDb();
  const fallback: UsageStatus = {
    planTier: "trial",
    trialRunsRemaining: 50,
    daysUntilTrialExpiry: 60,
    monthlyRunsLimit: null,
    monthlyRunsUsed: 0,
    totalCompletedRuns: 0,
    totalAgentsFired: 0,
    isExpired: false,
    shouldRedirectToConversion: false,
  };
  if (!db) return fallback;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return fallback;

  const planTier = (user.planTier ?? "trial") as PlanTier;
  const now = new Date();

  let daysUntilTrialExpiry: number | null = null;
  let isExpired = false;

  if (planTier === "trial" && user.trialExpiresAt) {
    const msLeft = new Date(user.trialExpiresAt).getTime() - now.getTime();
    daysUntilTrialExpiry = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    isExpired = msLeft <= 0 || (user.trialRunsRemaining ?? 0) <= 0;
  }

  const shouldRedirectToConversion = isExpired ||
    (planTier === "standard" && (user.monthlyRunsUsed ?? 0) >= (user.monthlyRunsLimit ?? 200)) ||
    (planTier === "pro" && (user.monthlyRunsUsed ?? 0) >= (user.monthlyRunsLimit ?? 500));

  return {
    planTier,
    trialRunsRemaining: user.trialRunsRemaining ?? 0,
    daysUntilTrialExpiry,
    monthlyRunsLimit: user.monthlyRunsLimit,
    monthlyRunsUsed: user.monthlyRunsUsed ?? 0,
    totalCompletedRuns: user.totalCompletedRuns ?? 0,
    totalAgentsFired: user.totalAgentsFired ?? 0,
    isExpired,
    shouldRedirectToConversion,
  };
}

// ── Upgrade helpers ───────────────────────────────────────────────────────────

/**
 * Called when Stripe webhook confirms a successful subscription.
 * Upgrades user from trial to standard or pro.
 */
export async function applyUpgrade(
  userId: number,
  planTier: "standard" | "pro",
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  periodStart: Date,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const limit = PLAN_MONTHLY_LIMITS[planTier] ?? 200;
  const now = new Date();

  await db.update(users)
    .set({
      planTier,
      monthlyRunsLimit: limit,
      monthlyRunsUsed: 0,
      billingCycleAnchor: periodStart,
      convertedAt: now,
      stripeCustomerId,
      stripeSubscriptionId,
    })
    .where(eq(users.id, userId));

  // Insert subscription record
  await db.insert(subscriptions).values({
    userId,
    planTier,
    status: "active",
    monthlyRunsLimit: limit,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodStart: periodStart,
    currentPeriodEnd: new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000),
    startedAt: now,
  });
}

/**
 * Admin: assign enterprise plan to a user.
 */
export async function assignEnterprisePlan(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(users)
    .set({
      planTier: "enterprise",
      monthlyRunsLimit: null,
      monthlyRunsUsed: 0,
      convertedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// ── Email drip helpers ────────────────────────────────────────────────────────

export type Drip = "day_1" | "day_15" | "day_45" | "day_55" | "day_60";

/**
 * Returns true if the email has NOT been sent yet (safe to send).
 * Inserts a record atomically to prevent duplicates.
 */
export async function claimDripSend(userId: number, emailType: Drip): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.insert(emailEvents).values({
      userId,
      emailType,
      status: "sent",
      sentAt: new Date(),
    });
    return true; // successfully claimed
  } catch {
    // Duplicate key — already sent
    return false;
  }
}
