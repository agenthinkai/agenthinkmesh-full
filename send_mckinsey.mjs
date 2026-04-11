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

// ── McKINSEY CONTACTS — 40 people ─────────────────────────────────────────────
// Email format confirmed: first_last@mckinsey.com (91.2% — RocketReach)
const mckinseyContacts = [
  // Global Managing Partner & Shareholders Council (US-based)
  { name: "Bob Sternfels",         email: "Bob_Sternfels@mckinsey.com",         title: "Global Managing Partner" },
  { name: "Liz Hilton Segel",      email: "Liz_Hilton_Segel@mckinsey.com",      title: "Chief Client Officer & Senior Partner" },
  { name: "Laura Furstenthal",     email: "Laura_Furstenthal@mckinsey.com",     title: "Senior Partner; Shareholders Council" },
  { name: "Greg Kelly",            email: "Greg_Kelly@mckinsey.com",             title: "Senior Partner; Shareholders Council" },
  { name: "Shubham Singhal",       email: "Shubham_Singhal@mckinsey.com",       title: "Senior Partner; Shareholders Council" },
  { name: "Virginia Simmons",      email: "Virginia_Simmons@mckinsey.com",      title: "Senior Partner; Shareholders Council" },
  { name: "Kurt Strovink",         email: "Kurt_Strovink@mckinsey.com",         title: "Senior Partner; Shareholders Council" },
  { name: "Humayun Tai",           email: "Humayun_Tai@mckinsey.com",           title: "Senior Partner; Shareholders Council" },
  { name: "Yael Taqqu",            email: "Yael_Taqqu@mckinsey.com",            title: "Senior Partner; Shareholders Council" },
  { name: "Carter Wood",           email: "Carter_Wood@mckinsey.com",           title: "Senior Partner; Shareholders Council" },
  { name: "Daniel Pacthod",        email: "Daniel_Pacthod@mckinsey.com",        title: "Senior Partner; Shareholders Council" },
  { name: "Scott Rutherford",      email: "Scott_Rutherford@mckinsey.com",      title: "Senior Partner; Shareholders Council" },
  // AI & QuantumBlack Practice (North America)
  { name: "Dan Tinkoff",           email: "Dan_Tinkoff@mckinsey.com",           title: "Senior Partner; Global & North America Lead, AI (QuantumBlack)" },
  { name: "Alex Sawaya",           email: "Alex_Sawaya@mckinsey.com",           title: "Senior Partner; AI Practice, Greater China & North America" },
  { name: "Sal Arora",             email: "Sal_Arora@mckinsey.com",             title: "Senior Partner; AI Practice, North America" },
  { name: "Alexis Krivkovich",     email: "Alexis_Krivkovich@mckinsey.com",     title: "Senior Partner; People & Org Performance, North America" },
  // Technology Practice (North America)
  { name: "Vinayak HV",            email: "Vinayak_HV@mckinsey.com",            title: "Senior Partner; Technology Practice, North America" },
  { name: "Tarik Alatovic",        email: "Tarik_Alatovic@mckinsey.com",        title: "Senior Partner; Technology Practice" },
  { name: "Paul Jenkins",          email: "Paul_Jenkins@mckinsey.com",          title: "Senior Partner; Technology Practice" },
  { name: "Andy West",             email: "Andy_West@mckinsey.com",             title: "Senior Partner; Strategy & Corporate Finance" },
  // Strategy & Corporate Finance (North America)
  { name: "Sanjay Kalavar",        email: "Sanjay_Kalavar@mckinsey.com",        title: "Senior Partner; Strategy & Corporate Finance, North America" },
  { name: "Vishal Agarwal",        email: "Vishal_Agarwal@mckinsey.com",        title: "Senior Partner; Strategy & Corporate Finance" },
  // Financial Services (North America)
  { name: "Joydeep Sengupta",      email: "Joydeep_Sengupta@mckinsey.com",      title: "Senior Partner; Financial Services, North America" },
  { name: "Robert Linden",         email: "Robert_Linden@mckinsey.com",         title: "Senior Partner; Shareholders Council" },
  // Private Equity (North America)
  { name: "Kartik Jayaram",        email: "Kartik_Jayaram@mckinsey.com",        title: "Senior Partner; Private Equity & Principal Investors, North America" },
  // Operations (North America)
  { name: "Steve Reis",            email: "Steve_Reis@mckinsey.com",             title: "Senior Partner; Operations Practice, North America" },
  // Growth, Marketing & Sales (North America)
  { name: "Lieven Van der Veken",  email: "Lieven_Van_der_Veken@mckinsey.com",  title: "Senior Partner; Growth, Marketing & Sales, Global & Europe" },
  // Business Building (North America)
  { name: "Dan Aminetzah",         email: "Daniel_Aminetzah@mckinsey.com",      title: "Senior Partner; Business Building, North America" },
  // Transformation (North America)
  { name: "Francisco Ortega",      email: "Francisco_Ortega@mckinsey.com",      title: "Senior Partner; Transformation, North America" },
  // Healthcare & Life Sciences (North America)
  { name: "Hemant Ahlawat",        email: "Hemant_Ahlawat@mckinsey.com",        title: "Senior Partner; Life Sciences, North America" },
  // Consumer (North America)
  { name: "Pooneh Baghai",         email: "Pooneh_Baghai@mckinsey.com",         title: "Senior Partner; Shareholders Council" },
  // Sustainability (North America)
  { name: "Marie-Claude Nadeau",   email: "Marie-Claude_Nadeau@mckinsey.com",   title: "Senior Partner; Sustainability, North America" },
  // Risk & Resilience (North America)
  { name: "Kim Baroudy",           email: "Kim_Baroudy@mckinsey.com",           title: "Senior Partner; Risk & Resilience, Global & North America" },
  // Travel, Logistics & Infrastructure (North America)
  { name: "Azam Mohammad",         email: "Azam_Mohammad@mckinsey.com",         title: "Senior Partner; Travel, Logistics & Infrastructure, North America" },
  // TMT (North America)
  { name: "Aly Jeddy",             email: "Aly_Jeddy@mckinsey.com",             title: "Senior Partner; Shareholders Council" },
  // US People (from mckinsey.com/us/our-people)
  { name: "Praveen Adhi",          email: "Praveen_Adhi@mckinsey.com",          title: "Senior Partner — Chicago" },
  { name: "Gaurav Agrawal",        email: "Gaurav_Agrawal@mckinsey.com",        title: "Senior Partner" },
  { name: "Ashwin Adarkar",        email: "Ashwin_Adarkar@mckinsey.com",        title: "Senior Partner — Southern California" },
  { name: "Noshir Kaka",           email: "Noshir_Kaka@mckinsey.com",           title: "Senior Partner; Shareholders Council" },
  { name: "Andrew Pickersgill",    email: "Andrew_Pickersgill@mckinsey.com",    title: "Senior Partner; Shareholders Council" },
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

<p>A few things that may be relevant to McKinsey:</p>
<ul>
  <li><strong>AI-accelerated strategy work</strong> — the platform compresses the research and synthesis phase of complex strategy engagements from weeks to minutes, producing structured, evidence-backed memos that mirror the quality of senior consulting output — directly relevant to McKinsey's QuantumBlack and AI practice</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; a live production case study in applied agentic AI that goes beyond current LLM deployments</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns continuously from historical decision data</li>
  <li><strong>Auditable by design</strong> — no black-box outputs; every agent decision is logged and explainable — a model for responsible AI deployment aligned with McKinsey's approach to trustworthy AI</li>
  <li><strong>Client application</strong> — the platform could serve as a force multiplier for McKinsey's client engagements in PE, corporate strategy, financial services, and digital transformation — accelerating due diligence, market entry analysis, and operational benchmarking at scale</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with McKinsey's AI practice, QuantumBlack, or client delivery model.</p>

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
  console.log("📧 Sending McKinsey review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — McKinsey] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all McKinsey contacts ───────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO McKINSEY — ${mckinseyContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < mckinseyContacts.length; i++) {
    const { name, email, title } = mckinseyContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${mckinseyContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${mckinseyContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`McKINSEY: ${sent} sent, ${failed} failed out of ${mckinseyContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
