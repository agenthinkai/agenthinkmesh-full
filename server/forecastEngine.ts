/**
 * ForecastMesh Engine
 * 5 parallel agents → consensus engine → trigger detection
 * All LLM calls are server-side via invokeLLM.
 * RAG context from Knowledge Vault is injected into each agent's system prompt.
 */

import { invokeLLM } from "./_core/llm";
import { getRAGContext, injectRAGContext } from "./ragContext";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecastType = "deadline_risk" | "budget_risk" | "target_probability";

export interface ForecastInput {
  title: string;
  forecastType: ForecastType;
  question: string;
  description?: string;
  deadline?: string;       // ISO date string
  threshold?: number;      // budget or KPI threshold
  businessArea?: string;
  documentText?: string;   // extracted text from uploaded doc (first 1500 chars)
}

export const AgentResultSchema = z.object({
  agent_name: z.string(),
  probability_estimate: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  upward_forces: z.array(z.string()),
  downward_forces: z.array(z.string()),
  summary: z.string(),
  recommended_actions: z.array(z.string()),
});
export type AgentResult = z.infer<typeof AgentResultSchema>;

export interface ConsensusResult {
  consensus_probability: number;
  weighted_probability: number;
  confidence: number;
  disagreement: boolean;
  variance: number;
  agent_results: AgentResult[];
}

export interface TriggerEvent {
  triggerType: "probability_drop" | "low_confidence" | "status_worsened" | "deadline_approaching";
  description: string;
  threshold?: number;
}

export interface ForecastEngineResult {
  consensus: ConsensusResult;
  triggers: TriggerEvent[];
  status: "on_track" | "watchlist" | "at_risk" | "critical";
  ragScenarioIds: string[];
}

// ─── Agent Definitions ────────────────────────────────────────────────────────

const AGENTS = [
  {
    name: "Operations Agent",
    role: "Operational Execution Risk",
    systemPrompt: `You are an Operations Risk Analyst specialising in enterprise project execution. 
Your job is to assess the operational feasibility and execution risk of a forecast scenario.
Focus on: resource availability, process bottlenecks, team capacity, vendor dependencies, and execution track record.
Return ONLY valid JSON matching the schema exactly. No markdown, no explanation outside the JSON.`,
  },
  {
    name: "Finance Agent",
    role: "Financial Risk & Budget Analysis",
    systemPrompt: `You are a Senior Finance Analyst specialising in enterprise budget risk and financial forecasting.
Your job is to assess the financial dimensions of a forecast scenario.
Focus on: budget adequacy, cost overrun risk, cash flow timing, financial dependencies, and historical budget performance.
Return ONLY valid JSON matching the schema exactly. No markdown, no explanation outside the JSON.`,
  },
  {
    name: "Legal Agent",
    role: "Legal & Compliance Risk",
    systemPrompt: `You are a Legal Risk Advisor specialising in enterprise compliance and regulatory risk.
Your job is to assess the legal and compliance dimensions of a forecast scenario.
Focus on: regulatory approvals, contract dependencies, compliance timelines, legal blockers, and jurisdictional risk.
Return ONLY valid JSON matching the schema exactly. No markdown, no explanation outside the JSON.`,
  },
  {
    name: "Market Signals Agent",
    role: "Market & External Signals",
    systemPrompt: `You are a Market Intelligence Analyst specialising in external signals and macro risk.
Your job is to assess how market conditions, competitive dynamics, and external signals affect the forecast.
Focus on: market timing, competitive pressure, macro environment, customer behaviour signals, and industry trends.
Return ONLY valid JSON matching the schema exactly. No markdown, no explanation outside the JSON.`,
  },
  {
    name: "Execution Risk Agent",
    role: "Strategic Execution & Delivery Risk",
    systemPrompt: `You are a Strategic Delivery Advisor specialising in enterprise programme risk.
Your job is to assess the overall execution and delivery risk of a forecast scenario.
Focus on: stakeholder alignment, change management, decision-making speed, cross-functional dependencies, and leadership commitment.
Return ONLY valid JSON matching the schema exactly. No markdown, no explanation outside the JSON.`,
  },
];

const RESPONSE_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "agent_forecast_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        agent_name: { type: "string" },
        probability_estimate: { type: "number", description: "0.0 to 1.0 — probability the forecast question resolves YES" },
        confidence: { type: "number", description: "0.0 to 1.0 — how confident the agent is in its estimate" },
        upward_forces: {
          type: "array",
          items: { type: "string" },
          description: "Factors that increase the probability (max 4 items)",
        },
        downward_forces: {
          type: "array",
          items: { type: "string" },
          description: "Factors that decrease the probability (max 4 items)",
        },
        summary: { type: "string", description: "2-3 sentence assessment (max 400 chars)" },
        recommended_actions: {
          type: "array",
          items: { type: "string" },
          description: "Specific actions to improve the probability (max 3 items)",
        },
      },
      required: ["agent_name", "probability_estimate", "confidence", "upward_forces", "downward_forces", "summary", "recommended_actions"],
      additionalProperties: false,
    },
  },
};

// ─── Single Agent Call ────────────────────────────────────────────────────────

async function callAgent(
  agent: typeof AGENTS[0],
  input: ForecastInput,
  ragContext: string,
  timeoutMs = 15000
): Promise<AgentResult> {
  const userMessage = buildUserMessage(input);
  // Inject RAG context at the top of the system prompt
  const systemPromptWithRAG = injectRAGContext(agent.systemPrompt, ragContext);

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), timeoutMs)
  );

  try {
    const result = await Promise.race([
      invokeLLM({
        messages: [
          { role: "system", content: systemPromptWithRAG },
          { role: "user", content: userMessage },
        ],
        response_format: RESPONSE_SCHEMA,
      }),
      timeoutPromise,
    ]);

    const content = (result as { choices: Array<{ message: { content: string } }> })
      .choices[0]?.message?.content ?? "{}";

    const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const validated = AgentResultSchema.parse({ ...parsed, agent_name: agent.name });
    return validated;
  } catch {
    // Graceful fallback — neutral estimate
    return {
      agent_name: agent.name,
      probability_estimate: 0.5,
      confidence: 0.2,
      upward_forces: ["Insufficient data to assess upward forces"],
      downward_forces: ["Agent timed out or returned invalid response"],
      summary: `${agent.name} was unable to complete analysis within the time limit. A neutral estimate of 0.5 has been applied.`,
      recommended_actions: ["Retry analysis with more detailed context"],
    };
  }
}

function buildUserMessage(input: ForecastInput): string {
  const lines = [
    `FORECAST TITLE: ${input.title}`,
    `TYPE: ${input.forecastType.replace(/_/g, " ").toUpperCase()}`,
    `QUESTION: ${input.question}`,
  ];
  if (input.description) lines.push(`DESCRIPTION: ${input.description}`);
  if (input.businessArea) lines.push(`BUSINESS AREA: ${input.businessArea}`);
  if (input.deadline) lines.push(`DEADLINE: ${input.deadline}`);
  if (input.threshold != null) lines.push(`THRESHOLD: ${input.threshold}`);
  if (input.documentText) {
    lines.push(`\nSUPPORTING DOCUMENT EXTRACT (first 1500 chars):\n${input.documentText.slice(0, 1500)}`);
  }
  lines.push(`\nReturn your analysis as JSON matching the required schema.`);
  return lines.join("\n");
}

// ─── Consensus Engine ─────────────────────────────────────────────────────────

function computeConsensus(agentResults: AgentResult[]): ConsensusResult {
  const n = agentResults.length;
  if (n === 0) {
    return {
      consensus_probability: 0.5,
      weighted_probability: 0.5,
      confidence: 0.2,
      disagreement: false,
      variance: 0,
      agent_results: [],
    };
  }

  // Simple average
  const avgProbability = agentResults.reduce((s, a) => s + a.probability_estimate, 0) / n;

  // Confidence-weighted average
  const totalConfidence = agentResults.reduce((s, a) => s + a.confidence, 0);
  const weightedProbability = totalConfidence > 0
    ? agentResults.reduce((s, a) => s + a.probability_estimate * a.confidence, 0) / totalConfidence
    : avgProbability;

  // Average confidence
  const avgConfidence = totalConfidence / n;

  // Variance (disagreement indicator)
  const variance = agentResults.reduce((s, a) => s + Math.pow(a.probability_estimate - avgProbability, 2), 0) / n;
  const disagreement = variance > 0.04; // std dev > 0.2 = disagreement

  return {
    consensus_probability: Math.round(avgProbability * 10000) / 10000,
    weighted_probability: Math.round(weightedProbability * 10000) / 10000,
    confidence: Math.round(avgConfidence * 10000) / 10000,
    disagreement,
    variance: Math.round(variance * 10000) / 10000,
    agent_results: agentResults,
  };
}

// ─── Status Derivation ────────────────────────────────────────────────────────

export function deriveStatus(probability: number): "on_track" | "watchlist" | "at_risk" | "critical" {
  if (probability >= 0.75) return "on_track";
  if (probability >= 0.55) return "watchlist";
  if (probability >= 0.35) return "at_risk";
  return "critical";
}

// ─── Trigger Detection ────────────────────────────────────────────────────────

export function detectTriggers(
  consensus: ConsensusResult,
  previousProbability?: number,
  deadline?: string
): TriggerEvent[] {
  const triggers: TriggerEvent[] = [];
  const prob = consensus.weighted_probability;

  // Probability drop > 10%
  if (previousProbability != null && previousProbability - prob > 0.10) {
    triggers.push({
      triggerType: "probability_drop",
      description: `Probability dropped ${Math.round((previousProbability - prob) * 100)}% from ${Math.round(previousProbability * 100)}% to ${Math.round(prob * 100)}%.`,
      threshold: 0.10,
    });
  }

  // Low confidence < 50%
  if (consensus.confidence < 0.50) {
    triggers.push({
      triggerType: "low_confidence",
      description: `Agent confidence is ${Math.round(consensus.confidence * 100)}%, below the 50% threshold. Analysis may be unreliable.`,
      threshold: 0.50,
    });
  }

  // Status worsened to critical
  const status = deriveStatus(prob);
  if (status === "critical") {
    triggers.push({
      triggerType: "status_worsened",
      description: `Forecast has entered CRITICAL status with probability ${Math.round(prob * 100)}%.`,
    });
  }

  // Deadline approaching within 14 days
  if (deadline) {
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 14) {
      triggers.push({
        triggerType: "deadline_approaching",
        description: `Deadline is ${daysLeft} day${daysLeft === 1 ? "" : "s"} away. Immediate action may be required.`,
      });
    }
  }

  return triggers;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function runForecastEngine(
  input: ForecastInput,
  previousProbability?: number
): Promise<ForecastEngineResult> {
  // Retrieve RAG context once — shared across all 5 agents to avoid 5x DB queries
  const ragQuery = `${input.title} ${input.businessArea ?? ""} ${input.forecastType.replace(/_/g, " ")}`.trim();
  const { ragContext, ragScenarioIds } = await getRAGContext(ragQuery, 3);

  // Run all 5 agents in parallel with 15s timeout each
  const settled = await Promise.allSettled(
    AGENTS.map((agent) => callAgent(agent, input, ragContext, 15000))
  );

  const agentResults: AgentResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          agent_name: AGENTS[i].name,
          probability_estimate: 0.5,
          confidence: 0.2,
          upward_forces: [],
          downward_forces: ["Agent failed to respond"],
          summary: "Agent did not complete analysis.",
          recommended_actions: [],
        }
  );

  const consensus = computeConsensus(agentResults);
  const triggers = detectTriggers(consensus, previousProbability, input.deadline);
  const status = deriveStatus(consensus.weighted_probability);

  return { consensus, triggers, status, ragScenarioIds };
}
