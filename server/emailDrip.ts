/**
 * emailDrip.ts — AgenThinkMesh Trial Email Drip System
 *
 * Provider: Microsoft Graph API (replaces Resend).
 * Sends via farouq@agenthink.ai using client-credentials OAuth.
 *
 * 5-email sequence:
 *  Day 1  — Welcome + first workflow guide
 *  Day 15 — Usage check-in + examples
 *  Day 45 — 15 days left warning
 *  Day 55 — Urgency + what you lose
 *  Day 60 — Trial ended + upgrade CTA
 */

import { getDb, generateUnsubscribeUrl, generateUnsubscribeToken } from "./db";
import { users, emailEvents } from "../drizzle/schema";
import { eq, isNull, lte, and, sql } from "drizzle-orm";
import { claimDripSend, type Drip } from "./billing";
import { sendGraphEmail } from "./graphEmail";

// ── Email provider abstraction ────────────────────────────────────────────

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl?: string;
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const html = payload.unsubscribeUrl
    ? payload.html.replace("{{unsubscribe_url}}", payload.unsubscribeUrl)
    : payload.html.replace("{{unsubscribe_url}}", "#");
  return sendGraphEmail({ to: payload.to, subject: payload.subject, html });
}

// ── Email templates ───────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { background: #0a0f1e; color: #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
  .header { border-bottom: 1px solid #1e3a5f; padding-bottom: 24px; margin-bottom: 32px; }
  .logo { color: #06b6d4; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; }
  .logo span { color: #f59e0b; }
  h1 { color: #f1f5f9; font-size: 24px; font-weight: 700; margin: 0 0 16px; }
  p { color: #94a3b8; line-height: 1.7; margin: 0 0 16px; }
  .cta { display: inline-block; background: #06b6d4; color: #0a0f1e; padding: 14px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; margin: 16px 0; }
  .cta-gold { background: #f59e0b; }
  .stat-row { display: flex; gap: 16px; margin: 24px 0; }
  .stat { background: #0f172a; border: 1px solid #1e3a5f; border-radius: 8px; padding: 16px; flex: 1; text-align: center; }
  .stat-value { color: #06b6d4; font-size: 28px; font-weight: 700; }
  .stat-label { color: #64748b; font-size: 12px; margin-top: 4px; }
  .footer { border-top: 1px solid #1e3a5f; padding-top: 24px; margin-top: 40px; color: #475569; font-size: 12px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">AgenThink<span>Mesh</span></div>
  </div>
  ${content}
  <div class="footer">
    <p>AgenThinkMesh · The Google of AI Agents · GCC Edition</p>
    <p>You received this because you signed up for a free trial. <a href="{{unsubscribe_url}}" style="color:#475569;">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`;
}

function day1Template(name: string): Omit<EmailPayload, 'to'> {
  return {
    subject: "Your AgenThink Mesh trial is live — here's where to start",
    html: baseTemplate(`
      <h1>Welcome to AgenThinkMesh, ${name || "there"} 👋</h1>
      <p>Your 60-day free trial is now active. You have <strong style="color:#06b6d4;">50 free runs</strong> to explore the platform.</p>
      <p>Here's what to try first:</p>
      <ul style="color:#94a3b8; line-height:2;">
        <li><strong style="color:#e2e8f0;">The Mesh</strong> — describe any business task and let the AI agent network handle it</li>
        <li><strong style="color:#e2e8f0;">ETF Launch Studio</strong> — design a Shariah-compliant ETF for Boursa Kuwait in 5 guided stages</li>
        <li><strong style="color:#e2e8f0;">Rosie Protocol</strong> — run a 6-agent clinical research pipeline with live streaming output</li>
      </ul>
      <a href="https://agenthink-7enctkan.manus.space/ask" class="cta">Start Your First Task →</a>
      <p style="margin-top:24px;">Questions? Reply to this email — we read every message.</p>
    `),
  };
}

function day15Template(name: string, runsUsed: number): Omit<EmailPayload, 'to'> {
  return {
    subject: `You've used ${runsUsed} runs — here's what others are building`,
    html: baseTemplate(`
      <h1>You're ${Math.round((runsUsed / 50) * 100)}% through your trial</h1>
      <div class="stat-row">
        <div class="stat"><div class="stat-value">${runsUsed}</div><div class="stat-label">Runs used</div></div>
        <div class="stat"><div class="stat-value">${50 - runsUsed}</div><div class="stat-label">Remaining</div></div>
        <div class="stat"><div class="stat-value">45</div><div class="stat-label">Days left</div></div>
      </div>
      <p>Here's what institutional users are building on AgenThinkMesh:</p>
      <ul style="color:#94a3b8; line-height:2;">
        <li>GCC fund managers using the ETF Studio to prepare CMA Kuwait filings</li>
        <li>Legal teams running Force Majeure analysis on 50+ contracts in minutes</li>
        <li>Research teams using Rosie Protocol to generate clinical dossiers for drug candidates</li>
      </ul>
      <a href="https://agenthink-7enctkan.manus.space/ask" class="cta">Continue Exploring →</a>
    `),
  };
}

function day45Template(name: string, runsRemaining: number, daysLeft: number): Omit<EmailPayload, 'to'> {
  return {
    subject: "15 days left on your AgenThink Mesh trial",
    html: baseTemplate(`
      <h1>Your trial ends in ${daysLeft} days</h1>
      <div class="stat-row">
        <div class="stat"><div class="stat-value">${runsRemaining}</div><div class="stat-label">Runs remaining</div></div>
        <div class="stat"><div class="stat-value">${daysLeft}</div><div class="stat-label">Days left</div></div>
      </div>
      <p>Don't lose access to the workflows you've built. Upgrade now to keep everything running without interruption.</p>
      <p><strong style="color:#f59e0b;">Standard — $49/month</strong> · 200 runs/month · All workflows</p>
      <p><strong style="color:#f59e0b;">Pro — $149/month</strong> · 500 runs/month · Priority processing</p>
      <a href="https://agenthink-7enctkan.manus.space/upgrade" class="cta cta-gold">See Upgrade Options →</a>
    `),
  };
}

function day55Template(name: string): Omit<EmailPayload, 'to'> {
  return {
    subject: "5 days left — here's what you lose when your trial expires",
    html: baseTemplate(`
      <h1>5 days left on your trial</h1>
      <p>When your trial expires, you'll lose access to:</p>
      <ul style="color:#94a3b8; line-height:2;">
        <li>All active workflow runs and pipeline history</li>
        <li>ETF Launch Studio — your saved configurations and backtest results</li>
        <li>Rosie Protocol — your clinical dossier archive</li>
        <li>Document Vault — your uploaded and processed documents</li>
        <li>Agent Registry — your custom agent configurations</li>
      </ul>
      <p>Your data is preserved for 30 days after expiry. Upgrade before then to restore full access instantly.</p>
      <a href="https://agenthink-7enctkan.manus.space/upgrade" class="cta cta-gold">Upgrade Now — From $49/month →</a>
    `),
  };
}

function day60Template(name: string, runsUsed: number, agentsFired: number): Omit<EmailPayload, 'to'> {
  return {
    subject: "Your AgenThink Mesh trial has ended",
    html: baseTemplate(`
      <h1>Your trial has ended</h1>
      <p>Here's what you accomplished during your 60-day trial:</p>
      <div class="stat-row">
        <div class="stat"><div class="stat-value">${runsUsed}</div><div class="stat-label">Runs completed</div></div>
        <div class="stat"><div class="stat-value">${agentsFired}</div><div class="stat-label">Agents fired</div></div>
      </div>
      <p>To continue using AgenThinkMesh, choose a plan below:</p>
      <p><strong style="color:#06b6d4;">Standard — $49/month</strong> · 200 runs/month</p>
      <p><strong style="color:#f59e0b;">Pro — $149/month</strong> · 500 runs/month</p>
      <p><strong style="color:#a855f7;">Enterprise</strong> · Unlimited · Contact us</p>
      <a href="https://agenthink-7enctkan.manus.space/upgrade" class="cta cta-gold">Upgrade Your Plan →</a>
      <p style="margin-top:24px; color:#64748b;">For enterprise pricing or custom arrangements, reply to this email.</p>
    `),
  };
}

// ── Drip job ──────────────────────────────────────────────────────────────────

/**
 * Run this function periodically (e.g., every hour via setInterval or a cron).
 * It checks all trial users and sends the appropriate drip email if due.
 */
export async function runDripJob(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const trialUsers = await db.select().from(users).where(eq(users.planTier, "trial"));

  for (const user of trialUsers) {
    if (!user.email || !user.trialStartedAt) continue;
    // Skip users who have unsubscribed from emails
    if (user.emailUnsubscribed) continue;

    const name = user.name ?? "";
    const email = user.email;

    // Backfill unsubscribeToken for users who were created before the column existed
    let unsubscribeToken = user.unsubscribeToken;
    if (!unsubscribeToken) {
      unsubscribeToken = generateUnsubscribeToken();
      await db.update(users).set({ unsubscribeToken }).where(eq(users.id, user.id));
    }
    const unsubscribeUrl = generateUnsubscribeUrl(unsubscribeToken);
    const startedAt = new Date(user.trialStartedAt);
    const daysSinceStart = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
    const runsUsed = 50 - (user.trialRunsRemaining ?? 50);
    const runsRemaining = user.trialRunsRemaining ?? 0;
    const daysLeft = user.trialExpiresAt
      ? Math.max(0, Math.ceil((new Date(user.trialExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Day 1 — send on day 0 or 1
    if (daysSinceStart >= 0 && daysSinceStart <= 1) {
      const claimed = await claimDripSend(user.id, "day_1");
      if (claimed) {
        const tmpl = day1Template(name);
        await sendEmail({ ...tmpl, to: email, unsubscribeUrl });
      }
    }

    // Day 15
    if (daysSinceStart >= 15) {
      const claimed = await claimDripSend(user.id, "day_15");
      if (claimed) {
        const tmpl = day15Template(name, runsUsed);
        await sendEmail({ ...tmpl, to: email, unsubscribeUrl });
      }
    }

    // Day 45
    if (daysSinceStart >= 45) {
      const claimed = await claimDripSend(user.id, "day_45");
      if (claimed) {
        const tmpl = day45Template(name, runsRemaining, daysLeft);
        await sendEmail({ ...tmpl, to: email, unsubscribeUrl });
      }
    }

    // Day 55
    if (daysSinceStart >= 55) {
      const claimed = await claimDripSend(user.id, "day_55");
      if (claimed) {
        const tmpl = day55Template(name);
        await sendEmail({ ...tmpl, to: email, unsubscribeUrl });
      }
    }

    // Day 60+
    if (daysSinceStart >= 60) {
      const claimed = await claimDripSend(user.id, "day_60");
      if (claimed) {
        const tmpl = day60Template(name, runsUsed, user.totalAgentsFired ?? 0);
        await sendEmail({ ...tmpl, to: email, unsubscribeUrl });
      }
    }
  }
}

/// ── Start drip scheduler ──────────────────────────────────────────────────────
let dripInterval: NodeJS.Timeout | null = null;

/**
 * Startup delay before the first drip run.
 * This prevents emails being sent on every server restart (tsx watch, deployments,
 * sandbox hibernation/resume). The unique constraint on email_events is the primary
 * dedup guard; this delay is a second layer of defence that avoids unnecessary DB
 * round-trips on rapid restarts.
 *
 * 5 minutes is long enough to survive a tsx watch file-save restart cycle but short
 * enough that a genuinely new deployment still sends within the same day.
 */
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function startDripScheduler(): void {
  if (dripInterval) return; // already running

  // Delay the first run to avoid re-sending on every server restart.
  // The unique constraint on email_events is the hard dedup guard;
  // this delay prevents unnecessary DB hits on rapid restarts.
  console.log(`[EmailDrip] Drip scheduler registered — first run in ${STARTUP_DELAY_MS / 60000} minutes, then every 24 hours`);

  setTimeout(() => {
    runDripJob().catch(err => console.error("[EmailDrip] Job error (startup):", err));
    dripInterval = setInterval(() => {
      runDripJob().catch(err => console.error("[EmailDrip] Job error:", err));
    }, INTERVAL_MS);
    console.log("[EmailDrip] Drip scheduler active (running every 24 hours)");
  }, STARTUP_DELAY_MS);
}
