import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentOutput {
  agentId: string;
  status: "pending" | "running" | "complete" | "escalated" | "error";
  output: Record<string, unknown> | null;
  alerts: string[];
  completedAt?: number;
}

interface LeadershipAlert {
  agentId: string;
  agentName: string;
  level: "critical" | "high";
  message: string;
  timestamp: number;
}

// ── Agent Definitions ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: "financial-sentinel",
    name: "Financial Sentinel",
    icon: "💰",
    description: "Cash runway · Burn rate · Cost-cut plan",
    color: "#F59E0B",
  },
  {
    id: "customer-pulse",
    name: "Customer Pulse",
    icon: "📊",
    description: "Churn risk · At-risk accounts · Re-engagement",
    color: "#4ADE80",
  },
  {
    id: "workflow-optimizer",
    name: "Workflow Optimizer",
    icon: "⚙️",
    description: "Bottlenecks · Automation proposals · Efficiency",
    color: "#60A5FA",
  },
  {
    id: "narrative-architect",
    name: "Narrative Architect",
    icon: "✍️",
    description: "Staff memo · Investor letter · LinkedIn posts",
    color: "#A78BFA",
  },
  {
    id: "compliance-guardian",
    name: "Compliance Guardian",
    icon: "🛡️",
    description: "Risk flags · Compliance gaps · Mitigation plan",
    color: "#F87171",
  },
  {
    id: "resilience-logger",
    name: "Resilience Logger",
    icon: "🧠",
    description: "Synthesis · Contradiction detection · Action plan",
    color: "#FCD34D",
  },
];

// ── Countdown Timer ───────────────────────────────────────────────────────────

function useCountdown(startTimestamp: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimestamp) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  const totalSeconds = 100 * 3600;
  const remaining = Math.max(0, totalSeconds - elapsed);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const pct = Math.min(100, (elapsed / totalSeconds) * 100);

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    pct,
    elapsed,
  };
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgentOutput["status"] }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: "STANDBY", bg: "#1E2D47", color: "#4A5A72" },
    running: { label: "RUNNING", bg: "#1E3A5F", color: "#60A5FA" },
    complete: { label: "COMPLETE", bg: "#14532D", color: "#4ADE80" },
    escalated: { label: "ESCALATED", bg: "#451A03", color: "#F59E0B" },
    error: { label: "ERROR", bg: "#450A0A", color: "#F87171" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 4,
        background: s.bg,
        color: s.color,
        fontSize: 10,
        fontFamily: "monospace",
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({ agent, agentOutput }: { agent: typeof AGENTS[0]; agentOutput: AgentOutput | undefined }) {
  const status = agentOutput?.status ?? "pending";
  const isRunning = status === "running";
  const isComplete = status === "complete" || status === "escalated";

  return (
    <div
      style={{
        background: "#0D1829",
        border: `1px solid ${isRunning ? agent.color + "50" : isComplete ? agent.color + "30" : "#1E2D47"}`,
        borderRadius: 12,
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.3s",
      }}
    >
      {/* Running pulse */}
      {isRunning && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 0%, ${agent.color}08 0%, transparent 70%)`,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: agent.color + "15",
              border: `1px solid ${agent.color}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {agent.icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F0F4FA" }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: "#4A5A72", marginTop: 2 }}>{agent.description}</div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#1E2D47", borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            background: agent.color,
            borderRadius: 2,
            width: isComplete ? "100%" : isRunning ? "60%" : "0%",
            transition: "width 1s ease",
          }}
        />
      </div>

      {/* Alert count */}
      {(agentOutput?.alerts?.length ?? 0) > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {agentOutput!.alerts.slice(0, 2).map((alert, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                color: alert.startsWith("CRITICAL") ? "#EF4444" : "#F59E0B",
                background: alert.startsWith("CRITICAL") ? "#EF444410" : "#F59E0B10",
                border: `1px solid ${alert.startsWith("CRITICAL") ? "#EF444430" : "#F59E0B30"}`,
                borderRadius: 4,
                padding: "2px 6px",
                fontFamily: "monospace",
              }}
            >
              ⚠ {alert.replace(/^(CRITICAL|HIGH): /, "").slice(0, 50)}
              {alert.replace(/^(CRITICAL|HIGH): /, "").length > 50 ? "…" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TurnaroundCommand() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const sessionIdRaw = params.get("id") ?? window.location.pathname.split("/").pop();
  const sessionId = parseInt(sessionIdRaw ?? "0", 10);

  const [polling, setPolling] = useState(true);
  const [newAlerts, setNewAlerts] = useState<number[]>([]);
  const prevAlertCount = useRef(0);

  const { data, error } = trpc.turnaround.getStatus.useQuery(
    { sessionId },
    {
      enabled: !!user && !isNaN(sessionId) && sessionId > 0 && polling,
      refetchInterval: polling ? 3000 : false,
    }
  );

  const countdown = useCountdown(data?.createdAt ?? Date.now());

  // Stop polling when complete or error
  useEffect(() => {
    if (data?.status === "complete" || data?.status === "error") {
      setPolling(false);
    }
  }, [data?.status]);

  // Detect new alerts
  useEffect(() => {
    const currentCount = data?.alerts?.length ?? 0;
    if (currentCount > prevAlertCount.current) {
      const newIds = Array.from(
        { length: currentCount - prevAlertCount.current },
        (_, i) => prevAlertCount.current + i
      );
      setNewAlerts(newIds);
      setTimeout(() => setNewAlerts([]), 3000);
    }
    prevAlertCount.current = currentCount;
  }, [data?.alerts?.length]);

  // Navigate to report when complete
  useEffect(() => {
    if (data?.status === "complete") {
      const timer = setTimeout(() => {
        navigate(`/turnaround/report/${sessionId}`);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [data?.status, sessionId, navigate]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080F1E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #1E2D47", borderTopColor: "#F59E0B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl("/turnaround");
    return null;
  }

  const agentOutputs: AgentOutput[] = data?.agentOutputs ?? [];
  const alerts: LeadershipAlert[] = data?.alerts ?? [];
  const completionPct = data?.completionPct ?? 0;
  const isComplete = data?.status === "complete";
  const isError = data?.status === "error";

  const criticalAlerts = alerts.filter(a => a.level === "critical");
  const highAlerts = alerts.filter(a => a.level === "high");

  return (
    <div style={{ minHeight: "100vh", background: "#080F1E", color: "#F0F4FA" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes alertFlash { 0%, 100% { border-color: #EF444430; } 50% { border-color: #EF4444; } }
      `}</style>

      {/* Top Nav */}
      <nav style={{ borderBottom: "1px solid #1E2D47", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#080F1E" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/portfolio")}
            style={{ background: "none", border: "none", color: "#4A5A72", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Back
          </button>
          <div style={{ width: 1, height: 16, background: "#1E2D47" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F0F4FA" }}>
            {data?.companyName ?? "Loading…"} · Command Centre
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {criticalAlerts.length > 0 && (
            <div style={{ padding: "4px 10px", borderRadius: 6, background: "#EF444415", border: "1px solid #EF444430", fontSize: 11, color: "#EF4444", fontFamily: "monospace", fontWeight: 700 }}>
              ⚠ {criticalAlerts.length} CRITICAL
            </div>
          )}
          {highAlerts.length > 0 && (
            <div style={{ padding: "4px 10px", borderRadius: 6, background: "#F59E0B15", border: "1px solid #F59E0B30", fontSize: 11, color: "#F59E0B", fontFamily: "monospace", fontWeight: 700 }}>
              ▲ {highAlerts.length} HIGH
            </div>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header: Countdown + Progress */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>

          {/* Countdown */}
          <div style={{ background: "#0D1829", border: "1px solid #1E2D47", borderRadius: 12, padding: "24px", gridColumn: "1 / 2" }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.1em", marginBottom: 12 }}>100-HOUR COUNTDOWN</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 40, fontFamily: "monospace", fontWeight: 900, color: countdown.hours === "00" && countdown.minutes < "30" ? "#EF4444" : "#F59E0B" }}>
                {countdown.hours}
              </span>
              <span style={{ fontSize: 24, color: "#4A5A72", fontFamily: "monospace" }}>:</span>
              <span style={{ fontSize: 40, fontFamily: "monospace", fontWeight: 900, color: "#F0F4FA" }}>{countdown.minutes}</span>
              <span style={{ fontSize: 24, color: "#4A5A72", fontFamily: "monospace" }}>:</span>
              <span style={{ fontSize: 40, fontFamily: "monospace", fontWeight: 900, color: "#4A5A72" }}>{countdown.seconds}</span>
            </div>
            <div style={{ marginTop: 12, height: 4, background: "#1E2D47", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, #F59E0B, #EF4444)", width: `${countdown.pct}%`, transition: "width 1s linear" }} />
            </div>
            <div style={{ fontSize: 11, color: "#4A5A72", marginTop: 8, fontFamily: "monospace" }}>
              {countdown.pct.toFixed(1)}% elapsed
            </div>
          </div>

          {/* Analysis Progress */}
          <div style={{ background: "#0D1829", border: "1px solid #1E2D47", borderRadius: 12, padding: "24px" }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.1em", marginBottom: 12 }}>MESH ANALYSIS</div>
            <div style={{ fontSize: 40, fontFamily: "monospace", fontWeight: 900, color: isComplete ? "#4ADE80" : "#60A5FA" }}>
              {completionPct}%
            </div>
            <div style={{ marginTop: 12, height: 4, background: "#1E2D47", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: isComplete ? "#4ADE80" : "#60A5FA", width: `${completionPct}%`, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ fontSize: 11, color: "#4A5A72", marginTop: 8, fontFamily: "monospace" }}>
              {agentOutputs.filter(a => a.status === "complete" || a.status === "escalated").length} / 6 agents complete
            </div>
          </div>

          {/* Alert Summary */}
          <div style={{ background: "#0D1829", border: `1px solid ${criticalAlerts.length > 0 ? "#EF444430" : "#1E2D47"}`, borderRadius: 12, padding: "24px" }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.1em", marginBottom: 12 }}>LEADERSHIP ALERTS</div>
            <div style={{ fontSize: 40, fontFamily: "monospace", fontWeight: 900, color: criticalAlerts.length > 0 ? "#EF4444" : alerts.length > 0 ? "#F59E0B" : "#4A5A72" }}>
              {alerts.length}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "#EF4444", fontFamily: "monospace" }}>{criticalAlerts.length} CRITICAL</div>
              <div style={{ fontSize: 11, color: "#4A5A72" }}>·</div>
              <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: "monospace" }}>{highAlerts.length} HIGH</div>
            </div>
          </div>
        </div>

        {/* Complete Banner */}
        {isComplete && (
          <div style={{ background: "#14532D", border: "1px solid #4ADE8030", borderRadius: 12, padding: "16px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", animation: "slideIn 0.4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 20 }}>✅</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4ADE80" }}>Analysis Complete</div>
                <div style={{ fontSize: 12, color: "#86EFAC" }}>All 6 agents finished · Redirecting to report…</div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/turnaround/report/${sessionId}`)}
              style={{ padding: "8px 20px", borderRadius: 8, background: "#4ADE80", color: "#052E16", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
            >
              View Report →
            </button>
          </div>
        )}

        {/* Error Banner */}
        {isError && (
          <div style={{ background: "#450A0A", border: "1px solid #EF444430", borderRadius: 12, padding: "16px 24px", marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444" }}>Analysis Failed</div>
            <div style={{ fontSize: 12, color: "#FCA5A5", marginTop: 4 }}>{data?.errorMessage ?? "An unexpected error occurred"}</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>

          {/* Agent Grid */}
          <div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.1em", marginBottom: 16 }}>SPECIALIST AGENTS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {AGENTS.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  agentOutput={agentOutputs.find(a => a.agentId === agent.id)}
                />
              ))}
            </div>
          </div>

          {/* Leadership Alerts Panel */}
          <div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: "#4A5A72", letterSpacing: "0.1em", marginBottom: 16 }}>
              LEADERSHIP ALERTS {alerts.length > 0 && `(${alerts.length})`}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
              {alerts.length === 0 ? (
                <div style={{ background: "#0D1829", border: "1px solid #1E2D47", borderRadius: 10, padding: "20px", textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🟢</div>
                  <div style={{ fontSize: 12, color: "#4A5A72" }}>No alerts fired yet</div>
                  <div style={{ fontSize: 11, color: "#2A3A52", marginTop: 4 }}>Agents are running…</div>
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <div
                    key={i}
                    style={{
                      background: alert.level === "critical" ? "#EF444408" : "#F59E0B08",
                      border: `1px solid ${alert.level === "critical" ? "#EF444430" : "#F59E0B30"}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      animation: newAlerts.includes(i) ? "slideIn 0.4s ease" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: alert.level === "critical" ? "#EF4444" : "#F59E0B",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {alert.level.toUpperCase()} · {alert.agentName}
                      </span>
                      <span style={{ fontSize: 10, color: "#2A3A52", fontFamily: "monospace" }}>
                        {new Date(alert.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#C8D4E8", lineHeight: 1.5 }}>{alert.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
