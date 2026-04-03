/**
 * Gmail Reply Tracker Service
 *
 * Handles:
 *  1. OAuth 2.0 flow for farouqsultan@gmail.com
 *  2. Token refresh management
 *  3. Polling Gmail every 30 minutes for replies to outbound emails
 *  4. Matching replies to outbound_emails records
 *  5. Updating reply status and follow-up flags
 */

import { getDb } from "./db";
import {
  gmailOAuthTokens,
  gmailSyncLog,
  outboundEmails,
  emailReplies,
} from "../drizzle/schema";
import { eq, and, isNull, lt, sql } from "drizzle-orm";

// ── OAuth Config ──────────────────────────────────────────────────────────────
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || "";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

// ── Build OAuth Authorization URL ────────────────────────────────────────────
export function getGmailAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    ...(state ? { state } : {}),
  });
  return `${GMAIL_AUTH_URL}?${params.toString()}`;
}

// ── Exchange code for tokens ──────────────────────────────────────────────────
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  email: string;
}> {
  const resp = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      redirect_uri: GMAIL_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const tokens = await resp.json();

  // Fetch user email
  const userResp = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );
  const userInfo = await userResp.json();

  return { ...tokens, email: userInfo.email };
}

// ── Store / update tokens in DB ───────────────────────────────────────────────
export async function storeGmailTokens(params: {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const expiresAt = new Date(Date.now() + params.expiresIn * 1000);

  const existing = await db
    .select()
    .from(gmailOAuthTokens)
    .where(eq(gmailOAuthTokens.email, params.email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(gmailOAuthTokens)
      .set({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresAt,
        scope: params.scope,
      })
      .where(eq(gmailOAuthTokens.email, params.email));
  } else {
    await db.insert(gmailOAuthTokens).values({
      email: params.email,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt,
      scope: params.scope,
    });
  }
}

// ── Get a valid access token (refresh if needed) ──────────────────────────────
export async function getValidAccessToken(email: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(gmailOAuthTokens)
    .where(eq(gmailOAuthTokens.email, email))
    .limit(1);

  if (rows.length === 0) return null;
  const tokenRow = rows[0];

  // Check if token is still valid (with 60s buffer)
  if (tokenRow.expiresAt.getTime() > Date.now() + 60_000) {
    return tokenRow.accessToken;
  }

  // Refresh the token
  const resp = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: tokenRow.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) {
    console.error("[GmailTracker] Token refresh failed:", await resp.text());
    return null;
  }

  const refreshed = await resp.json();
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await db
    .update(gmailOAuthTokens)
    .set({
      accessToken: refreshed.access_token,
      expiresAt: newExpiresAt,
    })
    .where(eq(gmailOAuthTokens.email, email));

  return refreshed.access_token as string;
}

// ── Check if Gmail is connected ───────────────────────────────────────────────
export async function isGmailConnected(email: string): Promise<boolean> {
  const dbConn = await getDb();
  if (!dbConn) return false;
  const rows = await dbConn
    .select()
    .from(gmailOAuthTokens)
    .where(eq(gmailOAuthTokens.email, email))
    .limit(1);
  return rows.length > 0;
}

// ── Gmail API helpers ─────────────────────────────────────────────────────────
async function gmailGet(path: string, accessToken: string) {
  const resp = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    throw new Error(`Gmail API error ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

// ── Extract plain text from Gmail message parts ───────────────────────────────
function extractBody(payload: any): string {
  if (!payload) return "";

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  // Multipart — prefer text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      }
    }
    // Fallback to any part
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return "";
}

function getHeader(headers: { name: string; value: string }[], name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

// ── Main sync function ────────────────────────────────────────────────────────
export async function syncGmailReplies(gmailEmail: string): Promise<{
  scanned: number;
  newReplies: number;
  error?: string;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const logEntry = await db.insert(gmailSyncLog).values({
    startedAt: new Date(),
    status: "running",
  });
  const logId = (logEntry as any).insertId as number;

  let scanned = 0;
  let newReplies = 0;

  try {
    const accessToken = await getValidAccessToken(gmailEmail);
    if (!accessToken) {
      throw new Error("No valid Gmail access token. Please reconnect Gmail.");
    }

    // Fetch all outbound emails that don't have a reply yet (or need re-check)
    const outboundList: Array<{ id: number; recipientEmail: string; gmailThreadId: string | null; msMessageId: string | null; sentAt: Date }> = await db
      .select({
        id: outboundEmails.id,
        recipientEmail: outboundEmails.recipientEmail,
        gmailThreadId: outboundEmails.gmailThreadId,
        msMessageId: outboundEmails.msMessageId,
        sentAt: outboundEmails.sentAt,
      })
      .from(outboundEmails)
      .limit(1000);

    // Build lookup maps
    const emailToOutbound = new Map<string, number>(); // recipientEmail → outboundId
    const threadToOutbound = new Map<string, number>(); // gmailThreadId → outboundId

    for (const row of outboundList) {
      emailToOutbound.set(row.recipientEmail.toLowerCase(), row.id);
      if (row.gmailThreadId) {
        threadToOutbound.set(row.gmailThreadId, row.id);
      }
    }

    // Fetch already-tracked Gmail message IDs to avoid duplicates
    const existingReplies = await db
      .select({ gmailMessageId: emailReplies.gmailMessageId })
      .from(emailReplies);
    const trackedMessageIds = new Set(existingReplies.map((r: { gmailMessageId: string }) => r.gmailMessageId));

    // Search Gmail for messages in inbox that are replies (have In-Reply-To header)
    // We search for messages received after the earliest sent date
    const earliestSent = outboundList.reduce(
      (min: Date, row: { sentAt: Date }) => (row.sentAt < min ? row.sentAt : min),
      new Date()
    );
    const afterDate = Math.floor(earliestSent.getTime() / 1000);

    // Query Gmail for messages after the outreach campaign start
    const query = `after:${afterDate} in:inbox`;
    let pageToken: string | undefined;
    const allMessageIds: string[] = [];

    do {
      const params = new URLSearchParams({ q: query, maxResults: "500" });
      if (pageToken) params.set("pageToken", pageToken);
      const listResp = await gmailGet(`/users/me/messages?${params}`, accessToken);
      if (listResp.messages) {
        allMessageIds.push(...listResp.messages.map((m: any) => m.id));
      }
      pageToken = listResp.nextPageToken;
    } while (pageToken && allMessageIds.length < 2000);

    scanned = allMessageIds.length;

    // Process each message
    for (const msgId of allMessageIds) {
      if (trackedMessageIds.has(msgId)) continue;

      try {
        const msg = await gmailGet(
          `/users/me/messages/${msgId}?format=full`,
          accessToken
        );

        const headers = msg.payload?.headers || [];
        const from = getHeader(headers, "From");
        const inReplyTo = getHeader(headers, "In-Reply-To");
        const references = getHeader(headers, "References");
        const subject = getHeader(headers, "Subject");
        const threadId = msg.threadId;

        // Only process if it's a reply (has In-Reply-To or References header)
        if (!inReplyTo && !references) continue;

        // Extract sender email
        const senderEmailMatch = from.match(/<(.+?)>/) || from.match(/(\S+@\S+)/);
        const senderEmail = senderEmailMatch ? senderEmailMatch[1].toLowerCase() : from.toLowerCase();
        const senderName = from.replace(/<.+?>/, "").trim().replace(/^"/, "").replace(/"$/, "");

        // Find matching outbound email
        let outboundId: number | undefined;

        // Try thread ID first
        if (threadId && threadToOutbound.has(threadId)) {
          outboundId = threadToOutbound.get(threadId);
        }

        // Try sender email
        if (!outboundId && emailToOutbound.has(senderEmail)) {
          outboundId = emailToOutbound.get(senderEmail);
        }

        if (!outboundId) continue; // Not related to our outreach

        // Extract body
        const bodyText = extractBody(msg.payload);
        const snippet = msg.snippet || bodyText.substring(0, 200);

        // Get received timestamp
        const receivedAt = new Date(parseInt(msg.internalDate));

        // Insert reply record
        await db.insert(emailReplies).values({
          outboundEmailId: outboundId,
          gmailMessageId: msgId,
          gmailThreadId: threadId,
          senderEmail,
          senderName: senderName || undefined,
          subject: subject || undefined,
          snippet,
          bodyText: bodyText.substring(0, 10000),
          receivedAt,
        });

        trackedMessageIds.add(msgId);
        newReplies++;

        // Update outbound email status
        const outbound = await db
          .select()
          .from(outboundEmails)
          .where(eq(outboundEmails.id, outboundId))
          .limit(1);

        if (outbound.length > 0 && outbound[0].replyStatus === "no_response") {
          await db
            .update(outboundEmails)
            .set({
              replyStatus: "new_reply",
              firstRepliedAt: outbound[0].firstRepliedAt || receivedAt,
              lastActivityAt: receivedAt,
              gmailThreadId: threadId,
              followUpDue: false,
            })
            .where(eq(outboundEmails.id, outboundId));
        } else if (outbound.length > 0) {
          await db
            .update(outboundEmails)
            .set({
              lastActivityAt: receivedAt,
              gmailThreadId: threadId,
            })
            .where(eq(outboundEmails.id, outboundId));
        }
      } catch (msgErr) {
        // Skip individual message errors
        console.warn(`[GmailTracker] Error processing message ${msgId}:`, msgErr);
      }
    }

    // Auto-flag follow-ups: emails with no reply after 6 weeks
    const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
    await db
      .update(outboundEmails)
      .set({
        followUpDue: true,
        followUpDueAt: new Date(),
      })
      .where(
        and(
          eq(outboundEmails.replyStatus, "no_response"),
          lt(outboundEmails.sentAt, sixWeeksAgo),
          eq(outboundEmails.followUpDue, false)
        )
      );

    // Update sync log
    await db
      .update(gmailSyncLog)
      .set({
        completedAt: new Date(),
        status: "success",
        messagesScanned: scanned,
        newRepliesFound: newReplies,
      })
      .where(eq(gmailSyncLog.id, logId));

    return { scanned, newReplies };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    await db
      .update(gmailSyncLog)
      .set({
        completedAt: new Date(),
        status: "error",
        messagesScanned: scanned,
        newRepliesFound: newReplies,
        errorMessage,
      })
      .where(eq(gmailSyncLog.id, logId));

    return { scanned, newReplies, error: errorMessage };
  }
}

// ── Polling scheduler (30-minute interval) ────────────────────────────────────
let pollingInterval: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const TRACKER_EMAIL = "farouqsultan@gmail.com";

export function startGmailPolling() {
  if (pollingInterval) return; // Already running

  console.log("[GmailTracker] Starting 30-minute polling for", TRACKER_EMAIL);

  // Run once immediately on start (if connected)
  runPollIfConnected();

  pollingInterval = setInterval(runPollIfConnected, POLL_INTERVAL_MS);
}

export function stopGmailPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[GmailTracker] Polling stopped.");
  }
}

async function runPollIfConnected() {
  try {
    const connected = await isGmailConnected(TRACKER_EMAIL);
    if (!connected) {
      console.log("[GmailTracker] Gmail not connected, skipping poll.");
      return;
    }
    console.log("[GmailTracker] Running sync...");
    const result = await syncGmailReplies(TRACKER_EMAIL);
    console.log(
      `[GmailTracker] Sync complete: scanned=${result.scanned}, newReplies=${result.newReplies}${result.error ? `, error=${result.error}` : ""}`
    );
  } catch (err) {
    console.error("[GmailTracker] Poll error:", err);
  }
}
