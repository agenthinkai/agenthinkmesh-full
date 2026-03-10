import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const FONT = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const INDIGO = "#4F46E5";
const SLATE = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const BG = "#F8FAFC";

const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  per_task: "Per Task",
  subscription: "Subscription",
};

const PRICING_COLORS: Record<string, string> = {
  free: "#16A34A",
  per_task: "#D97706",
  subscription: "#4F46E5",
};

type Tab = "directory" | "register" | "my-agents";

export default function AgentRegistry() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [capFilter, setCapFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");

  // Registration form state
  const [form, setForm] = useState({
    agentName: "",
    developerName: user?.name ?? "",
    description: "",
    capabilities: "",
    endpointUrl: "",
    averageLatency: 500,
    pricingModel: "free" as "free" | "per_task" | "subscription",
  });

  const { data: agentList = [], refetch: refetchList } = trpc.agent.list.useQuery({
    limit: 50,
    offset: 0,
  });

  const { data: myAgents = [], refetch: refetchMine } = trpc.agent.myAgents.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const registerMutation = trpc.agent.register.useMutation({
    onSuccess: () => {
      toast.success("Agent registered successfully");
      setForm({
        agentName: "", developerName: user?.name ?? "", description: "",
        capabilities: "", endpointUrl: "", averageLatency: 500, pricingModel: "free",
      });
      setEndpointTest(null);
      refetchList();
      refetchMine();
      setActiveTab("my-agents");
    },
    onError: (e) => toast.error(e.message),
  });

  // Endpoint connection test
  const [endpointTest, setEndpointTest] = useState<{
    ok: boolean;
    latencyMs: number;
    preview: string;
    error?: string;
  } | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const testEndpointMutation = trpc.agent.testEndpoint.useMutation();

  const handleTestEndpoint = async () => {
    if (!form.endpointUrl) { toast.error("Enter an endpoint URL first"); return; }
    setTestingEndpoint(true);
    setEndpointTest(null);
    try {
      const result = await testEndpointMutation.mutateAsync({ endpointUrl: form.endpointUrl });
      setEndpointTest(result);
      if (result.ok) {
        toast.success(`Connection successful · ${result.latencyMs}ms`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setEndpointTest({ ok: false, latencyMs: 0, preview: "", error: msg });
      toast.error(`Test failed: ${msg}`);
    } finally {
      setTestingEndpoint(false);
    }
  };

  const deactivateMutation = trpc.agent.deactivate.useMutation({
    onSuccess: () => { toast.success("Agent deactivated"); refetchMine(); refetchList(); },
    onError: (e) => toast.error(e.message),
  });

  const filteredAgents = agentList.filter(a => {
    const q = searchQuery.toLowerCase();
    const nameMatch = a.agentName.toLowerCase().includes(q) ||
      a.developerName.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q);
    if (!nameMatch) return false;
    const caps: string[] = (() => { try { return JSON.parse(a.capabilities); } catch { return []; } })();
    if (capFilter) {
      if (!caps.some(c => c.toLowerCase().includes(capFilter.toLowerCase()))) return false;
    }
    if (domainFilter) {
      if (!caps.some(c => c.toLowerCase().includes(domainFilter.toLowerCase()))) return false;
    }
    return true;
  });

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const caps = form.capabilities.split(",").map(c => c.trim()).filter(Boolean);
    if (caps.length === 0) { toast.error("Add at least one capability"); return; }
    registerMutation.mutate({
      agentName: form.agentName,
      developerName: form.developerName,
      description: form.description,
      capabilities: caps,
      endpointUrl: form.endpointUrl,
      averageLatency: form.averageLatency,
      pricingModel: form.pricingModel,
      connectionTested: endpointTest?.ok === true,
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: `1px solid ${BORDER}`,
    borderRadius: 8, fontSize: 13, fontFamily: FONT, color: SLATE,
    background: "#fff", outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600, color: MUTED,
    fontFamily: MONO, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, color: SLATE }}>

      {/* Topbar */}
      <header style={{
        height: 52, display: "flex", alignItems: "center", padding: "0 24px",
        borderBottom: `1px solid ${BORDER}`, background: "#fff", gap: 16, flexShrink: 0,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo size={26} />
        </Link>
        <span style={{ color: BORDER, fontSize: 18 }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: SLATE }}>Agent Registry</span>
        <div style={{ flex: 1 }} />
        {isAuthenticated ? (
          <span style={{ fontSize: 12, color: MUTED }}>{user?.name}</span>
        ) : (
          <a href={getLoginUrl()} style={{
            padding: "6px 16px", background: INDIGO, color: "#fff",
            borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>Sign in</a>
        )}
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
            Agent Registry
          </h1>
          <p style={{ fontSize: 14, color: MUTED, maxWidth: 560 }}>
            Register your external AI agents into the AgenThink Mesh routing layer.
            Registered agents are discoverable, scored, and routed based on capability match,
            success rate, and latency.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
          {(["directory", "register", "my-agents"] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 18px", fontSize: 13, fontWeight: 600,
                border: "none", background: "none", cursor: "pointer",
                color: activeTab === tab ? INDIGO : MUTED,
                borderBottom: activeTab === tab ? `2px solid ${INDIGO}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {tab === "directory" ? "Public Directory" : tab === "register" ? "Register Agent" : "My Agents"}
            </button>
          ))}
        </div>

        {/* ── Directory Tab ── */}
        {activeTab === "directory" && (
          <div>
            {/* Search + filter bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, maxWidth: 280, flex: "1 1 180px" }}
              />
              <select
                value={domainFilter}
                onChange={e => setDomainFilter(e.target.value)}
                style={{ ...inputStyle, maxWidth: 200, flex: "0 0 auto", cursor: "pointer" }}
              >
                {[
                  { value: "", label: "All Domains" },
                  { value: "finance", label: "Finance" },
                  { value: "legal", label: "Legal" },
                  { value: "healthcare", label: "Healthcare" },
                  { value: "arabic nlp", label: "Arabic NLP" },
                  { value: "strategy", label: "Strategy" },
                  { value: "market research", label: "Market Research" },
                  { value: "report writing", label: "Report Writing" },
                  { value: "data labeling", label: "Data Labeling" },
                ].map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <input
                placeholder="Capability search..."
                value={capFilter}
                onChange={e => setCapFilter(e.target.value)}
                style={{ ...inputStyle, maxWidth: 200, flex: "0 0 auto" }}
              />
              {(domainFilter || capFilter || searchQuery) && (
                <button onClick={() => { setDomainFilter(""); setCapFilter(""); setSearchQuery(""); }}
                  style={{ padding: "8px 14px", fontSize: 11, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, cursor: "pointer", fontFamily: MONO }}>
                  Clear
                </button>
              )}
              <span style={{ fontSize: 12, color: MUTED, marginLeft: "auto" }}>
                {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}
              </span>
            </div>

            {filteredAgents.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "64px 24px", color: MUTED,
                border: `1px dashed ${BORDER}`, borderRadius: 12,
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No agents registered yet</div>
                <div style={{ fontSize: 13 }}>Be the first to register an agent into the mesh.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {filteredAgents.map(agent => {
                  const caps: string[] = (() => { try { return JSON.parse(agent.capabilities); } catch { return []; } })();
                  return (
                    <div key={agent.id} style={{
                      background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
                      padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{agent.agentName}</span>
                            {agent.connectionTested && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                                background: "#DCFCE7", color: "#16A34A", fontFamily: MONO,
                                border: "1px solid #BBF7D0", letterSpacing: "0.04em",
                              }}>✓ Verified</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>by {agent.developerName}</div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                          background: `${PRICING_COLORS[agent.pricingModel]}15`,
                          color: PRICING_COLORS[agent.pricingModel], fontFamily: MONO,
                        }}>
                          {PRICING_LABELS[agent.pricingModel]}
                        </span>
                      </div>

                      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, margin: 0 }}>
                        {agent.description.slice(0, 120)}{agent.description.length > 120 ? "…" : ""}
                      </p>

                      {/* Capabilities */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {caps.slice(0, 5).map(c => (
                          <span key={c} style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 999,
                            background: "#EEF2FF", color: INDIGO, fontFamily: MONO,
                          }}>{c}</span>
                        ))}
                        {caps.length > 5 && (
                          <span style={{ fontSize: 10, color: MUTED, padding: "2px 4px" }}>+{caps.length - 5}</span>
                        )}
                      </div>

                      {/* Metrics */}
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}`,
                      }}>
                        {[
                          { label: "Tasks", value: agent.tasksCompleted ?? 0 },
                          { label: "Success", value: `${Number(agent.successRate ?? 80).toFixed(0)}%` },
                          { label: "Latency", value: `${agent.avgLatency ?? agent.averageLatency}ms` },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: SLATE, fontFamily: MONO }}>{m.value}</div>
                            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Register Tab ── */}
        {activeTab === "register" && (
          <div style={{ maxWidth: 600 }}>
            {!isAuthenticated ? (
              <div style={{
                textAlign: "center", padding: "48px 24px", border: `1px dashed ${BORDER}`,
                borderRadius: 12, color: MUTED,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sign in to register an agent</div>
                <a href={getLoginUrl()} style={{
                  display: "inline-block", padding: "8px 20px", background: INDIGO,
                  color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>Sign in</a>
              </div>
            ) : (
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{
                  padding: "12px 16px", background: "#EEF2FF", borderRadius: 8,
                  fontSize: 12, color: INDIGO, fontFamily: MONO, lineHeight: 1.6,
                }}>
                  External agents must expose a REST POST endpoint that accepts{" "}
                  <code style={{ background: "#C7D2FE", padding: "1px 4px", borderRadius: 4 }}>
                    {"{ task, context }"}
                  </code>{" "}
                  and returns{" "}
                  <code style={{ background: "#C7D2FE", padding: "1px 4px", borderRadius: 4 }}>
                    {"{ result, latency_ms }"}
                  </code>.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Agent Name *</label>
                    <input required style={inputStyle} value={form.agentName}
                      onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
                      placeholder="e.g. Risk Analyser Pro" />
                  </div>
                  <div>
                    <label style={labelStyle}>Developer / Company *</label>
                    <input required style={inputStyle} value={form.developerName}
                      onChange={e => setForm(f => ({ ...f, developerName: e.target.value }))}
                      placeholder="e.g. Acme AI Ltd" />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Description *</label>
                  <textarea required rows={3} style={{ ...inputStyle, resize: "vertical" }}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What does this agent do? What problems does it solve?" />
                </div>

                <div>
                  <label style={labelStyle}>Capabilities * (comma-separated)</label>
                  <input required style={inputStyle} value={form.capabilities}
                    onChange={e => setForm(f => ({ ...f, capabilities: e.target.value }))}
                    placeholder="e.g. risk-analysis, portfolio-review, compliance-check" />
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                    These are used for discovery scoring. Be specific.
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Endpoint URL *</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input required type="url" style={{ ...inputStyle, flex: 1 }} value={form.endpointUrl}
                      onChange={e => { setForm(f => ({ ...f, endpointUrl: e.target.value })); setEndpointTest(null); }}
                      placeholder="https://your-agent.example.com/execute" />
                    <button
                      type="button"
                      onClick={handleTestEndpoint}
                      disabled={testingEndpoint || !form.endpointUrl}
                      style={{
                        padding: "9px 16px", border: `1px solid ${BORDER}`, borderRadius: 8,
                        background: testingEndpoint ? "#F1F5F9" : "#fff",
                        color: testingEndpoint ? MUTED : SLATE,
                        fontSize: 12, fontWeight: 600, cursor: testingEndpoint || !form.endpointUrl ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap", fontFamily: MONO, flexShrink: 0,
                      }}
                    >
                      {testingEndpoint ? "Testing…" : "Test Connection"}
                    </button>
                  </div>
                  {/* Test result */}
                  {endpointTest && (
                    <div style={{
                      marginTop: 8, padding: "10px 12px", borderRadius: 8,
                      background: endpointTest.ok ? "#F0FDF4" : "#FFF1F2",
                      border: `1px solid ${endpointTest.ok ? "#BBF7D0" : "#FECDD3"}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: endpointTest.preview ? 6 : 0 }}>
                        <span style={{ fontSize: 14 }}>{endpointTest.ok ? "✓" : "✗"}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: endpointTest.ok ? "#16A34A" : "#DC2626" }}>
                          {endpointTest.ok ? `Connected · ${endpointTest.latencyMs}ms` : `Failed: ${endpointTest.error}`}
                        </span>
                      </div>
                      {endpointTest.preview && (
                        <pre style={{ margin: 0, fontSize: 10, color: "#374151", fontFamily: MONO, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflow: "auto" }}>
                          {endpointTest.preview}
                        </pre>
                      )}
                    </div>
                  )}
                  {endpointTest && !endpointTest.ok && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#D97706", fontFamily: MONO }}>
                      ⚠ Endpoint validation failed. You can still register, but the agent may not function correctly.
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Avg Latency (ms)</label>
                    <input type="number" min={0} max={60000} style={inputStyle}
                      value={form.averageLatency}
                      onChange={e => setForm(f => ({ ...f, averageLatency: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Pricing Model</label>
                    <select style={inputStyle} value={form.pricingModel}
                      onChange={e => setForm(f => ({ ...f, pricingModel: e.target.value as typeof form.pricingModel }))}>
                      <option value="free">Free</option>
                      <option value="per_task">Per Task</option>
                      <option value="subscription">Subscription</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  style={{
                    padding: "11px 24px", background: registerMutation.isPending ? "#A5B4FC" : INDIGO,
                    color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
                    cursor: registerMutation.isPending ? "not-allowed" : "pointer", alignSelf: "flex-start",
                  }}
                >
                  {registerMutation.isPending ? "Registering…" : "Register Agent →"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── My Agents Tab ── */}
        {activeTab === "my-agents" && (
          <div>
            {!isAuthenticated ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: MUTED }}>
                <a href={getLoginUrl()} style={{
                  display: "inline-block", padding: "8px 20px", background: INDIGO,
                  color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                }}>Sign in to view your agents</a>
              </div>
            ) : myAgents.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "64px 24px", color: MUTED,
                border: `1px dashed ${BORDER}`, borderRadius: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No agents registered yet</div>
                <button onClick={() => setActiveTab("register")} style={{
                  padding: "8px 20px", background: INDIGO, color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Register your first agent →</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {myAgents.map(agent => {
                  const caps: string[] = (() => { try { return JSON.parse(agent.capabilities); } catch { return []; } })();
                  return (
                    <div key={agent.id} style={{
                      background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
                      padding: "18px 20px", display: "flex", alignItems: "center", gap: 20,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{agent.agentName}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: agent.status === "active" ? "#DCFCE7" : "#FEE2E2",
                            color: agent.status === "active" ? "#16A34A" : "#DC2626",
                            fontFamily: MONO,
                          }}>{agent.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>{agent.description.slice(0, 100)}…</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {caps.slice(0, 4).map(c => (
                            <span key={c} style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 999,
                              background: "#EEF2FF", color: INDIGO, fontFamily: MONO,
                            }}>{c}</span>
                          ))}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                        {[
                          { label: "Tasks", value: agent.tasksCompleted ?? 0 },
                          { label: "Success", value: `${Number(agent.successRate ?? 80).toFixed(0)}%` },
                          { label: "Latency", value: `${agent.avgLatency ?? agent.averageLatency}ms` },
                          { label: "Errors", value: `${Number(agent.errorRate ?? 0).toFixed(0)}%` },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO }}>{m.value}</div>
                            <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.label}</div>
                          </div>
                        ))}
                      </div>

                      {agent.status === "active" && (
                        <button
                          onClick={() => deactivateMutation.mutate({ id: agent.id })}
                          style={{
                            padding: "6px 14px", background: "none", border: `1px solid #FCA5A5`,
                            borderRadius: 8, fontSize: 12, color: "#DC2626", cursor: "pointer",
                            fontWeight: 600, flexShrink: 0,
                          }}
                        >Deactivate</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
