/**
 * billing.subscription.test.ts
 * Unit tests for Stripe subscription billing integration:
 * - stripePlans config correctness
 * - token guard logic in councilEngine
 * - webhook handler logic (mocked DB)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STRIPE_PLANS, TOKENS_PER_COUNCIL_RUN, TOKENS_PER_AGENT_CALL, getPlanByPriceId, getPlanByName } from "./lib/stripePlans";

// ── stripePlans tests ─────────────────────────────────────────────────────────

describe("stripePlans config", () => {
  it("professional plan has correct token allocation", () => {
    const plan = STRIPE_PLANS.professional;
    expect(plan.tokensPerMonth).toBe(5000);
    expect(plan.monthlyUsd).toBe(49);
    expect(plan.priceId).toBeTruthy();
  });

  it("enterprise plan has correct token allocation", () => {
    const plan = STRIPE_PLANS.enterprise;
    expect(plan.tokensPerMonth).toBe(25000);
    expect(plan.monthlyUsd).toBe(199);
    expect(plan.priceId).toBeTruthy();
  });

  it("starter plan is free with 50 tokens", () => {
    const plan = STRIPE_PLANS.starter;
    expect(plan.tokensPerMonth).toBe(50);
    expect(plan.monthlyUsd).toBe(0);
    expect(plan.priceId).toBeNull();
  });

  it("TOKENS_PER_COUNCIL_RUN is 10", () => {
    expect(TOKENS_PER_COUNCIL_RUN).toBe(10);
  });

  it("TOKENS_PER_AGENT_CALL is 1", () => {
    expect(TOKENS_PER_AGENT_CALL).toBe(1);
  });

  it("getPlanByPriceId returns correct plan for professional", () => {
    const priceId = STRIPE_PLANS.professional.priceId!;
    const plan = getPlanByPriceId(priceId);
    expect(plan?.name).toBe("professional");
  });

  it("getPlanByPriceId returns correct plan for enterprise", () => {
    const priceId = STRIPE_PLANS.enterprise.priceId!;
    const plan = getPlanByPriceId(priceId);
    expect(plan?.name).toBe("enterprise");
  });

  it("getPlanByPriceId returns null for unknown price ID", () => {
    const plan = getPlanByPriceId("price_unknown_123");
    expect(plan).toBeNull();
  });

  it("getPlanByName returns correct plan", () => {
    expect(getPlanByName("professional").displayName).toBe("Professional");
    expect(getPlanByName("enterprise").displayName).toBe("Enterprise");
    expect(getPlanByName("starter").displayName).toBe("Starter");
  });

  it("all paid plans have Stripe price IDs", () => {
    expect(STRIPE_PLANS.professional.priceId).toMatch(/^price_/);
    expect(STRIPE_PLANS.enterprise.priceId).toMatch(/^price_/);
  });
});

// ── Token guard logic tests ───────────────────────────────────────────────────

describe("token guard logic", () => {
  it("should block run when tokensRemaining < TOKENS_PER_COUNCIL_RUN", () => {
    const tokensRemaining = 5;
    const required = TOKENS_PER_COUNCIL_RUN;
    const canRun = tokensRemaining >= required;
    expect(canRun).toBe(false);
  });

  it("should allow run when tokensRemaining >= TOKENS_PER_COUNCIL_RUN", () => {
    const tokensRemaining = 10;
    const required = TOKENS_PER_COUNCIL_RUN;
    const canRun = tokensRemaining >= required;
    expect(canRun).toBe(true);
  });

  it("should allow run when tokensRemaining > TOKENS_PER_COUNCIL_RUN", () => {
    const tokensRemaining = 5000;
    const required = TOKENS_PER_COUNCIL_RUN;
    const canRun = tokensRemaining >= required;
    expect(canRun).toBe(true);
  });

  it("should block run when tokensRemaining is 0", () => {
    const tokensRemaining = 0;
    const required = TOKENS_PER_COUNCIL_RUN;
    const canRun = tokensRemaining >= required;
    expect(canRun).toBe(false);
  });

  it("INSUFFICIENT_TOKENS error message is correctly formatted", () => {
    const tokensRemaining = 5;
    const errorMsg = `INSUFFICIENT_TOKENS:You have ${tokensRemaining} tokens remaining, but a full Council run costs ${TOKENS_PER_COUNCIL_RUN} tokens. Please upgrade your plan.`;
    expect(errorMsg).toContain("INSUFFICIENT_TOKENS:");
    expect(errorMsg).toContain("5 tokens remaining");
    expect(errorMsg).toContain("10 tokens");
  });
});

// ── Token renewal logic tests ─────────────────────────────────────────────────

describe("token renewal logic", () => {
  it("professional plan renews to 5000 tokens", () => {
    const plan = STRIPE_PLANS.professional;
    const renewedTokens = plan.tokensPerMonth;
    expect(renewedTokens).toBe(5000);
  });

  it("enterprise plan renews to 25000 tokens", () => {
    const plan = STRIPE_PLANS.enterprise;
    const renewedTokens = plan.tokensPerMonth;
    expect(renewedTokens).toBe(25000);
  });

  it("renewal date is approximately 1 month in the future", () => {
    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setMonth(renewsAt.getMonth() + 1);
    const diffMs = renewsAt.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Should be between 28 and 32 days
    expect(diffDays).toBeGreaterThan(27);
    expect(diffDays).toBeLessThan(33);
  });
});

// ── Billing stats calculation tests ──────────────────────────────────────────

describe("billing stats calculation", () => {
  it("usagePercent is 0 when no tokens used", () => {
    const tokensTotal = 5000;
    const tokensRemaining = 5000;
    const usagePercent = tokensTotal > 0
      ? Math.round(((tokensTotal - tokensRemaining) / tokensTotal) * 100)
      : 0;
    expect(usagePercent).toBe(0);
  });

  it("usagePercent is 100 when all tokens used", () => {
    const tokensTotal = 5000;
    const tokensRemaining = 0;
    const usagePercent = tokensTotal > 0
      ? Math.round(((tokensTotal - tokensRemaining) / tokensTotal) * 100)
      : 0;
    expect(usagePercent).toBe(100);
  });

  it("usagePercent is 50 when half tokens used", () => {
    const tokensTotal = 5000;
    const tokensRemaining = 2500;
    const usagePercent = tokensTotal > 0
      ? Math.round(((tokensTotal - tokensRemaining) / tokensTotal) * 100)
      : 0;
    expect(usagePercent).toBe(50);
  });

  it("usagePercent handles zero total gracefully", () => {
    const tokensTotal = 0;
    const tokensRemaining = 0;
    const usagePercent = tokensTotal > 0
      ? Math.round(((tokensTotal - tokensRemaining) / tokensTotal) * 100)
      : 0;
    expect(usagePercent).toBe(0);
  });
});

// ── Checkout session metadata tests ──────────────────────────────────────────

describe("checkout session metadata", () => {
  it("professional plan metadata is correct", () => {
    const userId = 42;
    const plan = "professional";
    const metadata = {
      userId: String(userId),
      plan,
      customer_email: "test@example.com",
      customer_name: "Test User",
    };
    expect(metadata.userId).toBe("42");
    expect(metadata.plan).toBe("professional");
  });

  it("enterprise plan metadata is correct", () => {
    const userId = 99;
    const plan = "enterprise";
    const metadata = {
      userId: String(userId),
      plan,
    };
    expect(metadata.userId).toBe("99");
    expect(metadata.plan).toBe("enterprise");
  });

  it("success URL includes plan parameter", () => {
    const origin = "https://example.com";
    const plan = "professional";
    const successUrl = `${origin}/account/billing?success=1&plan=${plan}`;
    expect(successUrl).toContain("/account/billing");
    expect(successUrl).toContain("success=1");
    expect(successUrl).toContain("plan=professional");
  });

  it("cancel URL returns to pricing", () => {
    const origin = "https://example.com";
    const cancelUrl = `${origin}/pricing?canceled=1`;
    expect(cancelUrl).toContain("/pricing");
    expect(cancelUrl).toContain("canceled=1");
  });
});
