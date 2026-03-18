// ─── AdMesh SSE Stream Route ──────────────────────────────────────────────────
// GET /api/admesh/stream/:runId
// Streams pipeline events as Server-Sent Events.
import { Router } from "express";
import { getDb } from "./db";
import { admeshRuns, admeshSteps, admeshAds } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { runAdmeshPipeline, type AdmeshEvent } from "./admeshEngine";

const router = Router();

router.get("/stream/:runId", async (req, res) => {
  const runId = parseInt(req.params.runId, 10);
  if (isNaN(runId)) {
    res.status(400).json({ error: "Invalid runId" });
    return;
  }

  // Fetch run config from DB
  const db = await getDb();
  if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
  const runs = await db.select().from(admeshRuns).where(eq(admeshRuns.id, runId)).limit(1);
  if (!runs.length) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const run = runs[0];

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: AdmeshEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === 'function') (res as unknown as { flush: () => void }).flush();
  };

  // Mark run as running
  await db.update(admeshRuns).set({ status: "running" }).where(eq(admeshRuns.id, runId));

  const stepIds: Record<string, number> = {};
  const startTime = Date.now();
  const dbRef = db;

  const onEvent = async (event: AdmeshEvent) => {
    send(event);

    try {
      if (event.type === "agent_start" && event.agentId) {
        const [step] = await dbRef.insert(admeshSteps).values({
          runId,
          agentId: event.agentId,
          agentName: event.agentName ?? event.agentId,
          status: "running",
        }).$returningId();
        if (step) stepIds[event.agentId] = step.id;
      }

      if (event.type === "agent_complete" && event.agentId) {
        const stepId = stepIds[event.agentId];
        if (stepId) {
          await dbRef.update(admeshSteps).set({
            status: "complete",
            output: JSON.stringify(event.output),
            completedAt: new Date(),
          }).where(eq(admeshSteps.id, stepId));
        }
      }

      if (event.type === "agent_failed" && event.agentId) {
        const stepId = stepIds[event.agentId];
        if (stepId) {
          await dbRef.update(admeshSteps).set({
            status: "failed",
            output: JSON.stringify({ error: event.error }),
            completedAt: new Date(),
          }).where(eq(admeshSteps.id, stepId));
        }
      }

      if (event.type === "pipeline_complete") {
        const durationMs = Date.now() - startTime;

        // Persist ads
        if (event.ads && event.ads.length > 0) {
          for (const ad of event.ads) {
            await dbRef.insert(admeshAds).values({
              runId,
              language: ad.language,
              adIndex: ad.adIndex,
              hook: ad.hook,
              body: ad.body,
              cta: ad.cta,
              visualDirection: ad.visualDirection,
              targetAudience: ad.targetAudience,
              hookScore: ad.hookScore,
              clarityScore: ad.clarityScore,
              brandFitScore: ad.brandFitScore,
              localRelevanceScore: ad.localRelevanceScore,
              ctrPotentialScore: ad.ctrPotentialScore,
              overallScore: ad.overallScore,
              isTopPick: ad.isTopPick,
            });
          }
        }

        // Update run record
        await dbRef.update(admeshRuns).set({
          status: "complete",
          competitorInsights: JSON.stringify(event.competitorInsights),
          strategy: JSON.stringify(event.strategy),
          performanceInsights: JSON.stringify(event.performanceInsights),
          blackboard: JSON.stringify({ storyboards: event.storyboards }),
          totalTokens: event.totalTokens,
          durationMs,
          completedAt: new Date(),
        }).where(eq(admeshRuns.id, runId));
      }

      if (event.type === "pipeline_failed") {
        await dbRef.update(admeshRuns).set({ status: "failed" }).where(eq(admeshRuns.id, runId));
      }
    } catch (dbErr) {
      console.error("[AdMesh SSE] DB error:", dbErr);
    }
  };

  const config = {
    runId,
    brandName: run.brandName,
    brandVoice: run.brandVoice,
    category: run.category,
    market: run.market,
    competitors: run.competitors ? JSON.parse(run.competitors) as string[] : [],
    languages: run.languages,
    mode: run.mode,
  };

  try {
    await runAdmeshPipeline(config, (event) => { void onEvent(event); });
  } catch (err) {
    send({ type: "pipeline_failed", error: String(err) });
  } finally {
    res.end();
  }
});

export default router;
