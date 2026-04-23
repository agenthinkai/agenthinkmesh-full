import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DemoStatus = "new" | "contacted" | "scheduled" | "closed";
type SortDir = "asc" | "desc";

const STATUS_CONFIG: Record<DemoStatus, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  contacted: { label: "Contacted", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  scheduled: { label: "Scheduled", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  closed:    { label: "Closed",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

// ── Calendly base URL — reads from the same constant as the server ────────────
// Update CALENDLY_BASE_URL in server/routers/demo.ts to change this everywhere.
const CALENDLY_BASE_URL = "https://calendly.com/farouqsultan/30min";
function buildCalendlyLink(name: string, email: string): string {
  return `${CALENDLY_BASE_URL}?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Returns days elapsed since ts (floored). 0 = today. */
function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function daysSinceLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as DemoStatus] ?? { label: status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 9999,
      fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
type DemoRow = {
  id: number; name: string; institution: string; email: string;
  useCase: string; status: string; notes: string | null;
  followUpSentAt: number | null; createdAt: number; updatedAt: number;
};

type EmailLogRow = {
  id: number; recipientName: string; institution: string; email: string;
  statusAtSend: string; sentAt: number;
};

function escapeCsv(v: string | null | undefined): string {
  const s = v ?? "";
  return (s.includes(",") || s.includes('"') || s.includes("\n"))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportRequestsCsv(rows: DemoRow[]) {
  const headers = ["Name", "Institution", "Email", "Use Case", "Status", "Notes", "Last Follow-up", "Days Since Last Contact", "Date Submitted", "Last Updated"];
  downloadCsv(
    `demo-requests-${new Date().toISOString().slice(0, 10)}.csv`,
    headers,
    rows.map((r) => {
      const contactTs = r.followUpSentAt ?? r.createdAt;
      return [
        escapeCsv(r.name), escapeCsv(r.institution), escapeCsv(r.email),
        escapeCsv(r.useCase), escapeCsv(r.status), escapeCsv(r.notes),
        escapeCsv(r.followUpSentAt ? formatDateTime(r.followUpSentAt) : "—"),
        escapeCsv(daysSinceLabel(daysSince(contactTs))),
        escapeCsv(formatDate(r.createdAt)), escapeCsv(formatDate(r.updatedAt)),
      ];
    })
  );
}

function exportEmailLogCsv(rows: EmailLogRow[]) {
  const headers = ["Recipient Name", "Institution", "Email", "Status at Send", "Sent At"];
  downloadCsv(
    `email-log-${new Date().toISOString().slice(0, 10)}.csv`,
    headers,
    rows.map((r) => [
      escapeCsv(r.recipientName), escapeCsv(r.institution), escapeCsv(r.email),
      escapeCsv(r.statusAtSend), escapeCsv(formatDateTime(r.sentAt)),
    ])
  );
}

// ── Shared cell / header styles ───────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "12px 14px", textAlign: "left", color: "#64748b",
  fontWeight: 600, fontSize: 11, textTransform: "uppercase",
  letterSpacing: "0.06em", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "13px 14px" };

// ── Sortable column header ────────────────────────────────────────────────────
function SortTh({
  label, sortKey, currentKey, dir, onSort,
}: {
  label: string; sortKey: string; currentKey: string; dir: SortDir;
  onSort: (key: string) => void;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(sortKey)}
    >
      {label}{" "}
      <span style={{ color: active ? "#10b981" : "#334155", fontSize: 10 }}>
        {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDemoRequests() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // Tab state
  const [activeTab, setActiveTab] = useState<"requests" | "emailLog">("requests");

  // Requests tab state
  const [updatingId, setUpdatingId]               = useState<number | null>(null);
  const [notesMap, setNotesMap]                   = useState<Record<number, string>>({});
  const [savingNotesId, setSavingNotesId]         = useState<number | null>(null);
  const [sendingFollowUpId, setSendingFollowUpId] = useState<number | null>(null);
  const [exportReqLabel, setExportReqLabel]       = useState("Export CSV");
  const [exportLogLabel, setExportLogLabel]       = useState("Export Email Log");

  // Sort state for Requests table — default: days since last contact desc (stalest first)
  const [sortKey, setSortKey]   = useState<string>("daysSince");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");

  // 48h warning dialog state
  const [warnDialog, setWarnDialog] = useState<{
    open: boolean; id: number; hoursAgo: number;
  }>({ open: false, id: 0, hoursAgo: 0 });

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: requests, isLoading: reqLoading, refetch: refetchRequests } =
    trpc.demo.list.useQuery(undefined, { enabled: !!user && user.role === "admin" });

  const { data: emailLogData, isLoading: logLoading, refetch: refetchLog } =
    trpc.demo.emailLog.useQuery(undefined, { enabled: !!user && user.role === "admin" });

  // ── Sorted requests ───────────────────────────────────────────────────────
  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    const arr = [...requests];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "daysSince") {
        va = daysSince(a.followUpSentAt ?? a.createdAt);
        vb = daysSince(b.followUpSentAt ?? b.createdAt);
      } else if (sortKey === "createdAt") {
        va = a.createdAt; vb = b.createdAt;
      } else {
        va = a.createdAt; vb = b.createdAt;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [requests, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateStatus = trpc.demo.updateStatus.useMutation({
    onSuccess: () => { refetchRequests(); toast.success("Status updated"); },
    onError: (err) => toast.error(err.message ?? "Failed to update status"),
    onSettled: () => setUpdatingId(null),
  });

  const saveNotes = trpc.demo.saveNotes.useMutation({
    onSuccess: () => toast.success("Notes saved"),
    onError: (err) => toast.error(err.message ?? "Failed to save notes"),
    onSettled: () => setSavingNotesId(null),
  });

  const sendFollowUp = trpc.demo.sendFollowUp.useMutation({
    onSuccess: (data) => {
      setSendingFollowUpId(null);
      if (data.cooldownWarning) {
        setWarnDialog({ open: true, id: warnDialog.id, hoursAgo: data.hoursAgo });
        return;
      }
      toast.success("Follow-up email sent");
      refetchRequests();
      refetchLog();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to send follow-up email");
      setSendingFollowUpId(null);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = (id: number, status: DemoStatus) => {
    setUpdatingId(id);
    updateStatus.mutate({ id, status });
  };

  const handleNotesSave = (id: number, currentDbNotes: string | null) => {
    const local = notesMap[id];
    if (local === undefined || local === (currentDbNotes ?? "")) return;
    setSavingNotesId(id);
    saveNotes.mutate({ id, notes: local });
  };

  const handleSendFollowUp = (id: number, force = false) => {
    setSendingFollowUpId(id);
    setWarnDialog((prev) => ({ ...prev, id }));
    sendFollowUp.mutate({ id, force });
  };

  const handleConfirmResend = () => {
    setWarnDialog((prev) => ({ ...prev, open: false }));
    handleSendFollowUp(warnDialog.id, true);
  };

  const handleExportRequests = () => {
    if (!requests?.length) { toast.error("No requests to export"); return; }
    exportRequestsCsv(requests as DemoRow[]);
    const count = requests.length;
    setExportReqLabel(`✓ Exported ${count} row${count !== 1 ? "s" : ""}`);
    setTimeout(() => setExportReqLabel("Export CSV"), 3000);
  };

  const handleExportEmailLog = () => {
    if (!emailLogData?.length) { toast.error("No email log entries to export"); return; }
    exportEmailLogCsv(emailLogData as EmailLogRow[]);
    const count = emailLogData.length;
    setExportLogLabel(`✓ Exported ${count} row${count !== 1 ? "s" : ""}`);
    setTimeout(() => setExportLogLabel("Export Email Log"), 3000);
  };

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (loading) {
    return <DashboardLayout><div style={{ padding: 40, color: "#94a3b8", fontSize: 14 }}>Loading…</div></DashboardLayout>;
  }
  if (!user || user.role !== "admin") { navigate("/ask"); return null; }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div style={{ minHeight: "100vh", background: "#0a0f1e", padding: "32px 40px", color: "#e2e8f0" }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Demo Requests</h1>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              All inbound demo requests — sorted by most recent.
            </p>
          </div>
          {/* Export button — context-aware per tab */}
          {activeTab === "requests" && (
            <ExportButton label={exportReqLabel} disabled={!requests?.length} onClick={handleExportRequests} />
          )}
          {activeTab === "emailLog" && (
            <ExportButton label={exportLogLabel} disabled={!emailLogData?.length} onClick={handleExportEmailLog} />
          )}
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        {requests && (
          <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
            {(["new", "contacted", "scheduled", "closed"] as DemoStatus[]).map((s) => {
              const count = requests.filter((r) => r.status === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <div key={s} style={{ background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 10, padding: "10px 18px", minWidth: 90 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color }}>{count}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</div>
                </div>
              );
            })}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 18px", minWidth: 90 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>{requests.length}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</div>
            </div>
            {/* Stale leads counter */}
            {(() => {
              const stale = requests.filter((r) => daysSince(r.followUpSentAt ?? r.createdAt) > 7).length;
              return stale > 0 ? (
                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "10px 18px", minWidth: 90 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{stale}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Stale &gt;7d</div>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 0, marginBottom: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["requests", "emailLog"] as const).map((tab) => {
            const label = tab === "requests" ? "Requests" : "Email Log";
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "10px 20px", fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? "#10b981" : "#64748b",
                  background: "transparent", border: "none",
                  borderBottom: active ? "2px solid #10b981" : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                }}
              >
                {label}
                {tab === "emailLog" && emailLogData && emailLogData.length > 0 && (
                  <span style={{
                    marginLeft: 6, background: "rgba(16,185,129,0.15)", color: "#10b981",
                    fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 9999,
                  }}>
                    {emailLogData.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Requests tab ────────────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
            {reqLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading requests…</div>
            ) : !sortedRequests.length ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b", fontSize: 14 }}>
                No demo requests yet. They will appear here when submitted from the landing page.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Institution</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Use Case</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Notes</th>
                      <th style={thStyle}>Last follow-up</th>
                      {/* Sortable column */}
                      <SortTh
                        label="Days since contact"
                        sortKey="daysSince"
                        currentKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <th style={thStyle}>Actions</th>
                      <SortTh
                        label="Date"
                        sortKey="createdAt"
                        currentKey={sortKey}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRequests.map((req, idx) => {
                      const contactTs = req.followUpSentAt ?? req.createdAt;
                      const days = daysSince(contactTs);
                      const isStale = days > 7;
                      const rowBg = isStale ? "rgba(245,158,11,0.04)" : "transparent";
                      return (
                        <tr
                          key={req.id}
                          style={{
                            borderBottom: idx < sortedRequests.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            background: rowBg,
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background = isStale
                              ? "rgba(245,158,11,0.09)"
                              : "rgba(255,255,255,0.03)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLTableRowElement).style.background = rowBg;
                          }}
                        >
                          {/* Name */}
                          <td style={{ ...tdStyle, color: "#f1f5f9", fontWeight: 500, whiteSpace: "nowrap" }}>{req.name}</td>
                          {/* Institution */}
                          <td style={{ ...tdStyle, color: "#cbd5e1", whiteSpace: "nowrap" }}>{req.institution}</td>
                          {/* Email */}
                          <td style={tdStyle}>
                            <a href={`mailto:${req.email}`} style={{ color: "#10b981", textDecoration: "none", fontSize: 12 }}>{req.email}</a>
                          </td>
                          {/* Use Case */}
                          <td style={{ ...tdStyle, color: "#94a3b8", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={req.useCase}>
                            {req.useCase}
                          </td>
                          {/* Status */}
                          <td style={tdStyle}>
                            <Select value={req.status} onValueChange={(v) => handleStatusChange(req.id, v as DemoStatus)} disabled={updatingId === req.id}>
                              <SelectTrigger style={{ background: "transparent", border: "none", padding: 0, height: "auto", width: "auto", boxShadow: "none", cursor: "pointer" }}>
                                <SelectValue><StatusBadge status={req.status} /></SelectValue>
                              </SelectTrigger>
                              <SelectContent style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>
                                {(["new", "contacted", "scheduled", "closed"] as DemoStatus[]).map((s) => (
                                  <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {/* Notes */}
                          <td style={{ ...tdStyle, minWidth: 160 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                              <textarea
                                rows={2}
                                value={notesMap[req.id] !== undefined ? notesMap[req.id] : (req.notes ?? "")}
                                placeholder="Add notes…"
                                onChange={(e) => setNotesMap((p) => ({ ...p, [req.id]: e.target.value }))}
                                onBlur={() => handleNotesSave(req.id, req.notes ?? null)}
                                style={{
                                  flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                                  borderRadius: 6, color: "#cbd5e1", fontSize: 12, padding: "6px 8px",
                                  resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, minWidth: 130,
                                }}
                              />
                              {savingNotesId === req.id && <span style={{ color: "#10b981", fontSize: 11, paddingTop: 4 }}>Saving…</span>}
                            </div>
                          </td>
                          {/* Last follow-up */}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            {req.followUpSentAt ? (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>{formatDateTime(req.followUpSentAt)}</span>
                            ) : (
                              <span style={{ color: "#334155", fontSize: 12 }}>—</span>
                            )}
                          </td>
                          {/* Days since last contact */}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <span style={{
                              fontSize: 12, fontWeight: isStale ? 600 : 400,
                              color: isStale ? "#f59e0b" : days === 0 ? "#10b981" : "#94a3b8",
                            }}>
                              {isStale && <span style={{ marginRight: 4 }}>⚠</span>}
                              {daysSinceLabel(days)}
                            </span>
                          </td>
                          {/* Actions */}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <button
                                onClick={() => handleSendFollowUp(req.id)}
                                disabled={sendingFollowUpId === req.id}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  color: sendingFollowUpId === req.id ? "#64748b" : "#f59e0b",
                                  fontSize: 12, fontWeight: 500, padding: "4px 10px",
                                  border: `1px solid ${sendingFollowUpId === req.id ? "rgba(100,116,139,0.3)" : "rgba(245,158,11,0.3)"}`,
                                  borderRadius: 6,
                                  background: sendingFollowUpId === req.id ? "rgba(100,116,139,0.06)" : "rgba(245,158,11,0.06)",
                                  cursor: sendingFollowUpId === req.id ? "not-allowed" : "pointer",
                                  transition: "all 0.15s", whiteSpace: "nowrap",
                                }}
                              >
                                {sendingFollowUpId === req.id ? "Sending…" : "✉ Follow up"}
                              </button>
                              <a
                                href={buildCalendlyLink(req.name, req.email)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  color: "#10b981", fontSize: 12, fontWeight: 500, textDecoration: "none",
                                  padding: "4px 10px", border: "1px solid rgba(16,185,129,0.3)",
                                  borderRadius: 6, background: "rgba(16,185,129,0.06)",
                                  transition: "background 0.15s", whiteSpace: "nowrap",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.14)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(16,185,129,0.06)"; }}
                              >
                                📅 Schedule
                              </a>
                            </div>
                          </td>
                          {/* Date */}
                          <td style={{ ...tdStyle, color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>{formatDate(req.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Email Log tab ────────────────────────────────────────────────── */}
        {activeTab === "emailLog" && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
            {logLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading email log…</div>
            ) : !emailLogData?.length ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b", fontSize: 14 }}>
                No follow-up emails sent yet. Use the "✉ Follow up" button on the Requests tab to send one.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {["Recipient", "Institution", "Email", "Status at send", "Sent at"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogData.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        style={{ borderBottom: idx < emailLogData.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", transition: "background 0.15s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                      >
                        <td style={{ ...tdStyle, color: "#f1f5f9", fontWeight: 500, whiteSpace: "nowrap" }}>{entry.recipientName}</td>
                        <td style={{ ...tdStyle, color: "#cbd5e1", whiteSpace: "nowrap" }}>{entry.institution}</td>
                        <td style={tdStyle}>
                          <a href={`mailto:${entry.email}`} style={{ color: "#10b981", textDecoration: "none", fontSize: 12 }}>{entry.email}</a>
                        </td>
                        <td style={tdStyle}><StatusBadge status={entry.statusAtSend} /></td>
                        <td style={{ ...tdStyle, color: "#94a3b8", whiteSpace: "nowrap", fontSize: 12 }}>{formatDateTime(entry.sentAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Footer note ──────────────────────────────────────────────────── */}
        <p style={{ fontSize: 11, color: "#334155", marginTop: 16 }}>
          Updated {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          {" · "}Follow-up emails sent from farouq@agenthink.ai, CC'd to farouq@agenthink.ai.
          {" · "}A 48-hour cooldown prevents accidental double-sends.
          {" · "}Rows highlighted in amber have had no contact in over 7 days.
        </p>

        {/* ── 48h warning confirmation dialog ─────────────────────────────── */}
        <Dialog open={warnDialog.open} onOpenChange={(open) => setWarnDialog((p) => ({ ...p, open }))}>
          <DialogContent style={{ background: "#0f172a", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, maxWidth: 440 }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#f59e0b", fontSize: 16, fontWeight: 700 }}>
                ⚠ Follow-up already sent
              </DialogTitle>
            </DialogHeader>
            <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, margin: "8px 0 4px" }}>
              A follow-up was already sent to this person{" "}
              <strong style={{ color: "#f1f5f9" }}>{warnDialog.hoursAgo} hour{warnDialog.hoursAgo !== 1 ? "s" : ""} ago</strong>.
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 4px" }}>
              The recommended cadence for institutional contacts is one follow-up per 48 hours. Sending again so soon may come across as pushy. Are you sure you want to send another follow-up now?
            </p>
            <DialogFooter style={{ gap: 8, marginTop: 8 }}>
              <Button
                variant="outline"
                onClick={() => setWarnDialog((p) => ({ ...p, open: false }))}
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "#94a3b8", background: "transparent" }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmResend}
                style={{ background: "#f59e0b", color: "#0a0f1e", fontWeight: 600, border: "none" }}
              >
                Send anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}

// ── Small export button component ─────────────────────────────────────────────
function ExportButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  const done = label.startsWith("✓");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: done ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)",
        border: done ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8, color: done ? "#10b981" : "#94a3b8",
        fontSize: 13, fontWeight: 500, padding: "8px 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      ⬇ {label}
    </button>
  );
}
