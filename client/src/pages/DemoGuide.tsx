/**
 * DemoGuide.tsx — /demo-guide
 *
 * Companion reference page for the VoiceDemoAgent.
 * Covers: 8-step agenda, Q&A category map, live demo instructions,
 * council persona reference, and contact CTAs.
 */
import { Link } from "wouter";

const BG = "#070d1a";
const NAVY = "#0b1629";
const NAVY_800 = "#0f1e35";
const CYAN = "#06b6d4";
const GOLD = "#f59e0b";
const WHITE = "#f1f5f9";
const MUTED = "#64748b";
const BORDER = "#1e3a5f";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

const STEPS = [
  { id: 1, title: "Welcome to AgenThinkMesh", tag: "Platform overview", duration: "~2 min" },
  { id: 2, title: "The Council of 10", tag: "Agent roles", duration: "~3 min" },
  { id: 3, title: "Submit Any Deal", tag: "Input formats", duration: "~2 min" },
  { id: 4, title: "Adversarial Debate", tag: "Consensus mechanics", duration: "~3 min" },
  { id: 5, title: "Shariah & Governance Layer", tag: "AAOIFI compliance", duration: "~2 min" },
  { id: 6, title: "Sovereign AI Infrastructure", tag: "SADO + encryption", duration: "~2 min" },
  { id: 7, title: "Verdict & Audit Replay", tag: "Explainability", duration: "~2 min" },
  { id: 8, title: "Run Your Own Deal", tag: "Live demo", duration: "~5 min" },
];

const PERSONAS = [
  { name: "Valuation Analyst", mandate: "DCF, comparables, fair value range", color: CYAN },
  { name: "Risk Sentinel", mandate: "Tail risk, concentration breach, VaR", color: "#ef4444" },
  { name: "Macro Strategist", mandate: "Rate environment, geopolitical exposure", color: "#8b5cf6" },
  { name: "Shariah Officer", mandate: "AAOIFI screening, riba, gharar", color: "#22c55e" },
  { name: "Challenger", mandate: "Devil's advocate — finds every flaw", color: GOLD },
  { name: "Concentration Monitor", mandate: "Issuer/sector/geography limits", color: "#f97316" },
  { name: "ESG Screener", mandate: "ESG scoring, exclusion lists", color: "#10b981" },
  { name: "Governance Auditor", mandate: "Audit trail, escalation log", color: "#94a3b8" },
  { name: "Jurisdiction Router", mandate: "Cross-border compliance, SADO routing", color: "#6366f1" },
  { name: "Synthesis Chair", mandate: "Aggregates votes, produces final verdict", color: WHITE },
];

const QA_CATEGORIES = [
  { cat: "council_mechanics", label: "Council Mechanics", example: "How does the 80% consensus threshold work?" },
  { cat: "agent_roles", label: "Agent Roles", example: "What does the Challenger agent do?" },
  { cat: "shariah_compliance", label: "Shariah Compliance", example: "Is the Shariah screen AAOIFI-certified?" },
  { cat: "sovereign_ai", label: "Sovereign AI", example: "Where is my data processed?" },
  { cat: "pricing_and_access", label: "Pricing & Access", example: "How much does it cost?" },
  { cat: "integration", label: "Integration", example: "Can I connect Bloomberg data?" },
  { cat: "data_security", label: "Data Security", example: "Who holds the encryption key?" },
  { cat: "use_cases", label: "Use Cases", example: "Can I use this for sukuk allocation?" },
  { cat: "deal_types", label: "Deal Types", example: "Does it support sovereign portfolios?" },
  { cat: "performance_and_latency", label: "Performance & Latency", example: "How fast is a council evaluation?" },
  { cat: "governance_and_audit", label: "Governance & Audit", example: "Can I replay a past decision?" },
  { cat: "onboarding", label: "Onboarding", example: "How do I get started?" },
  { cat: "comparison", label: "Comparison", example: "How is this different from GPT-4?" },
  { cat: "other", label: "Other", example: "Anything not covered above" },
];

export default function DemoGuide() {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: NAVY }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${CYAN}, #6366f1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>A</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>AgenThinkMesh</span>
          <span style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, borderRadius: 20, padding: "2px 10px", fontSize: 10, color: GOLD, fontFamily: MONO }}>DEMO GUIDE</span>
        </div>
        <Link href="/voice-demo">
          <a style={{ background: `${CYAN}20`, border: `1px solid ${CYAN}40`, borderRadius: 8, padding: "8px 16px", color: CYAN, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
            ▶ Start Guided Demo
          </a>
        </Link>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginBottom: 12 }}>WEBINAR COMPANION REFERENCE</div>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: WHITE, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 16 }}>
            AgenThinkMesh<br /><span style={{ color: CYAN }}>Demo Guide</span>
          </h1>
          <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.7, maxWidth: 560 }}>
            This guide covers the 8-step guided demo flow, the Council of 10 persona reference, the Q&A category map, and live demo instructions for the participant-driven session.
          </p>
        </div>

        {/* 8-step agenda */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: WHITE, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${CYAN}20`, border: `1px solid ${CYAN}40`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: CYAN }}>1</span>
            8-Step Demo Agenda
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {STEPS.map(s => (
              <div key={s.id} style={{ display: "flex", gap: 16, alignItems: "center", background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${CYAN}15`, border: `1px solid ${CYAN}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: CYAN, fontFamily: MONO, fontWeight: 700, flexShrink: 0 }}>{s.id}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginTop: 2 }}>{s.tag}</div>
                </div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{s.duration}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 16px", background: `${GOLD}10`, border: `1px solid ${GOLD}30`, borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: GOLD }}>Total estimated runtime: ~25 min guided + 10 min live demo + Q&A</span>
          </div>
        </section>

        {/* Council of 10 */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: WHITE, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${CYAN}20`, border: `1px solid ${CYAN}40`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: CYAN }}>2</span>
            Council of 10 — Persona Reference
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {PERSONAS.map(p => (
              <div key={p.name} style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.color, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{p.mandate}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Q&A category map */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: WHITE, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${CYAN}20`, border: `1px solid ${CYAN}40`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: CYAN }}>3</span>
            Q&A Category Map (14 categories)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {QA_CATEGORIES.map(q => (
              <div key={q.cat} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px" }}>
                <span style={{ background: `${CYAN}15`, border: `1px solid ${CYAN}25`, borderRadius: 6, padding: "3px 8px", fontSize: 10, color: CYAN, fontFamily: MONO, flexShrink: 0, marginTop: 1 }}>{q.cat}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{q.label}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontStyle: "italic" }}>e.g. "{q.example}"</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live demo instructions */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: WHITE, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${CYAN}20`, border: `1px solid ${CYAN}40`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: CYAN }}>4</span>
            Live Demo — Step 8 Instructions
          </h2>
          <div style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { step: "1", text: "Kishore runs the 60-second agent-led intro — no narration, Mesh hosts itself. URL: agenthink-7enctkan.manus.space" },
                { step: "2", text: "Open the submission window: attendees paste their own deal memo, contract, or portfolio scenario into the live URL." },
                { step: "3", text: "Farouq pulls 2–3 submissions onto screen and narrates the Council output in real time." },
                { step: "4", text: "If live submissions are thin, fall back to scripted demos: VC seed round · Dubai broker mandate · Shariah RM portfolio." },
              ].map(({ step, text }) => (
                <div key={step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${GOLD}20`, border: `1px solid ${GOLD}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: GOLD, fontFamily: MONO, fontWeight: 700, flexShrink: 0 }}>{step}</div>
                  <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: "12px 16px", background: `${CYAN}08`, border: `1px solid ${CYAN}20`, borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: CYAN, fontFamily: MONO }}>LIVE URL: </span>
              <a href="https://agenthink-7enctkan.manus.space" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: CYAN, textDecoration: "underline" }}>agenthink-7enctkan.manus.space</a>
            </div>
          </div>
        </section>

        {/* CTAs */}
        <section>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/voice-demo">
              <a style={{ background: `linear-gradient(135deg, ${CYAN}, #6366f1)`, border: "none", borderRadius: 8, padding: "12px 24px", color: "#0a1220", fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>
                ▶ Start Guided Demo
              </a>
            </Link>
            <a
              href="https://agenthink-7enctkan.manus.space"
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "12px 20px", color: GOLD, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
            >
              ⚡ Open Live Platform
            </a>
            <a
              href="mailto:farouq@agenthink.com?subject=AgenThinkMesh%20Demo%20Request"
              style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 20px", color: MUTED, fontSize: 14, textDecoration: "none" }}
            >
              📧 Contact Team
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
