// ─────────────────────────────────────────────────────────────────────────────
// CapTwin — RegInterceptor: Deterministic Compliance Gate
// Scans all generated pitches and terms before output.
// ─────────────────────────────────────────────────────────────────────────────

import type { LimitedPartner } from "./lpRegistry";
import type { FundParams } from "./capTwinEngine";

export type ComplianceSeverity = "BLOCK" | "WARN" | "OK";

export interface ComplianceFlag {
  rule: string;
  severity: ComplianceSeverity;
  message: string;
  detail: string;
}

export interface ComplianceReport {
  passed: boolean;
  flags: ComplianceFlag[];
  summary: string;
}

// ── Blocked phrases for SEC Rule 506(b) ──────────────────────────────────────
const SEC_506B_BLOCKED_PHRASES = [
  "public offering",
  "retail crowd",
  "advertisement",
  "open to everyone",
  "general solicitation",
  "publicly advertised",
  "open to the public",
  "crowdfund",
];

// ── EU AIFMD passporting disclosure keywords (must be present for EU LPs) ───
const AIFMD_REQUIRED_PHRASES = [
  "aifmd",
  "passporting",
  "alternative investment fund",
  "article 8",
  "article 9",
  "sfdr",
  "sustainable finance",
];

/**
 * Scan pitch text and fund params against all compliance rules.
 */
export function runComplianceCheck(
  pitchText: string,
  params: FundParams,
  lp: LimitedPartner
): ComplianceReport {
  const flags: ComplianceFlag[] = [];
  const lowerPitch = pitchText.toLowerCase();

  // ── SEC Rule 506(b): Block solicitation phrases ───────────────────────────
  if (lp.complianceFlags.includes("sec-506b")) {
    for (const phrase of SEC_506B_BLOCKED_PHRASES) {
      if (lowerPitch.includes(phrase)) {
        flags.push({
          rule: "SEC Rule 506(b)",
          severity: "BLOCK",
          message: `Blocked phrase detected: "${phrase}"`,
          detail:
            "SEC Rule 506(b) prohibits general solicitation. Remove all public-offering language before distribution.",
        });
      }
    }
  }

  // ── EU AIFMD: Warn if marketing to EU LP without passporting disclosure ───
  if (lp.complianceFlags.includes("eu-aifmd")) {
    const hasDisclosure = AIFMD_REQUIRED_PHRASES.some((p) => lowerPitch.includes(p));
    if (!hasDisclosure) {
      flags.push({
        rule: "EU AIFMD",
        severity: "WARN",
        message: "AIFMD passporting disclosure absent",
        detail:
          "Marketing to EU pension funds requires AIFMD passporting documentation and SFDR sustainability risk disclosures. Add Article 8/9 classification and passporting statement.",
      });
    }
  }

  // ── Kuwait CMA: Enforce minimum ticket KWD 100,000 (~USD 325,000) ─────────
  if (lp.complianceFlags.includes("kuwait-cma")) {
    const KWD_MIN_USD = 0.325; // KWD 100,000 ≈ USD 325,000 = $0.325M
    if (params.targetCapital < KWD_MIN_USD) {
      flags.push({
        rule: "Kuwait CMA",
        severity: "BLOCK",
        message: `Ticket below Kuwait CMA minimum (KWD 100,000 / ~USD 325,000)`,
        detail:
          "Kuwait Capital Markets Authority requires a minimum transaction ticket of KWD 100,000 for institutional placements. Adjust target capital or exclude this LP.",
      });
    }
    // Warn if no Sharia structure mentioned for GCC LP
    if (lp.shariaRequired && !lowerPitch.includes("murabaha") && !lowerPitch.includes("ijara") && !lowerPitch.includes("sharia")) {
      flags.push({
        rule: "Kuwait CMA / AAOIFI",
        severity: "WARN",
        message: "No Sharia-compliant structure referenced in pitch",
        detail:
          "Gulf Investment GIC requires Murabaha or Ijara structuring. Reference AAOIFI-compliant instruments explicitly.",
      });
    }
  }

  // ── ESG: Warn if high-ESG LP and no ESG language ─────────────────────────
  if (lp.esgPriority >= 8) {
    const hasESG =
      lowerPitch.includes("esg") ||
      lowerPitch.includes("sustainability") ||
      lowerPitch.includes("responsible") ||
      lowerPitch.includes("impact");
    if (!hasESG) {
      flags.push({
        rule: "ESG Disclosure",
        severity: "WARN",
        message: "No ESG language detected for high-ESG LP",
        detail: `${lp.name} has ESG priority ${lp.esgPriority}/10. Include sustainability framework, ESG integration methodology, and Article 8/9 classification.`,
      });
    }
  }

  const hasBlock = flags.some((f) => f.severity === "BLOCK");
  const summary = hasBlock
    ? `BLOCKED — ${flags.filter((f) => f.severity === "BLOCK").length} compliance violation(s) must be resolved before distribution.`
    : flags.length > 0
    ? `CONDITIONAL — ${flags.filter((f) => f.severity === "WARN").length} warning(s) require attention before final distribution.`
    : "CLEARED — No compliance issues detected.";

  return {
    passed: !hasBlock,
    flags,
    summary,
  };
}
