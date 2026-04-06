/**
 * resend-emails.mjs
 * Resends all outbound emails from last Thursday onwards (excluding bejul@lsvp.com)
 * via Microsoft Graph API. Stores resendMsMessageId, resentAt, and deliveryStatus
 * back into the outbound_emails table.
 *
 * Usage: node scripts/resend-emails.mjs
 */

import mysql from "mysql2/promise";

// ── Config ────────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
const MS_TENANT_ID = process.env.MS_TENANT_ID;
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const SENDER_EMAIL = "farouq@agenthink.ai";
const CC_EMAIL = "farouqsultan@gmail.com";
const EXCLUDE_EMAIL = "bejul@lsvp.com";

// Last Thursday = most recent Thursday before today (Apr 6 2026 = Sunday)
// Apr 6 is Sunday (day 0). Last Thursday = Apr 3 2026
function getLastThursday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  // Days since last Thursday
  const daysSince = (day + 3) % 7; // Sun=3, Mon=4, Tue=5, Wed=6, Thu=0, Fri=1, Sat=2
  const lastThursday = new Date(now);
  lastThursday.setDate(now.getDate() - daysSince);
  lastThursday.setHours(0, 0, 0, 0);
  return lastThursday;
}

// ── Step 1: Apply schema columns if not already present ───────────────────────
async function applySchemaChanges(conn) {
  console.log("[Schema] Checking for new columns...");
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'outbound_emails' 
     AND COLUMN_NAME IN ('resentAt','resendMsMessageId','deliveryStatus')`
  );
  const existing = cols.map((c) => c.COLUMN_NAME);

  if (!existing.includes("resentAt")) {
    await conn.query(`ALTER TABLE outbound_emails ADD COLUMN resentAt TIMESTAMP NULL`);
    console.log("[Schema] Added column: resentAt");
  }
  if (!existing.includes("resendMsMessageId")) {
    await conn.query(`ALTER TABLE outbound_emails ADD COLUMN resendMsMessageId VARCHAR(512) NULL`);
    console.log("[Schema] Added column: resendMsMessageId");
  }
  if (!existing.includes("deliveryStatus")) {
    await conn.query(
      `ALTER TABLE outbound_emails ADD COLUMN deliveryStatus ENUM('pending','sent','delivered','rejected','failed') NULL`
    );
    console.log("[Schema] Added column: deliveryStatus");
  }
  console.log("[Schema] Schema up to date.");
}

// ── Step 2: Get MS Graph access token ────────────────────────────────────────
async function getMsAccessToken() {
  const url = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MS Graph token error: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ── Step 3: Send one email via MS Graph ──────────────────────────────────────
async function sendViaGraph(token, email) {
  const url = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`;

  const payload = {
    message: {
      subject: email.subject,
      body: {
        contentType: "HTML",
        content: email.bodyHtml || email.body || email.subject,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email.recipientEmail,
            name: email.recipientName || "",
          },
        },
      ],
      ccRecipients: [
        {
          emailAddress: {
            address: CC_EMAIL,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 202) {
    // MS Graph sendMail returns 202 Accepted — no body, no message ID from this endpoint
    // We'll use the sent items endpoint to get the message ID
    return { success: true, messageId: null };
  }

  const body = await res.text();
  return { success: false, error: body };
}

// ── Step 4: Fetch the latest sent message ID from sent items ─────────────────
async function getLatestSentMessageId(token, recipientEmail) {
  const url = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/mailFolders/SentItems/messages?$filter=toRecipients/any(r:r/emailAddress/address eq '${recipientEmail}')&$orderby=sentDateTime desc&$top=1&$select=id,internetMessageId,sentDateTime`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.value && data.value.length > 0) {
    return data.value[0].internetMessageId || data.value[0].id;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!DB_URL || !MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    console.error("[Error] Missing required environment variables.");
    process.exit(1);
  }

  const conn = await mysql.createConnection(DB_URL);
  await applySchemaChanges(conn);

  const lastThursday = getLastThursday();
  console.log(`\n[Query] Fetching emails sent since: ${lastThursday.toISOString()}`);

  const [emails] = await conn.query(
    `SELECT id, recipientName, recipientEmail, subject, market, sentAt
     FROM outbound_emails
     WHERE sentAt >= ?
       AND recipientEmail != ?
     ORDER BY sentAt ASC`,
    [lastThursday, EXCLUDE_EMAIL]
  );

  console.log(`[Query] Found ${emails.length} emails to resend.\n`);

  if (emails.length === 0) {
    console.log("[Done] No emails found in the date range.");
    await conn.end();
    return;
  }

  // Get MS Graph token
  console.log("[Auth] Obtaining Microsoft Graph access token...");
  let token;
  try {
    token = await getMsAccessToken();
    console.log("[Auth] Token obtained successfully.\n");
  } catch (err) {
    console.error("[Auth] Failed to get MS Graph token:", err.message);
    await conn.end();
    process.exit(1);
  }

  // Counters
  let totalSent = 0;
  let totalDelivered = 0;
  let totalFailed = 0;
  const failedEmails = [];

  // Process each email
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const progress = `[${i + 1}/${emails.length}]`;

    try {
      // Mark as pending first
      await conn.query(
        `UPDATE outbound_emails SET deliveryStatus = 'pending', resentAt = NOW() WHERE id = ?`,
        [email.id]
      );

      // Send via MS Graph
      const result = await sendViaGraph(token, email);

      if (result.success) {
        totalSent++;

        // Try to fetch the message ID from sent items (small delay to let Graph process)
        await new Promise((r) => setTimeout(r, 800));
        const msgId = await getLatestSentMessageId(token, email.recipientEmail);

        await conn.query(
          `UPDATE outbound_emails 
           SET deliveryStatus = 'sent', resendMsMessageId = ?, resentAt = NOW()
           WHERE id = ?`,
          [msgId || "sent-no-id", email.id]
        );

        totalDelivered++;
        console.log(
          `${progress} ✓ Sent → ${email.recipientEmail} | ${email.subject.substring(0, 50)}... | MsgID: ${msgId ? msgId.substring(0, 30) : "N/A"}`
        );
      } else {
        totalFailed++;
        failedEmails.push({ email: email.recipientEmail, error: result.error });

        await conn.query(
          `UPDATE outbound_emails SET deliveryStatus = 'failed', resentAt = NOW() WHERE id = ?`,
          [email.id]
        );

        console.error(`${progress} ✗ Failed → ${email.recipientEmail} | Error: ${result.error?.substring(0, 80)}`);
      }
    } catch (err) {
      totalFailed++;
      failedEmails.push({ email: email.recipientEmail, error: err.message });

      await conn.query(
        `UPDATE outbound_emails SET deliveryStatus = 'failed', resentAt = NOW() WHERE id = ?`,
        [email.id]
      );

      console.error(`${progress} ✗ Exception → ${email.recipientEmail} | ${err.message}`);
    }

    // Rate limit: 4 emails/sec to stay within Graph limits
    if (i < emails.length - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // ── Final Summary ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  RESEND CAMPAIGN — FINAL SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Date range:     ${lastThursday.toDateString()} → Now`);
  console.log(`  Excluded:       ${EXCLUDE_EMAIL}`);
  console.log(`  Total queried:  ${emails.length}`);
  console.log(`  Total sent:     ${totalSent}`);
  console.log(`  Delivered:      ${totalDelivered}`);
  console.log(`  Failed:         ${totalFailed}`);
  console.log("=".repeat(60));

  if (failedEmails.length > 0) {
    console.log("\n  FAILED EMAILS:");
    failedEmails.forEach((f) => console.log(`  - ${f.email}: ${f.error?.substring(0, 100)}`));
  }

  // Also write summary to a file for download
  const summary = {
    runAt: new Date().toISOString(),
    dateRange: { from: lastThursday.toISOString(), to: new Date().toISOString() },
    excluded: [EXCLUDE_EMAIL],
    totalQueried: emails.length,
    totalSent,
    totalDelivered,
    totalFailed,
    failedEmails,
  };

  const fs = await import("fs");
  fs.writeFileSync("/home/ubuntu/resend_summary.json", JSON.stringify(summary, null, 2));
  console.log("\n  Summary saved to: /home/ubuntu/resend_summary.json");

  await conn.end();
}

main().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
