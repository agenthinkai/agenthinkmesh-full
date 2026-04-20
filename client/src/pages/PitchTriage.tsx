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
  "Initialising decision agents…",
  "Analysing traction signals…",
  "Scanning market landscape…",
  "Evaluating founder profile…",
  "Reviewing business model…",
  "Assessing risk factors…",
  "Checking pitch completeness…",
  "Computing decision score…",
];

// ── Kuwait timezone formatter───────────────────────────────────────────────────────────────
function fmtKuwait(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Kuwait",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main component ───────────────────────────────────────────────────────────────
type PageState = "INPUT" | "LOADING" | "RESULTS";
export default function PitchTriage() {
  const [, navigate] = useLocation();
  const routerState = useHistoryState() as { pitchText?: string } | null;
  const [activeTab, setActiveTab] = useState<"triage" | "history">("triage");
  const [pageState, setPageState] = useState<PageState>("INPUT");
  const [pitchText, setPitchText] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [pendingParentId, setPendingParentId] = useState<number | null>(null);
  const [savedTriageId, setSavedTriageId] = useState<number | null>(null);

  // History queries
  const historyQuery = trpc.pitch.history.useQuery(undefined, {
    enabled: activeTab === "history",
    refetchOnWindowFocus: false,
  });
  const historyItemQuery = trpc.pitch.historyItem.useQuery(
    { id: selectedHistoryId ?? 0 },
    { enabled: selectedHistoryId !== null, refetchOnWindowFocus: false }
  );

  // Loading animation
  const [loadingStep, setLoadingStep] = useState(0);
  const [completedAgents, setCompletedAgents] = useState<Set<AgentName>>(new Set());
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markEscalated = trpc.pitch.markEscalated.useMutation();

  const triage = trpc.pitch.triage.useMutation({
    onSuccess: (data) => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      const d = data as TriageResult & { id?: number };
      setResult(d);
      if (d.id) setSavedTriageId(d.id);
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
    triage.mutate({ pitchText: pitchText.trim(), parentTriageId: pendingParentId ?? undefined });
    setPendingParentId(null);
  }

  // Called from HistoryTab "Re-run Triage" button
  function handleRetriage(previewText: string, parentId: number) {
    setPitchText(previewText);
    setPendingParentId(parentId);
    setSelectedHistoryId(null);
    setActiveTab("triage");
    setPageState("INPUT");
    setResult(null);
    setError(null);
    setCompletedAgents(new Set());
  }

  function handleReset() {
    setPageState("INPUT");
    setResult(null);
    setError(null);
    setCompletedAgents(new Set());
  }

  function handleEscalate() {
    if (!result) return;
    // Mark escalation in DB (fire-and-forget)
    if (savedTriageId) {
      markEscalated.mutate({ id: savedTriageId });
    }
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
      desc: "Strong signals — decision ready: proceed to full IC analysis",
    },
    WATCH: {
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.35)",
      text: "#fbbf24",
      label: "WATCH",
      desc: "Mixed signals — hold and gather more information before committing",
    },
    IGNORE: {
      bg: "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.35)",
      text: "#f87171",
      label: "IGNORE",
      desc: "Insufficient signals — pass for now, re-triage if the founder provides more detail",
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
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 20 }}>
            6 parallel micro-agents evaluate your pitch in ~5 seconds. Get an instant
            ENGAGE / WATCH / IGNORE signal before committing to a full evaluation.
          </p>

          {/* ── Tab bar ─────────────────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: `1px solid ${BORDER}`,
              marginBottom: 24,
            }}
          >
            {(["triage", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab ? `2px solid ${ACCENT}` : "2px solid transparent",
                  color: activeTab === tab ? "#fff" : MUTED,
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 700 : 500,
                  padding: "8px 18px",
                  cursor: "pointer",
                  letterSpacing: 0.3,
                  transition: "color 0.15s",
                  marginBottom: -1,
                }}
              >
                {tab === "triage" ? "⚡ Triage" : "🗓 History"}
              </button>
            ))}
          </div>

          {/* ── HISTORY TAB ─────────────────────────────────────────────────────────────── */}
          {activeTab === "history" && (
            <HistoryTab
              historyQuery={historyQuery}
              selectedHistoryId={selectedHistoryId}
              setSelectedHistoryId={setSelectedHistoryId}
              historyItemQuery={historyItemQuery}
              classConfig={classConfig}
              scoreBadgeColor={scoreBadgeColor}
              onRetriage={handleRetriage}
            />
          )}

          {/* ── TRIAGE TAB ─────────────────────────────────────────────────────────────── */}
          {activeTab === "triage" && (
          <>

          {/* ── INPUT STATE ──────────────────────────────────────────────────────── */}
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
                  ⚡ Get Decision
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
                    Triage Another →
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

              {/* Decision guidance */}
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
                <span style={{ color: MUTED, fontSize: 12 }}>Decision guidance:</span>
                <span style={{ color: TEXT2, fontSize: 12, fontWeight: 600 }}>
                  {result.nextStep}
                </span>
              </div>

              {/* ── Next Actions block ─────────────────────────────────── */}
              <div
                style={{
                  background: "rgba(124,58,237,0.06)",
                  border: `1px solid rgba(124,58,237,0.25)`,
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 0.8, marginBottom: 12, textTransform: "uppercase" as const }}>
                  Next Actions
                </div>
                {result.classification === "ENGAGE" && (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    <button
                      onClick={handleEscalate}
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "11px 18px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left" as const,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>🚀</span>
                      <span>Run Full IC Analysis →</span>
                    </button>
                    <div style={{ fontSize: 11, color: MUTED, paddingLeft: 4 }}>
                      High potential detected — escalate to full evaluation with 10 specialist agents.
                    </div>
                  </div>
                )}
                {result.classification === "WATCH" && (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    <button
                      onClick={() => {
                        // Copy pitch to clipboard for follow-up tracking
                        navigator.clipboard?.writeText(pitchText).catch(() => {});
                      }}
                      style={{
                        background: "rgba(245,158,11,0.12)",
                        color: "#fbbf24",
                        border: "1px solid rgba(245,158,11,0.35)",
                        borderRadius: 8,
                        padding: "11px 18px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left" as const,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>📋</span>
                      <span>Copy pitch for follow-up tracking</span>
                    </button>
                    <div style={{ fontSize: 11, color: MUTED, paddingLeft: 4 }}>
                      Mixed signals — request more information before committing. Re-triage when ready.
                    </div>
                  </div>
                )}
                {result.classification === "IGNORE" && (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    <div
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: 8,
                        padding: "11px 18px",
                        fontWeight: 600,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>🗂</span>
                      <span>Archived — low priority</span>
                    </div>
                    <div style={{ fontSize: 11, color: MUTED, paddingLeft: 4 }}>
                      Insufficient signals. Saved to history. Re-triage if the founder provides more information.
                    </div>
                  </div>
                )}
              </div>

              {/* ── Triage routing CTA (ENGAGE only) ──────────────────── */}
              {result.classification === "ENGAGE" && (
                <div
                  style={{
                    background: "rgba(34,197,94,0.06)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap" as const,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>
                        High potential detected
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        Run full IC analysis to get a 35-page institutional-grade memo in under 4 minutes.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleEscalate}
                    style={{
                      background: `linear-gradient(135deg, #22c55e, #16a34a)`,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "9px 18px",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    Run Full IC Analysis →
                  </button>
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ── HistoryTab sub-component ───────────────────────────────────────────────────────────────
import type { PitchTriage as PitchTriageRow } from "../../../drizzle/schema";

interface HistoryTabProps {
  historyQuery: { data?: PitchTriageRow[]; isLoading: boolean; error: { message: string } | null };
  selectedHistoryId: number | null;
  setSelectedHistoryId: (id: number | null) => void;
  historyItemQuery: { data?: PitchTriageRow; isLoading: boolean };
  classConfig: Record<string, { bg: string; border: string; text: string; label: string; desc: string }>;
  scoreBadgeColor: (score: number) => { ring: string; text: string };
  onRetriage: (previewText: string, parentId: number) => void;
}

function HistoryTab({
  historyQuery,
  selectedHistoryId,
  setSelectedHistoryId,
  historyItemQuery,
  classConfig,
  scoreBadgeColor,
  onRetriage,
}: HistoryTabProps) {
  const BORDER = "rgba(255,255,255,0.08)";
  const MUTED = "rgba(255,255,255,0.45)";
  const TEXT2 = "rgba(255,255,255,0.7)";
  const BG2 = "rgba(255,255,255,0.04)";
  const ACCENT = "#7c3aed";

  // Filter chip state — default all selected
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(["ENGAGE", "WATCH", "IGNORE"])
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  // Date range filter — default 30 days
  type DateRange = "7d" | "30d" | "all";
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  type SortBy = "newest" | "highest_score";
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  function toggleFilter(cls: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(cls);
      } else {
        next.add(cls);
      }
      return next;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    }).catch(() => {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    });
  }

  if (historyQuery.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: MUTED, fontSize: 13 }}>
        Loading history…
      </div>
    );
  }

  if (historyQuery.error) {
    return (
      <div
        style={{
          background: "rgba(239,68,68,0.10)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 8,
          padding: "12px 16px",
          color: "#f87171",
          fontSize: 13,
        }}
      >
        Failed to load history: {historyQuery.error.message}
      </div>
    );
  }

  const allRows = historyQuery.data ?? [];

  // Apply date range filter
  const now = Date.now();
  const rangeMs: Record<string, number> = { "7d": 7 * 86400000, "30d": 30 * 86400000, "all": Infinity };
  const rows = allRows.filter((r) => {
    const age = now - new Date(r.createdAt).getTime();
    return age <= rangeMs[dateRange];
  });

  if (allRows.length === 0) {
    return (
      <div
        style={{
          background: BG2,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗓</div>
        <p style={{ color: TEXT2, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          No triage history yet
        </p>
        <p style={{ color: MUTED, fontSize: 12 }}>
          Run your first triage to see results here.
        </p>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedHistoryId !== null) {
    if (historyItemQuery.isLoading) {
      return (
        <div style={{ textAlign: "center", padding: 48, color: MUTED, fontSize: 13 }}>
          Loading…
        </div>
      );
    }

    const item = historyItemQuery.data;
    if (!item) {
      return (
        <div style={{ color: "#f87171", fontSize: 13, padding: 16 }}>
          Record not found.{" "}
          <button
            onClick={() => setSelectedHistoryId(null)}
            style={{ color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            ← Back
          </button>
        </div>
      );
    }

    // Parse stored JSON fields
    let agentOutputs: AgentOutput[] = [];
    let keySignals: string[] = [];
    let missingInfo: string[] = [];
    let topMissingFields: string[] = [];
    try { agentOutputs = JSON.parse(item.agentOutputs ?? "[]"); } catch { /* ignore */ }
    try { keySignals = JSON.parse(item.keySignals ?? "[]"); } catch { /* ignore */ }
    try { missingInfo = JSON.parse(item.missingInfo ?? "[]"); } catch { /* ignore */ }
    try { topMissingFields = JSON.parse(item.topMissingFields ?? "[]"); } catch { /* ignore */ }

    const cfg = classConfig[item.classification];
    const scoreColors = scoreBadgeColor(item.score);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Back button */}
        <button
          onClick={() => setSelectedHistoryId(null)}
          style={{
            background: "none",
            border: "none",
            color: "#a78bfa",
            fontSize: 13,
            cursor: "pointer",
            alignSelf: "flex-start",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Back to History
        </button>

        {/* Date + preview */}
        <div
          style={{
            background: BG2,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: "10px 16px",
          }}
        >
          <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>
            {fmtKuwait(item.createdAt)}
          </div>
          <div style={{ color: TEXT2, fontSize: 13, fontStyle: "italic" }}>
            "{item.pitchPreview}{item.pitchPreview.length >= 200 ? "…" : ""}"
          </div>
        </div>

        {/* Classification banner + score */}
        <div
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: `3px solid ${scoreColors.ring}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 800, color: scoreColors.text, lineHeight: 1 }}>
              {item.score}
            </span>
            <span style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>/100</span>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: cfg.text, letterSpacing: 1 }}>
              {item.classification}
            </div>
            <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>{cfg.desc}</div>
            <div style={{ marginTop: 6 }}>
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
                CONFIDENCE: {item.confidence}
              </span>
            </div>
          </div>
        </div>

        {/* Low confidence warning */}
        {item.confidence === "LOW" && topMissingFields.length > 0 && (
          <div
            style={{
              background: "rgba(245,158,11,0.10)",
              border: "1px solid rgba(245,158,11,0.30)",
              borderRadius: 8,
              padding: "10px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Low Confidence — Insufficient Pitch Data
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {topMissingFields.map((f) => (
                  <span
                    key={f}
                    style={{
                      background: "rgba(245,158,11,0.15)",
                      color: "#fbbf24",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agent grid */}
        {agentOutputs.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {AGENT_ORDER.map((name) => {
              const agent = agentOutputs.find((a) => a.name === name);
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
                  </div>
                  <p style={{ color: TEXT2, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                    {agent.reasoning}
                  </p>
                  <div style={{ marginTop: 8, fontSize: 10, color: MUTED }}>
                    weight: {AGENT_META[name].weight}%
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Key signals + missing info */}
        {(keySignals.length > 0 || missingInfo.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {keySignals.length > 0 && (
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
                  {keySignals.map((sig, i) => (
                    <li
                      key={i}
                      style={{
                        color: TEXT2,
                        fontSize: 12,
                        lineHeight: 1.5,
                        paddingBottom: 6,
                        borderBottom: i < keySignals.length - 1 ? "1px solid rgba(34,197,94,0.1)" : "none",
                        marginBottom: i < keySignals.length - 1 ? 6 : 0,
                      }}
                    >
                      {sig}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {missingInfo.length > 0 && (
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
                  {missingInfo.map((info, i) => (
                    <li
                      key={i}
                      style={{
                        color: TEXT2,
                        fontSize: 12,
                        lineHeight: 1.5,
                        paddingBottom: 6,
                        borderBottom: i < missingInfo.length - 1 ? "1px solid rgba(239,68,68,0.1)" : "none",
                        marginBottom: i < missingInfo.length - 1 ? 6 : 0,
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

        {/* Next step */}
        {item.nextStep && (
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
            <span style={{ color: TEXT2, fontSize: 12, fontWeight: 600 }}>{item.nextStep}</span>
          </div>
        )}

        {/* Action bar: Copy + Re-run */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
          {/* Copy Summary */}
          <button
            onClick={() => {
              const summary = [
                `PITCH TRIAGE RESULT`,
                `Date: ${fmtKuwait(item.createdAt)}`,
                `Score: ${item.score}/100`,
                `Classification: ${item.classification}`,
                `Confidence: ${item.confidence}`,
                ``,
                `KEY SIGNALS`,
                ...keySignals.map((s) => `  • ${s}`),
                ``,
                `MISSING / WEAK`,
                ...missingInfo.map((s) => `  • ${s}`),
                ``,
                `NEXT STEP: ${item.nextStep ?? "N/A"}`,
              ].join("\n");
              copyToClipboard(summary);
            }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: copyState === "copied" ? "#4ade80" : TEXT2,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {copyState === "copied" ? "✓ Copied!" : "📋 Copy Summary"}
          </button>

          {/* Copy as Markdown */}
          <button
            onClick={() => {
              const md = [
                `## Pitch Triage Result`,
                ``,
                `**Date:** ${fmtKuwait(item.createdAt)}  `,
                `**Score:** ${item.score}/100  `,
                `**Classification:** ${item.classification}  `,
                `**Confidence:** ${item.confidence}  `,
                ``,
                `### Key Signals`,
                ...keySignals.map((s) => `- ${s}`),
                ``,
                `### Missing / Weak`,
                ...missingInfo.map((s) => `- ${s}`),
                ``,
                `### Agent Outputs`,
                ...agentOutputs.map((a) => `- **${a.name}** \`${a.label}\` — ${a.reasoning}`),
                ``,
                `**Next Step:** ${item.nextStep ?? "N/A"}`,
              ].join("\n");
              copyToClipboard(md);
            }}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              color: copyState === "copied" ? "#4ade80" : TEXT2,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {copyState === "copied" ? "✓ Copied!" : "✍️ Copy as Markdown"}
          </button>

          {/* Re-run Triage */}
          <button
            onClick={() => onRetriage(item.pitchPreview, item.id)}
            style={{
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 6,
              color: "#a78bfa",
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
              marginLeft: "auto",
            }}
          >
            ⚡ Re-run Triage
          </button>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  // Counts per classification (from date-filtered rows)
  const counts = { ENGAGE: 0, WATCH: 0, IGNORE: 0 };
  for (const r of rows) {
    if (r.classification in counts) counts[r.classification as keyof typeof counts]++;
  }
  // Escalation counts (ENGAGE rows that have escalatedAt set)
  const engageTotal = rows.filter((r) => r.classification === "ENGAGE").length;
  const escalatedCount = rows.filter((r) => r.classification === "ENGAGE" && r.escalatedAt).length;
  const filteredRowsUnsorted = rows.filter((r) => activeFilters.has(r.classification));
  const filteredRows = [...filteredRowsUnsorted].sort((a, b) => {
    if (sortBy === "highest_score") return (b.score ?? 0) - (a.score ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const CHIP_COLORS: Record<string, { active: { bg: string; border: string; text: string }; inactive: { bg: string; border: string; text: string } }> = {
    ENGAGE: {
      active: { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.5)", text: "#4ade80" },
      inactive: { bg: "rgba(255,255,255,0.04)", border: BORDER, text: MUTED },
    },
    WATCH: {
      active: { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.5)", text: "#fbbf24" },
      inactive: { bg: "rgba(255,255,255,0.04)", border: BORDER, text: MUTED },
    },
    IGNORE: {
      active: { bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.5)", text: "#f87171" },
      inactive: { bg: "rgba(255,255,255,0.04)", border: BORDER, text: MUTED },
    },
  };

  const DATE_RANGE_LABELS: Record<DateRange, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "all": "All time" };
  const conversionRate = engageTotal > 0 ? Math.round((escalatedCount / engageTotal) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* System Signals summary */}
      <div
        style={{
          background: "rgba(124,58,237,0.06)",
          border: "1px solid rgba(124,58,237,0.18)",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap" as const,
        }}
      >
        <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" as const }}>System Signals</span>
        <span style={{ fontSize: 11, color: TEXT2 }}>
          <span style={{ color: TEXT2, fontWeight: 700 }}>{rows.length}</span> decision{rows.length !== 1 ? "s" : ""} made
        </span>
        <span style={{ fontSize: 11, color: "#4ade80" }}>
          <span style={{ fontWeight: 700 }}>{counts.ENGAGE}</span> ENGAGE
        </span>
        <span style={{ fontSize: 11, color: "#fbbf24" }}>
          <span style={{ fontWeight: 700 }}>{counts.WATCH}</span> WATCH
        </span>
        <span style={{ fontSize: 11, color: "#f87171" }}>
          <span style={{ fontWeight: 700 }}>{counts.IGNORE}</span> IGNORE
        </span>
        {escalatedCount > 0 && (
          <span style={{ fontSize: 11, color: "#a78bfa" }}>
            <span style={{ fontWeight: 700 }}>{escalatedCount}</span> escalated · <span style={{ fontWeight: 700 }}>{conversionRate}%</span> conversion
          </span>
        )}
      </div>

      {/* Date range + Sort toggles */}
      <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" as const, alignItems: "center" }}>
        {(["7d", "30d", "all"] as DateRange[]).map((range) => {
          const isActive = dateRange === range;
          return (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              style={{
                background: isActive ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? "rgba(124,58,237,0.5)" : BORDER}`,
                borderRadius: 16,
                color: isActive ? "#a78bfa" : MUTED,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                padding: "3px 10px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {DATE_RANGE_LABELS[range]}
            </button>
          );
         })}
        <span style={{ color: BORDER, fontSize: 11, alignSelf: "center", userSelect: "none" as const }}>|</span>
        {(["newest", "highest_score"] as SortBy[]).map((s) => {
          const isActive = sortBy === s;
          return (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              style={{
                background: isActive ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? "rgba(124,58,237,0.5)" : BORDER}`,
                borderRadius: 16,
                color: isActive ? "#a78bfa" : MUTED,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                padding: "3px 10px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {s === "newest" ? "Newest first" : "Highest score"}
            </button>
          );
        })}
      </div>

      {/* Filter chips + escalation indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["ENGAGE", "WATCH", "IGNORE"] as const).map((cls) => {
          const isActive = activeFilters.has(cls);
          const colors = isActive ? CHIP_COLORS[cls].active : CHIP_COLORS[cls].inactive;
          return (
            <button
              key={cls}
              onClick={() => toggleFilter(cls)}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 20,
                color: colors.text,
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 12px",
                cursor: "pointer",
                letterSpacing: 0.4,
                transition: "all 0.15s",
              }}
            >
              {cls} · {counts[cls]}
            </button>
          );
        })}
        <span style={{ color: MUTED, fontSize: 11, alignSelf: "center", marginLeft: 4 }}>
          {filteredRows.length} of {rows.length} shown
        </span>
        {engageTotal > 0 && (
          <span
            style={{
              fontSize: 10,
              color: "#4ade80",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 10,
              padding: "2px 8px",
              marginLeft: "auto",
              whiteSpace: "nowrap",
            }}
            title="ENGAGE results escalated to Deal Screener"
          >
            ↑ escalated {escalatedCount}/{engageTotal}
          </span>
        )}
      </div>

      {filteredRows.length === 0 && (
        <div
          style={{
            background: BG2,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: "32px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 10 }}>🗓</div>
          <p style={{ color: TEXT2, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {rows.length === 0
              ? dateRange === "7d"
                ? "No triages in the last 7 days"
                : dateRange === "30d"
                ? "No triages in the last 30 days"
                : "No triages yet"
              : "No triages match the selected filters"}
          </p>
          <p style={{ color: MUTED, fontSize: 11 }}>
            {rows.length === 0 && dateRange !== "all"
              ? "Try switching to \"All time\" to see older results."
              : "Adjust the classification filters above to see more results."}
          </p>
        </div>
      )}

      {filteredRows.map((row) => {
        const cfg = classConfig[row.classification];
        const scoreColors = scoreBadgeColor(row.score);
        return (
          <button
            key={row.id}
            onClick={() => setSelectedHistoryId(row.id)}
            style={{
              background: BG2,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: "14px 18px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 16,
              transition: "border-color 0.15s",
              width: "100%",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = `rgba(124,58,237,0.4)`)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = BORDER)
            }
          >
            {/* Score badge */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: `2px solid ${scoreColors.ring}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 800, color: scoreColors.text, lineHeight: 1 }}>
                {row.score}
              </span>
            </div>

            {/* Main content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: cfg.text,
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 4,
                    padding: "1px 7px",
                    letterSpacing: 0.5,
                  }}
                >
                  {row.classification}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: MUTED,
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 4,
                    padding: "1px 6px",
                  }}
                >
                  {row.confidence}
                </span>
                {row.parentTriageId && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#a78bfa",
                      background: "rgba(124,58,237,0.12)",
                      border: "1px solid rgba(124,58,237,0.25)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 600,
                    }}
                  >
                    RE-RUN
                  </span>
                )}
                {row.escalatedAt && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#4ade80",
                      background: "rgba(34,197,94,0.10)",
                      border: "1px solid rgba(34,197,94,0.22)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 600,
                    }}
                  >
                    ↑ Escalated
                  </span>
                )}
              </div>
              <div
                style={{
                  color: TEXT2,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontStyle: "italic",
                }}
              >
                "{row.pitchPreview}"
              </div>
            </div>

            {/* Date */}
            <div style={{ color: MUTED, fontSize: 11, flexShrink: 0, textAlign: "right" }}>
              {fmtKuwait(row.createdAt)}
            </div>

            {/* Arrow */}
            <span style={{ color: MUTED, fontSize: 14, flexShrink: 0 }}>›</span>
          </button>
        );
      })}
    </div>
  );
}
