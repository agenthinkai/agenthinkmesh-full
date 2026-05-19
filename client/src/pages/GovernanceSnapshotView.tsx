/**
 * GovernanceSnapshotView.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Public read-only governance dashboard snapshot page.
 * Route: /share/governance/:token
 *
 * No auth required. No mutations. No admin nav/sidebar.
 * Renders a frozen snapshot of aggregated inference telemetry suitable for
 * external diligence review (Tencent, Core42, etc.).
 *
 * Security:
 *   • Token is validated server-side (SHA-256 hash lookup + expiry check).
 *   • Payload is a frozen snapshot — no live DB queries on this page.
 *   • No internal IDs, API keys, raw prompts, user PII, or env vars exposed.
 *   • Page has zero write actions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
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

// ── Design tokens (dark, Palantir-meets-inference-runtime) ────────────────────

const C = {
  bg:      "#0a0e1a",
  surface: "#0f1525",
  border:  "#1e2a42",
  text:    "#e2e8f0",
  textDim: "#64748b",
  muted:   "#1e2a42",
  green:   "#22d3ee",
  accent:  "#6366f1",
  amber:   "#f59e0b",
  purple:  "#a855f7",
  red:     "#ef4444",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtMs(n: number)  { return `${n.toLocaleString()} ms`; }
function fmtUsd(n: number) { return `$${n.toFixed(6)}`; }
function fmtDate(ms: number) {
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, color = C.green,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "14px 18px",
      minWidth: 140,
    }}>
      <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "JetBrains Mono, monospace" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      borderBottom: `1px solid ${C.border}`,
      paddingBottom: 10, marginBottom: 16,
    }}>
      <div style={{ width: 3, height: 16, background: C.accent, borderRadius: 2 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: "0.06em" }}>
        {title}
      </span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: C.accent,
          border: `1px solid ${C.accent}`, borderRadius: 3,
          padding: "1px 5px", letterSpacing: "0.06em",
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "18px 20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Expired / Invalid page ────────────────────────────────────────────────────

function ExpiredPage({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "40px 48px", textAlign: "center", maxWidth: 420,
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⬡</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          Snapshot Unavailable
        </div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ marginTop: 20, fontSize: 10, color: C.textDim }}>
          AgenThinkMesh · Inference Governance
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingPage() {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "JetBrains Mono, monospace", color: C.textDim, fontSize: 13,
    }}>
      LOADING SNAPSHOT…
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GovernanceSnapshotView() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const query = trpc.governanceSnapshot.get.useQuery(
    { token },
    {
      enabled: token.length === 64,
      retry: false,
    },
  );

  if (!token || token.length !== 64) {
    return <ExpiredPage message="This link is invalid. Please request a new share link from the dashboard administrator." />;
  }

  if (query.isLoading) return <LoadingPage />;

  if (query.isError) {
    const msg = query.error?.message ?? "This snapshot link has expired or is no longer valid.";
    return <ExpiredPage message={msg} />;
  }

  if (!query.data) return <ExpiredPage message="Snapshot not found." />;

  const { payload, expiresAt, viewCount } = query.data;
  const p = payload;

  // Provider chart data
  const providerChartData = p.providerDistribution.map((r) => ({
    name: r.model ?? r.provider ?? "unknown",
    calls: r.totalCalls,
    latency: r.avgLatencyMs,
    cacheHit: Math.round(r.cacheHitRate * 100),
  }));

  const PROVIDER_COLORS = [C.green, C.accent, C.amber, C.purple, C.red];

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      fontFamily: "Inter, sans-serif",
      color: C.text,
    }}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: "12px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Hex logo mark */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <polygon
              points="12,2 21,7 21,17 12,22 3,17 3,7"
              stroke={C.green}
              strokeWidth="1.5"
              fill="none"
            />
            <polygon
              points="12,6 17.5,9 17.5,15 12,18 6.5,15 6.5,9"
              stroke={C.accent}
              strokeWidth="1"
              fill={`${C.accent}22`}
            />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: "0.06em" }}>
              AGENTHINK MESH
            </div>
            <div style={{ fontSize: 10, color: C.textDim }}>
              Inference Governance Snapshot · Read-only
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: C.green,
            border: `1px solid ${C.green}`, borderRadius: 3,
            padding: "2px 6px", letterSpacing: "0.08em",
          }}>
            READ-ONLY
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: C.textDim,
            border: `1px solid ${C.border}`, borderRadius: 3,
            padding: "2px 6px", letterSpacing: "0.08em",
          }}>
            {viewCount} VIEW{viewCount !== 1 ? "S" : ""}
          </span>
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* Title block */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: "0.04em", margin: 0 }}>
              INFERENCE GOVERNANCE &amp; EVALUATION INFRASTRUCTURE
            </h1>
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginLeft: 16, lineHeight: 1.8 }}>
            AgenThinkMesh · Structured Evaluation Mesh · Multi-Model Governance Runtime
            <br />
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
              Snapshot generated: {fmtDate(p.generatedAt)} ·
              Window: last {p.windowDays} days ·
              Expires: {fmtDate(expiresAt)}
            </span>
          </div>
        </div>

        {/* ── Section 1: KPI tiles ──────────────────────────────────────────── */}
        <Panel style={{ marginBottom: 20 }}>
          <SectionHeader title="EVAL OPS — LIVE TELEMETRY SUMMARY" badge={`${p.windowDays}-DAY WINDOW`} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <KpiTile label="TOTAL EVAL CALLS"    value={p.totalCalls.toLocaleString()}   color={C.green} />
            <KpiTile label="CACHE HIT RATE"      value={fmtPct(p.cacheHitRate)}           color={C.accent} />
            <KpiTile label="TOTAL COST (USD)"    value={`$${p.totalCostUsd.toFixed(4)}`}  color={C.amber} />
            <KpiTile label="AVG LATENCY (p50)"   value={fmtMs(p.avgLatencyMs)}            color={C.green} />
            <KpiTile label="P95 LATENCY"         value={fmtMs(p.p95LatencyMs)}            color={C.textDim} />
            <KpiTile label="FALLBACK CALLS"      value={p.fallbackCalls.toLocaleString()} sub={fmtPct(p.fallbackRate)} color={C.amber} />
            <KpiTile label="ESCALATED CALLS"     value={p.escalatedCalls.toLocaleString()} sub={fmtPct(p.escalationRate)} color={C.purple} />
            {p.totalCalls > 0 && (
              <KpiTile
                label="EST. COST / EVAL"
                value={fmtUsd(p.totalCostUsd / p.totalCalls)}
                color={C.green}
              />
            )}
          </div>
        </Panel>

        {/* ── Section 2: Provider distribution ─────────────────────────────── */}
        {providerChartData.length > 0 && (
          <Panel style={{ marginBottom: 20 }}>
            <SectionHeader title="PROVIDER / MODEL DISTRIBUTION" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {/* Call volume bar chart */}
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 10, letterSpacing: "0.06em" }}>
                  CALL VOLUME BY MODEL
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={providerChartData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.textDim, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: C.text }}
                      itemStyle={{ color: C.textDim }}
                    />
                    <Bar dataKey="calls" radius={[3, 3, 0, 0]}>
                      {providerChartData.map((_, i) => (
                        <Cell key={i} fill={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 10, letterSpacing: "0.06em" }}>
                  BREAKDOWN
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["Model", "Calls", "Cache Hit", "Avg Latency"].map((h) => (
                        <th key={h} style={{
                          textAlign: "left", padding: "4px 8px",
                          color: C.textDim, fontSize: 9, letterSpacing: "0.06em",
                          borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.providerDistribution.map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.muted}` }}>
                        <td style={{ padding: "5px 8px", color: PROVIDER_COLORS[i % PROVIDER_COLORS.length], fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                          {r.model ?? r.provider ?? "—"}
                        </td>
                        <td style={{ padding: "5px 8px", color: C.text }}>{r.totalCalls.toLocaleString()}</td>
                        <td style={{ padding: "5px 8px", color: C.text }}>{fmtPct(r.cacheHitRate)}</td>
                        <td style={{ padding: "5px 8px", color: C.text }}>{fmtMs(r.avgLatencyMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
        )}

        {/* ── Section 3: Routing architecture ──────────────────────────────── */}
        <Panel style={{ marginBottom: 20 }}>
          <SectionHeader title="ROUTING ARCHITECTURE" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {[
              { label: "PRIMARY MODEL",    value: p.routingArchitecture.primaryModel,   color: C.green },
              { label: "FALLBACK MODEL",   value: p.routingArchitecture.fallbackModel,  color: C.amber },
              { label: "CACHE LAYER",      value: p.routingArchitecture.cacheLayer,     color: C.accent },
              { label: "ESCALATION PATH",  value: p.routingArchitecture.escalationPath, color: C.purple },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: C.bg, borderRadius: 6, padding: "10px 14px",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color, fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{
            fontSize: 12, color: C.textDim, lineHeight: 1.7,
            borderTop: `1px solid ${C.border}`, paddingTop: 12,
          }}>
            {p.routingArchitecture.summary}
          </div>
        </Panel>

        {/* ── Section 4: Burst PoC case study ──────────────────────────────── */}
        <Panel style={{ marginBottom: 20 }}>
          <SectionHeader title="BURST POC CASE STUDY" badge="VALIDATED" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <KpiTile label="EVAL COUNT"          value={p.burstPoc.evalCount.toLocaleString()}     color={C.green} />
            <KpiTile label="SUCCESS RATE"        value={`${p.burstPoc.successRate}%`}              color={C.green} />
            <KpiTile label="MALFORMED JSON"      value={`${p.burstPoc.malformedJsonRate}%`}        color={C.amber} />
            <KpiTile label="CACHE HIT RATE"      value={`${(p.burstPoc.cacheHitRate * 100).toFixed(0)}%`} color={C.accent} />
            <KpiTile label="COST / EVAL"         value={fmtUsd(p.burstPoc.costPerEval)}            color={C.green} />
            <KpiTile label="TOTAL COST"          value={`$${p.burstPoc.totalCostUsd.toFixed(3)}`} color={C.amber} />
            <KpiTile label="P50 LATENCY"         value={fmtMs(p.burstPoc.p50LatencyMs)}           color={C.green} />
            <KpiTile label="P95 LATENCY"         value={fmtMs(p.burstPoc.p95LatencyMs)}           color={C.textDim} />
            <KpiTile label="BURST RPM"           value={`${p.burstPoc.burstRpm} rpm`}             color={C.accent} />
          </div>

          {/* Cost projection table */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.06em", marginBottom: 8 }}>
              COST PROJECTION (at ${fmtUsd(p.burstPoc.costPerEval)}/eval)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Scale", "Eval Count", "Est. Cost", "Notes"].map((h) => (
                    <th key={h} style={{
                      textAlign: "left", padding: "4px 10px",
                      color: C.textDim, fontSize: 9, letterSpacing: "0.06em",
                      borderBottom: `1px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { scale: "PoC (validated)",  count: "1,000",   cost: "$0.12",   note: "Completed — proof point" },
                  { scale: "Production run",   count: "100,000", cost: "$12.10",  note: "Pending persistent VM" },
                  { scale: "Annual (1M evals)", count: "1,000,000", cost: "$121",  note: "Projection at current rate" },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.muted}` }}>
                    <td style={{ padding: "6px 10px", color: i === 0 ? C.green : C.text, fontWeight: i === 0 ? 700 : 400 }}>{row.scale}</td>
                    <td style={{ padding: "6px 10px", color: C.text, fontFamily: "JetBrains Mono, monospace" }}>{row.count}</td>
                    <td style={{ padding: "6px 10px", color: C.amber, fontFamily: "JetBrains Mono, monospace" }}>{row.cost}</td>
                    <td style={{ padding: "6px 10px", color: C.textDim }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            fontSize: 12, color: C.textDim, lineHeight: 1.7,
            borderTop: `1px solid ${C.border}`, paddingTop: 12,
          }}>
            {p.burstPoc.summary}
          </div>
        </Panel>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}>
          <div style={{ fontSize: 10, color: C.textDim }}>
            AgenThinkMesh · Inference Governance Snapshot ·{" "}
            <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
              Generated {fmtDate(p.generatedAt)}
            </span>
          </div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            This is a read-only snapshot. No API keys, raw prompts, or user PII are included.
            Link expires {fmtDate(expiresAt)}.
          </div>
        </div>
      </div>
    </div>
  );
}
