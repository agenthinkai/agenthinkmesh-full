/**
 * Mesh Identity Layer — 3-Stage Personalisation Router
 *
 * Stage 1: classifyPersona  — runs once at signup when user selects their tile
 * Stage 2: inferFromFirstQuery — runs silently on the user's first message
 * Stage 3: refineSession    — runs silently every 5 completed sessions
 *
 * All three stages read/write the same userProfile record.
 * Users never see the words "persona", "profile", or "identity" in the UI.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userProfiles } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function safeContent(res: Awaited<ReturnType<typeof invokeLLM>>): string {
  const raw = res?.choices?.[0]?.message?.content;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  // Array of content parts — join text parts
  return raw.map((p: { type: string; text?: string }) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

function parseJsonContent<T>(content: string, fallback: T): T {
  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ── Stage 1 Prompt ────────────────────────────────────────────────────────────

const STAGE1_SYSTEM = `You are the Mesh Identity Engine for AgenThinkMesh, an institutional AI agent platform.

A new user has just signed up and selected their professional profile.

Your job is to:
1. Confirm the persona
2. Return a JSON profile mapping them to the correct agent bundle, workflows, and tone

Return ONLY valid JSON in this exact structure — no preamble, no markdown:
{
  "persona": "",
  "agent_bundle": [],
  "suggested_workflows": [],
  "tone": "",
  "domain_tags": [],
  "upgrade_path": ""
}

Persona mappings:

BANKER → agents: [KYC/AML Flag Agent, Credit Scorer, GCC Regulatory Monitor, Sanctions Screener, Earnings Summarizer], workflows: [Credit Memo, Compliance Review], tone: formal, domain_tags: [finance, compliance, GCC]

FUND MANAGER → agents: [Deal Screener, Portfolio Intelligence, Macro Monitor, Equity Screener, Oil Price Sensitivity], workflows: [GCC Equity Review, Portfolio Report], tone: institutional, domain_tags: [finance, investment, GCC]

INVESTMENT MANAGER → agents: [Portfolio Intelligence, Sovereign Wealth Tracker, FX Monitor, IPO Pipeline Tracker, Family Office Analyzer], workflows: [Asset Allocation Review, AUM Report], tone: institutional, domain_tags: [investment, portfolio, GCC]

INVESTMENT ANALYST → agents: [DCF Modeler, Earnings Call Summarizer, Equity Screener, Arabic Earnings Extractor, Macro Monitor], workflows: [Company Deep Dive, Sector Analysis], tone: analytical, domain_tags: [research, finance, modeling]

DOCTOR → agents: [Drug Interaction Checker, Clinical Summary Agent, ICD Coder, Patient Report Builder, Medical Literature Summarizer], workflows: [Patient Report, Clinical Review], tone: clinical, domain_tags: [healthcare, medical, clinical]

STUDENT → agents: [Research Assistant, Citation Builder, Concept Explainer, Literature Summarizer, Study Planner], workflows: [Literature Review, Essay Outline], tone: educational, domain_tags: [academic, research, learning]

LAWYER → agents: [Arabic Legal Clause Extractor, Contract Risk Scorer, ADGM Regulatory Monitor, Kuwait CMA Compliance Checker, Due Diligence Agent], workflows: [Contract Review, Regulatory Filing], tone: precise, domain_tags: [legal, compliance, GCC]

RETAILER → agents: [Demand Forecasting Agent, Inventory Optimizer, Supplier Risk Scorer, Customer Sentiment Analyzer, Pricing Intelligence Agent], workflows: [Inventory Review, Supplier Assessment], tone: operational, domain_tags: [retail, supply chain, operations]

OFFICE CLERK → agents: [Document Summarizer, Email Drafter, Meeting Notes Agent, Task Prioritizer, Form Filler], workflows: [Daily Briefing, Document Processing], tone: simple, domain_tags: [productivity, admin, documents]

MANAGER → agents: [Team Performance Analyzer, Project Tracker, KPI Dashboard Agent, Meeting Summarizer, Risk Flagging Agent], workflows: [Weekly Briefing, Performance Review], tone: executive, domain_tags: [management, operations, strategy]

MARKETING MANAGER → agents: [Campaign Analyzer, Audience Segmenter, Content Brief Generator, Competitor Monitor, Social Sentiment Tracker], workflows: [Campaign Review, Content Calendar], tone: creative, domain_tags: [marketing, content, brand]

ENTERPRISE → agents: [Workflow Automator, Document Intelligence Agent, Multi-Domain Router, Compliance Monitor, API Integration Agent], workflows: [Enterprise Onboarding, Process Audit], tone: formal, domain_tags: [enterprise, automation, compliance]

OTHER → agents: [General Research Agent, Document Summarizer, Task Assistant, Web Research Agent, Report Builder], workflows: [General Research, Document Review], tone: neutral, domain_tags: [general]`;

// ── Stage 2 Prompt ────────────────────────────────────────────────────────────

const STAGE2_SYSTEM = `You are the Mesh Identity Inference Engine for AgenThinkMesh.

Your job:
1. Analyze the query for professional intent, domain signals, and sophistication level
2. Determine if the query confirms or contradicts the signup persona
3. Return a refined profile silently — never explain this to the user

Scoring rules:
- Query strongly matches base_persona → confidence: HIGH, keep persona
- Query partially matches → confidence: MEDIUM, keep persona, add secondary tags
- Query contradicts base_persona → confidence: LOW, override with inferred persona

Return ONLY valid JSON — no preamble, no markdown:
{
  "base_persona": "",
  "inferred_persona": "",
  "confidence": "HIGH | MEDIUM | LOW",
  "override": true,
  "active_persona": "",
  "query_domain_tags": [],
  "recommended_agents": [],
  "persona_note": ""
}

Domain signal reference:
- "sukuk", "murabaha", "ijara", "zakat", "shariah" → Islamic Finance
- "DCF", "EBITDA", "equity", "portfolio", "AUM" → Investment / Finance
- "patient", "diagnosis", "drug", "clinical", "ICD" → Healthcare
- "contract", "clause", "liability", "jurisdiction" → Legal
- "inventory", "supplier", "SKU", "margin" → Retail
- "campaign", "CTR", "audience", "content", "brand" → Marketing
- "memo", "meeting", "schedule", "filing", "report" → Admin / Clerk
- "valuation", "model", "comps", "sector" → Investment Analyst
- "AUM", "allocation", "mandate", "fund", "returns" → Investment / Fund Manager`;

// ── Stage 3 Prompt ────────────────────────────────────────────────────────────

const STAGE3_SYSTEM = `You are the Mesh Profile Refinement Engine for AgenThinkMesh.

Your job:
1. Detect if the user has drifted toward a different persona or sub-specialty
2. Identify their single most-used domain
3. Decide if a homepage reorder or agent bundle update is warranted
4. Generate one optional nudge message only if confidence is HIGH

Return ONLY valid JSON — no preamble, no markdown:
{
  "current_persona": "",
  "refined_persona": "",
  "persona_drift": false,
  "dominant_domain": "",
  "agent_bundle_update": [],
  "homepage_reorder": false,
  "nudge_message": ""
}

Nudge message rules:
- Maximum 12 words
- Conversational, not salesy
- Only trigger if user has used domain-specific agents 3+ times consistently
- Return empty string "" if no nudge is warranted
- Example: "You seem focused on Islamic finance — prioritize those agents?"`;

// ── Router ────────────────────────────────────────────────────────────────────

export const identityRouter = router({
  /**
   * Stage 1 — Signup Classifier
   * Called when user selects their persona tile.
   * Creates or replaces the userProfile record.
   */
  classifyPersona: protectedProcedure
    .input(z.object({ selectedPersona: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const res = await invokeLLM({
        messages: [
          { role: "system" as const, content: STAGE1_SYSTEM },
          { role: "user" as const, content: `Now generate the profile JSON for: ${input.selectedPersona}` },
        ],
        response_format: { type: "json_object" },
      });

      const content = safeContent(res);
      const profile = parseJsonContent<{
        persona: string;
        agent_bundle: string[];
        suggested_workflows: string[];
        tone: string;
        domain_tags: string[];
        upgrade_path: string;
      }>(content, {
        persona: input.selectedPersona,
        agent_bundle: [],
        suggested_workflows: [],
        tone: "neutral",
        domain_tags: ["general"],
        upgrade_path: "",
      });

      // Upsert userProfile
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const existing = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);

      if (existing.length > 0) {
        await db.update(userProfiles)
          .set({
            basePersona: profile.persona,
            activePersona: profile.persona,
            agentBundle: JSON.stringify(profile.agent_bundle),
            suggestedWorkflows: JSON.stringify(profile.suggested_workflows),
            tone: profile.tone,
            domainTags: JSON.stringify(profile.domain_tags),
            confidence: "HIGH",
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, userId));
      } else {
        await db.insert(userProfiles).values({
          userId,
          basePersona: profile.persona,
          activePersona: profile.persona,
          agentBundle: JSON.stringify(profile.agent_bundle),
          suggestedWorkflows: JSON.stringify(profile.suggested_workflows),
          tone: profile.tone,
          domainTags: JSON.stringify(profile.domain_tags),
          confidence: "HIGH",
          sessionCount: 0,
          personaDrift: false,
          homepageReorder: false,
        });
      }

      return { success: true, profile };
    }),

  /**
   * Stage 2 — First Query Inference
   * Called silently on the user's very first message.
   * Cross-references query against Stage 1 persona. User never sees this.
   */
  inferFromFirstQuery: protectedProcedure
    .input(z.object({ firstQuery: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      if (existing.length === 0) return { success: false };

      const profile = existing[0];
      const basePersona = profile.basePersona ?? "OTHER";

      const res = await invokeLLM({
        messages: [
          { role: "system" as const, content: STAGE2_SYSTEM },
          {
            role: "user" as const,
            content: `User signed up as: ${basePersona}\nTheir first query: "${input.firstQuery}"\n\nNow analyze the query and return the refined profile.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = safeContent(res);
      const inference = parseJsonContent<{
        base_persona: string;
        inferred_persona: string;
        confidence: string;
        override: boolean;
        active_persona: string;
        query_domain_tags: string[];
        recommended_agents: string[];
        persona_note: string;
      }>(content, {
        base_persona: basePersona,
        inferred_persona: basePersona,
        confidence: "HIGH",
        override: false,
        active_persona: basePersona,
        query_domain_tags: [],
        recommended_agents: [],
        persona_note: "",
      });

      // Update the profile with inference results
      const newActivePersona = inference.override ? inference.inferred_persona : basePersona;
      const currentDomainTagFreq = safeJson<Record<string, number>>(profile.domainTagFrequency, {});

      // Increment domain tag frequency
      for (const tag of inference.query_domain_tags) {
        currentDomainTagFreq[tag] = (currentDomainTagFreq[tag] ?? 0) + 1;
      }

      await db.update(userProfiles)
        .set({
          activePersona: newActivePersona,
          queryDomainTags: JSON.stringify(inference.query_domain_tags),
          confidence: (inference.confidence as "HIGH" | "MEDIUM" | "LOW") ?? "HIGH",
          domainTagFrequency: JSON.stringify(currentDomainTagFreq),
          sessionCount: (profile.sessionCount ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));

      return { success: true, activePersona: newActivePersona };
    }),

  /**
   * Stage 3 — Session Refinement
   * Called silently every 5 completed sessions.
   * Detects persona drift and updates agent bundle + homepage order.
   */
  refineSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      if (existing.length === 0) return { success: false };

      const profile = existing[0];

      const agentsUsedList = safeJson<string[]>(profile.agentsUsedList, []);
      const domainTagFrequency = safeJson<Record<string, number>>(profile.domainTagFrequency, {});
      const workflowsCompleted = safeJson<string[]>(profile.workflowsCompleted, []);

      const res = await invokeLLM({
        messages: [
          { role: "system" as const, content: STAGE3_SYSTEM },
          {
            role: "user" as const,
            content: `User profile:
- Active persona: ${profile.activePersona ?? "OTHER"}
- Sessions completed: ${profile.sessionCount ?? 0}
- Agents used: ${agentsUsedList.join(", ") || "none"}
- Top query domains: ${JSON.stringify(domainTagFrequency)}
- Workflows completed: ${workflowsCompleted.join(", ") || "none"}

Now analyze this profile and return the refinement.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = safeContent(res);
      const refinement = parseJsonContent<{
        current_persona: string;
        refined_persona: string;
        persona_drift: boolean;
        dominant_domain: string;
        agent_bundle_update: string[];
        homepage_reorder: boolean;
        nudge_message: string;
      }>(content, {
        current_persona: profile.activePersona ?? "OTHER",
        refined_persona: profile.activePersona ?? "OTHER",
        persona_drift: false,
        dominant_domain: "",
        agent_bundle_update: [],
        homepage_reorder: false,
        nudge_message: "",
      });

      await db.update(userProfiles)
        .set({
          activePersona: refinement.refined_persona || profile.activePersona,
          personaDrift: refinement.persona_drift,
          dominantDomain: refinement.dominant_domain || undefined,
          agentBundle: refinement.agent_bundle_update.length > 0
            ? JSON.stringify(refinement.agent_bundle_update)
            : profile.agentBundle,
          homepageReorder: refinement.homepage_reorder,
          nudgeMessage: refinement.nudge_message || null,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));

      return {
        success: true,
        personaDrift: refinement.persona_drift,
        nudgeMessage: refinement.nudge_message || null,
      };
    }),

  /**
   * Read the current userProfile for the authenticated user.
   */
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      if (rows.length === 0) return null;

      const p = rows[0];
      return {
        ...p,
        agentBundle: safeJson<string[]>(p.agentBundle, []),
        suggestedWorkflows: safeJson<string[]>(p.suggestedWorkflows, []),
        domainTags: safeJson<string[]>(p.domainTags, []),
        queryDomainTags: safeJson<string[]>(p.queryDomainTags, []),
        agentsUsedList: safeJson<string[]>(p.agentsUsedList, []),
        domainTagFrequency: safeJson<Record<string, number>>(p.domainTagFrequency, {}),
        workflowsCompleted: safeJson<string[]>(p.workflowsCompleted, []),
      };
    }),

  /**
   * Dismiss the nudge banner — clears nudgeMessage after it has been shown once.
   */
  dismissNudge: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.update(userProfiles)
        .set({ nudgeMessage: null, updatedAt: new Date() })
        .where(eq(userProfiles.userId, ctx.user.id));
      return { success: true };
    }),

  /**
   * Increment session count and append agents used — called after each completed task.
   */
  recordSession: protectedProcedure
    .input(z.object({
      agentsUsed: z.array(z.string()).optional(),
      workflowCompleted: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) return { success: false };
      const rows = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
      if (rows.length === 0) return { success: false };

      const p = rows[0];
      const currentAgents = safeJson<string[]>(p.agentsUsedList, []);
      const currentWorkflows = safeJson<string[]>(p.workflowsCompleted, []);
      const currentDomainFreq = safeJson<Record<string, number>>(p.domainTagFrequency, {});

      if (input.agentsUsed) {
        currentAgents.push(...input.agentsUsed);
      }
      if (input.workflowCompleted) {
        currentWorkflows.push(input.workflowCompleted);
      }

      await db.update(userProfiles)
        .set({
          sessionCount: (p.sessionCount ?? 0) + 1,
          agentsUsedList: JSON.stringify(currentAgents),
          workflowsCompleted: JSON.stringify(currentWorkflows),
          domainTagFrequency: JSON.stringify(currentDomainFreq),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));

      return { success: true, newSessionCount: (p.sessionCount ?? 0) + 1 };
    }),
});
