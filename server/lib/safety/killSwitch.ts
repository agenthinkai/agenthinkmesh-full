/**
 * lib/safety/killSwitch.ts
 *
 * Safety Kill-Switch — AgenThinkMesh V2.2
 *
 * Hard limit: $500 USD autonomous spend cap.
 * - Limit is HARD-CODED — never read from env or config.
 * - Any agent proposing treasury spend MUST call TreasuryKillSwitch.check() first.
 * - On breach: marks transaction as killed, fires ops alert, throws KillSwitchError.
 * - KillSwitchError is never caught silently — it propagates to the ops alert layer.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { notifyOwner } from "../../_core/notification";

// ── Hard-coded limit — DO NOT make this an env var ────────────────────────────
const AUTONOMOUS_SPEND_LIMIT_USD = 500.00 as const;

// ── KillSwitchError ───────────────────────────────────────────────────────────

export class KillSwitchError extends Error {
  public readonly proposedSpend: number;
  public readonly txId: number | string;

  constructor(proposedSpend: number, txId: number | string) {
    super(
      `KILL SWITCH TRIGGERED: Autonomous outbound spend of $${proposedSpend.toFixed(2)} ` +
      `exceeds the hard limit of $${AUTONOMOUS_SPEND_LIMIT_USD.toFixed(2)}. ` +
      `Transaction ${txId} has been blocked. Human approval is required.`
    );
    this.name = "KillSwitchError";
    this.proposedSpend = proposedSpend;
    this.txId = txId;
  }
}

// ── TreasuryKillSwitch ────────────────────────────────────────────────────────

export class TreasuryKillSwitch {
  /**
   * Check whether a proposed spend is within the autonomous limit.
   *
   * MUST be called as the FIRST action before any outbound treasury operation.
   * If the proposed spend >= $500, this method:
   *   1. Marks the transaction row as killed in the DB.
   *   2. Fires an ops alert via the owner notification channel.
   *   3. Throws KillSwitchError — which MUST NOT be caught silently.
   *
   * @param proposedSpendUSD  Amount in USD being proposed for autonomous spend.
   * @param txId              The transactions.id value for this operation.
   */
  static async check(proposedSpendUSD: number, txId: number): Promise<void> {
    if (proposedSpendUSD >= AUTONOMOUS_SPEND_LIMIT_USD) {
      // 1. Mark transaction as killed in DB (lazy import — table added in Module 3)
      try {
        const db = await getDb();
        if (db) {
          // Dynamic import so this compiles before the transactions table exists
          const schema = await import("../../../drizzle/schema");
          if ("transactions" in schema) {
            const txTable = (schema as Record<string, unknown>)["transactions"] as Parameters<typeof db.update>[0];
            await db
              .update(txTable)
              .set({ status: "killed", killSwitchTriggered: true })
              .where(eq(txTable as Parameters<typeof eq>[0], txId));
          }
        }
      } catch (dbErr) {
        // DB failure must not suppress the kill — log and continue to throw
        console.error("[KillSwitch] DB update failed:", dbErr);
      }

      // 2. Fire ops alert
      const alertTitle = `🚨 KILL SWITCH: Autonomous spend blocked — TX #${txId}`;
      const alertContent =
        `An autonomous treasury action attempted to spend $${proposedSpendUSD.toFixed(2)} USD.\n` +
        `This exceeds the hard limit of $${AUTONOMOUS_SPEND_LIMIT_USD.toFixed(2)} USD.\n\n` +
        `Transaction ID: ${txId}\n` +
        `Proposed spend: $${proposedSpendUSD.toFixed(2)} USD\n` +
        `Status: KILLED\n` +
        `Action required: Human approval before retrying.`;

      try {
        await notifyOwner({ title: alertTitle, content: alertContent });
      } catch (notifyErr) {
        // Notification failure must not suppress the kill — log and continue
        console.error("[KillSwitch] Ops alert failed:", notifyErr);
      }

      // 3. Throw — must propagate, never caught silently
      throw new KillSwitchError(proposedSpendUSD, txId);
    }
  }

  /**
   * Returns the current hard limit (read-only, for display purposes only).
   */
  static get limit(): number {
    return AUTONOMOUS_SPEND_LIMIT_USD;
  }
}
