/**
 * AdminTreasury.tsx
 * Admin-only treasury dashboard — shows all transactions with
 * status, region, FX rate, kill-switch flag, timestamp, amount, currency.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

// ── Design tokens (Bloomberg Terminal dark) ───────────────────────────────────
const BG     = "#070b12";
const BG2    = "#0d1421";
const BG3    = "#111827";
const BORDER = "#1e2d3d";
const ACCENT = "#4a9eff";
const GREEN  = "#00ff87";
const AMBER  = "#ff9f43";
const RED    = "#ff4757";
const MUTED  = "#4a5568";
const TEXT   = "#e2e8f0";
const TEXT2  = "#94a3b8";
const MONO   = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";

type StatusFilter = "pending" | "completed" | "failed" | "killed" | "all";
type RegionFilter = "Global" | "China" | "all";

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; border: string; color: string }> = {
    pending:   { bg: "rgba(255,159,67,0.12)", border: AMBER,  color: AMBER  },
    completed: { bg: "rgba(0,255,135,0.12)",  border: GREEN,  color: GREEN  },
    failed:    { bg: "rgba(255,71,87,0.12)",  border: RED,    color: RED    },
    killed:    { bg: "rgba(255,71,87,0.18)",  border: RED,    color: RED    },
  };
  const s = cfg[status] ?? { bg: "transparent", border: BORDER, color: TEXT2 };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 3,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
    }}>
      {status.toUpperCase()}
    </span>
  );
}

function KillBadge({ triggered }: { triggered: boolean }) {
  if (!triggered) return (
    <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>—</span>
  );
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 3,
      background: "rgba(255,71,87,0.18)", border: `1px solid ${RED}`, color: RED,
      fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      boxShadow: `0 0 8px rgba(255,71,87,0.4)`,
    }}>
      ⚡ KILLED
    </span>
  );
}

export default function AdminTreasury() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [killOnly,     setKillOnly]     = useState(false);
  const [offset,       setOffset]       = useState(0);
  const PAGE = 50;

  const { data: stats } = trpc.treasury.stats.useQuery();
  const { data: rows, isLoading, error } = trpc.treasury.list.useQuery({
    limit: PAGE,
    offset,
    status: statusFilter,
    region: regionFilter,
    killSwitchOnly: killOnly,
  });

  // Admin guard
  if (!user) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: MONO, color: TEXT2, fontSize: 13 }}>Authenticating…</div>
    </div>
  );
  if (user.role !== "admin") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: RED, marginBottom: 8 }}>ACCESS DENIED</div>
        <div style={{ fontSize: 12, color: TEXT2 }}>Admin role required to view treasury data.</div>
        <Link href="/deals" style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, marginTop: 12, display: "block" }}>← Back to Deal Screener</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/admin/usage" style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, textDecoration: "none" }}>← Admin</Link>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em" }}>TREASURY OPERATIONS</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginTop: 2 }}>Transaction Ledger</div>
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
          Kill-switch limit: <span style={{ color: RED, fontWeight: 700 }}>$500.00 USD</span>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Stats row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "TOTAL",     value: stats.total,     color: TEXT   },
              { label: "COMPLETED", value: stats.completed, color: GREEN  },
              { label: "PENDING",   value: stats.pending,   color: AMBER  },
              { label: "FAILED",    value: stats.failed,    color: RED    },
              { label: "KILLED",    value: stats.killed,    color: RED, glow: true },
            ].map(({ label, value, color, glow }) => (
              <div key={label} style={{
                background: BG2, border: `1px solid ${glow ? RED : BORDER}`,
                borderRadius: 6, padding: "14px 16px",
                boxShadow: glow && value > 0 ? `0 0 16px rgba(255,71,87,0.25)` : undefined,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {/* Status filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "pending", "completed", "failed", "killed"] as StatusFilter[]).map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setOffset(0); }} style={{
                padding: "4px 10px", borderRadius: 4, fontFamily: MONO, fontSize: 10, cursor: "pointer",
                border: `1px solid ${statusFilter === s ? ACCENT : BORDER}`,
                background: statusFilter === s ? "rgba(74,158,255,0.12)" : "transparent",
                color: statusFilter === s ? ACCENT : TEXT2,
                letterSpacing: "0.05em",
              }}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Region filter */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "Global", "China"] as RegionFilter[]).map((r) => (
              <button key={r} onClick={() => { setRegionFilter(r); setOffset(0); }} style={{
                padding: "4px 10px", borderRadius: 4, fontFamily: MONO, fontSize: 10, cursor: "pointer",
                border: `1px solid ${regionFilter === r ? AMBER : BORDER}`,
                background: regionFilter === r ? "rgba(255,159,67,0.1)" : "transparent",
                color: regionFilter === r ? AMBER : TEXT2,
                letterSpacing: "0.05em",
              }}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Kill-switch only toggle */}
          <button onClick={() => { setKillOnly(!killOnly); setOffset(0); }} style={{
            padding: "4px 12px", borderRadius: 4, fontFamily: MONO, fontSize: 10, cursor: "pointer",
            border: `1px solid ${killOnly ? RED : BORDER}`,
            background: killOnly ? "rgba(255,71,87,0.12)" : "transparent",
            color: killOnly ? RED : TEXT2,
            letterSpacing: "0.05em",
          }}>
            ⚡ KILL-SWITCH ONLY
          </button>
        </div>

        {/* Table */}
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 90px 80px 90px 100px 90px 90px 140px",
            gap: 0,
            padding: "10px 16px",
            borderBottom: `1px solid ${BORDER}`,
            background: BG3,
          }}>
            {["ID", "DEAL ID", "USER ID", "REGION", "STATUS", "AMOUNT", "CURRENCY", "FX RATE", "TIMESTAMP"].map((h) => (
              <div key={h} style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>{h}</div>
            ))}
          </div>

          {isLoading && (
            <div style={{ padding: 32, textAlign: "center", fontFamily: MONO, fontSize: 12, color: TEXT2 }}>
              Loading transactions…
            </div>
          )}

          {error && (
            <div style={{ padding: 32, textAlign: "center", fontFamily: MONO, fontSize: 12, color: RED }}>
              Error: {error.message}
            </div>
          )}

          {!isLoading && rows?.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", fontFamily: MONO, fontSize: 12, color: MUTED }}>
              No transactions match the current filters.
            </div>
          )}

          {rows?.map((tx, i) => (
            <div key={tx.id} style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 90px 80px 90px 100px 90px 90px 140px",
              gap: 0,
              padding: "10px 16px",
              borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : undefined,
              background: tx.killSwitchTriggered ? "rgba(255,71,87,0.04)" : "transparent",
              alignItems: "center",
            }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>#{tx.id}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.dealId}>
                {tx.dealId}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.userId}>
                {tx.userId}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: tx.region === "China" ? AMBER : ACCENT }}>
                {tx.region}
              </div>
              <div><StatusBadge status={tx.status} /></div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT }}>
                {tx.convertedAmount != null
                  ? `${tx.convertedAmount.toFixed(2)}`
                  : `${tx.baseAmountUsd.toFixed(2)}`
                }
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>{tx.currency}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>
                {tx.fxRate != null ? tx.fxRate.toFixed(4) : "—"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2 }}>
                  {new Date(tx.createdAt).toLocaleDateString()}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
                  {new Date(tx.createdAt).toLocaleTimeString()}
                </div>
                {tx.killSwitchTriggered && <KillBadge triggered />}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
            Showing {offset + 1}–{offset + (rows?.length ?? 0)}
          </span>
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            style={{
              padding: "4px 12px", borderRadius: 4, fontFamily: MONO, fontSize: 10, cursor: offset === 0 ? "not-allowed" : "pointer",
              border: `1px solid ${BORDER}`, background: "transparent", color: offset === 0 ? MUTED : TEXT2,
            }}
          >
            ← Prev
          </button>
          <button
            disabled={(rows?.length ?? 0) < PAGE}
            onClick={() => setOffset(offset + PAGE)}
            style={{
              padding: "4px 12px", borderRadius: 4, fontFamily: MONO, fontSize: 10,
              cursor: (rows?.length ?? 0) < PAGE ? "not-allowed" : "pointer",
              border: `1px solid ${BORDER}`, background: "transparent",
              color: (rows?.length ?? 0) < PAGE ? MUTED : TEXT2,
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
