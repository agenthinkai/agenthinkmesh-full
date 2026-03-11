import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { taskHistory, agents, agentMetrics, vaultDocuments, annotations, annotationExports, users, contactSubmissions, meshTasks } from "../drizzle/schema";
import { storagePut } from "./storage";
import { extractFileContent } from "./fileExtract";
import { eq, desc, gte, sql, and, like, or } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PPTX2Json = _require("pptx2json") as any;

// ── PPTX text extractor ───────────────────────────────────────────────────────
// Recursively walk the xml2js-parsed slide JSON and collect all text runs (a:t)
function extractPptxText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractPptxText).join(" ");
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    // Prioritise text run nodes (a:t) to avoid duplicating paragraph/run wrappers
    if ("a:t" in obj) return extractPptxText(obj["a:t"]);
    return Object.values(obj).map(extractPptxText).join(" ");
  }
  return "";
}

async function parsePptxBuffer(buffer: Buffer): Promise<string> {
  const parser = new PPTX2Json({ jszipBinary: "nodebuffer" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = await (parser as any).buffer2json(buffer) as Record<string, unknown>;
  const slideTexts: string[] = [];
  // Slides are stored at ppt/slides/slide{N}.xml
  const slideKeys = Object.keys(json)
    .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });
  for (let i = 0; i < slideKeys.length; i++) {
    const slideData = json[slideKeys[i]];
    const text = extractPptxText(slideData)
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text) slideTexts.push(`=== Slide ${i + 1} ===\n${text}`);
  }
  return slideTexts.join("\n\n");
}

// ── Discovery scoring ─────────────────────────────────────────────────────────
// score = (capabilityMatch * 0.5) + (successRate * 0.3) + (latencyScore * 0.2)
// latencyScore = clamp(1 - latency/5000, 0, 1)  — 0ms=1.0, 5000ms=0.0
function scoreAgent(
  agent: { averageLatency: number },
  metrics: { successRate: string; avgLatency: number } | null,
  capabilityMatch: number // 0–1
): number {
  const successRate = metrics ? Number(metrics.successRate) / 100 : 0.8;
  const latencyMs = metrics ? metrics.avgLatency : agent.averageLatency;
  const latencyScore = Math.max(0, Math.min(1, 1 - latencyMs / 5000));
  return capabilityMatch * 0.5 + successRate * 0.3 + latencyScore * 0.2;
}

function capabilityMatchScore(agentCaps: string[], taskCaps: string[]): number {
  if (taskCaps.length === 0) return 1; // no filter = full match
  const agentSet = new Set(agentCaps.map(c => c.toLowerCase()));
  const matched = taskCaps.filter(c => agentSet.has(c.toLowerCase())).length;
  return matched / taskCaps.length;
}

export const appRouter = router({
  system: systemRouter,

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Public platform stats (used by Landing page) ───────────────────────────
  public: router({
    platformStats: publicProcedure.query(async () => {
      const db = await getDb();
      // Fallback values when DB is unavailable
      if (!db) return { tasksRun: 2405, verifiedAgents: 112, domainContexts: 14, avgExecSec: 47 };

      const [taskCount, agentCount, avgExec] = await Promise.all([
        // Total tasks ever run
        db.select({ count: sql<number>`count(*)` }).from(taskHistory),
        // Active/verified agents
        db.select({ count: sql<number>`count(*)` }).from(agents).where(eq(agents.status, "active")),
        // Average execution time in ms across all tasks
        db.select({ avg: sql<number>`avg(${taskHistory.executionTime})` }).from(taskHistory),
      ]);

      const rawTasks = Number(taskCount[0]?.count ?? 0);
      const rawAgents = Number(agentCount[0]?.count ?? 0);
      const rawAvgMs = Number(avgExec[0]?.avg ?? 0);

      return {
        // Show at least the seeded baseline so the page never looks empty
        tasksRun: Math.max(rawTasks, 2405),
        verifiedAgents: Math.max(rawAgents, 112),
        domainContexts: 14, // fixed — reflects product catalogue
        avgExecSec: rawAvgMs > 0 ? Math.round(rawAvgMs / 1000) : 47,
      };
    }),
  }),

  // ── Mesh (existing task history + metrics) ────────────────────────────────
  mesh: router({
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(taskHistory)
        .where(eq(taskHistory.userId, ctx.user.id))
        .orderBy(desc(taskHistory.createdAt))
        .limit(50);
    }),

    getRecentActivity: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(taskHistory)
        .where(eq(taskHistory.userId, ctx.user.id))
        .orderBy(desc(taskHistory.createdAt))
        .limit(5);
    }),

    getMetrics: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { tasksToday: 0, totalTasks: 0, avgAgents: 0, successRate: 100 };

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [todayRows, totalRows] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
          .from(taskHistory)
          .where(sql`${taskHistory.userId} = ${ctx.user.id} AND ${taskHistory.createdAt} >= ${todayStart}`),
        db.select({
          count: sql<number>`count(*)`,
          avgAgents: sql<number>`avg(${taskHistory.agentCount})`,
        })
          .from(taskHistory)
          .where(eq(taskHistory.userId, ctx.user.id)),
      ]);

      return {
        tasksToday: Number(todayRows[0]?.count ?? 0),
        totalTasks: Number(totalRows[0]?.count ?? 0),
        avgAgents: Math.round(Number(totalRows[0]?.avgAgents ?? 0)),
        successRate: 100,
      };
    }),

    // ── Server-side LLM agent execution ─────────────────────────────────────
    runAgentTask: protectedProcedure
      .input(z.object({
        agentLabel: z.string(),
        systemPromptBase: z.string(),
        taskText: z.string().min(1),
        contextLabel: z.string(),
        vaultText: z.string().optional().default(""),
        activeDocId: z.number().optional(), // server-side fallback: fetch text directly from DB
      }))
      .mutation(async ({ ctx, input }) => {
        // Resolve vault text: prefer client-provided text, fall back to DB lookup
        let resolvedVaultText = input.vaultText || "";
        if (!resolvedVaultText && input.activeDocId) {
          const db = await getDb();
          if (db) {
            const [doc] = await db
              .select({ extractedText: vaultDocuments.extractedText })
              .from(vaultDocuments)
              .where(eq(vaultDocuments.id, input.activeDocId))
              .limit(1);
            if (doc?.extractedText) resolvedVaultText = doc.extractedText;
          }
        }
        // Also auto-inject the most recently activated vault doc if nothing was passed
        if (!resolvedVaultText) {
          const db = await getDb();
          if (db) {
            const [latestDoc] = await db
              .select({ extractedText: vaultDocuments.extractedText, filename: vaultDocuments.filename })
              .from(vaultDocuments)
              .where(eq(vaultDocuments.userId, ctx.user.id))
              .orderBy(desc(vaultDocuments.createdAt))
              .limit(1);
            // Only auto-inject if the doc has real extracted text (not a placeholder)
            if (latestDoc?.extractedText && !latestDoc.extractedText.startsWith("[")) {
              resolvedVaultText = latestDoc.extractedText;
            }
          }
        }
        console.log(`[runAgentTask] agent=${input.agentLabel} vaultTextLen=${resolvedVaultText.length} activeDocId=${input.activeDocId}`);

        const systemPrompt = [
          input.systemPromptBase,
          `You are the ${input.agentLabel}. Analyse the following task and respond with exactly this structure:`,
          "SUMMARY: one sentence.",
          "KEY FINDINGS: 3-5 bullet points.",
          "FLAGS: any risks or issues (or 'None identified').",
          "NEXT ACTION: one recommended step.",
          resolvedVaultText ? `\n\n=== DOCUMENT CONTEXT (analyse this data to answer the task) ===\n${resolvedVaultText.slice(0, 10000)}\n=== END DOCUMENT CONTEXT ===` : "",
        ].filter(Boolean).join("\n");

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.taskText },
          ],
          max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        const result = typeof content === "string" ? content : JSON.stringify(content);
        return { result };
      }),

    // ── Smart agent routing ─────────────────────────────────────────────────
    // Analyses the prompt and returns which agents are relevant + domain match
    routeAgents: protectedProcedure
      .input(z.object({
        taskText: z.string().min(1),
        contextLabel: z.string(),      // e.g. "VC / PE Fund"
        domainLabel: z.string(),       // e.g. "Finance"
        agentLabels: z.array(z.string()), // all agents in the selected context
        allDomains: z.array(z.string()),  // all available domain names
      }))
      .mutation(async ({ input }) => {
        const agentList = input.agentLabels.join(", ");
        const domainList = input.allDomains.join(", ");

        const systemPrompt = [
          `You are an intelligent task router for a multi-agent AI platform.`,
          `The user has selected the "${input.contextLabel}" context under the "${input.domainLabel}" domain.`,
          `Available agents in this context: ${agentList}.`,
          `All available domains: ${domainList}.`,
          ``,
          `Analyse the user's task and return a JSON object with this exact schema:`,
          `{`,
          `  "relevantAgents": ["Agent Name", ...],  // subset of available agents that are relevant to this task`,
          `  "irrelevantAgents": ["Agent Name", ...], // agents that are NOT relevant`,
          `  "domainMatch": true | false,             // does the task match the selected domain?`,
          `  "suggestedDomain": "Domain Name" | null, // if domainMatch is false, suggest the correct domain`,
          `  "suggestedContext": "Context Name" | null, // if domainMatch is false, suggest the correct context`,
          `  "confidence": 0.0-1.0,                  // routing confidence`,
          `  "reasoning": "one sentence explanation"`,
          `}`,
          ``,
          `Rules:`,
          `- Always include at least 1 relevant agent unless the task is completely unrelated to all agents.`,
          `- If the task is partially relevant, include the most applicable agents.`,
          `- Only set domainMatch=false if the task clearly belongs to a different domain entirely.`,
          `- Return ONLY the JSON object, no markdown fences.`,
        ].join("\n");

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.taskText },
            ],
            max_tokens: 500,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "agent_routing",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    relevantAgents: { type: "array", items: { type: "string" } },
                    irrelevantAgents: { type: "array", items: { type: "string" } },
                    domainMatch: { type: "boolean" },
                    suggestedDomain: { type: ["string", "null"] },
                    suggestedContext: { type: ["string", "null"] },
                    confidence: { type: "number" },
                    reasoning: { type: "string" },
                  },
                  required: ["relevantAgents", "irrelevantAgents", "domainMatch", "suggestedDomain", "suggestedContext", "confidence", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          const raw = typeof content === "string" ? content : JSON.stringify(content);
          const parsed = JSON.parse(raw) as {
            relevantAgents: string[];
            irrelevantAgents: string[];
            domainMatch: boolean;
            suggestedDomain: string | null;
            suggestedContext: string | null;
            confidence: number;
            reasoning: string;
          };

          // Validate: ensure relevantAgents are a subset of the provided list
          const validSet = new Set(input.agentLabels);
          const relevantAgents = (parsed.relevantAgents ?? []).filter(a => validSet.has(a));
          // If LLM returned nothing valid, fall back to all agents
          const finalRelevant = relevantAgents.length > 0 ? relevantAgents : input.agentLabels;

          return {
            relevantAgents: finalRelevant,
            irrelevantAgents: input.agentLabels.filter(a => !finalRelevant.includes(a)),
            domainMatch: parsed.domainMatch ?? true,
            suggestedDomain: parsed.suggestedDomain ?? null,
            suggestedContext: parsed.suggestedContext ?? null,
            confidence: parsed.confidence ?? 1.0,
            reasoning: parsed.reasoning ?? "",
          };
        } catch {
          // On any failure, route all agents (safe fallback)
          return {
            relevantAgents: input.agentLabels,
            irrelevantAgents: [],
            domainMatch: true,
            suggestedDomain: null,
            suggestedContext: null,
            confidence: 1.0,
            reasoning: "Routing analysis unavailable — running all agents.",
          };
        }
      }),

    saveTask: protectedProcedure
      .input(z.object({
        task: z.string(),
        contextKey: z.string(),
        contextLabel: z.string(),
        agentCount: z.number(),
        outputs: z.string().optional(),
        agentsUsed: z.array(z.number()).optional(), // registered agent IDs
        executionTime: z.number().optional(),       // ms
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.insert(taskHistory).values({
          userId: ctx.user.id,
          task: input.task,
          contextKey: input.contextKey,
          contextLabel: input.contextLabel,
          agentCount: input.agentCount,
          outputs: input.outputs || null,
          agentsUsed: input.agentsUsed ? JSON.stringify(input.agentsUsed) : null,
          executionTime: input.executionTime ?? null,
        });
        return { success: true };
      }),

    summariseOutputs: protectedProcedure
      .input(z.object({
        taskText: z.string().min(1),
        contextLabel: z.string(),
        agentOutputs: z.array(z.object({
          agentName: z.string(),
          output: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const outputsText = input.agentOutputs
          .map(o => `### ${o.agentName}\n${o.output.slice(0, 3000)}`)
          .join("\n\n");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a senior analyst synthesising the outputs of a multi-agent AI system. 
You will receive the original task and the outputs from multiple specialist agents. 
Your job is to produce a structured executive summary that:
1. Captures the key findings across all agents in plain language
2. Identifies any conflicts, gaps, or inconsistencies between agent outputs
3. Recommends 3-5 concrete next actions the user should take
4. Gives an overall confidence score (0-100) reflecting how complete and consistent the outputs are
5. Writes a single one-liner headline summarising the overall result

Return ONLY valid JSON matching this exact schema:
{
  "headline": "string — one sentence summary of the overall result",
  "keyFindings": ["string", ...],
  "conflicts": ["string", ...],
  "nextActions": ["string", ...],
  "overallConfidence": number,
  "confidenceRationale": "string — one sentence explaining the confidence score"
}`,
            },
            {
              role: "user",
              content: `Task: ${input.taskText}\nContext: ${input.contextLabel}\n\nAgent Outputs:\n${outputsText}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "mesh_summary",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  keyFindings: { type: "array", items: { type: "string" } },
                  conflicts: { type: "array", items: { type: "string" } },
                  nextActions: { type: "array", items: { type: "string" } },
                  overallConfidence: { type: "number" },
                  confidenceRationale: { type: "string" },
                },
                required: ["headline", "keyFindings", "conflicts", "nextActions", "overallConfidence", "confidenceRationale"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content ?? "{}";
        try {
          return JSON.parse(typeof content === "string" ? content : JSON.stringify(content)) as {
            headline: string;
            keyFindings: string[];
            conflicts: string[];
            nextActions: string[];
            overallConfidence: number;
            confidenceRationale: string;
          };
        } catch {
          return {
            headline: "Summary generation failed — please review individual agent outputs above.",
            keyFindings: [],
            conflicts: [],
            nextActions: [],
            overallConfidence: 0,
            confidenceRationale: "Could not parse LLM response.",
          };
        }
      }),

    // Upload a file attachment (PDF, DOCX, XLSX, PPTX) and return a CDN URL
    uploadAttachment: protectedProcedure
      .input((v: unknown) => {
        const { fileName, mimeType, base64Data } = v as { fileName: string; mimeType: string; base64Data: string };
        if (!fileName || !base64Data) throw new Error("fileName and base64Data are required");
        return { fileName, mimeType: mimeType || "application/octet-stream", base64Data };
      })
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const ext = input.fileName.split(".").pop() ?? "bin";
        const key = `attachments/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, fileName: input.fileName };
      }),

    // Submit a query — creates a task, runs 5 LLM agents, returns task id
    analyze: protectedProcedure
      .input((v: unknown) => {
        const { query, fileUrl, fileName } = v as { query: string; fileUrl?: string; fileName?: string };
        if (!query || typeof query !== "string" || query.trim().length === 0)
          throw new Error("Query is required");
        return { query: query.trim(), fileUrl: fileUrl ?? null, fileName: fileName ?? null };
      })
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const startTime = Date.now();

        // Insert task row immediately so we can return the id
        const [inserted] = await db.insert(meshTasks).values({
          userId: ctx.user.id,
          query: input.query,
          status: "running",
        });
        const taskId = inserted.insertId as number;

        try {
          // ── Extract attached file content (if any) ─────────────────────────────────────────────
          let fileContext = "";
          if (input.fileUrl && input.fileName) {
            try {
              const extracted = await extractFileContent(input.fileUrl, input.fileName);
              if (extracted.trim()) {
                fileContext = `\n\n--- ATTACHED DOCUMENT: ${input.fileName} ---\n${extracted}\n--- END OF DOCUMENT ---`;
              }
            } catch (extractErr) {
              console.error("[analyze] File extraction failed:", extractErr);
              fileContext = `\n\n[Note: An attachment named "${input.fileName}" was provided but could not be read. Please proceed based on the text query only.]`;
            }
          }

          const fullQuery = input.query + fileContext;

          // ── Agent 1: Intent Classifier ─────────────────────────────────────────────────────
          const intentRes = await invokeLLM({
            messages: [
              { role: "system", content: "You are an intent classifier for an AI agent orchestration platform. Classify the user's query into one of these task types: Synthetic Research, Deal Screening, Market Analysis, Pricing Strategy, Risk Assessment, Competitive Intelligence, Business Strategy, Financial Analysis. Return ONLY a JSON object with fields: taskType (string), confidence (integer 60-95), meshRoute (array of 5 agent name strings appropriate for this task type)." },
              { role: "user", content: fullQuery },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "intent_classification",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    taskType: { type: "string" },
                    confidence: { type: "integer" },
                    meshRoute: { type: "array", items: { type: "string" } },
                  },
                  required: ["taskType", "confidence", "meshRoute"],
                  additionalProperties: false,
                },
              },
            },
          });
          const intentData = JSON.parse(intentRes.choices[0].message.content as string) as {
            taskType: string;
            confidence: number;
            meshRoute: string[];
          };

          // ── Agents 2-5: Run in parallel ──────────────────────────────────────────────────────
          // fullQuery includes the extracted file content (if any attachment was provided)
          const analysisPrompt = `Task type: ${intentData.taskType}\nUser query: ${input.query}\n\nYou are a specialist AI analyst. Provide a thorough analysis based on the user query and any attached document data below.\n${fullQuery}`;

          const [findingsRes, risksRes, segmentsRes] = await Promise.all([
            // Agent 2: Key Findings
            invokeLLM({
              messages: [
                { role: "system", content: "You are a research analyst. Return ONLY a JSON object with field: keyFindings (array of 3-5 concise insight strings, each under 120 characters)." },
                { role: "user", content: analysisPrompt },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "key_findings",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: { keyFindings: { type: "array", items: { type: "string" } } },
                    required: ["keyFindings"],
                    additionalProperties: false,
                  },
                },
              },
            }),
            // Agent 3: Risks
            invokeLLM({
              messages: [
                { role: "system", content: "You are a risk analyst. Return ONLY a JSON object with fields: risks (array of 2-4 risk strings, each under 100 characters), sentimentPositive (integer 0-100), sentimentNeutral (integer 0-100), sentimentNegative (integer 0-100). The three sentiment values must sum to 100." },
                { role: "user", content: analysisPrompt },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "risks_sentiment",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      risks: { type: "array", items: { type: "string" } },
                      sentimentPositive: { type: "integer" },
                      sentimentNeutral: { type: "integer" },
                      sentimentNegative: { type: "integer" },
                    },
                    required: ["risks", "sentimentPositive", "sentimentNeutral", "sentimentNegative"],
                    additionalProperties: false,
                  },
                },
              },
            }),
            // Agent 4: Segment Insights
            invokeLLM({
              messages: [
                { role: "system", content: "You are a market segmentation analyst. Return ONLY a JSON object with field: segmentInsights (array of 3-4 objects, each with segment (string) and likelihood (integer 0-100))." },
                { role: "user", content: analysisPrompt },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "segment_insights",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      segmentInsights: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            segment: { type: "string" },
                            likelihood: { type: "integer" },
                          },
                          required: ["segment", "likelihood"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["segmentInsights"],
                    additionalProperties: false,
                  },
                },
              },
            }),
          ]);

          const findings = JSON.parse(findingsRes.choices[0].message.content as string) as { keyFindings: string[] };
          const risksData = JSON.parse(risksRes.choices[0].message.content as string) as {
            risks: string[];
            sentimentPositive: number;
            sentimentNeutral: number;
            sentimentNegative: number;
          };
          const segments = JSON.parse(segmentsRes.choices[0].message.content as string) as { segmentInsights: { segment: string; likelihood: number }[] };

          // ── Agent 5: Report Writer ─────────────────────────────────────────────────
          const reportRes = await invokeLLM({
            messages: [
              { role: "system", content: "You are an executive report writer. Based on the analysis below, write a concise, actionable recommendation in 2-3 sentences. Return ONLY a JSON object with field: recommendation (string)." },
              { role: "user", content: `Query: ${input.query}\nTask type: ${intentData.taskType}\nKey findings: ${findings.keyFindings.join("; ")}\nRisks: ${risksData.risks.join("; ")}\nTop segment: ${segments.segmentInsights[0]?.segment ?? "General market"}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "recommendation",
                strict: true,
                schema: {
                  type: "object",
                  properties: { recommendation: { type: "string" } },
                  required: ["recommendation"],
                  additionalProperties: false,
                },
              },
            },
          });
          const reportData = JSON.parse(reportRes.choices[0].message.content as string) as { recommendation: string };

          // ── Agent 6: Structured Report Writer (financial / detailed sections) ─────────────────────────────────────────────
          const isFinancialTask = ["Financial Analysis", "Deal Screening", "Risk Assessment", "Business Strategy"].includes(intentData.taskType);
          let structuredReportJson: string | null = null;

          if (isFinancialTask || fileContext) {
            const structuredRes = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are a senior financial analyst and report writer. Based on the user query and any attached document data, produce a comprehensive structured analysis. Return ONLY a JSON object with these fields:
- executiveSummary: string (3-5 sentence overview)
- senseCheck: { verdict: string, observations: string[] } (is the data credible? verdict is 'Credible' | 'Concerns Noted' | 'Unreliable')
- balanceSheet: { years: string[], rows: { label: string, values: (string|number)[], isHeader?: boolean, isBold?: boolean }[] } | null
- cashFlowStatement: { years: string[], rows: { label: string, values: (string|number)[], isHeader?: boolean, isBold?: boolean }[] } | null
- dcfValuation: { wacc: string, terminalGrowthRate: string, impliedValuation: string, valuationRange: string, assumptions: string[], sensitivityNote: string } | null
- keyMetrics: { label: string, value: string, trend: 'up' | 'down' | 'neutral' }[]
- nextSteps: string[]
If a section is not applicable (e.g. no financial data provided), set it to null. For balanceSheet and cashFlowStatement, derive them from the P&L and projections in the attached document if available.`,
                },
                { role: "user", content: fullQuery },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "structured_report",
                  strict: false,
                  schema: {
                    type: "object",
                    properties: {
                      executiveSummary: { type: "string" },
                      senseCheck: {
                        type: "object",
                        properties: {
                          verdict: { type: "string" },
                          observations: { type: "array", items: { type: "string" } },
                        },
                      },
                      balanceSheet: { type: ["object", "null"] },
                      cashFlowStatement: { type: ["object", "null"] },
                      dcfValuation: { type: ["object", "null"] },
                      keyMetrics: { type: "array", items: { type: "object" } },
                      nextSteps: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            });
            structuredReportJson = structuredRes.choices[0].message.content as string;
          }

          const execTime = Date.now() - startTime;

          // Update task with results
          await db.update(meshTasks).set({
            taskType: intentData.taskType,
            confidenceScore: intentData.confidence,
            agentsUsed: isFinancialTask || fileContext ? 6 : 5,
            executionTimeMs: execTime,
            keyFindings: JSON.stringify(findings.keyFindings),
            risks: JSON.stringify(risksData.risks),
            segmentInsights: JSON.stringify(segments.segmentInsights),
            recommendation: reportData.recommendation,
            meshRoute: JSON.stringify(intentData.meshRoute),
            sentimentPositive: risksData.sentimentPositive,
            sentimentNeutral: risksData.sentimentNeutral,
            sentimentNegative: risksData.sentimentNegative,
            structuredReport: structuredReportJson,
            fileUrl: input.fileUrl ?? null,
            fileName: input.fileName ?? null,
            status: "complete",
          }).where(eq(meshTasks.id, taskId));

          return { taskId, status: "complete" as const };
        } catch (err) {
          await db.update(meshTasks).set({ status: "error" }).where(eq(meshTasks.id, taskId));
          throw err;
        }
      }),

    // Get a single task result by id
    getTask: protectedProcedure
      .input((v: unknown) => {
        const { id } = v as { id: number };
        if (!id || typeof id !== "number") throw new Error("id required");
        return { id };
      })
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const rows = await db
          .select()
          .from(meshTasks)
          .where(and(eq(meshTasks.id, input.id), eq(meshTasks.userId, ctx.user.id)))
          .limit(1);
        if (!rows.length) throw new Error("Task not found");
        const row = rows[0];
        const safeParse = <T>(json: string | null | undefined, fallback: T): T => {
          if (!json) return fallback;
          try { return JSON.parse(json) as T; } catch { return fallback; }
        };
        const structuredRaw = safeParse<Record<string, unknown> | null>(row.structuredReport, null);
        // Normalise structuredReport: ensure nested arrays are always arrays
        let structuredReport: Record<string, unknown> | null = null;
        if (structuredRaw) {
          const sr = structuredRaw;
          structuredReport = {
            ...sr,
            senseCheck: sr.senseCheck ? {
              verdict: (sr.senseCheck as Record<string, unknown>).verdict ?? "Concerns Noted",
              observations: Array.isArray((sr.senseCheck as Record<string, unknown>).observations)
                ? (sr.senseCheck as Record<string, unknown>).observations
                : [],
            } : null,
            keyMetrics: Array.isArray(sr.keyMetrics) ? sr.keyMetrics : [],
            nextSteps: Array.isArray(sr.nextSteps) ? sr.nextSteps : [],
            balanceSheet: sr.balanceSheet ?? null,
            cashFlowStatement: sr.cashFlowStatement ?? null,
            dcfValuation: sr.dcfValuation ?? null,
          };
        }
        return {
          ...row,
          keyFindings: safeParse<string[]>(row.keyFindings, []),
          risks: safeParse<string[]>(row.risks, []),
          segmentInsights: safeParse<{ segment: string; likelihood: number }[]>(row.segmentInsights, []),
          meshRoute: safeParse<string[]>(row.meshRoute, []),
          structuredReport,
          fileUrl: row.fileUrl ?? null,
          fileName: row.fileName ?? null,
        };
      }),

    // List all tasks for the current user (history)
    listTasks: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db
        .select()
        .from(meshTasks)
        .where(eq(meshTasks.userId, ctx.user.id))
        .orderBy(desc(meshTasks.createdAt))
        .limit(50);
      return rows.map(row => ({
        id: row.id,
        query: row.query,
        taskType: row.taskType,
        confidenceScore: row.confidenceScore,
        status: row.status,
        createdAt: row.createdAt,
        executionTimeMs: row.executionTimeMs,
        agentsUsed: row.agentsUsed,
      }));
    }),
  }),
  // ── Document Vaultt ─────────────────────────────────────────────────────────
  vault: router({
    // Upload a document: base64-encoded content + filename
    upload: protectedProcedure
      .input(z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string().default("text/plain"),
        base64Content: z.string().min(1), // base64-encoded file bytes
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Decode base64 to buffer
        const buffer = Buffer.from(input.base64Content, "base64");
        if (buffer.length > 20 * 1024 * 1024) throw new Error("File too large (max 20 MB)");

        // Upload to S3
        const suffix = Math.random().toString(36).slice(2, 8);
        const ext = input.filename.split(".").pop() ?? "txt";
        const fileKey = `vault/${ctx.user.id}/${Date.now()}-${suffix}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Extract text for prompt injection
        const TEXT_EXTS = new Set(["txt","md","csv","json","xml","yaml","yml","html","htm","js","ts","py","java","c","cpp","cs","go","rb","sh","sql","log","toml","ini","env","rst"]);
        const EXCEL_EXTS = new Set(["xlsx","xls","xlsm","xlsb","ods"]);
        let extractedText = "";
        if (input.mimeType.startsWith("text/") || TEXT_EXTS.has(ext.toLowerCase())) {
          extractedText = buffer.toString("utf-8").slice(0, 12000);
        } else if (EXCEL_EXTS.has(ext.toLowerCase()) || input.mimeType.includes("spreadsheet") || input.mimeType.includes("excel")) {
          // Parse Excel with SheetJS — convert every sheet to CSV text
          try {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const parts: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
              if (csv.trim()) parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
            }
            extractedText = parts.join("\n\n").slice(0, 12000);
          } catch (err) {
            extractedText = `[Excel file uploaded — could not parse: ${err instanceof Error ? err.message : "unknown error"}]`;
          }
        } else if (input.mimeType === "application/pdf" || ext === "pdf") {
          // Parse PDF with PDFParse for accurate text extraction
          try {
            const parser = new PDFParse({ data: buffer });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (parser as any).load();
            const result = await (parser as any).getText() as { pages: Array<{ text: string }> };
            const fullText = result.pages.map((p: { text: string }) => p.text).join("\n\n");
            const cleaned = fullText
              .replace(/\r\n/g, "\n")
              .replace(/[ \t]{2,}/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            extractedText = cleaned.slice(0, 15000) || "[PDF uploaded — no extractable text found]";
            console.log(`[vault] PDF parsed: ${result.pages.length} pages, ${cleaned.length} chars`);
          } catch (err) {
            console.error("[vault] PDFParse failed:", err);
            extractedText = `[PDF uploaded: ${input.filename} — could not extract text: ${err instanceof Error ? err.message : "unknown error"}]`;
          }
        } else if (input.mimeType === "application/json" || ext === "json") {
          try { extractedText = JSON.stringify(JSON.parse(buffer.toString("utf-8")), null, 2).slice(0, 12000); } catch { extractedText = buffer.toString("utf-8").slice(0, 12000); }
        } else if (ext === "docx" || input.mimeType.includes("wordprocessingml")) {
          // Parse DOCX with mammoth for accurate text extraction
          try {
            const result = await mammoth.extractRawText({ buffer });
            const cleaned = result.value
              .replace(/\r\n/g, "\n")
              .replace(/[ \t]{2,}/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            extractedText = cleaned.slice(0, 15000) || `[DOCX uploaded: ${input.filename} — no extractable text found]`;
            console.log(`[vault] DOCX parsed: ${cleaned.length} chars`);
          } catch (err) {
            console.error("[vault] mammoth failed:", err);
            extractedText = `[DOCX uploaded: ${input.filename} — could not extract text: ${err instanceof Error ? err.message : "unknown error"}]`;
          }
        } else if (ext === "pptx" || ext === "ppt" || input.mimeType.includes("presentationml") || input.mimeType.includes("powerpoint")) {
          // Parse PPTX with pptx2json for slide-by-slide text extraction
          try {
            const pptxText = await parsePptxBuffer(buffer);
            const cleaned = pptxText.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            extractedText = cleaned.slice(0, 15000) || `[PPTX uploaded: ${input.filename} — no extractable text found]`;
            const slideCount = (cleaned.match(/=== Slide \d+ ===/g) ?? []).length;
            console.log(`[vault] PPTX parsed: ${slideCount} slides, ${cleaned.length} chars`);
          } catch (err) {
            console.error("[vault] pptx2json failed:", err);
            extractedText = `[PPTX uploaded: ${input.filename} — could not extract text: ${err instanceof Error ? err.message : "unknown error"}]`;
          }
        } else {
          extractedText = `[${input.filename} uploaded — file stored in vault, content available for download]`;
        }

        // Save metadata to DB
        const [result] = await db.insert(vaultDocuments).values({
          userId: ctx.user.id,
          filename: input.filename,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          extractedText,
        });

        const docId = (result as unknown as { insertId: number }).insertId;
        return { success: true, docId, url, filename: input.filename, extractedText: extractedText.slice(0, 200) };
      }),

    // List user's vault documents
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: vaultDocuments.id,
          filename: vaultDocuments.filename,
          fileUrl: vaultDocuments.fileUrl,
          mimeType: vaultDocuments.mimeType,
          extractedText: vaultDocuments.extractedText,
          createdAt: vaultDocuments.createdAt,
        })
        .from(vaultDocuments)
        .where(eq(vaultDocuments.userId, ctx.user.id))
        .orderBy(desc(vaultDocuments.createdAt))
        .limit(20);
    }),

    // Re-parse an existing vault document (re-download from S3 and re-extract text)
    reparse: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        // Verify ownership and get file info
        const [doc] = await db.select({
          userId: vaultDocuments.userId,
          fileUrl: vaultDocuments.fileUrl,
          filename: vaultDocuments.filename,
          mimeType: vaultDocuments.mimeType,
        }).from(vaultDocuments).where(eq(vaultDocuments.id, input.id)).limit(1);
        if (!doc || doc.userId !== ctx.user.id) throw new Error("Not authorised");
        // Download file from S3
        const response = await fetch(doc.fileUrl);
        if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = doc.filename.split(".").pop()?.toLowerCase() ?? "";
        // Re-extract text using the same logic as upload
        const TEXT_EXTS = new Set(["txt","md","csv","json","xml","yaml","yml","html","htm","js","ts","py","java","c","cpp","cs","go","rb","sh","sql","log","toml","ini","env","rst"]);
        const EXCEL_EXTS = new Set(["xlsx","xls","xlsm","xlsb","ods"]);
        let extractedText = "";
        const mimeType = doc.mimeType ?? "application/octet-stream";
        if (mimeType.startsWith("text/") || TEXT_EXTS.has(ext)) {
          extractedText = buffer.toString("utf-8").slice(0, 12000);
        } else if (EXCEL_EXTS.has(ext) || mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
          try {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const parts: string[] = [];
            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
              if (csv.trim()) parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
            }
            extractedText = parts.join("\n\n").slice(0, 12000);
          } catch (err) {
            throw new Error(`Excel parse failed: ${err instanceof Error ? err.message : "unknown"}`);
          }
        } else if (doc.mimeType === "application/pdf" || ext === "pdf") {
          try {
            const parser = new PDFParse({ data: buffer });
            await (parser as any).load();
            const result = await (parser as any).getText() as { pages: Array<{ text: string }> };
            const fullText = result.pages.map((p: { text: string }) => p.text).join("\n\n");
            const cleaned = fullText.replace(/\r\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            extractedText = cleaned.slice(0, 15000) || "[PDF — no extractable text found]";
          } catch (err) {
            throw new Error(`PDF parse failed: ${err instanceof Error ? err.message : "unknown"}`);
          }
        } else if (ext === "docx" || (doc.mimeType ?? "").includes("wordprocessingml")) {
          try {
            const result = await mammoth.extractRawText({ buffer });
            const cleaned = result.value.replace(/\r\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            extractedText = cleaned.slice(0, 15000) || `[DOCX — no extractable text found]`;
          } catch (err) {
            throw new Error(`DOCX parse failed: ${err instanceof Error ? err.message : "unknown"}`);
          }
        } else if (ext === "pptx" || ext === "ppt" || (doc.mimeType ?? "").includes("presentationml") || (doc.mimeType ?? "").includes("powerpoint")) {
          try {
            const pptxText = await parsePptxBuffer(buffer);
            const cleaned = pptxText.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            extractedText = cleaned.slice(0, 15000) || `[PPTX — no extractable text found]`;
          } catch (err) {
            throw new Error(`PPTX parse failed: ${err instanceof Error ? err.message : "unknown"}`);
          }
        } else if (doc.mimeType === "application/json" || ext === "json") {
          try { extractedText = JSON.stringify(JSON.parse(buffer.toString("utf-8")), null, 2).slice(0, 12000); } catch { extractedText = buffer.toString("utf-8").slice(0, 12000); }
        } else {
          extractedText = `[${doc.filename} — binary file, content not extractable as text]`;
        }
        // Update the DB record
        await db.update(vaultDocuments).set({ extractedText }).where(eq(vaultDocuments.id, input.id));
        return { success: true, extractedText: extractedText.slice(0, 200), charCount: extractedText.length };
      }),

    // Delete a vault document
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        // Verify ownership
        const [doc] = await db.select({ userId: vaultDocuments.userId })
          .from(vaultDocuments)
          .where(eq(vaultDocuments.id, input.id))
          .limit(1);
        if (!doc || doc.userId !== ctx.user.id) throw new Error("Not authorised");
        await db.delete(vaultDocuments).where(eq(vaultDocuments.id, input.id));
        return { success: true };
      }),
  }),

  // ── Agent Registry ────────────────────────────────────────────────────────
  agent: router({
    // Register a new external agent (authenticated users only)
    register: protectedProcedure
      .input(z.object({
        agentName: z.string().min(2).max(128),
        developerName: z.string().min(2).max(128),
        description: z.string().min(10),
        capabilities: z.array(z.string()).min(1),
        endpointUrl: z.string().url(),
        averageLatency: z.number().min(0).max(60000).default(500),
        pricingModel: z.enum(["free", "per_task", "subscription"]).default("free"),
        connectionTested: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Gap 8: inherit orgId from the registering user
        const [ownerUser] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, ctx.user.id)).limit(1);

        const [result] = await db.insert(agents).values({
          ownerId: ctx.user.id,
          agentName: input.agentName,
          developerName: input.developerName,
          description: input.description,
          capabilities: JSON.stringify(input.capabilities),
          endpointUrl: input.endpointUrl,
          averageLatency: input.averageLatency,
          pricingModel: input.pricingModel,
          status: "active",
          connectionTested: input.connectionTested,
          orgId: ownerUser?.orgId ?? null,
        });

        const agentId = (result as unknown as { insertId: number }).insertId;

        // Seed metrics row with neutral defaults
        await db.insert(agentMetrics).values({
          agentId,
          tasksCompleted: 0,
          successRate: "80.00",
          avgLatency: input.averageLatency,
          errorRate: "0.00",
        });

        // Gap 6: Developer onboarding notification to platform owner
        void notifyOwner({
          title: `New Agent Registered: ${input.agentName}`,
          content: `Developer: ${input.developerName} (user #${ctx.user.id})\nAgent ID: ${agentId}\nEndpoint: ${input.endpointUrl}\nCapabilities: ${input.capabilities.join(", ")}\nConnection tested: ${input.connectionTested ? "Yes ✓" : "No"}\n\nView at /registry`,
        });

        return { success: true, agentId };
      }),

    // List all active agents (public)
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        capability: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const rows = await db
          .select({
            id: agents.id,
            agentName: agents.agentName,
            developerName: agents.developerName,
            description: agents.description,
            capabilities: agents.capabilities,
            averageLatency: agents.averageLatency,
            pricingModel: agents.pricingModel,
            status: agents.status,
            connectionTested: agents.connectionTested,
            createdAt: agents.createdAt,
            tasksCompleted: agentMetrics.tasksCompleted,
            successRate: agentMetrics.successRate,
            avgLatency: agentMetrics.avgLatency,
            errorRate: agentMetrics.errorRate,
          })
          .from(agents)
          .leftJoin(agentMetrics, eq(agents.id, agentMetrics.agentId))
          .where(eq(agents.status, "active"))
          .orderBy(desc(agentMetrics.tasksCompleted))
          .limit(input?.limit ?? 20)
          .offset(input?.offset ?? 0);

        return rows;
      }),

    // Get a single agent by ID (public)
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const rows = await db
          .select({
            id: agents.id,
            ownerId: agents.ownerId,
            agentName: agents.agentName,
            developerName: agents.developerName,
            description: agents.description,
            capabilities: agents.capabilities,
            endpointUrl: agents.endpointUrl,
            averageLatency: agents.averageLatency,
            pricingModel: agents.pricingModel,
            status: agents.status,
            createdAt: agents.createdAt,
            tasksCompleted: agentMetrics.tasksCompleted,
            successRate: agentMetrics.successRate,
            avgLatency: agentMetrics.avgLatency,
            errorRate: agentMetrics.errorRate,
          })
          .from(agents)
          .leftJoin(agentMetrics, eq(agents.id, agentMetrics.agentId))
          .where(eq(agents.id, input.id))
          .limit(1);

        return rows[0] ?? null;
      }),

    // My registered agents
    myAgents: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select({
          id: agents.id,
          agentName: agents.agentName,
          developerName: agents.developerName,
          description: agents.description,
          capabilities: agents.capabilities,
          endpointUrl: agents.endpointUrl,
          averageLatency: agents.averageLatency,
          pricingModel: agents.pricingModel,
          status: agents.status,
          createdAt: agents.createdAt,
          tasksCompleted: agentMetrics.tasksCompleted,
          successRate: agentMetrics.successRate,
          avgLatency: agentMetrics.avgLatency,
          errorRate: agentMetrics.errorRate,
        })
        .from(agents)
        .leftJoin(agentMetrics, eq(agents.id, agentMetrics.agentId))
        .where(eq(agents.ownerId, ctx.user.id))
        .orderBy(desc(agents.createdAt));
    }),

    // Deactivate an agent (owner only)
    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const [existing] = await db.select({ ownerId: agents.ownerId })
          .from(agents)
          .where(eq(agents.id, input.id))
          .limit(1);

        if (!existing || existing.ownerId !== ctx.user.id) {
          throw new Error("Not authorised");
        }

        await db.update(agents)
          .set({ status: "inactive" })
          .where(eq(agents.id, input.id));

        return { success: true };
      }),

    // ── Discovery: ranked agent list for a task ────────────────────────────
    discover: publicProcedure
      .input(z.object({
        capabilities: z.array(z.string()).default([]),
        limit: z.number().min(1).max(50).default(10),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const rows = await db
          .select({
            id: agents.id,
            agentName: agents.agentName,
            developerName: agents.developerName,
            description: agents.description,
            capabilities: agents.capabilities,
            averageLatency: agents.averageLatency,
            pricingModel: agents.pricingModel,
            connectionTested: agents.connectionTested,
            tasksCompleted: agentMetrics.tasksCompleted,
            successRate: agentMetrics.successRate,
            avgLatency: agentMetrics.avgLatency,
            errorRate: agentMetrics.errorRate,
          })
          .from(agents)
          .leftJoin(agentMetrics, eq(agents.id, agentMetrics.agentId))
          .where(eq(agents.status, "active"));

        // Score and rank
        const scored = rows.map(row => {
          const agentCaps: string[] = (() => {
            try { return JSON.parse(row.capabilities); } catch { return []; }
          })();
          const matchScore = capabilityMatchScore(agentCaps, input.capabilities);
          const score = scoreAgent(
            { averageLatency: row.averageLatency },
            row.successRate ? { successRate: row.successRate, avgLatency: row.avgLatency ?? row.averageLatency } : null,
            matchScore
          );
          return { ...row, score: Math.round(score * 100) };
        });

        return scored
          .sort((a, b) => b.score - a.score)
          .slice(0, input.limit);
      }),

    // ── Endpoint connection test (public — no auth needed to test) ──────────
    testEndpoint: publicProcedure
      .input(z.object({
        endpointUrl: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        const start = Date.now();
        try {
          const res = await fetch(input.endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task: "Test task",
              context: "Connection validation from AgenThink Mesh",
            }),
            signal: AbortSignal.timeout(10000), // 10s timeout
          });
          const latencyMs = Date.now() - start;
          if (!res.ok) {
            return { ok: false, latencyMs, preview: "", error: `HTTP ${res.status} ${res.statusText}` };
          }
          const text = await res.text();
          let preview = text.slice(0, 300);
          // Try to pretty-print JSON
          try { preview = JSON.stringify(JSON.parse(text), null, 2).slice(0, 300); } catch { /* keep raw */ }
          return { ok: true, latencyMs, preview, error: undefined };
        } catch (err: unknown) {
          const latencyMs = Date.now() - start;
          const msg = err instanceof Error ? err.message : String(err);
          return { ok: false, latencyMs, preview: "", error: msg };
        }
      }),

    // ── Route a task to a registered external agent ───────────────────────
    routeTask: protectedProcedure
      .input(z.object({
        agentId: z.number(),
        task: z.string().min(1),
        context: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Fetch agent endpoint
        const [agent] = await db
          .select({ endpointUrl: agents.endpointUrl, agentName: agents.agentName, status: agents.status, webhookUrl: agents.webhookUrl })
          .from(agents)
          .where(eq(agents.id, input.agentId))
          .limit(1);

        if (!agent) throw new Error("Agent not found");
        if (agent.status !== "active") throw new Error("Agent is not active");

        const start = Date.now();
        let success = false;
        let result = "";

        try {
          const res = await fetch(agent.endpointUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task: input.task, context: input.context }),
            signal: AbortSignal.timeout(30000),
          });
          const latencyMs = Date.now() - start;

          if (!res.ok) {
            // Build a structured, human-readable error message
            const statusMessages: Record<number, string> = {
              429: "Rate limit exceeded — the external agent has received too many requests. Please try again later.",
              401: "Authentication failed — the external agent rejected the request (HTTP 401).",
              403: "Access forbidden — the external agent denied this request (HTTP 403).",
              404: "Endpoint not found — the external agent URL may have changed (HTTP 404).",
              500: "External agent server error (HTTP 500). The agent may be experiencing issues.",
              502: "External agent returned a bad gateway response (HTTP 502).",
              503: "External agent is temporarily unavailable (HTTP 503). Try again later.",
            };
            const friendlyMsg = statusMessages[res.status] ?? `External agent returned HTTP ${res.status}.`;
            throw new Error(friendlyMsg);
          }

          const data = await res.json() as { result?: string; latency_ms?: number };
          result = data.result ?? JSON.stringify(data);
          success = true;

          // Update reputation async (don't await — don't block response)
          db.update(agentMetrics).set({
            tasksCompleted: sql`${agentMetrics.tasksCompleted} + 1`,
          }).where(eq(agentMetrics.agentId, input.agentId)).catch(() => {});

          // Gap 7: Fire webhook asynchronously if configured
          if (agent.webhookUrl) {
            const webhookPayload = { agentId: input.agentId, result, success: true, latencyMs, completedAt: new Date().toISOString() };
            fetch(agent.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(webhookPayload), signal: AbortSignal.timeout(10000) }).catch(() => {});
          }

          return { success: true, result, latencyMs, agentName: agent.agentName };
        } catch (err: unknown) {
          const latencyMs = Date.now() - start;
          const msg = err instanceof Error ? err.message : String(err);

          // Gap 7: Fire webhook on failure too
          if (agent.webhookUrl) {
            const webhookPayload = { agentId: input.agentId, result: null, success: false, error: msg, latencyMs, completedAt: new Date().toISOString() };
            fetch(agent.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(webhookPayload), signal: AbortSignal.timeout(10000) }).catch(() => {});
          }

          return { success: false, result: `Error: ${msg}`, latencyMs, agentName: agent.agentName };
        }
      }),

    // ── Reputation: update metrics after task execution ────────────────────
    updateReputation: protectedProcedure
      .input(z.object({
        agentId: z.number(),
        success: z.boolean(),
        latencyMs: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };

        const [existing] = await db
          .select()
          .from(agentMetrics)
          .where(eq(agentMetrics.agentId, input.agentId))
          .limit(1);

        if (!existing) return { success: false };

        const prevTotal = existing.tasksCompleted;
        const prevSuccess = (Number(existing.successRate) / 100) * prevTotal;
        const newTotal = prevTotal + 1;
        const newSuccessCount = prevSuccess + (input.success ? 1 : 0);
        const newSuccessRate = ((newSuccessCount / newTotal) * 100).toFixed(2);
        const newAvgLatency = Math.round(
          (existing.avgLatency * prevTotal + input.latencyMs) / newTotal
        );
        const prevErrors = (Number(existing.errorRate) / 100) * prevTotal;
        const newErrors = prevErrors + (input.success ? 0 : 1);
        const newErrorRate = ((newErrors / newTotal) * 100).toFixed(2);

        await db.update(agentMetrics)
          .set({
            tasksCompleted: newTotal,
            successRate: newSuccessRate,
            avgLatency: newAvgLatency,
            errorRate: newErrorRate,
          })
          .where(eq(agentMetrics.agentId, input.agentId));

        return { success: true };
      }),
  }),

  // ── Arabic Annotation Pipeline ────────────────────────────────────────────
  annotation: router({

    // Submit text to an Arabic annotation agent and store structured result
    submit: protectedProcedure
      .input(z.object({
        agentId: z.number(),
        inputText: z.string().min(1).max(10000),
        context: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Fetch agent
        const [agent] = await db
          .select({ endpointUrl: agents.endpointUrl, agentName: agents.agentName, status: agents.status })
          .from(agents)
          .where(eq(agents.id, input.agentId))
          .limit(1);

        if (!agent) throw new Error("Agent not found");
        if (agent.status !== "active") throw new Error("Agent is not active");

        const start = Date.now();
        const res = await fetch(agent.endpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: input.inputText, context: input.context ?? "" }),
          signal: AbortSignal.timeout(30000),
        });

        const latencyMs = Date.now() - start;
        if (!res.ok) throw new Error(`Agent returned HTTP ${res.status}`);

        const data = await res.json() as {
          label?: string;
          confidence?: number;
          dialect?: string;
          rationale?: string;
          requires_review?: boolean;
          result?: unknown;
        };

        const label = data.label ?? "annotated";
        const confidence = data.confidence ?? 0.9;
        const requiresReview = data.requires_review ?? confidence < 0.75;

        const [inserted] = await db.insert(annotations).values({
          userId: ctx.user.id,
          agentId: input.agentId,
          agentName: agent.agentName,
          inputText: input.inputText,
          context: input.context,
          label,
          confidence: String(confidence),
          dialect: data.dialect ?? null,
          rationale: data.rationale ?? null,
          structuredResult: JSON.stringify(data.result ?? data),
          requiresReview,
          reviewStatus: requiresReview ? "pending" : "approved",
          latencyMs,
        });

        // Update agent metrics
        db.update(agentMetrics)
          .set({ tasksCompleted: sql`${agentMetrics.tasksCompleted} + 1` })
          .where(eq(agentMetrics.agentId, input.agentId))
          .catch(() => {});

        return {
          id: (inserted as { insertId?: number })?.insertId ?? 0,
          label,
          confidence,
          dialect: data.dialect ?? null,
          rationale: data.rationale ?? null,
          requiresReview,
          structuredResult: data.result ?? data,
          latencyMs,
          agentName: agent.agentName,
        };
      }),

    // List annotations for the current user
    list: protectedProcedure
      .input(z.object({
        agentName: z.string().optional(),
        reviewStatus: z.enum(["pending", "approved", "rejected", "all"]).default("all"),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        const conditions = [eq(annotations.userId, ctx.user.id)];
        if (input?.reviewStatus && input.reviewStatus !== "all") {
          conditions.push(eq(annotations.reviewStatus, input.reviewStatus as "pending" | "approved" | "rejected"));
        }
        if (input?.agentName) {
          conditions.push(like(annotations.agentName, `%${input.agentName}%`));
        }

        return db
          .select()
          .from(annotations)
          .where(and(...conditions))
          .orderBy(desc(annotations.createdAt))
          .limit(input?.limit ?? 50)
          .offset(input?.offset ?? 0);
      }),

    // Review an annotation (approve or reject)
    review: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const [existing] = await db
          .select({ userId: annotations.userId })
          .from(annotations)
          .where(eq(annotations.id, input.id))
          .limit(1);

        if (!existing || existing.userId !== ctx.user.id) {
          throw new Error("Not authorised");
        }

        await db.update(annotations)
          .set({
            reviewStatus: input.status,
            reviewedBy: ctx.user.id,
            reviewNote: input.note ?? null,
          })
          .where(eq(annotations.id, input.id));

        return { success: true };
      }),

    // Export annotations as JSONL or CSV, upload to S3, return download URL
    export: protectedProcedure
      .input(z.object({
        format: z.enum(["jsonl", "csv", "openai"]).default("jsonl"),
        agentName: z.string().optional(),
        statusFilter: z.enum(["approved", "all"]).default("approved"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const conditions = [eq(annotations.userId, ctx.user.id)];
        if (input.statusFilter === "approved") {
          conditions.push(eq(annotations.reviewStatus, "approved"));
        }
        if (input.agentName) {
          conditions.push(like(annotations.agentName, `%${input.agentName}%`));
        }

        const rows = await db
          .select()
          .from(annotations)
          .where(and(...conditions))
          .orderBy(desc(annotations.createdAt));

        if (rows.length === 0) {
          throw new Error("No annotations found matching the filter criteria");
        }

        let fileContent = "";
        let mimeType = "application/x-ndjson";

        if (input.format === "jsonl") {
          fileContent = rows.map(r => JSON.stringify({
            id: r.id,
            input_text: r.inputText,
            context: r.context,
            label: r.label,
            confidence: Number(r.confidence),
            dialect: r.dialect,
            rationale: r.rationale,
            agent: r.agentName,
            review_status: r.reviewStatus,
            structured_result: (() => { try { return JSON.parse(r.structuredResult); } catch { return r.structuredResult; } })(),
            created_at: r.createdAt,
          })).join("\n");
        } else if (input.format === "openai") {
          // OpenAI fine-tuning JSONL format
          fileContent = rows.map(r => JSON.stringify({
            messages: [
              { role: "system", content: "You are an expert Arabic NLP annotator." },
              { role: "user", content: r.context ? `Context: ${r.context}\n\nText: ${r.inputText}` : r.inputText },
              { role: "assistant", content: JSON.stringify({
                label: r.label,
                confidence: Number(r.confidence),
                dialect: r.dialect,
                rationale: r.rationale,
              }) },
            ],
          })).join("\n");
        } else {
          // CSV
          mimeType = "text/csv";
          const header = "id,input_text,label,confidence,dialect,agent,review_status,created_at";
          const csvRows = rows.map(r => [
            r.id,
            `"${(r.inputText ?? "").replace(/"/g, '""')}"`,
            `"${r.label}"`,
            Number(r.confidence),
            `"${r.dialect ?? ""}"`,
            `"${r.agentName}"`,
            r.reviewStatus,
            r.createdAt.toISOString(),
          ].join(","));
          fileContent = [header, ...csvRows].join("\n");
        }

        const ext = input.format === "csv" ? "csv" : "jsonl";
        const fileKey = `annotations/${ctx.user.id}/${Date.now()}-export.${ext}`;
        const { url } = await storagePut(fileKey, Buffer.from(fileContent, "utf-8"), mimeType);

        // Log the export
        await db.insert(annotationExports).values({
          userId: ctx.user.id,
          format: input.format,
          recordCount: rows.length,
          agentFilter: input.agentName ?? null,
          statusFilter: input.statusFilter,
          fileKey,
          fileUrl: url,
        });

        return { url, recordCount: rows.length, format: input.format };
      }),

    // List previous exports
    listExports: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(annotationExports)
        .where(eq(annotationExports.userId, ctx.user.id))
        .orderBy(desc(annotationExports.createdAt))
        .limit(20);
    }),
  }),
  // ── Contact Form ──────────────────────────────────────────────────────────
  contact: router({
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name is required").max(128),
          email: z.string().email("Invalid email address").max(320),
          company: z.string().max(128).optional(),
          message: z.string().min(10, "Message must be at least 10 characters").max(5000),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Save to database
        const [row] = await db.insert(contactSubmissions).values({
          name: input.name,
          email: input.email,
          company: input.company ?? null,
          message: input.message,
          notified: false,
        }).$returningId();

        // Send Manus owner notification
        const notificationContent = [
          `New contact form submission from ${input.name}`,
          ``,
          `Name: ${input.name}`,
          `Email: ${input.email}`,
          `Company: ${input.company ?? "Not provided"}`,
          ``,
          `Message:`,
          input.message,
          ``,
          `Submitted at: ${new Date().toUTCString()}`,
        ].join("\n");

        // Use activated farouq@agenthink.ai FormSubmit account, CC kishore@agenthink.ai
        const formSubmitPayload = {
          name: input.name,
          email: input.email,
          company: input.company ?? "Not provided",
          message: input.message,
          _subject: `New Contact from AgenThinkMesh: ${input.name}`,
          _cc: "kishore@agenthink.ai",
          _replyto: input.email,
          _template: "table",
          _captcha: "false",
        };
        const emailRes = await fetch("https://formsubmit.co/ajax/farouq@agenthink.ai", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(formSubmitPayload),
        }).catch(() => null);
        const emailSent = emailRes?.ok ?? false;
        // Also send Manus owner notification as backup
        const notified = await notifyOwner({
          title: `📬 New Contact: ${input.name} (${input.email})`,
          content: notificationContent,
        }).catch(() => false);
        // Update notified flag
        if ((notified || emailSent) && row?.id) {
          await db
            .update(contactSubmissions)
            .set({ notified: true })
            .where(eq(contactSubmissions.id, row.id));
        }
         return { success: true, id: row?.id };
      }),
  }),

});
export type AppRouter = typeof appRouter;
