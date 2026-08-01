/**
 * Enterprise Runtime tRPC Router — Sprint 2B
 * Covers: organizations, departments, roles, memberships, twin instances, sessions, audit log, messages
 */

import { z } from "zod";
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
} from "../lib/enterpriseRuntimeService";

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
});
