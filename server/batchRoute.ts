/**
 * Batch Orchestration Layer
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/batch/create   — Enqueue a batch of deals, start worker pool
 * GET  /api/batch/:id/status — Poll live status of all deal items in a batch
 *
 * Architecture:
 *   1. Client uploads files → /api/dataroom/upload → gets deal list
 *   2. Client POSTs deal list → /api/batch/create → gets batchId instantly
 *   3. Server spawns worker pool (CONCURRENCY=2) in background
 *   4. Client polls /api/batch/:id/status every 2s for live updates
 *   5. When all items done, client transitions to results grid
 */
import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import { batchJobs, batchDealItems } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { runScreeningPipeline } from "./runScreeningPipeline";
import { sdk } from "./_core/sdk";

const router = Router();

// ── Worker pool concurrency ───────────────────────────────────────────────────
const CONCURRENCY = 2; // 2 concurrent deals = 20 simultaneous agent calls (safe)

// ── Auth helper ───────────────────────────────────────────────────────────────
function isInternalMode(): boolean {
  return process.env.ENABLE_INTERNAL_SCREEN_API === "true";
}
async function resolveUserId(req: Request): Promise<number | null> {
  if (isInternalMode()) return 0;
  try {
    const user = await sdk.authenticateRequest(req);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ── In-memory set of active batch workers (prevents double-start on restart) ──
const activeWorkers = new Set<string>();

// ── Background worker pool ────────────────────────────────────────────────────
async function runBatchWorkerPool(batchId: string, userId: number): Promise<void> {
  if (activeWorkers.has(batchId)) return; // already running
  activeWorkers.add(batchId);

  const db = await getDb();
  if (!db) { activeWorkers.delete(batchId); return; }
  try {
    // Mark batch as processing
    await db.update(batchJobs)
      .set({ status: "processing" })
      .where(eq(batchJobs.batchId, batchId));

    // Fetch all queued items for this batch
    const items = await db.select()
      .from(batchDealItems)
      .where(eq(batchDealItems.batchId, batchId));

    let nextIndex = 0;

    const processItem = async (item: typeof items[0]): Promise<void> => {
      // Mark item as processing
      await db.update(batchDealItems)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(batchDealItems.id, item.id));

      let attempt = 0;
      const MAX_ATTEMPTS = 2;

      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
          const result = await runScreeningPipeline({
            dealText: item.dealText,
            dealName: item.dealName,
            councilMode: item.councilMode as "gcc" | "global_vc" | "india_pe",
            includeReport: true,
            forceReport: true,
            userId,
            sourceType: "manual",
          });

          const council = result.council as Record<string, unknown> | null;
          const verdict = council?.verdict as string | undefined;
          const yesCount = typeof council?.yesCount === "number" ? council.yesCount : 0;
          const noCount  = typeof council?.noCount  === "number" ? council.noCount  : 0;
          const hasIcReport = !!result.ic_report;

          // Build full councilResult blob for drill-down
          const councilResult = council ? JSON.stringify({
            ...council,
            icReport: result.ic_report,
            dealName: item.dealName,
            dealId: result.dealId ?? council.dealId,
            dealText: item.dealText,
          }) : null;

          await db.update(batchDealItems)
            .set({
              status: "completed",
              verdict: (verdict as "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED") ?? null,
              yesCount,
              noCount,
              hasIcReport,
              councilResult,
              completedAt: new Date(),
            })
            .where(eq(batchDealItems.id, item.id));

          // Increment batch completed count
          const [job] = await db.select().from(batchJobs).where(eq(batchJobs.batchId, batchId));
          if (job) {
            await db.update(batchJobs)
              .set({ completedCount: job.completedCount + 1 })
              .where(eq(batchJobs.batchId, batchId));
          }
          return; // success — exit retry loop

        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[BatchWorker] batchId=${batchId} item=${item.id} attempt=${attempt} error:`, msg);

          if (attempt < MAX_ATTEMPTS) {
            // Wait 5s before retry
            await new Promise(r => setTimeout(r, 5000));
          } else {
            // Final failure
            await db.update(batchDealItems)
              .set({ status: "failed", errorMessage: msg, completedAt: new Date() })
              .where(eq(batchDealItems.id, item.id));

            const [job] = await db.select().from(batchJobs).where(eq(batchJobs.batchId, batchId));
            if (job) {
              await db.update(batchJobs)
                .set({ failedCount: job.failedCount + 1 })
                .where(eq(batchJobs.batchId, batchId));
            }
          }
        }
      }
    }

    // Worker pool — CONCURRENCY workers pulling from the item queue
    const worker = async (): Promise<void> => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await processItem(item);
      }
    }

    const workers: Promise<void>[] = Array.from(
      { length: Math.min(CONCURRENCY, items.length) },
      () => worker()
    );
    await Promise.all(workers);

    // Mark batch as completed (or partial if some failed)
    const [finalJob] = await db.select().from(batchJobs).where(eq(batchJobs.batchId, batchId));
    if (finalJob) {
      const finalStatus = finalJob.failedCount > 0 ? "partial" : "completed";
      await db.update(batchJobs)
        .set({ status: finalStatus, completedAt: new Date() })
        .where(eq(batchJobs.batchId, batchId));
    }

  } catch (err) {
    console.error(`[BatchWorker] Fatal error for batchId=${batchId}:`, err);
  } finally {
    activeWorkers.delete(batchId);
  }
}

// ── POST /api/batch/create ────────────────────────────────────────────────────
/**
 * Enqueue a batch of deals for processing.
 *
 * Request body:
 * {
 *   "deals": [
 *     { "dealName": "...", "dealText": "...", "councilMode": "gcc" },
 *     ...
 *   ]
 * }
 *
 * Response:
 * { "success": true, "batchId": "uuid-...", "totalDeals": 3 }
 */
router.post("/create", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (userId === null) {
      res.status(401).json({ success: false, error: "Authentication required." });
      return;
    }

    const { deals } = req.body as {
      deals?: Array<{ dealName?: string; dealText?: string; councilMode?: string }>;
    };

    if (!Array.isArray(deals) || deals.length === 0) {
      res.status(400).json({ success: false, error: "deals must be a non-empty array." });
      return;
    }
    if (deals.length > 20) {
      res.status(400).json({ success: false, error: "Batch limit is 20 deals per request." });
      return;
    }

    const validModes = new Set(["gcc", "global_vc", "india_pe"]);
    const batchId = randomUUID();

    const db4 = await getDb();
    if (!db4) { res.status(503).json({ success: false, error: "Database unavailable." }); return; }

    // Create batch job record
    await db4.insert(batchJobs).values({
      batchId,
      userId,
      status: "queued",
      totalDeals: deals.length,
      completedCount: 0,
      failedCount: 0,
    });

    // Create individual deal item records
    const itemRows = deals.map((d, i) => ({
      batchId,
      itemIndex: i,
      dealName: (d.dealName ?? `Deal ${i + 1}`).trim(),
      dealText: (d.dealText ?? "").trim(),
      councilMode: (validModes.has(d.councilMode ?? "") ? d.councilMode : "gcc") as "gcc" | "global_vc" | "india_pe",
      status: "queued" as const,
    }));

    await db4.insert(batchDealItems).values(itemRows);

    // Start background worker pool (fire-and-forget)
    runBatchWorkerPool(batchId, userId).catch(err =>
      console.error(`[BatchRoute] Worker pool error for ${batchId}:`, err)
    );

    res.json({ success: true, batchId, totalDeals: deals.length });

  } catch (err) {
    console.error("[POST /api/batch/create] Error:", err);
    res.status(500).json({ success: false, error: "Failed to create batch job." });
  }
});

// ── GET /api/batch/:batchId/status ────────────────────────────────────────────
/**
 * Poll the live status of a batch job.
 *
 * Response:
 * {
 *   "success": true,
 *   "batchId": "...",
 *   "status": "processing",
 *   "totalDeals": 3,
 *   "completedCount": 2,
 *   "failedCount": 0,
 *   "items": [
 *     {
 *       "index": 0, "dealName": "...", "councilMode": "gcc",
 *       "status": "completed", "verdict": "REJECTED",
 *       "yesCount": 2, "noCount": 8, "hasIcReport": true,
 *       "councilResult": { ... }  // full object, null if not complete
 *     },
 *     ...
 *   ]
 * }
 */
router.get("/:batchId/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (userId === null) {
      res.status(401).json({ success: false, error: "Authentication required." });
      return;
    }

    const { batchId } = req.params;

    const db2 = await getDb();
    if (!db2) { res.status(503).json({ success: false, error: "Database unavailable." }); return; }

    const [job] = await db2.select()
      .from(batchJobs)
      .where(and(eq(batchJobs.batchId, batchId), eq(batchJobs.userId, userId)));

    if (!job) {
      res.status(404).json({ success: false, error: "Batch job not found." });
      return;
    }

    const items = await db2.select()
      .from(batchDealItems)
      .where(eq(batchDealItems.batchId, batchId));

    // Sort by itemIndex for consistent ordering
    items.sort((a: typeof items[0], b: typeof items[0]) => a.itemIndex - b.itemIndex);

    const itemsOut = items.map((item: typeof items[0]) => ({
      index: item.itemIndex,
      dealName: item.dealName,
      councilMode: item.councilMode,
      status: item.status,
      verdict: item.verdict ?? null,
      yesCount: item.yesCount ?? null,
      noCount: item.noCount ?? null,
      hasIcReport: item.hasIcReport,
      councilResult: item.councilResult ? JSON.parse(item.councilResult) : null,
      error: item.errorMessage ?? null,
    }));

    res.json({
      success: true,
      batchId: job.batchId,
      status: job.status,
      totalDeals: job.totalDeals,
      completedCount: job.completedCount,
      failedCount: job.failedCount,
      items: itemsOut,
    });

  } catch (err) {
    console.error("[GET /api/batch/:batchId/status] Error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch batch status." });
  }

});

// ── POST /api/batch/:batchId/retry-item ──────────────────────────────────────
/**
 * Retry a single failed item in a batch.
 * Body: { "itemIndex": 0 }
 */
router.post("/:batchId/retry-item", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveUserId(req);
    if (userId === null) {
      res.status(401).json({ success: false, error: "Authentication required." });
      return;
    }

    const { batchId } = req.params;
    const { itemIndex } = req.body as { itemIndex?: number };

    if (typeof itemIndex !== "number") {
      res.status(400).json({ success: false, error: "itemIndex is required." });
      return;
    }

    const db3 = await getDb();
    if (!db3) { res.status(503).json({ success: false, error: "Database unavailable." }); return; }

    const [job] = await db3.select()
      .from(batchJobs)
      .where(and(eq(batchJobs.batchId, batchId), eq(batchJobs.userId, userId)));

    if (!job) {
      res.status(404).json({ success: false, error: "Batch job not found." });
      return;
    }

    const [item] = await db3.select()
      .from(batchDealItems)
      .where(and(eq(batchDealItems.batchId, batchId), eq(batchDealItems.itemIndex, itemIndex)));

    if (!item || item.status !== "failed") {
      res.status(400).json({ success: false, error: "Item not found or not in failed state." });
      return;
    }

    // Reset item to queued
    await db3.update(batchDealItems)
      .set({ status: "queued", errorMessage: null, startedAt: null, completedAt: null })
      .where(eq(batchDealItems.id, item.id));

    // Decrement failedCount, reset batch status to processing
    await db3.update(batchJobs)
      .set({
        status: "processing",
        failedCount: Math.max(0, job.failedCount - 1),
      })
      .where(eq(batchJobs.batchId, batchId));

    // Process the single item in background
    (async () => {
      const db5 = await getDb();
      if (!db5) return;
      await db5.update(batchDealItems)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(batchDealItems.id, item.id));

      try {
        const result = await runScreeningPipeline({
          dealText: item.dealText,
          dealName: item.dealName,
          councilMode: item.councilMode as "gcc" | "global_vc" | "india_pe",
          includeReport: true,
          forceReport: true,
          userId,
          sourceType: "manual",
        });

        const council = result.council as Record<string, unknown> | null;
        const verdict = council?.verdict as string | undefined;
        const yesCount = typeof council?.yesCount === "number" ? council.yesCount : 0;
        const noCount  = typeof council?.noCount  === "number" ? council.noCount  : 0;
        const hasIcReport = !!result.ic_report;
        const councilResult = council ? JSON.stringify({
          ...council,
          icReport: result.ic_report,
          dealName: item.dealName,
          dealId: result.dealId ?? council.dealId,
          dealText: item.dealText,
        }) : null;

         await db5.update(batchDealItems)
          .set({
            status: "completed",
            verdict: (verdict as "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED") ?? null,
            yesCount, noCount, hasIcReport, councilResult,
            completedAt: new Date(),
          })
          .where(eq(batchDealItems.id, item.id));
        const [updatedJob] = await db5.select().from(batchJobs).where(eq(batchJobs.batchId, batchId));
        if (updatedJob) {
          const allItems = await db5.select().from(batchDealItems).where(eq(batchDealItems.batchId, batchId));
          const allDone = allItems.every((i: typeof allItems[0]) => i.status === "completed" || i.status === "failed");
          const anyFailed = allItems.some((i: typeof allItems[0]) => i.status === "failed");
          await db5.update(batchJobs)
            .set({
              completedCount: updatedJob.completedCount + 1,
              status: allDone ? (anyFailed ? "partial" : "completed") : "processing",
              completedAt: allDone ? new Date() : null,
            })
            .where(eq(batchJobs.batchId, batchId));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db5.update(batchDealItems)
          .set({ status: "failed", errorMessage: msg, completedAt: new Date() })
          .where(eq(batchDealItems.id, item.id));
        const [updatedJob] = await db5.select().from(batchJobs).where(eq(batchJobs.batchId, batchId));
        if (updatedJob) {
          await db5.update(batchJobs)
            .set({ failedCount: updatedJob.failedCount + 1, status: "partial" })
            .where(eq(batchJobs.batchId, batchId));
        }
      }
    })().catch(console.error);

    res.json({ success: true, message: "Retry started." });

  } catch (err) {
    console.error("[POST /api/batch/:batchId/retry-item] Error:", err);
    res.status(500).json({ success: false, error: "Failed to retry item." });
  }
});

export default router;
