import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { hydroScenarios, hydroEvidence, hydroAuditLog, hydroStressParams, hydroCompanySlots } from "../../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ── Helpers ───────────────────────────────────────────────────────────────────
async function writeHydroAudit(params: {
  userId?: number;
  userName?: string | null;
  actionType: string;
  entityType?: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(hydroAuditLog).values({
    userId: params.userId,
    userName: params.userName ?? undefined,
    actionType: params.actionType,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValue: params.oldValue,
    newValue: params.newValue,
    reason: params.reason,
    createdAt: Date.now(),
  });
}

// ── Router ────────────────────────────────────────────────────────────────────
export const hydroRouter = router({
  // ── Scenarios ──────────────────────────────────────────────────────────────
  getScenarios: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(hydroScenarios).orderBy(asc(hydroScenarios.id));
  }),

  setActiveScenario: protectedProcedure
    .input(z.object({ scenarioId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Deactivate all
      await db.update(hydroScenarios).set({ isActive: 0, updatedAt: Date.now() });
      // Activate selected
      await db.update(hydroScenarios)
        .set({ isActive: 1, updatedAt: Date.now() })
        .where(eq(hydroScenarios.id, input.scenarioId));
      await writeHydroAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        actionType: "scenario_change",
        entityType: "hydro_scenario",
        entityId: String(input.scenarioId),
        reason: input.reason,
      });
      return { ok: true };
    }),

  // ── Evidence Register ───────────────────────────────────────────────────────
  getEvidence: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(hydroEvidence).orderBy(asc(hydroEvidence.sortOrder));
  }),

  updateEvidence: protectedProcedure
    .input(z.object({
      id: z.number(),
      currentInput: z.string().optional(),
      status: z.enum(["verified", "pending", "assumption", "outstanding"]).optional(),
      statusNote: z.string().optional(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [existing] = await db.select().from(hydroEvidence).where(eq(hydroEvidence.id, input.id));
      if (!existing) throw new Error("Evidence item not found");

      const updates: Partial<typeof existing> = { updatedAt: Date.now() };
      if (input.currentInput !== undefined) updates.currentInput = input.currentInput;
      if (input.status !== undefined) updates.status = input.status;
      if (input.statusNote !== undefined) updates.statusNote = input.statusNote;

      await db.update(hydroEvidence).set(updates).where(eq(hydroEvidence.id, input.id));
      await writeHydroAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        actionType: "assumption_edit",
        entityType: "hydro_evidence",
        entityId: String(input.id),
        oldValue: JSON.stringify({ currentInput: existing.currentInput ?? null, status: existing.status }),
        newValue: JSON.stringify({ currentInput: input.currentInput ?? null, status: input.status ?? null }),
        reason: input.reason,
      });
      return { ok: true };
    }),

  // ── Stress Testing ──────────────────────────────────────────────────────────
  runStressTest: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      caymanAmountKwd: z.number().min(0).max(5000),
      caymanDelayMonths: z.number().min(0).max(60),
      revenueGrowthDelta: z.number().min(-50).max(50),
      grossMarginDelta: z.number().min(-30).max(30),
      automationSavingsPct: z.number().min(0).max(100),
      financeRatePct: z.number().min(0).max(20),
      gracePeriodMonths: z.number().min(0).max(24),
      acqTimingDeltaMonths: z.number().min(-12).max(24),
      acqPriceDeltaPct: z.number().min(-50).max(100),
      customerConcentrationShock: z.boolean(),
      receivablesDelayDays: z.number().min(0).max(180),
      gccDisruption: z.boolean(),
      stressCase: z.enum(["base", "revenue_25", "margin_5pp", "automation_50", "cayman_delayed", "combined", "custom"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Save stress params
      await db.insert(hydroStressParams).values({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        caymanAmountKwd: String(input.caymanAmountKwd),
        caymanDelayMonths: input.caymanDelayMonths,
        revenueGrowthDelta: String(input.revenueGrowthDelta),
        grossMarginDelta: String(input.grossMarginDelta),
        automationSavingsPct: String(input.automationSavingsPct),
        financeRatePct: String(input.financeRatePct),
        gracePeriodMonths: input.gracePeriodMonths,
        acqTimingDeltaMonths: input.acqTimingDeltaMonths,
        acqPriceDeltaPct: String(input.acqPriceDeltaPct),
        customerConcentrationShock: input.customerConcentrationShock ? 1 : 0,
        receivablesDelayDays: input.receivablesDelayDays,
        gccDisruption: input.gccDisruption ? 1 : 0,
        stressCase: input.stressCase,
        createdAt: Date.now(),
      });

      // Compute stressed financials (simplified model)
      const baseRevenue = [300, 720, 1450, 2300, 3500];
      const baseEbitdaMargin = [-0.10, 0.133, 0.254, 0.354, 0.421];
      const baseDebt = [500, 900, 1050, 700, 250];
      const annualRepayment = 150; // KWD thousands per year

      const revenueMultiplier = 1 + input.revenueGrowthDelta / 100;
      const marginDelta = input.grossMarginDelta / 100;
      const automationMultiplier = input.automationSavingsPct / 100;
      const caymanBoost = input.caymanAmountKwd / 2300; // relative to management case
      const concentrationPenalty = input.customerConcentrationShock ? 0.15 : 0;
      const gccPenalty = input.gccDisruption ? 0.10 : 0;

      const stressedRevenue = baseRevenue.map(r =>
        r * revenueMultiplier * (1 - concentrationPenalty) * (1 - gccPenalty)
      );
      const stressedEbitda = stressedRevenue.map((r, i) =>
        r * (baseEbitdaMargin[i] + marginDelta) * (1 + automationMultiplier * 0.1 * caymanBoost)
      );
      const stressedDebt = baseDebt.map(d => d * (1 + input.acqPriceDeltaPct / 100));
      const stressedDscr = stressedEbitda.map((e, i) => {
        const debtService = stressedDebt[i] * (input.financeRatePct / 100) + annualRepayment;
        return debtService > 0 ? e / debtService : 0;
      });

      // Determine verdict
      const minDscr = Math.min(...stressedDscr.slice(1)); // skip Y1 (grace period)
      let verdict = "PROCEED IN STAGES";
      if (minDscr < 0.8) verdict = "PAUSE — INSUFFICIENT COVERAGE";
      else if (minDscr < 1.0) verdict = "CAUTION — BELOW COVENANT THRESHOLD";
      else if (minDscr < 1.25) verdict = "MONITOR — NEAR COVENANT FLOOR";
      else if (minDscr >= 2.0) verdict = "ACCELERATE WITH GATES";

      await writeHydroAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        actionType: "stress_test",
        entityType: "hydro_stress",
        entityId: input.sessionId,
        newValue: JSON.stringify({ stressCase: input.stressCase, verdict }),
      });

      return {
        stressedRevenue,
        stressedEbitda,
        stressedDebt,
        stressedDscr,
        verdict,
        minDscr: Math.round(minDscr * 100) / 100,
        covenantBreached: minDscr < 1.25,
        safetyBreached: minDscr < 1.0,
      };
    }),

  // ── Portfolio Architecture ──────────────────────────────────────────────────
  getCompanySlots: protectedProcedure.query(async () => {
    const db = await getDb();
      if (!db) throw new Error("Database unavailable");
    return db.select().from(hydroCompanySlots).orderBy(asc(hydroCompanySlots.slotNumber));
  }),

  updateCompanySlot: protectedProcedure
    .input(z.object({
      slotNumber: z.number().min(1).max(10),
      status: z.enum(["empty", "target_identified", "under_diligence", "approved", "acquired", "active", "exited"]).optional(),
      companyName: z.string().optional(),
      sector: z.string().optional(),
      acquisitionPriceKwd: z.number().optional(),
      revenueKwd: z.number().optional(),
      ebitdaKwd: z.number().optional(),
      cashConversionPct: z.number().optional(),
      receivablesDays: z.number().optional(),
      customerConcentrationPct: z.number().optional(),
      totalDebtKwd: z.number().optional(),
      automationPlan: z.string().optional(),
      automationSavingsForecastKwd: z.number().optional(),
      phase: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { slotNumber, ...updates } = input;
      const [existing] = await db.select().from(hydroCompanySlots).where(eq(hydroCompanySlots.slotNumber, slotNumber));
      if (!existing) throw new Error("Slot not found");

      const updateData: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [k, v] of Object.entries(updates) as [string, unknown][]) {
        if (v !== undefined) updateData[k] = v;
      }

      await db.update(hydroCompanySlots).set(updateData).where(eq(hydroCompanySlots.slotNumber, slotNumber));
      await writeHydroAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        actionType: "slot_update",
        entityType: "hydro_slot",
        entityId: String(slotNumber),
        newValue: JSON.stringify(updates),
      });
      return { ok: true };
    }),

  // ── Audit Log ───────────────────────────────────────────────────────────────
  getAuditLog: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      return db.select().from(hydroAuditLog).orderBy(desc(hydroAuditLog.createdAt)).limit(input.limit);
    }),

  // ── LLM Credit Committee Briefing ──────────────────────────────────────────
  generateCreditBriefing: protectedProcedure
    .input(z.object({
      scenarioKey: z.string(),
      includeStressResults: z.boolean().default(false),
      stressVerdict: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [scenario] = await db.select().from(hydroScenarios)
        .where(eq(hydroScenarios.scenarioKey, input.scenarioKey));
      const evidence = await db.select().from(hydroEvidence).orderBy(asc(hydroEvidence.sortOrder));

      const evidenceSummary = evidence.map((e: typeof evidence[0]) =>
        `- ${e.label}: ${e.currentInput ?? "Not provided"} [${e.status.toUpperCase()}]${e.statusNote ? ` — ${e.statusNote}` : ""}`
      ).join("\n");

      const prompt = `You are a senior credit analyst preparing a structured credit committee briefing for Warba Bank.

TRANSACTION: Hydro Commercial Co. W.L.L. — SME Acquisition Financing Facility
SCENARIO: ${scenario?.label ?? input.scenarioKey}
TWIN VERDICT: ${scenario?.twinVerdict ?? "N/A"}
${input.includeStressResults && input.stressVerdict ? `STRESS TEST VERDICT: ${input.stressVerdict}` : ""}

EVIDENCE REGISTER:
${evidenceSummary}

5-YEAR FINANCIAL PROJECTIONS (KWD thousands):
Year | Revenue | EBITDA | Senior Debt | DSCR
Y1   | ${scenario?.revenueY1} | ${scenario?.ebitdaY1} | ${scenario?.seniorDebtY1} | ${scenario?.dscrY1}
Y2   | ${scenario?.revenueY2} | ${scenario?.ebitdaY2} | ${scenario?.seniorDebtY2} | ${scenario?.dscrY2}
Y3   | ${scenario?.revenueY3} | ${scenario?.ebitdaY3} | ${scenario?.seniorDebtY3} | ${scenario?.dscrY3}
Y4   | ${scenario?.revenueY4} | ${scenario?.ebitdaY4} | ${scenario?.seniorDebtY4} | ${scenario?.dscrY4}
Y5   | ${scenario?.revenueY5} | ${scenario?.ebitdaY5} | ${scenario?.seniorDebtY5} | ${scenario?.dscrY5}

Write a professional credit committee briefing with these sections:
1. Executive Summary (3 sentences max)
2. Transaction Structure
3. Financial Analysis (5-year projections, DSCR analysis, key ratios)
4. Risk Assessment (top 5 risks with mitigants)
5. Covenant Framework (proposed covenants and rationale)
6. Conditions Precedent (per drawdown gate)
7. Recommendation

IMPORTANT DISCLAIMERS TO INCLUDE:
- All financial projections are management estimates and subject to independent verification
- Cayman distributions are not guaranteed, committed or currently receivable
- This briefing is for discussion purposes only and does not constitute a credit approval
- All figures in KWD thousands unless stated otherwise`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a senior credit analyst at a GCC Islamic bank. Write precise, professional credit committee briefings. Use KWD as the currency. Never fabricate figures not provided." },
          { role: "user", content: prompt },
        ],
      });

      const content = typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

      await writeHydroAudit({
        userId: ctx.user.id,
        userName: ctx.user.name,
        actionType: "report_generated",
        entityType: "credit_briefing",
        entityId: input.scenarioKey,
      });

      return { content };
    }),
});
