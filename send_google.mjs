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

// ── GOOGLE CONTACTS — 50 people ───────────────────────────────────────────────
// Email format confirmed: firstname.lastname@google.com (most common — LeadIQ, RocketReach)
const googleContacts = [
  // Alphabet / Google C-Suite
  { name: "Sundar Pichai",         email: "sundar@google.com",                  title: "CEO, Alphabet & Google" },
  { name: "Anat Ashkenazi",        email: "anat.ashkenazi@google.com",           title: "CFO, Alphabet" },
  { name: "Ruth Porat",            email: "ruth.porat@google.com",               title: "President & Chief Investment Officer, Alphabet" },
  { name: "Kent Walker",           email: "kent.walker@google.com",              title: "President, Global Affairs, Alphabet & Google" },
  { name: "Philipp Schindler",     email: "philipp.schindler@google.com",        title: "SVP & Chief Business Officer, Google" },
  { name: "Nick Fox",              email: "nick.fox@google.com",                 title: "SVP, Knowledge & Information, Google" },
  { name: "Prabhakar Raghavan",    email: "prabhakar.raghavan@google.com",       title: "Chief Technologist, Google" },
  { name: "Rick Osterloh",         email: "rick.osterloh@google.com",            title: "SVP, Platforms & Devices, Google" },
  { name: "Urs Holzle",            email: "urs.holzle@google.com",               title: "SVP, Engineering & Google Fellow" },
  { name: "Jen Fitzpatrick",       email: "jen.fitzpatrick@google.com",          title: "SVP, Core Systems & Experiences, Google" },
  { name: "Fiona Cicconi",         email: "fiona.cicconi@google.com",            title: "Chief People Officer, Google" },
  { name: "Sissie Hsiao",          email: "sissie.hsiao@google.com",             title: "VP & GM, Gemini Experiences & Google Assistant" },
  { name: "Sameer Samat",          email: "sameer.samat@google.com",             title: "President, Android Ecosystem, Google" },
  { name: "Jerry Dischler",        email: "jerry.dischler@google.com",           title: "President, Cloud Applications, Google" },
  // Google DeepMind
  { name: "Demis Hassabis",        email: "demis.hassabis@google.com",           title: "CEO & Co-Founder, Google DeepMind" },
  { name: "Shane Legg",            email: "shane.legg@google.com",               title: "Co-Founder & Chief Scientist, Google DeepMind" },
  { name: "Koray Kavukcuoglu",     email: "koray.kavukcuoglu@google.com",        title: "VP of Research, Google DeepMind" },
  { name: "Colin Murdoch",         email: "colin.murdoch@google.com",            title: "Chief Business Officer, Google DeepMind" },
  { name: "Oriol Vinyals",         email: "oriol.vinyals@google.com",            title: "VP Research, Google DeepMind" },
  { name: "Jeff Dean",             email: "jeff.dean@google.com",                title: "Chief Scientist, Google DeepMind" },
  { name: "Ed Chi",                email: "edchi@google.com",                    title: "VP of Research, Google DeepMind" },
  { name: "Eli Collins",           email: "eli.collins@google.com",              title: "VP, Product, Google DeepMind" },
  // Google Cloud Leadership
  { name: "Thomas Kurian",         email: "thomas.kurian@google.com",            title: "CEO, Google Cloud" },
  { name: "Amin Vahdat",           email: "amin.vahdat@google.com",              title: "Chief Technologist for AI Infrastructure, Google Cloud" },
  { name: "Francis deSouza",       email: "francis.desouza@google.com",          title: "COO & President, Security Products, Google Cloud" },
  { name: "Karthik Narain",        email: "karthik.narain@google.com",           title: "Chief Product & Business Officer, Google Cloud" },
  { name: "Karen Dahut",           email: "karen.dahut@google.com",              title: "CEO, Google Public Sector" },
  { name: "Brad Calder",           email: "brad.calder@google.com",              title: "President, Google Cloud Platform & SRE" },
  { name: "Michael Clark",         email: "michael.clark@google.com",            title: "President, North America, Google Cloud" },
  { name: "Will Grannis",          email: "will.grannis@google.com",             title: "CTO, Google Cloud" },
  { name: "Matt Renner",           email: "matt.renner@google.com",              title: "President & CRO, Google Cloud" },
  { name: "Oliver Parker",         email: "oliver.parker@google.com",            title: "VP, Global Generative AI GTM, Google Cloud" },
  { name: "Carrie Tharp",          email: "carrie.tharp@google.com",             title: "VP, Strategic Industries GTM, Google Cloud" },
  { name: "Shiv Venkataraman",     email: "shiv.venkataraman@google.com",        title: "VP/GM, Cloud Applied AI, Google Cloud" },
  { name: "Kevin Ichhpurani",      email: "kevin.ichhpurani@google.com",         title: "VP, Global Partner Ecosystem, Google Cloud" },
  { name: "Alison Wagonfeld",      email: "alison.wagonfeld@google.com",         title: "VP Marketing & CMO, Google Cloud" },
  { name: "Karan Bajwa",           email: "karan.bajwa@google.com",              title: "President, Asia Pacific, Google Cloud" },
  { name: "Kobi Bar-Nathan",       email: "kobi.bar-nathan@google.com",          title: "CFO, Google Cloud" },
  { name: "Tara Brady",            email: "tara.brady@google.com",               title: "President, EMEA, Google Cloud" },
  { name: "Yulie Kwon Kim",        email: "yulie.kwonkim@google.com",            title: "VP Product, Google Workspace" },
  // Google AI & Research
  { name: "Blaise Aguera y Arcas", email: "blaise@google.com",                   title: "VP & Fellow, Google Research" },
  { name: "Zoubin Ghahramani",     email: "zoubin.ghahramani@google.com",        title: "VP Research, Google DeepMind" },
  { name: "Douglas Eck",           email: "deck@google.com",                     title: "Research Director, Google DeepMind" },
  // Google Business & Partnerships
  { name: "Lorraine Twohill",      email: "lorraine.twohill@google.com",         title: "SVP & CMO, Google" },
  { name: "Lisa Gevelber",         email: "lisa.gevelber@google.com",            title: "CMO, Americas Region, Google" },
  { name: "Matt Brittin",          email: "matt.brittin@google.com",             title: "President, EMEA, Google" },
  { name: "Hiroshi Lockheimer",    email: "hiroshi.lockheimer@google.com",       title: "SVP, Platforms & Ecosystems, Google" },
  { name: "Dave Sobota",           email: "dave.sobota@google.com",              title: "VP, Global Sales & Operations, Google Cloud" },
  { name: "Catherine Courage",     email: "catherine.courage@google.com",        title: "VP, User Experience & Data Science, Google" },
  { name: "Melonie Parker",        email: "melonie.parker@google.com",           title: "Chief Diversity Officer, Google" },
];

// ── Email template ────────────────────────────────────────────────────────────
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

<p>The system represents a production-grade implementation of multi-agent AI for high-stakes enterprise decision workflows: each agent operates as a specialist with independent scoring frameworks and veto logic, covering financial modelling, competitive positioning, risk identification, and strategic assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and auditable.</p>

<p>A few things that may be relevant to Google:</p>
<ul>
  <li><strong>Multi-agent architecture in production</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning chains and veto logic; a live enterprise deployment of agentic AI at scale</li>
  <li><strong>Built on Google's AI ecosystem</strong> — the system leverages Google's foundation model infrastructure and is a direct application of the agentic AI capabilities Google is pioneering with Gemini and DeepMind</li>
  <li><strong>Enterprise decision intelligence</strong> — the architecture addresses a high-value enterprise use case: accelerating and improving the quality of complex, multi-dimensional decisions that currently require large teams and weeks of work</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the system learns continuously from historical decision data</li>
  <li><strong>Google Cloud application</strong> — the platform is a natural fit for Google Cloud's Applied AI and Workspace enterprise offerings, and could be a compelling case study for enterprise AI adoption</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Google's AI platform, Cloud enterprise strategy, or DeepMind's research agenda.</p>

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
  console.log("📧 Sending Google review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Google] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send to all Google contacts ─────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO GOOGLE — ${googleContacts.length} contacts`);
  console.log("─".repeat(60));
  let sent = 0, failed = 0;
  for (let i = 0; i < googleContacts.length; i++) {
    const { name, email, title } = googleContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmail(firstName));
      console.log(`✅ [${i + 1}/${googleContacts.length}] ${name} <${email}>`);
      sent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${googleContacts.length}] ${name} <${email}>: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`GOOGLE: ${sent} sent, ${failed} failed out of ${googleContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
