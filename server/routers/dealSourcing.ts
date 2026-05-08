/**
 * dealSourcing.ts — Deal Sourcing Test Fleet
 *
 * Architecture:
 *   Source Layer  → 4 agents generate candidate deals (seeded_test / manual / pattern_match / public_signal)
 *   Quick Triage  → 3-agent lightweight council scores each candidate (Market Signal, Business Model, Traction)
 *   Promotion     → Top-5 candidates auto-routed into existing Deal Screener full council
 *
 * Constraints:
 *   - No live web scraping; V1 uses seeded/generated candidates only
 *   - All generated deals labelled "TEST CANDIDATE"
 *   - Does NOT modify Deal Screener, SADO, UAE Real Estate, or AI Audit logic
 *   - No new dependencies
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and, inArray } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dealSources, dealScreenings } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { runCouncil } from "../councilEngine";
import { randomUUID } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedCandidate {
  companyName: string;
  sector: string;
  region: string;
  summary: string;
  relevanceReason: string;
  rawInput: string;
}

interface TriageAgentResult {
  agentName: string;
  score: number;          // 0–100
  reasoning: string;
  recommendation: "PROMOTE" | "WATCH" | "IGNORE";
}

interface QuickTriageResult {
  agents: TriageAgentResult[];
  triageScore: number;    // 0–100 weighted average
  triageReasoning: string;
  recommendation: "PROMOTE" | "WATCH" | "IGNORE";
}

// ── Source Agents ─────────────────────────────────────────────────────────────

/**
 * Startup News Agent — generates public-signal-style candidates
 */
async function runStartupNewsAgent(count: number): Promise<GeneratedCandidate[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a deal sourcing agent for a GCC-focused venture capital and private equity firm.
Generate realistic TEST CANDIDATE startup opportunities based on public-signal patterns.
Focus on: AI infra, B2B SaaS, GCC enterprise, compliance/governance, fintech, sovereign infrastructure.
All candidates must be clearly labelled as TEST CANDIDATE for internal testing only.
Return strict JSON only — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Generate ${count} startup deal candidates as a JSON array.
Each object must have:
{
  "companyName": string,
  "sector": string (one of: "AI Infrastructure" | "B2B SaaS" | "Fintech" | "GCC Enterprise" | "Compliance/Governance" | "Sovereign Infrastructure" | "Healthtech" | "Proptech"),
  "region": string (one of: "Saudi Arabia" | "UAE" | "Kuwait" | "Qatar" | "Bahrain" | "Oman" | "GCC" | "MENA"),
  "summary": string (2-3 sentences describing the company and its product),
  "relevanceReason": string (1 sentence why this fits GCC investment thesis),
  "rawInput": string (brief pitch-style text, 80-120 words)
}
Return only the JSON array. No markdown fences.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "candidates",
        strict: true,
        schema: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  companyName: { type: "string" },
                  sector: { type: "string" },
                  region: { type: "string" },
                  summary: { type: "string" },
                  relevanceReason: { type: "string" },
                  rawInput: { type: "string" },
                },
                required: ["companyName", "sector", "region", "summary", "relevanceReason", "rawInput"],
                additionalProperties: false,
              },
            },
          },
          required: ["candidates"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { candidates: GeneratedCandidate[] };
    return parsed.candidates ?? [];
  } catch {
    return [];
  }
}

/**
 * Pattern Match Agent — finds opportunities similar to historically strong deal patterns
 */
async function runPatternMatchAgent(count: number): Promise<GeneratedCandidate[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a pattern recognition agent for a GCC-focused VC/PE firm.
Identify startup candidates that match historically strong deal patterns in the GCC region.
Patterns to match: AI infra, B2B SaaS, GCC enterprise, compliance/governance, fintech, sovereign infrastructure.
All candidates are TEST CANDIDATES for internal testing.
Return strict JSON only.`,
      },
      {
        role: "user",
        content: `Generate ${count} pattern-matched deal candidates as a JSON array.
Each object:
{
  "companyName": string,
  "sector": string,
  "region": string,
  "summary": string,
  "relevanceReason": string (explain which historical pattern this matches),
  "rawInput": string (80-120 word pitch)
}
Return only the JSON array.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "candidates",
        strict: true,
        schema: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  companyName: { type: "string" },
                  sector: { type: "string" },
                  region: { type: "string" },
                  summary: { type: "string" },
                  relevanceReason: { type: "string" },
                  rawInput: { type: "string" },
                },
                required: ["companyName", "sector", "region", "summary", "relevanceReason", "rawInput"],
                additionalProperties: false,
              },
            },
          },
          required: ["candidates"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { candidates: GeneratedCandidate[] };
    return parsed.candidates ?? [];
  } catch {
    return [];
  }
}

/**
 * Sector Thesis Agent — generates candidates aligned with predefined investment theses
 */
async function runSectorThesisAgent(count: number): Promise<GeneratedCandidate[]> {
  const THESES = [
    "GCC sovereign cloud and data localisation infrastructure",
    "AI-native compliance and regulatory technology for MENA financial institutions",
    "B2B SaaS for GCC enterprise digital transformation (ERP, HR, supply chain)",
    "Fintech infrastructure for Islamic finance and Shariah-compliant products",
    "Healthtech and digital health platforms for GCC government healthcare mandates",
  ];

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are a sector thesis agent for a GCC-focused VC/PE firm.
Generate startup candidates that directly address one of the firm's investment theses.
All candidates are TEST CANDIDATES for internal testing.
Return strict JSON only.`,
      },
      {
        role: "user",
        content: `Investment theses:
${THESES.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Generate ${count} thesis-aligned deal candidates as a JSON array.
Each object:
{
  "companyName": string,
  "sector": string,
  "region": string,
  "summary": string,
  "relevanceReason": string (cite which thesis number this addresses),
  "rawInput": string (80-120 word pitch)
}
Return only the JSON array.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "candidates",
        strict: true,
        schema: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  companyName: { type: "string" },
                  sector: { type: "string" },
                  region: { type: "string" },
                  summary: { type: "string" },
                  relevanceReason: { type: "string" },
                  rawInput: { type: "string" },
                },
                required: ["companyName", "sector", "region", "summary", "relevanceReason", "rawInput"],
                additionalProperties: false,
              },
            },
          },
          required: ["candidates"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { candidates: GeneratedCandidate[] };
    return parsed.candidates ?? [];
  } catch {
    return [];
  }
}

// ── Quick Triage Council ──────────────────────────────────────────────────────

async function runQuickTriage(candidate: GeneratedCandidate): Promise<QuickTriageResult> {
  const TRIAGE_AGENTS = [
    {
      name: "Market Signal",
      prompt: `You are the Market Signal agent. Evaluate the market opportunity and timing for this deal candidate.
Score 0-100 based on: market size, growth trajectory, GCC market fit, timing, competitive landscape.
Return strict JSON: {"score": number, "reasoning": string (2 sentences), "recommendation": "PROMOTE"|"WATCH"|"IGNORE"}`,
    },
    {
      name: "Business Model",
      prompt: `You are the Business Model agent. Evaluate the business model quality and scalability.
Score 0-100 based on: revenue model clarity, unit economics potential, scalability, defensibility, GCC enterprise readiness.
Return strict JSON: {"score": number, "reasoning": string (2 sentences), "recommendation": "PROMOTE"|"WATCH"|"IGNORE"}`,
    },
    {
      name: "Traction",
      prompt: `You are the Traction agent. Evaluate evidence of traction and execution capability.
Score 0-100 based on: customer signals, team indicators, product maturity, revenue signals, GCC market entry evidence.
Return strict JSON: {"score": number, "reasoning": string (2 sentences), "recommendation": "PROMOTE"|"WATCH"|"IGNORE"}`,
    },
  ];

  const dealContext = `Company: ${candidate.companyName}
Sector: ${candidate.sector}
Region: ${candidate.region}
Summary: ${candidate.summary}
Relevance: ${candidate.relevanceReason}
Pitch: ${candidate.rawInput}
[TEST CANDIDATE — internal evaluation only]`;

  const agentResults: TriageAgentResult[] = [];

  for (const agent of TRIAGE_AGENTS) {
    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: agent.prompt },
          { role: "user", content: `Evaluate this deal candidate:\n\n${dealContext}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "triage_agent_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "number" },
                reasoning: { type: "string" },
                recommendation: { type: "string", enum: ["PROMOTE", "WATCH", "IGNORE"] },
              },
              required: ["score", "reasoning", "recommendation"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : null;
      if (content) {
        const parsed = JSON.parse(content) as { score: number; reasoning: string; recommendation: "PROMOTE" | "WATCH" | "IGNORE" };
        agentResults.push({
          agentName: agent.name,
          score: Math.min(100, Math.max(0, parsed.score)),
          reasoning: parsed.reasoning,
          recommendation: parsed.recommendation,
        });
      }
    } catch (err) {
      console.error(`[QuickTriage] Agent ${agent.name} failed:`, err);
      agentResults.push({
        agentName: agent.name,
        score: 50,
        reasoning: "Agent evaluation unavailable.",
        recommendation: "WATCH",
      });
    }
  }

  const triageScore = agentResults.length > 0
    ? Math.round(agentResults.reduce((sum, a) => sum + a.score, 0) / agentResults.length)
    : 50;

  const promoteCount = agentResults.filter((a) => a.recommendation === "PROMOTE").length;
  const ignoreCount = agentResults.filter((a) => a.recommendation === "IGNORE").length;
  const recommendation: "PROMOTE" | "WATCH" | "IGNORE" =
    promoteCount >= 2 ? "PROMOTE" : ignoreCount >= 2 ? "IGNORE" : "WATCH";

  const triageReasoning = agentResults.map((a) => `${a.agentName}: ${a.reasoning}`).join(" | ");

  return { agents: agentResults, triageScore, triageReasoning, recommendation };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dealSourcingRouter = router({
  /**
   * Generate candidate deals using all four source agents.
   * Default: 20 candidates (5 per agent).
   */
  generateLeads: protectedProcedure
    .input(
      z.object({
        count: z.number().int().min(4).max(40).default(20),
        sourceTypes: z
          .array(z.enum(["seeded_test", "manual", "pattern_match", "public_signal"]))
          .default(["seeded_test", "pattern_match", "public_signal"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const perAgent = Math.max(1, Math.floor(input.count / input.sourceTypes.length));
      const allCandidates: Array<GeneratedCandidate & { sourceType: "seeded_test" | "manual" | "pattern_match" | "public_signal"; _agentLabel?: string }> = [];

      // DS.10: Named agent label mapping
      const AGENT_LABEL_MAP: Record<string, string> = {
        seeded_test: "GCC Signals",
        public_signal: "Public Filings",
        pattern_match: "Pattern Match",
        manual: "Manual Seed",
      };

      // Run source agents in parallel
      const agentPromises = input.sourceTypes.map(async (sourceType) => {
        let candidates: GeneratedCandidate[] = [];
        try {
          if (sourceType === "seeded_test" || sourceType === "public_signal") {
            candidates = await runStartupNewsAgent(perAgent);
          } else if (sourceType === "pattern_match") {
            candidates = await runPatternMatchAgent(perAgent);
          }
          // "manual" is handled by the manualSeed procedure below
        } catch (err) {
          console.error(`[DealSourcing] Agent ${sourceType} failed:`, err);
        }
        return candidates.map((c) => ({ ...c, sourceType }));
      });

      const results = await Promise.allSettled(agentPromises);
      for (const r of results) {
        if (r.status === "fulfilled") allCandidates.push(...r.value);
      }

      // Also run sector thesis agent for remaining slots — labelled "Founder Network"
      const remaining = input.count - allCandidates.length;
      if (remaining > 0 && input.sourceTypes.length > 0) {
        try {
          const thesisCandidates = await runSectorThesisAgent(Math.min(remaining, 5));
          allCandidates.push(...thesisCandidates.map((c) => ({ ...c, sourceType: "public_signal" as const, _agentLabel: "Founder Network" })));
        } catch (err) {
          console.error("[DealSourcing] Sector thesis agent failed:", err);
        }
      }

      // DS.11: Deduplication — fetch existing company names and build a normalised set
      const normalize = (name: string) =>
        name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");

      const existingRows = await db
        .select({ companyName: dealSources.companyName })
        .from(dealSources);
      const existingNormalized = new Set(existingRows.map((r) => normalize(r.companyName)));

      // Persist to DB
      const inserted: number[] = [];
      let duplicateSkipped = 0;
      for (const candidate of allCandidates.slice(0, input.count)) {
        const normalizedName = normalize(candidate.companyName);
        if (existingNormalized.has(normalizedName)) {
          duplicateSkipped++;
          continue;
        }
        // Add to set immediately to prevent duplicates within the same batch
        existingNormalized.add(normalizedName);
        try {
          const [result] = await db.insert(dealSources).values({
            sourceType: candidate.sourceType,
            rawInput: `[TEST CANDIDATE]\n${candidate.rawInput}`,
            companyName: candidate.companyName,
            sector: candidate.sector,
            region: candidate.region,
            sourceLabel: candidate._agentLabel ?? AGENT_LABEL_MAP[candidate.sourceType] ?? "TEST CANDIDATE",
            status: "sourced",
          });
          if (result.insertId) inserted.push(result.insertId);
        } catch (err) {
          console.error("[DealSourcing] Insert failed:", err);
        }
      }

      return {
        generated: allCandidates.length,
        inserted: inserted.length,
        duplicateSkipped,
        message: `Generated ${allCandidates.length} TEST CANDIDATE leads, inserted ${inserted.length}${
          duplicateSkipped > 0 ? `, skipped ${duplicateSkipped} duplicate${duplicateSkipped !== 1 ? "s" : ""}` : ""
        }.`,
      };
    }),

  /**
   * Manually seed a single deal candidate.
   */
  manualSeed: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1).max(255),
        rawInput: z.string().min(10).max(5000),
        sector: z.string().max(100).optional(),
        region: z.string().max(100).optional(),
        sourceLabel: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [result] = await db.insert(dealSources).values({
        sourceType: "manual",
        rawInput: input.rawInput,
        companyName: input.companyName,
        sector: input.sector ?? null,
        region: input.region ?? null,
        sourceLabel: input.sourceLabel ?? "Manual Seed",
        status: "sourced",
      });

      return { id: result.insertId, message: "Manual seed added." };
    }),

  /**
   * Run quick triage on all sourced (un-triaged) leads.
   * Returns triage results and auto-promotes top 5 scoring candidates.
   */
  runTriage: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number().int()).optional(), // if omitted, triage all "sourced" leads
        autoPromoteTop: z.number().int().min(0).max(20).default(5),
        autoPromoteThreshold: z.number().int().min(0).max(100).default(60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch leads to triage
      const leads = input.ids
        ? await db.select().from(dealSources).where(inArray(dealSources.id, input.ids))
        : await db
            .select()
            .from(dealSources)
            .where(eq(dealSources.status, "sourced"))
            .orderBy(desc(dealSources.createdAt))
            .limit(40);

      if (leads.length === 0) {
        return { triaged: 0, promoted: 0, message: "No sourced leads found to triage." };
      }

      const triageResults: Array<{ id: number; score: number; recommendation: string }> = [];

      for (const lead of leads) {
        try {
          const candidate: GeneratedCandidate = {
            companyName: lead.companyName,
            sector: lead.sector ?? "Unknown",
            region: lead.region ?? "Unknown",
            summary: lead.rawInput.slice(0, 300),
            relevanceReason: lead.sourceLabel ?? "Sourced candidate",
            rawInput: lead.rawInput,
          };

          const triage = await runQuickTriage(candidate);

          await db
            .update(dealSources)
            .set({
              triageScore: String(triage.triageScore),
              triageReasoning: JSON.stringify({
                agents: triage.agents,
                recommendation: triage.recommendation,
                summary: triage.triageReasoning,
              }),
              status: "triaged",
            })
            .where(eq(dealSources.id, lead.id));

          triageResults.push({ id: lead.id, score: triage.triageScore, recommendation: triage.recommendation });
        } catch (err) {
          console.error(`[DealSourcing] Triage failed for lead ${lead.id}:`, err);
        }
      }

      // Auto-promote top N
      const sorted = [...triageResults].sort((a, b) => b.score - a.score);
      // If threshold is set, promote all leads at or above it; otherwise fall back to top-N
      const byThreshold = triageResults.filter((r) => r.score >= input.autoPromoteThreshold && r.recommendation !== "IGNORE");
      const toPromote = byThreshold.length > 0
        ? byThreshold
        : sorted.slice(0, input.autoPromoteTop).filter((r) => r.recommendation !== "IGNORE");

      if (toPromote.length > 0) {
        await db
          .update(dealSources)
          .set({ status: "promoted" })
          .where(inArray(dealSources.id, toPromote.map((r) => r.id)));
      }

      return {
        triaged: triageResults.length,
        promoted: toPromote.length,
        topScores: sorted.slice(0, 10).map((r) => ({ id: r.id, score: r.score, recommendation: r.recommendation })),
        message: `Triaged ${triageResults.length} leads. Auto-promoted top ${toPromote.length} into Deal Screener queue.`,
      };
    }),

  /**
   * Send a promoted lead into the full Deal Screener council (runCouncil).
   * Stores the resulting dealScreenings.id in fullEvalId.
   */
  promoteToScreener: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [lead] = await db.select().from(dealSources).where(eq(dealSources.id, input.id)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });
      if (lead.status === "screened") throw new TRPCError({ code: "BAD_REQUEST", message: "Lead already screened." });
      if (lead.status === "ignored") throw new TRPCError({ code: "BAD_REQUEST", message: "Lead is ignored." });

      // Run full council
      const dealText = `${lead.rawInput}\n\nCompany: ${lead.companyName}\nSector: ${lead.sector ?? "Unknown"}\nRegion: ${lead.region ?? "Unknown"}\n[TEST CANDIDATE — Deal Sourcing Fleet]`;

      const councilResult = await runCouncil(dealText, {
        userId: ctx.user.id,
        skipMemory: true,
        bypassCostGuard: true,
        councilMode: "gcc",
      });

      // Persist to dealScreenings
      const dealId = randomUUID();
          await db.insert(dealScreenings).values({
            userId: ctx.user.id,
            dealId,
            dealName: `[FLEET] ${lead.companyName}`,
            dealTextPreview: lead.rawInput.slice(0, 200),
            verdict: councilResult.verdict,
            yesCount: councilResult.yesCount,
            noCount: councilResult.noCount,
            hardYesCount: councilResult.hardYesCount ?? 0,
            softYesCount: councilResult.softYesCount ?? 0,
            softNoCount: councilResult.softNoCount ?? 0,
            hardNoCount: councilResult.hardNoCount ?? 0,
            confidenceScore: String(councilResult.confidenceScore ?? 0),
            gccVetoTriggered: councilResult.gccVetoTriggered ?? false,
            tiebreakerTriggered: councilResult.tiebreakerTriggered ?? false,
            tiebreakerSwingAgent: councilResult.tiebreakerSwingAgent ?? null,
            conditionsToProceed: JSON.stringify(councilResult.conditionsToProceed ?? []),
            blockingIssues: JSON.stringify(councilResult.blockingIssues ?? []),
            votes: JSON.stringify(councilResult.votes ?? []),
            sourceType: "manual",
          });

      // Fetch the inserted screening id
      const [screening] = await db
        .select({ id: dealScreenings.id })
        .from(dealScreenings)
        .where(eq(dealScreenings.dealId, dealId))
        .limit(1);

      // Update deal_sources record
      await db
        .update(dealSources)
        .set({ status: "screened", fullEvalId: screening?.id ?? null })
        .where(eq(dealSources.id, input.id));

      return {
        dealId,
        verdict: councilResult.verdict,
        yesCount: councilResult.yesCount,
        noCount: councilResult.noCount,
        confidenceScore: councilResult.confidenceScore,
        message: `Full council completed. Verdict: ${councilResult.verdict}`,
      };
    }),

  /**
   * Ignore a lead (mark as ignored).
   */
  ignoreLead: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.update(dealSources).set({ status: "ignored" }).where(eq(dealSources.id, input.id));
      return { success: true };
    }),

  /**
   * List all deal sources with optional filters.
   */
  listLeads: protectedProcedure
    .input(
      z.object({
        status: z.enum(["sourced", "triaged", "promoted", "screened", "ignored", "all"]).default("all"),
        sector: z.string().optional(),
        region: z.string().optional(),
        sourceType: z.enum(["seeded_test", "manual", "pattern_match", "public_signal", "all"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let query = db.select().from(dealSources).$dynamic();

      const conditions = [];
      if (input.status !== "all") conditions.push(eq(dealSources.status, input.status));
      if (input.sourceType !== "all") conditions.push(eq(dealSources.sourceType, input.sourceType));
      if (conditions.length > 0) query = query.where(and(...conditions));

      const leads = await query
        .orderBy(desc(dealSources.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Filter by sector/region in JS (no LIKE in Drizzle without raw SQL)
      const filtered = leads.filter((l) => {
        if (input.sector && input.sector !== "all" && l.sector !== input.sector) return false;
        if (input.region && input.region !== "all" && l.region !== input.region) return false;
        return true;
      });

      // Fetch council verdicts for screened leads
      const screenedIds = filtered.filter((l) => l.fullEvalId).map((l) => l.fullEvalId!);
      const verdicts: Record<number, { verdict: string; yesCount: number; noCount: number; confidenceScore: string }> = {};
      if (screenedIds.length > 0) {
        const screenings = await db
          .select({
            id: dealScreenings.id,
            verdict: dealScreenings.verdict,
            yesCount: dealScreenings.yesCount,
            noCount: dealScreenings.noCount,
            confidenceScore: dealScreenings.confidenceScore,
          })
          .from(dealScreenings)
          .where(inArray(dealScreenings.id, screenedIds));
        for (const s of screenings) {
          verdicts[s.id] = { verdict: s.verdict, yesCount: s.yesCount, noCount: s.noCount, confidenceScore: s.confidenceScore };
        }
      }

      return {
        leads: filtered.map((l) => ({
          ...l,
          triageScore: l.triageScore ? Number(l.triageScore) : null,
          triageReasoning: l.triageReasoning ? (() => { try { return JSON.parse(l.triageReasoning!); } catch { return null; } })() : null,
          councilVerdict: l.fullEvalId ? (verdicts[l.fullEvalId] ?? null) : null,
        })),
        total: filtered.length,
      };
    }),

  /**
   * Bulk promote ALL "promoted" status leads to the full council.
   * Uses controlled concurrency (default 5 parallel) via Promise.allSettled.
   * One failed lead does not block the rest.
   */
  bulkPromoteToScreener: protectedProcedure
    .input(z.object({ concurrency: z.number().int().min(1).max(10).default(5) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch ALL promoted leads — no limit cap
      const leads = await db
        .select()
        .from(dealSources)
        .where(eq(dealSources.status, "promoted"))
        .orderBy(desc(dealSources.createdAt));

      if (leads.length === 0) {
        return { total: 0, succeeded: 0, failed: 0, skipped: 0, message: "No promoted leads found." };
      }

      const results: Array<{ id: number; verdict: string; success: boolean }> = [];
      const { concurrency } = input;

      // Process in controlled-concurrency batches
      for (let i = 0; i < leads.length; i += concurrency) {
        const batch = leads.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
          batch.map(async (lead) => {
            const dealText = `${lead.rawInput}\n\nCompany: ${lead.companyName}\nSector: ${lead.sector ?? "Unknown"}\nRegion: ${lead.region ?? "Unknown"}\n[TEST CANDIDATE — Deal Sourcing Fleet]`;
            const councilResult = await runCouncil(dealText, {
              userId: ctx.user.id,
              skipMemory: true,
              bypassCostGuard: true,
              councilMode: "gcc",
            });
            const dealId = randomUUID();
            await db.insert(dealScreenings).values({
              userId: ctx.user.id,
              dealId,
              dealName: `[FLEET] ${lead.companyName}`,
              dealTextPreview: lead.rawInput.slice(0, 200),
              verdict: councilResult.verdict,
              yesCount: councilResult.yesCount,
              noCount: councilResult.noCount,
              hardYesCount: councilResult.hardYesCount ?? 0,
              softYesCount: councilResult.softYesCount ?? 0,
              softNoCount: councilResult.softNoCount ?? 0,
              hardNoCount: councilResult.hardNoCount ?? 0,
              confidenceScore: String(councilResult.confidenceScore ?? 0),
              gccVetoTriggered: councilResult.gccVetoTriggered ?? false,
              tiebreakerTriggered: councilResult.tiebreakerTriggered ?? false,
              tiebreakerSwingAgent: councilResult.tiebreakerSwingAgent ?? null,
              conditionsToProceed: JSON.stringify(councilResult.conditionsToProceed ?? []),
              blockingIssues: JSON.stringify(councilResult.blockingIssues ?? []),
              votes: JSON.stringify(councilResult.votes ?? []),
              sourceType: "manual",
            });
            const [screening] = await db
              .select({ id: dealScreenings.id })
              .from(dealScreenings)
              .where(eq(dealScreenings.dealId, dealId))
              .limit(1);
            await db
              .update(dealSources)
              .set({ status: "screened", fullEvalId: screening?.id ?? null })
              .where(eq(dealSources.id, lead.id));
            return { id: lead.id, verdict: councilResult.verdict, success: true };
          })
        );
        for (let j = 0; j < batchResults.length; j++) {
          const r = batchResults[j];
          if (r.status === "fulfilled") {
            results.push(r.value);
          } else {
            console.error(`[DealSourcing] Bulk promote failed for lead ${batch[j].id}:`, r.reason);
            results.push({ id: batch[j].id, verdict: "ERROR", success: false });
          }
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      return {
        total: leads.length,
        succeeded,
        failed,
        skipped: 0,
        results,
        message: `Screened ${succeeded}/${leads.length} promoted leads through full council.${failed > 0 ? ` ${failed} failed.` : ""}`,
      };
    }),

  /**
   * Aggregate per-agent stats from the deal_sources table.
   * Counts leads, promoted, ignored, and screened per sourceLabel.
   */
  agentStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const allLeads = await db
      .select({
        sourceLabel: dealSources.sourceLabel,
        sourceType: dealSources.sourceType,
        status: dealSources.status,
        createdAt: dealSources.createdAt,
      })
      .from(dealSources)
      .orderBy(desc(dealSources.createdAt));

    const AGENT_LABELS = ["GCC Signals", "Public Filings", "Founder Network", "Pattern Match"] as const;
    type AgentLabel = typeof AGENT_LABELS[number];

    // DS.10: Fall-back mapping for legacy rows stamped "TEST CANDIDATE"
    const SOURCE_TYPE_FALLBACK: Record<string, AgentLabel> = {
      seeded_test: "GCC Signals",
      public_signal: "Public Filings",
      pattern_match: "Pattern Match",
      manual: "GCC Signals",
    };

    const stats: Record<AgentLabel, {
      agent: AgentLabel;
      total: number;
      promoted: number;
      screened: number;
      ignored: number;
      lastRun: number | null;
    }> = {
      "GCC Signals": { agent: "GCC Signals", total: 0, promoted: 0, screened: 0, ignored: 0, lastRun: null },
      "Public Filings": { agent: "Public Filings", total: 0, promoted: 0, screened: 0, ignored: 0, lastRun: null },
      "Founder Network": { agent: "Founder Network", total: 0, promoted: 0, screened: 0, ignored: 0, lastRun: null },
      "Pattern Match": { agent: "Pattern Match", total: 0, promoted: 0, screened: 0, ignored: 0, lastRun: null },
    };

    for (const lead of allLeads) {
      // Use named label if it's one of the 4 known agents; otherwise fall back to sourceType mapping
      const rawLabel = lead.sourceLabel ?? "";
      const isNamedAgent = (AGENT_LABELS as readonly string[]).includes(rawLabel);
      const key: AgentLabel = isNamedAgent
        ? (rawLabel as AgentLabel)
        : (SOURCE_TYPE_FALLBACK[lead.sourceType ?? ""] ?? "Pattern Match");
      if (!stats[key]) continue;
      stats[key].total++;
      if (lead.status === "promoted") stats[key].promoted++;
      if (lead.status === "screened") stats[key].screened++;
      if (lead.status === "ignored") stats[key].ignored++;
      if (stats[key].lastRun === null) {
        stats[key].lastRun = typeof lead.createdAt === "number" ? lead.createdAt : Number(lead.createdAt);
      }
    }

    return AGENT_LABELS.map((label) => ({
      ...stats[label],
      hitRate: stats[label].total > 0
        ? Math.round(((stats[label].promoted + stats[label].screened) / stats[label].total) * 100)
        : 0,
    }));
  }),

  /**
   * Re-triage all leads that are still in 'sourced' status.
   * Useful when a bulk triage run missed some leads.
   * Does NOT re-triage already triaged/promoted/screened/ignored leads.
   */
  reTriageSourced: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(50),
      autoPromoteThreshold: z.number().int().min(0).max(100).default(60),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const sourced = await db
        .select()
        .from(dealSources)
        .where(eq(dealSources.status, "sourced"))
        .orderBy(desc(dealSources.createdAt))
        .limit(input.limit);

      if (sourced.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, message: "No sourced leads pending triage." };
      }

      let succeeded = 0;
      let failed = 0;

      for (const lead of sourced) {
        try {
          const candidate = {
            companyName: lead.companyName,
            sector: lead.sector ?? "Unknown",
            region: lead.region ?? "Unknown",
            summary: lead.rawInput.slice(0, 200),
            relevanceReason: "",
            rawInput: lead.rawInput,
          };
          const result = await runQuickTriage(candidate);
          const autoPromote = result.triageScore >= input.autoPromoteThreshold;
          await db
            .update(dealSources)
            .set({
              status: autoPromote ? "promoted" : "triaged",
              triageScore: String(result.triageScore),
              triageReasoning: JSON.stringify(result),
            })
            .where(eq(dealSources.id, lead.id));
          succeeded++;
        } catch (err) {
          console.error(`[DealSourcing] reTriageSourced failed for lead ${lead.id}:`, err);
          failed++;
        }
      }

      return {
        processed: sourced.length,
        succeeded,
        failed,
        message: failed === 0
          ? `Re-triaged ${succeeded} sourced lead${succeeded !== 1 ? "s" : ""}.`
          : `Re-triaged ${succeeded}/${sourced.length} leads (${failed} failed).`,
      };
    }),

  /**
   * Re-triage a single lead in-place.
   * Works for sourced, triaged, and promoted statuses.
   * Updates triage_score, triage_reasoning, and status based on autoPromoteThreshold.
   */
  reTriageLead: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      autoPromoteThreshold: z.number().int().min(0).max(100).default(60),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [lead] = await db.select().from(dealSources).where(eq(dealSources.id, input.id)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      if (lead.status === "screened" || lead.status === "ignored") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot re-triage a lead with status '${lead.status}'.` });
      }
      const candidate: GeneratedCandidate = {
        companyName: lead.companyName,
        sector: lead.sector ?? "Unknown",
        region: lead.region ?? "Unknown",
        summary: lead.rawInput.slice(0, 300),
        relevanceReason: lead.sourceLabel ?? "Sourced candidate",
        rawInput: lead.rawInput,
      };
      const result = await runQuickTriage(candidate);
      const autoPromote = result.triageScore >= input.autoPromoteThreshold;
      // Only downgrade from promoted → triaged if score dropped below threshold
      const newStatus = autoPromote ? "promoted" : (lead.status === "promoted" ? "triaged" : lead.status === "sourced" ? "triaged" : lead.status);
      await db
        .update(dealSources)
        .set({
          triageScore: String(result.triageScore),
          triageReasoning: JSON.stringify({
            agents: result.agents,
            recommendation: result.recommendation,
            summary: result.triageReasoning,
          }),
          status: newStatus,
        })
        .where(eq(dealSources.id, input.id));
      return {
        id: input.id,
        triageScore: result.triageScore,
        recommendation: result.recommendation,
        newStatus,
        message: `Re-triaged ${lead.companyName}: score ${result.triageScore}, status → ${newStatus}.`,
      };
    }),

  /**
   * DS.12 — List all screened leads with full council verdict details.
   * Joins deal_sources with deal_screenings to return conditions, blocking issues,
   * votes, confidence, and special flags for operator review.
   */
  listScreenedLeads: protectedProcedure
    .input(
      z.object({
        sector: z.string().optional(),
        region: z.string().optional(),
        verdict: z.enum(["APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "VETOED", "INSUFFICIENT_DATA", "all"]).default("all"),
        limit: z.number().int().min(1).max(200).default(100),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch all screened leads
      const sources = await db
        .select()
        .from(dealSources)
        .where(eq(dealSources.status, "screened"))
        .orderBy(desc(dealSources.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Apply sector/region filters in JS
      const filtered = sources.filter((l) => {
        if (input.sector && l.sector !== input.sector) return false;
        if (input.region && l.region !== input.region) return false;
        return true;
      });

      // Fetch full screening records for all screened leads that have a fullEvalId
      const evalIds = filtered.filter((l) => l.fullEvalId != null).map((l) => l.fullEvalId!);
      const screeningMap: Record<number, {
        verdict: string;
        yesCount: number;
        noCount: number;
        hardYesCount: number;
        softYesCount: number;
        softNoCount: number;
        hardNoCount: number;
        confidenceScore: string;
        gccVetoTriggered: boolean;
        tiebreakerTriggered: boolean;
        tiebreakerSwingAgent: string | null;
        conditionsToProceed: string;
        blockingIssues: string;
        votes: string;
        createdAt: Date;
      }> = {};

      if (evalIds.length > 0) {
        const screenings = await db
          .select({
            id: dealScreenings.id,
            verdict: dealScreenings.verdict,
            yesCount: dealScreenings.yesCount,
            noCount: dealScreenings.noCount,
            hardYesCount: dealScreenings.hardYesCount,
            softYesCount: dealScreenings.softYesCount,
            softNoCount: dealScreenings.softNoCount,
            hardNoCount: dealScreenings.hardNoCount,
            confidenceScore: dealScreenings.confidenceScore,
            gccVetoTriggered: dealScreenings.gccVetoTriggered,
            tiebreakerTriggered: dealScreenings.tiebreakerTriggered,
            tiebreakerSwingAgent: dealScreenings.tiebreakerSwingAgent,
            conditionsToProceed: dealScreenings.conditionsToProceed,
            blockingIssues: dealScreenings.blockingIssues,
            votes: dealScreenings.votes,
            createdAt: dealScreenings.createdAt,
          })
          .from(dealScreenings)
          .where(inArray(dealScreenings.id, evalIds));
        for (const s of screenings) {
          screeningMap[s.id] = s;
        }
      }

      const leads = filtered.map((l) => {
        const screening = l.fullEvalId ? (screeningMap[l.fullEvalId] ?? null) : null;
        const triageReasoning = l.triageReasoning
          ? (() => { try { return JSON.parse(l.triageReasoning!); } catch { return null; } })()
          : null;

        let conditionsToProceed: string[] = [];
        let blockingIssues: string[] = [];
        let votes: unknown[] = [];
        if (screening) {
          try { conditionsToProceed = JSON.parse(screening.conditionsToProceed); } catch { conditionsToProceed = []; }
          try { blockingIssues = JSON.parse(screening.blockingIssues); } catch { blockingIssues = []; }
          try { votes = JSON.parse(screening.votes); } catch { votes = []; }
        }

        return {
          id: l.id,
          companyName: l.companyName,
          sector: l.sector,
          region: l.region,
          sourceType: l.sourceType,
          sourceLabel: l.sourceLabel,
          rawInput: l.rawInput,
          triageScore: l.triageScore ? Number(l.triageScore) : null,
          triageReasoning,
          createdAt: l.createdAt,
          fullEvalId: l.fullEvalId,
          // Full council data
          verdict: screening?.verdict ?? null,
          yesCount: screening?.yesCount ?? null,
          noCount: screening?.noCount ?? null,
          hardYesCount: screening?.hardYesCount ?? null,
          softYesCount: screening?.softYesCount ?? null,
          softNoCount: screening?.softNoCount ?? null,
          hardNoCount: screening?.hardNoCount ?? null,
          confidenceScore: screening?.confidenceScore ?? null,
          gccVetoTriggered: screening?.gccVetoTriggered ?? false,
          tiebreakerTriggered: screening?.tiebreakerTriggered ?? false,
          tiebreakerSwingAgent: screening?.tiebreakerSwingAgent ?? null,
          conditionsToProceed,
          blockingIssues,
          votes,
          screenedAt: screening?.createdAt ?? null,
        };
      });

      // Apply verdict filter after joining
      const verdictFiltered = input.verdict === "all"
        ? leads
        : leads.filter((l) => l.verdict === input.verdict);

      return {
        leads: verdictFiltered,
        total: verdictFiltered.length,
      };
    }),
});
