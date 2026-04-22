import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// ── Static deal data ──────────────────────────────────────────────────────────
const DEAL = {
  company: "Seiwa Robotics",
  stage: "Series B",
  sector: "Industrial AI / Robotics",
  geography: "Tokyo → Osaka manufacturing corridor",
  arr: "¥820M ARR (~$5.4M)",
  nrr: "162% NRR",
  raise: "$22M",
  description:
    "Vision-guided robotic assembly systems for automotive and precision electronics manufacturers along the Tokai–Kinki corridor. Core product: AI-driven quality inspection and adaptive pick-and-place modules deployed on existing factory floors without line stoppage. Primary customers are Tier 1 and Tier 2 automotive suppliers. METI-designated as a strategic deep-tech company under the Green Innovation Fund.",
};

// ── Simulated IC memo output ──────────────────────────────────────────────────
const MEMO_DATE = "22 April 2026 — 10:30 JST";
const MEMO_REF = "IC-JP-2026-0422-001";

const AGENT_OUTPUTS = [
  {
    id: "Agent 1 — Market & IP",
    verdict: "ENGAGE",
    confidence: 74,
    summary:
      "Japan's industrial robotics market is structurally underpenetrated at the SME tier. Seiwa holds four registered patents on adaptive torque-feedback algorithms and two pending patents on vision-model compression for edge inference. METI Green Innovation Fund designation provides non-dilutive co-investment of ¥300M and signals regulatory alignment. IP moat is credible for a 3–5 year window; longer-term defensibility depends on continuous R&D velocity relative to Fanuc and Yaskawa.",
    flags: [],
  },
  {
    id: "Agent 2 — Financial & Unit Economics",
    verdict: "INSUFFICIENT DATA",
    confidence: 46,
    summary:
      "¥820M ARR and 162% NRR are consistent with a sticky enterprise expansion model. However, gross margin by segment (hardware vs. software subscription vs. maintenance) has not been provided. Hardware-heavy robotics businesses typically carry 35–45% blended gross margins; software-only layers can reach 75–80%. Without segment-level margin disclosure, the capital efficiency of the $22M raise and the path to profitability cannot be assessed.",
    flags: [
      "Gross margin by segment not disclosed",
      "Hardware vs. software revenue split absent",
      "Path to profitability timeline not provided",
    ],
  },
  {
    id: "Agent 3 — Market Sizing & Timeline",
    verdict: "WATCH",
    confidence: 60,
    summary:
      "The addressable market thesis (¥4.2T TAM in Japan industrial automation by 2030) is directionally credible based on METI white paper projections. However, the company's 5-year revenue model implies 38% CAGR, which requires simultaneous expansion into three new manufacturing verticals (aerospace, medical devices, food processing) by 2028. Each vertical carries distinct certification timelines (JIS, ISO 13485, HACCP). The timeline is aggressive relative to observed certification cycles in comparable Japanese deep-tech companies.",
    flags: [
      "Multi-vertical expansion timeline aggressive",
      "Certification cycles for aerospace/medical not modelled",
    ],
  },
  {
    id: "Agent 4 — Regulatory & Export Control",
    verdict: "WATCH",
    confidence: 52,
    summary:
      "Export control exposure is the primary risk flag. Seiwa's vision-model compression technology may fall within dual-use classification under Japan's Foreign Exchange and Foreign Trade Act (FEFTA) and adjacent US EAR controls if the company pursues US or EU deployment. METI export classification review is pending; outcome expected Q4 2026. Until classification is confirmed, any non-Japan customer engagement carries regulatory uncertainty. Agent 4 rates this risk above consensus — the founding team has not previously navigated FEFTA dual-use review, and external trade counsel has not been retained.",
    flags: [
      "METI FEFTA dual-use classification pending Q4 2026",
      "US EAR adjacency not assessed by external counsel",
      "No prior FEFTA experience in founding team",
    ],
  },
];

const CONSENSUS_VERDICT = "CONDITIONAL ENGAGE — PENDING DATA";
const CONSENSUS_RATIONALE =
  "Two of four agents rate the opportunity as conditionally investable. The financial agent cannot complete its assessment without segment-level gross margin data. Agent 4 rates regulatory risk above consensus due to unresolved FEFTA dual-use classification. The IC should not proceed to term sheet without (a) gross margin by segment, (b) METI export classification outcome or external trade counsel opinion, and (c) confirmation of single-customer revenue concentration.";

const RECOMMENDED_NEXT_STEP =
  "Request data room access for: (1) gross margin by revenue segment (hardware / software / maintenance), (2) METI FEFTA classification correspondence or external trade counsel memo, (3) customer revenue concentration table (top 5 customers as % of ARR), (4) certification roadmap for aerospace and medical verticals. Schedule follow-up IC session within 21 days of data receipt.";

const AGENT_DISAGREEMENT_NOTE =
  "Agent 4 (Regulatory & Export Control) rates execution risk at 52% confidence — materially below the 60–74% confidence range of Agents 1, 2, and 3. The divergence is driven by unresolved FEFTA dual-use classification and the absence of external trade counsel. This disagreement is flagged for IC attention.";

// ── Pre-filled deal text for /pitch-triage navigation ─────────────────────────
const PREFILL_TASK = encodeURIComponent(
  "Seiwa Robotics — Series B, $22M raise. Tokyo-based industrial AI/robotics company. Vision-guided assembly and quality inspection for automotive Tier 1/2 suppliers. ¥820M ARR (~$5.4M), 162% NRR. METI Green Innovation Fund designee. Export control classification pending. Evaluate for institutional investment."
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
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            {join.isPending ? "Sending…" : "Request access →"}
          </button>
        </form>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JpIcDemo() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* Context strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Simulated IC memo using Japan deeptech deal patterns — not a real company or transaction
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

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
        <div className="border-l-4 border-emerald-400 bg-emerald-400/5 rounded-r-xl p-5 mb-8">
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
          sourcePage="jp-ic"
          heading="Join Japan-focused institutional investors"
          subheading="Early access for funds active in Japanese growth and deeptech"
        />

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-600">
          <span>AgenThinkMesh · Institutional Decision Intelligence</span>
          <span className="font-mono">{MEMO_REF}</span>
        </div>

      </div>
    </div>
  );
}
