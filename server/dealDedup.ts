/**
 * dealDedup.ts
 * Deal deduplication utility
 *
 * Before triage, normalise the deal text and compute a SHA-256 hash.
 * If the same hash already exists in deal_screenings for this user,
 * return the previous result immediately with duplicate: true.
 *
 * Normalisation steps:
 *   1. Lowercase
 *   2. Trim whitespace
 *   3. Collapse multiple spaces/newlines to single space
 *
 * This catches exact re-submissions and minor formatting differences.
 */

import crypto from "crypto";
import { getDb } from "./db";
import { dealScreenings } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Normalise deal text for consistent hashing.
 */
export function normaliseDealText(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Compute SHA-256 hash of normalised deal text.
 * Returns a 64-character hex string.
 */
export function hashDealText(normalised: string): string {
  return crypto.createHash("sha256").update(normalised, "utf8").digest("hex");
}

export interface DedupResult {
  isDuplicate: boolean;
  dealHash: string;
  previousDealId?: string;
  previousVerdict?: string;
}

/**
 * Check if a deal with the same hash already exists for this user.
 * Returns the hash and whether it is a duplicate.
 */
export async function checkDuplicate(
  userId: number,
  dealText: string
): Promise<DedupResult> {
  const normalised = normaliseDealText(dealText);
  const dealHash = hashDealText(normalised);

  try {
    const db = await getDb();
    if (!db) return { isDuplicate: false, dealHash };
    const existing = await db
      .select({
        dealId: dealScreenings.dealId,
        verdict: dealScreenings.verdict,
      })
      .from(dealScreenings)
      .where(
        and(
          eq(dealScreenings.userId, userId),
          eq(dealScreenings.dealHash, dealHash)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        isDuplicate: true,
        dealHash,
        previousDealId: existing[0].dealId,
        previousVerdict: existing[0].verdict,
      };
    }
  } catch (err) {
    // If dedup check fails (e.g. column not yet migrated), log and continue
    console.warn("[DealDedup] Dedup check failed, proceeding:", err instanceof Error ? err.message : err);
  }

  return { isDuplicate: false, dealHash };
}
