/**
 * prospectConfigs.ts
 *
 * Single source of truth for all prospect-specific demo configurations.
 * To add a new prospect: add one entry to PROSPECT_CONFIGS and register
 * its route in App.tsx. Nothing else needs to change.
 *
 * Batch 1 (ship May 23): stc, tencent, nbk
 * Batch 2 (ship May 26): core42, adnoc, kia, kamco
 */

export interface ProspectConfig {
  slug: string;                  // URL path segment — /demo/{slug}
  name: string;                  // Display name shown in hero
  industry: string;
  region: string;
  primaryUseCase: string;
  demoEmphasis: string[];        // Council emphasis tags shown on page
  openingNarration: string;      // First voice line — must mention prospect by name
  recommendedModules: string[];  // Platform modules to highlight
  likelyObjections: Array<{
    objection: string;
    response: string;
  }>;
  ctaText: string;
  ctaDestination: string;        // Internal route or external URL
  qaContextBoost: string[];      // Keywords to weight in Q&A classifier context
  // Scenario memo fields (used by ProspectDemoPage)
  dealType: string;
  dealSubtitle: string;
  scenario: Array<{ label: string; value: string }>;
  memoRef: string;
  memoDate: string;
  overallVerdict: string;
  overallConfidence: number;
  overallSummary: string;
}

// ── Batch 1 ───────────────────────────────────────────────────────────────────

const stc: ProspectConfig = {
  slug: "stc",
  name: "STC",
  industry: "Telecom / Cloud / AI Infrastructure",
  region: "Kuwait / GCC",
  primaryUseCase: "AI workload monetization, governed enterprise AI, regulated AI orchestration",
  demoEmphasis: [
    "Sovereign AI",
    "Telecom AI Infrastructure",
    "Enterprise Governance",
    "Token / Workload Consumption",
    "Regulated AI Orchestration",
  ],
  openingNarration:
    "Welcome, STC. AgenThinkMesh was built for exactly the challenge you face: deploying AI at telecom scale while maintaining sovereign governance, auditability, and regulatory compliance. Let me show you how ten specialised agents reach consensus on your most complex decisions — without a single point of failure.",
  recommendedModules: [
    "Sovereign AI Council",
    "Governance Audit Replay",
    "Token Consumption Analytics",
    "Enterprise Orchestration Layer",
    "Regulatory Compliance Agent",
  ],
  likelyObjections: [
    {
      objection: "We already have Oracle Cloud AI — why do we need another layer?",
      response:
        "AgenThinkMesh is not a model — it is a governance and consensus layer that sits above any LLM or cloud AI. It routes decisions through ten adversarial agents, produces audit trails, and enforces jurisdiction controls. It complements Oracle Cloud AI rather than replacing it.",
    },
    {
      objection: "How does this handle data residency under SADO?",
      response:
        "Every eval call is jurisdiction-tagged. The SADO agent in the council flags any data movement that violates residency rules before a decision is finalised. Audit logs are immutable and exportable for regulatory review.",
    },
    {
      objection: "What is the latency at enterprise scale?",
      response:
        "A full Council of 10 evaluation completes in approximately 60 seconds. For high-volume workloads, the async fleet dispatcher handles up to 25 concurrent evaluations with a theoretical ceiling of 270,000 evaluations per day.",
    },
  ],
  ctaText: "Book a Sovereign AI Architecture Review",
  ctaDestination: "/voice-demo?prospect=stc",
  qaContextBoost: [
    "sovereign AI", "telecom", "Oracle Cloud", "SADO", "data residency",
    "token consumption", "workload", "governance", "regulated AI", "STC",
  ],
  dealType: "Governed AI Workload Orchestration — Telecom Scale",
  dealSubtitle: "5G network policy decisions · Autonomous agent governance · Sovereign AI infrastructure",
  scenario: [
    { label: "Sector", value: "Telecom / AI Infrastructure" },
    { label: "Region", value: "Kuwait / GCC" },
    { label: "Use Case", value: "AI workload monetization + governance" },
    { label: "Compliance", value: "SADO · CITC · TRA" },
    { label: "Council Mode", value: "Sovereign AI + Audit Replay" },
  ],
  memoRef: "IC-STC-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 0.81,
  overallSummary:
    "Council reached conditional consensus. Sovereign AI governance layer is a strong fit for STC's regulated AI deployment mandate. Key condition: confirm SADO jurisdiction routing config before production rollout. Recommend a 30-day pilot on a bounded workload.",
};

const tencent: ProspectConfig = {
  slug: "tencent",
  name: "Tencent",
  industry: "Cloud / AI / Enterprise Platforms",
  region: "China / Global / GCC Partnerships",
  primaryUseCase: "Agentic orchestration, data engineering complement, AI governance, regional enterprise AI",
  demoEmphasis: [
    "Council of 10 Consensus",
    "Agent Orchestration",
    "Governed Data Flows",
    "Enterprise AI Infrastructure",
    "GCC Expansion Relevance",
  ],
  openingNarration:
    "Welcome, Tencent. As you expand AI infrastructure partnerships across the GCC, AgenThinkMesh offers something your enterprise clients cannot get from a single model: adversarial consensus. Ten agents debate every decision, governed data flows respect cross-border compliance, and every output is audit-traced. Let me walk you through how this works.",
  recommendedModules: [
    "Council of 10 Consensus Engine",
    "Cross-Jurisdiction Data Routing",
    "Agent Orchestration Layer",
    "Enterprise AI Governance",
    "GCC Compliance Context",
  ],
  likelyObjections: [
    {
      objection: "How does AgenThinkMesh complement our existing Tencent Cloud AI stack?",
      response:
        "AgenThinkMesh is a decision governance layer, not a model. It can sit above any LLM stack — including Tencent's — and add adversarial consensus, audit trails, and jurisdiction controls to any AI-driven decision workflow.",
    },
    {
      objection: "How do you handle data movement between APAC and GCC under SADO policy?",
      response:
        "The SADO agent in the council evaluates every data movement against jurisdiction rules before a decision is finalised. Cross-border data flows are flagged, logged, and can be blocked or routed to a compliant endpoint automatically.",
    },
    {
      objection: "What is the integration path for our enterprise clients?",
      response:
        "AgenThinkMesh exposes a tRPC API and supports A2A (agent-to-agent) connectors. Enterprise clients can integrate via API in days, not months. A white-label option is available for platform partners.",
    },
  ],
  ctaText: "Explore a GCC Partnership Architecture",
  ctaDestination: "/voice-demo?prospect=tencent",
  qaContextBoost: [
    "Tencent Cloud", "APAC", "GCC", "cross-border", "SADO", "data engineering",
    "agent orchestration", "enterprise AI", "governance", "partnership",
  ],
  dealType: "Cross-Jurisdiction AI Governance — APAC ↔ GCC",
  dealSubtitle: "Data movement APAC ↔ GCC under SADO policy · Multi-tenant AI governance · Enterprise platform partnership",
  scenario: [
    { label: "Sector", value: "Cloud / AI / Enterprise Platforms" },
    { label: "Region", value: "China / Global / GCC" },
    { label: "Use Case", value: "Cross-jurisdiction AI governance" },
    { label: "Compliance", value: "SADO · PIPL · PDPL" },
    { label: "Council Mode", value: "SADO + Audit + Jurisdiction Routing" },
  ],
  memoRef: "IC-TENCENT-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "ENGAGE",
  overallConfidence: 0.78,
  overallSummary:
    "Council reached consensus to engage. AgenThinkMesh's cross-jurisdiction governance layer is directly relevant to Tencent's GCC expansion strategy. Recommend a joint architecture review focused on SADO-compliant data routing and enterprise API integration.",
};

const nbk: ProspectConfig = {
  slug: "nbk",
  name: "NBK Capital",
  industry: "Banking / Financial Services",
  region: "Kuwait / GCC",
  primaryUseCase: "Governed AI decision workflows for credit, investment, risk, and compliance",
  demoEmphasis: [
    "Auditability",
    "Risk Committees",
    "Compliance Evidence",
    "Decision Traceability",
    "Financial Governance",
  ],
  openingNarration:
    "Welcome, NBK Capital. In regulated financial services, every AI-assisted decision needs an audit trail. AgenThinkMesh gives your investment and risk committees exactly that: ten adversarial agents debate every deal, every dissent is logged, and every output is traceable to a specific agent's reasoning. Let me show you how this works for PE deal screening.",
  recommendedModules: [
    "Investment Committee Augmentation",
    "Compliance Evidence Generator",
    "Risk Council (Adversarial)",
    "Audit Replay Module",
    "Decision Traceability Log",
  ],
  likelyObjections: [
    {
      objection: "How do we know the AI output is explainable to our regulators?",
      response:
        "Every Council evaluation produces a structured audit trail: which agent flagged what, what the dissent was, and what evidence drove the final consensus. This is exportable as a compliance memo in the format your regulators expect.",
    },
    {
      objection: "Can this integrate with our existing risk management systems?",
      response:
        "Yes. AgenThinkMesh exposes a tRPC API. Your risk management system can submit a deal memo and receive a structured Council output — verdict, confidence score, agent dissents, and flags — in a single API call.",
    },
    {
      objection: "What happens when agents disagree?",
      response:
        "Dissent is a feature, not a bug. When agents disagree, the escalation agent flags the deal for human review and logs the specific points of contention. This is exactly the adversarial challenge your investment committee should be applying to every deal.",
    },
  ],
  ctaText: "Request a Compliance-Ready Demo",
  ctaDestination: "/voice-demo?prospect=nbk",
  qaContextBoost: [
    "NBK", "banking", "compliance", "audit trail", "risk committee",
    "PE deal", "investment memo", "financial governance", "Kuwait", "GCC",
  ],
  dealType: "PE Deal Screening — Mid-Market GCC Target",
  dealSubtitle: "$50M ticket · Industrial sector · EBITDA validation · Compliance-ready output",
  scenario: [
    { label: "Ticket Size", value: "$50M" },
    { label: "Sector", value: "Industrial / GCC" },
    { label: "Council Emphasis", value: "Valuation + Macro + Challenger" },
    { label: "Compliance", value: "CBK · CMA Kuwait" },
    { label: "Output", value: "Committee-ready investment memo" },
  ],
  memoRef: "IC-NBK-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 0.74,
  overallSummary:
    "Council reached conditional consensus. EBITDA validation agent flagged a 15% gap between management projections and comparable transaction multiples. Recommend a second-pass evaluation with updated financials before committee presentation. Compliance evidence package ready for CBK review.",
};

// ── Batch 2 (configs defined, routes NOT wired until approved) ─────────────────

const core42: ProspectConfig = {
  slug: "core42",
  name: "Core42",
  industry: "Sovereign Cloud / GPU Infrastructure / AI Compute",
  region: "UAE / GCC",
  primaryUseCase: "Governed AI workloads on sovereign compute",
  demoEmphasis: [
    "GPU Utilization",
    "Enterprise AI Workloads",
    "Sovereign Deployment",
    "Auditability",
    "Model Routing",
    "Regulated AI Adoption",
  ],
  openingNarration:
    "Welcome, Core42. You provide the sovereign compute layer — AgenThinkMesh provides the governance layer that runs on top of it. Together, we give UAE enterprises AI decisions that are not only fast, but auditable, explainable, and sovereign by design. Let me show you how the Council of 10 operates on your infrastructure.",
  recommendedModules: [
    "Sovereign Deployment Mode",
    "GPU Workload Governance",
    "Model Routing Layer",
    "Audit Replay Module",
    "Multi-Tenant Governance",
  ],
  likelyObjections: [
    {
      objection: "How does AgenThinkMesh run on sovereign infrastructure?",
      response:
        "AgenThinkMesh is a Node.js application with no external dependencies beyond the LLM API endpoint. It can be deployed on any sovereign cloud — including Core42's — with the model endpoint pointed at a locally hosted or sovereign-approved model.",
    },
    {
      objection: "What is the GPU utilisation profile for a Council of 10 evaluation?",
      response:
        "A full Council evaluation runs 10 parallel LLM calls. On DeepSeek Flash (the default routing), each call is approximately 3.5 seconds and consumes minimal GPU. For heavier models, the fleet dispatcher can be configured to limit concurrency.",
    },
  ],
  ctaText: "Explore Sovereign AI Deployment",
  ctaDestination: "/voice-demo?prospect=core42",
  qaContextBoost: [
    "Core42", "sovereign cloud", "GPU", "UAE", "AI compute", "SADO",
    "sovereign deployment", "multi-tenant", "model routing", "audit",
  ],
  dealType: "UAE National AI Workload — Sovereign Compute Governance",
  dealSubtitle: "Multi-tenant AI governance · Sovereign cloud deployment · Regulated AI adoption",
  scenario: [
    { label: "Sector", value: "Sovereign Cloud / GPU Infrastructure" },
    { label: "Region", value: "UAE / GCC" },
    { label: "Use Case", value: "Governed AI workloads on sovereign compute" },
    { label: "Compliance", value: "SADO · UAE AI Strategy" },
    { label: "Council Mode", value: "SADO + Governance + Audit Replay" },
  ],
  memoRef: "IC-CORE42-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "ENGAGE",
  overallConfidence: 0.85,
  overallSummary:
    "Council reached strong consensus to engage. Core42's sovereign compute infrastructure is the ideal deployment target for AgenThinkMesh's governance layer. Recommend a joint architecture review and a 30-day pilot on a bounded UAE enterprise workload.",
};

const adnoc: ProspectConfig = {
  slug: "adnoc",
  name: "ADNOC",
  industry: "Energy / Industrial / Government-linked Enterprise",
  region: "UAE / GCC",
  primaryUseCase: "Governed AI workflows for energy, operations, investment, procurement, and compliance",
  demoEmphasis: [
    "Industrial AI Governance",
    "Regulated Data Movement",
    "Audit Trail",
    "Risk Review",
    "SADO Jurisdiction Controls",
  ],
  openingNarration:
    "Welcome, ADNOC. Energy operations at your scale involve thousands of decisions daily — capex allocation, procurement, ESG compliance, geopolitical risk. AgenThinkMesh gives every one of those decisions an adversarial council review, an audit trail, and a structured output your governance teams can act on. Let me show you how.",
  recommendedModules: [
    "Industrial AI Governance",
    "ESG Compliance Agent",
    "Geopolitical Risk Council",
    "Capex Allocation Review",
    "SADO Jurisdiction Controls",
  ],
  likelyObjections: [
    {
      objection: "How does this handle the complexity of energy sector regulations?",
      response:
        "The Council includes a dedicated regulatory compliance agent that is pre-configured with energy sector frameworks. For ADNOC-specific requirements, the agent's context can be extended with your internal compliance documents.",
    },
    {
      objection: "Can this integrate with our SAP and operational systems?",
      response:
        "AgenThinkMesh exposes a tRPC API. Any system that can make an HTTP call — including SAP — can submit a decision memo and receive a structured Council output. No custom integration work required on your side.",
    },
  ],
  ctaText: "Request an Industrial AI Governance Review",
  ctaDestination: "/voice-demo?prospect=adnoc",
  qaContextBoost: [
    "ADNOC", "energy", "industrial AI", "capex", "ESG", "procurement",
    "SADO", "UAE", "geopolitical risk", "audit trail", "compliance",
  ],
  dealType: "Capex Allocation — ESG-Screened, Geopolitical Risk",
  dealSubtitle: "Industrial AI governance · Regulated data movement · SADO jurisdiction controls",
  scenario: [
    { label: "Sector", value: "Energy / Industrial" },
    { label: "Region", value: "UAE / GCC" },
    { label: "Use Case", value: "Governed AI workflows for energy operations" },
    { label: "Compliance", value: "SADO · UAE ESG · ADNOC Internal" },
    { label: "Council Mode", value: "Macro + ESG + Challenger + Risk" },
  ],
  memoRef: "IC-ADNOC-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "CONDITIONAL ENGAGE",
  overallConfidence: 0.77,
  overallSummary:
    "Council reached conditional consensus. ESG agent flagged two holdings with elevated Scope 3 emissions exposure. Geopolitical risk agent flagged USD-peg sensitivity in the capex allocation model. Recommend a second-pass evaluation with updated ESG data before board presentation.",
};

const kia: ProspectConfig = {
  slug: "kia",
  name: "Kuwait Investment Authority",
  industry: "Sovereign Wealth / Investment",
  region: "Kuwait / Global",
  primaryUseCase: "Multi-agent investment screening and portfolio risk intelligence",
  demoEmphasis: [
    "Council of 10",
    "Investment Committee Augmentation",
    "Deal Screening",
    "Risk Scoring",
    "Audit Trail",
    "Explainable Investment Memo",
  ],
  openingNarration:
    "Welcome, Kuwait Investment Authority. Sovereign wealth management at your scale demands decisions that are not only correct, but defensible. AgenThinkMesh gives your investment committee an adversarial council of ten specialised agents — each one challenging the deal from a different angle. Every dissent is logged. Every output is explainable. Let me show you how this works for a sovereign portfolio rebalance.",
  recommendedModules: [
    "Investment Committee Augmentation",
    "Sovereign Portfolio Risk Council",
    "Geopolitical Stress Test Agent",
    "Audit Replay Module",
    "Explainable Investment Memo Generator",
  ],
  likelyObjections: [
    {
      objection: "How does this handle sovereign-level confidentiality requirements?",
      response:
        "AgenThinkMesh can be deployed on sovereign infrastructure with no data leaving the jurisdiction. All LLM calls can be routed to a locally hosted or sovereign-approved model. Audit logs are stored in your own database.",
    },
    {
      objection: "Can this replace our existing investment committee process?",
      response:
        "No — and it should not. AgenThinkMesh augments your committee, not replaces it. It provides a structured pre-committee analysis that surfaces risks, dissents, and flags before your human committee convenes. The final decision always remains with your team.",
    },
  ],
  ctaText: "Request a Sovereign Portfolio Demo",
  ctaDestination: "/voice-demo?prospect=kia",
  qaContextBoost: [
    "KIA", "sovereign wealth", "Kuwait", "portfolio rebalance", "oil correlation",
    "USD peg", "geopolitical", "investment committee", "audit trail", "explainable",
  ],
  dealType: "Sovereign Portfolio Rebalance — Geopolitical Scenario",
  dealSubtitle: "Oil correlation stress test · USD-peg exposure · Sovereign risk intelligence",
  scenario: [
    { label: "Sector", value: "Sovereign Wealth / Investment" },
    { label: "Region", value: "Kuwait / Global" },
    { label: "Use Case", value: "Portfolio rebalance under geopolitical scenario" },
    { label: "Compliance", value: "CBK · KIA Internal Governance" },
    { label: "Council Mode", value: "Macro + Risk + Challenger + Concentration" },
  ],
  memoRef: "IC-KIA-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "WATCH",
  overallConfidence: 0.69,
  overallSummary:
    "Council flagged elevated geopolitical risk. Oil correlation stress test shows 23% drawdown scenario under a sustained USD-peg realignment. Macro agent recommends reducing GCC equity concentration by 8–12% before rebalancing. Recommend holding current allocation pending Q3 macro review.",
};

const kamco: ProspectConfig = {
  slug: "kamco",
  name: "Kamco Invest",
  industry: "Asset Management / Investment Banking",
  region: "Kuwait / GCC",
  primaryUseCase: "Deal screening, public/private market analysis, investment memo generation",
  demoEmphasis: [
    "Faster Diligence",
    "Financial Analyst Agents",
    "Valuation Challenge",
    "Risk Review",
    "Committee-Ready Outputs",
  ],
  openingNarration:
    "Welcome, Kamco Invest. Your analysts spend days on diligence that AgenThinkMesh can structure in 60 seconds. Ten specialised agents — valuation, risk, macro, Shariah, challenger — debate your deal and produce a committee-ready memo with every flag surfaced. Let me show you how this works for a Sukuk allocation strategy.",
  recommendedModules: [
    "Financial Analyst Agent Fleet",
    "Valuation Challenge Agent",
    "Fixed Income Risk Council",
    "Committee-Ready Memo Generator",
    "Shariah Compliance Screen",
  ],
  likelyObjections: [
    {
      objection: "How accurate is the valuation agent for GCC fixed income?",
      response:
        "The valuation agent is calibrated on GCC fixed income comparables and uses yield spread analysis, duration matching, and credit quality scoring. For Sukuk specifically, it applies AAOIFI-compliant screening criteria.",
    },
    {
      objection: "Can we customise the output format for our committee templates?",
      response:
        "Yes. The memo output schema is configurable. You can map Council output fields to your existing committee template structure via the API, or use the default structured JSON output and format it in your own system.",
    },
  ],
  ctaText: "Run a Sukuk Allocation Analysis",
  ctaDestination: "/voice-demo?prospect=kamco",
  qaContextBoost: [
    "Kamco", "asset management", "Sukuk", "fixed income", "GCC", "Kuwait",
    "valuation", "diligence", "investment memo", "committee", "Shariah",
  ],
  dealType: "Sukuk Allocation Strategy — 5Y GRE Issuance",
  dealSubtitle: "Fixed income mandate · Conservative risk band · Yield + risk + tax council",
  scenario: [
    { label: "Sector", value: "Asset Management / Fixed Income" },
    { label: "Region", value: "Kuwait / GCC" },
    { label: "Instrument", value: "5Y GRE Sukuk" },
    { label: "Risk Band", value: "Conservative" },
    { label: "Council Mode", value: "Yield + Risk + Tax + Shariah" },
  ],
  memoRef: "IC-KAMCO-2026-0517-001",
  memoDate: "17 May 2026 — 09:00 AST",
  overallVerdict: "ENGAGE",
  overallConfidence: 0.82,
  overallSummary:
    "Council reached consensus to engage. 5Y GRE Sukuk issuance meets conservative risk band criteria. Yield spread analysis shows 45bps pickup over comparable sovereign. Shariah screen passed. Tax agent flagged withholding tax treatment — recommend legal review before allocation.",
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const PROSPECT_CONFIGS: Record<string, ProspectConfig> = {
  stc,
  tencent,
  nbk,
  core42,
  adnoc,
  kia,
  kamco,
};

/** Batch 1 slugs — routes wired in App.tsx */
export const BATCH_1_SLUGS = ["stc", "tencent", "nbk"] as const;

/** Batch 2 slugs — configs defined, routes NOT wired until approved */
export const BATCH_2_SLUGS = ["core42", "adnoc", "kia", "kamco"] as const;

export type ProspectSlug = typeof BATCH_1_SLUGS[number] | typeof BATCH_2_SLUGS[number];

/** Helper: get a config by slug, returns undefined if not found */
export function getProspectConfig(slug: string): ProspectConfig | undefined {
  return PROSPECT_CONFIGS[slug];
}
