import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import {
  Brain, Zap, FileText, Shield, ArrowRight, CheckCircle2,
  Users, BarChart3, Globe, Mail, Building2, MessageSquare,
  ChevronRight, Layers, Network, Cpu, Play, X, TrendingUp,
  Database, Activity, Menu
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";

// ── Demo Mode Context ────────────────────────────────────────────────────────
// Demo mode is stored in sessionStorage so it persists across page navigations
// but resets when the browser tab is closed.
export function isDemoMode(): boolean {
  return sessionStorage.getItem("atm_demo_mode") === "1";
}
export function setDemoMode(on: boolean) {
  if (on) sessionStorage.setItem("atm_demo_mode", "1");
  else sessionStorage.removeItem("atm_demo_mode");
}

// ── Demo Banner (shown on all pages when demo mode is active) ────────────────
export function DemoBanner() {
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(isDemoMode());
  if (!visible) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-xs font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <Play className="w-3 h-3 flex-shrink-0" />
        <span>
          <strong>Demo Mode</strong> — You're exploring AgenThinkMesh with pre-loaded GCC enterprise data.
          All outputs are synthetic.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a href={getLoginUrl()}>
          <Button size="sm" variant="outline" className="h-6 px-3 text-xs border-white/40 bg-white/10 text-white hover:bg-white/20 hover:border-white/60">
            Sign Up Free
          </Button>
        </a>
        <button
          onClick={() => { setDemoMode(false); setVisible(false); }}
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/20 transition-colors"
          aria-label="Exit demo"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}



export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [demoLaunching, setDemoLaunching] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<"investment" | "procurement" | "insurance">("investment");
  const [taskInput, setTaskInput] = useState("Screen these 5 pitches against our early-stage B2B SaaS thesis");
  // stage tracks the ?stage= param to pass to PitchMirror; defaults to early_revenue (Pitch Triage default chip)
  const [chipStage, setChipStage] = useState("early_revenue");
  // chipLabel tracks the chip label for ?chip= conversion tracking in pitchMirrorRuns
  const [chipLabel, setChipLabel] = useState("Triage a pitch");
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChipClick = useCallback((label: string, value: string, stage: string) => {
    setTaskInput(value);
    setChipStage(stage);
    setChipLabel(label);
    /* ANALYTICS: Umami wired via trackEvent → window.umami.track */
    trackEvent("home_chip_click", { chip: label });
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus();
    }, 50);
  }, []);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const submitContact = trpc.contact.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setContactForm({ name: "", email: "", company: "", message: "" });
      toast.success("Message sent!", { description: "We'll get back to you within 24 hours." });
    },
    onError: (err) => {
      toast.error("Failed to send", { description: err.message });
    },
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitContact.mutate(contactForm);
  };

  function handleTryDemo() {
    setDemoLaunching(true);
    setDemoMode(true);
    setTimeout(() => {
      navigate("/forecast");
    }, 600);
  }

  return (
    <div className="min-h-screen bg-[#080B14] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#080B14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-6 md:px-12 h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Network className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            AgenThinkMesh
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors">How It Works</a>
          <a href="#domains" className="text-sm text-white/50 hover:text-white transition-colors">Domains</a>
          <a href="#platform-scope" onClick={(e) => { e.preventDefault(); document.getElementById('platform-scope')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer">Platform</a>
          <a href="#contact" className="text-sm text-white/50 hover:text-white transition-colors">Contact</a>
          <Link href="/demos" className="text-sm text-white/50 hover:text-white transition-colors">
            See examples
          </Link>
          <Link href="/pitchmirror" className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
            <span>🪞</span> PitchMirror
          </Link>
        </div>
        <button
          className="md:hidden p-2 text-white/50 hover:text-white transition-colors"
          onClick={() => setMobileNavOpen(v => !v)}
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-lg shadow-violet-500/20 text-xs">
                Open Dashboard <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTryDemo}
                disabled={demoLaunching}
                className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-white text-xs"
              >
                {demoLaunching ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                    Loading…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Play className="w-3 h-3" /> Try Demo
                  </span>
                )}
              </Button>
              <a href={getLoginUrl()}>
                <Button size="sm" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-lg shadow-violet-500/20 text-xs">
                  Get Started <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </a>
            </>
          )}
        </div>
        </div>{/* end flex row */}
        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#080B14]/95 px-6 py-4 flex flex-col gap-4">
            {[
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Domains", href: "#domains" },
              { label: "Platform", href: "#platform-scope" },
              { label: "Contact", href: "#contact" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm text-white/60 hover:text-white transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  const el = document.querySelector(href);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {label}
              </a>
            ))}
            <Link
              href="/demos"
              className="text-sm text-white/60 hover:text-white transition-colors"
              onClick={() => setMobileNavOpen(false)}
            >
              See examples
            </Link>
            <Link
              href="/pitchmirror"
              className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5"
              onClick={() => setMobileNavOpen(false)}
            >
              <span>🪞</span> PitchMirror — free
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-12 md:pb-20 px-4 md:px-12 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/15 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/3 w-[300px] h-[300px] bg-cyan-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Used by analysts and managers at leading institutions · Live
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
            Your team’s structured analysis,{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              on demand
            </span>
          </h1>

          <p className="text-lg text-white/65 max-w-2xl mx-auto mb-3 leading-relaxed">
            Stop spending hours on structured analysis. Describe your task, get a decision-ready output in seconds.
          </p>

          {/* ── WHAT DO YOU NEED TO DECIDE? CHIPS ── */}
          <div className="mb-8">
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">What do you need to decide today?</p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[
                { label: "Triage a pitch", value: "Screen these 5 pitches against our early-stage B2B SaaS thesis", stage: "early_revenue" },
                { label: "Screen a deal", value: "Evaluate this Series A deal against our investment criteria", stage: "scaling" },
                { label: "Evaluate a vendor", value: "Compare these 3 vendors against our procurement criteria for cloud infrastructure", stage: "building" },
                { label: "Assess a portfolio company", value: "Summarise the current performance of our 3 portfolio companies against Q2 targets", stage: "portfolio" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleChipClick(chip.label, chip.value, chip.stage)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                    taskInput === chip.value
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10 hover:text-white/80 hover:border-white/20"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 3-STEP EXPLAINER ── */}
          <div className="flex items-center justify-center gap-0 mb-8 flex-wrap">
            {[
              { num: "1", label: "Describe your task", icon: "✏️" },
              { num: "2", label: "Agents process it", icon: "⚡" },
              { num: "3", label: "Get a structured output", icon: "📄" },
            ].map((step, i) => (
              <div key={step.num} className="flex items-center gap-0">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                  <span className="text-base">{step.icon}</span>
                  <div className="text-left">
                    <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest leading-none mb-0.5">Step {step.num}</div>
                    <div className="text-xs font-medium text-white/75">{step.label}</div>
                  </div>
                </div>
                {i < 2 && (
                  <div className="flex items-center px-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── PRIMARY FREE-RUN CTA ── */}
          {!isAuthenticated && (
            <div className="mb-10 w-full max-w-xl mx-auto">
              <div className="flex items-center gap-2 rounded-2xl bg-white/[0.05] border border-white/10 px-4 py-3 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Describe your task…"
                  className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && taskInput.trim()) {
                      trackEvent("home_pitchmirror_cta_click", { location: "hero", chip: "enter" });
                      window.location.href = `/pitchmirror?task=${encodeURIComponent(taskInput)}&stage=${encodeURIComponent(chipStage)}&chip=${encodeURIComponent(chipLabel)}`;
                    }
                  }}
                />
                {/* ↵ Enter keyboard shortcut indicator */}
                <span className="flex-shrink-0 hidden sm:flex items-center gap-0.5 text-[10px] text-white/20 font-mono select-none pointer-events-none mr-1">
                  <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-white/20 text-[9px] leading-none">↵</kbd>
                  <span>Enter</span>
                </span>
                <a
                  href={`/pitchmirror?task=${encodeURIComponent(taskInput)}&stage=${encodeURIComponent(chipStage)}&chip=${encodeURIComponent(chipLabel)}`}
                  onClick={() => trackEvent("home_pitchmirror_cta_click", { location: "hero" })}
                  className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 transition-all duration-150 hover:scale-[1.03] focus:outline-none"
                  style={{ background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }}
                >
                  <span>Run free</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
              <p className="mt-2 text-xs text-white/35 text-center">
                No setup. No training. Just describe what you need.
              </p>
            </div>
          )}

          {/* ── LIVE WORKFLOWS SECTION ── */}
          <div className="mt-4 mb-6">
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-white/15" />
              <p className="text-xs font-bold text-white/70 uppercase tracking-[0.18em] font-mono">Live Workflows</p>
              <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-white/15" />
            </div>
            {/* ── ROLE SWITCHER TABS ── */}
            <div className="flex items-center justify-center gap-1.5 mb-5 flex-wrap">
              {([
                { id: "investment", label: "Investment" },
                { id: "procurement", label: "Procurement" },
                { id: "insurance", label: "Insurance" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveRole(tab.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                    activeRole === tab.id
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-900/30"
                      : "bg-white/[0.04] border-white/10 text-white/45 hover:bg-white/8 hover:text-white/70 hover:border-white/20"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="max-w-3xl mx-auto">
              {/* ── PITCH TRIAGE HERO CARD (Investment tab) ── */}
              {activeRole === "investment" && (
                <>
                  <Link href="/pitch-triage" className="block mb-3">
                    <button className="group relative w-full text-left flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/8 border-2 border-emerald-500/50 hover:border-emerald-400/80 hover:from-emerald-600/30 hover:to-emerald-600/12 transition-all duration-200 shadow-xl shadow-emerald-900/30 hover:-translate-y-0.5">
                      {/* Start Here badge */}
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-bold uppercase tracking-widest shadow-md shadow-emerald-900/40 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                        Start Here
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/25 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400/80 uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">VC / PE</span>
                      </div>
                      <div>
                        <div className="text-base font-bold text-white mb-1">Pitch Triage</div>
                        <div className="text-sm text-white/55 leading-relaxed mb-1">Sort your inbound deal flow in minutes, not days.</div>
                      </div>
                      {/* ── DEMO: video with static fallback ──
                           SWAP: replace the src below with the real screen recording URL once available.
                           The static terminal overlay is shown as a fallback when no video src is set.
                      ── */}
                      <div className="w-full rounded-xl overflow-hidden border border-emerald-500/20 bg-[#0a1a12] relative">
                        {/*
                          SWAP: To activate the demo video:
                          1. Set src="YOUR_RECORDING_URL" (e.g. "https://cdn.example.com/pitch-triage-demo.mp4")
                          2. REMOVE the style={{ display: "none" }} prop from the video tag below
                          The static terminal fallback will then be hidden automatically.
                        */}
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full block"
                          src=""
                          style={{ display: "none" }}
                        />
                        {/* Static fallback terminal — shown until real video is swapped in */}
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/30 border-b border-emerald-500/15">
                          <span className="w-2 h-2 rounded-full bg-red-500/70" />
                          <span className="w-2 h-2 rounded-full bg-yellow-500/70" />
                          <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                          <span className="ml-2 text-[10px] font-mono text-emerald-400/50">pitch-triage — live output</span>
                        </div>
                        <div className="p-3 font-mono text-[10px] leading-relaxed space-y-1 select-none">
                          <div className="text-white/30">&gt; Analysing 5 pitches…</div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">ENGAGE</span>
                            <span className="text-white/60">Pitch #1 — B2B SaaS, strong PMF signal</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">WATCH</span>
                            <span className="text-white/60">Pitch #2 — Early traction, market unclear</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">PASS</span>
                            <span className="text-white/60">Pitch #3 — Outside thesis, pre-revenue</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">ENGAGE</span>
                            <span className="text-white/60">Pitch #4 — Series A ready, strong team</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">PASS</span>
                            <span className="text-white/60">Pitch #5 — Consumer, not B2B</span>
                          </div>
                          <div className="pt-1 text-emerald-400/60">✓ Done in 1m 42s · 2 engage · 1 watch · 2 pass</div>
                        </div>
                      </div>
                      <div className="text-xs text-emerald-400/80 italic">“Triage 50 pitches in the time it used to take for one”</div>
                      <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        Run Pitch Triage <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </Link>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Deal Screening */}
                    <Link href="/deals">
                      <button className="group w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-violet-600/15 to-violet-600/5 border border-violet-500/35 hover:border-violet-400/65 hover:from-violet-600/25 hover:to-violet-600/10 transition-all duration-200 shadow-lg shadow-violet-900/20 hover:-translate-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                            <BarChart3 className="w-4.5 h-4.5 text-violet-400" />
                          </div>
                          <span className="text-[9px] font-mono text-violet-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">Investment</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white mb-1">Deal Screening</div>
                          <div className="text-xs text-white/45 leading-relaxed">Upload pitches. Get ranked, structured summaries ready for committee.</div>
                        </div>
                        <div className="text-xs font-medium text-violet-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                          Run Deal Screening <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    </Link>
                    {/* PortfolioMesh */}
                    <Link href="/portfolio-mesh">
                      <button className="group w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-amber-600/15 to-amber-600/5 border border-amber-500/35 hover:border-amber-400/65 hover:from-amber-600/25 hover:to-amber-600/10 transition-all duration-200 shadow-lg shadow-amber-900/20 hover:-translate-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4.5 h-4.5 text-amber-400" />
                          </div>
                          <span className="text-[9px] font-mono text-amber-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">Portfolio</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white mb-1">PortfolioMesh</div>
                          <div className="text-xs text-white/45 leading-relaxed">Track and report on portfolio companies without manual data wrangling.</div>
                        </div>
                        <div className="text-xs font-medium text-amber-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                          Run PortfolioMesh <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    </Link>
                  </div>
                </>
              )}
              {/* ── PROCUREMENT TAB ── */}
              {activeRole === "procurement" && (
                <div className="grid grid-cols-1 gap-3">
                  <Link href="/procurement">
                    <button className="group relative w-full text-left flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-br from-cyan-600/20 to-cyan-600/8 border-2 border-cyan-500/50 hover:border-cyan-400/80 transition-all duration-200 shadow-xl shadow-cyan-900/30 hover:-translate-y-0.5">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white text-[9px] font-bold uppercase tracking-widest shadow-md whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                        Start Here
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-xl bg-cyan-500/25 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-cyan-400" />
                        </div>
                        <span className="text-[9px] font-mono text-cyan-400/80 uppercase tracking-widest px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/25">Procurement</span>
                      </div>
                      <div>
                        <div className="text-base font-bold text-white mb-1">Procurement Evaluation</div>
                        <div className="text-sm text-white/55 leading-relaxed">Evaluate vendors against your criteria automatically.</div>
                      </div>
                      <div className="text-sm font-semibold text-cyan-400 flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        Run Procurement Evaluation <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </Link>
                </div>
              )}
              {/* ── INSURANCE TAB ── */}
              {activeRole === "insurance" && (
                <div className="grid grid-cols-1 gap-3">
                  <Link href="/insurance">
                    <button className="group relative w-full text-left flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-br from-sky-600/20 to-sky-600/8 border-2 border-sky-500/50 hover:border-sky-400/80 transition-all duration-200 shadow-xl shadow-sky-900/30 hover:-translate-y-0.5">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-[9px] font-bold uppercase tracking-widest shadow-md whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                        Start Here
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-xl bg-sky-500/25 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-5 h-5 text-sky-400" />
                        </div>
                        <span className="text-[9px] font-mono text-sky-400/80 uppercase tracking-widest px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/25">Insurance</span>
                      </div>
                      <div>
                        <div className="text-base font-bold text-white mb-1">Insurance Intelligence</div>
                        <div className="text-sm text-white/55 leading-relaxed">Process and triage claims or risk inputs consistently.</div>
                      </div>
                      <div className="text-sm font-semibold text-sky-400 flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        Run Insurance Workflow <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  </Link>
                </div>
              )}
            </div>
            {/* ── METRICS BAR ── */}
            <div className="mt-5 flex items-center justify-center gap-0 flex-wrap max-w-2xl mx-auto">
              {[
                { value: "6,200+", label: "decisions processed" },
                { value: "14", label: "industries served" },
                { value: "<2 min", label: "task to output" },
                { value: "6", label: "institutional domains" },
              ].map((stat, i) => (
                <div key={stat.value} className="flex items-center gap-0">
                  <div className="flex flex-col items-center px-5 py-2">
                    <span className="text-base font-bold text-emerald-400 leading-none">{stat.value}</span>
                    <span className="text-[10px] text-white/40 font-mono mt-0.5">{stat.label}</span>
                  </div>
                  {i < 3 && <div className="w-px h-6 bg-white/10" />}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-xl shadow-violet-500/25 px-8">
                  Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button size="lg" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-xl shadow-violet-500/25 px-8">
                    Start for Free <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleTryDemo}
                  disabled={demoLaunching}
                  className="border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-white px-8"
                >
                  {demoLaunching ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
                      Launching demo…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="w-4 h-4" /> Try Live Demo
                    </span>
                  )}
                </Button>
              </>
            )}
            <a href="#contact">
              <Button size="lg" variant="outline" className="border-white/10 bg-transparent text-white/70 hover:text-white hover:border-white/20 px-8">
                Talk to Sales
              </Button>
            </a>
          </div>

          {/* Hero stat pills */}
          <div className="flex items-center justify-center gap-3 mt-12 flex-wrap">
            {[
              { icon: <Cpu className="w-3.5 h-3.5" />, label: "115 Active Agents" },
              { icon: <Layers className="w-3.5 h-3.5" />, label: "6 Domains" },
              { icon: <Zap className="w-3.5 h-3.5" />, label: "<2s Routing" },
              { icon: <Shield className="w-3.5 h-3.5" />, label: "Auditable Outputs" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-xs text-white/60">
                {s.icon} {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO PREVIEW STRIP ── */}
      {!isAuthenticated && (
        <section className="py-16 px-6 md:px-12 border-t border-white/5 bg-gradient-to-b from-violet-950/20 to-transparent">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-xs text-violet-400 font-mono uppercase tracking-widest mb-3">Live Demo</p>
              <h2 className="text-3xl font-bold tracking-tight mb-3">See it working — no sign-up required</h2>
              <p className="text-sm text-white/50 max-w-xl mx-auto">
                Explore pre-loaded institutional scenarios across forecasting, knowledge retrieval, and multi-agent workflows — no sign-up required.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                {
                  icon: <TrendingUp className="w-5 h-5 text-violet-400" />,
                  title: "ForecastMesh",
                  desc: "Structured forecasting workflows for institutional planning and decision support.",
                  badge: "8 scenarios",
                  href: "/forecast",
                },
                {
                  icon: <Database className="w-5 h-5 text-cyan-400" />,
                  title: "Knowledge Vault",
                  desc: "Document-grounded institutional memory for consistent, auditable outputs.",
                  badge: "460 scenarios",
                  href: "/knowledge-vault",
                },
                {
                  icon: <Activity className="w-5 h-5 text-emerald-400" />,
                  title: "Agent Mesh",
                  desc: "Specialist agent workflows across domains, designed for structured review and execution.",
                  badge: "120+ agents",
                  href: "/mesh",
                },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={handleTryDemo}
                  className="text-left p-5 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-violet-500/30 hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">{item.icon}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">{item.badge}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5 group-hover:text-violet-300 transition-colors">{item.title}</h3>
                  <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-violet-400/60 group-hover:text-violet-400 transition-colors">
                    <Play className="w-3 h-3" /> Launch demo
                  </div>
                </button>
              ))}
            </div>
            <div className="text-center">
              <Button
                size="lg"
                onClick={handleTryDemo}
                disabled={demoLaunching}
                className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-xl shadow-violet-500/25 px-10"
              >
                {demoLaunching ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Launching…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Play className="w-4 h-4" /> Launch Full Demo — No Sign-Up
                  </span>
                )}
              </Button>
              <p className="text-xs text-white/30 mt-3">All data is synthetic. No account required.</p>
            </div>
          </div>
        </section>
      )}

      {/* ── FOUNDER CTA STRIP — PitchMirror ── */}
      <section className="py-10 px-6 md:px-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-6 py-5 rounded-2xl bg-white/[0.025] border border-white/8 hover:border-white/12 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90 mb-1">
                  Founder? Get feedback before you send your pitch.
                </p>
                <p className="text-xs text-white/45 leading-relaxed max-w-md">
                  Try PitchMirror to see what investors will notice, what&apos;s missing, and what to fix before submitting.
                </p>
              </div>
            </div>
            <Link href="/pitchmirror/landing" className="flex-shrink-0">
              <button
                onClick={() =>
                  trackEvent("pitchmirror_cta_click", {
                    location: "homepage_strip",
                    label: "Try PitchMirror",
                  })
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/35 text-violet-300 text-sm font-semibold hover:bg-violet-600/30 hover:border-violet-400/55 hover:text-white transition-all duration-200 whitespace-nowrap"
              >
                Try PitchMirror <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6 md:px-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-violet-400 font-mono uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-4xl font-bold tracking-tight">Everything your team needs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Brain className="w-5 h-5 text-violet-400" />, title: "Smart Agent Routing", desc: "LLM analyses your prompt and automatically selects the most relevant specialist agents — no manual selection needed." },
              { icon: <Zap className="w-5 h-5 text-cyan-400" />, title: "Parallel Execution", desc: "All matched agents run simultaneously. A task that would take hours sequentially completes in seconds." },
              { icon: <FileText className="w-5 h-5 text-emerald-400" />, title: "Mesh Final Summary", desc: "All agent outputs are synthesised into a single executive brief with key findings, conflicts, and next actions." },
              { icon: <Layers className="w-5 h-5 text-violet-400" />, title: "Document Vault", desc: "Upload Excel, PDF, Word, or PPTX files. Agents receive the extracted content as context for every task." },
              { icon: <Globe className="w-5 h-5 text-cyan-400" />, title: "External Agent Registry", desc: "Register and discover third-party agents. Extend the mesh with your own specialist endpoints." },
              { icon: <BarChart3 className="w-5 h-5 text-emerald-400" />, title: "Task History", desc: "Every task run is stored with full outputs, context used, and the synthesised summary for future reference." },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 hover:-translate-y-1 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">{f.icon}</div>
                <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 md:px-12 bg-white/[0.015] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-violet-400 font-mono uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl font-bold tracking-tight">From prompt to brief in 3 steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", icon: <Brain className="w-6 h-6" />, title: "Analyse", desc: "LLM reads your prompt and identifies the domain and optimal agent set." },
              { step: "02", icon: <Network className="w-6 h-6" />, title: "Assemble", desc: "Relevant agents activate one by one in an animated discovery sequence." },
              { step: "03", icon: <Zap className="w-6 h-6" />, title: "Execute", desc: "All agents run in parallel with your documents as injected context." },
              { step: "04", icon: <FileText className="w-6 h-6" />, title: "Synthesise", desc: "Outputs merge into a single brief: findings, conflicts, next actions." },
            ].map((s, i) => (
              <div key={s.step} className="relative text-center">
                {i < 3 && <div className="hidden md:block absolute top-8 left-[60%] right-0 h-px bg-gradient-to-r from-violet-500/30 to-transparent" />}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 text-violet-400">
                  {s.icon}
                </div>
                <div className="text-xs font-mono text-violet-400/60 mb-1">{s.step}</div>
                <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOMAINS ── */}
      <section id="domains" className="py-24 px-6 md:px-12 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-violet-400 font-mono uppercase tracking-widest mb-3">Agent Domains</p>
            <h2 className="text-4xl font-bold tracking-tight mb-3">Six institutional domains</h2>
            <p className="text-sm text-white/40 max-w-xl mx-auto">
              Each domain hosts specialist agents configured for domain-specific workflows, terminology, and decision frameworks.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            {[
              { color: "from-violet-500 to-purple-600", icon: "💼", domain: "Finance", contexts: ["VC / PE Fund", "Sovereign Wealth", "Fund Manager"] },
              { color: "from-sky-500 to-blue-600", icon: "⚖️", domain: "Legal", contexts: ["Contract Review", "Compliance", "Regulatory"] },
              { color: "from-emerald-500 to-teal-600", icon: "🏥", domain: "Healthcare", contexts: ["Clinical workflows", "Claims review", "Risk assessment"] },
              { color: "from-orange-500 to-amber-600", icon: "🏢", domain: "Enterprise", contexts: ["Strategy", "Operations", "Procurement"] },
              { color: "from-pink-500 to-rose-600", icon: "🌍", domain: "GCC Wealth", contexts: ["Family Office", "Private Banking", "Endowment"] },
              { color: "from-indigo-500 to-violet-600", icon: "🎓", domain: "Education", contexts: ["Research", "Essay Writing", "Study Planning"] },
            ].map((d) => (
              <Link key={d.domain} href="/domains">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-all hover:-translate-y-1 duration-300 cursor-pointer h-full">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center text-lg mb-3 shadow-lg`}>
                    {d.icon}
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{d.domain}</h3>
                  <div className="space-y-1">
                    {d.contexts.map((c) => (
                      <div key={c} className="flex items-center gap-1.5 text-xs text-white/40">
                        <ChevronRight className="w-3 h-3" /> {c}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* PortfolioMesh — core system module */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-950/40 to-violet-950/40 border border-blue-500/20 p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/20">
                  📈
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-base text-white">PortfolioMesh</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 font-mono">Core Module</span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  A 6-step institutional asset allocation engine. Covers IPS configuration, macro regime classification,
                  per-asset-class agent estimates, five portfolio construction methods, and CIO-level Board Memo output.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["IPS Setup", "Macro Regime", "Asset Agents", "Portfolio Construction", "CIO Board Memo"].map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/40">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <Link href="/portfolio-mesh">
                  <Button variant="outline" size="sm" className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-xs">
                    Open PortfolioMesh <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DECISION TO PORTFOLIO SECTION ── */}
      <section id="platform-scope" className="py-24 px-6 md:px-12 bg-white/[0.015] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-violet-400 font-mono uppercase tracking-widest mb-3">Platform Scope</p>
            <h2 className="text-4xl font-bold tracking-tight mb-4">From Decision Analysis to Portfolio Construction</h2>
            <p className="text-sm text-white/40 max-w-2xl mx-auto leading-relaxed">
              AgenThinkMesh covers the full institutional decision workflow — from evaluating individual opportunities
              to constructing and reviewing a complete portfolio allocation.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <FileText className="w-6 h-6 text-violet-400" />,
                step: "01",
                title: "Deal Evaluation",
                desc: "The Deal Screener runs a structured Council of 10 evaluation roles against any investment opportunity. Each role produces a structured verdict. Outputs are consolidated into an IC Memo with PDF export.",
                tags: ["IC Memo", "10 Roles", "PDF Export"],
              },
              {
                icon: <BarChart3 className="w-6 h-6 text-cyan-400" />,
                step: "02",
                title: "Portfolio Construction",
                desc: "PortfolioMesh allocates capital across six asset classes using five construction methods (Equal Weight, Max Sharpe, Risk Parity, Min Variance, Max Diversification) within IPS constraints.",
                tags: ["5 Methods", "6 Asset Classes", "IPS Constraints"],
              },
              {
                icon: <Building2 className="w-6 h-6 text-emerald-400" />,
                step: "03",
                title: "Committee-ready outputs",
                desc: "Every run produces structured, auditable outputs: Board Memos with 9 institutional sections, IPS compliance checks, benchmark comparisons, and risk assessments with severity ratings.",
                tags: ["Board Memo", "IPS Compliance", "Audit Trail"],
              },
            ].map((item, i) => (
              <div key={item.step} className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-all duration-300">
                {i < 2 && <div className="hidden md:block absolute top-10 right-0 translate-x-1/2 z-10 text-white/20 text-lg">→</div>}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">{item.icon}</div>
                  <span className="text-xs font-mono text-white/25">{item.step}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2 text-white">{item.title}</h3>
                <p className="text-xs text-white/45 leading-relaxed mb-4">{item.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/35">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT US ── */}
      <section id="contact" className="py-24 px-6 md:px-12 bg-white/[0.015] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Left — copy */}
            <div>
              <p className="text-xs text-violet-400 font-mono uppercase tracking-widest mb-3">Contact Us</p>
              <h2 className="text-4xl font-bold tracking-tight mb-5">
                Ready to deploy<br />
                <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                  your agent mesh?
                </span>
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                Whether you want a live demo, a custom deployment, or just have a question —
                our team responds within 24 hours.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Mail className="w-4 h-4 text-violet-400" />, label: "Email", value: "kishore@agenthink.ai" },
                  { icon: <Globe className="w-4 h-4 text-cyan-400" />, label: "Website", value: "agenthink.ai" },
                  { icon: <Users className="w-4 h-4 text-emerald-400" />, label: "Trust", value: "Used by investment and procurement teams at leading institutions globally" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">{c.icon}</div>
                    <div>
                      <div className="text-xs text-white/40 font-mono">{c.label}</div>
                      <div className="text-sm text-white/80">{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — form */}
            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/8">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Message sent!</h3>
                  <p className="text-sm text-white/50">We'll get back to you within 24 hours.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4 text-white/40 hover:text-white"
                    onClick={() => setSubmitted(false)}
                  >
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/50 font-mono mb-1.5">Full Name *</label>
                    <Input
                      value={contactForm.name}
                      onChange={(e) => setContactForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Farouq Sultan"
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 font-mono mb-1.5">Email Address *</label>
                    <Input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@company.com"
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 font-mono mb-1.5">Company</label>
                    <Input
                      value={contactForm.company}
                      onChange={(e) => setContactForm(f => ({ ...f, company: e.target.value }))}
                      placeholder="AgenThink"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 font-mono mb-1.5">Message *</label>
                    <Textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us about your use case or ask a question..."
                      required
                      rows={4}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 focus:ring-violet-500/20 resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitContact.isPending}
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-lg shadow-violet-500/20"
                  >
                    {submitContact.isPending ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</span>
                    ) : (
                      <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Send Message</span>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-6 md:px-12 py-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* IC Demo links row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">IC Memos</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/demos" className="text-xs text-emerald-400/70 hover:text-emerald-300 transition-colors font-medium">All Demos</Link>
              <Link href="/sg-ic" className="text-xs text-white/35 hover:text-white/70 transition-colors">Singapore IC Memo</Link>
              <Link href="/jp-ic" className="text-xs text-white/35 hover:text-white/70 transition-colors">Japan IC Memo</Link>
              <Link href="/us-ic" className="text-xs text-white/35 hover:text-white/70 transition-colors">US IC Memo</Link>
              <Link href="/gcc-ic" className="text-xs text-white/35 hover:text-white/70 transition-colors">GCC IC Memo</Link>
            </div>
          </div>
          {/* Bottom row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <Network className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">AgenThinkMesh</span>
            </div>
            <p className="text-xs text-white/30 font-mono">© 2026 AgenThink · A structured decision layer for institutional workflows</p>
            <div className="flex gap-6">
              {["Privacy", "Terms", "Docs"].map((l) => (
                <a key={l} href="#" className="text-xs text-white/30 hover:text-white/60 transition-colors">{l}</a>
              ))}
              <Link href="/security" className="text-xs text-white/30 hover:text-white/60 transition-colors">Data &amp; Security</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
