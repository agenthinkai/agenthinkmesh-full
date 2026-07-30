/**
 * BakalariaCouncilPanel.tsx
 * Live Council of 8 Specialist Agents panel for the Bakalaria Digital Twin.
 * Runs agents in parallel via LLM, shows vote cards, tally, and Judge synthesis.
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentResult {
  id: string;
  name: string;
  icon: string;
  color: string;
  vote: "APPROVE" | "CONDITIONAL" | "REJECT";
  confidence: number;
  headline: string;
  rationale: string;
  key_condition: string;
  error: string | null;
}

interface JudgeResult {
  final_verdict: "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED";
  confidence: number;
  synthesis: string;
  the_bet: string;
  conditions: string[];
  dissent: string;
  month_17_assessment: string;
}

interface CouncilResult {
  agents: AgentResult[];
  judge: JudgeResult;
  tally: { approve: number; conditional: number; reject: number };
  scenarioLabel: string;
  runAt: string;
}

interface Props {
  scenarioId: string;
  scenarioLabel: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function voteColor(vote: string) {
  if (vote === "APPROVE") return { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-400", badge: "bg-emerald-500" };
  if (vote === "CONDITIONAL") return { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-400", badge: "bg-amber-500" };
  return { bg: "bg-red-500/20", border: "border-red-500/40", text: "text-red-400", badge: "bg-red-500" };
}

function verdictColor(verdict: string) {
  if (verdict === "APPROVED") return { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-300", label: "APPROVED" };
  if (verdict === "APPROVED_WITH_CONDITIONS") return { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-300", label: "APPROVED WITH CONDITIONS" };
  return { bg: "bg-red-500/20", border: "border-red-400", text: "text-red-300", label: "REJECTED" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BakalariaCouncilPanel({ scenarioId, scenarioLabel }: Props) {
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const runCouncil = trpc.bakalariaCouncil.runCouncil.useMutation({
    onSuccess: (data) => {
      setResult(data as CouncilResult);
      setHasRun(true);
    },
  });

  const isLoading = runCouncil.isPending;

  const handleRun = () => {
    runCouncil.mutate({ scenarioId, scenarioLabel });
  };

  const vc = result ? verdictColor(result.judge.final_verdict) : null;

  return (
    <div className="mt-6 council-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            Council of 8 — Live Credit Analysis
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            8 specialist AI agents analyse this facility in parallel · Scenario: <span className="text-cyan-400">{scenarioLabel}</span>
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed print:hidden"
          style={{
            background: isLoading ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "white",
            border: "1px solid rgba(139,92,246,0.4)",
          }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Running Council…
            </span>
          ) : hasRun ? "Re-run Council" : "Run Council Analysis"}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-6 text-center">
          <div className="flex justify-center gap-3 mb-3">
            {["🏦","⚠️","📋","📊","🔍","🔎","📉","🌐"].map((icon, i) => (
              <span
                key={i}
                className="text-xl animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {icon}
              </span>
            ))}
          </div>
          <p className="text-sm text-indigo-300 font-medium">8 specialist agents analysing Bakalaria financials in parallel…</p>
          <p className="text-xs text-slate-400 mt-1">Loan Underwriter · Risk Flagger · CBK Compliance · DCF Modeler · Sector Analyst · Fraud Detector · Risk Attributor · Jurisdiction Intel</p>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className="space-y-4">
          {/* Vote Tally */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{result.tally.approve}</div>
              <div className="text-xs text-emerald-300 mt-0.5">APPROVE</div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-amber-400">{result.tally.conditional}</div>
              <div className="text-xs text-amber-300 mt-0.5">CONDITIONAL</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-red-400">{result.tally.reject}</div>
              <div className="text-xs text-red-300 mt-0.5">REJECT</div>
            </div>
          </div>

          {/* Agent Cards */}
          <div className="grid grid-cols-2 gap-2">
            {result.agents.map((agent) => {
              const c = voteColor(agent.vote);
              return (
                <div
                  key={agent.id}
                  className={`rounded-lg border p-3 ${c.bg} ${c.border}`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{agent.icon}</span>
                      <span className="text-xs font-semibold text-white">{agent.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.badge} text-white`}>
                        {agent.vote}
                      </span>
                      <span className="text-[10px] text-slate-400">{agent.confidence}%</span>
                    </div>
                  </div>
                  <p className={`text-[11px] font-medium ${c.text} leading-tight mb-1`}>{agent.headline}</p>
                  <p className="text-[10px] text-slate-300 leading-snug">{agent.rationale}</p>
                  {agent.key_condition && (
                    <p className="text-[10px] text-amber-300 mt-1 leading-snug">
                      <span className="font-semibold">Condition:</span> {agent.key_condition}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Judge Verdict */}
          {vc && (
            <div className={`rounded-xl border-2 p-4 ${vc.bg} ${vc.border}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚖️</span>
                  <span className="text-sm font-bold text-white">The Judge — Final Verdict</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold px-3 py-1 rounded-lg ${vc.bg} ${vc.text} border ${vc.border}`}>
                    {vc.label}
                  </span>
                  <span className="text-xs text-slate-400">{result.judge.confidence}% confidence</span>
                </div>
              </div>

              {/* THE BET */}
              <div className="mb-3 p-2.5 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">THE BET</p>
                <p className="text-sm text-white font-medium leading-snug">{result.judge.the_bet}</p>
              </div>

              {/* Synthesis */}
              <p className="text-xs text-slate-200 leading-relaxed mb-3">{result.judge.synthesis}</p>

              {/* Conditions */}
              {result.judge.conditions.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-1.5">Conditions Before Drawdown</p>
                  <ul className="space-y-1">
                    {result.judge.conditions.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-200">
                        <span className="text-amber-400 mt-0.5">→</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Month 17 */}
              <div className="mb-3 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">DSCR Breach Assessment</p>
                <p className="text-xs text-cyan-200">{result.judge.month_17_assessment}</p>
              </div>

              {/* Dissent */}
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <p className="text-[10px] text-rose-400 uppercase tracking-wider mb-1">Dissenting View — Do Not Ignore</p>
                <p className="text-xs text-rose-200">{result.judge.dissent}</p>
              </div>

              <p className="text-[10px] text-slate-500 mt-3">
                Council run: {new Date(result.runAt).toLocaleString()} · Scenario: {result.scenarioLabel}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasRun && !isLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-center">
          <p className="text-2xl mb-2">⚖️</p>
          <p className="text-sm text-slate-300 font-medium">Council of 8 Specialist Agents</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Click "Run Council Analysis" to have 8 AI credit specialists simultaneously interrogate this facility.
            Each agent returns an independent vote and rationale. The Judge synthesises all 8 into a final governed verdict.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            {["🏦 Loan Underwriter","⚠️ Risk Flagger","📋 CBK Compliance","📊 DCF Modeler","🔍 Sector Analyst","🔎 Fraud Detector","📉 Risk Attributor","🌐 Jurisdiction Intel"].map(a => (
              <span key={a} className="px-2 py-1 rounded bg-slate-700/50 border border-slate-600/40">{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
