/**
 * Tracker.tsx — Email Reply Tracker Dashboard
 *
 * Tracks replies to 839+ outbound PE/VC outreach emails across 11 global markets.
 * Integrates with Gmail via OAuth to auto-detect replies every 30 minutes.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  no_response: { label: "No Response", color: "#64748b", bg: "bg-slate-700", text: "text-slate-300" },
  new_reply: { label: "New Reply", color: "#3b82f6", bg: "bg-blue-600", text: "text-blue-100" },
  interested: { label: "Interested", color: "#10b981", bg: "bg-emerald-600", text: "text-emerald-100" },
  meeting_booked: { label: "Meeting Booked", color: "#f59e0b", bg: "bg-amber-600", text: "text-amber-100" },
  pilot_started: { label: "Pilot Started", color: "#8b5cf6", bg: "bg-violet-600", text: "text-violet-100" },
  not_interested: { label: "Not Interested", color: "#ef4444", bg: "bg-red-700", text: "text-red-100" },
} as const;

type ReplyStatus = keyof typeof STATUS_CONFIG;

const MARKET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#14b8a6", "#a855f7",
];

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ReplyStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.no_response;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#0f1629] border border-white/10 rounded-xl p-5">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Tracker() {
  const [statusFilter, setStatusFilter] = useState<ReplyStatus | "">("");
  const [marketFilter, setMarketFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<ReplyStatus>("no_response");

  // Query params
  const emailsQuery = trpc.tracker.getEmails.useQuery(
    {
      page,
      limit: 50,
      status: statusFilter || undefined,
      market: marketFilter || undefined,
      search: searchQuery || undefined,
      followUpOnly: followUpOnly || undefined,
    },
    { refetchInterval: 60_000 }
  );

  const statsQuery = trpc.tracker.getStats.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const gmailStatusQuery = trpc.tracker.getGmailStatus.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const syncLogQuery = trpc.tracker.getSyncLog.useQuery();

  const utils = trpc.useUtils();

  // Mutations
  const updateStatusMutation = trpc.tracker.updateStatus.useMutation({
    onSuccess: () => {
      utils.tracker.getEmails.invalidate();
      utils.tracker.getStats.invalidate();
      setEditingId(null);
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const triggerSyncMutation = trpc.tracker.triggerSync.useMutation({
    onSuccess: () => {
      toast.success("Sync started — Gmail sync running in background. Refresh in a minute.");
      setTimeout(() => {
        utils.tracker.getEmails.invalidate();
        utils.tracker.getStats.invalidate();
        syncLogQuery.refetch();
      }, 5000);
    },
    onError: (err) => toast.error(`Sync failed: ${err.message}`),
  });

  // Gmail auth URL
  const gmailAuthUrlQuery = trpc.tracker.getGmailAuthUrl.useQuery(
    { origin: typeof window !== "undefined" ? window.location.origin : "" },
    { enabled: gmailStatusQuery.data?.connected === false }
  );

  // Handle URL params (after OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected")) {
      toast.success("Gmail connected! farouqsultan@gmail.com is now connected. Initial sync running.");
      window.history.replaceState({}, "", "/tracker");
      gmailStatusQuery.refetch();
    }
    if (params.get("gmail_error")) {
      toast.error(`Gmail connection failed: ${decodeURIComponent(params.get("gmail_error") || "")}`);
      window.history.replaceState({}, "", "/tracker");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = statsQuery.data;
  const emails = emailsQuery.data?.emails || [];
  const totalEmails = emailsQuery.data?.total || 0;
  const totalPages = Math.ceil(totalEmails / 50);
  const gmailConnected = gmailStatusQuery.data?.connected;

  // Market chart data
  const marketData = (stats?.byMarket || []).map((m, i) => ({
    name: m.market.replace("/", "/\n"),
    total: Number(m.total),
    replied: Number(m.replied),
    color: MARKET_COLORS[i % MARKET_COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-[#080d1a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0a1020]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Email Reply Tracker</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracking {stats?.total ?? 839} outbound PE/VC outreach emails across 11 global markets
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Gmail connection status */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${gmailConnected ? "bg-emerald-400" : "bg-red-400"}`}
              />
              <span className="text-xs text-slate-400">
                {gmailConnected ? "Gmail connected" : "Gmail not connected"}
              </span>
            </div>

            {gmailConnected ? (
              <button
                onClick={() => triggerSyncMutation.mutate()}
                disabled={triggerSyncMutation.isPending}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {triggerSyncMutation.isPending ? "Syncing..." : "Sync Now"}
              </button>
            ) : (
              <a
                href={gmailAuthUrlQuery.data?.url || `/api/gmail/auth?origin=${encodeURIComponent(window.location.origin)}`}
                className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Connect Gmail
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Total Sent"
            value={stats?.total ?? 839}
            sub="Across 11 markets"
          />
          <StatCard
            label="Replied"
            value={stats?.replied ?? 0}
            sub={`${stats?.replyRate ?? 0}% reply rate`}
            accent="text-emerald-400"
          />
          <StatCard
            label="Interested"
            value={(stats?.byStatus.interested ?? 0) + (stats?.byStatus.meeting_booked ?? 0) + (stats?.byStatus.pilot_started ?? 0)}
            sub="Interested + Meeting + Pilot"
            accent="text-amber-400"
          />
          <StatCard
            label="New Replies"
            value={stats?.byStatus.new_reply ?? 0}
            sub="Awaiting review"
            accent="text-blue-400"
          />
          <StatCard
            label="Follow-up Due"
            value={stats?.followUpDue ?? 0}
            sub="6+ weeks no response"
            accent={stats?.followUpDue ? "text-red-400" : "text-slate-400"}
          />
        </div>

        {/* Status breakdown pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => {
                setStatusFilter(statusFilter === key ? "" : (key as ReplyStatus));
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                statusFilter === key
                  ? `${cfg.bg} ${cfg.text} border-transparent`
                  : "border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              {cfg.label}
              <span className="opacity-70">
                {stats?.byStatus[key as ReplyStatus] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Market Bar Chart */}
        {marketData.length > 0 && (
          <div className="bg-[#0f1629] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Reply Rate by Market</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={marketData} barGap={2} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "#0f1629", border: "1px solid #1e293b", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                  itemStyle={{ color: "#94a3b8" }}
                />
                <Bar dataKey="total" name="Total Sent" fill="#1e293b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replied" name="Replied" radius={[4, 4, 0, 0]}>
                  {marketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, email, firm..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="flex-1 min-w-[200px] bg-[#0f1629] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={marketFilter}
            onChange={(e) => { setMarketFilter(e.target.value); setPage(1); }}
            className="bg-[#0f1629] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Markets</option>
            {(stats?.byMarket || []).map((m) => (
              <option key={m.market} value={m.market}>{m.market}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => { setFollowUpOnly(e.target.checked); setPage(1); }}
              className="rounded"
            />
            Follow-up due only
          </label>
          <span className="text-xs text-slate-500 ml-auto">
            {totalEmails} results
          </span>
        </div>

        {/* Emails Table */}
        <div className="bg-[#0f1629] border border-white/10 rounded-xl overflow-hidden">
          {emailsQuery.isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading emails...</div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">No emails found</p>
              {!stats?.total && (
                <p className="text-slate-500 text-xs mt-2">
                  Seed the database with your outbound emails to get started.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-[#0a1020]">
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Recipient</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Firm</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Market</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Sent</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => (
                    <tr
                      key={email.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        email.followUpDue ? "bg-red-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{email.recipientName}</div>
                        <div className="text-xs text-slate-500">{email.recipientEmail}</div>
                        {email.followUpDue && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            Follow-up due
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        <div>{email.recipientFirm || "—"}</div>
                        {email.recipientRole && (
                          <div className="text-slate-500">{email.recipientRole}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-300">{email.market}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(email.sentAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {email.firstRepliedAt && (
                          <div className="text-emerald-500 mt-0.5">
                            Replied {new Date(email.firstRepliedAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === email.id ? (
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as ReplyStatus)}
                            className="bg-[#0a1020] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none"
                            autoFocus
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.label}</option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={email.replyStatus as ReplyStatus} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === email.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                updateStatusMutation.mutate({ id: email.id, status: editStatus })
                              }
                              disabled={updateStatusMutation.isPending}
                              className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(email.id);
                              setEditStatus(email.replyStatus as ReplyStatus);
                            }}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Gmail Sync Log */}
        <div className="bg-[#0f1629] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Gmail Sync History</h2>
          {syncLogQuery.isLoading ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : !syncLogQuery.data?.length ? (
            <p className="text-xs text-slate-500">
              {gmailConnected
                ? "No sync runs yet. Click \"Sync Now\" to start."
                : "Connect Gmail to enable automatic reply detection."}
            </p>
          ) : (
            <div className="space-y-2">
              {syncLogQuery.data.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-4 text-xs text-slate-400"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      log.status === "success"
                        ? "bg-emerald-400"
                        : log.status === "error"
                        ? "bg-red-400"
                        : "bg-amber-400 animate-pulse"
                    }`}
                  />
                  <span className="text-slate-300">
                    {new Date(log.startedAt).toLocaleString()}
                  </span>
                  <span>Scanned: {log.messagesScanned}</span>
                  <span className="text-emerald-400">New: {log.newRepliesFound}</span>
                  {log.errorMessage && (
                    <span className="text-red-400 truncate max-w-[300px]">{log.errorMessage}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gmail Setup Instructions (if not connected) */}
        {!gmailConnected && (
          <div className="bg-[#0f1629] border border-amber-500/30 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-amber-400 mb-2">
              Connect Gmail to Enable Automatic Reply Tracking
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Connect <strong className="text-white">farouqsultan@gmail.com</strong> to automatically detect
              replies to your 839 outbound emails. The system polls Gmail every 30 minutes.
            </p>
            <div className="text-xs text-slate-500 space-y-1 mb-4">
              <p>1. You need to set up Gmail OAuth credentials first (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI)</p>
              <p>2. Click "Connect Gmail" to authorize access to farouqsultan@gmail.com</p>
              <p>3. The system will automatically sync every 30 minutes — no Manus credits used</p>
            </div>
            <a
              href={`/api/gmail/auth?origin=${encodeURIComponent(window.location.origin)}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
            >
              Connect Gmail →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
