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

// ── Reusable pagination controls ──────────────────────────────────────────────
function PaginationBar({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={onPrev}
          className="px-3 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >← Prev</button>
        <button
          disabled={page >= totalPages}
          onClick={onNext}
          className="px-3 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >Next →</button>
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="py-2.5 pr-4">
              <div className="h-3 bg-white/10 rounded animate-pulse" style={{ width: `${60 + ((i * j * 13) % 35)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function AdminUsageDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [days, setDays] = useState(30);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ── User Activity pagination + filters ──
  const [actPage, setActPage] = useState(1);
  const [actEmail, setActEmail] = useState("");
  const [actDateFrom, setActDateFrom] = useState("");
  const [actDateTo, setActDateTo] = useState("");
  const [actSortBy, setActSortBy] = useState<"lastLoginAt" | "loginCount">("lastLoginAt");
  const [actSortDir, setActSortDir] = useState<"asc" | "desc">("desc");
  const ACT_LIMIT = 20;

  // ── Waitlist pagination + filters ──
  const [wlPage, setWlPage] = useState(1);
  const [wlDateFrom, setWlDateFrom] = useState("");
  const [wlDateTo, setWlDateTo] = useState("");
  const WL_LIMIT = 20;

  // ── Login Events pagination + filters ──
  const [lePage, setLePage] = useState(1);
  const [leEmail, setLeEmail] = useState("");
  const [leCountry, setLeCountry] = useState("");
  const [leDateFrom, setLeDateFrom] = useState("");
  const [leDateTo, setLeDateTo] = useState("");
  const LE_LIMIT = 20;

  // ── Fleet Evaluations pagination + filters ──
  const [fePage, setFePage] = useState(1);
  const [feFleetMode, setFeFleetMode] = useState("");
  const [feStatus, setFeStatus] = useState<"" | "queued" | "running" | "completed" | "failed">("" );
  const [feDateFrom, setFeDateFrom] = useState("");
  const [feDateTo, setFeDateTo] = useState("");
  const FE_LIMIT = 50;

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

  // ── User Activity query (server-side paginated) ──
  const { data: activityData, isLoading: activityLoading } = trpc.adminUsage.getUserActivity.useQuery({
    limit: ACT_LIMIT,
    offset: (actPage - 1) * ACT_LIMIT,
    email: actEmail || undefined,
    dateFrom: actDateFrom || undefined,
    dateTo: actDateTo || undefined,
    sortBy: actSortBy,
    sortDir: actSortDir,
  }, { enabled: user?.role === "admin" });
  const activityRows = activityData?.rows ?? [];
  const actTotal = activityData?.total ?? 0;
  const actTotalPages = Math.max(1, Math.ceil(actTotal / ACT_LIMIT));
  const emailSignalCount = activityData?.emailSignalCount ?? 0;

  // ── Waitlist query (server-side paginated) ──
  const [waitlistSourceFilter, setWaitlistSourceFilter] = useState<string>("all");
  const [waitlistSortOrder, setWaitlistSortOrder] = useState<"desc" | "asc">("desc");
  const [copyEmailsLabel, setCopyEmailsLabel] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mesh_waitlist_last_exported") : null
  );
  const { data: waitlistData, isLoading: waitlistLoading } = trpc.waitlist.list.useQuery({
    limit: WL_LIMIT,
    offset: (wlPage - 1) * WL_LIMIT,
    sourcePage: waitlistSourceFilter !== "all" ? waitlistSourceFilter : undefined,
    dateFrom: wlDateFrom || undefined,
    dateTo: wlDateTo || undefined,
    sortDir: waitlistSortOrder,
  }, { enabled: user?.role === "admin" });
  const waitlistRows = waitlistData?.rows ?? [];
  const wlTotal = waitlistData?.total ?? 0;
  const wlTotalPages = Math.max(1, Math.ceil(wlTotal / WL_LIMIT));

  const { data: waitlistBySource } = trpc.adminUsage.waitlistBySource.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // ── Login Events query (server-side paginated) ──
  const { data: loginEventsData, isLoading: loginEventsLoading } = trpc.adminUsage.listLoginEvents.useQuery({
    limit: LE_LIMIT,
    offset: (lePage - 1) * LE_LIMIT,
    email: leEmail || undefined,
    country: leCountry || undefined,
    dateFrom: leDateFrom || undefined,
    dateTo: leDateTo || undefined,
  }, { enabled: user?.role === "admin" });
  const loginEventRows = loginEventsData?.rows ?? [];
  const leTotal = loginEventsData?.total ?? 0;
  const leTotalPages = Math.max(1, Math.ceil(leTotal / LE_LIMIT));

  // ── Fleet Evaluations query (server-side paginated) ──
  const { data: fleetEvalData, isLoading: fleetEvalLoading } = trpc.adminUsage.listFleetEvaluations.useQuery({
    limit: FE_LIMIT,
    offset: (fePage - 1) * FE_LIMIT,
    fleetMode: feFleetMode || undefined,
    status: feStatus || undefined,
    dateFrom: feDateFrom || undefined,
    dateTo: feDateTo || undefined,
  }, { enabled: user?.role === "admin" });
  const fleetEvalRows = fleetEvalData?.rows ?? [];
  const feTotal = fleetEvalData?.total ?? 0;
  const feTotalPages = Math.max(1, Math.ceil(feTotal / FE_LIMIT));

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">User Activity</h2>
            <span className="text-xs text-slate-500">{actTotal} total</span>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text" placeholder="Filter by email…" value={actEmail}
              onChange={e => { setActEmail(e.target.value); setActPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 w-48"
            />
            <input type="date" value={actDateFrom}
              onChange={e => { setActDateFrom(e.target.value); setActPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50"
            />
            <input type="date" value={actDateTo}
              onChange={e => { setActDateTo(e.target.value); setActPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50"
            />
            <select value={actSortBy} onChange={e => { setActSortBy(e.target.value as "lastLoginAt" | "loginCount"); setActPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50">
              <option value="lastLoginAt">Sort: Last Login</option>
              <option value="loginCount">Sort: Login Count</option>
            </select>
            <button onClick={() => setActSortDir(d => d === "desc" ? "asc" : "desc")}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 hover:bg-white/20 transition-colors">
              {actSortDir === "desc" ? "↓ Desc" : "↑ Asc"}
            </button>
          </div>
          {/* Email signal summary */}
          <div className="text-xs text-slate-500 mb-3">
            {!activityLoading && (emailSignalCount > 0
              ? `${emailSignalCount} email signal${emailSignalCount !== 1 ? "s" : ""} auto-logged this month`
              : "No email signals yet")}
          </div>
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
                {activityLoading ? (
                  <SkeletonRows cols={5} rows={5} />
                ) : activityRows.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-500 text-sm">No users found.</td></tr>
                ) : (
                  activityRows.map((row) => (
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
                          {row.lastCountry ? `${countryFlag(row.lastCountry)} ${row.lastCountry}`.trim() : "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-400">{fmtRelative(row.lastLoginAt)}</td>
                        <td className="py-2 text-slate-400">
                          <span className="flex items-center gap-2">
                            {row.loginCount}
                            {row.loginCount > 0 && (
                              <span className="text-slate-600 text-xs">{expandedUser === row.userId ? "▲" : "▼"}</span>
                            )}
                          </span>
                        </td>
                      </tr>
                      {expandedUser === row.userId && (
                        <LoginHistoryRow userId={row.userId} isAdmin={user?.role === "admin"} />
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar page={actPage} totalPages={actTotalPages} onPrev={() => setActPage(p => p - 1)} onNext={() => setActPage(p => p + 1)} />
        </div>

        {/* Waitlist Signups */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-white">Waitlist Signups</h2>
              <p className="text-xs text-slate-400 mt-0.5">All users who joined the waitlist via the landing page.</p>
            </div>
            <span className="text-xs text-slate-500">{wlTotal} total</span>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            <select value={waitlistSourceFilter}
              onChange={e => { setWaitlistSourceFilter(e.target.value); setWlPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50">
              <option value="all">All sources</option>
              <option value="sg-ic">sg-ic</option>
              <option value="jp-ic">jp-ic</option>
              <option value="us-ic">us-ic</option>
              <option value="demos">demos</option>
              <option value="other">other</option>
            </select>
            <input type="date" value={wlDateFrom}
              onChange={e => { setWlDateFrom(e.target.value); setWlPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50" />
            <input type="date" value={wlDateTo}
              onChange={e => { setWlDateTo(e.target.value); setWlPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50" />
            <button onClick={() => { setWaitlistSortOrder(o => o === "desc" ? "asc" : "desc"); setWlPage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 hover:bg-white/20 transition-colors">
              {waitlistSortOrder === "desc" ? "↓ Newest" : "↑ Oldest"}
            </button>
            <button
              onClick={() => {
                const rows = waitlistRows;
                const header = ["Email", "Source", "Interest", "Signed Up"];
                const csvRows = rows.map(r => [
                  r.email ?? "", r.sourcePage ?? "", r.stageInterest ?? "",
                  r.createdAt ? new Date(r.createdAt).toLocaleString("en-KW", { timeZone: "Asia/Kuwait" }) : "",
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
                const csv = [header.join(","), ...csvRows].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `waitlist-signups-${new Date().toISOString().slice(0,10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
                const kwt = new Date().toLocaleString("en-KW", { timeZone: "Asia/Kuwait", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "") + " KWT";
                localStorage.setItem("mesh_waitlist_last_exported", kwt); setLastExported(kwt);
              }}
              className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded transition-colors">
              Export CSV
            </button>
            <button
              onClick={() => {
                const emails = waitlistRows.map(r => r.email ?? "").filter(Boolean).join(", ");
                navigator.clipboard.writeText(emails).then(() => {
                  setCopyEmailsLabel(`✓ Copied ${waitlistRows.length}`);
                  setTimeout(() => setCopyEmailsLabel(null), 2000);
                });
              }}
              className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded transition-colors min-w-[96px] text-center">
              {copyEmailsLabel ?? "Copy emails"}
            </button>
          </div>
          {lastExported && <p className="text-[11px] text-slate-600 mb-2">Last exported: {lastExported}</p>}
          {/* Source breakdown summary */}
          {(() => {
            if (!waitlistBySource || waitlistBySource.length === 0) return null;
            const KNOWN = ["sg-ic", "jp-ic", "us-ic"];
            const knownRows = KNOWN.map(src => ({ src, count: Number(waitlistBySource.find(r => r.sourcePage === src)?.count ?? 0) }));
            const otherCount = waitlistBySource.filter(r => !KNOWN.includes(r.sourcePage ?? "")).reduce((s, r) => s + Number(r.count), 0);
            const allRows = [...knownRows, { src: "other", count: otherCount }].filter(r => r.count > 0);
            if (allRows.length === 0) return null;
            const maxCount = Math.max(...allRows.map(r => r.count));
            return (
              <div className="mb-4 pb-3 border-b border-white/10">
                <p className="text-xs text-slate-500 font-medium mb-2">Signups by source:</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                  {allRows.map(({ src, count }) => (
                    <div key={src} className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${count === maxCount ? "text-emerald-300 font-semibold" : "text-slate-400"}`}>{src}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className={`text-xs font-mono ${count === maxCount ? "text-emerald-300 font-semibold" : "text-slate-400"}`}>{count}</span>
                      {count === maxCount && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded font-mono">top</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Workflow Interest</th>
                  <th className="pb-2 pr-4 font-medium">Source Page</th>
                  <th className="pb-2 font-medium">Signed Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {waitlistLoading ? (
                  <SkeletonRows cols={4} rows={5} />
                ) : waitlistRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500 text-sm">
                    {waitlistSourceFilter === "all" ? "No waitlist signups yet." : `No signups from source “${waitlistSourceFilter}”.`}
                  </td></tr>
                ) : waitlistRows.map(row => (
                  <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2 pr-4 text-slate-200 font-mono text-xs">{row.email}</td>
                    <td className="py-2 pr-4"><span className="text-xs bg-teal-400/10 text-teal-300 border border-teal-400/20 px-2 py-0.5 rounded">{row.stageInterest ?? "—"}</span></td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">{row.sourcePage ?? "—"}</td>
                    <td className="py-2 text-slate-400 text-xs">{row.createdAt ? new Date(row.createdAt).toLocaleString("en-KW", { timeZone: "Asia/Kuwait" }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={wlPage} totalPages={wlTotalPages} onPrev={() => setWlPage(p => p - 1)} onNext={() => setWlPage(p => p + 1)} />
        </div>

        {/* Login Events */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Login Events</h2>
            <span className="text-xs text-slate-500">{leTotal} total</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <input type="text" placeholder="Filter by email…" value={leEmail}
              onChange={e => { setLeEmail(e.target.value); setLePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 w-48" />
            <input type="text" placeholder="Country (e.g. KW)…" value={leCountry}
              onChange={e => { setLeCountry(e.target.value); setLePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 w-32" />
            <input type="date" value={leDateFrom}
              onChange={e => { setLeDateFrom(e.target.value); setLePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50" />
            <input type="date" value={leDateTo}
              onChange={e => { setLeDateTo(e.target.value); setLePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 text-left">
                  <th className="pb-2 pr-4">User</th>
                  <th className="pb-2 pr-4">IP Address</th>
                  <th className="pb-2 pr-4">Country</th>
                  <th className="pb-2">Login At</th>
                </tr>
              </thead>
              <tbody>
                {loginEventsLoading ? (
                  <SkeletonRows cols={4} rows={5} />
                ) : loginEventRows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500 text-sm">No login events found.</td></tr>
                ) : loginEventRows.map(row => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4">
                      <div className="text-slate-200 text-xs">{row.email}</div>
                      <div className="text-slate-600 text-[11px] font-mono">{row.userId}</div>
                    </td>
                    <td className="py-2 pr-4 font-mono text-slate-400 text-xs">{row.ipAddress ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-300 text-xs">{row.country ? `${countryFlag(row.country)} ${row.country}` : "—"}</td>
                    <td className="py-2 text-slate-400 text-xs">{fmtRelative(row.loginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={lePage} totalPages={leTotalPages} onPrev={() => setLePage(p => p - 1)} onNext={() => setLePage(p => p + 1)} />
        </div>

        {/* Fleet Evaluations */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Fleet Evaluations</h2>
            <span className="text-xs text-slate-500">{feTotal} total</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <input type="text" placeholder="Fleet mode…" value={feFleetMode}
              onChange={e => { setFeFleetMode(e.target.value); setFePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500/50 w-36" />
            <select value={feStatus} onChange={e => { setFeStatus(e.target.value as typeof feStatus); setFePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50">
              <option value="">All statuses</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
            <input type="date" value={feDateFrom}
              onChange={e => { setFeDateFrom(e.target.value); setFePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50" />
            <input type="date" value={feDateTo}
              onChange={e => { setFeDateTo(e.target.value); setFePage(1); }}
              className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-teal-500/50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-500 text-left">
                  <th className="pb-2 pr-4">Run ID</th>
                  <th className="pb-2 pr-4">Fleet Mode</th>
                  <th className="pb-2 pr-4">Classification</th>
                  <th className="pb-2 pr-4">Score</th>
                  <th className="pb-2 pr-4">Cost</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {fleetEvalLoading ? (
                  <SkeletonRows cols={7} rows={5} />
                ) : fleetEvalRows.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-500 text-sm">No fleet evaluations found.</td></tr>
                ) : fleetEvalRows.map(row => (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4 font-mono text-slate-400 text-xs">#{row.runId}</td>
                    <td className="py-2 pr-4 text-slate-300 text-xs">{row.fleetMode}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">{row.classification ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-300 text-xs">{row.finalScore != null ? row.finalScore.toFixed(2) : "—"}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">${row.costUsd}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                        row.status === "completed" ? "bg-emerald-400/10 text-emerald-300" :
                        row.status === "failed" ? "bg-red-400/10 text-red-300" :
                        row.status === "running" ? "bg-amber-400/10 text-amber-300" :
                        "bg-slate-400/10 text-slate-400"
                      }`}>{row.status}</span>
                    </td>
                    <td className="py-2 text-slate-400 text-xs">{fmtRelative(new Date(row.createdAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={fePage} totalPages={feTotalPages} onPrev={() => setFePage(p => p - 1)} onNext={() => setFePage(p => p + 1)} />
        </div>

        {/* ── Deal Screening Funnel ── */}
        <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">Deal Screening Funnel</h2>
              <p className="text-xs text-slate-500 mt-0.5">Conversion events tracked via Umami analytics. View live counts in the Umami dashboard.</p>
            </div>
            <a
              href={`${import.meta.env.VITE_ANALYTICS_ENDPOINT ?? ""}/websites`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors border border-teal-500/30 rounded-lg px-3 py-1.5 hover:border-teal-400/50"
            >
              Open Umami ↗
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { event: "deal_screening_preview_view", label: "Preview Views", desc: "Unauthenticated user lands on /deals", color: "text-blue-400", border: "border-blue-500/20" },
              { event: "deal_screening_demo_click", label: "Demo Clicks", desc: "\"See a full deal memo example\" clicked", color: "text-cyan-400", border: "border-cyan-500/20" },
              { event: "deal_screening_cta_click", label: "Screening CTA Clicks", desc: "\"Start screening deals\" clicked", color: "text-emerald-400", border: "border-emerald-500/20" },
              { event: "pricing_page_view", label: "Pricing Page Views", desc: "User visits /pricing", color: "text-violet-400", border: "border-violet-500/20" },
              { event: "pricing_cta_click", label: "Pricing CTA Clicks", desc: "Tier CTA clicked (starter/professional/institutional)", color: "text-amber-400", border: "border-amber-500/20" },
              { event: "home_deal_screening_cta_click", label: "Signups from Funnel", desc: "Deal screening CTA from homepage hero", color: "text-rose-400", border: "border-rose-500/20" },
            ].map((row) => (
              <div key={row.event} className={`rounded-xl border ${row.border} bg-white/[0.02] p-4`}>
                <div className={`text-sm font-semibold ${row.color} mb-1`}>{row.label}</div>
                <div className="text-xs text-slate-500 mb-2 leading-relaxed">{row.desc}</div>
                <code className="text-[10px] font-mono text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded">{row.event}</code>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-600 font-mono">
            All events fire via <code className="text-slate-500">trackEvent()</code> in <code className="text-slate-500">client/src/lib/analytics.ts</code> → Umami custom events API.
          </div>
        </div>

        {/* ── Fleet Status ── */}
        <SlimFleetStatus />

        {/* ── Monte Carlo Parameter Calibration (live) ── */}
        <MCCalibrationWidget isAdmin={user?.role === "admin"} />

      </div>
      </div>
    </MeshSidebar>
  );
}
// ── SlimFleetStatus ──────────────────────────────────────────────────────────
// Active run statuses that warrant live polling
const FLEET_ACTIVE_STATUSES = ["pending", "generating", "researching", "pitching", "evaluating", "extracting"];

type SlimFleetRun = {
  id: number;
  runDate: string;
  status: string;
  totalIdeas: number;
  completed: number;
  fleetMode: string | null;
  startedAt: number | null;
};

function SlimFleetProgressBar({ run }: { run: SlimFleetRun }) {
  const total = run.totalIdeas > 0 ? run.totalIdeas : 1;
  const pct   = Math.min(100, Math.round((run.completed / total) * 100));

  let barColor = "bg-amber-500";
  if (run.status === "completed")                          barColor = "bg-emerald-500";
  else if (run.status === "failed" && run.completed > 0)   barColor = "bg-amber-500";
  else if (pct >= 50)                                      barColor = "bg-sky-500";

  let label: React.ReactNode;
  if (run.status === "pending") {
    label = <span className="text-slate-500">Queued — starting shortly</span>;
  } else if (run.status === "completed") {
    label = <span className="text-emerald-400">{run.completed} / {run.totalIdeas} evaluations complete ✓</span>;
  } else if (run.status === "failed" && run.completed > 0) {
    label = <span className="text-amber-400">{run.completed} / {run.totalIdeas} — partial run ⚠️</span>;
  } else {
    label = <span className="text-slate-300">{run.completed} / {run.totalIdeas} evaluations complete</span>;
  }

  return (
    <div className="mt-1.5">
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${run.status === "pending" ? 0 : pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs">{label}</div>
    </div>
  );
}

function SlimFleetStatus() {
  const runsRaw = trpc.fleet.runs.useQuery(undefined, { refetchInterval: 30000 });
  const cfgRaw  = trpc.fleet.fleetConfigs.useQuery(undefined, { refetchInterval: 30000 });

  const runs = (runsRaw.data ?? []) as SlimFleetRun[];
  const hasActive = runs.some(r => FLEET_ACTIVE_STATUSES.includes(r.status));

  // Latest run per fleet mode
  const latestByMode = useMemo(() => {
    const map: Record<string, SlimFleetRun> = {};
    for (const r of runs) {
      const mode = r.fleetMode ?? "global";
      if (!map[mode]) map[mode] = r;
    }
    return map;
  }, [runs]);

  const cfgs = (cfgRaw.data ?? []) as Array<{ id: number; fleetMode: string; runsRemaining: number; lastRunAt: number | null }>;

  if (runsRaw.isLoading) {
    return (
      <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
        <div className="text-slate-500 text-sm">Loading fleet status…</div>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🗓️</span>
        <h2 className="text-base font-bold text-white">Fleet Status</h2>
        <span className="text-xs text-slate-500">Daily at 06:00 KWT</span>
        {hasActive && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            Live — 30s refresh
          </span>
        )}
      </div>

      {Object.keys(latestByMode).length === 0 ? (
        <div className="text-slate-600 text-sm">No fleet runs found.</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(latestByMode).map(([mode, run]) => {
            const cfg = cfgs.find(c => c.fleetMode === mode);
            const lastRunAt = cfg?.lastRunAt
              ? new Date(cfg.lastRunAt).toLocaleString("en-KW", { timeZone: "Asia/Kuwait", dateStyle: "short", timeStyle: "short" })
              : "—";
            return (
              <div key={mode} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-emerald-400 uppercase text-xs font-semibold">{mode}</span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    {run.status === "completed" ? "✅" : run.status === "failed" ? "❌" : run.status === "pending" ? "⏳" : "🔄"}
                    {" "}{run.status}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">Last: {lastRunAt}</span>
                </div>
                <SlimFleetProgressBar run={run} />
                {cfg && (
                  <div className="mt-2 text-xs text-slate-500">
                    {cfg.runsRemaining} run{cfg.runsRemaining !== 1 ? "s" : ""} remaining in this 30-day cycle
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Monte Carlo Parameter Calibration widget ─────────────────────────────────────────────────────────────────
function MCCalibrationWidget({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = trpc.adminUsage.mcCalibration.useQuery(undefined, {
    enabled: isAdmin,
  });

  return (
    <div className="mt-10 rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-white">Monte Carlo Parameter Calibration</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Avg / Min / Max / Spread for each signal parameter across all deep-mode triage runs.
          Source: <code className="text-slate-400">pitch_triages.monteCarloDealParams</code>.
        </p>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-xs py-4">Loading calibration data…</div>
      ) : !data || data.empty ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center">
          <p className="text-slate-400 text-sm font-medium">No deep mode triages recorded yet.</p>
          <p className="text-slate-600 text-xs mt-1">Run a deep analysis to populate this table.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/8 text-slate-500">
                  <th className="pb-2 pr-6 font-medium">Parameter</th>
                  <th className="pb-2 pr-4 font-medium text-right">Avg</th>
                  <th className="pb-2 pr-4 font-medium text-right">Min</th>
                  <th className="pb-2 pr-4 font-medium text-right">Max</th>
                  <th className="pb-2 font-medium text-right">Spread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.params.map((p) => (
                  <tr key={p.key} className="text-slate-300">
                    <td className="py-2 pr-6 font-medium">{p.label}</td>
                    <td className="py-2 pr-4 text-right font-mono text-teal-400">{p.avg}</td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-500">{p.min}</td>
                    <td className="py-2 pr-4 text-right font-mono text-slate-500">{p.max}</td>
                    <td className="py-2 text-right font-mono"
                      style={{ color: p.spread >= 50 ? "#f87171" : p.spread >= 25 ? "#fbbf24" : "#4ade80" }}>
                      {p.spread}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-xs text-amber-400 font-semibold mb-0.5">Highest spread parameter</div>
              <div className="text-sm text-white font-bold">{data.highestSpread}</div>
              <div className="text-xs text-slate-500 mt-0.5">Most uncertain dimension in your deal flow</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Deep mode triages</div>
                <div className="text-lg font-bold text-teal-400">{data.deepCount}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Quick mode triages</div>
                <div className="text-lg font-bold text-slate-400">{data.quickCount}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline login history expand row ─────────────────────────────────────────────
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
