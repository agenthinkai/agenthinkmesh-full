/**
 * icReportEngine.ts — Boardroom-Ready IC Report Generator
 *
 * Converts structured Council of 10 consensus output into an institutional-grade
 * Investment Committee report using a McKinsey/Goldman-standard LLM prompt.
 *
 * Two modes:
 *   generateSingleDealICReport()   — full 8-section IC report for one deal
 *   generateComparisonICReport()   — comparison summary + per-deal mini IC reports
 *
 * Rules:
 *   - Always called server-side (never exposes API keys to frontend)
 *   - Additive only — never modifies or replaces existing CouncilResult data
 *   - Returns structured JSON for type-safe rendering
 */

import { invokeLLM } from "./_core/llm";
import type { CouncilResult } from "./councilEngine";
import type { DealAnalysisResult, ComparisonSummary, RankedDeal } from "./comparisonEngine";

// ── Output types ──────────────────────────────────────────────────────────────

export interface ICReportSection {
  title: string;
  content: string[];   // Array of lines/bullets for flexible rendering
}

export interface VCSummary {
  verdictLine: string;          // e.g. "CONDITIONAL APPROVE — 6/10"
  convictionLine: string;       // one sharp sentence, partner-voice
  keyPositives: string[];       // max 3 bullets
  whyWePass: string[];          // max 3 bullets (risks / pass reasons)
  whatWouldChange: string[];    // max 3 bullets
}

export interface SingleDealICReport {
  dealName: string;
  generatedAt: string;
  vcSummary?: VCSummary;        // VC-facing summary block (internal only)
  verificationBanner: {
    consensusScore: number;           // e.g. 80 (percent)
    confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
    conflictStatus: string;           // "No high-risk conflicts detected" | "High disagreement detected..."
  };
  executiveVerdict: {
    decision: "APPROVE" | "REJECT" | "CONDITIONAL APPROVE";
    recommendedAction: string;
    rationale: string;
  };
  investmentThesis: string[];         // 3 strongest arguments
  keyRisks: string[];                 // 3–5 critical risks
  decisionTriggers: {
    upgradeTriggers: string[];
    downgradeTriggers: string[];
  };
  consensusBreakdown: {
    approve: number;
    reject: number;
    conditional: number;
    keyDisagreements: string[];
  };
  thirtyDayActionPlan: string[];      // numbered list
  marketAndRegulatoryContext: string[]; // max 5 bullets
  rawText: string;                    // full formatted report as plain text (for copy)
}

export interface MiniICReport {
  dealName: string;
  decision: "APPROVE" | "REJECT" | "CONDITIONAL APPROVE";
  score: number;
  topStrength: string;
  topRisk: string;
  recommendedAction: string;
  rationale: string;
}

export interface ComparisonICReport {
  generatedAt: string;
  comparisonSummary: {
    winner: string;
    winnerRationale: string;
    keyTradeoffs: string[];
    portfolioRecommendation: string;
  };
  dealReports: MiniICReport[];
  rawText: string;  // full formatted report as plain text (for copy)
}

// ── System prompt (McKinsey/Goldman IC standard) ──────────────────────────────

const IC_SYSTEM_PROMPT = `You are a senior Investment Committee (IC) analyst at a Tier-1 firm (McKinsey / Goldman Sachs standard).

Your task is to convert structured AI consensus output into a boardroom-ready IC report.

This is NOT an AI summary.
This is a decision document that will be read by partners and investment committees.

Tone:
- concise
- authoritative
- no fluff
- no AI language (no "based on analysis", "it is worth noting", "it should be noted")
- no repetition
- every sentence must add value

STRICT RULES:
- No filler words
- No AI tone
- No long paragraphs
- No repetition
- No disclaimers
- Must read like a human expert wrote it
- Be direct — no soft language`;

const VC_SUMMARY_PROMPT = `You are a senior VC partner writing a 60-second internal memo for a Monday morning IC call.

RULES:
- No AI language. No phrases like "multi-agent", "consensus", "confidence level", "based on analysis".
- No long paragraphs. Bullets only.
- Every bullet must be specific — no generic risk language.
- Conviction line: write it as you would say it out loud in an IC meeting. Direct, opinionated, no hedging.
- If verdict is REJECT or VETOED: lead with the structural flaw. Do NOT open with positives.
- If verdict is APPROVE or CONDITIONAL APPROVE: lead with the non-obvious opportunity.
- Max 3 bullets per section. Fewer is better if the point is made.`;

// ── Single deal IC report ─────────────────────────────────────────────────────
export async function generateSingleDealICReport(
  dealName: string,
  dealText: string,
  result: CouncilResult
): Promise<SingleDealICReport> {
  const yesPct = Math.round((result.yesCount / 10) * 100);
  const confidencePct = Math.round(result.confidenceScore * 100);
  const confidenceLevel: "LOW" | "MEDIUM" | "HIGH" =
    result.confidenceScore >= 0.7 ? "HIGH" :
    result.confidenceScore >= 0.4 ? "MEDIUM" : "LOW";

  // Aggregate key flags from all votes
  const allFlags = result.votes.flatMap(v => v.keyFlags ?? []);
  const allConditions = result.conditionsToProceed ?? [];
  const allBlockers = result.blockingIssues ?? [];

  // Collect agreements (HARD_YES rationales) and disagreements (HARD_NO rationales)
  const agreements = result.votes
    .filter(v => v.vote === "HARD_YES" || v.vote === "SOFT_YES")
    .map(v => `${v.personaName} (${v.personaRole}): ${v.rationale}`)
    .slice(0, 5);

  const disagreements = result.votes
    .filter(v => v.vote === "HARD_NO" || v.vote === "SOFT_NO")
    .map(v => `${v.personaName} (${v.personaRole}): ${v.rationale}`)
    .slice(0, 5);

  const userPrompt = `Convert the following Council of 10 consensus data into a boardroom-ready IC report.

DEAL: ${dealName}

DEAL SUMMARY:
${dealText.slice(0, 800)}

CONSENSUS ENGINE OUTPUT:
- Decision: ${result.verdict.replace(/_/g, " ")}
- Yes votes: ${result.yesCount}/10 (${yesPct}%)
- No votes: ${result.noCount}/10
- Hard Yes: ${result.hardYesCount} | Soft Yes: ${result.softYesCount} | Soft No: ${result.softNoCount} | Hard No: ${result.hardNoCount}
- Confidence Score: ${confidencePct}%
- GCC Veto Triggered: ${result.gccVetoTriggered}
- Tiebreaker Triggered: ${result.tiebreakerTriggered}${result.tiebreakerSwingAgent ? ` (${result.tiebreakerSwingAgent})` : ""}

KEY AGREEMENTS (approving agents):
${agreements.length > 0 ? agreements.map(a => `- ${a}`).join("\n") : "- None recorded"}

KEY DISAGREEMENTS (rejecting agents):
${disagreements.length > 0 ? disagreements.map(d => `- ${d}`).join("\n") : "- None recorded"}

RISK FLAGS:
${allFlags.length > 0 ? allFlags.slice(0, 8).map(f => `- ${f}`).join("\n") : "- None flagged"}

CONDITIONS TO PROCEED:
${allConditions.length > 0 ? allConditions.map(c => `- ${c}`).join("\n") : "- None required"}

BLOCKING ISSUES:
${allBlockers.length > 0 ? allBlockers.map(b => `- ${b}`).join("\n") : "- None identified"}

MARKET CONTEXT (from agent rationales):
${result.votes.filter(v => v.rationale.length > 50).slice(0, 3).map(v => `- ${v.personaRole}: ${v.rationale.slice(0, 150)}`).join("\n")}

30-DAY CHECKLIST (from conditions):
${allConditions.slice(0, 8).map((c, i) => `${i + 1}. ${c}`).join("\n")}

---

Respond with a JSON object matching this exact schema (no markdown, raw JSON only):
{
  "vcSummary": {
    "verdictLine": "<e.g. CONDITIONAL APPROVE — 6/10>",
    "convictionLine": "<one sharp sentence — partner voice, no hedging>",
    "keyPositives": ["<max 3 bullets — specific, non-obvious strengths>"],
    "whyWePass": ["<max 3 bullets — structural risks or pass reasons; if REJECT lead with the killer flaw>"],
    "whatWouldChange": ["<max 3 bullets — specific data points or events that would flip the decision>"]
  },
  "verificationBanner": {
    "consensusScore": 0,
    "confidenceLevel": "MEDIUM",
    "conflictStatus": "<one sentence>"
  },
  "executiveVerdict": {
    "decision": "APPROVE",
    "recommendedAction": "<one of: Proceed to IC review | Validate via pilot | Defer pending conditions | Reject and archive>",
    "rationale": "<one sharp sentence>"
  },
  "investmentThesis": ["<point 1>", "<point 2>", "<point 3>"],
  "keyRisks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "decisionTriggers": {
    "upgradeTriggers": ["<trigger 1>", "<trigger 2>"],
    "downgradeTriggers": ["<trigger 1>", "<trigger 2>"]
  },
  "consensusBreakdown": {
    "approve": 0,
    "reject": 0,
    "conditional": 0,
    "keyDisagreements": ["<disagreement 1>", "<disagreement 2>"]
  },
  "thirtyDayActionPlan": ["<action 1>", "<action 2>", "<action 3>", "<action 4>", "<action 5>"],
  "marketAndRegulatoryContext": ["<point 1>", "<point 2>", "<point 3>"]
}`;


  const response = await invokeLLM({
    messages: [
      { role: "system", content: IC_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ic_report",
        strict: true,
        schema: {
          type: "object",
          properties: {
            verificationBanner: {
              type: "object",
              properties: {
                consensusScore: { type: "number" },
                confidenceLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
                conflictStatus: { type: "string" },
              },
              required: ["consensusScore", "confidenceLevel", "conflictStatus"],
              additionalProperties: false,
            },
            executiveVerdict: {
              type: "object",
              properties: {
                decision: { type: "string", enum: ["APPROVE", "REJECT", "CONDITIONAL APPROVE"] },
                recommendedAction: { type: "string" },
                rationale: { type: "string" },
              },
              required: ["decision", "recommendedAction", "rationale"],
              additionalProperties: false,
            },
            investmentThesis: { type: "array", items: { type: "string" } },
            keyRisks: { type: "array", items: { type: "string" } },
            decisionTriggers: {
              type: "object",
              properties: {
                upgradeTriggers: { type: "array", items: { type: "string" } },
                downgradeTriggers: { type: "array", items: { type: "string" } },
              },
              required: ["upgradeTriggers", "downgradeTriggers"],
              additionalProperties: false,
            },
            consensusBreakdown: {
              type: "object",
              properties: {
                approve: { type: "number" },
                reject: { type: "number" },
                conditional: { type: "number" },
                keyDisagreements: { type: "array", items: { type: "string" } },
              },
              required: ["approve", "reject", "conditional", "keyDisagreements"],
              additionalProperties: false,
            },
            thirtyDayActionPlan: { type: "array", items: { type: "string" } },
            marketAndRegulatoryContext: { type: "array", items: { type: "string" } },
            vcSummary: {
              type: "object",
              properties: {
                verdictLine:     { type: "string" },
                convictionLine:  { type: "string" },
                keyPositives:    { type: "array", items: { type: "string" } },
                whyWePass:       { type: "array", items: { type: "string" } },
                whatWouldChange: { type: "array", items: { type: "string" } },
              },
              required: ["verdictLine", "convictionLine", "keyPositives", "whyWePass", "whatWouldChange"],
              additionalProperties: false,
            },
          },
          required: [
            "vcSummary", "verificationBanner", "executiveVerdict", "investmentThesis",
            "keyRisks", "decisionTriggers", "consensusBreakdown",
            "thirtyDayActionPlan", "marketAndRegulatoryContext",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0].message.content as string;
  const parsed = JSON.parse(raw);

  const report: SingleDealICReport = {
    dealName,
    generatedAt: new Date().toISOString(),
    verificationBanner: {
      consensusScore: parsed.verificationBanner.consensusScore,
      confidenceLevel: parsed.verificationBanner.confidenceLevel,
      conflictStatus: parsed.verificationBanner.conflictStatus,
    },
    executiveVerdict: parsed.executiveVerdict,
    investmentThesis: parsed.investmentThesis,
    keyRisks: parsed.keyRisks,
    decisionTriggers: parsed.decisionTriggers,
    consensusBreakdown: parsed.consensusBreakdown,
    thirtyDayActionPlan: parsed.thirtyDayActionPlan,
    marketAndRegulatoryContext: parsed.marketAndRegulatoryContext,
    vcSummary: parsed.vcSummary ?? undefined,
    rawText: formatSingleDealReportText(dealName, parsed),
  };

  return report;
}

// ── Comparison IC report ──────────────────────────────────────────────────────

export async function generateComparisonICReport(
  dealAnalyses: DealAnalysisResult[],
  comparisonSummary: ComparisonSummary
): Promise<ComparisonICReport> {
  const successfulDeals = dealAnalyses.filter(d => d.status === "success" && d.data);
  const rankedDeals = comparisonSummary.rankedDeals;

  const dealsContext = successfulDeals.map(d => {
    const ranked = rankedDeals.find(r => r.dealName === d.dealName);
    return `
DEAL: ${d.dealName}
  Decision: ${d.data!.finalDecision.replace(/_/g, " ")}
  Consensus: ${d.data!.consensusPercentage}%
  Confidence: ${d.data!.confidenceLevel}
  Score: ${ranked?.overallScore ?? "N/A"}/10
  Rank: #${ranked?.overallRank ?? "N/A"}
  Key Agreements: ${d.data!.keyAgreements.slice(0, 3).join(" | ")}
  Risk Flags: ${d.data!.riskFlags.slice(0, 3).join(" | ")}
  30-Day Checklist: ${d.data!.thirtyDayChecklist.slice(0, 3).join(" | ")}`;
  }).join("\n");

  const userPrompt = `Convert the following multi-deal comparison data into a boardroom-ready IC comparison report.

IC SUMMARY:
- Best Overall: ${comparisonSummary.bestOverall}
- Lowest Risk: ${comparisonSummary.lowestRisk}
- Highest Upside: ${comparisonSummary.highestUpside}
- Most IC-Ready: ${comparisonSummary.mostIcReady}
- Key Tradeoffs: ${comparisonSummary.keyTradeoffs.join(" | ")}

DEAL ANALYSES:
${dealsContext}

---

Respond with a JSON object matching this exact schema (no markdown, raw JSON only):
{
  "comparisonSummary": {
    "winner": "<deal name>",
    "winnerRationale": "<one sharp sentence>",
    "keyTradeoffs": ["<tradeoff 1>", "<tradeoff 2>", "<tradeoff 3>"],
    "portfolioRecommendation": "<one actionable sentence>"
  },
  "dealReports": [
    {
      "dealName": "<name>",
      "decision": "APPROVE" | "REJECT" | "CONDITIONAL APPROVE",
      "score": <number 1-10>,
      "topStrength": "<one sentence>",
      "topRisk": "<one sentence>",
      "recommendedAction": "<one of: Proceed to IC review | Validate via pilot | Defer pending conditions | Reject and archive>",
      "rationale": "<one sharp sentence>"
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: IC_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "comparison_ic_report",
        strict: true,
        schema: {
          type: "object",
          properties: {
            comparisonSummary: {
              type: "object",
              properties: {
                winner: { type: "string" },
                winnerRationale: { type: "string" },
                keyTradeoffs: { type: "array", items: { type: "string" } },
                portfolioRecommendation: { type: "string" },
              },
              required: ["winner", "winnerRationale", "keyTradeoffs", "portfolioRecommendation"],
              additionalProperties: false,
            },
            dealReports: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dealName: { type: "string" },
                  decision: { type: "string", enum: ["APPROVE", "REJECT", "CONDITIONAL APPROVE"] },
                  score: { type: "number" },
                  topStrength: { type: "string" },
                  topRisk: { type: "string" },
                  recommendedAction: { type: "string" },
                  rationale: { type: "string" },
                },
                required: ["dealName", "decision", "score", "topStrength", "topRisk", "recommendedAction", "rationale"],
                additionalProperties: false,
              },
            },
          },
          required: ["comparisonSummary", "dealReports"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices[0].message.content as string;
  const parsed = JSON.parse(raw);

  return {
    generatedAt: new Date().toISOString(),
    comparisonSummary: parsed.comparisonSummary,
    dealReports: parsed.dealReports,
    rawText: formatComparisonReportText(parsed, comparisonSummary.rankedDeals),
  };
}

// ── Plain-text formatters (for copy button) ───────────────────────────────────

function formatSingleDealReportText(dealName: string, p: Record<string, unknown>): string {
  const vb = p.verificationBanner as SingleDealICReport["verificationBanner"];
  const ev = p.executiveVerdict as SingleDealICReport["executiveVerdict"];
  const dt = p.decisionTriggers as SingleDealICReport["decisionTriggers"];
  const cb = p.consensusBreakdown as SingleDealICReport["consensusBreakdown"];
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("INVESTMENT COMMITTEE REPORT");
  lines.push(`Deal: ${dealName}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("1. VERIFICATION BANNER");
  lines.push("-".repeat(40));
  lines.push("Multi-Agent Consensus Verified");
  lines.push(`Consensus Score: ${vb.consensusScore}%`);
  lines.push(`Confidence Level: ${vb.confidenceLevel}`);
  lines.push(vb.conflictStatus);
  lines.push("");
  lines.push("2. EXECUTIVE VERDICT");
  lines.push("-".repeat(40));
  lines.push(`Decision: ${ev.decision}`);
  lines.push(`Recommended Action: ${ev.recommendedAction}`);
  lines.push(`Rationale: ${ev.rationale}`);
  lines.push("");
  lines.push("3. INVESTMENT THESIS");
  lines.push("-".repeat(40));
  (p.investmentThesis as string[]).forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push("");
  lines.push("4. KEY RISKS / RED FLAGS");
  lines.push("-".repeat(40));
  (p.keyRisks as string[]).forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  lines.push("");
  lines.push("5. WHAT WOULD CHANGE THIS DECISION");
  lines.push("-".repeat(40));
  lines.push("Upgrade Triggers:");
  dt.upgradeTriggers.forEach(t => lines.push(`  + ${t}`));
  lines.push("Downgrade Triggers:");
  dt.downgradeTriggers.forEach(t => lines.push(`  - ${t}`));
  lines.push("");
  lines.push("6. CONSENSUS BREAKDOWN");
  lines.push("-".repeat(40));
  lines.push(`Approve: ${cb.approve}  |  Reject: ${cb.reject}  |  Conditional: ${cb.conditional}`);
  lines.push("Key Disagreements:");
  cb.keyDisagreements.forEach(d => lines.push(`  ! ${d}`));
  lines.push("");
  lines.push("7. 30-DAY ACTION PLAN");
  lines.push("-".repeat(40));
  (p.thirtyDayActionPlan as string[]).forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  lines.push("");
  lines.push("8. MARKET & REGULATORY CONTEXT");
  lines.push("-".repeat(40));
  (p.marketAndRegulatoryContext as string[]).forEach(m => lines.push(`• ${m}`));
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("Generated by AgenThinkMesh — Council of 10");
  lines.push("https://agenthink-7enctkan.manus.space/deals");

  return lines.join("\n");
}

function formatComparisonReportText(
  p: { comparisonSummary: ComparisonICReport["comparisonSummary"]; dealReports: MiniICReport[] },
  rankedDeals: RankedDeal[]
): string {
  const lines: string[] = [];
  const cs = p.comparisonSummary;

  lines.push("=".repeat(60));
  lines.push("INVESTMENT COMMITTEE — DEAL COMPARISON REPORT");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("COMPARISON SUMMARY");
  lines.push("-".repeat(40));
  lines.push(`Winner: ${cs.winner}`);
  lines.push(`Rationale: ${cs.winnerRationale}`);
  lines.push("Key Tradeoffs:");
  cs.keyTradeoffs.forEach(t => lines.push(`  • ${t}`));
  lines.push(`Portfolio Recommendation: ${cs.portfolioRecommendation}`);
  lines.push("");
  lines.push("RANKED DEALS — IC SUMMARY");
  lines.push("-".repeat(40));

  // Sort by rank from rankedDeals
  const sorted = [...p.dealReports].sort((a, b) => {
    const ra = rankedDeals.find(r => r.dealName === a.dealName)?.overallRank ?? 99;
    const rb = rankedDeals.find(r => r.dealName === b.dealName)?.overallRank ?? 99;
    return ra - rb;
  });

  sorted.forEach((d, i) => {
    const ranked = rankedDeals.find(r => r.dealName === d.dealName);
    lines.push("");
    lines.push(`#${ranked?.overallRank ?? i + 1}  ${d.dealName}`);
    lines.push(`    Decision:           ${d.decision}`);
    lines.push(`    Score:              ${d.score}/10`);
    lines.push(`    Recommended Action: ${d.recommendedAction}`);
    lines.push(`    Rationale:          ${d.rationale}`);
    lines.push(`    Top Strength:       ${d.topStrength}`);
    lines.push(`    Top Risk:           ${d.topRisk}`);
  });

  lines.push("");
  lines.push("=".repeat(60));
  lines.push("Generated by AgenThinkMesh — Council of 10");
  lines.push("https://agenthink-7enctkan.manus.space/deals/compare");

  return lines.join("\n");
}
