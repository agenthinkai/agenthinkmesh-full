import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { turnaroundSessions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentOutput {
  agentId: string;
  status: "pending" | "running" | "complete" | "escalated" | "error";
  output: Record<string, unknown> | null;
  alerts: string[];
  completedAt?: number;
}

export interface LeadershipAlert {
  agentId: string;
  agentName: string;
  level: "critical" | "high";
  message: string;
  timestamp: number;
}

export interface TurnaroundReport {
  executiveSummary: string;
  contradictionFlags: string[];
  anomalyAlerts: string[];
  unifiedAssessment: string;
  agents: {
    id: string;
    name: string;
    output: Record<string, unknown>;
  }[];
  actionPlan: {
    rank: number;
    action: string;
    owner: string;
    urgency: "critical" | "high" | "medium";
    impact: "high" | "medium" | "low";
    timeframe: string;
  }[];
  alertsSummary: LeadershipAlert[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeJson(raw: string | null | undefined, fallback: unknown = null): unknown {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeContent(res: any): string {
  try {
    const content = res?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    return "";
  } catch { return ""; }
}

function safeParse<T>(content: string, fallback: T): T {
  try { return JSON.parse(content) as T; } catch { return fallback; }
}

// ── 6 Agent LLM Calls ─────────────────────────────────────────────────────────

async function runFinancialSentinel(docs: string, company: string, crisis: string): Promise<{ output: Record<string, unknown>; alerts: string[] }> {
  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Financial Sentinel — a specialist agent in crisis financial analysis. Analyse the provided documents and return a JSON object with these exact keys:
{
  "burnRate": { "monthly": number, "currency": "USD" | "KWD" | "SAR" | "AED" | "other" },
  "cashRunwayMonths": number,
  "survivalScenarios": [{ "months": 3 | 6 | 12, "probability": "high" | "medium" | "low", "keyAssumptions": string[] }],
  "costCutPlan": [{ "lineItem": string, "currentCost": string, "proposedCut": string, "priority": "critical" | "high" | "medium", "implementationWeeks": number }],
  "keyRisks": string[],
  "cashRunwayAlert": boolean
}
Set cashRunwayAlert to true if cash runway < 90 days. Return only valid JSON.`,
      },
      {
        role: "user",
        content: `Company: ${company}\nCrisis context: ${crisis || "Financial stress"}\n\nDocuments:\n${docs}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = safeContent(res);
  const output = safeParse<Record<string, unknown>>(content, {
    burnRate: { monthly: 0, currency: "USD" },
    cashRunwayMonths: 0,
    survivalScenarios: [],
    costCutPlan: [],
    keyRisks: ["Analysis unavailable — insufficient document data"],
    cashRunwayAlert: false,
  });

  const alerts: string[] = [];
  const cashRunway = (output.cashRunwayMonths as number) ?? 0;
  if ((output.cashRunwayAlert as boolean) || cashRunway < 3) {
    alerts.push(`CRITICAL: Cash runway is ${cashRunway < 1 ? "under 1 month" : `${cashRunway} months`} — below 90-day threshold`);
  }
  return { output, alerts };
}

async function runCustomerPulse(docs: string, company: string): Promise<{ output: Record<string, unknown>; alerts: string[] }> {
  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Customer Pulse agent — specialist in churn risk and customer intelligence. Analyse the provided documents and return a JSON object:
{
  "overallChurnRisk": number,
  "churnRiskPercent": number,
  "topAtRiskAccounts": [{ "name": string, "revenue": string, "churnRisk": "critical" | "high" | "medium", "reason": string, "reEngagementScript": string }],
  "priorityClientList": [{ "rank": number, "name": string, "revenue": string, "churnRisk": "critical" | "high" | "medium" }],
  "recommendations": string[],
  "churnAlert": boolean
}
Set churnAlert to true if churnRiskPercent > 15. Return only valid JSON.`,
      },
      { role: "user", content: `Company: ${company}\n\nDocuments:\n${docs}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = safeContent(res);
  const output = safeParse<Record<string, unknown>>(content, {
    overallChurnRisk: 0,
    churnRiskPercent: 0,
    topAtRiskAccounts: [],
    priorityClientList: [],
    recommendations: ["Analysis unavailable — insufficient document data"],
    churnAlert: false,
  });

  const alerts: string[] = [];
  const churnPct = (output.churnRiskPercent as number) ?? 0;
  if ((output.churnAlert as boolean) || churnPct > 15) {
    alerts.push(`HIGH: Customer churn risk at ${churnPct}% — exceeds 15% threshold`);
  }
  return { output, alerts };
}

async function runWorkflowOptimizer(docs: string, company: string): Promise<{ output: Record<string, unknown>; alerts: string[] }> {
  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Workflow Optimizer agent — specialist in operational efficiency and bottleneck analysis. Analyse the provided documents and return a JSON object:
{
  "bottlenecks": [{ "process": string, "timeLostHours": number, "costImpact": string, "severity": "critical" | "high" | "medium" }],
  "automationProposals": [{ "title": string, "description": string, "estimatedSavings": string, "implementationWeeks": number, "requiresFinancialValidation": boolean }],
  "efficiencyMetrics": { "before": string, "after": string, "improvement": string },
  "criticalPathDelayHours": number,
  "recommendations": string[],
  "delayAlert": boolean
}
Set delayAlert to true if criticalPathDelayHours > 48. Return only valid JSON.`,
      },
      { role: "user", content: `Company: ${company}\n\nDocuments:\n${docs}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = safeContent(res);
  const output = safeParse<Record<string, unknown>>(content, {
    bottlenecks: [],
    automationProposals: [],
    efficiencyMetrics: { before: "N/A", after: "N/A", improvement: "N/A" },
    criticalPathDelayHours: 0,
    recommendations: ["Analysis unavailable — insufficient document data"],
    delayAlert: false,
  });

  const alerts: string[] = [];
  const delayHours = (output.criticalPathDelayHours as number) ?? 0;
  if ((output.delayAlert as boolean) || delayHours > 48) {
    alerts.push(`HIGH: Critical path delays of ${delayHours}h detected — exceeds 48-hour threshold`);
  }
  return { output, alerts };
}

async function runNarrativeArchitect(docs: string, company: string, financialOutput: Record<string, unknown>): Promise<{ output: Record<string, unknown>; alerts: string[] }> {
  const financialContext = JSON.stringify(financialOutput).slice(0, 800);
  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Narrative Architect agent — specialist in crisis communications. Analyse the provided documents and financial context, then return a JSON object:
{
  "allStaffMemo": string,
  "investorLetter": string,
  "linkedInPosts": [{ "post": 1 | 2 | 3, "content": string }],
  "sentimentScore": number,
  "negativeSentimentPercent": number,
  "toneAlignedWithFinancials": boolean,
  "contradictionNote": string | null,
  "sentimentAlert": boolean
}
Set sentimentAlert to true if negativeSentimentPercent > 20. Ensure tone is aligned with the financial reality provided. Return only valid JSON.`,
      },
      {
        role: "user",
        content: `Company: ${company}\nFinancial context: ${financialContext}\n\nDocuments:\n${docs}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = safeContent(res);
  const output = safeParse<Record<string, unknown>>(content, {
    allStaffMemo: "Memo generation unavailable — insufficient document data",
    investorLetter: "Letter generation unavailable — insufficient document data",
    linkedInPosts: [],
    sentimentScore: 0,
    negativeSentimentPercent: 0,
    toneAlignedWithFinancials: true,
    contradictionNote: null,
    sentimentAlert: false,
  });

  const alerts: string[] = [];
  const negPct = (output.negativeSentimentPercent as number) ?? 0;
  if ((output.sentimentAlert as boolean) || negPct > 20) {
    alerts.push(`HIGH: Negative sentiment at ${negPct}% in input materials — exceeds 20% threshold`);
  }
  if (!(output.toneAlignedWithFinancials as boolean)) {
    alerts.push(`HIGH: Narrative tone does not match financial reality — contradiction flagged for Resilience Logger`);
  }
  return { output, alerts };
}

async function runComplianceGuardian(docs: string, company: string): Promise<{ output: Record<string, unknown>; alerts: string[] }> {
  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Compliance Guardian agent — specialist in regulatory risk and compliance. Analyse the provided documents and return a JSON object:
{
  "riskFlagRegister": [{ "flag": string, "severity": "critical" | "high" | "medium", "regulation": string, "owner": string, "daysToResolve": number }],
  "complianceChecklist": [{ "item": string, "status": "compliant" | "gap" | "unknown", "owner": string, "deadline": string }],
  "mitigationPlan": { "days30": string[], "days60": string[], "days90": string[] },
  "highRiskGapDetected": boolean,
  "criticalFlags": string[]
}
Set highRiskGapDetected to true if any critical or high severity gaps exist. Return only valid JSON.`,
      },
      { role: "user", content: `Company: ${company}\n\nDocuments:\n${docs}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = safeContent(res);
  const output = safeParse<Record<string, unknown>>(content, {
    riskFlagRegister: [],
    complianceChecklist: [],
    mitigationPlan: { days30: [], days60: [], days90: [] },
    highRiskGapDetected: false,
    criticalFlags: [],
  });

  const alerts: string[] = [];
  if (output.highRiskGapDetected as boolean) {
    const criticalFlags = (output.criticalFlags as string[]) ?? [];
    alerts.push(`CRITICAL: High-risk compliance gap detected — immediate action required${criticalFlags.length ? `: ${criticalFlags[0]}` : ""}`);
  }
  return { output, alerts };
}

async function runResilienceLogger(
  company: string,
  agentOutputs: AgentOutput[],
  allAlerts: LeadershipAlert[],
): Promise<{ output: Record<string, unknown>; alerts: string[] }> {
  const agentSummary = agentOutputs
    .filter(a => a.agentId !== "resilience-logger")
    .map(a => `${a.agentId}: ${JSON.stringify(a.output ?? {}).slice(0, 600)}`)
    .join("\n\n");

  const alertSummary = allAlerts.map(a => `[${a.level.toUpperCase()}] ${a.agentName}: ${a.message}`).join("\n");

  const res = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Resilience Logger — the memory backbone of a 6-agent crisis management system. Your job is to read all agent outputs, identify contradictions and anomalies, and produce an executive synthesis. Return a JSON object:
{
  "executiveSummary": string,
  "contradictionFlags": string[],
  "anomalyAlerts": string[],
  "unifiedAssessment": string,
  "actionPlan": [{ "rank": number, "action": string, "owner": string, "urgency": "critical" | "high" | "medium", "impact": "high" | "medium" | "low", "timeframe": string }]
}
The actionPlan must contain exactly 10 items ranked by urgency × impact. Return only valid JSON.`,
      },
      {
        role: "user",
        content: `Company: ${company}\n\nAgent outputs:\n${agentSummary}\n\nLeadership alerts fired:\n${alertSummary || "None"}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = safeContent(res);
  const output = safeParse<Record<string, unknown>>(content, {
    executiveSummary: "Synthesis unavailable — agent outputs incomplete",
    contradictionFlags: [],
    anomalyAlerts: [],
    unifiedAssessment: "Assessment unavailable",
    actionPlan: [],
  });

  return { output, alerts: [] };
}

// ── Background analysis runner ─────────────────────────────────────────────────

async function runTurnaroundAnalysis(sessionId: number) {
  const db = await getDb();
  if (!db) return;

  const AGENT_IDS = [
    "financial-sentinel",
    "customer-pulse",
    "workflow-optimizer",
    "narrative-architect",
    "compliance-guardian",
    "resilience-logger",
  ];

  const AGENT_NAMES: Record<string, string> = {
    "financial-sentinel": "Financial Sentinel",
    "customer-pulse": "Customer Pulse",
    "workflow-optimizer": "Workflow Optimizer",
    "narrative-architect": "Narrative Architect",
    "compliance-guardian": "Compliance Guardian",
    "resilience-logger": "Resilience Logger",
  };

  try {
    // Load session
    const rows = await db.select().from(turnaroundSessions).where(eq(turnaroundSessions.id, sessionId)).limit(1);
    const session = rows[0];
    if (!session) return;

    const documents = (safeJson(session.documents, []) as { slot: string; fileName: string; fileUrl: string }[]);
    const companyName = session.companyName ?? "Unknown Company";
    const crisisType = session.crisisType ?? "";

    // Helper: get text for a slot
    const getDocsText = (slotId: string) => {
      const slotDocs = documents.filter(d => d.slot === slotId);
      if (slotDocs.length === 0) return `No documents provided for ${slotId}`;
      return slotDocs.map(d => `File: ${d.fileName}\nURL: ${d.fileUrl}`).join("\n\n");
    };

    // Initialize agent outputs
    const agentOutputs: AgentOutput[] = AGENT_IDS.map(id => ({
      agentId: id,
      status: "pending",
      output: null,
      alerts: [],
    }));

    const allAlerts: LeadershipAlert[] = [];

    const updateDb = async (outputs: AgentOutput[], alerts: LeadershipAlert[], status?: "running" | "complete" | "error") => {
      await db.update(turnaroundSessions)
        .set({
          agentOutputs: JSON.stringify(outputs),
          alertsJson: JSON.stringify(alerts),
          ...(status ? { status } : {}),
        })
        .where(eq(turnaroundSessions.id, sessionId));
    };

    const setAgentStatus = (id: string, status: AgentOutput["status"]) => {
      const agent = agentOutputs.find(a => a.agentId === id);
      if (agent) agent.status = status;
    };

    const setAgentResult = (id: string, output: Record<string, unknown>, alerts: string[]) => {
      const agent = agentOutputs.find(a => a.agentId === id);
      if (agent) {
        agent.output = output;
        agent.alerts = alerts;
        agent.status = alerts.some(a => a.startsWith("CRITICAL")) ? "escalated" : "complete";
        agent.completedAt = Date.now();
      }
      // Add to leadership alerts
      for (const msg of alerts) {
        allAlerts.push({
          agentId: id,
          agentName: AGENT_NAMES[id] ?? id,
          level: msg.startsWith("CRITICAL") ? "critical" : "high",
          message: msg.replace(/^(CRITICAL|HIGH): /, ""),
          timestamp: Date.now(),
        });
      }
    };

    // Mark as running
    await updateDb(agentOutputs, allAlerts, "running");

    // ── Run 5 agents in parallel ──────────────────────────────────────────────
    for (const id of ["financial-sentinel", "customer-pulse", "workflow-optimizer", "narrative-architect", "compliance-guardian"]) {
      setAgentStatus(id, "running");
    }
    await updateDb(agentOutputs, allAlerts);

    const [sentinelResult, pulseResult, optimizerResult, narrativeResult, complianceResult] = await Promise.allSettled([
      runFinancialSentinel(getDocsText("financial-sentinel"), companyName, crisisType),
      runCustomerPulse(getDocsText("customer-pulse"), companyName),
      runWorkflowOptimizer(getDocsText("workflow-optimizer"), companyName),
      runNarrativeArchitect(getDocsText("narrative-architect"), companyName, {}),
      runComplianceGuardian(getDocsText("compliance-guardian"), companyName),
    ]);

    const sentinelOutput = sentinelResult.status === "fulfilled" ? sentinelResult.value : { output: {}, alerts: ["Financial Sentinel encountered an error"] };
    const pulseOutput = pulseResult.status === "fulfilled" ? pulseResult.value : { output: {}, alerts: [] };
    const optimizerOutput = optimizerResult.status === "fulfilled" ? optimizerResult.value : { output: {}, alerts: [] };

    // Re-run Narrative Architect with financial context
    let narrativeOutput = narrativeResult.status === "fulfilled" ? narrativeResult.value : { output: {}, alerts: [] };
    try {
      narrativeOutput = await runNarrativeArchitect(getDocsText("narrative-architect"), companyName, sentinelOutput.output);
    } catch { /* keep existing */ }

    const complianceOutput = complianceResult.status === "fulfilled" ? complianceResult.value : { output: {}, alerts: [] };

    setAgentResult("financial-sentinel", sentinelOutput.output, sentinelOutput.alerts);
    setAgentResult("customer-pulse", pulseOutput.output, pulseOutput.alerts);
    setAgentResult("workflow-optimizer", optimizerOutput.output, optimizerOutput.alerts);
    setAgentResult("narrative-architect", narrativeOutput.output, narrativeOutput.alerts);
    setAgentResult("compliance-guardian", complianceOutput.output, complianceOutput.alerts);

    await updateDb(agentOutputs, allAlerts);

    // ── Run Resilience Logger ─────────────────────────────────────────────────
    setAgentStatus("resilience-logger", "running");
    await updateDb(agentOutputs, allAlerts);

    const loggerResult = await runResilienceLogger(companyName, agentOutputs, allAlerts);
    setAgentResult("resilience-logger", loggerResult.output, loggerResult.alerts);

    // Build final report
    const loggerOutput = loggerResult.output as {
      executiveSummary?: string;
      contradictionFlags?: string[];
      anomalyAlerts?: string[];
      unifiedAssessment?: string;
      actionPlan?: unknown[];
    };

    const report: TurnaroundReport = {
      executiveSummary: loggerOutput.executiveSummary ?? "",
      contradictionFlags: (loggerOutput.contradictionFlags as string[]) ?? [],
      anomalyAlerts: (loggerOutput.anomalyAlerts as string[]) ?? [],
      unifiedAssessment: loggerOutput.unifiedAssessment ?? "",
      agents: agentOutputs
        .filter(a => a.agentId !== "resilience-logger")
        .map(a => ({ id: a.agentId, name: AGENT_NAMES[a.agentId] ?? a.agentId, output: a.output ?? {} })),
      actionPlan: (loggerOutput.actionPlan as TurnaroundReport["actionPlan"]) ?? [],
      alertsSummary: allAlerts,
    };

    await db.update(turnaroundSessions)
      .set({
        agentOutputs: JSON.stringify(agentOutputs),
        alertsJson: JSON.stringify(allAlerts),
        reportJson: JSON.stringify(report),
        status: "complete",
      })
      .where(eq(turnaroundSessions.id, sessionId));

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db.update(turnaroundSessions)
      .set({ status: "error", errorMessage: msg })
      .where(eq(turnaroundSessions.id, sessionId));
  }
}

// ── tRPC Router ───────────────────────────────────────────────────────────────

export const turnaroundRouter = router({

  // Upload a document to S3 for a turnaround session slot
  uploadDocument: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      mimeType: z.string(),
      base64Data: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const suffix = Date.now().toString(36);
      const key = `turnaround-docs/${suffix}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, fileName: input.fileName };
    }),

  // Create a new turnaround session and kick off analysis
  create: protectedProcedure
    .input(z.object({
      companyName: z.string().min(1),
      industry: z.string().optional(),
      crisisType: z.string().optional(),
      documents: z.array(z.object({
        slot: z.string(),
        fileName: z.string(),
        fileUrl: z.string(),
        mimeType: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [result] = await db.insert(turnaroundSessions).values({
        userId: ctx.user.id,
        companyName: input.companyName,
        industry: input.industry ?? null,
        crisisType: input.crisisType ?? null,
        documents: JSON.stringify(input.documents),
        agentOutputs: JSON.stringify([]),
        alertsJson: JSON.stringify([]),
        status: "pending",
      });

      const sessionId = (result as { insertId: number }).insertId;

      // Fire and forget — analysis runs in background
      runTurnaroundAnalysis(sessionId).catch(console.error);

      return { sessionId };
    }),

  // Poll session status and agent progress
  getStatus: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(turnaroundSessions).where(eq(turnaroundSessions.id, input.sessionId)).limit(1);
      const session = rows[0];
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const agentOutputs = (safeJson(session.agentOutputs, []) as AgentOutput[]);
      const alerts = (safeJson(session.alertsJson, []) as LeadershipAlert[]);

      const completedCount = agentOutputs.filter(a => a.status === "complete" || a.status === "escalated").length;
      const totalAgents = 6;
      const completionPct = Math.round((completedCount / totalAgents) * 100);

      return {
        status: session.status,
        companyName: session.companyName,
        industry: session.industry,
        crisisType: session.crisisType,
        agentOutputs,
        alerts,
        completionPct,
        createdAt: session.createdAt.getTime(),
        errorMessage: session.errorMessage ?? null,
      };
    }),

  // Get full report
  getReport: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(turnaroundSessions).where(eq(turnaroundSessions.id, input.sessionId)).limit(1);
      const session = rows[0];
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (session.status !== "complete") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis not yet complete" });

      const report = safeJson(session.reportJson, null) as TurnaroundReport | null;
      if (!report) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Report data missing" });

      return {
        report,
        companyName: session.companyName,
        industry: session.industry,
        crisisType: session.crisisType,
        createdAt: session.createdAt.getTime(),
        pdfStatus: session.pdfStatus as "idle" | "generating" | "ready" | "error",
        pdfUrl: session.pdfUrl ?? null,
      };
    }),

  // List all sessions for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const sessions = await db
      .select({
        id: turnaroundSessions.id,
        companyName: turnaroundSessions.companyName,
        industry: turnaroundSessions.industry,
        crisisType: turnaroundSessions.crisisType,
        status: turnaroundSessions.status,
        pdfStatus: turnaroundSessions.pdfStatus,
        pdfUrl: turnaroundSessions.pdfUrl,
        createdAt: turnaroundSessions.createdAt,
      })
      .from(turnaroundSessions)
      .where(eq(turnaroundSessions.userId, ctx.user.id))
      .orderBy(desc(turnaroundSessions.createdAt))
      .limit(50);

    return sessions.map(s => ({
      ...s,
      createdAt: s.createdAt.getTime(),
      pdfStatus: s.pdfStatus as "idle" | "generating" | "ready" | "error",
    }));
  }),

  // Start async PDF export job
  exportPdf: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select().from(turnaroundSessions).where(eq(turnaroundSessions.id, input.sessionId)).limit(1);
      const session = rows[0];
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (session.status !== "complete") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis not yet complete" });

      await db.update(turnaroundSessions)
        .set({ pdfStatus: "generating", pdfJobStartedAt: new Date() })
        .where(eq(turnaroundSessions.id, input.sessionId));

      // Fire and forget PDF generation
      generateTurnaroundPdf(input.sessionId).catch(console.error);

      return { started: true };
    }),

  // Poll PDF export status
  getPdfStatus: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db.select({
        pdfStatus: turnaroundSessions.pdfStatus,
        pdfUrl: turnaroundSessions.pdfUrl,
        userId: turnaroundSessions.userId,
      }).from(turnaroundSessions).where(eq(turnaroundSessions.id, input.sessionId)).limit(1);

      const session = rows[0];
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      return {
        pdfStatus: session.pdfStatus as "idle" | "generating" | "ready" | "error",
        pdfUrl: session.pdfUrl ?? null,
      };
    }),
});

// ── PDF Generation (async background job) ─────────────────────────────────────

async function generateTurnaroundPdf(sessionId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    const rows = await db.select().from(turnaroundSessions).where(eq(turnaroundSessions.id, sessionId)).limit(1);
    const session = rows[0];
    if (!session) return;

    const report = safeJson(session.reportJson, null) as TurnaroundReport | null;
    if (!report) throw new Error("Report data missing");

    // Build PDF content as HTML for rendering
    const html = buildTurnaroundPdfHtml(report, session.companyName ?? "Unknown", session.crisisType ?? "", session.createdAt);

    // Convert HTML to buffer using a simple approach
    const htmlBuffer = Buffer.from(html, "utf-8");
    const suffix = Date.now().toString(36);
    const key = `turnaround-reports/${sessionId}-${suffix}.html`;
    const { url } = await storagePut(key, htmlBuffer, "text/html");

    await db.update(turnaroundSessions)
      .set({ pdfStatus: "ready", pdfUrl: url })
      .where(eq(turnaroundSessions.id, sessionId));

  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    await db.update(turnaroundSessions)
      .set({ pdfStatus: "error", errorMessage: msg })
      .where(eq(turnaroundSessions.id, sessionId));
  }
}

function buildTurnaroundPdfHtml(report: TurnaroundReport, company: string, crisis: string, createdAt: Date): string {
  const date = createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const actionRows = (report.actionPlan ?? []).map((a, i) => `
    <tr style="border-bottom:1px solid #1E2D47">
      <td style="padding:10px 12px;font-family:monospace;color:#F59E0B;font-weight:700">${i + 1}</td>
      <td style="padding:10px 12px;color:#F0F4FA">${a.action}</td>
      <td style="padding:10px 12px;color:#8494AA">${a.owner}</td>
      <td style="padding:10px 12px"><span style="padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${a.urgency === "critical" ? "#EF444420" : a.urgency === "high" ? "#F59E0B20" : "#1E2D47"};color:${a.urgency === "critical" ? "#EF4444" : a.urgency === "high" ? "#F59E0B" : "#8494AA"}">${a.urgency.toUpperCase()}</span></td>
      <td style="padding:10px 12px;color:#8494AA">${a.timeframe}</td>
    </tr>
  `).join("");

  const alertRows = (report.alertsSummary ?? []).map(a => `
    <div style="padding:12px 16px;border-radius:8px;background:${a.level === "critical" ? "#EF444410" : "#F59E0B10"};border:1px solid ${a.level === "critical" ? "#EF444430" : "#F59E0B30"};margin-bottom:8px">
      <span style="font-size:11px;font-weight:700;color:${a.level === "critical" ? "#EF4444" : "#F59E0B"};font-family:monospace">${a.level.toUpperCase()} · ${a.agentName}</span>
      <div style="color:#C8D4E8;font-size:13px;margin-top:4px">${a.message}</div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>100-Hour Turnaround Report — ${company}</title>
<style>
  body { margin:0; background:#080F1E; color:#F0F4FA; font-family:'Segoe UI',system-ui,sans-serif; }
  .page { max-width:900px; margin:0 auto; padding:60px 48px; }
  h1 { font-size:36px; font-weight:900; margin:0 0 8px; }
  h2 { font-size:20px; font-weight:700; color:#F59E0B; border-bottom:1px solid #1E2D47; padding-bottom:10px; margin:40px 0 16px; }
  h3 { font-size:15px; font-weight:700; color:#C8D4E8; margin:24px 0 8px; }
  p { color:#8494AA; line-height:1.7; font-size:14px; }
  table { width:100%; border-collapse:collapse; }
  .cover-badge { display:inline-block; padding:6px 14px; border-radius:20px; background:#F59E0B12; border:1px solid #F59E0B30; font-size:11px; font-family:monospace; color:#F59E0B; letter-spacing:0.08em; margin-bottom:24px; }
  .footer { margin-top:60px; padding-top:20px; border-top:1px solid #1E2D47; font-size:11px; color:#4A5A72; display:flex; justify-content:space-between; }
</style>
</head>
<body>
<div class="page">
  <!-- Cover -->
  <div style="min-height:300px;display:flex;flex-direction:column;justify-content:center;margin-bottom:60px">
    <div class="cover-badge">⏱ 100-HOUR TURNAROUND · CONFIDENTIAL</div>
    <h1 style="font-size:42px;background:linear-gradient(135deg,#F0F4FA,#FCD34D);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${company}</h1>
    <div style="font-size:16px;color:#8494AA;margin-bottom:8px">Crisis Response Report</div>
    <div style="font-size:13px;color:#4A5A72">${crisis || "Enterprise Crisis Management"} · Generated ${date}</div>
    <div style="margin-top:32px;display:flex;gap:32px">
      <div><div style="font-size:28px;font-family:monospace;font-weight:900;color:#F59E0B">100</div><div style="font-size:10px;color:#4A5A72;font-family:monospace;letter-spacing:0.06em">HOURS</div></div>
      <div><div style="font-size:28px;font-family:monospace;font-weight:900;color:#C8D4E8">6</div><div style="font-size:10px;color:#4A5A72;font-family:monospace;letter-spacing:0.06em">AGENTS</div></div>
      <div><div style="font-size:28px;font-family:monospace;font-weight:900;color:#4ADE80">${(report.alertsSummary ?? []).length}</div><div style="font-size:10px;color:#4A5A72;font-family:monospace;letter-spacing:0.06em">ALERTS</div></div>
    </div>
  </div>

  <!-- Executive Summary -->
  <h2>Executive Summary</h2>
  <p style="color:#C8D4E8;font-size:15px;line-height:1.8">${report.executiveSummary}</p>

  ${(report.contradictionFlags ?? []).length > 0 ? `
  <h3>Contradiction Flags</h3>
  ${(report.contradictionFlags ?? []).map(f => `<div style="padding:10px 14px;border-radius:6px;background:#EF444410;border:1px solid #EF444430;color:#EF4444;font-size:13px;margin-bottom:6px">⚠ ${f}</div>`).join("")}
  ` : ""}

  <!-- Leadership Alerts -->
  ${(report.alertsSummary ?? []).length > 0 ? `
  <h2>Leadership Alerts</h2>
  ${alertRows}
  ` : ""}

  <!-- Unified Action Plan -->
  <h2>Unified Action Plan — Top 10 Priorities</h2>
  <table>
    <thead><tr style="border-bottom:1px solid #1E2D47">
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#4A5A72;font-family:monospace">#</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#4A5A72;font-family:monospace">ACTION</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#4A5A72;font-family:monospace">OWNER</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#4A5A72;font-family:monospace">URGENCY</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#4A5A72;font-family:monospace">TIMEFRAME</th>
    </tr></thead>
    <tbody>${actionRows}</tbody>
  </table>

  <!-- Agent Sections -->
  ${(report.agents ?? []).map(agent => `
  <h2>${agent.name}</h2>
  <pre style="background:#111E35;border:1px solid #1E2D47;border-radius:8px;padding:16px;overflow:auto;font-size:12px;color:#8494AA;white-space:pre-wrap">${JSON.stringify(agent.output, null, 2)}</pre>
  `).join("")}

  <div class="footer">
    <span>AgenThink · 100-Hour Turnaround · Confidential</span>
    <span>${date}</span>
  </div>
</div>
</body>
</html>`;
}
