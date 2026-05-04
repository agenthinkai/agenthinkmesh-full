// server/routers/uaeRealestate.ts
//
// tRPC router for UAE Real Estate Council V1.3
// Delegates all council logic to uaeRealEstateEngine.ts

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { runARECouncil, type ARESignalRequest } from "../lib/uaeRealEstateEngine";

// ── Input schema ──────────────────────────────────────────────────────────────
const ARESignalInputSchema = z.object({
  propertyType:    z.enum(["ready", "off_plan"]),
  assetClass:      z.enum(["apartment", "villa", "townhouse", "penthouse", "commercial"]),
  emirate:         z.enum(["dubai", "abu_dhabi", "sharjah", "ras_al_khaimah", "other"]),
  community:       z.string().min(1).max(200),
  developer:       z.string().min(1).max(200),
  tower:           z.string().max(200).optional(),

  askingPriceAED:  z.number().positive(),
  areaSqft:        z.number().positive(),
  ppsfAsking:      z.number().positive().optional(),
  ppsfComps:       z.number().positive().optional(),

  annualRentAED:   z.number().positive().optional(),
  serviceChargePerSqft: z.number().positive().optional(),

  completionDate:  z.string().max(50).optional(),
  paymentPlan:     z.string().max(200).optional(),
  constructionProgress: z.number().min(0).max(100).optional(),
  escrowVerified:  z.boolean().optional(),

  notes:           z.string().max(2000).optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────
export const uaeRealestateRouter = router({
  /**
   * Run the UAE Real Estate Council V1.3.
   * Returns a full ARECouncilResult with decision, agent breakdown,
   * entry range, investment thesis, and (if off-plan) risk summary.
   */
  run: protectedProcedure
    .input(ARESignalInputSchema)
    .mutation(async ({ input }) => {
      try {
        const req: ARESignalRequest = input;
        const result = await runARECouncil(req);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `UAE Real Estate Council failed: ${msg}`,
        });
      }
    }),
});
