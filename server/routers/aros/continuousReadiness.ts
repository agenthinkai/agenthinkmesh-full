/**
 * continuousReadiness.ts — Continuous Readiness Engine (Phase 8)
 *
 * Every monitoring event immediately triggers a 6-step pipeline:
 *   1. Decision Twin update (LLM regeneration)
 *   2. Hidden Variable update
 *   3. Strategic Significance Score recalculation
 *   4. Executive Surprise Index recalculation
 *   5. Evidence Confidence recalculation
 *   6. Queue classification (IMMEDIATE / WATCH / MONITOR)
 *
 * The IMMEDIATE queue is therefore always live and current.
 * The 09:00 UTC Daily Cycle becomes a DISPATCH CYCLE ONLY.
 *
 * Called from:
 *   - monitoring.ingestEvent (after every manual event ingestion)
 *   - monitoring.autoScanBatch (after every auto-scan event)
 *   - atlasDailyLoop (no longer needed for scoring — dispatch only)
 */

import { getDb } from "../../db";
import {
  arosCompanies,
  arosDecisionTwinsV2,
  arosHiddenVariables,
  arosOutcomeLedgerV2,
  arosOutreachQueue,
  arosTokenLedger,
  atlasBriefDrafts,
} from "../../../drizzle/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { invokeLLM } from "../../_core/llm";
import { scoreAndPersistCompany, isBriefEligible, loadSignificanceConfig } from "./strategicSignificanceEngine";
import { notifyOwner } from "../../_core/notification";
import { randomUUID } from "crypto";

const HV_TYPES = [
  "REGULATORY_DELAY",
  "AI_GOVERNANCE_FAILURE",
  "CAPITAL_ALLOCATION_ERROR",
  "DATA_SOVEREIGNTY_CONSTRAINT",
  "COMPETITIVE_RESPONSE",
  "INFRASTRUCTURE_BOTTLENECK",
  "TALENT_SHORTAGE",
  "EXECUTION_RISK",
  "MARKET_TIMING",
  "OTHER",
] as const;

export interface ContinuousReadinessResult {
  companyId: number;
  companyName: string;
  sss: number;
  esi: number;
  decisionLevel: string;
  queue: "IMMEDIATE" | "WATCH" | "MONITOR";
  qualityGatePassed: boolean;
  briefEligible: boolean;
  blockReason?: string;
  dtUpdated: boolean;
  hvUpdated: boolean;
  sssUpdated: boolean;
  durationMs: number;
}

/**
 * Generate a new Decision Twin V2 record for a company.
 * Returns the structured DT payload.
 */
async function regenerateDecisionTwin(company: {
  id: number;
  companyName: string;
  sector: string | null;
  country: string | null;
  ceoName: string | null;
  keyDecisionDomain: string | null;
  activeStrategicInitiative: string | null;
  aiTransformationSignal: string | null;
  opportunityScore: number | null;
}) {
  const prompt = `You are the ATLAS Continuous Readiness Engine. A new monitoring event has been detected for this company. Regenerate the Decision Twin V2 with updated intelligence.

Company: ${company.companyName}
Sector: ${company.sector ?? "Unknown"}
Country: ${company.country ?? "Unknown"}
CEO: ${company.ceoName ?? "Unknown"}
Key Decision Domain: ${company.keyDecisionDomain ?? "Unknown"}
Active Strategic Initiative: ${company.activeStrategicInitiative ?? "Unknown"}
AI Transformation Signal: ${company.aiTransformationSignal ?? "Unknown"}
Opportunity Score: ${company.opportunityScore ?? 0}/100

Produce a JSON object with exactly these fields:
{
  "primaryObjective": "string (max 200 chars)",
  "secondaryObjective": "string (max 200 chars)",
  "strategicDecision": "string (max 300 chars) — the specific decision they are facing RIGHT NOW",
  "hiddenVariable": "string (max 200 chars) — the single variable most likely to determine success or failure",
  "hiddenVariableType": "one of: REGULATORY_DELAY | AI_GOVERNANCE_FAILURE | CAPITAL_ALLOCATION_ERROR | DATA_SOVEREIGNTY_CONSTRAINT | COMPETITIVE_RESPONSE | INFRASTRUCTURE_BOTTLENECK | TALENT_SHORTAGE | EXECUTION_RISK | MARKET_TIMING | OTHER",
  "hiddenVariableConfidence": number between 0.0 and 1.0,
  "evidenceConfidence": number between 0.0 and 1.0 — how strong is the evidence base for this assessment,
  "monitoringSignals": ["signal1", "signal2", "signal3"],
  "estimatedDecisionTimeline": "string like '6-12 months' or 'Q3 2025'",
  "estimatedAcvUsd": number (integer USD),
  "urgencyScore": number 0-100,
  "recommendedEngagementPath": "string (max 300 chars)",
  "assumptions": ["assumption1", "assumption2"],
  "calibrationBaseline": {
    "response_rate": 0.10,
    "meeting_rate": 0.05,
    "proposal_rate": 0.025,
    "customer_rate": 0.01
  }
}

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a structured JSON generator. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "decision_twin_v2_continuous",
        strict: true,
        schema: {
          type: "object",
          properties: {
            primaryObjective: { type: "string" },
            secondaryObjective: { type: "string" },
            strategicDecision: { type: "string" },
            hiddenVariable: { type: "string" },
            hiddenVariableType: { type: "string" },
            hiddenVariableConfidence: { type: "number" },
            evidenceConfidence: { type: "number" },
            monitoringSignals: { type: "array", items: { type: "string" } },
            estimatedDecisionTimeline: { type: "string" },
            estimatedAcvUsd: { type: "number" },
            urgencyScore: { type: "number" },
            recommendedEngagementPath: { type: "string" },
            assumptions: { type: "array", items: { type: "string" } },
            calibrationBaseline: {
              type: "object",
              properties: {
                response_rate: { type: "number" },
                meeting_rate: { type: "number" },
                proposal_rate: { type: "number" },
                customer_rate: { type: "number" },
              },
              required: ["response_rate", "meeting_rate", "proposal_rate", "customer_rate"],
              additionalProperties: false,
            },
          },
          required: [
            "primaryObjective", "secondaryObjective", "strategicDecision",
            "hiddenVariable", "hiddenVariableType", "hiddenVariableConfidence",
            "evidenceConfidence", "monitoringSignals", "estimatedDecisionTimeline",
            "estimatedAcvUsd", "urgencyScore", "recommendedEngagementPath",
            "assumptions", "calibrationBaseline",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("LLM returned empty response for DT regeneration");
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

/**
 * Core Continuous Readiness pipeline.
 * Call this after every monitoring event for a company.
 * Non-blocking: errors are caught and logged, never thrown to the caller.
 */
export async function runContinuousReadiness(
  companyId: number,
  triggeredBy: string | number = "system"
): Promise<ContinuousReadinessResult | null> {
  const startMs = Date.now();

  try {
    const db = await getDb();
    if (!db) return null;

    // Load company
    const [company] = await db
      .select()
      .from(arosCompanies)
      .where(eq(arosCompanies.id, companyId))
      .limit(1);
    if (!company) return null;

    let dtUpdated = false;
    let hvUpdated = false;
    let dtData: Awaited<ReturnType<typeof regenerateDecisionTwin>> | null = null;

    // ── Step 1 & 2: Regenerate Decision Twin + Hidden Variable ────────────────
    try {
      dtData = await regenerateDecisionTwin(company);
      const now = Date.now();

      // Insert new Decision Twin V2
      const [dtResult] = await db.insert(arosDecisionTwinsV2).values({
        companyId: company.id,
        primaryObjective: dtData.primaryObjective.slice(0, 300),
        secondaryObjective: dtData.secondaryObjective?.slice(0, 300),
        strategicDecision: dtData.strategicDecision.slice(0, 400),
        hiddenVariable: dtData.hiddenVariable.slice(0, 300),
        hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
        monitoringSignals: JSON.stringify(dtData.monitoringSignals ?? []),
        estimatedDecisionTimeline: dtData.estimatedDecisionTimeline?.slice(0, 100),
        estimatedAcvUsd: Math.round(dtData.estimatedAcvUsd ?? 0),
        urgencyScore: Math.max(0, Math.min(100, Math.round(dtData.urgencyScore ?? 0))),
        recommendedEngagementPath: dtData.recommendedEngagementPath?.slice(0, 500),
        version: 2,
        generatedBy: "atlas_continuous_readiness",
        createdAt: now,
        updatedAt: now,
      }).$returningId();

      dtUpdated = true;

      // Insert new Hidden Variable record
      const hvType = HV_TYPES.includes(dtData.hiddenVariableType as typeof HV_TYPES[number])
        ? dtData.hiddenVariableType as typeof HV_TYPES[number]
        : "OTHER";

      await db.insert(arosHiddenVariables).values({
        companyId: company.id,
        decisionTwinV2Id: dtResult.id,
        hiddenVariable: dtData.hiddenVariable.slice(0, 300),
        hiddenVariableType: hvType,
        confidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
        monitoringSignal: (dtData.monitoringSignals ?? []).join("; ").slice(0, 400),
        reviewDate: now + 90 * 24 * 60 * 60 * 1000,
        createdAt: now,
        updatedAt: now,
      });

      hvUpdated = true;

      // Update Outcome Ledger V2 if exists
      const [ol] = await db
        .select()
        .from(arosOutcomeLedgerV2)
        .where(eq(arosOutcomeLedgerV2.companyId, company.id))
        .orderBy(desc(arosOutcomeLedgerV2.createdAt))
        .limit(1);

      if (ol) {
        await db.update(arosOutcomeLedgerV2)
          .set({
            hiddenVariable: dtData.hiddenVariable.slice(0, 300),
            hiddenVariableConfidence: String(Math.max(0, Math.min(1, dtData.hiddenVariableConfidence))),
            outcomeNotes: `[ContinuousReadiness ${new Date(now).toISOString().slice(0, 10)}] DT regenerated: ${dtData.strategicDecision.slice(0, 100)}`,
            updatedAt: now,
          })
          .where(eq(arosOutcomeLedgerV2.id, ol.id));
      }

      // Log tokens
      await db.insert(arosTokenLedger).values({
        workflow: "company_research",
        model: "gpt-4o-mini",
        inputTokens: 400,
        outputTokens: 300,
        totalTokens: 700,
        costUsd: (400 * 0.00000015 + 300 * 0.0000006).toFixed(8),
        companyId: company.id,
        triggeredBy: typeof triggeredBy === "number" ? triggeredBy : (typeof triggeredBy === "string" ? parseInt(triggeredBy, 10) || undefined : undefined),
      });

    } catch (dtErr) {
      console.error(`[ContinuousReadiness] DT regeneration failed for company ${companyId}:`, dtErr);
      // Continue to SSS scoring with existing data
    }

    // ── Steps 3, 4, 5: Recalculate SSS + ESI + Evidence Confidence ───────────
    const strategicDecision = dtData?.strategicDecision ?? company.keyDecisionDomain ?? "Strategic transformation";
    const hiddenVariable = dtData?.hiddenVariable ?? "Unknown";
    const evidenceConfidence = dtData?.evidenceConfidence != null
      ? Math.round(dtData.evidenceConfidence * 100)
      : 70; // default if LLM didn't return it

    const sssResult = await scoreAndPersistCompany(companyId, {
      companyName: company.companyName,
      sector: company.sector ?? "Unknown",
      country: company.country ?? "Unknown",
      detectedDecision: strategicDecision,
      hiddenVariable,
      decisionTwinSummary: dtData?.primaryObjective ?? "Strategic transformation in progress",
      revenueUsdBn: company.revenueUsdBn != null ? parseFloat(String(company.revenueUsdBn)) : undefined,
      employees: company.employees ?? undefined,
    });

    // ── Step 6: Queue classification ─────────────────────────────────────────
    const cfg = await loadSignificanceConfig();
    const eligibility = isBriefEligible(
      sssResult,
      cfg?.briefGenerationThreshold ?? 90,
      85,
      80,
      evidenceConfidence
    );

    // Update the atlasQueue field on any existing PENDING queue entries for this company
    // so the Tomorrow's Dispatch page always reflects the current classification
    const existingPending = await db
      .select({ id: arosOutreachQueue.id })
      .from(arosOutreachQueue)
      .where(
        and(
          eq(arosOutreachQueue.companyId, companyId),
          isNull(arosOutreachQueue.sentAt)
        )
      )
      .limit(5);

    for (const pending of existingPending) {
      await db.update(arosOutreachQueue)
        .set({
          atlasQueue: eligibility.queue,
          sss: sssResult.sss,
          esi: sssResult.esi,
          decisionLevel: sssResult.decisionLevel,
          qualityGatePassed: eligibility.eligible ? 1 : 0,
          updatedAt: Date.now(),
        })
        .where(eq(arosOutreachQueue.id, pending.id));
    }

    // ── Auto-promote: if Triple Gate passes and an APPROVED draft exists, promote it ──
    if (eligibility.eligible && eligibility.queue === "IMMEDIATE") {
      try {
        const [approvedDraft] = await db
          .select()
          .from(atlasBriefDrafts)
          .where(
            and(
              eq(atlasBriefDrafts.companyId, companyId),
              eq(atlasBriefDrafts.editorStatus, "APPROVED")
            )
          )
          .orderBy(desc(atlasBriefDrafts.version))
          .limit(1);

        if (approvedDraft) {
          const now = Date.now();
          const trackingToken = randomUUID();
          await db.insert(arosOutreachQueue).values({
            companyId,
            emailSubject: approvedDraft.briefContent?.split("\n")[0]?.replace("SUBJECT: ", "") ?? `Intelligence Brief — ${company.companyName}`,
            emailBody: approvedDraft.briefContent ?? "",
            executiveBrief: approvedDraft.briefContent ?? "",
            targetName: approvedDraft.executiveName ?? company.ceoName ?? "CEO",
            targetEmail: approvedDraft.executiveEmail ?? company.ceoEmail ?? "",
            targetTitle: approvedDraft.executiveTitle ?? "Chief Executive Officer",
            estimatedDealSizeUsd: 50000,
            priority: "IMMEDIATE",
            approvalStatus: "APPROVED",
            approvedAt: now,
            trackingToken,
            sss: sssResult.sss,
            esi: sssResult.esi,
            qualityGatePassed: 1,
            atlasQueue: "IMMEDIATE",
            constitutionVersion: approvedDraft.constitutionVersion ?? "1.0",
            generationTimestamp: now,
            createdAt: now,
            updatedAt: now,
          });
          await db
            .update(atlasBriefDrafts)
            .set({ editorStatus: "SCHEDULED", promotedAt: now, updatedAt: now })
            .where(eq(atlasBriefDrafts.id, approvedDraft.id));
          console.log(`[ContinuousReadiness] Auto-promoted approved draft for ${company.companyName} to SCHEDULED`);
        }
      } catch (promoteErr) {
        console.error(`[ContinuousReadiness] Auto-promote failed for ${company.companyName}:`, promoteErr);
      }
    }

    // Notify owner on new LEVEL_4 detection
    if (sssResult.decisionLevel === "LEVEL_4" && eligibility.eligible) {
      notifyOwner({
        title: `IMMEDIATE: ${company.companyName} — SSS ${sssResult.sss} | ESI ${sssResult.esi}`,
        content: `Continuous Readiness detected a board-level decision.\n\nCompany: ${company.companyName}\nDecision: ${strategicDecision}\nHidden Variable: ${hiddenVariable}\nSSS: ${sssResult.sss}/100 | ESI: ${sssResult.esi}/100 | Evidence Confidence: ${evidenceConfidence}/100\nQueue: IMMEDIATE\n\nThis company is ready for Executive Intelligence Brief generation.`,
      }).catch(() => {/* non-blocking */});
    }

    return {
      companyId,
      companyName: company.companyName,
      sss: sssResult.sss,
      esi: sssResult.esi,
      decisionLevel: sssResult.decisionLevel,
      queue: eligibility.queue,
      qualityGatePassed: eligibility.eligible,
      briefEligible: eligibility.eligible,
      blockReason: eligibility.reason,
      dtUpdated,
      hvUpdated,
      sssUpdated: true,
      durationMs: Date.now() - startMs,
    };

  } catch (err) {
    console.error(`[ContinuousReadiness] Pipeline failed for company ${companyId}:`, err);
    return null;
  }
}
