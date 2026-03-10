import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Brain, Zap, FileText, Shield, ArrowRight, CheckCircle2,
  Users, BarChart3, Globe, Mail, Building2, MessageSquare,
  ChevronRight, Layers, Network, Cpu
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
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

  return (
    <div className="min-h-screen bg-[#080B14] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16 bg-[#080B14]/80 backdrop-blur-xl border-b border-white/5">
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
          <a href="#contact" className="text-sm text-white/50 hover:text-white transition-colors">Contact</a>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-lg shadow-violet-500/20 text-xs">
                Open Dashboard <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="sm" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-lg shadow-violet-500/20 text-xs">
                Get Started <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </a>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-6 md:px-12 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/15 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/3 w-[300px] h-[300px] bg-cyan-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            100,000 agents · GCC Multi-Agent Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.02] mb-6">
            The mesh that{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              thinks, routes,
            </span>
            <br />and delivers.
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Type a task. AgenThinkMesh assembles the right specialist agents in real time,
            runs them in parallel, and synthesises a single executive brief — in seconds.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-xl shadow-violet-500/25 px-8">
                  Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 text-white shadow-xl shadow-violet-500/25 px-8">
                  Start for Free <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </a>
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
              { icon: <Cpu className="w-3.5 h-3.5" />, label: "100K Agents" },
              { icon: <Layers className="w-3.5 h-3.5" />, label: "5+ Domains" },
              { icon: <Zap className="w-3.5 h-3.5" />, label: "<2s Routing" },
              { icon: <Shield className="w-3.5 h-3.5" />, label: "99.9% Uptime" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-xs text-white/60">
                {s.icon} {s.label}
              </div>
            ))}
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
            <h2 className="text-4xl font-bold tracking-tight">Specialist agents for every industry</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { color: "from-violet-500 to-purple-600", icon: "💼", domain: "Finance", contexts: ["VC / PE Fund", "Sovereign Wealth", "Fund Manager"] },
              { color: "from-cyan-500 to-blue-600", icon: "⚖️", domain: "Legal", contexts: ["Law Firm", "In-House Counsel"] },
              { color: "from-emerald-500 to-teal-600", icon: "🏥", domain: "Healthcare", contexts: ["Hospital Ops", "Clinical Research"] },
              { color: "from-orange-500 to-amber-600", icon: "🏢", domain: "Enterprise", contexts: ["Strategy", "Operations"] },
              { color: "from-pink-500 to-rose-600", icon: "🌍", domain: "GCC Wealth", contexts: ["Family Office", "Private Banking"] },
            ].map((d) => (
              <div key={d.domain} className="p-5 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-all hover:-translate-y-1 duration-300">
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
                  { icon: <Users className="w-4 h-4 text-emerald-400" />, label: "Team", value: "Based in the GCC" },
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
          <p className="text-xs text-white/30 font-mono">© 2026 AgenThink · Built in the GCC</p>
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
