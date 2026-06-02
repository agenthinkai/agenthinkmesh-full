/**
 * runScreeningPipeline.ts
 *
 * Pure service function that executes the full 4-layer Deal Screener pipeline:
 *   Layer 0   — Deduplication (SHA-256 hash lookup)
 *   Layer 1   — Fast triage (Haiku 3.5, ~3–5s, $0.002)
 *   Layer 2   — Full Council (Sonnet 4.5, 10 agents, ~30–50s)
 *   Layer 2.5 — Reality Alignment Engine (data integrity, claim grounding, conflict detection)
 *   Layer 3   — Conditional IC Report (Sonnet 4.5, APPROVED/APPROVED_WITH_CONDITIONS only)
 *
 * This function is the single source of truth for the screening logic.
 * It is consumed by:
 *   - server/routers/dealScreener.ts  (tRPC, authenticated UI flow)
 *   - server/dealScreenRoute.ts       (REST, internal/enterprise API)
 *
 * DO NOT duplicate this logic elsewhere.
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { dealScreenings, outcomeSessions, outcomeAttributions } from "../drizzle/schema";
import { runCouncil } from "./councilEngine";
import { runAdversarialCouncil } from "./dealScreenerAdversarial";
import { generateSingleDealICReport } from "./icReportEngine";
import { detectTier0Signal } from "./tier0Signals";
import { runTriage } from "./triageEngine";
import { checkDuplicate } from "./dealDedup";
import { runRealityAlignment, type RealityAlignmentResult } from "./realityAlignmentEngine";
import { extractDealParams } from "./lib/monteCarloParams";
import { runMonteCarloSimulation } from "./lib/monteCarlo";

export type CouncilMode = "gcc" | "global_vc" | "india_pe" | "infrastructure" | "gcc_equities";
export type SourceType = "manual" | "signal";

export interface ScreeningInput {
  dealText: string;
  dealName?: string;
  councilMode?: CouncilMode;
  includeReport?: boolean;
  /** When true, generate IC report for ALL verdicts (including REJECTED/VETOED). Used by batch Data Room mode. */
  forceReport?: boolean;
  /** Internal user ID for dedup + rate-limit scoping. Pass null for anonymous API calls. */
  userId: number | null;
  /** Source label written to deal_screenings.sourceType */
  sourceType?: "manual" | "signal";
  /** When true, agents balance upside vs risk and answer "what would make this a winning investment?" */
  investorMode?: boolean;
}

export interface TriageResult {
  decision: "PROCEED" | "OBVIOUS_REJECT" | "INSUFFICIENT_INPUT" | "OUT_OF_SCOPE";
  confidence: number;
  reason: string;
}

export interface ScreeningResult {
  dealId: string;
  dealName: string;
  duplicate: boolean;
  triage: TriageResult | null;
  council: object | null;
  ic_report: object | null;
  universitySignal: object | null;
  /** Layer 2.5 output — always present when council runs */
  realityAlignment: RealityAlignmentResult | null;
  /** Debug log for the Reality Alignment Engine */
  debugLog: RealityAlignmentResult["debugLog"] | null;
  /** Adversarial layer — Decision Integrity section (Deal Screener only) */
  decisionIntegrity: object | null;
}

/**
 * Run the full 4-layer screening pipeline.
 * Persists results to deal_screenings when userId is provided.
 * When userId is null (anonymous API call), skips dedup and DB write.
 */
export async function runScreeningPipeline(input: ScreeningInput): Promise<ScreeningResult> {
  const {
    dealText,
    dealName = "Untitled Deal",
    councilMode = "global_vc",
    includeReport = true,
    forceReport = false,
    userId,
    sourceType = "manual",
    investorMode = false,
  } = input;

  const dealId = randomUUID();
  const db = userId !== null ? await getDb() : null;

  // ── Layer 0: Deduplication ──────────────────────────────────────────────────
  // Only run dedup when we have a userId (anonymous calls always proceed)
  if (userId !== null && db) {
    const dedupResult = await checkDuplicate(userId, dealText);
    if (dedupResult.isDuplicate && dedupResult.previousDealId) {
      const prevRows = await db
        .select()
        .from(dealScreenings)
        .where(eq(dealScreenings.dealId, dedupResult.previousDealId))
        .limit(1);
      if (prevRows.length > 0) {
        const prev = prevRows[0];
        return {
          dealId: prev.dealId,
          dealName: prev.dealName,
          duplicate: true,
          triage: prev.triageResult ? JSON.parse(prev.triageResult as string) : null,
          council: {
            verdict: prev.verdict,
            yesCount: prev.yesCount,
            noCount: prev.noCount,
            confidenceScore: parseFloat(prev.confidenceScore),
            conditionsToProceed: JSON.parse(prev.conditionsToProceed as string ?? "[]"),
            blockingIssues: JSON.parse(prev.blockingIssues as string ?? "[]"),
            votes: JSON.parse(prev.votes as string ?? "[]"),
          },
          ic_report: null,
          universitySignal: null,
          realityAlignment: null,
          debugLog: null,
          decisionIntegrity: null,
        };
      }
    }
  }

  // ── Layer 1: Fast Triage ────────────────────────────────────────────────────
  const triageResult = await runTriage(dealText);

  if (triageResult.decision !== "PROCEED") {
    // Persist triage-rejected record if we have a userId
    if (userId !== null && db) {
      const triageDealId = randomUUID();
      try {
        await db.insert(dealScreenings).values({
          userId,
          dealId: triageDealId,
          dealName,
          // dealText intentionally omitted — enterprise data security policy
          pdfFileKey: null,
          pdfFileUrl: null,
          verdict: "REJECTED",
          yesCount: 0,
          noCount: 0,
          hardYesCount: 0,
          softYesCount: 0,
          softNoCount: 0,
          hardNoCount: 0,
          confidenceScore: "0.000",
          gccVetoTriggered: false,
          tiebreakerTriggered: false,
          tiebreakerSwingAgent: null,
          conditionsToProceed: "[]",
          blockingIssues: JSON.stringify([triageResult.reason]),
          votes: "[]",
          sourceType,
          councilMode,
          triageResult: JSON.stringify(triageResult),
          triageSkipped: false,
        });
      } catch (e) {
        console.error("[runScreeningPipeline][Triage] Failed to persist triage record:", e);
      }
    }
    return {
      dealId,
      dealName,
      duplicate: false,
      triage: triageResult,
      council: null,
      ic_report: null,
      universitySignal: null,
      realityAlignment: null,
      debugLog: null,
      decisionIntegrity: null,
    };
  }

  // ── Layer 2: Full Council + Monte Carlo (parallel) ──────────────────────────
  const monteCarloPromise = extractDealParams(dealText)
    .then((params) => runMonteCarloSimulation(params))
    .catch((err) => { console.error("[runScreeningPipeline][MonteCarlo] Failed:", err); return null; });

  const result = await runAdversarialCouncil(dealText, {
    userId: userId ?? undefined,
    councilMode,
    investorMode,
  });
  const decisionIntegrity = result.decisionIntegrity;

  // ── Layer 2.5: Reality Alignment Engine ────────────────────────────────────
  const realityAlignment = runRealityAlignment(dealText, result);
  console.log("[RealityAlignment] Debug log:", JSON.stringify(realityAlignment.debugLog, null, 2));

  // Override verdict to INSUFFICIENT_DATA if reality alignment gates it
  // (only when the council itself didn't already gate it)
  if (
    realityAlignment.shouldGate &&
    result.verdict !== "VETOED" &&
    result.verdict !== "INSUFFICIENT_DATA"
  ) {
    (result as any).verdict = "INSUFFICIENT_DATA";
    console.warn(
      `[RealityAlignment] Verdict overridden to INSUFFICIENT_DATA. Reason: ${realityAlignment.gateReason}`
    );
  }

  // Await Monte Carlo result (started in parallel with council)
  const monteCarloResult = await monteCarloPromise;

  // Persist council result if we have a userId
  if (userId !== null && db) {
    try {
      await db.insert(dealScreenings).values({
        userId,
        dealId,
        dealName,
        // dealText intentionally omitted — enterprise data security policy
        pdfFileKey: null,
        pdfFileUrl: null,
        verdict: result.verdict as "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED" | "INSUFFICIENT_DATA",
        yesCount: result.yesCount,
        noCount: result.noCount,
        hardYesCount: result.hardYesCount,
        softYesCount: result.softYesCount,
        softNoCount: result.softNoCount,
        hardNoCount: result.hardNoCount,
        confidenceScore: result.confidenceScore.toString(),
        gccVetoTriggered: result.gccVetoTriggered,
        tiebreakerTriggered: result.tiebreakerTriggered,
        tiebreakerSwingAgent: result.tiebreakerSwingAgent ?? null,
        conditionsToProceed: JSON.stringify(result.conditionsToProceed),
          blockingIssues: JSON.stringify(result.blockingIssues),
          votes: JSON.stringify(result.votes),
          sourceType,
          councilMode,
          triageResult: JSON.stringify(triageResult),
          triageSkipped: false,
          ...(monteCarloResult ? { monteCarloAnalysis: JSON.stringify(monteCarloResult) } : {}),
      });
    } catch (e) {
      console.error("[runScreeningPipeline][Council] Failed to persist council record:", e);
    }
  }

  // ── Layer 3: Conditional IC Report ─────────────────────────────────────────
  let icReport = null;
  const shouldGenerateReport =
    includeReport &&
    (forceReport ||
      councilMode === "infrastructure" || // Infrastructure mode always generates IC report
      result.verdict === "APPROVED" ||
      result.verdict === "APPROVED_WITH_CONDITIONS");
  if (shouldGenerateReport) {
    try {
      icReport = await generateSingleDealICReport(dealName, dealText, result, councilMode);
    } catch (err) {
      console.error("[runScreeningPipeline][ICReport] Failed to generate IC report:", err);
    }
  }

  // Tier 0 university signal (non-fatal, additive)
  let universitySignal = null;
  try {
    universitySignal = detectTier0Signal(dealText, dealName);
  } catch (err) {
    console.error("[runScreeningPipeline][Tier0] Signal detection failed:", err);
  }

  // ── Outcome Ledger: auto-create outcome session (non-fatal) ──────────────────
  try {
    const outcomeDb = await getDb();
    if (outcomeDb) {
      await outcomeDb.insert(outcomeSessions).values({
        dealId,
        councilRunId: (result as any).sessionId ?? null,
        councilMode,
        originalVerdict: result.verdict,
        consensusScore: result.confidenceScore != null ? String(result.confidenceScore) : null,
        confidenceLevel: result.confidenceScore != null ? String(result.confidenceScore) : null,
        decisionDate: Date.now(),
        outcomeStatus: "UNKNOWN",
      });
      console.log(`[OutcomeLedger] Session created for deal ${dealId} — verdict: ${result.verdict}`);

      // ── Phase 2: Extract attribution candidates from persona rationales ──────
      try {
        const sessionRows = await outcomeDb
          .select({ id: outcomeSessions.id })
          .from(outcomeSessions)
          .where(eq(outcomeSessions.dealId, dealId))
          .limit(1);
        const sessionId = sessionRows[0]?.id;
        if (sessionId && Array.isArray((result as any).votes)) {
          const classifyPrediction = (text: string): "FINANCIAL" | "TECHNICAL" | "CONSTRUCTION" | "REGULATORY" | "COMMERCIAL" | "ESG" => {
            const t = text.toLowerCase();
            if (/dscr|irr|debt|equity|capex|opex|revenue|cash flow|financial|funding|return|yield|margin|cost/.test(t)) return "FINANCIAL";
            if (/epc|construction|build|install|commissioning|delay|contractor|turbine|foundation|offshore|onshore/.test(t)) return "CONSTRUCTION";
            if (/grid|permit|planning|regulatory|approval|licen|policy|government|compliance|environmental/.test(t)) return "REGULATORY";
            if (/technology|tech|software|hardware|platform|system|infrastructure|capacity|performance/.test(t)) return "TECHNICAL";
            if (/cfd|offtake|ppa|contract|merchant|price|market|commercial|customer/.test(t)) return "COMMERCIAL";
            if (/esg|environmental|social|governance|carbon|emission|sustainability|climate/.test(t)) return "ESG";
            return "FINANCIAL";
          };

          const attributionRows: {
            outcomeSessionId: number;
            personaId: string;
            predictionType: "FINANCIAL" | "TECHNICAL" | "CONSTRUCTION" | "REGULATORY" | "COMMERCIAL" | "ESG";
            predictionText: string;
            materialized: null;
            confidenceWeight: string | null;
            createdAt: number;
          }[] = [];

          for (const vote of (result as any).votes) {
            // Skip degraded/silent-fail votes — no useful predictions to extract
            if (vote.isSilentFail || vote.timedOut) continue;
            const rationale = typeof vote.rationale === "string" ? vote.rationale : "";
            if (rationale.startsWith("Analysis unavailable")) continue;

            const personaId = String(vote.personaId ?? vote.agentId ?? "unknown");
            const confidence = vote.confidence ?? vote.confidenceScore ?? null;
            const confidenceWeight = confidence != null ? String(Math.min(1, Math.max(0, parseFloat(String(confidence))))) : null;
            const now = Date.now();

            // Extract prediction candidates from all available fields
            const candidates: string[] = [];
            // blockers array (primary source)
            if (Array.isArray(vote.blockers)) candidates.push(...vote.blockers.map(String));
            // keyFlags array
            if (Array.isArray(vote.keyFlags)) candidates.push(...vote.keyFlags.map(String));
            // keyRisks array (fallback)
            if (Array.isArray(vote.keyRisks)) candidates.push(...vote.keyRisks.map(String));
            // conditions array (correct field name)
            if (Array.isArray(vote.conditions)) {
              for (const c of vote.conditions) candidates.push(String(c));
            }
            // conditionsToProceed (legacy fallback)
            if (Array.isArray(vote.conditionsToProceed)) {
              for (const c of vote.conditionsToProceed) candidates.push(String(c));
            }
            // Extract risk sentences from rationale
            if (rationale.length > 20) {
              const sentences = rationale.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
              for (const s of sentences) {
                if (/risk|concern|insufficient|inadequate|below|breach|fail|weak|missing|lack|gap/.test(s.toLowerCase())) {
                  candidates.push(s.trim());
                }
              }
            }

            // Deduplicate and take top 4 per persona
            const seen = new Set<string>();
            for (const text of candidates.slice(0, 4)) {
              const t = text.trim().slice(0, 500);
              if (t.length > 10 && !seen.has(t)) {
                seen.add(t);
                attributionRows.push({
                  outcomeSessionId: sessionId,
                  personaId,
                  predictionType: classifyPrediction(t),
                  predictionText: t,
                  materialized: null,
                  confidenceWeight,
                  createdAt: now,
                });
              }
            }
          }

          if (attributionRows.length > 0) {
            for (let i = 0; i < attributionRows.length; i += 50) {
              await outcomeDb.insert(outcomeAttributions).values(attributionRows.slice(i, i + 50));
            }
            console.log(`[OutcomeLedger] ${attributionRows.length} attribution candidates created for session ${sessionId}`);
          }
        }
      } catch (attrErr) {
        console.error("[OutcomeLedger] Attribution extraction failed (non-fatal):", attrErr);
      }
    }
  } catch (err) {
    console.error("[OutcomeLedger] Failed to create outcome session (non-fatal):", err);
  }

  return {
    dealId,
    dealName,
    duplicate: false,
    triage: triageResult,
    council: result,
    ic_report: icReport,
    universitySignal,
    realityAlignment,
    debugLog: realityAlignment.debugLog,
    decisionIntegrity: decisionIntegrity ?? null,
  };
}
