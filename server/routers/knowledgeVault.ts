import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { knowledgeScenarios } from "../../drizzle/schema";
import { eq, like, and, or, sql } from "drizzle-orm";

const DOMAIN_VALUES = [
  "deal_screening",
  "wealth_management",
  "insurance_underwriting",
  "mvno_intelligence",
  "legal_review",
  "budget_forecasting",
  "social_media",
  "ic_reports",
] as const;

export const knowledgeVaultRouter = router({
  // List scenarios with optional domain filter and search
  list: protectedProcedure
    .input(
      z.object({
        domain: z.enum(DOMAIN_VALUES).optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.pageSize;

      const conditions = [];
      if (input.domain) {
        conditions.push(eq(knowledgeScenarios.domain, input.domain));
      }
      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(knowledgeScenarios.title, term),
            like(knowledgeScenarios.summary, term),
            like(knowledgeScenarios.geography, term),
            like(knowledgeScenarios.sector, term),
            like(knowledgeScenarios.tags, term)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [scenarios, countResult] = await Promise.all([
        db
          .select({
            id: knowledgeScenarios.id,
            scenarioId: knowledgeScenarios.scenarioId,
            domain: knowledgeScenarios.domain,
            title: knowledgeScenarios.title,
            summary: knowledgeScenarios.summary,
            geography: knowledgeScenarios.geography,
            sector: knowledgeScenarios.sector,
            tags: knowledgeScenarios.tags,
            createdAt: knowledgeScenarios.createdAt,
          })
          .from(knowledgeScenarios)
          .where(whereClause)
          .orderBy(knowledgeScenarios.scenarioId)
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`COUNT(*)` })
          .from(knowledgeScenarios)
          .where(whereClause),
      ]);

      return {
        scenarios,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Get a single scenario with full content
  getById: protectedProcedure
    .input(z.object({ scenarioId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [scenario] = await db
        .select()
        .from(knowledgeScenarios)
        .where(eq(knowledgeScenarios.scenarioId, input.scenarioId))
        .limit(1);

      if (!scenario) throw new Error("Scenario not found");

      return {
        ...scenario,
        parsedContent: (() => {
          try {
            return JSON.parse(scenario.content);
          } catch {
            return null;
          }
        })(),
      };
    }),

  // Stats overview
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db
      .select({
        domain: knowledgeScenarios.domain,
        count: sql<number>`COUNT(*)`,
      })
      .from(knowledgeScenarios)
      .groupBy(knowledgeScenarios.domain);

    const domainLabels: Record<string, string> = {
      deal_screening: "Deal Screening",
      wealth_management: "Wealth Management",
      insurance_underwriting: "Insurance Underwriting",
      mvno_intelligence: "MVNO Intelligence",
      legal_review: "Legal Review",
      budget_forecasting: "Budget Forecasting",
      social_media: "Social Media",
      ic_reports: "IC Reports",
    };

    const byDomain = rows.map((r) => ({
      domain: r.domain,
      label: domainLabels[r.domain] ?? r.domain,
      count: Number(r.count),
    }));

    const total = byDomain.reduce((s, r) => s + r.count, 0);

    return { byDomain, total };
  }),

  // RAG context retrieval — returns top N relevant scenarios for a query
  getContext: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        domain: z.enum(DOMAIN_VALUES).optional(),
        topK: z.number().min(1).max(10).default(3),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Keyword-based retrieval (no vector DB needed for MVP)
      const words = input.query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);

      if (words.length === 0) return { scenarios: [] };

      const conditions = [];
      if (input.domain) {
        conditions.push(eq(knowledgeScenarios.domain, input.domain));
      }

      // Score by number of matching keywords in title + summary + tags
      const termConditions = words.map((word) => {
        const term = `%${word}%`;
        return or(
          like(knowledgeScenarios.title, term),
          like(knowledgeScenarios.summary, term),
          like(knowledgeScenarios.tags, term),
          like(knowledgeScenarios.geography, term)
        );
      });

      conditions.push(or(...termConditions));

      const scenarios = await db
        .select({
          scenarioId: knowledgeScenarios.scenarioId,
          domain: knowledgeScenarios.domain,
          title: knowledgeScenarios.title,
          summary: knowledgeScenarios.summary,
          content: knowledgeScenarios.content,
          geography: knowledgeScenarios.geography,
          sector: knowledgeScenarios.sector,
        })
        .from(knowledgeScenarios)
        .where(and(...conditions))
        .limit(input.topK * 3); // over-fetch then rank

      // Simple relevance scoring
      const scored = scenarios.map((s) => {
        const text = `${s.title} ${s.summary} ${s.geography} ${s.sector}`.toLowerCase();
        const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
        return { ...s, score };
      });

      scored.sort((a, b) => b.score - a.score);

      return {
        scenarios: scored.slice(0, input.topK).map((s) => ({
          scenarioId: s.scenarioId,
          domain: s.domain,
          title: s.title,
          summary: s.summary,
          geography: s.geography,
          sector: s.sector,
          parsedContent: (() => {
            try { return JSON.parse(s.content); } catch { return null; }
          })(),
        })),
      };
    }),
});
