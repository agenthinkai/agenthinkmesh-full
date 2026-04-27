import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { pitchTriages } from "../../drizzle/schema";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * encryptionStatus — Admin-only query.
   * Returns live encryption coverage for pitch_triages.agentOutputs.
   *
   * Query:
   *   SELECT
   *     COUNT(*) as total,
   *     COUNT(CASE WHEN agentOutputs LIKE 'sys:%' THEN 1 END) as encrypted
   *   FROM pitch_triages
   *   WHERE agentOutputs IS NOT NULL
   *
   * coverage = (encrypted / total) * 100
   */
  encryptionStatus: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        return { total: 0, encrypted: 0, coverage: 0, lastUpdated: Date.now() };
      }
      const rows = await db
        .select({
          total:     sql<number>`COUNT(*)`,
          encrypted: sql<number>`COUNT(CASE WHEN ${pitchTriages.agentOutputs} LIKE 'sys:%' THEN 1 END)`,
        })
        .from(pitchTriages)
        .where(sql`${pitchTriages.agentOutputs} IS NOT NULL`);

      const total     = Number(rows[0]?.total     ?? 0);
      const encrypted = Number(rows[0]?.encrypted ?? 0);
      const coverage  = total > 0 ? Math.round((encrypted / total) * 100 * 100) / 100 : 0;

      return {
        total,
        encrypted,
        coverage,
        lastUpdated: Date.now(),
      };
    }),
});
