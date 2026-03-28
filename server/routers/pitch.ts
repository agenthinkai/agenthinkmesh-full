/**
 * server/routers/pitch.ts
 * Revenue Bridge — Public Pitch API
 *
 * Procedures:
 *   pitch.submit        — publicProcedure: run Council on pitch text, store result
 *   pitch.getResult     — publicProcedure: poll for result + payment status
 *   pitch.confirmPayment — publicProcedure: mark session as PAID (called by webhook)
 *   pitch.adminList     — protectedProcedure: admin view of all pitch sessions
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { runCouncil } from "../councilEngine";
import crypto from "crypto";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function sanitisePhone(raw: string): string {
  // Normalise Kuwait mobile: strip spaces, dashes, leading +965 or 00965
  return raw.replace(/[\s\-().]/g, "").replace(/^(\+965|00965)/, "965");
}

function isKuwaitMobile(phone: string): boolean {
  const clean = sanitisePhone(phone);
  // Kuwait mobiles: 965 + 8 digits starting with 5,6,9
  return /^(965)?[569]\d{7}$/.test(clean);
}

// ── Router ────────────────────────────────────────────────────────────────────

export const pitchRouter = router({
  /**
   * Submit a pitch for Council evaluation.
   * Returns pitchToken immediately; Council runs asynchronously.
   * Poll getResult to check progress.
   */
  submit: publicProcedure
    .input(
      z.object({
        pitchText: z.string().min(20, "Pitch must be at least 20 characters").max(2000, "Pitch must be under 2000 characters"),
        phone: z.string().min(8, "Enter a valid Kuwait mobile number"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const phone = sanitisePhone(input.phone);
      if (!isKuwaitMobile(phone)) {
        throw new Error("Please enter a valid Kuwait mobile number (e.g. 9XXXXXXX or 6XXXXXXX)");
      }

      const pitchToken = generateToken();

      // Insert pending session immediately so client can start polling
      await db.execute(
        sql`INSERT INTO pitch_sessions (pitchToken, phone, pitchText, paymentStatus, reportUnlocked)
            VALUES (${pitchToken}, ${phone}, ${input.pitchText}, 'PENDING', 0)`
      );

      // Run Council asynchronously — do not await
      (async () => {
        try {
          const result = await runCouncil(input.pitchText, {
            taskId: `pitch-${pitchToken.slice(0, 12)}`,
            taskDomain: "pitch",
            skipMemory: false,
          });

          // Build compact vote summary for report
          const voteSummary = result.votes.map((v) => ({
            persona: v.personaName,
            vote: v.vote,
            confidence: v.confidence,
            rationale: v.rationale,
            weight: v.weight,
          }));

          // Determine if APPROVED verdict → payment required
          const isApproved =
            result.verdict === "APPROVED" ||
            result.verdict === "APPROVED_WITH_CONDITIONS";
          const paymentStatus = isApproved ? "PENDING" : "FREE";

          // Persist to decision_memory
          let decisionMemoryId: number | null = null;
          try {
            const tfMap: Record<string, number> = {};
            for (const t of input.pitchText
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length > 2)) {
              tfMap[t] = (tfMap[t] ?? 0) + 1;
            }
            const embeddingJson = JSON.stringify(tfMap);
            const [dmRes] = await (db as any).$client.execute(
              `INSERT INTO decision_memory (taskId, taskDescription, taskDomain, embedding, finalVerdict, confidenceScore, paymentStatus, phone, pitchToken)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `pitch-${pitchToken.slice(0, 12)}`,
                input.pitchText.slice(0, 500),
                "pitch",
                embeddingJson,
                result.verdict,
                result.confidenceScore,
                paymentStatus,
                phone,
                pitchToken,
              ]
            );
            decisionMemoryId = (dmRes as any).insertId ?? null;
          } catch (_) {
            // Non-fatal — pitch session still works without decision_memory link
          }

          // Update pitch session with results
          await db.execute(
            sql`UPDATE pitch_sessions
                SET verdict = ${result.verdict},
                    confidenceScore = ${result.confidenceScore},
                    decisionMemoryId = ${decisionMemoryId},
                    paymentStatus = ${paymentStatus},
                    voteSummaryJson = ${JSON.stringify(voteSummary)},
                    updatedAt = NOW()
                WHERE pitchToken = ${pitchToken}`
          );
        } catch (err) {
          console.error("[PitchRouter] Council run failed:", err);
          // Mark session as errored so client can show friendly message
          await db.execute(
            sql`UPDATE pitch_sessions SET verdict = 'ERROR', updatedAt = NOW() WHERE pitchToken = ${pitchToken}`
          );
        }
      })();

      return { pitchToken };
    }),

  /**
   * Poll for pitch result + payment status.
   * Returns null verdict while Council is still running.
   */
  getResult: publicProcedure
    .input(z.object({ pitchToken: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [rows] = await (db as any).$client.execute(
        `SELECT pitchToken, verdict, confidenceScore, paymentStatus, reportUnlocked, voteSummaryJson, createdAt
         FROM pitch_sessions WHERE pitchToken = ? LIMIT 1`,
        [input.pitchToken]
      );
      if (!rows || rows.length === 0) throw new Error("Pitch session not found");

      const row = rows[0];
      const votes = row.voteSummaryJson ? JSON.parse(row.voteSummaryJson) : null;

      return {
        pitchToken: row.pitchToken as string,
        verdict: row.verdict as string | null,
        confidenceScore: row.confidenceScore ? parseFloat(row.confidenceScore) : null,
        paymentStatus: row.paymentStatus as "PENDING" | "PAID" | "FREE",
        reportUnlocked: !!row.reportUnlocked,
        votes,
        createdAt: row.createdAt as Date,
      };
    }),

  /**
   * Confirm payment and unlock the report.
   * Called by the /api/payment-confirm webhook.
   */
  confirmPayment: publicProcedure
    .input(
      z.object({
        pitchToken: z.string(),
        webhookSecret: z.string().optional(), // Simple shared secret for now
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Optional: validate webhook secret
      const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET ?? "knet-dev-secret-2026";
      if (input.webhookSecret && input.webhookSecret !== expectedSecret) {
        throw new Error("Invalid webhook secret");
      }

      const [rows] = await (db as any).$client.execute(
        `SELECT id, paymentStatus FROM pitch_sessions WHERE pitchToken = ? LIMIT 1`,
        [input.pitchToken]
      );
      if (!rows || rows.length === 0) throw new Error("Pitch session not found");

      await db.execute(
        sql`UPDATE pitch_sessions
            SET paymentStatus = 'PAID', reportUnlocked = 1, updatedAt = NOW()
            WHERE pitchToken = ${input.pitchToken}`
      );

      // Also update decision_memory if linked
      await db.execute(
        sql`UPDATE decision_memory SET paymentStatus = 'PAID' WHERE pitchToken = ${input.pitchToken}`
      );

      console.log(`[PitchRouter] Payment confirmed for pitchToken=${input.pitchToken}`);
      return { success: true, message: "Payment confirmed. Report unlocked." };
    }),

  /**
   * Admin: list all pitch sessions (protected).
   */
  adminList: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [rows] = await (db as any).$client.execute(
        `SELECT id, pitchToken, phone, LEFT(pitchText, 100) as pitchPreview,
                verdict, confidenceScore, paymentStatus, reportUnlocked, createdAt
         FROM pitch_sessions ORDER BY createdAt DESC LIMIT ?`,
        [input.limit]
      );
      return rows as Array<{
        id: number;
        pitchToken: string;
        phone: string;
        pitchPreview: string;
        verdict: string | null;
        confidenceScore: number | null;
        paymentStatus: string;
        reportUnlocked: number;
        createdAt: Date;
      }>;
    }),
});
