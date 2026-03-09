import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { Link } from "wouter";

const FONT = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

const DOMAINS = [
  {
    icon: "💹", name: "Finance", color: "#4F46E5", lightBg: "#EEF2FF",
    contexts: ["VC / PE Fund", "Sovereign Wealth", "Fund Manager"],
    agents: ["Deal Screener", "Due Diligence", "Portfolio Monitor", "LP Comms", "Valuation", "Exit Modeler"],
  },
  {
    icon: "⚖️", name: "Legal", color: "#0284C7", lightBg: "#E0F2FE",
    contexts: ["Law Firm", "In-House Counsel"],
    agents: ["Contract Review", "Clause Extractor", "Risk Flagger", "Jurisdiction Intel", "Draft Gen", "Redline"],
  },
  {
    icon: "🏥", name: "Healthcare", color: "#059669", lightBg: "#D1FAE5",
    contexts: ["Hospital Ops", "Clinical Research"],
    agents: ["Bed Manager", "Staffing Optimizer", "Patient Flow", "Cost Analyzer", "Safety Monitor", "Report Gen"],
  },
  {
    icon: "🏢", name: "Enterprise", color: "#7C3AED", lightBg: "#EDE9FE",
    contexts: ["HR & People Ops", "Procurement", "Operations"],
    agents: ["Talent Screener", "Vendor Screener", "Process Monitor", "KPI Tracker", "Resource Planner", "SLA Monitor"],
  },
  {
    icon: "🏦", name: "GCC Wealth", color: "#B45309", lightBg: "#FEF3C7",
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

export default function Landing() {
  const loginUrl = getLoginUrl();

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", fontFamily: FONT, color: "#0F172A" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 60,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E2E8F0",
      }}>
        <Logo size={30} />
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[["#features", "Features"], ["#domains", "Domains"], ["#how-it-works", "How it works"]].map(([href, label]) => (
            <a key={href} href={href} style={{ fontSize: 13, color: "#64748B", textDecoration: "none", fontWeight: 500 }}>{label}</a>
          ))}
          <Link href="/registry" style={{ fontSize: 13, color: "#4F46E5", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            ⬡ Registry
          </Link>
          <a href={loginUrl} style={{
            padding: "8px 20px", background: "#4F46E5", color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>Sign in →</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: "96px 48px 80px", textAlign: "center", background: "#FAFBFF", borderBottom: "1px solid #E2E8F0", position: "relative", overflow: "hidden" }}>
        {/* Subtle grid background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(#E2E8F0 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.6, pointerEvents: "none" }} />

        {/* Animated mesh */}
        <div style={{ marginBottom: 40, display: "flex", justifyContent: "center", position: "relative" }}>
          <svg width="180" height="120" viewBox="0 0 180 120">
            {([[90,60,28,22],[90,60,152,22],[90,60,16,72],[90,60,164,72],[90,60,50,106],[90,60,130,106],[90,60,90,10]] as [number,number,number,number][]).map(([x1,y1,x2,y2],i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C7D2FE" strokeWidth="1.5" strokeDasharray="4 3">
                <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur={`${1.8 + i * 0.25}s`} repeatCount="indefinite" />
              </line>
            ))}
            {([[28,22],[152,22],[16,72],[164,72],[50,106],[130,106],[90,10]] as [number,number][]).map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r="5" fill="#A5B4FC" stroke="#6366F1" strokeWidth="1">
                <animate attributeName="r" values="3.5;5.5;3.5" dur={`${2.2 + i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <circle cx="90" cy="60" r="15" fill="#EEF2FF" stroke="#6366F1" strokeWidth="2">
              <animate attributeName="r" values="12;17;12" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="90" cy="60" r="7" fill="#4F46E5" />
          </svg>
        </div>

        {/* Status pill */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 14px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 999, marginBottom: 24, position: "relative" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#4F46E5", fontFamily: MONO }}>v3.1 · 112 agents · 14 domain contexts · Live</span>
        </div>

        <h1 style={{ fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, marginBottom: 20, maxWidth: 780, margin: "0 auto 20px", color: "#0F172A", position: "relative" }}>
          Deploy a mesh of<br />
          <span style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 60%, #0EA5E9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            specialist AI agents
          </span>
          <br />against any task.
        </h1>

        <p style={{ fontSize: 16, color: "#475569", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.75, position: "relative" }}>
          AgenThink Mesh orchestrates coordinated teams of domain-specific AI agents across Finance, Legal, Healthcare, Enterprise, and GCC Wealth — running in parallel, streaming output in real time.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
          <a href={loginUrl} style={{
            padding: "13px 32px", background: "#4F46E5", color: "#fff",
            borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 4px 24px rgba(79,70,229,0.3)",
          }}>Access the Mesh →</a>
          <a href="#how-it-works" style={{
            padding: "13px 32px", background: "#fff", color: "#374151",
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none",
            border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>See how it works</a>
        </div>
        <p style={{ marginTop: 14, fontSize: 11, color: "#94A3B8", fontFamily: MONO, position: "relative" }}>
          Sign in with Google, GitHub, or email · Free to access · No credit card required
        </p>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ borderBottom: "1px solid #E2E8F0", background: "#fff", padding: "32px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { value: "14", label: "Domain Contexts", color: "#4F46E5" },
            { value: "112", label: "Specialist Agents", color: "#7C3AED" },
            { value: "50", label: "Max Agents / Task", color: "#0284C7" },
            { value: "5", label: "Industry Verticals", color: "#059669" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 20px", borderRight: i < 3 ? "1px solid #E2E8F0" : "none" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: MONO, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: "88px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>How it works</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "#0F172A", lineHeight: 1.15 }}>From task to structured output<br />in under 60 seconds.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, position: "relative" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{ background: "#FAFBFF", border: "1px solid #E2E8F0", borderRadius: 14, padding: "28px 24px", position: "relative" }}>
                <div style={{ fontSize: 48, fontWeight: 800, color: "#EEF2FF", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 16, fontFamily: FONT }}>{step.step}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 9 }}>{step.title}</div>
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.75 }}>{step.desc}</div>
                {i < 2 && (
                  <div style={{ position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "#C7D2FE", zIndex: 2 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "88px 48px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>Platform capabilities</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "#0F172A", lineHeight: 1.15 }}>Built for institutional-grade<br />AI task execution.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "26px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.75 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Domain showcase ── */}
      <section id="domains" style={{ padding: "88px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>Domain coverage</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "#0F172A", lineHeight: 1.15 }}>5 verticals. 14 contexts.<br />112 specialist agents.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {DOMAINS.map((d, i) => (
              <div key={i} style={{ background: d.lightBg, border: `1px solid ${d.color}22`, borderRadius: 14, padding: "22px 18px" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{d.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: d.color, marginBottom: 6 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO, marginBottom: 14, lineHeight: 1.6 }}>
                  {d.contexts.join(" · ")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.agents.map((ag, j) => (
                    <div key={j} style={{ fontSize: 11, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
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
      <section style={{ padding: "88px 48px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, color: "#4F46E5", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 12, fontWeight: 500 }}>Use cases</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", color: "#0F172A", lineHeight: 1.15 }}>Real tasks. Real professionals.<br />Real output.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {USE_CASES.map((uc, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "24px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, padding: "3px 11px", borderRadius: 999, background: "#EEF2FF", color: "#4F46E5", fontFamily: MONO, border: "1px solid #C7D2FE", fontWeight: 500 }}>
                    {uc.role}
                  </span>
                  <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: MONO }}>
                    {uc.domain} · {uc.agents} agents
                  </span>
                </div>
                <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, fontStyle: "italic" }}>
                  "{uc.task}"
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ padding: "100px 48px", textAlign: "center", background: "#4F46E5", position: "relative", overflow: "hidden" }}>
        {/* Subtle pattern */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 11, color: "#A5B4FC", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 16, fontWeight: 500 }}>Get started today</div>
          <h2 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: 16, maxWidth: 600, margin: "0 auto 16px", lineHeight: 1.1 }}>
            Your mesh is ready.<br />Are you?
          </h2>
          <p style={{ fontSize: 15, color: "#C7D2FE", maxWidth: 460, margin: "0 auto 36px", lineHeight: 1.75 }}>
            Sign in to access 112 specialist agents across 14 domain contexts. No setup. No configuration. Execute your first task in under 30 seconds.
          </p>
          <a href={loginUrl} style={{
            display: "inline-block", padding: "15px 40px",
            background: "#fff", color: "#4F46E5",
            borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}>
            Sign in to access the Mesh →
          </a>
          <p style={{ marginTop: 14, fontSize: 11, color: "#818CF8", fontFamily: MONO }}>
            Sign in with Google, GitHub, or email · Free to access · No credit card required
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid #E2E8F0", padding: "24px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff" }}>
        <Logo size={24} />
        <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: MONO }}>
          112 agents · 14 contexts · 5 domains · Institutional AI orchestration
        </div>
      </footer>
    </div>
  );
}
