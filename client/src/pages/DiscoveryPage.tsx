// DiscoveryPage.tsx — A2A Discovery with real DB agents + live test panel
// Design: Operator Dark — live agent discovery with terminal-style request echo

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { VERTICALS, VERTICAL_COLORS } from "@/lib/meshData";

// ── Types ──────────────────────────────────────────────────────────────────

interface DbAgent {
  id: number;
  agentName: string;
  developerName: string;
  description: string;
  capabilities: string[];
  endpointUrl: string;
  domain: string | null;
  status: string;
  connectionTested: boolean;
  clawReady: boolean;
  vertical: string;
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  statusCode: number;
  responseBody: unknown;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getVerticalColor(vertical: string): string {
  const v = vertical as keyof typeof VERTICAL_COLORS;
  return VERTICAL_COLORS[v] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

export default function DiscoveryPage() {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [vertical, setVertical] = useState("");
  const [clawOnly, setClawOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<DbAgent | null>(null);

  // ── Test panel state ──────────────────────────────────────────────────────
  const [testPayload, setTestPayload] = useState(
    JSON.stringify({ task: "ping", context: "openclaw-test" }, null, 2)
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testTab, setTestTab] = useState<"manifest" | "test">("manifest");

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: agents = [], isLoading, error } = trpc.openclaw.listAgents.useQuery({
    vertical: vertical || undefined,
    search: search || undefined,
    clawReadyOnly: clawOnly,
    limit: 200,
  });

  const testAgentMutation = trpc.openclaw.testAgent.useMutation({
    onSuccess: (data) => setTestResult(data),
    onError: (err) => setTestResult({
      ok: false,
      latencyMs: 0,
      statusCode: 0,
      responseBody: null,
      error: err.message,
    }),
  });

  // ── Live request echo ─────────────────────────────────────────────────────
  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (vertical) params.set("vertical", vertical.toLowerCase().replace(" ", "_"));
    if (clawOnly) params.set("claw_ready", "true");
    if (search) params.set("capability", search);
    return `GET /api/trpc/openclaw.listAgents${params.toString() ? "?" + params.toString() : ""}`;
  }, [vertical, clawOnly, search]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectAgent = (agent: DbAgent) => {
    setSelectedAgent(agent);
    setTestResult(null);
    setTestTab("manifest");
    setTestPayload(JSON.stringify({
      task: "ping",
      context: agent.vertical ?? "openclaw-test",
    }, null, 2));
  };

  const handleRunTest = () => {
    if (!selectedAgent) return;
    let payload: Record<string, unknown> = { task: "ping", context: "openclaw-test" };
    try {
      payload = JSON.parse(testPayload);
    } catch {
      // keep default
    }
    setTestResult(null);
    testAgentMutation.mutate({
      endpointUrl: selectedAgent.endpointUrl,
      payload,
      timeoutMs: 10000,
    });
  };

  const buildManifest = (agent: DbAgent) => ({
    schema_version: "openclaw/v1",
    agent_id: `mesh-agent-${agent.id}`,
    name: agent.agentName,
    description: agent.description,
    developer: agent.developerName,
    vertical: agent.vertical,
    status: agent.status,
    endpoint: {
      url: agent.endpointUrl,
      method: "POST",
      content_type: "application/json",
    },
    capabilities: agent.capabilities,
    claw_ready: agent.clawReady,
    connection_tested: agent.connectionTested,
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
          A2A Discovery API
        </h2>
        <p className="text-xs text-muted-foreground">
          Live agent registry — {isLoading ? "loading..." : `${agents.length} agents from database`}. Filter by vertical, capability, and Claw-readiness. Select any agent to inspect its manifest or fire a live test.
        </p>
      </div>

      {/* Live request echo */}
      <div className="code-block mb-4 text-xs">
        <div className="text-muted-foreground mb-1"># Live request</div>
        <div className="terminal-line">{requestUrl}</div>
        <div className="text-muted-foreground mt-1">
          # {isLoading ? "querying..." : `${agents.length} agents matched`}
          {agents.filter(a => a.clawReady).length > 0 && ` · ${agents.filter(a => a.clawReady).length} claw-ready`}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={vertical}
          onChange={e => setVertical(e.target.value)}
          className="bg-card border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">All verticals</option>
          {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or capability..."
          className="bg-card border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-52"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={clawOnly} onChange={e => setClawOnly(e.target.checked)} className="accent-primary" />
          OpenClaw-ready only
        </label>
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {isLoading ? "loading…" : `${agents.length} agents`}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 rounded border border-red-500/30 bg-red-500/10 text-xs text-red-400">
          Failed to load agents: {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && agents.length === 0 && (
        <div className="mb-4 p-6 rounded border border-border bg-card text-center text-xs text-muted-foreground">
          No agents found. Register agents at <a href="/registry" className="text-primary underline">/registry</a> to see them here.
        </div>
      )}

      <div className="flex gap-4">
        {/* Agent list */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="agent-card animate-pulse">
                  <div className="h-3 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-2 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {agents.slice(0, 50).map(agent => (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className={`agent-card flex items-start gap-3 cursor-pointer ${selectedAgent?.id === agent.id ? "border-primary/60 bg-primary/5" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {agent.agentName}
                      </span>
                      {agent.connectionTested && (
                        <span className="badge-verified">✓ verified</span>
                      )}
                      {agent.clawReady && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          ◈ claw
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${getVerticalColor(agent.vertical)}`}>
                        {agent.vertical}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${
                        agent.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        agent.status === "degraded" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}>
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="truncate max-w-[200px]">{agent.endpointUrl}</span>
                      {agent.capabilities.length > 0 && (
                        <span>{agent.capabilities.slice(0, 2).join(", ")}{agent.capabilities.length > 2 ? ` +${agent.capabilities.length - 2}` : ""}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleSelectAgent(agent); setTestTab("test"); }}
                    className="shrink-0 px-3 py-1 rounded text-xs border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                  >
                    test →
                  </button>
                </div>
              ))}
              {agents.length > 50 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  + {agents.length - 50} more agents — refine filters to narrow results
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent detail + test panel */}
        {selectedAgent && (
          <div className="w-80 shrink-0">
            <div className="bg-card border border-border rounded sticky top-6 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {selectedAgent.agentName}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${getVerticalColor(selectedAgent.vertical)}`}>
                        {selectedAgent.vertical}
                      </span>
                      {selectedAgent.clawReady && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          ◈ claw-ready
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelectedAgent(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
                <p className="text-xs text-muted-foreground">{selectedAgent.description}</p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {(["manifest", "test"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTestTab(tab)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      testTab === tab
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "manifest" ? "◈ Manifest" : "⚡ Live Test"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-4">
                {testTab === "manifest" ? (
                  <>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">OpenClaw Manifest</div>
                    <div className="code-block text-xs overflow-auto max-h-64">
                      <pre className="whitespace-pre-wrap break-all">{JSON.stringify(buildManifest(selectedAgent), null, 2)}</pre>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground uppercase tracking-widest mb-2">Connect</div>
                    <div className="code-block text-xs">
                      <pre>{`POST /api/trpc/openclaw.testAgent\n{\n  "endpointUrl": "${selectedAgent.endpointUrl}",\n  "payload": { "task": "..." }\n}`}</pre>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Live test panel */}
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Test Payload (JSON)</div>
                    <textarea
                      value={testPayload}
                      onChange={e => setTestPayload(e.target.value)}
                      rows={5}
                      className="w-full bg-background border border-border rounded p-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-none mb-3"
                      spellCheck={false}
                    />

                    <div className="text-xs text-muted-foreground mb-2 truncate">
                      → <span className="text-primary">{selectedAgent.endpointUrl}</span>
                    </div>

                    <button
                      onClick={handleRunTest}
                      disabled={testAgentMutation.isPending}
                      className="w-full py-2 rounded text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                    >
                      {testAgentMutation.isPending ? "⏳ Sending request…" : "⚡ Fire Test Request"}
                    </button>

                    {/* Test result */}
                    {testResult && (
                      <div className={`rounded border p-3 ${testResult.ok ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                            {testResult.ok ? "✓ Success" : "✗ Failed"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {testResult.latencyMs}ms · HTTP {testResult.statusCode || "—"}
                          </span>
                        </div>
                        {testResult.error && (
                          <div className="text-xs text-red-400 mb-2">{testResult.error}</div>
                        )}
                        {testResult.responseBody !== null && (
                          <>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Response</div>
                            <div className="code-block text-xs overflow-auto max-h-32">
                              <pre className="whitespace-pre-wrap break-all">
                                {typeof testResult.responseBody === "string"
                                  ? testResult.responseBody
                                  : JSON.stringify(testResult.responseBody, null, 2)}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
