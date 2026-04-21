/**
 * graphEmailWebhookRoute.ts
 *
 * Handles Microsoft Graph API subscription notifications for inbound email.
 *
 * Two request types arrive at this endpoint:
 *
 *   1. Validation handshake (GET or POST with ?validationToken=...)
 *      Graph sends this when a subscription is first created or renewed.
 *      We must echo back the validationToken as plain text with 200.
 *
 *   2. Change notification (POST with JSON body)
 *      Graph sends this when a new message arrives in the watched mailbox.
 *      We fetch the full message from Graph, map it to InboundEmail, and
 *      hand off to processInboundEmail() asynchronously.
 *
 * Route: POST /api/webhooks/graph-email
 *        GET  /api/webhooks/graph-email   (validation only)
 */

import { Router, type Request, type Response } from "express";
import { processInboundEmail, type InboundEmail } from "./emailSignal";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getGraphAccessToken(): Promise<string> {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("[GraphWebhook] MS credentials not configured");
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[GraphWebhook] Token fetch failed: ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface GraphMessage {
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  id?: string;
}

async function fetchGraphMessage(messageId: string): Promise<GraphMessage | null> {
  try {
    const token = await getGraphAccessToken();
    const sender = "farouq@agenthink.ai";
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${sender}/messages/${messageId}?$select=subject,body,bodyPreview,from,toRecipients`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return (await res.json()) as GraphMessage;
  } catch {
    return null;
  }
}

// ── Validation handshake (GET) ────────────────────────────────────────────────

router.get("/", (req: Request, res: Response) => {
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    console.log("[GraphWebhook] Validation handshake (GET)");
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(validationToken);
  }
  return res.status(200).json({ ok: true });
});

// ── Change notification (POST) ────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  // Validation handshake via POST (Graph sends this on subscription creation)
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    console.log("[GraphWebhook] Validation handshake (POST)");
    res.setHeader("Content-Type", "text/plain");
    return res.status(200).send(validationToken);
  }

  // Acknowledge immediately — Graph requires a 202 within a few seconds
  res.status(202).json({ received: true });

  // Process notifications asynchronously
  try {
    const body = req.body as {
      value?: Array<{
        changeType?: string;
        resourceData?: { id?: string; "@odata.id"?: string };
        resource?: string;
        clientState?: string;
      }>;
    };

    if (!Array.isArray(body?.value)) return;

    for (const notification of body.value) {
      if (notification.changeType !== "created") continue;

      // Extract message ID from resourceData or resource string
      const messageId =
        notification.resourceData?.id ??
        notification.resource?.match(/messages\/([^/]+)$/)?.[1];

      if (!messageId) {
        console.warn("[GraphWebhook] Could not extract messageId from notification");
        continue;
      }

      const message = await fetchGraphMessage(messageId);
      if (!message) {
        console.warn("[GraphWebhook] Could not fetch message:", messageId);
        continue;
      }

      const fromAddress = message.from?.emailAddress?.address ?? "";
      const toAddress = message.toRecipients?.[0]?.emailAddress?.address ?? "";
      const subject = message.subject ?? "(no subject)";
      const html = message.body?.content ?? "";
      const text = message.bodyPreview ?? "";

      if (!fromAddress || !subject) {
        console.warn("[GraphWebhook] Skipping message with missing from/subject");
        continue;
      }

      const email: InboundEmail = { from: fromAddress, to: toAddress, subject, text, html };
      void processInboundEmail(email);
    }
  } catch (err) {
    console.error("[GraphWebhook] Error processing notification:", err);
  }
});

export default router;
