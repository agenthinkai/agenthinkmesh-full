import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

const NAVY_950 = "#080F1E";
const NAVY_900 = "#0C1628";
const NAVY_800 = "#111E35";
const NAVY_700 = "#162440";
const STEEL = "#1E2D47";
const AMBER = "#F59E0B";
const AMBER_LIGHT = "#FCD34D";
const RED = "#EF4444";
const GREEN = "#4ADE80";
const SILVER_50 = "#F0F4FA";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const AGENTS = [
  {
    id: "financial-sentinel",
    icon: "💰",
    name: "Financial Sentinel",
    role: "Cash & Survival Analysis",
    description: "Burn-rate dashboard, 3/6/12-month survival scenarios, prioritised cost-cut plan.",
    escalation: "Auto-alert if cash runway < 90 days",
    color: AMBER,
  },
  {
    id: "customer-pulse",
    icon: "📊",
    name: "Customer Pulse",
    role: "Churn Risk Intelligence",
    description: "Churn risk report, re-engagement scripts for top 10 at-risk accounts, priority client list.",
    escalation: "Auto-alert if churn risk > 15%",
    color: "#60A5FA",
  },
  {
    id: "workflow-optimizer",
    icon: "⚙️",
    name: "Workflow Optimizer",
    role: "Operational Efficiency",
    description: "Bottleneck map with time-cost quantification, top 3 automation pilot proposals.",
    escalation: "Auto-alert if critical path delays > 48 hours",
    color: "#A78BFA",
  },
  {
    id: "narrative-architect",
    icon: "✍️",
    name: "Narrative Architect",
    role: "Crisis Communications",
    description: "All-staff memo, investor letter, LinkedIn 3-post mini-series aligned to financial reality.",
    escalation: "Auto-alert if negative sentiment > 20%",
    color: "#34D399",
  },
  {
    id: "compliance-guardian",
    icon: "🛡️",
    name: "Compliance Guardian",
    role: "Risk & Regulatory",
    description: "Risk flag register, compliance checklist with ownership, 30/60/90-day mitigation plan.",
    escalation: "Immediate alert on any high-risk compliance gap",
    color: RED,
  },
  {
    id: "resilience-logger",
    icon: "🧠",
    name: "Resilience Logger",
    role: "Memory Backbone & Synthesis",
    description: "Reads all 5 agent outputs. Flags contradictions, anomalies, and produces executive synthesis.",
    escalation: "Flags any agent narrative contradictions",
    color: AMBER_LIGHT,
  },
];

export default function TurnaroundHome() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  if (!isAuthenticated) {
    window.location.href = getLoginUrl("/turnaround");
    return null;
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_50 }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "5%", left: "50%", transform: "translateX(-50%)", width: 800, height: 400, borderRadius: "50%", background: `radial-gradient(ellipse, ${AMBER}08 0%, transparent 65%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${RED}05 0%, transparent 65%)`, filter: "blur(80px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 40px",
        borderBottom: `1px solid ${STEEL}`,
        background: `${NAVY_900}F0`,
        backdropFilter: "blur(16px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}><Logo /></a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/portfolio" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Portfolio Intelligence
          </a>
          <a href="/vault" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Vault
          </a>
          <button
            onClick={() => navigate("/turnaround/upload")}
            style={{
              padding: "8px 20px", borderRadius: 8,
              background: `linear-gradient(135deg, ${AMBER}, ${AMBER_LIGHT})`,
              border: "none", color: NAVY_950,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: MONO, letterSpacing: "0.04em",
            }}
          >
            ⏱ Activate Turnaround
          </button>
        </div>
      </nav>

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "60px 40px 100px", boxSizing: "border-box" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 20,
            background: `${AMBER}12`, border: `1px solid ${AMBER}30`,
            fontSize: 11, fontFamily: MONO, color: AMBER, letterSpacing: "0.08em",
            marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER, display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
            6 SPECIALIST AGENTS · CRISIS RESPONSE SYSTEM
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(36px, 5vw, 64px)",
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: 20,
            background: `linear-gradient(135deg, ${SILVER_50} 0%, ${AMBER_LIGHT} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            100-Hour Turnaround
          </h1>

          <p style={{ fontSize: 18, color: SILVER_400, maxWidth: 600, margin: "0 auto 16px", lineHeight: 1.7 }}>
            A pre-configured 6-agent crisis management system for enterprises under financial or operational stress.
          </p>

          <p style={{ fontSize: 14, color: SILVER_600, maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Upload your documents. The mesh deploys all 6 agents in parallel. A unified crisis response plan — with contradiction checks, escalation alerts, and a prioritised action list — is delivered within the 100-hour window.
          </p>

          {/* Countdown illustration */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 16,
            padding: "16px 32px", borderRadius: 16,
            background: NAVY_800, border: `1px solid ${AMBER}30`,
            marginBottom: 40,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontFamily: MONO, fontWeight: 900, color: AMBER, letterSpacing: "0.05em", lineHeight: 1 }}>100</div>
              <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.06em", marginTop: 4 }}>HOURS</div>
            </div>
            <div style={{ width: 1, height: 40, background: STEEL }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontFamily: MONO, fontWeight: 900, color: SILVER_200, letterSpacing: "0.05em", lineHeight: 1 }}>6</div>
              <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.06em", marginTop: 4 }}>AGENTS</div>
            </div>
            <div style={{ width: 1, height: 40, background: STEEL }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontFamily: MONO, fontWeight: 900, color: GREEN, letterSpacing: "0.05em", lineHeight: 1 }}>1</div>
              <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.06em", marginTop: 4 }}>REPORT</div>
            </div>
          </div>

          <div>
            <button
              onClick={() => navigate("/turnaround/upload")}
              style={{
                padding: "14px 40px", borderRadius: 10,
                background: `linear-gradient(135deg, ${AMBER}, ${AMBER_LIGHT})`,
                border: "none", color: NAVY_950,
                fontSize: 15, fontWeight: 800, cursor: "pointer",
                fontFamily: MONO, letterSpacing: "0.04em",
                boxShadow: `0 0 40px ${AMBER}30`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 60px ${AMBER}50`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 40px ${AMBER}30`; }}
            >
              ⏱ Activate 100-Hour Turnaround
            </button>
          </div>
        </div>

        {/* The 6 Agents */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontFamily: MONO, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 8 }}>THE CRISIS RESPONSE TEAM</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: SILVER_50 }}>6 Fixed-Role Specialist Agents</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {AGENTS.map(agent => (
              <div
                key={agent.id}
                onMouseEnter={() => setHoveredAgent(agent.id)}
                onMouseLeave={() => setHoveredAgent(null)}
                style={{
                  background: NAVY_800,
                  border: `1px solid ${hoveredAgent === agent.id ? agent.color + "40" : STEEL}`,
                  borderRadius: 14,
                  padding: "20px 22px",
                  transition: "all 0.2s",
                  cursor: "default",
                }}
              >
                {/* Agent header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: `${agent.color}12`, border: `1px solid ${agent.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>{agent.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: SILVER_50, lineHeight: 1.2 }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: agent.color, fontFamily: MONO, letterSpacing: "0.04em" }}>{agent.role}</div>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: SILVER_400, lineHeight: 1.6, marginBottom: 12 }}>{agent.description}</p>

                {/* Escalation rule */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 6,
                  padding: "6px 10px", borderRadius: 6,
                  background: `${RED}08`, border: `1px solid ${RED}20`,
                }}>
                  <span style={{ fontSize: 10, color: RED, marginTop: 1 }}>⚡</span>
                  <span style={{ fontSize: 11, color: SILVER_600, lineHeight: 1.4 }}>{agent.escalation}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{
          background: NAVY_800, border: `1px solid ${STEEL}`,
          borderRadius: 16, padding: "32px 36px",
          marginBottom: 48,
        }}>
          <div style={{ fontSize: 11, fontFamily: MONO, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 16 }}>HOW IT WORKS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {[
              { step: "01", title: "Upload Documents", desc: "Assign financial, customer, ops, and compliance documents to the relevant agent slots." },
              { step: "02", title: "Agents Deploy", desc: "All 6 agents run in parallel. The 100-hour countdown begins from session creation." },
              { step: "03", title: "Live Command Centre", desc: "Monitor each agent in real time. Leadership alerts surface instantly when thresholds are breached." },
              { step: "04", title: "Unified Report", desc: "Resilience Logger synthesises all outputs, flags contradictions, and delivers the executive action plan." },
            ].map(item => (
              <div key={item.step}>
                <div style={{ fontSize: 28, fontFamily: MONO, fontWeight: 900, color: `${AMBER}40`, marginBottom: 8 }}>{item.step}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: SILVER_50, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: SILVER_400, lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => navigate("/turnaround/upload")}
            style={{
              padding: "12px 36px", borderRadius: 10,
              background: `linear-gradient(135deg, ${AMBER}, ${AMBER_LIGHT})`,
              border: "none", color: NAVY_950,
              fontSize: 14, fontWeight: 800, cursor: "pointer",
              fontFamily: MONO, letterSpacing: "0.04em",
            }}
          >
            ⏱ Start a Turnaround Session
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: SILVER_600 }}>
            Upload documents · Deploy 6 agents · Receive unified crisis plan
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&display=swap');
      `}</style>
    </div>
  );
}
