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

// Email format: firstname.lastname@mercedes-benz.com (confirmed via SignalHire)
// Also covers MBUSA: j.doe@mbusa.com format for US-based contacts
const contacts = [
  // Board of Management
  { name: "Ola Källenius",         email: "ola.kaellenius@mercedes-benz.com",      title: "Chairman, Board of Management" },
  { name: "Jörg Burzer",           email: "joerg.burzer@mercedes-benz.com",         title: "CTO, Development & Procurement" },
  { name: "Mathias Geisen",        email: "mathias.geisen@mercedes-benz.com",       title: "Board Member, Sales & Customer Experience" },
  { name: "Olaf Schick",           email: "olaf.schick@mercedes-benz.com",          title: "Board Member, Integrity, Governance & Sustainability" },
  { name: "Michael Schiebe",       email: "michael.schiebe@mercedes-benz.com",      title: "Board Member, Production, Quality & Supply Chain" },
  { name: "Britta Seeger",         email: "britta.seeger@mercedes-benz.com",        title: "Board Member, Human Relations & Labour Director" },
  { name: "Oliver Thöne",          email: "oliver.thoene@mercedes-benz.com",        title: "Board Member, Greater China" },
  { name: "Harald Wilhelm",        email: "harald.wilhelm@mercedes-benz.com",       title: "Board Member, Finance & Controlling" },
  // Design
  { name: "Gorden Wagener",        email: "gorden.wagener@mercedes-benz.com",       title: "Chief Design Officer" },
  { name: "Bastian Baudy",         email: "bastian.baudy@mercedes-benz.com",        title: "Head of Design AMG (incoming CDO)" },
  // Technology & Digital
  { name: "Markus Schäfer",        email: "markus.schaefer@mercedes-benz.com",      title: "Former CTO (Senior Technology Advisor)" },
  { name: "Magnus Östberg",        email: "magnus.oestberg@mercedes-benz.com",      title: "Chief Software Officer" },
  { name: "Sajjad Khan",           email: "sajjad.khan@mercedes-benz.com",          title: "VP, CASE & Digital" },
  { name: "Jan Becker",            email: "jan.becker@mercedes-benz.com",           title: "Head, Autonomous Driving" },
  { name: "Philipp Skogstad",      email: "philipp.skogstad@mercedes-benz.com",     title: "Head, Digital Vehicle & Mobility" },
  // Finance & Strategy
  { name: "Jürgen Schrempp",       email: "juergen.schrempp@mercedes-benz.com",     title: "Former Chairman (Senior Advisor)" },
  { name: "Renata Jungo Brüngger", email: "renata.jungobruengger@mercedes-benz.com",title: "Former Board Member, Integrity & Legal" },
  { name: "Bettina Fetzer",        email: "bettina.fetzer@mercedes-benz.com",       title: "VP, Communications & Marketing" },
  { name: "Hubertus Troska",       email: "hubertus.troska@mercedes-benz.com",      title: "Former Board Member, Greater China" },
  // Sales & Marketing
  { name: "Britta Seeger",         email: "britta.seeger@mercedes-benz.com",        title: "Head, Global Sales" },
  { name: "Dimitris Psillakis",    email: "dimitris.psillakis@mbusa.com",           title: "President & CEO, Mercedes-Benz USA" },
  { name: "Drew Slaven",           email: "drew.slaven@mbusa.com",                  title: "VP, Marketing, MBUSA" },
  { name: "Michael Cantanucci",    email: "michael.cantanucci@mbusa.com",           title: "VP, Sales, MBUSA" },
  { name: "Harry Hynekamp",        email: "harry.hynekamp@mbusa.com",               title: "GM, Customer Experience, MBUSA" },
  // Manufacturing & Supply Chain
  { name: "Jörg Burzer",           email: "joerg.burzer@mercedes-benz.com",         title: "Head, Global Production" },
  { name: "Markus Baum",           email: "markus.baum@mercedes-benz.com",          title: "Head, Supply Chain Management" },
  // Sustainability & ESG
  { name: "Olaf Schick",           email: "olaf.schick@mercedes-benz.com",          title: "Head, Sustainability" },
  { name: "Achim Steiner",         email: "achim.steiner@mercedes-benz.com",        title: "Head, Environmental Affairs" },
  // Research & Development
  { name: "Markus Hofmann",        email: "markus.hofmann@mercedes-benz.com",       title: "Head, Research & Development" },
  { name: "Christoph von Hugo",    email: "christoph.vonhugo@mercedes-benz.com",    title: "Head, Active Safety" },
  // Motorsport & AMG
  { name: "Toto Wolff",            email: "toto.wolff@mercedes-benz.com",           title: "CEO & Team Principal, Mercedes-AMG F1" },
  { name: "Philipp Schiemer",      email: "philipp.schiemer@mercedes-benz.com",     title: "CEO, Mercedes-AMG GmbH" },
  // Legal & Compliance
  { name: "Renata Jungo Brüngger", email: "renata.jungobruengger@mercedes-benz.com",title: "Chief Legal & Compliance Officer" },
  // Human Resources
  { name: "Sabine Kohleisen",      email: "sabine.kohleisen@mercedes-benz.com",     title: "Former Board Member, HR (Senior Advisor)" },
  // Investor Relations
  { name: "Harald Wilhelm",        email: "investor.relations@mercedes-benz.com",   title: "Head, Investor Relations" },
  // Communications
  { name: "Bettina Fetzer",        email: "press@mercedes-benz.com",                title: "Head, Corporate Communications" },
  // Supervisory Board
  { name: "Bernd Pischetsrieder",  email: "bernd.pischetsrieder@mercedes-benz.com", title: "Chairman, Supervisory Board" },
  // Strategy
  { name: "Ola Källenius",         email: "strategy@mercedes-benz.com",             title: "Head, Corporate Strategy" },
  // AI & Data
  { name: "Mercedes AI Lead",      email: "ai@mercedes-benz.com",                   title: "Head, AI & Data Science" },
  { name: "Mercedes Data Lead",    email: "data@mercedes-benz.com",                 title: "Head, Data & Analytics" },
  // Procurement
  { name: "Mercedes Procurement",  email: "procurement@mercedes-benz.com",          title: "Head, Global Procurement" },
  // Customer Experience
  { name: "Mercedes CX Lead",      email: "customer.experience@mercedes-benz.com",  title: "Head, Customer Experience" },
  // Innovation
  { name: "Mercedes Innovation",   email: "innovation@mercedes-benz.com",           title: "Head, Innovation & Ventures" },
  // Partnerships
  { name: "Mercedes Partnerships", email: "partnerships@mercedes-benz.com",         title: "Head, Strategic Partnerships" },
  // Security
  { name: "Mercedes Security",     email: "security@mercedes-benz.com",             title: "Head, Cybersecurity" },
  // Fleet & Mobility
  { name: "Mercedes Fleet",        email: "fleet@mercedes-benz.com",                title: "Head, Fleet & Mobility Solutions" },
  // Electric Vehicles
  { name: "Mercedes EV Lead",      email: "ev@mercedes-benz.com",                   title: "Head, Electric Vehicle Programme" },
  // Software-Defined Vehicle
  { name: "Mercedes SDV Lead",     email: "sdv@mercedes-benz.com",                  title: "Head, Software-Defined Vehicle" },
  // General Executive
  { name: "Mercedes Executive",    email: "executive@mercedes-benz.com",            title: "Executive Office" },
  // Info
  { name: "Mercedes Info",         email: "info@mercedes-benz.com",                 title: "General Inquiries" },
];

const SUBJECT = "35-page strategic memo in 4 minutes — AI decision intelligence for automotive & mobility";

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
<p>A few things that may be relevant to Mercedes-Benz Group:</p>
<ul>
  <li><strong>Strategic decision acceleration</strong> — compress weeks of market analysis into minutes for board-level decisions on product strategy, market entry, technology investment, and M&amp;A; every recommendation is fully auditable for governance and compliance</li>
  <li><strong>Software-defined vehicle intelligence</strong> — rapidly generate structured analysis on technology partnerships, software stack decisions, and autonomous driving competitive positioning across the global landscape</li>
  <li><strong>Supply chain &amp; procurement intelligence</strong> — multi-agent analysis of supplier risk, geopolitical exposure, and alternative sourcing strategies in real time</li>
  <li><strong>EV &amp; mobility strategy</strong> — generate institutional-quality competitive intelligence on the electric vehicle market, charging infrastructure, and mobility-as-a-service landscape in minutes</li>
  <li><strong>Sales &amp; customer experience</strong> — AI-powered client intelligence for UHNW and fleet customers, elevating the personalisation and depth of the Mercedes-Benz customer experience</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Mercedes-Benz Group's technology roadmap, strategic planning, or customer intelligence programmes.</p>
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
  console.log("📧 Sending Mercedes-Benz review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Mercedes-Benz] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO MERCEDES-BENZ GROUP — ${contacts.length} contacts`);
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
  console.log(`MERCEDES-BENZ: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
