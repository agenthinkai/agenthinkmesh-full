/**
 * selfPingJob.ts — Cloud Run keep-alive self-ping
 *
 * Cloud Run hibernates idle instances after ~15 minutes of inactivity,
 * which kills in-process node-cron jobs (including the fleet scheduler).
 * This job pings GET /api/health every 10 minutes to keep the process warm.
 *
 * Only runs in production (NODE_ENV === "production") to avoid unnecessary
 * network calls in development and test environments.
 *
 * The ping target is derived from VITE_FRONTEND_FORGE_API_URL or falls back
 * to the canonical production URL.
 *
 * Added: 2026-04-29 — Option C fix for fleet scheduler reliability.
 */
import cron from "node-cron";

const PING_INTERVAL_CRON = "*/10 * * * *"; // every 10 minutes
const PING_TIMEOUT_MS = 8000;
const PRODUCTION_BASE_URL = "https://agenthink-7enctkan.manus.space";

let selfPingStarted = false;

async function pingSelf(): Promise<void> {
  const base = process.env.VITE_FRONTEND_FORGE_API_URL
    ? PRODUCTION_BASE_URL
    : PRODUCTION_BASE_URL;

  const url = `${base}/api/health`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      console.log(`[SelfPing] Keep-alive ping OK (${res.status})`);
    } else {
      console.warn(`[SelfPing] Keep-alive ping returned ${res.status}`);
    }
  } catch (err) {
    // Non-fatal — log and continue; the cron will retry in 10 minutes
    console.warn(`[SelfPing] Keep-alive ping failed: ${(err as Error)?.message ?? String(err)}`);
  }
}

/**
 * Start the self-ping keep-alive job.
 * Runs every 10 minutes in production to prevent Cloud Run hibernation.
 * Skipped in test and development environments.
 */
export function startSelfPingJob(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[SelfPing] Skipped — not in production");
    return;
  }
  if (selfPingStarted) return;
  selfPingStarted = true;

  cron.schedule(PING_INTERVAL_CRON, () => {
    pingSelf().catch((err: unknown) =>
      console.warn("[SelfPing] Unexpected error:", (err as Error)?.message)
    );
  }, { timezone: "UTC" });

  console.log("[SelfPing] Keep-alive job registered — pings /api/health every 10 minutes");

  // Fire once immediately to confirm the server is reachable after startup
  setTimeout(() => {
    pingSelf().catch((err: unknown) =>
      console.warn("[SelfPing] Startup ping failed:", (err as Error)?.message)
    );
  }, 30_000); // 30 seconds after startup to let the server fully initialise
}
