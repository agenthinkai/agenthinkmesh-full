import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { taskHistory } from "../drizzle/schema";
import { eq, desc, gte, sql } from "drizzle-orm";

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

    getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(taskHistory)
        .where(eq(taskHistory.userId, ctx.user.id))
        .orderBy(desc(taskHistory.createdAt))
        .limit(5);
      return rows;
    }),

    getMetrics: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { tasksToday: 0, totalTasks: 0, avgAgents: 0, successRate: 100 };

      // Start of today UTC
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [todayRows, totalRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(taskHistory)
          .where(
            sql`${taskHistory.userId} = ${ctx.user.id} AND ${taskHistory.createdAt} >= ${todayStart}`
          ),
        db
          .select({
            count: sql<number>`count(*)`,
            avgAgents: sql<number>`avg(${taskHistory.agentCount})`,
          })
          .from(taskHistory)
          .where(eq(taskHistory.userId, ctx.user.id)),
      ]);

      return {
        tasksToday: Number(todayRows[0]?.count ?? 0),
        totalTasks: Number(totalRows[0]?.count ?? 0),
        avgAgents: Math.round(Number(totalRows[0]?.avgAgents ?? 0)),
        successRate: 100, // placeholder — extend with status field later
      };
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
