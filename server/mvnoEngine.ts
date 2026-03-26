/**
 * mvnoEngine.ts — Kuwait MVNO Intelligence Engine
 * 5 specialist agents run in parallel via Promise.allSettled.
 * Each agent has a 15s timeout with graceful fallback.
 * All verdict computation happens here — frontend receives final results only.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ENV } from "./_core/env";
const client = new Anthropic({ apiKey: ENV.anthropicApiKey });

const TIMEOUT_MS = 15_000;

// ── Subscriber context type ───────────────────────────────────────────────────

export interface SubscriberContext {
  name: string;
  nationality: string;
  msisdn: string;
  plan: "basic" | "worker" | "remittance_plus";
  simStatus: "active" | "suspended" | "ported_out";
  kycStatus: "pending" | "verified" | "rejected";
  monthlyArpu: number;
  notes?: string; // additional context for demo
}

// ── Agent output schemas ──────────────────────────────────────────────────────

const OnboardingResultSchema = z.object({
  status: z.enum(["approved", "pending", "rejected"]),
  flags: z.array(z.string()).max(5),
  action: z.string().max(400),
});

const BillingResultSchema = z.object({
  healthScore: z.number().min(0).max(100),
  issues: z.array(z.string()).max(5),
  recommendation: z.string().max(400),
});

const PlanResultSchema = z.object({
  currentPlanFit: z.enum(["good", "upgrade", "downgrade"]),
  churnRisk: z.enum(["low", "medium", "high"]),
  action: z.string().max(400),
});

const RemittanceResultSchema = z.object({
  primaryCorridor: z.string().max(100),
  monthlyVolume: z.string().max(100),
  bundleMatch: z.string().max(200),
  saving: z.string().max(100),
});

const FraudResultSchema = z.object({
  riskLevel: z.enum(["clean", "monitor", "suspend"]),
  flags: z.array(z.string()).max(5),
  action: z.string().max(400),
});

// ── Agent result types ────────────────────────────────────────────────────────

export type OnboardingResult = z.infer<typeof OnboardingResultSchema>;
export type BillingResult = z.infer<typeof BillingResultSchema>;
export type PlanResult = z.infer<typeof PlanResultSchema>;
export type RemittanceResult = z.infer<typeof RemittanceResultSchema>;
export type FraudResult = z.infer<typeof FraudResultSchema>;

export interface AgentResults {
  onboarding: OnboardingResult;
  billing: BillingResult;
  plan: PlanResult;
  remittance: RemittanceResult;
  fraud: FraudResult;
}

export type OverallRecommendation =
  | "SUSPEND_SUBSCRIBER"
  | "KYC_FAILED"
  | "URGENT_RETENTION"
  | "HEALTHY_SUBSCRIBER"
  | "REVIEW_REQUIRED";

export interface MvnoEngineResult {
  agentResults: AgentResults;
  overallRecommendation: OverallRecommendation;
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Agent timeout")), ms)
    ),
  ]);
}

// ── LLM call helper ───────────────────────────────────────────────────────────

async function callAgent<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodSchema<T>,
  fallback: T
): Promise<T> {
  try {
    const response = await withTimeout(
      client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: userContent }],
        system: systemPrompt,
      }),
      TIMEOUT_MS
    );

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  } catch {
    return fallback;
  }
}

// ── Agent 1: ONBOARDING ───────────────────────────────────────────────────────

const ONBOARDING_SYSTEM = `You are a Kuwait MVNO KYC & SIM Activation Specialist.
Assess subscriber onboarding readiness — KYC completeness, document validity, CITRA compliance, SIM allocation.
Respond ONLY with valid JSON matching this schema:
{ "status": "approved"|"pending"|"rejected", "flags": [string, ...max 5], "action": string }
Be concise. action max 400 chars.`;

async function runOnboardingAgent(ctx: SubscriberContext): Promise<OnboardingResult> {
  const fallback: OnboardingResult = {
    status: "pending",
    flags: ["Assessment unavailable — timeout"],
    action: "Manual review required due to agent timeout.",
  };
  return callAgent(
    ONBOARDING_SYSTEM,
    `Subscriber: ${ctx.name} | Nationality: ${ctx.nationality} | KYC: ${ctx.kycStatus} | SIM: ${ctx.simStatus} | Plan: ${ctx.plan}${ctx.notes ? ` | Notes: ${ctx.notes}` : ""}`,
    OnboardingResultSchema,
    fallback
  );
}

// ── Agent 2: BILLING ──────────────────────────────────────────────────────────

const BILLING_SYSTEM = `You are a Telecom Billing & Support Specialist (Arabic/English bilingual).
Analyse subscriber billing profile — payment history, outstanding balance, plan fit, support ticket patterns.
Respond ONLY with valid JSON matching this schema:
{ "healthScore": 0-100, "issues": [string, ...max 5], "recommendation": string }
healthScore 0=critical, 100=excellent. recommendation max 400 chars.`;

async function runBillingAgent(ctx: SubscriberContext): Promise<BillingResult> {
  const fallback: BillingResult = {
    healthScore: 50,
    issues: ["Billing assessment unavailable — timeout"],
    recommendation: "Manual billing review required.",
  };
  return callAgent(
    BILLING_SYSTEM,
    `Subscriber: ${ctx.name} | Plan: ${ctx.plan} | ARPU: KWD ${ctx.monthlyArpu}/month | SIM Status: ${ctx.simStatus}${ctx.notes ? ` | Notes: ${ctx.notes}` : ""}`,
    BillingResultSchema,
    fallback
  );
}

// ── Agent 3: PLAN ─────────────────────────────────────────────────────────────

const PLAN_SYSTEM = `You are a Telecom Plan Optimisation & Churn Prevention Analyst.
Recommend optimal plan based on usage patterns, predict churn risk, suggest upsell/retention action.
Respond ONLY with valid JSON matching this schema:
{ "currentPlanFit": "good"|"upgrade"|"downgrade", "churnRisk": "low"|"medium"|"high", "action": string }
action max 400 chars.`;

async function runPlanAgent(ctx: SubscriberContext): Promise<PlanResult> {
  const fallback: PlanResult = {
    currentPlanFit: "good",
    churnRisk: "low",
    action: "Plan assessment unavailable — timeout. Retain current plan.",
  };
  return callAgent(
    PLAN_SYSTEM,
    `Subscriber: ${ctx.name} | Current plan: ${ctx.plan} | ARPU: KWD ${ctx.monthlyArpu}/month | Nationality: ${ctx.nationality}${ctx.notes ? ` | Notes: ${ctx.notes}` : ""}`,
    PlanResultSchema,
    fallback
  );
}

// ── Agent 4: REMITTANCE ───────────────────────────────────────────────────────

const REMITTANCE_SYSTEM = `You are a GCC Remittance & Mobile Money Specialist.
Analyse remittance behaviour — transfer frequency, corridors (Kuwait→PH, Kuwait→IN, Kuwait→BD), FX optimisation, bundle recommendation.
Respond ONLY with valid JSON matching this schema:
{ "primaryCorridor": string, "monthlyVolume": string, "bundleMatch": string, "saving": string }
All fields max 200 chars.`;

async function runRemittanceAgent(ctx: SubscriberContext): Promise<RemittanceResult> {
  const fallback: RemittanceResult = {
    primaryCorridor: "Unknown",
    monthlyVolume: "N/A",
    bundleMatch: "Remittance assessment unavailable",
    saving: "N/A",
  };
  return callAgent(
    REMITTANCE_SYSTEM,
    `Subscriber: ${ctx.name} | Nationality: ${ctx.nationality} | Plan: ${ctx.plan} | ARPU: KWD ${ctx.monthlyArpu}/month${ctx.notes ? ` | Notes: ${ctx.notes}` : ""}`,
    RemittanceResultSchema,
    fallback
  );
}

// ── Agent 5: FRAUD ────────────────────────────────────────────────────────────

const FRAUD_SYSTEM = `You are a Telecom Fraud Detection & Security Analyst.
Screen subscriber usage for anomalies — SIM swap fraud, international call fraud, roaming abuse, account takeover signals.
Respond ONLY with valid JSON matching this schema:
{ "riskLevel": "clean"|"monitor"|"suspend", "flags": [string, ...max 5], "action": string }
action max 400 chars.`;

async function runFraudAgent(ctx: SubscriberContext): Promise<FraudResult> {
  const fallback: FraudResult = {
    riskLevel: "monitor",
    flags: ["Fraud assessment unavailable — timeout"],
    action: "Manual fraud review required due to agent timeout.",
  };
  return callAgent(
    FRAUD_SYSTEM,
    `Subscriber: ${ctx.name} | Nationality: ${ctx.nationality} | SIM: ${ctx.simStatus} | Plan: ${ctx.plan}${ctx.notes ? ` | Notes: ${ctx.notes}` : ""}`,
    FraudResultSchema,
    fallback
  );
}

// ── Overall recommendation logic ──────────────────────────────────────────────

function computeOverallRecommendation(results: AgentResults): OverallRecommendation {
  if (results.fraud.riskLevel === "suspend") return "SUSPEND_SUBSCRIBER";
  if (results.onboarding.status === "rejected") return "KYC_FAILED";
  if (results.plan.churnRisk === "high" && results.billing.healthScore < 40) return "URGENT_RETENTION";
  if (
    results.onboarding.status === "approved" &&
    results.billing.healthScore >= 70 &&
    results.fraud.riskLevel === "clean"
  ) return "HEALTHY_SUBSCRIBER";
  return "REVIEW_REQUIRED";
}

// ── Main engine entry point ───────────────────────────────────────────────────

export async function runMvnoAgents(ctx: SubscriberContext): Promise<MvnoEngineResult> {
  const [onboardingRes, billingRes, planRes, remittanceRes, fraudRes] = await Promise.allSettled([
    runOnboardingAgent(ctx),
    runBillingAgent(ctx),
    runPlanAgent(ctx),
    runRemittanceAgent(ctx),
    runFraudAgent(ctx),
  ]);

  const agentResults: AgentResults = {
    onboarding: onboardingRes.status === "fulfilled" ? onboardingRes.value : {
      status: "pending", flags: ["Agent failed"], action: "Manual review required.",
    },
    billing: billingRes.status === "fulfilled" ? billingRes.value : {
      healthScore: 50, issues: ["Agent failed"], recommendation: "Manual review required.",
    },
    plan: planRes.status === "fulfilled" ? planRes.value : {
      currentPlanFit: "good", churnRisk: "low", action: "Manual review required.",
    },
    remittance: remittanceRes.status === "fulfilled" ? remittanceRes.value : {
      primaryCorridor: "Unknown", monthlyVolume: "N/A", bundleMatch: "N/A", saving: "N/A",
    },
    fraud: fraudRes.status === "fulfilled" ? fraudRes.value : {
      riskLevel: "monitor", flags: ["Agent failed"], action: "Manual review required.",
    },
  };

  const overallRecommendation = computeOverallRecommendation(agentResults);

  return { agentResults, overallRecommendation };
}

// ── Mock subscriber profiles ──────────────────────────────────────────────────

export const MOCK_SUBSCRIBERS: SubscriberContext[] = [
  {
    name: "Maria Santos",
    nationality: "Filipino",
    msisdn: "+96550001001",
    plan: "worker",
    simStatus: "active",
    kycStatus: "verified",
    monthlyArpu: 8.5,
    notes: "Regular remittance to Philippines (KWD 120/month). Clean payment history. 14 months tenure.",
  },
  {
    name: "Ravi Kumar",
    nationality: "Indian",
    msisdn: "+96550001002",
    plan: "remittance_plus",
    simStatus: "active",
    kycStatus: "verified",
    monthlyArpu: 22.0,
    notes: "IT professional. Sends KWD 400/month to India. High data usage. Upsell candidate for premium plan.",
  },
  {
    name: "Ahmed Hassan",
    nationality: "Egyptian",
    msisdn: "+96550001003",
    plan: "basic",
    simStatus: "active",
    kycStatus: "verified",
    monthlyArpu: 4.2,
    notes: "Two missed payments in last 3 months. Usage declining. High churn risk.",
  },
  {
    name: "Josephine Dela Cruz",
    nationality: "Filipino",
    msisdn: "+96550001004",
    plan: "worker",
    simStatus: "active",
    kycStatus: "verified",
    monthlyArpu: 7.8,
    notes: "SIM swap attempt detected 2 weeks ago. Account flagged for monitoring. Login from 3 different devices.",
  },
  {
    name: "Mohammad Ali",
    nationality: "Bangladeshi",
    msisdn: "+96550001005",
    plan: "basic",
    simStatus: "active",
    kycStatus: "pending",
    monthlyArpu: 5.1,
    notes: "Unusually high international call volume (800 mins/month on basic plan). Possible call forwarding fraud.",
  },
  {
    name: "Priya Nair",
    nationality: "Indian",
    msisdn: "+96550001006",
    plan: "remittance_plus",
    simStatus: "active",
    kycStatus: "verified",
    monthlyArpu: 19.5,
    notes: "18 months clean history. Consistent remittance to Kerala. Loyalty reward candidate. Referral potential.",
  },
];
