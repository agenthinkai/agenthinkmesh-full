/**
 * DealScreener.tsx
 * Bloomberg Terminal-style dark UI for the Council of 10 Deal Screener.
 * Three views: INPUT → LOADING → REPORT (with HISTORY tab)
 */

import React, { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { isDemoMode, DEMO_DEAL_SCREENER_DATA } from "@/lib/demo";
import DataRoomUpload, { type DataRoomResult } from "@/components/DataRoomUpload";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = "#070b12";
const BG2 = "#0d1421";
const BG3 = "#111827";
const BORDER = "#1e2d3d";
const ACCENT = "#4a9eff";
const GREEN = "#00ff87";
const AMBER = "#ff9f43";
const RED = "#ff4757";
const PURPLE = "#a855f7";
const MUTED = "#4a5568";
const TEXT = "#e2e8f0";
const TEXT2 = "#94a3b8";
const MONO = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";

// ── Types (mirrors server types) ─────────────────────────────────────────────
type VoteType = "HARD_YES" | "SOFT_YES" | "SOFT_NO" | "HARD_NO";
type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED";

interface PersonaVote {
  personaId: string;
  personaName: string;
  personaRole: string;
  vote: VoteType;
  confidence: number;
  rationale: string;
  keyFlags: string[];
  conditions: string[];
  blockers: string[];
  timedOut?: boolean;
}

interface CouncilResult {
  dealId: string;
  dealName: string;
  dealText?: string;
  verdict: VerdictType;
  yesCount: number;
  noCount: number;
  hardYesCount: number;
  softYesCount: number;
  softNoCount: number;
  hardNoCount: number;
  confidenceScore: number;
  gccVetoTriggered: boolean;
  tiebreakerTriggered: boolean;
  tiebreakerSwingAgent: string | null;
  conditionsToProceed: string[];
  blockingIssues: string[];
  votes: PersonaVote[];
  icReport?: ICReportData | null;
  universitySignal?: UniversitySignal | null;
  precedents?: Array<{ taskDescription: string; finalVerdict: string | null; similarity: number; }>;
}

// ── Tier 0 University Signal type ───────────────────────────────────────────────────────────────
interface UniversitySignal {
  tier: "0A" | "0B";
  source: string;
  subtype: "Accelerator" | "Grant" | "Hackathon" | "Research";
  classification: "Startup" | "Emerging" | "Project";
  confidence: "High" | "Medium";
  scoreBoost: number;
  matchedKeywords: string[];
}

// ── IC Report types (mirrors server icReportEngine.ts) ────────────────────────
interface ICReportData {
  dealName: string;
  generatedAt: string;
  verificationBanner: {
    consensusScore: number;
    confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
    conflictStatus: string;
  };
  executiveVerdict: {
    decision: "APPROVE" | "REJECT" | "CONDITIONAL APPROVE";
    recommendedAction: string;
    rationale: string;
  };
  investmentThesis: string[];
  keyRisks: string[];
  decisionTriggers: {
    upgradeTriggers: string[];
    downgradeTriggers: string[];
  };
  consensusBreakdown: {
    approve: number;
    reject: number;
    conditional: number;
    keyDisagreements: string[];
  };
  thirtyDayActionPlan: string[];
  marketAndRegulatoryContext: string[];
  rawText: string;
  vcSummary?: {
    verdictLine: string;
    theBet: string;
    reasonsToInvest: string[];
    reasonsNotToInvest: string[];
    whatWouldChange: string[];
  } | null;
}

// ── Persona metadata ──────────────────────────────────────────────────────────
const PERSONA_META: Record<string, { icon: string; color: string }> = {
  // GCC Institutional
  GCC_REG: { icon: "⚖️", color: "#ff4757" },
  GCC_CONSUMER: { icon: "🛍️", color: "#4a9eff" },
  GCC_SHARIAH: { icon: "☪️", color: "#00ff87" },
  CONTRARIAN: { icon: "🔥", color: "#ff9f43" },
  CFO: { icon: "📊", color: "#4a9eff" },
  EXIT: { icon: "🚪", color: "#a855f7" },
  GROWTH: { icon: "📈", color: "#00ff87" },
  SECURITY: { icon: "🛡️", color: "#ff9f43" },
  OPERATOR: { icon: "⚙️", color: "#4a9eff" },
  DEVILS_ADVOCATE: { icon: "😈", color: "#ff4757" },
  // Global VC
  VC_CFO: { icon: "📊", color: "#4a9eff" },
  VC_LEGAL: { icon: "⚖️", color: "#ff4757" },
  MARKET_ANALYST: { icon: "🌐", color: "#00ff87" },
  VC_GROWTH: { icon: "📈", color: "#00ff87" },
  VC_EXIT: { icon: "🚀", color: "#a855f7" },
  TECH_DUE_DILIGENCE: { icon: "💻", color: "#4a9eff" },
  VC_RISK: { icon: "🛡️", color: "#ff9f43" },
  FOUNDER_EVALUATOR: { icon: "👤", color: "#ff9f43" },
  PORTFOLIO_FIT: { icon: "🔗", color: "#4a9eff" },
  VC_CONTRARIAN: { icon: "🔥", color: "#ff4757" },
  // India PE / VC
  IN_CFO: { icon: "📊", color: "#4a9eff" },
  IN_LEGAL: { icon: "⚖️", color: "#ff4757" },
  SEBI_COMPLIANCE: { icon: "🏛️", color: "#00ff87" },
  IN_GROWTH: { icon: "📈", color: "#00ff87" },
  IN_EXIT: { icon: "🚀", color: "#a855f7" },
  IN_MARKET: { icon: "🇮🇳", color: "#ff9f43" },
  IN_RISK: { icon: "🛡️", color: "#ff9f43" },
  FEMA_ADVISOR: { icon: "💱", color: "#4a9eff" },
  IN_FOUNDER: { icon: "👤", color: "#ff4757" },
  IN_CONTRARIAN: { icon: "🔥", color: "#ff4757" },
};

type CouncilModeType = "gcc" | "global_vc" | "india_pe";

const PERSONA_ORDERS: Record<CouncilModeType, { id: string; label: string }[]> = {
  gcc: [
    { id: "GCC_REG", label: "GCC Regulatory Guardian" },
    { id: "GCC_CONSUMER", label: "GCC Market Reality" },
    { id: "GCC_SHARIAH", label: "Shariah Compliance" },
    { id: "CONTRARIAN", label: "Contrarian" },
    { id: "CFO", label: "CFO" },
    { id: "EXIT", label: "Exit Strategist" },
    { id: "GROWTH", label: "Growth Analyst" },
    { id: "SECURITY", label: "Security & Risk" },
    { id: "OPERATOR", label: "Operator" },
    { id: "DEVILS_ADVOCATE", label: "Devil's Advocate" },
  ],
  global_vc: [
    { id: "VC_CFO", label: "VC CFO / Financial Analyst" },
    { id: "VC_LEGAL", label: "VC Legal Counsel" },
    { id: "MARKET_ANALYST", label: "Global Market Analyst" },
    { id: "VC_GROWTH", label: "Growth & GTM Strategist" },
    { id: "VC_EXIT", label: "Exit & Returns Strategist" },
    { id: "TECH_DUE_DILIGENCE", label: "Tech Due Diligence" },
    { id: "VC_RISK", label: "Risk & Downside Analyst" },
    { id: "FOUNDER_EVALUATOR", label: "Founder & Team Evaluator" },
    { id: "PORTFOLIO_FIT", label: "Portfolio Fit Analyst" },
    { id: "VC_CONTRARIAN", label: "Contrarian" },
  ],
  india_pe: [
    { id: "IN_CFO", label: "India CFO / Financial Analyst" },
    { id: "IN_LEGAL", label: "India Legal Counsel" },
    { id: "SEBI_COMPLIANCE", label: "SEBI Compliance Advisor" },
    { id: "IN_GROWTH", label: "India Growth Analyst" },
    { id: "IN_EXIT", label: "NSE/BSE Exit Strategist" },
    { id: "IN_MARKET", label: "India Market Specialist" },
    { id: "IN_RISK", label: "India Risk Analyst" },
    { id: "FEMA_ADVISOR", label: "FEMA / FDI Advisor" },
    { id: "IN_FOUNDER", label: "Founder Evaluator" },
    { id: "IN_CONTRARIAN", label: "Contrarian" },
  ],
};

// ── Vote badge ────────────────────────────────────────────────────────────────
function VoteBadge({ vote }: { vote: VoteType }) {
  const config = {
    HARD_YES: { label: "HARD YES", bg: "rgba(0,255,135,0.15)", border: "#00ff87", color: "#00ff87" },
    SOFT_YES: { label: "SOFT YES", bg: "rgba(74,158,255,0.15)", border: "#4a9eff", color: "#4a9eff" },
    SOFT_NO: { label: "SOFT NO", bg: "rgba(255,159,67,0.15)", border: "#ff9f43", color: "#ff9f43" },
    HARD_NO: { label: "HARD NO", bg: "rgba(255,71,87,0.15)", border: "#ff4757", color: "#ff4757" },
  }[vote];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 3,
      background: config.bg,
      border: `1px solid ${config.border}`,
      color: config.color,
      fontFamily: MONO,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
    }}>
      {config.label}
    </span>
  );
}

// ── Verdict badge ─────────────────────────────────────────────────────────────────────────────────
function VerdictBadge({ verdict, compact = false }: { verdict: VerdictType; compact?: boolean }) {
  const config = {
    APPROVED: { label: compact ? "APPROVED" : "APPROVED", bg: "rgba(0,255,135,0.12)", border: "#00ff87", color: "#00ff87", glow: compact ? "none" : "0 0 20px rgba(0,255,135,0.3)" },
    APPROVED_WITH_CONDITIONS: { label: compact ? "CONDITIONAL" : "APPROVED WITH CONDITIONS", bg: "rgba(74,158,255,0.12)", border: "#4a9eff", color: "#4a9eff", glow: compact ? "none" : "0 0 20px rgba(74,158,255,0.3)" },
    REJECTED: { label: "REJECTED", bg: "rgba(255,71,87,0.12)", border: "#ff4757", color: "#ff4757", glow: compact ? "none" : "0 0 20px rgba(255,71,87,0.3)" },
    VETOED: { label: "VETOED", bg: "rgba(255,71,87,0.18)", border: "#ff4757", color: "#ff4757", glow: compact ? "none" : "0 0 30px rgba(255,71,87,0.5)" },
  }[verdict];
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      padding: compact ? "2px 8px" : "10px 20px",
      borderRadius: compact ? 3 : 4,
      background: config.bg,
      border: `1px solid ${config.border}`,
      boxShadow: config.glow,
    }}>
      <span style={{ fontFamily: MONO, fontSize: compact ? 9 : 18, fontWeight: 800, color: config.color, letterSpacing: "0.1em" }}>
        {config.label}
      </span>
    </div>
  );
}

// ── VoteCard ──────────────────────────────────────────────────────────────────
function VoteCard({ vote, result }: { vote: PersonaVote; result?: CouncilResult }) {
  const [expanded, setExpanded] = useState(false);
  const meta = PERSONA_META[vote.personaId] ?? { icon: "🤖", color: ACCENT };
  const isYes = vote.vote === "HARD_YES" || vote.vote === "SOFT_YES";
  const [cfoLoading, setCfoLoading] = useState(false);
  const [cfoError, setCfoError] = useState<string | null>(null);
  const cfoDeepDiveMutation = trpc.dealScreener.cfoDeepDive.useMutation();

  const handleCfoDeepDive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!result) { setCfoError("Deal data unavailable"); return; }
    setCfoLoading(true);
    setCfoError(null);
    try {
      const deepDiveResult = await cfoDeepDiveMutation.mutateAsync({
        dealName:            result.dealName,
        verdict:             result.verdict,
        yesCount:            result.yesCount,
        noCount:             result.noCount,
        confidenceScore:     result.confidenceScore,
        conditionsToProceed: result.conditionsToProceed,
        blockingIssues:      result.blockingIssues,
        votes:               result.votes.map(v => ({
          personaId:   v.personaId,
          personaName: v.personaId,
          personaRole: v.personaRole,
          vote:        v.vote,
          confidence:  v.confidence,
          rationale:   v.rationale,
          keyFlags:    v.keyFlags,
          conditions:  v.conditions,
          blockers:    v.blockers,
        })),
      });
      const bytes = Uint8Array.from(atob(deepDiveResult.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = deepDiveResult.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setCfoError(err instanceof Error ? err.message : "Failed to generate CFO analysis");
    } finally {
      setCfoLoading(false);
    }
  };


  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: BG2,
        border: `1px solid ${expanded ? meta.color : BORDER}`,
        borderRadius: 6,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "border-color 0.15s",
        position: "relative",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: "0.06em" }}>
            {vote.personaId}
          </div>
          <div style={{ fontSize: 11, color: TEXT2, marginTop: 1 }}>{vote.personaRole}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <VoteBadge vote={vote.vote} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: isYes ? GREEN : RED }}>
            {Math.round(vote.confidence * 100)}% conf
          </span>
        </div>
      </div>

      {/* Rationale */}
      <p style={{ fontSize: 12, color: TEXT2, lineHeight: 1.5, margin: 0, marginBottom: vote.keyFlags.length ? 8 : 0 }}>
        {vote.rationale}
      </p>

      {/* Key flags */}
      {vote.keyFlags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {vote.keyFlags.map((flag, i) => (
            <span key={i} style={{
              padding: "2px 7px",
              borderRadius: 3,
              background: "rgba(255,159,67,0.1)",
              border: "1px solid rgba(255,159,67,0.3)",
              color: AMBER,
              fontFamily: MONO,
              fontSize: 10,
            }}>
              ⚑ {flag}
            </span>
          ))}
        </div>
      )}

      {/* CFO Deep Dive button */}
      {vote.personaId === "CFO" && (
        <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={handleCfoDeepDive}
            disabled={cfoLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              background: cfoLoading ? "rgba(74,158,255,0.1)" : "rgba(74,158,255,0.15)",
              border: "1px solid rgba(74,158,255,0.4)",
              borderRadius: 4,
              color: "#4a9eff",
              fontFamily: MONO,
              fontSize: 10,
              cursor: cfoLoading ? "not-allowed" : "pointer",
              letterSpacing: "0.04em",
            }}
          >
            {cfoLoading ? "⏳ GENERATING..." : "📄 CFO DEEP DIVE PDF"}
          </button>
          {cfoError && (
            <div style={{ fontSize: 10, color: RED, marginTop: 4, fontFamily: MONO }}>{cfoError}</div>
          )}
        </div>
      )}
      {/* Expanded: conditions + blockers */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
          {vote.conditions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, marginBottom: 4, letterSpacing: "0.06em" }}>CONDITIONS</div>
              {vote.conditions.map((c, i) => (
                <div key={i} style={{ fontSize: 11, color: TEXT2, marginBottom: 3, paddingLeft: 10, borderLeft: `2px solid ${AMBER}` }}>
                  {c}
                </div>
              ))}
            </div>
          )}
          {vote.blockers.length > 0 && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginBottom: 4, letterSpacing: "0.06em" }}>BLOCKERS</div>
              {vote.blockers.map((b, i) => (
                <div key={i} style={{ fontSize: 11, color: TEXT2, marginBottom: 3, paddingLeft: 10, borderLeft: `2px solid ${RED}` }}>
                  {b}
                </div>
              ))}
            </div>
          )}
          {vote.timedOut && (
            <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginTop: 4 }}>⚠ Persona timed out — fallback SOFT_NO applied</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PersonaLoadingGrid ────────────────────────────────────────────────────────
function PersonaLoadingGrid({ councilMode = "gcc" }: { councilMode?: CouncilModeType }) {
  const personaOrder = PERSONA_ORDERS[councilMode] ?? PERSONA_ORDERS.gcc;
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const interval = setInterval(() => {
      setActive((prev) => (prev < personaOrder.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, [councilMode]);

  const modeLabel = councilMode === "global_vc" ? "GLOBAL VC COUNCIL" : councilMode === "india_pe" ? "INDIA PE / VC COUNCIL" : "GCC INVESTMENT COUNCIL";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: ACCENT, letterSpacing: "0.1em", marginBottom: 8 }}>
          CONVENING THE {modeLabel}
        </div>
        <div style={{ fontSize: 12, color: TEXT2 }}>10 specialist AI advisors are reviewing your deal memo</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {personaOrder.map((p, i) => {
          const meta = PERSONA_META[p.id as keyof typeof PERSONA_META] ?? { icon: "🤖", color: ACCENT };
          const isActive = i === active;
          const isDone = i < active;
          return (
            <div key={p.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 6,
              background: isActive ? `rgba(74,158,255,0.08)` : BG2,
              border: `1px solid ${isActive ? ACCENT : isDone ? meta.color : BORDER}`,
              transition: "all 0.3s",
            }}>
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: isActive ? ACCENT : isDone ? meta.color : MUTED, letterSpacing: "0.05em" }}>
                  {p.id}
                </div>
                <div style={{ fontSize: 11, color: isDone ? TEXT2 : MUTED, marginTop: 1 }}>{p.label}</div>
              </div>
              <div style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isDone ? (
                  <span style={{ color: meta.color, fontSize: 12 }}>✓</span>
                ) : isActive ? (
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%",
                    border: `2px solid ${ACCENT}`,
                    borderTopColor: "transparent",
                    animation: "spin 0.7s linear infinite",
                  }} />
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: MUTED }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Boardroom IC Report renderer ─────────────────────────────────────────────
function VCSummaryBlock({ vc, decisionColor }: { vc: NonNullable<ICReportData["vcSummary"]>; decisionColor: string }) {
  const isReject = vc.verdictLine.toUpperCase().includes("REJECT") || vc.verdictLine.toUpperCase().includes("VETO");
  const SECTION_LABEL: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: "0.14em",
    fontWeight: 700,
    marginBottom: 10,
    textTransform: "uppercase" as const,
  };
  const BULLET: React.CSSProperties = {
    fontSize: 12,
    color: TEXT,
    marginBottom: 7,
    paddingLeft: 12,
    lineHeight: 1.55,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  };
  return (
    <div style={{
      background: `${decisionColor}08`,
      border: `1.5px solid ${decisionColor}44`,
      borderRadius: 10,
      padding: "22px 26px",
      marginBottom: 24,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.16em", background: `${decisionColor}18`, padding: "3px 9px", borderRadius: 3, fontWeight: 700 }}>PARTNER MEMO</span>
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: decisionColor, letterSpacing: "0.04em" }}>{vc.verdictLine}</span>
      </div>

      {/* THE BET */}
      <div style={{ marginBottom: 20, borderLeft: `3px solid ${decisionColor}`, paddingLeft: 14 }}>
        <div style={{ ...SECTION_LABEL, color: decisionColor }}>THE BET</div>
        <p style={{ margin: 0, fontSize: 13, color: TEXT, fontWeight: 600, lineHeight: 1.5, fontStyle: "italic" }}>
          {vc.theBet}
        </p>
      </div>

      {/* 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        {/* Reasons to Invest */}
        <div>
          <div style={{ ...SECTION_LABEL, color: GREEN }}>3 Reasons to Invest</div>
          {(vc.reasonsToInvest ?? []).map((r, i) => (
            <div key={i} style={BULLET}>
              <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
              <span>{r}</span>
            </div>
          ))}
        </div>

        {/* Reasons NOT to Invest */}
        <div>
          <div style={{ ...SECTION_LABEL, color: isReject ? RED : AMBER }}>3 Reasons NOT to Invest</div>
          {(vc.reasonsNotToInvest ?? []).map((r, i) => (
            <div key={i} style={BULLET}>
              <span style={{ color: isReject ? RED : AMBER, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
              <span>{r}</span>
            </div>
          ))}
        </div>

        {/* What Would Change Decision */}
        <div>
          <div style={{ ...SECTION_LABEL, color: ACCENT }}>What Would Change Decision</div>
          {(vc.whatWouldChange ?? []).map((w, i) => (
            <div key={i} style={BULLET}>
              <span style={{ color: ACCENT, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardroomICReport({ ic, result, onCopy, onNewDeal }: { ic: ICReportData; result: CouncilResult; onCopy: (text: string) => void; onNewDeal: () => void }) {
  // Color derived from council verdict (not IC executive verdict) for consistency
  const verdictColor = result.verdict === "APPROVED" ? GREEN
    : result.verdict === "APPROVED_WITH_CONDITIONS" ? ACCENT
    : RED; // REJECTED or VETOED

  // Confidence label from vote distribution
  const yesPct = result.yesCount / 10;
  const confidenceLabel = yesPct >= 0.8 ? "HIGH" : yesPct >= 0.6 ? "MEDIUM" : "LOW";
  const confidenceColor = yesPct >= 0.8 ? GREEN : yesPct >= 0.6 ? AMBER : RED;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* ── PRIMARY VERDICT HEADER — always first, always visible ── */}
      <div style={{
        background: `${verdictColor}0d`,
        border: `2px solid ${verdictColor}`,
        borderRadius: 10,
        padding: "20px 26px",
        marginBottom: 20,
        boxShadow: `0 0 28px ${verdictColor}22`,
      }}>
        {/* Top row: label */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em" }}>DEAL SCREENER — IC DECISION</div>
        </div>
        {/* Bottom row: deal info + confidence + verdict badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 6 }}>{result.dealName}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ color: GREEN }}>{result.yesCount} YES</span>
              <span style={{ color: MUTED }}>·</span>
              <span style={{ color: RED }}>{result.noCount} NO</span>
              <span style={{ color: MUTED }}>·</span>
              <span
                title={`${result.yesCount} YES / ${result.noCount} NO — ${Math.round(yesPct * 100)}% council agreement`}
                style={{
                  background: `${confidenceColor}18`,
                  border: `1px solid ${confidenceColor}55`,
                  color: confidenceColor,
                  padding: "2px 8px",
                  borderRadius: 3,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  cursor: "help",
                }}>CONFIDENCE: {confidenceLabel}</span>
            </div>
          </div>
          <VerdictBadge verdict={result.verdict} />
        </div>
      </div>
      {/* University Signal Badge — shown only when a Tier 0 signal was detected */}
      {result.universitySignal && (
        <div style={{
          background: "rgba(74,158,255,0.08)",
          border: "1px solid rgba(74,158,255,0.4)",
          borderRadius: 8,
          padding: "12px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 18 }}>🎓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#4a9eff", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 3 }}>
              UNIVERSITY SIGNAL DETECTED
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>
              <span style={{ color: TEXT }}>{result.universitySignal.source}</span>
              {" "}&mdash;{" "}
              <span style={{ color: "#4a9eff" }}>{result.universitySignal.subtype}</span>
              {" · "}
              <span>{result.universitySignal.classification}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              background: result.universitySignal.tier === "0A" ? "rgba(0,255,135,0.12)" : "rgba(255,159,67,0.12)",
              border: `1px solid ${result.universitySignal.tier === "0A" ? "rgba(0,255,135,0.4)" : "rgba(255,159,67,0.4)"}`,
              color: result.universitySignal.tier === "0A" ? GREEN : AMBER,
              padding: "3px 10px", borderRadius: 3, letterSpacing: "0.08em",
            }}>TIER {result.universitySignal.tier}</span>
            <span style={{
              fontFamily: MONO, fontSize: 10,
              background: "rgba(74,158,255,0.1)",
              border: "1px solid rgba(74,158,255,0.3)",
              color: "#4a9eff",
              padding: "3px 10px", borderRadius: 3, letterSpacing: "0.08em",
            }}>+{result.universitySignal.scoreBoost} PTS</span>
            <span style={{
              fontFamily: MONO, fontSize: 10,
              color: result.universitySignal.confidence === "High" ? GREEN : AMBER,
              letterSpacing: "0.06em",
            }}>{result.universitySignal.confidence.toUpperCase()} CONFIDENCE</span>
          </div>
        </div>
      )}

      {/* VC Summary Block — shown only when vcSummary is present */}
      {ic.vcSummary && <VCSummaryBlock vc={ic.vcSummary} decisionColor={verdictColor} />}

      {/* Verification Banner */}
      <div style={{
        background: `rgba(0,255,135,0.06)`, border: `1px solid ${GREEN}44`,
        borderRadius: 8, padding: "14px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: GREEN, fontWeight: 700 }}>✓ MULTI-AGENT CONSENSUS VERIFIED</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>Consensus: <span style={{ color: GREEN }}>{ic.verificationBanner.consensusScore}%</span></span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>Confidence: <span style={{ color: ic.verificationBanner.confidenceLevel === "HIGH" ? GREEN : ic.verificationBanner.confidenceLevel === "MEDIUM" ? AMBER : RED }}>{ic.verificationBanner.confidenceLevel}</span></span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, width: "100%" }}>{ic.verificationBanner.conflictStatus}</span>
      </div>

      {/* Executive Verdict */}
      <div style={{ background: BG2, border: `1px solid ${verdictColor}44`, borderRadius: 8, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.12em", marginBottom: 8 }}>2. EXECUTIVE VERDICT</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: verdictColor }}>{ic.executiveVerdict.decision}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, background: `${verdictColor}18`, padding: "4px 10px", borderRadius: 4 }}>{ic.executiveVerdict.recommendedAction}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{ic.executiveVerdict.rationale}</p>
      </div>

      {/* 2-column grid: Thesis + Risks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN, letterSpacing: "0.12em", marginBottom: 12 }}>3. INVESTMENT THESIS</div>
          {ic.investmentThesis.map((t, i) => (
            <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${GREEN}`, lineHeight: 1.5 }}>{t}</div>
          ))}
        </div>
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: RED, letterSpacing: "0.12em", marginBottom: 12 }}>4. KEY RISKS / RED FLAGS</div>
          {ic.keyRisks.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${RED}`, lineHeight: 1.5 }}>{r}</div>
          ))}
        </div>
      </div>

      {/* Decision Triggers */}
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, letterSpacing: "0.12em", marginBottom: 12 }}>5. WHAT WOULD CHANGE THIS DECISION</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: GREEN, marginBottom: 8 }}>UPGRADE TRIGGERS</div>
            {ic.decisionTriggers.upgradeTriggers.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${GREEN}`, lineHeight: 1.5 }}>+ {t}</div>
            ))}
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: RED, marginBottom: 8 }}>DOWNGRADE TRIGGERS</div>
            {ic.decisionTriggers.downgradeTriggers.map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${RED}`, lineHeight: 1.5 }}>- {t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Consensus Breakdown */}
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>6. CONSENSUS BREAKDOWN</div>
        <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: GREEN }}>Approve: <strong>{ic.consensusBreakdown.approve}</strong></span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: RED }}>Reject: <strong>{ic.consensusBreakdown.reject}</strong></span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: AMBER }}>Conditional: <strong>{ic.consensusBreakdown.conditional}</strong></span>
        </div>
        {ic.consensusBreakdown.keyDisagreements.length > 0 && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginBottom: 8 }}>KEY DISAGREEMENTS</div>
            {ic.consensusBreakdown.keyDisagreements.map((d, i) => (
              <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${AMBER}`, lineHeight: 1.5 }}>! {d}</div>
            ))}
          </div>
        )}
      </div>

      {/* 30-Day Action Plan + Market Context */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>7. 30-DAY ACTION PLAN</div>
          {ic.thirtyDayActionPlan.map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${ACCENT}`, lineHeight: 1.5 }}>{i + 1}. {a}</div>
          ))}
        </div>
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: PURPLE, letterSpacing: "0.12em", marginBottom: 12 }}>8. MARKET & REGULATORY CONTEXT</div>
          {ic.marketAndRegulatoryContext.map((m, i) => (
            <div key={i} style={{ fontSize: 12, color: TEXT2, marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${PURPLE}`, lineHeight: 1.5 }}>• {m}</div>
          ))}
        </div>
      </div>

      {/* Copy IC Report button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }} className="no-print">
        <button
          onClick={() => onCopy(ic.rawText)}
          style={{
            padding: "8px 18px", background: "none",
            border: `1px solid ${GREEN}`, color: GREEN,
            fontFamily: MONO, fontSize: 11, cursor: "pointer",
            borderRadius: 4, letterSpacing: "0.06em",
          }}
        >
          ⎘ COPY IC REPORT
        </button>
      </div>
    </div>
  );
}

// ── IC Report (raw Council output + boardroom IC Report tabs) ─────────────────
function ICReport({ result, onNewDeal }: { result: CouncilResult; onNewDeal: () => void }) {
  const [activeTab, setActiveTab] = useState<"raw" | "boardroom">(result.icReport ? "boardroom" : "raw");
  const [copied, setCopied] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [icMemoLoading, setIcMemoLoading] = useState(false);
  const [icMemoError, setIcMemoError] = useState<string | null>(null);
  const [icMemoStatus, setIcMemoStatus] = useState<"idle" | "synthesising" | "rendering" | "done">("idle");

  const icMemoPdfMutation = trpc.dealScreener.icMemoPdf.useMutation();
  const createShare = trpc.shareReport.create.useMutation();

  const handleICMemoPdf = async () => {
    setIcMemoLoading(true);
    setIcMemoError(null);
    setIcMemoStatus("synthesising");
    try {
      // Stage 1: synthesising (LLM call, ~15-25s)
      const synthesisTimer = setTimeout(() => setIcMemoStatus("rendering"), 20000);
      const res = await icMemoPdfMutation.mutateAsync({
        dealName:            result.dealName,
        verdict:             result.verdict,
        yesCount:            result.yesCount,
        noCount:             result.noCount,
        confidenceScore:     result.confidenceScore,
        conditionsToProceed: result.conditionsToProceed,
        blockingIssues:      result.blockingIssues,
        votes: result.votes.map(v => ({
          personaId:   v.personaId,
          personaName: v.personaId,
          personaRole: v.personaRole,
          vote:        v.vote,
          confidence:  v.confidence,
          rationale:   v.rationale,
          keyFlags:    v.keyFlags,
          conditions:  v.conditions,
          blockers:    v.blockers,
        })),
      });
      clearTimeout(synthesisTimer);
      setIcMemoStatus("done");
      const bytes = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(() => setIcMemoStatus("idle"), 2000);
    } catch (err) {
      setIcMemoStatus("idle");
      setIcMemoError(err instanceof Error ? err.message.slice(0, 80) : "Failed to generate IC memo");
    } finally {
      setIcMemoLoading(false);
    }
  };

  const handleShare = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
      return;
    }
    setShareLoading(true);
    try {
      const res = await createShare.mutateAsync({
        reportType: "single_deal",
        dealId: result.dealId,
        expiryDays: 7,
      });
      const url = `${window.location.origin}/reports/${res.token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch (e) {
      console.error("Share failed", e);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyICReport = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const confidencePct = Math.round(result.confidenceScore * 100);
  const yesPct = Math.round((result.yesCount / 10) * 100);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Special banners */}
      {result.gccVetoTriggered && (
        <div style={{
          padding: "10px 16px",
          background: "rgba(255,71,87,0.12)",
          border: `1px solid ${RED}`,
          borderRadius: 6,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🚫</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: RED, fontWeight: 700 }}>
            COUNCIL VETO TRIGGERED — Hard block detected by regulatory or legal agent
          </span>
        </div>
      )}
      {result.tiebreakerTriggered && (
        <div style={{
          padding: "10px 16px",
          background: "rgba(168,85,247,0.12)",
          border: `1px solid ${PURPLE}`,
          borderRadius: 6,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: PURPLE, fontWeight: 700 }}>
            TIEBREAKER TRIGGERED — {result.tiebreakerSwingAgent} swung the vote to APPROVED WITH CONDITIONS
          </span>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: `1px solid ${BORDER}`, paddingBottom: 0 }}>
        {(result.icReport ? [
          { id: "boardroom" as const, label: "🏛️ IC REPORT" },
          { id: "raw" as const, label: "⚡ RAW COUNCIL" },
        ] : [
          { id: "raw" as const, label: "⚡ RAW COUNCIL" },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 18px",
              background: activeTab === tab.id ? "rgba(74,158,255,0.1)" : "transparent",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab.id ? ACCENT : "transparent"}`,
              color: activeTab === tab.id ? ACCENT : MUTED,
              fontFamily: MONO, fontSize: 10, cursor: "pointer", letterSpacing: "0.08em",
            }}
          >{tab.label}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", paddingBottom: 4 }}>
          {activeTab === "boardroom" && result.icReport && (
            <button
              onClick={() => handleCopyICReport(result.icReport!.rawText)}
              style={{ padding: "5px 14px", background: "none", border: `1px solid ${GREEN}`, color: copied ? GREEN : TEXT2, fontFamily: MONO, fontSize: 10, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em" }}
            >{copied ? "✓ COPIED" : "⎘ COPY IC REPORT"}</button>
          )}
          {activeTab === "raw" && (
            <button
              onClick={handleCopyJson}
              style={{ padding: "5px 14px", background: "none", border: `1px solid ${BORDER}`, color: copiedRaw ? ACCENT : TEXT2, fontFamily: MONO, fontSize: 10, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em" }}
            >{copiedRaw ? "✓ COPIED" : "⎘ COPY RAW CONSENSUS"}</button>
          )}
          <button
            onClick={handleShare}
            disabled={shareLoading}
            style={{ padding: "5px 14px", background: "none", border: `1px solid ${PURPLE}`, color: shareCopied ? PURPLE : TEXT2, fontFamily: MONO, fontSize: 10, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em", opacity: shareLoading ? 0.6 : 1 }}
          >{shareLoading ? "GENERATING..." : shareCopied ? "✓ LINK COPIED" : shareUrl ? "⎘ COPY LINK" : "↗ SHARE"}</button>
          <button
            onClick={handleICMemoPdf}
            disabled={icMemoLoading}
            title="Generate a full institutional IC Memo PDF (~30 pages)"
            style={{
              padding: "5px 14px",
              background: icMemoStatus === "done" ? "rgba(0,255,135,0.12)" : icMemoLoading ? "rgba(212,175,55,0.06)" : "rgba(212,175,55,0.12)",
              border: `1px solid rgba(212,175,55,${icMemoLoading ? 0.3 : 0.5})`,
              color: icMemoStatus === "done" ? GREEN : "#D4AF37",
              fontFamily: MONO,
              fontSize: 10,
              cursor: icMemoLoading ? "not-allowed" : "pointer",
              borderRadius: 4,
              letterSpacing: "0.06em",
              opacity: icMemoLoading ? 0.8 : 1,
              display: "flex",
              alignItems: "center",
              gap: 5,
              minWidth: 160,
              justifyContent: "center",
            }}
          >
            {icMemoStatus === "synthesising" && (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 11 }}>&#9696;</span>
                SYNTHESISING...
              </>
            )}
            {icMemoStatus === "rendering" && (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 11 }}>&#9696;</span>
                RENDERING PDF...
              </>
            )}
            {icMemoStatus === "done" && "✓ DOWNLOADED"}
            {icMemoStatus === "idle" && "📋 IC MEMO PDF"}
          </button>
          {icMemoError && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: RED, fontFamily: MONO, maxWidth: 160 }}>&#9888; {icMemoError}</span>
              <button
                onClick={handleICMemoPdf}
                style={{ fontSize: 9, color: RED, fontFamily: MONO, background: "none", border: `1px solid ${RED}`, borderRadius: 3, padding: "2px 7px", cursor: "pointer" }}
              >RETRY</button>
            </div>
          )}
          <button
            onClick={onNewDeal}
            style={{ padding: "5px 14px", background: ACCENT, border: "none", color: "#000", fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: "pointer", borderRadius: 4, letterSpacing: "0.06em" }}
          >NEW DEAL</button>
        </div>
      </div>

      {/* Boardroom IC Report tab */}
      {activeTab === "boardroom" && result.icReport && (
        <BoardroomICReport ic={result.icReport} result={result} onCopy={handleCopyICReport} onNewDeal={onNewDeal} />
      )}

      {/* Raw Council tab */}
      {activeTab === "raw" && (
        <div>
      {/* Top section */}
      <div style={{
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "24px 28px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 4 }}>RAW COUNCIL OUTPUT</div>
            <h2 style={{ margin: 0, fontSize: 22, color: TEXT, fontWeight: 700 }}>{result.dealName}</h2>
          </div>
          <VerdictBadge verdict={result.verdict} />
        </div>

        {/* Score bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: GREEN }}>YES {result.yesCount}/10</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>Confidence {confidencePct}%</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: RED }}>NO {result.noCount}/10</span>
          </div>
          <div style={{ height: 8, background: BG3, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${yesPct}%`,
              background: `linear-gradient(90deg, ${GREEN}, ${ACCENT})`,
              borderRadius: 4,
              transition: "width 0.8s ease",
            }} />
          </div>
        </div>

        {/* Vote breakdown */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "HARD YES", count: result.hardYesCount, color: GREEN },
            { label: "SOFT YES", count: result.softYesCount, color: ACCENT },
            { label: "SOFT NO", count: result.softNoCount, color: AMBER },
            { label: "HARD NO", count: result.hardNoCount, color: RED },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: item.color }}>{item.count}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.08em" }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Persona vote cards */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 12 }}>COUNCIL VOTES — click to expand</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {result.votes.map((v) => (
            <VoteCard key={v.personaId} vote={v} result={result} />
          ))}
        </div>
      </div>

      {/* Conditions + Blockers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Conditions to proceed */}
        <div style={{
          background: BG2,
          border: `1px solid rgba(255,159,67,0.3)`,
          borderRadius: 8,
          padding: "16px 20px",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, letterSpacing: "0.1em", marginBottom: 12 }}>
            CONDITIONS TO PROCEED ({result.conditionsToProceed.length})
          </div>
          {result.conditionsToProceed.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED }}>No conditions required</div>
          ) : (
            result.conditionsToProceed.map((c, i) => (
              <div key={i} style={{
                fontSize: 12,
                color: TEXT2,
                marginBottom: 8,
                paddingLeft: 12,
                borderLeft: `2px solid ${AMBER}`,
                lineHeight: 1.5,
              }}>
                {c}
              </div>
            ))
          )}
        </div>

        {/* Blocking issues */}
        <div style={{
          background: BG2,
          border: `1px solid rgba(255,71,87,0.3)`,
          borderRadius: 8,
          padding: "16px 20px",
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: RED, letterSpacing: "0.1em", marginBottom: 12 }}>
            BLOCKING ISSUES ({result.blockingIssues.length})
          </div>
          {result.blockingIssues.length === 0 ? (
            <div style={{ fontSize: 12, color: MUTED }}>No blocking issues identified</div>
          ) : (
            result.blockingIssues.map((b, i) => (
              <div key={i} style={{
                fontSize: 12,
                color: TEXT2,
                marginBottom: 8,
                paddingLeft: 12,
                borderLeft: `2px solid ${RED}`,
                lineHeight: 1.5,
              }}>
                {b}
              </div>
            ))
          )}
        </div>
       </div>

      {/* Similar Deals — RAG precedent layer */}
      {result.precedents && result.precedents.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 12 }}>SIMILAR DEALS SCREENED PREVIOUSLY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.precedents.map((p, i) => {
              const simPct = Math.round(p.similarity * 100);
              const simColor = simPct >= 80 ? GREEN : simPct >= 60 ? AMBER : TEXT2;
              const verdictCfg: Record<string, { color: string; label: string }> = {
                APPROVED: { color: GREEN, label: "APPROVED" },
                APPROVED_WITH_CONDITIONS: { color: ACCENT, label: "CONDITIONAL" },
                REJECTED: { color: RED, label: "REJECTED" },
                VETOED: { color: RED, label: "VETOED" },
              };
              const vc = p.finalVerdict ? (verdictCfg[p.finalVerdict] ?? { color: MUTED, label: p.finalVerdict }) : { color: MUTED, label: "UNKNOWN" };
              return (
                <div key={i} style={{
                  background: BG2,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 6,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}>
                  {/* Similarity score */}
                  <div style={{ flexShrink: 0, textAlign: "center", minWidth: 52 }}>
                    <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: simColor }}>{simPct}%</div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: "0.08em" }}>MATCH</div>
                  </div>
                  {/* Deal description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>
                      {p.taskDescription.length > 180 ? p.taskDescription.slice(0, 180) + "…" : p.taskDescription}
                    </div>
                  </div>
                  {/* Prior verdict */}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 9, fontWeight: 700,
                      background: `${vc.color}18`,
                      border: `1px solid ${vc.color}55`,
                      color: vc.color,
                      padding: "3px 8px", borderRadius: 3, letterSpacing: "0.08em",
                    }}>{vc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 8, letterSpacing: "0.06em" }}>
            ↑ Retrieved via TF-IDF cosine similarity from your deal history. For reference only — this deal evaluated independently.
          </div>
        </div>
      )}

      </div>
      )}
    </div>
  );
}

// ──// ── Deal Form ─────────────────────────────────────────────────────
const OWNER_EMAILS_LIST = ["farouq@agenthink.ai", "farouqsultan@gmail.com"];
function DealForm({ onResult, onSubmitStart, onError: onSubmitError, pendingPaymentSessionId, onPaymentVerified, councilMode, setCouncilMode }: {
  onResult: (r: CouncilResult) => void;
  onSubmitStart: () => void;
  onError: (msg: string) => void;
  pendingPaymentSessionId: string | null;
  onPaymentVerified: () => void;
  councilMode: CouncilModeType;
  setCouncilMode: (m: CouncilModeType) => void;
}) {
  const { user: authUser } = useAuth();
  const [dealName, setDealName] = useState("");
  const [dealText, setDealText] = useState("");
  // Guided form mode
  const [guidedMode, setGuidedMode] = useState(true);
  const [g_what, setGWhat] = useState("");
  const [g_country, setGCountry] = useState("");
  const [g_sector, setGSector] = useState("");
  const [g_amount, setGAmount] = useState("");
  const [g_exit, setGExit] = useState("");
  const [g_extra, setGExtra] = useState("");
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  // Data Room Ingestion V1 — toggle state
  const [dataRoomMode, setDataRoomMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "KWD" | "CNY" | "EUR">("USD");
  const fileRef = useRef<HTMLInputElement>(null);

  // FX price for the selected currency (15-min cache matches FX service TTL)
  const { data: priceData, isLoading: priceLoading } = trpc.billing.getPrice.useQuery(
    { currency: selectedCurrency },
    { staleTime: 15 * 60 * 1000 }
  );

  // Verify payment status when returning from Stripe
  const { data: paymentVerification } = trpc.billing.verifyDealPayment.useQuery(
    { sessionId: pendingPaymentSessionId! },
    { enabled: !!pendingPaymentSessionId, refetchInterval: 2000, refetchIntervalInBackground: false }
  );

  const isPaid = paymentVerification?.paid === true;

  const checkoutMutation = trpc.billing.createDealScreenerCheckout.useMutation({
    onSuccess: (data) => {
      if (data.stub) {
        // Stub mode: skip payment and run directly
        onPaymentVerified();
        return;
      }
      // Save form data to sessionStorage before redirect
      sessionStorage.setItem("ds_pending_deal_name", dealName.trim());
      sessionStorage.setItem("ds_pending_deal_text", dealText.trim());
      // Use same-tab redirect — window.open is blocked by popup blockers
      window.location.href = data.url;
    },
    onError: (err) => {
      setError(err.message);
      setCheckoutLoading(false);
    },
  });

  const lastSubmittedTextRef = React.useRef<string>("");
  const screenMutation = trpc.dealScreener.screen.useMutation({
    onSuccess: (data) => {
      const resultWithText: CouncilResult = { ...(data as CouncilResult), dealText: lastSubmittedTextRef.current };
      onResult(resultWithText);
    },
    onError: (err) => {
      setError(err.message);
      onSubmitError(err.message);
    },
  });

  // Auto-run council once payment is verified
  useEffect(() => {
    if (isPaid && pendingPaymentSessionId) {
      const savedName = sessionStorage.getItem("ds_pending_deal_name") || dealName;
      const savedText = sessionStorage.getItem("ds_pending_deal_text") || dealText;
      if (savedName && savedText) {
        sessionStorage.removeItem("ds_pending_deal_name");
        sessionStorage.removeItem("ds_pending_deal_text");
        onSubmitStart();
        lastSubmittedTextRef.current = savedText;
        screenMutation.mutate({ dealName: savedName, dealText: savedText, stripeSessionId: pendingPaymentSessionId });
        onPaymentVerified();
      }
    }
  }, [isPaid]);

  // Restore saved form values after Stripe redirect
  useEffect(() => {
    if (pendingPaymentSessionId) {
      const savedName = sessionStorage.getItem("ds_pending_deal_name");
      const savedText = sessionStorage.getItem("ds_pending_deal_text");
      if (savedName) setDealName(savedName);
      if (savedText) setDealText(savedText);
    }
  }, [pendingPaymentSessionId]);

  // Listen for Tier 0 signal pre-fill events from the Signals feed
  useEffect(() => {
    const handler = (e: Event) => {
      const { dealName: name, dealText: text } = (e as CustomEvent).detail;
      if (name) setDealName(name);
      if (text) setDealText(text);
    };
    window.addEventListener("tier0:prefill", handler);
    return () => window.removeEventListener("tier0:prefill", handler);
  }, []);

  const handlePdfUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("PDF must be under 5 MB");
      return;
    }
    setPdfUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/deals/upload-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!dealText.trim()) {
        setDealText(data.text);
      }
      setPdfFilename(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload failed");
    } finally {
      setPdfUploading(false);
    }
  };

  // ── FREE MODE — payment disabled for all users (demo/open access mode) ────────────────
  // To re-enable payment: replace `true` with: authUser?.email ? OWNER_EMAILS_LIST.includes(authUser.email.toLowerCase().trim()) : false
  const FREE_MODE = true;

  // Build IC memo from guided form fields
  const buildMemoFromGuided = () => [
    g_what.trim()   && `BUSINESS DESCRIPTION:\n${g_what.trim()}`,
    (g_country.trim() || g_sector.trim()) && `MARKET:\nCountry: ${g_country.trim() || "Not specified"}.\nSector: ${g_sector.trim() || "Not specified"}.`,
    g_amount.trim() && `INVESTMENT:\n${g_amount.trim()}`,
    g_exit.trim()   && `EXIT STRATEGY:\n${g_exit.trim()}`,
    g_extra.trim()  && `ADDITIONAL CONTEXT:\n${g_extra.trim()}`,
  ].filter(Boolean).join("\n\n");

  const isGuidedReady = dealName.trim().length > 0 && g_what.trim().length > 0 && g_country.trim().length > 0 && g_sector.trim().length > 0;

  const handlePayAndScreen = () => {
    setTouchedSubmit(true);
    if (!dealName.trim()) { setError("Deal name is required"); return; }
    if (guidedMode) {
      if (!g_what.trim()) { setError("Please describe the business"); return; }
      if (!g_country.trim()) { setError("Please enter the country"); return; }
      if (!g_sector.trim()) { setError("Please enter the sector / industry"); return; }
    } else {
      if (!dealText.trim()) { setError("Deal description is required"); return; }
    }
    setError(null);
    const finalText = guidedMode ? buildMemoFromGuided() : dealText.trim();
    lastSubmittedTextRef.current = finalText;
    if (FREE_MODE) {
      onSubmitStart();
      screenMutation.mutate({ dealName: dealName.trim(), dealText: finalText, councilMode });
      return;
    }
    sessionStorage.setItem("ds_pending_deal_text", finalText);
    sessionStorage.setItem("ds_pending_deal_name", dealName.trim());
    setCheckoutLoading(true);
    checkoutMutation.mutate({ origin: window.location.origin });
  };

  const charCount = dealText.length;
  const isLoading = screenMutation.isPending || checkoutLoading;
  const canSubmit = guidedMode ? isGuidedReady : (dealName.trim().length > 0 && dealText.trim().length > 0);

  // ── Data Room Ingestion handoff ──────────────────────────────────────────
  const handleDataRoomReady = (result: DataRoomResult) => {
    // Pre-fill the manual form with the reviewed extraction output
    setDealName(result.dealName);
    setDealText(result.dealText);
    setGuidedMode(false); // switch to expert mode so dealText is used
    setDataRoomMode(false);
    // Auto-submit: set lastSubmittedTextRef and fire the mutation directly
    lastSubmittedTextRef.current = result.dealText;
    onSubmitStart();
    screenMutation.mutate({ dealName: result.dealName, dealText: result.dealText, councilMode });
  };

  // If data room mode is active, render the upload/review component
  if (dataRoomMode) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 8 }}>
            DEAL SCREENER v1.0 · COUNCIL OF 10
          </div>
          <h1 style={{ margin: 0, fontSize: 28, color: TEXT, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Investment Council
          </h1>
        </div>
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "28px 32px" }}>
          <DataRoomUpload
            onReady={handleDataRoomReady}
            onCancel={() => setDataRoomMode(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 8 }}>
          DEAL SCREENER v1.0 · COUNCIL OF 10
        </div>
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Investment Council
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
          Submit a deal memo. 10 specialist AI advisors vote in parallel.<br />
          Receive an IC-ready decision report with verdict, risks, and conditions.
        </p>
        {/* Pay-per-run pricing badge */}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 6,
            border: `1px solid rgba(74,158,255,0.4)`,
            background: "rgba(74,158,255,0.08)",
            fontFamily: MONO,
            fontSize: 12,
            color: ACCENT,
            letterSpacing: "0.06em",
          }}>
            <span style={{ fontSize: 16 }}>{FREE_MODE ? "🟢" : "💳"}</span>
            <div>
              <div>
                {FREE_MODE ? (
                  <strong style={{ fontSize: 18, color: GREEN }}>FREE PREVIEW MODE</strong>
                ) : (
                  <strong style={{ fontSize: 18, color: GREEN }}>
                    {priceLoading
                      ? "$32.50 USD"
                      : selectedCurrency === "USD"
                        ? "$32.50 USD"
                        : `${priceData?.amount?.toFixed(2)} ${selectedCurrency}`
                    }
                  </strong>
                )}
                {!FREE_MODE && selectedCurrency !== "USD" && !priceLoading && (
                  <span style={{ fontSize: 11, color: TEXT2, marginLeft: 6 }}>(= $32.50 USD)</span>
                )}
                <span style={{ fontSize: 12, color: TEXT2, marginLeft: 6 }}>
                  {FREE_MODE ? "— no payment required" : "per Council run"}
                </span>
              </div>
              {/* Currency selector */}
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {(["USD", "KWD", "CNY", "EUR"] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setSelectedCurrency(cur)}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: `1px solid ${selectedCurrency === cur ? GREEN : BORDER}`,
                      background: selectedCurrency === cur ? "rgba(0,255,135,0.1)" : "transparent",
                      color: selectedCurrency === cur ? GREEN : TEXT2,
                      fontFamily: MONO,
                      fontSize: 10,
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {cur}
                  </button>
                ))}
              </div>
              {priceData && selectedCurrency !== "USD" && (
                <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginTop: 3 }}>
                  1 USD = {priceData.rate?.toFixed(4)} {selectedCurrency}
                  {" · "}
                  rate at {new Date(priceData.rateAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
            {FREE_MODE ? "Preview mode · Payment disabled · Council of 10 runs free" : "One-time · Secure Stripe Checkout · No subscription required"}
          </div>
        </div>


      </div>

        {/* Form card */}
      <div style={{
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: "28px 32px",
      }}>
        {/* Council Mode Selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 10 }}>
            COUNCIL MODE — SELECT YOUR INVESTOR LENS
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {([
              { key: "gcc" as const, icon: "🏛️", label: "GCC Institutional", desc: "Kuwait CMA · Shariah · Vision 2035" },
              { key: "global_vc" as const, icon: "🌐", label: "Global VC", desc: "Sequoia · a16z · Lightspeed lens" },
              { key: "india_pe" as const, icon: "🇮🇳", label: "India PE / VC", desc: "SEBI · FEMA · NSE/BSE exits" },
            ] as const).map(({ key, icon, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCouncilMode(key)}
                style={{
                  padding: "12px 10px",
                  background: councilMode === key ? "rgba(74,158,255,0.12)" : "transparent",
                  border: `1px solid ${councilMode === key ? ACCENT : BORDER}`,
                  borderRadius: 6,
                  color: councilMode === key ? ACCENT : TEXT2,
                  fontFamily: MONO,
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "center" as const,
                  transition: "all 0.15s",
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontWeight: 700, letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 9, color: councilMode === key ? "rgba(74,158,255,0.7)" : MUTED, letterSpacing: "0.03em" }}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Deal name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
            DEAL NAME *
          </label>
          <input
            value={dealName}
            onChange={(e) => { setDealName(e.target.value); if (touchedSubmit && e.target.value.trim()) setError(null); }}
            placeholder="e.g. Tamara Series B — BNPL GCC"
            maxLength={255}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: BG3,
              border: `1px solid ${touchedSubmit && !dealName.trim() ? "#ff4757" : BORDER}`,
              borderRadius: 4,
              color: TEXT,
              fontFamily: MONO,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([{ key: true, label: "🧭 Guided (Easy)" }, { key: false, label: "✏️ Expert (Full Memo)" }] as const).map(({ key, label }) => (
            <button
              key={String(key)}
              onClick={() => setGuidedMode(key)}
              style={{
                flex: 1,
                padding: "8px 0",
                background: guidedMode === key ? "rgba(74,158,255,0.15)" : "transparent",
                border: `1px solid ${guidedMode === key ? ACCENT : BORDER}`,
                borderRadius: 4,
                color: guidedMode === key ? ACCENT : TEXT2,
                fontFamily: MONO,
                fontSize: 11,
                cursor: "pointer",
                fontWeight: guidedMode === key ? 700 : 400,
                letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}
            >{label}</button>
          ))}
          {/* Data Room Ingestion V1 */}
          <button
            type="button"
            onClick={() => setDataRoomMode(true)}
            style={{
              flex: 1,
              padding: "8px 0",
              background: "transparent",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              color: TEXT2,
              fontFamily: MONO,
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 400,
              letterSpacing: "0.04em",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT2; }}
          >
            📁 Upload Data Room
          </button>
        </div>

        {/* Guided form */}
        {guidedMode ? (
          <div style={{ marginBottom: 16 }}>
            {/* Q1 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
                WHAT IS THE BUSINESS? *
              </label>
              <input
                value={g_what}
                onChange={(e) => { setGWhat(e.target.value); if (touchedSubmit && e.target.value.trim()) setError(null); }}
                placeholder="e.g. A chain of 18 fast-food restaurants in Kuwait owned by Kuwaiti nationals"
                style={{ width: "100%", padding: "10px 14px", background: BG3, border: `1px solid ${touchedSubmit && !g_what.trim() ? "#ff4757" : BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {/* Q2 + Q3 side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
                  WHICH COUNTRY? *
                </label>
                <input
                  value={g_country}
                  onChange={(e) => { setGCountry(e.target.value); if (touchedSubmit && e.target.value.trim()) setError(null); }}
                  placeholder="e.g. Kuwait"
                  style={{ width: "100%", padding: "10px 14px", background: BG3, border: `1px solid ${touchedSubmit && !g_country.trim() ? "#ff4757" : BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
                  WHICH SECTOR? *
                </label>
                <input
                  value={g_sector}
                  onChange={(e) => { setGSector(e.target.value); if (touchedSubmit && e.target.value.trim()) setError(null); }}
                  placeholder="e.g. Food & Beverage"
                  style={{ width: "100%", padding: "10px 14px", background: BG3, border: `1px solid ${touchedSubmit && !g_sector.trim() ? "#ff4757" : BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            {/* Q4 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
                HOW MUCH ARE YOU INVESTING &amp; WHAT IS THE STRUCTURE?
              </label>
              <input
                value={g_amount}
                onChange={(e) => setGAmount(e.target.value)}
                placeholder="e.g. KWD 6M for 60% stake, 100% equity, no debt, 7-year hold, 15% IRR target"
                style={{ width: "100%", padding: "10px 14px", background: BG3, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {/* Q5 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
                HOW DO YOU PLAN TO EXIT?
              </label>
              <input
                value={g_exit}
                onChange={(e) => setGExit(e.target.value)}
                placeholder="e.g. Strategic sale to Americana Group or Boursa Kuwait IPO in 4-5 years"
                style={{ width: "100%", padding: "10px 14px", background: BG3, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            {/* Q6 optional */}
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
                ANYTHING ELSE THE COUNCIL SHOULD KNOW? (optional)
              </label>
              <textarea
                value={g_extra}
                onChange={(e) => setGExtra(e.target.value)}
                placeholder="e.g. The company has zero debt, audited by Ernst & Young, and all licences are fully transferable"
                rows={3}
                style={{ width: "100%", padding: "10px 14px", background: BG3, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.5, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
        ) : (
          /* Expert mode: raw textarea */
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em" }}>
                DEAL MEMO / DESCRIPTION *
              </label>
              <span style={{ fontFamily: MONO, fontSize: 10, color: charCount > 9000 ? AMBER : MUTED }}>
                {charCount}/10000
              </span>
            </div>
            <textarea
              value={dealText}
              onChange={(e) => { setDealText(e.target.value); if (touchedSubmit && e.target.value.trim()) setError(null); }}
              placeholder="Paste the full deal memo, pitch deck summary, or description here. Include: business model, market size, team, traction, financials, and ask."
              maxLength={10000}
              rows={10}
              style={{ width: "100%", padding: "12px 14px", background: BG3, border: `1px solid ${touchedSubmit && !guidedMode && !dealText.trim() ? "#ff4757" : BORDER}`, borderRadius: 4, color: TEXT, fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        )}

        {/* PDF upload */}
        <div style={{ marginBottom: 24 }}>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePdfUpload(file);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={pdfUploading}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: `1px dashed ${BORDER}`,
              borderRadius: 4,
              color: pdfFilename ? GREEN : TEXT2,
              fontFamily: MONO,
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            {pdfUploading ? "⏳ EXTRACTING PDF..." : pdfFilename ? `✓ ${pdfFilename}` : "📎 UPLOAD PDF (optional, max 5 MB)"}
          </button>
          <span style={{ marginLeft: 10, fontSize: 11, color: MUTED }}>
            Text will auto-fill the memo field if empty
          </span>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(255,71,87,0.1)",
            border: `1px solid rgba(255,71,87,0.3)`,
            borderRadius: 4,
            color: RED,
            fontFamily: MONO,
            fontSize: 12,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Pay & Screen button */}
        <button
          onClick={handlePayAndScreen}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "14px",
            background: isLoading ? MUTED : ACCENT,
            border: "none",
            borderRadius: 4,
            color: isLoading ? TEXT2 : "#000",
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            cursor: isLoading ? "not-allowed" : "pointer",
            letterSpacing: "0.08em",
            transition: "background 0.15s",
          }}
        >
          {screenMutation.isPending
            ? "CONVENING COUNCIL..."
            : checkoutLoading
            ? "REDIRECTING TO CHECKOUT..."
            : FREE_MODE
            ? "SCREEN THIS DEAL →"
            : "PAY $32.50 & SCREEN THIS DEAL →"}
        </button>
        <div style={{ textAlign: "center", marginTop: 10, fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>
          {FREE_MODE
            ? "Free preview mode — payment temporarily disabled."
            : "You will be redirected to Stripe Checkout. After payment, the Council of 10 runs automatically."
          }
        </div>

        {/* Secondary CTA — Compare mode */}
        <div style={{ textAlign: "center", marginTop: 20, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.04em" }}>Have multiple deals? </span>
          <a
            href="/deals/compare"
            style={{
              fontFamily: MONO, fontSize: 10, color: ACCENT,
              textDecoration: "none", letterSpacing: "0.04em",
              borderBottom: `1px solid ${ACCENT}55`,
              paddingBottom: 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#7db8ff")}
            onMouseLeave={e => (e.currentTarget.style.color = ACCENT)}
          >
            Compare Deals →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── History Table ─────────────────────────────────────────────────────────────
type HistoryFilter = "ALL" | "APPROVED" | "CONDITIONAL" | "REJECTED";

function HistoryTable({ onSelect }: { onSelect: (dealId: string) => void }) {
  const { data: history, isLoading } = trpc.dealScreener.history.useQuery();
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [reExportingId, setReExportingId] = useState<string | null>(null);
  const [reExportError, setReExportError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const icMemoPdfMutation = trpc.dealScreener.icMemoPdf.useMutation();

  const handleReExportPdf = async (e: React.MouseEvent, dealId: string) => {
    e.stopPropagation(); // prevent row click (navigating to report)
    setReExportingId(dealId);
    setReExportError(null);
    try {
      // Fetch full deal data
      const deal = await utils.dealScreener.getById.fetch({ dealId });
      const res = await icMemoPdfMutation.mutateAsync({
        dealName:            deal.dealName,
        verdict:             deal.verdict,
        yesCount:            deal.yesCount,
        noCount:             deal.noCount,
        confidenceScore:     typeof deal.confidenceScore === "string" ? parseFloat(deal.confidenceScore) : deal.confidenceScore,
        conditionsToProceed: deal.conditionsToProceed as string[],
        blockingIssues:      deal.blockingIssues as string[],
        votes: (deal.votes as Array<{
          personaId: string; personaName?: string; personaRole: string;
          vote: string; confidence: number; rationale: string;
          keyFlags: string[]; conditions: string[]; blockers: string[];
        }>).map(v => ({
          personaId:   v.personaId,
          personaName: v.personaId,
          personaRole: v.personaRole,
          vote:        v.vote,
          confidence:  v.confidence,
          rationale:   v.rationale,
          keyFlags:    v.keyFlags ?? [],
          conditions:  v.conditions ?? [],
          blockers:    v.blockers ?? [],
        })),
      });
      const bytes = Uint8Array.from(atob(res.base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setReExportError(err instanceof Error ? err.message.slice(0, 80) : "Failed to generate PDF");
    } finally {
      setReExportingId(null);
    }
  };

  const FILTER_CHIPS: { label: string; value: HistoryFilter; color: string }[] = [
    { label: "All", value: "ALL", color: TEXT2 },
    { label: "Approved", value: "APPROVED", color: GREEN },
    { label: "Conditional", value: "CONDITIONAL", color: ACCENT },
    { label: "Rejected / Vetoed", value: "REJECTED", color: RED },
  ];

  const verdictColor: Record<string, string> = {
    APPROVED: GREEN,
    APPROVED_WITH_CONDITIONS: ACCENT,
    REJECTED: RED,
    VETOED: RED,
  };

  if (isLoading) {
    return <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, textAlign: "center", padding: 40 }}>Loading history...</div>;
  }

  if (!history || history.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>No deals screened yet</div>
      </div>
    );
  }

  const filteredHistory = history.filter((row) => {
    if (filter === "ALL") return true;
    if (filter === "APPROVED") return row.verdict === "APPROVED";
    if (filter === "CONDITIONAL") return row.verdict === "APPROVED_WITH_CONDITIONS";
    if (filter === "REJECTED") return row.verdict === "REJECTED" || row.verdict === "VETOED";
    return true;
  });

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em", marginRight: 4 }}>FILTER:</span>
        {FILTER_CHIPS.map((chip) => {
          const active = filter === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setFilter(chip.value)}
              style={{
                padding: "3px 12px",
                borderRadius: 3,
                border: `1px solid ${active ? chip.color : BORDER}`,
                background: active ? `${chip.color}18` : "transparent",
                color: active ? chip.color : TEXT2,
                fontFamily: MONO,
                fontSize: 10,
                cursor: "pointer",
                fontWeight: active ? 700 : 400,
                letterSpacing: "0.06em",
                transition: "all 0.12s",
              }}
            >{chip.label}</button>
          );
        })}
        <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, marginLeft: "auto" }}>
          {filteredHistory.length} of {history.length} screenings
        </span>
      </div>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr 80px 80px 100px 120px 130px",
          padding: "10px 16px",
          background: BG3,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {["DEAL NAME", "VERDICT", "YES", "NO", "CONFIDENCE", "DATE", ""].map((h) => (
            <div key={h} style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        {history.map((row) => (
          <div
            key={row.dealId}
            onClick={() => onSelect(row.dealId)}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 80px 80px 100px 120px 130px",
              padding: "12px 16px",
              borderBottom: `1px solid ${BORDER}`,
              cursor: "pointer",
              transition: "background 0.1s",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BG2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{row.dealName}</div>
            <div>
              <VerdictBadge verdict={row.verdict as VerdictType} compact />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: GREEN }}>{row.yesCount}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: RED }}>{row.noCount}</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT2 }}>
              {Math.round(parseFloat(row.confidenceScore as unknown as string) * 100)}%
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
              {new Date(row.createdAt).toLocaleDateString()}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => handleReExportPdf(e, row.dealId)}
                disabled={reExportingId === row.dealId}
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  padding: "5px 10px",
                  borderRadius: 3,
                  border: `1px solid ${ACCENT}40`,
                  background: reExportingId === row.dealId ? `${ACCENT}18` : "transparent",
                  color: reExportingId === row.dealId ? MUTED : ACCENT,
                  cursor: reExportingId === row.dealId ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { if (reExportingId !== row.dealId) e.currentTarget.style.background = `${ACCENT}18`; }}
                onMouseLeave={e => { if (reExportingId !== row.dealId) e.currentTarget.style.background = "transparent"; }}
              >
                {reExportingId === row.dealId ? "⟳ GENERATING..." : "↓ RE-EXPORT PDF"}
              </button>
            </div>
          </div>
        ))}
        {reExportError && (
          <div style={{ padding: "8px 16px", fontFamily: MONO, fontSize: 10, color: RED, borderTop: `1px solid ${BORDER}` }}>
            PDF error: {reExportError}
          </div>
        )}
      </div>
    </div>
  );
}

// ── // ── Tier 0 Signal Feed (Phase 2) ───────────────────────────────────────────────────────────────
function Tier0Feed({ onRunIC }: { onRunIC: (dealName: string, dealText: string) => void }) {
  const { data: feedData, isLoading } = trpc.dealScreener.tier0Feed.useQuery();
  const signals = feedData?.signals;
  const lastRefreshed = feedData?.lastRefreshed;

  if (isLoading) {
    return <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED, textAlign: "center", padding: 40 }}>Loading signals...</div>;
  }

  if (!signals || signals.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎓</div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>No Tier 0 signals available</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: "#4a9eff", letterSpacing: "0.14em", marginBottom: 4 }}>TIER 0 UNIVERSITY SIGNAL FEED</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>Controlled release · High-confidence early-stage signals only · Max 5 per session</div>
        </div>
        {lastRefreshed && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.06em", textAlign: "right", flexShrink: 0 }}>
            Last refreshed {new Date(lastRefreshed).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
      {/* Signal cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {signals.map((sig, i) => (
          <div key={i} style={{
            background: BG2,
            border: `1px solid ${sig.tier === "0A" ? "rgba(0,255,135,0.25)" : "rgba(255,159,67,0.25)"}`,
            borderRadius: 8,
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 22, marginTop: 2 }}>🎓</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{sig.companyName}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  background: sig.tier === "0A" ? "rgba(0,255,135,0.12)" : "rgba(255,159,67,0.12)",
                  border: `1px solid ${sig.tier === "0A" ? "rgba(0,255,135,0.4)" : "rgba(255,159,67,0.4)"}`,
                  color: sig.tier === "0A" ? GREEN : AMBER,
                  padding: "2px 8px", borderRadius: 3, letterSpacing: "0.08em",
                }}>TIER {sig.tier}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 9,
                  background: "rgba(74,158,255,0.1)",
                  border: "1px solid rgba(74,158,255,0.3)",
                  color: "#4a9eff",
                  padding: "2px 8px", borderRadius: 3, letterSpacing: "0.08em",
                }}>{sig.subtype.toUpperCase()}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 9,
                  color: sig.classification === "Startup" ? GREEN : sig.classification === "Emerging" ? AMBER : MUTED,
                  letterSpacing: "0.06em",
                }}>{sig.classification.toUpperCase()}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 6 }}>
                {sig.source} · {sig.description}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
                Score boost: <span style={{ color: sig.tier === "0A" ? GREEN : AMBER }}>+{sig.scoreBoost} pts</span>
                {" · "}
                Confidence: <span style={{ color: sig.confidence === "High" ? GREEN : AMBER }}>{sig.confidence}</span>
              </div>
            </div>
            <button
              onClick={() => onRunIC(sig.companyName, `${sig.companyName} — ${sig.subtype} signal from ${sig.source}.\n\n${sig.description}\n\nClassification: ${sig.classification}\nTier: ${sig.tier}\nConfidence: ${sig.confidence}`)}
              style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                background: "rgba(74,158,255,0.1)",
                border: "1px solid rgba(74,158,255,0.4)",
                color: "#4a9eff",
                padding: "8px 16px", borderRadius: 4,
                cursor: "pointer", letterSpacing: "0.08em",
                whiteSpace: "nowrap",
                transition: "all 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(74,158,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(74,158,255,0.1)"; }}
            >⚡ RUN IC</button>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, textAlign: "center", marginTop: 20, letterSpacing: "0.08em" }}>
        EXPERIMENTAL · CONTROLLED RELEASE · HIGH-CONFIDENCE SIGNALS ONLY
      </div>
    </div>
  );
}

// ── Recent Signals Panel ─────────────────────────────────────────────────────
function RecentSignalsPanel({ onScreen }: { onScreen: (text: string) => void }) {
  const { data, isLoading } = trpc.dealScreener.listSignals.useQuery();
  const { data: prefs } = trpc.dealScreener.getSignalPrefs.useQuery();
  const toggleAutoScreen = trpc.dealScreener.toggleAutoScreen.useMutation();
  const markScreened = trpc.dealScreener.markSignalScreened.useMutation();
  const utils = trpc.useUtils();

  const signals = data?.signals ?? [];
  const isDemo = data?.isDemo ?? true;
  const autoScreen = prefs?.autoScreen ?? false;

  if (isLoading) return (
    <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED, padding: "12px 0" }}>Loading signals...</div>
  );
  if (signals.length === 0) return null;

  return (
    <div style={{ marginTop: 28, maxWidth: 680, margin: "28px auto 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: ACCENT }}>RECENT MARKET SIGNALS</span>
          {isDemo && (
            <span style={{ fontFamily: MONO, fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(255,159,67,0.12)", border: "1px solid rgba(255,159,67,0.3)", color: AMBER, letterSpacing: "0.08em" }}>DEMO</span>
          )}
        </div>
        {/* Auto-screen toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <div
            onClick={() => {
              toggleAutoScreen.mutate({ autoScreen: !autoScreen }, {
                onSuccess: () => utils.dealScreener.getSignalPrefs.invalidate(),
              });
            }}
            style={{
              width: 28, height: 16, borderRadius: 8,
              background: autoScreen ? "rgba(0,255,135,0.3)" : "rgba(255,255,255,0.1)",
              border: `1px solid ${autoScreen ? GREEN : BORDER}`,
              position: "relative", cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <div style={{
              position: "absolute", top: 2, left: autoScreen ? 13 : 2,
              width: 10, height: 10, borderRadius: "50%",
              background: autoScreen ? GREEN : MUTED,
              transition: "all 0.15s",
            }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 9, color: autoScreen ? GREEN : MUTED, letterSpacing: "0.06em" }}>AUTO-SCREEN</span>
        </label>
      </div>
      {/* Signal cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {signals.slice(0, 5).map((sig) => (
          <div
            key={sig.id}
            style={{
              background: BG2,
              border: `1px solid ${sig.screened ? BORDER : "rgba(74,158,255,0.25)"}`,
              borderRadius: 6,
              padding: "12px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              opacity: sig.screened ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{sig.company}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(74,158,255,0.1)", border: "1px solid rgba(74,158,255,0.25)", color: ACCENT, letterSpacing: "0.08em" }}>{sig.sector.toUpperCase()}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, padding: "1px 6px", borderRadius: 3, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT2, letterSpacing: "0.06em" }}>{sig.stage}</span>
                {sig.screened && <span style={{ fontFamily: MONO, fontSize: 8, color: GREEN, letterSpacing: "0.06em" }}>✓ SCREENED</span>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 4, lineHeight: 1.5 }}>{sig.summary}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
                {sig.source} · {new Date(sig.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>
            <button
              onClick={() => {
                const prefillText = `${sig.company} — ${sig.stage} · ${sig.sector}\n\n${sig.summary}\n\nSource: ${sig.source}`;
                if (sig.id > 0) {
                  markScreened.mutate({ signalId: sig.id }, {
                    onSuccess: () => utils.dealScreener.listSignals.invalidate(),
                  });
                }
                onScreen(prefillText);
              }}
              style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                background: "rgba(74,158,255,0.1)",
                border: "1px solid rgba(74,158,255,0.4)",
                color: ACCENT,
                padding: "6px 12px", borderRadius: 4,
                cursor: "pointer", letterSpacing: "0.08em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(74,158,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(74,158,255,0.1)"; }}
            >⚡ SCREEN</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main DealScreener page ────────────────────────────────────────────
type View = "input" | "loading" | "report" | "history" | "signals";

// ── Demo Deal Cards ──────────────────────────────────────────────────────────
function DemoDealCards() {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', sans-serif", padding: "40px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: ACCENT, letterSpacing: "0.12em", marginBottom: 8 }}>DEMO MODE · DEAL SCREENER</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 4 }}>GCC Deal Pipeline</h1>
        <p style={{ fontSize: 13, color: TEXT2, marginBottom: 32, fontFamily: MONO }}>5 synthetic institutional deals · Kuwait · KSA · UAE · All data is illustrative</p>
        <div style={{ display: "grid", gap: 16 }}>
          {DEMO_DEAL_SCREENER_DATA.map(deal => {
            const recColor = deal.icRecommendation === 'Proceed to due diligence' ? GREEN : deal.icRecommendation === 'Hold' ? AMBER : RED;
            return (
              <div key={deal.id} style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{deal.company}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 3, background: "rgba(74,158,255,0.12)", border: `1px solid ${BORDER}`, color: ACCENT }}>{deal.sector}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 3, background: "rgba(74,158,255,0.08)", border: `1px solid ${BORDER}`, color: TEXT2 }}>{deal.geography}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 8px", borderRadius: 3, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT2 }}>{deal.dealType}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, padding: "3px 10px", borderRadius: 3, background: `rgba(${recColor === GREEN ? '0,255,135' : recColor === AMBER ? '255,159,67' : '255,71,87'},0.12)`, border: `1px solid ${recColor}`, color: recColor, marginBottom: 6 }}>{deal.icRecommendation.toUpperCase()}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2 }}>Confidence: <span style={{ color: TEXT }}>{deal.confidenceScore}%</span></div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
                  <div style={{ background: BG3, borderRadius: 4, padding: "10px 14px" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 3 }}>REVENUE</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT }}>{deal.currency} {(deal.revenue / 1000000).toFixed(1)}M</div>
                  </div>
                  <div style={{ background: BG3, borderRadius: 4, padding: "10px 14px" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 3 }}>EBITDA</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT }}>{deal.currency} {(deal.ebitda / 1000000).toFixed(1)}M <span style={{ color: TEXT2 }}>({deal.ebitdaMargin}%)</span></div>
                  </div>
                  <div style={{ background: BG3, borderRadius: 4, padding: "10px 14px" }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, marginBottom: 3 }}>EV / MULTIPLE</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT }}>{deal.askingMultiple}x <span style={{ color: TEXT2 }}>({deal.currency} {(deal.impliedEV / 1000000).toFixed(1)}M)</span></div>
                  </div>
                </div>
                <div style={{ background: "rgba(255,71,87,0.06)", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 4, padding: "10px 14px", marginBottom: 12 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginBottom: 3 }}>KEY RISK</div>
                  <div style={{ fontSize: 12, color: TEXT2 }}>{deal.keyRisk}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{deal.analystName} · {deal.date}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 32, textAlign: "center", padding: 24, background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, marginBottom: 12 }}>Connect your data to run live Council of 10 analysis</div>
          <a href={getLoginUrl()} style={{ display: "inline-block", padding: "10px 24px", background: ACCENT, color: "#000", borderRadius: 4, fontFamily: MONO, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>SIGN IN TO ANALYSE →</a>
        </div>
      </div>
    </div>
  );
}

export default function DealScreener() {
  const isDemo = isDemoMode();
  const { isAuthenticated, loading, user } = useAuth();
  const [view, setView] = useState<View>("input");
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [councilMode, setCouncilMode] = useState<CouncilModeType>("gcc");

  // Parse Stripe return params from URL
  const urlParams = new URLSearchParams(window.location.search);
  const paidParam = urlParams.get("paid");
  const sessionIdParam = urlParams.get("session_id");
  const [pendingPaymentSessionId, setPendingPaymentSessionId] = useState<string | null>(
    paidParam === "1" && sessionIdParam ? sessionIdParam : null
  );

  if (isDemo) return <DemoDealCards />;

  const { data: dealDetail } = trpc.dealScreener.getById.useQuery(
    { dealId: selectedDealId! },
    { enabled: !!selectedDealId }
  );

  const handleResult = (r: CouncilResult) => {
    setResult(r);
    setView("report");
  };

  const handleNewDeal = () => {
    setResult(null);
    setView("input");
  };

  const handleHistorySelect = (dealId: string) => {
    setSelectedDealId(dealId);
  };

  useEffect(() => {
    if (dealDetail) {
      setResult(dealDetail as unknown as CouncilResult);
      setView("report");
    }
  }, [dealDetail]);

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT2, marginBottom: 16 }}>Sign in to access Deal Screener</div>
          <a href={getLoginUrl()} style={{
            display: "inline-block",
            padding: "10px 24px",
            background: ACCENT,
            color: "#000",
            borderRadius: 4,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
          }}>
            SIGN IN →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Inter', sans-serif" }}>
      {/* Print stylesheet — IC Report only */}
      <style>{`
        @media print {
          /* Hide all navigation and chrome */
          body > *:not(#root) { display: none !important; }
          .no-print { display: none !important; }
          /* Hide tab switcher, nav bar, history, form */
          [data-print-hide] { display: none !important; }
          /* Expand content */
          #root, #root > *, #root > * > * { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
          /* Force dark background for PDF */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body, html { background: #070b12 !important; color: #e2e8f0 !important; }
          /* Remove box shadows and transitions */
          * { box-shadow: none !important; transition: none !important; animation: none !important; }
          /* Page margins */
          @page { margin: 16mm 12mm; size: A4 portrait; }
        }
      `}</style>
      {/* Top nav */}
      <div data-print-hide style={{
        borderBottom: `1px solid ${BORDER}`,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        height: 52,
        background: BG2,
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, marginRight: 32 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: ACCENT }}>AGENTHINK</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>MESH</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[
            { id: "input" as View, label: "NEW DEAL" },
            { id: "history" as View, label: "HISTORY" },
            { id: "signals" as View, label: "SIGNALS 🎓" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              style={{
                padding: "6px 14px",
                background: view === tab.id ? "rgba(74,158,255,0.1)" : "transparent",
                border: "none",
                borderBottom: `2px solid ${view === tab.id ? ACCENT : "transparent"}`,
                color: view === tab.id ? ACCENT : MUTED,
                fontFamily: MONO,
                fontSize: 10,
                cursor: "pointer",
                letterSpacing: "0.08em",
              }}
            >
              {tab.label}
            </button>
          ))}
          {(view === "report" || view === "loading") && (
            <button
              style={{
                padding: "6px 14px",
                background: "rgba(74,158,255,0.1)",
                border: "none",
                borderBottom: `2px solid ${ACCENT}`,
                color: ACCENT,
                fontFamily: MONO,
                fontSize: 10,
                cursor: "default",
                letterSpacing: "0.08em",
              }}
            >
              {view === "loading" ? "SCREENING..." : "IC REPORT"}
            </button>
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/account/payments"
            style={{ fontFamily: MONO, fontSize: 10, color: MUTED, textDecoration: "none", letterSpacing: "0.08em" }}
            onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            BILLING ↗
          </a>
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
            DEAL SCREENER · COUNCIL OF 10
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "40px 24px", maxWidth: 960, margin: "0 auto" }}>
        {view === "input" && (
          <>
            <DealForm
              onResult={handleResult}
              onSubmitStart={() => { setScreenError(null); setView("loading"); }}
              onError={(msg) => { setScreenError(msg); setView("input"); }}
              pendingPaymentSessionId={pendingPaymentSessionId}
              onPaymentVerified={() => setPendingPaymentSessionId(null)}
              councilMode={councilMode}
              setCouncilMode={setCouncilMode}
            />
            <RecentSignalsPanel onScreen={(text) => {
              // Pre-fill deal text via the tier0:prefill event
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("tier0:prefill", { detail: { dealName: "", dealText: text } }));
              }, 50);
            }} />
          </>
        )}
        {view === "input" && screenError && (
          <div style={{ maxWidth: 680, margin: "-16px auto 0", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, fontFamily: MONO, fontSize: 11, color: "#F87171" }}>
            {screenError}
          </div>
        )}
        {view === "loading" && <PersonaLoadingGrid councilMode={councilMode} />}
        {view === "report" && result && (
          <ICReport result={result} onNewDeal={handleNewDeal} />
        )}
        {view === "history" && (
          <HistoryTable onSelect={(id) => { setSelectedDealId(id); }} />
        )}
        {view === "signals" && (
          <Tier0Feed onRunIC={(dealName, dealText) => {
            // Pre-fill and auto-submit from signals feed
            setView("input");
            // Small delay to let the form mount, then trigger via a custom event
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("tier0:prefill", { detail: { dealName, dealText } }));
            }, 100);
          }} />
        )}
      </div>
    </div>
  );
}
