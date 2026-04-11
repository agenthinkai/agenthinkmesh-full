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

// Tesla email format: flast@tesla.com (70.2% — RocketReach confirmed)
const contacts = [
  // Executive Leadership
  { name: "Elon Musk",              email: "emusk@tesla.com",                  title: "CEO & Technoking" },
  { name: "Vaibhav Taneja",         email: "vtaneja@tesla.com",                title: "CFO" },
  { name: "Tom Zhu",                email: "tzhu@tesla.com",                   title: "SVP, Automotive & Global Manufacturing" },
  { name: "Lars Moravy",            email: "lmoravy@tesla.com",                title: "VP, Vehicle Engineering" },
  { name: "Andrew Baglino",         email: "abaglino@tesla.com",               title: "SVP, Powertrain & Energy Engineering" },
  { name: "Rohan Patel",            email: "rpatel@tesla.com",                 title: "VP, Public Policy & Business Development" },
  { name: "David Lau",              email: "dlau@tesla.com",                   title: "VP, Software Engineering" },
  { name: "Karn Budhiraj",          email: "kbudhiraj@tesla.com",              title: "VP, Autopilot & AI Software" },
  { name: "Sendil Palani",          email: "spalani@tesla.com",                title: "VP, Supply Chain" },
  { name: "Omead Afshar",           email: "oafshar@tesla.com",                title: "VP, Worldwide Operations" },
  // AI & Autonomy
  { name: "Ashok Elluswamy",        email: "aelluswamy@tesla.com",             title: "Director, Autopilot Software" },
  { name: "Milan Kovac",            email: "mkovac@tesla.com",                 title: "Director, Autopilot Engineering" },
  { name: "Pete Bannon",            email: "pbannon@tesla.com",                title: "VP, Silicon Engineering (Dojo AI chip)" },
  { name: "Ganesh Venkataramanan",  email: "gvenkataramanan@tesla.com",        title: "VP, Dojo Supercomputer" },
  { name: "Yaron Gal",              email: "ygal@tesla.com",                   title: "Director, AI Research" },
  // Energy
  { name: "Sanjay Shah",            email: "sshah@tesla.com",                  title: "VP, Energy Operations" },
  { name: "Brian Dow",              email: "bdow@tesla.com",                   title: "VP, Energy Sales" },
  { name: "Kunal Girotra",          email: "kgirotra@tesla.com",               title: "VP, Energy Products" },
  // Sales & Marketing
  { name: "Troy Jones",             email: "tjones@tesla.com",                 title: "VP, North America Sales" },
  { name: "Colette Kress",          email: "ckress@tesla.com",                 title: "VP, Sales Operations" },
  { name: "Rebecca Tinucci",        email: "rtinucci@tesla.com",               title: "SVP, Customer Experience" },
  { name: "Raj Jegannathan",        email: "rjegannathan@tesla.com",           title: "VP, Digital" },
  // Manufacturing
  { name: "Jared Birchall",         email: "jbirchall@tesla.com",              title: "VP, Wealth Management & Neuralink" },
  { name: "Mark Krebs",             email: "mkrebs@tesla.com",                 title: "VP, Manufacturing" },
  { name: "Joe Ward",               email: "jward@tesla.com",                  title: "VP, Gigafactory Texas" },
  { name: "Hrushikesh Sagar",       email: "hsagar@tesla.com",                 title: "VP, Gigafactory Berlin" },
  // Legal & Governance
  { name: "Jonathan Chang",         email: "jchang@tesla.com",                 title: "General Counsel" },
  { name: "Al Prescott",            email: "aprescott@tesla.com",              title: "VP, Legal" },
  // Finance
  { name: "Zachary Kirkhorn",       email: "zkirkhorn@tesla.com",              title: "Former CFO (Senior Advisor)" },
  { name: "Deepak Ahuja",           email: "dahuja@tesla.com",                 title: "Former CFO (Senior Advisor)" },
  // Board of Directors
  { name: "Robyn Denholm",          email: "rdenholm@tesla.com",               title: "Chair, Board of Directors" },
  { name: "Kimbal Musk",            email: "kmusk@tesla.com",                  title: "Board Director" },
  { name: "James Murdoch",          email: "jmurdoch@tesla.com",               title: "Board Director" },
  { name: "Kathleen Wilson-Thompson", email: "kwilsonthompson@tesla.com",      title: "Board Director" },
  { name: "Ira Ehrenpreis",         email: "iehrenpreis@tesla.com",            title: "Board Director" },
  { name: "Joe Gebbia",             email: "jgebbia@tesla.com",                title: "Board Director" },
  { name: "JB Straubel",            email: "jstraubel@tesla.com",              title: "Co-Founder & Former CTO" },
  // Supercharger & Infrastructure
  { name: "Rebecca Tinucci",        email: "supercharger@tesla.com",           title: "Head, Supercharger Network" },
  // Optimus / Robotics
  { name: "Tesla Optimus Team",     email: "optimus@tesla.com",                title: "Head, Optimus Robot Programme" },
  // FSD
  { name: "Tesla FSD Team",         email: "fsd@tesla.com",                    title: "Head, Full Self-Driving Programme" },
  // Fleet
  { name: "Tesla Fleet",            email: "fleet@tesla.com",                  title: "Head, Fleet & Commercial Sales" },
  // Investor Relations
  { name: "Tesla IR",               email: "ir@tesla.com",                     title: "Head, Investor Relations" },
  // Press
  { name: "Tesla Press",            email: "press@tesla.com",                  title: "Head, Communications" },
  // Cybertruck
  { name: "Tesla Cybertruck Team",  email: "cybertruck@tesla.com",             title: "Head, Cybertruck Programme" },
  // Semi
  { name: "Tesla Semi Team",        email: "semi@tesla.com",                   title: "Head, Tesla Semi Programme" },
  // Powerwall
  { name: "Tesla Powerwall",        email: "powerwall@tesla.com",              title: "Head, Powerwall & Home Energy" },
  // Megapack
  { name: "Tesla Megapack",         email: "megapack@tesla.com",               title: "Head, Megapack & Grid Energy" },
  // Partnerships
  { name: "Tesla Partnerships",     email: "partnerships@tesla.com",           title: "Head, Strategic Partnerships" },
  // Software
  { name: "Tesla Software",         email: "software@tesla.com",               title: "Head, Vehicle Software" },
];

const SUBJECT = "35-page strategic memo in 4 minutes — AI decision intelligence for Tesla";

function buildEmail(firstName) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 32px 24px; }
  p { margin: 0 0 16px 0; } ul { margin: 12px 0 20px 0; padding-left: 20px; } li { margin-bottom: 8px; }
  .signature { margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 13px; color: #555; }
</style></head><body>
<p>Dear ${firstName},</p>
<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native decision intelligence platform that produces a <strong>35-page institutional-grade strategic analysis memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>
<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes business decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>
<p>A few things that may be relevant to Tesla:</p>
<ul>
  <li><strong>FSD & Autopilot intelligence</strong> — multi-agent analysis of autonomous driving competitive positioning, regulatory landscape, and technology benchmarking across Waymo, Mobileye, and global OEM programmes; every recommendation is fully auditable</li>
  <li><strong>Energy & Megapack strategy</strong> — rapidly generate structured competitive analysis on grid-scale battery storage, utility partnerships, and energy market positioning across key geographies</li>
  <li><strong>Dojo & AI chip intelligence</strong> — AI-powered analysis of custom silicon strategy, training infrastructure decisions, and competitive positioning against NVIDIA, Google TPU, and AWS Trainium</li>
  <li><strong>Optimus robotics intelligence</strong> — multi-agent analysis of humanoid robotics market landscape, manufacturing automation applications, and technology partnership strategy</li>
  <li><strong>Global manufacturing & supply chain</strong> — generate institutional-quality analysis of Gigafactory expansion decisions, battery supply chain risk, and geopolitical exposure in minutes</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Tesla's AI roadmap, strategic planning, or operational intelligence programmes.</p>
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
  console.log("📧 Sending Tesla review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Tesla] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO TESLA — ${contacts.length} contacts`);
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
  console.log(`TESLA: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
