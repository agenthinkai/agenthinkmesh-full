import { getLoginUrl } from "@/const";

const DOMAINS = [
  {
    icon: "💹",
    name: "Finance",
    color: "#6366F1",
    contexts: ["VC / PE Fund", "Sovereign Wealth", "Fund Manager"],
    agents: ["Deal Screener", "Due Diligence", "Portfolio Monitor", "LP Comms", "Valuation", "Exit Modeler"],
  },
  {
    icon: "⚖️",
    name: "Legal",
    color: "#0EA5E9",
    contexts: ["Law Firm", "In-House Counsel"],
    agents: ["Contract Review", "Clause Extractor", "Risk Flagger", "Jurisdiction Intel", "Draft Gen", "Redline"],
  },
  {
    icon: "🏥",
    name: "Healthcare",
    color: "#10B981",
    contexts: ["Hospital Ops", "Clinical Research"],
    agents: ["Bed Manager", "Staffing Optimizer", "Patient Flow", "Cost Analyzer", "Safety Monitor", "Report Gen"],
  },
  {
    icon: "🏢",
    name: "Enterprise",
    color: "#8B5CF6",
    contexts: ["HR & People Ops", "Procurement", "Operations"],
    agents: ["Talent Screener", "Vendor Screener", "Process Monitor", "KPI Tracker", "Resource Planner", "SLA Monitor"],
  },
  {
    icon: "🏦",
    name: "GCC Wealth",
    color: "#F59E0B",
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
    <div style={{ minHeight: "100vh", background: "#080D1A", fontFamily: "'Syne', sans-serif", color: "#fff", overflowX: "hidden" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 62,
        background: "rgba(8,13,26,0.94)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>AgenThink</span>
          <span style={{ fontSize: 10, color: "#6366F1", fontFamily: "'DM Mono', monospace", padding: "2px 8px", background: "rgba(99,102,241,0.12)", borderRadius: 999, border: "1px solid rgba(99,102,241,0.25)" }}>Mesh v3.1</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["#features|Features", "#domains|Domains", "#how-it-works|How it works"].map(item => {
            const [href, label] = item.split("|");
            return (
              <a key={href} href={href} style={{ fontSize: 12, color: "#64748B", textDecoration: "none", fontFamily: "'DM Mono', monospace", transition: "color 0.2s" }}>
                {label}
              </a>
            );
          })}
          <a href={loginUrl} style={{
            padding: "8px 22px", background: "#4F46E5", color: "#fff",
            borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 0 20px rgba(79,70,229,0.3)",
          }}>Sign in →</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: "110px 48px 90px", textAlign: "center", position: "relative" }}>
        {/* Glow */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: "radial-gradient(ellipse, rgba(79,70,229,0.14) 0%, transparent 65%)", pointerEvents: "none" }} />

        {/* Animated mesh */}
        <div style={{ marginBottom: 44, display: "flex", justifyContent: "center" }}>
          <svg width="200" height="130" viewBox="0 0 200 130">
            {([[100,65,35,25],[100,65,165,25],[100,65,18,78],[100,65,182,78],[100,65,55,115],[100,65,145,115],[100,65,100,12]] as [number,number,number,number][]).map(([x1,y1,x2,y2],i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" strokeDasharray="4 3">
                <animate attributeName="stroke-opacity" values="0.2;0.7;0.2" dur={`${1.8 + i * 0.25}s`} repeatCount="indefinite" />
              </line>
            ))}
            {([[35,25],[165,25],[18,78],[182,78],[55,115],[145,115],[100,12]] as [number,number][]).map(([cx,cy],i) => (
              <circle key={i} cx={cx} cy={cy} r="5.5" fill="rgba(99,102,241,0.45)" stroke="rgba(99,102,241,0.7)" strokeWidth="1.2">
                <animate attributeName="r" values="4;6.5;4" dur={`${2.2 + i * 0.35}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <circle cx="100" cy="65" r="16" fill="rgba(79,70,229,0.25)" stroke="#6366F1" strokeWidth="2">
              <animate attributeName="r" values="13;18;13" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="65" r="7" fill="#6366F1" />
          </svg>
        </div>

        {/* Status pill */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 999, marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#A5B4FC", fontFamily: "'DM Mono', monospace" }}>v3.1 · 112 agents · 14 domain contexts · Live</span>
        </div>

        <h1 style={{ fontSize: "clamp(38px, 5.5vw, 68px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.08, marginBottom: 22, maxWidth: 820, margin: "0 auto 22px" }}>
          Deploy a mesh of<br />
          <span style={{ background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #06B6D4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            specialist AI agents
          </span>
          <br />against any task.
        </h1>

        <p style={{ fontSize: 16, color: "#64748B", maxWidth: 560, margin: "0 auto 44px", lineHeight: 1.75, fontFamily: "'DM Mono', monospace" }}>
          AgenThink Mesh orchestrates coordinated teams of domain-specific AI agents across Finance, Legal, Healthcare, Enterprise, and GCC Wealth — running in parallel, streaming output in real time.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={loginUrl} style={{
            padding: "15px 36px", background: "#4F46E5", color: "#fff",
            borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 0 50px rgba(79,70,229,0.4)",
          }}>Access the Mesh →</a>
          <a href="#how-it-works" style={{
            padding: "15px 36px", background: "rgba(255,255,255,0.05)", color: "#CBD5E1",
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.09)",
          }}>See how it works</a>
        </div>
        <p style={{ marginTop: 16, fontSize: 11, color: "#334155", fontFamily: "'DM Mono', monospace" }}>
          Sign in with Google, GitHub, or email · Free to access · No credit card required
        </p>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)", padding: "36px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
          {[
            { value: "14", label: "Domain Contexts", color: "#6366F1" },
            { value: "112", label: "Specialist Agents", color: "#8B5CF6" },
            { value: "50", label: "Max Agents / Task", color: "#06B6D4" },
            { value: "5", label: "Industry Verticals", color: "#10B981" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 24px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontSize: 44, fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace", marginTop: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: "90px 48px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 10, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>How it works</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "#F1F5F9", lineHeight: 1.15 }}>From task to structured output<br />in under 60 seconds.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, position: "relative" }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "30px 26px", position: "relative" }}>
                <div style={{ fontSize: 52, fontWeight: 800, color: "rgba(99,102,241,0.12)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 18 }}>{step.step}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 10 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.75, fontFamily: "'DM Mono', monospace" }}>{step.desc}</div>
                {i < 2 && (
                  <div style={{ position: "absolute", right: -14, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "rgba(99,102,241,0.35)", zIndex: 2 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "90px 48px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 10, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Platform capabilities</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "#F1F5F9", lineHeight: 1.15 }}>Built for institutional-grade<br />AI task execution.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "26px 22px" }}>
                <div style={{ fontSize: 30, marginBottom: 16 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", marginBottom: 9 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.75, fontFamily: "'DM Mono', monospace" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Domain showcase ── */}
      <section id="domains" style={{ padding: "90px 48px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 10, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Domain coverage</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "#F1F5F9", lineHeight: 1.15 }}>5 verticals. 14 contexts.<br />112 specialist agents.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {DOMAINS.map((d, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "22px 18px" }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{d.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: d.color, marginBottom: 7 }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Mono', monospace", marginBottom: 14, lineHeight: 1.6 }}>
                  {d.contexts.join(" · ")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {d.agents.map((ag, j) => (
                    <div key={j} style={{ fontSize: 10, color: "#475569", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: d.color, opacity: 0.55, display: "inline-block", flexShrink: 0 }} />
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
      <section style={{ padding: "90px 48px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 10, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Use cases</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "#F1F5F9", lineHeight: 1.15 }}>Real tasks. Real professionals.<br />Real output.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {USE_CASES.map((uc, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "24px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 10, padding: "3px 11px", borderRadius: 999, background: "rgba(99,102,241,0.13)", color: "#A5B4FC", fontFamily: "'DM Mono', monospace", border: "1px solid rgba(99,102,241,0.2)" }}>
                    {uc.role}
                  </span>
                  <span style={{ fontSize: 10, color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                    {uc.domain} · {uc.agents} agents
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.7, fontFamily: "'DM Mono', monospace", fontStyle: "italic" }}>
                  "{uc.task}"
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ padding: "110px 48px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(79,70,229,0.13) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 10, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'DM Mono', monospace", marginBottom: 18 }}>Get started today</div>
        <h2 style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.04em", color: "#F1F5F9", marginBottom: 18, maxWidth: 620, margin: "0 auto 18px", lineHeight: 1.1 }}>
          Your mesh is ready.<br />Are you?
        </h2>
        <p style={{ fontSize: 14, color: "#475569", fontFamily: "'DM Mono', monospace", maxWidth: 460, margin: "0 auto 40px", lineHeight: 1.75 }}>
          Sign in to access 112 specialist agents across 14 domain contexts. No setup. No configuration. Execute your first task in under 30 seconds.
        </p>
        <a href={loginUrl} style={{
          display: "inline-block", padding: "17px 44px",
          background: "#4F46E5", color: "#fff",
          borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none",
          boxShadow: "0 0 70px rgba(79,70,229,0.35)",
        }}>
          Sign in to access the Mesh →
        </a>
        <p style={{ marginTop: 16, fontSize: 11, color: "#1E293B", fontFamily: "'DM Mono', monospace" }}>
          Sign in with Google, GitHub, or email · Free to access · No credit card required
        </p>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "26px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#334155" }}>AgenThink</span>
          <span style={{ fontSize: 10, color: "#1E293B", fontFamily: "'DM Mono', monospace" }}>/ Mesh v3.1</span>
        </div>
        <div style={{ fontSize: 10, color: "#1E293B", fontFamily: "'DM Mono', monospace" }}>
          112 agents · 14 contexts · 5 domains · Institutional AI orchestration
        </div>
      </footer>
    </div>
  );
}
