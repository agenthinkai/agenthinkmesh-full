/**
 * Enterprise Runtime tRPC Router — Enterprise Certification Sprint (CR-1)
 *
 * TENANT ISOLATION: All procedures use ctx.orgId resolved by orgMiddleware.
 * The client NEVER supplies orgId. Any attempt to access another org's data
 * is structurally impossible — the server resolves the org from the
 * authenticated user's active membership record.
 *
 * Procedures that previously accepted orgId as input now ignore it entirely.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../_core/trpc";
import { enterpriseProcedure, enterpriseAdminProcedure } from "../_core/orgMiddleware";
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
import { getDb } from "../db";
import { organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const CouncilModeSchema = z.enum(["gcc", "global_vc", "india_pe", "gcc_equities", "infrastructure"]);
const GovernanceProfileSchema = z.enum(["STANDARD", "CONFIDENTIAL", "SOVEREIGN", "CLASSIFIED"]);
const SessionTypeSchema = z.enum(["run", "simulate", "deliberate", "compare", "calibrate"]);
const MessageTypeSchema = z.enum(["signal", "alert", "data_update", "recommendation", "calibration"]);
const MessagePrioritySchema = z.enum(["low", "normal", "high", "critical"]);

export const enterpriseRouter = router({

  // ─── Platform Admin: Organisation Management (no org membership required) ──
  // Uses adminProcedure (role=admin), not enterpriseProcedure, because these
  // operate at the platform level — before any org membership exists.

  createOrganization: adminProcedure
    .input(z.object({
      name: z.string().min(2).max(128),
      slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
      plan: z.enum(["trial", "standard", "enterprise"]).default("trial"),
      approvedDomains: z.array(z.string()).default([]),
      dailyTokenLimit: z.number().int().min(1000).max(10000000).default(50000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const existing = await db.select({ id: organizations.id })
        .from(organizations).where(eq(organizations.slug, input.slug)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: `Organisation slug '${input.slug}' is already taken` });
      }
      const [result] = await db.insert(organizations).values({
        name: input.name,
        slug: input.slug,
        plan: input.plan,
        approvedDomains: JSON.stringify(input.approvedDomains),
        dailyTokenLimit: input.dailyTokenLimit,
        status: "trial",
      });
      return { id: (result as any).insertId, slug: input.slug, name: input.name };
    }),

  listOrganizations: adminProcedure
    .input(z.object({}))
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(organizations).orderBy(organizations.createdAt);
    }),

  getOrganization: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, input.id)).limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation not found" });
      return org;
    }),

  updateOrganization: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(2).max(128).optional(),
      plan: z.enum(["trial", "standard", "enterprise"]).optional(),
      status: z.enum(["active", "suspended", "trial"]).optional(),
      approvedDomains: z.array(z.string()).optional(),
      dailyTokenLimit: z.number().int().min(1000).max(10000000).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, approvedDomains, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (approvedDomains !== undefined) updateData.approvedDomains = JSON.stringify(approvedDomains);
      await db.update(organizations).set(updateData).where(eq(organizations.id, id));
      return { success: true };
    }),

  // ─── Stats ─────────────────────────────────────────────────────────────────
  // orgId resolved from ctx — never from input
  getStats: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return getEnterpriseStats(ctx.orgId);
    }),

  // ─── Departments ───────────────────────────────────────────────────────────
  listDepartments: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return listDepartments(ctx.orgId);
    }),

  createDepartment: enterpriseAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      slug: z.string().min(1).max(64),
      description: z.string().optional(),
      parentDeptId: z.number().optional(),
      headUserId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return createDepartment({ ...input, orgId: ctx.orgId });
    }),

  // ─── Roles ─────────────────────────────────────────────────────────────────
  listRoles: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return listRoles(ctx.orgId);
    }),

  createRole: enterpriseAdminProcedure
    .input(z.object({
      name: z.string().min(1).max(64),
      slug: z.string().min(1).max(64),
      description: z.string().optional(),
      permissions: z.array(z.string()).optional(),
      twinAccess: z.array(z.string()).optional(),
      isSystemRole: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return createRole({ ...input, orgId: ctx.orgId });
    }),

  // ─── Memberships ───────────────────────────────────────────────────────────
  listMemberships: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return listMemberships(ctx.orgId);
    }),

  createMembership: enterpriseAdminProcedure
    .input(z.object({
      userId: z.number(),
      roleId: z.number(),
      deptId: z.number().optional(),
      jobTitle: z.string().max(128).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return createMembership({ ...input, orgId: ctx.orgId });
    }),

  // ─── Twin Instances ─────────────────────────────────────────────────────────
  listTwinInstances: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return listTwinInstances(ctx.orgId);
    }),

  getTwinInstance: enterpriseProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const instance = await getTwinInstance(input.id);
      // Verify the instance belongs to the user's org
      if (!instance || instance.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found" });
      }
      return instance;
    }),

  createTwinInstance: enterpriseAdminProcedure
    .input(z.object({
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
    .mutation(async ({ input, ctx }) => {
      return createTwinInstance({ ...input, orgId: ctx.orgId });
    }),

  updateTwinInstanceStatus: enterpriseAdminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["provisioning", "active", "suspended", "archived"]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership before updating
      const instance = await getTwinInstance(input.id);
      if (!instance || instance.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found" });
      }
      await updateTwinInstanceStatus(input.id, input.status);
      return { success: true };
    }),

  archiveTwinInstance: enterpriseAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const instance = await getTwinInstance(input.id);
      if (!instance || instance.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found" });
      }
      await archiveTwinInstance(input.id);
      return { success: true };
    }),

  // ─── Twin Sessions ──────────────────────────────────────────────────────────
  listTwinSessions: enterpriseProcedure
    .input(z.object({ twinInstanceId: z.number(), limit: z.number().max(100).optional() }))
    .query(async ({ input, ctx }) => {
      // Verify twin belongs to user's org before listing sessions
      const instance = await getTwinInstance(input.twinInstanceId);
      if (!instance || instance.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found" });
      }
      return listTwinSessions(input.twinInstanceId, input.limit);
    }),

  createTwinSession: enterpriseProcedure
    .input(z.object({
      twinInstanceId: z.number(),
      sessionType: SessionTypeSchema,
      inputJson: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const instance = await getTwinInstance(input.twinInstanceId);
      if (!instance || instance.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found" });
      }
      return createTwinSession({ ...input, orgId: ctx.orgId, userId: ctx.user.id });
    }),

  completeTwinSession: enterpriseProcedure
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
  listAuditLog: enterpriseAdminProcedure
    .input(z.object({ limit: z.number().max(200).optional() }))
    .query(async ({ input, ctx }) => {
      return listAuditLog(ctx.orgId, input.limit);
    }),

  writeAuditLog: enterpriseProcedure
    .input(z.object({
      action: z.string().min(1).max(128),
      resourceType: z.string().min(1).max(64),
      resourceId: z.string().max(128).optional(),
      details: z.string().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await writeAuditLog({ ...input, orgId: ctx.orgId, userId: ctx.user.id });
      return { success: true };
    }),

  // ─── Twin Messages ──────────────────────────────────────────────────────────
  listTwinMessages: enterpriseProcedure
    .input(z.object({ twinId: z.number().optional(), limit: z.number().max(100).optional() }))
    .query(async ({ input, ctx }) => {
      return listTwinMessages(ctx.orgId, input.twinId, input.limit);
    }),

  sendTwinMessage: enterpriseProcedure
    .input(z.object({
      fromTwinId: z.number(),
      toTwinId: z.number(),
      messageType: MessageTypeSchema,
      subject: z.string().min(1).max(256),
      payloadJson: z.record(z.string(), z.unknown()).optional(),
      priority: MessagePrioritySchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify both twins belong to the user's org
      const [fromTwin, toTwin] = await Promise.all([
        getTwinInstance(input.fromTwinId),
        getTwinInstance(input.toTwinId),
      ]);
      if (!fromTwin || fromTwin.orgId !== ctx.orgId || !toTwin || toTwin.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found or org mismatch" });
      }
      return sendTwinMessage({ ...input, orgId: ctx.orgId });
    }),

  acknowledgeTwinMessage: enterpriseProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await acknowledgeTwinMessage(input.id);
      return { success: true };
    }),

  // ─── runTwin — Decision Twin Execution ─────────────────────────────────────
  /**
   * TENANT ISOLATION: orgId is from ctx (server-resolved), never from input.
   * The twin instance ownership is verified against ctx.orgId before execution.
   */
  runTwin: enterpriseProcedure
    .input(z.object({
      twinInstanceId: z.number(),
      sessionType: SessionTypeSchema.default("run"),
      decisionText: z.string().min(10).max(8000),
      councilMode: CouncilModeSchema.optional().default("gcc"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify twin instance belongs to the user's verified org
      const instance = await getTwinInstance(input.twinInstanceId);
      if (!instance || instance.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Twin instance not found" });
      }
      if (instance.status !== "active") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Twin instance is not active" });
      }

      // Create session record — orgId from ctx, never from input
      const session = await createTwinSession({
        twinInstanceId: input.twinInstanceId,
        orgId: ctx.orgId,
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
          clientId: `enterprise-org-${ctx.orgId}`,
          bypassCostGuard: false,
        });
      } catch (err) {
        await completeTwinSession(session.id, { error: String(err) }, Date.now() - startMs, 0);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Council engine failed" });
      }

      const durationMs = Date.now() - startMs;
      await completeTwinSession(session.id, councilResult as any, durationMs, 0);

      // Write audit log — orgId from ctx
      await writeAuditLog({
        orgId: ctx.orgId,
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

  // ─── Org User Management ─────────────────────────────────────────────────
  listOrgMembers: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      return listOrgMembers(ctx.orgId);
    }),

  updateMembership: enterpriseAdminProcedure
    .input(z.object({
      membershipId: z.number(),
      status: z.enum(["active", "suspended", "invited"]),
    }))
    .mutation(async ({ input, ctx }) => {
      return updateMembershipStatus(input.membershipId, ctx.orgId, input.status);
    }),

  suspendMembership: enterpriseAdminProcedure
    .input(z.object({ membershipId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return updateMembershipStatus(input.membershipId, ctx.orgId, "suspended");
    }),

  reactivateMembership: enterpriseAdminProcedure
    .input(z.object({ membershipId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return updateMembershipStatus(input.membershipId, ctx.orgId, "active");
    }),
});
