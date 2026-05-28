/**
 * dealScreenerAdversarial.ts
 *
 * Adversarial Consensus + Dynamic Scaling layer for the Deal Screener.
 * Wraps runCouncil() — minimal additive changes to councilEngine.ts only.
 *
 * Features:
 *   1. Veto Mechanism      — extended veto beyond existing gccVetoTriggered
 *   2. Dynamic Scaling     — Phase 1: LOW/MEDIUM/HIGH → 4/6/10 agents
 *                            Phase 2: second-stage escalation if base result shows material risk
 *   3. Challenger–Prover   — challenger agent IDs passed to councilEngine wrapper
 *   4. Contribution Track  — per-run in-memory agent contribution scoring
 *   5. Decision Integrity  — structured output for UI (challenges, surviving claims, veto reason)
 *
 * SCOPE: Deal Screener ONLY. UAE Real Estate, GCC Equities, AI Audit untouched.
 */

import { runCouncil, getPersonasForMode } from "./councilEngine";
import type { CouncilResult, PersonaVote, RunCouncilOptions, VerdictType } from "./councilEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AdversarialChallenge {
  agentId:   string;
  agentName: string;
  objection: string; // first sentence of rationale from challenger agent
}

export interface AdversarialClaim {
  agentId:   string;
  agentName: string;
  claim:     string; // first sentence of rationale from proposer agent that survived
}

export interface DecisionIntegrity {
  challengesRaised:  AdversarialChallenge[]; // max 3
  survivingClaims:   AdversarialClaim[];     // max 3
  vetoTriggered:     boolean;
  vetoReason:        string | null;          // single clear sentence
  unresolvedObjection: boolean;              // true if a challenger raised HARD_NO with no proposer rebuttal
  riskLevel:         RiskLevel;
  agentsRun:         number;
  agentContributions: AgentContribution[];
  disagreementCount: number;  // agents whose vote direction differs from final verdict
  runtimeMs:         number;       // total council wall-clock time in ms
}

export interface AgentContribution {
  agentId:            string;
  agentName:          string;
  contribution:       "HIGH" | "MEDIUM" | "LOW";
  newSignal:          boolean; // raised a flag not mentioned by any other agent
  influencedDecision: boolean; // was a veto/tiebreaker agent that swung the verdict
  triggeredChallenge: boolean; // was in challenger role and raised a blocker
}

export interface AdversarialCouncilResult extends CouncilResult {
  decisionIntegrity: DecisionIntegrity;
}

// ── Challenger / Proposer agent ID maps per council mode ─────────────────────

const CHALLENGER_IDS: Record<string, string[]> = {
  gcc:            ["SKEPTIC", "GCC_REG", "DEVILS_ADVOCATE"],
  global_vc:      ["VC_SKEPTIC", "VC_LEGAL", "VC_CONTRARIAN"],
  india_pe:       ["IN_SKEPTIC", "IN_LEGAL", "IN_DEVILS_ADVOCATE"],
  infrastructure: ["INFRA_SKEPTIC", "INFRA_REGULATORY", "INFRA_EPC"],
};

/**
 * Agents that can trigger a solo veto (legal, compliance, regulatory, shariah).
 * The Skeptic and Contrarian are NOT in this set — they require 2+ HARD_NOs.
 */
const HARD_VETO_AGENTS: Record<string, string[]> = {
  gcc:            ["GCC_REG", "GCC_SHARIAH"],
  global_vc:      ["VC_LEGAL"],
  india_pe:       ["IN_LEGAL"],
  gcc_equities:   ["GCC_EQ_REG", "GCC_EQ_SHARIAH"],
  infrastructure: ["INFRA_REGULATORY"],  // Regulatory & Permitting Counsel has solo veto power
// Intentionally excluded: INFRA_SKEPTIC, INFRA_EPC — these require 2+ HARD_NOs
};

const PROPOSER_IDS: Record<string, string[]> = {
  gcc:            ["ANALYST", "CFO", "MACRO", "GCC_CONSUMER"],
  global_vc:      ["VC_THESIS", "VC_FOUNDER", "VC_PRODUCT", "VC_CFO", "VC_MARKET"],
  india_pe:       ["IN_ANALYST", "IN_CFO", "IN_MARKET", "IN_MACRO"],
  infrastructure: ["INFRA_PROJECT_FINANCE", "INFRA_OFFTAKE", "INFRA_IRR", "INFRA_CONTRARIAN"],
};

// Agents that always run regardless of risk level (core minimum)
const CORE_AGENT_IDS: Record<string, string[]> = {
  gcc:            ["ANALYST", "CFO", "SKEPTIC", "GCC_REG"],
  global_vc:      ["VC_THESIS", "VC_CFO", "VC_SKEPTIC", "VC_LEGAL"],
  india_pe:       ["IN_ANALYST", "IN_CFO", "IN_SKEPTIC", "IN_LEGAL"],
  infrastructure: ["INFRA_PROJECT_FINANCE", "INFRA_REGULATORY", "INFRA_SKEPTIC", "INFRA_OFFTAKE"],
};

// Agents added at MEDIUM risk
const MEDIUM_AGENT_IDS: Record<string, string[]> = {
  gcc:            ["MACRO", "GCC_CONSUMER"],
  global_vc:      ["VC_FOUNDER", "VC_PRODUCT"],
  india_pe:       ["IN_MARKET", "IN_MACRO"],
  infrastructure: ["INFRA_EPC", "INFRA_TECH"],
};

// ── 1. Risk Estimator (input completeness only) ───────────────────────────────

/**
 * Infrastructure-mode risk estimator.
 * Uses DSCR / CfD / EPC / FOAK / merchant exposure signals.
 * VC-specific signals (founder, valuation, seed, runway, revenue multiples) are suppressed.
 */
export function estimateRiskLevelInfrastructure(dealText: string): RiskLevel {
  let score = 0;

  // Missing critical infrastructure fields
  const missingSignals = [
    !/(dscr|debt.?service.?cover)/i.test(dealText),
    !/(cfd|contract.?for.?difference|strike.?price|offtake)/i.test(dealText),
    !/(epc|engineering.?procurement.?construction|contractor)/i.test(dealText),
  ].filter(Boolean).length;
  score += missingSignals;

  // FOAK / technology maturity risk
  if (/(foak|first.?of.?a.?kind|pilot.?scale|trl.?[1-5]|prototype)/i.test(dealText)) score += 2;

  // Merchant / subsidy exposure risk
  if (/(merchant.?exposure|no.?cfd|subsidy.?free|uncontracted|merchant.?risk)/i.test(dealText)) score += 2;

  // Open-book / lump-sum EPC risk
  if (/(open.?book|cost.?plus|no.?fixed.?price|epc.?not.?signed)/i.test(dealText)) score += 2;

  // Floating foundation / deep-water risk
  if (/(floating|semi.?sub|spar|tlp|70.?m|80.?m|90.?m|deep.?water)/i.test(dealText)) score += 1;

  // LCOE above CfD strike (explicit mention)
  if (/(lcoe.*(above|exceed|higher than).*cfd|cfd.*(below|less than).*lcoe)/i.test(dealText)) score += 2;

  // Regulatory / permitting risk
  if (/(permit.?not.?granted|planning.?risk|regulatory.?uncertainty|grid.?connection.?risk)/i.test(dealText)) score += 1;

  // Positive signals that reduce risk
  if (/(cfd.?awarded|cfd.?secured|signed.?epc|lump.?sum.?epc|financial.?close|fc.?achieved)/i.test(dealText)) score -= 1;
  if (/(dscr.*[12]\.[5-9]|dscr.*[2-9]\.|investment.?grade.?rating)/i.test(dealText)) score -= 1;

  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

export function estimateRiskLevel(dealText: string, mode?: string): RiskLevel {
  if (mode === "infrastructure") return estimateRiskLevelInfrastructure(dealText);
  let score = 0;

  // Missing critical fields (VC / general mode)
  const missingSignals = [
    !/(revenue|arr|mrr|\$[\d]|aed[\d]|kwd[\d]|usd[\d])/i.test(dealText),
    !/(founder|ceo|team|management)/i.test(dealText),
    !/(valuation|asking|price|multiple)/i.test(dealText),
  ].filter(Boolean).length;
  score += missingSignals;

  // Off-plan + early stage
  if (/(off.?plan|pre.?launch|under construction|not yet built)/i.test(dealText)) score += 2;
  if (/(seed|pre.?seed|idea stage|concept)/i.test(dealText)) score += 1;

  // Price deviation signals
  if (/(overpriced|above market|premium pricing|high valuation|stretched)/i.test(dealText)) score += 1;

  // High-value property / large deal
  if (/(aed [5-9]\d{6,}|aed [1-9]\d{7,}|\$[5-9]m|\$[1-9]\d{1,}m|kwd [5-9]\d{5,})/i.test(dealText)) score += 1;

  // Regulatory / sanctions / legal flags
  if (/(sanction|lawsuit|litigation|regulatory action|compliance issue)/i.test(dealText)) score += 2;

  // Positive signals that reduce risk
  if (/(audited|verified|escrow|licensed|regulated|track record)/i.test(dealText)) score -= 1;

  if (score >= 4) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}

// ── 2. Dynamic Agent Subset ───────────────────────────────────────────────────

export function getAgentSubset(
  mode: string,
  riskLevel: RiskLevel,
): string[] | null {
  // HIGH = full council (null = don't filter)
  if (riskLevel === "HIGH") return null;

  const core   = CORE_AGENT_IDS[mode]   ?? [];
  const medium = MEDIUM_AGENT_IDS[mode] ?? [];

  if (riskLevel === "LOW")    return core;
  if (riskLevel === "MEDIUM") return [...core, ...medium];
  return null;
}

// ── 3. Second-stage Escalation Check ─────────────────────────────────────────

/**
 * Checks whether the Phase 1 council result warrants escalation to HIGH risk.
 * Separates "input completeness" (estimateRiskLevel) from "decision risk".
 * A well-written but fundamentally bad deal escalates here, not in estimateRiskLevel.
 * Infrastructure mode uses DSCR/CfD/EPC escalation signals instead of VC signals.
 */
function shouldEscalate(result: CouncilResult, dealText: string, mode?: string): boolean {
  // 1. High hard-no count (universal)
  if (result.hardNoCount >= 3) return true;

  // 2. Veto triggered by base council (universal)
  if (result.gccVetoTriggered) return true;

  // 3. Compliance / regulatory HARD_NO in votes (universal)
  const complianceHardNo = result.votes.some(
    (v) => v.vote === "HARD_NO" &&
      /(regulatory|compliance|license|legal|sanction|permit)/i.test(v.rationale)
  );
  if (complianceHardNo) return true;

  if (mode === "infrastructure") {
    // Infrastructure-specific escalation signals — no VC signals
    // DSCR below investment grade in rationale
    const dscrRisk = result.votes.some(
      (v) => v.vote === "HARD_NO" &&
        /(dscr|debt.?service|lcoe|cfd|epc|foundation|merchant|offtake)/i.test(v.rationale)
    );
    if (dscrRisk) return true;

    // FOAK / technology risk explicitly flagged
    if (/(foak|first.?of.?a.?kind|trl.?[1-4])/i.test(dealText)) return true;

    // Unresolved critical objection (universal)
    const hardNos = result.votes.filter((v) => v.vote === "HARD_NO");
    const hardYes = result.votes.filter((v) => v.vote === "HARD_YES");
    if (hardNos.length >= 2 && hardYes.length === 0) return true;

    return false;
  }

  // VC / general mode escalation signals
  // 4. Runway < 6 months signal in deal text
  const runwayMatch = dealText.match(/(\d+)\s*month[s]?\s*(runway|of\s*runway|remaining)/i);
  if (runwayMatch && parseInt(runwayMatch[1]) < 6) return true;

  // 5. Extreme valuation multiple signal (e.g. "50x revenue")
  if (/(\d{2,3})x\s*(revenue|arr|mrr|multiple)/i.test(dealText)) return true;

  // 6. Unresolved critical objection: multiple HARD_NOs with zero HARD_YES anywhere
  const hardNos    = result.votes.filter((v) => v.vote === "HARD_NO");
  const hardYes    = result.votes.filter((v) => v.vote === "HARD_YES");
  if (hardNos.length >= 2 && hardYes.length === 0) return true;

  return false;
}

// ── 4. Extended Veto Logic ────────────────────────────────────────────────────

interface VetoCheckResult {
  triggered: boolean;
  reason:    string | null;
  forceVerdict: VerdictType | null;
}

function checkExtendedVeto(
  votes: PersonaVote[],
  existingVetoTriggered: boolean,
  mode: string,
): VetoCheckResult {
  // Already vetoed by base engine
  if (existingVetoTriggered) {
    const vetoAgent = votes.find(
      (v) => v.vote === "HARD_NO" && (CHALLENGER_IDS[mode] ?? []).includes(v.personaId)
    );
    return {
      triggered: true,
      reason: vetoAgent
        ? `${vetoAgent.personaName}: ${vetoAgent.rationale.split(".")[0]}.`
        : "Veto triggered by council.",
      forceVerdict: "VETOED",
    };
  }

  // Extended veto rule 1: 2+ challenger agents vote HARD_NO with high confidence
  const challengerIds = new Set(CHALLENGER_IDS[mode] ?? []);
  const challengerHardNos = votes.filter(
    (v) => challengerIds.has(v.personaId) && v.vote === "HARD_NO" && v.confidence >= 0.75
  );
  if (challengerHardNos.length >= 2) {
    const primary = challengerHardNos[0];
    return {
      triggered: true,
      reason: `${primary.personaName}: ${primary.rationale.split(".")[0]}. (${challengerHardNos.length} challenger agents raised HARD_NO.)`,
      forceVerdict: "VETOED",
    };
  }
  // Extended veto rule 2: a HARD_VETO_AGENT (legal/compliance/shariah/regulatory) votes HARD_NO
  // The Skeptic and Contrarian are NOT in this set — they require 2+ HARD_NOs to veto.
  const hardVetoAgentIds = new Set(HARD_VETO_AGENTS[mode] ?? []);
  const hardVetoHardNo = votes.find(
    (v) => hardVetoAgentIds.has(v.personaId) && v.vote === "HARD_NO" && v.confidence >= 0.8
  );
  if (hardVetoHardNo) {
    return {
      triggered: true,
      reason: `${hardVetoHardNo.personaName}: ${hardVetoHardNo.blockers[0] ?? hardVetoHardNo.rationale.split(".")[0]}`,
      forceVerdict: "VETOED",
    };
  }
  // A single Skeptic/Contrarian HARD_NO creates an unresolved objection but does NOT veto alone.
  // It is captured in Decision Integrity and reduces confidence, but forceVerdict stays null.
  return { triggered: false, reason: null, forceVerdict: null };
}

// ── 5. Agent Contribution Tracking ───────────────────────────────────────────

function computeContributions(
  votes: PersonaVote[],
  challengerIds: string[],
  tiebreakerSwingAgent: string | null,
  vetoTriggered: boolean,
): AgentContribution[] {
  const challengerSet = new Set(challengerIds);

  // Collect all unique flags across all agents
  const flagCounts = new Map<string, number>();
  for (const v of votes) {
    for (const f of v.keyFlags) {
      const key = f.trim().toLowerCase();
      flagCounts.set(key, (flagCounts.get(key) ?? 0) + 1);
    }
  }

  return votes.map((v) => {
    const isChallenger = challengerSet.has(v.personaId);
    const triggeredChallenge = isChallenger && (v.vote === "HARD_NO" || v.vote === "SOFT_NO") && v.blockers.length > 0;
    const influencedDecision =
      v.personaId === tiebreakerSwingAgent ||
      (vetoTriggered && v.vote === "HARD_NO" && isChallenger);

    // New signal: raised a flag that no other agent raised
    const newSignal = v.keyFlags.some(
      (f) => (flagCounts.get(f.trim().toLowerCase()) ?? 0) === 1
    );

    // Contribution score
    let contribution: "HIGH" | "MEDIUM" | "LOW";
    if (influencedDecision || (newSignal && triggeredChallenge)) {
      contribution = "HIGH";
    } else if (newSignal || triggeredChallenge || v.confidence >= 0.8) {
      contribution = "MEDIUM";
    } else {
      contribution = "LOW";
    }

    return {
      agentId:            v.personaId,
      agentName:          v.personaName,
      contribution,
      newSignal,
      influencedDecision,
      triggeredChallenge,
    };
  });
}

// ── 6. Decision Integrity Builder ─────────────────────────────────────────────

function buildDecisionIntegrity(
  votes: PersonaVote[],
  mode: string,
  riskLevel: RiskLevel,
  agentsRun: number,
  vetoResult: VetoCheckResult,
  contributions: AgentContribution[],
  verdict: string,
  runtimeMs: number,
): DecisionIntegrity {
  const challengerIds = new Set(CHALLENGER_IDS[mode] ?? []);
  const proposerIds   = new Set(PROPOSER_IDS[mode]   ?? []);

  // Challenges raised: top 3 challenger agents with blockers or HARD_NO
  const challengesRaised: AdversarialChallenge[] = votes
    .filter((v) => challengerIds.has(v.personaId) && (v.blockers.length > 0 || v.vote === "HARD_NO"))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((v) => ({
      agentId:   v.personaId,
      agentName: v.personaName,
      objection: v.blockers[0] ?? v.rationale.split(".")[0] + ".",
    }));

  // Surviving claims: top 3 proposer agents with HARD_YES or SOFT_YES
  const survivingClaims: AdversarialClaim[] = votes
    .filter((v) => proposerIds.has(v.personaId) && (v.vote === "HARD_YES" || v.vote === "SOFT_YES"))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((v) => ({
      agentId:   v.personaId,
      agentName: v.personaName,
      claim:     v.rationale.split(".")[0] + ".",
    }));

  // Unresolved objection: challenger raised HARD_NO but no proposer gave HARD_YES
  const challengerHardNos = votes.filter(
    (v) => challengerIds.has(v.personaId) && v.vote === "HARD_NO"
  );
  const proposerHardYes = votes.filter(
    (v) => proposerIds.has(v.personaId) && v.vote === "HARD_YES"
  );
  const unresolvedObjection = challengerHardNos.length > 0 && proposerHardYes.length === 0;

  // Disagreement count: agents whose vote direction differs from final verdict direction
  const verdictPositive = verdict === "APPROVED" || verdict === "APPROVED_WITH_CONDITIONS";
  const verdictNegative = verdict === "REJECTED" || verdict === "VETOED";
  const disagreementCount = votes.filter((v) => {
    const votePositive = v.vote === "HARD_YES" || v.vote === "YES" || v.vote === "SOFT_YES";
    const voteNegative = v.vote === "SOFT_NO" || v.vote === "HARD_NO";
    if (verdictPositive) return voteNegative;
    if (verdictNegative) return votePositive;
    return false; // INSUFFICIENT_DATA: no disagreement counted
  }).length;
  return {
    challengesRaised,
    survivingClaims,
    vetoTriggered:       vetoResult.triggered,
    vetoReason:          vetoResult.reason,
    unresolvedObjection,
    riskLevel,
    agentsRun,
    agentContributions:  contributions,
    disagreementCount,
    runtimeMs,
  };
}

// ── Main: runAdversarialCouncil ───────────────────────────────────────────────

export async function runAdversarialCouncil(
  dealText: string,
  options: RunCouncilOptions = {},
): Promise<AdversarialCouncilResult> {
  const mode = options.councilMode ?? "gcc";
  const allPersonas    = getPersonasForMode(mode);
  const challengerIds  = CHALLENGER_IDS[mode] ?? [];

  // ── Infrastructure mode: prepend institutional reasoning preamble ────────────
  // This preamble is injected before the deal text reaches any persona.
  // It suppresses VC-style framing and enforces project-finance logic.
  let effectiveDealText = dealText;
  if (mode === "infrastructure") {
    effectiveDealText =
      `[INFRASTRUCTURE / PROJECT FINANCE MODE]
` +
      `This is an infrastructure asset evaluation. Apply project-finance logic throughout.
` +
      `
` +
      `REQUIRED EVALUATION FRAMEWORK:
` +
      `• DSCR (Debt Service Coverage Ratio) — minimum 1.25x investment grade, target 1.40x+
` +
      `• LCOE vs CfD strike price — assess whether contracted revenue covers cost of generation
` +
      `• EPC certainty — lump-sum fixed-price preferred; open-book is a material risk
` +
      `• Merchant exposure — uncontracted revenue is a structural risk, not an upside
` +
      `• Foundation maturity — FOAK floating foundations carry technology risk premium
` +
      `• Refinancing resilience — assess ability to refinance at financial close
` +
      `• Contingency adequacy — infrastructure projects require 10–15% CapEx contingency
` +
      `
` +
      `SUPPRESSED FRAMEWORKS (do NOT apply):
` +
      `• VC return framing (IRR targets, exit multiples, TAM sizing)
` +
      `• Hypergrowth criticism ("too capital intensive for venture returns")
` +
      `• Startup scaling logic (team size, product-market fit, churn)
` +
      `• Revenue multiple valuation (EV/EBITDA is acceptable; revenue multiples are not)
` +
      `
` +
      `---
` +
      `
` +
      dealText;
  }

  // ── Phase 1: Always run all 10 personas ─────────────────────────────────
  // Dynamic scaling (4/6/10 based on risk) was removed because it caused
  // the UI to show "6 YES" instead of "10 YES", misrepresenting the Council.
  // All 10 personas always run regardless of deal risk level.
  const initialRisk        = estimateRiskLevel(effectiveDealText, mode);
  const phase1PersonaIds   = allPersonas.map((p) => p.id); // always full council
  const phase1ChallengerIds = challengerIds; // all challengers always active

  const councilStartMs = Date.now();
  console.log(`[AdversarialCouncil] Full Council | Risk: ${initialRisk} | Agents: ${phase1PersonaIds.length}/${allPersonas.length} | Mode: ${mode}`);

  const phase1Result = await runCouncil(effectiveDealText, {
    ...options,
    activePersonaIds:   phase1PersonaIds,
    challengerAgentIds: phase1ChallengerIds,
  });

  // ── Phase 2: No longer needed — all agents already ran in Phase 1 ────────
  const finalResult: CouncilResult = phase1Result;
  const finalRisk: RiskLevel       = initialRisk;
  const agentsRun                  = phase1PersonaIds.length;

  console.log(`[AdversarialCouncil] Complete | Risk: ${finalRisk} | Agents: ${agentsRun}`);

  const runtimeMs = Date.now() - councilStartMs;
  // ── Step 3: Extended Veto check on final merged result ───────────────────
  const vetoResult = checkExtendedVeto(finalResult.votes, finalResult.gccVetoTriggered, mode);
  if (vetoResult.triggered && vetoResult.forceVerdict) {
    (finalResult as any).verdict = vetoResult.forceVerdict;
    (finalResult as any).gccVetoTriggered = true;
    console.log(`[AdversarialCouncil] Extended veto triggered: ${vetoResult.reason}`);
  }

  // ── Step 4: Agent contribution tracking ──────────────────────────────────
  const contributions = computeContributions(
    finalResult.votes,
    challengerIds,
    finalResult.tiebreakerSwingAgent,
    vetoResult.triggered,
  );

  // ── Step 5: Build Decision Integrity section ──────────────────────────────
  const decisionIntegrity = buildDecisionIntegrity(
    finalResult.votes,
    mode,
    finalRisk,
    agentsRun,
    vetoResult,
    contributions,
    finalResult.verdict,
    runtimeMs,
  );

  return {
    ...finalResult,
    decisionIntegrity,
  };
}
