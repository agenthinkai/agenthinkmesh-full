/**
 * Workflow Router — tRPC procedures for multiAgentSolve engine
 *
 * Procedures:
 *  - workflow.start        — start a new workflow run (protected)
 *  - workflow.getStatus    — poll run status + blackboard (protected)
 *  - workflow.retryStep    — retry from a failed step (protected)
 *  - workflow.listRuns     — list user's workflow runs (protected)
 *  - workflow.getRun       — get full run details (protected)
 *  - workflow.requestBeta  — submit beta access request (public)
 *  - workflow.checkAccess  — check if user's email domain is approved (protected)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  workflowRuns,
  workflowSteps,
  organizations,
  betaAccessRequests,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  runFullWorkflow,
  generateSessionId,
  getBlackboard,
  WORKFLOW_REGISTRY,
  type SourceDocument,
} from "../multiAgentSolve";
import { notifyOwner } from "../_core/notification";

// ── Fortress Gateway helpers ──────────────────────────────────────────────────

async function isEmailDomainApproved(email: string): Promise<boolean> {
  if (!email) return false;
  const db = await getDb();
  if (!db) return false;

  const domain = "@" + email.split("@")[1]?.toLowerCase();
  if (!domain || domain === "@") return false;

  // agenthink.ai is always approved (platform team)
  if (domain === "@agenthink.ai") return true;

  const orgs = await db.select().from(organizations).where(eq(organizations.status, "active"));
  for (const org of orgs) {
    const approved: string[] = JSON.parse(org.approvedDomains || "[]");
    if (approved.some(d => d.toLowerCase() === domain)) return true;
  }
  return false;
}

async function checkOrgTokenQuota(email: string, tokensNeeded: number): Promise<{ allowed: boolean; orgId?: number; reason?: string }> {
  const db = await getDb();
  if (!db) return { allowed: true }; // fail open if DB unavailable

  const domain = "@" + email.split("@")[1]?.toLowerCase();
  const orgs = await db.select().from(organizations).where(eq(organizations.status, "active"));

  for (const org of orgs) {
    const approved: string[] = JSON.parse(org.approvedDomains || "[]");
    if (!approved.some(d => d.toLowerCase() === domain)) continue;

    // Reset daily quota if it's a new day
    const today = new Date().toISOString().split("T")[0];
    if (org.quotaResetDate !== today) {
      await db.update(organizations)
        .set({ dailyTokensUsed: 0, quotaResetDate: today })
        .where(eq(organizations.id, org.id));
      return { allowed: true, orgId: org.id };
    }

    if (org.dailyTokensUsed + tokensNeeded > org.dailyTokenLimit) {
      return {
        allowed: false,
        orgId: org.id,
        reason: `Daily token quota exceeded for your organization (${org.dailyTokensUsed}/${org.dailyTokenLimit} tokens used today)`,
      };
    }
    return { allowed: true, orgId: org.id };
  }

  return { allowed: true }; // no org match — allow (individual user)
}

async function incrementOrgTokens(orgId: number, tokensUsed: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org[0]) return;
  await db.update(organizations)
    .set({ dailyTokensUsed: (org[0].dailyTokensUsed ?? 0) + tokensUsed })
    .where(eq(organizations.id, orgId));
}

// ── Router ────────────────────────────────────────────────────────────────────

export const workflowRouter = router({
  // ── Check if user's email domain has access ─────────────────────────────────
  checkAccess: protectedProcedure.query(async ({ ctx }) => {
    const email = ctx.user.email ?? "";
    const approved = await isEmailDomainApproved(email);
    return { approved, email };
  }),

  // ── Start a new workflow run ─────────────────────────────────────────────────
  start: protectedProcedure
    .input(z.object({
      workflowType: z.string().default("rosie_protocol"),
      sourceDocuments: z.array(z.object({
        fileName: z.string(),
        fileUrl: z.string().optional(),
        extractedText: z.string(),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const email = ctx.user.email ?? "";

      // Fortress Gateway — domain check
      const approved = await isEmailDomainApproved(email);
      if (!approved) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "FORTRESS_GATEWAY: Your email domain is not approved for access. Please request beta access.",
        });
      }

      // Workflow type validation
      if (!WORKFLOW_REGISTRY[input.workflowType]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown workflow type: ${input.workflowType}` });
      }

      // Token quota check (estimate: 6 agents × 800 tokens avg = 4800)
      const estimatedTokens = 4800;
      const quota = await checkOrgTokenQuota(email, estimatedTokens);
      if (!quota.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: quota.reason ?? "Token quota exceeded" });
      }

      const sessionId = generateSessionId();

      // Run the full pipeline (this is async — for production you'd queue this)
      const result = await runFullWorkflow({
        sessionId,
        workflowType: input.workflowType,
        userId: ctx.user.id,
        organizationId: quota.orgId,
        sourceDocuments: input.sourceDocuments as SourceDocument[],
      });

      // Update org token usage
      if (quota.orgId && result.blackboard) {
        await incrementOrgTokens(quota.orgId, result.blackboard.tokenUsage);
      }

      return {
        sessionId,
        success: result.success,
        completedSteps: result.completedSteps,
        totalSteps: result.totalSteps,
        error: result.error,
      };
    }),

  // ── Get run status + blackboard ──────────────────────────────────────────────
  getStatus: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const run = await db.select().from(workflowRuns)
        .where(and(eq(workflowRuns.sessionId, input.sessionId), eq(workflowRuns.userId, ctx.user.id)))
        .limit(1);

      if (!run[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow run not found" });

      const steps = await db.select().from(workflowSteps)
        .where(eq(workflowSteps.sessionId, input.sessionId))
        .orderBy(workflowSteps.stepIndex);

      const bb = JSON.parse(run[0].blackboardMemory || "{}");

      return {
        run: {
          sessionId: run[0].sessionId,
          status: run[0].status,
          currentStep: run[0].currentStep,
          totalSteps: run[0].totalSteps,
          totalTokensUsed: run[0].totalTokensUsed,
          failedAtStep: run[0].failedAtStep,
          failureReason: run[0].failureReason,
          retryCount: run[0].retryCount,
          durationMs: run[0].durationMs,
          startedAt: run[0].startedAt,
          completedAt: run[0].completedAt,
        },
        steps: steps.map(s => ({
          stepIndex: s.stepIndex,
          agentName: s.agentName,
          agentRole: s.agentRole,
          status: s.status,
          confidenceLevel: s.confidenceLevel,
          warningCount: s.warningCount,
          tokensUsed: s.tokensUsed,
          durationMs: s.durationMs,
          structuredOutput: s.structuredOutput ? JSON.parse(s.structuredOutput) : null,
          errorMessage: s.errorMessage,
        })),
        blackboard: {
          riskFlags: bb.riskFlags ?? [],
          routeLog: bb.routeLog ?? [],
          tokenUsage: bb.tokenUsage ?? 0,
          agentOutputs: bb.agentOutputs ?? {},
        },
      };
    }),

  // ── Retry from failed step ───────────────────────────────────────────────────
  retryStep: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const run = await db.select().from(workflowRuns)
        .where(and(eq(workflowRuns.sessionId, input.sessionId), eq(workflowRuns.userId, ctx.user.id)))
        .limit(1);

      if (!run[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow run not found" });
      if (run[0].status !== "failed") throw new TRPCError({ code: "BAD_REQUEST", message: "Run is not in failed state" });

      const fromStep = run[0].failedAtStep ?? 0;

      const result = await runFullWorkflow({
        sessionId: input.sessionId,
        workflowType: run[0].workflowType,
        userId: ctx.user.id,
        fromStep,
        sourceDocuments: JSON.parse(run[0].sourceDocuments || "[]"),
      });

      return {
        sessionId: input.sessionId,
        success: result.success,
        retriedFromStep: fromStep,
        completedSteps: result.completedSteps,
        error: result.error,
      };
    }),

  // ── List user's workflow runs ────────────────────────────────────────────────
  listRuns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const runs = await db.select().from(workflowRuns)
      .where(eq(workflowRuns.userId, ctx.user.id))
      .orderBy(desc(workflowRuns.createdAt))
      .limit(20);

    return runs.map(r => ({
      sessionId: r.sessionId,
      workflowType: r.workflowType,
      status: r.status,
      currentStep: r.currentStep,
      totalSteps: r.totalSteps,
      totalTokensUsed: r.totalTokensUsed,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));
  }),

  // ── Submit beta access request (public) ──────────────────────────────────────
  requestBeta: publicProcedure
    .input(z.object({
      name: z.string().min(2).max(128),
      firm: z.string().min(2).max(128),
      role: z.string().min(2).max(128),
      email: z.string().email().max(320),
      linkedinUrl: z.string().url().optional().or(z.literal("")),
      useCase: z.string().min(10).max(2000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.insert(betaAccessRequests).values({
        name: input.name,
        firm: input.firm,
        role: input.role,
        email: input.email,
        linkedinUrl: input.linkedinUrl || null,
        useCase: input.useCase,
        status: "pending",
        notified: false,
      });

      // Notify platform owner
      try {
        await notifyOwner({
          title: `New Beta Access Request — ${input.firm}`,
          content: `${input.name} (${input.role} at ${input.firm}) has requested beta access.\n\nEmail: ${input.email}\nUse case: ${input.useCase.slice(0, 200)}`,
        });
      } catch { /* non-critical */ }

      return { success: true, message: "Your request has been received. We will review and respond within 48 hours." };
    }),
});
