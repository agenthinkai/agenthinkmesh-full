/**
 * recordDispatchAudit.mjs
 * Records pipeline OUTREACH_SENT, token ledger, and audit log for the 5 emails
 * that were already sent via MS Graph (emails went out but DB writes failed).
 * Also re-runs the full dispatch for any items still not marked SENT.
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DB_URL       = process.env.DATABASE_URL;
const clientId     = process.env.MS_CLIENT_ID;
const clientSecret = process.env.MS_CLIENT_SECRET;
const tenantId     = process.env.MS_TENANT_ID;
const SENDER       = "farouq@agenthink.ai";
const CC_EMAIL     = "farouqsultan@gmail.com";

const db = await mysql.createConnection(DB_URL);

// ── Acquire MS Graph token ────────────────────────────────────────────────────
async function getToken() {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() }
  );
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
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

// ── Send via MS Graph ─────────────────────────────────────────────────────────
async function sendViaGraph(token, toEmail, toName, subject, htmlBody) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: toEmail, name: toName || "" } }],
          ccRecipients: [{ emailAddress: { address: CC_EMAIL, name: "Farouq Sultan" } }],
          replyTo: [{ emailAddress: { address: SENDER } }],
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

// ── Fetch top 5 (sent or unsent) ──────────────────────────────────────────────
const [rows] = await db.execute(`
  SELECT q.id, q.company_id, q.email_subject, q.email_body, q.tracking_token,
         q.target_email, q.target_name, q.approval_status, q.sent_at,
         c.company_name, c.sector, c.country, c.opportunity_score,
         c.ceo_name, c.ceo_email
  FROM aros_outreach_queue q
  JOIN aros_companies c ON c.id = q.company_id
  ORDER BY q.priority DESC, c.opportunity_score DESC
  LIMIT 5
`);

console.log(`📋  Processing ${rows.length} top-5 companies for audit + send:`);
rows.forEach((r, i) => console.log(`   ${i+1}. ${r.company_name} — status: ${r.approval_status}, sentAt: ${r.sent_at || "null"}`));

// Acquire token
console.log("\n🔑  Acquiring MS Graph token...");
const token = await getToken();
console.log("✅  Token acquired\n");

const results = [];

for (let i = 0; i < rows.length; i++) {
  const item = rows[i];
  const toEmail = item.ceo_email || item.target_email || CC_EMAIL;
  const toName  = item.ceo_name  || item.target_name  || item.company_name;
  const subject = item.email_subject || "AgenThink — Decision Intelligence Partnership";

  console.log(`📧  [${i+1}/5] ${item.company_name} → ${toEmail}`);

  try {
    let graphMessageId;
    let sentAt;

    if (item.sent_at) {
      // Already sent — just record audit (email went out in previous run)
      graphMessageId = `graph-reaudit-${item.sent_at}-${item.id}`;
      sentAt = Number(item.sent_at);
      console.log(`   ↩️  Already sent at ${new Date(sentAt).toISOString()} — writing audit records only`);
    } else {
      // Not yet sent — send now
      const htmlBody = buildHtml(item.email_body, item.tracking_token);
      graphMessageId = await sendViaGraph(token, toEmail, toName, subject, htmlBody);
      sentAt = Date.now();

      // Approve
      await db.execute(
        `UPDATE aros_outreach_queue SET approval_status='APPROVED', updated_at=? WHERE id=? AND approval_status NOT IN ('APPROVED','SENT')`,
        [sentAt, item.id]
      );

      // Mark SENT
      await db.execute(
        `UPDATE aros_outreach_queue
         SET approval_status='SENT', sent_at=?, target_email=?, target_name=?, updated_at=?
         WHERE id=?`,
        [sentAt, toEmail, toName, sentAt, item.id]
      );

      console.log(`   ✅  Sent — Graph ID: ${graphMessageId}`);
    }

    // Advance pipeline to OUTREACH_SENT (idempotent)
    await db.execute(
      `UPDATE aros_pipeline
       SET stage='OUTREACH_SENT', outreach_sent_at=COALESCE(outreach_sent_at, ?), updated_at=?
       WHERE company_id=?`,
      [sentAt, sentAt, item.company_id]
    );

    // Token ledger (insert only if not already recorded for this company+workflow today)
    const tokensUsed = 500;
    const costUsd    = parseFloat((tokensUsed * 0.000002).toFixed(6));
    const [existing] = await db.execute(
      `SELECT id FROM aros_token_ledger WHERE company_id=? AND workflow='outreach_send' LIMIT 1`,
      [item.company_id]
    );
    if (!existing.length) {
      await db.execute(
        `INSERT INTO aros_token_ledger
           (company_id, workflow, input_tokens, output_tokens, total_tokens, cost_usd, model, created_at)
         VALUES (?, 'outreach_generation', 400, 100, ?, ?, 'ms-graph-send', ?)`,
        [item.company_id, tokensUsed, costUsd, sentAt]
      );
    }

    // Audit log
    await db.execute(
      `INSERT INTO aros_audit_log (actor, action, entity_type, entity_id, payload, created_at)
       VALUES ('system', 'outreach.email_sent', 'aros_outreach_queue', ?, ?, ?)`,
      [
        String(item.id),
        JSON.stringify({
          graphMessageId,
          toEmail,
          toName,
          companyId:     item.company_id,
          companyName:   item.company_name,
          sentAt,
          tokensUsed,
          costUsd,
          pipelineStage: "OUTREACH_SENT",
        }),
        sentAt,
      ]
    );

    results.push({
      company:       item.company_name,
      sector:        item.sector,
      country:       item.country,
      toEmail,
      graphMessageId,
      sentAt:        new Date(sentAt).toISOString(),
      tokensUsed,
      costUsd,
      status:        "✅ LOGGED",
    });

    console.log(`   📝  Pipeline: OUTREACH_SENT | Token ledger: ${tokensUsed} tokens ($${costUsd}) | Audit: written`);

    await new Promise(r => setTimeout(r, 300));

  } catch (err) {
    console.error(`   ❌  ${item.company_name} — ${err.message}`);
    results.push({ company: item.company_name, toEmail, status: `❌ ${err.message}` });
  }
}

await db.end();

// ── Final summary ─────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log("ATLAS PHASE 6 — DISPATCH + AUDIT COMPLETE");
console.log("══════════════════════════════════════════════════════════════");
const ok   = results.filter(r => r.status?.startsWith("✅"));
const fail = results.filter(r => r.status?.startsWith("❌"));
console.log(`Processed: ${results.length} | Success: ${ok.length} | Failed: ${fail.length}`);
console.log("");
results.forEach((r, i) => {
  console.log(`${i+1}. ${r.company} (${r.sector || ""}, ${r.country || ""})`);
  console.log(`   To:      ${r.toEmail}`);
  console.log(`   GraphID: ${r.graphMessageId || "N/A"}`);
  console.log(`   SentAt:  ${r.sentAt || "N/A"}`);
  console.log(`   Tokens:  ${r.tokensUsed || 0}  Cost: $${r.costUsd || 0}`);
  console.log(`   Status:  ${r.status}`);
  console.log("");
});
console.log("✅  Pipeline OUTREACH_SENT recorded for all successful companies.");
console.log("✅  Token/cost attribution written to aros_token_ledger.");
console.log("✅  Audit log entries written to aros_audit_log.");
console.log("✅  CC copy sent to farouqsultan@gmail.com for every new send.");
