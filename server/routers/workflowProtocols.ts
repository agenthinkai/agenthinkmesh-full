/**
 * server/routers/workflowProtocols.ts
 *
 * tRPC procedures for Workflow Protocol Registry and Report Template admin CRUD.
 * All write operations are admin-only.
 * Read operations are public.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  getWorkflowProtocol,
  listWorkflowProtocols,
  createWorkflowProtocol,
  updateWorkflowProtocol,
  invalidateProtocolCache,
} from "../lib/workflowProtocolService";
import {
  listReportTemplates,
  getReportTemplate,
  registerReportTemplate,
  invalidateReportTemplateCache,
  LEGACY_GENERATORS,
} from "../lib/reportEngineAdapter";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const workflowProtocolsRouter = router({
  // ── Workflow Protocol Registry ────────────────────────────────────────────

  /** Get a single protocol by ID — public */
  getProtocol: publicProcedure
    .input(z.object({ protocolId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const protocol = await getWorkflowProtocol(input.protocolId);
      if (!protocol) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Protocol not found: ${input.protocolId}` });
      }
      return protocol;
    }),

  /** List all ACTIVE protocols — public */
  listProtocols: publicProcedure.query(async () => {
    return listWorkflowProtocols();
  }),

  /** Create a new protocol — admin only */
  createProtocol: adminProcedure
    .input(
      z.object({
        protocolId: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Protocol ID must be lowercase alphanumeric with underscores"),
        name: z.string().min(1).max(256),
        version: z.string().max(32).default("1.0.0"),
        description: z.string().optional(),
        supportedTwinTypes: z.string().default("[]"),
        status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
        tenantAvailability: z.string().optional(),
        configSchemaRef: z.string().max(512).optional(),
        reportTemplateRef: z.string().max(512).optional(),
        agentCount: z.number().int().min(0).default(0),
        estimatedDurationSec: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return createWorkflowProtocol({
        ...input,
        description: input.description ?? null,
        tenantAvailability: input.tenantAvailability ?? null,
        configSchemaRef: input.configSchemaRef ?? null,
        reportTemplateRef: input.reportTemplateRef ?? null,
        estimatedDurationSec: input.estimatedDurationSec ?? null,
      });
    }),

  /** Update a protocol — admin only */
  updateProtocol: adminProcedure
    .input(
      z.object({
        protocolId: z.string().min(1).max(64),
        name: z.string().min(1).max(256).optional(),
        version: z.string().max(32).optional(),
        description: z.string().nullable().optional(),
        supportedTwinTypes: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
        agentCount: z.number().int().min(0).optional(),
        estimatedDurationSec: z.number().int().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { protocolId, ...updates } = input;
      return updateWorkflowProtocol(protocolId, updates);
    }),

  /** Invalidate protocol cache — admin only */
  invalidateProtocolCache: adminProcedure
    .input(z.object({ protocolId: z.string().optional() }))
    .mutation(async ({ input }) => {
      invalidateProtocolCache(input.protocolId);
      return { success: true };
    }),

  // ── Report Template Registry ──────────────────────────────────────────────

  /** List all ACTIVE report templates — public */
  listTemplates: publicProcedure.query(async () => {
    return listReportTemplates();
  }),

  /** Get a single template by ID — public */
  getTemplate: publicProcedure
    .input(z.object({ templateId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const template = await getReportTemplate(input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Template not found: ${input.templateId}` });
      }
      return template;
    }),

  /** List legacy generator manifests — public */
  listLegacyGenerators: publicProcedure.query(() => {
    return LEGACY_GENERATORS;
  }),

  /** Register a new report template — admin only */
  registerTemplate: adminProcedure
    .input(
      z.object({
        templateId: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Template ID must be lowercase alphanumeric with underscores"),
        name: z.string().min(1).max(256),
        description: z.string().optional(),
        generatorPath: z.string().min(1).max(512),
        generatorType: z.enum(["legacy", "template", "llm"]).default("legacy"),
        status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
        brandingJson: z.string().default("{}"),
        requiredInputs: z.string().default("[]"),
        supportsPageNumbers: z.number().int().min(0).max(1).default(1),
        supportsHeaderFooter: z.number().int().min(0).max(1).default(1),
      })
    )
    .mutation(async ({ input }) => {
      return registerReportTemplate({
        ...input,
        description: input.description ?? null,
      });
    }),

  /** Invalidate report template cache — admin only */
  invalidateTemplateCache: adminProcedure
    .mutation(async () => {
      invalidateReportTemplateCache();
      return { success: true };
    }),
});
