/**
 * procurementEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Procurement / Vendor Evaluation Engine — v2 (Enterprise Grade)
 *
 * 8 domain-specific agents:
 *   1. Cost Optimization Agent
 *   2. Vendor Risk Agent
 *   3. Technical Integration Agent
 *   4. Security & Data Risk Agent
 *   5. Compliance / Regulatory Agent
 *   6. Operational Scalability Agent
 *   7. Contract & Legal Agent
 *   8. Devil's Advocate Agent (always argues for rejection)
 *
 * Features:
 *   - Strict structured output per agent (Score, Key Reasoning, Top Risks, Confidence)
 *   - Disagreement logic: agents challenge assumptions and flag contradictions
 *   - INSUFFICIENT DATA override: blocks scoring if input is too sparse
 *   - Enhanced consensus: conflicting scores, highest-risk dimensions, decision rationale
 *   - Top Decision Drivers (3–5 items) in final report
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcurementInput {
  vendorName: string;
  proposalText: string;
  category: string;
  contractValue?: string;
  duration?: string;
  requirements?: string;
  additionalContext?: string;
}

export interface AgentScore {
  agentId: string;
  agentName: string;
  agentRole: string;
  score: number;                  // 0–10
  verdict: "APPROVE" | "REJECT" | "CONDITIONAL";
  confidence: "High" | "Medium" | "Low";
  keyReasoning: string;
  topRisks: string[];
  redFlags: string[];
  positives: string[];
}

export interface TriageResult {
  relevance: "RELEVANT" | "NOT_RELEVANT";
  dataQuality: "SUFFICIENT" | "INSUFFICIENT";
  basicRiskFlags: string[];
  missingFields: string[];
  summary: string;
}

export interface ConsensusResult {
  averageScore: number;
  approveCount: number;
  rejectCount: number;
  conditionalCount: number;
  majorDisagreements: string[];
  highestRiskAreas: string[];
  overallConfidence: "High" | "Medium" | "Low";
  decisionRationale: string;      // NEW: why the final decision was reached
  conflictingScoringPairs: string[]; // NEW: pairs of agents with >3pt gap
}

export interface VendorEvaluationReport {
  vendorName: string;
  category: string;
  insufficientData: boolean;      // NEW: true if triage flagged INSUFFICIENT
  finalRecommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL" | "INSUFFICIENT_DATA";
  recommendationRationale: string;
  overallScore: number;
  overallConfidence: "High" | "Medium" | "Low";
  agentScores: AgentScore[];
  consensus: ConsensusResult;
  topDecisionDrivers: string[];   // NEW: 3–5 most impactful factors
  topRisks: string[];
  suggestedNegotiationPoints: string[];
  missingRequiredInformation: string[];
  triage: TriageResult;
  generatedAt: number;
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

interface ProcurementAgent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
}

const PROCUREMENT_AGENTS: ProcurementAgent[] = [
  {
    id: "cost_optimization",
    name: "Cost Optimization Agent",
    role: "Pricing structure, TCO, hidden costs",
    systemPrompt: `You are a senior procurement cost analyst specializing in total cost of ownership (TCO) and pricing structure evaluation. Your mandate is to determine whether this vendor delivers genuine financial value — or whether the buyer is being overcharged.

Your evaluation framework:
- Pricing competitiveness vs market benchmarks for this category
- Hidden costs: implementation, training, maintenance, migration, exit fees
- Payment terms, penalties, and flexibility
- ROI potential and cost reduction opportunities
- Whether the pricing model penalizes growth (per-seat, per-transaction, etc.)

Disagreement instruction: If pricing data is vague, incomplete, or suspiciously low/high — challenge it. Do not accept "competitive pricing" without specifics. Flag any cost structure that creates vendor leverage.

If uncertainty exists, challenge assumptions and highlight potential contradictions in the pricing model.`,
  },
  {
    id: "vendor_risk",
    name: "Vendor Risk Agent",
    role: "Vendor stability, dependency risk, concentration risk",
    systemPrompt: `You are a vendor risk manager specializing in third-party risk assessment. Your mandate is to evaluate the risk of depending on this vendor — especially failure scenarios and concentration risk.

Your evaluation framework:
- Vendor financial stability: funding, revenue, burn rate, profitability signals
- Market position: is this vendor a market leader, challenger, or at risk of being acquired/shut down?
- Key person dependency: what happens if the founding team leaves?
- Concentration risk: is this a single point of failure for a critical function?
- Exit strategy: how hard is it to leave this vendor? Data portability? Migration costs?
- Track record: reference clients, case studies, failure history
- Geopolitical exposure: jurisdiction, sanctions risk, data sovereignty

Disagreement instruction: Assume the worst case if data is missing. A vendor that cannot demonstrate financial stability is a liability. Challenge any claims of stability without evidence.

If uncertainty exists, challenge assumptions and highlight potential contradictions in the vendor's stability claims.`,
  },
  {
    id: "technical_integration",
    name: "Technical Integration Agent",
    role: "Integration complexity, compatibility, implementation effort",
    systemPrompt: `You are an enterprise integration architect evaluating the complexity and risk of integrating this vendor into existing systems.

Your evaluation framework:
- API quality: REST/GraphQL maturity, versioning policy, documentation completeness
- Supported integration patterns: webhooks, event streaming, EDI, batch
- Pre-built connectors for common enterprise systems (ERP, CRM, HRMS)
- Data format standards and transformation requirements
- Estimated integration effort: weeks or months?
- Ongoing maintenance burden: how often do APIs break?
- Vendor lock-in through proprietary data formats or closed APIs
- Implementation track record: what do actual customers say about integration complexity?

Disagreement instruction: Be realistic about integration costs — they are systematically underestimated. If the vendor claims "plug-and-play" integration, challenge it. Flag any "black box" integrations or missing API documentation.

If uncertainty exists, challenge assumptions and highlight potential contradictions between claimed and demonstrated integration capability.`,
  },
  {
    id: "security_data_risk",
    name: "Security & Data Risk Agent",
    role: "Data exposure, security vulnerabilities, data residency, access control",
    systemPrompt: `You are a cybersecurity and data protection specialist. Your mandate is to evaluate the security posture of this vendor and the risk of data exposure.

Your evaluation framework:
- Security certifications: SOC 2 Type II, ISO 27001, penetration testing reports
- Data encryption: in transit (TLS 1.2+) and at rest (AES-256)
- Access control: MFA, RBAC, privileged access management
- Data residency: where is data stored? Does it cross jurisdictions?
- Incident response: breach notification SLA, incident history
- Data retention and deletion: can data be purged on contract termination?
- Third-party sub-processors: who else has access to buyer data?
- Vulnerability disclosure program: does the vendor have a responsible disclosure policy?

Disagreement instruction: Treat security gaps as blocking issues. A vendor with poor security is a liability regardless of other strengths. If certifications are missing or outdated, flag as a hard blocker.

If uncertainty exists, challenge assumptions and highlight potential contradictions in the vendor's security claims.`,
  },
  {
    id: "compliance_regulatory",
    name: "Compliance / Regulatory Agent",
    role: "Regulatory alignment, jurisdiction risks, auditability, policy compliance",
    systemPrompt: `You are a compliance and regulatory specialist. Your mandate is to evaluate whether this vendor meets all applicable regulatory and policy requirements.

Your evaluation framework:
- Industry certifications: ISO 9001, ISO 27001, SOC 2, GDPR, HIPAA, PCI-DSS as applicable
- Data sovereignty: does the vendor comply with local data residency laws?
- Anti-bribery and ethics: FCPA, UK Bribery Act, local equivalents
- ESG and sustainability commitments: carbon footprint, labor practices, supply chain ethics
- Audit rights: can the buyer audit the vendor? How often? At what cost?
- Regulatory change risk: is the vendor's business model at risk from upcoming regulation?
- Sanctions and export controls: is the vendor or its technology subject to restrictions?

Disagreement instruction: Missing certifications are red flags, not minor issues. Vague compliance language ("we comply with all applicable laws") is not acceptable. Challenge any compliance claim without a verifiable certificate or audit report.

If uncertainty exists, challenge assumptions and highlight potential contradictions in compliance claims.`,
  },
  {
    id: "operational_scalability",
    name: "Operational Scalability Agent",
    role: "Ability to scale, operational load, reliability under stress",
    systemPrompt: `You are a capacity planning and operational reliability specialist. Your mandate is to evaluate whether this vendor can scale with the buyer's growth and maintain reliability under stress.

Your evaluation framework:
- Current capacity limits and documented headroom
- Scaling mechanisms: horizontal, vertical, geographic distribution
- Multi-region or global delivery capability
- Pricing model at scale: does cost grow linearly, sub-linearly, or exponentially?
- SLA: uptime guarantees, RTO/RPO, penalty mechanisms
- Historical reliability: known outages, incident post-mortems
- Operational support model: 24/7 support? Dedicated account management?
- Roadmap alignment: does the vendor's 3-year roadmap match the buyer's growth trajectory?

Disagreement instruction: A vendor that works today but breaks at 10x volume is a liability. Challenge any SLA that lacks teeth (no financial penalties). Flag any scaling claims without reference customer evidence.

If uncertainty exists, challenge assumptions and highlight potential contradictions in scalability claims.`,
  },
  {
    id: "contract_legal",
    name: "Contract & Legal Agent",
    role: "Contract risks, liability, lock-in clauses, unfavorable terms",
    systemPrompt: `You are a commercial contracts specialist. Your mandate is to evaluate the legal and contractual risk of this vendor engagement — and to protect the buyer's interests.

Your evaluation framework:
- Liability caps: are they proportionate to contract value? Are consequential damages excluded?
- Indemnification: who bears the risk of third-party IP claims?
- IP ownership: who owns work product, customizations, and data?
- Termination rights: can the buyer exit for convenience? What is the notice period?
- Auto-renewal and lock-in: are there hidden auto-renewal clauses or minimum commit traps?
- SLA remedies: are service credits meaningful or symbolic?
- Governing law and dispute resolution: is the jurisdiction favorable to the buyer?
- Data processing agreement (DPA): GDPR-compliant? Who is controller vs processor?
- Change of control: what happens if the vendor is acquired?

Disagreement instruction: Be protective of the buyer's interests. Flag any terms that limit remedies, create asymmetric risk, or give the vendor unilateral power to change terms. A contract that looks good on the surface may contain buried lock-in provisions.

If uncertainty exists, challenge assumptions and highlight potential contradictions in the contract terms.`,
  },
  {
    id: "devils_advocate",
    name: "Devil's Advocate Agent",
    role: "Adversarial challenge — argues for rejection",
    systemPrompt: `You are the Devil's Advocate in this procurement evaluation. Your role is fundamentally different from all other agents: you are NOT trying to be balanced. You are specifically tasked with identifying every reason this vendor should be REJECTED.

Your mandate:
- Actively argue for rejection, even if other agents are positive
- Identify the worst-case scenarios that other agents may have glossed over
- Challenge the vendor's claims, track record, and promises
- Surface hidden risks that optimistic evaluators would miss
- Question whether the buyer actually needs this vendor at all
- Identify alternative approaches that would avoid this vendor entirely
- Highlight what happens if this vendor fails, is acquired, or raises prices 3x

Critical instruction: You MUST find reasons to reject. If the proposal seems strong, dig deeper. Every vendor has weaknesses — your job is to find them and make them impossible to ignore. Score conservatively (0–5 range). Your verdict should almost always be REJECT or CONDITIONAL.

Identify reasons this vendor should be rejected, even if others recommend approval.`,
  },
];

// ─── Triage Layer ─────────────────────────────────────────────────────────────

export async function runProcurementTriage(
  input: ProcurementInput
): Promise<TriageResult> {
  const contextText = buildContext(input);

  const prompt = `You are a procurement triage specialist. Quickly assess whether the following vendor proposal is relevant and has sufficient data for a full evaluation.

VENDOR PROPOSAL:
${contextText}

Return ONLY valid JSON matching this exact schema:
{
  "relevance": "RELEVANT" | "NOT_RELEVANT",
  "dataQuality": "SUFFICIENT" | "INSUFFICIENT",
  "basicRiskFlags": ["string", ...],
  "missingFields": ["string", ...],
  "summary": "One sentence summary of the proposal"
}

Rules:
- RELEVANT = the proposal describes a real vendor/product/service for procurement
- SUFFICIENT = enough information exists for agents to evaluate meaningfully (needs: vendor description, pricing or budget context, technical scope, and at least one compliance/security reference)
- INSUFFICIENT = critical information is missing (no pricing, no technical details, no compliance info, or proposal is too vague to evaluate)
- basicRiskFlags = obvious red flags visible without deep analysis (max 3)
- missingFields = critical missing information (pricing, technical specs, compliance certs, security posture, contract terms, etc.)
- Be strict: if pricing is missing, flag it. If no technical details, flag it. If no compliance information, flag it.
- A proposal under 50 words is almost certainly INSUFFICIENT.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a procurement triage specialist. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "triage_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              relevance: { type: "string", enum: ["RELEVANT", "NOT_RELEVANT"] },
              dataQuality: { type: "string", enum: ["SUFFICIENT", "INSUFFICIENT"] },
              basicRiskFlags: { type: "array", items: { type: "string" } },
              missingFields: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
            },
            required: ["relevance", "dataQuality", "basicRiskFlags", "missingFields", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("No triage response");
    return JSON.parse(content) as TriageResult;
  } catch {
    return {
      relevance: "RELEVANT",
      dataQuality: "INSUFFICIENT",
      basicRiskFlags: ["Unable to parse proposal — manual review required"],
      missingFields: ["Full proposal details"],
      summary: "Triage could not be completed — insufficient structured data",
    };
  }
}

// ─── Agent Evaluation ─────────────────────────────────────────────────────────

async function callProcurementAgent(
  agent: ProcurementAgent,
  context: string
): Promise<AgentScore> {
  const isDevilsAdvocate = agent.id === "devils_advocate";

  const userMessage = `VENDOR PROPOSAL FOR EVALUATION:
${context}

Evaluate this vendor proposal from your specialist perspective. Return ONLY valid JSON.

STRICT OUTPUT FORMAT — you MUST use this exact structure:
{
  "score": <integer 0-10>,
  "verdict": "APPROVE" | "REJECT" | "CONDITIONAL",
  "confidence": "High" | "Medium" | "Low",
  "keyReasoning": "<2-3 sentences, specific and direct — no generic statements>",
  "topRisks": ["<specific risk 1>", "<specific risk 2>", "<specific risk 3>"],
  "redFlags": ["<specific red flag 1>", "<specific red flag 2>"],
  "positives": ["<specific positive 1>", "<specific positive 2>"]
}

Scoring guide:
- 8-10: Strong approval, clear value, minimal risk
- 6-7: Conditional approval, manageable concerns
- 4-5: Significant concerns, needs major changes before approval
- 0-3: Reject — fundamental issues that cannot be negotiated away

${isDevilsAdvocate ? "CRITICAL: Your score MUST be in the 0–5 range. Your verdict should be REJECT or CONDITIONAL. Find reasons to reject." : ""}

Rules:
- Be specific. Reference actual details from the proposal.
- No generic statements like "the vendor seems capable" — cite specifics.
- If data is missing for your domain, lower your confidence and flag it.
- Challenge any vague claims. Demand specifics.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "agent_score",
          strict: true,
          schema: {
            type: "object",
            properties: {
              score: { type: "number" },
              verdict: { type: "string", enum: ["APPROVE", "REJECT", "CONDITIONAL"] },
              confidence: { type: "string", enum: ["High", "Medium", "Low"] },
              keyReasoning: { type: "string" },
              topRisks: { type: "array", items: { type: "string" } },
              redFlags: { type: "array", items: { type: "string" } },
              positives: { type: "array", items: { type: "string" } },
            },
            required: ["score", "verdict", "confidence", "keyReasoning", "topRisks", "redFlags", "positives"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("No agent response");
    const parsed = JSON.parse(content);

    // Enforce Devil's Advocate score cap
    let score = Math.max(0, Math.min(10, Number(parsed.score) || 5));
    if (isDevilsAdvocate) score = Math.min(score, 5);

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      score,
      verdict: parsed.verdict || "CONDITIONAL",
      confidence: parsed.confidence || "Medium",
      keyReasoning: parsed.keyReasoning || "Unable to evaluate",
      topRisks: Array.isArray(parsed.topRisks) ? parsed.topRisks.slice(0, 3) : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.slice(0, 3) : [],
      positives: Array.isArray(parsed.positives) ? parsed.positives.slice(0, 3) : [],
    };
  } catch {
    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      score: isDevilsAdvocate ? 2 : 5,
      verdict: isDevilsAdvocate ? "REJECT" : "CONDITIONAL",
      confidence: "Low",
      keyReasoning: "Evaluation could not be completed — insufficient data to assess this dimension",
      topRisks: ["Insufficient data for evaluation"],
      redFlags: [],
      positives: [],
    };
  }
}

// ─── Consensus Layer ──────────────────────────────────────────────────────────

function buildConsensus(agentScores: AgentScore[]): ConsensusResult {
  const scores = agentScores.map((a) => a.score);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const approveCount = agentScores.filter((a) => a.verdict === "APPROVE").length;
  const rejectCount = agentScores.filter((a) => a.verdict === "REJECT").length;
  const conditionalCount = agentScores.filter((a) => a.verdict === "CONDITIONAL").length;

  // Identify major disagreements: agents with scores more than 3 points from average
  const majorDisagreements: string[] = [];
  agentScores.forEach((a) => {
    if (Math.abs(a.score - averageScore) > 3) {
      const direction = a.score > averageScore ? "significantly more positive" : "significantly more negative";
      majorDisagreements.push(
        `${a.agentName} is ${direction} (${a.score}/10 vs avg ${averageScore.toFixed(1)})`
      );
    }
  });

  // Identify conflicting scoring pairs (agents with >3pt gap between them)
  const conflictingScoringPairs: string[] = [];
  for (let i = 0; i < agentScores.length; i++) {
    for (let j = i + 1; j < agentScores.length; j++) {
      const gap = Math.abs(agentScores[i].score - agentScores[j].score);
      if (gap >= 4) {
        conflictingScoringPairs.push(
          `${agentScores[i].agentName} (${agentScores[i].score}/10) vs ${agentScores[j].agentName} (${agentScores[j].score}/10) — ${gap}pt gap`
        );
      }
    }
  }

  // Identify highest risk areas: lowest-scoring non-devil's-advocate agents
  const nonDAAgents = agentScores.filter((a) => a.agentId !== "devils_advocate");
  const lowestScoringAgents = [...nonDAAgents].sort((a, b) => a.score - b.score).slice(0, 3);
  const highestRiskAreas = lowestScoringAgents.map(
    (a) => `${a.agentRole} (score: ${a.score}/10)`
  );

  // Overall confidence
  const highConf = agentScores.filter((a) => a.confidence === "High").length;
  const lowConf = agentScores.filter((a) => a.confidence === "Low").length;
  const overallConfidence: "High" | "Medium" | "Low" =
    highConf >= agentScores.length / 2 ? "High" : lowConf >= agentScores.length / 2 ? "Low" : "Medium";

  // Decision rationale
  let decisionRationale = "";
  if (averageScore >= 7.5 && rejectCount === 0) {
    decisionRationale = `Strong consensus for approval: ${approveCount} agents approve with an average score of ${averageScore.toFixed(1)}/10. No blocking rejections.`;
  } else if (averageScore < 4.5 || rejectCount >= 3) {
    decisionRationale = `Consensus leans toward rejection: average score ${averageScore.toFixed(1)}/10 with ${rejectCount} outright rejections. Fundamental issues identified across multiple dimensions.`;
  } else {
    decisionRationale = `Mixed signals: ${approveCount} approve, ${conditionalCount} conditional, ${rejectCount} reject. Average score ${averageScore.toFixed(1)}/10 indicates conditional approval with conditions to be resolved before proceeding.`;
  }

  if (conflictingScoringPairs.length > 0) {
    decisionRationale += ` Significant scoring conflicts detected between agents, indicating genuine uncertainty in this evaluation.`;
  }

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    approveCount,
    rejectCount,
    conditionalCount,
    majorDisagreements,
    highestRiskAreas,
    overallConfidence,
    decisionRationale,
    conflictingScoringPairs,
  };
}

// ─── Final Recommendation with Top Decision Drivers ───────────────────────────

async function buildFinalRecommendation(
  input: ProcurementInput,
  agentScores: AgentScore[],
  consensus: ConsensusResult,
  triage: TriageResult
): Promise<{
  recommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL";
  rationale: string;
  topDecisionDrivers: string[];
  topRisks: string[];
  negotiationPoints: string[];
  missingInfo: string[];
}> {
  const scoresSummary = agentScores
    .map((a) => `${a.agentName}: ${a.score}/10 (${a.verdict}) — ${a.keyReasoning}`)
    .join("\n");

  const allRisks = agentScores.flatMap((a) => a.topRisks);
  const allRedFlags = agentScores.flatMap((a) => a.redFlags);

  const prompt = `You are the Chief Procurement Officer making the final call on this vendor evaluation.

VENDOR: ${input.vendorName}
CATEGORY: ${input.category}
AVERAGE SCORE: ${consensus.averageScore}/10
VOTES: ${consensus.approveCount} APPROVE / ${consensus.conditionalCount} CONDITIONAL / ${consensus.rejectCount} REJECT
CONFLICTS: ${consensus.conflictingScoringPairs.length > 0 ? consensus.conflictingScoringPairs.join("; ") : "None"}

AGENT ASSESSMENTS:
${scoresSummary}

ALL IDENTIFIED RISKS:
${allRisks.join("\n")}

RED FLAGS:
${allRedFlags.join("\n")}

TRIAGE NOTES:
${triage.summary}
Missing: ${triage.missingFields.join(", ")}

Make the final procurement decision. Return ONLY valid JSON:
{
  "recommendation": "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL",
  "rationale": "<2-3 sentences, direct and opinionated — state your reasoning clearly>",
  "topDecisionDrivers": ["<most impactful factor 1>", "<most impactful factor 2>", "<most impactful factor 3>", "<most impactful factor 4>"],
  "topRisks": ["<top risk 1>", "<top risk 2>", "<top risk 3>", "<top risk 4>", "<top risk 5>"],
  "negotiationPoints": ["<negotiation point 1>", "<negotiation point 2>", "<negotiation point 3>"],
  "missingInfo": ["<missing item 1>", "<missing item 2>"]
}

Decision rules:
- APPROVE: avg score >= 7.5, no REJECT votes from security/legal/compliance agents
- REJECT: avg score < 4.5, or any hard blocking issue from security/legal/compliance
- CONDITIONAL_APPROVAL: everything else — specify conditions clearly in rationale

Top Decision Drivers must be the 3–5 most impactful factors behind the decision. Examples:
- "Cost advantage vs alternatives (30% below market benchmark)"
- "High integration complexity — estimated 6-month implementation"
- "Data residency concerns — vendor stores data in non-compliant jurisdiction"
- "Devil's Advocate flagged no viable exit strategy"
These should be specific, not generic.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a Chief Procurement Officer. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "final_recommendation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendation: { type: "string", enum: ["APPROVE", "REJECT", "CONDITIONAL_APPROVAL"] },
              rationale: { type: "string" },
              topDecisionDrivers: { type: "array", items: { type: "string" } },
              topRisks: { type: "array", items: { type: "string" } },
              negotiationPoints: { type: "array", items: { type: "string" } },
              missingInfo: { type: "array", items: { type: "string" } },
            },
            required: ["recommendation", "rationale", "topDecisionDrivers", "topRisks", "negotiationPoints", "missingInfo"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("No final recommendation response");
    return JSON.parse(content);
  } catch {
    // Rule-based fallback
    let recommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL" = "CONDITIONAL_APPROVAL";
    if (consensus.averageScore >= 7.5 && consensus.rejectCount === 0) recommendation = "APPROVE";
    else if (consensus.averageScore < 4.5 || consensus.rejectCount >= 3) recommendation = "REJECT";

    return {
      recommendation,
      rationale: `Based on an average score of ${consensus.averageScore}/10 with ${consensus.approveCount} approvals, ${consensus.conditionalCount} conditionals, and ${consensus.rejectCount} rejections.`,
      topDecisionDrivers: [
        `Average score: ${consensus.averageScore}/10`,
        `${consensus.rejectCount} agents voted to reject`,
        consensus.highestRiskAreas[0] || "Multiple risk dimensions flagged",
      ],
      topRisks: allRisks.slice(0, 5),
      negotiationPoints: ["Review pricing structure", "Clarify SLA terms", "Negotiate exit provisions"],
      missingInfo: triage.missingFields,
    };
  }
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContext(input: ProcurementInput): string {
  const parts: string[] = [];
  parts.push(`VENDOR NAME: ${input.vendorName}`);
  parts.push(`CATEGORY: ${input.category}`);
  if (input.contractValue) parts.push(`CONTRACT VALUE: ${input.contractValue}`);
  if (input.duration) parts.push(`CONTRACT DURATION: ${input.duration}`);
  if (input.requirements) parts.push(`\nBUYER REQUIREMENTS:\n${input.requirements}`);
  parts.push(`\nVENDOR PROPOSAL:\n${input.proposalText}`);
  if (input.additionalContext) parts.push(`\nADDITIONAL CONTEXT:\n${input.additionalContext}`);
  return parts.join("\n");
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runProcurementCouncil(
  input: ProcurementInput
): Promise<VendorEvaluationReport> {
  const context = buildContext(input);

  // 1. Triage — check data quality first
  const triage = await runProcurementTriage(input);

  // 2. INSUFFICIENT DATA override — if triage says data is insufficient, short-circuit
  if (triage.dataQuality === "INSUFFICIENT") {
    return {
      vendorName: input.vendorName,
      category: input.category,
      insufficientData: true,
      finalRecommendation: "INSUFFICIENT_DATA",
      recommendationRationale:
        "INSUFFICIENT DATA — Cannot make a reliable procurement decision. The proposal lacks the minimum information required for a structured evaluation. Provide the missing information listed below and resubmit.",
      overallScore: 0,
      overallConfidence: "Low",
      agentScores: [],
      consensus: {
        averageScore: 0,
        approveCount: 0,
        rejectCount: 0,
        conditionalCount: 0,
        majorDisagreements: [],
        highestRiskAreas: [],
        overallConfidence: "Low",
        decisionRationale: "Evaluation blocked — insufficient data to proceed.",
        conflictingScoringPairs: [],
      },
      topDecisionDrivers: ["Insufficient data to identify decision drivers"],
      topRisks: triage.basicRiskFlags,
      suggestedNegotiationPoints: [],
      missingRequiredInformation: triage.missingFields,
      triage,
      generatedAt: Date.now(),
    };
  }

  // 3. Run all 8 agents in parallel
  const agentScores = await Promise.all(
    PROCUREMENT_AGENTS.map((agent) => callProcurementAgent(agent, context))
  );

  // 4. Consensus
  const consensus = buildConsensus(agentScores);

  // 5. Final recommendation with Top Decision Drivers
  const final = await buildFinalRecommendation(input, agentScores, consensus, triage);

  return {
    vendorName: input.vendorName,
    category: input.category,
    insufficientData: false,
    finalRecommendation: final.recommendation,
    recommendationRationale: final.rationale,
    overallScore: consensus.averageScore,
    overallConfidence: consensus.overallConfidence,
    agentScores,
    consensus,
    topDecisionDrivers: final.topDecisionDrivers.slice(0, 5),
    topRisks: final.topRisks,
    suggestedNegotiationPoints: final.negotiationPoints,
    missingRequiredInformation: [...final.missingInfo, ...triage.missingFields].filter(
      (v, i, arr) => arr.indexOf(v) === i
    ),
    triage,
    generatedAt: Date.now(),
  };
}

export { PROCUREMENT_AGENTS };
