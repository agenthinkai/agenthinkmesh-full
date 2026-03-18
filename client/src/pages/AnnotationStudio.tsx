import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import GateScreen from "@/components/GateScreen";
import Logo from "@/components/Logo";
import { Link } from "wouter";

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, sans-serif";

// Arabic annotation agent capability tags used to filter the registry
const ARABIC_AGENT_TAGS = ["arabic", "nlp", "annotation", "sentiment", "ner", "intent", "legal clause", "code-switch", "gulf", "labeling"];

type AnnotationResult = {
  id: number;
  label: string;
  confidence: number;
  dialect: string | null;
  rationale: string | null;
  requiresReview: boolean;
  structuredResult: unknown;
  latencyMs: number;
  agentName: string;
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "#22C55E" : pct >= 65 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 12, color, fontFamily: MONO, fontWeight: 700, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

function StructuredResultView({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
      {entries.slice(0, 12).map(([key, val]) => {
        if (key === "rationale") return null;
        const display = Array.isArray(val)
          ? val.slice(0, 3).join(", ") + (val.length > 3 ? `… +${val.length - 3}` : "")
          : typeof val === "object" && val !== null
          ? JSON.stringify(val).slice(0, 60)
          : String(val ?? "");
        return (
          <div key={key} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "#8494AA", fontFamily: MONO, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{key.replace(/_/g, " ")}</div>
            <div style={{ fontSize: 11, color: "#A8B4C8", fontFamily: MONO, wordBreak: "break-word", lineHeight: 1.5 }}>{display || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnnotationStudio() {
  const { user, loading: authLoading } = useAuth();
  const loginUrl = getLoginUrl();

  const [inputText, setInputText] = useState("");
  const [context, setContext] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"annotate" | "history" | "export">("annotate");
  const [lastResult, setLastResult] = useState<AnnotationResult | null>(null);
  const [exportFormat, setExportFormat] = useState<"jsonl" | "csv" | "openai">("jsonl");
  const [exportStatusFilter, setExportStatusFilter] = useState<"approved" | "all">("approved");
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState<Array<{ text: string; label: string; confidence: number; dialect: string; status: "pending" | "done" | "error" }>>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Fetch Arabic annotation agents from registry
  const { data: allAgents } = trpc.agent.list.useQuery({ limit: 100 });
  const arabicAgents = useMemo(() => {
    if (!allAgents) return [];
    return allAgents.filter(a => {
      const caps: string[] = (() => { try { return JSON.parse(a.capabilities); } catch { return []; } })();
      return caps.some(c => ARABIC_AGENT_TAGS.some(tag => c.toLowerCase().includes(tag)));
    });
  }, [allAgents]);

  // Annotation history
  const { data: history, refetch: refetchHistory } = trpc.annotation.list.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  // Export history
  const { data: exportHistory } = trpc.annotation.listExports.useQuery(undefined, { enabled: !!user });

  // Mutations
  const submitMutation = trpc.annotation.submit.useMutation({
    onSuccess: (data) => {
      setLastResult(data as AnnotationResult);
      void refetchHistory();
    },
  });

  const reviewMutation = trpc.annotation.review.useMutation({
    onSuccess: () => void refetchHistory(),
  });

  const exportMutation = trpc.annotation.export.useMutation({
    onSuccess: (data) => {
      setExportUrl(data.url);
    },
  });

  // Batch processing function
  const runBatch = async () => {
    if (!selectedAgentId || batchRunning) return;
    const lines = batchInput.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 50);
    if (lines.length === 0) return;
    setBatchRunning(true);
    setBatchProgress(0);
    setBatchResults(lines.map(text => ({ text, label: "", confidence: 0, dialect: "", status: "pending" as const })));
    for (let i = 0; i < lines.length; i++) {
      try {
        const result = await new Promise<{ label: string; confidence: number; dialect: string }>((resolve, reject) => {
          fetch("/api/trpc/annotation.submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: { agentId: selectedAgentId, inputText: lines[i], context: context || undefined } }),
          }).then(r => r.json()).then(data => {
            if (data?.result?.data?.json) resolve(data.result.data.json);
            else reject(new Error("No result"));
          }).catch(reject);
        });
        setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, label: result.label, confidence: result.confidence, dialect: result.dialect || "", status: "done" as const } : r));
      } catch {
        setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, label: "error", status: "error" as const } : r));
      }
      setBatchProgress(i + 1);
    }
    setBatchRunning(false);
    void refetchHistory();
  };

  const downloadBatchJSONL = () => {
    const done = batchResults.filter(r => r.status === "done");
    const content = done.map(r => JSON.stringify({ input_text: r.text, label: r.label, confidence: r.confidence, dialect: r.dialect })).join("\n");
    const blob = new Blob([content], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `batch-annotations-${Date.now()}.jsonl`; a.click();
    URL.revokeObjectURL(url);
  };

  const pendingCount = history?.filter(a => a.reviewStatus === "pending").length ?? 0;

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B1629", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#8494AA", fontFamily: MONO, fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <GateScreen feature="Arabic Annotation Studio" />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0B1629", fontFamily: FONT, color: "#E8ECF2" }}>

      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 56,
        background: "rgba(12,18,32,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ textDecoration: "none" }}><Logo size={26} /></Link>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#F59E0B" }}>ع</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#E8ECF2" }}>Arabic Annotation Studio</span>
            <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(180,83,9,0.2)", border: "1px solid rgba(180,83,9,0.4)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em" }}>Beta</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user ? (
            <>
              <span style={{ fontSize: 12, color: "#8494AA", fontFamily: MONO }}>{user.name}</span>
              <Link href="/dashboard" style={{ fontSize: 12, color: "#7BA3D4", textDecoration: "none", fontWeight: 600 }}>Dashboard</Link>
            </>
          ) : (
            <a href={loginUrl} style={{ padding: "7px 18px", background: "rgba(123,163,212,0.15)", color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Sign in to annotate</a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "rgba(180,83,9,0.15)", border: "1px solid rgba(180,83,9,0.3)", borderRadius: 999, marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>GCC AI Infrastructure</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#E8ECF2", marginBottom: 10, lineHeight: 1.15 }}>
            Arabic Data Annotation Studio
          </h1>
          <p style={{ fontSize: 14, color: "#8494AA", lineHeight: 1.7, maxWidth: 600 }}>
            Submit Arabic text to specialist annotation agents. Get structured labels — sentiment, entities, intent, clauses, code-switching — with confidence scores and dialect detection. Export as JSONL for LLM fine-tuning.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
          {([
            ["annotate", "Annotate"],
            ["history", `History${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}`],
            ["export", "Export Dataset"],
          ] as [typeof activeTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #F59E0B" : "2px solid transparent",
                color: activeTab === tab ? "#C9A84C" : "#8494AA",
                marginBottom: -1, transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Annotate Tab ── */}
        {activeTab === "annotate" && (
          <div>
          {/* Mode toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{ fontSize: 11, color: "#8494AA", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em" }}>Mode:</span>
            {(["single", "batch"] as const).map(m => (
              <button key={m} onClick={() => setBatchMode(m === "batch")}
                style={{ padding: "5px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: (m === "batch") === batchMode ? "rgba(180,83,9,0.25)" : "rgba(255,255,255,0.04)",
                  border: (m === "batch") === batchMode ? "1px solid rgba(180,83,9,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: (m === "batch") === batchMode ? "#C9A84C" : "#8494AA",
                }}>{m === "single" ? "Single Text" : "Batch (up to 50)"}</button>
            ))}
          </div>

          {/* Batch mode panel */}
          {batchMode && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 600 }}>Batch Annotation — one Arabic text per line (max 50)</div>
              <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)}
                placeholder={"أدخل النص الأول هنا\nأدخل النص الثاني هنا\nأدخل النص الثالث هنا"}
                dir="rtl" rows={8}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px 16px", color: "#A8B4C8", fontSize: 14, lineHeight: 1.8, fontFamily: "'Noto Naskh Arabic', 'Noto Sans Arabic', 'Arial', sans-serif", resize: "vertical", outline: "none", textAlign: "right" }} />
              <div style={{ marginTop: 8, fontSize: 10, color: "#8494AA", fontFamily: MONO }}>{batchInput.split("\n").filter(l => l.trim()).length} texts entered · agent: {arabicAgents.find(a => a.id === selectedAgentId)?.agentName ?? "none selected"}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button onClick={() => void runBatch()} disabled={!selectedAgentId || batchRunning || !batchInput.trim()}
                  style={{ flex: 1, padding: "12px", background: (!selectedAgentId || batchRunning || !batchInput.trim()) ? "rgba(180,83,9,0.3)" : "#B45309", color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (!selectedAgentId || batchRunning || !batchInput.trim()) ? "not-allowed" : "pointer" }}>
                  {batchRunning ? `Annotating ${batchProgress}/${batchInput.split("\n").filter(l => l.trim()).slice(0,50).length}...` : "Run Batch →"}
                </button>
                {batchResults.some(r => r.status === "done") && (
                  <button onClick={downloadBatchJSONL}
                    style={{ padding: "12px 20px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ADE80", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ↓ Download JSONL
                  </button>
                )}
              </div>
              {batchRunning && (
                <div style={{ marginTop: 12, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#F59E0B", borderRadius: 999, transition: "width 0.3s ease", width: `${(batchProgress / Math.max(1, batchInput.split("\n").filter(l => l.trim()).slice(0,50).length)) * 100}%` }} />
                </div>
              )}
              {batchResults.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Results</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {["#", "Text (60 chars)", "Label", "Confidence", "Dialect", "Status"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#8494AA", fontFamily: MONO, fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {batchResults.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "8px 10px", color: "#A8B4C8", fontFamily: MONO }}>{i + 1}</td>
                            <td style={{ padding: "8px 10px", color: "#94A3B8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "rtl", fontFamily: "'Noto Naskh Arabic', sans-serif" }}>{r.text.slice(0, 60)}{r.text.length > 60 ? "…" : ""}</td>
                            <td style={{ padding: "8px 10px", color: r.status === "done" ? "#4ADE80" : r.status === "error" ? "#EF4444" : "#A8B4C8", fontFamily: MONO, fontWeight: 700 }}>{r.label || "—"}</td>
                            <td style={{ padding: "8px 10px", color: "#8494AA", fontFamily: MONO }}>{r.status === "done" ? `${Math.round(r.confidence * 100)}%` : "—"}</td>
                            <td style={{ padding: "8px 10px", color: "#F59E0B", fontFamily: MONO, fontSize: 10 }}>{r.dialect || "—"}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, fontFamily: MONO, fontWeight: 700,
                                background: r.status === "done" ? "rgba(34,197,94,0.1)" : r.status === "error" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
                                color: r.status === "done" ? "#4ADE80" : r.status === "error" ? "#EF4444" : "#8494AA",
                                border: `1px solid ${r.status === "done" ? "rgba(34,197,94,0.3)" : r.status === "error" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
                              }}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: batchMode ? "none" : "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            {/* Left: Input panel */}
            <div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "24px" }}>
                <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 600 }}>Arabic Text Input</div>

                {/* RTL text area */}
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="أدخل النص العربي هنا للتصنيف والتوسيم..."
                  dir="rtl"
                  rows={6}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: "14px 16px",
                    color: "#A8B4C8", fontSize: 15, lineHeight: 1.8,
                    fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif",
                    resize: "vertical", outline: "none",
                    textAlign: "right",
                  }}
                />

                {/* Context field */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Domain context (optional)</div>
                  <input
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    placeholder="e.g. Gulf banking customer feedback, UAE legal contract, Saudi social media"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8, padding: "10px 14px",
                      color: "#A8B4C8", fontSize: 12, outline: "none",
                      fontFamily: FONT,
                    }}
                  />
                </div>

                {/* Agent selector */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Annotation agent</div>
                  {arabicAgents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#8494AA", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontFamily: MONO }}>
                      No Arabic agents registered yet. <Link href="/registry" style={{ color: "#F59E0B", textDecoration: "none" }}>Register one →</Link>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {arabicAgents.map(agent => {
                        const caps: string[] = (() => { try { return JSON.parse(agent.capabilities); } catch { return []; } })();
                        return (
                          <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 12,
                              padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                              background: selectedAgentId === agent.id ? "rgba(180,83,9,0.15)" : "rgba(0,0,0,0.2)",
                              border: selectedAgentId === agent.id ? "1px solid rgba(180,83,9,0.5)" : "1px solid rgba(255,255,255,0.06)",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: selectedAgentId === agent.id ? "#C9A84C" : "#1C3057", marginTop: 4, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#E8ECF2", marginBottom: 3 }}>{agent.agentName}</div>
                              <div style={{ fontSize: 10, color: "#8494AA", lineHeight: 1.5 }}>{agent.description}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                {caps.slice(0, 4).map((c, i) => (
                                  <span key={i} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO }}>{c}</span>
                                ))}
                                {agent.connectionTested && (
                                  <span style={{ fontSize: 9, padding: "2px 7px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 999, color: "#4ADE80", fontFamily: MONO }}>✓ verified</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                {user ? (
                  <button
                    onClick={() => {
                      if (!selectedAgentId || !inputText.trim()) return;
                      submitMutation.mutate({ agentId: selectedAgentId, inputText: inputText.trim(), context: context || undefined });
                    }}
                    disabled={!selectedAgentId || !inputText.trim() || submitMutation.isPending}
                    style={{
                      marginTop: 20, width: "100%", padding: "13px",
                      background: (!selectedAgentId || !inputText.trim() || submitMutation.isPending) ? "rgba(180,83,9,0.3)" : "#B45309",
                      color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: (!selectedAgentId || !inputText.trim() || submitMutation.isPending) ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {submitMutation.isPending ? "Annotating..." : "Annotate Text →"}
                  </button>
                ) : (
                  <a href={loginUrl} style={{
                    display: "block", marginTop: 20, width: "100%", padding: "13px",
                    background: "rgba(123,163,212,0.15)", color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 10,
                    fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center",
                  }}>Sign in to annotate →</a>
                )}

                {submitMutation.isError && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#FCA5A5" }}>
                    {submitMutation.error.message}
                  </div>
                )}
              </div>

              {/* Sample texts */}
              <div style={{ marginTop: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Sample Arabic texts</div>
                {[
                  { text: "والله الخدمة في هذا البنك وايد زينة، ما قصروا معي أبد. كل شي تمام", ctx: "Gulf banking feedback" },
                  { text: "وقّع معالي الشيخ محمد بن راشد آل مكتوم اتفاقية شراكة مع شركة أرامكو السعودية في دبي", ctx: "GCC business news" },
                  { text: "أبي أعرف إذا المرابحة العقارية حلال وكيف أقدر أتقدم لها", ctx: "Islamic bank chatbot" },
                  { text: "ال meeting كان productive وايد، وقررنا نطلق ال product في Q2", ctx: "Gulf corporate communication" },
                ].map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputText(sample.text); setContext(sample.ctx); }}
                    style={{
                      display: "block", width: "100%", textAlign: "right", direction: "rtl",
                      padding: "10px 12px", marginBottom: 8, borderRadius: 8, cursor: "pointer",
                      background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
                      color: "#94A3B8", fontSize: 12, lineHeight: 1.6,
                      fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif",
                    }}
                  >
                    {sample.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Result panel */}
            <div>
              {lastResult ? (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Annotation Result</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {lastResult.requiresReview && (
                        <span style={{ fontSize: 9, padding: "3px 9px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO }}>REVIEW NEEDED</span>
                      )}
                      <span style={{ fontSize: 9, padding: "3px 9px", background: "rgba(255,255,255,0.06)", borderRadius: 999, color: "#8494AA", fontFamily: MONO }}>{lastResult.latencyMs}ms</span>
                    </div>
                  </div>

                  {/* Agent name */}
                  <div style={{ fontSize: 11, color: "#8494AA", fontFamily: MONO, marginBottom: 16 }}>via {lastResult.agentName}</div>

                  {/* Primary label */}
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "#8494AA", fontFamily: MONO, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Primary Label</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#4ADE80", fontFamily: MONO, letterSpacing: "-0.02em" }}>{lastResult.label}</div>
                    {lastResult.dialect && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#F59E0B", fontFamily: MONO }}>dialect: {lastResult.dialect}</div>
                    )}
                  </div>

                  {/* Confidence */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "#8494AA", fontFamily: MONO, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence</div>
                    <ConfidenceBar value={lastResult.confidence} />
                  </div>

                  {/* Rationale */}
                  {lastResult.rationale && (
                    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                      <div style={{ fontSize: 9, color: "#8494AA", fontFamily: MONO, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rationale</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.7 }}>{lastResult.rationale}</div>
                    </div>
                  )}

                  {/* Structured result */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "#8494AA", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Structured Output</div>
                    <StructuredResultView data={lastResult.structuredResult} />
                  </div>

                  {/* Review actions */}
                  {user && (
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button
                        onClick={() => reviewMutation.mutate({ id: lastResult.id, status: "approved" })}
                        style={{ flex: 1, padding: "9px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, color: "#4ADE80", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: lastResult.id, status: "rejected" })}
                        style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 16, color: "#F59E0B" }}>ع</div>
                  <div style={{ fontSize: 14, color: "#8494AA", lineHeight: 1.7 }}>
                    Select an agent, enter Arabic text,<br />and click Annotate to see structured output.
                  </div>
                  <div style={{ marginTop: 20, fontSize: 11, color: "#A8B4C8", fontFamily: MONO, lineHeight: 1.8 }}>
                    Outputs include: label · confidence · dialect<br />rationale · structured JSON · review status
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <div>
            {!user ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <a href={loginUrl} style={{ padding: "12px 28px", background: "rgba(123,163,212,0.15)", color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign in to view history</a>
              </div>
            ) : !history || history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#8494AA", fontSize: 13 }}>No annotations yet. Submit your first text above.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map(ann => {
                  const statusColor = ann.reviewStatus === "approved" ? "#22C55E" : ann.reviewStatus === "rejected" ? "#EF4444" : "#F59E0B";
                  return (
                    <div key={ann.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 10, padding: "2px 9px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO }}>{ann.agentName}</span>
                          {ann.dialect && <span style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO }}>{ann.dialect}</span>}
                          <span style={{ fontSize: 10, color: "#A8B4C8", fontFamily: MONO }}>{new Date(ann.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#A8B4C8", direction: "rtl", textAlign: "right", fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif", lineHeight: 1.7, marginBottom: 10 }}>
                          {ann.inputText.slice(0, 120)}{ann.inputText.length > 120 ? "…" : ""}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#4ADE80", fontFamily: MONO }}>{ann.label}</span>
                          <span style={{ fontSize: 11, color: "#8494AA", fontFamily: MONO }}>{Math.round(Number(ann.confidence) * 100)}% confidence</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <span style={{ fontSize: 10, padding: "3px 10px", background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 999, color: statusColor, fontFamily: MONO, textTransform: "uppercase" }}>
                          {ann.reviewStatus}
                        </span>
                        {ann.reviewStatus === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => reviewMutation.mutate({ id: ann.id, status: "approved" })} style={{ padding: "5px 12px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, color: "#4ADE80", fontSize: 11, cursor: "pointer" }}>✓</button>
                            <button onClick={() => reviewMutation.mutate({ id: ann.id, status: "rejected" })} style={{ padding: "5px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#EF4444", fontSize: 11, cursor: "pointer" }}>✗</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Export Tab ── */}
        {activeTab === "export" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "24px" }}>
                <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20, fontWeight: 600 }}>Export Annotation Dataset</div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Format</div>
                  <div style={{ display: "flex", gap: 10 }}>
                      {(["jsonl", "csv", "openai"] as const).map(f => (
                      <button key={f} onClick={() => setExportFormat(f)} style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: exportFormat === f ? "rgba(180,83,9,0.2)" : "rgba(0,0,0,0.2)",
                        border: exportFormat === f ? "1px solid rgba(180,83,9,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        color: exportFormat === f ? "#C9A84C" : "#8494AA",
                        fontSize: 12, fontWeight: 700, fontFamily: MONO,
                      }}>
                        {f === "openai" ? "OpenAI" : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: "#A8B4C8", fontFamily: MONO, lineHeight: 1.6 }}>
                    {exportFormat === "jsonl" ? "JSONL: One JSON object per line. Compatible with Gemini, Llama, and general fine-tuning." : exportFormat === "openai" ? "OpenAI format: messages array with system/user/assistant roles. Ready for GPT-4 fine-tuning API." : "CSV: Flat table format. Compatible with Excel, pandas, and data labeling platforms."}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Include</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["approved", "all"] as const).map(f => (
                      <button key={f} onClick={() => setExportStatusFilter(f)} style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: exportStatusFilter === f ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.2)",
                        border: exportStatusFilter === f ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        color: exportStatusFilter === f ? "#4ADE80" : "#8494AA",
                        fontSize: 12, fontWeight: 600,
                      }}>
                        {f === "approved" ? "Approved only" : "All annotations"}
                      </button>
                    ))}
                  </div>
                </div>

                {user ? (
                  <button
                    onClick={() => {
                      setExportUrl(null);
                      exportMutation.mutate({ format: exportFormat, statusFilter: exportStatusFilter });
                    }}
                    disabled={exportMutation.isPending}
                    style={{
                      width: "100%", padding: "13px",
                      background: exportMutation.isPending ? "rgba(180,83,9,0.3)" : "#B45309",
                      color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: exportMutation.isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {exportMutation.isPending ? "Generating export..." : `Export as ${exportFormat.toUpperCase()} →`}
                  </button>
                ) : (
                  <a href={loginUrl} style={{ display: "block", width: "100%", padding: "13px", background: "rgba(123,163,212,0.15)", color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>Sign in to export</a>
                )}

                {exportMutation.isError && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#FCA5A5" }}>
                    {exportMutation.error.message}
                  </div>
                )}

                {exportUrl && (
                  <div style={{ marginTop: 16, padding: "16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: "#4ADE80", fontFamily: MONO, marginBottom: 10, fontWeight: 600 }}>Export ready — {exportMutation.data?.recordCount} records</div>
                    <a href={exportUrl} target="_blank" rel="noreferrer" style={{
                      display: "block", padding: "10px 16px", background: "#4ADE80", color: "#0B1629",
                      borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center",
                    }}>
                      Download {exportFormat.toUpperCase()} file
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Export history */}
            <div>
              <div style={{ fontSize: 11, color: "#8494AA", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 500 }}>Export history</div>
              {!exportHistory || exportHistory.length === 0 ? (
                <div style={{ color: "#A8B4C8", fontSize: 12, fontFamily: MONO }}>No exports yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {exportHistory.map(exp => (
                    <div key={exp.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#E8ECF2", marginBottom: 4 }}>{exp.recordCount} records · {exp.format.toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: "#8494AA", fontFamily: MONO }}>{new Date(exp.createdAt).toLocaleString()}</div>
                      </div>
                      {exp.fileUrl && (
                        <a href={exp.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#F59E0B", textDecoration: "none", fontFamily: MONO, fontWeight: 600 }}>Download</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
