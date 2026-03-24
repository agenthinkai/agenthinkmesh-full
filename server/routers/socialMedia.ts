// ─── Social Media tRPC Router ─────────────────────────────────────────────────
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { admeshRuns } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { SOCIAL_WORKFLOW_AGENTS } from "../socialMediaEngine";

export const socialMediaRouter = router({
  // Start a new social media pipeline run
  startRun: protectedProcedure
    .input(
      z.object({
        workflowType: z.enum([
          "arabic_localizer",
          "cross_publisher",
          "brand_safety",
          "influencer_discovery",
          "crisis_detection",
        ]),
        brandName: z.string().min(1).max(128),
        market: z.string().default("Kuwait"),
        // Arabic Localizer
        sourceContent: z.string().optional(),
        targetDialects: z.array(z.string()).optional(),
        // Cross Publisher
        postContent: z.string().optional(),
        platforms: z.array(z.string()).optional(),
        // Brand Safety
        contentToCheck: z.string().optional(),
        brandGuidelines: z.string().optional(),
        // Influencer Discovery
        niche: z.string().optional(),
        minFollowers: z.number().optional(),
        requireShariahSafe: z.boolean().optional(),
        // Crisis Detection
        brandMentions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Encode extra config as JSON in category field
      const extraConfig = {
        sourceContent: input.sourceContent,
        targetDialects: input.targetDialects,
        postContent: input.postContent,
        platforms: input.platforms,
        contentToCheck: input.contentToCheck,
        brandGuidelines: input.brandGuidelines,
        niche: input.niche,
        minFollowers: input.minFollowers,
        requireShariahSafe: input.requireShariahSafe,
        brandMentions: input.brandMentions,
      };

      const [result] = await db.insert(admeshRuns).values({
        userId: ctx.user.openId,
        brandName: input.brandName,
        brandVoice: input.workflowType, // store workflowType in brandVoice field
        category: JSON.stringify(extraConfig),
        market: input.market,
        competitors: "[]",
        languages: "en,ar",
        mode: "demo",
        status: "pending",
      });

      return { runId: result.insertId, workflowType: input.workflowType };
    }),

  // List past social media runs for the current user
  listRuns: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const socialWorkflowTypes = [
        "arabic_localizer",
        "cross_publisher",
        "brand_safety",
        "influencer_discovery",
        "crisis_detection",
      ];

      const runs = await db
        .select()
        .from(admeshRuns)
        .where(eq(admeshRuns.userId, ctx.user.openId))
        .orderBy(desc(admeshRuns.createdAt))
        .limit(input.limit);

      return runs.filter((r) => socialWorkflowTypes.includes(r.brandVoice));
    }),

  // Get a single run by ID
  getRun: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const runs = await db
        .select()
        .from(admeshRuns)
        .where(eq(admeshRuns.id, input.runId))
        .limit(1);

      const run = runs[0];
      if (!run || run.userId !== ctx.user.openId) return null;
      return run;
    }),

  // Get agent registry for a workflow type
  getAgents: protectedProcedure
    .input(
      z.object({
        workflowType: z.enum([
          "arabic_localizer",
          "cross_publisher",
          "brand_safety",
          "influencer_discovery",
          "crisis_detection",
        ]),
      })
    )
    .query(({ input }) => {
      return SOCIAL_WORKFLOW_AGENTS[input.workflowType] ?? [];
    }),
});
