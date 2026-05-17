/**
 * AdminEvalsDashboard.tsx — P7 Eval Observability Dashboard
 *
 * Admin-only page. Redirects non-admin users to /.
 * Consumes trpc.adminEvalStats.* procedures (P5/P6).
 *
 * Panels:
 *   1. Summary KPI strip — total calls, cost, cache hit rate, p95 latency, fallbacks, retries, escalations
 *   2. Daily call volume + cost chart (recharts BarChart + Line)
 *   3. Provider / model breakdown table
 *   4. Escalation reason breakdown
 *   5. Live in-process LRU cache snapshot
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import MeshSidebar from "@/components/MeshSidebar";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function usd(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function ms(n: number) {
  if (n === 0) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

function num(n: number) {
  return n.toLocaleString();
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "red" | "blue" | "default";
}) {
  const accentClass = {
    green: "border-l-emerald-500",
    amber: "border-l-amber-400",
    red: "border-l-red-500",
    blue: "border-l-sky-500",
    default: "border-l-slate-600",
  }[accent ?? "default"];

  return (
    <div
      className={`bg-[#0f1117] border border-white/10 rounded-lg p-4 border-l-2 ${accentClass} flex flex-col gap-1`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="text-2xl font-bold text-white leading-none">{value}</span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[13px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
      {title}
    </h2>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-white/5 rounded animate-pulse ${className ?? "h-8 w-full"}`}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { label: "24 h", days: 1 },
  { label: "7 d", days: 7 },
  { label: "30 d", days: 30 },
  { label: "90 d", days: 90 },
];

export default function AdminEvalsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(7);

  // Redirect non-admin
  if (!authLoading && (!user || user.role !== "admin")) {
    setLocation("/");
    return null;
  }

  const windowInput = { days };

  const summary = trpc.adminEvalStats.summary.useQuery(windowInput, {
    refetchInterval: 60_000,
  });
  const byDay = trpc.adminEvalStats.byDay.useQuery(windowInput, {
    refetchInterval: 60_000,
  });
  const byProvider = trpc.adminEvalStats.byProvider.useQuery(windowInput, {
    refetchInterval: 60_000,
  });
  const escalations = trpc.adminEvalStats.escalations.useQuery(windowInput, {
    refetchInterval: 60_000,
  });
  const cacheStats = trpc.adminEvalStats.cacheStats.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const s = summary.data;
  const isLoading = summary.isLoading;

  return (
    <div className="flex min-h-screen bg-[#080a0e] text-white">
      <MeshSidebar>{null}</MeshSidebar>

      <main className="flex-1 overflow-y-auto px-6 py-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Eval Observability
            </h1>
            <p className="text-[13px] text-slate-400 mt-0.5">
              DeepSeek-first routing · P4 cache · P5/P6 aggregations
            </p>
          </div>

          {/* Window selector */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                  days === opt.days
                    ? "bg-white/15 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Strip ─────────────────────────────────────────────────── */}
        <section className="mb-8">
          <SectionHeader title="Summary" />
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : s ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <KpiCard
                label="Total Calls"
                value={num(s.totalCalls)}
                sub={`${num(s.cacheMissCalls)} live`}
                accent="blue"
              />
              <KpiCard
                label="Total Cost"
                value={usd(s.totalCostUsd)}
                sub="excl. cache hits"
                accent={s.totalCostUsd > 1 ? "amber" : "green"}
              />
              <KpiCard
                label="Cache Hit Rate"
                value={pct(s.cacheHitRate)}
                sub={`${num(s.cachedCalls)} hits`}
                accent={s.cacheHitRate >= 0.3 ? "green" : "default"}
              />
              <KpiCard
                label="p95 Latency"
                value={ms(s.p95LatencyMs)}
                sub="live calls only"
                accent={s.p95LatencyMs > 10000 ? "red" : s.p95LatencyMs > 5000 ? "amber" : "green"}
              />
              <KpiCard
                label="Fallbacks"
                value={num(s.fallbackCalls)}
                sub={pct(s.fallbackRate)}
                accent={s.fallbackRate > 0.1 ? "red" : s.fallbackRate > 0.05 ? "amber" : "default"}
              />
              <KpiCard
                label="Retries"
                value={num(s.totalRetries)}
                sub="total retry count"
                accent={s.totalRetries > 50 ? "amber" : "default"}
              />
              <KpiCard
                label="Escalations"
                value={num(s.escalatedCalls)}
                sub={pct(s.escalationRate)}
                accent={s.escalationRate > 0.15 ? "red" : s.escalationRate > 0.05 ? "amber" : "default"}
              />
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No data for this window.</p>
          )}
        </section>

        {/* ── Daily Volume + Cost Chart ──────────────────────────────────── */}
        <section className="mb-8">
          <SectionHeader title="Daily Call Volume & Cost" />
          <div className="bg-[#0f1117] border border-white/10 rounded-lg p-4">
            {byDay.isLoading ? (
              <Skeleton className="h-48 rounded" />
            ) : byDay.data && byDay.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={byDay.data}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0f" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="calls"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <YAxis
                    yAxisId="cost"
                    orientation="right"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                    tickFormatter={(v) => `$${v.toFixed(3)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f1117",
                      border: "1px solid #ffffff1a",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number, name: string) => {
                      if (name === "Cost (USD)") return [`$${value.toFixed(4)}`, name];
                      return [num(value), name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                  />
                  <Bar
                    yAxisId="calls"
                    dataKey="totalCalls"
                    name="Total Calls"
                    fill="#3b82f6"
                    radius={[3, 3, 0, 0]}
                    opacity={0.85}
                  />
                  <Bar
                    yAxisId="calls"
                    dataKey="cachedCalls"
                    name="Cached Calls"
                    fill="#10b981"
                    radius={[3, 3, 0, 0]}
                    opacity={0.7}
                  />
                  <Line
                    yAxisId="cost"
                    type="monotone"
                    dataKey="totalCostUsd"
                    name="Cost (USD)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f59e0b" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm py-8 text-center">
                No daily data for this window.
              </p>
            )}
          </div>
        </section>

        {/* ── Provider / Model Breakdown ─────────────────────────────────── */}
        <section className="mb-8">
          <SectionHeader title="Provider / Model Breakdown" />
          <div className="bg-[#0f1117] border border-white/10 rounded-lg overflow-hidden">
            {byProvider.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded" />
                ))}
              </div>
            ) : byProvider.data && byProvider.data.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="text-left px-4 py-3">Provider</th>
                    <th className="text-left px-4 py-3">Model</th>
                    <th className="text-right px-4 py-3">Calls</th>
                    <th className="text-right px-4 py-3">Cache Hit</th>
                    <th className="text-right px-4 py-3">Cost</th>
                    <th className="text-right px-4 py-3">Avg Latency</th>
                    <th className="text-right px-4 py-3">Fallbacks</th>
                    <th className="text-right px-4 py-3">Escalations</th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.data.map((row, i) => (
                    <tr
                      key={`${row.provider}-${row.model}`}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        i % 2 === 0 ? "" : "bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            row.provider === "deepseek"
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-violet-500/20 text-violet-300"
                          }`}
                        >
                          {row.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-[12px]">
                        {row.model}
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {num(row.totalCalls)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            row.cacheHitRate >= 0.3
                              ? "text-emerald-400"
                              : "text-slate-400"
                          }
                        >
                          {pct(row.cacheHitRate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-amber-300">
                        {usd(row.totalCostUsd)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {ms(row.avgLatencyMs)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            row.fallbackCalls > 0 ? "text-red-400" : "text-slate-500"
                          }
                        >
                          {num(row.fallbackCalls)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            row.escalatedCalls > 0 ? "text-amber-400" : "text-slate-500"
                          }
                        >
                          {num(row.escalatedCalls)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 text-sm p-4">
                No provider data for this window.
              </p>
            )}
          </div>
        </section>

        {/* ── Escalation Breakdown + Cache Stats ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Escalation breakdown */}
          <section>
            <SectionHeader title="Escalation Breakdown" />
            <div className="bg-[#0f1117] border border-white/10 rounded-lg overflow-hidden">
              {escalations.isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 rounded" />
                  ))}
                </div>
              ) : escalations.data && escalations.data.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="text-left px-4 py-3">Reason</th>
                      <th className="text-right px-4 py-3">Count</th>
                      <th className="text-right px-4 py-3">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalations.data.map((row) => (
                      <tr
                        key={row.reason}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              row.reason === "none"
                                ? "bg-slate-700/50 text-slate-400"
                                : row.reason === "deepseek_unavailable"
                                ? "bg-red-500/20 text-red-300"
                                : row.reason === "low_confidence"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-orange-500/20 text-orange-300"
                            }`}
                          >
                            {row.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {num(row.count)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {row.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-slate-500 text-sm p-4">
                  No escalation data for this window.
                </p>
              )}
            </div>
          </section>

          {/* Live cache snapshot */}
          <section>
            <SectionHeader title="Live Cache Snapshot (LRU)" />
            <div className="bg-[#0f1117] border border-white/10 rounded-lg p-5">
              {cacheStats.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 rounded" />
                  ))}
                </div>
              ) : cacheStats.data ? (
                <div className="space-y-4">
                  {/* Hit rate gauge */}
                  <div>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-slate-400">Hit Rate (since last restart)</span>
                      <span
                        className={
                          cacheStats.data.hitRate >= 0.3
                            ? "text-emerald-400 font-semibold"
                            : "text-slate-300"
                        }
                      >
                        {pct(cacheStats.data.hitRate)}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            cacheStats.data.hitRate * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: "Entries (size)", value: num(cacheStats.data.size) },
                      { label: "Hits", value: num(cacheStats.data.hits), accent: "text-emerald-400" },
                      { label: "Misses", value: num(cacheStats.data.misses) },
                      { label: "Evictions", value: num(cacheStats.data.evictions), accent: "text-amber-400" },
                      { label: "Expirations", value: num(cacheStats.data.expirations), accent: "text-amber-400" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex justify-between items-center bg-white/5 rounded px-3 py-2"
                      >
                        <span className="text-slate-400 text-[12px]">{item.label}</span>
                        <span className={`font-semibold ${item.accent ?? "text-white"}`}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-600 mt-1">
                    Refreshes every 15 s · Resets on server restart · Max 500 entries · TTL 30 min
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Cache stats unavailable.</p>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-slate-600 text-center pb-4">
          AgenThinkMesh · Eval Observability · P5/P6/P7 · Data refreshes every 60 s
        </p>
      </main>
    </div>
  );
}
