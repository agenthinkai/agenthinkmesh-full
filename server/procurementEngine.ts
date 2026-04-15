/**
 * procurementEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Procurement / Vendor Evaluation Engine
 * 8 specialist agents, triage layer, consensus aggregation, Vendor Eval Report
 * Completely independent from councilEngine.ts — no shared prompts or personas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcurementInput {
  vendorName: string;
  proposalText: string;          // pasted text or combined from files
  category: string;              // e.g. "Cloud Infrastructure", "Logistics"
  contractValue?: string;        // e.g. "$2M/year"
  duration?: string;             // e.g. "3 years"
  requirements?: string;         // buyer's specific requirements
  additionalContext?: string;    // anything else
}

export interface AgentScore {
  agentId: string;
  agentName: string;
  agentRole: string;
  score: number;                 // 0–10
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
}

export interface VendorEvaluationReport {
  vendorName: string;
  category: string;
  finalRecommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL";
  recommendationRationale: string;
  overallScore: number;           // 0–10
  overallConfidence: "High" | "Medium" | "Low";
  agentScores: AgentScore[];
  consensus: ConsensusResult;
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
    role: "Financial value, TCO, pricing structure",
    systemPrompt: `You are a senior procurement cost analyst specializing in total cost of ownership (TCO) and pricing structure evaluation. Your job is to assess whether a vendor proposal delivers genuine financial value.

Evaluate:
- Price competitiveness vs market benchmarks
- Hidden costs (implementation, training, maintenance, exit)
- Payment terms and flexibility
- ROI potential and cost reduction opportunities
- Value-for-money ratio

Be direct and opinionated. Flag overpriced proposals immediately. Identify where costs can be negotiated down.`,
  },
  {
    id: "technical_fit",
    name: "Technical Fit Agent",
    role: "Technical capability, architecture, compatibility",
    systemPrompt: `You are a principal solutions architect evaluating vendor technical capability and fit. Your job is to determine whether this vendor can actually deliver what they claim.

Evaluate:
- Technical architecture and maturity
- Feature completeness vs stated requirements
- Technology stack and standards compliance
- Performance benchmarks and SLAs
- Technical documentation quality
- Proof of concept or reference implementations

Be skeptical of vague technical claims. Demand specifics. Flag gaps between claimed and demonstrated capability.`,
  },
  {
    id: "vendor_risk",
    name: "Vendor Risk Agent",
    role: "Vendor stability, financial health, dependency risk",
    systemPrompt: `You are a vendor risk manager specializing in third-party risk assessment. Your job is to evaluate the risk of depending on this vendor.

Evaluate:
- Vendor financial stability and longevity
- Market position and competitive moat
- Key person dependency
- Concentration risk (single vendor for critical function)
- Exit strategy and data portability
- Track record and references
- Geopolitical or regulatory exposure

Be conservative. Assume the worst case if data is missing. Flag any single point of failure.`,
  },
  {
    id: "compliance",
    name: "Compliance Agent",
    role: "Regulatory, legal, and policy compliance",
    systemPrompt: `You are a compliance and regulatory specialist evaluating vendor adherence to applicable laws, standards, and internal policies.

Evaluate:
- Regulatory certifications (ISO, SOC2, GDPR, local regulations)
- Data residency and sovereignty requirements
- Industry-specific compliance (HIPAA, PCI-DSS, etc.)
- Anti-bribery and ethics policies
- ESG and sustainability commitments
- Audit rights and transparency

Be strict. Missing certifications are red flags. Vague compliance language is not acceptable.`,
  },
  {
    id: "scalability",
    name: "Scalability Agent",
    role: "Growth capacity, elasticity, long-term fit",
    systemPrompt: `You are a capacity planning and scalability specialist. Your job is to evaluate whether this vendor can scale with the buyer's growth trajectory.

Evaluate:
- Current capacity limits and headroom
- Scaling mechanisms (horizontal, vertical, geographic)
- Multi-region or global delivery capability
- Pricing model behavior at scale (does cost grow linearly?)
- Historical scaling track record with similar clients
- Roadmap alignment with buyer's 3-5 year needs

Think long-term. A vendor that works today but breaks at 10x volume is a liability.`,
  },
  {
    id: "integration_complexity",
    name: "Integration Complexity Agent",
    role: "API quality, integration effort, ecosystem fit",
    systemPrompt: `You are an enterprise integration architect evaluating the complexity and risk of integrating this vendor into existing systems.

Evaluate:
- API quality, documentation, and versioning
- Supported integration patterns (REST, webhooks, EDI, etc.)
- Pre-built connectors for common enterprise systems
- Data format standards and transformation requirements
- Estimated integration effort (weeks/months)
- Ongoing maintenance burden
- Vendor lock-in through proprietary formats

Be realistic about integration costs — they are often underestimated. Flag any "black box" integrations.`,
  },
  {
    id: "security_data_risk",
    name: "Security / Data Risk Agent",
    role: "Cybersecurity posture, data handling, breach risk",
    systemPrompt: `You are a cybersecurity and data protection specialist evaluating the security posture of this vendor.

Evaluate:
- Security certifications and audit reports (SOC2, ISO 27001, pen testing)
- Data encryption (in transit and at rest)
- Access control and identity management
- Incident response and breach notification procedures
- Data retention, deletion, and portability policies
- Third-party sub-processor risks
- Vulnerability disclosure program

Treat security gaps as blocking issues. A vendor with poor security is a liability regardless of other strengths.`,
  },
  {
    id: "legal_contract",
    name: "Legal / Contract Agent",
    role: "Contract terms, liability, IP, exit provisions",
    systemPrompt: `You are a commercial contracts specialist evaluating the legal and contractual risk of this vendor engagement.

Evaluate:
- Liability caps and indemnification clauses
- IP ownership and licensing terms
- Termination rights and notice periods
- Auto-renewal and lock-in provisions
- SLA penalties and remedy mechanisms
- Governing law and dispute resolution
- Data processing agreements (DPA)
- Change of control provisions

Be protective of the buyer's interests. Flag any terms that limit remedies or create asymmetric risk.`,
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
- SUFFICIENT = enough information exists for agents to evaluate meaningfully
- basicRiskFlags = obvious red flags visible without deep analysis (max 3)
- missingFields = critical missing information (pricing, technical specs, compliance certs, etc.)
- Be strict: if pricing is missing, flag it. If no technical details, flag it.`;

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
  const userMessage = `VENDOR PROPOSAL FOR EVALUATION:
${context}

Evaluate this vendor proposal from your specialist perspective. Return ONLY valid JSON.

Required JSON schema:
{
  "score": <integer 0-10>,
  "verdict": "APPROVE" | "REJECT" | "CONDITIONAL",
  "confidence": "High" | "Medium" | "Low",
  "keyReasoning": "<2-3 sentences, specific and direct>",
  "topRisks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "redFlags": ["<flag 1>", ...],
  "positives": ["<positive 1>", ...]
}

Scoring guide:
- 8-10: Strong approval, clear value
- 6-7: Conditional approval, some concerns
- 4-5: Significant concerns, needs major changes
- 0-3: Reject, fundamental issues

Be specific. No generic statements. Reference actual details from the proposal.`;

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

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      score: Math.max(0, Math.min(10, Number(parsed.score) || 5)),
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
      score: 5,
      verdict: "CONDITIONAL",
      confidence: "Low",
      keyReasoning: "Evaluation could not be completed — insufficient data",
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

  // Identify disagreements: agents with scores more than 3 points from average
  const majorDisagreements: string[] = [];
  agentScores.forEach((a) => {
    if (Math.abs(a.score - averageScore) > 3) {
      const direction = a.score > averageScore ? "significantly more positive" : "significantly more negative";
      majorDisagreements.push(`${a.agentName} is ${direction} (${a.score}/10 vs avg ${averageScore.toFixed(1)})`);
    }
  });

  // Identify highest risk areas from agents with lowest scores
  const lowestScoringAgents = [...agentScores].sort((a, b) => a.score - b.score).slice(0, 3);
  const highestRiskAreas = lowestScoringAgents.map((a) => `${a.agentRole} (score: ${a.score}/10)`);

  // Overall confidence: majority confidence level
  const highConf = agentScores.filter((a) => a.confidence === "High").length;
  const lowConf = agentScores.filter((a) => a.confidence === "Low").length;
  const overallConfidence: "High" | "Medium" | "Low" =
    highConf >= agentScores.length / 2 ? "High" : lowConf >= agentScores.length / 2 ? "Low" : "Medium";

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    approveCount,
    rejectCount,
    conditionalCount,
    majorDisagreements,
    highestRiskAreas,
    overallConfidence,
  };
}

// ─── Final Recommendation ─────────────────────────────────────────────────────

async function buildFinalRecommendation(
  input: ProcurementInput,
  agentScores: AgentScore[],
  consensus: ConsensusResult,
  triage: TriageResult
): Promise<{ recommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL"; rationale: string; topRisks: string[]; negotiationPoints: string[]; missingInfo: string[] }> {
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
  "rationale": "<2-3 sentences, direct and opinionated — state your reasoning>",
  "topRisks": ["<top risk 1>", "<top risk 2>", "<top risk 3>", "<top risk 4>", "<top risk 5>"],
  "negotiationPoints": ["<negotiation point 1>", "<negotiation point 2>", "<negotiation point 3>"],
  "missingInfo": ["<missing item 1>", "<missing item 2>"]
}

Decision rules:
- APPROVE: avg score >= 7.5, no REJECT votes from security/legal/compliance agents
- REJECT: avg score < 4.5, or any hard blocking issue from security/legal/compliance
- CONDITIONAL_APPROVAL: everything else — specify conditions clearly in rationale`;

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
              topRisks: { type: "array", items: { type: "string" } },
              negotiationPoints: { type: "array", items: { type: "string" } },
              missingInfo: { type: "array", items: { type: "string" } },
            },
            required: ["recommendation", "rationale", "topRisks", "negotiationPoints", "missingInfo"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") throw new Error("No final recommendation response");
    return JSON.parse(content);
  } catch {
    // Fallback: rule-based decision
    let recommendation: "APPROVE" | "REJECT" | "CONDITIONAL_APPROVAL" = "CONDITIONAL_APPROVAL";
    if (consensus.averageScore >= 7.5 && consensus.rejectCount === 0) recommendation = "APPROVE";
    else if (consensus.averageScore < 4.5 || consensus.rejectCount >= 3) recommendation = "REJECT";

    return {
      recommendation,
      rationale: `Based on an average score of ${consensus.averageScore}/10 with ${consensus.approveCount} approvals, ${consensus.conditionalCount} conditionals, and ${consensus.rejectCount} rejections.`,
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

  // 1. Triage
  const triage = await runProcurementTriage(input);

  // 2. Run all 8 agents in parallel
  const agentScores = await Promise.all(
    PROCUREMENT_AGENTS.map((agent) => callProcurementAgent(agent, context))
  );

  // 3. Consensus
  const consensus = buildConsensus(agentScores);

  // 4. Final recommendation
  const final = await buildFinalRecommendation(input, agentScores, consensus, triage);

  return {
    vendorName: input.vendorName,
    category: input.category,
    finalRecommendation: final.recommendation,
    recommendationRationale: final.rationale,
    overallScore: consensus.averageScore,
    overallConfidence: consensus.overallConfidence,
    agentScores,
    consensus,
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
