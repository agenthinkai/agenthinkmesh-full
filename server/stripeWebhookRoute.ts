/**
 * stripeWebhookRoute.ts — Stripe webhook handler (stub + live)
 *
 * When STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set, this handler
 * processes real Stripe events. Without them, it returns 200 (stub mode).
 *
 * Register this BEFORE express.json() middleware so we can read the raw body.
 */

import type { Express, Request, Response } from "express";
import { getDb } from "./db";
import { users, subscriptions, payments } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { applyUpgrade } from "./billing";

export function registerStripeWebhookRoute(app: Express) {
  // Must use raw body for Stripe signature verification
  app.post(
    "/api/stripe/webhook",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req: any, res: Response, next: any) => {
      // Collect raw body
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk: string) => { data += chunk; });
      req.on("end", () => {
        req.rawBody = data;
        next();
      });
    },
    async (req: Request & { rawBody?: string }, res: Response) => {
      const secret = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!secret || !webhookSecret) {
        // Stub mode — acknowledge without processing
        console.log("[Stripe] Webhook received in stub mode (no keys configured)");
        res.json({ received: true, mode: "stub" });
        return;
      }

      let stripe: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Stripe = require("stripe");
        stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
      } catch {
        res.status(500).json({ error: "Stripe not available" });
        return;
      }

      const sig = req.headers["stripe-signature"] as string;
      let event: any;

      try {
        event = stripe.webhooks.constructEvent(req.rawBody ?? "", sig, webhookSecret);
      } catch (err: any) {
        console.error("[Stripe] Webhook signature verification failed:", err.message);
        res.status(400).json({ error: `Webhook Error: ${err.message}` });
        return;
      }

      try {
        await handleStripeEvent(event);
        res.json({ received: true });
      } catch (err) {
        console.error("[Stripe] Webhook handler error:", err);
        res.status(500).json({ error: "Webhook handler failed" });
      }
    }
  );
}

async function handleStripeEvent(event: any) {
  const db = await getDb();
  if (!db) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = parseInt(session.metadata?.userId ?? "0", 10);
      const plan = session.metadata?.plan as "standard" | "pro" | undefined;
      if (!userId || !plan) break;

      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      await applyUpgrade(userId, plan, customerId, subscriptionId, new Date());
      console.log(`[Stripe] User ${userId} upgraded to ${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const dbSub = await db.select().from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
        .limit(1);

      if (dbSub.length > 0) {
        await db.update(subscriptions)
          .set({
            status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "cancelled",
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await db.update(subscriptions)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));

      // Downgrade user to trial
      const dbSub = await db.select().from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, sub.id))
        .limit(1);
      if (dbSub.length > 0) {
        await db.update(users)
          .set({ planTier: "trial", monthlyRunsLimit: null })
          .where(eq(users.id, dbSub[0].userId));
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object;
      // Record payment if we have a customer
      if (pi.customer) {
        const [user] = await db.select().from(users)
          .where(eq(users.stripeCustomerId, pi.customer as string))
          .limit(1);
        if (user) {
          await db.insert(payments).values({
            userId: user.id,
            amountUsd: String(pi.amount_received / 100),
            currency: (pi.currency ?? "usd").toUpperCase(),
            status: "succeeded",
            provider: "stripe",
            providerPaymentId: pi.id,
          });
        }
      }
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }
}
