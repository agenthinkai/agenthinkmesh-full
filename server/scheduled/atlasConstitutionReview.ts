/**
 * atlasConstitutionReview.ts — Monthly Constitution Review Handler
 *
 * Fires on the 1st of every month at 07:00 UTC.
 * Analyses the last 30 days of performance data against the active Constitution.
 * Produces a DRAFT review report with evidence-based amendment recommendations.
 *
 * CRITICAL: This handler NEVER modifies the Constitution.
 * It only produces evidence. Human approval creates the next version.
 */

import type { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import {
  atlasConstitutionVersions,
  atlasConstitutionReviews,
  arosOutreachQueue,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET ?? "";

export async function atlasConstitutionReviewHandler(req: Request, res: Response) {
  // Auth: SCHEDULER_SECRET or Heartbeat cron header
  const authHeader = req.headers["authorization"] ?? "";
  const cronHeader = req.headers["x-manus-cron-task-uid"];
  const providedSecret = authHeader.replace("Bearer ", "").trim();

  const isAuthorized =
    cronHeader !== undefined ||
    (SCHEDULER_SECRET && providedSecret === SCHEDULER_SECRET);

  if (!isAuthorized) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = Date.now();
  console.log("[Atlas] Monthly Constitution Review started.");

  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database unavailable" });
    }

    // 1. Find the active Constitution version
    const [activeVersion] = await db
      .select()
      .from(atlasConstitutionVersions)
      .where(eq(atlasConstitutionVersions.status, "ACTIVE"))
      .orderBy(desc(atlasConstitutionVersions.effectiveDate))
      .limit(1);

    if (!activeVersion) {
      console.warn("[Atlas] No active Constitution version found — skipping review.");
      return res.json({ ok: true, skipped: true, reason: "No active constitution version" });
    }

    // 2. Gather 30-day performance data
    const periodEnd = Date.now();
    const periodStart = periodEnd - 30 * 24 * 60 * 60 * 1000;

    const queueRows = await db
      .select({
        approvalStatus: arosOutreachQueue.approvalStatus,
        openedAt: arosOutreachQueue.openedAt,
        repliedAt: arosOutreachQueue.repliedAt,
        constitutionVersion: arosOutreachQueue.constitutionVersion,
      })
      .from(arosOutreachQueue)
      .where(eq(arosOutreachQueue.constitutionVersion, activeVersion.version));

    const sent = queueRows.filter((r) => r.approvalStatus === "SENT").length;
    const opened = queueRows.filter((r) => r.openedAt !== null).length;
    const replied = queueRows.filter((r) => r.repliedAt !== null).length;

    const performanceSummary = {
      version: activeVersion.version,
      reviewPeriodDays: 30,
      totalBriefsSent: sent,
      openRate: sent > 0 ? (opened / sent).toFixed(4) : "0",
      responseRate: sent > 0 ? (replied / sent).toFixed(4) : "0",
      storedResponseRate: activeVersion.executiveResponseRate,
      storedMeetingRate: activeVersion.meetingRate,
      storedProposalRate: activeVersion.proposalRate,
      storedCustomerRate: activeVersion.customerRate,
      storedDTAccuracy: activeVersion.decisionTwinAccuracy,
      storedHVAccuracy: activeVersion.hiddenVariableAccuracy,
      storedRevenueForecastAccuracy: activeVersion.revenueForecastAccuracy,
      storedOutcomeLedgerAccuracy: activeVersion.outcomeLedgerAccuracy,
      totalBriefsSentAllTime: activeVersion.totalBriefsSent,
      totalCustomersAllTime: activeVersion.totalCustomers,
    };

    // 3. Generate LLM review (evidence-based, never auto-modifies)
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are the Atlas Constitution Review Engine.

Your role is to analyse performance data and produce evidence-based recommendations for constitutional amendments.

CRITICAL RULES:
- You NEVER modify the Constitution automatically.
- You ONLY produce evidence and recommendations.
- Human approval creates the next Constitution version.
- Every recommendation must be grounded in observable data.
- If data is insufficient, say so explicitly. Never manufacture confidence.

Return ONLY valid JSON.`,
        },
        {
          role: "user",
          content: `Generate a monthly Constitution Review Report for Atlas Constitution Version ${activeVersion.version}.

Performance Data (last 30 days):
${JSON.stringify(performanceSummary, null, 2)}

Constitution Description: ${activeVersion.description}

Return this exact JSON:
{
  "constitutionPerformance": "string (2-3 paragraph analysis)",
  "calibrationImprovements": "string (calibration accuracy analysis)",
  "hiddenVariablePerformance": "string (hidden variable prediction quality)",
  "decisionTwinAccuracy": "string (decision twin accuracy analysis)",
  "executiveEngagementTrends": "string (executive response and engagement patterns)",
  "principlesImproved": ["string array — principles that appear to improve prediction quality"],
  "principlesReduced": ["string array — principles that appear to reduce response quality"],
  "recurringFailurePatterns": ["string array — observed failure patterns"],
  "suggestedAmendments": ["string array — specific, evidence-based amendment recommendations"]
}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "constitution_review",
          strict: true,
          schema: {
            type: "object",
            properties: {
              constitutionPerformance: { type: "string" },
              calibrationImprovements: { type: "string" },
              hiddenVariablePerformance: { type: "string" },
              decisionTwinAccuracy: { type: "string" },
              executiveEngagementTrends: { type: "string" },
              principlesImproved: { type: "array", items: { type: "string" } },
              principlesReduced: { type: "array", items: { type: "string" } },
              recurringFailurePatterns: { type: "array", items: { type: "string" } },
              suggestedAmendments: { type: "array", items: { type: "string" } },
            },
            required: [
              "constitutionPerformance",
              "calibrationImprovements",
              "hiddenVariablePerformance",
              "decisionTwinAccuracy",
              "executiveEngagementTrends",
              "principlesImproved",
              "principlesReduced",
              "recurringFailurePatterns",
              "suggestedAmendments",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = llmResponse?.choices?.[0]?.message?.content;
    const parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : {};

    // 4. Persist the review report
    const [review] = await db
      .insert(atlasConstitutionReviews)
      .values({
        constitutionVersionId: activeVersion.id,
        reviewPeriodStart: periodStart,
        reviewPeriodEnd: periodEnd,
        calibratedOutcomeCount: sent,
        constitutionPerformance: parsed.constitutionPerformance ?? "",
        calibrationImprovements: parsed.calibrationImprovements ?? "",
        hiddenVariablePerformance: parsed.hiddenVariablePerformance ?? "",
        decisionTwinAccuracy: parsed.decisionTwinAccuracy ?? "",
        executiveEngagementTrends: parsed.executiveEngagementTrends ?? "",
        principlesImproved: JSON.stringify(parsed.principlesImproved ?? []),
        principlesReduced: JSON.stringify(parsed.principlesReduced ?? []),
        recurringFailurePatterns: JSON.stringify(parsed.recurringFailurePatterns ?? []),
        suggestedAmendments: JSON.stringify(parsed.suggestedAmendments ?? []),
        status: "DRAFT",
        createdAt: Date.now(),
      })
      .$returningId();

    const elapsedMs = Date.now() - startedAt;

    // 5. Notify owner
    const amendmentCount = (parsed.suggestedAmendments ?? []).length;
    await notifyOwner({
      title: `Atlas Constitution Review — v${activeVersion.version} (${amendmentCount} suggestions)`,
      content: `Monthly Constitution Review completed in ${(elapsedMs / 1000).toFixed(1)}s.\n\nPerformance: ${sent} briefs sent, ${replied} responses (${sent > 0 ? ((replied / sent) * 100).toFixed(1) : 0}% response rate).\n\n${amendmentCount} amendment suggestions generated. Review ID: ${review.id}.\n\nThis is evidence only. Human approval is required to create the next Constitution version.\n\nView at /aros/constitution/performance`,
    });

    console.log(`[Atlas] Constitution Review complete. reviewId=${review.id} elapsed=${elapsedMs}ms`);

    return res.json({
      ok: true,
      reviewId: review.id,
      constitutionVersion: activeVersion.version,
      amendmentSuggestions: amendmentCount,
      elapsedMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Atlas] Constitution Review failed:", msg);
    return res.status(500).json({ ok: false, error: msg });
  }
}
