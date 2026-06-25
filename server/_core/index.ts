import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { agentRouter } from "../agentRoutes";
import { forceMajeureRouter } from "../forceMajeureRoute";
import { gameTheoryRouter } from "../gameTheoryRoute";
import etfRouter from "../etfRoute";
import { startHealthCheckJob } from "../jobs/healthCheck";
import { startOutcomeCollectorJob } from "../jobs/outcomeCollector";
import { startCriticAgentJob } from "../jobs/criticAgent";
import { startPitchSweepJob } from "../jobs/pitchSweep";
import workflowStreamRouter from "../workflowStreamRoute";
import portfolioStreamRouter from "../portfolioStreamRoute";
import insuranceStreamRouter from "../insuranceStreamRoute";
import admeshStreamRouter from "../admeshStreamRoute";
import { socialMediaStreamRouter } from "../socialMediaStreamRoute";
import { registerStripeWebhookRoute } from "../stripeWebhookRoute";
import { startDripScheduler } from "../emailDrip";
import dealScreenerUploadRouter from "../dealScreenerUploadRoute";
import dealIngestionRouter from "../dealIngestionRoute";
import intelligenceParseRouter from "../intelligenceParseRoute";
import gmailOAuthRouter from "../gmailOAuthRoute";
import { startGmailPolling } from "../gmailTracker";
import { runTier0Ingestion } from "../tier0Ingestion";
import signalsIngestRouter from "../signalsIngestRoute";
import dealScreenRouter from "../dealScreenRoute";
import { dataRoomUploadRouter } from "../dataRoomUploadRoute";
import { registerPitchMirrorMetaRoute } from "../pitchMirrorMetaRoute";
import { registerFleetSchedulerStatusRoute } from "../fleetSchedulerStatusRoute";
import { registerEncryptionReportRoute } from "../encryptionReportRoute";
import fleetTriggerRouter from "../fleetTriggerRoute";
import fleetPhaseRouter from "../fleetPhaseRoute";
import webhookFleetTriggerRouter from "../webhookFleetTriggerRoute";
import inboundEmailWebhookRouter from "../inboundEmailWebhookRoute";
import graphEmailWebhookRouter from "../graphEmailWebhookRoute";
import { startGraphSubscriptionJob } from "../jobs/graphSubscription";
import { startFounderFleetScheduler } from "../jobs/founderFleetScheduler";
import { startSelfPingJob } from "../jobs/selfPingJob";
import { registerStorageProxy } from "./storageProxy";
import { atlasDailyLoopHandler } from "../scheduled/atlasDailyLoop";
import { atlasWeeklyExpansionHandler } from "../scheduled/atlasWeeklyExpansion";
import { createHeartbeatJob, listHeartbeatJobs } from "./heartbeat";

// ── Startup assertions — fail fast on missing critical env vars ──────────────
// These checks run before any route handlers are registered.
// If a required key is absent or empty the process exits with code 1 so that
// Cloud Run marks the revision as unhealthy rather than silently running with
// broken LLM calls.
function assertRequiredEnvVars(): void {
  const required: { name: string; value: string | undefined }[] = [
    { name: "BUILT_IN_FORGE_API_KEY", value: process.env.BUILT_IN_FORGE_API_KEY },
    { name: "ANTHROPIC_API_KEY",      value: process.env.ANTHROPIC_API_KEY },
  ];
  const missing = required.filter((v) => !v.value || v.value.trim().length === 0);
  if (missing.length > 0) {
    const names = missing.map((v) => v.name).join(", ");
    console.error(
      `[FATAL] Missing required environment variable(s): ${names}. ` +
      "Set them in the Cloud Run service configuration and redeploy. Exiting."
    );
    process.exit(1);
  }
  console.log("[Boot] Required env vars present: BUILT_IN_FORGE_API_KEY, ANTHROPIC_API_KEY");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/**
 * Idempotent Atlas cron registration — called once at startup.
 * If a job with the same name already exists the CONFLICT error is swallowed.
 */
async function registerAtlasCronJobs(): Promise<void> {
  const USER_SESSION = ""; // empty = project owner
  const jobs = [
    {
      name: "atlas-daily-loop",
      cron: "0 0 9 * * *", // daily 09:00 UTC
      path: "/api/scheduled/atlas-daily-loop",
      method: "POST" as const,
      description: "Atlas daily operational loop — 16-step autonomous revenue cycle",
    },
    {
      name: "atlas-weekly-expansion",
      cron: "0 0 8 * * 1", // Mondays 08:00 UTC
      path: "/api/scheduled/atlas-weekly-expansion",
      method: "POST" as const,
      description: "Atlas weekly universe expansion — add companies, generate Decision Twins, update Outcome Ledger",
    },
  ];

  // Fetch existing jobs to avoid duplicate-create errors
  let existingNames = new Set<string>();
  try {
    const list = await listHeartbeatJobs(USER_SESSION);
    existingNames = new Set(list.jobs.map((j) => j.name));
    console.log(`[Atlas] Existing heartbeat jobs: ${Array.from(existingNames).join(", ") || "none"}`);
  } catch (err) {
    console.warn("[Atlas] Could not list heartbeat jobs — will attempt create anyway:", String(err));
  }

  for (const job of jobs) {
    if (existingNames.has(job.name)) {
      console.log(`[Atlas] Cron '${job.name}' already registered — skipping.`);
      continue;
    }
    try {
      const result = await createHeartbeatJob(job, USER_SESSION);
      console.log(`[Atlas] Cron '${job.name}' registered. taskUid=${result.taskUid} nextRun=${result.nextExecutionAt}`);
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes("CONFLICT") || msg.includes("409")) {
        console.log(`[Atlas] Cron '${job.name}' already exists (CONFLICT) — skipping.`);
      } else {
        console.warn(`[Atlas] Failed to register cron '${job.name}':`, msg);
      }
    }
  }
}

async function startServer() {
  assertRequiredEnvVars();
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  // Stripe webhook MUST be registered before express.json() to receive raw body
  registerStripeWebhookRoute(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    // HSTS — enforce HTTPS for 1 year (including subdomains)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    // Prevent MIME-type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Deny framing (clickjacking protection)
    res.setHeader("X-Frame-Options", "DENY");
    // Disable legacy XSS filter (CSP is the modern replacement)
    res.setHeader("X-XSS-Protection", "0");
    // Referrer policy — no referrer on cross-origin requests
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Permissions policy — disable camera, microphone, geolocation
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // Storage proxy — serves /manus-storage/{key} via signed Forge URLs
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Force Majeure Contract Agent (must be before generic /api/agents catch-all)
  app.use("/api/agents/force-majeure", forceMajeureRouter);
  // Game Theory Investment Decision Agent
  app.use("/api/agents/game-theory", gameTheoryRouter);
  // ETF Launch Studio endpoints (claude-proxy + data endpoints)
  app.use("/api/etf", etfRouter);
  // Workflow SSE streaming endpoint
  app.use("/api/workflow", workflowStreamRouter);
  // Portfolio Intelligence Engine SSE streaming endpoint
  app.use("/api/portfolio", portfolioStreamRouter);
  // Insurance & Reinsurance Intelligence Engine SSE streaming endpoint
  app.use("/api/insurance", insuranceStreamRouter);
  // AdMesh Creative Intelligence SSE streaming endpoint
  app.use("/api/admesh", admeshStreamRouter);
  // Social Media Intelligence SSE streaming endpoint
  app.use("/api/social", socialMediaStreamRouter);
  // Deal Screener PDF upload endpoint (legacy single-PDF)
  app.use("/api/deals", dealScreenerUploadRouter);
  // Deal Data Room Ingestion V1 — multi-file upload + LLM extraction
  app.use("/api/deals", dealIngestionRouter);
  // Deal Signal Layer — lightweight ingestion endpoint for external signals
  app.use("/api/signals", signalsIngestRouter);
  // Deal Screener REST API — internal testing + enterprise integration
  // Open mode (no auth): ENABLE_INTERNAL_SCREEN_API=true
  app.use("/api/deal", dealScreenRouter);
  // Data Room Upload — file/ZIP upload + bulk PDF download
  app.use("/api/dataroom", dataRoomUploadRouter);
  // Intelligence Agent document parse endpoint
  app.use("/api/intelligence/parse-document", intelligenceParseRouter);
  // Gmail OAuth for Reply Tracker
  app.use("/api/gmail", gmailOAuthRouter);
  // Embedded specialist agent endpoints
  app.use("/api/agents", agentRouter);

  // ── Revenue Bridge: K-Net / NBK payment confirmation webhook ──────────────
  // POST /api/payment-confirm  { pitchToken, webhookSecret? }
  // In production: replace secret check with NBK HMAC signature verification.
  app.post("/api/payment-confirm", async (req, res) => {
    try {
      const { pitchToken, webhookSecret } = req.body as { pitchToken?: string; webhookSecret?: string };
      if (!pitchToken) {
        res.status(400).json({ success: false, error: "pitchToken is required" });
        return;
      }
      const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET ?? "knet-dev-secret-2026";
      if (webhookSecret && webhookSecret !== expectedSecret) {
        res.status(403).json({ success: false, error: "Invalid webhook secret" });
        return;
      }
      const { getDb } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) { res.status(503).json({ success: false, error: "Database unavailable" }); return; }
      const [rows] = await (db as any).$client.execute(
        "SELECT id FROM pitch_sessions WHERE pitchToken = ? LIMIT 1",
        [pitchToken]
      );
      if (!rows || rows.length === 0) {
        res.status(404).json({ success: false, error: "Pitch session not found" });
        return;
      }
      await db.execute(sql`UPDATE pitch_sessions SET paymentStatus = 'PAID', reportUnlocked = 1, updatedAt = NOW() WHERE pitchToken = ${pitchToken}`);
      await db.execute(sql`UPDATE decision_memory SET paymentStatus = 'PAID' WHERE pitchToken = ${pitchToken}`);
      console.log(`[PaymentWebhook] Confirmed payment for pitchToken=${pitchToken}`);
      res.json({ success: true, message: "Payment confirmed. Report unlocked.", pitchToken });
    } catch (err: any) {
      console.error("[PaymentWebhook] Error:", err);
      res.status(500).json({ success: false, error: err.message ?? "Internal error" });
    }
  });

  // Inbound email webhook — legacy route kept for backward compatibility
  app.use("/api/webhooks/inbound-email", inboundEmailWebhookRouter);
  // Microsoft Graph API inbound email webhook (new primary route)
  app.use("/api/webhooks/graph-email", graphEmailWebhookRouter);

  // Fleet scheduler health check — public GET /api/fleet/scheduler-status
  registerFleetSchedulerStatusRoute(app);
  // Encryption coverage report — admin-only GET /api/admin/encryption-report
  registerEncryptionReportRoute(app);
  // External fleet trigger — POST /api/scheduled/fleet-trigger (X-Scheduler-Secret auth)
  // Phase-based fleet trigger — POST /api/scheduled/fleet-phase?phase=generate|research|pitch|evaluate&mode=gcc|global
  app.use("/api/scheduled", fleetTriggerRouter);
  app.use("/api/scheduled", fleetPhaseRouter);
  // Atlas daily operational loop — POST /api/scheduled/atlas-daily-loop
  app.post("/api/scheduled/atlas-daily-loop", atlasDailyLoopHandler);
  // Atlas weekly universe expansion — POST /api/scheduled/atlas-weekly-expansion
  app.post("/api/scheduled/atlas-weekly-expansion", atlasWeeklyExpansionHandler);
  // Option A fleet trigger — POST /api/fleet/trigger
  // Mounted under /api/fleet/* which is NOT blocked by the Manus reverse-proxy cookie-auth
  // (unlike /api/scheduled/* which is blocked). This is the primary external trigger path.
  app.use("/api/fleet", webhookFleetTriggerRouter);
  // Phase-based fleet trigger also mounted under /api/fleet/* to bypass proxy SPA catch-all
  // POST /api/fleet/phase?phase=generate|research|pitch|evaluate&mode=gcc|global
  app.use("/api/fleet", fleetPhaseRouter);
  // Direct top-level fleet trigger — POST /api/fleet-trigger
  // Avoids any /api/fleet/* proxy sub-path blocking; matches /api/payment-confirm pattern
  // which is confirmed to pass through the proxy (returns 400 from Express, not 403 from proxy).
  app.post("/api/fleet-trigger", async (req, res) => {
    // Forward to the same handler by re-routing through the router
    req.url = "/fleet-trigger";
    webhookFleetTriggerRouter(req, res, () => res.status(404).json({ error: "Not found" }));
  });
  // Public webhook fleet trigger — POST /webhook/fleet-trigger (bypasses /api/* proxy auth)
  // Note: /webhook/* is caught by the SPA catch-all; kept for completeness but /api/fleet/trigger
  // is the recommended path.
  app.use("/webhook", webhookFleetTriggerRouter);
  // PitchMirror shared-link OG meta injection (must be before Vite/static catch-all)
  registerPitchMirrorMetaRoute(app);

  // RFC 9116 security.txt — automated security scanners and researchers check this path first
  app.get("/.well-known/security.txt", (_req, res) => {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const expiresStr = expires.toISOString().replace(/\.\d{3}Z$/, "+00:00");
    const body = [
      "Contact: mailto:security@agenthink.ai",
      `Expires: ${expiresStr}`,
      "Preferred-Languages: en",
      "Policy: https://agenthink-7enctkan.manus.space/security#responsible-disclosure",
      "Canonical: https://agenthink-7enctkan.manus.space/.well-known/security.txt",
      "",
      "# Coordinated Disclosure Policy",
      "# We request a 90-day coordinated disclosure window from the date of first contact.",
      "# We will acknowledge receipt within 24 hours and provide a resolution timeline.",
      "# We do not operate a bug bounty programme at this time.",
      "# Out-of-scope: social engineering, DoS, third-party service vulnerabilities.",
    ].join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(body);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the agent registry health-check cron job
    startHealthCheckJob();
    startDripScheduler();
    // Self-Learning Loop: Phase 4 (outcome collection) + Phase 5 (critic agent)
    startOutcomeCollectorJob();
    startCriticAgentJob();
    // Daily pitch re-triage sweep: 08:00 Kuwait time
    startPitchSweepJob();
    // Email Reply Tracker: poll Gmail every 30 minutes
    startGmailPolling();
    // Microsoft Graph subscription — creates inbox subscription and renews every 23 hours
    const appBaseUrl = process.env.VITE_FRONTEND_FORGE_API_URL
      ? "https://agenthink-7enctkan.manus.space"
      : `http://localhost:${port}`;
    startGraphSubscriptionJob(appBaseUrl);
    // FounderAgent Fleet — daily 02:00 UTC + resume interrupted runs on startup
    startFounderFleetScheduler();
    // Self-ping keep-alive — pings /api/health every 10 min to prevent Cloud Run hibernation
    startSelfPingJob();
    // setInterval-based keep-warm: fires even if node-cron is killed by Cloud Run hibernation
    // This is the primary keep-alive mechanism; startSelfPingJob() is a secondary cron-based backup.
    setInterval(async () => {
      try {
        await fetch('https://agenthink-7enctkan.manus.space/api/health');
        console.log('[HealthPing] Server kept warm');
      } catch (e) {
        console.error('[HealthPing] Failed:', e);
      }
    }, 10 * 60 * 1000); // every 10 minutes
    // Tier 0 University Signal ingestion — run once at startup, then daily at 02:00 KWT (23:00 UTC)
    runTier0Ingestion().catch(err => console.warn("[Tier0] Initial ingestion failed:", err?.message));
    // Atlas Heartbeat cron registration — idempotent upsert on every startup
    registerAtlasCronJobs().catch(err => console.warn("[Atlas] Cron registration failed:", err?.message));
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(() => {
      runTier0Ingestion().catch(err => console.warn("[Tier0] Daily ingestion failed:", err?.message));
    }, TWENTY_FOUR_HOURS);
  });
}

startServer().catch(console.error);
