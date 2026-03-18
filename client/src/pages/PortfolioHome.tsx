import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

// ── Brand palette ─────────────────────────────────────────────────────────────
const NAVY_950 = "#080F1E";
const NAVY_900 = "#0C1628";
const NAVY_800 = "#111E35";
const NAVY_700 = "#162440";
const STEEL = "#1E2D47";
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const SILVER_50 = "#F0F4FA";
const SILVER_200 = "#C8D4E8";
const SILVER_400 = "#8494AA";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const WORKFLOWS = [
  {
    id: "portfolio-intel",
    icon: "⚖️",
    title: "Portfolio Intelligence Engine",
    subtitle: "IC Decision · Guardian · Crisis Simulation",
    description:
      "Three institutional-grade workflows powered by 12 specialist agents. Run IC Decision Engine (INVEST/WATCH/REJECT), Guardian Mode (always-on monitoring), or Crisis Simulation (stress testing).",
    badge: "Live",
    badgeColor: "#4ADE80",
    href: "/portfolio/intel",
    accent: GOLD,
    accentLight: GOLD_LIGHT,
  },
  {
    id: "portfolio-review",
    icon: "📋",
    title: "Portfolio Review",
    subtitle: "GP Accountability Intelligence",
    description:
      "Upload GP quarterly reports and investment mandates. Receive a structured 25-page institutional review assessing whether the fund manager is executing the strategy they communicated.",
    badge: "Live",
    badgeColor: "#4ADE80",
    href: "/portfolio-review/upload",
    accent: GOLD,
    accentLight: GOLD_LIGHT,
  },
  {
    id: "turnaround",
    icon: "⏱️",
    title: "100-Hour Turnaround",
    subtitle: "Crisis Management Intelligence",
    description:
      "Deploy 6 specialist agents across finance, customer, operations, communications, and compliance. Receive a unified crisis response plan with a 100-hour countdown.",
    badge: "Live",
    badgeColor: "#F59E0B",
    href: "/turnaround",
    accent: "#F59E0B",
    accentLight: "#FCD34D",
  },
  {
    id: "risk-analysis",
    icon: "⚠️",
    title: "Risk Analysis",
    subtitle: "Portfolio Risk Signals",
    description:
      "Identify concentration risk, mandate drift, and emerging risk signals across your entire portfolio in a single report.",
    badge: "Coming Soon",
    badgeColor: SILVER_400,
    href: null,
    accent: "#F59E0B",
    accentLight: "#FCD34D",
  },
  {
    id: "fund-comparison",
    icon: "⚖️",
    title: "Fund Comparison",
    subtitle: "Peer Benchmarking",
    description:
      "Compare multiple fund managers side-by-side on strategy adherence, performance attribution, and narrative consistency.",
    badge: "Coming Soon",
    badgeColor: SILVER_400,
    href: null,
    accent: "#A78BFA",
    accentLight: "#C4B5FD",
  },
];

export default function PortfolioHome() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const handleCardClick = (wf: typeof WORKFLOWS[0]) => {
    if (!wf.href) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl("/portfolio-review/upload");
      return;
    }
    navigate(wf.href);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: NAVY_950,
      fontFamily: FONT,
      color: SILVER_50,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Ambient glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "5%", left: "10%", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, ${GOLD}08 0%, transparent 65%)`, filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(123,163,212,0.06) 0%, transparent 65%)", filter: "blur(80px)" }} />
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
        <a href="/" style={{ textDecoration: "none" }}>
          <Logo />
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/vault" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Vault
          </a>
          <a href="/ask" style={{ color: SILVER_400, fontSize: 13, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
            onMouseLeave={e => (e.currentTarget.style.color = SILVER_400)}>
            Mesh
          </a>
          {isAuthenticated ? (
            <a href="/history" style={{
              color: SILVER_50, fontSize: 13, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${GOLD}25, ${GOLD}15)`,
              border: `1px solid ${GOLD}40`,
            }}>History</a>
          ) : (
            <a href={getLoginUrl()} style={{
              color: SILVER_50, fontSize: 13, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${GOLD}25, ${GOLD}15)`,
              border: `1px solid ${GOLD}40`,
            }}>Sign in</a>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        position: "relative", zIndex: 1,
        flex: 1,
        maxWidth: 1100,
        margin: "0 auto",
        width: "100%",
        padding: "64px 40px 80px",
        boxSizing: "border-box",
      }}>
        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 6,
            background: `${GOLD}10`, border: `1px solid ${GOLD}30`,
            fontFamily: MONO, fontSize: 11, color: GOLD,
            letterSpacing: "0.06em", marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}`, display: "inline-block" }} />
            PORTFOLIO INTELLIGENCE
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(32px, 4.5vw, 54px)",
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: SILVER_50,
            marginBottom: 16,
          }}>
            Institutional-grade analysis.<br />
            <span style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              In minutes, not weeks.
            </span>
          </h1>

          <p style={{
            fontSize: 16,
            color: SILVER_400,
            lineHeight: 1.7,
            maxWidth: 580,
          }}>
            AgenThink Portfolio Intelligence produces the analysis your investment committee expects — without the three-week analyst turnaround. Upload your fund documents and receive a structured review ready for IC presentation.
          </p>
        </div>

        {/* Workflow cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
          gap: 20,
        }}>
          {WORKFLOWS.map(wf => {
            const isHovered = hoveredCard === wf.id;
            const isAvailable = wf.href !== null;
            return (
              <div
                key={wf.id}
                onClick={() => handleCardClick(wf)}
                onMouseEnter={() => setHoveredCard(wf.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: isHovered && isAvailable ? NAVY_800 : NAVY_900,
                  border: `1px solid ${isHovered && isAvailable ? wf.accent + "50" : STEEL}`,
                  borderRadius: 16,
                  padding: "28px 32px",
                  cursor: isAvailable ? "pointer" : "default",
                  transition: "all 0.2s ease",
                  boxShadow: isHovered && isAvailable ? `0 0 40px ${wf.accent}10, 0 8px 32px rgba(0,0,0,0.3)` : "0 2px 12px rgba(0,0,0,0.2)",
                  opacity: isAvailable ? 1 : 0.6,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Accent line */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: isAvailable ? `linear-gradient(90deg, ${wf.accent}, ${wf.accentLight}, transparent)` : "transparent",
                  opacity: isHovered ? 1 : 0.4,
                  transition: "opacity 0.2s",
                }} />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: `${wf.accent}15`,
                      border: `1px solid ${wf.accent}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                    }}>
                      {wf.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: SILVER_50, lineHeight: 1.2 }}>{wf.title}</div>
                      <div style={{ fontSize: 11, color: wf.accent, fontFamily: MONO, letterSpacing: "0.04em", marginTop: 2 }}>{wf.subtitle}</div>
                    </div>
                  </div>
                  <span style={{
                    padding: "3px 10px", borderRadius: 20,
                    fontSize: 10, fontFamily: MONO, fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: wf.badgeColor,
                    background: `${wf.badgeColor}15`,
                    border: `1px solid ${wf.badgeColor}30`,
                    whiteSpace: "nowrap",
                  }}>
                    {wf.badge}
                  </span>
                </div>

                <p style={{ fontSize: 14, color: SILVER_400, lineHeight: 1.65, marginBottom: isAvailable ? 20 : 0 }}>
                  {wf.description}
                </p>

                {isAvailable && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 13, fontWeight: 600, color: wf.accent,
                    fontFamily: MONO,
                    transition: "gap 0.2s",
                  }}>
                    Start Review
                    <span style={{ fontSize: 16, transition: "transform 0.2s", transform: isHovered ? "translateX(4px)" : "none" }}>→</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats bar */}
        <div style={{
          marginTop: 56,
          padding: "20px 32px",
          background: NAVY_800,
          border: `1px solid ${STEEL}`,
          borderRadius: 12,
          display: "flex",
          gap: 48,
          flexWrap: "wrap",
        }}>
          {[
            { label: "Analysis Agents", value: "12 Specialists" },
            { label: "IC Decision Time", value: "< 5 minutes" },
            { label: "Active Workflows", value: "3 Live" },
            { label: "Supported Formats", value: "PDF, DOCX, XLSX, PPTX" },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: 18, fontWeight: 700, color: SILVER_50, fontFamily: MONO }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: SILVER_600, marginTop: 2, letterSpacing: "0.04em" }}>{stat.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
