/**
 * SADOConsensus.tsx — SADO Phase B.2 / B.4
 *
 * Consensus Governance Engine — static architecture preview page.
 * Demonstrates a 10-agent deliberation council evaluating two high-risk
 * sovereign data scenarios with different verdicts.
 *
 * All data is static / illustrative. No live backend consensus execution yet.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProspectQRDialog from "@/components/sado/ProspectQRDialog";
import { useProspectMode, useProspectFromUrl, buildProspectQuery } from "@/hooks/useProspectMode";
import { useProspectCopyLink } from "@/hooks/useProspectCopyLink";

// ── Types ─────────────────────────────────────────────────────────────────────
type Vote = "INTERCEPT" | "ESCALATE" | "ALLOW";

interface AgentVote {
  num: string;
  name: string;
  role: string;
  voteA: Vote;
  rationaleA: string;
  voteB: Vote;
  rationaleB: string;
  accent: string;
  nameColor: string;
  icon: string;
}

interface ScenarioMeta {
  id: "A" | "B";
  name: string;
  source: string;
  destination: string;
  classification: string;
  requestedAction: string;
  deliberationTime: string;
  finalDecision: Vote;
  interceptCount: number;
  escalateCount: number;
  allowCount: number;
  confidence: string;
  reason: string;
  rationaleChain: { step: number; label: string; detail: string }[];
  policyThresholds: { policy: string; threshold: string; result: "BREACHED" | "ESCALATE" | "PASSED"; risk: "High" | "Medium" | "Low" }[];
  audit: {
    consensusId: string;
    timestamp: string;
    voteBreakdown: string;
    traceId: string;
    majorityRationale: string;
    minorityOpinion: string;
    overridePath: string;
  };
}

// ── Vote config ───────────────────────────────────────────────────────────────
const VOTE_CONFIG: Record<Vote, { badge: string; icon: React.ReactNode; label: string; decisionColor: string; borderColor: string; bgColor: string; iconEl: React.ReactNode }> = {
  INTERCEPT: {
    badge:        "bg-red-500/10 text-red-400 border-red-500/20",
    icon:         <XCircle className="w-3 h-3" />,
    label:        "INTERCEPT",
    decisionColor:"text-red-400",
    borderColor:  "border-red-500/25",
    bgColor:      "bg-red-500/5",
    iconEl:       <XCircle className="w-6 h-6 text-red-400" />,
  },
  ESCALATE: {
    badge:        "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon:         <AlertTriangle className="w-3 h-3" />,
    label:        "ESCALATE",
    decisionColor:"text-amber-400",
    borderColor:  "border-amber-500/25",
    bgColor:      "bg-amber-500/5",
    iconEl:       <AlertTriangle className="w-6 h-6 text-amber-400" />,
  },
  ALLOW: {
    badge:        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon:         <CheckCircle2 className="w-3 h-3" />,
    label:        "ALLOW",
    decisionColor:"text-emerald-400",
    borderColor:  "border-emerald-500/25",
    bgColor:      "bg-emerald-500/5",
    iconEl:       <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
  },
};

// ── Council of Ten (shared agents, different votes per scenario) ───────────────
const COUNCIL: AgentVote[] = [
  {
    num: "01", name: "Data Residency Judge",
    role: "Evaluates whether the transfer destination satisfies all applicable data localisation obligations under PDPL SA, CITRA KW, and NESA UAE.",
    voteA: "INTERCEPT",
    rationaleA: "Destination is Frankfurt (EU), outside the SDAIA-approved transfer list. No adequacy decision exists between KSA and Germany. Transfer must be blocked pending SDAIA approval.",
    voteB: "ESCALATE",
    rationaleB: "Kuwait CITRA permits SWIFT payment metadata transfer to MAS-regulated jurisdictions under enhanced controls. Residency risk is moderate — escalation for human review is appropriate.",
    accent: "border-blue-500/25 bg-blue-500/6", nameColor: "text-blue-300", icon: "⚖",
  },
  {
    num: "02", name: "Privacy Officer",
    role: "Assesses whether the data subjects' rights under PDPL SA Article 29 and GDPR Article 46 are adequately protected for cross-border transfer.",
    voteA: "INTERCEPT",
    rationaleA: "Customer behavioural PII lacks contractual safeguards (SCCs) with the Frankfurt processor. Consent was not collected for cross-border analytics replication.",
    voteB: "ESCALATE",
    rationaleB: "SWIFT metadata does not constitute personal data under PDPL KW Article 2. Counterparty risk signals are institutional, not individual. Privacy risk is low; escalation sufficient.",
    accent: "border-violet-500/25 bg-violet-500/6", nameColor: "text-violet-300", icon: "🔒",
  },
  {
    num: "03", name: "Security Architect",
    role: "Reviews encryption posture, key custody, and data-in-transit controls for the proposed replication path.",
    voteA: "INTERCEPT",
    rationaleA: "Replication channel uses TLS 1.2 without customer-managed keys. Encryption key custody would transfer outside sovereign control. Remediation required before transfer.",
    voteB: "ESCALATE",
    rationaleB: "SWIFT network uses ISO 20022 with end-to-end encryption. Key custody remains with the originating institution. Security posture is acceptable under enhanced monitoring.",
    accent: "border-slate-500/25 bg-slate-500/6", nameColor: "text-slate-300", icon: "🛡",
  },
  {
    num: "04", name: "Compliance Counsel",
    role: "Interprets applicable regulatory text and determines whether a legal basis for transfer exists under current policy.",
    voteA: "INTERCEPT",
    rationaleA: "No Article 29 exception applies. Transfer for analytics replication is not necessary for performance of an international obligation. Legal basis absent.",
    voteB: "INTERCEPT",
    rationaleB: "Fraud analytics routing requires explicit CITRA approval for cross-border data movement. No standing approval exists for Singapore destination. Legal basis requires verification.",
    accent: "border-emerald-500/25 bg-emerald-500/6", nameColor: "text-emerald-300", icon: "📋",
  },
  {
    num: "05", name: "Risk Quant",
    role: "Quantifies regulatory penalty exposure, reputational risk, and operational impact of proceeding versus blocking the transfer.",
    voteA: "INTERCEPT",
    rationaleA: "Estimated regulatory exposure: SAR 5–20M under PDPL SA. Reputational risk score: 8.4/10. Expected value of proceeding is negative. Block recommended.",
    voteB: "ESCALATE",
    rationaleB: "Regulatory exposure is KWD 50–200K (moderate). Fraud analytics delay risk: 2.3× increase in undetected transaction fraud. Expected value of escalation exceeds hard block.",
    accent: "border-amber-500/25 bg-amber-500/6", nameColor: "text-amber-300", icon: "📊",
  },
  {
    num: "06", name: "Cloud Sovereignty Analyst",
    role: "Verifies that the destination cloud region and operator meet sovereign cloud requirements for the originating jurisdiction.",
    voteA: "INTERCEPT",
    rationaleA: "Frankfurt region is operated by AWS EU (not a GCC-sovereign operator). No NESA cloud security assessment on file for this destination. Transfer not cleared.",
    voteB: "ESCALATE",
    rationaleB: "Singapore MAS TRM guidelines are recognised by CITRA as equivalent controls. AWS AP-SOUTHEAST-1 has MAS-approved cloud certification. Sovereignty risk is manageable.",
    accent: "border-cyan-500/25 bg-cyan-500/6", nameColor: "text-cyan-300", icon: "☁",
  },
  {
    num: "07", name: "Lineage Auditor",
    role: "Traces the data lineage from source system to proposed destination and verifies audit trail completeness.",
    voteA: "INTERCEPT",
    rationaleA: "Lineage graph shows 3 upstream PII joins not reflected in the transfer manifest. Incomplete lineage means audit trail would be non-compliant. Block until manifest is corrected.",
    voteB: "ESCALATE",
    rationaleB: "SWIFT message lineage is complete and traceable to originating bank. Counterparty risk signal lineage has 1 unresolved upstream join — escalation for review before routing.",
    accent: "border-indigo-500/25 bg-indigo-500/6", nameColor: "text-indigo-300", icon: "🔗",
  },
  {
    num: "08", name: "Business Impact Assessor",
    role: "Evaluates the operational and commercial impact of blocking versus allowing the transfer, and identifies alternative architectures.",
    voteA: "ESCALATE",
    rationaleA: "Analytics workload is time-sensitive (quarterly reporting). Blocking has a 3-day operational impact. Recommend escalation to explore a federated query alternative that avoids replication.",
    voteB: "ESCALATE",
    rationaleB: "Fraud analytics delay has direct financial impact: estimated USD 1.2M in undetected fraud per 24-hour delay. Escalation with enhanced controls is the optimal risk-adjusted path.",
    accent: "border-orange-500/25 bg-orange-500/6", nameColor: "text-orange-300", icon: "💼",
  },
  {
    num: "09", name: "Red-Team Challenger",
    role: "Stress-tests the majority position by identifying weaknesses in the blocking rationale and potential for regulatory arbitrage.",
    voteA: "ESCALATE",
    rationaleA: "Majority INTERCEPT is sound, but the absence of a federated alternative creates a business deadlock. Escalation to explore privacy-preserving computation (PPC) is warranted before hard block.",
    voteB: "ALLOW",
    rationaleB: "SWIFT fraud analytics is a legitimate financial crime prevention use case. MAS-regulated destination with full audit trail. Majority ESCALATE is overly cautious — ALLOW under standard monitoring.",
    accent: "border-red-500/25 bg-red-500/6", nameColor: "text-red-300", icon: "⚡",
  },
  {
    num: "10", name: "Final Arbiter",
    role: "Synthesises all nine perspectives, resolves dissent, and issues the binding consensus decision with a full rationale chain.",
    voteA: "INTERCEPT",
    rationaleA: "8/10 agents identify hard regulatory blockers. The 2 ESCALATE votes raise valid operational concerns but do not override the legal and residency violations. Decision: INTERCEPT. Override path open via Governance Engine.",
    voteB: "ESCALATE",
    rationaleB: "6/10 agents recommend ESCALATE. 3 INTERCEPT votes flag real but manageable risks (legal basis, lineage gap). 1 ALLOW vote is noted but insufficient. Decision: ESCALATE — route to human approval with enhanced controls.",
    accent: "border-yellow-500/25 bg-yellow-500/6", nameColor: "text-yellow-300", icon: "✦",
  },
];

// ── Scenario metadata ─────────────────────────────────────────────────────────
const SCENARIO_A: ScenarioMeta = {
  id: "A",
  name: "Cross-border analytics workload",
  source: "Saudi Arabia",
  destination: "Frankfurt, Germany",
  classification: "PII + Behavioural",
  requestedAction: "Analytics replication",
  deliberationTime: "847 ms",
  finalDecision: "INTERCEPT",
  interceptCount: 8,
  escalateCount: 2,
  allowCount: 0,
  confidence: "92%",
  reason: "Residency, privacy, and auditability risks exceed the allowed policy threshold. Transfer blocked pending SDAIA approval and contractual safeguards. Override path available via Governance Engine.",
  rationaleChain: [
    { step: 1, label: "Data residency detected",                detail: "Source jurisdiction: Saudi Arabia (KSA). PDPL SA Article 29 applies. Cross-border transfer flag raised." },
    { step: 2, label: "PII classification confirmed",           detail: "Column scan: 14 PII fields, 6 SENSITIVE fields. Customer behavioural data includes purchase history, location, and device identifiers." },
    { step: 3, label: "EU destination requires exception review", detail: "Frankfurt (EU-CENTRAL-1) is not on the SDAIA approved transfer list. No adequacy decision. Contractual safeguards (SCCs) not in place." },
    { step: 4, label: "Override path available",                detail: "Operator may submit an override request with SDAIA approval documentation and SCC evidence. Override routed to Governance Engine queue." },
    { step: 5, label: "Audit evidence generated",               detail: "Consensus record CGE-2024-0047 written to immutable audit trail. OpenTelemetry trace ID attached. Evidence package available for regulatory submission." },
  ],
  policyThresholds: [
    { policy: "PDPL SA Article 29",               threshold: "Cross-border personal data transfer",              result: "BREACHED", risk: "High"   },
    { policy: "Internal Residency Policy v2.1",   threshold: "Customer PII must remain in approved regions",     result: "BREACHED", risk: "High"   },
    { policy: "Auditability Control",              threshold: "External analytics copy requires immutable evidence", result: "PASSED",   risk: "Medium" },
  ],
  audit: {
    consensusId: "CGE-2024-0047",
    timestamp: "2024-11-14T09:23:41Z",
    voteBreakdown: "8 INTERCEPT · 2 ESCALATE · 0 ALLOW",
    traceId: "otel-trace-7f3a2c1d-8b4e-4f9a-a2d1-c5e6f7a8b9c0",
    majorityRationale: "Transfer blocked: PDPL SA Article 29 violation (no SDAIA approval), absent contractual safeguards, incomplete data lineage manifest, and non-sovereign destination cloud operator.",
    minorityOpinion: "2 agents (Business Impact Assessor, Red-Team Challenger) recommended ESCALATE rather than hard block, citing time-sensitive analytics workload and the availability of privacy-preserving computation alternatives.",
    overridePath: "Available — submit SDAIA approval + SCCs via Governance Engine override workflow.",
  },
};

const SCENARIO_B: ScenarioMeta = {
  id: "B",
  name: "Treasury payment anomaly review",
  source: "Kuwait",
  destination: "Singapore",
  classification: "SWIFT/payment metadata + counterparty risk signals",
  requestedAction: "Fraud analytics routing",
  deliberationTime: "612 ms",
  finalDecision: "ESCALATE",
  interceptCount: 3,
  escalateCount: 6,
  allowCount: 1,
  confidence: "81%",
  reason: "Transaction risk signals require human approval, but data movement may be permitted under enhanced controls. Escalation routes to Compliance Officer for 4-hour review window.",
  rationaleChain: [
    { step: 1, label: "SWIFT metadata classification confirmed",  detail: "Source: Kuwait CITRA jurisdiction. SWIFT ISO 20022 payment metadata detected. Counterparty risk signals flagged as institutional data (not personal)." },
    { step: 2, label: "MAS-regulated destination assessed",       detail: "Singapore MAS TRM guidelines recognised by CITRA as equivalent controls. AWS AP-SOUTHEAST-1 holds MAS cloud certification. Destination risk: moderate." },
    { step: 3, label: "Legal basis requires verification",        detail: "Fraud analytics routing requires explicit CITRA cross-border approval. No standing approval on file for Singapore. Legal gap identified by Compliance Counsel." },
    { step: 4, label: "Human approval path activated",            detail: "6/10 agents recommend ESCALATE. Routed to Compliance Officer queue with 4-hour SLA. Enhanced monitoring controls applied during review window." },
    { step: 5, label: "Audit evidence generated",                 detail: "Consensus record CGE-2024-0089 written to immutable audit trail. OpenTelemetry trace ID attached. Escalation ticket #ESC-2024-0089 created." },
  ],
  policyThresholds: [
    { policy: "CITRA Kuwait Data Governance",       threshold: "Payment metadata export review",                   result: "ESCALATE", risk: "High"   },
    { policy: "Financial Crime Monitoring Policy", threshold: "Counterparty risk signals require human review",      result: "ESCALATE", risk: "High"   },
    { policy: "Enhanced Encryption Control",       threshold: "Tokenised metadata routing permitted under controls", result: "PASSED",   risk: "Medium" },
  ],
  audit: {
    consensusId: "CGE-2024-0089",
    timestamp: "2024-11-14T11:47:03Z",
    voteBreakdown: "3 INTERCEPT · 6 ESCALATE · 1 ALLOW",
    traceId: "otel-trace-2a9b4e7c-1d3f-4a8b-b2c5-d6e7f8a9b0c1",
    majorityRationale: "Escalation recommended: legal basis for cross-border fraud analytics routing requires CITRA approval. Counterparty risk signals are institutional, not personal data. Enhanced controls can mitigate residency and sovereignty risks during review.",
    minorityOpinion: "3 agents (Compliance Counsel, Data Residency Judge, Risk Quant) recommended INTERCEPT citing absent CITRA approval. 1 agent (Red-Team Challenger) recommended ALLOW, arguing SWIFT fraud analytics is a legitimate financial crime prevention use case under standard monitoring.",
    overridePath: "Available — Compliance Officer approval within 4-hour SLA activates routing under enhanced monitoring. Hard block if SLA expires without approval.",
  },
};

// ── Comparison strip data ─────────────────────────────────────────────────────
const COMPARISON = [
  {
    id: "A" as const,
    label: "Scenario A",
    name: "Cross-border analytics",
    route: "SA → Frankfurt",
    verdict: "INTERCEPT" as Vote,
    reason: "Residency/privacy threshold exceeded — hard block required.",
  },
  {
    id: "B" as const,
    label: "Scenario B",
    name: "Treasury payment anomaly",
    route: "KW → Singapore",
    verdict: "ESCALATE" as Vote,
    reason: "Payment-risk uncertainty requires human approval before routing.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function SADOConsensus() {
  useProspectFromUrl();
  const { prospect } = useProspectMode();
  const [qrOpen, setQrOpen] = useState(false);
  const { copyState, copyLink: copyProspectLink } = useProspectCopyLink();
  const [activeScenario, setActiveScenario] = useState<"A" | "B">("A");

  const scenario = activeScenario === "A" ? SCENARIO_A : SCENARIO_B;
  const vc = VOTE_CONFIG[scenario.finalDecision];

  // Dynamic page title + OG tags
  useEffect(() => {
    const p = prospect?.prospectName ? `${prospect.prospectName} · ` : "";
    const pageTitle = `SADO · ${p}Consensus Engine`;
    const pageDesc = "SADO Consensus Governance Engine: 10-agent deliberation council for high-risk sovereign data decisions — architecture preview.";
    document.title = pageTitle;
    function upsertMeta(attr: string, val: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${val}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, val); document.head.appendChild(el); }
      el.content = content;
    }
    upsertMeta("name",     "description",   pageDesc);
    upsertMeta("property", "og:title",       pageTitle);
    upsertMeta("property", "og:description", pageDesc);
    upsertMeta("property", "og:type",        "website");
    upsertMeta("property", "og:url",         window.location.href);
    return () => {
      document.title = "AgenThinkMesh";
      ["meta[name=\"description\"]","meta[property=\"og:title\"]","meta[property=\"og:description\"]","meta[property=\"og:type\"]","meta[property=\"og:url\"]"].forEach(s => document.querySelector(s)?.remove());
    };
  }, [prospect?.prospectName]);

  return (
    <>
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)]">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href={`/sado${buildProspectQuery(prospect)}`}>
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Users className="w-5 h-5 text-blue-400" />
          <div className="flex-1">
            <h1 className="text-base font-semibold text-white">Consensus Governance Engine</h1>
            <p className="text-xs text-slate-400">10-agent deliberation for high-risk sovereign data decisions</p>
          </div>
          {prospect && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Shield className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-300">{prospect.prospectName}</span>
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                title="Show QR code for this prospect link"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
                <span>QR</span>
              </button>
            </div>
          )}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/8 text-xs text-amber-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 inline-block" />
            Architecture preview
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* ── Scenario comparison strip ─────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Scenario Comparison — Same Council, Different Verdicts</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COMPARISON.map((c) => {
              const cvc = VOTE_CONFIG[c.verdict];
              const isActive = activeScenario === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveScenario(c.id)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    isActive
                      ? `${cvc.borderColor} ${cvc.bgColor} ring-1 ring-inset ${cvc.borderColor}`
                      : "border-slate-700 bg-[oklch(0.13_0.03_255)] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-slate-300" : "text-slate-600"}`}>{c.label}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${cvc.badge}`}>
                      {cvc.icon}
                      {cvc.label}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold mb-0.5 ${isActive ? "text-white" : "text-slate-400"}`}>{c.name}</p>
                  <p className="text-[11px] text-slate-500 mb-2">{c.route}</p>
                  <p className={`text-xs leading-relaxed ${isActive ? "text-slate-300" : "text-slate-600"}`}>{c.reason}</p>
                  {isActive && (
                    <p className="text-[10px] text-blue-400 mt-2 font-semibold">← Viewing this scenario</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 1. Decision scenario ──────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Decision Scenario</p>
          <div className="rounded-xl border border-slate-700 bg-[oklch(0.13_0.03_255)] p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">{scenario.name}</h2>
                <p className="text-xs text-slate-400 mb-4">Submitted to Consensus Engine for pre-enforcement deliberation</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Source",           value: scenario.source,          color: "text-green-300"  },
                    { label: "Destination",      value: scenario.destination,     color: "text-red-300"    },
                    { label: "Classification",   value: scenario.classification,  color: "text-amber-300"  },
                    { label: "Requested action", value: scenario.requestedAction, color: "text-slate-300"  },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">{label}</p>
                      <p className={`text-sm font-semibold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2 text-slate-500 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Deliberation time: {scenario.deliberationTime}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Consensus result ───────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Consensus Result</p>
          <div className={`rounded-xl border ${vc.borderColor} ${vc.bgColor} p-6`}>
            <div className="flex flex-wrap items-start gap-6">
              {/* Final decision */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl ${vc.bgColor} border ${vc.borderColor} flex items-center justify-center flex-shrink-0`}>
                  {vc.iconEl}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Final Decision</p>
                  <p className={`text-2xl font-bold tracking-tight ${vc.decisionColor}`}>{scenario.finalDecision}</p>
                </div>
              </div>

              {/* Vote breakdown */}
              <div className="flex gap-4">
                {[
                  { label: "INTERCEPT", count: scenario.interceptCount, color: "text-red-400",     bar: "bg-red-500"     },
                  { label: "ESCALATE",  count: scenario.escalateCount,  color: "text-amber-400",   bar: "bg-amber-500"   },
                  { label: "ALLOW",     count: scenario.allowCount,     color: "text-emerald-400", bar: "bg-emerald-500" },
                ].map(({ label, count, color, bar }) => (
                  <div key={label} className="text-center min-w-[52px]">
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{count}</p>
                    <div className="w-full h-1 rounded-full bg-slate-800 mt-1 mb-1 overflow-hidden">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${(count / 10) * 100}%` }} />
                    </div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">{label}</p>
                  </div>
                ))}
              </div>

              {/* Confidence */}
              <div className="border-l border-slate-700 pl-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Confidence</p>
                <p className="text-2xl font-bold text-white tabular-nums">{scenario.confidence}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">weighted council score</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-5 leading-relaxed border-t border-slate-800 pt-4">
              <span className="font-semibold text-slate-300">Reason: </span>
              {scenario.reason}
            </p>
          </div>
        </section>

        {/* ── 2b. Policy thresholds evaluated ─────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Policy Thresholds Evaluated
            <span className="ml-2 font-normal text-slate-600 normal-case tracking-normal">— static demo · architecture preview</span>
          </p>
          <div className="rounded-xl border border-slate-700 bg-[oklch(0.13_0.03_255)] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/40">
              <p className="col-span-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Policy</p>
              <p className="col-span-4 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Threshold</p>
              <p className="col-span-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Result</p>
              <p className="col-span-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Risk</p>
            </div>
            {/* Table rows */}
            {scenario.policyThresholds.map(({ policy, threshold, result, risk }) => {
              const resultStyle =
                result === "BREACHED"  ? "bg-red-500/10 text-red-400 border-red-500/20" :
                result === "ESCALATE"  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                         "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
              const resultIcon =
                result === "BREACHED"  ? <XCircle className="w-3 h-3" /> :
                result === "ESCALATE"  ? <AlertTriangle className="w-3 h-3" /> :
                                         <CheckCircle2 className="w-3 h-3" />;
              const resultLabel =
                result === "BREACHED"  ? "Breached" :
                result === "ESCALATE"  ? "Escalate" :
                                         "Passed";
              const riskStyle =
                risk === "High"   ? "text-red-400" :
                risk === "Medium" ? "text-amber-400" :
                                    "text-emerald-400";
              return (
                <div key={policy} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-800/60 last:border-0 items-center">
                  <p className="col-span-4 text-xs font-semibold text-slate-200 leading-snug">{policy}</p>
                  <p className="col-span-4 text-xs text-slate-400 leading-snug">{threshold}</p>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${resultStyle}`}>
                      {resultIcon}
                      {resultLabel}
                    </span>
                  </div>
                  <p className={`col-span-2 text-xs font-semibold ${riskStyle}`}>{risk}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. Council of Ten ─────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Council of Ten — Individual Votes
            <span className="ml-2 font-normal text-slate-600 normal-case tracking-normal">(Scenario {activeScenario})</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COUNCIL.map(({ num, name, role, voteA, rationaleA, voteB, rationaleB, accent, nameColor, icon }) => {
              const vote = activeScenario === "A" ? voteA : voteB;
              const rationale = activeScenario === "A" ? rationaleA : rationaleB;
              const cvc = VOTE_CONFIG[vote];
              return (
                <div key={num} className={`rounded-xl border ${accent} p-4`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tabular-nums text-slate-600">{num}</span>
                      <span className="text-base leading-none" role="img" aria-label={name}>{icon}</span>
                      <p className={`text-sm font-semibold ${nameColor}`}>{name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide flex-shrink-0 ${cvc.badge}`}>
                      {cvc.icon}
                      {cvc.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{role}</p>
                  <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-2">{rationale}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. Rationale chain ────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Rationale Chain</p>
          <div className="rounded-xl border border-slate-700 bg-[oklch(0.13_0.03_255)] divide-y divide-slate-800">
            {scenario.rationaleChain.map(({ step, label, detail }) => (
              <div key={step} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-0.5">
                  <span className="text-[10px] font-bold text-blue-400 tabular-nums">{step}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200 mb-0.5">{label}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 flex-shrink-0 mt-1 ml-auto" />
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Audit evidence preview ─────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Audit Evidence Preview</p>
          <div className="rounded-xl border border-slate-700 bg-[oklch(0.13_0.03_255)] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lock className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-semibold text-white">Consensus Record</p>
              <Badge variant="outline" className="text-[10px] bg-slate-800 border-slate-700 text-slate-400 ml-auto">
                Append-only · Immutable
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: "Consensus ID",        value: scenario.audit.consensusId,    mono: true  },
                { label: "Timestamp",           value: scenario.audit.timestamp,      mono: true  },
                { label: "Final Action",        value: scenario.finalDecision,        mono: false, valueClass: vc.decisionColor + " font-bold" },
                { label: "Confidence",          value: scenario.confidence,           mono: false, valueClass: "text-white font-bold" },
                { label: "Vote Breakdown",      value: scenario.audit.voteBreakdown,  mono: false },
                { label: "OpenTelemetry Trace", value: scenario.audit.traceId,        mono: true  },
              ].map(({ label, value, mono, valueClass }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-0.5">{label}</p>
                  <p className={`text-xs ${mono ? "font-mono text-slate-400" : valueClass ?? "text-slate-300"} break-all`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Majority Rationale</p>
                <p className="text-xs text-slate-300 leading-relaxed">{scenario.audit.majorityRationale}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Minority Opinion</p>
                <p className="text-xs text-slate-400 leading-relaxed">{scenario.audit.minorityOpinion}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Override Path</p>
                <p className="text-xs text-amber-400 leading-relaxed">{scenario.audit.overridePath}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Navigation footer ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 pt-2 pb-10">
          <Link href={`/sado/governance${buildProspectQuery(prospect)}`}>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors">
              <Shield className="w-3.5 h-3.5" />
              Open Governance Engine
              <ArrowRight className="w-3 h-3" />
            </button>
          </Link>
          <Link href={`/sado/audit-trail${buildProspectQuery(prospect)}`}>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors">
              <FileText className="w-3.5 h-3.5" />
              View Audit Trail
              <ArrowRight className="w-3 h-3" />
            </button>
          </Link>
          <Link href={`/sado${buildProspectQuery(prospect)}`}>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-xs text-slate-300 hover:text-white hover:border-slate-600 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to SADO
            </button>
          </Link>
        </div>

      </div>
    </div>

    {/* Prospect QR dialog */}
    {prospect && (
      <ProspectQRDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        prospectName={prospect.prospectName}
        prospectOrg={prospect.organization}
        qrValue={typeof window !== "undefined" ? window.location.href : ""}
        copyState={copyState}
        onCopy={copyProspectLink}
      />
    )}
    </>
  );
}
