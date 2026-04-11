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

// Email format: first.last@blackrock.com (96.9% confirmed — AddToCRM & RocketReach)
const contacts = [
  // Global Executive Committee — Core
  { name: "Larry Fink",            email: "larry.fink@blackrock.com",            title: "Chairman & CEO" },
  { name: "Rob Kapito",            email: "rob.kapito@blackrock.com",            title: "President" },
  { name: "Rob Goldstein",         email: "rob.goldstein@blackrock.com",         title: "Chief Operating Officer" },
  { name: "Martin Small",          email: "martin.small@blackrock.com",          title: "Chief Financial Officer" },
  { name: "Chris Meade",           email: "chris.meade@blackrock.com",           title: "Chief Legal Officer" },
  { name: "Caroline Heller",       email: "caroline.heller@blackrock.com",       title: "Global Head of Human Resources" },
  { name: "Pierre Sarrau",         email: "pierre.sarrau@blackrock.com",         title: "Chief Risk Officer" },
  { name: "Derek Stein",           email: "derek.stein@blackrock.com",           title: "Global Head of Technology & Operations" },
  { name: "John Kelly",            email: "john.kelly@blackrock.com",            title: "Global Head of Corporate Affairs" },
  // Vice Chairmen & Senior Advisors
  { name: "Thomas Donilon",        email: "thomas.donilon@blackrock.com",        title: "Vice Chairman; Chairman, BlackRock Investment Institute" },
  { name: "Rob Fairbairn",         email: "rob.fairbairn@blackrock.com",         title: "Vice Chairman" },
  { name: "Philipp Hildebrand",    email: "philipp.hildebrand@blackrock.com",    title: "Vice Chairman" },
  { name: "Gary Shedlin",          email: "gary.shedlin@blackrock.com",          title: "Vice Chairman" },
  { name: "Adebayo Ogunlesi",      email: "adebayo.ogunlesi@blackrock.com",      title: "Chairman & CEO, Global Infrastructure Partners" },
  // Investment & Portfolio Management
  { name: "Rick Rieder",           email: "rick.rieder@blackrock.com",           title: "CIO, Global Fixed Income" },
  { name: "Alister Hibbert",       email: "alister.hibbert@blackrock.com",       title: "CIO, Strategic Equity Team" },
  { name: "J. Richard Kushel",     email: "richard.kushel@blackrock.com",        title: "Head, Portfolio Management Group" },
  { name: "Mike Pyle",             email: "mike.pyle@blackrock.com",             title: "Deputy Head, Portfolio Management Group" },
  { name: "Ryan Marshall",         email: "ryan.marshall@blackrock.com",         title: "Global Head, Multi-Asset Strategies & Solutions" },
  { name: "Raffaele Savi",         email: "raffaele.savi@blackrock.com",         title: "Global Head, BlackRock Systematic" },
  { name: "Samara Cohen",          email: "samara.cohen@blackrock.com",          title: "Global Head, Market Development" },
  { name: "Alex Claringbull",      email: "alex.claringbull@blackrock.com",      title: "Global Head, Index Investments" },
  { name: "Roland Villacorta",     email: "roland.villacorta@blackrock.com",     title: "Global Head, Liquidity & Financing" },
  // Client Business — Americas
  { name: "Joe DeVico",            email: "joe.devico@blackrock.com",            title: "Head, Americas Client Business" },
  { name: "Armando Senra",         email: "armando.senra@blackrock.com",         title: "Head, Americas Institutional Business" },
  { name: "Jaime Magyera",         email: "jaime.magyera@blackrock.com",         title: "Head, US Wealth Advisory & Retirement" },
  { name: "Jessica Tan",           email: "jessica.tan@blackrock.com",           title: "Head, Americas Global Product Solutions" },
  { name: "Ram Subramaniam",       email: "ram.subramaniam@blackrock.com",       title: "CMO & Global Head, Digital Wealth" },
  // Client Business — International
  { name: "Rachel Lord",           email: "rachel.lord@blackrock.com",           title: "Head, International" },
  { name: "Dominik Rohe",          email: "dominik.rohe@blackrock.com",          title: "Deputy Head, International; Global Head, Client Platform" },
  { name: "Susan Chan",            email: "susan.chan@blackrock.com",            title: "Head, Asia Pacific" },
  { name: "Andrew Landman",        email: "andrew.landman@blackrock.com",        title: "Deputy Head, Asia Pacific; Head, Asia Pacific Wealth" },
  { name: "Sarah Melvin",          email: "sarah.melvin@blackrock.com",          title: "Head, UK & Europe Client Business" },
  { name: "Jane Sloan",            email: "jane.sloan@blackrock.com",            title: "EMEA Head, Global Product Solutions" },
  { name: "Charles Hatami",        email: "charles.hatami@blackrock.com",        title: "Global Head, Financial & Strategic Investors; Head, Middle East" },
  // Technology — Aladdin
  { name: "Sudhir Nair",           email: "sudhir.nair@blackrock.com",           title: "Global Head, Aladdin" },
  { name: "Tarek Chouman",         email: "tarek.chouman@blackrock.com",         title: "Global Head, Aladdin Client Business" },
  { name: "Kunal Khara",           email: "kunal.khara@blackrock.com",           title: "Global Head, Aladdin Product" },
  { name: "Nish Ajitsaria",        email: "nish.ajitsaria@blackrock.com",        title: "Co-Head, Aladdin Product Engineering" },
  { name: "Ben Archibald",         email: "ben.archibald@blackrock.com",         title: "Co-Head, Aladdin Product Engineering" },
  // Private Markets — HPS & Infrastructure
  { name: "Scott Kapnick",         email: "scott.kapnick@blackrock.com",         title: "CEO, HPS Investment Partners" },
  { name: "Scot French",           email: "scot.french@blackrock.com",           title: "Co-President, HPS Investment Partners" },
  { name: "Michael Patterson",     email: "michael.patterson@blackrock.com",     title: "Co-President, HPS Investment Partners" },
  { name: "Michael McGhee",        email: "michael.mcghee@blackrock.com",        title: "Deputy Chairman, Global Infrastructure Partners" },
  { name: "Raj Rao",               email: "raj.rao@blackrock.com",               title: "President & COO, Global Infrastructure Partners" },
  // Operations & Legal
  { name: "Stacey Mullin",         email: "stacey.mullin@blackrock.com",         title: "Deputy COO" },
  { name: "John Perlowski",        email: "john.perlowski@blackrock.com",        title: "Head, Global Accounting & Product Services" },
  { name: "Joud Abdel Majeid",     email: "joud.abdelmajeid@blackrock.com",      title: "Co-Head, Global Partners Office" },
  { name: "Stephen Cohen",         email: "stephen.cohen@blackrock.com",         title: "Chief Product Officer" },
  { name: "Manish Mehta",          email: "manish.mehta@blackrock.com",          title: "Head, Global Markets & Index Investments" },
];

const SUBJECT = "35-page IC memo in 4 minutes — AI decision intelligence for asset management";

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
<p>A few things that may be relevant to BlackRock:</p>
<ul>
  <li><strong>Investment decision acceleration</strong> — the platform compresses weeks of research and synthesis into minutes, producing structured, evidence-backed memos; directly applicable to BlackRock's portfolio management, multi-asset strategy, and fixed income research processes</li>
  <li><strong>Aladdin complement</strong> — while Aladdin excels at risk analytics and portfolio construction, AgenThinkMesh adds a structured decision intelligence layer on top: synthesising market intelligence, competitive analysis, and strategic context into a structured IC-ready memo in minutes — a natural complement to BlackRock's existing technology infrastructure</li>
  <li><strong>Wealth advisory intelligence</strong> — the multi-agent council architecture can synthesise client portfolio data, market intelligence, and risk parameters into structured client-ready memos in minutes; a force multiplier for BlackRock's US Wealth Advisory and digital wealth teams</li>
  <li><strong>Private markets due diligence</strong> — the system is designed for the rigour of PE, infrastructure, and credit deal analysis; directly relevant to BlackRock's HPS, GIP, and private markets platforms</li>
  <li><strong>Auditable AI for institutional reporting</strong> — every agent vote, rationale, and confidence score is logged; the system produces a full audit trail for institutional client reporting and investment governance</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with BlackRock's investment operations, Aladdin ecosystem, or client reporting infrastructure.</p>
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
  console.log("📧 Sending BlackRock review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — BlackRock] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO BLACKROCK — ${contacts.length} contacts`);
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
  console.log(`BLACKROCK: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
