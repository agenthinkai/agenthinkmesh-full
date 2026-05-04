// server/lib/uaeRealEstateEngine.ts
//
// UAE Real Estate Council V1.3 — orchestration engine.
// 7 agents run in parallel, each returning a structured JSON vote.
// Decision-first output: BUY / WAIT / NEGOTIATE / AVOID
// Off-plan protocol: activated when propertyType === "off_plan"
// Confidence guardrail: LOW confidence (< 0.5) → downgrade BUY → WAIT
// Entry range: derived from Pricing + Yield + Location agents

import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { PERSONAS_UAE_RE, type AREPersonaDef } from "./personas-uae-realestate";

// ── Input schema ──────────────────────────────────────────────────────────────
export interface ARESignalRequest {
  // Property basics
  propertyType:    "ready" | "off_plan";
  assetClass:      "apartment" | "villa" | "townhouse" | "penthouse" | "commercial";
  emirate:         "dubai" | "abu_dhabi" | "sharjah" | "ras_al_khaimah" | "other";
  community:       string;   // e.g. "Downtown Dubai", "JVC", "Yas Island"
  developer:       string;   // e.g. "Emaar", "DAMAC", "Aldar"
  tower?:          string;   // optional tower/building name

  // Pricing
  askingPriceAED:  number;   // total asking price in AED
  areaSqft:        number;   // gross area in sqft
  ppsfAsking?:     number;   // optional — computed if absent
  ppsfComps?:      number;   // optional — RERA/DLD comp PPSF

  // Rental
  annualRentAED?:  number;   // expected annual rent
  serviceChargePerSqft?: number; // AED/sqft/year

  // Off-plan specific
  completionDate?: string;   // e.g. "Q4 2026"
  paymentPlan?:    string;   // e.g. "40/60 post-handover"
  constructionProgress?: number; // 0–100%
  escrowVerified?: boolean;

  // Analyst notes
  notes?:          string;
}

// ── Vote schema ───────────────────────────────────────────────────────────────
const AREVoteSchema = z.object({
  vote:       z.enum(["BUY", "WAIT", "NEGOTIATE", "AVOID"]),
  confidence: z.number().min(0).max(1),
  label:      z.string(),
  rationale:  z.string(),
  conditions: z.array(z.string()).default([]),
  blockers:   z.array(z.string()).default([]),
});
type AREVote = z.infer<typeof AREVoteSchema>;

// ── Per-agent result ──────────────────────────────────────────────────────────
export interface AREAgentResult {
  personaId:    string;
  name:         string;
  role:         string;
  vote:         "BUY" | "WAIT" | "NEGOTIATE" | "AVOID";
  confidence:   number;
  label:        string;
  rationale:    string;
  conditions:   string[];
  blockers:     string[];
  isSilentFail: boolean;
  rawResponse?: string;
}

// ── Council result ────────────────────────────────────────────────────────────
export interface ARECouncilResult {
  // Primary decision
  decision:        "BUY" | "WAIT" | "NEGOTIATE" | "AVOID";
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;   // 0–1 average across agents

  // Vote tally
  buyCount:        number;
  waitCount:       number;
  negotiateCount:  number;
  avoidCount:      number;

  // Top signals (max 3 — from highest-confidence YES/BUY agents)
  topSignals:      string[];

  // Key risk (single most material — from Risk Agent)
  keyRisk:         string;
  keyRiskLabel:    string;

  // Investment thesis (3–5 lines synthesised from all agents)
  investmentThesis: string;

  // Entry range (from Pricing + Yield + Location)
  entryRange: {
    fairValueLow:  number;
    fairValueHigh: number;
    idealEntry:    number;
    reasoning:     string;
  };

  // Off-plan risk summary (only if propertyType === "off_plan")
  offPlanRisk?: {
    paymentRisk:    string;
    delayRisk:      string;
    exitRisk:       string;
    mitigation:     string;
    riskLabel:      "LOW" | "MEDIUM" | "HIGH";
  };

  // Strategic view
  strategicView:   string;

  // Agent breakdown
  agents:          AREAgentResult[];

  // Meta
  sessionId:       string;
  durationMs:      number;
  guardrailApplied: boolean;  // true if BUY was downgraded to WAIT
  silentFails:     string[];
}

// ── Build evidence blob for agents ───────────────────────────────────────────
function buildPropertyBlob(req: ARESignalRequest): string {
  const ppsfAsking = req.ppsfAsking ?? (req.areaSqft > 0 ? Math.round(req.askingPriceAED / req.areaSqft) : 0);
  const grossYield = req.annualRentAED && req.askingPriceAED > 0
    ? ((req.annualRentAED / req.askingPriceAED) * 100).toFixed(2)
    : "N/A";
  const serviceCharge = req.serviceChargePerSqft ?? 15;
  const annualServiceCharge = req.areaSqft * serviceCharge;
  const vacancyLoss = req.annualRentAED ? req.annualRentAED * (1 / 12) : 0;
  const maintenanceReserve = req.askingPriceAED * 0.007;
  const netRentAED = req.annualRentAED
    ? req.annualRentAED - annualServiceCharge - vacancyLoss - maintenanceReserve
    : null;
  const netYield = netRentAED && req.askingPriceAED > 0
    ? ((netRentAED / req.askingPriceAED) * 100).toFixed(2)
    : "N/A";

  const lines = [
    "── PROPERTY BRIEF ──",
    `TYPE: ${req.propertyType.toUpperCase()} | ASSET: ${req.assetClass.toUpperCase()} | EMIRATE: ${req.emirate.toUpperCase()}`,
    `COMMUNITY: ${req.community}${req.tower ? ` | TOWER: ${req.tower}` : ""}`,
    `DEVELOPER: ${req.developer}`,
    "",
    "── PRICING ──",
    `ASKING PRICE: AED ${req.askingPriceAED.toLocaleString()}`,
    `AREA: ${req.areaSqft.toLocaleString()} sqft`,
    `ASKING PPSF: AED ${ppsfAsking.toLocaleString()}`,
    req.ppsfComps ? `COMP PPSF (RERA/DLD): AED ${req.ppsfComps.toLocaleString()}` : "COMP PPSF: not provided",
    req.ppsfComps ? `PREMIUM TO COMPS: ${(((ppsfAsking - req.ppsfComps) / req.ppsfComps) * 100).toFixed(1)}%` : "",
    "",
    "── RENTAL ECONOMICS ──",
    `ANNUAL RENT (expected): ${req.annualRentAED ? `AED ${req.annualRentAED.toLocaleString()}` : "not provided"}`,
    `GROSS YIELD: ${grossYield}%`,
    `SERVICE CHARGE: AED ${serviceCharge}/sqft/yr (AED ${Math.round(annualServiceCharge).toLocaleString()}/yr total)`,
    `NET YIELD (est.): ${netYield}%`,
    "",
  ];

  if (req.propertyType === "off_plan") {
    lines.push("── OFF-PLAN SPECIFICS ──");
    lines.push(`COMPLETION: ${req.completionDate ?? "not specified"}`);
    lines.push(`PAYMENT PLAN: ${req.paymentPlan ?? "not specified"}`);
    lines.push(`CONSTRUCTION PROGRESS: ${req.constructionProgress != null ? req.constructionProgress + "%" : "not specified"}`);
    lines.push(`ESCROW VERIFIED: ${req.escrowVerified != null ? (req.escrowVerified ? "YES" : "NO") : "not specified"}`);
    lines.push("");
  }

  if (req.notes) {
    lines.push("── ANALYST NOTES ──");
    lines.push(req.notes);
    lines.push("");
  }

  return lines.filter(l => l !== undefined).join("\n");
}

// ── Run a single agent ────────────────────────────────────────────────────────
async function runAgent(
  persona: AREPersonaDef,
  propertyBlob: string,
  isOffPlan: boolean,
): Promise<AREAgentResult> {
  const offPlanNote = isOffPlan && persona.id === "ARE_PAYMENT_DELIVERY_RISK"
    ? "\n\nOFF-PLAN PROTOCOL IS ACTIVE. This is an off-plan property. Your assessment is critical."
    : !isOffPlan && persona.id === "ARE_PAYMENT_DELIVERY_RISK"
    ? "\n\nThis is a READY property. Vote WAIT and set label to N/A. Rationale: N/A — ready property."
    : "";

  const userMessage = propertyBlob + offPlanNote;

  try {
    const response = await invokeLLM({
      model: "claude-sonnet-4-5",
      messages: [
        { role: "system", content: persona.systemPrompt },
        { role: "user",   content: userMessage },
      ],
    });

    const raw = (response as any)?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = AREVoteSchema.parse(JSON.parse(cleaned));

    return {
      personaId:    persona.id,
      name:         persona.name,
      role:         persona.role,
      vote:         parsed.vote,
      confidence:   parsed.confidence,
      label:        parsed.label,
      rationale:    parsed.rationale,
      conditions:   parsed.conditions,
      blockers:     parsed.blockers,
      isSilentFail: false,
      rawResponse:  raw,
    };
  } catch (err) {
    return {
      personaId:    persona.id,
      name:         persona.name,
      role:         persona.role,
      vote:         "WAIT",
      confidence:   0,
      label:        "ERROR",
      rationale:    "Agent failed to respond — defaulting to WAIT.",
      conditions:   [],
      blockers:     ["AGENT_ERROR"],
      isSilentFail: true,
    };
  }
}

// ── Derive entry range from Pricing + Yield + Location agents ─────────────────
function deriveEntryRange(
  req: ARESignalRequest,
  agents: AREAgentResult[],
): ARECouncilResult["entryRange"] {
  const ppsfAsking = req.ppsfAsking ?? (req.areaSqft > 0 ? Math.round(req.askingPriceAED / req.areaSqft) : 0);
  const ppsfComps  = req.ppsfComps ?? ppsfAsking;

  const pricing  = agents.find(a => a.personaId === "ARE_PRICING");
  const location = agents.find(a => a.personaId === "ARE_LOCATION");
  const yield_   = agents.find(a => a.personaId === "ARE_RENTAL_YIELD");

  // Location premium/discount
  const locationMult =
    location?.label === "PRIME"       ? 1.05 :
    location?.label === "ESTABLISHED" ? 1.00 :
    location?.label === "DEVELOPING"  ? 0.93 :
    location?.label === "FRINGE"      ? 0.85 : 1.00;

  // Yield-implied price (if rental data available)
  let yieldImpliedPrice = 0;
  if (req.annualRentAED && req.annualRentAED > 0) {
    const targetNetYield = 0.055; // 5.5% target
    const serviceCharge  = (req.serviceChargePerSqft ?? 15) * req.areaSqft;
    const vacancyLoss    = req.annualRentAED * (1 / 12);
    const maintenance    = req.askingPriceAED * 0.007;
    const netRent        = req.annualRentAED - serviceCharge - vacancyLoss - maintenance;
    yieldImpliedPrice    = netRent / targetNetYield;
  }

  // Fair value band
  const compBased  = ppsfComps * req.areaSqft * locationMult;
  const yieldBased = yieldImpliedPrice > 0 ? yieldImpliedPrice : compBased;
  const fairMid    = (compBased + yieldBased) / 2;
  const fairLow    = Math.round(fairMid * 0.95 / 1000) * 1000;
  const fairHigh   = Math.round(fairMid * 1.05 / 1000) * 1000;

  // Ideal entry: lower of fair mid and asking (if undervalued, ideal = asking)
  const idealEntry = pricing?.label === "UNDERVALUED"
    ? Math.round(req.askingPriceAED / 1000) * 1000
    : Math.round(Math.min(fairMid, req.askingPriceAED) / 1000) * 1000;

  // Confidence-adjusted: if pricing confidence is low, widen range
  const lowConfidence = (pricing?.confidence ?? 1) < 0.5 || (yield_?.confidence ?? 1) < 0.5;
  const finalLow  = lowConfidence ? Math.round(fairLow  * 0.92 / 1000) * 1000 : fairLow;
  const finalHigh = lowConfidence ? Math.round(fairHigh * 1.08 / 1000) * 1000 : fairHigh;

  const reasoning = lowConfidence
    ? "Range widened — limited comp or yield data; verify RERA transactions before committing."
    : pricing?.label === "OVERPRICED"
    ? `Asking ${Math.round(((ppsfAsking - ppsfComps) / ppsfComps) * 100)}% above comps; negotiate to fair-value band.`
    : pricing?.label === "UNDERVALUED"
    ? "Asking below comp PPSF; current price is the ideal entry."
    : "Comp-based and yield-implied prices converge; range reflects ±5% negotiation band.";

  return {
    fairValueLow:  finalLow,
    fairValueHigh: finalHigh,
    idealEntry,
    reasoning,
  };
}

// ── Synthesise investment thesis (3–5 lines) ──────────────────────────────────
async function synthesiseThesis(
  req: ARESignalRequest,
  agents: AREAgentResult[],
  decision: string,
): Promise<string> {
  const agentSummary = agents
    .map(a => `${a.name} (${a.vote} ${a.label}): ${a.rationale}`)
    .join("\n");

  const prompt = `You are a senior UAE real estate investment advisor.
Based on the 7-agent council votes below, write a 3–5 line investment thesis for this property.
Decision: ${decision}
Property: ${req.assetClass} in ${req.community}, ${req.emirate.toUpperCase()}, AED ${req.askingPriceAED.toLocaleString()}
Agent votes:
${agentSummary}

Rules:
- Max 5 lines
- No generic statements
- Focus on decision rationale
- No jargon
- Must be actionable`;

  try {
    const response = await invokeLLM({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: prompt }],
    });
    return (response as any)?.choices?.[0]?.message?.content?.trim() ?? "Thesis unavailable.";
  } catch {
    return "Thesis unavailable — LLM error.";
  }
}

// ── Synthesise strategic view ─────────────────────────────────────────────────
async function synthesiseStrategicView(
  req: ARESignalRequest,
  agents: AREAgentResult[],
  decision: string,
): Promise<string> {
  const prompt = `You are a senior UAE real estate investment advisor.
In 2–3 sentences, provide a strategic view on this property focusing on:
- Capital preservation
- Liquidity velocity (how quickly can this be resold?)
- Structural integrity of the deal

Decision: ${decision}
Property: ${req.assetClass} in ${req.community}, AED ${req.askingPriceAED.toLocaleString()}, developer: ${req.developer}
Type: ${req.propertyType}

No generic statements. Be specific to this property.`;

  try {
    const response = await invokeLLM({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: prompt }],
    });
    return (response as any)?.choices?.[0]?.message?.content?.trim() ?? "Strategic view unavailable.";
  } catch {
    return "Strategic view unavailable — LLM error.";
  }
}

// ── Synthesise off-plan risk summary ─────────────────────────────────────────
async function synthesiseOffPlanRisk(
  req: ARESignalRequest,
  agents: AREAgentResult[],
): Promise<ARECouncilResult["offPlanRisk"]> {
  const devAgent  = agents.find(a => a.personaId === "ARE_DEVELOPER");
  const pdrAgent  = agents.find(a => a.personaId === "ARE_PAYMENT_DELIVERY_RISK");
  const riskLabel = pdrAgent?.label as "LOW" | "MEDIUM" | "HIGH" ?? "MEDIUM";

  const prompt = `You are a UAE real estate off-plan risk specialist.
Generate a concise off-plan risk summary for this property.

Developer: ${req.developer} (${devAgent?.label ?? "unrated"})
Payment plan: ${req.paymentPlan ?? "not specified"}
Completion: ${req.completionDate ?? "not specified"}
Construction progress: ${req.constructionProgress != null ? req.constructionProgress + "%" : "not specified"}
Escrow verified: ${req.escrowVerified != null ? (req.escrowVerified ? "YES" : "NO") : "not specified"}
Payment & Delivery Risk label: ${riskLabel}
Developer agent rationale: ${devAgent?.rationale ?? "N/A"}
PDR agent rationale: ${pdrAgent?.rationale ?? "N/A"}

Return JSON only (no markdown):
{
  "paymentRisk": "1 sentence on cash-flow pressure and forfeiture exposure",
  "delayRisk": "1 sentence on delay probability",
  "exitRisk": "1 sentence on resale constraints before 40-50% payment",
  "mitigation": "1 sentence on recommended mitigation"
}`;

  try {
    const response = await invokeLLM({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (response as any)?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, riskLabel };
  } catch {
    return {
      paymentRisk: "Unable to assess — insufficient data.",
      delayRisk:   "Unable to assess — insufficient data.",
      exitRisk:    "Unable to assess — insufficient data.",
      mitigation:  "Verify RERA escrow registration and construction progress before committing.",
      riskLabel,
    };
  }
}

// ── Main council runner ───────────────────────────────────────────────────────
export async function runARECouncil(req: ARESignalRequest): Promise<ARECouncilResult> {
  const startMs = Date.now();
  const sessionId = `are-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const propertyBlob = buildPropertyBlob(req);
  const isOffPlan = req.propertyType === "off_plan";

  // Run all 7 agents in parallel
  const agentResults = await Promise.all(
    PERSONAS_UAE_RE.map(persona => runAgent(persona, propertyBlob, isOffPlan))
  );

  // Vote tally
  const buyCount       = agentResults.filter(a => a.vote === "BUY").length;
  const waitCount      = agentResults.filter(a => a.vote === "WAIT").length;
  const negotiateCount = agentResults.filter(a => a.vote === "NEGOTIATE").length;
  const avoidCount     = agentResults.filter(a => a.vote === "AVOID").length;

  // Weighted decision: BUY=3, NEGOTIATE=2, WAIT=1, AVOID=0
  const weights = { BUY: 3, NEGOTIATE: 2, WAIT: 1, AVOID: 0 };
  const totalWeight = agentResults.reduce((sum, a) => sum + weights[a.vote], 0);
  const maxWeight   = agentResults.length * 3;
  const weightedScore = totalWeight / maxWeight; // 0–1

  // Raw decision
  let rawDecision: "BUY" | "WAIT" | "NEGOTIATE" | "AVOID";
  if (avoidCount >= 3)     rawDecision = "AVOID";
  else if (weightedScore >= 0.65) rawDecision = "BUY";
  else if (weightedScore >= 0.45) rawDecision = "NEGOTIATE";
  else if (weightedScore >= 0.25) rawDecision = "WAIT";
  else                            rawDecision = "AVOID";

  // Confidence score (average of non-silent-fail agents)
  const validAgents = agentResults.filter(a => !a.isSilentFail);
  const avgConfidence = validAgents.length > 0
    ? validAgents.reduce((sum, a) => sum + a.confidence, 0) / validAgents.length
    : 0;

  // Confidence guardrail: LOW confidence → downgrade BUY → WAIT
  const lowConfidenceGuardrail = rawDecision === "BUY" && avgConfidence < 0.5;
  // Off-plan HIGH-risk guardrail: BUY → WAIT when Payment & Delivery Risk agent returns HIGH
  const pdrAgent = agentResults.find(a => a.personaId === "ARE_PAYMENT_DELIVERY_RISK");
  const highOffPlanRisk = isOffPlan && rawDecision === "BUY" && pdrAgent?.label === "HIGH";
  const guardrailApplied = lowConfidenceGuardrail || highOffPlanRisk;
  const decision = guardrailApplied ? "WAIT" : rawDecision;

  // Confidence level
  const confidenceLevel: "HIGH" | "MEDIUM" | "LOW" =
    avgConfidence >= 0.7 ? "HIGH" :
    avgConfidence >= 0.5 ? "MEDIUM" : "LOW";

  // Top signals: up to 3 rationales from BUY/NEGOTIATE agents, highest confidence first
  const topSignals = agentResults
    .filter(a => (a.vote === "BUY" || a.vote === "NEGOTIATE") && !a.isSilentFail)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(a => `${a.name}: ${a.rationale}`);

  // Key risk: from Risk Agent
  const riskAgent = agentResults.find(a => a.personaId === "ARE_RISK");
  const keyRisk      = riskAgent?.rationale ?? "Risk assessment unavailable.";
  const keyRiskLabel = riskAgent?.label ?? "UNKNOWN";

  // Entry range
  const entryRange = deriveEntryRange(req, agentResults);

  // Silent fails
  const silentFails = agentResults
    .filter(a => a.isSilentFail)
    .map(a => a.personaId);

  // Parallel synthesis (thesis + strategic view + off-plan risk)
  const [investmentThesis, strategicView, offPlanRisk] = await Promise.all([
    synthesiseThesis(req, agentResults, decision),
    synthesiseStrategicView(req, agentResults, decision),
    isOffPlan ? synthesiseOffPlanRisk(req, agentResults) : Promise.resolve(undefined),
  ]);

  return {
    decision,
    confidenceLevel,
    confidenceScore: avgConfidence,
    buyCount,
    waitCount,
    negotiateCount,
    avoidCount,
    topSignals,
    keyRisk,
    keyRiskLabel,
    investmentThesis,
    entryRange,
    offPlanRisk: offPlanRisk ?? undefined,
    strategicView,
    agents: agentResults,
    sessionId,
    durationMs: Date.now() - startMs,
    guardrailApplied,
    silentFails,
  };
}
