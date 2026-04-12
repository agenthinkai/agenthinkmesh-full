/**
 * POST /api/signals/ingest
 *
 * Lightweight ingestion endpoint for external deal signals.
 * Accepts a structured signal payload and stores it in signal_deals.
 * No authentication required — designed for internal/automated use.
 * Associate with userId = null (anonymous) unless a user context is present.
 */
import express from "express";
import { getDb } from "./db";
import { signalDeals } from "../drizzle/schema";

const router = express.Router();

router.post("/ingest", async (req, res) => {
  try {
    const { company, sector, stage, summary, source } = req.body as {
      company?: string;
      sector?: string;
      stage?: string;
      summary?: string;
      source?: string;
    };

    // Validate required fields
    const missing: string[] = [];
    if (!company?.trim()) missing.push("company");
    if (!sector?.trim()) missing.push("sector");
    if (!stage?.trim()) missing.push("stage");
    if (!summary?.trim()) missing.push("summary");
    if (!source?.trim()) missing.push("source");

    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(", ")}`,
        required: ["company", "sector", "stage", "summary", "source"],
      });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({ success: false, error: "Database unavailable" });
      return;
    }

    const [inserted] = await db
      .insert(signalDeals)
      .values({
        company: company!.trim(),
        sector: sector!.trim(),
        stage: stage!.trim(),
        summary: summary!.trim(),
        source: source!.trim(),
        screened: false,
        createdAt: new Date(),
      })
      .$returningId();

    res.status(201).json({
      success: true,
      signalId: inserted?.id ?? null,
      message: "Signal ingested successfully",
      data: {
        company: company!.trim(),
        sector: sector!.trim(),
        stage: stage!.trim(),
        source: source!.trim(),
        screened: false,
      },
    });
  } catch (err) {
    console.error("[SignalsIngest] Error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;
