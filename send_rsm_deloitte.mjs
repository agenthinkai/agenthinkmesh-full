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

// ── RSM USA CONTACTS — 40 people ─────────────────────────────────────────────
// Email format: first.last@rsmus.com (97% — LeadIQ confirmed)
const rsmContacts = [
  // Firm Leadership (from rsmus.com/about/leadership.html)
  { name: "Brian Becker",            email: "brian.becker@rsmus.com",           title: "Managing Partner & CEO" },
  { name: "Sam Mascareno",           email: "sam.mascareno@rsmus.com",          title: "Chief Operating Officer" },
  { name: "Jiten Shah",              email: "jiten.shah@rsmus.com",             title: "Chief Financial Officer" },
  { name: "Ty Beasley",              email: "ty.beasley@rsmus.com",             title: "Chief Talent Officer" },
  { name: "Donna Sciarappa",         email: "donna.sciarappa@rsmus.com",        title: "Enterprise Client Experience Leader" },
  { name: "Brandon Rucker",          email: "brandon.rucker@rsmus.com",         title: "Enterprise Assurance Leader" },
  { name: "Patrick Vance",           email: "patrick.vance@rsmus.com",          title: "Consulting Leader" },
  { name: "Tony Urban",              email: "tony.urban@rsmus.com",             title: "Tax Leader" },
  { name: "Sergio de la Fe",         email: "sergio.delafe@rsmus.com",          title: "Enterprise Digital Leader" },
  { name: "Maria Severino",          email: "maria.severino@rsmus.com",         title: "Enterprise Tax Growth & Industry Leader" },
  { name: "Don Lipari",              email: "don.lipari@rsmus.com",             title: "Private Equity Leader & Enterprise Channels Leader" },
  { name: "Stuart Taub",             email: "stuart.taub@rsmus.com",            title: "Enterprise Industry Leader & Enterprise Markets Leader" },
  { name: "John Brackett",           email: "john.brackett@rsmus.com",          title: "Chief Risk Officer" },
  { name: "Joseph Taiano",           email: "joseph.taiano@rsmus.com",          title: "Chief Marketing Officer" },
  { name: "Rod Reimann",             email: "rod.reimann@rsmus.com",            title: "Enterprise Sales Leader" },
  { name: "Sara Webber Laczo",       email: "sara.webberlaczo@rsmus.com",       title: "Chief Communications Officer" },
  { name: "Tom Ferreira",            email: "tom.ferreira@rsmus.com",           title: "Chief Global Officer" },
  { name: "Ericka Foster",           email: "ericka.foster@rsmus.com",          title: "General Counsel" },
  { name: "Ashokkumar Prabhakar",    email: "ashokkumar.prabhakar@rsmus.com",   title: "India Leader" },
  // RSM Technology & AI Practice Leaders
  { name: "Marc Tanowitz",           email: "marc.tanowitz@rsmus.com",          title: "Managing Director, Technology Consulting" },
  { name: "Chris Dobrec",            email: "chris.dobrec@rsmus.com",           title: "Managing Director, AI & Analytics" },
  { name: "David Moise",             email: "david.moise@rsmus.com",            title: "Managing Director, Digital Transformation" },
  { name: "Tauseef Charanya",        email: "tauseef.charanya@rsmus.com",       title: "Managing Director, Data & Analytics" },
  // RSM Financial Services Practice
  { name: "Tim Hogan",               email: "tim.hogan@rsmus.com",              title: "Financial Services Practice Leader" },
  { name: "Shari Mager",             email: "shari.mager@rsmus.com",            title: "Managing Director, Financial Services" },
  // RSM Private Equity Practice
  { name: "Dustin Minton",           email: "dustin.minton@rsmus.com",          title: "Managing Director, Private Equity" },
  { name: "Chris Guttuso",           email: "chris.guttuso@rsmus.com",          title: "Managing Director, Transaction Advisory" },
  // RSM Real Estate Practice
  { name: "Ken Weissenberg",         email: "ken.weissenberg@rsmus.com",        title: "Real Estate Practice Leader" },
  // RSM Healthcare Practice
  { name: "Russ Graney",             email: "russ.graney@rsmus.com",            title: "Healthcare Practice Leader" },
  // RSM Government & Public Sector
  { name: "Deborah Harrington",      email: "deborah.harrington@rsmus.com",     title: "Government & Public Sector Leader" },
  // RSM Manufacturing Practice
  { name: "Brian Blaha",             email: "brian.blaha@rsmus.com",            title: "Manufacturing Practice Leader" },
  // RSM Consumer Products
  { name: "Erin Sheridan",           email: "erin.sheridan@rsmus.com",          title: "Consumer Products Practice Leader" },
  // RSM Technology Industry
  { name: "Tauseef Ahmed",           email: "tauseef.ahmed@rsmus.com",          title: "Technology Industry Leader" },
  // RSM Life Sciences
  { name: "Michael Varney",          email: "michael.varney@rsmus.com",         title: "Life Sciences Practice Leader" },
  // RSM Nonprofit
  { name: "Laurie De Armond",        email: "laurie.dearmond@rsmus.com",        title: "Nonprofit Practice Leader" },
  // RSM International Leadership
  { name: "Jean Stephens",           email: "jean.stephens@rsmglobal.com",      title: "CEO, RSM International" },
  // RSM Regional Managing Partners
  { name: "Mark Koziel",             email: "mark.koziel@rsmus.com",            title: "Managing Director, Professional Standards" },
  { name: "Bill Gorman",             email: "bill.gorman@rsmus.com",            title: "Former COO; Senior Partner" },
  { name: "Andy Bosman",             email: "andy.bosman@rsmus.com",            title: "Chief Marketing Officer (outgoing)" },
  { name: "Daniel O'Brien",          email: "daniel.obrien@rsmus.com",          title: "Chief Digital Officer" },
];

// ── DELOITTE USA CONTACTS — 40 people ────────────────────────────────────────
// Email format: flast@deloitte.com (54.8% — RocketReach confirmed)
// Secondary: first.last@deloitte.com (also used)
const deloitteContacts = [
  // US Leadership
  { name: "Jason Girzadas",          email: "jgirzadas@deloitte.com",           title: "US Chief Executive Officer" },
  { name: "Lara Abrash",             email: "labrash@deloitte.com",             title: "US Chair" },
  { name: "Jason Salzetti",          email: "jsalzetti@deloitte.com",           title: "Chair & CEO, Deloitte Consulting LLP" },
  // Board of Directors
  { name: "Ambar Chowdhury",         email: "achowdhury@deloitte.com",          title: "Board Member, Deloitte Consulting LLP" },
  { name: "Betsy Evans",             email: "bevans@deloitte.com",              title: "Board Member, Deloitte Tax LLP" },
  { name: "China Widener",           email: "cwidener@deloitte.com",            title: "Board Member, Deloitte Consulting LLP" },
  { name: "Chuck Kosal",             email: "ckosal@deloitte.com",              title: "Board Member, Deloitte Tax LLP" },
  { name: "Dan Mueller",             email: "dmueller@deloitte.com",            title: "Board Member, Deloitte Tax LLP" },
  { name: "Ed Hardy",                email: "ehardy@deloitte.com",              title: "Board Member, Deloitte & Touche LLP" },
  { name: "George Fackler",          email: "gfackler@deloitte.com",            title: "Board Member, Deloitte & Touche LLP" },
  { name: "Jason Downing",           email: "jdowning@deloitte.com",            title: "Board Member, Deloitte Consulting LLP" },
  { name: "John Zamora",             email: "jzamora@deloitte.com",             title: "Board Member, Deloitte & Touche LLP" },
  { name: "Kathleen Purtill",        email: "kpurtill@deloitte.com",            title: "Board Member, Deloitte Consulting LLP" },
  { name: "Kim Griffin-Hunter",      email: "kgriffinhunter@deloitte.com",      title: "Board Member, Deloitte & Touche LLP" },
  { name: "Krissy Davis",            email: "kdavis@deloitte.com",              title: "Board Member, Deloitte & Touche LLP" },
  { name: "Kulleni Gebreyes",        email: "kgebreyes@deloitte.com",           title: "Board Member, Deloitte Consulting LLP" },
  { name: "Marty DiMarzio",          email: "mdimarzio@deloitte.com",           title: "Board Member, Deloitte Consulting LLP" },
  { name: "Matt Wangard",            email: "mwangard@deloitte.com",            title: "Board Member, Deloitte & Touche LLP" },
  { name: "Trevor Barton",           email: "tbarton@deloitte.com",             title: "Board Member, Deloitte & Touche LLP" },
  // Deloitte AI & Technology Practice
  { name: "Beena Ammanath",          email: "bammanath@deloitte.com",           title: "Global Head of Deloitte AI Institute" },
  { name: "Nitin Mittal",            email: "nmittal@deloitte.com",             title: "US AI & Data Leader" },
  { name: "Deborah Golden",          email: "dgolden@deloitte.com",             title: "US Cyber & Strategic Risk Leader" },
  { name: "Bill Briggs",             email: "bbriggs@deloitte.com",             title: "Global CTO, Deloitte Consulting" },
  { name: "Scott Buchholz",          email: "sbuchholz@deloitte.com",           title: "CTO, Government & Public Services" },
  // Deloitte Consulting Practice Leaders
  { name: "Janet Foutty",            email: "jfoutty@deloitte.com",             title: "Former Chair, Deloitte Consulting; Senior Advisor" },
  { name: "Cathy Engelbert",         email: "cengelbert@deloitte.com",          title: "Former CEO Deloitte US; Commissioner WNBA" },
  { name: "Dan Helfrich",            email: "dhelfrich@deloitte.com",           title: "Former Chair & CEO, Deloitte Consulting" },
  // Deloitte Financial Advisory
  { name: "Steve Kimble",            email: "skimble@deloitte.com",             title: "Chair & CEO, Deloitte Financial Advisory Services" },
  // Deloitte Tax
  { name: "Evan Migdail",            email: "emigdail@deloitte.com",            title: "Managing Director, Tax Policy" },
  // Deloitte Digital
  { name: "Mike Bechtel",            email: "mbechtel@deloitte.com",            title: "Chief Futurist, Deloitte Consulting" },
  // Deloitte Private Equity
  { name: "Jennifer Lee",            email: "jlee@deloitte.com",                title: "US Private Equity Leader" },
  // Deloitte Financial Services
  { name: "Rob Contri",              email: "rcontri@deloitte.com",             title: "Global Financial Services Industry Leader" },
  // Deloitte Life Sciences & Healthcare
  { name: "Diana Dearborn",          email: "ddearborn@deloitte.com",           title: "Life Sciences & Healthcare Leader" },
  // Deloitte Government & Public Services
  { name: "David Heyman",            email: "dheyman@deloitte.com",             title: "Government & Public Services Leader" },
  // Deloitte Human Capital
  { name: "Erica Volini",            email: "evolini@deloitte.com",             title: "Global Human Capital Leader" },
  // Deloitte Strategy & Analytics
  { name: "Tom Davenport",           email: "tdavenport@deloitte.com",          title: "Senior Advisor, Analytics & AI" },
  // Deloitte Sustainability
  { name: "Kristen Sullivan",        email: "ksullivan@deloitte.com",           title: "Global Sustainability & Climate Leader" },
  // Deloitte Risk Advisory
  { name: "Mark Pearson",            email: "mpearson@deloitte.com",            title: "US Risk & Financial Advisory Leader" },
  // Deloitte M&A
  { name: "Russell Thomson",         email: "rthomson@deloitte.com",            title: "Global M&A and Restructuring Leader" },
  // Deloitte Ventures
  { name: "Ainar Aijala",            email: "aaijala@deloitte.com",             title: "Managing Director, Deloitte Ventures" },
];

// ── Email templates ───────────────────────────────────────────────────────────
const RSM_SUBJECT = "35-page strategy memo in 4 minutes — AI decision intelligence for the middle market";
const DELOITTE_SUBJECT = "35-page strategy memo in 4 minutes — AI decision intelligence for professional services";

function buildRSMEmail(firstName) {
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

<p>A few things that may be relevant to RSM:</p>
<ul>
  <li><strong>Middle market focus</strong> — the platform is purpose-built for the speed and analytical depth that middle market clients demand; it compresses the research and synthesis phase of complex advisory engagements from weeks to minutes, producing structured, evidence-backed memos that mirror the quality of senior consulting output</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; a live production case study in applied agentic AI that goes beyond current LLM deployments</li>
  <li><strong>Private equity & transaction advisory</strong> — the system can run full due diligence memos in minutes, covering financial risk, competitive dynamics, management quality, and market sizing — directly applicable to RSM's PE and transaction advisory practice</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns continuously from historical decision data</li>
  <li><strong>Auditable by design</strong> — no black-box outputs; every agent decision is logged and explainable — a model for responsible AI deployment that aligns with RSM's commitment to quality and integrity</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with RSM's consulting, assurance, or transaction advisory practice.</p>

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

function buildDeloitteEmail(firstName) {
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

<p>A few things that may be relevant to Deloitte:</p>
<ul>
  <li><strong>AI-accelerated professional services</strong> — the platform compresses the research and synthesis phase of complex advisory engagements from weeks to minutes, producing structured, evidence-backed memos that mirror the quality of senior consulting output — directly relevant to Deloitte's AI practice and consulting delivery model</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; a live production case study in applied agentic AI that goes beyond current LLM deployments and aligns with Deloitte's AI Institute research agenda</li>
  <li><strong>Self-improving system</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes; the architecture learns continuously from historical decision data</li>
  <li><strong>Auditable by design</strong> — no black-box outputs; every agent decision is logged and explainable — a model for responsible AI deployment aligned with Deloitte's approach to trustworthy AI and its work with the AI Institute</li>
  <li><strong>Client application</strong> — the platform could serve as a force multiplier for Deloitte's client engagements in financial services, private equity, strategy, and digital transformation — accelerating due diligence, market entry analysis, and operational benchmarking at scale</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Deloitte's AI practice, consulting delivery, or client service model.</p>

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

  // Send review copies first
  console.log("📧 Sending RSM review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — RSM USA] ${RSM_SUBJECT}`, buildRSMEmail("Farouq"));
  console.log("✅ RSM review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("📧 Sending Deloitte review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Deloitte USA] ${DELOITTE_SUBJECT}`, buildDeloitteEmail("Farouq"));
  console.log("✅ Deloitte review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  // ── Send RSM ────────────────────────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO RSM USA — ${rsmContacts.length} contacts`);
  console.log("─".repeat(60));
  let rsmSent = 0, rsmFailed = 0;
  for (let i = 0; i < rsmContacts.length; i++) {
    const { name, email, title } = rsmContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, RSM_SUBJECT, buildRSMEmail(firstName));
      console.log(`✅ [${i + 1}/${rsmContacts.length}] ${name} <${email}>`);
      rsmSent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${rsmContacts.length}] ${name} <${email}>: ${err.message}`);
      rsmFailed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n${"═".repeat(60)}`);
  console.log(`RSM USA: ${rsmSent} sent, ${rsmFailed} failed out of ${rsmContacts.length}`);
  console.log("═".repeat(60) + "\n");

  await new Promise(r => setTimeout(r, 2000));

  // ── Send Deloitte ───────────────────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO DELOITTE USA — ${deloitteContacts.length} contacts`);
  console.log("─".repeat(60));
  let dlSent = 0, dlFailed = 0;
  for (let i = 0; i < deloitteContacts.length; i++) {
    const { name, email, title } = deloitteContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, DELOITTE_SUBJECT, buildDeloitteEmail(firstName));
      console.log(`✅ [${i + 1}/${deloitteContacts.length}] ${name} <${email}>`);
      dlSent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${deloitteContacts.length}] ${name} <${email}>: ${err.message}`);
      dlFailed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\n${"═".repeat(60)}`);
  console.log(`DELOITTE USA: ${dlSent} sent, ${dlFailed} failed out of ${deloitteContacts.length}`);
  console.log("═".repeat(60));

  console.log(`\n🎯 TOTAL: ${rsmSent + dlSent} sent, ${rsmFailed + dlFailed} failed out of ${rsmContacts.length + deloitteContacts.length}`);
}

main().catch(console.error);
