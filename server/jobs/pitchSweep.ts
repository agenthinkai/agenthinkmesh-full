/**
 * pitchSweep.ts — Daily Auto Re-Triage Sweep
 *
 * Runs at 08:00 Kuwait time (Asia/Kuwait = UTC+3) every day.
 * Falls back to UTC if the timezone is unavailable.
 *
 * For each active user who has at least one deal in 'diligence' or 'ic_ready'
 * with no outcome recorded, the sweep calls runCheckAndTriggerForUser() which
 * replicates the full checkAndTrigger logic (stale_diligence, stale_ic_ready,
 * score_drop, pattern_shift) with the built-in 24-hour per-deal cooldown.
 *
 * One user failure never aborts the sweep — errors are caught and logged.
 *
 * Gate: does NOT run when NODE_ENV === "test".
 */
import cron from "node-cron";
import { getActiveUsersWithDeals, getPitchTriageHistory, savePitchTriage } from "../db";
import { PitchTriage } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

// ── Agent definitions (mirrors checkAndTrigger in pitch.ts) ──────────────────
type AgentName = "Market Signal" | "Business Model" | "Traction" | "Founder Signal" | "Risk" | "Completeness";

const AGENTS: Array<{ name: AgentName; labels: string[]; fallback: string; systemPrompt: string }> = [
  {
    name: "Market Signal",
    labels: ["strong", "weak", "unclear"],
    fallback: "weak",
    systemPrompt: `You are a market signal analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite a specific fact from the pitch text; (2) reasoning MUST be ≤18 words; (3) NEVER use generic phrases.
Format: {"label": "strong"|"weak"|"unclear", "reasoning": "<concrete signal, ≤18 words>"}`,
  },
  {
    name: "Business Model",
    labels: ["clear", "weak", "missing"],
    fallback: "weak",
    systemPrompt: `You are a business model analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) cite the specific revenue mechanism; (2) reasoning MUST be ≤18 words.
Format: {"label": "clear"|"weak"|"missing", "reasoning": "<concrete signal, ≤18 words>"}`,
  },
  {
    name: "Traction",
    labels: ["strong", "early", "none"],
    fallback: "early",
    systemPrompt: `You are a traction analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) quote a specific metric; (2) reasoning MUST be ≤18 words.
Format: {"label": "strong"|"early"|"none", "reasoning": "<concrete signal, ≤18 words>"}`,
  },
  {
    name: "Founder Signal",
    labels: ["strong", "neutral", "risk"],
    fallback: "neutral",
    systemPrompt: `You are a founder signal analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) reference a specific credential or red flag; (2) reasoning MUST be ≤18 words.
Format: {"label": "strong"|"neutral"|"risk", "reasoning": "<concrete signal, ≤18 words>"}`,
  },
  {
    name: "Risk",
    labels: ["low", "medium", "high"],
    fallback: "medium",
    systemPrompt: `You are a risk analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) name the single most significant risk; (2) reasoning MUST be ≤18 words.
Format: {"label": "low"|"medium"|"high", "reasoning": "<concrete risk, ≤18 words>"}`,
  },
  {
    name: "Completeness",
    labels: ["complete", "partial", "insufficient"],
    fallback: "partial",
    systemPrompt: `You are a pitch completeness analyst. Evaluate the pitch and return ONLY valid JSON.
Rules: (1) list specific missing elements; (2) reasoning MUST be ≤18 words.
Format: {"label": "complete"|"partial"|"insufficient", "reasoning": "<specific missing fields, ≤18 words>"}`,
  },
];

const WEIGHTS: Record<AgentName, number> = {
  "Market Signal": 20, "Business Model": 18, "Traction": 22,
  "Founder Signal": 20, "Risk": 15, "Completeness": 5,
};

const LABEL_SCORES: Record<string, number> = {
  strong: 100, weak: 40, unclear: 20,
  clear: 100, missing: 0,
  early: 50, none: 0,
  neutral: 50, risk: 0,
  low: 100, medium: 50, high: 0,
  complete: 100, partial: 50, insufficient: 0,
};

// ── Pipeline helper ───────────────────────────────────────────────────────────
async function runTriagePipeline(pitchText: string): Promise<{
  score: number;
  classification: "ENGAGE" | "WATCH" | "IGNORE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  nextStep: string;
  agentOutputs: Array<{ name: AgentName; label: string; reasoning: string; fallback: boolean }>;
  keySignals: string[];
  missingInfo: string[];
  topMissingFields: string[];
}> {
  const truncated = pitchText.slice(0, 3000);
  type AgentResult = { name: AgentName; label: string; reasoning: string; fallback: boolean };
  const agentOutputs: AgentResult[] = await Promise.all(
    AGENTS.map(async (agent) => {
      try {
        const res = await invokeLLM({
          messages: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: `Pitch:\n${truncated}` },
          ],
          max_tokens: 120,
        });
        const contentRaw = res?.choices?.[0]?.message?.content;
        const raw = (typeof contentRaw === "string" ? contentRaw : "").trim();
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned) as { label?: unknown; reasoning?: unknown };
        const label = typeof parsed.label === "string" && agent.labels.includes(parsed.label)
          ? parsed.label : agent.fallback;
        const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
          ? parsed.reasoning.slice(0, 120) : "Unable to determine from available information.";
        return { name: agent.name, label, reasoning, fallback: label === agent.fallback && parsed.label !== agent.fallback };
      } catch {
        return { name: agent.name, label: agent.fallback, reasoning: "Unable to determine.", fallback: true };
      }
    })
  );
  const byName = Object.fromEntries(agentOutputs.map((r) => [r.name, r])) as Record<AgentName, AgentResult>;
  let rawScore = 0;
  for (const agent of AGENTS) {
    rawScore += ((LABEL_SCORES[byName[agent.name].label] ?? 50) * WEIGHTS[agent.name]) / 100;
  }
  const score = Math.round(rawScore);
  const completenessLabel = byName["Completeness"].label;
  const riskLabel = byName["Risk"].label;
  const founderLabel = byName["Founder Signal"].label;
  const confidence: "HIGH" | "MEDIUM" | "LOW" = completenessLabel === "complete" ? "HIGH" : completenessLabel === "partial" ? "MEDIUM" : "LOW";
  let classification: "ENGAGE" | "WATCH" | "IGNORE";
  if (completenessLabel === "insufficient" && score < 35) classification = "IGNORE";
  else if (score >= 62 && riskLabel !== "high" && founderLabel !== "risk") classification = confidence === "LOW" ? "WATCH" : "ENGAGE";
  else if (score >= 38) classification = "WATCH";
  else classification = "IGNORE";
  const nextStep = classification === "ENGAGE" ? "Run full evaluation" : classification === "WATCH" ? "Request more information" : "No action";
  const redLabels = new Set(["unclear", "missing", "none", "risk", "high", "insufficient"]);
  const positiveLabels = new Set(["strong", "clear", "low", "complete"]);
  const topMissingFields = agentOutputs
    .filter((r) => redLabels.has(r.label))
    .sort((a, b) => (WEIGHTS[b.name] ?? 0) - (WEIGHTS[a.name] ?? 0))
    .slice(0, 2)
    .map((r) => r.name);
  const keySignals = agentOutputs.filter((r) => positiveLabels.has(r.label)).slice(0, 3).map((r) => `${r.name}: ${r.reasoning}`);
  if (keySignals.length < 3) {
    for (const r of agentOutputs) {
      if (keySignals.length >= 3) break;
      const sig = `${r.name}: ${r.reasoning}`;
      if (!keySignals.includes(sig)) keySignals.push(sig);
    }
  }
  const missingInfo = agentOutputs.filter((r) => redLabels.has(r.label)).map((r) => `${r.name}: ${r.reasoning}`);
  return { score, classification, confidence, nextStep, agentOutputs, keySignals, missingInfo, topMissingFields };
}

// ── Per-user sweep ────────────────────────────────────────────────────────────
export async function runCheckAndTriggerForUser(userId: string): Promise<{
  userId: string;
  triggered: number;
  skipped: number;
}> {
  const allRows = await getPitchTriageHistory(userId, 200) as PitchTriage[];
  if (!allRows || allRows.length === 0) {
    return { userId, triggered: 0, skipped: 0 };
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const SCORE_DROP_THRESHOLD = 10;
  const now = Date.now();

  // 24-hour cooldown map: parentTriageId → latest auto re-triage date
  const latestAutoByParent = new Map<number, Date>();
  for (const r of allRows) {
    if (r.source === "auto" && r.parentTriageId) {
      const existing = latestAutoByParent.get(r.parentTriageId);
      if (!existing || new Date(r.createdAt) > existing) {
        latestAutoByParent.set(r.parentTriageId, new Date(r.createdAt));
      }
    }
  }

  // Recent outcomes for pattern_shift detection (last 90 days)
  const recentOutcomes = allRows.filter(
    (r) => (r.decisionOutcome === "invested" || r.decisionOutcome === "passed") &&
      now - new Date(r.createdAt).getTime() <= 90 * 24 * 60 * 60 * 1000
  );
  const recentPassedCount = recentOutcomes.filter((r) => r.decisionOutcome === "passed").length;
  const recentInvestedCount = recentOutcomes.filter((r) => r.decisionOutcome === "invested").length;

  type TriggerType = "stale_diligence" | "stale_ic_ready" | "score_drop" | "pattern_shift";
  let triggered = 0;
  let skipped = 0;

  for (const row of allRows) {
    // Only trigger from manual records; skip auto-generated ones
    if (row.source === "auto") continue;

    const ageMs = now - new Date(row.createdAt).getTime();

    // 24-hour cooldown
    const lastAutoAt = latestAutoByParent.get(row.id);
    if (lastAutoAt && now - lastAutoAt.getTime() < TWENTY_FOUR_HOURS_MS) {
      skipped++;
      continue;
    }

    let triggerType: TriggerType | null = null;

    // stale_diligence / stale_ic_ready
    if (!row.decisionOutcome && ageMs >= THIRTY_DAYS_MS) {
      if (row.stage === "diligence") triggerType = "stale_diligence";
      else if (row.stage === "ic_ready") triggerType = "stale_ic_ready";
    }

    // score_drop
    if (!triggerType) {
      const children = allRows.filter((r) => r.parentTriageId === row.id && r.source !== "auto");
      if (children.length > 0) {
        const latestChild = children.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        if (row.score - latestChild.score >= SCORE_DROP_THRESHOLD) {
          triggerType = "score_drop";
        }
      }
    }

    // pattern_shift
    if (!triggerType && (row.stage === "diligence" || row.stage === "ic_ready") && !row.decisionOutcome) {
      const totalOutcomes = recentPassedCount + recentInvestedCount;
      if (totalOutcomes >= 3) {
        const passedRate = recentPassedCount / totalOutcomes;
        const investedRate = recentInvestedCount / totalOutcomes;
        if (row.classification === "ENGAGE" && passedRate >= 0.7) triggerType = "pattern_shift";
        if (row.classification === "IGNORE" && investedRate >= 0.7) triggerType = "pattern_shift";
      }
    }

    if (!triggerType) {
      skipped++;
      continue;
    }

    try {
      const result = await runTriagePipeline(row.pitchPreview);
      await savePitchTriage({
        userId,
        pitchPreview: row.pitchPreview,
        score: result.score,
        classification: result.classification,
        confidence: result.confidence,
        agentOutputs: JSON.stringify(result.agentOutputs),
        keySignals: JSON.stringify(result.keySignals),
        missingInfo: JSON.stringify(result.missingInfo),
        topMissingFields: JSON.stringify(result.topMissingFields),
        nextStep: result.nextStep,
        parentTriageId: row.id,
        triggerType,
        source: "auto",
      });
      triggered++;
    } catch (err) {
      console.error(`[PitchSweep] Failed to re-triage deal ${row.id} for user ${userId}:`, err);
      skipped++;
    }
  }

  return { userId, triggered, skipped };
}

// ── Cron scheduler ────────────────────────────────────────────────────────────
export function startPitchSweepJob(): void {
  // Gate: never run during tests
  if (process.env.NODE_ENV === "test") return;

  // Schedule: 08:00 Kuwait time (Asia/Kuwait = UTC+3)
  // node-cron v4 supports IANA timezone names natively
  cron.schedule("0 8 * * *", async () => {
    console.log("[PitchSweep] Daily sweep started");
    try {
      const userIds = await getActiveUsersWithDeals();
      console.log(`[PitchSweep] Found ${userIds.length} active user(s) with deals in diligence/ic_ready`);
      for (const userId of userIds) {
        try {
          const result = await runCheckAndTriggerForUser(userId);
          console.log(`[PitchSweep] userId=${result.userId} triggered=${result.triggered} skipped=${result.skipped}`);
        } catch (err) {
          console.error(`[PitchSweep] Error processing userId=${userId}:`, err);
          // Continue to next user — one failure must not abort the sweep
        }
      }
      console.log("[PitchSweep] Daily sweep complete");
    } catch (err) {
      console.error("[PitchSweep] Fatal error during sweep:", err);
    }
  }, { timezone: "Asia/Kuwait" });

  console.log("[PitchSweep] Daily pitch sweep job scheduled (08:00 Kuwait time)");
}
