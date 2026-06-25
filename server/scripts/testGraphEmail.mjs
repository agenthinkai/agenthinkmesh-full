/**
 * testGraphEmail.mjs
 * Sends one test email via Microsoft Graph sendMail to farouqsultan@gmail.com
 * Run: node server/scripts/testGraphEmail.mjs
 */

import "dotenv/config";
import { createRequire } from "module";

const clientId     = process.env.MS_CLIENT_ID;
const clientSecret = process.env.MS_CLIENT_SECRET;
const tenantId     = process.env.MS_TENANT_ID;
const SENDER       = "farouq@agenthink.ai";
const TEST_TO      = "farouqsultan@gmail.com";

if (!clientId || !clientSecret || !tenantId) {
  console.error("❌  MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID not set");
  process.exit(1);
}

// ── 1. Acquire token ──────────────────────────────────────────────────────────
console.log("🔑  Acquiring MS Graph token...");
const tokenParams = new URLSearchParams({
  grant_type:    "client_credentials",
  client_id:     clientId,
  client_secret: clientSecret,
  scope:         "https://graph.microsoft.com/.default",
});

const tokenRes = await fetch(
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    tokenParams.toString(),
  }
);

if (!tokenRes.ok) {
  const err = await tokenRes.text();
  console.error("❌  Token error:", err);
  process.exit(1);
}

const { access_token } = await tokenRes.json();
console.log("✅  Token acquired");

// ── 2. Send test email ────────────────────────────────────────────────────────
const now = new Date().toISOString();
const htmlBody = `
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <p><strong>ATLAS AROS — Microsoft Graph Delivery Test</strong></p>
  <p>This is an internal delivery verification email sent via Microsoft Graph API.</p>
  <p>Timestamp: ${now}</p>
  <p>Sender: ${SENDER}</p>
  <p>If you received this, the MS Graph sendMail integration is working correctly and live outreach can proceed.</p>
  <hr/>
  <p style="color:#999;font-size:12px;">AgenThink AROS — Atlas Phase 6 Reality Contact</p>
</div>`;

console.log(`📧  Sending test email to ${TEST_TO} from ${SENDER}...`);

const sendRes = await fetch(
  `https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`,
  {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: "ATLAS AROS — MS Graph Delivery Test",
        body:    { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: TEST_TO, name: "Farouq Sultan" } }],
        replyTo:      [{ emailAddress: { address: SENDER } }],
      },
      saveToSentItems: true,
    }),
  }
);

if (sendRes.status === 202) {
  console.log("✅  Email sent successfully (HTTP 202 Accepted)");
  console.log("📬  Check farouqsultan@gmail.com inbox (and Sent Items in farouq@agenthink.ai)");
  console.log("🟢  MS Graph integration VERIFIED — safe to dispatch top-5 outreach");
  process.exit(0);
} else {
  const errBody = await sendRes.text();
  console.error(`❌  sendMail failed (HTTP ${sendRes.status}):`, errBody);
  process.exit(1);
}
