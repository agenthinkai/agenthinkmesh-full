import "dotenv/config";

// ── Microsoft Graph API credentials ──────────────────────────────────────────
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const TENANT_ID = process.env.MS_TENANT_ID;
const SENDER_EMAIL = "farouq@agenthink.ai";

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get token: " + JSON.stringify(data));
  return data.access_token;
}

async function sendEmail(token, to, name, subject, htmlBody) {
  const url = `https://graph.microsoft.com/v1.0/users/${SENDER_EMAIL}/sendMail`;
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [{ emailAddress: { address: to, name } }],
      ccRecipients: [{ emailAddress: { address: "farouqsultan@gmail.com", name: "Farouq Sultan" } }],
    },
    saveToSentItems: true,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send failed for ${to}: ${err}`);
  }
}

// ── BCG USA CONTACTS — 30 people ──────────────────────────────────────────────
// Email format confirmed: first.last@bcg.com (93% — RocketReach, ContactOut)
const bcgContacts = [
  // Global Leadership (US-based)
  { name: "Christoph Schweizer",  email: "christoph.schweizer@bcg.com",    title: "CEO, BCG" },
  { name: "Rich Lesser",          email: "rich.lesser@bcg.com",             title: "Global Chair, BCG" },
  { name: "Dylan Bolden",         email: "dylan.bolden@bcg.com",            title: "MD & Senior Partner; Chair, Functional Practices — Dallas" },
  { name: "Sharon Marcil",        email: "sharon.marcil@bcg.com",           title: "MD & Senior Partner; NAMR Chair — Washington DC" },
  { name: "Alicia Pittman",       email: "alicia.pittman@bcg.com",          title: "MD & Senior Partner; Global People Chair — Washington DC" },
  { name: "Mark Abraham",         email: "mark.abraham@bcg.com",            title: "MD & Senior Partner; Global Leader, Marketing, Sales & Pricing — Seattle" },
  { name: "Jean-Manuel Izaret",   email: "jean-manuel.izaret@bcg.com",      title: "MD & Senior Partner — San Francisco" },
  { name: "Natasha Taylor",       email: "natasha.taylor@bcg.com",          title: "MD & Partner — Denver" },
  { name: "Paul Tranter",         email: "paul.tranter@bcg.com",            title: "MD & Senior Partner; CFO — Boston" },
  // AI & Technology Practice (US-based)
  { name: "Vladimir Lukic",       email: "vladimir.lukic@bcg.com",          title: "MD & Senior Partner; Global Leader, Tech & Digital Advantage — Boston" },
  { name: "Sylvain Duranton",     email: "sylvain.duranton@bcg.com",        title: "MD & Senior Partner; Global Leader, BCG X — Paris/New York" },
  { name: "Amanda Luther",        email: "amanda.luther@bcg.com",           title: "MD & Partner — Austin" },
  { name: "Steven Mills",         email: "steven.mills@bcg.com",            title: "MD & Partner; Chief AI Ethics Officer — Washington DC" },
  { name: "Matthew Kropp",        email: "matthew.kropp@bcg.com",           title: "MD & Senior Partner — San Francisco" },
  { name: "Sesh Iyer",            email: "sesh.iyer@bcg.com",               title: "MD & Senior Partner — Washington DC" },
  { name: "Dan Sack",             email: "dan.sack@bcg.com",                title: "MD & Partner — Stockholm/US" },
  { name: "Suchi Srinivasan",     email: "suchi.srinivasan@bcg.com",        title: "MD & Partner — Seattle" },
  { name: "Renee Laverdiere",     email: "renee.laverdiere@bcg.com",        title: "MD & Partner — Houston" },
  { name: "Tristan Hoag",         email: "tristan.hoag@bcg.com",            title: "MD & Senior Partner — Dallas" },
  { name: "Daniel Martines",      email: "daniel.martines@bcg.com",         title: "MD, BCG X — Boston" },
  { name: "Mary Martin",          email: "mary.martin@bcg.com",             title: "MD & Partner — Denver" },
  { name: "David Martin",         email: "david.martin@bcg.com",            title: "MD & Senior Partner — Dallas" },
  // BCG X & Digital (US-based)
  { name: "Jim Larson",           email: "jim.larson@bcg.com",              title: "MD & Senior Partner; Global Leader, BCG Transform — Chicago" },
  { name: "Pattabi Seshadri",     email: "pattabi.seshadri@bcg.com",        title: "MD & Senior Partner — Dallas" },
  { name: "Suresh Subudhi",       email: "suresh.subudhi@bcg.com",          title: "MD & Senior Partner — Dallas" },
  // Private Equity & Financial Services (US-based)
  { name: "Tawfik Hammoud",       email: "tawfik.hammoud@bcg.com",          title: "MD & Senior Partner; Chief Client Officer — Toronto/New York" },
  { name: "Kanchan Samtani",      email: "kanchan.samtani@bcg.com",         title: "MD & Senior Partner; Global Leader, PE Practice — New York" },
  // Additional US Senior Partners
  { name: "Justin Dean",          email: "justin.dean@bcg.com",             title: "MD & Senior Partner — Washington DC" },
  { name: "Aparna Bharadwaj",     email: "aparna.bharadwaj@bcg.com",        title: "MD & Senior Partner; Global Leader, Global Advantage — New York" },
  { name: "Torben Danger",        email: "torben.danger@bcg.com",           title: "MD & Senior Partner; Global Leader, Health Care — New York" },
];

// ── Email template ────────────────────────────────────────────────────────────
const SUBJECT = "35-page strategy memo in 4 minutes — AI decision intelligence for consulting";

function buildEmail(firstName) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 32px 24px; background: #ffffff; }
  p { margin: 0 0 16px 0; }
  ul { margin: 12px 0 20px 0; padding-left: 20px; }
  li { margin-bottom: 8px; }
  strong { color: #0a0a0a; }
  .signature { margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 13px; color: #555; }
</style>
</head>
<body>
<p>Dear ${firstName},</p>

<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native decision intelligence platform that produces a <strong>35-page institutional-grade analysis memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>

<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes decision workflows: each agent operates as a specialist with independent scoring frameworks and veto logic, covering financial modelling, competitive positioning, risk identification, and strategic assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and auditable.</p>

<p>A few things that may be relevant to BCG:</p>
<ul>
  <li><strong>AI-accelerated strategy work</strong> — the platform compresses the research and synthesis phase of complex strategy engagements from weeks to minutes, producing structured, evidence-backed memos that mirror the quality of senior consulting output</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously, each with independent reasoning and veto logic; a live case study in applied agentic AI for enterprise decision workflows that BCG X and the Tech & Digital practice would find directly relevant</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns continuously from historical decision data</li>
  <li><strong>Auditable by design</strong> — no black-box outputs; every agent decision is logged and explainable — a model for responsible AI deployment that aligns with BCG's AI ethics framework</li>
  <li><strong>Client application</strong> — the platform could serve as a force multiplier for BCG's client engagements in PE, corporate strategy, and digital transformation — accelerating due diligence, market entry analysis, and operational benchmarking</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with BCG's AI practice, BCG X, or client delivery model.</p>

<p>Would any time this week or next work for a brief call?</p>

<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>
  Founder & CEO, AgenThinkMesh<br>
  <a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>
  <a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a>
</div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained\n");

  // Send review copy first
  console.log("📧 Sending BCG review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — BCG] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all BCG contacts ────────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO BCG — ${bcgContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < bcgContacts.length; i++) {
    const { name, email, title } = bcgContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${bcgContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${bcgContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`BCG: ${sent} sent, ${failed} failed out of ${bcgContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
