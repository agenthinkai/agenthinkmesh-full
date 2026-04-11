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

// ── AWS CONTACTS — 40 people ─────────────────────────────────────────────────
// Email format: flast@amazon.com (25% most common per RocketReach)
// Amazon S-team + AWS direct reports under Matt Garman
const contacts = [
  // Amazon S-team (AWS-relevant)
  { name: "Andy Jassy",              email: "ajassy@amazon.com",             title: "President & CEO, Amazon" },
  { name: "Matt Garman",             email: "mgarman@amazon.com",            title: "CEO, Amazon Web Services" },
  { name: "Swami Sivasubramanian",   email: "ssivasubramanian@amazon.com",   title: "VP, Agentic AI" },
  { name: "Peter DeSantis",          email: "pdesantis@amazon.com",          title: "SVP, Foundational AI Models, Custom Silicon & Quantum" },
  { name: "Colleen Aubrey",          email: "caubrey@amazon.com",            title: "SVP, AWS Applied AI Solutions" },
  { name: "John Felton",             email: "jfelton@amazon.com",            title: "SVP & AWS CFO" },
  { name: "David Brown",             email: "dbrown@amazon.com",             title: "VP, Compute Services" },
  { name: "James Hamilton",          email: "jhamilton@amazon.com",          title: "SVP & Distinguished Engineer" },
  { name: "Steve Schmidt",           email: "sschmidt@amazon.com",           title: "Chief Security Officer" },
  { name: "Beth Galetti",            email: "bgaletti@amazon.com",           title: "SVP, People eXperience & Technology" },
  // AWS Direct Leadership under Matt Garman
  { name: "Uwem Ukpong",             email: "uukpong@amazon.com",            title: "VP, Global Services, AWS" },
  { name: "Kathrin Renz",            email: "krenz@amazon.com",              title: "VP, AWS Industries" },
  { name: "Scott Mullins",           email: "smullins@amazon.com",           title: "VP, AWS Worldwide Financial Services" },
  { name: "Ruba Borno",              email: "rborno@amazon.com",             title: "VP, AWS Worldwide Channels & Alliances" },
  { name: "Matt Wood",               email: "mwood@amazon.com",              title: "VP, AI Products" },
  { name: "Dilip Kumar",             email: "dilkumar@amazon.com",           title: "VP, AWS Applications" },
  { name: "Ariel Kelman",            email: "akelman@amazon.com",            title: "VP & CMO, AWS" },
  { name: "Chris Grusz",             email: "cgrusz@amazon.com",             title: "MD, AWS Marketplace & Partner Services" },
  { name: "Dave Levy",               email: "dlevy@amazon.com",              title: "VP, AWS Worldwide Public Sector" },
  { name: "Tanuja Randery",          email: "trandery@amazon.com",           title: "MD, AWS EMEA" },
  // AWS AI & ML Leadership
  { name: "Rohit Prasad",            email: "rprasad@amazon.com",            title: "SVP, Artificial General Intelligence" },
  { name: "Bratin Saha",             email: "bsaha@amazon.com",              title: "VP & GM, ML Platforms & Services" },
  { name: "Vasi Philomin",           email: "vphilomin@amazon.com",          title: "VP, Generative AI" },
  { name: "Baskar Sridharan",        email: "bsridharan@amazon.com",         title: "VP, AI & ML Platforms" },
  { name: "Ankur Mehrotra",          email: "amehrotra@amazon.com",          title: "GM, Amazon Bedrock" },
  // AWS Enterprise & Sales
  { name: "Mike Clayville",          email: "mclayville@amazon.com",         title: "VP, Worldwide Commercial Sales" },
  { name: "Sabrina Clauwaert",       email: "sclauwaert@amazon.com",         title: "VP, AWS Enterprise Sales" },
  { name: "Ishit Vachhrajani",       email: "ivachhrajani@amazon.com",       title: "VP, AWS Strategic Accounts" },
  { name: "Teresa Carlson",          email: "tcarlson@amazon.com",           title: "Former VP, AWS Worldwide Public Sector (Advisor)" },
  { name: "Jeff Kratz",              email: "jkratz@amazon.com",             title: "VP, AWS Worldwide Public Sector" },
  // AWS Product & Engineering
  { name: "Werner Vogels",           email: "wvogels@amazon.com",            title: "CTO, Amazon" },
  { name: "Peter Vosshall",          email: "pvosshall@amazon.com",          title: "VP & Distinguished Engineer, AWS" },
  { name: "Charlie Bell",            email: "cbell@amazon.com",              title: "Former SVP, AWS (Advisor)" },
  { name: "Mark Schwartz",           email: "mschwartz@amazon.com",          title: "Enterprise Strategist, AWS" },
  { name: "Stephen Orban",           email: "sorban@amazon.com",             title: "VP, Managed Services & Marketplace" },
  // AWS Partnerships & BD
  { name: "Doug Yeum",               email: "dyeum@amazon.com",              title: "VP, AWS Partner Organization" },
  { name: "Reem Asaad",              email: "rasaad@amazon.com",             title: "VP, AWS MENA" },
  { name: "Yasser Alsaied",          email: "yalsaied@amazon.com",           title: "VP, IoT & Edge Services" },
  { name: "Nandini Ramani",          email: "nramani@amazon.com",            title: "VP, Developer Tools" },
  { name: "Rahul Pathak",            email: "rpathak@amazon.com",            title: "VP, Analytics" },
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

<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes strategic decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>

<p>A few things that may be relevant to AWS:</p>
<ul>
  <li><strong>Agentic AI in production</strong> — AgenThinkMesh is a live production implementation of multi-agent AI orchestration; the architecture is directly aligned with AWS's agentic AI roadmap (Amazon Bedrock Agents, multi-agent collaboration) and represents a real-world enterprise deployment case study</li>
  <li><strong>AWS Bedrock & infrastructure alignment</strong> — the platform is built on cloud-native infrastructure and leverages LLM APIs at scale; there is a natural conversation around AWS Bedrock, SageMaker, and enterprise AI deployment — both as infrastructure and as a potential partnership</li>
  <li><strong>Enterprise AI decision intelligence</strong> — the system compresses weeks of research and synthesis into minutes, producing structured, evidence-backed memos; a direct application for enterprise clients across financial services, consulting, PE, and government — all key AWS verticals</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; the architecture mirrors the rigour of a senior expert review, but at machine speed — a compelling demonstration of what agentic AI can do at enterprise scale</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; responsible, auditable AI in production — aligned with AWS's responsible AI principles</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with AWS's agentic AI strategy, enterprise customer base, or partner ecosystem.</p>

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

  console.log("📧 Sending AWS review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — AWS] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO AWS — ${contacts.length} contacts`);
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
  console.log(`AWS: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
