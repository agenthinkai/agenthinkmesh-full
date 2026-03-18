import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveAgentState {
  stepIndex: number;
  agentName: string;
  status: "pending" | "running" | "complete" | "failed";
  summary?: string;
  entities?: Record<string, string[]>;
  confidenceLevel?: number;
  warnings?: string[];
  tokensUsed?: number;
  durationMs?: number;
  error?: string;
}

const PIPELINE_AGENTS = [
  { name: "Intake Agent",       role: "Case Parser",               icon: "📋", color: "#38BDF8" },
  { name: "Research Agent",     role: "Literature Analyst",        icon: "🔬", color: "#A78BFA" },
  { name: "Mutation Agent",     role: "Target Identifier",         icon: "🧬", color: "#34D399" },
  { name: "Structural Agent",   role: "Binding Analyst",           icon: "⚗️",  color: "#FB923C" },
  { name: "Therapeutic Agent",  role: "Intervention Strategist",   icon: "💊", color: "#F472B6" },
  { name: "Validation Agent",   role: "Risk & Quality Reviewer",   icon: "✅", color: "#FBBF24" },
];

// ── Status helpers ────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "complete": return "#4ADE80";
    case "running":  return "#38BDF8";
    case "failed":   return "#F87171";
    default:         return "rgba(240,244,250,0.2)";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "complete": return "Complete";
    case "running":  return "Running…";
    case "failed":   return "Failed";
    default:         return "Pending";
  }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RosieProtocol() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  // Input
  const [caseText, setCaseText]     = useState("");
  const [showInput, setShowInput]   = useState(true);
  const [inputMode, setInputMode]   = useState<"text" | "vault" | "upload">("text");
  const [selectedVaultDocId, setSelectedVaultDocId] = useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Vault docs
  const { data: vaultDocs, isLoading: vaultLoading } = trpc.vault.list.useQuery(undefined, { enabled: !!user });
  const uploadVaultDoc = trpc.vault.upload.useMutation();

  // Pipeline state (driven by SSE)
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [agentStates, setAgentStates] = useState<LiveAgentState[]>(
    PIPELINE_AGENTS.map((a, i) => ({ stepIndex: i, agentName: a.name, status: "pending" }))
  );
  const [isRunning, setIsRunning]   = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isFailed, setIsFailed]     = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [riskFlags, setRiskFlags]   = useState<string[]>([]);
  const [elapsedMs, setElapsedMs]   = useState(0);
  const [totalDurationMs, setTotalDurationMs] = useState<number | null>(null);

  // UI
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  // Refs
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef       = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);

  // Vault doc upload handler
  const handleVaultUpload = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    try {
      const result = await uploadVaultDoc.mutateAsync({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Content: base64,
      });
      setSelectedVaultDocId(result.docId);
      setUploadedFileName(file.name);
      // Fetch extracted text from the uploaded doc
      if (result.extractedText) {
        setCaseText(result.extractedText);
      }
    } catch (err: any) {
      console.error("Vault upload failed:", err);
    }
  }, [uploadVaultDoc]);

  // Access check
  const { data: accessData, isLoading: accessLoading } = trpc.workflow.checkAccess.useQuery(undefined, {
    enabled: !!user,
  });

  // PDF export
  const generatePdf = trpc.dossier.generate.useMutation({
    onSuccess: (data) => { window.open(data.url, "_blank"); },
  });

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTimeRef.current), 250);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // ── SSE handler ───────────────────────────────────────────────────────────

  const startSSE = useCallback((sid: string, inputText: string) => {
    // Close any existing connection
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const params = new URLSearchParams({
      sessionId: sid,
      workflowType: "rosie_protocol",
      userId: String(user?.id ?? 0),
      inputText,
    });

    const es = new EventSource(`/api/workflow/stream?${params.toString()}`);
    esRef.current = es;

    es.addEventListener("start", () => {
      // Pipeline acknowledged
    });

    es.addEventListener("step_start", (e) => {
      const { stepIndex, agentName } = JSON.parse(e.data);
      setAgentStates(prev => prev.map(s =>
        s.stepIndex === stepIndex ? { ...s, agentName, status: "running" } : s
      ));
    });

    es.addEventListener("step_complete", (e) => {
      const data = JSON.parse(e.data);
      setAgentStates(prev => prev.map(s =>
        s.stepIndex === data.stepIndex
          ? {
              ...s,
              status: "complete",
              summary: data.summary,
              entities: data.entities,
              confidenceLevel: data.confidenceLevel,
              warnings: data.warnings ?? [],
              tokensUsed: data.tokensUsed,
              durationMs: data.durationMs,
            }
          : s
      ));
      // Accumulate tokens
      setTotalTokens(prev => prev + (data.tokensUsed ?? 0));
      // Accumulate risk flags
      if (data.warnings?.length > 0) {
        setRiskFlags(prev => [...prev, ...data.warnings.map((w: string) => `[${data.agentName}] ${w}`)]);
      }
      // Auto-select this step in the dossier panel
      setSelectedStep(data.stepIndex);
    });

    es.addEventListener("step_failed", (e) => {
      const data = JSON.parse(e.data);
      setAgentStates(prev => prev.map(s =>
        s.stepIndex === data.stepIndex ? { ...s, status: "failed", error: data.error } : s
      ));
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setIsRunning(false);
      setIsComplete(true);
      setTotalDurationMs(data.durationMs ?? null);
      setTotalTokens(data.totalTokens ?? 0);
      es.close();
      esRef.current = null;
    });

    es.addEventListener("failed", (e) => {
      const data = JSON.parse(e.data);
      setIsRunning(false);
      setIsFailed(true);
      setPipelineError(data.message ?? "Pipeline failed");
      es.close();
      esRef.current = null;
    });

    es.addEventListener("error", (e: any) => {
      // SSE connection error (network drop etc.)
      const data = e.data ? JSON.parse(e.data) : {};
      if (data.code === "FORBIDDEN") {
        navigate("/beta-access");
        return;
      }
      setIsRunning(false);
      setIsFailed(true);
      setPipelineError(data.message ?? "Connection error");
      es.close();
      esRef.current = null;
    });
  }, [user, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleStart() {
    if (!caseText.trim() || isRunning) return;

    // Resolve input text: if vault doc selected, use its extracted text
    let inputText = caseText;
    if (inputMode === "vault" && selectedVaultDocId && vaultDocs) {
      const doc = vaultDocs.find(d => d.id === selectedVaultDocId);
      if (doc?.extractedText) inputText = doc.extractedText;
    }
    if (!inputText.trim()) return;

    const sid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    setSessionId(sid);
    setIsRunning(true);
    setIsComplete(false);
    setIsFailed(false);
    setPipelineError(null);
    setShowInput(false);
    setSelectedStep(null);
    setTotalTokens(0);
    setRiskFlags([]);
    setElapsedMs(0);
    setTotalDurationMs(null);
    setAgentStates(PIPELINE_AGENTS.map((a, i) => ({ stepIndex: i, agentName: a.name, status: "pending" })));

    startSSE(sid, inputText);
  }

  function handleReset() {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setSessionId(null);
    setIsRunning(false);
    setIsComplete(false);
    setIsFailed(false);
    setPipelineError(null);
    setShowInput(true);
    setSelectedStep(null);
    setCaseText("");
    setTotalTokens(0);
    setRiskFlags([]);
    setElapsedMs(0);
    setTotalDurationMs(null);
    setAgentStates(PIPELINE_AGENTS.map((a, i) => ({ stepIndex: i, agentName: a.name, status: "pending" })));
  }

  // ── Derived display ───────────────────────────────────────────────────────

  const displayTime = totalDurationMs
    ? `${(totalDurationMs / 1000).toFixed(1)}s`
    : isRunning ? `${(elapsedMs / 1000).toFixed(1)}s` : "—";

  const pipelineDisplay = PIPELINE_AGENTS.map((def, i) => {
    const live = agentStates[i];
    return { ...def, ...live };
  });

  const selectedAgent = selectedStep !== null ? pipelineDisplay[selectedStep] : null;

  // ── Auth guard ────────────────────────────────────────────────────────────

  if (authLoading || accessLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050D1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(56,189,248,0.3)", borderTopColor: "#38BDF8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#050D1A",
      fontFamily: "Inter, sans-serif", color: "#F0F4FA",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow    { 0%,100% { box-shadow: 0 0 8px currentColor; } 50% { box-shadow: 0 0 20px currentColor; } }
        @keyframes commitFlash { 0% { background: rgba(74,222,128,0.2); } 100% { background: transparent; } }
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{
        height: 52, background: "rgba(5,13,26,0.95)", borderBottom: "1px solid rgba(56,189,248,0.1)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/")} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(240,244,250,0.4)", fontSize: 12, fontFamily: "Inter, sans-serif",
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L3 6L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mesh
          </button>
          <span style={{ color: "rgba(240,244,250,0.15)" }}>›</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#38BDF8", letterSpacing: "0.08em" }}>ROSIE PROTOCOL</span>
          <div style={{
            background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: 10, padding: "2px 8px", fontSize: 10, color: "#38BDF8", letterSpacing: "0.06em",
          }}>
            6 AGENTS · LIVE STREAM
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "rgba(240,244,250,0.4)" }}>
            <span>⏱ {displayTime}</span>
            <span>🔢 {totalTokens.toLocaleString()} tokens</span>
            {riskFlags.length > 0 && (
              <span style={{ color: "#FBBF24" }}>⚠ {riskFlags.length} flags</span>
            )}
          </div>
          {isComplete && sessionId && (
            <button
              onClick={() => generatePdf.mutate({ sessionId })}
              disabled={generatePdf.isPending}
              style={{
                background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)",
                borderRadius: 6, padding: "5px 12px", color: "#D4AF37",
                fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif",
              }}
            >
              {generatePdf.isPending ? "Generating PDF…" : "⬇ Export Dossier PDF"}
            </button>
          )}
          {(isComplete || isFailed) && (
            <button onClick={handleReset} style={{
              background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
              borderRadius: 6, padding: "5px 12px", color: "#38BDF8",
              fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif",
            }}>
              New Run
            </button>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Workflow Rail ── */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(56,189,248,0.08)",
          background: "rgba(5,13,26,0.6)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
            {pipelineDisplay.map((agent, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                {/* Agent node */}
                <button
                  onClick={() => agent.summary && setSelectedStep(i)}
                  style={{
                    background: selectedStep === i
                      ? `rgba(${hexToRgb(agent.color)}, 0.12)`
                      : agent.status === "complete"
                      ? "rgba(10,22,40,0.95)"
                      : "rgba(10,22,40,0.8)",
                    border: `1px solid ${selectedStep === i ? agent.color : statusColor(agent.status)}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: agent.summary ? "pointer" : "default",
                    textAlign: "left",
                    minWidth: 140,
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden",
                    animation: agent.status === "complete" ? "commitFlash 0.6s ease" : "none",
                  }}
                >
                  {/* Pulse animation for running */}
                  {agent.status === "running" && (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: `rgba(${hexToRgb(agent.color)}, 0.05)`,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{agent.icon}</span>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: statusColor(agent.status),
                      boxShadow: agent.status === "running" ? `0 0 8px ${statusColor(agent.status)}` : "none",
                      animation: agent.status === "running" ? "glow 1.5s ease-in-out infinite" : "none",
                      flexShrink: 0,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#F0F4FA", marginBottom: 2 }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(240,244,250,0.4)" }}>{agent.role}</div>
                  <div style={{ marginTop: 6, fontSize: 10, color: statusColor(agent.status) }}>
                    {statusLabel(agent.status)}
                    {agent.status === "complete" && agent.confidenceLevel !== undefined && (
                      <span style={{ marginLeft: 6, color: "rgba(240,244,250,0.3)" }}>{agent.confidenceLevel}%</span>
                    )}
                  </div>
                  {(agent.warnings?.length ?? 0) > 0 && (
                    <div style={{
                      position: "absolute", top: 6, right: 6,
                      background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)",
                      borderRadius: 8, padding: "1px 5px", fontSize: 9, color: "#FBBF24",
                    }}>
                      ⚠ {agent.warnings!.length}
                    </div>
                  )}
                </button>

                {/* Connector */}
                {i < pipelineDisplay.length - 1 && (
                  <div style={{
                    width: 32, height: 2,
                    background: `linear-gradient(90deg, ${statusColor(agent.status)}, ${statusColor(pipelineDisplay[i+1].status)})`,
                    opacity: agent.status === "complete" ? 0.7 : 0.2,
                    flexShrink: 0, position: "relative",
                  }}>
                    <div style={{
                      position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)",
                      width: 0, height: 0,
                      borderLeft: `6px solid ${statusColor(agent.status)}`,
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                      opacity: agent.status === "complete" ? 0.7 : 0.2,
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content Area ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Left: Input / Dossier ── */}
          <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

            {/* Input panel */}
            {showInput && !sessionId && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <div style={{
                  background: "rgba(10,22,40,0.8)",
                  border: "1px solid rgba(56,189,248,0.12)",
                  borderRadius: 14, padding: 32,
                }}>
                  <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F0F4FA", margin: "0 0 8px" }}>
                      Rosie Protocol
                    </h2>
                    <p style={{ fontSize: 13, color: "rgba(240,244,250,0.45)", margin: 0, lineHeight: 1.6 }}>
                      A 6-agent sequential pipeline for cancer treatment research. Each agent builds on the previous one's output using shared blackboard memory. Results stream live as each agent completes.
                    </p>
                  </div>

                  <div style={{
                    background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 20,
                    fontSize: 12, color: "rgba(251,191,36,0.8)", lineHeight: 1.6,
                  }}>
                    ⚠ <strong>Research Use Only.</strong> All outputs require review by qualified oncologist, molecular biologist, and clinical pharmacologist before any clinical application.
                  </div>

                  {/* Input mode tabs */}
                  <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                    {(["text", "vault", "upload"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setInputMode(mode)}
                        style={{
                          padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          fontFamily: "Inter, sans-serif", cursor: "pointer",
                          background: inputMode === mode ? "rgba(56,189,248,0.15)" : "transparent",
                          border: `1px solid ${inputMode === mode ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.1)"}`,
                          color: inputMode === mode ? "#38BDF8" : "rgba(240,244,250,0.4)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {mode === "text" ? "✏️ Type / Paste" : mode === "vault" ? "🗄️ Vault Document" : "📎 Upload File"}
                      </button>
                    ))}
                  </div>

                  {/* Text input mode */}
                  {inputMode === "text" && (
                    <>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(240,244,250,0.4)", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
                        Clinical Case / Research Query
                      </label>
                      <textarea
                        value={caseText}
                        onChange={e => setCaseText(e.target.value)}
                        placeholder="Example: 58-year-old female with stage IIIB non-small cell lung cancer (NSCLC), EGFR exon 19 deletion positive, PD-L1 40%. Previous treatment with erlotinib for 14 months before progression. Current ECOG PS 1. Seeking analysis of second-line options and emerging combination strategies..."
                        rows={8}
                        style={{
                          width: "100%", padding: "12px 16px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(56,189,248,0.15)",
                          borderRadius: 10, color: "#F0F4FA",
                          fontSize: 14, fontFamily: "Inter, sans-serif",
                          resize: "vertical", outline: "none", lineHeight: 1.6,
                          boxSizing: "border-box",
                        }}
                      />
                    </>
                  )}

                  {/* Vault document selector */}
                  {inputMode === "vault" && (
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(240,244,250,0.4)", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
                        Select from Document Vault
                      </label>
                      {vaultLoading ? (
                        <div style={{ fontSize: 13, color: "rgba(240,244,250,0.3)", padding: 16 }}>Loading vault documents…</div>
                      ) : !vaultDocs?.length ? (
                        <div style={{
                          padding: 20, textAlign: "center",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px dashed rgba(56,189,248,0.15)",
                          borderRadius: 10, fontSize: 13, color: "rgba(240,244,250,0.3)",
                        }}>
                          No documents in your Vault yet.<br/>
                          <span style={{ fontSize: 12, color: "rgba(56,189,248,0.5)" }}>Upload documents at <a href="/vault" style={{ color: "#38BDF8" }}>/vault</a> first, or use the Upload tab.</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                          {vaultDocs.map(doc => (
                            <button
                              key={doc.id}
                              onClick={() => { setSelectedVaultDocId(doc.id); setCaseText(doc.extractedText ?? ""); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 14px", borderRadius: 8, textAlign: "left",
                                background: selectedVaultDocId === doc.id ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.02)",
                                border: `1px solid ${selectedVaultDocId === doc.id ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.08)"}`,
                                cursor: "pointer", fontFamily: "Inter, sans-serif",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span style={{ fontSize: 18 }}>📄</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#F0F4FA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {doc.filename}
                                </div>
                                <div style={{ fontSize: 11, color: "rgba(240,244,250,0.35)", marginTop: 2 }}>
                                  {doc.extractedText ? `${doc.extractedText.length.toLocaleString()} chars extracted` : "No text extracted"}
                                  {doc.createdAt && ` · ${new Date(doc.createdAt).toLocaleDateString()}`}
                                </div>
                              </div>
                              {selectedVaultDocId === doc.id && (
                                <span style={{ color: "#38BDF8", fontSize: 14, flexShrink: 0 }}>✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedVaultDocId && caseText && (
                        <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 8, fontSize: 11, color: "rgba(56,189,248,0.7)" }}>
                          ✓ {caseText.length.toLocaleString()} characters loaded from vault document
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload new file */}
                  {inputMode === "upload" && (
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(240,244,250,0.4)", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
                        Upload Document
                      </label>
                      <input
                        ref={uploadInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt,.md,.json,.pptx"
                        style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleVaultUpload(f); }}
                      />
                      {!uploadedFileName ? (
                        <div
                          onClick={() => uploadInputRef.current?.click()}
                          style={{
                            padding: 32, textAlign: "center",
                            background: "rgba(255,255,255,0.02)",
                            border: "2px dashed rgba(56,189,248,0.2)",
                            borderRadius: 10, cursor: "pointer",
                            transition: "border-color 0.15s ease",
                          }}
                        >
                          {uploadVaultDoc.isPending ? (
                            <>
                              <div style={{ width: 32, height: 32, border: "2px solid rgba(56,189,248,0.2)", borderTopColor: "#38BDF8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                              <div style={{ fontSize: 13, color: "rgba(240,244,250,0.4)" }}>Uploading and extracting text…</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(240,244,250,0.6)", marginBottom: 4 }}>Click to upload a document</div>
                              <div style={{ fontSize: 12, color: "rgba(240,244,250,0.3)" }}>PDF, DOCX, TXT, PPTX — text will be extracted and passed to the Intake Agent</div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: "12px 16px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#4ADE80", marginBottom: 4 }}>✓ {uploadedFileName}</div>
                          <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)" }}>{caseText.length.toLocaleString()} characters extracted · Ready for pipeline</div>
                          <button
                            onClick={() => { setUploadedFileName(null); setCaseText(""); setSelectedVaultDocId(null); uploadInputRef.current && (uploadInputRef.current.value = ""); }}
                            style={{ marginTop: 8, fontSize: 11, color: "rgba(240,244,250,0.3)", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                    <span style={{ fontSize: 12, color: "rgba(240,244,250,0.3)" }}>
                      {caseText.length} chars · Results stream live as each agent completes
                    </span>
                    <button
                      onClick={handleStart}
                      disabled={!caseText.trim() || isRunning}
                      style={{
                        padding: "11px 24px",
                        background: caseText.trim() ? "linear-gradient(135deg, #38BDF8, #0EA5E9)" : "rgba(56,189,248,0.2)",
                        border: "none", borderRadius: 8,
                        color: caseText.trim() ? "#050D1A" : "rgba(240,244,250,0.3)",
                        fontSize: 14, fontWeight: 700, cursor: caseText.trim() ? "pointer" : "not-allowed",
                        fontFamily: "Inter, sans-serif", letterSpacing: "0.02em",
                      }}
                    >
                      Run Rosie Protocol →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Running — waiting for first agent */}
            {isRunning && agentStates.every(s => s.status === "pending") && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <div style={{
                  background: "rgba(10,22,40,0.8)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: 14, padding: 40, textAlign: "center",
                }}>
                  <div style={{
                    width: 48, height: 48,
                    border: "2px solid rgba(56,189,248,0.2)",
                    borderTopColor: "#38BDF8", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 20px",
                  }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F0F4FA", margin: "0 0 8px" }}>
                    Connecting to pipeline…
                  </h3>
                  <p style={{ fontSize: 13, color: "rgba(240,244,250,0.4)", margin: 0 }}>
                    Dispatching 6 agents in strict sequential order
                  </p>
                </div>
              </div>
            )}

            {/* Live dossier — show each agent as it completes */}
            {pipelineDisplay.filter(a => a.status === "complete" || a.status === "failed").map((agent, _) => (
              (selectedStep === null || selectedStep === agent.stepIndex) && (
                <div key={agent.stepIndex} style={{ animation: "slideIn 0.4s ease", maxWidth: 720, marginBottom: 16 }}>
                  <AgentDossier agent={agent} />
                </div>
              )
            ))}

            {/* Selected agent detail when clicking rail */}
            {selectedStep !== null && pipelineDisplay[selectedStep]?.summary && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <AgentDossier agent={pipelineDisplay[selectedStep]} />
              </div>
            )}

            {/* Final dossier */}
            {isComplete && selectedStep === null && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <FinalDossier agentStates={agentStates} riskFlags={riskFlags} />
              </div>
            )}

            {/* Error state */}
            {isFailed && (
              <div style={{
                background: "rgba(248,113,113,0.05)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 14, padding: 28, maxWidth: 720,
                animation: "slideIn 0.3s ease",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F87171", margin: "0 0 8px" }}>
                  Pipeline Failed
                </h3>
                <p style={{ fontSize: 13, color: "rgba(240,244,250,0.5)", margin: "0 0 16px" }}>
                  {pipelineError || "An unexpected error occurred."}
                </p>
                <button
                  onClick={handleReset}
                  style={{
                    padding: "9px 20px",
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: 8, color: "#F87171",
                    fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  }}
                >
                  Start New Run
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Side Panel ── */}
          <div style={{
            width: 280, flexShrink: 0,
            borderLeft: "1px solid rgba(56,189,248,0.08)",
            background: "rgba(5,13,26,0.6)",
            overflow: "auto", padding: 20,
          }}>
            {/* Pipeline progress */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                Pipeline Progress
              </div>
              {pipelineDisplay.map((agent, i) => (
                <div
                  key={i}
                  onClick={() => agent.summary && setSelectedStep(selectedStep === i ? null : i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8, marginBottom: 4,
                    cursor: agent.summary ? "pointer" : "default",
                    background: selectedStep === i ? "rgba(56,189,248,0.08)" : "transparent",
                    transition: "background 0.15s ease",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: `rgba(${hexToRgb(agent.color)}, 0.1)`,
                    border: `1px solid ${statusColor(agent.status)}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10,
                  }}>
                    {agent.status === "complete" ? "✓" : agent.status === "failed" ? "✗" : agent.status === "running" ? "…" : String(i + 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#F0F4FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 10, color: statusColor(agent.status) }}>
                      {statusLabel(agent.status)}
                      {agent.durationMs && <span style={{ color: "rgba(240,244,250,0.3)", marginLeft: 4 }}>{(agent.durationMs / 1000).toFixed(1)}s</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Token usage */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                Token Usage
              </div>
              {pipelineDisplay.filter(a => (a.tokensUsed ?? 0) > 0).map((agent, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(240,244,250,0.4)", marginBottom: 3 }}>
                    <span>{agent.name}</span>
                    <span>{(agent.tokensUsed ?? 0).toLocaleString()}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: agent.color,
                      width: `${Math.min(100, ((agent.tokensUsed ?? 0) / Math.max(totalTokens, 1)) * 100)}%`,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
              ))}
              {totalTokens > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "rgba(240,244,250,0.5)", display: "flex", justifyContent: "space-between" }}>
                  <span>Total</span>
                  <span style={{ color: "#38BDF8", fontWeight: 700 }}>{totalTokens.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Risk flags */}
            {riskFlags.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
                  Risk Flags ({riskFlags.length})
                </div>
                {riskFlags.slice(0, 8).map((flag, i) => (
                  <div key={i} style={{
                    fontSize: 11, color: "rgba(251,191,36,0.8)", lineHeight: 1.5,
                    padding: "6px 8px", background: "rgba(251,191,36,0.05)",
                    border: "1px solid rgba(251,191,36,0.1)", borderRadius: 6, marginBottom: 6,
                  }}>
                    {flag.length > 100 ? flag.slice(0, 100) + "…" : flag}
                  </div>
                ))}
                {riskFlags.length > 8 && (
                  <div style={{ fontSize: 11, color: "rgba(240,244,250,0.3)" }}>+{riskFlags.length - 8} more flags</div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div style={{
              marginTop: 24, padding: "10px 12px",
              background: "rgba(248,113,113,0.04)",
              border: "1px solid rgba(248,113,113,0.1)",
              borderRadius: 8, fontSize: 10, color: "rgba(240,244,250,0.3)", lineHeight: 1.6,
            }}>
              Research Use Only. Not Medical Advice. Requires review by qualified professionals before any clinical application.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Agent Dossier Card ────────────────────────────────────────────────────────

function AgentDossier({ agent }: { agent: any }) {
  const def = PIPELINE_AGENTS[agent.stepIndex] ?? PIPELINE_AGENTS[0];
  if (!agent.summary) return null;

  return (
    <div style={{
      background: "rgba(10,22,40,0.8)",
      border: `1px solid rgba(${hexToRgb(def.color)}, 0.2)`,
      borderRadius: 14, padding: 28, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{def.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F4FA" }}>{agent.agentName}</div>
          <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)" }}>{def.role}</div>
        </div>
        {agent.confidenceLevel !== undefined && (
          <div style={{
            marginLeft: "auto",
            background: `rgba(${hexToRgb(def.color)}, 0.1)`,
            border: `1px solid rgba(${hexToRgb(def.color)}, 0.2)`,
            borderRadius: 8, padding: "4px 10px",
            fontSize: 12, color: def.color, fontWeight: 700,
          }}>
            {agent.confidenceLevel}% confidence
          </div>
        )}
      </div>

      {agent.summary && (
        <p style={{ fontSize: 14, color: "rgba(240,244,250,0.75)", lineHeight: 1.7, margin: "0 0 16px" }}>
          {agent.summary}
        </p>
      )}

      {agent.entities && Object.keys(agent.entities).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {Object.entries(agent.entities).map(([key, values]: [string, any]) => (
            Array.isArray(values) && values.length > 0 && (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {values.slice(0, 8).map((v: string, i: number) => (
                    <span key={i} style={{
                      background: `rgba(${hexToRgb(def.color)}, 0.08)`,
                      border: `1px solid rgba(${hexToRgb(def.color)}, 0.2)`,
                      borderRadius: 6, padding: "3px 8px",
                      fontSize: 11, color: "rgba(240,244,250,0.7)",
                    }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {agent.warnings && agent.warnings.length > 0 && (
        <div style={{
          background: "rgba(251,191,36,0.05)",
          border: "1px solid rgba(251,191,36,0.15)",
          borderRadius: 8, padding: "10px 14px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#FBBF24", letterSpacing: "0.08em", marginBottom: 6 }}>WARNINGS</div>
          {agent.warnings.map((w: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: "rgba(251,191,36,0.7)", lineHeight: 1.5, marginBottom: 2 }}>• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Final Dossier ─────────────────────────────────────────────────────────────

function FinalDossier({ agentStates, riskFlags }: { agentStates: LiveAgentState[]; riskFlags: string[] }) {
  const validationAgent = agentStates.find(s => s.stepIndex === 5);

  return (
    <div style={{
      background: "rgba(10,22,40,0.9)",
      border: "1px solid rgba(74,222,128,0.2)",
      borderRadius: 14, padding: 32,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(74,222,128,0.1)",
          border: "1px solid rgba(74,222,128,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
        }}>✓</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#F0F4FA" }}>Clinical Dossier Complete</div>
          <div style={{ fontSize: 12, color: "rgba(240,244,250,0.4)" }}>All 6 agents completed · Click any agent in the rail to review individual outputs</div>
        </div>
      </div>

      {validationAgent?.summary && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Validation Summary</div>
          <p style={{ fontSize: 14, color: "rgba(240,244,250,0.75)", lineHeight: 1.7, margin: 0 }}>
            {validationAgent.summary}
          </p>
        </div>
      )}

      {riskFlags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Accumulated Risk Flags</div>
          {riskFlags.slice(0, 5).map((f, i) => (
            <div key={i} style={{
              fontSize: 12, color: "rgba(251,191,36,0.7)", lineHeight: 1.5,
              padding: "6px 10px", background: "rgba(251,191,36,0.04)",
              border: "1px solid rgba(251,191,36,0.1)", borderRadius: 6, marginBottom: 4,
            }}>• {f}</div>
          ))}
        </div>
      )}

      <div style={{
        padding: "12px 16px",
        background: "rgba(248,113,113,0.05)",
        border: "1px solid rgba(248,113,113,0.15)",
        borderRadius: 8, fontSize: 12, color: "rgba(248,113,113,0.7)", lineHeight: 1.6,
      }}>
        <strong>Mandatory Disclaimer:</strong> Research Use Only. Not Medical Advice. This dossier requires review by a qualified oncologist, molecular biologist, and clinical pharmacologist before any clinical application. AgenThink Mesh and its agents do not provide medical diagnosis or treatment recommendations.
      </div>
    </div>
  );
}
