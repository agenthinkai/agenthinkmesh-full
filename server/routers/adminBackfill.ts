/**
 * server/routers/adminBackfill.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only tRPC procedures for one-time data migrations.
 *
 * Procedures:
 *   adminBackfill.fingerprintScores — Recomputes stale rescueabilityScore and
 *     structuralFragilityScore for all simulation_fingerprints rows using the
 *     current production formulas (MP-2 and MP-3 fixes).
 *
 * Idempotency: running the procedure multiple times produces the same result.
 * All other fingerprint fields are preserved unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { router, adminProcedure } from "../_core/trpc";
import { backfillFingerprintScores } from "../backfillFingerprintScores";

export const adminBackfillRouter = router({
  /**
   * Recompute rescueabilityScore and structuralFragilityScore for all
   * simulation_fingerprints rows using the current production formulas.
   *
   * Returns a summary of rows updated, skipped, and errored.
   * Idempotent — safe to run multiple times.
   */
  fingerprintScores: adminProcedure.mutation(async () => {
    const result = await backfillFingerprintScores();
    return {
      success: result.errors === 0,
      totalRows: result.totalRows,
      updated: result.updated,
      skipped: result.skipped,
      skippedRunIds: result.skippedRunIds,
      errors: result.errors,
    };
  }),
});
