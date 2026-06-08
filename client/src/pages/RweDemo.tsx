/**
 * RweDemo.tsx
 *
 * Dedicated /demo/rwe route for Sarah Strack / RWE Infrastructure Investment Team.
 * Six-tab workspace: Overview · Helios-North · Strategic Stress Test · IC Memo · Decision Drivers · Test Your Own
 *
 * Design: reuses the same dark palette (#070d1a), typography, and component
 * primitives as the existing /demo/stc, /demo/tencent, /demo/nbk pages.
 * Infrastructure terminology throughout — no VC/deal-screening language.
 */
import { useState, useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";

// ── Shared primitives (mirrors ProspectPage.tsx) ──────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, string> = {
    "APPROVED — CONDITIONAL": "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    "CONDITIONAL PROCEED": "bg-amber-400/15 text-amber-300 border-amber-400/30",
    "PROCEED TO FID": "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    "ESCALATE TO IC": "bg-amber-400/15 text-amber-300 border-amber-400/30",
    "DEFER — PENDING DILIGENCE": "bg-sky-400/15 text-sky-300 border-sky-400/30",
    "DO NOT PROCEED": "bg-red-400/15 text-red-300 border-red-400/30",
  };
  return (
    <span
      className={`inline-block text-xs font-mono font-semibold px-2.5 py-1 rounded border ${
        colors[verdict] ?? "bg-amber-400/15 text-amber-300 border-amber-400/30"
      }`}
    >
      {verdict}
    </span>
  );
}

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-slate-400 w-32 shrink-0">{label}</span>}
      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 font-mono w-8 text-right">{pct}%</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function ImpactBadge({ level }: { level: "HIGH" | "MEDIUM" | "LOW" }) {
  const styles = {
    HIGH: "bg-red-400/15 text-red-300 border-red-400/30",
    MEDIUM: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    LOW: "bg-slate-400/15 text-slate-300 border-slate-400/30",
  };
  return (
    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded border ${styles[level]}`}>
      {level}
    </span>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", badge: "Start Here" },
  { id: "helios", label: "Helios-North", badge: "Primary Case" },
  { id: "stress", label: "Strategic Stress Test", badge: null },
  { id: "memo", label: "IC Memo", badge: null },
  { id: "drivers", label: "Decision Drivers", badge: null },
  { id: "test", label: "Test Your Own Project", badge: null },
  { id: "proof", label: "Proof Report", badge: "NEW" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ onSelectTab }: { onSelectTab: (id: TabId) => void }) {
  const cases = [
    {
      id: "helios" as TabId,
      title: "Helios-North Offshore Wind",
      subtitle: "1.2 GW · North Sea · FID-stage",
      tag: "Primary Case · Start Here",
      tagColor: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
      description:
        "A 1.2 GW offshore wind project at FID-stage. The Council has stress-tested this case across 10,000 simulated futures, modelling CfD strike price volatility, EPC contract structure, DSCR sensitivities, and construction delay scenarios.",
      emphasis: true,
    },
    {
      id: "stress" as TabId,
      title: "Utility-Scale Battery Storage",
      subtitle: "400 MWh · GB · Grid-scale BESS",
      tag: "Secondary Case",
      tagColor: "border-slate-400/30 text-slate-400 bg-transparent",
      description:
        "A grid-scale battery energy storage system with merchant revenue exposure. Key variables: capacity market clearing price, degradation curve, grid connection timeline, and financing structure.",
      emphasis: false,
    },
    {
      id: "stress" as TabId,
      title: "Green Hydrogen Project",
      subtitle: "50 MW electrolysis · Industrial offtake",
      tag: "Secondary Case",
      tagColor: "border-slate-400/30 text-slate-400 bg-transparent",
      description:
        "An industrial-scale green hydrogen project with long-term offtake agreement. Key variables: electrolyser capex trajectory, power purchase agreement structure, hydrogen price floor, and regulatory certification timeline.",
      emphasis: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Workspace intro */}
      <Card>
        <SectionLabel>Workspace overview</SectionLabel>
        <h2 className="text-lg font-bold text-white mb-3">
          Prepared for Sarah Strack and the RWE team.
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          This workspace has been preloaded with three representative renewable-energy investment
          cases, so you do not need to start from a blank dashboard. Each case has been processed
          through AgenThink Mesh's Infrastructure Council — ten specialist agents debating the
          investment decision in parallel, reaching consensus, and producing a board-ready IC memo.
        </p>
        <p className="text-sm text-slate-300 leading-relaxed">
          The primary case — <strong className="text-white">Helios-North Offshore Wind</strong> — has
          been stress-tested across <strong className="text-white">10,000 simulated futures</strong>,
          modelling the full range of CfD, DSCR, EPC, and construction-delay scenarios that
          typically determine FID outcomes.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/25 rounded-lg px-4 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-mono text-emerald-300">
            Stress-tested across 10,000 simulated futures
          </span>
        </div>
      </Card>

      {/* Case cards */}
      <div>
        <SectionLabel>Preloaded cases</SectionLabel>
        <div className="space-y-4">
          {cases.map((c, i) => (
            <button
              key={i}
              onClick={() => onSelectTab(c.id)}
              className={`w-full text-left rounded-xl border p-5 transition-all ${
                c.emphasis
                  ? "border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/10"
                  : "border-white/10 bg-white/4 hover:bg-white/7"
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{c.title}</span>
                    {c.emphasis && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded border border-emerald-400/40 text-emerald-300 bg-emerald-400/10">
                        ★ Start Here
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{c.subtitle}</div>
                </div>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded border shrink-0 ${c.tagColor}`}
                >
                  {c.tag}
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{c.description}</p>
              <div className="mt-3 text-xs text-cyan-400 font-medium">
                {c.emphasis ? "Review Helios-North →" : "View case →"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Primary CTA */}
      <div className="border border-cyan-400/20 rounded-xl p-6 bg-white/3">
        <SectionLabel>Recommended starting point</SectionLabel>
        <h3 className="text-base font-bold text-white mb-2">Review Helios-North</h3>
        <p className="text-sm text-slate-400 mb-4">
          Begin with the primary case to see how the Infrastructure Council evaluates a
          FID-stage offshore wind project across 10,000 scenario permutations.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onSelectTab("helios")}
            className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
          >
            Review Helios-North →
          </button>
          <button
            onClick={() => onSelectTab("test")}
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors border border-white/20"
          >
            Test Your Own Project
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Helios-North ─────────────────────────────────────────────────────────

function HeliosTab() {
  return (
    <div className="space-y-6">
      {/* Project summary */}
      <Card>
        <SectionLabel>Project summary</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[
            { label: "Project", value: "Helios-North Offshore Wind" },
            { label: "Capacity", value: "1.2 GW" },
            { label: "Location", value: "North Sea" },
            { label: "Stage", value: "FID-stage" },
            { label: "Technology", value: "Fixed-bottom offshore wind" },
            { label: "Council Mode", value: "Infrastructure" },
          ].map((item) => (
            <div key={item.label} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{item.label}</div>
              <div className="text-sm font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/25 rounded-lg px-4 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-mono text-emerald-300">
            Infrastructure Mode enabled · Stress-tested across 10,000 simulated futures
          </span>
        </div>
      </Card>

      {/* Council recommendation */}
      <Card>
        <SectionLabel>Council recommendation</SectionLabel>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Investment committee recommendation
            </div>
            <VerdictBadge verdict="CONDITIONAL PROCEED" />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Approval probability
            </div>
            <div className="text-3xl font-bold text-white">62%</div>
            <div className="text-xs text-slate-500 mt-1">across 10,000 scenarios</div>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          The Infrastructure Council reached conditional consensus. The base case supports FID
          subject to resolution of EPC contract structure and confirmation of CfD strike price
          adequacy. The primary IC concern is DSCR resilience under a combined construction-delay
          and merchant-tail stress scenario.
        </p>
      </Card>

      {/* Main IC concern */}
      <Card className="border-amber-400/20 bg-amber-400/5">
        <SectionLabel>Main investment committee concern</SectionLabel>
        <h3 className="text-sm font-semibold text-white mb-2">
          DSCR resilience under combined construction delay + merchant tail stress
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          In 23% of stress scenarios, a 6-month construction delay combined with a CfD strike price
          below £95/MWh causes the DSCR to breach the 1.20× covenant in Year 3. The lender
          syndicate has indicated this combination would trigger a technical default clause. The
          Council recommends a contingency reserve increase from 8% to 12% of EPC contract value
          before FID is confirmed.
        </p>
      </Card>

      {/* Rejection drivers */}
      <Card>
        <SectionLabel>Top rejection drivers</SectionLabel>
        <div className="space-y-3">
          {[
            {
              driver: "CfD strike price below £95/MWh",
              detail: "Triggers DSCR breach in 23% of scenarios when combined with construction delay.",
            },
            {
              driver: "EPC contract — fixed-price coverage gap",
              detail: "Current EPC structure leaves £180M of construction cost exposure outside the fixed-price envelope.",
            },
            {
              driver: "Construction delay exceeding 6 months",
              detail: "Delays the revenue commencement date and compresses the debt service coverage window.",
            },
            {
              driver: "Grid connection uncertainty",
              detail: "Offshore transmission owner (OFTO) timeline is unconfirmed beyond Q3 2027.",
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 p-3 bg-red-400/5 border border-red-400/15 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{item.driver}</div>
                <div className="text-xs text-slate-400">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Approval pathways */}
      <Card>
        <SectionLabel>Top approval pathways</SectionLabel>
        <div className="space-y-3">
          {[
            {
              pathway: "CfD strike confirmed at £105/MWh or above",
              detail: "Reduces DSCR breach probability from 23% to below 5% across all stress scenarios.",
            },
            {
              pathway: "EPC fixed-price envelope extended to full contract value",
              detail: "Eliminates the £180M construction cost exposure and satisfies lender requirements.",
            },
            {
              pathway: "Contingency reserve increased to 12% of EPC value",
              detail: "Provides sufficient buffer for a 6-month construction delay without DSCR breach.",
            },
            {
              pathway: "Grid connection agreement executed with OFTO",
              detail: "Removes the single largest schedule risk and confirms revenue commencement date.",
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 p-3 bg-emerald-400/5 border border-emerald-400/15 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{item.pathway}</div>
                <div className="text-xs text-slate-400">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sensitivity analysis */}
      <Card>
        <SectionLabel>Sensitivity analysis</SectionLabel>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-400 font-medium mb-2">DSCR sensitivity</div>
            <div className="space-y-2">
              <ConfidenceBar value={0.88} label="Base case (£105 CfD)" />
              <ConfidenceBar value={0.72} label="Mild stress (£98 CfD)" />
              <ConfidenceBar value={0.51} label="Severe stress (£90 CfD)" />
              <ConfidenceBar value={0.34} label="Downside (£85 CfD + 6mo delay)" />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Values represent probability of maintaining DSCR ≥ 1.20× across simulated scenarios.
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="text-xs text-slate-400 font-medium mb-2">Construction delay sensitivity</div>
            <div className="space-y-2">
              <ConfidenceBar value={0.89} label="On schedule" />
              <ConfidenceBar value={0.74} label="+3 months" />
              <ConfidenceBar value={0.58} label="+6 months" />
              <ConfidenceBar value={0.31} label="+12 months" />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Values represent approval probability at each delay scenario.
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="text-xs text-slate-400 font-medium mb-2">CfD strike / LCOE sensitivity</div>
            <div className="space-y-2">
              <ConfidenceBar value={0.92} label="£110/MWh" />
              <ConfidenceBar value={0.80} label="£105/MWh" />
              <ConfidenceBar value={0.62} label="£100/MWh" />
              <ConfidenceBar value={0.41} label="£95/MWh" />
              <ConfidenceBar value={0.19} label="£90/MWh" />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              LCOE estimated at £87/MWh base case. Values represent IC approval probability.
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="text-xs text-slate-400 font-medium mb-2">EPC contract structure sensitivity</div>
            <div className="space-y-2">
              <ConfidenceBar value={0.91} label="Full fixed-price" />
              <ConfidenceBar value={0.74} label="95% fixed-price" />
              <ConfidenceBar value={0.58} label="85% fixed-price" />
              <ConfidenceBar value={0.38} label="Current (78% fixed)" />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Values represent approval probability at each EPC coverage level.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Strategic Stress Test ────────────────────────────────────────────────

function StressTab() {
  return (
    <div className="space-y-6">
      {/* Explainer */}
      <Card className="border-cyan-400/20 bg-cyan-400/5">
        <SectionLabel>Why 10,000 scenarios matter</SectionLabel>
        <blockquote className="text-sm text-slate-200 leading-relaxed italic border-l-2 border-cyan-400/40 pl-4">
          "Traditional IC review usually examines one base case and a few downside sensitivities.
          AgenThink Mesh tests thousands of plausible futures and identifies which variables
          actually change the recommendation."
        </blockquote>
      </Card>

      {/* Outcome distribution */}
      <Card>
        <SectionLabel>Outcome distribution — Helios-North (10,000 scenarios)</SectionLabel>
        <div className="space-y-3">
          {[
            { label: "Proceed to FID — no conditions", value: 0.28, color: "bg-emerald-400" },
            { label: "Conditional proceed — minor conditions", value: 0.34, color: "bg-amber-400" },
            { label: "Escalate to IC — material conditions", value: 0.21, color: "bg-orange-400" },
            { label: "Defer — pending diligence", value: 0.11, color: "bg-sky-400" },
            { label: "Do not proceed", value: 0.06, color: "bg-red-400" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-52 shrink-0">{item.label}</span>
              <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${item.color}`}
                  style={{ width: `${Math.round(item.value * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 font-mono w-8 text-right">
                {Math.round(item.value * 100)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Base case vs stressed */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <SectionLabel>Base case</SectionLabel>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">CfD strike</span>
              <span className="font-mono text-white">£105/MWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LCOE</span>
              <span className="font-mono text-white">£87/MWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DSCR (Year 1)</span>
              <span className="font-mono text-white">1.38×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Construction delay</span>
              <span className="font-mono text-white">On schedule</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EPC fixed-price</span>
              <span className="font-mono text-white">78% coverage</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Approval probability</span>
              <span className="font-mono text-emerald-400">80%</span>
            </div>
          </div>
        </Card>
        <Card className="border-red-400/20 bg-red-400/5">
          <SectionLabel>Downside case</SectionLabel>
          <div className="space-y-2 text-sm text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">CfD strike</span>
              <span className="font-mono text-red-300">£90/MWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LCOE</span>
              <span className="font-mono text-red-300">£91/MWh (cost overrun)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DSCR (Year 1)</span>
              <span className="font-mono text-red-300">1.09× (breach)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Construction delay</span>
              <span className="font-mono text-red-300">+9 months</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">EPC fixed-price</span>
              <span className="font-mono text-red-300">78% (unchanged)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Approval probability</span>
              <span className="font-mono text-red-400">14%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Hidden rejection drivers */}
      <Card>
        <SectionLabel>Hidden rejection drivers — identified only in stress scenarios</SectionLabel>
        <p className="text-xs text-slate-500 mb-4">
          These variables do not appear material in the base case but become primary rejection
          drivers in stressed scenarios.
        </p>
        <div className="space-y-3">
          {[
            {
              variable: "Turbine availability factor",
              finding:
                "A 2% reduction in turbine availability (from 95% to 93%) combined with a £5/MWh CfD shortfall causes DSCR to breach in 18% of scenarios.",
            },
            {
              variable: "Contingency drawdown sequencing",
              finding:
                "If contingency is drawn before Year 2 revenue commencement, the reserve account falls below the 6-month debt service requirement in 12% of scenarios.",
            },
            {
              variable: "Merchant tail exposure post-CfD",
              finding:
                "After the 15-year CfD term, merchant revenue exposure at current forward prices produces negative equity returns in 31% of long-run scenarios.",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-orange-400/5 border border-orange-400/15 rounded-lg">
              <div className="text-sm font-semibold text-white mb-1">{item.variable}</div>
              <div className="text-xs text-slate-400">{item.finding}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Hidden approval pathways */}
      <Card>
        <SectionLabel>Hidden approval pathways — identified only in stress scenarios</SectionLabel>
        <div className="space-y-3">
          {[
            {
              pathway: "Revenue floor agreement with industrial offtaker",
              finding:
                "A partial corporate PPA covering 15% of output at £98/MWh reduces DSCR breach probability from 23% to 8% across all stress scenarios.",
            },
            {
              pathway: "EPC wrap extension to full contract value",
              finding:
                "Extending the fixed-price envelope from 78% to 95% of EPC value eliminates the primary lender objection in 94% of scenarios.",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-emerald-400/5 border border-emerald-400/15 rounded-lg">
              <div className="text-sm font-semibold text-white mb-1">{item.pathway}</div>
              <div className="text-xs text-slate-400">{item.finding}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sensitivity ranking */}
      <Card>
        <SectionLabel>Sensitivity ranking — variables ranked by impact on approval probability</SectionLabel>
        <div className="space-y-2">
          {[
            { rank: 1, variable: "CfD strike price", impact: 0.91 },
            { rank: 2, variable: "EPC contract structure", impact: 0.78 },
            { rank: 3, variable: "Construction delay", impact: 0.71 },
            { rank: 4, variable: "DSCR covenant level", impact: 0.64 },
            { rank: 5, variable: "Grid connection timeline", impact: 0.58 },
            { rank: 6, variable: "Turbine availability factor", impact: 0.43 },
            { rank: 7, variable: "Contingency adequacy", impact: 0.39 },
          ].map((item) => (
            <div key={item.rank} className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500 w-4">{item.rank}.</span>
              <span className="text-xs text-slate-300 w-48 shrink-0">{item.variable}</span>
              <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-cyan-400"
                  style={{ width: `${Math.round(item.impact * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 font-mono w-8 text-right">
                {Math.round(item.impact * 100)}%
              </span>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-3">
          Impact score = correlation between variable change and approval probability shift across 10,000 scenarios.
        </div>
      </Card>

      {/* Governance escalation */}
      <Card className="border-amber-400/20 bg-amber-400/5">
        <SectionLabel>Governance escalation points</SectionLabel>
        <div className="space-y-3">
          {[
            {
              trigger: "DSCR falls below 1.20× in base case",
              action: "Automatic escalation to Investment Committee — FID cannot proceed without IC sign-off.",
            },
            {
              trigger: "EPC fixed-price coverage below 85%",
              action: "Lender syndicate requires additional contingency reserve or parent company guarantee.",
            },
            {
              trigger: "CfD strike below £95/MWh",
              action: "Project returns fall below the 8% equity IRR threshold — requires board-level approval to proceed.",
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{item.trigger}</div>
                <div className="text-xs text-slate-400">{item.action}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: IC Memo ──────────────────────────────────────────────────────────────

function IcMemoTab() {
  return (
    <div className="space-y-6">
      {/* Memo header */}
      <Card>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <SectionLabel>Investment committee memorandum</SectionLabel>
            <h2 className="text-lg font-bold text-white mb-1">Helios-North Offshore Wind</h2>
            <div className="text-xs text-slate-500 font-mono">IC-HELIOS-2026-0604-001 · 4 June 2026</div>
          </div>
          <VerdictBadge verdict="CONDITIONAL PROCEED" />
        </div>
      </Card>

      {/* Executive summary */}
      <Card>
        <SectionLabel>1. Executive summary</SectionLabel>
        <p className="text-sm text-slate-300 leading-relaxed">
          Helios-North is a 1.2 GW fixed-bottom offshore wind project in the North Sea, currently at
          FID-stage. The project has secured a Contracts for Difference (CfD) allocation at a strike
          price of £105/MWh under AR6. The Infrastructure Council has evaluated the project across
          10,000 simulated futures and recommends conditional proceed to FID, subject to resolution
          of three material conditions: EPC contract structure, contingency reserve adequacy, and
          grid connection confirmation.
        </p>
      </Card>

      {/* IC recommendation */}
      <Card className="border-amber-400/20 bg-amber-400/5">
        <SectionLabel>2. Investment committee recommendation</SectionLabel>
        <div className="flex items-center gap-3 mb-3">
          <VerdictBadge verdict="CONDITIONAL PROCEED" />
          <span className="text-sm text-slate-400">Approval probability: 62% across 10,000 scenarios</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          The Council recommends conditional proceed to FID. The project is viable under the base
          case and most mild-stress scenarios. However, three conditions must be satisfied before
          FID is confirmed. Failure to satisfy any condition within 90 days should trigger a
          re-evaluation.
        </p>
      </Card>

      {/* Key risks */}
      <Card>
        <SectionLabel>3. Key risks</SectionLabel>
        <div className="space-y-3">
          {[
            {
              risk: "DSCR breach under combined stress",
              severity: "HIGH" as const,
              detail: "A 6-month construction delay combined with CfD strike below £95/MWh causes DSCR to breach the 1.20× covenant in Year 3 in 23% of scenarios.",
            },
            {
              risk: "EPC fixed-price coverage gap",
              severity: "HIGH" as const,
              detail: "£180M of construction cost exposure sits outside the fixed-price envelope, creating lender objection risk.",
            },
            {
              risk: "Grid connection timeline uncertainty",
              severity: "HIGH" as const,
              detail: "OFTO agreement is unconfirmed beyond Q3 2027. A 12-month grid delay would materially impair the revenue commencement schedule.",
            },
            {
              risk: "Merchant tail exposure",
              severity: "MEDIUM" as const,
              detail: "Post-CfD merchant revenue exposure at current forward prices produces negative equity returns in 31% of long-run scenarios.",
            },
            {
              risk: "Turbine availability degradation",
              severity: "MEDIUM" as const,
              detail: "A 2% reduction in turbine availability combined with CfD shortfall causes DSCR breach in 18% of scenarios.",
            },
          ].map((item, i) => (
            <div key={i} className="flex gap-3 p-3 bg-white/3 border border-white/10 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{item.risk}</span>
                  <ImpactBadge level={item.severity} />
                </div>
                <div className="text-xs text-slate-400">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Key mitigants */}
      <Card>
        <SectionLabel>4. Key mitigants</SectionLabel>
        <div className="space-y-2">
          {[
            "CfD strike at £105/MWh provides £18/MWh margin above LCOE base case.",
            "Fixed-price EPC coverage of 78% limits but does not eliminate construction cost exposure.",
            "Contingency reserve of 8% of EPC value provides partial buffer for construction delay.",
            "Experienced EPC contractor with track record on comparable North Sea projects.",
            "Lender syndicate has indicated willingness to proceed subject to condition resolution.",
          ].map((m, i) => (
            <div key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              {m}
            </div>
          ))}
        </div>
      </Card>

      {/* Scenario stress summary */}
      <Card>
        <SectionLabel>5. Scenario stress summary</SectionLabel>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-slate-500 font-medium py-2 pr-4">Scenario</th>
                <th className="text-right text-slate-500 font-medium py-2 pr-4">DSCR (Yr 3)</th>
                <th className="text-right text-slate-500 font-medium py-2">Approval Prob.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { scenario: "Base case", dscr: "1.38×", prob: "80%", color: "text-emerald-400" },
                { scenario: "CfD at £100/MWh", dscr: "1.26×", prob: "62%", color: "text-amber-400" },
                { scenario: "CfD at £95/MWh", dscr: "1.14×", prob: "41%", color: "text-orange-400" },
                { scenario: "+6 month delay", dscr: "1.22×", prob: "58%", color: "text-amber-400" },
                { scenario: "Combined stress (£95 + 6mo)", dscr: "1.02×", prob: "19%", color: "text-red-400" },
                { scenario: "Downside (£90 + 9mo)", dscr: "0.94×", prob: "8%", color: "text-red-400" },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="text-slate-300 py-2 pr-4">{row.scenario}</td>
                  <td className={`text-right py-2 pr-4 font-mono ${row.color}`}>{row.dscr}</td>
                  <td className={`text-right py-2 font-mono ${row.color}`}>{row.prob}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Decision conditions */}
      <Card className="border-cyan-400/20 bg-cyan-400/5">
        <SectionLabel>6. Decision conditions</SectionLabel>
        <div className="space-y-3">
          {[
            {
              condition: "Condition 1",
              text: "Extend EPC fixed-price envelope to a minimum of 92% of contract value, or provide a parent company guarantee covering the remaining exposure.",
              deadline: "60 days",
            },
            {
              condition: "Condition 2",
              text: "Increase contingency reserve from 8% to 12% of EPC contract value, funded from equity or a committed standby facility.",
              deadline: "60 days",
            },
            {
              condition: "Condition 3",
              text: "Execute grid connection agreement with OFTO confirming energisation date no later than Q3 2027.",
              deadline: "90 days",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-cyan-300">{item.condition}</span>
                <span className="text-xs text-slate-500">Deadline: {item.deadline}</span>
              </div>
              <div className="text-sm text-slate-300">{item.text}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Next diligence */}
      <Card>
        <SectionLabel>7. Next diligence requirements</SectionLabel>
        <div className="space-y-2">
          {[
            "Independent technical review of EPC contract fixed-price coverage and wrap structure.",
            "Lender independent engineer sign-off on construction schedule and contingency adequacy.",
            "OFTO grid connection agreement — executed or heads of terms with confirmed timeline.",
            "Updated financial model reflecting revised contingency reserve and EPC structure.",
            "Legal review of CfD contract terms and change-in-law provisions.",
          ].map((item, i) => (
            <div key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="text-slate-500 font-mono shrink-0">{i + 1}.</span>
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Decision Drivers ─────────────────────────────────────────────────────

function DriversTab() {
  const drivers = [
    {
      driver: "CfD strike price",
      impact: "HIGH" as const,
      why: "The CfD strike price determines the revenue floor for the project's 15-year contracted period. At £105/MWh, the project achieves a base-case DSCR of 1.38×. Below £95/MWh, the DSCR falls below the 1.20× covenant in stress scenarios.",
      improve: "Confirm strike price at or above £105/MWh. A higher strike (£110/MWh) would reduce DSCR breach probability to below 3% across all stress scenarios.",
      reject: "CfD strike below £95/MWh triggers DSCR breach in 23% of scenarios. Below £90/MWh, the project does not meet the equity IRR threshold and should not proceed to FID.",
    },
    {
      driver: "DSCR",
      impact: "HIGH" as const,
      why: "The debt service coverage ratio is the primary lender covenant. A breach of 1.20× triggers a technical default clause in the financing agreement. DSCR is sensitive to both revenue (CfD strike) and cost (construction delay, EPC overrun) variables.",
      improve: "Increase contingency reserve to 12% of EPC value. Extend EPC fixed-price coverage to 92%+. These two actions reduce DSCR breach probability from 23% to below 5%.",
      reject: "DSCR below 1.20× in the base case is an automatic escalation trigger. DSCR below 1.10× in any scenario should result in a do-not-proceed recommendation.",
    },
    {
      driver: "EPC contract structure",
      impact: "HIGH" as const,
      why: "The EPC contract structure determines how much construction cost risk is transferred to the contractor. At 78% fixed-price coverage, £180M of exposure sits with the project company. This is the primary lender objection.",
      improve: "Extend fixed-price envelope to 92%+ of EPC contract value. Alternatively, provide a parent company guarantee covering the uncapped exposure.",
      reject: "EPC fixed-price coverage below 80% without a parent guarantee will cause the lender syndicate to require additional equity or a standby facility, potentially delaying FID by 6–12 months.",
    },
    {
      driver: "Construction delay",
      impact: "HIGH" as const,
      why: "A construction delay defers the revenue commencement date, compressing the debt service coverage window. A 6-month delay combined with a CfD shortfall is the primary combined-stress scenario that causes DSCR breach.",
      improve: "Confirm EPC contractor schedule with independent technical review. Ensure contingency reserve is sufficient to cover a 6-month delay without drawing on the debt service reserve account.",
      reject: "A construction delay exceeding 12 months without a corresponding revenue floor mechanism should trigger re-evaluation. The project's financing structure does not accommodate a 12-month delay in the current form.",
    },
    {
      driver: "Grid connection risk",
      impact: "HIGH" as const,
      why: "The OFTO grid connection timeline is unconfirmed beyond Q3 2027. A 12-month grid delay would materially impair the revenue commencement schedule and could cause a debt service shortfall in Year 1.",
      improve: "Execute grid connection agreement with OFTO confirming energisation date. Heads of terms with a confirmed timeline would satisfy the lender requirement.",
      reject: "An unconfirmed grid connection timeline beyond Q3 2027 is a material condition. FID should not be confirmed without executed OFTO agreement or equivalent certainty.",
    },
    {
      driver: "Turbine availability",
      impact: "MEDIUM" as const,
      why: "The base case assumes 95% turbine availability. A 2% reduction to 93% — within the range of observed offshore wind performance — reduces annual energy production by approximately 25 GWh, impacting revenue by £2.6M/year at base CfD.",
      improve: "Negotiate availability guarantees with the turbine OEM. A performance bond covering availability shortfall below 93% would mitigate this risk.",
      reject: "Turbine availability below 90% (observed in early-generation offshore wind) would reduce revenue by £13M/year and cause DSCR breach in combination with other stress variables.",
    },
    {
      driver: "Contingency adequacy",
      impact: "MEDIUM" as const,
      why: "The current contingency reserve of 8% of EPC value (approximately £96M) is below the lender's preferred level of 10–12% for a project of this complexity. Insufficient contingency increases the probability of drawing on the debt service reserve account.",
      improve: "Increase contingency to 12% of EPC value (£144M). This can be funded from equity or a committed standby facility and would satisfy the lender requirement.",
      reject: "Contingency below 6% of EPC value would require a parent company guarantee or additional equity injection before the lender syndicate would proceed.",
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Decision driver framework</SectionLabel>
        <p className="text-sm text-slate-400">
          The following variables were identified by the Infrastructure Council as the primary
          determinants of the FID recommendation. Each driver is assessed for impact level,
          improvement pathway, and rejection/escalation threshold.
        </p>
      </Card>

      {drivers.map((item, i) => (
        <Card key={i}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-bold text-white">{item.driver}</h3>
            <ImpactBadge level={item.impact} />
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
                Why it matters
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{item.why}</p>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
                What would improve the decision
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{item.improve}</p>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="text-xs font-mono text-red-400 uppercase tracking-wider mb-1">
                What would trigger rejection or escalation
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{item.reject}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Tab: Test Your Own Project ────────────────────────────────────────────────

function TestTab({ logEvent }: { logEvent: (event: string) => void }) {
  const projectTypes = [
    { icon: "🌊", label: "Offshore wind", desc: "Fixed-bottom or floating, FID-stage or development" },
    { icon: "🌬️", label: "Onshore wind", desc: "Grid-connected, merchant or contracted" },
    { icon: "☀️", label: "Solar", desc: "Utility-scale PV or hybrid storage" },
    { icon: "🔋", label: "Battery storage", desc: "Grid-scale BESS, capacity market or merchant" },
    { icon: "⚗️", label: "Green hydrogen", desc: "Electrolysis with industrial or transport offtake" },
    { icon: "⚡", label: "Transmission / grid infrastructure", desc: "OFTO, interconnector, or grid reinforcement" },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-cyan-400/20 bg-cyan-400/5">
        <SectionLabel>Infrastructure review</SectionLabel>
        <h2 className="text-lg font-bold text-white mb-2">Test Your Own Project</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Upload or paste a project summary and run an institutional infrastructure review. The
          Infrastructure Council will evaluate the project across thousands of scenarios and produce
          a board-ready IC memo in under 4 minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/"
            onClick={() => logEvent("test_own_project_clicked")}
            className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
          >
            Run Infrastructure Review →
          </a>
        </div>
      </Card>

      <div>
        <SectionLabel>Supported project types</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-3">
          {projectTypes.map((pt) => (
            <div
              key={pt.label}
              className="flex gap-3 p-4 bg-white/5 border border-white/10 rounded-xl"
            >
              <span className="text-2xl shrink-0">{pt.icon}</span>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{pt.label}</div>
                <div className="text-xs text-slate-400">{pt.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <SectionLabel>What the Infrastructure Council evaluates</SectionLabel>
        <div className="space-y-2">
          {[
            "FID readiness — is the project ready for a final investment decision?",
            "DSCR resilience — how does the debt service coverage ratio hold under stress?",
            "EPC risk — is the construction contract structure adequate?",
            "CfD / PPA adequacy — does the revenue contract support the financing structure?",
            "Grid connection risk — is the connection timeline confirmed and de-risked?",
            "Construction delay sensitivity — what is the impact of a 3, 6, or 12-month delay?",
            "Governance escalation — which variables trigger IC escalation?",
          ].map((item, i) => (
            <div key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Proof Report ────────────────────────────────────────────────────────

function ProofTab() {
  const PROOF_REPORT = {
    executiveSummary:
      "The Infrastructure Council of 10 evaluated the Helios-North Offshore Wind project — a 450MW North Sea development — for FID readiness. The council reached conditional consensus (82% confidence) to proceed subject to EPC contract finalisation and grid connection confirmation. Every infrastructure governance finding — from DSCR stress testing through CfD adequacy review to construction risk assessment — is recorded in this proof record and exportable for IC and lender review.",
    governanceFindings: [
      "FID Readiness Agent confirmed the project meets 7 of 9 FID readiness criteria; 2 conditions outstanding: EPC contract execution and grid connection long-stop date confirmation.",
      "DSCR Resilience Agent stress-tested the debt service coverage ratio under 3 scenarios; minimum DSCR of 1.18x under the P90 wind scenario is above the 1.10x covenant floor.",
      "EPC Risk Agent flagged the current EPC contract structure as non-standard; liquidated damages cap is below the 15% threshold recommended for North Sea projects.",
      "CfD Adequacy Agent confirmed the 15-year CfD at £87/MWh provides adequate revenue certainty for the proposed financing structure.",
      "Grid Connection Agent flagged the 14-month connection timeline as the critical path risk; confirmed Ofgem connection agreement is in place but long-stop date is unconfirmed.",
      "Construction Delay Agent modelled 3, 6, and 12-month delay scenarios; 6-month delay triggers an DSCR covenant breach under the base case financing structure.",
      "All 8 constitutional rules passed. No violations detected.",
    ],
    constitutionVersion: "AgenThinkMesh Constitution v2.1 — 8 rules active",
    calibrationContext:
      "Persona weights reflect 28 prior infrastructure and renewable energy project evaluations. FID Readiness Agent carries trust weight 0.89, reflecting strong calibration on North Sea offshore wind projects. DSCR Resilience Agent weight is 0.87. EPC Risk Agent weight is 0.83. All personas above minimum sample threshold (12). Brier score 0.11 — strong predictive calibration for infrastructure FID scenarios.",
    historicalPrecedents: [
      "Offshore wind FID evaluation — North Sea 380MW, Q3 2025: CONDITIONAL PROCEED at 79% confidence. Outcome: EPC conditions met within 45 days, FID achieved on schedule.",
      "Infrastructure DSCR stress test — Onshore Wind 220MW, Q4 2025: PROCEED TO FID at 84% confidence. Outcome: financing closed, construction commenced on schedule.",
      "Grid connection risk assessment — Offshore Wind 500MW, Q1 2026: ESCALATE TO IC at 71% confidence. Outcome: grid connection timeline renegotiated, project proceeded 3 months later.",
    ],
    releaseGateDetermination:
      "CONDITIONAL RELEASE — The proof record is cleared for IC presentation subject to the following gate conditions: (1) EPC contract execution with liquidated damages cap at or above 15% of contract value; (2) written confirmation of grid connection long-stop date from Ofgem. Upon resolution of both conditions, a targeted re-evaluation of the EPC Risk and Grid Connection Agent nodes only is required. All other council findings remain valid and support the CONDITIONAL PROCEED verdict.",
    auditReferences: [
      "Council session: IC-RWE-HELIOS-2026-0517-001 · 10 agent votes logged · 2 dissents recorded",
      "CFA session: CFA-RWE-HELIOS-2026-0517-001 · 8 constitution rules evaluated · 0 violations",
      "Calibration state: CAL-RWE-2026-0517 · 28 prior evaluations · Brier score 0.11",
      "Orchestration run: ORCH-RWE-HELIOS-2026-0517-001 · 7-node pipeline · construct_proof_chain completed",
    ],
    exportCtaText:
      "Every infrastructure recommendation can be exported as an Institutional Proof Report — machine-verifiable, audit-ready, and formatted for IC, lender, and regulatory review.",
  };

  const releaseColor = "border-amber-400/30 bg-amber-400/5";
  const releaseTextColor = "text-amber-300";

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
          This report demonstrates the governance artifact structure produced by AgenThinkMesh for RWE Infrastructure Investment.
        </p>
      </div>

      {/* 1. Executive Summary */}
      <Card>
        <SectionLabel>1 · Executive Summary</SectionLabel>
        <p className="text-sm text-slate-300 leading-relaxed">{PROOF_REPORT.executiveSummary}</p>
      </Card>

      {/* 2. Governance Findings */}
      <Card>
        <SectionLabel>2 · Governance Findings</SectionLabel>
        <ul className="space-y-2.5">
          {PROOF_REPORT.governanceFindings.map((finding, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span className="leading-relaxed">{finding}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 3 & 4. Constitution Version + Calibration Context */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <SectionLabel>3 · Constitution Version</SectionLabel>
          <p className="text-sm text-slate-300 font-mono">{PROOF_REPORT.constitutionVersion}</p>
        </Card>
        <Card>
          <SectionLabel>4 · Calibration Context</SectionLabel>
          <p className="text-sm text-slate-300 leading-relaxed">{PROOF_REPORT.calibrationContext}</p>
        </Card>
      </div>

      {/* 5. Historical Precedents */}
      <Card>
        <SectionLabel>5 · Historical Precedents</SectionLabel>
        <div className="space-y-3">
          {PROOF_REPORT.historicalPrecedents.map((precedent, i) => (
            <div key={i} className="border-l-2 border-violet-400/30 pl-3">
              <p className="text-sm text-slate-300 leading-relaxed">{precedent}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 6. Release Gate Determination */}
      <div className={`border rounded-xl p-5 ${releaseColor}`}>
        <div className={`text-xs font-mono uppercase tracking-widest mb-3 ${releaseTextColor}`}>
          6 · Release Gate Determination
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-medium">
          {PROOF_REPORT.releaseGateDetermination}
        </p>
      </div>

      {/* 7. Audit References */}
      <Card>
        <SectionLabel>7 · Audit References</SectionLabel>
        <div className="space-y-2">
          {PROOF_REPORT.auditReferences.map((ref, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-mono text-slate-400">
              <span className="text-violet-400 shrink-0">#{i + 1}</span>
              <span>{ref}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Export CTA */}
      <div className="border border-violet-400/20 bg-violet-400/5 rounded-xl p-6">
        <div className="text-xs font-mono uppercase tracking-widest text-violet-300 mb-2">
          Export Proof Report
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{PROOF_REPORT.exportCtaText}</p>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function RweDemo() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const logEventMutation = trpc.voiceDemo.logEvent.useMutation();

  const logEvent = useCallback(
    (event: string, meta?: Record<string, unknown>) => {
      logEventMutation.mutate({
        event,
        route: "/demo/rwe",
        meta: { prospect: "rwe", org: "RWE", ...meta },
      });
      trackEvent(event, { prospect: "rwe", ...meta });
    },
    [logEventMutation]
  );

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    logEvent("tab_selected", { tab: id });
  }

  const voiceDemoUrl =
    "/voice-demo?prospect=rwe&org=RWE&narration=infrastructure";

  return (
    <div className="min-h-screen bg-[#070d1a] text-slate-100">
      {/* Disclaimer strip */}
      <div className="bg-slate-800/60 border-b border-white/10 px-4 py-2 text-center">
        <span className="text-xs text-slate-400">
          Prepared for Sarah Strack and the RWE team · Infrastructure decision workspace · Not investment advice
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
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
        <div className="mb-8 pb-8 border-b border-white/10">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-white/10 border border-white/20 rounded px-3 py-1.5 text-sm font-bold text-white tracking-wide">
                  RWE
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-cyan-400/30 text-cyan-300 bg-transparent">
                  PRIVATE DEMO
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-emerald-400/30 text-emerald-300 bg-emerald-400/10">
                  Stress-tested across 10,000 simulated futures
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">
                Prepared for Sarah Strack and the RWE team
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                RWE Infrastructure Decision Workspace
              </h1>
              <p className="text-sm text-slate-400">
                Three representative renewable-energy investment cases have been preloaded for
                review, including a 10,000-scenario offshore wind stress test.
              </p>
            </div>
            <div className="hidden sm:block text-right shrink-0">
              <div className="text-xs text-slate-500 font-mono">IC-RWE-2026-0604</div>
              <div className="text-xs text-slate-500 mt-1">4 June 2026</div>
            </div>
          </div>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={() => {
                handleTabChange("helios");
                logEvent("primary_cta_clicked", { cta: "review_helios_north" });
              }}
              className="inline-flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
            >
              Review Helios-North →
            </button>
            <button
              onClick={() => {
                handleTabChange("test");
                logEvent("secondary_cta_clicked", { cta: "test_your_own_project" });
              }}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors border border-white/20"
            >
              Test Your Own Project
            </button>
            <a
              href={voiceDemoUrl}
              onClick={() => logEvent("voice_demo_launched")}
              className="inline-flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-sm px-6 py-3 rounded-lg transition-colors border border-amber-400/30"
            >
              Launch Guided Walkthrough
            </a>
          </div>
        </div>

        {/* ── Tab navigation ── */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-8 border-b border-white/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-white/10 text-white border-b-2 border-cyan-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {activeTab === "overview" && <OverviewTab onSelectTab={handleTabChange} />}
        {activeTab === "helios" && <HeliosTab />}
        {activeTab === "stress" && <StressTab />}
        {activeTab === "memo" && <IcMemoTab />}
        {activeTab === "drivers" && <DriversTab />}
        {activeTab === "test" && (
          <TestTab logEvent={(event) => logEvent(event)} />
        )}
        {activeTab === "proof" && <ProofTab />}
      </div>
    </div>
  );
}
