/**
 * server/routers/twinParameters.ts
 *
 * tRPC procedures for Twin Parameter admin CRUD.
 * Read operations are protected (logged-in users only).
 * Write operations are admin-only.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getTwinParameters,
  getTwinParameter,
  upsertTwinParameter,
  deleteTwinParameter,
  invalidateTwinParamCache,
} from "../lib/twinParameterService";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const twinParametersRouter = router({
  /** Get all parameters for a twin — protected */
  getByTwinId: protectedProcedure
    .input(z.object({ twinId: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      return getTwinParameters(input.twinId);
    }),

  /** Get a single parameter — protected */
  getOne: protectedProcedure
    .input(z.object({ twinId: z.string().min(1).max(64), paramKey: z.string().min(1).max(128) }))
    .query(async ({ input }) => {
      const param = await getTwinParameter(input.twinId, input.paramKey);
      if (!param) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Parameter not found: ${input.twinId}/${input.paramKey}` });
      }
      return param;
    }),

  /** Upsert a parameter — admin only */
  upsert: adminProcedure
    .input(
      z.object({
        twinId: z.string().min(1).max(64),
        paramKey: z.string().min(1).max(128),
        label: z.string().min(1).max(256),
        value: z.string().min(1),
        dataType: z.enum(["number", "string", "boolean", "json"]).default("number"),
        unit: z.string().max(64).optional(),
        displayUnit: z.string().max(64).optional(),
        minValue: z.string().max(64).optional(),
        maxValue: z.string().max(64).optional(),
        formulaNote: z.string().optional(),
        source: z.string().max(512).optional(),
        sourceDate: z.string().max(32).optional(),
        confidence: z.number().int().min(0).max(100).default(80),
        isEditable: z.number().int().min(0).max(1).default(1),
        scenarioOverrides: z.string().default("{}"),
        tenantId: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return upsertTwinParameter({
        ...input,
        unit: input.unit ?? null,
        displayUnit: input.displayUnit ?? null,
        minValue: input.minValue ?? null,
        maxValue: input.maxValue ?? null,
        formulaNote: input.formulaNote ?? null,
        source: input.source ?? null,
        sourceDate: input.sourceDate ?? null,
        tenantId: input.tenantId ?? null,
        version: 1,
        valueHistory: "[]",
      });
    }),

  /** Delete a parameter — admin only */
  delete: adminProcedure
    .input(z.object({ twinId: z.string().min(1).max(64), paramKey: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => {
      await deleteTwinParameter(input.twinId, input.paramKey);
      return { success: true };
    }),

  /** Invalidate cache for a twin — admin only */
  invalidateCache: adminProcedure
    .input(z.object({ twinId: z.string().optional() }))
    .mutation(async ({ input }) => {
      invalidateTwinParamCache(input.twinId);
      return { success: true };
    }),
});
