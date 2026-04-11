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

// ── OPENAI CONTACTS — 30 people ───────────────────────────────────────────────
// Email format: firstname@openai.com (41%) or firstname.lastname@openai.com (88% per signalhire)
// Using firstname@openai.com as primary (most confirmed pattern for senior staff)
const openaiContacts = [
  { name: "Sam Altman",          email: "sam@openai.com",             title: "CEO & Co-Founder" },
  { name: "Greg Brockman",       email: "greg@openai.com",            title: "President & Co-Founder" },
  { name: "Brad Lightcap",       email: "brad@openai.com",            title: "Chief Operating Officer" },
  { name: "Sarah Friar",         email: "sarah@openai.com",           title: "Chief Financial Officer" },
  { name: "Fidji Simo",          email: "fidji@openai.com",           title: "CEO of Applications" },
  { name: "Mark Chen",           email: "mark@openai.com",            title: "Chief Research Officer" },
  { name: "Jakub Pachocki",      email: "jakub@openai.com",           title: "Chief Scientist" },
  { name: "Julia Villagra",      email: "julia@openai.com",           title: "Chief People Officer" },
  { name: "Chris Lehane",        email: "chris@openai.com",           title: "Chief Global Affairs Officer" },
  { name: "Kevin Weil",          email: "kevin@openai.com",           title: "Chief Product Officer" },
  { name: "Bret Taylor",         email: "bret@openai.com",            title: "Chairman, Board of Directors" },
  { name: "Maggie Hott",         email: "maggie@openai.com",          title: "VP, GTM & ChatGPT Enterprise" },
  { name: "Ashley Alexander",    email: "ashley@openai.com",          title: "VP, Health Products" },
  { name: "Peter Welinder",      email: "peter@openai.com",           title: "VP, Product & Partnerships" },
  { name: "Srinivas Narayanan",  email: "srinivas@openai.com",        title: "VP, Engineering" },
  { name: "Anna Makanju",        email: "anna@openai.com",            title: "VP, Global Affairs" },
  { name: "Zack Kass",           email: "zack@openai.com",            title: "Head of Go-to-Market" },
  { name: "Aliisa Rosenthal",    email: "aliisa@openai.com",          title: "VP, Sales" },
  { name: "Olivier Godement",    email: "olivier@openai.com",         title: "Head of Platform" },
  { name: "Dave Hershfield",     email: "dave@openai.com",            title: "Head of Enterprise" },
  { name: "Evan Morikawa",       email: "evan@openai.com",            title: "Head of Engineering, Applied" },
  { name: "Irina Kofman",        email: "irina@openai.com",           title: "Head of Product, Enterprise" },
  { name: "Gary Briggs",         email: "gary@openai.com",            title: "Senior Advisor, Marketing" },
  { name: "Adam D'Angelo",       email: "adam@openai.com",            title: "Board Director" },
  { name: "Nick Turley",         email: "nick@openai.com",            title: "Head of Product, ChatGPT" },
  { name: "Logan Kilpatrick",    email: "logan@openai.com",           title: "Head of Developer Relations" },
  { name: "Atty Eleti",          email: "atty@openai.com",            title: "Product Lead, API" },
  { name: "Michelle Pokrass",    email: "michelle@openai.com",        title: "Head of Partnerships" },
  { name: "Giambattista Amati",  email: "giambattista@openai.com",    title: "Head of Enterprise Sales, EMEA" },
  { name: "Leher Pathak",        email: "leher@openai.com",           title: "Head of Enterprise Sales, APAC" },
];

// ── SCALE AI CONTACTS — 30 people ────────────────────────────────────────────
// Email format: first@scale.com (75% dominant per contactout)
const scaleaiContacts = [
  { name: "Jason Droege",        email: "jason@scale.com",            title: "CEO (Interim)" },
  { name: "Alexandr Wang",       email: "alexandr@scale.com",         title: "Founder & Board Director" },
  { name: "Dennis Cinelli",      email: "dennis@scale.com",           title: "Chief Financial Officer" },
  { name: "Michael Kratsios",    email: "michael@scale.com",          title: "Managing Director" },
  { name: "Vijay Karunamurthy",  email: "vijay@scale.com",            title: "Field Chief Technology Officer" },
  { name: "Saeed Arafeh",        email: "saeed@scale.com",            title: "SVP, Operations" },
  { name: "Julio Bermudez",      email: "julio@scale.com",            title: "Global VP, GTM & Enterprise" },
  { name: "Brooke Peterson",     email: "brooke@scale.com",           title: "VP, Generative AI Accounts" },
  { name: "Daniel Berrios",      email: "daniel@scale.com",           title: "Head of Product, Model Evaluation" },
  { name: "Philip de Guzman",    email: "philip@scale.com",           title: "VP, Marketing" },
  { name: "Ashli Shiftan",       email: "ashli@scale.com",            title: "SVP, Head of People" },
  { name: "Ouliana Trofimenko",  email: "ouliana@scale.com",          title: "Global VP, Talent Acquisition" },
  { name: "Cora Foster",         email: "cora@scale.com",             title: "Chief Executive Officer, Scale Federal" },
  { name: "Lucy Guo",            email: "lucy@scale.com",             title: "Co-Founder" },
  { name: "Nat Friedman",        email: "nat@scale.com",              title: "Strategic Advisor" },
  { name: "Adam Coates",         email: "adam@scale.com",             title: "Chief AI Officer" },
  { name: "Eric Sheridan",       email: "eric@scale.com",             title: "Head of Research" },
  { name: "Mike Mignano",        email: "mike@scale.com",             title: "Head of Partnerships" },
  { name: "Ryan Sheridan",       email: "ryan@scale.com",             title: "Head of Enterprise Sales" },
  { name: "James Cham",          email: "james@scale.com",            title: "Head of Strategy" },
  { name: "Stephanie Zhan",      email: "stephanie@scale.com",        title: "Board Director (Sequoia)" },
  { name: "Elad Gil",            email: "elad@scale.com",             title: "Board Director" },
  { name: "Alex Wang",           email: "alex@scale.com",             title: "Head of Applied AI" },
  { name: "Kevin Quennesson",    email: "kevin@scale.com",            title: "Head of Product, Enterprise" },
  { name: "Sarah Catanzaro",     email: "sarah@scale.com",            title: "Head of ML Platform" },
  { name: "David Hershfield",    email: "david@scale.com",            title: "Head of Business Development" },
  { name: "Rishi Yadav",         email: "rishi@scale.com",            title: "Head of Enterprise, APAC" },
  { name: "Tom Simonite",        email: "tom@scale.com",              title: "Head of Communications" },
  { name: "Erin Egan",           email: "erin@scale.com",             title: "Chief Policy Officer" },
  { name: "Chris Sweeney",       email: "chris@scale.com",            title: "Head of Federal Partnerships" },
];

// ── Email templates ───────────────────────────────────────────────────────────
const OPENAI_SUBJECT = "35-page IC memo in 4 minutes — AI deal intelligence built on your models";

function buildOpenAIEmail(firstName) {
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

<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native investment intelligence platform that produces a <strong>35-page institutional-grade IC memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel — built on Claude and GPT-class models.</p>

<p>The system is designed for investment decision-making: each agent operates as a specialist covering financial modelling, sector dynamics, management assessment, competitive positioning, exit viability, and risk identification. A weighted consensus algorithm synthesises their votes into a structured investment recommendation.</p>

<p>A few things that may be relevant to OpenAI:</p>
<ul>
  <li><strong>A concrete enterprise use case for frontier models</strong> — this is a production deployment of LLM reasoning in a high-stakes, regulated workflow (investment committees)</li>
  <li><strong>Multi-agent orchestration at scale</strong> — 10 agents run in parallel per deal, each with independent prompts, scoring frameworks, and veto logic</li>
  <li><strong>Auditable by design</strong> — every agent vote, rationale, and confidence score is logged and exportable; no black-box outputs — a model for responsible AI deployment</li>
  <li><strong>Self-improving</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live run — the output quality may be of interest as a benchmark for applied LLM reasoning in enterprise contexts.</p>

<p>Would any time this week or next work for a brief call?</p>

<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>
  Founder, AgenThinkMesh<br>
  <a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>
  <a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a>
</div>
</body>
</html>`;
}

const SCALEAI_SUBJECT = "35-page IC memo in 4 minutes — AI deal intelligence, evaluation-ready";

function buildScaleAIEmail(firstName) {
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

<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native investment intelligence platform that produces a <strong>35-page institutional-grade IC memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>

<p>The system is designed for investment decision-making: each agent operates as a specialist covering financial modelling, sector dynamics, management assessment, competitive positioning, exit viability, and risk identification. A weighted consensus algorithm synthesises their votes into a structured investment recommendation.</p>

<p>A few things that may be relevant to Scale AI:</p>
<ul>
  <li><strong>A high-quality evaluation benchmark</strong> — each agent produces structured outputs (vote, confidence score, rationale, conditions, blockers) that are directly measurable against real-world investment outcomes — a natural fit for model evaluation workflows</li>
  <li><strong>Multi-agent orchestration in production</strong> — 10 agents run in parallel per deal, each with independent prompts, scoring frameworks, and veto logic; the architecture may be of interest as a case study in agentic system design</li>
  <li><strong>Auditable by design</strong> — every agent vote, rationale, and confidence score is logged and exportable; no black-box outputs</li>
  <li><strong>Self-improving</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes — a feedback loop that could benefit from Scale's data infrastructure</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live run — and to explore whether there is a natural intersection with Scale's enterprise or evaluation capabilities.</p>

<p>Would any time this week or next work for a brief call?</p>

<p>Warm regards,</p>
<div class="signature">
  <strong>Farouq Sultan</strong><br>
  Founder, AgenThinkMesh<br>
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
  console.log("📧 Sending OpenAI review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — OpenAI] ${OPENAI_SUBJECT}`, buildOpenAIEmail("Farouq"));
  console.log("✅ OpenAI review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  console.log("📧 Sending Scale AI review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Scale AI] ${SCALEAI_SUBJECT}`, buildScaleAIEmail("Farouq"));
  console.log("✅ Scale AI review copy sent\n");

  await new Promise(r => setTimeout(r, 1000));

  // ── Send OpenAI emails ──────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`SENDING TO OPENAI — ${openaiContacts.length} contacts`);
  console.log("─".repeat(60));
  let openaiSent = 0, openaiFailed = 0;
  for (let i = 0; i < openaiContacts.length; i++) {
    const { name, email, title } = openaiContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, OPENAI_SUBJECT, buildOpenAIEmail(firstName));
      console.log(`✅ [${i + 1}/${openaiContacts.length}] ${name} <${email}>`);
      openaiSent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${openaiContacts.length}] ${name} <${email}>: ${err.message}`);
      openaiFailed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\nOpenAI: ${openaiSent} sent, ${openaiFailed} failed\n`);

  // ── Send Scale AI emails ────────────────────────────────────────────────────
  console.log(`${"─".repeat(60)}`);
  console.log(`SENDING TO SCALE AI — ${scaleaiContacts.length} contacts`);
  console.log("─".repeat(60));
  let scaleSent = 0, scaleFailed = 0;
  for (let i = 0; i < scaleaiContacts.length; i++) {
    const { name, email, title } = scaleaiContacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SCALEAI_SUBJECT, buildScaleAIEmail(firstName));
      console.log(`✅ [${i + 1}/${scaleaiContacts.length}] ${name} <${email}>`);
      scaleSent++;
    } catch (err) {
      console.error(`❌ [${i + 1}/${scaleaiContacts.length}] ${name} <${email}>: ${err.message}`);
      scaleFailed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }
  console.log(`\nScale AI: ${scaleSent} sent, ${scaleFailed} failed\n`);

  console.log("═".repeat(60));
  console.log(`TOTAL: ${openaiSent + scaleSent} sent, ${openaiFailed + scaleFailed} failed out of ${openaiContacts.length + scaleaiContacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
