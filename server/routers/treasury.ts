/**
 * treasury.ts — tRPC router for /admin/treasury
 *
 * Admin-only procedures that expose the transactions table
 * with kill-switch flags, FX rates, region, and status.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, and, gte, lte, count } from "drizzle-orm";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { transactions } from "../../drizzle/schema";

export const treasuryRouter = router({
  // ── List transactions (paginated, filterable) ─────────────────────────────
  list: adminProcedure
    .input(z.object({
      limit:  z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
      status: z.enum(["pending", "completed", "failed", "killed", "all"]).default("all"),
      region: z.enum(["Global", "China", "all"]).default("all"),
      killSwitchOnly: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions = [];
      if (input.status !== "all")       conditions.push(eq(transactions.status, input.status));
      if (input.region !== "all")       conditions.push(eq(transactions.region, input.region));
      if (input.killSwitchOnly)         conditions.push(eq(transactions.killSwitchTriggered, true));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(transactions)
        .where(where)
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((r) => ({
        id:                  r.id,
        dealId:              r.dealId,
        userId:              r.userId,
        region:              r.region,
        status:              r.status,
        currency:            r.currency,
        baseAmountUsd:       parseFloat(r.baseAmountUsd ?? "32.50"),
        convertedAmount:     r.convertedAmount ? parseFloat(r.convertedAmount) : null,
        fxRate:              r.fxRate ? parseFloat(r.fxRate) : null,
        fxRateAt:            r.fxRateAt ? r.fxRateAt.getTime() : null,
        killSwitchTriggered: r.killSwitchTriggered,
        createdAt:           r.createdAt.getTime(),
      }));
    }),

  // ── Summary stats ─────────────────────────────────────────────────────────
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [total]     = await db.select({ c: count() }).from(transactions);
    const [killed]    = await db.select({ c: count() }).from(transactions).where(eq(transactions.killSwitchTriggered, true));
    const [pending]   = await db.select({ c: count() }).from(transactions).where(eq(transactions.status, "pending"));
    const [completed] = await db.select({ c: count() }).from(transactions).where(eq(transactions.status, "completed"));
    const [failed]    = await db.select({ c: count() }).from(transactions).where(eq(transactions.status, "failed"));

    return {
      total:     total?.c ?? 0,
      killed:    killed?.c ?? 0,
      pending:   pending?.c ?? 0,
      completed: completed?.c ?? 0,
      failed:    failed?.c ?? 0,
    };
  }),
});
