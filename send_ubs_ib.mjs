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

// ── UBS INVESTMENT BANK & WEALTH — 40 contacts ───────────────────────────────
// Email format: first.last@ubs.com (confirmed via 10X EBITDA)
const contacts = [
  // Investment Bank — Global Banking & Markets
  { name: "David Soanes",             email: "david.soanes2@ubs.com",            title: "Head, Global Banking" },
  { name: "Bhanu Baweja",             email: "bhanu.baweja@ubs.com",             title: "Chief Strategist, Investment Bank" },
  { name: "Michael Vogt",             email: "michael.vogt@ubs.com",             title: "Head, Global Equities" },
  { name: "Suneel Bakhshi",           email: "suneel.bakhshi@ubs.com",           title: "Head, Global Markets" },
  { name: "Cormac Leech",             email: "cormac.leech@ubs.com",             title: "Head, Global Credit" },
  { name: "Ita Rahilly",              email: "ita.rahilly@ubs.com",              title: "Head, Global FX & Rates" },
  { name: "Tom Naratil",              email: "tom.naratil2@ubs.com",             title: "Head, UBS Americas (Former President)" },
  { name: "Matthew Carter",           email: "matthew.carter@ubs.com",           title: "Head, Global M&A" },
  { name: "Alejandro Przygoda",       email: "alejandro.przygoda@ubs.com",       title: "Head, Latin America" },
  { name: "Raj Dhanda",               email: "raj.dhanda@ubs.com",               title: "Head, Global Leveraged Finance" },
  // Wealth Management — Americas & US
  { name: "John Mathews",             email: "john.mathews@ubs.com",             title: "Head, Private Wealth Management Americas" },
  { name: "Mindy Rosenthal",          email: "mindy.rosenthal@ubs.com",          title: "Head, Institutional Consulting Americas" },
  { name: "Tracey Brophy Warson",     email: "tracey.brophywarson@ubs.com",      title: "Head, GWM US" },
  { name: "Gail Bernstein",           email: "gail.bernstein@ubs.com",           title: "General Counsel, GWM Americas" },
  { name: "Lisa Golia",               email: "lisa.golia@ubs.com",               title: "Head, GWM Field Americas" },
  { name: "Paul Saganey",             email: "paul.saganey@ubs.com",             title: "Head, Advisor Recruiting Americas" },
  { name: "Audrey Bommer",            email: "audrey.bommer@ubs.com",            title: "CAO, UBS Bank USA" },
  { name: "Joe Stroud",               email: "joe.stroud@ubs.com",               title: "General Counsel, UBS Bank USA" },
  // Global Wealth Management — Research & Strategy
  { name: "Paul Donovan",             email: "paul.donovan@ubs.com",             title: "Chief Economist, GWM" },
  { name: "Themis Themistocleous",    email: "themis.themistocleous@ubs.com",    title: "CIO, EMEA GWM" },
  { name: "Adrian Zuercher",          email: "adrian.zuercher@ubs.com",          title: "Head, Global Asset Allocation" },
  { name: "Evan Brown",               email: "evan.brown@ubs.com",               title: "Head, Multi-Asset Strategy" },
  { name: "Jason Draho",              email: "jason.draho@ubs.com",              title: "Head, Asset Allocation Americas" },
  { name: "Leslie Falconio",          email: "leslie.falconio@ubs.com",          title: "Head, Taxable Fixed Income Strategy Americas" },
  // Asset Management — US Focused
  { name: "Suni Harford",             email: "suni.harford@ubs.com",             title: "Former President, Asset Management (Advisor)" },
  { name: "Kiran Nandra",             email: "kiran.nandra@ubs.com",             title: "Head, Equities, Asset Management" },
  { name: "Wayne Gordon",             email: "wayne.gordon@ubs.com",             title: "Head, Commodities, Asset Management" },
  { name: "Cynthia Tobiano",          email: "cynthia.tobiano@ubs.com",          title: "Head, Fixed Income, Asset Management Americas" },
  // Technology & Digital Transformation
  { name: "Damien Lim",               email: "damien.lim@ubs.com",               title: "Head, Digital & Data, GWM" },
  { name: "Yves Longchamp",           email: "yves.longchamp@ubs.com",           title: "Head, Research, UBS Asset Management Switzerland" },
  // Sustainability & ESG
  { name: "Michael Baldinger",        email: "michael.baldinger@ubs.com",        title: "Head, Sustainable Finance" },
  { name: "Andrew Lee",               email: "andrew.lee@ubs.com",               title: "Head, Sustainable Investing, GWM Americas" },
  // Risk & Compliance
  { name: "Christian Bluhm",          email: "christian.bluhm@ubs.com",          title: "Former Group CRO (Advisor)" },
  { name: "Markus Ronner",            email: "markus.ronner@ubs.com",            title: "Group Chief Compliance & Governance Officer" },
  // Communications & IR
  { name: "Kirt Gardner",             email: "kirt.gardner@ubs.com",             title: "Former Group CFO (Advisor)" },
  { name: "Dominik von Arx",          email: "dominik.vonarx@ubs.com",           title: "Head, Group Communications" },
  { name: "Caroline Stewart",         email: "caroline.stewart@ubs.com",         title: "Head, Investor Relations" },
  // Additional Senior MDs
  { name: "Kelley Baccei",            email: "kelley.baccei@ubs.com",            title: "Head, Equity Capital Markets Americas" },
  { name: "Pam Finelli",              email: "pam.finelli@ubs.com",              title: "Head, Corporate Equity Derivatives" },
  { name: "Jonathan Steinberg",       email: "jonathan.steinberg@ubs.com",       title: "MD, Investment Bank Americas" },
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
  <li><strong>M&A and capital markets due diligence</strong> — the system is designed for the rigour of deal analysis; it can synthesise financial, competitive, and operational data into a structured IC-ready memo in minutes — directly relevant to UBS's investment banking and capital markets practice</li>
  <li><strong>Multi-agent council architecture</strong> — 10 specialist agents run simultaneously per analysis, each with independent reasoning and veto logic; the architecture mirrors the rigour of a senior investment committee review, but at machine speed</li>
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

  console.log("📧 Sending UBS IB/Wealth review copy to farouqsultan@gmail.com...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — UBS IB & Wealth] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO UBS IB & WEALTH — ${contacts.length} contacts`);
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
  console.log(`UBS IB & WEALTH: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
