/**
 * multiAgentSolveSSE — SSE-aware wrapper around the sequential pipeline.
 *
 * Identical logic to multiAgentSolve.ts but accepts per-step callbacks
 * so the HTTP layer can stream events to the browser as each agent completes.
 */

import { getDb } from "./db";
import { workflowRuns, workflowSteps } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { randomUUID } from "crypto";
import {
  BlackboardMemory,
  AgentOutput,
  SourceDocument,
  WORKFLOW_REGISTRY,
  getBlackboard,
} from "./multiAgentSolve";

export { generateSessionId } from "./multiAgentSolve";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SSECallbacks {
  onStepStart: (stepIndex: number, agentName: string) => void;
  onStepComplete: (stepIndex: number, agentName: string, output: AgentOutput) => void;
  onStepFailed: (stepIndex: number, agentName: string, error: string) => void;
}

// ── DB helpers (local copies to avoid circular imports) ───────────────────────

async function getDatabase() {
  return (await getDb())!;
}

async function saveBlackboard(
  sessionId: string,
  bb: BlackboardMemory,
  updates: Partial<typeof workflowRuns.$inferInsert> = {}
): Promise<void> {
  await (await getDatabase())
    .update(workflowRuns)
    .set({
      blackboardMemory: JSON.stringify(bb),
      riskFlags: JSON.stringify(bb.riskFlags),
      routeLog: JSON.stringify(bb.routeLog),
      totalTokensUsed: bb.tokenUsage,
      ...updates,
    })
    .where(eq(workflowRuns.sessionId, sessionId));
}

// ── SSE Step Executor ─────────────────────────────────────────────────────────

async function executeStepSSE(
  sessionId: string,
  stepIndex: number,
  callbacks: SSECallbacks
): Promise<{ success: boolean; output?: AgentOutput; error?: string }> {
  const db = await getDatabase();
  const run = await db.select().from(workflowRuns).where(eq(workflowRuns.sessionId, sessionId)).limit(1);
  if (!run[0]) return { success: false, error: "Workflow run not found" };

  const workflow = WORKFLOW_REGISTRY[run[0].workflowType];
  if (!workflow) return { success: false, error: `Unknown workflow type: ${run[0].workflowType}` };

  const agent = workflow.agents[stepIndex];
  if (!agent) return { success: false, error: `No agent at step ${stepIndex}` };

  const bb = JSON.parse(run[0].blackboardMemory) as BlackboardMemory;

  // Notify UI: agent is starting
  callbacks.onStepStart(stepIndex, agent.name);

  // Create step record
  const [stepRow] = await db.insert(workflowSteps).values({
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
    const systemPrompt = agent.systemPrompt(bb);
    const userPrompt = agent.userPrompt(bb);

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

    let parsed: any = {};
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) || rawContent.match(/({[\s\S]*})/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawContent);
    } catch {
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
      bb.riskFlags.push(...output.warnings.map((w: string) => `[${agent.name}] ${w}`));
    }

    await db.update(workflowSteps)
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

    const isLastStep = stepIndex === workflow.agents.length - 1;
    await saveBlackboard(sessionId, bb, {
      currentStep: stepIndex + 1,
      status: isLastStep ? "complete" : "running",
      completedAt: isLastStep ? new Date() : undefined,
      durationMs: isLastStep ? Date.now() - bb.startedAt : undefined,
    });

    // Notify UI: agent completed
    callbacks.onStepComplete(stepIndex, agent.name, output);

    return { success: true, output };
  } catch (err: any) {
    const durationMs = Date.now() - stepStart;
    const errMsg = err?.message || "Unknown error";

    await db.update(workflowSteps)
      .set({ status: "failed", errorMessage: errMsg, durationMs, completedAt: new Date() })
      .where(eq(workflowSteps.id, stepId));

    await saveBlackboard(sessionId, bb, {
      status: "failed",
      failedAtStep: stepIndex,
      failureReason: errMsg,
    });

    // Notify UI: agent failed
    callbacks.onStepFailed(stepIndex, agent.name, errMsg);

    return { success: false, error: errMsg };
  }
}

// ── Full SSE Pipeline Runner ──────────────────────────────────────────────────

export async function runFullWorkflowSSE(params: {
  sessionId: string;
  workflowType: string;
  userId: number;
  organizationId?: number;
  sourceDocuments: SourceDocument[];
  fromStep?: number;
} & SSECallbacks): Promise<{ success: boolean; completedSteps: number; totalSteps: number; error?: string }> {
  const workflow = WORKFLOW_REGISTRY[params.workflowType];
  if (!workflow) {
    return { success: false, completedSteps: 0, totalSteps: 0, error: `Unknown workflow: ${params.workflowType}` };
  }

  const db = await getDatabase();

  // Create run record if it doesn't exist
  const existing = await db.select().from(workflowRuns).where(eq(workflowRuns.sessionId, params.sessionId)).limit(1);

  if (!existing[0]) {
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

    await db.insert(workflowRuns).values({
      sessionId: params.sessionId,
      workflowType: params.workflowType,
      userId: params.userId,
      organizationId: params.organizationId ?? null,
      status: "running",
      currentStep: 0,
      totalSteps: workflow.agents.length,
      blackboardMemory: JSON.stringify(bb),
      sourceDocuments: JSON.stringify(params.sourceDocuments),
      riskFlags: "[]",
      routeLog: "[]",
      totalTokensUsed: 0,
      startedAt: new Date(),
    });
  } else if (params.fromStep !== undefined) {
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

  const callbacks: SSECallbacks = {
    onStepStart: params.onStepStart,
    onStepComplete: params.onStepComplete,
    onStepFailed: params.onStepFailed,
  };

  for (let i = startStep; i < workflow.agents.length; i++) {
    const result = await executeStepSSE(params.sessionId, i, callbacks);
    if (!result.success) {
      return {
        success: false,
        completedSteps,
        totalSteps: workflow.agents.length,
        error: `Step ${i} (${workflow.agents[i].name}) failed: ${result.error}`,
      };
    }
    completedSteps++;
  }

  return { success: true, completedSteps, totalSteps: workflow.agents.length };
}
