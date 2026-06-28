/**
 * server/scheduled/dailyLearningReport.ts — Phase 9
 *
 * Runs daily at 10:00 UTC (after the 09:00 dispatch cycle).
 * Aggregates all learning events from the past 24 hours and notifies the owner.
 *
 * Route: POST /api/scheduled/atlas-daily-learning
 * Auth:  Bearer SCHEDULER_SECRET
 */

import type { Request, Response } from "express";
import { getDb } from "../db";
import { atlasLearningEvents, atlasExecutiveMemory } from "../../drizzle/schema";
import { gte, desc, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export async function handleDailyLearningReport(req: Request, res: Response) {
  const secret = process.env.SCHEDULER_SECRET;
  const auth = req.headers.authorization ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "Database unavailable" });

  const runId = `learning-${Date.now()}`;
  const steps: string[] = [];
  const now = Date.now();
  const since = now - 24 * 60 * 60 * 1000;

  try {
    // Step 1: Aggregate yesterday's learning events
    const events = await db
      .select()
      .from(atlasLearningEvents)
      .where(gte(atlasLearningEvents.eventDate, since))
      .orderBy(desc(atlasLearningEvents.eventDate));

    steps.push(`Step 1: ${events.length} learning events from past 24h`);

    if (events.length === 0) {
      await notifyOwner({
        title: "Atlas Daily Learning Report — No Events",
        content: "No learning events recorded in the past 24 hours.",
      });
      return res.json({ runId, steps, status: "no_events" });
    }

    // Step 2: Compute effectiveness rates
    const subjectHigh = events.filter(e => e.subjectLineEffectiveness === "HIGH").length;
    const subjectMed = events.filter(e => e.subjectLineEffectiveness === "MEDIUM").length;
    const subjectLow = events.filter(e => e.subjectLineEffectiveness === "LOW").length;
    const hvConfirmed = events.filter(e => e.hiddenVariableEffectiveness === "CONFIRMED").length;
    const hvPartial = events.filter(e => e.hiddenVariableEffectiveness === "PARTIAL").length;
    const hvIncorrect = events.filter(e => e.hiddenVariableEffectiveness === "INCORRECT").length;
    const dfAccurate = events.filter(e => e.decisionFramingEffectiveness === "ACCURATE").length;
    const dfPartial = events.filter(e => e.decisionFramingEffectiveness === "PARTIAL").length;
    const dfMissed = events.filter(e => e.decisionFramingEffectiveness === "MISSED").length;
    const constStrong = events.filter(e => e.constitutionEffectiveness === "STRONG").length;
    const constWeak = events.filter(e => e.constitutionEffectiveness === "WEAK").length;

    steps.push(`Step 2: Subject HIGH=${subjectHigh} MED=${subjectMed} LOW=${subjectLow}`);
    steps.push(`Step 3: HV CONFIRMED=${hvConfirmed} PARTIAL=${hvPartial} INCORRECT=${hvIncorrect}`);
    steps.push(`Step 4: DF ACCURATE=${dfAccurate} PARTIAL=${dfPartial} MISSED=${dfMissed}`);
    steps.push(`Step 5: Constitution STRONG=${constStrong} WEAK=${constWeak}`);

    // Step 3: Collect top improvements
    const improvements = events.map(e => e.recommendedImprovements).filter(Boolean).slice(0, 5).join("\n• ");
    const whatWorked = events.map(e => e.whatWorked).filter(Boolean).slice(0, 3).join("\n• ");
    const whatFailed = events.map(e => e.whatFailed).filter(Boolean).slice(0, 3).join("\n• ");

    steps.push(`Step 6: Collected ${events.length} improvement recommendations`);

    // Step 4: Get relationship score stats
    const [relStats] = await db
      .select({
        avgScore: sql<number>`AVG(relationship_score)`,
        maxScore: sql<number>`MAX(relationship_score)`,
        totalExecutives: sql<number>`COUNT(*)`,
      })
      .from(atlasExecutiveMemory);

    steps.push(`Step 7: Avg rel score=${Math.round(Number(relStats?.avgScore ?? 0))}, Total execs=${Number(relStats?.totalExecutives ?? 0)}`);

    // Step 5: Notify owner
    const pct = (n: number) => `${Math.round((n / events.length) * 100)}%`;
    const reportContent = `ATLAS DAILY LEARNING REPORT — ${new Date(now).toISOString().split("T")[0]}

LEARNING EVENTS: ${events.length} interactions analysed

SUBJECT LINE EFFECTIVENESS
• High: ${subjectHigh} (${pct(subjectHigh)}) | Medium: ${subjectMed} (${pct(subjectMed)}) | Low: ${subjectLow} (${pct(subjectLow)})

HIDDEN VARIABLE ACCURACY
• Confirmed: ${hvConfirmed} (${pct(hvConfirmed)}) | Partial: ${hvPartial} (${pct(hvPartial)}) | Incorrect: ${hvIncorrect} (${pct(hvIncorrect)})

DECISION FRAMING ACCURACY
• Accurate: ${dfAccurate} (${pct(dfAccurate)}) | Partial: ${dfPartial} (${pct(dfPartial)}) | Missed: ${dfMissed} (${pct(dfMissed)})

CONSTITUTION EFFECTIVENESS
• Strong: ${constStrong} | Weak: ${constWeak}

WHAT WORKED:
• ${whatWorked || "No data"}

WHAT FAILED:
• ${whatFailed || "No data"}

TOP RECOMMENDED IMPROVEMENTS:
• ${improvements || "No recommendations"}

RELATIONSHIP INTELLIGENCE
• Total executives in memory: ${Number(relStats?.totalExecutives ?? 0)}
• Average relationship score: ${Math.round(Number(relStats?.avgScore ?? 0))}/100
• Highest relationship score: ${Math.round(Number(relStats?.maxScore ?? 0))}/100`.trim();

    await notifyOwner({ title: `Atlas Daily Learning Report — ${events.length} events`, content: reportContent });
    steps.push(`Step 8: Owner notified`);

    return res.json({
      runId, steps, status: "complete",
      summary: {
        totalEvents: events.length,
        subjectLineHighRate: Math.round((subjectHigh / events.length) * 100),
        hiddenVariableConfirmRate: Math.round((hvConfirmed / events.length) * 100),
        decisionFramingAccuracyRate: Math.round((dfAccurate / events.length) * 100),
        constitutionStrengthRate: Math.round((constStrong / events.length) * 100),
      },
    });
  } catch (err) {
    steps.push(`ERROR: ${String(err)}`);
    return res.status(500).json({ runId, steps, error: String(err) });
  }
}
