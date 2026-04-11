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

// ── CARLYLE GROUP CONTACTS — 30 people ───────────────────────────────────────
// Email format confirmed: first.last@carlyle.com (10X EBITDA, Wall Street Oasis)
const carlyleContacts = [
  // C-Suite & Leadership Committee
  { name: "Harvey Schwartz",      email: "harvey.schwartz@carlyle.com",     title: "Chief Executive Officer" },
  { name: "John Redett",          email: "john.redett@carlyle.com",          title: "Co-President, Head of Global Private Equity" },
  { name: "Mark Jenkins",         email: "mark.jenkins@carlyle.com",         title: "Co-President, Head of Global Credit & Insurance" },
  { name: "Jeff Nedelman",        email: "jeff.nedelman@carlyle.com",        title: "Co-President, Global Head of Client Business" },
  { name: "Lindsay LoBue",        email: "lindsay.lobue@carlyle.com",        title: "Chief Operating Officer" },
  { name: "Justin Plouffe",       email: "justin.plouffe@carlyle.com",       title: "Chief Financial Officer" },
  { name: "Jeffrey Ferguson",     email: "jeffrey.ferguson@carlyle.com",     title: "General Counsel" },
  { name: "Megan Starr",          email: "megan.starr@carlyle.com",          title: "Chief People Officer" },
  { name: "Heather Mitchell",     email: "heather.mitchell@carlyle.com",     title: "Chief Risk Officer and Head of EMEA" },
  { name: "Jason Thomas",         email: "jason.thomas@carlyle.com",         title: "Head of Global Research & Investment Strategy" },
  // Private Equity
  { name: "Sandra Horbach",       email: "sandra.horbach@carlyle.com",       title: "Chair, Americas Corporate Private Equity" },
  { name: "Brian Bernasek",       email: "brian.bernasek@carlyle.com",       title: "Co-Head, Americas Corporate Private Equity" },
  { name: "Steve Wise",           email: "steve.wise@carlyle.com",           title: "Co-Head, Americas Corporate Private Equity" },
  { name: "Michael Wand",         email: "michael.wand@carlyle.com",         title: "Head of Europe Private Equity" },
  { name: "James Attwood",        email: "james.attwood@carlyle.com",        title: "Managing Director, Technology, Media & Telecom" },
  { name: "Jonathan Colby",       email: "jonathan.colby@carlyle.com",       title: "Managing Director, Technology, Media & Telecom" },
  { name: "Marco De Benedetti",   email: "marco.debenedetti@carlyle.com",    title: "Managing Director, Europe Buyout" },
  // Global Credit
  { name: "Alexander Popov",      email: "alexander.popov@carlyle.com",      title: "Partner, Head of Credit Opportunities" },
  { name: "Brian Schreiber",      email: "brian.schreiber@carlyle.com",      title: "Partner, Head of Carlyle Insurance Solutions" },
  // AlpInvest / Wealth
  { name: "Ruulke Bagijn",        email: "ruulke.bagijn@carlyle.com",        title: "Global Head of Carlyle AlpInvest" },
  { name: "Shane Clifford",       email: "shane.clifford@carlyle.com",       title: "Head of Global Wealth" },
  { name: "Brad McCarthy",        email: "brad.mccarthy@carlyle.com",        title: "Managing Director, Head of APAC Wealth" },
  // Investor Relations & Business Development
  { name: "Daniel Harris",        email: "daniel.harris@carlyle.com",        title: "Head of Public Investor Relations" },
  { name: "Rene Benedetto",       email: "rene.benedetto@carlyle.com",       title: "Managing Director, Senior Relationship Manager" },
  { name: "Darya Mastronardi",    email: "darya.mastronardi@carlyle.com",    title: "Managing Director, Investor Relations" },
  { name: "Vikram Lokur",         email: "vikram.lokur@carlyle.com",         title: "Managing Director, Head of IR Asia Pacific" },
  // Co-Founders / Chairmen
  { name: "David Rubenstein",     email: "david.rubenstein@carlyle.com",     title: "Co-Founder and Co-Chairman" },
  { name: "William Conway",       email: "william.conway@carlyle.com",       title: "Co-Founder and Co-Chairman" },
  { name: "Daniel D'Aniello",     email: "daniel.daniello@carlyle.com",      title: "Co-Founder and Chairman Emeritus" },
  // Technology & Operations
  { name: "Lucia Soares",         email: "lucia.soares@carlyle.com",         title: "Chief Information Officer" },
];

// ── Email template ────────────────────────────────────────────────────────────
const SUBJECT = "35-page IC memo in 4 minutes — AI deal intelligence for private equity";

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

<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native investment intelligence platform that produces a <strong>35-page institutional-grade IC memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>

<p>The system is designed for the rigour of private equity investment committees: each agent operates as a specialist covering financial modelling, sector dynamics, management assessment, competitive positioning, exit viability, and risk identification. A weighted consensus algorithm synthesises their votes into a structured investment recommendation — with every vote, rationale, confidence score, and flag logged and exportable.</p>

<p>A few things that may be relevant to Carlyle:</p>
<ul>
  <li><strong>Speed at IC quality</strong> — a 35-page memo with financial projections, risk matrix, exit comparables, and management assessment, generated in 4 minutes; deal teams can screen 10x more opportunities without adding headcount</li>
  <li><strong>Parallel agent architecture</strong> — 10 specialist agents run simultaneously per deal, each with independent scoring frameworks and veto logic; no single model dominates the output</li>
  <li><strong>Auditable by design</strong> — every agent vote and rationale is logged; the system produces a full audit trail suitable for LP reporting and IC governance</li>
  <li><strong>Self-improving</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the system learns from your deal history</li>
  <li><strong>Multi-strategy</strong> — council modes available for buyout, growth equity, credit, and infrastructure — configurable to Carlyle's specific investment frameworks</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live run on a deal of your choosing — the output quality and speed may be of direct interest to your deal teams and IC process.</p>

<p>Would any time this week or next work for a brief call?</p>

<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>
  Founder, AgenThinkMesh<br>
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
  console.log("📧 Sending Carlyle review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Carlyle Group] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all Carlyle contacts ────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO CARLYLE GROUP — ${carlyleContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < carlyleContacts.length; i++) {
    const { name, email, title } = carlyleContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${carlyleContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${carlyleContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`CARLYLE GROUP: ${sent} sent, ${failed} failed out of ${carlyleContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
