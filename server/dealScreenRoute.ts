/**
 * dealScreenRoute.ts
 *
 * REST API endpoints for Deal Screener — for batch/concurrency testing and
 * enterprise integration. Reuses runScreeningPipeline() — no business logic here.
 *
 * Routes:
 *   POST /api/deal/screen        — single deal
 *   POST /api/deal/screen/batch  — array of deals (sequential)
 *
 * Auth:
 *   Controlled by ENABLE_INTERNAL_SCREEN_API env var.
 *   When set to "true", the endpoint is open (no session required) — for internal
 *   load testing only. In all other cases, a valid Manus session cookie is required.
 *
 * Usage (open mode):
 *   ENABLE_INTERNAL_SCREEN_API=true  → no auth required, userId=null (no DB write)
 *
 * Usage (authenticated mode, default):
 *   Valid session cookie required → userId=ctx.user.id (results persisted to DB)
 */

import { Router, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runScreeningPipeline } from "./runScreeningPipeline";

const router = Router();

const INTERNAL_API_ENABLED = process.env.ENABLE_INTERNAL_SCREEN_API === "true";

// ── Auth helper ───────────────────────────────────────────────────────────────
async function resolveUserId(req: Request): Promise<number | null> {
  if (INTERNAL_API_ENABLED) return null; // anonymous mode — skip DB write
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function requireAuth(userId: number | null, res: Response): boolean {
  if (INTERNAL_API_ENABLED) return true; // open mode — no auth required
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
 *     "ic_report": { ... } | null,
 *     "universitySignal": { ... } | null
 *   }
 * }
 */
router.post("/screen", async (req: Request, res: Response): Promise<void> => {
  const routeName = "[POST /api/deal/screen]";
  try {
    const userId = await resolveUserId(req);
    if (!requireAuth(userId, res)) return;

    const { dealText, dealName, councilMode, includeReport } = req.body as {
      dealText?: string;
      dealName?: string;
      councilMode?: string;
      includeReport?: boolean;
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
      councilMode: (councilMode as "gcc" | "global_vc" | "india_pe") ?? "gcc",
      includeReport: includeReport !== false,
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
 *   "includeReport": false         // optional, default true
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "total": 3,
 *   "results": [
 *     { "index": 0, "success": true, "data": { ... } },
 *     { "index": 1, "success": false, "error": "..." }
 *   ]
 * }
 */
router.post("/screen/batch", async (req: Request, res: Response): Promise<void> => {
  const routeName = "[POST /api/deal/screen/batch]";
  try {
    const userId = await resolveUserId(req);
    if (!requireAuth(userId, res)) return;

    const { deals, councilMode, includeReport } = req.body as {
      deals?: Array<{ dealText?: string; dealName?: string }>;
      councilMode?: string;
      includeReport?: boolean;
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
          councilMode: (councilMode as "gcc" | "global_vc" | "india_pe") ?? "gcc",
          includeReport: includeReport !== false,
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

export default router;
