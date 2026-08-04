import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Streamdown } from "streamdown";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "portfolio" | "warba" | "evidence" | "stress" | "architecture" | "audit";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | string | null | undefined, decimals = 0): string {
  const v = Number(n ?? 0);
  return isNaN(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtKwd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (isNaN(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `KWD ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `KWD ${(v / 1_000).toFixed(0)}K`;
  return `KWD ${v.toFixed(0)}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    pending: "bg-amber-900/60 text-amber-300 border-amber-700",
    assumption: "bg-blue-900/60 text-blue-300 border-blue-700",
    outstanding: "bg-red-900/60 text-red-300 border-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${map[status] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
      {status}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HydroTwin() {
  const { user, loading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: getLoginUrl("/twin/hydro"),
  });

  const [activeTab, setActiveTab] = useState<Tab>("portfolio");
  const [reportContent, setReportContent] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<number | null>(null);
  const [evidenceEdit, setEvidenceEdit] = useState<{ currentInput: string; status: string; reason: string }>({ currentInput: "", status: "pending", reason: "" });

  // Stress sliders
  type StressCase = "base" | "revenue_25" | "margin_5pp" | "automation_50" | "cayman_delayed" | "combined" | "custom";
  const [stressParams, setStressParams] = useState<{
    caymanAmountKwd: number;
    caymanDelayMonths: number;
    revenueGrowthDelta: number;
    grossMarginDelta: number;
    automationSavingsPct: number;
    financeRatePct: number;
    gracePeriodMonths: number;
    acqTimingDeltaMonths: number;
    acqPriceDeltaPct: number;
    customerConcentrationShock: boolean;
    receivablesDelayDays: number;
    gccDisruption: boolean;
    stressCase: StressCase;
  }>({
    caymanAmountKwd: 3000,
    caymanDelayMonths: 0,
    revenueGrowthDelta: 0,
    grossMarginDelta: 0,
    automationSavingsPct: 0,
    financeRatePct: 7.5,
    gracePeriodMonths: 12,
    acqTimingDeltaMonths: 0,
    acqPriceDeltaPct: 0,
    customerConcentrationShock: false,
    receivablesDelayDays: 0,
    gccDisruption: false,
    stressCase: "base" as StressCase,
  });
  const [stressResult, setStressResult] = useState<null | {
    stressedRevenue: number[];
    stressedEbitda: number[];
    stressedDebt: number[];
    stressedDscr: number[];
    verdict: string;
    minDscr: number;
    covenantBreached: boolean;
    safetyBreached: boolean;
  }>(null);

  // tRPC queries
  const scenariosQ = trpc.hydro.getScenarios.useQuery();
  const evidenceQ = trpc.hydro.getEvidence.useQuery();
  const slotsQ = trpc.hydro.getCompanySlots.useQuery();
  const auditQ = trpc.hydro.getAuditLog.useQuery({ limit: 50 });

  // tRPC mutations
  const setActiveScenario = trpc.hydro.setActiveScenario.useMutation({
    onSuccess: () => scenariosQ.refetch(),
  });
  const updateEvidence = trpc.hydro.updateEvidence.useMutation({
    onSuccess: () => { evidenceQ.refetch(); setEditingEvidence(null); },
  });
  const runStress = trpc.hydro.runStressTest.useMutation({
    onSuccess: (data) => setStressResult(data),
  });
  const updateSlot = trpc.hydro.updateCompanySlot.useMutation({
    onSuccess: () => slotsQ.refetch(),
  });
  const generateReport = trpc.hydro.generateCreditBriefing.useMutation({
    onSuccess: (data) => setReportContent(data.content),
  });

  const activeScenario = useMemo(
    () => scenariosQ.data?.find(s => s.isActive === 1) ?? scenariosQ.data?.[0],
    [scenariosQ.data]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm animate-pulse">Authenticating…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Authentication required</p>
          <a href={getLoginUrl("/twin/hydro")} className="text-blue-400 underline">Sign in to access Hydro Decision Twin</a>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "portfolio", label: "Portfolio Case" },
    { id: "warba", label: "Warba Monitoring" },
    { id: "evidence", label: "Evidence Register" },
    { id: "stress", label: "Stress Testing" },
    { id: "architecture", label: "Portfolio Architecture" },
    { id: "audit", label: "Audit Log" },
  ];

  // ── Five-year projections from active scenario ─────────────────────────────
  const years = ["Y1", "Y2", "Y3", "Y4", "Y5"];
  const revenue = activeScenario
    ? [
        Number(activeScenario.revenueY1),
        Number(activeScenario.revenueY2),
        Number(activeScenario.revenueY3),
        Number(activeScenario.revenueY4),
        Number(activeScenario.revenueY5),
      ]
    : [300, 720, 1450, 2300, 3500];
  const ebitda = activeScenario
    ? [
        Number(activeScenario.ebitdaY1),
        Number(activeScenario.ebitdaY2),
        Number(activeScenario.ebitdaY3),
        Number(activeScenario.ebitdaY4),
        Number(activeScenario.ebitdaY5),
      ]
    : [-30, 96, 368, 814, 1474];
  const dscr = activeScenario
    ? [
        Number(activeScenario.dscrY1),
        Number(activeScenario.dscrY2),
        Number(activeScenario.dscrY3),
        Number(activeScenario.dscrY4),
        Number(activeScenario.dscrY5),
      ]
    : [0, 0.8, 1.4, 2.1, 2.9];

  const maxRevenue = Math.max(...revenue);
  const maxEbitda = Math.max(...ebitda.filter(v => v > 0), 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">H</div>
              <div>
                <h1 className="text-white font-semibold text-base tracking-tight">Hydro SME Acquisition Decision Twin</h1>
                <p className="text-zinc-500 text-xs">Warba Bank Financing · KWD 3M · Confidential</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-blue-900/60 text-blue-300 border-blue-700 border text-xs">
              {activeScenario?.scenarioName ?? "Base Case"}
            </Badge>
            <Badge className="bg-amber-900/60 text-amber-300 border-amber-700 border text-xs">
              ADVISORY ONLY
            </Badge>
            <span className="text-zinc-500 text-xs">{user.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-950/30 border-b border-amber-900/40 px-6 py-2">
        <p className="text-amber-400 text-xs">
          ⚠ This Decision Twin provides analytical support only. All figures are projections based on stated assumptions. No investment, lending, or legal advice is given. All decisions require human approval by authorised officers.
        </p>
      </div>

      <div className="p-6">

        {/* ── PORTFOLIO CASE ─────────────────────────────────────────────────── */}
        {activeTab === "portfolio" && (
          <div className="space-y-6">
            {/* Scenario selector */}
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-sm">Active Scenario:</span>
              <div className="flex gap-2">
                {scenariosQ.data?.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveScenario.mutate({ scenarioId: s.id })}
                    className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                      s.isActive === 1
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {s.scenarioName}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Acquisition Price", value: fmtKwd(activeScenario?.acquisitionPriceKwd), sub: "Total enterprise value" },
                { label: "Warba Financing", value: fmtKwd(activeScenario?.warbaFinancingKwd), sub: `${fmt(Number(activeScenario?.warbaFinancingKwd ?? 0) / Number(activeScenario?.acquisitionPriceKwd ?? 1) * 100, 0)}% LTV` },
                { label: "Y5 Revenue", value: fmtKwd(revenue[4] * 1000), sub: `${fmt((revenue[4] - revenue[0]) / revenue[0] * 100, 0)}% CAGR` },
                { label: "NPV (Base)", value: fmtKwd(Number(activeScenario?.npvKwd ?? 0)), sub: `IRR — (see scenario)` },
              ].map(kpi => (
                <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="text-zinc-500 text-xs mb-1">{kpi.label}</div>
                  <div className="text-white text-lg font-semibold">{kpi.value}</div>
                  <div className="text-zinc-500 text-xs mt-1">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* 5-Year Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Revenue */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-xs mb-3 font-medium">Revenue Forecast (KWD '000)</div>
                <div className="flex items-end gap-2 h-32">
                  {revenue.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-zinc-500 text-xs">{fmt(v)}</div>
                      <div
                        className="w-full bg-blue-600 rounded-t"
                        style={{ height: `${Math.max(4, (v / maxRevenue) * 100)}px` }}
                      />
                      <div className="text-zinc-600 text-xs">{years[i]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* EBITDA */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-xs mb-3 font-medium">EBITDA Forecast (KWD '000)</div>
                <div className="flex items-end gap-2 h-32">
                  {ebitda.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-zinc-500 text-xs">{fmt(v)}</div>
                      <div
                        className={`w-full rounded-t ${v >= 0 ? "bg-emerald-600" : "bg-red-700"}`}
                        style={{ height: `${Math.max(4, (Math.abs(v) / maxEbitda) * 100)}px` }}
                      />
                      <div className="text-zinc-600 text-xs">{years[i]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DSCR */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-zinc-400 text-xs mb-3 font-medium">DSCR (Debt Service Coverage)</div>
                <div className="flex items-end gap-2 h-32">
                  {dscr.map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-zinc-500 text-xs">{fmt(v, 1)}x</div>
                      <div
                        className={`w-full rounded-t ${v >= 1.25 ? "bg-emerald-600" : v >= 1.0 ? "bg-amber-600" : "bg-red-700"}`}
                        style={{ height: `${Math.max(4, (v / 3) * 100)}px` }}
                      />
                      <div className="text-zinc-600 text-xs">{years[i]}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-zinc-600 text-xs">Covenant floor: 1.25x</div>
              </div>
            </div>

            {/* Acquisition Schedule */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-xs mb-3 font-medium">Acquisition Schedule</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {[
                  { label: "Target Close", value: "Q3 2026" },
                  { label: "Cayman Amount", value: fmtKwd(Number(activeScenario?.caymanAmountKwd ?? 0)) },
                  { label: "Warba Drawdown", value: `${activeScenario?.caymanTimingMonths ?? 18}-month facility` },
                  { label: "Cayman Timing", value: `${activeScenario?.caymanTimingMonths ?? 18} months` },
                ].map(item => (
                  <div key={item.label}>
                    <div className="text-zinc-500 text-xs">{item.label}</div>
                    <div className="text-white mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Twin Verdict */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-xs mb-3 font-medium">Twin Verdict</div>
              <div className="flex items-start gap-4">
                <div className={`px-3 py-1.5 rounded text-sm font-semibold ${
                  activeScenario?.twinVerdict === "PROCEED_TO_DUE_DILIGENCE"
                    ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                    : activeScenario?.twinVerdict === "APPROVE_PHASE_1_ONLY"
                    ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                    : "bg-red-900/60 text-red-300 border border-red-700"
                }`}>
                  {activeScenario?.twinVerdict ?? "PENDING"}
                </div>
                <div className="text-zinc-300 text-sm flex-1">
                  {activeScenario?.twinVerdict === "PROCEED_TO_DUE_DILIGENCE" ? "Management Case: proceed to Phase 1 due diligence. DSCR covenant met from Y3. All figures are management assumptions pending Warba Bank's independent credit and Sharia approvals." :
                   activeScenario?.twinVerdict === "APPROVE_PHASE_1_ONLY" ? "Conservative Case: approve Phase 1 drawdown only. DSCR below 1.25x covenant in Y2–Y3 — Phase 2 drawdown conditional on covenant compliance." :
                   activeScenario?.twinVerdict === "REQUIRE_ADDITIONAL_EQUITY" ? "Zero Cayman Case: facility not serviceable without Cayman proceeds. Additional equity injection required before any drawdown." :
                   "Awaiting scenario selection."}
                </div>
              </div>
            </div>

            {/* Report Generation */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-xs mb-3 font-medium">Credit Committee Briefing</div>
              <div className="flex gap-3 mb-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setReportLoading(true);
                    generateReport.mutate({
                      scenarioKey: activeScenario?.scenarioKey ?? "base",
                      includeStressResults: !!stressResult,
                      stressVerdict: stressResult?.verdict,
                    }, { onSettled: () => setReportLoading(false) });
                  }}
                  disabled={reportLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  {reportLoading ? "Generating…" : "Generate Credit Briefing"}
                </Button>
                {reportContent && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const blob = new Blob([reportContent], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `hydro-credit-briefing-${activeScenario?.scenarioKey ?? "base"}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs"
                  >
                    Download .md
                  </Button>
                )}
              </div>
              {reportContent && (
                <div className="bg-zinc-950 border border-zinc-800 rounded p-4 max-h-96 overflow-y-auto text-sm">
                  <Streamdown>{reportContent}</Streamdown>
                </div>
              )}
              {reportContent && (
                <p className="text-zinc-600 text-xs mt-2">
                  This report is AI-generated for advisory purposes only. It does not constitute a credit decision, investment advice, or legal opinion. All lending decisions require authorisation by qualified officers.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── WARBA MONITORING ───────────────────────────────────────────────── */}
        {activeTab === "warba" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Facility Amount", value: fmtKwd(Number(activeScenario?.facilityApprovedKwd ?? 3000)), status: "ok" },
                { label: "Drawn Balance", value: fmtKwd(Number(activeScenario?.facilityDrawnKwd ?? 1000)), status: "ok" },
                { label: "Current DSCR", value: `${fmt(dscr[0], 2)}x`, status: dscr[0] >= 1.25 ? "ok" : dscr[0] >= 1.0 ? "warn" : "breach" },
                { label: "Covenant Status", value: dscr[0] >= 1.25 ? "COMPLIANT" : "WATCH", status: dscr[0] >= 1.25 ? "ok" : "warn" },
              ].map(kpi => (
                <div key={kpi.label} className={`bg-zinc-900 border rounded-lg p-4 ${
                  kpi.status === "breach" ? "border-red-800" : kpi.status === "warn" ? "border-amber-800" : "border-zinc-800"
                }`}>
                  <div className="text-zinc-500 text-xs mb-1">{kpi.label}</div>
                  <div className={`text-lg font-semibold ${
                    kpi.status === "breach" ? "text-red-400" : kpi.status === "warn" ? "text-amber-400" : "text-white"
                  }`}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Covenant Dashboard */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-xs mb-4 font-medium">Covenant Dashboard</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                    <th className="text-left pb-2">Covenant</th>
                    <th className="text-right pb-2">Floor / Cap</th>
                    <th className="text-right pb-2">Current</th>
                    <th className="text-right pb-2">Y3 Projected</th>
                    <th className="text-right pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {[
                    { name: "DSCR", floor: "≥ 1.25x", current: `${fmt(dscr[0], 2)}x`, projected: `${fmt(dscr[2], 2)}x`, ok: dscr[0] >= 1.25 },
                    { name: "Leverage Ratio", floor: "≤ 4.0x", current: "—", projected: "2.1x", ok: true },
                    { name: "Minimum EBITDA", floor: "KWD 50K (Y2)", current: "Pre-revenue", projected: fmtKwd(ebitda[2] * 1000), ok: ebitda[2] > 50 },
                    { name: "Customer Concentration", floor: "≤ 40%", current: "—", projected: "28%", ok: true },
                    { name: "Cayman Tranche Utilisation", floor: "≤ 100%", current: "0%", projected: "100%", ok: true },
                  ].map(row => (
                    <tr key={row.name} className="text-zinc-300">
                      <td className="py-2">{row.name}</td>
                      <td className="text-right text-zinc-500">{row.floor}</td>
                      <td className="text-right">{row.current}</td>
                      <td className="text-right">{row.projected}</td>
                      <td className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${row.ok ? "bg-emerald-900/60 text-emerald-400" : "bg-red-900/60 text-red-400"}`}>
                          {row.ok ? "OK" : "BREACH"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Drawdown Gates */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-xs mb-4 font-medium">Drawdown Gates</div>
              <div className="space-y-3">
                {[
                  { gate: "Phase 1 Drawdown (KWD 1.0M)", condition: "Signed SPA + board resolution + Sharia approval", status: "pending" },
                  { gate: "Phase 2 Drawdown (KWD 1.0M)", condition: "DSCR ≥ 1.25x at 12-month review + audited accounts", status: "pending" },
                  { gate: "Phase 3 Drawdown (KWD 1.0M)", condition: "DSCR ≥ 1.25x + Cayman proceeds received + 2 acquisitions complete", status: "pending" },
                ].map(g => (
                  <div key={g.gate} className="flex items-center justify-between border border-zinc-800 rounded p-3">
                    <div>
                      <div className="text-white text-sm">{g.gate}</div>
                      <div className="text-zinc-500 text-xs mt-0.5">{g.condition}</div>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Early Warning Alerts */}
            <div className="bg-zinc-900 border border-amber-900/40 rounded-lg p-4">
              <div className="text-amber-400 text-xs mb-3 font-medium">Early Warning Alerts</div>
              <div className="space-y-2 text-sm text-zinc-400">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <span>Y1 DSCR below covenant floor (0.0x vs 1.25x floor) — grace period applies for first 12 months per facility terms.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <span>Cayman tranche timing not yet confirmed — delay of &gt;3 months would trigger Y2 revenue shortfall.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-zinc-500 mt-0.5">ℹ</span>
                  <span>All alerts are model-generated projections. Actual covenant testing requires audited financials.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EVIDENCE REGISTER ──────────────────────────────────────────────── */}
        {activeTab === "evidence" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-zinc-400 text-sm">Evidence & Assumptions Register</div>
              <div className="flex gap-2 text-xs">
                {["verified", "pending", "assumption", "outstanding"].map(s => {
                  const count = evidenceQ.data?.filter(e => e.status === s).length ?? 0;
                  return <span key={s} className="text-zinc-500">{s}: <span className="text-zinc-300">{count}</span></span>;
                })}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs border-b border-zinc-800 bg-zinc-900/80">
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Current Input</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Source</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {evidenceQ.data?.map(ev => (
                    <tr key={ev.id} className="text-zinc-300 hover:bg-zinc-800/50">
                      {editingEvidence === ev.id ? (
                        <td colSpan={6} className="p-3">
                          <div className="space-y-3">
                            <div className="text-zinc-400 text-xs font-medium">{ev.label}</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-zinc-500 text-xs">Current Input</label>
                                <Input
                                  value={evidenceEdit.currentInput}
                                  onChange={e => setEvidenceEdit(p => ({ ...p, currentInput: e.target.value }))}
                                  className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-200 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-zinc-500 text-xs">Status</label>
                                <Select value={evidenceEdit.status} onValueChange={v => setEvidenceEdit(p => ({ ...p, status: v }))}>
                                  <SelectTrigger className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-200 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="verified">verified</SelectItem>
                                    <SelectItem value="pending">pending</SelectItem>
                                    <SelectItem value="assumption">assumption</SelectItem>
                                    <SelectItem value="outstanding">outstanding</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <label className="text-zinc-500 text-xs">Reason for change (audit trail)</label>
                              <Input
                                value={evidenceEdit.reason}
                                onChange={e => setEvidenceEdit(p => ({ ...p, reason: e.target.value }))}
                                placeholder="e.g. Updated from management accounts received 2026-07-15"
                                className="mt-1 bg-zinc-800 border-zinc-700 text-zinc-200 text-xs"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateEvidence.mutate({ id: ev.id, currentInput: evidenceEdit.currentInput, status: evidenceEdit.status as "verified" | "pending" | "assumption" | "outstanding", reason: evidenceEdit.reason })}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingEvidence(null)} className="text-xs">Cancel</Button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="p-3">
                            <div className="font-medium text-xs">{ev.label}</div>
                            {ev.statusNote && <div className="text-zinc-500 text-xs mt-0.5">{ev.statusNote}</div>}
                          </td>
                          <td className="p-3 text-zinc-500 text-xs">{ev.category}</td>
                          <td className="p-3 text-xs">{ev.currentInput ?? <span className="text-zinc-600 italic">not set</span>}</td>
                          <td className="p-3"><StatusBadge status={ev.status ?? "pending"} /></td>
                          <td className="p-3 text-zinc-500 text-xs">{ev.statusNote ?? "—"}</td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                setEditingEvidence(ev.id);
                                setEvidenceEdit({ currentInput: ev.currentInput ?? "", status: ev.status ?? "pending", reason: "" });
                              }}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── STRESS TESTING ─────────────────────────────────────────────────── */}
        {activeTab === "stress" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sliders */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
                <div className="text-zinc-400 text-xs font-medium mb-2">Stress Parameters</div>

                {/* Preset cases */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { key: "base", label: "Base Case" },
                    { key: "revenue_25", label: "Revenue −25%" },
                    { key: "margin_5pp", label: "Margin −5pp" },
                    { key: "automation_50", label: "Automation −50%" },
                    { key: "cayman_delayed", label: "Cayman Delayed" },
                    { key: "combined", label: "Combined Stress" },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => {
                        const presets: Record<string, Partial<typeof stressParams>> = {
                          base: { revenueGrowthDelta: 0, grossMarginDelta: 0, automationSavingsPct: 0, caymanDelayMonths: 0, stressCase: "base" as StressCase },
                          revenue_25: { revenueGrowthDelta: -25, stressCase: "revenue_25" as StressCase },
                          margin_5pp: { grossMarginDelta: -5, stressCase: "margin_5pp" as StressCase },
                          automation_50: { automationSavingsPct: -50, stressCase: "automation_50" as StressCase },
                          cayman_delayed: { caymanDelayMonths: 6, stressCase: "cayman_delayed" as StressCase },
                          combined: { revenueGrowthDelta: -15, grossMarginDelta: -3, caymanDelayMonths: 3, automationSavingsPct: -25, stressCase: "combined" as StressCase },
                        };
                        setStressParams(prev => ({ ...prev, ...presets[p.key] }));
                      }}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        stressParams.stressCase === p.key
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {[
                  { key: "revenueGrowthDelta", label: "Revenue Growth Delta", min: -50, max: 50, unit: "pp", value: stressParams.revenueGrowthDelta },
                  { key: "grossMarginDelta", label: "Gross Margin Delta", min: -20, max: 20, unit: "pp", value: stressParams.grossMarginDelta },
                  { key: "automationSavingsPct", label: "Automation Savings Delta", min: -100, max: 100, unit: "%", value: stressParams.automationSavingsPct },
                  { key: "financeRatePct", label: "Finance Rate", min: 4, max: 15, unit: "%", value: stressParams.financeRatePct },
                  { key: "gracePeriodMonths", label: "Grace Period", min: 0, max: 24, unit: "mo", value: stressParams.gracePeriodMonths },
                  { key: "caymanDelayMonths", label: "Cayman Delay", min: 0, max: 12, unit: "mo", value: stressParams.caymanDelayMonths },
                  { key: "acqPriceDeltaPct", label: "Acquisition Price Delta", min: -30, max: 30, unit: "%", value: stressParams.acqPriceDeltaPct },
                  { key: "acqTimingDeltaMonths", label: "Acquisition Timing Delta", min: -6, max: 12, unit: "mo", value: stressParams.acqTimingDeltaMonths },
                  { key: "receivablesDelayDays", label: "Receivables Delay", min: 0, max: 180, unit: "d", value: stressParams.receivablesDelayDays },
                ].map(param => (
                  <div key={param.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">{param.label}</span>
                      <span className={`font-mono ${(param.value as number) < 0 ? "text-red-400" : "text-zinc-300"}`}>
                        {(param.value as number) > 0 ? "+" : ""}{param.value}{param.unit}
                      </span>
                    </div>
                    <Slider
                      min={param.min}
                      max={param.max}
                      step={param.unit === "mo" || param.unit === "d" ? 1 : 0.5}
                      value={[param.value as number]}
                      onValueChange={([v]) => setStressParams(prev => ({ ...prev, [param.key]: v, stressCase: "custom" as StressCase }))}
                      className="w-full"
                    />
                  </div>
                ))}

                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stressParams.customerConcentrationShock}
                      onChange={e => setStressParams(prev => ({ ...prev, customerConcentrationShock: e.target.checked, stressCase: "custom" as StressCase }))}
                      className="rounded"
                    />
                    Customer Concentration Shock
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stressParams.gccDisruption}
                      onChange={e => setStressParams(prev => ({ ...prev, gccDisruption: e.target.checked, stressCase: "custom" as StressCase }))}
                      className="rounded"
                    />
                    GCC Market Disruption
                  </label>
                </div>

                <Button
                  onClick={() => runStress.mutate({ ...stressParams, sessionId: `stress-${Date.now()}`, caymanAmountKwd: stressParams.caymanAmountKwd })}
                  disabled={runStress.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs mt-2"
                >
                  {runStress.isPending ? "Running…" : "Run Stress Test"}
                </Button>
              </div>

              {/* Results */}
              <div className="space-y-4">
                {stressResult ? (
                  <>
                    <div className={`bg-zinc-900 border rounded-lg p-4 ${
                      stressResult.verdict.includes("PASS") ? "border-emerald-800" : "border-red-800"
                    }`}>
                      <div className="text-zinc-400 text-xs mb-2 font-medium">Stress Verdict</div>
                      <div className={`text-lg font-semibold ${stressResult.verdict.includes("PASS") ? "text-emerald-400" : "text-red-400"}`}>
                        {stressResult.verdict}
                      </div>
                      {stressResult.covenantBreached && (
                        <ul className="mt-3 space-y-1">
                          <li className="text-amber-400 text-xs flex items-start gap-1">
                            <span>⚠</span><span>DSCR covenant breach — min DSCR {stressResult.minDscr}x is below 1.25x threshold</span>
                          </li>
                          {stressResult.safetyBreached && (
                            <li className="text-red-400 text-xs flex items-start gap-1">
                              <span>⚠</span><span>Safety floor breach — DSCR below 1.0x, drawdown blocked</span>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                      <div className="text-zinc-400 text-xs mb-3 font-medium">Stressed Projections</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-zinc-500">Year</div>
                        <div className="text-zinc-500 text-right">Revenue (KWD K)</div>
                        <div className="text-zinc-500 text-right">DSCR</div>
                        {years.map((y, i) => (
                          <>
                            <div key={`y-${i}`} className="text-zinc-400">{y}</div>
                            <div key={`r-${i}`} className="text-right text-zinc-300">{fmt(stressResult.stressedRevenue[i])}</div>
                            <div key={`d-${i}`} className={`text-right ${stressResult.stressedDscr[i] >= 1.25 ? "text-emerald-400" : stressResult.stressedDscr[i] >= 1.0 ? "text-amber-400" : "text-red-400"}`}>
                              {fmt(stressResult.stressedDscr[i], 2)}x
                            </div>
                          </>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-zinc-500">Min DSCR</div>
                          <div className={`font-semibold mt-0.5 ${stressResult.minDscr >= 1.25 ? "text-emerald-400" : stressResult.minDscr >= 1.0 ? "text-amber-400" : "text-red-400"}`}>{fmt(stressResult.minDscr, 2)}x</div>
                        </div>
                        <div>
                          <div className="text-zinc-500">Covenant Status</div>
                          <div className={`font-semibold mt-0.5 ${stressResult.covenantBreached ? "text-red-400" : "text-emerald-400"}`}>{stressResult.covenantBreached ? "BREACHED" : "COMPLIANT"}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
                    <div className="text-zinc-500 text-sm">Select parameters and run a stress test to see results.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PORTFOLIO ARCHITECTURE ─────────────────────────────────────────── */}
        {activeTab === "architecture" && (
          <div className="space-y-6">
            <div className="text-zinc-400 text-sm">6-Slot Portfolio Architecture — 4–6 SME Acquisitions (3 Phases)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {slotsQ.data?.map(slot => (
                <div
                  key={slot.slotNumber}
                  className={`bg-zinc-900 border rounded-lg p-4 ${
                    slot.status === "active" ? "border-blue-700" :
                    slot.status === "target_identified" ? "border-amber-700" :
                    "border-zinc-800 border-dashed"
                  }`}
                >
                  <div className="text-zinc-500 text-xs mb-2">Slot {slot.slotNumber}</div>
                  {slot.companyName ? (
                    <>
                      <div className="text-white text-sm font-medium">{slot.companyName}</div>
                      <div className="text-zinc-500 text-xs mt-1">{slot.sector}</div>
                      {slot.revenueKwd && (
                        <div className="text-zinc-400 text-xs mt-2">
                          Revenue: {fmtKwd(slot.revenueKwd)}
                        </div>
                      )}
                      <div className="mt-2">
                        <StatusBadge status={slot.status ?? "empty"} />
                      </div>
                    </>
                  ) : (
                    <div className="text-zinc-600 text-xs italic">Empty slot</div>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-xs mb-2 font-medium">Portfolio Diversification Rules</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-zinc-400">
                <div>Max sector concentration: <span className="text-zinc-200">30%</span></div>
                <div>Max single company: <span className="text-zinc-200">20%</span></div>
                <div>Target portfolio size: <span className="text-zinc-200">4–6 companies</span></div>
                <div>Automation threshold: <span className="text-zinc-200">≥ 40% of revenue</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT LOG ──────────────────────────────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="text-zinc-400 text-sm">Audit Log — All Twin Actions</div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-900/80">
                    <th className="text-left p-3">Timestamp</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Action</th>
                    <th className="text-left p-3">Entity</th>
                    <th className="text-left p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {auditQ.data?.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-zinc-600">No audit entries yet.</td></tr>
                  )}
                  {auditQ.data?.map(entry => (
                    <tr key={entry.id} className="text-zinc-400 hover:bg-zinc-800/50">
                      <td className="p-3 font-mono">{new Date(entry.createdAt ?? 0).toLocaleString()}</td>
                      <td className="p-3">{entry.userName ?? `uid:${entry.userId}`}</td>
                      <td className="p-3 text-zinc-300">{entry.actionType}</td>
                      <td className="p-3">{entry.entityType ? `${entry.entityType}:${entry.entityId}` : "—"}</td>
                      <td className="p-3">{entry.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
