import { useState } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import GateScreen from "@/components/GateScreen";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const WORKFLOW_CARDS = [
  {
    id: "ic_decision" as const,
    title: "IC Decision Engine",
    subtitle: "8-Agent Sequential Pipeline",
    description: "Full institutional analysis: Intake → Strategy → Risk → Exposure → Liquidity → Performance → Benchmark → Fees → IC Decision",
    badge: "INVEST / WATCH / REJECT",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    icon: "⚖️",
    sla: "~5 min",
    agents: 8,
    accent: "from-emerald-900/40 to-slate-900",
    border: "border-emerald-500/20 hover:border-emerald-400/40",
  },
  {
    id: "guardian" as const,
    title: "Guardian Mode",
    subtitle: "Always-On Monitoring",
    description: "Continuous portfolio surveillance: threshold breach detection, concentration alerts, liquidity stress, mandate drift — triggers auto-workflows.",
    badge: "LIVE MONITORING",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    icon: "🛡️",
    sla: "~2 min",
    agents: 3,
    accent: "from-cyan-900/40 to-slate-900",
    border: "border-cyan-500/20 hover:border-cyan-400/40",
  },
  {
    id: "crisis" as const,
    title: "Crisis Simulation",
    subtitle: "Stress Test Mode",
    description: "Simulate 2008, COVID-19, or custom macro shock scenarios. See worst-case drawdown, survival analysis, and defensive action plan.",
    badge: "STRESS TEST",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    icon: "⚡",
    sla: "~3 min",
    agents: 4,
    accent: "from-amber-900/40 to-slate-900",
    border: "border-amber-500/20 hover:border-amber-400/40",
  },
];

const PLACEHOLDER_TEXTS: Record<string, string> = {
  ic_decision: `Fund: Gulf Horizon Capital Partners III
Strategy: GCC-focused private equity, buyout stage
AUM: KWD 85M
Geography: Kuwait 60%, Saudi Arabia 25%, UAE 15%
Sectors: Financial services, real estate, consumer
Management fee: 2% / Carry: 20%
Vintage: 2021
Key holdings: NBK stake, Al-Ahli Bank position, retail mall portfolio`,
  guardian: `Portfolio: Al-Noor Diversified Fund
Current allocation: Equities 45%, Fixed Income 30%, Real Estate 15%, Cash 10%
Equity concentration: KFH 28% (above 25% threshold)
Recent performance: -8.2% vs benchmark -3.1% (90 days)
Liquidity: 60-day redemption notice, 15% in illiquid assets
Oil beta: 0.72 (elevated vs mandate max 0.5)`,
  crisis: `Fund: Mena Growth Fund II
Strategy: Long-only GCC equities
AUM: USD 220M
Key exposures: Energy 35%, Financials 28%, Real Estate 22%
Leverage: None
Liquidity: Daily redemption, 95% in listed equities
Benchmark: S&P GCC Composite
Current drawdown: -12% YTD`,
};

export default function PortfolioIntel() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<"ic_decision" | "guardian" | "crisis" | null>(null);
  const [inputText, setInputText] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const startRunMutation = trpc.portfolioIntel.startRun.useMutation({
    onSuccess: (data) => {
      setLocation(`/portfolio/intel/run/${data.runType}/${data.runId}`);
    },
    onError: (err) => {
      alert(err.message);
      setIsStarting(false);
    },
  });

  const { data: chains } = trpc.portfolioIntel.getWorkflowChains.useQuery();

  if (loading) return null;
  if (!user) return <GateScreen />;

  const handleSelectWorkflow = (id: "ic_decision" | "guardian" | "crisis") => {
    setSelected(id);
    setInputText(PLACEHOLDER_TEXTS[id] || "");
  };

  const handleStart = () => {
    if (!selected || !inputText.trim()) return;
    setIsStarting(true);
    startRunMutation.mutate({ runType: selected, inputText: inputText.trim() });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteNav />

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📊</span>
            <Badge className="bg-gold-500/20 text-yellow-400 border-yellow-500/30 text-xs">
              PORTFOLIO INTELLIGENCE ENGINE
            </Badge>
            <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
              12 AGENTS · 3 WORKFLOWS
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Portfolio Intelligence Engine
          </h1>
          <p className="text-slate-400 max-w-2xl">
            From fund document to IC-ready decision in minutes. Three institutional-grade workflows powered by 12 specialist agents.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Workflow Selection */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-5">
            Select Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {WORKFLOW_CARDS.map((wf) => {
              const chain = chains?.[wf.id];
              return (
                <button
                  key={wf.id}
                  onClick={() => handleSelectWorkflow(wf.id)}
                  className={`text-left rounded-xl border p-6 bg-gradient-to-br ${wf.accent} ${wf.border} transition-all duration-200 ${
                    selected === wf.id ? "ring-2 ring-offset-2 ring-offset-slate-950 ring-white/30 scale-[1.02]" : "hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-3xl">{wf.icon}</span>
                    <Badge className={`text-xs ${wf.badgeColor}`}>{wf.badge}</Badge>
                  </div>
                  <h3 className="font-bold text-white text-lg mb-1">{wf.title}</h3>
                  <p className="text-xs text-slate-400 mb-3">{wf.subtitle}</p>
                  <p className="text-sm text-slate-300 mb-4 leading-relaxed">{wf.description}</p>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>⏱ {wf.sla}</span>
                    <span>🤖 {chain?.agents?.length ?? wf.agents} agents</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Panel */}
        {selected && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-white">
                  {WORKFLOW_CARDS.find(w => w.id === selected)?.title} — Input
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  Paste your fund description, portfolio summary, or any relevant data below.
                </p>
              </div>
              <Badge className="bg-slate-800 text-slate-300 border-slate-600 text-xs">
                {selected.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste fund data, portfolio description, or any relevant context..."
              className="min-h-[200px] bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 font-mono text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">
                {inputText.length} characters · Minimum 10 required
              </p>
              <Button
                onClick={handleStart}
                disabled={inputText.trim().length < 10 || isStarting}
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-8"
              >
                {isStarting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
                    Launching...
                  </span>
                ) : (
                  `Launch ${WORKFLOW_CARDS.find(w => w.id === selected)?.title} →`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Agent Registry Preview */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-5">
            Agent Registry — 12 Specialist Agents
          </h2>
          <AgentRegistryGrid />
        </div>

        {/* Recent Runs */}
        <div className="mt-12">
          <RecentRunsList onNavigate={(runType, runId) => setLocation(`/portfolio/intel/run/${runType}/${runId}`)} />
        </div>
      </div>
    </div>
  );
}

function AgentRegistryGrid() {
  const { data: agents } = trpc.portfolioIntel.listAgents.useQuery();

  if (!agents) return null;

  const clusters = [
    { key: "intake", label: "Intake Cluster", color: "text-blue-400" },
    { key: "risk", label: "Risk & Stress Cluster", color: "text-red-400" },
    { key: "performance", label: "Performance Cluster", color: "text-purple-400" },
    { key: "decision", label: "Decision Cluster", color: "text-emerald-400" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {clusters.map((cluster) => {
        const clusterAgents = agents.filter(a => a.cluster === cluster.key);
        return (
          <Card key={cluster.key} className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className={`text-sm font-semibold ${cluster.color}`}>
                {cluster.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {clusterAgents.map((agent) => (
                <div key={agent.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/50">
                  <span className="text-lg mt-0.5">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                      <Badge variant="outline" className="text-xs text-slate-500 border-slate-600 shrink-0">
                        {agent.id}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{agent.function}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecentRunsList({ onNavigate }: { onNavigate: (runType: string, runId: number) => void }) {
  const { data: runs } = trpc.portfolioIntel.listRuns.useQuery();

  if (!runs?.length) return null;

  const getDecisionColor = (decision: string | null) => {
    if (decision === "INVEST") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (decision === "WATCH") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (decision === "REJECT") return "bg-red-500/20 text-red-300 border-red-500/30";
    return "bg-slate-700 text-slate-300 border-slate-600";
  };

  const getStatusColor = (status: string) => {
    if (status === "complete") return "text-emerald-400";
    if (status === "running") return "text-cyan-400 animate-pulse";
    if (status === "failed") return "text-red-400";
    return "text-slate-400";
  };

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-5">
        Recent Runs
      </h2>
      <div className="space-y-2">
        {runs.slice(0, 10).map((run) => (
          <button
            key={run.id}
            onClick={() => onNavigate(run.run_type, run.id)}
            className="w-full text-left flex items-center gap-4 p-4 bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-500 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {run.run_type.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span className={`text-xs ${getStatusColor(run.status)}`}>
                  {run.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(run.created_at).toLocaleString()}
                {run.duration_ms ? ` · ${Math.round(run.duration_ms / 1000)}s` : ""}
              </p>
            </div>
            {run.ic_decision && (
              <Badge className={`text-xs ${getDecisionColor(run.ic_decision)}`}>
                {run.ic_decision}
              </Badge>
            )}
            {run.confidence_score && (
              <span className="text-xs text-slate-400">{run.confidence_score}% conf.</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
