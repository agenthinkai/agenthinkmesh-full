/**
 * runScreeningPipeline.ts
 *
 * Pure service function that executes the full 3-layer Deal Screener pipeline:
 *   Layer 0 — Deduplication (SHA-256 hash lookup)
 *   Layer 1 — Fast triage (Haiku 3.5, ~3–5s, $0.002)
 *   Layer 2 — Full Council (Sonnet 4.5, 10 agents, ~30–50s)
 *   Layer 3 — Conditional IC Report (Sonnet 4.5, APPROVED/APPROVED_WITH_CONDITIONS only)
 *
 * This function is the single source of truth for the screening logic.
 * It is consumed by:
 *   - server/routers/dealScreener.ts  (tRPC, authenticated UI flow)
 *   - server/dealScreenRoute.ts       (REST, internal/enterprise API)
 *
 * DO NOT duplicate this logic elsewhere.
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { dealScreenings } from "../drizzle/schema";
import { runCouncil } from "./councilEngine";
import { generateSingleDealICReport } from "./icReportEngine";
import { detectTier0Signal } from "./tier0Signals";
import { runTriage } from "./triageEngine";
import { checkDuplicate } from "./dealDedup";

export type CouncilMode = "gcc" | "global_vc" | "india_pe";
export type SourceType = "manual" | "signal";

export interface ScreeningInput {
  dealText: string;
  dealName?: string;
  councilMode?: CouncilMode;
  includeReport?: boolean;
  /** When true, generate IC report for ALL verdicts (including REJECTED/VETOED). Used by batch Data Room mode. */
  forceReport?: boolean;
  /** Internal user ID for dedup + rate-limit scoping. Pass null for anonymous API calls. */
  userId: number | null;
  /** Source label written to deal_screenings.sourceType */
  sourceType?: "manual" | "signal";
}

export interface TriageResult {
  decision: "PROCEED" | "OBVIOUS_REJECT" | "INSUFFICIENT_INPUT" | "OUT_OF_SCOPE";
  confidence: number;
  reason: string;
}

export interface ScreeningResult {
  dealId: string;
  dealName: string;
  duplicate: boolean;
  triage: TriageResult | null;
  council: object | null;
  ic_report: object | null;
  universitySignal: object | null;
}

/**
 * Run the full 3-layer screening pipeline.
 * Persists results to deal_screenings when userId is provided.
 * When userId is null (anonymous API call), skips dedup and DB write.
 */
export async function runScreeningPipeline(input: ScreeningInput): Promise<ScreeningResult> {
  const {
    dealText,
    dealName = "Untitled Deal",
    councilMode = "gcc",
    includeReport = true,
    forceReport = false,
    userId,
    sourceType = "manual",
  } = input;

  const dealId = randomUUID();
  const db = userId !== null ? await getDb() : null;

  // ── Layer 0: Deduplication ──────────────────────────────────────────────────
  // Only run dedup when we have a userId (anonymous calls always proceed)
  if (userId !== null && db) {
    const dedupResult = await checkDuplicate(userId, dealText);
    if (dedupResult.isDuplicate && dedupResult.previousDealId) {
      const prevRows = await db
        .select()
        .from(dealScreenings)
        .where(eq(dealScreenings.dealId, dedupResult.previousDealId))
        .limit(1);
      if (prevRows.length > 0) {
        const prev = prevRows[0];
        return {
          dealId: prev.dealId,
          dealName: prev.dealName,
          duplicate: true,
          triage: prev.triageResult ? JSON.parse(prev.triageResult as string) : null,
          council: {
            verdict: prev.verdict,
            yesCount: prev.yesCount,
            noCount: prev.noCount,
            confidenceScore: parseFloat(prev.confidenceScore),
            conditionsToProceed: JSON.parse(prev.conditionsToProceed as string ?? "[]"),
            blockingIssues: JSON.parse(prev.blockingIssues as string ?? "[]"),
            votes: JSON.parse(prev.votes as string ?? "[]"),
          },
          ic_report: null,
          universitySignal: null,
        };
      }
    }
  }

  // ── Layer 1: Fast Triage ────────────────────────────────────────────────────
  const triageResult = await runTriage(dealText);

  if (triageResult.decision !== "PROCEED") {
    // Persist triage-rejected record if we have a userId
    if (userId !== null && db) {
      const triageDealId = randomUUID();
      try {
        await db.insert(dealScreenings).values({
          userId,
          dealId: triageDealId,
          dealName,
          dealText,
          pdfFileKey: null,
          pdfFileUrl: null,
          verdict: "REJECTED",
          yesCount: 0,
          noCount: 0,
          hardYesCount: 0,
          softYesCount: 0,
          softNoCount: 0,
          hardNoCount: 0,
          confidenceScore: "0.000",
          gccVetoTriggered: false,
          tiebreakerTriggered: false,
          tiebreakerSwingAgent: null,
          conditionsToProceed: "[]",
          blockingIssues: JSON.stringify([triageResult.reason]),
          votes: "[]",
          sourceType,
          triageResult: JSON.stringify(triageResult),
          triageSkipped: false,
        });
      } catch (e) {
        console.error("[runScreeningPipeline][Triage] Failed to persist triage record:", e);
      }
    }
    return {
      dealId,
      dealName,
      duplicate: false,
      triage: triageResult,
      council: null,
      ic_report: null,
      universitySignal: null,
    };
  }

  // ── Layer 2: Full Council ───────────────────────────────────────────────────
  const result = await runCouncil(dealText, {
    userId: userId ?? undefined,
    councilMode,
  });

  // Persist council result if we have a userId
  if (userId !== null && db) {
    try {
      await db.insert(dealScreenings).values({
        userId,
        dealId,
        dealName,
        dealText,
        pdfFileKey: null,
        pdfFileUrl: null,
        verdict: result.verdict,
        yesCount: result.yesCount,
        noCount: result.noCount,
        hardYesCount: result.hardYesCount,
        softYesCount: result.softYesCount,
        softNoCount: result.softNoCount,
        hardNoCount: result.hardNoCount,
        confidenceScore: result.confidenceScore.toString(),
        gccVetoTriggered: result.gccVetoTriggered,
        tiebreakerTriggered: result.tiebreakerTriggered,
        tiebreakerSwingAgent: result.tiebreakerSwingAgent ?? null,
        conditionsToProceed: JSON.stringify(result.conditionsToProceed),
        blockingIssues: JSON.stringify(result.blockingIssues),
        votes: JSON.stringify(result.votes),
        sourceType,
        triageResult: JSON.stringify(triageResult),
        triageSkipped: false,
      });
    } catch (e) {
      console.error("[runScreeningPipeline][Council] Failed to persist council record:", e);
    }
  }

  // ── Layer 3: Conditional IC Report ─────────────────────────────────────────
  let icReport = null;
  const shouldGenerateReport =
    includeReport &&
    (forceReport ||
      result.verdict === "APPROVED" ||
      result.verdict === "APPROVED_WITH_CONDITIONS");
  if (shouldGenerateReport) {
    try {
      icReport = await generateSingleDealICReport(dealName, dealText, result);
    } catch (err) {
      console.error("[runScreeningPipeline][ICReport] Failed to generate IC report:", err);
    }
  }

  // Tier 0 university signal (non-fatal, additive)
  let universitySignal = null;
  try {
    universitySignal = detectTier0Signal(dealText, dealName);
  } catch (err) {
    console.error("[runScreeningPipeline][Tier0] Signal detection failed:", err);
  }

  return {
    dealId,
    dealName,
    duplicate: false,
    triage: triageResult,
    council: result,
    ic_report: icReport,
    universitySignal,
  };
}
