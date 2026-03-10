import { useState, useEffect, useRef } from "react";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Brand palette (matches logo: deep navy + silver/platinum) ──────────────
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
const SILVER_GRAD = "linear-gradient(135deg, #F0F4FA 0%, #C8D4E8 40%, #E8ECF2 70%, #9AAAC0 100%)";
const GOLD        = "#C9A84C";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

const DOMAINS = [
  {
    icon: "💹", name: "Finance", color: "#7BA3D4", lightBg: "rgba(123,163,212,0.08)",
    contexts: ["VC / PE Fund", "Sovereign Wealth", "Fund Manager"],
    agents: ["Deal Screener", "Due Diligence", "Portfolio Monitor", "LP Comms", "Valuation", "Exit Modeler"],
  },
  {
    icon: "⚖️", name: "Legal", color: "#8BBFD4", lightBg: "rgba(139,191,212,0.08)",
    contexts: ["Law Firm", "In-House Counsel"],
    agents: ["Contract Review", "Clause Extractor", "Risk Flagger", "Jurisdiction Intel", "Draft Gen", "Redline"],
  },
  {
    icon: "🏥", name: "Healthcare", color: "#7DC4A8", lightBg: "rgba(125,196,168,0.08)",
    contexts: ["Hospital Ops", "Clinical Research"],
    agents: ["Bed Manager", "Staffing Optimizer", "Patient Flow", "Cost Analyzer", "Safety Monitor", "Report Gen"],
  },
  {
    icon: "🏢", name: "Enterprise", color: "#A89BD4", lightBg: "rgba(168,155,212,0.08)",
    contexts: ["HR & People Ops", "Procurement", "Operations"],
    agents: ["Talent Screener", "Vendor Screener", "Process Monitor", "KPI Tracker", "Resource Planner", "SLA Monitor"],
  },
  {
    icon: "🏦", name: "GCC Wealth", color: "#C9A84C", lightBg: "rgba(201,168,76,0.08)",
    contexts: ["Private Wealth", "Investment Banking", "Family Office", "Fund Distribution"],
    agents: ["Client Profiler", "Suitability Checker", "Portfolio Builder", "Deal Originator", "Asset Allocator", "Investor Matcher"],
  },
];

const FEATURES = [
  { icon: "⚡", title: "Dynamic Agent Spawning", desc: "Type a task and watch the mesh automatically spawn the right specialist agents — up to 50 — based on semantic keyword detection. No manual configuration." },
  { icon: "🔀", title: "Parallel Execution", desc: "All agents run concurrently with a 400ms stagger. A 9-agent task that would take 45 minutes sequentially completes in under 60 seconds." },
  { icon: "📡", title: "Live Streaming Output", desc: "Watch each agent's reasoning stream token-by-token in real time. Structured output: Summary, Key Findings, Flags, and Next Action — every time." },
  { icon: "🗂️", title: "Document Vault", desc: "Upload PDFs, Word docs, CSVs, and spreadsheets. The vault indexes your documents and prepends relevant context to every agent's prompt automatically." },
  { icon: "🌐", title: "14 Domain Contexts", desc: "Switch between Finance, Legal, Healthcare, Enterprise, and GCC Wealth instantly. Each context loads domain-specific agents, prompts, and suggested tasks." },
  { icon: "📊", title: "Task History & Export", desc: "Every executed task is saved to your account. Search, review, and re-run previous tasks. Export any output as a structured PDF report." },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Select your domain context", desc: "Choose from 14 pre-configured contexts across Finance, Legal, Healthcare, Enterprise, and GCC Wealth. Each loads the right specialist agents automatically." },
  { step: "02", title: "Describe your task", desc: "Type a natural language task or select from suggested tasks. The mesh reads your input and spawns additional specialist agents as needed — in real time." },
  { step: "03", title: "Receive parallel structured output", desc: "All agents execute concurrently and stream their findings. Review each agent's output, export the full report as PDF, and save to your task history." },
];

const USE_CASES = [
  { role: "VC Analyst", task: "Screen 12 inbound deals against our investment thesis and flag the top 3 for partner review", agents: 9, domain: "Finance" },
  { role: "GCC Relationship Manager", task: "Profile a new Saudi HNWI client, check Shariah suitability, and draft a portfolio proposal", agents: 7, domain: "GCC Wealth" },
  { role: "In-House Counsel", task: "Review this vendor contract for liability exposure and flag non-standard clauses", agents: 6, domain: "Legal" },
  { role: "Hospital Ops Director", task: "Analyse this week's bed occupancy data and generate a staffing optimisation report", agents: 8, domain: "Healthcare" },
];

// ── Contact Section Component ─────────────────────────────────────────────
function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

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
          name: form.name,
          email: form.email,
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
      } else {
        throw new Error(data.message || "Submission failed");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid #1C3057`,
    borderRadius: 10,
    fontSize: 14,
    color: "#F5F7FA",
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  };

  return (
    <section id="contact" style={{ padding: "80px 0", background: "#0F1E38", borderTop: "1px solid #1C3057" }}>
      <div className="landing-contact-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {/* Left — copy */}
        <div>
          <div style={{ fontSize: 11, color: "#8494AA", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 16, fontWeight: 500 }}>Contact Us</div>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#F5F7FA", marginBottom: 20, lineHeight: 1.1 }}>
            Let's talk about<br /><span style={{ color: "#7BA3D4" }}>your use case.</span>
          </h2>
          <p style={{ fontSize: 15, color: "#A8B4C8", lineHeight: 1.8, marginBottom: 40 }}>
            Whether you're a VC fund, a GCC bank, a law firm, or a healthcare operator — we'd love to show you what AgenThinkMesh can do for your team.
          </p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
            {[
              { icon: "✉", label: "Email", value: "info@agenthink.ai" },
              { icon: "🌐", label: "Website", value: "agenthink-7enctkan.manus.space" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(123,163,212,0.1)", border: "1px solid #1C3057", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 14, color: "#E8ECF2", fontWeight: 500 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div style={{ background: "#152542", border: "1px solid #1C3057", borderRadius: 16, padding: "40px 28px" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: "#F5F7FA", marginBottom: 12 }}>Message Sent!</h3>
              <p style={{ fontSize: 14, color: "#A8B4C8", lineHeight: 1.7 }}>Thank you for reaching out. Our team will get back to you at <strong style={{ color: "#7BA3D4" }}>{form.email || "your email"}</strong> shortly.</p>
              <button onClick={() => setSubmitted(false)} style={{ marginTop: 24, padding: "10px 28px", background: "transparent", border: "1px solid #1C3057", borderRadius: 8, color: "#A8B4C8", fontSize: 13, cursor: "pointer" }}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" as const, gap: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F5F7FA", marginBottom: 4 }}>Send us a message</h3>
              <div className="landing-form-row">
                <div>
                  <label style={{ fontSize: 11, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>Name *</label>
                  <input style={inputStyle} placeholder="Farouq Sultan" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>Email *</label>
                  <input style={inputStyle} type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>Company</label>
                <input style={inputStyle} placeholder="AgenThink" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace", display: "block", marginBottom: 6 }}>Message *</label>
                <textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical" as const }} placeholder="Tell us about your use case, team size, or what you'd like to explore..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: "14px 32px",
                  background: sending ? "#1C3057" : "linear-gradient(135deg, #7BA3D4 0%, #5B8EC4 100%)",
                  color: sending ? "#637080" : "#0B1629",
                  borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none", cursor: sending ? "not-allowed" : "pointer",
                  boxShadow: sending ? "none" : "0 2px 16px rgba(123,163,212,0.3)",
                  transition: "all 0.2s",
                }}
              >
                {sending ? "Sending..." : "Send Message →"}
              </button>
              <p style={{ fontSize: 11, color: "#637080", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" as const }}>We typically respond within 24 hours.</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Neon Hero Component (VarD) ──────────────────────────────────────────────
const NEON_COLORS = [
  { color: "#00D4FF", glow: "rgba(0,212,255,", border: "rgba(0,212,255,0.18)", shadow: "rgba(0,212,255,0.06)", bar: "linear-gradient(90deg,#00D4FF,#008AB8)" },
  { color: "#0080FF", glow: "rgba(0,128,255,", border: "rgba(0,128,255,0.18)", shadow: "rgba(0,128,255,0.06)", bar: "linear-gradient(90deg,#0080FF,#0050B0)" },
  { color: "#40B8FF", glow: "rgba(64,184,255,", border: "rgba(64,184,255,0.18)", shadow: "rgba(64,184,255,0.06)", bar: "linear-gradient(90deg,#40B8FF,#2080C0)" },
  { color: "#4060FF", glow: "rgba(64,96,255,",  border: "rgba(64,96,255,0.18)",  shadow: "rgba(64,96,255,0.06)",  bar: "linear-gradient(90deg,#4060FF,#2030C0)" },
];

const AGENT_CARDS = [
  { name: "Deal Screener", domain: "Finance · Active" },
  { name: "Legal Reviewer", domain: "Legal · Standby" },
  { name: "Healthcare AI",  domain: "Healthcare · Ready" },
  { name: "GCC Wealth",     domain: "Wealth · Active" },
];

function NeonHero({ loginUrl, stats }: { loginUrl: string; stats: { tasksRun: number; verifiedAgents: number; domainContexts: number; avgExecSec: number } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const neonList = [
      { color: "#00D4FF", glow: "rgba(0,212,255," },
      { color: "#0080FF", glow: "rgba(0,128,255," },
      { color: "#40B8FF", glow: "rgba(64,184,255," },
      { color: "#4060FF", glow: "rgba(64,96,255," },
    ];

    const nodes = Array.from({ length: 65 }, () => {
      const n = neonList[Math.floor(Math.random() * neonList.length)];
      return {
        x: Math.random() * W(), y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.38, vy: (Math.random() - 0.5) * 0.38,
        r: Math.random() * 2.2 + 0.9,
        color: n.color, glow: n.glow,
        pulse: Math.random() * Math.PI * 2,
        isHub: Math.random() < 0.1,
      };
    });

    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += 0.017;
        if (n.x < 0 || n.x > W()) n.vx *= -1;
        if (n.y < 0 || n.y > H()) n.vy *= -1;
      });
      // Connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 155) {
            const a = (1 - d / 155) * 0.22;
            const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
            grad.addColorStop(0, nodes[i].glow + (a * 1.5).toFixed(2) + ")");
            grad.addColorStop(1, nodes[j].glow + (a * 1.5).toFixed(2) + ")");
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }
      // Nodes
      nodes.forEach(n => {
        const p = Math.sin(n.pulse) * 0.5 + 0.5;
        const r = n.isHub ? n.r * 2.2 : n.r;
        const glowR = r * (n.isHub ? 8 : 5);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
        g.addColorStop(0, n.glow + (n.isHub ? "0.55" : "0.38") + ")");
        g.addColorStop(0.4, n.glow + "0.12)");
        g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, r + p * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = n.color; ctx.fill();
        if (n.isHub) {
          ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = n.glow + "0.3)";
          ctx.lineWidth = 0.8; ctx.stroke();
        }
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "100px 24px 80px", overflow: "hidden", background: "#060F1C" }}>
      {/* Neural canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />
      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", background: "radial-gradient(ellipse 65% 55% at 50% 50%, transparent 15%, rgba(6,15,28,0.55) 65%, rgba(6,15,28,0.92) 100%)" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 840 }}>
        {/* Live badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 16px", borderRadius: 999, background: "rgba(6,15,28,0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,212,255,0.18)", fontFamily: MONO, fontSize: 11, color: "#3A5A7A", letterSpacing: "0.06em", marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 10px #00D4FF", display: "inline-block", animation: "neonPulse 2s ease-in-out infinite" }} />
          <span style={{ color: "#00D4FF", fontWeight: 700 }}>{stats.verifiedAgents}</span> verified specialist agents · Live
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(52px, 8vw, 96px)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#F0F4FA", marginBottom: 24 }}>
          The{" "}
          <span style={{ background: "linear-gradient(135deg, #00D4FF 0%, #40B8FF 40%, #0080FF 75%, #4060FF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 40px rgba(0,212,255,0.55))" }}>Google</span>
          <br />of AI Agents
        </h1>

        {/* Subtext */}
        <p style={{ fontSize: 17, color: "#3A5A7A", maxWidth: 580, lineHeight: 1.75, margin: "0 auto 44px" }}>
          Describe any complex business task. <strong style={{ color: "#5A9ABF" }}>AgenThinkMesh</strong> activates the right specialist agents across Finance, Legal, Healthcare, and GCC Wealth — delivering institutional-grade results in seconds.
        </p>

        {/* Search bar */}
        <div style={{ maxWidth: 660, margin: "0 auto 14px" }}>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(6,15,28,0.85)", backdropFilter: "blur(24px)", border: "1px solid rgba(0,212,255,0.16)", borderRadius: 14, padding: "6px 6px 6px 20px", boxShadow: "0 0 0 1px rgba(0,212,255,0.05), 0 20px 60px rgba(0,0,0,0.5)" }}>
            <span style={{ color: "#1E3A5A", fontSize: 15, marginRight: 12, flexShrink: 0 }}>⊙</span>
            <input readOnly value="" placeholder="Describe a task — e.g. Screen 5 deals against our VC thesis"
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#A0C8E8", fontFamily: FONT, minWidth: 0 }}
              onClick={() => { window.location.href = loginUrl; }}
            />
            <a href={loginUrl} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #00D4FF 0%, #0080FF 100%)", color: "#060F1C", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 13, fontWeight: 900, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,212,255,0.4)", flexShrink: 0 }}>⚡ Activate mesh</a>
          </div>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 11, color: "#1E3A5A", marginBottom: 52 }}>No sign-in required to preview · {stats.verifiedAgents} specialist agents ready</p>

        {/* Agent cards row */}
        <div className="landing-agent-row">
          {AGENT_CARDS.map((ac, i) => (
            <div key={i} className="landing-agent-card" style={{ border: `1px solid ${NEON_COLORS[i].border}`, boxShadow: `0 4px 24px rgba(0,0,0,0.45), 0 0 20px ${NEON_COLORS[i].shadow}` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${NEON_COLORS[i].color}99, transparent)` }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: NEON_COLORS[i].color, boxShadow: `0 0 8px ${NEON_COLORS[i].color}`, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#C0D8EE" }}>{ac.name}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: "#1E3A5A", marginBottom: 10 }}>{ac.domain}</div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div className={`neon-bar-${i}`} style={{ height: "100%", borderRadius: 2, background: NEON_COLORS[i].bar, width: "60%", animation: `barFill${i} 3s ease-in-out ${i * 0.75}s infinite alternate` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="landing-neon-stats">
          {[
            { num: `${stats.tasksRun.toLocaleString()}+`, label: "Tasks Run",       neon: "#00D4FF" },
            { num: String(stats.verifiedAgents),          label: "Verified Agents", neon: "#40B8FF" },
            { num: String(stats.domainContexts),          label: "Domain Contexts", neon: "#0080FF" },
            { num: `avg. ${stats.avgExecSec}s`,           label: "Exec Time",       neon: "#4060FF" },
          ].map((item, i) => (
            <div key={i} className="landing-neon-stat-cell" style={{ borderRight: i < 3 ? "1px solid rgba(0,212,255,0.07)" : "none" }}>
              <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: `linear-gradient(90deg, transparent, ${item.neon}66, transparent)` }} />
              <div style={{ fontSize: 24, fontWeight: 900, color: item.neon, letterSpacing: "-0.04em", textShadow: `0 0 16px ${item.neon}80` }}>{item.num}</div>
              <div style={{ fontSize: 10, color: "#1E3A5A", marginTop: 5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Shared card style
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: NAVY_800,
  border: `1px solid ${NAVY_700}`,
  borderRadius: 14,
  ...extra,
});

export default function Landing() {
  const loginUrl = getLoginUrl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: stats } = trpc.public.platformStats.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const s = {
    tasksRun:       stats?.tasksRun       ?? 2405,
    verifiedAgents: stats?.verifiedAgents ?? 112,
    domainContexts: stats?.domainContexts ?? 14,
    avgExecSec:     stats?.avgExecSec     ?? 47,
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, fontFamily: FONT, color: SILVER_100, overflowX: "hidden" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: `${NAVY_900}F0`, backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${NAVY_700}`,
      }}>
        <div className="landing-nav-inner">
          <div className="landing-logo-wrap">
            <Logo size={32} />
          </div>

          {/* Desktop nav links */}
          <div className="landing-nav-links" style={{ alignItems: "center", gap: 20 }}>
            {[["#features", "Features"], ["#domains", "Domains"], ["#how-it-works", "How it works"], ["#contact", "Contact"]].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 13, color: SILVER_300, textDecoration: "none", fontWeight: 500, transition: "color 0.2s", whiteSpace: "nowrap" }}
                onMouseEnter={e => (e.currentTarget.style.color = SILVER_50)}
                onMouseLeave={e => (e.currentTarget.style.color = SILVER_300)}
              >{label}</a>
            ))}
            <Link href="/registry" style={{ fontSize: 13, color: "#7BA3D4", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
              ⬡ Registry
            </Link>
            <Link href="/annotate" style={{ fontSize: 13, color: GOLD, textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
              ع Arabic Labeling
            </Link>
            <Link href="/build" style={{ fontSize: 13, color: SILVER_300, textDecoration: "none", fontWeight: 500, whiteSpace: "nowrap" }}>
              Build
            </Link>
            <a href={loginUrl} style={{
              padding: "8px 18px",
              background: "linear-gradient(135deg, #1C3057 0%, #243B6E 100%)",
              color: SILVER_50,
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
              border: `1px solid ${NAVY_600}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
              whiteSpace: "nowrap",
            }}>Sign in →</a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="landing-hamburger"
            onClick={() => setMobileMenuOpen(o => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: SILVER_300, fontSize: 22, lineHeight: 1 }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="landing-mobile-menu" style={{ background: NAVY_900, borderTop: `1px solid ${NAVY_700}`, padding: "16px 24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {[["#features", "Features"], ["#domains", "Domains"], ["#how-it-works", "How it works"], ["#contact", "Contact"]].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} style={{ fontSize: 15, color: SILVER_300, textDecoration: "none", fontWeight: 500 }}>{label}</a>
            ))}
            <Link href="/registry" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: 15, color: "#7BA3D4", textDecoration: "none", fontWeight: 600 }}>⬡ Registry</Link>
            <Link href="/annotate" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: 15, color: GOLD, textDecoration: "none", fontWeight: 600 }}>ع Arabic Labeling</Link>
            <Link href="/build" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: 15, color: SILVER_300, textDecoration: "none", fontWeight: 500 }}>Build</Link>
            <a href={loginUrl} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #1C3057 0%, #243B6E 100%)", color: SILVER_50, borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>Sign in →</a>
          </div>
        )}
      </nav>

      {/* ── Hero (VarD Neon) ── */}
      <NeonHero loginUrl={loginUrl} stats={s} />

      {/* ── Stats bar ── */}
      <section style={{ borderBottom: `1px solid ${NAVY_700}`, background: NAVY_800, padding: "28px 24px" }}>
        <div className="landing-stats-grid" style={{ maxWidth: 900, margin: "0 auto" }}>
          {([
            { value: String(s.domainContexts), label: "Domain Contexts", color: "#7BA3D4" },
            { value: String(s.verifiedAgents), label: "Specialist Agents", color: SILVER_100 },
            { value: "50", label: "Max Agents / Task", color: "#8BBFD4" },
            { value: "5", label: "Industry Verticals", color: GOLD },
          ] as { value: string; label: string; color: string }[]).map((item, i) => (
            <div key={i} style={{ textAlign: "center", padding: "12px 16px" }}>
              <div style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, background: SILVER_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{item.value}</div>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: "72px 24px", background: NAVY_950 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: SILVER_400, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>How it works</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>From task to structured output<br />in under 60 seconds.</h2>
          </div>
          <div className="landing-3col-grid">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{ ...card({ padding: "28px 22px", position: "relative" }) }}>
                <div style={{ fontSize: 44, fontWeight: 800, color: NAVY_700, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 14 }}>{step.step}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: SILVER_50, marginBottom: 9 }}>{step.title}</div>
                <div style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.75 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "72px 24px", background: NAVY_900, borderTop: `1px solid ${NAVY_700}`, borderBottom: `1px solid ${NAVY_700}` }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: SILVER_400, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>Platform capabilities</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>Built for institutional-grade<br />AI task execution.</h2>
          </div>
          <div className="landing-3col-grid">
            {FEATURES.map((f, i) => (
              <div key={i} style={{ ...card({ padding: "26px 22px" }) }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: SILVER_50, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.75 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Domain showcase ── */}
      <section id="domains" style={{ padding: "72px 24px", background: NAVY_950 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: SILVER_400, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>Domain coverage</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>5 verticals. 14 contexts.<br />112 specialist agents.</h2>
          </div>
          <div className="landing-domains-grid">
            {DOMAINS.map((d, i) => (
              <div key={i} style={{ background: d.lightBg, border: `1px solid ${d.color}33`, borderRadius: 14, padding: "22px 18px" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{d.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: d.color, marginBottom: 6 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, marginBottom: 14, lineHeight: 1.6 }}>
                  {d.contexts.join(" · ")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.agents.map((ag, j) => (
                    <div key={j} style={{ fontSize: 11, color: SILVER_300, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: d.color, opacity: 0.7, display: "inline-block", flexShrink: 0 }} />
                      {ag}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ── */}
      <section style={{ padding: "72px 24px", background: NAVY_900, borderTop: `1px solid ${NAVY_700}`, borderBottom: `1px solid ${NAVY_700}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: SILVER_400, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>Use cases</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15 }}>Real tasks. Real professionals.<br />Real output.</h2>
          </div>
          <div className="landing-2col-grid">
            {USE_CASES.map((uc, i) => (
              <div key={i} style={{ ...card({ padding: "24px 22px" }) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, padding: "3px 11px", borderRadius: 999, background: NAVY_700, color: SILVER_300, fontFamily: MONO, border: `1px solid ${NAVY_600}`, fontWeight: 500 }}>
                    {uc.role}
                  </span>
                  <span style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO }}>
                    {uc.domain} · {uc.agents} agents
                  </span>
                </div>
                <div style={{ fontSize: 14, color: SILVER_300, lineHeight: 1.7, fontStyle: "italic" }}>
                  &ldquo;{uc.task}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Arabic Data Labeling — Flagship Government Section ── */}
      <section id="arabic-labeling" style={{ padding: "80px 24px", background: "#080F1E", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${GOLD}18 1px, transparent 1px)`, backgroundSize: "32px 32px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: 480, height: 480, background: `radial-gradient(circle at 80% 20%, ${GOLD}18 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: 360, height: 360, background: "radial-gradient(circle at 20% 80%, rgba(123,163,212,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1060, margin: "0 auto", position: "relative" }}>
          {/* Hero row */}
          <div className="landing-arabic-hero" style={{ marginBottom: 56 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", background: `${GOLD}18`, border: `1px solid ${GOLD}50`, borderRadius: 999, marginBottom: 24 }}>
                <span style={{ fontSize: 10, color: GOLD, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>GCC AI Infrastructure</span>
              </div>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 800, letterSpacing: "-0.04em", color: SILVER_50, lineHeight: 1.1, marginBottom: 20 }}>
                Arabic Data Labeling<br />
                <span style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #8B6914 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  for GCC LLM Teams.
                </span>
              </h2>
              <p style={{ fontSize: 15, color: SILVER_300, lineHeight: 1.8, marginBottom: 32, maxWidth: 480 }}>
                Every Arabic LLM initiative in the Gulf hits the same wall: not enough high-quality, domain-specific, annotated training data. AgenThink Mesh provides the annotation infrastructure GCC governments and enterprises need to build sovereign Arabic AI.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/annotate" style={{
                  padding: "12px 24px", background: `linear-gradient(135deg, ${GOLD} 0%, #8B6914 100%)`, color: "#0B1629",
                  borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none",
                  boxShadow: `0 4px 20px ${GOLD}40`,
                }}>
                  Open Annotation Studio &rarr;
                </Link>
                <Link href="/registry" style={{
                  padding: "12px 24px", background: "transparent", color: SILVER_300,
                  borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none",
                  border: `1px solid ${NAVY_700}`,
                }}>
                  Browse Arabic Agents
                </Link>
              </div>
            </div>

            {/* Live annotation demo card */}
            <div style={{ background: `${NAVY_800}CC`, border: `1px solid ${NAVY_700}`, borderRadius: 16, padding: "28px 20px" }}>
              <div style={{ fontSize: 10, color: GOLD, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 600 }}>Live annotation example</div>
              <div style={{ background: `${NAVY_950}CC`, borderRadius: 10, padding: "16px 18px", marginBottom: 16, direction: "rtl", textAlign: "right" }}>
                <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, marginBottom: 8, direction: "ltr", textAlign: "left" }}>input_text</div>
                <div style={{ fontSize: 15, color: SILVER_100, lineHeight: 1.8, fontFamily: "'Noto Naskh Arabic', 'Arial', sans-serif" }}>
                  والله الخدمة في هذا البنك وايد زينة، ما قصروا معي أبد.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { key: "label", value: "positive", color: "#4ADE80" },
                  { key: "dialect", value: "gulf", color: GOLD },
                  { key: "confidence", value: "0.95", color: "#7BA3D4" },
                  { key: "requires_review", value: "false", color: "#A89BD4" },
                ].map((item, i) => (
                  <div key={i} style={{ background: `${NAVY_950}CC`, borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: SILVER_500, fontFamily: MONO, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.key}</div>
                    <div style={{ fontSize: 13, color: item.color, fontFamily: MONO, fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "10px 12px", background: `${NAVY_950}CC`, borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: SILVER_500, fontFamily: MONO, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>rationale</div>
                <div style={{ fontSize: 11, color: SILVER_300, lineHeight: 1.6 }}>Strong positive Gulf dialect markers: وايد زينة, ما قصروا — high confidence, no review needed</div>
              </div>
            </div>
          </div>

          {/* Five agent cards */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20, fontWeight: 500 }}>5 specialist Arabic annotation agents</div>
            <div className="landing-5col-grid">
              {[
                { icon: "💬", name: "Gulf Sentiment", desc: "Classifies sentiment with dialect detection across all 6 Gulf states", tag: "gulf · msa · levantine" },
                { icon: "🏷️", name: "Arabic NER", desc: "Extracts persons, orgs, locations, dates from Arabic text", tag: "ner · entities · tagging" },
                { icon: "🕌", name: "Islamic Finance Intent", desc: "Classifies intent across murabaha, sukuk, takaful, zakat queries", tag: "islamic · banking · intent" },
                { icon: "⚖️", name: "Legal Clause Extractor", desc: "Identifies and flags clauses in Arabic contracts and regulations", tag: "legal · gcc · contracts" },
                { icon: "🔀", name: "Code-Switch Detector", desc: "Annotates Arabic-English mixing patterns common in Gulf professional text", tag: "arabizi · bilingual · nlp" },
              ].map((agent, i) => (
                <div key={i} style={{ background: `${NAVY_800}CC`, border: `1px solid ${NAVY_700}`, borderRadius: 12, padding: "20px 16px" }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{agent.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: SILVER_50, marginBottom: 8, lineHeight: 1.3 }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: SILVER_400, lineHeight: 1.6, marginBottom: 12 }}>{agent.desc}</div>
                  <div style={{ fontSize: 9, color: GOLD, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.06em" }}>{agent.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Government use cases */}
          <div className="landing-3col-grid" style={{ marginBottom: 48 }}>
            <div style={{ gridColumn: "1 / -1", fontSize: 11, color: SILVER_500, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, marginBottom: 4 }}>Government and enterprise use cases</div>
            {[
              { org: "National AI Authority", flag: "🇸🇦", task: "Annotate 50,000 Gulf dialect customer service transcripts for national Arabic chatbot training", output: "JSONL export · sentiment labels · dialect tags · review queue" },
              { org: "Islamic Development Bank", flag: "🇸🇦", task: "Label 20,000 Arabic banking queries with Islamic finance intent classes for Shariah-compliant AI", output: "Intent labels · product mentions · sharia sensitivity flags" },
              { org: "Ministry of Justice", flag: "🇦🇪", task: "Extract and classify clauses from 5,000 Arabic legal contracts for judicial AI training data", output: "Clause types · risk flags · legal entity tags · review queue" },
            ].map((uc, i) => (
              <div key={i} style={{ background: `${NAVY_800}CC`, border: `1px solid ${NAVY_700}`, borderRadius: 14, padding: "24px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 20 }}>{uc.flag}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SILVER_50 }}>{uc.org}</span>
                </div>
                <div style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.7, marginBottom: 14, fontStyle: "italic" }}>
                  &ldquo;{uc.task}&rdquo;
                </div>
                <div style={{ fontSize: 10, color: GOLD, fontFamily: MONO, lineHeight: 1.6 }}>{uc.output}</div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="landing-stats-grid" style={{ background: NAVY_700, borderRadius: 14, overflow: "hidden", gap: 1 }}>
            {[
              { value: "5", label: "Arabic Dialects Supported", sub: "Gulf · MSA · Levantine · Egyptian · Maghrebi" },
              { value: "JSONL", label: "Fine-Tuning Export Format", sub: "Compatible with OpenAI, Gemini, Llama fine-tuning" },
              { value: "<3s", label: "Avg Annotation Latency", sub: "Structured JSON output with confidence scores" },
              { value: "100%", label: "Sovereign Data", sub: "No data leaves your infrastructure" },
            ].map((item, i) => (
              <div key={i} style={{ background: NAVY_800, padding: "24px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 8, background: SILVER_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{item.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: SILVER_100, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, lineHeight: 1.5 }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ padding: "80px 24px", textAlign: "center", background: NAVY_800, borderTop: `1px solid ${NAVY_700}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${NAVY_700} 1px, transparent 1px)`, backgroundSize: "24px 24px", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, color: SILVER_400, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 16, fontWeight: 500 }}>Get started today</div>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 800, letterSpacing: "-0.04em", color: SILVER_50, marginBottom: 16, maxWidth: 600, margin: "0 auto 16px", lineHeight: 1.1 }}>
            Your mesh is ready.<br />Are you?
          </h2>
          <p style={{ fontSize: 15, color: SILVER_300, maxWidth: 460, margin: "0 auto 32px", lineHeight: 1.75 }}>
            Sign in to access 112 specialist agents across 14 domain contexts. No setup. No configuration. Execute your first task in under 30 seconds.
          </p>
          <a href={loginUrl} style={{
            display: "inline-block", padding: "14px 36px",
            background: SILVER_GRAD,
            color: NAVY_950,
            borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}>
            Sign in to access the Mesh →
          </a>
          <p style={{ marginTop: 16, fontSize: 11, color: SILVER_500, fontFamily: MONO }}>
            Sign in with Google, GitHub, or email · Free to access · No credit card required
          </p>
        </div>
      </section>

      {/* ── Contact Us ── */}
      <ContactSection />

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${NAVY_700}`, padding: "20px 24px", background: NAVY_950 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Logo size={28} />
          <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, textAlign: "center" }}>
            112 agents · 14 contexts · 5 domains · Institutional AI orchestration
          </div>
        </div>
      </footer>
    </div>
  );
}
