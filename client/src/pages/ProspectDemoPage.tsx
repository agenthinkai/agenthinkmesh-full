/**
 * ProspectDemoPage — shared component for all 5 prospect-specific demo pages.
 * Each page gets: branded header with firm logo, pre-loaded scenario memo,
 * council emphasis callout, simulated agent outputs, and a live CTA.
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AgentOutput {
  id: string;
  verdict: "ENGAGE" | "CONDITIONAL ENGAGE" | "WATCH" | "HARD NO" | "INSUFFICIENT DATA" | "CONDITIONAL ENGAGE — PENDING DATA";
  confidence: number;
  summary: string;
  flags: string[];
}

export interface ProspectConfig {
  slug: string;
  firmName: string;
  firmTagline: string;
  logoUrl: string;
  logoAlt: string;
  accentColor: string;        // Tailwind bg class for accent
  accentText: string;         // Tailwind text class
  accentBorder: string;       // Tailwind border class
  dealType: string;
  dealSubtitle: string;
  scenario: {
    label: string;
    value: string;
  }[];
  councilEmphasis: string[];
  councilMode: "gcc" | "global_vc" | "india_pe" | "gcc_equities";
  memoRef: string;
  memoDate: string;
  overallVerdict: string;
  overallConfidence: number;
  overallSummary: string;
  agentOutputs: AgentOutput[];
  ctaHeading: string;
  ctaSubheading: string;
  preloadedDealText: string;
}

// ── Verdict badge ─────────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, string> = {
    "ENGAGE": "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    "CONDITIONAL ENGAGE": "bg-amber-400/15 text-amber-300 border-amber-400/30",
    "WATCH": "bg-sky-400/15 text-sky-300 border-sky-400/30",
    "HARD NO": "bg-red-400/15 text-red-300 border-red-400/30",
    "INSUFFICIENT DATA": "bg-slate-400/15 text-slate-300 border-slate-400/30",
    "CONDITIONAL ENGAGE — PENDING DATA": "bg-amber-400/15 text-amber-300 border-amber-400/30",
  };
  return (
    <span className={`inline-block text-xs font-mono font-semibold px-2.5 py-1 rounded border ${colors[verdict] ?? "bg-slate-400/15 text-slate-300 border-slate-400/30"}`}>
      {verdict}
    </span>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-400" : value >= 55 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400 font-mono w-8 text-right">{value}%</span>
    </div>
  );
}

// ── Waitlist capture ──────────────────────────────────────────────────────────
function WaitlistCapture({ sourcePage, heading, subheading }: { sourcePage: string; heading: string; subheading: string }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message ?? "Something went wrong. Please try again."),
  });
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    join.mutate({ email: trimmed, sourcePage, workflow: "institutional" });
  }
  return (
    <div className="border border-white/10 bg-white/5 rounded-xl p-6 mt-8">
      <h2 className="text-base font-semibold text-white mb-1">{heading}</h2>
      <p className="text-sm text-slate-400 mb-5">{subheading}</p>
      {submitted ? (
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
          </svg>
          Request received — we'll be in touch.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProspectDemoPage({ config }: { config: ProspectConfig }) {
  const liveUrl = `/council-of-10?mode=${config.councilMode}&prefill=${encodeURIComponent(config.preloadedDealText)}`;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* Disclaimer strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Simulated council memo based on publicly available information — not a real transaction or investment advice
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/demos" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.25 8.75a.75.75 0 0 0 0-1.5H5.56l2.22-2.22a.75.75 0 1 0-1.06-1.06l-3.5 3.5a.75.75 0 0 0 0 1.06l3.5 3.5a.75.75 0 1 0 1.06-1.06L5.56 8.75h6.69z" />
            </svg>
            All demos
          </Link>
        </div>

        {/* ── Branded header ── */}
        <div className="flex items-start justify-between gap-6 mb-8 pb-8 border-b border-white/10">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={config.logoUrl}
                alt={config.logoAlt}
                className="h-10 max-w-[160px] object-contain bg-white rounded px-2 py-1"
              />
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${config.accentBorder} ${config.accentText} bg-transparent`}>
                PRIVATE DEMO
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{config.dealType}</h1>
            <p className="text-sm text-slate-400">{config.dealSubtitle}</p>
          </div>
          <div className="hidden sm:block text-right shrink-0">
            <div className="text-xs text-slate-500 font-mono">{config.memoRef}</div>
            <div className="text-xs text-slate-500 mt-1">{config.memoDate}</div>
          </div>
        </div>

        {/* ── Scenario parameters ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {config.scenario.map((item) => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{item.label}</div>
              <div className="text-sm font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>

        {/* ── Council emphasis ── */}
        <div className={`border ${config.accentBorder} bg-white/3 rounded-xl px-5 py-4 mb-8`}>
          <div className={`text-xs font-mono uppercase tracking-widest ${config.accentText} mb-3`}>Council emphasis</div>
          <div className="flex flex-wrap gap-2">
            {config.councilEmphasis.map((e) => (
              <span key={e} className={`text-xs px-3 py-1 rounded-full border ${config.accentBorder} ${config.accentText} bg-transparent font-medium`}>
                {e}
              </span>
            ))}
          </div>
        </div>

        {/* ── Overall verdict ── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Council verdict</div>
              <VerdictBadge verdict={config.overallVerdict} />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Consensus confidence</div>
              <div className="text-2xl font-bold text-white">{config.overallConfidence}%</div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{config.overallSummary}</p>
        </div>

        {/* ── Agent outputs ── */}
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Agent breakdown</h2>
          <div className="space-y-4">
            {config.agentOutputs.map((agent) => (
              <div key={agent.id} className="bg-white/4 border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs text-slate-500 font-mono mb-1">{agent.id}</div>
                    <VerdictBadge verdict={agent.verdict} />
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="text-xs text-slate-500 mb-1.5 text-right">Confidence</div>
                    <ConfidenceBar value={agent.confidence} />
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">{agent.summary}</p>
                {agent.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {agent.flags.map((flag) => (
                      <span key={flag} className="text-xs bg-red-400/10 text-red-300 border border-red-400/20 px-2 py-0.5 rounded">
                        ⚑ {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Live CTA ── */}
        <div className={`mt-10 border ${config.accentBorder} rounded-xl p-6 bg-white/3`}>
          <div className={`text-xs font-mono uppercase tracking-widest ${config.accentText} mb-2`}>Run your own scenario</div>
          <h3 className="text-lg font-bold text-white mb-2">{config.ctaHeading}</h3>
          <p className="text-sm text-slate-400 mb-5">{config.ctaSubheading}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={liveUrl}
              className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
            >
              Run live council →
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

        {/* ── Waitlist ── */}
        <WaitlistCapture
          sourcePage={config.slug}
          heading={config.ctaHeading}
          subheading={`Request a private onboarding session for ${config.firmName}`}
        />
      </div>
    </div>
  );
}
