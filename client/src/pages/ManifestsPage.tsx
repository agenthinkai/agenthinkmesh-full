// ManifestsPage.tsx — ClawAdapter manifest browser
// Design: Operator Dark — manifest JSON viewer, generation status, April drop tracker

import { useState, useMemo } from "react";
import { AGENTS, VERTICALS, VERTICAL_COLORS, type MeshAgent, type Vertical } from "@/lib/meshData";

export default function ManifestsPage() {
  const [selected, setSelected] = useState<MeshAgent | null>(null);
  const [filterVertical, setFilterVertical] = useState<Vertical | "">("");
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "pending">("all");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    return AGENTS.filter(a => {
      if (filterVertical && a.vertical !== filterVertical) return false;
      if (filterStatus === "ready" && !a.clawReady) return false;
      if (filterStatus === "pending" && a.clawReady) return false;
      return true;
    });
  }, [filterVertical, filterStatus]);

  const clawReady = AGENTS.filter(a => a.clawReady).length;
  const pending = AGENTS.length - clawReady;

  const manifest = selected ? {
    "$schema": "https://openclaw.ai/schema/manifest/v0.2.0",
    "id": selected.id,
    "name": selected.name,
    "version": "0.2.0",
    "vertical": selected.vertical,
    "description": selected.description,
    "capabilities": selected.capabilities,
    "endpoint": {
      "url": "https://agenthink-7enctkan.manus.space/api/trpc/agent.routeTask",
      "method": "POST",
      "auth": {
        "type": "header",
        "header": "X-AgenThink-Key"
      },
      "payload": {
        "json": {
          "agentId": selected.id,
          "inputText": "{{task}}",
          "context": selected.vertical
        }
      }
    },
    "metadata": {
      "verified": selected.verified,
      "trust_score": selected.successRate,
      "avg_latency_ms": selected.latencyMs,
      "tasks_completed": selected.tasks,
      "shariah_compliant": selected.shariah ?? false,
      "mesh_url": "https://agenthink-7enctkan.manus.space",
      "generated_at": "2026-03-23T00:00:00Z",
      "generated_by": "ClawAdapter v0.2.0"
    }
  } : null;

  const handleCopy = () => {
    if (manifest) {
      navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>ClawAdapter Manifests</h2>
        <p className="text-xs text-muted-foreground">Portable, signed JSON manifests for every Mesh agent. Any external system can read these to discover and call agents without the Mesh UI.</p>
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border rounded p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">OpenClaw manifest coverage</span>
          <span className="text-xs text-foreground">{clawReady} / 124 agents</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(clawReady / 124) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-green-400">◈ {clawReady} manifests live</span>
            <span className="text-amber-400">⏳ {pending} pending April 2026 OSS drop</span>
          </div>
          <span className="text-muted-foreground">{((clawReady / 124) * 100).toFixed(0)}% complete</span>
        </div>
      </div>

      {/* How it works */}
      <div className="code-block text-xs mb-6">
        <div className="text-muted-foreground mb-1"># Auto-generation — runs on every agent registration</div>
        <pre className="text-foreground">{`from openclaw.adapters.claw_adapter import ClawAdapter
from openclaw.registration.agent_registration import register_agent

# One line in your registration pipeline:
result = register_agent(agent_metadata)
# → ClawAdapter.from_metadata(agent).save_manifest() called automatically
# → manifest saved to openclaw/adapters/<agent-id>.json`}</pre>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterVertical}
          onChange={e => setFilterVertical(e.target.value as Vertical | "")}
          className="bg-card border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">All verticals</option>
          {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <div className="flex gap-1">
          {(["all", "ready", "pending"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${filterStatus === s ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {s === "all" ? "All" : s === "ready" ? "◈ Claw-ready" : "⏳ Pending"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} agents</span>
      </div>

      <div className="flex gap-4">
        {/* Agent list */}
        <div className="flex-1 min-w-0">
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map(agent => (
              <div
                key={agent.id}
                onClick={() => setSelected(agent)}
                className={`agent-card flex items-center gap-3 py-2.5 ${selected?.id === agent.id ? 'border-primary/60 bg-primary/5' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{agent.name}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${VERTICAL_COLORS[agent.vertical]}`}>{agent.vertical}</span>
                    {agent.clawReady
                      ? <span className="text-xs text-blue-400">◈ manifest ready</span>
                      : <span className="text-xs text-muted-foreground">⏳ April drop</span>
                    }
                    {agent.shariah && <span className="text-xs text-teal-400">☽</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{agent.id}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{(agent.successRate * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Manifest JSON viewer */}
        {selected && (
          <div className="w-80 shrink-0 animate-slide-in-right">
            <div className="bg-card border border-border rounded p-4 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{selected.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{selected.id}.json</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  >
                    {copied ? "✓ copied" : "⎘ copy"}
                  </button>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
              </div>
              {selected.clawReady ? (
                <div className="code-block text-xs overflow-auto max-h-[500px]">
                  <pre className="text-foreground whitespace-pre text-xs">{JSON.stringify(manifest, null, 2)}</pre>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">⏳</div>
                  <div className="text-xs text-muted-foreground">Manifest pending</div>
                  <div className="text-xs text-amber-400 mt-1">Available in April 2026 OSS drop</div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    This agent is live on the Mesh but its OpenClaw manifest has not yet been generated. Run:
                  </div>
                  <div className="code-block text-xs mt-2 text-left">
                    <pre>{`ClawAdapter.from_metadata(\n  agent_metadata\n).save_manifest()`}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
