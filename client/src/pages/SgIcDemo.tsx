import { useLocation } from "wouter";

// ── Static deal data ──────────────────────────────────────────────────────────
const DEAL = {
  company: "PayFlow Technologies",
  stage: "Series B",
  sector: "Payments Infrastructure",
  geography: "Singapore → Malaysia → Thailand",
  arr: "$4.2M ARR",
  nrr: "180% NRR",
  raise: "$18M",
  description:
    "B2B payments infrastructure for SME cross-border disbursements across Southeast Asia. Core product: embedded treasury rails enabling real-time FX settlement between SGD, MYR, and THB. Primary customers are logistics operators, staffing agencies, and digital-first distributors.",
};

// ── Simulated IC memo output ──────────────────────────────────────────────────
const MEMO_DATE = "22 April 2026 — 09:14 SGT";
const MEMO_REF = "IC-SG-2026-0422-001";

const AGENT_OUTPUTS = [
  {
    id: "Agent 1 — Market & Competitive",
    verdict: "CONDITIONAL ENGAGE",
    confidence: 71,
    summary:
      "Southeast Asia cross-border SME payments is a structurally underserved segment. Incumbent rails (SWIFT, local ACH) carry 3–5 day settlement cycles; PayFlow claims T+0 for SGD/MYR/THB corridors. Competitive moat is narrow — GrabPay, Rapyd, and Nium operate adjacent corridors with larger balance sheets. Differentiation depends on corridor-specific licensing depth, not product alone.",
    flags: [],
  },
  {
    id: "Agent 2 — Financial & Unit Economics",
    verdict: "INSUFFICIENT DATA",
    confidence: 44,
    summary:
      "Top-line metrics ($4.2M ARR, 180% NRR) are consistent with a healthy expansion-revenue profile. However, unit economics below Series B threshold were not provided: CAC, payback period, gross margin per corridor, and FX spread capture rate are absent. At 180% NRR, cohort retention appears strong, but without LTV/CAC the capital efficiency of the $18M raise cannot be assessed.",
    flags: ["Unit economics not provided", "Gross margin by corridor absent", "FX spread model not disclosed"],
  },
  {
    id: "Agent 3 — Execution & Regulatory Risk",
    verdict: "WATCH",
    confidence: 58,
    summary:
      "Regulatory exposure is the primary execution risk. Operating across three jurisdictions (MAS Singapore, BNM Malaysia, BOT Thailand) requires concurrent licensing maintenance. MAS PSA Major Payment Institution licence is held; BNM MSB licence is pending renewal (Q3 2026); BOT PSPA licence application is in progress. Any single licence lapse suspends corridor operations. Agent 3 rates execution risk materially higher than the consensus — the team's regulatory track record in Malaysia and Thailand has not been independently verified.",
    flags: [
      "BNM MSB licence renewal pending Q3 2026",
      "BOT PSPA licence not yet granted",
      "Regulatory track record in MY/TH unverified",
    ],
  },
  {
    id: "Agent 4 — Team & Governance",
    verdict: "ENGAGE",
    confidence: 76,
    summary:
      "Founding team carries relevant prior experience: CEO previously led treasury operations at DBS Institutional, COO built SME lending at Funding Societies. Board includes one independent director with MAS advisory background. Cap table is clean at Series B — no participating preferred, standard 1x non-participating liquidation preference. No governance concerns identified.",
    flags: [],
  },
];

const CONSENSUS_VERDICT = "CONDITIONAL ENGAGE — PENDING DATA";
const CONSENSUS_RATIONALE =
  "Three of four agents rate the opportunity as conditionally investable. The financial agent cannot complete its assessment without unit economics. Agent 3 rates execution risk above consensus due to concurrent multi-jurisdiction licensing exposure. The IC should not proceed to term sheet without (a) verified unit economics and (b) confirmation of BNM renewal status.";

const RECOMMENDED_NEXT_STEP =
  "Request data room access for: (1) cohort-level LTV/CAC by corridor, (2) gross margin by product line, (3) BNM MSB renewal documentation, (4) BOT PSPA application timeline. Schedule follow-up IC session within 21 days of data receipt.";

const AGENT_DISAGREEMENT_NOTE =
  "Agent 3 (Execution & Regulatory Risk) rates execution risk at 58% confidence — materially below the 71–76% confidence range of Agents 1 and 4. The divergence is driven by unresolved licensing status in Malaysia and Thailand. This disagreement is flagged for IC attention.";

// ── Pre-filled deal text for /pitch-triage navigation ─────────────────────────
const PREFILL_TASK = encodeURIComponent(
  "PayFlow Technologies — Series B, $18M raise. Singapore-based B2B payments infrastructure for SME cross-border disbursements (SGD/MYR/THB corridors). $4.2M ARR, 180% NRR. Expanding SG→MY→TH. Evaluate for institutional investment."
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SgIcDemo() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      {/* Context strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Simulated IC memo using Southeast Asia deal patterns — not a real company or transaction
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

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-600">
          <span>AgenThinkMesh · Institutional Decision Intelligence</span>
          <span className="font-mono">{MEMO_REF}</span>
        </div>

      </div>
    </div>
  );
}
