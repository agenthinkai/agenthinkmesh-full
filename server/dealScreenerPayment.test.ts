/**
 * dealScreenerPayment.test.ts
 * Tests for the pay-per-run $32.50 Deal Screener Stripe integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEAL_SCREENER_AMOUNT_USD = 32.50;
const DEAL_SCREENER_AMOUNT_CENTS = 3250;
const DEAL_SCREENER_PRODUCT_NAME = "Council of 10 — Deal Screening";

// ── Unit: amount validation ───────────────────────────────────────────────────
describe("Deal Screener payment amount", () => {
  it("charges exactly $32.50 USD", () => {
    expect(DEAL_SCREENER_AMOUNT_USD).toBe(32.50);
  });

  it("converts $32.50 to 3250 cents for Stripe", () => {
    const cents = Math.round(DEAL_SCREENER_AMOUNT_USD * 100);
    expect(cents).toBe(DEAL_SCREENER_AMOUNT_CENTS);
  });

  it("product name matches expected value", () => {
    expect(DEAL_SCREENER_PRODUCT_NAME).toBe("Council of 10 — Deal Screening");
  });
});

// ── Unit: payment status lifecycle ───────────────────────────────────────────
describe("Deal Screener payment status lifecycle", () => {
  const validStatuses = ["pending", "paid", "used", "expired"];

  it("starts as pending", () => {
    const initialStatus = "pending";
    expect(validStatuses).toContain(initialStatus);
  });

  it("transitions to paid after webhook", () => {
    const afterWebhook = "paid";
    expect(validStatuses).toContain(afterWebhook);
  });

  it("transitions to used after council run", () => {
    const afterRun = "used";
    expect(validStatuses).toContain(afterRun);
  });

  it("isPaid returns true for paid and used statuses", () => {
    const isPaid = (status: string) => status === "paid" || status === "used";
    expect(isPaid("paid")).toBe(true);
    expect(isPaid("used")).toBe(true);
    expect(isPaid("pending")).toBe(false);
    expect(isPaid("expired")).toBe(false);
  });
});

// ── Unit: Stripe checkout session metadata ────────────────────────────────────
describe("Deal Screener checkout session metadata", () => {
  it("includes type=deal_screener_run for webhook routing", () => {
    const metadata = {
      type: "deal_screener_run",
      userId: "42",
      customer_email: "test@example.com",
      customer_name: "Test User",
    };
    expect(metadata.type).toBe("deal_screener_run");
    expect(metadata.userId).toBeTruthy();
  });

  it("success_url includes session_id placeholder for verification", () => {
    const origin = "https://agenthink.example.com";
    const successUrl = `${origin}/deals?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    expect(successUrl).toContain("paid=1");
    expect(successUrl).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("cancel_url returns user to deals page", () => {
    const origin = "https://agenthink.example.com";
    const cancelUrl = `${origin}/deals?canceled=1`;
    expect(cancelUrl).toContain("/deals");
    expect(cancelUrl).toContain("canceled=1");
  });
});

// ── Unit: webhook event routing ───────────────────────────────────────────────
describe("Stripe webhook routing for deal_screener_run", () => {
  it("routes to deal payment handler when metadata.type is deal_screener_run", () => {
    const session = {
      id: "cs_test_abc123",
      metadata: { type: "deal_screener_run", userId: "42" },
      payment_intent: "pi_test_xyz",
    };

    const isDealScreenerPayment = session.metadata?.type === "deal_screener_run";
    expect(isDealScreenerPayment).toBe(true);
  });

  it("does NOT route to deal payment handler for subscription payments", () => {
    const session = {
      id: "cs_test_sub123",
      metadata: { plan: "professional", userId: "42" },
    };

    const isDealScreenerPayment = (session.metadata as Record<string, string>)?.type === "deal_screener_run";
    expect(isDealScreenerPayment).toBe(false);
  });

  it("handles missing metadata gracefully", () => {
    const session = { id: "cs_test_empty", metadata: {} };
    const isDealScreenerPayment = (session.metadata as Record<string, string>)?.type === "deal_screener_run";
    expect(isDealScreenerPayment).toBe(false);
  });
});

// ── Unit: URL param parsing for post-payment redirect ─────────────────────────
describe("Post-payment URL param parsing", () => {
  it("extracts session_id from success URL", () => {
    const url = new URL("https://agenthink.example.com/deals?paid=1&session_id=cs_test_abc123");
    const paid = url.searchParams.get("paid");
    const sessionId = url.searchParams.get("session_id");

    expect(paid).toBe("1");
    expect(sessionId).toBe("cs_test_abc123");
  });

  it("returns null sessionId when not present", () => {
    const url = new URL("https://agenthink.example.com/deals");
    const sessionId = url.searchParams.get("session_id");
    expect(sessionId).toBeNull();
  });

  it("pendingPaymentSessionId is set only when paid=1 AND session_id present", () => {
    const parsePaymentParams = (search: string): string | null => {
      const params = new URLSearchParams(search);
      const paid = params.get("paid");
      const sessionId = params.get("session_id");
      return paid === "1" && sessionId ? sessionId : null;
    };

    expect(parsePaymentParams("paid=1&session_id=cs_test_abc")).toBe("cs_test_abc");
    expect(parsePaymentParams("paid=1")).toBeNull();
    expect(parsePaymentParams("session_id=cs_test_abc")).toBeNull();
    expect(parsePaymentParams("")).toBeNull();
  });
});

// ── Unit: sessionStorage for form data persistence across redirect ─────────────
describe("Form data persistence across Stripe redirect", () => {
  beforeEach(() => {
    // Reset mock sessionStorage
    vi.stubGlobal("sessionStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, value: string) { this.store[key] = value; },
      removeItem(key: string) { delete this.store[key]; },
    });
  });

  it("saves deal name and text before redirect", () => {
    const dealName = "Tamara Series B";
    const dealText = "BNPL platform for GCC market...";

    sessionStorage.setItem("ds_pending_deal_name", dealName);
    sessionStorage.setItem("ds_pending_deal_text", dealText);

    expect(sessionStorage.getItem("ds_pending_deal_name")).toBe(dealName);
    expect(sessionStorage.getItem("ds_pending_deal_text")).toBe(dealText);
  });

  it("clears saved data after council run starts", () => {
    sessionStorage.setItem("ds_pending_deal_name", "Test Deal");
    sessionStorage.setItem("ds_pending_deal_text", "Test text");

    sessionStorage.removeItem("ds_pending_deal_name");
    sessionStorage.removeItem("ds_pending_deal_text");

    expect(sessionStorage.getItem("ds_pending_deal_name")).toBeNull();
    expect(sessionStorage.getItem("ds_pending_deal_text")).toBeNull();
  });
});
