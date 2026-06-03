import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { taskHistory, agents, agentMetrics, vaultDocuments, annotations, annotationExports, users, contactSubmissions, meshTasks, portfolioReviews, turnaroundSessions, roles, partnerInstitutions, partnershipRequests, llmUsage, highDemandLog, loginEvents, dealSignals, waitlistSignups, founderAgentEvaluations, founderAgentRuns } from "../drizzle/schema";
import { recordLlmUsage } from "./llmRateLimit";
import { turnaroundRouter } from "./routers/turnaround";
import { identityRouter } from "./routers/identity";
import { workflowRouter } from "./routers/workflow";
import { dossierPdfRouter } from "./routers/dossierPdf";
import { billingRouter } from "./routers/billing";
import { portfolioRouter } from "./routers/portfolio";
import { insuranceRouter } from "./routers/insurance";
import { admeshRouter } from "./routers/admesh";
import { openclawRouter } from "./routers/openclaw";
import { socialMediaRouter } from "./routers/socialMedia";
import { dealScreenerRouter } from "./routers/dealScreener";
import { outcomeLedgerRouter } from "./routers/outcomeLedger";
import { proofEngineRouter } from "./routers/proofEngine";
import { dealSourcingRouter } from "./routers/dealSourcing";
import { procurementRouter } from "./routers/procurement";
import { intelligenceRouter } from "./routers/intelligence";
import { mvnoRouter } from "./routers/mvno";
import { forecastRouter } from "./routers/forecast";
import { knowledgeVaultRouter } from "./routers/knowledgeVault";
import { selfLearningRouter } from "./routers/selfLearning";
import { pitchRouter } from "./routers/pitch";
import { cmkRouter } from "./routers/cmk";
import { uaeRealestateRouter } from "./routers/uaeRealestate";
import { sadoRouter } from "./routers/sado";
import { demoRouter } from "./routers/demo";
import { fleetRouter } from "./routers/founderFleet";
import { treasuryRouter } from "./routers/treasury";
import { shareReportRouter } from "./routers/shareReport";
import { contactsRouter } from "./routers/contacts";
import { trackerRouter } from "./routers/tracker";
import { portfolioMeshRouter } from "./routers/portfolioMesh";
import { adminProvisionRouter } from "./routers/adminProvision";
import { adminEvalStatsRouter } from "./routers/adminEvalStats";
import { adminBackfillRouter } from "./routers/adminBackfill";
import { governanceSnapshotRouter } from "./routers/governanceSnapshot";
import { voiceDemoRouter } from "./routers/voiceDemo";
import { decisionUpgradeRouter } from "./routers/decisionUpgrade";
import { councilRouter } from "./routers/council";
import { infraSimRouter } from "./routers/infraSim";
import { scenarioSimRouter } from "./routers/scenarioSim";
import { storagePut } from "./storage";
import { extractFileContent } from "./fileExtract";
import { eq, desc, asc, gte, lte, sql, and, like, or, isNull, lt, count } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { getRAGContext, injectRAGContext } from "./ragContext";
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
  cmk: cmkRouter,
  demo: demoRouter,
  fleet: fleetRouter,
  system: systemRouter,
  adminProvision: adminProvisionRouter,
  adminEvalStats: adminEvalStatsRouter,
  adminBackfill: adminBackfillRouter,
  governanceSnapshot: governanceSnapshotRouter,
  voiceDemo: voiceDemoRouter,
  decisionUpgrade: decisionUpgradeRouter,
  council: councilRouter,
  infraSim: infraSimRouter,
  scenarioSim: scenarioSimRouter,

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
      if (!db) return { tasksRun: 2405, verifiedAgents: 115, domainContexts: 14, avgExecSec: 47 };

      const [taskCount, agentCount, avgExec, domainCount] = await Promise.all([
        // Total tasks ever run
        db.select({ count: sql<number>`count(*)` }).from(taskHistory),
        // Active agents only (status = 'active') — matches the Domains page count
        db.select({ count: sql<number>`count(*)` }).from(agents).where(eq(agents.status, "active")),
        // Average execution time in ms across all tasks
        db.select({ avg: sql<number>`avg(${taskHistory.executionTime})` }).from(taskHistory),
        // Distinct domain values across all agents
        db.selectDistinct({ domain: agents.domain }).from(agents).where(sql`${agents.domain} is not null`),
      ]);

      const rawTasks = Number(taskCount[0]?.count ?? 0);
      const rawAgents = Number(agentCount[0]?.count ?? 0);
      const rawAvgMs = Number(avgExec[0]?.avg ?? 0);
      const rawDomains = domainCount.length;

      return {
        // Show at least the seeded baseline so the page never looks empty
        tasksRun: Math.max(rawTasks, 2405),
        verifiedAgents: Math.max(rawAgents, 115),
        domainContexts: Math.max(rawDomains, 14),
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
        // Billing Gateway — trial/plan access check
        const { assertWorkflowAccess } = await import("./billing");
        await assertWorkflowAccess(ctx.user.id);

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

        // ── RAG: Retrieve top-3 relevant GCC scenarios from Knowledge Vault ─────────
        const { ragContext: meshRagContext } = await getRAGContext(
          `${input.agentLabel} ${input.taskText.slice(0, 200)}`,
          3
        );

        // ── Step 1: Intent Classifier (fast pre-pass, ~200 tokens) ────────────
        // Detects what the user actually wants: analysis, draft, code, decision, compliance, qa
        type IntentType = "analysis" | "draft_document" | "generate_code" | "decision" | "compliance_check" | "qa_test" | "financial_model";

        let detectedIntent: IntentType = "analysis";
        let documentType = ""; // e.g. "email", "proposal", "NDA", "letter"
        let codeLanguage = ""; // e.g. "Python", "JavaScript"

        try {
          const intentRes = await invokeLLM({
            messages: [
              {
                role: "system",
                content: [
                  `You are an intent classifier for an institutional AI platform. Classify the user's request into exactly one intent type.`,
                  `Intent types:`,
                  `- analysis: research, analyse, review, assess, evaluate, compare, summarise, explain, what is, why did`,
                  `- draft_document: draft, write, compose, create a letter/email/proposal/NDA/contract/memo/report/cover letter/press release`,
                  `- generate_code: code, script, function, API, SQL, Python, JavaScript, automate, build a tool`,
                  `- decision: should I, buy or sell, approve or reject, go/no-go, recommend action, what should we do`,
                  `- compliance_check: compliant, regulatory, filing, deadline, ADGM, CMA, CBK, DFSA, KYC, AML, audit`,
                  `- qa_test: test, QA, validate, verify, check if working, find bugs, test cases`,
                  `- financial_model: DCF, valuation, WACC, terminal value, balance sheet, cash flow statement, income statement, derive financials, sense check financials, financial projections, NPV, IRR, enterprise value, equity value, EBITDA multiple`,
                  ``,
                  `Also extract:`,
                  `- documentType: if draft_document, the type of document (email, proposal, NDA, letter, memo, report, contract, press release). Empty string otherwise.`,
                  `- codeLanguage: if generate_code, the programming language requested. Default to "Python" if not specified. Empty string otherwise.`,
                  ``,
                  `Return ONLY valid JSON: { "intent": "<type>", "documentType": "<type>", "codeLanguage": "<lang>" }`,
                ].join("\n"),
              },
              { role: "user", content: input.taskText },
            ],
            max_tokens: 100,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "intent_classification",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    intent: { type: "string", enum: ["analysis", "draft_document", "generate_code", "decision", "compliance_check", "qa_test", "financial_model"] },
                    documentType: { type: "string" },
                    codeLanguage: { type: "string" },
                  },
                  required: ["intent", "documentType", "codeLanguage"],
                  additionalProperties: false,
                },
              },
            },
          });
          const intentContent = intentRes.choices[0]?.message?.content;
          const intentParsed = JSON.parse(typeof intentContent === "string" ? intentContent : JSON.stringify(intentContent));
          detectedIntent = intentParsed.intent as IntentType;
          documentType = intentParsed.documentType ?? "";
          codeLanguage = intentParsed.codeLanguage ?? "";
          console.log(`[runAgentTask] intent=${detectedIntent} docType=${documentType} codeLang=${codeLanguage}`);
        } catch (e) {
          console.warn("[runAgentTask] Intent classification failed, defaulting to analysis", e);
          detectedIntent = "analysis";
        }

         // ── Step 2: Build system prompt based on detected intent ──────────
        const agentContextBase = [
          input.systemPromptBase,
          `You are the ${input.agentLabel} operating on an institutional AI platform serving GCC fund managers, legal professionals, healthcare administrators, and enterprise executives.`,
          resolvedVaultText ? `\n=== DOCUMENT CONTEXT ===\n${resolvedVaultText.slice(0, 8000)}\n=== END DOCUMENT CONTEXT ===` : "",
        ].filter(Boolean).join("\n");
        // Inject RAG context (GCC institutional scenarios) at the top of the system prompt
        const agentContext = injectRAGContext(agentContextBase, meshRagContext);

        let systemPrompt: string;

        if (detectedIntent === "draft_document") {
          const docLabel = documentType || "document";
          systemPrompt = [
            agentContext,
            ``,
            `The user wants you to DRAFT a ${docLabel}. Do NOT produce an analysis report. Produce the actual ${docLabel}, ready to use.`,
            ``,
            `CRITICAL FORMATTING RULES — YOU MUST FOLLOW THESE EXACTLY:`,
            `1. Use a BLANK LINE between every paragraph, section, salutation, and closing.`,
            `2. For emails: Subject line on its own line, blank line, salutation on its own line, blank line, then body paragraphs each separated by a blank line, blank line before closing, closing on its own line, blank line, name/title/company each on separate lines.`,
            `3. NEVER run paragraphs together. Each paragraph is its own block separated by blank lines.`,
            `4. Use \\n\\n (double newline) between every section.`,
            ``,
            `Output format:`,
            `DOCUMENT TYPE: [State the type of document, e.g. "Supplier Collaboration Email"]`,
            ``,
            `DRAFT:`,
            `Subject: [Subject line]`,
            ``,
            `Dear [Recipient Name],`,
            ``,
            `[Opening paragraph — purpose of the email]`,
            ``,
            `[Body paragraph 1 — context and relationship]`,
            ``,
            `[Body paragraph 2 — specific collaboration areas or proposal]`,
            ``,
            `[Closing paragraph — call to action and next steps]`,
            ``,
            `Warm regards,`,
            ``,
            `[Your Name]`,
            `[Your Title]`,
            `[Your Company]`,
            `[Your Contact Information]`,
            ``,
            `KEY POINTS COVERED:`,
            `• [Point 1]`,
            `• [Point 2]`,
            `• [Point 3]`,
            ``,
            `CUSTOMISATION NOTES:`,
            `• [Field 1 to personalise]`,
            `• [Field 2 to personalise]`,
          ].filter(Boolean).join("\n");

        } else if (detectedIntent === "generate_code") {
          const lang = codeLanguage || "Python";
          systemPrompt = [
            agentContext,
            ``,
            `The user wants you to GENERATE CODE in ${lang}. Do NOT produce an analysis report. Produce working, production-ready code.`,
            ``,
            `Output format:`,
            `WHAT THIS CODE DOES: One clear sentence describing the purpose.`,
            ``,
            `CODE:`,
            `\`\`\`${lang.toLowerCase()}`,
            `[Write the complete, runnable ${lang} code here. Include imports, error handling, and comments. No placeholders — write real, working code.]`,
            `\`\`\``,
            ``,
            `HOW TO RUN: Step-by-step instructions to execute this code (dependencies, environment variables, commands).`,
            ``,
            `CUSTOMISATION: 2-3 variables or parameters the user should adjust for their specific use case.`,
          ].filter(Boolean).join("\n");

        } else if (detectedIntent === "decision") {
          systemPrompt = [
            agentContext,
            ``,
            `The user needs a DECISION RECOMMENDATION. Give a clear, direct verdict with institutional-grade reasoning. No hedging.`,
            ``,
            `Output format:`,
            `VERDICT: State the recommended action clearly (e.g. PROCEED / DO NOT PROCEED / BUY / SELL / HOLD / APPROVE / REJECT). One sentence maximum.`,
            ``,
            `RATIONALE: 2-3 paragraphs explaining the strategic reasoning behind this verdict. Be specific — reference the actual situation described.`,
            ``,
            `KEY RISKS: 3-5 risks that could invalidate this recommendation. For each, state the risk and its likelihood.`,
            ``,
            `CONDITIONS: What would change this verdict? List 2-3 specific triggers that would flip the recommendation.`,
            ``,
            `NEXT ACTION: The single most important thing to do in the next 48 hours.`,
          ].filter(Boolean).join("\n");

        } else if (detectedIntent === "compliance_check") {
          systemPrompt = [
            agentContext,
            ``,
            `The user needs a COMPLIANCE ASSESSMENT. Provide a structured regulatory status check with specific action items.`,
            ``,
            `Output format:`,
            `COMPLIANCE STATUS: COMPLIANT / PARTIALLY COMPLIANT / NON-COMPLIANT — one sentence summary.`,
            ``,
            `REGULATORY FRAMEWORK: Which regulations, authorities, or frameworks apply (e.g. CMA, ADGM, CBK, DFSA, MOH). List them with brief descriptions.`,
            ``,
            `GAPS IDENTIFIED: Specific compliance gaps found. For each gap, state: what is missing, which regulation requires it, and the consequence of non-compliance.`,
            ``,
            `REQUIRED ACTIONS: Numbered list of actions to achieve full compliance. Each action must include: what to do, who is responsible, and the deadline or urgency.`,
            ``,
            `FILING DEADLINES: Any upcoming regulatory deadlines relevant to this situation.`,
          ].filter(Boolean).join("\n");

        } else if (detectedIntent === "qa_test") {
          systemPrompt = [
            agentContext,
            ``,
            `The user needs QA TESTING SUPPORT. Produce a structured test plan and results.`,
            ``,
            `Output format:`,
            `TEST SCOPE: What is being tested and why.`,
            ``,
            `TEST CASES: Numbered list of test cases. For each: Test ID, Description, Input, Expected Output, Pass/Fail criteria.`,
            ``,
            `CRITICAL PATHS: The 3 most important user flows or functions that must work correctly.`,
            ``,
            `EDGE CASES: 5 edge cases that are likely to reveal bugs (empty inputs, boundary values, concurrent requests, etc.).`,
            ``,
            `RECOMMENDED FIXES: If issues are identified, list them by priority (Critical / High / Medium) with suggested fixes.`,
          ].filter(Boolean).join("\n");

        } else if (detectedIntent === "financial_model") {
          systemPrompt = [
            agentContext,
            ``,
            `The user needs a FINANCIAL MODEL. You are a senior financial analyst. Produce a complete, structured financial analysis with all requested components. Use the uploaded financial data as the basis for all calculations.`,
            ``,
            `CRITICAL FORMATTING RULES:`,
            `1. Use a BLANK LINE between every section.`,
            `2. Present tables using plain text with | separators and aligned columns.`,
            `3. All monetary values in USD millions (e.g. $6.26M). All percentages to 1 decimal place.`,
            `4. NEVER skip a requested section. If data is insufficient, state assumptions clearly.`,
            ``,
            `Output format (produce ALL sections):`,
            ``,
            `SENSE CHECK:`,
            `Assess whether the financial projections are realistic. Flag any anomalies, inconsistencies, or aggressive assumptions. For each issue found, state: what it is, why it is a concern, and what a reasonable range would be.`,
            ``,
            `DERIVED BALANCE SHEET (USD millions):`,
            `Present a simplified Balance Sheet for each year in the projection period using this format:`,
            `| Item                    | 2026 | 2027 | 2028 | 2029 | 2030 |`,
            `|-------------------------|------|------|------|------|------|`,
            `| Total Assets            |      |      |      |      |      |`,
            `| Total Liabilities       |      |      |      |      |      |`,
            `| Total Equity            |      |      |      |      |      |`,
            `Derive from the P&L projections. State key assumptions (e.g. capex, depreciation, working capital days).`,
            ``,
            `STATEMENT OF CASH FLOWS (USD millions):`,
            `| Item                              | 2026 | 2027 | 2028 | 2029 | 2030 |`,
            `|-----------------------------------|------|------|------|------|------|`,
            `| Operating Cash Flow               |      |      |      |      |      |`,
            `| Investing Cash Flow               |      |      |      |      |      |`,
            `| Financing Cash Flow               |      |      |      |      |      |`,
            `| Net Change in Cash                |      |      |      |      |      |`,
            ``,
            `DCF VALUATION:`,
            `State WACC assumption and rationale (risk-free rate, equity risk premium, beta, cost of debt).`,
            ``,
            `| Year | Free Cash Flow (FCFe) | Discount Factor | PV of FCF |`,
            `|------|-----------------------|-----------------|-----------|`,
            `| 2026 |                       |                 |           |`,
            `| 2027 |                       |                 |           |`,
            `| 2028 |                       |                 |           |`,
            `| 2029 |                       |                 |           |`,
            `| 2030 |                       |                 |           |`,
            ``,
            `Terminal Value: State terminal growth rate assumption and terminal value calculation.`,
            `Enterprise Value: Sum of PV of FCFs + PV of Terminal Value.`,
            `Equity Value: Enterprise Value minus Net Debt.`,
            ``,
            `VALUATION SUMMARY:`,
            `| Metric                  | Value      |`,
            `|-------------------------|------------|`,
            `| WACC                    |            |`,
            `| Terminal Growth Rate    |            |`,
            `| Enterprise Value        |            |`,
            `| Net Debt                |            |`,
            `| Equity Value            |            |`,
            `| Implied Revenue Multiple|            |`,
            `| Implied EBITDA Multiple |            |`,
            ``,
            `KEY ASSUMPTIONS & RISKS:`,
            `List the 3-5 most critical assumptions that drive the valuation, and what happens to equity value if each assumption changes by +/- 10%.`,
            ``,
            `NEXT STEPS:`,
            `2-3 specific actions the management team should take based on this analysis.`,
          ].filter(Boolean).join("\n");

        } else {
          // ── Agent-label-specific analysis prompts ──────────────────────────────
          const agentLabelNorm = input.agentLabel.toLowerCase();

          if (agentLabelNorm.includes("dcf modeler") || agentLabelNorm.includes("dcf-modeler")) {
            // ── DCF Modeler ────────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the DCF Modeler — a specialist in discounted cash flow valuation for GCC institutional clients.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections, in this order:`,
              ``,
              `ASSUMPTIONS:`,
              `| Parameter | Value | Rationale |`,
              `|-----------|-------|-----------|`,
              `| Revenue Growth (Yr 1-3) | X% | [justify] |`,
              `| Revenue Growth (Yr 4-5) | X% | [justify] |`,
              `| EBITDA Margin | X% | [justify] |`,
              `| WACC | X% | Risk-free rate X% + ERP X% × Beta X + Debt cost X% |`,
              `| Terminal Growth Rate | X% | [justify] |`,
              ``,
              `DCF MODEL:`,
              `| Year | Revenue (KWD/SAR/AED m) | EBITDA | FCF | Discount Factor | PV of FCF |`,
              `|------|------------------------|--------|-----|-----------------|-----------|`,
              `| 2026 | | | | | |`,
              `| 2027 | | | | | |`,
              `| 2028 | | | | | |`,
              `| 2029 | | | | | |`,
              `| 2030 | | | | | |`,
              ``,
              `VALUATION SUMMARY:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Sum of PV(FCFs) | |`,
              `| Terminal Value (Gordon Growth) | |`,
              `| PV of Terminal Value | |`,
              `| Enterprise Value | |`,
              `| Net Debt | |`,
              `| Equity Value | |`,
              `| Implied EV/EBITDA | x |`,
              `| Implied P/E | x |`,
              ``,
              `SENSITIVITY ANALYSIS (3×3 grid — WACC ±1%, TGR ±0.5%):`,
              `| | WACC -1% | WACC Base | WACC +1% |`,
              `|---|---------|-----------|---------|`,
              `| TGR +0.5% | | | |`,
              `| TGR Base | | | |`,
              `| TGR -0.5% | | | |`,
              ``,
              `GCC BENCHMARKS: Compare implied multiples to GCC sector peers. State if the valuation is at a premium or discount and why.`,
              ``,
              `KEY RISKS: 3-5 risks that could materially change the valuation. For each: the risk, directional impact, and magnitude.`,
              ``,
              `MISSING DATA: If any required inputs are absent, list them explicitly as "Not Found: [field name]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("risk attributor") || agentLabelNorm.includes("risk-attributor")) {
            // ── Risk Attributor ────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Risk Attributor — a specialist in portfolio risk decomposition for GCC institutional portfolios.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `PORTFOLIO RISK OVERVIEW:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Total Portfolio Volatility (annualised) | X% |`,
              `| Portfolio Beta (vs benchmark) | X.XX |`,
              `| Sharpe Ratio | X.XX |`,
              `| Max Drawdown (12m) | X% |`,
              `| Value at Risk (95%, 1-day) | X% |`,
              ``,
              `RISK ATTRIBUTION BY POSITION:`,
              `| Position | Weight | Contribution to Portfolio Vol | Marginal Risk | Factor Exposure |`,
              `|----------|--------|-------------------------------|---------------|-----------------|`,
              `[Fill for each holding provided]`,
              ``,
              `FACTOR DECOMPOSITION:`,
              `| Risk Factor | Contribution (%) | Direction |`,
              `|-------------|-----------------|-----------|`,
              `| Market (Beta) | | |`,
              `| Sector Concentration | | |`,
              `| Currency (USD/GCC peg) | | |`,
              `| Oil Price Sensitivity | | |`,
              `| Liquidity Risk | | |`,
              `| Geopolitical (GCC) | | |`,
              ``,
              `CORRELATION MATRIX: Provide pairwise correlations for the top 5 holdings. Format as a matrix table.`,
              ``,
              `TOP RISK CONCENTRATIONS: The 3 positions or factors contributing most to total portfolio risk. For each: contribution %, and recommended mitigation.`,
              ``,
              `MISSING DATA: If any holdings, weights, or prices are absent, list them as "Not Found: [field name]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("sector analyst") || agentLabelNorm.includes("sector-analyst")) {
            // ── Sector Analyst ─────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Sector Analyst — a specialist in GCC sector deep-dives for institutional investors.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `SECTOR SNAPSHOT:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Sector | |`,
              `| GCC Market Size (USD bn) | |`,
              `| 5-Year CAGR | X% |`,
              `| YTD Performance vs MSCI GCC | X% |`,
              `| Avg Sector P/E | x |`,
              `| Avg Sector EV/EBITDA | x |`,
              `| Dividend Yield | X% |`,
              ``,
              `COMPETITIVE LANDSCAPE:`,
              `| Company | Country | Market Cap | Revenue | EBITDA Margin | Market Share | Rating |`,
              `|---------|---------|------------|---------|---------------|--------------|--------|`,
              `[List top 5-7 GCC players]`,
              ``,
              `GROWTH DRIVERS: 3-5 specific catalysts. For each: the driver, magnitude of impact, and timeline.`,
              ``,
              `HEADWINDS: 3-5 risks or structural challenges. For each: the risk, probability, and potential impact on sector earnings.`,
              ``,
              `INVESTMENT THESIS: A 3-paragraph institutional-grade view — current positioning, 12-month outlook, and the single most important variable to monitor.`,
              ``,
              `TOP PICKS: 2-3 specific GCC-listed companies. For each: ticker, investment case (2 sentences), and key risk.`,
              ``,
              `MISSING DATA: If any required data is unavailable, list it as "Not Found: [field name]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("equity screener") || agentLabelNorm.includes("equity-screener")) {
            // ── Equity Screener ────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Equity Screener — a specialist in GCC equity screening by valuation, quality, and momentum factors.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `SCREENING CRITERIA APPLIED:`,
              `| Factor | Threshold | Rationale |`,
              `|--------|-----------|-----------|`,
              `[List each filter used]`,
              ``,
              `SCREENED RESULTS:`,
              `| Ticker | Company | Exchange | P/E | EV/EBITDA | P/B | Div Yield | Revenue Growth | EBITDA Margin | Debt/EBITDA | Shariah? | Score |`,
              `|--------|---------|----------|-----|-----------|-----|-----------|----------------|---------------|-------------|----------|-------|`,
              `[All companies passing the screen, ranked by composite score]`,
              ``,
              `TOP 3 CONVICTION PICKS: For each: investment case (3-4 sentences), key catalyst, key risk, and target price with methodology.`,
              ``,
              `EXCLUDED NAMES: Companies that nearly passed but were excluded, and why.`,
              ``,
              `MISSING DATA: If any required financial data is unavailable, list it as "Not Found: [company / field]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("arabic earnings") || agentLabelNorm.includes("arabic-earnings")) {
            // ── Arabic Earnings Extractor ──────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Arabic Earnings Extractor — a specialist in extracting structured financial KPIs from Arabic-language earnings reports.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `EXTRACTED KPIs:`,
              `| KPI | Arabic Term | Value | Unit | Period | YoY Change |`,
              `|-----|-------------|-------|------|--------|------------|`,
              `| Revenue | الإيرادات | | | | |`,
              `| Gross Profit | إجمالي الربح | | | | |`,
              `| EBITDA | أرباح قبل الفوائد والضرائب والإهلاك | | | | |`,
              `| Net Income | صافي الربح | | | | |`,
              `| EPS | ربحية السهم | | | | |`,
              `| Total Assets | إجمالي الأصول | | | | |`,
              `| Total Equity | إجمالي حقوق الملكية | | | | |`,
              `| Debt | الديون | | | | |`,
              `| Operating Cash Flow | التدفق النقدي التشغيلي | | | | |`,
              ``,
              `MANAGEMENT COMMENTARY HIGHLIGHTS: 3-5 most significant statements. Quote verbatim in Arabic, then provide English translation.`,
              ``,
              `GUIDANCE: Any forward-looking statements. State the exact Arabic text and English translation.`,
              ``,
              `RED FLAGS: Any discrepancies, unusual items, or language that warrants further investigation.`,
              ``,
              `MISSING DATA: If any KPI is not found, list it as "Not Found: [KPI name]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("fraud detector") || agentLabelNorm.includes("fraud-detector")) {
            // ── Fraud Detector ─────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Fraud Detector — a specialist in identifying suspicious transaction patterns for GCC financial institutions.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `FRAUD RISK SCORE:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Overall Fraud Risk Score | X/100 |`,
              `| Risk Level | LOW / MEDIUM / HIGH / CRITICAL |`,
              `| Confidence | X% |`,
              `| Recommended Action | PASS / REVIEW / BLOCK / ESCALATE |`,
              ``,
              `SUSPICIOUS PATTERNS DETECTED:`,
              `| Pattern | Severity | Evidence | Fraud Type | Regulatory Flag |`,
              `|---------|----------|----------|------------|-----------------|`,
              `[List each pattern found]`,
              ``,
              `TRANSACTION ANALYSIS: For each flagged transaction or entity: the anomaly, baseline expectation, deviation magnitude, and fraud typology (AML, identity fraud, account takeover, insider fraud, etc.).`,
              ``,
              `REGULATORY TRIGGERS: Patterns that trigger mandatory reporting under CBK, CBUAE, SAMA, or FATF. For each: the specific regulation and reporting deadline.`,
              ``,
              `RECOMMENDED ACTIONS: Numbered list. For each: what to do, who is responsible, and urgency (immediate / 24h / 72h).`,
              ``,
              `MISSING DATA: If any required transaction fields are absent, list them as "Not Found: [field name]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("compliance checker") || agentLabelNorm.includes("compliance-checker") || agentLabelNorm.includes("kuwait cma") || agentLabelNorm.includes("cma compliance")) {
            // ── Compliance Checker ─────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Compliance Checker — a specialist in GCC regulatory compliance (CBK, CMA Kuwait, ADGM, DFSA, CBUAE, SAMA).`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `COMPLIANCE STATUS:`,
              `| Dimension | Status | Severity |`,
              `|-----------|--------|----------|`,
              `| KYC / CDD | COMPLIANT / GAP / MISSING | LOW/MED/HIGH/CRITICAL |`,
              `| AML Controls | | |`,
              `| Reporting Obligations | | |`,
              `| Capital Adequacy | | |`,
              `| Governance | | |`,
              `| Data Protection | | |`,
              ``,
              `REGULATORY FRAMEWORK APPLIED: Each regulation that applies — issuing authority, regulation name/number, and specific requirement triggered.`,
              ``,
              `GAPS IDENTIFIED:`,
              `| Gap | Regulation Breached | Consequence | Severity |`,
              `|-----|---------------------|-------------|----------|`,
              `[List each gap]`,
              ``,
              `REQUIRED ACTIONS: Numbered list. For each: what to do, who is responsible, and deadline or urgency.`,
              ``,
              `FILING DEADLINES: Upcoming regulatory submission deadlines — exact date, regulator, and filing type.`,
              ``,
              `MISSING DATA: If any required compliance documents are absent, list them as "Not Found: [item]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("loan underwriter") || agentLabelNorm.includes("loan-underwriter")) {
            // ── Loan Underwriter ───────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Loan Underwriter — a specialist in credit underwriting for GCC commercial and retail lending.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `UNDERWRITING DECISION:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Recommendation | APPROVE / CONDITIONAL APPROVE / DECLINE |`,
              `| Credit Score (internal) | X/100 |`,
              `| Risk Grade | A / B / C / D / E |`,
              `| Proposed Rate | X% (base + spread) |`,
              `| Maximum Loan Amount | |`,
              `| Recommended Tenor | |`,
              ``,
              `CREDIT ANALYSIS:`,
              `| Factor | Value | Assessment | Weight |`,
              `|--------|-------|------------|--------|`,
              `| Debt Service Coverage Ratio (DSCR) | X.XX | PASS/FAIL | 25% |`,
              `| Loan-to-Value (LTV) | X% | PASS/FAIL | 20% |`,
              `| Debt-to-Income (DTI) | X% | PASS/FAIL | 20% |`,
              `| Liquidity Ratio | X.XX | PASS/FAIL | 15% |`,
              `| Collateral Quality | | PASS/FAIL | 20% |`,
              ``,
              `FINANCIAL SUMMARY:`,
              `| KPI | Value | Benchmark | Status |`,
              `|-----|-------|-----------|--------|`,
              `| Revenue | | | |`,
              `| EBITDA | | | |`,
              `| Net Income | | | |`,
              `| Total Debt | | | |`,
              `| Net Debt / EBITDA | | <3.0x | |`,
              `| Interest Coverage | | >2.5x | |`,
              ``,
              `CONDITIONS (if conditional approval): Specific conditions that must be met before drawdown.`,
              ``,
              `RISK FLAGS: Credit risks, covenant concerns, or industry headwinds affecting repayment capacity.`,
              ``,
              `MISSING DATA: If any required financial statements or borrower data are absent, list them as "Not Found: [item]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("asset allocator") || agentLabelNorm.includes("asset-allocator")) {
            // ── Asset Allocator ────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Asset Allocator — a specialist in strategic and tactical asset allocation for GCC institutional and family office portfolios.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `RECOMMENDED ALLOCATION:`,
              `| Asset Class | Strategic Weight | Tactical Weight | Rationale |`,
              `|-------------|-----------------|-----------------|-----------|`,
              `| GCC Equities | X% | X% | |`,
              `| International Equities | X% | X% | |`,
              `| GCC Fixed Income / Sukuk | X% | X% | |`,
              `| International Fixed Income | X% | X% | |`,
              `| Real Estate (REITs / Direct) | X% | X% | |`,
              `| Private Equity / VC | X% | X% | |`,
              `| Commodities (Oil, Gold) | X% | X% | |`,
              `| Cash / Money Market | X% | X% | |`,
              `| Alternative / Hedge | X% | X% | |`,
              `| **Total** | **100%** | **100%** | |`,
              ``,
              `PORTFOLIO METRICS:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Expected Return (annualised) | X% |`,
              `| Expected Volatility | X% |`,
              `| Sharpe Ratio | X.XX |`,
              `| Max Drawdown (historical) | X% |`,
              `| Shariah-Compliant % | X% |`,
              ``,
              `RATIONALE: 2-3 paragraphs — macro backdrop, GCC-specific factors, client mandate alignment, and Shariah considerations if applicable.`,
              ``,
              `REBALANCING TRIGGERS: Conditions that would prompt a tactical shift (e.g. oil price below $70, Fed rate cut, GCC geopolitical escalation).`,
              ``,
              `MISSING DATA: If any required client mandate parameters are absent, list them as "Not Found: [parameter]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("jurisdiction intel") || agentLabelNorm.includes("jurisdiction-intel")) {
            // ── Jurisdiction Intel ─────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Jurisdiction Intel agent — a specialist in GCC and international regulatory intelligence.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `JURISDICTION COMPARISON:`,
              `| Dimension | [Jurisdiction A] | [Jurisdiction B] | [Jurisdiction C if applicable] |`,
              `|-----------|-----------------|-----------------|-------------------------------|`,
              `| Governing Law | | | |`,
              `| Regulator | | | |`,
              `| Licensing Requirements | | | |`,
              `| Minimum Capital | | | |`,
              `| Tax Regime | | | |`,
              `| Dispute Resolution | | | |`,
              `| Foreign Ownership | | | |`,
              `| Setup Timeline | | | |`,
              `| Annual Compliance Cost (est.) | | | |`,
              ``,
              `REGULATORY FRAMEWORK: For each jurisdiction — key laws, regulations, and circulars. Include issuing authority and effective date.`,
              ``,
              `CROSS-BORDER CONSIDERATIONS: Treaty obligations, mutual recognition agreements, or conflicts of law.`,
              ``,
              `RECOMMENDATION: Which jurisdiction best fits the stated objective and why. State the single most important factor.`,
              ``,
              `RECENT REGULATORY CHANGES: Significant updates in the past 12 months. For each: the change, effective date, and impact.`,
              ``,
              `MISSING DATA: If any required jurisdictional parameters are absent, list them as "Not Found: [parameter]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else if (agentLabelNorm.includes("risk flagger") || agentLabelNorm.includes("risk-flagger")) {
            // ── Risk Flagger ───────────────────────────────────────────────────
            systemPrompt = [
              agentContext,
              `You are the Risk Flagger — a specialist in identifying legal, contractual, and commercial risks in GCC contracts and transactions.`,
              `MANDATORY OUTPUT FORMAT — return EXACTLY these sections:`,
              ``,
              `RISK SUMMARY:`,
              `| Metric | Value |`,
              `|--------|-------|`,
              `| Overall Risk Level | LOW / MEDIUM / HIGH / CRITICAL |`,
              `| Total Flags | X |`,
              `| Critical Flags | X |`,
              `| High Flags | X |`,
              `| Medium Flags | X |`,
              ``,
              `RISK FLAGS:`,
              `| # | Risk | Clause / Section | Severity | Legal Basis | Recommended Action |`,
              `|---|------|-----------------|----------|-------------|-------------------|`,
              `[List each flag — minimum 5 flags for any substantive document]`,
              ``,
              `CRITICAL RISKS (expand each): For each CRITICAL or HIGH flag — exact clause language, legal risk mechanism, worst-case scenario, and specific redline or negotiation position.`,
              ``,
              `MISSING CLAUSES: Standard GCC contract clauses absent from this document (governing law, dispute resolution, force majeure, limitation of liability, data protection).`,
              ``,
              `NEGOTIATION PRIORITIES: Top 3 issues to address, with recommended position for each.`,
              ``,
              `MISSING DATA: If the document or any required section is absent, list it as "Not Found: [section]" — do NOT omit fields silently.`,
            ].filter(Boolean).join("\n");

          } else {
            // Default: enhanced analysis with quantitative requirements
            systemPrompt = [
              agentContext,
              ``,
              `Analyse the following task and respond with this structure. Each section must be substantive and detailed — minimum 3-5 sentences per section:`,
              ``,
              `SUMMARY: 2-3 sentences capturing the core finding and its significance.`,
              ``,
              `KEY FINDINGS: 5-8 detailed findings. Each finding must be a complete sentence with specific data, quantitative metrics, or evidence. Where data is unavailable, state "Not Found: [metric]" explicitly.`,
              ``,
              `ANALYSIS: 3-5 paragraphs of deep analysis. Explain the why behind the findings. Include relevant GCC market context, risk factors, and strategic implications.`,
              ``,
              `FLAGS: All material risks, red flags, or issues. For each flag, explain the risk mechanism and potential impact.`,
              ``,
              `NEXT ACTION: 2-3 specific, immediately actionable recommendations with clear rationale for each.`,
            ].filter(Boolean).join("\n");
          }
        }

        // ── Per-user daily rate limit check (10 req/day, 50k token circuit breaker) ──
        const db2 = await getDb();
        if (db2) {
          const today = new Date().toISOString().slice(0, 10);
          const userId = ctx.user.id;
          const ip = (ctx as any).req?.ip ?? "server";

          // Check platform daily total
          const [platformRow] = await db2.select({ total: sql<number>`COALESCE(SUM(${llmUsage.tokensUsed}), 0)` }).from(llmUsage).where(eq(llmUsage.requestDate, today));
          const platformTotal = Number(platformRow?.total ?? 0);
          if (platformTotal >= 50000) {
            await db2.insert(highDemandLog).values({ userId, ipAddress: ip, endpoint: "mesh-runAgentTask", requestDate: today, dailyTotalAtTime: platformTotal });
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "AgenThinkMesh is experiencing high demand today. Your request has been logged. Please try again tomorrow." });
          }

          // Check per-user daily request count
          const [userRow] = await db2.select({ count: sql<number>`COUNT(*)` }).from(llmUsage).where(and(eq(llmUsage.userId, userId), eq(llmUsage.requestDate, today)));
          const userCount = Number(userRow?.count ?? 0);
          if (userCount >= 10) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "You have reached the daily limit of 10 requests. Please try again tomorrow." });
          }
        }

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.taskText },
          ],
          max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content;
        const result = typeof content === "string" ? content : JSON.stringify(content);

        // Record usage
        const tokensUsed = (response as any).usage?.total_tokens ?? 2000;
        const today2 = new Date().toISOString().slice(0, 10);
        await recordLlmUsage({ ip: (ctx as any).req?.ip ?? "server", userId: ctx.user.id, endpoint: "mesh-runAgentTask", date: today2 }, tokensUsed);

        return { result, intent: detectedIntent, documentType, codeLanguage };
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
        // Billing Gateway
        const { assertWorkflowAccess } = await import("./billing");
        await assertWorkflowAccess(ctx.user.id);

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

          // ── Agent 0: Execution Intent Pre-check ─────────────────────────────────────────────
          // Detects if the user wants a deliverable (draft, code, decision, compliance, qa)
          // rather than a research/analysis report. If so, we skip the analysis pipeline
          // and produce the actual deliverable directly.
          type AnalyzeIntentType = "analysis" | "draft_document" | "generate_code" | "decision" | "compliance_check" | "qa_test" | "financial_model";
          let analyzeIntent: AnalyzeIntentType = "analysis";
          let analyzeDocumentType = "";
          let analyzeCodeLanguage = "";

          try {
            const execIntentRes = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: [
                    `You are an intent classifier for an institutional AI platform. Classify the user's request into exactly one intent type.`,
                    `Intent types:`,
                    `- analysis: research, analyse, review, assess, evaluate, compare, summarise, explain, what is, why did`,
                    `- draft_document: draft, write, compose, create a letter/email/proposal/NDA/contract/memo/report/cover letter/press release`,
                    `- generate_code: code, script, function, API, SQL, Python, JavaScript, automate, build a tool`,
                    `- decision: should I, buy or sell, approve or reject, go/no-go, recommend action, what should we do`,
                    `- compliance_check: compliant, regulatory, filing, deadline, ADGM, CMA, CBK, DFSA, KYC, AML, audit`,
                    `- qa_test: test, QA, validate, verify, check if working, find bugs, test cases`,
                    `- financial_model: DCF, valuation, WACC, terminal value, balance sheet, cash flow statement, income statement, derive financials, sense check financials, financial projections, NPV, IRR, enterprise value, equity value, EBITDA multiple`,
                    ``,
                    `Also extract:`,
                    `- documentType: if draft_document, the type of document (email, proposal, NDA, letter, memo, report, contract, press release). Empty string otherwise.`,
                    `- codeLanguage: if generate_code, the programming language requested. Default to "Python" if not specified. Empty string otherwise.`,
                    ``,
                    `Return ONLY valid JSON: { "intent": "<type>", "documentType": "<type>", "codeLanguage": "<lang>" }`,
                  ].join("\n"),
                },
                { role: "user", content: input.query },
              ],
              max_tokens: 100,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "exec_intent_classification",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      intent: { type: "string", enum: ["analysis", "draft_document", "generate_code", "decision", "compliance_check", "qa_test", "financial_model"] },
                      documentType: { type: "string" },
                      codeLanguage: { type: "string" },
                    },
                    required: ["intent", "documentType", "codeLanguage"],
                    additionalProperties: false,
                  },
                },
              },
            });
            const execIntentContent = execIntentRes.choices[0]?.message?.content;
            const execIntentParsed = JSON.parse(typeof execIntentContent === "string" ? execIntentContent : JSON.stringify(execIntentContent));
            analyzeIntent = execIntentParsed.intent as AnalyzeIntentType;
            analyzeDocumentType = execIntentParsed.documentType ?? "";
            analyzeCodeLanguage = execIntentParsed.codeLanguage ?? "";
            console.log(`[analyze] execIntent=${analyzeIntent} docType=${analyzeDocumentType}`);
          } catch (e) {
            console.warn("[analyze] Execution intent pre-check failed, defaulting to analysis", e);
          }

          // ── Execution path: produce deliverable directly, skip analysis agents ─────────────────
          if (analyzeIntent !== "analysis") {
            const docLabel = analyzeDocumentType || "document";
            const execSystemPrompts: Record<AnalyzeIntentType, string> = {
              draft_document: [
                `You are an expert document drafter for GCC institutional professionals.`,
                `The user wants you to DRAFT a ${docLabel}. Do NOT produce an analysis report. Produce the actual ${docLabel}, ready to use.`,
                ``,
                `CRITICAL FORMATTING RULES — YOU MUST FOLLOW THESE EXACTLY:`,
                `1. Use a BLANK LINE between every paragraph, section, salutation, and closing.`,
                `2. For emails: Subject line on its own line, blank line, salutation on its own line, blank line, then body paragraphs each separated by a blank line, blank line before closing, closing on its own line, blank line, name/title/company each on separate lines.`,
                `3. NEVER run paragraphs together. Each paragraph is its own block separated by blank lines.`,
                ``,
                `Output format:`,
                `DOCUMENT TYPE: [State the type of document, e.g. "Supplier Collaboration Email"]`,
                ``,
                `DRAFT:`,
                `Subject: [Subject line]`,
                ``,
                `Dear [Recipient Name],`,
                ``,
                `[Opening paragraph — purpose of the email]`,
                ``,
                `[Body paragraph 1 — context and relationship]`,
                ``,
                `[Body paragraph 2 — specific collaboration areas or proposal]`,
                ``,
                `[Closing paragraph — call to action and next steps]`,
                ``,
                `Warm regards,`,
                ``,
                `[Your Name]`,
                `[Your Title]`,
                `[Your Company]`,
                `[Your Contact Information]`,
                ``,
                `KEY POINTS COVERED:`,
                `• [Point 1]`,
                `• [Point 2]`,
                `• [Point 3]`,
                ``,
                `CUSTOMISATION NOTES:`,
                `• [Field 1 to personalise]`,
                `• [Field 2 to personalise]`,
              ].join("\n"),
              generate_code: [
                `You are an expert ${analyzeCodeLanguage || "Python"} developer for GCC institutional platforms.`,
                `The user wants you to GENERATE CODE. Do NOT produce an analysis report. Produce working, runnable code.`,
                ``,
                `Output format:`,
                `WHAT THIS CODE DOES: One paragraph explaining the purpose and approach.`,
                ``,
                `CODE:`,
                `\`\`\`${(analyzeCodeLanguage || "python").toLowerCase()}`,
                `[Complete, runnable code here. Include comments for key sections. No placeholders — write real working code.]`,
                `\`\`\``,
                ``,
                `HOW TO RUN: Step-by-step instructions to execute this code.`,
                ``,
                `CUSTOMISATION: 2-3 specific variables or parameters the user should adjust for their environment.`,
              ].join("\n"),
              decision: [
                `You are a senior institutional advisor for GCC fund managers and executives.`,
                `The user needs a DECISION RECOMMENDATION. Give a clear, direct verdict with institutional-grade reasoning. No hedging.`,
                ``,
                `Output format:`,
                `VERDICT: State your recommendation in one line (e.g. PROCEED / DO NOT PROCEED / BUY / SELL / HOLD / APPROVE / REJECT).`,
                ``,
                `RATIONALE: 3-5 sentences explaining the key reasoning behind the verdict.`,
                ``,
                `KEY RISKS: 3-5 risks that could invalidate this recommendation. For each, state the risk and its likelihood.`,
                ``,
                `CONDITIONS: What would change this verdict? List 2-3 specific triggers that would flip the recommendation.`,
                ``,
                `NEXT ACTION: The single most important immediate step the user should take.`,
              ].join("\n"),
              compliance_check: [
                `You are a GCC regulatory compliance expert (ADGM, DFSA, CMA, CBK, CIMA, MOH).`,
                `The user needs a COMPLIANCE CHECK. Provide a clear status assessment with actionable guidance.`,
                ``,
                `Output format:`,
                `COMPLIANCE STATUS: COMPLIANT / PARTIALLY COMPLIANT / NON-COMPLIANT / REQUIRES REVIEW`,
                ``,
                `REGULATORY FRAMEWORK: Which regulations, laws, or guidelines apply to this situation.`,
                ``,
                `GAPS IDENTIFIED: List each compliance gap with its severity (Critical / High / Medium / Low).`,
                ``,
                `REQUIRED ACTIONS: Specific steps to achieve or maintain compliance, in priority order.`,
                ``,
                `FILING DEADLINES: Any relevant upcoming deadlines or reporting requirements.`,
              ].join("\n"),
              qa_test: [
                `You are a QA engineer and software testing expert.`,
                `The user needs QA TEST CASES. Produce structured, executable test cases.`,
                ``,
                `Output format:`,
                `TEST SCOPE: What is being tested and what is out of scope.`,
                ``,
                `TEST CASES: List each test case with ID, description, steps, expected result, and pass/fail criteria.`,
                ``,
                `CRITICAL PATHS: The 3-5 most important user flows that must pass.`,
                ``,
                `EDGE CASES: Unusual or boundary conditions that should be tested.`,
                ``,
                `RECOMMENDED FIXES: If issues are identified, list them by priority (Critical / High / Medium) with suggested fixes.`,
              ].join("\n"),
              financial_model: [
                `You are a senior financial analyst and valuation expert serving GCC institutional investors.`,
                `The user needs a FINANCIAL MODEL. Produce a complete, structured financial analysis with all requested components. Use the uploaded financial data as the basis for all calculations.`,
                ``,
                `CRITICAL FORMATTING RULES:`,
                `1. Use a BLANK LINE between every section.`,
                `2. Present tables using plain text with | separators and aligned columns.`,
                `3. All monetary values in USD millions (e.g. $6.26M). All percentages to 1 decimal place.`,
                `4. NEVER skip a requested section. If data is insufficient, state assumptions clearly.`,
                ``,
                `Output format (produce ALL sections):`,
                ``,
                `SENSE CHECK:`,
                `Assess whether the financial projections are realistic. Flag any anomalies, inconsistencies, or aggressive assumptions. For each issue found, state: what it is, why it is a concern, and what a reasonable range would be.`,
                ``,
                `DERIVED BALANCE SHEET (USD millions):`,
                `Present a simplified Balance Sheet for each year in the projection period using this format:`,
                `| Item                    | 2026 | 2027 | 2028 | 2029 | 2030 |`,
                `|-------------------------|------|------|------|------|------|`,
                `| Total Assets            |      |      |      |      |      |`,
                `| Total Liabilities       |      |      |      |      |      |`,
                `| Total Equity            |      |      |      |      |      |`,
                `Derive from the P&L projections. State key assumptions (e.g. capex, depreciation, working capital days).`,
                ``,
                `STATEMENT OF CASH FLOWS (USD millions):`,
                `| Item                              | 2026 | 2027 | 2028 | 2029 | 2030 |`,
                `|-----------------------------------|------|------|------|------|------|`,
                `| Operating Cash Flow               |      |      |      |      |      |`,
                `| Investing Cash Flow               |      |      |      |      |      |`,
                `| Financing Cash Flow               |      |      |      |      |      |`,
                `| Net Change in Cash                |      |      |      |      |      |`,
                ``,
                `DCF VALUATION:`,
                `State WACC assumption and rationale (risk-free rate, equity risk premium, beta, cost of debt).`,
                ``,
                `| Year | Free Cash Flow (FCFe) | Discount Factor | PV of FCF |`,
                `|------|-----------------------|-----------------|-----------|`,
                `| 2026 |                       |                 |           |`,
                `| 2027 |                       |                 |           |`,
                `| 2028 |                       |                 |           |`,
                `| 2029 |                       |                 |           |`,
                `| 2030 |                       |                 |           |`,
                ``,
                `Terminal Value: State terminal growth rate assumption and terminal value calculation.`,
                `Enterprise Value: Sum of PV of FCFs + PV of Terminal Value.`,
                `Equity Value: Enterprise Value minus Net Debt.`,
                ``,
                `VALUATION SUMMARY:`,
                `| Metric                  | Value      |`,
                `|-------------------------|------------|`,
                `| WACC                    |            |`,
                `| Terminal Growth Rate    |            |`,
                `| Enterprise Value        |            |`,
                `| Net Debt                |            |`,
                `| Equity Value            |            |`,
                `| Implied Revenue Multiple|            |`,
                `| Implied EBITDA Multiple |            |`,
                ``,
                `KEY ASSUMPTIONS & RISKS:`,
                `List the 3-5 most critical assumptions that drive the valuation, and what happens to equity value if each assumption changes by +/- 10%.`,
                ``,
                `NEXT STEPS:`,
                `2-3 specific actions the management team should take based on this analysis.`,
              ].join("\n"),
              analysis: "", // not used in this branch
            };

            const execRes = await invokeLLM({
              messages: [
                { role: "system", content: execSystemPrompts[analyzeIntent] },
                { role: "user", content: fullQuery },
              ],
              max_tokens: 2000,
            });
            const execContent = execRes.choices[0]?.message?.content;
            const execResult = typeof execContent === "string" ? execContent : JSON.stringify(execContent);
            const execTokens = (execRes as any).usage?.total_tokens ?? 2000;
            const execDate = new Date().toISOString().slice(0, 10);
            await recordLlmUsage({ ip: (ctx as any).req?.ip ?? "server", userId: ctx.user.id, endpoint: "mesh-analyze-exec", date: execDate }, execTokens);

            // Map intent to a human-readable task type for the PDF
            const intentTaskTypeMap: Record<AnalyzeIntentType, string> = {
              draft_document: `${analyzeDocumentType ? analyzeDocumentType.charAt(0).toUpperCase() + analyzeDocumentType.slice(1) + " " : ""}Draft`,
              generate_code: `${analyzeCodeLanguage || "Python"} Code`,
              decision: "Decision Recommendation",
              compliance_check: "Compliance Check",
              qa_test: "QA Test Plan",
              financial_model: "Financial Model & DCF Valuation",
              analysis: "Analysis",
            };

            // Save to meshTasks and return
            await db.update(meshTasks).set({
              taskType: intentTaskTypeMap[analyzeIntent],
              confidenceScore: 90,
              agentsUsed: 2, // intent classifier + executor
              executionTimeMs: Date.now() - startTime,
              keyFindings: JSON.stringify([execResult.slice(0, 200)]),
              risks: JSON.stringify([]),
              segmentInsights: JSON.stringify([]),
              recommendation: execResult,
              meshRoute: JSON.stringify(["Intent Classifier", "Execution Agent"]),
              sentimentPositive: 70,
              sentimentNeutral: 20,
              sentimentNegative: 10,
              structuredReport: null,
              fileUrl: input.fileUrl ?? null,
              fileName: input.fileName ?? null,
              status: "complete",
            }).where(eq(meshTasks.id, taskId));

            return { taskId, status: "complete" as const };
          }

          // ── Analysis path (original pipeline) ──────────────────────────────────────────────────
          // Helper: safely extract JSON from LLM response (guards against undefined choices)
          const safeContent = (res: { choices?: Array<{ message?: { content?: string | unknown } }> }, fallback = "{}"): string => {
            const content = res?.choices?.[0]?.message?.content;
            if (typeof content === "string") return content;
            if (content != null) return JSON.stringify(content);
            return fallback;
          };

          // ── Agent 1: Intent Classifier (analysis task type) ─────────────────────────────────
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
          const intentRaw = JSON.parse(safeContent(intentRes, '{"taskType":"Business Strategy","confidence":70,"meshRoute":[]}')) as {
            taskType: string;
            confidence: number;
            meshRoute: string[] | null;
          };
          const intentData = {
            taskType: intentRaw.taskType ?? "Business Strategy",
            confidence: intentRaw.confidence ?? 70,
            meshRoute: Array.isArray(intentRaw.meshRoute) ? intentRaw.meshRoute : [],
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

          const findingsRaw = JSON.parse(safeContent(findingsRes, '{"keyFindings":[]}')) as { keyFindings: string[] | null };
          const findings = { keyFindings: Array.isArray(findingsRaw.keyFindings) ? findingsRaw.keyFindings : [] };
          const risksRaw = JSON.parse(safeContent(risksRes, '{"risks":[],"sentimentPositive":50,"sentimentNeutral":30,"sentimentNegative":20}')) as {
            risks: string[] | null;
            sentimentPositive: number;
            sentimentNeutral: number;
            sentimentNegative: number;
          };
          const risksData = {
            risks: Array.isArray(risksRaw.risks) ? risksRaw.risks : [],
            sentimentPositive: risksRaw.sentimentPositive ?? 50,
            sentimentNeutral: risksRaw.sentimentNeutral ?? 30,
            sentimentNegative: risksRaw.sentimentNegative ?? 20,
          };
          const segmentsRaw = JSON.parse(safeContent(segmentsRes, '{"segmentInsights":[]}')) as { segmentInsights: { segment: string; likelihood: number }[] | null };
          const segments = { segmentInsights: Array.isArray(segmentsRaw.segmentInsights) ? segmentsRaw.segmentInsights : [] };

          // ── Agent 5: Report Writer ──────────────────────────────────────────────────────────────────────────────────────
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
          const reportRaw = JSON.parse(safeContent(reportRes, '{"recommendation":null}')) as { recommendation: string | null };
          const reportData = { recommendation: reportRaw.recommendation ?? "Analysis complete. Review the detailed findings above for actionable insights." };

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
- senseCheck: { verdict: string, observations: string[] } (is the data credible? verdict is 'Credible' | 'Concerns Noted' | 'Unreliable'. REQUIRED: always include at least 3 specific observations explaining WHY you gave this verdict — e.g. growth rate assumptions, missing data, inconsistencies, cash burn concerns. Never leave observations empty.)
- balanceSheet: { years: string[], rows: { label: string, values: (string|number)[], isHeader?: boolean, isBold?: boolean }[] } | null
- cashFlowStatement: { years: string[], rows: { label: string, values: (string|number)[], isHeader?: boolean, isBold?: boolean }[] } | null
- dcfValuation: { wacc: string, terminalGrowthRate: string, impliedValuation: string, valuationRange: string, assumptions: string[], sensitivityNote: string } | null
- keyMetrics: { label: string, value: string, trend: 'up' | 'down' | 'neutral' }[]
- revenueSegments: { segment: string, value: string, percentage?: string }[] | null (revenue breakdown by business segment/product line derived from the document — e.g. SaaS, Marketplace, Services. Use null if not available.)
- nextSteps: string[]
If a section is not applicable (e.g. no financial data provided), set it to null. For balanceSheet and cashFlowStatement, derive them from the P&L and projections in the attached document if available. For revenueSegments, extract the actual revenue line items from the uploaded spreadsheet.`,
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
                          observations: { type: "array", items: { type: "string" }, minItems: 1 },
                        },
                        required: ["verdict", "observations"],
                      },
                      balanceSheet: { type: ["object", "null"] },
                      cashFlowStatement: { type: ["object", "null"] },
                      dcfValuation: { type: ["object", "null"] },
                      keyMetrics: { type: "array", items: { type: "object" } },
                      revenueSegments: { type: ["array", "null"], items: { type: "object" } },
                      nextSteps: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            });
            structuredReportJson = safeContent(structuredRes, 'null') === 'null' ? null : safeContent(structuredRes, 'null');
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
            revenueSegments: Array.isArray(sr.revenueSegments) ? sr.revenueSegments : null,
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

    // Download a task result as a formatted PDF
    downloadPdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const [row] = await db
          .select()
          .from(meshTasks)
          .where(and(eq(meshTasks.id, input.id), eq(meshTasks.userId, ctx.user.id)))
          .limit(1);

        if (!row) throw new Error("Task not found");

        const { generateReportPdf } = await import("./pdfReport.js");

        const safeParse = (val: string | null) => {
          if (!val) return null;
          try { return JSON.parse(val); } catch { return null; }
        };

        const structuredReport = safeParse(row.structuredReport as string | null);
        const taskData = {
          id: row.id,
          query: row.query,
          taskType: row.taskType ?? "Analysis",
          confidence: Number(row.confidenceScore ?? 0),
          executionTime: Math.round((row.executionTimeMs ?? 0) / 1000),
          keyFindings: safeParse(row.keyFindings as string | null) ?? [],
          risks: safeParse(row.risks as string | null) ?? [],
          recommendation: row.recommendation ?? null,
          fileName: row.fileName ?? null,
          structuredReport,
          createdAt: row.createdAt,
        };

        const pdfBuffer = await generateReportPdf(taskData);
        const base64 = pdfBuffer.toString("base64");
        return { base64, filename: `AgenThinkMesh-Report-${row.id}.pdf` };
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

    // Save agent output text directly to vault (no file upload needed)
    saveAgentOutput: protectedProcedure
      .input(z.object({
        filename: z.string().min(1),   // e.g. "Supplier Email — 16 Mar 2026"
        content: z.string().min(1),    // the full agent output text
        intent: z.string().optional(), // e.g. "draft_document", "analysis"
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const [result] = await db.insert(vaultDocuments).values({
          userId: ctx.user.id,
          filename: input.filename,
          fileKey: `agent-output/${ctx.user.id}/${Date.now()}`,  // synthetic key for text-only entries
          fileUrl: "",                   // no file — text-only vault entry
          mimeType: "text/plain",
          extractedText: input.content,
        });
        const docId = (result as unknown as { insertId: number }).insertId;
        return { id: docId, success: true };
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

    // Count all agents (public) — total catalogue, used for pagination header
    count: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        capability: z.string().optional(),
        domain: z.string().optional(),
      }).optional())
      .query(async () => {
        const db = await getDb();
        if (!db) return 0;
        const [row] = await db
          .select({ total: sql<number>`count(*)` })
          .from(agents);
        return Number(row?.total ?? 0);
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
          .where(
            and(
              eq(agents.status, "active"),
              // exclude stale agents unverified for 24h+
              or(
                isNull(agents.lastVerifiedAt), // newly registered, not yet checked
                gte(agents.lastVerifiedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
              )
            )
          );

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

    // List agents by domain (public)
    listByDomain: publicProcedure
      .input(z.object({ domain: z.string().min(1).max(64) }))
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
            domain: agents.domain,
            isBuiltIn: agents.isBuiltIn,
            isCustom: agents.isCustom,
            createdAt: agents.createdAt,
            tasksCompleted: agentMetrics.tasksCompleted,
            successRate: agentMetrics.successRate,
            avgLatency: agentMetrics.avgLatency,
          })
          .from(agents)
          .leftJoin(agentMetrics, eq(agents.id, agentMetrics.agentId))
          .where(and(eq(agents.status, "active"), eq(agents.domain, input.domain)))
          .orderBy(desc(agents.isBuiltIn), desc(agentMetrics.tasksCompleted))
          .limit(100);
        return rows;
      }),

    // Create a custom AI-generated agent for a domain (authenticated)
    createCustom: protectedProcedure
      .input(z.object({
        domain: z.string().min(1).max(64),
        userPrompt: z.string().min(5).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an AI agent designer for the AgenThinkMesh platform. Given a user's description of an agent they need, generate a structured agent specification. Always respond with valid JSON only, no markdown.\n\nThe agent will operate in the "${input.domain}" domain. Generate a realistic, professional agent name, a concise description (1-2 sentences), and 3-5 capability tags (lowercase hyphenated strings).`,
            },
            {
              role: "user",
              content: `Create an agent for this need: "${input.userPrompt}"`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "agent_spec",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  agentName: { type: "string", description: "Short professional agent name (2-4 words)" },
                  description: { type: "string", description: "1-2 sentence description of what the agent does" },
                  capabilities: { type: "array", items: { type: "string" }, description: "3-5 lowercase hyphenated capability tags" },
                },
                required: ["agentName", "description", "capabilities"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = llmResponse?.choices?.[0]?.message?.content;
        if (!rawContent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM did not return a response" });
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

        let spec: { agentName: string; description: string; capabilities: string[] };
        try {
          spec = JSON.parse(content);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse LLM response" });
        }

        const [result] = await db.insert(agents).values({
          ownerId: ctx.user.id,
          agentName: spec.agentName,
          developerName: ctx.user.name ?? "Custom",
          description: spec.description,
          capabilities: JSON.stringify(spec.capabilities),
          endpointUrl: "https://mesh.agenthink.ai/agents/custom",
          averageLatency: 500,
          pricingModel: "free",
          status: "active",
          connectionTested: false,
          domain: input.domain,
          isBuiltIn: false,
          isCustom: true,
          version: "1.0.0",
        });
        const agentId = (result as unknown as { insertId: number }).insertId;
        await db.insert(agentMetrics).values({
          agentId,
          tasksCompleted: 0,
          successRate: "80.00",
          avgLatency: 500,
          errorRate: "0.00",
        });

        return {
          id: agentId,
          agentName: spec.agentName,
          description: spec.description,
          capabilities: spec.capabilities,
          domain: input.domain,
          isCustom: true,
          isBuiltIn: false,
        };
      }),
    // Returns { [domain]: count } for all active agents in one query
    countByDomain: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return {} as Record<string, number>;
        const rows = await db
          .select({ domain: agents.domain, count: sql<number>`COUNT(*)` })
          .from(agents)
          .where(eq(agents.status, "active"))
          .groupBy(agents.domain);
        const map: Record<string, number> = {};
        for (const row of rows) {
          if (row.domain) map[row.domain] = Number(row.count);
        }
        return map;
      }),

    // Returns all distinct domains sorted A-Z with agent counts
    listDomains: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [] as { domain: string; count: number }[];
        const rows = await db
          .select({ domain: agents.domain, count: sql<number>`COUNT(*)` })
          .from(agents)
          .where(eq(agents.status, "active"))
          .groupBy(agents.domain);
        return rows
          .filter((r) => !!r.domain)
          .map((r) => ({ domain: r.domain as string, count: Number(r.count) }))
          .sort((a, b) => a.domain.localeCompare(b.domain));
      }),

    // Returns all roles from DB sorted A-Z with agent counts per domain
    listRoles: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [] as { id: number; name: string; icon: string; color: string; domain: string; persona: string; description: string; agentCount: number }[];
        // Fetch all roles
        const roleRows = await db.select().from(roles).orderBy(roles.name);
        // Fetch agent counts per domain
        const countRows = await db
          .select({ domain: agents.domain, count: sql<number>`COUNT(*)` })
          .from(agents)
          .where(eq(agents.status, "active"))
          .groupBy(agents.domain);
        const domainCounts: Record<string, number> = {};
        for (const r of countRows) {
          if (r.domain) domainCounts[r.domain] = Number(r.count);
        }
        return roleRows.map((r) => ({
          id: r.id,
          name: r.name,
          icon: r.icon,
          color: r.color,
          domain: r.domain,
          persona: r.persona,
          description: r.description,
          agentCount: domainCounts[r.domain] ?? 0,
        }));
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
          role: z.string().max(128).optional(),
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
          `Role: ${input.role ?? "Not provided"}`,
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
  waitlist: router({
    join: publicProcedure
      .input(
        z.object({
          email: z.string().email("Invalid email address").max(320),
          workflow: z.string().max(64).default("education"),
          sourcePage: z.string().max(100).default("home"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        // Persist to DB
        if (db) {
          await db.insert(waitlistSignups).values({
            email: input.email,
            sourcePage: input.sourcePage,
            stageInterest: input.workflow,
          }).catch(() => null);
        }
        // Notify owner via Manus notification service
        await notifyOwner({
          title: `📝 Waitlist signup: ${input.workflow} — ${input.email}`,
          content: `New waitlist signup for the ${input.workflow} workflow.\n\nEmail: ${input.email}\nSource: ${input.sourcePage}\nSubmitted at: ${new Date().toUTCString()}`,
        }).catch(() => false);
        return { success: true };
      }),
    // Admin: list waitlist signups (paginated + filtered)
    list: protectedProcedure
      .input(z.object({
        limit:      z.number().min(1).max(100).default(20),
        offset:     z.number().min(0).default(0),
        sourcePage: z.string().optional(),
        dateFrom:   z.string().optional(),
        dateTo:     z.string().optional(),
        sortDir:    z.enum(["asc", "desc"]).default("desc"),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) return { rows: [], total: 0 };

        const limit      = Math.min(input?.limit  ?? 20, 100);
        const offset     = input?.offset ?? 0;
        const sourcePage = input?.sourcePage;
        const dateFrom   = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo     = input?.dateTo   ? new Date(input.dateTo)   : undefined;
        const sortDir    = input?.sortDir  ?? "desc";

        const conds = [];
        if (sourcePage && sourcePage !== "all") conds.push(eq(waitlistSignups.sourcePage, sourcePage));
        if (dateFrom) conds.push(gte(waitlistSignups.createdAt, dateFrom));
        if (dateTo)   conds.push(lte(waitlistSignups.createdAt, dateTo));

        const whereClause = conds.length > 0 ? and(...conds) : undefined;

        const [totalRow, rows] = await Promise.all([
          db.select({ count: sql<number>`COUNT(*)` }).from(waitlistSignups).where(whereClause),
          db.select().from(waitlistSignups)
            .where(whereClause)
            .orderBy(sortDir === "desc" ? desc(waitlistSignups.createdAt) : waitlistSignups.createdAt)
            .limit(limit)
            .offset(offset),
        ]);

        return { rows, total: Number(totalRow[0]?.count ?? 0) };
      }),
  }),
  // ── Portfolio Intelligence ───────────────────────────────────────────────────────────────────────────────────────────
  portfolio: router({

    // Upload a document and create a new portfolio review record
    create: protectedProcedure
      .input(z.object({
        fundName: z.string().optional(),
        manager: z.string().optional(),
        reviewPeriod: z.string().optional(),
        notes: z.string().optional(),
        documents: z.array(z.object({
          fileName: z.string(),
          fileUrl: z.string(),
          mimeType: z.string(),
        })).min(1, "At least one document is required"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const [row] = await db.insert(portfolioReviews).values({
          userId: ctx.user.id,
          fundName: input.fundName ?? null,
          manager: input.manager ?? null,
          reviewPeriod: input.reviewPeriod ?? null,
          notes: input.notes ?? null,
          documents: JSON.stringify(input.documents),
          status: "pending",
        }).$returningId();
        return { id: row.id as number };
      }),

    // Run the analysis for a portfolio review
    analyze: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        // Fetch the review
        const [review] = await db
          .select()
          .from(portfolioReviews)
          .where(eq(portfolioReviews.id, input.id))
          .limit(1);
        if (!review) throw new Error("Portfolio review not found");
        if (review.userId !== ctx.user.id) throw new Error("Forbidden");

        // Mark as analyzing
        await db.update(portfolioReviews)
          .set({ status: "analyzing" })
          .where(eq(portfolioReviews.id, input.id));

        try {
          // Extract document content
          const docs: { fileName: string; fileUrl: string; mimeType: string }[] = (() => {
            try { return JSON.parse(review.documents ?? "[]"); } catch { return []; }
          })();

          let combinedContent = "";
          for (const doc of docs) {
            try {
              const extracted = await extractFileContent(doc.fileUrl, doc.fileName);
              if (extracted.trim()) {
                combinedContent += `\n\n=== Document: ${doc.fileName} ===\n${extracted}`;
              }
            } catch { /* skip failed extractions */ }
          }

          const context = [
            review.fundName ? `Fund Name: ${review.fundName}` : "",
            review.manager ? `Manager: ${review.manager}` : "",
            review.reviewPeriod ? `Review Period: ${review.reviewPeriod}` : "",
            review.notes ? `Notes: ${review.notes}` : "",
            combinedContent ? `\nDocument Content:${combinedContent}` : "",
          ].filter(Boolean).join("\n");

          const safeContent = (res: { choices?: Array<{ message?: { content?: string | unknown } }> }, fallback = "{}"): string => {
            const content = res?.choices?.[0]?.message?.content;
            if (typeof content === "string") return content;
            if (content != null) return JSON.stringify(content);
            return fallback;
          };

          // Run 5 analysis agents in parallel
          const [execSummaryRes, mandateRes, sectorRes, riskRes, narrativeRes] = await Promise.all([
            // Agent 1: Executive Summary
            invokeLLM({
              messages: [
                { role: "system", content: "You are a senior portfolio analyst. Write a concise executive summary of this portfolio review. Return ONLY a JSON object with field: executiveSummary (string, 3-5 sentences)." },
                { role: "user", content: context },
              ],
              response_format: { type: "json_schema", json_schema: { name: "exec_summary", strict: true, schema: { type: "object", properties: { executiveSummary: { type: "string" } }, required: ["executiveSummary"], additionalProperties: false } } },
            }),
            // Agent 2: Mandate vs Portfolio Reality
            invokeLLM({
              messages: [
                { role: "system", content: "You are a portfolio compliance analyst. Assess whether the portfolio construction matches the stated investment mandate. Return ONLY a JSON object with fields: mandateAlignment (string: 'Aligned' | 'Partial Deviation' | 'Significant Deviation'), summary (string), deviations (string[])." },
                { role: "user", content: context },
              ],
              response_format: { type: "json_schema", json_schema: { name: "mandate_check", strict: true, schema: { type: "object", properties: { mandateAlignment: { type: "string" }, summary: { type: "string" }, deviations: { type: "array", items: { type: "string" } } }, required: ["mandateAlignment", "summary", "deviations"], additionalProperties: false } } },
            }),
            // Agent 3: Sector Allocation Analysis
            invokeLLM({
              messages: [
                { role: "system", content: "You are a sector allocation analyst. Analyse the sector exposures in this portfolio. Return ONLY a JSON object with fields: topSectors (array of {sector: string, allocation: string, commentary: string}), concentrationRisk (string), diversificationScore (integer 0-100)." },
                { role: "user", content: context },
              ],
              response_format: { type: "json_schema", json_schema: { name: "sector_analysis", strict: false, schema: { type: "object", properties: { topSectors: { type: "array", items: { type: "object" } }, concentrationRisk: { type: "string" }, diversificationScore: { type: "integer" } }, required: ["topSectors", "concentrationRisk", "diversificationScore"] } } },
            }),
            // Agent 4: Risk Signals
            invokeLLM({
              messages: [
                { role: "system", content: "You are a risk analyst. Identify key risk signals in this portfolio. Return ONLY a JSON object with fields: riskSignals (string[]), overallRiskRating ('Low' | 'Medium' | 'High'), riskSummary (string)." },
                { role: "user", content: context },
              ],
              response_format: { type: "json_schema", json_schema: { name: "risk_signals", strict: true, schema: { type: "object", properties: { riskSignals: { type: "array", items: { type: "string" } }, overallRiskRating: { type: "string" }, riskSummary: { type: "string" } }, required: ["riskSignals", "overallRiskRating", "riskSummary"], additionalProperties: false } } },
            }),
            // Agent 5: Manager Narrative Assessment
            invokeLLM({
              messages: [
                { role: "system", content: "You are an investment analyst assessing GP accountability. Evaluate whether the manager's narrative in their reports matches their actual portfolio actions. Return ONLY a JSON object with fields: narrativeConsistency ('Consistent' | 'Inconsistent' | 'Partially Consistent'), assessment (string), keyQuestions (string[]), confidenceScore (integer 0-100)." },
                { role: "user", content: context },
              ],
              response_format: { type: "json_schema", json_schema: { name: "narrative_assessment", strict: true, schema: { type: "object", properties: { narrativeConsistency: { type: "string" }, assessment: { type: "string" }, keyQuestions: { type: "array", items: { type: "string" } }, confidenceScore: { type: "integer" } }, required: ["narrativeConsistency", "assessment", "keyQuestions", "confidenceScore"], additionalProperties: false } } },
            }),
          ]);

          const execSummaryData = JSON.parse(safeContent(execSummaryRes, '{"executiveSummary":"Analysis complete."}'));
          const mandateData = JSON.parse(safeContent(mandateRes, '{"mandateAlignment":"Partial Deviation","summary":"Unable to determine mandate alignment from provided documents.","deviations":[]}'));
          const sectorData = JSON.parse(safeContent(sectorRes, '{"topSectors":[],"concentrationRisk":"Unable to assess.","diversificationScore":50}'));
          const riskData = JSON.parse(safeContent(riskRes, '{"riskSignals":[],"overallRiskRating":"Medium","riskSummary":"Unable to assess risk signals from provided documents."}'));
          const narrativeData = JSON.parse(safeContent(narrativeRes, '{"narrativeConsistency":"Partially Consistent","assessment":"Unable to assess narrative consistency from provided documents.","keyQuestions":[],"confidenceScore":50}'));

          const reportJson = JSON.stringify({
            executiveSummary: execSummaryData.executiveSummary ?? "Analysis complete.",
            mandateAlignment: mandateData.mandateAlignment ?? "Partial Deviation",
            mandateSummary: mandateData.summary ?? "",
            mandateDeviations: Array.isArray(mandateData.deviations) ? mandateData.deviations : [],
            topSectors: Array.isArray(sectorData.topSectors) ? sectorData.topSectors : [],
            concentrationRisk: sectorData.concentrationRisk ?? "",
            diversificationScore: sectorData.diversificationScore ?? 50,
            riskSignals: Array.isArray(riskData.riskSignals) ? riskData.riskSignals : [],
            overallRiskRating: riskData.overallRiskRating ?? "Medium",
            riskSummary: riskData.riskSummary ?? "",
            narrativeConsistency: narrativeData.narrativeConsistency ?? "Partially Consistent",
            narrativeAssessment: narrativeData.assessment ?? "",
            keyQuestions: Array.isArray(narrativeData.keyQuestions) ? narrativeData.keyQuestions : [],
            confidenceScore: narrativeData.confidenceScore ?? 50,
          });

          await db.update(portfolioReviews)
            .set({ status: "complete", reportJson })
            .where(eq(portfolioReviews.id, input.id));

          return { id: input.id, status: "complete" };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Analysis failed";
          await db.update(portfolioReviews)
            .set({ status: "error", errorMessage: msg })
            .where(eq(portfolioReviews.id, input.id));
          throw new Error(msg);
        }
      }),

    // Get a single portfolio review
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;
        const [row] = await db
          .select()
          .from(portfolioReviews)
          .where(eq(portfolioReviews.id, input.id))
          .limit(1);
        if (!row || row.userId !== ctx.user.id) return null;
        return row;
      }),

    // List all portfolio reviews for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(portfolioReviews)
        .where(eq(portfolioReviews.userId, ctx.user.id))
        .orderBy(desc(portfolioReviews.createdAt))
        .limit(50);
    }),

    // Upload a document for portfolio review (returns S3 URL)
    uploadDocument: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const ext = input.fileName.split(".").pop() ?? "bin";
        const key = `portfolio/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, fileName: input.fileName };
      }),

    // ── PPTX Export ────────────────────────────────────────────────────────
    // Start an async PPTX generation job for a completed portfolio review.
    // The job runs in the background; poll getExportStatus to check progress.
    exportPptx: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [review] = await db
          .select()
          .from(portfolioReviews)
          .where(eq(portfolioReviews.id, input.reviewId))
          .limit(1);

        if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        if (review.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (review.status !== "complete") throw new TRPCError({ code: "BAD_REQUEST", message: "Analysis must be complete before exporting" });

        // Mark as generating immediately so UI can show spinner
        if (db) {
          await db.update(portfolioReviews)
            .set({ pptxStatus: "generating", pptxJobStartedAt: new Date() })
            .where(eq(portfolioReviews.id, input.reviewId));
        }

        // Run generation asynchronously — do NOT await
        (async () => {
          try {
            const { generatePortfolioPptx } = await import("./pptxGenerator");
            const pptxBuffer = await generatePortfolioPptx({
              fundName: review.fundName,
              manager: review.manager,
              reviewPeriod: review.reviewPeriod,
              reportJson: review.reportJson ?? "{}",
              generatedDate: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
            });

            const key = `portfolio-pptx/${ctx.user.id}/${input.reviewId}-${Date.now()}.pptx`;
            const { url } = await storagePut(key, pptxBuffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");

            const db2 = await getDb();
            if (db2) {
              await db2.update(portfolioReviews)
                .set({ pptxStatus: "ready", pptxUrl: url })
                .where(eq(portfolioReviews.id, input.reviewId));
            }
          } catch (err) {
            console.error("[PPTX Export] Generation failed:", err);
            const db3 = await getDb();
            if (db3) {
              await db3.update(portfolioReviews)
                .set({ pptxStatus: "error" })
                .where(eq(portfolioReviews.id, input.reviewId));
            }
          }
        })();

        return { started: true };
      }),

    // Poll the PPTX export job status for a given review.
    getExportStatus: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const [review] = await db
          .select({
            pptxStatus: portfolioReviews.pptxStatus,
            pptxUrl: portfolioReviews.pptxUrl,
            userId: portfolioReviews.userId,
          })
          .from(portfolioReviews)
          .where(eq(portfolioReviews.id, input.reviewId))
          .limit(1);

        if (!review) throw new TRPCError({ code: "NOT_FOUND" });
        if (review.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        return {
          pptxStatus: review.pptxStatus as "idle" | "generating" | "ready" | "error",
          pptxUrl: review.pptxUrl ?? null,
        };
      }),
  }),

  turnaround: turnaroundRouter,
  identity: identityRouter,
  workflow: workflowRouter,
  dossier: dossierPdfRouter,
  billing: billingRouter,
  treasury: treasuryRouter,
  portfolioIntel: portfolioRouter,
  portfolioMesh: portfolioMeshRouter,
  insurance: insuranceRouter,
  admesh: admeshRouter,
  openclaw: openclawRouter,
  socialMedia: socialMediaRouter,
  dealScreener: dealScreenerRouter,
  outcomeLedger: outcomeLedgerRouter,
  proofEngine: proofEngineRouter,
  dealSourcing: dealSourcingRouter,
  procurement: procurementRouter,
  shareReport: shareReportRouter,
  intelligence: intelligenceRouter,
  mvno: mvnoRouter,
  forecast: forecastRouter,
  knowledgeVault: knowledgeVaultRouter,
  selfLearning: selfLearningRouter,
  pitch: pitchRouter,
  contacts: contactsRouter,
  tracker: trackerRouter,
  uaeRealestate: uaeRealestateRouter,
  sado: sadoRouter,
  // ── ETF Partner CRMM ────────────────────────────────────────────────────────
  partner: router({
    // List all partner institutions (admin or public read)
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db.select().from(partnerInstitutions).orderBy(desc(partnerInstitutions.createdAt));
    }),

    // Submit a partnership request (public — no auth required)
    requestPartnership: publicProcedure
      .input((input: unknown) => {
        const i = input as {
          institutionName: string;
          contactName: string;
          contactEmail: string;
          role?: string;
          message?: string;
          partnerType?: string;
        };
        if (!i.institutionName || !i.contactName || !i.contactEmail) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "institutionName, contactName, and contactEmail are required" });
        }
        return i;
      })
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db.insert(partnershipRequests).values({
          institutionName: input.institutionName,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          role: input.role ?? null,
          message: input.message ?? null,
          partnerType: (input.partnerType as typeof partnershipRequests.$inferInsert["partnerType"]) ?? "other",
          notified: false,
        });
        // Notify owner
        await notifyOwner({
          title: `New ETF Partnership Request — ${input.institutionName}`,
          content: `From: ${input.contactName} (${input.contactEmail})\nRole: ${input.role ?? "—"}\nType: ${input.partnerType ?? "other"}\n\n${input.message ?? "No message provided."}`,
        });
        return { success: true };
      }),

    // List partnership requests (protected — owner only)
    listRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db.select().from(partnershipRequests).orderBy(desc(partnershipRequests.createdAt));
    }),
  }),

  // ── Admin Usage Dashboard ──────────────────────────────────────────────────
  adminUsage: router({
    // Daily token consumption for the last 30 days
    dailyStats: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(90).default(30) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const rows = await db
          .select({
            date: llmUsage.requestDate,
            endpoint: llmUsage.endpoint,
            totalTokens: sql<number>`SUM(${llmUsage.tokensUsed})`,
            requestCount: sql<number>`COUNT(*)`,
          })
          .from(llmUsage)
          .groupBy(llmUsage.requestDate, llmUsage.endpoint)
          .orderBy(desc(llmUsage.requestDate))
          .limit(input.days * 10);

        return rows;
      }),

    // Per-user stats (last 30 days)
    userStats: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(90).default(30) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - input.days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const rows = await db
          .select({
            userId: llmUsage.userId,
            userName: users.name,
            userEmail: users.email,
            totalTokens: sql<number>`SUM(${llmUsage.tokensUsed})`,
            requestCount: sql<number>`COUNT(*)`,
          })
          .from(llmUsage)
          .leftJoin(users, eq(llmUsage.userId, users.id))
          .where(gte(llmUsage.requestDate, cutoffStr))
          .groupBy(llmUsage.userId, users.name, users.email)
          .orderBy(desc(sql`SUM(${llmUsage.tokensUsed})`));

        return rows;
      }),

    // Today's summary (for the dashboard header)
    todaySummary: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const today = new Date().toISOString().slice(0, 10);

      const [totals] = await db
        .select({
          totalTokens: sql<number>`COALESCE(SUM(${llmUsage.tokensUsed}), 0)`,
          requestCount: sql<number>`COUNT(*)`,
        })
        .from(llmUsage)
        .where(eq(llmUsage.requestDate, today));

      const [blocked] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(highDemandLog)
        .where(eq(highDemandLog.requestDate, today));

      return {
        date: today,
        totalTokens: Number(totals?.totalTokens ?? 0),
        requestCount: Number(totals?.requestCount ?? 0),
        blockedRequests: Number(blocked?.count ?? 0),
        tokenBudget: 50000,
        percentUsed: Math.round((Number(totals?.totalTokens ?? 0) / 50000) * 100),
      };
    }),

    // Recent high-demand log entries
    highDemandEvents: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        return db
          .select({
            id: highDemandLog.id,
            userId: highDemandLog.userId,
            userName: users.name,
            userEmail: users.email,
            ipAddress: highDemandLog.ipAddress,
            endpoint: highDemandLog.endpoint,
            requestDate: highDemandLog.requestDate,
            dailyTotalAtTime: highDemandLog.dailyTotalAtTime,
            createdAt: highDemandLog.createdAt,
          })
          .from(highDemandLog)
          .leftJoin(users, eq(highDemandLog.userId, users.id))
          .orderBy(desc(highDemandLog.createdAt))
          .limit(input.limit);
      }),

    // All registered users with their usage stats
    allUsers: protectedProcedure
      .input(z.object({
        limit:   z.number().min(1).max(100).default(25),
        offset:  z.number().min(0).default(0),
        search:  z.string().optional(),
        role:    z.enum(["user", "admin", ""]).default(""),
        sortBy:  z.enum(["createdAt", "lastSignedIn", "name", "email"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      }).optional())
      .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const limit   = Math.min(input?.limit  ?? 25, 100);
      const offset  = input?.offset  ?? 0;
      const search  = input?.search?.trim();
      const roleFilter = input?.role ?? "";
      const sortBy  = input?.sortBy  ?? "createdAt";
      const sortDir = input?.sortDir ?? "desc";
      const conds: ReturnType<typeof eq>[] = [];
      if (search) conds.push(or(like(users.name, `%${search}%`), like(users.email, `%${search}%`)) as ReturnType<typeof eq>);
      if (roleFilter) conds.push(eq(users.role, roleFilter as "user" | "admin"));
      const where = conds.length > 0 ? and(...conds) : undefined;
      const sortCol = sortBy === "lastSignedIn" ? users.lastSignedIn
        : sortBy === "name" ? users.name
        : sortBy === "email" ? users.email
        : users.createdAt;
      const orderExpr = sortDir === "asc" ? asc(sortCol) : desc(sortCol);
      const [totalResult, rows] = await Promise.all([
        db.select({ total: count() }).from(users).where(where),
        db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        }).from(users).where(where).orderBy(orderExpr).limit(limit).offset(offset),
      ]);
      return { rows, total: totalResult[0]?.total ?? 0 };
    }),
        // User Activity — one row per user, most recent login first (paginated)
    getUserActivity: protectedProcedure
      .input(z.object({
        limit:     z.number().min(1).max(100).default(20),
        offset:    z.number().min(0).default(0),
        email:     z.string().optional(),
        dateFrom:  z.string().optional(), // ISO date string
        dateTo:    z.string().optional(), // ISO date string
        sortBy:    z.enum(["lastLoginAt", "loginCount"]).default("lastLoginAt"),
        sortDir:   z.enum(["asc", "desc"]).default("desc"),
      }).optional())
      .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const limit  = Math.min(input?.limit  ?? 20, 100);
      const offset = input?.offset ?? 0;
      const emailFilter = input?.email?.trim();
      const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
      const dateTo   = input?.dateTo   ? new Date(input.dateTo)   : undefined;
      const sortBy  = input?.sortBy  ?? "lastLoginAt";
      const sortDir = input?.sortDir ?? "desc";

      // Get users with optional email filter
      const userQuery = db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users);
      const allUsers = emailFilter
        ? await userQuery.where(like(users.email, `%${emailFilter}%`))
        : await userQuery;

      // Get login stats per user
      const loginStatsConds = [];
      if (dateFrom) loginStatsConds.push(gte(loginEvents.loginAt, dateFrom));
      if (dateTo)   loginStatsConds.push(lte(loginEvents.loginAt, dateTo));
      const loginStats = await db
        .select({
          userId: loginEvents.userId,
          lastIp: sql<string>`MAX(CASE WHEN ${loginEvents.loginAt} = (
            SELECT MAX(le2.loginAt) FROM login_events le2 WHERE le2.userId = ${loginEvents.userId}
          ) THEN ${loginEvents.ipAddress} END)`,
          lastCountry: sql<string | null>`MAX(CASE WHEN ${loginEvents.loginAt} = (
            SELECT MAX(le2.loginAt) FROM login_events le2 WHERE le2.userId = ${loginEvents.userId}
          ) THEN ${loginEvents.country} END)`,
          lastLoginAt: sql<Date>`MAX(${loginEvents.loginAt})`,
          loginCount: sql<number>`COUNT(*)`,
        })
        .from(loginEvents)
        .where(loginStatsConds.length > 0 ? and(...loginStatsConds) : undefined)
        .groupBy(loginEvents.userId);

      const statsMap = new Map(loginStats.map((s) => [s.userId, s]));

      const rows = allUsers.map((u) => {
        const stats = statsMap.get(String(u.id));
        return {
          userId: String(u.id),
          name: u.name,
          email: u.email,
          lastIp: stats?.lastIp ?? null,
          lastCountry: stats?.lastCountry ?? null,
          lastLoginAt: stats?.lastLoginAt ?? null,
          loginCount: stats ? Number(stats.loginCount) : 0,
        };
      });

      // Sort
      rows.sort((a, b) => {
        if (sortBy === "loginCount") {
          return sortDir === "desc" ? b.loginCount - a.loginCount : a.loginCount - b.loginCount;
        }
        // lastLoginAt
        if (!a.lastLoginAt && !b.lastLoginAt) return 0;
        if (!a.lastLoginAt) return sortDir === "desc" ? 1 : -1;
        if (!b.lastLoginAt) return sortDir === "desc" ? -1 : 1;
        const diff = new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime();
        return sortDir === "desc" ? diff : -diff;
      });

      const total = rows.length;
      const pagedRows = rows.slice(offset, offset + limit);

      // Count email-sourced signals in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const emailSignalRows = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(dealSignals)
        .where(
          and(
            eq(dealSignals.source, "email"),
            sql`${dealSignals.createdAt} >= ${thirtyDaysAgo}`
          )
        );
      const emailSignalCount = Number(emailSignalRows[0]?.count ?? 0);

      return { rows: pagedRows, total, emailSignalCount };
    }),

    // Per-user login history — last 5 events
    getUserLoginHistory: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        return db
          .select({
            id: loginEvents.id,
            ipAddress: loginEvents.ipAddress,
            country: loginEvents.country,
            loginAt: loginEvents.loginAt,
          })
          .from(loginEvents)
          .where(eq(loginEvents.userId, input.userId))
          .orderBy(desc(loginEvents.loginAt))
          .limit(5);
      }),
    // Login Events — paginated list with filters
    listLoginEvents: protectedProcedure
      .input(z.object({
        limit:    z.number().min(1).max(100).default(20),
        offset:   z.number().min(0).default(0),
        email:    z.string().optional(),
        country:  z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo:   z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) return { rows: [], total: 0 };

        const limit   = Math.min(input?.limit  ?? 20, 100);
        const offset  = input?.offset ?? 0;
        const email   = input?.email?.trim();
        const country = input?.country?.trim();
        const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : undefined;
        const dateTo   = input?.dateTo   ? new Date(input.dateTo)   : undefined;

        const conds = [];
        if (email)   conds.push(like(loginEvents.email, `%${email}%`));
        if (country) conds.push(eq(loginEvents.country, country));
        if (dateFrom) conds.push(gte(loginEvents.loginAt, dateFrom));
        if (dateTo)   conds.push(lte(loginEvents.loginAt, dateTo));

        const whereClause = conds.length > 0 ? and(...conds) : undefined;

        const [totalRow, rows] = await Promise.all([
          db.select({ count: sql<number>`COUNT(*)` }).from(loginEvents).where(whereClause),
          db.select({
            id:        loginEvents.id,
            userId:    loginEvents.userId,
            email:     loginEvents.email,
            ipAddress: loginEvents.ipAddress,
            country:   loginEvents.country,
            loginAt:   loginEvents.loginAt,
          })
            .from(loginEvents)
            .where(whereClause)
            .orderBy(desc(loginEvents.loginAt))
            .limit(limit)
            .offset(offset),
        ]);

        return { rows, total: Number(totalRow[0]?.count ?? 0) };
      }),

    // Fleet Evaluations — paginated list with filters
    listFleetEvaluations: protectedProcedure
      .input(z.object({
        limit:     z.number().min(1).max(100).default(50),
        offset:    z.number().min(0).default(0),
        fleetMode: z.string().optional(),
        status:    z.enum(["queued", "running", "completed", "failed"]).optional(),
        dateFrom:  z.string().optional(),
        dateTo:    z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) return { rows: [], total: 0 };

        const limit     = Math.min(input?.limit  ?? 50, 100);
        const offset    = input?.offset ?? 0;
        const fleetMode = input?.fleetMode;
        const status    = input?.status;
        const dateFrom  = input?.dateFrom ? Number(new Date(input.dateFrom)) : undefined;
        const dateTo    = input?.dateTo   ? Number(new Date(input.dateTo))   : undefined;

        const conds = [];
        if (fleetMode && fleetMode !== "all") conds.push(eq(founderAgentEvaluations.fleetMode, fleetMode));
        if (status)   conds.push(eq(founderAgentEvaluations.status, status));
        if (dateFrom) conds.push(gte(founderAgentEvaluations.createdAt, dateFrom));
        if (dateTo)   conds.push(lte(founderAgentEvaluations.createdAt, dateTo));

        const whereClause = conds.length > 0 ? and(...conds) : undefined;

        const [totalRow, rows] = await Promise.all([
          db.select({ count: sql<number>`COUNT(*)` }).from(founderAgentEvaluations).where(whereClause),
          db.select({
            id:             founderAgentEvaluations.id,
            runId:          founderAgentEvaluations.runId,
            status:         founderAgentEvaluations.status,
            fleetMode:      founderAgentEvaluations.fleetMode,
            classification: founderAgentEvaluations.classification,
            finalScore:     founderAgentEvaluations.finalScore,
            costUsd:        founderAgentEvaluations.costUsd,
            durationMs:     founderAgentEvaluations.durationMs,
            createdAt:      founderAgentEvaluations.createdAt,
          })
            .from(founderAgentEvaluations)
            .where(whereClause)
            .orderBy(desc(founderAgentEvaluations.createdAt))
            .limit(limit)
            .offset(offset),
        ]);

        return { rows, total: Number(totalRow[0]?.count ?? 0) };
      }),

    // Waitlist signups grouped by sourcePage for conversion tracking
    waitlistBySource: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db
        .select({
          sourcePage: waitlistSignups.sourcePage,
          count: sql<number>`COUNT(*)`,
        })
        .from(waitlistSignups)
        .groupBy(waitlistSignups.sourcePage)
        .orderBy(desc(sql`COUNT(*)`));
      return rows;
    }),
    // Monte Carlo Parameter Calibration — avg/min/max/spread per 5 agent signals
    mcCalibration: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Raw SQL — JSON_EXTRACT works on TiDB/MySQL JSON columns
      const [statsRow] = await db.execute(sql`
        SELECT
          AVG(JSON_EXTRACT(monteCarloDealParams, '$.market_signal'))          AS avg_market,
          MIN(JSON_EXTRACT(monteCarloDealParams, '$.market_signal'))          AS min_market,
          MAX(JSON_EXTRACT(monteCarloDealParams, '$.market_signal'))          AS max_market,
          AVG(JSON_EXTRACT(monteCarloDealParams, '$.traction'))               AS avg_traction,
          MIN(JSON_EXTRACT(monteCarloDealParams, '$.traction'))               AS min_traction,
          MAX(JSON_EXTRACT(monteCarloDealParams, '$.traction'))               AS max_traction,
          AVG(JSON_EXTRACT(monteCarloDealParams, '$.founder_signal'))         AS avg_founder,
          MIN(JSON_EXTRACT(monteCarloDealParams, '$.founder_signal'))         AS min_founder,
          MAX(JSON_EXTRACT(monteCarloDealParams, '$.founder_signal'))         AS max_founder,
          AVG(JSON_EXTRACT(monteCarloDealParams, '$.business_model_clarity')) AS avg_biz,
          MIN(JSON_EXTRACT(monteCarloDealParams, '$.business_model_clarity')) AS min_biz,
          MAX(JSON_EXTRACT(monteCarloDealParams, '$.business_model_clarity')) AS max_biz,
          AVG(JSON_EXTRACT(monteCarloDealParams, '$.risk_level'))             AS avg_risk,
          MIN(JSON_EXTRACT(monteCarloDealParams, '$.risk_level'))             AS min_risk,
          MAX(JSON_EXTRACT(monteCarloDealParams, '$.risk_level'))             AS max_risk,
          COUNT(*)                                                             AS deep_count
        FROM pitch_triages
        WHERE monteCarloDealParams IS NOT NULL
      `) as unknown as [Record<string, number | null>];
      const [countRow] = await db.execute(sql`
        SELECT COUNT(*) AS quick_count
        FROM pitch_triages
        WHERE monteCarloDealParams IS NULL
      `) as unknown as [Record<string, number>];
      const r = statsRow ?? {};
      const deepCount = Number(r.deep_count ?? 0);
      const quickCount = Number(countRow?.quick_count ?? 0);
      if (deepCount === 0) return { empty: true as const, deepCount: 0, quickCount };
      const params = [
        { key: "market_signal",          label: "Market Signal",   avg: r.avg_market,   min: r.min_market,   max: r.max_market },
        { key: "traction",               label: "Traction",        avg: r.avg_traction, min: r.min_traction, max: r.max_traction },
        { key: "founder_signal",         label: "Founder Signal",  avg: r.avg_founder,  min: r.min_founder,  max: r.max_founder },
        { key: "business_model_clarity", label: "Business Model",  avg: r.avg_biz,      min: r.min_biz,      max: r.max_biz },
        { key: "risk_level",             label: "Risk Level",      avg: r.avg_risk,     min: r.min_risk,     max: r.max_risk },
      ].map((p) => ({
        ...p,
        avg:    Math.round(Number(p.avg ?? 0)),
        min:    Math.round(Number(p.min ?? 0)),
        max:    Math.round(Number(p.max ?? 0)),
        spread: Math.round(Number(p.max ?? 0) - Number(p.min ?? 0)),
      }));
      const highestSpread = params.reduce((a, b) => (b.spread > a.spread ? b : a));
      return { empty: false as const, params, highestSpread: highestSpread.label, deepCount, quickCount };
    }),
  }),
  // ── Unsubscribe — public token-based email opt-out ──────────────────────────
  unsubscribe: router({
    // Check if a token is valid and whether the user is already unsubscribed
    checkToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [user] = await db
          .select({ id: users.id, emailUnsubscribed: users.emailUnsubscribed })
          .from(users)
          .where(eq(users.unsubscribeToken, input.token))
          .limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid unsubscribe token" });
        return { valid: true, alreadyUnsubscribed: user.emailUnsubscribed };
      }),

    // Confirm unsubscribe — sets emailUnsubscribed = true
    confirm: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        reason: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.unsubscribeToken, input.token))
          .limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid unsubscribe token" });
        await db
          .update(users)
          .set({
            emailUnsubscribed: true,
            emailUnsubscribedAt: new Date(),
            unsubscribeReason: input.reason ?? null,
          })
          .where(eq(users.id, user.id));
        return { success: true };
      }),

    // Re-subscribe — clears emailUnsubscribed flag
    resubscribe: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.unsubscribeToken, input.token))
          .limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid unsubscribe token" });
        await db
          .update(users)
          .set({
            emailUnsubscribed: false,
            emailUnsubscribedAt: null,
            unsubscribeReason: null,
          })
          .where(eq(users.id, user.id));
        return { success: true };
      }),
  }),
});
export type AppRouter = typeof appRouter;
