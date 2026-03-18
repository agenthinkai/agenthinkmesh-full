// ─── AdMesh tRPC Router ───────────────────────────────────────────────────────
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { admeshRuns, admeshSteps, admeshAds } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const admeshRouter = router({
  // Start a new AdMesh run — creates DB record and returns runId for SSE connection
  startRun: protectedProcedure
    .input(
      z.object({
        brandName: z.string().min(1).max(128),
        brandVoice: z.string().default("value"),
        category: z.string().default("Consumer Electronics"),
        market: z.string().default("Kuwait"),
        competitors: z.array(z.string()).default(["Eureka", "Sharaf DG", "iStyle"]),
        languages: z.string().default("en,ar"),
        mode: z.enum(["demo", "live"]).default("demo"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [result] = await db.insert(admeshRuns).values({
        userId: ctx.user.openId,
        brandName: input.brandName,
        brandVoice: input.brandVoice,
        category: input.category,
        market: input.market,
        competitors: JSON.stringify(input.competitors),
        languages: input.languages,
        mode: input.mode,
        status: "pending",
      }).$returningId();

      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create run" });

      return { runId: result.id };
    }),

  // List all runs for the current user
  listRuns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(admeshRuns)
      .where(eq(admeshRuns.userId, ctx.user.openId))
      .orderBy(desc(admeshRuns.createdAt))
      .limit(20);
  }),

  // Get a single run by ID
  getRun: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const runs = await db
        .select()
        .from(admeshRuns)
        .where(eq(admeshRuns.id, input.runId))
        .limit(1);
      const run = runs[0];
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (run.userId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN" });
      return run;
    }),

  // Get all ads for a run
  getAds: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Verify ownership
      const runs = await db.select().from(admeshRuns).where(eq(admeshRuns.id, input.runId)).limit(1);
      if (!runs[0] || runs[0].userId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN" });
      return db.select().from(admeshAds).where(eq(admeshAds.runId, input.runId));
    }),

  // Get pipeline steps for a run
  getSteps: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const runs = await db.select().from(admeshRuns).where(eq(admeshRuns.id, input.runId)).limit(1);
      if (!runs[0] || runs[0].userId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN" });
      return db.select().from(admeshSteps).where(eq(admeshSteps.runId, input.runId));
    }),

  // Approve/unapprove an ad
  approveAd: protectedProcedure
    .input(z.object({ adId: z.number(), isApproved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify ownership via run
      const ads = await db.select().from(admeshAds).where(eq(admeshAds.id, input.adId)).limit(1);
      if (!ads[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const runs = await db.select().from(admeshRuns).where(eq(admeshRuns.id, ads[0].runId)).limit(1);
      if (!runs[0] || runs[0].userId !== ctx.user.openId) throw new TRPCError({ code: "FORBIDDEN" });
      await db.update(admeshAds).set({ isApproved: input.isApproved }).where(eq(admeshAds.id, input.adId));
      return { success: true };
    }),

  // Public: get agent registry info
  getAgents: publicProcedure.query(() => {
    const { ADMESH_AGENTS, BRAND_VOICE_PRESETS } = require("../../shared/admeshAgents");
    return { agents: ADMESH_AGENTS, voicePresets: BRAND_VOICE_PRESETS };
  }),
});
