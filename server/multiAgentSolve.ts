/**
 * multiAgentSolve — Stateful Sequential Outcome Engine
 *
 * Orchestrates strict sequential multi-agent workflows.
 * No agent starts before the previous one completes.
 * All agents share a Blackboard memory object that persists across steps.
 *
 * Supported workflows:
 *  - rosie_protocol: 6-agent cancer treatment research pipeline
 */

import { getDb } from "./db";
import { workflowRuns, workflowSteps } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { randomUUID } from "crypto";

// Helper to get db instance
async function getDatabase() { return (await getDb())!; }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BlackboardMemory {
  sessionId: string;
  workflowType: string;
  userId: number;
  organizationId?: number;
  // Source documents injected at start
  sourceDocuments: SourceDocument[];
  // Per-agent structured outputs (keyed by stepIndex)
  agentOutputs: Record<number, AgentOutput>;
  // Accumulated risk flags
  riskFlags: string[];
  // Route log
  routeLog: string[];
  // Token usage
  tokenUsage: number;
  // Timestamps
  startedAt: number;
}

export interface SourceDocument {
  fileName: string;
  fileUrl?: string;
  extractedText: string;
}

export interface AgentOutput {
  agentName: string;
  stepIndex: number;
  summary: string;
  entities: Record<string, string[]>; // e.g. { genes: [], drugs: [], risks: [] }
  unresolvedQuestions: string[];
  confidenceLevel: number; // 0-100
  warnings: string[];
  rawOutput: string;
  tokensUsed: number;
  durationMs: number;
}

export interface WorkflowDefinition {
  type: string;
  label: string;
  agents: AgentDefinition[];
}

export interface AgentDefinition {
  name: string;
  role: string;
  systemPrompt: (blackboard: BlackboardMemory) => string;
  userPrompt: (blackboard: BlackboardMemory) => string;
  maxTokens: number;
}

// ── Rosie Protocol — 6-Agent Pipeline Definition ──────────────────────────────

const ROSIE_PROTOCOL: WorkflowDefinition = {
  type: "rosie_protocol",
  label: "Rosie Protocol — Cancer Treatment Research",
  agents: [
    {
      name: "Intake Agent",
      role: "Case Parser",
      maxTokens: 800,
      systemPrompt: (bb) => `You are a clinical case intake specialist. Parse the provided patient case, pathology notes, and uploaded documents into a structured case summary.

MANDATORY: All outputs must include "Research Use Only — Not Medical Advice — Requires Qualified Professional Review".

Return a JSON object with these exact fields:
{
  "summary": "2-3 sentence case overview",
  "entities": {
    "diagnoses": ["list of diagnoses mentioned"],
    "biomarkers": ["any biomarkers or mutations mentioned"],
    "medications": ["current medications"],
    "procedures": ["procedures performed"]
  },
  "unresolvedQuestions": ["questions that need clarification"],
  "confidenceLevel": 75,
  "warnings": ["any clinical red flags or data gaps"],
  "caseStructure": {
    "patientContext": "brief patient context",
    "primaryDiagnosis": "main diagnosis",
    "stagingInfo": "staging if available",
    "keyFindings": ["key clinical findings"]
  }
}`,
      userPrompt: (bb) => {
        const docs = bb.sourceDocuments.map(d => `--- ${d.fileName} ---\n${d.extractedText}`).join("\n\n");
        return `Parse this clinical case into a structured intake:\n\n${docs || "No documents provided. Generate a representative case structure for demonstration."}`;
      },
    },
    {
      name: "Research Agent",
      role: "Literature Analyst",
      maxTokens: 900,
      systemPrompt: (bb) => `You are a biomedical literature analyst. Based on the structured case from the Intake Agent, identify relevant research, known mechanisms, and comparable cases from the scientific literature.

MANDATORY: All outputs must include "Research Use Only — Not Medical Advice — Requires Qualified Professional Review".

Return a JSON object:
{
  "summary": "2-3 sentence literature overview",
  "entities": {
    "keyStudies": ["relevant study references or findings"],
    "mechanisms": ["known biological mechanisms relevant to this case"],
    "comparableCases": ["comparable case types from literature"],
    "emergingTherapies": ["emerging therapies in this area"]
  },
  "unresolvedQuestions": ["gaps in current literature"],
  "confidenceLevel": 70,
  "warnings": ["limitations of current evidence base"],
  "literatureSummary": {
    "evidenceStrength": "strong/moderate/weak",
    "consensusView": "current clinical consensus",
    "controversies": ["areas of ongoing debate"]
  }
}`,
      userPrompt: (bb) => {
        const intake = bb.agentOutputs[0];
        return `Based on this intake case, identify relevant literature and mechanisms:\n\nCase Summary: ${intake?.summary || "No intake data"}\nDiagnoses: ${JSON.stringify(intake?.entities?.diagnoses || [])}\nBiomarkers: ${JSON.stringify(intake?.entities?.biomarkers || [])}`;
      },
    },
    {
      name: "Mutation Agent",
      role: "Target Identifier",
      maxTokens: 800,
      systemPrompt: (bb) => `You are a molecular oncology specialist focused on identifying candidate therapeutic targets. Analyze the case and literature to identify genes, proteins, and biomarkers that may be actionable.

MANDATORY: All outputs must include "Research Use Only — Not Medical Advice — Requires Qualified Professional Review".

Return a JSON object:
{
  "summary": "2-3 sentence target identification summary",
  "entities": {
    "candidateGenes": ["gene names with brief rationale"],
    "candidateProteins": ["protein targets"],
    "actionableBiomarkers": ["biomarkers with therapeutic implications"],
    "pathways": ["relevant signaling pathways"]
  },
  "unresolvedQuestions": ["targets requiring further validation"],
  "confidenceLevel": 65,
  "warnings": ["limitations of target identification"],
  "targetAnalysis": {
    "primaryTarget": "most promising target",
    "targetRationale": "why this target is prioritized",
    "druggability": "high/medium/low",
    "existingAgents": ["drugs known to hit this target"]
  }
}`,
      userPrompt: (bb) => {
        const intake = bb.agentOutputs[0];
        const research = bb.agentOutputs[1];
        return `Identify candidate molecular targets based on:\n\nCase: ${intake?.summary || ""}\nBiomarkers found: ${JSON.stringify(intake?.entities?.biomarkers || [])}\nMechanisms from literature: ${JSON.stringify(research?.entities?.mechanisms || [])}\nEmerging therapies: ${JSON.stringify(research?.entities?.emergingTherapies || [])}`;
      },
    },
    {
      name: "Structural Agent",
      role: "Binding Analyst (Simulated)",
      maxTokens: 700,
      systemPrompt: (bb) => `You are a computational structural biology analyst. Based on the identified targets, infer likely binding interactions, structural considerations, and drug-target compatibility. Note: This is a simulated structural analysis — no external docking software is used.

MANDATORY: All outputs must include "Research Use Only — Not Medical Advice — Requires Qualified Professional Review — Structural analysis is SIMULATED".

Return a JSON object:
{
  "summary": "2-3 sentence structural analysis summary",
  "entities": {
    "bindingPockets": ["inferred binding sites"],
    "structuralConstraints": ["structural factors affecting drug binding"],
    "compatibleDrugClasses": ["drug classes likely to bind based on target class"],
    "resistanceMechanisms": ["known or inferred resistance mechanisms"]
  },
  "unresolvedQuestions": ["structural questions requiring wet lab validation"],
  "confidenceLevel": 50,
  "warnings": ["SIMULATED — requires wet lab validation", "Computational inference only"],
  "structuralInsight": {
    "targetClass": "kinase/receptor/enzyme/etc",
    "bindingMode": "inferred binding mode",
    "selectivityConcerns": "potential off-target effects"
  }
}`,
      userPrompt: (bb) => {
        const mutation = bb.agentOutputs[2];
        return `Infer structural binding considerations for:\n\nPrimary target: ${mutation?.entities?.candidateGenes?.[0] || "unknown"}\nAll candidate targets: ${JSON.stringify(mutation?.entities?.candidateGenes || [])}\nRelevant pathways: ${JSON.stringify(mutation?.entities?.pathways || [])}`;
      },
    },
    {
      name: "Therapeutic Agent",
      role: "Intervention Strategist",
      maxTokens: 900,
      systemPrompt: (bb) => `You are a therapeutic strategy specialist. Based on all prior agent findings, suggest candidate interventions, drug approaches, and research hypotheses.

MANDATORY: All outputs must include "Research Use Only — Not Medical Advice — Requires Qualified Professional Review".

Return a JSON object:
{
  "summary": "2-3 sentence therapeutic strategy summary",
  "entities": {
    "candidateDrugs": ["specific drug names or classes with rationale"],
    "combinationStrategies": ["potential drug combinations"],
    "clinicalTrials": ["relevant trial types or phases to consider"],
    "alternativeApproaches": ["immunotherapy, targeted therapy, etc."]
  },
  "unresolvedQuestions": ["therapeutic questions requiring clinical evaluation"],
  "confidenceLevel": 60,
  "warnings": ["all suggestions are research hypotheses only", "clinical validation required"],
  "therapeuticPlan": {
    "firstLineHypothesis": "primary therapeutic hypothesis",
    "rationale": "evidence basis for this approach",
    "expectedChallenges": ["anticipated obstacles"],
    "monitoringStrategy": "suggested monitoring approach"
  }
}`,
      userPrompt: (bb) => {
        const mutation = bb.agentOutputs[2];
        const structural = bb.agentOutputs[3];
        const research = bb.agentOutputs[1];
        return `Suggest therapeutic interventions based on:\n\nPrimary target: ${mutation?.entities?.candidateGenes?.[0] || ""}\nExisting agents for target: ${JSON.stringify(mutation?.entities && (mutation.entities as any).existingAgents || [])}\nCompatible drug classes: ${JSON.stringify(structural?.entities?.compatibleDrugClasses || [])}\nEmerging therapies from literature: ${JSON.stringify(research?.entities?.emergingTherapies || [])}`;
      },
    },
    {
      name: "Validation Agent",
      role: "Risk & Quality Reviewer",
      maxTokens: 900,
      systemPrompt: (bb) => `You are a clinical research quality and risk reviewer. Review all prior agent outputs for contradictions, confidence gaps, missing evidence, and safety concerns. Produce the final Clinical Dossier summary.

MANDATORY: All outputs must include "Research Use Only — Not Medical Advice — Requires Qualified Professional Review".

Return a JSON object:
{
  "summary": "2-3 sentence validation summary",
  "entities": {
    "confirmedFindings": ["findings supported across multiple agents"],
    "contradictions": ["conflicting findings between agents"],
    "criticalGaps": ["missing evidence that must be addressed"],
    "safetyFlags": ["safety concerns identified"]
  },
  "unresolvedQuestions": ["questions that remain unanswered after full pipeline"],
  "confidenceLevel": 70,
  "warnings": ["key limitations of this dossier"],
  "finalDossier": {
    "overallConfidence": "high/medium/low",
    "keyConclusion": "primary conclusion of the research pipeline",
    "immediateNextSteps": ["3-5 concrete next steps for the research team"],
    "requiredExpertise": ["specialists who should review this dossier"],
    "disclaimer": "Research Use Only. Not Medical Advice. Requires review by qualified oncologist, molecular biologist, and clinical pharmacologist before any clinical application."
  }
}`,
      userPrompt: (bb) => {
        const summaries = Object.entries(bb.agentOutputs)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([i, o]) => `Agent ${Number(i)+1} (${o.agentName}): ${o.summary}`)
          .join("\n");
        const allWarnings = Object.values(bb.agentOutputs).flatMap(o => o.warnings);
        return `Review and validate the full pipeline output:\n\n${summaries}\n\nAccumulated warnings:\n${allWarnings.join("\n")}\n\nProduce the final Clinical Dossier.`;
      },
    },
  ],
};

const WORKFLOW_REGISTRY: Record<string, WorkflowDefinition> = {
  rosie_protocol: ROSIE_PROTOCOL,
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function createWorkflowRun(params: {
  sessionId: string;
  workflowType: string;
  userId: number;
  organizationId?: number;
  sourceDocuments: SourceDocument[];
}): Promise<void> {
  const bb: BlackboardMemory = {
    sessionId: params.sessionId,
    workflowType: params.workflowType,
    userId: params.userId,
    organizationId: params.organizationId,
    sourceDocuments: params.sourceDocuments,
    agentOutputs: {},
    riskFlags: [],
    routeLog: [],
    tokenUsage: 0,
    startedAt: Date.now(),
  };

  await (await getDatabase()).insert(workflowRuns).values({
    sessionId: params.sessionId,
    workflowType: params.workflowType,
    userId: params.userId,
    organizationId: params.organizationId ?? null,
    status: "running",
    currentStep: 0,
    totalSteps: WORKFLOW_REGISTRY[params.workflowType]?.agents.length ?? 6,
    blackboardMemory: JSON.stringify(bb),
    sourceDocuments: JSON.stringify(params.sourceDocuments),
    riskFlags: "[]",
    routeLog: "[]",
    totalTokensUsed: 0,
    startedAt: new Date(),
  });
}

async function getBlackboard(sessionId: string): Promise<BlackboardMemory | null> {
  const rows = await (await getDatabase()).select().from(workflowRuns).where(eq(workflowRuns.sessionId, sessionId)).limit(1);
  if (!rows[0]) return null;
  return JSON.parse(rows[0].blackboardMemory) as BlackboardMemory;
}

async function saveBlackboard(sessionId: string, bb: BlackboardMemory, updates: Partial<typeof workflowRuns.$inferInsert> = {}): Promise<void> {
  await (await getDatabase()).update(workflowRuns)
    .set({
      blackboardMemory: JSON.stringify(bb),
      riskFlags: JSON.stringify(bb.riskFlags),
      routeLog: JSON.stringify(bb.routeLog),
      totalTokensUsed: bb.tokenUsage,
      ...updates,
    })
    .where(eq(workflowRuns.sessionId, sessionId));
}

// ── Core Sequential Executor ──────────────────────────────────────────────────

export async function executeWorkflowStep(
  sessionId: string,
  stepIndex: number
): Promise<{ success: boolean; output?: AgentOutput; error?: string }> {
  const run = await (await getDatabase()).select().from(workflowRuns).where(eq(workflowRuns.sessionId, sessionId)).limit(1);
  if (!run[0]) return { success: false, error: "Workflow run not found" };

  const workflow = WORKFLOW_REGISTRY[run[0].workflowType];
  if (!workflow) return { success: false, error: `Unknown workflow type: ${run[0].workflowType}` };

  const agent = workflow.agents[stepIndex];
  if (!agent) return { success: false, error: `No agent at step ${stepIndex}` };

  const bb = JSON.parse(run[0].blackboardMemory) as BlackboardMemory;

  // Create step record
  const [stepRow] = await (await getDatabase()).insert(workflowSteps).values({
    workflowRunId: run[0].id,
    sessionId,
    stepIndex,
    agentName: agent.name,
    agentRole: agent.role,
    status: "running",
    inputSummary: `Step ${stepIndex}: ${agent.name}`,
    startedAt: new Date(),
  }).$returningId();

  const stepId = stepRow.id;
  const stepStart = Date.now();

  try {
    // Build prompts from blackboard state
    const systemPrompt = agent.systemPrompt(bb);
    const userPrompt = agent.userPrompt(bb);

    // Call LLM
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: agent.maxTokens,
    });

    const rawContent = String(response?.choices?.[0]?.message?.content ?? "{}");
    const tokensUsed = (response as any).usage?.total_tokens ?? agent.maxTokens;
    const durationMs = Date.now() - stepStart;

    // Parse structured output
    let parsed: any = {};
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) || rawContent.match(/({[\s\S]*})/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawContent);
    } catch {
      // Fallback: wrap raw output
      parsed = {
        summary: rawContent.slice(0, 300),
        entities: {},
        unresolvedQuestions: [],
        confidenceLevel: 50,
        warnings: ["Output parsing failed — raw text preserved"],
      };
    }

    const output: AgentOutput = {
      agentName: agent.name,
      stepIndex,
      summary: parsed.summary || `${agent.name} completed`,
      entities: parsed.entities || {},
      unresolvedQuestions: parsed.unresolvedQuestions || [],
      confidenceLevel: parsed.confidenceLevel ?? 60,
      warnings: parsed.warnings || [],
      rawOutput: rawContent,
      tokensUsed,
      durationMs,
    };

    // Write to blackboard
    bb.agentOutputs[stepIndex] = output;
    bb.tokenUsage += tokensUsed;
    bb.routeLog.push(agent.name);
    if (output.warnings.length > 0) {
      bb.riskFlags.push(...output.warnings.map(w => `[${agent.name}] ${w}`));
    }

    // Update step record
    await (await getDatabase()).update(workflowSteps)
      .set({
        status: "complete",
        structuredOutput: JSON.stringify(output),
        inputSummary: userPrompt.slice(0, 500),
        tokensUsed,
        durationMs,
        confidenceLevel: output.confidenceLevel,
        warningCount: output.warnings.length,
        completedAt: new Date(),
      })
      .where(eq(workflowSteps.id, stepId));

    // Update workflow run
    const isLastStep = stepIndex === workflow.agents.length - 1;
    await saveBlackboard(sessionId, bb, {
      currentStep: stepIndex + 1,
      status: isLastStep ? "complete" : "running",
      completedAt: isLastStep ? new Date() : undefined,
      durationMs: isLastStep ? Date.now() - bb.startedAt : undefined,
    });

    return { success: true, output };
  } catch (err: any) {
    const durationMs = Date.now() - stepStart;
    const errMsg = err?.message || "Unknown error";

    // Mark step as failed
    await (await getDatabase()).update(workflowSteps)
      .set({
        status: "failed",
        errorMessage: errMsg,
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(workflowSteps.id, stepId));

    // Mark run as failed, preserve blackboard
    await saveBlackboard(sessionId, bb, {
      status: "failed",
      failedAtStep: stepIndex,
      failureReason: errMsg,
    });

    return { success: false, error: errMsg };
  }
}

// ── Full Pipeline Runner ──────────────────────────────────────────────────────

export async function runFullWorkflow(params: {
  sessionId: string;
  workflowType: string;
  userId: number;
  organizationId?: number;
  sourceDocuments: SourceDocument[];
  fromStep?: number; // for retry from failed step
}): Promise<{
  success: boolean;
  sessionId: string;
  completedSteps: number;
  totalSteps: number;
  blackboard?: BlackboardMemory;
  error?: string;
}> {
  const workflow = WORKFLOW_REGISTRY[params.workflowType];
  if (!workflow) {
    return { success: false, sessionId: params.sessionId, completedSteps: 0, totalSteps: 0, error: `Unknown workflow: ${params.workflowType}` };
  }

  // Create or resume run
  const existing = await (await getDatabase()).select().from(workflowRuns).where(eq(workflowRuns.sessionId, params.sessionId)).limit(1);
  if (!existing[0]) {
    await createWorkflowRun(params);
  } else if (params.fromStep !== undefined) {
    // Resume from failed step
    const bb = JSON.parse(existing[0].blackboardMemory) as BlackboardMemory;
    await saveBlackboard(params.sessionId, bb, {
      status: "running",
      failedAtStep: null as any,
      failureReason: null as any,
      retryCount: (existing[0].retryCount ?? 0) + 1,
    });
  }

  const startStep = params.fromStep ?? 0;
  let completedSteps = startStep;

  // Execute agents sequentially — STRICT ORDER, no parallelism
  for (let i = startStep; i < workflow.agents.length; i++) {
    const result = await executeWorkflowStep(params.sessionId, i);
    if (!result.success) {
      return {
        success: false,
        sessionId: params.sessionId,
        completedSteps,
        totalSteps: workflow.agents.length,
        error: `Step ${i} (${workflow.agents[i].name}) failed: ${result.error}`,
      };
    }
    completedSteps++;
  }

  const finalBb = await getBlackboard(params.sessionId);
  return {
    success: true,
    sessionId: params.sessionId,
    completedSteps,
    totalSteps: workflow.agents.length,
    blackboard: finalBb ?? undefined,
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { WORKFLOW_REGISTRY, ROSIE_PROTOCOL, getBlackboard };
export function generateSessionId(): string {
  return randomUUID();
}
