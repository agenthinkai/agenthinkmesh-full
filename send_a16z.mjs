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

// ── A16Z CONTACTS — 30 people ─────────────────────────────────────────────────
// Email format confirmed: FLast@a16z.com (85% — LeadIQ, RocketReach)
// e.g. Marc Andreessen → MAndreessen@a16z.com
const a16zContacts = [
  // Founders & Managing Partners
  { name: "Marc Andreessen",    email: "MAndreessen@a16z.com",   title: "Co-Founder & General Partner" },
  { name: "Ben Horowitz",       email: "BHorowitz@a16z.com",     title: "Co-Founder & General Partner" },
  // General Partners — AI / Enterprise
  { name: "Martin Casado",      email: "MCasado@a16z.com",       title: "General Partner, Enterprise" },
  { name: "Peter Levine",       email: "PLevine@a16z.com",       title: "General Partner, Enterprise" },
  { name: "Guido Appenzeller",  email: "GAppenzeller@a16z.com",  title: "General Partner, AI" },
  { name: "Matt Bornstein",     email: "MBornstein@a16z.com",    title: "General Partner, AI" },
  { name: "Jennifer Li",        email: "JLi@a16z.com",           title: "General Partner, AI" },
  { name: "Sarah Wang",         email: "SWang@a16z.com",         title: "General Partner, Growth" },
  { name: "David Ulevitch",     email: "DUlevitch@a16z.com",     title: "General Partner, American Dynamism" },
  { name: "Katherine Boyle",    email: "KBoyle@a16z.com",        title: "General Partner, American Dynamism" },
  // General Partners — Fintech / Bio / Crypto
  { name: "Angela Strange",     email: "AStrange@a16z.com",      title: "General Partner, Fintech" },
  { name: "Seema Amble",        email: "SAmble@a16z.com",        title: "General Partner, Fintech" },
  { name: "Alex Rampell",       email: "ARampell@a16z.com",      title: "General Partner, Fintech" },
  { name: "Vineeta Agarwala",   email: "VAgarwala@a16z.com",     title: "General Partner, Bio+Health" },
  { name: "Julie Yoo",          email: "JYoo@a16z.com",          title: "General Partner, Bio+Health" },
  { name: "Jorge Conde",        email: "JConde@a16z.com",        title: "General Partner, Bio+Health" },
  { name: "Chris Dixon",        email: "CDixon@a16z.com",        title: "General Partner, Crypto" },
  { name: "Ali Yahya",          email: "AYahya@a16z.com",        title: "General Partner, Crypto" },
  // General Partners — Consumer / Games
  { name: "Andrew Chen",        email: "AChen@a16z.com",         title: "General Partner, Consumer" },
  { name: "Connie Chan",        email: "CChan@a16z.com",         title: "General Partner, Consumer" },
  { name: "David George",       email: "DGeorge@a16z.com",       title: "General Partner, Growth" },
  { name: "Jeff Jordan",        email: "JJordan@a16z.com",       title: "General Partner, Consumer" },
  // General Partners — Infrastructure / Security
  { name: "Joel de la Garza",   email: "JdelaGarza@a16z.com",   title: "General Partner, Security" },
  { name: "Zane Lackey",        email: "ZLackey@a16z.com",       title: "General Partner, Security" },
  // Investors — AI focus
  { name: "Jonathan Lai",       email: "JLai@a16z.com",          title: "General Partner, AI x Creative" },
  { name: "Anjney Midha",       email: "AMidha@a16z.com",        title: "General Partner, AI" },
  { name: "Yoko Li",            email: "YLi@a16z.com",           title: "General Partner, AI" },
  // Operating / Platform
  { name: "Raghu Raghuram",     email: "RRaghuram@a16z.com",     title: "Operating Partner, Enterprise" },
  { name: "David Haber",        email: "DHaber@a16z.com",        title: "General Partner, Security" },
  { name: "Justin Kahl",        email: "JKahl@a16z.com",         title: "General Partner, Enterprise" },
];

// ── Email template ────────────────────────────────────────────────────────────
const SUBJECT = "35-page IC memo in 4 minutes — AI deal intelligence for venture";

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

<p>The system is designed for the rigour of investment decision-making: each agent operates as a specialist covering financial modelling, sector dynamics, management assessment, competitive positioning, exit viability, and risk identification. A weighted consensus algorithm synthesises their votes into a structured investment recommendation — with every vote, rationale, confidence score, and flag logged and exportable.</p>

<p>A few things that may be relevant to a16z:</p>
<ul>
  <li><strong>Speed at institutional quality</strong> — a 35-page memo with financial projections, risk matrix, competitive landscape, and management assessment, generated in 4 minutes; deal teams can screen significantly more opportunities without adding headcount</li>
  <li><strong>Multi-agent architecture in production</strong> — 10 specialist agents run simultaneously per deal, each with independent scoring frameworks and veto logic; the system may be of interest as a case study in applied agentic AI for high-stakes decision workflows</li>
  <li><strong>Auditable by design</strong> — every agent vote and rationale is logged; no black-box outputs — a model for responsible AI deployment in regulated contexts</li>
  <li><strong>Self-improving</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the system learns from deal history</li>
  <li><strong>Portfolio application</strong> — the same architecture could be applied to due diligence workflows across a16z portfolio companies in financial services, enterprise, and beyond</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live run — and to explore whether there is a natural intersection with a16z's investment thesis or portfolio ecosystem.</p>

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
  console.log("📧 Sending a16z review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — a16z] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all a16z contacts ───────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO A16Z — ${a16zContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < a16zContacts.length; i++) {
    const { name, email, title } = a16zContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${a16zContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${a16zContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`A16Z: ${sent} sent, ${failed} failed out of ${a16zContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
