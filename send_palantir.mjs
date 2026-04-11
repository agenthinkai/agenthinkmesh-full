import "dotenv/config";

const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const TENANT_ID = process.env.MS_TENANT_ID;
const SENDER_EMAIL = "farouq@agenthink.ai";

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
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
  if (!res.ok) { const err = await res.text(); throw new Error(`Send failed for ${to}: ${err}`); }
}

const contacts = [
  { name: "Alexander Karp",        email: "alex.karp@palantir.com",            title: "Co-Founder & CEO" },
  { name: "Stephen Cohen",         email: "stephen.cohen@palantir.com",        title: "Co-Founder, President & Secretary" },
  { name: "Peter Thiel",           email: "peter.thiel@palantir.com",          title: "Co-Founder & Chairman" },
  { name: "Shyam Sankar",          email: "shyam.sankar@palantir.com",         title: "CTO & EVP" },
  { name: "David Glazer",          email: "david.glazer@palantir.com",         title: "CFO & Treasurer" },
  { name: "Ryan Taylor",           email: "ryan.taylor@palantir.com",          title: "Chief Revenue Officer & Chief Legal Officer" },
  { name: "Alex Moore",            email: "alex.moore@palantir.com",           title: "Independent Director" },
  { name: "Alexandra Schiff",      email: "alexandra.schiff@palantir.com",     title: "Independent Director" },
  { name: "Lauren Friedman Stat",  email: "lauren.friedmanstat@palantir.com",  title: "Independent Director" },
  { name: "Eric Woersching",       email: "eric.woersching@palantir.com",      title: "Independent Director" },
  { name: "Akash Jain",            email: "akash.jain@palantir.com",           title: "President, Palantir US Commercial" },
  { name: "Ted Mabrey",            email: "ted.mabrey@palantir.com",           title: "Head of US Commercial Sales" },
  { name: "Kevin Kawasaki",        email: "kevin.kawasaki@palantir.com",       title: "Head of Business Development" },
  { name: "Josh Harris",           email: "josh.harris@palantir.com",          title: "Head of Commercial Partnerships" },
  { name: "Matthew Sanchez",       email: "matthew.sanchez@palantir.com",      title: "Chief Communications Officer" },
  { name: "Nate Rosenblatt",       email: "nate.rosenblatt@palantir.com",      title: "Head of US Government" },
  { name: "Deborah James",         email: "deborah.james@palantir.com",        title: "Member, Federal Advisory Board" },
  { name: "William McRaven",       email: "william.mcraven@palantir.com",      title: "Member, Federal Advisory Board" },
  { name: "Christine Fox",         email: "christine.fox@palantir.com",        title: "Member, Federal Advisory Board" },
  { name: "Karin Knox",            email: "karin.knox@palantir.com",           title: "Head of Philanthropy Engineering & BD" },
  { name: "Carey Kolaja",          email: "carey.kolaja@palantir.com",         title: "Chief Product Officer" },
  { name: "Diana Hu",              email: "diana.hu@palantir.com",             title: "Head of AI Platform" },
  { name: "Saurabh Mohan",         email: "saurabh.mohan@palantir.com",        title: "Head of AIP" },
  { name: "Louis Mosley",          email: "louis.mosley@palantir.com",         title: "Head of UK" },
  { name: "Christoph Hardt",       email: "christoph.hardt@palantir.com",      title: "Head of DACH" },
  { name: "Rodrigo Liang",         email: "rodrigo.liang@palantir.com",        title: "Head of Asia Pacific" },
  { name: "Heather Planishek",     email: "heather.planishek@palantir.com",    title: "Chief Accounting Officer" },
  { name: "Nadia Rawlinson",       email: "nadia.rawlinson@palantir.com",      title: "Chief People Officer" },
  { name: "Ana Soro",              email: "ana.soro@palantir.com",             title: "Head of Investor Relations" },
  { name: "Palantir Partnerships", email: "partnerships@palantir.com",         title: "Strategic Partnerships" },
];

const SUBJECT = "35-page strategic memo in 4 minutes — complementary AI decision intelligence for AIP";

function buildEmail(firstName) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#1a1a1a;max-width:620px;margin:0 auto;padding:32px 24px;}p{margin:0 0 16px 0;}ul{margin:12px 0 20px 0;padding-left:20px;}li{margin-bottom:8px;}.signature{margin-top:32px;border-top:1px solid #e0e0e0;padding-top:20px;font-size:13px;color:#555;}</style>
</head><body>
<p>Dear ${firstName},</p>
<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native decision intelligence platform that produces a <strong>35-page institutional-grade strategic analysis memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>
<p>Each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs — with every agent vote, rationale, and confidence score logged and fully auditable.</p>
<p>A few things that may be relevant to Palantir:</p>
<ul>
  <li><strong>AIP integration opportunity</strong> — our multi-agent orchestration layer is architecturally complementary to Palantir AIP; the decision council framework could serve as a high-value application layer deployed on top of Foundry/Ontology data models</li>
  <li><strong>Government & defence intelligence</strong> — multi-agent analysis of geopolitical risk and operational decision support with full audit trails meeting government accountability standards</li>
  <li><strong>Commercial enterprise intelligence</strong> — AI-accelerated strategic analysis for Palantir's commercial clients across healthcare, financial services, energy, and manufacturing</li>
  <li><strong>AIP bootcamp acceleration</strong> — our framework could serve as a high-impact demonstration use case showing enterprise clients the power of agentic AI decision-making on their Ontology data</li>
  <li><strong>MENA & GCC expansion</strong> — we are actively deploying across Gulf Cooperation Council organisations and see strong alignment with Palantir's government and commercial expansion in the region</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural partnership or integration opportunity with Palantir's AIP platform.</p>
<p>Would any time this week or next work for a brief call?</p>
<p>Warm regards,</p>
<div class="signature"><strong>Farouq Sultan</strong><br>Founder & CEO, AgenThinkMesh<br>
<a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>+965 99608209<br>
<a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a></div>
</body></html>`;
}

async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained\n");
  console.log("📧 Sending Palantir review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Palantir] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));
  console.log("─".repeat(60));
  console.log(`SENDING TO PALANTIR — ${contacts.length} contacts`);
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
  console.log(`PALANTIR: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
