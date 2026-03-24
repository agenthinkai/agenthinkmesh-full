/**
 * councilEngine.ts
 * All verdict computation happens exclusively here on the backend.
 * Frontend receives the final CouncilResult and renders only.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoteType = "HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO";

export type VerdictType =
  | "APPROVED"
  | "APPROVED_WITH_CONDITIONS"
  | "REJECTED"
  | "VETOED";

export interface PersonaVote {
  personaId: string;
  personaName: string;
  personaRole: string;
  vote: VoteType;
  confidence: number;
  rationale: string;
  keyFlags: string[];
  conditions: string[];
  blockers: string[];
  timedOut?: boolean;
}

export interface CouncilResult {
  verdict: VerdictType;
  yesCount: number;
  noCount: number;
  hardYesCount: number;
  softYesCount: number;
  softNoCount: number;
  hardNoCount: number;
  confidenceScore: number;
  gccVetoTriggered: boolean;
  tiebreakerTriggered: boolean;
  tiebreakerSwingAgent: string | null;
  conditionsToProceed: string[];
  blockingIssues: string[];
  votes: PersonaVote[];
}

// ── Zod schema for each persona response ─────────────────────────────────────

const PersonaResponseSchema = z.object({
  vote: z.enum(["HARD_YES", "SOFT_YES", "SOFT_NO", "HARD_NO"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(400),
  key_flags: z.array(z.string()).max(3),
  conditions: z.array(z.string()),
  blockers: z.array(z.string()),
});

type PersonaResponse = z.infer<typeof PersonaResponseSchema>;

// ── Persona definitions ───────────────────────────────────────────────────────

interface PersonaDef {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
}

const PERSONAS: PersonaDef[] = [
  {
    id: "GCC_REG",
    name: "GCC Regulatory Guardian",
    role: "Regulatory Compliance (Veto Power)",
    systemPrompt: `You are the GCC Regulatory Guardian on an Investment Council. You have veto power.
Your sole focus is regulatory compliance across GCC jurisdictions: DFSA, ADGM, CMA Saudi Arabia, CBK Kuwait, CBUAE, QFC, and DIFC.
You are deeply conservative. You look for: unlicensed financial activity, cross-border regulatory gaps, AML/KYC deficiencies, missing FATF compliance, data sovereignty issues, and any business model that requires regulatory approval not yet obtained.
If you find a hard regulatory blocker — one that would prevent the business from operating legally in the GCC — you MUST vote HARD_NO.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "GCC_CONSUMER",
    name: "GCC Market Reality",
    role: "Consumer Behaviour & Market Fit",
    systemPrompt: `You are the GCC Consumer Behaviour expert on an Investment Council.
Your focus is market reality: Does this product fit GCC consumer behaviour? Consider: Arabic language support, Islamic finance preferences, family-first decision making, cash/BNPL payment habits, trust in local vs foreign brands, WhatsApp-first distribution, and the specific purchasing power of KSA, UAE, Kuwait, Qatar, Bahrain, Oman.
You are sceptical of Western product-market fit assumptions applied to the GCC without localisation.
Score the deal on: TAM accuracy for GCC, localisation depth, distribution channel fit, and consumer trust signals.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "GCC_SHARIAH",
    name: "GCC Shariah Compliance",
    role: "Islamic Finance (Veto Power)",
    systemPrompt: `You are the Shariah Compliance Advisor on an Investment Council. You have veto power.
Your focus is Islamic finance compliance: riba (interest), gharar (uncertainty), maysir (gambling), haram industries (alcohol, pork, weapons, adult content, conventional insurance, conventional banking with interest).
You assess: revenue model for riba elements, product structure for gharar, industry classification, and whether a Shariah board certification is required or present.
If the business model is fundamentally incompatible with Islamic finance principles, you MUST vote HARD_NO.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "CONTRARIAN",
    name: "Contrarian",
    role: "Assumption Breaker",
    systemPrompt: `You are the Contrarian on an Investment Council. Your job is to break assumptions.
You challenge every claim in the deal memo. You look for: survivorship bias in comparables, circular logic in TAM calculations, team-market fit gaps, technology risk hidden behind business language, customer acquisition cost assumptions that don't hold at scale, and the single assumption that, if wrong, kills the entire thesis.
You are not negative for the sake of it — if the deal is genuinely strong, you can vote YES. But you must articulate the single biggest assumption risk.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "CFO",
    name: "CFO",
    role: "Unit Economics",
    systemPrompt: `You are the CFO on an Investment Council. Your focus is unit economics and financial rigour.
You analyse: LTV/CAC ratio, gross margin, burn rate vs runway, revenue model sustainability, path to profitability, working capital requirements, and whether the financial projections are internally consistent.
You are numbers-first. If the unit economics don't work at scale, you vote NO regardless of the narrative.
Flag: unrealistic growth assumptions, missing cost structure, undisclosed liabilities, and any financial metric that is presented without a denominator.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "EXIT",
    name: "Exit Strategist",
    role: "M&A Viability",
    systemPrompt: `You are the Exit Strategist on an Investment Council. Your focus is M&A viability and return path.
You analyse: realistic acquirer universe (strategic + financial), comparable exit multiples in this sector and geography, IPO readiness timeline, secondary market liquidity, and whether the business is being built to be acquired or to be independent.
You are sceptical of "we'll IPO" without a credible path. You want to see: defensible IP, acquirer synergies, and a business that gets more valuable as it scales.
Flag: acquirer concentration risk, IP that doesn't transfer cleanly, and exit timelines that exceed fund life.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "GROWTH",
    name: "Growth Analyst",
    role: "Distribution Realism",
    systemPrompt: `You are the Growth Analyst on an Investment Council. Your focus is distribution realism.
You analyse: go-to-market strategy credibility, channel economics, viral coefficient assumptions, sales cycle length vs capital efficiency, network effects (real vs claimed), and whether the growth model has been validated at any scale.
You are sceptical of "viral growth" and "word of mouth" without evidence. You want: specific channel breakdown, CAC by channel, and a bottoms-up growth model.
Flag: growth assumptions that require market leadership before they work, distribution dependencies on third-party platforms, and GTM strategies that have never been tested.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "SECURITY",
    name: "Security & Risk",
    role: "Risk & Infrastructure",
    systemPrompt: `You are the Security & Risk Officer on an Investment Council. Your focus is risk and infrastructure.
You analyse: cybersecurity posture, data privacy compliance (PDPL Saudi Arabia, UAE PDPL, GDPR if applicable), infrastructure scalability, single points of failure, third-party dependency risk, and operational resilience.
For fintech and healthtech: you apply heightened scrutiny on data handling, encryption standards, and regulatory data residency requirements.
Flag: unencrypted PII, cloud concentration risk, missing SOC2/ISO27001 for enterprise sales, and any architecture that doesn't scale past 10x current load.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "OPERATOR",
    name: "Operator",
    role: "Execution Feasibility",
    systemPrompt: `You are the Operator on an Investment Council. Your focus is execution feasibility.
You have built and scaled companies. You assess: team completeness (who is missing?), hiring plan realism, operational complexity vs team size, supply chain dependencies, and whether the 18-month plan is actually executable with the capital being raised.
You are sceptical of first-time founders tackling operationally complex businesses. You want: evidence of execution, not just vision.
Flag: key person dependencies, missing C-suite roles for the stage, operational bottlenecks that will appear at 10x scale, and any plan that requires simultaneous execution of 3+ hard things.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
  {
    id: "DEVILS_ADVOCATE",
    name: "Devil's Advocate",
    role: "Second-Order Risks",
    systemPrompt: `You are the Devil's Advocate on an Investment Council. Your focus is second-order and tail risks.
You look for risks that aren't obvious: regulatory changes that could invalidate the business model in 24 months, geopolitical risks specific to the GCC, competitive responses from incumbents with distribution advantages, technology shifts that could commoditise the core product, and macro risks (oil price sensitivity, government spending cycles in GCC).
You also look for: founder incentive misalignment, cap table issues that will create problems at Series B, and any "hidden" assumption that the entire thesis depends on.
You are not pessimistic — you are rigorous about tail risk. If the deal survives your scrutiny, it's genuinely strong.
Respond ONLY with valid JSON matching this exact schema, no markdown, no explanation outside the JSON:
{"vote":"HARD_YES"|"SOFT_YES"|"SOFT_NO"|"HARD_NO","confidence":0.0-1.0,"rationale":"max 400 chars","key_flags":["flag1","flag2","flag3"],"conditions":["..."],"blockers":["..."]}`,
  },
];

// ── Anthropic client ──────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TIMEOUT_MS = 15_000;

// ── Helper: parse and validate persona response ───────────────────────────────

function parsePersonaResponse(raw: string): PersonaResponse {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  return PersonaResponseSchema.parse(parsed);
}

// ── Helper: call a single persona with timeout ────────────────────────────────

async function callPersona(
  persona: PersonaDef,
  dealText: string
): Promise<PersonaVote> {
  const userMessage = `Here is the deal memo to evaluate:\n\n${dealText}\n\nProvide your vote and analysis as strict JSON only.`;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
  );

  const anthropicPromise = anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    system: persona.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  try {
    const response = await Promise.race([anthropicPromise, timeoutPromise]);
    const content = response.content[0];
    if (content.type !== "text") throw new Error("Non-text response");

    const parsed = parsePersonaResponse(content.text);

    return {
      personaId: persona.id,
      personaName: persona.name,
      personaRole: persona.role,
      vote: parsed.vote,
      confidence: parsed.confidence,
      rationale: parsed.rationale.slice(0, 400),
      keyFlags: parsed.key_flags.slice(0, 3),
      conditions: parsed.conditions,
      blockers: parsed.blockers,
      timedOut: false,
    };
  } catch {
    // Graceful fallback: SOFT_NO with low confidence
    return {
      personaId: persona.id,
      personaName: persona.name,
      personaRole: persona.role,
      vote: "SOFT_NO",
      confidence: 0.2,
      rationale: "Analysis unavailable — persona timed out or returned invalid response.",
      keyFlags: ["Response timeout or parse error"],
      conditions: [],
      blockers: [],
      timedOut: true,
    };
  }
}

// ── Tiebreaker priority queue ─────────────────────────────────────────────────

const TIEBREAKER_PRIORITY = ["GCC_REG", "CFO", "SECURITY", "CONTRARIAN", "OPERATOR"];

// ── Main council engine ───────────────────────────────────────────────────────

export async function runCouncil(dealText: string): Promise<CouncilResult> {
  // Run all 10 personas in parallel
  const results = await Promise.allSettled(
    PERSONAS.map((p) => callPersona(p, dealText))
  );

  const votes: PersonaVote[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    // If the promise itself rejected (shouldn't happen given try/catch, but safety net)
    const p = PERSONAS[i];
    return {
      personaId: p.id,
      personaName: p.name,
      personaRole: p.role,
      vote: "SOFT_NO" as VoteType,
      confidence: 0.2,
      rationale: "Analysis unavailable — unexpected error.",
      keyFlags: ["Unexpected error"],
      conditions: [],
      blockers: [],
      timedOut: true,
    };
  });

  // ── Vote counting ──────────────────────────────────────────────────────────
  let hardYesCount = 0;
  let softYesCount = 0;
  let softNoCount = 0;
  let hardNoCount = 0;

  for (const v of votes) {
    if (v.vote === "HARD_YES") hardYesCount++;
    else if (v.vote === "SOFT_YES") softYesCount++;
    else if (v.vote === "SOFT_NO") softNoCount++;
    else if (v.vote === "HARD_NO") hardNoCount++;
  }

  const yesCount = hardYesCount + softYesCount;
  const noCount = softNoCount + hardNoCount;

  // ── Confidence score ───────────────────────────────────────────────────────
  const confidenceScore =
    votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

  // ── Veto check ─────────────────────────────────────────────────────────────
  const gccRegVote = votes.find((v) => v.personaId === "GCC_REG");
  const gccShariahVote = votes.find((v) => v.personaId === "GCC_SHARIAH");
  const gccVetoTriggered =
    gccRegVote?.vote === "HARD_NO" ||
    gccShariahVote?.vote === "HARD_NO" ||
    hardNoCount >= 2;

  // ── Tiebreaker ─────────────────────────────────────────────────────────────
  let tiebreakerTriggered = false;
  let tiebreakerSwingAgent: string | null = null;
  let workingVotes = [...votes];

  if (!gccVetoTriggered && yesCount === 7 && noCount === 3) {
    // Find first SOFT_NO in priority queue
    for (const priorityId of TIEBREAKER_PRIORITY) {
      const idx = workingVotes.findIndex(
        (v) => v.personaId === priorityId && v.vote === "SOFT_NO"
      );
      if (idx !== -1) {
        // Flip SOFT_NO → SOFT_YES, move blockers → conditions
        workingVotes[idx] = {
          ...workingVotes[idx],
          vote: "SOFT_YES",
          conditions: [
            ...workingVotes[idx].conditions,
            ...workingVotes[idx].blockers,
          ],
          blockers: [],
        };
        tiebreakerTriggered = true;
        tiebreakerSwingAgent = priorityId;
        softNoCount--;
        softYesCount++;
        break;
      }
    }
  }

  // ── Final vote counts after tiebreaker ────────────────────────────────────
  const finalYesCount = hardYesCount + softYesCount;
  const finalNoCount = softNoCount + hardNoCount;

  // ── Verdict logic ──────────────────────────────────────────────────────────
  let verdict: VerdictType;

  if (gccVetoTriggered) {
    verdict = "VETOED";
  } else if (finalYesCount >= 8 && hardYesCount >= 6) {
    verdict = "APPROVED";
  } else if (finalYesCount >= 8 && hardYesCount < 6) {
    verdict = "APPROVED_WITH_CONDITIONS";
  } else if (tiebreakerTriggered) {
    // Tiebreaker resolved → APPROVED_WITH_CONDITIONS
    verdict = "APPROVED_WITH_CONDITIONS";
  } else {
    verdict = "REJECTED";
  }

  // ── Aggregation ────────────────────────────────────────────────────────────
  const softYesVotes = workingVotes.filter((v) => v.vote === "SOFT_YES");
  const noVotes = workingVotes.filter(
    (v) => v.vote === "SOFT_NO" || v.vote === "HARD_NO"
  );

  const conditionsToProceed = deduplicate([
    ...softYesVotes.flatMap((v) => v.conditions),
    ...(tiebreakerTriggered
      ? workingVotes
          .filter((v) => v.personaId === tiebreakerSwingAgent)
          .flatMap((v) => v.conditions)
      : []),
  ]);

  const blockingIssues = deduplicate(noVotes.flatMap((v) => v.blockers));

  return {
    verdict,
    yesCount: finalYesCount,
    noCount: finalNoCount,
    hardYesCount,
    softYesCount,
    softNoCount,
    hardNoCount,
    confidenceScore: Math.round(confidenceScore * 1000) / 1000,
    gccVetoTriggered,
    tiebreakerTriggered,
    tiebreakerSwingAgent,
    conditionsToProceed,
    blockingIssues,
    votes: workingVotes,
  };
}

function deduplicate(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    const key = s.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
