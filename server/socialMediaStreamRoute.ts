// ─── Social Media Stream Route ────────────────────────────────────────────────
// SSE endpoint: GET /api/social/stream/:runId
// Streams social media pipeline events to the frontend in real time.

import { Router } from "express";
import { getDb } from "./db";
import { admeshRuns, admeshSteps } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { runSocialPipeline, type SocialEvent, type SocialRunConfig, type SocialWorkflowType } from "./socialMediaEngine";

export const socialMediaStreamRouter = Router();

socialMediaStreamRouter.get("/stream/:runId", async (req, res) => {
  const runId = parseInt(req.params.runId, 10);
  if (isNaN(runId)) {
    res.status(400).json({ error: "Invalid runId" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    (res as unknown as { flush?: () => void }).flush?.();
  };

  const db = await getDb();
  if (!db) {
    send("error", { message: "Database unavailable" });
    res.end();
    return;
  }

  // Load the run record
  const runs = await db.select().from(admeshRuns).where(eq(admeshRuns.id, runId)).limit(1);
  const run = runs[0];
  if (!run) {
    send("error", { message: `Run ${runId} not found` });
    res.end();
    return;
  }

  // Mark run as running
  await db.update(admeshRuns).set({ status: "running" }).where(eq(admeshRuns.id, runId));

  let competitors: string[] = [];
  try { competitors = JSON.parse(run.competitors || "[]"); } catch { competitors = []; }

  // Build config from run record — workflowType is stored in brandVoice field for social runs
  const workflowType = (run.brandVoice as SocialWorkflowType) || "arabic_localizer";
  const config: SocialRunConfig = {
    runId,
    workflowType,
    brandName: run.brandName,
    market: run.market,
    // Pass through extra config from category field (JSON-encoded for social runs)
    ...((() => {
      try { return JSON.parse(run.category || "{}"); } catch { return {}; }
    })()),
  };

  // Event handler
  const onEvent = async (event: SocialEvent) => {
    send(event.type, event);

    // Persist step records
    if (event.type === "agent_start" && event.agentId) {
      await db.insert(admeshSteps).values({
        runId,
        agentId: event.agentId,
        agentName: event.agentName ?? event.agentId,
        status: "running",
      }).catch(() => {});
    }

    if ((event.type === "agent_complete" || event.type === "agent_failed") && event.agentId) {
      await db
        .update(admeshSteps)
        .set({
          status: event.type === "agent_complete" ? "complete" : "failed",
          output: JSON.stringify(event.output ?? event.error ?? null),
        })
        .where(eq(admeshSteps.agentId, event.agentId))
        .catch(() => {});
    }

    if (event.type === "pipeline_complete") {
      await db
        .update(admeshRuns)
        .set({
          status: "complete",
          blackboard: JSON.stringify(event.result ?? null),
          completedAt: new Date(),
        })
        .where(eq(admeshRuns.id, runId))
        .catch(() => {});
    }

    if (event.type === "pipeline_failed") {
      await db
        .update(admeshRuns)
        .set({ status: "failed" })
        .where(eq(admeshRuns.id, runId))
        .catch(() => {});
    }
  };

  // Run the pipeline
  try {
    await runSocialPipeline(config, onEvent);
  } catch (err) {
    send("pipeline_failed", { error: String(err) });
    await db.update(admeshRuns).set({ status: "failed" }).where(eq(admeshRuns.id, runId)).catch(() => {});
  } finally {
    res.end();
  }
});
