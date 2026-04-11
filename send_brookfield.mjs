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

// Email format: first.last@brookfield.com (89% confirmed — LeadIQ & RocketReach)
const contacts = [
  // C-Suite & Group Leadership
  { name: "Bruce Flatt",          email: "bruce.flatt@brookfield.com",          title: "Chairman, Brookfield Asset Management; CEO, Brookfield Corporation" },
  { name: "Connor Teskey",        email: "connor.teskey@brookfield.com",        title: "CEO, Brookfield Asset Management" },
  { name: "Hadley Peer Marshall", email: "hadley.peermarshall@brookfield.com",  title: "CFO, Brookfield Asset Management" },
  { name: "Nicholas Goodman",     email: "nicholas.goodman@brookfield.com",     title: "President & CFO, Brookfield Corporation" },
  { name: "Cyrus Madon",          email: "cyrus.madon@brookfield.com",          title: "Executive Vice Chair, Brookfield Asset Management" },
  { name: "Barry Blattman",       email: "barry.blattman@brookfield.com",       title: "Vice Chair, Brookfield Asset Management" },
  { name: "Justin Beber",         email: "justin.beber@brookfield.com",         title: "COO, Brookfield Corporation" },
  { name: "Jeff Blidner",         email: "jeff.blidner@brookfield.com",         title: "Vice Chair, Brookfield Corporation" },
  // Business CEOs
  { name: "Sam Pollock",          email: "sam.pollock@brookfield.com",          title: "CEO, Brookfield Infrastructure" },
  { name: "Anuj Ranjan",          email: "anuj.ranjan@brookfield.com",          title: "CEO, Brookfield Private Equity" },
  { name: "Craig Noble",          email: "craig.noble@brookfield.com",          title: "CEO, Brookfield Credit" },
  { name: "Lowell Baron",         email: "lowell.baron@brookfield.com",         title: "CEO, Brookfield Real Estate" },
  { name: "Brian Kingston",       email: "brian.kingston@brookfield.com",       title: "Executive Chair, Brookfield Real Estate" },
  { name: "Sachin Shah",          email: "sachin.shah@brookfield.com",          title: "CEO, Brookfield Wealth Solutions" },
  { name: "David Levi",           email: "david.levi@brookfield.com",           title: "CEO, Global Client Group" },
  { name: "Natalie Adomait",      email: "natalie.adomait@brookfield.com",      title: "Managing Partner, Energy" },
  // Managing Partners — Private Equity
  { name: "Doug Bayerd",          email: "doug.bayerd@brookfield.com",          title: "Managing Partner, Private Equity" },
  { name: "Ron Bloom",            email: "ron.bloom@brookfield.com",            title: "Managing Partner, Private Equity" },
  { name: "David Bonasia",        email: "david.bonasia@brookfield.com",        title: "Managing Partner, Private Equity" },
  { name: "Devin Barnwell",       email: "devin.barnwell@brookfield.com",       title: "Managing Partner, Real Estate" },
  { name: "Leila Araiche",        email: "leila.araiche@brookfield.com",        title: "Managing Partner, Real Estate" },
  // Managing Partners — Infrastructure
  { name: "Arpit Agrawal",        email: "arpit.agrawal@brookfield.com",        title: "Managing Partner, Infrastructure" },
  { name: "Marcos Almeida",       email: "marcos.almeida@brookfield.com",       title: "Managing Partner, Infrastructure" },
  { name: "Keshav Bhojania",      email: "keshav.bhojania@brookfield.com",      title: "Managing Partner, Infrastructure" },
  { name: "Chloe Berry",          email: "chloe.berry@brookfield.com",          title: "Managing Partner, Infrastructure" },
  // Managing Partners — Credit
  { name: "Carolyn Bidwell",      email: "carolyn.bidwell@brookfield.com",      title: "Managing Partner, Credit" },
  { name: "Jon Bayer",            email: "jon.bayer@brookfield.com",            title: "Managing Partner, Brookfield Wealth Solutions" },
  // Global Client Group — Americas
  { name: "Lisa Anderson",        email: "lisa.anderson@brookfield.com",        title: "Managing Director, Global Client Group" },
  { name: "Ravdeep Anand",        email: "ravdeep.anand@brookfield.com",        title: "Managing Director, Global Client Group" },
  { name: "Tatsuro Aoyama",       email: "tatsuro.aoyama@brookfield.com",       title: "Managing Director, Private Wealth" },
  // Managing Directors — Corporate & Legal
  { name: "Zaki Abbas",           email: "zaki.abbas@brookfield.com",           title: "Managing Director, Corporate" },
  { name: "Katie Anderson",       email: "katie.anderson@brookfield.com",       title: "Managing Director, Corporate" },
  { name: "Jason Ang",            email: "jason.ang@brookfield.com",            title: "Managing Director, Corporate" },
  { name: "James Bodi",           email: "james.bodi@brookfield.com",           title: "Managing Director, Legal & Regulatory" },
  { name: "Sara Beugelmans",      email: "sara.beugelmans@brookfield.com",      title: "Managing Director, Tax" },
  // Managing Directors — Real Estate
  { name: "Ben Annable",          email: "ben.annable@brookfield.com",          title: "Managing Director, Real Estate" },
  { name: "Elad Argaman",         email: "elad.argaman@brookfield.com",         title: "Managing Director, Real Estate" },
  { name: "Ted Berklayd",         email: "ted.berklayd@brookfield.com",         title: "Managing Director, Real Estate" },
  // Managing Directors — Private Equity
  { name: "Onaiza Ahmed",         email: "onaiza.ahmed@brookfield.com",         title: "Managing Director, Private Equity" },
  { name: "Henrik Akerson",       email: "henrik.akerson@brookfield.com",       title: "Managing Director, Private Equity" },
  { name: "Erica Albrecht",       email: "erica.albrecht@brookfield.com",       title: "Managing Director, Private Equity" },
  { name: "Nicholas Apostolatos", email: "nicholas.apostolatos@brookfield.com", title: "Managing Director, Private Equity" },
  { name: "Rachel Arnett",        email: "rachel.arnett@brookfield.com",        title: "Managing Director, Private Equity" },
  // Managing Directors — Infrastructure
  { name: "Pooja Aggarwal",       email: "pooja.aggarwal@brookfield.com",       title: "Managing Director, Infrastructure" },
  { name: "Brian Baker",          email: "brian.baker@brookfield.com",          title: "Operating Partner, Infrastructure" },
  // Managing Directors — Energy
  { name: "Ines Bargueno",        email: "ines.bargueno@brookfield.com",        title: "Managing Director, Energy" },
  // Managing Directors — Credit
  { name: "Anthony Bavaro",       email: "anthony.bavaro@brookfield.com",       title: "Managing Director, Credit" },
  // Wealth Solutions
  { name: "Shashank Bhalla",      email: "shashank.bhalla@brookfield.com",      title: "Managing Director, Brookfield Wealth Solutions" },
  // Board of Directors
  { name: "Maureen Kempston Darkes", email: "maureen.kempstondarkes@brookfield.com", title: "Board Director, Brookfield Asset Management" },
  { name: "Patricia Zuccotti",    email: "patricia.zuccotti@brookfield.com",    title: "Board Director, Brookfield Asset Management" },
];

const SUBJECT = "35-page IC memo in 4 minutes — AI decision intelligence for alternative asset management";

function buildEmail(firstName) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 32px 24px; }
  p { margin: 0 0 16px 0; } ul { margin: 12px 0 20px 0; padding-left: 20px; } li { margin-bottom: 8px; }
  .signature { margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 13px; color: #555; }
</style></head><body>
<p>Dear ${firstName},</p>
<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native decision intelligence platform that produces a <strong>35-page institutional-grade analysis memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>
<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes investment decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>
<p>A few things that may be relevant to Brookfield:</p>
<ul>
  <li><strong>Deal evaluation at scale</strong> — across Brookfield's infrastructure, private equity, real estate, and credit platforms, the system compresses weeks of IC preparation into minutes; producing structured, evidence-backed memos that maintain the rigour of a senior investment committee review</li>
  <li><strong>Multi-strategy intelligence</strong> — the multi-agent council architecture can simultaneously analyse deals across asset classes, geographies, and risk profiles; directly applicable to Brookfield's global multi-strategy investment approach</li>
  <li><strong>Wealth solutions & client reporting</strong> — the platform can synthesise portfolio data, market intelligence, and risk parameters into structured client-ready memos in minutes; a force multiplier for Brookfield Wealth Solutions and the Global Client Group</li>
  <li><strong>Auditable AI for LP reporting</strong> — every agent vote, rationale, and confidence score is logged; the system produces a full audit trail for LP reporting and investment governance — aligned with Brookfield's fiduciary standards</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; responsible, auditable AI in production</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Brookfield's investment operations, deal evaluation process, or client reporting infrastructure.</p>
<p>Would any time this week or next work for a brief call?</p>
<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>Founder & CEO, AgenThinkMesh<br>
  <a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>+965 99608209<br>
  <a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a>
</div>
</body></html>`;
}

async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained\n");
  console.log("📧 Sending Brookfield review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Brookfield] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO BROOKFIELD ASSET MANAGEMENT — ${contacts.length} contacts`);
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
  console.log(`BROOKFIELD: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
