/**
 * loginEvents.ts
 *
 * Fire-and-forget helper that records a login event (IP + country) to the
 * login_events table and alerts the owner when a user logs in from a new
 * country for the first time. Never throws — all errors are swallowed so
 * the login flow is never blocked.
 */
import { eq, ne, and, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { loginEvents } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";

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

    // --- Anomaly detection: check prior countries BEFORE inserting this event ---
    // Only alert when country is known (non-null)
    if (country !== null) {
      const priorRows = await db
        .select({ country: loginEvents.country })
        .from(loginEvents)
        .where(
          and(
            eq(loginEvents.userId, userId),
            isNotNull(loginEvents.country),
            // Exclude rows that already have this country so we can detect "first time"
            ne(loginEvents.country, country)
          )
        )
        .limit(1);

      // Count all prior events for this user (to distinguish "first login ever")
      const allPriorRows = await db
        .select({ country: loginEvents.country })
        .from(loginEvents)
        .where(eq(loginEvents.userId, userId))
        .limit(1);

      const hasAnyPriorLogin = allPriorRows.length > 0;

      // Check if the current country was ever seen before
      const priorCountriesWithCurrent = await db
        .select({ country: loginEvents.country })
        .from(loginEvents)
        .where(
          and(
            eq(loginEvents.userId, userId),
            eq(loginEvents.country, country)
          )
        )
        .limit(1);

      const isNewCountry = priorCountriesWithCurrent.length === 0;

      // Alert only when: user has prior logins AND this country is new
      if (hasAnyPriorLogin && isNewCountry) {
        // Fire-and-forget — do not block the login flow
        void (async () => {
          try {
            await notifyOwner({
              title: "Login from new country",
              content: `${email} logged in from ${country} for the first time. IP: ${rawIp}`,
            });
          } catch (err) {
            console.error("[loginEvents] notifyOwner failed:", err);
          }
        })();
      }
    }

    // Insert the event row
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
