/**
 * rescuePolicy.ts — Single source of truth for terminal-blocker classification.
 *
 * SHARED ENUM: TerminalBlockerFlag is the ONE namespace used end-to-end:
 *   - Council persona votes emit terminal blockers using EXACTLY these identifiers
 *   - codeClassification reads these identifiers from input.terminalFlags
 *   - rescuePolicy is keyed on these identifiers
 *
 * No mapping/translation layer exists between council output and classification input.
 *
 * FAIL-SAFE DEFAULT: any flag not present in this table, or with verdict "TODO",
 * is treated as TERMINAL. Default branch is REJECTED, never allow.
 * This means unresolved TODOs are institutionally conservative until explicitly decided.
 */

// ── Shared enum ───────────────────────────────────────────────────────────────

export const TERMINAL_BLOCKER_FLAGS = [
  "fraud",
  "capital_controls",
  "licence_revoked",
  "sanctions",
  "regulatory_blocked",
  "financial_crisis",
  "default_risk",
] as const;

export type TerminalBlockerFlag = (typeof TERMINAL_BLOCKER_FLAGS)[number];

// ── Rescue verdict types ──────────────────────────────────────────────────────

export type RescueVerdict = "TERMINAL" | "RESCUABLE" | "TODO";

export interface RescuePolicyEntry {
  verdict: RescueVerdict;
  /**
   * mitigation: null for TERMINAL (no mitigation can rescue this deal).
   * For RESCUABLE, a concise description of the required structural change.
   * For TODO, null until the institution decides.
   */
  mitigation: string | null;
  /**
   * residualRisk: human-readable description of the irreducible risk even after mitigation.
   * Always present for TERMINAL to explain why no rescue is possible.
   */
  residualRisk: string;
}

// ── Static rescue policy table ────────────────────────────────────────────────

export const rescuePolicy: Record<TerminalBlockerFlag, RescuePolicyEntry> = {
  fraud: {
    verdict: "TERMINAL",
    mitigation: null,
    residualRisk:
      "Fraud allegation or adverse audit opinion creates irreversible credibility loss. " +
      "No structural change can restore institutional trust within a deal cycle. " +
      "A from-scratch resubmission with clean audited financials is the only path.",
  },
  capital_controls: {
    verdict: "TERMINAL",
    mitigation: null,
    residualRisk:
      "Sovereign capital controls prevent exit repatriation. " +
      "No deal-level restructuring can override a government restriction on capital flows. " +
      "Resolution requires regulatory change at the sovereign level.",
  },
  licence_revoked: {
    verdict: "TERMINAL",
    mitigation: null,
    residualRisk:
      "Operating licence revocation removes the legal basis for the business. " +
      "No financial restructuring is viable without a valid licence. " +
      "Reinstatement must precede any resubmission.",
  },
  sanctions: {
    verdict: "TERMINAL",
    mitigation: null,
    residualRisk:
      "Active sanctions exposure creates legal and reputational risk that cannot be " +
      "mitigated at the deal level. Participation would violate compliance policy. " +
      "Resolution requires full sanctions clearance before any engagement.",
  },
  regulatory_blocked: {
    verdict: "TODO",
    mitigation: null,
    residualRisk:
      "TODO: Institutional decision pending on whether regulatory block is rescuable " +
      "(e.g., pending approval vs. denied approval). Until decided, treated as TERMINAL.",
  },
  financial_crisis: {
    verdict: "TODO",
    mitigation: null,
    residualRisk:
      "TODO: Institutional decision pending on whether systemic financial crisis " +
      "is rescuable (e.g., temporary liquidity vs. structural insolvency). " +
      "Until decided, treated as TERMINAL.",
  },
  default_risk: {
    verdict: "TODO",
    mitigation: null,
    residualRisk:
      "TODO: Institutional decision pending on whether default risk is rescuable " +
      "(e.g., covenant breach vs. actual default). Until decided, treated as TERMINAL.",
  },
};

// ── Derived TERMINAL_FLAGS set ────────────────────────────────────────────────
// NEVER hand-maintain a second list. Always derive from rescuePolicy.
// FAIL-SAFE: "TODO" verdict is treated as TERMINAL (conservative default).

export const TERMINAL_FLAGS: ReadonlySet<TerminalBlockerFlag> = new Set(
  (Object.entries(rescuePolicy) as [TerminalBlockerFlag, RescuePolicyEntry][])
    .filter(([, v]) => v.verdict === "TERMINAL" || v.verdict === "TODO")
    .map(([k]) => k)
);

// ── Classification derivation ─────────────────────────────────────────────────

/**
 * deriveClassification — code-side, deterministic, keyed off structured terminalFlags.
 *
 * C: ANY flag in terminalFlags is in TERMINAL_FLAGS (includes TODO → TERMINAL by default)
 * B: flags exist but NONE are terminal (all are explicitly RESCUABLE)
 * A: no terminal flags present (clean deal, framing/structuring only)
 *
 * NOTE: A/B distinction is currently deferred — all non-C deals return "B".
 * Guard 4 (ceiling cap) is the BACKSTOP for the B-default: it caps B at
 * APPROVED_WITH_CONDITIONS, so the B default can NEVER leak an APPROVE.
 * Do NOT remove Guard 4 believing B is independently safe — it is not.
 */
export function deriveClassification(
  terminalFlags: string[]
): "A" | "B" | "C" {
  // Any flag not in the TERMINAL_BLOCKER_FLAGS enum is treated as unknown → TERMINAL (fail-safe)
  for (const flag of terminalFlags) {
    const knownFlag = flag as TerminalBlockerFlag;
    if (
      TERMINAL_FLAGS.has(knownFlag) ||
      !TERMINAL_BLOCKER_FLAGS.includes(knownFlag)
    ) {
      return "C";
    }
  }
  // A/B deferred — all non-terminal deals are B until institution decides.
  // BACKSTOP: Guard 4 in fixTheDeal caps B at APPROVED_WITH_CONDITIONS.
  return "B";
}
