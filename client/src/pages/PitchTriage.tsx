/**
 * PitchTriage.tsx
 * Fast (~5s) lightweight pre-filter for deals.
 * 6 parallel micro-agents → deterministic score → ENGAGE / WATCH / IGNORE
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { trpc } from "@/lib/trpc";
import MeshSidebar from "@/components/MeshSidebar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/analytics";

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
  | "Completeness"
  | "Macro Sentinel"
  | "Sector Specialist"
  | "Competitive Moat"
  | "Execution Risk";

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
type AnalysisDepth = "quick" | "deep";
const AGENT_META: Record<AgentName, { icon: string; weight: number; webSearch?: boolean }> = {
  Traction: { icon: "📈", weight: 22 },
  "Market Signal": { icon: "🌐", weight: 20, webSearch: true },
  "Founder Signal": { icon: "👤", weight: 20 },
  "Business Model": { icon: "💡", weight: 18 },
  Risk: { icon: "⚠️", weight: 15 },
  Completeness: { icon: "📋", weight: 5 },
  // Deep-mode only agents
  "Macro Sentinel": { icon: "🏦", weight: 12, webSearch: true },
  "Sector Specialist": { icon: "🔭", weight: 14, webSearch: true },
  "Competitive Moat": { icon: "🛡️", weight: 12 },
  "Execution Risk": { icon: "⚙️", weight: 10 },
};
const AGENT_ORDER_QUICK: AgentName[] = [
  "Traction",
  "Market Signal",
  "Founder Signal",
  "Business Model",
  "Risk",
  "Completeness",
];
const AGENT_ORDER_DEEP: AgentName[] = [
  "Traction",
  "Market Signal",
  "Founder Signal",
  "Business Model",
  "Risk",
  "Completeness",
  "Macro Sentinel",
  "Sector Specialist",
  "Competitive Moat",
  "Execution Risk",
];
// Backward-compat alias — always points to quick order (used in HistoryTab etc.)
const AGENT_ORDER: AgentName[] = AGENT_ORDER_QUICK;

// ── Loading agent names (staggered reveal) ────────────────────────────────────────────
const LOADING_STEPS_QUICK = [
  "Initialising decision agents…",
  "Analysing traction signals…",
  "Scanning market landscape…",
  "Evaluating founder profile…",
  "Reviewing business model…",
  "Assessing risk factors…",
  "Checking pitch completeness…",
  "Computing decision score…",
];
const LOADING_STEPS_DEEP = [
  "Initialising 10-agent deep analysis…",
  "Fetching live market data…",
  "Analysing traction signals…",
  "Scanning market landscape…",
  "Evaluating founder profile…",
  "Reviewing business model…",
  "Assessing risk factors…",
  "Checking pitch completeness…",
  "Running macro & sector analysis…",
  "Mapping competitive moat…",
  "Evaluating execution risk…",
  "Synthesising deep decision score…",
];
const LOADING_STEPS = LOADING_STEPS_QUICK;

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
  const updateStage = trpc.pitch.updateStage.useMutation();
  const [movedToDiligence, setMovedToDiligence] = useState(false);
  // Analysis depth — persisted in localStorage
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>(() => {
    try { return (localStorage.getItem("atm_triage_depth") as AnalysisDepth) ?? "quick"; } catch { return "quick"; }
  });
  const [triageStartTime, setTriageStartTime] = useState<number | null>(null);
  const [triageElapsedSec, setTriageElapsedSec] = useState<number | null>(null);
  const [lastDepthUsed, setLastDepthUsed] = useState<AnalysisDepth>("quick");
  // Expansion state for per-deal pattern insight on result screen
  const [resultPatternExpanded, setResultPatternExpanded] = useState(false);
  const [resultCopyState, setResultCopyState] = useState<"idle" | "copied">("idle");

  // Pattern insight — derived from historical invested/passed outcomes vs current deal
  const currentAgentOutputsStr = useMemo(
    () => (result?.agentOutputs ? JSON.stringify(result.agentOutputs) : ""),
    [result?.agentOutputs]
  );
  const patternInsightQuery = trpc.pitch.patternInsight.useQuery(
    { currentAgentOutputs: currentAgentOutputsStr },
    {
      enabled: pageState === "RESULTS" && currentAgentOutputsStr.length > 0,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    }
  );

  // Stale deal count for History tab badge — derived from historyQuery.data, no new query
  const staleHistoryCount = useMemo(() => {
    const rows = historyQuery.data ?? [];
    const dismissed = (() => {
      try {
        const raw = localStorage.getItem("atm_dismissed_stale_nudges");
        return new Set<number>(raw ? JSON.parse(raw) : []);
      } catch { return new Set<number>(); }
    })();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return rows.filter(r => {
      const row = r as { id: number; stage?: string; decisionOutcome?: string | null; createdAt?: Date | string | number };
      if (row.decisionOutcome) return false;
      if (!row.stage || (row.stage !== "diligence" && row.stage !== "ic_ready")) return false;
      if (dismissed.has(row.id)) return false;
      const ts = row.createdAt ? new Date(row.createdAt as string).getTime() : 0;
      return now - ts >= THIRTY_DAYS_MS;
    }).length;
  }, [historyQuery.data]);

  // Calibration signal — loaded once per session, non-blocking
  const calibrationQuery = trpc.pitch.agentCalibration.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
  const calibrationMap = useMemo(() => {
    const map: Record<string, "high" | "moderate" | "low" | "insufficient"> = {};
    for (const entry of calibrationQuery.data ?? []) {
      map[entry.agentName] = entry.signal;
    }
    return map;
  }, [calibrationQuery.data]);

  const triage = trpc.pitch.triage.useMutation({
    onSuccess: (data) => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      const d = data as TriageResult & { id?: number };
      setResult(d);
      if (d.id) setSavedTriageId(d.id);
      setTriageElapsedSec(triageStartTime ? Math.round((Date.now() - triageStartTime) / 1000) : null);
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
    const activeOrder = lastDepthUsed === "deep" ? AGENT_ORDER_DEEP : AGENT_ORDER_QUICK;
    const activeSteps = lastDepthUsed === "deep" ? LOADING_STEPS_DEEP : LOADING_STEPS_QUICK;
    const intervalMs = lastDepthUsed === "deep" ? 1200 : 600;
    let step = 0;
    loadingTimerRef.current = setInterval(() => {
      step += 1;
      setLoadingStep(step);
      // Reveal agents one by one (deep: offset by 2 for "init" + "fetching" steps)
      const agentOffset = lastDepthUsed === "deep" ? 2 : 1;
      const agentIdx = step - agentOffset;
      if (agentIdx >= 0 && agentIdx < activeOrder.length) {
        const agentName = activeOrder[agentIdx];
        setCompletedAgents((prev) => { const next = new Set(prev); next.add(agentName); return next; });
      }
      if (step >= activeSteps.length - 1) {
        if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      }
    }, intervalMs);

    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, [pageState]);

  function handleSubmit() {
    if (!pitchText.trim() || pitchText.trim().length < 10) return;
    setError(null);
    setPageState("LOADING");
    setTriageStartTime(Date.now());
    setTriageElapsedSec(null);
    setLastDepthUsed(analysisDepth);
    triage.mutate({ pitchText: pitchText.trim(), parentTriageId: pendingParentId ?? undefined, depth: analysisDepth });
    setPendingParentId(null);
  }

  // Called from HistoryTab "Re-run Triage" button
  function handleRetriage(previewText: string, parentId: number, depth?: "quick" | "deep") {
    setPitchText(previewText);
    setPendingParentId(parentId);
    if (depth) {
      setAnalysisDepth(depth);
      try { localStorage.setItem("atm_triage_depth", depth); } catch {}
    }
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
    setMovedToDiligence(false);
  }

  function handleMoveToDiligence() {
    if (!savedTriageId) return;
    updateStage.mutate(
      { id: savedTriageId, stage: "diligence" },
      {
        onSuccess: () => {
          setMovedToDiligence(true);
          trackEvent("pitchtriage_move_to_diligence", {
            triageId: savedTriageId,
            classification: result?.classification,
            score: result?.score,
          });
        },
      }
    );
  }

  function handleEscalate() {
    if (!result) return;
    // Mark escalation in DB (fire-and-forget)
    if (savedTriageId) {
      markEscalated.mutate({ id: savedTriageId });
    }
    // Analytics: track escalation to IC Memo
    trackEvent("pitchtriage_escalate_to_ic", {
      triageId: savedTriageId,
      classification: result.classification,
      score: result.score,
    });
    // Pass pitch text AND triage ID to DealScreener so it can:
    //   1. Pre-populate the deal textarea (pitchTriageText)
    //   2. Auto-advance stage to ic_ready after IC Memo PDF is generated (pitchTriageId)
    // Belt-and-suspenders: also write to sessionStorage for href-based navigation
    sessionStorage.setItem("pitchTriageEscalation", pitchText);
    if (savedTriageId) {
      sessionStorage.setItem("pitchTriageEscalationId", String(savedTriageId));
    }
    // Pass patternContext so DealScreener can inject it into the IC Memo prompt
    const patternType = patternInsightQuery.data?.type;
    if (patternType === "invested_match" || patternType === "passed_match") {
      sessionStorage.setItem("pitchTriagePatternContext", patternType);
    } else {
      sessionStorage.removeItem("pitchTriagePatternContext");
    }
    navigate("/deals", { state: { pitchTriageText: pitchText, pitchTriageId: savedTriageId ?? undefined, patternContext: (patternType === "invested_match" || patternType === "passed_match") ? patternType : undefined } });
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
    <MeshSidebar>
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
                {tab === "triage" ? "⚡ Triage" : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    📅 History
                    {staleHistoryCount > 0 && (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#d97706",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 9999,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        lineHeight: 1,
                      }}>
                        {staleHistoryCount}
                      </span>
                    )}
                  </span>
                )}
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
                {/* Mode selector */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {(["quick", "deep"] as AnalysisDepth[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setAnalysisDepth(d);
                        try { localStorage.setItem("atm_triage_depth", d); } catch {}
                      }}
                      style={{
                        padding: "5px 14px",
                        borderRadius: 20,
                        border: analysisDepth === d ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                        background: analysisDepth === d ? `rgba(124,58,237,0.18)` : "transparent",
                        color: analysisDepth === d ? "#c4b5fd" : MUTED,
                        fontSize: 12,
                        fontWeight: analysisDepth === d ? 700 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {d === "quick" ? "⚡ Quick" : "🔬 Deep"}
                    </button>
                  ))}
                  {analysisDepth === "deep" && (
                    <span style={{ color: MUTED, fontSize: 11, marginLeft: 4 }}>10 agents · ~30s</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: MUTED, fontSize: 12 }}>
                    {pitchText.length.toLocaleString()} chars
                    {pitchText.length > (analysisDepth === "deep" ? 6000 : 3000) && (
                      <span style={{ color: AMBER, marginLeft: 6 }}>
                        (first {analysisDepth === "deep" ? "6,000" : "3,000"} chars used)
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
                    {analysisDepth === "deep" ? "🔬 Deep Analysis" : "⚡ Get Decision"}
                  </Button>
                </div>
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
                  {analysisDepth === "deep" ? "10 AGENTS WILL EVALUATE IN PARALLEL" : "6 AGENTS WILL EVALUATE IN PARALLEL"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(analysisDepth === "deep" ? AGENT_ORDER_DEEP : AGENT_ORDER_QUICK).map((name) => (
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

              {/* ── Decision Memo header ───────────────────────────────────── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap" as const,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" as const }}>
                      Decision Memo
                    </div>
                    {lastDepthUsed === "deep" && (
                      <span style={{
                        background: "rgba(124,58,237,0.2)",
                        border: "1px solid rgba(124,58,237,0.5)",
                        color: "#c4b5fd",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20,
                        letterSpacing: 0.5,
                      }}>
                        🔬 DEEP ANALYSIS
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{fmtKuwait(new Date())}</span>
                    {lastDepthUsed === "deep" && (
                      <span style={{ color: MUTED }}>
                        · {lastDepthUsed === "deep" ? "10" : "6"} agents{triageElapsedSec !== null ? ` · ${triageElapsedSec}s` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                  {/* Copy as Memo */}
                  <button
                    onClick={() => {
                      const agentLines = result.agentOutputs
                        .map((a) => `  ${a.name} [${a.label.toUpperCase()}]: ${a.reasoning}`)
                        .join("\n");
                      const signals = result.keySignals.length > 0 ? `\n\nKey Signals:\n${result.keySignals.map((s) => `  + ${s}`).join("\n")}` : "";
                      const missing = result.missingInfo.length > 0 ? `\n\nMissing / Weak:\n${result.missingInfo.map((s) => `  - ${s}`).join("\n")}` : "";
                      const memo = [
                        `TRIAGE MEMO — ${fmtKuwait(new Date())}`,
                        `Decision: ${result.classification}  |  Score: ${result.score}/100  |  Confidence: ${result.confidence}`,
                        ``,
                        `Guidance: ${result.nextStep}`,
                        ``,
                        `Agent Breakdown:`,
                        agentLines,
                        signals,
                        missing,
                      ].join("\n");
                      navigator.clipboard?.writeText(memo).then(() => {
                        setResultCopyState("copied");
                        setTimeout(() => setResultCopyState("idle"), 2000);
                      }).catch(() => {});
                    }}
                    style={{
                      background: resultCopyState === "copied" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${resultCopyState === "copied" ? "rgba(34,197,94,0.35)" : BORDER}`,
                      borderRadius: 8,
                      color: resultCopyState === "copied" ? "#4ade80" : TEXT2,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "7px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {resultCopyState === "copied" ? "✓ Copied!" : "📋 Copy Memo"}
                  </button>
                  <Button
                    onClick={handleReset}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      color: TEXT2,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: "7px 14px",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    Triage Another →
                  </Button>
                </div>
              </div>

              {/* ── Verdict block (decision-first) ─────────────────────────────── */}
              <div
                style={{
                  background: classConfig[result.classification].bg,
                  border: `1px solid ${classConfig[result.classification].border}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap" as const,
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
                      {lastDepthUsed === "deep" && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "#a78bfa",
                            background: "rgba(124,58,237,0.10)",
                            borderRadius: 4,
                            padding: "2px 7px",
                            fontWeight: 600,
                            letterSpacing: 0.5,
                          }}
                        >
                          🌐 WEB-AUGMENTED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
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
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      Run Full Evaluation →
                    </Button>
                  )}
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

              {/* ── Agent Breakdown section label ──────────────────────────────────── */}
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: -4 }}>
                Agent Breakdown
              </div>
              {/* Agent grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {(lastDepthUsed === "deep" ? AGENT_ORDER_DEEP : AGENT_ORDER_QUICK).map((name) => {
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
                        weight: {AGENT_META[name as AgentName]?.weight ?? 0}%
                        {lastDepthUsed === "deep" && AGENT_META[name as AgentName]?.webSearch && (
                          <span style={{ marginLeft: 6, color: "#60a5fa", fontSize: 9 }}>🌐 web-augmented</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Evidence section label ─────────────────────────────────────────── */}
              {(result.keySignals.length > 0 || result.missingInfo.length > 0) && (
                <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: -4 }}>
                  Evidence
                </div>
              )}
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

              {/* Decision guidance — memo-style */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${classConfig[result.classification].border}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 4 }}>Recommended Next Step</div>
                <div style={{ color: TEXT2, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
                  {result.nextStep}
                </div>
              </div>

              {/* ── Agent Conflict block ──────────────────────────────── */}
              {(() => {
                // Classify each agent output as positive or negative based on its label
                const POSITIVE_LABELS = new Set(["strong", "clear", "low", "complete"]);
                const NEGATIVE_LABELS = new Set(["weak", "high", "incomplete", "absent", "unclear", "partial", "early", "neutral"]);

                // Signal dot helper — renders a subtle calibration indicator
                const SIGNAL_DOT: Record<string, { dot: string; color: string; label: string; tooltip: string }> = {
                  high:   { dot: "●", color: "#4ade80", label: "high signal",     tooltip: "This agent's past recommendations have aligned with deal progression in similar cases" },
                  moderate: { dot: "◐", color: "#facc15", label: "moderate signal", tooltip: "This agent has shown partial alignment with deal progression" },
                  low:    { dot: "○", color: "#f87171", label: "low signal",      tooltip: "This agent's votes have had limited correlation with deal progression so far" },
                };
                const SignalDot = ({ agentName }: { agentName: string }) => {
                  const sig = calibrationMap[agentName];
                  const cfg = sig ? SIGNAL_DOT[sig] : null;
                  if (!cfg) return null;
                  return (
                    <span
                      title={cfg.tooltip}
                      style={{ fontSize: 9, color: cfg.color, cursor: "default", userSelect: "none" as const, marginLeft: 2, flexShrink: 0 }}
                    >
                      {cfg.dot} {cfg.label}
                    </span>
                  );
                };

                // Only consider the top-weighted agents (exclude Completeness which is noise)
                const CONFLICT_AGENTS: AgentName[] = ["Traction", "Market Signal", "Founder Signal", "Business Model", "Risk"];

                const positiveAgents = result.agentOutputs.filter(
                  (a) => CONFLICT_AGENTS.includes(a.name as AgentName) && POSITIVE_LABELS.has(a.label)
                );
                const negativeAgents = result.agentOutputs.filter(
                  (a) => CONFLICT_AGENTS.includes(a.name as AgentName) && NEGATIVE_LABELS.has(a.label)
                );

                // Meaningful conflict: at least 1 positive AND at least 1 negative among top agents
                const hasConflict = positiveAgents.length >= 1 && negativeAgents.length >= 1;

                // Pick the strongest positive (highest weight) and strongest negative (highest weight)
                const sortByWeight = (arr: AgentOutput[]) =>
                  [...arr].sort((a, b) => (AGENT_META[b.name as AgentName]?.weight ?? 0) - (AGENT_META[a.name as AgentName]?.weight ?? 0));

                const topPositive = positiveAgents.length > 0 ? sortByWeight(positiveAgents)[0] : null;
                const topNegative = negativeAgents.length > 0 ? sortByWeight(negativeAgents)[0] : null;

                if (!hasConflict && !topPositive && !topNegative) return null;

                // Truncate reasoning to first sentence (≤ 90 chars)
                const firstSentence = (text: string, maxLen = 90) => {
                  const dot = text.indexOf(".");
                  const raw = dot !== -1 && dot < maxLen ? text.slice(0, dot + 1) : text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
                  return raw;
                };

                // Primary driver: negative side if conflict exists, otherwise positive side
                const primaryAgent = hasConflict ? topNegative : (topNegative ?? topPositive);
                const primaryIsNegative = primaryAgent ? NEGATIVE_LABELS.has(primaryAgent.label) : false;
                const primaryLabel = primaryIsNegative ? "Primary concern" : "Primary driver";
                const primaryColor = primaryIsNegative ? "#f87171" : "#4ade80";

                if (!hasConflict) {
                  // No conflict — show standalone Primary Driver line above Next Actions
                  if (!primaryAgent) return null;
                  return (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap" as const,
                      }}
                    >
                      <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" as const }}>
                        {primaryLabel}:
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: primaryColor, whiteSpace: "nowrap" as const }}>
                        {AGENT_META[primaryAgent.name as AgentName]?.icon ?? ""} {primaryAgent.name}
                        {(() => {
                          const sig = calibrationMap[primaryAgent.name];
                          const cfg = sig ? SIGNAL_DOT[sig] : null;
                          if (!cfg) return null;
                          return (
                            <span style={{ fontSize: 10, fontWeight: 400, color: cfg.color, marginLeft: 4 }}>({cfg.label} agent)</span>
                          );
                        })()}
                      </span>
                      <span style={{ fontSize: 11, color: TEXT2 }}>— {firstSentence(primaryAgent.reasoning)}</span>
                    </div>
                  );
                }

                const conflictPairs = [topPositive!, topNegative!];

                return (
                  <div
                    style={{
                      background: "rgba(245,158,11,0.07)",
                      border: "1px solid rgba(245,158,11,0.30)",
                      borderRadius: 10,
                      padding: "14px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>⚡</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: AMBER,
                          letterSpacing: 0.8,
                          textTransform: "uppercase" as const,
                        }}
                      >
                        Conflict detected
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: MUTED,
                          marginLeft: 4,
                        }}
                      >
                        agents disagree — review before deciding
                      </span>
                    </div>
                    {/* Primary concern line — inside conflict block, above rows */}
                    {primaryAgent && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 8,
                          flexWrap: "wrap" as const,
                          marginBottom: 10,
                          paddingBottom: 10,
                          borderBottom: "1px solid rgba(245,158,11,0.15)",
                        }}
                      >
                        <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" as const }}>
                          {primaryLabel}:
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: primaryColor, whiteSpace: "nowrap" as const }}>
                          {AGENT_META[primaryAgent.name as AgentName]?.icon ?? ""} {primaryAgent.name}
                          {(() => {
                            const sig = calibrationMap[primaryAgent.name];
                            const cfg = sig ? SIGNAL_DOT[sig] : null;
                            if (!cfg) return null;
                            return (
                              <span style={{ fontSize: 10, fontWeight: 400, color: cfg.color, marginLeft: 4 }}>({cfg.label} agent)</span>
                            );
                          })()}
                        </span>
                        <span style={{ fontSize: 11, color: TEXT2 }}>— {firstSentence(primaryAgent.reasoning)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                      {conflictPairs.map((agent) => {
                        const isPositive = POSITIVE_LABELS.has(agent.label);
                        const voteColor = isPositive ? "#4ade80" : "#f87171";
                        const voteBg = isPositive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
                        const voteLabel = isPositive ? "YES" : "NO";
                        const meta = AGENT_META[agent.name as AgentName];
                        return (
                          <div
                            key={agent.name}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                            }}
                          >
                            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{meta?.icon ?? "🤖"}</span>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" as const, flex: 1 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" as const }}>
                                {agent.name}
                              </span>
                              <SignalDot agentName={agent.name} />
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: voteColor,
                                  background: voteBg,
                                  borderRadius: 4,
                                  padding: "1px 7px",
                                  letterSpacing: 0.5,
                                  flexShrink: 0,
                                }}
                              >
                                {voteLabel}
                              </span>
                              <span style={{ fontSize: 12, color: TEXT2, lineHeight: 1.4 }}>
                                {firstSentence(agent.reasoning)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
              }

              {/* ── Pattern Insight block (clickable expand) ─────────────────────────────────────── */}
              {(() => {
                const insight = patternInsightQuery.data;
                if (!insight || insight.type === "none") return null;
                const isMixed = insight.type === "mixed_signal";
                const isPositive = insight.type === "invested_match";
                // Neutral (muted slate) for mixed, green for invested, amber for passed
                const borderColor = isMixed
                  ? "rgba(148,163,184,0.30)"
                  : isPositive ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.35)";
                const bgColor = isMixed
                  ? "rgba(148,163,184,0.05)"
                  : isPositive ? "rgba(16,185,129,0.06)" : "rgba(245,158,11,0.06)";
                const textColor = isMixed
                  ? "rgba(148,163,184,0.85)"
                  : isPositive ? "#10b981" : "#f59e0b";
                const chevronColor = isMixed
                  ? "rgba(148,163,184,0.45)"
                  : isPositive ? "rgba(16,185,129,0.6)" : "rgba(245,158,11,0.6)";
                const borderTopColor = isMixed
                  ? "rgba(148,163,184,0.10)"
                  : isPositive ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)";
                const icon = isMixed ? "○" : isPositive ? "✓" : "⚠";

                // Build explanation phrase from insight.signals using FACTOR_PHRASES
                const RESULT_FACTOR_PHRASES: Record<string, string> = {
                  "Traction": "strong traction",
                  "Market Signal": "strong market signal",
                  "Founder Signal": "strong founder signal",
                  "Business Model": "clear revenue model",
                  "Risk": isPositive ? "manageable risk" : "high risk",
                };
                const explanationFactors = (insight.signals ?? []).map(
                  (s: string) => RESULT_FACTOR_PHRASES[s] ?? s.toLowerCase()
                );

                return (
                  <div
                    style={{
                      background: bgColor,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      marginBottom: 4,
                    }}
                  >
                    {/* Summary line — clickable toggle */}
                    <button
                      onClick={() => setResultPatternExpanded((v) => !v)}
                      style={{
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        textAlign: "left" as const,
                      }}
                    >
                      <span style={{ fontSize: 14, color: textColor, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontSize: 13, color: textColor, fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
                        {insight.phrase}
                      </span>
                      {explanationFactors.length > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            color: chevronColor,
                            flexShrink: 0,
                            transition: "transform 0.15s",
                            display: "inline-block",
                            transform: resultPatternExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                            userSelect: "none" as const,
                          }}
                        >
                          ▾
                        </span>
                      )}
                    </button>

                    {/* Explanation line — revealed on expand */}
                    {resultPatternExpanded && explanationFactors.length > 0 && (
                      <div
                        style={{
                          padding: "0 16px 10px 38px",
                          borderTop: `1px solid ${borderTopColor}`,
                          paddingTop: 7,
                        }}
                      >
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                          Most common success signals:{" "}
                          <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
                            {explanationFactors.join(", ")}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()
              }

              {/* ── Decision Guidance line (pattern-grounded) ───────────────────────────────── */}
              {(() => {
                const insight = patternInsightQuery.data;
                if (!insight || insight.type === "none") return null;
                const guidanceMap: Record<string, string> = {
                  invested_match: "Based on your historical pattern, this deal warrants a first call.",
                  passed_match: "Based on your historical pattern, consider documenting your pass rationale.",
                  mixed_signal: "Mixed historical signals — gather more information before deciding.",
                };
                const guidanceText = guidanceMap[insight.type];
                if (!guidanceText) return null;
                const isMixed = insight.type === "mixed_signal";
                const isPositive = insight.type === "invested_match";
                const guidanceColor = isMixed
                  ? "rgba(148,163,184,0.60)"
                  : isPositive ? "rgba(16,185,129,0.75)" : "rgba(245,158,11,0.75)";
                return (
                  <div
                    style={{
                      fontSize: 12,
                      color: guidanceColor,
                      lineHeight: 1.5,
                      padding: "6px 4px 2px 4px",
                      letterSpacing: 0.1,
                    }}
                  >
                    {guidanceText}
                  </div>
                );
              })()}

              {/* ── Next Actions block ───────────────────────────────────────────────────────── */}
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
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                    {/* Primary CTA: escalate to IC Memo */}
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

                    {/* Secondary CTA: move to diligence stage */}
                    {savedTriageId && (
                      <button
                        onClick={handleMoveToDiligence}
                        disabled={movedToDiligence || updateStage.isPending}
                        style={{
                          background: movedToDiligence
                            ? "rgba(34,197,94,0.12)"
                            : "rgba(255,255,255,0.05)",
                          color: movedToDiligence ? "#4ade80" : TEXT2,
                          border: `1px solid ${
                            movedToDiligence
                              ? "rgba(34,197,94,0.35)"
                              : BORDER
                          }`,
                          borderRadius: 8,
                          padding: "10px 18px",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: movedToDiligence ? "default" : "pointer",
                          textAlign: "left" as const,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          opacity: updateStage.isPending ? 0.6 : 1,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <span>{movedToDiligence ? "✓" : "📂"}</span>
                        <span>
                          {movedToDiligence
                            ? "Moved to Diligence"
                            : updateStage.isPending
                            ? "Moving…"
                            : "Move to Diligence"}
                        </span>
                      </button>
                    )}
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
    </MeshSidebar>
  );
}

// ── HistoryTab sub-component ───────────────────────────────────────────────────────────────
import type { PitchTriage as PitchTriageRow } from "../../../drizzle/schema";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { sanitiseSlug } from "@/lib/csvFilename";
import { ScoreHistoryModal } from "@/components/ScoreHistoryModal";

interface HistoryTabProps {
  historyQuery: { data?: PitchTriageRow[]; isLoading: boolean; error: { message: string } | null };
  selectedHistoryId: number | null;
  setSelectedHistoryId: (id: number | null) => void;
  historyItemQuery: { data?: PitchTriageRow; isLoading: boolean };
  classConfig: Record<string, { bg: string; border: string; text: string; label: string; desc: string }>;
  scoreBadgeColor: (score: number) => { ring: string; text: string };
  onRetriage: (previewText: string, parentId: number, depth?: "quick" | "deep") => void;
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
  // Stage (pipeline) filter — default "all"
  type StageFilter = "all" | "triaged" | "diligence" | "ic_ready" | "decision_made";
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  // Signals-only filter — show only deals with at least one logged signal
  const [showSignalsOnly, setShowSignalsOnly] = useState(false);

  // Pattern signal expansion state
  const [patternExpanded, setPatternExpanded] = useState(false);

  // Stale deal nudge — dismissed state persisted in localStorage
  const [dismissedNudges, setDismissedNudges] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem("atm_dismissed_stale_nudges");
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch { /* ignore */ }
    return new Set<number>();
  });

  function dismissNudge(id: number) {
    setDismissedNudges((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("atm_dismissed_stale_nudges", JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  }

  // Outcome recording
  const recordOutcomeMutation = trpc.pitch.recordOutcome.useMutation();
  const [outcomeState, setOutcomeState] = useState<Record<number, "invested" | "passed" | "recording" | null>>({});

  // Auto re-evaluate
  const checkAndTriggerMutation = trpc.pitch.checkAndTrigger.useMutation();
  const [reEvalState, setReEvalState] = useState<Record<number, "idle" | "running" | "done" | "error">>({});
  const utils = trpc.useUtils();

  // Signal panel state
  const [signalPanelOpen, setSignalPanelOpen] = useState<Record<number, boolean>>({});
  const [signalType, setSignalType] = useState<Record<number, string>>({});
  const [signalText, setSignalText] = useState<Record<number, string>>({});
  const [signalState, setSignalState] = useState<Record<number, "idle" | "submitting" | "success" | "error">>({});
  const logSignalMutation = trpc.pitch.logSignal.useMutation();
  // Recent signals query — keyed to selected deal
  const signalsQuery = trpc.pitch.getSignals.useQuery(
    { dealId: String(selectedHistoryId ?? 0) },
    { enabled: selectedHistoryId != null }
  );
  // Auto re-triage count (last 30 days)
  const autoTriggerCountQuery = trpc.pitch.autoTriggerCount.useQuery();
  // Signal type summary for Pipeline Summary
  const signalTypeSummaryQuery = trpc.pitch.signalTypeSummary.useQuery();
  // Score history modal state
  const [scoreModalDealId, setScoreModalDealId] = useState<number | null>(null);
  // Task 2: tracks which delta badge button is keyboard-focused (for focus-visible ring)
  const [focusedBadgeKey, setFocusedBadgeKey] = useState<string | null>(null);
  // Task 3: per-deal showAll map — persists showAll preference across open/close per dealId
  const [scoreHistoryShowAllMap, setScoreHistoryShowAllMap] = useState<Record<number, boolean>>({});
  const scoreHistoryQuery = trpc.pitch.scoreHistory.useQuery(
    { dealId: String(scoreModalDealId ?? 0) },
    { enabled: scoreModalDealId != null }
  );

  function handleRecordOutcome(id: number, outcome: "invested" | "passed") {
    setOutcomeState((prev) => ({ ...prev, [id]: "recording" }));
    recordOutcomeMutation.mutate(
      { id, outcome },
      {
        onSuccess: () => {
          setOutcomeState((prev) => ({ ...prev, [id]: outcome }));
        },
        onError: () => {
          setOutcomeState((prev) => ({ ...prev, [id]: null }));
        },
      }
    );
  }

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

        {/* Auto-trigger notice */}
        {(item as unknown as { source?: string }).source === "auto" && (() => {
          const tt = (item as unknown as { triggerType?: string }).triggerType;
          const isSignal = tt === "signal_triggered" || tt === "external_signal";
          const prevScore = (item as unknown as { prevScore?: number | null }).prevScore ?? null;
          const scoreDiff = prevScore !== null ? item.score - prevScore : null;
          return (
            <>
              <div
                style={{
                  background: isSignal ? "rgba(96,165,250,0.08)" : "rgba(251,191,36,0.08)",
                  border: `1px solid ${isSignal ? "rgba(96,165,250,0.25)" : "rgba(251,191,36,0.25)"}`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: isSignal ? "#60a5fa" : "#fbbf24",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14 }}>{isSignal ? "📡" : "⚡"}</span>
                <span>{isSignal ? "This analysis was triggered by an external signal." : "This analysis was triggered automatically by the system."}</span>
              </div>
              {/* Score diff — only for signal-triggered rows with a previous triage */}
              {isSignal && scoreDiff !== null && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${scoreDiff > 0 ? "rgba(74,222,128,0.22)" : scoreDiff < 0 ? "rgba(248,113,113,0.22)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 8,
                    padding: "7px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}
                >
                  {scoreDiff > 0 ? (
                    <>
                      <span style={{ color: "#4ade80", fontWeight: 700 }}>↑ {scoreDiff} pts</span>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>{prevScore} → {item.score}</span>
                    </>
                  ) : scoreDiff < 0 ? (
                    <>
                      <span style={{ color: "#f87171", fontWeight: 700 }}>↓ {Math.abs(scoreDiff)} pts</span>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>{prevScore} → {item.score}</span>
                    </>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>→ unchanged</span>
                  )}
                </div>
              )}
            </>
          );
        })()}

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
        {agentOutputs.length > 0 && (() => {
          // Infer depth from agentOutputs count
          const itemIsDeep = agentOutputs.length >= 7;
          const itemOrder = itemIsDeep ? AGENT_ORDER_DEEP : AGENT_ORDER_QUICK;
          return (
            <>
              {itemIsDeep && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.35)",
                    color: "#c4b5fd",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 20,
                    letterSpacing: 0.5,
                  }}>
                    🔬 DEEP ANALYSIS · {agentOutputs.length} agents
                  </span>
                  <span style={{ fontSize: 10, color: MUTED }}>
                    Macro Sentinel · Sector Specialist · Competitive Moat · Execution Risk
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {itemOrder.map((name) => {
                  const agent = agentOutputs.find((a) => a.name === name);
                  if (!agent) return null;
                  const { bg, text } = labelColor(agent.label);
                  return (
                    <div
                      key={name}
                      style={{
                        background: BG2,
                        border: `1px solid ${itemIsDeep && ["Macro Sentinel", "Sector Specialist", "Competitive Moat", "Execution Risk"].includes(name) ? "rgba(124,58,237,0.25)" : BORDER}`,
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
                          {itemIsDeep && AGENT_META[name].webSearch && (
                            <span style={{ fontSize: 9, color: "#60a5fa" }}>🌐</span>
                          )}
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
            </>
          );
        })()}

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

          {/* Re-run Triage — passes original depth inferred from agentOutputs count */}
          {(() => {
            const rerunAgentCount = agentOutputs.length;
            const rerunIsDeep = rerunAgentCount >= 7;
            const rerunDepth: "quick" | "deep" = rerunIsDeep ? "deep" : "quick";
            return (
              <button
                onClick={() => onRetriage(item.pitchPreview, item.id, rerunDepth)}
                style={{
                  background: rerunIsDeep ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.12)",
                  border: `1px solid ${rerunIsDeep ? "rgba(124,58,237,0.5)" : "rgba(124,58,237,0.35)"}`,
                  borderRadius: 6,
                  color: "#a78bfa",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "7px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {rerunIsDeep ? "🔬 Re-run Deep" : "⚡ Re-run Triage"}
              </button>
            );
          })()}

          {/* Re-evaluate this deal (auto trigger) */}
          {(() => {
            const evalStatus = reEvalState[item.id] ?? "idle";
            // Check if an auto re-triage already ran today for this deal
            const lastAutoAt = (historyQuery.data ?? []).find(
              (r) => (r as unknown as { source?: string; parentTriageId?: number }).source === "auto" &&
                (r as unknown as { parentTriageId?: number }).parentTriageId === item.id
            );
            const ranToday = lastAutoAt
              ? Date.now() - new Date(lastAutoAt.createdAt).getTime() < 24 * 60 * 60 * 1000
              : false;
            if (ranToday) {
              return (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", alignSelf: "center" }}>
                  Re-evaluated today
                </span>
              );
            }
            return (
              <button
                disabled={evalStatus === "running"}
                onClick={() => {
                  setReEvalState((prev) => ({ ...prev, [item.id]: "running" }));
                  checkAndTriggerMutation.mutate(
                    { dealId: item.id },
                    {
                      onSuccess: (data) => {
                        setReEvalState((prev) => ({ ...prev, [item.id]: "done" }));
                        void utils.pitch.history.invalidate();
                        void utils.pitch.historyItem.invalidate({ id: item.id });
                        if (data.triggered > 0) {
                          // Show a brief toast-like state
                          setTimeout(() => setReEvalState((prev) => ({ ...prev, [item.id]: "idle" })), 4000);
                        } else {
                          setTimeout(() => setReEvalState((prev) => ({ ...prev, [item.id]: "idle" })), 2000);
                        }
                      },
                      onError: () => {
                        setReEvalState((prev) => ({ ...prev, [item.id]: "error" }));
                        setTimeout(() => setReEvalState((prev) => ({ ...prev, [item.id]: "idle" })), 3000);
                      },
                    }
                  );
                }}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${evalStatus === "done" ? "rgba(74,222,128,0.35)" : evalStatus === "error" ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: 6,
                  color: evalStatus === "done" ? "#4ade80" : evalStatus === "error" ? "#f87171" : "rgba(255,255,255,0.5)",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "7px 12px",
                  cursor: evalStatus === "running" ? "not-allowed" : "pointer",
                  opacity: evalStatus === "running" ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                {evalStatus === "running" ? "⚡ Evaluating…" :
                 evalStatus === "done" ? "✓ Deal re-evaluated — new analysis added" :
                 evalStatus === "error" ? "⚠ Re-evaluation failed" :
                 "⚡ Re-evaluate this deal"}
              </button>
            );
          })()}
        </div>

          {/* Log a signal — collapsible */}
          {(() => {
            const isOpen = signalPanelOpen[item.id] ?? false;
            const sState = signalState[item.id] ?? "idle";
            const sType = signalType[item.id] ?? "";
            const sText = signalText[item.id] ?? "";
            const SIGNAL_LABELS: Record<string, string> = {
              founder_update: "Founder update",
              competitor_news: "Competitor news",
              market_event: "Market event",
              negative_press: "Negative press",
              positive_press: "Positive press",
              other: "Other",
            };
            if (!isOpen) {
              return (
                <button
                  onClick={() => setSignalPanelOpen((prev) => ({ ...prev, [item.id]: true }))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "2px 0",
                    textAlign: "left",
                    textDecoration: "underline dotted",
                  }}
                >
                  + Log external signal
                </button>
              );
            }
            return (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Log external signal</span>
                <select
                  value={sType}
                  onChange={(e) => setSignalType((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 5,
                    color: sType ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                    fontSize: 12,
                    padding: "6px 10px",
                    outline: "none",
                  }}
                >
                  <option value="" disabled>Signal type…</option>
                  {Object.entries(SIGNAL_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <textarea
                  value={sText}
                  onChange={(e) => setSignalText((prev) => ({ ...prev, [item.id]: e.target.value.slice(0, 500) }))}
                  placeholder="What happened? (max 500 chars)"
                  rows={3}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 5,
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 12,
                    padding: "7px 10px",
                    resize: "vertical",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                {sState === "success" && (
                  <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 600 }}>Signal logged — re-evaluation triggered</span>
                )}
                {sState === "error" && (
                  <span style={{ color: "#f87171", fontSize: 11, fontWeight: 600 }}>Failed to log signal</span>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    disabled={sState === "submitting" || !sType || !sText.trim()}
                    onClick={() => {
                      if (!sType || !sText.trim()) return;
                      setSignalState((prev) => ({ ...prev, [item.id]: "submitting" }));
                      logSignalMutation.mutate(
                        { dealId: String(item.id), signalType: sType as "founder_update" | "competitor_news" | "market_event" | "negative_press" | "positive_press" | "other", signalText: sText.trim() },
                        {
                          onSuccess: () => {
                            setSignalState((prev) => ({ ...prev, [item.id]: "success" }));
                            setSignalText((prev) => ({ ...prev, [item.id]: "" }));
                            setSignalType((prev) => ({ ...prev, [item.id]: "" }));
                            void utils.pitch.history.invalidate();
                            void utils.pitch.historyItem.invalidate({ id: item.id });
                            setTimeout(() => {
                              setSignalState((prev) => ({ ...prev, [item.id]: "idle" }));
                              setSignalPanelOpen((prev) => ({ ...prev, [item.id]: false }));
                            }, 2500);
                          },
                          onError: () => {
                            setSignalState((prev) => ({ ...prev, [item.id]: "error" }));
                            setTimeout(() => setSignalState((prev) => ({ ...prev, [item.id]: "idle" })), 3000);
                          },
                        }
                      );
                    }}
                    style={{
                      background: sState === "submitting" ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.18)",
                      border: "1px solid rgba(99,102,241,0.35)",
                      borderRadius: 6,
                      color: "rgba(165,180,252,0.9)",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "7px 14px",
                      cursor: (sState === "submitting" || !sType || !sText.trim()) ? "not-allowed" : "pointer",
                      opacity: (sState === "submitting" || !sType || !sText.trim()) ? 0.5 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {sState === "submitting" ? "Logging…" : "Log signal + re-evaluate"}
                  </button>
                  <button
                    onClick={() => {
                      setSignalPanelOpen((prev) => ({ ...prev, [item.id]: false }));
                      setSignalState((prev) => ({ ...prev, [item.id]: "idle" }));
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.30)",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "4px 6px",
                      textDecoration: "underline dotted",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Recent signals panel */}
          {(() => {
            const recentSignals = (signalsQuery.data ?? []).slice(0, 3);
            if (recentSignals.length === 0) return null;
            const SIGNAL_LABELS: Record<string, string> = {
              founder_update: "Founder update",
              competitor_news: "Competitor news",
              market_event: "Market event",
              negative_press: "Negative press",
              positive_press: "Positive press",
              other: "Other",
            };
            function relativeTime(ts: Date | string | number): string {
              const diffMs = Date.now() - new Date(ts).getTime();
              const mins = Math.floor(diffMs / 60000);
              if (mins < 60) return `${mins}m ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h ago`;
              const days = Math.floor(hrs / 24);
              return `${days} day${days === 1 ? "" : "s"} ago`;
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Recent signals</span>
                {recentSignals.map((sig) => (
                  <div
                    key={(sig as unknown as { id: number }).id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.30)",
                        borderRadius: 4,
                        color: "rgba(165,180,252,0.85)",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {SIGNAL_LABELS[(sig as unknown as { signalType: string }).signalType] ?? (sig as unknown as { signalType: string }).signalType}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, flex: 1, lineHeight: 1.4 }}>
                      {((sig as unknown as { signalText: string }).signalText ?? "").slice(0, 60)}
                      {((sig as unknown as { signalText: string }).signalText ?? "").length > 60 ? "…" : ""}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {relativeTime((sig as unknown as { createdAt: Date | string }).createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Outcome prompt — shown only when decisionOutcome is null AND stage is diligence/ic_ready */}
        {!item.decisionOutcome && (item.stage === "diligence" || item.stage === "ic_ready") && (() => {
          const os = outcomeState[item.id];
          if (os === "invested" || os === "passed") return null; // already recorded in this session
          return (
            <div
              style={{
                background: "rgba(245,158,11,0.07)",
                border: "1px solid rgba(245,158,11,0.28)",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600 }}>
                Record an outcome for this deal.
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={os === "recording"}
                  onClick={() => handleRecordOutcome(item.id, "invested")}
                  style={{
                    background: "rgba(34,197,94,0.10)",
                    border: "1px solid rgba(34,197,94,0.35)",
                    borderRadius: 6,
                    color: "#4ade80",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 14px",
                    cursor: os === "recording" ? "not-allowed" : "pointer",
                    opacity: os === "recording" ? 0.6 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  ✓ INVESTED
                </button>
                <button
                  disabled={os === "recording"}
                  onClick={() => handleRecordOutcome(item.id, "passed")}
                  style={{
                    background: "rgba(239,68,68,0.10)",
                    border: "1px solid rgba(239,68,68,0.35)",
                    borderRadius: 6,
                    color: "#f87171",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 14px",
                    cursor: os === "recording" ? "not-allowed" : "pointer",
                    opacity: os === "recording" ? 0.6 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  ✗ PASSED
                </button>
              </div>
            </div>
          );
        })()}

        {/* Outcome recording */}
        {(() => {
          const os = outcomeState[item.id];
          if (os === "invested") {
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8 }}>
                <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>✓ Invested recorded</span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>— future decisions will improve</span>
              </div>
            );
          }
          if (os === "passed") {
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8 }}>
                <span style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>✓ Passed recorded</span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>— future decisions will improve</span>
              </div>
            );
          }
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Record outcome:</span>
              <button
                disabled={os === "recording"}
                onClick={() => handleRecordOutcome(item.id, "invested")}
                style={{
                  background: "rgba(34,197,94,0.10)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  borderRadius: 6,
                  color: "#4ade80",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  cursor: os === "recording" ? "not-allowed" : "pointer",
                  opacity: os === "recording" ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                ✓ Mark as Invested
              </button>
              <button
                disabled={os === "recording"}
                onClick={() => handleRecordOutcome(item.id, "passed")}
                style={{
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: 6,
                  color: "#f87171",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  cursor: os === "recording" ? "not-allowed" : "pointer",
                  opacity: os === "recording" ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                ✗ Mark as Passed
              </button>
            </div>
          );
        })()}
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
  // Stage filter: 'all' shows everything; specific stage shows only that stage
  const stageFilteredRows = stageFilter === "all"
    ? rows
    : stageFilter === "decision_made"
    ? rows.filter((r) => !!r.decisionOutcome)
    : rows.filter((r) => (r.stage ?? "triaged") === stageFilter);
  const filteredRowsUnsorted = stageFilteredRows
    .filter((r) => activeFilters.has(r.classification))
    .filter((r) => !showSignalsOnly || ((r as unknown as { signalCount?: number }).signalCount ?? 0) > 0);
  const filteredRows = [...filteredRowsUnsorted].sort((a, b) => {
    if (sortBy === "highest_score") return (b.score ?? 0) - (a.score ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Stage counts for tabs
  const stageCounts = {
    all: rows.length,
    triaged: rows.filter((r) => !r.stage || r.stage === "triaged").length,
    diligence: rows.filter((r) => r.stage === "diligence").length,
    ic_ready: rows.filter((r) => r.stage === "ic_ready").length,
    decision_made: rows.filter((r) => !!r.decisionOutcome).length,
  };

  const STAGE_TAB_CONFIG: Record<string, { label: string; color: string; activeBg: string; activeBorder: string; dot: string }> = {
    all: { label: "All", color: MUTED, activeBg: "rgba(124,58,237,0.18)", activeBorder: "rgba(124,58,237,0.5)", dot: "" },
    triaged: { label: "Triaged", color: TEXT2, activeBg: "rgba(255,255,255,0.10)", activeBorder: "rgba(255,255,255,0.3)", dot: "#6b6b80" },
    diligence: { label: "Diligence", color: "#58a6ff", activeBg: "rgba(88,166,255,0.14)", activeBorder: "rgba(88,166,255,0.45)", dot: "#58a6ff" },
    ic_ready: { label: "IC Ready", color: "#7c6fff", activeBg: "rgba(124,111,255,0.14)", activeBorder: "rgba(124,111,255,0.45)", dot: "#7c6fff" },
    decision_made: { label: "Decision Made", color: "#3ecf8e", activeBg: "rgba(62,207,142,0.14)", activeBorder: "rgba(62,207,142,0.45)", dot: "#3ecf8e" },
  };

  // Stage dot color helper
  function stageDotColor(row: PitchTriageRow): string {
    if (row.decisionOutcome) return "#3ecf8e";
    if (row.stage === "ic_ready") return "#7c6fff";
    if (row.stage === "diligence") return "#58a6ff";
    return "#6b6b80";
  }

  // Days in stage helper (uses createdAt as proxy since stageChangedAt not in schema)
  function daysInStage(row: PitchTriageRow): number {
    return Math.max(0, Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 86400000));
  }

  // CSV export for pipeline list
  function exportPipelineCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const header = ["ID", "Date", "Classification", "Score", "Stage", "Outcome", "Days", "Preview"];
    const csvRows = filteredRows.map((r) => [
      r.id,
      fmtKuwait(r.createdAt),
      r.classification,
      r.score,
      r.stage ?? "triaged",
      r.decisionOutcome ?? "",
      daysInStage(r),
      `"${(r.pitchPreview ?? "").replace(/"/g, "'")}"`,
    ].join(","));
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  // All-time pipeline counts (not affected by date range filter — always shows full funnel)
  const pipelineCounts = {
    triaged: allRows.filter((r) => !r.stage || r.stage === "triaged").length,
    diligence: allRows.filter((r) => r.stage === "diligence").length,
    ic_ready: allRows.filter((r) => r.stage === "ic_ready").length,
  };

  // ── Aggregate pattern signal (client-side, no new API) ────────────────────
  // Count outcome-recorded rows
  const outcomeCount = allRows.filter((r) => r.decisionOutcome === "invested" || r.decisionOutcome === "passed").length;

  // ── True invested-outcome grounded pattern signal ─────────────────────────────
  // Only use rows where decisionOutcome = "invested" (no proxy fallback)
  const POSITIVE_LABELS_SET = new Set(["strong", "clear", "low", "complete"]);
  const PATTERN_AGENTS = new Set(["Traction", "Market Signal", "Founder Signal", "Business Model", "Risk"]);
  // Human-readable factor phrases — mirrors server-side SIGNAL_PHRASES in patternInsight
  const FACTOR_PHRASES: Record<string, string> = {
    "Traction": "strong traction",
    "Market Signal": "strong market signal",
    "Founder Signal": "strong founder signal",
    "Business Model": "clear revenue model",
    "Risk": "manageable risk",
  };
  // Restrict to invested-outcome rows only
  const investedRows = allRows.filter((r) => r.decisionOutcome === "invested");
  const agentPositiveVotes: Record<string, number> = {};
  for (const r of investedRows) {
    if (!r.agentOutputs) continue;
    let agents: Array<{ name: string; label: string }> = [];
    try { agents = JSON.parse(r.agentOutputs); } catch { continue; }
    const relevant = agents.filter((a) => PATTERN_AGENTS.has(a.name));
    if (relevant.length === 0) continue;
    for (const a of relevant.filter((a) => POSITIVE_LABELS_SET.has(a.label))) {
      agentPositiveVotes[a.name] = (agentPositiveVotes[a.name] ?? 0) + 1;
    }
  }
  // patternMatchCount = number of invested deals (the signal is grounded in all of them)
  const patternMatchCount = investedRows.length;
  // Derive top 1–2 factors by positive-vote frequency across invested deals
  // Only include factors that appeared in ≥50% of invested deals (meaningful signal)
  const topSuccessFactors: string[] = Object.entries(agentPositiveVotes)
    .filter(([, count]) => investedRows.length > 0 && count / investedRows.length >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => FACTOR_PHRASES[name] ?? name.toLowerCase());

  // ── Score history modal labels ──────────────────────────────────────────────
  const TRIGGER_LABELS: Record<string, string> = {
    stale_diligence: "Stale in diligence",
    stale_ic_ready: "Stale at IC ready",
    score_drop: "Score drop",
    pattern_shift: "Pattern shift",
    signal_triggered: "External signal",
  };

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* ── Institutional Pipeline header ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 4,
          gap: 12,
          flexWrap: "wrap" as const,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.4px",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Pipeline
          </h2>
          <p style={{ color: MUTED, fontSize: 12, margin: "4px 0 0", lineHeight: 1.5 }}>
            <span style={{ color: TEXT2, fontWeight: 600 }}>{allRows.length}</span> deal{allRows.length !== 1 ? "s" : ""}
            {" · "}
            <span style={{ color: TEXT2, fontWeight: 600 }}>{outcomeCount}</span> outcome{outcomeCount !== 1 ? "s" : ""} recorded
            {autoTriggerCountQuery.data !== undefined && (
              <>
                {" · "}
                <span style={{ color: TEXT2, fontWeight: 600 }}>{autoTriggerCountQuery.data.count}</span> auto re-triage{autoTriggerCountQuery.data.count !== 1 ? "s" : ""} this month
              </>
            )}
          </p>
        </div>
        <button
          onClick={exportPipelineCSV}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: TEXT2,
            fontSize: 12,
            fontWeight: 600,
            padding: "7px 14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap" as const,
            transition: "all 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = BORDER; }}
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Pipeline Summary — single row, clickable stage counts */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" as const, padding: "8px 12px", borderRight: `1px solid ${BORDER}`, whiteSpace: "nowrap" as const }}>Pipeline</span>
        {([
          { key: "triaged" as StageFilter, label: "Triaged", count: pipelineCounts.triaged, color: TEXT2, activeBg: "rgba(255,255,255,0.10)", activeBorder: "rgba(255,255,255,0.3)" },
          { key: "diligence" as StageFilter, label: "Diligence", count: pipelineCounts.diligence, color: "#60a5fa", activeBg: "rgba(96,165,250,0.14)", activeBorder: "rgba(96,165,250,0.45)" },
          { key: "ic_ready" as StageFilter, label: "IC Ready", count: pipelineCounts.ic_ready, color: "#a78bfa", activeBg: "rgba(167,139,250,0.14)", activeBorder: "rgba(167,139,250,0.45)" },
        ]).map(({ key, label, count, color, activeBg, activeBorder }, i, arr) => {
          const isActive = stageFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStageFilter(isActive ? "all" : key)}
              title={isActive ? `Clear ${label} filter` : `Show ${label} deals only`}
              style={{
                flex: 1,
                background: isActive ? activeBg : "transparent",
                border: "none",
                borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : "none",
                borderLeft: isActive ? `2px solid ${activeBorder}` : "2px solid transparent",
                padding: "8px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: isActive ? color : TEXT2, lineHeight: 1 }}>{count}</span>
              <span style={{ fontSize: 10, color: isActive ? color : MUTED, fontWeight: isActive ? 700 : 500, letterSpacing: 0.4, textTransform: "uppercase" as const }}>{label}</span>
            </button>
          );
        })}
      </div>
      {/* Aggregate pattern signal — shown when ≥2 deals match success pattern */}
      {patternMatchCount >= 2 && (
        <div
          style={{
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.28)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Summary line — clickable toggle */}
          <button
            onClick={() => setPatternExpanded((v) => !v)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              textAlign: "left" as const,
            }}
          >
            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700, flexShrink: 0 }}>◆</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.4, flex: 1 }}>
              <span style={{ color: "#10b981", fontWeight: 700 }}>{patternMatchCount} invested deal{patternMatchCount !== 1 ? "s" : ""}</span>
              {" "}in your history
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(16,185,129,0.6)",
                flexShrink: 0,
                transition: "transform 0.15s",
                display: "inline-block",
                transform: patternExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                userSelect: "none" as const,
              }}
            >
              ▾
            </span>
          </button>

          {/* Explanation line — revealed on expand, hidden when no factors */}
          {patternExpanded && topSuccessFactors.length > 0 && (
            <div
              style={{
                padding: "0 14px 9px 33px",
                borderTop: "1px solid rgba(16,185,129,0.12)",
                paddingTop: 7,
              }}
            >
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
                Most common success signals:{" "}
                <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
                  {topSuccessFactors.join(", ")}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sample size nudge — shown when 1–2 outcomes recorded, hidden at ≥3 */}
      {outcomeCount >= 1 && outcomeCount <= 2 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>○</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
            Record {3 - outcomeCount} more outcome{3 - outcomeCount !== 1 ? "s" : ""} to unlock pattern insights
          </span>
        </div>
      )}

      {/* Stale deal outcome nudge — max 3, derived from allRows, no new queries */}
      {(() => {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const staleDeals = allRows
          .filter((r) =>
            (r.stage === "diligence" || r.stage === "ic_ready") &&
            !r.decisionOutcome &&
            (Date.now() - new Date(r.createdAt).getTime()) >= THIRTY_DAYS_MS &&
            !dismissedNudges.has(r.id)
          )
          .slice(0, 3);
        if (staleDeals.length === 0) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {staleDeals.map((r) => {
              const stageLabel = r.stage === "ic_ready" ? "IC Ready" : "Diligence";
              const dealName = r.pitchPreview ? r.pitchPreview.slice(0, 40).trim() + (r.pitchPreview.length > 40 ? "…" : "") : `Deal #${r.id}`;
              return (
                <div
                  key={r.id}
                  style={{
                    background: "rgba(245,158,11,0.06)",
                    border: "1px solid rgba(245,158,11,0.22)",
                    borderRadius: 8,
                    padding: "7px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, flexShrink: 0 }}>⏳</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, flex: 1 }}>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{dealName}</span>
                    {" "}has been in{" "}
                    <span style={{ color: "#f59e0b", fontWeight: 600 }}>{stageLabel}</span>
                    {" "}for 30+ days — record an outcome to improve pattern accuracy.
                  </span>
                  <button
                    onClick={() => dismissNudge(r.id)}
                    title="Dismiss"
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.25)",
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                      padding: "0 2px",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

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
        {/* Auto re-triage count — last 30 days */}
        {autoTriggerCountQuery.data !== undefined && (() => {
          const atCount = autoTriggerCountQuery.data.count;
          return (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {atCount === 0
                ? "No auto re-triages yet"
                : <><span style={{ fontWeight: 700, color: TEXT2 }}>{atCount}</span> auto re-triage{atCount !== 1 ? "s" : ""} in last 30 days</>}
            </span>
          );
        })()}
        {/* Signal type breakdown — top 2 types */}
        {signalTypeSummaryQuery.data !== undefined && (() => {
          const SIGNAL_LABELS: Record<string, string> = {
            founder_update: "founder update",
            competitor_news: "competitor news",
            market_event: "market event",
            negative_press: "negative press",
            positive_milestone: "positive milestone",
            team_change: "team change",
          };
          const entries = Object.entries(signalTypeSummaryQuery.data)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2);
          if (entries.length === 0) return null;
          const parts = entries.map(([k, v]) => `${v} ${SIGNAL_LABELS[k] ?? k}${v !== 1 ? "s" : ""}`);
          return (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {parts.join(" · ")}
            </span>
          );
        })()}
      </div>

      {/* Stage (pipeline) filter tabs — pill-shaped */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 8,
          flexWrap: "wrap" as const,
        }}
      >
        {(["all", "triaged", "diligence", "ic_ready", "decision_made"] as StageFilter[]).map((s) => {
          const cfg = STAGE_TAB_CONFIG[s];
          const isActive = stageFilter === s;
          const count = stageCounts[s as keyof typeof stageCounts];
          return (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              style={{
                background: isActive ? cfg.activeBg : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? cfg.activeBorder : BORDER}`,
                borderRadius: 9999,
                color: isActive ? cfg.color : MUTED,
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                padding: "5px 14px",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {cfg.dot && (
                <span
                  style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: isActive ? cfg.dot : MUTED,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
              )}
              {cfg.label}
              <span
                style={{
                  fontSize: 10,
                  background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontWeight: 600,
                  color: isActive ? cfg.color : MUTED,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
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

      {/* Filter chips + escalation indicator — pill-shaped */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          {(["ENGAGE", "WATCH", "IGNORE"] as const).map((cls) => {
          const isActive = activeFilters.has(cls);
          const colors = isActive ? CHIP_COLORS[cls].active : CHIP_COLORS[cls].inactive;
          return (
            <button
              key={cls}
              onClick={() => toggleFilter(cls)}
              style={{
                background: isActive ? colors.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? colors.border : BORDER}`,
                borderRadius: 9999,
                color: isActive ? colors.text : MUTED,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
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
        {/* 📡 Signals filter chip */}
        {(() => {
          const signalRows = rows.filter((r) => ((r as unknown as { signalCount?: number }).signalCount ?? 0) > 0);
          if (signalRows.length === 0) return null;
          return (
            <button
              onClick={() => setShowSignalsOnly((v) => !v)}
              style={{
                background: showSignalsOnly ? "rgba(96,165,250,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${showSignalsOnly ? "rgba(96,165,250,0.5)" : BORDER}`,
                borderRadius: 20,
                color: showSignalsOnly ? "#60a5fa" : MUTED,
                fontSize: 11,
                fontWeight: showSignalsOnly ? 700 : 500,
                padding: "4px 12px",
                cursor: "pointer",
                letterSpacing: 0.4,
                transition: "all 0.15s",
              }}
            >
              📡 Signals · {signalRows.length}
            </button>
          );
        })()}
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
              : "No deals match these filters"}
          </p>
          <p style={{ color: MUTED, fontSize: 11 }}>
            {rows.length === 0 && dateRange !== "all"
              ? "Try switching to \"All time\" to see older results."
              : "Adjust the filters above to see more results."}
          </p>
        </div>
      )}

      {filteredRows.map((row) => {
        const cfg = classConfig[row.classification];
        const scoreColors = scoreBadgeColor(row.score);
        // Infer depth from agentOutputs — if ≥7 agents present, it was a deep run
        const rowAgentCount = (() => {
          try { return (JSON.parse(row.agentOutputs ?? "[]") as unknown[]).length; } catch { return 0; }
        })();
        const rowIsDeep = rowAgentCount >= 7;
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
            {/* Score badge or sparkline */}
            {(() => {
              const sh: number[] = (row as unknown as { scoreHistory?: number[] }).scoreHistory ?? [];
              if (sh.length >= 3) {
                const W = 48, H = 20;
                const min = Math.min(...sh), max = Math.max(...sh);
                const range = max - min || 1;
                const pts = sh.map((s, i) => {
                  const x = (i / (sh.length - 1)) * (W - 4) + 2;
                  const y = H - 2 - ((s - min) / range) * (H - 4);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(" ");
                const first = sh[0], last = sh[sh.length - 1];
                const diff = last - first;
                const lineColor = diff > 3 ? "#22c55e" : diff < -3 ? "#ef4444" : "#6b7280";
                const tooltip = `Scores: ${sh.join(" → ")}`;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-haspopup="dialog"
                    aria-label={`View score history for ${row.pitchPreview ? row.pitchPreview.slice(0, 40).trim() : `deal #${row.id}`}`}
                    style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}
                    title={tooltip}
                    onClick={(e) => { e.stopPropagation(); setScoreModalDealId(row.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setScoreModalDealId(row.id); } }}
                  >
                    <svg width={W} height={H} style={{ display: "block" }}>
                      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 800, color: scoreColors.text, lineHeight: 1 }}>{row.score}</span>
                  </div>
                );
              }
              return (
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
              );
            })()}

            {/* Main content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {/* Stage indicator dot */}
                <span
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: stageDotColor(row),
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
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
                {row.parentTriageId && !(row as unknown as { source?: string }).source && (
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
                {rowIsDeep && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#c4b5fd",
                      background: "rgba(124,58,237,0.15)",
                      border: "1px solid rgba(124,58,237,0.35)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 700,
                    }}
                  >
                    🔬 Deep
                  </span>
                )}
                {(row as unknown as { source?: string; triggerType?: string }).source === "auto" && (() => {
                  const isSignal = (row as unknown as { triggerType?: string }).triggerType === "signal_triggered";
                  return isSignal ? (
                    <span
                      style={{
                        fontSize: 9,
                        color: "#60a5fa",
                        background: "rgba(96,165,250,0.12)",
                        border: "1px solid rgba(96,165,250,0.30)",
                        borderRadius: 4,
                        padding: "1px 6px",
                        letterSpacing: 0.3,
                        fontWeight: 700,
                      }}
                    >
                      📡 Signal
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 9,
                        color: "#fbbf24",
                        background: "rgba(251,191,36,0.12)",
                        border: "1px solid rgba(251,191,36,0.30)",
                        borderRadius: 4,
                        padding: "1px 6px",
                        letterSpacing: 0.3,
                        fontWeight: 700,
                      }}
                    >
                      ⚡ Auto
                    </span>
                  );
                })()}
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
                {row.stage === "diligence" && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#60a5fa",
                      background: "rgba(96,165,250,0.10)",
                      border: "1px solid rgba(96,165,250,0.25)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 600,
                    }}
                  >
                    📂 Diligence
                  </span>
                )}
                {row.stage === "ic_ready" && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#a78bfa",
                      background: "rgba(167,139,250,0.10)",
                      border: "1px solid rgba(167,139,250,0.25)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 600,
                    }}
                  >
                    ★ IC Ready
                  </span>
                )}
                {row.decisionOutcome === "invested" && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#4ade80",
                      background: "rgba(34,197,94,0.10)",
                      border: "1px solid rgba(34,197,94,0.30)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 700,
                    }}
                  >
                    ✓ INVESTED
                  </span>
                )}
                {row.decisionOutcome === "passed" && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#f87171",
                      background: "rgba(239,68,68,0.10)",
                      border: "1px solid rgba(239,68,68,0.30)",
                      borderRadius: 4,
                      padding: "1px 6px",
                      letterSpacing: 0.3,
                      fontWeight: 700,
                    }}
                  >
                    ✗ PASSED
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
              {(row as unknown as { source?: string; triggerType?: string }).source === "auto" && (() => {
                const tt = (row as unknown as { triggerType?: string }).triggerType;
                const isSignal = tt === "signal_triggered";
                const triggerLabel =
                  tt === "signal_triggered" ? "Re-triaged: external signal logged" :
                  tt === "stale_diligence" ? `Re-triaged: stale in diligence ${Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 86400000)} days` :
                  tt === "stale_ic_ready" ? `Re-triaged: stale in IC Ready ${Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 86400000)} days` :
                  tt === "score_drop" ? "Re-triaged: score dropped" :
                  tt === "pattern_shift" ? "Re-triaged: similar deal outcome conflict" :
                  "Re-triaged automatically";
                return (
                  <div style={{ color: isSignal ? "#60a5fa" : "#fbbf24", fontSize: 10, marginTop: 2, opacity: 0.85 }}>
                    {triggerLabel}
                  </div>
                );
              })()}
            </div>

            {/* Date + days in stage */}
            <div style={{ color: MUTED, fontSize: 11, flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span>{fmtKuwait(row.createdAt)}</span>
              <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" as const }}>{daysInStage(row)}d in stage</span>
              {rowAgentCount > 0 && (
                <span style={{ fontSize: 9, color: rowIsDeep ? "#c4b5fd" : MUTED, whiteSpace: "nowrap" as const }}>
                  {rowAgentCount} agents
                </span>
              )}
            </div>

            {/* Signal count indicator — only when > 0 */}
            {(row as unknown as { signalCount?: number }).signalCount! > 0 && (
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(96,165,250,0.55)",
                  flexShrink: 0,
                  whiteSpace: "nowrap" as const,
                }}
              >
                📡 {(row as unknown as { signalCount?: number }).signalCount}
              </span>
            )}

            {/* Arrow */}
            <span style={{ color: MUTED, fontSize: 14, flexShrink: 0 }}>›</span>
          </button>
        );
      })}
    </div>

    {/* Score history modal — extracted to ScoreHistoryModal component for testability */}
    {scoreModalDealId != null && scoreHistoryQuery.data !== undefined && (
      <ScoreHistoryModal
        rows={scoreHistoryQuery.data}
        dealName={(() => {
          const modalDeal = allRows.find((r) => r.id === scoreModalDealId);
          return modalDeal?.pitchPreview ? modalDeal.pitchPreview.slice(0, 40).trim() : "";
        })()}
        dealId={scoreModalDealId}
        onClose={() => { setScoreModalDealId(null); setFocusedBadgeKey(null); }}
        showAllMap={scoreHistoryShowAllMap}
        setShowAllMap={setScoreHistoryShowAllMap}
      />
    )}
    {/* Loading overlay while scoreHistory query is in flight */}
    {scoreModalDealId != null && scoreHistoryQuery.isLoading && (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={() => setScoreModalDealId(null)}
      >
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Loading…</div>
      </div>
    )}
    </>
  );
}
