/**
 * dealScreenRoute.ts
 *
 * REST API endpoints for Deal Screener — for batch/concurrency testing and
 * enterprise integration. Reuses runScreeningPipeline() — no business logic here.
 *
 * Routes:
 *   POST /api/deal/screen                    — single deal
 *   POST /api/deal/screen/batch              — array of deals (sequential)
 *   POST /api/deal/:dealId/generate-memo     — on-demand IC Memo generation (idempotent)
 *
 * Terminology:
 *   Screening Result = full pipeline output (triage + council + votes + rationale + verdict)
 *   IC Memo          = long-form generated investment report (expensive, optional, on-demand)
 *   Audit Trail      = stored reasoning (votes, rationales, timestamps, status)
 *
 * Auth:
 *   Controlled by ENABLE_INTERNAL_SCREEN_API env var.
 *   When set to "true", the endpoint is open (no session required) — for internal
 *   load testing only. In all other cases, a valid Manus session cookie is required.
 */

import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { dealScreenings } from "../drizzle/schema";
import { runScreeningPipeline } from "./runScreeningPipeline";
import { generateSingleDealICReport } from "./icReportEngine";
import type { CouncilResult } from "./councilEngine";
import { generateICMemoPdf } from "./icMemoPdf";

const router = Router();

// Read env var dynamically so tests can toggle it at runtime
function isInternalApiEnabled(): boolean {
  return process.env.ENABLE_INTERNAL_SCREEN_API === "true";
}

// ── Auth helper ───────────────────────────────────────────────────────────────
async function resolveUserId(req: Request): Promise<number | null> {
  if (isInternalApiEnabled()) return null; // anonymous mode — skip DB write
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function requireAuth(userId: number | null, res: Response): boolean {
  if (isInternalApiEnabled()) return true; // open mode — no auth required
  if (userId === null) {
    res.status(401).json({
      success: false,
      error: "Authentication required. Provide a valid session cookie, or set ENABLE_INTERNAL_SCREEN_API=true for internal testing.",
    });
    return false;
  }
  return true;
}

// ── POST /api/deal/screen ─────────────────────────────────────────────────────
/**
 * Screen a single deal through the full 3-layer pipeline.
 *
 * Request body:
 * {
 *   "dealText": "string",          // required
 *   "dealName": "string",          // optional, default "Untitled Deal"
 *   "councilMode": "gcc" | "global_vc" | "india_pe",  // optional, default "gcc"
 *   "includeReport": true          // optional, default true
 *   "forceReport": false           // optional — generate IC Memo even for REJECTED/VETOED
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "dealId": "uuid",
 *     "dealName": "string",
 *     "duplicate": boolean,
 *     "triage": { "decision": "...", "confidence": 0.9, "reason": "..." } | null,
 *     "council": { verdict, yesCount, noCount, ... } | null,
 *     "ic_report": { ... } | null,   // IC Memo (only if APPROVED/APPROVED_WITH_CONDITIONS or forceReport=true)
 *     "universitySignal": { ... } | null
 *   }
 * }
 */
router.post("/screen", async (req: Request, res: Response): Promise<void> => {
  const routeName = "[POST /api/deal/screen]";
  try {
    const userId = await resolveUserId(req);
    if (!requireAuth(userId, res)) return;

    const { dealText, dealName, councilMode, includeReport, forceReport } = req.body as {
      dealText?: string;
      dealName?: string;
      councilMode?: string;
      includeReport?: boolean;
      forceReport?: boolean;
    };

    // Validate required fields
    if (!dealText || typeof dealText !== "string" || !dealText.trim()) {
      res.status(400).json({
        success: false,
        error: "dealText is required and must be a non-empty string.",
      });
      return;
    }

    // Validate optional councilMode
    const validModes = ["gcc", "global_vc", "india_pe"];
    if (councilMode && !validModes.includes(councilMode)) {
      res.status(400).json({
        success: false,
        error: `councilMode must be one of: ${validModes.join(", ")}`,
      });
      return;
    }

    const result = await runScreeningPipeline({
      dealText: dealText.trim(),
      dealName: dealName?.trim(),
      councilMode: (councilMode as "gcc" | "global_vc" | "india_pe") ?? "global_vc",
      includeReport: includeReport !== false,
      forceReport: forceReport === true,
      userId,
      sourceType: "manual",
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error(`${routeName} Error:`, err);
    res.status(500).json({
      success: false,
      error: "Internal server error. Check server logs for details.",
    });
  }
});

// ── POST /api/deal/screen/batch ───────────────────────────────────────────────
/**
 * Screen multiple deals sequentially through the full pipeline.
 * Deals are processed one at a time (no parallel execution) to avoid
 * overwhelming the LLM rate limits during load testing.
 *
 * Request body:
 * {
 *   "deals": [
 *     { "dealText": "...", "dealName": "..." },
 *     { "dealText": "...", "dealName": "..." }
 *   ],
 *   "councilMode": "gcc",          // optional, applied to all deals
 *   "includeReport": false,        // optional, default true
 *   "forceReport": false           // optional — generate IC Memo for ALL deals regardless of verdict
 * }
 */
router.post("/screen/batch", async (req: Request, res: Response): Promise<void> => {
  const routeName = "[POST /api/deal/screen/batch]";
  try {
    const userId = await resolveUserId(req);
    if (!requireAuth(userId, res)) return;

    const { deals, councilMode, includeReport, forceReport } = req.body as {
      deals?: Array<{ dealText?: string; dealName?: string }>;
      councilMode?: string;
      includeReport?: boolean;
      forceReport?: boolean;
    };

    // Validate
    if (!Array.isArray(deals) || deals.length === 0) {
      res.status(400).json({
        success: false,
        error: "deals must be a non-empty array.",
      });
      return;
    }
    if (deals.length > 20) {
      res.status(400).json({
        success: false,
        error: "Batch size limit is 20 deals per request. For larger batches, split into multiple requests.",
      });
      return;
    }

    const validModes = ["gcc", "global_vc", "india_pe"];
    if (councilMode && !validModes.includes(councilMode)) {
      res.status(400).json({
        success: false,
        error: `councilMode must be one of: ${validModes.join(", ")}`,
      });
      return;
    }

    const results: Array<{ index: number; success: boolean; data?: object; error?: string }> = [];

    // Sequential processing — intentional, to avoid rate limit spikes
    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      if (!deal.dealText || typeof deal.dealText !== "string" || !deal.dealText.trim()) {
        results.push({ index: i, success: false, error: "dealText is required and must be a non-empty string." });
        continue;
      }
      try {
        const result = await runScreeningPipeline({
          dealText: deal.dealText.trim(),
          dealName: deal.dealName?.trim(),
          councilMode: (councilMode as "gcc" | "global_vc" | "india_pe") ?? "global_vc",
          includeReport: includeReport !== false,
          forceReport: forceReport === true,
          userId,
          sourceType: "manual",
        });
        results.push({ index: i, success: true, data: result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${routeName} Deal[${i}] Error:`, err);
        results.push({ index: i, success: false, error: msg });
      }
    }

    res.status(200).json({
      success: true,
      total: deals.length,
      results,
    });
  } catch (err) {
    console.error(`${routeName} Error:`, err);
    res.status(500).json({
      success: false,
      error: "Internal server error. Check server logs for details.",
    });
  }
});

// ── POST /api/deal/:dealId/generate-memo ─────────────────────────────────────
/**
 * On-demand IC Memo generation for any deal (including REJECTED/VETOED).
 *
 * Behavior:
 * - Idempotent: if memo already exists, returns cached memo unless forceRegenerate=true
 * - Persists memo text to deal_screenings.icMemoText in DB
 * - Increments icMemoVersion on each regeneration
 *
 * Request body: { forceRegenerate?: boolean }
 *
 * Response:
 * {
 *   "success": true,
 *   "memoText": "...",
 *   "memoVersion": 1,
 *   "generatedAt": "2026-04-14T...",
 *   "cached": false
 * }
 */
router.post("/:dealId/generate-memo", async (req: Request, res: Response): Promise<void> => {
  const routeName = "[POST /api/deal/:dealId/generate-memo]";
  try {
    const userId = await resolveUserId(req);
    if (!requireAuth(userId, res)) return;

    const { dealId } = req.params;
    const { forceRegenerate = false } = req.body as { forceRegenerate?: boolean };

    const db = await getDb();
    if (!db) {
      res.status(503).json({ success: false, error: "Database unavailable." });
      return;
    }

    // Fetch the screening record (scope to user unless in open mode)
    const whereClause = userId !== null
      ? and(eq(dealScreenings.dealId, dealId), eq(dealScreenings.userId, userId))
      : eq(dealScreenings.dealId, dealId);

    const [record] = await db.select().from(dealScreenings).where(whereClause);
    if (!record) {
      res.status(404).json({ success: false, error: "Screening record not found." });
      return;
    }

    // Idempotency: return cached memo if already generated and not forcing regeneration
    if (record.icMemoText && !forceRegenerate) {
      res.status(200).json({
        success: true,
        memoText: record.icMemoText,
        memoVersion: record.icMemoVersion,
        generatedAt: record.icMemoGeneratedAt,
        cached: true,
      });
      return;
    }

    // Reconstruct council result from stored fields
    let votes: object[] = [];
    try { votes = JSON.parse(record.votes || "[]"); } catch { /* ignore */ }
    let conditions: string[] = [];
    try { conditions = JSON.parse(record.conditionsToProceed || "[]"); } catch { /* ignore */ }
    let blockers: string[] = [];
    try { blockers = JSON.parse(record.blockingIssues || "[]"); } catch { /* ignore */ }

    const councilResult: CouncilResult = {
      verdict: record.verdict as CouncilResult["verdict"],
      yesCount: record.yesCount,
      noCount: record.noCount,
      hardYesCount: record.hardYesCount,
      softYesCount: record.softYesCount,
      softNoCount: record.softNoCount,
      hardNoCount: record.hardNoCount,
      // Derived fields not stored in DB — computed from stored counts
      weightedYesScore: record.hardYesCount * 1.5 + record.softYesCount * 1.0,
      weightedNoScore: record.hardNoCount * 1.5 + record.softNoCount * 1.0,
      confidenceScore: parseFloat(record.confidenceScore),
      gccVetoTriggered: record.gccVetoTriggered,
      tiebreakerTriggered: record.tiebreakerTriggered,
      tiebreakerSwingAgent: record.tiebreakerSwingAgent ?? null,
      conditionsToProceed: conditions,
      blockingIssues: blockers,
      criticalBlockers: blockers,   // alias
      hardFlags: [],                // not stored separately
      silentFails: [],              // not stored separately
      votes: votes as CouncilResult["votes"],
      decisionMemoryId: null,
      memoryContextUsed: false,
      precedents: [],
      sessionId: record.dealId,
      durationMs: 0,
      actionsTriggered: [],
    };

    // Generate the IC Memo
    const icReport = await generateSingleDealICReport(
      record.dealName,
      record.dealText,
      councilResult as Parameters<typeof generateSingleDealICReport>[2]
    );

    // Extract text from report (handle both string and object responses)
    const memoText: string = typeof icReport === "string"
      ? icReport
      : (icReport as { rawText?: string })?.rawText ?? JSON.stringify(icReport);

    const newVersion = (record.icMemoVersion ?? 0) + 1;
    const generatedAt = new Date();

    // Persist memo to DB
    await db.update(dealScreenings)
      .set({
        icMemoText: memoText,
        icMemoVersion: newVersion,
        icMemoGeneratedAt: generatedAt,
      })
      .where(eq(dealScreenings.dealId, dealId));

    console.log(`${routeName} Generated IC Memo for deal ${dealId} (version ${newVersion})`);

    res.status(200).json({
      success: true,
      memoText,
      memoVersion: newVersion,
      generatedAt,
      cached: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${routeName} Error:`, err);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── POST /api/deal/:dealId/memo-pdf ──────────────────────────────────────────
// Generate and stream a PDF of the IC Memo for a given deal.
// Uses the stored councilResult + icMemoText from DB.
router.post("/:dealId/memo-pdf", async (req: Request, res: Response): Promise<void> => {
  const routeName = "[POST /api/deal/:dealId/memo-pdf]";
  try {
    const userId = await resolveUserId(req);
    if (!requireAuth(userId, res)) return;

    const { dealId } = req.params;
    const db = await getDb();
    if (!db) { res.status(503).json({ success: false, error: "Database unavailable." }); return; }
    const whereClause = userId !== null
      ? and(eq(dealScreenings.dealId, dealId), eq(dealScreenings.userId, userId))
      : eq(dealScreenings.dealId, dealId);
    const [record] = await db.select().from(dealScreenings).where(whereClause).limit(1);
    if (!record) { res.status(404).json({ success: false, error: "Screening record not found." }); return; }

    // Parse stored votes
    let votes: Array<{
      personaId: string; personaName: string; personaRole: string;
      vote: string; confidence: number; rationale: string;
      keyFlags: string[]; conditions: string[]; blockers: string[];
    }> = [];
    try { votes = JSON.parse(record.votes || "[]"); } catch { /* ignore */ }
    let conditions: string[] = [];
    try { conditions = JSON.parse(record.conditionsToProceed || "[]"); } catch { /* ignore */ }
    let blockers: string[] = [];
    try { blockers = JSON.parse(record.blockingIssues || "[]"); } catch { /* ignore */ }

    const memoInput = {
      dealName: record.dealName,
      verdict: record.verdict,
      yesCount: record.yesCount,
      noCount: record.noCount,
      confidenceScore: parseFloat(record.confidenceScore),
      conditionsToProceed: conditions,
      blockingIssues: blockers,
      councilMode: (record.councilMode as "gcc" | "global_vc" | "india_pe" | undefined) ?? "global_vc",
      votes: votes.map(v => ({
        personaId: v.personaId ?? "",
        personaName: v.personaName ?? v.personaRole ?? "",
        personaRole: v.personaRole ?? "",
        vote: v.vote ?? "SOFT_NO",
        confidence: typeof v.confidence === "number" ? v.confidence : 0.5,
        rationale: v.rationale ?? "",
        keyFlags: Array.isArray(v.keyFlags) ? v.keyFlags : [],
        conditions: Array.isArray(v.conditions) ? v.conditions : [],
        blockers: Array.isArray(v.blockers) ? v.blockers : [],
      })),
    };

    const pdfBuffer = await generateICMemoPdf(memoInput);
    const safeName = record.dealName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `IC-Memo_${safeName}_${dateStr}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
    console.log(`${routeName} Generated PDF for deal ${dealId} (${pdfBuffer.length} bytes)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${routeName} Error:`, err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
