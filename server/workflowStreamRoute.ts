/**
 * workflowStreamRoute — Server-Sent Events endpoint for the Rosie Protocol pipeline.
 *
 * GET /api/workflow/stream?sessionId=<id>&userId=<id>
 *
 * Emits one SSE event per agent step as it completes:
 *   event: step
 *   data: { stepIndex, agentName, status, output?, error?, tokenUsage, progress }
 *
 * Final event:
 *   event: complete | failed
 *   data: { sessionId, totalTokens, durationMs }
 */

import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { runFullWorkflowSSE } from "./multiAgentSolveSSE";
import type { AgentOutput } from "./multiAgentSolve";
import { getDb } from "./db";
import { organizations, workflowRuns } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Helper: send a typed SSE event
function sendEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// GET /api/workflow/stream
router.get("/stream", async (req: Request, res: Response) => {
  const { sessionId, workflowType = "rosie_protocol", userId, orgId, fromStep, inputText } = req.query as Record<string, string>;

  if (!userId) {
    res.status(401).json({ error: "userId required" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Keep-alive ping every 15s
  const pingInterval = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  const cleanup = () => {
    clearInterval(pingInterval);
  };

  req.on("close", cleanup);

  try {
    const db = await getDb();

    // ── Fortress Gateway: domain whitelist check ──────────────────────────────
    if (db && orgId) {
      const org = await db.select().from(organizations).where(eq(organizations.id, Number(orgId))).limit(1);
      if (!org[0] || org[0].status !== "active") {
        sendEvent(res, "error", { code: "FORBIDDEN", message: "Organisation not approved for Rosie Protocol access." });
        res.end();
        cleanup();
        return;
      }
      // Token quota check
      if (org[0].dailyTokensUsed >= org[0].dailyTokenLimit) {
        sendEvent(res, "error", { code: "QUOTA_EXCEEDED", message: `Daily token limit of ${org[0].dailyTokenLimit} reached. Resets at midnight.` });
        res.end();
        cleanup();
        return;
      }
    }

    // ── Resolve or create session ─────────────────────────────────────────────
    const sid = sessionId || randomUUID();

    // Source documents from inputText (plain text input for now; Vault docs wired separately)
    const sourceDocuments = inputText
      ? [{ fileName: "User Input", extractedText: inputText, fileUrl: undefined }]
      : [];

    // Emit session start
    sendEvent(res, "start", { sessionId: sid, workflowType, totalSteps: 6 });

    // ── Run pipeline with per-step callbacks ──────────────────────────────────
    await runFullWorkflowSSE({
      sessionId: sid,
      workflowType,
      userId: Number(userId),
      organizationId: orgId ? Number(orgId) : undefined,
      sourceDocuments,
      fromStep: fromStep ? Number(fromStep) : 0,
      onStepStart: (stepIndex: number, agentName: string) => {
        sendEvent(res, "step_start", { stepIndex, agentName, status: "running" });
      },
      onStepComplete: (stepIndex: number, agentName: string, output: AgentOutput) => {
        sendEvent(res, "step_complete", {
          stepIndex,
          agentName,
          status: "complete",
          summary: output.summary,
          entities: output.entities,
          confidenceLevel: output.confidenceLevel,
          warnings: output.warnings,
          tokensUsed: output.tokensUsed,
          durationMs: output.durationMs,
        });
      },
      onStepFailed: (stepIndex: number, agentName: string, error: string) => {
        sendEvent(res, "step_failed", { stepIndex, agentName, status: "failed", error });
      },
    });

    // Fetch final run state
    let totalTokens = 0;
    let durationMs = 0;
    if (db) {
      const run = await db.select().from(workflowRuns).where(eq(workflowRuns.sessionId, sid)).limit(1);
      totalTokens = run[0]?.totalTokensUsed ?? 0;
      durationMs = run[0]?.durationMs ?? 0;
    }

    sendEvent(res, "complete", { sessionId: sid, totalTokens, durationMs });
  } catch (err: any) {
    sendEvent(res, "error", { code: "INTERNAL_ERROR", message: err?.message || "Pipeline failed" });
  } finally {
    cleanup();
    res.end();
  }
});

export default router;
