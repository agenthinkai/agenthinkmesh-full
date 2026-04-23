import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type DemoStatus = "new" | "contacted" | "scheduled" | "closed";

const STATUS_CONFIG: Record<DemoStatus, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  contacted: { label: "Contacted", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  scheduled: { label: "Scheduled", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  closed:    { label: "Closed",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as DemoStatus] ?? { label: status, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

export default function AdminDemoRequests() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data: requests, isLoading, refetch } = trpc.demo.list.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const updateStatus = trpc.demo.updateStatus.useMutation({
    onMutate: () => {},
    onSuccess: () => {
      refetch();
      toast.success("Status updated");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to update status");
    },
    onSettled: () => setUpdatingId(null),
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ padding: 40, color: "#94a3b8", fontSize: 14 }}>Loading…</div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== "admin") {
    navigate("/ask");
    return null;
  }

  const handleStatusChange = (id: number, status: DemoStatus) => {
    setUpdatingId(id);
    updateStatus.mutate({ id, status });
  };

  return (
    <DashboardLayout>
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0f1e",
          padding: "32px 40px",
          color: "#e2e8f0",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
            Demo Requests
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
            All inbound demo requests — sorted by most recent. Update status inline.
          </p>
        </div>

        {/* Stats strip */}
        {requests && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            {(["new", "contacted", "scheduled", "closed"] as DemoStatus[]).map((s) => {
              const count = requests.filter((r) => r.status === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <div
                  key={s}
                  style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.color}33`,
                    borderRadius: 10,
                    padding: "10px 18px",
                    minWidth: 100,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color }}>{count}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {cfg.label}
                  </div>
                </div>
              );
            })}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 18px",
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>{requests.length}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</div>
            </div>
          </div>
        )}

        {/* Table */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {isLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>
              Loading requests…
            </div>
          ) : !requests || requests.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#64748b", fontSize: 14 }}>
              No demo requests yet. They will appear here when submitted from the landing page.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Name", "Institution", "Email", "Use Case", "Status", "Date"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          color: "#64748b",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, idx) => (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: idx < requests.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.03)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                      }}
                    >
                      {/* Name */}
                      <td style={{ padding: "14px 16px", color: "#f1f5f9", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {req.name}
                      </td>
                      {/* Institution */}
                      <td style={{ padding: "14px 16px", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        {req.institution}
                      </td>
                      {/* Email */}
                      <td style={{ padding: "14px 16px" }}>
                        <a
                          href={`mailto:${req.email}`}
                          style={{ color: "#10b981", textDecoration: "none", fontSize: 12 }}
                        >
                          {req.email}
                        </a>
                      </td>
                      {/* Use Case */}
                      <td
                        style={{
                          padding: "14px 16px",
                          color: "#94a3b8",
                          maxWidth: 280,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={req.useCase}
                      >
                        {req.useCase}
                      </td>
                      {/* Status — inline dropdown */}
                      <td style={{ padding: "14px 16px" }}>
                        <Select
                          value={req.status}
                          onValueChange={(val) => handleStatusChange(req.id, val as DemoStatus)}
                          disabled={updatingId === req.id}
                        >
                          <SelectTrigger
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              height: "auto",
                              width: "auto",
                              boxShadow: "none",
                              cursor: "pointer",
                            }}
                          >
                            <SelectValue>
                              <StatusBadge status={req.status} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent
                            style={{
                              background: "#0f172a",
                              border: "1px solid rgba(255,255,255,0.1)",
                            }}
                          >
                            {(["new", "contacted", "scheduled", "closed"] as DemoStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                <StatusBadge status={s} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* Date */}
                      <td style={{ padding: "14px 16px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                        {formatDate(req.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: "#334155", marginTop: 16 }}>
          Updated {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          {" · "}Status changes are saved immediately and reflected in the pipeline view above.
        </p>
      </div>
    </DashboardLayout>
  );
}
