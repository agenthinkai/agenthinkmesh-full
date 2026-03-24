// BridgePage.tsx — OpenClaw Bridge status, configuration, and Google A2A integration
// Design: Operator Dark — live bridge health, channel config, Google agent panel, test panel

import { useState } from "react";
import { BRIDGE_STATUS } from "@/lib/meshData";
import { trpc } from "@/lib/trpc";

const CHANNELS = [
  { id: "whatsapp", name: "WhatsApp Business", icon: "📱", status: "configurable" as const, description: "Connect via Twilio or Meta Cloud API" },
  { id: "slack", name: "Slack", icon: "💬", status: "configurable" as const, description: "Deploy as a Slack app with slash commands" },
  { id: "teams", name: "Microsoft Teams", icon: "🟦", status: "configurable" as const, description: "Deploy as a Teams bot via Azure Bot Service" },
  { id: "telegram", name: "Telegram", icon: "✈️", status: "configurable" as const, description: "Connect via BotFather token" },
  { id: "http", name: "HTTP / REST", icon: "⚡", status: "live" as const, description: "Direct POST to /route — no channel setup needed" },
];

const ROUTING_EXAMPLES = [
  { input: "Screen 3 deals against our VC thesis", domain: "Finance", agent: "deal-screener", latency: "2.1s" },
  { input: "Review this vendor contract for liability", domain: "Legal", agent: "legal-reviewer", latency: "1.8s" },
  { input: "Profile new Saudi HNWI client, Shariah check", domain: "GCC Wealth", agent: "client-profiler + suitability-checker", latency: "3.4s" },
  { input: "Analyse this week's bed occupancy data", domain: "Healthcare", agent: "staffing-optimizer", latency: "2.7s" },
];

type GoogleAgentType = "gemini" | "google_search" | "google_workspace" | "vertex_ai" | "google_maps" | "notebooklm";

const GOOGLE_AGENT_PRESETS: Record<GoogleAgentType, string> = {
  gemini: "Analyze the GCC insurance market outlook for 2025 and identify the top 3 growth opportunities for Takaful providers in Kuwait and Saudi Arabia.",
  google_search: "Find the latest news about SAMA insurance regulations and GCC fintech funding rounds in the past week.",
  google_workspace: "Create a Google Doc summarizing the AgenThinkMesh IC Decision Engine output and share it with the investment committee.",
  vertex_ai: "Run a SAMA-compliant risk assessment on this portfolio allocation and flag any concentration limit breaches.",
  google_maps: "Identify all electronics retail locations in Kuwait City within 5km of Avenues Mall and map competitor density.",
  notebooklm: "Analyze this 150-page insurance policy wording and extract all gharar-related clauses, exclusions, and AAOIFI compliance gaps.",
};

export default function BridgePage() {
  const [task, setTask] = useState("");
  const [context, setContext] = useState("Finance");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Google A2A state
  const [activeTab, setActiveTab] = useState<"bridge" | "google_a2a">("bridge");
  const [selectedAgent, setSelectedAgent] = useState<GoogleAgentType>("gemini");
  const [googleInstruction, setGoogleInstruction] = useState(GOOGLE_PRESETS["gemini"] ?? "");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleResult, setGoogleResult] = useState<{
    success: boolean;
    output: string;
    latencyMs: number;
    error?: string;
    structuredData?: string;
  } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs: number; preview: string } | null>>({});

  const { data: googleAgents, isLoading: loadingAgents } = trpc.openclaw.listGoogleAgents.useQuery({});
  const invokeMutation = trpc.openclaw.invokeGoogleAgent.useMutation();
  const testMutation = trpc.openclaw.testGoogleAgent.useMutation();

  const handleSelectAgent = (agentType: GoogleAgentType) => {
    setSelectedAgent(agentType);
    setGoogleInstruction(GOOGLE_AGENT_PRESETS[agentType] ?? "");
    setGoogleResult(null);
  };

  const handleInvoke = async () => {
    if (!googleInstruction.trim()) return;
    setGoogleResult(null);
    try {
      const res = await invokeMutation.mutateAsync({
        agentType: selectedAgent,
        instruction: googleInstruction,
        apiKey: googleApiKey || undefined,
      });
      setGoogleResult({
        success: res.success,
        output: res.output,
        latencyMs: res.latencyMs,
        error: res.error,
        structuredData: res.structuredData ? JSON.stringify(res.structuredData, null, 2) : undefined,
      });
    } catch (err) {
      setGoogleResult({
        success: false,
        output: "",
        latencyMs: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleTestAgent = async (agentType: GoogleAgentType) => {
    setTestResults(prev => ({ ...prev, [agentType]: null }));
    try {
      const res = await testMutation.mutateAsync({ agentType });
      setTestResults(prev => ({ ...prev, [agentType]: res }));
    } catch {
      setTestResults(prev => ({ ...prev, [agentType]: { ok: false, latencyMs: 0, preview: "Test failed" } }));
    }
  };

  const handleRun = () => {
    if (!task.trim()) return;
    setRunning(true);
    setResult(null);
    const lines: string[] = [];
    const steps = [
      `> POST /route  {"task": "${task.slice(0, 40)}...", "context": "${context}"}`,
      `> Bridge: routing to AgenThink Mesh...`,
      `> Mesh: scoring 124 agents against context "${context}"`,
      `> Mesh: top match → ${context === 'Finance' ? 'deal-screener' : context === 'Legal' ? 'legal-reviewer' : context === 'Healthcare' ? 'staffing-optimizer' : 'client-profiler'} (score: 0.94)`,
      `> Agent: executing task...`,
      `> Bridge: result received in 2.3s`,
    ];
    steps.forEach((step, i) => {
      setTimeout(() => {
        setLog(prev => [...prev, step]);
        if (i === steps.length - 1) {
          setRunning(false);
          setResult(`Task completed successfully. The ${context} specialist agent processed your request and returned a structured result. In a live deployment, this would contain the full agent output — deal screening report, contract review, client profile, or clinical analysis depending on the domain.`);
        }
      }, i * 400);
    });
  };

  const agentColorMap: Record<GoogleAgentType, string> = {
    gemini: "#4285F4",
    google_search: "#34A853",
    google_workspace: "#0F9D58",
    vertex_ai: "#DB4437",
    google_maps: "#FBBC04",
    notebooklm: "#9C27B0",
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>OpenClaw Bridge</h2>
        <p className="text-xs text-muted-foreground">The channel layer — connects OpenClaw's messaging connectors to AgenThink Mesh. Includes live Google A2A agent integration.</p>
      </div>

      {/* System health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {BRIDGE_STATUS.map(s => (
          <div key={s.service} className="bg-card border border-border rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`status-dot ${s.status === 'live' ? 'status-dot-live' : 'status-dot-warn'}`} />
              <span className="text-xs text-muted-foreground">{s.service}</span>
            </div>
            <div className="text-lg font-bold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{s.latencyMs}ms</div>
            <div className="text-xs text-green-400">{s.status}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("bridge")}
          className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${activeTab === "bridge" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Bridge & Channels
        </button>
        <button
          onClick={() => setActiveTab("google_a2a")}
          className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${activeTab === "google_a2a" ? "bg-[#4285F4] text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          <span>✦</span> Google A2A Agents
          <span className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded-full">6 Live</span>
        </button>
      </div>

      {/* ── Google A2A Panel ── */}
      {activeTab === "google_a2a" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="border border-[#4285F4]/30 bg-[#4285F4]/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✦</span>
              <div>
                <div className="text-sm font-bold text-foreground">Google A2A Protocol Integration</div>
                <div className="text-xs text-muted-foreground">AgenThinkMesh connects to Google agents via the A2A (Agent-to-Agent) open protocol. Demo mode active — no API key required. Add your Google API key for live calls.</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> Protocol: Google A2A v1</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> Mode: Demo (fallback to live)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span> Agents: 6 registered</span>
            </div>
          </div>

          {/* Agent grid */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Select Google Agent</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {loadingAgents ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3 animate-pulse h-24" />
                ))
              ) : (
                googleAgents?.map(agent => (
                  <button
                    key={agent.agentId}
                    onClick={() => handleSelectAgent(agent.agentType as GoogleAgentType)}
                    className={`bg-card border rounded-lg p-3 text-left transition-all hover:scale-[1.02] ${selectedAgent === agent.agentType ? "border-2" : "border-border hover:border-muted-foreground"}`}
                    style={selectedAgent === agent.agentType ? { borderColor: agent.color } : {}}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl">{agent.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">{agent.name}</div>
                        <div className="text-[10px] text-muted-foreground">{agent.latencySla}</div>
                      </div>
                      {testResults[agent.agentType] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${testResults[agent.agentType]?.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {testResults[agent.agentType]?.ok ? `${testResults[agent.agentType]?.latencyMs}ms` : "fail"}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{agent.description.slice(0, 80)}...</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected agent detail + invoke panel */}
          {selectedAgent && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ borderLeftWidth: 3, borderLeftColor: agentColorMap[selectedAgent] }}>
                <span className="text-lg">{googleAgents?.find(a => a.agentType === selectedAgent)?.icon}</span>
                <div>
                  <div className="text-sm font-bold text-foreground">{googleAgents?.find(a => a.agentType === selectedAgent)?.name}</div>
                  <div className="text-xs text-muted-foreground">{googleAgents?.find(a => a.agentType === selectedAgent)?.gccRelevance.slice(0, 2).join(" · ")}</div>
                </div>
                <button
                  onClick={() => handleTestAgent(selectedAgent)}
                  disabled={testMutation.isPending}
                  className="ml-auto text-xs px-3 py-1.5 border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {testMutation.isPending ? "Testing..." : "Test Connection"}
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Instruction input */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Task Instruction</div>
                  <textarea
                    value={googleInstruction}
                    onChange={e => setGoogleInstruction(e.target.value)}
                    rows={3}
                    className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                    placeholder="Enter your instruction for the Google agent..."
                  />
                </div>

                {/* Optional API key */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Google API Key <span className="text-[10px] text-green-400">(optional — demo mode if empty)</span></div>
                  <input
                    type="password"
                    value={googleApiKey}
                    onChange={e => setGoogleApiKey(e.target.value)}
                    placeholder="AIza... (leave empty for demo mode)"
                    className="w-full bg-card border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  onClick={handleInvoke}
                  disabled={invokeMutation.isPending || !googleInstruction.trim()}
                  className="w-full py-2 rounded text-xs font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: agentColorMap[selectedAgent] }}
                >
                  {invokeMutation.isPending ? "Invoking via A2A Protocol..." : `▶ Invoke ${googleAgents?.find(a => a.agentType === selectedAgent)?.name}`}
                </button>

                {/* Result */}
                {googleResult && (
                  <div className={`rounded-lg border p-4 ${googleResult.success ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-xs font-semibold ${googleResult.success ? "text-green-400" : "text-red-400"}`}>
                        {googleResult.success ? "✓ Response received" : "✗ Error"}
                      </span>
                      <span className="text-xs text-muted-foreground">{googleResult.latencyMs}ms</span>
                      {googleResult.error && (
                        <span className="text-xs text-yellow-400 ml-auto">{googleResult.error}</span>
                      )}
                    </div>
                    {googleResult.output && (
                      <div className="code-block text-xs max-h-64 overflow-y-auto">
                        <pre className="text-foreground whitespace-pre-wrap">{googleResult.output}</pre>
                      </div>
                    )}
                    {googleResult.structuredData && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-1">Structured Artifact</div>
                        <div className="code-block text-xs">
                          <pre className="text-blue-400">{googleResult.structuredData}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GCC use cases */}
          <div className="border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">GCC Use Cases by Agent</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {googleAgents?.map(agent => (
                <div key={agent.agentId} className="flex items-start gap-2 p-2 rounded bg-card border border-border">
                  <span className="text-base mt-0.5">{agent.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-foreground mb-0.5">{agent.name}</div>
                    <div className="text-[10px] text-muted-foreground">{agent.gccRelevance[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bridge & Channels Panel ── */}
      {activeTab === "bridge" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Channel connectors */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Channel Connectors</div>
              <div className="space-y-2">
                {CHANNELS.map(ch => (
                  <div key={ch.id} className="bg-card border border-border rounded p-3 flex items-start gap-3">
                    <span className="text-lg">{ch.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{ch.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ch.status === 'live' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {ch.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Routing logic */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Domain Routing Logic</div>
              <div className="code-block text-xs mb-3">
                <div className="text-muted-foreground mb-1"># openclaw_mesh_bridge.py — domain router</div>
                <pre className="text-foreground">{`DOMAIN_KEYWORDS = {
  "Finance": ["deal", "fund", "portfolio",
              "dcf", "equity", "valuation"],
  "Legal":   ["contract", "clause", "review",
              "liability", "jurisdiction"],
  "Healthcare": ["patient", "clinical", "bed",
                 "staffing", "diagnosis"],
  "GCC Wealth": ["hnwi", "shariah", "wealth",
                 "suitability", "family office"],
}

def detect_domain(task: str) -> str:
    task_lower = task.lower()
    for domain, kws in DOMAIN_KEYWORDS.items():
        if any(kw in task_lower for kw in kws):
            return domain
    return "General"`}</pre>
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Routing examples</div>
              <div className="space-y-1">
                {ROUTING_EXAMPLES.map((ex, i) => (
                  <div key={i} className="bg-card border border-border rounded p-2 text-xs">
                    <div className="text-muted-foreground truncate mb-1">"{ex.input}"</div>
                    <div className="flex items-center gap-3">
                      <span className="text-primary">→ {ex.domain}</span>
                      <span className="text-muted-foreground">{ex.agent}</span>
                      <span className="ml-auto text-green-400">{ex.latency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live test panel */}
          <div className="border border-border rounded p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Live Bridge Test</div>
            <div className="flex gap-3 mb-3">
              <input
                value={task}
                onChange={e => setTask(e.target.value)}
                placeholder="Enter a task — e.g. Screen 3 deals against our VC thesis"
                className="flex-1 bg-card border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <select
                value={context}
                onChange={e => setContext(e.target.value)}
                className="bg-card border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option>Finance</option>
                <option>Legal</option>
                <option>Healthcare</option>
                <option>GCC Wealth</option>
                <option>Enterprise</option>
              </select>
              <button
                onClick={handleRun}
                disabled={running || !task.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {running ? "Running···" : "Run →"}
              </button>
            </div>
            {(log.length > 0 || result) && (
              <div className="code-block text-xs">
                {log.map((line, i) => (
                  <div key={i} className={`${line.startsWith('> Mesh:') ? 'text-blue-400' : line.startsWith('> Agent:') ? 'text-green-400' : line.startsWith('> Bridge:') ? 'text-purple-400' : 'text-foreground'} mb-0.5`}>
                    {line}
                  </div>
                ))}
                {result && (
                  <div className="mt-2 pt-2 border-t border-border text-muted-foreground">{result}</div>
                )}
              </div>
            )}
          </div>

          {/* Deploy instructions */}
          <div className="mt-6 border border-border rounded p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Deploy the Bridge</div>
            <div className="code-block text-xs">
              <pre>{`# 1. Set environment variables
export MESH_BASE_URL=https://agenthink-7enctkan.manus.space
export MESH_API_KEY=<your_key>   # from agenthink.ai/access

# 2. Start the bridge
uvicorn openclaw_mesh_bridge:app --host 0.0.0.0 --port 8080

# 3. Or use Docker Compose (includes OpenClaw Gateway)
docker compose up -d

# 4. Test health
curl http://localhost:8080/health`}</pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Fix: reference GOOGLE_PRESETS from the correct constant
const GOOGLE_PRESETS = GOOGLE_AGENT_PRESETS;
