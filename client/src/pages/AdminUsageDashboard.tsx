import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import MeshSidebar from "@/components/MeshSidebar";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtNumber(n: number) {
  return n.toLocaleString();
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const ENDPOINT_COLORS: Record<string, string> = {
  "mesh-runAgentTask": "bg-teal-400",
  "game-theory": "bg-blue-400",
  "force-majeure": "bg-amber-400",
  "etf-claude-proxy": "bg-purple-400",
};

function endpointColor(ep: string) {
  return ENDPOINT_COLORS[ep] ?? "bg-slate-400";
}

function endpointLabel(ep: string) {
  const map: Record<string, string> = {
    "mesh-runAgentTask": "Mesh Agent",
    "game-theory": "Game Theory",
    "force-majeure": "Force Majeure",
    "etf-claude-proxy": "ETF Studio",
  };
  return map[ep] ?? ep;
}

// ── Main component ─────────────────────────────────────────────────────────────
// ── Country flag helper ───────────────────────────────────────────────────────
function countryFlag(country: string | null): string {
  if (!country || country === "Local") return "";
  const codeMap: Record<string, string> = {
    "Kuwait": "🇰🇼", "UAE": "🇦🇪", "United Arab Emirates": "🇦🇪",
    "Saudi Arabia": "🇸🇦", "Qatar": "🇶🇦", "Bahrain": "🇧🇭",
    "Oman": "🇴🇲", "Jordan": "🇯🇴", "Egypt": "🇪🇬",
    "United States": "🇺🇸", "United Kingdom": "🇬🇧", "Germany": "🇩🇪",
    "France": "🇫🇷", "India": "🇮🇳", "Pakistan": "🇵🇰",
    "Canada": "🇨🇦", "Australia": "🇦🇺", "Singapore": "🇸🇬",
    "Turkey": "🇹🇷", "Netherlands": "🇳🇱", "Switzerland": "🇨🇭",
  };
  return codeMap[country] ?? "";
}

function fmtRelative(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days2 = Math.floor(hrs / 24);
  if (days2 < 30) return `${days2}d ago`;
  return d.toLocaleDateString();
}

export default function AdminUsageDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [days, setDays] = useState(30);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data: today, isLoading: todayLoading } = trpc.adminUsage.todaySummary.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 60_000,
  });

  const { data: dailyRows, isLoading: dailyLoading } = trpc.adminUsage.dailyStats.useQuery(
    { days },
    { enabled: user?.role === "admin" }
  );

  const { data: userRows, isLoading: userLoading } = trpc.adminUsage.userStats.useQuery(
    { days },
    { enabled: user?.role === "admin" }
  );

  const { data: allUsers, isLoading: usersLoading } = trpc.adminUsage.allUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: highDemand, isLoading: hdLoading } = trpc.adminUsage.highDemandEvents.useQuery(
    { limit: 20 },
    { enabled: user?.role === "admin" }
  );

  const { data: trialMetrics } = trpc.billing.listTrialMetrics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: revenueMetrics } = trpc.billing.listRevenueMetrics.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: usersWithPlan } = trpc.billing.listUsersWithPlan.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const assignEnterprise = trpc.billing.assignEnterprise.useMutation();

  const { data: activityData, isLoading: activityLoading } = trpc.adminUsage.getUserActivity.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const activityRows = activityData?.rows;
  const emailSignalCount = activityData?.emailSignalCount ?? 0;

  // Aggregate daily rows into per-date totals for the chart
  const chartData = useMemo(() => {
    if (!dailyRows) return [];
    const byDate: Record<string, number> = {};
    for (const row of dailyRows) {
      byDate[row.date] = (byDate[row.date] ?? 0) + Number(row.totalTokens);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30);
  }, [dailyRows]);

  const maxDayTokens = useMemo(() => Math.max(...chartData.map(([, v]) => v), 1), [chartData]);

  // Endpoint breakdown for today
  const endpointBreakdown = useMemo(() => {
    if (!dailyRows) return [];
    const today2 = new Date().toISOString().slice(0, 10);
    const todayRows = dailyRows.filter((r) => r.date === today2);
    return todayRows.sort((a, b) => Number(b.totalTokens) - Number(a.totalTokens));
  }, [dailyRows]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  const [, setLocation] = useLocation();
  if (!user) { setLocation("/"); return null; }
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-red-400 text-sm">Access restricted to administrators.</div>
      </div>
    );
  }

  return (
    <MeshSidebar>
      <div className="min-h-screen bg-[#0a0e1a] text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded">ADMIN</span>
            <span className="text-xs text-slate-500">Usage &amp; Rate Limits</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Platform Usage Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Daily token consumption, per-user activity, and rate limit events across all LLM endpoints.
          </p>
        </div>

        {/* Today's KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Tokens Today",
              value: todayLoading ? "—" : fmtNumber(today?.totalTokens ?? 0),
              sub: `of ${fmtNumber(50000)} daily budget`,
              accent: "text-teal-400",
            },
            {
              label: "Requests Today",
              value: todayLoading ? "—" : fmtNumber(today?.requestCount ?? 0),
              sub: "across all endpoints",
              accent: "text-blue-400",
            },
            {
              label: "Budget Used",
              value: todayLoading ? "—" : `${today?.percentUsed ?? 0}%`,
              sub: today && today.percentUsed >= 80 ? "⚠ Near limit" : "within budget",
              accent: (today?.percentUsed ?? 0) >= 80 ? "text-amber-400" : "text-green-400",
            },
            {
              label: "Blocked Requests",
              value: todayLoading ? "—" : fmtNumber(today?.blockedRequests ?? 0),
              sub: "high-demand events today",
              accent: "text-red-400",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">{card.label}</div>
              <div className={`text-2xl font-bold ${card.accent}`}>{card.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Budget progress bar */}
        {today && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-8">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Daily Token Budget</span>
              <span>{fmtNumber(today.totalTokens)} / {fmtNumber(today.tokenBudget)} tokens</span>
            </div>
            <ProgressBar
              value={today.totalTokens}
              max={today.tokenBudget}
              color={today.percentUsed >= 80 ? "bg-amber-400" : "bg-teal-400"}
            />
          </div>
        )}

        {/* Endpoint breakdown today */}
        {endpointBreakdown.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
            <h2 className="text-sm font-semibold text-white mb-4">Today by Endpoint</h2>
            <div className="space-y-3">
              {endpointBreakdown.map((row) => (
                <div key={row.endpoint} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${endpointColor(row.endpoint)}`} />
                  <div className="w-36 text-xs text-slate-300 truncate">{endpointLabel(row.endpoint)}</div>
                  <div className="flex-1">
                    <ProgressBar
                      value={Number(row.totalTokens)}
                      max={today?.tokenBudget ?? 50000}
                      color={endpointColor(row.endpoint)}
                    />
                  </div>
                  <div className="text-xs text-slate-400 w-24 text-right">
                    {fmtNumber(Number(row.totalTokens))} tk · {Number(row.requestCount)} req
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 30-day bar chart */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Daily Token Consumption</h2>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
            </select>
          </div>
          {dailyLoading ? (
            <div className="h-32 flex items-center justify-center text-slate-500 text-xs">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-500 text-xs">No data yet</div>
          ) : (
            <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
              {chartData.map(([date, tokens]) => {
                const pct = Math.max(4, Math.round((tokens / maxDayTokens) * 100));
                return (
                  <div key={date} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: "24px" }}>
                    <div
                      className="w-5 bg-teal-400/70 rounded-t hover:bg-teal-400 transition-colors cursor-default"
                      style={{ height: `${pct}%` }}
                      title={`${date}: ${fmtNumber(tokens)} tokens`}
                    />
                    <div className="text-[9px] text-slate-600 rotate-45 origin-left whitespace-nowrap">
                      {date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Per-user stats */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Top Users ({days}d)</h2>
            {userLoading ? (
              <div className="text-slate-500 text-xs">Loading…</div>
            ) : !userRows || userRows.length === 0 ? (
              <div className="text-slate-500 text-xs">No usage data yet</div>
            ) : (
              <div className="space-y-2">
                {userRows.slice(0, 10).map((row, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <div className="w-5 h-5 rounded-full bg-teal-400/20 flex items-center justify-center text-teal-400 font-bold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 truncate">{row.userName ?? "Anonymous"}</div>
                      <div className="text-slate-500 truncate">{row.userEmail ?? row.userId ?? "—"}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-teal-400 font-mono">{fmtNumber(Number(row.totalTokens))}</div>
                      <div className="text-slate-500">{Number(row.requestCount)} req</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High demand events */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">High-Demand Events</h2>
            {hdLoading ? (
              <div className="text-slate-500 text-xs">Loading…</div>
            ) : !highDemand || highDemand.length === 0 ? (
              <div className="text-slate-500 text-xs">No high-demand events recorded</div>
            ) : (
              <div className="space-y-2">
                {highDemand.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 text-xs border-b border-white/5 pb-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 truncate">{ev.userEmail ?? ev.ipAddress}</div>
                      <div className="text-slate-500">{ev.requestDate} · {endpointLabel(ev.endpoint)}</div>
                    </div>
                    <div className="text-red-400 font-mono flex-shrink-0">
                      {fmtNumber(ev.dailyTotalAtTime)} tk
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* All registered users */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Registered Users</h2>
          {usersLoading ? (
            <div className="text-slate-500 text-xs">Loading…</div>
          ) : !allUsers || allUsers.length === 0 ? (
            <div className="text-slate-500 text-xs">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-white/10">
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-left py-2 pr-4">Email</th>
                    <th className="text-left py-2 pr-4">Role</th>
                    <th className="text-left py-2 pr-4">Joined</th>
                    <th className="text-left py-2">Last Sign-in</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-4 text-slate-200">{u.name ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-400">{u.email ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${u.role === "admin" ? "bg-amber-400/20 text-amber-400" : "bg-slate-700 text-slate-400"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-slate-500">
                        {new Date(u.lastSignedIn).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* ── Trial Metrics ─────────────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Trial Funnel</h2>
          {trialMetrics ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Active Trials", value: trialMetrics.activeTrials, color: "text-cyan-400" },
                  { label: "Expired Trials", value: trialMetrics.expiredTrials, color: "text-red-400" },
                  { label: "Converted Users", value: trialMetrics.convertedUsers, color: "text-green-400" },
                  { label: "Conversion Rate", value: `${trialMetrics.conversionRate}%`, color: "text-amber-400" },
                ].map(m => (
                  <div key={m.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                    <div className="text-slate-500 text-xs mt-1">{m.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xl font-bold text-slate-200">{trialMetrics.avgRunsPerTrial}</div>
                  <div className="text-slate-500 text-xs mt-1">Avg runs per trial</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xl font-bold text-amber-400">{trialMetrics.nearExpiry}</div>
                  <div className="text-slate-500 text-xs mt-1">Expiring within 7 days</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xl font-bold text-slate-200">{trialMetrics.totalTrialUsers}</div>
                  <div className="text-slate-500 text-xs mt-1">Total trial signups</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500 text-sm">Loading trial metrics…</div>
          )}
        </div>

        {/* ── Revenue Metrics ───────────────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Revenue</h2>
          {revenueMetrics ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "MRR", value: `$${revenueMetrics.mrr}`, color: "text-green-400" },
                { label: "Total Revenue", value: `$${revenueMetrics.totalRevenue}`, color: "text-cyan-400" },
                { label: "Active Subscriptions", value: revenueMetrics.activeSubscriptions, color: "text-blue-400" },
                { label: "Standard / Pro / Ent", value: `${revenueMetrics.standardCount} / ${revenueMetrics.proCount} / ${revenueMetrics.enterpriseCount}`, color: "text-amber-400" },
              ].map(m => (
                <div key={m.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-slate-500 text-xs mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">Loading revenue metrics…</div>
          )}
        </div>

        {/* ── Users with Plan ───────────────────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">User Plans</h2>
          {usersWithPlan && usersWithPlan.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 text-left">
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">Plan</th>
                    <th className="pb-2 pr-4">Runs Used</th>
                    <th className="pb-2 pr-4">Trial Remaining</th>
                    <th className="pb-2 pr-4">Converted</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithPlan.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-4 text-slate-200">{u.name ?? u.email ?? `#${u.id}`}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          u.planTier === "enterprise" ? "bg-amber-400/20 text-amber-400" :
                          u.planTier === "pro" ? "bg-purple-400/20 text-purple-400" :
                          u.planTier === "standard" ? "bg-blue-400/20 text-blue-400" :
                          "bg-slate-700 text-slate-400"
                        }`}>{u.planTier}</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{u.totalCompletedRuns ?? 0}</td>
                      <td className="py-2 pr-4 text-slate-400">{u.planTier === "trial" ? (u.trialRunsRemaining ?? 0) : "—"}</td>
                      <td className="py-2 pr-4 text-slate-500">{u.convertedAt ? new Date(u.convertedAt).toLocaleDateString() : "—"}</td>
                      <td className="py-2">
                        {u.planTier !== "enterprise" && (
                          <button
                            onClick={() => assignEnterprise.mutate({ userId: u.id })}
                            className="text-xs text-amber-400 hover:text-amber-300 underline"
                          >
                            → Enterprise
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No users found.</div>
          )}
        </div>

        {/* User Activity Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
          <h2 className="text-base font-semibold text-white mb-4">User Activity</h2>
          {/* Email signal summary line */}
          <div className="text-xs text-slate-500 mb-4">
            {activityLoading ? null : emailSignalCount > 0
              ? `${emailSignalCount} email signal${emailSignalCount !== 1 ? "s" : ""} auto-logged this month`
              : "No email signals yet"}
          </div>
          {activityLoading ? (
            <div className="text-slate-500 text-sm">Loading…</div>
          ) : activityRows && activityRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 text-left">
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2 pr-4">Country</th>
                    <th className="pb-2 pr-4">Last Login</th>
                    <th className="pb-2">Login Count</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <>
                      <tr
                        key={row.userId}
                        className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                        onClick={() => setExpandedUser(expandedUser === row.userId ? null : row.userId)}
                      >
                        <td className="py-2 pr-4">
                          <div className="text-slate-200">{row.name ?? row.email ?? `#${row.userId}`}</div>
                          {row.name && <div className="text-slate-500 text-xs">{row.email}</div>}
                        </td>
                        <td className="py-2 pr-4 font-mono text-slate-400 text-xs">{row.lastIp ?? "—"}</td>
                        <td className="py-2 pr-4 text-slate-300">
                          {row.lastCountry
                            ? `${countryFlag(row.lastCountry)} ${row.lastCountry}`.trim()
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-400">{fmtRelative(row.lastLoginAt)}</td>
                        <td className="py-2 text-slate-400">
                          <span className="flex items-center gap-2">
                            {row.loginCount}
                            {row.loginCount > 0 && (
                              <span className="text-slate-600 text-xs">
                                {expandedUser === row.userId ? "▲" : "▼"}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                      {expandedUser === row.userId && (
                        <LoginHistoryRow userId={row.userId} isAdmin={user?.role === "admin"} />
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No users found.</div>
          )}
        </div>

      </div>
      </div>
    </MeshSidebar>
  );
}

// ── Inline login history expand row ───────────────────────────────────────────
function LoginHistoryRow({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { data, isLoading } = trpc.adminUsage.getUserLoginHistory.useQuery(
    { userId },
    { enabled: isAdmin }
  );
  return (
    <tr className="bg-white/[0.03]">
      <td colSpan={5} className="px-4 py-3">
        {isLoading ? (
          <div className="text-slate-500 text-xs">Loading history…</div>
        ) : data && data.length > 0 ? (
          <div className="space-y-1">
            {data.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 text-xs text-slate-400">
                <span className="font-mono">{ev.ipAddress}</span>
                <span>{ev.country ? `${countryFlag(ev.country)} ${ev.country}`.trim() : "—"}</span>
                <span>{new Date(ev.loginAt).toLocaleString("en-KW", { timeZone: "Asia/Kuwait" })}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-600 text-xs">No login history.</div>
        )}
      </td>
    </tr>
  );
}
