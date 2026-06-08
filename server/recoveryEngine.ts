/**
 * recoveryEngine.ts — Deal Recovery Engine
 *
 * For every REJECTED / VETOED / BLOCKED deal, this engine generates a structured
 * recovery analysis instead of terminating analysis.
 *
 * Output sections:
 *   1. Failure Analysis        — root cause breakdown with governing blocker citations
 *   2. Recovery Path A/B/C     — three distinct structural paths to reconsideration
 *   3. Re-entry Conditions     — specific, measurable conditions that must be satisfied
 *   4. Probability of Recovery — per-path probability with rationale
 *   5. Required Structural Changes — ranked list of changes with council concern citations
 *
 * Additional fields:
 *   - terminalBlockers         — named blockers with constitutional finding references
 *   - conditionsForReconsideration — what the IC would need to see
 *   - suggestedNextReviewDate  — earliest viable re-entry date
 *
 * GOVERNANCE INVARIANT:
 *   - This engine NEVER overrides a Council verdict.
 *   - It NEVER marks a deal as approved or approvable.
 *   - It answers only: "What would need to change for this deal to be reconsidered?"
 *   - All recovery recommendations cite the governing blocker, council concern,
 *     and constitutional finding that triggered the rejection.
 */

import { invokeLLM } from "./_core/llm";
import { rescuePolicy, TERMINAL_FLAGS, type TerminalBlockerFlag } from "./lib/rescuePolicy";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecoveryPath {
  /** A, B, or C */
  label: "A" | "B" | "C";
  /** Short title for this recovery path */
  title: string;
  /** Description of the structural change required */
  description: string;
  /** Governing blocker this path addresses */
  governingBlocker: string;
  /** Council concern this path responds to */
  councilConcern: string;
  /** Constitutional / institutional finding that triggered the rejection */
  constitutionalFinding: string;
  /** Estimated probability of reconsideration if this path is executed (0–100) */
  probabilityPct: number;
  /** Estimated timeline to execute this path */
  estimatedTimeline: string;
  /** Key milestones required */
  milestones: string[];
}

export interface TerminalBlockerDetail {
  flag: string;
  label: string;
  governingBlocker: string;
  councilConcern: string;
  constitutionalFinding: string;
  residualRisk: string;
}

export interface RecoveryEngineResult {
  /** Failure analysis — root cause breakdown */
  failureAnalysis: {
    primaryFailureMode: string;
    rootCauses: Array<{
      category: string;
      description: string;
      governingBlocker: string;
      councilConcern: string;
      constitutionalFinding: string;
    }>;
    whyRepairIsInsufficient: string;
  };
  /** Named terminal blockers with full citation chain */
  terminalBlockers: TerminalBlockerDetail[];
  /** Three recovery paths */
  recoveryPathA: RecoveryPath;
  recoveryPathB: RecoveryPath;
  recoveryPathC: RecoveryPath;
  /** Re-entry conditions — specific, measurable */
  reentryConditions: Array<{
    condition: string;
    measurableThreshold: string;
    verificationMethod: string;
    timeframe: string;
  }>;
  /** Conditions the IC would need to see before reconsidering */
  conditionsForReconsideration: string[];
  /** Suggested earliest re-entry date */
  suggestedNextReviewDate: string;
  /** Overall probability of recovery (weighted across paths) */
  overallProbabilityOfRecovery: {
    pct: number;
    rationale: string;
    mostViablePath: "A" | "B" | "C";
  };
  /** Ranked structural changes required */
  requiredStructuralChanges: Array<{
    rank: number;
    change: string;
    rationale: string;
    governingBlocker: string;
    councilConcern: string;
  }>;
}

// ── LLM JSON Schema ───────────────────────────────────────────────────────────

const RECOVERY_JSON_SCHEMA = {
  type: "object",
  properties: {
    failureAnalysis: {
      type: "object",
      properties: {
        primaryFailureMode: { type: "string" },
        rootCauses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category:               { type: "string" },
              description:            { type: "string" },
              governingBlocker:       { type: "string" },
              councilConcern:         { type: "string" },
              constitutionalFinding:  { type: "string" },
            },
            required: ["category", "description", "governingBlocker", "councilConcern", "constitutionalFinding"],
            additionalProperties: false,
          },
        },
        whyRepairIsInsufficient: { type: "string" },
      },
      required: ["primaryFailureMode", "rootCauses", "whyRepairIsInsufficient"],
      additionalProperties: false,
    },
    terminalBlockers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          flag:                   { type: "string" },
          label:                  { type: "string" },
          governingBlocker:       { type: "string" },
          councilConcern:         { type: "string" },
          constitutionalFinding:  { type: "string" },
          residualRisk:           { type: "string" },
        },
        required: ["flag", "label", "governingBlocker", "councilConcern", "constitutionalFinding", "residualRisk"],
        additionalProperties: false,
      },
    },
    recoveryPathA: {
      type: "object",
      properties: {
        label:                  { type: "string" },
        title:                  { type: "string" },
        description:            { type: "string" },
        governingBlocker:       { type: "string" },
        councilConcern:         { type: "string" },
        constitutionalFinding:  { type: "string" },
        probabilityPct:         { type: "number" },
        estimatedTimeline:      { type: "string" },
        milestones:             { type: "array", items: { type: "string" } },
      },
      required: ["label", "title", "description", "governingBlocker", "councilConcern", "constitutionalFinding", "probabilityPct", "estimatedTimeline", "milestones"],
      additionalProperties: false,
    },
    recoveryPathB: {
      type: "object",
      properties: {
        label:                  { type: "string" },
        title:                  { type: "string" },
        description:            { type: "string" },
        governingBlocker:       { type: "string" },
        councilConcern:         { type: "string" },
        constitutionalFinding:  { type: "string" },
        probabilityPct:         { type: "number" },
        estimatedTimeline:      { type: "string" },
        milestones:             { type: "array", items: { type: "string" } },
      },
      required: ["label", "title", "description", "governingBlocker", "councilConcern", "constitutionalFinding", "probabilityPct", "estimatedTimeline", "milestones"],
      additionalProperties: false,
    },
    recoveryPathC: {
      type: "object",
      properties: {
        label:                  { type: "string" },
        title:                  { type: "string" },
        description:            { type: "string" },
        governingBlocker:       { type: "string" },
        councilConcern:         { type: "string" },
        constitutionalFinding:  { type: "string" },
        probabilityPct:         { type: "number" },
        estimatedTimeline:      { type: "string" },
        milestones:             { type: "array", items: { type: "string" } },
      },
      required: ["label", "title", "description", "governingBlocker", "councilConcern", "constitutionalFinding", "probabilityPct", "estimatedTimeline", "milestones"],
      additionalProperties: false,
    },
    reentryConditions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          condition:              { type: "string" },
          measurableThreshold:    { type: "string" },
          verificationMethod:     { type: "string" },
          timeframe:              { type: "string" },
        },
        required: ["condition", "measurableThreshold", "verificationMethod", "timeframe"],
        additionalProperties: false,
      },
    },
    conditionsForReconsideration: {
      type: "array",
      items: { type: "string" },
    },
    suggestedNextReviewDate: { type: "string" },
    overallProbabilityOfRecovery: {
      type: "object",
      properties: {
        pct:            { type: "number" },
        rationale:      { type: "string" },
        mostViablePath: { type: "string" },
      },
      required: ["pct", "rationale", "mostViablePath"],
      additionalProperties: false,
    },
    requiredStructuralChanges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank:             { type: "number" },
          change:           { type: "string" },
          rationale:        { type: "string" },
          governingBlocker: { type: "string" },
          councilConcern:   { type: "string" },
        },
        required: ["rank", "change", "rationale", "governingBlocker", "councilConcern"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "failureAnalysis",
    "terminalBlockers",
    "recoveryPathA",
    "recoveryPathB",
    "recoveryPathC",
    "reentryConditions",
    "conditionsForReconsideration",
    "suggestedNextReviewDate",
    "overallProbabilityOfRecovery",
    "requiredStructuralChanges",
  ],
  additionalProperties: false,
};

// ── Input ─────────────────────────────────────────────────────────────────────

export interface RecoveryEngineInput {
  dealName: string;
  dealText: string;
  councilOutcome: string;
  verdict: string;
  terminalFlags: string[];
  classificationRationale: string;
  councilMode?: string;
  icMemoSummary?: string;
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateRecovery(input: RecoveryEngineInput): Promise<RecoveryEngineResult> {
  const modeLabel = input.councilMode === "infrastructure"
    ? "Infrastructure / Project Finance"
    : "Venture Capital";

  // Build terminal blocker context from rescuePolicy
  const blockerContext = input.terminalFlags.map((flag) => {
    const policy = rescuePolicy[flag as TerminalBlockerFlag];
    const label = flag.replace(/_/g, " ").toUpperCase();
    const residual = policy?.residualRisk ?? "No deal-level mitigation available. Terminal institutional blocker.";
    const verdict = policy?.verdict ?? "TERMINAL";
    const mitigation = policy?.mitigation ?? null;
    return `FLAG: ${flag}\nLABEL: ${label}\nVERDICT: ${verdict}\nRESIDUAL RISK: ${residual}\nMITIGATION: ${mitigation ?? "None — terminal blocker"}`;
  }).join("\n\n");

  const systemPrompt = `You are the AgenThink Mesh Deal Recovery Engine.

GOVERNANCE INVARIANT — READ THIS FIRST:
You MUST NOT override, soften, or contradict the Council's rejection verdict.
You MUST NOT suggest the deal is approvable in its current form.
You MUST NOT fabricate approvals or positive outcomes.
Your SOLE function is to answer: "What would need to change for this deal to be reconsidered?"

Council Mode: ${modeLabel}
Verdict: ${input.verdict}

TASK:
Generate a structured recovery analysis with exactly these 5 sections:
1. Failure Analysis — explain WHY the deal was rejected, citing the governing blocker, council concern, and constitutional finding for each root cause.
2. Recovery Paths A, B, C — three distinct structural paths. Each path must:
   - Be materially different from the others (not just variations of the same change)
   - Cite the governing blocker it addresses
   - Cite the council concern it responds to
   - Cite the constitutional/institutional finding that triggered rejection
   - Include probability of reconsideration (0–100%) with honest rationale
   - Include estimated timeline and 3–5 milestones
3. Re-entry Conditions — 3–5 specific, measurable conditions (not vague aspirations). Each must have a measurable threshold, verification method, and timeframe.
4. Probability of Recovery — overall probability across all paths, with rationale and most viable path.
5. Required Structural Changes — ranked list of 3–7 changes, each citing the governing blocker and council concern.

Additional fields:
- terminalBlockers: for each terminal flag, provide the governing blocker, council concern, constitutional finding, and residual risk
- conditionsForReconsideration: 3–5 specific conditions the IC would need to see
- suggestedNextReviewDate: earliest realistic re-entry date (format: "Q[1-4] [YEAR]" or "Month YEAR")

RULES:
- Every recovery recommendation MUST cite: governing blocker + council concern + constitutional finding
- Probability estimates must be honest — a sanctions-blocked deal has near-zero probability
- Recovery paths must be structurally distinct (not variations of the same change)
- Re-entry conditions must be measurable (not "improve governance" but "appoint independent board chair with 10+ years regulated-entity experience, verified by external counsel")
- suggestedNextReviewDate must be realistic given the blockers
- Return ONLY valid JSON. No prose before or after.`;

  const userMessage = `[DEAL NAME]
${input.dealName}

[COUNCIL MODE]
${modeLabel}

[VERDICT]
${input.verdict}

[CLASSIFICATION RATIONALE]
${input.classificationRationale}

[TERMINAL BLOCKER FLAGS]
${blockerContext || "None specified — derive from council outcome."}

[ORIGINAL DEAL BRIEF]
${input.dealText}

[COUNCIL OUTCOME]
${input.councilOutcome}

[IC MEMO SUMMARY]
${input.icMemoSummary ?? "Not provided."}`;

  const raw = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMessage },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "deal_recovery_engine",
        strict: true,
        schema: RECOVERY_JSON_SCHEMA,
      },
    },
  });

  const rawContent = raw.choices?.[0]?.message?.content ?? "{}";
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  let parsed: RecoveryEngineResult;
  try {
    parsed = JSON.parse(content) as RecoveryEngineResult;
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        parsed = JSON.parse(match[1]) as RecoveryEngineResult;
      } catch {
        parsed = buildFallbackResult(input);
      }
    } else {
      parsed = buildFallbackResult(input);
    }
  }

  // ── Governance guards ─────────────────────────────────────────────────────
  // Clamp all probability values to 0–99 (never 100 — a rejected deal is never guaranteed)
  const clamp = (n: number) => Math.min(Math.max(Math.round(n), 0), 99);

  if (parsed.recoveryPathA) parsed.recoveryPathA.probabilityPct = clamp(parsed.recoveryPathA.probabilityPct ?? 0);
  if (parsed.recoveryPathB) parsed.recoveryPathB.probabilityPct = clamp(parsed.recoveryPathB.probabilityPct ?? 0);
  if (parsed.recoveryPathC) parsed.recoveryPathC.probabilityPct = clamp(parsed.recoveryPathC.probabilityPct ?? 0);
  if (parsed.overallProbabilityOfRecovery) {
    parsed.overallProbabilityOfRecovery.pct = clamp(parsed.overallProbabilityOfRecovery.pct ?? 0);
  }

  // For terminal flags that are in TERMINAL_FLAGS (truly terminal), cap probability at 25%
  const hasHardTerminal = input.terminalFlags.some((f) => TERMINAL_FLAGS.has(f as TerminalBlockerFlag));
  if (hasHardTerminal) {
    const hardCap = 25;
    if (parsed.recoveryPathA) parsed.recoveryPathA.probabilityPct = Math.min(parsed.recoveryPathA.probabilityPct, hardCap);
    if (parsed.recoveryPathB) parsed.recoveryPathB.probabilityPct = Math.min(parsed.recoveryPathB.probabilityPct, hardCap);
    if (parsed.recoveryPathC) parsed.recoveryPathC.probabilityPct = Math.min(parsed.recoveryPathC.probabilityPct, hardCap);
    if (parsed.overallProbabilityOfRecovery) {
      parsed.overallProbabilityOfRecovery.pct = Math.min(parsed.overallProbabilityOfRecovery.pct, hardCap);
    }
  }

  // Ensure path labels are correct
  if (parsed.recoveryPathA) parsed.recoveryPathA.label = "A";
  if (parsed.recoveryPathB) parsed.recoveryPathB.label = "B";
  if (parsed.recoveryPathC) parsed.recoveryPathC.label = "C";

  return parsed;
}

// ── Fallback result (parse failure) ──────────────────────────────────────────

function buildFallbackResult(input: RecoveryEngineInput): RecoveryEngineResult {
  const blockerLabel = input.terminalFlags.length > 0
    ? input.terminalFlags.map((f) => f.replace(/_/g, " ").toUpperCase()).join(", ")
    : "STRUCTURAL DEFICIENCY";

  return {
    failureAnalysis: {
      primaryFailureMode: `Deal rejected due to: ${blockerLabel}`,
      rootCauses: [{
        category: "TERMINAL",
        description: input.classificationRationale || "Terminal institutional blocker identified by Council.",
        governingBlocker: blockerLabel,
        councilConcern: "Council unanimous rejection — terminal blocker cannot be addressed at deal level.",
        constitutionalFinding: "AgenThink Mesh Constitution §4.2 — Terminal blockers require sovereign-level resolution before resubmission.",
      }],
      whyRepairIsInsufficient: "The blocking condition cannot be resolved through deal-level restructuring. Resolution requires external or sovereign-level action.",
    },
    terminalBlockers: input.terminalFlags.map((flag) => {
      const policy = rescuePolicy[flag as TerminalBlockerFlag];
      return {
        flag,
        label: flag.replace(/_/g, " ").toUpperCase(),
        governingBlocker: flag.replace(/_/g, " ").toUpperCase(),
        councilConcern: "Council unanimous rejection.",
        constitutionalFinding: "AgenThink Mesh Constitution §4.2 — Terminal blocker.",
        residualRisk: policy?.residualRisk ?? "Terminal institutional blocker — no deal-level mitigation available.",
      };
    }),
    recoveryPathA: {
      label: "A",
      title: "Sovereign Resolution Path",
      description: "Await resolution of the terminal blocking condition at the sovereign or regulatory level, then resubmit with clean compliance documentation.",
      governingBlocker: blockerLabel,
      councilConcern: "Terminal blocker cannot be addressed at deal level.",
      constitutionalFinding: "AgenThink Mesh Constitution §4.2",
      probabilityPct: 15,
      estimatedTimeline: "12–24 months",
      milestones: ["Obtain legal opinion confirming blocker resolution", "Engage independent compliance counsel", "Prepare clean resubmission package", "Stage 1 re-entry"],
    },
    recoveryPathB: {
      label: "B",
      title: "Alternative Structure Path",
      description: "Restructure the deal to eliminate exposure to the terminal blocker through an alternative instrument or jurisdiction.",
      governingBlocker: blockerLabel,
      councilConcern: "Current structure creates unacceptable institutional risk.",
      constitutionalFinding: "AgenThink Mesh Constitution §3.1 — Structural risk threshold",
      probabilityPct: 10,
      estimatedTimeline: "6–18 months",
      milestones: ["Engage restructuring counsel", "Identify alternative structure", "Obtain regulatory clearance", "Resubmit through Stage 1"],
    },
    recoveryPathC: {
      label: "C",
      title: "Strategic Partnership Path",
      description: "Partner with an institution that has existing clearance or exemption from the blocking condition, transferring deal sponsorship.",
      governingBlocker: blockerLabel,
      councilConcern: "Sponsor lacks institutional standing to proceed.",
      constitutionalFinding: "AgenThink Mesh Constitution §2.4 — Sponsor qualification",
      probabilityPct: 8,
      estimatedTimeline: "9–18 months",
      milestones: ["Identify qualified co-sponsor", "Structure partnership agreement", "Transfer sponsorship", "Resubmit under qualified sponsor"],
    },
    reentryConditions: [{
      condition: "Terminal blocker fully resolved",
      measurableThreshold: "Written legal opinion from independent counsel confirming full resolution",
      verificationMethod: "External legal review by Council-approved counsel",
      timeframe: "Before any resubmission",
    }],
    conditionsForReconsideration: [
      "Full resolution of all terminal blocking conditions",
      "Independent legal opinion confirming compliance",
      "Clean audit opinion with no adverse findings",
      "Resubmission through Stage 1 screening process",
    ],
    suggestedNextReviewDate: "Q1 2027",
    overallProbabilityOfRecovery: {
      pct: 12,
      rationale: "Terminal blockers require external resolution — probability is low until the underlying condition changes.",
      mostViablePath: "A",
    },
    requiredStructuralChanges: [{
      rank: 1,
      change: "Resolve terminal blocking condition",
      rationale: "No structural change at deal level can address a terminal institutional blocker.",
      governingBlocker: blockerLabel,
      councilConcern: "Council unanimous rejection — terminal blocker.",
    }],
  };
}
