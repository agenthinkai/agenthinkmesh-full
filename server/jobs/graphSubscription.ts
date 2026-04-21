/**
 * graphSubscription.ts — Microsoft Graph API subscription manager
 *
 * Creates (or renews) a Graph change-notification subscription on the
 * farouq@agenthink.ai inbox so that new inbound emails are pushed to
 * /api/webhooks/graph-email.
 *
 * Subscription lifecycle:
 *   - Max expiry is 4230 minutes (~70.5 hours / ~3 days) for mail resources.
 *   - We set expiry to 4200 minutes (~70 hours) and renew daily via a cron.
 *   - The subscription ID is kept in memory; on server restart it is
 *     re-created automatically.
 *
 * Usage (called from server/_core/index.ts after server starts):
 *   startGraphSubscriptionJob(appBaseUrl);
 */

const SENDER = "farouq@agenthink.ai";
// 4200 minutes ≈ 70 hours — safely under the 4230-minute Graph limit
const EXPIRY_MINUTES = 4200;

let currentSubscriptionId: string | null = null;

// ── Token helper (shared with graphEmail.ts but kept local to avoid circular deps) ──

async function getToken(): Promise<string> {
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const tenantId = process.env.MS_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("[GraphSub] MS credentials not configured");
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
    throw new Error(`[GraphSub] Token fetch failed: ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── Subscription helpers ──────────────────────────────────────────────────────

function expiryDateTime(): string {
  const d = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
  return d.toISOString();
}

async function createSubscription(notificationUrl: string): Promise<string> {
  const token = await getToken();

  const body = {
    changeType: "created",
    notificationUrl,
    resource: `users/${SENDER}/mailFolders('Inbox')/messages`,
    expirationDateTime: expiryDateTime(),
    clientState: process.env.JWT_SECRET?.slice(0, 32) ?? "agenthink-graph-secret",
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[GraphSub] Create subscription failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { id: string };
  console.log(`[GraphSub] Subscription created: ${data.id} (expires in ${EXPIRY_MINUTES} min)`);
  return data.id;
}

async function renewSubscription(subscriptionId: string): Promise<void> {
  const token = await getToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expirationDateTime: expiryDateTime() }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[GraphSub] Renew failed (${res.status}): ${err}`);
  }

  console.log(`[GraphSub] Subscription ${subscriptionId} renewed (next expiry in ${EXPIRY_MINUTES} min)`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create the Graph subscription on startup and schedule daily renewal.
 * @param appBaseUrl  e.g. "https://agenthink-7enctkan.manus.space"
 */
export function startGraphSubscriptionJob(appBaseUrl: string): void {
  const notificationUrl = `${appBaseUrl}/api/webhooks/graph-email`;

  // Initial creation — fire-and-forget
  createSubscription(notificationUrl)
    .then((id) => { currentSubscriptionId = id; })
    .catch((err) => console.error("[GraphSub] Initial subscription creation failed:", err?.message));

  // Renew every 23 hours (well before the ~70-hour expiry)
  const TWENTY_THREE_HOURS = 23 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      if (currentSubscriptionId) {
        await renewSubscription(currentSubscriptionId);
      } else {
        // Re-create if we lost the ID (e.g. server restart)
        currentSubscriptionId = await createSubscription(notificationUrl);
      }
    } catch (err: any) {
      console.error("[GraphSub] Renewal error:", err?.message);
      // Attempt re-creation on next cycle
      currentSubscriptionId = null;
    }
  }, TWENTY_THREE_HOURS);

  console.log("[GraphSub] Subscription job started — renews every 23 hours");
}
