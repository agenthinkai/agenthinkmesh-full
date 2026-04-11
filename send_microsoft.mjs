import "dotenv/config";

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

// ── Microsoft USA CONTACTS — 40 people ───────────────────────────────────────
// Email format: firstname.lastname@microsoft.com (36.1% — RocketReach; widely confirmed)
const contacts = [
  // C-Suite & Executive Officers (from news.microsoft.com/source/leadership)
  { name: "Satya Nadella",          email: "satyan@microsoft.com",               title: "Chairman & CEO" },
  { name: "Brad Smith",             email: "bradsmith@microsoft.com",            title: "Vice Chair & President" },
  { name: "Amy Hood",               email: "amyhood@microsoft.com",              title: "EVP & CFO" },
  { name: "Judson Althoff",         email: "judson.althoff@microsoft.com",       title: "CEO, Microsoft Commercial Business" },
  { name: "Amy Coleman",            email: "amy.coleman@microsoft.com",          title: "EVP & Chief People Officer" },
  { name: "Kathleen Hogan",         email: "kathleenho@microsoft.com",           title: "EVP, Office of Strategy & Transformation" },
  { name: "Takeshi Numoto",         email: "takeshin@microsoft.com",             title: "EVP & Chief Marketing Officer" },
  // AI Division
  { name: "Mustafa Suleyman",       email: "mustafas@microsoft.com",             title: "EVP & CEO, Microsoft AI" },
  { name: "Kevin Scott",            email: "kevinscott@microsoft.com",           title: "EVP & Chief Technology Officer" },
  { name: "Eric Boyd",              email: "eric.boyd@microsoft.com",            title: "CVP, Azure AI Platform" },
  { name: "Asha Sharma",            email: "asha.sharma@microsoft.com",          title: "CVP, AI Platform" },
  { name: "Mitra Azizirad",         email: "mitra.azizirad@microsoft.com",       title: "CVP, AI & Cognitive Services" },
  // Azure & Cloud
  { name: "Scott Guthrie",          email: "scottgu@microsoft.com",              title: "EVP, Cloud & AI" },
  { name: "Jason Zander",           email: "jasonz@microsoft.com",               title: "EVP, Strategic Missions & Technologies" },
  { name: "Mark Russinovich",       email: "markruss@microsoft.com",             title: "CTO, Microsoft Azure" },
  { name: "Julia White",            email: "julia.white@microsoft.com",          title: "CVP, Azure Marketing" },
  // Microsoft 365 & Copilot
  { name: "Jared Spataro",          email: "jaredsp@microsoft.com",              title: "CVP, AI at Work" },
  { name: "Rajesh Jha",             email: "rajeshj@microsoft.com",              title: "EVP, Experiences & Devices" },
  { name: "Panos Panay",            email: "panayp@microsoft.com",               title: "Former EVP, Devices; now at Amazon" },
  { name: "Charles Lamanna",        email: "clamanna@microsoft.com",             title: "CVP, Business Applications & Platform" },
  // Enterprise Sales & Partnerships
  { name: "Nick Parker",            email: "nick.parker@microsoft.com",          title: "CVP, Global Partner Solutions" },
  { name: "Alysa Taylor",           email: "alysat@microsoft.com",               title: "CVP, Industry & Partner Sales" },
  { name: "Gavriella Schuster",     email: "gavriellas@microsoft.com",           title: "Former CVP, One Commercial Partner" },
  { name: "Chris Capossela",        email: "chriscap@microsoft.com",             title: "Former CMO; Senior Advisor" },
  // Security
  { name: "Charlie Bell",           email: "charlieb@microsoft.com",             title: "EVP, Security" },
  { name: "Vasu Jakkal",            email: "vjakkal@microsoft.com",              title: "CVP, Security, Compliance & Identity" },
  // LinkedIn (Microsoft subsidiary)
  { name: "Ryan Roslansky",         email: "rroslansky@linkedin.com",            title: "CEO, LinkedIn" },
  { name: "Tomer Cohen",            email: "tomer.cohen@linkedin.com",           title: "CPO, LinkedIn" },
  // GitHub (Microsoft subsidiary)
  { name: "Thomas Dohmke",          email: "thomas.dohmke@github.com",           title: "CEO, GitHub" },
  // Business Development & Strategy
  { name: "Peggy Johnson",          email: "peggyj@microsoft.com",               title: "Former EVP, Business Development" },
  { name: "Don Mattrick",           email: "donm@microsoft.com",                 title: "Former President, Interactive Entertainment" },
  // Industry Solutions
  { name: "David Rhew",             email: "david.rhew@microsoft.com",           title: "Global CMO & VP, Healthcare" },
  { name: "Tom Keane",              email: "tomkeane@microsoft.com",             title: "CVP, Azure Global" },
  { name: "Nicole Dezen",           email: "nicole.dezen@microsoft.com",         title: "CVP, Global Partner Solutions" },
  // Research
  { name: "Peter Lee",              email: "peterlee@microsoft.com",             title: "President, Microsoft Research" },
  { name: "Eric Horvitz",           email: "horvitz@microsoft.com",              title: "Chief Scientific Officer" },
  // Developer Division
  { name: "Amanda Silver",          email: "amanda.silver@microsoft.com",        title: "CVP, Developer Division" },
  // Dynamics 365 & Power Platform
  { name: "James Phillips",         email: "jamesph@microsoft.com",              title: "Former President, Business Applications" },
  // Accessibility & Inclusion
  { name: "Jenny Lay-Flurrie",      email: "jennylay@microsoft.com",             title: "Chief Accessibility Officer" },
  // Sustainability
  { name: "Melanie Nakagawa",       email: "melanien@microsoft.com",             title: "Chief Sustainability Officer" },
];

const SUBJECT = "35-page IC memo in 4 minutes — multi-agent AI for enterprise decision intelligence";

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

<p>A few things that may be relevant to Microsoft:</p>
<ul>
  <li><strong>Azure AI & Copilot alignment</strong> — AgenThinkMesh is a production case study in multi-agent orchestration at scale; the architecture is directly relevant to Microsoft's agentic AI roadmap and the evolution of Copilot from single-model assistant to multi-agent decision system</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; this goes beyond current Copilot deployments and demonstrates what enterprise-grade agentic AI looks like in production</li>
  <li><strong>Enterprise decision intelligence</strong> — the platform compresses complex research and synthesis from weeks to minutes, producing structured, evidence-backed memos — a force multiplier for enterprise clients across financial services, consulting, and private equity</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns continuously from historical decision data — a model for responsible, auditable AI</li>
  <li><strong>Partnership opportunity</strong> — there may be a natural intersection with Microsoft's enterprise AI go-to-market, Azure OpenAI Service, and the Copilot ecosystem; I would welcome the conversation</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Microsoft's AI platform, enterprise sales, or partner ecosystem.</p>

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

async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained\n");

  console.log("📧 Sending Microsoft review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Microsoft USA] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO MICROSOFT USA — ${contacts.length} contacts`);
  console.log("─".repeat(60));

  let sent = 0, failed = 0;
  for (let i = 0; i < contacts.length; i++) {
    const { name, email } = contacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${contacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${contacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`MICROSOFT USA: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
