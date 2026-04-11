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

// ── MUBADALA UAE CONTACTS — 20 people ────────────────────────────────────────
// Email format: FLast@mubadala.ae (78.5% — RocketReach confirmed)
const contacts = [
  // Group Executive Committee (from annual2024.mubadala.com)
  { name: "Khaldoon Al Mubarak",        email: "KAlMubarak@mubadala.ae",         title: "Managing Director & Group CEO" },
  { name: "Waleed Al Muhairi",           email: "WAlMuhairi@mubadala.ae",         title: "Deputy Group CEO" },
  { name: "Homaid Al Shimmari",          email: "HAlShimmari@mubadala.ae",        title: "Deputy Group CEO, Chief Corporate & Human Capital Officer" },
  { name: "Ahmed Al Calily",             email: "AAlCalily@mubadala.ae",          title: "Chief Strategy & Risk Officer" },
  { name: "Hani Barhoush",               email: "HBarhoush@mubadala.ae",          title: "CEO, Credit & Special Situations" },
  { name: "Samer Halawa",                email: "SHalawa@mubadala.ae",            title: "Chief Legal Officer" },
  { name: "Carlos Obeid",                email: "CObeid@mubadala.ae",             title: "Chief Financial Officer" },
  { name: "Bakheet Al Katheeri",         email: "BAlKatheeri@mubadala.ae",        title: "CEO, UAE Investments" },
  { name: "Khaled Al Marri",             email: "KAlMarri@mubadala.ae",           title: "CEO, Real Assets" },
  { name: "Saeed Al Mazrouei",           email: "SAlMazrouei@mubadala.ae",        title: "Managing Director & CEO, Abu Dhabi Investment Council" },
  // Mubadala Capital (mubadalacapital.ae)
  { name: "Ibrahim Ajami",               email: "IAjami@mubadala.ae",             title: "Senior Partner, Head of Ventures — Mubadala Capital" },
  { name: "Fatima Al Noaimi",            email: "FAlNoaimi@mubadala.ae",          title: "Co-Head of Solutions — Mubadala Capital" },
  { name: "Maxime Franzetti",            email: "MFranzetti@mubadala.ae",         title: "Senior Partner, Co-Head of Solutions — Mubadala Capital" },
  { name: "Kevin Kokko",                 email: "KKokko@mubadala.ae",             title: "Co-Head of Private Equity — Mubadala Capital" },
  // Technology & AI Investments
  { name: "Mansoor Al Hamed",            email: "MAlHamed@mubadala.ae",           title: "CEO, Technology & Innovation" },
  { name: "Adib Mattar",                 email: "AMattar@mubadala.ae",            title: "Head of Technology Investments" },
  // Healthcare & Life Sciences
  { name: "Hareb Al Darmaki",            email: "HAlDarmaki@mubadala.ae",         title: "CEO, Healthcare" },
  // Energy & Sustainability
  { name: "Musabbeh Al Kaabi",           email: "MAlKaabi@mubadala.ae",           title: "CEO, UAE Investments & Energy" },
  // Infrastructure
  { name: "Faisal Al Sahlawi",           email: "FAlSahlawi@mubadala.ae",         title: "CEO, Infrastructure" },
  // International Investments
  { name: "Hana Al Rostamani",           email: "HAlRostamani@mubadala.ae",       title: "Head of International Investments" },
];

const SUBJECT = "35-page IC memo in 4 minutes — AI decision intelligence for sovereign wealth";

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

<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes investment decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering financial modelling, competitive positioning, risk identification, geopolitical assessment, and strategic fit. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>

<p>A few things that may be relevant to Mubadala:</p>
<ul>
  <li><strong>Sovereign wealth & long-horizon investing</strong> — the platform is designed for the complexity of multi-asset, multi-geography portfolios; it can synthesise macro signals, sector dynamics, and deal-specific data into a single structured memo in minutes — directly relevant to Mubadala's $330B+ investment mandate</li>
  <li><strong>IC preparation speed</strong> — a 35-page institutional memo in 4 minutes means deal teams can evaluate more opportunities with greater rigour; the platform compresses weeks of research into a structured, evidence-backed output ready for Investment Committee review</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; the architecture mirrors the rigour of a senior deal team review, but at machine speed</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the system learns continuously from historical decision data — auditable, explainable, and aligned with responsible AI principles</li>
  <li><strong>GCC & UAE alignment</strong> — as a UAE-based AI platform, AgenThinkMesh is directly aligned with the UAE's AI strategy and Mubadala's mandate to build future-focused industries; there may be a natural intersection with Mubadala's technology investment thesis and portfolio company applications</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Mubadala's investment operations, portfolio intelligence, or technology strategy.</p>

<p>Would any time this week or next work for a brief call?</p>

<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>
  Founder & CEO, AgenThinkMesh<br>
  <a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>
  +965 99608209<br>
  <a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a>
</div>
</body>
</html>`;
}

async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained\n");

  console.log("📧 Sending Mubadala review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Mubadala UAE] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO MUBADALA UAE — ${contacts.length} contacts`);
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
  console.log(`MUBADALA UAE: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
