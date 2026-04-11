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

// ── META CONTACTS — 30 people ─────────────────────────────────────────────────
// Email format confirmed: firstnamelastname@meta.com (38.5% — RocketReach)
// e.g. Mark Zuckerberg → markzuckerberg@meta.com
const metaContacts = [
  // C-Suite
  { name: "Mark Zuckerberg",      email: "markzuckerberg@meta.com",       title: "Founder, Chairman & CEO" },
  { name: "Dina Powell McCormick", email: "dinapowellmccormick@meta.com",  title: "President & Vice Chairman" },
  { name: "Susan Li",             email: "susanli@meta.com",               title: "Chief Financial Officer" },
  { name: "Javier Olivan",        email: "javierolivan@meta.com",          title: "Chief Operating Officer" },
  { name: "Chris Cox",            email: "chriscox@meta.com",              title: "Chief Product Officer" },
  { name: "Andrew Bosworth",      email: "andrewbosworth@meta.com",        title: "Chief Technology Officer" },
  { name: "Joel Kaplan",          email: "joelkaplan@meta.com",            title: "Chief Global Affairs Officer" },
  { name: "CJ Mahoney",           email: "cjmahoney@meta.com",             title: "Chief Legal Officer" },
  { name: "Janelle Gale",         email: "janellegale@meta.com",           title: "Chief People Officer" },
  { name: "Dave Wehner",          email: "davewehner@meta.com",            title: "Chief Strategy Officer" },
  // AI & Product Leadership
  { name: "Alexandr Wang",        email: "alexandrwang@meta.com",          title: "Chief AI Officer" },
  { name: "Alex Schultz",         email: "alexschultz@meta.com",           title: "Chief Marketing Officer & VP Analytics" },
  { name: "John Hegeman",         email: "johnhegeman@meta.com",           title: "Chief Revenue Officer" },
  { name: "Naomi Gleit",          email: "naomigleit@meta.com",            title: "Head of Product" },
  { name: "Santosh Janardhan",    email: "santoshjanardhan@meta.com",      title: "Head of Infrastructure" },
  // Business & Partnerships
  { name: "Nicola Mendelsohn",    email: "nicolamendelsohn@meta.com",      title: "Head of Global Business Group" },
  { name: "Justin Osofsky",       email: "justinosofsky@meta.com",         title: "Head of Partnerships & Business Development" },
  { name: "Clara Shih",           email: "clarashih@meta.com",             title: "SVP, Head of Business AI" },
  // Platform Heads
  { name: "Adam Mosseri",         email: "adammosseri@meta.com",           title: "Head of Instagram" },
  { name: "Tom Alison",           email: "tomalison@meta.com",             title: "Head of Facebook" },
  { name: "Will Cathcart",        email: "willcathcart@meta.com",          title: "Head of WhatsApp" },
  // Research & AI
  { name: "Yann LeCun",           email: "yannlecun@meta.com",             title: "Chief AI Scientist" },
  { name: "Joelle Pineau",        email: "joellepineau@meta.com",          title: "VP, AI Research" },
  { name: "Ahmad Al-Dahle",       email: "ahmadal-dahle@meta.com",         title: "VP, Generative AI" },
  // Policy & Privacy
  { name: "Erin Egan",            email: "erinegan@meta.com",              title: "Chief Privacy Officer, Policy" },
  { name: "Maxine Williams",      email: "maxinewilliams@meta.com",        title: "VP, Accessibility & Engagement" },
  // Reality Labs & Enterprise
  { name: "Colan Sewell",         email: "colansewell@meta.com",           title: "VP, CRO Reality Labs" },
  { name: "Dennis Kwon",          email: "denniskwon@meta.com",            title: "CTO, Business Engineering Partnerships" },
  { name: "Kelly Michelena",      email: "kellymichelena@meta.com",        title: "Director, Business Development, AI Partnerships" },
  { name: "Mike Schroepfer",      email: "mikeschroepfer@meta.com",        title: "Senior Fellow" },
];

// ── Email template ────────────────────────────────────────────────────────────
const SUBJECT = "35-page IC memo in 4 minutes — AI multi-agent decision intelligence";

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

<p>The system demonstrates a production-grade implementation of agentic AI for high-stakes decision workflows: each agent operates as a specialist with independent scoring frameworks and veto logic, covering financial modelling, competitive positioning, risk identification, and strategic assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and auditable.</p>

<p>A few things that may be relevant to Meta:</p>
<ul>
  <li><strong>Multi-agent architecture in production</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; a live case study in applied agentic AI for enterprise decision workflows</li>
  <li><strong>Speed at institutional quality</strong> — a 35-page structured memo with projections, risk matrix, competitive landscape, and management assessment, generated in 4 minutes</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns from historical decision data</li>
  <li><strong>Auditable by design</strong> — no black-box outputs; every agent decision is logged and explainable — a model for responsible AI deployment in regulated and enterprise contexts</li>
  <li><strong>Enterprise application</strong> — the same multi-agent council architecture could be applied to Meta's enterprise AI products, business intelligence workflows, and internal decision systems</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Meta's AI platform, enterprise business, or research agenda.</p>

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
  console.log("📧 Sending Meta review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Meta] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all Meta contacts ───────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO META — ${metaContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < metaContacts.length; i++) {
    const { name, email, title } = metaContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${metaContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${metaContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`META: ${sent} sent, ${failed} failed out of ${metaContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
