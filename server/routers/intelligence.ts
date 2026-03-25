/**
 * Intelligence Agent Router
 * Handles: analysis, tracking, briefs, history, admin
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { intelAnalyses, intelTracked, intelHistory, intelBriefs, users } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

const AnalysisResultSchema = z.object({
  institution: z.string(),
  domain: z.string().optional(),
  aum: z.string().optional(),
  executive_summary: z.string(),
  use_cases: z.array(z.object({ title: z.string(), description: z.string(), maturity: z.string() })),
  tech_stack: z.array(z.object({ vendor: z.string(), category: z.string(), evidence: z.string() })),
  build_buy_stance: z.object({ stance: z.string(), confidence: z.string(), rationale: z.string() }),
  gtm_signals: z.array(z.object({ signal: z.string(), implication: z.string() })),
  coverage_gaps: z.array(z.string()),
  recommended_next_moves: z.array(z.object({ action: z.string(), priority: z.string(), rationale: z.string() })),
  gcc_lens: z.object({
    regulatory_alignment: z.string(),
    sovereign_ai_stance: z.string(),
    localisation_score: z.number(),
  }).optional(),
});

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert AI programme intelligence analyst specialising in GCC sovereign wealth funds, government entities, and large institutional investors. Your role is to extract structured intelligence from raw text (LinkedIn posts, articles, conference notes, press releases, internal documents) about an institution's AI programme.

Return ONLY valid JSON matching this exact schema:
{
  "institution": "string",
  "domain": "string (e.g. Sovereign Wealth Fund, Central Bank, Government Entity)",
  "aum": "string (e.g. $700B, unknown)",
  "executive_summary": "string (2-3 sentences, direct and analytical)",
  "use_cases": [{ "title": "string", "description": "string", "maturity": "Pilot|Production|Exploring|Unknown" }],
  "tech_stack": [{ "vendor": "string", "category": "string (e.g. LLM Provider, MLOps, Data Platform)", "evidence": "string" }],
  "build_buy_stance": { "stance": "Build|Buy|Hybrid|Unknown", "confidence": "High|Medium|Low", "rationale": "string" },
  "gtm_signals": [{ "signal": "string", "implication": "string (what this means for vendors/partners)" }],
  "coverage_gaps": ["string (areas with no visible AI activity)"],
  "recommended_next_moves": [{ "action": "string", "priority": "High|Medium|Low", "rationale": "string" }],
  "gcc_lens": {
    "regulatory_alignment": "string (SAMA, CBUAE, ADGM, DFSA, etc.)",
    "sovereign_ai_stance": "string",
    "localisation_score": number (0-10, 10 = fully localised Arabic AI)
  }
}

Be analytical, specific, and direct. Do not hedge or pad. If information is absent, say "Not evidenced" rather than speculating.`;

// ── Few-shot examples ─────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLES = [
  {
    role: "user" as const,
    content: `Institution: NBIM (Norges Bank Investment Management)
Text: "NBIM has deployed an internal LLM-based document analysis tool built on Azure OpenAI. The tool processes ESG reports from portfolio companies. They are exploring agentic workflows for equity research but have not committed to a vendor. The CTO mentioned at a conference that they prefer building internal capabilities over buying off-the-shelf solutions."`,
  },
  {
    role: "assistant" as const,
    content: JSON.stringify({
      institution: "NBIM",
      domain: "Sovereign Wealth Fund",
      aum: "$1.6T",
      executive_summary: "NBIM has moved beyond exploration into production deployment of LLM-based document analysis on Azure OpenAI, focused on ESG processing. Agentic equity research workflows are in early exploration with no vendor commitment, reflecting a deliberate build-first posture.",
      use_cases: [
        { title: "ESG Document Analysis", description: "LLM processes ESG reports from portfolio companies at scale", maturity: "Production" },
        { title: "Agentic Equity Research", description: "Exploring multi-step agent workflows for equity research automation", maturity: "Exploring" },
      ],
      tech_stack: [
        { vendor: "Microsoft Azure OpenAI", category: "LLM Provider", evidence: "CTO confirmed Azure OpenAI deployment" },
      ],
      build_buy_stance: { stance: "Build", confidence: "High", rationale: "CTO explicitly stated preference for internal capability building over off-the-shelf solutions" },
      gtm_signals: [
        { signal: "No vendor commitment for agentic workflows", implication: "Window open for specialised agentic platform vendors to engage before decision is made" },
      ],
      coverage_gaps: ["Trading and portfolio optimisation AI", "Natural language interfaces for fund managers", "Arabic language capability"],
      recommended_next_moves: [
        { action: "Engage CTO office with agentic workflow POC for equity research", priority: "High", rationale: "Active exploration phase with no incumbent — ideal entry point" },
      ],
      gcc_lens: { regulatory_alignment: "N/A — Norwegian sovereign fund", sovereign_ai_stance: "Build-first, data sovereignty focused", localisation_score: 1 },
    }),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchGNewsArticles(institution: string): Promise<string> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return `No NEWS_API_KEY set. Manual content required for ${institution}.`;
  try {
    const q = encodeURIComponent(`"${institution}" AI artificial intelligence technology`);
    const url = `https://gnews.io/api/v4/search?q=${q}&lang=en&max=5&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return `GNews API error ${res.status} for ${institution}.`;
    const data = await res.json() as { articles?: Array<{ title: string; description: string; publishedAt: string; source: { name: string } }> };
    if (!data.articles?.length) return `No recent news found for ${institution}.`;
    return data.articles.map((a) =>
      `[${a.publishedAt?.slice(0, 10)} · ${a.source?.name}]\n${a.title}\n${a.description ?? ""}`
    ).join("\n\n");
  } catch {
    return `Failed to fetch news for ${institution}.`;
  }
}

async function runAnalysis(institution: string, text: string, modules: string[], lens: string[]): Promise<string> {
  const moduleContext = modules.length ? `\nFocus modules: ${modules.join(", ")}` : "";
  const lensContext = lens.length ? `\nApply lens filters: ${lens.join(", ")}` : "";
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...FEW_SHOT_EXAMPLES,
      {
        role: "user",
        content: `Institution: ${institution}${moduleContext}${lensContext}\n\nText to analyse:\n${text}`,
      },
    ],
    response_format: { type: "json_object" },
  });
  return (response.choices?.[0]?.message?.content as string) ?? "{}";
}

function computeDiff(prev: Record<string, unknown>, curr: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  const prevUseCases = (prev.use_cases as Array<{ title: string }> | undefined) ?? [];
  const currUseCases = (curr.use_cases as Array<{ title: string }> | undefined) ?? [];
  const prevTitles = new Set(prevUseCases.map((u) => u.title));
  const currTitles = new Set(currUseCases.map((u) => u.title));
  const newUseCases = currUseCases.filter((u) => !prevTitles.has(u.title));
  const removedUseCases = prevUseCases.filter((u) => !currTitles.has(u.title));
  if (newUseCases.length || removedUseCases.length) {
    diff.use_cases = { added: newUseCases, removed: removedUseCases };
  }
  const prevStack = (prev.tech_stack as Array<{ vendor: string }> | undefined) ?? [];
  const currStack = (curr.tech_stack as Array<{ vendor: string }> | undefined) ?? [];
  const prevVendors = new Set(prevStack.map((t) => t.vendor));
  const currVendors = new Set(currStack.map((t) => t.vendor));
  const newVendors = currStack.filter((t) => !prevVendors.has(t.vendor));
  const removedVendors = prevStack.filter((t) => !currVendors.has(t.vendor));
  if (newVendors.length || removedVendors.length) {
    diff.tech_stack = { added: newVendors, removed: removedVendors };
  }
  const prevStance = (prev.build_buy_stance as { stance?: string } | undefined)?.stance;
  const currStance = (curr.build_buy_stance as { stance?: string } | undefined)?.stance;
  if (prevStance !== currStance) {
    diff.build_buy_stance = { from: prevStance, to: currStance };
  }
  return diff;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const intelligenceRouter = router({
  // Run a new analysis
  analyse: protectedProcedure
    .input(z.object({
      institution: z.string().min(1),
      domain: z.string().optional(),
      aum: z.string().optional(),
      text: z.string().min(10),
      modules: z.array(z.string()).default([]),
      lens: z.array(z.string()).default([]),
      isInternal: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const resultRaw = await runAnalysis(input.institution, input.text, input.modules, input.lens);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [inserted] = await db.insert(intelAnalyses).values({
        userId: ctx.user.id,
        institution: input.institution,
        domain: input.domain,
        aum: input.aum,
        inputText: input.text.slice(0, 8000),
        result: resultRaw,
        modules: JSON.stringify(input.modules),
        lens: JSON.stringify(input.lens),
        isInternal: input.isInternal,
      });
      return { id: (inserted as { insertId?: number })?.insertId, result: JSON.parse(resultRaw) };
    }),

  // List user's past analyses
  listAnalyses: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(intelAnalyses)
        .where(eq(intelAnalyses.userId, ctx.user.id))
        .orderBy(desc(intelAnalyses.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // Get a single analysis
  getAnalysis: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(intelAnalyses)
        .where(and(eq(intelAnalyses.id, input.id), eq(intelAnalyses.userId, ctx.user.id)))
        .limit(1);
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
      return rows[0];
    }),

  // Track an institution
  trackInstitution: protectedProcedure
    .input(z.object({
      institution: z.string().min(1),
      domain: z.string().optional(),
      aum: z.string().optional(),
      initialAnalysisId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Check if already tracked
      const existing = await db.select().from(intelTracked)
        .where(and(eq(intelTracked.userId, ctx.user.id), eq(intelTracked.institution, input.institution)))
        .limit(1);
      if (existing.length) return { id: existing[0].id, alreadyTracked: true };
      let lastAnalysis: string | undefined;
      if (input.initialAnalysisId) {
        const rows = await db.select().from(intelAnalyses)
          .where(and(eq(intelAnalyses.id, input.initialAnalysisId), eq(intelAnalyses.userId, ctx.user.id)))
          .limit(1);
        if (rows.length) lastAnalysis = rows[0].result;
      }
      const [ins] = await db.insert(intelTracked).values({
        userId: ctx.user.id,
        institution: input.institution,
        domain: input.domain,
        aum: input.aum,
        lastAnalysis,
      });
      return { id: (ins as { insertId?: number })?.insertId, alreadyTracked: false };
    }),

  // List tracked institutions
  listTracked: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(intelTracked)
      .where(eq(intelTracked.userId, ctx.user.id))
      .orderBy(desc(intelTracked.updatedAt));
  }),

  // Untrack an institution
  untrack: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(intelTracked)
        .where(and(eq(intelTracked.id, input.id), eq(intelTracked.userId, ctx.user.id)));
      return { success: true };
    }),

  // Refresh a tracked institution (fetch news + re-analyse)
  refreshTracked: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db.select().from(intelTracked)
        .where(and(eq(intelTracked.id, input.id), eq(intelTracked.userId, ctx.user.id)))
        .limit(1);
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND" });
      const tracked = rows[0];
      const newsContent = await fetchGNewsArticles(tracked.institution);
      const resultRaw = await runAnalysis(tracked.institution, newsContent, [], []);
      const newResult = JSON.parse(resultRaw);
      // Compute diff
      let diff: Record<string, unknown> = {};
      if (tracked.lastAnalysis) {
        try {
          const prevResult = JSON.parse(tracked.lastAnalysis);
          diff = computeDiff(prevResult, newResult);
        } catch { /* ignore */ }
      }
      // Save to history
      await db.insert(intelHistory).values({
        trackedInstitutionId: tracked.id,
        result: resultRaw,
        diff: JSON.stringify(diff),
        fetchedContent: newsContent.slice(0, 4000),
      });
      // Update tracked record
      await db.update(intelTracked)
        .set({ lastAnalysis: resultRaw, lastFetchedContent: newsContent.slice(0, 4000) })
        .where(eq(intelTracked.id, tracked.id));
      return { result: newResult, diff, newsContent };
    }),

  // Get tracking history for an institution
  getTrackingHistory: protectedProcedure
    .input(z.object({ trackedId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Verify ownership
      const tracked = await db.select().from(intelTracked)
        .where(and(eq(intelTracked.id, input.trackedId), eq(intelTracked.userId, ctx.user.id)))
        .limit(1);
      if (!tracked.length) throw new TRPCError({ code: "NOT_FOUND" });
      return db.select().from(intelHistory)
        .where(eq(intelHistory.trackedInstitutionId, input.trackedId))
        .orderBy(desc(intelHistory.createdAt))
        .limit(20);
    }),

  // Generate a weekly brief
  generateBrief: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const tracked = await db.select().from(intelTracked)
      .where(eq(intelTracked.userId, ctx.user.id));
    if (!tracked.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No tracked institutions" });
    const summaries = tracked.map((t) => {
      let result: Record<string, unknown> = {};
      try { result = JSON.parse(t.lastAnalysis ?? "{}"); } catch { /* ignore */ }
      return `## ${t.institution}\n${(result.executive_summary as string) ?? "No analysis yet."}\nKey signals: ${JSON.stringify(result.gtm_signals ?? [])}`;
    }).join("\n\n");
    const briefResponse = await invokeLLM({
      messages: [
        { role: "system", content: "You are an institutional AI intelligence editor. Write a concise weekly brief summarising AI programme developments across tracked institutions. Be analytical, not descriptive. Highlight trends, emerging patterns, and actionable signals for vendors and partners. Return JSON: { headline: string, trend_analysis: string, institution_summaries: [{institution: string, headline: string, key_signal: string}], recommended_actions: string[] }" },
        { role: "user", content: `Week of ${new Date().toISOString().slice(0, 10)}\n\nTracked institutions:\n${summaries}` },
      ],
      response_format: { type: "json_object" },
    });
    const content = (briefResponse.choices?.[0]?.message?.content as string) ?? "{}";
    const [ins] = await db.insert(intelBriefs).values({
      userId: ctx.user.id,
      content,
      weekOf: new Date(),
    });

    // Send email via Resend if configured
    const resendKey = process.env.RESEND_API_KEY;
    const userRows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    const userEmail = userRows[0]?.email;
    if (resendKey && userEmail) {
      try {
        const briefData = JSON.parse(content) as { headline?: string; trend_analysis?: string; institution_summaries?: Array<{ institution: string; headline: string; key_signal: string }>; recommended_actions?: string[] };
        const html = `
          <div style="font-family: 'Inter', sans-serif; max-width: 680px; margin: 0 auto; background: #0B1629; color: #E2E8F0; padding: 40px 32px; border-radius: 12px;">
            <div style="font-size: 11px; color: #7BA3D4; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; font-weight: 600;">AgenThinkMesh Intelligence</div>
            <h1 style="font-size: 22px; font-weight: 800; color: #F0F4FA; margin: 0 0 8px;">${briefData.headline ?? "Weekly Intelligence Brief"}</h1>
            <div style="font-size: 12px; color: #64748B; margin-bottom: 28px;">Week of ${new Date().toISOString().slice(0, 10)}</div>
            <div style="background: rgba(123,163,212,0.08); border: 1px solid rgba(123,163,212,0.2); border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <div style="font-size: 11px; color: #7BA3D4; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">Trend Analysis</div>
              <p style="font-size: 14px; color: #CBD5E1; line-height: 1.7; margin: 0;">${briefData.trend_analysis ?? ""}</p>
            </div>
            ${(briefData.institution_summaries ?? []).map((s) => `
              <div style="border-left: 3px solid #7BA3D4; padding-left: 16px; margin-bottom: 20px;">
                <div style="font-size: 13px; font-weight: 700; color: #F0F4FA; margin-bottom: 4px;">${s.institution}</div>
                <div style="font-size: 13px; color: #94A3B8; margin-bottom: 4px;">${s.headline}</div>
                <div style="font-size: 11px; color: #7BA3D4;">Signal: ${s.key_signal}</div>
              </div>
            `).join("")}
            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid rgba(123,163,212,0.15);">
              <div style="font-size: 11px; color: #7BA3D4; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">Recommended Actions</div>
              ${(briefData.recommended_actions ?? []).map((a) => `<div style="font-size: 13px; color: #CBD5E1; margin-bottom: 8px; padding-left: 12px; border-left: 2px solid rgba(123,163,212,0.3);">${a}</div>`).join("")}
            </div>
          </div>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "AgenThinkMesh Intelligence <onboarding@resend.dev>",
            to: [userEmail],
            subject: `Weekly Intelligence Brief — ${new Date().toISOString().slice(0, 10)}`,
            html,
          }),
        });
      } catch { /* email failure is non-fatal */ }
    }

    return { id: (ins as { insertId?: number })?.insertId, content: JSON.parse(content) };
  }),

  // List briefs
  listBriefs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(intelBriefs)
      .where(eq(intelBriefs.userId, ctx.user.id))
      .orderBy(desc(intelBriefs.createdAt))
      .limit(20);
  }),

  // Admin: list all analyses across all users
  adminListAnalyses: protectedProcedure
    .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) return [];
      return db.select().from(intelAnalyses)
        .orderBy(desc(intelAnalyses.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),
});
