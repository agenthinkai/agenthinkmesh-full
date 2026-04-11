import "dotenv/config";

// ── Microsoft Graph API credentials ──────────────────────────────────────────
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const TENANT_ID = process.env.MS_TENANT_ID;
const SENDER_EMAIL = "farouq@agenthink.ai";

// ── Get access token ──────────────────────────────────────────────────────────
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

// ── Send email via Graph API ──────────────────────────────────────────────────
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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Send failed for ${to}: ${err}`);
  }
}

// ── Court Square Capital Partners — 20 investment professionals ───────────────
// Email format: flast@courtsquare.com (86% dominant)
const contacts = [
  { name: "Christopher Bloise",  email: "cbloise@courtsquare.com",    title: "President & Managing Partner" },
  { name: "Joseph Silvestri",    email: "jsilvestri@courtsquare.com",  title: "Co-Founder, Managing Partner & Head of Industrials" },
  { name: "Michael Delaney",     email: "mdelaney@courtsquare.com",    title: "Co-Founder, Senior Partner & Co-Head of Business Services" },
  { name: "David Thomas",        email: "dthomas@courtsquare.com",     title: "Co-Founder & Senior Partner" },
  { name: "Kevin White",         email: "kwhite@courtsquare.com",      title: "Managing Partner & Co-Head of Business Services" },
  { name: "Ian Highet",          email: "ihighet@courtsquare.com",     title: "Managing Partner" },
  { name: "Jeffrey Vogel",       email: "jvogel@courtsquare.com",      title: "Managing Partner & Head of Tech & Telecom" },
  { name: "David Nguyen",        email: "dnguyen@courtsquare.com",     title: "Managing Partner & Co-Head of Healthcare" },
  { name: "John Weber",          email: "jweber@courtsquare.com",      title: "Managing Partner & Co-Head of Healthcare" },
  { name: "Jeffrey Abramoff",    email: "jabramoff@courtsquare.com",   title: "Partner" },
  { name: "Shane McGregor",      email: "smcgregor@courtsquare.com",   title: "Partner" },
  { name: "Matthew Dennett",     email: "mdennett@courtsquare.com",    title: "Partner" },
  { name: "Vivek Vyas",          email: "vvyas@courtsquare.com",       title: "Partner" },
  { name: "Richard Walsh",       email: "rwalsh@courtsquare.com",      title: "Partner" },
  { name: "Laura Humphrey",      email: "lhumphreys@courtsquare.com",  title: "Principal" },
  { name: "Zachary Packer",      email: "zpacker@courtsquare.com",     title: "Principal" },
  { name: "Brian Schmidt",       email: "bschmidt@courtsquare.com",    title: "Principal" },
  { name: "Kyle Schnack",        email: "kschnack@courtsquare.com",    title: "Principal" },
  { name: "Alan Wayne",          email: "awayne@courtsquare.com",      title: "Principal" },
  { name: "Christopher Porter",  email: "cporter@courtsquare.com",     title: "Head of Business Development" },
];

// ── Email content ─────────────────────────────────────────────────────────────
const SUBJECT = "35-page IC memo in 4 minutes — AI deal intelligence for private equity";

function buildEmailHtml(firstName) {
  return `
<!DOCTYPE html>
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
  .cta { display: inline-block; margin: 20px 0; padding: 12px 24px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px; font-family: Arial, sans-serif; }
</style>
</head>
<body>

<p>Dear ${firstName},</p>

<p>I am writing to introduce <strong>AgenThinkMesh</strong> — an AI-native investment intelligence platform that produces a <strong>35-page institutional-grade IC memo in under 4 minutes</strong>, powered by a council of 10 independent AI agents running in parallel.</p>

<p>Each agent operates as a specialist — covering financial modelling, sector dynamics, management assessment, competitive positioning, exit viability, and risk identification — before a weighted consensus algorithm synthesises their votes into a structured investment recommendation.</p>

<p>A few things that may be relevant to Court Square:</p>

<ul>
  <li><strong>Built for private equity workflows</strong> — the output maps directly to IC memo structure: thesis, risk matrix, conditions to proceed, and blocking issues</li>
  <li><strong>Handles messy deal flow</strong> — accepts CIMs, teasers, financial models, and raw deal descriptions; normalises and extracts structured data automatically</li>
  <li><strong>Auditable by design</strong> — every agent vote, rationale, and confidence score is logged and exportable; no black-box outputs</li>
  <li><strong>Self-improving</strong> — agent authority weights adjust over time based on which agents' past recommendations matched real-world outcomes</li>
</ul>

<p>The system is live and in active use. I would welcome 20 minutes to walk you through a live run on a deal from your current pipeline — no preparation required on your end.</p>

<p>Would any time this week or next work for a brief call?</p>

<p>Warm regards,</p>

<div class="signature">
  <strong>Farouq Sultan</strong><br>
  Founder, AgenThinkMesh<br>
  <a href="mailto:farouq@agenthink.ai">farouq@agenthink.ai</a><br>
  <a href="https://agenthink-7enctkan.manus.space">agenthink-7enctkan.manus.space</a>
</div>

</body>
</html>
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Authenticating with Microsoft Graph...");
  const token = await getAccessToken();
  console.log("✅ Token obtained");

  // Send review copy first
  console.log("📧 Sending review copy to farouqsultan@gmail.com...");
  const firstName0 = "Farouq";
  await sendEmail(token, "farouqsultan@gmail.com", "Farouq Sultan", `[REVIEW COPY] ${SUBJECT}`, buildEmailHtml(firstName0));
  console.log("✅ Review copy sent to farouqsultan@gmail.com");

  console.log(`Sending to ${contacts.length} Court Square Capital Partners contacts...`);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    const { name, email, title } = contacts[i];
    const firstName = name.split(" ")[0];
    try {
      await sendEmail(token, email, name, SUBJECT, buildEmailHtml(firstName));
      console.log(`✅ [${i + 1}/${contacts.length}] Sent → ${name} <${email}>`);
      sent++;
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.error(`❌ [${i + 1}/${contacts.length}] Failed → ${name} <${email}>: ${err.message}`);
      failed++;
    }
  }

  console.log("─".repeat(60));
  console.log(`COMPLETE: ${sent} sent, ${failed} failed out of ${contacts.length} total`);
  console.log("─".repeat(60));
}

main().catch(console.error);
