/**
 * ProspectPage.tsx
 *
 * Shared page component for all /demo/{slug} prospect routes.
 * Consumes ProspectConfig from prospectConfigs.ts — a single config object
 * drives the entire page: hero, scenario, objections, proof report, CTA, and voice demo handoff.
 *
 * Voice demo handoff:
 *   Navigates to /voice-demo?prospect={slug}&org={name}&narration={openingNarration}
 *   VoiceDemoAgent reads these params to personalise Step 1 narration and
 *   pre-fill the lead capture form's organisation field.
 */
import { useCallback, useState } from "react";
import { Link, useLocation } from "wouter";
import type { ProspectConfig, ProofReportConfig } from "@/config/prospectConfigs";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";

// ── Verdict badge ─────────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, string> = {
    ENGAGE: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    "CONDITIONAL ENGAGE": "bg-amber-400/15 text-amber-300 border-amber-400/30",
    WATCH: "bg-sky-400/15 text-sky-300 border-sky-400/30",
    "HARD NO": "bg-red-400/15 text-red-300 border-red-400/30",
    "INSUFFICIENT DATA": "bg-slate-400/15 text-slate-300 border-slate-400/30",
  };
  return (
    <span
      className={`inline-block text-xs font-mono font-semibold px-2.5 py-1 rounded border ${
        colors[verdict] ?? "bg-slate-400/15 text-slate-300 border-slate-400/30"
      }`}
    >
      {verdict}
    </span>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 font-mono w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Waitlist capture ──────────────────────────────────────────────────────────
function WaitlistCapture({ slug, orgName }: { slug: string; orgName: string }) {
  return <WaitlistForm slug={slug} orgName={orgName} />;
}

function WaitlistForm({ slug, orgName }: { slug: string; orgName: string }) {
  const join = trpc.waitlist.join.useMutation();

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const emailVal = (fd.get("email") as string)?.trim();
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) return;
      join.mutate({ email: emailVal, sourcePage: `/demo/${slug}`, workflow: "institutional" });
    },
    [join, slug]
  );

  if (join.isSuccess) {
    return (
      <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium py-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
        </svg>
        Request received — we'll reach out to {orgName} shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        name="email"
        type="email"
        placeholder="your@institution.com"
        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/30 transition-colors"
        disabled={join.isPending}
      />
      <button
        type="submit"
        disabled={join.isPending}
        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
      >
        {join.isPending ? "Submitting…" : "Request access →"}
      </button>
    </form>
  );
}

// ── Proof Report Section ──────────────────────────────────────────────────────
function ProofReportSection({ report, orgName }: { report: ProofReportConfig; orgName: string }) {
  const releaseColor =
    report.releaseGateDetermination.startsWith("FULL RELEASE")
      ? "border-emerald-400/30 bg-emerald-400/5"
      : report.releaseGateDetermination.startsWith("CONDITIONAL RELEASE")
      ? "border-amber-400/30 bg-amber-400/5"
      : "border-sky-400/30 bg-sky-400/5";

  const releaseTextColor =
    report.releaseGateDetermination.startsWith("FULL RELEASE")
      ? "text-emerald-300"
      : report.releaseGateDetermination.startsWith("CONDITIONAL RELEASE")
      ? "text-amber-300"
      : "text-sky-300";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-violet-400/20 bg-violet-400/5 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono uppercase tracking-widest text-violet-300">
            Institutional Proof Report
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded border border-violet-400/30 text-violet-300 bg-transparent">
            NEW
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Simulated proof record based on publicly available information — not investment advice.
          This report demonstrates the governance artifact structure produced by AgenThinkMesh for {orgName}.
        </p>
      </div>

      {/* 1. Executive Summary */}
      <div className="bg-white/4 border border-white/10 rounded-xl p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
          1 · Executive Summary
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{report.executiveSummary}</p>
      </div>

      {/* 2. Governance Findings */}
      <div className="bg-white/4 border border-white/10 rounded-xl p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
          2 · Governance Findings
        </div>
        <ul className="space-y-2.5">
          {report.governanceFindings.map((finding, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span className="leading-relaxed">{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3 & 4. Constitution Version + Calibration Context */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white/4 border border-white/10 rounded-xl p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
            3 · Constitution Version
          </div>
          <p className="text-sm text-slate-300 font-mono">{report.constitutionVersion}</p>
        </div>
        <div className="bg-white/4 border border-white/10 rounded-xl p-5">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
            4 · Calibration Context
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{report.calibrationContext}</p>
        </div>
      </div>

      {/* 5. Historical Precedents */}
      <div className="bg-white/4 border border-white/10 rounded-xl p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
          5 · Historical Precedents
        </div>
        <div className="space-y-3">
          {report.historicalPrecedents.map((precedent, i) => (
            <div key={i} className="border-l-2 border-violet-400/30 pl-3">
              <p className="text-sm text-slate-300 leading-relaxed">{precedent}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Release Gate Determination */}
      <div className={`border rounded-xl p-5 ${releaseColor}`}>
        <div className={`text-xs font-mono uppercase tracking-widest mb-3 ${releaseTextColor}`}>
          6 · Release Gate Determination
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-medium">
          {report.releaseGateDetermination}
        </p>
      </div>

      {/* 7. Audit References */}
      <div className="bg-white/4 border border-white/10 rounded-xl p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
          7 · Audit References
        </div>
        <div className="space-y-2">
          {report.auditReferences.map((ref, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-mono text-slate-400">
              <span className="text-violet-400 shrink-0">#{i + 1}</span>
              <span>{ref}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Export CTA */}
      <div className="border border-violet-400/20 bg-violet-400/5 rounded-xl p-6">
        <div className="text-xs font-mono uppercase tracking-widest text-violet-300 mb-2">
          Export Proof Report
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{report.exportCtaText}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://agenthink-7enctkan.manus.space"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
          >
            Export as PDF ↗
          </a>
          <a
            href="https://agenthink-7enctkan.manus.space"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors border border-white/20"
          >
            Export as JSON ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Demo Gallery ──────────────────────────────────────────────────────────────
const DEMO_GALLERY_REPORTS = [
  {
    title: "IC Memo",
    description: "Investment committee memo with agent votes, dissents, and structured verdict.",
    badge: null as string | null,
    color: "border-cyan-400/20 bg-cyan-400/5",
    textColor: "text-cyan-300",
  },
  {
    title: "Readiness Report",
    description: "Pilot readiness assessment with deployment checklist and integration requirements.",
    badge: null as string | null,
    color: "border-sky-400/20 bg-sky-400/5",
    textColor: "text-sky-300",
  },
  {
    title: "Stress Test Report",
    description: "Scenario stress test with tail risk analysis and drawdown projections.",
    badge: null as string | null,
    color: "border-amber-400/20 bg-amber-400/5",
    textColor: "text-amber-300",
  },
  {
    title: "Interpretation Guidance",
    description: "Agent-by-agent explanation of council findings for committee presentation.",
    badge: null as string | null,
    color: "border-slate-400/20 bg-slate-400/5",
    textColor: "text-slate-300",
  },
  {
    title: "Institutional Proof Report",
    description:
      "Machine-verifiable governance artifact: 7 sections, deterministic content hash, PDF + JSON export.",
    badge: "NEW" as string | null,
    color: "border-violet-400/30 bg-violet-400/8",
    textColor: "text-violet-300",
  },
];

function DemoGallery() {
  return (
    <div className="mb-8">
      <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">
        Exportable report types
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DEMO_GALLERY_REPORTS.map((report) => (
          <div
            key={report.title}
            className={`border rounded-xl p-4 ${report.color}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-sm font-semibold ${report.textColor}`}>{report.title}</span>
              {report.badge && (
                <span
                  className={`text-xs font-mono px-1.5 py-0.5 rounded border ${report.color} ${report.textColor}`}
                >
                  {report.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{report.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab system ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview" as const, label: "Overview", badge: null as string | null },
  { id: "proof" as const, label: "Proof Report", badge: "NEW" as string | null },
];

type TabId = "overview" | "proof";

// ── Main component ────────────────────────────────────────────────────────────
export default function ProspectPage({ config }: { config: ProspectConfig }) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const logEvent = trpc.voiceDemo.logEvent.useMutation();

  const voiceDemoUrl = `/voice-demo?prospect=${encodeURIComponent(config.slug)}&org=${encodeURIComponent(config.name)}&narration=${encodeURIComponent(config.openingNarration)}`;

  function handleVoiceDemoClick() {
    logEvent.mutate({
      event: "voice_demo_launched",
      route: `/demo/${config.slug}`,
      meta: { prospect: config.slug, org: config.name },
    });
    trackEvent("voice_demo_launched", { prospect: config.slug });
    navigate(voiceDemoUrl);
  }

  function handleCtaClick() {
    logEvent.mutate({
      event: "cta_clicked",
      route: `/demo/${config.slug}`,
      meta: { prospect: config.slug, cta: config.ctaText },
    });
    trackEvent("prospect_cta_clicked", { prospect: config.slug });
  }

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-100">
      {/* Disclaimer strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Prepared for {config.name} · Simulated council memo based on publicly available information — not investment advice
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/demos"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.25 8.75a.75.75 0 0 0 0-1.5H5.56l2.22-2.22a.75.75 0 1 0-1.06-1.06l-3.5 3.5a.75.75 0 0 0 0 1.06l3.5 3.5a.75.75 0 1 0 1.06-1.06L5.56 8.75h6.69z" />
            </svg>
            All demos
          </Link>
        </div>

        {/* ── Hero ── */}
        <div className="flex items-start justify-between gap-6 mb-8 pb-8 border-b border-white/10">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/10 border border-white/20 rounded px-3 py-1.5 text-sm font-bold text-white tracking-wide">
                {config.name}
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-cyan-400/30 text-cyan-300 bg-transparent">
                PRIVATE DEMO
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">
              Prepared for {config.name}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{config.dealType}</h1>
            <p className="text-sm text-slate-400">{config.dealSubtitle}</p>
          </div>
          <div className="hidden sm:block text-right shrink-0">
            <div className="text-xs text-slate-500 font-mono">{config.memoRef}</div>
            <div className="text-xs text-slate-500 mt-1">{config.memoDate}</div>
          </div>
        </div>

        {/* ── Proof Report Highlight Banner ── */}
        <div className="border border-violet-400/20 bg-violet-400/5 rounded-xl px-5 py-3 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-2 py-0.5 rounded border border-violet-400/30 text-violet-300 bg-transparent">
              NEW
            </span>
            <span className="text-sm text-slate-300">
              <span className="font-semibold text-violet-300">Institutional Proof Report</span> — machine-verifiable governance artifact now available for every council evaluation.
            </span>
          </div>
          <button
            onClick={() => setActiveTab("proof")}
            className="shrink-0 text-xs font-semibold text-violet-300 hover:text-violet-200 transition-colors whitespace-nowrap"
          >
            View report →
          </button>
        </div>

        {/* ── Tab navigation ── */}
        <div className="flex gap-1 mb-8 border-b border-white/10 pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-violet-400 text-white bg-white/5"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/3"
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-violet-400/30 text-violet-300 bg-transparent">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <>
            {/* Industry / Region / Use Case strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Industry</div>
                <div className="text-sm font-semibold text-white">{config.industry}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Region</div>
                <div className="text-sm font-semibold text-white">{config.region}</div>
              </div>
              {config.scenario.map((item) => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{item.label}</div>
                  <div className="text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Council emphasis */}
            <div className="border border-cyan-400/20 bg-white/3 rounded-xl px-5 py-4 mb-8">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-300 mb-3">
                Council emphasis
              </div>
              <div className="flex flex-wrap gap-2">
                {config.demoEmphasis.map((e) => (
                  <span
                    key={e}
                    className="text-xs px-3 py-1 rounded-full border border-cyan-400/25 text-cyan-300 bg-transparent font-medium"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>

            {/* Overall verdict */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Council verdict</div>
                  <VerdictBadge verdict={config.overallVerdict} />
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Consensus confidence</div>
                  <div className="text-2xl font-bold text-white">
                    {Math.round(config.overallConfidence * 100)}%
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{config.overallSummary}</p>
            </div>

            {/* Recommended modules */}
            <div className="bg-white/4 border border-white/10 rounded-xl p-5 mb-8">
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
                Recommended modules
              </div>
              <ul className="space-y-2">
                {config.recommendedModules.map((mod) => (
                  <li key={mod} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    {mod}
                  </li>
                ))}
              </ul>
            </div>

            {/* Likely objections */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Common questions from {config.name}
              </h2>
              <div className="space-y-4">
                {config.likelyObjections.map((item, i) => (
                  <details
                    key={i}
                    className="bg-white/4 border border-white/10 rounded-xl overflow-hidden group"
                  >
                    <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none text-sm font-medium text-white hover:bg-white/5 transition-colors">
                      <span>{item.objection}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="shrink-0 text-slate-500 group-open:rotate-180 transition-transform"
                      >
                        <path d="M8 10.94 2.47 5.41a.75.75 0 1 0-1.06 1.06l6 6a.75.75 0 0 0 1.06 0l6-6a.75.75 0 1 0-1.06-1.06L8 10.94z" />
                      </svg>
                    </summary>
                    <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-white/10 pt-3">
                      {item.response}
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* Demo Gallery */}
            <DemoGallery />

            {/* Voice demo CTA */}
            <div className="border border-amber-400/20 rounded-xl p-6 bg-amber-400/5 mb-6">
              <div className="text-xs font-mono uppercase tracking-widest text-amber-300 mb-2">
                Guided demo
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Run the 8-step voice walkthrough for {config.name}
              </h3>
              <p className="text-sm text-slate-400 mb-5">
                The demo agent will open with a narration personalised for {config.name} and guide you
                through the Council of 10 in under 10 minutes.
              </p>
              <button
                onClick={handleVoiceDemoClick}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
              >
                Start guided demo →
              </button>
            </div>

            {/* Primary CTA */}
            <div className="border border-cyan-400/20 rounded-xl p-6 bg-white/3 mb-8">
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-300 mb-2">
                Next step
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{config.ctaText}</h3>
              <p className="text-sm text-slate-400 mb-5">{config.primaryUseCase}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={config.ctaDestination}
                  onClick={handleCtaClick}
                  className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
                >
                  {config.ctaText} →
                </a>
                <a
                  href="https://agenthink-7enctkan.manus.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors border border-white/20"
                >
                  Open full platform ↗
                </a>
              </div>
            </div>

            {/* Waitlist */}
            <div className="border border-white/10 bg-white/5 rounded-xl p-6">
              <h2 className="text-base font-semibold text-white mb-1">
                Request a private onboarding session
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                We'll set up a dedicated AgenThinkMesh environment pre-configured for {config.name}'s
                use cases.
              </p>
              <WaitlistCapture slug={config.slug} orgName={config.name} />
            </div>
          </>
        )}

        {/* ── Proof Report Tab ── */}
        {activeTab === "proof" && (
          <ProofReportSection report={config.proofReport} orgName={config.name} />
        )}
      </div>
    </div>
  );
}
