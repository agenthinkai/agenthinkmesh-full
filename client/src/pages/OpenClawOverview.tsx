// OpenClawOverview.tsx — Overview / landing page for the OpenClaw integration console
// Route: /openclaw

import { Link } from "wouter";
import { AGENTS, BRIDGE_STATUS, POLICY_RULES, VERTICALS, VERTICAL_COLORS } from "@/lib/meshData";
import SiteNav from "@/components/SiteNav";

const NAVY = "#080D1A";
const CYAN = "#22D3EE";
const WHITE = "#F0F4FA";
const MUTED = "rgba(240,244,250,0.55)";

const NAV_ITEMS = [
  { path: "/openclaw", label: "Overview", icon: "⬡" },
  { path: "/openclaw/discovery", label: "A2A Discovery", icon: "⊕" },
  { path: "/openclaw/bridge", label: "OpenClaw Bridge", icon: "⇄" },
  { path: "/openclaw/policy", label: "Policy Engine", icon: "⊘" },
  { path: "/openclaw/manifests", label: "Manifests", icon: "◈" },
];

const POLICY_LOG = [
  { time: "09:41", client: "Alghanim", event: "HITL triggered", type: "warn" as const },
  { time: "09:38", client: "GCC Wealth", event: "Shariah block", type: "block" as const },
  { time: "09:35", client: "Default", event: "Route: Deal Screener", type: "ok" as const },
  { time: "09:31", client: "Alghanim", event: "Route: Legal Reviewer", type: "ok" as const },
  { time: "09:28", client: "Default", event: "Route: DCF Modeler", type: "ok" as const },
];

const clawReady = AGENTS.filter(a => a.clawReady).length;
const totalAgents = AGENTS.length;
const verticalCounts = VERTICALS.map(v => ({
  v,
  count: AGENTS.filter(a => a.vertical === v && a.clawReady).length,
})).filter(x => x.count > 0);

export default function OpenClawOverview() {
  return (
    <div style={{ minHeight: "100vh", background: NAVY, fontFamily: "'JetBrains Mono', monospace" }}>
      <SiteNav />

      <div style={{ display: "flex", height: "calc(100vh - 57px)" }}>
        {/* Left sidebar */}
        <aside style={{
          width: 224, borderRight: "1px solid rgba(56,189,248,0.12)",
          background: "#0d1117", display: "flex", flexDirection: "column",
          flexShrink: 0, overflowY: "auto",
        }}>
          {/* Top health bar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(56,189,248,0.12)" }}>
            <div style={{ fontSize: 11, color: CYAN, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>
              ⬡ OpenClaw Console
            </div>
            <div style={{ fontSize: 10, color: MUTED }}>Integration Console v0.2.0</div>
          </div>

          {/* Navigation */}
          <nav style={{ padding: "12px 12px", borderBottom: "1px solid rgba(56,189,248,0.12)" }}>
            <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, paddingLeft: 8 }}>Navigation</div>
            {NAV_ITEMS.map(item => {
              const active = window.location.pathname === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", borderRadius: 6, fontSize: 12,
                    cursor: "pointer", marginBottom: 2,
                    background: active ? "rgba(34,211,238,0.12)" : "transparent",
                    color: active ? CYAN : MUTED,
                    transition: "all 0.15s",
                  }}>
                    <span style={{ width: 16, textAlign: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <span style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: CYAN }} />}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* System stats */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(56,189,248,0.12)" }}>
            <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>System</div>
            {[
              { label: "Total agents", value: totalAgents.toString(), color: WHITE },
              { label: "Claw-ready", value: clawReady.toString(), color: "#4ADE80" },
              { label: "April drop", value: "+25–30", color: "#F59E0B" },
              { label: "Tasks run", value: "2,405+", color: WHITE },
              { label: "Avg latency", value: "47ms", color: WHITE },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: MUTED }}>{s.label}</span>
                <span style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Bridge status */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(56,189,248,0.12)" }}>
            <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Bridge Status</div>
            {BRIDGE_STATUS.map(s => (
              <div key={s.service} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: s.status === "live" ? "#4ADE80" : s.status === "degraded" ? "#F59E0B" : "#EF4444",
                }} />
                <span style={{ fontSize: 10, color: MUTED, flex: 1 }}>{s.service}</span>
                <span style={{ fontSize: 10, color: CYAN }}>{s.latencyMs}ms</span>
              </div>
            ))}
          </div>

          {/* Policy log */}
          <div style={{ padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Policy Log</div>
            {POLICY_LOG.map((log, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>{log.time}</span>
                <div>
                  <div style={{ fontSize: 10, color: log.type === "warn" ? "#F59E0B" : log.type === "block" ? "#EF4444" : "#4ADE80" }}>{log.event}</div>
                  <div style={{ fontSize: 9, color: MUTED }}>{log.client}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 28, color: CYAN }}>⬡</span>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: WHITE, margin: 0, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                  OpenClaw Integration Console
                </h1>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, marginTop: 4 }}>
                  Agent-to-agent discovery, routing policy, and manifest registry for AgenThink Mesh
                </p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Total Agents", value: totalAgents.toString(), sub: "across all verticals", color: CYAN },
              { label: "Claw-Ready", value: clawReady.toString(), sub: "with full manifests", color: "#4ADE80" },
              { label: "Active Policies", value: POLICY_RULES.length.toString(), sub: "routing rules live", color: "#F59E0B" },
              { label: "Bridge Latency", value: "12ms", sub: "OpenClaw bridge", color: "#A78BFA" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#0d1117", border: "1px solid rgba(56,189,248,0.12)",
                borderRadius: 12, padding: "20px 24px",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: WHITE, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick nav cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
            {NAV_ITEMS.slice(1).map(item => (
              <Link key={item.path} href={item.path}>
                <div style={{
                  background: "#0d1117", border: "1px solid rgba(56,189,248,0.12)",
                  borderRadius: 12, padding: "20px 24px", cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                  display: "flex", alignItems: "center", gap: 16,
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(34,211,238,0.4)";
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(34,211,238,0.04)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(56,189,248,0.12)";
                    (e.currentTarget as HTMLDivElement).style.background = "#0d1117";
                  }}
                >
                  <span style={{ fontSize: 24, color: CYAN }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: WHITE, fontFamily: "'Inter', sans-serif" }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {item.path === "/openclaw/discovery" && "Browse and filter 124 agents by vertical, capability, and Claw-readiness"}
                      {item.path === "/openclaw/bridge" && "Monitor the live OpenClaw bridge — latency, status, and service health"}
                      {item.path === "/openclaw/policy" && "View and manage routing policy rules for enterprise clients"}
                      {item.path === "/openclaw/manifests" && "Inspect OpenClaw manifests for all 29 Claw-ready agents"}
                    </div>
                  </div>
                  <span style={{ marginLeft: "auto", color: MUTED, fontSize: 16 }}>→</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Vertical coverage */}
          <div style={{ background: "#0d1117", border: "1px solid rgba(56,189,248,0.12)", borderRadius: 12, padding: "24px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: WHITE, fontFamily: "'Inter', sans-serif", margin: "0 0 16px 0" }}>
              Claw-Ready Agents by Vertical
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {verticalCounts.map(({ v, count }) => (
                <div key={v} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 20,
                  border: "1px solid rgba(56,189,248,0.15)",
                  background: "rgba(56,189,248,0.04)",
                }}>
                  <span style={{ fontSize: 11, color: WHITE, fontWeight: 600 }}>{v}</span>
                  <span style={{ fontSize: 11, color: CYAN, fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 16, marginBottom: 0 }}>
              Remaining {totalAgents - clawReady} agents are Mesh-native only. Full OpenClaw manifests for all agents are scheduled for the April 2026 OSS drop.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
