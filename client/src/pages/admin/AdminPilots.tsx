/**
 * AdminPilots — Customer Success Dashboard at /admin/pilots
 * Shows the conversion funnel, all active pilots, usage, and PDF export.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type PilotStatus = "INVITED" | "ACTIVE" | "COMPLETED" | "CONVERTED" | "CHURNED";

const STATUS_CONFIG: Record<PilotStatus, { label: string; color: string; bg: string }> = {
  INVITED:   { label: "Invited",   color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  ACTIVE:    { label: "Active",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  COMPLETED: { label: "Completed", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  CONVERTED: { label: "Converted", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  CHURNED:   { label: "Churned",   color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

function formatDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: PilotStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.INVITED;
  return (
    <span style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.color}40`,
      borderRadius: 6, padding: "2px 10px",
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
    }}>
      {c.label}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12,
      padding: "20px 24px",
    }}>
      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ?? "#f1f5f9" }}>{value}</div>
      {sub && <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Create Pilot Dialog ───────────────────────────────────────────────────────
function CreatePilotDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string, token: string) => void;
}) {
  const [form, setForm] = useState({
    orgName: "", contactName: "", contactEmail: "", contactTitle: "",
    councilMode: "infrastructure", maxEvaluations: 10, expiresInDays: 30, notes: "",
  });

  const createMutation = trpc.pilotConversion.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Pilot created for ${form.orgName}`);
      onCreated(data.slug, data.accessToken);
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const field = (key: keyof typeof form) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: typeof form[key] === "number" ? Number(e.target.value) : e.target.value })),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0f172a", border: "1px solid #334155",
    borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13,
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ background: "#0a0f1a", border: "1px solid #1e293b", maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#f1f5f9" }}>Create New Pilot</DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Organisation Name *</label>
              <input style={inputStyle} placeholder="e.g. National Bank of Kuwait" {...field("orgName")} />
            </div>
            <div>
              <label style={labelStyle}>Contact Name *</label>
              <input style={inputStyle} placeholder="e.g. Ahmed Al-Rashid" {...field("contactName")} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Contact Email *</label>
              <input style={inputStyle} type="email" placeholder="ahmed@nbk.com" {...field("contactEmail")} />
            </div>
            <div>
              <label style={labelStyle}>Contact Title</label>
              <input style={inputStyle} placeholder="e.g. Head of Infrastructure" {...field("contactTitle")} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Council Mode</label>
              <select style={inputStyle} {...field("councilMode")}>
                <option value="infrastructure">Infrastructure</option>
                <option value="venture_capital">Venture Capital</option>
                <option value="private_equity">Private Equity</option>
                <option value="real_estate">Real Estate</option>
                <option value="sovereign_wealth">Sovereign Wealth</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Max Evaluations</label>
              <input style={inputStyle} type="number" min={1} max={100} {...field("maxEvaluations")} />
            </div>
            <div>
              <label style={labelStyle}>Expires (days)</label>
              <input style={inputStyle} type="number" min={1} max={365} {...field("expiresInDays")} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              placeholder="Internal notes about this pilot…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" style={{ borderColor: "#334155", color: "#94a3b8" }} onClick={onClose}>
            Cancel
          </Button>
          <Button
            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff", fontWeight: 700 }}
            disabled={!form.orgName || !form.contactName || !form.contactEmail || createMutation.isPending}
            onClick={() => createMutation.mutate(form)}
          >
            {createMutation.isPending ? "Creating…" : "Create Pilot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pilot Detail Dialog ───────────────────────────────────────────────────────
function PilotDetailDialog({ pilotId, onClose }: { pilotId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.pilotConversion.get.useQuery({ id: pilotId });
  const updateMutation = trpc.pilotConversion.update.useMutation({
    onSuccess: () => toast.success("Pilot updated"),
    onError: (e) => toast.error(e.message),
  });

  const utils = trpc.useUtils();

  if (isLoading || !data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent style={{ background: "#0a0f1a", border: "1px solid #1e293b" }}>
          <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>Loading…</div>
        </DialogContent>
      </Dialog>
    );
  }

  const { pilot, usage, breakdown } = data;

  function handleStatusChange(status: PilotStatus) {
    updateMutation.mutate({ id: pilot.id, status }, {
      onSuccess: () => {
        utils.pilotConversion.list.invalidate();
        utils.pilotConversion.funnelMetrics.invalidate();
      },
    });
  }

  const pilotUrl = `${window.location.origin}/pilot/${pilot.pilotSlug}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{ background: "#0a0f1a", border: "1px solid #1e293b", maxWidth: 640 }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
            {pilot.orgName}
            <StatusBadge status={pilot.status as PilotStatus} />
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0" }}>
          {/* Contact */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Contact</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "#64748b" }}>Name: </span><span style={{ color: "#e2e8f0" }}>{pilot.contactName}</span></div>
              <div><span style={{ color: "#64748b" }}>Email: </span><span style={{ color: "#e2e8f0" }}>{pilot.contactEmail}</span></div>
              {pilot.contactTitle && <div><span style={{ color: "#64748b" }}>Title: </span><span style={{ color: "#e2e8f0" }}>{pilot.contactTitle}</span></div>}
              <div><span style={{ color: "#64748b" }}>Mode: </span><span style={{ color: "#e2e8f0", textTransform: "capitalize" }}>{pilot.councilMode.replace(/_/g, " ")}</span></div>
            </div>
          </div>

          {/* Usage breakdown */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Usage</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {Object.entries(breakdown).map(([type, count]) => (
                <div key={type} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>{count}</div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {type.replace(/_/g, " ")}
                  </div>
                </div>
              ))}
              {Object.keys(breakdown).length === 0 && (
                <div style={{ color: "#475569", fontSize: 13, gridColumn: "1/-1" }}>No activity yet</div>
              )}
            </div>
          </div>

          {/* Pilot URL */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Pilot URL</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ flex: 1, background: "#1e293b", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#94a3b8", wordBreak: "break-all" }}>
                {pilotUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                style={{ borderColor: "#334155", color: "#94a3b8", whiteSpace: "nowrap" }}
                onClick={() => { navigator.clipboard.writeText(pilotUrl); toast.success("Copied!"); }}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Status actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["INVITED","ACTIVE","COMPLETED","CONVERTED","CHURNED"] as PilotStatus[])
              .filter(s => s !== pilot.status)
              .map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  style={{ borderColor: STATUS_CONFIG[s].color + "40", color: STATUS_CONFIG[s].color, fontSize: 11 }}
                  onClick={() => handleStatusChange(s)}
                  disabled={updateMutation.isPending}
                >
                  Mark {STATUS_CONFIG[s].label}
                </Button>
              ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" style={{ borderColor: "#334155", color: "#94a3b8" }} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPilots() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<"ALL" | PilotStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPilotId, setSelectedPilotId] = useState<number | null>(null);
  const [newPilotInfo, setNewPilotInfo] = useState<{ slug: string; token: string } | null>(null);

  const { data: listData, isLoading: listLoading } = trpc.pilotConversion.list.useQuery({
    status: statusFilter,
    limit: 50,
    offset: 0,
  });

  const { data: funnel } = trpc.pilotConversion.funnelMetrics.useQuery();

  if (authLoading) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  const pilots = listData?.pilots ?? [];
  const f = funnel?.funnel;
  const m = funnel?.metrics;

  return (
    <DashboardLayout>
      <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>
              Customer Success
            </h1>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Pilot conversion funnel · {listData?.total ?? 0} pilots total
            </p>
          </div>
          <Button
            style={{
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff", fontWeight: 700, fontSize: 13,
              padding: "10px 20px", borderRadius: 8, border: "none",
            }}
            onClick={() => setCreateOpen(true)}
          >
            + New Pilot
          </Button>
        </div>

        {/* Funnel KPIs */}
        {f && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            <KpiCard label="Total Leads" value={f.leadsTotal} sub="Demo requests" />
            <KpiCard label="Pilots Started" value={f.pilotsTotal} sub={`${m?.demoToTrialRate} demo→pilot`} accent="#06b6d4" />
            <KpiCard label="Active Pilots" value={f.pilotsActive} sub="Running now" accent="#10b981" />
            <KpiCard label="Converted" value={f.pilotsConverted} sub={`${m?.trialToConvertRate} pilot→customer`} accent="#8b5cf6" />
          </div>
        )}

        {/* Secondary metrics */}
        {m && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
            <KpiCard label="Evaluations Run" value={m.totalEvaluationsRun} sub="Across all pilots" />
            <KpiCard label="Active Users (30d)" value={m.activeUsersLast30d} sub="Pilots with activity" accent="#f59e0b" />
            <KpiCard label="Churned" value={f?.pilotsChurned ?? 0} sub="Pilots lost" accent="#ef4444" />
          </div>
        )}

        {/* Status filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {(["ALL","INVITED","ACTIVE","COMPLETED","CONVERTED","CHURNED"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: `1px solid ${statusFilter === s ? "#3b82f6" : "#334155"}`,
                background: statusFilter === s ? "rgba(59,130,246,0.15)" : "transparent",
                color: statusFilter === s ? "#3b82f6" : "#64748b",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Pilots table */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 80px",
            padding: "12px 20px",
            borderBottom: "1px solid #1e293b",
            fontSize: 11, fontWeight: 700, color: "#475569",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <span>Organisation</span>
            <span>Contact</span>
            <span>Status</span>
            <span>Mode</span>
            <span>Evals</span>
            <span>Invited</span>
            <span></span>
          </div>

          {listLoading && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#475569", fontSize: 13 }}>
              Loading pilots…
            </div>
          )}

          {!listLoading && pilots.length === 0 && (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "#475569", fontSize: 13 }}>
              No pilots found. Create your first pilot above.
            </div>
          )}

          {pilots.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr 1fr 80px",
                padding: "14px 20px",
                borderBottom: i < pilots.length - 1 ? "1px solid #1e293b" : "none",
                alignItems: "center",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#0a1628")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              onClick={() => setSelectedPilotId(p.id)}
            >
              <div>
                <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 13 }}>{p.orgName}</div>
                <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{p.pilotSlug}</div>
              </div>
              <div>
                <div style={{ color: "#e2e8f0", fontSize: 13 }}>{p.contactName}</div>
                <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{p.contactEmail}</div>
              </div>
              <StatusBadge status={p.status as PilotStatus} />
              <div style={{ color: "#94a3b8", fontSize: 12, textTransform: "capitalize" }}>
                {p.councilMode.replace(/_/g, " ")}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                {p.usageCount}
                <span style={{ color: "#475569" }}>/{p.maxEvaluations}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12 }}>{formatDate(p.invitedAt)}</div>
              <Button
                size="sm"
                variant="outline"
                style={{ borderColor: "#334155", color: "#64748b", fontSize: 11 }}
                onClick={e => { e.stopPropagation(); setSelectedPilotId(p.id); }}
              >
                View
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Create dialog */}
      <CreatePilotDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(slug, token) => setNewPilotInfo({ slug, token })}
      />

      {/* New pilot created — show access token once */}
      {newPilotInfo && (
        <Dialog open onOpenChange={() => setNewPilotInfo(null)}>
          <DialogContent style={{ background: "#0a0f1a", border: "1px solid #1e293b", maxWidth: 520 }}>
            <DialogHeader>
              <DialogTitle style={{ color: "#10b981" }}>✓ Pilot Created</DialogTitle>
            </DialogHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>
                Share the pilot URL with your prospect. The access token is shown once — store it securely.
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Pilot URL</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <code style={{ flex: 1, background: "#1e293b", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#94a3b8", wordBreak: "break-all" }}>
                    {window.location.origin}/pilot/{newPilotInfo.slug}
                  </code>
                  <Button size="sm" variant="outline" style={{ borderColor: "#334155", color: "#94a3b8" }}
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/pilot/${newPilotInfo.slug}`); toast.success("Copied!"); }}>
                    Copy
                  </Button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Access Token (shown once)
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <code style={{ flex: 1, background: "#1e293b", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#f59e0b", wordBreak: "break-all" }}>
                    {newPilotInfo.token}
                  </code>
                  <Button size="sm" variant="outline" style={{ borderColor: "#334155", color: "#64748b" }}
                    onClick={() => { navigator.clipboard.writeText(newPilotInfo!.token); toast.success("Token copied!"); }}>
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button style={{ background: "#10b981", color: "#fff", fontWeight: 700 }} onClick={() => setNewPilotInfo(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Pilot detail */}
      {selectedPilotId !== null && (
        <PilotDetailDialog pilotId={selectedPilotId} onClose={() => setSelectedPilotId(null)} />
      )}
    </DashboardLayout>
  );
}
