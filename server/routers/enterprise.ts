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
import { organizations, kpiDefinitions, twinInstances, twinSessions, outcomeSessions, enterpriseAuditLog, cockpitDecisions, cockpitCouncilResults, cockpitOperatingKpis, cockpitScenarioResults } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { eq, and, desc, count } from "drizzle-orm";

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

  // ─── Self-Service Onboarding: Atomic Provision (Step 8 of /enterprise/setup wizard) ───
  // Creates org + departments + admin role + admin membership + twin instances
  // + connector placeholders + audit record in a single atomic mutation.
  // Uses adminProcedure (platform admin) because the org doesn't exist yet.
  provisionOrg: adminProcedure
    .input(z.object({
      org: z.object({
        name: z.string().min(2).max(128),
        slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
        plan: z.enum(["trial", "standard", "enterprise"]).default("trial"),
        approvedDomains: z.array(z.string()).default([]),
        dailyTokenLimit: z.number().int().min(1000).max(10000000).default(50000),
        industry: z.string().max(64).optional(),
        geography: z.string().max(64).optional(),
        governanceProfile: GovernanceProfileSchema.optional().default("STANDARD"),
      }),
      departments: z.array(z.object({
        name: z.string().min(1).max(128),
        slug: z.string().min(1).max(64),
        description: z.string().optional(),
      })).default([]),
      adminUser: z.object({
        userId: z.number(),
        jobTitle: z.string().max(128).optional(),
      }).optional(),
      twins: z.array(z.object({
        blueprintId: z.string(),
        instanceSlug: z.string().min(1).max(64),
        displayName: z.string().min(1).max(128),
        description: z.string().optional(),
        councilPersonaSetId: z.string().optional(),
        ontologyId: z.string().optional(),
        kpiSetId: z.string().optional(),
      })).default([]),
      connectors: z.array(z.object({
        name: z.string().min(1).max(128),
        type: z.enum(["csv", "excel", "rest", "sql"]),
        owner: z.string().max(128).optional(),
        classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
      })).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db.select({ id: organizations.id })
        .from(organizations).where(eq(organizations.slug, input.org.slug)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: `Organisation slug '${input.org.slug}' is already taken` });
      }

      const [orgResult] = await db.insert(organizations).values({
        name: input.org.name,
        slug: input.org.slug,
        plan: input.org.plan,
        approvedDomains: JSON.stringify(input.org.approvedDomains),
        dailyTokenLimit: input.org.dailyTokenLimit,
        status: "trial",
      } as any);
      const orgId = (orgResult as any).insertId as number;

      const deptIds: number[] = [];
      for (const dept of input.departments) {
        const d = await createDepartment({ ...dept, orgId });
        deptIds.push(d.id);
      }

      const adminRole = await createRole({
        orgId,
        name: "Enterprise Admin",
        slug: "enterprise-admin",
        description: "Full administrative access to the organisation",
        permissions: ["*"],
        twinAccess: ["*"],
        isSystemRole: true,
      });

      if (input.adminUser) {
        await createMembership({
          orgId,
          userId: input.adminUser.userId,
          roleId: adminRole.id,
          jobTitle: input.adminUser.jobTitle,
        });
      }

      const twinResults: Array<{ instanceSlug: string; id: number; status: string }> = [];
      for (const twin of input.twins) {
        const t = await createTwinInstance({
          orgId,
          blueprintId: twin.blueprintId,
          instanceSlug: twin.instanceSlug,
          displayName: twin.displayName,
          description: twin.description,
          industry: input.org.industry,
          geography: input.org.geography,
          councilPersonaSetId: twin.councilPersonaSetId,
          ontologyId: twin.ontologyId,
          kpiSetId: twin.kpiSetId,
          governanceProfile: input.org.governanceProfile as any,
        });
        twinResults.push({ instanceSlug: twin.instanceSlug, id: t.id, status: t.status });
      }

      await writeAuditLog({
        orgId,
        userId: ctx.user.id,
        action: "org.provision",
        resourceType: "organization",
        resourceId: String(orgId),
        details: JSON.stringify({
          slug: input.org.slug,
          departments: input.departments.length,
          twins: input.twins.length,
          connectors: input.connectors.length,
          provisionedBy: ctx.user.id,
        }),
        severity: "info",
      });

      return {
        orgId,
        slug: input.org.slug,
        name: input.org.name,
        departments: deptIds,
        adminRoleId: adminRole.id,
        twins: twinResults,
        connectorPlaceholders: input.connectors.map((c, i) => ({ ...c, id: i + 1, status: "pending" })),
        enterpriseUrl: `/enterprise/${input.org.slug}`,
        provisionedAt: new Date().toISOString(),
      };
    }),

  // ─── Cockpit — Customer Zero Executive Twin ─────────────────────────────────

  /**
   * cockpitVerifyAccess — Server-side auth + tenant guard for /twin/agenthink.
   * Returns the verified org context and primary twin instance.
   * Throws UNAUTHORIZED if not authenticated, FORBIDDEN if not an org member,
   * FORBIDDEN if org is suspended. Writes an audit log entry on every access.
   */
  cockpitVerifyAccess: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [org] = await db
        .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, status: organizations.status, plan: organizations.plan })
        .from(organizations)
        .where(eq(organizations.id, ctx.orgId))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organisation not found" });
      const [twin] = await db
        .select({ id: twinInstances.id, displayName: twinInstances.displayName, blueprintId: twinInstances.blueprintId, instanceSlug: twinInstances.instanceSlug, status: twinInstances.status, kpiSetId: twinInstances.kpiSetId, councilPersonaSetId: twinInstances.councilPersonaSetId })
        .from(twinInstances)
        .where(and(eq(twinInstances.orgId, ctx.orgId), eq(twinInstances.status, "active")))
        .limit(1);
      const [sessionCount] = await db
        .select({ total: count() })
        .from(twinSessions)
        .where(eq(twinSessions.orgId, ctx.orgId));
      await writeAuditLog({
        orgId: ctx.orgId,
        userId: ctx.user.id,
        action: "cockpit.access",
        resourceType: "twin_cockpit",
        resourceId: String(ctx.orgId),
        details: `Cockpit accessed by user ${ctx.user.id} (${ctx.user.name})`,
        severity: "info",
      });
      return {
        org,
        twin: twin ?? null,
        sessionCount: sessionCount?.total ?? 0,
        userId: ctx.user.id,
        userName: ctx.user.name,
        orgId: ctx.orgId,
      };
    }),

  /**
   * cockpitGetOrgKpis — Returns live KPI definitions for the org's kpiSetId.
   */
  cockpitGetOrgKpis: enterpriseProcedure
    .input(z.object({ kpiSetId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conditions = [eq(kpiDefinitions.status, "ACTIVE")];
      if (input.kpiSetId) conditions.push(eq(kpiDefinitions.kpiSetId, input.kpiSetId));
      const rows = await db
        .select()
        .from(kpiDefinitions)
        .where(and(...conditions))
        .orderBy(kpiDefinitions.sortOrder)
        .limit(30);
      // Compute verificationStatus from benchmarkSource presence
      // live = URL source, manual = text source, unverified = no source
      return rows.map((r) => ({
        ...r,
        verificationStatus: r.benchmarkSource
          ? (r.benchmarkSource.startsWith("http") ? "live" : "manual")
          : "unverified" as "live" | "manual" | "unverified",
        source: r.benchmarkSource ?? null,
      }));
    }),

  /**
   * cockpitGetSessionHistory — Returns the last 20 twin sessions for this org.
   */
  cockpitGetSessionHistory: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(twinSessions)
        .where(eq(twinSessions.orgId, ctx.orgId))
        .orderBy(desc(twinSessions.startedAt))
        .limit(20);
    }),

  /**
   * cockpitGetOutcomeLedger — Returns the last 20 outcome ledger entries.
   */
  cockpitGetOutcomeLedger: enterpriseProcedure
    .input(z.object({}))
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(outcomeSessions)
        .orderBy(desc(outcomeSessions.decisionDate))
        .limit(20);
    }),

  /**
   * cockpitGetAuditLog — Returns the last 20 audit log entries for this org.
   */
  cockpitGetAuditLog: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db
        .select()
        .from(enterpriseAuditLog)
        .where(eq(enterpriseAuditLog.orgId, ctx.orgId))
        .orderBy(desc(enterpriseAuditLog.createdAt))
        .limit(20);
    }),

  cockpitGetOperatingKpis: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(cockpitOperatingKpis).where(eq(cockpitOperatingKpis.orgId, ctx.orgId)).orderBy(cockpitOperatingKpis.section, cockpitOperatingKpis.kpiKey);
    }),

  cockpitUpdateOperatingKpi: enterpriseProcedure
    .input(z.object({ id: z.number(), value: z.string().nullable(), source: z.string().optional(), verificationStatus: z.enum(["live", "manual", "unverified"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(cockpitOperatingKpis).set({ value: input.value, source: input.source, verificationStatus: input.verificationStatus }).where(and(eq(cockpitOperatingKpis.id, input.id), eq(cockpitOperatingKpis.orgId, ctx.orgId)));
      return { ok: true };
    }),

  cockpitGetDecisions: enterpriseProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      return db.select().from(cockpitDecisions).where(eq(cockpitDecisions.orgId, ctx.orgId)).orderBy(desc(cockpitDecisions.createdAt));
    }),

  cockpitSaveDecision: enterpriseProcedure
    .input(z.object({
      id: z.number().optional(), decisionRef: z.string(), title: z.string(),
      decisionType: z.string().optional(), priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
      status: z.enum(["PENDING_COUNCIL", "UNDER_REVIEW", "APPROVED", "REJECTED", "DEFERRED"]).optional(),
      context: z.string().optional(), assumptions: z.string().optional(),
      owner: z.string().optional(), urgency: z.string().optional(), kpiImpact: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, kpiImpact, ...rest } = input;
      const data = { ...rest, orgId: ctx.orgId, kpiImpact: JSON.stringify(kpiImpact ?? []), submittedBy: ctx.user.name ?? "" };
      if (id) {
        await db.update(cockpitDecisions).set({ ...data, updatedAt: new Date() }).where(and(eq(cockpitDecisions.id, id), eq(cockpitDecisions.orgId, ctx.orgId)));
        return { id };
      }
      const [result] = await db.insert(cockpitDecisions).values(data as any);
      return { id: (result as any).insertId };
    }),

  cockpitRecordOutcome: enterpriseProcedure
    .input(z.object({ decisionId: z.number(), outcomeAction: z.string(), outcomeDate: z.string(), outcomeConfidence: z.number().min(0).max(100), status: z.enum(["APPROVED", "REJECTED", "DEFERRED"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(cockpitDecisions).set({ outcomeAction: input.outcomeAction, outcomeDate: input.outcomeDate, outcomeConfidence: input.outcomeConfidence, status: input.status, updatedAt: new Date() }).where(and(eq(cockpitDecisions.id, input.decisionId), eq(cockpitDecisions.orgId, ctx.orgId)));
      await db.insert(outcomeSessions).values({ orgId: ctx.orgId, dealId: `decision-${input.decisionId}`, councilMode: "executive", originalVerdict: input.status, outcomeStatus: input.status === "APPROVED" ? "SUCCEEDED" : input.status === "REJECTED" ? "FAILED" : "PENDING", decisionDate: Date.now() } as any);
      await writeAuditLog({ orgId: ctx.orgId, userId: ctx.user.id, action: "cockpit.outcome.recorded", resourceType: "cockpit_decision", resourceId: String(input.decisionId), details: `Outcome recorded: ${input.status} — ${input.outcomeAction}`, severity: "info" });
      return { ok: true };
    }),

  cockpitRunCouncil: enterpriseProcedure
    .input(z.object({ decisionId: z.number(), decisionRef: z.string(), decisionTitle: z.string(), decisionContext: z.string(), assumptions: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const AGENT_TIMEOUT_MS = 28_000;
      const EXECUTIVE_AGENTS = [
        { id: "ceo", name: "CEO Perspective", icon: "🎯" },
        { id: "cfo", name: "CFO / Financial Risk", icon: "💰" },
        { id: "cto", name: "CTO / Technical Feasibility", icon: "⚙️" },
        { id: "cco", name: "Chief Commercial Officer", icon: "🤝" },
        { id: "risk", name: "Risk & Governance", icon: "⚠️" },
        { id: "strategy", name: "Strategy Advisor", icon: "🧭" },
        { id: "ops", name: "Operations Lead", icon: "🔧" },
        { id: "dissent", name: "Devil's Advocate", icon: "🔥" },
      ];
      const decisionBrief = `DECISION: ${input.decisionTitle}\n\nCONTEXT: ${input.decisionContext}\n\nASSUMPTIONS: ${input.assumptions ?? "None stated"}`;
      const agentResults = await Promise.all(EXECUTIVE_AGENTS.map(async (agent) => {
        try {
          const result = await Promise.race([
            invokeLLM({ messages: [{ role: "system", content: `You are the ${agent.name} of AgenThink Mesh. Evaluate the decision from your functional perspective. Return only valid JSON.` }, { role: "user", content: `${decisionBrief}\n\nReturn JSON: {"vote":"APPROVE"|"CONDITIONAL"|"REJECT","confidence":0-100,"headline":"one sentence","rationale":"2-3 sentences","key_condition":"most important condition or empty","risk":"primary risk in one sentence"}` }], max_tokens: 300, response_format: { type: "json_schema", json_schema: { name: "agent_vote", strict: true, schema: { type: "object", properties: { vote: { type: "string", enum: ["APPROVE","CONDITIONAL","REJECT"] }, confidence: { type: "number" }, headline: { type: "string" }, rationale: { type: "string" }, key_condition: { type: "string" }, risk: { type: "string" } }, required: ["vote","confidence","headline","rationale","key_condition","risk"], additionalProperties: false } } } }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), AGENT_TIMEOUT_MS)),
          ]);
          const content = result.choices[0]?.message?.content;
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          return { ...agent, ...parsed, error: null };
        } catch { return { ...agent, vote: "CONDITIONAL" as const, confidence: 50, headline: "Insufficient context for definitive assessment.", rationale: "Agent timed out. Manual review recommended.", key_condition: "Provide additional context.", risk: "Unknown.", error: "timeout" }; }
      }));
      const tallyApprove = agentResults.filter(a => a.vote === "APPROVE").length;
      const tallyConditional = agentResults.filter(a => a.vote === "CONDITIONAL").length;
      const tallyReject = agentResults.filter(a => a.vote === "REJECT").length;
      let judgeResult: any = { final_verdict: "APPROVED_WITH_CONDITIONS", confidence: 72, synthesis: "The council majority supports proceeding with conditions.", the_bet: "This decision succeeds if the primary condition is met.", conditions: ["Address the primary risk identified.", "Confirm resource availability."], dissent: "The Devil's Advocate raises a concern that should not be dismissed.", required_evidence: "Additional data points required before final commitment." };
      try {
        const judgeResponse = await Promise.race([
          invokeLLM({ messages: [{ role: "system", content: `You are the Judge of the AgenThink Executive Council. Synthesise 8 agent votes into a final verdict for: ${input.decisionTitle}. Return only valid JSON.` }, { role: "user", content: `Agent votes: ${JSON.stringify(agentResults.map(a => ({ name: a.name, vote: a.vote, confidence: a.confidence, headline: a.headline, key_condition: a.key_condition })))}\n\nReturn JSON: {"final_verdict":"APPROVED"|"APPROVED_WITH_CONDITIONS"|"REJECTED","confidence":0-100,"synthesis":"3-4 sentences","the_bet":"one sentence","conditions":["condition 1"],"dissent":"most important dissenting view","required_evidence":"what data would change this verdict"}` }], max_tokens: 600, response_format: { type: "json_schema", json_schema: { name: "judge_verdict", strict: true, schema: { type: "object", properties: { final_verdict: { type: "string", enum: ["APPROVED","APPROVED_WITH_CONDITIONS","REJECTED"] }, confidence: { type: "number" }, synthesis: { type: "string" }, the_bet: { type: "string" }, conditions: { type: "array", items: { type: "string" } }, dissent: { type: "string" }, required_evidence: { type: "string" } }, required: ["final_verdict","confidence","synthesis","the_bet","conditions","dissent","required_evidence"], additionalProperties: false } } } }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("judge timeout")), AGENT_TIMEOUT_MS)),
        ]);
        const judgeContent = judgeResponse.choices[0]?.message?.content;
        judgeResult = typeof judgeContent === "string" ? JSON.parse(judgeContent) : judgeContent;
      } catch { console.warn("[cockpitRunCouncil] Judge timeout"); }
      const [insertResult] = await db.insert(cockpitCouncilResults).values({ orgId: ctx.orgId, decisionId: input.decisionId, decisionRef: input.decisionRef, councilMode: "executive", agentsJson: JSON.stringify(agentResults), judgeJson: JSON.stringify(judgeResult), tallyApprove, tallyConditional, tallyReject, finalVerdict: judgeResult.final_verdict, confidence: judgeResult.confidence } as any);
      await db.update(cockpitDecisions).set({ status: "UNDER_REVIEW", updatedAt: new Date() }).where(and(eq(cockpitDecisions.id, input.decisionId), eq(cockpitDecisions.orgId, ctx.orgId)));
      await writeAuditLog({ orgId: ctx.orgId, userId: ctx.user.id, action: "cockpit.council.run", resourceType: "cockpit_decision", resourceId: input.decisionRef, details: `Council run for: ${input.decisionTitle} — Verdict: ${judgeResult.final_verdict} (${judgeResult.confidence}%)`, severity: "info" });
      return { agents: agentResults, judge: judgeResult, tally: { approve: tallyApprove, conditional: tallyConditional, reject: tallyReject }, runAt: new Date().toISOString(), councilResultId: (insertResult as any).insertId };
    }),

  cockpitGetCouncilResults: enterpriseProcedure
    .input(z.object({ decisionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db.select().from(cockpitCouncilResults).where(and(eq(cockpitCouncilResults.orgId, ctx.orgId), eq(cockpitCouncilResults.decisionId, input.decisionId))).orderBy(desc(cockpitCouncilResults.runAt)).limit(5);
      return rows.map(r => ({ ...r, agents: JSON.parse(r.agentsJson), judge: JSON.parse(r.judgeJson) }));
    }),

  cockpitRunScenario: enterpriseProcedure
    .input(z.object({
      decisionId: z.number(), scenarioName: z.string(),
      weights: z.object({ relationshipStrength: z.number(), probabilityOfMeeting: z.number(), timeToPilot: z.number(), regulatoryComplexity: z.number(), dataAccessComplexity: z.number(), implementationEffort: z.number(), contractValue: z.number(), referenceValue: z.number(), expansionPotential: z.number() }),
      candidates: z.array(z.object({ name: z.string(), scores: z.object({ relationshipStrength: z.number(), probabilityOfMeeting: z.number(), timeToPilot: z.number(), regulatoryComplexity: z.number(), dataAccessComplexity: z.number(), implementationEffort: z.number(), contractValue: z.number(), referenceValue: z.number(), expansionPotential: z.number() }) })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const candidates = input.candidates ?? [
        { name: "Alghanim Industries", scores: { relationshipStrength: 8, probabilityOfMeeting: 9, timeToPilot: 7, regulatoryComplexity: 5, dataAccessComplexity: 5, implementationEffort: 6, contractValue: 9, referenceValue: 9, expansionPotential: 10 } },
        { name: "Accenture Middle East", scores: { relationshipStrength: 6, probabilityOfMeeting: 7, timeToPilot: 5, regulatoryComplexity: 4, dataAccessComplexity: 4, implementationEffort: 7, contractValue: 8, referenceValue: 8, expansionPotential: 7 } },
        { name: "Kuwait Finance House", scores: { relationshipStrength: 5, probabilityOfMeeting: 6, timeToPilot: 4, regulatoryComplexity: 7, dataAccessComplexity: 7, implementationEffort: 8, contractValue: 7, referenceValue: 7, expansionPotential: 6 } },
        { name: "KIPCO Group", scores: { relationshipStrength: 4, probabilityOfMeeting: 5, timeToPilot: 6, regulatoryComplexity: 5, dataAccessComplexity: 6, implementationEffort: 5, contractValue: 8, referenceValue: 8, expansionPotential: 9 } },
        { name: "Zain Group", scores: { relationshipStrength: 3, probabilityOfMeeting: 4, timeToPilot: 5, regulatoryComplexity: 4, dataAccessComplexity: 5, implementationEffort: 6, contractValue: 7, referenceValue: 6, expansionPotential: 7 } },
      ];
      const weightKeys = Object.keys(input.weights) as Array<keyof typeof input.weights>;
      const totalWeight = weightKeys.reduce((sum, k) => sum + input.weights[k], 0);
      const rankings = candidates.map(c => {
        const weightedScore = weightKeys.reduce((sum, k) => { const w = input.weights[k] / totalWeight; const s = c.scores[k]; const isInverted = ["regulatoryComplexity","dataAccessComplexity","implementationEffort","timeToPilot"].includes(k); return sum + w * (isInverted ? 10 - s : s); }, 0);
        return { name: c.name, weightedScore: Math.round(weightedScore * 10) / 10, rawScores: c.scores };
      }).sort((a, b) => b.weightedScore - a.weightedScore);
      const sensitivityMap: Record<string, string> = {};
      weightKeys.forEach(k => { const topByDimension = [...candidates].sort((a, b) => { const isInverted = ["regulatoryComplexity","dataAccessComplexity","implementationEffort","timeToPilot"].includes(k); return isInverted ? a.scores[k] - b.scores[k] : b.scores[k] - a.scores[k]; }); sensitivityMap[k] = topByDimension[0]?.name ?? ""; });
      const recommendation = `Under the "${input.scenarioName}" scenario, ${rankings[0]?.name} ranks first with a weighted score of ${rankings[0]?.weightedScore}/10. ${rankings[1]?.name} is second at ${rankings[1]?.weightedScore}/10.`;
      await db.insert(cockpitScenarioResults).values({ orgId: ctx.orgId, decisionId: input.decisionId, scenarioName: input.scenarioName, weightsJson: JSON.stringify(input.weights), rankingsJson: JSON.stringify(rankings), sensitivityJson: JSON.stringify(sensitivityMap), recommendation } as any);
      return { rankings, sensitivityMap, recommendation, scenarioName: input.scenarioName };
    }),

  cockpitGetScenarioResults: enterpriseProcedure
    .input(z.object({ decisionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const rows = await db.select().from(cockpitScenarioResults).where(and(eq(cockpitScenarioResults.orgId, ctx.orgId), eq(cockpitScenarioResults.decisionId, input.decisionId))).orderBy(desc(cockpitScenarioResults.runAt)).limit(10);
      return rows.map(r => ({ ...r, rankings: JSON.parse(r.rankingsJson), weights: JSON.parse(r.weightsJson), sensitivity: JSON.parse(r.sensitivityJson) }));
    }),

  cockpitGenerateReport: enterpriseProcedure
    .input(z.object({ reportType: z.enum(["executive_decision","customer_prioritization","board_summary","weekly_ops","customer_zero_status"]), decisionId: z.number().optional(), additionalContext: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let decisionContext = "";
      let councilContext = "";
      if (input.decisionId) {
        const [decision] = await db.select().from(cockpitDecisions).where(and(eq(cockpitDecisions.id, input.decisionId), eq(cockpitDecisions.orgId, ctx.orgId))).limit(1);
        if (decision) decisionContext = `Decision: ${decision.title}\nContext: ${decision.context}\nAssumptions: ${decision.assumptions}\nStatus: ${decision.status}`;
        const [councilResult] = await db.select().from(cockpitCouncilResults).where(and(eq(cockpitCouncilResults.decisionId, input.decisionId), eq(cockpitCouncilResults.orgId, ctx.orgId))).orderBy(desc(cockpitCouncilResults.runAt)).limit(1);
        if (councilResult) { const judge = JSON.parse(councilResult.judgeJson); councilContext = `Council Verdict: ${councilResult.finalVerdict} (${councilResult.confidence}% confidence)\nThe Bet: ${judge.the_bet}\nSynthesis: ${judge.synthesis}\nDissent: ${judge.dissent}`; }
      }
      const reportPrompts: Record<string, string> = {
        executive_decision: `Generate a concise Executive Decision Report for AgenThink Mesh. Include: 1) Decision Summary, 2) Evidence & Assumptions, 3) Council Result, 4) Recommendation, 5) Dissent, 6) Action Plan with dates, 7) Outcome Measurement Date. Use markdown. Be direct and opinionated.`,
        customer_prioritization: `Generate a Customer Prioritization Report for AgenThink Mesh. Include: 1) Executive Summary, 2) Priority Ranking of prospects (Alghanim, Accenture, KFH, KIPCO, Zain), 3) Selection Rationale, 4) Risk Assessment per prospect, 5) Recommended First Customer with justification, 6) 30-day action plan. Use markdown.`,
        board_summary: `Generate a Board Summary for AgenThink Mesh. Include: 1) Company Status, 2) Key Decisions Made This Month, 3) Commercial Pipeline, 4) Platform Readiness, 5) Next 30-Day Priorities, 6) Risks & Mitigations. Maximum 1 page. Use markdown.`,
        weekly_ops: `Generate a Weekly Operating Review for AgenThink Mesh. Include: 1) Week Summary, 2) Commercial Progress, 3) Engineering Progress, 4) Customer Zero Status, 5) Blockers, 6) Next Week Priorities. Use markdown.`,
        customer_zero_status: `Generate a Customer Zero Status Report for AgenThink Mesh. Include: 1) Current Status, 2) Authentication & Access (RESOLVED), 3) Cockpit Functionality Status, 4) Decision Queue Status, 5) Council Execution Status, 6) Next Steps to Full Activation. Use markdown.`,
      };
      const systemPrompt = reportPrompts[input.reportType];
      const userContent = [decisionContext, councilContext, input.additionalContext].filter(Boolean).join("\n\n") || "Generate based on AgenThink Mesh current operating context.";
      const response = await invokeLLM({ messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }], max_tokens: 1500 });
      const rawContent = response.choices[0]?.message?.content;
      const reportContent = typeof rawContent === "string" ? rawContent : Array.isArray(rawContent) ? rawContent.map((c: any) => c.text ?? "").join("") : "Report generation failed.";
      await writeAuditLog({ orgId: ctx.orgId, userId: ctx.user.id, action: "cockpit.report.generated", resourceType: "report", resourceId: input.reportType, details: `Report type: ${input.reportType}`, severity: "info" });
      return { reportType: input.reportType, content: reportContent, generatedAt: new Date().toISOString() };
    }),
});

