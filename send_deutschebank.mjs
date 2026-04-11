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

// Email format: first.last@db.com (51.6% — Prospeo confirmed)
const contacts = [
  // Management Board
  { name: "Christian Sewing",          email: "christian.sewing@db.com",           title: "CEO" },
  { name: "James von Moltke",          email: "james.vonmoltke@db.com",            title: "President & Head of Asset Management" },
  { name: "Raja Akram",                email: "raja.akram@db.com",                 title: "CFO" },
  { name: "Fabrizio Campelli",         email: "fabrizio.campelli@db.com",          title: "Head of Corporate Bank & Investment Bank" },
  { name: "Marcus Chromik",            email: "marcus.chromik@db.com",             title: "Chief Risk Officer" },
  { name: "Bernd Leukert",             email: "bernd.leukert@db.com",              title: "Chief Technology, Data & Innovation Officer" },
  { name: "Alexander von zur Mühlen",  email: "alexander.vonzurmuehlen@db.com",    title: "CEO APAC, EMEA & Germany" },
  { name: "Laura Padovani",            email: "laura.padovani@db.com",             title: "Chief Compliance & Anti-Financial Crime Officer" },
  { name: "Claudio de Sanctis",        email: "claudio.desanctis@db.com",          title: "Head of Private Bank" },
  { name: "Rebecca Short",             email: "rebecca.short@db.com",              title: "Chief Operating Officer" },
  // New Board Appointments (2026)
  { name: "Marie-Jeanne Deverdun",     email: "marie-jeanne.deverdun@db.com",      title: "Management Board Member" },
  { name: "Stefan Hoops",              email: "stefan.hoops@db.com",               title: "Management Board Member" },
  // Investment Bank Senior Leadership
  { name: "Mark Fedorcik",             email: "mark.fedorcik@db.com",              title: "Co-Head, Investment Bank" },
  { name: "Ram Nayak",                 email: "ram.nayak@db.com",                  title: "Co-Head, Investment Bank" },
  { name: "Drew Goldman",              email: "drew.goldman@db.com",               title: "Head, Investment Banking Coverage & Advisory" },
  { name: "Ashok Aram",                email: "ashok.aram@db.com",                 title: "Head, Fixed Income & Currencies" },
  { name: "Karim Tabet",               email: "karim.tabet@db.com",                title: "Head, Leveraged Debt Capital Markets" },
  { name: "Berthold Fuerst",           email: "berthold.fuerst@db.com",            title: "Head, M&A Advisory" },
  { name: "Olivier Khayat",            email: "olivier.khayat@db.com",             title: "Head, EMEA Investment Banking" },
  { name: "Ted Bedell",                email: "ted.bedell@db.com",                 title: "Head, Americas Investment Banking" },
  // Corporate Bank
  { name: "David Lynne",               email: "david.lynne@db.com",                title: "Head, Corporate Bank" },
  { name: "Ole Matthiessen",           email: "ole.matthiessen@db.com",            title: "Head, Cash Management" },
  { name: "Daniel Schmand",            email: "daniel.schmand@db.com",             title: "Head, Trade Finance & Lending" },
  // Private Bank
  { name: "Philipp Gossow",            email: "philipp.gossow@db.com",             title: "Head, Private Bank Germany" },
  { name: "Claudio Barberis",          email: "claudio.barberis@db.com",           title: "Head, International Private Bank" },
  // DWS / Asset Management
  { name: "Stefan Hoops",              email: "stefan.hoops@dws.com",              title: "CEO, DWS Group" },
  { name: "Markus Kobler",             email: "markus.kobler@dws.com",             title: "CFO, DWS Group" },
  { name: "Vincenzo Vedda",            email: "vincenzo.vedda@dws.com",            title: "CIO, DWS Group" },
  { name: "Manfred Bauer",             email: "manfred.bauer@dws.com",             title: "Head, Passive Investments, DWS" },
  // Technology & Innovation
  { name: "Joerg Eigendorf",           email: "joerg.eigendorf@db.com",            title: "Chief Sustainability Officer & Head of Communications" },
  { name: "Nikolai Nowaczyk",          email: "nikolai.nowaczyk@db.com",           title: "Head, AI & Data Science" },
  { name: "Rainer Ostermeier",         email: "rainer.ostermeier@db.com",          title: "Head, Technology Architecture" },
  // Americas Leadership
  { name: "Tom Patrick",               email: "tom.patrick@db.com",                title: "Head, Americas" },
  { name: "Jeff Urwin",                email: "jeff.urwin@db.com",                 title: "Head, Americas Investment Banking" },
  // APAC Leadership
  { name: "Alexander von zur Mühlen",  email: "alexander.vonzurmuehlen@db.com",    title: "CEO Asia Pacific" },
  { name: "Kamran Khan",               email: "kamran.khan@db.com",                title: "Head, ESG Asia Pacific" },
  // Risk & Compliance
  { name: "Stuart Lewis",              email: "stuart.lewis@db.com",               title: "Former CRO (Senior Advisor)" },
  { name: "Christiana Riley",          email: "christiana.riley@db.com",           title: "Former CEO Americas (Senior Advisor)" },
  // Human Resources
  { name: "Sabine Miltner",            email: "sabine.miltner@db.com",             title: "Head, Human Resources" },
  // Communications & IR
  { name: "Ioana Patriniche",          email: "ioana.patriniche@db.com",           title: "Head, Investor Relations" },
  { name: "Torsten Riecke",            email: "torsten.riecke@db.com",             title: "Head, Media Relations" },
  // Supervisory Board (key members)
  { name: "Alexander Wynaendts",       email: "alexander.wynaendts@db.com",        title: "Chairman, Supervisory Board" },
  // Strategy
  { name: "Dixit Joshi",               email: "dixit.joshi@db.com",                title: "Former CFO (Senior Advisor)" },
  // Equity Research
  { name: "David Folkerts-Landau",     email: "david.folkerts-landau@db.com",      title: "Chief Economist & Head of Research" },
  { name: "Jim Reid",                  email: "jim.reid@db.com",                   title: "Head, Thematic Research & Credit Strategy" },
  // Wealth Management
  { name: "Maximilian Zimmerer",       email: "maximilian.zimmerer@db.com",        title: "Head, Wealth Management Germany" },
  { name: "Deepak Puri",               email: "deepak.puri@db.com",                title: "CIO, Wealth Management" },
  // Sustainability
  { name: "Jörg Eigendorf",            email: "joerg.eigendorf@db.com",            title: "Global Head, Sustainability" },
  // Legal
  { name: "Karl von Rohr",             email: "karl.vonrohr@db.com",               title: "Former President (Senior Advisor)" },
  // General Inquiries
  { name: "Deutsche Bank Executive",   email: "executive.office@db.com",           title: "Executive Office" },
];

const SUBJECT = "35-page IC memo in 4 minutes — AI decision intelligence for global banking";

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
<p>The system is a production-grade implementation of multi-agent AI for complex, high-stakes financial decisions: each agent operates as a specialist with independent scoring frameworks and veto logic, covering strategic analysis, competitive positioning, risk identification, financial modelling, and market assessment. A weighted consensus algorithm synthesises their outputs into a structured recommendation — with every agent vote, rationale, and confidence score logged and fully auditable.</p>
<p>A few things that may be relevant to Deutsche Bank:</p>
<ul>
  <li><strong>Investment banking deal intelligence</strong> — compress weeks of analyst research into minutes for M&amp;A advisory, leveraged finance, and capital markets transactions; every recommendation is fully auditable for compliance and regulatory review</li>
  <li><strong>Corporate bank client intelligence</strong> — rapidly generate structured analysis on corporate clients, sector dynamics, and credit risk across the global portfolio</li>
  <li><strong>Technology &amp; innovation alignment</strong> — AgenThinkMesh is a production deployment of the multi-agent AI architecture that Deutsche Bank's technology strategy is building toward; a natural partnership or pilot opportunity</li>
  <li><strong>Risk &amp; compliance auditability</strong> — the platform's full decision trail (every agent vote, confidence score, and rationale logged) is designed for regulated environments where explainability is non-negotiable</li>
  <li><strong>Wealth management &amp; private bank</strong> — generate institutional-quality investment memos for UHNW clients in minutes, elevating advisor productivity and client experience</li>
</ul>
<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live demonstration — and to explore whether there is a natural intersection with Deutsche Bank's technology roadmap, investment banking operations, or client intelligence programmes.</p>
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
  console.log("📧 Sending Deutsche Bank review copy...");
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW — Deutsche Bank] ${SUBJECT}`, buildEmail("Farouq"));
  console.log("✅ Review copy sent\n");
  await new Promise(r => setTimeout(r, 1000));

  console.log("─".repeat(60));
  console.log(`SENDING TO DEUTSCHE BANK — ${contacts.length} contacts`);
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
  console.log(`DEUTSCHE BANK: ${sent} sent, ${failed} failed out of ${contacts.length}`);
  console.log("═".repeat(60));
}

main().catch(console.error);
