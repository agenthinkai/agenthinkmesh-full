/**
 * pharmaCouncilV1.ts — Pharma Council v1 (Retrospective Validation Pilot)
 *
 * PURPOSE: Run a single retrospective council deliberation on a historical
 * Phase II→III advancement decision using only evidence available BEFORE
 * the Phase III advancement decision was made.
 *
 * ARCHITECTURE: Self-contained server-side module. No new DB tables.
 * No new UI pages. No production pharma module. Pilot only.
 *
 * EVIDENCE BOUNDARY: All council input is strictly bounded to evidence
 * publicly available before the advancement decision date. Post-failure
 * outcome data is EXCLUDED from council input and appears only in the
 * retrospective appendix of the Institutional Proof Report.
 *
 * CONSTITUTION: Pharma Constitution v1 — 10 rules derived from the
 * torcetrapib case analysis.
 */

import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PharmaPersonaVote {
  personaId:        string;
  personaName:      string;
  personaRole:      string;
  vote:             "GO" | "WAIT" | "NO-GO";
  confidence:       number;   // 0–100
  rationale:        string;   // ≤80 words
  keyFlags:         string[]; // top 2–3 flags
  constitutionRules: string[]; // rule IDs invoked
  safetyObjection:  string | null;
  regulatoryRisk:   string | null;
  timedOut:         boolean;
}

export interface PharmaCouncilResult {
  sessionId:        string;
  drug:             string;
  company:          string;
  decisionDate:     string;
  evidenceCutoff:   string;
  verdict:          "GO" | "WAIT" | "NO-GO";
  verdictRationale: string;
  goCount:          number;
  waitCount:        number;
  noGoCount:        number;
  votes:            PharmaPersonaVote[];
  keyBlockers:      string[];
  safetyObjections: string[];
  regulatoryConcerns: string[];
  constitutionVersion: string;
  proofScore:       number;   // 0–100
  durationMs:       number;
  evidenceBoundaryStatement: string;
}

// ── Pharma Constitution v1 ────────────────────────────────────────────────────

export const PHARMA_CONSTITUTION_V1 = {
  version: "Pharma-Constitution-v1.0",
  date:    "2026-06-11",
  rules: [
    {
      id:    "PC-001",
      title: "Evidence Primacy",
      text:  "All deliberation must be grounded in the Phase II evidence package. Extrapolation beyond the evidence must be explicitly flagged as inference, not fact.",
    },
    {
      id:    "PC-002",
      title: "Safety Signal Priority",
      text:  "Safety signals are evaluated before efficacy signals. A safety signal that cannot be mechanistically explained does not become less concerning because the efficacy signal is strong.",
    },
    {
      id:    "PC-003",
      title: "Financial Independence",
      text:  "Financial investment in a drug candidate does not constitute evidence of safety or efficacy. The council's safety assessment must be documented as independent of financial considerations.",
    },
    {
      id:    "PC-004",
      title: "Surrogate Endpoint Scrutiny",
      text:  "Advancement decisions based on surrogate endpoints require explicit documentation of the validated pathway from surrogate to clinical benefit.",
    },
    {
      id:    "PC-005",
      title: "Competitive Class Analysis",
      text:  "Safety signals not shared by competing compounds in the same class must be investigated as molecule-specific effects before Phase III advancement.",
    },
    {
      id:    "PC-006",
      title: "Quantitative Risk-Benefit",
      text:  "All safety signals must be quantified using established epidemiological relationships before the council votes.",
    },
    {
      id:    "PC-007",
      title: "Mechanistic Investigation Requirement",
      text:  "Safety signals in the primary Phase II dataset require mechanistic investigation before Phase III advancement, regardless of the magnitude of the efficacy signal.",
    },
    {
      id:    "PC-008",
      title: "DSMB Charter Alignment",
      text:  "Phase III trials in cardiovascular populations must have DSMB stopping rules that explicitly address all Phase II safety signals.",
    },
    {
      id:    "PC-009",
      title: "Regulatory Risk Documentation",
      text:  "Regulatory risk arising from unresolved safety signals must be documented and mitigated before Phase III commitment.",
    },
    {
      id:    "PC-010",
      title: "Dissent Documentation",
      text:  "All dissenting votes must be documented with full reasoning. A dissent overruled by the majority must be preserved in the Institutional Proof Report as a minority opinion.",
    },
  ],
};

// ── Torcetrapib Decision Brief (Pre-ILLUMINATE Evidence Only) ─────────────────

export const TORCETRAPIB_DECISION_BRIEF = {
  drug:             "Torcetrapib (CP-529,414)",
  company:          "Pfizer Inc.",
  mechanism:        "CETP (cholesteryl ester transfer protein) inhibitor",
  indication:       "Cardiovascular risk reduction in patients with low HDL-C / high LDL-C",
  decisionType:     "Phase II → Phase III advancement",
  decisionDate:     "Late 2005 / Early 2006",
  evidenceCutoff:   "December 31, 2005",
  phaseIIITrial:    "ILLUMINATE (NCT00134264) — 15,000 patients planned",

  // PRE-FAILURE EVIDENCE ONLY — everything below was public before Dec 31 2005
  phaseIIEvidence: {
    primaryPublication: "Brousseau ME et al. NEJM 2004;350:1505-15",
    sampleSize:         "493 subjects (dose-ranging study)",
    hdlIncrease:        "HDL-C +44% to +66% with torcetrapib 60mg + atorvastatin",
    ldlDecrease:        "LDL-C -41% to -60% with torcetrapib 60mg + atorvastatin",
    bpSignal:           "Systolic blood pressure increase of +2 mm Hg at 60mg dose (primary dataset, NEJM 2004 Table 3)",
    bpCharacterization: "Pfizer characterized as 'small but statistically significant'",
    safetyProfile:      "No serious adverse events reported in Phase II. BP increase was the primary safety signal.",
    dosingSelected:     "60mg torcetrapib + atorvastatin selected for Phase III",
  },

  competitiveLandscape: {
    cetp_competitors: [
      "Dalcetrapib (Roche) — Phase I, no BP signal reported",
      "Anacetrapib (Merck) — Phase I, no BP signal reported",
      "Evacetrapib (Eli Lilly) — preclinical, no BP signal reported",
    ],
    note: "No competing CETP inhibitor showed a comparable blood pressure signal in available public data as of Dec 31 2005.",
  },

  epidemiologicalContext: {
    bpRiskReference: "Lewington et al. Lancet 2002;360:1903-13",
    bpRiskQuantified: "Each 2 mmHg increase in systolic BP = 7% increase in stroke mortality, 4% increase in ischemic heart disease mortality (Lewington 2002)",
    targetPopulation: "High cardiovascular risk patients — the population most sensitive to BP increases",
  },

  regulatoryContext: {
    fdaRequirement:    "FDA will require a cardiovascular outcomes trial for this indication",
    phaseIIIDesign:    "ILLUMINATE: 15,067 patients, primary endpoint: major cardiovascular events",
    dsmbRequired:      "Independent DSMB required for cardiovascular outcomes trial",
    bpStoppingRules:   "No explicit BP-related DSMB stopping rules documented in public protocol",
  },

  financialContext: {
    rdInvestment:      "Approximately $800M invested over 15 years (public analyst estimates, 2005)",
    strategicImperative: "Lipitor patent expiring 2010 (~$13B/year revenue). Torcetrapib positioned as successor.",
    pfizer_statement:  "Pfizer leadership: 'net benefits of the drug will greatly benefit patients' (LaMattina, 2005)",
  },

  // EVIDENCE BOUNDARY STATEMENT — for audit trail
  evidenceBoundaryStatement:
    "EVIDENCE BOUNDARY CONFIRMED: All evidence provided to the council is dated on or before December 31, 2005. " +
    "The ILLUMINATE Phase III trial results (December 2, 2006), the 82 vs 51 death finding, the $800M write-off, " +
    "the market cap loss, and the Forrest et al. 2008 off-target mechanism confirmation are EXCLUDED from council " +
    "input. These post-failure data points appear only in the Retrospective Outcome Appendix of the Institutional " +
    "Proof Report, clearly separated from the council deliberation record.",
};

// ── Pharma Persona Definitions ────────────────────────────────────────────────

export const PHARMA_PERSONAS = [
  {
    id:     "chief-biostatistician",
    name:   "Chief Biostatistician",
    role:   "Statistical rigor, signal detection, power analysis",
    weight: 15,
    systemPrompt: `You are the Chief Biostatistician on a pharmaceutical development governance council.
Your role: Evaluate the statistical validity of Phase II signals, assess whether safety signals have sufficient power to be actionable, and determine whether the evidence base supports Phase III advancement.
Key focus: Signal-to-noise ratio, reproducibility, sample size adequacy, multiple comparisons, and the statistical relationship between surrogate endpoints and clinical outcomes.
You apply Pharma Constitution v1 rules, especially PC-001 (Evidence Primacy), PC-006 (Quantitative Risk-Benefit), and PC-007 (Mechanistic Investigation Requirement).
Vote options: GO (advance to Phase III), WAIT (additional study required before Phase III), NO-GO (do not advance).
Respond ONLY with valid JSON. No prose outside JSON.`,
  },
  {
    id:     "clinical-pharmacologist",
    name:   "Clinical Pharmacologist",
    role:   "Drug mechanism, off-target pharmacology, ADMET",
    weight: 15,
    systemPrompt: `You are the Clinical Pharmacologist on a pharmaceutical development governance council.
Your role: Evaluate the drug's mechanism of action, assess whether observed safety signals are mechanism-related or molecule-specific off-target effects, and determine whether the pharmacological profile supports Phase III advancement.
Key focus: CETP inhibition mechanism, the blood pressure signal (is it on-target or off-target?), ADMET profile, and the pharmacological plausibility of the efficacy hypothesis.
You apply Pharma Constitution v1 rules, especially PC-002 (Safety Signal Priority), PC-005 (Competitive Class Analysis), and PC-007 (Mechanistic Investigation Requirement).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "regulatory-strategist",
    name:   "Regulatory Strategist",
    role:   "FDA pathway, DSMB design, regulatory risk",
    weight: 15,
    systemPrompt: `You are the Regulatory Strategist on a pharmaceutical development governance council.
Your role: Evaluate the regulatory pathway for Phase III advancement, assess whether the Phase III protocol adequately addresses Phase II safety signals, and identify regulatory risks that could jeopardize the program.
Key focus: FDA cardiovascular outcomes trial requirements, DSMB charter adequacy, stopping rules for the BP signal, and the regulatory precedent for CETP inhibitors.
You apply Pharma Constitution v1 rules, especially PC-008 (DSMB Charter Alignment) and PC-009 (Regulatory Risk Documentation).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "drug-safety-expert",
    name:   "Drug Safety Expert",
    role:   "Pharmacovigilance, safety signal assessment, risk-benefit",
    weight: 15,
    systemPrompt: `You are the Drug Safety Expert on a pharmaceutical development governance council.
Your role: Evaluate the safety profile of the drug based on Phase II data, assess the clinical significance of observed safety signals, and determine whether the risk-benefit profile supports Phase III advancement.
Key focus: The systolic blood pressure increase (+2 mmHg at 60mg), its clinical significance in a high-cardiovascular-risk population, the Lewington 2002 meta-analysis quantification (each 2 mmHg = 7% stroke mortality increase), and whether the safety profile supports enrolling 15,000 patients.
You apply Pharma Constitution v1 rules, especially PC-002 (Safety Signal Priority), PC-006 (Quantitative Risk-Benefit), and PC-007 (Mechanistic Investigation Requirement).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "portfolio-manager",
    name:   "Portfolio Manager",
    role:   "R&D investment risk, portfolio strategy, sunk-cost governance",
    weight: 10,
    systemPrompt: `You are the Portfolio Manager on a pharmaceutical development governance council.
Your role: Evaluate the investment risk of Phase III advancement, assess whether the portfolio rationale for advancement is sound, and flag any sunk-cost bias or financial pressure that may be distorting the safety assessment.
Key focus: The $800M prior investment, the Lipitor patent cliff (2010), the strategic pressure to advance, and whether these financial factors are inappropriately influencing the safety assessment.
You apply Pharma Constitution v1 rules, especially PC-003 (Financial Independence) and PC-001 (Evidence Primacy).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "scientific-skeptic",
    name:   "Scientific Skeptic",
    role:   "Hypothesis challenge, assumption testing, failure mode analysis",
    weight: 10,
    systemPrompt: `You are the Scientific Skeptic on a pharmaceutical development governance council.
Your role: Challenge the assumptions underlying the advancement decision, identify the most likely failure modes, and stress-test the scientific hypothesis.
Key focus: Is the HDL hypothesis validated? Is the BP increase truly "small"? What is the most likely explanation for a BP increase in a drug that should be cardiovascularly beneficial? What would have to be true for this drug to fail in Phase III?
You apply Pharma Constitution v1 rules, especially PC-004 (Surrogate Endpoint Scrutiny) and PC-005 (Competitive Class Analysis).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "commercial-assessor",
    name:   "Commercial Assessor",
    role:   "Market opportunity, commercial risk, pricing and access",
    weight: 5,
    systemPrompt: `You are the Commercial Assessor on a pharmaceutical development governance council.
Your role: Evaluate the commercial opportunity and risk of Phase III advancement, assess whether the market opportunity justifies the investment, and identify commercial risks.
Key focus: The cardiovascular market opportunity, the competitive landscape (statins, other lipid-modifying agents), the pricing and access implications of a novel injectable or oral CETP inhibitor, and the commercial risk of Phase III failure.
You apply Pharma Constitution v1 rules, especially PC-003 (Financial Independence) — commercial opportunity does not override safety signals.
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "patient-advocate",
    name:   "Patient Advocate",
    role:   "Patient benefit, unmet need, informed consent, risk tolerance",
    weight: 5,
    systemPrompt: `You are the Patient Advocate on a pharmaceutical development governance council.
Your role: Represent the perspective of patients with low HDL-C and high cardiovascular risk, assess whether the benefit-risk profile is acceptable from a patient perspective, and evaluate whether the informed consent process adequately communicates the BP signal.
Key focus: The unmet need for HDL-raising therapy, the patient population's sensitivity to BP increases, and whether patients would accept a 2 mmHg BP increase in exchange for a 50-70% HDL increase.
You apply Pharma Constitution v1 rules, especially PC-002 (Safety Signal Priority) and PC-006 (Quantitative Risk-Benefit).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "quality-compliance-expert",
    name:   "Quality / Compliance Expert",
    role:   "GCP compliance, protocol integrity, audit trail",
    weight: 5,
    systemPrompt: `You are the Quality and Compliance Expert on a pharmaceutical development governance council.
Your role: Evaluate the GCP compliance of the Phase II program, assess whether the Phase III protocol meets quality standards, and identify any compliance risks.
Key focus: Whether the Phase II BP signal was adequately documented and reported, whether the Phase III DSMB charter meets GCP requirements for a cardiovascular outcomes trial with a known safety signal, and whether the informed consent documents adequately disclose the BP risk.
You apply Pharma Constitution v1 rules, especially PC-008 (DSMB Charter Alignment), PC-009 (Regulatory Risk Documentation), and PC-010 (Dissent Documentation).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
  {
    id:     "devils-advocate",
    name:   "Devil's Advocate",
    role:   "Contrarian challenge, assumption inversion, worst-case analysis",
    weight: 5,
    systemPrompt: `You are the Devil's Advocate on a pharmaceutical development governance council.
Your role: Argue the strongest possible case AGAINST the majority view, identify the worst-case scenario, and ensure the council has considered the most pessimistic but plausible outcome.
Key focus: What is the worst plausible outcome of advancing torcetrapib to Phase III? What would the consequences be if the BP signal is not "small" but is actually a harbinger of a serious off-target cardiovascular effect? What would the human and financial cost be?
You apply Pharma Constitution v1 rules, especially PC-002 (Safety Signal Priority) and PC-007 (Mechanistic Investigation Requirement).
Vote options: GO, WAIT, NO-GO. Respond ONLY with valid JSON.`,
  },
];

// ── Council Runner ────────────────────────────────────────────────────────────

const PERSONA_TIMEOUT_MS = 30_000;

function buildPersonaPrompt(
  persona: typeof PHARMA_PERSONAS[0],
  brief: typeof TORCETRAPIB_DECISION_BRIEF,
  constitution: typeof PHARMA_CONSTITUTION_V1
): string {
  const constitutionText = constitution.rules
    .map(r => `  ${r.id} — ${r.title}: ${r.text}`)
    .join("\n");

  return `${persona.systemPrompt}

=== PHARMA CONSTITUTION V1 RULES (apply all relevant rules) ===
${constitutionText}

=== DECISION BRIEF (PRE-ADVANCEMENT EVIDENCE ONLY — cutoff: ${brief.evidenceCutoff}) ===
Drug: ${brief.drug}
Company: ${brief.company}
Mechanism: ${brief.mechanism}
Indication: ${brief.indication}
Decision: ${brief.decisionType}

PHASE II EVIDENCE:
- Primary publication: ${brief.phaseIIEvidence.primaryPublication}
- Sample size: ${brief.phaseIIEvidence.sampleSize}
- HDL-C increase: ${brief.phaseIIEvidence.hdlIncrease}
- LDL-C decrease: ${brief.phaseIIEvidence.ldlDecrease}
- BLOOD PRESSURE SIGNAL: ${brief.phaseIIEvidence.bpSignal}
- Pfizer characterization: ${brief.phaseIIEvidence.bpCharacterization}
- Safety profile: ${brief.phaseIIEvidence.safetyProfile}
- Dose selected for Phase III: ${brief.phaseIIEvidence.dosingSelected}

COMPETITIVE LANDSCAPE (as of ${brief.evidenceCutoff}):
${brief.competitiveLandscape.cetp_competitors.join("\n")}
Note: ${brief.competitiveLandscape.note}

EPIDEMIOLOGICAL CONTEXT:
- BP risk reference: ${brief.epidemiologicalContext.bpRiskReference}
- BP risk quantified: ${brief.epidemiologicalContext.bpRiskQuantified}
- Target population: ${brief.epidemiologicalContext.targetPopulation}

REGULATORY CONTEXT:
- FDA requirement: ${brief.regulatoryContext.fdaRequirement}
- Phase III design: ${brief.regulatoryContext.phaseIIIDesign}
- DSMB: ${brief.regulatoryContext.dsmbRequired}
- BP stopping rules: ${brief.regulatoryContext.bpStoppingRules}

FINANCIAL CONTEXT (for governance awareness only — PC-003 applies):
- R&D investment: ${brief.financialContext.rdInvestment}
- Strategic imperative: ${brief.financialContext.strategicImperative}
- Pfizer statement: ${brief.financialContext.pfizer_statement}

=== YOUR TASK ===
As ${persona.name} (${persona.role}), evaluate whether Pfizer should advance torcetrapib to Phase III.

IMPORTANT: You are evaluating this decision as if it is ${brief.decisionDate}. You have NO knowledge of what happened after this date. You are working only from the evidence above.

Respond with ONLY this JSON object (no other text):
{
  "vote": "GO" | "WAIT" | "NO-GO",
  "confidence": <integer 0-100>,
  "rationale": "<max 80 words — your core reasoning>",
  "keyFlags": ["<flag 1>", "<flag 2>", "<flag 3>"],
  "constitutionRules": ["<rule ID 1>", "<rule ID 2>"],
  "safetyObjection": "<specific safety concern or null>",
  "regulatoryRisk": "<specific regulatory risk or null>"
}`;
}

async function runPersonaWithTimeout(
  persona: typeof PHARMA_PERSONAS[0],
  prompt: string
): Promise<PharmaPersonaVote> {
  const timeoutPromise = new Promise<PharmaPersonaVote>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), PERSONA_TIMEOUT_MS)
  );

  const llmPromise = (async (): Promise<PharmaPersonaVote> => {
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = response?.choices?.[0]?.message?.content ?? "";
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      personaId:         persona.id,
      personaName:       persona.name,
      personaRole:       persona.role,
      vote:              parsed.vote as "GO" | "WAIT" | "NO-GO",
      confidence:        Number(parsed.confidence) || 50,
      rationale:         String(parsed.rationale || "").slice(0, 500),
      keyFlags:          Array.isArray(parsed.keyFlags) ? parsed.keyFlags.slice(0, 3) : [],
      constitutionRules: Array.isArray(parsed.constitutionRules) ? parsed.constitutionRules : [],
      safetyObjection:   parsed.safetyObjection || null,
      regulatoryRisk:    parsed.regulatoryRisk || null,
      timedOut:          false,
    };
  })();

  try {
    return await Promise.race([llmPromise, timeoutPromise]);
  } catch (err) {
    // Return a timed-out / fallback vote
    return {
      personaId:         persona.id,
      personaName:       persona.name,
      personaRole:       persona.role,
      vote:              "WAIT",
      confidence:        0,
      rationale:         "Agent timed out or returned malformed response.",
      keyFlags:          [],
      constitutionRules: [],
      safetyObjection:   null,
      regulatoryRisk:    null,
      timedOut:          true,
    };
  }
}

function deriveVerdict(votes: PharmaPersonaVote[]): "GO" | "WAIT" | "NO-GO" {
  const goCount   = votes.filter(v => v.vote === "GO").length;
  const waitCount = votes.filter(v => v.vote === "WAIT").length;
  const noGoCount = votes.filter(v => v.vote === "NO-GO").length;

  // NO-GO if ≥4 votes
  if (noGoCount >= 4) return "NO-GO";
  // WAIT if ≥4 votes or WAIT > GO
  if (waitCount >= 4 || waitCount > goCount) return "WAIT";
  // GO only if clear majority
  if (goCount >= 6) return "GO";
  // Default to WAIT for ambiguous cases
  return "WAIT";
}

function computeProofScore(votes: PharmaPersonaVote[]): number {
  // Proof score = weighted average confidence of non-timed-out personas
  const valid = votes.filter(v => !v.timedOut);
  if (valid.length === 0) return 0;

  const totalWeight = PHARMA_PERSONAS.reduce((sum, p) => sum + p.weight, 0);
  let weightedConf = 0;
  for (const vote of valid) {
    const persona = PHARMA_PERSONAS.find(p => p.id === vote.personaId);
    const weight = persona?.weight ?? 5;
    weightedConf += (vote.confidence / 100) * weight;
  }
  return Math.round((weightedConf / totalWeight) * 100);
}

export async function runPharmaCouncilV1(): Promise<PharmaCouncilResult> {
  const startMs = Date.now();
  const sessionId = `PHARMA-RETRO-TORCETRAPIB-${Date.now()}`;

  const brief = TORCETRAPIB_DECISION_BRIEF;
  const constitution = PHARMA_CONSTITUTION_V1;

  // Run all 10 personas in parallel
  const votePromises = PHARMA_PERSONAS.map(persona => {
    const prompt = buildPersonaPrompt(persona, brief, constitution);
    return runPersonaWithTimeout(persona, prompt);
  });

  const votes = await Promise.all(votePromises);

  const goCount   = votes.filter(v => v.vote === "GO").length;
  const waitCount = votes.filter(v => v.vote === "WAIT").length;
  const noGoCount = votes.filter(v => v.vote === "NO-GO").length;

  const verdict = deriveVerdict(votes);

  const keyBlockers = votes
    .filter(v => v.vote !== "GO" && v.keyFlags.length > 0)
    .flatMap(v => v.keyFlags)
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .slice(0, 6);

  const safetyObjections = votes
    .filter(v => v.safetyObjection)
    .map(v => `${v.personaName}: ${v.safetyObjection}`)
    .slice(0, 5);

  const regulatoryConcerns = votes
    .filter(v => v.regulatoryRisk)
    .map(v => `${v.personaName}: ${v.regulatoryRisk}`)
    .slice(0, 5);

  const verdictRationale =
    verdict === "WAIT"
      ? `${waitCount + noGoCount} of 10 council members voted WAIT or NO-GO. The primary blocker is the unresolved systolic blood pressure signal (+2 mmHg) in the Phase II dataset, which requires mechanistic investigation before enrolling 15,000 high-cardiovascular-risk patients in Phase III.`
      : verdict === "NO-GO"
      ? `${noGoCount} of 10 council members voted NO-GO. The blood pressure signal is deemed a disqualifying safety concern that cannot be offset by the lipid efficacy data.`
      : `${goCount} of 10 council members voted GO. The council accepts the risk-benefit profile with conditions.`;

  return {
    sessionId,
    drug:              brief.drug,
    company:           brief.company,
    decisionDate:      brief.decisionDate,
    evidenceCutoff:    brief.evidenceCutoff,
    verdict,
    verdictRationale,
    goCount,
    waitCount,
    noGoCount,
    votes,
    keyBlockers,
    safetyObjections,
    regulatoryConcerns,
    constitutionVersion: constitution.version,
    proofScore:        computeProofScore(votes),
    durationMs:        Date.now() - startMs,
    evidenceBoundaryStatement: brief.evidenceBoundaryStatement,
  };
}
