import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const TENANT_ID     = process.env.MS_TENANT_ID     || "4e3c81c1-6864-4c56-af1b-30a2f16f84d4";
const CLIENT_ID     = process.env.MS_CLIENT_ID     || "1513f312-7259-4e67-b81d-5846d4d96c74";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const MAILBOX = "farouq@agenthink.ai";

// Get access token
async function getToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("Token error: " + JSON.stringify(data));
  console.log("[Auth] Token obtained.");
  return data.access_token;
}

// Strip HTML tags from body
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Extract bounced email address from NDR body
function extractBouncedEmail(subject, bodyText) {
  // Try to extract from body text: "Your message to xxx@yyy couldn't be delivered"
  const bodyMatch = bodyText.match(/Your message to\s+([\w.+\-]+@[\w.\-]+\.\w+)/i);
  if (bodyMatch) return bodyMatch[1].toLowerCase();

  // Try subject: "Undeliverable: ... | Company Name" — use subject to find company
  // Try to find email pattern anywhere in body
  const emailMatch = bodyText.match(/([\w.+\-]+@[\w.\-]+\.\w+)/);
  if (emailMatch && !emailMatch[1].includes("microsoft") && !emailMatch[1].includes("agenthink")) {
    return emailMatch[1].toLowerCase();
  }

  return null;
}

// Extract original subject from NDR body
function extractOriginalSubject(bodyText) {
  const match = bodyText.match(/Subject:\s*(.+?)(?:\n|$)/i);
  if (match) return match[1].trim();
  // Try to find "AgenThink" subject pattern
  const subjectMatch = bodyText.match(/(AgenThink[^\n\r]+)/i);
  if (subjectMatch) return subjectMatch[1].trim();
  return "AgenThink — 35-page IC memo in 4 minutes";
}

// Extract original email body from NDR
function extractOriginalBody(bodyText) {
  // NDR bodies contain the original message after "Original Message" or "-----"
  const separators = [
    /[-]{3,}\s*Original Message\s*[-]{3,}/i,
    /[-]{3,}\s*Forwarded Message\s*[-]{3,}/i,
    /Original Message Header/i,
    /Message Headers/i,
  ];
  for (const sep of separators) {
    const idx = bodyText.search(sep);
    if (idx > -1) {
      return bodyText.substring(idx).substring(0, 2000).trim();
    }
  }
  // Return first 500 chars of body as fallback
  return bodyText.substring(0, 500).trim();
}

async function main() {
  const token = await getToken();

  const allMessages = [];
  // Filter: NDRs from today's resend only (after 07:00 UTC Apr 6 2026)
  const filterQuery = encodeURIComponent(
    "contains(subject,'Undeliverable: AgenThink') and receivedDateTime ge 2026-04-06T07:00:00Z"
  );
  let nextLink = `/v1.0/users/${MAILBOX}/messages?$filter=${filterQuery}&$select=subject,body,receivedDateTime&$top=999`;
  let page = 0;

  while (nextLink) {
    page++;
    const url = nextLink.startsWith("http")
      ? nextLink
      : `https://graph.microsoft.com${nextLink}`;
    console.log(`[Fetch] Page ${page}...`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[Error]", err);
      break;
    }
    const data = await res.json();
    const msgs = data.value || [];
    console.log(`[Fetch] Got ${msgs.length} NDR messages on page ${page}`);
    allMessages.push(...msgs);
    nextLink = data["@odata.nextLink"] || null;
  }

  console.log(`[Parse] Total NDR messages: ${allMessages.length}`);

  // Parse each NDR
  const rows = [];
  for (const msg of allMessages) {
    const ndrSubject = msg.subject || "";
    const bodyHtml = msg.body?.content || "";
    const bodyText = stripHtml(bodyHtml);

    const bouncedEmail = extractBouncedEmail(ndrSubject, bodyText);
    const originalSubject = extractOriginalSubject(bodyText);
    const originalBody = extractOriginalBody(bodyText);
    const receivedAt = msg.receivedDateTime || "";

    // Extract company name from NDR subject: "Undeliverable: AgenThink — ... | Company Name"
    const companyMatch = ndrSubject.match(/\|\s*(.+)$/);
    const company = companyMatch ? companyMatch[1].trim() : "";

    // Determine market from company name or email domain
    let market = "Unknown";
    const emailDomain = bouncedEmail ? bouncedEmail.split("@")[1] || "" : "";
    if (emailDomain.endsWith(".jp") || emailDomain.endsWith(".co.jp")) market = "Japan";
    else if (emailDomain.endsWith(".ae") || emailDomain.endsWith(".sa") || emailDomain.endsWith(".kw") || emailDomain.endsWith(".bh") || emailDomain.endsWith(".om") || emailDomain.endsWith(".qa")) market = "UAE/GCC";
    else if (emailDomain.endsWith(".uk") || emailDomain.endsWith(".co.uk") || emailDomain.endsWith(".de") || emailDomain.endsWith(".fr") || emailDomain.endsWith(".nl") || emailDomain.endsWith(".se") || emailDomain.endsWith(".ch")) market = "UK/Europe";
    else if (emailDomain.endsWith(".br")) market = "Brazil";
    else if (emailDomain.endsWith(".in") || emailDomain.endsWith(".co.in")) market = "India";
    else if (emailDomain.endsWith(".cn") || emailDomain.endsWith(".com.cn") || emailDomain.endsWith(".hk")) market = "China";
    else if (emailDomain.endsWith(".kr") || emailDomain.endsWith(".co.kr")) market = "Korea";
    else if (emailDomain.endsWith(".tr") || emailDomain.endsWith(".com.tr")) market = "Turkey";
    else if (emailDomain.endsWith(".eg") || emailDomain.endsWith(".com.eg")) market = "Egypt";
    else if (emailDomain.endsWith(".ng") || emailDomain.endsWith(".ke") || emailDomain.endsWith(".za") || emailDomain.endsWith(".gh") || emailDomain.endsWith(".et") || emailDomain.endsWith(".tz") || emailDomain.endsWith(".ug") || emailDomain.endsWith(".rw") || emailDomain.endsWith(".sn") || emailDomain.endsWith(".ci")) market = "Africa";
    else if (emailDomain.endsWith(".com") || emailDomain.endsWith(".us") || emailDomain.endsWith(".io") || emailDomain.endsWith(".co")) market = "USA/Global";

    rows.push({
      bounced_email: bouncedEmail || "(not extracted)",
      company: company,
      market: market,
      ndr_subject: ndrSubject,
      original_subject: originalSubject,
      original_body_preview: originalBody.substring(0, 500),
      ndr_received_at: receivedAt,
      bounce_type: bodyText.includes("wasn't found") || bodyText.includes("Unknown To address") ? "Invalid Address" : "Gateway Block",
    });
  }

  // Deduplicate by bounced_email
  const seen = new Set();
  const deduped = rows.filter((r) => {
    if (!r.bounced_email || r.bounced_email === "(not extracted)") return true;
    if (seen.has(r.bounced_email)) return false;
    seen.add(r.bounced_email);
    return true;
  });

  console.log(`[Export] Unique bounced records: ${deduped.length}`);

  // Save as JSON for Python to convert to Excel
  fs.writeFileSync("/home/ubuntu/bounced_emails_data.json", JSON.stringify(deduped, null, 2));
  console.log("[Done] Data saved to /home/ubuntu/bounced_emails_data.json");
  console.log(`[Summary] Total NDRs: ${allMessages.length} | Unique bounced: ${deduped.length}`);
}

main().catch(console.error);
