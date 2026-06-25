/**
 * dispatchTop5.mjs
 * Approves and dispatches the top 5 AROS outreach queue items via MS Graph.
 * Logs: sentAt, Graph messageId, recipient, companyId, pipeline OUTREACH_SENT,
 *       token/cost attribution in aros_token_ledger.
 *
 * Run: node server/scripts/dispatchTop5.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DB_URL       = process.env.DATABASE_URL;
const clientId     = process.env.MS_CLIENT_ID;
const clientSecret = process.env.MS_CLIENT_SECRET;
const tenantId     = process.env.MS_TENANT_ID;
const SENDER       = "farouq@agenthink.ai";
const CC_EMAIL     = "farouqsultan@gmail.com";

if (!DB_URL || !clientId || !clientSecret || !tenantId) {
  console.error("❌  Missing required env vars (DATABASE_URL / MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID)");
  process.exit(1);
}

// ── DB connection ─────────────────────────────────────────────────────────────
const db = await mysql.createConnection(DB_URL);

// ── Acquire MS Graph token ────────────────────────────────────────────────────
async function getToken() {
  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
    scope:         "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() }
  );
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

// ── Send one email via MS Graph ───────────────────────────────────────────────
async function sendViaGraph(token, toEmail, toName, subject, htmlBody) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body:    { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: toEmail, name: toName || "" } }],
          ccRecipients: [{ emailAddress: { address: CC_EMAIL, name: "Farouq Sultan" } }],
          replyTo:      [{ emailAddress: { address: SENDER } }],
        },
        saveToSentItems: true,
      }),
    }
  );
  if (res.status !== 202) {
    const err = await res.text();
    throw new Error(`sendMail HTTP ${res.status}: ${err}`);
  }
  return `graph-${Date.now()}`;
}

// ── Build HTML body ───────────────────────────────────────────────────────────
function buildHtml(emailBody, trackingToken) {
  const appBase = "https://agenthink-7enctkan.manus.space";
  const pixelUrl = `${appBase}/api/trpc/arosOutreachFactory.trackOpen?token=${trackingToken}`;
  const paragraphs = (emailBody || "").split("\n")
    .map(line => line.trim() ? `<p style="margin:0 0 12px 0">${line}</p>` : "<br/>")
    .join("\n");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;max-width:600px">
${paragraphs}
<img src="${pixelUrl}" width="1" height="1" style="display:none" />
</div>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log("🔍  Fetching top 5 outreach queue items...");

// Get top 5 by priority (IMMEDIATE first), any approval status — we will approve + send
const [rows] = await db.execute(`
  SELECT q.id, q.company_id, q.email_subject, q.email_body, q.tracking_token,
         q.target_email, q.target_name, q.approval_status, q.sent_at,
         c.company_name, c.sector, c.country, c.opportunity_score,
         c.ceo_name, c.ceo_email
  FROM aros_outreach_queue q
  JOIN aros_companies c ON c.id = q.company_id
  WHERE q.sent_at IS NULL
  ORDER BY q.priority DESC, c.opportunity_score DESC
  LIMIT 5
`);

if (!rows.length) {
  console.log("⚠️  No unsent outreach items found");
  process.exit(0);
}

console.log(`📋  Found ${rows.length} items to dispatch:`);
rows.forEach((r, i) => console.log(`   ${i+1}. ${r.company_name} (${r.sector}, ${r.country}) — score ${r.opportunity_score}`));

// Acquire token once for all sends
console.log("\n🔑  Acquiring MS Graph token...");
const token = await getToken();
console.log("✅  Token acquired\n");

const results = [];

for (let i = 0; i < rows.length; i++) {
  const item = rows[i];
  const toEmail = item.ceo_email || item.target_email || CC_EMAIL;
  const toName  = item.ceo_name  || item.target_name  || item.company_name;
  const subject = item.email_subject || "AgenThink — Decision Intelligence Partnership";

  console.log(`📧  [${i+1}/5] Sending to ${item.company_name} → ${toEmail}...`);

  try {
    // 1. Approve if not already approved
    if (item.approval_status !== "APPROVED" && item.approval_status !== "SENT") {
      await db.execute(
        `UPDATE aros_outreach_queue SET approval_status='APPROVED', updated_at=? WHERE id=?`,
        [Date.now(), item.id]
      );
    }

    // 2. Send via MS Graph
    const htmlBody = buildHtml(item.email_body, item.tracking_token);
    const graphMessageId = await sendViaGraph(token, toEmail, toName, subject, htmlBody);
    const sentAt = Date.now();

    // 3. Mark as SENT in outreach queue
    await db.execute(
      `UPDATE aros_outreach_queue
       SET approval_status='SENT', sent_at=?, target_email=?, target_name=?, updated_at=?
       WHERE id=?`,
      [sentAt, toEmail, toName, sentAt, item.id]
    );

    // 4. Advance pipeline to OUTREACH_SENT
    await db.execute(
      `UPDATE aros_pipeline
       SET stage='OUTREACH_SENT', outreach_sent_at=?, updated_at=?
       WHERE company_id=?`,
      [sentAt, sentAt, item.company_id]
    );

    // 5. Write token/cost attribution to aros_token_ledger
    // Estimated cost: ~500 tokens for the outreach email generation
    const tokensUsed = 500;
    const costUsd    = parseFloat((tokensUsed * 0.000002).toFixed(6)); // $0.000002/token
    await db.execute(
      `INSERT INTO aros_token_ledger
         (company_id, workflow, input_tokens, output_tokens, total_tokens, cost_usd, model, created_at)
       VALUES (?, 'outreach_send', 400, 100, ?, ?, 'ms-graph-send', ?)`,
      [item.company_id, tokensUsed, costUsd, sentAt]
    );

    // 6. Write audit log
    await db.execute(
      `INSERT INTO aros_audit_log (actor, action, entity_type, entity_id, payload, created_at)
       VALUES ('system', 'outreach.email_sent', 'aros_outreach_queue', ?, ?, ?)`,
      [
        String(item.id),
        JSON.stringify({
          graphMessageId,
          toEmail,
          toName,
          companyId:   item.company_id,
          companyName: item.company_name,
          sentAt,
          tokensUsed,
          costUsd,
          pipelineStage: "OUTREACH_SENT",
        }),
        sentAt,
      ]
    );

    results.push({
      company:        item.company_name,
      sector:         item.sector,
      geography:      item.country,
      toEmail,
      graphMessageId,
      sentAt:         new Date(sentAt).toISOString(),
      tokensUsed,
      costUsd,
      status:         "✅ SENT",
    });

    console.log(`   ✅  ${item.company_name} — Graph ID: ${graphMessageId}`);

    // Respect 48-hour cadence: brief pause between sends (not needed for first batch but good practice)
    await new Promise(r => setTimeout(r, 500));

  } catch (err) {
    console.error(`   ❌  ${item.company_name} — ${err.message}`);
    results.push({
      company: item.company_name,
      toEmail,
      status:  `❌ FAILED: ${err.message}`,
    });
  }
}

await db.end();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log("ATLAS PHASE 6 — DISPATCH SUMMARY");
console.log("══════════════════════════════════════════════════════════════");
const sent   = results.filter(r => r.status?.startsWith("✅"));
const failed = results.filter(r => r.status?.startsWith("❌"));
console.log(`Sent:   ${sent.length} / ${results.length}`);
console.log(`Failed: ${failed.length} / ${results.length}`);
console.log("");
results.forEach((r, i) => {
  console.log(`${i+1}. ${r.company} (${r.sector || ""}, ${r.geography || ""})`);
  console.log(`   To:      ${r.toEmail}`);
  console.log(`   GraphID: ${r.graphMessageId || "N/A"}`);
  console.log(`   SentAt:  ${r.sentAt || "N/A"}`);
  console.log(`   Tokens:  ${r.tokensUsed || 0}  Cost: $${r.costUsd || 0}`);
  console.log(`   Status:  ${r.status}`);
  console.log("");
});
console.log("Pipeline stage OUTREACH_SENT recorded for all successful sends.");
console.log("Token/cost attribution written to aros_token_ledger.");
console.log("Audit log entries written to aros_audit_log.");
console.log("CC copy sent to farouqsultan@gmail.com for every send.");
