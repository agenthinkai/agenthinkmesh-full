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

// BMW Group email format: firstname.lastname@bmw.de or @bmwgroup.com (confirmed via RocketReach ~62%)
const contacts = [
  // Board of Management
  { name: "Oliver Zipse",           email: "oliver.zipse@bmw.de",               title: "Chairman, Board of Management (CEO)" },
  { name: "Walter Mertl",           email: "walter.mertl@bmw.de",               title: "CFO, Finance" },
  { name: "Ilka Horstmeier",        email: "ilka.horstmeier@bmw.de",            title: "Board Member, People & Real Estate, Labour Relations Director" },
  { name: "Joachim Post",           email: "joachim.post@bmw.de",               title: "Board Member, Development" },
  { name: "Nicolai Martin",         email: "nicolai.martin@bmw.de",             title: "Board Member, Purchasing & Supplier Network" },
  { name: "Jochen Goller",          email: "jochen.goller@bmw.de",              title: "Board Member, Customer, Brands & Sales" },
  { name: "Milan Nedeljkovic",      email: "milan.nedeljkovic@bmw.de",          title: "Board Member, Production" },
  { name: "Raymond Wittmann",       email: "raymond.wittmann@bmw.de",           title: "Board Member (incoming), Production" },
  // Technology & Digital
  { name: "Franz Decker",           email: "franz.decker@bmw.de",               title: "CIO & Head of IT" },
  { name: "Alexander Buresch",      email: "alexander.buresch@bmw.de",          title: "Head, BMW Group Financial Services" },
  { name: "Stephan Durach",         email: "stephan.durach@bmw.de",             title: "SVP, Connected Company" },
  { name: "Pieter Nota",            email: "pieter.nota@bmw.de",                title: "Former Board Member, Customer (Senior Advisor)" },
  // BMW of North America
  { name: "Sebastian Mackensen",    email: "sebastian.mackensen@bmwna.com",     title: "President & CEO, BMW of North America" },
  { name: "Bernhard Kuhnt",         email: "bernhard.kuhnt@bmwna.com",          title: "Former President, BMW of North America (Senior Advisor)" },
  { name: "Shaun Bugbee",           email: "shaun.bugbee@bmwna.com",            title: "EVP, Operations, BMW of North America" },
  { name: "Uwe Dreher",             email: "uwe.dreher@bmwna.com",              title: "VP, Marketing, BMW of North America" },
  { name: "Bernhard Kuhnt",         email: "bernhard.kuhnt@bmwna.com",          title: "VP, Sales, BMW of North America" },
  // Design
  { name: "Adrian van Hooydonk",    email: "adrian.vanhooydonk@bmw.de",        title: "Senior VP, BMW Group Design" },
  { name: "Domagoj Dukec",          email: "domagoj.dukec@bmw.de",              title: "Head, BMW Design" },
  { name: "Oliver Heilmer",         email: "oliver.heilmer@bmw.de",             title: "Head, MINI Design" },
  // Motorsport & M Division
  { name: "Franciscus van Meel",    email: "franciscus.vanmeel@bmw.de",         title: "CEO, BMW M GmbH" },
  { name: "Andreas Roos",           email: "andreas.roos@bmw.de",               title: "Head, BMW Motorsport" },
  // Rolls-Royce
  { name: "Chris Brownridge",       email: "chris.brownridge@rolls-roycemotorcars.com", title: "CEO, Rolls-Royce Motor Cars" },
  // MINI
  { name: "Stefanie Wurst",         email: "stefanie.wurst@mini.de",            title: "Head, MINI" },
  // BMW Motorrad
  { name: "Markus Schramm",         email: "markus.schramm@bmw.de",             title: "Head, BMW Motorrad" },
  // Finance & Strategy
  { name: "Nicolas Peter",          email: "nicolas.peter@bmw.de",              title: "Chairman, Supervisory Board" },
  { name: "Norbert Reithofer",      email: "norbert.reithofer@bmw.de",          title: "Former Chairman (Senior Advisor)" },
  // Sustainability
  { name: "Thomas Becker",          email: "thomas.becker@bmw.de",              title: "Head, Sustainability & Mobility Affairs" },
  // Communications
  { name: "Maximilian Schoeberl",   email: "maximilian.schoeberl@bmw.de",       title: "Head, Corporate & Governmental Affairs" },
  { name: "Jens Thiemer",           email: "jens.thiemer@bmw.de",               title: "SVP, Customer & Brand BMW" },
  // Production
  { name: "Robert Engelhorn",       email: "robert.engelhorn@bmw.de",           title: "Head, Plant Spartanburg (USA)" },
  { name: "Peter Schwarzenbauer",   email: "peter.schwarzenbauer@bmw.de",       title: "Former Board Member (Senior Advisor)" },
  // Research & Development
  { name: "Frank Weber",            email: "frank.weber@bmw.de",                title: "Head, Development, BMW AG" },
  { name: "Markus Lienkamp",        email: "markus.lienkamp@bmw.de",            title: "Head, Autonomous Driving" },
  // Supply Chain
  { name: "Andreas Wendt",          email: "andreas.wendt@bmw.de",              title: "Former Board Member, Purchasing (Senior Advisor)" },
  // HR
  { name: "Ilka Horstmeier",        email: "hr@bmwgroup.com",                   title: "Head, Human Resources" },
  // Investor Relations
  { name: "BMW IR Team",            email: "investor-relations@bmwgroup.com",   title: "Head, Investor Relations" },
  // AI & Data
  { name: "BMW AI Lead",            email: "ai@bmwgroup.com",                   title: "Head, AI & Data Science" },
  // Innovation
  { name: "BMW Startup Garage",     email: "startup.garage@bmwgroup.com",       title: "Head, BMW Group Startup Garage" },
  // Partnerships
  { name: "BMW Partnerships",       email: "partnerships@bmwgroup.com",         title: "Head, Strategic Partnerships" },
  // Press
  { name: "BMW Press",              email: "presse@bmw.de",                     title: "Head, Corporate Communications" },
  // Electric Vehicles
  { name: "BMW EV Lead",            email: "electromobility@bmwgroup.com",      title: "Head, Electric Vehicle Programme" },
  // Software
  { name: "BMW Software Lead",      email: "software@bmwgroup.com",             title: "Head, Software-Defined Vehicle" },
  // Procurement
  { name: "BMW Procurement",        email: "procurement@bmwgroup.com",          title: "Head, Global Procurement" },
  // Customer Experience
  { name: "BMW CX Lead",            email: "customer.experience@bmwgroup.com",  title: "Head, Customer Experience" },
  // Fleet
  { name: "BMW Fleet",              email: "fleet@bmwgroup.com",                title: "Head, Fleet & Corporate Sales" },
  // Security
  { name: "BMW Security",           email: "cybersecurity@bmwgroup.com",        title: "Head, Cybersecurity" },
  // General
  { name: "BMW Executive Office",   email: "executive@bmwgroup.com",            title: "Executive Office" },
  // Legal
  { name: "BMW Legal",              email: "legal@bmwgroup.com",                title: "General Counsel" },
  // Strategy
  { name: "BMW Strategy",           email: "strategy@bmwgroup.com",             title: "Head, Corporate Strategy" },
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
<p>A few things that may be relevant to BMW Group:</p>
<ul>
  <li><strong>Strategic decision acceleration</strong> — compress weeks of market analysis into minutes for board-level decisions on product strategy, technology investment, market entry, and partnerships; every recommendation is fully auditable for governance and compliance</li>
  <li><strong>Neue Klasse & EV strategy intelligence</strong> — rapidly generate structured competitive analysis on the electric vehicle landscape, battery technology partnerships, and charging infrastructure positioning</li>
  <li><strong>Software-defined vehicle intelligence</strong> — multi-agent analysis of technology stack decisions, software partnerships, and autonomous driving competitive positioning in real time</li>
  <li><strong>Supply chain & procurement intelligence</strong> — AI-powered analysis of supplier risk, geopolitical exposure, and alternative sourcing strategies across the global BMW supplier network</li>
  <li><strong>Sales & customer intelligence</strong> — generate institutional-quality competitive intelligence on market positioning, customer experience benchmarks, and fleet sales strategy in minutes</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with BMW Group's technology roadmap, strategic planning, or operational intelligence programmes.</p>
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
  console.log("📧 Sending BMW Group review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — BMW Group] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO BMW GROUP — ${contacts.length} contacts`);
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
  console.log(`BMW GROUP: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
