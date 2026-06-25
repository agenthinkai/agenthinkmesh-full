/**
 * aros/constitution.ts — Atlas Constitution Router
 *
 * The Constitution is a versioned, measurable institutional asset.
 * Nothing is overwritten. Everything is append-only.
 * Human approval creates the next version. Atlas never self-modifies.
 *
 * Routes:
 *  - getActive       → current active Constitution version
 *  - getHistory      → all versions with performance metrics
 *  - getPerformance  → per-version performance comparison
 *  - generateReview  → trigger a Constitution Review Report (admin only)
 *  - seedV1          → ensure V1.0 exists (called on startup)
 */

import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { router, protectedProcedure, publicProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  atlasConstitutionVersions,
  atlasConstitutionReviews,
  arosOutreachQueue,
  arosPipeline,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

// ── Constitution V1.0 text checksum ──────────────────────────────────────────
export const CONSTITUTION_V1_TEXT = `ATLAS CONSTITUTION V1.0 — AgenThink Mesh Executive Intelligence Operating System

MISSION: Help the world's leaders make better strategic decisions before reality makes them for them.

FOUR QUESTIONS: (1) What strategic decision has Atlas detected? (2) What Hidden Variable determines success or failure? (3) Why does this matter now? (4) What question should the executive now be asking?

FOUR TESTS: (1) Specificity — cannot be sent to another company. (2) Insight — CEO says "I had not considered that." (3) Value before attention — creates insight before asking for attention. (4) Standalone — valuable even if AgenThink Mesh is never mentioned.

EVIDENCE GOVERNANCE: Atlas never invents strategic insight. Every brief is grounded in observable evidence. When evidence is weak: express uncertainty, reduce confidence, identify missing evidence. Never manufacture confidence.`;

export function constitutionChecksum(text: string): string {
  return createHash("sha256").update(text).digest("hex").substring(0, 64);
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function requireAdmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ── Startup: ensure V1.0 exists ───────────────────────────────────────────────
export async function ensureConstitutionV1() {
  try {
    const db = await getDb();
    if (!db) return;
    const existing = await db
      .select({ id: atlasConstitutionVersions.id })
      .from(atlasConstitutionVersions)
      .where(eq(atlasConstitutionVersions.version, "1.0"))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(atlasConstitutionVersions).values({
        version: "1.0",
        effectiveDate: 1750000000000,
        description:
          "Initial Atlas Constitution — four questions, four tests, evidence governance principle. The Executive Intelligence Operating System founding document.",
        createdBy: "system",
        status: "ACTIVE",
        checksum: constitutionChecksum(CONSTITUTION_V1_TEXT),
        createdAt: Date.now(),
      });
      console.log("[Atlas] Constitution V1.0 seeded.");
    }
  } catch (e) {
    console.error("[Atlas] Failed to seed Constitution V1.0:", e);
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export const constitutionRouter = router({
  /** Get the currently active Constitution version */
  getActive: publicProcedure.query(async () => {
    const db = await requireDb();
    const [active] = await db
      .select()
      .from(atlasConstitutionVersions)
      .where(eq(atlasConstitutionVersions.status, "ACTIVE"))
      .orderBy(desc(atlasConstitutionVersions.effectiveDate))
      .limit(1);
    return active ?? null;
  }),

  /** Get full version history (all versions, newest first) */
  getHistory: protectedProcedure.query(async () => {
    const db = await requireDb();
    const versions = await db
      .select()
      .from(atlasConstitutionVersions)
      .orderBy(desc(atlasConstitutionVersions.effectiveDate));
    return versions;
  }),

  /** Get performance comparison across all versions */
  getPerformance: protectedProcedure.query(async () => {
    const db = await requireDb();
    const versions = await db
      .select()
      .from(atlasConstitutionVersions)
      .orderBy(desc(atlasConstitutionVersions.effectiveDate));

    // Enrich each version with live pipeline counts from aros_outreach_queue
    const enriched = await Promise.all(
      versions.map(async (v) => {
        const queueRows = await db
          .select({
            approvalStatus: arosOutreachQueue.approvalStatus,
          })
          .from(arosOutreachQueue)
          .where(eq(arosOutreachQueue.constitutionVersion, v.version));

        const sent = queueRows.filter((r) => r.approvalStatus === "SENT").length;
        const total = queueRows.length;

        // Pipeline outcomes for this constitution version
        const pipelineRows = await db
          .select({ stage: arosPipeline.stage })
          .from(arosPipeline)
          .innerJoin(
            arosOutreachQueue,
            eq(arosPipeline.outreachId, arosOutreachQueue.id)
          );
        // Note: we use stored metrics as primary source; live counts as supplementary
        return {
          ...v,
          liveBriefsSent: sent,
          liveTotalQueued: total,
          livePipelineCount: pipelineRows.length,
        };
      })
    );
    return enriched;
  }),

  /** Get all Constitution Review Reports */
  getReviews: protectedProcedure.query(async () => {
    const db = await requireDb();
    const reviews = await db
      .select()
      .from(atlasConstitutionReviews)
      .orderBy(desc(atlasConstitutionReviews.createdAt));
    return reviews;
  }),

  /** Generate a Constitution Review Report (admin only, LLM-powered) */
  generateReview: protectedProcedure
    .input(
      z.object({
        constitutionVersionId: z.number(),
        reviewPeriodDays: z.number().min(7).max(365).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);
      const db = await requireDb();

      const [version] = await db
        .select()
        .from(atlasConstitutionVersions)
        .where(eq(atlasConstitutionVersions.id, input.constitutionVersionId))
        .limit(1);
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "Constitution version not found" });

      const periodEnd = Date.now();
      const periodStart = periodEnd - input.reviewPeriodDays * 24 * 60 * 60 * 1000;

      // Gather performance data for the review period
      const queueRows = await db
        .select({
          approvalStatus: arosOutreachQueue.approvalStatus,
          openedAt: arosOutreachQueue.openedAt,
          repliedAt: arosOutreachQueue.repliedAt,
        })
        .from(arosOutreachQueue)
        .where(
          and(
            eq(arosOutreachQueue.constitutionVersion, version.version)
          )
        );

      const sent = queueRows.filter((r) => r.approvalStatus === "SENT").length;
      const opened = queueRows.filter((r) => r.openedAt !== null).length;
      const replied = queueRows.filter((r) => r.repliedAt !== null).length;

      const performanceSummary = {
        version: version.version,
        periodDays: input.reviewPeriodDays,
        totalBriefsSent: sent,
        openRate: sent > 0 ? (opened / sent).toFixed(4) : "0",
        responseRate: sent > 0 ? (replied / sent).toFixed(4) : "0",
        storedResponseRate: version.executiveResponseRate,
        storedMeetingRate: version.meetingRate,
        storedProposalRate: version.proposalRate,
        storedCustomerRate: version.customerRate,
        storedDTAccuracy: version.decisionTwinAccuracy,
        storedHVAccuracy: version.hiddenVariableAccuracy,
      };

      // Generate LLM review
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are the Atlas Constitution Review Engine.
            
Your role is to analyse performance data and produce evidence-based recommendations for constitutional amendments.

CRITICAL RULES:
- You NEVER modify the Constitution automatically.
- You ONLY produce evidence and recommendations.
- Human approval creates the next Constitution version.
- Every recommendation must be grounded in observable data.
- If data is insufficient, say so explicitly. Never manufacture confidence.

Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Generate a Constitution Review Report for Atlas Constitution Version ${version.version}.

Performance Data:
${JSON.stringify(performanceSummary, null, 2)}

Constitution Description: ${version.description}

Return this exact JSON:
{
  "constitutionPerformance": "string (2-3 paragraph analysis of overall performance)",
  "calibrationImprovements": "string (analysis of calibration accuracy trends)",
  "hiddenVariablePerformance": "string (analysis of hidden variable prediction quality)",
  "decisionTwinAccuracy": "string (analysis of decision twin accuracy)",
  "executiveEngagementTrends": "string (analysis of executive response and engagement patterns)",
  "principlesImproved": ["string array — principles that appear to improve prediction quality"],
  "principlesReduced": ["string array — principles that appear to reduce response quality"],
  "recurringFailurePatterns": ["string array — observed failure patterns"],
  "suggestedAmendments": ["string array — specific, evidence-based amendment recommendations"]
}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "constitution_review",
            strict: true,
            schema: {
              type: "object",
              properties: {
                constitutionPerformance: { type: "string" },
                calibrationImprovements: { type: "string" },
                hiddenVariablePerformance: { type: "string" },
                decisionTwinAccuracy: { type: "string" },
                executiveEngagementTrends: { type: "string" },
                principlesImproved: { type: "array", items: { type: "string" } },
                principlesReduced: { type: "array", items: { type: "string" } },
                recurringFailurePatterns: { type: "array", items: { type: "string" } },
                suggestedAmendments: { type: "array", items: { type: "string" } },
              },
              required: [
                "constitutionPerformance",
                "calibrationImprovements",
                "hiddenVariablePerformance",
                "decisionTwinAccuracy",
                "executiveEngagementTrends",
                "principlesImproved",
                "principlesReduced",
                "recurringFailurePatterns",
                "suggestedAmendments",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = llmResponse?.choices?.[0]?.message?.content;
      const parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : {};

      const [review] = await db
        .insert(atlasConstitutionReviews)
        .values({
          constitutionVersionId: input.constitutionVersionId,
          reviewPeriodStart: periodStart,
          reviewPeriodEnd: periodEnd,
          calibratedOutcomeCount: sent,
          constitutionPerformance: parsed.constitutionPerformance ?? "",
          calibrationImprovements: parsed.calibrationImprovements ?? "",
          hiddenVariablePerformance: parsed.hiddenVariablePerformance ?? "",
          decisionTwinAccuracy: parsed.decisionTwinAccuracy ?? "",
          executiveEngagementTrends: parsed.executiveEngagementTrends ?? "",
          principlesImproved: JSON.stringify(parsed.principlesImproved ?? []),
          principlesReduced: JSON.stringify(parsed.principlesReduced ?? []),
          recurringFailurePatterns: JSON.stringify(parsed.recurringFailurePatterns ?? []),
          suggestedAmendments: JSON.stringify(parsed.suggestedAmendments ?? []),
          status: "DRAFT",
          createdAt: Date.now(),
        })
        .$returningId();

      return { reviewId: review.id, status: "DRAFT", summary: parsed };
    }),
});
