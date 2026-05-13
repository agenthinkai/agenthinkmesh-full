import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { councilLanguageSignals } from "../../drizzle/schema";

export const councilRouter = router({
  /**
   * Stores ONLY: language, optional email, timestamp.
   * The question that triggered the redirect is NEVER accepted or stored.
   */
  submitLanguageSignal: publicProcedure
    .input(
      z.object({
        language: z.string().min(1).max(64),
        email: z.string().email().max(255).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(councilLanguageSignals).values({
        language: input.language,
        email: input.email ?? null,
      });
      return { ok: true };
    }),
});
