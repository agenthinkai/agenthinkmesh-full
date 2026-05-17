/**
 * VoiceDemoAgent.tsx
 *
 * Guided 8-step demo walkthrough for AgenThinkMesh.
 * Each step narrates a key platform capability via browser SpeechSynthesis
 * with a full text fallback for unsupported browsers.
 *
 * Events fired:
 *   demo_started        — on page load
 *   step_advanced       — on each step transition
 *   question_asked      — when user submits a Q&A question
 *   handoff_requested   — when user clicks "Book a Live Demo"
 *   partnership_interest — when user clicks "Explore Partnership"
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = "#070d1a";
const NAVY = "#0b1629";
const NAVY_800 = "#0f1e35";
const CYAN = "#06b6d4";
const GOLD = "#f59e0b";
const WHITE = "#f1f5f9";
const MUTED = "#64748b";
const BORDER = "#1e3a5f";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ── Step definitions ──────────────────────────────────────────────────────────
interface DemoStep {
  id: number;
  title: string;
  subtitle: string;
  narration: string;
  visual: React.ReactNode;
  cta?: string;
}

const STEPS: DemoStep[] = [
  {
    id: 1,
    title: "Welcome to AgenThinkMesh",
    subtitle: "The Adversarial Consensus Engine",
    narration:
      "Welcome. AgenThinkMesh is the world's first adversarial consensus engine for institutional decision-making. Instead of one AI giving you one answer, ten specialised agents debate your deal — and only consensus survives.",
    visual: <CouncilVisual />,
  },
  {
    id: 2,
    title: "The Council of 10",
    subtitle: "Ten agents. One verdict.",
    narration:
      "Every evaluation runs through a Council of ten agents: a Valuation Analyst, a Risk Sentinel, a Macro Strategist, a Shariah Compliance Officer, a Challenger, a Concentration Monitor, an ESG Screener, a Governance Auditor, a Jurisdiction Router, and a Synthesis Chair. Each holds a distinct mandate. None can be overruled alone.",
    visual: <AgentGridVisual />,
  },
  {
    id: 3,
    title: "Submit Any Deal",
    subtitle: "Equity · Sukuk · Real Estate · PE · Sovereign",
    narration:
      "Paste a deal memo, upload a term sheet, or describe a scenario in plain language. The Mesh accepts any asset class: GCC equities, sukuk, real estate funds, private equity, sovereign portfolios, and procurement contracts.",
    visual: <DealInputVisual />,
  },
  {
    id: 4,
    title: "Adversarial Debate",
    subtitle: "Agents challenge each other's assumptions",
    narration:
      "The Council does not vote. It debates. The Challenger agent is structurally incentivised to find flaws in every bullish thesis. The Risk Sentinel escalates if concentration or tail-risk thresholds are breached. Consensus requires eighty percent agreement — or the deal is flagged for human review.",
    visual: <DebateVisual />,
  },
  {
    id: 5,
    title: "Shariah & Governance Layer",
    subtitle: "AAOIFI-compliant screening built in",
    narration:
      "Every evaluation includes an AAOIFI-compliant Shariah screen by default. The Governance Auditor produces a full audit trail — every agent vote, every dissent, every escalation — immutably logged and replayable.",
    visual: <ShariahVisual />,
  },
  {
    id: 6,
    title: "Sovereign AI Infrastructure",
    subtitle: "Your data never leaves your jurisdiction",
    narration:
      "AgenThinkMesh runs on SADO — the Sovereign AI Data Operations layer. Your deal data is encrypted at rest and in transit, processed inside your jurisdiction boundary, and never used to train any model. You hold the master encryption key.",
    visual: <SovereignVisual />,
  },
  {
    id: 7,
    title: "Verdict & Audit Replay",
    subtitle: "Explainable. Traceable. Defensible.",
    narration:
      "The final verdict is a structured report: consensus score, dissent map, risk flags, Shariah status, and a one-paragraph synthesis. Every step is replayable. You can show regulators exactly how the decision was reached.",
    visual: <VerdictVisual />,
  },
  {
    id: 8,
    title: "Run Your Own Deal",
    subtitle: "Live on agenthink-7enctkan.manus.space",
    narration:
      "The platform is live right now. Paste your own deal memo, contract, or portfolio scenario and watch the Council evaluate it in under sixty seconds. No setup. No integration. Just your deal, and ten agents.",
    visual: <LiveDemoVisual />,
    cta: "Run My Deal Now",
  },
];

// ── Visual components ─────────────────────────────────────────────────────────
function CouncilVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${CYAN}, #6366f1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: `0 0 40px ${CYAN}40` }}>⚖️</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {["10 Agents", "80% Consensus", "Audit Trail", "Real-time"].map(t => (
          <span key={t} style={{ background: `${CYAN}15`, border: `1px solid ${CYAN}30`, borderRadius: 20, padding: "4px 12px", fontSize: 12, color: CYAN, fontFamily: MONO }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function AgentGridVisual() {
  const agents = ["Valuation", "Risk", "Macro", "Shariah", "Challenger", "Concentration", "ESG", "Governance", "Jurisdiction", "Synthesis"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, maxWidth: 400 }}>
      {agents.map((a, i) => (
        <div key={a} style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{"🤖"}</div>
          <div style={{ fontSize: 10, color: i === 4 ? GOLD : CYAN, fontFamily: MONO, lineHeight: 1.2 }}>{a}</div>
        </div>
      ))}
    </div>
  );
}

function DealInputVisual() {
  return (
    <div style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%" }}>
      <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginBottom: 10 }}>DEAL MEMO</div>
      <div style={{ background: "#0a1220", borderRadius: 8, padding: 12, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        GCC REIT portfolio rebalance · 30 holdings · AED 200M AUM · Shariah-screened · concentration limit 8% per issuer...
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {["Equity", "Sukuk", "Real Estate", "PE"].map(t => (
          <span key={t} style={{ background: `${CYAN}10`, border: `1px solid ${CYAN}20`, borderRadius: 12, padding: "3px 8px", fontSize: 10, color: CYAN }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function DebateVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 380, width: "100%" }}>
      {[
        { agent: "Valuation", msg: "Fair value: AED 2.4/unit. 12% upside.", color: CYAN },
        { agent: "Challenger", msg: "Cap rate compression risk not priced in.", color: GOLD },
        { agent: "Risk Sentinel", msg: "Concentration in Dubai retail: 14%. Breach.", color: "#ef4444" },
        { agent: "Synthesis", msg: "Consensus: CONDITIONAL PASS. Reduce Dubai retail to 8%.", color: "#22c55e" },
      ].map(({ agent, msg, color }) => (
        <div key={agent} style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 10, color, fontFamily: MONO, minWidth: 90, paddingTop: 2 }}>{agent}</span>
          <span style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>{msg}</span>
        </div>
      ))}
    </div>
  );
}

function ShariahVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, #22c55e, #16a34a)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>☪️</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {["AAOIFI Compliant", "Audit Logged", "Replayable", "Immutable"].map(t => (
          <span key={t} style={{ background: "#22c55e15", border: "1px solid #22c55e30", borderRadius: 20, padding: "4px 12px", fontSize: 11, color: "#22c55e", fontFamily: MONO }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function SovereignVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, #6366f1, #8b5cf6)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔐</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 360 }}>
        {[
          { label: "Data Residency", val: "In-jurisdiction" },
          { label: "Encryption", val: "AES-256 + CMK" },
          { label: "Training Use", val: "Never" },
          { label: "Key Holder", val: "You" },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{label}</div>
            <div style={{ fontSize: 13, color: CYAN, fontWeight: 600, marginTop: 4 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerdictVisual() {
  return (
    <div style={{ background: NAVY_800, border: `1px solid #22c55e40`, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>COUNCIL VERDICT</span>
        <span style={{ background: "#22c55e20", border: "1px solid #22c55e40", borderRadius: 20, padding: "3px 12px", fontSize: 11, color: "#22c55e", fontFamily: MONO }}>CONDITIONAL PASS</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[{ label: "Consensus", val: "8/10" }, { label: "Risk Score", val: "3.2/10" }, { label: "Shariah", val: "Compliant" }].map(({ label, val }) => (
          <div key={label} style={{ flex: 1, background: "#0a1220", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{label}</div>
            <div style={{ fontSize: 14, color: CYAN, fontWeight: 700, marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        Reduce Dubai retail concentration to 8% before execution. All other parameters within mandate.
      </div>
    </div>
  );
}

function LiveDemoVisual() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${CYAN}, ${GOLD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: `0 0 40px ${CYAN}40`, animation: "pulse 2s infinite" }}>⚡</div>
      <div style={{ fontSize: 14, color: WHITE, textAlign: "center", lineHeight: 1.6 }}>
        Platform is <span style={{ color: "#22c55e", fontWeight: 700 }}>live now</span>.<br />
        Paste your deal and get a verdict in under 60 seconds.
      </div>
      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 40px ${CYAN}40} 50%{box-shadow:0 0 60px ${CYAN}70} }`}</style>
    </div>
  );
}

// ── Q&A panel ─────────────────────────────────────────────────────────────────
function QAPanel({ route }: { route: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const classify = trpc.voiceDemo.classifyQuestion.useMutation();
  const captureLead = trpc.voiceDemo.captureLead.useMutation();

  const ANSWERS: Record<string, string> = {
    council_mechanics: "The Council of 10 runs in parallel: each agent evaluates independently, then a structured debate phase resolves conflicts. Consensus requires 80% agreement. Dissenting agents' reasoning is preserved in the audit trail.",
    agent_roles: "Ten agents hold distinct mandates: Valuation, Risk, Macro, Shariah, Challenger, Concentration, ESG, Governance, Jurisdiction, and Synthesis. Each is tuned to a specific failure mode in institutional decision-making.",
    shariah_compliance: "The Shariah Compliance Officer agent screens against AAOIFI standards by default. It checks for riba, gharar, prohibited sectors, and sukuk structure validity. Results are logged and replayable.",
    sovereign_ai: "SADO (Sovereign AI Data Operations) ensures your data never leaves your jurisdiction. AES-256 encryption, customer-managed keys, and zero training-data use are enforced at the infrastructure layer.",
    pricing_and_access: "AgenThinkMesh offers a 60-day free trial with 50 runs. Institutional plans are available — contact us via the handoff form for pricing tailored to your mandate size.",
    integration: "The platform exposes a tRPC API and supports A2A (agent-to-agent) connectors via OpenClaw. Bloomberg, Refinitiv, and custom data feeds can be wired in at the council context layer.",
    data_security: "All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Customer-managed keys (CMK) are supported. No data is used for model training. Full audit logs are immutable and replayable.",
    use_cases: "Primary use cases: deal screening (PE, sukuk, equities), portfolio rebalancing, Shariah compliance checks, procurement vendor evaluation, sovereign portfolio stress testing, and M&A target screening.",
    deal_types: "Supported: GCC equities, sukuk, real estate funds (REITs), private equity, sovereign portfolios, procurement contracts, insurance/takaful, and custom asset classes via configuration.",
    performance_and_latency: "A standard 10-agent council evaluation completes in 45–90 seconds. Fleet mode (batch evaluations) supports 25 concurrent workers. P95 latency is logged and visible in the admin dashboard.",
    governance_and_audit: "Every agent vote, dissent, escalation, and synthesis step is immutably logged. The Audit Replay feature lets you reconstruct any decision step-by-step — defensible to regulators and investment committees.",
    onboarding: "No setup required. Sign in, paste your deal memo, and the Council runs immediately. For institutional onboarding with custom personas and data feeds, book a live demo via the handoff form.",
    comparison: "Unlike Bloomberg GPT or standalone LLMs, AgenThinkMesh uses adversarial consensus — no single model can produce a biased verdict unchallenged. It is purpose-built for institutional compliance, not general chat.",
    other: "That's a great question. For detailed answers, book a live demo with our team — we'll walk through your specific use case with a live Council evaluation.",
  };

  async function handleAsk() {
    if (!question.trim()) return;
    const result = await classify.mutateAsync({ question });
    setCategory(result.category);
    setAnswer(ANSWERS[result.category] ?? ANSWERS.other);
    captureLead.mutate({
      event: "question_asked",
      route,
      question,
      userAgent: navigator.userAgent,
    });
    trackEvent("voice_demo_question", { category: result.category, route });
  }

  return (
    <div style={{ background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginTop: 24 }}>
      <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginBottom: 12 }}>ASK A QUESTION</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAsk()}
          placeholder="How does the Shariah agent work?"
          style={{ flex: 1, background: "#0a1220", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", color: WHITE, fontSize: 13, outline: "none" }}
        />
        <button
          onClick={handleAsk}
          disabled={classify.isPending || !question.trim()}
          style={{ background: CYAN, color: "#0a1220", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: classify.isPending ? 0.6 : 1 }}
        >
          {classify.isPending ? "…" : "Ask"}
        </button>
      </div>
      {answer && (
        <div style={{ marginTop: 14 }}>
          {category && (
            <span style={{ background: `${CYAN}15`, border: `1px solid ${CYAN}30`, borderRadius: 20, padding: "3px 10px", fontSize: 10, color: CYAN, fontFamily: MONO, marginBottom: 8, display: "inline-block" }}>
              {category.replace(/_/g, " ")}
            </span>
          )}
          <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, marginTop: 8 }}>{answer}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function VoiceDemoAgent() {
  const [currentStep, setCurrentStep] = useState(0);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const logEvent = trpc.voiceDemo.logEvent.useMutation();
  const captureLead = trpc.voiceDemo.captureLead.useMutation();
  const route = "/voice-demo";

  // Detect speech synthesis support
  useEffect(() => {
    setSpeechAvailable(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Fire demo_started on mount
  useEffect(() => {
    logEvent.mutate({ event: "demo_started", route, step: 1 });
    captureLead.mutate({ event: "demo_started", route, userAgent: navigator.userAgent });
    trackEvent("voice_demo_started", { route });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = STEPS[currentStep];

  const speak = useCallback((text: string) => {
    if (!speechAvailable) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => {
      setIsSpeaking(false);
      if (autoAdvance && currentStep < STEPS.length - 1) {
        setTimeout(() => advanceStep(), 1200);
      }
    };
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [speechAvailable, autoAdvance, currentStep]);

  const stopSpeech = () => {
    if (speechAvailable) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const advanceStep = useCallback(() => {
    stopSpeech();
    const next = Math.min(currentStep + 1, STEPS.length - 1);
    setCurrentStep(next);
    logEvent.mutate({ event: "step_advanced", route, step: next + 1 });
    trackEvent("voice_demo_step", { step: next + 1, route });
  }, [currentStep, logEvent]);

  const prevStep = () => {
    stopSpeech();
    setCurrentStep(s => Math.max(s - 1, 0));
  };

  // Auto-speak when step changes
  useEffect(() => {
    if (speechAvailable) speak(step.narration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, speechAvailable]);

  const handleHandoff = (type: "handoff_requested" | "partnership_interest") => {
    captureLead.mutate({ event: type, route, userAgent: navigator.userAgent });
    trackEvent(`voice_demo_${type}`, { route });
    if (type === "handoff_requested") {
      window.open("https://calendly.com/farouq-agenthink/demo", "_blank");
    } else {
      window.open("mailto:farouq@agenthink.com?subject=Partnership%20Interest%20%E2%80%94%20AgenThinkMesh", "_blank");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: NAVY }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${CYAN}, #6366f1)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>A</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>AgenThinkMesh</span>
          <span style={{ background: `${CYAN}15`, border: `1px solid ${CYAN}30`, borderRadius: 20, padding: "2px 10px", fontSize: 10, color: CYAN, fontFamily: MONO }}>GUIDED DEMO</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED, cursor: "pointer" }}>
            <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} style={{ accentColor: CYAN }} />
            Auto-advance
          </label>
          {speechAvailable && (
            <button
              onClick={() => isSpeaking ? stopSpeech() : speak(step.narration)}
              style={{ background: isSpeaking ? `${GOLD}20` : `${CYAN}20`, border: `1px solid ${isSpeaking ? GOLD : CYAN}40`, borderRadius: 8, padding: "6px 14px", color: isSpeaking ? GOLD : CYAN, fontSize: 12, cursor: "pointer", fontFamily: MONO }}
            >
              {isSpeaking ? "⏹ Stop" : "▶ Narrate"}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: BORDER }}>
        <div style={{ height: "100%", background: `linear-gradient(90deg, ${CYAN}, #6366f1)`, width: `${((currentStep + 1) / STEPS.length) * 100}%`, transition: "width 0.4s ease" }} />
      </div>

      {/* Step counter */}
      <div style={{ padding: "12px 24px", display: "flex", gap: 8 }}>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { stopSpeech(); setCurrentStep(i); }}
            style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${i === currentStep ? CYAN : i < currentStep ? "#22c55e" : BORDER}`, background: i === currentStep ? `${CYAN}20` : i < currentStep ? "#22c55e20" : "transparent", color: i === currentStep ? CYAN : i < currentStep ? "#22c55e" : MUTED, fontSize: 11, cursor: "pointer", fontFamily: MONO, fontWeight: 700 }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        {/* Step header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginBottom: 8 }}>STEP {step.id} OF {STEPS.length}</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: WHITE, lineHeight: 1.15, marginBottom: 8, letterSpacing: "-0.03em" }}>{step.title}</h1>
          <p style={{ fontSize: 15, color: CYAN, fontFamily: MONO }}>{step.subtitle}</p>
        </div>

        {/* Visual */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, padding: "32px 24px", background: NAVY_800, border: `1px solid ${BORDER}`, borderRadius: 16 }}>
          {step.visual}
        </div>

        {/* Narration text */}
        <div style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "20px 24px", marginBottom: 24, position: "relative" }}>
          {isSpeaking && (
            <div style={{ position: "absolute", top: 12, right: 16, display: "flex", gap: 3 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ width: 3, height: 14, background: CYAN, borderRadius: 2, animation: `wave ${0.8 + i * 0.1}s ease-in-out infinite alternate`, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
          <p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.8, margin: 0 }}>{step.narration}</p>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 20px", color: currentStep === 0 ? MUTED : WHITE, fontSize: 14, cursor: currentStep === 0 ? "default" : "pointer", opacity: currentStep === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={advanceStep}
              style={{ background: `linear-gradient(135deg, ${CYAN}, #6366f1)`, border: "none", borderRadius: 8, padding: "10px 28px", color: "#0a1220", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Next Step →
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href="https://agenthink-7enctkan.manus.space"
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: `linear-gradient(135deg, ${CYAN}, #6366f1)`, border: "none", borderRadius: 8, padding: "10px 22px", color: "#0a1220", fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}
              >
                ⚡ Run My Deal
              </a>
              <button
                onClick={() => handleHandoff("handoff_requested")}
                style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "10px 18px", color: GOLD, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                📅 Book Demo
              </button>
            </div>
          )}
        </div>

        {/* Q&A Panel */}
        <QAPanel route={route} />

        {/* Footer CTAs */}
        <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => handleHandoff("handoff_requested")}
            style={{ background: "transparent", border: `1px solid ${CYAN}40`, borderRadius: 8, padding: "10px 20px", color: CYAN, fontSize: 13, cursor: "pointer" }}
          >
            Book a Live Demo
          </button>
          <button
            onClick={() => handleHandoff("partnership_interest")}
            style={{ background: "transparent", border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "10px 20px", color: GOLD, fontSize: 13, cursor: "pointer" }}
          >
            Explore Partnership
          </button>
          <a
            href="/demo-guide"
            style={{ background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 20px", color: MUTED, fontSize: 13, cursor: "pointer", textDecoration: "none" }}
          >
            View Demo Guide
          </a>
        </div>
      </div>

      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
