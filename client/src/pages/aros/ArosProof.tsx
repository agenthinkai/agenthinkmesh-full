/**
 * ArosProof.tsx — Institutional Proof Dashboard
 *
 * Route: /aros/proof
 * Audience: Customers, Boards, Investors, Partners
 *
 * FINAL RULE: No simulated performance may appear on this page.
 * Every number is derived from real operational data.
 * If no real data exists yet, the metric displays "—" with a
 * "No data yet" badge — never a placeholder value.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, Minus, Users, Target, Brain,
  BookOpen, BarChart2, Award, ArrowRight, CheckCircle2,
  XCircle, AlertCircle, Building2, Globe, Zap, Shield,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function outcomeLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    CUSTOMER_WON: { label: "Customer Won", color: "text-emerald-400 bg-emerald-400/10" },
    PROPOSAL_SENT: { label: "Proposal Sent", color: "text-blue-400 bg-blue-400/10" },
    MEETING_HELD: { label: "Meeting Held", color: "text-amber-400 bg-amber-400/10" },
    RESPONSE_RECEIVED: { label: "Replied", color: "text-cyan-400 bg-cyan-400/10" },
    NO_ENGAGEMENT: { label: "No Engagement", color: "text-slate-400 bg-slate-400/10" },
    CUSTOMER_LOST: { label: "Lost", color: "text-red-400 bg-red-400/10" },
    PENDING: { label: "Pending", color: "text-slate-400 bg-slate-400/10" },
  };
  return map[status] ?? { label: status, color: "text-slate-400 bg-slate-400/10" };
}

function hvTypeLabel(type: string): string {
  const map: Record<string, string> = {
    REGULATORY_DELAY: "Regulatory Delay",
    AI_GOVERNANCE_FAILURE: "AI Governance Failure",
    CAPITAL_ALLOCATION_ERROR: "Capital Allocation Error",
    DATA_SOVEREIGNTY_CONSTRAINT: "Data Sovereignty",
    COMPETITIVE_RESPONSE: "Competitive Response",
    INFRASTRUCTURE_BOTTLENECK: "Infrastructure Bottleneck",
    TALENT_SHORTAGE: "Talent Shortage",
    EXECUTION_RISK: "Execution Risk",
    MARKET_TIMING: "Market Timing",
    OTHER: "Other",
  };
  return map[type] ?? type;
}

// ── Real-data badge ────────────────────────────────────────────────────────────
function NoDataBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">
      <AlertCircle className="w-3 h-3" />
      No data yet
    </span>
  );
}

// ── Metric tile ───────────────────────────────────────────────────────────────
function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = "text-slate-200",
  hasData = true,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ElementType;
  accent?: string;
  hasData?: boolean;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-slate-600" />}
      </div>
      <div className={`text-2xl font-bold font-mono ${accent}`}>
        {hasData ? value : "—"}
      </div>
      {!hasData && <NoDataBadge />}
      {hasData && sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

// ── North Star number ─────────────────────────────────────────────────────────
function NorthStarNumber({
  label,
  value,
  hasData,
}: {
  label: string;
  value: string;
  hasData: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-8 py-6">
      <div className={`text-5xl font-black font-mono tracking-tight ${hasData ? "text-white" : "text-slate-600"}`}>
        {hasData ? value : "—"}
      </div>
      <div className="text-xs text-slate-400 uppercase tracking-widest text-center font-medium">{label}</div>
      {!hasData && <NoDataBadge />}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Accuracy bar ──────────────────────────────────────────────────────────────
function AccuracyBar({ value, label }: { value: number | null; label: string }) {
  const pctVal = value ?? 0;
  const color = pctVal >= 80 ? "bg-emerald-500" : pctVal >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-40 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-300 w-12 text-right">
        {value !== null ? `${pctVal.toFixed(1)}%` : "—"}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ArosProof() {
  const [customerProofLimit] = useState(20);

  const { data: northStar, isLoading: loadingNS } = trpc.arosInstitutionalProof.getNorthStar.useQuery();
  const { data: execImpact, isLoading: loadingEI } = trpc.arosInstitutionalProof.getExecutiveImpact.useQuery();
  const { data: decisionQuality, isLoading: loadingDQ } = trpc.arosInstitutionalProof.getDecisionQuality.useQuery();
  const { data: learning, isLoading: loadingL } = trpc.arosInstitutionalProof.getLearning.useQuery();
  const { data: proofOfLearning, isLoading: loadingPOL } = trpc.arosInstitutionalProof.getProofOfLearning.useQuery();
  const { data: customerProof, isLoading: loadingCP } = trpc.arosInstitutionalProof.getCustomerProof.useQuery({ limit: customerProofLimit });

  const isLoading = loadingNS || loadingEI || loadingDQ || loadingL || loadingPOL || loadingCP;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#080e1a]">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="border-b border-slate-800/60 bg-[#080e1a]/95 sticky top-0 z-10 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-100">Institutional Proof Dashboard</h1>
                <p className="text-xs text-slate-500">Real operational data only · No simulated performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">Live</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">

          {/* ── SECTION 6: NORTH STAR ──────────────────────────────────────── */}
          <section>
            <div className="text-center mb-2">
              <span className="text-xs text-slate-600 uppercase tracking-widest font-medium">North Star</span>
            </div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-100">The Four Numbers That Matter</h2>
              <p className="text-sm text-slate-500 mt-1">Everything else is supporting information.</p>
            </div>

            {loadingNS ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-slate-800 rounded-2xl overflow-hidden">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-36 bg-slate-900/40 animate-pulse border-r border-slate-800 last:border-r-0" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
                <div className="border-r border-slate-800">
                  <NorthStarNumber
                    label="Executive Decisions Improved"
                    value={num(northStar?.decisionsImproved)}
                    hasData={(northStar?.decisionsImproved ?? 0) > 0}
                  />
                </div>
                <div className="border-r border-slate-800">
                  <NorthStarNumber
                    label="Institutional Customers"
                    value={num(northStar?.institutionalCustomers)}
                    hasData={(northStar?.institutionalCustomers ?? 0) > 0}
                  />
                </div>
                <div className="border-r border-slate-800">
                  <NorthStarNumber
                    label="Prediction Accuracy"
                    value={pct(northStar?.predictionAccuracy)}
                    hasData={northStar?.predictionAccuracy !== null && northStar?.predictionAccuracy !== undefined}
                  />
                </div>
                <div>
                  <NorthStarNumber
                    label="Revenue Generated"
                    value={northStar?.revenueGeneratedFormatted ?? "—"}
                    hasData={(northStar?.revenueGenerated ?? 0) > 0}
                  />
                </div>
              </div>
            )}

            {!northStar?.hasRealData && !loadingNS && (
              <div className="mt-4 text-center">
                <p className="text-xs text-slate-600">
                  These numbers will populate as Atlas delivers Executive Intelligence Briefs and records real outcomes.
                </p>
              </div>
            )}
          </section>

          <Separator className="bg-slate-800/60" />

          {/* ── SECTION 1: EXECUTIVE IMPACT ────────────────────────────────── */}
          <section>
            <SectionHeader
              icon={Zap}
              title="Executive Impact"
              subtitle="From first brief to closed revenue — every step measured."
            />
            {loadingEI ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-slate-900/40 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricTile
                  label="Briefs Delivered"
                  value={num(execImpact?.briefsDelivered)}
                  icon={BookOpen}
                  hasData={(execImpact?.briefsDelivered ?? 0) > 0}
                />
                <MetricTile
                  label="Executive Replies"
                  value={num(execImpact?.executiveReplies)}
                  icon={Users}
                  accent="text-cyan-300"
                  hasData={(execImpact?.executiveReplies ?? 0) > 0}
                />
                <MetricTile
                  label="Meetings Booked"
                  value={num(execImpact?.meetingsBooked)}
                  icon={Target}
                  accent="text-amber-300"
                  hasData={(execImpact?.meetingsBooked ?? 0) > 0}
                />
                <MetricTile
                  label="Proposals Sent"
                  value={num(execImpact?.proposalsSent)}
                  icon={ArrowRight}
                  accent="text-blue-300"
                  hasData={(execImpact?.proposalsSent ?? 0) > 0}
                />
                <MetricTile
                  label="Customers Won"
                  value={num(execImpact?.customersWon)}
                  icon={Award}
                  accent="text-emerald-300"
                  hasData={(execImpact?.customersWon ?? 0) > 0}
                />
                <MetricTile
                  label="Pipeline Value"
                  value={execImpact?.pipelineValueFormatted ?? "—"}
                  icon={TrendingUp}
                  accent="text-blue-300"
                  hasData={(execImpact?.pipelineValue ?? 0) > 0}
                />
                <MetricTile
                  label="Revenue Won"
                  value={execImpact?.revenueWonFormatted ?? "—"}
                  icon={TrendingUp}
                  accent="text-emerald-300"
                  hasData={(execImpact?.revenueWon ?? 0) > 0}
                />
                <MetricTile
                  label="Avg Response Rate"
                  value={pct(execImpact?.avgResponseRate)}
                  icon={BarChart2}
                  accent="text-purple-300"
                  hasData={execImpact?.avgResponseRate !== null && execImpact?.avgResponseRate !== undefined}
                />
              </div>
            )}
          </section>

          <Separator className="bg-slate-800/60" />

          {/* ── SECTION 2: DECISION QUALITY ────────────────────────────────── */}
          <section>
            <SectionHeader
              icon={Brain}
              title="Decision Quality"
              subtitle="The accuracy of Atlas's Decision Twins and Hidden Variables — measured against real outcomes."
            />
            {loadingDQ ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-slate-900/40 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <MetricTile
                    label="Decision Twins Generated"
                    value={num(decisionQuality?.decisionTwinsGenerated)}
                    icon={Brain}
                    hasData={(decisionQuality?.decisionTwinsGenerated ?? 0) > 0}
                  />
                  <MetricTile
                    label="Hidden Variables Generated"
                    value={num(decisionQuality?.hiddenVariablesGenerated)}
                    icon={Target}
                    hasData={(decisionQuality?.hiddenVariablesGenerated ?? 0) > 0}
                  />
                  <MetricTile
                    label="Outcome Ledger Entries"
                    value={num(decisionQuality?.outcomeLedgerEntries)}
                    icon={BookOpen}
                    hasData={(decisionQuality?.outcomeLedgerEntries ?? 0) > 0}
                  />
                  <MetricTile
                    label="Calibrated Outcomes"
                    value={num(decisionQuality?.calibratedOutcomes)}
                    icon={CheckCircle2}
                    accent="text-emerald-300"
                    hasData={(decisionQuality?.calibratedOutcomes ?? 0) > 0}
                  />
                </div>

                {/* Accuracy bars */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300">Accuracy Metrics</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Constitution Version</span>
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                          {decisionQuality?.constitutionVersion ?? "—"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Atlas Performance Index</span>
                        <span className="text-sm font-bold font-mono text-emerald-400">
                          {decisionQuality?.atlasPerformanceIndex !== null && decisionQuality?.atlasPerformanceIndex !== undefined
                            ? `${decisionQuality.atlasPerformanceIndex.toFixed(1)}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <AccuracyBar value={decisionQuality?.decisionTwinAccuracy ?? null} label="Decision Twin Accuracy" />
                  <AccuracyBar value={decisionQuality?.hiddenVariableAccuracy ?? null} label="Hidden Variable Accuracy" />
                  {decisionQuality?.latestSnapshot && (
                    <>
                      <AccuracyBar
                        value={decisionQuality.latestSnapshot.dtAccuracyAvg ? parseFloat(String(decisionQuality.latestSnapshot.dtAccuracyAvg)) * 100 : null}
                        label="DT Accuracy (Latest Snapshot)"
                      />
                      <AccuracyBar
                        value={decisionQuality.latestSnapshot.hvAccuracyAvg ? parseFloat(String(decisionQuality.latestSnapshot.hvAccuracyAvg)) * 100 : null}
                        label="HV Accuracy (Latest Snapshot)"
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          <Separator className="bg-slate-800/60" />

          {/* ── SECTION 3: LEARNING ────────────────────────────────────────── */}
          <section>
            <SectionHeader
              icon={TrendingUp}
              title="Learning"
              subtitle="Atlas learns from every outcome. These metrics measure the rate of improvement."
            />
            {loadingL ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-slate-900/40 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricTile
                    label="Learning Events"
                    value={num(learning?.learningEvents)}
                    icon={Brain}
                    hasData={(learning?.learningEvents ?? 0) > 0}
                  />
                  <MetricTile
                    label="Constitution Improvements"
                    value={num(learning?.constitutionImprovements)}
                    icon={BookOpen}
                    accent="text-blue-300"
                    hasData={(learning?.constitutionImprovements ?? 0) > 0}
                  />
                  <MetricTile
                    label="Calibration Improvements"
                    value={num(learning?.calibrationImprovements)}
                    icon={BarChart2}
                    accent="text-amber-300"
                    hasData={(learning?.calibrationImprovements ?? 0) > 0}
                  />
                  <MetricTile
                    label="Executive Relationship Growth"
                    value={num(learning?.executiveRelationshipGrowth)}
                    icon={Users}
                    accent="text-emerald-300"
                    hasData={(learning?.executiveRelationshipGrowth ?? 0) > 0}
                  />
                </div>

                {/* Prediction accuracy trend */}
                {learning?.predictionAccuracyTrend && learning.predictionAccuracyTrend.length > 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
                    <div className="text-sm font-medium text-slate-300 mb-4">Prediction Accuracy Trend</div>
                    <div className="flex items-end gap-2 h-20">
                      {learning.predictionAccuracyTrend.map((snap, i) => {
                        const dtVal = snap.dtAccuracy ? parseFloat(String(snap.dtAccuracy)) * 100 : 0;
                        const height = Math.max(4, Math.round(dtVal * 0.8));
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t bg-blue-500/60 hover:bg-blue-500/80 transition-colors"
                              style={{ height: `${height}px` }}
                              title={`${snap.snapshotDate}: ${dtVal.toFixed(1)}%`}
                            />
                            <span className="text-[9px] text-slate-600 truncate w-full text-center">
                              {snap.snapshotDate?.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Prediction accuracy trend will appear after the first calibration snapshots are recorded.</span>
                  </div>
                )}

                {/* Top industries + top hidden variables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                    <div className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-500" />
                      Top Industries
                    </div>
                    {learning?.topIndustries && learning.topIndustries.length > 0 ? (
                      <div className="space-y-2">
                        {learning.topIndustries.map((ind, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">{ind.sector}</span>
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{ind.count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <NoDataBadge />
                    )}
                  </div>

                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                    <div className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-slate-500" />
                      Top Hidden Variables (Validated Correct)
                    </div>
                    {learning?.topHiddenVariables && learning.topHiddenVariables.length > 0 ? (
                      <div className="space-y-2">
                        {learning.topHiddenVariables.map((hv, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">{hvTypeLabel(hv.type)}</span>
                            <Badge variant="outline" className="text-xs border-emerald-700/40 text-emerald-400">{hv.count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <NoDataBadge />
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <Separator className="bg-slate-800/60" />

          {/* ── SECTION 4: PROOF OF LEARNING ───────────────────────────────── */}
          <section>
            <SectionHeader
              icon={BarChart2}
              title="Proof of Learning"
              subtitle="Evidence that Atlas improves over time. Prediction V1 → Outcome → Calibration → Prediction V2 → Improved Result."
            />
            {loadingPOL ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-slate-900/40 rounded-xl animate-pulse" />)}
              </div>
            ) : proofOfLearning?.hasRealData ? (
              <div className="space-y-4">
                {proofOfLearning.proofChains.map((chain, i) => {
                  if (!chain) return null;
                  return (
                    <div key={i} className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-200">{chain.companyName}</span>
                          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{chain.sector}</Badge>
                        </div>
                        {chain.improved ? (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm font-mono font-bold">+{chain.improvementPct.toFixed(1)}% accuracy improvement</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-400">
                            <TrendingDown className="w-4 h-4" />
                            <span className="text-sm font-mono">{chain.improvementPct.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>

                      {/* Learning chain visualization */}
                      <div className="grid grid-cols-5 gap-2 items-center">
                        {/* V1 Prediction */}
                        <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Prediction V1</div>
                          <div className="text-xs text-slate-300 font-mono">{chain.v1.dtAccuracy.toFixed(1)}% accuracy</div>
                          {chain.v1.hiddenVariable && (
                            <div className="text-[10px] text-slate-500 mt-1 truncate" title={chain.v1.hiddenVariable}>
                              {chain.v1.hiddenVariable.slice(0, 30)}…
                            </div>
                          )}
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-600 mx-auto" />

                        {/* Outcome */}
                        <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Outcome</div>
                          <div className={`text-xs font-medium px-2 py-0.5 rounded inline-block ${outcomeLabel(chain.v1.outcomeStatus).color}`}>
                            {outcomeLabel(chain.v1.outcomeStatus).label}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Actual: {fmt(chain.v1.revenueActual)}
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-600 mx-auto" />

                        {/* V2 Prediction */}
                        <div className={`rounded-lg p-3 text-center border ${chain.improved ? "bg-emerald-900/20 border-emerald-800/40" : "bg-slate-800/60 border-slate-700"}`}>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Prediction V2</div>
                          <div className={`text-xs font-mono font-bold ${chain.improved ? "text-emerald-400" : "text-slate-300"}`}>
                            {chain.v2.dtAccuracy.toFixed(1)}% accuracy
                          </div>
                          {chain.v2.hiddenVariable && (
                            <div className="text-[10px] text-slate-500 mt-1 truncate" title={chain.v2.hiddenVariable}>
                              {chain.v2.hiddenVariable.slice(0, 30)}…
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center">
                <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Proof of Learning chains will appear once Atlas has delivered briefs and recorded calibrated outcomes for the same company across multiple cycles.
                </p>
              </div>
            )}
          </section>

          <Separator className="bg-slate-800/60" />

          {/* ── SECTION 5: CUSTOMER PROOF ──────────────────────────────────── */}
          <section>
            <SectionHeader
              icon={Building2}
              title="Customer Proof Library"
              subtitle="Every completed engagement. Every outcome. Every case becomes institutional evidence."
            />
            {loadingCP ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-900/40 rounded-xl animate-pulse" />)}
              </div>
            ) : customerProof?.hasRealData ? (
              <div className="space-y-3">
                {customerProof.engagements.map((eng) => {
                  const outcome = outcomeLabel(eng.outcomeStatus);
                  return (
                    <div key={eng.id} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-medium text-slate-200">{eng.companyName}</span>
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{eng.sector}</Badge>
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{eng.country}</Badge>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${outcome.color}`}>{outcome.label}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {eng.hiddenVariable && (
                              <div>
                                <span className="text-xs text-slate-600 block mb-0.5">Hidden Variable</span>
                                <span className="text-slate-300">{eng.hiddenVariable}</span>
                              </div>
                            )}
                            {eng.decisionTwin && (
                              <div>
                                <span className="text-xs text-slate-600 block mb-0.5">Decision Twin</span>
                                <span className="text-slate-300 line-clamp-2">{eng.decisionTwin}</span>
                              </div>
                            )}
                            {eng.businessImpact && (
                              <div>
                                <span className="text-xs text-slate-600 block mb-0.5">Business Impact</span>
                                <span className="text-slate-300 line-clamp-2">{eng.businessImpact}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right space-y-1">
                          {eng.revenueActual > 0 && (
                            <div>
                              <div className="text-xs text-slate-600">Revenue</div>
                              <div className="text-sm font-mono font-bold text-emerald-400">{eng.revenueActualFormatted}</div>
                            </div>
                          )}
                          {eng.dtAccuracy !== null && (
                            <div>
                              <div className="text-xs text-slate-600">DT Accuracy</div>
                              <div className="text-sm font-mono text-slate-300">{eng.dtAccuracy.toFixed(1)}%</div>
                            </div>
                          )}
                          {eng.hvAccuracy !== null && (
                            <div>
                              <div className="text-xs text-slate-600">HV Accuracy</div>
                              <div className="text-sm font-mono text-slate-300">{eng.hvAccuracy.toFixed(1)}%</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center">
                <Building2 className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  The Customer Proof Library will populate as Atlas delivers Executive Intelligence Briefs and executives respond, meet, and engage.
                </p>
              </div>
            )}
          </section>

          {/* ── FINAL RULE ─────────────────────────────────────────────────── */}
          <div className="border border-slate-800 rounded-xl p-6 bg-slate-900/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">Final Rule</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  No feature may be considered complete until it improves one or more numbers shown on this dashboard.
                  This dashboard is the scoreboard for AgenThink Mesh.
                  The engineering team builds. Atlas learns. The Proof Dashboard demonstrates that the learning creates measurable value.
                  Only real-world evidence is allowed. No simulated performance may appear on this page.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
