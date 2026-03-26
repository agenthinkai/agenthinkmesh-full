/**
 * ForecastDashboard — main ForecastMesh page at /forecast
 * Shows all forecasts with status indicators, probability bars, and quick stats.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

const NAVY = "#080D1A";
const CARD = "#0D1E35";
const BORDER = "rgba(52,211,153,0.15)";
const GREEN = "#34D399";
const GOLD = "#F59E0B";
const TEAL = "#38BDF8";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";
const RED = "#F87171";
const ORANGE = "#FB923C";

const STATUS_CONFIG = {
  on_track: { label: "On Track", color: GREEN, bg: "rgba(52,211,153,0.12)" },
  watchlist: { label: "Watchlist", color: GOLD, bg: "rgba(245,158,11,0.12)" },
  at_risk: { label: "At Risk", color: ORANGE, bg: "rgba(251,146,60,0.12)" },
  critical: { label: "Critical", color: RED, bg: "rgba(248,113,113,0.12)" },
  resolved: { label: "Resolved", color: TEAL, bg: "rgba(56,189,248,0.12)" },
};

const TYPE_CONFIG = {
  deadline_risk: { label: "Deadline Risk", icon: "⏱️", color: ORANGE },
  budget_risk: { label: "Budget Risk", icon: "💰", color: RED },
  target_probability: { label: "Target Probability", icon: "🎯", color: GREEN },
};

function ProbabilityBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        flex: 1, height: 6, borderRadius: 3,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: color,
          transition: "width 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 38, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

export default function ForecastDashboard() {
  const { isAuthenticated } = useAuth();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: stats } = trpc.forecast.stats.useQuery(undefined, { enabled: isAuthenticated });
  const { data: forecasts, isLoading } = trpc.forecast.list.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
        <SiteNav />
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 24 }}>📊</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: GREEN, marginBottom: 12 }}>ForecastMesh</h1>
          <p style={{ color: MUTED, marginBottom: 32, lineHeight: 1.6 }}>
            AI-powered probability forecasting for enterprise scenarios. Sign in to access your forecast dashboard.
          </p>
          <a
            href={getLoginUrl()}
            style={{
              display: "inline-block", padding: "12px 32px", borderRadius: 8,
              background: GREEN, color: NAVY, fontWeight: 700, textDecoration: "none",
              fontSize: 15,
            }}
          >
            Sign In to Continue
          </a>
        </div>
      </div>
    );
  }

  const filtered = (forecasts ?? []).filter(f => {
    if (filterType !== "all" && f.forecastType !== filterType) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
      <SiteNav />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 28 }}>📊</span>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: GREEN, margin: 0 }}>ForecastMesh</h1>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: "rgba(52,211,153,0.15)", color: GREEN, border: `1px solid ${BORDER}`,
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>Enterprise</span>
            </div>
            <p style={{ color: MUTED, margin: 0, fontSize: 14 }}>
              AI-powered probability forecasting · 5-agent consensus engine · Automated trigger system
            </p>
          </div>
          <a
            href="/forecast/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 8,
              background: GREEN, color: NAVY, fontWeight: 700,
              textDecoration: "none", fontSize: 14,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
          >
            + New Forecast
          </a>
        </div>

        {/* Stats Row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Total Forecasts", value: stats.total, color: TEAL },
              { label: "On Track", value: stats.byStatus.on_track, color: GREEN },
              { label: "At Risk", value: stats.byStatus.at_risk + stats.byStatus.critical, color: RED },
              { label: "Avg Probability", value: `${Math.round(stats.avgProbability * 100)}%`, color: GOLD },
              { label: "Active Triggers", value: stats.unresolvedTriggers, color: ORANGE },
            ].map(s => (
              <div key={s.label} style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "14px 16px",
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {["all", "deadline_risk", "budget_risk", "target_probability"].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                borderColor: filterType === t ? GREEN : "rgba(255,255,255,0.1)",
                background: filterType === t ? "rgba(52,211,153,0.15)" : "transparent",
                color: filterType === t ? GREEN : MUTED,
                transition: "all 0.2s",
              }}
            >
              {t === "all" ? "All Types" : TYPE_CONFIG[t as keyof typeof TYPE_CONFIG]?.label ?? t}
            </button>
          ))}
          <div style={{ width: 1, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
          {["all", "on_track", "watchlist", "at_risk", "critical"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                borderColor: filterStatus === s ? TEAL : "rgba(255,255,255,0.1)",
                background: filterStatus === s ? "rgba(56,189,248,0.12)" : "transparent",
                color: filterStatus === s ? TEAL : MUTED,
                transition: "all 0.2s",
              }}
            >
              {s === "all" ? "All Status" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Forecast List */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: MUTED }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
            <p>Loading forecasts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h3 style={{ color: WHITE, marginBottom: 8 }}>No forecasts yet</h3>
            <p style={{ color: MUTED, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
              Create your first AI-powered forecast to start tracking probability across your enterprise scenarios.
            </p>
            <a
              href="/forecast/new"
              style={{
                display: "inline-block", padding: "10px 24px", borderRadius: 8,
                background: GREEN, color: NAVY, fontWeight: 700, textDecoration: "none",
              }}
            >
              Create First Forecast
            </a>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map(f => {
              const typeConf = TYPE_CONFIG[f.forecastType as keyof typeof TYPE_CONFIG];
              const statusConf = STATUS_CONFIG[f.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.watchlist;
              const prob = f.currentProbability ?? 0.5;
              const delta = f.previousProbability != null ? prob - f.previousProbability : null;

              return (
                <a
                  key={f.id}
                  href={`/forecast/${f.id}`}
                  style={{
                    display: "block", textDecoration: "none",
                    background: CARD, border: `1px solid ${BORDER}`,
                    borderRadius: 12, padding: "18px 20px",
                    transition: "border-color 0.2s, transform 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = GREEN;
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = BORDER;
                    (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    {/* Type icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: `${typeConf?.color ?? GREEN}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20,
                    }}>
                      {typeConf?.icon ?? "📊"}
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: WHITE }}>{f.title}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: statusConf.bg, color: statusConf.color,
                        }}>
                          {statusConf.label}
                        </span>
                        {typeConf && (
                          <span style={{ fontSize: 11, color: typeConf.color, opacity: 0.8 }}>
                            {typeConf.label}
                          </span>
                        )}
                      </div>
                      {f.businessArea && (
                        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{f.businessArea}</div>
                      )}
                      <ProbabilityBar value={prob} color={statusConf.color} />
                    </div>

                    {/* Right side */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: statusConf.color }}>
                        {Math.round(prob * 100)}%
                      </div>
                      {delta !== null && (
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: delta > 0 ? GREEN : delta < 0 ? RED : MUTED,
                        }}>
                          {delta > 0 ? "↑" : delta < 0 ? "↓" : "–"} {Math.abs(Math.round(delta * 100))}%
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                        {new Date(f.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
