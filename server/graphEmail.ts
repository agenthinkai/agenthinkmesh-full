/**
 * graphEmail.ts — Microsoft Graph API email helper
 *
 * Sends outbound email via the Microsoft Graph API using the
 * application-level client-credentials OAuth flow (no user sign-in required).
 *
 * Required environment variables (all pre-configured in the platform):
 *   MS_CLIENT_ID     — Azure AD application (client) ID
 *   MS_CLIENT_SECRET — Azure AD client secret
 *   MS_TENANT_ID     — Azure AD tenant ID
 *
 * The sender address is always farouq@agenthink.ai (the mailbox that the
 * Azure app has Mail.Send permission on).
 *
 * Usage:
 *   import { sendGraphEmail } from "./graphEmail";
 *   await sendGraphEmail({
 *     to: "recipient@example.com",
 *     subject: "Hello",
 *     html: "<p>Hello world</p>",
 *   });
 */

const SENDER = "farouq@agenthink.ai";

interface GraphEmailPayload {
  to: string;
  subject: string;
  html: string;
  /** Optional CC address */
  cc?: string;
}

// ── Token cache ───────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("[GraphEmail] MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID not configured");
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[GraphEmail] Token fetch failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

// ── sendGraphEmail ────────────────────────────────────────────────────────────

/**
 * Send an HTML email via Microsoft Graph API.
 * Returns true on success, false on failure (non-fatal — caller decides).
 */
export async function sendGraphEmail(payload: GraphEmailPayload): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const toRecipients = [{ emailAddress: { address: payload.to } }];
    const ccRecipients = payload.cc
      ? [{ emailAddress: { address: payload.cc } }]
      : undefined;

    const body: Record<string, unknown> = {
      message: {
        subject: payload.subject,
        body: { contentType: "HTML", content: payload.html },
        toRecipients,
        ...(ccRecipients ? { ccRecipients } : {}),
      },
      saveToSentItems: false,
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[GraphEmail] Send failed to ${payload.to} (${response.status}):`, err);
      return false;
    }

    console.log(`[GraphEmail] Sent to ${payload.to} — "${payload.subject}"`);
    return true;
  } catch (err) {
    console.error(`[GraphEmail] Error sending to ${payload.to}:`, err);
    return false;
  }
}
