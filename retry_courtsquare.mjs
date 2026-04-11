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

const SUBJECT = "35-page IC memo in 4 minutes — AI deal intelligence for private equity";

const htmlBody = `
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
</style>
</head>
<body>
<p>Dear Shane,</p>
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

async function main() {
  console.log("Authenticating...");
  const token = await getAccessToken();
  console.log("✅ Token obtained");

  const name = "Shane McGregor";
  const email = "smcgregor@courtsquare.com";

  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      await sendEmail(token, email, name, SUBJECT, htmlBody);
      console.log(`✅ Sent → ${name} <${email}> (attempt ${attempts})`);
      break;
    } catch (err) {
      console.error(`❌ Attempt ${attempts} failed: ${err.message}`);
      if (attempts < 3) {
        console.log("Retrying in 5 seconds...");
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

main().catch(console.error);
