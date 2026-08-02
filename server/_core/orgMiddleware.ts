/**
 * orgMiddleware.ts — Tenant Isolation Middleware
 * Enterprise Certification Sprint — CR-1 (P0)
 *
 * SECURITY PRINCIPLE:
 *   Never trust orgId from the client request.
 *   Always resolve the authenticated user's organisation from the database.
 *   Every enterprise procedure MUST use this middleware.
 *
 * Usage:
 *   import { enterpriseProcedure } from "../_core/orgMiddleware";
 *
 *   myProcedure: enterpriseProcedure
 *     .input(z.object({ ... }))
 *     .query(async ({ input, ctx }) => {
 *       // ctx.orgId is the verified org — never from input
 *     })
 */

import { TRPCError } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getDb } from "../db";
import { enterpriseMemberships, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Re-use the same tRPC instance pattern as trpc.ts
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

/**
 * Resolves the authenticated user's active org membership from the database.
 * Throws UNAUTHORIZED if the user is not authenticated.
 * Throws FORBIDDEN if the user has no active membership in any org.
 *
 * Returns ctx enriched with:
 *   - ctx.orgId: number — the verified organisation ID
 *   - ctx.membershipId: number — the membership record ID
 *   - ctx.orgStatus: string — the organisation's current status
 */
const resolveOrgMembership = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  // Look up the user's active membership
  const memberships = await db
    .select({
      membershipId: enterpriseMemberships.id,
      orgId: enterpriseMemberships.orgId,
      status: enterpriseMemberships.status,
      orgStatus: organizations.status,
    })
    .from(enterpriseMemberships)
    .innerJoin(organizations, eq(organizations.id, enterpriseMemberships.orgId))
    .where(
      and(
        eq(enterpriseMemberships.userId, ctx.user.id),
        eq(enterpriseMemberships.status, "active"),
      )
    )
    .limit(1);

  if (memberships.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active enterprise membership found for this user",
    });
  }

  const membership = memberships[0];

  if (membership.orgStatus === "suspended") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your organisation has been suspended. Contact your administrator.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId: membership.orgId,
      membershipId: membership.membershipId,
      orgStatus: membership.orgStatus,
    },
  });
});

/**
 * enterpriseProcedure — use this for all enterprise router procedures.
 * Guarantees ctx.orgId is the server-resolved org, never client-supplied.
 */
export const enterpriseProcedure = t.procedure.use(resolveOrgMembership);

/**
 * enterpriseAdminProcedure — use this for admin-only enterprise procedures.
 * Requires platform admin role (ctx.user.role === 'admin') AND active org membership.
 */
export const enterpriseAdminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const memberships = await db
      .select({
        membershipId: enterpriseMemberships.id,
        orgId: enterpriseMemberships.orgId,
        status: enterpriseMemberships.status,
        orgStatus: organizations.status,
      })
      .from(enterpriseMemberships)
      .innerJoin(organizations, eq(organizations.id, enterpriseMemberships.orgId))
      .where(
        and(
          eq(enterpriseMemberships.userId, ctx.user.id),
          eq(enterpriseMemberships.status, "active"),
        )
      )
      .limit(1);

    if (memberships.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No active enterprise membership found for this admin user",
      });
    }

    const membership = memberships[0];

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        orgId: membership.orgId,
        membershipId: membership.membershipId,
        orgStatus: membership.orgStatus,
      },
    });
  })
);
