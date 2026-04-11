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

// Netflix email format: first.last@netflix.com (confirmed via RocketReach ~85%)
const contacts = [
  // Co-CEOs & Founder
  { name: "Ted Sarandos",          email: "ted.sarandos@netflix.com",          title: "Co-CEO" },
  { name: "Greg Peters",           email: "greg.peters@netflix.com",           title: "Co-CEO" },
  { name: "Reed Hastings",         email: "reed.hastings@netflix.com",         title: "Founder & Executive Chairman" },
  // C-Suite
  { name: "Spencer Neumann",       email: "spencer.neumann@netflix.com",       title: "Chief Financial Officer" },
  { name: "Bela Bajaria",          email: "bela.bajaria@netflix.com",          title: "Chief Content Officer" },
  { name: "Elizabeth Stone",       email: "elizabeth.stone@netflix.com",       title: "Chief Product & Technology Officer" },
  { name: "Marian Lee",            email: "marian.lee@netflix.com",            title: "Chief Marketing Officer" },
  { name: "David Hyman",           email: "david.hyman@netflix.com",           title: "Chief Legal Officer" },
  { name: "Sergio Ezama",          email: "sergio.ezama@netflix.com",          title: "Chief Talent Officer" },
  { name: "Dani Dudeck",           email: "dani.dudeck@netflix.com",           title: "Chief Communications Officer" },
  { name: "Clete Willems",         email: "clete.willems@netflix.com",         title: "Chief Global Affairs Officer" },
  { name: "Amy Reinhard",          email: "amy.reinhard@netflix.com",          title: "President, Advertising" },
  { name: "Alain Tascan",          email: "alain.tascan@netflix.com",          title: "President, Games" },
  { name: "Dan Lin",               email: "dan.lin@netflix.com",               title: "Chairman, Netflix Film" },
  // VP & Senior Leadership
  { name: "Maria Ferreras",        email: "maria.ferreras@netflix.com",        title: "Global Head of Partnerships" },
  { name: "Spencer Wang",          email: "spencer.wang@netflix.com",          title: "VP, Finance, IR & Corporate Development" },
  { name: "Wade Davis",            email: "wade.davis@netflix.com",            title: "VP, Inclusion Strategy" },
  { name: "Minyoung Kim",          email: "minyoung.kim@netflix.com",          title: "VP, Content, Asia ex-India" },
  { name: "Larry Tanz",            email: "larry.tanz@netflix.com",            title: "VP, Content, EMEA" },
  { name: "Francisco Ramos",       email: "francisco.ramos@netflix.com",       title: "VP, Latin American Content" },
  { name: "Pablo Perez De Rosso",  email: "pablo.perezderosso@netflix.com",    title: "CFO, EMEA" },
  // Technology & AI
  { name: "Justin Basilico",       email: "justin.basilico@netflix.com",       title: "Research & Engineering Director, ML" },
  { name: "Yves Raimond",          email: "yves.raimond@netflix.com",          title: "VP, ML Research" },
  { name: "Monika Henzinger",      email: "monika.henzinger@netflix.com",      title: "VP, Research" },
  { name: "Suresh Kumar",          email: "suresh.kumar@netflix.com",          title: "VP, Engineering" },
  // Business & Advertising
  { name: "Peter Naylor",          email: "peter.naylor@netflix.com",          title: "VP, Advertising Sales" },
  { name: "Jeremi Gorman",         email: "jeremi.gorman@netflix.com",         title: "President, Worldwide Advertising" },
  // Board
  { name: "Jay Hoag",              email: "jay.hoag@netflix.com",              title: "Board Director" },
  { name: "Ann Mather",            email: "ann.mather@netflix.com",            title: "Board Director" },
  { name: "Brad Smith",            email: "brad.smith@netflix.com",            title: "Board Director" },
];

const SUBJECT = "35-page strategic memo in 4 minutes — AI decision intelligence for media & entertainment";

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
<p>A few things that may be relevant to Netflix:</p>
<ul>
  <li><strong>Content strategy intelligence</strong> — rapidly generate structured competitive analysis on streaming content investments, genre performance, and global content market positioning across Disney+, Amazon Prime, Apple TV+, and regional players</li>
  <li><strong>Advertising market intelligence</strong> — multi-agent analysis of the connected TV advertising landscape, programmatic strategy, and advertiser category targeting opportunities as Netflix's ad tier scales</li>
  <li><strong>Games & interactive strategy</strong> — AI-powered analysis of the mobile gaming competitive landscape, studio acquisition strategy, and interactive content market positioning</li>
  <li><strong>Global market expansion</strong> — generate institutional-quality analysis of content localisation strategy, subscriber growth opportunities, and regulatory landscape across MENA, APAC, and emerging markets in minutes</li>
  <li><strong>Technology & ML strategy</strong> — multi-agent analysis of recommendation system competitive positioning, AI infrastructure decisions, and personalisation technology landscape</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Netflix's strategic planning, content investment, or technology intelligence programmes.</p>
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
  console.log("📧 Sending Netflix review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Netflix] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO NETFLIX — ${contacts.length} contacts`);
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
  console.log(`NETFLIX: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
