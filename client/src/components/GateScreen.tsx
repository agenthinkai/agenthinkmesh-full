/**
 * GateScreen — pre-login interstitial shown to unauthenticated users
 * who land on any protected route.
 *
 * Shows the free trial value proposition prominently before the Sign In CTA
 * so users understand the offer before committing to OAuth.
 */
import { getLoginUrl } from "@/const";

const NAVY_950 = "#0B1629";
const NAVY_900 = "#0F1E38";
const NAVY_800 = "#152340";
const CYAN = "#00D4FF";
const INDIGO = "#4060FF";
const WHITE = "#F0F4FA";
const MUTED = "#8BA3C4";
const GOLD = "#F5C842";
const MONO = "'JetBrains Mono', 'Fira Mono', monospace";

interface GateScreenProps {
  /** Optional context hint, e.g. "Rosie Protocol" or "Document Vault" */
  feature?: string;
}

export default function GateScreen({ feature }: GateScreenProps) {
  const loginUrl = getLoginUrl();

  const perks = [
    { icon: "⚡", label: "50 full pipeline runs" },
    { icon: "🗓️", label: "60 days free access" },
    { icon: "💳", label: "No credit card required" },
    { icon: "🔒", label: "Cancel anytime" },
  ];

  const features = [
    { icon: "🧬", name: "Rosie Protocol", desc: "6-agent clinical research pipeline" },
    { icon: "📈", name: "ETF Launch Studio", desc: "Shariah-compliant ETF design & backtest" },
    { icon: "⚖️", name: "Legal Mesh", desc: "Force majeure & contract analysis" },
    { icon: "💼", name: "GCC Wealth Agents", desc: "Portfolio review & turnaround engine" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${NAVY_950} 0%, ${NAVY_900} 50%, ${NAVY_800} 100%)`,
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "5%", left: "10%", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, ${CYAN}10 0%, transparent 70%)`, filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${INDIGO}10 0%, transparent 70%)`, filter: "blur(80px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 560, width: "100%", textAlign: "center" }}>

        {/* Logo / brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${CYAN}, ${INDIGO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>A</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: WHITE, letterSpacing: "-0.02em" }}>AgenThinkMesh</span>
        </div>

        {/* Feature context badge */}
        {feature && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${CYAN}12`, border: `1px solid ${CYAN}30`, borderRadius: 20, padding: "4px 14px", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: CYAN, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: CYAN, fontFamily: MONO, letterSpacing: "0.06em" }}>{feature.toUpperCase()}</span>
          </div>
        )}

        {/* Headline */}
        <h1 style={{ fontSize: 36, fontWeight: 800, color: WHITE, lineHeight: 1.15, marginBottom: 12, letterSpacing: "-0.03em" }}>
          Start free.<br />
          <span style={{ color: CYAN }}>No credit card.</span>
        </h1>

        {/* Sub-headline */}
        <p style={{ fontSize: 16, color: MUTED, marginBottom: 32, lineHeight: 1.6 }}>
          Get full access to every AI agent and workflow on AgenThinkMesh — completely free for 60 days.
        </p>

        {/* Perk pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 36 }}>
          {perks.map(p => (
            <div key={p.label} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: `${CYAN}08`, border: `1px solid ${CYAN}20`,
              borderRadius: 20, padding: "6px 14px",
            }}>
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <span style={{ fontSize: 13, color: WHITE, fontWeight: 500 }}>{p.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href={loginUrl}
          style={{
            display: "inline-block",
            background: `linear-gradient(135deg, ${CYAN}, ${INDIGO})`,
            color: "#0B1629",
            fontWeight: 700,
            fontSize: 15,
            padding: "14px 40px",
            borderRadius: 10,
            textDecoration: "none",
            letterSpacing: "0.01em",
            marginBottom: 14,
            boxShadow: `0 0 32px ${CYAN}30`,
            transition: "opacity 0.15s",
          }}
        >
          Start Free — Sign In with Manus
        </a>

        <p style={{ fontSize: 12, color: MUTED, marginBottom: 40, fontFamily: MONO }}>
          Free for 60 days · 50 runs · No credit card required
        </p>

        {/* Feature grid */}
        <div style={{
          background: `${NAVY_800}80`,
          border: `1px solid ${CYAN}15`,
          borderRadius: 16,
          padding: "20px 24px",
          textAlign: "left",
        }}>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: MONO, letterSpacing: "0.08em", marginBottom: 14 }}>INCLUDED IN YOUR FREE TRIAL</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {features.map(f => (
              <div key={f.name} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gold trust line */}
        <p style={{ fontSize: 11, color: GOLD, fontFamily: MONO, marginTop: 24, letterSpacing: "0.05em" }}>
          Trusted by institutional teams across the GCC
        </p>
      </div>
    </div>
  );
}
