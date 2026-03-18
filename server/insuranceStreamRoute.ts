/**
 * Insurance & Reinsurance Intelligence Engine — SSE Streaming Route
 * GET /api/insurance/stream/:runType/:runId
 */

import { Router } from "express";
import { getDb } from "./db";
import {
  runUnderwritingEngine,
  runTreatyAnalysis,
  runClaimsIntelligence,
  runComplianceScan,
  runCatModel,
} from "./insuranceEngine";
import type { InsuranceStepEvent } from "./insuranceEngine";
import { CHAIN_MAP, getInsuranceAgentById } from "../shared/insuranceAgents";
import { sql } from "drizzle-orm";

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
    // Fetch run record
    const runRows = await db.execute(
      sql`SELECT id, runType, status, inputSummary FROM insurance_runs WHERE id = ${Number(runId)} AND userId = ${userId} LIMIT 1`
    ) as unknown as Array<{
      id: number;
      runType: string;
      status: string;
      inputSummary: string;
    }>;

    if (!runRows.length) {
      sendEvent(res, "error", { message: "Run not found" });
      res.end();
      return;
    }

    const run = runRows[0];
    const userInput = run.inputSummary || "Insurance risk analysis requested";

    // Mark as running
    await db.execute(
      sql`UPDATE insurance_runs SET status = 'running' WHERE id = ${Number(runId)}`
    );

    // Emit pipeline_start with agent list for this workflow
    const chain = CHAIN_MAP[runType] || [];
    sendEvent(res, "pipeline_start", {
      agents: chain.map(id => {
        const agent = getInsuranceAgentById(id);
        return { id, name: agent?.name || id };
      }),
    });

    // Step callback — streams each event and persists to DB
    const onStep = async (event: InsuranceStepEvent) => {
      // Enrich the complete event with top-level decision fields
      if (event.type === "complete" && event.blackboard) {
        const bb = event.blackboard;
        sendEvent(res, "complete", {
          ...event,
          uwDecision: bb.uw_decision,
          confidenceScore: bb.confidence_score,
          riskScore: bb.risk_score,
          takafulCompliant: bb.takaful_compliant,
          treatyRecommendation: bb.treaty_recommendation,
          premiumIndication: bb.premium_indication,
        });
        return;
      }

      sendEvent(res, event.type, event);

      // Persist completed steps
      if (event.type === "step_complete" && db) {
        const now = Date.now();
        await db.execute(
          sql`INSERT INTO insurance_steps (runId, agentId, agentName, status, output, tokensUsed, durationMs, createdAt, completedAt)
              VALUES (${Number(runId)}, ${event.agentId}, ${event.agentName}, 'complete',
                      ${JSON.stringify(event.output || {})}, ${event.tokensUsed || 0},
                      ${event.durationMs || 0}, ${new Date(now - (event.durationMs || 0))}, ${new Date(now)})`
        );
      }
    };

    let finalBlackboard;
    const startTime = Date.now();

    if (runType === "underwriting") {
      finalBlackboard = await runUnderwritingEngine(userInput, onStep);
    } else if (runType === "treaty") {
      finalBlackboard = await runTreatyAnalysis(userInput, onStep);
    } else if (runType === "claims") {
      finalBlackboard = await runClaimsIntelligence(userInput, onStep);
    } else if (runType === "compliance") {
      finalBlackboard = await runComplianceScan(userInput, onStep);
    } else if (runType === "cat_model") {
      finalBlackboard = await runCatModel(userInput, onStep);
    } else {
      sendEvent(res, "error", { message: `Unknown run type: ${runType}` });
      res.end();
      return;
    }

    const duration = Date.now() - startTime;

    // Persist final result
    await db.execute(
      sql`UPDATE insurance_runs
          SET status = 'complete',
              blackboard = ${JSON.stringify(finalBlackboard)},
              uwDecision = ${finalBlackboard.uw_decision ?? null},
              confidenceScore = ${finalBlackboard.confidence_score ?? null},
              riskScore = ${finalBlackboard.risk_score ?? null},
              premiumIndication = ${finalBlackboard.premium_indication ?? null},
              takafulCompliant = ${finalBlackboard.takaful_compliant ?? null},
              treatyRecommendation = ${finalBlackboard.treaty_recommendation ?? null},
              cessionRate = ${finalBlackboard.optimal_cession_rate ? String(finalBlackboard.optimal_cession_rate) : null},
              threatLevel = ${finalBlackboard.risk_score ? (finalBlackboard.risk_score > 75 ? 'high' : finalBlackboard.risk_score > 50 ? 'medium' : 'low') : 'low'},
              durationMs = ${duration},
              completedAt = ${new Date()}
          WHERE id = ${Number(runId)}`
    );

    // Insert Takaful alerts if compliance issues found
    if (finalBlackboard.compliance_issues && finalBlackboard.compliance_issues.length > 0) {
      for (const issue of (finalBlackboard.compliance_issues as string[]).slice(0, 5)) {
        await db.execute(
          sql`INSERT INTO takaful_alerts (userId, insuranceRunId, alertType, severity, title, description, recommendedAction, createdAt)
              VALUES (${userId}, ${Number(runId)}, 'shariah_compliance',
                      ${finalBlackboard.gharar_level === 'excessive' ? 'critical' : 'warning'},
                      ${issue},
                      ${"Shariah compliance issue detected: " + issue},
                      ${"Review with Shariah Supervisory Board before binding."},
                      ${new Date()})`
        );
      }
    }

    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline error";
    sendEvent(res, "error", { message });
    if (db) {
      await db.execute(
        sql`UPDATE insurance_runs SET status = 'failed' WHERE id = ${Number(runId)}`
      ).catch(() => {});
    }
    res.end();
  }
});

export default router;
