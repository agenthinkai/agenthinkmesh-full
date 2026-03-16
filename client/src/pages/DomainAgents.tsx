import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Sparkles, CheckCircle2, Clock, Zap, Plus, Network,
  Star, Cpu, Search, ChevronRight
} from "lucide-react";
import Logo from "@/components/Logo";

const DOMAIN_META: Record<string, { icon: string; color: string; gradient: string; description: string; contexts: string[] }> = {
  "Finance": {
    icon: "💹",
    color: "#7BA3D4",
    gradient: "from-blue-600/20 to-violet-600/20",
    description: "Specialist agents for VC/PE funds, sovereign wealth, and fund managers.",
    contexts: ["VC / PE Fund", "Sovereign Wealth", "Fund Manager"],
  },
  "Legal": {
    icon: "⚖️",
    color: "#8BBFD4",
    gradient: "from-cyan-600/20 to-blue-600/20",
    description: "Contract review, risk flagging, and legal drafting agents for law firms and in-house counsel.",
    contexts: ["Law Firm", "In-House Counsel"],
  },
  "Healthcare": {
    icon: "🏥",
    color: "#7DC4A8",
    gradient: "from-emerald-600/20 to-teal-600/20",
    description: "Operational and clinical agents for hospital management and research teams.",
    contexts: ["Hospital Ops", "Clinical Research"],
  },
  "Enterprise": {
    icon: "🏢",
    color: "#A89BD4",
    gradient: "from-violet-600/20 to-purple-600/20",
    description: "HR, procurement, and operations agents for enterprise teams.",
    contexts: ["HR & People Ops", "Procurement", "Operations"],
  },
  "GCC Wealth": {
    icon: "🏦",
    color: "#C9A84C",
    gradient: "from-amber-600/20 to-yellow-600/20",
    description: "Private wealth, investment banking, and family office agents for GCC institutions.",
    contexts: ["Private Wealth", "Investment Banking", "Family Office", "Fund Distribution"],
  },
};

type AgentRow = {
  id: number;
  agentName: string;
  developerName: string;
  description: string;
  capabilities: string;
  averageLatency: number;
  connectionTested: boolean;
  domain: string | null;
  isBuiltIn: boolean | null;
  isCustom: boolean | null;
  tasksCompleted: number | null;
  successRate: string | null;
  avgLatency: number | null;
};

function AgentCard({ agent, domainColor }: { agent: AgentRow; domainColor: string }) {
  const caps: string[] = (() => {
    try { return JSON.parse(agent.capabilities); } catch { return []; }
  })();

  return (
    <div
      className="group relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: agent.isBuiltIn ? `${domainColor}33` : `${domainColor}55`,
      }}
    >
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        {agent.isBuiltIn && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: domainColor, borderColor: `${domainColor}40`, background: `${domainColor}12` }}>
            Built-in
          </span>
        )}
        {agent.isCustom && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300">
            ✦ Custom
          </span>
        )}
        {agent.connectionTested && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Verified
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="font-semibold text-sm text-white mb-1.5">{agent.agentName}</h3>
      <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-2">{agent.description}</p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {caps.slice(0, 3).map((cap) => (
          <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-mono">
            {cap}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[10px] text-white/35 font-mono">
        {agent.tasksCompleted != null && (
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {agent.tasksCompleted} tasks</span>
        )}
        {agent.avgLatency != null && (
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {agent.avgLatency}ms</span>
        )}
        {agent.successRate && (
          <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {agent.successRate}%</span>
        )}
      </div>
    </div>
  );
}

export default function DomainAgents() {
  const params = useParams<{ name: string }>();
  const domainName = decodeURIComponent(params.name ?? "");
  const meta = DOMAIN_META[domainName];
  const { isAuthenticated } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);

  const agentsQuery = trpc.agent.listByDomain.useQuery({ domain: domainName }, {
    enabled: !!domainName,
    staleTime: 30_000,
  });

  const utils = trpc.useUtils();
  const createCustom = trpc.agent.createCustom.useMutation({
    onSuccess: (newAgent) => {
      toast.success(`Agent "${newAgent.agentName}" created and deployed!`, {
        description: `Your custom agent is now live in the ${domainName} domain.`,
      });
      setCustomPrompt("");
      setShowCustomForm(false);
      utils.agent.listByDomain.invalidate({ domain: domainName });
    },
    onError: (err) => {
      toast.error("Failed to create agent", { description: err.message });
    },
  });

  const handleCreateCustom = () => {
    if (!customPrompt.trim()) return;
    createCustom.mutate({ domain: domainName, userPrompt: customPrompt.trim() });
  };

  const allAgents: AgentRow[] = (agentsQuery.data ?? []) as AgentRow[];
  const filteredAgents = allAgents.filter((a) =>
    !searchQuery || a.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const builtInAgents = filteredAgents.filter((a) => a.isBuiltIn);
  const customAgents = filteredAgents.filter((a) => a.isCustom);

  const domainColor = meta?.color ?? "#7BA3D4";

  if (!meta) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">Domain not found</p>
          <Link href="/">
            <Button variant="outline" size="sm" className="border-white/20 text-white/60">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1629] text-white">
      {/* ── Sticky Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 h-14 bg-[#0B1629]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm font-medium" style={{ color: domainColor }}>{domainName}</span>
        </div>
        <a href="/" style={{ textDecoration: "none" }}>
          <Logo size={30} />
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 md:px-12 pt-12 pb-10 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: `${domainColor}18`, border: `1px solid ${domainColor}33` }}
            >
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{domainName}</h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ color: domainColor, background: `${domainColor}18`, border: `1px solid ${domainColor}30` }}>
                  {allAgents.length} agents
                </span>
              </div>
              <p className="text-sm text-white/50 mb-3">{meta.description}</p>
              <div className="flex flex-wrap gap-2">
                {meta.contexts.map((ctx) => (
                  <span key={ctx} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-white/40 font-mono">
                    {ctx}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/persona-setup">
              <Button
                className="text-sm font-semibold shadow-lg"
                style={{ background: `linear-gradient(135deg, ${domainColor}CC, ${domainColor}88)`, border: "none", color: "#fff" }}
              >
                <Zap className="w-4 h-4 mr-2" /> Try the Mesh
              </Button>
            </Link>
            <Button
              variant="outline"
              className="text-sm border-white/15 text-white/60 hover:text-white hover:border-white/30 bg-transparent"
              onClick={() => setShowCustomForm(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Request Custom Agent
            </Button>
          </div>
        </div>
      </section>

      {/* ── Search ── */}
      <section className="px-6 md:px-12 py-6 border-b border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-white/30 text-sm"
            />
          </div>
        </div>
      </section>

      {/* ── Custom Agent Form ── */}
      {showCustomForm && (
        <section className="px-6 md:px-12 py-6 border-b border-violet-500/20 bg-violet-500/5">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Create a Custom Agent</h3>
                <p className="text-xs text-white/40 mb-3">
                  Describe the agent you need. Our AI will design and deploy it under the {domainName} domain.
                </p>
                {!isAuthenticated ? (
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-white/40">Sign in to create custom agents.</p>
                    <a href={getLoginUrl()}>
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white text-xs border-0">
                        Sign In <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Input
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder={`e.g. "An agent that monitors ${domainName.toLowerCase()} compliance and sends weekly alerts"`}
                      className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-violet-500/50 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleCreateCustom()}
                      disabled={createCustom.isPending}
                    />
                    <Button
                      onClick={handleCreateCustom}
                      disabled={createCustom.isPending || !customPrompt.trim()}
                      className="bg-violet-600 hover:bg-violet-500 text-white border-0 text-sm"
                    >
                      {createCustom.isPending ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2"><Cpu className="w-4 h-4" /> Deploy</span>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomForm(false)}
                      className="text-white/40 hover:text-white"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Specialist Agents (domain-specific) ── */}
      {(domainName === "Finance" || domainName === "GCC Wealth") && (
        <section className="px-6 md:px-12 pt-8 pb-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold font-mono uppercase tracking-widest" style={{ color: domainColor }}>Specialist Agents</h2>
              <span className="text-xs text-white/30 font-mono">(1)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
              <Link href="/agents/game-theory">
                <div
                  className="group relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  style={{ background: "rgba(123,163,212,0.06)", borderColor: `${domainColor}55` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: domainColor, borderColor: `${domainColor}40`, background: `${domainColor}12` }}>
                      Built-in
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                      Game Theory
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-1.5">Game Theory Investment Decision Agent</h3>
                  <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-2">
                    Returns a clear BUY / SELL / HOLD verdict by modelling what rational institutional actors are likely to do — and whether that changes your optimal move.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {["game_theory", "nash_equilibrium", "gcc_markets"].map((cap) => (
                      <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-mono">{cap}</span>
                    ))}
                  </div>
                  <div
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: `linear-gradient(135deg, ${domainColor}CC, ${domainColor}66)`, color: "#fff" }}
                  >
                    <Zap className="w-3.5 h-3.5" /> Launch Agent
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {domainName === "Legal" && (
        <section className="px-6 md:px-12 pt-8 pb-0">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold font-mono uppercase tracking-widest" style={{ color: domainColor }}>Specialist Agents</h2>
              <span className="text-xs text-white/30 font-mono">(1)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
              <Link href="/agents/force-majeure">
                <div
                  className="group relative p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  style={{ background: "rgba(139,191,212,0.06)", borderColor: `${domainColor}55` }}
                >
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ color: domainColor, borderColor: `${domainColor}40`, background: `${domainColor}12` }}>
                      Built-in
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                      GCC Conflict
                    </span>
                  </div>
                  {/* Name */}
                  <h3 className="font-semibold text-sm text-white mb-1.5">Force Majeure Contract Agent</h3>
                  <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-2">
                    Extracts FM clauses from PDF/DOCX contracts (Arabic &amp; English), assesses GCC conflict triggers, drafts a notification letter, and produces a board-ready risk summary.
                  </p>
                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {["clause_extraction", "gcc_conflict", "arabic_rtl"].map((cap) => (
                      <span key={cap} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-mono">{cap}</span>
                    ))}
                  </div>
                  {/* Launch button */}
                  <div
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: `linear-gradient(135deg, ${domainColor}CC, ${domainColor}66)`, color: "#fff" }}
                  >
                    <Zap className="w-3.5 h-3.5" /> Launch Agent
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Agent Grid ── */}
      <section className="px-6 md:px-12 py-10">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Loading */}
          {agentsQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
              ))}
            </div>
          )}

          {/* Built-in agents */}
          {!agentsQuery.isLoading && builtInAgents.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-white/70 font-mono uppercase tracking-widest">Platform Agents</h2>
                <span className="text-xs text-white/30 font-mono">({builtInAgents.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {builtInAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} domainColor={domainColor} />
                ))}
              </div>
            </div>
          )}

          {/* Custom agents */}
          {!agentsQuery.isLoading && customAgents.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-semibold text-violet-400/80 font-mono uppercase tracking-widest">Custom Agents</h2>
                <span className="text-xs text-white/30 font-mono">({customAgents.length})</span>
                <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/10 ml-1">AI-Generated</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} domainColor={domainColor} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!agentsQuery.isLoading && filteredAgents.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-3xl">
                {meta.icon}
              </div>
              <p className="text-white/40 text-sm mb-2">
                {searchQuery ? `No agents match "${searchQuery}"` : "No agents found for this domain"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-violet-400 hover:text-violet-300 mt-2"
                onClick={() => { setSearchQuery(""); setShowCustomForm(true); }}
              >
                <Plus className="w-4 h-4 mr-1" /> Create the first agent
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 md:px-12 py-12 border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-bold text-lg mb-1">Ready to run these agents?</h3>
            <p className="text-sm text-white/40">Set up your profile and start executing tasks in under 30 seconds.</p>
          </div>
          <Link href="/persona-setup">
            <Button
              size="lg"
              className="text-sm font-semibold shadow-lg"
              style={{ background: `linear-gradient(135deg, ${domainColor}CC, ${domainColor}88)`, border: "none", color: "#fff" }}
            >
              <Zap className="w-4 h-4 mr-2" /> Enter the Mesh <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
