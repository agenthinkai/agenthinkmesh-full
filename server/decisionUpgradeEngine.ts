/**
 * server/decisionUpgradeEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Closed-Loop Decision Upgrade System
 *
 * Generates a structured "Decision Upgrade Protocol" from a rejected or
 * conditional evaluation result, then applies fixes and re-runs the pipeline
 * to produce a "Delta Output" showing the improvement.
 *
 * Domains: deal | procurement | enterprise | hiring
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FixTag = "ASSUMED" | "IMPROVED" | "USER_REQUIRED";

export interface UpgradeFix {
  id: string;            // e.g. "fix_001"
  category: "missing_input" | "performance_gap" | "structural_issue" | "narrative" | "risk_mitigation";
  title: string;
  description: string;   // what is wrong
  suggestion: string;    // what to change / add
  tag: FixTag;           // ASSUMED | IMPROVED | USER_REQUIRED
  fieldPath?: string;    // which input field this fix applies to (optional)
  exampleValue?: string; // synthetic example value (only for ASSUMED fixes)
}

export interface UpgradeProtocol {
  missingInputs: UpgradeFix[];
  performanceGaps: UpgradeFix[];
  structuralIssues: UpgradeFix[];
  narrativeFix: {
    original: string;
    improved: string;
    rationale: string;
  };
  riskMitigationActions: UpgradeFix[];
  expectedOutcomeShift: {
    predictedVerdict: string;
    confidenceDelta: number;   // e.g. +0.15 means +15%
    rationale: string;
  };
  allFixes: UpgradeFix[];      // flat list for checkbox UI
}

export interface AppliedFix extends UpgradeFix {
  applied: boolean;
  userEdited?: string;         // if user edited the suggestion before applying
}

export interface DeltaOutput {
  verdictBefore: string;
  verdictAfter: string;
  verdictChanged: boolean;
  confidenceBefore: number;
  confidenceAfter: number;
  confidenceDelta: number;     // signed, e.g. +0.18
  keyMetricChanges: Array<{
    metric: string;
    before: string;
    after: string;
    direction: "improved" | "unchanged" | "worsened";
  }>;
  topImprovementFactors: string[];
  remainingGaps: string[];
  summary: string;
}

// ─── Domain-specific fix prompts ─────────────────────────────────────────────

const DOMAIN_CONTEXT: Record<string, string> = {
  deal: `
Domain: Venture / Private Equity Deal Screening
Key metrics to check: CAC/LTV ratio, revenue growth rate, burn rate, runway, market TAM/SAM, competitive moat, founding team track record, unit economics clarity.
Common rejection reasons: missing financials, unclear go-to-market, no defensibility, high burn with no path to profitability, weak team credentials.
Benchmark thresholds: LTV/CAC > 3x, MoM growth > 10%, runway > 18 months, gross margin > 60% for SaaS.`,

  procurement: `
Domain: Procurement / Vendor Evaluation
Key metrics to check: SLA compliance history, total cost of ownership vs benchmark, security certifications (ISO 27001, SOC2), vendor financial stability, contract lock-in risk, integration complexity.
Common rejection reasons: missing compliance certs, no SLA guarantees, opaque pricing, single-vendor dependency risk, poor security posture.
Benchmark thresholds: SLA uptime > 99.5%, security cert within 2 years, contract exit clause within 90 days.`,

  enterprise: `
Domain: Enterprise Decision / Internal Initiative
Key metrics to check: projected ROI, payback period, total cost of ownership, KPI ownership clarity, change management plan, executive sponsorship.
Common rejection reasons: unclear ROI, no KPI ownership, missing change management plan, budget overrun risk.
Benchmark thresholds: ROI > 150% over 3 years, payback < 24 months.`,

  hiring: `
Domain: Hiring / Talent Evaluation
Key metrics to check: years of relevant experience, reference quality, skill validation, culture fit signals, compensation alignment.
Common rejection reasons: experience gap, no verifiable references, skill mismatch, compensation misalignment.
Benchmark thresholds: 3+ years direct experience, 2+ verifiable references.`,
};

// ─── Exported sanitizeFix (also used internally) ─────────────────────────────

const VALID_TAGS: UpgradeFix["tag"][] = ["ASSUMED", "IMPROVED", "USER_REQUIRED"];
const VALID_CATEGORIES: UpgradeFix["category"][] = [
  "missing_input", "performance_gap", "structural_issue", "narrative", "risk_mitigation",
];

/** Coerce a value to string safely — handles Symbol, functions, and other non-serializable types */
function safeString(v: any): string {
  if (v == null) return "";
  try {
    return String(v);
  } catch {
    return "";
  }
}

/**
 * Sanitize a raw LLM-emitted fix object.
 * Ensures all fields are valid types regardless of LLM output quality.
 * - exampleValue: always a string (never null/undefined)
 * - tag: always one of ASSUMED | IMPROVED | USER_REQUIRED
 * - category: always a valid category enum value
 * - All string fields: always strings (coerced from any type)
 * - fieldPath: always string or undefined (never null)
 * Exported for unit testing.
 */
export function sanitizeFix(f: any): UpgradeFix {
  const rawTag = f?.tag;
  const rawCategory = f?.category;
  const rawExampleValue = f?.exampleValue;
  const rawFieldPath = f?.fieldPath;

  return {
    id: (f?.id != null && f.id !== "") ? safeString(f.id) : `fix_${Math.random().toString(36).slice(2, 7)}`,
    category: VALID_CATEGORIES.includes(rawCategory) ? rawCategory : "missing_input",
    title: safeString(f?.title),
    description: safeString(f?.description),
    suggestion: safeString(f?.suggestion),
    tag: VALID_TAGS.includes(rawTag) ? rawTag : "USER_REQUIRED",
    fieldPath: rawFieldPath != null ? safeString(rawFieldPath) || undefined : undefined,
    exampleValue: rawExampleValue != null ? safeString(rawExampleValue) : "",
  };
}

// ─── Generate Upgrade Protocol ────────────────────────────────────────────────

export async function generateUpgradeProtocol(params: {
  domain: "deal" | "procurement" | "enterprise" | "hiring";
  originalInput: string;         // the original text submitted by the user
  verdictBefore: string;
  confidenceBefore: number;
  blockingIssues: string[];
  conditions: string[];
  agentFeedback: string;         // condensed agent rationale / key flags
  strictMode?: boolean;          // if true, no ASSUMED fixes
}): Promise<UpgradeProtocol> {
  const domainCtx = DOMAIN_CONTEXT[params.domain] ?? DOMAIN_CONTEXT.deal;
  const strictNote = params.strictMode
    ? "STRICT MODE: Do NOT generate any ASSUMED fixes. Only generate IMPROVED and USER_REQUIRED fixes."
    : "You may generate ASSUMED fixes with realistic synthetic placeholder values clearly labeled as [ASSUMED].";

  const prompt = `You are a senior decision advisor analyzing why an evaluation was ${params.verdictBefore} (confidence: ${(params.confidenceBefore * 100).toFixed(0)}%).

${domainCtx}

ORIGINAL SUBMISSION:
${params.originalInput.slice(0, 3000)}

BLOCKING ISSUES FROM EVALUATORS:
${params.blockingIssues.map((b, i) => `${i + 1}. ${b}`).join("\n")}

CONDITIONS TO PROCEED:
${params.conditions.map((c, i) => `${i + 1}. ${c}`).join("\n")}

AGENT FEEDBACK SUMMARY:
${params.agentFeedback.slice(0, 1500)}

${strictNote}

Generate a structured Decision Upgrade Protocol with exactly this JSON structure:
{
  "missingInputs": [
    {
      "id": "fix_001",
      "category": "missing_input",
      "title": "Short title",
      "description": "What is missing and why it matters",
      "suggestion": "Specific text to add or data to provide",
      "tag": "USER_REQUIRED" | "ASSUMED",
      "fieldPath": "optional field name",
      "exampleValue": "only for ASSUMED fixes — realistic placeholder"
    }
  ],
  "performanceGaps": [
    {
      "id": "fix_002",
      "category": "performance_gap",
      "title": "Short title",
      "description": "Which metric is below threshold and by how much",
      "suggestion": "How to address or reframe the metric",
      "tag": "IMPROVED" | "USER_REQUIRED",
      "fieldPath": "optional"
    }
  ],
  "structuralIssues": [
    {
      "id": "fix_003",
      "category": "structural_issue",
      "title": "Short title",
      "description": "What structural weakness exists",
      "suggestion": "How to fix the structure or process",
      "tag": "IMPROVED" | "USER_REQUIRED"
    }
  ],
  "narrativeFix": {
    "original": "Extract the weakest 1-2 sentences from the original submission",
    "improved": "Rewrite those sentences with stronger framing (2 lines max)",
    "rationale": "Why this reframing matters to evaluators"
  },
  "riskMitigationActions": [
    {
      "id": "fix_004",
      "category": "risk_mitigation",
      "title": "Short title",
      "description": "Which risk needs mitigation",
      "suggestion": "Specific mitigation action or statement to add",
      "tag": "IMPROVED" | "USER_REQUIRED"
    }
  ],
  "expectedOutcomeShift": {
    "predictedVerdict": "APPROVED_WITH_CONDITIONS" | "APPROVED" | "REJECTED",
    "confidenceDelta": 0.15,
    "rationale": "Why applying these fixes would shift the verdict"
  }
}

Rules:
- Generate 2-4 items per section (not more)
- Be specific — reference actual content from the submission
- ASSUMED fixes must have realistic exampleValue
- confidenceDelta must be between 0.05 and 0.40
- predictedVerdict must be better than ${params.verdictBefore}
- Return ONLY valid JSON, no markdown fences`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a structured decision upgrade advisor. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const rawContent = response.choices[0]?.message?.content ?? "{}";
  const content = typeof rawContent === "string" ? rawContent : "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  // Sanitize: use exported sanitizeFix helper (ensures exampleValue is never null)
  const missingInputs: UpgradeFix[] = (parsed.missingInputs ?? []).slice(0, 4).map(sanitizeFix);
  const performanceGaps: UpgradeFix[] = (parsed.performanceGaps ?? []).slice(0, 4).map(sanitizeFix);
  const structuralIssues: UpgradeFix[] = (parsed.structuralIssues ?? []).slice(0, 4).map(sanitizeFix);
  const riskMitigationActions: UpgradeFix[] = (parsed.riskMitigationActions ?? []).slice(0, 4).map(sanitizeFix);

  const allFixes: UpgradeFix[] = [
    ...missingInputs,
    ...performanceGaps,
    ...structuralIssues,
    ...riskMitigationActions,
  ];

  return {
    missingInputs,
    performanceGaps,
    structuralIssues,
    narrativeFix: parsed.narrativeFix ?? {
      original: "",
      improved: "",
      rationale: "",
    },
    riskMitigationActions,
    expectedOutcomeShift: parsed.expectedOutcomeShift ?? {
      predictedVerdict: "APPROVED_WITH_CONDITIONS",
      confidenceDelta: 0.10,
      rationale: "Addressing the identified gaps should improve evaluator confidence.",
    },
    allFixes,
  };
}

// ─── Build improved input text from applied fixes ─────────────────────────────

export function buildImprovedInput(
  originalInput: string,
  appliedFixes: AppliedFix[],
  narrativeFix: UpgradeProtocol["narrativeFix"],
): string {
  let improved = originalInput;

  // Apply narrative fix
  if (narrativeFix.original && narrativeFix.improved) {
    improved = improved.replace(narrativeFix.original, narrativeFix.improved);
  }

  // Append all applied fix suggestions as addendum
  const addendum = appliedFixes
    .filter((f) => f.applied)
    .map((f) => {
      const value = f.userEdited ?? f.suggestion ?? f.exampleValue ?? "";
      const tagLabel = f.tag === "ASSUMED" ? "[ASSUMED]" : f.tag === "IMPROVED" ? "[IMPROVED]" : "[USER REQUIRED]";
      return `${tagLabel} ${f.title}: ${value}`;
    })
    .join("\n");

  if (addendum) {
    improved += `\n\n--- ADDITIONAL INFORMATION (Applied Fixes) ---\n${addendum}`;
  }

  return improved;
}

// ─── Compute Delta Output ─────────────────────────────────────────────────────

export async function computeDeltaOutput(params: {
  domain: "deal" | "procurement" | "enterprise" | "hiring";
  verdictBefore: string;
  verdictAfter: string;
  confidenceBefore: number;
  confidenceAfter: number;
  appliedFixes: AppliedFix[];
  originalInput: string;
  improvedInput: string;
  blockingIssuesBefore: string[];
  blockingIssuesAfter: string[];
}): Promise<DeltaOutput> {
  const confidenceDelta = params.confidenceAfter - params.confidenceBefore;

  // Use LLM to generate the qualitative delta analysis
  const prompt = `You are a decision analysis expert comparing two evaluation runs.

DOMAIN: ${params.domain}

VERDICT CHANGE: ${params.verdictBefore} → ${params.verdictAfter}
CONFIDENCE CHANGE: ${(params.confidenceBefore * 100).toFixed(1)}% → ${(params.confidenceAfter * 100).toFixed(1)}% (${confidenceDelta >= 0 ? "+" : ""}${(confidenceDelta * 100).toFixed(1)}%)

FIXES APPLIED:
${params.appliedFixes.filter(f => f.applied).map(f => `- [${f.tag}] ${f.title}: ${f.userEdited ?? f.suggestion}`).join("\n")}

BLOCKING ISSUES BEFORE:
${params.blockingIssuesBefore.slice(0, 5).map((b, i) => `${i + 1}. ${b}`).join("\n")}

BLOCKING ISSUES AFTER:
${params.blockingIssuesAfter.slice(0, 5).map((b, i) => `${i + 1}. ${b}`).join("\n")}

Generate a delta analysis JSON:
{
  "keyMetricChanges": [
    { "metric": "metric name", "before": "before value/state", "after": "after value/state", "direction": "improved" | "unchanged" | "worsened" }
  ],
  "topImprovementFactors": ["factor 1", "factor 2", "factor 3"],
  "remainingGaps": ["gap 1", "gap 2"],
  "summary": "2-sentence summary of what changed and why the verdict shifted"
}

Rules:
- 3-5 key metric changes
- 2-4 improvement factors
- 1-3 remaining gaps (what still prevents full approval if not fully approved)
- Return ONLY valid JSON`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a decision delta analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" } as any,
  });

  const rawContent2 = response.choices[0]?.message?.content ?? "{}";
  const content = typeof rawContent2 === "string" ? rawContent2 : "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  return {
    verdictBefore: params.verdictBefore,
    verdictAfter: params.verdictAfter,
    verdictChanged: params.verdictBefore !== params.verdictAfter,
    confidenceBefore: params.confidenceBefore,
    confidenceAfter: params.confidenceAfter,
    confidenceDelta,
    keyMetricChanges: parsed.keyMetricChanges ?? [],
    topImprovementFactors: parsed.topImprovementFactors ?? [],
    remainingGaps: parsed.remainingGaps ?? [],
    summary: parsed.summary ?? "The improved submission addressed key gaps identified in the original evaluation.",
  };
}
