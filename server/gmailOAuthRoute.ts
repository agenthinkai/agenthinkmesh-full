/**
 * Gmail OAuth Express routes
 *
 * GET  /api/gmail/auth     → redirect to Google OAuth consent screen
 * GET  /api/gmail/callback → handle OAuth callback, store tokens, redirect to /tracker
 * GET  /api/gmail/status   → check if Gmail is connected
 * POST /api/gmail/sync     → manually trigger a sync
 */

import { Router } from "express";
import {
  getGmailAuthUrl,
  exchangeCodeForTokens,
  storeGmailTokens,
  isGmailConnected,
  syncGmailReplies,
} from "./gmailTracker";

const TRACKER_EMAIL = "farouqsultan@gmail.com";

const gmailOAuthRouter = Router();

// GET /api/gmail/auth — start OAuth flow
gmailOAuthRouter.get("/auth", (req, res) => {
  const origin = (req.query.origin as string) || "";
  const state = Buffer.from(JSON.stringify({ origin })).toString("base64");
  const authUrl = getGmailAuthUrl(state);
  res.redirect(authUrl);
});

// GET /api/gmail/callback — handle OAuth callback
gmailOAuthRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    console.error("[GmailOAuth] OAuth error:", error);
    return res.redirect(`/tracker?gmail_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect("/tracker?gmail_error=no_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (tokens.email !== TRACKER_EMAIL) {
      return res.redirect(
        `/tracker?gmail_error=${encodeURIComponent(
          `Wrong account: please authorize ${TRACKER_EMAIL}, not ${tokens.email}`
        )}`
      );
    }

    await storeGmailTokens({
      email: tokens.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    });

    console.log("[GmailOAuth] Successfully connected:", tokens.email);

    // Trigger an immediate sync in the background
    syncGmailReplies(TRACKER_EMAIL).catch((err) =>
      console.error("[GmailOAuth] Initial sync error:", err)
    );

    // Parse origin from state for redirect
    let redirectUrl = "/tracker?gmail_connected=1";
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
        if (parsed.origin) {
          redirectUrl = `${parsed.origin}/tracker?gmail_connected=1`;
        }
      } catch {}
    }

    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error("[GmailOAuth] Token exchange error:", err);
    return res.redirect(
      `/tracker?gmail_error=${encodeURIComponent(err.message || "OAuth failed")}`
    );
  }
});

// GET /api/gmail/status — check connection status
gmailOAuthRouter.get("/status", async (req, res) => {
  try {
    const connected = await isGmailConnected(TRACKER_EMAIL);
    res.json({ connected, email: TRACKER_EMAIL });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// POST /api/gmail/sync — manual sync trigger
gmailOAuthRouter.post("/sync", async (req, res) => {
  try {
    const connected = await isGmailConnected(TRACKER_EMAIL);
    if (!connected) {
      return res.status(400).json({ error: "Gmail not connected" });
    }
    const result = await syncGmailReplies(TRACKER_EMAIL);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default gmailOAuthRouter;
