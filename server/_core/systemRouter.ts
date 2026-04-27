import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { pitchTriages, founderAgentEvaluations } from "../../drizzle/schema";

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
   * Returns live encryption coverage for both encrypted tables.
   *
   * pitch_triages:              agentOutputs, keySignals, missingInfo
   * founder_agent_evaluations:  strengths, concerns, flags
   */
  encryptionStatus: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        return {
          tables: [],
          overall: { total: 0, encrypted: 0, coverage: 0 },
          lastUpdated: Date.now(),
        };
      }

      // ── pitch_triages ──────────────────────────────────────────────────────
      const ptRows = await db
        .select({
          total:     sql<number>`COUNT(*)`,
          encrypted: sql<number>`COUNT(CASE WHEN ${pitchTriages.agentOutputs} LIKE 'sys:%' THEN 1 END)`,
        })
        .from(pitchTriages)
        .where(sql`${pitchTriages.agentOutputs} IS NOT NULL`);

      const ptTotal     = Number(ptRows[0]?.total     ?? 0);
      const ptEncrypted = Number(ptRows[0]?.encrypted ?? 0);
      const ptCoverage  = ptTotal > 0 ? Math.round((ptEncrypted / ptTotal) * 10000) / 100 : 0;

      // ── founder_agent_evaluations ──────────────────────────────────────────
      const faeRows = await db
        .select({
          total:     sql<number>`COUNT(*)`,
          encrypted: sql<number>`COUNT(CASE WHEN ${founderAgentEvaluations.strengths} LIKE 'sys:%' THEN 1 END)`,
        })
        .from(founderAgentEvaluations)
        .where(sql`${founderAgentEvaluations.strengths} IS NOT NULL`);

      const faeTotal     = Number(faeRows[0]?.total     ?? 0);
      const faeEncrypted = Number(faeRows[0]?.encrypted ?? 0);
      const faeCoverage  = faeTotal > 0 ? Math.round((faeEncrypted / faeTotal) * 10000) / 100 : 0;

      // ── Overall ────────────────────────────────────────────────────────────
      const overallTotal     = ptTotal + faeTotal;
      const overallEncrypted = ptEncrypted + faeEncrypted;
      const overallCoverage  = overallTotal > 0
        ? Math.round((overallEncrypted / overallTotal) * 10000) / 100
        : 0;

      return {
        tables: [
          {
            table:     "pitch_triages",
            total:     ptTotal,
            encrypted: ptEncrypted,
            coverage:  ptCoverage,
            fields:    ["agentOutputs", "keySignals", "missingInfo"],
          },
          {
            table:     "founder_agent_evaluations",
            total:     faeTotal,
            encrypted: faeEncrypted,
            coverage:  faeCoverage,
            fields:    ["strengths", "concerns", "flags"],
          },
        ],
        overall: {
          total:     overallTotal,
          encrypted: overallEncrypted,
          coverage:  overallCoverage,
        },
        lastUpdated: Date.now(),
      };
    }),
});
