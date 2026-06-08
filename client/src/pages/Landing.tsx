import React, { useState } from "react";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import SiteNav from "@/components/SiteNav";

// ── Brand palette ─────────────────────────────────────────────────────────────
const NAVY_950 = "#0B1629";
const NAVY_900 = "#0F1E38";
const NAVY_800 = "#152542";
const NAVY_700 = "#1C3057";
const NAVY_600 = "#243B6E";
const SILVER_50  = "#F5F7FA";
const SILVER_100 = "#E8ECF2";
const SILVER_300 = "#A8B4C8";
const SILVER_400 = "#8494AA";
const SILVER_500 = "#637080";
const GOLD        = "#C9A84C";
const BLUE_400    = "#7BA3D4";
const BLUE_300    = "#60C8F5";
const GREEN_400   = "#4ADE80";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: NAVY_800,
  border: `1px solid ${NAVY_700}`,
  borderRadius: 14,
  ...extra,
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: SILVER_400, textTransform: "uppercase" as const,
      letterSpacing: "0.12em", fontFamily: MONO, marginBottom: 14, fontWeight: 600,
    }}>{children}</div>
  );
}

// ── SECTION 1 — HERO ─────────────────────────────────────────────────────────
function Hero({ loginUrl }: { loginUrl: string }) {
  return (
    <section style={{
      padding: "96px 24px 80px",
      background: `linear-gradient(180deg, ${NAVY_950} 0%, ${NAVY_900} 100%)`,
      borderBottom: `1px solid ${NAVY_700}`,
      position: "relative" as const,
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute" as const, inset: 0, opacity: 0.04,
        backgroundImage: `linear-gradient(${BLUE_400} 1px, transparent 1px), linear-gradient(90deg, ${BLUE_400} 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
        pointerEvents: "none" as const,
      }} />
      <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" as const, zIndex: 1 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 14px", borderRadius: 6,
          background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)",
          fontFamily: MONO, fontSize: 11, color: GREEN_400, letterSpacing: "0.05em", marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN_400, boxShadow: `0 0 8px ${GREEN_400}`, display: "inline-block" }} />
          Governed Decision Infrastructure · Live
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "clamp(38px, 6vw, 72px)",
          fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em",
          color: SILVER_50, marginBottom: 28,
        }}>
          Governed Decision{" "}
          <span style={{
            background: `linear-gradient(120deg, ${BLUE_300} 0%, ${BLUE_400} 50%, ${GREEN_400} 100%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>Infrastructure</span>
        </h1>

        <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: SILVER_300, maxWidth: 680, lineHeight: 1.65, marginBottom: 20, fontWeight: 500 }}>
          AgenThink Mesh helps institutions make, govern, stress-test, and defend high-consequence decisions.
        </p>

        <p style={{ fontSize: 15, color: SILVER_400, maxWidth: 680, lineHeight: 1.8, marginBottom: 48 }}>
          Every recommendation is evaluated by a Council of Specialists, tested against a versioned Constitution,
          calibrated against historical outcomes, stress-tested across thousands of scenarios, and backed by a
          machine-verifiable Proof Report.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const, marginBottom: 64 }}>
          <Link href="/deals">
            <a style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 8, fontWeight: 700, fontSize: 15,
              background: BLUE_400, color: NAVY_950, textDecoration: "none",
            }}>
              Explore Platform →
            </a>
          </Link>
          <a href="#proof-report" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 32px", borderRadius: 8, fontWeight: 600, fontSize: 15,
            background: "transparent", color: SILVER_300,
            border: `1px solid ${NAVY_600}`, textDecoration: "none",
          }}>
            View Sample Proof Report
          </a>
        </div>

        <div style={{
          display: "flex", gap: 0, flexWrap: "wrap" as const,
          borderTop: `1px solid ${NAVY_700}`, paddingTop: 32,
        }}>
          {[
            { num: "1,000+",  label: "Institutional Deals" },
            { num: "48",      label: "Countries" },
            { num: "90,000",  label: "Evaluations" },
            { num: "30",      label: "Governance Tests" },
            { num: "∞",       label: "Proof Reports" },
          ].map((item, i) => (
            <div key={i} style={{
              flex: "1 1 140px", padding: "16px 24px",
              borderRight: i < 4 ? `1px solid ${NAVY_700}` : "none",
            }}>
              <div style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800, color: BLUE_400, fontFamily: MONO, letterSpacing: "-0.02em", marginBottom: 4 }}>{item.num}</div>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── SOLUTIONS NAV ───────────────────────────────────────────────────────────────
const SOLUTIONS = [
  { label: "Real Estate Council", href: "/real-estate" },
  { label: "Deal Screener",       href: "/deals" },
  { label: "Infrastructure",      href: "/deals" },
  { label: "Procurement",         href: "/deals" },
  { label: "SADO",                href: "/deals" },
];

function SolutionsNav() {
  return (
    <div style={{
      background: NAVY_900, borderBottom: `1px solid ${NAVY_700}`,
      padding: "0 24px",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "flex", alignItems: "center", gap: 0,
        overflowX: "auto" as const,
      }}>
        <span style={{ fontSize: 10, color: SILVER_500, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginRight: 20, flexShrink: 0, paddingTop: 1 }}>Solutions</span>
        {SOLUTIONS.map((s, i) => (
          <a key={i} href={s.href} style={{
            display: "inline-block", padding: "14px 18px",
            fontSize: 12, fontWeight: 600, color: SILVER_400,
            textDecoration: "none", whiteSpace: "nowrap" as const,
            borderBottom: "2px solid transparent",
            fontFamily: MONO, letterSpacing: "0.04em",
            transition: "color 0.15s",
          }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = SILVER_100; (e.target as HTMLElement).style.borderBottomColor = BLUE_400; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = SILVER_400; (e.target as HTMLElement).style.borderBottomColor = "transparent"; }}
          >{s.label}</a>
        ))}
      </div>
    </div>
  );
}

// ── SECTION 2 — PROCESS FLOW ─────────────────────────────────────────────────
const PROCESS_STEPS = [
  { step: "01", title: "Decision Submitted",       desc: "A high-consequence decision — investment, infrastructure, procurement, or strategic — is submitted for evaluation.", color: BLUE_400 },
  { step: "02", title: "Council of 10",            desc: "Ten specialist perspectives deliberate in parallel. Each persona applies domain expertise, stress-tests assumptions, and records a structured verdict.", color: BLUE_300 },
  { step: "03", title: "Constitution Check",       desc: "Every recommendation is evaluated against a versioned Constitution. BLOCK violations prevent release. WARN findings are logged for review.", color: "#A78BFA" },
  { step: "04", title: "Calibration Review",       desc: "Persona weights are adjusted based on historical accuracy. The system learns which perspectives have been most reliable over time.", color: GREEN_400 },
  { step: "05", title: "Stress Testing",           desc: "The decision is evaluated across thousands of scenarios — rate shocks, regulatory shifts, market dislocations, and geopolitical events.", color: GOLD },
  { step: "06", title: "Institutional Proof Report", desc: "A machine-verifiable evidence chain is produced. Every conclusion references a decision ID, rule version, finding ID, and audit reference.", color: BLUE_400 },
];

function ProcessFlow() {
  return (
    <section style={{ padding: "80px 24px", background: NAVY_950 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const, marginBottom: 56 }}>
          <SectionLabel>How Decisions Become Defensible</SectionLabel>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>
            From submission to proof record
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {PROCESS_STEPS.map((s, i) => (
            <div key={i} style={{ ...card({ padding: "28px 24px" }), borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 11, color: s.color, fontFamily: MONO, marginBottom: 10, fontWeight: 700, letterSpacing: "0.08em" }}>{s.step}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: SILVER_50, marginBottom: 10 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.8 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── SECTION 3 — CAPABILITIES ─────────────────────────────────────────────────
const CAPABILITIES = [
  { icon: "⚖️", title: "Council of 10",           desc: "Ten specialist perspectives evaluate every decision in parallel, each recording a structured verdict with rationale and confidence score.", color: BLUE_400 },
  { icon: "📜", title: "Constitutional Governance", desc: "A versioned Constitution defines mandatory governance constraints. BLOCK violations prevent release. Every rule change is versioned and traceable.", color: "#A78BFA" },
  { icon: "📊", title: "Outcome Calibration",      desc: "The Calibration Loop scores each persona's historical accuracy using Brier scoring and adjusts weights accordingly.", color: GREEN_400 },
  { icon: "🔬", title: "Strategic Stress Testing", desc: "Every decision is tested across thousands of scenarios — rate shocks, regulatory shifts, market dislocations, and geopolitical events.", color: GOLD },
  { icon: "🔐", title: "Institutional Proof",      desc: "Every conclusion in the Proof Report references a decision ID, rule version, finding ID, and audit reference. No conclusion without a traceable source.", color: BLUE_300 },
  { icon: "📋", title: "Audit & Traceability",     desc: "The unified audit log records every evaluation, finding, weight change, and Constitution version in an immutable append-only log.", color: "#F97316" },
];

function Capabilities() {
  return (
    <section style={{ padding: "80px 24px", background: NAVY_900 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const, marginBottom: 56 }}>
          <SectionLabel>Platform Capabilities</SectionLabel>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>
            Six layers of governed decision infrastructure
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {CAPABILITIES.map((cap, i) => (
            <div key={i} style={{ ...card({ padding: "28px 24px" }), borderTop: `3px solid ${cap.color}` }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{cap.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: SILVER_50, marginBottom: 10 }}>{cap.title}</div>
              <div style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.8 }}>{cap.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PROOF REPORT BANNER ─────────────────────────────────────────────────────────
function ProofReportBanner() {
  return (
    <section id="proof-report" style={{
      padding: "48px 24px",
      background: `linear-gradient(135deg, ${NAVY_900} 0%, #0D1F3C 100%)`,
      borderTop: `1px solid ${NAVY_700}`,
      borderBottom: `1px solid ${NAVY_700}`,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          ...card({ padding: "40px 40px" }),
          borderLeft: `5px solid ${BLUE_300}`,
          display: "flex", alignItems: "flex-start", gap: 32,
          flexWrap: "wrap" as const,
        }}>
          <div style={{ fontSize: 48, flexShrink: 0 }}>🔐</div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: SILVER_50 }}>Institutional Proof Report</span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: GREEN_400,
                background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)",
                borderRadius: 4, padding: "3px 9px", fontFamily: MONO, letterSpacing: "0.12em",
              }}>NEW</span>
            </div>
            <p style={{ fontSize: 15, color: SILVER_300, lineHeight: 1.8, marginBottom: 20, maxWidth: 680 }}>
              Machine-verifiable explanation of every recommendation. Every conclusion references a decision ID,
              rule version, finding ID, and audit reference. No conclusion without a traceable source.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 24 }}>
              {["PDF", "JSON"].map(fmt => (
                <span key={fmt} style={{
                  padding: "6px 16px", borderRadius: 6,
                  background: `${BLUE_300}14`, border: `1px solid ${BLUE_300}40`,
                  fontSize: 12, fontWeight: 700, color: BLUE_300,
                  fontFamily: MONO, letterSpacing: "0.08em",
                }}>{fmt}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
              {[
                "13 structured sections",
                "Versioned Constitution reference",
                "Release gate determination",
                "Full audit trail",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: SILVER_400, fontFamily: MONO }}>
                  <span style={{ color: GREEN_400, fontSize: 10 }}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0, alignSelf: "center" as const }}>
            <a href="/deals" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 28px", borderRadius: 8, fontWeight: 700, fontSize: 14,
              background: BLUE_300, color: NAVY_950, textDecoration: "none",
            }}>
              Generate Report →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── SECTION 4 — REPORTS ───────────────────────────────────────────────────────
const REPORTS = [
  { title: "IC Memo",                      purpose: "Investment Committee-ready verdict with Council deliberation, risk flags, and structured rationale.", audience: "Investment Committees, Portfolio Managers, GPs",           icon: "📄", color: BLUE_400,  isNew: false },
  { title: "Investment Readiness Report",  purpose: "Comprehensive assessment of deal readiness across financial, legal, regulatory, and strategic dimensions.", audience: "Deal Teams, Due Diligence Officers, LPs",              icon: "📊", color: GREEN_400, isNew: false },
  { title: "Strategic Stress Test Report", purpose: "Scenario analysis across thousands of market conditions, regulatory environments, and geopolitical events.", audience: "Risk Officers, CIOs, Infrastructure Investors",         icon: "🔬", color: GOLD,      isNew: false },
  { title: "AI IC Interpretation Guidance", purpose: "Plain-language interpretation of AI Council outputs for human decision-makers and governance committees.", audience: "Boards, Governance Committees, Compliance Officers",   icon: "🧭", color: "#A78BFA", isNew: false },
  { title: "Institutional Proof Report",   purpose: "Machine-verifiable evidence chain. Every conclusion references a decision ID, rule version, finding ID, and audit reference. The complete governance record.", audience: "Regulators, Auditors, LPs, Institutional Boards", icon: "🔐", color: BLUE_300,  isNew: true  },
];

function Reports() {
  return (
    <section style={{ padding: "80px 24px", background: NAVY_950 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const, marginBottom: 56 }}>
          <SectionLabel>Exportable Artifacts</SectionLabel>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>
            Every decision produces a defensible record
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 16 }}>
          {REPORTS.map((r, i) => (
            <Link key={i} href="/deals">
              <a style={{ textDecoration: "none" }}>
                <div style={{
                  ...card({ padding: "24px 28px" }),
                  display: "flex", alignItems: "flex-start", gap: 20,
                  borderLeft: `4px solid ${r.color}`,
                  cursor: "pointer",
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{r.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: SILVER_50 }}>{r.title}</span>
                      {r.isNew && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: GREEN_400, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 4, padding: "2px 7px", fontFamily: MONO, letterSpacing: "0.1em" }}>NEW</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.7, margin: "0 0 8px" }}>{r.purpose}</p>
                    <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, letterSpacing: "0.05em" }}>Audience: {r.audience}</div>
                  </div>
                  <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, flexShrink: 0, marginTop: 4 }}>PDF ↗</div>
                </div>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── SECTION 5 — WHY INSTITUTIONS ─────────────────────────────────────────────
const WHY = [
  { title: "Decision Quality",  desc: "More perspectives, fewer blind spots. Ten specialist viewpoints — financial, legal, risk, sector, geopolitical — evaluate every decision before capital is committed.", icon: "🎯", color: BLUE_400 },
  { title: "Governance",        desc: "Constitutional controls and release gates. A versioned Constitution defines mandatory constraints. BLOCK violations prevent release. Every rule change is logged and traceable.", icon: "📜", color: "#A78BFA" },
  { title: "Defensibility",     desc: "Recommendations backed by evidence and audit trails. Every conclusion in the Proof Report references a traceable source. No recommendation without a verifiable chain of evidence.", icon: "🔐", color: GREEN_400 },
];

function WhyInstitutions() {
  return (
    <section style={{ padding: "80px 24px", background: NAVY_800 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const, marginBottom: 56 }}>
          <SectionLabel>Why Institutions Use It</SectionLabel>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>
            Built for high-consequence decisions
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {WHY.map((w, i) => (
            <div key={i} style={{ textAlign: "center" as const, padding: "40px 28px" }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 20px", background: `${w.color}14`, border: `1px solid ${w.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{w.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: SILVER_50, marginBottom: 12 }}>{w.title}</div>
              <div style={{ fontSize: 14, color: SILVER_300, lineHeight: 1.8 }}>{w.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── SECTION 6 — EVIDENCE & SCALE ─────────────────────────────────────────────
const METRICS = [
  { num: "1,000+",          label: "Institutional Deals",   desc: "Evaluated across investment, infrastructure, procurement, and strategic decisions" },
  { num: "48",              label: "Countries",             desc: "Institutions across GCC, Europe, Asia, and emerging markets" },
  { num: "90,000",          label: "Evaluations",           desc: "Stress test evaluations at 99.95% completion rate" },
  { num: "30",              label: "Acceptance Tests",      desc: "Governance invariants verified on every build" },
  { num: "Versioned",       label: "Constitution",          desc: "Every rule change is versioned, audited, and traceable" },
  { num: "Machine-Verifiable", label: "Proof Reports",     desc: "Every conclusion references a traceable artifact ID" },
];

function EvidenceAndScale() {
  return (
    <section style={{ padding: "80px 24px", background: NAVY_950 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center" as const, marginBottom: 56 }}>
          <SectionLabel>Evidence &amp; Scale</SectionLabel>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>
            Platform metrics
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1, background: NAVY_700, borderRadius: 16, overflow: "hidden" }}>
          {METRICS.map((m, i) => (
            <div key={i} style={{ background: NAVY_900, padding: "32px 28px" }}>
              <div style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800, color: BLUE_400, fontFamily: MONO, letterSpacing: "-0.02em", marginBottom: 6 }}>{m.num}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_100, marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.06em", fontFamily: MONO }}>{m.label}</div>
              <div style={{ fontSize: 12, color: SILVER_400, lineHeight: 1.65 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CONTACT ───────────────────────────────────────────────────────────────────
function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_ACCESS_KEY,
          subject: `New Contact from AgenThinkMesh: ${form.name}`,
          name: form.name, email: form.email,
          company: form.company || "Not provided",
          message: form.message,
          from_name: "AgenThinkMesh Contact Form",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setForm({ name: "", email: "", company: "", message: "" });
        toast.success("Message sent! We'll be in touch shortly.");
      } else { throw new Error(data.message || "Submission failed"); }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    } finally { setSending(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px",
    background: "rgba(255,255,255,0.04)", border: `1px solid ${NAVY_700}`,
    borderRadius: 10, fontSize: 14, color: SILVER_50,
    fontFamily: FONT, outline: "none", boxSizing: "border-box",
  };

  return (
    <section id="contact" style={{ padding: "80px 0", background: NAVY_900, borderTop: `1px solid ${NAVY_700}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
        <div>
          <SectionLabel>Contact Us</SectionLabel>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: SILVER_50, marginBottom: 20, lineHeight: 1.1 }}>
            Let's talk about<br /><span style={{ color: BLUE_400 }}>your use case.</span>
          </h2>
          <p style={{ fontSize: 15, color: SILVER_300, lineHeight: 1.8, marginBottom: 40 }}>
            Whether you're evaluating infrastructure investments, managing sovereign capital, or building governance
            frameworks — we'd like to understand your decision environment.
          </p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
            {[
              { icon: "✉", label: "Email",   value: "info@agenthink.ai" },
              { icon: "🌐", label: "Website", value: "agenthinkmesh.com" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${BLUE_400}14`, border: `1px solid ${NAVY_700}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, color: SILVER_100, fontWeight: 500 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: NAVY_800, border: `1px solid ${NAVY_700}`, borderRadius: 16, padding: "40px 28px" }}>
          {submitted ? (
            <div style={{ textAlign: "center" as const, padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: SILVER_50, marginBottom: 12 }}>Message Sent</h3>
              <p style={{ fontSize: 14, color: SILVER_300, lineHeight: 1.7 }}>Our team will respond shortly.</p>
              <button onClick={() => setSubmitted(false)} style={{ marginTop: 24, padding: "10px 28px", background: "transparent", border: `1px solid ${NAVY_700}`, borderRadius: 8, color: SILVER_400, fontSize: 13, cursor: "pointer" }}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: SILVER_50, marginBottom: 4 }}>Send us a message</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, display: "block", marginBottom: 6 }}>Name *</label>
                  <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, display: "block", marginBottom: 6 }}>Email *</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@institution.com" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, display: "block", marginBottom: 6 }}>Organisation</label>
                <input style={inputStyle} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Institution or fund name" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, display: "block", marginBottom: 6 }}>Message *</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" as const }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Describe your decision environment or use case" />
              </div>
              <button type="submit" disabled={sending} style={{ padding: "13px 24px", background: BLUE_400, color: NAVY_950, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}>
                {sending ? "Sending..." : "Send Message →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── SECTION 7 — FOOTER ────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ padding: "24px 24px", background: NAVY_950, borderTop: `1px solid ${NAVY_700}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 16 }}>
        <Logo size={28} />
        <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, textAlign: "center" as const, letterSpacing: "0.04em" }}>
          AgenThink Mesh · Governed Decision Infrastructure
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {[
            { label: "Privacy",  href: "/privacy" },
            { label: "Terms",    href: "/terms" },
            { label: "Security", href: "/security" },
            { label: "Contact",  href: "#contact" },
          ].map(l => (
            <a key={l.label} href={l.href} style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textDecoration: "none", letterSpacing: "0.04em" }}>{l.label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function Landing() {
  const loginUrl = getLoginUrl();
  // Keep analytics hook for existing tracking
  const { data: _stats } = trpc.public.platformStats.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_100, overflowX: "hidden" }}>
      <SiteNav isLandingPage />
      <SolutionsNav />
      <Hero loginUrl={loginUrl} />
      <ProofReportBanner />
      <ProcessFlow />
      <Capabilities />
      <Reports />
      <WhyInstitutions />
      <EvidenceAndScale />
      <ContactSection />
      <Footer />
    </div>
  );
}
