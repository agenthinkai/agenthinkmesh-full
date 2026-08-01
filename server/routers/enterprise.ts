/**
 * Enterprise Runtime tRPC Router — Sprint 3
 * Covers: organizations, departments, roles, memberships, twin instances, sessions, audit log, messages
 * Sprint 3 additions: runTwin (backed by councilEngine.runCouncil), updateMembership, listOrgMembers
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import {
  listDepartments,
  createDepartment,
  listRoles,
  createRole,
  listMemberships,
  createMembership,
  listTwinInstances,
  getTwinInstance,
  createTwinInstance,
  updateTwinInstanceStatus,
  archiveTwinInstance,
  createTwinSession,
  completeTwinSession,
  listTwinSessions,
  writeAuditLog,
  listAuditLog,
  sendTwinMessage,
  listTwinMessages,
  acknowledgeTwinMessage,
  getEnterpriseStats,
  updateMembershipStatus,
  listOrgMembers,
} from "../lib/enterpriseRuntimeService";
import { runCouncil } from "../councilEngine";

const CouncilModeSchema = z.enum(["gcc", "global_vc", "india_pe", "gcc_equities", "infrastructure"]);

const GovernanceProfileSchema = z.enum(["STANDARD", "CONFIDENTIAL", "SOVEREIGN", "CLASSIFIED"]);
const SessionTypeSchema = z.enum(["run", "simulate", "deliberate", "compare", "calibrate"]);
const MessageTypeSchema = z.enum(["signal", "alert", "data_update", "recommendation", "calibration"]);
const MessagePrioritySchema = z.enum(["low", "normal", "high", "critical"]);

export const enterpriseRouter = router({
  // ─── Stats ─────────────────────────────────────────────────────────────────
  getStats: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getEnterpriseStats(input.orgId);
    }),

  // ─── Departments ───────────────────────────────────────────────────────────
  listDepartments: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return listDepartments(input.orgId);
    }),

  createDepartment: adminProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1).max(128),
      slug: z.string().min(1).max(64),
      description: z.string().optional(),
      parentDeptId: z.number().optional(),
      headUserId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return createDepartment(input);
    }),

  // ─── Roles ─────────────────────────────────────────────────────────────────
  listRoles: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return listRoles(input.orgId);
    }),

  createRole: adminProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1).max(64),
      slug: z.string().min(1).max(64),
      description: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      twinAccess: z.array(z.string()).optional(),
      isSystemRole: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return createRole(input);
    }),

  // ─── Memberships ───────────────────────────────────────────────────────────
  listMemberships: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return listMemberships(input.orgId);
    }),

  createMembership: adminProcedure
    .input(z.object({
      orgId: z.number(),
      userId: z.number(),
      roleId: z.number(),
      deptId: z.number().optional(),
      jobTitle: z.string().max(128).optional(),
    }))
    .mutation(async ({ input }) => {
      return createMembership(input);
    }),

  // ─── Twin Instances ─────────────────────────────────────────────────────────
  listTwinInstances: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return listTwinInstances(input.orgId);
    }),

  getTwinInstance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getTwinInstance(input.id);
    }),

  createTwinInstance: adminProcedure
    .input(z.object({
      orgId: z.number(),
      deptId: z.number().optional(),
      blueprintId: z.string().min(1).max(64),
      instanceSlug: z.string().min(1).max(128),
      displayName: z.string().min(1).max(128),
      description: z.string().optional(),
      industry: z.string().max(64).optional(),
      geography: z.string().max(64).optional(),
      councilPersonaSetId: z.string().max(64).optional(),
      ontologyId: z.string().max(64).optional(),
      kpiSetId: z.string().max(64).optional(),
      governanceProfile: GovernanceProfileSchema.optional(),
      configJson: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      return createTwinInstance(input);
    }),

  updateTwinInstanceStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["provisioning", "active", "suspended", "archived"]),
    }))
    .mutation(async ({ input }) => {
      await updateTwinInstanceStatus(input.id, input.status);
      return { success: true };
    }),

  archiveTwinInstance: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await archiveTwinInstance(input.id);
      return { success: true };
    }),

  // ─── Twin Sessions ──────────────────────────────────────────────────────────
  listTwinSessions: protectedProcedure
    .input(z.object({ twinInstanceId: z.number(), limit: z.number().max(100).optional() }))
    .query(async ({ input }) => {
      return listTwinSessions(input.twinInstanceId, input.limit);
    }),

  createTwinSession: protectedProcedure
    .input(z.object({
      twinInstanceId: z.number(),
      orgId: z.number(),
      sessionType: SessionTypeSchema,
      inputJson: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return createTwinSession({ ...input, userId: ctx.user.id });
    }),

  completeTwinSession: protectedProcedure
    .input(z.object({
      id: z.number(),
      output: z.record(z.string(), z.unknown()),
      durationMs: z.number(),
      tokensUsed: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await completeTwinSession(input.id, input.output, input.durationMs, input.tokensUsed ?? 0);
      return { success: true };
    }),

  // ─── Audit Log ──────────────────────────────────────────────────────────────
  listAuditLog: adminProcedure
    .input(z.object({ orgId: z.number(), limit: z.number().max(200).optional() }))
    .query(async ({ input }) => {
      return listAuditLog(input.orgId, input.limit);
    }),

  writeAuditLog: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      action: z.string().min(1).max(128),
      resourceType: z.string().min(1).max(64),
      resourceId: z.string().max(128).optional(),
      details: z.string().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await writeAuditLog({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  // ─── Twin Messages ──────────────────────────────────────────────────────────
  listTwinMessages: protectedProcedure
    .input(z.object({ orgId: z.number(), twinId: z.number().optional(), limit: z.number().max(100).optional() }))
    .query(async ({ input }) => {
      return listTwinMessages(input.orgId, input.twinId, input.limit);
    }),

  sendTwinMessage: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      fromTwinId: z.number(),
      toTwinId: z.number(),
      messageType: MessageTypeSchema,
      subject: z.string().min(1).max(256),
      payloadJson: z.record(z.string(), z.unknown()).optional(),
      priority: MessagePrioritySchema.optional(),
    }))
    .mutation(async ({ input }) => {
      return sendTwinMessage(input);
    }),

  acknowledgeTwinMessage: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await acknowledgeTwinMessage(input.id);
      return { success: true };
    }),

  // ─── Sprint 3: runTwin — backed by councilEngine.runCouncil ──────────────────────
  /**
   * runTwin: executes a Decision Twin session using the council engine.
   * Validates org ownership of the twin instance, creates a session record with
   * councilPersonaSetId-derived councilMode, and persists the result.
   */
  runTwin: protectedProcedure
    .input(z.object({
      twinInstanceId: z.number(),
      orgId: z.number(),
      sessionType: SessionTypeSchema.default("run"),
      decisionText: z.string().min(10).max(8000),
      councilMode: CouncilModeSchema.optional().default("gcc"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify twin instance belongs to the org
      const instance = await getTwinInstance(input.twinInstanceId);
      if (!instance || instance.orgId !== input.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found or org mismatch" });
      }
      if (instance.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Twin instance is not active" });
      }

      // Create session record
      const session = await createTwinSession({
        twinInstanceId: input.twinInstanceId,
        orgId: input.orgId,
        userId: ctx.user.id,
        sessionType: input.sessionType,
        inputJson: { decisionText: input.decisionText, councilMode: input.councilMode },
      });

      const startMs = Date.now();
      let councilResult;
      try {
        councilResult = await runCouncil(input.decisionText, {
          councilMode: input.councilMode,
          userId: ctx.user.id,
          clientId: `enterprise-org-${input.orgId}`,
          bypassCostGuard: false,
        });
      } catch (err) {
        await completeTwinSession(session.id, { error: String(err) }, Date.now() - startMs, 0);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Council engine failed" });
      }

      const durationMs = Date.now() - startMs;
      const tokensUsed = 0; // token tracking via billing layer, not CouncilResult
      await completeTwinSession(session.id, councilResult as any, durationMs, tokensUsed);

      // Write audit log
      await writeAuditLog({
        orgId: input.orgId,
        userId: ctx.user.id,
        action: `twin.${input.sessionType}`,
        resourceType: "twin_session",
        resourceId: String(session.id),
        details: `Ran ${input.sessionType} on twin ${input.twinInstanceId}, verdict: ${councilResult.verdict}`,
        severity: "info",
      });

      return {
        sessionId: session.id,
        twinInstanceId: input.twinInstanceId,
        sessionType: input.sessionType,
        verdict: councilResult.verdict,
        finalScore: councilResult.finalScore,
        confidenceScore: councilResult.confidenceScore,
        conditionsToProceed: councilResult.conditionsToProceed,
        blockingIssues: councilResult.blockingIssues,
        durationMs,
      };
    }),

  // ─── Sprint 3: Org User Management ─────────────────────────────────────────────
  listOrgMembers: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return listOrgMembers(input.orgId);
    }),

  updateMembership: adminProcedure
    .input(z.object({
      membershipId: z.number(),
      orgId: z.number(),
      status: z.enum(["active", "suspended", "invited"]),
    }))
    .mutation(async ({ input }) => {
      return updateMembershipStatus(input.membershipId, input.orgId, input.status);
    }),

  suspendMembership: adminProcedure
    .input(z.object({ membershipId: z.number(), orgId: z.number() }))
    .mutation(async ({ input }) => {
      return updateMembershipStatus(input.membershipId, input.orgId, "suspended");
    }),

  reactivateMembership: adminProcedure
    .input(z.object({ membershipId: z.number(), orgId: z.number() }))
    .mutation(async ({ input }) => {
      return updateMembershipStatus(input.membershipId, input.orgId, "active");
    }),
});
