/**
 * read_bounces.mjs
 * Reads all NDR (Non-Delivery Report) emails from farouq@agenthink.ai inbox
 * via Microsoft Graph API, extracts the bounced recipient email addresses,
 * and cross-references with the sent list to produce a delivery summary.
 */

import https from "https";
import { writeFileSync, readFileSync } from "fs";

const TENANT_ID     = process.env.MS_TENANT_ID     || "4e3c81c1-6864-4c56-af1b-30a2f16f84d4";
const CLIENT_ID     = process.env.MS_CLIENT_ID     || "1513f312-7259-4e67-b81d-5846d4d96c74";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const MAILBOX       = "farouq@agenthink.ai";

// ── Get MS Graph token ────────────────────────────────────────────────────────
async function getToken() {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
    }).toString();
    const req = https.request({
      hostname: "login.microsoftonline.com",
      path: `/${TENANT_ID}/oauth2/v2.0/token`,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        const json = JSON.parse(data);
        if (json.access_token) resolve(json.access_token);
        else reject(new Error(JSON.stringify(json)));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Graph GET helper ──────────────────────────────────────────────────────────
async function graphGet(token, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "graph.microsoft.com",
      path,
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("JSON parse error: " + data.substring(0, 200))); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Extract bounced email from NDR body ───────────────────────────────────────
function extractBouncedEmail(subject, bodyText) {
  // NDR subjects look like: "Undeliverable: AgenThink — 35-page IC memo in 4 minutes | CompanyName"
  // Body contains the bounced address in various formats

  // Try to extract from body text
  const patterns = [
    // "Your message to email@domain.com couldn't be delivered"
    /Your message to\s+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\s+couldn't be delivered/i,
    // "Recipient: email@domain.com"
    /Recipient:\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    // "Final-Recipient: rfc822; email@domain.com"
    /Final-Recipient:\s*rfc822;\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    // Generic email in body
    /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match && match[1] && !match[1].includes("agenthink.ai") && !match[1].includes("microsoft.com")) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("[Auth] Getting Microsoft Graph token...");
  const token = await getToken();
  console.log("[Auth] Token obtained.");

  // Fetch NDR messages from inbox — filter by subject containing "Undeliverable: AgenThink"
  // Use $top=999 and paginate
  const bouncedEmails = [];
  // Filter to today's resend only (after 07:00 UTC Apr 6 2026 — when the resend started)
  const filterQuery = encodeURIComponent("contains(subject,'Undeliverable: AgenThink') and receivedDateTime ge 2026-04-06T07:00:00Z");
  let nextLink = `/v1.0/users/${MAILBOX}/messages?$filter=${filterQuery}&$select=subject,body,receivedDateTime&$top=999`;
  let page = 0;

  while (nextLink) {
    page++;
    console.log(`[Fetch] Page ${page}: ${nextLink.substring(0, 80)}...`);
    const result = await graphGet(token, nextLink);

    if (result.error) {
      console.error("[Error]", JSON.stringify(result.error));
      break;
    }

    const messages = result.value || [];
    console.log(`[Fetch] Got ${messages.length} NDR messages on page ${page}`);

    for (const msg of messages) {
      const bodyText = msg.body?.content || "";
      const email = extractBouncedEmail(msg.subject, bodyText);
      if (email) {
        bouncedEmails.push({
          bouncedEmail: email,
          subject: msg.subject,
          receivedAt: msg.receivedDateTime,
        });
      }
    }

    // Pagination
    nextLink = result["@odata.nextLink"]
      ? result["@odata.nextLink"].replace("https://graph.microsoft.com", "")
      : null;
  }

  console.log(`\n[Parse] Total NDR messages processed. Bounced addresses found: ${bouncedEmails.length}`);

  // ── Load the sent list from the resend log ────────────────────────────────
  const sentLog = readFileSync("/home/ubuntu/resend_897_log.txt", "utf8");
  const sentEmails = new Set();
  const sentByMarket = {};
  const sentDetails = {};

  // Parse sent log: [timestamp] [N/891] ✅ SENT → Name <email> (Company) [Market]
  const sentLineRe = /✅ SENT → .+?<([^>]+)>.+?\[([^\]]+)\]/g;
  let m;
  while ((m = sentLineRe.exec(sentLog)) !== null) {
    const email = m[1].toLowerCase();
    const market = m[2];
    sentEmails.add(email);
    sentByMarket[market] = (sentByMarket[market] || 0) + 1;
    sentDetails[email] = market;
  }

  console.log(`[Sent] Total sent emails parsed from log: ${sentEmails.size}`);

  // ── Cross-reference ───────────────────────────────────────────────────────
  const bouncedSet = new Set(bouncedEmails.map(b => b.bouncedEmail));
  const deliveredEmails = [...sentEmails].filter(e => !bouncedSet.has(e));

  // Market breakdown for bounced
  const bouncedByMarket = {};
  for (const b of bouncedEmails) {
    const market = sentDetails[b.bouncedEmail] || "Unknown";
    bouncedByMarket[market] = (bouncedByMarket[market] || 0) + 1;
  }

  // Market breakdown for delivered
  const deliveredByMarket = {};
  for (const e of deliveredEmails) {
    const market = sentDetails[e] || "Unknown";
    deliveredByMarket[market] = (deliveredByMarket[market] || 0) + 1;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = {
    runAt: new Date().toISOString(),
    totalSent: sentEmails.size,
    totalBounced: bouncedSet.size,
    totalDelivered: deliveredEmails.length,
    deliveryRate: ((deliveredEmails.length / sentEmails.size) * 100).toFixed(1) + "%",
    bounceRate: ((bouncedSet.size / sentEmails.size) * 100).toFixed(1) + "%",
    marketBreakdown: Object.keys(sentByMarket).sort().map(market => ({
      market,
      sent: sentByMarket[market] || 0,
      bounced: bouncedByMarket[market] || 0,
      delivered: (sentByMarket[market] || 0) - (bouncedByMarket[market] || 0),
    })),
    bouncedEmails: [...bouncedSet].sort(),
  };

  console.log("\n" + "=".repeat(65));
  console.log("  DELIVERY ANALYSIS — FINAL SUMMARY");
  console.log("=".repeat(65));
  console.log(`  Total Sent:      ${summary.totalSent}`);
  console.log(`  Total Bounced:   ${summary.totalBounced}`);
  console.log(`  Total Delivered: ${summary.totalDelivered}`);
  console.log(`  Delivery Rate:   ${summary.deliveryRate}`);
  console.log(`  Bounce Rate:     ${summary.bounceRate}`);
  console.log("\n  Market Breakdown:");
  console.log("  " + "-".repeat(55));
  console.log("  Market          Sent   Bounced  Delivered");
  console.log("  " + "-".repeat(55));
  summary.marketBreakdown.forEach(r => {
    console.log(`  ${r.market.padEnd(16)} ${String(r.sent).padEnd(7)} ${String(r.bounced).padEnd(9)} ${r.delivered}`);
  });
  console.log("=".repeat(65));

  writeFileSync("/home/ubuntu/delivery_analysis.json", JSON.stringify(summary, null, 2));
  console.log("\n  Full report saved to: /home/ubuntu/delivery_analysis.json");
}

main().catch(err => {
  console.error("[Fatal]", err.message);
  process.exit(1);
});
