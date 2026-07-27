import { useState, useRef, useEffect, useCallback } from "react";
import { Streamdown } from "streamdown";

// ─── Types ───────────────────────────────────────────────────────────────────
interface PiiResult { type: string; count: number; redacted: string; }
interface AuditEntry {
  requestHash: string;
  responseHash: string;
  chainHash: string;
  taskCategory: string;
  dataClassification: string;
  piiDetected: PiiResult[];
  piiRedacted: boolean;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  modelUsed: string;
  backendType: string;
  timestamp: string;
}
interface ChatMessage { role: "user" | "assistant"; content: string; audit?: AuditEntry; }
interface Stats {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  piiBlocked: number;
  dataClassification: { RESTRICTED: number; CONFIDENTIAL: number; INTERNAL: number; PUBLIC: number; };
  byCategory: { task_category: string; count: number; avg_latency: number }[];
  recentActivity: { created_at: number; task_category: string; data_classification: string; latency_ms: number; tokens: number }[];
}
interface AuditLogRow {
  id: number;
  session_id: string;
  request_hash: string;
  response_hash: string;
  chain_hash: string;
  model_used: string;
  task_category: string;
  data_classification: string;
  pii_redacted: number;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  created_at: number;
}

// ─── Colour helpers ──────────────────────────────────────────────────────────
const classColour = (c: string) => {
  if (c === "RESTRICTED") return "text-red-400 bg-red-900/30 border-red-700";
  if (c === "CONFIDENTIAL") return "text-orange-400 bg-orange-900/30 border-orange-700";
  if (c === "INTERNAL") return "text-yellow-400 bg-yellow-900/30 border-yellow-700";
  return "text-green-400 bg-green-900/30 border-green-700";
};

const SAMPLE_PROMPTS = [
  "Summarise the key risks in a standard Indonesian loan agreement for a SME borrower.",
  "What KYC documents are required under OJK regulation for onboarding a new corporate client?",
  "Analyse this clause: 'The borrower shall maintain a debt-service coverage ratio of not less than 1.25x at all times.' Is this market standard?",
  "A transaction of IDR 500,000,000 was flagged as suspicious. What are the AML reporting obligations under PPATK?",
  "Draft a summary of the key compliance requirements under Indonesia's PDP Law for a bank processing customer data.",
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MeshPilotDemo() {
  const [activeTab, setActiveTab] = useState<"chat" | "pii" | "audit" | "stats">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastAudit, setLastAudit] = useState<AuditEntry | null>(null);

  // PII scanner
  const [piiText, setPiiText] = useState("");
  const [piiResult, setPiiResult] = useState<{ piiDetected: PiiResult[]; hasPII: boolean; redactedText: string; dataClassification: string } | null>(null);
  const [piiLoading, setPiiLoading] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState<AuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await fetch("/api/meshpilot/stats");
      if (r.ok) setStats(await r.json());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const r = await fetch("/api/meshpilot/audit-log?limit=30");
      if (r.ok) {
        const data = await r.json();
        setAuditLog(data.entries || []);
      }
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "stats") fetchStats();
    if (activeTab === "audit") fetchAuditLog();
  }, [activeTab, fetchStats, fetchAuditLog]);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const r = await fetch("/api/meshpilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId: sessionId ?? undefined }),
      });
      if (!r.ok) throw new Error("Request failed");
      const data = await r.json();
      setSessionId(data.sessionId);
      setLastAudit(data.auditEntry);
      setMessages(prev => [...prev, { role: "assistant", content: data.response, audit: data.auditEntry }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Inference error — please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const scanPII = async () => {
    if (!piiText.trim()) return;
    setPiiLoading(true);
    try {
      const r = await fetch("/api/meshpilot/pii-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: piiText }),
      });
      if (r.ok) setPiiResult(await r.json());
    } finally {
      setPiiLoading(false);
    }
  };

  const exportCsv = () => {
    window.open("/api/meshpilot/audit-log/export", "_blank");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-[#0f172a]/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">MeshPilot CPU Node</h1>
              <p className="text-xs text-slate-400">Enterprise On-Premise AI — Data Sovereignty Guaranteed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 border border-green-700/40 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live Demo
            </span>
            <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
              Cloud-Demo Mode
            </span>
          </div>
        </div>
      </div>

      {/* Demo banner */}
      <div className="bg-sky-900/20 border-b border-sky-700/30">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 text-xs text-sky-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>Demo mode:</strong> This page demonstrates the full MeshPilot compliance stack. In production, inference runs on your AMD EPYC / Intel Xeon servers — zero data leaves your data centre. Today's demo uses the cloud API to show the interface and compliance layer.
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1 w-fit">
          {(["chat", "pii", "audit", "stats"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-sky-500 text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              {tab === "chat" && "💬 Inference Chat"}
              {tab === "pii" && "🔍 PII Scanner"}
              {tab === "audit" && "📋 Audit Log"}
              {tab === "stats" && "📊 Stats"}
            </button>
          ))}
        </div>

        {/* ── CHAT TAB ── */}
        {activeTab === "chat" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat panel */}
            <div className="lg:col-span-2 flex flex-col bg-[#1e293b] border border-slate-700/50 rounded-2xl overflow-hidden" style={{ height: "70vh" }}>
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">MeshPilot Inference Terminal</span>
                {sessionId && (
                  <span className="text-xs text-slate-500 font-mono">session: {sessionId.slice(0, 8)}…</span>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">Send a banking or compliance query to see MeshPilot in action.</p>
                    <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                      {SAMPLE_PROMPTS.slice(0, 3).map((p, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(p)}
                          className="text-left text-xs text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 hover:border-sky-500/50 hover:text-sky-300 transition-all"
                        >
                          {p.length > 80 ? p.slice(0, 80) + "…" : p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "bg-sky-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-sm"
                    }`}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <Streamdown>{m.content}</Streamdown>
                        </div>
                      ) : m.content}

                      {m.audit && (
                        <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${classColour(m.audit.dataClassification)}`}>
                            {m.audit.dataClassification}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 bg-slate-700/30">
                            {m.audit.taskCategory}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded border border-slate-600 text-slate-400 bg-slate-700/30">
                            {m.audit.latencyMs}ms
                          </span>
                          {m.audit.piiRedacted && (
                            <span className="text-xs px-1.5 py-0.5 rounded border border-red-700 text-red-400 bg-red-900/20">
                              PII redacted
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        <span className="text-xs text-slate-500 ml-1">Processing on-premise…</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-700/50">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Ask a banking, compliance, or contract question…"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                    className="bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    Send
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.slice(3).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(p)}
                      className="text-xs text-slate-500 hover:text-sky-400 transition-colors"
                    >
                      + {p.slice(0, 45)}…
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compliance sidebar */}
            <div className="space-y-4">
              {/* Live audit entry */}
              <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Audit Entry</h3>
                {lastAudit ? (
                  <div className="space-y-2 text-xs font-mono">
                    {[
                      ["Request Hash", lastAudit.requestHash],
                      ["Response Hash", lastAudit.responseHash],
                      ["Chain Hash", lastAudit.chainHash],
                      ["Task", lastAudit.taskCategory],
                      ["Latency", `${lastAudit.latencyMs}ms`],
                      ["Tokens", `${lastAudit.promptTokens + lastAudit.completionTokens}`],
                      ["Model", lastAudit.modelUsed],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-300 truncate max-w-[120px]">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Classification</span>
                      <span className={`px-1.5 py-0.5 rounded border text-xs ${classColour(lastAudit.dataClassification)}`}>
                        {lastAudit.dataClassification}
                      </span>
                    </div>
                    {lastAudit.piiDetected.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <span className="text-red-400">PII detected & redacted:</span>
                        {lastAudit.piiDetected.map((p, i) => (
                          <div key={i} className="text-red-300 ml-2">• {p.type} ({p.count}×)</div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-slate-700 text-slate-500">
                      {new Date(lastAudit.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Send a message to see the live audit entry.</p>
                )}
              </div>

              {/* Compliance guarantees */}
              <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Compliance Guarantees</h3>
                <div className="space-y-2">
                  {[
                    { icon: "🔒", label: "Data stays on-premise", sub: "Zero outbound API calls in production" },
                    { icon: "🔗", label: "SHA-256 chain integrity", sub: "Tamper-evident audit trail" },
                    { icon: "🛡️", label: "PII auto-detection", sub: "Aadhaar, PAN, NRIC, NIK, CC" },
                    { icon: "📂", label: "Data classification", sub: "PUBLIC → RESTRICTED routing" },
                    { icon: "👥", label: "RBAC enforced", sub: "Admin / Analyst / Readonly" },
                    { icon: "📤", label: "Regulator export", sub: "CSV audit trail on demand" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-base">{item.icon}</span>
                      <div>
                        <div className="text-xs text-slate-200">{item.label}</div>
                        <div className="text-xs text-slate-500">{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hardware spec */}
              <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Production Hardware</h3>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["CPU", "AMD EPYC 9334 (32-core)"],
                    ["RAM", "128 GB DDR5"],
                    ["Model", "Qwen2.5 14B Q4_K_M"],
                    ["Speed", "15–22 tok/s"],
                    ["Context", "128K tokens"],
                    ["GPU required", "None"],
                    ["Internet required", "None"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-slate-500">{k}</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PII SCANNER TAB ── */}
        {activeTab === "pii" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-1">PII Detection Engine</h2>
              <p className="text-sm text-slate-400 mb-4">Paste any text to scan for personally identifiable information. In production, every request is scanned before reaching the model.</p>
              <textarea
                value={piiText}
                onChange={e => setPiiText(e.target.value)}
                rows={10}
                placeholder={`Paste text here to scan for PII...\n\nExample:\nCustomer: Rajesh Kumar\nAadhaar: 1234 5678 9012\nPAN: ABCDE1234F\nEmail: rajesh@example.com\nPhone: +91 98765 43210`}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors resize-none font-mono"
              />
              <button
                onClick={scanPII}
                disabled={piiLoading || !piiText.trim()}
                className="mt-3 w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                {piiLoading ? "Scanning…" : "Scan for PII"}
              </button>
            </div>

            <div className="space-y-4">
              {piiResult ? (
                <>
                  <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Scan Result</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${classColour(piiResult.dataClassification)}`}>
                        {piiResult.dataClassification}
                      </span>
                    </div>
                    {piiResult.hasPII ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <strong>{piiResult.piiDetected.length} PII type(s) detected — would be redacted before inference</strong>
                        </div>
                        {piiResult.piiDetected.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                            <span className="text-sm text-red-300">{p.type}</span>
                            <span className="text-xs text-red-400">{p.count} instance{p.count > 1 ? "s" : ""}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        No PII detected — text is safe to process
                      </div>
                    )}
                  </div>

                  {piiResult.hasPII && (
                    <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                      <h3 className="text-sm font-semibold text-white mb-2">Redacted Output</h3>
                      <p className="text-xs text-slate-400 mb-2">This is what would be sent to the model:</p>
                      <pre className="text-xs text-slate-300 bg-slate-900 rounded-lg p-3 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                        {piiResult.redactedText}
                      </pre>
                    </div>
                  )}

                  <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Patterns Scanned</h3>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-400">
                      {["Aadhaar (India)", "PAN Card (India)", "NRIC (Singapore)", "NIK (Indonesia)", "Email Address", "Phone Number", "Credit Card", "Passport Number"].map(p => (
                        <div key={p} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center h-64">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-slate-400 text-sm">Paste text and click Scan to see PII detection in action.</p>
                  <p className="text-slate-500 text-xs mt-1">Detects 8 PII types across India, Indonesia, and Singapore.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AUDIT LOG TAB ── */}
        {activeTab === "audit" && (
          <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Immutable Audit Log</h2>
                <p className="text-xs text-slate-400 mt-0.5">SHA-256 chained entries — every request is logged and tamper-evident</p>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchAuditLog} className="text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                  Refresh
                </button>
                <button onClick={exportCsv} className="text-xs text-sky-400 hover:text-sky-300 bg-sky-900/20 border border-sky-700/40 px-3 py-1.5 rounded-lg transition-colors">
                  Export CSV
                </button>
              </div>
            </div>

            {auditLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading audit log…</div>
            ) : auditLog.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No entries yet — send a chat message to generate audit entries.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/50 text-slate-400">
                      <th className="text-left px-4 py-3 font-medium">Time</th>
                      <th className="text-left px-4 py-3 font-medium">Request Hash</th>
                      <th className="text-left px-4 py-3 font-medium">Chain Hash</th>
                      <th className="text-left px-4 py-3 font-medium">Category</th>
                      <th className="text-left px-4 py-3 font-medium">Classification</th>
                      <th className="text-left px-4 py-3 font-medium">PII</th>
                      <th className="text-right px-4 py-3 font-medium">Tokens</th>
                      <th className="text-right px-4 py-3 font-medium">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((row, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                          {new Date(row.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-mono">{row.request_hash}</td>
                        <td className="px-4 py-2.5 text-slate-300 font-mono">{row.chain_hash}</td>
                        <td className="px-4 py-2.5 text-slate-300">{row.task_category}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded border ${classColour(row.data_classification)}`}>
                            {row.data_classification}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.pii_redacted ? (
                            <span className="text-red-400">Redacted</span>
                          ) : (
                            <span className="text-green-400">Clean</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400">
                          {(row.prompt_tokens + row.completion_tokens).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{row.latency_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="text-center text-slate-500 py-12">Loading stats…</div>
            ) : stats ? (
              <>
                {/* KPI row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Total Requests", value: stats.totalRequests.toLocaleString(), icon: "📨", colour: "sky" },
                    { label: "Total Tokens", value: stats.totalTokens.toLocaleString(), icon: "🔤", colour: "violet" },
                    { label: "Avg Latency", value: `${stats.avgLatencyMs}ms`, icon: "⚡", colour: "amber" },
                    { label: "PII Blocked", value: stats.piiBlocked.toLocaleString(), icon: "🛡️", colour: "red" },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-4">
                      <div className="text-2xl mb-1">{kpi.icon}</div>
                      <div className="text-2xl font-bold text-white">{kpi.value}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{kpi.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Data classification breakdown */}
                  <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Data Classification Breakdown</h3>
                    {Object.entries(stats.dataClassification).map(([cls, count]) => {
                      const total = Object.values(stats.dataClassification).reduce((a, b) => a + b, 0) || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={cls} className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={classColour(cls).split(" ")[0]}>{cls}</span>
                            <span className="text-slate-400">{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cls === "RESTRICTED" ? "bg-red-500" :
                                cls === "CONFIDENTIAL" ? "bg-orange-500" :
                                cls === "INTERNAL" ? "bg-yellow-500" : "bg-green-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* By category */}
                  <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Requests by Task Category</h3>
                    {stats.byCategory.length === 0 ? (
                      <p className="text-sm text-slate-500">No data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.byCategory.map((row, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{row.task_category}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">{Math.round(row.avg_latency)}ms avg</span>
                              <span className="text-sky-400 font-medium">{row.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent activity */}
                <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-sm text-slate-500">No activity yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.recentActivity.map((row, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800">
                          <span className="text-slate-500">{new Date(row.created_at).toLocaleTimeString()}</span>
                          <span className="text-slate-300">{row.task_category}</span>
                          <span className={`px-1.5 py-0.5 rounded border ${classColour(row.data_classification)}`}>{row.data_classification}</span>
                          <span className="text-slate-400">{row.tokens.toLocaleString()} tok</span>
                          <span className="text-slate-400">{row.latency_ms}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-12">Failed to load stats. Click the Stats tab again to retry.</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-slate-500">
          <span>MeshPilot CPU Node — Enterprise On-Premise AI for Regulated Industries</span>
          <span>Built on AgenThinkMesh · agenthinkmesh.ai</span>
        </div>
      </div>
    </div>
  );
}
