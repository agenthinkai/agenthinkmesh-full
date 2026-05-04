// server/routers/uaeRealestate.ts
//
// tRPC router for UAE Real Estate Council V1.3
// Delegates all council logic to uaeRealEstateEngine.ts

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { runARECouncil, type ARESignalRequest } from "../lib/uaeRealEstateEngine";
import { invokeLLM } from "../_core/llm";

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

// ── Extraction result type (returned to client) ───────────────────────────────
export interface PropertyExtractionResult {
  // Extracted fields (null = not found in text, never hallucinated)
  propertyType:         "ready" | "off_plan" | null;
  assetClass:           "apartment" | "villa" | "townhouse" | "penthouse" | "commercial" | null;
  emirate:              "dubai" | "abu_dhabi" | "sharjah" | "ras_al_khaimah" | "other" | null;
  community:            string | null;
  developer:            string | null;
  tower:                string | null;
  askingPriceAED:       number | null;
  areaSqft:             number | null;
  ppsfAsking:           number | null;
  ppsfComps:            number | null;
  annualRentAED:        number | null;
  serviceChargePerSqft: number | null;
  completionDate:       string | null;
  paymentPlan:          string | null;
  constructionProgress: number | null;
  escrowVerified:       boolean | null;
  notes:                string | null;
  // Meta
  missingCritical:      string[];   // fields that are critical but missing
  missingOptional:      string[];   // fields that are optional but missing
  offPlanDetected:      boolean;    // keyword-based off-plan detection
  confidencePenalty:    number;     // 0.0–0.4 confidence reduction for missing critical fields
}

// ── Off-plan keyword detection ────────────────────────────────────────────────
const OFF_PLAN_KEYWORDS = [
  "off-plan", "off plan", "offplan",
  "handover", "payment plan", "post-handover",
  "under construction", "construction", "completion date",
  "completion q", "launch price", "developer project",
  "booking fee", "oqood", "rera registration",
  "% on handover", "% during construction",
];

function detectOffPlan(text: string): boolean {
  const lower = text.toLowerCase();
  return OFF_PLAN_KEYWORDS.some(kw => lower.includes(kw));
}

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

  /**
   * Quick Paste extraction: parse free-text property description into
   * structured ARESignalRequest fields.
   *
   * Rules:
   * - NEVER hallucinate missing values — return null if not found
   * - Off-plan is auto-detected from text keywords
   * - Returns missingCritical[] and confidencePenalty for guardrail
   */
  extractPropertyDetails: publicProcedure
    .input(z.object({ text: z.string().min(10).max(5000) }))
    .mutation(async ({ input }) => {
      const { text } = input;

      // Keyword-based off-plan detection (deterministic, no LLM needed)
      const offPlanDetected = detectOffPlan(text);

      // ── LLM extraction ────────────────────────────────────────────────────
      const systemPrompt = `You are a UAE real estate data extraction assistant.
Extract structured property details from the user's text.

CRITICAL RULES:
1. NEVER invent or guess values. If a field is not clearly stated in the text, return null.
2. Do not infer prices from vague descriptions. Only extract explicit numbers.
3. For propertyType: return "off_plan" if text mentions off-plan, handover, payment plan, construction, or completion date. Otherwise return "ready" only if text clearly says "ready" or "secondary market". If unclear, return null.
4. For assetClass: map to one of: apartment, villa, townhouse, penthouse, commercial. Return null if unclear.
5. For emirate: map to one of: dubai, abu_dhabi, sharjah, ras_al_khaimah, other. Return null if not mentioned.
6. For prices: extract numeric values only. Remove commas, currency symbols. Return null if not stated.
7. For constructionProgress: extract percentage (0-100). Return null if not stated.
8. For escrowVerified: return true only if text explicitly confirms RERA escrow. Return false if text says no escrow. Return null if not mentioned.
9. For paymentPlan: extract the plan description as a short string (e.g. "40/60 post-handover"). Return null if not stated.
10. For completionDate: extract as string (e.g. "Q4 2026", "December 2027"). Return null if not stated.
11. For notes: extract any additional context, seller motivation, or unique features as a short summary. Return null if nothing notable.`;

      const userMessage = `Extract property details from this text. Return null for any field not clearly present in the text.

TEXT:
${text}`;

      let extracted: Record<string, unknown> = {};

      try {
        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "property_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  propertyType:         { type: ["string", "null"], enum: ["ready", "off_plan", null], description: "Property type: ready or off_plan. Null if unclear." },
                  assetClass:           { type: ["string", "null"], enum: ["apartment", "villa", "townhouse", "penthouse", "commercial", null], description: "Asset class. Null if unclear." },
                  emirate:              { type: ["string", "null"], enum: ["dubai", "abu_dhabi", "sharjah", "ras_al_khaimah", "other", null], description: "Emirate. Null if not mentioned." },
                  community:            { type: ["string", "null"], description: "Community or area name. Null if not stated." },
                  developer:            { type: ["string", "null"], description: "Developer name. Null if not stated." },
                  tower:                { type: ["string", "null"], description: "Tower or building name. Null if not stated." },
                  askingPriceAED:       { type: ["number", "null"], description: "Asking price in AED as a number. Null if not stated." },
                  areaSqft:             { type: ["number", "null"], description: "Area in square feet as a number. Null if not stated." },
                  ppsfAsking:           { type: ["number", "null"], description: "Price per square foot asking. Null if not stated." },
                  ppsfComps:            { type: ["number", "null"], description: "Comparable PPSF from market data. Null if not stated." },
                  annualRentAED:        { type: ["number", "null"], description: "Annual rent in AED. Null if not stated." },
                  serviceChargePerSqft: { type: ["number", "null"], description: "Service charge per sqft per year. Null if not stated." },
                  completionDate:       { type: ["string", "null"], description: "Expected completion date as string. Null if not stated." },
                  paymentPlan:          { type: ["string", "null"], description: "Payment plan description. Null if not stated." },
                  constructionProgress: { type: ["number", "null"], description: "Construction progress 0-100. Null if not stated." },
                  escrowVerified:       { type: ["boolean", "null"], description: "RERA escrow verified. Null if not mentioned." },
                  notes:                { type: ["string", "null"], description: "Additional context or notable features. Null if nothing notable." },
                },
                required: [
                  "propertyType", "assetClass", "emirate", "community", "developer",
                  "tower", "askingPriceAED", "areaSqft", "ppsfAsking", "ppsfComps",
                  "annualRentAED", "serviceChargePerSqft", "completionDate", "paymentPlan",
                  "constructionProgress", "escrowVerified", "notes"
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const content = llmResponse.choices?.[0]?.message?.content;
        if (content) {
          extracted = typeof content === "string" ? JSON.parse(content) : content;
        }
      } catch (err) {
        // LLM parse failure — return all nulls, let user fill in manually
        console.error("[extractPropertyDetails] LLM error:", err);
      }

      // ── Override propertyType with keyword detection if LLM missed it ─────
      if (offPlanDetected && !extracted.propertyType) {
        extracted.propertyType = "off_plan";
      }

      // ── Compute missing fields and confidence penalty ──────────────────────
      const CRITICAL_FIELDS = ["community", "developer", "askingPriceAED", "areaSqft"];
      const OPTIONAL_FIELDS = [
        "propertyType", "assetClass", "emirate", "tower",
        "ppsfComps", "annualRentAED", "serviceChargePerSqft",
        "completionDate", "paymentPlan", "constructionProgress", "escrowVerified",
      ];

      const missingCritical = CRITICAL_FIELDS.filter(f => extracted[f] == null);
      const missingOptional = OPTIONAL_FIELDS.filter(f => extracted[f] == null);

      // 0.1 penalty per missing critical field, max 0.4
      const confidencePenalty = Math.min(0.4, missingCritical.length * 0.1);

      const result: PropertyExtractionResult = {
        propertyType:         (extracted.propertyType as PropertyExtractionResult["propertyType"]) ?? null,
        assetClass:           (extracted.assetClass as PropertyExtractionResult["assetClass"]) ?? null,
        emirate:              (extracted.emirate as PropertyExtractionResult["emirate"]) ?? null,
        community:            (extracted.community as string | null) ?? null,
        developer:            (extracted.developer as string | null) ?? null,
        tower:                (extracted.tower as string | null) ?? null,
        askingPriceAED:       (extracted.askingPriceAED as number | null) ?? null,
        areaSqft:             (extracted.areaSqft as number | null) ?? null,
        ppsfAsking:           (extracted.ppsfAsking as number | null) ?? null,
        ppsfComps:            (extracted.ppsfComps as number | null) ?? null,
        annualRentAED:        (extracted.annualRentAED as number | null) ?? null,
        serviceChargePerSqft: (extracted.serviceChargePerSqft as number | null) ?? null,
        completionDate:       (extracted.completionDate as string | null) ?? null,
        paymentPlan:          (extracted.paymentPlan as string | null) ?? null,
        constructionProgress: (extracted.constructionProgress as number | null) ?? null,
        escrowVerified:       (extracted.escrowVerified as boolean | null) ?? null,
        notes:                (extracted.notes as string | null) ?? null,
        missingCritical,
        missingOptional,
        offPlanDetected,
        confidencePenalty,
      };

      return result;
    }),
});
