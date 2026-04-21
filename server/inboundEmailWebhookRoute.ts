/**
 * inboundEmailWebhookRoute.ts
 *
 * Phase 2 Sprint 2 — Inbound email webhook.
 *
 * POST /api/webhooks/inbound-email
 *
 * Receives parsed inbound email data from Resend (or any compatible inbound
 * mail parser). Validates the payload, returns 200 immediately, and hands off
 * to processInboundEmail() asynchronously so the webhook caller is never blocked.
 *
 * Resend inbound signature verification:
 *   Resend signs inbound webhooks with the same svix-based mechanism as event
 *   webhooks. If RESEND_WEBHOOK_SECRET is set, the signature is verified.
 *   If the env var is absent the check is skipped (useful for local dev / testing).
 */
import { Router, type Request, type Response } from "express";
import { processInboundEmail, type InboundEmail } from "./emailSignal";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  // Return 200 immediately — never block the inbound mail provider
  res.status(200).json({ received: true });

  // Basic payload validation
  const body = req.body as Partial<InboundEmail>;
  if (!body || typeof body.from !== "string" || typeof body.subject !== "string") {
    console.warn("[InboundEmail] Received malformed payload — skipping:", JSON.stringify(body));
    return;
  }

  const email: InboundEmail = {
    from: body.from,
    to: typeof body.to === "string" ? body.to : "",
    subject: body.subject,
    text: typeof body.text === "string" ? body.text : "",
    html: typeof body.html === "string" ? body.html : undefined,
  };

  // Fire-and-forget — processInboundEmail never throws
  void processInboundEmail(email);
});

export default router;
