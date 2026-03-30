/**
 * server/trpc/protectedTreasuryProcedure.ts
 *
 * Treasury-guarded tRPC procedure — AgenThinkMesh V2.2
 *
 * Any procedure that touches outbound treasury spend MUST use this instead of
 * protectedProcedure. The middleware automatically calls TreasuryKillSwitch.check()
 * before the procedure handler executes — no agent calls the check manually.
 *
 * Usage:
 *   import { protectedTreasuryProcedure } from "../trpc/protectedTreasuryProcedure";
 *
 *   export const myRouter = router({
 *     executePayment: protectedTreasuryProcedure
 *       .input(z.object({ txId: z.number(), proposedSpendUSD: z.number() }))
 *       .mutation(async ({ input, ctx }) => {
 *         // Kill-switch has already been checked — safe to proceed
 *         // ctx.treasury.proposedSpendUSD and ctx.treasury.txId are available
 *       }),
 *   });
 *
 * The middleware reads `proposedSpendUSD` and `txId` from the procedure input.
 * If the input does not include these fields, the check is skipped (safe default).
 */

import { TRPCError } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "../_core/context";
import { TreasuryKillSwitch, KillSwitchError } from "../lib/safety/killSwitch";

// Re-use the same tRPC instance shape (context only — no duplicate init)
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

/**
 * Treasury context injected by the middleware.
 * Procedures using protectedTreasuryProcedure receive this in ctx.treasury.
 */
export interface TreasuryContext {
  proposedSpendUSD: number;
  txId: number;
}

/**
 * protectedTreasuryProcedure
 *
 * Extends a user-auth check with automatic kill-switch enforcement.
 * The middleware reads `proposedSpendUSD` and `txId` from the procedure input
 * (if present) and calls TreasuryKillSwitch.check() before execution.
 */
export const protectedTreasuryProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    // Auth check — same as protectedProcedure
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
).use(
  t.middleware(async ({ ctx, next, input }) => {
    // Extract spend fields from input if provided
    const inp = input as Record<string, unknown> | null | undefined;
    const proposedSpendUSD =
      typeof inp?.proposedSpendUSD === "number" ? inp.proposedSpendUSD : 0;
    const txId =
      typeof inp?.txId === "number" ? inp.txId : 0;

    if (proposedSpendUSD > 0) {
      try {
        await TreasuryKillSwitch.check(proposedSpendUSD, txId);
      } catch (err) {
        if (err instanceof KillSwitchError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }

    return next({
      ctx: {
        ...ctx,
        treasury: { proposedSpendUSD, txId } satisfies TreasuryContext,
      },
    });
  })
);
