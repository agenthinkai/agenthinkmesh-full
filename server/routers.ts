import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { taskHistory } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  mesh: router({
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(taskHistory)
        .where(eq(taskHistory.userId, ctx.user.id))
        .orderBy(desc(taskHistory.createdAt))
        .limit(50);
      return rows;
    }),

    saveTask: protectedProcedure
      .input(z.object({
        task: z.string(),
        contextKey: z.string(),
        contextLabel: z.string(),
        agentCount: z.number(),
        outputs: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(taskHistory).values({
          userId: ctx.user.id,
          task: input.task,
          contextKey: input.contextKey,
          contextLabel: input.contextLabel,
          agentCount: input.agentCount,
          outputs: input.outputs || null,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
