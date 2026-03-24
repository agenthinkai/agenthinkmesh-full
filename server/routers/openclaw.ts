/**
 * openclaw.ts — tRPC router for OpenClaw A2A Integration Console
 *
 * Procedures:
 *  - openclaw.listAgents   → reads real agents from DB, enriches with clawReady flag
 *  - openclaw.testAgent    → POSTs a test payload to an agent endpoint, returns latency + response
 *  - openclaw.getManifest  → returns an OpenClaw-format manifest for a specific agent
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { agents, agentMetrics } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeGoogleAgent, type GoogleAgentType } from "../googleA2AAdapter";
import { GOOGLE_AGENT_LIST, getGoogleAgentManifest } from "../../shared/googleAgentManifests";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Determine if an agent is "Claw-ready" based on:
 * 1. connectionTested = true (endpoint has been validated)
 * 2. status = "active"
 * 3. Has at least one capability defined
 */
function isClawReady(agent: {
  connectionTested: boolean;
  status: string;
  capabilities: string;
}): boolean {
  try {
    const caps = JSON.parse(agent.capabilities || "[]");
    return agent.connectionTested && agent.status === "active" && Array.isArray(caps) && caps.length > 0;
  } catch {
    return false;
  }
}

/**
 * Build an OpenClaw-format manifest for an agent
 */
function buildManifest(agent: {
  id: number;
  agentName: string;
  description: string;
  capabilities: string;
  endpointUrl: string;
  domain: string | null;
  developerName: string;
  connectionTested: boolean;
  status: string;
}) {
  let caps: string[] = [];
  try { caps = JSON.parse(agent.capabilities || "[]"); } catch { caps = []; }

  return {
    schema_version: "openclaw/v1",
    agent_id: `mesh-agent-${agent.id}`,
    name: agent.agentName,
    description: agent.description,
    developer: agent.developerName,
    vertical: agent.domain ?? "General",
    status: agent.status,
    endpoint: {
      url: agent.endpointUrl,
      method: "POST",
      content_type: "application/json",
    },
    capabilities: caps,
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task or query to execute" },
        context: { type: "string", description: "Domain context label (e.g. Finance, Legal)" },
      },
      required: ["task"],
    },
    output_schema: {
      type: "object",
      properties: {
        result: { type: "string", description: "Agent response text" },
      },
      required: ["result"],
    },
    claw_ready: isClawReady(agent),
    registered_at: new Date().toISOString(),
  };
}

// ── Router ─────────────────────────────────────────────────────────────────

export const openclawRouter = router({
  /**
   * List all agents from the real DB, enriched with clawReady flag and manifest stub.
   * Supports optional vertical/domain filter and search query.
   */
  listAgents: publicProcedure
    .input(z.object({
      vertical: z.string().optional(),   // filter by domain
      search: z.string().optional(),     // search by name or description
      clawReadyOnly: z.boolean().default(false),
      limit: z.number().min(1).max(200).default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Build base query
      let rows = await db
        .select({
          id: agents.id,
          agentName: agents.agentName,
          developerName: agents.developerName,
          description: agents.description,
          capabilities: agents.capabilities,
          endpointUrl: agents.endpointUrl,
          domain: agents.domain,
          status: agents.status,
          connectionTested: agents.connectionTested,
          createdAt: agents.createdAt,
        })
        .from(agents)
        .orderBy(desc(agents.createdAt))
        .limit(input.limit);

      // Apply filters in JS (simpler than dynamic drizzle query building)
      if (input.vertical) {
        rows = rows.filter(r =>
          (r.domain ?? "General").toLowerCase() === input.vertical!.toLowerCase()
        );
      }

      if (input.search) {
        const q = input.search.toLowerCase();
        rows = rows.filter(r =>
          r.agentName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.domain ?? "").toLowerCase().includes(q)
        );
      }

      // Enrich with clawReady flag
      const enriched = rows.map(r => {
        let caps: string[] = [];
        try { caps = JSON.parse(r.capabilities || "[]"); } catch { caps = []; }
        return {
          ...r,
          capabilities: caps,
          clawReady: isClawReady(r),
          vertical: r.domain ?? "General",
        };
      });

      if (input.clawReadyOnly) {
        return enriched.filter(a => a.clawReady);
      }

      return enriched;
    }),

  /**
   * Test an agent endpoint by POSTing a payload and measuring latency.
   * Returns: { ok, latencyMs, statusCode, responseBody, error }
   */
  testAgent: publicProcedure
    .input(z.object({
      endpointUrl: z.string().url("Must be a valid URL"),
      payload: z.record(z.string(), z.unknown()).default({ task: "ping", context: "openclaw-test" }),
      timeoutMs: z.number().min(1000).max(30000).default(10000),
    }))
    .mutation(async ({ input }) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);

        const res = await fetch(input.endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.payload),
          signal: controller.signal as RequestInit["signal"],
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - start;
        let responseBody: unknown = null;
        let rawText = "";

        try {
          rawText = await res.text();
          responseBody = JSON.parse(rawText);
        } catch {
          responseBody = rawText;
        }

        return {
          ok: res.ok,
          latencyMs,
          statusCode: res.status,
          responseBody,
          error: res.ok ? null : `HTTP ${res.status} ${res.statusText}`,
        };
      } catch (err: unknown) {
        const latencyMs = Date.now() - start;
        const isTimeout = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          latencyMs,
          statusCode: 0,
          responseBody: null,
          error: isTimeout
            ? `Timeout after ${input.timeoutMs}ms`
            : err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),

  /**
   * Get the full OpenClaw manifest for a specific agent by ID.
   */
  getManifest: publicProcedure
    .input(z.object({ agentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.agentId))
        .limit(1);

      if (!agent) throw new Error(`Agent ${input.agentId} not found`);
      return buildManifest(agent);
    }),

  /**
   * List all Google A2A agents with their pre-built OpenClaw manifests.
   * Supports optional tag/capability filter.
   */
  listGoogleAgents: publicProcedure
    .input(z.object({
      tag: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(({ input }) => {
      let list = GOOGLE_AGENT_LIST;
      if (input.tag) {
        list = list.filter(a => a.tags.includes(input.tag!.toLowerCase()));
      }
      if (input.search) {
        const q = input.search.toLowerCase();
        list = list.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some(t => t.includes(q))
        );
      }
      return list;
    }),

  /**
   * Get the full manifest for a specific Google agent type.
   */
  getGoogleAgentManifest: publicProcedure
    .input(z.object({ agentType: z.string() }))
    .query(({ input }) => {
      return getGoogleAgentManifest(input.agentType as GoogleAgentType);
    }),

  /**
   * Invoke a Google agent via the A2A adapter.
   * In demo mode (no API key), returns a realistic simulated response.
   * Falls back to demo if live call fails.
   */
  invokeGoogleAgent: publicProcedure
    .input(z.object({
      agentType: z.enum(["gemini", "google_search", "google_workspace", "vertex_ai", "google_maps", "notebooklm"]),
      instruction: z.string().min(1).max(4000),
      context: z.record(z.string(), z.unknown()).optional(),
      inputData: z.unknown().optional(),
      apiKey: z.string().optional(), // optional — demo mode if omitted
    }))
    .mutation(async ({ input }) => {
      const taskId = `mesh-g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await invokeGoogleAgent(
        {
          taskId,
          agentType: input.agentType,
          instruction: input.instruction,
          context: input.context,
          inputData: input.inputData,
        },
        input.apiKey ?? "demo"
      );
      return result;
    }),

  /**
   * Quick connection test for a Google agent (demo latency check).
   */
  testGoogleAgent: publicProcedure
    .input(z.object({
      agentType: z.enum(["gemini", "google_search", "google_workspace", "vertex_ai", "google_maps", "notebooklm"]),
    }))
    .mutation(async ({ input }) => {
      const start = Date.now();
      const result = await invokeGoogleAgent(
        {
          taskId: `test-${Date.now()}`,
          agentType: input.agentType,
          instruction: "Connection test — respond with agent status and capabilities summary.",
        },
        "demo"
      );
      return {
        ok: result.success,
        latencyMs: result.latencyMs,
        agentType: input.agentType,
        preview: result.output.slice(0, 200),
        error: result.error ?? null,
      };
    }),

  /**
   * Get summary stats for the OpenClaw console overview.
   */
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const allAgents = await db
      .select({
        id: agents.id,
        status: agents.status,
        connectionTested: agents.connectionTested,
        capabilities: agents.capabilities,
        domain: agents.domain,
      })
      .from(agents);

    const total = allAgents.length;
    const clawReady = allAgents.filter((a: { connectionTested: boolean; status: string; capabilities: string }) => isClawReady(a)).length;

    // Count by vertical
    const verticalMap: Record<string, number> = {};
    for (const a of allAgents) {
      const v = a.domain ?? "General";
      verticalMap[v] = (verticalMap[v] ?? 0) + 1;
    }

    return {
      totalAgents: total,
      clawReadyAgents: clawReady,
      verticals: Object.entries(verticalMap).map(([name, count]) => ({ name, count })),
    };
  }),
});
