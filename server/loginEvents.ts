/**
 * loginEvents.ts
 *
 * Fire-and-forget helper that records a login event (IP + country) to the
 * login_events table. Never throws — all errors are swallowed so the login
 * flow is never blocked.
 */
import { getDb } from "./db";
import { loginEvents } from "../drizzle/schema";

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]);

/** Resolve an IP address to a country name using ip-api.com (2 s timeout). */
async function resolveCountry(ip: string): Promise<string | null> {
  if (LOCAL_IPS.has(ip)) return "Local";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { country?: string };
    return json.country ?? null;
  } catch {
    return null;
  }
}

/**
 * Record a login event asynchronously.
 * Call without await from the login critical path.
 */
export async function recordLoginEvent(
  userId: string,
  email: string,
  rawIp: string
): Promise<void> {
  try {
    const country = await resolveCountry(rawIp);
    const db = await getDb();
    if (!db) return;
    await db.insert(loginEvents).values({
      userId,
      email,
      ipAddress: rawIp,
      country,
    });
  } catch {
    // Swallow all errors — login must never be blocked by this helper
  }
}
