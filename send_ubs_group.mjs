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

// ── UBS GROUP — 40 contacts ──────────────────────────────────────────────────
// Email format: first.last@ubs.com (confirmed via 10X EBITDA & SignalHire)
const contacts = [
  // Group Executive Board
  { name: "Sergio Ermotti",           email: "sergio.ermotti@ubs.com",           title: "Group CEO" },
  { name: "George Athanasopoulos",    email: "george.athanasopoulos@ubs.com",    title: "Co-President, Investment Bank" },
  { name: "Michelle Bereaux",         email: "michelle.bereaux@ubs.com",         title: "Group Chief Compliance & Operational Risk Officer" },
  { name: "Aleksandar Ivanovic",      email: "aleksandar.ivanovic@ubs.com",      title: "President, Asset Management" },
  { name: "Robert Karofsky",          email: "robert.karofsky@ubs.com",          title: "Co-President, Global Wealth Management & President Americas" },
  { name: "Sabine Keller-Busse",      email: "sabine.keller-busse@ubs.com",      title: "President, Personal & Corporate Banking & President UBS Switzerland" },
  { name: "Iqbal Khan",               email: "iqbal.khan@ubs.com",               title: "Co-President, Global Wealth Management & President APAC" },
  { name: "Barbara Levi",             email: "barbara.levi@ubs.com",             title: "Group General Counsel" },
  { name: "Beatriz Martin",           email: "beatriz.martin@ubs.com",           title: "Group COO, Head Non-Core & Legacy, President EMEA" },
  { name: "Stefan Seiler",            email: "stefan.seiler@ubs.com",            title: "Head Group Human Resources & Corporate Services" },
  { name: "Todd Tuckner",             email: "todd.tuckner@ubs.com",             title: "Group CFO" },
  { name: "Marco Valla",              email: "marco.valla@ubs.com",              title: "Co-President, Investment Bank" },
  { name: "Damian Vogel",             email: "damian.vogel@ubs.com",             title: "Group Chief Risk Officer" },
  // Board of Directors
  { name: "Colm Kelleher",            email: "colm.kelleher@ubs.com",            title: "Chairman, Board of Directors" },
  { name: "Lukas Gaehwiler",          email: "lukas.gaehwiler@ubs.com",          title: "Vice Chairman, Board of Directors" },
  { name: "Jeremy Anderson",          email: "jeremy.anderson@ubs.com",          title: "Senior Independent Director" },
  { name: "Claudia Boeckstiegel",     email: "claudia.boeckstiegel@ubs.com",     title: "Board Director" },
  { name: "Julie Richardson",         email: "julie.richardson@ubs.com",         title: "Board Director" },
  { name: "Dieter Wemmer",            email: "dieter.wemmer@ubs.com",            title: "Board Director" },
  { name: "Nathalie Rachou",          email: "nathalie.rachou@ubs.com",          title: "Board Director" },
  // Asset Management Leadership
  { name: "Barry Gill",               email: "barry.gill@ubs.com",               title: "Head Investments, Asset Management" },
  { name: "James Poucher",            email: "james.poucher@ubs.com",            title: "Asset Management Region Head Americas" },
  { name: "Gaylee Saliba",            email: "gaylee.saliba@ubs.com",            title: "Asset Management Chief Strategy Officer" },
  { name: "Rachael Sledge",           email: "rachael.sledge@ubs.com",           title: "CFO, Asset Management" },
  { name: "Seraina Frey",             email: "seraina.frey@ubs.com",             title: "Asset Management COO & Head AM Technology" },
  { name: "Jerry Pascucci",           email: "jerry.pascucci@ubs.com",           title: "Co-Head, Unified Global Alternatives" },
  // Global Wealth Management
  { name: "Mike Camacho",             email: "mike.camacho@ubs.com",             title: "Head, GWM Americas Field" },
  { name: "Brian Carlin",             email: "brian.carlin@ubs.com",             title: "CEO, UBS Bank USA & Head GWM Banking US" },
  { name: "Frank Destra",             email: "frank.destra@ubs.com",             title: "President, UBS Bank USA" },
  { name: "Tom Naratil",              email: "tom.naratil@ubs.com",              title: "Former President, UBS Americas (Senior Advisor)" },
  // Technology & AI
  { name: "Mike Dargan",              email: "mike.dargan@ubs.com",              title: "Former Group COTO (Advisor)" },
  { name: "Vikram Malhotra",          email: "vikram.malhotra@ubs.com",          title: "Head, Technology & Innovation" },
  { name: "Joanna Cound",             email: "joanna.cound@ubs.com",             title: "Head, Public Policy & Sustainability" },
  // Investment Bank Americas
  { name: "David Soanes",             email: "david.soanes@ubs.com",             title: "Head, Global Banking" },
  { name: "Piero Novelli",            email: "piero.novelli@ubs.com",            title: "Former Co-President IB (Senior Advisor)" },
  { name: "Matthew Grounds",          email: "matthew.grounds@ubs.com",          title: "Head, IB APAC & Senior Advisor" },
  { name: "Naureen Hassan",           email: "naureen.hassan@ubs.com",           title: "President, UBS Financial Services" },
  { name: "Jason Chandler",           email: "jason.chandler@ubs.com",           title: "Head, Wealth Management USA" },
  { name: "Solita Marcelli",          email: "solita.marcelli@ubs.com",          title: "Chief Investment Officer, Americas GWM" },
  { name: "Mark Haefele",             email: "mark.haefele@ubs.com",             title: "Chief Investment Officer, Global Wealth Management" },
];

const SUBJECT = "35-page IC memo in 4 minutes — AI decision intelligence for wealth & investment banking";

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

<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes financial decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>

<p>A few things that may be relevant to UBS:</p>
<ul>
  <li><strong>Investment decision acceleration</strong> — the platform compresses weeks of research and synthesis into minutes, producing structured, evidence-backed memos; directly applicable to UBS's investment banking deal analysis, wealth management portfolio reviews, and asset management research processes</li>
  <li><strong>Wealth management intelligence</strong> — the multi-agent council architecture can synthesise client portfolio data, market intelligence, and risk parameters into a structured recommendation memo in minutes; a force multiplier for UBS's global wealth management advisors and CIO research teams</li>
  <li><strong>Private equity & M&A due diligence</strong> — the system is designed for the rigour of PE deal analysis and M&A evaluation; it can synthesise financial, competitive, and operational data into a structured IC-ready memo in minutes — directly relevant to UBS's investment banking and advisory practice</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; the architecture mirrors the rigour of a senior investment committee review, but at machine speed — a compelling demonstration of enterprise-grade agentic AI</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; responsible, auditable AI in production — aligned with UBS's commitment to responsible AI and client fiduciary duty</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with UBS's AI strategy, wealth management operations, or investment banking practice.</p>

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

  console.log("📧 Sending UBS Group review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — UBS Group] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO UBS GROUP — ${contacts.length} contacts`);
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
  console.log(`UBS GROUP: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
