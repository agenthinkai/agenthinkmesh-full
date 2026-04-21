/**
 * inboundEmailWebhookRoute.ts
 *
 * Phase 2 Sprint 2 — Inbound email webhook.
 *
 * POST /api/webhooks/inbound-email
 *
 * Legacy inbound email webhook — kept for backward compatibility.
 * New inbound email notifications are handled by graphEmailWebhookRoute.ts
 * via Microsoft Graph API subscriptions.
 *
 * This route accepts a generic JSON payload matching the InboundEmail interface
 * and hands off to processInboundEmail() asynchronously.
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
