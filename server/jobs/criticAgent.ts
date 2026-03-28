/**
 * criticAgent.ts — Self-Learning Loop Phase 5
 *
 * Runs at 03:00 UTC every night (after outcomeCollector at 02:00).
 *
 * For each decision that now has a CORRECT or INCORRECT outcome:
 *   1. Retrieve all votes for that decision from agent_votes_log
 *   2. Score each vote: YES on CORRECT → correct; NO on CORRECT → incorrect; etc.
 *   3. Update agent_weights: +0.1 for correct, -0.1 for incorrect
 *      Floor: 0.3, Ceiling: 2.0
 *   4. Apply 30-day weight decay: weights drift back toward 1.0 at 5% per evaluation
 *      for personas not evaluated in the last 30 days
 *
 * Weight adjustment rules:
 *   - HARD_YES or SOFT_YES vote on a CORRECT outcome → +0.1
 *   - HARD_NO or SOFT_NO vote on a CORRECT outcome  → -0.1
 *   - HARD_YES or SOFT_YES vote on an INCORRECT outcome → -0.1
 *   - HARD_NO or SOFT_NO vote on an INCORRECT outcome  → +0.1
 */

import cron from "node-cron";
import { eq, sql, and, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  agentWeights,
  agentVotesLog,
  decisionMemory,
  decisionOutcomes,
} from "../../drizzle/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHT_ADJUSTMENT = 0.1;
const WEIGHT_FLOOR = 0.3;
const WEIGHT_CEILING = 2.0;
const DECAY_DAYS = 30;          // days of inactivity before decay kicks in
const DECAY_RATE = 0.05;        // 5% drift toward 1.0 per evaluation cycle
const WEIGHT_DEFAULT = 1.0;

// ── Clamp weight to [FLOOR, CEILING] ─────────────────────────────────────────

function clampWeight(w: number): number {
  return Math.min(WEIGHT_CEILING, Math.max(WEIGHT_FLOOR, w));
}

// ── Apply decay: drift toward 1.0 ────────────────────────────────────────────

function applyDecay(currentWeight: number): number {
  const delta = (WEIGHT_DEFAULT - currentWeight) * DECAY_RATE;
  return clampWeight(currentWeight + delta);
}

// ── Determine if a vote was correct ──────────────────────────────────────────

function voteWasCorrect(vote: string, outcomeVerdict: string): boolean {
  const wasYes = vote === "HARD_YES" || vote === "SOFT_YES";
  const wasCorrectOutcome = outcomeVerdict === "CORRECT";
  // YES on CORRECT = correct; NO on INCORRECT = correct
  return wasYes === wasCorrectOutcome;
}

// ── Main critic agent run ─────────────────────────────────────────────────────

export async function runCriticAgent(): Promise<void> {
  console.log("[CriticAgent] Starting post-mortem weight adjustment run...");

  const db = await getDb();
  if (!db) {
    console.warn("[CriticAgent] Database not available, skipping run");
    return;
  }

  try {
    // 1. Find all outcomes that are CORRECT or INCORRECT and not yet scored
    const scorableOutcomes = await db
      .select({
        outcomeId: decisionOutcomes.id,
        decisionMemoryId: decisionOutcomes.decisionMemoryId,
        outcomeVerdict: decisionOutcomes.outcomeVerdict,
      })
      .from(decisionOutcomes)
      .where(
        sql`${decisionOutcomes.outcomeVerdict} IN ('CORRECT', 'INCORRECT')`
      )
      .limit(100);

    if (scorableOutcomes.length === 0) {
      console.log("[CriticAgent] No scorable outcomes found, running decay only");
    } else {
      console.log(`[CriticAgent] Found ${scorableOutcomes.length} outcomes to process`);
    }

    // 2. For each outcome, score the votes and update weights
    const weightDeltas = new Map<string, number>(); // personaId → cumulative delta
    const evaluationCounts = new Map<string, number>(); // personaId → count
    const correctCounts = new Map<string, number>(); // personaId → correct count
    const processedDecisionIds = new Set<number>();

    for (const outcome of scorableOutcomes) {
      const { decisionMemoryId, outcomeVerdict } = outcome;

      // Skip if we already processed this decision in this run
      if (processedDecisionIds.has(decisionMemoryId)) continue;
      processedDecisionIds.add(decisionMemoryId);

      // Get all votes for this decision that haven't been scored yet
      const votes = await db
        .select({
          id: agentVotesLog.id,
          personaId: agentVotesLog.personaId,
          vote: agentVotesLog.vote,
          wasCorrect: agentVotesLog.wasCorrect,
        })
        .from(agentVotesLog)
        .where(
          and(
            eq(agentVotesLog.decisionMemoryId, decisionMemoryId),
            isNull(agentVotesLog.wasCorrect)
          )
        );

      for (const voteRow of votes) {
        if (!voteRow.vote) continue;

        const correct = voteWasCorrect(voteRow.vote, outcomeVerdict ?? "");
        const delta = correct ? WEIGHT_ADJUSTMENT : -WEIGHT_ADJUSTMENT;

        // Accumulate deltas per persona
        weightDeltas.set(
          voteRow.personaId,
          (weightDeltas.get(voteRow.personaId) ?? 0) + delta
        );
        evaluationCounts.set(
          voteRow.personaId,
          (evaluationCounts.get(voteRow.personaId) ?? 0) + 1
        );
        if (correct) {
          correctCounts.set(
            voteRow.personaId,
            (correctCounts.get(voteRow.personaId) ?? 0) + 1
          );
        }

        // Mark vote as scored
        await db
          .update(agentVotesLog)
          .set({ wasCorrect: correct, scoredAt: new Date() })
          .where(eq(agentVotesLog.id, voteRow.id));
      }
    }

    // 3. Apply accumulated weight deltas to agent_weights
    let weightsUpdated = 0;
    for (const [personaId, delta] of Array.from(weightDeltas.entries())) {
      const evalCount = evaluationCounts.get(personaId) ?? 0;
      const correctCount = correctCounts.get(personaId) ?? 0;

      // Fetch current weight
      const rows = await db
        .select({ weight: agentWeights.weight, totalEvaluations: agentWeights.totalEvaluations, correctPredictions: agentWeights.correctPredictions })
        .from(agentWeights)
        .where(eq(agentWeights.personaId, personaId));

      if (rows.length === 0) {
        // Persona not in weights table — insert with default
        await db.insert(agentWeights).values({
          personaId,
          weight: String(clampWeight(WEIGHT_DEFAULT + delta)),
          totalEvaluations: evalCount,
          correctPredictions: correctCount,
          lastEvaluatedAt: new Date(),
        });
      } else {
        const currentWeight = parseFloat(String(rows[0].weight));
        const newWeight = clampWeight(currentWeight + delta);
        const newTotal = (rows[0].totalEvaluations ?? 0) + evalCount;
        const newCorrect = (rows[0].correctPredictions ?? 0) + correctCount;

        await db
          .update(agentWeights)
          .set({
            weight: String(newWeight),
            totalEvaluations: newTotal,
            correctPredictions: newCorrect,
            lastEvaluatedAt: new Date(),
          })
          .where(eq(agentWeights.personaId, personaId));

        console.log(
          `[CriticAgent] ${personaId}: ${currentWeight.toFixed(2)} → ${newWeight.toFixed(2)} (delta ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}, ${correctCount}/${evalCount} correct)`
        );
      }
      weightsUpdated++;
    }

    // 4. Apply 30-day decay to personas not recently evaluated
    const decayThreshold = new Date(Date.now() - DECAY_DAYS * 86400000);
    const allWeights = await db
      .select({
        personaId: agentWeights.personaId,
        weight: agentWeights.weight,
        lastEvaluatedAt: agentWeights.lastEvaluatedAt,
      })
      .from(agentWeights);

    let decayApplied = 0;
    for (const row of allWeights) {
      // Skip if recently evaluated (already updated above or within 30 days)
      if (weightDeltas.has(row.personaId)) continue;
      const lastEval = row.lastEvaluatedAt;
      if (lastEval && lastEval > decayThreshold) continue;

      const currentWeight = parseFloat(String(row.weight));
      // Only decay if weight is meaningfully different from default
      if (Math.abs(currentWeight - WEIGHT_DEFAULT) < 0.01) continue;

      const decayedWeight = applyDecay(currentWeight);
      await db
        .update(agentWeights)
        .set({ weight: String(decayedWeight) })
        .where(eq(agentWeights.personaId, row.personaId));

      console.log(
        `[CriticAgent] Decay ${row.personaId}: ${currentWeight.toFixed(2)} → ${decayedWeight.toFixed(2)}`
      );
      decayApplied++;
    }

    console.log(
      `[CriticAgent] Run complete. Weights updated: ${weightsUpdated}, Decay applied: ${decayApplied}`
    );
  } catch (err) {
    console.error("[CriticAgent] Fatal error during run:", err);
  }
}

// ── Cron scheduler ────────────────────────────────────────────────────────────

export function startCriticAgentJob(): void {
  // Run at 03:00 UTC every night (1 hour after outcome collector)
  cron.schedule("0 3 * * *", async () => {
    await runCriticAgent();
  });
  console.log("[CriticAgent] Nightly critic agent job scheduled (03:00 UTC)");
}
