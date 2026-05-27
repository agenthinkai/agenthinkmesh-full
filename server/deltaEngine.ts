/**
 * deltaEngine.ts — Delta Engine / Rescue Sensitivity Layer  v1.0
 *
 * Invoked ONLY for HARD-NO variants after Stage 1.
 * Stage 1 (OR-gate) is UNCHANGED. This layer runs post-Stage-1 on hard-no outputs.
 *
 * Resolution rules (strict, fail-closed):
 *   - HARD-NO + zero terminalFlags          → FINAL_REJECTED
 *   - any TERMINAL flag                     → FINAL_REJECTED
 *   - any unknown / TODO flag               → FINAL_REJECTED  (fail-safe)
 *   - all flags explicitly RESCUABLE        → RESCUED_CONDITIONAL
 *     (requires flags.length > 0 AND flags.every(isRescuable) — non-empty guard)
 *   - rescue can never produce APPROVED
 *
 * Current policy (from rescuePolicy.ts):
 *   default_risk = RESCUABLE
 *   all others   = TERMINAL
 *
 * Sensitivity scores:
 *   All five default_risk dimensions are qualitative-only (dataUnavailable: true)
 *   because no structured financial source fields exist on the deal/variant record.
 *   See Part A provenance report — do NOT add numeric values without a structured source.
 *
 * GUARDRAILS (never violate):
 *   - Never soften Stage 1
 *   - Never rescue unknown blockers
 *   - Never rescue empty terminalFlags
 *   - Never upgrade above CONDITIONAL
 *   - Never parse prose for rescue logic
 *   - Never infer terminal flags from text
 *   - Never fabricate financial precision
 */

import {
  rescuePolicy,
  TERMINAL_BLOCKER_FLAGS,
  TERMINAL_FLAGS,
  type TerminalBlockerFlag,
} from "./lib/rescuePolicy";

// ── Output types ──────────────────────────────────────────────────────────────

export type DeltaRescueStatus = "RESCUED_CONDITIONAL" | "FINAL_REJECTED";

/**
 * A single sensitivity dimension for default_risk.
 * All five dimensions are qualitative-only (dataUnavailable: true) until
 * structured financial source fields are added to the deal/variant record.
 */
export interface DeltaSensitivityScore {
  dimension: string;
  /** Structured numeric value — null when dataUnavailable */
  currentValue: number | null;
  /** Structured threshold — null when dataUnavailable */
  thresholdValue: number | null;
  /** Structured headroom — null when dataUnavailable */
  headroom: number | null;
  /** Qualitative severity label */
  severity: "unknown" | "low" | "moderate" | "high" | "critical";
  /** Direction of risk */
  direction: "deteriorating" | "stable" | "improving" | "unknown";
  /** Qualitative explanation — always present */
  explanation: string;
  /**
   * dataUnavailable: true when no structured source exists.
   * Consumers MUST NOT display numeric precision when this is true.
   */
  dataUnavailable: boolean;
}

/**
 * Output of the Delta Engine for a single hard-no variant.
 */
export interface DeltaEngineResult {
  /** Index of the originating ScenarioVariant */
  variantIndex: number;

  /** RESCUED_CONDITIONAL or FINAL_REJECTED */
  rescueStatus: DeltaRescueStatus;

  /**
   * Structured terminal flags from the variant provenance.
   * Never derived from prose.
   */
  triggeringFlags: TerminalBlockerFlag[];

  /**
   * Mitigation from rescuePolicy — only present for RESCUED_CONDITIONAL.
   * null for FINAL_REJECTED.
   */
  mitigation: string | null;

  /**
   * Residual risk from rescuePolicy — always present.
   */
  residualRisk: string;

  /**
   * Sensitivity scores for each relevant dimension.
   * For default_risk: five qualitative-only dimensions (dataUnavailable: true).
   * Empty array for non-default_risk FINAL_REJECTED variants.
   */
  sensitivityScores: DeltaSensitivityScore[];

  /**
   * For FINAL_REJECTED: explains why rescue failed.
   * For RESCUED_CONDITIONAL: null.
   */
  rejectionReason: string | null;

  /**
   * For FINAL_REJECTED with mixed flags: lists any rescuable flags that were
   * overridden by a co-occurring terminal flag.
   */
  rescuableOverriddenBy: TerminalBlockerFlag[];

  /**
   * True when terminalFlags were null/missing at evaluation time.
   * Consumers MUST NOT display this as a confident FINAL_REJECTED verdict.
   * Surface as "Attribution unavailable" instead.
   */
  attributionUnavailable?: boolean;
}

// ── Qualitative sensitivity scores for default_risk ───────────────────────────
//
// Part A provenance finding: all five metrics have NO STRUCTURED SOURCE.
// These scores are qualitative-only. dataUnavailable: true on all five.
// Do NOT add numeric values here without a structured source field.

const DEFAULT_RISK_SENSITIVITY_SCORES: DeltaSensitivityScore[] = [
  {
    dimension: "debt-service headroom",
    currentValue: null,
    thresholdValue: null,
    headroom: null,
    severity: "unknown",
    direction: "unknown",
    explanation:
      "Debt-service coverage ratio (DSCR) is not available as a structured field. " +
      "Qualitative assessment only: default_risk flag indicates debt-service stress is present.",
    dataUnavailable: true,
  },
  {
    dimension: "covenant headroom",
    currentValue: null,
    thresholdValue: null,
    headroom: null,
    severity: "unknown",
    direction: "unknown",
    explanation:
      "Covenant headroom is not available as a structured field. " +
      "Qualitative assessment only: default_risk flag indicates covenant stress is possible.",
    dataUnavailable: true,
  },
  {
    dimension: "restructuring gap",
    currentValue: null,
    thresholdValue: null,
    headroom: null,
    severity: "unknown",
    direction: "unknown",
    explanation:
      "Restructuring gap (equity shortfall vs. required restructuring) is not available " +
      "as a structured field. Qualitative assessment only.",
    dataUnavailable: true,
  },
  {
    dimension: "security / collateral adequacy",
    currentValue: null,
    thresholdValue: null,
    headroom: null,
    severity: "unknown",
    direction: "unknown",
    explanation:
      "Collateral value and LTV are not available as structured fields. " +
      "Qualitative assessment only: security package adequacy cannot be confirmed without structured data.",
    dataUnavailable: true,
  },
  {
    dimension: "counterparty-cooperation dependency",
    currentValue: null,
    thresholdValue: null,
    headroom: null,
    severity: "unknown",
    direction: "unknown",
    explanation:
      "Counterparty cooperation score is not available as a structured field. " +
      "Qualitative assessment only: restructuring conditional on counterparty agreement to revised terms.",
    dataUnavailable: true,
  },
];

// ── Resolution logic ──────────────────────────────────────────────────────────

/**
 * isRescuable — returns true ONLY if the flag is explicitly RESCUABLE in rescuePolicy.
 * Unknown flags, TODO flags, and TERMINAL flags all return false (fail-closed).
 */
function isRescuable(flag: string): flag is TerminalBlockerFlag {
  if (!TERMINAL_BLOCKER_FLAGS.includes(flag as TerminalBlockerFlag)) {
    // Unknown flag — not in the enum → TERMINAL (fail-safe)
    return false;
  }
  const entry = rescuePolicy[flag as TerminalBlockerFlag];
  // TODO verdict → TERMINAL (fail-safe per rescuePolicy design)
  return entry.verdict === "RESCUABLE";
}

/**
 * runDeltaEngine — evaluate a single hard-no variant.
 *
 * PRECONDITION: variant.hasHardNo === true.
 * Do NOT call this for PASS variants.
 *
 * @param variantIndex  Index of the originating ScenarioVariant
 * @param hardNoTriggers  The hardNoTriggers from ScenarioVariant.provenance (dimension keys)
 * @param terminalFlags  Structured terminalFlags from the deal/council result
 */
export function runDeltaEngine(
  variantIndex: number,
  hardNoTriggers: string[],
  /**
   * Structured terminalFlags from the deal/council result.
   * null  → ATTRIBUTION_UNAVAILABLE: field absent/unloaded/pre-field DB row.
   *          Do NOT silently produce FINAL_REJECTED; surface unavailability explicitly.
   * []    → Genuinely empty: explicitly known to have zero terminal flags.
   *          Hard-no final-rejects per non-empty guard (DE-4).
   * [...] → Real structured flags: evaluate rescue eligibility normally.
   */
  terminalFlags: string[] | null
): DeltaEngineResult {
  // ── Rule 0: null terminalFlags → ATTRIBUTION_UNAVAILABLE ───────────────────
  // null means the field was absent, unloaded, or dropped by a reconstruction path.
  // This is NOT equivalent to empty []. Do NOT silently produce FINAL_REJECTED.
  if (terminalFlags === null) {
    return {
      variantIndex,
      rescueStatus: "FINAL_REJECTED",
      triggeringFlags: [],
      mitigation: null,
      residualRisk:
        "ATTRIBUTION_UNAVAILABLE: terminalFlags field was absent, unloaded, or not reconstructed. " +
        "Rescue eligibility cannot be evaluated. " +
        "This is NOT a confident FINAL_REJECTED verdict — it is an attribution gap.",
      sensitivityScores: [],
      rejectionReason: "ATTRIBUTION_UNAVAILABLE: terminalFlags null/missing. Not a confident rejection.",
      rescuableOverriddenBy: [],
      attributionUnavailable: true,
    };
  }

  // ── Normalize flags to known TerminalBlockerFlag values ─────────────────────
  // We work from terminalFlags (structured, from rescuePolicy/council output).
  // hardNoTriggers are perturbation dimension keys (e.g. "debt_severe") —
  // they are NOT the same as TerminalBlockerFlag values.
  // The rescue decision is keyed on terminalFlags, not hardNoTriggers.

  const knownFlags: TerminalBlockerFlag[] = terminalFlags.filter(
    (f): f is TerminalBlockerFlag => TERMINAL_BLOCKER_FLAGS.includes(f as TerminalBlockerFlag)
  );
  const unknownFlags = terminalFlags.filter(
    f => !TERMINAL_BLOCKER_FLAGS.includes(f as TerminalBlockerFlag)
  );

  // ── Rule 1: empty terminalFlags → FINAL_REJECTED ─────────────────────────
  // Empty array must not be vacuously rescued (non-empty guard).
  if (terminalFlags.length === 0) {
    return {
      variantIndex,
      rescueStatus: "FINAL_REJECTED",
      triggeringFlags: [],
      mitigation: null,
      residualRisk:
        "Hard-no triggered with no structured terminal flags. " +
        "Cannot determine rescue eligibility without structured flag data. " +
        "Fail-closed: treated as FINAL_REJECTED.",
      sensitivityScores: [],
      rejectionReason:
        "HARD-NO with empty terminalFlags. Non-empty guard prevents vacuous rescue.",
      rescuableOverriddenBy: [],
    };
  }

  // ── Rule 2: any unknown flag → FINAL_REJECTED ────────────────────────────
  if (unknownFlags.length > 0) {
    return {
      variantIndex,
      rescueStatus: "FINAL_REJECTED",
      triggeringFlags: knownFlags,
      mitigation: null,
      residualRisk:
        `Unknown terminal flag(s) present: ${unknownFlags.join(", ")}. ` +
        "Unknown flags are treated as TERMINAL (fail-safe). " +
        "Resolve the unknown flag before any rescue evaluation.",
      sensitivityScores: [],
      rejectionReason:
        `Unknown / unrecognised flag(s): ${unknownFlags.join(", ")}. Fail-closed.`,
      rescuableOverriddenBy: [],
    };
  }

  // ── Rule 3: any TERMINAL flag → FINAL_REJECTED ───────────────────────────
  const terminalPresent = knownFlags.filter(f => TERMINAL_FLAGS.has(f));
  const rescuablePresent = knownFlags.filter(f => !TERMINAL_FLAGS.has(f));

  if (terminalPresent.length > 0) {
    // Identify any rescuable flags that are overridden by the terminal co-occurrence
    return {
      variantIndex,
      rescueStatus: "FINAL_REJECTED",
      triggeringFlags: knownFlags,
      mitigation: null,
      residualRisk: terminalPresent
        .map(f => rescuePolicy[f].residualRisk)
        .join(" | "),
      sensitivityScores: [],
      rejectionReason:
        `Terminal blocker(s) present: ${terminalPresent.map(f => f.toUpperCase()).join(", ")}. ` +
        "Terminal flags cannot be rescued at deal level.",
      rescuableOverriddenBy: rescuablePresent,
    };
  }

  // ── Rule 4: all flags RESCUABLE → RESCUED_CONDITIONAL ────────────────────
  // Requires flags.length > 0 (already checked above) AND every flag isRescuable.
  const allRescuable = knownFlags.every(f => isRescuable(f));

  if (allRescuable) {
    // Aggregate mitigation and residualRisk from all rescuable flags
    const mitigations = knownFlags
      .map(f => rescuePolicy[f].mitigation)
      .filter((m): m is string => m !== null);
    const residualRisks = knownFlags.map(f => rescuePolicy[f].residualRisk);

    return {
      variantIndex,
      rescueStatus: "RESCUED_CONDITIONAL",
      triggeringFlags: knownFlags,
      mitigation: mitigations.join(" | ") || null,
      residualRisk: residualRisks.join(" | "),
      sensitivityScores: DEFAULT_RISK_SENSITIVITY_SCORES,
      rejectionReason: null,
      rescuableOverriddenBy: [],
    };
  }

  // ── Fallback: fail-closed ─────────────────────────────────────────────────
  // Should not be reachable given the rules above, but fail-closed as a backstop.
  return {
    variantIndex,
    rescueStatus: "FINAL_REJECTED",
    triggeringFlags: knownFlags,
    mitigation: null,
    residualRisk: "Rescue eligibility could not be confirmed. Fail-closed.",
    sensitivityScores: [],
    rejectionReason: "Rescue eligibility could not be confirmed (fallback fail-closed).",
    rescuableOverriddenBy: [],
  };
}
