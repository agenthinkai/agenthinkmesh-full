/**
 * ForecastDetail — forecast detail view at /forecast/:id
 * Shows: probability gauge, agent breakdown, triggers, quick actions.
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import SiteNav from "@/components/SiteNav";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";

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

const TRIGGER_ICONS = {
  probability_drop: "📉",
  low_confidence: "⚠️",
  status_worsened: "🔴",
  deadline_approaching: "⏰",
};

function ProbabilityGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Background circle */}
        <circle cx={70} cy={70} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
        {/* Progress arc */}
        <circle
          cx={70} cy={70} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        {/* Center text */}
        <text x={70} y={66} textAnchor="middle" fill={color} fontSize={28} fontWeight={800} fontFamily="Inter, sans-serif">
          {pct}%
        </text>
        <text x={70} y={84} textAnchor="middle" fill={MUTED} fontSize={11} fontFamily="Inter, sans-serif">
          probability
        </text>
      </svg>
    </div>
  );
}

export default function ForecastDetail() {
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/forecast/:id");
  const forecastId = params?.id ?? "";
  const [rerunNote, setRerunNote] = useState("");

  const { data: forecast, isLoading, refetch } = trpc.forecast.getById.useQuery(
    { forecastId },
    { enabled: isAuthenticated && !!forecastId }
  );

  const rerunMutation = trpc.forecast.runAgents.useMutation({
    onSuccess: () => { refetch(); setRerunNote(""); },
  });

  const resolveMutation = trpc.forecast.resolveTrigger.useMutation({
    onSuccess: () => refetch(),
  });

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
        <SiteNav />
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ color: MUTED }}>Please sign in to view this forecast.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
        <SiteNav />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: MUTED }}>⟳</div>
          <p style={{ color: MUTED }}>Loading forecast…</p>
        </div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
        <SiteNav />
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <p style={{ color: RED }}>Forecast not found.</p>
          <a href="/forecast" style={{ color: GREEN }}>← Back to ForecastMesh</a>
        </div>
      </div>
    );
  }

  const prob = forecast.currentProbability ?? 0.5;
  const statusConf = STATUS_CONFIG[forecast.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.watchlist;
  const typeConf = TYPE_CONFIG[forecast.forecastType as keyof typeof TYPE_CONFIG];
  const delta = forecast.previousProbability != null ? prob - forecast.previousProbability : null;
  const unresolvedTriggers = forecast.triggers?.filter((t: { resolved: boolean }) => !t.resolved) ?? [];

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: WHITE }}>
      <SiteNav />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px 80px" }}>

        {/* Breadcrumb */}
        <a href="/forecast" style={{ color: MUTED, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          ← ForecastMesh
        </a>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{typeConf?.icon ?? "📊"}</span>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: WHITE, margin: 0 }}>{forecast.title}</h1>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: statusConf.bg, color: statusConf.color,
              }}>
                {statusConf.label}
              </span>
              {unresolvedTriggers.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: "rgba(251,146,60,0.15)", color: ORANGE,
                }}>
                  ⚠️ {unresolvedTriggers.length} trigger{unresolvedTriggers.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {forecast.businessArea && (
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>{forecast.businessArea} · {typeConf?.label}</div>
            )}
            <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5, maxWidth: 600 }}>
              {forecast.question}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={`/forecast/${forecastId}/activity`}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)",
                color: TEAL, textDecoration: "none",
              }}
            >
              📈 Activity
            </a>
            <button
              onClick={() => rerunMutation.mutate({ forecastId })}
              disabled={rerunMutation.isPending}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: rerunMutation.isPending ? "rgba(52,211,153,0.1)" : "rgba(52,211,153,0.15)",
                border: `1px solid rgba(52,211,153,0.3)`,
                color: GREEN, cursor: rerunMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {rerunMutation.isPending ? "⟳ Running…" : "🔄 Re-run Agents"}
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>

          {/* Left: Probability gauge */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 20px" }}>
            <ProbabilityGauge value={prob} color={statusConf.color} />

            <div style={{ marginTop: 16, textAlign: "center" }}>
              {delta !== null && (
                <div style={{
                  fontSize: 14, fontWeight: 700, marginBottom: 8,
                  color: delta > 0 ? GREEN : delta < 0 ? RED : MUTED,
                }}>
                  {delta > 0 ? "↑" : delta < 0 ? "↓" : "–"} {Math.abs(Math.round(delta * 100))}% from last run
                </div>
              )}
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
                Confidence: {Math.round((forecast.confidenceScore ?? 0.5) * 100)}%
              </div>
              {forecast.deadline && (
                <div style={{ fontSize: 12, color: MUTED }}>
                  Deadline: {new Date(forecast.deadline).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Meta */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
                Created {new Date(forecast.createdAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>
                Updated {new Date(forecast.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Right: Agent breakdown + triggers */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Active Triggers */}
            {unresolvedTriggers.length > 0 && (
              <div style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE, marginBottom: 12 }}>
                  ⚠️ Active Triggers
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {unresolvedTriggers.map((t: { id: string; triggerType: string; description: string; firedAt: Date }) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{TRIGGER_ICONS[t.triggerType as keyof typeof TRIGGER_ICONS] ?? "⚠️"}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: WHITE, marginBottom: 2 }}>
                            {t.triggerType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </div>
                          <div style={{ fontSize: 11, color: MUTED }}>{t.description}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => resolveMutation.mutate({ triggerId: t.id })}
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
                          color: GREEN, cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Breakdown */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 14 }}>
                🤖 Agent Analysis
              </div>
              {forecast.agents?.length === 0 ? (
                <div style={{ color: MUTED, fontSize: 13 }}>No agent results yet. Click "Re-run Agents" to analyse.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {forecast.agents?.map((agent: {
                    id: string;
                    agentName: string;
                    probabilityEstimate: number;
                    confidence: number;
                    summary: string;
                    upwardForces: string[];
                    downwardForces: string[];
                    recommendedActions: string[];
                  }) => {
                    const agentProb = agent.probabilityEstimate ?? 0.5;
                    const agentConf = agent.confidence ?? 0.5;
                    const agentColor = agentProb >= 0.7 ? GREEN : agentProb >= 0.5 ? GOLD : RED;

                    return (
                      <div key={agent.id} style={{
                        background: "#0A1628", borderRadius: 10, padding: "14px 16px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{agent.agentName}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, color: MUTED }}>conf. {Math.round(agentConf * 100)}%</span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: agentColor }}>
                              {Math.round(agentProb * 100)}%
                            </span>
                          </div>
                        </div>

                        {/* Probability bar */}
                        <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginBottom: 10, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(agentProb * 100)}%`, height: "100%", background: agentColor, borderRadius: 2 }} />
                        </div>

                        <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px", lineHeight: 1.5 }}>{agent.summary}</p>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {agent.upwardForces?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                ↑ Upward Forces
                              </div>
                              {agent.upwardForces.slice(0, 3).map((f: string, i: number) => (
                                <div key={i} style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>• {f}</div>
                              ))}
                            </div>
                          )}
                          {agent.downwardForces?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: RED, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                ↓ Downward Forces
                              </div>
                              {agent.downwardForces.slice(0, 3).map((f: string, i: number) => (
                                <div key={i} style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>• {f}</div>
                              ))}
                            </div>
                          )}
                        </div>

                        {agent.recommendedActions?.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: TEAL, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Recommended Actions
                            </div>
                            {agent.recommendedActions.slice(0, 2).map((a: string, i: number) => (
                              <div key={i} style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>→ {a}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            {forecast.description && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Context
                </div>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>{forecast.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue + EBITDA Financial Chart */}
        {forecast.history && forecast.history.some((h: { revenue: number | null }) => h.revenue != null) && (() => {
          const currency = (forecast as { currency?: string }).currency ?? "USD";
          const chartData = [...forecast.history]
            .filter((h: { month: string | null; revenue: number | null }) => h.month && h.revenue != null)
            .sort((a, b) =>
              (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
            )
            .map((h) => ({
              month: h.month,
              revenue: h.revenue != null ? Math.round(h.revenue / 1000) : null,
              ebitda: h.ebitda != null ? Math.round(h.ebitda / 1000) : null,
              ebitdaMargin: (h.revenue && h.ebitda && h.revenue > 0)
                ? Math.round((h.ebitda / h.revenue) * 100)
                : null,
            }));

          return (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px", marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, marginBottom: 4 }}>📊 Financial Performance</div>
              <div style={{ fontSize: 11, color: MUTED, marginBottom: 16 }}>Revenue &amp; EBITDA — {currency} (thousands)</div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: MUTED, fontSize: 10 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: MUTED, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}k`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: MUTED, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{ background: "#0D1E35", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: WHITE, fontWeight: 700 }}
                    itemStyle={{ color: MUTED }}
                    formatter={(value: number, name: string) => {
                      if (name === "ebitdaMargin") return [`${value}%`, "EBITDA Margin"];
                      return [`${value}k ${currency}`, name === "revenue" ? "Revenue" : "EBITDA"];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 8 }}
                    formatter={(value: string) => ({
                      revenue: "Revenue",
                      ebitda: "EBITDA",
                      ebitdaMargin: "EBITDA Margin %",
                    }[value] ?? value)}
                  />
                  <Bar yAxisId="left" dataKey="revenue" fill="rgba(56,189,248,0.7)" radius={[3,3,0,0]} name="revenue" />
                  <Bar yAxisId="left" dataKey="ebitda" fill="rgba(52,211,153,0.7)" radius={[3,3,0,0]} name="ebitda" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="ebitdaMargin"
                    stroke={GOLD}
                    strokeWidth={2}
                    dot={{ fill: GOLD, r: 3 }}
                    name="ebitdaMargin"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
