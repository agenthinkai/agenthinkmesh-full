/**
 * server/routers/prospectConfigs.ts
 *
 * tRPC procedures for Prospect Configuration admin CRUD.
 * All write operations are admin-only.
 * Read operations are public (configs are not sensitive).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  getProspectConfig,
  listProspectConfigs,
  createProspectConfig,
  updateProspectConfig,
  archiveProspectConfig,
  invalidateCache,
} from "../lib/prospectConfigService";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const prospectConfigsRouter = router({
  /** Get a single config by slug — public */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const config = await getProspectConfig(input.slug);
      if (!config) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Config not found: ${input.slug}` });
      }
      return config;
    }),

  /** List all ACTIVE configs — public */
  list: publicProcedure.query(async () => {
    return listProspectConfigs();
  }),

  /** Create a new config — admin only */
  create: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
        organizationName: z.string().min(1).max(256),
        industry: z.string().min(1).max(256),
        geography: z.string().min(1).max(128),
        tagline: z.string().max(512).optional(),
        primaryColor: z.string().max(32).optional(),
        accentColor: z.string().max(32).optional(),
        logoUrl: z.string().url().max(1024).optional(),
        configJson: z.string().default("{}"),
        featureFlags: z.string().default("[]"),
        status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
        ownerId: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return createProspectConfig({
        ...input,
        tagline: input.tagline ?? null,
        primaryColor: input.primaryColor ?? null,
        accentColor: input.accentColor ?? null,
        logoUrl: input.logoUrl ?? null,
        ownerId: input.ownerId ?? null,
        version: 1,
        versionHistory: "[]",
        importedFromHardcoded: 0,
      });
    }),

  /** Update an existing config — admin only */
  update: adminProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(64),
        organizationName: z.string().min(1).max(256).optional(),
        industry: z.string().min(1).max(256).optional(),
        geography: z.string().min(1).max(128).optional(),
        tagline: z.string().max(512).nullable().optional(),
        primaryColor: z.string().max(32).nullable().optional(),
        accentColor: z.string().max(32).nullable().optional(),
        logoUrl: z.string().url().max(1024).nullable().optional(),
        configJson: z.string().optional(),
        featureFlags: z.string().optional(),
        status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { slug, ...updates } = input;
      return updateProspectConfig(slug, updates);
    }),

  /** Archive a config (soft delete) — admin only */
  archive: adminProcedure
    .input(z.object({ slug: z.string().min(1).max(64) }))
    .mutation(async ({ input }) => {
      await archiveProspectConfig(input.slug);
      return { success: true };
    }),

  /** Invalidate the in-memory cache — admin only */
  invalidateCache: adminProcedure
    .input(z.object({ slug: z.string().optional() }))
    .mutation(async ({ input }) => {
      invalidateCache(input.slug);
      return { success: true };
    }),
});
