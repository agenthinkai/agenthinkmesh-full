/**
 * Portfolio Intelligence Engine — SSE Streaming Route
 * GET /api/portfolio/stream/:runType/:runId
 */

import { Router } from "express";
import { getDb } from "./db";
import { runICDecisionEngine, runCrisisSimulation, runGuardianScan } from "./portfolioEngine";
import type { PortfolioStepEvent } from "./portfolioEngine";
import { sql, eq } from "drizzle-orm";

const router = Router();

function sendEvent(res: import("express").Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.get("/stream/:runType/:runId", async (req, res) => {
  const { runType, runId } = req.params;
  const userId = (req as { user?: { id: string } }).user?.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const db = await getDb();
  if (!db) {
    sendEvent(res, "error", { message: "Database unavailable" });
    res.end();
    return;
  }

  try {
    // Fetch run record using raw SQL
    const runRows = await db.execute(
      sql`SELECT id, run_type, status, input_summary FROM portfolio_runs WHERE id = ${Number(runId)} AND user_id = ${userId} LIMIT 1`
    ) as unknown as Array<{
      id: number;
      run_type: string;
      status: string;
      input_summary: string;
    }>;

    if (!runRows.length) {
      sendEvent(res, "error", { message: "Run not found" });
      res.end();
      return;
    }

    const run = runRows[0];
    const userInput = run.input_summary || "Portfolio analysis requested";

    // Mark as running
    await db.execute(
      sql`UPDATE portfolio_runs SET status = 'running' WHERE id = ${Number(runId)}`
    );

    const onStep = async (event: PortfolioStepEvent) => {
      // For the 'complete' event, enrich with top-level decision fields
      if (event.type === "complete" && event.blackboard) {
        const bb = event.blackboard;
        sendEvent(res, "complete", {
          ...event,
          icDecision: bb.ic_decision,
          confidenceScore: bb.confidence_score,
          riskScore: bb.risk_score,
          guardianStatus: bb.guardian_status,
          threatLevel: bb.threat_level,
        });
        return;
      }
      sendEvent(res, event.type, event);

      if (event.type === "step_complete" && db) {
        const now = Date.now();
        await db.execute(
          sql`INSERT INTO portfolio_steps (run_id, agent_id, agent_name, status, output, tokens_used, duration_ms, created_at, completed_at)
              VALUES (${Number(runId)}, ${event.agentId}, ${event.agentName}, 'complete',
                      ${JSON.stringify(event.output || {})}, ${event.tokensUsed || 0},
                      ${event.durationMs || 0}, ${now - (event.durationMs || 0)}, ${now})`
        );
      }
    };

    // Emit pipeline_start so the frontend can initialize the step list
    const chainMap: Record<string, string[]> = {
      ic_decision: ["PF-IN-001","PF-IN-002","PF-RS-001","PF-RS-002","PF-RS-003","PF-PA-001","PF-PA-002","PF-DM-001"],
      guardian: ["PF-RS-001","PF-RS-002","PF-DM-004"],
      crisis: ["PF-RS-001","PF-RS-002","PF-RS-003","PF-DM-001"],
    };
    const agentNames: Record<string, string> = {
      "PF-IN-001": "IntakeParser",
      "PF-IN-002": "StrategyClassifier",
      "PF-RS-001": "RiskModeler",
      "PF-RS-002": "ExposureMapper",
      "PF-RS-003": "LiquiditySentinel",
      "PF-PA-001": "AlphaDecomposer",
      "PF-PA-002": "BenchmarkComparator",
      "PF-DM-001": "ICDecisionAgent",
      "PF-DM-004": "PortfolioGuardian",
    };
    const chain = chainMap[runType] || [];
    sendEvent(res, "pipeline_start", {
      agents: chain.map(id => ({ id, name: agentNames[id] || id })),
    });

    let finalBlackboard;
    const startTime = Date.now();

    if (runType === "ic_decision") {
      finalBlackboard = await runICDecisionEngine(userInput, onStep);
    } else if (runType === "crisis") {
      finalBlackboard = await runCrisisSimulation(userInput, onStep);
    } else if (runType === "guardian") {
      finalBlackboard = await runGuardianScan(userInput, onStep);
    } else {
      sendEvent(res, "error", { message: "Unknown run type" });
      res.end();
      return;
    }

    const duration = Date.now() - startTime;

    await db.execute(
      sql`UPDATE portfolio_runs
          SET status = 'complete',
              blackboard = ${JSON.stringify(finalBlackboard)},
              ic_decision = ${finalBlackboard.ic_decision ?? null},
              confidence_score = ${finalBlackboard.confidence_score ?? null},
              threat_level = ${finalBlackboard.threat_level ?? null},
              duration_ms = ${duration},
              completed_at = ${Date.now()}
          WHERE id = ${Number(runId)}`
    );

    // Insert guardian alerts if triggered
    if (runType === "guardian" && finalBlackboard.guardian_status !== "healthy") {
      const alerts = finalBlackboard.active_alerts || [];
      for (const alert of alerts.slice(0, 5)) {
        await db.execute(
          sql`INSERT INTO guardian_alerts (user_id, portfolio_run_id, alert_type, threat_level, title, description, recommended_action, created_at)
              VALUES (${userId}, ${Number(runId)}, 'threshold_breach',
                      ${finalBlackboard.threat_level ?? "low"}, ${alert},
                      ${"Guardian detected: " + alert},
                      ${(finalBlackboard.recommended_actions || []).join("; ")},
                      ${Date.now()})`
        );
      }
    }

    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline error";
    sendEvent(res, "error", { message });
    if (db) {
      await db.execute(
        sql`UPDATE portfolio_runs SET status = 'failed' WHERE id = ${Number(runId)}`
      ).catch(() => {});
    }
    res.end();
  }
});

export default router;
