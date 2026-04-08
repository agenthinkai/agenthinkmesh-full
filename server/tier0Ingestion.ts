/**
 * tier0Ingestion.ts — Tier 0 University Signal Ingestion Service
 *
 * Sources:
 *   - NSF SBIR API (https://api.sbir.gov/public/api/awards)
 *   - Devpost RSS feed (https://devpost.com/hackathons.rss)
 *
 * Rules:
 *   - Apply noise filter: must have team presence, project continuity, or external validation
 *   - Classify each signal: Startup / Emerging / Project
 *   - Limit surfaced signals to max 5 at any time
 *   - Tier 0A (+50): NSF SBIR
 *   - Tier 0B (+30): Devpost
 *   - No hallucination: only store data from API responses
 */

import { getDb } from "./db";
import { tier0Signals } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NsfAward {
  award_title: string;
  firm: string;
  abstract: string;
  award_year: number;
  program_title: string;
  award_amount: number;
  pi_first_name?: string;
  pi_last_name?: string;
  company_url?: string;
}

interface DevpostHackathon {
  title: string;
  description: string;
  url: string;
  pubDate: string;
}

// ── NSF SBIR Ingestion ────────────────────────────────────────────────────────

async function fetchNsfSbirSignals(): Promise<typeof tier0Signals.$inferInsert[]> {
  try {
    const url = "https://api.sbir.gov/public/api/awards?rows=20&start=0&keyword=AI+machine+learning&sortField=award_year&sortDir=desc";
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[Tier0] NSF SBIR API returned ${res.status}`);
      return [];
    }
    const data = await res.json() as { response?: { docs?: NsfAward[] } };
    const awards: NsfAward[] = data?.response?.docs ?? [];

    const signals: typeof tier0Signals.$inferInsert[] = [];

    for (const award of awards.slice(0, 10)) {
      if (!award.award_title || !award.firm || !award.abstract) continue;

      // Noise filter: must mention team or validation signals
      const combined = `${award.award_title} ${award.abstract}`.toLowerCase();
      const hasValidation = ["phase i", "phase ii", "sbir", "sttr", "grant", "award"].some(kw => combined.includes(kw));
      if (!hasValidation) continue;

      // Classification
      let classification: "Startup" | "Emerging" | "Project" = "Project";
      if (["revenue", "customers", "users", "traction", "raised", "seed"].some(kw => combined.includes(kw))) {
        classification = "Startup";
      } else if (["team", "co-founder", "cto", "ceo", "github", "linkedin"].some(kw => combined.includes(kw))) {
        classification = "Emerging";
      }

      const id = `nsf-${award.award_year ?? "2024"}-${award.firm.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20)}`;
      const description = `NSF SBIR awardee. ${award.program_title ?? "Technology"}. ${award.firm}.`;

      // Generate a concise dealMemo using LLM — factual only, no hallucination
      let dealMemo = `Deal: ${award.award_title} — Pre-Seed\n\nSector: ${award.program_title ?? "Technology"}\nGeography: US\nStage: Pre-Seed\n\nBusiness: ${award.abstract.slice(0, 400)}\n\nTeam: ${award.firm}. NSF SBIR ${award.award_year ?? ""} awardee.\n\nWhy Interesting: NSF SBIR is a rigorous non-dilutive grant programme — selection indicates credible IP and commercial potential.\n\nWhat Is Unknown: No public ARR or customer count. Early-stage; product-market fit unproven.`;

      try {
        const memoResponse = await invokeLLM({
          messages: [
            {
              role: "system" as const,
              content: "You are a VC analyst. Write a 130-150 word deal memo for an IC pre-screen. Use ONLY the facts provided. Do NOT invent data. Structure: Deal name, Sector, Business (2 sentences), Team (1 sentence), Why Interesting (1-2 sentences), What Is Unknown (1-2 sentences). No markdown headers.",
            },
            {
              role: "user" as const,
              content: `Company: ${award.firm}\nProject: ${award.award_title}\nAbstract: ${award.abstract.slice(0, 600)}\nSource: NSF SBIR ${award.award_year ?? ""}\nGrant amount: $${award.award_amount?.toLocaleString() ?? "unknown"}`,
            },
          ],
        });
        const rawContent = memoResponse?.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (content && content.length > 100) dealMemo = content;
      } catch {
        // Use the fallback memo if LLM fails
      }

      signals.push({
        id,
        companyName: award.firm,
        source: "NSF SBIR",
        subtype: "Grant",
        tier: "0A",
        classification,
        description,
        dealMemo,
        confidence: "High",
        scoreBoost: 50,
        externalUrl: award.company_url ?? null,
        surfaced: false,
      });
    }

    return signals;
  } catch (err) {
    console.warn("[Tier0] NSF SBIR fetch failed:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ── Devpost RSS Ingestion ─────────────────────────────────────────────────────

async function fetchDevpostSignals(): Promise<typeof tier0Signals.$inferInsert[]> {
  try {
    const res = await fetch("https://devpost.com/hackathons.rss", {
      headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[Tier0] Devpost RSS returned ${res.status}`);
      return [];
    }
    const xml = await res.text();

    // Parse RSS items with basic regex (no external XML parser needed)
    const items: DevpostHackathon[] = [];
    const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));
    for (const match of itemMatches) {
      const block = match[1];
      const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
        ?? block.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
      const description = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
        ?? block.match(/<description>(.*?)<\/description>/)?.[1] ?? "";
      const url = block.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
      if (title) items.push({ title, description, url, pubDate });
    }

    const signals: typeof tier0Signals.$inferInsert[] = [];

    for (const item of items.slice(0, 5)) {
      const combined = `${item.title} ${item.description}`.toLowerCase();
      // Noise filter: must be a competition with prizes or winners
      const hasValidation = ["prize", "winner", "finalist", "award", "challenge", "$"].some(kw => combined.includes(kw));
      if (!hasValidation) continue;

      const id = `devpost-${item.url.split("/").pop()?.slice(0, 30) ?? Date.now().toString()}`;
      const cleanDescription = item.description.replace(/<[^>]+>/g, "").slice(0, 200);

      signals.push({
        id,
        companyName: item.title,
        source: "Devpost",
        subtype: "Hackathon",
        tier: "0B",
        classification: "Project",
        description: `Devpost hackathon. ${cleanDescription.slice(0, 120)}`,
        dealMemo: `Deal: ${item.title} — Hackathon Signal\n\nSector: Technology\nGeography: Global\nStage: Project / Idea Stage\n\nBusiness: ${cleanDescription.slice(0, 300)}\n\nTeam: Devpost hackathon participants. Team composition not yet disclosed.\n\nWhy Interesting: Devpost hackathons surface early technical talent and validated problem-solution fit under time pressure.\n\nWhat Is Unknown: No team background, ARR, or customers. Prototype-stage only. Requires significant follow-up diligence to assess commercial potential.`,
        confidence: "Medium",
        scoreBoost: 30,
        externalUrl: item.url || null,
        surfaced: false,
      });
    }

    return signals;
  } catch (err) {
    console.warn("[Tier0] Devpost RSS fetch failed:", err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ── Main ingestion function ───────────────────────────────────────────────────

export async function runTier0Ingestion(): Promise<{ inserted: number; skipped: number }> {
  console.log("[Tier0] Starting ingestion run...");
  let inserted = 0;
  let skipped = 0;

  const db = await getDb();
  if (!db) {
    console.warn("[Tier0] DB unavailable, skipping ingestion");
    return { inserted: 0, skipped: 0 };
  }

  const [nsfSignals, devpostSignals] = await Promise.all([
    fetchNsfSbirSignals(),
    fetchDevpostSignals(),
  ]);

  const allSignals = [...nsfSignals, ...devpostSignals];
  console.log(`[Tier0] Fetched ${allSignals.length} candidate signals`);

  for (const signal of allSignals) {
    try {
      // Upsert: insert or skip if ID already exists
      await db.insert(tier0Signals).values(signal).onDuplicateKeyUpdate({
        set: {
          description: signal.description,
          dealMemo: signal.dealMemo,
          updatedAt: new Date(),
        },
      });
      inserted++;
    } catch (err) {
      console.warn(`[Tier0] Failed to insert ${signal.id}:`, err instanceof Error ? err.message : String(err));
      skipped++;
    }
  }

  // Mark top 5 high-confidence signals as surfaced, unsurface the rest
  try {
    // Unsurface all first
    await db.update(tier0Signals).set({ surfaced: false });
    // Surface top 5: Tier 0A first, then 0B, ordered by ingestedAt desc
    const top5 = await db
      .select({ id: tier0Signals.id })
      .from(tier0Signals)
      .orderBy(desc(tier0Signals.tier), desc(tier0Signals.ingestedAt))
      .limit(5);
    for (const row of top5) {
      await db.update(tier0Signals).set({ surfaced: true }).where(eq(tier0Signals.id, row.id));
    }
  } catch (err) {
    console.warn("[Tier0] Failed to update surfaced flags:", err instanceof Error ? err.message : String(err));
  }

  console.log(`[Tier0] Ingestion complete: ${inserted} inserted/updated, ${skipped} skipped`);
  return { inserted, skipped };
}

// ── Get surfaced signals for the feed ────────────────────────────────────────

export async function getSurfacedSignals() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tier0Signals)
    .where(eq(tier0Signals.surfaced, true))
    .orderBy(desc(tier0Signals.tier), desc(tier0Signals.ingestedAt))
    .limit(5);
}
