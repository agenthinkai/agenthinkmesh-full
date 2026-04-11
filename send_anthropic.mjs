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

// Anthropic email format: flast@anthropic.com (75% — ContactOut confirmed)
const contacts = [
  // Co-Founders & C-Suite
  { name: "Dario Amodei",       email: "damodei@anthropic.com",       title: "CEO & Co-Founder" },
  { name: "Daniela Amodei",     email: "damodei2@anthropic.com",      title: "President & Co-Founder" },
  { name: "Mike Krieger",       email: "mkrieger@anthropic.com",      title: "Chief Product Officer" },
  { name: "Rahul Patil",        email: "rpatil@anthropic.com",        title: "Chief Technology Officer" },
  { name: "Jared Kaplan",       email: "jkaplan@anthropic.com",       title: "Chief Science Officer & Co-Founder" },
  { name: "Sam McCandlish",     email: "smccandlish@anthropic.com",   title: "Chief Architect & Co-Founder" },
  { name: "Tom Brown",          email: "tbrown@anthropic.com",        title: "Chief Compute Officer & Co-Founder" },
  { name: "Krishna Rao",        email: "krao@anthropic.com",          title: "Chief Financial Officer" },
  { name: "Vitaly Gudanets",    email: "vgudanets@anthropic.com",     title: "Chief Information Security Officer" },
  { name: "Jack Clark",         email: "jclark@anthropic.com",        title: "Head of Policy & Co-Founder" },
  // Research & Safety
  { name: "Jan Leike",          email: "jleike@anthropic.com",        title: "Alignment Science Lead" },
  { name: "Chris Olah",         email: "colah@anthropic.com",         title: "Research Scientist, Interpretability" },
  { name: "Zac Hatfield-Dodds", email: "zhatfielddodds@anthropic.com",title: "Head of Research" },
  { name: "Jason Clinton",      email: "jclinton@anthropic.com",      title: "Chief Information Security Officer (former)" },
  // Infrastructure & Engineering
  { name: "Eric Boyd",          email: "eboyd@anthropic.com",         title: "Head of Infrastructure (new hire from Microsoft)" },
  // Go-to-Market & BD
  { name: "Dave Hershfield",    email: "dhershfield@anthropic.com",   title: "Head of Enterprise" },
  { name: "Lindsay Mailer-Howat", email: "lmailerhowat@anthropic.com", title: "Chief People Officer" },
  // General contact channels
  { name: "Anthropic Enterprise", email: "enterprise@anthropic.com",  title: "Enterprise Sales" },
  { name: "Anthropic Partnerships", email: "partnerships@anthropic.com", title: "Strategic Partnerships" },
  { name: "Anthropic Press",    email: "press@anthropic.com",         title: "Communications" },
];

const SUBJECT = "35-page research memo in 4 minutes — multi-agent AI decision intelligence built on Claude";

function buildEmail(firstName) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 32px 24px; }
  p { margin: 0 0 16px 0; } ul { margin: 12px 0 20px 0; padding-left: 20px; } li { margin-bottom: 8px; }
  .signature { margin-top: 32px; border-top: 1px solid #e0e0e0; padding-top: 20px; font-size: 13px; color: #555; }
</style></head><body>
<p>Dear ${firstName},</p>
<p>I am writing to share <strong>AgenThinkMesh</strong> — an AI-native decision intelligence platform that produces a <strong>35-page institutional-grade strategic analysis memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel — built on top of <strong>Claude</strong>.</p>
<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes business decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>
<p>A few things that may be of interest from Anthropic's perspective:</p>
<ul>
  <li><strong>Claude as the backbone</strong> — AgenThinkMesh is a production deployment of Claude in a multi-agent orchestration architecture, demonstrating what is possible when Claude's reasoning capabilities are applied to high-stakes institutional decisions at scale</li>
  <li><strong>Constitutional AI in practice</strong> — the system's veto logic and auditability layer align naturally with Anthropic's safety and interpretability research agenda; every agent decision is traceable and explainable</li>
  <li><strong>Enterprise AI deployment case study</strong> — a concrete example of responsible, production-grade agentic AI deployment that could be relevant to Anthropic's enterprise go-to-market and Claude API partnerships</li>
  <li><strong>Alignment-first multi-agent design</strong> — the architecture was designed with human oversight at every layer, making it a natural reference implementation for Anthropic's research on safe agentic systems</li>
  <li><strong>GCC & emerging market expansion</strong> — active deployments across sovereign wealth funds, investment banks, and consulting firms in the Gulf region, a geography of strategic interest for Anthropic's international expansion</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Anthropic's research agenda, enterprise partnerships, or Claude API ecosystem.</p>
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
  console.log("📧 Sending Anthropic review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Anthropic] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO ANTHROPIC — ${contacts.length} contacts`);
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
  console.log(`ANTHROPIC: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
