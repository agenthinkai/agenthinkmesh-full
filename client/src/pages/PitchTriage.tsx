/**
 * PitchTriage.tsx
 * Fast (~5s) lightweight pre-filter for deals.
 * 6 parallel micro-agents → deterministic score → ENGAGE / WATCH / IGNORE
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ── Design tokens (mirrors DealScreener.tsx) ─────────────────────────────────
const ACCENT = "#7c3aed";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.45)";
const TEXT2 = "rgba(255,255,255,0.7)";
const BG2 = "rgba(255,255,255,0.04)";
const AMBER = "#f59e0b";

// ── Types ─────────────────────────────────────────────────────────────────────
type AgentName =
  | "Market Signal"
  | "Business Model"
  | "Traction"
  | "Founder Signal"
  | "Risk"
  | "Completeness";

interface AgentOutput {
  name: AgentName;
  label: string;
  reasoning: string;
  fallback: boolean;
}

interface TriageResult {
  score: number;
  classification: "ENGAGE" | "WATCH" | "IGNORE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  nextStep: string;
  agentOutputs: AgentOutput[];
  keySignals: string[];
  missingInfo: string[];
  topMissingFields: string[];
}

// ── Label chip colour logic ───────────────────────────────────────────────────
const GREEN_LABELS = new Set(["strong", "clear", "low", "complete"]);
const AMBER_LABELS = new Set(["weak", "partial", "early", "neutral", "medium"]);
// everything else → red

function labelColor(label: string): { bg: string; text: string } {
  if (GREEN_LABELS.has(label)) return { bg: "rgba(34,197,94,0.15)", text: "#4ade80" };
  if (AMBER_LABELS.has(label)) return { bg: "rgba(245,158,11,0.15)", text: "#fbbf24" };
  return { bg: "rgba(239,68,68,0.15)", text: "#f87171" };
}

// ── Agent display order + icons ───────────────────────────────────────────────
const AGENT_META: Record<AgentName, { icon: string; weight: number }> = {
  Traction: { icon: "📈", weight: 22 },
  "Market Signal": { icon: "🌐", weight: 20 },
  "Founder Signal": { icon: "👤", weight: 20 },
  "Business Model": { icon: "💡", weight: 18 },
  Risk: { icon: "⚠️", weight: 15 },
  Completeness: { icon: "📋", weight: 5 },
};

const AGENT_ORDER: AgentName[] = [
  "Traction",
  "Market Signal",
  "Founder Signal",
  "Business Model",
  "Risk",
  "Completeness",
];

// ── Loading agent names (staggered reveal) ────────────────────────────────────
const LOADING_STEPS = [
  "Initialising agents…",
  "Analysing traction signals…",
  "Scanning market landscape…",
  "Evaluating founder profile…",
  "Reviewing business model…",
  "Assessing risk factors…",
  "Checking pitch completeness…",
  "Computing triage score…",
];

// ── Main component ────────────────────────────────────────────────────────────
type PageState = "INPUT" | "LOADING" | "RESULTS";

export default function PitchTriage() {
  const [, navigate] = useLocation();
  const routerState = useHistoryState() as { pitchText?: string } | null;
  const [pageState, setPageState] = useState<PageState>("INPUT");
  const [pitchText, setPitchText] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Loading animation
  const [loadingStep, setLoadingStep] = useState(0);
  const [completedAgents, setCompletedAgents] = useState<Set<AgentName>>(new Set());
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triage = trpc.pitch.triage.useMutation({
    onSuccess: (data) => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      setResult(data as TriageResult);
      setPageState("RESULTS");
    },
    onError: (err) => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      setError(err.message ?? "Triage failed. Please try again.");
      setPageState("INPUT");
    },
  });

  // Pre-fill from router state (primary) or sessionStorage (fallback)
  // Router state is set by navigate("/pitch-triage", { state: { pitchText } })
  // sessionStorage is set by the DealScreener "Fast Triage" link (href-based navigation)
  useEffect(() => {
    // Primary: wouter history state (reliable across same-origin SPA navigation)
    if (routerState?.pitchText) {
      setPitchText(routerState.pitchText);
      return;
    }
    // Fallback: sessionStorage (for href-based navigation or cross-tab scenarios)
    const saved = sessionStorage.getItem("pitchTriageEscalation");
    if (saved) {
      setPitchText(saved);
      sessionStorage.removeItem("pitchTriageEscalation");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staggered loading animation
  useEffect(() => {
    if (pageState !== "LOADING") return;
    setLoadingStep(0);
    setCompletedAgents(new Set());

    let step = 0;
    loadingTimerRef.current = setInterval(() => {
      step += 1;
      setLoadingStep(step);
      // Reveal agents one by one starting at step 1
      if (step >= 1 && step <= AGENT_ORDER.length) {
        const agentName = AGENT_ORDER[step - 1];
        setCompletedAgents((prev) => { const next = new Set(prev); next.add(agentName); return next; });
      }
      if (step >= LOADING_STEPS.length - 1) {
        if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      }
    }, 600);

    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, [pageState]);

  function handleSubmit() {
    if (!pitchText.trim() || pitchText.trim().length < 10) return;
    setError(null);
    setPageState("LOADING");
    triage.mutate({ pitchText: pitchText.trim() });
  }

  function handleReset() {
    setPageState("INPUT");
    setResult(null);
    setError(null);
    setCompletedAgents(new Set());
  }

  function handleEscalate() {
    if (!result) return;
    // Primary: pass via wouter router state (no storage race conditions)
    // Fallback: also write sessionStorage in case /deals does a hard reload
    sessionStorage.setItem("pitchTriageEscalation", pitchText);
    navigate("/deals", { state: { pitchTriageText: pitchText } });
  }

  // ── Classification banner config ─────────────────────────────────────────
  const classConfig = {
    ENGAGE: {
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.35)",
      text: "#4ade80",
      label: "ENGAGE",
      desc: "Strong signals — proceed to full evaluation",
    },
    WATCH: {
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.35)",
      text: "#fbbf24",
      label: "WATCH",
      desc: "Mixed signals — request more information before committing",
    },
    IGNORE: {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.35)",
      text: "#f87171",
      label: "IGNORE",
      desc: "Insufficient signals — not ready for evaluation",
    },
  };

  // ── Score badge colour ────────────────────────────────────────────────────
  function scoreBadgeColor(score: number) {
    if (score >= 62) return { ring: "#4ade80", text: "#4ade80" };
    if (score >= 38) return { ring: "#fbbf24", text: "#fbbf24" };
    return { ring: "#f87171", text: "#f87171" };
  }

  return (
    <DashboardLayout>
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0f",
          padding: "32px 24px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 22,
                background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 800,
                letterSpacing: "-0.5px",
              }}
            >
              ⚡ Pitch Triage
            </span>
            <Badge
              style={{
                background: "rgba(124,58,237,0.18)",
                color: "#a78bfa",
                border: "1px solid rgba(124,58,237,0.35)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "2px 8px",
              }}
            >
              FAST MODE
            </Badge>
          </div>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 32 }}>
            6 parallel micro-agents evaluate your pitch in ~5 seconds. Get an instant
            ENGAGE / WATCH / IGNORE signal before committing to a full evaluation.
          </p>

          {/* ── INPUT STATE ──────────────────────────────────────────────── */}
          {pageState === "INPUT" && (
            <div
              style={{
                background: BG2,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 28,
              }}
            >
              {error && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#f87171",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}
              <label
                style={{
                  display: "block",
                  color: TEXT2,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Pitch Text
              </label>
              <Textarea
                value={pitchText}
                onChange={(e) => setPitchText(e.target.value)}
                placeholder="Paste your pitch, executive summary, or deal description here…"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  lineHeight: 1.6,
                  minHeight: 220,
                  resize: "vertical",
                  padding: "12px 14px",
                  width: "100%",
                  outline: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 16,
                }}
              >
                <span style={{ color: MUTED, fontSize: 12 }}>
                  {pitchText.length.toLocaleString()} chars
                  {pitchText.length > 3000 && (
                    <span style={{ color: AMBER, marginLeft: 6 }}>
                      (first 3,000 chars used)
                    </span>
                  )}
                </span>
                <Button
                  onClick={handleSubmit}
                  disabled={pitchText.trim().length < 10}
                  style={{
                    background: pitchText.trim().length >= 10
                      ? `linear-gradient(135deg, ${ACCENT}, #a855f7)`
                      : "rgba(255,255,255,0.08)",
                    color: pitchText.trim().length >= 10 ? "#fff" : MUTED,
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: pitchText.trim().length >= 10 ? "pointer" : "not-allowed",
                    transition: "opacity 0.2s",
                  }}
                >
                  ⚡ Run Triage
                </Button>
              </div>

              {/* Agent preview chips */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: `1px solid ${BORDER}`,
                }}
              >
                <p style={{ color: MUTED, fontSize: 11, marginBottom: 10, letterSpacing: 0.5 }}>
                  6 AGENTS WILL EVALUATE IN PARALLEL
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {AGENT_ORDER.map((name) => (
                    <div
                      key={name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        color: TEXT2,
                      }}
                    >
                      <span>{AGENT_META[name].icon}</span>
                      <span>{name}</span>
                      <span style={{ color: MUTED, fontSize: 10 }}>
                        {AGENT_META[name].weight}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── LOADING STATE ─────────────────────────────────────────────── */}
          {pageState === "LOADING" && (
            <div
              style={{
                background: BG2,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 32,
                textAlign: "center",
              }}
            >
              {/* Spinner */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  border: `3px solid rgba(124,58,237,0.2)`,
                  borderTop: `3px solid ${ACCENT}`,
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 20px",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

              <p
                style={{
                  color: "#a78bfa",
                  fontWeight: 700,
                  fontSize: 15,
                  marginBottom: 6,
                }}
              >
                {LOADING_STEPS[Math.min(loadingStep, LOADING_STEPS.length - 1)]}
              </p>
              <p style={{ color: MUTED, fontSize: 12, marginBottom: 28 }}>
                All 6 agents are running in parallel
              </p>

              {/* Agent progress grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                  maxWidth: 560,
                  margin: "0 auto",
                }}
              >
                {AGENT_ORDER.map((name) => {
                  const done = completedAgents.has(name);
                  return (
                    <div
                      key={name}
                      style={{
                        background: done
                          ? "rgba(124,58,237,0.12)"
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${done ? "rgba(124,58,237,0.35)" : BORDER}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        transition: "all 0.4s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{AGENT_META[name].icon}</span>
                      <div style={{ textAlign: "left" }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: done ? "#a78bfa" : MUTED,
                          }}
                        >
                          {name}
                        </div>
                        <div style={{ fontSize: 10, color: done ? "#7c3aed" : "transparent" }}>
                          {done ? "✓ complete" : "waiting…"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RESULTS STATE ─────────────────────────────────────────────── */}
          {pageState === "RESULTS" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Classification banner + score */}
              <div
                style={{
                  background: classConfig[result.classification].bg,
                  border: `1px solid ${classConfig[result.classification].border}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Score badge */}
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      border: `3px solid ${scoreBadgeColor(result.score).ring}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: scoreBadgeColor(result.score).text,
                        lineHeight: 1,
                      }}
                    >
                      {result.score}
                    </span>
                    <span style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>/100</span>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: classConfig[result.classification].text,
                        letterSpacing: 1,
                      }}
                    >
                      {result.classification}
                    </div>
                    <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>
                      {classConfig[result.classification].desc}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: MUTED,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontWeight: 600,
                          letterSpacing: 0.5,
                        }}
                      >
                        CONFIDENCE: {result.confidence}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {result.classification === "ENGAGE" && (
                    <Button
                      onClick={handleEscalate}
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "10px 20px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Run Full Evaluation →
                    </Button>
                  )}
                  <Button
                    onClick={handleReset}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: TEXT2,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    New Triage
                  </Button>
                </div>
              </div>

              {/* Confidence guardrail warning banner */}
              {result.confidence === "LOW" && (
                <div
                  style={{
                    background: "rgba(245,158,11,0.10)",
                    border: "1px solid rgba(245,158,11,0.4)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>⚠️</span>
                    <span
                      style={{
                        color: AMBER,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                    >
                      Low Confidence — Insufficient Pitch Data
                    </span>
                  </div>
                  <p style={{ color: TEXT2, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    The pitch lacks enough information for a reliable triage. Provide more detail before
                    committing to a full evaluation.
                  </p>
                  {result.topMissingFields.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                      <span style={{ color: MUTED, fontSize: 11 }}>Top missing fields:</span>
                      {result.topMissingFields.map((field) => (
                        <span
                          key={field}
                          style={{
                            background: "rgba(245,158,11,0.15)",
                            color: AMBER,
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Agent grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {AGENT_ORDER.map((name) => {
                  const agent = result.agentOutputs.find((a) => a.name === name);
                  if (!agent) return null;
                  const { bg, text } = labelColor(agent.label);
                  return (
                    <div
                      key={name}
                      style={{
                        background: BG2,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#fff",
                          }}
                        >
                          <span>{AGENT_META[name].icon}</span>
                          <span>{name}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              background: bg,
                              color: text,
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: 0.5,
                              textTransform: "uppercase",
                            }}
                          >
                            {agent.label}
                          </span>
                          {agent.fallback && (
                            <span
                              title="Agent used fallback value"
                              style={{
                                fontSize: 10,
                                color: MUTED,
                                background: "rgba(255,255,255,0.06)",
                                borderRadius: 4,
                                padding: "1px 5px",
                              }}
                            >
                              ~
                            </span>
                          )}
                        </div>
                      </div>
                      <p
                        style={{
                          color: TEXT2,
                          fontSize: 12,
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {agent.reasoning}
                      </p>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 10,
                          color: MUTED,
                        }}
                      >
                        weight: {AGENT_META[name].weight}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Key signals + missing info */}
              {(result.keySignals.length > 0 || result.missingInfo.length > 0) && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  {result.keySignals.length > 0 && (
                    <div
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <p
                        style={{
                          color: "#4ade80",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.8,
                          marginBottom: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        ✓ Key Signals
                      </p>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {result.keySignals.map((sig, i) => (
                          <li
                            key={i}
                            style={{
                              color: TEXT2,
                              fontSize: 12,
                              lineHeight: 1.5,
                              paddingBottom: 6,
                              borderBottom:
                                i < result.keySignals.length - 1
                                  ? `1px solid rgba(34,197,94,0.1)`
                                  : "none",
                              marginBottom: i < result.keySignals.length - 1 ? 6 : 0,
                            }}
                          >
                            {sig}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.missingInfo.length > 0 && (
                    <div
                      style={{
                        background: "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <p
                        style={{
                          color: "#f87171",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.8,
                          marginBottom: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        ✗ Missing / Weak
                      </p>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {result.missingInfo.map((info, i) => (
                          <li
                            key={i}
                            style={{
                              color: TEXT2,
                              fontSize: 12,
                              lineHeight: 1.5,
                              paddingBottom: 6,
                              borderBottom:
                                i < result.missingInfo.length - 1
                                  ? `1px solid rgba(239,68,68,0.1)`
                                  : "none",
                              marginBottom: i < result.missingInfo.length - 1 ? 6 : 0,
                            }}
                          >
                            {info}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Next step hint */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ color: MUTED, fontSize: 12 }}>Recommended next step:</span>
                <span style={{ color: TEXT2, fontSize: 12, fontWeight: 600 }}>
                  {result.nextStep}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
