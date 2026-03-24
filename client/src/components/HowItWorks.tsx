import { useEffect, useRef, useState } from "react";

// ── Design tokens (match Landing page palette) ────────────────────────────────
const NAVY_950 = "#04080F";
const NAVY_900 = "#080D1A";
const NAVY_800 = "#0D1526";
const NAVY_700 = "#1A2540";
const NAVY_600 = "#243B6E";
const SILVER_50  = "#F0F4FA";
const SILVER_300 = "#94A3B8";
const SILVER_400 = "#64748B";
const SILVER_500 = "#475569";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', sans-serif";

// ── Step data ─────────────────────────────────────────────────────────────────
const ROLES = [
  { id: "doctor",  label: "Doctor",  icon: "🩺", color: "#22D3EE" },
  { id: "lawyer",  label: "Lawyer",  icon: "⚖️", color: "#94A3B8" },
  { id: "manager", label: "Manager", icon: "🎯", color: "#F87171" },
  { id: "analyst", label: "Analyst", icon: "📈", color: "#4ADE80" },
  { id: "banker",  label: "Banker",  icon: "🏦", color: "#60A5FA" },
];

const AGENTS_BY_ROLE: Record<string, { name: string; cap: string; color: string }[]> = {
  doctor: [
    { name: "Clinical Summariser",  cap: "Summarise patient records",       color: "#22D3EE" },
    { name: "Drug Interaction AI",  cap: "Check contraindications",         color: "#6EE7B7" },
    { name: "ICD Code Mapper",      cap: "Map diagnoses to ICD-10 codes",   color: "#34D399" },
    { name: "Medical Literature",   cap: "Search PubMed & journals",        color: "#10B981" },
  ],
  lawyer: [
    { name: "Contract Reviewer",    cap: "Flag non-standard clauses",       color: "#94A3B8" },
    { name: "Clause Extractor",     cap: "Extract key obligations",         color: "#CBD5E1" },
    { name: "Compliance Checker",   cap: "GCC regulatory alignment",        color: "#64748B" },
    { name: "Legal Risk Scorer",    cap: "Score liability exposure",        color: "#475569" },
  ],
  manager: [
    { name: "KPI Tracker",          cap: "Monitor team performance",        color: "#F87171" },
    { name: "Budget Analyser",      cap: "Variance & forecast",             color: "#FB923C" },
    { name: "Project Monitor",      cap: "Track milestones & blockers",     color: "#FBBF24" },
    { name: "Meeting Summariser",   cap: "Action items from transcripts",   color: "#F59E0B" },
  ],
  analyst: [
    { name: "Deal Screener",        cap: "Screen deals against thesis",     color: "#4ADE80" },
    { name: "DCF Modeller",         cap: "Build discounted cash flows",     color: "#34D399" },
    { name: "Comps Builder",        cap: "Trading & transaction comps",     color: "#10B981" },
    { name: "Macro Monitor",        cap: "Track macro indicators",          color: "#6EE7B7" },
  ],
  banker: [
    { name: "KYC/AML Checker",      cap: "Regulatory compliance screening", color: "#60A5FA" },
    { name: "Credit Risk AI",       cap: "Assess creditworthiness",         color: "#93C5FD" },
    { name: "Loan Structurer",      cap: "Optimal loan structures",         color: "#BFDBFE" },
    { name: "Portfolio Monitor",    cap: "Track exposure & limits",         color: "#3B82F6" },
  ],
};

const SAMPLE_OUTPUTS: Record<string, { summary: string; findings: string[]; flag: string; action: string }> = {
  doctor: {
    summary: "Patient presents with moderate hypertension and potential drug interaction risk.",
    findings: [
      "Blood pressure: 148/92 — Stage 2 hypertension",
      "Lisinopril + Ibuprofen: potential nephrotoxic interaction flagged",
      "ICD-10 code I10 assigned — Essential hypertension",
      "3 relevant RCTs found in PubMed (2023–2024)",
    ],
    flag: "Drug interaction: NSAIDs may reduce Lisinopril efficacy",
    action: "Consult cardiologist and consider NSAID substitution",
  },
  lawyer: {
    summary: "Vendor contract contains 3 non-standard clauses with elevated liability exposure.",
    findings: [
      "Unlimited liability clause in §8.2 — non-standard",
      "IP ownership ambiguous in §12 — requires clarification",
      "Governing law: DIFC — aligned with GCC operations",
      "Termination notice: 7 days — below industry standard (30)",
    ],
    flag: "Unlimited liability clause creates unacceptable risk exposure",
    action: "Negotiate liability cap to 12 months of contract value",
  },
  manager: {
    summary: "Q3 performance shows 12% budget variance with 2 at-risk milestones.",
    findings: [
      "Marketing spend: 118% of budget — overage of $42K",
      "Project Alpha: 3 weeks behind schedule",
      "Team utilisation: 94% — near capacity",
      "NPS score: 72 — up 8 points from Q2",
    ],
    flag: "Project Alpha milestone at risk — resource bottleneck identified",
    action: "Reallocate 2 engineers from Project Beta to unblock Alpha",
  },
  analyst: {
    summary: "Deal scores 7.2/10 against thesis — strong unit economics, weak market size.",
    findings: [
      "Revenue CAGR: 142% YoY — top quartile for Series A",
      "Gross margin: 68% — above SaaS benchmark (65%)",
      "TAM: $800M — below $1B threshold in investment policy",
      "Comparable exits: 3 comps at 8–12x ARR",
    ],
    flag: "TAM below fund minimum threshold — requires IC waiver",
    action: "Request expanded TAM analysis and schedule IC pre-screen",
  },
  banker: {
    summary: "Applicant passes KYC — moderate credit risk, loan structuring recommended.",
    findings: [
      "KYC status: PASS — no PEP or sanctions matches",
      "Credit score: 720 — prime borrower",
      "Debt-to-income: 38% — within policy limit (45%)",
      "Recommended structure: 5-year term, 6.2% fixed rate",
    ],
    flag: "Secondary income source unverified — request 3 months bank statements",
    action: "Proceed to credit committee with conditional approval",
  },
};

// ── Typewriter hook ───────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 28, active = true) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!active) { setDisplayed(""); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, active]);
  return displayed;
}

// ── Intersection observer hook ────────────────────────────────────────────────
function useInView(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Step 1: Role Selector ─────────────────────────────────────────────────────
function Step1RoleSelector({ active, selectedRole, onSelect }: {
  active: boolean;
  selectedRole: string | null;
  onSelect: (id: string) => void;
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    if (!active) { setHighlighted(null); return; }
    // Auto-highlight each role in sequence
    let i = 0;
    const roles = ROLES.map(r => r.id);
    const id = setInterval(() => {
      setHighlighted(roles[i % roles.length]);
      i++;
      if (i >= roles.length) {
        clearInterval(id);
        // Auto-select "analyst" after the highlight tour
        setTimeout(() => onSelect("analyst"), 400);
      }
    }, 320);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
        Select your role
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ROLES.map(role => {
          const isSelected = selectedRole === role.id;
          const isHovered = highlighted === role.id;
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 14px",
                borderRadius: 10,
                border: `1.5px solid ${isSelected ? role.color : isHovered ? role.color + "80" : NAVY_700}`,
                background: isSelected ? `${role.color}18` : isHovered ? `${role.color}0A` : NAVY_800,
                color: isSelected ? role.color : isHovered ? role.color : SILVER_300,
                fontSize: 13, fontWeight: isSelected ? 700 : 500,
                cursor: "pointer", fontFamily: FONT,
                transition: "all 0.2s ease",
                transform: isSelected ? "scale(1.04)" : "scale(1)",
                boxShadow: isSelected ? `0 0 12px ${role.color}30` : "none",
              }}
            >
              <span style={{ fontSize: 16 }}>{role.icon}</span>
              {role.label}
              {isSelected && (
                <span style={{ fontSize: 10, background: role.color, color: NAVY_950, borderRadius: 4, padding: "1px 5px", fontFamily: MONO, fontWeight: 700 }}>
                  SELECTED
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Agent Picker ──────────────────────────────────────────────────────
function Step2AgentPicker({ active, role, selectedAgents, onToggle }: {
  active: boolean;
  role: string;
  selectedAgents: Set<string>;
  onToggle: (name: string) => void;
}) {
  const agents = AGENTS_BY_ROLE[role] ?? AGENTS_BY_ROLE.analyst;
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!active) { setRevealed(0); return; }
    setRevealed(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= agents.length) clearInterval(id);
    }, 180);
    return () => clearInterval(id);
  }, [active, role]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
        Available agents · {agents.length} in domain
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {agents.map((agent, idx) => {
          const isVisible = idx < revealed;
          const isSelected = selectedAgents.has(agent.name);
          return (
            <button
              key={agent.name}
              onClick={() => onToggle(agent.name)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                border: `1.5px solid ${isSelected ? agent.color : NAVY_700}`,
                background: isSelected ? `${agent.color}12` : NAVY_800,
                color: SILVER_50,
                cursor: "pointer", textAlign: "left",
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(8px)",
                transition: "all 0.25s ease",
                fontFamily: FONT,
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${agent.color}20`,
                border: `1px solid ${agent.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isSelected
                  ? <span style={{ color: agent.color, fontSize: 14, fontWeight: 700 }}>✓</span>
                  : <span style={{ width: 8, height: 8, borderRadius: "50%", background: agent.color, display: "block" }} />
                }
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? agent.color : SILVER_50, lineHeight: 1.3 }}>{agent.name}</div>
                <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, marginTop: 2 }}>{agent.cap}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Run Output ────────────────────────────────────────────────────────
function Step3Output({ active, role, selectedAgents }: {
  active: boolean;
  role: string;
  selectedAgents: Set<string>;
}) {
  const output = SAMPLE_OUTPUTS[role] ?? SAMPLE_OUTPUTS.analyst;
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [agentsDone, setAgentsDone] = useState<string[]>([]);
  const agents = Array.from(selectedAgents).slice(0, 4);

  useEffect(() => {
    if (!active) { setPhase("idle"); setAgentsDone([]); return; }
    setPhase("running");
    setAgentsDone([]);
    let i = 0;
    const id = setInterval(() => {
      if (i < agents.length) {
        setAgentsDone(prev => [...prev, agents[i]]);
        i++;
      } else {
        clearInterval(id);
        setTimeout(() => setPhase("done"), 300);
      }
    }, 500);
    return () => clearInterval(id);
  }, [active, role]);

  const summaryText = useTypewriter(output.summary, 22, phase === "done");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Agent progress bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
          {phase === "running" ? "⚡ Agents running in parallel…" : phase === "done" ? "✓ All agents complete" : "Waiting…"}
        </div>
        {agents.map((name, idx) => {
          const isDone = agentsDone.includes(name);
          const roleData = ROLES.find(r => r.id === role);
          const color = roleData?.color ?? "#4ADE80";
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: isDone ? color : NAVY_700,
                boxShadow: isDone ? `0 0 6px ${color}` : "none",
                transition: "all 0.3s ease",
              }} />
              <div style={{ fontSize: 11, color: isDone ? color : SILVER_500, fontFamily: MONO, flex: 1, transition: "color 0.3s" }}>{name}</div>
              <div style={{
                height: 3, width: 80, borderRadius: 2,
                background: NAVY_700, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: `linear-gradient(90deg, ${color}, ${color}80)`,
                  width: isDone ? "100%" : phase === "running" && agentsDone.length > idx ? "60%" : "0%",
                  transition: "width 0.5s ease",
                }} />
              </div>
              <div style={{ fontSize: 10, color: isDone ? color : SILVER_500, fontFamily: MONO, width: 36, textAlign: "right" }}>
                {isDone ? "done" : phase === "running" ? "…" : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Output card */}
      {phase === "done" && (
        <div style={{
          background: NAVY_800, border: `1px solid ${NAVY_600}`,
          borderRadius: 12, padding: "14px 16px",
          animation: "fadeSlideIn 0.4s ease",
        }}>
          <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            ✦ Synthesised Output
          </div>
          <div style={{ fontSize: 13, color: SILVER_50, fontWeight: 600, lineHeight: 1.5, marginBottom: 10, minHeight: 20 }}>
            <>{summaryText}<span style={{ opacity: 0.5, animation: "blink 1s infinite" }}>|</span></>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {output.findings.map((f) => (
              <div key={f} style={{ display: "flex", gap: 8, fontSize: 11, color: SILVER_300 }}>
                <span style={{ color: "#4ADE80", flexShrink: 0 }}>→</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#F87171", borderRadius: 6, padding: "3px 8px", fontFamily: MONO }}>
              ⚠ {output.flag}
            </span>
            <span style={{ fontSize: 10, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80", borderRadius: 6, padding: "3px 8px", fontFamily: MONO }}>
              → {output.action}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Create New Agent ──────────────────────────────────────────────────
function Step4CreateAgent({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "typing" | "building" | "ready">("idle");
  const [dots, setDots] = useState(0);
  const promptText = "I need an agent that monitors GCC sovereign bond yields and alerts me when spreads exceed 50bps";
  const typed = useTypewriter(promptText, 30, phase === "typing");

  useEffect(() => {
    if (!active) { setPhase("idle"); return; }
    setPhase("typing");
    const t1 = setTimeout(() => setPhase("building"), (promptText.length * 30) + 600);
    const t2 = setTimeout(() => setPhase("ready"), (promptText.length * 30) + 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  useEffect(() => {
    if (phase !== "building") return;
    const id = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [phase]);

  const buildSteps = [
    { label: "Parsing requirements", done: phase === "ready" || dots >= 1 },
    { label: "Selecting base model & tools", done: phase === "ready" || dots >= 2 },
    { label: "Configuring domain context", done: phase === "ready" || dots >= 3 },
    { label: "Registering in platform", done: phase === "ready" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Prompt input */}
      <div style={{
        background: NAVY_800, border: `1px solid ${NAVY_600}`,
        borderRadius: 10, padding: "10px 14px",
      }}>
        <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, marginBottom: 6 }}>
          Describe the agent you need…
        </div>
        <div style={{ fontSize: 12, color: SILVER_50, lineHeight: 1.6, minHeight: 36 }}>
          {typed || (phase === "idle" ? "" : "")}
          {phase === "typing" && <span style={{ opacity: 0.5, animation: "blink 1s infinite" }}>|</span>}
        </div>
      </div>

      {/* Build progress */}
      {(phase === "building" || phase === "ready") && (
        <div style={{
          background: NAVY_800, border: `1px solid ${NAVY_700}`,
          borderRadius: 10, padding: "12px 14px",
          animation: "fadeSlideIn 0.3s ease",
        }}>
          <div style={{ fontSize: 10, color: "#A78BFA", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            ⚙ Building agent…
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {buildSteps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  background: step.done ? "#4ADE80" : "transparent",
                  border: `1.5px solid ${step.done ? "#4ADE80" : NAVY_600}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s ease",
                }}>
                  {step.done && <span style={{ fontSize: 8, color: NAVY_950, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 11, color: step.done ? SILVER_300 : SILVER_500, fontFamily: MONO, transition: "color 0.3s" }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready card */}
      {phase === "ready" && (
        <div style={{
          background: "rgba(74,222,128,0.06)",
          border: "1.5px solid rgba(74,222,128,0.35)",
          borderRadius: 10, padding: "12px 14px",
          animation: "fadeSlideIn 0.4s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>📡</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4ADE80" }}>GCC Bond Yield Monitor</div>
              <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, marginTop: 2 }}>Finance domain · Ready to use</div>
            </div>
            <div style={{
              marginLeft: "auto", fontSize: 10, background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.3)", color: "#4ADE80",
              borderRadius: 20, padding: "3px 10px", fontFamily: MONO, fontWeight: 700,
            }}>
              ● LIVE
            </div>
          </div>
          <div style={{ fontSize: 11, color: SILVER_300, marginTop: 10, lineHeight: 1.6 }}>
            Agent created and added to your Finance domain. It will monitor GCC sovereign bond spreads and alert you when thresholds are exceeded.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main HowItWorks component ─────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "Select your role",
    subtitle: "Tell the Mesh who you are",
    desc: "Choose your professional role. The Mesh personalises the agent catalogue to match your domain — Finance, Legal, Healthcare, Enterprise, and more.",
    color: "#60A5FA",
  },
  {
    num: "02",
    title: "Pick your agents",
    subtitle: "Browse specialist agents",
    desc: "Select from a curated list of specialist agents built for your domain. Each agent is purpose-built with domain-specific knowledge and capabilities.",
    color: "#4ADE80",
  },
  {
    num: "03",
    title: "Run & get results",
    subtitle: "Parallel execution in seconds",
    desc: "Selected agents run in parallel on your task. A synthesis layer combines all outputs into a structured result: summary, key findings, flags, and next actions.",
    color: "#FBBF24",
  },
  {
    num: "04",
    title: "Build missing agents",
    subtitle: "Don't see what you need?",
    desc: "Describe the agent you need in plain language. The platform builds, configures, and registers it in your domain automatically — ready to use immediately.",
    color: "#A78BFA",
  },
];

export function HowItWorks() {
  const { ref, inView } = useInView(0.15);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance through steps when section enters view
  useEffect(() => {
    if (!inView) return;
    const timings = [0, 3200, 7500, 13000];
    const timers = timings.map((t, i) => setTimeout(() => setActiveStep(i), t));
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  // Auto-select agents when step 2 activates
  useEffect(() => {
    if (activeStep !== 1 || !selectedRole) return;
    const agents = AGENTS_BY_ROLE[selectedRole] ?? AGENTS_BY_ROLE.analyst;
    const toSelect = agents.slice(0, 3).map(a => a.name);
    let i = 0;
    const id = setInterval(() => {
      if (i < toSelect.length) {
        setSelectedAgents(prev => new Set(Array.from(prev).concat(toSelect[i])));
        i++;
      } else {
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, [activeStep, selectedRole]);

  const handleRoleSelect = (id: string) => {
    setSelectedRole(id);
    setSelectedAgents(new Set());
  };

  const handleAgentToggle = (name: string) => {
    setSelectedAgents(prev => {
      const arr = Array.from(prev);
          if (prev.has(name)) return new Set(arr.filter(a => a !== name));
          return new Set([...arr, name]);
    });
  };

  const handleStepClick = (i: number) => {
    if (autoRef.current) clearTimeout(autoRef.current);
    setActiveStep(i);
    if (i === 0) { setSelectedRole(null); setSelectedAgents(new Set()); }
  };

  return (
    <section
      ref={ref}
      id="how-it-works"
      style={{
        padding: "96px 24px",
        background: `linear-gradient(180deg, ${NAVY_950} 0%, ${NAVY_900} 50%, ${NAVY_950} 100%)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${NAVY_700}18 1px, transparent 1px), linear-gradient(90deg, ${NAVY_700}18 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)",
      }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 14, fontWeight: 600 }}>
            How it works
          </div>
          <h2 style={{
            fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800,
            letterSpacing: "-0.03em", color: SILVER_50, lineHeight: 1.15,
            margin: "0 auto 16px",
          }}>
            From task to institutional output{" "}
            <span style={{ background: "linear-gradient(135deg, #7BA3D4 0%, #4ADE80 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              in 4 steps
            </span>
          </h2>
          <p style={{ fontSize: 15, color: SILVER_300, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
            AgenThinkMesh routes your task to the right specialist agents, runs them in parallel, and synthesises a structured result — all in seconds.
          </p>
        </div>

        {/* Step tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 40, borderBottom: `1px solid ${NAVY_700}`, overflowX: "auto" }}>
          {STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => handleStepClick(i)}
              style={{
                flex: "1 0 auto",
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                padding: "16px 20px 14px",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: `2.5px solid ${activeStep === i ? step.color : "transparent"}`,
                transition: "all 0.2s ease",
                minWidth: 140,
              }}
            >
              <div style={{ fontSize: 10, color: activeStep === i ? step.color : SILVER_500, fontFamily: MONO, fontWeight: 700, marginBottom: 4 }}>
                {step.num}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: activeStep === i ? SILVER_50 : SILVER_400, lineHeight: 1.3, textAlign: "left" }}>
                {step.title}
              </div>
              <div style={{ fontSize: 10, color: activeStep === i ? step.color : SILVER_500, fontFamily: MONO, marginTop: 2, textAlign: "left" }}>
                {step.subtitle}
              </div>
            </button>
          ))}
        </div>

        {/* Main content area */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 40,
          alignItems: "start",
        }}
          className="hiw-grid"
        >
          {/* Left: description */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Step indicator */}
            <div style={{ display: "flex", gap: 8 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{
                  height: 3, flex: 1, borderRadius: 2,
                  background: i <= activeStep ? s.color : NAVY_700,
                  transition: "background 0.4s ease",
                }} />
              ))}
            </div>

            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 11, color: STEPS[activeStep].color, fontFamily: MONO,
                background: `${STEPS[activeStep].color}12`,
                border: `1px solid ${STEPS[activeStep].color}30`,
                borderRadius: 20, padding: "4px 12px", marginBottom: 16,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: STEPS[activeStep].color, display: "inline-block" }} />
                Step {STEPS[activeStep].num}
              </div>
              <h3 style={{ fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 800, color: SILVER_50, letterSpacing: "-0.02em", marginBottom: 12, lineHeight: 1.2 }}>
                {STEPS[activeStep].title}
              </h3>
              <p style={{ fontSize: 14, color: SILVER_300, lineHeight: 1.8 }}>
                {STEPS[activeStep].desc}
              </p>
            </div>

            {/* Navigation arrows */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={() => handleStepClick(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "none", border: `1px solid ${NAVY_700}`,
                  color: activeStep === 0 ? SILVER_500 : SILVER_300,
                  cursor: activeStep === 0 ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                }}
              >← Prev</button>
              <button
                onClick={() => handleStepClick(Math.min(STEPS.length - 1, activeStep + 1))}
                disabled={activeStep === STEPS.length - 1}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: activeStep < STEPS.length - 1 ? STEPS[activeStep].color : "none",
                  border: `1px solid ${activeStep < STEPS.length - 1 ? STEPS[activeStep].color : NAVY_700}`,
                  color: activeStep < STEPS.length - 1 ? NAVY_950 : SILVER_500,
                  cursor: activeStep === STEPS.length - 1 ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                }}
              >Next →</button>
            </div>
          </div>

          {/* Right: animated demo panel */}
          <div style={{
            background: NAVY_900,
            border: `1px solid ${NAVY_700}`,
            borderRadius: 16,
            padding: "20px",
            minHeight: 320,
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${NAVY_700}` }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#F87171", "#FBBF24", "#4ADE80"].map(c => (
                  <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.7 }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: SILVER_500, fontFamily: MONO, flex: 1, textAlign: "center" }}>
                AgenThinkMesh · Live Demo
              </div>
              <div style={{
                fontSize: 9, color: STEPS[activeStep].color, fontFamily: MONO,
                background: `${STEPS[activeStep].color}15`,
                border: `1px solid ${STEPS[activeStep].color}30`,
                borderRadius: 4, padding: "2px 6px",
              }}>
                STEP {STEPS[activeStep].num}
              </div>
            </div>

            {/* Animated content per step */}
            <div style={{ minHeight: 260 }}>
              {activeStep === 0 && (
                <Step1RoleSelector
                  active={inView && activeStep === 0}
                  selectedRole={selectedRole}
                  onSelect={handleRoleSelect}
                />
              )}
              {activeStep === 1 && (
                <Step2AgentPicker
                  active={inView && activeStep === 1}
                  role={selectedRole ?? "analyst"}
                  selectedAgents={selectedAgents}
                  onToggle={handleAgentToggle}
                />
              )}
              {activeStep === 2 && (
                <Step3Output
                  active={inView && activeStep === 2}
                  role={selectedRole ?? "analyst"}
                  selectedAgents={selectedAgents.size > 0 ? selectedAgents : new Set(["Deal Screener", "DCF Modeller", "Comps Builder"])}
                />
              )}
              {activeStep === 3 && (
                <Step4CreateAgent active={inView && activeStep === 3} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA block ── */}
      <div style={{
        textAlign: "center",
        marginTop: 64,
        padding: "40px 24px",
        background: `linear-gradient(135deg, ${NAVY_800} 0%, ${NAVY_900} 100%)`,
        border: `1px solid ${NAVY_700}`,
        borderRadius: 20,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400, height: 200,
          background: "radial-gradient(ellipse, rgba(74,222,128,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12 }}>
          Ready to experience it?
        </div>
        <h3 style={{
          fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 800,
          color: SILVER_50, letterSpacing: "-0.02em", marginBottom: 10, lineHeight: 1.2,
        }}>
          Your first task is one click away
        </h3>
        <p style={{ fontSize: 14, color: SILVER_300, marginBottom: 28, lineHeight: 1.7, maxWidth: 420, margin: "0 auto 28px" }}>
          Select your role, pick your agents, and run your first task — no setup required.
        </p>
        <a
          href="https://agenthink-7enctkan.manus.space/persona-setup"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "14px 32px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #7BA3D4 0%, #4ADE80 100%)",
            color: "#04080F",
            fontSize: 15, fontWeight: 800,
            textDecoration: "none",
            letterSpacing: "-0.01em",
            boxShadow: "0 4px 24px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.3)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.04)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 32px rgba(74,222,128,0.35), 0 2px 12px rgba(0,0,0,0.3)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 24px rgba(74,222,128,0.25), 0 2px 8px rgba(0,0,0,0.3)";
          }}
        >
          <span style={{ fontSize: 18 }}>⚡</span>
          Try it yourself
        </a>
        <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, marginTop: 14 }}>
          No sign-in required to preview · 92 specialist agents ready
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @media (max-width: 768px) {
          .hiw-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
