/**
 * send_softbank.mjs
 * Sends the AgenThinkMesh outreach email to 30 SoftBank Vision Fund contacts
 * via Microsoft Graph API from farouq@agenthink.ai (CC: farouqsultan@gmail.com)
 *
 * Usage: node send_softbank.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();

const TENANT_ID     = process.env.MS_TENANT_ID;
const CLIENT_ID     = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const SENDER_EMAIL  = "farouq@agenthink.ai";
const CC_EMAIL      = "farouqsultan@gmail.com";

if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing MS Graph credentials. Check .env");
  process.exit(1);
}

const contacts = [
  { name: "Alex Clavel",          title: "CEO, SoftBank Investment Advisers",                      email: "alex.clavel@softbank.com" },
  { name: "Vikas Parekh",         title: "Managing Partner",                                        email: "vikas.parekh@softbank.com" },
  { name: "Brett Rochkind",       title: "Managing Partner, Americas",                              email: "brett.rochkind@softbank.com" },
  { name: "Greg Moon",            title: "Executive Managing Partner",                              email: "greg.moon@softbank.com" },
  { name: "Kentaro Matsui",       title: "Managing Partner, Asia",                                  email: "kentaro.matsui@softbank.com" },
  { name: "Mark Agne",            title: "Managing Partner, Head of Capital Strategies",            email: "mark.agne@softbank.com" },
  { name: "Amanda Sanchez-Barry", title: "Managing Partner, General Counsel",                       email: "amanda.sanchez-barry@softbank.com" },
  { name: "Jeff Dressler",        title: "Managing Partner, Head of Global Government Affairs",     email: "jeff.dressler@softbank.com" },
  { name: "Andrew Kofman",        title: "Managing Partner, Head of Asset Management Group",        email: "andrew.kofman@softbank.com" },
  { name: "Juan Franck",          title: "Managing Partner, Head of Global Portfolio Management",   email: "juan.franck@softbank.com" },
  { name: "Angela Du",            title: "Partner, Americas",                                       email: "angela.du@softbank.com" },
  { name: "Karol Niewiadomski",   title: "Partner, Americas",                                       email: "karol.niewiadomski@softbank.com" },
  { name: "Mike Guo",             title: "Partner, Americas",                                       email: "mike.guo@softbank.com" },
  { name: "Cecilia Chen",         title: "Partner, Asia",                                           email: "cecilia.chen@softbank.com" },
  { name: "Max Ohrstrand",        title: "Partner, EMEA",                                           email: "max.ohrstrand@softbank.com" },
  { name: "Jagannath Iyer",       title: "Partner, Capital Strategies",                             email: "jagannath.iyer@softbank.com" },
  { name: "John Clappier",        title: "Partner, Capital Strategies",                             email: "john.clappier@softbank.com" },
  { name: "Javier Villamizar",    title: "Operating Partner",                                       email: "javier.villamizar@softbank.com" },
  { name: "Aaron Wong",           title: "Director, Americas",                                      email: "aaron.wong@softbank.com" },
  { name: "Alex Fortmuller",      title: "Director, Americas",                                      email: "alex.fortmuller@softbank.com" },
  { name: "Amit Lubovsky",        title: "Director, Americas",                                      email: "amit.lubovsky@softbank.com" },
  { name: "Daniela Llobet",       title: "Director, Americas",                                      email: "daniela.llobet@softbank.com" },
  { name: "Jaime Ocampo",         title: "Director, Americas",                                      email: "jaime.ocampo@softbank.com" },
  { name: "Jessica Gao",          title: "Director, Americas",                                      email: "jessica.gao@softbank.com" },
  { name: "Kaz Yoshimaru",        title: "Director, Americas",                                      email: "kaz.yoshimaru@softbank.com" },
  { name: "Kiran Kazmi",          title: "Director, Americas",                                      email: "kiran.kazmi@softbank.com" },
  { name: "Grong Wang",           title: "Director, EMEA",                                          email: "grong.wang@softbank.com" },
  { name: "Jackie Fok",           title: "Director, EMEA",                                          email: "jackie.fok@softbank.com" },
  { name: "John Cassidy",         title: "Director, EMEA",                                          email: "john.cassidy@softbank.com" },
  { name: "Nahoko Hoshino",       title: "Director, EMEA",                                          email: "nahoko.hoshino@softbank.com" },
];

// ── Get MS Graph access token ─────────────────────────────────────────────────
async function getToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ── Build email HTML ──────────────────────────────────────────────────────────
function buildHtml(firstName) {
  return `<html><body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;max-width:620px">

<p>Dear ${firstName},</p>

<p>I wanted to share something we built that I think is directly relevant to how Vision Fund evaluates deals at scale.</p>

<p>AgenThinkMesh runs a council of 10 specialised AI agents — each independently modelling a different dimension of a deal: regulatory risk, unit economics, macro exposure, exit viability, founder quality, and more. In under 4 minutes, it produces a 35-page Investment Committee memo with structured votes, weighted confidence scores, and a final verdict.</p>

<p>It is not a summary tool. It is a parallel reasoning engine — the equivalent of convening 10 domain experts simultaneously on every deal that crosses your desk.</p>

<p>We built it specifically for high-volume, high-stakes investment environments where the bottleneck is not capital, it is analytical bandwidth.</p>

<p>A few things that may be relevant to Vision Fund:</p>

<ul>
  <li><strong>Three council modes</strong> — Global VC, Growth Equity, and Emerging Markets — each with agents calibrated to the specific risk and return dynamics of that investment context</li>
  <li><strong>The system is self-learning</strong> — agent authority weights adjust over time based on which agents' past votes matched real-world outcomes</li>
  <li><strong>Every output is auditable</strong> — full rationale, per-agent vote, and conditions-to-proceed are logged and downloadable as a 35-page IC memo</li>
</ul>

<p>I would welcome 20 minutes to walk you through a live run on a deal of your choosing.</p>

<p>Warm regards,</p>

<p><strong>Farouq Sultan</strong><br>
CEO, AgenThink<br>
farouq@agenthink.ai</p>

</body></html>`;
}

// ── Send one email via MS Graph ───────────────────────────────────────────────
async function sendEmail(token, contact) {
  const firstName = contact.name.split(" ")[0];
  const url = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`;

  const payload = {
    message: {
      subject: "35-page IC memo in 4 minutes — AI deal intelligence for Vision Fund",
      body: { contentType: "HTML", content: buildHtml(firstName) },
      toRecipients: [{ emailAddress: { address: contact.email, name: contact.name } }],
      ccRecipients: [{ emailAddress: { address: CC_EMAIL } }],
    },
    saveToSentItems: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 202) return { success: true };
  const body = await res.text();
  return { success: false, error: body };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getToken();
  console.log("✅ Token obtained\n");

  // Step 1: Send review copy to Farouq first
  console.log("📧 Sending review copy to farouqsultan@gmail.com...");
  const reviewPayload = {
    message: {
      subject: "REVIEW COPY — SoftBank Vision Fund Outreach (30 contacts sending now)",
      body: {
        contentType: "HTML",
        content: `<html><body style="font-family:Arial,sans-serif;padding:20px">
          <h2 style="color:#333">SoftBank Outreach — Sending Now</h2>
          <p>The following email is being sent to 30 SoftBank Vision Fund contacts right now.</p>
          <hr>
          ${buildHtml("[First Name]")}
          <hr>
          <p style="font-size:13px;color:#666">Recipients: ${contacts.map(c => `${c.name} &lt;${c.email}&gt;`).join(", ")}</p>
        </body></html>`,
      },
      toRecipients: [{ emailAddress: { address: "farouqsultan@gmail.com" } }],
    },
    saveToSentItems: true,
  };

  const reviewRes = await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(reviewPayload),
  });
  console.log(reviewRes.status === 202 ? "✅ Review copy sent to farouqsultan@gmail.com" : `⚠️  Review copy status: ${reviewRes.status}`);

  // Step 2: Send to all 30 contacts
  console.log(`\nSending to ${contacts.length} SoftBank Vision Fund contacts...\n`);

  let sent = 0;
  let failed = 0;
  const results = [];

  for (const contact of contacts) {
    const result = await sendEmail(token, contact);
    if (result.success) {
      sent++;
      console.log(`✅ [${sent + failed}/${contacts.length}] Sent → ${contact.name} <${contact.email}>`);
      results.push({ name: contact.name, email: contact.email, status: "sent" });
    } else {
      failed++;
      console.log(`❌ [${sent + failed}/${contacts.length}] Failed → ${contact.name} <${contact.email}> — ${result.error}`);
      results.push({ name: contact.name, email: contact.email, status: "failed", error: result.error });
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`COMPLETE: ${sent} sent, ${failed} failed out of ${contacts.length} total`);
  console.log(`${"─".repeat(60)}`);

  if (failed > 0) {
    console.log("\nFailed sends:");
    results.filter(r => r.status === "failed").forEach(r => {
      console.log(`  - ${r.name} <${r.email}>: ${r.error}`);
    });
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
