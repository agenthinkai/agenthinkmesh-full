import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Static deal data ──────────────────────────────────────────────────────────
const DEAL = {
  company: "Tamweel Digital",
  stage: "Series B",
  sector: "SME Lending / Embedded Finance",
  geography: "Saudi Arabia → UAE → Kuwait",
  arr: "$6.1M ARR",
  nrr: "138% NRR",
  raise: "$28M",
  description:
    "Tamweel Digital provides embedded working-capital financing to SMEs through point-of-sale integrations with Saudi ERP and accounting platforms. Core product: API-first credit decisioning layer that underwrites invoice-backed loans in under 4 hours. Primary distribution: partnerships with Zid, Salla, and Foodics (Saudi commerce stack). SAMA Innovation Sandbox approval received Q1 2026; UAE DIFC FinTech Hive application in progress. Vision 2030 SME financing gap estimated at SAR 140B.",
};

// ── Simulated IC memo output ──────────────────────────────────────────────────
const MEMO_DATE = "22 April 2026 — 11:30 KWT";
const MEMO_REF = "IC-GCC-2026-0422-001";

const AGENT_OUTPUTS = [
  {
    id: "Agent 1 — Market & Competitive",
    verdict: "ENGAGE",
    confidence: 74,
    summary:
      "The Saudi SME financing gap is structurally large and policy-backed. Vision 2030 targets SME contribution to GDP at 35% by 2030 (currently ~29%), requiring material credit expansion. Tamweel's embedded distribution through Zid and Salla gives it a data-native underwriting advantage over traditional bank SME desks. Competitive risk is moderate: Riyad Bank and Al Rajhi have launched digital SME products, but none have achieved API-level ERP integration at scale. The UAE and Kuwait expansion corridors are logical given GCC economic integration and shared Arabic-language commerce stack.",
    flags: [],
  },
  {
    id: "Agent 2 — Financial & Unit Economics",
    verdict: "INSUFFICIENT DATA",
    confidence: 47,
    summary:
      "Top-line metrics ($6.1M ARR, 138% NRR) indicate healthy expansion revenue. However, credit portfolio metrics were not provided: NPL ratio, loan loss provision rate, average loan tenor, and risk-adjusted net interest margin are absent. At Series B in a lending business, portfolio quality is the primary valuation driver — the IC cannot assess capital efficiency of the $28M raise without these figures. The 138% NRR is consistent with cross-sell expansion but does not substitute for credit performance data.",
    flags: [
      "NPL ratio not provided",
      "Loan loss provision rate absent",
      "Risk-adjusted NIM not disclosed",
      "Average loan tenor unknown",
    ],
  },
  {
    id: "Agent 3 — Execution & Regulatory Risk",
    verdict: "WATCH",
    confidence: 55,
    summary:
      "SAMA Innovation Sandbox approval is a meaningful signal — SAMA's sandbox is selective and the approval validates the core product model. However, sandbox status is not a full licence; conversion to a Finance Company licence under the Finance Companies Control Law requires a separate application with a 12–18 month typical timeline. UAE DIFC application is early-stage. Agent 3 flags that the $28M raise is partially sized for UAE market entry, which is contingent on a licence that does not yet exist. Kuwait CBK fintech framework is nascent — no clear licensing pathway has been published.",
    flags: [
      "SAMA sandbox ≠ Finance Company licence (12–18 month conversion)",
      "UAE DIFC licence application early-stage",
      "Kuwait CBK fintech pathway undefined",
    ],
  },
  {
    id: "Agent 4 — Team & Governance",
    verdict: "CONDITIONAL ENGAGE",
    confidence: 63,
    summary:
      "Founding team has relevant domain depth: CEO previously led SME credit at Riyad Bank (SAR 2B portfolio), CTO built credit scoring infrastructure at Lean Technologies. The team's Saudi banking network is a genuine distribution asset. However, Agent 4 flags that the CFO role is currently vacant — a material governance gap for a lending business raising $28M. Cap table includes a strategic investor (Zid) with a 12% stake; potential conflict of interest if Zid exercises commercial leverage over distribution terms. Agent 4 rates governance risk above consensus.",
    flags: [
      "CFO role vacant at time of IC",
      "Zid strategic stake (12%) — potential distribution conflict",
    ],
  },
];

const CONSENSUS_VERDICT = "CONDITIONAL ENGAGE — PENDING DATA";
const CONSENSUS_RATIONALE =
  "Two agents rate the opportunity as conditionally investable; one flags insufficient credit portfolio data; one flags governance concerns above consensus. The market opportunity is structurally compelling and SAMA sandbox approval is a credible signal. The IC should not proceed to term sheet without (a) full credit portfolio metrics and (b) confirmation of CFO hire timeline. The UAE and Kuwait expansion thesis is premature pending licence clarity.";

const RECOMMENDED_NEXT_STEP =
  "Request data room access for: (1) NPL ratio and loan loss provision rate by vintage, (2) risk-adjusted NIM by product line, (3) SAMA sandbox-to-licence conversion roadmap, (4) CFO hire status and timeline, (5) Zid distribution agreement terms. Schedule follow-up IC session within 21 days of data receipt.";

const AGENT_DISAGREEMENT_NOTE =
  "Agent 4 (Team & Governance) rates governance risk above consensus, driven by the vacant CFO role and the Zid strategic stake. A lending business raising $28M without a CFO in seat is an unusual governance structure. This disagreement is flagged for IC attention.";

// ── Pre-filled deal text for /pitch-triage navigation ─────────────────────────
const PREFILL_TASK = encodeURIComponent(
  "Tamweel Digital — Series B, $28M raise. Saudi Arabia-based embedded SME lending platform. API-first credit decisioning via ERP integrations (Zid, Salla, Foodics). $6.1M ARR, 138% NRR. SAMA Innovation Sandbox approved. Expanding SA→UAE→Kuwait. Evaluate for institutional investment."
);

// ── Verdict badge ─────────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, string> = {
    "CONDITIONAL ENGAGE": "bg-amber-400/15 text-amber-300 border-amber-400/30",
    "ENGAGE": "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    "WATCH": "bg-blue-400/15 text-blue-300 border-blue-400/30",
    "INSUFFICIENT DATA": "bg-slate-400/15 text-slate-300 border-slate-400/30",
    "PASS": "bg-red-400/15 text-red-300 border-red-400/30",
    "CONDITIONAL ENGAGE — PENDING DATA": "bg-amber-400/15 text-amber-300 border-amber-400/30",
  };
  return (
    <span
      className={`inline-block text-xs font-mono font-semibold px-2.5 py-1 rounded border ${colors[verdict] ?? "bg-slate-400/15 text-slate-300 border-slate-400/30"}`}
    >
      {verdict}
    </span>
  );
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-emerald-400" : value >= 55 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-400 font-mono w-8 text-right">{value}%</span>
    </div>
  );
}

// ── Waitlist capture ─────────────────────────────────────────────────────────
function WaitlistCapture({
  sourcePage,
  heading = "Get early access",
  subheading = "Join institutional investors already using AgenThink Mesh",
}: {
  sourcePage: string;
  heading?: string;
  subheading?: string;
}) {
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GccIcDemo() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* Context strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Simulated IC memo using GCC deal patterns — not a real company or transaction
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Back-link */}
        <div className="mb-6">
          <Link href="/demos" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.25 8.75a.75.75 0 0 0 0-1.5H5.56l2.22-2.22a.75.75 0 1 0-1.06-1.06l-3.5 3.5a.75.75 0 0 0 0 1.06l3.5 3.5a.75.75 0 1 0 1.06-1.06L5.56 8.75h6.69z" />
            </svg>
            All examples
          </Link>
        </div>

        {/* Memo header */}
        <div className="mb-8 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-slate-500 bg-slate-800 border border-white/10 px-2 py-0.5 rounded">
                  IC MEMO
                </span>
                <span className="text-xs font-mono text-slate-500">{MEMO_REF}</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {DEAL.company}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {DEAL.stage} · {DEAL.sector} · {DEAL.geography}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 font-mono">{MEMO_DATE}</div>
              <div className="text-xs text-slate-500 mt-1">4 agents · multi-domain analysis</div>
            </div>
          </div>
        </div>

        {/* Deal summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "ARR", value: DEAL.arr },
            { label: "NRR", value: DEAL.nrr },
            { label: "Raise", value: DEAL.raise },
            { label: "Stage", value: DEAL.stage },
          ].map((m) => (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
              <div className="text-xs text-slate-500 mb-1">{m.label}</div>
              <div className="text-base font-semibold text-white">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Deal description */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Deal Summary</div>
          <p className="text-sm text-slate-300 leading-relaxed">{DEAL.description}</p>
        </div>

        {/* Consensus verdict */}
        <div className="border border-amber-400/30 bg-amber-400/5 rounded-xl p-5 mb-8">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Consensus Verdict</div>
            <VerdictBadge verdict={CONSENSUS_VERDICT} />
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{CONSENSUS_RATIONALE}</p>
        </div>

        {/* Agent disagreement flag */}
        <div className="border border-blue-400/30 bg-blue-400/5 rounded-xl p-4 mb-8 flex gap-3">
          <div className="mt-0.5 text-blue-400 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4.5zm0 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-blue-300 font-semibold mb-1">Agent Disagreement Flagged</div>
            <p className="text-xs text-slate-400 leading-relaxed">{AGENT_DISAGREEMENT_NOTE}</p>
          </div>
        </div>

        {/* Agent breakdown */}
        <div className="mb-8">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-4">Agent Breakdown</div>
          <div className="space-y-4">
            {AGENT_OUTPUTS.map((agent) => (
              <div
                key={agent.id}
                className="bg-white/5 border border-white/10 rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{agent.id}</div>
                    <div className="mt-1">
                      <ConfidenceBar value={agent.confidence} />
                    </div>
                  </div>
                  <VerdictBadge verdict={agent.verdict} />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">{agent.summary}</p>
                {agent.flags.length > 0 && (
                  <div className="space-y-1">
                    {agent.flags.map((flag) => (
                      <div key={flag} className="flex items-center gap-2 text-xs text-amber-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recommended next step */}
        <div className="border-l-4 border-emerald-400 bg-emerald-400/5 rounded-r-xl p-5 mb-10">
          <div className="text-xs text-emerald-400 uppercase tracking-wider font-medium mb-2">
            Recommended Next Step
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{RECOMMENDED_NEXT_STEP}</p>
        </div>

        {/* CTA section */}
        <div className="border border-white/10 bg-white/5 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-400 mb-1">
            This example uses a simulated deal. Run this on your real pipeline.
          </p>
          <p className="text-xs text-slate-500 mb-5">
            The system accepts any deal description — structured or unstructured — and returns a full IC-quality memo in under 2 minutes.
          </p>
          <button
            onClick={() => navigate(`/pitch-triage?task=${PREFILL_TASK}&stage=scaling`)}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
          >
            Run your own deal
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.75 7.25a.75.75 0 0 0 0 1.5h6.69l-2.22 2.22a.75.75 0 1 0 1.06 1.06l3.5-3.5a.75.75 0 0 0 0-1.06l-3.5-3.5a.75.75 0 1 0-1.06 1.06l2.22 2.22H3.75z" />
            </svg>
          </button>
          <p className="text-xs text-slate-600 mt-3">No setup required. Describe your deal and the agents take it from there.</p>
        </div>

        {/* Waitlist capture */}
        <WaitlistCapture
          sourcePage="gcc-ic"
          heading="Join GCC-focused institutional investors"
          subheading="Early access for funds evaluating Saudi Arabia, UAE, and Kuwait deal flow"
        />

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-600">
          <span>AgenThinkMesh · Institutional Decision Intelligence</span>
          <div className="flex items-center gap-4">
            <Link href="/security" className="text-slate-500 hover:text-emerald-400 transition-colors">
              Data &amp; Security
            </Link>
            <span className="font-mono">{MEMO_REF}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
