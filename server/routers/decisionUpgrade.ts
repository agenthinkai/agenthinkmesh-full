/**
 * server/routers/decisionUpgrade.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * tRPC procedures for the Closed-Loop Decision Upgrade System.
 *
 * Procedures:
 *   generateProtocol  — LLM-powered upgrade protocol from a rejected/conditional result
 *   applyFixesRerun   — apply selected fixes, re-run pipeline, compute delta
 *   getUpgradeRun     — fetch a stored upgrade run by id
 *   listUpgradeRuns   — list upgrade runs for the current user
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { decisionUpgradeRuns } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generateUpgradeProtocol,
  buildImprovedInput,
  computeDeltaOutput,
  type AppliedFix,
  type UpgradeProtocol,
} from "../decisionUpgradeEngine";
import { runCouncil } from "../councilEngine";
import { runProcurementCouncil } from "../procurementEngine";
import { isOwner } from "./dealScreener";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const FixTagSchema = z.enum(["ASSUMED", "IMPROVED", "USER_REQUIRED"]);

const UpgradeFixSchema = z.object({
  id: z.string(),
  category: z.enum(["missing_input", "performance_gap", "structural_issue", "narrative", "risk_mitigation"]),
  title: z.string(),
  description: z.string(),
  suggestion: z.string(),
  tag: FixTagSchema,
  fieldPath: z.string().nullish().transform(v => v ?? undefined),
  exampleValue: z.string().nullish().transform(v => v ?? ""),
});

const AppliedFixSchema = UpgradeFixSchema.extend({
  applied: z.boolean(),
  userEdited: z.string().nullish().transform(v => v ?? undefined),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const decisionUpgradeRouter = router({
  /**
   * Generate a Decision Upgrade Protocol from an existing evaluation result.
   * Stores the protocol in decision_upgrade_runs and returns the run id + protocol.
   */
  generateProtocol: protectedProcedure
    .input(z.object({
      domain: z.enum(["deal", "procurement", "enterprise", "hiring"]),
      originalRunId: z.string(),
      originalInput: z.string().min(10).max(15000),
      verdictBefore: z.string(),
      confidenceBefore: z.number().min(0).max(1),
      blockingIssues: z.array(z.string()).default([]),
      conditions: z.array(z.string()).default([]),
      agentFeedback: z.string().default(""),
      strictMode: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only trigger for non-approved verdicts
      const triggerVerdicts = ["REJECTED", "APPROVED_WITH_CONDITIONS", "VETOED", "INSUFFICIENT_DATA",
        "REJECT", "CONDITIONAL_APPROVAL", "CONDITIONAL"];
      if (!triggerVerdicts.some(v => input.verdictBefore.toUpperCase().includes(v.toUpperCase()))) {
        throw new Error("Decision Upgrade Protocol only applies to REJECTED or CONDITIONAL results.");
      }

      const protocol = await generateUpgradeProtocol({
        domain: input.domain,
        originalInput: input.originalInput,
        verdictBefore: input.verdictBefore,
        confidenceBefore: input.confidenceBefore,
        blockingIssues: input.blockingIssues,
        conditions: input.conditions,
        agentFeedback: input.agentFeedback,
        strictMode: input.strictMode,
      });

      // Store in DB
      const db = await getDb();
      if (!db) throw new Error("Database unavailable.");

      const [result] = await db.insert(decisionUpgradeRuns).values({
        userId: ctx.user.id,
        domain: input.domain,
        originalRunId: input.originalRunId,
        verdictBefore: input.verdictBefore,
        confidenceBefore: input.confidenceBefore.toString(),
        upgradeProtocolJson: JSON.stringify(protocol),
        strictMode: input.strictMode ? 1 : 0,
      });

      return {
        upgradeRunId: (result as { insertId: number }).insertId,
        protocol,
      };
    }),

  /**
   * Apply selected fixes, re-run the evaluation pipeline, compute and store delta output.
   */
  applyFixesRerun: protectedProcedure
    .input(z.object({
      upgradeRunId: z.number().int(),
      domain: z.enum(["deal", "procurement", "enterprise", "hiring"]),
      originalInput: z.string().min(10).max(15000),
      appliedFixes: z.array(AppliedFixSchema),
      // For procurement re-run
      procurementMeta: z.object({
        vendorName: z.string(),
        category: z.string(),
        contractValue: z.string().optional(),
        duration: z.string().optional(),
        requirements: z.string().optional(),
      }).optional(),
      // For deal re-run
      dealMeta: z.object({
        dealName: z.string(),
        councilMode: z.enum(["gcc", "global_vc", "india_pe"]).default("global_vc"),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable.");

      // Fetch the upgrade run
      const [upgradeRun] = await db
        .select()
        .from(decisionUpgradeRuns)
        .where(and(
          eq(decisionUpgradeRuns.id, input.upgradeRunId),
          eq(decisionUpgradeRuns.userId, ctx.user.id),
        ))
        .limit(1);

      if (!upgradeRun) throw new Error("Upgrade run not found.");

      const protocol: UpgradeProtocol = JSON.parse(upgradeRun.upgradeProtocolJson);

      // Build improved input
      const improvedInput = buildImprovedInput(
        input.originalInput,
        input.appliedFixes as AppliedFix[],
        protocol.narrativeFix,
      );

      // Re-run the appropriate pipeline
      let verdictAfter: string;
      let confidenceAfter: number;
      let blockingIssuesAfter: string[] = [];
      let improvedRunId: string;

      if (input.domain === "procurement") {
        const meta = input.procurementMeta;
        if (!meta) throw new Error("procurementMeta required for procurement re-run.");

        const report = await runProcurementCouncil({
          vendorName: meta.vendorName,
          proposalText: improvedInput,
          category: meta.category,
          contractValue: meta.contractValue,
          duration: meta.duration,
          requirements: meta.requirements,
        });

        verdictAfter = report.finalRecommendation;
        confidenceAfter = report.overallConfidence === "High" ? 0.82
          : report.overallConfidence === "Medium" ? 0.62 : 0.42;
        blockingIssuesAfter = report.agentScores
          .filter((a: { verdict: string }) => a.verdict === "REJECT")
          .flatMap((a: { topRisks?: string[] }) => a.topRisks ?? [])
          .slice(0, 5);
        improvedRunId = `procurement_improved_${Date.now()}`;

      } else {
        // Deal (default)
        const meta = input.dealMeta ?? { dealName: "Improved Deal", councilMode: "global_vc" as const };
        // Owner bypass: skip token guard (same as main screen procedure)
        const upgradeUserId = isOwner(ctx.user.email) ? undefined : ctx.user.id;
        const result = await runCouncil(improvedInput, {
          userId: upgradeUserId,
          councilMode: meta.councilMode,
        });

        verdictAfter = result.verdict;
        confidenceAfter = result.confidenceScore;
        blockingIssuesAfter = result.blockingIssues ?? [];
        improvedRunId = `deal_improved_${Date.now()}`;
      }

      // Compute delta
      const delta = await computeDeltaOutput({
        domain: input.domain,
        verdictBefore: upgradeRun.verdictBefore,
        verdictAfter,
        confidenceBefore: Number(upgradeRun.confidenceBefore),
        confidenceAfter,
        appliedFixes: input.appliedFixes as AppliedFix[],
        originalInput: input.originalInput,
        improvedInput,
        blockingIssuesBefore: JSON.parse(upgradeRun.upgradeProtocolJson)?.allFixes
          ?.filter((f: { category: string }) => f.category === "missing_input")
          ?.map((f: { description: string }) => f.description) ?? [],
        blockingIssuesAfter,
      });

      const confidenceDelta = confidenceAfter - Number(upgradeRun.confidenceBefore);

      // Update the upgrade run record
      await db
        .update(decisionUpgradeRuns)
        .set({
          improvedRunId,
          verdictAfter,
          confidenceAfter: confidenceAfter.toString(),
          confidenceDelta: confidenceDelta.toString(),
          fixesApplied: JSON.stringify(input.appliedFixes),
          deltaOutputJson: JSON.stringify(delta),
        })
        .where(eq(decisionUpgradeRuns.id, input.upgradeRunId));

      return {
        upgradeRunId: input.upgradeRunId,
        improvedRunId,
        verdictAfter,
        confidenceAfter,
        confidenceDelta,
        delta,
        improvedInput,
      };
    }),

  /**
   * Fetch a stored upgrade run by id.
   */
  getUpgradeRun: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [run] = await db
        .select()
        .from(decisionUpgradeRuns)
        .where(and(
          eq(decisionUpgradeRuns.id, input.id),
          eq(decisionUpgradeRuns.userId, ctx.user.id),
        ))
        .limit(1);
      if (!run) return null;
      return {
        ...run,
        protocol: run.upgradeProtocolJson ? JSON.parse(run.upgradeProtocolJson) : null,
        delta: run.deltaOutputJson ? JSON.parse(run.deltaOutputJson) : null,
        fixes: run.fixesApplied ? JSON.parse(run.fixesApplied) : null,
      };
    }),

  /**
   * List upgrade runs for the current user.
   */
  listUpgradeRuns: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(decisionUpgradeRuns)
        .where(eq(decisionUpgradeRuns.userId, ctx.user.id))
        .orderBy(desc(decisionUpgradeRuns.createdAt))
        .limit(input.limit);
    }),
});
