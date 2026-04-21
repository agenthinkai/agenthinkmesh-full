import { useState } from "react";
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

// ── Education Waitlist Card ─────────────────────────────────────────────────
function EducationWaitlistCard() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setDone(true),
    onError: () => setDone(true), // still show success to avoid leaking errors
  });
  return (
    <div className="w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-pink-600/10 to-pink-600/5 border border-pink-500/25">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4.5 h-4.5 text-pink-400" />
        </div>
        <span className="text-[9px] font-mono text-pink-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20">Education</span>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="text-sm font-semibold text-white">Education Workflow</div>
          <span className="px-2 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/25 text-[9px] font-mono uppercase tracking-widest text-pink-400/70">Coming Soon</span>
        </div>
        <div className="text-xs text-white/45 leading-relaxed">Curriculum design, assessment review, and institutional learning analytics.</div>
      </div>
      {done ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> You're on the list!
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) joinWaitlist.mutate({ email, workflow: "education" });
          }}
          className="flex gap-1.5"
        >
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20"
          />
          <button
            type="submit"
            disabled={joinWaitlist.isPending}
            className="px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30 text-xs font-medium text-pink-300 hover:bg-pink-500/30 hover:text-pink-200 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {joinWaitlist.isPending ? "…" : "Join waitlist"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [demoLaunching, setDemoLaunching] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
            115 verified specialist agents · Live
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
            AI agents that turn messy inputs{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              into structured decisions
            </span>
          </h1>

          <p className="text-lg text-white/65 max-w-2xl mx-auto mb-3 leading-relaxed">
            Describe any investment, procurement, or portfolio decision — and get a clear, structured output in seconds.
          </p>

          <p className="text-sm text-white/40 max-w-xl mx-auto mb-8 leading-relaxed">
            Now covering{" "}
            <Link href="/portfolio-mesh" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">PortfolioMesh</Link>
            {" "}(asset allocation),{" "}
            <Link href="/pitch-triage" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Pitch Triage</Link>
            {" "}(deal evaluation), and the{" "}
            <Link href="/domains" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">Education</Link>
            {" "}domain.
          </p>

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
            <div className="mb-10">
              <Link href="/pitchmirror">
                <button
                  className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-base shadow-2xl shadow-violet-500/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-[#080B14]"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
                  }}
                  onClick={() => trackEvent("home_pitchmirror_cta_click", { location: "hero" })}
                >
                  <span className="text-xl">🪞</span>
                  <span>Try it now — no login required</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <p className="mt-3 text-xs text-white/40 text-center">
                Free first analysis • takes ~30 seconds
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl mx-auto">
              {/* Deal Screening — Most Popular */}
              <Link href="/deals">
                <button className="group relative w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-violet-600/15 to-violet-600/5 border border-violet-500/35 hover:border-violet-400/65 hover:from-violet-600/25 hover:to-violet-600/10 transition-all duration-200 shadow-lg shadow-violet-900/20 hover:-translate-y-0.5">
                  {/* Most Popular badge */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-bold uppercase tracking-widest shadow-md shadow-emerald-900/40 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                    Most Popular
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="w-4.5 h-4.5 text-violet-400" />
                    </div>
                    <span className="text-[9px] font-mono text-violet-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">Investment</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Deal Screening</div>
                    <div className="text-xs text-white/45 leading-relaxed">10-role council evaluates any deal and outputs a structured IC memo.</div>
                  </div>
                  <div className="text-xs font-medium text-violet-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Run Deal Screening <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              </Link>
              {/* Procurement */}
              <Link href="/procurement">
                <button className="group w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-cyan-600/15 to-cyan-600/5 border border-cyan-500/35 hover:border-cyan-400/65 hover:from-cyan-600/25 hover:to-cyan-600/10 transition-all duration-200 shadow-lg shadow-cyan-900/20 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4.5 h-4.5 text-cyan-400" />
                    </div>
                    <span className="text-[9px] font-mono text-cyan-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">Procurement</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Procurement Evaluation</div>
                    <div className="text-xs text-white/45 leading-relaxed">Score vendors and RFPs against your criteria with structured agent review.</div>
                  </div>
                  <div className="text-xs font-medium text-cyan-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Run Procurement Evaluation <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              </Link>
              {/* Pitch Triage */}
              <Link href="/pitch-triage">
                <button className="group w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-emerald-600/15 to-emerald-600/5 border border-emerald-500/35 hover:border-emerald-400/65 hover:from-emerald-600/25 hover:to-emerald-600/10 transition-all duration-200 shadow-lg shadow-emerald-900/20 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">VC / PE</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Pitch Triage</div>
                    <div className="text-xs text-white/45 leading-relaxed">Multi-agent triage of startup pitches — engage, watch, or pass in seconds.</div>
                  </div>
                  <div className="text-xs font-medium text-emerald-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Run Pitch Triage <ArrowRight className="w-3 h-3" />
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
                    <div className="text-xs text-white/45 leading-relaxed">Institutional asset allocation analysis across equities, fixed income, and alternatives.</div>
                  </div>
                  <div className="text-xs font-medium text-amber-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Run PortfolioMesh <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              </Link>
              {/* Education — Waitlist */}
              <EducationWaitlistCard />
              {/* Insurance / Reinsurance */}
              <Link href="/insurance">
                <button className="group w-full text-left flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-sky-600/15 to-sky-600/5 border border-sky-500/35 hover:border-sky-400/65 hover:from-sky-600/25 hover:to-sky-600/10 transition-all duration-200 shadow-lg shadow-sky-900/20 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-4.5 h-4.5 text-sky-400" />
                    </div>
                    <span className="text-[9px] font-mono text-sky-400/70 uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20">Insurance</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">Insurance Intelligence</div>
                    <div className="text-xs text-white/45 leading-relaxed">Risk assessment and reinsurance analysis powered by specialist agents.</div>
                  </div>
                  <div className="text-xs font-medium text-sky-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                    Run Insurance Workflow <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              </Link>
            </div>
            {/* ── METRICS BAR ── */}
            <div className="mt-5 flex items-center justify-center gap-0 flex-wrap max-w-2xl mx-auto">
              {[
                { value: "6,200+", label: "decisions processed" },
                { value: "115", label: "specialist agents" },
                { value: "<2s", label: "average response" },
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
                  { icon: <Users className="w-4 h-4 text-emerald-400" />, label: "Trust", value: "Trusted by institutional decision-makers globally" },
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
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
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
          </div>
        </div>
      </footer>

    </div>
  );
}
