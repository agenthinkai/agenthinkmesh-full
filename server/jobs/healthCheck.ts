/**
 * Health-check cron job for the AgenThink curated agent registry.
 *
 * Runs every 30 minutes. For each agent with status "active" or "degraded":
 *   - POSTs a lightweight ping to endpointUrl with payload { ping: true }
 *   - 200 within 5000ms → mark lastVerifiedAt = now, reset failCount → 0
 *   - Timeout or non-200 → increment failCount
 *   - failCount >= 3 → set status = "degraded" (excluded from discovery)
 *   - failCount = 0 after previously degraded → set status = "active"
 *
 * For internal AgenThink agents (endpoint = platform's own /api/internal/agent),
 * the ping is always considered successful — these agents run via invokeLLM
 * and are always available as long as the server is up.
 */

import cron from "node-cron";
import { getDb } from "../db";
import { agents } from "../../drizzle/schema";
import { or, eq, inArray } from "drizzle-orm";

const PING_TIMEOUT_MS = 5000;
const FAIL_THRESHOLD = 3;

// Internal endpoint sentinel — these agents always pass health checks
const INTERNAL_ENDPOINT_PATTERN = "/api/internal/agent";

async function pingAgent(endpointUrl: string): Promise<boolean> {
  // Internal curated agents always pass — they run via invokeLLM on the same server
  if (endpointUrl.includes(INTERNAL_ENDPOINT_PATTERN)) {
    return true;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok; // 200–299
  } catch {
    return false; // timeout or network error
  }
}

export async function runHealthCheck(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[HealthCheck] DB unavailable — skipping run");
    return;
  }

  // Fetch all active or degraded agents — skip built-in platform agents (no real endpoint)
  const agentList = await db
    .select({
      id: agents.id,
      agentName: agents.agentName,
      endpointUrl: agents.endpointUrl,
      status: agents.status,
      failCount: agents.failCount,
      isBuiltIn: agents.isBuiltIn,
    })
    .from(agents)
    .where(
      inArray(agents.status, ["active", "degraded"])
    );

  if (agentList.length === 0) {
    console.log("[HealthCheck] No active/degraded agents to check.");
    return;
  }

  console.log(`[HealthCheck] Checking ${agentList.length} agents...`);

  for (const agent of agentList) {
    // Built-in platform agents always pass — they run via invokeLLM and have no external endpoint
    if (agent.isBuiltIn) {
      console.log(`[HealthCheck]   ✓ ${agent.agentName} [built-in, skipped]`);
      continue;
    }
    const alive = await pingAgent(agent.endpointUrl);
    const now = new Date();

    if (alive) {
      // Success: reset failCount, update lastVerifiedAt, restore active if degraded
      const newStatus = agent.status === "degraded" ? "active" : agent.status;
      await db
        .update(agents)
        .set({
          failCount: 0,
          lastVerifiedAt: now,
          status: newStatus as "active" | "inactive" | "pending" | "degraded",
        })
        .where(eq(agents.id, agent.id));

      const restored = agent.status === "degraded" ? " [RESTORED → active]" : "";
      console.log(`[HealthCheck]   ✓ ${agent.agentName}${restored}`);
    } else {
      // Failure: increment failCount
      const newFailCount = (agent.failCount ?? 0) + 1;
      const newStatus: "active" | "inactive" | "pending" | "degraded" =
        newFailCount >= FAIL_THRESHOLD ? "degraded" : (agent.status as "active" | "inactive" | "pending" | "degraded");

      await db
        .update(agents)
        .set({
          failCount: newFailCount,
          status: newStatus,
        })
        .where(eq(agents.id, agent.id));

      const degradedNote = newStatus === "degraded" ? ` [DEGRADED after ${newFailCount} failures]` : ` [fail ${newFailCount}/${FAIL_THRESHOLD}]`;
      console.log(`[HealthCheck]   ✗ ${agent.agentName}${degradedNote}`);
    }
  }

  console.log("[HealthCheck] Run complete.");
}

/**
 * Start the health-check cron job.
 * Runs immediately on startup, then every 30 minutes.
 */
export function startHealthCheckJob(): void {
  // Run once immediately on server startup
  runHealthCheck().catch((err) =>
    console.error("[HealthCheck] Initial run failed:", err)
  );

  // Then every 30 minutes
  cron.schedule("0 */30 * * * *", () => {
    runHealthCheck().catch((err) =>
      console.error("[HealthCheck] Scheduled run failed:", err)
    );
  });

  console.log("[HealthCheck] Cron job scheduled (every 30 minutes).");
}
