// BridgePage.tsx — OpenClaw Bridge status and configuration
// Design: Operator Dark — live bridge health, channel config, test panel

import { useState } from "react";
import { BRIDGE_STATUS } from "@/lib/meshData";

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

export default function BridgePage() {
  const [task, setTask] = useState("");
  const [context, setContext] = useState("Finance");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

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

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>OpenClaw Bridge</h2>
        <p className="text-xs text-muted-foreground">The channel layer — connects OpenClaw's messaging connectors to AgenThink Mesh. Any message on any channel becomes a Mesh task.</p>
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
    </div>
  );
}
