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

// ── EY USA CONTACTS — 40 people ───────────────────────────────────────────────
// Email format confirmed: first.last@ey.com (97.1% — RocketReach)
const eyContacts = [
  // Americas Operating Executive (US-based)
  { name: "Julie Boland",          email: "julie.boland@ey.com",           title: "EY Americas and US Managing Partner" },
  { name: "Dante D'Egidio",        email: "dante.degidio@ey.com",          title: "EY Americas Vice Chair — Assurance; Next US Managing Partner (July 2026)" },
  { name: "Whitt Butler",          email: "whitt.butler@ey.com",           title: "EY Americas Vice Chair — Consulting" },
  { name: "Mitch Berlin",          email: "mitch.berlin@ey.com",           title: "EY Americas Vice Chair, EY-Parthenon" },
  { name: "Jim Hsu",               email: "jim.hsu@ey.com",                title: "EY Americas Vice Chair, Office of Strategy and Execution" },
  { name: "Ginnie Carlier",        email: "ginnie.carlier@ey.com",         title: "Chief Talent and Culture Officer" },
  { name: "Tony Jordan",           email: "tony.jordan@ey.com",            title: "EY Americas and US Chief Ethics and Compliance Officer" },
  { name: "Doree Keating",         email: "doree.keating@ey.com",          title: "EY Americas Government & Public Sector Industry Group Leader" },
  { name: "Hyong Kim",             email: "hyong.kim@ey.com",              title: "EY Global and Americas TMT Industry Leader" },
  { name: "Shawn Smith",           email: "shawn.smith@ey.com",            title: "EY Americas Financial Services Leader" },
  { name: "Bill Strait",           email: "bill.strait@ey.com",            title: "EY Americas Vice Chair for Finance & Operations" },
  { name: "Timothy Tracy",         email: "timothy.tracy@ey.com",          title: "EY Americas Private Equity Leader" },
  { name: "Kristin Valente",       email: "kristin.valente@ey.com",        title: "EY Americas Chief Client Officer" },
  { name: "Steve Wanner",          email: "steve.wanner@ey.com",           title: "EY Americas Industrials & Energy Leader" },
  { name: "Linda Hill",            email: "linda.hill@ey.com",             title: "EY Americas Consumer & Health Industry Group Leader" },
  // US Governing Board
  { name: "Regina Balderas",       email: "regina.balderas@ey.com",        title: "EY-Parthenon Partner; Governing Board Member" },
  { name: "Peter Davis",           email: "peter.davis@ey.com",            title: "Consulting Partner; Governing Board Member" },
  { name: "Anita Holloway",        email: "anita.holloway@ey.com",         title: "Assurance Partner; Lead Governing Board Member" },
  { name: "Lee Henderson",         email: "lee.henderson@ey.com",          title: "Assurance Partner; Governing Board Member" },
  { name: "Richard Jackson",       email: "richard.jackson@ey.com",        title: "Assurance Partner; Governing Board Member" },
  { name: "Steve Mangan",          email: "steve.mangan@ey.com",           title: "Tax Partner; Governing Board Member" },
  { name: "Joe McGrath",           email: "joe.mcgrath@ey.com",            title: "Assurance Partner; Governing Board Member" },
  { name: "April Spencer",         email: "april.spencer@ey.com",          title: "Tax Partner; Governing Board Member" },
  { name: "Saj Usman",             email: "saj.usman@ey.com",              title: "Consulting Principal; Governing Board Member" },
  // EY Global Executive (US-based)
  { name: "Carmine Di Sibio",      email: "carmine.disibio@ey.com",        title: "EY Global Chairman and CEO" },
  { name: "Janet Truncale",        email: "janet.truncale@ey.com",         title: "EY Global CEO (incoming)" },
  // EY AI & Technology Practice (US-based)
  { name: "Nigel Duffy",           email: "nigel.duffy@ey.com",            title: "EY Global AI Leader" },
  { name: "Jeff Wong",             email: "jeff.wong@ey.com",              title: "EY Global Chief Innovation Officer" },
  { name: "Dan Diasio",            email: "dan.diasio@ey.com",             title: "EY Global Artificial Intelligence Leader" },
  { name: "Beatriz Sanz Saiz",     email: "beatriz.sanzsaiz@ey.com",       title: "EY Global Data & AI Leader" },
  // EY-Parthenon (Strategy) US Leaders
  { name: "Tej Vakta",             email: "tej.vakta@ey.com",              title: "EY-Parthenon US Leader" },
  { name: "Mark Weinberger",       email: "mark.weinberger@ey.com",        title: "EY Former Global Chairman & CEO; Senior Advisor" },
  // EY Consulting US Leaders
  { name: "Raj Sharma",            email: "raj.sharma@ey.com",             title: "EY US Consulting Leader" },
  { name: "Errol Gardner",         email: "errol.gardner@ey.com",          title: "EY Global Consulting Leader" },
  // EY Tax US Leaders
  { name: "Kate Barton",           email: "kate.barton@ey.com",            title: "EY Global Vice Chair, Tax" },
  // EY Assurance US Leaders
  { name: "Tom Hough",             email: "tom.hough@ey.com",              title: "EY Americas Vice Chair, Assurance" },
  // EY Financial Services US
  { name: "Andrew Gilder",         email: "andrew.gilder@ey.com",          title: "EY Americas Financial Services Leader" },
  // EY Private Equity
  { name: "Pete Witte",            email: "pete.witte@ey.com",             title: "EY Global Private Equity Leader" },
  // EY Health Sciences & Wellness
  { name: "Arda Ural",             email: "arda.ural@ey.com",              title: "EY Americas Health Sciences & Wellness Leader" },
  // EY Real Estate
  { name: "Howard Roth",           email: "howard.roth@ey.com",            title: "EY Global Real Estate Leader" },
];

// ── Email template ────────────────────────────────────────────────────────────
const SUBJECT = "35-page strategy memo in 4 minutes — AI decision intelligence for professional services";

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

<p>A few things that may be relevant to EY:</p>
<ul>
  <li><strong>AI-accelerated professional services</strong> — the platform compresses the research and synthesis phase of complex advisory engagements from weeks to minutes, producing structured, evidence-backed memos that mirror the quality of senior consulting output — directly relevant to EY's AI practice and EY-Parthenon strategy work</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; a live production case study in applied agentic AI that goes beyond current LLM deployments and aligns with EY's AI transformation agenda</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns continuously from historical decision data</li>
  <li><strong>Auditable by design</strong> — no black-box outputs; every agent decision is logged and explainable — a model for responsible AI deployment aligned with EY's approach to trustworthy, transparent AI</li>
  <li><strong>Client application</strong> — the platform could serve as a force multiplier for EY's client engagements in financial services, private equity, strategy, and digital transformation — accelerating due diligence, market entry analysis, and operational benchmarking at scale</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with EY's AI practice, EY-Parthenon, or client delivery model.</p>

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
  console.log("📧 Sending EY review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — EY USA] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all EY contacts ─────────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO EY USA — ${eyContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < eyContacts.length; i++) {
    const { name, email, title } = eyContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${eyContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${eyContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`EY USA: ${sent} sent, ${failed} failed out of ${eyContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
