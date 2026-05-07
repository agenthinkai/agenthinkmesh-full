/**
 * SADOConsensus.tsx — SADO Phase B.2
 *
 * Consensus Governance Engine — static architecture preview page.
 * Demonstrates a 10-agent deliberation council evaluating a high-risk
 * cross-border data transfer scenario (SA → Frankfurt).
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

// ── Static agent council data ─────────────────────────────────────────────────
const COUNCIL = [
  {
    num: "01",
    name: "Data Residency Judge",
    role: "Evaluates whether the transfer destination satisfies all applicable data localisation obligations under PDPL SA, CITRA KW, and NESA UAE.",
    vote: "INTERCEPT" as const,
    rationale: "Destination is Frankfurt (EU), outside the SDAIA-approved transfer list. No adequacy decision exists between KSA and Germany. Transfer must be blocked pending SDAIA approval.",
    accent: "border-blue-500/25 bg-blue-500/6",
    nameColor: "text-blue-300",
    icon: "⚖",
  },
  {
    num: "02",
    name: "Privacy Officer",
    role: "Assesses whether the data subjects' rights under PDPL SA Article 29 and GDPR Article 46 are adequately protected for cross-border transfer.",
    vote: "INTERCEPT" as const,
    rationale: "Customer behavioural PII lacks contractual safeguards (SCCs) with the Frankfurt processor. Consent was not collected for cross-border analytics replication.",
    accent: "border-violet-500/25 bg-violet-500/6",
    nameColor: "text-violet-300",
    icon: "🔒",
  },
  {
    num: "03",
    name: "Security Architect",
    role: "Reviews encryption posture, key custody, and data-in-transit controls for the proposed replication path.",
    vote: "INTERCEPT" as const,
    rationale: "Replication channel uses TLS 1.2 without customer-managed keys. Encryption key custody would transfer outside sovereign control. Remediation required before transfer.",
    accent: "border-slate-500/25 bg-slate-500/6",
    nameColor: "text-slate-300",
    icon: "🛡",
  },
  {
    num: "04",
    name: "Compliance Counsel",
    role: "Interprets applicable regulatory text and determines whether a legal basis for transfer exists under current policy.",
    vote: "INTERCEPT" as const,
    rationale: "No Article 29 exception applies. Transfer for analytics replication is not necessary for performance of an international obligation. Legal basis absent.",
    accent: "border-emerald-500/25 bg-emerald-500/6",
    nameColor: "text-emerald-300",
    icon: "📋",
  },
  {
    num: "05",
    name: "Risk Quant",
    role: "Quantifies regulatory penalty exposure, reputational risk, and operational impact of proceeding versus blocking the transfer.",
    vote: "INTERCEPT" as const,
    rationale: "Estimated regulatory exposure: SAR 5–20M under PDPL SA. Reputational risk score: 8.4/10. Expected value of proceeding is negative. Block recommended.",
    accent: "border-amber-500/25 bg-amber-500/6",
    nameColor: "text-amber-300",
    icon: "📊",
  },
  {
    num: "06",
    name: "Cloud Sovereignty Analyst",
    role: "Verifies that the destination cloud region and operator meet sovereign cloud requirements for the originating jurisdiction.",
    vote: "INTERCEPT" as const,
    rationale: "Frankfurt region is operated by AWS EU (not a GCC-sovereign operator). No NESA cloud security assessment on file for this destination. Transfer not cleared.",
    accent: "border-cyan-500/25 bg-cyan-500/6",
    nameColor: "text-cyan-300",
    icon: "☁",
  },
  {
    num: "07",
    name: "Lineage Auditor",
    role: "Traces the data lineage from source system to proposed destination and verifies audit trail completeness.",
    vote: "INTERCEPT" as const,
    rationale: "Lineage graph shows 3 upstream PII joins not reflected in the transfer manifest. Incomplete lineage means audit trail would be non-compliant. Block until manifest is corrected.",
    accent: "border-indigo-500/25 bg-indigo-500/6",
    nameColor: "text-indigo-300",
    icon: "🔗",
  },
  {
    num: "08",
    name: "Business Impact Assessor",
    role: "Evaluates the operational and commercial impact of blocking versus allowing the transfer, and identifies alternative architectures.",
    vote: "ESCALATE" as const,
    rationale: "Analytics workload is time-sensitive (quarterly reporting). Blocking has a 3-day operational impact. Recommend escalation to explore a federated query alternative that avoids replication.",
    accent: "border-orange-500/25 bg-orange-500/6",
    nameColor: "text-orange-300",
    icon: "💼",
  },
  {
    num: "09",
    name: "Red-Team Challenger",
    role: "Stress-tests the majority position by identifying weaknesses in the blocking rationale and potential for regulatory arbitrage.",
    vote: "ESCALATE" as const,
    rationale: "Majority INTERCEPT is sound, but the absence of a federated alternative creates a business deadlock. Escalation to explore privacy-preserving computation (PPC) is warranted before hard block.",
    accent: "border-red-500/25 bg-red-500/6",
    nameColor: "text-red-300",
    icon: "⚡",
  },
  {
    num: "10",
    name: "Final Arbiter",
    role: "Synthesises all nine perspectives, resolves dissent, and issues the binding consensus decision with a full rationale chain.",
    vote: "INTERCEPT" as const,
    rationale: "8/10 agents identify hard regulatory blockers. The 2 ESCALATE votes raise valid operational concerns but do not override the legal and residency violations. Decision: INTERCEPT. Override path open via Governance Engine.",
    accent: "border-yellow-500/25 bg-yellow-500/6",
    nameColor: "text-yellow-300",
    icon: "✦",
  },
] as const;

type Vote = "INTERCEPT" | "ESCALATE" | "ALLOW";

const VOTE_CONFIG: Record<Vote, { badge: string; icon: React.ReactNode; label: string }> = {
  INTERCEPT: {
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: <XCircle className="w-3 h-3" />,
    label: "INTERCEPT",
  },
  ESCALATE: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "ESCALATE",
  },
  ALLOW: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: "ALLOW",
  },
};

// ── Rationale chain steps ─────────────────────────────────────────────────────
const RATIONALE_CHAIN = [
  { step: 1, label: "Data residency detected",          detail: "Source jurisdiction: Saudi Arabia (KSA). PDPL SA Article 29 applies. Cross-border transfer flag raised." },
  { step: 2, label: "PII classification confirmed",     detail: "Column scan: 14 PII fields, 6 SENSITIVE fields. Customer behavioural data includes purchase history, location, and device identifiers." },
  { step: 3, label: "EU destination requires exception review", detail: "Frankfurt (EU-CENTRAL-1) is not on the SDAIA approved transfer list. No adequacy decision. Contractual safeguards (SCCs) not in place." },
  { step: 4, label: "Override path available",          detail: "Operator may submit an override request with SDAIA approval documentation and SCC evidence. Override routed to Governance Engine queue." },
  { step: 5, label: "Audit evidence generated",         detail: "Consensus record CGE-2024-0047 written to immutable audit trail. OpenTelemetry trace ID attached. Evidence package available for regulatory submission." },
];

// ── Audit evidence ────────────────────────────────────────────────────────────
const AUDIT_EVIDENCE = {
  consensusId: "CGE-2024-0047",
  timestamp: "2024-11-14T09:23:41Z",
  finalAction: "INTERCEPT",
  confidence: "92%",
  voteBreakdown: "8 INTERCEPT · 2 ESCALATE · 0 ALLOW",
  majorityRationale: "Transfer blocked: PDPL SA Article 29 violation (no SDAIA approval), absent contractual safeguards, incomplete data lineage manifest, and non-sovereign destination cloud operator.",
  minorityOpinion: "2 agents (Business Impact Assessor, Red-Team Challenger) recommended ESCALATE rather than hard block, citing time-sensitive analytics workload and the availability of privacy-preserving computation alternatives that could satisfy both business and regulatory requirements.",
  overridePath: "Available — submit SDAIA approval + SCCs via Governance Engine override workflow.",
  traceId: "otel-trace-7f3a2c1d-8b4e-4f9a-a2d1-c5e6f7a8b9c0",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SADOConsensus() {
  useProspectFromUrl();
  const { prospect } = useProspectMode();
  const [qrOpen, setQrOpen] = useState(false);
  const { copyState, copyLink: copyProspectLink } = useProspectCopyLink();

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

  const interceptCount = COUNCIL.filter(a => (a.vote as string) === "INTERCEPT").length;
  const escalateCount  = COUNCIL.filter(a => (a.vote as string) === "ESCALATE").length;
  const allowCount     = COUNCIL.filter(a => (a.vote as string) === "ALLOW").length;

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
          {/* Architecture preview badge */}
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/8 text-xs text-amber-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 inline-block" />
            Architecture preview
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* ── 1. Decision scenario ──────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Decision Scenario</p>
          <div className="rounded-xl border border-slate-700 bg-[oklch(0.13_0.03_255)] p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-white mb-1">Cross-border analytics workload</h2>
                <p className="text-xs text-slate-400 mb-4">Submitted to Consensus Engine for pre-enforcement deliberation</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Source",          value: "Saudi Arabia",                  color: "text-green-300" },
                    { label: "Destination",     value: "Frankfurt, Germany",            color: "text-red-300"   },
                    { label: "Classification",  value: "PII + Behavioural",             color: "text-amber-300" },
                    { label: "Requested action",value: "Analytics replication",         color: "text-slate-300" },
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
                <span>Deliberation time: 847 ms</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Consensus result ───────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Consensus Result</p>
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-6">
            <div className="flex flex-wrap items-start gap-6">
              {/* Final decision */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">Final Decision</p>
                  <p className="text-2xl font-bold text-red-400 tracking-tight">INTERCEPT</p>
                </div>
              </div>

              {/* Vote breakdown */}
              <div className="flex gap-4">
                {[
                  { label: "INTERCEPT", count: interceptCount, color: "text-red-400",   bar: "bg-red-500" },
                  { label: "ESCALATE",  count: escalateCount,  color: "text-amber-400", bar: "bg-amber-500" },
                  { label: "ALLOW",     count: allowCount,     color: "text-emerald-400", bar: "bg-emerald-500" },
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
                <p className="text-2xl font-bold text-white tabular-nums">92%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">weighted council score</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-5 leading-relaxed border-t border-slate-800 pt-4">
              <span className="font-semibold text-slate-300">Reason: </span>
              Residency, privacy, and auditability risks exceed the allowed policy threshold. Transfer blocked pending SDAIA approval and contractual safeguards. Override path available via Governance Engine.
            </p>
          </div>
        </section>

        {/* ── 3. Council of Ten ─────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Council of Ten — Individual Votes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COUNCIL.map(({ num, name, role, vote, rationale, accent, nameColor, icon }) => {
              const vc = VOTE_CONFIG[vote];
              return (
                <div key={num} className={`rounded-xl border ${accent} p-4`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tabular-nums text-slate-600">{num}</span>
                      <span className="text-base leading-none" role="img" aria-label={name}>{icon}</span>
                      <p className={`text-sm font-semibold ${nameColor}`}>{name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide flex-shrink-0 ${vc.badge}`}>
                      {vc.icon}
                      {vc.label}
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
            {RATIONALE_CHAIN.map(({ step, label, detail }) => (
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
                { label: "Consensus ID",      value: AUDIT_EVIDENCE.consensusId,    mono: true  },
                { label: "Timestamp",         value: AUDIT_EVIDENCE.timestamp,      mono: true  },
                { label: "Final Action",      value: AUDIT_EVIDENCE.finalAction,    mono: false, valueClass: "text-red-400 font-bold" },
                { label: "Confidence",        value: AUDIT_EVIDENCE.confidence,     mono: false, valueClass: "text-white font-bold" },
                { label: "Vote Breakdown",    value: AUDIT_EVIDENCE.voteBreakdown,  mono: false },
                { label: "OpenTelemetry Trace", value: AUDIT_EVIDENCE.traceId,      mono: true  },
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
                <p className="text-xs text-slate-300 leading-relaxed">{AUDIT_EVIDENCE.majorityRationale}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Minority Opinion</p>
                <p className="text-xs text-slate-400 leading-relaxed">{AUDIT_EVIDENCE.minorityOpinion}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Override Path</p>
                <p className="text-xs text-amber-400 leading-relaxed">{AUDIT_EVIDENCE.overridePath}</p>
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
