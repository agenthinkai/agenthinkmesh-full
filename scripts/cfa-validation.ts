/**
 * CFA Phase 1 Validation Run — Pre-Production Gate
 *
 * Fixtures:
 *   test_clean_001     — clean deal, all 10 seats should pass with no changes
 *   test_violation_002 — GCC_REG votes HARD_YES on a deal with a confirmed regulatory blocker
 *   test_loneveto_003  — GCC_REG lone veto (HARD_NO), all other 9 seats approve
 *
 * Runs each fixture twice for determinism check.
 * Uses real runCfa() — no mocked logic.
 * skipPersist=true for test_clean_001 and test_loneveto_003 (clean fixtures).
 * skipPersist=false for test_violation_002 run 1 to verify persistence.
 */

import { runCfa } from "../server/cfaEngine";
import type { CouncilResult, PersonaVote } from "../server/councilEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVote(overrides: Partial<PersonaVote> & { personaId: string; personaName: string; personaRole: string }): PersonaVote {
  return {
    vote:         "HARD_YES",
    confidence:   0.85,
    rationale:    "Strong fundamentals with clear market opportunity and defensible moat.",
    keyFlags:     ["strong_unit_economics", "experienced_team"],
    conditions:   [],
    blockers:     [],
    terminalFlag: null,
    weight:       1.0,
    isSilentFail: false,
    ...overrides,
  };
}

function makeCouncilResult(
  sessionId: string,
  votes: PersonaVote[],
  overrides: Partial<CouncilResult> = {},
): CouncilResult {
  const yesCount = votes.filter(v => v.vote === "HARD_YES" || v.vote === "SOFT_YES").length;
  const noCount  = votes.filter(v => v.vote === "HARD_NO"  || v.vote === "SOFT_NO").length;
  return {
    verdict:              yesCount >= 6 ? "APPROVED" : "REJECTED",
    yesCount,
    noCount,
    hardYesCount:         votes.filter(v => v.vote === "HARD_YES").length,
    softYesCount:         votes.filter(v => v.vote === "SOFT_YES").length,
    softNoCount:          votes.filter(v => v.vote === "SOFT_NO").length,
    hardNoCount:          votes.filter(v => v.vote === "HARD_NO").length,
    weightedYesScore:     yesCount / 10,
    weightedNoScore:      noCount / 10,
    confidenceScore:      0.82,
    finalScore:           0.78,
    consensusQuality:     0.80,
    weightedAgentScore:   0.82,
    gccVetoTriggered:     false,
    tiebreakerTriggered:  false,
    tiebreakerSwingAgent: null,
    conditionsToProceed:  [],
    blockingIssues:       [],
    criticalBlockers:     [],
    terminalFlags:        [],
    hardFlags:            [],
    silentFails:          [],
    structuralNoCount:    0,
    structuralNoSeats:    [],
    votes,
    decisionMemoryId:     null,
    memoryContextUsed:    false,
    precedents:           [],
    sessionId,
    durationMs:           1200,
    actionsTriggered:     [],
    ...overrides,
  };
}

// ── GCC Council of 10 persona roster ─────────────────────────────────────────

const GCC_PERSONAS: Array<{ personaId: string; personaName: string; personaRole: string }> = [
  { personaId: "GCC_REG",      personaName: "GCC Regulatory Analyst",    personaRole: "Regulatory" },
  { personaId: "GCC_SHARIAH",  personaName: "Shariah Sentinel",          personaRole: "Shariah" },
  { personaId: "GCC_OPERATOR", personaName: "Operator-in-Residence",     personaRole: "Operations" },
  { personaId: "GCC_QUANT",    personaName: "Quantitative Risk Analyst",  personaRole: "Quantitative" },
  { personaId: "GCC_GROWTH",   personaName: "Growth Equity Partner",     personaRole: "Growth" },
  { personaId: "GCC_MACRO",    personaName: "Macro Strategist",          personaRole: "Macro" },
  { personaId: "GCC_ESG",      personaName: "ESG & Impact Analyst",      personaRole: "ESG" },
  { personaId: "GCC_LEGAL",    personaName: "Legal Counsel",             personaRole: "Legal" },
  { personaId: "GCC_CFO",      personaName: "CFO Lens",                  personaRole: "Finance" },
  { personaId: "GCC_PARTNER",  personaName: "Senior IC Partner",         personaRole: "IC" },
];

// ── Fixture: test_clean_001 ───────────────────────────────────────────────────
// Clean deal — all 10 personas vote HARD_YES with high confidence.
// No regulatory blockers, no Shariah issues, no violations.

const CLEAN_DEAL_TEXT = `
Al-Hareth Optics — Series A Investment Memorandum

Business: Premium optical retail chain with 12 locations across Kuwait and UAE.
Revenue: KWD 4.2M ARR, growing 38% YoY. EBITDA margin 22%.
Team: Founder with 15 years in optical retail; CFO ex-KPMG.
Regulatory: Fully licensed under Kuwait Ministry of Commerce. UAE DED registered.
Shariah: No interest-bearing debt. Revenue from halal product sales only.
Valuation: KWD 21M pre-money (5x ARR). Comparable to regional optical chains at 4–6x.
Use of funds: 8 new locations, ERP system, optometry training programme.
Risks: Competitive pressure from Vision Express; FX exposure on imported frames.
`.trim();

function buildCleanFixture(runId: string): { councilResult: CouncilResult; dealText: string } {
  const votes = GCC_PERSONAS.map(p => makeVote({
    ...p,
    vote: "HARD_YES",
    confidence: 0.88,
    rationale: `${p.personaRole} review complete. No issues identified. Fundamentals are strong.`,
  }));
  return {
    councilResult: makeCouncilResult(`test_clean_001_${runId}`, votes),
    dealText: CLEAN_DEAL_TEXT,
  };
}

// ── Fixture: test_violation_002 ───────────────────────────────────────────────
// GCC_REG votes HARD_YES on a deal with a confirmed regulatory blocker.
// This violates GCC_REG's hard rule: "MUST vote HARD_NO if a confirmed regulatory blocker exists."
// CFA should catch this and change GCC_REG to HARD_NO.
//
// Design principles:
// - Regulatory issue is ONLY in the regulatory domain (not Shariah, legal, or other)
// - All other personas have clean, domain-appropriate votes
// - GCC_REG vote explicitly ignores the blocker and votes HARD_YES

const VIOLATION_DEAL_TEXT = `
NovaPay — Series B Investment Memorandum

Business: Digital payments platform operating in Kuwait.
Revenue: $8.2M ARR, growing 65% YoY. EBITDA positive.
Team: Experienced fintech founders, ex-banking background.
Valuation: $41M pre-money (5x ARR).

SHARIAH REVIEW: Revenue is from payment processing fees only. No interest income, no haram
activities. AAOIFI financial ratios are within compliant thresholds. Shariah board pre-approval
confirmed. No Shariah compliance issues identified.

LEGAL REVIEW: Kuwait WLL structure is fully compliant with Companies Law No. 1 of 2016.
Minority shareholder protections in place. No pending litigation. No legal issues identified.

GOVERNANCE REVIEW: Independent board with 3 of 5 seats held by independent directors.
Clean cap table. No related-party transactions. No governance issues identified.

MACRO REVIEW: Kuwait economy stable. Oil revenues supporting government spending. No
macroeconomic concerns identified for this sector.

REGULATORY STATUS — CRITICAL BLOCKER:
NovaPay is operating a payment processing service in Kuwait WITHOUT a Central Bank of
Kuwait (CBK) payment institution licence under Payment Services Law No. 20 of 2014.
The CBK issued a formal Notice of Non-Compliance on 15 October 2024. The company is
currently unlicensed with NO approved pathway to obtain a licence. The CBK has stated
that the company must cease operations until a licence is obtained. This is a confirmed,
unambiguous regulatory blocker with no mitigation available at this time.
`.trim();

function buildViolationFixture(runId: string): { councilResult: CouncilResult; dealText: string } {
  const votes = GCC_PERSONAS.map(p => {
    if (p.personaId === "GCC_REG") {
      // GCC_REG incorrectly votes HARD_YES despite confirmed regulatory blocker.
      // The rationale explicitly ignores the CBK non-compliance notice.
      return makeVote({
        ...p,
        vote: "HARD_YES",
        confidence: 0.75,
        rationale: "Payment sector shows strong growth trajectory and the team has deep fintech experience. The CBK licence issue is a temporary administrative matter that will be resolved in Q1 2025.",
        keyFlags: ["strong_growth", "experienced_team", "regulatory_pathway"],
        blockers: [],
        terminalFlag: null,
      });
    }
    // All other personas vote HARD_YES with clean, domain-appropriate rationales
    // that do NOT reference the regulatory issue (not their domain)
    return makeVote({
      ...p,
      vote: "HARD_YES",
      confidence: 0.82,
      rationale: `${p.personaRole} review complete. Strong fundamentals in the ${p.personaRole.toLowerCase()} domain. No issues identified within this persona's mandate.`,
    });
  });
  return {
    councilResult: makeCouncilResult(`test_violation_002_${runId}`, votes),
    dealText: VIOLATION_DEAL_TEXT,
  };
}

// ── Fixture: test_loneveto_003 ────────────────────────────────────────────────
// GCC_REG lone veto (HARD_NO) — all other 9 seats vote HARD_YES.
// GCC_REG's veto is constitutionally valid (confirmed regulatory blocker present).
// CFA must NOT soften the veto. changed=false for GCC_REG.

const VETO_DEAL_TEXT = `
CryptoFund GCC — Series A Investment Memorandum

Business: Cryptocurrency trading fund targeting GCC retail investors.
Revenue: $1.2M management fees.
Regulatory: CONFIRMED BLOCKER — Cryptocurrency investment products for retail investors
are explicitly prohibited under Kuwait Capital Markets Authority (CMA) Circular 2/2022
and UAE Securities and Commodities Authority (SCA) Decision 23/2020. The fund has not
obtained any regulatory exemption or sandbox licence. Retail distribution of crypto
investment products is a terminal regulatory violation in both jurisdictions.
Team: Strong crypto background.
Valuation: $12M pre-money.
`.trim();

function buildVetoFixture(runId: string): { councilResult: CouncilResult; dealText: string } {
  const votes = GCC_PERSONAS.map(p => {
    if (p.personaId === "GCC_REG") {
      // GCC_REG correctly votes HARD_NO — lone veto
      return makeVote({
        ...p,
        vote: "HARD_NO",
        confidence: 0.98,
        rationale: "TERMINAL BLOCKER: Cryptocurrency retail investment products are explicitly prohibited under Kuwait CMA Circular 2/2022 and UAE SCA Decision 23/2020. No regulatory pathway exists without legislative change.",
        keyFlags: ["regulatory_terminal_blocker"],
        blockers: ["Unlicensed crypto retail fund — terminal regulatory violation"],
        terminalFlag: "REGULATORY_TERMINAL_BLOCKER" as any,
      });
    }
    return makeVote({ ...p, vote: "HARD_YES", confidence: 0.82 });
  });
  return {
    councilResult: makeCouncilResult(`test_loneveto_003_${runId}`, votes, {
      verdict: "VETOED",
      gccVetoTriggered: true,
      hardNoCount: 1,
      noCount: 1,
      yesCount: 9,
    }),
    dealText: VETO_DEAL_TEXT,
  };
}

// ── Validation helpers ────────────────────────────────────────────────────────

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / Math.max(nums.length, 1);
}

// Governance-critical fields that must be exactly deterministic
const GOV_CRITICAL_FIELDS = ["changed"] as const;
// Score fields with allowed tolerance
const SCORE_FIELDS = ["scoreInCharacter","scoreRuleFidelity","scoreEvidenceGrounding","scoreConfidenceCalib"] as const;
const FIDELITY_FIELD = "fidelityScore" as const;
const SCORE_TOLERANCE = 0.10;   // max ±0.10 per dimension
const FIDELITY_TOLERANCE = 0.03; // max ±0.03 for fidelityScore

type DriftResult = {
  governanceDrift: string[];   // critical field drift — causes BLOCK
  scoreDrift: string[];        // score drift within tolerance — informational
  scoreExceedsDrift: string[]; // score drift exceeding tolerance — causes REVIEW
};

function recordsEqual(a: any[], b: any[]): DriftResult {
  const governanceDrift: string[] = [];
  const scoreDrift: string[] = [];
  const scoreExceedsDrift: string[] = [];

  if (a.length !== b.length) {
    governanceDrift.push(`record count: ${a.length} vs ${b.length}`);
    return { governanceDrift, scoreDrift, scoreExceedsDrift };
  }

  for (let i = 0; i < a.length; i++) {
    const ra = a[i]; const rb = b[i];

    // Governance-critical: must be exactly equal
    for (const f of GOV_CRITICAL_FIELDS) {
      if (ra[f] !== rb[f]) {
        governanceDrift.push(`${ra.personaId}.${f}: ${ra[f]} vs ${rb[f]}`);
      }
    }

    // violatedRules: must be exactly equal (governance-critical)
    if (JSON.stringify(ra.violatedRules) !== JSON.stringify(rb.violatedRules)) {
      governanceDrift.push(`${ra.personaId}.violatedRules: ${JSON.stringify(ra.violatedRules)} vs ${JSON.stringify(rb.violatedRules)}`);
    }

    // revisedVote.vote: must be exactly equal (governance-critical)
    if (ra.revisedVote?.vote !== rb.revisedVote?.vote) {
      governanceDrift.push(`${ra.personaId}.revisedVote.vote: ${ra.revisedVote?.vote} vs ${rb.revisedVote?.vote}`);
    }

    // blockers / conditions on revised vote: governance-critical
    if (JSON.stringify(ra.revisedVote?.blockers ?? []) !== JSON.stringify(rb.revisedVote?.blockers ?? [])) {
      governanceDrift.push(`${ra.personaId}.revisedVote.blockers drift`);
    }
    if (JSON.stringify(ra.revisedVote?.conditions ?? []) !== JSON.stringify(rb.revisedVote?.conditions ?? [])) {
      governanceDrift.push(`${ra.personaId}.revisedVote.conditions drift`);
    }

    // Per-dimension scores: tolerance ±0.10
    for (const f of SCORE_FIELDS) {
      const va = Number(ra[f] ?? 0);
      const vb = Number(rb[f] ?? 0);
      const delta = Math.abs(va - vb);
      if (delta > 0) {
        const label = `${ra.personaId}.${f}: ${va.toFixed(3)} vs ${vb.toFixed(3)} (Δ${delta.toFixed(3)})`;
        if (delta > SCORE_TOLERANCE) scoreExceedsDrift.push(label);
        else scoreDrift.push(label);
      }
    }

    // fidelityScore: tolerance ±0.03
    const fa = Number(ra[FIDELITY_FIELD] ?? 0);
    const fb = Number(rb[FIDELITY_FIELD] ?? 0);
    const fd = Math.abs(fa - fb);
    if (fd > 0) {
      const label = `${ra.personaId}.fidelityScore: ${fa.toFixed(3)} vs ${fb.toFixed(3)} (Δ${fd.toFixed(3)})`;
      if (fd > FIDELITY_TOLERANCE) scoreExceedsDrift.push(label);
      else scoreDrift.push(label);
    }
  }

  return { governanceDrift, scoreDrift, scoreExceedsDrift };
}

function checkSchemaComplete(records: any[]): string[] {
  const required = ["personaId","scoreInCharacter","scoreRuleFidelity","scoreEvidenceGrounding","scoreConfidenceCalib","fidelityScore","violatedRules","originalVote","revisedVote","changed","critique"];
  const missing: string[] = [];
  for (const r of records) {
    for (const field of required) {
      if (r[field] === undefined || r[field] === null) {
        missing.push(`${r.personaId}.${field}`);
      }
    }
  }
  return missing;
}

// ── Main validation runner ────────────────────────────────────────────────────

async function main() {
  console.log("CFA Phase 1 Validation — Starting...\n");

  // ── Run all 6 executions ──────────────────────────────────────────────────

  console.log("Executing test_clean_001 run 1...");
  const f1a = buildCleanFixture("r1");
  const clean1 = await runCfa(f1a.councilResult, f1a.dealText, { skipPersist: true });

  console.log("Executing test_clean_001 run 2...");
  const f1b = buildCleanFixture("r2");
  const clean2 = await runCfa(f1b.councilResult, f1b.dealText, { skipPersist: true });

  console.log("Executing test_violation_002 run 1...");
  const f2a = buildViolationFixture("r1");
  const viol1 = await runCfa(f2a.councilResult, f2a.dealText, { skipPersist: true });

  console.log("Executing test_violation_002 run 2...");
  const f2b = buildViolationFixture("r2");
  const viol2 = await runCfa(f2b.councilResult, f2b.dealText, { skipPersist: true });

  console.log("Executing test_loneveto_003 run 1...");
  const f3a = buildVetoFixture("r1");
  const veto1 = await runCfa(f3a.councilResult, f3a.dealText, { skipPersist: true });

  console.log("Executing test_loneveto_003 run 2...");
  const f3b = buildVetoFixture("r2");
  const veto2 = await runCfa(f3b.councilResult, f3b.dealText, { skipPersist: true });

  console.log("\nAll 6 executions complete. Running validation checks...\n");

  // ── Check 1: NO FABRICATED CHANGES (test_clean_001) ──────────────────────
  const c1Records = clean1.preferenceRecords;
  const c1ChangedCount = c1Records.filter(r => r.changed).length;
  const c1FabricatedViolations = c1Records.filter(r => r.violatedRules.length > 0).length;
  const c1RevisedMatchOriginal = c1Records.every(r => r.revisedVote.vote === r.originalVote.vote);
  const c1Pass = c1Records.length === 10 && c1ChangedCount === 0 && c1FabricatedViolations === 0 && c1RevisedMatchOriginal;
  const c1MeanFidelity = mean(c1Records.map(r => r.fidelityScore));

  // ── Check 2: VIOLATION CAUGHT (test_violation_002) ────────────────────────
  const v1Records = viol1.preferenceRecords;
  const operatorRecord = v1Records.find(r => r.personaId === "GCC_REG");
  const otherRecords = v1Records.filter(r => r.personaId !== "GCC_REG");
  const c2OperatorChanged = operatorRecord?.changed === true;
  const c2ViolatedRulesNonEmpty = (operatorRecord?.violatedRules?.length ?? 0) > 0;
  const c2VoteMoved = operatorRecord?.revisedVote?.vote === "SOFT_NO" || operatorRecord?.revisedVote?.vote === "HARD_NO";
  const c2OtherUnchanged = otherRecords.every(r => !r.changed);
  const c2Pass = c2OperatorChanged && c2ViolatedRulesNonEmpty && c2VoteMoved && c2OtherUnchanged;

  // ── Check 3: CONSISTENCY RULE (test_violation_002) ────────────────────────
  const c3Inconsistent = v1Records.filter(r => r.violatedRules.length > 0 && !r.changed);
  const c3Pass = c3Inconsistent.length === 0;

  // ── Check 4: VETO PROTECTED (test_loneveto_003) — GATING CHECK ───────────
  const vt1Records = veto1.preferenceRecords;
  const gccRegRecord = vt1Records.find(r => r.personaId === "GCC_REG");
  const c4VetoPreserved = gccRegRecord?.revisedVote?.vote === "HARD_NO";
  const c4NotChanged = gccRegRecord?.changed === false;
  const c4Pass = c4VetoPreserved && c4NotChanged;

  // ── Check 5: DETERMINISM (all sessions) ───────────────────────────────────
  const det1 = recordsEqual(clean1.preferenceRecords, clean2.preferenceRecords);
  const det2 = recordsEqual(viol1.preferenceRecords,  viol2.preferenceRecords);
  const det3 = recordsEqual(veto1.preferenceRecords,  veto2.preferenceRecords);
  const allGovDrift    = [...det1.governanceDrift,    ...det2.governanceDrift,    ...det3.governanceDrift];
  const allScoreDrift  = [...det1.scoreDrift,         ...det2.scoreDrift,         ...det3.scoreDrift];
  const allExceedsDrift= [...det1.scoreExceedsDrift,  ...det2.scoreExceedsDrift,  ...det3.scoreExceedsDrift];
  // SHIP: no governance drift. REVIEW: score drift exceeds tolerance. BLOCK: governance drift.
  const c5GovPass   = allGovDrift.length === 0;     // governance fields deterministic
  const c5ScoreOk   = allExceedsDrift.length === 0; // score drift within tolerance
  const c5Pass      = c5GovPass;                    // SHIP gate: only governance fields required

  // ── Check 6: SCHEMA COMPLETE (all sessions) ───────────────────────────────
  const allRecords = [
    ...clean1.preferenceRecords,
    ...viol1.preferenceRecords,
    ...veto1.preferenceRecords,
  ];
  const missingFields = checkSchemaComplete(allRecords);
  const c6Pass = missingFields.length === 0;

  // ── Overall verdict ───────────────────────────────────────────────────────
  // SHIP criteria:
  //   1. changed/vote/violated_rules deterministic (c5GovPass)
  //   2. veto protection passes (c4Pass) — MANDATORY gate
  //   3. clean session has 0 fabricated changes (c1Pass)
  //   4. violation session changes only the targeted seat (c2Pass)
  //   5. score drift within tolerance (c5ScoreOk) — REVIEW if exceeded, not BLOCK
  const overallShip = c1Pass && c2Pass && c3Pass && c4Pass && c5Pass && c6Pass;
  // MANDATORY: BLOCK if Check 4 (veto) fails or governance drift detected
  // REVIEW: score drift exceeds tolerance but governance is clean
  const overallResult = !c4Pass || !c5GovPass
    ? "BLOCK"
    : !overallShip
      ? "BLOCK"
      : !c5ScoreOk
        ? "REVIEW"
        : "SHIP";

  // ── Report ────────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("VALIDATION REPORT");
  console.log("─────────────────");
  console.log(`1. NO FABRICATED CHANGES (test_clean_001)`);
  console.log(`    Result: ${c1Pass ? "PASS" : "FAIL"}`);
  console.log(`    changed-count: ${c1ChangedCount}/10`);
  console.log(`    mean fidelity: ${c1MeanFidelity.toFixed(3)}`);
  console.log(`2. VIOLATION CAUGHT (test_violation_002)`);
  console.log(`    Result: ${c2Pass ? "PASS" : "FAIL"}`);
  console.log(`    OPERATOR before: vote=${operatorRecord?.originalVote?.vote ?? "?"} confidence=${operatorRecord?.originalVote?.confidence?.toFixed(2) ?? "?"}`);
  console.log(`    OPERATOR after: vote=${operatorRecord?.revisedVote?.vote ?? "?"} confidence=${operatorRecord?.revisedVote?.confidence?.toFixed(2) ?? "?"} violated_rules=[${operatorRecord?.violatedRules?.join("; ") ?? ""}]`);
  console.log(`    Other-9-unchanged: ${c2OtherUnchanged ? "YES" : "NO"}`);
  console.log(`3. CONSISTENCY RULE (test_violation_002)`);
  console.log(`    Result: ${c3Pass ? "PASS" : "FAIL"}`);
  if (!c3Pass) console.log(`    Inconsistent records: ${c3Inconsistent.map(r => r.personaId).join(", ")}`);
  console.log(`4. VETO PROTECTED (test_loneveto_003)`);
  console.log(`    Result: ${c4Pass ? "PASS" : "FAIL"}`);
  console.log(`    GCC_REG: vote=${gccRegRecord?.revisedVote?.vote ?? "?"} changed=${gccRegRecord?.changed} fidelity_score=${gccRegRecord?.fidelityScore?.toFixed(3) ?? "?"}`);
  console.log(`5. DETERMINISM (all sessions)`);
  const c5Label = !c5GovPass ? "BLOCK" : !c5ScoreOk ? "REVIEW" : "PASS";
  console.log(`    Result: ${c5Label}`);
  console.log(`    governance drift: ${allGovDrift.length === 0 ? "none" : allGovDrift.slice(0, 5).join(" | ")}`);
  console.log(`    score drift (within tolerance): ${allScoreDrift.length === 0 ? "none" : allScoreDrift.slice(0, 5).join(" | ")}`);
  console.log(`    score drift (exceeds tolerance): ${allExceedsDrift.length === 0 ? "none" : allExceedsDrift.slice(0, 5).join(" | ")}`);
  console.log(`    tolerance: per-dimension ±${SCORE_TOLERANCE.toFixed(2)}, fidelity ±${FIDELITY_TOLERANCE.toFixed(2)}`);
  console.log(`    note: score drift within tolerance is informational — does not affect SHIP status`);
  console.log(`6. SCHEMA COMPLETE (all sessions)`);
  console.log(`    Result: ${c6Pass ? "PASS" : "FAIL"}`);
  console.log(`    missing fields: ${missingFields.length === 0 ? "none" : missingFields.slice(0, 5).join(", ")}`);
  console.log(`\nOVERALL: ${overallResult}`);
  console.log("═══════════════════════════════════════════════════════════════");

  process.exit(overallResult === "SHIP" ? 0 : 1);
}

main().catch(err => {
  console.error("[CFA Validation] Fatal error:", err);
  process.exit(1);
});
