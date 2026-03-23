// DiscoveryPage.tsx — A2A Discovery API explorer
// Design: Operator Dark — live agent discovery with terminal-style request echo

import { useState, useMemo } from "react";
import { AGENTS, VERTICALS, VERTICAL_COLORS, type MeshAgent, type Vertical } from "@/lib/meshData";

export default function DiscoveryPage() {
  const [vertical, setVertical] = useState<Vertical | "">("");
  const [shariah, setShariah] = useState(false);
  const [clawOnly, setClawOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<MeshAgent | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return AGENTS.filter(a => {
      if (vertical && a.vertical !== vertical) return false;
      if (shariah && !a.shariah) return false;
      if (clawOnly && !a.clawReady) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
          !a.capabilities.some(c => c.includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [vertical, shariah, clawOnly, search]);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (vertical) params.set("vertical", vertical.toLowerCase().replace(" ", "_"));
    if (shariah) params.set("shariah_compliant", "true");
    if (clawOnly) params.set("claw_ready", "true");
    if (search) params.set("capability", search);
    return `GET /mesh/agents/discover${params.toString() ? "?" + params.toString() : ""}`;
  }, [vertical, shariah, clawOnly, search]);

  const handleConnect = (agent: MeshAgent) => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(agent.id);
    }, 1200);
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>A2A Discovery API</h2>
        <p className="text-xs text-muted-foreground">Query all 124 Mesh agents by vertical, capability, and Shariah compliance. Connect via POST /mesh/agents/connect.</p>
      </div>

      {/* Live request echo */}
      <div className="code-block mb-4 text-xs">
        <div className="text-muted-foreground mb-1"># Live request</div>
        <div className="terminal-line">{requestUrl}</div>
        <div className="text-muted-foreground mt-1"># {filtered.length} agents matched</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={vertical}
          onChange={e => setVertical(e.target.value as Vertical | "")}
          className="bg-card border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">All verticals</option>
          {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search capability..."
          className="bg-card border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-48"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={shariah} onChange={e => setShariah(e.target.checked)} className="accent-primary" />
          Shariah compliant only
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={clawOnly} onChange={e => setClawOnly(e.target.checked)} className="accent-primary" />
          OpenClaw-ready only
        </label>
        <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} / 124 agents</span>
      </div>

      <div className="flex gap-4">
        {/* Agent list */}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 gap-2">
            {filtered.slice(0, 30).map(agent => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`agent-card flex items-start gap-3 ${selectedAgent?.id === agent.id ? 'border-primary/60 bg-primary/5' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{agent.name}</span>
                    {agent.verified && <span className="badge-verified">✓ verified</span>}
                    {agent.clawReady && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">◈ claw</span>}
                    {agent.shariah && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-teal-500/10 text-teal-400 border border-teal-500/20">☽ shariah</span>}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${VERTICAL_COLORS[agent.vertical]}`}>{agent.vertical}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 truncate">{agent.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{agent.tasks} tasks</span>
                    <span className="text-green-400">{(agent.successRate * 100).toFixed(0)}% success</span>
                    <span>{agent.latencyMs}ms</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleConnect(agent); setSelectedAgent(agent); }}
                  className={`shrink-0 px-3 py-1 rounded text-xs border transition-colors ${connected === agent.id ? 'border-green-500/50 text-green-400 bg-green-500/10' : 'border-primary/30 text-primary hover:bg-primary/10'}`}
                >
                  {connected === agent.id ? '✓ connected' : connecting && selectedAgent?.id === agent.id ? '···' : 'connect →'}
                </button>
              </div>
            ))}
            {filtered.length > 30 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                + {filtered.length - 30} more agents — refine filters to narrow results
              </div>
            )}
          </div>
        </div>

        {/* Agent detail drawer */}
        {selectedAgent && (
          <div className="w-72 shrink-0 animate-slide-in-right">
            <div className="bg-card border border-border rounded p-4 sticky top-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-foreground mb-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>{selectedAgent.name}</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${VERTICAL_COLORS[selectedAgent.vertical]}`}>{selectedAgent.vertical}</span>
                </div>
                <button onClick={() => setSelectedAgent(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{selectedAgent.description}</p>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Manifest</div>
              <div className="code-block text-xs overflow-auto max-h-48">
                <pre>{JSON.stringify({
                  id: selectedAgent.id,
                  name: selectedAgent.name,
                  vertical: selectedAgent.vertical,
                  capabilities: selectedAgent.capabilities,
                  endpoint: `https://agenthink-7enctkan.manus.space/api/trpc/agent.routeTask`,
                  auth: "X-AgenThink-Key",
                  claw_version: "0.2.0",
                  shariah_compliant: selectedAgent.shariah ?? false,
                  trust_score: selectedAgent.successRate,
                }, null, 2)}</pre>
              </div>
              <div className="mt-3 text-xs text-muted-foreground uppercase tracking-widest mb-2">Connect</div>
              <div className="code-block text-xs">
                <pre>{`POST /mesh/agents/connect\n{\n  "agentId": "${selectedAgent.id}",\n  "clientId": "your-app"\n}`}</pre>
              </div>
              {connected === selectedAgent.id && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
                  <span className="status-dot status-dot-live" />
                  A2A connection established
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
