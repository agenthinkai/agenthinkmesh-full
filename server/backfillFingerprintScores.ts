/**
 * backfillFingerprintScores.ts
 *
 * One-time idempotent migration script that recomputes stale
 * rescueabilityScore and structuralFragilityScore for all rows in the
 * simulation_fingerprints table using the current production formulas.
 *
 * Production formulas (mirrors simulationFingerprintEngine.ts):
 *
 *   rescueabilityScore:
 *     - If vetoPct === 0 (no hard-nos): 100
 *     - Otherwise: min(100, round(rescuedConditionalPct + 0))
 *       NOTE: The +5 pathway bonus in the live engine requires approvalPathways
 *       data which is not stored in the fingerprint row. We use +0 (conservative)
 *       to avoid fabricating data. Rows computed live will have the bonus; backfilled
 *       rows will not. This is documented and acceptable.
 *
 *   structuralFragilityScore (v2, MP-2 fix — non-overlapping):
 *     - score = finalRejectedPct + 0.5 * rescuedConditionalPct + 0.5 * attributionUnavailablePct
 *     - capped at 100
 *
 * Idempotency:
 *   The script recomputes the value from stored source fields and writes it
 *   regardless of the current stored value. Running it twice produces the same result.
 *
 * Skip conditions (row is logged as skipped, not updated):
 *   - vetoPct, rescuedConditionalPct, finalRejectedPct, or attributionUnavailablePct is null
 *
 * Fields preserved (never touched):
 *   - runId, dealId, dealName, councilMode, scenarioCount, simulationMode
 *   - approvePct, conditionalPct, rejectPct, vetoPct, rescuedConditionalPct
 *   - finalRejectedPct, attributionUnavailablePct
 *   - vetoConcentrationScore, scenarioEntropy, councilDisagreementScore
 *   - dominantFailureVectors, dominantApprovalPathways, sensitivityRanking
 *   - terminalFlagFrequency, governanceEscalationFrequency
 *   - isUpgradedScenario, originalRunId, originalVerdict, upgradedVerdict
 *   - resilienceDelta, upgradeEffectiveness, mitigationDependencyScore
 *   - sourceSector, sourceGeography, version, createdAt
 */

import { getDb } from "./db.js";
import { simulationFingerprints } from "../drizzle/schema.js";
import { eq, sql } from "drizzle-orm";

// ── Production formulas (must stay in sync with simulationFingerprintEngine.ts) ──

/**
 * Recompute rescueabilityScore from stored fields.
 * Conservative: pathway bonus (+5) is omitted because approvalPathways are not stored.
 */
function recomputeRescueabilityScore(
  vetoPct: number,
  rescuedConditionalPct: number
): number {
  // Clean deal: no hard-nos → no rescue needed → score = 100
  if (vetoPct === 0) return 100;
  // Base = rescuedConditionalPct (already 0–100)
  // No pathway bonus (conservative — pathways not stored in fingerprint row)
  return Math.min(100, Math.round(rescuedConditionalPct));
}

/**
 * Recompute structuralFragilityScore from stored fields.
 * Formula v2 (MP-2 fix): non-overlapping components.
 */
function recomputeStructuralFragilityScore(
  finalRejectedPct: number,
  rescuedConditionalPct: number,
  attributionUnavailablePct: number
): number {
  const score =
    finalRejectedPct
    + 0.5 * rescuedConditionalPct
    + 0.5 * attributionUnavailablePct;
  return Math.min(100, Math.round(score * 10) / 10);
}

// ── Main backfill function ────────────────────────────────────────────────────

export interface BackfillResult {
  totalRows: number;
  updated: number;
  skipped: number;
  skippedRunIds: string[];
  errors: number;
}

export async function backfillFingerprintScores(): Promise<BackfillResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("[backfill] Database not available");
  }

  // Fetch all rows
  const rows = await db.select().from(simulationFingerprints);

  const result: BackfillResult = {
    totalRows: rows.length,
    updated: 0,
    skipped: 0,
    skippedRunIds: [],
    errors: 0,
  };

  console.log(`[backfill] Starting fingerprint score backfill. Total rows: ${rows.length}`);

  for (const row of rows) {
    try {
      // ── Skip if required source fields are null ──────────────────────────
      if (
        row.vetoPct == null ||
        row.rescuedConditionalPct == null ||
        row.finalRejectedPct == null ||
        row.attributionUnavailablePct == null
      ) {
        console.warn(`[backfill] SKIP runId=${row.runId} — missing source fields`);
        result.skipped++;
        result.skippedRunIds.push(row.runId);
        continue;
      }

      // ── Recompute scores ─────────────────────────────────────────────────
      const newRescueabilityScore = recomputeRescueabilityScore(
        row.vetoPct,
        row.rescuedConditionalPct
      );

      const newStructuralFragilityScore = recomputeStructuralFragilityScore(
        row.finalRejectedPct,
        row.rescuedConditionalPct,
        row.attributionUnavailablePct
      );

      // ── Update only the two target columns ──────────────────────────────
      await db
        .update(simulationFingerprints)
        .set({
          rescueabilityScore:       newRescueabilityScore,
          structuralFragilityScore: newStructuralFragilityScore,
        })
        .where(eq(simulationFingerprints.runId, row.runId));

      console.log(
        `[backfill] UPDATED runId=${row.runId} ` +
        `rescueabilityScore: ${row.rescueabilityScore ?? "null"} → ${newRescueabilityScore}, ` +
        `structuralFragilityScore: ${row.structuralFragilityScore ?? "null"} → ${newStructuralFragilityScore}`
      );
      result.updated++;

    } catch (err) {
      console.error(`[backfill] ERROR runId=${row.runId}:`, err);
      result.errors++;
    }
  }

  console.log(
    `[backfill] Complete. ` +
    `Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`
  );

  return result;
}
