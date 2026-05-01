import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import GateScreen from "@/components/GateScreen";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Design tokens ──────────────────────────────────────────────────────────────
const NAVY = "#0B1628";
const NAVY_CARD = "#0F1E35";
const NAVY_BORDER = "#1E3050";
const TEAL = "#0EA5E9";
const GOLD = "#F59E0B";
const EMERALD = "#10B981";
const SILVER_50 = "#F0F4FA";
const SILVER_400 = "#94A3B8";
const SILVER_600 = "#4A5A72";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, -apple-system, sans-serif";

// ── Decision colour maps ───────────────────────────────────────────────────────
const UW_DECISION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  APPROVE: { bg: "#052E16", border: "#16A34A", text: "#4ADE80", label: "APPROVED" },
  REFER: { bg: "#1C1A00", border: "#CA8A04", text: "#FDE047", label: "REFER TO SENIOR UW" },
  DECLINE: { bg: "#2D0A0A", border: "#DC2626", text: "#F87171", label: "DECLINED" },
};

const TREATY_DECISION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  ACCEPT: { bg: "#052E16", border: "#16A34A", text: "#4ADE80", label: "TREATY ACCEPTED" },
  NEGOTIATE: { bg: "#1C1A00", border: "#CA8A04", text: "#FDE047", label: "NEGOTIATE TERMS" },
  DECLINE: { bg: "#2D0A0A", border: "#DC2626", text: "#F87171", label: "TREATY DECLINED" },
};

const CLAIMS_DECISION_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  Pay: { bg: "#052E16", border: "#16A34A", text: "#4ADE80", label: "SETTLE CLAIM" },
  Investigate: { bg: "#1C1A00", border: "#CA8A04", text: "#FDE047", label: "INVESTIGATE FURTHER" },
  Deny: { bg: "#2D0A0A", border: "#DC2626", text: "#F87171", label: "CLAIM DENIED" },
};

// ── Workflow metadata ──────────────────────────────────────────────────────────
const WORKFLOW_META: Record<string, { label: string; icon: string; accent: string }> = {
  underwriting: { label: "Underwriting Decision Engine", icon: "📋", accent: GOLD },
  treaty: { label: "Treaty Analysis Engine", icon: "🤝", accent: TEAL },
  claims: { label: "Claims Intelligence", icon: "🔍", accent: EMERALD },
  compliance: { label: "Takaful Compliance Scan", icon: "☪️", accent: "#8B5CF6" },
  cat_model: { label: "CAT Model", icon: "🌪️", accent: "#EF4444" },
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface AgentStep {
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "complete" | "error";
  output?: Record<string, unknown>;
  tokensUsed?: number;
  durationMs?: number;
}

interface Blackboard {
  uw_decision?: string;
  confidence_score?: number;
  risk_score?: number;
  premium_indication?: string;
  takaful_compliant?: boolean;
  compliance_score?: number;
  compliance_issues?: string[];
  gharar_level?: string;
  decision_rationale?: string;
  conditions?: string[];
  key_questions?: string[];
  treaty_recommendation?: string;
  cession_rate?: number;
  optimal_cession_rate?: number;
  probable_maximum_loss?: string;
  cat_exposure?: string;
  fraud_score?: number;
  settlement_recommendation?: string;
  ibnr_estimate?: string;
  [key: string]: unknown;
}

// ── Decision Banner ────────────────────────────────────────────────────────────
function DecisionBanner({ runType, blackboard }: { runType: string; blackboard: Blackboard }) {
  if (runType === "underwriting" && blackboard.uw_decision) {
    const style = UW_DECISION_STYLES[blackboard.uw_decision] || UW_DECISION_STYLES.REFER;
    return (
      <div style={{
        background: style.bg, border: `2px solid ${style.border}`,
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.08em", marginBottom: 6 }}>
              UNDERWRITING DECISION
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: style.text, fontFamily: MONO, letterSpacing: "0.04em" }}>
              {style.label}
            </div>
            {blackboard.decision_rationale && (
              <p style={{ fontSize: 13, color: SILVER_400, marginTop: 10, lineHeight: 1.6 }}>
                {blackboard.decision_rationale}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
            {blackboard.confidence_score !== undefined && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: style.text, fontFamily: MONO }}>
                  {blackboard.confidence_score}%
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>CONFIDENCE</div>
              </div>
            )}
            {blackboard.risk_score !== undefined && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: SILVER_50, fontFamily: MONO }}>
                  {blackboard.risk_score}/100
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>RISK SCORE</div>
              </div>
            )}
            {blackboard.premium_indication && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, fontFamily: MONO }}>
                  {blackboard.premium_indication}
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>PREMIUM INDICATION</div>
              </div>
            )}
          </div>
        </div>
        {blackboard.conditions && blackboard.conditions.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${style.border}40` }}>
            <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.06em", marginBottom: 8 }}>
              CONDITIONS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(blackboard.conditions as string[]).map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: SILVER_400, display: "flex", gap: 8 }}>
                  <span style={{ color: style.text }}>→</span> {c}
                </div>
              ))}
            </div>
          </div>
        )}
        {blackboard.takaful_compliant !== undefined && (
          <div style={{
            marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
            background: blackboard.takaful_compliant ? "#052E1680" : "#2D0A0A80",
            border: `1px solid ${blackboard.takaful_compliant ? "#16A34A" : "#DC2626"}50`,
            borderRadius: 6, padding: "4px 10px",
          }}>
            <span>{blackboard.takaful_compliant ? "☪️" : "⚠️"}</span>
            <span style={{ fontSize: 11, color: blackboard.takaful_compliant ? "#4ADE80" : "#F87171", fontFamily: MONO }}>
              {blackboard.takaful_compliant ? "SHARIAH COMPLIANT" : "SHARIAH ISSUES DETECTED"}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (runType === "treaty" && blackboard.treaty_recommendation) {
    const style = TREATY_DECISION_STYLES[blackboard.treaty_recommendation] || TREATY_DECISION_STYLES.NEGOTIATE;
    return (
      <div style={{
        background: style.bg, border: `2px solid ${style.border}`,
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.08em", marginBottom: 6 }}>
              TREATY RECOMMENDATION
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: style.text, fontFamily: MONO }}>
              {style.label}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
            {(blackboard.cession_rate ?? blackboard.optimal_cession_rate) !== undefined && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: TEAL, fontFamily: MONO }}>
                  {blackboard.cession_rate ?? blackboard.optimal_cession_rate}%
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>CESSION RATE</div>
              </div>
            )}
            {blackboard.probable_maximum_loss && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_50, fontFamily: MONO }}>
                  {blackboard.probable_maximum_loss}
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>PML</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (runType === "claims" && blackboard.settlement_recommendation) {
    const decision = (blackboard.settlement_recommendation as string).split(" ")[0];
    const style = CLAIMS_DECISION_STYLES[decision] || CLAIMS_DECISION_STYLES.Investigate;
    return (
      <div style={{
        background: style.bg, border: `2px solid ${style.border}`,
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.08em", marginBottom: 6 }}>
              CLAIMS RECOMMENDATION
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: style.text, fontFamily: MONO }}>
              {style.label}
            </div>
            {blackboard.settlement_recommendation && (
              <p style={{ fontSize: 12, color: SILVER_400, marginTop: 8 }}>
                {blackboard.settlement_recommendation}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160 }}>
            {blackboard.fraud_score !== undefined && (
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 22, fontWeight: 800, fontFamily: MONO,
                  color: blackboard.fraud_score > 60 ? "#F87171" : blackboard.fraud_score > 30 ? GOLD : EMERALD,
                }}>
                  {blackboard.fraud_score}/100
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>FRAUD SCORE</div>
              </div>
            )}
            {blackboard.ibnr_estimate && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_50, fontFamily: MONO }}>
                  {blackboard.ibnr_estimate}
                </div>
                <div style={{ fontSize: 10, color: SILVER_600, letterSpacing: "0.06em" }}>IBNR RESERVE</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (runType === "compliance") {
    const compliant = blackboard.takaful_compliant;
    return (
      <div style={{
        background: compliant ? "#052E16" : "#2D0A0A",
        border: `2px solid ${compliant ? "#16A34A" : "#DC2626"}`,
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.08em", marginBottom: 6 }}>
          SHARIAH COMPLIANCE VERDICT
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: MONO, color: compliant ? "#4ADE80" : "#F87171" }}>
          {compliant ? "☪️ SHARIAH COMPLIANT" : "⚠️ NON-COMPLIANT — ISSUES FOUND"}
        </div>
        {blackboard.compliance_score !== undefined && (
          <div style={{ marginTop: 10, fontSize: 14, color: SILVER_400 }}>
            Compliance Score: <span style={{ color: SILVER_50, fontFamily: MONO, fontWeight: 700 }}>
              {blackboard.compliance_score}/100
            </span>
          </div>
        )}
        {blackboard.compliance_issues && (blackboard.compliance_issues as string[]).length > 0 && (
          <div style={{ marginTop: 14 }}>
            {(blackboard.compliance_issues as string[]).map((issue, i) => (
              <div key={i} style={{ fontSize: 12, color: "#F87171", display: "flex", gap: 8, marginBottom: 4 }}>
                <span>⚠</span> {issue}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (runType === "cat_model" && blackboard.cat_exposure) {
    const isHigh = blackboard.cat_exposure === "High" || blackboard.cat_exposure === "Extreme";
    return (
      <div style={{
        background: isHigh ? "#2D0A0A" : "#0F1E35",
        border: `2px solid ${isHigh ? "#DC2626" : TEAL}`,
        borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO, letterSpacing: "0.08em", marginBottom: 6 }}>
          CATASTROPHE EXPOSURE ASSESSMENT
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: MONO, color: isHigh ? "#F87171" : TEAL }}>
          🌪️ {blackboard.cat_exposure?.toUpperCase()} EXPOSURE
        </div>
        {blackboard.probable_maximum_loss && (
          <div style={{ marginTop: 12, fontSize: 16, color: SILVER_50 }}>
            PML: <span style={{ color: isHigh ? "#F87171" : TEAL, fontFamily: MONO, fontWeight: 700 }}>
              {blackboard.probable_maximum_loss}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Agent Step Card ────────────────────────────────────────────────────────────
function AgentStepCard({ step, accent }: { step: AgentStep; accent: string }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    step.status === "complete" ? EMERALD :
    step.status === "running" ? GOLD :
    step.status === "error" ? "#F87171" :
    SILVER_600;

  const statusIcon =
    step.status === "complete" ? "✓" :
    step.status === "running" ? "⟳" :
    step.status === "error" ? "✗" :
    "○";

  return (
    <div style={{
      background: NAVY_CARD,
      border: `1px solid ${step.status === "running" ? accent + "60" : NAVY_BORDER}`,
      borderRadius: 12, padding: 16,
      transition: "border-color 0.2s",
    }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, cursor: step.output ? "pointer" : "default" }}
        onClick={() => step.output && setExpanded(!expanded)}
      >
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: `${statusColor}18`,
          border: `1px solid ${statusColor}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: step.status === "running" ? 14 : 12,
          color: statusColor,
          animation: step.status === "running" ? "spin 1s linear infinite" : "none",
          flexShrink: 0,
        }}>
          {statusIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: SILVER_50 }}>{step.agentName}</div>
          <div style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO }}>{step.agentId}</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {step.durationMs && (
            <span style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO }}>
              {(step.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {step.tokensUsed ? (
            <span style={{ fontSize: 10, color: SILVER_600, fontFamily: MONO }}>
              {step.tokensUsed} tok
            </span>
          ) : null}
          {step.output && (
            <span style={{ fontSize: 10, color: SILVER_400 }}>{expanded ? "▲" : "▼"}</span>
          )}
        </div>
      </div>

      {expanded && step.output && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: `1px solid ${NAVY_BORDER}`,
          maxHeight: 300, overflowY: "auto",
        }}>
          <pre style={{
            fontSize: 11, color: SILVER_400, fontFamily: MONO,
            lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
          }}>
            {JSON.stringify(step.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InsuranceRun() {
  const { user, loading } = useAuth();
  const params = useParams<{ runType: string; runId: string }>();
  const [, setLocation] = useLocation();

  const runType = params.runType || "underwriting";
  const runId = params.runId || "";
  const meta = WORKFLOW_META[runType] || WORKFLOW_META.underwriting;

  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [blackboard, setBlackboard] = useState<Blackboard>({});
  const [status, setStatus] = useState<"connecting" | "running" | "complete" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Retry state for SSE reconnects
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (!user) return;

    // Guard: runId must be a valid positive integer
    const runIdNum = Number(runId);
    if (!runId || isNaN(runIdNum) || runIdNum <= 0) {
      setStatus("error");
      setErrorMsg(`Invalid run ID: "${runId}". Please go back and launch the pipeline again.`);
      return;
    }

    console.log(`[Insurance] Opening stream: runType=${runType} runId=${runIdNum}`);

    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);

    // EventSource with credentials so the session cookie is sent
    const es = new EventSource(`/api/insurance/stream/${runType}/${runIdNum}`, { withCredentials: true });
    eventSourceRef.current = es;
    console.log(`[Insurance] EventSource created for /api/insurance/stream/${runType}/${runIdNum}`);

    es.addEventListener("pipeline_start", (e) => {
      const data = JSON.parse(e.data);
      console.log(`[Insurance] pipeline_start: ${data.agents?.length} agents`);
      retryCountRef.current = 0; // reset retries on successful connection
      setStatus("running");
      setSteps(data.agents.map((a: { id: string; name: string }) => ({
        agentId: a.id,
        agentName: a.name,
        status: "pending" as const,
      })));
    });

    es.addEventListener("step_start", (e) => {
      const data = JSON.parse(e.data);
      console.log(`[Insurance] step_start: agent=${data.agentId}`);
      setSteps(prev => prev.map(s =>
        s.agentId === data.agentId ? { ...s, status: "running" } : s
      ));
    });

    es.addEventListener("step_complete", (e) => {
      const data = JSON.parse(e.data);
      console.log(`[Insurance] step_complete: agent=${data.agentId} tokens=${data.tokensUsed}`);
      setSteps(prev => prev.map(s =>
        s.agentId === data.agentId
          ? { ...s, status: "complete", output: data.output, tokensUsed: data.tokensUsed, durationMs: data.durationMs }
          : s
      ));
      if (data.blackboard) setBlackboard(data.blackboard);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      console.log(`[Insurance] complete event received for runId=${runIdNum}`);
      if (data.blackboard) setBlackboard(data.blackboard);
      setStatus("complete");
      if (timerRef.current) clearInterval(timerRef.current);
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        console.error(`[Insurance] server error event:`, data);
        setErrorMsg(data.message || "Pipeline error");
      } catch {
        setErrorMsg("Pipeline error: server returned an unexpected response");
      }
      setStatus("error");
      if (timerRef.current) clearInterval(timerRef.current);
      es.close();
    });

    es.onerror = (e) => {
      console.error(`[Insurance] EventSource onerror (readyState=${es.readyState}):`, e);
      if (es.readyState === EventSource.CLOSED) {
        // Connection was closed — attempt exponential backoff retry
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delay = Math.pow(2, retryCountRef.current) * 1000;
          console.log(`[Insurance] Retrying stream in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
          setErrorMsg(`Connection lost — retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
          // EventSource auto-reconnects by default; we just update the message
        } else {
          setStatus("error");
          setErrorMsg(`Stream disconnected after ${MAX_RETRIES} retries. The pipeline may still be running — please check the run history.`);
          if (timerRef.current) clearInterval(timerRef.current);
          es.close();
        }
      }
    };

    return () => {
      console.log(`[Insurance] Closing EventSource for runId=${runIdNum}`);
      es.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, runId, runType]);

  if (loading) return null;
  if (!user) return <GateScreen />;

  const completedSteps = steps.filter(s => s.status === "complete").length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const totalTokens = steps.reduce((sum, s) => sum + (s.tokensUsed || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: NAVY, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${NAVY_BORDER}`, background: `${NAVY_CARD}80` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <button
                  onClick={() => setLocation("/insurance")}
                  style={{ color: SILVER_600, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  ← Insurance Intelligence
                </button>
                <span style={{ color: SILVER_600 }}>/</span>
                <span style={{ fontSize: 13, color: SILVER_50 }}>{meta.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>{meta.icon}</span>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: SILVER_50, margin: 0 }}>{meta.label}</h1>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                  color: meta.accent, background: `${meta.accent}18`,
                  border: `1px solid ${meta.accent}30`,
                  borderRadius: 4, padding: "2px 8px", fontFamily: MONO,
                }}>
                  RUN #{runId}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {status === "running" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, display: "inline-block", animation: "pulse 1s infinite" }} />
                  <span style={{ fontSize: 12, color: GOLD, fontFamily: MONO }}>
                    {(elapsedMs / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
              {status === "complete" && (
                <span style={{ fontSize: 12, color: EMERALD, fontFamily: MONO }}>
                  ✓ Complete in {(elapsedMs / 1000).toFixed(1)}s · {totalTokens.toLocaleString()} tokens
                </span>
              )}
              {status === "error" && (
                <span style={{ fontSize: 12, color: "#F87171", fontFamily: MONO }}>✗ {errorMsg}</span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {totalSteps > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: SILVER_600, fontFamily: MONO }}>
                  {completedSteps}/{totalSteps} agents complete
                </span>
                <span style={{ fontSize: 11, color: meta.accent, fontFamily: MONO }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div style={{ height: 4, background: NAVY_BORDER, borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`,
                  background: status === "complete" ? EMERALD : meta.accent,
                  borderRadius: 2, transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px" }}>
        {status === "connecting" && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⟳</div>
            <p style={{ color: SILVER_400 }}>Connecting to pipeline...</p>
          </div>
        )}

        {(status === "running" || status === "complete" || status === "error") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>

            {/* Left: Decision banner + Agent steps */}
            <div>
              {/* Decision banner — shown when complete */}
              {status === "complete" && Object.keys(blackboard).length > 0 && (
                <DecisionBanner runType={runType} blackboard={blackboard} />
              )}

              {/* Agent pipeline rail */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 16 }}>
                  AGENT PIPELINE
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {steps.map((step) => (
                    <AgentStepCard key={step.agentId} step={step} accent={meta.accent} />
                  ))}
                  {steps.length === 0 && status === "running" && (
                    <div style={{ color: SILVER_600, fontSize: 13, padding: "20px 0" }}>
                      Initialising agents...
                    </div>
                  )}
                </div>
              </div>

              {/* Key questions */}
              {status === "complete" && blackboard.key_questions && (blackboard.key_questions as string[]).length > 0 && (
                <div style={{
                  background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`,
                  borderRadius: 12, padding: 20, marginTop: 16,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 12 }}>
                    KEY QUESTIONS FOR UNDERWRITER
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(blackboard.key_questions as string[]).map((q, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: SILVER_400 }}>
                        <span style={{ color: meta.accent, fontFamily: MONO, flexShrink: 0 }}>{i + 1}.</span>
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error state */}
              {status === "error" && (
                <div style={{
                  background: "#2D0A0A", border: "1px solid #DC2626",
                  borderRadius: 12, padding: 20, marginTop: 16,
                }}>
                  <div style={{ fontSize: 13, color: "#F87171" }}>
                    Pipeline error: {errorMsg}
                  </div>
                  <Button
                    onClick={() => setLocation("/insurance")}
                    className="mt-4"
                    variant="outline"
                  >
                    ← Back to Insurance Home
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Live dossier */}
            <div style={{ position: "sticky", top: 24 }}>
              <div style={{
                background: NAVY_CARD, border: `1px solid ${NAVY_BORDER}`,
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: SILVER_600, letterSpacing: "0.08em", marginBottom: 16 }}>
                  LIVE DOSSIER
                </div>

                {Object.keys(blackboard).length === 0 ? (
                  <p style={{ fontSize: 12, color: SILVER_600, lineHeight: 1.6 }}>
                    Agent outputs will appear here as the pipeline progresses...
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { key: "insured_name", label: "Insured", icon: "🏢" },
                      { key: "risk_class", label: "Risk Class", icon: "📂" },
                      { key: "sum_insured", label: "Sum Insured", icon: "💰" },
                      { key: "coverage_type", label: "Coverage", icon: "📋" },
                      { key: "territory", label: "Territory", icon: "🌍" },
                      { key: "product_type", label: "Product Type", icon: "🏷️" },
                      { key: "takaful_model", label: "Takaful Model", icon: "☪️" },
                      { key: "risk_score", label: "Risk Score", icon: "⚡" },
                      { key: "technical_premium", label: "Technical Premium", icon: "🧮" },
                      { key: "premium_indication", label: "Premium Indication", icon: "💵" },
                      { key: "loss_ratio_estimate", label: "Est. Loss Ratio", icon: "📊" },
                      { key: "fraud_score", label: "Fraud Score", icon: "🔍" },
                      { key: "ibnr_estimate", label: "IBNR Reserve", icon: "📦" },
                      { key: "treaty_type", label: "Treaty Type", icon: "🤝" },
                      { key: "cession_rate", label: "Cession Rate", icon: "📤" },
                      { key: "optimal_cession_rate", label: "Optimal Cession", icon: "🎯" },
                      { key: "probable_maximum_loss", label: "PML", icon: "🌪️" },
                      { key: "cat_exposure", label: "CAT Exposure", icon: "⚠️" },
                      { key: "gharar_level", label: "Gharar Level", icon: "⚖️" },
                      { key: "compliance_score", label: "Compliance Score", icon: "✅" },
                    ]
                      .filter(f => blackboard[f.key] !== undefined && blackboard[f.key] !== null)
                      .map(field => (
                        <div key={field.key} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                          gap: 8, paddingBottom: 10,
                          borderBottom: `1px solid ${NAVY_BORDER}`,
                        }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 13 }}>{field.icon}</span>
                            <span style={{ fontSize: 11, color: SILVER_600 }}>{field.label}</span>
                          </div>
                          <span style={{
                            fontSize: 12, color: SILVER_50, fontFamily: MONO,
                            textAlign: "right", maxWidth: 180, wordBreak: "break-word",
                          }}>
                            {typeof blackboard[field.key] === "boolean"
                              ? (blackboard[field.key] ? "Yes" : "No")
                              : String(blackboard[field.key])}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                )}

                {status === "complete" && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => setLocation("/insurance")}
                      style={{
                        background: `${meta.accent}20`, border: `1px solid ${meta.accent}50`,
                        borderRadius: 8, padding: "10px 0",
                        color: meta.accent, fontFamily: MONO, fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.06em", cursor: "pointer",
                      }}
                    >
                      ← RUN ANOTHER WORKFLOW
                    </button>
                    <button
                      onClick={() => setLocation("/insurance/takaful-alerts")}
                      style={{
                        background: "#8B5CF610", border: "1px solid #8B5CF630",
                        borderRadius: 8, padding: "10px 0",
                        color: "#A78BFA", fontFamily: MONO, fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.06em", cursor: "pointer",
                      }}
                    >
                      ☪️ VIEW TAKAFUL ALERTS
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
