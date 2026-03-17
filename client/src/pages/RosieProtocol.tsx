import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentStep {
  stepIndex: number;
  agentName: string;
  agentRole: string | null;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  confidenceLevel: number | null;
  warningCount: number;
  tokensUsed: number;
  durationMs: number | null;
  structuredOutput: any | null;
  errorMessage: string | null;
}

const PIPELINE_AGENTS = [
  { name: "Intake Agent", role: "Case Parser", icon: "📋", color: "#38BDF8" },
  { name: "Research Agent", role: "Literature Analyst", icon: "🔬", color: "#A78BFA" },
  { name: "Mutation Agent", role: "Target Identifier", icon: "🧬", color: "#34D399" },
  { name: "Structural Agent", role: "Binding Analyst", icon: "⚗️", color: "#FB923C" },
  { name: "Therapeutic Agent", role: "Intervention Strategist", icon: "💊", color: "#F472B6" },
  { name: "Validation Agent", role: "Risk & Quality Reviewer", icon: "✅", color: "#FBBF24" },
];

// ── Status helpers ────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "complete": return "#4ADE80";
    case "running": return "#38BDF8";
    case "failed": return "#F87171";
    case "skipped": return "#6B7280";
    default: return "rgba(240,244,250,0.2)";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "complete": return "Complete";
    case "running": return "Running…";
    case "failed": return "Failed";
    case "skipped": return "Skipped";
    default: return "Pending";
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RosieProtocol() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [caseText, setCaseText] = useState("");
  const [showInput, setShowInput] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Access check
  const { data: accessData, isLoading: accessLoading } = trpc.workflow.checkAccess.useQuery(undefined, {
    enabled: !!user,
  });

  // PDF export
  const generatePdf = trpc.dossier.generate.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
  });

  // Poll run status
  const { data: statusData, refetch: refetchStatus } = trpc.workflow.getStatus.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: sessionId ? 3000 : false }
  );

  // Start mutation
  const startMutation = trpc.workflow.start.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    },
    onError: (err) => {
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (err.message.includes("FORTRESS_GATEWAY")) {
        navigate("/beta-access");
      }
    },
  });

  // Retry mutation
  const retryMutation = trpc.workflow.retryStep.useMutation({
    onSuccess: () => refetchStatus(),
  });

  // Timer
  useEffect(() => {
    if (isRunning) {
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - start), 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // Auto-select last completed step
  useEffect(() => {
    if (!statusData) return;
    const lastComplete = [...statusData.steps].reverse().find(s => s.status === "complete");
    if (lastComplete && selectedStep === null) setSelectedStep(lastComplete.stepIndex);
  }, [statusData]);

  function handleStart() {
    if (!caseText.trim()) return;
    setIsRunning(true);
    setShowInput(false);
    setSessionId(null);
    setSelectedStep(null);
    setElapsedMs(0);
    startMutation.mutate({
      workflowType: "rosie_protocol",
      sourceDocuments: [{ fileName: "Case Input", extractedText: caseText }],
    });
  }

  function handleReset() {
    setSessionId(null);
    setIsRunning(false);
    setShowInput(true);
    setSelectedStep(null);
    setCaseText("");
    setElapsedMs(0);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const run = statusData?.run;
  const steps: AgentStep[] = statusData?.steps ?? [];
  const blackboard = statusData?.blackboard;
  const isComplete = run?.status === "complete";
  const isFailed = run?.status === "failed";
  const totalTokens = blackboard?.tokenUsage ?? 0;
  const riskFlags = blackboard?.riskFlags ?? [];
  const displayTime = run?.durationMs
    ? `${(run.durationMs / 1000).toFixed(1)}s`
    : isRunning ? `${(elapsedMs / 1000).toFixed(1)}s` : "—";

  // Build pipeline display (merge definition with live step data)
  const pipelineDisplay = PIPELINE_AGENTS.map((def, i) => {
    const live = steps.find(s => s.stepIndex === i);
    return {
      ...def,
      stepIndex: i,
      status: live?.status ?? (isRunning && i === (run?.currentStep ?? 0) ? "running" : "pending"),
      confidenceLevel: live?.confidenceLevel ?? null,
      warningCount: live?.warningCount ?? 0,
      tokensUsed: live?.tokensUsed ?? 0,
      durationMs: live?.durationMs ?? null,
      structuredOutput: live?.structuredOutput ?? null,
      errorMessage: live?.errorMessage ?? null,
    };
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
      minHeight: "100vh",
      background: "#050D1A",
      fontFamily: "Inter, sans-serif",
      color: "#F0F4FA",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 8px currentColor; } 50% { box-shadow: 0 0 20px currentColor; } }
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
            6 AGENTS · SEQUENTIAL
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Metrics bar */}
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
              <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {/* Agent node */}
                <button
                  onClick={() => agent.structuredOutput && setSelectedStep(i)}
                  style={{
                    background: selectedStep === i
                      ? `rgba(${hexToRgb(agent.color)}, 0.12)`
                      : "rgba(10,22,40,0.8)",
                    border: `1px solid ${selectedStep === i ? agent.color : statusColor(agent.status)}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: agent.structuredOutput ? "pointer" : "default",
                    textAlign: "left",
                    minWidth: 140,
                    transition: "all 0.2s ease",
                    position: "relative",
                    overflow: "hidden",
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
                    {agent.status === "complete" && agent.confidenceLevel !== null && (
                      <span style={{ marginLeft: 6, color: "rgba(240,244,250,0.3)" }}>{agent.confidenceLevel}%</span>
                    )}
                  </div>
                  {agent.warningCount > 0 && (
                    <div style={{
                      position: "absolute", top: 6, right: 6,
                      background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)",
                      borderRadius: 8, padding: "1px 5px", fontSize: 9, color: "#FBBF24",
                    }}>
                      ⚠ {agent.warningCount}
                    </div>
                  )}
                </button>

                {/* Connector */}
                {i < pipelineDisplay.length - 1 && (
                  <div style={{
                    width: 32, height: 2,
                    background: `linear-gradient(90deg, ${statusColor(agent.status)}, ${statusColor(pipelineDisplay[i+1].status)})`,
                    opacity: agent.status === "complete" ? 0.7 : 0.2,
                    flexShrink: 0,
                    position: "relative",
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
                      A 6-agent sequential pipeline for cancer treatment research. Each agent builds on the previous one's output using shared blackboard memory. Paste a clinical case or research query below.
                    </p>
                  </div>

                  <div style={{
                    background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 20,
                    fontSize: 12, color: "rgba(251,191,36,0.8)", lineHeight: 1.6,
                  }}>
                    ⚠ <strong>Research Use Only.</strong> All outputs require review by qualified oncologist, molecular biologist, and clinical pharmacologist before any clinical application.
                  </div>

                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "rgba(240,244,250,0.4)", letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
                    Clinical Case / Research Query
                  </label>
                  <textarea
                    value={caseText}
                    onChange={e => setCaseText(e.target.value)}
                    placeholder="Example: 58-year-old female with stage IIIB non-small cell lung cancer (NSCLC), EGFR exon 19 deletion positive, PD-L1 40%. Previous treatment with erlotinib for 14 months before progression. Current ECOG PS 1. Seeking analysis of second-line options and emerging combination strategies..."
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(56,189,248,0.15)",
                      borderRadius: 10,
                      color: "#F0F4FA",
                      fontSize: 14,
                      fontFamily: "Inter, sans-serif",
                      resize: "vertical",
                      outline: "none",
                      lineHeight: 1.6,
                      boxSizing: "border-box",
                    }}
                  />

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                    <span style={{ fontSize: 12, color: "rgba(240,244,250,0.3)" }}>
                      {caseText.length} chars · Est. 4–6 min pipeline run
                    </span>
                    <button
                      onClick={handleStart}
                      disabled={!caseText.trim() || isRunning}
                      style={{
                        padding: "11px 24px",
                        background: caseText.trim() ? "linear-gradient(135deg, #38BDF8, #0EA5E9)" : "rgba(56,189,248,0.2)",
                        border: "none",
                        borderRadius: 8,
                        color: caseText.trim() ? "#050D1A" : "rgba(240,244,250,0.3)",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: caseText.trim() ? "pointer" : "not-allowed",
                        fontFamily: "Inter, sans-serif",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Run Rosie Protocol →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Running state */}
            {isRunning && !sessionId && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <div style={{
                  background: "rgba(10,22,40,0.8)",
                  border: "1px solid rgba(56,189,248,0.2)",
                  borderRadius: 14, padding: 40, textAlign: "center",
                }}>
                  <div style={{
                    width: 48, height: 48,
                    border: "2px solid rgba(56,189,248,0.2)",
                    borderTopColor: "#38BDF8",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 20px",
                  }} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F0F4FA", margin: "0 0 8px" }}>
                    Initialising Pipeline…
                  </h3>
                  <p style={{ fontSize: 13, color: "rgba(240,244,250,0.4)", margin: "0 0 16px" }}>
                    Dispatching 6 agents in strict sequential order
                  </p>
                  <div style={{ fontSize: 12, color: "#38BDF8", fontFamily: "JetBrains Mono, monospace" }}>
                    {(elapsedMs / 1000).toFixed(1)}s elapsed
                  </div>
                </div>
              </div>
            )}

            {/* Dossier — agent output detail */}
            {selectedAgent?.structuredOutput && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <AgentDossier agent={selectedAgent} />
              </div>
            )}

            {/* Final dossier */}
            {isComplete && steps.length === 6 && selectedStep === null && (
              <div style={{ animation: "slideIn 0.3s ease", maxWidth: 720 }}>
                <FinalDossier steps={steps} blackboard={blackboard} />
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
                  Pipeline Failed at Step {(run?.failedAtStep ?? 0) + 1}
                </h3>
                <p style={{ fontSize: 13, color: "rgba(240,244,250,0.5)", margin: "0 0 16px" }}>
                  {run?.failureReason || "An unexpected error occurred."}
                </p>
                <button
                  onClick={() => sessionId && retryMutation.mutate({ sessionId })}
                  disabled={retryMutation.isPending}
                  style={{
                    padding: "9px 20px",
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: 8, color: "#F87171",
                    fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  }}
                >
                  {retryMutation.isPending ? "Retrying…" : `Retry from Step ${(run?.failedAtStep ?? 0) + 1} →`}
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
                  onClick={() => agent.structuredOutput && setSelectedStep(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8, marginBottom: 4,
                    cursor: agent.structuredOutput ? "pointer" : "default",
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
              {pipelineDisplay.filter(a => a.tokensUsed > 0).map((agent, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(240,244,250,0.4)", marginBottom: 3 }}>
                    <span>{agent.name}</span>
                    <span>{agent.tokensUsed.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: agent.color,
                      width: `${Math.min(100, (agent.tokensUsed / Math.max(totalTokens, 1)) * 100)}%`,
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
                {riskFlags.slice(0, 8).map((flag: string, i: number) => (
                  <div key={i} style={{
                    fontSize: 11, color: "rgba(251,191,36,0.8)", lineHeight: 1.5,
                    padding: "6px 8px", background: "rgba(251,191,36,0.05)",
                    border: "1px solid rgba(251,191,36,0.1)", borderRadius: 6,
                    marginBottom: 6,
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
  const out = agent.structuredOutput;
  if (!out) return null;

  return (
    <div style={{
      background: "rgba(10,22,40,0.8)",
      border: `1px solid rgba(${hexToRgb(agent.color)}, 0.2)`,
      borderRadius: 14, padding: 28,
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{agent.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F4FA" }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: "rgba(240,244,250,0.4)" }}>{agent.role}</div>
        </div>
        {out.confidenceLevel !== undefined && (
          <div style={{
            marginLeft: "auto",
            background: `rgba(${hexToRgb(agent.color)}, 0.1)`,
            border: `1px solid rgba(${hexToRgb(agent.color)}, 0.2)`,
            borderRadius: 8, padding: "4px 10px",
            fontSize: 12, color: agent.color, fontWeight: 700,
          }}>
            {out.confidenceLevel}% confidence
          </div>
        )}
      </div>

      {out.summary && (
        <p style={{ fontSize: 14, color: "rgba(240,244,250,0.75)", lineHeight: 1.7, margin: "0 0 16px" }}>
          {out.summary}
        </p>
      )}

      {out.entities && Object.keys(out.entities).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {Object.entries(out.entities).map(([key, values]: [string, any]) => (
            Array.isArray(values) && values.length > 0 && (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {values.slice(0, 8).map((v: string, i: number) => (
                    <span key={i} style={{
                      background: `rgba(${hexToRgb(agent.color)}, 0.08)`,
                      border: `1px solid rgba(${hexToRgb(agent.color)}, 0.2)`,
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

      {out.warnings && out.warnings.length > 0 && (
        <div style={{
          background: "rgba(251,191,36,0.05)",
          border: "1px solid rgba(251,191,36,0.15)",
          borderRadius: 8, padding: "10px 14px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#FBBF24", letterSpacing: "0.08em", marginBottom: 6 }}>WARNINGS</div>
          {out.warnings.map((w: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: "rgba(251,191,36,0.7)", lineHeight: 1.5, marginBottom: 2 }}>• {w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Final Dossier ─────────────────────────────────────────────────────────────

function FinalDossier({ steps, blackboard }: { steps: AgentStep[]; blackboard: any }) {
  const validationStep = steps.find(s => s.stepIndex === 5);
  const finalOutput = validationStep?.structuredOutput;

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

      {finalOutput?.finalDossier && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Key Conclusion</div>
            <p style={{ fontSize: 14, color: "rgba(240,244,250,0.75)", lineHeight: 1.7, margin: 0 }}>
              {finalOutput.finalDossier.keyConclusion}
            </p>
          </div>

          {finalOutput.finalDossier.immediateNextSteps?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Immediate Next Steps</div>
              {finalOutput.finalDossier.immediateNextSteps.map((step: string, i: number) => (
                <div key={i} style={{
                  display: "flex", gap: 10, marginBottom: 8,
                  padding: "8px 12px",
                  background: "rgba(74,222,128,0.04)",
                  border: "1px solid rgba(74,222,128,0.1)",
                  borderRadius: 8,
                }}>
                  <span style={{ color: "#4ADE80", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ fontSize: 13, color: "rgba(240,244,250,0.7)", lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {finalOutput.finalDossier.requiredExpertise?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(240,244,250,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Required Expert Review</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {finalOutput.finalDossier.requiredExpertise.map((exp: string, i: number) => (
                  <span key={i} style={{
                    background: "rgba(56,189,248,0.08)",
                    border: "1px solid rgba(56,189,248,0.2)",
                    borderRadius: 6, padding: "4px 10px",
                    fontSize: 12, color: "#38BDF8",
                  }}>{exp}</span>
                ))}
              </div>
            </div>
          )}
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

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
